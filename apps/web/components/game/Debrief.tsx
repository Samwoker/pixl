import type { MissionEnd } from '@skyline/game';
import { ITEMS, itemValue, type ItemId, type MissionSpec } from '@skyline/game-core';

export type Verdict =
  | { status: 'unranked'; reason: string }
  | { status: 'pending' }
  | { status: 'confirmed'; credits: number; xp: number }
  | { status: 'rejected'; reason: string };

interface DebriefProps {
  mission: MissionSpec;
  end: MissionEnd;
  verdict: Verdict;
  onRedeploy: () => void;
  onReplaySeed: () => void;
  onBriefing: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export function Debrief({
  mission,
  end,
  verdict,
  onRedeploy,
  onReplaySeed,
  onBriefing,
}: DebriefProps) {
  const { result, rewards } = end;
  const items = (Object.entries(result.items) as [ItemId, number][]).filter(([, n]) => n > 0);
  const survived = result.extracted;
  const lostValue = items.reduce((sum, [id, n]) => sum + itemValue(id, mission.zone) * n, 0);

  return (
    <div className="grid min-h-dvh place-items-center bg-ink-950/90 px-6 py-10 backdrop-blur-sm">
      <section aria-labelledby="debrief-title" className="w-full max-w-2xl">
        <p className={`text-xs tracking-[0.3em] ${survived ? 'text-extract' : 'text-hazard'}`}>
          {survived ? 'EXTRACTION SUCCESSFUL' : 'SIGNAL LOST'}
        </p>
        <h1 id="debrief-title" className="mt-3 font-display text-5xl font-bold text-ink-100">
          {survived ? `+${fmt(rewards.credits)} cr` : 'Drone destroyed.'}
        </h1>
        {!survived && (
          <p className="mt-3 text-sm text-ink-300">
            {lostValue > 0
              ? `${fmt(lostValue)} cr of salvage went down with it.`
              : 'Nothing was in the hold.'}
          </p>
        )}

        <dl className="mt-10 grid grid-cols-2 gap-px border border-ink-700 bg-ink-700 sm:grid-cols-4">
          {[
            ['SCORE', fmt(rewards.score)],
            ['XP', `+${fmt(rewards.xp)}`],
            ['KILLS', fmt(result.enemiesKilled)],
            [
              'TIME',
              `${Math.floor(result.durationSec / 60)}m ${Math.floor(result.durationSec % 60)}s`,
            ],
          ].map(([label, value]) => (
            <div key={label} className="bg-ink-950 p-4">
              <dt className="text-[10px] tracking-[0.25em] text-ink-400">{label}</dt>
              <dd className="mt-1 text-xl tabular-nums text-ink-100">{value}</dd>
            </div>
          ))}
        </dl>

        {survived && (
          <dl className="mt-6 space-y-1.5 text-sm">
            {[
              ['Salvage value', rewards.lootValue],
              ['Kill bonus', rewards.killBonus],
              ['Extraction bonus', rewards.extractionBonus],
              ['Damage penalty', -rewards.damagePenalty],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-ink-800 pb-1.5">
                <dt className="text-ink-300">{label}</dt>
                <dd
                  className={`tabular-nums ${Number(value) < 0 ? 'text-hazard' : 'text-ink-100'}`}
                >
                  {fmt(Number(value))}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {items.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[10px] tracking-[0.25em] text-ink-400">
              {survived ? 'RECOVERED' : 'LOST'}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {items.map(([id, n]) => (
                <li
                  key={id}
                  className={`border px-3 py-1.5 text-xs ${survived ? 'border-ink-600 text-ink-100' : 'border-ink-800 text-ink-400 line-through'}`}
                >
                  {ITEMS[id].name} ×{n}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onRedeploy}
            autoFocus
            className="bg-signal px-6 py-3.5 font-display text-sm font-semibold tracking-[0.2em] text-ink-950 transition-colors hover:bg-signal-soft"
          >
            REDEPLOY
          </button>
          <button
            type="button"
            onClick={onReplaySeed}
            className="border border-ink-600 px-6 py-3.5 font-display text-sm font-semibold tracking-[0.2em] text-ink-100 transition-colors hover:border-ink-400"
          >
            SAME CITY
          </button>
          <button
            type="button"
            onClick={onBriefing}
            className="text-sm text-ink-300 hover:text-ink-100"
          >
            Change zone
          </button>
        </div>
        <p
          role="status"
          className={`mt-8 text-xs ${verdict.status === 'rejected' ? 'text-hazard' : verdict.status === 'confirmed' ? 'text-extract' : 'text-ink-400'}`}
        >
          {verdict.status === 'pending' && 'Sending flight log to the server for verification…'}
          {verdict.status === 'confirmed' &&
            `Verified by the server: +${fmt(verdict.credits)} cr and +${fmt(verdict.xp)} XP added to your account.`}
          {verdict.status === 'rejected' &&
            `The server rejected this run (${verdict.reason}). No credits awarded.`}
          {verdict.status === 'unranked' && verdict.reason}
        </p>
      </section>
    </div>
  );
}
