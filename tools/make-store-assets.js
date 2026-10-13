// Generates the app-store assets from the REAL running game: store/screenshots (raw captures), store/screenshots-captioned,
// store/feature-graphic-1024x500.jpg and store/icon-512.png.   Usage: node tools/make-store-assets.js
// Needs Playwright + Chromium (set PLAYWRIGHT_MODULE / CHROMIUM if they are not on the default path).
// The screenshots are real frames of the game. They are played by a script (so a tall tower / Pizza Fever / game over can be
// shown on demand) and use a lightly-progressed demo save (some coins and unlocked pizzas) so the shop and missions look lived-in.
// The small ONLINE/OFFLINE status pill is hidden in captures because the score server is not deployed yet.
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..'), OUT = path.join(root, 'store'), RAW = path.join(OUT, 'screenshots'), CAP = path.join(OUT, 'screenshots-captioned');
[OUT, RAW, CAP].forEach(d => fs.mkdirSync(d, { recursive: true }));
const PORT = process.env.STORE_PORT || '8103', BASE = `http://localhost:${PORT}/`;
const W = 360, H = 640, DSF = 3;                       // 1080 x 1920 output
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = new Date(), yest = new Date(Date.now() - 86400000);

function save({ skin, skins, daily, missions }) {
  return {
    v: 1, id: 'store-assets-demo-0001', name: 'Pizzaiolo', best: 96, coins: 1280, totalCoins: 5400, games: 42, perfects: 640, bestCombo: 14, bestHeight: 60,
    skin, skins, up: { dough: 2, coin: 1, perfect: 1 }, settings: { sound: true, music: true, vibe: true },
    daily, missions, adsRemoved: false, pass: false, scoreQueue: [], lbCache: null, gamesSinceAd: 0, tutorialDone: true, claimed: {}
  };
}
const mission = (type, text, goal, reward, progress, done) => ({ type, text, goal, reward, progress, done, claimed: false });
const MISSIONS = { date: dstr(today), list: [mission('height', 'Reach 25 layers in one run', 25, 70, 18, false), mission('perfects', 'Land 25 perfect drops', 25, 80, 25, true), mission('games', 'Play 5 runs', 5, 60, 3, false)] };

