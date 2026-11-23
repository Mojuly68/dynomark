import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Bucket } from '../lib/stats';
import { gradeAvgLabel, gradeLabel } from '../lib/grades';
import { usePalette } from '../lib/theme';
import { FONT_MONO } from '../lib/fonts';

export function ChartTip({ active, payload, label, rows }: { active?: boolean; payload?: any[]; label?: string | number; rows: (p: any) => { name: string; value: string; color: string }[] }) {
  if (!active || !payload?.length) return null;
  const items = rows(payload[0].payload).filter((r) => r.value !== '—');
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-mono text-muted">{label}</div>
      {items.length === 0 && <div className="text-muted">No sends</div>}
      {items.map((r) => (
        <div key={r.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden="true" />
          <span className="flex-1">{r.name}</span>
          <b className="font-mono">{r.value}</b>
        </div>
      ))}
    </div>
  );
}

export interface GradeSeries { route: boolean; boulder: boolean; top: boolean; avg: boolean; trend: boolean; }

/** Top and average grade per bucket. Boulders on the left axis, routes on the right. */
export function GradeChart({ data, show, height = 220 }: { data: Bucket[]; show: GradeSeries; height?: number }) {
  const p = usePalette();
  const axis = { stroke: p.muted, fontSize: 11, fontFamily: FONT_MONO };
  const bVals = data.flatMap((d) => [d.topB, d.avgB]).filter((v): v is number => v != null);
  const rVals = data.flatMap((d) => [d.topR, d.avgR]).filter((v): v is number => v != null);
  const dom = (v: number[]) => (v.length ? [Math.max(0, Math.floor(Math.min(...v)) - 1), Math.ceil(Math.max(...v)) + 1] : [0, 5]);
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Grade progression chart. Use the table view in Progress for exact values.">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={p.grid} vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: p.grid }} minTickGap={24} />
          <YAxis yAxisId="b" hide={!show.boulder} domain={dom(bVals)} allowDecimals={false} tick={axis} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => 'V' + v} />
          <YAxis yAxisId="r" orientation="right" hide={!show.route} domain={dom(rVals)} allowDecimals={false} tick={axis} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => gradeLabel('route', v)} />
          <Tooltip
            cursor={{ stroke: p.muted, strokeDasharray: '3 3' }}
            content={(tp: any) => (
              <ChartTip {...tp} rows={(d: Bucket) => [
                ...(show.boulder ? [{ name: 'Top boulder', value: d.topB == null ? '—' : gradeLabel('boulder', d.topB), color: p.boulder }, { name: 'Avg boulder', value: gradeAvgLabel('boulder', d.avgB), color: p.boulder }] : []),
                ...(show.route ? [{ name: 'Top route', value: d.topR == null ? '—' : gradeLabel('route', d.topR), color: p.route }, { name: 'Avg route', value: gradeAvgLabel('route', d.avgR), color: p.route }] : []),
              ]} />
            )}
          />
          {show.boulder && show.top && <Line yAxisId="b" type="monotone" dataKey="topB" name="Top boulder" stroke={p.boulder} strokeWidth={3} dot={{ r: 3, fill: p.surface, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls isAnimationActive={false} />}
          {show.boulder && show.avg && <Line yAxisId="b" type="monotone" dataKey="avgB" name="Avg boulder" stroke={p.boulder} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls isAnimationActive={false} />}
          {show.boulder && show.trend && <Line yAxisId="b" type="linear" dataKey="trendB" name="Boulder trend" stroke={p.boulder} strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="2 4" dot={false} connectNulls isAnimationActive={false} />}
          {show.route && show.top && <Line yAxisId="r" type="monotone" dataKey="topR" name="Top route" stroke={p.route} strokeWidth={3} dot={{ r: 3, fill: p.surface, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls isAnimationActive={false} />}
          {show.route && show.avg && <Line yAxisId="r" type="monotone" dataKey="avgR" name="Avg route" stroke={p.route} strokeOpacity={0.6} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls isAnimationActive={false} />}
          {show.route && show.trend && <Line yAxisId="r" type="linear" dataKey="trendR" name="Route trend" stroke={p.route} strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="2 4" dot={false} connectNulls isAnimationActive={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
