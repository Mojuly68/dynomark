import { useState, type ChangeEvent } from 'react';
import { Camera, CheckCircle2, Download, RotateCcw, Share, Smartphone, SquarePlus, Sparkles } from 'lucide-react';
import { useStore } from '../store/Store';
import { useToast } from '../components/Toast';
import { Button, Card, DemoBadge, H1, H2, Segmented, Sheet, inputCls } from '../components/ui';
import { climbsCsv, downloadText } from '../lib/csv';
import { createDemoData, createEmptyData } from '../data/demo';
import { streaks, totals } from '../lib/stats';
import { gradeLabel } from '../lib/grades';
import { fmtDayYear } from '../lib/dates';
import { navigate } from '../lib/router';
import { useInstall } from '../lib/pwa';
import { isNative } from '../lib/native';
import { squarePhoto } from '../lib/image';
import { Avatar } from '../components/Avatar';
import { AboutYou } from '../components/AboutYou';
import { ALL_FREE, PLANS, PRO_PREVIEW, ProBadge, endPro, grantPro, manageSubscriptionUrl, usePro } from '../lib/pro';

export function Profile() {
  const { data, update, replace, gyms } = useStore();
  const toast = useToast();
  const [name, setName] = useState(data.user.name);
  const [confirm, setConfirm] = useState<'fresh' | 'demo' | null>(null);
  const t = totals(data.climbs, data.sessions.length);
  const st = streaks(data.sessions);
  const gymCount = new Set(data.sessions.map((s) => s.gymId)).size;

  const pickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const photo = await squarePhoto(file);
      update((d) => ({ ...d, user: { ...d.user, photo } }));
      toast('Photo updated');
    } catch {
      toast('Couldn’t read that image. Try a JPEG or PNG.');
    }
  };

  const exportCsv = () => {
    if (!data.climbs.length) { toast('Nothing to export yet'); return; }
    downloadText('dynomark-climbs-' + new Date().toISOString().slice(0, 10) + '.csv', climbsCsv(data, gyms));
    toast('Exported ' + data.climbs.length + ' climbs');
  };

  return (
    <div className="flex flex-col gap-5">
      <H1 sub={data.user.isDemo ? <span className="inline-flex items-center gap-2"><DemoBadge />Demo account</span> : 'Member since ' + fmtDayYear(data.user.createdAt)}>Profile</H1>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <label className="relative cursor-pointer rounded-full focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--c-focus)]">
                <Avatar user={{ name, photo: data.user.photo }} size={72} />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-ink text-bg" aria-hidden="true"><Camera size={14} /></span>
                <span className="sr-only">{data.user.photo ? 'Change profile photo' : 'Upload profile photo'}</span>
                <input type="file" accept="image/*" className="sr-only-input" onChange={pickPhoto} />
              </label>
              {data.user.photo && <button type="button" className="text-xs font-semibold text-muted hover:text-ink" onClick={() => { update((d) => ({ ...d, user: { ...d.user, photo: undefined } })); toast('Photo removed'); }}>Remove</button>}
            </div>
            <label className="flex flex-1 flex-col gap-1.5 text-[13px] text-muted">Display name
              <input className={inputCls} value={name} maxLength={40} placeholder="Enter name" autoComplete="given-name" onChange={(e) => setName(e.target.value)} onBlur={() => update((d) => ({ ...d, user: { ...d.user, name: name.trim() } }))} />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[[String(data.sessions.length), 'sessions'], [String(gymCount), 'gyms'], [t.climbs.toLocaleString(), 'climbs'], [gradeLabel('boulder', t.topBoulder), 'top boulder'], [gradeLabel('route', t.topRoute), 'top route'], [st.longest + ' wk', 'longest streak']].map(([v, l]) => (
              <span key={l} className="flex flex-col rounded-[14px] bg-surface-2 px-1 py-2.5"><b className="font-display text-xl">{v}</b><span className="text-[11px] text-muted">{l}</span></span>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <H2>Settings</H2>
          <div className="flex min-h-11 items-center justify-between gap-3"><span>Appearance</span>
            <Segmented label="Appearance" value={data.settings.theme} onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, theme: v } }))} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3"><span className="flex flex-col"><span>Units</span><span className="text-xs text-muted">kg and cm, or lb and ft/in. Body weight and height convert; training weights are labels only.</span></span>
            <Segmented label="Units" value={data.settings.units} onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, units: v } }))} options={[{ value: 'kg', label: 'Metric' }, { value: 'lb', label: 'Imperial' }]} />
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3"><span className="flex flex-col"><span>Grade scales</span><span className="text-xs text-muted">YDS for routes, V-scale for boulders. Custom gym grades are allowed when logging.</span></span></div>
        </Card>
      </div>

      {!ALL_FREE && <ProCard />}

      <AboutYou key={data.settings.units} />

      <InstallCard />

      <Card className="flex flex-col gap-3">
        <H2>Your data</H2>
        <p className="m-0 text-sm text-muted">{isNative()
          ? 'Everything is saved in this app on this device. Nothing is sent anywhere, and there are no accounts or sync yet, so export a CSV now and then as a backup.'
          : 'Everything is saved in this browser on this device. Nothing is sent anywhere, and there are no accounts or sync yet. On iPhone, the Home Screen app keeps its own copy, separate from Safari.'}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCsv}><Download size={18} aria-hidden="true" />Export climbing history (CSV)</Button>
          <Button variant="ghost" onClick={() => navigate('/sessions')}>Session history</Button>
        </div>
        {data.user.isDemo ? (
          <div className="mt-1 flex flex-col gap-2 rounded-2xl border border-line bg-bg p-3.5">
            <span className="text-sm font-semibold">You’re looking at sample data</span>
            <span className="text-xs text-muted">The demo account has generated sessions across six gyms so the charts have something to show. None of it is real activity.</span>
            <Button variant="primary" onClick={() => setConfirm('fresh')}><Sparkles size={18} aria-hidden="true" />Start fresh with my own log</Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirm('demo')}><RotateCcw size={18} aria-hidden="true" />Load the demo account</Button>
        )}
        <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <a href="https://studio-vektor.com/send/privacy.html" target="_blank" rel="noopener noreferrer" className="text-route">Privacy policy</a>
          <a href="https://studio-vektor.com/send/support.html" target="_blank" rel="noopener noreferrer" className="text-route">Help and support</a>
        </p>
      </Card>

      <Sheet open={confirm === 'fresh'} onClose={() => setConfirm(null)} title="Clear sample data?" footer={<div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="primary" className="flex-1" onClick={() => { replace({ ...createEmptyData(name.trim()), settings: { ...createEmptyData().settings, theme: data.settings.theme, pro: data.settings.pro } }); setConfirm(null); toast('Fresh start. Log your first climb.'); navigate('/log'); }}>Clear and start</Button></div>}>
        <p className="m-0 text-sm text-muted">All demo sessions, climbs, projects and workouts will be removed from this device. You can load the demo again later.</p>
      </Sheet>
      <Sheet open={confirm === 'demo'} onClose={() => setConfirm(null)} title="Replace your data with the demo?" footer={<div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="danger" className="flex-1" onClick={() => { { const demo = createDemoData(); replace({ ...demo, settings: { ...demo.settings, pro: data.settings.pro } }); } setConfirm(null); toast('Demo account loaded'); navigate('/'); }}>Replace</Button></div>}>
        <p className="m-0 text-sm text-muted">Your {data.climbs.length} logged climbs will be deleted from this device and replaced with sample data. Export a CSV first if you want to keep them.</p>
      </Sheet>
    </div>
  );
}

