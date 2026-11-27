import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Users } from 'lucide-react';
import { useCrew } from './CrewProvider';
import { buildPost, SHARE_FIELDS, type ShareField } from './local';
import { PostCard } from './ui';
import { Button, Sheet, Toggle } from '../components/ui';
import { useToast } from '../components/Toast';
import { useStore } from '../store/Store';
import { href } from '../lib/router';
import type { CrewPost } from './types';

/** Recently finished sessions get the "Post to your crew?" sheet on their own (mode "ask") or are posted (mode "auto"). */
const FRESH_MS = 15 * 60 * 1000;

export function PostToCrew({ sessionId }: { sessionId: string }) {
  const crew = useCrew();
  const toast = useToast();
  const { data, gymById } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<Record<ShareField, boolean> | null>(null);
  const autoDone = useRef(false);

  const session = data.sessions.find((s) => s.id === sessionId);
  const ready = !!crew && crew.status === 'ready' && !!crew.me && !!crew.api && crew.local.onboarded;
  const postedId = crew?.local.posted[sessionId];
  // Sample data never goes to the real Crew server.
  const allowed = !!session && !!session.endedAt && (crew?.mode === 'demo' || (!session.isDemo && !data.user.isDemo));
  const fields = share ?? crew?.local.share ?? null;
  const post = useMemo(() => (fields ? buildPost(data, sessionId, fields, (id) => gymById(id)?.name ?? 'Gym') : null), [data, sessionId, fields, gymById]);

  const publish = async (silent = false) => {
    if (!crew?.api || !post) return;
    setBusy(true);
    try {
      const id = await crew.api.publish(sessionId, post);
      crew.setLocal((l) => ({ ...l, posted: { ...l.posted, [sessionId]: id }, skipped: l.skipped.filter((x) => x !== sessionId) }));
      setOpen(false);
      toast(silent ? 'Posted to your crew automatically' : 'Posted to your crew');
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't post. Try again.");
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (autoDone.current || !ready || !allowed || postedId || !session?.endedAt || !post) return;
    if (crew!.local.skipped.includes(sessionId)) return;
    if (Date.now() - new Date(session.endedAt).getTime() > FRESH_MS) return;
    autoDone.current = true;
    if (crew!.local.postMode === 'auto') void publish(true);
    else if (crew!.local.postMode === 'ask') setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, allowed, postedId, session?.endedAt, post]);

  if (!crew || !allowed) return null;
  if (crew.status !== 'ready' || !crew.local.onboarded) {
    if (crew.status !== 'signed-out') return null;
    return (
      <a href={href('/crew')} className="flex min-h-14 items-center gap-3 rounded-[18px] border border-line bg-surface px-4 text-ink no-underline">
        <Users size={20} className="text-route" aria-hidden="true" />
        <span className="flex-1 text-[15px] font-semibold">Share sessions with your crew</span>
        <span className="text-[13px] text-route">Join Crew</span>
      </a>
    );
  }

  if (postedId) {
    return (
      <div className="flex min-h-14 items-center gap-3 rounded-[18px] border border-accent/40 bg-accent/10 px-4">
        <Check size={20} className="text-route" aria-hidden="true" />
        <span className="flex-1 text-[15px] font-semibold">Posted to your crew</span>
        <Button size="sm" variant="ghost" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await crew.api!.unpublish(postedId); crew.setLocal((l) => { const p = { ...l.posted }; delete p[sessionId]; return { ...l, posted: p, skipped: [...l.skipped, sessionId] }; }); toast('Removed from Crew'); }
          catch { toast("Couldn't remove it. Try again."); }
          finally { setBusy(false); }
        }}>Remove</Button>
      </div>
    );
  }

  const preview: CrewPost | null = post && crew.me ? { id: 'preview', author: crew.me, createdAt: new Date().toISOString(), data: post, counts: { allez: 0, send: 0, crusher: 0, clean: 0, respect: 0 }, mine: [] } : null;
  const skip = () => { crew.setLocal((l) => ({ ...l, skipped: l.skipped.includes(sessionId) ? l.skipped : [...l.skipped, sessionId] })); setOpen(false); };

  return (
    <>
      <Button variant="secondary" size="lg" onClick={() => { setShare(crew.local.share); setOpen(true); }} disabled={!post}><Users size={20} aria-hidden="true" />Post to Crew</Button>
      <Sheet open={open} onClose={skip} title="Post to your crew?" footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={skip}>Keep private</Button>
          <Button variant="primary" className="flex-1" disabled={busy || !post} onClick={() => void publish()}>{busy ? 'Posting…' : 'Post to Crew'}</Button>
        </div>
      }>
        <p className="m-0 text-sm text-muted">Your friends see this. Only what's switched on is shared.</p>
        {preview && <PostCard post={preview} meId={crew.me?.id} />}
        <div className="flex flex-col overflow-hidden rounded-[18px] border border-line bg-bg">
          {SHARE_FIELDS.map((f, i) => (
            <div key={f.id} className={'flex min-h-[52px] items-center gap-3 px-3.5 ' + (i ? 'border-t border-surface-2' : '')}>
              <span className="flex-1 text-[15px] font-semibold">{f.label}</span>
              <Toggle label={f.label} checked={!!fields?.[f.id]} onChange={(v) => setShare({ ...(fields ?? crew.local.share), [f.id]: v })} />
            </div>
          ))}
        </div>
        <p className="m-0 text-xs text-muted">Notes, body weight and photos are never shared. You can remove a post anytime.</p>
      </Sheet>
    </>
  );
}
