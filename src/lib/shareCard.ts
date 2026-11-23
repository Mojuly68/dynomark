import { FONT_DISPLAY, FONT_MONO, FONT_SANS } from './fonts';
import { isNative, shareFileNative } from './native';
import { HOLD_COLOR, LOGO_CUT, LOGO_HOLD, LOGO_LETTERS, LOGO_SKEW_DEG } from './logo';
// Draws a 1080×1350 share image on a canvas. Text-only, so it works offline.

export interface CardSpec {
  kicker: string;
  label: string;
  big: string;
  sub: string;
  stats: { v: string; l: string }[];
  accent: string;
  spark?: number[];
  demo: boolean;
}

export async function renderCard(spec: CardSpec): Promise<HTMLCanvasElement> {
  if (document.fonts) {
    await Promise.all(['900 40px "Roboto Variable"', '700 40px "Roboto Mono Variable"'].map((f) => document.fonts.load(f).catch(() => [])));
    await document.fonts.ready;
  }
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#0B0C0D';
  g.fillRect(0, 0, W, H);

  // Ridge line
  g.save();
  g.globalAlpha = 0.18;
  g.fillStyle = spec.accent;
  g.beginPath();
  g.moveTo(0, H);
  const ridge = [0.82, 0.7, 0.76, 0.55, 0.64, 0.42, 0.56, 0.48];
  ridge.forEach((y, i) => g.lineTo((i / (ridge.length - 1)) * W, y * H));
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  g.restore();

  const pad = 90;
  drawLogo(g, pad + 12, pad + 4, 0.44, '#F2F1EC', '#0B0C0D');
  g.textBaseline = 'top';
  g.font = `500 30px ${FONT_MONO}`;
  g.fillStyle = '#9A9CA3';
  const kw = g.measureText(spec.kicker).width;
  g.fillText(spec.kicker, W - pad - kw, pad + 16);

  g.fillStyle = spec.accent;
  g.font = `700 34px ${FONT_MONO}`;
  g.fillText(spec.label.toUpperCase(), pad, 330);

  g.fillStyle = '#F2F1EC';
  let size = 230;
  g.font = `900 ${size}px ${FONT_DISPLAY}`;
  while (g.measureText(spec.big).width > W - pad * 2 && size > 90) { size -= 10; g.font = `900 ${size}px ${FONT_DISPLAY}`; }
  g.fillText(spec.big, pad - 6, 390);

  g.font = `600 46px ${FONT_SANS}`;
  wrap(g, spec.sub, pad, 400 + size + 10, W - pad * 2, 58);

  if (spec.spark && spec.spark.length > 1) {
    const sx = pad, sy = 900, sw = W - pad * 2, sh = 140;
    const lo = Math.min(...spec.spark), hi = Math.max(...spec.spark);
    g.strokeStyle = spec.accent;
    g.lineWidth = 8;
    g.lineJoin = 'round';
    g.beginPath();
    spec.spark.forEach((v, i) => {
      const x = sx + (i / (spec.spark!.length - 1)) * sw;
      const y = sy + sh - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * sh;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.stroke();
  }

  const colW = (W - pad * 2) / Math.max(1, spec.stats.length);
  spec.stats.forEach((s, i) => {
    const x = pad + i * colW;
    g.fillStyle = '#F2F1EC';
    g.font = `900 76px ${FONT_DISPLAY}`;
    g.fillText(s.v, x, 1100);
    g.fillStyle = '#9A9CA3';
    g.font = `600 26px ${FONT_SANS}`;
    g.fillText(s.l.toUpperCase(), x, 1190);
  });

  if (spec.demo) {
    g.fillStyle = '#8C8F96';
    g.font = `500 24px ${FONT_SANS}`;
    g.fillText('Sample data from the DYNOMARK demo account', pad, H - 70);
  }
  return c;
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > max && line) { g.fillText(line, x, y); line = w; y += lh; }
    else line = test;
  }
  if (line) g.fillText(line, x, y);
}

/** The Dyno logotype at (x, y) = top-left of the cap height; `bg` is the colour under the cut. */
function drawLogo(g: CanvasRenderingContext2D, x: number, y: number, scale: number, ink: string, bg: string) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.save();
  g.transform(1, 0, Math.tan((LOGO_SKEW_DEG * Math.PI) / 180), 1, 0, 0);
  g.fillStyle = ink;
  for (const d of LOGO_LETTERS) g.fill(new Path2D(d), 'evenodd');
  g.restore();
  g.strokeStyle = bg;
  g.lineWidth = LOGO_CUT.width;
  g.beginPath();
  g.moveTo(LOGO_CUT.x1, LOGO_CUT.y1);
  g.lineTo(LOGO_CUT.x2, LOGO_CUT.y2);
  g.stroke();
  g.fillStyle = HOLD_COLOR;
  g.beginPath();
  g.arc(LOGO_HOLD.cx, LOGO_HOLD.cy, LOGO_HOLD.r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function canvasBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No image'))), 'image/png'));
}

/** Share the card through the system share sheet, or download it where sharing files isn't supported. */
export async function shareCardImage(spec: CardSpec, fileName: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const blob = await canvasBlob(await renderCard(spec));
  if (isNative()) return shareFileNative(fileName, blob);
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'DYNOMARK' }); return 'shared'; } catch { return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
