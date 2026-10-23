import { Application } from 'pixi.js';
import { BASE_DRONE_STATS, DEFAULT_COSMETICS } from '@skyline/game-core';
import { AudioManager } from '../audio/AudioManager';
import { RENDER } from '../config/gameConfig';
import { Keyboard } from '../input/Keyboard';
import { Mouse } from '../input/Mouse';
import { ArenaScene } from '../scenes/ArenaScene';
import { BootScene } from '../scenes/BootScene';
import { MissionScene } from '../scenes/MissionScene';
import type { GameOptions, MissionEnd } from '../types';
import { AssetManager } from './AssetManager';
import { GameLoop } from './GameLoop';
import { SceneManager } from './SceneManager';

/**
 * Framework-agnostic entry point. React mounts it into a div and only talks to it
 * through options callbacks and the small public API below.
 */
export class Game {
  private app: Application | null = null;
  private scenes: SceneManager | null = null;
  private loop: GameLoop | null = null;
  private keyboard: Keyboard | null = null;
  private mouse: Mouse | null = null;
  private mission: MissionScene | null = null;
  private arena: ArenaScene | null = null;
  private readonly assets = new AssetManager();
  private readonly audio: AudioManager;
  private destroyed = false;
  private mounted = false;
  private paused = false;
  private ended = false;
  private hudElapsedMs = 0;

  constructor(private readonly options: GameOptions) {
    this.audio = new AudioManager(options.muted ?? false);
  }

  async mount(container: HTMLElement): Promise<void> {
    if (this.app) throw new Error('Game already mounted');
    const app = new Application();
    this.app = app;
    await app.init({
      resizeTo: container,
      background: RENDER.background,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      roundPixels: true,
    });
    // React StrictMode can unmount before async init resolves.
    if (this.destroyed) {
      app.destroy({ removeView: true }, { children: true });
      return;
    }

    const canvas = app.canvas;
    canvas.tabIndex = 0;
    canvas.style.outline = 'none';
    canvas.style.cursor = 'crosshair';
    canvas.setAttribute('aria-label', 'Skyline Salvagers game canvas');
    container.appendChild(canvas);

    this.keyboard = new Keyboard(window);
    this.mouse = new Mouse(canvas);
    canvas.addEventListener('pointerdown', this.unlockAudio);
    window.addEventListener('keydown', this.onSystemKey);
    window.addEventListener('keydown', this.unlockAudio, { once: true });

    const scenes = new SceneManager(app.stage);
    this.scenes = scenes;
    scenes.resize(app.screen.width, app.screen.height);
    app.renderer.on('resize', this.onResize);

    scenes.change(new BootScene(this.assets, () => this.startScene()));

    this.loop = new GameLoop(
      app.ticker,
      (dt) => scenes.update(dt),
      (frameDt) => this.onFrame(frameDt),
    );
    this.loop.start();
    this.mounted = true;
    canvas.focus();
  }

  setPaused(paused: boolean): void {
    if (this.ended) return;
    this.paused = paused;
    // Online matches can't be paused; "paused" only opens the menu and neutralises input.
    if (this.loop && this.options.mode === 'salvage') this.loop.paused = paused;
    // Drop inputs captured while paused so they don't fire on resume.
    this.keyboard?.endStep();
    this.emitHud();
    if (!paused) this.app?.canvas.focus();
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
    this.emitHud();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (!this.mounted || !this.app) return;
    window.removeEventListener('keydown', this.onSystemKey);
    window.removeEventListener('keydown', this.unlockAudio);
    this.app.canvas.removeEventListener('pointerdown', this.unlockAudio);
    this.app.renderer.off('resize', this.onResize);
    this.loop?.stop();
    this.scenes?.destroy();
    this.keyboard?.destroy();
    this.mouse?.destroy();
    this.audio.destroy();
    this.app.destroy({ removeView: true }, { children: true });
    this.assets.destroy();
    this.app = null;
  }

  private startScene(): void {
    if (!this.scenes || !this.keyboard || !this.mouse) return;
    const { options } = this;
    if (options.mode === 'arena') {
      const arena = new ArenaScene({
        connection: options.connection,
        assets: this.assets,
        keyboard: this.keyboard,
        mouse: this.mouse,
        audio: this.audio,
        isMenuOpen: () => this.paused,
      });
      this.arena = arena;
      this.scenes.change(arena);
      return;
    }
    const mission = new MissionScene({
      spec: options.mission,
      stats: options.stats ?? BASE_DRONE_STATS,
      cosmetics: options.cosmetics ?? DEFAULT_COSMETICS,
      assets: this.assets,
      keyboard: this.keyboard,
      mouse: this.mouse,
      audio: this.audio,
      onEnd: (end) => this.onMissionEnd(end),
    });
    this.mission = mission;
    this.scenes.change(mission);
  }

  private onMissionEnd(end: MissionEnd): void {
    this.ended = true;
    this.emitHud();
    if (this.options.mode === 'salvage') this.options.onMissionEnd?.(end);
  }

  private onFrame(frameDt: number): void {
    this.scenes?.render(frameDt);
    this.hudElapsedMs += frameDt * 1000;
    if (this.hudElapsedMs >= RENDER.hudIntervalMs) {
      this.hudElapsedMs = 0;
      this.emitHud();
    }
  }

  private emitHud(): void {
    const { options } = this;
    const common = { muted: this.audio.muted };
    if (options.mode === 'salvage') {
      if (this.mission && options.onHud)
        options.onHud({ ...this.mission.hud(), ...common, paused: this.paused });
      return;
    }
    const hud = this.arena?.hud();
    if (hud && options.onHud) options.onHud({ ...hud, ...common, menuOpen: this.paused });
  }

  private readonly onResize = (width: number, height: number): void => {
    this.scenes?.resize(width, height);
  };

  private readonly onSystemKey = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.code === 'Escape' || (event.code === 'KeyP' && this.options.mode === 'salvage')) {
      this.setPaused(!this.paused);
    }
    if (event.code === 'KeyM') this.setMuted(!this.audio.muted);
  };

  private readonly unlockAudio = (): void => {
    this.audio.unlock();
  };
}
