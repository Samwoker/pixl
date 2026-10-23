import { Rng } from '../rng';
import { raycastSolid, segmentCircleHit } from '../map/collision';
import { hasLineOfSight } from '../map/pathing';
import { buildArena, type ArenaId, type ArenaMap, type ArenaPickupSpawn } from './arenas';
import { stepMotion, type ArenaInput, type MotionState } from './movement';
import type {
  ArenaEvent,
  ArenaSnapshot,
  Loadout,
  PlayerResult,
  PlayerSnapshot,
  RosterEntry,
  TeamId,
} from './protocol';
import { ARENA_MODES, ARENA_TUNING, type ArenaMode } from './rules';
import { WEAPONS, weaponStats, type WeaponId, type WeaponStats } from './weapons';

export interface WeaponSlot {
  id: WeaponId;
  level: number;
  stats: WeaponStats;
  ammo: number;
  reloadLeft: number;
  cooldown: number;
}

export interface SimPlayer extends MotionState {
  id: string;
  name: string;
  bot: boolean;
  team: TeamId | null;
  loadout: Loadout;
  aim: number;
  hp: number;
  shield: number;
  alive: boolean;
  respawnIn: number;
  protectedFor: number;
  sinceDamage: number;
  weapons: [WeaponSlot, WeaponSlot];
  slot: 0 | 1;
  kills: number;
  humanKills: number;
  botKills: number;
  deaths: number;
  score: number;
  streak: number;
  bestStreak: number;
  inputs: ArenaInput[];
  inputBudget: number;
  lastSeq: number;
  think?: (sim: ArenaSimulation, self: SimPlayer, dt: number) => ArenaInput;
}

interface SimProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  weapon: WeaponId;
  damage: number;
  owner: string;
  team: TeamId | null;
}

interface SimPickup {
  spawn: ArenaPickupSpawn;
  respawnIn: number;
}

export interface ArenaSimOptions {
  arena: ArenaId;
  mode: ArenaMode;
  seed?: number;
  timeLimitSec?: number;
  scoreLimit?: number;
}

export interface AddPlayerOptions {
  id: string;
  name: string;
  bot: boolean;
  team: TeamId | null;
  loadout: Loadout;
  think?: SimPlayer['think'];
}

const MAX_QUEUED_INPUTS = 30;
const KILL_SCORE = 100;

export class ArenaSimulation {
  readonly map: ArenaMap;
  readonly mode: ArenaMode;
  readonly timeLimitSec: number;
  readonly scoreLimit: number;
  readonly dt = 1 / ARENA_TUNING.tickRate;
  readonly players = new Map<string, SimPlayer>();
  readonly rng: Rng;
  tick = 0;
  time = 0;
  finished = false;
  private projectiles: SimProjectile[] = [];
  private readonly pickups: SimPickup[];
  private events: ArenaEvent[] = [];
  private nextProjectileId = 1;

  constructor(options: ArenaSimOptions) {
    this.map = buildArena(options.arena);
    this.mode = options.mode;
    this.timeLimitSec = options.timeLimitSec ?? ARENA_MODES[options.mode].timeLimitSec;
    this.scoreLimit = options.scoreLimit ?? ARENA_MODES[options.mode].scoreLimit;
    this.rng = new Rng(options.seed ?? 1);
    this.pickups = this.map.pickups.map((spawn) => ({ spawn, respawnIn: 0 }));
  }

  get timeLeft(): number {
    return Math.max(0, this.timeLimitSec - this.time);
  }

  addPlayer(options: AddPlayerOptions): SimPlayer {
    const t = ARENA_TUNING;
    const slot = (id: WeaponId): WeaponSlot => {
      const level = options.loadout.levels[id] ?? 1;
      const stats = weaponStats(id, level);
      return { id, level, stats, ammo: stats.magazine, reloadLeft: 0, cooldown: 0 };
    };
    const player: SimPlayer = {
      ...options,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      energy: t.maxEnergy,
      dashTime: 0,
      dashCooldown: 0,
      aim: 0,
      hp: t.maxHp,
      shield: t.maxShield,
      alive: false,
      respawnIn: 0,
      protectedFor: 0,
      sinceDamage: Infinity,
      weapons: [slot(options.loadout.primary), slot(options.loadout.secondary)],
      slot: 0,
      kills: 0,
      humanKills: 0,
      botKills: 0,
      deaths: 0,
      score: 0,
      streak: 0,
      bestStreak: 0,
      inputs: [],
      inputBudget: t.maxInputsPerTick,
      lastSeq: 0,
    };
    this.players.set(player.id, player);
    this.respawn(player);
    return player;
  }

  removePlayer(id: string): SimPlayer | undefined {
    const player = this.players.get(id);
    this.players.delete(id);
    this.projectiles = this.projectiles.filter((p) => p.owner !== id);
    return player;
  }

