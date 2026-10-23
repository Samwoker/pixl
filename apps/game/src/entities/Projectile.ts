import { Sprite, type Texture } from 'pixi.js';
import { RENDER } from '../config/gameConfig';

export type ProjectileOwner = 'player' | 'enemy';

/** Pooled: `active` toggles instead of allocating per shot. */
export class Projectile {
  readonly sprite: Sprite;
  active = false;
  owner: ProjectileOwner = 'player';
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  damage = 0;
  radius = 4;

  constructor(texture: Texture) {
    this.sprite = new Sprite({ texture, anchor: 0.5, scale: RENDER.spriteScale * 0.8 });
    this.sprite.visible = false;
  }

  fire(
    owner: ProjectileOwner,
    texture: Texture,
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    life: number,
    scale = 1,
  ): void {
    this.active = true;
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.life = life;
    this.radius = 4 * scale;
    this.sprite.texture = texture;
    this.sprite.rotation = angle;
    this.sprite.scale.set(RENDER.spriteScale * 0.8 * scale);
    this.sprite.visible = true;
    this.syncView();
  }

  deactivate(): void {
    this.active = false;
    this.sprite.visible = false;
  }

  syncView(): void {
    this.sprite.position.set(this.x, this.y);
  }
}
