import type {
  ArenaInput,
  JoinRequest,
  RoomInfo,
  RosterEntry,
  ServerMessage,
} from '@skyline/game-core';

type MessageOf<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;
type Listener<T extends ServerMessage['t']> = (message: MessageOf<T>) => void;

const PING_INTERVAL_MS = 2000;

/** Thin typed wrapper over the arena WebSocket. Framework-free so React and Pixi can share it. */
export class ArenaConnection {
  playerId: string | null = null;
  callsign: string | null = null;
  room: RoomInfo | null = null;
  roster: RosterEntry[] = [];
  rttMs = 0;
  private socket: WebSocket | null = null;
  private readonly listeners = new Map<string, Set<(m: ServerMessage) => void>>();
  private readonly closeListeners = new Set<(reason: string) => void>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUs = false;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  get open(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      const fail = (reason: string) => {
        cleanup();
        reject(new Error(reason));
      };
      const offWelcome = this.on('welcome', (m) => {
        cleanup();
        this.playerId = m.playerId;
        this.callsign = m.callsign;
        this.pingTimer = setInterval(
          () => this.send({ t: 'ping', c: performance.now() }),
          PING_INTERVAL_MS,
        );
        resolve();
      });
      const offError = this.on('error', (m) => fail(m.message));
      const onEarlyClose = () => fail('Could not reach the game server.');
      const cleanup = () => {
        offWelcome();
        offError();
        socket.removeEventListener('close', onEarlyClose);
      };

      socket.addEventListener('open', () => this.send({ t: 'hello', token: this.token }));
      socket.addEventListener('close', onEarlyClose);
      socket.addEventListener('message', (event) => this.dispatch(event.data));
      socket.addEventListener('close', (event) => {
        if (this.pingTimer) clearInterval(this.pingTimer);
        const reason = this.closedByUs ? 'closed' : event.reason || 'Connection lost.';
        for (const listener of this.closeListeners) listener(reason);
      });
    });
  }

  join(request: JoinRequest): Promise<RoomInfo> {
    return new Promise((resolve, reject) => {
      const offJoined = this.on('joined', (m) => {
        offJoined();
        offError();
        resolve(m.room);
      });
      const offError = this.on('error', (m) => {
        offJoined();
        offError();
        reject(new Error(m.message));
      });
      this.send({ t: 'join', ...request });
    });
  }

  sendInput(input: ArenaInput): void {
    this.send({ t: 'input', ...input });
  }

  leave(): void {
    this.send({ t: 'leave' });
    this.room = null;
  }

  close(): void {
    this.closedByUs = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.socket?.close(1000, 'bye');
  }

  on<T extends ServerMessage['t']>(type: T, listener: Listener<T>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const wrapped = listener as (m: ServerMessage) => void;
    set.add(wrapped);
    return () => set.delete(wrapped);
  }

  onClose(listener: (reason: string) => void): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  private send(message: object): void {
    if (this.open) this.socket?.send(JSON.stringify(message));
  }

  private dispatch(data: unknown): void {
    if (typeof data !== 'string') return;
    let message: ServerMessage;
    try {
      message = JSON.parse(data) as ServerMessage;
    } catch {
      return;
    }
    if (message.t === 'joined') this.room = message.room;
    if (message.t === 'roster') this.roster = message.players;
    if (message.t === 'pong') this.rttMs = Math.round(performance.now() - message.c);
    const set = this.listeners.get(message.t);
    if (set) for (const listener of [...set]) listener(message);
  }
}
