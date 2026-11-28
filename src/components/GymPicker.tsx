import { useMemo, useState } from 'react';
import { Check, ChevronDown, MapPin, Search, Star } from 'lucide-react';
import { useStore } from '../store/Store';
import { setHomeState, toggleFavorite } from '../store/actions';
import { Sheet, cx, inputCls } from './ui';
import { stateName } from '../data/gyms';
import { href } from '../lib/router';
import type { Gym, ID } from '../types';

/** The climber's state: the one they picked, else the state of their current gym. */
export function useHomeState() {
  const { data, gymById } = useStore();
  return data.settings.homeState || gymById(data.settings.currentGymId)?.state || '';
}

/** States that have at least one gym, with counts, for state pickers. */
export function useGymStates() {
  const { gyms } = useStore();
  return useMemo(() => {
    const m = new Map<string, number>();
    gyms.forEach((g) => { if (g.state) m.set(g.state, (m.get(g.state) ?? 0) + 1); });
    return Array.from(m.entries()).map(([code, n]) => ({ code, n, name: stateName(code) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [gyms]);
}

export function StateSelect({ value, onChange, id, className }: { value: string; onChange: (s: string) => void; id?: string; className?: string }) {
  const states = useGymStates();
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputCls, 'appearance-none pr-9', className)}>
      {!value && <option value="">Choose your state</option>}
      {states.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.n})</option>)}
    </select>
  );
}

type View = 'fav' | 'state';

/** Gym dropdown: your favourites, or the gyms in your state grouped by city. Search looks through every state. */
export function GymPicker({ value, onChange, label = 'Gym', compact }: { value: ID | null; onChange: (id: ID) => void; label?: string; compact?: boolean }) {
  const { gyms, gymById, data, update } = useStore();
  const home = useHomeState();
  const fav = useMemo(() => new Set(data.settings.favorites), [data.settings.favorites]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>(fav.size ? 'fav' : 'state');
  const visits = useMemo(() => {
    const m = new Map<string, number>();
    data.sessions.forEach((s) => m.set(s.gymId, (m.get(s.gymId) ?? 0) + 1));
    return m;
  }, [data.sessions]);

  const t = q.trim().toLowerCase();
  const byUse = (a: Gym, b: Gym) => (visits.get(b.id) ?? 0) - (visits.get(a.id) ?? 0) || a.name.localeCompare(b.name);
  const favorites = useMemo(() => gyms.filter((g) => fav.has(g.id)).sort(byUse), [gyms, fav, visits]); // eslint-disable-line
  const inState = useMemo(() => gyms.filter((g) => g.state === home), [gyms, home]);
  const groups = useMemo(() => {
    const src = t ? gyms.filter((g) => g.name.toLowerCase().includes(t) || g.city.toLowerCase().includes(t) || g.brand.toLowerCase().includes(t)) : inState;
    const m = new Map<string, Gym[]>();
    src.forEach((g) => { const k = t ? g.city + (g.state ? ', ' + g.state : '') : g.city; m.set(k, [...(m.get(k) ?? []), g]); });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([city, list]) => ({ city, list: list.sort(byUse) }));
  }, [t, gyms, inState, visits]); // eslint-disable-line

  const cur = gymById(value);
  const pick = (id: ID) => { onChange(id); setOpen(false); setQ(''); };
  const showFav = !t && view === 'fav';

  const row = (g: Gym, showState = false) => {
    const isFav = fav.has(g.id);
    return (
      <li key={g.id} className={cx('flex items-center gap-1 rounded-xl', g.id === value && 'bg-surface-2')}>
        <button type="button" onClick={() => pick(g.id)} className="flex min-h-13 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-2">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold leading-snug">{g.name}</span>
            <span className="text-xs text-muted">{g.city}{showState && g.state ? ', ' + g.state : ''} · {g.brand}{visits.get(g.id) ? ' · ' + visits.get(g.id) + ' visits' : ''}</span>
          </span>
          {g.id === value && <Check size={18} className="shrink-0 text-route" aria-label="Selected" />}
        </button>
        <button type="button" aria-pressed={isFav} aria-label={(isFav ? 'Remove ' : 'Add ') + g.name + (isFav ? ' from favorites' : ' to favorites')} onClick={() => update((d) => toggleFavorite(d, g.id))} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl hover:bg-surface-2">
          <Star size={20} className={isFav ? 'text-[#E0A800]' : 'text-muted'} fill={isFav ? '#FFC94A' : 'none'} aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => { setView(fav.size ? 'fav' : 'state'); setOpen(true); }} className={cx('flex w-full min-w-0 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 text-left', compact ? 'min-h-12' : 'min-h-14')}>
        <MapPin size={19} className="shrink-0 text-route" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted">{label}</span>
          <span className="truncate text-[15px] font-semibold">{cur ? cur.name + ' · ' + cur.city : 'Choose a gym'}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Choose gym">
        <div role="group" aria-label="Show" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-[3px]">
          {([['fav', 'Favorites · ' + favorites.length], ['state', home ? stateName(home) : 'My state']] as [View, string][]).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={view === v && !t} onClick={() => { setView(v); setQ(''); }} className={cx('min-h-10 rounded-[9px] px-2 py-1.5 text-[13px] font-semibold leading-tight', view === v && !t ? 'bg-ink text-bg' : 'text-muted')}>{l}</button>
          ))}
        </div>

        {!showFav && !t && (
          <label className="flex flex-col gap-1.5 text-[13px] text-muted">
            Your state
            <StateSelect value={home} onChange={(s) => update((d) => setHomeState(d, s))} />
          </label>
        )}

        <label className="relative block">
          <span className="sr-only">Search all gyms by name, city or brand</span>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-[15px] text-muted" aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all gyms" className={cx(inputCls, 'pl-10')} />
        </label>

        {showFav && (
          favorites.length ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Favorite gyms">{favorites.map((g) => row(g, true))}</ul>
          ) : (
            <p className="m-0 rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">No favorites yet. Open <button type="button" className="font-semibold text-route underline" onClick={() => setView('state')}>{home ? stateName(home) : 'your state'}</button> and tap the star next to your gyms.</p>
          )
        )}

        {!showFav && (
          <div className="flex flex-col gap-3">
            {!home && !t && <p className="m-0 text-sm text-muted">Pick your state to see its gyms, or search above.</p>}
            {groups.map((grp) => (
              <section key={grp.city} aria-label={grp.city} className="flex flex-col gap-1">
                <h3 className="m-0 px-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">{grp.city}</h3>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">{grp.list.map((g) => row(g, !!t))}</ul>
              </section>
            ))}
            {t && groups.length === 0 && <p className="m-0 py-6 text-center text-sm text-muted">No gyms match “{q.trim()}”.</p>}
          </div>
        )}
        <a href={href('/gyms')} onClick={() => setOpen(false)} className="self-center py-2 text-[13px] font-semibold">Can't find your gym? Add it in My Gyms</a>
      </Sheet>
    </>
  );
}
