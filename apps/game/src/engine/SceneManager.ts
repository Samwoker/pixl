import type { Container } from 'pixi.js';

export interface Scene {
  readonly container: Container;
  /** Fixed-step simulation. */
  update(dt: number): void;
  /** Once per rendered frame, for visuals only. */
  render(frameDt: number): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export class SceneManager {
  private current: Scene | null = null;
  private width = 0;
  private height = 0;

  constructor(private readonly stage: Container) {}

  change(next: Scene): void {
    if (this.current) {
      this.stage.removeChild(this.current.container);
      this.current.destroy();
    }
    this.current = next;
    this.stage.addChild(next.container);
    next.resize(this.width, this.height);
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  render(frameDt: number): void {
    this.current?.render(frameDt);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.current?.resize(width, height);
  }

  destroy(): void {
    if (this.current) {
      this.stage.removeChild(this.current.container);
      this.current.destroy();
      this.current = null;
    }
  }
}
