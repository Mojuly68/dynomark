import type { AppData } from '../types';

/**
 * Persistence boundary. The prototype keeps everything in localStorage.
 * To add a real backend, implement this interface against your API
 * (auth token + REST/GraphQL) and pass it to <StoreProvider store={...}>.
 */
export interface DataStore {
  load(): AppData | null;
  save(data: AppData): void;
  clear(): void;
}

// Storage key keeps the app's original name so existing climbing logs carry over after the rename to DYNOMARK.
const KEY = 'send.data.v1';

export const localStore: DataStore = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AppData;
      return parsed && parsed.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  },
  save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('DYNOMARK: could not save to localStorage', e);
    }
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
