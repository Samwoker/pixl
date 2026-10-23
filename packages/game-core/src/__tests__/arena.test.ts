import { describe, expect, it } from 'vitest';
import { ARENA_IDS, arenaIsConnected, buildArena } from '../arena/arenas';
import { BotBrain } from '../arena/bots';
import { DEFAULT_COSMETICS } from '../arena/cosmetics';
import { findMarketItem, STARTER_ITEMS } from '../arena/market';
import type { ArenaInput } from '../arena/movement';
import type { Loadout } from '../arena/protocol';
import { arenaRewards } from '../arena/rewards';
import { ARENA_TUNING, ONE_SHOT_DAMAGE } from '../arena/rules';
import { ArenaSimulation } from '../arena/simulation';
import { weaponStats, weaponUpgradeCost, type WeaponId } from '../arena/weapons';
import { isSolidWorld } from '../map/tiles';
import { Rng } from '../rng';

const loadout = (primary: WeaponId = 'pulse_pistol', level = 1): Loadout => ({
  primary,
  secondary: 'pulse_pistol',
  levels: { [primary]: level },
  cosmetics: DEFAULT_COSMETICS,
});

let seq = 0;
const input = (overrides: Partial<ArenaInput> = {}): ArenaInput => ({
  seq: ++seq,
  mx: 0,
  my: 0,
  aim: 0,
  fire: false,
  dash: false,
  swap: false,
  reload: false,
  ...overrides,
});

/** Two players facing each other across open floor, protection removed. */
function duel(weapon: WeaponId, level = 1) {
  const sim = new ArenaSimulation({ arena: 'rooftop_relay', mode: 'ffa', seed: 3 });
  const a = sim.addPlayer({
    id: 'a',
    name: 'A',
    bot: false,
    team: null,
    loadout: loadout(weapon, level),
  });
  const b = sim.addPlayer({ id: 'b', name: 'B', bot: false, team: null, loadout: loadout() });
  // Row 2 of Rooftop Relay is open floor end to end.
  Object.assign(a, { x: 48 * 6.5, y: 48 * 2.5, protectedFor: 0 });
  Object.assign(b, { x: 48 * 11.5, y: 48 * 2.5, protectedFor: 0 });
  return { sim, a, b };
}

describe('arenas', () => {
  it('ships at least five arenas', () => {
    expect(ARENA_IDS.length).toBeGreaterThanOrEqual(5);
  });

  it.each(ARENA_IDS)('%s has open, connected spawns and pickups for both teams', (id) => {
    const arena = buildArena(id);
    for (const p of [...arena.spawns, ...arena.pickups])
      expect(isSolidWorld(arena, p.x, p.y)).toBe(false);
    expect(arena.spawns.filter((s) => s.team === 0).length).toBeGreaterThanOrEqual(4);
    expect(arena.spawns.filter((s) => s.team === 1).length).toBe(
      arena.spawns.filter((s) => s.team === 0).length,
    );
    expect(arenaIsConnected(arena)).toBe(true);
  });
});

describe('weapons and market', () => {
  it('sniper one-shots at level 1; launcher only once upgraded', () => {
    expect(weaponStats('rail_sniper', 1).damage).toBeGreaterThanOrEqual(ONE_SHOT_DAMAGE);
    expect(weaponStats('nova_launcher', 1).damage).toBeLessThan(ONE_SHOT_DAMAGE);
    expect(weaponStats('nova_launcher', 3).damage).toBeGreaterThanOrEqual(ONE_SHOT_DAMAGE);
  });

  it('caps upgrades at level 3', () => {
    expect(weaponUpgradeCost('storm_smg', 1)).toBeGreaterThan(0);
    expect(weaponUpgradeCost('storm_smg', 3)).toBeNull();
  });

  it('starter items are free and lookups are exact', () => {
    expect(STARTER_ITEMS).toContain('weapon:pulse_pistol');
    expect(STARTER_ITEMS.every((id) => findMarketItem(id)?.price === 0)).toBe(true);
    expect(findMarketItem('weapon:nope')).toBeUndefined();
  });
});

