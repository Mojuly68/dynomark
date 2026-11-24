import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useStore } from '../store/Store';
import { Button, Sheet } from '../components/ui';
import { navigate } from './router';
import type { AppData, ProPlan, ProState } from '../types';

/**
 * DYNOMARK Pro: free core, paid long-range insights.
 *
 * Purchases: the stores aren't connected yet. `purchase()` and `restore()` are the only places that
 * will talk to RevenueCat (App Store + Google Play billing) once the developer accounts and products exist.
 * Until then, a testing switch ("preview") unlocks Pro locally with no payment. Turn it off for store builds
 * with VITE_PRO_PREVIEW=false (codemagic.yaml does this), or Apple will reject a free unlock.
 */
export const PRO_PREVIEW = import.meta.env.VITE_PRO_PREVIEW !== 'false';
/** Set to true once purchase()/restore() really talk to the stores (RevenueCat + store products). */
export const PURCHASES_LIVE = false;
/**
 * Store build with no working purchases (v1.0): every feature is free and no Pro UI is shown,
 * because Apple rejects buy buttons that can't buy (Guideline 2.1).
 */
export const ALL_FREE = !PRO_PREVIEW && !PURCHASES_LIVE;

export interface PlanInfo { id: ProPlan; name: string; price: string; per: string; note: string; badge?: string; cta: string; fine: string }
/** Example prices until the store products exist; the stores will supply local prices. */
export const PLANS: PlanInfo[] = [
  { id: 'year', name: 'Yearly', price: '$34.99', per: '$2.92 / month', note: '7-day free trial', badge: 'Save 42%', cta: 'Start 7-day free trial',
    fine: '7 days free, then $34.99 per year. Renews automatically until you cancel. Cancel anytime in your App Store or Google Play settings at least 24 hours before renewal.' },
  { id: 'month', name: 'Monthly', price: '$4.99', per: 'per month', note: 'Cancel anytime', cta: 'Subscribe for $4.99 / month',
    fine: '$4.99 per month. Renews automatically until you cancel. Cancel anytime in your App Store or Google Play settings at least 24 hours before renewal.' },
  { id: 'life', name: 'Lifetime', price: '$79', per: 'one time', note: 'Pay once, keep Pro', cta: 'Unlock Pro for $79', fine: 'One-time purchase. No subscription and no renewals.' },
];

/** What Pro unlocks today. Only list features that exist (store review checks this). */
export const PRO_PERKS = [
  'Progress over 3 months, 6 months, a year and all time',
  'Monthly reports and your Year in climbing',
  'Gym comparisons and grade adjustments',
  'Hangboard % body-weight history',
  'Every share-card style',
];

export function usePro() {
  const { data } = useStore();
  const pro = data.settings.pro;
  return { isPro: ALL_FREE || !!pro, pro };
}

export const grantPro = (d: AppData, plan: ProPlan, source: ProState['source']): AppData =>
  ({ ...d, settings: { ...d.settings, pro: { plan, since: new Date().toISOString(), source } } });
export const endPro = (d: AppData): AppData => {
  const { pro: _pro, ...rest } = d.settings;
  void _pro;
  return { ...d, settings: rest };
};

/** Start a purchase. Today: unlocks the testing preview, or explains that purchases aren't open yet. */
export async function purchase(_plan: ProPlan): Promise<'preview' | 'unavailable'> {
  void _plan;
  return PRO_PREVIEW ? 'preview' : 'unavailable';
}
/** Restore earlier purchases from the user's Apple ID or Google account (needs the store connection). */
export async function restore(): Promise<'none' | 'unavailable'> {
  return PRO_PREVIEW ? 'none' : 'unavailable';
}

export const manageSubscriptionUrl = () =>
  /android/i.test(navigator.userAgent) ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions';

// ---------- Upsell sheet: one place that explains a locked feature and leads to the paywall ----------

interface Upsell { title: string; body: string }
const Ctx = createContext<(u: Upsell) => void>(() => undefined);
export const useUpsell = () => useContext(Ctx);

export function UpsellProvider({ children }: { children: ReactNode }) {
  const [u, setU] = useState<Upsell | null>(null);
  const open = useCallback((x: Upsell) => setU(x), []);
  const close = useCallback(() => setU(null), []);
  return (
    <Ctx.Provider value={open}>
      {children}
      <Sheet open={!!u} onClose={close} title={u?.title ?? 'DYNOMARK Pro'} footer={
        <div className="flex flex-col gap-1.5">
          <Button variant="primary" className="w-full" onClick={() => { close(); navigate('/pro'); }}>Try Pro free for 7 days</Button>
          <Button variant="ghost" className="w-full" onClick={close}>Not now</Button>
        </div>
      }>
        <span className="self-start rounded-md bg-accent px-2 py-0.5 text-xs font-black tracking-[0.08em] text-accent-ink">PRO</span>
        <p className="m-0 text-sm leading-relaxed text-muted">{u?.body}</p>
        <svg viewBox="0 0 346 70" className="h-[70px] w-full rounded-xl bg-bg" aria-hidden="true" preserveAspectRatio="none">
          <polyline points="10,58 50,56 90,52 130,50 170,42 210,40 250,30 290,26 336,14" fill="none" stroke="var(--c-route)" strokeWidth="3" strokeLinejoin="round" />
          <line x1="10" y1="60" x2="336" y2="16" stroke="var(--c-route)" strokeWidth="1.5" strokeDasharray="4 5" opacity="0.45" />
        </svg>
      </Sheet>
    </Ctx.Provider>
  );
}

/** A label with a small lock for free users, e.g. a locked time range. */
export function LockLabel({ children, locked }: { children: ReactNode; locked: boolean }) {
  return useMemo(() => (
    <span className="inline-flex items-center gap-1">
      {children}
      {locked && <><Lock size={11} strokeWidth={2.6} aria-hidden="true" /><span className="sr-only"> (Pro)</span></>}
    </span>
  ), [children, locked]);
}

export function ProBadge({ className = '' }: { className?: string }) {
  return <span className={'inline-flex rounded-md bg-accent px-1.5 py-px text-[10px] font-black tracking-[0.08em] text-accent-ink ' + className}>PRO</span>;
}

/** Full-screen stand-in for a Pro-only screen (reports, gym comparison). */
export function ProGate({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[22px] border border-accent/40 bg-accent/10 p-5">
      <ProBadge />
      <h2 className="m-0 font-display text-2xl font-black leading-tight">{title}</h2>
      <p className="m-0 text-sm leading-relaxed text-muted">{body}</p>
      {children}
      <Button variant="primary" onClick={() => navigate('/pro')}>Try Pro free for 7 days</Button>
    </div>
  );
}
