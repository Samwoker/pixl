import type {
  ArenaMode,
  DroneCosmetics,
  DroneStats,
  MissionResult,
  MissionRewards,
  MissionSpec,
  TeamId,
  WeaponId,
  ZoneLevel,
} from '@skyline/game-core';
import type { ArenaConnection } from './net/ArenaConnection';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  energy: number;
  maxEnergy: number;
  cargoUsed: number;
  cargoCapacity: number;
  zone: ZoneLevel;
  zoneName: string;
  elapsedSec: number;
  lootValue: number;
  kills: number;
  extractionDistance: number;
  extractionProgress: number;
  extractionSecondsLeft: number;
  inExtractionZone: boolean;
  dashReady: number;
  scanReady: number;
  nextWaveSec: number;
  alert: string | null;
  paused: boolean;
  muted: boolean;
}

export interface MissionEnd {
  result: MissionResult;
  /** Local preview; signed-in runs are re-scored by the server. */
  rewards: MissionRewards;
}

export interface SalvageGameOptions {
  mode: 'salvage';
  mission: MissionSpec;
  stats?: DroneStats;
  cosmetics?: DroneCosmetics;
  muted?: boolean;
  onHud?: (snapshot: HudSnapshot) => void;
  onMissionEnd?: (end: MissionEnd) => void;
}

export interface ArenaHudPlayer {
  id: string;
  name: string;
  bot: boolean;
  team: TeamId | null;
  kills: number;
  deaths: number;
  score: number;
  alive: boolean;
  you: boolean;
}

export interface KillFeedEntry {
  id: number;
  killer: string | null;
  killerTeam: TeamId | null;
  victim: string;
  victimTeam: TeamId | null;
  weapon: WeaponId | null;
  involvesYou: boolean;
}

export interface ArenaHud {
  mode: ArenaMode;
  arenaName: string;
  roomCode: string;
  isPrivate: boolean;
  timeLeft: number;
  scoreLimit: number;
  teamScores: [number, number] | null;
  myTeam: TeamId | null;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  energy: number;
  maxEnergy: number;
  alive: boolean;
  respawnIn: number;
  protected: boolean;
  weapon: { id: WeaponId; ammo: number; magazine: number; reloading: number };
  otherWeapon: WeaponId;
  dashReady: number;
  kills: number;
  deaths: number;
  score: number;
  scoreboard: ArenaHudPlayer[];
  killFeed: KillFeedEntry[];
  hitMarker: boolean;
  ping: number;
  menuOpen: boolean;
  muted: boolean;
}

export interface ArenaGameOptions {
  mode: 'arena';
  connection: ArenaConnection;
  muted?: boolean;
  onHud?: (snapshot: ArenaHud) => void;
}

export type GameOptions = SalvageGameOptions | ArenaGameOptions;
