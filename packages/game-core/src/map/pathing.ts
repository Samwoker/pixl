import type { TilePoint, Vec2 } from '../types';
import { isSolidAt, isSolidWorld, type TileGrid } from './tiles';

const NEIGHBOURS_4: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** BFS step distance from `start` to every walkable tile; -1 for unreachable/solid. */
export function bfsDistances(grid: TileGrid, start: TilePoint, maxDistance = Infinity): Int32Array {
  const { width, height } = grid;
  const dist = new Int32Array(width * height).fill(-1);
  if (isSolidAt(grid, start.tx, start.ty)) return dist;

  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const startIndex = start.ty * width + start.tx;
  dist[startIndex] = 0;
  queue[tail++] = startIndex;

  while (head < tail) {
    const index = queue[head++] as number;
    const d = dist[index] as number;
    if (d >= maxDistance) continue;
    const x = index % width;
    const y = (index - x) / width;
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = x + dx;
      const ny = y + dy;
      if (isSolidAt(grid, nx, ny)) continue;
      const ni = ny * width + nx;
      if (dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      queue[tail++] = ni;
    }
  }
  return dist;
}

/**
 * Direction (unit vector) to step down a BFS distance field from tile (tx, ty).
 * Diagonals are only taken when both orthogonal neighbours are open, so agents don't clip corners.
 */
export function flowDirection(
  grid: TileGrid,
  field: Int32Array,
  tx: number,
  ty: number,
): Vec2 | null {
  const here = field[ty * grid.width + tx];
  if (here === undefined || here <= 0) return null;
  let best = here;
  let bx = 0;
  let by = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = tx + dx;
      const ny = ty + dy;
      if (isSolidAt(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (isSolidAt(grid, tx + dx, ty) || isSolidAt(grid, tx, ty + dy))) {
        continue;
      }
      const d = field[ny * grid.width + nx];
      if (d === undefined || d < 0) continue;
      if (d < best) {
        best = d;
        bx = dx;
        by = dy;
      }
    }
  }
  if (bx === 0 && by === 0) return null;
  const len = Math.hypot(bx, by);
  return { x: bx / len, y: by / len };
}

export function hasLineOfSight(grid: TileGrid, a: Vec2, b: Vec2): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const step = grid.tileSize / 4;
  const steps = Math.ceil(distance / step);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolidWorld(grid, a.x + dx * t, a.y + dy * t)) return false;
  }
  return true;
}
