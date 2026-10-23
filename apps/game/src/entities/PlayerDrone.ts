import { Sprite, type Texture } from 'pixi.js';
import { DRONE_TUNING, type DroneStats, type ItemId, type Vec2 } from '@skyline/game-core';
import { RENDER } from '../config/gameConfig';

export class PlayerDrone {
  readonly sprite: Sprite;
  readonly radius = DRONE_TUNING.radius;
  readonly cargo = new Map<ItemId, number>();
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  aimAngle = 0;
  hp: number;
  shield: number;
  energy: number;
  cargoUsed = 0;
  fireCooldown = 0;
  dashTime = 0;
  dashCooldown = 0;
  scanCooldown = 0;
  sinceDamage = Infinity;
  hitFlash = 0;
  /** Set once the drone has been lifted out at extraction. */
  hidden = false;

  constructor(
    texture: Texture,
    readonly stats: DroneStats,
    spawn: Vec2,
  ) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.hp = stats.hp;
    this.shield = stats.shield;
    this.energy = stats.energy;
    this.sprite = new Sprite({ texture, anchor: 0.5, scale: RENDER.spriteScale });
    this.syncView(0);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get dashing(): boolean {
    return this.dashTime > 0;
  }

  get cargoFull(): boolean {
    return this.cargoUsed >= this.stats.cargoCapacity;
  }

  /** Returns damage actually absorbed (shield + hull). */
  takeDamage(amount: number): number {
    if (!this.alive || this.dashing) return 0;
    const toShield = Math.min(this.shield, amount);
    this.shield -= toShield;
    const toHull = Math.min(this.hp, amount - toShield);
    this.hp -= toHull;
    this.sinceDamage = 0;
    this.hitFlash = 0.15;
    return toShield + toHull;
  }

  syncView(time: number): void {
    this.sprite.position.set(this.x, this.y);
    this.sprite.rotation = this.aimAngle;
    this.sprite.visible = this.alive && !this.hidden;
    this.sprite.alpha = this.dashing ? 0.55 : 1;
    this.sprite.tint = this.hitFlash > 0 ? 0xff6b7d : 0xffffff;
    // Subtle hover bob sells the "drone" read without animation frames.
    const bob = 1 + Math.sin(time * 6) * 0.03;
    this.sprite.scale.set(RENDER.spriteScale * bob);
  }
}
