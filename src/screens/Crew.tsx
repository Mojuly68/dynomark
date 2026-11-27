import { useCallback, useEffect, useMemo, useState } from 'react';
import { HandFist, Lock, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useCrew } from '../crew/CrewProvider';
import { CrewAvatar, DemoNote, PostCard, displayName } from '../crew/ui';
import { normalizeUsername, usernameProblem, type PostMode } from '../crew/local';
import type { CrewPost, Person, ReactionKind } from '../crew/types';
import { Button, Card, Empty, H1, cx, inputCls } from '../components/ui';
import { useToast } from '../components/Toast';
import { href, navigate } from '../lib/router';
import { startOfWeek } from '../lib/dates';

export function Crew() {
  const crew = useCrew();
  if (!crew) return <Empty title="Crew isn't available in this version" />;
  if (crew.status === 'loading') return <div role="status" className="py-16 text-center text-sm text-muted">Loading Crew…</div>;
  if (crew.status === 'error') return <Empty title="Crew is unreachable" body={crew.error ?? 'Check your connection and try again.'} action={<Button onClick={() => void crew.refresh()}>Try again</Button>} />;
  if (crew.status === 'signed-out') return <Join />;
  if (crew.status === 'needs-username') return <Username />;
  if (!crew.local.onboarded) return <Posting />;
  return <Feed />;
}

// ---------------------------------------------------------------------------
// Step 1: what Crew is, and sign in with Apple.
// ---------------------------------------------------------------------------
function Join() {
  const crew = useCrew()!;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const r = await crew.api!.signIn();
      if (r === 'ok') await crew.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sign-in failed. Try again.');
    } finally { setBusy(false); }
  };
  const promises = [
    { icon: ShieldCheck, t: 'Your log stays on this phone', d: 'Only the sessions you choose to post are shared.' },
    { icon: Users, t: 'Friends only', d: 'People see your posts after you accept them. No public profiles.' },
    { icon: HandFist, t: 'No comments', d: 'Friends cheer with one tap: Allez, Send it, Crusher.' },
  ];
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      {crew.mode === 'demo' && <DemoNote />}
      <h1 className="m-0 font-display text-[34px] font-black leading-[1.04] tracking-tight">Climb with<br /><span className="text-route">your crew.</span></h1>
      <p className="m-0 text-[15px] leading-relaxed text-muted">See your friends' sessions, cheer their sends and compare progress. Crew is free and optional: the app works the same without it.</p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {promises.map((p) => (
          <li key={p.t} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-route"><p.icon size={18} aria-hidden="true" /></span>
            <span className="flex flex-col gap-0.5"><b className="text-[15px]">{p.t}</b><span className="text-[13px] leading-snug text-muted">{p.d}</span></span>
          </li>
        ))}
      </ul>
      <Button variant="ink" size="lg" onClick={go} disabled={busy}>{busy ? 'Signing in…' : crew.mode === 'demo' ? 'Try the demo crew' : 'Continue with Apple'}</Button>
      <p className="-mt-2 m-0 text-center text-xs text-muted">{crew.mode === 'demo' ? 'Demo: no account is created.' : 'No password. Apple can hide your email from us.'}</p>
      <a href={href('/')} className="self-center py-2 text-[15px] font-semibold">Not now</a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: claim a username (the only text other climbers see).
