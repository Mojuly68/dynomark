import type { Achievement, Climb, ClimbType, PersonalRecord, Project, Session, TrainingSession, ID } from '../types';
import { gradeLabel, isNewSend, isSend } from './grades';
import { addDays, dayKey, fmtDay, monthKey, monthShort, startOfDay, startOfMonth, startOfWeek, weekKey } from './dates';

export type Range = '7d' | '30d' | '3m' | '6m' | '1y' | 'all';
export const RANGES: { id: Range; label: string }[] = [
  { id: '7d', label: '7D' }, { id: '30d', label: '30D' }, { id: '3m', label: '3M' },
  { id: '6m', label: '6M' }, { id: '1y', label: '1Y' }, { id: 'all', label: 'All' },
];
const RANGE_DAYS: Record<Range, number | null> = { '7d': 7, '30d': 30, '3m': 91, '6m': 182, '1y': 365, all: null };

export function rangeStart(r: Range, now = new Date()): Date | null {
  const n = RANGE_DAYS[r];
  return n == null ? null : startOfDay(addDays(now, -n + 1));
}
export function filterRange<T extends { at?: string; startedAt?: string }>(items: T[], r: Range, now = new Date()): T[] {
  const s = rangeStart(r, now);
  if (!s) return items;
  const t = s.getTime();
  return items.filter((x) => new Date((x.at ?? x.startedAt) as string).getTime() >= t);
}

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const maxOrNull = (a: number[]) => (a.length ? Math.max(...a) : null);
const ratio = (a: number, b: number) => (b ? a / b : null);

export interface Totals {
  sessions: number;
  climbs: number;
  routesTried: number;
  routesSent: number;
  bouldersTried: number;
  bouldersSent: number;
  topRoute: number | null;
  topBoulder: number | null;
  avgRoute: number | null;
  avgBoulder: number | null;
  flashRate: number | null;
  onsightRate: number | null;
  redpointRate: number | null;
  attemptsPerSend: number | null;
  attempts: number;
  sends: number;
  flashes: number;
  warmups: number;
}

/** Volume counts include warm-ups; grade averages, send rates and attempts per send leave them out. */
export function totals(climbs: Climb[], sessionCount: number): Totals {
  const routes = climbs.filter((c) => c.type === 'route');
  const boulders = climbs.filter((c) => c.type === 'boulder');
  const work = climbs.filter((c) => !c.warmup);
  const sentIdx = (list: Climb[]) => list.filter((c) => isSend(c.outcome) && c.gradeIdx != null).map((c) => c.gradeIdx as number);
  const newSends = work.filter((c) => isNewSend(c.outcome));
  const newRouteSends = newSends.filter((c) => c.type === 'route');
  const flashes = work.filter((c) => c.outcome === 'flash').length;
  return {
    sessions: sessionCount,
    climbs: climbs.length,
    routesTried: routes.length,
    routesSent: routes.filter((c) => isSend(c.outcome)).length,
    bouldersTried: boulders.length,
    bouldersSent: boulders.filter((c) => isSend(c.outcome)).length,
    topRoute: maxOrNull(sentIdx(routes)),
    topBoulder: maxOrNull(sentIdx(boulders)),
    avgRoute: mean(sentIdx(work.filter((c) => c.type === 'route'))),
    avgBoulder: mean(sentIdx(work.filter((c) => c.type === 'boulder'))),
    flashRate: ratio(flashes, newSends.length),
    onsightRate: ratio(newRouteSends.filter((c) => c.outcome === 'onsight').length, newRouteSends.length),
    redpointRate: ratio(newRouteSends.filter((c) => c.outcome === 'redpoint').length, newRouteSends.length),
    attemptsPerSend: mean(newSends.map((c) => c.attempts)),
    attempts: climbs.reduce((s, c) => s + c.attempts, 0),
    sends: climbs.filter((c) => isSend(c.outcome)).length,
    flashes,
    warmups: climbs.length - work.length,
  };
}

