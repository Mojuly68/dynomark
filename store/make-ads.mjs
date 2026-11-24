// Social video ads: Getty clips (store/video/source, licensed, never committed) + animated DYNOMARK overlays.
// Usage: start the dev server (npm run dev, port 5180), then: node store/make-ads.mjs [format ...]
// Formats: reels (1080×1920), tiktok (1080×1920), square (1080×1080), wide (1920×1080). Output: store/video/out/.
// Overlays are drawn in Chrome frame by frame (ffmpeg's drawtext has no fonts on this machine), then laid over the clips.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = process.env.APP_URL || 'http://localhost:5180/';
const HERE = fileURLToPath(new URL('./', import.meta.url));
const SRC = join(HERE, 'video', 'source');
const OUT = join(HERE, 'video', 'out');
const WORK = join(tmpdir(), 'dynomark-ads');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FPS = 30, DUR = 15;
const ROBOTO = readFileSync(join(HERE, '../node_modules/@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2')).toString('base64');

// Shots: [file, start s, length s]. Cuts at 3, 6.5, 10; the end card wipes in at 12.5 over the last clip.
const CLIPS = [
  ['GettyImages-1295625863.mov', 0.8, 3.0], // A: hand slaps the hold
  ['GettyImages-1228543481.mov', 4.0, 3.5], // B: climber on the big wall
  ['GettyImages-1227595750.mov', 8.0, 3.5], // C: reaching for the next hold
  ['GettyImages-1227595750.mov', 24.0, 5.0], // C: the top hold
];
// Horizontal centre of each shot, as a fraction of the 1920 frame, for the vertical and square crops.
const FOCUS = { tall: [0.36, 0.45, 0.31, 0.52], square: [0.36, 0.42, 0.33, 0.5] };

// Safe zones: keep text out of the platform UI (top bar, caption + buttons at the bottom, icons on the right).
const FORMATS = {
  reels: { w: 1080, h: 1920, kind: 'tall', safe: { top: 230, bottom: 430, left: 72, right: 150 } },
  tiktok: { w: 1080, h: 1920, kind: 'tall', safe: { top: 170, bottom: 500, left: 72, right: 160 } },
  square: { w: 1080, h: 1080, kind: 'square', safe: { top: 64, bottom: 64, left: 64, right: 64 } },
  wide: { w: 1920, h: 1080, kind: 'wide', safe: { top: 72, bottom: 72, left: 96, right: 96 } },
};

const SCREENS = { log: '#/log', progress: '#/progress' };

