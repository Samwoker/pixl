import {
  bfsDistances,
  flowDirection,
  hasLineOfSight,
  isSolidWorld,
  type Vec2,
} from '@skyline/game-core';
import { RENDER } from '../config/gameConfig';
import type { EnemyDrone } from '../entities/EnemyDrone';
import type { MissionWorld } from '../world/MissionWorld';
import type { CombatSystem } from './CombatSystem';

const LOSE_INTEREST_SEC = 6;
const BURST_GAP_SEC = 0.11;
const WANDER_RADIUS = 110;

export class EnemyAISystem {
  private flowField: Int32Array | null = null;
  private flowKey = -1;

  constructor(
    private readonly world: MissionWorld,
    private readonly combat: CombatSystem,
  ) {
    // Firing makes noise: nearby idle drones come to investigate.
    world.events.on('shot', ({ x, y, owner }) => {
      if (owner !== 'player') return;
      for (const enemy of world.enemies) {
        if (enemy.alive && enemy.state === 'patrol' && Math.hypot(enemy.x - x, enemy.y - y) < 320) {
          enemy.state = 'chase';
          enemy.lostSightSec = 0;
        }
      }
    });
  }

  update(dt: number): void {
    const { enemies, player } = this.world;
    this.refreshFlowField();
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.sightTimer -= dt;
      if (enemy.sightTimer <= 0) {
        enemy.sightTimer = RENDER.aggroRefreshSec;
        enemy.canSee = player.alive && this.canSeePlayer(enemy);
      }
      if (enemy.state === 'patrol') this.patrol(enemy, dt);
      else this.chase(enemy, dt);
      this.updateBurst(enemy, dt);
    }
  }

  private canSeePlayer(enemy: EnemyDrone): boolean {
    const { player, map } = this.world;
    const range =
      enemy.state === 'chase' ? enemy.def.detectionRadius * 1.5 : enemy.def.detectionRadius;
    if (Math.hypot(player.x - enemy.x, player.y - enemy.y) > range) return false;
    return hasLineOfSight(map, enemy, player);
  }

  private refreshFlowField(): void {
    const { player, map } = this.world;
    const tx = Math.floor(player.x / map.tileSize);
    const ty = Math.floor(player.y / map.tileSize);
    const key = ty * map.width + tx;
    if (key === this.flowKey) return;
    this.flowKey = key;
    this.flowField = bfsDistances(map, { tx, ty }, RENDER.flowFieldRange);
  }

  private patrol(enemy: EnemyDrone, dt: number): void {
    if (enemy.canSee) {
      enemy.state = 'chase';
      enemy.lostSightSec = 0;
      return;
    }
    if (enemy.wanderWait > 0) {
      enemy.wanderWait -= dt;
      this.steer(enemy, 0, 0, dt);
      return;
    }
    if (!enemy.wanderTarget) enemy.wanderTarget = this.pickWanderTarget(enemy.home);
    const target = enemy.wanderTarget;
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) {
      enemy.wanderTarget = null;
      enemy.wanderWait = 0.8 + Math.random() * 1.8;
      return;
    }
    const speed = enemy.def.speed * 0.4;
    enemy.heading = Math.atan2(dy, dx);
    this.steer(enemy, (dx / dist) * speed, (dy / dist) * speed, dt);
  }

  private chase(enemy: EnemyDrone, dt: number): void {
    const { player, map } = this.world;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const { def } = enemy;

    if (!player.alive) {
      enemy.state = 'patrol';
      enemy.home = { x: enemy.x, y: enemy.y };
      return;
    }

    if (enemy.canSee) {
      enemy.lostSightSec = 0;
      enemy.heading = Math.atan2(dy, dx);
      let vx: number;
      let vy: number;
      if (dist > def.attackRange * 0.85) {
        vx = dx / dist;
        vy = dy / dist;
      } else if (dist < def.attackRange * 0.45) {
        vx = -dx / dist;
        vy = -dy / dist;
      } else {
        if (Math.random() < dt * 0.4) enemy.strafeSign = enemy.strafeSign === 1 ? -1 : 1;
        vx = (-dy / dist) * enemy.strafeSign * 0.6;
        vy = (dx / dist) * enemy.strafeSign * 0.6;
      }
      this.steer(enemy, vx * def.speed, vy * def.speed, dt);
      if (dist <= def.attackRange && enemy.attackCooldown <= 0 && enemy.burstLeft === 0) {
        enemy.burstLeft = def.burst;
        enemy.burstTimer = 0;
        enemy.attackCooldown = def.attackCooldownSec;
      }
      return;
    }

    enemy.lostSightSec += dt;
    if (!enemy.relentless && enemy.lostSightSec > LOSE_INTEREST_SEC) {
      enemy.state = 'patrol';
      enemy.home = { x: enemy.x, y: enemy.y };
      enemy.wanderTarget = null;
      return;
    }
    const dir = this.flowField
      ? flowDirection(
          map,
          this.flowField,
          Math.floor(enemy.x / map.tileSize),
          Math.floor(enemy.y / map.tileSize),
        )
      : null;
    const vx = dir ? dir.x : dx / dist;
    const vy = dir ? dir.y : dy / dist;
    enemy.heading = Math.atan2(vy, vx);
    this.steer(enemy, vx * def.speed, vy * def.speed, dt);
  }

  private updateBurst(enemy: EnemyDrone, dt: number): void {
    if (enemy.burstLeft <= 0) return;
    enemy.burstTimer -= dt;
    if (enemy.burstTimer > 0) return;
    const { player } = this.world;
    if (!player.alive) {
      enemy.burstLeft = 0;
      return;
    }
    this.combat.fireEnemyVolley(enemy, Math.atan2(player.y - enemy.y, player.x - enemy.x));
    enemy.burstLeft--;
    enemy.burstTimer = BURST_GAP_SEC;
  }

  private steer(enemy: EnemyDrone, targetVx: number, targetVy: number, dt: number): void {
    const blend = Math.min(1, dt * 6);
    enemy.vx += (targetVx - enemy.vx) * blend;
    enemy.vy += (targetVy - enemy.vy) * blend;
  }

  private pickWanderTarget(home: Vec2): Vec2 {
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * WANDER_RADIUS;
      const p = { x: home.x + Math.cos(angle) * r, y: home.y + Math.sin(angle) * r };
      if (!isSolidWorld(this.world.map, p.x, p.y) && hasLineOfSight(this.world.map, home, p))
        return p;
    }
    return { ...home };
  }
}
