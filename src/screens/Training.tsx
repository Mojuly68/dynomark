import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, Search, Timer, Trash2, X } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/Store';
import { useToast } from '../components/Toast';
import { useNow } from '../components/Layout';
import { ChartTip } from '../components/charts';
import { Button, Card, Chip, DemoBadge, Empty, H1, H2, IconButton, Segmented, Sheet, cx, inputCls } from '../components/ui';
import { CATEGORY_LABEL } from '../data/exercises';
import { addExercise, discardTraining, finishTraining, saveRoutine, deleteRoutine, startTraining, updateTraining } from '../store/actions';
import { climbingWeekly, pearson, trainingWeekly } from '../lib/stats';
import { fmtClock, fmtDay, fmtDayYear, fmtDuration } from '../lib/dates';
import { gradeLabel } from '../lib/grades';
import { usePalette } from '../lib/theme';
import { LoadCalculator } from '../components/LoadCalculator';
import { isHang, pctBodyWeight, toKg } from '../lib/load';
import { haptic } from '../lib/native';
import type { Exercise, ExerciseCategory, ExerciseKind, TrainingEntry, TrainingSession, TrainingSet } from '../types';
import { LockLabel, usePro, useUpsell } from '../lib/pro';

const KIND_LABEL: Record<ExerciseKind, string> = { weight_reps: 'Weight × reps', weight_time: 'Added weight × time', reps: 'Reps', time: 'Time' };

function setSummary(e: TrainingEntry, ex: Exercise | undefined, unit: string) {
  const done = e.sets.filter((s) => s.done || s.reps != null || s.seconds != null);
  if (!done.length || !ex) return '—';
  return done.map((s) => {
    const w = s.weight ? (s.weight > 0 ? '+' : '−') + Math.abs(s.weight) + ' ' + unit + ' × ' : ex.kind === 'weight_reps' || ex.kind === 'weight_time' ? 'BW × ' : '';
    return w + (ex.kind === 'time' || ex.kind === 'weight_time' ? (s.seconds ?? 0) + 's' : (s.reps ?? 0));
  }).join(', ');
}

export function Training() {
  const { data } = useStore();
  const active = data.activeTrainingId ? data.training.find((t) => t.id === data.activeTrainingId) : undefined;
  return active ? <Workout t={active} /> : <Overview />;
}

