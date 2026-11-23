import { useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, MapPin, Star } from 'lucide-react';
import { gymDisciplines, useStore } from '../store/Store';
import { useToast } from '../components/Toast';
import { Bar, Button, Card, Chip, Empty, H2, IconButton, Segmented, Stat, cx, inputCls } from '../components/ui';
import { DISCIPLINE_LABEL } from '../data/gyms';
import { gymStats, pct } from '../lib/stats';
import { gradeAvgLabel, gradeLabel } from '../lib/grades';
import { fmtDayYear } from '../lib/dates';
import { setCurrentGym, setGymOverride, toggleFavorite } from '../store/actions';
import { href, navigate } from '../lib/router';
import type { Discipline } from '../types';
import { ProBadge, usePro, useUpsell } from '../lib/pro';

export function GymDetail({ id }: { id: string }) {
  const { data, update, gymById, override } = useStore();
  const { isPro } = usePro();
  const upsell = useUpsell();
  const toast = useToast();
  const g = gymById(id);
  const o = override(id);
  const stats = useMemo(() => gymStats(id, data.climbs, data.sessions), [id, data.climbs, data.sessions]);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(o.gradeNote ?? '');
  if (!g) return <Empty title="Gym not found" action={<Button onClick={() => navigate('/gyms')}>All gyms</Button>} />;
  const dsc = gymDisciplines(g, o);
  const isFav = data.settings.favorites.includes(id);
  const current = data.settings.currentGymId === id;
  const t = stats.totals;
  const maxG = Math.max(1, ...stats.topGrades.map((x) => x.n));
  const toggleDisc = (d: Discipline) => {
    const cur = (o.disciplines ?? g.disciplines ?? []) as Discipline[];
    update((x) => setGymOverride(x, id, { disciplines: cur.includes(d) ? cur.filter((v) => v !== d) : [...cur, d] }));
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <IconButton label="Back to gyms" onClick={() => navigate('/gyms')}><ArrowLeft size={20} aria-hidden="true" /></IconButton>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-muted">{g.brand} · {g.city}{g.state ? ', ' + g.state : ''}</span>
          <h1 className="m-0 font-display text-[28px] font-extrabold leading-tight tracking-tight">{g.name}</h1>
        </div>
        <IconButton label={isFav ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={isFav} onClick={() => update((d) => toggleFavorite(d, id))}>
          <Star size={20} className={isFav ? 'text-[#E0A800]' : 'text-muted'} fill={isFav ? '#FFC94A' : 'none'} aria-hidden="true" />
        </IconButton>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button variant={current ? 'secondary' : 'primary'} disabled={current} onClick={() => { update((d) => setCurrentGym(d, id)); toast('Climbing at ' + g.name); }}><MapPin size={18} aria-hidden="true" />{current ? 'Current gym' : 'Set as current gym'}</Button>
        <Button variant="ghost" onClick={() => navigate('/compare?a=' + id)}>Compare with another gym</Button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="flex flex-col gap-3">
          <H2 right={<button onClick={() => setEditing(!editing)} className="text-[13px] font-semibold text-route">{editing ? 'Done' : 'Edit details'}</button>}>About</H2>
          {g.description && <p className="m-0 text-sm">{g.description}</p>}
          <dl className="m-0 grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm [overflow-wrap:anywhere]">
            <dt className="text-muted">Address</dt><dd className="m-0">{g.address ?? <span className="text-muted">Not listed on the brand’s locations page</span>}</dd>
            <dt className="text-muted">Website</dt><dd className="m-0">{g.website ? <a href={g.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-route">{g.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}<ExternalLink size={13} aria-hidden="true" /></a> : '—'}</dd>
            <dt className="text-muted">Climbing</dt>
            <dd className="m-0 flex flex-wrap gap-1">
              {dsc.list.length ? dsc.list.map((d) => <span key={d} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold">{DISCIPLINE_LABEL[d]}</span>) : <span className="text-boulder">Not listed. Add what you know.</span>}
              {dsc.source && <span className={cx('rounded-md px-2 py-0.5 text-xs font-semibold', dsc.source === 'user' ? 'bg-blue/15 text-blue' : 'bg-accent/15 text-route')}>{dsc.source === 'user' ? 'Set by you' : '✓ From gym site'}</span>}
            </dd>
            {g.amenities.length > 0 && (<><dt className="text-muted">Amenities</dt><dd className="m-0 text-muted">{g.amenities.join(' · ')}</dd></>)}
          </dl>
          {editing && (
            <div className="anim-fade flex flex-col gap-3 rounded-2xl border border-line bg-bg p-3.5">
              <span className="text-[13px] text-muted">What can you climb here? Your edits stay on your account and override the listing.</span>
              <div className="flex flex-wrap gap-2">{(Object.keys(DISCIPLINE_LABEL) as Discipline[]).map((d) => <Chip key={d} selected={dsc.list.includes(d)} onClick={() => toggleDisc(d)}>{DISCIPLINE_LABEL[d]}</Chip>)}</div>
              {o.disciplines && g.disciplines && <Button size="sm" variant="ghost" onClick={() => update((x) => setGymOverride(x, id, { disciplines: undefined }))}>Use the gym site’s list again</Button>}
            </div>
          )}
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold">Grading at this gym{!isPro && <ProBadge />}</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex-1 text-xs text-muted">Grades feel {o.gradeAdjust ? (o.gradeAdjust > 0 ? 'hard' : 'soft') + ' here. Comparisons can shift them by ' + (o.gradeAdjust > 0 ? '+' : '') + o.gradeAdjust + '.' : 'on grade. Set an adjustment if they don’t.'}</span>
              <Segmented size="sm" label="Grade adjustment" value={String(o.gradeAdjust ?? 0)} onChange={(v) => (isPro ? update((x) => setGymOverride(x, id, { gradeAdjust: Number(v) })) : upsell({ title: 'Grade adjustments are part of Pro', body: 'Mark a gym’s grades as soft or hard, and gym comparisons line your numbers up fairly.' }))} options={[{ value: '-1', label: '−1 soft' }, { value: '0', label: '±0' }, { value: '1', label: '+1 hard' }]} />
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">Grading notes
              <textarea rows={2} className={cx(inputCls, 'resize-none')} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => update((x) => setGymOverride(x, id, { gradeNote: note.trim() || undefined }))} placeholder="e.g. Cave problems run hard, slabs soft" />
            </label>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {stats.visits === 0 ? (
            <Empty title="No climbs here yet" body="Your stats at this gym appear after your first session." action={<Button variant="primary" onClick={() => { update((d) => setCurrentGym(d, id)); navigate('/log'); }}>Log a climb here</Button>} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Visits" value={stats.visits} sub={stats.lastVisit ? 'Last ' + fmtDayYear(stats.lastVisit) : ''} />
                <Stat label="Climbs" value={t.climbs} sub={t.sends + ' sends'} />
                <Stat label="Hardest boulder" value={gradeLabel('boulder', t.topBoulder)} tone="boulder" sub={'Avg ' + gradeAvgLabel('boulder', t.avgBoulder)} />
                <Stat label="Hardest route" value={gradeLabel('route', t.topRoute)} tone="route" sub={'Avg ' + gradeAvgLabel('route', t.avgRoute)} />
                <Stat label="Flash rate" value={pct(t.flashRate)} />
                <Stat label="On-sight rate" value={pct(t.onsightRate)} />
                <Stat label="Attempts / send" value={t.attemptsPerSend == null ? '—' : t.attemptsPerSend.toFixed(1)} />
                <Stat label="Best session" value={stats.best ? stats.best.sends + ' sends' : '—'} sub={stats.best ? fmtDayYear(stats.best.session.startedAt) : ''} />
              </div>
              <Card className="flex flex-col gap-2.5">
                <H2>Most climbed grades</H2>
                {stats.topGrades.map((x) => (
                  <div key={x.grade} className="flex items-center gap-3">
                    <span className="w-14 font-mono text-[13px] font-bold">{x.grade}</span>
                    <Bar value={(x.n / maxG) * 100} tone={x.grade.startsWith('V') ? 'boulder' : 'route'} className="h-2.5 flex-1" />
                    <span className="w-8 text-right font-mono text-xs text-muted">{x.n}</span>
                  </div>
                ))}
              </Card>
              <Card className="flex flex-col gap-1">
                <H2>Recent sessions here</H2>
                {stats.recent.map((r) => (
                  <a key={r.session.id} href={href('/session/' + r.session.id)} className="flex min-h-12 items-center gap-3 border-t border-surface-2 pt-2 text-ink no-underline first:border-0">
                    <span className="flex flex-1 flex-col"><span className="text-sm font-semibold">{fmtDayYear(r.session.startedAt)}</span><span className="text-xs text-muted">{r.climbs} climbs · {r.sends} sends</span></span>
                    {r.topB != null && <b className="font-display text-boulder">{gradeLabel('boulder', r.topB)}</b>}
                    {r.topR != null && <b className="font-display text-route">{gradeLabel('route', r.topR)}</b>}
                  </a>
                ))}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
