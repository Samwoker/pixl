import { Container, Graphics, Sprite } from 'pixi.js';
import {
  ARENA_TUNING,
  buildArena,
  stepMotion,
  WEAPONS,
  type ArenaInput,
  type ArenaMap,
  type ArenaSnapshot,
  type MotionState,
  type PlayerSnapshot,
} from '@skyline/game-core';
import type { AudioManager } from '../audio/AudioManager';
import type { AssetManager } from '../engine/AssetManager';
import type { Scene } from '../engine/SceneManager';
import { ArenaDrone } from '../entities/ArenaDrone';
import type { Keyboard } from '../input/Keyboard';
import type { Mouse } from '../input/Mouse';
import type { ArenaConnection } from '../net/ArenaConnection';
import { Camera } from '../rendering/Camera';
import { Effects } from '../rendering/Effects';
import type { ArenaHud, KillFeedEntry } from '../types';
import { renderArena } from '../world/ArenaRenderer';

export interface ArenaSceneDeps {
  connection: ArenaConnection;
  assets: AssetManager;
  keyboard: Keyboard;
  mouse: Mouse;
  audio: AudioManager;
  isMenuOpen: () => boolean;
}

export type ArenaSceneHud = Omit<ArenaHud, 'menuOpen' | 'muted'>;

interface BufferedSnapshot {
  snap: ArenaSnapshot & { ack: number };
  at: number;
}

const INPUT_DT = 1 / ARENA_TUNING.tickRate;
/** Remote drones render this far in the past so there are always two snapshots to blend. */
const INTERP_DELAY_SEC = 0.1;
const KILLFEED_SIZE = 5;
const KILLFEED_TTL_MS = 6000;
const HIT_MARKER_MS = 160;

const hex = (color: string) => Number.parseInt(color.slice(1), 16);

export class ArenaScene implements Scene {
  readonly container = new Container();
  private readonly world = new Container();
  private readonly layers = {
    ground: new Container(),
    pickups: new Container(),
    projectiles: new Container(),
    drones: new Container(),
    effects: new Container(),
  };
  private readonly map: ArenaMap;
  private readonly camera: Camera;
  private readonly effects: Effects;
  private readonly drones = new Map<string, ArenaDrone>();
  private readonly projectiles = new Map<number, Sprite>();
  private readonly pickupViews = new Map<string, Graphics>();
  private readonly unsubscribe: (() => void)[] = [];
  private buffer: BufferedSnapshot[] = [];
  private clockOffset: number | null = null;
  private predicted: MotionState | null = null;
  private prevPredicted: MotionState | null = null;
  private predictedAt = 0;
  private pending: ArenaInput[] = [];
  private seq = 0;
  private inputAccumulator = 0;
  private queued = { dash: false, swap: false, reload: false };
  private aim = 0;
  private killFeed: (KillFeedEntry & { at: number })[] = [];
  private feedId = 0;
  private hitMarkerUntil = 0;
  private renderTime = 0;
  private seenProjectiles = new Set<number>();
  private lastSelf: PlayerSnapshot | null = null;

  constructor(private readonly deps: ArenaSceneDeps) {
    const room = deps.connection.room;
    if (!room) throw new Error('ArenaScene requires a joined room');
    this.map = buildArena(room.arena);

    this.world.addChild(...Object.values(this.layers));
    this.container.addChild(this.world);
    this.layers.ground.addChild(renderArena(this.map));
    for (const pickup of this.map.pickups) {
      const g = new Graphics();
      const color = pickup.kind === 'health' ? 0x7dff9b : 0x3d7bff;
      g.circle(0, 0, 14).fill({ color, alpha: 0.18 }).stroke({ width: 2, color, alpha: 0.8 });
      if (pickup.kind === 'health')
        g.rect(-7, -2, 14, 4).fill(color).rect(-2, -7, 4, 14).fill(color);
      else g.poly([0, -8, 7, -4, 7, 4, 0, 8, -7, 4, -7, -4]).fill(color);
      g.position.set(pickup.x, pickup.y);
      this.layers.pickups.addChild(g);
      this.pickupViews.set(pickup.id, g);
    }

    this.camera = new Camera(
      this.map.width * this.map.tileSize,
      this.map.height * this.map.tileSize,
    );
    this.effects = new Effects(this.layers.effects, this.camera);
    this.camera.snapTo({
      x: (this.map.width * this.map.tileSize) / 2,
      y: (this.map.height * this.map.tileSize) / 2,
    });

    this.unsubscribe.push(
      deps.connection.on('snap', (m) => this.onSnapshot(m)),
      deps.connection.on('roster', () => this.syncRoster()),
    );
    this.syncRoster();
  }

