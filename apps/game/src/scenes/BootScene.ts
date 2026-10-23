import { Container, Text } from 'pixi.js';
import type { AssetManager } from '../engine/AssetManager';
import type { Scene } from '../engine/SceneManager';

/** Generates textures, then hands off. Exists so later phases can stream real assets here. */
export class BootScene implements Scene {
  readonly container = new Container();
  private readonly label: Text;
  private done = false;

  constructor(
    private readonly assets: AssetManager,
    private readonly onReady: () => void,
  ) {
    this.label = new Text({
      text: 'BOOTING DRONE…',
      style: {
        fontFamily: 'ui-monospace, monospace',
        fontSize: 14,
        fill: 0x5fe3ff,
        letterSpacing: 3,
      },
      anchor: 0.5,
    });
    this.container.addChild(this.label);
  }

  update(): void {
    if (this.done) return;
    this.done = true;
    this.assets.load();
    this.onReady();
  }

  render(): void {}

  resize(width: number, height: number): void {
    this.label.position.set(width / 2, height / 2);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
