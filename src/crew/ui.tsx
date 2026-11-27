import { useState } from 'react';
import { Check, Flag, HandFist, Heart, Send, Zap, type LucideIcon } from 'lucide-react';
import { cx } from '../components/ui';
import { haptic } from '../lib/native';
import { fmtWeekday } from '../lib/dates';
import { href } from '../lib/router';
import { fmtMinutes } from './local';
import type { CrewPost, CrewProfile, ReactionKind } from './types';
import { REACTIONS } from './types';

export const REACTION_META: Record<ReactionKind, { label: string; icon: LucideIcon }> = {
  allez: { label: 'Allez', icon: Zap },
  send: { label: 'Send it', icon: Send },
  crusher: { label: 'Crusher', icon: HandFist },
  clean: { label: 'Clean', icon: Check },
  respect: { label: 'Respect', icon: Heart },
};

const PALETTE: [string, string][] = [['#2B3510', '#C6F432'], ['#3A2416', '#FF8A3D'], ['#1D2B3A', '#8CC8FF'], ['#3A1D2E', '#FF9FCB'], ['#1F2E2A', '#7EE0C3'], ['#2A2240', '#C4B2FF']];
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

export const displayName = (p: CrewProfile) => p.firstName?.trim() || '@' + p.username;
export const initials = (p: CrewProfile) => (p.firstName?.trim() || p.username).replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';

export function CrewAvatar({ p, size = 40, me }: { p: CrewProfile; size?: number; me?: boolean }) {
  const [bg, fg] = me ? ['#C6F432', '#111214'] : PALETTE[hash(p.id) % PALETTE.length];
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-full font-black" style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.36) }}>
      {initials(p)}
    </span>
  );
}

export function DemoNote() {
  return <p className="m-0 rounded-xl border border-line px-3 py-2 text-center text-xs text-muted">Demo crew · sample friends and posts on this device. Nothing is sent anywhere.</p>;
}

export function timeAgo(iso: string, now = Date.now()) {
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return fmtWeekday(iso);
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

const STYLE_LABEL = { boulder: 'Bouldering', route: 'Ropes', mixed: 'Rope + boulder' } as const;

export function PostCard({ post, meId, onReact }: { post: CrewPost; meId?: string; onReact?: (kind: ReactionKind, on: boolean) => void }) {
  const d = post.data;
  const mine = post.author.id === meId;
  const top = [d.topBoulder, d.topRoute].filter(Boolean).join(' / ');
  const maxTried = Math.max(1, ...(d.pyramid ?? []).map((p) => p.tried));
  const kv: [string, string][] = [];
  if (d.durationMin) kv.push([fmtMinutes(d.durationMin), 'Duration']);
  if (d.flashes != null) kv.push([String(d.flashes), 'First try']);
  if (d.attempts != null) kv.push([String(d.attempts), 'Attempts']);
  return (
    <article className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
      <a href={mine ? href('/crew/settings') : href('/crew/u/' + post.author.id)} className="flex min-h-11 items-center gap-2.5 text-ink no-underline">
        <CrewAvatar p={post.author} me={mine} />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-[15px]">{mine ? 'You' : displayName(post.author)}</b>
          <span className="truncate text-xs text-muted">{[d.gym, timeAgo(post.createdAt)].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-bold text-muted">{STYLE_LABEL[d.style]}</span>
      </a>
      {d.project && (
        <p className="m-0 flex items-center gap-2.5 rounded-[14px] border border-orange/40 bg-orange/10 px-3 py-2.5 text-sm leading-snug">
          <Flag size={18} className="shrink-0 text-boulder" aria-hidden="true" />
          <span><b className="text-boulder">Project sent:</b> {d.project.name}, {d.project.grade}, after {d.project.tries} tries over {d.project.sessions} session{d.project.sessions === 1 ? '' : 's'}.</span>
        </p>
      )}
      <div className="flex items-end gap-3">
        <span className="flex flex-1 flex-col">
          <span className="font-display text-[40px] font-black leading-[0.95] tracking-tight">{d.sends}/{d.climbs}</span>
          <span className="text-[13px] text-muted">sends{top ? ' · top grade ' + top : ''}</span>
        </span>
        {d.pyramid && d.pyramid.length > 0 && (
          <span className="flex h-[58px] items-end gap-1" aria-label={'Grade pyramid: ' + d.pyramid.map((p) => p.g + ' ' + p.sent + ' of ' + p.tried).join(', ')} role="img">
            {d.pyramid.map((p) => (
              <span key={p.g} className="flex flex-col items-center gap-0.5">
                <span className="w-3.5 rounded bg-boulder" style={{ height: Math.round((p.sent / maxTried) * 40) + 4 }} />
                <span className="font-mono text-[9px] text-muted">{p.g}</span>
              </span>
            ))}
          </span>
        )}
      </div>
      {kv.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {kv.map(([v, l]) => <span key={l} className="flex flex-col rounded-xl bg-bg px-2.5 py-2"><b className="font-mono text-[15px]">{v}</b><span className="text-[11px] text-muted">{l}</span></span>)}
        </div>
      )}
      <Reactions post={post} disabled={mine || !onReact} onReact={onReact} />
    </article>
  );
}

function Reactions({ post, disabled, onReact }: { post: CrewPost; disabled: boolean; onReact?: (kind: ReactionKind, on: boolean) => void }) {
  const [pop, setPop] = useState<ReactionKind | null>(null);
  return (
    <div role="group" aria-label={'Reactions to ' + displayName(post.author) + "'s session"} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
      {REACTIONS.map((k) => {
        const on = post.mine.includes(k);
        const n = post.counts[k];
        const M = REACTION_META[k];
        if (disabled && !n) return null;
        return (
          <button
            key={k}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => { setPop(on ? null : k); if (!on) void haptic('light'); onReact?.(k, !on); }}
            className={cx('flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold transition-colors disabled:cursor-default', on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-bg text-ink', pop === k && 'anim-pop')}
          >
            <M.icon size={15} strokeWidth={2.4} aria-hidden="true" />{M.label}{n > 0 && <span className="font-mono text-xs opacity-80">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
