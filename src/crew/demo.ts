import type { ClaimResult, CrewApi, CrewPost, CrewProfile, Person, PostData, ReactionKind } from './types';
import { REACTIONS } from './types';

// Demo Crew for the web preview and design reviews: sample friends and posts on this device only.
// Every screen shows a "Demo crew · sample data" label while this is in use. Store builds never use it.

const KEY = 'dynomark.crew.demo';

interface DemoState {
  me: CrewProfile | null;
  signedIn: boolean;
  rel: Record<string, 'friend' | 'incoming' | 'outgoing' | 'none'>;
  blocked: string[];
  mine: Record<string, ReactionKind[]>;
  myPosts: { id: string; ref: string; createdAt: string; data: PostData }[];
}

const PEOPLE: CrewProfile[] = [
  { id: 'd-priya', username: 'priya_sends', firstName: 'Priya', homeGym: 'Dogpatch Boulders' },
  { id: 'd-sam', username: 'sam_k', firstName: 'Sam', homeGym: 'Pacific Pipe' },
  { id: 'd-jonah', username: 'jonah_m', firstName: 'Jonah', homeGym: 'Berkeley Ironworks' },
  { id: 'd-mei', username: 'mei_crimps', firstName: 'Mei', homeGym: 'Dogpatch Boulders' },
  { id: 'd-theo', username: 'theo_v', firstName: 'Theo', homeGym: 'Pacific Pipe' },
  { id: 'd-ana', username: 'ana_onsight', firstName: 'Ana', homeGym: 'Mission Cliffs' },
];

const fresh = (): DemoState => ({
  me: null,
  signedIn: false,
  rel: { 'd-priya': 'friend', 'd-sam': 'friend', 'd-jonah': 'friend', 'd-mei': 'incoming', 'd-theo': 'incoming', 'd-ana': 'none' },
  blocked: [],
  mine: {},
  myPosts: [],
});

