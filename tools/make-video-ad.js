// 15-second vertical video ad (1080x1920, 30 fps, H.264 + AAC) for Reels / TikTok / Shorts / Stories.
//   node tools/make-video-ad.js            -> store/ads/pizza-stack-ad-15s-1080x1920.mp4
// Every gameplay frame is the REAL game, played by an autopilot that taps when the pizza lines up.
// Playwright's fake clock steps the game exactly 1/30 s per frame, so the video is smooth however slow capture is.
// The soundtrack is the game's own music ("Slice of Sunday"), rendered offline by tools/music-render.js.
// Storyboard: 0-3 s hook | 3-6.5 s perfect drops | 6.5-9.5 s PIZZA FEVER | 9.5-12 s climb to the galaxy | 12-15 s end card.
const fs = require('fs'), os = require('os'), path = require('path'), { spawn, execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..'), OUT = path.join(root, 'store/ads/pizza-stack-ad-15s-1080x1920.mp4');
const FPS = 30, SECONDS = 15, N = FPS * SECONDS, PORT = '8105';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pizza-ad-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'www/img/pt-logo.png')).toString('base64');

// Text cards: [startSec, endSec, html]. Animated in-page from the frame time (CSS animations would ignore the fake clock).
const CAPTIONS = [
  [0.2, 3.0, '<b>CAN YOU STACK</b><b class="o">IT PERFECTLY?</b>'],
  [3.2, 6.4, '<b>TAP TO DROP</b><small>Line it up for a perfect</small>'],
  [6.7, 9.4, '<b>8 PERFECTS =</b><b class="o">PIZZA FEVER!</b>'],
  [9.7, 12.0, '<b>CLIMB TO THE</b><b class="o">PIZZA GALAXY</b>']
];
const END_AT = 12.0;

