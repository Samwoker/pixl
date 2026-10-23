import type { Texture } from 'pixi.js';
import type { DroneCosmetics, EnemyKind, ItemId } from '@skyline/game-core';
import { droneArt, ENEMY_ART, ITEM_ART, PROJECTILE_ART } from '../assets/pixelArt';
import { pixelArtTexture } from '../rendering/SpriteRenderer';

export type TextureKey =
  | `drone:${string}`
  | `enemy:${EnemyKind}`
  | `item:${ItemId}`
  | 'projectile:player'
  | 'projectile:enemy';

/** Owns every generated texture so a single destroy() frees GPU memory on unmount. */
export class AssetManager {
  private readonly textures = new Map<TextureKey, Texture>();

  load(): void {
    if (this.textures.size > 0) return;
    for (const [kind, art] of Object.entries(ENEMY_ART)) {
      this.textures.set(`enemy:${kind as EnemyKind}`, pixelArtTexture(art));
    }
    for (const [id, art] of Object.entries(ITEM_ART)) {
      this.textures.set(`item:${id as ItemId}`, pixelArtTexture(art));
    }
    this.textures.set('projectile:player', pixelArtTexture(PROJECTILE_ART.player));
    this.textures.set('projectile:enemy', pixelArtTexture(PROJECTILE_ART.enemy));
  }

  get(key: TextureKey): Texture {
    const texture = this.textures.get(key);
    if (!texture) throw new Error(`Texture "${key}" not loaded`);
    return texture;
  }

  /** Paint jobs are generated lazily: only combinations actually on screen cost memory. */
  drone({ design, color }: DroneCosmetics): Texture {
    const key: TextureKey = `drone:${design}:${color}`;
    let texture = this.textures.get(key);
    if (!texture) {
      texture = pixelArtTexture(droneArt(design, color));
      this.textures.set(key, texture);
    }
    return texture;
  }

  destroy(): void {
    for (const texture of this.textures.values()) texture.destroy(true);
    this.textures.clear();
  }
}
