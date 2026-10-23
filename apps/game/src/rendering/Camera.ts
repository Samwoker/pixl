import type { Container } from 'pixi.js';
import type { Vec2 } from '@skyline/game-core';
import { RENDER } from '../config/gameConfig';

export class Camera {
  x = 0;
  y = 0;
  viewWidth = 0;
  viewHeight = 0;
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeMagnitude = 0;

  constructor(
    private readonly worldWidth: number,
    private readonly worldHeight: number,
  ) {}

  resize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  snapTo(target: Vec2): void {
    this.x = target.x;
    this.y = target.y;
    this.clamp();
  }

  follow(target: Vec2, aimWorld: Vec2, dt: number): void {
    const tx = target.x + (aimWorld.x - target.x) * RENDER.cameraLookAhead;
    const ty = target.y + (aimWorld.y - target.y) * RENDER.cameraLookAhead;
    const t = 1 - Math.exp(-dt * RENDER.cameraLerp);
    this.x += (tx - this.x) * t;
    this.y += (ty - this.y) * t;
    this.clamp();
    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - dt);
  }

  shake(magnitude: number, duration: number): void {
    if (magnitude < this.shakeMagnitude * (this.shakeTime / Math.max(this.shakeDuration, 1e-6)))
      return;
    this.shakeMagnitude = magnitude;
    this.shakeDuration = duration;
    this.shakeTime = duration;
  }

  apply(world: Container): void {
    let sx = 0;
    let sy = 0;
    if (this.shakeTime > 0) {
      const strength = this.shakeMagnitude * (this.shakeTime / this.shakeDuration);
      sx = (Math.random() * 2 - 1) * strength;
      sy = (Math.random() * 2 - 1) * strength;
    }
    world.position.set(
      Math.round(this.viewWidth / 2 - this.x + sx),
      Math.round(this.viewHeight / 2 - this.y + sy),
    );
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    return { x: sx - this.viewWidth / 2 + this.x, y: sy - this.viewHeight / 2 + this.y };
  }

  isVisible(p: Vec2, margin = 0): boolean {
    return (
      Math.abs(p.x - this.x) <= this.viewWidth / 2 + margin &&
      Math.abs(p.y - this.y) <= this.viewHeight / 2 + margin
    );
  }

  private clamp(): void {
    const halfW = this.viewWidth / 2;
    const halfH = this.viewHeight / 2;
    this.x =
      this.worldWidth <= this.viewWidth
        ? this.worldWidth / 2
        : clamp(this.x, halfW, this.worldWidth - halfW);
    this.y =
      this.worldHeight <= this.viewHeight
        ? this.worldHeight / 2
        : clamp(this.y, halfH, this.worldHeight - halfH);
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
