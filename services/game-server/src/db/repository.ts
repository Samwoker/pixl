import { randomInt, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  calculateRewards,
  DRONE_COLORS,
  DRONE_DESIGNS,
  findMarketItem,
  generateMap,
  isColorId,
  isDesignId,
  isWeaponId,
  levelFromXp,
  MAX_WEAPON_LEVEL,
  STARTER_ITEMS,
  validateMissionResult,
  weaponUpgradeCost,
  WEAPONS,
  type ArenaId,
  type ArenaMode,
  type EquippedLoadout,
  type LeaderboardEntry,
  type Loadout,
  type MarketItemId,
  type MatchRewards,
  type MissionResult,
  type MissionRewards,
  type MissionSpec,
  type PlayerProfile,
  type PlayerResult,
  type WeaponId,
  type ZoneLevel,
} from '@skyline/game-core';
import { createToken, hashToken } from '../auth';

export type DomainErrorCode =
  | 'CALLSIGN_TAKEN'
  | 'NOT_FOUND'
  | 'UNKNOWN_ITEM'
  | 'ALREADY_OWNED'
  | 'NOT_OWNED'
  | 'INSUFFICIENT_CREDITS'
  | 'MAX_LEVEL'
  | 'INVALID_LOADOUT'
  | 'RESULT_REJECTED';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const DEFAULT_LOADOUT: EquippedLoadout = {
  primary: 'pulse_pistol',
  secondary: 'pulse_pistol',
  design: 'quad',
  color: 'signal',
};

/** Credits every new pilot starts with: enough for a first cheap purchase. */
export const STARTING_CREDITS = 500;

interface PlayerRow {
  id: string;
  callsign: string;
  credits: number;
  xp: number;
}

export class Repository {
  constructor(private readonly db: DatabaseSync) {}

  createPlayer(callsign: string): { token: string; profile: PlayerProfile } {
    const { token, hash } = createToken();
    const id = randomUUID();
    try {
      this.tx(() => {
        this.db
          .prepare('INSERT INTO players (id, callsign, token_hash, credits) VALUES (?, ?, ?, ?)')
          .run(id, callsign, hash, STARTING_CREDITS);
        this.db.prepare('INSERT INTO player_stats (player_id) VALUES (?)').run(id);
        this.db
          .prepare(
            'INSERT INTO loadouts (player_id, primary_weapon, secondary_weapon, design, color) VALUES (?, ?, ?, ?, ?)',
          )
          .run(
            id,
            DEFAULT_LOADOUT.primary,
            DEFAULT_LOADOUT.secondary,
            DEFAULT_LOADOUT.design,
            DEFAULT_LOADOUT.color,
          );
        this.ledger(id, 'signup_bonus', null, STARTING_CREDITS);
      });
    } catch (err) {
      if (err instanceof Error && /UNIQUE constraint failed: players\.callsign/.test(err.message)) {
        throw new DomainError('CALLSIGN_TAKEN', 'That callsign is already taken.');
      }
      throw err;
    }
    return { token, profile: this.profile(id) };
  }

  playerIdForToken(token: string): string | null {
    const row = this.db
      .prepare('SELECT id FROM players WHERE token_hash = ?')
      .get(hashToken(token)) as { id: string } | undefined;
    return row?.id ?? null;
  }

  profile(playerId: string): PlayerProfile {
    const player = this.player(playerId);
    const stats = this.db
      .prepare(
        `SELECT matches, wins, kills, deaths, rating, best_streak AS bestStreak,
                salvage_runs AS salvageRuns, salvage_extractions AS salvageExtractions
         FROM player_stats WHERE player_id = ?`,
      )
      .get(playerId) as unknown as PlayerProfile['stats'];
    return {
      id: player.id,
      callsign: player.callsign,
      credits: player.credits,
      xp: player.xp,
      level: levelFromXp(player.xp),
      stats,
      owned: this.owned(playerId),
      loadout: this.equipped(playerId),
    };
  }

  purchase(playerId: string, itemId: string): PlayerProfile {
    const item = findMarketItem(itemId);
    if (!item) throw new DomainError('UNKNOWN_ITEM', 'No such item in the market.');
    this.tx(() => {
      if (this.owned(playerId)[item.id] !== undefined) {
        throw new DomainError('ALREADY_OWNED', `You already own ${item.name}.`);
      }
      this.spend(playerId, item.price, 'purchase', item.id);
      this.db
        .prepare('INSERT INTO owned_items (player_id, item_id, level) VALUES (?, ?, 1)')
        .run(playerId, item.id);
    });
    return this.profile(playerId);
  }

