import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { ClimbType } from '../types';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className, tone = 'surface' }: { children: ReactNode; className?: string; tone?: 'surface' | 'raised' | 'outline' }) {
  return (
    <section className={cx('rounded-[20px] border border-line p-4', tone === 'surface' && 'bg-surface', tone === 'raised' && 'bg-surface-2', className)}>
      {children}
    </section>
  );
}

export function H1({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      {sub && <span className="text-[13px] text-muted">{sub}</span>}
      <h1 className="m-0 font-display text-[28px] font-extrabold leading-tight tracking-tight lg:text-[34px]">{children}</h1>
    </div>
  );
}

export function H2({ children, right, id }: { children: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="m-0 font-display text-[17px] font-extrabold">{children}</h2>
      {right}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{children}</p>;
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink';
export function Button({ variant = 'secondary', size = 'md', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-[transform,background-color] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'min-h-10 px-3 text-[13px]',
        size === 'md' && 'min-h-12 px-4 text-[15px]',
        size === 'lg' && 'min-h-14 px-5 font-display text-[17px] font-extrabold',
        variant === 'primary' && 'bg-accent text-accent-ink',
        variant === 'ink' && 'bg-ink text-bg',
        variant === 'secondary' && 'border border-line bg-surface-2 text-ink',
        variant === 'ghost' && 'border border-line bg-transparent text-ink',
        variant === 'danger' && 'border border-line bg-transparent text-danger',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button {...rest} aria-label={label} title={label} className={cx('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink transition active:scale-95 disabled:opacity-40', className)}>
      {children}
    </button>
  );
}

export interface Opt<T extends string> { value: T; label: ReactNode; }

/** Pill segmented control. aria-pressed buttons so screen readers announce state. */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'md', className }: { options: Opt<T>[]; value: T; onChange: (v: T) => void; label: string; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cx('inline-flex rounded-xl bg-surface-2 p-[3px]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('grow rounded-[9px] px-3 py-1 font-semibold leading-tight transition-colors', size === 'sm' ? 'min-h-8 text-xs' : 'min-h-9 text-[13px]', value === o.value ? 'bg-ink text-bg' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ selected, onClick, children, className, accent }: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string; accent?: ClimbType }) {
  const on = accent === 'boulder' ? 'border-orange bg-orange text-accent-ink' : accent === 'route' ? 'border-accent bg-accent text-accent-ink' : 'border-ink bg-ink text-bg';
  return (
    <button type="button" aria-pressed={!!selected} onClick={onClick} className={cx('inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors', selected ? on : 'border-line bg-surface text-ink hover:border-muted', className)}>
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, tone, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'route' | 'boulder' | 'default'; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-3.5', className)}>
      <span className="text-xs text-muted">{label}</span>
      <span className={cx('font-display text-[26px] font-black leading-tight tracking-tight', tone === 'route' && 'text-route', tone === 'boulder' && 'text-boulder')}>{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function GradeBadge({ type, grade, size = 'md' }: { type: ClimbType; grade: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center rounded-xl font-mono font-bold', size === 'md' ? 'h-10 min-w-14 px-1.5 text-sm' : 'h-13 min-w-16 px-2 font-display text-xl font-black', type === 'boulder' ? 'bg-orange/15 text-boulder' : 'bg-accent/15 text-route')}>
      {grade}
    </span>
  );
}

export function Bar({ value, tone = 'route', className }: { value: number; tone?: 'route' | 'boulder' | 'blue' | 'ink'; className?: string }) {
  return (
    <span className={cx('block h-1.5 overflow-hidden rounded-full bg-surface-2', className)} aria-hidden="true">
      <span className={cx('anim-grow block h-full rounded-full', tone === 'route' && 'bg-route', tone === 'boulder' && 'bg-boulder', tone === 'blue' && 'bg-blue', tone === 'ink' && 'bg-ink')} style={{ width: Math.max(0, Math.min(100, value)) + '%' }} />
    </span>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-line px-5 py-7 text-center">
      <p className="m-0 font-semibold">{title}</p>
      {body && <p className="m-0 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function DemoBadge() {
  return <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-ink">DEMO</span>;
}

export function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-muted">{label}</label>
      {children(id)}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export const inputCls = 'w-full min-h-12 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-base text-ink placeholder:text-muted/80';

/** Modal sheet: bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Callers pass a new onClose on every render; keep the latest in a ref so the open/close effect runs only
  // when `open` changes. (It used to re-run on every parent render, e.g. 4x a second under the workout timer,
  // refocusing the input each time: on iPhone that made the sheet and keyboard jitter.)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // On touch screens don't put focus in a text field (that pops the keyboard over a sheet that is still
    // sliding in); focus the dialog itself so screen readers still land in it.
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const t = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const first = el.querySelector<HTMLElement>(touch ? 'button:not([data-close])' : 'input,select,textarea,button:not([data-close])');
      (touch ? el : first ?? el).focus({ preventScroll: true });
    }, 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.({ preventScroll: true }); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button aria-label="Close" data-close className="anim-fade absolute inset-0 bg-black/60" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="anim-rise relative outline-none flex max-h-[90dvh] w-full flex-col rounded-t-[28px] border border-line bg-surface sm:max-w-lg sm:rounded-[28px]">
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 className="m-0 font-display text-lg font-extrabold">{title}</h2>
          <IconButton label="Close" data-close onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className={cx("flex flex-col gap-4 overflow-y-auto px-5", footer ? "pb-5" : "pb-[max(20px,var(--sa-bottom))]")}>{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3 pb-[max(12px,var(--sa-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx('flex h-8 w-[52px] shrink-0 rounded-full p-[3px] transition-colors', checked ? 'justify-end bg-accent' : 'justify-start bg-line')}>
      <span className="h-[26px] w-[26px] rounded-full bg-white shadow" />
    </button>
  );
}
