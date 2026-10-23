'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PlayerProfile } from '@skyline/game-core';
import { api, ApiError } from './api';

const TOKEN_KEY = 'skyline.token';

type Status = 'loading' | 'anonymous' | 'ready' | 'offline';

interface SessionValue {
  status: Status;
  token: string | null;
  profile: PlayerProfile | null;
  register: (callsign: string) => Promise<void>;
  setProfile: (profile: PlayerProfile) => void;
  refresh: () => Promise<void>;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Guest pilot session. The token lives in localStorage until Cognito replaces it;
 * it is only ever sent to the game API, never rendered.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  const apply = useCallback((s: ResolvedSession) => {
    setStatus(s.status);
    setToken(s.token);
    setProfile(s.profile);
  }, []);

  useEffect(() => {
    // Reading localStorage must wait until after hydration.
    void resolveSession(localStorage.getItem(TOKEN_KEY)).then(apply);
  }, [apply]);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      token,
      profile,
      register: async (callsign) => {
        const created = await api.register(callsign);
        localStorage.setItem(TOKEN_KEY, created.token);
        apply({ status: 'ready', token: created.token, profile: created.profile });
      },
      setProfile,
      refresh: () => resolveSession(localStorage.getItem(TOKEN_KEY)).then(apply),
      signOut: () => {
        localStorage.removeItem(TOKEN_KEY);
        apply({ status: 'anonymous', token: null, profile: null });
      },
    }),
    [status, token, profile, apply],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

interface ResolvedSession {
  status: Exclude<Status, 'loading'>;
  token: string | null;
  profile: PlayerProfile | null;
}

async function resolveSession(stored: string | null): Promise<ResolvedSession> {
  if (!stored) return { status: 'anonymous', token: null, profile: null };
  try {
    return { status: 'ready', token: stored, profile: await api.me(stored) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      return { status: 'anonymous', token: null, profile: null };
    }
    return { status: 'offline', token: stored, profile: null };
  }
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
