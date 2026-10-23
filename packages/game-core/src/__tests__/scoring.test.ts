import { describe, expect, it } from 'vitest';
import { itemValue } from '../config';
import { generateMap } from '../map/generateMap';
import { calculateRewards } from '../scoring';
import type { MissionResult, MissionSpec } from '../types';
import { validateMissionResult } from '../validation';

const spec: MissionSpec = { missionId: 'm_1', seed: 829312, zone: 2 };
const map = generateMap(spec);

const baseResult = (overrides: Partial<MissionResult> = {}): MissionResult => ({
  missionId: spec.missionId,
  seed: spec.seed,
  zone: spec.zone,
  durationSec: 120,
  extracted: true,
  enemiesKilled: 4,
  damageTaken: 20,
  shotsFired: 60,
  items: { circuit_board: 2, energy_cell: 3 },
  ...overrides,
});

describe('calculateRewards', () => {
  it('scores extracted runs from server-side item values', () => {
    const rewards = calculateRewards(baseResult());
    const loot = itemValue('circuit_board', 2) * 2 + itemValue('energy_cell', 2) * 3;
    expect(rewards.lootValue).toBe(loot);
    expect(rewards.killBonus).toBe(4 * 25 * 2);
    expect(rewards.extractionBonus).toBe(500);
    expect(rewards.damagePenalty).toBe(40);
    expect(rewards.score).toBe(loot + 200 + 500 - 40);
    expect(rewards.credits).toBe(loot);
  });

  it('loses all loot when the drone is destroyed', () => {
    const rewards = calculateRewards(baseResult({ extracted: false }));
    expect(rewards.credits).toBe(0);
    expect(rewards.score).toBe(0);
    expect(rewards.xp).toBe(20);
  });

  it('never returns a negative score', () => {
    expect(calculateRewards(baseResult({ items: {}, damageTaken: 10_000 })).score).toBe(0);
  });
});

describe('validateMissionResult', () => {
  it('accepts a plausible result', () => {
    expect(validateMissionResult(baseResult(), spec, map)).toEqual({ ok: true });
  });

  it.each([
    [{ seed: 1 }, 'MISSION_MISMATCH'],
    [{ durationSec: 1 }, 'IMPOSSIBLE_DURATION'],
    [{ shotsFired: 10_000 }, 'IMPOSSIBLE_SHOT_COUNT'],
    [{ enemiesKilled: 500, shotsFired: 600 }, 'IMPOSSIBLE_KILL_COUNT'],
    [{ enemiesKilled: 10, shotsFired: 5 }, 'IMPOSSIBLE_KILL_COUNT'],
    [{ items: { ancient_cpu: 50 } }, 'IMPOSSIBLE_LOOT_COUNT'],
    [{ items: { circuit_board: 11 }, enemiesKilled: 20, shotsFired: 100 }, 'CARGO_EXCEEDED'],
    [{ items: { gold_bar: 1 } as MissionResult['items'] }, 'UNKNOWN_ITEM'],
    [{ enemiesKilled: -1 }, 'INVALID_NUMBER'],
  ] as const)('rejects %o with %s', (overrides, reason) => {
    expect(validateMissionResult(baseResult(overrides), spec, map)).toEqual({ ok: false, reason });
  });
});