describe('ArenaSimulation', () => {
  it('a level-1 rail sniper kills a full-health drone with one shot', () => {
    const { sim, a, b } = duel('rail_sniper');
    sim.queueInput('a', input({ fire: true }));
    for (let i = 0; i < 10; i++) sim.step();
    expect(b.alive).toBe(false);
    expect(a.kills).toBe(1);
    expect(a.humanKills).toBe(1);
    expect(b.deaths).toBe(1);
  });

  it('pistol needs several hits and shields absorb first', () => {
    const { sim, b } = duel('pulse_pistol');
    sim.queueInput('a', input({ fire: true }));
    for (let i = 0; i < 10; i++) sim.step();
    expect(b.alive).toBe(true);
    expect(b.shield).toBe(ARENA_TUNING.maxShield - 18);
    expect(b.hp).toBe(ARENA_TUNING.maxHp);
  });

  it('walls stop projectiles', () => {
    const { sim, a, b } = duel('rail_sniper');
    // Building occupies x 4..9, y 4..8: put it between the two drones.
    Object.assign(a, { x: 48 * 2.5, y: 48 * 6.5 });
    Object.assign(b, { x: 48 * 11.5, y: 48 * 6.5 });
    sim.queueInput('a', input({ fire: true }));
    for (let i = 0; i < 10; i++) sim.step();
    expect(b.hp).toBe(ARENA_TUNING.maxHp);
    expect(b.shield).toBe(ARENA_TUNING.maxShield);
  });

  it('no friendly fire in team deathmatch', () => {
    const sim = new ArenaSimulation({ arena: 'rooftop_relay', mode: 'tdm', seed: 1 });
    const a = sim.addPlayer({
      id: 'a',
      name: 'A',
      bot: false,
      team: 0,
      loadout: loadout('rail_sniper'),
    });
    const b = sim.addPlayer({ id: 'b', name: 'B', bot: false, team: 0, loadout: loadout() });
    Object.assign(a, { x: 48 * 6.5, y: 48 * 2.5, protectedFor: 0 });
    Object.assign(b, { x: 48 * 11.5, y: 48 * 2.5, protectedFor: 0 });
    sim.queueInput('a', input({ fire: true }));
    for (let i = 0; i < 10; i++) sim.step();
    expect(b.alive).toBe(true);
  });

  it('respawns after the delay with spawn protection', () => {
    const { sim, b } = duel('rail_sniper');
    sim.queueInput('a', input({ fire: true }));
    for (let i = 0; i < 10; i++) sim.step();
    expect(b.alive).toBe(false);
    for (let i = 0; i < ARENA_TUNING.respawnSec * 30 + 2; i++) sim.step();
    expect(b.alive).toBe(true);
    expect(b.protectedFor).toBeGreaterThan(0);
  });

  it('caps processed inputs per tick so flooding cannot speed-hack', () => {
    const { sim, a } = duel('pulse_pistol');
    const startX = a.x;
    for (let i = 0; i < 30; i++) sim.queueInput('a', input({ mx: 1 }));
    sim.step();
    // At most maxInputsPerTick movement steps can apply in one tick.
    expect(a.x - startX).toBeLessThanOrEqual(
      ARENA_TUNING.speed * sim.dt * ARENA_TUNING.maxInputsPerTick + 0.01,
    );
    for (let i = 0; i < 40; i++) sim.step();
    expect(a.lastSeq).toBe(seq);
  });

  it('ends at the score limit and names the winner', () => {
    const { sim, a, b } = duel('rail_sniper');
    const limited = new ArenaSimulation({ arena: 'rooftop_relay', mode: 'ffa', scoreLimit: 1 });
    expect(limited.scoreLimit).toBe(1);
    sim.queueInput('a', input({ fire: true }));
    for (let i = 0; i < 10; i++) sim.step();
    const results = sim.results();
    expect(results[0]?.id).toBe(a.id);
    expect(results[0]?.won).toBe(true);
    expect(results.find((r) => r.id === b.id)?.won).toBe(false);
  });

  it('bots find and fight each other', () => {
    const sim = new ArenaSimulation({
      arena: 'neon_bazaar',
      mode: 'ffa',
      seed: 9,
      timeLimitSec: 90,
    });
    const rng = new Rng(4);
    for (let i = 0; i < 4; i++) {
      const brain = new BotBrain('hard', rng);
      sim.addPlayer({
        id: `bot${i}`,
        name: `B${i}`,
        bot: true,
        team: null,
        loadout: loadout('volt_rifle'),
        think: brain.think,
      });
    }
    while (!sim.finished) sim.step();
    const kills = [...sim.players.values()].reduce((sum, p) => sum + p.kills, 0);
    expect(kills).toBeGreaterThan(0);
  });
});

describe('arenaRewards', () => {
  it('pays more for human kills and wins, never negative rating', () => {
    const base = { id: 'a', name: 'A', bot: false, team: null, score: 0, bestStreak: 0 };
    const human = arenaRewards(
      { ...base, kills: 2, humanKills: 2, botKills: 0, deaths: 0, won: true },
      240,
    );
    const bots = arenaRewards(
      { ...base, kills: 2, humanKills: 0, botKills: 2, deaths: 0, won: false },
      240,
    );
    expect(human.credits).toBeGreaterThan(bots.credits);
    expect(
      arenaRewards({ ...base, kills: 0, humanKills: 0, botKills: 0, deaths: 30, won: false }, 60)
        .rating,
    ).toBe(0);
  });
});
