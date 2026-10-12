/* Monetization: rewarded + interstitial ads.
 *  - Android (Capacitor): Google AdMob. Uses Google TEST ids until PT.config.ads.testMode=false and real ids are set.
 *  - Web / PC: optional Google AdSense in the side gutters + clearly-labelled house ad for "watch to earn".
 *  - Players who bought "Remove Ads" / "Pizza Pass" never see interstitials. Rewarded ads are always opt-in. */
(function () {
  const PT = window.PT, cfg = PT.config, ad = cfg.ads;
  const native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  const electron = /Electron/i.test(navigator.userAgent);
  let AdMob = null, ready = false, rewardedReady = false, interReady = false, rewardEarned = false;

  const adsOff = () => { const s = PT.store.get(); return s.adsRemoved || s.pass; };

  async function init() {
    if (!native) { setupWebAds(); return; }
    try {
      AdMob = Capacitor.registerPlugin('AdMob');
      try { // EU/UK consent (Google UMP). Safe to fail.
        const info = await AdMob.requestConsentInfo({});
        if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
      } catch (e) { /* no consent form needed / unavailable */ }
      await AdMob.initialize({ initializeForTesting: !!ad.testMode });
      AdMob.addListener('onRewardedVideoAdReward', () => { rewardEarned = true; });
      AdMob.addListener('onRewardedVideoAdDismissed', () => { rewardedReady = false; prepareRewarded(); });
      AdMob.addListener('onRewardedVideoAdLoaded', () => { rewardedReady = true; });
      AdMob.addListener('interstitialAdLoaded', () => { interReady = true; });
      AdMob.addListener('interstitialAdDismissed', () => { interReady = false; prepareInter(); });
      ready = true;
      prepareRewarded(); if (!adsOff()) prepareInter();
    } catch (e) { console.warn('[ads] AdMob unavailable', e); AdMob = null; }
  }
  const prepareRewarded = () => AdMob && AdMob.prepareRewardVideoAd({ adId: ad.admob.rewarded, isTesting: !!ad.testMode }).then(() => { rewardedReady = true; }).catch(() => { rewardedReady = false; });
  const prepareInter = () => AdMob && AdMob.prepareInterstitial({ adId: ad.admob.interstitial, isTesting: !!ad.testMode }).then(() => { interReady = true; }).catch(() => { interReady = false; });

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
    if (native && AdMob && ready) {
      try {
        rewardEarned = false;
        if (!rewardedReady) { await prepareRewarded(); }
        const item = await AdMob.showRewardVideoAd();   // resolves with the reward item once it is earned
        await new Promise(r => setTimeout(r, 250));      // let the Rewarded event land too
        return rewardEarned || !!item;
      } catch (e) { PT.bus.emit('toast', 'No video available right now - try again soon'); return false; }
    }
    if (native) { PT.bus.emit('toast', 'Ads are still loading - try again soon'); return false; }
    return houseAd(reason || 'A message from Pizza Technologies');
  }

  /* Called after each finished run. Never shown for the first runs or to paying players. */
  async function maybeInterstitial() {
    const st = PT.store.get();
    st.gamesSinceAd++; PT.store.save();
    if (adsOff() || st.games < ad.firstAfterGames || st.gamesSinceAd < ad.interstitialEveryNGames) return;
    if (native && AdMob && ready && interReady) {
      st.gamesSinceAd = 0; PT.store.save();
      try { await AdMob.showInterstitial(); } catch (e) { /* ignore */ }
    }
  }

  PT.ads = { init, showRewarded, maybeInterstitial, native, adsOff, electron };
})();
