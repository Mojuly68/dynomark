import { useId, useState } from 'react';
import { Lock } from 'lucide-react';
import { useStore } from '../store/Store';
import { useToast } from './Toast';
import { Button, Card, H2, cx, inputCls } from './ui';
import { totals } from '../lib/stats';
import {
  EXPERIENCE, GENDERS, HEIGHT_CM, WEIGHT_KG,
  cmToFtIn, displayToKg, ftInToCm, kgToDisplay, suggestExperience,
} from '../lib/profile';
import type { Experience, Gender, User } from '../types';

const num = (s: string) => parseFloat(s.replace(',', '.'));

/** Body details and experience level. Remount with key={units} so the inputs show the new units. */
export function AboutYou() {
  const { data, update } = useStore();
  const toast = useToast();
  const u = data.user;
  const unit = data.settings.units;
  const metric = unit === 'kg';
  const ids = { w: useId(), h: useId(), ft: useId(), inch: useId(), g: useId(), gt: useId() };
  const set = (patch: Partial<User>) => update((d) => ({ ...d, user: { ...d.user, ...patch } }));

  const fi = u.heightCm != null ? cmToFtIn(u.heightCm) : null;
  const [w, setW] = useState(u.weightKg != null ? String(kgToDisplay(u.weightKg, unit)) : '');
  const [cm, setCm] = useState(u.heightCm != null ? String(Math.round(u.heightCm)) : '');
  const [ft, setFt] = useState(fi ? String(fi.ft) : '');
  const [inch, setInch] = useState(fi ? String(fi.inch) : '');
  const [gText, setGText] = useState(u.genderText ?? '');

  const t = totals(data.climbs, data.sessions.length);
  const suggested = suggestExperience(t.topBoulder, t.topRoute);
  const suggestedLabel = EXPERIENCE.find((e) => e.value === suggested)?.label;

  const commitWeight = () => {
    if (!w.trim()) { if (u.weightKg != null) set({ weightKg: undefined }); return; }
    const kg = displayToKg(num(w), unit);
    if (!Number.isFinite(kg) || kg < WEIGHT_KG.min || kg > WEIGHT_KG.max) {
      toast('That weight looks off. Check the number.');
      setW(u.weightKg != null ? String(kgToDisplay(u.weightKg, unit)) : '');
      return;
    }
    set({ weightKg: kg });
  };
  const commitHeight = (value: number | null) => {
    if (value == null) { if (u.heightCm != null) set({ heightCm: undefined }); return; }
    if (!Number.isFinite(value) || value < HEIGHT_CM.min || value > HEIGHT_CM.max) {
      toast('That height looks off. Check the number.');
      setCm(u.heightCm != null ? String(Math.round(u.heightCm)) : '');
      setFt(fi ? String(fi.ft) : '');
      setInch(fi ? String(fi.inch) : '');
      return;
    }
    set({ heightCm: value });
  };
  const commitCm = () => commitHeight(cm.trim() ? num(cm) : null);
  const commitFtIn = () => commitHeight(!ft.trim() && !inch.trim() ? null : ftInToCm(num(ft || '0'), num(inch || '0')));

  const anySet = u.weightKg != null || u.heightCm != null || u.gender != null || u.experience != null;
  const clearAll = () => {
    set({ weightKg: undefined, heightCm: undefined, gender: undefined, genderText: undefined, experience: undefined });
    setW(''); setCm(''); setFt(''); setInch(''); setGText('');
    toast('Details cleared');
  };

  return (
    <Card className="flex flex-col gap-4">
      <H2 right={<span className="inline-flex items-center gap-1.5 text-xs text-muted"><Lock size={13} aria-hidden="true" />On this device only</span>}>About you</H2>
      <p className="m-0 -mt-2 text-sm text-muted">All optional. Used only for your own stats, never shared.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.w} className="text-[13px] text-muted">Weight</label>
          <div className="relative">
            <input id={ids.w} className={cx(inputCls, 'pr-12')} inputMode="decimal" autoComplete="off" placeholder={metric ? 'e.g. 68' : 'e.g. 150'} value={w} onChange={(e) => setW(e.target.value)} onBlur={commitWeight} />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={ids.h} className="text-[13px] text-muted">Height</span>
          {metric ? (
            <div className="relative">
              <input aria-labelledby={ids.h} className={cx(inputCls, 'pr-12')} inputMode="decimal" autoComplete="off" placeholder="e.g. 175" value={cm} onChange={(e) => setCm(e.target.value)} onBlur={commitCm} />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">cm</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby={ids.h}>
              <div className="relative">
                <input id={ids.ft} aria-label="Feet" className={cx(inputCls, 'pr-10')} inputMode="numeric" autoComplete="off" placeholder="5" value={ft} onChange={(e) => setFt(e.target.value)} onBlur={commitFtIn} />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">ft</span>
              </div>
              <div className="relative">
                <input id={ids.inch} aria-label="Inches" className={cx(inputCls, 'pr-10')} inputMode="numeric" autoComplete="off" placeholder="9" value={inch} onChange={(e) => setInch(e.target.value)} onBlur={commitFtIn} />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">in</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={ids.g} className="text-[13px] text-muted">Gender</label>
          <select id={ids.g} className={inputCls} value={u.gender ?? ''} onChange={(e) => {
            const g = (e.target.value || undefined) as Gender | undefined;
            set({ gender: g, genderText: g === 'self' ? gText.trim() || undefined : undefined });
          }}>
            <option value="">Not set</option>
            {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          {u.gender === 'self' && (
            <input aria-label="Your gender, in your words" className={inputCls} maxLength={40} placeholder="In your words" value={gText} onChange={(e) => setGText(e.target.value)} onBlur={() => set({ genderText: gText.trim() || undefined })} />
          )}
        </div>
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-[13px] text-muted">Experience level</legend>
        <div className="grid gap-2 sm:grid-cols-5">
          {EXPERIENCE.map((e) => {
            const on = u.experience === e.value;
            return (
              <label key={e.value} className={cx('flex min-h-14 cursor-pointer flex-col justify-center gap-0.5 rounded-[14px] border px-3.5 py-2.5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--c-focus)]', on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface hover:border-muted')}>
                <input type="radio" name="experience" value={e.value} checked={on} onChange={() => set({ experience: e.value as Experience })} className="sr-only-input" />
                <span className="text-sm font-bold">{e.label}</span>
                <span className={cx('text-xs', on ? 'text-accent-ink/75' : 'text-muted')}>{e.hint}</span>
              </label>
            );
          })}
        </div>
        {suggested && suggested !== u.experience && (
          <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            Your logged sends point to {suggestedLabel}.
            <button type="button" className="font-semibold text-route" onClick={() => set({ experience: suggested })}>Use {suggestedLabel}</button>
          </p>
        )}
      </fieldset>

      {anySet && <div><Button size="sm" variant="ghost" onClick={clearAll}>Clear these details</Button></div>}
    </Card>
  );
}
