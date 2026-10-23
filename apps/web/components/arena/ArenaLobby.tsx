'use client';

import { useEffect, useState } from 'react';
import {
  ARENA_IDS,
  ARENA_MODES,
  arenaInfo,
  type ArenaId,
  type ArenaMode,
  type BotDifficulty,
  type JoinRequest,
  type PublicRoom,
} from '@skyline/game-core';
import { api } from '@/lib/api';

type PlayType = 'quick' | 'practice' | 'private' | 'code';

const PLAY_TYPES: { id: PlayType; title: string; detail: string }[] = [
  {
    id: 'quick',
    title: 'Quick match',
    detail: 'Public room. Bots hold empty slots until real pilots join.',
  },
  {
    id: 'practice',
    title: 'Vs machines',
    detail: 'Private room, just you and bots at the difficulty you pick.',
  },
  {
    id: 'private',
    title: 'Private room',
    detail: 'Get a code, send it to friends. Add bots if you are short.',
  },
  { id: 'code', title: 'Join with code', detail: 'A friend already made a room.' },
];

export function ArenaLobby({
  onJoin,
  error,
}: {
  onJoin: (request: JoinRequest) => void;
  error: string | null;
}) {
  const [mode, setMode] = useState<ArenaMode>('tdm');
  const [arena, setArena] = useState<ArenaId | 'any'>('any');
  const [playType, setPlayType] = useState<PlayType>('quick');
  const [bots, setBots] = useState(5);
  const [difficulty, setDifficulty] = useState<BotDifficulty>('normal');
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<PublicRoom[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .rooms()
        .then((r) => alive && setRooms(r.rooms))
        .catch(() => alive && setRooms([]));
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const submit = () => {
    if (playType === 'code') return onJoin({ kind: 'code', code: code.trim().toUpperCase() });
    if (playType === 'quick') return onJoin({ kind: 'quick', mode, arena });
    const fixedArena =
      arena === 'any'
        ? (ARENA_IDS[Math.floor(Math.random() * ARENA_IDS.length)] as ArenaId)
        : arena;
    onJoin({
      kind: 'create',
      mode,
      arena: fixedArena,
      bots: playType === 'practice' ? Math.max(1, bots) : bots,
      difficulty,
    });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-12">
        <div>
          <p className="text-xs tracking-[0.3em] text-hazard">ARENA</p>
          <h1 className="mt-2 font-display text-5xl font-bold text-ink-100">Drop in and fight.</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-300">
            Up to eight drones per room. Kills pay credits and climb the leaderboard. Spend them in
            the hangar on heavier guns, then come back and use them.
          </p>
        </div>

        <fieldset>
          <legend className="text-[10px] tracking-[0.3em] text-ink-400">HOW</legend>
          <div className="mt-3 grid gap-px border border-ink-700 bg-ink-700 sm:grid-cols-2">
            {PLAY_TYPES.map((p) => (
              <label
                key={p.id}
                className={`cursor-pointer p-5 ${playType === p.id ? 'bg-ink-800' : 'bg-ink-950 hover:bg-ink-900'}`}
              >
                <input
                  type="radio"
                  name="playType"
                  className="sr-only"
                  checked={playType === p.id}
                  onChange={() => setPlayType(p.id)}
                />
                <span
                  className={`block font-display text-lg font-semibold ${playType === p.id ? 'text-scan' : 'text-ink-100'}`}
                >
                  {p.title}
                </span>
                <span className="mt-1 block text-xs text-ink-400">{p.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {playType === 'code' ? (
          <div>
            <label htmlFor="room-code" className="text-[10px] tracking-[0.3em] text-ink-400">
              ROOM CODE
            </label>
            <input
              id="room-code"
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 5),
                )
              }
              placeholder="ABCDE"
              autoComplete="off"
              className="mt-3 block w-56 border border-ink-600 bg-ink-900 px-4 py-3 font-mono text-2xl tracking-[0.4em] text-ink-100 outline-none focus:border-scan"
            />
          </div>
        ) : (
          <>
            <fieldset>
              <legend className="text-[10px] tracking-[0.3em] text-ink-400">MODE</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(ARENA_MODES) as ArenaMode[]).map((m) => (
                  <Chip key={m} active={mode === m} onClick={() => setMode(m)}>
                    {ARENA_MODES[m].name}
                    <span className="ml-2 text-ink-400">
                      {ARENA_MODES[m].scoreLimit} {m === 'tdm' ? 'team kills' : 'kills'} ·{' '}
                      {ARENA_MODES[m].timeLimitSec / 60} min
                    </span>
                  </Chip>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[10px] tracking-[0.3em] text-ink-400">ARENA</legend>
              <div className="mt-3 grid gap-px border border-ink-700 bg-ink-700 sm:grid-cols-2 lg:grid-cols-3">
                {(['any', ...ARENA_IDS] as const).map((id) => {
                  const info = id === 'any' ? null : arenaInfo(id);
                  const active = arena === id;
                  return (
                    <label
                      key={id}
                      className={`cursor-pointer p-4 ${active ? 'bg-ink-800' : 'bg-ink-950 hover:bg-ink-900'}`}
                    >
                      <input
                        type="radio"
                        name="arena"
                        className="sr-only"
                        checked={active}
                        onChange={() => setArena(id)}
                      />
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5"
                          style={{
                            background: info
                              ? `#${info.accent.toString(16).padStart(6, '0')}`
                              : 'var(--color-ink-400)',
                          }}
                        />
                        <span
                          className={`font-display font-semibold ${active ? 'text-scan' : 'text-ink-100'}`}
                        >
                          {info?.name ?? 'Any arena'}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-ink-400">
                        {info?.tagline ?? 'Join whatever is running.'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {playType !== 'quick' && (
              <div className="flex flex-wrap gap-10">
                <div>
                  <label htmlFor="bots" className="text-[10px] tracking-[0.3em] text-ink-400">
                    BOTS · {bots}
                  </label>
                  <input
                    id="bots"
                    type="range"
                    min={playType === 'practice' ? 1 : 0}
                    max={7}
                    value={bots}
                    onChange={(e) => setBots(Number(e.target.value))}
                    className="mt-3 block w-56 accent-[var(--color-scan)]"
                  />
                </div>
                <fieldset>
                  <legend className="text-[10px] tracking-[0.3em] text-ink-400">BOT SKILL</legend>
                  <div className="mt-3 flex gap-2">
                    {(['easy', 'normal', 'hard'] as const).map((d) => (
                      <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
                        <span className="capitalize">{d}</span>
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={submit}
            disabled={playType === 'code' && code.length !== 5}
            className="bg-signal px-8 py-4 font-display text-sm font-semibold tracking-[0.2em] text-ink-950 hover:bg-signal-soft disabled:opacity-50"
          >
            {playType === 'code' ? 'JOIN ROOM' : playType === 'private' ? 'CREATE ROOM' : 'DEPLOY'}
          </button>
          {error && (
            <p role="alert" className="text-sm text-hazard">
              {error}
            </p>
          )}
        </div>
      </div>

      <aside className="space-y-8 self-start">
        <div className="border border-ink-700 bg-ink-900/80">
          <h2 className="border-b border-ink-700 px-5 py-3 text-[10px] tracking-[0.3em] text-ink-400">
            LIVE PUBLIC ROOMS
          </h2>
          {rooms.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">
              None right now. Quick match will start one.
            </p>
          ) : (
            <ul>
              {rooms.map((room) => (
                <li
                  key={room.code}
                  className="flex items-center justify-between gap-3 border-b border-ink-800 px-5 py-3 last:border-0"
                >
                  <div className="text-sm">
                    <p className="text-ink-100">{arenaInfo(room.arena).name}</p>
                    <p className="text-xs text-ink-400">
                      {room.mode.toUpperCase()} · {room.humans} pilots · {room.bots} bots ·{' '}
                      {Math.ceil(room.timeLeft / 60)}m left
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJoin({ kind: 'code', code: room.code })}
                    className="border border-ink-600 px-3 py-1.5 text-xs text-ink-100 hover:border-scan hover:text-scan"
                  >
                    Join
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-xs leading-relaxed text-ink-400">
          <p className="mb-2 text-[10px] tracking-[0.3em]">CONTROLS</p>
          WASD fly · mouse aim · click fire · Q or 1/2 swap weapon · R reload · Shift dash · Tab
          scoreboard · Esc menu
        </div>
      </aside>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`border px-4 py-2 text-sm ${active ? 'border-scan text-scan' : 'border-ink-600 text-ink-300 hover:text-ink-100'}`}
    >
      {children}
    </button>
  );
}
