import type { Metadata } from 'next';
import { CallsignGate } from '@/components/CallsignGate';
import { Hangar } from '@/components/Hangar';
import { SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = { title: 'Hangar' };

export default function HangarPage() {
  return (
    <main className="min-h-dvh">
      <SiteNav />
      <CallsignGate reason="The hangar needs a pilot account to hold your credits, weapons and paint jobs.">
        <Hangar />
      </CallsignGate>
    </main>
  );
}