  queueInput(id: string, input: ArenaInput): void {
    const player = this.players.get(id);
    if (!player || player.bot || input.seq <= player.lastSeq) return;
    const last = player.inputs[player.inputs.length - 1];
    if (last && input.seq <= last.seq) return;
    player.inputs.push(input);
    if (player.inputs.length > MAX_QUEUED_INPUTS) player.inputs.shift();
  }

  step(): void {
    if (this.finished) return;
    const dt = this.dt;
    this.tick++;
    this.time += dt;

    for (const player of this.players.values()) this.stepPlayer(player, dt);
    this.stepProjectiles(dt);
    this.stepPickups(dt);

    if (this.time >= this.timeLimitSec || this.scoreLimitReached()) this.finished = true;
  }

  teamScores(): [number, number] | null {
    if (this.mode !== 'tdm') return null;
    const scores: [number, number] = [0, 0];
    for (const p of this.players.values()) if (p.team !== null) scores[p.team] += p.kills;
    return scores;
  }

  isEnemy(a: SimPlayer, b: SimPlayer): boolean {
    if (a.id === b.id) return false;
    return this.mode === 'ffa' || a.team !== b.team;
  }

  activePickups(): ArenaPickupSpawn[] {
    return this.pickups.filter((p) => p.respawnIn <= 0).map((p) => p.spawn);
  }

