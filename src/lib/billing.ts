import { Capacitor } from '@capacitor/core';
import type { ProPlan } from '../types';

/**
 * Store purchases through RevenueCat (App Store + Google Play).
 * Only active in the native app when a RevenueCat public SDK key is set at build time
 * (VITE_RC_APPLE_KEY / VITE_RC_GOOGLE_KEY, in codemagic.yaml). These keys are public by design.
 * The plugin is imported lazily, so the web app never downloads it.
 */
export const PRODUCT_IDS: Record<ProPlan, string> = {
  year: 'com.studiovektor.dynomark.pro.yearly',
  month: 'com.studiovektor.dynomark.pro.monthly',
  life: 'com.studiovektor.dynomark.pro.lifetime',
};
/** RevenueCat entitlement that all three products unlock. */
export const ENTITLEMENT = 'dynomark_pro';

const platform = Capacitor.getPlatform();
const KEY: string | undefined =
  platform === 'ios' ? import.meta.env.VITE_RC_APPLE_KEY : platform === 'android' ? import.meta.env.VITE_RC_GOOGLE_KEY : undefined;

/** True when real store purchases can be made in this build. */
export const BILLING_READY = Capacitor.isNativePlatform() && !!KEY;

type RC = typeof import('@revenuecat/purchases-capacitor');
let rcReady: Promise<RC> | null = null;
function rc(): Promise<RC> {
  if (!BILLING_READY) return Promise.reject(new Error('Store purchases are not available in this build'));
  rcReady ??= import('@revenuecat/purchases-capacitor').then(async (m) => {
    await m.Purchases.configure({ apiKey: KEY! });
    return m;
  });
  return rcReady;
}

export interface StoreStatus { active: boolean; plan?: ProPlan; since?: string }

const planOf = (id: string): ProPlan => (id.includes('lifetime') ? 'life' : id.includes('monthly') ? 'month' : 'year');

type CustomerInfo = Awaited<ReturnType<RC['Purchases']['getCustomerInfo']>>['customerInfo'];
function statusOf(info: CustomerInfo): StoreStatus {
  const e = info.entitlements.active[ENTITLEMENT];
  return e ? { active: true, plan: planOf(e.productIdentifier), since: e.originalPurchaseDate } : { active: false };
}

/** Current Pro status from the store (source of truth for paid Pro). */
export async function storeStatus(): Promise<StoreStatus> {
  const m = await rc();
  return statusOf((await m.Purchases.getCustomerInfo()).customerInfo);
}

/** Buy a plan. Resolves 'cancelled' when the user backs out of the store sheet. */
export async function buy(plan: ProPlan): Promise<StoreStatus | 'cancelled'> {
  const m = await rc();
  const type = plan === 'life' ? m.PRODUCT_CATEGORY.NON_SUBSCRIPTION : m.PRODUCT_CATEGORY.SUBSCRIPTION;
  const { products } = await m.Purchases.getProducts({ productIdentifiers: [PRODUCT_IDS[plan]], type });
  if (!products[0]) throw new Error('This plan is not available in your store right now.');
  try {
    return statusOf((await m.Purchases.purchaseStoreProduct({ product: products[0] })).customerInfo);
  } catch (e) {
    const err = e as { code?: unknown; userCancelled?: boolean | null };
    if (err.userCancelled || err.code === m.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return 'cancelled';
    throw e;
  }
}

/** Restore purchases made with the same Apple ID / Google account. */
export async function restoreStore(): Promise<StoreStatus> {
  const m = await rc();
  return statusOf((await m.Purchases.restorePurchases()).customerInfo);
}

/** `freeTrialDays` is set only when the store has a free trial for this product AND this customer can still get it. */
export interface StorePrice { price: string; perMonth: string | null; freeTrialDays: number | null }
const UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

/** Local store prices (e.g. "€39.99"), so the paywall shows exactly what the store will charge. */
export async function storePrices(): Promise<Partial<Record<ProPlan, StorePrice>>> {
  const m = await rc();
  const [subs, once] = await Promise.all([
    m.Purchases.getProducts({ productIdentifiers: [PRODUCT_IDS.year, PRODUCT_IDS.month], type: m.PRODUCT_CATEGORY.SUBSCRIPTION }),
    m.Purchases.getProducts({ productIdentifiers: [PRODUCT_IDS.life], type: m.PRODUCT_CATEGORY.NON_SUBSCRIPTION }),
  ]);
  // Never promise a trial the store won't give: ask whether this Apple ID is still eligible.
  const withTrial = subs.products.filter((p) => p.introPrice?.price === 0).map((p) => p.identifier);
  const eligible = withTrial.length
    ? await m.Purchases.checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: withTrial }).catch(() => ({} as Record<string, { status: number }>))
    : {};
  const out: Partial<Record<ProPlan, StorePrice>> = {};
  for (const p of [...subs.products, ...once.products]) {
    const intro = p.introPrice;
    const ok = intro?.price === 0 && eligible[p.identifier]?.status !== m.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE;
    out[planOf(p.identifier)] = {
      price: p.priceString,
      perMonth: p.pricePerMonthString ?? null,
      freeTrialDays: ok && intro ? intro.periodNumberOfUnits * (UNIT_DAYS[intro.periodUnit] ?? 1) : null,
    };
  }
  return out;
}

/** Called whenever the store reports a change (renewal, expiry, refund, purchase on another device). */
export async function onStoreChange(cb: (s: StoreStatus) => void) {
  const m = await rc();
  await m.Purchases.addCustomerInfoUpdateListener((info) => cb(statusOf(info)));
}
