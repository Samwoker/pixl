import { calculateRewards, MISSION_TUNING, type MissionResult } from '@skyline/game-core';
import type { MissionEnd } from '../types';
import type { MissionWorld } from '../world/MissionWorld';

const DEATH_DEBRIEF_DELAY_SEC = 1.6;
const EXTRACT_DEBRIEF_DELAY_SEC = 0.9;

export class MissionSystem {
  private holdSec = 0;
  private endTimer = -1;
  private extracted = false;
  private finished = false;

  constructor(
    private readonly world: MissionWorld,
    private readonly onEnd: (end: MissionEnd) => void,
  ) {}

  get inExtractionZone(): boolean {
    return this.world.extraction.contains(this.world.player);
  }

  get extractionSecondsLeft(): number {
    return Math.max(0, MISSION_TUNING.extractionHoldSec - this.holdSec);
  }

  update(dt: number): void {
    const { world } = this;
    if (this.finished) return;

    if (this.endTimer >= 0) {
      this.endTimer -= dt;
      if (this.endTimer < 0) this.finish();
      return;
    }

    world.stats.elapsedSec += dt;
    const { player, extraction, events } = world;

    if (!player.alive) {
      world.ended = true;
      this.endTimer = DEATH_DEBRIEF_DELAY_SEC;
      return;
    }

    if (extraction.contains(player)) {
      if (this.holdSec === 0) events.emit('extractionStarted', { x: player.x, y: player.y });
      this.holdSec += dt;
      if (this.holdSec >= MISSION_TUNING.extractionHoldSec) {
        this.extracted = true;
        world.ended = true;
        this.endTimer = EXTRACT_DEBRIEF_DELAY_SEC;
        player.hidden = true;
        events.emit('extracted', { x: player.x, y: player.y });
      }
    } else {
      // Leaving the pad resets the countdown — committing to extraction is the risk.
      this.holdSec = 0;
    }
    extraction.progress = Math.min(1, this.holdSec / MISSION_TUNING.extractionHoldSec);
  }

  private finish(): void {
    this.finished = true;
    const { spec, stats } = this.world;
    const result: MissionResult = {
      missionId: spec.missionId,
      seed: spec.seed,
      zone: spec.zone,
      durationSec: Math.round(stats.elapsedSec * 10) / 10,
      extracted: this.extracted,
      enemiesKilled: stats.kills,
      damageTaken: Math.round(stats.damageTaken),
      shotsFired: stats.shotsFired,
      items: { ...stats.items },
    };
    this.onEnd({ result, rewards: calculateRewards(result) });
  }
}