/** Weekly streaks: consecutive Monday-weeks with at least one session. */
export function streaks(sessions: Session[], now = new Date()) {
  const weeks = new Set(sessions.map((s) => weekKey(s.startedAt)));
  let cur = 0;
  let w = startOfWeek(now);
  if (!weeks.has(dayKey(w))) w = addDays(w, -7);
  while (weeks.has(dayKey(w))) { cur++; w = addDays(w, -7); }
  const sorted = Array.from(weeks).sort();
  let longest = 0, run = 0, prev: Date | null = null;
  for (const k of sorted) {
    const d = new Date(k + 'T00:00:00');
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 7 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const weeksActive = sorted.length;
  return { current: cur, longest, weeksActive };
}

export interface Bucket {
  key: string;
  label: string;
  topR: number | null;
  avgR: number | null;
  topB: number | null;
  avgB: number | null;
  sends: number;
  failed: number;
  attempts: number;
  climbs: number;
  sessions: number;
  flashRate: number | null;
  onsightRate: number | null;
  redpointRate: number | null;
  aps: number | null;
  trendR?: number | null;
  trendB?: number | null;
}

export function granularity(r: Range): 'session' | 'week' | 'month' {
  return r === '7d' || r === '30d' ? 'session' : r === '3m' || r === '6m' ? 'week' : 'month';
}

function bucketOf(list: Climb[], key: string, label: string, sessions: number): Bucket {
  const t = totals(list, sessions);
  return {
    key, label,
    topR: t.topRoute, avgR: t.avgRoute, topB: t.topBoulder, avgB: t.avgBoulder,
    sends: t.sends, attempts: t.attempts, failed: Math.max(0, t.attempts - t.sends), climbs: t.climbs, sessions,
    flashRate: t.flashRate == null ? null : Math.round(t.flashRate * 100),
    onsightRate: t.onsightRate == null ? null : Math.round(t.onsightRate * 100),
    redpointRate: t.redpointRate == null ? null : Math.round(t.redpointRate * 100),
    aps: t.attemptsPerSend == null ? null : Math.round(t.attemptsPerSend * 10) / 10,
  };
}

export function buckets(climbs: Climb[], sessions: Session[], r: Range, now = new Date()): Bucket[] {
  const g = granularity(r);
  const cs = filterRange(climbs, r, now);
  const ss = filterRange(sessions, r, now);
  let out: Bucket[] = [];
  if (g === 'session') {
    const sorted = ss.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    out = sorted.map((s) => bucketOf(cs.filter((c) => c.sessionId === s.id), s.id, fmtDay(s.startedAt), 1)).filter((b) => b.climbs > 0);
  } else {
    const firstDate = r === 'all'
      ? new Date(Math.min(now.getTime(), ...ss.map((s) => new Date(s.startedAt).getTime())))
      : (rangeStart(r, now) as Date);
    let cursor = g === 'week' ? startOfWeek(firstDate) : startOfMonth(firstDate);
    const keyFn = g === 'week' ? weekKey : monthKey;
    const byKey = new Map<string, Climb[]>();
    cs.forEach((c) => { const k = keyFn(c.at); byKey.set(k, [...(byKey.get(k) ?? []), c]); });
    const sessByKey = new Map<string, number>();
    ss.forEach((s) => { const k = keyFn(s.startedAt); sessByKey.set(k, (sessByKey.get(k) ?? 0) + 1); });
    while (cursor <= now) {
      const k = keyFn(cursor);
      const label = g === 'week' ? fmtDay(cursor.toISOString()) : monthShort(cursor.getMonth()) + (cursor.getMonth() === 0 || r === 'all' ? " '" + String(cursor.getFullYear()).slice(2) : '');
      out.push(bucketOf(byKey.get(k) ?? [], k, label, sessByKey.get(k) ?? 0));
      cursor = g === 'week' ? addDays(cursor, 7) : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  addTrend(out, 'topR', 'trendR');
  addTrend(out, 'topB', 'trendB');
  return out;
}

/** Least-squares line through the non-empty points of a series. */
export function linearFit(values: (number | null)[]) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return null;
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p[0], 0), sy = pts.reduce((s, p) => s + p[1], 0);
  const sxy = pts.reduce((s, p) => s + p[0] * p[1], 0), sxx = pts.reduce((s, p) => s + p[0] * p[0], 0);
  const den = n * sxx - sx * sx;
  if (!den) return null;
  const slope = (n * sxy - sx * sy) / den;
  const icpt = (sy - slope * sx) / n;
  return { slope, icpt, first: pts[0][0], last: pts[n - 1][0] };
}

function addTrend(out: Bucket[], src: 'topR' | 'topB', dst: 'trendR' | 'trendB') {
  const fit = linearFit(out.map((b) => b[src]));
  out.forEach((b, i) => { b[dst] = fit && i >= fit.first && i <= fit.last ? Math.round((fit.icpt + fit.slope * i) * 100) / 100 : null; });
}

export function trendChange(values: (number | null)[]) {
  const fit = linearFit(values);
  if (!fit) return null;
  return fit.slope * (fit.last - fit.first);
}

// Gym-level stats, always from the climber's own logs.
export function gymStats(gymId: ID, climbs: Climb[], sessions: Session[]) {
  const cs = climbs.filter((c) => c.gymId === gymId);
  const ss = sessions.filter((s) => s.gymId === gymId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const t = totals(cs, ss.length);
  const counts = new Map<string, number>();
  cs.forEach((c) => counts.set(c.grade, (counts.get(c.grade) ?? 0) + 1));
  const topGrades = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([grade, n]) => ({ grade, n }));
  const perSession = ss.map((s) => {
    const list = cs.filter((c) => c.sessionId === s.id);
    return { session: s, climbs: list.length, sends: list.filter((c) => isSend(c.outcome)).length, topB: maxOrNull(list.filter((c) => c.type === 'boulder' && isSend(c.outcome) && c.gradeIdx != null).map((c) => c.gradeIdx as number)), topR: maxOrNull(list.filter((c) => c.type === 'route' && isSend(c.outcome) && c.gradeIdx != null).map((c) => c.gradeIdx as number)) };
  });
  const best = perSession.slice().sort((a, b) => b.sends - a.sends)[0];
  return { totals: t, visits: ss.length, topGrades, best, recent: perSession.slice(0, 5), lastVisit: ss[0]?.startedAt ?? null };
}

export interface SessionInfo {
  session: Session;
  climbs: Climb[];
  sends: number;
  topB: number | null;
  topR: number | null;
  flashes: number;
  attempts: number;
}

export function sessionInfo(s: Session, climbs: Climb[]): SessionInfo {
  const list = climbs.filter((c) => c.sessionId === s.id);
  const t = totals(list, 1);
  return { session: s, climbs: list, sends: t.sends, topB: t.topBoulder, topR: t.topRoute, flashes: list.filter((c) => !c.warmup && (c.outcome === 'flash' || c.outcome === 'onsight')).length, attempts: t.attempts };
}

/** Milestones in order: first send of each V-grade from V3, first of each route number grade from 5.10. */
export function achievements(climbs: Climb[], sessions: Session[]): Achievement[] {
  const out: Achievement[] = [];
  const sorted = climbs.slice().sort((a, b) => a.at.localeCompare(b.at));
  const firstSession = sessions.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
  if (firstSession) out.push({ id: 'first-session', label: 'First logged session', detail: '', date: firstSession.startedAt, type: 'session' });
  let topB = -1, topRGroup = -1;
  let firstLead = false;
  const groupOf = (idx: number) => (idx >= 25 ? 15 : idx >= 21 ? 14 : idx >= 17 ? 13 : idx >= 13 ? 12 : idx >= 9 ? 11 : idx >= 5 ? 10 : 9);
  for (const c of sorted) {
    if (!isSend(c.outcome) || c.gradeIdx == null) continue;
    if (c.type === 'boulder' && c.gradeIdx > topB) {
      for (let g = Math.max(topB + 1, 3); g <= c.gradeIdx; g++) out.push({ id: 'first-v' + g, label: 'First V' + g, detail: c.name ?? '', date: c.at, type: 'boulder' });
      topB = c.gradeIdx;
    }
    if (c.type === 'route') {
      const grp = groupOf(c.gradeIdx);
      if (grp > topRGroup) {
        for (let g = Math.max(topRGroup + 1, 10); g <= grp; g++) out.push({ id: 'first-5.' + g, label: 'First 5.' + g, detail: c.grade + (c.name ? ' · ' + c.name : ''), date: c.at, type: 'route' });
        topRGroup = grp;
      }
      if (!firstLead && c.ropeStyle === 'lead') { firstLead = true; out.push({ id: 'first-lead', label: 'First lead send', detail: c.grade, date: c.at, type: 'route' }); }
    }
  }
  return out.map((a) => ({ ...a, detail: a.detail })).sort((a, b) => a.date.localeCompare(b.date));
}

export function personalRecords(climbs: Climb[], sessions: Session[], gymName: (id: ID) => string): PersonalRecord[] {
  const prs: PersonalRecord[] = [];
  const sends = climbs.filter((c) => isSend(c.outcome) && c.gradeIdx != null).sort((a, b) => a.at.localeCompare(b.at));
  const hardest = (type: ClimbType) => {
    let best: Climb | null = null;
    for (const c of sends) if (c.type === type && (!best || (c.gradeIdx as number) > (best.gradeIdx as number))) best = c;
    return best;
  };
  const hb = hardest('boulder'), hr = hardest('route');
  if (hb) prs.push({ id: 'hardest-boulder', label: 'Hardest boulder', value: hb.grade, date: hb.at, gymId: hb.gymId });
  if (hr) prs.push({ id: 'hardest-route', label: 'Hardest route', value: hr.grade, date: hr.at, gymId: hr.gymId });
  const infos = sessions.map((s) => sessionInfo(s, climbs)).filter((i) => i.climbs.length);
  const top = (f: (i: SessionInfo) => number, id: string, label: string, unit: string) => {
    const best = infos.slice().sort((a, b) => f(b) - f(a) || a.session.startedAt.localeCompare(b.session.startedAt))[0];
    if (best && f(best) > 0) prs.push({ id, label, value: f(best) + unit, date: best.session.startedAt, gymId: best.session.gymId });
  };
  top((i) => i.climbs.length, 'most-climbs', 'Most climbs in a session', '');
  top((i) => i.sends, 'most-sends', 'Most sends in a session', '');
  top((i) => i.flashes, 'best-flash', 'Best flash session', ' first-try sends');
  const st = streaks(sessions);
  if (st.longest) prs.push({ id: 'longest-streak', label: 'Longest weekly streak', value: st.longest + ' wk', date: '' });
  void gymName;
  return prs;
}

/** Summary + what's new in one session compared with the climber's history before it. */
export function sessionSummary(sessionId: ID, climbs: Climb[], sessions: Session[]) {
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) return null;
  const info = sessionInfo(s, climbs);
  const before = sessions.filter((x) => x.startedAt < s.startedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const prevInfos = before.map((x) => sessionInfo(x, climbs)).filter((i) => i.climbs.length);
  const last5 = prevInfos.slice(0, 5);
  const avg = (f: (i: SessionInfo) => number | null) => mean(last5.map(f).filter((v): v is number => v != null));
  const t = totals(info.climbs, 1);
  const prevClimbs = climbs.filter((c) => c.at < s.startedAt && c.sessionId !== s.id);
  const prevT = totals(prevClimbs, 0);
  const records: string[] = [];
  if (t.topBoulder != null && (prevT.topBoulder == null || t.topBoulder > prevT.topBoulder) && prevClimbs.length) records.push('Hardest boulder ever: ' + gradeLabel('boulder', t.topBoulder));
  if (t.topRoute != null && (prevT.topRoute == null || t.topRoute > prevT.topRoute) && prevClimbs.length) records.push('Hardest route ever: ' + gradeLabel('route', t.topRoute));
  if (prevInfos.length) {
    if (info.climbs.length > Math.max(...prevInfos.map((i) => i.climbs.length))) records.push('Most climbs in a session: ' + info.climbs.length);
    if (info.sends > Math.max(...prevInfos.map((i) => i.sends))) records.push('Most sends in a session: ' + info.sends);
    if (info.flashes > Math.max(...prevInfos.map((i) => i.flashes))) records.push('Best flash session: ' + info.flashes);
  }
  const sameGym = prevInfos.filter((i) => i.session.gymId === s.gymId);
  if (sameGym.length && info.sends > Math.max(...sameGym.map((i) => i.sends)) && !records.some((r) => r.startsWith('Most sends'))) records.push('Most sends at this gym: ' + info.sends);
  const rate = (i: SessionInfo) => { const tt = totals(i.climbs, 1); return tt.flashRate == null ? null : tt.flashRate * 100; };
  const aps = (i: SessionInfo) => totals(i.climbs, 1).attemptsPerSend;
  const compare = last5.length
    ? [
        { label: 'Climbs', now: info.climbs.length, avg: avg((i) => i.climbs.length), better: 'higher' as const, fmt: (v: number) => v.toFixed(v % 1 ? 1 : 0) },
        { label: 'Sends', now: info.sends, avg: avg((i) => i.sends), better: 'higher' as const, fmt: (v: number) => v.toFixed(v % 1 ? 1 : 0) },
        { label: 'Flash rate', now: t.flashRate == null ? null : t.flashRate * 100, avg: avg(rate), better: 'higher' as const, fmt: (v: number) => Math.round(v) + '%' },
        { label: 'Attempts per send', now: t.attemptsPerSend, avg: avg(aps), better: 'lower' as const, fmt: (v: number) => v.toFixed(1) },
        { label: 'Top boulder', now: t.topBoulder, avg: avg((i) => i.topB), better: 'higher' as const, fmt: (v: number) => 'V' + v.toFixed(v % 1 ? 1 : 0) },
      ]
    : [];
  return { info, totals: t, records, compare, comparedWith: last5.length };
}

export function pyramid(climbs: Climb[], type: ClimbType) {
  const m = new Map<number, { sent: number; tried: number }>();
  climbs.filter((c) => c.type === type && c.gradeIdx != null).forEach((c) => {
    const v = m.get(c.gradeIdx as number) ?? { sent: 0, tried: 0 };
    v.tried++;
    if (isSend(c.outcome)) v.sent++;
    m.set(c.gradeIdx as number, v);
  });
  return Array.from(m.entries()).sort((a, b) => b[0] - a[0]).map(([idx, v]) => ({ idx, grade: gradeLabel(type, idx), ...v }));
}

export const STYLE_KEYS = [
  { key: 'slab', label: 'Slab', test: (c: Climb) => c.angle === 'slab' },
  { key: 'vertical', label: 'Vertical', test: (c: Climb) => c.angle === 'vertical' },
  { key: 'overhang', label: 'Overhang', test: (c: Climb) => c.angle === 'overhang' },
  { key: 'roof', label: 'Roof', test: (c: Climb) => c.angle === 'roof' },
  { key: 'technical', label: 'Technical', test: (c: Climb) => c.styles.includes('Technical') },
  { key: 'dynamic', label: 'Dynamic', test: (c: Climb) => c.styles.includes('Dynamic') },
  { key: 'powerful', label: 'Powerful', test: (c: Climb) => c.styles.includes('Powerful') },
  { key: 'endurance', label: 'Endurance', test: (c: Climb) => c.styles.includes('Endurance') || (c.type === 'route' && c.ropeStyle === 'lead') },
];

export function styleAnalysis(climbs: Climb[]) {
  const rows = STYLE_KEYS.map((s) => {
    const list = climbs.filter(s.test);
    const work = list.filter((c) => !c.warmup);
    const sent = work.filter((c) => isSend(c.outcome)).length;
    return { key: s.key, label: s.label, count: list.length, sendRate: work.length >= 5 ? Math.round((sent / work.length) * 100) : null };
  });
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  const withShare = rows.map((r) => ({ ...r, volume: Math.round((r.count / maxCount) * 100) }));
  const rated = withShare.filter((r) => r.sendRate != null);
  const strongest = rated.slice().sort((a, b) => (b.sendRate as number) - (a.sendRate as number))[0];
  const weakest = rated.slice().sort((a, b) => (a.sendRate as number) - (b.sendRate as number))[0];
  const most = withShare.slice().sort((a, b) => b.count - a.count)[0];
  return { rows: withShare, strongest, weakest, most };
}

/** A simple outlook for a project from its own high-point history. An estimate, not a prediction. */
export function projectOutlook(p: Project, userTop: number | null) {
  const atts = p.attempts.slice().sort((a, b) => a.date.localeCompare(b.date));
  const hp = atts.map((a) => a.highPoint);
  const last = hp.length ? hp[hp.length - 1] : 0;
  const best = hp.length ? Math.max(...hp) : 0;
  const tries = atts.reduce((s, a) => s + a.tries, 0);
  let difficulty = 'No sends to compare yet';
  if (p.gradeIdx != null && userTop != null) {
    const d = p.gradeIdx - userTop;
    difficulty = d > 0 ? (d === 1 ? 'One grade above your hardest send' : d + ' grades above your hardest send') : d === 0 ? 'At your hardest grade' : d === -1 ? 'Just below your limit' : 'Well within your range';
  }
  if (p.status === 'sent') return { difficulty, best, tries, sessions: atts.length, text: 'Sent', detail: '', confidence: null as null | 'low' | 'medium' };
  if (atts.length < 2) return { difficulty, best, tries, sessions: atts.length, text: 'Log a couple of sessions to see an outlook', detail: 'The outlook uses how your high point changes between sessions.', confidence: 'low' as const };
  const slope = (last - hp[0]) / (atts.length - 1);
  if (slope <= 1) return { difficulty, best, tries, sessions: atts.length, text: 'Progress has levelled off', detail: 'Your high point hasn’t moved much lately. New beta or a rest week may help.', confidence: 'low' as const };
  const remaining = (100 - best) / slope;
  const lo = Math.max(1, Math.floor(remaining * 0.7)), hi = Math.max(lo, Math.ceil(remaining * 1.4));
  return {
    difficulty, best, tries, sessions: atts.length,
    text: lo === hi ? 'About ' + lo + ' more session' + (lo > 1 ? 's' : '') : lo + '–' + hi + ' more sessions at this pace',
    detail: 'High point rising about ' + Math.round(slope) + '% per session over ' + atts.length + ' sessions.',
    confidence: atts.length >= 3 ? ('medium' as const) : ('low' as const),
  };
}

export function pearson(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  if (!dx || !dy) return null;
  return num / Math.sqrt(dx * dy);
}

/** Weekly best for a training exercise (max weight, else max seconds/reps). */
export function trainingWeekly(training: TrainingSession[], exerciseId: ID) {
  const m = new Map<string, number>();
  training.filter((t) => t.endedAt).forEach((t) => t.entries.filter((e) => e.exerciseId === exerciseId).forEach((e) => {
    e.sets.filter((s) => s.done).forEach((s) => {
      const v = s.weight ?? s.seconds ?? s.reps ?? 0;
      const k = weekKey(t.startedAt);
      m.set(k, Math.max(m.get(k) ?? -Infinity, v));
    });
  }));
  return m;
}

export function climbingWeekly(climbs: Climb[], type: ClimbType) {
  const m = new Map<string, number>();
  climbs.filter((c) => c.type === type && isSend(c.outcome) && c.gradeIdx != null).forEach((c) => {
    const k = weekKey(c.at);
    m.set(k, Math.max(m.get(k) ?? -1, c.gradeIdx as number));
  });
  return m;
}

export function dailyActivity(climbs: Climb[]) {
  const m = new Map<string, number>();
  climbs.forEach((c) => m.set(dayKey(c.at), (m.get(dayKey(c.at)) ?? 0) + 1));
  return m;
}

export const pct = (v: number | null | undefined) => (v == null ? '—' : Math.round(v * 100) + '%');
