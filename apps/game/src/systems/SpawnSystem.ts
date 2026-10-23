import {
  bfsDistances,
  deriveSeed,
  ENEMIES,
  MISSION_TUNING,
  reinforcementWaveSize,
  Rng,
  tileCenter,
  type EnemyKind,
  type Vec2,
} from '@skyline/game-core';
import { EnemyDrone } from '../entities/EnemyDrone';
import type { MissionWorld } from '../world/MissionWorld';

const REINFORCEMENT_MIN_TILES = 14;
const REINFORCEMENT_MAX_TILES = 26;

export class SpawnSystem {
  private readonly rng: Rng;
  private waveTimer: number = MISSION_TUNING.reinforcementIntervalSec;
  private waveCount = 0;

  constructor(private readonly world: MissionWorld) {
    this.rng = new Rng(deriveSeed(world.spec.seed, 'reinforcements'));
  }

  get secondsToNextWave(): number {
    return this.waveTimer;
  }

  spawnFromMap(): void {
    for (const spawn of this.world.map.enemies) this.spawn(spawn.id, spawn.kind, spawn, false);
  }

  update(dt: number): void {
    if (!this.world.player.alive) return;
    this.waveTimer -= dt;
    if (this.waveTimer > 0) return;
    this.waveTimer = MISSION_TUNING.reinforcementIntervalSec;
    this.spawnWave();
  }

  /** Staying longer is the risk half of risk/reward: hunters arrive on a timer. */
  private spawnWave(): void {
    const { world } = this;
    const alive = world.enemies.filter((e) => e.alive).length;
    const size = Math.min(
      reinforcementWaveSize(world.spec.zone),
      MISSION_TUNING.maxEnemies - alive,
    );
    if (size <= 0) return;

    const { map, player, camera } = world;
    const start = {
      tx: Math.floor(player.x / map.tileSize),
      ty: Math.floor(player.y / map.tileSize),
    };
    const dist = bfsDistances(map, start, REINFORCEMENT_MAX_TILES);
    const candidates: Vec2[] = [];
    for (let i = 0; i < dist.length; i++) {
      const d = dist[i] as number;
      if (d < REINFORCEMENT_MIN_TILES) continue;
      const point = tileCenter(map, i % map.width, Math.floor(i / map.width));
      if (!camera.isVisible(point, 48)) candidates.push(point);
    }
    if (candidates.length === 0) return;

    const kinds = world.zone.enemyWeights;
    for (let i = 0; i < size; i++) {
      const kind = this.rng.weighted(kinds);
      this.spawn(`wave${this.waveCount}_${i}`, kind, this.rng.pick(candidates), true);
    }
    this.waveCount++;
    world.events.emit('reinforcements', { count: size });
  }

  private spawn(id: string, kind: EnemyKind, at: Vec2, relentless: boolean): void {
    const enemy = new EnemyDrone(
      id,
      ENEMIES[kind],
      this.world.assets.get(`enemy:${kind}`),
      at,
      relentless,
    );
    this.world.enemies.push(enemy);
    this.world.layers.enemies.addChild(enemy.view);
  }
}
