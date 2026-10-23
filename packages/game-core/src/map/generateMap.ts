import { salvageWeights, WORLD, ZONES, type ZoneDefinition } from '../config';
import { deriveSeed, Rng } from '../rng';
import type { MissionSpec, TilePoint } from '../types';
import { bfsDistances } from './pathing';
import {
  isSolidAt,
  Tile,
  tileAt,
  tileCenter,
  type Building,
  type CityMap,
  type EnemySpawn,
  type LootSpawn,
  type TileGrid,
} from './tiles';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_PLAYER_TO_ENEMY_TILES = 14;
const MIN_PLAYER_TO_LOOT_TILES = 3;

export function generateMap(spec: Pick<MissionSpec, 'seed' | 'zone'>): CityMap {
  const size = WORLD.mapTiles;
  const grid: TileGrid = {
    width: size,
    height: size,
    tileSize: WORLD.tileSize,
    tiles: new Uint8Array(size * size).fill(Tile.Ground),
  };

  const layoutRng = new Rng(deriveSeed(spec.seed, 'layout'));
  const buildings = buildCity(grid, layoutRng);

  const spawnRng = new Rng(deriveSeed(spec.seed, 'spawn'));
  const spawnTile = pickPlayerSpawn(grid, spawnRng);
  const distances = bfsDistances(grid, spawnTile);
  const extractionTile = pickExtraction(grid, distances, spawnRng);

  const zone = ZONES[spec.zone];
  const enemies = placeEnemies(grid, distances, new Rng(deriveSeed(spec.seed, 'enemies')), zone);
  const loot = placeLoot(
    grid,
    distances,
    extractionTile,
    new Rng(deriveSeed(spec.seed, 'loot')),
    zone,
  );

  return {
    seed: spec.seed,
    zone: spec.zone,
    ...grid,
    buildings,
    playerSpawn: tileCenter(grid, spawnTile.tx, spawnTile.ty),
    extraction: tileCenter(grid, extractionTile.tx, extractionTile.ty),
    enemies,
    loot,
  };
}

function setTile(grid: TileGrid, tx: number, ty: number, tile: number): void {
  grid.tiles[ty * grid.width + tx] = tile;
}

function roadLines(rng: Rng, size: number): [number, number][] {
  const lines: [number, number][] = [];
  let position = rng.int(3, 6);
  while (position < size - 5) {
    const width = rng.int(2, 3);
    lines.push([position, width]);
    position += width + rng.int(7, 12);
  }
  return lines;
}

function buildCity(grid: TileGrid, rng: Rng): Building[] {
  const size = grid.width;
  for (let i = 0; i < size; i++) {
    setTile(grid, i, 0, Tile.Wall);
    setTile(grid, i, size - 1, Tile.Wall);
    setTile(grid, 0, i, Tile.Wall);
    setTile(grid, size - 1, i, Tile.Wall);
  }

  const columns = roadLines(rng, size);
  const rows = roadLines(rng, size);
  for (const [start, width] of columns) {
    for (let x = start; x < start + width; x++) {
      for (let y = 1; y < size - 1; y++) setTile(grid, x, y, Tile.Road);
    }
  }
  for (const [start, width] of rows) {
    for (let y = start; y < start + width; y++) {
      for (let x = 1; x < size - 1; x++) setTile(grid, x, y, Tile.Road);
    }
  }

  const buildings: Building[] = [];
  for (const [x0, x1] of gaps(columns, size)) {
    for (const [y0, y1] of gaps(rows, size)) {
      // 1-tile sidewalk ring around every block.
      const inner: Rect = { x: x0 + 1, y: y0 + 1, w: x1 - x0 - 2, h: y1 - y0 - 2 };
      if (inner.w < 2 || inner.h < 2) continue;
      for (const lot of subdivide(inner, rng)) {
        const building = lotToBuilding(lot, rng);
        if (!building) continue;
        buildings.push(building);
        for (let y = building.y; y < building.y + building.h; y++) {
          for (let x = building.x; x < building.x + building.w; x++)
            setTile(grid, x, y, Tile.Building);
        }
      }
    }
  }

  scatterDebris(grid, rng);
  return buildings;
}

/** Open intervals between road lines (and the outer walls). */
function gaps(lines: [number, number][], size: number): [number, number][] {
  const result: [number, number][] = [];
  let previousEnd = 1;
  for (const [start, width] of lines) {
    if (start > previousEnd) result.push([previousEnd, start]);
    previousEnd = start + width;
  }
  if (size - 1 > previousEnd) result.push([previousEnd, size - 1]);
  return result;
}

function subdivide(rect: Rect, rng: Rng): Rect[] {
  const small = rect.w <= 6 && rect.h <= 6;
  if (small || rect.w < 5 || rect.h < 5) return [rect];
  const splitVertical = rect.w === rect.h ? rng.chance(0.5) : rect.w > rect.h;
  if (splitVertical) {
    const cut = rng.int(2, rect.w - 3);
    return [
      ...subdivide({ ...rect, w: cut }, rng),
      ...subdivide({ ...rect, x: rect.x + cut, w: rect.w - cut }, rng),
    ];
  }
  const cut = rng.int(2, rect.h - 3);
  return [
    ...subdivide({ ...rect, h: cut }, rng),
    ...subdivide({ ...rect, y: rect.y + cut, h: rect.h - cut }, rng),
  ];
}

