import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isNative } from '../lib/native';
import { REACTIONS, type ClaimResult, type CrewApi, type CrewPost, type CrewProfile, type Person, type PostData, type ReactionKind, type Relation } from './types';

// Crew on Supabase. Row-level security in supabase/migrations decides who can read what; this file only
// asks. The URL and anon key are public by design (they identify the project, not a secret).

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const CREW_SERVER = !!(URL && KEY);

/** Apple's "Services ID"-free native flow: the bundle id is the client id. */
const APPLE_CLIENT_ID = 'com.studiovektor.dynomark';

type Row = Record<string, unknown>;
const PROFILE = 'id, username, first_name, home_gym';
const toProfile = (r: Row | null | undefined): CrewProfile => ({ id: String(r?.id ?? ''), username: String(r?.username ?? ''), firstName: (r?.first_name as string | null) ?? null, homeGym: (r?.home_gym as string | null) ?? null });

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const randomNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, '0')).join('');

export function liveApi(): CrewApi {
  const sb: SupabaseClient = createClient(URL!, KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !isNative(), storageKey: 'dynomark.crew.auth' },
  });
  const uid = async () => (await sb.auth.getSession()).data.session?.user.id ?? null;
  const must = (r: { data: unknown; error: { message: string; code?: string } | null }): unknown => { if (r.error) throw new Error(r.error.message); return r.data; };

  const relations = async (me: string) => {
    const rows = must(await sb.from('friendships').select('requester, addressee, status')) as Row[];
    const map = new Map<string, Relation>();
    rows.forEach((r) => {
      const other = r.requester === me ? String(r.addressee) : String(r.requester);
      map.set(other, r.status === 'accepted' ? 'friend' : r.requester === me ? 'outgoing' : 'incoming');
    });
    return map;
  };

  const toPosts = (rows: Row[], me: string): CrewPost[] => rows.map((r) => {
    const rs = (r.reactions as Row[] | null) ?? [];
    const counts = Object.fromEntries(REACTIONS.map((k) => [k, rs.filter((x) => x.kind === k).length])) as Record<ReactionKind, number>;
    return { id: String(r.id), author: toProfile(r.author as Row), createdAt: String(r.created_at), data: r.data as PostData, counts, mine: rs.filter((x) => x.user_id === me).map((x) => x.kind as ReactionKind) };
  });
  const POST = 'id, created_at, data, author:profiles!posts_author_fkey(' + PROFILE + '), reactions(kind, user_id)';

  return {
    mode: 'live',
    async current() {
      const id = await uid();
      if (!id) return null;
      const r = must(await sb.from('profiles').select(PROFILE).eq('id', id).maybeSingle()) as Row | null;
      return r ? toProfile(r) : 'needs-username';
    },
    async signIn() {
      if (isNative()) {
        const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
        const raw = randomNonce();
        try {
          const res = await SignInWithApple.authorize({ clientId: APPLE_CLIENT_ID, redirectURI: 'https://studio-vektor.com/dynomark/', scopes: 'name', nonce: await sha256Hex(raw) });
          must(await sb.auth.signInWithIdToken({ provider: 'apple', token: res.response.identityToken, nonce: raw }));
          return 'ok';
        } catch (e) {
          const m = String((e as Error)?.message ?? e);
          if (/cancel|1001/i.test(m)) return 'cancelled';
          throw e;
        }
      }
      must(await sb.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.href } }));
      return 'ok';
    },
    async signOut() { await sb.auth.signOut(); },
    async claimUsername(username, firstName): Promise<ClaimResult> {
      const id = await uid();
      if (!id) return { ok: false, reason: 'error' };
      const r = await sb.from('profiles').insert({ id, username, first_name: firstName || null });
      if (!r.error) return { ok: true };
      if (r.error.code === '23505') return { ok: false, reason: 'taken' };
      if (/reserved/.test(r.error.message)) return { ok: false, reason: 'reserved' };
      if (r.error.code === '23514') return { ok: false, reason: 'invalid' };
      return { ok: false, reason: 'error' };
    },
    async updateProfile(p) {
      const id = await uid();
      if (!id) return;
      const patch: Row = {};
      if (p.firstName !== undefined) patch.first_name = p.firstName || null;
      if (p.homeGym !== undefined) patch.home_gym = p.homeGym || null;
      must(await sb.from('profiles').update(patch).eq('id', id));
    },
    async people() {
      const me = await uid();
      if (!me) return [];
      const rel = await relations(me);
      if (!rel.size) return [];
      const rows = must(await sb.from('profiles').select(PROFILE).in('id', Array.from(rel.keys()))) as Row[];
      return rows.map((r): Person => ({ ...toProfile(r), relation: rel.get(String(r.id)) ?? 'none' }));
    },
    async search(q) {
      const me = await uid();
      const t = q.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!me || t.length < 2) return [];
      const rows = must(await sb.from('profiles').select(PROFILE).ilike('username', t + '%').limit(10)) as Row[];
      const rel = await relations(me);
      return rows.map((r): Person => ({ ...toProfile(r), relation: String(r.id) === me ? 'self' : rel.get(String(r.id)) ?? 'none' }));
    },
    async request(id) {
      const me = await uid();
      const rel = me ? await relations(me) : new Map();
      if (rel.get(id) === 'incoming') { must(await sb.rpc('accept_friend', { from_user: id })); return; }
      must(await sb.from('friendships').insert({ requester: me, addressee: id }));
    },
    async accept(id) { must(await sb.rpc('accept_friend', { from_user: id })); },
    async remove(id) {
      const me = await uid();
      must(await sb.from('friendships').delete().or(`and(requester.eq.${me},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${me})`));
    },
    async block(id) { const me = await uid(); must(await sb.from('blocks').insert({ blocker: me, blocked: id })); },
    async unblock(id) { const me = await uid(); must(await sb.from('blocks').delete().eq('blocker', me).eq('blocked', id)); },
    async blocked() {
      const rows = must(await sb.from('blocks').select('blocked:profiles!blocks_blocked_fkey(' + PROFILE + ')')) as Row[];
      return rows.map((r) => toProfile(r.blocked as Row));
    },
    async report(id, reason, postId) { const me = await uid(); must(await sb.from('reports').insert({ reporter: me, reported: id, reason, post_id: postId ?? null })); },
    async feed() {
      const me = await uid();
      if (!me) return [];
      const rows = must(await sb.from('posts').select(POST).order('created_at', { ascending: false }).limit(50)) as Row[];
      return toPosts(rows, me);
    },
    async postsBy(id) {
      const me = await uid();
      if (!me) return [];
      const since = new Date(Date.now() - 400 * 864e5).toISOString();
      const rows = must(await sb.from('posts').select(POST).eq('author', id).gte('created_at', since).order('created_at', { ascending: false }).limit(200)) as Row[];
      return toPosts(rows, me);
    },
    async publish(ref, data) {
      const me = await uid();
      const r = must(await sb.from('posts').upsert({ author: me, kind: 'session', local_ref: ref, data }, { onConflict: 'author,local_ref' }).select('id').single()) as Row;
      return String(r.id);
    },
    async unpublish(id) { must(await sb.from('posts').delete().eq('id', id)); },
    async react(postId, kind, on) {
      const me = await uid();
      if (on) must(await sb.from('reactions').upsert({ post_id: postId, user_id: me, kind }, { onConflict: 'post_id,user_id,kind', ignoreDuplicates: true }));
      else must(await sb.from('reactions').delete().eq('post_id', postId).eq('user_id', me).eq('kind', kind));
    },
    async deleteAccount() { must(await sb.rpc('delete_my_account')); await sb.auth.signOut(); },
  };
}
