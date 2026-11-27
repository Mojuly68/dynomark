import { useEffect, useState, type ReactNode } from 'react';
import { BarChart3, Dumbbell, Flag, Home, MapPin, Plus, User, Users } from 'lucide-react';
import { CREW_ON } from '../crew/CrewProvider';
import { useStore } from '../store/Store';
import { href } from '../lib/router';
import { fmtClock } from '../lib/dates';
import { cx } from './ui';
import { Logo } from './Logo';

const NAV = [
  { id: 'home', to: '/', label: 'Dashboard', short: 'Home', icon: Home },
  { id: 'log', to: '/log', label: 'Log a Climb', short: 'Log', icon: Plus },
  { id: 'gyms', to: '/gyms', label: 'My Gyms', short: 'Gyms', icon: MapPin },
  { id: 'progress', to: '/progress', label: 'Progress', short: 'Progress', icon: BarChart3 },
  { id: 'projects', to: '/projects', label: 'Projects', short: 'Projects', icon: Flag },
  { id: 'training', to: '/training', label: 'Training', short: 'Train', icon: Dumbbell },
  ...(CREW_ON ? [{ id: 'crew', to: '/crew', label: 'Crew', short: 'Crew', icon: Users }] : []),
  { id: 'profile', to: '/profile', label: 'Profile', short: 'Profile', icon: User },
];
// With Crew on, Crew takes the Projects tab; Projects stays one tap away on Home.
const MOBILE = ['home', 'progress', 'log', CREW_ON ? 'crew' : 'projects', 'training'];

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function ActiveSessionPill({ section }: { section: string }) {
  const { data, gymById } = useStore();
  const now = useNow();
  const s = data.activeSessionId ? data.sessions.find((x) => x.id === data.activeSessionId) : undefined;
  if (!s || section === 'log') return null;
  const n = data.climbs.filter((c) => c.sessionId === s.id).length;
  return (
    <a href={href('/log')} className="anim-rise fixed inset-x-3 bottom-[calc(96px+var(--sa-bottom))] z-30 flex min-h-12 items-center gap-3 rounded-2xl bg-accent px-4 text-sm font-semibold text-accent-ink no-underline shadow-xl lg:bottom-6 lg:left-auto lg:right-6 lg:w-80">
      <span className="h-2 w-2 animate-pulse rounded-full bg-accent-ink" aria-hidden="true" />
      <span className="flex-1">Session at {gymById(s.gymId)?.name ?? 'gym'} · {n} climb{n === 1 ? '' : 's'}</span>
      <span className="font-mono">{fmtClock((now - new Date(s.startedAt).getTime()) / 1000)}</span>
    </a>
  );
}

export function Layout({ section, children }: { section: string; children: ReactNode }) {
  const { data } = useStore();
  return (
    <div className="min-h-dvh lg:flex">
      <button type="button" onClick={() => document.getElementById('main')?.focus()} className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-xl focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">Skip to content</button>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-line px-4 py-6 lg:flex">
        <a href={href('/')} aria-label="DYNOMARK home" className="mb-6 inline-flex px-3 py-1 text-ink no-underline"><Logo height={26} title={null} /></a>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((n) => {
            const on = section === n.id;
            return (
              <a key={n.id} href={href(n.to)} aria-current={on ? 'page' : undefined} className={cx('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold no-underline transition-colors', on ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface hover:text-ink', n.id === 'log' && !on && 'text-route')}>
                <n.icon size={20} aria-hidden="true" />{n.label}
              </a>
            );
          })}
        </nav>
        {data.user.isDemo && <p className="mt-auto rounded-xl border border-line p-3 text-xs text-muted">Demo account with sample data. <a href={href('/profile')} className="text-route">Start fresh</a></p>}
      </aside>

      <div className="min-w-0 flex-1">
        <main id="main" tabIndex={-1} className="mx-auto outline-none w-full max-w-6xl px-5 pb-[calc(144px+var(--sa-bottom))] pt-[max(var(--sa-top),20px)] lg:px-10 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>

      <ActiveSessionPill section={section} />

      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid h-[76px] max-w-lg grid-cols-5 px-1.5 pt-2">
          {MOBILE.map((id) => {
            const n = NAV.find((x) => x.id === id)!;
            const on = section === id;
            if (id === 'log') {
              return (
                <a key={id} href={href(n.to)} aria-label="Log a climb" aria-current={on ? 'page' : undefined} className="flex items-start justify-center no-underline">
                  <span className="-mt-3 flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent text-accent-ink shadow-lg"><Plus size={28} strokeWidth={2.8} aria-hidden="true" /></span>
                </a>
              );
            }
            return (
              <a key={id} href={href(n.to)} aria-current={on ? 'page' : undefined} className={cx('flex h-12 flex-col items-center justify-center gap-1 text-[11px] font-semibold no-underline', on ? 'text-route' : 'text-muted')}>
                <n.icon size={23} aria-hidden="true" />{n.short}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
