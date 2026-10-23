import { Container, Graphics } from 'pixi.js';
import { MISSION_TUNING, type Vec2 } from '@skyline/game-core';
import { PALETTE } from '../config/gameConfig';

export class ExtractionZone {
  readonly view = new Container();
  /** Lives in the world layer but tracks the player, so it's added separately. */
  readonly indicator = new Graphics();
  private readonly pad = new Graphics();
  private readonly beacon = new Graphics();
  readonly radius = MISSION_TUNING.extractionRadius;
  progress = 0;

  constructor(readonly position: Vec2) {
    this.view.position.set(position.x, position.y);
    this.view.addChild(this.pad, this.beacon);
  }

  contains(p: Vec2): boolean {
    return Math.hypot(p.x - this.position.x, p.y - this.position.y) <= this.radius;
  }

  syncView(time: number, player: Vec2, playerVisible: boolean, onScreen: boolean): void {
    const pulse = 0.5 + Math.sin(time * 3) * 0.5;
    const color = PALETTE.extraction;
    this.pad.clear();
    this.pad.circle(0, 0, this.radius).fill({ color, alpha: 0.06 + pulse * 0.04 });
    this.pad.circle(0, 0, this.radius).stroke({ width: 2, color, alpha: 0.7 });
    // Rotating dashed ring.
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2 + time * 0.6;
      this.pad.arc(0, 0, this.radius - 8, a0, a0 + 0.25).stroke({ width: 3, color, alpha: 0.5 });
    }
    this.pad.rect(-10, -2, 20, 4).fill({ color, alpha: 0.8 });
    this.pad.rect(-2, -10, 4, 20).fill({ color, alpha: 0.8 });

    this.beacon.clear();
    if (this.progress > 0) {
      this.beacon
        .arc(0, 0, this.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.progress)
        .stroke({ width: 5, color: 0xffffff, alpha: 0.9 });
    }
    this.beacon.circle(0, 0, 6 + pulse * 30).stroke({ width: 2, color, alpha: 0.6 * (1 - pulse) });

    this.indicator.clear();
    if (!playerVisible || onScreen) return;
    const angle = Math.atan2(this.position.y - player.y, this.position.x - player.x);
    const r = 46;
    const cx = player.x + Math.cos(angle) * r;
    const cy = player.y + Math.sin(angle) * r;
    const tip = 9;
    this.indicator
      .poly([
        cx + Math.cos(angle) * tip,
        cy + Math.sin(angle) * tip,
        cx + Math.cos(angle + 2.4) * tip,
        cy + Math.sin(angle + 2.4) * tip,
        cx + Math.cos(angle - 2.4) * tip,
        cy + Math.sin(angle - 2.4) * tip,
      ])
      .fill({ color, alpha: 0.65 + pulse * 0.35 });
  }
}
