import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useCrew } from '../crew/CrewProvider';
import { CrewAvatar, DemoNote } from '../crew/ui';
import { SHARE_FIELDS } from '../crew/local';
import type { CrewProfile } from '../crew/types';
import { PostModePicker } from './Crew';
import { Button, Card, Empty, H1, IconButton, Label, Sheet, Toggle, inputCls } from '../components/ui';
import { useToast } from '../components/Toast';
import { navigate } from '../lib/router';

export function CrewSettings() {
  const crew = useCrew();
  const toast = useToast();
  const [blocked, setBlocked] = useState<CrewProfile[]>([]);
  const [first, setFirst] = useState(crew?.me?.firstName ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const api = crew?.api;
  useEffect(() => { if (api && crew?.status === 'ready') api.blocked().then(setBlocked).catch(() => undefined); }, [api, crew?.status]);

  if (!crew || !api || crew.status !== 'ready' || !crew.me) return <Empty title="Join Crew first" action={<Button variant="primary" onClick={() => navigate('/crew')}>Open Crew</Button>} />;
  const me = crew.me;
  const L = crew.local;

  const signOut = async () => { await api.signOut(); crew.forget(); toast('Signed out of Crew'); navigate('/'); };
  const del = async () => {
    setBusy(true);
    try { await api.deleteAccount(); crew.forget(); toast('Your Crew account is deleted'); navigate('/'); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete right now. Try again."); }
    finally { setBusy(false); setConfirmDelete(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <IconButton label="Back to Crew" onClick={() => navigate('/crew')}><ArrowLeft size={20} aria-hidden="true" /></IconButton>
        <H1>Sharing &amp; privacy</H1>
      </header>
      {crew.mode === 'demo' && <DemoNote />}

      <Card className="flex items-center gap-3">
        <CrewAvatar p={me} size={48} me />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="truncate font-mono text-[15px]">@{me.username}</b>
          <span className="text-xs text-muted">{crew.mode === 'demo' ? 'Demo account' : 'Signed in with Apple'}</span>
        </span>
      </Card>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="crew-first-edit" className="text-[13px] text-muted">First name friends see (optional)</label>
        <input id="crew-first-edit" value={first} onChange={(e) => setFirst(e.target.value)} onBlur={() => { if ((first.trim() || null) !== (me.firstName ?? null)) api.updateProfile({ firstName: first.trim() || null }).then(() => crew.refresh()).catch(() => toast("Couldn't save the name")); }} placeholder="Enter name" maxLength={30} autoComplete="given-name" className={inputCls} />
      </div>

      <section className="flex flex-col gap-2">
        <Label>After each session</Label>
        <PostModePicker value={L.postMode} onChange={(m) => crew.setLocal((l) => ({ ...l, postMode: m }))} />
      </section>

      <section className="flex flex-col gap-2">
        <Label>What friends can see</Label>
        <div className="flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface">
          {SHARE_FIELDS.map((f, i) => (
            <div key={f.id} className={'flex min-h-[54px] items-center gap-3 px-3.5 ' + (i ? 'border-t border-surface-2' : '')}>
              <span className="flex flex-1 flex-col"><span className="text-[15px] font-semibold">{f.label}</span><span className="text-xs text-muted">{f.note}</span></span>
              <Toggle label={f.label} checked={L.share[f.id]} onChange={(v) => crew.setLocal((l) => ({ ...l, share: { ...l.share, [f.id]: v } }))} />
            </div>
          ))}
        </div>
        <p className="m-0 text-xs leading-relaxed text-muted">Always shared with a post: the date, how many climbs and sends. Never shared: notes, body weight, height, photos and the rest of your log, which stay on this phone.</p>
      </section>

      {blocked.length > 0 && (
        <section className="flex flex-col gap-2">
          <Label>Blocked climbers</Label>
          {blocked.map((b) => (
            <div key={b.id} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5">
              <b className="min-w-0 flex-1 truncate font-mono text-sm">@{b.username}</b>
              <Button size="sm" variant="ghost" onClick={async () => { await api.unblock(b.id); setBlocked((xs) => xs.filter((x) => x.id !== b.id)); toast('@' + b.username + ' is unblocked'); }}>Unblock</Button>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <Button variant="ghost" onClick={signOut}>Sign out of Crew</Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete Crew account</Button>
        <p className="m-0 text-center text-xs leading-relaxed text-muted">Deleting removes your username, posts, reactions and friends from the Crew server. Your climbing log on this phone isn't touched.</p>
      </section>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete your Crew account?" footer={
        <div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>Keep it</Button><Button variant="danger" className="flex-1" disabled={busy} onClick={del}>{busy ? 'Deleting…' : 'Delete for good'}</Button></div>
      }>
        <p className="m-0 text-sm leading-relaxed text-muted">@{me.username}, your posts, reactions and friendships are deleted from the server. This can't be undone. Your climbing log stays on this phone.</p>
      </Sheet>
    </div>
  );
}
