import { moveBody } from '../map/collision';
import type { TileGrid } from '../map/tiles';
import { ARENA_TUNING } from './rules';

export interface ArenaInput {
  seq: number;
  /** Movement intent, each in [-1, 1]. */
  mx: number;
  my: number;
  aim: number;
  fire: boolean;
  dash: boolean;
  swap: boolean;
  reload: boolean;
}

export const IDLE_INPUT: Omit<ArenaInput, 'seq' | 'aim'> = {
  mx: 0,
  my: 0,
  fire: false,
  dash: false,
  swap: false,
  reload: false,
};

/** The subset of drone state the client predicts locally. */
export interface MotionState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  dashTime: number;
  dashCooldown: number;
}

/**
 * Shared by server simulation and client prediction: identical inputs must give
 * identical motion on both sides or reconciliation will visibly snap.
 */
export function stepMotion(
  grid: TileGrid,
  state: MotionState,
  input: ArenaInput,
  dt: number,
): void {
  const t = ARENA_TUNING;
  state.dashCooldown = Math.max(0, state.dashCooldown - dt);
  state.energy = Math.min(t.maxEnergy, state.energy + t.energyRegenPerSec * dt);

  let ix = clampUnit(input.mx);
  let iy = clampUnit(input.my);
  const len = Math.hypot(ix, iy);
  if (len > 1) {
    ix /= len;
    iy /= len;
  }

  if (
    input.dash &&
    state.dashCooldown <= 0 &&
    state.dashTime <= 0 &&
    state.energy >= t.dashEnergyCost
  ) {
    const angle = len > 0.01 ? Math.atan2(iy, ix) : input.aim;
    state.vx = Math.cos(angle) * t.dashSpeed;
    state.vy = Math.sin(angle) * t.dashSpeed;
    state.dashTime = t.dashDurationSec;
    state.dashCooldown = t.dashCooldownSec;
    state.energy -= t.dashEnergyCost;
  }

  if (state.dashTime > 0) {
    state.dashTime = Math.max(0, state.dashTime - dt);
  } else {
    const blend = Math.min(1, dt * t.friction);
    state.vx += (ix * t.speed - state.vx) * blend;
    state.vy += (iy * t.speed - state.vy) * blend;
  }

  const body = { x: state.x, y: state.y, radius: t.radius };
  moveBody(grid, body, state.vx * dt, state.vy * dt);
  state.x = body.x;
  state.y = body.y;
}

function clampUnit(v: number): number {
  return Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
}
