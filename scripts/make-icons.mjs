// Renders the DYNOMARK app icons (the cut D of the logotype) to PNG with a local Chrome.
// Usage: npm run icons   (set CHROME_PATH if Chrome isn't in the default Windows location)
// Geometry matches src/lib/logo.ts.
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const OUT = fileURLToPath(new URL('../public/', import.meta.url));
const CHARCOAL = '#111214';
const LIME = '#C6F432';
const HOLD = '#FF8A3D';
const D = 'M0,0H58L82,24V76L58,100H0ZM26,26V74H50L56,68V32L50,26Z';

/** The D mark with its cut and hold. Visual box is x -25..105, y 0..100 (centre 40,50); scale s, centred in a 100 box. */
function mark(s) {
  const tx = 50 - 40 * s;
  const ty = 50 - 50 * s;
  return `<g transform="translate(${tx} ${ty}) scale(${s})">
    <path transform="skewX(-14)" d="${D}" fill="${LIME}" fill-rule="evenodd"/>
    <line x1="-40" y1="96" x2="88" y2="18" stroke="${CHARCOAL}" stroke-width="7"/>
    <circle cx="96" cy="10" r="9" fill="${HOLD}"/>
  </g>`;
}
const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;

// Full-bleed squares: iOS and Android round the corners themselves.
const full = svg(`<rect width="100" height="100" fill="${CHARCOAL}"/>${mark(0.58)}`);
// Maskable: the mark stays inside the central 80% safe circle.
const maskable = svg(`<rect width="100" height="100" fill="${CHARCOAL}"/>${mark(0.46)}`);
// Browser tab: rounded tile, slightly larger mark so it reads at 16-32 px.
const favicon = svg(`<rect width="100" height="100" rx="22" fill="${CHARCOAL}"/>${mark(0.66)}`);

const files = [
  ['dynomark-icon-192.png', full, 192],
  ['dynomark-icon-512.png', full, 512],
  ['dynomark-icon-maskable-512.png', maskable, 512],
  ['dynomark-apple-touch-icon.png', full, 180],
  ['dynomark-favicon-32.png', favicon, 32],
];

writeFileSync(OUT + 'dynomark-favicon.svg', favicon);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
try {
  const page = await browser.newPage();
  for (const [name, markup, size] of files) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: OUT + name, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log(name);
  }
  // iOS app icon (Capacitor project): 1024 px, full-bleed. App Store Connect rejects icons with an
  // alpha channel, so the PNG is flattened to RGB with Python + Pillow afterwards.
  const IOS = fileURLToPath(new URL('../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', import.meta.url));
  if (existsSync(IOS)) {
    await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
    await page.setContent(`<html><body style="margin:0">${full.replace('<svg ', '<svg width="1024" height="1024" ')}</body></html>`);
    await page.screenshot({ path: IOS, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
    const r = spawnSync('python', ['-c', 'import sys; from PIL import Image; p = sys.argv[1]; Image.open(p).convert("RGB").save(p, optimize=True)', IOS], { stdio: 'inherit' });
    console.log(r.status === 0 ? 'ios AppIcon 1024 (RGB)' : 'ios AppIcon 1024: could not remove the alpha channel (needs python + Pillow)');
  }
  // Android app (Capacitor): legacy, round and adaptive-foreground launcher icons per density.
  // The adaptive background is the charcoal colour in res/values/ic_launcher_background.xml.
  const RES = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url));
  if (existsSync(RES)) {
    const legacy = svg(`<rect width="100" height="100" rx="18" fill="${CHARCOAL}"/>${mark(0.6)}`);
    const round = svg(`<circle cx="50" cy="50" r="50" fill="${CHARCOAL}"/>${mark(0.5)}`);
    const fg = svg(mark(0.42)); // transparent; stays inside the adaptive icon's safe zone
    const dens = [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]];
    for (const [d, size, fgSize] of dens) {
      for (const [file, markup, px] of [['ic_launcher.png', legacy, size], ['ic_launcher_round.png', round, size], ['ic_launcher_foreground.png', fg, fgSize]]) {
        await page.setViewport({ width: px, height: px, deviceScaleFactor: 1 });
        await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${px}" height="${px}" `)}</body></html>`);
        await page.screenshot({ path: RES + 'mipmap-' + d + '/' + file, omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } });
      }
    }
    writeFileSync(RES + 'values/ic_launcher_background.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${CHARCOAL}</color>
    <color name="splash_background">${CHARCOAL}</color>
</resources>
`);
    console.log('android launcher icons (5 densities)');
  }
} finally {
  await browser.close();
}