  upgradeWeapon(playerId: string, weaponId: string): PlayerProfile {
    if (!isWeaponId(weaponId)) throw new DomainError('UNKNOWN_ITEM', 'No such weapon.');
    const itemId: MarketItemId = `weapon:${weaponId}`;
    this.tx(() => {
      const level = this.owned(playerId)[itemId];
      if (level === undefined)
        throw new DomainError('NOT_OWNED', `Buy the ${WEAPONS[weaponId].name} first.`);
      const cost = weaponUpgradeCost(weaponId, level);
      if (cost === null || level >= MAX_WEAPON_LEVEL)
        throw new DomainError('MAX_LEVEL', 'Already at max level.');
      this.spend(playerId, cost, 'upgrade', `${itemId}@${level + 1}`);
      // Starter weapons have no row until first upgrade.
      this.db
        .prepare(
          `INSERT INTO owned_items (player_id, item_id, level) VALUES (?, ?, ?)
           ON CONFLICT (player_id, item_id) DO UPDATE SET level = excluded.level`,
        )
        .run(playerId, itemId, level + 1);
    });
    return this.profile(playerId);
  }

  setLoadout(playerId: string, loadout: EquippedLoadout): PlayerProfile {
    const { primary, secondary, design, color } = loadout;
    if (
      !isWeaponId(primary) ||
      !isWeaponId(secondary) ||
      !isDesignId(design) ||
      !isColorId(color)
    ) {
      throw new DomainError('INVALID_LOADOUT', 'Unknown item in loadout.');
    }
    if (primary === secondary && primary !== 'pulse_pistol') {
      throw new DomainError('INVALID_LOADOUT', 'Primary and secondary must differ.');
    }
    const owned = this.owned(playerId);
    const required: MarketItemId[] = [
      `weapon:${primary}`,
      `weapon:${secondary}`,
      `design:${design}`,
      `color:${color}`,
    ];
    const missing = required.find((id) => owned[id] === undefined);
    if (missing)
      throw new DomainError(
        'NOT_OWNED',
        `You don't own ${findMarketItem(missing)?.name ?? missing}.`,
      );
    this.db
      .prepare(
        'UPDATE loadouts SET primary_weapon = ?, secondary_weapon = ?, design = ?, color = ? WHERE player_id = ?',
      )
      .run(primary, secondary, design, color, playerId);
    return this.profile(playerId);
  }

  /** Server-side loadout used when a player joins a match; the client never supplies weapon stats. */
  arenaLoadout(playerId: string): Loadout {
    const equipped = this.equipped(playerId);
    const owned = this.owned(playerId);
    const levels: Partial<Record<WeaponId, number>> = {};
    for (const w of [equipped.primary, equipped.secondary]) levels[w] = owned[`weapon:${w}`] ?? 1;
    return {
      primary: equipped.primary,
      secondary: equipped.secondary,
      levels,
      cosmetics: { design: equipped.design, color: equipped.color },
    };
  }