function InstallCard() {
  const inst = useInstall();
  if (inst.installed) {
    return (
      <Card className="flex items-center gap-3">
        <CheckCircle2 size={22} className="shrink-0 text-route" aria-hidden="true" />
        <span className="text-sm">Running as an installed app. It opens full screen and works offline.</span>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-3">
      <H2>Install DYNOMARK</H2>
      <p className="m-0 text-sm text-muted">Add DYNOMARK to your Home Screen to open it full screen, like an app, and log climbs offline when the gym’s signal drops.</p>
      {inst.canPrompt ? (
        <div><Button variant="primary" onClick={inst.prompt}><Smartphone size={18} aria-hidden="true" />Install app</Button></div>
      ) : (
        <ol className="m-0 flex flex-col gap-2 pl-0 text-sm [list-style:none]">
          <li className="flex items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-xs font-bold">1</span><span>Open this page in Safari{inst.ios ? '' : ' on your iPhone'} and tap Share <Share size={15} className="inline align-[-2px]" aria-label="(the square with an arrow)" /></span></li>
          <li className="flex items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-xs font-bold">2</span><span>Choose Add to Home Screen <SquarePlus size={15} className="inline align-[-2px]" aria-hidden="true" /></span></li>
          <li className="flex items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 font-mono text-xs font-bold">3</span><span>Tap Add, then open DYNOMARK from your Home Screen</span></li>
        </ol>
      )}
    </Card>
  );
}

function ProCard() {
  const { update } = useStore();
  const toast = useToast();
  const { isPro, pro } = usePro();
  const planName = PLANS.find((p) => p.id === pro?.plan)?.name ?? '';
  return (
    <Card className="flex flex-col gap-3">
      <H2 right={isPro ? <ProBadge /> : undefined}>DYNOMARK Pro</H2>
      {isPro && pro ? (
        <>
          <p className="m-0 text-sm">
            {pro.source === 'founder'
              ? <>Founding member since {fmtDayYear(pro.since)}. You were here for 1.0, so Pro stays free for you. Thank you.</>
              : <>{planName} · since {fmtDayYear(pro.since)}{pro.source === 'preview' ? ' · testing preview, no payment' : ''}</>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate('/pro')}>What’s included</Button>
            {pro.source === 'store' && pro.plan !== 'life' && <a href={manageSubscriptionUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-route">Manage subscription</a>}
            {pro.source === 'preview' && <Button variant="ghost" onClick={() => { update(endPro); toast('Pro preview ended'); }}>End preview</Button>}
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-sm text-muted">You’re on the free plan: unlimited logging, warm-ups, projects, training and CSV export. Pro adds long-range progress, monthly and yearly reports, gym comparisons and hangboard history.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => navigate('/pro')}>See Pro plans</Button>
            {PRO_PREVIEW && <Button variant="ghost" onClick={() => { update((d) => grantPro(d, 'year', 'preview')); toast('Pro preview on. No payment was taken.'); }}>Preview Pro (testing)</Button>}
          </div>
        </>
      )}
    </Card>
  );
}
