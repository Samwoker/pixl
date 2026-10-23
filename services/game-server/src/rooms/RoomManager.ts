import { ARENA_IDS, type JoinRequest, type PublicRoom } from '@skyline/game-core';
import type { Repository } from '../db/repository';
import { Room, roomCode, type ClientConnection, type RoomOptions } from './Room';

const PUBLIC_FILL = 6;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly repo: Repository) {}

  join(client: ClientConnection, request: JoinRequest): Room {
    client.room?.removeClient(client.playerId);
    const room = this.resolve(request);
    room.addClient(client, this.repo.arenaLoadout(client.playerId));
    return room;
  }

  listPublic(): PublicRoom[] {
    return [...this.rooms.values()]
      .filter((r) => !r.info.private && r.joinable)
      .map((r) => ({
        code: r.info.code,
        mode: r.info.mode,
        arena: r.info.arena,
        humans: r.humans,
        bots: r.bots,
        timeLeft: Math.round(r.sim.timeLeft),
      }));
  }

  shutdown(): void {
    for (const room of [...this.rooms.values()]) room.dispose();
  }

  private resolve(request: JoinRequest): Room {
    if (request.kind === 'code') {
      const room = this.rooms.get(request.code);
      if (!room || !room.joinable)
        throw new RoomError('ROOM_NOT_FOUND', 'No open room with that code.');
      return room;
    }
    if (request.kind === 'create') {
      return this.create({
        mode: request.mode,
        arena: request.arena,
        isPrivate: true,
        fillTo: 0,
        bots: request.bots,
        difficulty: request.difficulty,
      });
    }
    const existing = [...this.rooms.values()]
      .filter(
        (r) =>
          !r.info.private &&
          r.joinable &&
          r.info.mode === request.mode &&
          (request.arena === 'any' || r.info.arena === request.arena) &&
          // Don't drop people into a match that's about to end.
          r.sim.timeLeft > 45,
      )
      .sort((a, b) => b.humans - a.humans)[0];
    if (existing) return existing;
    return this.create({
      mode: request.mode,
      arena:
        request.arena === 'any'
          ? (ARENA_IDS[Math.floor(Math.random() * ARENA_IDS.length)] ?? 'rooftop_relay')
          : request.arena,
      isPrivate: false,
      fillTo: PUBLIC_FILL,
      bots: 0,
      difficulty: 'normal',
    });
  }

  private create(options: RoomOptions): Room {
    let code = roomCode();
    while (this.rooms.has(code)) code = roomCode();
    const room = new Room(code, options, this.repo, (r) => this.rooms.delete(r.info.code));
    this.rooms.set(code, room);
    return room;
  }
}

export class RoomError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
