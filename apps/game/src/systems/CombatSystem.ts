import { DRONE_TUNING } from '@skyline/game-core';
import { Projectile, type ProjectileOwner } from '../entities/Projectile';
import type { EnemyDrone } from '../entities/EnemyDrone';
import type { MissionWorld } from '../world/MissionWorld';
import { circlesOverlap, pointInSolid } from './CollisionSystem';

const ENEMY_PROJECTILE_LIFE_SEC = 1.6;

export class CombatSystem {
  private readonly pool: Projectile[] = [];

  constructor(private readonly world: MissionWorld) {}

  update(dt: number): void {
    this.updatePlayerVitals(dt);
    this.updatePlayerWeapon(dt);
    this.updateProjectiles(dt);
  }

  fireEnemyVolley(enemy: EnemyDrone, angle: number): void {
    const { def } = enemy;
    const spreadStep = 0.22;
    const offset = ((def.spread - 1) * spreadStep) / 2;
    const scale = def.kind === 'guardian' ? 1.6 : 1;
    for (let i = 0; i < def.spread; i++) {
      const a = angle - offset + i * spreadStep + (Math.random() - 0.5) * 0.08;
      this.spawn(
        'enemy',
        enemy.x + Math.cos(a) * enemy.radius,
        enemy.y + Math.sin(a) * enemy.radius,
        a,
        def.projectileSpeed,
        def.damage,
        ENEMY_PROJECTILE_LIFE_SEC,
        scale,
      );
    }
    this.world.events.emit('shot', { x: enemy.x, y: enemy.y, angle, owner: 'enemy' });
  }

  destroy(): void {
    for (const p of this.pool) p.sprite.destroy();
    this.pool.length = 0;
  }

  private updatePlayerVitals(dt: number): void {
    const { player } = this.world;
    if (!player.alive) return;
    player.hitFlash = Math.max(0, player.hitFlash - dt);
    player.sinceDamage += dt;
    player.energy = Math.min(
      player.stats.energy,
      player.energy + DRONE_TUNING.energyRegenPerSec * dt,
    );
    if (player.sinceDamage >= DRONE_TUNING.shieldRegenDelaySec) {
      player.shield = Math.min(
        player.stats.shield,
        player.shield + DRONE_TUNING.shieldRegenPerSec * dt,
      );
    }
  }

  private updatePlayerWeapon(dt: number): void {
    const { player, mouse, stats, events } = this.world;
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    if (!player.alive || player.dashing || !mouse.primaryDown) return;
    if (player.fireCooldown > 0 || player.energy < DRONE_TUNING.shotEnergyCost) return;

    player.fireCooldown = DRONE_TUNING.fireCooldownSec;
    player.energy -= DRONE_TUNING.shotEnergyCost;
    stats.shotsFired++;
    const angle = player.aimAngle + (Math.random() - 0.5) * 0.05;
    const muzzle = player.radius + 4;
    this.spawn(
      'player',
      player.x + Math.cos(angle) * muzzle,
      player.y + Math.sin(angle) * muzzle,
      angle,
      DRONE_TUNING.projectileSpeed,
      player.stats.weaponDamage,
      DRONE_TUNING.projectileLifeSec,
    );
    events.emit('shot', { x: player.x, y: player.y, angle, owner: 'player' });
  }

  private updateProjectiles(dt: number): void {
    const { map, player, enemies, events, stats } = this.world;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) {
        p.deactivate();
        continue;
      }
      if (pointInSolid(map, p.x, p.y)) {
        events.emit('projectileImpact', { x: p.x, y: p.y, owner: p.owner });
        p.deactivate();
        continue;
      }

      if (p.owner === 'player') {
        for (const enemy of enemies) {
          if (!enemy.alive || !circlesOverlap(p, enemy)) continue;
          enemy.hp -= p.damage;
          enemy.hitFlash = 0.08;
          // Getting shot always pulls an enemy into the fight.
          enemy.state = 'chase';
          events.emit('enemyHit', { enemy, damage: p.damage });
          if (!enemy.alive) {
            stats.kills++;
            events.emit('enemyKilled', { enemy });
          }
          p.deactivate();
          break;
        }
      } else if (player.alive && circlesOverlap(p, player, -4)) {
        const absorbed = player.takeDamage(p.damage);
        if (absorbed > 0) {
          stats.damageTaken += absorbed;
          events.emit('playerHit', { damage: absorbed });
          if (!player.alive) events.emit('playerDestroyed', { x: player.x, y: player.y });
          p.deactivate();
        }
      }
      if (p.active) p.syncView();
    }
  }

  private spawn(
    owner: ProjectileOwner,
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    life: number,
    scale = 1,
  ): void {
    const texture = this.world.assets.get(
      owner === 'player' ? 'projectile:player' : 'projectile:enemy',
    );
    let projectile = this.pool.find((p) => !p.active);
    if (!projectile) {
      projectile = new Projectile(texture);
      this.pool.push(projectile);
      this.world.layers.projectiles.addChild(projectile.sprite);
    }
    projectile.fire(owner, texture, x, y, angle, speed, damage, life, scale);
  }
}
