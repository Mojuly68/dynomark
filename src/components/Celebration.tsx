import { useEffect, type CSSProperties } from 'react';
import { href } from '../lib/router';

const COLORS = ['#C6F432', '#FF8A3D', '#F2F1EC'];
const PARTICLES = Array.from({ length: 30 }, (_, i) => {
  const a = (i / 30) * Math.PI * 2 + (i % 3) * 0.2;
  const d = 130 + ((i * 47) % 120);
  return { dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d + 40), r: (i * 67) % 360, w: i % 2 ? 6 : 11, h: i % 2 ? 15 : 6, c: COLORS[i % 3], delay: (i % 5) * 0.03 };
});

export function Celebration({ grade, name, detail, accent, onClose, shareTo }: { grade: string; name: string; detail: string; accent: string; onClose: () => void; shareTo?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={'Sent ' + name} className="anim-fade fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 overflow-hidden bg-[#08090A]/95 p-8 text-center text-[#F2F1EC]">
      <div aria-hidden="true" className="absolute left-1/2 top-[40%] h-0 w-0">
        {PARTICLES.map((p, i) => (
          <span key={i} className="anim-burst absolute left-0 top-0 rounded-[2px]" style={{ width: p.w, height: p.h, background: p.c, animationDelay: p.delay + 's', '--dx': p.dx + 'px', '--dy': p.dy + 'px', '--r': p.r + 'deg' } as CSSProperties} />
        ))}
      </div>
      <span className="font-mono text-[13px] tracking-[0.14em]" style={{ color: accent }}>PROJECT SENT</span>
      <span className="anim-slam font-display text-[96px] font-black leading-[0.9] tracking-[-0.04em] sm:text-[140px]">SENT.</span>
      <span className="font-display text-2xl font-extrabold"><span style={{ color: accent }}>{grade}</span> {name}</span>
      <span className="text-[15px] text-[#9A9CA3]">{detail}</span>
      <div className="mt-5 flex w-full max-w-sm gap-2.5">
        <button autoFocus onClick={onClose} className="min-h-14 flex-1 rounded-2xl border border-[#3A3D43] font-bold">Done</button>
        {shareTo && <a href={href(shareTo)} onClick={onClose} className="flex min-h-14 flex-1 items-center justify-center rounded-2xl font-extrabold text-[#111214] no-underline" style={{ background: accent }}>Share card</a>}
      </div>
    </div>
  );
}
