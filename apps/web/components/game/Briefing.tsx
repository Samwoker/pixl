import Link from 'next/link';
import { ZONE_LEVELS, ZONES, type ZoneLevel } from '@skyline/game-core';
import { SiteNav } from '../SiteNav';

interface BriefingProps {
  zone: ZoneLevel;
  seed: number;
  ranked: boolean;
  error: string | null;
  onZoneChange: (zone: ZoneLevel) => void;
  onReroll: () => void;
  onLaunch: () => void;
  onLaunchPractice: () => void;
}

export function Briefing({
  zone,
  seed,
  ranked,
  error,
  onZoneChange,
  onReroll,
  onLaunch,
  onLaunchPractice,
}: BriefingProps) {
  const selected = ZONES[zone];
  return (
    <div className="blueprint min-h-dvh">
      <SiteNav />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_20rem]">
          <section aria-labelledby="zone-picker">
            <h1
              id="zone-picker"
              className="font-display text-4xl font-bold text-ink-100 sm:text-5xl"
            >
              Pick your depth.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-300">
              Deeper zones multiply what salvage is worth and field heavier security. Reinforcements
              arrive every 45 seconds no matter where you are.
            </p>

            <fieldset className="mt-10">
              <legend className="sr-only">Zone</legend>
              <div className="grid gap-px border border-ink-700 bg-ink-700">
                {ZONE_LEVELS.map((level) => {
                  const z = ZONES[level];
                  const active = level === zone;
                  return (
                    <label
                      key={level}
                      className={`grid cursor-pointer grid-cols-[2.5rem_1fr_auto_auto] items-center gap-4 px-5 py-4 transition-colors ${
                        active ? 'bg-ink-800' : 'bg-ink-950 hover:bg-ink-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="zone"
                        value={level}
                        checked={active}
                        onChange={() => onZoneChange(level)}
                        className="sr-only"
                      />
                      <span
                        className={`font-display text-2xl font-bold ${active ? 'text-signal' : 'text-ink-600'}`}
                      >
                        {level}
                      </span>
                      <span>
                        <span className="block font-display text-base font-semibold text-ink-100">
                          {z.name}
                        </span>
                        <span className="text-xs text-ink-400">
                          {z.enemyCount} drones · {z.salvageCount} salvage signals
                        </span>
                      </span>
                      <span className="hidden gap-1 sm:flex" aria-hidden>
                        {ZONE_LEVELS.map((pip) => (
                          <span
                            key={pip}
                            className={`h-1 w-4 ${pip <= level ? 'bg-hazard' : 'bg-ink-700'}`}
                          />
                        ))}
                      </span>
                      <span className="w-14 text-right text-sm tabular-nums text-salvage">
                        ×{z.valueMultiplier}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>

          <aside className="flex flex-col gap-6 self-start border border-ink-700 bg-ink-900/80 p-6">
            <div>
              <p className="text-[10px] tracking-[0.3em] text-ink-400">TARGET</p>
              <p className="mt-1 font-display text-2xl font-semibold text-ink-100">
                {selected.name}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.3em] text-ink-400">MAP SEED</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <code className="text-sm tabular-nums text-scan">{seed}</code>
                <button
                  type="button"
                  onClick={onReroll}
                  className="text-xs text-ink-300 underline-offset-4 hover:text-ink-100 hover:underline"
                >
                  reroll
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-400">
                {ranked
                  ? 'Ranked runs get a fresh server-issued seed. Use this one for unranked practice.'
                  : 'Same seed, same city. Share the URL to race a friend on it.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onLaunch}
              className="bg-signal px-6 py-3.5 font-display text-sm font-semibold tracking-[0.2em] text-ink-950 transition-colors hover:bg-signal-soft"
            >
              {ranked ? 'LAUNCH RANKED' : 'LAUNCH'}
            </button>
            {ranked && (
              <button
                type="button"
                onClick={onLaunchPractice}
                className="border border-ink-600 px-6 py-3 font-display text-xs font-semibold tracking-[0.2em] text-ink-100 hover:border-ink-400"
              >
                PRACTICE THIS SEED
              </button>
            )}
            {error && (
              <p role="alert" className="text-xs text-hazard">
                {error}
              </p>
            )}
            {!ranked && (
              <p className="text-xs leading-relaxed text-ink-400">
                Unranked.{' '}
                <Link href="/hangar" className="text-scan hover:underline">
                  Enlist
                </Link>{' '}
                to bank credits from extracted salvage.
              </p>
            )}
            <p className="text-xs leading-relaxed text-ink-400">
              WASD fly · mouse aim · click fire · Space scan · Shift dash
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
