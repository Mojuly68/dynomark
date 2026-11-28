import type { AppData, Climb, Gym, GymOverride, ID, Project, ProjectAttempt, Session, TrainingEntry, TrainingSession, Exercise, Routine } from '../types';
import { isSend } from '../lib/grades';
import { dayKey } from '../lib/dates';

// Pure state transitions. Each takes AppData and returns a new AppData (plus details).

let counter = 0;
export const uid = (p: string) => p + '-' + Date.now().toString(36) + '-' + (++counter).toString(36) + Math.random().toString(36).slice(2, 6);

export type ClimbInput = Omit<Climb, 'id' | 'sessionId' | 'isDemo'> & { highPoint?: number };

const H = 3600000;

/** End sessions left open for more than 12 hours (e.g. the app was closed at the gym). */
export function normalize(d: AppData, now = new Date()): AppData {
  if (!d.activeSessionId) return d;
  const s = d.sessions.find((x) => x.id === d.activeSessionId);
  if (!s) return { ...d, activeSessionId: null };
  const last = lastActivity(d, s);
  if (now.getTime() - last.getTime() > 12 * H) {
    return { ...d, activeSessionId: null, sessions: d.sessions.map((x) => (x.id === s.id ? { ...x, endedAt: new Date(last.getTime() + 10 * 60000).toISOString() } : x)) };
  }
  return d;
}

function lastActivity(d: AppData, s: Session) {
  const times = d.climbs.filter((c) => c.sessionId === s.id).map((c) => new Date(c.at).getTime());
  return new Date(Math.max(new Date(s.startedAt).getTime(), ...times));
}

function endActive(d: AppData, now: Date): AppData {
  if (!d.activeSessionId) return d;
  const id = d.activeSessionId;
  const s = d.sessions.find((x) => x.id === id);
  if (!s) return { ...d, activeSessionId: null };
  const climbsIn = d.climbs.filter((c) => c.sessionId === id);
  if (climbsIn.length === 0) {
    return { ...d, activeSessionId: null, sessions: d.sessions.filter((x) => x.id !== id) };
  }
  const end = new Date(Math.max(now.getTime(), lastActivity(d, s).getTime()));
  return { ...d, activeSessionId: null, sessions: d.sessions.map((x) => (x.id === id ? { ...x, endedAt: end.toISOString() } : x)) };
}

function resolveSession(d: AppData, gymId: ID, at: Date, now: Date): { d: AppData; sessionId: ID; startedNew: boolean } {
  const active = d.activeSessionId ? d.sessions.find((x) => x.id === d.activeSessionId) : undefined;
  if (active && active.gymId === gymId && dayKey(active.startedAt) === dayKey(at)) return { d, sessionId: active.id, startedNew: false };
  const live = Math.abs(now.getTime() - at.getTime()) < 3 * H;
  if (live) {
    const ended = endActive(d, now);
    const s: Session = { id: uid('s'), gymId, startedAt: at.toISOString(), endedAt: null };
    return { d: { ...ended, sessions: [...ended.sessions, s], activeSessionId: s.id }, sessionId: s.id, startedNew: true };
  }
  const existing = d.sessions.find((x) => x.gymId === gymId && dayKey(x.startedAt) === dayKey(at));
  if (existing) return { d, sessionId: existing.id, startedNew: false };
  const s: Session = { id: uid('s'), gymId, startedAt: at.toISOString(), endedAt: new Date(at.getTime() + 90 * 60000).toISOString() };
  return { d: { ...d, sessions: [...d.sessions, s] }, sessionId: s.id, startedNew: true };
}