  /** Idempotent per (match, player): replays of the same result never pay twice. */
  recordArenaResult(
    matchId: string,
    playerId: string,
    meta: { mode: ArenaMode; arena: ArenaId },
    result: PlayerResult,
    rewards: MatchRewards,
  ): boolean {
    return this.tx(() => {
      const inserted = this.db
        .prepare(
          `INSERT OR IGNORE INTO match_players (match_id, player_id, mode, arena, kills, deaths, won, credits, rating)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          matchId,
          playerId,
          meta.mode,
          meta.arena,
          result.kills,
          result.deaths,
          result.won ? 1 : 0,
          rewards.credits,
          rewards.rating,
        );
      if (inserted.changes === 0) return false;
      this.db
        .prepare(
          `UPDATE player_stats SET matches = matches + 1, wins = wins + ?, kills = kills + ?, deaths = deaths + ?,
             rating = rating + ?, best_streak = MAX(best_streak, ?) WHERE player_id = ?`,
        )
        .run(
          result.won ? 1 : 0,
          result.kills,
          result.deaths,
          rewards.rating,
          result.bestStreak,
          playerId,
        );
      this.earn(playerId, rewards.credits, rewards.xp, 'arena_match', matchId);
      return true;
    });
  }

  leaderboard(limit: number): LeaderboardEntry[] {
    const rows = this.db
      .prepare(
        `SELECT p.callsign, p.xp, s.rating, s.kills, s.deaths, s.wins, s.matches
         FROM player_stats s JOIN players p ON p.id = s.player_id
         WHERE s.matches > 0
         ORDER BY s.rating DESC, s.kills DESC, p.created_at ASC
         LIMIT ?`,
      )
      .all(limit) as unknown as (Omit<LeaderboardEntry, 'rank' | 'level'> & { xp: number })[];
    return rows.map(({ xp, ...row }, i) => ({ rank: i + 1, level: levelFromXp(xp), ...row }));
  }

  createSalvageMission(playerId: string, zone: ZoneLevel): MissionSpec {
    const spec: MissionSpec = {
      missionId: `m_${randomUUID()}`,
      seed: randomInt(1, 2 ** 32 - 1),
      zone,
    };
    this.db
      .prepare('INSERT INTO salvage_missions (id, player_id, seed, zone) VALUES (?, ?, ?, ?)')
      .run(spec.missionId, playerId, spec.seed, spec.zone);
    return spec;
  }

  /** Validates against the server-issued seed and pays out once; resubmits return the original rewards. */
  completeSalvageMission(
    playerId: string,
    missionId: string,
    result: MissionResult,
  ): MissionRewards {
    return this.tx(() => {
      const row = this.db
        .prepare(
          'SELECT seed, zone, rewards_json FROM salvage_missions WHERE id = ? AND player_id = ?',
        )
        .get(missionId, playerId) as
        { seed: number; zone: ZoneLevel; rewards_json: string | null } | undefined;
      if (!row) throw new DomainError('NOT_FOUND', 'Mission not found.');
      if (row.rewards_json) return JSON.parse(row.rewards_json) as MissionRewards;

      const spec: MissionSpec = { missionId, seed: row.seed, zone: row.zone };
      const verdict = validateMissionResult(result, spec, generateMap(spec));
      if (!verdict.ok) throw new DomainError('RESULT_REJECTED', verdict.reason);

      const rewards = calculateRewards(result);
      this.db
        .prepare(
          "UPDATE salvage_missions SET completed_at = datetime('now'), rewards_json = ? WHERE id = ?",
        )
        .run(JSON.stringify(rewards), missionId);
      this.db
        .prepare(
          `UPDATE player_stats SET salvage_runs = salvage_runs + 1,
             salvage_extractions = salvage_extractions + ? WHERE player_id = ?`,
        )
        .run(result.extracted ? 1 : 0, playerId);
      this.earn(playerId, rewards.credits, rewards.xp, 'salvage', missionId);
      return rewards;
    });
  }

  private player(playerId: string): PlayerRow {
    const row = this.db
      .prepare('SELECT id, callsign, credits, xp FROM players WHERE id = ?')
      .get(playerId) as PlayerRow | undefined;
    if (!row) throw new DomainError('NOT_FOUND', 'Player not found.');
    return row;
  }

  private owned(playerId: string): Partial<Record<MarketItemId, number>> {
    const owned: Partial<Record<MarketItemId, number>> = {};
    for (const id of STARTER_ITEMS) owned[id] = 1;
    const rows = this.db
      .prepare('SELECT item_id, level FROM owned_items WHERE player_id = ?')
      .all(playerId) as {
      item_id: MarketItemId;
      level: number;
    }[];
    for (const row of rows) owned[row.item_id] = row.level;
    return owned;
  }

  private equipped(playerId: string): EquippedLoadout {
    const row = this.db
      .prepare(
        'SELECT primary_weapon AS "primary", secondary_weapon AS secondary, design, color FROM loadouts WHERE player_id = ?',
      )
      .get(playerId) as unknown as EquippedLoadout | undefined;
    if (!row) return DEFAULT_LOADOUT;
    // Guard against catalogue changes leaving stale ids in old rows.
    return {
      primary: isWeaponId(row.primary) ? row.primary : DEFAULT_LOADOUT.primary,
      secondary: isWeaponId(row.secondary) ? row.secondary : DEFAULT_LOADOUT.secondary,
      design: row.design in DRONE_DESIGNS ? row.design : DEFAULT_LOADOUT.design,
      color: row.color in DRONE_COLORS ? row.color : DEFAULT_LOADOUT.color,
    };
  }

  private spend(playerId: string, amount: number, kind: string, ref: string): void {
    if (amount <= 0) return;
    const result = this.db
      .prepare('UPDATE players SET credits = credits - ? WHERE id = ? AND credits >= ?')
      .run(amount, playerId, amount);
    if (result.changes === 0) throw new DomainError('INSUFFICIENT_CREDITS', 'Not enough credits.');
    this.ledger(playerId, kind, ref, -amount);
  }

  private earn(playerId: string, credits: number, xp: number, kind: string, ref: string): void {
    this.db
      .prepare('UPDATE players SET credits = credits + ?, xp = xp + ? WHERE id = ?')
      .run(credits, xp, playerId);
    if (credits > 0) this.ledger(playerId, kind, ref, credits);
  }

  private ledger(playerId: string, kind: string, ref: string | null, amount: number): void {
    this.db
      .prepare('INSERT INTO ledger (player_id, kind, ref, amount) VALUES (?, ?, ?, ?)')
      .run(playerId, kind, ref, amount);
  }

  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.db.exec('COMMIT');
      return value;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}