  private get selfId(): string | null {
    return this.deps.connection.playerId;
  }

  update(dt: number): void {
    const kb = this.deps.keyboard;
    this.queued.dash ||= kb.wasPressed('ShiftLeft') || kb.wasPressed('ShiftRight');
    this.queued.reload ||= kb.wasPressed('KeyR');
    const slot = this.lastSelf?.slot ?? 0;
    this.queued.swap ||=
      kb.wasPressed('KeyQ') ||
      (kb.wasPressed('Digit1') && slot === 1) ||
      (kb.wasPressed('Digit2') && slot === 0);

    this.inputAccumulator += dt;
    while (this.inputAccumulator >= INPUT_DT) {
      this.inputAccumulator -= INPUT_DT;
      this.sendInput();
    }
    kb.endStep();
  }

  render(frameDt: number): void {
    this.renderTime += frameDt;
    const now = performance.now();
    const t = this.renderTime;
    const latest = this.buffer[this.buffer.length - 1];

    const alpha = Math.min(1, (now - this.predictedAt) / (INPUT_DT * 1000));
    const selfPos =
      this.predicted && this.prevPredicted
        ? {
            x: this.prevPredicted.x + (this.predicted.x - this.prevPredicted.x) * alpha,
            y: this.prevPredicted.y + (this.predicted.y - this.prevPredicted.y) * alpha,
          }
        : null;
    const mouseWorld = this.camera.screenToWorld(this.deps.mouse.screenX, this.deps.mouse.screenY);
    if (selfPos) this.aim = Math.atan2(mouseWorld.y - selfPos.y, mouseWorld.x - selfPos.x);

    if (latest) {
      const [a, b, blend] = this.interpolationPair(now);
      for (const player of latest.snap.players) {
        const drone = this.drones.get(player.id);
        if (!drone) continue;
        if (player.id === this.selfId && selfPos && player.alive) {
          drone.sync({ ...player, x: selfPos.x, y: selfPos.y, aim: this.aim }, t, frameDt);
          continue;
        }
        const pa = a.players.find((p) => p.id === player.id) ?? player;
        const pb = b.players.find((p) => p.id === player.id) ?? player;
        drone.sync(
          {
            ...pb,
            x: pa.x + (pb.x - pa.x) * blend,
            y: pa.y + (pb.y - pa.y) * blend,
            aim: lerpAngle(pa.aim, pb.aim, blend),
            alive: pb.alive && player.alive,
          },
          t,
          frameDt,
        );
      }
      this.renderProjectiles(latest, now);
      const active = new Set(latest.snap.pickups);
      for (const [id, g] of this.pickupViews) {
        g.visible = active.has(id);
        g.scale.set(1 + Math.sin(t * 4 + g.x) * 0.08);
      }
    }

    const focus = selfPos ?? (this.lastSelf ? { x: this.lastSelf.x, y: this.lastSelf.y } : null);
    if (focus) this.camera.follow(focus, selfPos ? mouseWorld : focus, frameDt);
    this.effects.update(frameDt);
    this.camera.apply(this.world);
  }

