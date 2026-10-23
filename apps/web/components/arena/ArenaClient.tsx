'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArenaHud, Game } from '@skyline/game';
import { ArenaConnection } from '@skyline/game/net';
import type { JoinRequest, MatchRewards, PlayerResult } from '@skyline/game-core';
import { wsUrl } from '@/lib/api';
import { useSession } from '@/lib/session';
import { CallsignGate } from '../CallsignGate';
import { SiteNav } from '../SiteNav';
import { GameCanvas, type GameConfig } from '../game/GameCanvas';
import { ArenaHudView } from './ArenaHudView';
import { ArenaLobby } from './ArenaLobby';
import { ArenaResults } from './ArenaResults';

type Phase =
  | { kind: 'lobby' }
  | { kind: 'connecting' }
  | { kind: 'playing'; config: Extract<GameConfig, { mode: 'arena' }> }
  | {
      kind: 'results';
      results: PlayerResult[];
      teamScores: [number, number] | null;
      rewards: MatchRewards | null;
      you: string | null;
    };

export function ArenaClient() {
  const { status } = useSession();
  if (status !== 'ready') {
    return (
      <main className="min-h-dvh">
        <SiteNav />
        <CallsignGate reason="Arena matches are online: your callsign shows on the scoreboard and leaderboard, and kills pay credits into your account.">
          {null}
        </CallsignGate>
      </main>
    );
  }
  return <ArenaSession />;
}

function ArenaSession() {
  const { token, refresh } = useSession();
  const [phase, setPhase] = useState<Phase>({ kind: 'lobby' });
  const [error, setError] = useState<string | null>(null);
  const [hud, setHud] = useState<ArenaHud | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [showScores, setShowScores] = useState(false);
  const [muted, setMuted] = useState(false);
  const connectionRef = useRef<ArenaConnection | null>(null);
  const lastRequest = useRef<JoinRequest | null>(null);

  const disconnect = useCallback(() => {
    connectionRef.current?.close();
    connectionRef.current = null;
  }, []);

  useEffect(() => disconnect, [disconnect]);

  const join = useCallback(
    async (request: JoinRequest) => {
      if (!token) return;
      disconnect();
      setError(null);
      setHud(null);
      setPhase({ kind: 'connecting' });
      const connection = new ArenaConnection(wsUrl(), token);
      connectionRef.current = connection;
      try {
        await connection.connect();
        const room = await connection.join(request);
        // Quick matches pin to the room actually joined, so "play again" can't silently switch modes.
        lastRequest.current =
          request.kind === 'quick' ? { ...request, arena: room.arena } : request;
        connection.on('end', (m) => {
          setPhase({
            kind: 'results',
            results: m.results,
            teamScores: m.teamScores,
            rewards: m.rewards,
            you: connection.playerId,
          });
          disconnect();
          void refresh();
        });
        connection.onClose((reason) => {
          if (connectionRef.current !== connection) return;
          setError(reason === 'signed in elsewhere' ? 'You joined from another tab.' : reason);
          setPhase({ kind: 'lobby' });
        });
        setPhase({ kind: 'playing', config: { mode: 'arena', connection } });
      } catch (err) {
        disconnect();
        setError(err instanceof Error ? err.message : 'Could not join.');
        setPhase({ kind: 'lobby' });
      }
    },
    [token, disconnect, refresh],
  );

  const leave = useCallback(() => {
    connectionRef.current?.leave();
    disconnect();
    setPhase({ kind: 'lobby' });
    void refresh();
  }, [disconnect, refresh]);

  const playing = phase.kind === 'playing';
  useEffect(() => {
    if (!playing) return;
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Tab') return;
      e.preventDefault();
      setShowScores(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Tab') setShowScores(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [playing]);

  const handleHud = useCallback((snapshot: ArenaHud) => {
    setHud(snapshot);
    setMuted(snapshot.muted);
  }, []);

  if (phase.kind === 'playing') {
    return (
      <main className="fixed inset-0 bg-ink-950">
        <GameCanvas config={phase.config} muted={muted} onArenaHud={handleHud} onReady={setGame} />
        {hud ? (
          <ArenaHudView hud={hud} showScoreboard={showScores} />
        ) : (
          <p className="absolute inset-0 grid place-items-center text-sm text-ink-400">
            Syncing with server…
          </p>
        )}
        {hud?.menuOpen && (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/75 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="menu-title"
              className="text-center"
            >
              <h2
                id="menu-title"
                className="font-display text-3xl font-bold tracking-[0.2em] text-ink-100"
              >
                MATCH MENU
              </h2>
              <p className="mt-2 text-xs text-ink-400">
                The match keeps running. Your drone is holding still.
              </p>
              {hud.isPrivate && (
                <p className="mt-6 text-sm text-ink-300">
                  Room code{' '}
                  <span className="font-mono text-2xl tracking-[0.3em] text-salvage">
                    {hud.roomCode}
                  </span>
                </p>
              )}
              <div className="mt-8 flex justify-center gap-4">
                <button
                  type="button"
                  autoFocus
                  onClick={() => game?.setPaused(false)}
                  className="bg-signal px-6 py-3 font-display text-sm font-semibold tracking-[0.2em] text-ink-950 hover:bg-signal-soft"
                >
                  RESUME
                </button>
                <button
                  type="button"
                  onClick={() => game?.setMuted(!muted)}
                  className="border border-ink-600 px-6 py-3 font-display text-sm font-semibold tracking-[0.2em] text-ink-100 hover:border-ink-400"
                >
                  {muted ? 'UNMUTE' : 'MUTE'}
                </button>
                <button
                  type="button"
                  onClick={leave}
                  className="border border-ink-600 px-6 py-3 font-display text-sm font-semibold tracking-[0.2em] text-ink-100 hover:border-hazard hover:text-hazard"
                >
                  LEAVE
                </button>
              </div>
              <p className="mt-6 text-xs text-ink-400">
                Leaving keeps the credits you have earned so far, but no win bonus.
              </p>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-dvh">
      <SiteNav />
      {phase.kind === 'results' ? (
        <ArenaResults
          {...phase}
          onPlayAgain={() => lastRequest.current && void join(lastRequest.current)}
          onLobby={() => setPhase({ kind: 'lobby' })}
        />
      ) : phase.kind === 'connecting' ? (
        <p className="px-6 py-24 text-center text-sm text-ink-400">Finding a room…</p>
      ) : (
        <ArenaLobby onJoin={(r) => void join(r)} error={error} />
      )}
    </main>
  );
}
