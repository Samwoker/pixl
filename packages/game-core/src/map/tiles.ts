import type { EnemyKind, ItemId, Vec2, ZoneLevel } from '../types';

export const Tile = {
  Road: 0,
  Ground: 1,
  Building: 2,
  Debris: 3,
  Wall: 4,
} as const;

export type TileType = (typeof Tile)[keyof typeof Tile];

export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  height: 1 | 2 | 3;
  palette: number;
}

export interface EnemySpawn {
  id: string;
  kind: EnemyKind;
  x: number;
  y: number;
}

export interface LootSpawn {
  id: string;
  itemId: ItemId;
  x: number;
  y: number;
}

export interface CityMap {
  seed: number;
  zone: ZoneLevel;
  width: number;
  height: number;
  tileSize: number;
  tiles: Uint8Array;
  buildings: Building[];
  playerSpawn: Vec2;
  extraction: Vec2;
  enemies: EnemySpawn[];
  loot: LootSpawn[];
}

/** Minimal shape needed for collision / pathing queries. */
export interface TileGrid {
  width: number;
  height: number;
  tileSize: number;
  tiles: Uint8Array;
}

export function tileAt(grid: TileGrid, tx: number, ty: number): TileType {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return Tile.Wall;
  return grid.tiles[ty * grid.width + tx] as TileType;
}

export function isSolidTile(tile: TileType): boolean {
  return tile === Tile.Building || tile === Tile.Debris || tile === Tile.Wall;
}

export function isSolidAt(grid: TileGrid, tx: number, ty: number): boolean {
  return isSolidTile(tileAt(grid, tx, ty));
}

export function isSolidWorld(grid: TileGrid, x: number, y: number): boolean {
  return isSolidAt(grid, Math.floor(x / grid.tileSize), Math.floor(y / grid.tileSize));
}

export function tileCenter(grid: TileGrid, tx: number, ty: number): Vec2 {
  return { x: (tx + 0.5) * grid.tileSize, y: (ty + 0.5) * grid.tileSize };
}
