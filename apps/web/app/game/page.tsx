import type { Metadata } from 'next';
import { GameClient } from '@/components/game/GameClient';
import { parseSeed, parseZone, randomSeed } from '@/lib/mission';

export const metadata: Metadata = {
  title: 'Deploy',
};

interface GamePageProps {
  searchParams: Promise<{ seed?: string | string[]; zone?: string | string[] }>;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function GamePage({ searchParams }: GamePageProps) {
  const params = await searchParams;
  // Seed is chosen on the server so the client render is stable and never invents one.
  return (
    <GameClient
      initialSeed={parseSeed(first(params.seed)) ?? randomSeed()}
      initialZone={parseZone(first(params.zone)) ?? 1}
    />
  );
}
