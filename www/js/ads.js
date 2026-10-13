/* Monetization: rewarded + interstitial ads.
 *  - Android (Capacitor): Unity LevelPlay (free; mediation platform that can also serve AdMob/AppLovin/Meta later).
 *    Needs the keys in PT.config.ads.levelplay. Until appKey is set, "watch to earn" uses the sponsor card (nothing earned).
 *  - Web / PC: optional Google AdSense in the side gutters + a clearly-labelled sponsor card for "watch to earn".
 *  - Players who bought "Remove Ads" / "Pizza Pass" never see interstitials. Rewarded ads are always opt-in. */
(function () {
  const PT = window.PT, cfg = PT.config, ad = cfg.ads, lpc = ad.levelplay || {};
  const native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const electron = /Electron/i.test(navigator.userAgent);
  const configured = native && !!lpc.appKey;       // real ad network on this device?

  let LP = null, ready = false, rewardEarned = false;
  let rewardedLoaded = false, interLoaded = false, rewardedClosed = null, interClosed = null;

  const adsOff = () => { const s = PT.store.get(); return s.adsRemoved || s.pass; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(test, ms) { const end = Date.now() + ms; while (!test() && Date.now() < end) await sleep(60); return test(); }

  /* What the consent dialog shows (Unity LevelPlay "custom" consent provider). Only the networks listed in package.json
   * ("levelplay.networks") are mediated; add services here when you add networks. */
  const CONSENT = {
    categories: [{ id: 'essential', locked: true, order: 0 }, { id: 'marketing', default: false, order: 1 }],
    services: [
      { id: 'pizza-stack', categoryId: 'essential', default: true, company: { name: 'Pizza Technologies' }, description: 'Saves your progress, coins and settings on this device so the game works offline.' },
      { id: 'levelplay', categoryId: 'marketing', default: false, company: { name: 'Unity Technologies (ironSource)' }, description: 'Unity LevelPlay (formerly ironSource) picks which ad network fills each ad and shows ironSource ads itself (uses your advertising ID).', urls: { privacy: 'https://unity.com/legal/privacy-policy' } },
      { id: 'unity-ads', categoryId: 'marketing', network: 'unityads', default: false, company: { name: 'Unity Technologies' }, description: 'Shows video and full-screen ads and measures them (uses your advertising ID). Declining still lets you play; you may see less relevant ads.', urls: { privacy: 'https://unity.com/legal/privacy-policy' } }
    ]
  };
  const consentOptions = () => ({ services: CONSENT, appName: cfg.game, accentColor: '#ff5d3a', networks: ['unityads'], privacyPolicyUrl: lpc.privacyPolicyUrl || undefined });

  async function init() {
    if (!native) { setupWebAds(); return; }
    if (!configured) { console.info('[ads] LevelPlay app key not set - using the sponsor card for "watch to earn"'); return; }
    try {
      LP = Capacitor.registerPlugin('LevelPlayAds');
      LP.addListener('onRewardedAdLoaded', () => { rewardedLoaded = true; });
      LP.addListener('onRewardedAdLoadFailed', () => { rewardedLoaded = false; });
      LP.addListener('onRewardedAdRewarded', () => { rewardEarned = true; });
      LP.addListener('onRewardedAdDisplayFailed', () => { rewardedLoaded = false; if (rewardedClosed) rewardedClosed(); });
      LP.addListener('onRewardedAdClosed', () => { rewardedLoaded = false; if (rewardedClosed) rewardedClosed(); });
      LP.addListener('onInterstitialAdLoaded', () => { interLoaded = true; });
      LP.addListener('onInterstitialAdLoadFailed', () => { interLoaded = false; });
      LP.addListener('onInterstitialAdDisplayFailed', () => { interLoaded = false; if (interClosed) interClosed(); });
      LP.addListener('onInterstitialAdClosed', () => { interLoaded = false; if (interClosed) interClosed(); });
      // Order matters (plugin contract): consent decision first, then initialize, then load.
      await LP.requestConsentInfo(consentOptions());
      await LP.initialize({ appKey: lpc.appKey, isTesting: !!ad.testMode, userId: PT.store.get().id });
      ready = true;
      loadRewarded(); if (!adsOff()) loadInterstitial();
    } catch (e) { console.warn('[ads] LevelPlay unavailable', e); LP = null; ready = false; }
  }
  const loadRewarded = () => (LP && lpc.rewardedAdUnitId ? LP.loadRewarded({ adUnitId: lpc.rewardedAdUnitId }).catch(() => { rewardedLoaded = false; }) : Promise.resolve());
  const loadInterstitial = () => (LP && lpc.interstitialAdUnitId ? LP.loadInterstitial({ adUnitId: lpc.interstitialAdUnitId }).catch(() => { interLoaded = false; }) : Promise.resolve());

  /* The player can re-open the consent choices from Settings (required for privacy compliance). */
  const hasPrivacyOptions = () => !!(LP && ready);
  async function showPrivacyOptions() { if (LP) { try { await LP.showPrivacyOptions(consentOptions()); } catch (e) { /* closed */ } } }

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
    if (!native || !configured) return houseAd(reason || 'A message from Pizza Technologies');
    if (!LP || !ready) { PT.bus.emit('toast', 'Ads are still loading - try again soon'); return false; }
    try {
      if (!(await LP.isRewardedReady()).isReady) {
        rewardedLoaded = false;
        await loadRewarded();
        if (!(await waitFor(() => rewardedLoaded, lpc.loadWaitMs || 4000))) { PT.bus.emit('toast', 'No video available right now - try again soon'); return false; }
      }
      rewardEarned = false;
      const closed = new Promise(res => { rewardedClosed = res; });
      await LP.showRewarded();
      await Promise.race([closed, sleep(180000)]);          // safety net: never hang the game forever
      rewardedClosed = null;
      const ok = rewardEarned; rewardEarned = false;
      loadRewarded();                                       // preload the next one
      return ok;
    } catch (e) { rewardedClosed = null; PT.bus.emit('toast', 'No video available right now - try again soon'); loadRewarded(); return false; }
  }

  /* Called when a new run starts. Never shown for the first runs or to paying players. */
  async function maybeInterstitial() {
    const st = PT.store.get();
    st.gamesSinceAd++; PT.store.save();
    if (adsOff() || st.games < ad.firstAfterGames || st.gamesSinceAd < ad.interstitialEveryNGames) return;
    if (!(LP && ready)) return;
    try {
      if (!(await LP.isInterstitialReady()).isReady) { loadInterstitial(); return; }
      st.gamesSinceAd = 0; PT.store.save();
      const closed = new Promise(res => { interClosed = res; });
      await LP.showInterstitial();
      await Promise.race([closed, sleep(120000)]);
      interClosed = null;
      loadInterstitial();
    } catch (e) { interClosed = null; }
  }

  PT.ads = { init, showRewarded, maybeInterstitial, native, adsOff, electron, configured, hasPrivacyOptions, showPrivacyOptions };
})();
