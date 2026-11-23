// Renders iPhone and iPad launch (splash) images and writes their <link> tags into index.html.
// Usage: npm run splash   (set CHROME_PATH if Chrome isn't in the default Windows location)
// Android has no launch images for web apps: Chrome builds its splash from the manifest
// (background_color + icon + name), and index.html carries the same design as an in-page launch screen.
// Logo geometry matches src/lib/logo.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIR = 'splash/';
const BG = '#111214';
const INK = '#F2F1EC';
const LIME = '#C6F432';
const HOLD = '#FF8A3D';

const LETTERS = [
  'M0,0H58L82,24V76L58,100H0ZM26,26V74H50L56,68V32L50,26Z',
  'M94,0H122L136,26L150,0H178L149,54V100H123V54Z',
  'M190,100V0H218L246,48V0H272V100H244L216,52V100Z',
  'M308,0H342L366,24V76L342,100H308L284,76V24ZM316,26H334L340,32V68L334,74H316L310,68V32Z',
  'M378,100V0H408L430,40L452,0H482V100H456V46L436,82H424L404,46V100Z',
  'M494,100V24L518,0H554L578,24V100H552V68H520V100ZM520,44H552V32L546,26H526L520,32Z',
  'M590,0H650L674,24V46L660,60L676,100H647L635,68H616V100H590ZM616,26V44H642L648,38V32L642,26Z',
  'M686,0H712V38L742,0H772L734,48L772,100H741L712,60V100H686Z',
];
const RIDGE = [0.82, 0.7, 0.76, 0.55, 0.64, 0.42, 0.56, 0.48]; // same skyline as the share cards

export const logoSvg = (width) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-38 -14 832 118" width="${width}" aria-hidden="true">
<g transform="skewX(-14)" fill="${INK}" fill-rule="evenodd">${LETTERS.map((d) => `<path d="${d}"/>`).join('')}</g>
<line x1="-34" y1="98" x2="760" y2="10" stroke="${BG}" stroke-width="7"/>
<circle cx="778" cy="-2" r="10" fill="${HOLD}"/></svg>`;
export const ridgeSvg = () => {
  const pts = RIDGE.map((r, i) => `${((i / (RIDGE.length - 1)) * 100).toFixed(2)},${(50 + r * 50).toFixed(2)}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%"><polygon points="0,100 ${pts} 100,100" fill="${LIME}" fill-opacity="0.16"/></svg>`;
};

// Portrait CSS size and pixel ratio of each device class (iOS picks the image by media query).
const PHONES = [
  [440, 956, 3, 'iPhone 16 Pro Max'],
  [402, 874, 3, 'iPhone 16 Pro'],
  [430, 932, 3, 'iPhone 14 Pro Max, 15 Plus/Pro Max, 16 Plus'],
  [393, 852, 3, 'iPhone 14 Pro, 15, 15 Pro, 16'],
  [428, 926, 3, 'iPhone 12/13 Pro Max, 14 Plus'],
  [390, 844, 3, 'iPhone 12, 13, 14, 12/13 Pro'],
  [375, 812, 3, 'iPhone X, XS, 11 Pro, 12/13 mini'],
  [414, 896, 3, 'iPhone XS Max, 11 Pro Max'],
  [414, 896, 2, 'iPhone XR, 11'],
  [414, 736, 3, 'iPhone 8 Plus'],
  [375, 667, 2, 'iPhone 8, SE (2nd/3rd gen)'],
  [320, 568, 2, 'iPhone SE (1st gen)'],
];
const TABLETS = [
  [1032, 1376, 2, 'iPad Pro 13" (M4), iPad Air 13"'],
  [1024, 1366, 2, 'iPad Pro 12.9"'],
  [834, 1210, 2, 'iPad Pro 11" (M4)'],
  [834, 1194, 2, 'iPad Pro 11"'],
  [820, 1180, 2, 'iPad Air 10.9", iPad 10th gen'],
  [834, 1112, 2, 'iPad Air 10.5"'],
  [810, 1080, 2, 'iPad 10.2"'],
  [768, 1024, 2, 'iPad 9.7", iPad mini 5'],
  [744, 1133, 2, 'iPad mini 6'],
];

const shots = [];
for (const [w, h, r, name] of PHONES) shots.push({ w, h, r, o: 'portrait', name });
for (const [w, h, r, name] of TABLETS) {
  shots.push({ w, h, r, o: 'portrait', name });
  shots.push({ w: h, h: w, r, o: 'landscape', name, dw: w, dh: h });
}