function applyToProject(d: AppData, c: Climb, highPoint?: number): { d: AppData; sent?: Project } {
  if (!c.projectId) return { d };
  const p = d.projects.find((x) => x.id === c.projectId);
  if (!p) return { d };
  const sent = isSend(c.outcome);
  const best = Math.max(0, ...p.attempts.map((a) => a.highPoint));
  const a: ProjectAttempt = { id: uid('pa'), date: c.at, tries: c.attempts, highPoint: sent ? 100 : Math.max(0, Math.min(99, highPoint ?? best)), note: c.notes || undefined };
  const np: Project = { ...p, attempts: [...p.attempts, a], ...(sent && p.status !== 'sent' ? { status: 'sent' as const, sentAt: c.at } : {}) };
  return { d: { ...d, projects: d.projects.map((x) => (x.id === p.id ? np : x)) }, sent: sent && p.status !== 'sent' ? np : undefined };
}

export function logClimb(d: AppData, input: ClimbInput, now = new Date()) {
  const { highPoint, ...rest } = input;
  const at = new Date(input.at);
  const r = resolveSession(d, input.gymId, at, now);
  const climb: Climb = { ...rest, id: uid('c'), sessionId: r.sessionId };
  let next: AppData = { ...r.d, climbs: [...r.d.climbs, climb], settings: { ...r.d.settings, currentGymId: input.gymId } };
  const pr = applyToProject(next, climb, highPoint);
  next = pr.d;
  return { data: next, climb, startedNew: r.startedNew, projectSent: pr.sent };
}

export function updateClimb(d: AppData, id: ID, input: ClimbInput): AppData {
  const { highPoint: _hp, ...rest } = input;
  void _hp;
  return { ...d, climbs: d.climbs.map((c) => (c.id === id ? { ...c, ...rest, id: c.id, sessionId: c.sessionId } : c)) };
}

export function deleteClimb(d: AppData, id: ID): { data: AppData; removed?: Climb; index: number } {
  const index = d.climbs.findIndex((c) => c.id === id);
  if (index < 0) return { data: d, index };
  const removed = d.climbs[index];
  return { data: { ...d, climbs: d.climbs.filter((c) => c.id !== id) }, removed, index };
}

export function restoreClimb(d: AppData, c: Climb, index: number): AppData {
  const list = d.climbs.slice();
  list.splice(Math.min(index, list.length), 0, c);
  const hasSession = d.sessions.some((s) => s.id === c.sessionId);
  return { ...d, climbs: list, sessions: hasSession ? d.sessions : [...d.sessions, { id: c.sessionId, gymId: c.gymId, startedAt: c.at, endedAt: c.at }] };
}

export function duplicateClimb(d: AppData, id: ID, now = new Date()) {
  const src = d.climbs.find((c) => c.id === id);
  if (!src) return null;
  const { id: _i, sessionId: _s, isDemo: _x, projectId: _p, ...rest } = src;
  void _i; void _s; void _x; void _p;
  return logClimb(d, { ...rest, styles: [...src.styles], at: now.toISOString() }, now);
}

export function finishSession(d: AppData, now = new Date()): { data: AppData; sessionId: ID | null } {
  const id = d.activeSessionId;
  const had = id ? d.climbs.some((c) => c.sessionId === id) : false;
  return { data: endActive(d, now), sessionId: had ? id : null };
}

export function deleteSession(d: AppData, id: ID): AppData {
  return { ...d, sessions: d.sessions.filter((s) => s.id !== id), climbs: d.climbs.filter((c) => c.sessionId !== id), activeSessionId: d.activeSessionId === id ? null : d.activeSessionId };
}

// Projects
export function addProject(d: AppData, p: Omit<Project, 'id' | 'attempts' | 'videos' | 'status' | 'startedAt'>): { data: AppData; project: Project } {
  const project: Project = { ...p, id: uid('p'), attempts: [], videos: [], status: 'active', startedAt: new Date().toISOString() };
  return { data: { ...d, projects: [project, ...d.projects] }, project };
}
export function updateProject(d: AppData, id: ID, patch: Partial<Project>): AppData {
  return { ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}
export function addProjectAttempt(d: AppData, id: ID, a: Omit<ProjectAttempt, 'id'>): AppData {
  return { ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, attempts: [...p.attempts, { ...a, id: uid('pa') }] } : p)) };
}
export function deleteProject(d: AppData, id: ID): AppData {
  return { ...d, projects: d.projects.filter((p) => p.id !== id), climbs: d.climbs.map((c) => (c.projectId === id ? { ...c, projectId: undefined } : c)) };
}

