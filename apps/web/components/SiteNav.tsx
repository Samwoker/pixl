'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/session';

const LINKS = [
  { href: '/arena', label: 'Arena' },
  { href: '/game', label: 'Salvage' },
  { href: '/hangar', label: 'Hangar' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function SiteNav() {
  const pathname = usePathname();
  const { status, profile } = useSession();

  return (
    <header className="relative z-10 border-b border-ink-800 bg-ink-950/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        <Link
          href="/"
          className="font-display text-sm font-semibold tracking-[0.3em] text-ink-100 hover:text-scan"
        >
          SKYLINE//SALVAGERS
        </Link>
        <nav aria-label="Main" className="flex flex-1 gap-5 text-sm">
          {LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={active ? 'text-scan' : 'text-ink-300 hover:text-ink-100'}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="text-xs">
          {status === 'ready' && profile ? (
            <span className="flex items-center gap-3">
              <span className="text-ink-100">{profile.callsign}</span>
              <span className="text-ink-400">LV {profile.level}</span>
              <span className="tabular-nums text-salvage">
                {profile.credits.toLocaleString('en-US')} cr
              </span>
            </span>
          ) : status === 'offline' ? (
            <span className="text-hazard">server offline</span>
          ) : status === 'anonymous' ? (
            <span className="text-ink-400">guest</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
