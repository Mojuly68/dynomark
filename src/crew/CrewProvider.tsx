import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { clearLocal, loadLocal, saveLocal, type CrewLocal } from './local';
import type { CrewApi, CrewProfile } from './types';

// Which Crew this build uses:
//  - live: a Supabase project is configured (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in codemagic.yaml / .env)
//  - demo: no server, web dev preview only (npm run dev, or VITE_CREW_DEMO=true): sample friends on this device, labelled
//  - off:  everything else (store apps and the public web app without a server, Android until it has Google sign-in)
// VITE_CREW=false hides Crew everywhere.
const HAS_SERVER = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const PLATFORM = Capacitor.getPlatform();
export const CREW_MODE: 'live' | 'demo' | 'off' =
  import.meta.env.VITE_CREW === 'false' || PLATFORM === 'android' ? 'off'
  : HAS_SERVER ? 'live'
  : PLATFORM === 'web' && (import.meta.env.DEV || import.meta.env.VITE_CREW_DEMO === 'true') ? 'demo' : 'off';
export const CREW_ON = CREW_MODE !== 'off';

export type CrewStatus = 'loading' | 'signed-out' | 'needs-username' | 'ready' | 'error';

interface CrewValue {
  mode: 'live' | 'demo';
  status: CrewStatus;
  me: CrewProfile | null;
  api: CrewApi | null;
  local: CrewLocal;
  setLocal: (fn: (l: CrewLocal) => CrewLocal) => void;
  refresh: () => Promise<void>;
  /** Clears everything Crew keeps on this device (after sign-out or account deletion). */
  forget: () => void;
  error: string | null;
}

const Ctx = createContext<CrewValue | null>(null);

async function makeApi(): Promise<CrewApi> {
  if (CREW_MODE === 'live') return (await import('./live')).liveApi();
  return (await import('./demo')).demoApi();
}

export function CrewProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<CrewApi | null>(null);
  const [status, setStatus] = useState<CrewStatus>('loading');
  const [me, setMe] = useState<CrewProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocalState] = useState<CrewLocal>(loadLocal);
  const apiRef = useRef<CrewApi | null>(null);

  const refresh = useCallback(async () => {
    const a = apiRef.current;
    if (!a) return;
    try {
      const cur = await a.current();
      setError(null);
      if (cur === null) { setMe(null); setStatus('signed-out'); }
      else if (cur === 'needs-username') { setMe(null); setStatus('needs-username'); }
      else { setMe(cur); setStatus('ready'); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Crew is unreachable right now.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!CREW_ON) return;
    let alive = true;
    makeApi().then((a) => { if (!alive) return; apiRef.current = a; setApi(a); void refresh(); }).catch(() => setStatus('error'));
    return () => { alive = false; };
  }, [refresh]);

  const setLocal = useCallback((fn: (l: CrewLocal) => CrewLocal) => {
    setLocalState((l) => { const n = fn(l); saveLocal(n); return n; });
  }, []);
  const forget = useCallback(() => { clearLocal(); setLocalState(loadLocal()); setMe(null); setStatus('signed-out'); }, []);

  const value = useMemo<CrewValue>(() => ({ mode: CREW_MODE === 'live' ? 'live' : 'demo', status, me, api, local, setLocal, refresh, forget, error }), [status, me, api, local, setLocal, refresh, forget, error]);
  if (!CREW_ON) return <>{children}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Crew state; null when Crew is off in this build. */
export const useCrew = () => useContext(Ctx);
