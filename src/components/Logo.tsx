import { useId } from 'react';
import { HOLD_COLOR, LOGO_BOX, LOGO_CUT, LOGO_HOLD, LOGO_LETTERS, LOGO_SKEW_DEG } from '../lib/logo';

/** DYNOMARK logotype. Letters take the current text color; the cut is transparent, so it works on any background. */
export function Logo({ height = 28, className, title = 'DYNOMARK' }: { height?: number; className?: string; title?: string | null }) {
  const id = 'sv-cut-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const b = LOGO_BOX;
  const c = LOGO_CUT;
  return (
    <svg
      viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
      height={height}
      width={(height * b.w) / b.h}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x={b.x} y={b.y} width={b.w} height={b.h}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#fff" />
          <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="#000" strokeWidth={c.width} />
        </mask>
      </defs>
      <g mask={`url(#${id})`}>
        <g transform={`skewX(${LOGO_SKEW_DEG})`} fill="currentColor">
          {LOGO_LETTERS.map((d) => <path key={d} d={d} fillRule="evenodd" />)}
        </g>
      </g>
      <circle cx={LOGO_HOLD.cx} cy={LOGO_HOLD.cy} r={LOGO_HOLD.r} fill={HOLD_COLOR} />
    </svg>
  );
}
