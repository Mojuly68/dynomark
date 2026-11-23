import { isNative } from './native';
import { useEffect, useState } from 'react';

/** Register the offline service worker (production builds only) and ask the browser to keep our data. */
export function registerOffline() {
  // The native (TestFlight) app ships its files inside the app, so it needs no service worker.
  if (isNative()) return;
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
  });
  // Ask for persistent storage so the browser doesn't clear the climbing log under storage pressure.
  navigator.storage?.persist?.().catch(() => false);
}

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as PromptEvent; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone/iPad Safari, including iPadOS that reports itself as a Mac. */
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** What the "Install the app" card should show. */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  const installed = isStandalone() || isNative();
  return {
    installed,
    ios: !installed && isIOS(),
    canPrompt: !installed && deferred != null,
    prompt: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null;
      force((n) => n + 1);
    },
  };
}

/** Fade out the in-page launch screen from index.html (safe to call more than once). */
export function hideLaunch() {
  const el = document.getElementById('launch');
  if (!el || el.dataset.hiding) return;
  el.dataset.hiding = '1';
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { el.remove(); return; }
  requestAnimationFrame(() => { el.style.opacity = '0'; });
  setTimeout(() => el.remove(), 350);
}
