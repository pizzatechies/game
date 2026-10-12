// Browser end-to-end test (needs Playwright + Chromium). Run: node tools/e2e.js
// Starts the static dev server and the score server, then drives the real game.
const { spawn } = require('child_process');
const os = require('os'), fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('assert');
const OUT = process.env.SHOTS || path.join(os.tmpdir(), 'pizza-shots'); fs.mkdirSync(OUT, { recursive: true });
const procs = [];
const run = (file, env) => { const p = spawn('node', [file], { env: Object.assign({}, process.env, env), stdio: 'ignore' }); procs.push(p); return p; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  run(path.join(__dirname, 'dev-server.js'), { PORT: '8099' });
  run(path.join(__dirname, '..', 'server', 'server.js'), { PORT: '8788', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'ps-')) });
  await sleep(800);
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'allow' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
  let n = 0; const ok = s => console.log('  ok', ++n, s);

  await p.goto('http://localhost:8099/');
  await p.evaluate(() => { PT.config.apiBase = 'http://localhost:8788'; PT.config.ads.houseAdSeconds = 1; });
  await p.waitForFunction(() => document.getElementById('splash') === null || document.getElementById('splash').classList.contains('out'), null, { timeout: 14000 });
  await p.waitForSelector('text=CLAIM 50 COINS'); await p.click('text=CLAIM 50 COINS'); await p.click('#mClose');
  assert.strictEqual(await p.evaluate(() => PT.store.get().coins), 50); ok('first-launch daily reward claimed (+50 coins)');

  await p.click('#btnPlay', { force: true });
  await p.waitForFunction(() => PT.game.state && !PT.game.state.demo); ok('run started from title');
  const drop = (off) => p.evaluate((off) => { const s = PT.game.state, t = s.layers[s.layers.length - 1]; s.cur.x = t.x + off; return PT.game.tap(); }, off);
  for (let i = 0; i < 8; i++) await drop(1);
  let st = await p.evaluate(() => { const s = PT.game.state; return { combo: s.combo, fever: s.fever, score: s.score }; });
  assert.ok(st.combo === 8 && st.fever > 0, JSON.stringify(st)); ok('8 perfects trigger PIZZA FEVER ' + JSON.stringify(st));
  await p.waitForTimeout(300); await p.screenshot({ path: path.join(OUT, 'fever.png') });
  await drop(40);
  st = await p.evaluate(() => { const s = PT.game.state; return { combo: s.combo, fever: s.fever, w: s.layers[s.layers.length - 1].w }; });
  assert.ok(st.combo === 0 && st.fever === 0 && st.w < 210); ok('sloppy drop trims the pizza and ends fever');

  // real pointer tap works
  const before = await p.evaluate(() => PT.game.state.layers.length);
  await p.evaluate(() => { const s = PT.game.state, t = s.layers[s.layers.length - 1]; s.cur.x = t.x; });
  await p.mouse.click(195, 300);
  assert.strictEqual(await p.evaluate(() => PT.game.state.layers.length), before + 1); ok('pointer tap drops a layer');

  // game over
  await p.evaluate(() => { PT.game.state.cur.x = -900; PT.game.tap(); });
  await p.waitForSelector('#over:not(.hidden)', { timeout: 15000 }); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, 'gameover.png') });
  const score = await p.evaluate(() => PT.store.get().best); assert.ok(score > 10); ok('game over screen, best score saved: ' + score);

  // revive through the sponsor ad (web)
  await p.click('#btnRevive');
  await p.waitForSelector('#houseAd.show'); await p.screenshot({ path: path.join(OUT, 'housead.png') });
  await p.waitForFunction(() => !document.querySelector('.ha-close').disabled, null, { timeout: 5000 }); await p.click('.ha-close');
  await p.waitForSelector('#hud:not(.hidden)');
  assert.strictEqual(await p.evaluate(() => PT.game.state.over), false); ok('rewarded ad -> revive continues the same tower');
  await p.evaluate(() => { PT.game.state.cur.x = -900; PT.game.tap(); });
  await p.waitForSelector('#over:not(.hidden)', { timeout: 15000 });
  assert.ok(await p.isHidden('#btnRevive')); ok('revive is limited to once per run');

  // double coins ad
  const c0 = await p.evaluate(() => PT.store.get().coins); await p.click('#btnDouble');
  await p.waitForFunction(() => !document.querySelector('.ha-close').disabled, null, { timeout: 5000 }); await p.click('.ha-close');
  await p.waitForTimeout(300); assert.ok(await p.evaluate(() => PT.store.get().coins) > c0); ok('double-coins ad pays out');

  // online: score reached the server and shows in the leaderboard
  await p.waitForFunction(async () => (await (await fetch('http://localhost:8788/api/leaderboard')).json()).top.length > 0, null, { timeout: 14000 }); ok('score synced to online server');
  await p.click('#btnHome'); await p.click('[data-open=board]'); await p.waitForSelector('.lb li.me'); ok('leaderboard shows the player (online)');
  await p.screenshot({ path: path.join(OUT, 'board.png') }); await p.click('#mClose');

  // offline: scores queue up and sync later; the app still loads from the service worker cache
  await p.evaluate(() => PT.net.leaderboard()); // warm cache
  await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(500);
  await ctx.setOffline(true);
  await p.reload(); await p.waitForSelector('#btnPlay', { timeout: 8000 }); ok('app reloads fully offline (service worker)');
  await p.evaluate(() => { PT.config.apiBase = 'http://localhost:8788'; });
  await p.waitForTimeout(3000);
  await p.click('#btnPlay', { force: true }); await p.waitForFunction(() => PT.game.state && !PT.game.state.demo);
  for (let i = 0; i < 4; i++) await drop(0);
  await p.evaluate(() => { PT.game.state.cur.x = -900; PT.game.tap(); });
  await p.waitForSelector('#over:not(.hidden)', { timeout: 15000 });
  const q = await p.evaluate(() => PT.store.get().scoreQueue.length); assert.ok(q >= 1); ok('offline run queued for sync (' + q + ')');
  await ctx.setOffline(false);
  await p.evaluate(() => PT.net.ping()); await p.waitForFunction(() => PT.store.get().scoreQueue.length === 0, null, { timeout: 14000 }); ok('queue flushed when back online');

  assert.deepStrictEqual(errs, []); ok('no console errors');
  console.log(`\nAll ${n} e2e checks passed. Screenshots: ${OUT}`);
  await b.close(); procs.forEach(x => x.kill()); process.exit(0);
})().catch(e => { console.error('E2E FAILED:', e); procs.forEach(x => x.kill()); process.exit(1); });
