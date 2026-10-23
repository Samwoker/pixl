import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { ITEMS, type ItemId } from '@skyline/game-core';
import { PALETTE, RENDER } from '../config/gameConfig';

export class Loot {
  readonly view = new Container();
  private readonly glow = new Graphics();
  private readonly sprite: Sprite;
  private readonly glowColor: number;
  collected = false;
  revealed: boolean;
  revealFlash = 0;

  constructor(
    readonly id: string,
    readonly itemId: ItemId,
    texture: Texture,
    public x: number,
    public y: number,
    revealed: boolean,
  ) {
    this.revealed = revealed;
    this.glowColor = PALETTE.tierGlow[ITEMS[itemId].tier] ?? PALETTE.cyan;
    this.sprite = new Sprite({ texture, anchor: 0.5, scale: RENDER.spriteScale });
    this.view.addChild(this.glow, this.sprite);
    this.view.position.set(x, y);
  }

  get usesCargo(): boolean {
    return ITEMS[this.itemId].usesCargo;
  }

  reveal(): void {
    if (this.revealed) return;
    this.revealed = true;
    this.revealFlash = 0.6;
  }

  syncView(time: number): void {
    this.view.visible = this.revealed && !this.collected;
    if (!this.view.visible) return;
    this.view.position.set(this.x, this.y);
    const phase = time * 3 + this.x * 0.01;
    this.sprite.y = Math.sin(phase) * 2;
    const pulse = 0.5 + Math.sin(phase) * 0.5;
    const flash = this.revealFlash > 0 ? this.revealFlash * 1.5 : 0;
    this.glow.clear();
    this.glow
      .circle(0, 0, 14 + pulse * 3 + flash * 12)
      .fill({ color: this.glowColor, alpha: 0.12 + flash * 0.3 });
    this.glow.circle(0, 0, 9).stroke({ width: 1, color: this.glowColor, alpha: 0.5 });
  }
}
