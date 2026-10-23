import { describe, expect, it } from 'vitest';
import { ZONES, ZONE_LEVELS } from '../config';
import { generateMap } from '../map/generateMap';
import { bfsDistances, flowDirection, hasLineOfSight } from '../map/pathing';
import { isSolidWorld, Tile, tileAt } from '../map/tiles';

const toTile = (v: number) => Math.floor(v / 48);

describe('generateMap', () => {
  it('is deterministic for the same seed and zone', () => {
    const a = generateMap({ seed: 928374, zone: 3 });
    const b = generateMap({ seed: 928374, zone: 3 });
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
    expect(a.enemies).toEqual(b.enemies);
    expect(a.loot).toEqual(b.loot);
    expect(a.extraction).toEqual(b.extraction);
    expect(a.playerSpawn).toEqual(b.playerSpawn);
  });

  it('produces different layouts for different seeds', () => {
    const a = generateMap({ seed: 1, zone: 1 });
    const b = generateMap({ seed: 2, zone: 1 });
    expect(Array.from(a.tiles)).not.toEqual(Array.from(b.tiles));
  });

  it.each(ZONE_LEVELS)('places every spawn on a reachable tile (zone %i)', (zone) => {
    for (const seed of [11, 4242, 812931, 99999, 123456789]) {
      const map = generateMap({ seed, zone });
      const start = { tx: toTile(map.playerSpawn.x), ty: toTile(map.playerSpawn.y) };
      const dist = bfsDistances(map, start);
      const reachable = (x: number, y: number) =>
        (dist[toTile(y) * map.width + toTile(x)] ?? -1) >= 0;

      expect(isSolidWorld(map, map.playerSpawn.x, map.playerSpawn.y)).toBe(false);
      expect(reachable(map.extraction.x, map.extraction.y)).toBe(true);
      for (const e of map.enemies) expect(reachable(e.x, e.y)).toBe(true);
      for (const l of map.loot) expect(reachable(l.x, l.y)).toBe(true);
    }
  });

  it('respects zone spawn budgets and the outer wall', () => {
    const map = generateMap({ seed: 5150, zone: 2 });
    const zone = ZONES[2];
    expect(map.enemies.length).toBe(zone.enemyCount);
    expect(map.loot.filter((l) => l.itemId === 'energy_cell').length).toBe(zone.energyCellCount);
    expect(map.loot.length).toBe(zone.energyCellCount + zone.salvageCount);
    for (let i = 0; i < map.width; i++) {
      expect(tileAt(map, i, 0)).toBe(Tile.Wall);
      expect(tileAt(map, 0, i)).toBe(Tile.Wall);
    }
  });

  it('keeps the extraction point far from the spawn', () => {
    const map = generateMap({ seed: 77, zone: 1 });
    expect(
      Math.hypot(map.extraction.x - map.playerSpawn.x, map.extraction.y - map.playerSpawn.y),
    ).toBeGreaterThan(48 * 20);
  });
});

describe('pathing', () => {
  const map = generateMap({ seed: 31337, zone: 1 });
  const target = { tx: toTile(map.playerSpawn.x), ty: toTile(map.playerSpawn.y) };
  const field = bfsDistances(map, target);

  it('flow field always leads to the target', () => {
    const start = { tx: toTile(map.extraction.x), ty: toTile(map.extraction.y) };
    let { tx, ty } = start;
    for (let i = 0; i < 500 && (tx !== target.tx || ty !== target.ty); i++) {
      const dir = flowDirection(map, field, tx, ty);
      if (!dir) throw new Error(`flow field dead-ends at ${tx},${ty}`);
      tx += Math.round(dir.x);
      ty += Math.round(dir.y);
    }
    expect({ tx, ty }).toEqual(target);
  });

  it('line of sight is blocked by buildings', () => {
    const building = map.buildings.find((b) => b.w >= 2 && b.h >= 2);
    if (!building) throw new Error('expected at least one 2x2 building');
    const left = { x: (building.x - 0.5) * 48, y: (building.y + building.h / 2) * 48 };
    const right = { x: (building.x + building.w + 0.5) * 48, y: left.y };
    expect(hasLineOfSight(map, left, right)).toBe(false);
    expect(hasLineOfSight(map, map.playerSpawn, map.playerSpawn)).toBe(true);
  });
});
