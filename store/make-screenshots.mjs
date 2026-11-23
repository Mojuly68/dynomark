// Store screenshots from the real app (demo account) with a headline above each screen.
// Usage: start the dev server (npm run dev, port 5180), then: node store/make-screenshots.mjs
// Output: store/screenshots/<set>/NN-name.png, plus store/play-icon-512.png and store/play-feature-1024x500.png.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const BASE = process.env.APP_URL || 'http://localhost:5180/';
const OUT = fileURLToPath(new URL('./', import.meta.url));
const BG = '#111214', INK = '#F2F1EC', LIME = '#C6F432', HOLD = '#FF8A3D';
const FONT = "DMRoboto, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";
// Headline font: the app's own Roboto, embedded so the composer page doesn't depend on installed fonts.
const ROBOTO = readFileSync(fileURLToPath(new URL('../node_modules/@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2', import.meta.url))).toString('base64');
const FONTFACE = `<style>@font-face{font-family:DMRoboto;src:url(data:font/woff2;base64,${ROBOTO}) format('woff2');font-weight:100 900}</style>`;

const SHOTS = [
  { name: 'log', route: '#/log', title: ['Log a climb', 'in seconds'], sub: 'With a warm-up plan built from your own sends' },
  { name: 'home', route: '#/', title: ['Your climbing', 'at a glance'], sub: 'Current gym, this week, streaks and records' },
  { name: 'progress', route: '#/progress', title: ['Watch your', 'grades climb'], sub: 'Trend lines, volume, flash and send rates' },
  { name: 'projects', route: '#/projects', title: ['Chase every', 'project'], sub: 'High points by session and an honest outlook' },
  { name: 'report', route: '#/report', title: ['Your month', 'in climbing'], sub: 'Monthly reports and your year in review' },
  { name: 'training', route: '#/training', title: ['Train fingers', 'with purpose'], sub: 'Hangboard load as % of body weight, rest timer' },
];

// set: final canvas (CSS px × scale), and the app viewport photographed inside it.
const SETS = [
  { dir: 'ios-6.9', canvas: [440, 956, 3], app: [393, 852, 3], mobile: true },
  { dir: 'ios-ipad-13', canvas: [1032, 1376, 2], app: [1024, 1180, 2], mobile: false },
  { dir: 'play-phone', canvas: [360, 640, 3], app: [393, 852, 3], mobile: true },
  { dir: 'play-tablet-10', canvas: [800, 1280, 2], app: [800, 1080, 2], mobile: false },
];

const ridge = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%"><polygon points="0,100 0,91 14.29,85 28.57,88 42.86,77.5 57.14,82 71.43,71 85.71,78 100,74 100,100" fill="${LIME}" fill-opacity="0.14"/></svg>`;

