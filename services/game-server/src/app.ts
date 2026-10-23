import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { z, ZodError } from 'zod';
import type { ServerMessage, ZoneLevel } from '@skyline/game-core';
import { bearerToken } from './auth';
import type { ServerConfig } from './config';
import { DomainError, type DomainErrorCode, type Repository } from './db/repository';
import { log } from './logger';
import { RateLimiter } from './rateLimit';
import { RoomError, RoomManager } from './rooms/RoomManager';
import type { ClientConnection } from './rooms/Room';
import {
  ClientMessageSchema,
  LoadoutBody,
  PurchaseBody,
  RegisterBody,
  SalvageMissionBody,
  SalvageResultBody,
  UpgradeBody,
} from './schemas';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_WS_BUFFER = 1024 * 1024;

const STATUS: Record<DomainErrorCode, number> = {
  CALLSIGN_TAKEN: 409,
  NOT_FOUND: 404,
  UNKNOWN_ITEM: 404,
  ALREADY_OWNED: 409,
  NOT_OWNED: 403,
  INSUFFICIENT_CREDITS: 402,
  MAX_LEVEL: 409,
  INVALID_LOADOUT: 400,
  RESULT_REJECTED: 422,
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface RequestContext {
  url: URL;
  params: string[];
  body: unknown;
  playerId: string;
}

interface Route {
  method: 'GET' | 'POST' | 'PUT';
  path: RegExp;
  auth: boolean;
  handle: (ctx: RequestContext) => [number, unknown];
}

export interface App {
  server: Server;
  rooms: RoomManager;
  close(): Promise<void>;
}

export function createApp(config: Pick<ServerConfig, 'WEB_ORIGINS'>, repo: Repository): App {
  const rooms = new RoomManager(repo);
  const httpLimiter = new RateLimiter(40, 15);
  const signupLimiter = new RateLimiter(5, 5 / 60);
  const connections = new Map<string, WebSocket>();

  const routes: Route[] = [
    { method: 'GET', path: /^\/api\/health$/, auth: false, handle: () => [200, { ok: true }] },
    {
      method: 'POST',
      path: /^\/api\/players$/,
      auth: false,
      handle: ({ body }) => {
        const { callsign } = RegisterBody.parse(body);
        return [201, repo.createPlayer(callsign)];
      },
    },
    {
      method: 'GET',
      path: /^\/api\/me$/,
      auth: true,
      handle: ({ playerId }) => [200, repo.profile(playerId)],
    },
    {
      method: 'POST',
      path: /^\/api\/market\/purchase$/,
      auth: true,
      handle: ({ playerId, body }) => [
        200,
        repo.purchase(playerId, PurchaseBody.parse(body).itemId),
      ],
    },
    {
      method: 'POST',
      path: /^\/api\/market\/upgrade$/,
      auth: true,
      handle: ({ playerId, body }) => [
        200,
        repo.upgradeWeapon(playerId, UpgradeBody.parse(body).weaponId),
      ],
    },
    {
      method: 'PUT',
      path: /^\/api\/loadout$/,
      auth: true,
      handle: ({ playerId, body }) => [200, repo.setLoadout(playerId, LoadoutBody.parse(body))],
    },
    {
      method: 'GET',
      path: /^\/api\/leaderboard$/,
      auth: false,
      handle: ({ url }) => {
        const limit = z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .catch(50)
          .parse(url.searchParams.get('limit') ?? 50);
        return [200, { entries: repo.leaderboard(limit) }];
      },
    },
    {
      method: 'GET',
      path: /^\/api\/rooms$/,
      auth: false,
      handle: () => [200, { rooms: rooms.listPublic() }],
    },
    {
      method: 'POST',
      path: /^\/api\/salvage\/missions$/,
      auth: true,
      handle: ({ playerId, body }) => {
        const { zone } = SalvageMissionBody.parse(body);
        return [201, repo.createSalvageMission(playerId, zone as ZoneLevel)];
      },
    },
    {
      method: 'POST',
      path: /^\/api\/salvage\/missions\/(m_[0-9a-f-]{36})\/result$/,
      auth: true,
      handle: ({ playerId, body, params }) => {
        const { result } = SalvageResultBody.parse(body);
        return [
          200,
          {
            rewards: repo.completeSalvageMission(playerId, params[0] as string, result),
            profile: repo.profile(playerId),
          },
        ];
      },
    },
  ];

  const server = createServer((req, res) => {
    handleHttp(req, res).catch((err: unknown) => {
      log('error', 'http.unhandled', { err: String(err) });
      if (!res.headersSent)
        send(res, 500, { error: { code: 'INTERNAL', message: 'Internal error' } });
    });
  });

  async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = Date.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    applyCors(req, res, config.WEB_ORIGINS);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    const ip = clientIp(req);
    if (!httpLimiter.take(ip))
      return send(res, 429, { error: { code: 'RATE_LIMITED', message: 'Slow down.' } });

    const route = routes.find((r) => r.method === req.method && r.path.test(url.pathname));
    if (!route)
      return send(res, 404, { error: { code: 'NOT_FOUND', message: 'No such endpoint.' } });

    try {
      if (
        route.path.source.includes('players') &&
        req.method === 'POST' &&
        !signupLimiter.take(ip)
      ) {
        throw new HttpError(
          429,
          'RATE_LIMITED',
          'Too many new pilots from this address. Try again later.',
        );
      }
      let playerId = '';
      if (route.auth) {
        const token = bearerToken(req.headers.authorization);
        const id = token ? repo.playerIdForToken(token) : null;
        if (!id) throw new HttpError(401, 'UNAUTHORIZED', 'Sign in again.');
        playerId = id;
      }
      const body = req.method === 'GET' ? undefined : await readJson(req);
      const params = (route.path.exec(url.pathname) ?? []).slice(1);
      const [status, payload] = route.handle({ url, params, body, playerId });
      send(res, status, payload);
    } catch (err) {
      if (err instanceof HttpError)
        send(res, err.status, { error: { code: err.code, message: err.message } });
      else if (err instanceof DomainError)
        send(res, STATUS[err.code], { error: { code: err.code, message: err.message } });
      else if (err instanceof ZodError) {
        send(res, 400, {
          error: { code: 'VALIDATION', message: err.issues[0]?.message ?? 'Invalid request.' },
        });
      } else throw err;
    } finally {
      log('info', 'http.request', {
        method: req.method,
        path: url.pathname,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    }
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const origin = req.headers.origin;
    if (url.pathname !== '/ws' || (origin && !config.WEB_ORIGINS.includes(origin))) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => onSocket(ws, clientIp(req)));
  });

  function onSocket(ws: WebSocket, ip: string): void {
    let conn: ClientConnection | null = null;
    const limiter = new RateLimiter(120, 90);
    const helloTimer = setTimeout(() => ws.close(4001, 'hello timeout'), 5000);
    const sendRaw = (payload: string) => {
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < MAX_WS_BUFFER) ws.send(payload);
    };
    const reply = (message: ServerMessage) => sendRaw(JSON.stringify(message));

    ws.on('message', (data) => {
      if (!limiter.take('m')) return;
      let raw: unknown;
      try {
        raw = JSON.parse(data.toString());
      } catch {
        return reply({ t: 'error', code: 'BAD_MESSAGE', message: 'Malformed JSON.' });
      }
      const parsed = ClientMessageSchema.safeParse(raw);
      if (!parsed.success)
        return reply({ t: 'error', code: 'BAD_MESSAGE', message: 'Invalid message.' });
      const msg = parsed.data;

      if (msg.t === 'hello') {
        if (conn) return;
        const playerId = repo.playerIdForToken(msg.token);
        if (!playerId) {
          reply({ t: 'error', code: 'UNAUTHORIZED', message: 'Unknown pilot token.' });
          ws.close(4003, 'unauthorized');
          return;
        }
        clearTimeout(helloTimer);
        connections.get(playerId)?.close(4009, 'signed in elsewhere');
        connections.set(playerId, ws);
        const profile = repo.profile(playerId);
        conn = { playerId, callsign: profile.callsign, room: null, send: reply, sendRaw };
        reply({ t: 'welcome', playerId, callsign: profile.callsign });
        log('info', 'ws.hello', { playerId, ip });
        return;
      }
      if (!conn) return reply({ t: 'error', code: 'UNAUTHORIZED', message: 'Say hello first.' });

      switch (msg.t) {
        case 'join': {
          try {
            const { t: _t, ...request } = msg;
            rooms.join(conn, request);
          } catch (err) {
            if (err instanceof RoomError)
              reply({ t: 'error', code: err.code, message: err.message });
            else throw err;
          }
          return;
        }
        case 'input': {
          const { t: _t, ...input } = msg;
          conn.room?.queueInput(conn.playerId, input);
          return;
        }
        case 'leave':
          conn.room?.removeClient(conn.playerId);
          return;
        case 'ping':
          reply({ t: 'pong', c: msg.c, s: Date.now() });
          return;
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (!conn) return;
      conn.room?.removeClient(conn.playerId);
      if (connections.get(conn.playerId) === ws) connections.delete(conn.playerId);
    });
    ws.on('error', (err) => log('warn', 'ws.error', { err: String(err) }));
  }

  return {
    server,
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        rooms.shutdown();
        for (const ws of wss.clients) ws.terminate();
        wss.close();
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function applyCors(req: IncomingMessage, res: ServerResponse, allowed: string[]): void {
  const origin = req.headers.origin;
  if (!origin || !allowed.includes(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '600');
}

function clientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown';
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'TOO_LARGE', 'Request body too large.');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'BAD_JSON', 'Body must be valid JSON.');
  }
}
