import type { AppData, ID } from '../types';
import { sessionInfo, pyramid } from '../lib/stats';
import { gradeLabel, isSend } from '../lib/grades';
import type { PostData } from './types';

// Crew settings and bookkeeping kept on this device, in their own key (never inside the climbing log).
const KEY = 'dynomark.crew';

export type PostMode = 'ask' | 'auto' | 'never';
export type ShareField = 'gym' | 'duration' | 'grades' | 'attempts' | 'projects';
export const SHARE_FIELDS: { id: ShareField; label: string; note: string }[] = [
  { id: 'gym', label: 'Gym', note: 'Where the session was' },
  { id: 'duration', label: 'Session duration', note: 'How long you climbed' },
  { id: 'grades', label: 'Grades', note: 'Top grade and grade pyramid' },
  { id: 'attempts', label: 'Attempts and flashes', note: 'Tries and first-try sends' },
  { id: 'projects', label: 'Project sends', note: 'When you send one of your projects' },
];

export interface CrewLocal {
  postMode: PostMode;
  share: Record<ShareField, boolean>;
  /** Local session id → post id, so a session is never posted twice and can be deleted from Crew. */
  posted: Record<ID, string>;
  /** Sessions the climber chose not to post (so "ask" doesn't ask again). */
  skipped: ID[];
  /** Friends whose posts are hidden from this feed (they stay friends). */
  muted: string[];
  /** Friends whose project sends should be highlighted. */
  watch: string[];
  onboarded: boolean;
}

const DEFAULTS: CrewLocal = {
  postMode: 'ask',
  share: { gym: true, duration: true, grades: true, attempts: true, projects: true },
  posted: {},
  skipped: [],
  muted: [],
  watch: [],
  onboarded: false,
};

export function loadLocal(): CrewLocal {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, share: { ...DEFAULTS.share } };
    const v = JSON.parse(raw) as Partial<CrewLocal>;
    return { ...DEFAULTS, ...v, share: { ...DEFAULTS.share, ...(v.share ?? {}) } };
  } catch {
    return { ...DEFAULTS, share: { ...DEFAULTS.share } };
  }
}

export function saveLocal(v: CrewLocal) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage full or blocked */ }
}

export function clearLocal() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Usernames: 3–20 lower-case letters, numbers or underscores. The server enforces the same pattern and a
// reserved list; this filter also stops the most obvious insults before they're sent.
// ---------------------------------------------------------------------------
const BAD = ['fuck', 'shit', 'cunt', 'nigg', 'fag', 'retard', 'whore', 'slut', 'nazi', 'hitler', 'rape', 'porn', 'dick', 'pussy', 'bitch', 'kkk'];
const RESERVED = ['admin', 'administrator', 'dynomark', 'dynomark_app', 'support', 'help', 'staff', 'moderator', 'official', 'studiovektor', 'studio_vektor', 'apple', 'root', 'system', 'null', 'undefined'];

export const normalizeUsername = (u: string) => u.trim().replace(/^@/, '').toLowerCase();

export function usernameProblem(u: string): string | null {
  const n = normalizeUsername(u);
  if (!n) return 'Choose a username';
  if (!/^[a-z0-9_]{3,20}$/.test(n)) return 'Use 3–20 letters, numbers or underscores';
  if (RESERVED.includes(n)) return '@' + n + ' is reserved';
  const flat = n.replace(/[_0-9]/g, '');
  if (BAD.some((b) => flat.includes(b))) return 'Pick a different username';
  return null;
}

// ---------------------------------------------------------------------------
// Building a post from a local session, with only the fields the climber switched on.
// ---------------------------------------------------------------------------
export function buildPost(d: AppData, sessionId: ID, share: Record<ShareField, boolean>, gymName: (id: ID) => string): PostData | null {
  const s = d.sessions.find((x) => x.id === sessionId);
  if (!s) return null;
  const info = sessionInfo(s, d.climbs);
  if (!info.climbs.length) return null;
  const types = new Set(info.climbs.map((c) => c.type));
  const style: PostData['style'] = types.size > 1 ? 'mixed' : types.has('route') ? 'route' : 'boulder';
  const out: PostData = { at: s.startedAt, style, climbs: info.climbs.length, sends: info.sends };
  if (share.gym) out.gym = gymName(s.gymId);
  if (share.duration && s.endedAt) out.durationMin = Math.max(1, Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000));
  if (share.grades) {
    if (info.topB != null) out.topBoulder = gradeLabel('boulder', info.topB);
    if (info.topR != null) out.topRoute = gradeLabel('route', info.topR);
    const main = style === 'route' ? 'route' : 'boulder';
    out.pyramid = pyramid(info.climbs.filter((c) => !c.warmup), main).slice(0, 5).reverse().map((p) => ({ g: p.grade, sent: p.sent, tried: p.tried }));
  }
  if (share.attempts) { out.flashes = info.flashes; out.attempts = info.attempts; }
  if (share.projects) {
    const sentHere = d.projects.find((p) => p.status === 'sent' && p.sentAt && info.climbs.some((c) => c.projectId === p.id && isSend(c.outcome)));
    if (sentHere) out.project = { name: sentHere.name, grade: sentHere.grade, tries: sentHere.attempts.reduce((n, a) => n + a.tries, 0), sessions: sentHere.attempts.length };
  }
  return out;
}

/** "1h 52m" */
export const fmtMinutes = (m: number) => (m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + ' min');
