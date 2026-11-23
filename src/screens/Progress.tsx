import { useMemo, useState } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/Store';
import { ChartTip, GradeChart, type GradeSeries } from '../components/charts';
import { Card, Chip, DemoBadge, Empty, H1, H2, IconButton, Segmented, Stat, cx } from '../components/ui';
import { RANGES, achievements, buckets, dailyActivity, filterRange, gymStats, linearFit, pct, personalRecords, streaks, styleAnalysis, totals, type Range } from '../lib/stats';
import { FONT_MONO } from '../lib/fonts';
import { gradeAvgLabel, gradeLabel } from '../lib/grades';
import { addDays, dayKey, fmtDayYear, monthShort, startOfWeek, weekKey } from '../lib/dates';
import { usePalette } from '../lib/theme';
import { href } from '../lib/router';
import type { Climb } from '../types';
import { LockLabel, ProBadge, usePro, useUpsell } from '../lib/pro';

type Tab = 'grades' | 'volume' | 'flash' | 'efficiency';
type Disc = 'all' | 'route' | 'boulder';

export function Progress() {
  const { data, gymById } = useStore();
  const p = usePalette();
  const { isPro } = usePro();
  const upsell = useUpsell();
  const [rangeSel, setRange] = useState<Range>('3m');
  const range: Range = isPro || rangeSel === '7d' || rangeSel === '30d' ? rangeSel : '30d';
  const pickRange = (v: Range) => {
    if (!isPro && v !== '7d' && v !== '30d') {
      const long = ({ '3m': '3 months', '6m': '6 months', '1y': 'a year', all: 'all time' } as Record<string, string>)[v];
      upsell({ title: 'See ' + long + ' of progress with Pro', body: 'Your climbs are all still here. Pro draws them as long-range charts with trend lines, plus monthly reports and your Year in climbing.' });
      return;
    }
    setRange(v);
  };
  const [tab, setTab] = useState<Tab>('grades');
  const [disc, setDisc] = useState<Disc>('all');
  const [gs, setGs] = useState<GradeSeries>({ route: true, boulder: true, top: true, avg: true, trend: true });
  const [fs, setFs] = useState({ flash: true, onsight: true, redpoint: true });
  const [styleMode, setStyleMode] = useState<'send' | 'volume'>('send');

  const climbsD = useMemo(() => (disc === 'all' ? data.climbs : data.climbs.filter((c) => c.type === disc)), [data.climbs, disc]);
  const rc = useMemo(() => filterRange(climbsD, range), [climbsD, range]);
  const rs = useMemo(() => filterRange(data.sessions, range), [data.sessions, range]);
  const t = useMemo(() => totals(rc, rs.length), [rc, rs]);
  const st = useMemo(() => streaks(data.sessions), [data.sessions]);
  const series = useMemo(() => buckets(climbsD, data.sessions, range), [climbsD, data.sessions, range]);
  const styles = useMemo(() => styleAnalysis(rc), [rc]);
  const prs = useMemo(() => personalRecords(data.climbs, data.sessions, (id) => gymById(id)?.name ?? ''), [data.climbs, data.sessions]); // eslint-disable-line
  const ach = useMemo(() => achievements(data.climbs, data.sessions), [data.climbs, data.sessions]);
  const apsFit = linearFit(series.map((b) => b.aps));

  const axis = { stroke: p.muted, fontSize: 11, fontFamily: FONT_MONO };
  const metrics = [
    { l: 'Sessions', v: t.sessions },
    { l: 'Current streak', v: st.current + ' wk', tone: 'route' as const, sub: 'Longest ' + st.longest + ' wk' },
    { l: 'Routes tried', v: t.routesTried },
    { l: 'Routes sent', v: t.routesSent, tone: 'route' as const },
    { l: 'Boulders tried', v: t.bouldersTried },
    { l: 'Boulders sent', v: t.bouldersSent, tone: 'boulder' as const },
    { l: 'Hardest route', v: gradeLabel('route', t.topRoute), tone: 'route' as const, sub: 'Avg sent ' + gradeAvgLabel('route', t.avgRoute) },
    { l: 'Hardest boulder', v: gradeLabel('boulder', t.topBoulder), tone: 'boulder' as const, sub: 'Avg sent ' + gradeAvgLabel('boulder', t.avgBoulder) },
    { l: 'Flash rate', v: pct(t.flashRate), sub: 'Of new sends' },
    { l: 'On-sight rate', v: pct(t.onsightRate), sub: 'Of new route sends' },
    { l: 'Attempts per send', v: t.attemptsPerSend == null ? '—' : t.attemptsPerSend.toFixed(1), sub: 'New sends only' },
    { l: 'Personal records', v: prs.length, sub: ach.filter((a) => a.type !== 'session').length + ' milestones' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <H1 sub={data.user.isDemo ? <span className="inline-flex items-center gap-2"><DemoBadge />Sample data</span> : 'From your own logs'}>Progress</H1>
        <Segmented label="Discipline" value={disc} onChange={setDisc} options={[{ value: 'all', label: 'All' }, { value: 'route', label: 'Routes' }, { value: 'boulder', label: 'Boulders' }]} />
      </header>
      <ReportLinks />
      <div className="no-scrollbar -mx-5 overflow-x-auto px-5">
        <Segmented label="Time range" value={range} onChange={pickRange} options={RANGES.map((r) => ({ value: r.id, label: <LockLabel locked={!isPro && r.id !== '7d' && r.id !== '30d'}>{r.id === 'all' ? 'All time' : r.label}</LockLabel> }))} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {metrics.map((m) => <Stat key={m.l} label={m.l} value={m.v} tone={m.tone} sub={m.sub} />)}
      </div>

      <Card className="flex flex-col gap-3">
        <div role="tablist" aria-label="Chart" className="grid grid-cols-4 rounded-xl bg-surface-2 p-[3px]">
          {([['grades', 'Grades'], ['volume', 'Volume'], ['flash', 'Flash'], ['efficiency', 'Efficiency']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('h-9 rounded-[9px] text-[13px] font-semibold', tab === k ? 'bg-ink text-bg' : 'text-muted')}>{l}</button>
          ))}
        </div>

        {series.length === 0 || series.every((b) => b.climbs === 0) ? <Empty title="No climbs in this range" body="Pick a longer range or log a session." /> : (
          <>
            {tab === 'grades' && (
              <>
                <p className="m-0 text-xs text-muted">Top and average send per {series.length && range.endsWith('d') ? 'session' : range === '3m' || range === '6m' ? 'week' : 'month'}. Boulders use the left axis, routes the right.</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Series">
                  {disc !== 'route' && <Chip selected={gs.boulder} accent="boulder" onClick={() => setGs({ ...gs, boulder: !gs.boulder })}>Boulders</Chip>}
                  {disc !== 'boulder' && <Chip selected={gs.route} accent="route" onClick={() => setGs({ ...gs, route: !gs.route })}>Routes</Chip>}
                  <Chip selected={gs.top} onClick={() => setGs({ ...gs, top: !gs.top })}>Top send</Chip>
                  <Chip selected={gs.avg} onClick={() => setGs({ ...gs, avg: !gs.avg })}>Average</Chip>
                  <Chip selected={gs.trend} onClick={() => setGs({ ...gs, trend: !gs.trend })}>Trend</Chip>
                </div>
                <GradeChart height={260} data={series} show={{ ...gs, route: gs.route && disc !== 'boulder', boulder: gs.boulder && disc !== 'route' }} />
              </>
            )}
            {tab === 'volume' && (
              <>
                <p className="m-0 text-xs text-muted">Sends vs attempts that didn’t end in a send. Total send ratio {t.attempts ? Math.round((t.sends / t.attempts) * 100) : 0}% of attempts.</p>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke={p.grid} vertical={false} />
                      <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: p.grid }} minTickGap={20} />
                      <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: p.grid, opacity: 0.4 }} content={(tp: any) => <ChartTip {...tp} rows={(d: any) => [{ name: 'Sends', value: String(d.sends), color: p.boulder }, { name: 'Other attempts', value: String(d.failed), color: p.unsent }, { name: 'Climbs logged', value: String(d.climbs), color: p.muted }]} />} />
                      <RBar dataKey="sends" stackId="v" fill={p.boulder} radius={[0, 0, 4, 4]} isAnimationActive={false} />
                      <RBar dataKey="failed" stackId="v" fill={p.unsent} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.boulder }} />Sends</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.unsent }} />Other attempts</span></div>
              </>
            )}
            {tab === 'flash' && (
              <>
                <p className="m-0 text-xs text-muted">Flash: first-try sends of all new sends. On-sight and redpoint: share of new route sends.</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Series">
                  <Chip selected={fs.flash} accent="boulder" onClick={() => setFs({ ...fs, flash: !fs.flash })}>Flash</Chip>
                  <Chip selected={fs.onsight} accent="route" onClick={() => setFs({ ...fs, onsight: !fs.onsight })}>On-sight</Chip>
                  <Chip selected={fs.redpoint} onClick={() => setFs({ ...fs, redpoint: !fs.redpoint })}>Redpoint</Chip>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke={p.grid} vertical={false} />
                      <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: p.grid }} minTickGap={20} />
                      <YAxis domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => v + '%'} />
                      <Tooltip content={(tp: any) => <ChartTip {...tp} rows={(d: any) => [{ name: 'Flash', value: d.flashRate == null ? '—' : d.flashRate + '%', color: p.boulder }, { name: 'On-sight', value: d.onsightRate == null ? '—' : d.onsightRate + '%', color: p.route }, { name: 'Redpoint', value: d.redpointRate == null ? '—' : d.redpointRate + '%', color: p.blue }]} />} />
                      {fs.redpoint && <Line dataKey="redpointRate" stroke={p.blue} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />}
                      {fs.flash && <Line dataKey="flashRate" stroke={p.boulder} strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />}
                      {fs.onsight && <Line dataKey="onsightRate" stroke={p.route} strokeWidth={3} strokeDasharray="6 5" dot={false} connectNulls isAnimationActive={false} />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
            {tab === 'efficiency' && (
              <>
                <p className="m-0 text-sm font-semibold">
                  {apsFit == null ? 'Not enough sends to see a trend.' : apsFit.slope < -0.005 ? <span className="text-route">Improving: fewer attempts per send over this range.</span> : apsFit.slope > 0.005 ? <span className="text-boulder">More attempts per send lately. Often a sign you’re trying harder climbs.</span> : 'Holding steady.'}
                </p>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke={p.grid} vertical={false} />
                      <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: p.grid }} minTickGap={20} />
                      <YAxis domain={[1, 'auto']} tick={axis} tickLine={false} axisLine={false} allowDecimals />
                      <Tooltip content={(tp: any) => <ChartTip {...tp} rows={(d: any) => [{ name: 'Attempts per send', value: d.aps == null ? '—' : d.aps.toFixed(1), color: p.route }]} />} />
                      <Line dataKey="aps" stroke={p.route} strokeWidth={3} dot={{ r: 3, fill: p.surface, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}
      </Card>

      <Consistency climbs={data.climbs} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <H2 right={<Segmented size="sm" label="Measure" value={styleMode} onChange={setStyleMode} options={[{ value: 'send', label: 'Send rate' }, { value: 'volume', label: 'Volume' }]} />}>Climbing style</H2>
          <div className="h-[230px]" role="img" aria-label="Radar chart of climbing styles">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={styles.rows.map((r) => ({ ...r, value: styleMode === 'send' ? r.sendRate ?? 0 : r.volume }))} outerRadius="72%">
                <PolarGrid stroke={p.grid} />
                <PolarAngleAxis dataKey="label" tick={{ fill: p.muted, fontSize: 11 }} />
                <Radar dataKey="value" stroke={styleMode === 'send' ? p.route : p.blue} fill={styleMode === 'send' ? p.route : p.blue} fillOpacity={0.25} isAnimationActive={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1.5 p-0 text-[13px]">
            {styles.rows.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-2"><span>{r.label}</span><span className="font-mono text-muted">{r.count} · {r.sendRate == null ? 'few logs' : r.sendRate + '% sent'}</span></li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            {styles.strongest && <div className="rounded-xl bg-surface-2 p-3"><span className="block text-[11px] text-muted">Strongest</span><b className="text-sm text-route">{styles.strongest.label} · {styles.strongest.sendRate}% sent</b></div>}
            {styles.weakest && styles.weakest !== styles.strongest && <div className="rounded-xl bg-surface-2 p-3"><span className="block text-[11px] text-muted">Room to grow</span><b className="text-sm text-boulder">{styles.weakest.label} · {styles.weakest.sendRate}% sent</b></div>}
          </div>
        </Card>

        <Card className="flex flex-col gap-1">
          <H2>Personal records</H2>
          {prs.length === 0 && <p className="m-0 py-2 text-sm text-muted">No records yet.</p>}
          {prs.map((r) => (
            <div key={r.id} className="flex min-h-12 items-center gap-3 border-t border-surface-2 pt-2 first:border-0">
              <span className="flex flex-1 flex-col"><span className="text-sm">{r.label}</span><span className="text-xs text-muted">{[r.gymId ? gymById(r.gymId)?.name : '', r.date ? fmtDayYear(r.date) : ''].filter(Boolean).join(' · ')}</span></span>
              <b className="font-display text-lg">{r.value}</b>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <H2>Your climbing timeline</H2>
          {ach.length === 0 && <p className="m-0 text-sm text-muted">Milestones show up as you send new grades.</p>}
          <ol className="m-0 list-none p-0">
            {ach.slice().reverse().map((a, i, arr) => (
              <li key={a.id} className="flex gap-3">
                <span className="flex w-3.5 flex-col items-center">
                  <span className={cx('mt-1 h-3 w-3 rounded-full', a.type === 'boulder' ? 'bg-boulder' : a.type === 'route' ? 'bg-route' : 'bg-muted')} />
                  {i < arr.length - 1 && <span className="w-0.5 flex-1 bg-line" />}
                </span>
                <span className="flex flex-col gap-0.5 pb-3.5">
                  <span className="font-mono text-[11px] text-muted">{fmtDayYear(a.date).toUpperCase()}</span>
                  <span className="text-sm font-semibold">{a.label}</span>
                  {a.detail && <span className="text-xs text-muted">{a.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <GymInsights />
      </div>
    </div>
  );
}

function GymInsights() {
  const { data, gymById } = useStore();
  const rows = useMemo(() => {
    const ids = Array.from(new Set(data.sessions.map((s) => s.gymId)));
    return ids.map((id) => ({ id, name: gymById(id)?.name ?? id, ...gymStats(id, data.climbs, data.sessions) }));
  }, [data.sessions, data.climbs]); // eslint-disable-line
  if (rows.length === 0) return <Card><H2>Gym insights</H2><p className="m-0 mt-2 text-sm text-muted">Log at a gym to see insights.</p></Card>;
  const adj = (id: string) => data.gymOverrides[id]?.gradeAdjust ?? 0;
  const best = rows.filter((r) => r.totals.topBoulder != null).sort((a, b) => ((b.totals.topBoulder as number) + adj(b.id) + (b.totals.avgBoulder ?? 0) / 10) - ((a.totals.topBoulder as number) + adj(a.id) + (a.totals.avgBoulder ?? 0) / 10))[0];
  const most = rows.slice().sort((a, b) => b.visits - a.visits)[0];
  const flash = rows.filter((r) => r.totals.flashRate != null && r.totals.climbs >= 20).sort((a, b) => (b.totals.flashRate as number) - (a.totals.flashRate as number))[0];
  const topR = rows.filter((r) => r.totals.topRoute != null).sort((a, b) => (b.totals.topRoute as number) - (a.totals.topRoute as number))[0];
  const projGrades = new Map<string, number>();
  data.climbs.filter((c: Climb) => c.outcome === 'project').forEach((c) => projGrades.set(c.grade, (projGrades.get(c.grade) ?? 0) + c.attempts));
  const projTotal = Array.from(projGrades.values()).reduce((s, v) => s + v, 0);
  const topProj = Array.from(projGrades.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const items = [
    best && { q: 'Where you perform best (boulders)', a: best.name, v: gradeLabel('boulder', best.totals.topBoulder) + (adj(best.id) ? ' (adj ' + (adj(best.id) > 0 ? '+' : '') + adj(best.id) + ')' : ''), c: 'text-boulder' },
    most && { q: 'Most visited', a: most.name, v: most.visits + ' visits', c: '' },
    topR && { q: 'Hardest route sent', a: topR.name, v: gradeLabel('route', topR.totals.topRoute), c: 'text-route' },
    flash && { q: 'Highest flash rate', a: flash.name, v: pct(flash.totals.flashRate), c: 'text-route' },
    topProj.length > 0 && { q: 'Grades you spend most tries projecting', a: topProj.map((x) => x[0]).join(' and '), v: Math.round((topProj.reduce((s, x) => s + x[1], 0) / Math.max(1, projTotal)) * 100) + '% of tries', c: '' },
  ].filter(Boolean) as { q: string; a: string; v: string; c: string }[];
  return (
    <Card className="flex flex-col gap-1">
      <H2 right={<a href={href('/compare')} className="text-[13px] text-route">Compare gyms</a>}>Gym insights</H2>
      {items.map((i) => (
        <div key={i.q} className="flex min-h-12 items-center gap-3 border-t border-surface-2 pt-2 first:border-0">
          <span className="flex flex-1 flex-col"><span className="text-xs text-muted">{i.q}</span><b className="text-[15px]">{i.a}</b></span>
          <span className={cx('font-mono text-[13px]', i.c)}>{i.v}</span>
        </div>
      ))}
      <p className="m-0 pt-1.5 text-xs text-muted">From your own logs. Gyms grade differently, so this isn’t a ranking of gyms.</p>
    </Card>
  );
}

function Consistency({ climbs }: { climbs: Climb[] }) {
  const { data } = useStore();
  const p = usePalette();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [picked, setPicked] = useState<string | null>(null);
  const daily = useMemo(() => dailyActivity(climbs), [climbs]);
  const years = Array.from(new Set(data.sessions.map((s) => new Date(s.startedAt).getFullYear()))).sort();
  const minYear = years[0] ?? now.getFullYear();
  const st = streaks(data.sessions);

  const jan1 = new Date(year, 0, 1);
  const gridStart = startOfWeek(jan1);
  const weeks = Array.from({ length: 53 }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const day = addDays(gridStart, w * 7 + d);
    const k = dayKey(day);
    const n = daily.get(k) ?? 0;
    return { k, day, n, inYear: day.getFullYear() === year, lvl: n === 0 ? 0 : n < 8 ? 1 : n < 13 ? 2 : 3 };
  }));
  const yearDays = weeks.flat().filter((d) => d.inYear && d.n > 0).length;

  const weekly = useMemo(() => {
    const m = new Map<string, number>();
    data.sessions.forEach((s) => m.set(weekKey(s.startedAt), (m.get(weekKey(s.startedAt)) ?? 0) + 1));
    return Array.from({ length: 26 }, (_, i) => {
      const ws = addDays(startOfWeek(now), -7 * (25 - i));
      return { label: ws.getDate() + ' ' + monthShort(ws.getMonth()), sessions: m.get(dayKey(ws)) ?? 0 };
    });
  }, [data.sessions]); // eslint-disable-line
  const avgPerWeek = weekly.reduce((s, w) => s + w.sessions, 0) / weekly.length;

  const mStart = startOfWeek(month);
  const mDays = Array.from({ length: 42 }, (_, i) => addDays(mStart, i));
  const sessionsOn = (k: string) => data.sessions.filter((s) => dayKey(s.startedAt) === k);
  const pickedSessions = picked ? sessionsOn(picked) : [];

  return (
    <Card className="flex flex-col gap-4">
      <H2>Consistency</H2>
      <div className="grid grid-cols-3 gap-2">
        <div><b className="font-display text-2xl text-route">{st.current} wk</b><span className="block text-[11px] text-muted">current streak</span></div>
        <div><b className="font-display text-2xl">{st.longest} wk</b><span className="block text-[11px] text-muted">longest streak</span></div>
        <div><b className="font-display text-2xl">{avgPerWeek.toFixed(1)}×</b><span className="block text-[11px] text-muted">sessions / week (26 wk)</span></div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{year} · {yearDays} climbing days</span>
          <span className="flex gap-1">
            <IconButton label="Previous year" disabled={year <= minYear} onClick={() => setYear(year - 1)} className="h-9 w-9"><ChevronLeft size={16} /></IconButton>
            <IconButton label="Next year" disabled={year >= now.getFullYear()} onClick={() => setYear(year + 1)} className="h-9 w-9"><ChevronRight size={16} /></IconButton>
          </span>
        </div>
        <div className="no-scrollbar overflow-x-auto">
          <div className="flex gap-px sm:gap-[3px]" role="grid" aria-label={'Activity calendar ' + year}>
            {weeks.map((w, wi) => (
              <div key={wi} className="flex flex-col gap-px sm:gap-[3px]" role="row">
                {w.map((d) => d.n > 0 && d.inYear ? (
                  <button key={d.k} role="gridcell" aria-label={fmtDayYear(d.day.toISOString()) + ': ' + d.n + ' climbs'} title={fmtDayYear(d.day.toISOString()) + ' · ' + d.n + ' climbs'} onClick={() => setPicked(d.k)} className={cx('size-[5px] rounded-[1px] sm:size-[10px] sm:rounded-sm lg:size-[12px]', picked === d.k && 'ring-2 ring-ink')} style={{ background: p.heat[d.lvl] }} />
                ) : (
                  <span key={d.k} role="gridcell" aria-hidden="true" className="size-[5px] rounded-[1px] sm:size-[10px] sm:rounded-sm lg:size-[12px]" style={{ background: d.inYear ? p.heat[0] : 'transparent' }} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">Less{p.heat.map((c) => <span key={c} className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />)}More climbs</div>
        {picked && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-2.5 text-sm">
            <span className="font-semibold">{fmtDayYear(picked + 'T12:00:00')}</span>
            {pickedSessions.map((s) => <a key={s.id} href={href('/session/' + s.id)} className="text-route">Open session</a>)}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Weekly frequency · last 26 weeks</span>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
                <XAxis dataKey="label" tick={{ stroke: p.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: p.grid }} minTickGap={30} />
                <YAxis allowDecimals={false} tick={{ stroke: p.muted, fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: p.grid, opacity: 0.4 }} content={(tp: any) => <ChartTip {...tp} rows={(d: any) => [{ name: 'Sessions', value: String(d.sessions), color: p.route }]} />} />
                <RBar dataKey="sessions" fill={p.route} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{monthShort(month.getMonth())} {month.getFullYear()}</span>
            <span className="flex gap-1">
              <IconButton label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="h-9 w-9"><ChevronLeft size={16} /></IconButton>
              <IconButton label="Next month" disabled={month >= new Date(now.getFullYear(), now.getMonth(), 1)} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="h-9 w-9"><ChevronRight size={16} /></IconButton>
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="text-[11px] text-muted">{d}</span>)}
            {mDays.map((d) => {
              const k = dayKey(d);
              const ss = sessionsOn(k);
              const inMonth = d.getMonth() === month.getMonth();
              const n = daily.get(k) ?? 0;
              return ss.length && inMonth ? (
                <a key={k} href={href('/session/' + ss[0].id)} aria-label={fmtDayYear(d.toISOString()) + ': ' + n + ' climbs'} className="flex aspect-square items-center justify-center rounded-lg bg-accent font-mono text-xs font-bold text-accent-ink no-underline">{d.getDate()}</a>
              ) : (
                <span key={k} className={cx('flex aspect-square items-center justify-center rounded-lg font-mono text-xs', inMonth ? 'text-muted' : 'text-transparent', dayKey(now) === k && 'border border-ink text-ink')}>{d.getDate()}</span>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Shortcuts to the monthly report and the year in climbing. */
function ReportLinks() {
  const { isPro } = usePro();
  const now = new Date();
  const early = now.getDate() <= 7;
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = early ? last : new Date(now.getFullYear(), now.getMonth(), 1);
  const mKey = month.getFullYear() + '-' + String(month.getMonth() + 1).padStart(2, '0');
  const year = now.getMonth() === 0 && early ? now.getFullYear() - 1 : now.getFullYear();
  return (
    <div className="grid grid-cols-2 gap-2">
      <a href={href('/report?m=' + mKey)} className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 text-ink no-underline hover:border-muted">
        <span className="flex flex-1 flex-col"><b className="flex items-center gap-1.5 text-sm">{monthShort(month.getMonth())} report{!isPro && <ProBadge />}</b><span className="text-xs text-muted">{early ? 'Last month' : 'This month so far'}</span></span>
        <ChevronRight size={18} className="text-muted" aria-hidden="true" />
      </a>
      <a href={href('/report?y=' + year)} className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 text-ink no-underline hover:border-muted">
        <span className="flex flex-1 flex-col"><b className="flex items-center gap-1.5 text-sm">{year} in climbing{!isPro && <ProBadge />}</b><span className="text-xs text-muted">Year in review</span></span>
        <ChevronRight size={18} className="text-muted" aria-hidden="true" />
      </a>
    </div>
  );
}
