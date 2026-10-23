import type { DroneStats, EnemyKind, ItemId, ZoneLevel } from './types';

export const WORLD = {
  tileSize: 48,
  mapTiles: 64,
} as const;

export const BASE_DRONE_STATS: Readonly<DroneStats> = {
  hp: 100,
  energy: 100,
  shield: 25,
  speed: 180,
  cargoCapacity: 10,
  weaponDamage: 15,
  scanRange: 240,
};

export const DRONE_TUNING = {
  radius: 14,
  acceleration: 1400,
  friction: 10,
  fireCooldownSec: 0.2,
  shotEnergyCost: 1,
  projectileSpeed: 620,
  projectileLifeSec: 0.9,
  energyRegenPerSec: 8,
  shieldRegenDelaySec: 3,
  shieldRegenPerSec: 6,
  dashSpeed: 620,
  dashDurationSec: 0.16,
  dashCooldownSec: 0.9,
  dashEnergyCost: 20,
  scanEnergyCost: 25,
  scanCooldownSec: 2,
  pickupRadius: 30,
  noiseRadius: 320,
} as const;

export const MISSION_TUNING = {
  extractionRadius: 64,
  extractionHoldSec: 5,
  reinforcementIntervalSec: 45,
  maxEnemies: 70,
  minDurationSec: 5,
  maxDurationSec: 3600,
} as const;

export function reinforcementWaveSize(zone: ZoneLevel): number {
  return 1 + zone;
}

export interface EnemyDefinition {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  detectionRadius: number;
  attackRange: number;
  attackCooldownSec: number;
  projectileSpeed: number;
  /** Shots fired in sequence per attack. */
  burst: number;
  /** Projectiles fanned out per shot. */
  spread: number;
  dropChance: number;
  killScore: number;
}

export const ENEMIES: Readonly<Record<EnemyKind, EnemyDefinition>> = {
  security: {
    kind: 'security',
    name: 'Security Drone',
    hp: 30,
    speed: 75,
    damage: 7,
    radius: 13,
    detectionRadius: 260,
    attackRange: 230,
    attackCooldownSec: 1.2,
    projectileSpeed: 300,
    burst: 1,
    spread: 1,
    dropChance: 0.35,
    killScore: 1,
  },
  scout: {
    kind: 'scout',
    name: 'Scout Drone',
    hp: 18,
    speed: 145,
    damage: 4,
    radius: 11,
    detectionRadius: 320,
    attackRange: 200,
    attackCooldownSec: 0.7,
    projectileSpeed: 380,
    burst: 1,
    spread: 1,
    dropChance: 0.25,
    killScore: 1,
  },
  guardian: {
    kind: 'guardian',
    name: 'Heavy Guardian',
    hp: 130,
    speed: 45,
    damage: 14,
    radius: 19,
    detectionRadius: 240,
    attackRange: 260,
    attackCooldownSec: 2,
    projectileSpeed: 230,
    burst: 1,
    spread: 3,
    dropChance: 0.7,
    killScore: 3,
  },
  hunter: {
    kind: 'hunter',
    name: 'Elite Hunter',
    hp: 75,
    speed: 115,
    damage: 9,
    radius: 14,
    detectionRadius: 400,
    attackRange: 300,
    attackCooldownSec: 1.4,
    projectileSpeed: 440,
    burst: 3,
    spread: 1,
    dropChance: 0.8,
    killScore: 5,
  },
};

export interface ItemDefinition {
  id: ItemId;
  name: string;
  baseValue: number;
  /** 0 = common ... 5 = legendary. */
  tier: number;
  weight: number;
  usesCargo: boolean;
}

