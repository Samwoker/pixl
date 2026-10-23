import type { ArenaId } from './arenas';
import type { DroneCosmetics } from './cosmetics';
import type { ArenaInput } from './movement';
import type { ArenaMode, BotDifficulty } from './rules';
import type { WeaponId } from './weapons';

export type TeamId = 0 | 1;

export interface Loadout {
  primary: WeaponId;
  secondary: WeaponId;
  levels: Partial<Record<WeaponId, number>>;
  cosmetics: DroneCosmetics;
}

export interface RosterEntry {
  id: string;
  name: string;
  bot: boolean;
  team: TeamId | null;
  cosmetics: DroneCosmetics;
  weapons: [WeaponId, WeaponId];
}

export interface PlayerSnapshot {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aim: number;
  hp: number;
  shield: number;
  energy: number;
  alive: boolean;
  respawnIn: number;
  protectedFor: number;
  dashTime: number;
  dashCooldown: number;
  slot: 0 | 1;
  ammo: number;
  magazine: number;
  reloading: number;
  kills: number;
  deaths: number;
  score: number;
}

export interface ProjectileSnapshot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  weapon: WeaponId;
  owner: string;
}

export type ArenaEvent =
  | { type: 'kill'; killer: string | null; victim: string; weapon: WeaponId | null }
  | { type: 'hit'; x: number; y: number; target: string | null; by: string }
  | { type: 'explosion'; x: number; y: number; radius: number }
  | { type: 'pickup'; id: string; player: string; kind: 'health' | 'shield' }
  | { type: 'respawn'; player: string; x: number; y: number };

export interface ArenaSnapshot {
  tick: number;
  time: number;
  timeLeft: number;
  teamScores: [number, number] | null;
  players: PlayerSnapshot[];
  projectiles: ProjectileSnapshot[];
  pickups: string[];
  events: ArenaEvent[];
}

export interface PlayerResult {
  id: string;
  name: string;
  bot: boolean;
  team: TeamId | null;
  kills: number;
  humanKills: number;
  botKills: number;
  deaths: number;
  score: number;
  bestStreak: number;
  won: boolean;
}

export interface MatchRewards {
  credits: number;
  xp: number;
  rating: number;
}

export interface RoomInfo {
  id: string;
  code: string;
  mode: ArenaMode;
  arena: ArenaId;
  private: boolean;
  timeLimitSec: number;
  scoreLimit: number;
}

export type JoinRequest =
  | { kind: 'quick'; mode: ArenaMode; arena: ArenaId | 'any' }
  | { kind: 'create'; mode: ArenaMode; arena: ArenaId; bots: number; difficulty: BotDifficulty }
  | { kind: 'code'; code: string };

export type ClientMessage =
  | { t: 'hello'; token: string }
  | ({ t: 'join' } & JoinRequest)
  | ({ t: 'input' } & ArenaInput)
  | { t: 'leave' }
  | { t: 'ping'; c: number };

export type ServerMessage =
  | { t: 'welcome'; playerId: string; callsign: string }
  | { t: 'joined'; room: RoomInfo; you: string }
  | { t: 'roster'; players: RosterEntry[] }
  | ({ t: 'snap'; ack: number } & ArenaSnapshot)
  | {
      t: 'end';
      results: PlayerResult[];
      teamScores: [number, number] | null;
      rewards: MatchRewards | null;
    }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong'; c: number; s: number };
