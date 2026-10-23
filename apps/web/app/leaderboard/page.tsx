import type { Metadata } from 'next';
import Link from 'next/link';
import type { LeaderboardEntry } from '@skyline/game-core';
import { SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = { title: 'Leaderboard' };
export const dynamic = 'force-dynamic';

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function loadLeaderboard(): Promise<LeaderboardEntry[] | null> {
  try {
    const res = await fetch(`${API}/api/leaderboard?limit=100`, { cache: 'no-store' });
    if (!res.ok) return null;
    return ((await res.json()) as { entries: LeaderboardEntry[] }).entries;
  } catch {
    return null;
  }
}

export default async function LeaderboardPage() {
  const entries = await loadLeaderboard();

  return (
    <main className="min-h-dvh">
      <SiteNav />
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.3em] text-scan">GLOBAL · ALL TIME</p>
            <h1 className="mt-2 font-display text-5xl font-bold text-ink-100">Leaderboard</h1>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink-400">
            Rating is earned in the arena: 100 per pilot kill, 40 per bot kill, 250 per win, minus
            10 per death. Every point is computed on the server.
          </p>
        </div>

        {entries === null ? (
          <p className="mt-16 text-sm text-hazard">
            The game server is unreachable, so rankings can&apos;t load right now.
          </p>
        ) : entries.length === 0 ? (
          <div className="mt-16 border border-ink-700 p-10 text-center">
            <p className="font-display text-xl text-ink-100">No ranked pilots yet.</p>
            <Link href="/arena" className="mt-4 inline-block text-sm text-scan hover:underline">
              Play a match to claim #1 →
            </Link>
          </div>
        ) : (
          <div className="mt-12 overflow-x-auto border border-ink-700">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-ink-900 text-left text-[10px] tracking-[0.25em] text-ink-400">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    #
                  </th>
                  <th scope="col" className="px-4 py-3">
                    PILOT
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    RATING
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    KILLS
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    K/D
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    WINS
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    MATCHES
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.callsign} className="border-t border-ink-800 tabular-nums">
                    <td
                      className={`px-4 py-3 font-display font-bold ${e.rank <= 3 ? 'text-salvage' : 'text-ink-400'}`}
                    >
                      {e.rank}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink-100">{e.callsign}</span>
                      <span className="ml-2 text-xs text-ink-400">LV {e.level}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-100">
                      {e.rating.toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-300">{e.kills}</td>
                    <td className="px-4 py-3 text-right text-ink-300">
                      {(e.kills / Math.max(1, e.deaths)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-300">{e.wins}</td>
                    <td className="px-4 py-3 text-right text-ink-300">{e.matches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
