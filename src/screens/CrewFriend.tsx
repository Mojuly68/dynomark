import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { useCrew } from '../crew/CrewProvider';
import { CrewAvatar, DemoNote, PostCard, displayName } from '../crew/ui';
import type { CrewPost, Person, ReactionKind } from '../crew/types';
import { Button, Empty, IconButton, Segmented, Sheet, cx } from '../components/ui';
import { useToast } from '../components/Toast';
import { navigate } from '../lib/router';
import { useStore } from '../store/Store';
import { sessionInfo } from '../lib/stats';
import { gradeIndex, gradeLabel } from '../lib/grades';
import { usePro, useUpsell } from '../lib/pro';

type Range = '30d' | '3m' | '1y' | 'all';
const DAYS: Record<Range, number> = { '30d': 30, '3m': 91, '1y': 365, all: 100000 };

interface Side { sessions: number; minutes: number; sends: number; top: number | null; flashRate: number | null; aps: number | null }

const REASONS = ['Offensive username', 'Harassment or bullying', 'Spam or fake account', 'Something else'];

export function CrewFriend({ id }: { id: string }) {
  const crew = useCrew();
  const toast = useToast();
  const { data } = useStore();
  const { isPro } = usePro();
  const upsell = useUpsell();
  const [person, setPerson] = useState<Person | null | undefined>(undefined);
  const [posts, setPosts] = useState<CrewPost[]>([]);
  const [range, setRange] = useState<Range>('30d');
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const api = crew?.api;

  useEffect(() => {
    if (!api) return;
    let alive = true;
    (async () => {
      const ps = await api.people();
      const p = ps.find((x) => x.id === id) ?? null;
      if (!alive) return;
      setPerson(p);
      if (p?.relation === 'friend') setPosts(await api.postsBy(id));
    })().catch(() => setPerson(null));
    return () => { alive = false; };
  }, [api, id]);

  const cmp = useMemo(() => {
    const since = Date.now() - DAYS[range] * 864e5;
    const mineSessions = data.sessions.filter((s) => new Date(s.startedAt).getTime() >= since && s.endedAt);
    const infos = mineSessions.map((s) => sessionInfo(s, data.climbs)).filter((i) => i.climbs.length);
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const mine: Side = {
      sessions: infos.length,
      minutes: sum(mineSessions.map((s) => (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 60000)),
      sends: sum(infos.map((i) => i.sends)),
      top: infos.reduce<number | null>((m, i) => (i.topB != null && (m == null || i.topB > m) ? i.topB : m), null),
      flashRate: sum(infos.map((i) => i.sends)) ? sum(infos.map((i) => i.flashes)) / sum(infos.map((i) => i.sends)) : null,
      aps: sum(infos.map((i) => i.sends)) ? sum(infos.map((i) => i.attempts)) / sum(infos.map((i) => i.sends)) : null,
    };
    const ps = posts.filter((p) => new Date(p.data.at).getTime() >= since).map((p) => p.data);
    const withA = ps.filter((p) => p.attempts != null);
    const theirs: Side = {
      sessions: ps.length,
      minutes: sum(ps.map((p) => p.durationMin ?? 0)),
      sends: sum(ps.map((p) => p.sends)),
      top: ps.reduce<number | null>((m, p) => { const g = p.topBoulder ? gradeIndex('boulder', p.topBoulder) : null; return g != null && (m == null || g > m) ? g : m; }, null),
      flashRate: sum(withA.map((p) => p.sends)) ? sum(withA.map((p) => p.flashes ?? 0)) / sum(withA.map((p) => p.sends)) : null,
      aps: sum(withA.map((p) => p.sends)) ? sum(withA.map((p) => p.attempts ?? 0)) / sum(withA.map((p) => p.sends)) : null,
    };
    const row = (l: string, a: number | null, b: number | null, fmt: (v: number) => string, low = false) => {
      const m = Math.max(a ?? 0, b ?? 0) || 1;
      const aw = a != null && b != null && (low ? a < b : a > b), bw = a != null && b != null && (low ? b < a : b > a);
      return { l, a: a == null ? '—' : fmt(a), b: b == null ? '—' : fmt(b), ap: ((a ?? 0) / m) * 100, bp: ((b ?? 0) / m) * 100, aw, bw };
    };
    return [
      row('Sessions', mine.sessions, theirs.sessions, String),
      row('Time on the wall', mine.minutes || null, theirs.minutes || null, (v) => (v / 60).toFixed(1) + 'h'),
      row('Sends', mine.sends, theirs.sends, String),
      row('Top boulder', mine.top, theirs.top, (v) => gradeLabel('boulder', v)),
      row('First-try rate', mine.flashRate, theirs.flashRate, (v) => Math.round(v * 100) + '%'),
      row('Attempts per send', mine.aps, theirs.aps, (v) => v.toFixed(1), true),
    ];
  }, [range, data.sessions, data.climbs, posts]);

  if (!crew || !api || crew.status !== 'ready') return <Empty title="Join Crew first" action={<Button variant="primary" onClick={() => navigate('/crew')}>Open Crew</Button>} />;
  if (person === undefined) return <div role="status" className="py-16 text-center text-sm text-muted">Loading…</div>;
  if (!person || person.relation !== 'friend') return <Empty title="Not in your crew" body="You can only see friends' sessions." action={<Button onClick={() => navigate('/crew')}>Back to Crew</Button>} />;

  const name = displayName(person);
  const muted = crew.local.muted.includes(person.id);
  const done = (msg: string) => { setMenu(false); setReporting(false); toast(msg); navigate('/crew'); };
  const react = async (post: CrewPost, kind: ReactionKind, on: boolean) => {
    setPosts((ps) => ps.map((p) => p.id !== post.id ? p : { ...p, mine: on ? [...p.mine, kind] : p.mine.filter((k) => k !== kind), counts: { ...p.counts, [kind]: Math.max(0, p.counts[kind] + (on ? 1 : -1)) } }));
    try { await api.react(post.id, kind, on); } catch { toast("That reaction didn't go through."); }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <IconButton label="Back to Crew" onClick={() => navigate('/crew')}><ArrowLeft size={20} aria-hidden="true" /></IconButton>
        <IconButton label={'Options for ' + name} onClick={() => setMenu(true)}><MoreHorizontal size={20} aria-hidden="true" /></IconButton>
      </header>
      {crew.mode === 'demo' && <DemoNote />}
      <section className="flex items-center gap-3.5">
        <CrewAvatar p={person} size={68} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <h1 className="m-0 truncate font-display text-[22px] font-black">{name}</h1>
          <span className="truncate font-mono text-[13px] text-muted">@{person.username}</span>
          {person.homeGym && <span className="truncate text-xs text-muted">Home gym {person.homeGym}</span>}
        </span>
      </section>

      <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 font-display text-lg font-black">You vs {name}</h2>
          <Segmented size="sm" label="Time range" value={range} onChange={(r) => (isPro || r === '30d' || r === '3m' ? setRange(r) : upsell({ title: 'Compare a whole year with Pro', body: '30 days and 3 months are free. Pro compares you and your friends over a year and all time. Founding members have Pro already.' }))} options={[{ value: '30d', label: '30D' }, { value: '3m', label: '3M' }, { value: '1y', label: '1Y' }, { value: 'all', label: 'All' }]} />
        </div>
        {(
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-xs font-bold"><span className="text-route">You</span><span className="text-boulder">{name}</span></div>
            {cmp.map((c) => (
              <div key={c.l} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between">
                  <b className={cx('font-mono text-[15px]', c.aw ? 'text-route' : 'text-ink')}>{c.a}</b>
                  <span className="text-xs text-muted">{c.l}</span>
                  <b className={cx('font-mono text-[15px]', c.bw ? 'text-boulder' : 'text-ink')}>{c.b}</b>
                </div>
                <div aria-hidden="true" className="grid h-2 grid-cols-2 gap-1">
                  <span className="flex justify-end overflow-hidden rounded bg-surface-2"><span className="rounded bg-route" style={{ width: c.ap + '%' }} /></span>
                  <span className="flex overflow-hidden rounded bg-surface-2"><span className="rounded bg-boulder" style={{ width: c.bp + '%' }} /></span>
                </div>
              </div>
            ))}
            <p className="m-0 text-xs leading-snug text-muted">Yours come from your own log; {name}'s from the sessions they posted. First-try rate and attempts per send compare fairly across levels.</p>
          </div>
        )}
      </section>

      <h2 className="m-0 font-display text-lg font-black">{name}'s sessions</h2>
      {muted && <p className="m-0 text-[13px] text-muted">Hidden from your feed. <button type="button" className="font-semibold text-route underline" onClick={() => crew.setLocal((l) => ({ ...l, muted: l.muted.filter((x) => x !== person.id) }))}>Show again</button></p>}
      {posts.length === 0 && <p className="m-0 text-sm text-muted">No posts yet.</p>}
      {posts.slice(0, 20).map((p) => <PostCard key={p.id} post={p} meId={crew.me?.id} onReact={(k, on) => void react(p, k, on)} />)}

      <Sheet open={menu && !reporting} onClose={() => setMenu(false)} title={name}>
        <Button variant="ghost" className="justify-start" onClick={() => { crew.setLocal((l) => ({ ...l, muted: muted ? l.muted.filter((x) => x !== person.id) : [...l.muted, person.id] })); setMenu(false); toast(muted ? name + "'s posts are back in your feed" : name + "'s posts are hidden from your feed"); }}>{muted ? 'Show ' + name + "'s posts in my feed" : 'Hide ' + name + "'s posts from my feed"}</Button>
        <Button variant="ghost" className="justify-start" onClick={async () => { await api.remove(person.id); done(name + ' was removed from your crew'); }}>Remove from Crew</Button>
        <Button variant="danger" className="justify-start" onClick={() => setReporting(true)}>Block and report @{person.username}</Button>
        <p className="m-0 text-xs text-muted">Removing or blocking doesn't notify {name}.</p>
      </Sheet>
      <Sheet open={reporting} onClose={() => { setReporting(false); setMenu(false); }} title={'Block @' + person.username}>
        <p className="m-0 text-sm text-muted">Blocking ends the friendship, and you stop seeing each other in search. Tell us why (optional):</p>
        {REASONS.map((r) => (
          <Button key={r} variant="ghost" className="justify-start" onClick={async () => { await api.block(person.id); await api.report(person.id, r).catch(() => undefined); done('@' + person.username + ' is blocked and reported'); }}>{r}</Button>
        ))}
        <Button variant="danger" onClick={async () => { await api.block(person.id); done('@' + person.username + ' is blocked'); }}>Block without reporting</Button>
      </Sheet>
    </div>
  );
}
