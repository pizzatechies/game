/* Pizza Stack - configuration.
 * Everything a publisher needs to change lives here (server URL, store links). The game has NO ads on any platform.
 * Defaults are safe: no server (offline-only leaderboard), no store links. */
window.PT = window.PT || {};
window.PT.config = {
  studio: 'Pizza Technologies',
  studioUrl: 'https://pizzatechnologies.com',
  game: 'Pizza Stack',
  version: '1.1.0',

  /* ONLINE: base URL of the score server (see /server). Leave '' to run fully offline.
   * Example: 'https://scores.pizzatechnologies.com'. The game works with or without it. */
  apiBase: '',

  /* PURCHASES (web + desktop). Create Stripe Payment Links and paste them here.
   * The score server receives Stripe's webhook and unlocks the purchase for the buyer's player id. */
  store: {
    coinPack:   { title: '1,500 Coins',     desc: 'Unlock skins faster.',                          price: '$0.99', url: '', coins: 1500 },
    pizzaPass:  { title: 'Pizza Pass',      desc: '2x coins forever + Golden skin.',               price: '$4.99', url: '' }
  },

  privacyUrl: 'privacy.html',
  supportEmail: 'support@pizzatechnologies.com'
};
