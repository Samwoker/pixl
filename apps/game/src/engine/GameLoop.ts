import type { Ticker } from 'pixi.js';
import { RENDER } from '../config/gameConfig';

/** Fixed-timestep simulation on top of Pixi's variable-rate ticker. */
export class GameLoop {
  paused = false;
  private accumulator = 0;
  private running = false;

  constructor(
    private readonly ticker: Ticker,
    private readonly onStep: (dt: number) => void,
    private readonly onFrame: (frameDt: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.ticker.add(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.ticker.remove(this.tick);
  }

  private readonly tick = (ticker: Ticker): void => {
    // Clamp so a backgrounded tab doesn't trigger a spiral of catch-up steps.
    const frameDt = Math.min(ticker.deltaMS / 1000, 0.25);
    if (!this.paused) {
      this.accumulator += frameDt;
      let steps = 0;
      while (this.accumulator >= RENDER.fixedStepSec && steps < RENDER.maxStepsPerFrame) {
        this.onStep(RENDER.fixedStepSec);
        this.accumulator -= RENDER.fixedStepSec;
        steps++;
      }
      if (steps === RENDER.maxStepsPerFrame) this.accumulator = 0;
    }
    this.onFrame(this.paused ? 0 : frameDt);
  };
}
