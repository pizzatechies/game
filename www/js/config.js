/* Pizza Stack - configuration.
 * Everything a publisher needs to change lives here (ad ids, server URL, store links).
 * Defaults are SAFE: Google's public AdMob TEST ids, no server (offline-only leaderboard), no store links. */
window.PT = window.PT || {};
window.PT.config = {
  studio: 'Pizza Technologies',
  studioUrl: 'https://pizzatechnologies.com',
  game: 'Pizza Stack',
  version: '1.0.0',

  /* ONLINE: base URL of the score server (see /server). Leave '' to run fully offline.
   * Example: 'https://scores.pizzatechnologies.com'. The game works with or without it. */
  apiBase: '',

  ads: {
    /* true  = Google test ads (safe while developing; earns nothing).
     * false = real ads. Switch only after you replaced the ids below with Pizza Technologies' own. */
    testMode: true,
    admob: {
      /* Google sample ad-unit ids (public). Replace with your own from admob.google.com */
      rewarded: 'ca-app-pub-3940256099942544/5224354917',
      interstitial: 'ca-app-pub-3940256099942544/1033173712'
    },
    /* Show a full-screen ad after every Nth finished run (never before `firstAfterGames`). */
    interstitialEveryNGames: 4,
    firstAfterGames: 3,
    /* Web/PC browser build: Google AdSense publisher id e.g. 'ca-pub-1234567890123456' and slot ids.
     * Shown in the empty side gutters of wide screens. Leave '' to disable. */
    adsenseClient: '',
    adsenseSlots: { left: '', right: '' },
    /* House ad used for "watch to earn" on web/PC when no network is available. */
    houseAdSeconds: 5
  },

  /* PURCHASES (web + desktop). Create Stripe Payment Links and paste them here.
   * The score server receives Stripe's webhook and unlocks the purchase for the buyer's player id. */
  store: {
    removeAds:  { title: 'Remove Ads',      desc: 'No more interstitials. Rewards stay optional.', price: '$2.99', url: '' },
    coinPack:   { title: '1,500 Coins',     desc: 'Unlock skins faster.',                          price: '$0.99', url: '', coins: 1500 },
    pizzaPass:  { title: 'Pizza Pass',      desc: 'No ads + 2x coins forever + Golden skin.',      price: '$4.99', url: '' }
  },

  privacyUrl: 'privacy.html',
  supportEmail: 'support@pizzatechnologies.com'
};
