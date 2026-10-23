import type { MatchRewards, PlayerResult } from './protocol';

export const ARENA_REWARDS = {
  creditsPerHumanKill: 30,
  creditsPerBotKill: 12,
  winCredits: 120,
  maxParticipationCredits: 40,
  xpPerKill: 20,
  winXp: 100,
  ratingPerHumanKill: 100,
  ratingPerBotKill: 40,
  winRating: 250,
  ratingPerDeath: 10,
} as const;

/** Server-only authority: clients never send credits, they only appear here. */
export function arenaRewards(result: PlayerResult, durationSec: number): MatchRewards {
  const r = ARENA_REWARDS;
  const participation = Math.min(r.maxParticipationCredits, Math.floor(durationSec / 6));
  return {
    credits:
      result.humanKills * r.creditsPerHumanKill +
      result.botKills * r.creditsPerBotKill +
      (result.won ? r.winCredits : 0) +
      participation,
    xp: result.kills * r.xpPerKill + (result.won ? r.winXp : 0) + 10,
    rating: Math.max(
      0,
      result.humanKills * r.ratingPerHumanKill +
        result.botKills * r.ratingPerBotKill +
        (result.won ? r.winRating : 0) -
        result.deaths * r.ratingPerDeath,
    ),
  };
}
