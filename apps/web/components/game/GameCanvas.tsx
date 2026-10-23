'use client';

import { useEffect, useRef, useState } from 'react';
import type { ArenaConnection, ArenaHud, Game, HudSnapshot, MissionEnd } from '@skyline/game';
import type { DroneCosmetics, MissionSpec } from '@skyline/game-core';

export type GameConfig =
  | { mode: 'salvage'; mission: MissionSpec; cosmetics?: DroneCosmetics }
  | { mode: 'arena'; connection: ArenaConnection };

interface GameCanvasProps {
  /** A new object identity remounts the game; keep it stable for the life of a match. */
  config: GameConfig;
  muted: boolean;
  onSalvageHud?: (snapshot: HudSnapshot) => void;
  onArenaHud?: (snapshot: ArenaHud) => void;
  onEnd?: (end: MissionEnd) => void;
  onReady: (game: Game | null) => void;
}

/** Owns the Pixi lifecycle. React never renders inside the canvas. */
export function GameCanvas({
  config,
  muted,
  onSalvageHud,
  onArenaHud,
  onEnd,
  onReady,
}: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ muted, onSalvageHud, onArenaHud, onEnd, onReady });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    latest.current = { muted, onSalvageHud, onArenaHud, onEnd, onReady };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let game: Game | null = null;
    let cancelled = false;

    // Dynamic import keeps pixi.js out of the server bundle and off the landing page.
    import('@skyline/game')
      .then(({ Game }) => {
        if (cancelled) return;
        const startMuted = latest.current.muted;
        game =
          config.mode === 'salvage'
            ? new Game({
                mode: 'salvage',
                mission: config.mission,
                cosmetics: config.cosmetics,
                muted: startMuted,
                onHud: (s) => latest.current.onSalvageHud?.(s),
                onMissionEnd: (e) => latest.current.onEnd?.(e),
              })
            : new Game({
                mode: 'arena',
                connection: config.connection,
                muted: startMuted,
                onHud: (s) => latest.current.onArenaHud?.(s),
              });
        return game.mount(host).then(() => {
          if (!cancelled) latest.current.onReady(game);
        });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to start the game renderer.');
      });

    return () => {
      cancelled = true;
      game?.destroy();
      latest.current.onReady(null);
    };
  }, [config]);

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden">
      {error && (
        <div
          role="alert"
          className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-hazard"
        >
          <p>
            Renderer failed to start: {error}
            <br />
            <span className="text-ink-400">WebGL or WebGPU must be available in this browser.</span>
          </p>
        </div>
      )}
    </div>
  );
}
