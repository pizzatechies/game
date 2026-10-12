// Tests the LevelPlay ad flow in a real browser against a FAKE LevelPlayAds plugin (no real ads/network).
//   node tools/ads-test.js          (needs Playwright + Chromium; set PLAYWRIGHT_MODULE / CHROMIUM if needed)
// Covers: init order (consent -> initialize -> load), rewarded earned / dismissed early / display failed / never loads,
// interstitial throttling + paying players, the unconfigured fallback (sponsor card), and the Settings privacy button.
const { spawn } = require('child_process');
const path = require('path'), assert = require('assert');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PORT = '8104', sleep = ms => new Promise(r => setTimeout(r, ms));

// Installed before any page script: pretends to be the Capacitor Android runtime with a scriptable LevelPlayAds plugin.
const FAKE = (cfg) => `(() => {
  const calls = [], handlers = {}; let ready = { rewarded: false, interstitial: false };
  const script = { loadRewardedOutcome: 'loaded', showRewardedOutcome: 'reward', showInterOutcome: 'closed' };
  const emit = (n, p) => (handlers[n] || []).forEach(f => f(p || {}));
  const plugin = {
    addListener: async (n, f) => { (handlers[n] = handlers[n] || []).push(f); return { remove() {} }; },
    requestConsentInfo: async o => { calls.push(['requestConsentInfo', o]); return { status: 'GRANTED', granted: true, canRequestAds: true }; },
    showPrivacyOptions: async o => { calls.push(['showPrivacyOptions']); return { status: 'GRANTED' }; },
    initialize: async o => { calls.push(['initialize', o]); return { status: 'INITIALIZED_SUCCESSFULLY' }; },
    loadRewarded: async o => { calls.push(['loadRewarded', o]); if (script.loadRewardedOutcome === 'loaded') setTimeout(() => { ready.rewarded = true; emit('onRewardedAdLoaded'); }, 20); else setTimeout(() => emit('onRewardedAdLoadFailed'), 20); },
    isRewardedReady: async () => ({ isReady: ready.rewarded }),
    showRewarded: async () => { calls.push(['showRewarded']); ready.rewarded = false;
      setTimeout(() => { const o = script.showRewardedOutcome;
        if (o === 'reward') { emit('onRewardedAdRewarded', { rewardName: 'coins', rewardAmount: 1 }); emit('onRewardedAdClosed'); }
        else if (o === 'dismiss') emit('onRewardedAdClosed'); else if (o === 'fail') emit('onRewardedAdDisplayFailed'); }, 30); },
    loadInterstitial: async o => { calls.push(['loadInterstitial', o]); setTimeout(() => { ready.interstitial = true; emit('onInterstitialAdLoaded'); }, 20); },
    isInterstitialReady: async () => ({ isReady: ready.interstitial }),
    showInterstitial: async () => { calls.push(['showInterstitial']); ready.interstitial = false; setTimeout(() => emit('onInterstitialAdClosed'), 30); }
  };
  window.__fake = { calls, script, ready };
  window.Capacitor = { isNativePlatform: () => true, registerPlugin: name => (name === 'LevelPlayAds' ? plugin : {}) };
  window.__cfg = ${JSON.stringify(cfg)};
})();`;

