/* Offline support: precache the whole game, then serve cache-first. Bump VERSION to ship an update. */
const VERSION = 'pizza-stack-v1.0.5';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'privacy.html', 'css/style.css',
  'js/bus.js', 'js/config.js', 'js/store.js', 'js/song.js', 'js/music.js', 'js/audio.js', 'js/net.js', 'js/ads.js', 'js/game.js', 'js/ui.js',
  'img/pt-logo.png', 'img/icon.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/favicon-32.png'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // never cache API / ad traffic
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match('index.html'))));
});
