/* Tiny event bus shared by all modules. */
window.PT = window.PT || {};
(function () {
  const h = {};
  PT.bus = {
    on(n, f) { (h[n] = h[n] || []).push(f); },
    emit(n, ...a) { (h[n] || []).forEach(f => { try { f(...a); } catch (e) { console.error('[bus]', n, e); } }); }
  };
})();