  hud(): ArenaSceneHud | null {
    const latest = this.buffer[this.buffer.length - 1]?.snap;
    const room = this.deps.connection.room;
    const me = this.lastSelf;
    if (!latest || !room || !me) return null;
    const now = performance.now();
    this.killFeed = this.killFeed.filter((k) => now - k.at < KILLFEED_TTL_MS);
    const roster = new Map(this.deps.connection.roster.map((r) => [r.id, r]));
    const myEntry = roster.get(me.id);
    const weapons = myEntry?.weapons ?? ['pulse_pistol', 'pulse_pistol'];
    const t = ARENA_TUNING;
    return {
      mode: room.mode,
      arenaName: this.map.name,
      roomCode: room.code,
      isPrivate: room.private,
      timeLeft: latest.timeLeft,
      scoreLimit: room.scoreLimit,
      teamScores: latest.teamScores,
      myTeam: myEntry?.team ?? null,
      hp: me.hp,
      maxHp: t.maxHp,
      shield: me.shield,
      maxShield: t.maxShield,
      energy: Math.floor(this.predicted?.energy ?? me.energy),
      maxEnergy: t.maxEnergy,
      alive: me.alive,
      respawnIn: me.respawnIn,
      protected: me.protectedFor > 0,
      weapon: {
        id: weapons[me.slot],
        ammo: me.ammo,
        magazine: me.magazine,
        reloading: me.reloading,
      },
      otherWeapon: weapons[me.slot === 0 ? 1 : 0],
      dashReady: 1 - (this.predicted?.dashCooldown ?? me.dashCooldown) / t.dashCooldownSec,
      kills: me.kills,
      deaths: me.deaths,
      score: me.score,
      scoreboard: latest.players
        .map((p) => {
          const entry = roster.get(p.id);
          return {
            id: p.id,
            name: entry?.name ?? '???',
            bot: entry?.bot ?? true,
            team: entry?.team ?? null,
            kills: p.kills,
            deaths: p.deaths,
            score: p.score,
            alive: p.alive,
            you: p.id === me.id,
          };
        })
        .sort((x, y) => y.score - x.score || x.deaths - y.deaths),
      killFeed: this.killFeed.map(({ at: _at, ...entry }) => entry),
      hitMarker: now < this.hitMarkerUntil,
      ping: this.deps.connection.rttMs,
    };
  }

  resize(width: number, height: number): void {
    this.camera.resize(width, height);
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    this.effects.destroy();
    this.container.destroy({ children: true });
  }

  private sendInput(): void {
    const { keyboard: kb, mouse, connection } = this.deps;
    const menu = this.deps.isMenuOpen();
    let mx = 0;
    let my = 0;
    if (!menu) {
      if (kb.isDown('KeyW') || kb.isDown('ArrowUp')) my -= 1;
      if (kb.isDown('KeyS') || kb.isDown('ArrowDown')) my += 1;
      if (kb.isDown('KeyA') || kb.isDown('ArrowLeft')) mx -= 1;
      if (kb.isDown('KeyD') || kb.isDown('ArrowRight')) mx += 1;
    }
    const input: ArenaInput = {
      seq: ++this.seq,
      mx,
      my,
      aim: Math.round(this.aim * 1000) / 1000,
      fire: !menu && mouse.primaryDown,
      dash: !menu && this.queued.dash,
      swap: !menu && this.queued.swap,
      reload: !menu && this.queued.reload,
    };
    this.queued = { dash: false, swap: false, reload: false };
    connection.sendInput(input);

    if (this.predicted) {
      this.prevPredicted = { ...this.predicted };
      stepMotion(this.map, this.predicted, input, INPUT_DT);
      this.predictedAt = performance.now();
      this.pending.push(input);
      if (this.pending.length > 90) this.pending.shift();
    }
  }

  private onSnapshot(snap: ArenaSnapshot & { ack: number }): void {
    const now = performance.now();
    const offset = snap.time - now / 1000;
    this.clockOffset =
      this.clockOffset === null ? offset : this.clockOffset + (offset - this.clockOffset) * 0.05;
    this.buffer.push({ snap, at: now });
    if (this.buffer.length > 20) this.buffer.shift();

    const me = snap.players.find((p) => p.id === this.selfId);
    if (me) this.reconcile(me, snap.ack);
    this.processEvents(snap);
  }

