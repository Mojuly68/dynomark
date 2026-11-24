import { isNative } from './native';

// Founding members: everyone who installed the all-free 1.0 in the native app keeps Pro for free.
// Kept in their own keys, outside the climbing log, so "Start fresh" or loading the demo never removes them.
const INSTALL_KEY = 'dynomark.install';
const FOUNDER_KEY = 'dynomark.founder';

/**
 * Run once at startup, before demo data is created. `hadData` = a climbing log already existed on this device.
 * 1.0 never wrote the install marker, so the first build with this code that finds an existing log
 * marks that install as a founding member. New installs are marked as paid-era installs.
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

/** When this install became a founding member, or null. */
export function founderSince(): string | null {
  try {
    return localStorage.getItem(FOUNDER_KEY);
  } catch {
    return null;
  }
}