function overlayPage(f, shots) {
  return `<!doctype html><html><head><style>
@font-face{font-family:DM;src:url(data:font/woff2;base64,${ROBOTO}) format('woff2');font-weight:100 900}
*{box-sizing:border-box}
html,body{margin:0;width:${f.w}px;height:${f.h}px;overflow:hidden;background:transparent;font-family:DM,sans-serif;color:#F2F1EC}
.abs{position:absolute}
.hl{font-weight:900;text-transform:uppercase;line-height:.9;letter-spacing:-.02em;transform-origin:0 100%}
.hl span{display:block;width:max-content;will-change:transform}
.lime{color:#C6F432}
.phone{border-radius:9%/4.2%;overflow:hidden;border:7px solid #23252a;box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 2px rgba(255,255,255,.06);background:#111214}
.phone img{display:block;width:100%}
.chip{font-weight:700;letter-spacing:.12em;text-transform:uppercase}
</style></head><body><div id="root"></div>
<script>
const F=${JSON.stringify(f)}, SHOTS=${JSON.stringify(shots)};
const LETTERS=${JSON.stringify([
    'M0,0H58L82,24V76L58,100H0ZM26,26V74H50L56,68V32L50,26Z', 'M94,0H122L136,26L150,0H178L149,54V100H123V54Z',
    'M190,100V0H218L246,48V0H272V100H244L216,52V100Z', 'M308,0H342L366,24V76L342,100H308L284,76V24ZM316,26H334L340,32V68L334,74H316L310,68V32Z',
    'M378,100V0H408L430,40L452,0H482V100H456V46L436,82H424L404,46V100Z', 'M494,100V24L518,0H554L578,24V100H552V68H520V100ZM520,44H552V32L546,26H526L520,32Z',
    'M590,0H650L674,24V46L660,60L676,100H647L635,68H616V100H590ZM616,26V44H642L648,38V32L642,26Z', 'M686,0H712V38L742,0H772L734,48L772,100H741L712,60V100H686Z'])};
const W=F.w,H=F.h,S=F.safe,TALL=F.kind==='tall',WIDE=F.kind==='wide';
const root=document.getElementById('root');
const el=(html)=>{const d=document.createElement('div');d.innerHTML=html.trim();const n=d.firstChild;root.appendChild(n);return n};
const clamp=(x)=>Math.max(0,Math.min(1,x));
const outBack=(x)=>{const c=1.9;x=clamp(x)-1;return 1+(c+1)*x*x*x+c*x*x};
const outExpo=(x)=>{x=clamp(x);return x===1?1:1-Math.pow(2,-10*x)};
const inExpo=(x)=>{x=clamp(x);return x===0?0:Math.pow(2,10*x-10)};
const prog=(t,a,d)=>clamp((t-a)/d);
function logo(h,color,id,cutColor){
  const k=Math.random().toString(36).slice(2);
  return '<svg viewBox="-38 -14 832 118" height="'+h+'" width="'+(h*832/118)+'" style="display:block;overflow:visible">'
   +'<defs><mask id="m'+k+'" maskUnits="userSpaceOnUse" x="-38" y="-14" width="832" height="118"><rect x="-38" y="-14" width="832" height="118" fill="#fff"/>'
   +'<line x1="-34" y1="98" x2="760" y2="10" stroke="#000" stroke-width="7"/></mask></defs>'
   +'<g mask="url(#m'+k+')"><g transform="skewX(-14)" fill="'+color+'">'+LETTERS.map((d,i)=>'<path class="'+(id||'')+'" data-i="'+i+'" d="'+d+'" fill-rule="evenodd"/>').join('')+'</g></g>'
   +'<circle class="hold" cx="778" cy="-2" r="10" fill="#FF8A3D"/></svg>';
}

// ---- layout per format ----
const big=TALL?168:WIDE?150:124;            // headline size
const textW=W-S.left-S.right;
const textBottom=TALL?H-S.bottom-40:WIDE?H-S.bottom-40:H-S.bottom-24;

// Scrims so white gym walls never wash out the text.
const scrim=el('<div class="abs" style="left:0;top:0;width:'+W+'px;height:'+H+'px"></div>');
scrim.style.background=WIDE
  ?'linear-gradient(90deg,rgba(10,11,13,.82) 0%,rgba(10,11,13,.55) 38%,rgba(10,11,13,0) 62%),linear-gradient(0deg,rgba(10,11,13,.35),rgba(10,11,13,0) 30%)'
  :'linear-gradient(0deg,rgba(10,11,13,.9) 0%,rgba(10,11,13,.78) '+(TALL?34:30)+'%,rgba(10,11,13,0) '+(TALL?58:62)+'%),linear-gradient(180deg,rgba(10,11,13,.55),rgba(10,11,13,0) '+(TALL?20:22)+'%)';

// Small logo, top left, during the clips.
const lh=TALL?46:WIDE?44:40;
const topLogo=el('<div class="abs" style="left:'+S.left+'px;top:'+(S.top+(TALL?10:0))+'px">'+logo(lh,'#F2F1EC')+'</div>');

// Headlines: [start, end, line1, line2 (lime)].
const LINES=[[0.15,3.0,'Every move','counts.'],[3.0,6.5,'Log every','send.'],[6.5,10.0,'Watch your','grades climb.'],[10.0,12.5,'Warm up smart.','Send harder.']];
const heads=LINES.map(([a,b,l1,l2])=>{
  const size=Math.min(big, (textW/(Math.max(l1.length,l2.length)*0.56)));
  const maxW=(WIDE?W*0.55:textW)-big*0.12;
  const n=el('<div class="abs hl" style="left:'+S.left+'px;bottom:'+(H-textBottom)+'px;font-size:'+size+'px;width:'+maxW+'px;white-space:nowrap"><span>'+l1+'</span><span class="lime">'+l2+'</span></div>');
  const spans=[...n.querySelectorAll('span')];
  // Shrink until both lines fit on one line each.
  let fs=size; while(fs>40&&Math.max(...spans.map((x)=>x.scrollWidth))>maxW){fs-=3;n.style.fontSize=fs+'px'}
  return {n,a,b,spans};
});
// Sub-lines under the headline chip area (small caps label above the headline).
const LABELS=[[0.15,3.0,'Indoor climbing tracker'],[3.0,6.5,'Grade · style · tries'],[6.5,10.0,'Trends · flash rate · bests'],[10.0,12.5,'Warm-ups · hangboard · reports']];
const labels=LABELS.map(([a,b,txt],i)=>{
  const fs=TALL?34:WIDE?30:28;
  const n=el('<div class="abs chip" style="left:'+S.left+'px;font-size:'+fs+'px;color:#C6F432;white-space:nowrap"><span style="display:inline-block;width:'+(fs*1.2)+'px;height:'+(fs*0.22)+'px;background:#FF8A3D;vertical-align:middle;margin-right:'+(fs*0.5)+'px;transform:skewX(-14deg)"></span>'+txt+'</div>');
  return {n,a,b,head:heads[i]};
});

// Phones with real app screens (demo data).
function phone(src,a,b,side){
  let w,x,y,rot;
  if(TALL){w=330;x=W-S.right-w+20;y=S.top+70;rot=6}
  else if(WIDE){w=330;x=W-S.right-w-120;y=110;rot=5}
  else{w=270;x=W-S.right-w+6;y=S.top+40;rot=6}
  const n=el('<div class="abs phone" style="left:'+x+'px;top:'+y+'px;width:'+w+'px"><img src="'+src+'"></div>');
  return {n,a,b,rot};
}
const phones=[phone(SHOTS.log,3.25,6.5),phone(SHOTS.progress,6.75,10.0)];

// Cut wipes: a lime band on the logo's dyno angle sweeps across each cut.
const wipe=el('<div class="abs" style="left:0;top:0;width:'+W+'px;height:'+H+'px;overflow:hidden"><div class="band abs" style="background:#C6F432"></div><div class="band2 abs" style="background:#FF8A3D"></div></div>');
const band=wipe.querySelector('.band'),band2=wipe.querySelector('.band2');
const diag=Math.hypot(W,H);
[band,band2].forEach((b,i)=>{b.style.width=(i?diag*0.06:diag*0.42)+'px';b.style.height=(diag*2)+'px';b.style.left=(W/2)+'px';b.style.top=(H/2-diag)+'px'});
const CUTS=[3.0,6.5,10.0];

// End card.
const endW=TALL?W-2*S.left-40:WIDE?1080:W-2*S.left-60;
const endLogoH=endW*118/832;
const end=el('<div class="abs" style="left:0;top:0;width:'+W+'px;height:'+H+'px;background:#111214"></div>');
end.innerHTML='<svg class="abs ridge" viewBox="0 0 100 100" preserveAspectRatio="none" style="left:0;top:0;width:100%;height:100%"><polygon points="0,100 0,91 14.29,85 28.57,88 42.86,77.5 57.14,82 71.43,71 85.71,78 100,74 100,100" fill="#C6F432" fill-opacity="0.16"/></svg>';
const midY=TALL?(S.top+(H-S.bottom))/2-60:H/2-(WIDE?40:20);
const endBox=el('<div class="abs" style="left:0;width:'+W+'px;top:'+(midY-endLogoH)+'px;display:flex;flex-direction:column;align-items:center;text-align:center"></div>');
end.appendChild(endBox);
endBox.innerHTML='<div class="elogo">'+logo(endLogoH,'#F2F1EC','L')+'</div>'
 +'<div class="tag" style="margin-top:'+(TALL?44:30)+'px;font-weight:700;font-size:'+(TALL?50:WIDE?44:40)+'px;color:#D5D6DA">The fast logbook for indoor climbers</div>'
 +'<div class="cta" style="margin-top:'+(TALL?56:WIDE?40:36)+'px;background:#C6F432;color:#111214;border-radius:999px;padding:'+(TALL?'26px 54px':'20px 44px')+';font-weight:900;font-size:'+(TALL?50:WIDE?42:38)+'px;letter-spacing:-.01em">Try it free · studio-vektor.com/send</div>'
 +'<div class="note" style="margin-top:'+(TALL?36:26)+'px;font-weight:600;font-size:'+(TALL?34:WIDE?30:28)+'px;color:#9A9CA3;letter-spacing:.02em">iPhone & Android apps coming soon</div>';
root.appendChild(end);
const eLetters=[...end.querySelectorAll('path.L')],eHold=end.querySelector('.hold'),eTag=end.querySelector('.tag'),eCta=end.querySelector('.cta'),eNote=end.querySelector('.note'),ridge=end.querySelector('.ridge');

// ---- frame renderer ----
window.render=(t)=>{
  scrim.style.opacity=t<12.5?1:0;
  topLogo.style.opacity=clamp(prog(t,0.1,0.4))*(t<12.4?1:0);
  topLogo.style.transform='translateY('+(-20*(1-outExpo(prog(t,0.1,0.5))))+'px)';
  heads.forEach(({n,a,b,spans})=>{
    const on=t>=a&&t<b;n.style.display=on?'block':'none';if(!on)return;
    spans.forEach((s,i)=>{
      const p=prog(t,a+0.08+i*0.14,0.42),q=outBack(p),o=clamp(p*3);
      const exit=inExpo(prog(t,b-0.22,0.22));
      s.style.opacity=o*(1-exit);
      s.style.transform='skewX(-9deg) translateX('+((1-q)*-0.35*W+exit*0.06*W)+'px) scale('+(1+(1-outExpo(p))*0.25)+')';
    });
  });
  labels.forEach(({n,a,b,head})=>{
    const on=t>=a&&t<b;n.style.display=on?'block':'none';if(!on)return;
    n.style.top=(head.n.offsetTop-(TALL?70:56))+'px';
    const p=outExpo(prog(t,a+0.45,0.4)),exit=inExpo(prog(t,b-0.22,0.22));
    n.style.opacity=clamp(p)*(1-exit);n.style.transform='translateY('+((1-p)*24)+'px)';
  });
  phones.forEach(({n,a,b,rot})=>{
    const on=t>=a-0.01&&t<b;n.style.display=on?'block':'none';if(!on)return;
    const p=outBack(prog(t,a,0.55)),exit=inExpo(prog(t,b-0.25,0.25));
    const float=Math.sin((t-a)*2.2)*6;
    n.style.opacity=clamp(prog(t,a,0.15))*(1-exit);
    n.style.transform='translateY('+((1-p)*H*0.6+float-exit*80)+'px) rotate('+(rot+(1-p)*14)+'deg)';
  });
  // wipes: 0.24 s across, centred on each cut
  let shown=false;
  for(const c of CUTS){const p=prog(t,c-0.12,0.24);if(p>0&&p<1){shown=true;
    const x=(-1+2*p)*(W/2+diag*0.3);
    band.style.transform='translateX('+x+'px) rotate(28deg)';band2.style.transform='translateX('+(x-diag*0.26)+'px) rotate(28deg)';}}
  wipe.style.display=shown?'block':'none';
  // end card: lime band sweeps, card behind it
  const ep=prog(t,12.38,0.24);
  if(t>=12.38&&t<12.62){wipe.style.display='block';const x=(-1+2*ep)*(W/2+diag*0.3);band.style.transform='translateX('+x+'px) rotate(28deg)';band2.style.transform='translateX('+(x-diag*0.26)+'px) rotate(28deg)';}
  end.style.display=t>=12.5?'block':'none';
  if(t>=12.5){
    ridge.style.transform='translateY('+((1-outExpo(prog(t,12.5,0.7)))*30)+'%)';
    eLetters.forEach((L,i)=>{const p=outBack(prog(t,12.55+i*0.05,0.4));L.style.opacity=clamp(prog(t,12.55+i*0.05,0.12));L.style.transform='translateY('+((1-p)*-60)+'px)';});
    const hp=outBack(prog(t,13.05,0.35));eHold.style.transformBox='fill-box';eHold.style.transformOrigin='center';eHold.style.transform='scale('+(hp*1.0+0.0001)+')';
    [[eTag,13.1],[eCta,13.3],[eNote,13.5]].forEach(([n,a])=>{const p=outExpo(prog(t,a,0.45));n.style.opacity=clamp(p);n.style.transform='translateY('+((1-p)*30)+'px)'});
    const pulse=t>13.8?1+0.035*Math.sin((t-13.8)*Math.PI*2/0.9):1;eCta.style.transform+=' scale('+pulse+')';
  }
};
</script></body></html>`;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(cmd + ' failed: ' + r.status);
}