// ---------------------------------------------------------------------------
function Username() {
  const crew = useCrew()!;
  const [u, setU] = useState('');
  const [first, setFirst] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverProblem, setServerProblem] = useState<string | null>(null);
  const n = normalizeUsername(u);
  const problem = serverProblem ?? usernameProblem(u);
  const submit = async () => {
    if (usernameProblem(u)) return;
    setBusy(true);
    const r = await crew.api!.claimUsername(n, first.trim() || undefined);
    setBusy(false);
    if (r.ok) { await crew.refresh(); return; }
    setServerProblem(r.reason === 'taken' ? '@' + n + ' is taken' : r.reason === 'reserved' ? '@' + n + ' is reserved' : r.reason === 'invalid' ? 'Use 3–20 letters, numbers or underscores' : "Couldn't save that. Try again.");
  };
  return (
    <form className="mx-auto flex max-w-md flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {crew.mode === 'demo' && <DemoNote />}
      <h1 className="m-0 font-display text-[30px] font-black leading-tight tracking-tight">Pick your crew name.</h1>
      <p className="m-0 text-[15px] text-muted">Friends find you by username. It's the only text other climbers see.</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="crew-user" className="text-[13px] font-semibold text-muted">Username</label>
        <div className={cx('flex min-h-14 items-center gap-1 rounded-2xl border-2 bg-surface px-3.5', problem && u ? 'border-line' : n ? 'border-accent' : 'border-line')}>
          <span aria-hidden="true" className="font-mono text-[17px] font-bold text-muted">@</span>
          <input id="crew-user" value={u} onChange={(e) => { setU(e.target.value); setServerProblem(null); }} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username" maxLength={21} className="h-12 min-w-0 flex-1 border-0 bg-transparent font-mono text-[17px] font-bold text-ink outline-none" />
        </div>
        <span role="status" className={cx('text-[13px]', !u ? 'text-muted' : problem ? 'text-[#FFB199]' : 'text-route')}>{u ? problem ?? 'Looks good' : 'Letters, numbers and underscores, 3 to 20 characters.'}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="crew-first" className="text-[13px] font-semibold text-muted">First name (optional)</label>
        <input id="crew-first" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Enter name" autoComplete="given-name" maxLength={30} className={inputCls} />
      </div>
      <Button type="submit" variant="primary" size="lg" disabled={!!usernameProblem(u) || busy}>{busy ? 'Saving…' : 'Continue'}</Button>
      <Button type="button" variant="ghost" onClick={async () => { await crew.api!.signOut(); crew.forget(); }}>Cancel and sign out</Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 3: what happens after each session.
// ---------------------------------------------------------------------------
export const POST_MODES: { id: PostMode; name: string; note: string }[] = [
  { id: 'ask', name: 'Ask me each time', note: 'Recommended. You see a preview and choose what to share.' },
  { id: 'auto', name: 'Post automatically', note: 'Every finished session goes to your crew.' },
  { id: 'never', name: 'Never post', note: 'Watch your crew without sharing anything.' },
];

export function PostModePicker({ value, onChange }: { value: PostMode; onChange: (m: PostMode) => void }) {
  return (
    <div role="radiogroup" aria-label="After each session" className="flex flex-col gap-2">
      {POST_MODES.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.id)} className={cx('flex min-h-16 items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left', on ? 'border-accent bg-accent/10' : 'border-line bg-surface')}>
            <span aria-hidden="true" className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-accent' : 'border-muted')}>{on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}</span>
            <span className="flex flex-col gap-0.5"><b className="text-[15px]">{o.name}</b><span className="text-xs text-muted">{o.note}</span></span>
          </button>
        );
      })}
    </div>
  );
}