function frame(set, shot, img) {
  const [cw, ch] = set.canvas;
  const titleSize = Math.round(cw * (set.mobile ? 0.105 : 0.07));
  const subSize = Math.round(titleSize * 0.36);
  const captionH = Math.round(ch * (set.mobile ? 0.22 : 0.17));
  const maxW = cw * (set.mobile ? 0.8 : 0.86);
  const maxH = ch - captionH - ch * 0.04;
  const ratio = set.app[0] / set.app[1];
  const w = Math.min(maxW, maxH * ratio), h = w / ratio;
  return `<!doctype html><html><head>${FONTFACE}</head><body style="margin:0;width:${cw}px;height:${ch}px;background:${BG};position:relative;overflow:hidden;font-family:${FONT};color:${INK}">
${ridge}
<div style="position:absolute;left:0;right:0;top:${Math.round(ch * 0.045)}px;height:${captionH}px;text-align:center;padding:0 ${Math.round(cw * 0.06)}px;box-sizing:border-box">
  <div style="font-size:${titleSize}px;font-weight:900;line-height:1.02;letter-spacing:-0.02em">${shot.title[0]}<br><span style="color:${LIME}">${shot.title[1]}</span></div>
  <div style="margin-top:${Math.round(subSize * 0.7)}px;font-size:${subSize}px;color:#B9BBC1;line-height:1.3">${shot.sub}</div>
</div>
<img src="${img}" style="position:absolute;left:${(cw - w) / 2}px;top:${captionH + ch * 0.04}px;width:${w}px;height:${h}px;border-radius:${Math.round(w * 0.075)}px;border:1px solid #2E3035;box-shadow:0 20px 60px rgba(0,0,0,.55);object-fit:cover;object-position:top">
</body></html>`;
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  protocolTimeout: 120000,
});
try {
  for (const set of SETS) {
    mkdirSync(OUT + 'screenshots/' + set.dir, { recursive: true });
    const app = await browser.newPage();
    if (set.mobile) await app.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    await app.setViewport({ width: set.app[0], height: set.app[1], deviceScaleFactor: set.app[2], isMobile: set.mobile, hasTouch: set.mobile });
    const comp = await browser.newPage();
    await comp.setViewport({ width: set.canvas[0], height: set.canvas[1], deviceScaleFactor: set.canvas[2] });
    for (const [i, shot] of SHOTS.entries()) {
      await app.goto(BASE + shot.route, { waitUntil: 'networkidle0' });
      await app.waitForFunction(() => !document.getElementById('launch'), { timeout: 10000 });
      await new Promise((r) => setTimeout(r, 900));
      await app.bringToFront();
      const raw = await app.screenshot({ encoding: 'base64' });
      await comp.bringToFront();
      await comp.setContent(frame(set, shot, 'data:image/png;base64,' + raw), { waitUntil: 'load' });
      await comp.evaluate(() => document.fonts.ready);
      const file = `${OUT}screenshots/${set.dir}/${String(i + 1).padStart(2, '0')}-${shot.name}.png`;
      await comp.screenshot({ path: file });
      console.log(set.dir, shot.name);
    }
    await app.close(); await comp.close();
  }

  // Play listing icon and feature graphic.
  copyFileSync(fileURLToPath(new URL('../public/dynomark-icon-512.png', import.meta.url)), OUT + 'play-icon-512.png');
  const LETTERS = 'M0,0H58L82,24V76L58,100H0ZM26,26V74H50L56,68V32L50,26Z M94,0H122L136,26L150,0H178L149,54V100H123V54Z M190,100V0H218L246,48V0H272V100H244L216,52V100Z M308,0H342L366,24V76L342,100H308L284,76V24ZM316,26H334L340,32V68L334,74H316L310,68V32Z M378,100V0H408L430,40L452,0H482V100H456V46L436,82H424L404,46V100Z M494,100V24L518,0H554L578,24V100H552V68H520V100ZM520,44H552V32L546,26H526L520,32Z M590,0H650L674,24V46L660,60L676,100H647L635,68H616V100H590ZM616,26V44H642L648,38V32L642,26Z M686,0H712V38L742,0H772L734,48L772,100H741L712,60V100H686Z';
  const fg = await browser.newPage();
  await fg.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });
  await fg.setContent(`<!doctype html><html><head>${FONTFACE}</head><body style="margin:0;width:1024px;height:500px;background:${BG};position:relative;overflow:hidden;font-family:${FONT};color:${INK}">${ridge}
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding-bottom:40px">
<svg width="640" height="91" viewBox="-38 -14 832 118"><g transform="skewX(-14)" fill="${INK}" fill-rule="evenodd"><path d="${LETTERS}"/></g><line x1="-34" y1="98" x2="760" y2="10" stroke="${BG}" stroke-width="7"/><circle cx="778" cy="-2" r="10" fill="${HOLD}"/></svg>
<div style="font-size:30px;font-weight:700;color:#C9CBD0;letter-spacing:0.01em">The fast logbook for indoor climbers</div></div></body></html>`);
  const feature = OUT + 'play-feature-1024x500.png';
  await fg.screenshot({ path: feature });
  spawnSync('python', ['-c', 'import sys; from PIL import Image; p = sys.argv[1]; Image.open(p).convert("RGB").save(p, optimize=True)', feature], { stdio: 'inherit' });
  console.log('play icon + feature graphic');
} finally {
  await browser.close();
}