function videoFilter(f) {
  const parts = CLIPS.map(([, , len], i) => {
    let geo;
    if (f.kind === 'wide') geo = `scale=${f.w}:${f.h}`;
    else {
      const ch = 1080, cw = f.kind === 'tall' ? Math.round((1080 * f.w) / f.h / 2) * 2 : 1080;
      const cx = Math.round(Math.min(1920 - cw, Math.max(0, FOCUS[f.kind][i] * 1920 - cw / 2)));
      geo = `crop=${cw}:${ch}:${cx}:0,scale=${f.w}:${f.h}`;
    }
    // Slow push-in for energy, then back to the exact size.
    const zoom = `scale=w='trunc(${f.w}*(1+0.07*t/${len})/2)*2':h=-2:eval=frame,crop=${f.w}:${f.h}`;
    return `[${i}:v]fps=${FPS},setpts=PTS-STARTPTS,${geo},${zoom},setsar=1,eq=contrast=1.07:saturation=1.18,format=yuv420p[v${i}]`;
  });
  return parts.join(';') + `;${CLIPS.map((_, i) => `[v${i}]`).join('')}concat=n=${CLIPS.length}:v=1:a=0[bg];[bg][${CLIPS.length}:v]overlay=0:0:format=auto,format=yuv420p[out]`;
}

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FORMATS);
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 300000 });
try {
  // Real app screens from the dev server (demo account).
  const shots = {};
  const app = await browser.newPage();
  await app.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
  await app.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  for (const [k, route] of Object.entries(SCREENS)) {
    await app.goto(BASE + route, { waitUntil: 'networkidle0' });
    await app.waitForFunction(() => !document.getElementById('launch'), { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 900));
    shots[k] = 'data:image/png;base64,' + (await app.screenshot({ encoding: 'base64' }));
  }
  await app.close();

  for (const name of want) {
    const f = FORMATS[name];
    const dir = join(WORK, name);
    const frames = FPS * DUR;
    // REUSE=1 keeps overlay frames from an earlier run (they only change when this script does).
    const reuse = process.env.REUSE && !process.env.PREVIEW && existsSync(dir) && readdirSync(dir).filter((x) => /^\d{4}\.png$/.test(x)).length === frames;
    if (!reuse) { if (existsSync(dir)) rmSync(dir, { recursive: true }); mkdirSync(dir, { recursive: true }); }
    if (!reuse) {
    const page = await browser.newPage();
    await page.setViewport({ width: f.w, height: f.h, deviceScaleFactor: 1 });
    await page.setContent(overlayPage(f, shots), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.bringToFront();
    if (process.env.PREVIEW) {
      // Stills over a real frame of the clip, for checking the layout: PREVIEW=1.0,4.2,... node store/make-ads.mjs reels
      for (const t of process.env.PREVIEW.split(',').map(Number)) {
        await page.evaluate((t) => window.render(t), t);
        const png = join(dir, `p-${t}.png`);
        await page.screenshot({ path: png, omitBackground: true });
        let acc = 0, ci = 0; while (ci < CLIPS.length - 1 && t >= acc + CLIPS[ci][2]) acc += CLIPS[ci++][2];
        const [file, ss] = CLIPS[ci];
        const one = videoFilter(f).split(';')[ci].replace(`[${ci}:v]`, '[0:v]').replace(/\[v\d\]$/, '[bg]');
        run('ffmpeg', ['-v', 'error', '-y', '-ss', String(ss + t - acc), '-i', join(SRC, file), '-i', png, '-filter_complex', `${one};[bg][1:v]overlay=0:0[o]`, '-map', '[o]', '-frames:v', '1', join(WORK, `${name}-${t}.jpg`)]);
      }
      await page.close();
      continue;
    }
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.render(t), i / FPS);
      await page.screenshot({ path: join(dir, String(i).padStart(4, '0') + '.png'), omitBackground: true });
      if (i % 90 === 0) console.log(name, 'overlay', i, '/', frames);
    }
    await page.close();
    }

    // Pass 1: each shot on its own (one input per ffmpeg run; a multi-input concat deadlocked at the 4th shot).
    const filters = videoFilter(f).split(';').slice(0, CLIPS.length);
    const list = [];
    for (const [k, [file, ss, len]] of CLIPS.entries()) {
      const seg = join(WORK, `${name}-seg${k}.mp4`);
      run('ffmpeg', ['-v', 'error', '-y', '-ss', String(ss), '-t', String(len), '-i', join(SRC, file),
        '-filter_complex', filters[k].replace(`[${k}:v]`, '[0:v]').replace(/\[v\d\]$/, '[o]'), '-map', '[o]',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg]);
      list.push(`file '${seg.replaceAll('\\', '/')}'`);
    }
    const listFile = join(WORK, `${name}-list.txt`);
    writeFileSync(listFile, list.join('\n') + '\n');
    // Pass 2: join the shots, lay the overlay frames on top, add a silent audio track.
    const args = ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-framerate', String(FPS), '-i', join(dir, '%04d.png'),
      '-f', 'lavfi', '-t', String(DUR), '-i', 'anullsrc=r=48000:cl=stereo',
      '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[out]', '-map', '[out]', '-map', '2:a',
      '-t', String(DUR), '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', join(WORK, `${name}.mp4`)];
    // Encode outside OneDrive (it can lock the file while ffmpeg rewrites it for +faststart), then copy.
    if (process.env.DRY) { console.log(JSON.stringify(args)); continue; }
    run('ffmpeg', args);
    copyFileSync(join(WORK, `${name}.mp4`), join(OUT, `DYNOMARK-${name}-${f.w}x${f.h}.mp4`));
    console.log('done', name);
  }
} finally {
  await browser.close();
}
