'use client';

import { useCallback, useState } from 'react';
import type { Game, HudSnapshot, MissionEnd } from '@skyline/game';
import type { MissionSpec, ZoneLevel } from '@skyline/game-core';
import { api } from '@/lib/api';
import { createLocalMission, randomSeed } from '@/lib/mission';
import { useSession } from '@/lib/session';
import { Briefing } from './Briefing';
import { Debrief, type Verdict } from './Debrief';
import { GameCanvas, type GameConfig } from './GameCanvas';
import { Hud } from './Hud';

type SalvageConfig = Extract<GameConfig, { mode: 'salvage' }>;

type Phase =
  | { kind: 'briefing' }
  | { kind: 'playing'; config: SalvageConfig; ranked: boolean }
  | { kind: 'debrief'; mission: MissionSpec; end: MissionEnd; verdict: Verdict };

interface GameClientProps {
  initialSeed: number;
  initialZone: ZoneLevel;
}

export function GameClient({ initialSeed, initialZone }: GameClientProps) {
  const { status, token, profile, setProfile } = useSession();
  const [zone, setZone] = useState<ZoneLevel>(initialZone);
  const [seed, setSeed] = useState(initialSeed);
  const [phase, setPhase] = useState<Phase>({ kind: 'briefing' });
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [muted, setMuted] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ranked = status === 'ready' && token !== null;

  const start = (mission: MissionSpec, isRanked: boolean) => {
    window.history.replaceState(null, '', `?zone=${mission.zone}&seed=${mission.seed}`);
    const cosmetics = profile
      ? { design: profile.loadout.design, color: profile.loadout.color }
      : undefined;
    setHud(null);
    setError(null);
    setPhase({
      kind: 'playing',
      ranked: isRanked,
      config: { mode: 'salvage', mission, cosmetics },
    });
  };

  const launchPractice = (nextZone: ZoneLevel, nextSeed: number) =>
    start(createLocalMission(nextZone, nextSeed), false);

  const launch = async (nextZone: ZoneLevel) => {
    if (!ranked || !token) return launchPractice(nextZone, seed);
    try {
      const mission = await api.createSalvageMission(token, nextZone);
      setSeed(mission.seed);
      start(mission, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get a mission from the server.');
    }
  };

  const handleHud = useCallback((snapshot: HudSnapshot) => {
    setHud(snapshot);
    setMuted(snapshot.muted);
  }, []);

  const submit = useCallback(
    (mission: MissionSpec, end: MissionEnd) => {
      if (!token) return;
      const settle = (verdict: Verdict) =>
        setPhase((p) => (p.kind === 'debrief' && p.mission === mission ? { ...p, verdict } : p));
      api
        .submitSalvageResult(token, end.result)
        .then(({ rewards, profile: updated }) => {
          setProfile(updated);
          settle({ status: 'confirmed', credits: rewards.credits, xp: rewards.xp });
        })
        .catch((err: unknown) =>
          settle({ status: 'rejected', reason: err instanceof Error ? err.message : 'unknown' }),
        );
    },
    [token, setProfile],
  );

  const handleEnd = useCallback(
    (end: MissionEnd) => {
      if (phase.kind !== 'playing') return;
      const mission = phase.config.mission;
      if (phase.ranked) {
        setPhase({ kind: 'debrief', mission, end, verdict: { status: 'pending' } });
        submit(mission, end);
      } else {
        setPhase({
          kind: 'debrief',
          mission,
          end,
          verdict: { status: 'unranked', reason: 'Practice run: nothing was sent to the server.' },
        });
      }
    },
    [phase, submit],
  );

  if (phase.kind === 'briefing') {
    return (
      <Briefing
        zone={zone}
        seed={seed}
        ranked={ranked}
        error={error}
        onZoneChange={setZone}
        onReroll={() => setSeed(randomSeed())}
        onLaunch={() => void launch(zone)}
        onLaunchPractice={() => launchPractice(zone, seed)}
      />
    );
  }

  if (phase.kind === 'debrief') {
    return (
      <Debrief
        mission={phase.mission}
        end={phase.end}
        verdict={phase.verdict}
        onRedeploy={() => void launch(zone)}
        onReplaySeed={() => launchPractice(phase.mission.zone, phase.mission.seed)}
        onBriefing={() => setPhase({ kind: 'briefing' })}
      />
    );
  }

  return (
    <main className="fixed inset-0 bg-ink-950">
      <GameCanvas
        config={phase.config}
        muted={muted}
        onSalvageHud={handleHud}
        onEnd={handleEnd}
        onReady={setGame}
      />
      {hud && <Hud hud={hud} />}
      {hud?.paused && (
        <div className="absolute inset-0 grid place-items-center bg-ink-950/75 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pause-title"
            className="text-center"
          >
            <h2
              id="pause-title"
              className="font-display text-4xl font-bold tracking-[0.2em] text-ink-100"
            >
              PAUSED
            </h2>
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
                onClick={() => setPhase({ kind: 'briefing' })}
                className="border border-ink-600 px-6 py-3 font-display text-sm font-semibold tracking-[0.2em] text-ink-100 hover:border-hazard hover:text-hazard"
              >
                ABORT
              </button>
            </div>
            <p className="mt-6 text-xs text-ink-400">Aborting forfeits everything in the hold.</p>
          </div>
        </div>
      )}
    </main>
  );
}
