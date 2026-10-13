/* Pizza Stack - configuration.
 * Everything a publisher needs to change lives here (ad ids, server URL, store links).
 * Defaults are SAFE: ad network test mode with no keys, no server (offline-only leaderboard), no store links. */
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
    /* Android ads run through Unity LevelPlay (free to join; it can also mediate AdMob, AppLovin, Meta... later).
     * LevelPlay IS the former ironSource platform, so an existing ironSource account works. Add THIS game as its own app in the dashboard
     * (apps are per package id: com.pizzatechnologies.pizzastack), create a Rewarded and an Interstitial ad unit, then paste the values below.
     * The ironSource ad network is built in; the Unity Ads network is optional extra demand you can switch on later in the dashboard. While appKey is '' the game still works:
     * "watch to earn" falls back to the clearly-labelled sponsor card (nothing is earned). */
    provider: 'levelplay',
    /* true  = LevelPlay test mode (safe while developing, no revenue). false = real ads. */
    testMode: true,
    levelplay: {
      appKey: '28acf210d',        // LevelPlay dashboard -> your app -> App key (not a secret: it ships inside the app)
      rewardedAdUnitId: '7wt218p2yqfo9hvb',   // Ad Units -> Rewarded -> ad unit id
      interstitialAdUnitId: '',   // Ad Units -> Interstitial -> ad unit id
      privacyPolicyUrl: '',       // PUBLIC https URL of your hosted privacy policy (shown in the consent dialog)
      loadWaitMs: 4000            // how long "watch ad" waits for a video to load before giving up
    },
    /* Show a full-screen ad after every Nth finished run (never before `firstAfterGames`). */
    interstitialEveryNGames: 4,
    firstAfterGames: 3,
    /* Web/PC browser build: Google AdSense publisher id e.g. 'ca-pub-1234567890123456' and slot ids.
     * Shown in the empty side gutters of wide screens. Leave '' to disable. */
    adsenseClient: '',
    adsenseSlots: { left: '', right: '' },
    /* Sponsor-card countdown used for "watch to earn" on web/PC (and on Android until LevelPlay is configured). */
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
