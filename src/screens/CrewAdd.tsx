import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Share2, X } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { useCrew } from '../crew/CrewProvider';
import { CrewAvatar, DemoNote, displayName } from '../crew/ui';
import type { Person } from '../crew/types';
import { Button, Empty, H1, IconButton, Label, cx } from '../components/ui';
import { useToast } from '../components/Toast';
import { navigate } from '../lib/router';
import { isNative } from '../lib/native';

/** Public page that tells a friend how to get the app and add you. Universal links (open straight in the app) come later. */
export const inviteUrl = (username: string) => 'https://studio-vektor.com/dynomark/c/?u=' + encodeURIComponent(username);

function Qr({ text, size = 132 }: { text: string; size?: number }) {
  const cells = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    const out: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) out.push(`M${c} ${r}h1v1h-1z`);
    return { n, d: out.join('') };
  }, [text]);
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`} role="img" aria-label="Your invite QR code" className="shrink-0 rounded-[14px] bg-white" shapeRendering="crispEdges">
      <path d={cells.d} fill="#111214" />
    </svg>
  );
}

export function CrewAdd({ prefill }: { prefill?: string | null }) {
  const crew = useCrew();
  const toast = useToast();
  const [q, setQ] = useState(prefill ? prefill.replace(/^@/, '') : '');
  const [results, setResults] = useState<Person[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const api = crew?.api;

  const loadPeople = useCallback(async () => { if (api) setPeople(await api.people()); }, [api]);
  useEffect(() => { void loadPeople(); }, [loadPeople]);
  useEffect(() => {
    if (!api) return;
    const t = setTimeout(() => { api.search(q).then(setResults).catch(() => setResults([])); }, 250);
    return () => clearTimeout(t);
  }, [q, api]);

  if (!crew || crew.status !== 'ready' || !crew.me || !api) return <Empty title="Join Crew first" body="Sign in to Crew to add friends." action={<Button variant="primary" onClick={() => navigate('/crew')}>Open Crew</Button>} />;
  const me = crew.me;
  const link = inviteUrl(me.username);

  const share = async () => {
    const text = 'Join my climbing crew on DYNOMARK: I\'m @' + me.username;
    try {
      if (isNative()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: 'DYNOMARK Crew', text, url: link });
      } else if (navigator.share) await navigator.share({ title: 'DYNOMARK Crew', text, url: link });
      else { await navigator.clipboard.writeText(text + ' ' + link); toast('Invite link copied'); }
    } catch { /* share sheet closed */ }
  };

  const act = async (id: string, f: () => Promise<void>, msg: string) => {
    setBusy(id);
    try { await f(); toast(msg); await loadPeople(); setResults(await api.search(q)); } catch (e) { toast(e instanceof Error ? e.message : 'That didn\'t work. Try again.'); }
    finally { setBusy(null); }
  };

  const incoming = people.filter((p) => p.relation === 'incoming');
  const outgoing = people.filter((p) => p.relation === 'outgoing');
  const t = q.trim().replace(/^@/, '');

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <IconButton label="Back to Crew" onClick={() => navigate('/crew')}><ArrowLeft size={20} aria-hidden="true" /></IconButton>
        <H1>Add friends</H1>
      </header>
      {crew.mode === 'demo' && <DemoNote />}

      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
        <div className="flex items-center gap-4">
          <Qr text={link} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <b className="text-[17px]">Scan at the gym</b>
            <span className="text-[13px] leading-snug text-muted">A friend points their camera here, gets the app and adds you.</span>
            <span className="truncate font-mono text-[13px] font-bold">@{me.username}</span>
          </div>
        </div>
        <Button variant="primary" onClick={share}><Share2 size={18} aria-hidden="true" />Share invite link</Button>
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="crew-search"><Label>Find by username</Label></label>
        <div className="flex min-h-[50px] items-center gap-2 rounded-[14px] border border-line bg-surface px-3">
          <Search size={18} className="text-muted" aria-hidden="true" />
          <input id="crew-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="@username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" className="h-11 min-w-0 flex-1 border-0 bg-transparent font-mono text-base text-ink outline-none" />
        </div>
        {results.map((p) => <PersonRow key={p.id} p={p} busy={busy === p.id} onAdd={() => act(p.id, () => api.request(p.id), p.relation === 'incoming' ? 'Added to your crew' : 'Request sent to @' + p.username)} />)}
        {t.length >= 2 && results.length === 0 && <p className="m-0 text-[13px] text-muted">No climber called @{t}. Usernames are exact, or send an invite link.</p>}
      </section>

      {incoming.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="crew-req">
          <h2 id="crew-req" className="m-0"><Label>Requests · {incoming.length}</Label></h2>
          {incoming.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5">
              <CrewAvatar p={p} />
              <span className="flex min-w-0 flex-1 flex-col"><b className="truncate font-mono text-sm">@{p.username}</b>{p.homeGym && <span className="truncate text-xs text-muted">{p.homeGym}</span>}</span>
              <IconButton label={'Decline @' + p.username} disabled={busy === p.id} onClick={() => act(p.id, () => api.remove(p.id), 'Request declined')}><X size={16} aria-hidden="true" /></IconButton>
              <Button size="sm" variant="primary" disabled={busy === p.id} onClick={() => act(p.id, () => api.accept(p.id), displayName(p) + ' is in your crew')}>Accept</Button>
            </div>
          ))}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="crew-sent">
          <h2 id="crew-sent" className="m-0"><Label>Sent · {outgoing.length}</Label></h2>
          {outgoing.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5">
              <CrewAvatar p={p} />
              <b className="min-w-0 flex-1 truncate font-mono text-sm">@{p.username}</b>
              <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={() => act(p.id, () => api.remove(p.id), 'Request cancelled')}>Cancel</Button>
            </div>
          ))}
        </section>
      )}

      <p className="m-0 rounded-[14px] bg-surface px-3.5 py-3 text-xs leading-relaxed text-muted">DYNOMARK never uploads your contacts. Invite people yourself with a link, the code or their username. Nobody sees your sessions until you're friends.</p>
    </div>
  );
}

function PersonRow({ p, busy, onAdd }: { p: Person; busy: boolean; onAdd: () => void }) {
  const label = p.relation === 'self' ? 'You' : p.relation === 'friend' ? 'In your crew' : p.relation === 'outgoing' ? 'Requested' : p.relation === 'incoming' ? 'Accept' : 'Add';
  const can = p.relation === 'none' || p.relation === 'incoming';
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3 py-2.5">
      <CrewAvatar p={p} />
      <span className="flex min-w-0 flex-1 flex-col"><b className="truncate font-mono text-sm">@{p.username}</b>{p.homeGym && <span className="truncate text-xs text-muted">{p.homeGym}</span>}</span>
      <Button size="sm" variant={can ? 'primary' : 'ghost'} disabled={!can || busy} onClick={onAdd} className={cx(!can && 'text-muted')}>{label}</Button>
    </div>
  );
}
