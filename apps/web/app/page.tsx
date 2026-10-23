import Link from 'next/link';
import {
  ARENA_IDS,
  ARENA_MODES,
  arenaInfo,
  ONE_SHOT_DAMAGE,
  WEAPON_IDS,
  WEAPONS,
  weaponStats,
  ZONE_LEVELS,
  ZONES,
} from '@skyline/game-core';
import { SiteNav } from '@/components/SiteNav';

const CONTROLS = [
  ['W A S D', 'Fly'],
  ['Mouse / click', 'Aim and fire'],
  ['Q · 1 · 2', 'Swap weapon (arena)'],
  ['R', 'Reload (arena)'],
  ['Shift', 'Dash'],
  ['Space', 'Scan for salvage (salvage)'],
  ['Tab', 'Scoreboard (arena)'],
  ['Esc', 'Menu / pause'],
  ['M', 'Mute'],
];

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export default function LandingPage() {
  return (
    <main className="blueprint relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,transparent_0%,var(--color-ink-950)_70%)]"
      />
      <SiteNav />

      <section className="relative mx-auto grid max-w-6xl gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:pt-24">
        <div>
          <p className="mb-6 text-xs tracking-[0.25em] text-scan">ARENA · SALVAGE · HANGAR</p>
          <h1 className="font-display text-6xl leading-[0.9] font-bold text-ink-100 sm:text-7xl lg:text-8xl">
            The city
            <br />
            is dead.
            <br />
            <span className="text-signal">Its drones</span> aren&apos;t.
          </h1>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-ink-300">
            Fight other pilots and bots in five arenas, solo or in teams. Every kill pays credits.
            Spend them on heavier guns, frames and paint, and climb the global leaderboard. Want
            quiet? Run a solo salvage mission through a procedurally generated city.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/arena"
              className="group inline-flex items-center gap-3 bg-signal px-6 py-3.5 font-display text-sm font-semibold tracking-[0.2em] text-ink-950 transition-colors hover:bg-signal-soft"
            >
              ENTER ARENA
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
            <Link
              href="/game"
              className="border border-ink-600 px-6 py-3.5 font-display text-sm font-semibold tracking-[0.2em] text-ink-100 hover:border-ink-400"
            >
              SOLO SALVAGE
            </Link>
          </div>
        </div>

        <aside
          aria-labelledby="arsenal-heading"
          className="self-end border border-ink-700 bg-ink-900/80 backdrop-blur-sm"
        >
          <div className="flex items-baseline justify-between border-b border-ink-700 px-5 py-3">
            <h2 id="arsenal-heading" className="text-xs tracking-[0.25em] text-ink-300">
              ARSENAL
            </h2>
            <Link href="/hangar" className="text-xs text-scan hover:underline">
              hangar →
            </Link>
          </div>
          <ol>
            {WEAPON_IDS.map((id) => {
              const w = WEAPONS[id];
              const oneShot = weaponStats(id, 1).damage >= ONE_SHOT_DAMAGE;
              const oneShotLater = !oneShot && weaponStats(id, 3).damage >= ONE_SHOT_DAMAGE;
              return (
                <li
                  key={id}
                  className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 border-b border-ink-800 px-5 py-3 last:border-0"
                >
                  <span className="text-[10px] tracking-[0.2em] text-ink-400">TIER {w.tier}</span>
                  <span className="font-display text-sm font-semibold text-ink-100">
                    {w.name}
                    {oneShot && (
                      <span className="ml-2 bg-hazard px-1 text-[9px] text-ink-950">ONE-SHOT</span>
                    )}
                    {oneShotLater && (
                      <span className="ml-2 border border-hazard px-1 text-[9px] text-hazard">
                        ONE-SHOT LV3
                      </span>
                    )}
                  </span>
                  <span className="text-sm tabular-nums text-salvage">
                    {w.price === 0 ? 'free' : `${w.price.toLocaleString('en-US')} cr`}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      </section>

      <section className="relative border-t border-ink-800 bg-ink-950/90">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold text-ink-100">
              Five arenas. Two ways to fight.
            </h2>
            <p className="text-sm text-ink-400">
              {Object.values(ARENA_MODES)
                .map((m) => `${m.name}: first to ${m.scoreLimit}`)
                .join(' · ')}
            </p>
          </div>
          <ol className="mt-10 grid gap-px bg-ink-800 sm:grid-cols-2 lg:grid-cols-5">
            {ARENA_IDS.map((id, i) => {
              const a = arenaInfo(id);
              return (
                <li key={id} className="bg-ink-950 p-6">
                  <span className="text-xs text-ink-400">0{i + 1}</span>
                  <p
                    className="mt-3 font-display text-lg font-semibold"
                    style={{ color: hex(a.accent) }}
                  >
                    {a.name}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-ink-300">{a.tagline}</p>
                </li>
              );
            })}
          </ol>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-400">
            Quick match drops you into a public room where bots hold empty slots until real pilots
            arrive. Practice against machines on easy, normal or hard, or open a private room and
            share its five-letter code.
          </p>
        </div>
      </section>

      <section className="relative border-t border-ink-800 bg-ink-950">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink-100">Solo salvage</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-400">
              Scan for buried tech, fight the security grid, and hold the extraction pad for five
              seconds. Die first and the haul is gone. Ranked runs get a server-issued seed and the
              server checks the flight log before paying out.
            </p>
          </div>
          <ol className="border border-ink-700">
            {ZONE_LEVELS.map((level) => (
              <li
                key={level}
                className="flex items-center justify-between border-b border-ink-800 px-5 py-3 last:border-0"
              >
                <span className="text-sm text-ink-100">
                  <span className="mr-3 font-display text-ink-400">{level}</span>
                  {ZONES[level].name}
                </span>
                <span className="text-sm tabular-nums text-salvage">
                  loot ×{ZONES[level].valueMultiplier}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="controls" className="relative border-t border-ink-800 bg-ink-950">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink-100">Controls</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
              Keyboard and mouse.
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-sm">
            {CONTROLS.map(([key, action]) => (
              <div key={key} className="contents">
                <dt>
                  <kbd className="border border-ink-600 bg-ink-850 px-2 py-0.5 text-xs text-ink-100">
                    {key}
                  </kbd>
                </dt>
                <dd className="text-ink-300">{action}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