function Overview() {
  const { data, update, replace } = useStore();
  const toast = useToast();
  const p = usePalette();
  const unit = data.settings.units;
  const exById = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);
  const done = data.training.filter((t) => t.endedAt).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const [openId, setOpenId] = useState<string | null>(null);
  const [routineSheet, setRoutineSheet] = useState(false);
  const [rName, setRName] = useState('');
  const [rEx, setREx] = useState<string[]>([]);
  const trainedIds = Array.from(new Set(done.flatMap((t) => t.entries.map((e) => e.exerciseId))));
  const [exId, setExId] = useState(trainedIds.includes('ex-maxhang') ? 'ex-maxhang' : trainedIds[0] ?? '');
  const [climbType, setClimbType] = useState<'boulder' | 'route'>('boulder');
  const [hangMode, setHangMode] = useState<'added' | 'pct'>('pct');

  const { isPro } = usePro();
  const upsell = useUpsell();
  const hangPct = isPro && isHang(exById.get(exId)) && hangMode === 'pct';
  const progress = useMemo(() => done.slice().reverse().map((t) => {
    const e = t.entries.find((x) => x.exerciseId === exId);
    if (!e) return null;
    if (hangPct) {
      // % body weight uses the weight saved with that workout, else today's profile weight.
      const bw = t.bodyWeightKg ?? data.user.weightKg;
      if (bw == null) return null;
      const added = Math.max(...e.sets.map((s) => s.weight ?? 0));
      return { label: fmtDay(t.startedAt), v: Math.round(pctBodyWeight(bw, toKg(added, unit))) };
    }
    const v = Math.max(...e.sets.map((s) => s.weight ?? s.seconds ?? s.reps ?? 0));
    return { label: fmtDay(t.startedAt), v };
  }).filter(Boolean) as { label: string; v: number }[], [done, exId, hangPct, data.user.weightKg, unit]);

  const corr = useMemo(() => {
    const tw = trainingWeekly(data.training, exId);
    const cw = climbingWeekly(data.climbs, climbType);
    const keys = Array.from(tw.keys()).filter((k) => cw.has(k)).sort();
    const xs = keys.map((k) => tw.get(k) as number), ys = keys.map((k) => cw.get(k) as number);
    const lo = (a: number[]) => Math.min(...a), hi = (a: number[]) => Math.max(...a);
    const norm = (a: number[], v: number) => (hi(a) === lo(a) ? 50 : ((v - lo(a)) / (hi(a) - lo(a))) * 100);
    return { r: pearson(xs, ys), n: keys.length, rows: keys.map((k, i) => ({ label: fmtDay(k + 'T12:00:00'), t: Math.round(norm(xs, xs[i])), c: Math.round(norm(ys, ys[i])), tv: xs[i], cv: ys[i] })) };
  }, [data.training, data.climbs, exId, climbType]);
  const ex = exById.get(exId);
  const exUnit = ex ? (hangPct ? '% body weight' : ex.kind === 'weight_reps' || ex.kind === 'weight_time' ? unit + ' added' : ex.kind === 'time' ? 's' : 'reps') : '';
  const strength = corr.r == null ? null : Math.abs(corr.r) >= 0.6 ? 'Strong' : Math.abs(corr.r) >= 0.3 ? 'Moderate' : 'Weak';

  const start = (routineId: string | null) => {
    const r = startTraining(data, routineId ? data.routines.find((x) => x.id === routineId) ?? null : null);
    replace(r.data);
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <H1 sub={data.user.isDemo ? <span className="inline-flex items-center gap-2"><DemoBadge />Sample training log</span> : done.length + ' workouts logged'}>Training</H1>
        <Button variant="primary" onClick={() => start(null)}><Plus size={18} strokeWidth={2.6} aria-hidden="true" />Empty workout</Button>
      </header>

      <section className="flex flex-col gap-2.5" aria-labelledby="rt-h">
        <H2 id="rt-h" right={<button className="text-[13px] font-semibold text-route" onClick={() => { setRName(''); setREx([]); setRoutineSheet(true); }}>New routine</button>}>Routines</H2>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {data.routines.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3.5">
              <div className="flex items-start gap-2">
                <span className="flex-1 font-display text-[17px] font-extrabold">{r.name}</span>
                <IconButton label={'Delete routine ' + r.name} className="h-9 w-9 bg-transparent text-muted" onClick={() => { update((d) => deleteRoutine(d, r.id)); toast('Deleted routine ' + r.name, { label: 'Undo', onClick: () => update((d) => ({ ...d, routines: [...d.routines, r] })) }); }}><Trash2 size={15} aria-hidden="true" /></IconButton>
              </div>
              <span className="text-xs text-muted">{r.exerciseIds.map((id) => exById.get(id)?.name ?? 'Exercise').join(' · ')}</span>
              <Button size="sm" variant="secondary" className="mt-auto" onClick={() => start(r.id)}>Start</Button>
            </div>
          ))}
        </div>
      </section>

      <LoadCalculator key={data.settings.units + (data.user.weightKg ?? '')} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <H2>Exercise progress</H2>
          {trainedIds.length === 0 ? <p className="m-0 text-sm text-muted">Finish a workout to see progress.</p> : (
            <>
              <select aria-label="Exercise" className={inputCls} value={exId} onChange={(e) => setExId(e.target.value)}>
                {trainedIds.map((id) => <option key={id} value={id}>{exById.get(id)?.name ?? id}</option>)}
              </select>
              {isHang(ex) && <Segmented size="sm" label="Show" value={hangPct ? 'pct' : 'added'} onChange={(v) => (v === 'pct' && !isPro ? upsell({ title: 'Hangboard history in % of body weight', body: 'Pro charts every hang as a share of your body weight, using the weight saved with each workout, so progress stays comparable as your weight changes.' }) : setHangMode(v))} options={[{ value: 'pct', label: <LockLabel locked={!isPro}>% body weight</LockLabel> }, { value: 'added', label: 'Added weight' }]} />}
              {hangPct && progress.length === 0 && <p className="m-0 text-sm text-muted">Add your weight in Profile to see hangs as % of body weight.</p>}
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progress} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke={p.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ stroke: p.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: p.grid }} minTickGap={24} />
                    <YAxis tick={{ stroke: p.muted, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip content={(tp: any) => <ChartTip {...tp} rows={(d: any) => [{ name: 'Best set', value: d.v + ' ' + exUnit, color: p.blue }]} />} />
                    <Line dataKey="v" stroke={p.blue} strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <span className="text-xs text-muted">Best set per workout, in {exUnit}.{hangPct ? ' Uses the body weight saved with each workout.' : ''}</span>
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <H2>Training and climbing</H2>
          <div className="flex flex-wrap gap-2">
            <Segmented size="sm" label="Climbing metric" value={climbType} onChange={setClimbType} options={[{ value: 'boulder', label: 'Top boulder' }, { value: 'route', label: 'Top route' }]} />
            <span className="self-center text-xs text-muted">vs {ex?.name ?? 'exercise'}, weekly</span>
          </div>
          {corr.n < 3 ? <p className="m-0 text-sm text-muted">Need at least 3 weeks with both training and climbing logged.</p> : (
            <>
              <div className="h-[170px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={corr.rows} margin={{ top: 8, right: 4, bottom: 0, left: -30 }}>
                    <XAxis dataKey="label" tick={{ stroke: p.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: p.grid }} minTickGap={28} />
                    <YAxis hide domain={[0, 100]} />
                    <Tooltip content={(tp: any) => <ChartTip {...tp} rows={(d: any) => [{ name: ex?.name ?? 'Training', value: d.tv + ' ' + exUnit, color: p.blue }, { name: climbType === 'boulder' ? 'Top boulder' : 'Top route', value: gradeLabel(climbType, d.cv), color: p.boulder }]} />} />
                    <Line dataKey="t" stroke={p.blue} strokeWidth={3} dot={false} isAnimationActive={false} />
                    <Line dataKey="c" stroke={p.boulder} strokeWidth={3} strokeDasharray="6 5" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <span className="flex items-baseline justify-between"><b className="text-sm">{strength} {corr.r != null && corr.r < 0 ? 'negative' : 'positive'} link</b><span className="font-mono text-[13px] text-blue">r = {corr.r?.toFixed(2)} · {corr.n} weeks</span></span>
                <p className="m-0 mt-1 text-xs leading-relaxed text-muted">This shows the two moved together in your logs, not that one caused the other. Sleep, skin, route setting, which climbs you picked and plain time on the wall all play a part.</p>
              </div>
            </>
          )}
        </Card>
      </div>

      <section className="flex flex-col gap-2.5" aria-labelledby="hist-h">
        <H2 id="hist-h">Recent workouts</H2>
        {done.length === 0 && <Empty title="No workouts yet" body="Start a routine or an empty workout. Sets, rest and previous numbers are tracked for you." />}
        {done.slice(0, 12).map((t) => (
          <div key={t.id} className="rounded-2xl border border-line bg-surface">
            <button onClick={() => setOpenId(openId === t.id ? null : t.id)} aria-expanded={openId === t.id} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
              <span className="flex flex-1 flex-col"><b className="text-[15px]">{t.name}</b><span className="text-xs text-muted">{fmtDayYear(t.startedAt)} · {fmtDuration(new Date(t.endedAt as string).getTime() - new Date(t.startedAt).getTime())} · {t.entries.reduce((s, e) => s + e.sets.length, 0)} sets</span></span>
              <ChevronDown size={18} className={cx('transition-transform', openId === t.id && 'rotate-180')} aria-hidden="true" />
            </button>
            {openId === t.id && (
              <ul className="anim-fade m-0 flex list-none flex-col gap-1.5 px-3.5 pb-3 pt-0">
                {t.entries.map((e) => <li key={e.id} className="flex flex-col text-sm"><b>{exById.get(e.exerciseId)?.name}</b><span className="font-mono text-xs text-muted">{setSummary(e, exById.get(e.exerciseId), unit)}</span></li>)}
              </ul>
            )}
          </div>
        ))}
      </section>

      <Sheet open={routineSheet} onClose={() => setRoutineSheet(false)} title="New routine" footer={<Button variant="primary" className="w-full" disabled={!rName.trim() || rEx.length === 0} onClick={() => { update((d) => saveRoutine(d, rName.trim(), rEx)); setRoutineSheet(false); toast('Saved routine ' + rName.trim()); }}>Save routine</Button>}>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Name<input className={inputCls} value={rName} onChange={(e) => setRName(e.target.value)} placeholder="e.g. Tuesday board" /></label>
        <span className="text-[13px] text-muted">Exercises, in order ({rEx.length} picked)</span>
        <div className="flex flex-wrap gap-2">
          {data.exercises.map((e) => <Chip key={e.id} selected={rEx.includes(e.id)} onClick={() => setREx(rEx.includes(e.id) ? rEx.filter((x) => x !== e.id) : [...rEx, e.id])}>{e.name}</Chip>)}
        </div>
      </Sheet>
    </div>
  );
}

