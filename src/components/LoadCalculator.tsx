import { useId, useState } from 'react';
import { Scale } from 'lucide-react';
import { useStore } from '../store/Store';
import { Card, H2, Segmented, cx, inputCls } from './ui';
import { href } from '../lib/router';
import { addedForPct, fmtSigned, fromKg, pctBodyWeight, round1, toKg } from '../lib/load';

const PRESETS = [70, 80, 90, 100, 110, 120, 130];
const num = (s: string) => parseFloat(s.replace(',', '.'));

/** Hangboard load in both directions: added weight to % body weight, and target % to the weight to add or take off. */
export function LoadCalculator() {
  const { data } = useStore();
  const unit = data.settings.units;
  const profileKg = data.user.weightKg;
  const ids = { bw: useId(), add: useId(), pct: useId() };
  const [bw, setBw] = useState(profileKg != null ? String(round1(fromKg(profileKg, unit))) : '');
  const [mode, setMode] = useState<'pct' | 'load'>('pct');
  const [added, setAdded] = useState('10');
  const [target, setTarget] = useState('110');

  const bodyKg = bw.trim() ? toKg(num(bw), unit) : NaN;
  const okBody = Number.isFinite(bodyKg) && bodyKg >= 20 && bodyKg <= 250;
  const addedKg = toKg(num(added || '0'), unit);
  const pct = okBody && Number.isFinite(addedKg) && bodyKg + addedKg > 0 ? pctBodyWeight(bodyKg, addedKg) : null;
  const tPct = num(target);
  const need = okBody && Number.isFinite(tPct) && tPct > 0 && tPct <= 250 ? fromKg(addedForPct(bodyKg, tPct), unit) : null;

  return (
    <Card className="flex flex-col gap-3.5">
      <H2>Hangboard load</H2>
      <Segmented label="Calculate" value={mode} onChange={setMode} options={[{ value: 'pct', label: 'Weight → % body weight' }, { value: 'load', label: '% → weight to add' }]} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.bw} className="text-[13px] text-muted">Body weight</label>
          <div className="relative">
            <input id={ids.bw} className={cx(inputCls, 'pr-12')} inputMode="decimal" value={bw} onChange={(e) => setBw(e.target.value)} placeholder={unit === 'kg' ? 'e.g. 68' : 'e.g. 150'} />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
          </div>
          <span className="text-xs text-muted">{profileKg != null ? 'From your profile. Change it here for a quick what-if.' : <>Add your weight in <a href={href('/profile')} className="text-route">Profile</a> to fill this in.</>}</span>
        </div>

        {mode === 'pct' ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.add} className="text-[13px] text-muted">Added weight (negative if a pulley or band takes weight off)</label>
            <div className="relative">
              <input id={ids.add} className={cx(inputCls, 'pr-12')} inputMode="decimal" value={added} onChange={(e) => setAdded(e.target.value)} placeholder="0" />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.pct} className="text-[13px] text-muted">Target load</label>
            <div className="relative">
              <input id={ids.pct} className={cx(inputCls, 'pr-12')} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">% BW</span>
            </div>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Common targets">
              {PRESETS.map((p) => (
                <button key={p} type="button" aria-pressed={String(p) === target} onClick={() => setTarget(String(p))} className={cx('h-9 shrink-0 rounded-lg px-2.5 font-mono text-xs font-bold', String(p) === target ? 'bg-ink text-bg' : 'bg-surface-2 text-muted')}>{p}%</button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3.5" aria-live="polite">
        <Scale size={22} className="shrink-0 text-blue" aria-hidden="true" />
        {!okBody ? (
          <span className="text-sm text-muted">Enter your body weight to calculate.</span>
        ) : mode === 'pct' ? (
          pct == null ? <span className="text-sm text-muted">Check the added weight.</span> : (
            <span className="flex flex-col">
              <b className="font-display text-2xl">{Math.round(pct)}% body weight</b>
              <span className="text-xs text-muted">Total on the board: {round1(fromKg(bodyKg + addedKg, unit))} {unit}</span>
            </span>
          )
        ) : need == null ? <span className="text-sm text-muted">Pick a target between 1 and 250%.</span> : (
          <span className="flex flex-col">
            <b className="font-display text-2xl">{Math.abs(need) < 0.05 ? 'Body weight only' : need > 0 ? 'Add ' + fmtSigned(need).slice(1) + ' ' + unit : 'Take off ' + Math.abs(round1(need)) + ' ' + unit}</b>
            <span className="text-xs text-muted">{need < -0.05 ? 'With a pulley or band. ' : ''}Log it as {fmtSigned(need)} {unit} added weight.</span>
          </span>
        )}
      </div>
      <p className="m-0 text-xs text-muted">Percent of body weight lets you compare hangs as your weight changes. Keep the edge and grip the same between sessions.</p>
    </Card>
  );
}
