import { isNative } from './native';

// Founding members: everyone who got the all-free 1.0 keeps Pro for free, for life.
// Two sources, either one is enough:
//  1. Apple's record of the first DYNOMARK build this Apple ID downloaded (lib/billing.ts StoreStatus.firstBuild).
//     It follows the person across reinstalls and new phones. Checked at every launch and on Restore purchases.
//  2. A marker on this device: the first build with this code that found an existing climbing log (only 1.0 wrote
//     logs without the install marker). Works offline and before the store answers.
// Kept in their own keys, outside the climbing log, so "Start fresh" or loading the demo never removes them.
const INSTALL_KEY = 'dynomark.install';
const FOUNDER_KEY = 'dynomark.founder';

/**
 * Highest App Store build number of the all-free 1.0 (1.0 shipped as build 2; Pro starts with 1.1, builds 3 and up).
 * If 1.0 is ever re-released with a new build number, raise this to that number.
 */
export const FOUNDER_MAX_BUILD = 2;

export const isFounderBuild = (firstBuild: number | null | undefined) => firstBuild != null && firstBuild <= FOUNDER_MAX_BUILD;

/**
 * Run once at startup, before demo data is created. `hadData` = a climbing log already existed on this device.
 */
export function markInstall(hadData: boolean) {
  try {
    if (localStorage.getItem(INSTALL_KEY)) return;
    const now = new Date().toISOString();
    localStorage.setItem(INSTALL_KEY, JSON.stringify({ era: hadData ? 'free' : 'paid', at: now }));
    if (hadData && isNative()) localStorage.setItem(FOUNDER_KEY, now);
  } catch {
    /* storage unavailable: treat as a normal install */
  }
}

/** Remember founding membership on this device (e.g. after Apple confirmed it). */
export function markFounder(since?: string | null) {
  try {
    if (!localStorage.getItem(FOUNDER_KEY)) localStorage.setItem(FOUNDER_KEY, since || new Date().toISOString());
  } catch {
    /* ignore */
  }
}

/** When this install became a founding member, or null. */
export function founderSince(): string | null {
  try {
    return localStorage.getItem(FOUNDER_KEY);
  } catch {
    return null;
  }
}
