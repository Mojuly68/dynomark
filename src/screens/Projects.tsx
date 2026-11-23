import { useMemo, useState } from 'react';
import { ChevronDown, Plus, Trash2, Video, X } from 'lucide-react';
import { useStore } from '../store/Store';
import { useToast } from '../components/Toast';
import { Celebration } from '../components/Celebration';
import { GymPicker } from '../components/GymPicker';
import { Bar, Button, Empty, GradeBadge, H1, IconButton, Segmented, Sheet, cx, inputCls } from '../components/ui';
import { BOULDER_GRADES, ROUTE_GRADES, gradeIndex, isSend } from '../lib/grades';
import { fmtDay, fmtDayYear } from '../lib/dates';
import { projectOutlook, totals } from '../lib/stats';
import { addProject, addProjectAttempt, deleteProject, updateProject } from '../store/actions';
import type { ClimbType, Project } from '../types';

type Tab = Project['status'];

export function Projects({ focus }: { focus: string | null }) {
  const { data, update, replace, gymById } = useStore();
  const toast = useToast();
  const focused = focus ? data.projects.find((p) => p.id === focus) : undefined;
  const [tab, setTab] = useState<Tab>(focused?.status ?? 'active');
  const [open, setOpen] = useState<string | null>(focused?.id ?? data.projects.find((p) => p.status === 'active')?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [celebrate, setCelebrate] = useState<Project | null>(null);
  const [confirmDel, setConfirmDel] = useState<Project | null>(null);
  const [nf, setNf] = useState({ name: '', type: 'boulder' as ClimbType, grade: 'V5', gymId: data.settings.currentGymId, notes: '' });
  const [nfErr, setNfErr] = useState('');

  const tops = useMemo(() => {
    const sends = data.climbs.filter((c) => isSend(c.outcome) && !c.projectId);
    return { boulder: totals(sends.filter((c) => c.type === 'boulder'), 0).topBoulder, route: totals(sends.filter((c) => c.type === 'route'), 0).topRoute };
  }, [data.climbs]);
  const counts = { active: 0, sent: 0, abandoned: 0 };
  data.projects.forEach((p) => counts[p.status]++);
  const list = data.projects.filter((p) => p.status === tab).sort((a, b) => (b.attempts.at(-1)?.date ?? b.startedAt).localeCompare(a.attempts.at(-1)?.date ?? a.startedAt));

  const create = () => {
    if (!nf.name.trim()) { setNfErr('Give the project a name.'); return; }
    if (!nf.gymId) { setNfErr('Choose the gym.'); return; }
    const r = addProject(data, { name: nf.name.trim(), type: nf.type, grade: nf.grade, gradeIdx: gradeIndex(nf.type, nf.grade), gymId: nf.gymId, notes: nf.notes.trim() || undefined });
    replace(r.data);
    setAdding(false);
    setNf({ ...nf, name: '', notes: '' });
    setTab('active');
    setOpen(r.project.id);
    toast('Project started: ' + r.project.name);
  };

  const send = (p: Project) => {
    const now = new Date().toISOString();
    update((d) => updateProject(addProjectAttempt(d, p.id, { date: now, tries: 1, highPoint: 100, note: 'Sent' }), p.id, { status: 'sent', sentAt: now }));
    setCelebrate({ ...p, attempts: [...p.attempts, { id: 'x', date: now, tries: 1, highPoint: 100 }] });
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <H1 sub={counts.active + ' active · ' + counts.sent + ' sent'}>Projects</H1>
        <Button variant="primary" onClick={() => { setNfErr(''); setAdding(true); }}><Plus size={18} strokeWidth={2.6} aria-hidden="true" />New project</Button>
      </header>
      <div role="tablist" aria-label="Project status" className="grid grid-cols-3 rounded-[14px] border border-line bg-surface p-1 sm:max-w-md">
        {([['active', 'Active'], ['sent', 'Sent'], ['abandoned', 'Shelved']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('h-10 rounded-[10px] text-sm font-semibold', tab === k ? 'bg-ink text-bg' : 'text-muted')}>{l} <span className="font-mono opacity-70">{counts[k]}</span></button>
        ))}
      </div>

      {list.length === 0 && <Empty title={tab === 'active' ? 'No active projects' : tab === 'sent' ? 'No sends yet' : 'Nothing shelved'} body={tab === 'active' ? 'Save a route or boulder you’re working on and log each session on it.' : undefined} action={tab === 'active' ? <Button onClick={() => setAdding(true)}>New project</Button> : undefined} />}

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((p) => (
          <ProjectCard key={p.id} p={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} userTop={tops[p.type]} gymName={gymById(p.gymId)?.name ?? 'Gym'}
            onSend={() => send(p)}
            onShelve={() => { update((d) => updateProject(d, p.id, { status: 'abandoned' })); toast('Shelved ' + p.name, { label: 'Undo', onClick: () => update((d) => updateProject(d, p.id, { status: 'active' })) }); }}
            onReopen={() => { update((d) => updateProject(d, p.id, { status: 'active', sentAt: undefined, attempts: p.status === 'sent' ? p.attempts.filter((a) => a.highPoint < 100) : p.attempts })); setTab('active'); }}
            onDelete={() => setConfirmDel(p)}
          />
        ))}
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="New project" footer={<Button variant="primary" className="w-full" onClick={create}>Start project</Button>}>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Route or problem name
          <input className={inputCls} value={nf.name} onChange={(e) => { setNf({ ...nf, name: e.target.value }); setNfErr(''); }} placeholder="e.g. Green arête" maxLength={60} />
        </label>
        <Segmented label="Type" value={nf.type} onChange={(t) => setNf({ ...nf, type: t, grade: t === 'boulder' ? 'V5' : '5.11a' })} options={[{ value: 'boulder', label: 'Boulder' }, { value: 'route', label: 'Route' }]} />
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Grade
          <select className={inputCls} value={nf.grade} onChange={(e) => setNf({ ...nf, grade: e.target.value })}>
            {(nf.type === 'boulder' ? BOULDER_GRADES : ROUTE_GRADES).map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        <GymPicker compact value={nf.gymId} onChange={(id) => setNf({ ...nf, gymId: id })} />
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Notes (optional)
          <textarea className={cx(inputCls, 'resize-none')} rows={2} value={nf.notes} onChange={(e) => setNf({ ...nf, notes: e.target.value })} placeholder="Beta so far" />
        </label>
        {nfErr && <p role="alert" className="m-0 text-sm text-danger">{nfErr}</p>}
      </Sheet>

      <Sheet open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete project?" footer={<div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => setConfirmDel(null)}>Keep</Button><Button variant="danger" className="flex-1" onClick={() => { if (confirmDel) { update((d) => deleteProject(d, confirmDel.id)); toast('Deleted ' + confirmDel.name); } setConfirmDel(null); }}>Delete</Button></div>}>
        <p className="m-0 text-sm text-muted">{confirmDel?.name} and its {confirmDel?.attempts.length} logged sessions will be removed. Climbs you logged stay in your history.</p>
      </Sheet>

      {celebrate && (
        <Celebration grade={celebrate.grade} name={celebrate.name} accent={celebrate.type === 'boulder' ? '#FF8A3D' : '#C6F432'} detail={celebrate.attempts.reduce((s, a) => s + a.tries, 0) + ' tries over ' + celebrate.attempts.length + ' sessions, since ' + fmtDay(celebrate.startedAt)} onClose={() => { setCelebrate(null); setTab('sent'); }} />
      )}
    </div>
  );
}

