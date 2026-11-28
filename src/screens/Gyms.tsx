import { useMemo, useState } from 'react';
import { MapPin, Plus, Search, Star } from 'lucide-react';
import { gymDisciplines, useStore } from '../store/Store';
import { useToast } from '../components/Toast';
import { Button, Chip, Empty, H1, IconButton, Sheet, cx, inputCls } from '../components/ui';
import { DISCIPLINE_LABEL, stateName } from '../data/gyms';
import { addCustomGym, setCurrentGym, setHomeState, toggleFavorite } from '../store/actions';
import { StateSelect, useHomeState } from '../components/GymPicker';
import { href, navigate } from '../lib/router';
import type { Discipline } from '../types';

type Filter = string;

export function Gyms() {
  const { data, update, replace, gyms, override } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const home = useHomeState();
  const [adding, setAdding] = useState(false);
  const visits = useMemo(() => {
    const m = new Map<string, number>();
    data.sessions.forEach((s) => m.set(s.gymId, (m.get(s.gymId) ?? 0) + 1));
    return m;
  }, [data.sessions]);
  const fav = new Set(data.settings.favorites);
  const t = q.trim().toLowerCase();
  // Search looks through every state; without a search, the list shows your state (favorites always show).
  const match = (g: (typeof gyms)[number]) => (t ? g.name.toLowerCase().includes(t) || g.city.toLowerCase().includes(t) || g.brand.toLowerCase().includes(t) : g.state === home || fav.has(g.id) || (filter === 'Custom' && g.brand === 'Custom'));
  const inF = (g: (typeof gyms)[number], f: Filter) => f === 'all' || (f === 'visited' ? visits.has(g.id) : f === 'fav' ? fav.has(g.id) : g.brand === f);
  const list = gyms.filter((g) => match(g) && inF(g, filter)).sort((a, b) => a.city.localeCompare(b.city) || (visits.get(b.id) ?? 0) - (visits.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  const brandsHere = Array.from(new Set(gyms.filter((g) => g.state === home && g.brand !== 'Custom').map((g) => g.brand))).sort();
  const filters: { v: Filter; l: string }[] = [{ v: 'all', l: 'All' }, { v: 'visited', l: 'Visited' }, { v: 'fav', l: '★ Favorites' }, ...brandsHere.map((b) => ({ v: b as Filter, l: b })), ...(data.customGyms.length ? [{ v: 'Custom' as Filter, l: 'Added by you' }] : [])];
  const cur = gyms.find((g) => g.id === data.settings.currentGymId);

  const [form, setForm] = useState({ name: '', city: '', state: '', address: '', website: '', disc: [] as Discipline[] });
  const saveGym = () => {
    if (!form.name.trim() || !form.city.trim()) { toast('Add a name and city'); return; }
    const r = addCustomGym(data, { name: form.name.trim(), city: form.city.trim(), state: form.state || home, address: form.address.trim() || undefined, website: form.website.trim(), disciplines: form.disc.length ? form.disc : null, amenities: [] });
    replace(r.data);
    setAdding(false);
    setForm({ name: '', city: '', state: '', address: '', website: '', disc: [] });
    toast('Added ' + r.gym.name);
    navigate('/gyms/' + r.gym.id);
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <H1 sub={gyms.length + ' gyms in ' + new Set(gyms.map((g) => g.state).filter(Boolean)).size + ' states'}>My Gyms</H1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate('/compare')}>Compare</Button>
          <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={18} aria-hidden="true" />Add gym</Button>
        </div>
      </header>

      {cur && (
        <a href={href('/gyms/' + cur.id)} className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-3.5 py-3 text-ink no-underline">
          <MapPin size={20} className="text-route" aria-hidden="true" />
          <span className="flex flex-1 flex-col"><span className="text-[11px] uppercase tracking-[0.08em] text-route">Climbing at</span><b>{cur.name}</b></span>
          <span className="text-xs text-muted">{cur.city}</span>
        </a>
      )}

      <label className="flex flex-col gap-1.5 text-[13px] text-muted">
        Your state
        <StateSelect value={home} onChange={(st) => { update((d) => setHomeState(d, st)); setFilter('all'); }} />
      </label>
      <label className="relative block">
        <span className="sr-only">Search all gyms by name, city or brand</span>
        <Search size={18} className="pointer-events-none absolute left-3.5 top-[15px] text-muted" aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all states" className={cx(inputCls, 'pl-10')} />
      </label>
      <div role="group" aria-label="Filter gyms" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
        {filters.map((f) => (
          <Chip key={f.v} selected={filter === f.v} onClick={() => setFilter(f.v)}>{f.l} <span className="font-mono opacity-70">{gyms.filter((g) => match(g) && inF(g, f.v)).length}</span></Chip>
        ))}
      </div>
      <p aria-live="polite" className="m-0 text-xs text-muted">{list.length} gym{list.length === 1 ? '' : 's'}{t ? ' matching “' + q.trim() + '” in all states' : home ? ' in ' + stateName(home) + (fav.size ? ' plus your favorites' : '') : ''}</p>

      {list.length === 0 && <Empty title="No gyms match" body="Try another search, or add the gym yourself." action={<Button onClick={() => { setQ(''); setFilter('all'); }}>Clear filters</Button>} />}

      <ul className="m-0 grid list-none gap-2.5 p-0 md:grid-cols-2 xl:grid-cols-3">
        {list.map((g) => {
          const dsc = gymDisciplines(g, override(g.id));
          const isFav = fav.has(g.id);
          const current = data.settings.currentGymId === g.id;
          return (
            <li key={g.id} className={cx('flex flex-col gap-2 rounded-[18px] border bg-surface p-3.5', current ? 'border-accent/50' : 'border-line')}>
              <div className="flex items-start gap-2">
                <a href={href('/gyms/' + g.id)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-ink no-underline">
                  <span className="flex items-center gap-2"><b className="text-[15px] leading-snug">{g.name}</b>{current && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-accent-ink">CURRENT</span>}</span>
                  <span className="text-xs text-muted">{g.city}{g.state ? ', ' + g.state : ''} · {g.brand}{visits.get(g.id) ? ' · ' + visits.get(g.id) + ' visits' : ''}</span>
                </a>
                <IconButton label={(isFav ? 'Remove ' : 'Add ') + g.name + (isFav ? ' from favorites' : ' to favorites')} aria-pressed={isFav} onClick={() => update((d) => toggleFavorite(d, g.id))} className="bg-transparent">
                  <Star size={20} className={isFav ? 'text-[#E0A800]' : 'text-muted'} fill={isFav ? '#FFC94A' : 'none'} aria-hidden="true" />
                </IconButton>
              </div>
              <div className="flex flex-wrap gap-1">
                {dsc.list.map((d) => <span key={d} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-semibold">{DISCIPLINE_LABEL[d]}</span>)}
                {dsc.source === 'gym-site' && <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-route">✓ From gym site</span>}
                {dsc.source === 'user' && <span className="rounded-md bg-blue/15 px-2 py-0.5 text-[11px] font-semibold text-blue">Set by you</span>}
                {dsc.source === null && <a href={href('/gyms/' + g.id)} className="rounded-md bg-orange/15 px-2 py-0.5 text-[11px] font-semibold text-boulder">Disciplines not listed · add</a>}
              </div>
              {!current && <Button size="sm" variant="ghost" onClick={() => { update((d) => setCurrentGym(d, g.id)); toast('Climbing at ' + g.name); }}>Set as current gym</Button>}
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-[11px] leading-relaxed text-muted">Gym list from each operator’s own website (Nov 2026): Touchstone, Benchmark, Bridges, Movement, Central Rock Gym, The Gravity Vault, Bouldering Project, Hangar 18, Climbing Collective, Rock Spot, Momentum, VITAL and High Point. Where a site doesn’t list an address or climbing types, they’re yours to fill in. “From gym site” means the gym’s own page states it.</p>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a gym" footer={<Button variant="primary" className="w-full" onClick={saveGym}>Save gym</Button>}>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Name<input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">City<input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">State<StateSelect value={form.state || home} onChange={(st) => setForm({ ...form, state: st })} /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Address (optional)<input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Website (optional)<input type="url" className={inputCls} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" /></label>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-muted">Climbing types</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DISCIPLINE_LABEL) as Discipline[]).map((d) => <Chip key={d} selected={form.disc.includes(d)} onClick={() => setForm({ ...form, disc: form.disc.includes(d) ? form.disc.filter((x) => x !== d) : [...form.disc, d] })}>{DISCIPLINE_LABEL[d]}</Chip>)}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
