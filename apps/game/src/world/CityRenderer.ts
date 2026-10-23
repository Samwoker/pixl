import { Graphics } from 'pixi.js';
import { deriveSeed, Rng, Tile, tileAt, type CityMap } from '@skyline/game-core';
import { PALETTE } from '../config/gameConfig';

/** Static city layer: drawn once per mission, never touched again. */
export function renderCity(map: CityMap): Graphics {
  const g = new Graphics();
  const ts = map.tileSize;
  const rng = new Rng(deriveSeed(map.seed, 'decor'));

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = tileAt(map, tx, ty);
      const x = tx * ts;
      const y = ty * ts;
      if (tile === Tile.Wall) {
        g.rect(x, y, ts, ts).fill(PALETTE.wall);
      } else if (tile === Tile.Road || tile === Tile.Debris) {
        g.rect(x, y, ts, ts).fill(PALETTE.road);
        for (let i = 0; i < 3; i++) {
          g.rect(x + rng.int(2, ts - 6), y + rng.int(2, ts - 6), 3, 3).fill(PALETTE.roadSpeck);
        }
      } else {
        g.rect(x, y, ts, ts).fill(PALETTE.ground);
        g.rect(x, y, ts, 1).fill(PALETTE.groundSeam);
        g.rect(x, y, 1, ts).fill(PALETTE.groundSeam);
      }
    }
  }

  drawLaneMarkings(g, map);

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (tileAt(map, tx, ty) !== Tile.Debris) continue;
      const x = tx * ts;
      const y = ty * ts;
      const horizontal = rng.chance(0.5);
      const w = horizontal ? 36 : 20;
      const h = horizontal ? 20 : 36;
      const ox = x + (ts - w) / 2;
      const oy = y + (ts - h) / 2;
      g.rect(ox + 4, oy + 4, w, h).fill({ color: PALETTE.shadow, alpha: 0.6 });
      g.rect(ox, oy, w, h).fill(PALETTE.debris);
      g.rect(ox + 3, oy + 3, w - 6, h - 6).fill(PALETTE.debrisLight);
      g.rect(ox + w / 2 - 3, oy + h / 2 - 3, 6, 6).fill(PALETTE.debris);
    }
  }

  for (const b of map.buildings) {
    const x = b.x * ts;
    const y = b.y * ts;
    const w = b.w * ts;
    const h = b.h * ts;
    const [base, light, dark] = PALETTE.roofs[b.palette % PALETTE.roofs.length] ?? PALETTE.roofs[0];
    const lift = b.height * 5;

    g.rect(x + lift, y + lift, w, h).fill({ color: PALETTE.shadow, alpha: 0.55 });
    g.rect(x, y, w, h).fill(dark);
    g.rect(x + 3, y + 3, w - 6, h - 6).fill(base);
    g.rect(x + 3, y + 3, w - 6, 2).fill(light);
    g.rect(x + 3, y + 3, 2, h - 6).fill(light);

    const details = Math.floor((b.w * b.h) / 3) + 1;
    for (let i = 0; i < details; i++) {
      const dw = rng.int(8, 18);
      const dh = rng.int(8, 18);
      if (w - dw - 16 <= 8 || h - dh - 16 <= 8) continue;
      const dx = x + rng.int(8, w - dw - 8);
      const dy = y + rng.int(8, h - dh - 8);
      g.rect(dx + 2, dy + 2, dw, dh).fill({ color: PALETTE.shadow, alpha: 0.5 });
      g.rect(dx, dy, dw, dh).fill(dark);
      g.rect(dx + 2, dy + 2, dw - 4, dh - 4).fill(light);
    }

    if (rng.chance(0.35)) {
      const neon = rng.pick(PALETTE.neon);
      const alongTop = rng.chance(0.5);
      if (alongTop) g.rect(x + 6, y + 1, w - 12, 2).fill({ color: neon, alpha: 0.85 });
      else g.rect(x + 1, y + 6, 2, h - 12).fill({ color: neon, alpha: 0.85 });
    }
  }

  return g;
}

/** Dashed centre lines; intersections get none because the road spans the whole cross-section. */
function drawLaneMarkings(g: Graphics, map: CityMap): void {
  const ts = map.tileSize;
  const color = 0x4a4630;
  const isRoad = (tx: number, ty: number) => {
    const t = tileAt(map, tx, ty);
    return t === Tile.Road || t === Tile.Debris;
  };
  const runLength = (tx: number, ty: number, dx: number, dy: number) => {
    let n = 0;
    while (n < 4 && isRoad(tx + dx * n, ty + dy * n)) n++;
    return n;
  };
  for (let ty = 1; ty < map.height - 1; ty++) {
    for (let tx = 1; tx < map.width - 1; tx++) {
      if (!isRoad(tx, ty)) continue;
      if (!isRoad(tx - 1, ty) && ty % 2 === 0) {
        const w = runLength(tx, ty, 1, 0);
        if (w === 2 || w === 3) g.rect((tx + w / 2) * ts - 1, ty * ts + 10, 2, ts - 20).fill(color);
      }
      if (!isRoad(tx, ty - 1) && tx % 2 === 0) {
        const h = runLength(tx, ty, 0, 1);
        if (h === 2 || h === 3) g.rect(tx * ts + 10, (ty + h / 2) * ts - 1, ts - 20, 2).fill(color);
      }
    }
  }
}