(async () => {
  const server = spawn('node', [path.join(__dirname, 'dev-server.js')], { env: Object.assign({}, process.env, { PORT }), stdio: 'ignore' });
  await sleep(700);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const shots = {};

  async function newPage(seed) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true });
    await ctx.addInitScript(s => { try { localStorage.setItem('pt_pizzastack_v1', JSON.stringify(s)); } catch (e) { /* ignore */ } }, seed);
    const page = await ctx.newPage();
    page.on('pageerror', e => { console.error('PAGE ERROR', e.message); });
    await page.goto(BASE);
    await page.addStyleTag({ content: '#netPill,#toast{display:none!important}' });
    return { ctx, page };
  }
  const snap = async (page, name) => { const f = path.join(RAW, name + '.jpg'); await page.screenshot({ path: f, type: 'jpeg', quality: 92 }); shots[name] = f; console.log('captured', name); };
  const waitTitle = async page => { await page.waitForFunction(() => !document.getElementById('splash')); await page.waitForTimeout(800); };
  // drops n layers instantly: perfect unless this index is in `sloppy` (breaks combos so Pizza Fever does not trigger)
  const drops = (page, n, { sloppyEvery = 0, off = 14 } = {}) => page.evaluate(([n, sloppyEvery, off]) => {
    window.__sl = window.__sl || 0;       // alternate the slip direction so the tower stays centred on screen
    for (let i = 0; i < n; i++) { const s = PT.game.state; if (!s || s.over) break; const t = s.layers[s.layers.length - 1]; let o = 0; if (sloppyEvery && i % sloppyEvery === sloppyEvery - 1) o = (window.__sl++ % 2 ? -off : off); s.cur.x = t.x + o; PT.game.tap(); }
  }, [n, sloppyEvery, off]);
  const startRun = async page => { await page.click('#btnPlay', { force: true }); await page.waitForFunction(() => PT.game.state && !PT.game.state.demo); await page.waitForTimeout(400); };

  /* ---- context A: pepperoni pizza, a normal progression ---- */
  {
    const { ctx, page } = await newPage(save({ skin: 'pepperoni', skins: ['margherita', 'pepperoni', 'veggie', 'hawaiian'], daily: { last: dstr(today), streak: 3 }, missions: MISSIONS }));
    await waitTitle(page);
    await page.waitForTimeout(1600); await snap(page, '01-title');
    await page.click('[data-open=shop]'); await page.waitForTimeout(900); await snap(page, '06-shop');
    await page.click('#mClose'); await page.waitForTimeout(300);
    await startRun(page);
    await drops(page, 6); await page.waitForTimeout(260); await snap(page, '02-perfect-combo');
    await drops(page, 2); await page.waitForTimeout(380); await snap(page, '03-pizza-fever');
    await drops(page, 12, { sloppyEvery: 7 });           // fever runs out, combos reset
    await drops(page, 29, { sloppyEvery: 7 });           // reach the City Lights world (45+)
    await page.waitForTimeout(1500); await snap(page, '04-city-lights');
    await page.evaluate(() => { PT.game.state.cur.x = -900; PT.game.tap(); });
    await page.waitForSelector('#over:not(.hidden)', { timeout: 20000 }); await page.waitForTimeout(1500); await snap(page, '08-game-over');
    await ctx.close();
  }
  /* ---- context B: Galaxy Pie skin, climbing to the Orbit world ---- */
  {
    const { ctx, page } = await newPage(save({ skin: 'galaxy', skins: ['margherita', 'pepperoni', 'veggie', 'hawaiian', 'galaxy'], daily: { last: dstr(today), streak: 3 }, missions: MISSIONS }));
    await waitTitle(page); await startRun(page);
    await drops(page, 83, { sloppyEvery: 7 });
    await page.waitForTimeout(1500); await snap(page, '05-orbit-galaxy');
    await ctx.close();
  }
  /* ---- context C: a claimable daily reward + missions ---- */
  {
    const { ctx, page } = await newPage(save({ skin: 'pepperoni', skins: ['margherita', 'pepperoni', 'veggie', 'hawaiian'], daily: { last: dstr(yest), streak: 2 }, missions: MISSIONS }));
    await page.waitForSelector('text=CLAIM', { timeout: 15000 }); await page.waitForTimeout(900); await snap(page, '07-daily-missions');
    await ctx.close();
  }

  /* ---- captioned marketing versions ---- */
  const CAPTIONS = {
    '01-title': ['TAP. STACK. REPEAT.', 'The one-tap pizza stacking game', ['#ff7a45', '#7a1d3a']],
    '02-perfect-combo': ['NAIL THE PERFECT DROP', 'Line it up and build a combo', ['#ffb347', '#c2402a']],
    '03-pizza-fever': ['CHAIN PERFECTS FOR PIZZA FEVER', '8 in a row sets the stack on fire', ['#ff5d3a', '#6a1b9a']],
    '04-city-lights': ['CLIMB THROUGH 5 WORLDS', 'From the kitchen to city lights', ['#3d3a8c', '#e0662a']],
    '05-orbit-galaxy': ['ALL THE WAY TO THE GALAXY', 'Stack high enough to reach space', ['#1c1030', '#a3318a']],
    '06-shop': ['UNLOCK 8 PIZZA STYLES', 'Earn coins every run', ['#ffcc4d', '#d2542a']],
    '07-daily-missions': ['DAILY REWARDS & MISSIONS', 'A new reason to play every day', ['#4fb86a', '#1d5a6a']],
    '08-game-over': ['BEAT YOUR BEST', 'Instant restart. Just one more try', ['#ff7a45', '#4a1d5a']]
  };
  const cap = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (const [name, [title, sub, [c1, c2]]] of Object.entries(CAPTIONS)) {
    const img = 'data:image/jpeg;base64,' + fs.readFileSync(shots[name]).toString('base64');
    await cap.setContent(`<html><body style="margin:0;width:1080px;height:1920px;overflow:hidden;background:linear-gradient(160deg,${c1},${c2});font-family:'Trebuchet MS','Arial Rounded MT Bold','Segoe UI',system-ui,sans-serif;position:relative">
      <div style="position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 78%,rgba(255,255,255,.07) 0 7deg,transparent 7deg 20deg)"></div>
      <div style="position:absolute;left:60px;right:60px;top:70px;text-align:center;color:#fff">
        <div style="font-size:${title.length > 24 ? 74 : 86}px;line-height:1.02;font-weight:900;letter-spacing:1px;text-shadow:0 6px 0 rgba(60,10,0,.45),0 14px 26px rgba(0,0,0,.35)">${title}</div>
        <div style="margin-top:20px;font-size:42px;font-weight:700;opacity:.92;text-shadow:0 3px 8px rgba(0,0,0,.35)">${sub}</div></div>
      <img src="${img}" style="position:absolute;left:140px;top:385px;width:800px;height:1422px;border-radius:60px;border:12px solid #1a0f0a;box-shadow:0 30px 70px rgba(0,0,0,.55);box-sizing:content-box;margin:-12px 0 0 -12px">
      <div style="position:absolute;left:0;right:0;bottom:34px;text-align:center;color:rgba(255,255,255,.85);font-size:30px;letter-spacing:6px;font-weight:700">PIZZA STACK &middot; PIZZA TECHNOLOGIES</div></body></html>`);
    await cap.screenshot({ path: path.join(CAP, name + '.jpg'), type: 'jpeg', quality: 90 });
    console.log('captioned', name);
  }

  /* ---- feature graphic 1024 x 500 ---- */
  const fg = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const fgImg = 'data:image/jpeg;base64,' + fs.readFileSync(shots['03-pizza-fever']).toString('base64');
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'www/img/pt-logo.png')).toString('base64');
  await fg.setContent(`<html><body style="margin:0;width:1024px;height:500px;overflow:hidden;position:relative;background:linear-gradient(120deg,#1c1030 0%,#7a2442 55%,#d2602a 100%);font-family:'Trebuchet MS','Arial Rounded MT Bold','Segoe UI',system-ui,sans-serif">
    <div style="position:absolute;left:640px;top:250px;width:1800px;height:1800px;margin:-900px;background:repeating-conic-gradient(rgba(255,214,102,.14) 0 8deg,transparent 8deg 24deg);-webkit-mask:radial-gradient(circle,#000,transparent 45%);mask:radial-gradient(circle,#000,transparent 45%)"></div>
    <img src="${logo}" style="position:absolute;left:44px;top:30px;width:92px"><div style="position:absolute;left:142px;top:52px;color:#f3cf6e;font-weight:900;letter-spacing:6px;font-size:19px;line-height:1.35">PIZZA<br>TECHNOLOGIES</div>
    <div style="position:absolute;left:44px;top:150px;transform:rotate(-4deg);transform-origin:left top;font-weight:900;line-height:.88;font-size:132px;letter-spacing:2px;-webkit-text-stroke:9px #4a1c0a;paint-order:stroke fill">
      <div style="color:#ffd23f;text-shadow:0 8px 0 #b3380f,0 16px 20px rgba(0,0,0,.45)">PIZZA</div><div style="color:#ff6b3d;text-shadow:0 8px 0 #7c1d0a,0 16px 20px rgba(0,0,0,.45)">STACK</div></div>
    <div style="position:absolute;left:48px;bottom:34px;color:#fff;font-size:29px;font-weight:700;text-shadow:0 3px 8px rgba(0,0,0,.5)">One tap. Endless stacking.</div>
    <img src="${fgImg}" style="position:absolute;left:640px;top:40px;width:300px;height:533px;border-radius:34px;border:8px solid #1a0f0a;box-sizing:content-box;transform:rotate(7deg);box-shadow:0 22px 50px rgba(0,0,0,.55)">
    </body></html>`);
  await fg.screenshot({ path: path.join(OUT, 'feature-graphic-1024x500.jpg'), type: 'jpeg', quality: 92 });
  fs.copyFileSync(path.join(root, 'www/icons/icon-512.png'), path.join(OUT, 'icon-512.png'));
  console.log('feature graphic + icon done');
  await browser.close(); server.kill();
})().catch(e => { console.error(e); process.exit(1); });