// Gyms
export function toggleFavorite(d: AppData, gymId: ID): AppData {
  const f = d.settings.favorites;
  return { ...d, settings: { ...d.settings, favorites: f.includes(gymId) ? f.filter((x) => x !== gymId) : [...f, gymId] } };
}
export function setHomeState(d: AppData, state: string): AppData {
  return { ...d, settings: { ...d.settings, homeState: state || undefined } };
}
export function setCurrentGym(d: AppData, gymId: ID): AppData {
  return { ...d, settings: { ...d.settings, currentGymId: gymId } };
}
export function setGymOverride(d: AppData, gymId: ID, patch: GymOverride): AppData {
  return { ...d, gymOverrides: { ...d.gymOverrides, [gymId]: { ...d.gymOverrides[gymId], ...patch } } };
}
export function addCustomGym(d: AppData, g: Omit<Gym, 'id' | 'custom' | 'brand' | 'disciplinesSource'>): { data: AppData; gym: Gym } {
  const gym: Gym = { ...g, id: uid('g'), brand: 'Custom', custom: true, disciplinesSource: null };
  return { data: { ...d, customGyms: [...d.customGyms, gym] }, gym };
}

// Training
export function startTraining(d: AppData, routine: Routine | null, name?: string): { data: AppData; id: ID } {
  const prev = (exId: ID) => {
    for (let i = d.training.length - 1; i >= 0; i--) {
      const e = d.training[i].entries.find((x) => x.exerciseId === exId);
      if (e && d.training[i].endedAt) return e;
    }
    return null;
  };
  const entries: TrainingEntry[] = (routine?.exerciseIds ?? []).map((exId) => {
    const p = prev(exId);
    return { id: uid('te'), exerciseId: exId, sets: p ? p.sets.map((s) => ({ ...s, done: false })) : [{ done: false }, { done: false }, { done: false }] };
  });
  const t: TrainingSession = { id: uid('t'), name: name || routine?.name || 'Workout', routineId: routine?.id, startedAt: new Date().toISOString(), endedAt: null, entries };
  return { data: { ...d, training: [...d.training, t], activeTrainingId: t.id }, id: t.id };
}
export function updateTraining(d: AppData, id: ID, fn: (t: TrainingSession) => TrainingSession): AppData {
  return { ...d, training: d.training.map((t) => (t.id === id ? fn(t) : t)) };
}
export function finishTraining(d: AppData): AppData {
  const id = d.activeTrainingId;
  if (!id) return d;
  return { ...d, activeTrainingId: null, training: d.training.map((t) => (t.id === id ? { ...t, endedAt: new Date().toISOString(), bodyWeightKg: d.user.weightKg, entries: t.entries.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length) } : t)) };
}
export function discardTraining(d: AppData): AppData {
  const id = d.activeTrainingId;
  return { ...d, activeTrainingId: null, training: d.training.filter((t) => t.id !== id) };
}
export function addExercise(d: AppData, e: Omit<Exercise, 'id' | 'custom'>): { data: AppData; exercise: Exercise } {
  const exercise: Exercise = { ...e, id: uid('ex'), custom: true };
  return { data: { ...d, exercises: [...d.exercises, exercise] }, exercise };
}
export function saveRoutine(d: AppData, name: string, exerciseIds: ID[]): AppData {
  return { ...d, routines: [...d.routines, { id: uid('rt'), name, exerciseIds }] };
}
export function deleteRoutine(d: AppData, id: ID): AppData {
  return { ...d, routines: d.routines.filter((r) => r.id !== id) };
}