function load(): DemoState {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...fresh(), ...JSON.parse(raw) } : fresh(); } catch { return fresh(); }
}
function save(s: DemoState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

const ago = (days: number, hours = 0) => new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString();
const counts = (a: number, b: number, c: number, d: number, e: number): Record<ReactionKind, number> => ({ allez: a, send: b, crusher: c, clean: d, respect: e });

/** Sample posts, dated relative to today so the feed always looks current. */
function samplePosts(): { id: string; author: string; createdAt: string; data: PostData; counts: Record<ReactionKind, number> }[] {
  const out: { id: string; author: string; createdAt: string; data: PostData; counts: Record<ReactionKind, number> }[] = [
    { id: 'p1', author: 'd-priya', createdAt: ago(0, 2), counts: counts(4, 2, 5, 0, 3), data: { at: ago(0, 4), gym: 'Dogpatch Boulders', durationMin: 98, style: 'boulder', climbs: 12, sends: 9, topBoulder: 'V6', flashes: 3, attempts: 27, pyramid: [{ g: 'V3', sent: 3, tried: 3 }, { g: 'V4', sent: 3, tried: 4 }, { g: 'V5', sent: 2, tried: 4 }, { g: 'V6', sent: 1, tried: 1 }], project: { name: 'Yellow Arete', grade: 'V6', tries: 14, sessions: 4 } } },
    { id: 'p2', author: 'd-sam', createdAt: ago(1, 3), counts: counts(2, 1, 0, 3, 1), data: { at: ago(1, 5), gym: 'Pacific Pipe', durationMin: 125, style: 'mixed', climbs: 17, sends: 14, topBoulder: 'V4', topRoute: '5.11b', flashes: 6, attempts: 33, pyramid: [{ g: '5.10a', sent: 5, tried: 5 }, { g: '5.10c', sent: 4, tried: 5 }, { g: '5.11b', sent: 2, tried: 3 }] } },
    { id: 'p3', author: 'd-jonah', createdAt: ago(2, 1), counts: counts(3, 0, 4, 0, 2), data: { at: ago(2, 3), gym: 'Berkeley Ironworks', durationMin: 140, style: 'boulder', climbs: 22, sends: 18, topBoulder: 'V7', flashes: 7, attempts: 41, pyramid: [{ g: 'V4', sent: 6, tried: 6 }, { g: 'V5', sent: 6, tried: 7 }, { g: 'V6', sent: 4, tried: 6 }, { g: 'V7', sent: 2, tried: 3 }] } },
  ];
  // Older history so "You vs" has something to compare over 30 days and 3 months.
  const plan: [string, string, number][] = [['d-priya', 'Dogpatch Boulders', 5], ['d-sam', 'Pacific Pipe', 4], ['d-jonah', 'Berkeley Ironworks', 4]];
  let n = 10;
  plan.forEach(([author, gym, top], k) => {
    for (let i = 1; i <= 14; i++) {
      const day = 3 + i * 6 + k;
      const climbs = 9 + ((i * 7 + k * 3) % 9);
      const sends = climbs - 1 - ((i + k) % 3);
      out.push({ id: 'h' + n++, author, createdAt: ago(day), counts: counts((i + k) % 4, i % 2, (i * k) % 3, 0, 1), data: { at: ago(day), gym, durationMin: 80 + ((i * 13) % 60), style: 'boulder', climbs, sends, topBoulder: 'V' + (top - (i % 3 === 0 ? 1 : 0)), flashes: 2 + (i % 4), attempts: climbs * 2 + (i % 5) } });
    }
  });
  return out;
}

const wait = () => new Promise((r) => setTimeout(r, 120));

export function demoApi(): CrewApi {
  let s = load();
  const commit = () => save(s);
  const byId = (id: string) => PEOPLE.find((p) => p.id === id) ?? (s.me && s.me.id === id ? s.me : undefined);
  const person = (p: CrewProfile): Person => ({ ...p, relation: s.me && p.id === s.me.id ? 'self' : s.rel[p.id] ?? 'none' });
  const visible = (id: string) => !s.blocked.includes(id);

  const toPost = (p: { id: string; author: string; createdAt: string; data: PostData; counts: Record<ReactionKind, number> }): CrewPost => {
    const mine = s.mine[p.id] ?? [];
    const c = { ...p.counts };
    REACTIONS.forEach((k) => { if (mine.includes(k)) c[k]++; });
    return { id: p.id, author: byId(p.author)!, createdAt: p.createdAt, data: p.data, counts: c, mine };
  };
  const all = () => {
    const mineAsPosts = s.myPosts.map((p) => ({ id: p.id, author: s.me?.id ?? 'me', createdAt: p.createdAt, data: p.data, counts: counts(0, 0, 0, 0, 0) }));
    return [...mineAsPosts, ...samplePosts()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  };

  return {
    mode: 'demo',
    async current() { await wait(); if (!s.signedIn) return null; return s.me ?? 'needs-username'; },
    async signIn() { await wait(); s.signedIn = true; commit(); return 'ok'; },
    async signOut() { s = fresh(); commit(); },
    async claimUsername(username, firstName): Promise<ClaimResult> {
      await wait();
      if (PEOPLE.some((p) => p.username === username)) return { ok: false, reason: 'taken' };
      s.me = { id: 'd-me', username, firstName: firstName || null, homeGym: null };
      commit();
      return { ok: true };
    },
    async updateProfile(p) { if (s.me) { s.me = { ...s.me, ...p }; commit(); } },
    async people() { await wait(); return PEOPLE.filter((p) => visible(p.id)).map(person).filter((p) => p.relation !== 'none'); },
    async search(q) {
      await wait();
      const t = q.trim().replace(/^@/, '').toLowerCase();
      if (t.length < 2) return [];
      return PEOPLE.filter((p) => visible(p.id) && p.username.includes(t)).map(person);
    },
    async request(id) { s.rel[id] = s.rel[id] === 'incoming' ? 'friend' : 'outgoing'; commit(); },
    async accept(id) { s.rel[id] = 'friend'; commit(); },
    async remove(id) { s.rel[id] = 'none'; commit(); },
    async block(id) { s.rel[id] = 'none'; if (!s.blocked.includes(id)) s.blocked.push(id); commit(); },
    async unblock(id) { s.blocked = s.blocked.filter((x) => x !== id); commit(); },
    async blocked() { return s.blocked.map((id) => byId(id)).filter((p): p is CrewProfile => !!p); },
    async report() { await wait(); },
    async feed() {
      await wait();
      return all().filter((p) => p.author === s.me?.id || p.author === 'me' || (s.rel[p.author] === 'friend' && visible(p.author))).slice(0, 40).map(toPost);
    },
    async postsBy(id) { await wait(); return all().filter((p) => p.author === id && (s.rel[id] === 'friend' || id === s.me?.id)).map(toPost); },
    async publish(ref, data) {
      const existing = s.myPosts.find((p) => p.ref === ref);
      if (existing) { existing.data = data; commit(); return existing.id; }
      const id = 'm' + Date.now();
      s.myPosts.unshift({ id, ref, createdAt: new Date().toISOString(), data });
      commit();
      return id;
    },
    async unpublish(id) { s.myPosts = s.myPosts.filter((p) => p.id !== id); commit(); },
    async react(postId, kind, on) {
      const cur = new Set(s.mine[postId] ?? []);
      if (on) cur.add(kind); else cur.delete(kind);
      s.mine[postId] = Array.from(cur);
      commit();
    },
    async deleteAccount() { s = fresh(); commit(); },
  };
}
