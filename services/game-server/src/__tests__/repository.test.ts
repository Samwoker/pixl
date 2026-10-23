import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database';
import { DomainError, Repository, STARTING_CREDITS } from '../db/repository';
import type { PlayerResult } from '@skyline/game-core';

let repo: Repository;
beforeEach(() => {
  repo = new Repository(openDatabase(':memory:'));
});

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    if (err instanceof DomainError) return err.code;
    throw err;
  }
  return 'OK';
};

const result = (id: string, overrides: Partial<PlayerResult> = {}): PlayerResult => ({
  id,
  name: 'x',
  bot: false,
  team: null,
  kills: 3,
  humanKills: 1,
  botKills: 2,
  deaths: 1,
  score: 300,
  bestStreak: 2,
  won: true,
  ...overrides,
});

describe('Repository', () => {
  it('creates pilots with a starter kit and resolves tokens', () => {
    const { token, profile } = repo.createPlayer('Ace_01');
    expect(profile.credits).toBe(STARTING_CREDITS);
    expect(profile.owned['weapon:pulse_pistol']).toBe(1);
    expect(profile.loadout.primary).toBe('pulse_pistol');
    expect(repo.playerIdForToken(token)).toBe(profile.id);
    expect(repo.playerIdForToken('nope')).toBeNull();
  });

  it('rejects duplicate callsigns case-insensitively', () => {
    repo.createPlayer('Ghost');
    expect(code(() => repo.createPlayer('ghost'))).toBe('CALLSIGN_TAKEN');
  });

  it('buys, refuses duplicates and unaffordable items, and never goes negative', () => {
    const { profile } = repo.createPlayer('Buyer');
    const after = repo.purchase(profile.id, 'color:toxic');
    expect(after.credits).toBe(STARTING_CREDITS - 400);
    expect(after.owned['color:toxic']).toBe(1);
    expect(code(() => repo.purchase(profile.id, 'color:toxic'))).toBe('ALREADY_OWNED');
    expect(code(() => repo.purchase(profile.id, 'weapon:rail_sniper'))).toBe(
      'INSUFFICIENT_CREDITS',
    );
    expect(code(() => repo.purchase(profile.id, 'weapon:bfg'))).toBe('UNKNOWN_ITEM');
    expect(repo.profile(profile.id).credits).toBe(STARTING_CREDITS - 400);
  });

  it('upgrades owned weapons up to max level', () => {
    const { profile } = repo.createPlayer('Smith');
    // Pistol upgrade costs 240, then 480.
    expect(repo.upgradeWeapon(profile.id, 'pulse_pistol').owned['weapon:pulse_pistol']).toBe(2);
    expect(code(() => repo.upgradeWeapon(profile.id, 'pulse_pistol'))).toBe('INSUFFICIENT_CREDITS');
    expect(code(() => repo.upgradeWeapon(profile.id, 'storm_smg'))).toBe('NOT_OWNED');
    expect(repo.arenaLoadout(profile.id).levels.pulse_pistol).toBe(2);
  });

  it('only equips owned items', () => {
    const { profile } = repo.createPlayer('Dresser');
    const loadout = {
      primary: 'pulse_pistol',
      secondary: 'pulse_pistol',
      design: 'orb',
      color: 'signal',
    } as const;
    expect(code(() => repo.setLoadout(profile.id, loadout))).toBe('NOT_OWNED');
    expect(
      repo.setLoadout(profile.id, { ...loadout, design: 'quad', color: 'ember' }).loadout.color,
    ).toBe('ember');
  });

  it('records arena results once and ranks the leaderboard', () => {
    const a = repo.createPlayer('Alpha').profile;
    const b = repo.createPlayer('Bravo').profile;
    const rewards = { credits: 100, xp: 50, rating: 400 };
    expect(
      repo.recordArenaResult('m1', a.id, { mode: 'ffa', arena: 'foundry' }, result(a.id), rewards),
    ).toBe(true);
    expect(
      repo.recordArenaResult('m1', a.id, { mode: 'ffa', arena: 'foundry' }, result(a.id), rewards),
    ).toBe(false);
    repo.recordArenaResult(
      'm1',
      b.id,
      { mode: 'ffa', arena: 'foundry' },
      result(b.id, { won: false }),
      {
        credits: 10,
        xp: 5,
        rating: 50,
      },
    );
    expect(repo.profile(a.id).credits).toBe(STARTING_CREDITS + 100);
    expect(repo.profile(a.id).stats).toMatchObject({ matches: 1, wins: 1, kills: 3, rating: 400 });
    expect(repo.leaderboard(10).map((e) => e.callsign)).toEqual(['Alpha', 'Bravo']);
  });

  it('pays validated salvage results once and rejects impossible ones', () => {
    const { profile } = repo.createPlayer('Scav');
    const spec = repo.createSalvageMission(profile.id, 1);
    const honest = {
      ...spec,
      durationSec: 90,
      extracted: true,
      enemiesKilled: 2,
      damageTaken: 10,
      shotsFired: 40,
      items: { energy_cell: 1 },
    };
    const rewards = repo.completeSalvageMission(profile.id, spec.missionId, honest);
    expect(rewards.credits).toBeGreaterThan(0);
    const credits = repo.profile(profile.id).credits;
    expect(repo.completeSalvageMission(profile.id, spec.missionId, honest)).toEqual(rewards);
    expect(repo.profile(profile.id).credits).toBe(credits);

    const cheat = repo.createSalvageMission(profile.id, 1);
    expect(
      code(() =>
        repo.completeSalvageMission(profile.id, cheat.missionId, {
          ...honest,
          ...cheat,
          enemiesKilled: 999,
          shotsFired: 999,
        }),
      ),
    ).toBe('RESULT_REJECTED');
  });
});
