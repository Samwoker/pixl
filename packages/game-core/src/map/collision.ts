import { isSolidAt, isSolidWorld, type TileGrid } from './tiles';

export interface Body {
  x: number;
  y: number;
  radius: number;
}

/** Pushes a circle out of any solid tiles it overlaps. Returns true on contact. */
export function resolveTileCollision(grid: TileGrid, body: Body): boolean {
  const ts = grid.tileSize;
  const r = body.radius;
  const minTx = Math.floor((body.x - r) / ts);
  const maxTx = Math.floor((body.x + r) / ts);
  const minTy = Math.floor((body.y - r) / ts);
  const maxTy = Math.floor((body.y + r) / ts);
  let hit = false;

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isSolidAt(grid, tx, ty)) continue;
      const left = tx * ts;
      const top = ty * ts;
      const nearestX = Math.max(left, Math.min(body.x, left + ts));
      const nearestY = Math.max(top, Math.min(body.y, top + ts));
      const dx = body.x - nearestX;
      const dy = body.y - nearestY;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        body.x += (dx / d) * (r - d);
        body.y += (dy / d) * (r - d);
      } else {
        // Centre is inside the tile: eject along the shallowest axis.
        const exits = [
          [body.x - left + r, -1, 0],
          [left + ts - body.x + r, 1, 0],
          [body.y - top + r, 0, -1],
          [top + ts - body.y + r, 0, 1],
        ] as const;
        const [depth, ex, ey] = exits.reduce((a, b) => (b[0] < a[0] ? b : a));
        body.x += ex * depth;
        body.y += ey * depth;
      }
    }
  }
  return hit;
}

/** Axis-separated move so bodies slide along walls instead of sticking. */
export function moveBody(grid: TileGrid, body: Body, dx: number, dy: number): boolean {
  body.x += dx;
  const hitX = resolveTileCollision(grid, body);
  body.y += dy;
  const hitY = resolveTileCollision(grid, body);
  return hitX || hitY;
}

export function circlesOverlap(a: Body, b: Body, extra = 0): boolean {
  const r = a.radius + b.radius + extra;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < r * r;
}

export function pointInSolid(grid: TileGrid, x: number, y: number): boolean {
  return isSolidWorld(grid, x, y);
}

/** Fraction along a→b where the segment first enters circle (cx, cy, r), or null. */
export function segmentCircleHit(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const a = dx * dx + dy * dy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  if (a < 1e-9) return null;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** Fraction along a→b of the first solid tile, sampled every quarter tile; null if clear. */
export function raycastSolid(
  grid: TileGrid,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number | null {
  const length = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(length / (grid.tileSize / 4)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (isSolidWorld(grid, ax + (bx - ax) * t, ay + (by - ay) * t)) return t;
  }
  return null;
}

/** Cheap O(n²) separation; enemy counts are capped well below where this matters. */
export function separateBodies(grid: TileGrid, bodies: Body[]): void {
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i] as Body;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j] as Body;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      resolveTileCollision(grid, a);
      resolveTileCollision(grid, b);
    }
  }
}