(async () => {
  const server = spawn('node', [path.join(__dirname, 'dev-server.js')], { env: Object.assign({}, process.env, { PORT }), stdio: 'ignore' });
  await sleep(700);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  let n = 0; const ok = s => console.log('  ok', ++n, s);
  async function open(cfg, { keys = true, save = {} } = {}) {
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await c2.addInitScript(FAKE(cfg || {}));
    await c2.addInitScript(save0 => { localStorage.setItem('pt_pizzastack_v1', JSON.stringify(Object.assign({ v: 1, id: 'ads-test-player-0001', tutorialDone: true, daily: { last: '2999-01-01', streak: 1 } }, save0))); }, save);
    // serve config.js with the test overrides appended, so ads.js sees them from its very first line
    await c2.route('**/js/config.js', async route => {
      const res = await route.fetch(); let body = await res.text();
      body += `\nObject.assign(PT.config.ads, { interstitialEveryNGames: 2, firstAfterGames: 0 });` + (keys ? `\nObject.assign(PT.config.ads.levelplay, { appKey: 'TESTAPPKEY', rewardedAdUnitId: 'RWD_UNIT', interstitialAdUnitId: 'INT_UNIT', loadWaitMs: 400 });` : '');
      await route.fulfill({ response: res, body });
    });
    const page = await c2.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    return { ctx: c2, page, errs };
  }
  const names = page => page.evaluate(() => __fake.calls.map(c => c[0]));

  // 1. init order + config passthrough
  { const { ctx, page, errs } = await open();
    await page.goto(`http://localhost:${PORT}/`); await page.waitForFunction(() => __fake.calls.some(c => c[0] === 'loadRewarded') && __fake.calls.some(c => c[0] === 'loadInterstitial'), null, { timeout: 8000 });
    const calls = await page.evaluate(() => __fake.calls);
    const order = calls.map(c => c[0]); assert.ok(order.indexOf('requestConsentInfo') < order.indexOf('initialize') && order.indexOf('initialize') < order.indexOf('loadRewarded'), order.join(','));
    const init = calls.find(c => c[0] === 'initialize')[1]; assert.strictEqual(init.appKey, 'TESTAPPKEY'); assert.strictEqual(init.isTesting, true);
    assert.strictEqual(calls.find(c => c[0] === 'loadRewarded')[1].adUnitId, 'RWD_UNIT'); assert.strictEqual(calls.find(c => c[0] === 'loadInterstitial')[1].adUnitId, 'INT_UNIT');
    const consent = calls.find(c => c[0] === 'requestConsentInfo')[1]; assert.ok(consent.services && consent.services.services.some(s => s.network === 'unityads'));
    ok('init order: consent -> initialize(appKey, test mode) -> load rewarded + interstitial with the configured ad units');

    // 2. rewarded: earned
    assert.strictEqual(await page.evaluate(() => PT.ads.showRewarded('t')), true); ok('rewarded ad watched to the end -> reward granted');
    // 3. dismissed early
    await page.evaluate(() => { __fake.script.showRewardedOutcome = 'dismiss'; });
    assert.strictEqual(await page.evaluate(() => PT.ads.showRewarded('t')), false); ok('rewarded ad closed early -> NO reward');
    // 4. display failed
    await page.evaluate(() => { __fake.script.showRewardedOutcome = 'fail'; });
    assert.strictEqual(await page.evaluate(() => PT.ads.showRewarded('t')), false); ok('rewarded ad fails to display -> no reward, game does not hang');
    // 5. never loads
    await sleep(200);       // let the preload started after the previous ad settle first
    await page.evaluate(() => { __fake.script.loadRewardedOutcome = 'fail'; __fake.script.showRewardedOutcome = 'reward'; __fake.ready.rewarded = false; });
    const t0 = Date.now(); assert.strictEqual(await page.evaluate(() => PT.ads.showRewarded('t')), false); assert.ok(Date.now() - t0 < 3000); ok('no video available -> gives up quickly with no reward');
    // 6. interstitial throttling
    await page.evaluate(() => { __fake.script.loadRewardedOutcome = 'loaded'; __fake.calls.length = 0; PT.store.get().games = 5; PT.store.get().gamesSinceAd = 0; });
    await page.evaluate(() => PT.ads.maybeInterstitial()); let nm = await names(page); assert.ok(!nm.includes('showInterstitial'), 'shown too early'); ok('interstitial waits for the Nth run');
    await sleep(100); await page.evaluate(() => PT.ads.maybeInterstitial()); nm = await names(page); assert.strictEqual(nm.filter(x => x === 'showInterstitial').length, 1); ok('interstitial shown on the Nth run');
    // 7. paying players never see interstitials
    await sleep(200); await page.evaluate(() => { __fake.calls.length = 0; const s = PT.store.get(); s.adsRemoved = true; s.gamesSinceAd = 99; });
    await page.evaluate(() => PT.ads.maybeInterstitial()); assert.ok(!(await names(page)).includes('showInterstitial')); ok('"Remove Ads" buyers never get an interstitial');
    // 8. settings privacy button
    await page.evaluate(() => PT.ads.showPrivacyOptions()); assert.ok((await names(page)).includes('showPrivacyOptions')); ok('"Ad & privacy choices" re-opens the consent dialog');
    assert.deepStrictEqual(errs, []); await ctx.close(); }

  // 9. unconfigured native build: sponsor card, no ad SDK calls
  { const { ctx, page, errs } = await open({}, { keys: false });
    await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(800);
    assert.deepStrictEqual(await names(page), []); assert.strictEqual(await page.evaluate(() => PT.ads.configured), false);
    await page.evaluate(() => { PT.config.ads.houseAdSeconds = 1; window.__r = PT.ads.showRewarded('t'); });
    await page.waitForSelector('#houseAd.show'); await page.waitForFunction(() => !document.querySelector('.ha-close').disabled, null, { timeout: 4000 }); await page.click('.ha-close');
    assert.strictEqual(await page.evaluate(() => window.__r), true); ok('no app key yet -> sponsor card fallback, ad SDK never touched');
    assert.deepStrictEqual(errs, []); await ctx.close(); }

  console.log(`\nAll ${n} ad checks passed`);
  await browser.close(); server.kill(); process.exit(0);
})().catch(e => { console.error('ADS TEST FAILED:', e); process.exit(1); });
