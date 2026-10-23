import { flowDirection, bfsDistances, hasLineOfSight } from '../map/pathing';
import type { Rng } from '../rng';
import type { Vec2 } from '../types';
import type { ArenaInput } from './movement';
import { ARENA_TUNING, type BotDifficulty } from './rules';
import type { ArenaSimulation, SimPlayer } from './simulation';
import { WEAPONS } from './weapons';

interface DifficultyProfile {
  aimError: number;
  reactionSec: number;
  triggerDiscipline: number;
  sightRange: number;
}

const PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  easy: { aimError: 0.26, reactionSec: 0.7, triggerDiscipline: 0.55, sightRange: 600 },
  normal: { aimError: 0.13, reactionSec: 0.4, triggerDiscipline: 0.8, sightRange: 800 },
  hard: { aimError: 0.06, reactionSec: 0.2, triggerDiscipline: 1, sightRange: 1000 },
};

const BOT_NAMES = [
  'UNIT-07',
  'RUSTBUCKET',
  'K9-SWEEP',
  'MOTH',
  'GRIDLOCK',
  'SPARKPLUG',
  'NULLSET',
  'HALO-3',
  'TINMAN',
  'BYTEFANG',
  'COPPERHEAD',
  'STATIC',
  'DRIFTER',
  'LOWBATT',
  'OVERCLOCK',
  'PISTON',
];

export function botName(rng: Rng, taken: Set<string>): string {
  const free = BOT_NAMES.filter((n) => !taken.has(n));
  return free.length > 0 ? rng.pick(free) : `BOT-${rng.int(100, 999)}`;
}

/** Produces one input per tick from the same information a player could see. */
export class BotBrain {
  private readonly profile: DifficultyProfile;
  private targetId: string | null = null;
  private seenFor = 0;
  private retargetIn = 0;
  private strafeSign: 1 | -1 = 1;
  private aimNoise = 0;
  private lastHp: number = ARENA_TUNING.maxHp;
  private field: Int32Array | null = null;
  private fieldKey = -1;
  private fieldAge = 0;
  private seq = 0;

  constructor(
    difficulty: BotDifficulty,
    private readonly rng: Rng,
  ) {
    this.profile = PROFILES[difficulty];
    this.strafeSign = rng.chance(0.5) ? 1 : -1;
  }

  readonly think = (sim: ArenaSimulation, me: SimPlayer, dt: number): ArenaInput => {
    const input: ArenaInput = {
      seq: ++this.seq,
      mx: 0,
      my: 0,
      aim: me.aim,
      fire: false,
      dash: false,
      swap: false,
      reload: false,
    };
    const hurt = me.hp < this.lastHp;
    this.lastHp = me.hp;
    this.fieldAge += dt;
    this.retargetIn -= dt;

    const target = this.pickTarget(sim, me);
    const weapon = me.weapons[me.slot];
    const other = me.weapons[me.slot === 0 ? 1 : 0];
    const def = WEAPONS[weapon.id];
    const range = def.projectileSpeed * def.projectileLifeSec * 0.85;

    if (weapon.ammo === 0 && other.ammo > 0 && other.reloadLeft === 0) input.swap = true;

    if (target) {
      this.seenFor += dt;
      const dx = target.x - me.x;
      const dy = target.y - me.y;
      const dist = Math.hypot(dx, dy) || 1;
      const lead = Math.min(0.6, dist / def.projectileSpeed);
      this.aimNoise += (this.rng.next() - 0.5) * this.profile.aimError * 0.6;
      this.aimNoise *= 0.9;
      input.aim =
        Math.atan2(target.y + target.vy * lead - me.y, target.x + target.vx * lead - me.x) +
        this.aimNoise +
        (this.rng.next() - 0.5) * this.profile.aimError;

      const ready = this.seenFor >= this.profile.reactionSec;
      input.fire = ready && dist <= range * 1.1 && this.rng.chance(this.profile.triggerDiscipline);

      const preferred = Math.min(range * 0.6, 420);
      let mx: number;
      let my: number;
      if (dist > preferred * 1.25) {
        mx = dx / dist;
        my = dy / dist;
      } else if (dist < preferred * 0.6) {
        mx = -dx / dist;
        my = -dy / dist;
      } else {
        if (this.rng.chance(dt * 0.7)) this.strafeSign = this.strafeSign === 1 ? -1 : 1;
        mx = (-dy / dist) * this.strafeSign;
        my = (dx / dist) * this.strafeSign;
      }
      input.mx = mx;
      input.my = my;
      input.dash = hurt && this.rng.chance(0.25);
      return input;
    }

    this.seenFor = 0;
    const goal = this.pickGoal(sim, me);
    if (goal) {
      const dir = this.steerTowards(sim, me, goal);
      input.mx = dir.x;
      input.my = dir.y;
      input.aim = Math.atan2(dir.y, dir.x);
    }
    if (weapon.ammo < weapon.stats.magazine * 0.5) input.reload = true;
    return input;
  };

  private pickTarget(sim: ArenaSimulation, me: SimPlayer): SimPlayer | null {
    const current = this.targetId ? sim.players.get(this.targetId) : undefined;
    if (current && this.retargetIn > 0 && this.canSee(sim, me, current)) return current;
    this.retargetIn = 0.5;
    let best: SimPlayer | null = null;
    let bestDist = Infinity;
    for (const other of sim.players.values()) {
      if (!this.canSee(sim, me, other)) continue;
      const d = Math.hypot(other.x - me.x, other.y - me.y);
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }
    if (best?.id !== this.targetId) this.seenFor = 0;
    this.targetId = best?.id ?? null;
    return best;
  }

  private canSee(sim: ArenaSimulation, me: SimPlayer, other: SimPlayer): boolean {
    if (!other.alive || other.protectedFor > 0 || !sim.isEnemy(me, other)) return false;
    if (Math.hypot(other.x - me.x, other.y - me.y) > this.profile.sightRange) return false;
    return hasLineOfSight(sim.map, me, other);
  }

  private pickGoal(sim: ArenaSimulation, me: SimPlayer): Vec2 | null {
    if (me.hp < 45) {
      const health = nearest(
        me,
        sim.activePickups().filter((p) => p.kind === 'health'),
      );
      if (health) return health;
    }
    const enemies = [...sim.players.values()].filter((p) => p.alive && sim.isEnemy(me, p));
    return nearest(me, enemies) ?? nearest(me, sim.activePickups());
  }

  private steerTowards(sim: ArenaSimulation, me: SimPlayer, goal: Vec2): Vec2 {
    const ts = sim.map.tileSize;
    const gx = Math.floor(goal.x / ts);
    const gy = Math.floor(goal.y / ts);
    const key = gy * sim.map.width + gx;
    if (key !== this.fieldKey || this.fieldAge > 1 || !this.field) {
      this.field = bfsDistances(sim.map, { tx: gx, ty: gy }, 80);
      this.fieldKey = key;
      this.fieldAge = 0;
    }
    const dir = flowDirection(sim.map, this.field, Math.floor(me.x / ts), Math.floor(me.y / ts));
    if (dir) return dir;
    const dx = goal.x - me.x;
    const dy = goal.y - me.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }
}

function nearest<T extends Vec2>(from: Vec2, points: T[]): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const p of points) {
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}
