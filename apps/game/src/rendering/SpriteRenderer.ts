import { CanvasSource, Texture } from 'pixi.js';

export interface PixelArt {
  rows: readonly string[];
  palette: Readonly<Record<string, string>>;
}

/** Rasterises a character grid into a nearest-filtered texture ('.' = transparent). */
export function pixelArtTexture(art: PixelArt): Texture {
  const height = art.rows.length;
  const width = Math.max(...art.rows.map((row) => row.length));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  art.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const key = row[x] as string;
      if (key === '.') continue;
      const color = art.palette[key];
      if (!color) throw new Error(`Pixel art palette is missing "${key}"`);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });

  return new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'nearest' }) });
}
