import type { AppData, Climb, ClimbType, ID, WallAngle } from '../types';
import { achievements, totals } from './stats';
import { isSend } from './grades';
import { dayKey, monthShort, weekKey } from './dates';

export type PeriodKind = 'month' | 'year';
export interface Period { kind: PeriodKind; start: Date; end: Date; label: string; short: string; key: string }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthPeriod(y: number, m: number): Period {
  const start = new Date(y, m, 1);
  return { kind: 'month', start, end: new Date(y, m + 1, 1), label: MONTHS[start.getMonth()] + ' ' + start.getFullYear(), short: monthShort(start.getMonth()), key: start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') };
}
export function yearPeriod(y: number): Period {
  return { kind: 'year', start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), label: String(y), short: String(y), key: String(y) };
}
export function shiftPeriod(p: Period, n: number): Period {
  return p.kind === 'month' ? monthPeriod(p.start.getFullYear(), p.start.getMonth() + n) : yearPeriod(p.start.getFullYear() + n);
}
/** Parse ?m=YYYY-MM or ?y=YYYY; anything else falls back to the current month. */
export function periodFromQuery(m: string | null, y: string | null, now = new Date()): Period {
  if (y && /^\d{4}$/.test(y)) return yearPeriod(Number(y));
  if (m && /^\d{4}-\d{2}$/.test(m)) { const [yy, mm] = m.split('-').map(Number); if (mm >= 1 && mm <= 12) return monthPeriod(yy, mm - 1); }
  return monthPeriod(now.getFullYear(), now.getMonth());
}
export const periodQuery = (p: Period) => (p.kind === 'year' ? 'y=' + p.key : 'm=' + p.key);

const within = (iso: string | undefined | null, p: Period) => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= p.start.getTime() && t < p.end.getTime(); };

export const ANGLE_ORDER: WallAngle[] = ['slab', 'vertical', 'overhang', 'roof'];

function hardestSend(list: Climb[], type: ClimbType) {
  let best: Climb | null = null;
  for (const c of list) {
    if (c.type !== type || c.warmup || !isSend(c.outcome) || c.gradeIdx == null) continue;
    if (!best || c.gradeIdx > (best.gradeIdx as number) || (c.gradeIdx === best.gradeIdx && c.at < best.at)) best = c;
  }
  return best;
}

export function buildReport(data: AppData, p: Period, now = new Date()) {
  const prev = shiftPeriod(p, -1);
  const climbs = data.climbs.filter((c) => within(c.at, p));
  const sessions = data.sessions.filter((s) => within(s.startedAt, p));
  // A period still in progress is compared with the same stretch of the previous one, not all of it.
  const partial = now.getTime() >= p.start.getTime() && now.getTime() < p.end.getTime();
  const prevCut = partial ? { ...prev, end: new Date(Math.min(prev.end.getTime(), prev.start.getTime() + (now.getTime() - p.start.getTime()))) } : prev;
  const prevClimbs = data.climbs.filter((c) => within(c.at, prevCut));
  const prevSessions = data.sessions.filter((s) => within(s.startedAt, prevCut));
  const t = totals(climbs, sessions.length);
  const pt = totals(prevClimbs, prevSessions.length);

  const ms = sessions.reduce((sum, s) => sum + (s.endedAt ? Math.min(5 * 3600000, Math.max(0, new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime())) : 0), 0);
  const days = new Set(sessions.map((s) => dayKey(s.startedAt))).size;

  // Hardest sends, and whether they beat everything before this period.
  const before = data.climbs.filter((c) => new Date(c.at).getTime() < p.start.getTime());
  const hardest = (['boulder', 'route'] as ClimbType[]).map((type) => {
    const c = hardestSend(climbs, type);
    const prior = hardestSend(before, type);
    return c ? { type, climb: c, isBest: !prior || (c.gradeIdx as number) > (prior.gradeIdx as number) } : null;
  }).filter((x): x is { type: ClimbType; climb: Climb; isBest: boolean } => x != null);

  const milestones = achievements(data.climbs, data.sessions).filter((a) => a.type !== 'session' && within(a.date, p));
  const projectsSent = data.projects.filter((x) => x.status === 'sent' && within(x.sentAt, p));
  const projectsStarted = data.projects.filter((x) => within(x.startedAt, p));

  // Gyms: visits this period, and which ones were visited for the first time ever.
  const firstVisit = new Map<ID, string>();
  data.sessions.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt)).forEach((s) => { if (!firstVisit.has(s.gymId)) firstVisit.set(s.gymId, s.startedAt); });
  const visits = new Map<ID, number>();
  sessions.forEach((s) => visits.set(s.gymId, (visits.get(s.gymId) ?? 0) + 1));
  const gyms = Array.from(visits.entries()).sort((a, b) => b[1] - a[1]).map(([gymId, n]) => ({ gymId, visits: n, isNew: within(firstVisit.get(gymId), p) }));

  // Best stretch: busiest week in a month, best month in a year (by sends).
  const groupKey = (iso: string) => (p.kind === 'month' ? weekKey(iso) : String(new Date(iso).getMonth()));
  const groups = new Map<string, { sends: number; sessions: number }>();
  sessions.forEach((s) => { const k = groupKey(s.startedAt); const g = groups.get(k) ?? { sends: 0, sessions: 0 }; g.sessions++; groups.set(k, g); });
  climbs.forEach((c) => { if (!isSend(c.outcome)) return; const k = groupKey(c.at); const g = groups.get(k) ?? { sends: 0, sessions: 0 }; g.sends++; groups.set(k, g); });
  const bestGroup = Array.from(groups.entries()).sort((a, b) => b[1].sends - a[1].sends)[0] ?? null;

  const bestSession = sessions.map((s) => ({ s, sends: climbs.filter((c) => c.sessionId === s.id && isSend(c.outcome)).length }))
    .sort((a, b) => b.sends - a.sends)[0] ?? null;

  const work = climbs.filter((c) => !c.warmup && c.angle);
  const angles = ANGLE_ORDER.map((a) => {
    const n = work.filter((c) => c.angle === a).length;
    return { angle: a, n, share: work.length ? n / work.length : 0 };
  });
  const quietAngle = work.length >= 20 ? angles.filter((a) => a.share < 0.1).sort((a, b) => a.share - b.share)[0] ?? null : null;

  const workouts = data.training.filter((x) => x.endedAt && within(x.startedAt, p));
  const sets = workouts.reduce((n, w) => n + w.entries.reduce((m, e) => m + e.sets.filter((s) => s.done).length, 0), 0);

  const perMonth = p.kind === 'year'
    ? Array.from({ length: 12 }, (_, m) => ({
        label: monthShort(m),
        sends: climbs.filter((c) => isSend(c.outcome) && new Date(c.at).getMonth() === m).length,
        sessions: sessions.filter((s) => new Date(s.startedAt).getMonth() === m).length,
      }))
    : [];

  return {
    period: p, prev, partial, totals: t, prevTotals: pt, sessions: sessions.length, prevSessions: prevSessions.length,
    hours: ms / 3600000, days, hardest, milestones, projectsSent, projectsStarted, gyms, bestGroup, bestSession,
    angles, quietAngle, workouts: workouts.length, sets, perMonth,
    isDemo: data.user.isDemo || sessions.some((s) => s.isDemo),
  };
}
export type Report = ReturnType<typeof buildReport>;
