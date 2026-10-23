import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { ITEMS } from '@skyline/game-core';
import { PALETTE } from '../config/gameConfig';
import type { Camera } from './Camera';
import type { EventBus } from '../engine/EventBus';
import type { MissionEvents } from '../world/MissionWorld';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  drag: number;
  active: boolean;
}

interface FloatingText {
  text: Text;
  life: number;
  maxLife: number;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: number;
}

const MAX_PARTICLES = 600;

/** Purely cosmetic feedback driven by mission events; never touches simulation state. */
export class Effects {
  private readonly particleLayer = new Container();
  private readonly rings = new Graphics();
  private readonly textLayer = new Container();
  private readonly particles: Particle[] = [];
  private readonly texts: FloatingText[] = [];
  private readonly activeRings: Ring[] = [];
  private readonly unsubscribers: (() => void)[] = [];

  constructor(
    layer: Container,
    private readonly camera: Camera,
    events?: EventBus<MissionEvents>,
  ) {
    layer.addChild(this.rings, this.particleLayer, this.textLayer);
    if (!events) return;

    this.unsubscribers.push(
      events.on('shot', ({ x, y, angle, owner }) => {
        const color = owner === 'player' ? PALETTE.cyan : PALETTE.danger;
        const mx = x + Math.cos(angle) * 18;
        const my = y + Math.sin(angle) * 18;
        this.burst(mx, my, 3, color, 60, 0.12, angle, 0.6);
      }),
      events.on('projectileImpact', ({ x, y, owner }) => {
        this.burst(x, y, 5, owner === 'player' ? PALETTE.cyan : PALETTE.danger, 90, 0.25);
      }),
      events.on('enemyHit', ({ enemy }) => this.burst(enemy.x, enemy.y, 4, 0xffd23f, 120, 0.2)),
      events.on('enemyKilled', ({ enemy }) => {
        const big = enemy.def.kind === 'guardian' || enemy.def.kind === 'hunter';
        this.burst(enemy.x, enemy.y, big ? 40 : 22, 0xff8a3d, big ? 260 : 190, 0.6);
        this.burst(enemy.x, enemy.y, big ? 16 : 8, 0xfff1a8, 120, 0.35);
        this.ring(enemy.x, enemy.y, big ? 70 : 45, 0.35, 0xff8a3d);
        this.camera.shake(big ? 7 : 4, 0.2);
      }),
      events.on('playerHit', ({ damage }) =>
        this.camera.shake(Math.min(10, 2 + damage * 0.4), 0.18),
      ),
      events.on('playerDestroyed', ({ x, y }) => {
        this.burst(x, y, 70, PALETTE.accent, 320, 1);
        this.burst(x, y, 40, 0xffffff, 200, 0.6);
        this.ring(x, y, 120, 0.6, PALETTE.accent);
        this.camera.shake(14, 0.6);
      }),
      events.on('dash', ({ x, y }) => this.burst(x, y, 10, PALETTE.accent, 80, 0.3)),
      events.on('scan', ({ x, y, radius, revealed }) => {
        this.ring(x, y, radius, 0.7, PALETTE.cyan);
        this.float(
          x,
          y - 30,
          revealed > 0 ? `${revealed} SIGNAL${revealed > 1 ? 'S' : ''}` : 'NO SIGNAL',
          PALETTE.cyan,
        );
      }),
      events.on('itemCollected', ({ itemId, x, y, value }) => {
        const tier = ITEMS[itemId].tier;
        const color = PALETTE.tierGlow[tier] ?? 0xffffff;
        this.burst(x, y, 10, color, 90, 0.4);
        const label =
          itemId === 'energy_cell'
            ? '+ENERGY'
            : `+${value.toLocaleString('en-US')} ${ITEMS[itemId].name}`;
        this.float(x, y - 16, label, color);
      }),
      events.on('cargoFull', ({ x, y }) => this.float(x, y - 30, 'CARGO FULL', PALETTE.danger)),
      events.on('extracted', ({ x, y }) => {
        this.burst(x, y, 50, PALETTE.extraction, 220, 0.9);
        this.ring(x, y, 140, 0.8, PALETTE.extraction);
      }),
    );
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.alpha = p.life / p.maxLife;
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i] as FloatingText;
      t.life -= dt;
      t.text.y -= 28 * dt;
      t.text.alpha = Math.min(1, (t.life / t.maxLife) * 2);
      if (t.life <= 0) {
        t.text.destroy();
        this.texts.splice(i, 1);
      }
    }

    this.rings.clear();
    for (let i = this.activeRings.length - 1; i >= 0; i--) {
      const r = this.activeRings[i] as Ring;
      r.life -= dt;
      if (r.life <= 0) {
        this.activeRings.splice(i, 1);
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      const eased = 1 - (1 - t) * (1 - t);
      this.rings
        .circle(r.x, r.y, r.radius * eased)
        .stroke({ width: 2, color: r.color, alpha: 1 - t });
    }
  }

  destroy(): void {
    for (const off of this.unsubscribers) off();
  }

  burst(
    x: number,
    y: number,
    count: number,
    color: number,
    speed: number,
    life: number,
    direction?: number,
    spread = Math.PI * 2,
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticle();
      if (!p) return;
      const angle =
        direction === undefined
          ? Math.random() * Math.PI * 2
          : direction + (Math.random() - 0.5) * spread;
      const v = speed * (0.3 + Math.random() * 0.7);
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.life = p.maxLife = life * (0.6 + Math.random() * 0.4);
      p.drag = 4;
      p.sprite.tint = color;
      p.sprite.position.set(x, y);
      const size = 2 + Math.floor(Math.random() * 3);
      p.sprite.width = size;
      p.sprite.height = size;
      p.sprite.alpha = 1;
      p.sprite.visible = true;
      p.active = true;
    }
  }

  private acquireParticle(): Particle | null {
    const free = this.particles.find((p) => !p.active);
    if (free) return free;
    if (this.particles.length >= MAX_PARTICLES) return null;
    const sprite = new Sprite(Texture.WHITE);
    sprite.anchor.set(0.5);
    this.particleLayer.addChild(sprite);
    const particle: Particle = {
      sprite,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      drag: 4,
      active: false,
    };
    this.particles.push(particle);
    return particle;
  }

  ring(x: number, y: number, radius: number, life: number, color: number): void {
    this.activeRings.push({ x, y, radius, life, maxLife: life, color });
  }

  float(x: number, y: number, label: string, color: number): void {
    const text = new Text({
      text: label,
      style: {
        fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
        fontSize: 12,
        fontWeight: '700',
        fill: color,
        stroke: { color: 0x05070a, width: 3 },
        letterSpacing: 1,
      },
      anchor: 0.5,
      resolution: 2,
    });
    text.position.set(x, y);
    this.textLayer.addChild(text);
    this.texts.push({ text, life: 1.1, maxLife: 1.1 });
  }
}
