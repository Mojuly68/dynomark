import type { AppData, Climb, ClimbType, Outcome, Project, Session, TrainingSession, WallAngle } from '../types';
import { BOULDER_STYLES, HOLD_COLORS, ROUTE_GRADES, ROUTE_HOLDS, gradeIndex } from '../lib/grades';
import { addDays, startOfDay, startOfWeek } from '../lib/dates';
import { EXERCISES, ROUTINES } from './exercises';

// Sample history for the demo account. Every record carries isDemo: true and the UI
// labels it as sample data. Dates are relative to "now" so the demo never goes stale.

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PP = 'ts-pacific-pipe', MC = 'ts-mission-cliffs', BI = 'ts-berkeley-ironworks', BR = 'bridges', BB = 'bm-berkeley', DR = 'ts-diablo';
const BOULDER_ONLY = new Set([BR, BB]);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function createDemoData(now = new Date()): AppData {
  const rng = mulberry32(20261122);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rng() * a.length)];
  const weighted = <T,>(items: [T, number][]) => {
    const total = items.reduce((s, i) => s + i[1], 0);
    let r = rng() * total;
    for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
    return items[items.length - 1][0];
  };

  const today = startOfDay(now);
  const start = addDays(today, -960);
  const total = 960;
  const thisWeek = startOfWeek(today).getTime();
  const weeksAgo = (d: Date) => Math.round((thisWeek - startOfWeek(d).getTime()) / (7 * 86400000));
  const prDay = addDays(today, -4); // "Orange cave", first V6
  const routePrDay = addDays(today, -7); // "Red arête", first 5.11c

  const sessions: Session[] = [];
  const climbs: Climb[] = [];
  let sid = 0, cid = 0;

  const dayPlan: Date[] = [];
  for (let i = 0; i < total; i++) {
    const d = addDays(start, i);
    if (d >= today) break;
    const t = i / total;
    const wa = weeksAgo(d);
    if (wa === 6) continue; // a missed week, so the current weekly streak is 6
    if (t > 0.44 && t < 0.47) continue; // a trip away
    const dow = d.getDay();
    const base = dow === 2 || dow === 4 ? 0.1 + 0.42 * t : dow === 6 ? 0.18 + 0.3 * t : dow === 0 ? 0.05 : 0;
    if (rng() < base) dayPlan.push(d);
  }
  // Make sure each of the last six weeks has a session.
  for (let w = 0; w < 6; w++) {
    const ws = addDays(new Date(thisWeek), -7 * w);
    const has = dayPlan.some((d) => startOfWeek(d).getTime() === ws.getTime());
    if (!has) {
      const thu = addDays(ws, 3);
      if (thu < today) dayPlan.push(thu);
      else if (ws < today) dayPlan.push(ws);
    }
  }
  if (!dayPlan.some((d) => d.getTime() === prDay.getTime())) dayPlan.push(prDay);
  if (!dayPlan.some((d) => d.getTime() === routePrDay.getTime())) dayPlan.push(routePrDay);
  dayPlan.sort((a, b) => a.getTime() - b.getTime());

  for (const d of dayPlan) {
    const t = (d.getTime() - start.getTime()) / (total * 86400000);
    let gymId: string = t < 0.25
      ? weighted([[MC, 7], [BI, 2], [DR, 1]])
      : weighted([[PP, 30], [MC, 24], [BI, 15], [BR, 14], [BB, 9], [DR, 6]]);
    if (d.getTime() === prDay.getTime()) gymId = PP;
    if (d.getTime() === routePrDay.getTime()) gymId = MC;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const startAt = new Date(d);
    startAt.setHours(weekend ? 10 + Math.floor(rng() * 5) : 18 + Math.floor(rng() * 2), Math.floor(rng() * 4) * 15);
    const n = 8 + Math.floor(rng() * 8);
    const session: Session = { id: 'demo-s' + ++sid, gymId, startedAt: startAt.toISOString(), endedAt: new Date(startAt.getTime() + (75 + n * 4) * 60000).toISOString(), isDemo: true };
    sessions.push(session);

    const bLevel = 1 + 4.3 * Math.pow(t, 0.85);
    const rLevel = 3 + 6.6 * Math.pow(t, 0.85);
    const form = (rng() - 0.5) * 0.6;
    const routeShare = BOULDER_ONLY.has(gymId) ? 0 : gymId === MC ? 0.6 : 0.45;

    // Warm-ups: 2-3 easy climbs to start, generated without the random stream so the rest of the demo stays the same.
    const wN = 2 + (sid % 2);
    const wType: ClimbType = routeShare > 0.5 ? 'route' : 'boulder';
    const wLevel = Math.round(wType === 'boulder' ? bLevel : rLevel);
    for (let k = 0; k < wN; k++) {
      const g = Math.max(0, wLevel - (wType === 'boulder' ? 3 - k : 6 - 2 * k));
      climbs.push({
        id: 'demo-c' + ++cid, sessionId: session.id, gymId, type: wType, grade: wType === 'boulder' ? 'V' + g : ROUTE_GRADES[g], gradeIdx: g,
        outcome: wType === 'boulder' ? 'flash' : 'onsight', attempts: 1, ropeStyle: wType === 'route' ? 'top-rope' : undefined,
        color: HOLD_COLORS[(cid + k) % HOLD_COLORS.length].name, angle: 'vertical', styles: [], warmup: true,
        at: new Date(startAt.getTime() + k * 6 * 60000).toISOString(), isDemo: true,
      });
    }
    const warmEnd = wN * 6;

    for (let k = 0; k < n; k++) {
      const type: ClimbType = rng() < routeShare ? 'route' : 'boulder';
      const level = (type === 'boulder' ? bLevel : rLevel) + form;
      const offset = pick([-3, -2, -2, -1, -1, -1, 0, 0, 0, 1, 1]);
      const maxIdx = type === 'boulder' ? 9 : 14;
      const g = Math.max(0, Math.min(maxIdx, Math.round(level) + offset));
      const delta = g - level;
      const angle = weighted<WallAngle>([['overhang', 31], ['vertical', 27], ['slab', 14], ['roof', 9]]);
      const styles = type === 'boulder' ? [pick(BOULDER_STYLES)].concat(rng() < 0.3 ? [pick(BOULDER_STYLES)] : []) : rng() < 0.6 ? [pick(ROUTE_HOLDS)] : [];
      const uniq = Array.from(new Set(styles));
      let bias = { overhang: 0.5, roof: 0.2, vertical: 0.2, slab: -0.6 }[angle];
      if (uniq.includes('Powerful')) bias += 0.3;
      if (uniq.includes('Technical') || uniq.includes('Slab')) bias -= 0.4;
      let outcome: Outcome;
      let attempts = 1;
      if (delta < -1 && rng() < 0.12) outcome = 'repeat';
      else if (rng() < sigmoid(1.4 - 1.7 * delta + bias)) {
        const first = rng() < sigmoid(-1.2 - 1.6 * delta + bias * 0.5);
        if (type === 'boulder') { outcome = first ? 'flash' : 'sent'; attempts = first ? 1 : 2 + Math.floor(rng() * (1 + Math.max(0, delta + 1) * 2)); }
        else { outcome = first ? (rng() < 0.75 ? 'onsight' : 'flash') : 'redpoint'; attempts = first ? 1 : 2 + Math.floor(rng() * 3); }
      } else { outcome = 'project'; attempts = 1 + Math.floor(rng() * 4); }
      // Keep the record grades for the named sends injected below.
      const capB = d.getTime() > prDay.getTime() ? 7 : 6;
      const capR = d.getTime() > routePrDay.getTime() ? 12 : 11;
      if (outcome !== 'project' && ((type === 'boulder' && g >= capB) || (type === 'route' && g >= capR))) outcome = 'project';
      const grade = type === 'boulder' ? 'V' + g : ROUTE_GRADES[g];
      climbs.push({
        id: 'demo-c' + ++cid, sessionId: session.id, gymId, type, grade, gradeIdx: g, outcome, attempts,
        ropeStyle: type === 'route' ? (t < 0.3 ? 'top-rope' : rng() < 0.6 ? 'lead' : 'top-rope') : undefined,
        color: pick(HOLD_COLORS).name, angle, styles: uniq,
        at: new Date(startAt.getTime() + (warmEnd + k * 7) * 60000).toISOString(), isDemo: true,
      });
    }
    if (d.getTime() === prDay.getTime()) {
      climbs.push({ id: 'demo-c' + ++cid, sessionId: session.id, gymId, type: 'boulder', grade: 'V6', gradeIdx: 6, outcome: 'sent', attempts: 1, color: 'Orange', angle: 'overhang', styles: ['Powerful'], name: 'Orange cave', projectId: 'demo-p4', at: new Date(startAt.getTime() + 70 * 60000).toISOString(), isDemo: true });
    }
    if (d.getTime() === routePrDay.getTime()) {
      climbs.push({ id: 'demo-c' + ++cid, sessionId: session.id, gymId, type: 'route', grade: '5.11c', gradeIdx: gradeIndex('route', '5.11c'), outcome: 'redpoint', attempts: 1, ropeStyle: 'lead', color: 'Red', angle: 'vertical', styles: ['Crimps'], name: 'Red arête', projectId: 'demo-p5', at: new Date(startAt.getTime() + 60 * 60000).toISOString(), isDemo: true });
    }
  }

  const iso = (daysAgo: number) => { const x = addDays(today, -daysAgo); x.setHours(18, 30); return x.toISOString(); };
  const att = (p: string, rows: [number, number, number, string?][]) => rows.map((r, i) => ({ id: p + '-a' + i, date: iso(r[0]), tries: r[1], highPoint: r[2], note: r[3] }));
  const projects: Project[] = [
    { id: 'demo-p1', gymId: PP, type: 'boulder', name: 'Purple roof', grade: 'V6', gradeIdx: 6, startedAt: iso(25), status: 'active', videos: ['purple-roof-try.mov', 'purple-roof-beta.mov'], isDemo: true,
      notes: 'Heel hook on the right volume, then cut feet. Left hand hits the pinch thumb-down.',
      attempts: att('demo-p1', [[25, 4, 30, 'Couldn’t do the start'], [19, 3, 55, 'Stuck the crux throw'], [12, 4, 70, 'Linked start to crux'], [4, 3, 80, 'Fell on the last move']]) },
    { id: 'demo-p2', gymId: MC, type: 'route', name: 'Blue dihedral', grade: '5.12a', gradeIdx: gradeIndex('route', '5.12a'), startedAt: iso(21), status: 'active', videos: [], isDemo: true,
      notes: 'Clip from the jug, not the crimp. Rest on the stem before the roof.',
      attempts: att('demo-p2', [[21, 3, 35, '4 hangs'], [14, 3, 50, 'Roof sequence sorted'], [7, 3, 60, 'One hang, pumped']]) },
    { id: 'demo-p3', gymId: BI, type: 'boulder', name: 'Crimp ladder', grade: 'V5', gradeIdx: 5, startedAt: iso(10), status: 'active', videos: [], isDemo: true,
      attempts: att('demo-p3', [[10, 2, 25], [3, 3, 45, 'Matched the third crimp']]) },
    { id: 'demo-p4', gymId: PP, type: 'boulder', name: 'Orange cave', grade: 'V6', gradeIdx: 6, startedAt: iso(18), status: 'sent', sentAt: iso(4), videos: ['orange-cave-send.mov'], isDemo: true,
      notes: 'First V6.', attempts: att('demo-p4', [[18, 3, 40], [11, 3, 75, 'One move from the top'], [4, 1, 100, 'Sent']]) },
    { id: 'demo-p5', gymId: MC, type: 'route', name: 'Red arête', grade: '5.11c', gradeIdx: gradeIndex('route', '5.11c'), startedAt: iso(21), status: 'sent', sentAt: iso(7), videos: [], isDemo: true,
      attempts: att('demo-p5', [[21, 2, 60, '2 hangs'], [14, 2, 85, 'Fell at the last clip'], [7, 1, 100, 'Sent']]) },
    { id: 'demo-p6', gymId: DR, type: 'boulder', name: 'Yellow mantle', grade: 'V5', gradeIdx: 5, startedAt: iso(41), status: 'abandoned', videos: [], isDemo: true,
      notes: 'Reset by the gym.', attempts: att('demo-p6', [[41, 4, 35], [27, 4, 50, 'Got to the mantle'], [20, 3, 55]]) },
  ];

  const training: TrainingSession[] = [];
  for (let w = 26; w >= 1; w--) {
    const day = addDays(startOfWeek(today), -7 * w);
    day.setHours(19, 0);
    const prog = (26 - w) / 25;
    const hang = 5 + Math.floor(prog * 8) * 2;
    const pull = 10 + Math.floor(prog * 3) * 5;
    const fl = 8 + Math.round(prog * 6);
    training.push({
      id: 'demo-t' + w, name: 'Fingers + pull', routineId: 'rt-fingers', startedAt: day.toISOString(), endedAt: new Date(day.getTime() + 55 * 60000).toISOString(), isDemo: true,
      bodyWeightKg: Math.round((69.5 - prog * 1.5) * 10) / 10,
      entries: [
        { id: 'demo-t' + w + '-e1', exerciseId: 'ex-maxhang', sets: [0, 1, 2].map(() => ({ weight: hang, seconds: 10, done: true })) },
        { id: 'demo-t' + w + '-e2', exerciseId: 'ex-wpullup', sets: [0, 1, 2].map((i) => ({ weight: pull, reps: i === 2 ? 4 : 5, done: true })) },
        { id: 'demo-t' + w + '-e3', exerciseId: 'ex-fl', sets: [0, 1, 2].map(() => ({ seconds: fl, done: true })) },
      ],
    });
    if (w % 2 === 0) {
      const d2 = addDays(day, 3);
      training.push({
        id: 'demo-tp' + w, name: 'Power', routineId: 'rt-power', startedAt: d2.toISOString(), endedAt: new Date(d2.getTime() + 40 * 60000).toISOString(), isDemo: true,
        entries: [
          { id: 'demo-tp' + w + '-e1', exerciseId: 'ex-campus', sets: [0, 1, 2, 3].map(() => ({ reps: 3, done: true })) },
          { id: 'demo-tp' + w + '-e2', exerciseId: 'ex-grip', sets: [0, 1, 2].map(() => ({ weight: 30 + Math.round(prog * 10), reps: 8, done: true })) },
        ],
      });
    }
  }
  training.sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  return {
    version: 1,
    user: { id: 'demo-user', name: 'Alex', isDemo: true, createdAt: start.toISOString(), weightKg: 68, heightCm: 175, experience: 'intermediate' },
    customGyms: [],
    gymOverrides: {
      [PP]: { disciplines: ['bouldering', 'top-rope', 'lead'] },
      [MC]: { disciplines: ['bouldering', 'top-rope', 'lead'] },
      [BI]: { disciplines: ['bouldering', 'top-rope', 'lead'] },
      [DR]: { disciplines: ['bouldering', 'top-rope'], gradeNote: 'Boulders feel a grade soft to me.', gradeAdjust: -1 },
    },
    sessions,
    climbs,
    projects,
    exercises: EXERCISES,
    routines: ROUTINES,
    training,
    settings: { theme: 'dark', units: 'lb', currentGymId: PP, favorites: [PP, MC, BR] },
    activeSessionId: null,
    activeTrainingId: null,
  };
}

export function createEmptyData(name = ''): AppData {
  return {
    version: 1,
    user: { id: 'local-user', name, isDemo: false, createdAt: new Date().toISOString() },
    customGyms: [],
    gymOverrides: {},
    sessions: [],
    climbs: [],
    projects: [],
    exercises: EXERCISES,
    routines: ROUTINES,
    training: [],
    settings: { theme: 'dark', units: 'lb', currentGymId: null, favorites: [] },
    activeSessionId: null,
    activeTrainingId: null,
  };
}
