import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Flag, MapPin, Share2, Sparkles, Trophy } from 'lucide-react';
import { Bar as RBar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/Store';
import { useToast } from '../components/Toast';
import { ChartTip } from '../components/charts';
import { Bar, Button, Card, DemoBadge, Empty, H2, IconButton, Segmented, Stat, cx } from '../components/ui';
import { ANGLE_LABEL, outcomeLabel } from '../lib/grades';
import { fmtDay, monthShort } from '../lib/dates';
import { href, navigate } from '../lib/router';
import { usePalette } from '../lib/theme';
import { buildReport, monthPeriod, periodFromQuery, periodQuery, shiftPeriod, yearPeriod, type Period } from '../lib/report';
import { shareCardImage, type CardSpec } from '../lib/shareCard';
import { FONT_MONO } from '../lib/fonts';
import { ProGate, usePro } from '../lib/pro';

function Delta({ now, before, unit = '', pts }: { now: number | null; before: number | null; unit?: string; pts?: boolean }) {
  if (now == null || before == null) return null;
  const d = Math.round((now - before) * (pts ? 100 : 1));
  if (d === 0) return <span className="text-muted">same as before</span>;
  return <span className={d > 0 ? 'text-route' : 'text-muted'}>{d > 0 ? '+' : '−'}{Math.abs(d)}{pts ? ' pts' : unit}</span>;
}

export function Report({ m, y }: { m: string | null; y: string | null }) {
  const { data, gymById } = useStore();
  const { isPro } = usePro();
  const toast = useToast();
  const p = usePalette();
  const now = new Date();
  const period = periodFromQuery(m, y, now);
  const r = useMemo(() => buildReport(data, periodFromQuery(m, y)), [data, m, y]);
  const [sharing, setSharing] = useState(false);
  const go = (q: Period) => navigate('/report?' + periodQuery(q));
  const isCurrent = period.start <= now && now < period.end;
  const atEnd = period.end > now;
  const prevLabel = period.kind === 'month' ? r.prev.short : r.prev.label;
  const t = r.totals;

  const share = async () => {
    const top = (type: 'boulder' | 'route') => r.hardest.find((h) => h.type === type)?.climb.grade ?? '—';
    const spec: CardSpec = period.kind === 'year'
      ? { kicker: period.label + ' IN CLIMBING', label: 'Year in climbing', big: String(t.sends), sub: 'sends in ' + r.sessions + ' sessions, ' + r.days + ' days on the wall.', stats: [{ v: top('boulder'), l: 'Boulder' }, { v: top('route'), l: 'Route' }, { v: String(r.gyms.length), l: 'Gyms' }], accent: '#C6F432', spark: r.perMonth.map((x) => x.sends), demo: r.isDemo }
      : { kicker: period.label.toUpperCase(), label: period.short + (isCurrent ? ' so far' : ' report'), big: String(t.sends), sub: 'sends in ' + r.sessions + ' sessions.', stats: [{ v: top('boulder'), l: 'Boulder' }, { v: top('route'), l: 'Route' }, { v: t.flashRate == null ? '—' : Math.round(t.flashRate * 100) + '%', l: 'Flash' }], accent: '#C6F432', demo: r.isDemo };
    setSharing(true);
    try {
      const res = await shareCardImage(spec, 'dynomark-' + period.key + '.png');
      if (res === 'saved') toast('Saved dynomark-' + period.key + '.png');
    } finally { setSharing(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconButton label="Back to Progress" onClick={() => navigate('/progress')}><ArrowLeft size={20} aria-hidden="true" /></IconButton>
          <span className="flex-1 text-xs uppercase tracking-[0.08em] text-muted">{period.kind === 'year' ? 'Year in climbing' : isCurrent ? 'Monthly report · so far' : 'Monthly report'}</span>
          <Segmented size="sm" label="Report type" value={period.kind} onChange={(k) => go(k === 'year' ? yearPeriod(period.start.getFullYear()) : monthPeriod(period.start.getFullYear(), period.kind === 'year' ? (period.start.getFullYear() === now.getFullYear() ? now.getMonth() : 11) : period.start.getMonth()))} options={[{ value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }]} />
        </div>
        <div className="flex items-center gap-2">
          <IconButton label={'Previous ' + period.kind} onClick={() => go(shiftPeriod(period, -1))}><ChevronLeft size={20} aria-hidden="true" /></IconButton>
          <h1 className="m-0 flex-1 text-center font-display text-[30px] font-black tracking-tight sm:text-[38px]">{period.label}</h1>
          <IconButton label={'Next ' + period.kind} disabled={atEnd} onClick={() => go(shiftPeriod(period, 1))}><ChevronRight size={20} aria-hidden="true" /></IconButton>
        </div>
        {r.isDemo && <p className="m-0 flex items-center justify-center gap-2 text-xs text-muted"><DemoBadge />Sample data, not real activity</p>}
      </header>

      {!isPro ? (
        <ProGate title={period.kind === 'year' ? 'Your Year in climbing is part of Pro' : 'Monthly reports are part of Pro'} body="See every month and year summed up: sends, hardest grades with your best-yet marks, milestones, projects, gyms, your busiest week and a share card.">
          {r.sessions > 0 && <p className="m-0 font-display text-[40px] font-black leading-none tracking-tight">{t.sends} <span className="text-route">sends</span> <span className="text-base font-semibold text-muted">in {r.sessions} sessions</span></p>}
        </ProGate>
      ) : r.sessions === 0 ? (
        <Empty title={'No climbing in ' + period.label} body={period.start > now ? 'This period hasn’t started yet.' : 'Log a session and it shows up here.'} action={<Button onClick={() => go(period.kind === 'year' ? yearPeriod(now.getFullYear()) : monthPeriod(now.getFullYear(), now.getMonth()))}>Go to {period.kind === 'year' ? 'this year' : 'this month'}</Button>} />
      ) : (
        <>
          <section className="anim-rise flex flex-col gap-1">
            <p className="m-0 font-display text-[64px] font-black leading-[0.9] tracking-[-0.03em] sm:text-[80px]">{t.sends} <span className="text-route">sends.</span></p>
            <p className="m-0 text-[15px] text-muted">{r.sessions} session{r.sessions === 1 ? '' : 's'} · {r.days} day{r.days === 1 ? '' : 's'} on the wall · {Math.round(r.hours)} h{r.prevSessions ? <> · <Delta now={t.sends} before={r.prevTotals.sends} unit=" sends" /> vs {r.partial ? 'same point in ' + prevLabel : prevLabel}</> : null}</p>
          </section>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Climbs" value={t.climbs} sub={t.warmups ? t.warmups + ' warm-ups' : undefined} />
            <Stat label="Flash rate" value={t.flashRate == null ? '—' : Math.round(t.flashRate * 100) + '%'} sub={<Delta now={t.flashRate} before={r.prevTotals.flashRate} pts />} />
            <Stat label="Attempts / send" value={t.attemptsPerSend == null ? '—' : t.attemptsPerSend.toFixed(1)} sub="Warm-ups left out" />
            <Stat label="Workouts" value={r.workouts} sub={r.sets ? r.sets + ' sets' : 'Training log'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="flex flex-col gap-3">
              <H2>Hardest sends</H2>
              {r.hardest.length === 0 && <p className="m-0 text-sm text-muted">No sends logged in this {period.kind}.</p>}
              {r.hardest.map((h) => (
                <div key={h.type} className="flex items-center gap-3 border-t border-surface-2 pt-3 first:border-0 first:pt-0">
                  <span className={cx('flex h-14 min-w-16 items-center justify-center rounded-2xl px-2 font-display text-2xl font-black text-accent-ink', h.type === 'boulder' ? 'bg-orange' : 'bg-accent')}>{h.climb.grade}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-[15px]">{h.climb.name ?? (h.type === 'boulder' ? 'Boulder' : 'Route')} · {outcomeLabel(h.climb.outcome)}</b>
                    <span className="truncate text-xs text-muted">{gymById(h.climb.gymId)?.name} · {fmtDay(h.climb.at)}</span>
                  </span>
                  {h.isBest && <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-route"><Trophy size={13} aria-hidden="true" />Best yet</span>}
                </div>
              ))}
            </Card>

            <Card className="flex flex-col gap-3">
              <H2>{period.kind === 'year' ? 'Sends by month' : 'Highlights'}</H2>
              {period.kind === 'year' ? (
                <>
                  <div className="h-[170px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={r.perMonth} margin={{ top: 6, right: 0, bottom: 0, left: -26 }}>
                        <XAxis dataKey="label" tick={{ stroke: p.muted, fontSize: 10, fontFamily: FONT_MONO }} tickLine={false} axisLine={{ stroke: p.grid }} interval={0} tickFormatter={(v: string) => v.slice(0, 1)} />
                        <YAxis tick={{ stroke: p.muted, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip cursor={{ fill: p.grid }} content={(tp: any) => <ChartTip {...tp} rows={(d: any) => [{ name: 'Sends', value: String(d.sends), color: p.route }, { name: 'Sessions', value: String(d.sessions), color: p.muted }]} />} />
                        <RBar dataKey="sends" fill={p.route} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {r.bestGroup && <p className="m-0 text-sm">Best month: <b>{monthShort(Number(r.bestGroup[0]))}</b>, {r.bestGroup[1].sends} sends in {r.bestGroup[1].sessions} sessions.</p>}
                </>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
                  {r.bestGroup && <li>Busiest week: <b>from {fmtDay(r.bestGroup[0] + 'T12:00:00')}</b>, {r.bestGroup[1].sends} sends in {r.bestGroup[1].sessions} session{r.bestGroup[1].sessions === 1 ? '' : 's'}.</li>}
                  {r.bestSession && r.bestSession.sends > 0 && <li>Best session: <a href={href('/session/' + r.bestSession.s.id)} className="font-bold text-route">{fmtDay(r.bestSession.s.startedAt)}</a>, {r.bestSession.sends} sends at {gymById(r.bestSession.s.gymId)?.name}.</li>}
                  {t.warmups > 0 && <li>{t.warmups} warm-up climb{t.warmups === 1 ? '' : 's'} logged, kept out of your averages.</li>}
                </ul>
              )}
            </Card>

            {(r.milestones.length > 0 || r.projectsSent.length > 0 || r.projectsStarted.length > 0) && (
              <Card className="flex flex-col gap-3">
                <H2>Milestones and projects</H2>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {r.milestones.map((a) => <li key={a.id} className="flex items-center gap-2.5 text-sm"><Sparkles size={16} className="shrink-0 text-route" aria-hidden="true" /><span className="flex-1"><b>{a.label}</b>{a.detail ? ' · ' + a.detail : ''}</span><span className="font-mono text-xs text-muted">{fmtDay(a.date)}</span></li>)}
                  {r.projectsSent.map((x) => <li key={x.id} className="flex items-center gap-2.5 text-sm"><Flag size={16} className="shrink-0 text-boulder" aria-hidden="true" /><span className="flex-1">Sent project <b>{x.name}</b> · {x.grade}</span><span className="font-mono text-xs text-muted">{x.sentAt ? fmtDay(x.sentAt) : ''}</span></li>)}
                  {r.projectsStarted.length > 0 && <li className="text-xs text-muted">{r.projectsStarted.length} project{r.projectsStarted.length === 1 ? '' : 's'} started this {period.kind}.</li>}
                </ul>
              </Card>
            )}

            <Card className="flex flex-col gap-3">
              <H2>Where you climbed</H2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {r.gyms.slice(0, 6).map((g) => (
                  <li key={g.gymId} className="flex items-center gap-2.5 text-sm">
                    <MapPin size={16} className="shrink-0 text-muted" aria-hidden="true" />
                    <a href={href('/gyms/' + g.gymId)} className="flex-1 truncate text-ink no-underline">{gymById(g.gymId)?.name ?? 'Gym'}</a>
                    {g.isNew && <span className="rounded-full bg-blue/15 px-2 py-0.5 text-xs font-bold text-blue">New</span>}
                    <span className="font-mono text-xs text-muted">{g.visits} visit{g.visits === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="flex flex-col gap-3">
              <H2>Wall angles</H2>
              {r.angles.map((a) => (
                <div key={a.angle} className="flex items-center gap-3">
                  <span className="w-20 text-sm">{ANGLE_LABEL[a.angle]}</span>
                  <Bar value={a.share * 100} tone="blue" className="h-2.5 flex-1" />
                  <span className="w-10 text-right font-mono text-xs text-muted">{Math.round(a.share * 100)}%</span>
                </div>
              ))}
              <p className="m-0 text-xs text-muted">{r.quietAngle ? 'Only ' + Math.round(r.quietAngle.share * 100) + '% ' + ANGLE_LABEL[r.quietAngle.angle].toLowerCase() + ' this ' + period.kind + '. Worth a session if you want a more rounded game.' : 'Share of your climbs by wall angle, warm-ups left out.'}</p>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={share} disabled={sharing}><Share2 size={18} aria-hidden="true" />{sharing ? 'Making image…' : 'Share ' + (period.kind === 'year' ? 'year card' : 'month card')}</Button>
            {period.kind === 'month' && <Button variant="ghost" onClick={() => go(yearPeriod(period.start.getFullYear()))}>See {period.start.getFullYear()} in climbing</Button>}
          </div>
          <p className="m-0 text-xs text-muted">Hardest sends, flash rate and attempts per send leave out warm-ups. Compared with {r.partial ? 'the same stretch of ' + r.prev.label : r.prev.label} where shown.</p>
        </>
      )}
    </div>
  );
}
