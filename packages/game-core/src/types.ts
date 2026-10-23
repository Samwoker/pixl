export type ZoneLevel = 1 | 2 | 3 | 4 | 5;

export type EnemyKind = 'security' | 'scout' | 'guardian' | 'hunter';

export type ItemId =
  | 'energy_cell'
  | 'circuit_board'
  | 'drone_part'
  | 'shield_module'
  | 'quantum_chip'
  | 'plasma_cannon'
  | 'ancient_cpu';

export interface Vec2 {
  x: number;
  y: number;
}

export interface TilePoint {
  tx: number;
  ty: number;
}

export interface DroneStats {
  hp: number;
  energy: number;
  shield: number;
  speed: number;
  cargoCapacity: number;
  weaponDamage: number;
  scanRange: number;
}

export interface MissionSpec {
  missionId: string;
  seed: number;
  zone: ZoneLevel;
}

/** What the client reports. The server recomputes all rewards from this; it never accepts credits/XP. */
export interface MissionResult {
  missionId: string;
  seed: number;
  zone: ZoneLevel;
  durationSec: number;
  extracted: boolean;
  enemiesKilled: number;
  damageTaken: number;
  shotsFired: number;
  items: Partial<Record<ItemId, number>>;
}

export interface MissionRewards {
  lootValue: number;
  killBonus: number;
  extractionBonus: number;
  damagePenalty: number;
  score: number;
  credits: number;
  xp: number;
}
