/* Monetization: rewarded + interstitial ads.
 *  - Android (Capacitor): Unity LevelPlay (free; mediation platform that can also serve AdMob/AppLovin/Meta later).
 *    Needs the keys in PT.config.ads.levelplay. Until appKey is set, "watch to earn" uses the sponsor card (nothing earned).
 *  - Web / PC: optional Google AdSense in the side gutters + a clearly-labelled sponsor card for "watch to earn".
 *  - Players who bought "Remove Ads" / "Pizza Pass" never see interstitials. Rewarded ads are always opt-in. */
(function () {
  const PT = window.PT, cfg = PT.config, ad = cfg.ads, lpc = ad.levelplay || {};
  const native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const electron = /Electron/i.test(navigator.userAgent);
  // real ad network on this device? needs the app key AND at least one ad unit id; each format also needs its own unit id
  const configured = native && !!lpc.appKey && !!(lpc.rewardedAdUnitId || lpc.interstitialAdUnitId);

  let LP = null, ready = false, rewardEarned = false, cancelled = false;
  /* The Android bridge provides Capacitor.nativePromise / Capacitor.addListener but NOT registerPlugin (that only exists when the
   * Capacitor JS library is bundled, which this no-build game does not do). So call the native plugin through the primitives. */
  function nativePlugin() {
    if (typeof Capacitor.registerPlugin === 'function') return Capacitor.registerPlugin('LevelPlayAds');   // works too if the JS library is ever bundled
    if (typeof Capacitor.nativePromise !== 'function') throw new Error('Capacitor bridge is missing nativePromise');
    const call = m => o => Capacitor.nativePromise('LevelPlayAds', m, o || {});
    const out = { addListener: (n, cb) => Capacitor.addListener('LevelPlayAds', n, cb) };
    ['requestConsentInfo', 'showPrivacyOptions', 'initialize', 'loadRewarded', 'isRewardedReady', 'showRewarded', 'loadInterstitial', 'isInterstitialReady', 'showInterstitial', 'launchTestSuite', 'getAdvertisingId']
      .forEach(m => { out[m] = call(m); });
    return out;
  }
  const adsOff = () => { const s = PT.store.get(); return s.adsRemoved || s.pass; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const gap = lpc.minLoadGapMs || 2500, retryBase = lpc.retryBaseMs || 3000;
  const short = e => { const m = String((e && (e.errorMessage || e.message)) || e || '').trim(); const c = e && e.errorCode != null ? e.errorCode + ': ' : ''; return (c + m).slice(0, 90); };

  /* One "slot" per ad format. It tracks loaded/loading/failed from the plugin's own events, retries failed loads with a
   * growing delay (a new ad unit often has no fill for a while), and remembers the last error so Settings can show it. */
  function Slot(kind, unitId) {
    const sl = { kind, unitId, loaded: false, loading: false, fails: 0, lastError: '', timer: null, closed: null };
    sl.schedule = (ms) => { clearTimeout(sl.timer); sl.timer = setTimeout(sl.load, ms != null ? ms : Math.min(60000, retryBase * Math.pow(2, Math.max(0, sl.fails - 1)))); };
    sl.load = () => {
      if (!LP || !unitId || sl.loaded || sl.loading) return Promise.resolve();
      sl.loading = true;
      return LP['load' + kind]({ adUnitId: unitId, retryInterval: gap }).then(() => { /* the Loaded event sets state */ }, (e) => {
        const m = String((e && e.message) || e || '');
        if (/superseded/i.test(m)) return;                                  // a newer load replaced it: that one reports
        sl.loading = false;
        if (/too fast/i.test(m)) { sl.schedule(gap + 200); return; }          // our own throttle: simply try again a moment later
        if (!sl.lastError) sl.lastError = short(e);
      });
    };
    sl.listen = () => {
      LP.addListener(`on${kind}AdLoaded`, () => { sl.loaded = true; sl.loading = false; sl.fails = 0; sl.lastError = ''; clearTimeout(sl.timer); });
      LP.addListener(`on${kind}AdLoadFailed`, (e) => { sl.loaded = false; sl.loading = false; sl.fails++; sl.lastError = short(e); sl.schedule(); });
      LP.addListener(`on${kind}AdDisplayFailed`, (e) => { sl.loaded = false; sl.lastError = short(e); if (sl.closed) sl.closed(); sl.schedule(500); });
      LP.addListener(`on${kind}AdClosed`, () => { sl.loaded = false; if (sl.closed) sl.closed(); sl.schedule(gap + 300); });   // the plugin auto-reloads too; this is the safety net
    };
    return sl;
  }
  let rewarded = null, inter = null;

  /* First launch: the plugin shows a native Accept / Decline dialog and waits for the answer before any ad loads. The answer is
   * passed to Unity LevelPlay (and the Unity Ads network). It is a simple dialog, not an IAB-certified CMP. */
  const consentOptions = () => ({
    title: 'Ads and your privacy',
    message: cfg.game + ' is free thanks to ads. Our ad partners (Unity LevelPlay / ironSource and Unity Ads) use your advertising ID to show and measure ads. Accept to see personalised ads, or decline to keep ads less personalised. You can change this any time in Settings > Ad & privacy choices.',
    acceptButtonText: 'Accept', declineButtonText: 'Decline',
    networks: ['unityads'], privacyPolicyUrl: lpc.privacyPolicyUrl || undefined
  });

  let stage = 'idle', initError = '', initFails = 0, starting = null, initTimer = null, listening = false;
  /* Starts the ad SDK: consent -> initialize -> first load. If anything fails it retries by itself (growing delay), so one
   * hiccup at launch (no network yet, SDK busy...) never leaves ads dead until the app is restarted. */
  function startAds() {
    if (ready) return Promise.resolve();
    if (starting) return starting;
    starting = (async () => {
      try {
        LP = LP || nativePlugin();
        rewarded = rewarded || Slot('Rewarded', lpc.rewardedAdUnitId); inter = inter || Slot('Interstitial', lpc.interstitialAdUnitId);
        if (!listening) { listening = true; rewarded.listen(); inter.listen(); LP.addListener('onRewardedAdRewarded', () => { rewardEarned = true; }); }
        stage = 'consent';     // the plugin shows a native privacy dialog on the very first launch and waits for the answer
        await LP.requestConsentInfo(consentOptions());
        stage = 'initialize';
        await LP.initialize({ appKey: lpc.appKey, isTesting: !!ad.testMode, userId: PT.store.get().id });
        ready = true; stage = 'ready'; initError = ''; initFails = 0;
        rewarded.load(); if (!adsOff()) inter.load();
      } catch (e) {
        ready = false; initFails++; initError = stage + ': ' + short(e);
        console.warn('[ads] start failed', initError);
        clearTimeout(initTimer); initTimer = setTimeout(startAds, Math.min(60000, retryBase * Math.pow(2, Math.min(initFails, 5))));
      } finally { starting = null; }
    })();
    return starting;
  }
  async function init() {
    if (!native) { setupWebAds(); return; }
    if (!configured) { console.info('[ads] LevelPlay app key / ad unit ids not set - using the sponsor card for "watch to earn"'); return; }
    startAds();
  }

  /* The player can re-open the consent choices from Settings (required for privacy compliance). */
  const hasPrivacyOptions = () => !!(LP && ready);
  async function showPrivacyOptions() { if (LP) { try { await LP.showPrivacyOptions(consentOptions()); } catch (e) { /* closed */ } } }

  /* A one-line summary for Settings, so a slow or failing ad can be diagnosed from a phone. */
  function status() {
    if (!native || !configured) return null;
    if (!ready) {
      if (initError) return { state: 'failed', text: 'Ads could not start (' + initError + ') - retrying' + (initFails > 1 ? ` · tried ${initFails}x` : '') };
      return { state: 'starting', text: stage === 'consent' ? 'Waiting for your privacy choice…' : 'Ads are starting…' };
    }
    if (rewarded.loaded) return { state: 'ready', text: 'Rewarded video: ready' };
    if (rewarded.loading) return { state: 'loading', text: 'Rewarded video: loading…' };
    return { state: 'failed', text: 'Rewarded video: not available yet' + (rewarded.lastError ? ' (' + rewarded.lastError + ')' : '') + (rewarded.fails ? ` · tried ${rewarded.fails}x` : '') };
  }
  const cancelWait = () => { cancelled = true; };

  /* Test-build helpers (shown in Settings while ads.testMode is on): LevelPlay's own Test Suite shows which ad networks are
   * integrated and lets you load a test ad per network; the device advertising ID is what the dashboard needs to register a test device. */
  async function launchTestSuite() { if (LP && ready) { try { await LP.launchTestSuite(); } catch (e) { PT.bus.emit('toast', 'Test suite unavailable: ' + short(e)); } } }
  async function deviceAdId() { if (!(LP && ready)) return null; try { const r = await LP.getAdvertisingId(); return r && r.id ? r.id + (r.limited ? ' (ad tracking limited)' : '') : null; } catch (e) { return null; } }

  /* ---------- web / PC ---------- */
  function setupWebAds() {
    if (electron || !ad.adsenseClient) return;
    const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ad.adsenseClient);
    s.onerror = () => { /* offline: simply no ads */ };
    document.head.appendChild(s);
    [['slotL', ad.adsenseSlots.left], ['slotR', ad.adsenseSlots.right]].forEach(([id, slot]) => {
      const el = document.getElementById(id); if (!el || !slot) return;
      el.innerHTML = `<ins class="adsbygoogle" style="display:block;width:160px;height:600px" data-ad-client="${ad.adsenseClient}" data-ad-slot="${slot}"></ins>`;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ignore */ }
    });
  }

  function houseAd(title) {
    return new Promise(resolve => {
      const el = document.getElementById('houseAd'); if (!el) return resolve(true);
      let left = ad.houseAdSeconds;
      el.querySelector('.ha-title').textContent = title || 'Sponsored';
      const btn = el.querySelector('.ha-close'), cnt = el.querySelector('.ha-count');
      btn.disabled = true; cnt.textContent = left; el.classList.add('show');
      const iv = setInterval(() => {
        left--; cnt.textContent = Math.max(0, left);
        if (left <= 0) { clearInterval(iv); btn.disabled = false; cnt.textContent = '✓'; }
      }, 1000);
      btn.onclick = () => { if (btn.disabled) return; el.classList.remove('show'); resolve(true); };
    });
  }

  /* Resolves true if the player earned the reward. */
  async function showRewarded(reason) {
    if (!native || !configured || !lpc.rewardedAdUnitId) return houseAd(reason || 'A message from Pizza Technologies');
    try {
      if (!ready) {                                    // the SDK has not finished starting: help it along and wait for it
        cancelled = false; PT.bus.emit('ads-wait', true);
        clearTimeout(initTimer); startAds();
        const end0 = Date.now() + (lpc.loadWaitMs || 10000);
        while (!cancelled && !ready && (stage === 'consent' || Date.now() < end0)) {   // never time out while the privacy dialog is open
          if (!starting && !initTimer) startAds();
          await sleep(80);
        }
        PT.bus.emit('ads-wait', false);
        if (cancelled) { cancelled = false; return false; }
        if (!ready) { PT.bus.emit('toast', 'Ads could not start' + (initError ? ' (' + initError.slice(0, 60) + ')' : '') + ' - retrying'); return false; }
      }
      let isReady = (await LP.isRewardedReady()).isReady;
      if (!isReady) {                                  // not loaded yet: show progress, push a load now and wait for it
        cancelled = false; PT.bus.emit('ads-wait', true);
        rewarded.loaded = false; clearTimeout(rewarded.timer); rewarded.load();
        const end = Date.now() + (lpc.loadWaitMs || 10000);
        while (!cancelled && Date.now() < end && !rewarded.loaded) {
          if (rewarded.fails >= 2 && !rewarded.loading) break;          // two failures in a row: stop waiting, tell the player why
          if (!rewarded.loading && !rewarded.timer) rewarded.load();
          await sleep(80);
        }
        PT.bus.emit('ads-wait', false);
        isReady = rewarded.loaded;
        if (cancelled) { cancelled = false; return false; }
        if (!isReady) { PT.bus.emit('toast', 'No video available right now - try again in a moment'); return false; }
      }
      rewardEarned = false;
      const closed = new Promise(res => { rewarded.closed = res; });
      await LP.showRewarded();
      await Promise.race([closed, sleep(180000)]);          // safety net: never hang the game forever
      rewarded.closed = null;
      const ok = rewardEarned; rewardEarned = false;
      return ok;                                            // the plugin reloads the next video by itself
    } catch (e) { PT.bus.emit('ads-wait', false); if (rewarded) { rewarded.closed = null; rewarded.lastError = short(e); rewarded.loaded = false; rewarded.schedule(1500); } PT.bus.emit('toast', 'No video available right now - try again in a moment'); return false; }
  }

  /* Called when a new run starts. Never shown for the first runs or to paying players. */
  async function maybeInterstitial() {
    const st = PT.store.get();
    st.gamesSinceAd++; PT.store.save();
    if (adsOff() || st.games < ad.firstAfterGames || st.gamesSinceAd < ad.interstitialEveryNGames) return;
    if (!(LP && ready) || !lpc.interstitialAdUnitId) { if (!ready && configured) startAds(); return; }
    try {
      if (!(await LP.isInterstitialReady()).isReady) { inter.load(); return; }
      st.gamesSinceAd = 0; PT.store.save();
      const closed = new Promise(res => { inter.closed = res; });
      await LP.showInterstitial();
      await Promise.race([closed, sleep(120000)]);
      inter.closed = null;
    } catch (e) { inter.closed = null; inter.schedule(1500); }
  }

  PT.ads = { init, showRewarded, maybeInterstitial, native, adsOff, electron, configured, hasPrivacyOptions, showPrivacyOptions, status, cancelWait, launchTestSuite, deviceAdId };
})();