export const ITEMS: Readonly<Record<ItemId, ItemDefinition>> = {
  energy_cell: {
    id: 'energy_cell',
    name: 'Energy Cell',
    baseValue: 10,
    tier: 0,
    weight: 0,
    usesCargo: false,
  },
  circuit_board: {
    id: 'circuit_board',
    name: 'Circuit Board',
    baseValue: 40,
    tier: 0,
    weight: 40,
    usesCargo: true,
  },
  drone_part: {
    id: 'drone_part',
    name: 'Drone Part',
    baseValue: 60,
    tier: 1,
    weight: 28,
    usesCargo: true,
  },
  shield_module: {
    id: 'shield_module',
    name: 'Shield Module',
    baseValue: 120,
    tier: 2,
    weight: 14,
    usesCargo: true,
  },
  quantum_chip: {
    id: 'quantum_chip',
    name: 'Quantum Chip',
    baseValue: 250,
    tier: 3,
    weight: 9,
    usesCargo: true,
  },
  plasma_cannon: {
    id: 'plasma_cannon',
    name: 'Plasma Cannon',
    baseValue: 400,
    tier: 4,
    weight: 5,
    usesCargo: true,
  },
  ancient_cpu: {
    id: 'ancient_cpu',
    name: 'Ancient CPU',
    baseValue: 800,
    tier: 5,
    weight: 2,
    usesCargo: true,
  },
};

export const ENERGY_CELL_RESTORE = 35;

export interface ZoneDefinition {
  level: ZoneLevel;
  name: string;
  valueMultiplier: number;
  enemyCount: number;
  salvageCount: number;
  energyCellCount: number;
  enemyWeights: readonly (readonly [EnemyKind, number])[];
}

export const ZONES: Readonly<Record<ZoneLevel, ZoneDefinition>> = {
  1: {
    level: 1,
    name: 'Outer Sprawl',
    valueMultiplier: 1,
    enemyCount: 12,
    salvageCount: 26,
    energyCellCount: 14,
    enemyWeights: [
      ['security', 0.75],
      ['scout', 0.25],
    ],
  },
  2: {
    level: 2,
    name: 'Freight Ward',
    valueMultiplier: 2.5,
    enemyCount: 17,
    salvageCount: 28,
    energyCellCount: 14,
    enemyWeights: [
      ['security', 0.5],
      ['scout', 0.35],
      ['guardian', 0.15],
    ],
  },
  3: {
    level: 3,
    name: 'Neon Market',
    valueMultiplier: 7,
    enemyCount: 22,
    salvageCount: 30,
    energyCellCount: 12,
    enemyWeights: [
      ['security', 0.35],
      ['scout', 0.3],
      ['guardian', 0.25],
      ['hunter', 0.1],
    ],
  },
  4: {
    level: 4,
    name: 'Spire District',
    valueMultiplier: 20,
    enemyCount: 28,
    salvageCount: 32,
    energyCellCount: 12,
    enemyWeights: [
      ['security', 0.25],
      ['scout', 0.25],
      ['guardian', 0.3],
      ['hunter', 0.2],
    ],
  },
  5: {
    level: 5,
    name: 'The Core',
    valueMultiplier: 60,
    enemyCount: 34,
    salvageCount: 34,
    energyCellCount: 10,
    enemyWeights: [
      ['security', 0.15],
      ['scout', 0.2],
      ['guardian', 0.35],
      ['hunter', 0.3],
    ],
  },
};

export const ZONE_LEVELS: readonly ZoneLevel[] = [1, 2, 3, 4, 5];

export function isZoneLevel(value: number): value is ZoneLevel {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export function itemValue(itemId: ItemId, zone: ZoneLevel): number {
  return Math.round(ITEMS[itemId].baseValue * ZONES[zone].valueMultiplier);
}

/** Rarer tiers become proportionally more likely in deeper zones. */
export function salvageWeights(zone: ZoneLevel): [ItemId, number][] {
  return Object.values(ITEMS)
    .filter((item) => item.usesCargo)
    .map((item) => [item.id, item.weight * (1 + 0.45 * (zone - 1) * item.tier)]);
}
