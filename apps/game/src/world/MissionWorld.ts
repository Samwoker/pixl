import type { Container } from 'pixi.js';
import type { CityMap, ItemId, MissionSpec, Vec2, ZoneDefinition } from '@skyline/game-core';
import type { AssetManager } from '../engine/AssetManager';
import type { EventBus } from '../engine/EventBus';
import type { EnemyDrone } from '../entities/EnemyDrone';
import type { ExtractionZone } from '../entities/ExtractionZone';
import type { Loot } from '../entities/Loot';
import type { PlayerDrone } from '../entities/PlayerDrone';
import type { Keyboard } from '../input/Keyboard';
import type { Mouse } from '../input/Mouse';
import type { Camera } from '../rendering/Camera';

export interface MissionEvents {
  shot: { x: number; y: number; angle: number; owner: 'player' | 'enemy' };
  projectileImpact: { x: number; y: number; owner: 'player' | 'enemy' };
  enemyHit: { enemy: EnemyDrone; damage: number };
  enemyKilled: { enemy: EnemyDrone };
  playerHit: { damage: number };
  playerDestroyed: Vec2;
  dash: Vec2;
  scan: { x: number; y: number; radius: number; revealed: number };
  itemCollected: { itemId: ItemId; x: number; y: number; value: number };
  cargoFull: Vec2;
  reinforcements: { count: number };
  extractionStarted: Vec2;
  extracted: Vec2;
}

export interface MissionLayers {
  ground: Container;
  extraction: Container;
  loot: Container;
  enemies: Container;
  player: Container;
  projectiles: Container;
  effects: Container;
}

export interface MissionStats {
  elapsedSec: number;
  kills: number;
  damageTaken: number;
  shotsFired: number;
  items: Partial<Record<ItemId, number>>;
}

/** Shared mutable state that every system reads/writes for one mission. */
export interface MissionWorld {
  spec: MissionSpec;
  map: CityMap;
  zone: ZoneDefinition;
  assets: AssetManager;
  events: EventBus<MissionEvents>;
  keyboard: Keyboard;
  mouse: Mouse;
  camera: Camera;
  layers: MissionLayers;
  player: PlayerDrone;
  enemies: EnemyDrone[];
  loot: Loot[];
  extraction: ExtractionZone;
  stats: MissionStats;
  aimWorld: Vec2;
  time: number;
  ended: boolean;
}
