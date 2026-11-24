import { syncStatusBar } from '../lib/native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, Gym, GymOverride, ID } from '../types';
import { DIRECTORY } from '../data/gyms';
import { createDemoData } from '../data/demo';
import { localStore, type DataStore } from './storage';
import { normalize } from './actions';
import { markInstall } from '../lib/membership';

interface StoreValue {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  replace: (d: AppData) => void;
  gyms: Gym[];
  gymById: (id: ID | null | undefined) => Gym | undefined;
  override: (id: ID) => GymOverride;
}

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children, store = localStore }: { children: ReactNode; store?: DataStore }) {
  const [data, setData] = useState<AppData>(() => {
    const saved = store.load();
    markInstall(!!saved);
    return normalize(saved ?? createDemoData());
  });
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; store.save(data); return; }
    const t = setTimeout(() => store.save(data), 250);
    return () => clearTimeout(t);
  }, [data, store]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
    void syncStatusBar(data.settings.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', data.settings.theme === 'light' ? '#F3F2ED' : '#111214');
  }, [data.settings.theme]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);
  const replace = useCallback((d: AppData) => setData(d), []);
  const gyms = useMemo(() => [...DIRECTORY, ...data.customGyms], [data.customGyms]);
  const map = useMemo(() => new Map(gyms.map((g) => [g.id, g])), [gyms]);
  const value = useMemo<StoreValue>(() => ({
    data, update, replace, gyms,
    gymById: (id) => (id ? map.get(id) : undefined),
    override: (id) => data.gymOverrides[id] ?? {},
  }), [data, update, replace, gyms, map]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

/** Disciplines to show for a gym: the climber's own edit wins, then the gym site. */
export function gymDisciplines(g: Gym, o: GymOverride) {
  if (o.disciplines) return { list: o.disciplines, source: 'user' as const };
  if (g.disciplines) return { list: g.disciplines, source: 'gym-site' as const };
  return { list: [] as string[], source: null };
}
