import { WORLD } from '../config';
import { Tile, type TileGrid } from '../map/tiles';
import { bfsDistances } from '../map/pathing';
import type { Vec2 } from '../types';

export type ArenaId = 'rooftop_relay' | 'foundry' | 'cryo_vault' | 'overgrowth' | 'neon_bazaar';
export type PickupKind = 'health' | 'shield';

export interface ArenaTheme {
  background: number;
  ground: number;
  groundSeam: number;
  road: number;
  wall: number;
  roof: readonly [number, number, number];
  crate: readonly [number, number];
  accent: number;
}

type Rect = readonly [x: number, y: number, w: number, h: number];
type Point = readonly [x: number, y: number];

interface ArenaBlueprint {
  id: ArenaId;
  name: string;
  tagline: string;
  width: number;
  height: number;
  theme: ArenaTheme;
  /** Left-half features; mirrored onto the right half for fair team play. */
  blocks: Rect[];
  crates: Point[];
  lanes: Rect[];
  spawns: Point[];
  pickups: { kind: PickupKind; at: Point }[];
  /** Features placed as-is (usually on the centre line). */
  centre?: { blocks?: Rect[]; crates?: Point[]; pickups?: { kind: PickupKind; at: Point }[] };
}

export interface ArenaSpawn extends Vec2 {
  team: 0 | 1;
}

export interface ArenaPickupSpawn extends Vec2 {
  id: string;
  kind: PickupKind;
}

export interface ArenaMap extends TileGrid {
  id: ArenaId;
  name: string;
  tagline: string;
  theme: ArenaTheme;
  spawns: ArenaSpawn[];
  pickups: ArenaPickupSpawn[];
}