  roster(): RosterEntry[] {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      bot: p.bot,
      team: p.team,
      cosmetics: p.loadout.cosmetics,
      weapons: [p.weapons[0].id, p.weapons[1].id],
    }));
  }

  /** Drains queued events; call once per broadcast. */
  snapshot(): ArenaSnapshot {
    const events = this.events;
    this.events = [];
    return {
      tick: this.tick,
      time: round(this.time, 3),
      timeLeft: round(this.timeLeft, 1),
      teamScores: this.teamScores(),
      players: [...this.players.values()].map(toSnapshot),
      projectiles: this.projectiles.map((p) => ({
        id: p.id,
        x: round(p.x, 1),
        y: round(p.y, 1),
        vx: round(p.vx, 1),
        vy: round(p.vy, 1),
        weapon: p.weapon,
        owner: p.owner,
      })),
      pickups: this.pickups.filter((p) => p.respawnIn <= 0).map((p) => p.spawn.id),
      events,
    };
  }

  results(): PlayerResult[] {
    const players = [...this.players.values()];
    const teamScores = this.teamScores();
    let winners: Set<string>;
    if (teamScores) {
      const [a, b] = teamScores;
      const winningTeam = a === b ? null : a > b ? 0 : 1;
      winners = new Set(players.filter((p) => p.team === winningTeam).map((p) => p.id));
    } else {
      const ranked = rankPlayers(players);
      const top = ranked[0];
      const tied =
        top && ranked[1] && ranked[1].kills === top.kills && ranked[1].deaths === top.deaths;
      winners = new Set(top && !tied && top.kills > 0 ? [top.id] : []);
    }
    return rankPlayers(players).map((p) => ({
      id: p.id,
      name: p.name,
      bot: p.bot,
      team: p.team,
      kills: p.kills,
      humanKills: p.humanKills,
      botKills: p.botKills,
      deaths: p.deaths,
      score: p.score,
      bestStreak: p.bestStreak,
      won: winners.has(p.id),
    }));
  }

  private scoreLimitReached(): boolean {
    const teams = this.teamScores();
    if (teams) return teams[0] >= this.scoreLimit || teams[1] >= this.scoreLimit;
    for (const p of this.players.values()) if (p.kills >= this.scoreLimit) return true;
    return false;
  }

  private stepPlayer(player: SimPlayer, dt: number): void {
    const t = ARENA_TUNING;
    if (!player.alive) {
      // Still acknowledge inputs so the client's prediction buffer drains.
      const last = player.inputs[player.inputs.length - 1];
      if (last) player.lastSeq = last.seq;
      player.inputs.length = 0;
      player.respawnIn -= dt;
      if (player.respawnIn <= 0) this.respawn(player);
      return;
    }

    player.protectedFor = Math.max(0, player.protectedFor - dt);
    player.sinceDamage += dt;
    if (player.sinceDamage >= t.shieldRegenDelaySec) {
      player.shield = Math.min(t.maxShield, player.shield + t.shieldRegenPerSec * dt);
    }

    if (player.think) {
      this.applyInput(player, player.think(this, player, dt), dt);
      return;
    }
    player.inputBudget = Math.min(t.maxInputsPerTick, player.inputBudget + 1);
    while (player.inputBudget >= 1 && player.inputs.length > 0 && player.alive) {
      const input = player.inputs.shift() as ArenaInput;
      player.inputBudget--;
      player.lastSeq = input.seq;
      this.applyInput(player, input, dt);
    }
  }

  private applyInput(player: SimPlayer, input: ArenaInput, dt: number): void {
    if (Number.isFinite(input.aim)) player.aim = input.aim;
    stepMotion(this.map, player, input, dt);

    if (input.swap) {
      player.slot = player.slot === 0 ? 1 : 0;
      player.weapons[player.slot].cooldown = Math.max(player.weapons[player.slot].cooldown, 0.2);
    }
    for (const slot of player.weapons) {
      slot.cooldown = Math.max(0, slot.cooldown - dt);
    }
    const weapon = player.weapons[player.slot];
    if (weapon.reloadLeft > 0) {
      weapon.reloadLeft -= dt;
      if (weapon.reloadLeft <= 0) {
        weapon.reloadLeft = 0;
        weapon.ammo = weapon.stats.magazine;
      }
      return;
    }
    if (input.reload && weapon.ammo < weapon.stats.magazine) {
      weapon.reloadLeft = weapon.stats.reloadSec;
      return;
    }
    if (!input.fire || weapon.cooldown > 0) return;
    if (weapon.ammo <= 0) {
      weapon.reloadLeft = weapon.stats.reloadSec;
      return;
    }
    this.fire(player, weapon);
  }

  private fire(player: SimPlayer, weapon: WeaponSlot): void {
    const def = WEAPONS[weapon.id];
    weapon.ammo--;
    weapon.cooldown = def.fireCooldownSec;
    player.protectedFor = 0;
    const muzzle = ARENA_TUNING.radius + 4;
    for (let i = 0; i < def.pellets; i++) {
      const fan = def.pellets > 1 ? (i / (def.pellets - 1) - 0.5) * def.spread : 0;
      const angle =
        player.aim + fan + (this.rng.next() - 0.5) * (def.pellets > 1 ? 0.08 : def.spread);
      this.projectiles.push({
        id: this.nextProjectileId++,
        x: player.x + Math.cos(player.aim) * muzzle,
        y: player.y + Math.sin(player.aim) * muzzle,
        vx: Math.cos(angle) * def.projectileSpeed,
        vy: Math.sin(angle) * def.projectileSpeed,
        life: def.projectileLifeSec,
        weapon: weapon.id,
        damage: weapon.stats.damage,
        owner: player.id,
        team: player.team,
      });
    }
    if (weapon.ammo <= 0) weapon.reloadLeft = weapon.stats.reloadSec;
  }

  private stepProjectiles(dt: number): void {
    const r = ARENA_TUNING.radius;
    const survivors: SimProjectile[] = [];
    for (const p of this.projectiles) {
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      const wallT = raycastSolid(this.map, p.x, p.y, nx, ny);
      const owner = this.players.get(p.owner);

      let hitPlayer: SimPlayer | null = null;
      let hitT = wallT ?? Infinity;
      for (const target of this.players.values()) {
        if (!target.alive || target.id === p.owner || target.protectedFor > 0) continue;
        if (this.mode === 'tdm' && target.team === p.team) continue;
        const t = segmentCircleHit(p.x, p.y, nx, ny, target.x, target.y, r);
        if (t !== null && t < hitT) {
          hitT = t;
          hitPlayer = target;
        }
      }

      const splash = WEAPONS[p.weapon].splashRadius;
      if (hitT !== Infinity) {
        const hx = p.x + (nx - p.x) * hitT;
        const hy = p.y + (ny - p.y) * hitT;
        this.events.push({
          type: 'hit',
          x: round(hx, 1),
          y: round(hy, 1),
          target: hitPlayer?.id ?? null,
          by: p.owner,
        });
        if (hitPlayer) this.damage(hitPlayer, p.damage, owner ?? null, p.weapon);
        if (splash > 0) this.explode(hx, hy, splash, p, hitPlayer, owner ?? null);
        continue;
      }

      p.x = nx;
      p.y = ny;
      p.life -= dt;
      if (p.life <= 0) {
        if (splash > 0) this.explode(p.x, p.y, splash, p, null, owner ?? null);
        continue;
      }
      survivors.push(p);
    }
    this.projectiles = survivors;
  }

  private explode(
    x: number,
    y: number,
    radius: number,
    p: SimProjectile,
    direct: SimPlayer | null,
    owner: SimPlayer | null,
  ): void {
    this.events.push({ type: 'explosion', x: round(x, 1), y: round(y, 1), radius });
    for (const target of this.players.values()) {
      if (!target.alive || target === direct || target.id === p.owner) continue;
      if (this.mode === 'tdm' && target.team === p.team) continue;
      const d = Math.hypot(target.x - x, target.y - y);
      if (d > radius + ARENA_TUNING.radius) continue;
      if (!hasLineOfSight(this.map, { x, y }, target)) continue;
      const falloff = Math.max(0, 1 - d / (radius + ARENA_TUNING.radius));
      this.damage(target, p.damage * 0.75 * falloff, owner, p.weapon);
    }
  }

  private damage(
    victim: SimPlayer,
    amount: number,
    attacker: SimPlayer | null,
    weapon: WeaponId | null,
  ): void {
    if (!victim.alive || victim.protectedFor > 0 || amount <= 0) return;
    const toShield = Math.min(victim.shield, amount);
    victim.shield -= toShield;
    victim.hp -= amount - toShield;
    victim.sinceDamage = 0;
    if (victim.hp > 0) return;

    victim.hp = 0;
    victim.alive = false;
    victim.respawnIn = ARENA_TUNING.respawnSec;
    victim.deaths++;
    victim.streak = 0;
    victim.inputs.length = 0;
    const credited =
      attacker && attacker !== victim && this.isEnemy(attacker, victim) ? attacker : null;
    if (credited) {
      credited.kills++;
      credited.score += KILL_SCORE;
      credited.streak++;
      credited.bestStreak = Math.max(credited.bestStreak, credited.streak);
      if (victim.bot) credited.botKills++;
      else credited.humanKills++;
    }
    this.events.push({ type: 'kill', killer: credited?.id ?? null, victim: victim.id, weapon });
  }

  private respawn(player: SimPlayer): void {
    const t = ARENA_TUNING;
    const candidates = this.map.spawns.filter((s) => this.mode === 'ffa' || s.team === player.team);
    const enemies = [...this.players.values()].filter((p) => p.alive && this.isEnemy(player, p));
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const spawn of candidates) {
      const nearest = enemies.reduce(
        (min, e) => Math.min(min, Math.hypot(e.x - spawn.x, e.y - spawn.y)),
        1e6,
      );
      const score = nearest + this.rng.next() * 60;
      if (score > bestScore) {
        bestScore = score;
        best = spawn;
      }
    }
    if (!best) throw new Error(`Arena ${this.map.id} has no spawns`);
    Object.assign(player, {
      x: best.x,
      y: best.y,
      vx: 0,
      vy: 0,
      hp: t.maxHp,
      shield: t.maxShield,
      energy: t.maxEnergy,
      dashTime: 0,
      dashCooldown: 0,
      alive: true,
      respawnIn: 0,
      protectedFor: t.spawnProtectionSec,
      sinceDamage: Infinity,
      slot: 0,
    });
    for (const w of player.weapons) {
      w.ammo = w.stats.magazine;
      w.reloadLeft = 0;
      w.cooldown = 0;
    }
    this.events.push({ type: 'respawn', player: player.id, x: best.x, y: best.y });
  }

  private stepPickups(dt: number): void {
    const t = ARENA_TUNING;
    for (const pickup of this.pickups) {
      if (pickup.respawnIn > 0) {
        pickup.respawnIn -= dt;
        continue;
      }
      for (const player of this.players.values()) {
        if (!player.alive) continue;
        if (Math.hypot(player.x - pickup.spawn.x, player.y - pickup.spawn.y) > t.pickupRadius)
          continue;
        const kind = pickup.spawn.kind;
        if (kind === 'health' && player.hp >= t.maxHp) continue;
        if (kind === 'shield' && player.shield >= t.maxShield) continue;
        if (kind === 'health') player.hp = Math.min(t.maxHp, player.hp + t.healthPickup);
        else player.shield = Math.min(t.maxShield, player.shield + t.shieldPickup);
        pickup.respawnIn = t.pickupRespawnSec;
        this.events.push({ type: 'pickup', id: pickup.spawn.id, player: player.id, kind });
        break;
      }
    }
  }
}

function rankPlayers(players: SimPlayer[]): SimPlayer[] {
  return [...players].sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function toSnapshot(p: SimPlayer): PlayerSnapshot {
  const w = p.weapons[p.slot];
  return {
    id: p.id,
    x: round(p.x, 2),
    y: round(p.y, 2),
    vx: round(p.vx, 2),
    vy: round(p.vy, 2),
    aim: round(p.aim, 3),
    hp: Math.ceil(p.hp),
    shield: Math.ceil(p.shield),
    energy: round(p.energy, 2),
    alive: p.alive,
    respawnIn: round(Math.max(0, p.respawnIn), 1),
    protectedFor: round(p.protectedFor, 2),
    dashTime: round(p.dashTime, 3),
    dashCooldown: round(p.dashCooldown, 3),
    slot: p.slot,
    ammo: w.ammo,
    magazine: w.stats.magazine,
    reloading: w.reloadLeft > 0 ? round(1 - w.reloadLeft / w.stats.reloadSec, 2) : 0,
    kills: p.kills,
    deaths: p.deaths,
    score: p.score,
  };
}