  private reconcile(me: PlayerSnapshot, ack: number): void {
    const wasAlive = this.lastSelf?.alive ?? false;
    this.lastSelf = me;
    if (!me.alive) {
      this.predicted = null;
      this.prevPredicted = null;
      this.pending = [];
      return;
    }
    const state: MotionState = {
      x: me.x,
      y: me.y,
      vx: me.vx,
      vy: me.vy,
      energy: me.energy,
      dashTime: me.dashTime,
      dashCooldown: me.dashCooldown,
    };
    this.pending = this.pending.filter((input) => input.seq > ack);
    for (const input of this.pending) stepMotion(this.map, state, input, INPUT_DT);

    if (!this.predicted || !this.prevPredicted || !wasAlive) {
      this.predicted = state;
      this.prevPredicted = { ...state };
      this.camera.snapTo(state);
      return;
    }
    // Shift the render-interpolation origin by the correction so small mispredictions don't pop.
    this.prevPredicted.x += state.x - this.predicted.x;
    this.prevPredicted.y += state.y - this.predicted.y;
    this.predicted = state;
  }

  private processEvents(snap: ArenaSnapshot): void {
    const { audio } = this.deps;
    const me = this.selfId;
    const now = performance.now();
    const playerAt = (id: string) => snap.players.find((p) => p.id === id);
    const roster = new Map(this.deps.connection.roster.map((r) => [r.id, r]));

    for (const event of snap.events) {
      switch (event.type) {
        case 'kill': {
          const victim = playerAt(event.victim);
          if (victim) {
            this.effects.burst(victim.x, victim.y, 40, 0xff8a3d, 260, 0.7);
            this.effects.burst(victim.x, victim.y, 16, 0xffffff, 160, 0.4);
            this.effects.ring(victim.x, victim.y, 70, 0.4, 0xff8a3d);
            if (this.camera.isVisible(victim, 40)) audio.play('explode');
          }
          if (event.victim === me) this.camera.shake(12, 0.5);
          if (event.killer === me)
            this.effects.float(victim?.x ?? 0, (victim?.y ?? 0) - 24, '+100', 0xffd23f);
          this.killFeed.unshift({
            id: ++this.feedId,
            killer: event.killer ? (roster.get(event.killer)?.name ?? '???') : null,
            killerTeam: event.killer ? (roster.get(event.killer)?.team ?? null) : null,
            victim: roster.get(event.victim)?.name ?? '???',
            victimTeam: roster.get(event.victim)?.team ?? null,
            weapon: event.weapon,
            involvesYou: event.killer === me || event.victim === me,
            at: now,
          });
          this.killFeed.length = Math.min(this.killFeed.length, KILLFEED_SIZE);
          break;
        }
        case 'hit': {
          this.effects.burst(event.x, event.y, 5, 0xfff1a8, 110, 0.25);
          if (event.target) {
            const drone = this.drones.get(event.target);
            if (drone) drone.hitFlash = 0.1;
          }
          if (event.by === me && event.target) {
            this.hitMarkerUntil = now + HIT_MARKER_MS;
            audio.play('hit');
          }
          if (event.target === me) {
            this.camera.shake(4, 0.15);
            audio.play('hurt');
          }
          break;
        }
        case 'explosion': {
          this.effects.burst(event.x, event.y, 36, 0xff4d6d, 300, 0.6);
          this.effects.burst(event.x, event.y, 20, 0xffd23f, 180, 0.4);
          this.effects.ring(event.x, event.y, event.radius, 0.35, 0xff8a3d);
          if (this.camera.isVisible(event, 60)) {
            this.camera.shake(8, 0.3);
            audio.play('explode');
          }
          break;
        }
        case 'pickup': {
          const spawn = this.map.pickups.find((p) => p.id === event.id);
          if (spawn)
            this.effects.burst(
              spawn.x,
              spawn.y,
              14,
              event.kind === 'health' ? 0x7dff9b : 0x3d7bff,
              120,
              0.5,
            );
          if (event.player === me) {
            audio.play('pickup');
            if (spawn)
              this.effects.float(
                spawn.x,
                spawn.y - 20,
                event.kind === 'health' ? '+HULL' : '+SHIELD',
                0x7dff9b,
              );
          }
          break;
        }
        case 'respawn':
          this.effects.ring(event.x, event.y, 50, 0.5, 0x5fe3ff);
          if (event.player === me) audio.play('dash');
          break;
      }
    }

    const current = new Set<number>();
    for (const p of snap.projectiles) {
      current.add(p.id);
      if (this.seenProjectiles.has(p.id)) continue;
      const color = hex(WEAPONS[p.weapon].color);
      const angle = Math.atan2(p.vy, p.vx);
      this.effects.burst(p.x, p.y, 3, color, 60, 0.12, angle, 0.6);
      if (p.owner === me) audio.play('shoot');
      else if (this.camera.isVisible(p, 0)) audio.play('enemyShoot');
    }
    this.seenProjectiles = current;
  }

