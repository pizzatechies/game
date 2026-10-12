/* Online features with graceful offline fallback.
 * - Scores are always saved locally and queued; they sync to the server whenever it is reachable.
 * - The leaderboard is cached so it still shows (marked "offline") with no connection.
 * - If PT.config.apiBase is empty the game simply runs 100% offline. */
(function () {
  const PT = window.PT, cfg = PT.config;
  let serverOk = false, flushing = false;

  const base = () => (cfg.apiBase || '').replace(/\/$/, '');
  async function req(path, opts) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(base() + path, Object.assign({ signal: ctl.signal, headers: { 'Content-Type': 'application/json' } }, opts));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }

  const isOnline = () => !!cfg.apiBase && navigator.onLine !== false && serverOk;
  function emitStatus() { PT.bus.emit('net', isOnline()); }

  async function ping() {
    if (!cfg.apiBase || navigator.onLine === false) { serverOk = false; emitStatus(); return false; }
    try { await req('/api/health'); serverOk = true; } catch (e) { serverOk = false; }
    emitStatus();
    if (serverOk) { flush(); syncPurchases(); }
    return serverOk;
  }

  async function submitScore(r) {
    const st = PT.store.get();
    st.scoreQueue.push({ score: r.score, layers: r.layers, perfects: r.perfects, seconds: r.seconds, ts: Date.now() });
    if (st.scoreQueue.length > 40) st.scoreQueue.splice(0, st.scoreQueue.length - 40);
    PT.store.save();
    if (isOnline() || cfg.apiBase) await flush();
  }

  async function flush() {
    const st = PT.store.get();
    if (flushing || !cfg.apiBase || !st.scoreQueue.length || navigator.onLine === false) return;
    flushing = true;
    try {
      while (st.scoreQueue.length) {
        const q = st.scoreQueue[0];
        await req('/api/score', { method: 'POST', body: JSON.stringify({ id: st.id, name: st.name, game: cfg.game, version: cfg.version, ...q }) });
        st.scoreQueue.shift(); PT.store.save(); serverOk = true;
      }
    } catch (e) { serverOk = false; }
    flushing = false; emitStatus();
  }

  /* Returns { top:[{name,score,me}], me:{rank,score}|null, source:'online'|'cache'|'local' } */
  async function leaderboard() {
    const st = PT.store.get();
    if (cfg.apiBase && navigator.onLine !== false) {
      try {
        const d = await req('/api/leaderboard?limit=50&id=' + encodeURIComponent(st.id));
        st.lbCache = { at: Date.now(), data: d }; PT.store.save();
        serverOk = true; emitStatus();
        return Object.assign({ source: 'online' }, d);
      } catch (e) { serverOk = false; emitStatus(); }
    }
    if (st.lbCache) return Object.assign({ source: 'cache', cachedAt: st.lbCache.at }, st.lbCache.data);
    return { source: 'local', top: st.best ? [{ name: st.name, score: st.best, me: true }] : [], me: null };
  }

  /* Purchases made on the web/desktop checkout are confirmed server-side (Stripe webhook). */
  async function syncPurchases() {
    const st = PT.store.get();
    if (!cfg.apiBase || navigator.onLine === false) return;
    try {
      const e = await req('/api/entitlements/' + encodeURIComponent(st.id));
      let changed = false;
      if (e.adsRemoved && !st.adsRemoved) { st.adsRemoved = true; changed = true; }
      if (e.pass && !st.pass) { st.pass = true; changed = true; if (!st.skins.includes('golden')) st.skins.push('golden'); }
      const delta = (e.coinCredits || 0) - (st.claimed.coins || 0);
      if (delta > 0) { st.claimed.coins = e.coinCredits; PT.store.addCoins(delta); PT.bus.emit('toast', `+${delta} coins from your purchase!`); changed = true; }
      if (changed) { PT.store.save(); PT.bus.emit('entitlements'); }
    } catch (err) { /* offline: try again later */ }
  }

  window.addEventListener('online', ping);
  window.addEventListener('offline', () => { serverOk = false; emitStatus(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
  setInterval(ping, 60000);

  PT.net = { ping, submitScore, flush, leaderboard, syncPurchases, isOnline, hasServer: () => !!cfg.apiBase };
})();