const BLUEPRINTS: Record<ArenaId, ArenaBlueprint> = {
  rooftop_relay: {
    id: 'rooftop_relay',
    name: 'Rooftop Relay',
    tagline: 'Balanced blocks around an open plaza.',
    width: 48,
    height: 30,
    theme: {
      background: 0x07090d,
      ground: 0x1e232c,
      groundSeam: 0x262c37,
      road: 0x12151b,
      wall: 0x05070a,
      roof: [0x2a3140, 0x363f52, 0x1d222d],
      crate: [0x4a2f24, 0x6e4634],
      accent: 0x3d7bff,
    },
    blocks: [
      [4, 4, 6, 5],
      [4, 13, 4, 4],
      [4, 21, 6, 5],
      [13, 3, 4, 7],
      [13, 20, 4, 7],
      [12, 13, 5, 4],
      [20, 7, 3, 3],
      [20, 20, 3, 3],
    ],
    crates: [
      [9, 11],
      [9, 18],
      [18, 12],
      [18, 17],
      [21, 14],
    ],
    lanes: [
      [1, 10, 23, 2],
      [1, 18, 23, 2],
    ],
    spawns: [
      [2, 2],
      [2, 27],
      [2, 15],
      [8, 11],
      [8, 18],
    ],
    pickups: [
      { kind: 'health', at: [10, 15] },
      { kind: 'shield', at: [18, 2] },
      { kind: 'shield', at: [18, 27] },
    ],
    centre: {
      blocks: [[22, 13, 4, 4]],
      pickups: [
        { kind: 'health', at: [23, 5] },
        { kind: 'health', at: [24, 24] },
      ],
    },
  },
  foundry: {
    id: 'foundry',
    name: 'Foundry',
    tagline: 'Long furnace corridors. Crates everywhere.',
    width: 52,
    height: 28,
    theme: {
      background: 0x0c0806,
      ground: 0x2a211b,
      groundSeam: 0x342820,
      road: 0x1a1410,
      wall: 0x080504,
      roof: [0x3b2c22, 0x524032, 0x241a14],
      crate: [0x5a3b14, 0x8a5a1c],
      accent: 0xff8a3d,
    },
    blocks: [
      [5, 4, 10, 2],
      [5, 22, 10, 2],
      [5, 9, 3, 10],
      [11, 9, 3, 4],
      [11, 15, 3, 4],
      [17, 4, 2, 8],
      [17, 16, 2, 8],
      [21, 12, 3, 4],
    ],
    crates: [
      [9, 13],
      [9, 14],
      [15, 13],
      [15, 14],
      [20, 2],
      [20, 25],
      [3, 7],
      [3, 20],
    ],
    lanes: [[1, 13, 25, 2]],
    spawns: [
      [2, 2],
      [2, 25],
      [2, 13],
      [9, 7],
      [9, 20],
    ],
    pickups: [
      { kind: 'health', at: [16, 13] },
      { kind: 'shield', at: [10, 2] },
      { kind: 'shield', at: [10, 25] },
    ],
    centre: {
      blocks: [
        [24, 4, 4, 3],
        [24, 21, 4, 3],
      ],
      pickups: [{ kind: 'health', at: [25, 13] }],
    },
  },
  cryo_vault: {
    id: 'cryo_vault',
    name: 'Cryo Vault',
    tagline: 'A ring of frozen corridors around a sealed core.',
    width: 44,
    height: 32,
    theme: {
      background: 0x060a10,
      ground: 0x1c2733,
      groundSeam: 0x25323f,
      road: 0x111a23,
      wall: 0x04070b,
      roof: [0x2c4152, 0x45627a, 0x1b2a36],
      crate: [0x3a5a73, 0x7fb3d9],
      accent: 0x5fe3ff,
    },
    blocks: [
      [6, 6, 4, 4],
      [6, 22, 4, 4],
      [14, 4, 8, 2],
      [14, 26, 8, 2],
      [12, 10, 2, 12],
      [17, 13, 3, 6],
    ],
    crates: [
      [4, 15],
      [4, 16],
      [10, 15],
      [16, 8],
      [16, 23],
      [20, 8],
      [20, 23],
    ],
    lanes: [
      [1, 2, 21, 1],
      [1, 29, 21, 1],
    ],
    spawns: [
      [2, 2],
      [2, 29],
      [2, 13],
      [8, 12],
      [8, 19],
    ],
    pickups: [
      { kind: 'health', at: [15, 15] },
      { kind: 'shield', at: [9, 2] },
    ],
    centre: {
      blocks: [[20, 15, 4, 2]],
      pickups: [
        { kind: 'shield', at: [21, 11] },
        { kind: 'health', at: [22, 20] },
      ],
    },
  },
  overgrowth: {
    id: 'overgrowth',
    name: 'Overgrowth',
    tagline: 'Scattered ruins and long sightlines. Sniper country.',
    width: 50,
    height: 30,
    theme: {
      background: 0x050a06,
      ground: 0x1b261b,
      groundSeam: 0x223022,
      road: 0x141c13,
      wall: 0x030603,
      roof: [0x2d3a26, 0x435638, 0x1c2618],
      crate: [0x3d4a1f, 0x6a7d34],
      accent: 0x7dff9b,
    },
    blocks: [
      [5, 5, 2, 2],
      [9, 9, 3, 2],
      [4, 13, 2, 4],
      [9, 19, 3, 2],
      [5, 23, 2, 2],
      [15, 4, 2, 5],
      [15, 21, 2, 5],
      [14, 13, 4, 4],
      [20, 8, 2, 2],
      [20, 20, 2, 2],
    ],
    crates: [
      [8, 15],
      [12, 6],
      [12, 24],
      [18, 11],
      [18, 18],
      [22, 14],
      [22, 15],
    ],
    lanes: [[1, 14, 24, 2]],
    spawns: [
      [2, 2],
      [2, 27],
      [2, 14],
      [7, 11],
      [7, 18],
    ],
    pickups: [
      { kind: 'health', at: [11, 15] },
      { kind: 'shield', at: [19, 15] },
    ],
    centre: {
      blocks: [
        [23, 12, 4, 1],
        [23, 17, 4, 1],
      ],
      pickups: [
        { kind: 'health', at: [24, 2] },
        { kind: 'health', at: [25, 27] },
      ],
    },
  },
  neon_bazaar: {
    id: 'neon_bazaar',
    name: 'Neon Bazaar',
    tagline: 'Tight market alleys. Bring a scatter gun.',
    width: 46,
    height: 30,
    theme: {
      background: 0x0a050c,
      ground: 0x241a2a,
      groundSeam: 0x2e2236,
      road: 0x170f1b,
      wall: 0x060308,
      roof: [0x3a2442, 0x55345f, 0x24162a],
      crate: [0x5a2a4a, 0xa0457f],
      accent: 0xff4dd2,
    },
    blocks: [
      [3, 3, 4, 3],
      [9, 3, 4, 3],
      [15, 3, 4, 3],
      [3, 8, 3, 4],
      [8, 8, 5, 2],
      [15, 8, 3, 5],
      [3, 14, 4, 2],
      [9, 12, 3, 6],
      [3, 18, 3, 4],
      [8, 20, 5, 2],
      [15, 17, 3, 5],
      [3, 24, 4, 3],
      [9, 24, 4, 3],
      [15, 24, 4, 3],
      [20, 6, 2, 4],
      [20, 20, 2, 4],
    ],
    crates: [
      [7, 6],
      [13, 6],
      [7, 16],
      [13, 15],
      [19, 15],
      [7, 23],
      [13, 23],
    ],
    lanes: [[1, 13, 22, 1]],
    spawns: [
      [1, 1],
      [1, 28],
      [1, 13],
      [7, 13],
      [6, 7],
    ],
    pickups: [
      { kind: 'health', at: [13, 13] },
      { kind: 'shield', at: [19, 2] },
      { kind: 'shield', at: [19, 27] },
    ],
    centre: {
      blocks: [[21, 13, 4, 4]],
    },
  },
};

