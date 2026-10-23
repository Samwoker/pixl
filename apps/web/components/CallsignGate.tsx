'use client';

import { useState } from 'react';
import { useSession } from '@/lib/session';

/** Gate for pages that need a pilot account (guest callsign, no password yet). */
export function CallsignGate({ children, reason }: { children: React.ReactNode; reason: string }) {
  const { status, register, refresh } = useSession();
  const [callsign, setCallsign] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'ready') return <>{children}</>;
  if (status === 'loading') {
    return <p className="px-6 py-24 text-center text-sm text-ink-400">Connecting…</p>;
  }
  if (status === 'offline') {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="font-display text-2xl font-semibold text-ink-100">Game server offline</p>
        <p className="mt-3 text-sm text-ink-400">
          Start it with <code className="text-scan">pnpm dev</code> from the repo root, then retry.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-6 border border-ink-600 px-5 py-2 text-sm text-ink-100 hover:border-ink-400"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-display text-4xl font-bold text-ink-100">Pick a callsign.</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-300">{reason}</p>
      <form
        className="mt-8 flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await register(callsign.trim());
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not register.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="callsign" className="text-[10px] tracking-[0.3em] text-ink-400">
          CALLSIGN
        </label>
        <input
          id="callsign"
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
          pattern="[A-Za-z0-9_\-]{3,16}"
          minLength={3}
          maxLength={16}
          required
          autoComplete="nickname"
          autoFocus
          className="border border-ink-600 bg-ink-900 px-4 py-3 font-mono text-ink-100 outline-none focus:border-scan"
          placeholder="e.g. NightOwl"
        />
        <p className="text-xs text-ink-400">
          3–16 letters, numbers, - or _. Shown on the leaderboard.
        </p>
        {error && (
          <p role="alert" className="text-sm text-hazard">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 bg-signal px-6 py-3.5 font-display text-sm font-semibold tracking-[0.2em] text-ink-950 hover:bg-signal-soft disabled:opacity-60"
        >
          {busy ? 'REGISTERING…' : 'ENLIST'}
        </button>
      </form>
    </div>
  );
}
