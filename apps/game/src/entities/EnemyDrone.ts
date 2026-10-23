import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { EnemyDefinition, Vec2 } from '@skyline/game-core';
import { RENDER } from '../config/gameConfig';

export type EnemyState = 'patrol' | 'chase';

export class EnemyDrone {
  readonly view = new Container();
  readonly sprite: Sprite;
  private readonly hpBar = new Graphics();
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  heading = 0;
  hp: number;
  state: EnemyState = 'patrol';
  home: Vec2;
  wanderTarget: Vec2 | null = null;
  wanderWait = 0;
  attackCooldown: number;
  burstLeft = 0;
  burstTimer = 0;
  canSee = false;
  sightTimer = 0;
  lostSightSec = 0;
  strafeSign: 1 | -1;
  hitFlash = 0;

  constructor(
    readonly id: string,
    readonly def: EnemyDefinition,
    texture: Texture,
    spawn: Vec2,
    /** Reinforcements never give up the hunt. */
    readonly relentless = false,
  ) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.home = { ...spawn };
    this.hp = def.hp;
    this.attackCooldown = def.attackCooldownSec * Math.random();
    this.sightTimer = Math.random() * 0.2;
    this.strafeSign = Math.random() < 0.5 ? 1 : -1;
    if (relentless) this.state = 'chase';
    this.sprite = new Sprite({ texture, anchor: 0.5, scale: RENDER.spriteScale });
    this.view.addChild(this.sprite, this.hpBar);
    this.syncView(0);
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get radius(): number {
    return this.def.radius;
  }

  syncView(time: number): void {
    this.view.position.set(this.x, this.y);
    this.sprite.rotation = this.heading;
    this.sprite.tint = this.hitFlash > 0 ? 0xffb3b3 : 0xffffff;
    this.sprite.scale.set(RENDER.spriteScale * (1 + Math.sin(time * 5 + this.home.x) * 0.03));

    this.hpBar.clear();
    if (this.hp < this.def.hp) {
      const width = this.def.radius * 2;
      const top = -this.def.radius - 10;
      this.hpBar.rect(-width / 2, top, width, 3).fill(0x1a0b0e);
      this.hpBar.rect(-width / 2, top, width * (this.hp / this.def.hp), 3).fill(0xff4d6d);
    }
  }
}
