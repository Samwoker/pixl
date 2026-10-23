import { DRONE_TUNING } from '@skyline/game-core';
import type { MissionWorld } from '../world/MissionWorld';
import { moveBody, separateBodies } from './CollisionSystem';

export class MovementSystem {
  constructor(private readonly world: MissionWorld) {}

  update(dt: number): void {
    this.updatePlayer(dt);
    this.updateEnemies(dt);
  }

  private updatePlayer(dt: number): void {
    const { player, keyboard, map, aimWorld, events } = this.world;
    if (!player.alive) return;

    player.aimAngle = Math.atan2(aimWorld.y - player.y, aimWorld.x - player.x);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);

    let ix = 0;
    let iy = 0;
    if (keyboard.isDown('KeyW') || keyboard.isDown('ArrowUp')) iy -= 1;
    if (keyboard.isDown('KeyS') || keyboard.isDown('ArrowDown')) iy += 1;
    if (keyboard.isDown('KeyA') || keyboard.isDown('ArrowLeft')) ix -= 1;
    if (keyboard.isDown('KeyD') || keyboard.isDown('ArrowRight')) ix += 1;
    const len = Math.hypot(ix, iy);
    if (len > 0) {
      ix /= len;
      iy /= len;
    }

    const wantsDash = keyboard.wasPressed('ShiftLeft') || keyboard.wasPressed('ShiftRight');
    if (wantsDash && player.dashCooldown <= 0 && player.energy >= DRONE_TUNING.dashEnergyCost) {
      const angle = len > 0 ? Math.atan2(iy, ix) : player.aimAngle;
      player.vx = Math.cos(angle) * DRONE_TUNING.dashSpeed;
      player.vy = Math.sin(angle) * DRONE_TUNING.dashSpeed;
      player.dashTime = DRONE_TUNING.dashDurationSec;
      player.dashCooldown = DRONE_TUNING.dashCooldownSec;
      player.energy -= DRONE_TUNING.dashEnergyCost;
      events.emit('dash', { x: player.x, y: player.y });
    }

    if (player.dashing) {
      player.dashTime = Math.max(0, player.dashTime - dt);
    } else {
      const targetVx = ix * player.stats.speed;
      const targetVy = iy * player.stats.speed;
      const blend = Math.min(1, dt * DRONE_TUNING.friction);
      player.vx += (targetVx - player.vx) * blend;
      player.vy += (targetVy - player.vy) * blend;
    }

    moveBody(map, player, player.vx * dt, player.vy * dt);
  }

  private updateEnemies(dt: number): void {
    const { enemies, map } = this.world;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      moveBody(map, enemy, enemy.vx * dt, enemy.vy * dt);
    }
    separateBodies(
      map,
      enemies.filter((e) => e.alive),
    );
  }
}
