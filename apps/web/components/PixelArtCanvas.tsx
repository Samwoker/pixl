'use client';

import { useEffect, useRef } from 'react';
import type { PixelArt } from '@skyline/game/art';

interface PixelArtCanvasProps {
  art: PixelArt;
  scale: number;
  label: string;
  className?: string;
}

/** Draws the same character-grid sprites the game uses, without loading Pixi. */
export function PixelArtCanvas({ art, scale, label, className }: PixelArtCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = Math.max(...art.rows.map((r) => r.length));
  const height = art.rows.length;

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width * scale, height * scale);
    art.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = art.palette[row[x] as string];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });
  }, [art, scale, width, height]);

  return (
    <canvas
      ref={ref}
      width={width * scale}
      height={height * scale}
      role="img"
      aria-label={label}
      className={`pixelated ${className ?? ''}`}
    />
  );
}
