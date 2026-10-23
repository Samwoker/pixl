import { isZoneLevel, type MissionSpec, type ZoneLevel } from '@skyline/game-core';

const MAX_SEED = 0xffffffff;

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}

export function parseSeed(value: string | undefined): number | null {
  if (!value || !/^\d{1,10}$/.test(value)) return null;
  const seed = Number(value);
  return seed <= MAX_SEED ? seed : null;
}

export function parseZone(value: string | undefined): ZoneLevel | null {
  const zone = Number(value);
  return isZoneLevel(zone) ? zone : null;
}

/** Phase 1 stand-in: from Phase 4 the API issues missions (and seeds) server-side. */
export function createLocalMission(zone: ZoneLevel, seed: number): MissionSpec {
  return { missionId: `local_${crypto.randomUUID()}`, seed, zone };
}
