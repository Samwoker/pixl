import {
  BASE_DRONE_STATS,
  DRONE_TUNING,
  ITEMS,
  MISSION_TUNING,
  reinforcementWaveSize,
} from './config';
import type { CityMap } from './map/tiles';
import type { DroneStats, ItemId, MissionResult, MissionSpec } from './types';

export type RejectionReason =
  | 'MISSION_MISMATCH'
  | 'INVALID_NUMBER'
  | 'IMPOSSIBLE_DURATION'
  | 'IMPOSSIBLE_SHOT_COUNT'
  | 'IMPOSSIBLE_KILL_COUNT'
  | 'UNKNOWN_ITEM'
  | 'IMPOSSIBLE_LOOT_COUNT'
  | 'CARGO_EXCEEDED';

export type ValidationOutcome = { ok: true } | { ok: false; reason: RejectionReason };

const reject = (reason: RejectionReason): ValidationOutcome => ({ ok: false, reason });

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Plausibility checks against what the seeded map could have produced.
 * Not a full replay verifier; it catches impossible claims cheaply.
 */
export function validateMissionResult(
  result: MissionResult,
  spec: MissionSpec,
  map: CityMap,
  stats: DroneStats = BASE_DRONE_STATS,
): ValidationOutcome {
  if (
    result.missionId !== spec.missionId ||
    result.seed !== spec.seed ||
    result.zone !== spec.zone
  ) {
    return reject('MISSION_MISMATCH');
  }
  if (
    !isCount(result.enemiesKilled) ||
    !isCount(result.shotsFired) ||
    !Number.isFinite(result.durationSec) ||
    !Number.isFinite(result.damageTaken) ||
    result.damageTaken < 0
  ) {
    return reject('INVALID_NUMBER');
  }
  if (
    result.durationSec < MISSION_TUNING.minDurationSec ||
    result.durationSec > MISSION_TUNING.maxDurationSec
  ) {
    return reject('IMPOSSIBLE_DURATION');
  }

  const maxShots = Math.floor(result.durationSec / DRONE_TUNING.fireCooldownSec) + 1;
  if (result.shotsFired > maxShots) return reject('IMPOSSIBLE_SHOT_COUNT');

  const waves = Math.floor(result.durationSec / MISSION_TUNING.reinforcementIntervalSec);
  const maxEnemies = map.enemies.length + waves * reinforcementWaveSize(spec.zone);
  if (result.enemiesKilled > maxEnemies || result.enemiesKilled > result.shotsFired) {
    return reject('IMPOSSIBLE_KILL_COUNT');
  }

  const available = new Map<ItemId, number>();
  for (const spawn of map.loot) available.set(spawn.itemId, (available.get(spawn.itemId) ?? 0) + 1);

  let cargoUsed = 0;
  for (const [itemId, count] of Object.entries(result.items)) {
    if (!(itemId in ITEMS)) return reject('UNKNOWN_ITEM');
    if (!isCount(count)) return reject('INVALID_NUMBER');
    const item = ITEMS[itemId as ItemId];
    // Enemy drops are salvage only, at most one per kill.
    const dropAllowance = item.usesCargo ? result.enemiesKilled : 0;
    if (count > (available.get(item.id) ?? 0) + dropAllowance)
      return reject('IMPOSSIBLE_LOOT_COUNT');
    if (item.usesCargo) cargoUsed += count;
  }
  if (cargoUsed > stats.cargoCapacity) return reject('CARGO_EXCEEDED');

  return { ok: true };
}
