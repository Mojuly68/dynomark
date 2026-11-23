import { useMemo, useState } from 'react';
import { Camera, Check, ChevronDown, Copy, Flame, Minus, Pencil, Plus, Repeat2, Trash2, X } from 'lucide-react';
import { useStore } from '../store/Store';
import { useToast } from '../components/Toast';
import { Celebration } from '../components/Celebration';
import { GymPicker } from '../components/GymPicker';
import { useNow } from '../components/Layout';
import { Button, Chip, Empty, GradeBadge, H1, IconButton, Label, Toggle, cx, inputCls } from '../components/ui';
import type { Climb, ClimbType, Feel, Outcome, RopeStyle, WallAngle } from '../types';
import { ANGLES, ANGLE_LABEL, BOULDER_GRADES, BOULDER_STYLES, HOLD_COLORS, OUTCOMES, ROUTE_GRADES, ROUTE_HOLDS, colorHex, gradeIndex, gradesFor, isFirstTry, isSend, mapOutcome, outcomeLabel } from '../lib/grades';
import { deleteClimb, duplicateClimb, finishSession, logClimb, restoreClimb, updateClimb, type ClimbInput } from '../store/actions';
import { fmtClock, fmtTime, toLocalInput } from '../lib/dates';
import { navigate } from '../lib/router';
import { maxGradeIdx, warmupLadder, workingGrade } from '../lib/warmup';
import { haptic } from '../lib/native';

const ANGLE_PATH: Record<WallAngle, string> = { slab: 'M6 18 L22 4', vertical: 'M14 18 V3', overhang: 'M8 18 L20 3', roof: 'M5 18 V8 H25' };

interface Form {
  gymId: string | null;
  type: ClimbType;
  gB: string;
  gR: string;
  custom: string;
  customIdx: string;
  outcome: Outcome;
  attempts: number;
  rope: RopeStyle;
  angle: WallAngle;
  color: string;
  tagsB: string[];
  tagsR: string[];
  name: string;
  notes: string;
  feel: Feel;
  when: string;
  media: string[];
  projectId: string;
  highPoint: number;
  warmup: boolean;
}

