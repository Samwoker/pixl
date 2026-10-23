import type { MatchRewards, PlayerResult } from '@skyline/game-core';

interface ArenaResultsProps {
  results: PlayerResult[];
  teamScores: [number, number] | null;
  rewards: MatchRewards | null;
  you: string | null;
  onPlayAgain: () => void;
  onLobby: () => void;
}

export function ArenaResults({
  results,
  teamScores,
  rewards,
  you,
  onPlayAgain,
  onLobby,
}: ArenaResultsProps) {
  const me = results.find((r) => r.id === you);
  const headline = me?.won
    ? 'Victory.'
    : teamScores && teamScores[0] === teamScores[1]
      ? 'Draw.'
      : 'Defeat.';

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <p className={`text-xs tracking-[0.3em] ${me?.won ? 'text-extract' : 'text-hazard'}`}>
        MATCH OVER
      </p>
      <h1 className="mt-2 font-display text-6xl font-bold text-ink-100">{headline}</h1>
      {teamScores && (
        <p className="mt-3 font-display text-2xl tabular-nums">
          <span className="text-scan">{teamScores[0]}</span>
          <span className="mx-3 text-ink-400">–</span>
          <span className="text-hazard">{teamScores[1]}</span>
        </p>
      )}

      {rewards && (
        <dl className="mt-10 grid grid-cols-3 gap-px border border-ink-700 bg-ink-700">
          {[
            ['CREDITS', `+${rewards.credits.toLocaleString('en-US')}`, 'text-salvage'],
            ['XP', `+${rewards.xp}`, 'text-ink-100'],
            ['RATING', `+${rewards.rating}`, 'text-scan'],
          ].map(([label, value, tone]) => (
            <div key={label} className="bg-ink-950 p-5">
              <dt className="text-[10px] tracking-[0.25em] text-ink-400">{label}</dt>
              <dd className={`mt-1 font-display text-3xl font-bold tabular-nums ${tone}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <table className="mt-10 w-full text-sm">
        <thead className="text-left text-[10px] tracking-[0.25em] text-ink-400">
          <tr>
            <th scope="col" className="py-2">
              #
            </th>
            <th scope="col" className="py-2">
              PILOT
            </th>
            <th scope="col" className="py-2 text-right">
              KILLS
            </th>
            <th scope="col" className="py-2 text-right">
              DEATHS
            </th>
            <th scope="col" className="py-2 text-right">
              STREAK
            </th>
            <th scope="col" className="py-2 text-right">
              SCORE
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr
              key={r.id}
              className={`border-t border-ink-800 tabular-nums ${r.id === you ? 'text-salvage' : 'text-ink-100'}`}
            >
              <td className="py-2 text-ink-400">{i + 1}</td>
              <td className="py-2">
                <span className={r.team === 0 ? 'text-scan' : r.team === 1 ? 'text-hazard' : ''}>
                  {r.name}
                </span>
                {r.bot && <span className="ml-2 text-[10px] text-ink-400">BOT</span>}
                {r.won && <span className="ml-2 text-[10px] text-extract">WIN</span>}
              </td>
              <td className="py-2 text-right">{r.kills}</td>
              <td className="py-2 text-right">{r.deaths}</td>
              <td className="py-2 text-right">{r.bestStreak}</td>
              <td className="py-2 text-right">{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-12 flex flex-wrap gap-4">
        <button
          type="button"
          autoFocus
          onClick={onPlayAgain}
          className="bg-signal px-6 py-3.5 font-display text-sm font-semibold tracking-[0.2em] text-ink-950 hover:bg-signal-soft"
        >
          PLAY AGAIN
        </button>
        <button
          type="button"
          onClick={onLobby}
          className="border border-ink-600 px-6 py-3.5 font-display text-sm font-semibold tracking-[0.2em] text-ink-100 hover:border-ink-400"
        >
          LOBBY
        </button>
      </div>
    </div>
  );
}
