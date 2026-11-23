import { useMemo, useState } from 'react';
import { Check, ChevronDown, MapPin, Search, Star } from 'lucide-react';
import { useStore } from '../store/Store';
import { Sheet, cx, inputCls } from './ui';
import type { ID } from '../types';

/** Searchable gym dropdown: favourites and visited gyms first. */
export function GymPicker({ value, onChange, label = 'Gym', compact }: { value: ID | null; onChange: (id: ID) => void; label?: string; compact?: boolean }) {
  const { gyms, gymById, data } = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const visits = useMemo(() => {
    const m = new Map<string, number>();
    data.sessions.forEach((s) => m.set(s.gymId, (m.get(s.gymId) ?? 0) + 1));
    return m;
  }, [data.sessions]);
  const fav = new Set(data.settings.favorites);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return gyms
      .filter((g) => !t || g.name.toLowerCase().includes(t) || g.city.toLowerCase().includes(t) || g.brand.toLowerCase().includes(t))
      .sort((a, b) => Number(fav.has(b.id)) - Number(fav.has(a.id)) || (visits.get(b.id) ?? 0) - (visits.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  }, [gyms, q, visits, data.settings.favorites]); // eslint-disable-line
  const cur = gymById(value);
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={cx('flex w-full min-w-0 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 text-left', compact ? 'min-h-12' : 'min-h-14')}>
        <MapPin size={19} className="shrink-0 text-route" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted">{label}</span>
          <span className="truncate text-[15px] font-semibold">{cur ? cur.name + ' · ' + cur.city : 'Choose a gym'}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Choose gym">
        <label className="relative block">
          <span className="sr-only">Search gyms by name, city or brand</span>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-[15px] text-muted" aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or city" className={cx(inputCls, 'pl-10')} />
        </label>
        <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Gyms">
          {list.map((g) => (
            <li key={g.id}>
              <button type="button" onClick={() => { onChange(g.id); setOpen(false); setQ(''); }} className={cx('flex min-h-13 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-surface-2', g.id === value && 'bg-surface-2')}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{g.name}</span>
                  <span className="text-xs text-muted">{g.city} · {g.brand}{visits.get(g.id) ? ' · ' + visits.get(g.id) + ' visits' : ''}</span>
                </span>
                {fav.has(g.id) && <Star size={16} className="text-[#FFC94A]" fill="#FFC94A" aria-label="Favorite" />}
                {g.id === value && <Check size={18} className="text-route" aria-label="Selected" />}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="py-6 text-center text-sm text-muted">No gyms match “{q}”. You can add one under My Gyms.</li>}
        </ul>
      </Sheet>
    </>
  );
}