  private renderProjectiles(latest: BufferedSnapshot, now: number): void {
    const age = Math.min(0.1, (now - latest.at) / 1000);
    const live = new Set<number>();
    for (const p of latest.snap.projectiles) {
      live.add(p.id);
      let sprite = this.projectiles.get(p.id);
      if (!sprite) {
        const def = WEAPONS[p.weapon];
        sprite = new Sprite({ texture: this.deps.assets.get('projectile:player'), anchor: 0.5 });
        sprite.tint = def.color;
        sprite.scale.set(2.4 * def.projectileScale);
        sprite.rotation = Math.atan2(p.vy, p.vx);
        this.layers.projectiles.addChild(sprite);
        this.projectiles.set(p.id, sprite);
      }
      sprite.position.set(p.x + p.vx * age, p.y + p.vy * age);
    }
    for (const [id, sprite] of this.projectiles) {
      if (live.has(id)) continue;
      sprite.destroy();
      this.projectiles.delete(id);
    }
  }

  private interpolationPair(now: number): [ArenaSnapshot, ArenaSnapshot, number] {
    const latest = this.buffer[this.buffer.length - 1] as BufferedSnapshot;
    if (this.clockOffset === null || this.buffer.length < 2) return [latest.snap, latest.snap, 1];
    const target = now / 1000 + this.clockOffset - INTERP_DELAY_SEC;
    for (let i = this.buffer.length - 1; i > 0; i--) {
      const b = this.buffer[i] as BufferedSnapshot;
      const a = this.buffer[i - 1] as BufferedSnapshot;
      if (a.snap.time <= target && target <= b.snap.time) {
        const span = b.snap.time - a.snap.time || 1;
        return [a.snap, b.snap, (target - a.snap.time) / span];
      }
    }
    const oldest = this.buffer[0] as BufferedSnapshot;
    return target < oldest.snap.time
      ? [oldest.snap, oldest.snap, 1]
      : [latest.snap, latest.snap, 1];
  }

  private syncRoster(): void {
    const roster = this.deps.connection.roster;
    const ids = new Set(roster.map((r) => r.id));
    for (const [id, drone] of this.drones) {
      if (ids.has(id)) continue;
      drone.destroy();
      this.drones.delete(id);
    }
    for (const entry of roster) {
      const existing = this.drones.get(entry.id);
      if (existing && existing.entry.team === entry.team) continue;
      existing?.destroy();
      const drone = new ArenaDrone(
        entry,
        this.deps.assets.drone(entry.cosmetics),
        entry.id === this.selfId,
      );
      this.drones.set(entry.id, drone);
      if (entry.id === this.selfId) this.layers.drones.addChild(drone.view);
      else this.layers.drones.addChildAt(drone.view, 0);
    }
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
