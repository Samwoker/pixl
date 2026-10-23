import { describe, expect, it } from 'vitest';
import { Tile, type TileGrid } from '@skyline/game-core';
import { circlesOverlap, moveBody, resolveTileCollision, separateBodies } from '../CollisionSystem';

// 5x5 grid, 10px tiles, single solid tile at (2,2).
function grid(): TileGrid {
  const tiles = new Uint8Array(25).fill(Tile.Road);
  tiles[2 * 5 + 2] = Tile.Building;
  return { width: 5, height: 5, tileSize: 10, tiles };
}

describe('CollisionSystem', () => {
  it('pushes a circle out of a solid tile edge', () => {
    const body = { x: 18, y: 25, radius: 4 };
    expect(resolveTileCollision(grid(), body)).toBe(true);
    expect(body.x).toBeCloseTo(16);
    expect(body.y).toBe(25);
  });

  it('ejects a body whose centre is inside a tile', () => {
    const body = { x: 21, y: 25, radius: 3 };
    resolveTileCollision(grid(), body);
    expect(body.x).toBeLessThanOrEqual(17);
  });

  it('slides along walls instead of stopping', () => {
    const body = { x: 15, y: 15, radius: 4 };
    moveBody(grid(), body, 5, 5);
    expect(body.x).toBeLessThanOrEqual(16);
    expect(body.y).toBe(20);
  });

  it('treats out-of-bounds as solid', () => {
    const body = { x: 2, y: 25, radius: 4 };
    resolveTileCollision(grid(), body);
    expect(body.x).toBe(4);
  });

  it('detects and separates overlapping circles', () => {
    const a = { x: 5, y: 5, radius: 3 };
    const b = { x: 8, y: 5, radius: 3 };
    expect(circlesOverlap(a, b)).toBe(true);
    separateBodies({ ...grid(), tiles: new Uint8Array(25).fill(Tile.Road) }, [a, b]);
    expect(b.x - a.x).toBeCloseTo(6);
  });
});