function Workout({ t }: { t: TrainingSession }) {
  const { data, update, replace } = useStore();
  const toast = useToast();
  const now = useNow(250);
  const unit = data.settings.units;
  const exById = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null);
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState<{ name: string; category: ExerciseCategory; kind: ExerciseKind; rest: number } | null>(null);
  const [confirm, setConfirm] = useState<'discard' | null>(null);
  const remaining = rest ? Math.max(0, Math.ceil((rest.end - now) / 1000)) : 0;

  useEffect(() => {
    if (rest && remaining === 0) {
      setRest(null);
      if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
      void haptic('success');
      toast('Rest over. Next set.');
    }
  }, [rest, remaining, toast]);

  const prevFor = (exId: string) => {
    for (let i = data.training.length - 1; i >= 0; i--) {
      const s = data.training[i];
      if (s.id === t.id || !s.endedAt) continue;
      const e = s.entries.find((x) => x.exerciseId === exId);
      if (e) return e;
    }
    return null;
  };
  const upd = (fn: (x: TrainingSession) => TrainingSession) => update((d) => updateTraining(d, t.id, fn));
  const updEntry = (eid: string, fn: (e: TrainingEntry) => TrainingEntry) => upd((x) => ({ ...x, entries: x.entries.map((e) => (e.id === eid ? fn(e) : e)) }));
  const updSet = (eid: string, i: number, patch: Partial<TrainingSet>) => updEntry(eid, (e) => ({ ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const addEntry = (ex: Exercise) => {
    const prev = prevFor(ex.id);
    upd((x) => ({ ...x, entries: [...x.entries, { id: 'te-' + Date.now().toString(36), exerciseId: ex.id, sets: prev ? prev.sets.map((s) => ({ ...s, done: false })) : [{ done: false }, { done: false }, { done: false }] }] }));
    setPicker(false); setQ('');
  };
  const doneSets = t.entries.reduce((s, e) => s + e.sets.filter((x) => x.done).length, 0);
  const allSets = t.entries.reduce((s, e) => s + e.sets.length, 0);
  const lib = data.exercises.filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()) || CATEGORY_LABEL[e.category].toLowerCase().includes(q.trim().toLowerCase()));

  const finish = () => {
    if (doneSets === 0) { toast('Tick at least one set, or discard the workout'); return; }
    update((d) => finishTraining(d));
    toast('Workout saved: ' + doneSets + ' sets in ' + fmtDuration(Date.now() - new Date(t.startedAt).getTime()));
  };

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-mono text-xs text-route">● {fmtClock((now - new Date(t.startedAt).getTime()) / 1000)} · {doneSets}/{allSets} sets</span>
          <input aria-label="Workout name" value={t.name} onChange={(e) => upd((x) => ({ ...x, name: e.target.value }))} className="w-full bg-transparent font-display text-[26px] font-extrabold tracking-tight text-ink" />
        </div>
        <Button variant="ghost" onClick={() => setConfirm('discard')}>Discard</Button>
        <Button variant="primary" onClick={finish}><Check size={18} aria-hidden="true" />Finish</Button>
      </header>

      {t.entries.length === 0 && <Empty title="Empty workout" body="Add an exercise to start logging sets." />}

      {t.entries.map((e) => {
        const ex = exById.get(e.exerciseId);
        if (!ex) return null;
        const prev = prevFor(ex.id);
        const weighted = ex.kind === 'weight_reps' || ex.kind === 'weight_time';
        const timed = ex.kind === 'time' || ex.kind === 'weight_time';
        const hang = isHang(ex);
        const bw = data.user.weightKg;
        return (
          <section key={e.id} className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-3.5" aria-label={ex.name}>
            <div className="flex items-start gap-2">
              <div className="flex flex-1 flex-col"><h2 className="m-0 text-base font-bold text-route">{ex.name}</h2><span className="text-xs text-muted">{CATEGORY_LABEL[ex.category]} · rest {fmtClock(ex.defaultRest)}{prev ? ' · last: ' + setSummary(prev, ex, unit) : ''}</span></div>
              <IconButton label={'Remove ' + ex.name} className="h-10 w-10 text-muted" onClick={() => upd((x) => ({ ...x, entries: x.entries.filter((y) => y.id !== e.id) }))}><Trash2 size={16} aria-hidden="true" /></IconButton>
            </div>
            <div className="grid grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-1.5 text-[11px] uppercase tracking-[0.06em] text-muted">
              <span>Set</span><span>Previous</span><span className="text-center">{weighted ? '+' + unit : '—'}</span><span className="text-center">{timed ? 'sec' : 'reps'}</span><span />
            </div>
            {e.sets.map((s, i) => {
              const ps = prev?.sets[i];
              return (
                <div key={i} className={cx('grid grid-cols-[28px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-1.5 rounded-xl py-0.5', s.done && 'bg-accent/10')}>
                  <span className="text-center font-mono text-sm font-bold">{i + 1}</span>
                  <span className="truncate font-mono text-xs text-muted">{ps ? (weighted ? (ps.weight ? (ps.weight > 0 ? '+' : '−') + Math.abs(ps.weight) : 'BW') + ' × ' : '') + (timed ? (ps.seconds ?? 0) + 's' : ps.reps ?? 0) : '—'}</span>
                  <input aria-label={'Set ' + (i + 1) + (hang ? ' added weight, negative for assisted' : ' added weight')} disabled={!weighted} type="number" inputMode={hang ? 'text' : 'decimal'} min={hang ? undefined : 0} value={weighted ? s.weight ?? '' : ''} placeholder={weighted ? '0' : '—'} onChange={(ev) => { const v = ev.target.value; if (v === '' || v === '-') { updSet(e.id, i, { weight: undefined }); return; } const n = Number(v); if (Number.isFinite(n)) updSet(e.id, i, { weight: hang ? n : Math.max(0, n) }); }} className="h-10 w-full rounded-[10px] border border-line bg-bg text-center font-mono text-base font-bold text-ink disabled:opacity-40" />
                  <input aria-label={'Set ' + (i + 1) + (timed ? ' seconds' : ' reps')} type="number" inputMode="numeric" min={0} value={(timed ? s.seconds : s.reps) ?? ''} placeholder="0" onChange={(ev) => updSet(e.id, i, timed ? { seconds: ev.target.value === '' ? undefined : Math.max(0, Number(ev.target.value)) } : { reps: ev.target.value === '' ? undefined : Math.max(0, Number(ev.target.value)) })} className="h-10 w-full rounded-[10px] border border-line bg-bg text-center font-mono text-base font-bold text-ink" />
                  <button aria-pressed={s.done} aria-label={(s.done ? 'Undo set ' : 'Complete set ') + (i + 1)} onClick={() => { updSet(e.id, i, { done: !s.done }); if (!s.done) void haptic('light'); if (!s.done) setRest({ end: Date.now() + ex.defaultRest * 1000, total: ex.defaultRest }); }} className={cx('flex h-10 w-11 items-center justify-center rounded-[10px]', s.done ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted')}>
                    <Check size={18} strokeWidth={3} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            {hang && (
              <p className="m-0 font-mono text-xs text-muted">{bw == null
                ? 'Add your weight in Profile to see % body weight. Negative weight = pulley or band.'
                : '% body weight: ' + e.sets.map((s) => Math.round(pctBodyWeight(bw, toKg(s.weight ?? 0, unit))) + '%').join(' · ')}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => updEntry(e.id, (x) => ({ ...x, sets: [...x.sets, { ...(x.sets.at(-1) ?? {}), done: false }] }))}>+ Add set</Button>
              {e.sets.length > 1 && <Button size="sm" variant="ghost" onClick={() => updEntry(e.id, (x) => ({ ...x, sets: x.sets.slice(0, -1) }))}>Remove last</Button>}
            </div>
            <input aria-label={'Notes for ' + ex.name} value={e.notes ?? ''} onChange={(ev) => updEntry(e.id, (x) => ({ ...x, notes: ev.target.value }))} placeholder="Notes (edge, grip, how it felt)" className="min-h-10 rounded-[10px] border border-transparent bg-transparent px-1 text-base text-ink placeholder:text-muted focus:border-line" />
          </section>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" className="flex-1 border-dashed text-route" onClick={() => setPicker(true)}><Plus size={18} aria-hidden="true" />Add exercise</Button>
        {t.entries.length > 0 && <Button variant="ghost" onClick={() => { update((d) => saveRoutine(d, t.name, t.entries.map((e) => e.exerciseId))); toast('Saved as routine: ' + t.name); }}>Save as routine</Button>}
      </div>

      {rest && (
        <div role="timer" aria-live="off" className="anim-rise fixed inset-x-3 bottom-[calc(96px+var(--sa-bottom))] z-40 flex items-center gap-2 overflow-hidden rounded-[18px] bg-ink py-2.5 pl-4 pr-2.5 text-bg shadow-2xl lg:bottom-6 lg:left-auto lg:right-6 lg:w-[420px]">
          <span className="absolute bottom-0 left-0 h-1 bg-orange" style={{ width: (remaining / rest.total) * 100 + '%' }} aria-hidden="true" />
          <Timer size={20} aria-hidden="true" />
          <span className="flex flex-1 flex-col"><span className="text-[11px] font-bold uppercase tracking-[0.08em] opacity-70">Rest</span><b className="font-mono text-2xl">{fmtClock(remaining)}</b></span>
          <button aria-label="15 seconds less" onClick={() => setRest(remaining <= 15 ? null : { ...rest, end: rest.end - 15000 })} className="h-11 w-12 rounded-xl bg-bg/15 text-sm font-bold">−15</button>
          <button aria-label="15 seconds more" onClick={() => setRest({ end: rest.end + 15000, total: Math.max(rest.total, remaining + 15) })} className="h-11 w-12 rounded-xl bg-bg/15 text-sm font-bold">+15</button>
          <button onClick={() => setRest(null)} className="h-11 rounded-xl bg-bg px-3.5 text-sm font-bold text-ink">Skip</button>
        </div>
      )}

      <Sheet open={picker} onClose={() => { setPicker(false); setCustom(null); }} title={custom ? 'Custom exercise' : 'Add exercise'} footer={custom ? <Button variant="primary" className="w-full" disabled={!custom.name.trim()} onClick={() => { const r = addExercise(data, { name: custom.name.trim(), category: custom.category, kind: custom.kind, defaultRest: custom.rest }); replace(r.data); setCustom(null); addEntry(r.exercise); toast('Created ' + r.exercise.name); }}>Create and add</Button> : undefined}>
        {custom ? (
          <>
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">Name<input className={inputCls} value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="e.g. One-arm lock-offs" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">Category
              <select className={inputCls} value={custom.category} onChange={(e) => setCustom({ ...custom, category: e.target.value as ExerciseCategory })}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">What you track
              <select className={inputCls} value={custom.kind} onChange={(e) => setCustom({ ...custom, kind: e.target.value as ExerciseKind })}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-muted">Rest between sets (seconds)<input type="number" min={0} max={900} className={inputCls} value={custom.rest} onChange={(e) => setCustom({ ...custom, rest: Math.max(0, Math.min(900, Number(e.target.value) || 0)) })} /></label>
          </>
        ) : (
          <>
            <label className="relative block"><span className="sr-only">Search exercises</span><Search size={18} className="pointer-events-none absolute left-3.5 top-[15px] text-muted" aria-hidden="true" /><input type="search" className={cx(inputCls, 'pl-10')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" /></label>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {lib.map((e) => (
                <li key={e.id}><button onClick={() => addEntry(e)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-surface-2"><span className="flex flex-1 flex-col"><b className="text-sm">{e.name}{e.custom ? ' · custom' : ''}</b><span className="text-xs text-muted">{CATEGORY_LABEL[e.category]} · {KIND_LABEL[e.kind]}</span></span><Plus size={18} aria-hidden="true" /></button></li>
              ))}
            </ul>
            <Button variant="secondary" onClick={() => setCustom({ name: q.trim(), category: 'fingers', kind: 'weight_reps', rest: 120 })}>Create custom exercise</Button>
          </>
        )}
      </Sheet>

      <Sheet open={confirm === 'discard'} onClose={() => setConfirm(null)} title="Discard workout?" footer={<div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>Keep going</Button><Button variant="danger" className="flex-1" onClick={() => { update((d) => discardTraining(d)); setConfirm(null); toast('Workout discarded'); }}><X size={16} aria-hidden="true" />Discard</Button></div>}>
        <p className="m-0 text-sm text-muted">The {doneSets} completed sets in this workout won’t be saved.</p>
      </Sheet>
    </div>
  );
}
