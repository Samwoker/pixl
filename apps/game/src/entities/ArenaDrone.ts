import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { ARENA_TUNING, type RosterEntry } from '@skyline/game-core';
import { RENDER } from '../config/gameConfig';

export const TEAM_COLORS = [0x5fe3ff, 0xff4d6d] as const;

export interface DroneVisualState {
  x: number;
  y: number;
  aim: number;
  hp: number;
  shield: number;
  alive: boolean;
  protectedFor: number;
}

/** A networked drone: sprite plus name tag, team ring and health bar. */
export class ArenaDrone {
  readonly view = new Container();
  private readonly body = new Container();
  private readonly ring = new Graphics();
  private readonly sprite: Sprite;
  private readonly bar = new Graphics();
  private readonly label: Text;
  hitFlash = 0;

  constructor(
    readonly entry: RosterEntry,
    texture: Texture,
    private readonly isSelf: boolean,
  ) {
    this.sprite = new Sprite({ texture, anchor: 0.5, scale: RENDER.spriteScale });
    const ringColor =
      entry.team === null ? (isSelf ? 0xffffff : 0xff4d6d) : TEAM_COLORS[entry.team];
    this.ring
      .circle(0, 0, ARENA_TUNING.radius + 6)
      .stroke({ width: 2, color: ringColor, alpha: isSelf ? 0.9 : 0.55 });
    this.label = new Text({
      text: entry.bot ? `${entry.name} ·bot` : entry.name,
      style: {
        fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
        fontSize: 11,
        fontWeight: '700',
        fill: ringColor,
        stroke: { color: 0x05070a, width: 3 },
        letterSpacing: 1,
      },
      anchor: { x: 0.5, y: 1 },
      resolution: 2,
    });
    this.label.y = -ARENA_TUNING.radius - 14;
    this.label.visible = !isSelf;
    this.body.addChild(this.ring, this.sprite);
    this.view.addChild(this.body, this.bar, this.label);
  }

  sync(state: DroneVisualState, time: number, dt: number): void {
    this.view.visible = state.alive;
    if (!state.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.view.position.set(state.x, state.y);
    this.sprite.rotation = state.aim;
    this.sprite.tint = this.hitFlash > 0 ? 0xff8a9a : 0xffffff;
    this.sprite.scale.set(RENDER.spriteScale * (1 + Math.sin(time * 6 + state.x * 0.01) * 0.03));
    this.body.alpha = state.protectedFor > 0 ? 0.45 + Math.sin(time * 20) * 0.25 : 1;

    this.bar.clear();
    const t = ARENA_TUNING;
    if (!this.isSelf && (state.hp < t.maxHp || state.shield < t.maxShield)) {
      const w = 34;
      const top = -t.radius - 10;
      this.bar.rect(-w / 2, top, w, 4).fill(0x05070a);
      this.bar.rect(-w / 2, top, (w * state.hp) / t.maxHp, 2).fill(0xe3e8ef);
      this.bar.rect(-w / 2, top + 2, (w * state.shield) / t.maxShield, 2).fill(0x3d7bff);
    }
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