function ProjectCard({ p, open, onToggle, userTop, gymName, onSend, onShelve, onReopen, onDelete }: { p: Project; open: boolean; onToggle: () => void; userTop: number | null; gymName: string; onSend: () => void; onShelve: () => void; onReopen: () => void; onDelete: () => void }) {
  const { update } = useStore();
  const toast = useToast();
  const [tries, setTries] = useState(3);
  const [hp, setHp] = useState(() => Math.max(0, ...p.attempts.map((a) => a.highPoint)));
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState(p.notes ?? '');
  const atts = p.attempts.slice().sort((a, b) => a.date.localeCompare(b.date));
  const out = projectOutlook(p, userTop);
  const best = Math.max(0, ...atts.map((a) => a.highPoint));
  const total = atts.reduce((s, a) => s + a.tries, 0);
  const tone = p.type === 'boulder' ? 'boulder' : 'route';

  const logAttempt = () => {
    update((d) => addProjectAttempt(d, p.id, { date: new Date().toISOString(), tries, highPoint: Math.min(99, hp), note: note.trim() || undefined }));
    toast('Logged ' + tries + ' tries on ' + p.name + ' · high point ' + Math.min(99, hp) + '%');
    setNote('');
  };

  return (
    <article className={cx('overflow-hidden rounded-[20px] border bg-surface', open ? 'border-muted/40' : 'border-line')}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full flex-col gap-3 p-4 text-left">
        <span className="flex w-full items-start gap-3">
          <GradeBadge type={p.type} grade={p.grade} size="lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-display text-lg font-extrabold">{p.name}</span>
            <span className="text-xs text-muted">{gymName} · since {fmtDay(p.startedAt)} · {total} tries · {atts.length} session{atts.length === 1 ? '' : 's'}{p.sentAt ? ' · sent ' + fmtDay(p.sentAt) : ''}</span>
          </span>
          <span className={cx('pt-1 font-mono text-xs', tone === 'boulder' ? 'text-boulder' : 'text-route')}>{p.status === 'sent' ? 'SENT' : best + '%'}</span>
          <ChevronDown size={18} className={cx('mt-0.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </span>
        <Bar value={best} tone={tone} className="h-2" />
        {atts.length > 0 && (
          <span className="flex h-10 w-full items-end gap-1" aria-hidden="true">
            {atts.map((a, i) => <span key={a.id} className={cx('min-h-1 flex-1 rounded', i === atts.length - 1 ? (tone === 'boulder' ? 'bg-boulder' : 'bg-route') : 'bg-line')} style={{ height: Math.max(6, a.highPoint) + '%' }} />)}
          </span>
        )}
        <span className="flex w-full justify-between font-mono text-[11px] text-muted"><span>High point by session</span><span>{out.difficulty}</span></span>
      </button>

      {open && (
        <div className="anim-fade flex flex-col gap-4 px-4 pb-4">
          {p.status === 'active' && (
            <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-bg p-3.5">
              <span className="flex items-baseline justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Send outlook</span><span className="text-[11px] text-muted">Estimate, not a guarantee{out.confidence ? ' · ' + out.confidence + ' confidence' : ''}</span></span>
              <span className={cx('font-display text-[17px] font-extrabold', tone === 'boulder' ? 'text-boulder' : 'text-route')}>{out.text}</span>
              <span className="text-xs text-muted">{out.detail}</span>
            </div>
          )}

          <ol className="m-0 list-none p-0" aria-label="Timeline">
            <li className="flex gap-3"><Dot c="bg-muted" line /><TL d={fmtDayYear(p.startedAt)} t="Project started" /></li>
            {atts.map((a, i) => {
              const prev = i ? atts[i - 1].highPoint : 0;
              const last = i === atts.length - 1;
              const label = a.highPoint >= 100 ? 'Sent' + (a.tries > 1 ? ' · ' + a.tries + ' tries that day' : '') : (i === 0 ? 'First attempt' : 'Session ' + (i + 1)) + ' · ' + a.tries + ' tries · high point ' + a.highPoint + '%' + (i && a.highPoint > prev ? ' (+' + (a.highPoint - prev) + ')' : '');
              return <li key={a.id} className="flex gap-3"><Dot c={a.highPoint >= 100 ? (tone === 'boulder' ? 'bg-boulder' : 'bg-route') : last ? 'bg-ink' : 'bg-line'} line={!last} /><TL d={fmtDayYear(a.date)} t={label} s={a.note} /></li>;
            })}
          </ol>

          <label className="flex flex-col gap-1.5 text-[13px] text-muted">Beta and notes
            <textarea className={cx(inputCls, 'resize-none')} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => update((d) => updateProject(d, p.id, { notes: notes.trim() || undefined }))} placeholder="What works, where you fall" />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-muted">Videos {p.videos.length ? '(file names saved; uploads need an account)' : ''}</span>
            <div className="flex flex-wrap gap-2">
              {p.videos.map((v) => (
                <span key={v} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-xs">
                  <Video size={14} aria-hidden="true" />{v}
                  <button aria-label={'Remove ' + v} onClick={() => update((d) => updateProject(d, p.id, { videos: p.videos.filter((x) => x !== v) }))} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-line"><X size={14} /></button>
                </span>
              ))}
              <label className="relative inline-flex min-h-9 items-center gap-2 rounded-full border border-dashed border-line px-3 text-xs font-semibold">
                <Plus size={14} aria-hidden="true" />Add video
                <input type="file" accept="video/*" className="sr-only-input" onChange={(e) => { const f = e.target.files?.[0]; if (f) update((d) => updateProject(d, p.id, { videos: [...p.videos, f.name] })); e.target.value = ''; }} />
              </label>
            </div>
          </div>

          {p.status === 'active' ? (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-line p-3.5">
                <span className="text-sm font-semibold">Log a session on it</span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[13px] text-muted">Tries</span>
                  <div className="flex items-center gap-1 rounded-xl border border-line p-1">
                    <IconButton label="Fewer tries" onClick={() => setTries(Math.max(1, tries - 1))} className="h-10 w-10">−</IconButton>
                    <span className="w-8 text-center font-display text-xl font-black" aria-live="polite">{tries}</span>
                    <IconButton label="More tries" onClick={() => setTries(Math.min(50, tries + 1))} className="h-10 w-10">+</IconButton>
                  </div>
                </div>
                <label className="flex flex-col gap-1.5 text-[13px] text-muted">High point: <b className="text-ink">{Math.min(99, hp)}%</b>
                  <input type="range" min={0} max={99} step={5} value={Math.min(99, hp)} onChange={(e) => setHp(Number(e.target.value))} className="accent-[#C6F432]" />
                </label>
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note for this session" />
                <Button onClick={logAttempt}>Save session</Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="ghost" onClick={onShelve}>Shelve</Button>
                <Button variant="danger" onClick={onDelete}><Trash2 size={16} aria-hidden="true" />Delete</Button>
                <button onClick={onSend} className={cx('min-h-12 rounded-2xl font-display font-extrabold text-accent-ink', tone === 'boulder' ? 'bg-orange' : 'bg-accent')}>Sent it</button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={onReopen}>{p.status === 'sent' ? 'Undo send' : 'Reactivate'}</Button>
              <Button variant="danger" onClick={onDelete}><Trash2 size={16} aria-hidden="true" />Delete</Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

const Dot = ({ c, line }: { c: string; line?: boolean }) => (
  <span className="flex w-3.5 flex-col items-center"><span className={cx('mt-1 h-3 w-3 rounded-full', c)} />{line && <span className="w-0.5 flex-1 bg-line" />}</span>
);
const TL = ({ d, t, s }: { d: string; t: string; s?: string }) => (
  <span className="flex flex-col gap-0.5 pb-3.5"><span className="font-mono text-[11px] text-muted">{d.toUpperCase()}</span><span className="text-sm">{t}</span>{s && <span className="text-xs text-muted">{s}</span>}</span>
);
