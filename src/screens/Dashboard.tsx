import { useMemo, useState } from 'react';
import { ChevronRight, Flame, Plus, Repeat2, Trophy, UserRound, Users } from 'lucide-react';
import { useStore } from '../store/Store';
import { useToast } from '../components/Toast';
import { GymPicker } from '../components/GymPicker';
import { GradeChart } from '../components/charts';
import { Bar, Button, Card, DemoBadge, Empty, H2, Segmented, cx } from '../components/ui';
import { achievements, buckets, filterRange, pct, personalRecords, sessionInfo, streaks, totals, trendChange, type Range } from '../lib/stats';
import { addDays, dayKey, fmtDay, fmtDayYear, fmtWeekday, greeting, startOfMonth, startOfWeek } from '../lib/dates';
import { gradeLabel, outcomeLabel } from '../lib/grades';
import { duplicateClimb, setCurrentGym, deleteClimb } from '../store/actions';
import { href, navigate } from '../lib/router';
import type { ClimbType } from '../types';
import { Logo } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { LockLabel, usePro, useUpsell } from '../lib/pro';
import { CREW_ON } from '../crew/CrewProvider';

export function Dashboard() {
  const { data, update, replace, gymById } = useStore();
  const toast = useToast();
  const now = new Date();
  const [disc, setDisc] = useState<ClimbType>('boulder');
  const { isPro } = usePro();
  const upsell = useUpsell();
  const [rangeSel, setRange] = useState<Range>('3m');
  const range: Range = isPro ? rangeSel : '30d';
  const pickRange = (v: Range) => (isPro || v === '30d' ? setRange(v) : upsell({ title: 'See ' + (v === '1y' ? 'a year' : '3 months') + ' of progress with Pro', body: 'Free shows your last 30 days. Pro adds 3 months to all time, with trend lines, monthly reports and your Year in climbing.' }));

  const monthStart = startOfMonth(now);
  const prevMonthStart = startOfMonth(addDays(monthStart, -1));
  const month = useMemo(() => {
    const cur = data.climbs.filter((c) => new Date(c.at) >= monthStart);
    // Same number of days into last month, so a partial month compares fairly.
    const prevEnd = new Date(Math.min(monthStart.getTime(), prevMonthStart.getTime() + (now.getTime() - monthStart.getTime())));
    const prev = data.climbs.filter((c) => new Date(c.at) >= prevMonthStart && new Date(c.at) < prevEnd);
    return { cur: totals(cur, 0), prev: totals(prev, 0) };
  }, [data.climbs]); // eslint-disable-line
  const t30 = useMemo(() => totals(filterRange(data.climbs, '30d'), 0), [data.climbs]);
  const st = useMemo(() => streaks(data.sessions), [data.sessions]);
  const series = useMemo(() => buckets(data.climbs, data.sessions, range), [data.climbs, data.sessions, range]);
  const trend = trendChange(series.map((b) => (disc === 'boulder' ? b.topB : b.topR)));
  const ach = useMemo(() => achievements(data.climbs, data.sessions), [data.climbs, data.sessions]);
  const prs = useMemo(() => personalRecords(data.climbs, data.sessions, (id) => gymById(id)?.name ?? ''), [data.climbs, data.sessions]); // eslint-disable-line
  const latestAch = ach.filter((a) => a.type !== 'session').slice(-1)[0];

  const weekStart = startOfWeek(now);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const k = dayKey(d);
    const n = data.climbs.filter((c) => dayKey(c.at) === k).length;
    return { d, n, today: k === dayKey(now), future: d > now };
  });
  const weekSessions = data.sessions.filter((s) => new Date(s.startedAt) >= weekStart).length;
  const weekClimbs = week.reduce((s, w) => s + w.n, 0);

  const recent = data.sessions.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 4).map((s) => sessionInfo(s, data.climbs));
  const projects = data.projects.filter((p) => p.status === 'active').slice(0, 3);
  const last = data.climbs.slice().sort((a, b) => b.at.localeCompare(a.at))[0];
  const sendDelta = month.prev.sends ? Math.round(((month.cur.sends - month.prev.sends) / month.prev.sends) * 100) : null;

  const goal = useMemo(() => {
    const done = data.training.filter((t) => t.endedAt).slice().reverse();
    for (const t of done) {
      const e = t.entries.find((x) => x.exerciseId === 'ex-maxhang');
      if (e) {
        const best = Math.max(...e.sets.map((s) => s.weight ?? 0));
        const step = data.settings.units === 'kg' ? 2 : 5;
        return { title: 'Max hang 20 mm · 10 s at +' + (best + step) + ' ' + data.settings.units, body: 'Your last session held +' + best + ' ' + data.settings.units + ' on ' + fmtDay(t.startedAt) + '. One small step up, based on your own log.' };
      }
    }
    return { title: 'Start a fingerboard routine', body: 'Log a training session and DYNOMARK will suggest your next step from your own numbers.' };
  }, [data.training, data.settings.units]);

  const repeatLast = () => {
    if (!last) return;
    const r = duplicateClimb(data, last.id);
    if (!r) return;
    replace(r.data);
    toast('Logged ' + last.grade + ' ' + outcomeLabel(last.outcome) + ' at ' + (gymById(last.gymId)?.name ?? 'gym'), { label: 'Undo', onClick: () => update((d) => deleteClimb(d, r.climb.id).data) });
  };

  return (
    <div className="flex flex-col gap-5">
      <Logo height={22} className="text-ink lg:hidden" />
      <header className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-muted">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1 className="m-0 font-display text-[28px] font-extrabold tracking-tight lg:text-[34px]">{greeting(now)}{data.user.name.trim() ? ', ' + data.user.name.trim() : ''}</h1>
        </div>
        {CREW_ON && <a href={href('/crew')} aria-label="Crew" className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink no-underline"><Users size={18} className="text-route" aria-hidden="true" />Crew</a>}
        <a href={href('/profile')} aria-label="Profile and settings" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full no-underline">{data.user.photo ? <Avatar user={data.user} size={44} /> : <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2 font-display text-[15px] font-extrabold text-ink">{data.user.name.trim() ? data.user.name.trim().slice(0, 2).toUpperCase() : <UserRound size={20} aria-hidden="true" />}</span>}</a>
      </header>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="min-w-0 flex-1"><GymPicker label="Current gym" value={data.settings.currentGymId} onChange={(id) => update((d) => setCurrentGym(d, id))} /></div>
        <Button variant="primary" size="lg" onClick={() => navigate('/log')} className="sm:w-40"><Plus size={22} strokeWidth={2.8} aria-hidden="true" />Quick log</Button>
      </div>
      {last && (
        <button onClick={repeatLast} className="flex min-h-12 items-center gap-2.5 rounded-[14px] border border-dashed border-line px-3.5 text-left text-sm">
          <Repeat2 size={18} className="text-route" aria-hidden="true" />
          <span className="flex-1">Repeat last: <b>{last.grade} {outcomeLabel(last.outcome)}</b>{last.color ? ' · ' + last.color.toLowerCase() : ''}{last.angle ? ' · ' + last.angle : ''}</span>
          <span className="text-xs text-muted">1 tap</span>
        </button>
      )}
      {data.user.isDemo && <p className="m-0 flex items-center gap-2 text-xs text-muted"><DemoBadge />Sample climbing history, not real activity. <a href={href('/profile')} className="text-route">Start fresh</a></p>}
      {(() => {
        // First week of the month: a nudge to last month's report (in early January, the year in climbing too).
        const n = new Date();
        if (n.getDate() > 7) return null;
        const last = new Date(n.getFullYear(), n.getMonth() - 1, 1);
        const yearEnd = n.getMonth() === 0;
        const to = yearEnd ? '/report?y=' + last.getFullYear() : '/report?m=' + last.getFullYear() + '-' + String(last.getMonth() + 1).padStart(2, '0');
        return (
          <a href={href(to)} className="flex min-h-14 items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-3.5 text-ink no-underline">
            <Trophy size={20} className="shrink-0 text-route" aria-hidden="true" />
            <span className="flex flex-1 flex-col"><b className="text-sm">{yearEnd ? 'Your ' + last.getFullYear() + ' in climbing is ready' : 'Your ' + last.toLocaleDateString([], { month: 'long' }) + ' report is ready'}</b><span className="text-xs text-muted">Sends, hardest grades, gyms and projects</span></span>
            <ChevronRight size={18} className="text-muted" aria-hidden="true" />
          </a>
        );
      })()}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-3.5">
          <H2 right={<span className="text-[13px] text-muted">{weekSessions} session{weekSessions === 1 ? '' : 's'} · {weekClimbs} climbs</span>}>This week</H2>
          <div className="grid grid-cols-7 gap-1.5">
            {week.map((w) => (
              <div key={w.d.toISOString()} className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] text-muted">{fmtWeekday(w.d.toISOString()).slice(0, 1)}</span>
                <span title={w.n ? w.n + ' climbs' : 'No climbing'} className={cx('flex h-10 w-full max-w-10 items-center justify-center rounded-xl border font-mono text-[13px] font-bold', w.n ? 'border-accent bg-accent text-accent-ink' : w.today ? 'border-ink text-ink' : 'border-line text-muted', w.future && 'opacity-50')}>{w.d.getDate()}</span>
              </div>
            ))}
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1 rounded-[18px] border border-line bg-surface p-3.5">
            <span className="text-xs text-muted">Hardest send · {now.toLocaleDateString([], { month: 'short' })}</span>
            <span className="font-display text-[30px] font-black leading-none text-boulder">{gradeLabel('boulder', month.cur.topBoulder)}</span>
            <span className="text-xs text-muted">Routes <b className="text-ink">{gradeLabel('route', month.cur.topRoute)}</b></span>
          </div>
          <div className="flex flex-col gap-1 rounded-[18px] border border-line bg-surface p-3.5">
            <span className="flex items-center gap-1 text-xs text-muted"><Flame size={13} aria-hidden="true" />Weekly streak</span>
            <span className="font-display text-[30px] font-black leading-none">{st.current}<span className="text-base text-muted"> wk</span></span>
            <span className="text-xs text-muted">Longest <b className="text-ink">{st.longest} wk</b></span>
          </div>
          <div className="flex flex-col gap-1 rounded-[18px] border border-line bg-surface p-3.5">
            <span className="text-xs text-muted">Sends this month</span>
            <span className="font-display text-[30px] font-black leading-none">{month.cur.sends}</span>
            <span className={cx('text-xs', sendDelta != null && sendDelta >= 0 ? 'text-route' : 'text-muted')}>{sendDelta == null ? 'None by this point last month' : (sendDelta >= 0 ? '+' : '') + sendDelta + '% vs same point last month'}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-[18px] border border-line bg-surface p-3.5">
            <span className="text-xs text-muted">Flash rate · 30D</span>
            <span className="font-display text-[30px] font-black leading-none">{pct(t30.flashRate)}</span>
            <span className="text-xs text-muted">On-sight <b className="text-ink">{pct(t30.onsightRate)}</b></span>
          </div>
        </div>
      </div>

      {latestAch && (
        <a href={href('/progress')} className="flex items-center gap-3.5 rounded-[18px] border border-line bg-surface-2 p-3.5 text-ink no-underline">
          <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-accent-ink', latestAch.type === 'route' ? 'bg-accent' : 'bg-orange')}><Trophy size={22} aria-hidden="true" /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted">Latest milestone</span>
            <span className="font-display text-[17px] font-extrabold">{latestAch.label}</span>
            <span className="truncate text-xs text-muted">{[latestAch.detail, fmtDayYear(latestAch.date)].filter(Boolean).join(' · ')}</span>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </a>
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-[15px] font-semibold">Grade progression</h2>
          <Segmented label="Discipline" value={disc} onChange={setDisc} options={[{ value: 'route', label: 'Routes' }, { value: 'boulder', label: 'Boulders' }]} />
        </div>
        <div className="flex items-center gap-2">
          <Segmented label="Time range" size="sm" value={range} onChange={pickRange} options={[{ value: '30d', label: '30D' }, { value: '3m', label: <LockLabel locked={!isPro}>3M</LockLabel> }, { value: '1y', label: <LockLabel locked={!isPro}>1Y</LockLabel> }]} />
          <span className={cx('ml-auto text-xs font-semibold', disc === 'boulder' ? 'text-boulder' : 'text-route')}>
            {trend == null ? 'Not enough data' : (trend >= 0 ? '+' : '') + trend.toFixed(1) + (disc === 'boulder' ? ' V-grades' : ' letter grades') + ' trend'}
          </span>
        </div>
        {series.some((b) => (disc === 'boulder' ? b.topB : b.topR) != null)
          ? <GradeChart data={series} show={{ route: disc === 'route', boulder: disc === 'boulder', top: true, avg: true, trend: true }} />
          : <Empty title="No sends in this range" body="Log a few climbs and your grade line appears here." />}
        <div className="flex flex-wrap gap-3.5 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className={cx('h-[3px] w-3.5 rounded', disc === 'boulder' ? 'bg-boulder' : 'bg-route')} />Top send</span>
          <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed border-muted" />Average sent</span>
          <span className="flex items-center gap-1.5"><span className="w-3.5 border-t border-dotted border-muted" />Trend</span>
          <a href={href('/progress')} className="ml-auto text-route">All analytics</a>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="flex flex-col gap-2.5" aria-labelledby="recent-h">
          <H2 id="recent-h" right={<a href={href('/sessions')} className="text-[13px] text-route">All sessions</a>}>Recent sessions</H2>
          {recent.length === 0 && <Empty title="No sessions yet" body="Your sessions show up here after you log a climb." action={<Button variant="primary" onClick={() => navigate('/log')}>Log a climb</Button>} />}
          {recent.map((r) => (
            <a key={r.session.id} href={href('/session/' + r.session.id)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-ink no-underline">
              <span className="flex w-12 flex-col items-center font-mono">
                <span className="text-[11px] text-muted">{fmtWeekday(r.session.startedAt).toUpperCase()}</span>
                <span className="text-lg font-bold">{new Date(r.session.startedAt).getDate()}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold">{gymById(r.session.gymId)?.name ?? 'Gym'}{!r.session.endedAt && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold text-accent-ink">LIVE</span>}</span>
                <span className="text-xs text-muted">{r.climbs.length} climbs · {r.sends} sends · {r.flashes} first-try</span>
              </span>
              <span className="flex flex-col items-end font-display font-extrabold">
                {r.topB != null && <span className="text-boulder">{gradeLabel('boulder', r.topB)}</span>}
                {r.topR != null && <span className="text-route">{gradeLabel('route', r.topR)}</span>}
              </span>
            </a>
          ))}
        </section>

        <section className="flex flex-col gap-2.5" aria-labelledby="proj-h">
          <H2 id="proj-h" right={<a href={href('/projects')} className="text-[13px] text-route">All projects</a>}>Active projects</H2>
          {projects.length === 0 && <Empty title="No active projects" body="Save a route or boulder you’re working on to track it." action={<Button onClick={() => navigate('/projects')}>Add a project</Button>} />}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const best = Math.max(0, ...p.attempts.map((a) => a.highPoint));
              return (
                <a key={p.id} href={href('/projects?id=' + p.id)} className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-3.5 text-ink no-underline">
                  <span className={cx('font-display text-2xl font-black', p.type === 'boulder' ? 'text-boulder' : 'text-route')}>{p.grade}</span>
                  <span className="truncate text-sm font-semibold">{p.name}</span>
                  <span className="truncate text-xs text-muted">{gymById(p.gymId)?.name} · {p.attempts.reduce((s, a) => s + a.tries, 0)} tries</span>
                  <Bar value={best} tone={p.type === 'boulder' ? 'boulder' : 'route'} />
                  <span className="text-[11px] text-muted">High point {best}%</span>
                </a>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-1">
          <H2 right={<a href={href('/progress')} className="text-[13px] text-route">All records</a>}>Personal records</H2>
          {prs.length === 0 && <p className="m-0 py-3 text-sm text-muted">Records appear after your first sends.</p>}
          {prs.slice(0, 4).map((r) => (
            <div key={r.id} className="flex min-h-12 items-center gap-3 border-t border-surface-2 pt-2 first:border-0">
              <span className="flex flex-1 flex-col"><span className="text-sm">{r.label}</span><span className="text-xs text-muted">{[r.gymId ? gymById(r.gymId)?.name : '', r.date ? fmtDayYear(r.date) : ''].filter(Boolean).join(' · ')}</span></span>
              <b className="font-display text-lg">{r.value}</b>
            </div>
          ))}
        </Card>
        <a href={href('/training')} className="flex flex-col gap-1.5 rounded-[20px] border border-line bg-surface p-4 text-ink no-underline">
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted">Suggested next training goal</span>
          <span className="font-display text-[17px] font-extrabold">{goal.title}</span>
          <span className="text-[13px] text-muted">{goal.body}</span>
          <span className="mt-1 text-[13px] font-semibold text-route">Open training</span>
        </a>
      </div>
    </div>
  );
}