export const ARENA_IDS = Object.keys(BLUEPRINTS) as ArenaId[];

export function isArenaId(value: unknown): value is ArenaId {
  return typeof value === 'string' && value in BLUEPRINTS;
}

export function arenaInfo(id: ArenaId): {
  id: ArenaId;
  name: string;
  tagline: string;
  accent: number;
} {
  const b = BLUEPRINTS[id];
  return { id: b.id, name: b.name, tagline: b.tagline, accent: b.theme.accent };
}

const cache = new Map<ArenaId, ArenaMap>();

/** Arena maps are static; build once and share (callers must not mutate tiles). */
export function buildArena(id: ArenaId): ArenaMap {
  const cached = cache.get(id);
  if (cached) return cached;

  const b = BLUEPRINTS[id];
  const { width, height } = b;
  const tiles = new Uint8Array(width * height).fill(Tile.Ground);
  const set = (x: number, y: number, t: number) => {
    if (x > 0 && y > 0 && x < width - 1 && y < height - 1) tiles[y * width + x] = t;
  };
  const fill = ([x, y, w, h]: Rect, t: number) => {
    for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) set(tx, ty, t);
  };
  const mirrorRect = ([x, y, w, h]: Rect): Rect => [width - x - w, y, w, h];
  const mirrorX = (x: number) => width - 1 - x;

  for (let i = 0; i < width; i++) {
    tiles[i] = Tile.Wall;
    tiles[(height - 1) * width + i] = Tile.Wall;
  }
  for (let i = 0; i < height; i++) {
    tiles[i * width] = Tile.Wall;
    tiles[i * width + width - 1] = Tile.Wall;
  }

  for (const lane of b.lanes) {
    fill(lane, Tile.Road);
    fill(mirrorRect(lane), Tile.Road);
  }
  for (const block of [...b.blocks, ...(b.centre?.blocks ?? [])]) {
    fill(block, Tile.Building);
    fill(mirrorRect(block), Tile.Building);
  }
  for (const [x, y] of [...b.crates, ...(b.centre?.crates ?? [])]) {
    set(x, y, Tile.Debris);
    set(mirrorX(x), y, Tile.Debris);
  }

  const centreOf = (x: number, y: number): Vec2 => ({
    x: (x + 0.5) * WORLD.tileSize,
    y: (y + 0.5) * WORLD.tileSize,
  });
  const spawns: ArenaSpawn[] = b.spawns.flatMap(([x, y]) => [
    { ...centreOf(x, y), team: 0 as const },
    { ...centreOf(mirrorX(x), y), team: 1 as const },
  ]);
  const pickups: ArenaPickupSpawn[] = [];
  for (const { kind, at } of b.pickups) {
    pickups.push({ id: `p${pickups.length}`, kind, ...centreOf(at[0], at[1]) });
    pickups.push({ id: `p${pickups.length}`, kind, ...centreOf(mirrorX(at[0]), at[1]) });
  }
  for (const { kind, at } of b.centre?.pickups ?? []) {
    pickups.push({ id: `p${pickups.length}`, kind, ...centreOf(at[0], at[1]) });
  }

  const arena: ArenaMap = {
    id,
    name: b.name,
    tagline: b.tagline,
    theme: b.theme,
    width,
    height,
    tileSize: WORLD.tileSize,
    tiles,
    spawns,
    pickups,
  };
  cache.set(id, arena);
  return arena;
}

/** True if every spawn and pickup is reachable from the first spawn. Used by tests. */
export function arenaIsConnected(arena: ArenaMap): boolean {
  const ts = arena.tileSize;
  const first = arena.spawns[0];
  if (!first) return false;
  const dist = bfsDistances(arena, { tx: Math.floor(first.x / ts), ty: Math.floor(first.y / ts) });
  return [...arena.spawns, ...arena.pickups].every(
    (p) => (dist[Math.floor(p.y / ts) * arena.width + Math.floor(p.x / ts)] ?? -1) >= 0,
  );
}
