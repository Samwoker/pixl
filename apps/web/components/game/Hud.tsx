import type { HudSnapshot } from '@skyline/game';

function formatTime(totalSec: number): string {
  const s = Math.floor(totalSec);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Meter({
  label,
  value,
  max,
  barClass,
  warn,
}: {
  label: string;
  value: number;
  max: number;
  barClass: string;
  warn?: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="grid grid-cols-[4.5rem_10rem_2.5rem] items-center gap-3 sm:grid-cols-[4.5rem_13rem_2.5rem]">
      <span className={`text-[10px] tracking-[0.2em] ${warn ? 'text-hazard' : 'text-ink-300'}`}>
        {label}
      </span>
      <div
        className="h-2 bg-ink-800"
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={`h-full transition-[width] duration-150 ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right text-xs tabular-nums text-ink-100">{Math.round(value)}</span>
    </div>
  );
}

function Cooldown({ keyLabel, label, ready }: { keyLabel: string; label: string; ready: number }) {
  const isReady = ready >= 1;
  return (
    <div className="flex items-center gap-2">
      <kbd
        className={`relative overflow-hidden border px-2 py-1 text-[10px] ${isReady ? 'border-scan text-scan' : 'border-ink-600 text-ink-400'}`}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-scan/15"
          style={{ width: `${Math.max(0, Math.min(1, ready)) * 100}%` }}
        />
        <span className="relative">{keyLabel}</span>
      </kbd>
      <span className="text-[10px] tracking-[0.2em] text-ink-300">{label}</span>
    </div>
  );
}

export function Hud({ hud }: { hud: HudSnapshot }) {
  const hullLow = hud.hp / hud.maxHp < 0.3;
  const cargoFull = hud.cargoUsed >= hud.cargoCapacity;

  return (
    <div className="pointer-events-none absolute inset-0 select-none p-4 sm:p-5">
      {hullLow && (
        <div
          aria-hidden
          className="absolute inset-0 shadow-[inset_0_0_120px_rgba(255,77,109,0.25)]"
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 bg-ink-950/70 p-3 backdrop-blur-sm">
          <Meter
            label="HULL"
            value={hud.hp}
            max={hud.maxHp}
            barClass={hullLow ? 'bg-hazard' : 'bg-ink-100'}
            warn={hullLow}
          />
          <Meter label="SHIELD" value={hud.shield} max={hud.maxShield} barClass="bg-signal" />
          <Meter label="ENERGY" value={hud.energy} max={hud.maxEnergy} barClass="bg-scan" />
        </div>

        <div className="hidden text-center md:block">
          <p className="text-[10px] tracking-[0.3em] text-ink-400">ZONE {hud.zone}</p>
          <p className="font-display text-sm font-semibold tracking-[0.2em] text-ink-100">
            {hud.zoneName.toUpperCase()}
          </p>
          <p className="mt-1 text-lg tabular-nums text-ink-100">{formatTime(hud.elapsedSec)}</p>
          <p className="text-[10px] tracking-[0.2em] text-hazard/80">
            REINFORCEMENTS {hud.nextWaveSec}s
          </p>
        </div>

        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 bg-ink-950/70 p-3 text-right backdrop-blur-sm">
          <dt className="text-[10px] tracking-[0.2em] text-ink-300">HAUL</dt>
          <dd className="text-sm tabular-nums text-salvage">
            {hud.lootValue.toLocaleString('en-US')} cr
          </dd>
          <dt className="text-[10px] tracking-[0.2em] text-ink-300">CARGO</dt>
          <dd className={`text-sm tabular-nums ${cargoFull ? 'text-hazard' : 'text-ink-100'}`}>
            {hud.cargoUsed}/{hud.cargoCapacity}
          </dd>
          <dt className="text-[10px] tracking-[0.2em] text-ink-300">KILLS</dt>
          <dd className="text-sm tabular-nums text-ink-100">{hud.kills}</dd>
        </dl>
      </div>

      {hud.alert && (
        <p
          role="status"
          className="absolute left-1/2 top-28 -translate-x-1/2 border border-hazard/60 bg-ink-950/80 px-4 py-2 text-xs tracking-[0.25em] text-hazard"
        >
          {hud.alert}
        </p>
      )}

      <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 sm:bottom-5">
        {hud.inExtractionZone ? (
          <div className="text-center" role="status">
            <p className="text-[10px] tracking-[0.3em] text-extract">EXTRACTING — HOLD POSITION</p>
            <p className="font-display text-5xl font-bold tabular-nums text-extract">
              {Math.ceil(hud.extractionSecondsLeft)}
            </p>
          </div>
        ) : (
          <p className="bg-ink-950/70 px-3 py-1.5 text-[10px] tracking-[0.25em] text-ink-300">
            EXTRACTION{' '}
            <span className="tabular-nums text-extract">
              {Math.round(hud.extractionDistance / 48)}m
            </span>
          </p>
        )}
      </div>

      <div className="absolute bottom-4 left-4 flex gap-4 sm:bottom-5 sm:left-5">
        <Cooldown keyLabel="SHIFT" label="DASH" ready={hud.dashReady} />
        <Cooldown keyLabel="SPACE" label="SCAN" ready={hud.scanReady} />
      </div>

      <p className="absolute bottom-4 right-4 text-[10px] tracking-[0.2em] text-ink-400 sm:bottom-5 sm:right-5">
        ESC PAUSE · M {hud.muted ? 'UNMUTE' : 'MUTE'}
      </p>
    </div>
  );
}
