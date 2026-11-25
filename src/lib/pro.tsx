import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useStore } from '../store/Store';
import { BILLING_READY, buy, onStoreChange, restoreStore, storeStatus, type StoreStatus } from './billing';
import { founderSince, isFounderBuild, markFounder } from './membership';
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
/** True in native store builds that have a RevenueCat key (lib/billing.ts): real purchases. */
export const PURCHASES_LIVE = !PRO_PREVIEW && BILLING_READY;
/**
 * Store build with no working purchases (v1.0): every feature is free and no Pro UI is shown,
 * because Apple rejects buy buttons that can't buy (Guideline 2.1).
 */
export const ALL_FREE = !PRO_PREVIEW && !PURCHASES_LIVE;

/** `trial` = free-trial days the store will really give this customer (null = no trial: never promise one). */
export interface PlanInfo {
  id: ProPlan; name: string; price: string; per: string; badge?: string;
  note: (trial: number | null) => string;
  cta: (price: string, trial: number | null) => string;
  fine: (price: string, trial: number | null) => string;
}
const RENEWS = 'Renews automatically until you cancel. Cancel anytime in your App Store or Google Play settings at least 24 hours before renewal.';
/**
 * US prices as set in App Store Connect. In store builds the paywall replaces them with the store's own
 * local price strings and trial eligibility (lib/billing.ts storePrices), so the button and fine print match the charge.
 */
export const PLANS: PlanInfo[] = [
  { id: 'year', name: 'Yearly', price: '$19.99', per: '$1.67 / month', badge: 'Save 44%',
    note: (t) => (t ? `${t}-day free trial` : 'Best value'),
    cta: (p, t) => (t ? `Start ${t}-day free trial` : `Subscribe for ${p} / year`),
    fine: (p, t) => (t ? `${t} days free, then ${p} per year. ${RENEWS}` : `${p} per year. ${RENEWS}`) },
  { id: 'month', name: 'Monthly', price: '$2.99', per: 'per month', note: () => 'Cancel anytime', cta: (p) => `Subscribe for ${p} / month`,
    fine: (p) => `${p} per month. ${RENEWS}` },
  { id: 'life', name: 'Lifetime', price: '$49.99', per: 'one time', note: () => 'Pay once, keep Pro', cta: (p) => `Unlock Pro for ${p}`, fine: () => 'One-time purchase. No subscription and no renewals.' },
];
/** Trial shown in testing-preview builds (matches the store set-up); store builds use what the store reports. */
export const PREVIEW_TRIAL_DAYS = 30;

/** What Pro unlocks today. Only list features that exist (store review checks this). */
export const PRO_PERKS = [
  'Progress over 3 months, 6 months, a year and all time',
  'Monthly reports and your Year in climbing',
  'Gym comparisons and grade adjustments',
  'Hangboard % body-weight history',
  'Every share-card style',
];

/** Pro for this user: a store purchase, the testing preview, or founding membership (lib/membership.ts). */
export function usePro() {
  const { data } = useStore();
  const founder = founderSince();
  const pro: ProState | undefined = data.settings.pro ?? (founder ? { plan: 'life', since: founder, source: 'founder' } : undefined);
  return { isPro: ALL_FREE || !!pro, pro };
}

/** Keeps settings.pro in step with the store: purchases, renewals, expiries, refunds, other devices. */
export function useProSync() {
  const { update } = useStore();
  useEffect(() => {
    if (!PURCHASES_LIVE) return;
    const apply = (s: StoreStatus) => {
      // Apple says this Apple ID first downloaded the all-free 1.0: founding member, on any phone, after any reinstall.
      const founder = isFounderBuild(s.firstBuild);
      if (founder) markFounder(s.firstDownload);
      update((d) => {
        const cur = d.settings.pro;
        if (s.active) return cur?.source === 'store' && cur.plan === s.plan ? d : grantPro(d, s.plan ?? 'year', 'store', s.since);
        if (founder) return cur?.source === 'founder' ? d : grantPro(d, 'life', 'founder', founderSince() ?? undefined);
        return cur?.source === 'store' ? endPro(d) : d;
      });
    };
    storeStatus().then(apply).catch(() => undefined);
    onStoreChange(apply).catch(() => undefined);
  }, [update]);
}

export const grantPro = (d: AppData, plan: ProPlan, source: ProState['source'], since = new Date().toISOString()): AppData =>
  ({ ...d, settings: { ...d.settings, pro: { plan, since, source } } });
export const endPro = (d: AppData): AppData => {
  const { pro: _pro, ...rest } = d.settings;
  void _pro;
  return { ...d, settings: rest };
};

export type PurchaseResult = { kind: 'preview' } | { kind: 'purchased'; status: StoreStatus } | { kind: 'cancelled' } | { kind: 'unavailable' } | { kind: 'error'; message: string };

/** Start a purchase: the store sheet in store builds, the free testing preview in testing builds. */
export async function purchase(plan: ProPlan): Promise<PurchaseResult> {
  if (PRO_PREVIEW) return { kind: 'preview' };
  if (!PURCHASES_LIVE) return { kind: 'unavailable' };
  try {
    const r = await buy(plan);
    if (r === 'cancelled') return { kind: 'cancelled' };
    return r.active ? { kind: 'purchased', status: r } : { kind: 'error', message: 'The store did not confirm the purchase. Try Restore purchases.' };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'The purchase could not be completed.' };
  }
}
/** Restore earlier purchases from the user's Apple ID or Google account. */
export async function restore(): Promise<{ kind: 'restored'; status: StoreStatus } | { kind: 'founder'; since: string | null } | { kind: 'none' } | { kind: 'unavailable' } | { kind: 'error'; message: string }> {
  if (PRO_PREVIEW) return { kind: 'none' };
  if (!PURCHASES_LIVE) return { kind: 'unavailable' };
  try {
    const s = await restoreStore();
    if (s.active) return { kind: 'restored', status: s };
    if (isFounderBuild(s.firstBuild)) { markFounder(s.firstDownload); return { kind: 'founder', since: founderSince() }; }
    return { kind: 'none' };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : 'Restore could not be completed.' };
  }
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
          <Button variant="primary" className="w-full" onClick={() => { close(); navigate('/pro'); }}>See Pro plans</Button>
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
      <Button variant="primary" onClick={() => navigate('/pro')}>See Pro plans</Button>
    </div>
  );
}