function lotToBuilding(lot: Rect, rng: Rng): Building | null {
  if (rng.chance(0.14)) return null; // plaza / courtyard
  let { w, h } = lot;
  // Alleys on the right/bottom edge keep blocks porous.
  if (w > 2 && rng.chance(0.5)) w -= 1;
  if (h > 2 && rng.chance(0.5)) h -= 1;
  return {
    x: lot.x,
    y: lot.y,
    w,
    h,
    height: rng.int(1, 3) as 1 | 2 | 3,
    palette: rng.int(0, 3),
  };
}

function scatterDebris(grid: TileGrid, rng: Rng): void {
  for (let y = 1; y < grid.height - 1; y++) {
    for (let x = 1; x < grid.width - 1; x++) {
      if (tileAt(grid, x, y) !== Tile.Road || !rng.chance(0.02)) continue;
      let crowded = false;
      for (let dy = -1; dy <= 1 && !crowded; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (tileAt(grid, x + dx, y + dy) === Tile.Debris) {
            crowded = true;
            break;
          }
        }
      }
      if (!crowded) setTile(grid, x, y, Tile.Debris);
    }
  }
}

function pickPlayerSpawn(grid: TileGrid, rng: Rng): TilePoint {
  const corner = rng.int(0, 3);
  const cx = corner % 2 === 0 ? 2 : grid.width - 3;
  const cy = corner < 2 ? 2 : grid.height - 3;
  let best: TilePoint | null = null;
  let bestDistance = Infinity;
  for (let y = 1; y < grid.height - 1; y++) {
    for (let x = 1; x < grid.width - 1; x++) {
      if (tileAt(grid, x, y) !== Tile.Road || !isOpenArea(grid, x, y)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestDistance) {
        bestDistance = d;
        best = { tx: x, ty: y };
      }
    }
  }
  if (!best) throw new Error('Map generation failed: no road tile for player spawn');
  return best;
}

function isOpenArea(grid: TileGrid, tx: number, ty: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (isSolidAt(grid, tx + dx, ty + dy)) return false;
    }
  }
  return true;
}

function reachableTiles(grid: TileGrid, distances: Int32Array, minDistance: number): TilePoint[] {
  const tiles: TilePoint[] = [];
  for (let i = 0; i < distances.length; i++) {
    if ((distances[i] as number) < minDistance) continue;
    tiles.push({ tx: i % grid.width, ty: Math.floor(i / grid.width) });
  }
  return tiles;
}

function pickExtraction(grid: TileGrid, distances: Int32Array, rng: Rng): TilePoint {
  const candidates = reachableTiles(grid, distances, 1)
    .filter((t) => isOpenArea(grid, t.tx, t.ty))
    .sort(
      (a, b) =>
        (distances[b.ty * grid.width + b.tx] as number) -
        (distances[a.ty * grid.width + a.tx] as number),
    );
  const top = candidates.slice(0, Math.max(1, Math.floor(candidates.length * 0.08)));
  return rng.pick(top);
}

function farEnough(tile: TilePoint, taken: TilePoint[], minTiles: number): boolean {
  return taken.every((t) => Math.abs(t.tx - tile.tx) + Math.abs(t.ty - tile.ty) >= minTiles);
}

function placeEnemies(
  grid: TileGrid,
  distances: Int32Array,
  rng: Rng,
  zone: ZoneDefinition,
): EnemySpawn[] {
  const candidates = rng.shuffle(reachableTiles(grid, distances, MIN_PLAYER_TO_ENEMY_TILES));
  const taken: TilePoint[] = [];
  const enemies: EnemySpawn[] = [];
  for (const tile of candidates) {
    if (enemies.length >= zone.enemyCount) break;
    if (!farEnough(tile, taken, 4)) continue;
    taken.push(tile);
    const kind = rng.weighted(zone.enemyWeights);
    const { x, y } = tileCenter(grid, tile.tx, tile.ty);
    enemies.push({ id: `enemy_${enemies.length}`, kind, x, y });
  }
  return enemies;
}

function placeLoot(
  grid: TileGrid,
  distances: Int32Array,
  extraction: TilePoint,
  rng: Rng,
  zone: ZoneDefinition,
): LootSpawn[] {
  const candidates = rng.shuffle(
    reachableTiles(grid, distances, MIN_PLAYER_TO_LOOT_TILES).filter(
      (t) => Math.abs(t.tx - extraction.tx) + Math.abs(t.ty - extraction.ty) > 2,
    ),
  );
  const weights = salvageWeights(zone.level);
  const taken: TilePoint[] = [];
  const loot: LootSpawn[] = [];
  const total = zone.salvageCount + zone.energyCellCount;
  for (const tile of candidates) {
    if (loot.length >= total) break;
    if (!farEnough(tile, taken, 3)) continue;
    taken.push(tile);
    const itemId = loot.length < zone.energyCellCount ? 'energy_cell' : rng.weighted(weights);
    const { x, y } = tileCenter(grid, tile.tx, tile.ty);
    loot.push({ id: `loot_${loot.length}`, itemId, x, y });
  }
  return loot;
}
