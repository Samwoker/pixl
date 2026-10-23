import { ITEMS, itemValue } from './config';
import type { ItemId, MissionResult, MissionRewards } from './types';

export const SCORING = {
  killBonusPerZone: 25,
  extractionBonusPerZone: 250,
  damagePenaltyPerPoint: 2,
  failedXpPerKill: 5,
} as const;

export function lootValueOf(result: Pick<MissionResult, 'items' | 'zone'>): number {
  let total = 0;
  for (const [itemId, count] of Object.entries(result.items) as [ItemId, number][]) {
    if (!(itemId in ITEMS)) continue;
    total += itemValue(itemId, result.zone) * count;
  }
  return total;
}

/** Single source of truth for rewards; the backend must run this, never trust client totals. */
export function calculateRewards(result: MissionResult): MissionRewards {
  const killBonus = result.enemiesKilled * SCORING.killBonusPerZone * result.zone;
  const damagePenalty = Math.round(result.damageTaken * SCORING.damagePenaltyPerPoint);

  if (!result.extracted) {
    return {
      lootValue: 0,
      killBonus: 0,
      extractionBonus: 0,
      damagePenalty: 0,
      score: 0,
      credits: 0,
      xp: result.enemiesKilled * SCORING.failedXpPerKill,
    };
  }

  const lootValue = lootValueOf(result);
  const extractionBonus = SCORING.extractionBonusPerZone * result.zone;
  const score = Math.max(0, lootValue + killBonus + extractionBonus - damagePenalty);
  return {
    lootValue,
    killBonus,
    extractionBonus,
    damagePenalty,
    score,
    credits: lootValue,
    xp: Math.round(score / 10),
  };
}
