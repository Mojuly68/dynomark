import { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { useStore } from '../store/Store';
import { useToast } from '../components/Toast';
import { Logo } from '../components/Logo';
import { Button, IconButton, cx } from '../components/ui';
import { navigate } from '../lib/router';
import { haptic } from '../lib/native';
import { PLANS, PRO_PERKS, PRO_PREVIEW, grantPro, purchase, restore, usePro } from '../lib/pro';
import type { ProPlan } from '../types';

const COMPARE: [string, boolean][] = [
  ['Unlimited routes and boulders, warm-up plans, projects', true],
  ['Training log, rest timer, hangboard calculator', true],
  ['CSV export of everything you log', true],
  ['Progress for the last 7 and 30 days', true],
  ['Progress over 3 months to all time, with trend lines', false],
  ['Monthly reports and Year in climbing', false],
  ['Gym comparisons and grade adjustments', false],
  ['Hangboard % body-weight history', false],
  ['Every share-card style', false],
];

/** The paywall. Plans and copy follow the canvas design; purchases go through lib/pro.tsx. */
export function Pro() {
  const { update } = useStore();
  const toast = useToast();
  const { isPro, pro } = usePro();
  const [plan, setPlan] = useState<ProPlan>('year');
  const [status, setStatus] = useState('');
  const [compare, setCompare] = useState(false);
  const cur = PLANS.find((p) => p.id === plan)!;
  const back = () => (history.length > 1 ? history.back() : navigate('/'));

  const buy = async () => {
    const r = await purchase(plan);
    if (r === 'preview') {
      update((d) => grantPro(d, plan, 'preview'));
      void haptic('success');
      toast('Pro preview on. No payment was taken.');
      back();
    } else setStatus('Purchases open once DYNOMARK is in the App Store and Google Play.');
  };
  const doRestore = async () => {
    const r = await restore();
    setStatus(r === 'none' ? 'No earlier purchase found. (Store purchases connect when DYNOMARK is in the stores.)' : 'Restore works once DYNOMARK is in the App Store and Google Play.');
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <IconButton label="Close" onClick={back}><X size={18} aria-hidden="true" /></IconButton>
        <button type="button" onClick={doRestore} className="h-11 px-1.5 text-sm font-medium text-muted hover:text-ink">Restore purchases</button>
      </div>

      <div className="flex items-center gap-2.5">
        <Logo height={22} className="text-ink" />
        <span className="-skew-x-12 rounded-lg bg-accent px-2 py-0.5 text-[13px] font-black tracking-[0.08em] text-accent-ink">PRO</span>
      </div>
      <h1 className="m-0 font-display text-[32px] font-black leading-[1.05] tracking-tight">Climb with the<br /><span className="text-route">full picture.</span></h1>

      {isPro ? (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <b>You have Pro{pro?.source === 'preview' ? ' (testing preview)' : ''}.</b> Everything below is unlocked. Manage it in Profile.
        </div>
      ) : null}

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {PRO_PERKS.map((p) => (
          <li key={p} className="flex items-center gap-3 text-[15px]">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent/15 text-route"><Check size={14} strokeWidth={3} aria-hidden="true" /></span>{p}
          </li>
        ))}
      </ul>

      {!isPro && (
        <>
          <div role="radiogroup" aria-label="Choose a plan" className="mt-1 flex flex-col gap-2.5">
            {PLANS.map((o) => {
              const on = plan === o.id;
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => { setPlan(o.id); setStatus(''); }}
                  className={cx('relative flex min-h-16 items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left', on ? 'border-accent bg-accent/10' : 'border-line bg-surface')}>
                  <span aria-hidden="true" className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-accent' : 'border-muted')}>{on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}</span>
                  <span className="flex flex-1 flex-col"><b className="text-base">{o.name}</b><span className="text-xs text-muted">{o.note}</span></span>
                  <span className="flex flex-col items-end"><b className="text-base">{o.price}</b><span className="text-xs text-muted">{o.per}</span></span>
                  {o.badge && <span className="absolute -top-2.5 right-3.5 rounded-full bg-orange px-2 py-px text-[11px] font-extrabold text-accent-ink">{o.badge}</span>}
                </button>
              );
            })}
          </div>

          <Button variant="primary" size="lg" onClick={buy}>{cur.cta}</Button>
          <p className="m-0 -mt-1 text-center text-xs leading-relaxed text-muted">{cur.fine}</p>
          {PRO_PREVIEW && <p className="m-0 text-center text-xs text-boulder">Testing build: this turns on a free Pro preview. No payment is taken.</p>}
        </>
      )}

      {status && <p role="status" className="m-0 rounded-xl border border-line bg-surface p-3 text-center text-[13px]">{status}</p>}

      <button type="button" aria-expanded={compare} onClick={() => setCompare(!compare)} className="flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-muted">
        Compare Free and Pro <ChevronDown size={16} className={cx('transition-transform', compare && 'rotate-180')} aria-hidden="true" />
      </button>
      {compare && (
        <ul className="anim-fade m-0 flex list-none flex-col rounded-2xl border border-line bg-surface p-0">
          <li className="grid grid-cols-[minmax(0,1fr)_48px_48px] px-3.5 py-2 text-[11px] font-extrabold tracking-[0.08em] text-muted"><span /><span className="text-center">FREE</span><span className="text-center text-route">PRO</span></li>
          {COMPARE.map(([label, free]) => (
            <li key={label} className="grid min-h-11 grid-cols-[minmax(0,1fr)_48px_48px] items-center border-t border-surface-2 px-3.5 text-sm">
              <span className="py-2">{label}</span>
              <span className="text-center font-bold">{free ? <Check size={16} className="mx-auto" aria-label="Included" /> : <span className="text-muted" aria-label="Not included">—</span>}</span>
              <span className="text-center font-bold text-route"><Check size={16} className="mx-auto" aria-label="Included" /></span>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-center text-xs text-muted">Logging and CSV export always stay free. Your log is yours.</p>

      <p className="m-0 flex justify-center gap-5 text-[13px]">
        <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener noreferrer" className="text-route">Terms of use (EULA)</a>
        <a href="https://studio-vektor.com/send/privacy.html" target="_blank" rel="noopener noreferrer" className="text-route">Privacy policy</a>
      </p>
    </div>
  );
}
