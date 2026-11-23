import { useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowLeft } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/Store';
import { ChartTip } from '../components/charts';
import { Card, Empty, H2, IconButton, Segmented, Toggle, cx, inputCls } from '../components/ui';
import { buckets, gymStats, pct, type Range } from '../lib/stats';
import { FONT_MONO } from '../lib/fonts';
import { gradeAvgLabel, gradeLabel } from '../lib/grades';
import { fmtDayYear } from '../lib/dates';
import { usePalette } from '../lib/theme';
import { navigate } from '../lib/router';
import type { ClimbType } from '../types';
import { ProGate, usePro } from '../lib/pro';

type Metric = 'grade' | 'volume' | 'flash' | 'aps';

export function Compare({ a: qa, b: qb }: { a: string | null; b: string | null }) {
  const { data, gymById, override } = useStore();
  const { isPro } = usePro();
  const p = usePalette();
  const visited = useMemo(() => {
    const m = new Map<string, number>();
    data.sessions.forEach((s) => m.set(s.gymId, (m.get(s.gymId) ?? 0) + 1));
    return Array.from(m.entries()).sort((x, y) => y[1] - x[1]).map((x) => x[0]);
  }, [data.sessions]);
  const [a, setA] = useState<string>(qa && visited.includes(qa) ? qa : visited[0] ?? '');
  const [b, setB] = useState<string>(qb && visited.includes(qb) ? qb : visited.find((x) => x !== (qa ?? visited[0])) ?? '');
  const [useAdj, setUseAdj] = useState(true);
  const [metric, setMetric] = useState<Metric>('grade');
  const [disc, setDisc] = useState<ClimbType>('boulder');
  const [range, setRange] = useState<Range>('1y');

  const A = useMemo(() => (a ? gymStats(a, data.climbs, data.sessions) : null), [a, data.climbs, data.sessions]);
  const B = useMemo(() => (b ? gymStats(b, data.climbs, data.sessions) : null), [b, data.climbs, data.sessions]);
  const adjA = useAdj ? override(a).gradeAdjust ?? 0 : 0;
  const adjB = useAdj ? override(b).gradeAdjust ?? 0 : 0;

  const series = useMemo(() => {
    if (!a || !b) return [];
    const ba = buckets(data.climbs.filter((c) => c.gymId === a), data.sessions.filter((s) => s.gymId === a), range);
    const bb = buckets(data.climbs.filter((c) => c.gymId === b), data.sessions.filter((s) => s.gymId === b), range);
    const pickV = (x: (typeof ba)[number] | undefined, adj: number) => {
      if (!x) return null;
      if (metric === 'grade') { const v = disc === 'boulder' ? x.topB : x.topR; return v == null ? null : v + (disc === 'boulder' ? adj : 0); }
      if (metric === 'volume') return x.climbs || null;
      if (metric === 'flash') return x.flashRate;
      return x.aps;
    };
    return ba.map((x, i) => ({ label: x.label, a: pickV(x, adjA), b: pickV(bb[i], adjB) }));
  }, [a, b, data.climbs, data.sessions, range, metric, disc, adjA, adjB]);

  if (visited.length < 2) return <Empty title="Climb at two gyms to compare" body="Comparisons use only your own logs, so you need sessions at two or more gyms." />;
  const nameA = gymById(a)?.name ?? '', nameB = gymById(b)?.name ?? '';
  const ta = A?.totals, tb = B?.totals;
  type Row = { l: string; a: string; b: string; av: number | null; bv: number | null; hi: boolean };
  const rows: Row[] = ta && tb && A && B ? [
    { l: 'Visits', a: String(A.visits), b: String(B.visits), av: A.visits, bv: B.visits, hi: true },
    { l: 'Total climbs', a: String(ta.climbs), b: String(tb.climbs), av: ta.climbs, bv: tb.climbs, hi: true },
    { l: 'Total sends', a: String(ta.sends), b: String(tb.sends), av: ta.sends, bv: tb.sends, hi: true },
    { l: 'Hardest boulder', a: ta.topBoulder == null ? '—' : gradeLabel('boulder', ta.topBoulder + adjA) + (adjA ? ' adj' : ''), b: tb.topBoulder == null ? '—' : gradeLabel('boulder', tb.topBoulder + adjB) + (adjB ? ' adj' : ''), av: ta.topBoulder == null ? null : ta.topBoulder + adjA, bv: tb.topBoulder == null ? null : tb.topBoulder + adjB, hi: true },
    { l: 'Hardest route', a: gradeLabel('route', ta.topRoute), b: gradeLabel('route', tb.topRoute), av: ta.topRoute, bv: tb.topRoute, hi: true },
    { l: 'Average boulder sent', a: ta.avgBoulder == null ? '—' : gradeAvgLabel('boulder', ta.avgBoulder + adjA), b: tb.avgBoulder == null ? '—' : gradeAvgLabel('boulder', tb.avgBoulder + adjB), av: ta.avgBoulder == null ? null : ta.avgBoulder + adjA, bv: tb.avgBoulder == null ? null : tb.avgBoulder + adjB, hi: true },
    { l: 'Average route sent', a: gradeAvgLabel('route', ta.avgRoute), b: gradeAvgLabel('route', tb.avgRoute), av: ta.avgRoute, bv: tb.avgRoute, hi: true },
    { l: 'Flash rate', a: pct(ta.flashRate), b: pct(tb.flashRate), av: ta.flashRate, bv: tb.flashRate, hi: true },
    { l: 'Attempts per send', a: ta.attemptsPerSend?.toFixed(1) ?? '—', b: tb.attemptsPerSend?.toFixed(1) ?? '—', av: ta.attemptsPerSend, bv: tb.attemptsPerSend, hi: false },
    { l: 'Most climbed grade', a: A.topGrades[0]?.grade ?? '—', b: B.topGrades[0]?.grade ?? '—', av: null, bv: null, hi: true },
    { l: 'Best session', a: A.best ? A.best.sends + ' sends' : '—', b: B.best ? B.best.sends + ' sends' : '—', av: A.best?.sends ?? null, bv: B.best?.sends ?? null, hi: true },
  ] : [];
  const opt = (exclude: string) => visited.filter((x) => x !== exclude);
  const fmtV = (v: number | null) => v == null ? '—' : metric === 'grade' ? gradeLabel(disc, v) : metric === 'flash' ? v + '%' : metric === 'aps' ? v.toFixed(1) : String(v);
  const axis = { stroke: p.muted, fontSize: 11, fontFamily: FONT_MONO };

  const header = (
    <header className="flex items-center gap-3">
      <IconButton label="Back to gyms" onClick={() => navigate('/gyms')}><ArrowLeft size={20} aria-hidden="true" /></IconButton>
      <h1 className="m-0 font-display text-[28px] font-extrabold tracking-tight">Gym vs gym</h1>
    </header>
  );
  if (!isPro) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <ProGate title="Compare your gyms with Pro" body="Put any two gyms side by side: your hardest sends, flash rate, attempts per send and grade spread at each, from your own logs only. Add soft or hard grade adjustments to line them up fairly." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {header}

      <div className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] items-end gap-2">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-route">Gym A
          <select className={cx(inputCls, 'border-2 border-route font-semibold')} value={a} onChange={(e) => setA(e.target.value)}>
            {opt(b).map((id) => <option key={id} value={id}>{gymById(id)?.name}</option>)}
          </select>
        </label>
        <IconButton label="Swap gyms" onClick={() => { setA(b); setB(a); }} className="h-12 border border-line"><ArrowLeftRight size={18} aria-hidden="true" /></IconButton>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-blue">Gym B
          <select className={cx(inputCls, 'border-2 border-blue font-semibold')} value={b} onChange={(e) => setB(e.target.value)}>
            {opt(a).map((id) => <option key={id} value={id}>{gymById(id)?.name}</option>)}
          </select>
        </label>
      </div>

      <p className="m-0 rounded-xl bg-orange/10 p-3 text-xs leading-relaxed text-boulder">Each gym sets its own grades, so a V5 at one isn’t the same climb as a V5 at another. These numbers compare only your own logs.</p>

      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <span className="flex flex-1 flex-col"><span className="text-sm font-semibold">Apply my grade adjustments</span><span className="text-xs text-muted">{nameA}: {(override(a).gradeAdjust ?? 0) >= 0 ? '+' : ''}{override(a).gradeAdjust ?? 0} · {nameB}: {(override(b).gradeAdjust ?? 0) >= 0 ? '+' : ''}{override(b).gradeAdjust ?? 0} V-grades. Change them on each gym’s page.</span></span>
        <Toggle checked={useAdj} onChange={setUseAdj} label="Apply my grade adjustments" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <div className="grid grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] pb-2 text-xs font-bold">
            <span className="truncate text-route">{nameA}</span><span /><span className="truncate text-right text-blue">{nameB}</span>
          </div>
          {rows.map((r) => {
            const both = r.av != null && r.bv != null && r.av !== r.bv;
            const aWin = both && (r.hi ? (r.av as number) > (r.bv as number) : (r.av as number) < (r.bv as number));
            const bWin = both && !aWin;
            return (
              <div key={r.l} className="grid min-h-12 grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] items-center border-t border-surface-2">
                <b className={cx('font-display text-lg', aWin ? 'text-route' : 'text-ink')}>{r.a}</b>
                <span className="text-center text-[11px] leading-tight text-muted">{r.l}{!r.hi && <span className="block">lower is better</span>}</span>
                <b className={cx('text-right font-display text-lg', bWin ? 'text-blue' : 'text-ink')}>{r.b}</b>
              </div>
            );
          })}
          <p className="m-0 pt-2 text-[11px] text-muted">Lower attempts per send = fewer tries to send. {A?.lastVisit && 'Last at ' + nameA + ': ' + fmtDayYear(A.lastVisit) + '.'}</p>
        </Card>

        <Card className="flex flex-col gap-3">
          <div role="tablist" aria-label="Compare over time" className="grid grid-cols-4 rounded-xl bg-surface-2 p-[3px]">
            {([['grade', 'Grades'], ['volume', 'Volume'], ['flash', 'Flash'], ['aps', 'Attempts']] as [Metric, string][]).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={metric === k} onClick={() => setMetric(k)} className={cx('h-9 rounded-[9px] text-[13px] font-semibold', metric === k ? 'bg-ink text-bg' : 'text-muted')}>{l}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {metric === 'grade' && <Segmented size="sm" label="Discipline" value={disc} onChange={setDisc} options={[{ value: 'boulder', label: 'Boulders' }, { value: 'route', label: 'Routes' }]} />}
            <Segmented size="sm" label="Time range" value={range} onChange={setRange} options={[{ value: '6m', label: '6M' }, { value: '1y', label: '1Y' }, { value: 'all', label: 'All' }]} />
          </div>
          <span className="text-xs text-muted">{metric === 'grade' ? 'Top ' + (disc === 'boulder' ? 'boulder' : 'route') + ' send per period' + (disc === 'boulder' && useAdj && (adjA || adjB) ? ', adjusted' : '') : metric === 'volume' ? 'Climbs logged per period' : metric === 'flash' ? 'Flash rate per period' : 'Average attempts per send'}</span>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
                <CartesianGrid stroke={p.grid} vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: p.grid }} minTickGap={20} />
                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={metric === 'aps'} width={metric === 'grade' && disc === 'route' ? 52 : 40} tickFormatter={(v) => fmtV(v)} domain={metric === 'flash' ? [0, 100] : ['auto', 'auto']} />
                <Tooltip content={(tp: any) => <ChartTip {...tp} rows={(d: any) => [{ name: nameA, value: fmtV(d.a), color: p.route }, { name: nameB, value: fmtV(d.b), color: p.blue }]} />} />
                <Line dataKey="a" stroke={p.route} strokeWidth={3} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                <Line dataKey="b" stroke={p.blue} strokeWidth={3} strokeDasharray="6 5" dot={{ r: 2 }} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded bg-route" />{nameA}</span><span className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed border-blue" />{nameB}</span></div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[{ id: a, s: A, c: 'text-route' }, { id: b, s: B, c: 'text-blue' }].map((x) => x.s && (
          <Card key={x.id} className="flex flex-col gap-1">
            <H2>Records at {gymById(x.id)?.name}</H2>
            {[
              ['Hardest boulder', gradeLabel('boulder', x.s.totals.topBoulder)],
              ['Hardest route', gradeLabel('route', x.s.totals.topRoute)],
              ['Most sends in a session', x.s.best ? String(x.s.best.sends) : '—'],
              ['Most climbed grade', x.s.topGrades[0]?.grade ?? '—'],
            ].map(([l, v]) => <div key={l} className="flex min-h-10 items-center justify-between border-t border-surface-2 first:border-0"><span className="text-sm">{l}</span><b className={cx('font-display', x.c)}>{v}</b></div>)}
          </Card>
        ))}
      </div>
    </div>
  );
}