export function LogClimb({ editId }: { editId?: string }) {
  const { data, update, replace, gymById } = useStore();
  const toast = useToast();
  const now = useNow(1000);
  const editing = editId ? data.climbs.find((c) => c.id === editId) : undefined;
  const lastOf = (t: ClimbType) => data.climbs.filter((c) => c.type === t && c.gradeIdx != null).sort((a, b) => b.at.localeCompare(a.at))[0];
  const active = data.activeSessionId ? data.sessions.find((s) => s.id === data.activeSessionId) : undefined;

  const [f, setF] = useState<Form>(() => {
    const lb = lastOf('boulder'), lr = lastOf('route');
    const base: Form = {
      gymId: active?.gymId ?? data.settings.currentGymId, type: 'boulder', gB: lb?.grade ?? 'V3', gR: lr?.grade ?? '5.10a', custom: '', customIdx: '',
      outcome: 'flash', attempts: 1, rope: 'lead', angle: 'vertical', color: 'Yellow', tagsB: [], tagsR: [], name: '', notes: '', feel: 'on', when: '', media: [], projectId: '', highPoint: 50, warmup: false,
    };
    if (!editing) return base;
    const std = (editing.type === 'boulder' ? BOULDER_GRADES : ROUTE_GRADES).includes(editing.grade);
    const g = std ? editing.grade : 'Custom';
    return {
      ...base, gymId: editing.gymId, type: editing.type, ...(editing.type === 'boulder' ? { gB: g } : { gR: g }),
      custom: std ? '' : editing.grade, customIdx: !std && editing.gradeIdx != null ? String(editing.gradeIdx) : '',
      outcome: editing.outcome, attempts: editing.attempts, rope: editing.ropeStyle ?? 'lead', angle: editing.angle ?? 'vertical', color: editing.color ?? 'Yellow',
      ...(editing.type === 'boulder' ? { tagsB: editing.styles } : { tagsR: editing.styles }), name: editing.name ?? '', notes: editing.notes ?? '', feel: editing.feel ?? 'on',
      when: toLocalInput(new Date(editing.at)), media: editing.media ?? [], projectId: editing.projectId ?? '', warmup: !!editing.warmup,
    };
  });
  const [more, setMore] = useState(!!editing);
  const [errors, setErrors] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<{ grade: string; name: string; detail: string; type: ClimbType; id: string } | null>(null);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  const isB = f.type === 'boulder';
  const grades = isB ? [...BOULDER_GRADES, 'Custom'] : [...ROUTE_GRADES, 'Custom'];
  const grade = isB ? f.gB : f.gR;
  const isCustom = grade === 'Custom';
  const gradeText = isCustom ? f.custom.trim() || 'Custom' : grade;
  const firstTry = isFirstTry(f.outcome);
  const attempts = firstTry ? 1 : f.attempts;
  const tags = isB ? f.tagsB : f.tagsR;
  const gym = gymById(f.gymId);

  const sessionId = editing ? editing.sessionId : active?.id;
  const sessionClimbs = useMemo(() => data.climbs.filter((c) => c.sessionId === sessionId).sort((a, b) => b.at.localeCompare(a.at)), [data.climbs, sessionId]);
  const session = sessionId ? data.sessions.find((s) => s.id === sessionId) : undefined;
  const projects = data.projects.filter((p) => p.status === 'active' && p.gymId === f.gymId && p.type === f.type);
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return data.climbs
      .filter((c) => c.gymId === f.gymId)
      .sort((a, b) => b.at.localeCompare(a.at))
      .filter((c) => { const k = c.type + c.grade + c.color + c.angle; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 8);
  }, [data.climbs, f.gymId]);
  const lastClimb = useMemo(() => data.climbs.slice().sort((a, b) => b.at.localeCompare(a.at))[0], [data.climbs]);

  const setType = (t: ClimbType) => setF((x) => ({ ...x, type: t, outcome: mapOutcome(x.outcome, t), projectId: '' }));
  const pickOutcome = (o: Outcome) => setF((x) => ({ ...x, outcome: o, attempts: isFirstTry(o) ? 1 : Math.max(x.attempts, o === 'project' || o === 'repeat' ? 1 : 2) }));

  const buildInput = (): ClimbInput | null => {
    const errs: string[] = [];
    if (!f.gymId) errs.push('Choose a gym first.');
    if (isCustom && !f.custom.trim()) errs.push('Type the custom grade, or pick a standard one.');
    const at = f.when ? new Date(f.when) : new Date();
    if (Number.isNaN(at.getTime())) errs.push('That date and time is not valid.');
    else if (at.getTime() > Date.now() + 5 * 60000) errs.push('The date and time is in the future.');
    if (!Number.isFinite(attempts) || attempts < 1) errs.push('Attempts must be at least 1.');
    setErrors(errs);
    if (errs.length) return null;
    const gIdx = isCustom ? (f.customIdx === '' ? null : Number(f.customIdx)) : gradeIndex(f.type, grade);
    return {
      gymId: f.gymId as string, type: f.type, grade: gradeText, gradeIdx: gIdx, outcome: f.outcome, attempts,
      ropeStyle: isB ? undefined : f.rope, angle: f.angle, color: f.color, styles: tags.slice(), name: f.name.trim() || undefined, notes: f.notes.trim() || undefined,
      feel: f.feel === 'on' ? undefined : f.feel, media: f.media.length ? f.media : undefined, projectId: f.projectId || undefined, warmup: f.warmup && !f.projectId ? true : undefined, at: at.toISOString(),
      highPoint: f.projectId && !isSend(f.outcome) ? f.highPoint : undefined,
    };
  };

  const submit = () => {
    const input = buildInput();
    if (!input) return;
    if (editing) {
      update((d) => updateClimb(d, editing.id, input));
      toast('Saved ' + input.grade + ' ' + outcomeLabel(input.outcome));
      navigate(editing.sessionId === data.activeSessionId ? '/log' : '/session/' + editing.sessionId);
      return;
    }
    const r = logClimb(data, input);
    replace(r.data);
    setFresh(r.climb.id);
    set({ name: '', notes: '', media: [], feel: 'on', projectId: '', when: '' });
    void haptic(isSend(r.climb.outcome) && !r.climb.warmup ? 'success' : 'light');
    const label = 'Logged ' + r.climb.grade + ' ' + outcomeLabel(r.climb.outcome) + (r.climb.attempts > 1 ? ' in ' + r.climb.attempts + ' tries' : '');
    toast(r.startedNew && !f.when ? label + '. Session started.' : label, { label: 'Undo', onClick: () => update((d) => deleteClimb(d, r.climb.id).data) });
    if (r.projectSent) {
      const p = r.projectSent;
      const tries = p.attempts.reduce((s, a) => s + a.tries, 0);
      setCelebrate({ grade: p.grade, name: p.name, type: p.type, id: p.id, detail: tries + ' tries over ' + p.attempts.length + ' session' + (p.attempts.length > 1 ? 's' : '') });
    }
  };

  const remove = (c: Climb) => {
    const r = deleteClimb(data, c.id);
    replace(r.data);
    const removed = r.removed;
    toast('Deleted ' + c.grade, { label: 'Undo', onClick: () => { if (removed) update((d) => restoreClimb(d, removed, r.index)); } });
  };
  const dup = (c: Climb) => {
    const r = duplicateClimb(data, c.id);
    if (!r) return;
    replace(r.data);
    setFresh(r.climb.id);
    toast('Logged again: ' + c.grade + ' ' + outcomeLabel(c.outcome), { label: 'Undo', onClick: () => update((d) => deleteClimb(d, r.climb.id).data) });
  };
  const prefill = (c: Climb) => {
    const std = (c.type === 'boulder' ? BOULDER_GRADES : ROUTE_GRADES).includes(c.grade);
    setF((x) => ({ ...x, type: c.type, ...(c.type === 'boulder' ? { gB: std ? c.grade : 'Custom' } : { gR: std ? c.grade : 'Custom' }), custom: std ? '' : c.grade, color: c.color ?? x.color, angle: c.angle ?? x.angle, name: c.name ?? '', rope: c.ropeStyle ?? x.rope, ...(c.type === 'boulder' ? { tagsB: c.styles } : { tagsR: c.styles }), outcome: mapOutcome(x.outcome, c.type) }));
    toast('Filled from ' + c.grade + (c.color ? ' ' + c.color.toLowerCase() : ''));
  };
  const pickWarmup = (type: ClimbType, grade: string) => {
    setF((x) => ({ ...x, type, ...(type === 'boulder' ? { gB: grade } : { gR: grade }), custom: '', warmup: true, outcome: type === 'boulder' ? 'flash' : 'onsight', attempts: 1, projectId: '' }));
  };
  const onlyWarmups = sessionClimbs.every((c) => c.warmup);

  const finish = () => {
    const r = finishSession(data);
    replace(r.data);
    if (r.sessionId) navigate('/session/' + r.sessionId); else { toast('Session closed'); navigate('/'); }
  };

  const outcomes = OUTCOMES[f.type];
  const accent = isB ? 'boulder' : 'route';
  const sel = (on: boolean) => (on ? (isB ? 'border-orange bg-orange text-accent-ink' : 'border-accent bg-accent text-accent-ink') : 'border-line bg-surface text-ink hover:border-muted');
  const sends = sessionClimbs.filter((c) => isSend(c.outcome)).length;
  const tries = sessionClimbs.reduce((s, c) => s + c.attempts, 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <H1 sub={editing ? 'Editing a logged climb' : active ? <span className="font-mono text-route">● Session · {fmtClock((now - new Date(active.startedAt).getTime()) / 1000)}</span> : 'Your first log starts a session'}>
          {editing ? 'Edit climb' : 'Log a climb'}
        </H1>
        {editing ? (
          <Button variant="ghost" onClick={() => history.back()}><X size={18} aria-hidden="true" />Cancel</Button>
        ) : active ? (
          <Button variant="ink" onClick={finish}><Check size={18} aria-hidden="true" />Finish session</Button>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form className="flex min-w-0 flex-col gap-5" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          <GymPicker value={f.gymId} onChange={(id) => set({ gymId: id, projectId: '' })} />

          <div role="group" aria-label="Climbing type" className="grid grid-cols-2 gap-2.5">
            {(['route', 'boulder'] as ClimbType[]).map((t) => {
              const on = f.type === t;
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => setType(t)} className={cx('flex min-h-[76px] flex-col items-start justify-center gap-0.5 rounded-[18px] border-2 px-4 text-left transition-colors', on ? (t === 'boulder' ? 'border-orange bg-orange text-accent-ink' : 'border-accent bg-accent text-accent-ink') : 'border-line bg-surface')}>
                  <span className="font-display text-xl font-extrabold">{t === 'route' ? 'Routes' : 'Bouldering'}</span>
                  <span className="text-xs opacity-80">{t === 'route' ? 'YDS · lead or top rope' : 'V-scale'}</span>
                </button>
              );
            })}
          </div>

          {!editing && onlyWarmups && <WarmupPlan type={f.type} sessionClimbs={sessionClimbs} onPick={pickWarmup} />}

          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between"><Label>Grade</Label><span className="text-xs text-muted">{isB ? 'V-scale' : 'Yosemite Decimal System'}</span></div>
            <div role="group" aria-label="Grade" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-0.5 lg:mx-0 lg:flex-wrap lg:px-0">
              {grades.map((g) => (
                <button key={g} type="button" aria-pressed={g === grade} onClick={() => set(isB ? { gB: g } : { gR: g })} className={cx('h-[52px] shrink-0 rounded-[14px] border px-2.5 font-mono text-[15px] font-bold transition-colors', g === 'Custom' ? 'min-w-[84px]' : isB ? 'min-w-14' : 'min-w-[66px]', sel(g === grade))}>{g}</button>
              ))}
            </div>
            {isCustom && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">Custom or gym grade
                  <input className={inputCls} value={f.custom} onChange={(e) => set({ custom: e.target.value })} placeholder="e.g. Blue circuit, 6B+, Font 7A" aria-invalid={isCustom && !f.custom.trim() && errors.length > 0} />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">Counts as (for stats)
                  <select className={inputCls} value={f.customIdx} onChange={(e) => set({ customIdx: e.target.value })}>
                    <option value="">Don’t include in grade stats</option>
                    {(isB ? BOULDER_GRADES : ROUTE_GRADES).map((g, i) => <option key={g} value={i}>{g}</option>)}
                  </select>
                </label>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="min-w-[150px] flex-1 text-xs text-muted">Graded by {gym?.name ?? 'the gym'}. Gym grades aren’t standardized.</span>
              <div role="group" aria-label="How the grade felt" className="inline-flex rounded-[10px] border border-line bg-surface p-[3px]">
                {(['soft', 'on', 'hard'] as Feel[]).map((k) => (
                  <button key={k} type="button" aria-pressed={f.feel === k} onClick={() => set({ feel: k })} className={cx('h-8 rounded-lg px-2.5 text-xs font-semibold', f.feel === k ? 'bg-ink text-bg' : 'text-muted')}>{k === 'on' ? 'On grade' : k === 'soft' ? 'Soft' : 'Hard'}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Label>Outcome</Label>
            <div role="group" aria-label="Outcome" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {outcomes.map((o, i) => (
                <button key={o.id} type="button" aria-pressed={f.outcome === o.id} onClick={() => pickOutcome(o.id)} className={cx('flex min-h-[62px] flex-col gap-0.5 rounded-2xl border px-3.5 py-2.5 text-left transition-colors', sel(f.outcome === o.id), outcomes.length === 5 && i === 4 && 'col-span-2 sm:col-span-1')}>
                  <span className="text-base font-bold">{o.label}</span>
                  <span className="text-xs opacity-80">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Label>Attempts</Label>
              <span className="text-xs text-muted">{firstTry ? 'First-try send counts as 1' : f.outcome === 'project' ? 'Tries so far today' : 'Including the send'}</span>
            </div>
            <div className={cx('flex items-center gap-1 rounded-2xl border border-line bg-surface p-1', firstTry && 'opacity-50')}>
              <IconButton type="button" label="Fewer attempts" disabled={firstTry || f.attempts <= 1} onClick={() => set({ attempts: Math.max(1, f.attempts - 1) })} className="h-12 w-12 text-2xl font-bold">−</IconButton>
              <input aria-label="Attempts" inputMode="numeric" type="number" min={1} max={99} disabled={firstTry} value={attempts} onChange={(e) => set({ attempts: Math.max(1, Math.min(99, parseInt(e.target.value || '1', 10) || 1)) })} className="w-14 bg-transparent text-center font-display text-[26px] font-black text-ink" />
              <IconButton type="button" label="More attempts" disabled={firstTry} onClick={() => set({ attempts: Math.min(99, f.attempts + 1) })} className="h-12 w-12 text-2xl font-bold">+</IconButton>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Label>Warm-up</Label>
              <span className="text-xs text-muted">{f.projectId ? 'Project climbs can\u2019t be warm-ups' : 'Counts toward volume, not your averages or send rates'}</span>
            </div>
            <Toggle checked={f.warmup && !f.projectId} onChange={(v) => set({ warmup: v && !f.projectId })} label="Warm-up climb" />
          </div>

          {!isB && (
            <div role="group" aria-label="Rope style" className="grid grid-cols-2 gap-2">
              {(['lead', 'top-rope'] as RopeStyle[]).map((r) => (
                <button key={r} type="button" aria-pressed={f.rope === r} onClick={() => set({ rope: r })} className={cx('min-h-12 rounded-[14px] border text-[15px] font-bold', sel(f.rope === r))}>{r === 'lead' ? 'Lead' : 'Top rope'}</button>
              ))}
            </div>
          )}

          {projects.length > 0 && (
            <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5">
              <label className="flex flex-col gap-1.5 text-[13px] text-muted">Part of a project?
                <select className={inputCls} value={f.projectId} onChange={(e) => {
                  const pr = projects.find((x) => x.id === e.target.value);
                  if (!pr) { set({ projectId: '' }); return; }
                  const std = (pr.type === 'boulder' ? BOULDER_GRADES : ROUTE_GRADES).includes(pr.grade);
                  const best = Math.max(0, ...pr.attempts.map((a) => a.highPoint));
                  set({ projectId: pr.id, warmup: false, highPoint: Math.min(99, best), name: pr.name, ...(pr.type === 'boulder' ? { gB: std ? pr.grade : 'Custom' } : { gR: std ? pr.grade : 'Custom' }), ...(std ? {} : { custom: pr.grade }) });
                }}>
                  <option value="">No</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.grade}</option>)}
                </select>
              </label>
              {f.projectId && !isSend(f.outcome) && (
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">High point today: <b className="text-ink">{f.highPoint}%</b>
                  <input type="range" min={0} max={99} step={5} value={f.highPoint} onChange={(e) => set({ highPoint: Number(e.target.value) })} className="accent-[#C6F432]" />
                </label>
              )}
              {f.projectId && isSend(f.outcome) && <span className="text-xs text-route">Logging a send marks this project as sent.</span>}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <Label>Wall angle</Label>
            <div role="group" aria-label="Wall angle" className="grid grid-cols-4 gap-1.5">
              {ANGLES.map((a) => (
                <button key={a} type="button" aria-pressed={f.angle === a} onClick={() => set({ angle: a })} className={cx('flex min-h-16 flex-col items-center justify-center gap-1 rounded-[14px] border text-xs font-semibold', sel(f.angle === a))}>
                  <svg width="28" height="20" viewBox="0 0 28 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d={ANGLE_PATH[a]} /><path d="M2 19h24" strokeOpacity="0.35" /></svg>
                  {ANGLE_LABEL[a]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <Label>{isB ? 'Tape / hold color' : 'Route color'} · {f.color}</Label>
            <div role="group" aria-label="Hold color" className="flex flex-wrap gap-2">
              {HOLD_COLORS.map((c) => (
                <button key={c.name} type="button" aria-pressed={f.color === c.name} aria-label={c.name} title={c.name} onClick={() => set({ color: c.name })} className={cx('h-11 w-11 rounded-full border-[3px] p-[3px]', f.color === c.name ? (isB ? 'border-orange' : 'border-accent') : 'border-transparent')}>
                  <span className="block h-full w-full rounded-full ring-1 ring-white/20" style={{ background: c.hex }} />
                </button>
              ))}
            </div>
          </div>

          <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="flex min-h-12 items-center justify-center gap-2 rounded-[14px] border border-dashed border-line text-sm font-semibold">
            {more ? 'Fewer details' : 'More details · style, name, time, notes, media'}
            <ChevronDown size={16} className={cx('transition-transform', more && 'rotate-180')} aria-hidden="true" />
          </button>

          {more && (
            <div className="anim-fade flex flex-col gap-4">
              <div className="flex flex-col gap-2.5">
                <Label>{isB ? 'Style' : 'Hold type (optional)'}</Label>
                <div role="group" aria-label={isB ? 'Style' : 'Hold type'} className="flex flex-wrap gap-2">
                  {(isB ? BOULDER_STYLES : ROUTE_HOLDS).map((t) => {
                    const on = tags.includes(t);
                    return <Chip key={t} accent={accent} selected={on} onClick={() => set(isB ? { tagsB: on ? tags.filter((x) => x !== t) : [...tags, t] } : { tagsR: on ? tags.filter((x) => x !== t) : [...tags, t] })}>{t}</Chip>;
                  })}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">{isB ? 'Problem name or wall' : 'Route name or wall'}
                  <input className={inputCls} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Cave, left of the arête" maxLength={80} />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">Date and time
                  <span className="flex gap-2">
                    <input type="datetime-local" className={inputCls} value={f.when || toLocalInput(new Date(now))} max={toLocalInput(new Date(now + 5 * 60000))} onChange={(e) => set({ when: e.target.value })} />
                    {f.when && !editing && <Button type="button" size="sm" variant="ghost" onClick={() => set({ when: '' })}>Now</Button>}
                  </span>
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] text-muted">Notes
                <textarea className={cx(inputCls, 'resize-none')} rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Beta, where you fell, what to try next" maxLength={500} />
              </label>
              <label className="relative flex min-h-[52px] items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 text-sm">
                <Camera size={20} className="text-route" aria-hidden="true" />
                <span className="flex-1">{f.media.length ? 'Attached: ' + f.media.join(', ') : 'Add photo or video'}</span>
                {f.media.length > 0 && <span className="text-xs text-muted">File name saved; upload needs an account</span>}
                <input type="file" accept="image/*,video/*" multiple className="sr-only-input" onChange={(e) => { const names = Array.from(e.target.files ?? []).map((x) => x.name); if (names.length) set({ media: [...f.media, ...names] }); }} />
              </label>
            </div>
          )}

          {!editing && suggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Recent at {gym?.name ?? 'this gym'}</Label>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
                {suggestions.map((c) => (
                  <button key={c.id} type="button" onClick={() => prefill(c)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13px]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorHex(c.color) }} aria-hidden="true" />
                    <b className="font-mono">{c.grade}</b>{c.color} · {ANGLE_LABEL[c.angle ?? 'vertical']}{c.name ? ' · ' + c.name : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <ul role="alert" className="m-0 flex list-none flex-col gap-1 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}

          <div className="sticky bottom-[calc(84px+var(--sa-bottom))] z-20 -mx-5 flex gap-2.5 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur lg:bottom-4 lg:mx-0 lg:rounded-2xl lg:border lg:px-3">
            {!editing && lastClimb && (
              <IconButton type="button" label={'Log again: ' + lastClimb.grade + ' ' + outcomeLabel(lastClimb.outcome)} onClick={() => dup(lastClimb)} className="h-[58px] w-[58px] rounded-[18px] border border-line bg-surface">
                <Repeat2 size={22} aria-hidden="true" />
              </IconButton>
            )}
            <button type="submit" className={cx('flex min-h-[58px] flex-1 items-center justify-center gap-2 rounded-[18px] font-display text-lg font-extrabold text-accent-ink active:scale-[0.99]', isB ? 'bg-orange' : 'bg-accent')}>
              {editing ? <Check size={22} strokeWidth={2.8} aria-hidden="true" /> : <Plus size={22} strokeWidth={2.8} aria-hidden="true" />}
              {(editing ? 'Save ' : 'Log ') + (f.warmup && !f.projectId ? 'warm-up ' : '') + gradeText + ' · ' + outcomeLabel(f.outcome)}
            </button>
          </div>
        </form>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start" aria-labelledby="session-list">
          <div className="flex items-baseline justify-between">
            <h2 id="session-list" className="m-0 font-display text-[17px] font-extrabold">{editing ? 'That session' : 'This session'}</h2>
            <span className="font-mono text-xs text-muted">{sessionClimbs.length} climbs · {sends} sends · {tries} tries</span>
          </div>
          {session && <p className="m-0 text-xs text-muted">{gymById(session.gymId)?.name} · started {fmtTime(session.startedAt)}</p>}
          {sessionClimbs.length === 0 && <Empty title="No climbs yet" body="Pick a grade and outcome, then tap Log. It takes a few seconds." />}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {sessionClimbs.map((c) => (
              <li key={c.id} className={cx('flex items-center gap-1.5 rounded-2xl border bg-surface py-1.5 pl-2 pr-1.5', c.id === editId ? 'border-ink' : 'border-line', c.id === fresh && 'anim-flash')}>
                <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-1">
                  <GradeBadge type={c.type} grade={c.grade} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">{outcomeLabel(c.outcome)}<span className="h-2 w-2 rounded-full" style={{ background: colorHex(c.color) }} aria-label={c.color} /></span>
                    <span className="truncate text-xs text-muted">{c.warmup ? 'Warm-up · ' : ''}{c.attempts} {c.attempts === 1 ? 'try' : 'tries'} · {ANGLE_LABEL[c.angle ?? 'vertical']}{c.ropeStyle ? ' · ' + (c.ropeStyle === 'lead' ? 'Lead' : 'TR') : ''}{c.name ? ' · ' + c.name : ''}</span>
                  </span>
                </div>
                <IconButton label={'Edit ' + c.grade} onClick={() => navigate('/log/edit/' + c.id)}><Pencil size={16} aria-hidden="true" /></IconButton>
                <IconButton label={'Duplicate ' + c.grade} onClick={() => dup(c)}><Copy size={16} aria-hidden="true" /></IconButton>
                <IconButton label={'Delete ' + c.grade} onClick={() => remove(c)} className="text-danger"><Trash2 size={16} aria-hidden="true" /></IconButton>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {celebrate && (
        <Celebration grade={celebrate.grade} name={celebrate.name} detail={celebrate.detail} accent={celebrate.type === 'boulder' ? '#FF8A3D' : '#C6F432'} onClose={() => setCelebrate(null)} shareTo={'/projects?id=' + celebrate.id} />
      )}
    </div>
  );
}

/** Today's warm-up ladder, built up to your working grade (from your own recent sends). */
function WarmupPlan({ type, sessionClimbs, onPick }: { type: ClimbType; sessionClimbs: Climb[]; onPick: (type: ClimbType, grade: string) => void }) {
  const { data } = useStore();
  const base = useMemo(() => workingGrade(data.climbs, type), [data.climbs, type]);
  const [shift, setShift] = useState(0);
  const [open, setOpen] = useState(sessionClimbs.length === 0);
  if (base == null) return null;
  const target = Math.max(1, Math.min(maxGradeIdx(type), base + shift));
  const steps = warmupLadder(type, target);
  const doneAt = (g: string) => sessionClimbs.filter((c) => c.warmup && c.type === type && c.grade === g).length;
  const total = steps.reduce((n, st) => n + st.count, 0);
  const done = steps.reduce((n, st) => n + Math.min(st.count, doneAt(st.grade)), 0);
  const targetLabel = gradesFor(type)[target];
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5" aria-label="Warm-up plan">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-2.5 text-left">
        <Flame size={18} className={type === 'boulder' ? 'text-boulder' : 'text-route'} aria-hidden="true" />
        <span className="flex flex-1 flex-col">
          <b className="text-[15px]">Warm up to {targetLabel}</b>
          <span className="text-xs text-muted">{done ? done + ' of ' + total + ' done' : 'Built from your recent sends · tap a step to fill it in'}</span>
        </span>
        <ChevronDown size={18} className={cx('transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="anim-fade flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {steps.map((st) => {
              const n = doneAt(st.grade);
              const complete = n >= st.count;
              return (
                <button key={st.idx} type="button" onClick={() => onPick(type, st.grade)} aria-label={'Warm-up ' + st.grade + ', ' + Math.min(n, st.count) + ' of ' + st.count + ' done'} className={cx('flex min-h-12 items-center gap-2 rounded-[14px] border px-3.5 font-mono text-[15px] font-bold', complete ? 'border-line bg-surface-2 text-muted' : 'border-line bg-bg text-ink hover:border-muted')}>
                  {complete && <Check size={15} strokeWidth={3} className="text-route" aria-hidden="true" />}
                  {st.grade}<span className="font-sans text-xs font-semibold text-muted">{Math.min(n, st.count)}/{st.count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="flex-1">Your working grade lately: {gradesFor(type)[base]}. Adjust if today feels different.</span>
            <IconButton type="button" label="Lower target grade" className="h-10 w-10" disabled={target <= 1} onClick={() => setShift(shift - 1)}><Minus size={16} aria-hidden="true" /></IconButton>
            <IconButton type="button" label="Raise target grade" className="h-10 w-10" disabled={target >= maxGradeIdx(type)} onClick={() => setShift(shift + 1)}><Plus size={16} aria-hidden="true" /></IconButton>
          </div>
        </div>
      )}
    </section>
  );
}