const page = (w) => `<!doctype html><html><body style="margin:0;background:${BG};width:100vw;height:100vh;position:relative;overflow:hidden">
${ridgeSvg()}
<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-bottom:6vh">${logoSvg(Math.round(Math.min(w * 0.74, 620)))}</div>
</body></html>`;

mkdirSync(ROOT + 'public/' + DIR, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const links = [];
try {
  const tab = await browser.newPage();
  for (const s of shots) {
    const px = `${s.w * s.r}x${s.h * s.r}`;
    const file = `${DIR}splash-${px}.png`;
    await tab.setViewport({ width: s.w, height: s.h, deviceScaleFactor: s.r });
    await tab.setContent(page(s.w));
    await tab.screenshot({ path: ROOT + 'public/' + file });
    // device-width/height are the portrait values in both orientations.
    const dw = s.dw ?? s.w, dh = s.dh ?? s.h;
    links.push(`    <link rel="apple-touch-startup-image" media="(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${s.r}) and (orientation: ${s.o})" href="./${file}?v=dynomark" /><!-- ${s.name}, ${s.o} -->`);
    console.log(file, s.name, s.o);
  }
  // Native iOS launch screen (Capacitor): one square image the storyboard scales to fill the screen.
  // On a phone only the middle third of its width shows, so the logo is sized to match the in-page launch screen.
  const SPLASH_DIR = ROOT + 'ios/App/App/Assets.xcassets/Splash.imageset/';
  if (existsSync(SPLASH_DIR)) {
    await tab.setViewport({ width: 2732, height: 2732, deviceScaleFactor: 1 });
    await tab.setContent(`<!doctype html><html><body style="margin:0;background:${BG};width:2732px;height:2732px;display:flex;align-items:center;justify-content:center"><div style="margin-bottom:160px">${logoSvg(935)}</div></body></html>`);
    for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await tab.screenshot({ path: SPLASH_DIR + f });
    console.log('ios Splash.imageset (3 files)');
  }
  // Android app (Capacitor): splash drawables for Android 11 and older (12+ shows the launcher icon on charcoal).
  const DRAW = ROOT + 'android/app/src/main/res/';
  if (existsSync(DRAW)) {
    const sizes = [['drawable', 480, 320], ['drawable-port-mdpi', 320, 480], ['drawable-port-hdpi', 480, 800], ['drawable-port-xhdpi', 720, 1280], ['drawable-port-xxhdpi', 960, 1600], ['drawable-port-xxxhdpi', 1280, 1920],
      ['drawable-land-mdpi', 480, 320], ['drawable-land-hdpi', 800, 480], ['drawable-land-xhdpi', 1280, 720], ['drawable-land-xxhdpi', 1600, 960], ['drawable-land-xxxhdpi', 1920, 1280]];
    for (const [dir, w, h] of sizes) {
      await tab.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await tab.setContent(`<!doctype html><html><body style="margin:0;background:${BG};width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center">${logoSvg(Math.round(Math.min(w, h) * 0.62))}</body></html>`);
      await tab.screenshot({ path: DRAW + dir + '/splash.png' });
    }
    console.log('android splash drawables (11 files)');
  }
} finally {
  await browser.close();
}

// Rewrite the generated blocks in index.html: launch-image links in <head>, and the in-page
// launch screen (same design) that Android and browsers show until the first screen is ready.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function setBlock(html, start, end, lines, anchor, before) {
  const block = [start, ...lines, end].join('\n');
  if (html.includes(start)) return html.replace(new RegExp(esc(start) + '[\\s\\S]*?' + esc(end)), block);
  return html.replace(anchor, before ? block + '\n' + anchor : anchor + '\n' + block);
}
let html = readFileSync(ROOT + 'index.html', 'utf8');
html = setBlock(html, '    <!-- splash:start (generated by scripts/make-splash.mjs) -->', '    <!-- splash:end -->', links, '  </head>', true);
const launch = `    <div id="launch" aria-hidden="true" style="position:fixed;inset:0;z-index:100;background:${BG};transition:opacity .3s ease-out">
      ${ridgeSvg()}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-bottom:6vh">${logoSvg('min(74vw,620px)').replace('width="min(74vw,620px)"', 'style="width:min(74vw,620px);height:auto"')}</div>
    </div>`;
html = setBlock(html, '    <!-- launch:start (generated by scripts/make-splash.mjs) -->', '    <!-- launch:end -->', [launch], '  <body>', false);
writeFileSync(ROOT + 'index.html', html);
console.log(links.length + ' launch images, index.html updated');
