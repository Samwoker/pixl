import type {
  EquippedLoadout,
  LeaderboardEntry,
  MissionResult,
  MissionRewards,
  MissionSpec,
  PlayerProfile,
  PublicRoom,
  ZoneLevel,
} from '@skyline/game-core';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function wsUrl(): string {
  return `${API_URL.replace(/^http/, 'ws')}/ws`;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'OFFLINE', 'Game server is unreachable. Is it running?');
  }
  const body = (await res.json().catch(() => null)) as {
    error?: { code: string; message: string };
  } | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'HTTP_ERROR',
      body?.error?.message ?? `Request failed (${res.status})`,
    );
  }
  return body as T;
}

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  register: (callsign: string) =>
    request<{ token: string; profile: PlayerProfile }>('/api/players', post({ callsign })),
  me: (token: string) => request<PlayerProfile>('/api/me', { token }),
  purchase: (token: string, itemId: string) =>
    request<PlayerProfile>('/api/market/purchase', { ...post({ itemId }), token }),
  upgrade: (token: string, weaponId: string) =>
    request<PlayerProfile>('/api/market/upgrade', { ...post({ weaponId }), token }),
  setLoadout: (token: string, loadout: EquippedLoadout) =>
    request<PlayerProfile>('/api/loadout', { method: 'PUT', body: JSON.stringify(loadout), token }),
  leaderboard: (limit = 50) =>
    request<{ entries: LeaderboardEntry[] }>(`/api/leaderboard?limit=${limit}`),
  rooms: () => request<{ rooms: PublicRoom[] }>('/api/rooms'),
  createSalvageMission: (token: string, zone: ZoneLevel) =>
    request<MissionSpec>('/api/salvage/missions', { ...post({ zone }), token }),
  submitSalvageResult: (token: string, result: MissionResult) =>
    request<{ rewards: MissionRewards; profile: PlayerProfile }>(
      `/api/salvage/missions/${encodeURIComponent(result.missionId)}/result`,
      { ...post({ result }), token },
    ),
};