function Posting() {
  const crew = useCrew()!;
  const [mode, setMode] = useState<PostMode>(crew.local.postMode);
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      {crew.mode === 'demo' && <DemoNote />}
      <h1 className="m-0 font-display text-[30px] font-black leading-tight tracking-tight">When you finish a session…</h1>
      <PostModePicker value={mode} onChange={setMode} />
      <p className="m-0 text-xs text-muted">Change this anytime in Crew › Sharing &amp; privacy.</p>
      <Button variant="primary" size="lg" onClick={() => crew.setLocal((l) => ({ ...l, postMode: mode, onboarded: true }))}>Open my Crew</Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The feed.
// ---------------------------------------------------------------------------
function Feed() {
  const crew = useCrew()!;
  const toast = useToast();
  const [posts, setPosts] = useState<CrewPost[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const load = useCallback(async () => {
    try {
      const [f, p] = await Promise.all([crew.api!.feed(), crew.api!.people()]);
      setPosts(f); setPeople(p);
    } catch { toast("Couldn't load your crew. Pull to try again."); setPosts([]); }
  }, [crew.api, toast]);
  useEffect(() => { void load(); }, [load]);

  const muted = crew.local.muted;
  const shown = useMemo(() => (posts ?? []).filter((p) => !muted.includes(p.author.id)), [posts, muted]);
  const friends = people.filter((p) => p.relation === 'friend');
  const incoming = people.filter((p) => p.relation === 'incoming').length;

  const week = useMemo(() => {
    const since = startOfWeek(new Date()).toISOString();
    const m = new Map<string, { name: string; me: boolean; sends: number }>();
    (posts ?? []).filter((p) => p.data.at >= since).forEach((p) => {
      const me = p.author.id === crew.me?.id;
      const cur = m.get(p.author.id) ?? { name: me ? 'You' : displayName(p.author), me, sends: 0 };
      cur.sends += p.data.sends;
      m.set(p.author.id, cur);
    });
    const rows = Array.from(m.values()).sort((a, b) => b.sends - a.sends).slice(0, 5);
    const thisWeek = (posts ?? []).filter((p) => p.data.at >= since);
    return { rows, sessions: thisWeek.length, sends: thisWeek.reduce((n, p) => n + p.data.sends, 0), minutes: thisWeek.reduce((n, p) => n + (p.data.durationMin ?? 0), 0) };
  }, [posts, crew.me]);

  const react = async (post: CrewPost, kind: ReactionKind, on: boolean) => {
    setPosts((ps) => (ps ?? []).map((p) => p.id !== post.id ? p : { ...p, mine: on ? [...p.mine, kind] : p.mine.filter((k) => k !== kind), counts: { ...p.counts, [kind]: Math.max(0, p.counts[kind] + (on ? 1 : -1)) } }));
    try { await crew.api!.react(post.id, kind, on); } catch { toast("That reaction didn't go through."); void load(); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex-1"><H1>Crew</H1></div>
        <a href={href('/crew/add')} aria-label={incoming ? 'Add friends, ' + incoming + ' requests' : 'Add friends'} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink">
          <UserPlus size={20} aria-hidden="true" />
          {incoming > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1 text-[11px] font-black text-accent-ink">{incoming}</span>}
        </a>
        <a href={href('/crew/settings')} aria-label="Sharing and privacy" className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink"><Lock size={19} aria-hidden="true" /></a>
      </div>
      {crew.mode === 'demo' && <DemoNote />}

      {posts === null ? <div role="status" className="py-10 text-center text-sm text-muted">Loading your crew…</div> : (
        <>
          {friends.length === 0 && (
            <Empty title="Your crew is empty" body="Add friends with an invite link or their username. They see your posts once you're friends." action={<Button variant="primary" onClick={() => navigate('/crew/add')}>Add friends</Button>} />
          )}
          {week.sessions > 0 && (
            <section className="flex flex-col gap-3 rounded-[20px] border border-accent/30 bg-[linear-gradient(135deg,#2B3510,var(--c-surface)_70%)] p-4" aria-labelledby="crew-week">
              <div className="flex items-baseline justify-between"><h2 id="crew-week" className="m-0 font-display text-lg font-black">Crew this week</h2><span className="text-xs text-muted">sends</span></div>
              <div className="flex gap-4">
                <span className="flex flex-col"><b className="font-display text-2xl font-black">{week.sessions}</b><span className="text-[11px] text-muted">sessions</span></span>
                <span className="flex flex-col"><b className="font-display text-2xl font-black">{week.sends}</b><span className="text-[11px] text-muted">sends</span></span>
                {week.minutes > 0 && <span className="flex flex-col"><b className="font-display text-2xl font-black">{Math.round(week.minutes / 60)}h</b><span className="text-[11px] text-muted">on the wall</span></span>}
              </div>
              <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
                {week.rows.map((r, i) => (
                  <li key={r.name + i} className="flex items-center gap-2.5 text-sm">
                    <span className="w-4 font-mono font-bold text-muted">{i + 1}</span>
                    <span className={cx('w-20 truncate', r.me && 'font-black')}>{r.name}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="anim-grow block h-full rounded-full" style={{ width: Math.round((r.sends / (week.rows[0]?.sends || 1)) * 100) + '%', background: r.me ? '#C6F432' : '#FF8A3D' }} /></span>
                    <span className="w-7 text-right font-mono font-bold">{r.sends}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {shown.map((p) => <PostCard key={p.id} post={p} meId={crew.me?.id} onReact={(k, on) => void react(p, k, on)} />)}
          {shown.length === 0 && friends.length > 0 && <Card><p className="m-0 text-sm text-muted">No posts yet. When your friends post a session, it shows up here.</p></Card>}
          {friends.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>Your crew:</span>
              {friends.slice(0, 8).map((f) => <a key={f.id} href={href('/crew/u/' + f.id)} aria-label={displayName(f)} className="no-underline"><CrewAvatar p={f} size={28} /></a>)}
            </div>
          )}
          <p className="m-0 text-center text-xs text-muted">Friends react with a tap. There are no comments.</p>
        </>
      )}
    </div>
  );
}
