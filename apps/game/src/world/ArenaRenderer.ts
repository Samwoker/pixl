import { Graphics } from 'pixi.js';
import { Tile, tileAt, type ArenaMap } from '@skyline/game-core';

const SHADOW = 0x020304;

/** Tile-based renderer: arena buildings can be any shape, so edges are derived per tile. */
export function renderArena(map: ArenaMap): Graphics {
  const g = new Graphics();
  const ts = map.tileSize;
  const { theme } = map;
  const [roof, roofLight, roofDark] = theme.roof;
  const isBuilding = (tx: number, ty: number) => tileAt(map, tx, ty) === Tile.Building;

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = tileAt(map, tx, ty);
      const x = tx * ts;
      const y = ty * ts;
      if (tile === Tile.Wall) {
        g.rect(x, y, ts, ts).fill(theme.wall);
      } else if (tile === Tile.Road) {
        g.rect(x, y, ts, ts).fill(theme.road);
        if ((tx + ty) % 3 === 0)
          g.rect(x + ts / 2 - 1, y + 12, 2, ts - 24).fill({ color: theme.accent, alpha: 0.12 });
      } else {
        g.rect(x, y, ts, ts).fill(theme.ground);
        g.rect(x, y, ts, 1).fill(theme.groundSeam);
        g.rect(x, y, 1, ts).fill(theme.groundSeam);
      }
    }
  }

  // Inner glow along the boundary wall frames the playable space.
  g.rect(ts - 2, ts - 2, (map.width - 2) * ts + 4, (map.height - 2) * ts + 4).stroke({
    width: 2,
    color: theme.accent,
    alpha: 0.35,
  });

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      if (isBuilding(tx, ty))
        g.rect(tx * ts + 8, ty * ts + 8, ts, ts).fill({ color: SHADOW, alpha: 0.6 });
    }
  }

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = tileAt(map, tx, ty);
      const x = tx * ts;
      const y = ty * ts;
      if (tile === Tile.Building) {
        g.rect(x, y, ts, ts).fill(roof);
        if (!isBuilding(tx, ty - 1)) g.rect(x, y, ts, 3).fill(roofLight);
        if (!isBuilding(tx - 1, ty)) g.rect(x, y, 3, ts).fill(roofLight);
        if (!isBuilding(tx, ty + 1)) {
          g.rect(x, y + ts - 3, ts, 3).fill(roofDark);
          if ((tx * 7 + ty) % 4 === 0)
            g.rect(x + 4, y + ts - 2, ts - 8, 2).fill({ color: theme.accent, alpha: 0.8 });
        }
        if (!isBuilding(tx + 1, ty)) g.rect(x + ts - 3, y, 3, ts).fill(roofDark);
        if ((tx * 13 + ty * 7) % 5 === 0) {
          g.rect(x + 14, y + 14, 14, 12).fill(roofDark);
          g.rect(x + 16, y + 16, 10, 8).fill(roofLight);
        }
      } else if (tile === Tile.Debris) {
        const [crate, crateLight] = theme.crate;
        g.rect(x + 9, y + 9, 34, 34).fill({ color: SHADOW, alpha: 0.6 });
        g.rect(x + 6, y + 6, 34, 34).fill(crate);
        g.rect(x + 9, y + 9, 28, 28).fill(crateLight);
        g.rect(x + 9, y + 21, 28, 4).fill(crate);
        g.rect(x + 21, y + 9, 4, 28).fill(crate);
      }
    }
  }
  return g;
}
