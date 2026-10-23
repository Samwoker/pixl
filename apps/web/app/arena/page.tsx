import type { Metadata } from 'next';
import { ArenaClient } from '@/components/arena/ArenaClient';

export const metadata: Metadata = { title: 'Arena' };

export default function ArenaPage() {
  return <ArenaClient />;
}
