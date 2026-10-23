type Sfx =
  | 'shoot'
  | 'enemyShoot'
  | 'hit'
  | 'hurt'
  | 'explode'
  | 'pickup'
  | 'scan'
  | 'dash'
  | 'alarm'
  | 'extract';

interface Tone {
  type: OscillatorType;
  from: number;
  to: number;
  duration: number;
  volume: number;
  noise?: boolean;
}

const TONES: Record<Sfx, Tone> = {
  shoot: { type: 'square', from: 880, to: 440, duration: 0.06, volume: 0.04 },
  enemyShoot: { type: 'sawtooth', from: 300, to: 180, duration: 0.08, volume: 0.025 },
  hit: { type: 'square', from: 220, to: 120, duration: 0.05, volume: 0.04 },
  hurt: { type: 'sawtooth', from: 160, to: 60, duration: 0.18, volume: 0.08 },
  explode: { type: 'sawtooth', from: 120, to: 30, duration: 0.35, volume: 0.09, noise: true },
  pickup: { type: 'triangle', from: 660, to: 1320, duration: 0.1, volume: 0.06 },
  scan: { type: 'sine', from: 300, to: 1200, duration: 0.45, volume: 0.06 },
  dash: { type: 'triangle', from: 500, to: 200, duration: 0.12, volume: 0.05 },
  alarm: { type: 'square', from: 520, to: 520, duration: 0.5, volume: 0.04 },
  extract: { type: 'triangle', from: 440, to: 1760, duration: 0.8, volume: 0.07 },
};

const MIN_INTERVAL_SEC = 0.045;

/** Synthesised SFX via WebAudio: zero asset downloads in Phase 1. */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<Sfx, number>();
  muted: boolean;

  constructor(muted = false) {
    this.muted = muted;
  }

  /** Must be called from a user gesture to satisfy autoplay policies. */
  unlock(): void {
    if (this.ctx || typeof AudioContext === 'undefined') {
      void this.ctx?.resume();
      return;
    }
    this.ctx = new AudioContext();
    const length = Math.floor(this.ctx.sampleRate * 0.4);
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  play(sfx: Sfx): void {
    const ctx = this.ctx;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(sfx) ?? -1) < MIN_INTERVAL_SEC) return;
    this.lastPlayed.set(sfx, now);

    const tone = TONES[sfx];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(tone.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.from, now);
    osc.frequency.exponentialRampToValueAtTime(tone.to, now + tone.duration);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + tone.duration);

    if (tone.noise && this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.connect(gain);
      noise.start(now);
      noise.stop(now + tone.duration);
    }
  }

  destroy(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
