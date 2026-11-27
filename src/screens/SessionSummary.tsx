import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Pencil, Share2, Trash2, Trophy } from 'lucide-react';
import { useStore } from '../store/Store';
import { useToast } from '../components/Toast';
import { Button, Card, Empty, GradeBadge, H2, IconButton, Segmented, Sheet, cx, inputCls } from '../components/ui';
import { achievements, buckets, pyramid, sessionSummary, totals } from '../lib/stats';
import { colorHex, gradeLabel, outcomeLabel } from '../lib/grades';
import { fmtDayYear, fmtDuration, fmtTime, fmtWeekday, monthShort, startOfMonth } from '../lib/dates';
import { renderCard, type CardSpec, shareCardImage } from '../lib/shareCard';
import { isNative } from '../lib/native';
import { deleteSession } from '../store/actions';
import { href, navigate } from '../lib/router';
import type { ClimbType } from '../types';
import { LockLabel, usePro, useUpsell } from '../lib/pro';
import { PostToCrew } from '../crew/PostToCrew';

type CardKind = 'session' | 'pr' | 'month' | 'project' | 'progression';

export function SessionSummary({ id }: { id: string }) {
  const { isPro } = usePro();
  const upsell = useUpsell();
  const { data, update, gymById } = useStore();
  const toast = useToast();
  const sum = useMemo(() => sessionSummary(id, data.climbs, data.sessions), [id, data.climbs, data.sessions]);
  const [kind, setKind] = useState<CardKind>('session');
  const [img, setImg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [notes, setNotes] = useState(() => data.sessions.find((s) => s.id === id)?.notes ?? '');

  const spec = useMemo<CardSpec | null>(() => {
    if (!sum) return null;
    const s = sum.info.session;
    const demo = !!s.isDemo || data.user.isDemo;
    const gym = gymById(s.gymId)?.name ?? 'Gym';
    const topLabel = [sum.totals.topBoulder != null ? gradeLabel('boulder', sum.totals.topBoulder) : null, sum.totals.topRoute != null ? gradeLabel('route', sum.totals.topRoute) : null].filter(Boolean).join(' / ') || '—';
    if (kind === 'session') return { kicker: fmtDayYear(s.startedAt).toUpperCase(), label: 'Session · ' + gym, big: sum.info.sends + '/' + sum.info.climbs.length, sub: 'sends. Top grade ' + topLabel + '.', stats: [{ v: topLabel.split(' / ')[0], l: 'Top' }, { v: String(sum.info.flashes), l: 'First try' }, { v: String(sum.info.attempts), l: 'Tries' }], accent: '#FF8A3D', demo };
    if (kind === 'pr') {
      const a = achievements(data.climbs, data.sessions).filter((x) => x.type !== 'session').slice(-1)[0];
      return a ? { kicker: fmtDayYear(a.date).toUpperCase(), label: 'New personal record', big: a.label.replace('First ', ''), sub: a.label + (a.detail ? '. ' + a.detail : '') + '.', stats: [{ v: String(totals(data.climbs, 0).sends), l: 'Career sends' }, { v: String(data.sessions.length), l: 'Sessions' }], accent: a.type === 'route' ? '#C6F432' : '#FF8A3D', demo } : null;
    }
    if (kind === 'month') {
      const ms = startOfMonth(new Date(s.startedAt));
      const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 1);
      const cs = data.climbs.filter((c) => new Date(c.at) >= ms && new Date(c.at) < me);
      const ss = data.sessions.filter((x) => new Date(x.startedAt) >= ms && new Date(x.startedAt) < me);
      const t = totals(cs, ss.length);
      return { kicker: (monthShort(ms.getMonth()) + ' ' + ms.getFullYear()).toUpperCase(), label: monthShort(ms.getMonth()) + ' recap', big: String(t.sends), sub: 'sends in ' + ss.length + ' sessions.', stats: [{ v: gradeLabel('boulder', t.topBoulder), l: 'Boulder' }, { v: gradeLabel('route', t.topRoute), l: 'Route' }, { v: t.flashRate == null ? '—' : Math.round(t.flashRate * 100) + '%', l: 'Flash' }], accent: '#C6F432', demo };
    }
    if (kind === 'project') {
      const p = data.projects.filter((x) => x.status === 'sent').sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''))[0];
      return p ? { kicker: p.name.toUpperCase(), label: 'Project sent', big: 'SENT.', sub: p.grade + ' after ' + p.attempts.reduce((x, a) => x + a.tries, 0) + ' tries over ' + p.attempts.length + ' sessions.', stats: [{ v: p.grade, l: 'Grade' }, { v: String(p.attempts.length), l: 'Sessions' }], accent: p.type === 'route' ? '#C6F432' : '#FF8A3D', demo } : null;
    }
    const b = buckets(data.climbs, data.sessions, '1y');
    const vals = b.map((x) => x.topB).filter((v): v is number => v != null);
    return vals.length > 1 ? { kicker: '12 MONTHS', label: 'Grade progression', big: 'V' + vals[0] + '→V' + vals[vals.length - 1], sub: 'Top boulder send per month.', stats: [{ v: String(data.sessions.length), l: 'Sessions' }, { v: gradeLabel('route', totals(data.climbs, 0).topRoute), l: 'Top route' }], accent: '#C6F432', spark: vals, demo } : null;
  }, [kind, sum, data, gymById]);

  useEffect(() => {
    let alive = true;
    setImg(null);
    if (spec) renderCard(spec).then((c) => { if (alive) setImg(c.toDataURL('image/png')); });
    return () => { alive = false; };
  }, [spec]);

  if (!sum) return <Empty title="Session not found" body="It may have been deleted." action={<Button onClick={() => navigate('/sessions')}>All sessions</Button>} />;
  const s = sum.info.session;
  const gym = gymById(s.gymId);
  const dur = s.endedAt ? new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime() : Date.now() - new Date(s.startedAt).getTime();
  const types: ClimbType[] = (['boulder', 'route'] as ClimbType[]).filter((t) => sum.info.climbs.some((c) => c.type === t));

  const share = async () => {
    if (!spec) return;
    const name = 'dynomark-' + kind + '.png';
    const res = await shareCardImage(spec, name);
    if (res === 'saved') toast('Saved ' + name);
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <IconButton label="Back" onClick={() => history.length > 1 ? history.back() : navigate('/')}><ArrowLeft size={20} aria-hidden="true" /></IconButton>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs uppercase tracking-[0.08em] text-muted">{s.endedAt ? 'Session summary' : 'Session in progress'}{s.isDemo ? ' · sample data' : ''}</span>
          <span className="truncate text-sm">{gym?.name} · {fmtWeekday(s.startedAt)} {fmtDayYear(s.startedAt)} · {fmtTime(s.startedAt)} · {fmtDuration(dur)}</span>
        </div>
        <IconButton label="Delete session" onClick={() => setConfirm(true)} className="text-danger"><Trash2 size={18} aria-hidden="true" /></IconButton>
      </header>

      <section className="anim-rise">
        <h1 className="m-0 font-display text-[56px] font-black leading-[0.95] tracking-[-0.03em] sm:text-[72px]">{sum.info.climbs.length} climbs.<br /><span className="text-boulder">{sum.info.sends} sent.</span></h1>
      </section>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          [String(sum.info.climbs.length), 'Climbs', ''],
          [String(sum.info.sends), 'Sends', 'text-boulder'],
          [gradeLabel('boulder', sum.totals.topBoulder), 'Top boulder', 'text-boulder'],
          [gradeLabel('route', sum.totals.topRoute), 'Top route', 'text-route'],
          [String(sum.totals.flashes), 'Flashes', ''],
          [String(sum.info.attempts), 'Attempts', ''],
        ].map(([v, l, c]) => (
          <div key={l} className="flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-3">
            <span className={cx('font-display text-2xl font-black', c)}>{v}</span>
            <span className="text-xs text-muted">{l}</span>
          </div>
        ))}
      </div>

      <PostToCrew sessionId={id} />

      {sum.records.length > 0 && (
        <section className="flex flex-col gap-2.5 rounded-[20px] border border-accent/40 bg-accent/10 p-4">
          <h2 className="m-0 flex items-center gap-2 font-display text-[17px] font-extrabold"><Trophy size={20} className="text-route" aria-hidden="true" />{sum.records.length} new personal record{sum.records.length > 1 ? 's' : ''}</h2>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">{sum.records.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {types.map((t) => {
          const pyr = pyramid(sum.info.climbs, t);
          const max = Math.max(1, ...pyr.map((p) => p.tried));
          return (
            <Card key={t} className="flex flex-col gap-2.5">
              <H2 right={<span className="text-xs text-muted">sent / tried</span>}>{t === 'boulder' ? 'Boulder' : 'Route'} pyramid</H2>
              {pyr.map((p, i) => (
                <div key={p.idx} className="flex items-center gap-2.5">
                  <span className="w-12 font-mono text-[13px] font-bold">{p.grade}</span>
                  <div className="relative h-5 flex-1">
                    <div className={cx('anim-grow absolute inset-y-0 left-0 rounded-md border border-dashed', t === 'boulder' ? 'border-boulder' : 'border-route')} style={{ width: (p.tried / max) * 100 + '%', animationDelay: i * 0.06 + 's' }} />
                    <div className={cx('anim-grow absolute inset-y-0 left-0 rounded-md', t === 'boulder' ? 'bg-boulder' : 'bg-route')} style={{ width: (p.sent / max) * 100 + '%', animationDelay: i * 0.06 + 's' }} />
                  </div>
                  <span className="w-10 text-right font-mono text-xs text-muted">{p.sent}/{p.tried}</span>
                </div>
              ))}
            </Card>
          );
        })}
        <Card className="flex flex-col gap-1">
          <H2>Vs your last {sum.comparedWith || ''} sessions</H2>
          {sum.compare.length === 0 && <p className="m-0 py-2 text-sm text-muted">Log a few more sessions to compare.</p>}
          {sum.compare.map((c) => {
            const has = c.now != null && c.avg != null;
            const diff = has ? (c.now as number) - (c.avg as number) : 0;
            const good = c.better === 'higher' ? diff > 0.05 : diff < -0.05;
            const bad = c.better === 'higher' ? diff < -0.05 : diff > 0.05;
            return (
              <div key={c.label} className="flex min-h-10 items-center gap-2.5 border-t border-surface-2">
                <span className="flex-1 text-sm">{c.label}</span>
                <span className="font-mono text-[13px] text-muted">{c.avg == null ? '—' : c.fmt(c.avg)}</span>
                <span className="w-14 text-right font-mono text-sm font-bold">{c.now == null ? '—' : c.fmt(c.now)}</span>
                <span className={cx('w-16 text-right text-xs font-bold', good && 'text-route', bad && 'text-danger', !good && !bad && 'text-muted')}>{!has ? '' : good ? 'better' : bad ? 'lower' : 'level'}</span>
              </div>
            );
          })}
          <p className="m-0 pt-1.5 text-xs text-muted">Average of your previous sessions at any gym. Fewer attempts per send is better.</p>
        </Card>
      </div>

      <Card className="flex flex-col gap-2.5">
        <H2 right={!s.endedAt ? <a href={href('/log')} className="text-[13px] text-route">Keep logging</a> : undefined}>Climbs</H2>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {sum.info.climbs.slice().sort((a, b) => a.at.localeCompare(b.at)).map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-t border-surface-2 py-1.5 first:border-0">
              <GradeBadge type={c.type} grade={c.grade} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-semibold">{outcomeLabel(c.outcome)}<span className="h-2 w-2 rounded-full" style={{ background: colorHex(c.color) }} aria-label={c.color} /></span>
                <span className="truncate text-xs text-muted">{fmtTime(c.at)} · {c.attempts} {c.attempts === 1 ? 'try' : 'tries'}{c.angle ? ' · ' + c.angle : ''}{c.name ? ' · ' + c.name : ''}{c.feel ? ' · felt ' + c.feel : ''}</span>
              </span>
              <IconButton label={'Edit ' + c.grade} onClick={() => navigate('/log/edit/' + c.id)}><Pencil size={16} aria-hidden="true" /></IconButton>
            </li>
          ))}
        </ul>
        <label className="flex flex-col gap-1.5 text-[13px] text-muted">Session notes
          <textarea className={cx(inputCls, 'resize-none')} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => update((d) => ({ ...d, sessions: d.sessions.map((x) => (x.id === id ? { ...x, notes: notes.trim() || undefined } : x)) }))} placeholder="Skin, energy, what the setters changed" />
        </label>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="share-h">
        <H2 id="share-h">Share card</H2>
        <div className="no-scrollbar -mx-5 overflow-x-auto px-5">
          <Segmented label="Card type" value={kind} onChange={(v) => (isPro || v === 'session' ? setKind(v) : upsell({ title: 'More share-card styles with Pro', body: 'Free includes the session card. Pro adds record, monthly recap, project send and progression cards.' }))} options={[{ value: 'session', label: 'Session' }, { value: 'pr', label: <LockLabel locked={!isPro}>Record</LockLabel> }, { value: 'month', label: <LockLabel locked={!isPro}>Monthly recap</LockLabel> }, { value: 'project', label: <LockLabel locked={!isPro}>Project send</LockLabel> }, { value: 'progression', label: <LockLabel locked={!isPro}>Progression</LockLabel> }]} />
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end">
          <div className="aspect-[4/5] w-[300px] max-w-full overflow-hidden rounded-[22px] border border-line bg-[#0B0C0D]">
            {img ? <img src={img} alt={spec ? 'Share card: ' + spec.label + ', ' + spec.big + ' ' + spec.sub : ''} className="h-full w-full" /> : <div className="flex h-full items-center justify-center text-sm text-muted">{spec ? 'Drawing…' : 'Nothing to show for this card yet'}</div>}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-56">
            <Button variant="primary" onClick={share} disabled={!spec}><Share2 size={18} aria-hidden="true" />Share image</Button>
            {img && !isNative() && <a href={img} download={'dynomark-' + kind + '.png'} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line font-semibold text-ink no-underline"><Download size={18} aria-hidden="true" />Download PNG</a>}
            <span className="text-xs text-muted">1080 × 1350, sized for Instagram and Stories.</span>
          </div>
        </div>
      </section>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Delete this session?" footer={<div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => setConfirm(false)}>Keep it</Button><Button variant="danger" className="flex-1" onClick={() => { update((d) => deleteSession(d, id)); toast('Session deleted'); navigate('/sessions'); }}>Delete</Button></div>}>
        <p className="m-0 text-sm text-muted">This removes the session and its {sum.info.climbs.length} climbs from this device. It can’t be undone.</p>
      </Sheet>
    </div>
  );
}
