import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { PlayerProfile, ServerMessage } from '@skyline/game-core';
import { createApp, type App } from '../app';
import { openDatabase } from '../db/database';
import { Repository } from '../db/repository';

const ORIGIN = 'http://localhost:3000';
let app: App;
let base: string;

beforeAll(async () => {
  app = createApp({ WEB_ORIGINS: [ORIGIN] }, new Repository(openDatabase(':memory:')));
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  base = `127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});

afterAll(() => app.close());

async function api<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: T }> {
  const res = await fetch(`http://${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
  });
  return { status: res.status, body: (await res.json()) as T };
}

function connect(): Promise<{
  ws: WebSocket;
  next: (t: ServerMessage['t']) => Promise<ServerMessage>;
}> {
  const ws = new WebSocket(`ws://${base}/ws`, { origin: ORIGIN });
  const queue: ServerMessage[] = [];
  const waiters: { t: string; resolve: (m: ServerMessage) => void }[] = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString()) as ServerMessage;
    const i = waiters.findIndex((w) => w.t === msg.t);
    if (i >= 0) waiters.splice(i, 1)[0]?.resolve(msg);
    else queue.push(msg);
  });
  const next = (t: ServerMessage['t']) =>
    new Promise<ServerMessage>((resolve) => {
      const i = queue.findIndex((m) => m.t === t);
      if (i >= 0) resolve(queue.splice(i, 1)[0] as ServerMessage);
      else waiters.push({ t, resolve });
    });
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve({ ws, next }));
    ws.once('error', reject);
  });
}

describe('HTTP API', () => {
  it('registers, authenticates, and enforces auth + validation', async () => {
    const created = await api<{ token: string; profile: PlayerProfile }>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ callsign: 'Viper' }),
    });
    expect(created.status).toBe(201);

    const me = await api<PlayerProfile>('/api/me', { token: created.body.token });
    expect(me.body.callsign).toBe('Viper');

    expect((await api('/api/me')).status).toBe(401);
    expect(
      (await api('/api/players', { method: 'POST', body: JSON.stringify({ callsign: 'x' }) }))
        .status,
    ).toBe(400);
    const broke = await api('/api/market/purchase', {
      method: 'POST',
      token: created.body.token,
      body: JSON.stringify({ itemId: 'weapon:nova_launcher' }),
    });
    expect(broke.status).toBe(402);
  });

  it('only reflects allowed CORS origins', async () => {
    const res = await fetch(`http://${base}/api/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('WebSocket rooms', () => {
  it('joins a private bot match and streams snapshots with acks', async () => {
    const { body } = await api<{ token: string }>('/api/players', {
      method: 'POST',
      body: JSON.stringify({ callsign: 'Netrunner' }),
    });
    const { ws, next } = await connect();
    ws.send(JSON.stringify({ t: 'hello', token: body.token }));
    expect((await next('welcome')).t).toBe('welcome');

    ws.send(
      JSON.stringify({
        t: 'join',
        kind: 'create',
        mode: 'tdm',
        arena: 'foundry',
        bots: 3,
        difficulty: 'easy',
      }),
    );
    const joined = await next('joined');
    if (joined.t !== 'joined') throw new Error('expected joined');
    expect(joined.room.code).toMatch(/^[A-Z2-9]{5}$/);

    const roster = await next('roster');
    if (roster.t !== 'roster') throw new Error('expected roster');
    expect(roster.players.filter((p) => p.bot)).toHaveLength(3);

    ws.send(
      JSON.stringify({
        t: 'input',
        seq: 1,
        mx: 1,
        my: 0,
        aim: 0,
        fire: false,
        dash: false,
        swap: false,
        reload: false,
      }),
    );
    let snap = await next('snap');
    while (snap.t === 'snap' && snap.ack < 1) snap = await next('snap');
    if (snap.t !== 'snap') throw new Error('expected snap');
    expect(snap.players).toHaveLength(4);
    ws.close();
  });

  it('rejects unauthenticated sockets and foreign origins', async () => {
    const { ws, next } = await connect();
    ws.send(JSON.stringify({ t: 'hello', token: 'x'.repeat(43) }));
    expect(await next('error')).toMatchObject({ code: 'UNAUTHORIZED' });

    const foreign = new WebSocket(`ws://${base}/ws`, { origin: 'https://evil.example' });
    await expect(new Promise((_, reject) => foreign.once('error', reject))).rejects.toThrow();
  });
});
