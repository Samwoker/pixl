export type ArenaMode = 'ffa' | 'tdm';
export type BotDifficulty = 'easy' | 'normal' | 'hard';

export const ARENA_TUNING = {
  tickRate: 30,
  maxPlayers: 8,
  radius: 14,
  maxHp: 100,
  maxShield: 25,
  maxEnergy: 100,
  speed: 200,
  friction: 10,
  dashSpeed: 640,
  dashDurationSec: 0.16,
  dashCooldownSec: 1.2,
  dashEnergyCost: 30,
  energyRegenPerSec: 15,
  shieldRegenDelaySec: 3,
  shieldRegenPerSec: 8,
  respawnSec: 3,
  spawnProtectionSec: 1.5,
  pickupRadius: 26,
  pickupRespawnSec: 20,
  healthPickup: 50,
  shieldPickup: 25,
  /** Inputs processed per player per tick; caps speed hacks from flooding inputs. */
  maxInputsPerTick: 3,
  resultsHoldSec: 12,
} as const;

export interface ModeRules {
  mode: ArenaMode;
  name: string;
  timeLimitSec: number;
  scoreLimit: number;
}

export const ARENA_MODES: Readonly<Record<ArenaMode, ModeRules>> = {
  ffa: { mode: 'ffa', name: 'Free for all', timeLimitSec: 240, scoreLimit: 15 },
  tdm: { mode: 'tdm', name: 'Team deathmatch', timeLimitSec: 300, scoreLimit: 30 },
};

export function isArenaMode(value: unknown): value is ArenaMode {
  return value === 'ffa' || value === 'tdm';
}

export function isBotDifficulty(value: unknown): value is BotDifficulty {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

/** Damage needed to destroy a full-health, full-shield drone in one hit. */
export const ONE_SHOT_DAMAGE = ARENA_TUNING.maxHp + ARENA_TUNING.maxShield;
