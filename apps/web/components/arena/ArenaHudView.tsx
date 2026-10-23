import type { ArenaHud, ArenaHudPlayer } from '@skyline/game';
import { WEAPONS } from '@skyline/game-core';

const TEAM_TEXT = ['text-scan', 'text-hazard'] as const;
const TEAM_NAME = ['CYAN', 'RED'] as const;

function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  return (
    <div className="h-1.5 w-40 bg-ink-800">
      <div
        className={`h-full transition-[width] duration-100 ${className}`}
        style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
      />
    </div>
  );
}

export function ArenaHudView({ hud, showScoreboard }: { hud: ArenaHud; showScoreboard: boolean }) {
  const weapon = WEAPONS[hud.weapon.id];
  const low = hud.hp / hud.maxHp < 0.3;

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {low && hud.alive && (
        <div
          aria-hidden
          className="absolute inset-0 shadow-[inset_0_0_140px_rgba(255,77,109,0.3)]"
        />
      )}

      <div className="absolute inset-x-0 top-4 flex flex-col items-center gap-1">
        {hud.teamScores ? (
          <div className="flex items-center gap-4 bg-ink-950/75 px-5 py-2 font-display text-2xl font-bold tabular-nums">
            <span className="text-scan">{hud.teamScores[0]}</span>
            <span className="text-sm text-ink-400">{clock(hud.timeLeft)}</span>
            <span className="text-hazard">{hud.teamScores[1]}</span>
          </div>
        ) : (
          <div className="bg-ink-950/75 px-5 py-2 font-display text-2xl font-bold tabular-nums text-ink-100">
            {clock(hud.timeLeft)}
          </div>
        )}
        <p className="text-[10px] tracking-[0.25em] text-ink-400">
          {hud.arenaName.toUpperCase()} · FIRST TO {hud.scoreLimit}
          {hud.myTeam !== null && (
            <span className={`ml-2 ${TEAM_TEXT[hud.myTeam]}`}>YOU: {TEAM_NAME[hud.myTeam]}</span>
          )}
          {hud.isPrivate && <span className="ml-2 text-salvage">CODE {hud.roomCode}</span>}
        </p>
      </div>

      <ul className="absolute right-4 top-4 flex w-80 flex-col items-end gap-1 text-xs">
        {hud.killFeed.map((k) => (
          <li
            key={k.id}
            className={`bg-ink-950/75 px-2.5 py-1 ${k.involvesYou ? 'outline outline-1 outline-salvage' : ''}`}
          >
            {k.killer ? (
              <span className={k.killerTeam !== null ? TEAM_TEXT[k.killerTeam] : 'text-ink-100'}>
                {k.killer}
              </span>
            ) : (
              <span className="text-ink-400">grid</span>
            )}
            <span className="mx-2 text-ink-400">[{k.weapon ? WEAPONS[k.weapon].name : '—'}]</span>
            <span className={k.victimTeam !== null ? TEAM_TEXT[k.victimTeam] : 'text-ink-300'}>
              {k.victim}
            </span>
          </li>
        ))}
      </ul>

      <div className="absolute left-4 top-4 bg-ink-950/75 px-3 py-2 text-xs tabular-nums text-ink-300">
        <span className="text-ink-100">{hud.kills}</span> K ·{' '}
        <span className="text-ink-100">{hud.deaths}</span> D ·{' '}
        <span className="text-salvage">{hud.score}</span> pts
        <span className={`ml-3 ${hud.ping > 150 ? 'text-hazard' : 'text-ink-400'}`}>
          {hud.ping}ms
        </span>
      </div>

      {hud.hitMarker && (
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-center text-xl leading-6 text-ink-100"
        >
          ✕
        </div>
      )}

      {!hud.alive && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="bg-ink-950/80 px-10 py-6 text-center">
            <p className="text-xs tracking-[0.3em] text-hazard">DRONE DOWN</p>
            <p className="mt-2 font-display text-5xl font-bold tabular-nums text-ink-100">
              {Math.ceil(hud.respawnIn)}
            </p>
            <p className="mt-1 text-xs text-ink-400">respawning</p>
          </div>
        </div>
      )}
      {hud.alive && hud.protected && (
        <p className="absolute inset-x-0 top-28 text-center text-xs tracking-[0.3em] text-scan">
          SPAWN SHIELD ACTIVE
        </p>
      )}

      <div className="absolute bottom-5 left-5 space-y-1.5 bg-ink-950/75 p-3">
        <div className="flex items-center gap-3">
          <span className="w-14 text-[10px] tracking-[0.2em] text-ink-300">HULL</span>
          <Bar value={hud.hp} max={hud.maxHp} className={low ? 'bg-hazard' : 'bg-ink-100'} />
          <span className="w-8 text-right text-xs tabular-nums text-ink-100">{hud.hp}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-14 text-[10px] tracking-[0.2em] text-ink-300">SHIELD</span>
          <Bar value={hud.shield} max={hud.maxShield} className="bg-signal" />
          <span className="w-8 text-right text-xs tabular-nums text-ink-100">{hud.shield}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-14 text-[10px] tracking-[0.2em] text-ink-300">DASH</span>
          <Bar
            value={Math.max(0, Math.min(1, hud.dashReady))}
            max={1}
            className={hud.dashReady >= 1 ? 'bg-scan' : 'bg-ink-600'}
          />
          <span className="w-8 text-right text-xs tabular-nums text-ink-400">{hud.energy}</span>
        </div>
      </div>

      <div className="absolute bottom-5 right-5 bg-ink-950/75 p-3 text-right">
        <p className="font-display text-lg font-semibold text-ink-100">{weapon.name}</p>
        {hud.weapon.reloading > 0 ? (
          <div className="mt-1 flex items-center justify-end gap-2">
            <span className="text-[10px] tracking-[0.25em] text-salvage">RELOADING</span>
            <div className="h-1.5 w-24 bg-ink-800">
              <div
                className="h-full bg-salvage"
                style={{ width: `${hud.weapon.reloading * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <p
            className={`font-display text-3xl font-bold tabular-nums ${hud.weapon.ammo === 0 ? 'text-hazard' : 'text-ink-100'}`}
          >
            {hud.weapon.ammo}
            <span className="text-base text-ink-400">/{hud.weapon.magazine}</span>
          </p>
        )}
        <p className="mt-1 text-[10px] tracking-[0.2em] text-ink-400">
          Q · {WEAPONS[hud.otherWeapon].name}
        </p>
      </div>

      {showScoreboard && <Scoreboard players={hud.scoreboard} teamScores={hud.teamScores} />}
    </div>
  );
}

export function Scoreboard({
  players,
  teamScores,
}: {
  players: ArenaHudPlayer[];
  teamScores: [number, number] | null;
}) {
  const groups: { title: string; tone: string; rows: ArenaHudPlayer[] }[] = teamScores
    ? [0, 1].map((team) => ({
        title: `${TEAM_NAME[team as 0 | 1]} · ${teamScores[team as 0 | 1]}`,
        tone: TEAM_TEXT[team as 0 | 1],
        rows: players.filter((p) => p.team === team),
      }))
    : [{ title: 'FREE FOR ALL', tone: 'text-ink-100', rows: players }];

  return (
    <div className="absolute inset-0 grid place-items-center bg-ink-950/50">
      <div
        className={`grid w-full max-w-3xl gap-6 px-6 ${groups.length > 1 ? 'md:grid-cols-2' : ''}`}
      >
        {groups.map((g) => (
          <table key={g.title} className="w-full bg-ink-950/90 text-sm">
            <caption
              className={`bg-ink-900 px-4 py-2 text-left font-display text-sm font-semibold tracking-[0.2em] ${g.tone}`}
            >
              {g.title}
            </caption>
            <thead className="text-[10px] tracking-[0.2em] text-ink-400">
              <tr>
                <th scope="col" className="px-4 py-2 text-left">
                  PILOT
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  K
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  D
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  PTS
                </th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-ink-800 tabular-nums ${p.you ? 'bg-ink-800' : ''} ${p.alive ? '' : 'opacity-50'}`}
                >
                  <td className="px-4 py-2 text-ink-100">
                    {p.name}
                    {p.bot && <span className="ml-2 text-[10px] text-ink-400">BOT</span>}
                  </td>
                  <td className="px-2 py-2 text-right text-ink-100">{p.kills}</td>
                  <td className="px-2 py-2 text-right text-ink-300">{p.deaths}</td>
                  <td className="px-4 py-2 text-right text-salvage">{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
