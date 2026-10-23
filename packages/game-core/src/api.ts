import type { ArenaId } from './arena/arenas';
import type { ColorId, DesignId } from './arena/cosmetics';
import type { MarketItemId } from './arena/market';
import type { ArenaMode } from './arena/rules';
import type { WeaponId } from './arena/weapons';

export interface PlayerStats {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  rating: number;
  bestStreak: number;
  salvageRuns: number;
  salvageExtractions: number;
}

export interface EquippedLoadout {
  primary: WeaponId;
  secondary: WeaponId;
  design: DesignId;
  color: ColorId;
}

export interface PlayerProfile {
  id: string;
  callsign: string;
  credits: number;
  xp: number;
  level: number;
  stats: PlayerStats;
  /** Item id → level (cosmetics are always level 1). Includes free starter items. */
  owned: Partial<Record<MarketItemId, number>>;
  loadout: EquippedLoadout;
}

export interface LeaderboardEntry {
  rank: number;
  callsign: string;
  level: number;
  rating: number;
  kills: number;
  deaths: number;
  wins: number;
  matches: number;
}

export interface PublicRoom {
  code: string;
  mode: ArenaMode;
  arena: ArenaId;
  humans: number;
  bots: number;
  timeLeft: number;
}

export interface ApiError {
  error: { code: string; message: string };
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}
