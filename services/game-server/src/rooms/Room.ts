import { randomInt, randomUUID } from 'node:crypto';
import {
  ARENA_TUNING,
  arenaRewards,
  ArenaSimulation,
  BotBrain,
  botName,
  DRONE_COLORS,
  DRONE_DESIGNS,
  Rng,
  type ArenaId,
  type ArenaInput,
  type ArenaMode,
  type BotDifficulty,
  type ColorId,
  type DesignId,
  type Loadout,
  type PlayerResult,
  type RoomInfo,
  type ServerMessage,
  type TeamId,
  type WeaponId,
} from '@skyline/game-core';
import type { Repository } from '../db/repository';
import { log } from '../logger';

export interface ClientConnection {
  playerId: string;
  callsign: string;
  room: Room | null;
  send(message: ServerMessage): void;
  sendRaw(payload: string): void;
}

export interface RoomOptions {
  mode: ArenaMode;
  arena: ArenaId;
  isPrivate: boolean;
  /** Public rooms keep this many drones total by adding/removing bots. */
  fillTo: number;
  bots: number;
  difficulty: BotDifficulty;
}

const BOT_WEAPONS: Record<BotDifficulty, WeaponId[]> = {
  easy: ['pulse_pistol', 'storm_smg'],
  normal: ['storm_smg', 'scatter_gun', 'volt_rifle'],
  hard: ['volt_rifle', 'rail_sniper', 'scatter_gun', 'nova_launcher'],
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function roomCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export class Room {
  readonly id = randomUUID();
  readonly info: RoomInfo;
  readonly sim: ArenaSimulation;
  readonly clients = new Map<string, ClientConnection>();
  private readonly rng = new Rng(randomInt(1, 2 ** 31));
  private readonly timer: NodeJS.Timeout;
  private botCount = 0;
  private ended = false;
  disposed = false;

  constructor(
    code: string,
    private readonly options: RoomOptions,
    private readonly repo: Repository,
    private readonly onDispose: (room: Room) => void,
  ) {
    this.sim = new ArenaSimulation({
      arena: options.arena,
      mode: options.mode,
      seed: randomInt(1, 2 ** 31),
    });
    this.info = {
      id: this.id,
      code,
      mode: options.mode,
      arena: options.arena,
      private: options.isPrivate,
      timeLimitSec: this.sim.timeLimitSec,
      scoreLimit: this.sim.scoreLimit,
    };
    for (let i = 0; i < options.bots; i++) this.addBot();
    this.timer = setInterval(() => this.tick(), 1000 / ARENA_TUNING.tickRate);
  }

  get humans(): number {
    return this.clients.size;
  }

  get bots(): number {
    return this.botCount;
  }

  get joinable(): boolean {
    return !this.ended && !this.disposed && this.humans < ARENA_TUNING.maxPlayers;
  }

  addClient(client: ClientConnection, loadout: Loadout): void {
    if (this.sim.players.size >= ARENA_TUNING.maxPlayers) this.removeBot(null);
    this.clients.set(client.playerId, client);
    client.room = this;
    this.sim.addPlayer({
      id: client.playerId,
      name: client.callsign,
      bot: false,
      team: this.nextTeam(),
      loadout,
    });
    this.rebalanceBots();
    client.send({ t: 'joined', room: this.info, you: client.playerId });
    this.broadcastRoster();
    log('info', 'room.join', {
      room: this.info.code,
      playerId: client.playerId,
      humans: this.humans,
    });
  }

  removeClient(playerId: string): void {
    const client = this.clients.get(playerId);
    if (!client) return;
    this.clients.delete(playerId);
    client.room = null;
    // Leaving mid-match still pays for what was earned so far.
    if (!this.ended) {
      const result = this.sim.results().find((r) => r.id === playerId);
      if (result) this.persist({ ...result, won: false });
    }
    this.sim.removePlayer(playerId);
    log('info', 'room.leave', { room: this.info.code, playerId, humans: this.humans });
    if (this.humans === 0) {
      this.dispose();
      return;
    }
    this.rebalanceBots();
    this.broadcastRoster();
  }

  queueInput(playerId: string, input: ArenaInput): void {
    if (!this.ended) this.sim.queueInput(playerId, input);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.timer);
    for (const client of this.clients.values()) client.room = null;
    this.clients.clear();
    this.onDispose(this);
  }

  private tick(): void {
    if (this.ended) return;
    this.sim.step();
    const snapshot = this.sim.snapshot();
    const body = JSON.stringify(snapshot).slice(1);
    for (const client of this.clients.values()) {
      const ack = this.sim.players.get(client.playerId)?.lastSeq ?? 0;
      client.sendRaw(`{"t":"snap","ack":${ack},${body}`);
    }
    if (this.sim.finished) this.end();
  }

  private end(): void {
    this.ended = true;
    clearInterval(this.timer);
    const results = this.sim.results();
    const teamScores = this.sim.teamScores();
    for (const client of this.clients.values()) {
      const result = results.find((r) => r.id === client.playerId);
      const rewards = result ? this.persist(result) : null;
      client.send({ t: 'end', results, teamScores, rewards });
    }
    log('info', 'room.end', { room: this.info.code, humans: this.humans, teamScores });
    setTimeout(() => this.dispose(), ARENA_TUNING.resultsHoldSec * 1000).unref();
  }

  private persist(result: PlayerResult) {
    const rewards = arenaRewards(result, this.sim.time);
    try {
      this.repo.recordArenaResult(
        this.id,
        result.id,
        { mode: this.info.mode, arena: this.info.arena },
        result,
        rewards,
      );
    } catch (err) {
      log('error', 'room.persist_failed', {
        room: this.info.code,
        playerId: result.id,
        err: String(err),
      });
    }
    return rewards;
  }

  private nextTeam(): TeamId | null {
    if (this.info.mode !== 'tdm') return null;
    const counts = this.teamCounts();
    return counts[0] <= counts[1] ? 0 : 1;
  }

  private teamCounts(): [number, number] {
    const counts: [number, number] = [0, 0];
    for (const p of this.sim.players.values()) if (p.team !== null) counts[p.team]++;
    return counts;
  }

  private rebalanceBots(): void {
    if (this.options.isPrivate) return;
    const target = Math.max(this.options.fillTo, this.humans);
    while (this.sim.players.size > target && this.botCount > 0) this.removeBot(this.largerTeam());
    while (this.sim.players.size < target) this.addBot();
    this.broadcastRoster();
  }

  private largerTeam(): TeamId | null {
    if (this.info.mode !== 'tdm') return null;
    const [a, b] = this.teamCounts();
    return a >= b ? 0 : 1;
  }

  private addBot(): void {
    const taken = new Set([...this.sim.players.values()].map((p) => p.name));
    const difficulty = this.options.difficulty;
    const primary = this.rng.pick(BOT_WEAPONS[difficulty]);
    const id = `bot_${randomUUID().slice(0, 8)}`;
    this.sim.addPlayer({
      id,
      name: botName(this.rng, taken),
      bot: true,
      team: this.nextTeam(),
      loadout: {
        primary,
        secondary: 'pulse_pistol',
        levels: {},
        cosmetics: {
          design: this.rng.pick(Object.keys(DRONE_DESIGNS) as DesignId[]),
          color: this.rng.pick(Object.keys(DRONE_COLORS) as ColorId[]),
        },
      },
      think: new BotBrain(difficulty, this.rng).think,
    });
    this.botCount++;
  }

  private removeBot(team: TeamId | null): void {
    const bots = [...this.sim.players.values()].filter((p) => p.bot);
    const victim = bots.find((p) => team === null || p.team === team) ?? bots[0];
    if (!victim) return;
    this.sim.removePlayer(victim.id);
    this.botCount--;
  }

  private broadcastRoster(): void {
    const message: ServerMessage = { t: 'roster', players: this.sim.roster() };
    for (const client of this.clients.values()) client.send(message);
  }
}