(async () => {
  const server = spawn('node', [path.join(__dirname, 'dev-server.js')], { env: Object.assign({}, process.env, { PORT }), stdio: 'ignore' });
  await sleep(700);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const day = new Date(); const today = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  await ctx.addInitScript(t => localStorage.setItem('pt_pizzastack_v1', JSON.stringify({ v: 1, id: 'video-ad-demo-0001', name: 'Pizzaiolo', skin: 'pepperoni', skins: ['margherita', 'pepperoni'], tutorialDone: true, settings: { sound: false, music: false, vibe: false }, daily: { last: t, streak: 3 } })), today);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 15000 });
  await page.addStyleTag({ content: `*{animation:none!important;transition:none!important}#netPill,#toast,#btnPause{display:none!important}
    #adOv{position:absolute;inset:0;z-index:50;pointer-events:none;font-family:'Trebuchet MS','Arial Rounded MT Bold','Segoe UI',system-ui,sans-serif}
    #cap{position:absolute;left:0;right:0;top:25%;text-align:center;transform-origin:50% 50%}
    #cap b{display:block;white-space:nowrap;font-size:40px;line-height:1;font-weight:900;color:#ffd23f;-webkit-text-stroke:5px #4a1c0a;paint-order:stroke fill;text-shadow:0 4px 0 #b3380f,0 8px 14px rgba(0,0,0,.5)}
    #cap b.o{color:#ff6b3d;text-shadow:0 4px 0 #7c1d0a,0 8px 14px rgba(0,0,0,.5);font-size:42px}
    #cap small{display:block;margin-top:8px;font-size:17px;font-weight:700;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.7)}
    #end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:linear-gradient(160deg,#1c1030,#7a2442 55%,#d2602a);opacity:0}
    #end .t{display:flex;flex-direction:column;align-items:center;line-height:.9;font-size:78px;font-weight:900;-webkit-text-stroke:6px #4a1c0a;paint-order:stroke fill;transform:rotate(-4deg)}
    #end .t span:first-child{color:#ffd23f;text-shadow:0 6px 0 #b3380f}#end .t span:last-child{color:#ff6b3d;text-shadow:0 6px 0 #7c1d0a}
    #end .chips{display:flex;gap:8px}#end .chip{background:#ffd23f;color:#4a2400;font-weight:900;font-size:13px;letter-spacing:1px;padding:5px 10px;border-radius:8px}
    #end .cta{margin-top:10px;background:#3fae3a;color:#fff;font-weight:900;font-size:30px;padding:14px 40px;border-radius:22px;box-shadow:0 6px 0 #2a7d27,0 10px 18px rgba(0,0,0,.35)}
    #end .by{display:flex;align-items:center;gap:8px;color:#f3cf6e;font-weight:900;letter-spacing:3px;font-size:12px;position:absolute;bottom:40px}#end .by img{height:34px}` });
  await page.evaluate(logo => {
    const ov = document.createElement('div'); ov.id = 'adOv';
    ov.innerHTML = `<div id="cap"></div><div id="end"><div class="t"><span>PIZZA</span><span>STACK</span></div>
      <div class="chips"><span class="chip">100% AD-FREE</span><span class="chip">PLAYS OFFLINE</span></div>
      <div class="cta">PLAY FREE</div><div class="by"><img src="${logo}">A PIZZA TECHNOLOGIES GAME</div></div>`;
    document.getElementById('stage').appendChild(ov);
  }, LOGO);

  await page.clock.install();
  await page.evaluate(() => PT_debug.startRun());
  // In-page director: autopilot + overlay animation for time t (seconds).
  await page.evaluate(([caps, endAt]) => {
    const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    window.__dir = { mode: 'perfect', climbed: false, sloppy: 0 };
    window.__step = (t) => {
      const s = PT.game.state, d = window.__dir;
      if (s && s.cur && !s.over && d.mode !== 'off') {
        const top = s.layers[s.layers.length - 1], dx = s.cur.x - top.x;
        const want = t < 6.4 && s.combo >= 6 ? 12 : 0;      // before the fever caption: a slightly-off drop shows the slice and keeps fever for its cue
        if (Math.abs(dx - want) < 2.6) PT.game.tap();
      }
      const cap = document.getElementById('cap'), c = caps.find(([a, b]) => t >= a && t < b);
      if (c) { if (cap.dataset.k !== String(c[0])) { cap.innerHTML = c[2]; cap.dataset.k = c[0]; }
        const k = t - c[0], out = c[1] - t, sc = k < .25 ? .4 + ease(k / .25) * .75 : 1.15 - Math.min(.15, (k - .25) * .6);
        cap.style.opacity = Math.min(1, k / .12, out / .2); cap.style.transform = `scale(${sc}) rotate(-3deg)`; }
      else cap.style.opacity = 0;
      const e = document.getElementById('end'), k = t - endAt;
      e.style.opacity = k <= 0 ? 0 : Math.min(1, k / .35);
      if (k > 0) {
        e.querySelector('.t').style.transform = `rotate(-4deg) scale(${k < .5 ? 2.2 - ease(k / .5) * 1.2 : 1 + Math.sin((k - .5) * 3) * .02})`;
        e.querySelector('.cta').style.transform = `scale(${k < .9 ? 0 : 1 + Math.sin((k - .9) * 7) * .05})`;
        e.querySelector('.chips').style.opacity = Math.min(1, Math.max(0, (k - .6) / .3));
      }
    };
  }, [CAPTIONS, END_AT]);

  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    if (Math.abs(t - 6.5) < 1e-6) await page.evaluate(() => { const s = PT.game.state; if (s.fever <= 0) s.combo = 7; });   // the next perfect lights PIZZA FEVER on its caption
    if (Math.abs(t - 9.8) < 1e-6) await page.evaluate(() => {   // fast-forward the tower so the camera sweeps up through the worlds
      window.__dir.mode = 'off'; let i = 0;
      for (; i < 82; i++) { const s = PT.game.state; if (!s || s.over) break; const top = s.layers[s.layers.length - 1]; s.cur.x = top.x + (i % 7 === 6 ? (i % 2 ? -10 : 10) : 0); PT.game.tap(); }
    });
    if (Math.abs(t - 11.0) < 1e-6) await page.evaluate(() => { window.__dir.mode = 'perfect'; });
    for (let sub = 0; sub < 4; sub++) { await page.clock.runFor(1000 / FPS / 4); await page.evaluate(tt => window.__step(tt), t + sub / FPS / 4); }
    await page.screenshot({ path: path.join(TMP, `f${String(f).padStart(4, '0')}.png`) });
    if (f % 30 === 0) process.stdout.write(`frame ${f}/${N}\r`);
  }
  await browser.close(); server.kill();

  // Soundtrack: the game's own music, 15 s with a fade out.
  const wav = path.join(TMP, 'music.wav');
  try { execFileSync('node', [path.join(__dirname, 'music-render.js'), wav], { env: Object.assign({}, process.env, { LOOPS: '2', MUSIC_GAIN: '0.6' }), stdio: 'ignore' }); } catch (e) { /* the renderer's quality gate may complain; the WAV is still written */ }
  const audio = fs.existsSync(wav) ? ['-i', wav, '-af', `atrim=0:${SECONDS},afade=t=in:d=0.3,afade=t=out:st=${SECONDS - 1.2}:d=1.2`, '-c:a', 'aac', '-b:a', '160k'] : [];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(TMP, 'f%04d.png'), ...audio,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-vf', 'scale=1080:1920:flags=lanczos', '-movflags', '+faststart', '-t', String(SECONDS), OUT], { stdio: 'inherit' });
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('\nvideo ad:', path.relative(root, OUT));
})().catch(e => { console.error(e); process.exit(1); });
