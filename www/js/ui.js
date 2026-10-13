/* Pizza Stack - UI controller: screens, shop, missions, leaderboard, settings, ad flow. */
(function () {
  const PT = window.PT, cfg = PT.config, store = PT.store, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  let run = null;              // per-run bookkeeping so revives don't double count
  let screen = 'splash';
  let installPrompt = null;
  const REWARD_COINS = 60;     // "watch to earn" in the shop

  const el = {};
  ['stage', 'cv', 'hud', 'score', 'runCoins', 'combo', 'comboFill', 'hint', 'title', 'over', 'modal', 'mTitle', 'mBody', 'pauseOv', 'toast', 'splash', 'netPill', 'tBest', 'tCoins', 'badgeM',
    'oScore', 'oBest', 'oLayers', 'oPerf', 'oCoins', 'newBest', 'unlockFill', 'unlockTxt', 'btnRevive', 'btnDouble', 'gutterBoard', 'haLink'].forEach(id => el[id] = document.getElementById(id));

  /* ---------- helpers ---------- */
  let toastT;
  function toast(msg) { el.toast.textContent = msg; el.toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.toast.classList.remove('show'), 2400); }
  PT.bus.on('toast', toast);
  PT.bus.on('ads-wait', on => document.getElementById('adWait').classList.toggle('show', !!on));
  document.getElementById('btnAdCancel').onclick = () => { click(); PT.ads.cancelWait(); };
  const fmt = n => n.toLocaleString('en-US');
  const click = () => PT.audio.click();
  function show(name) {
    screen = name;
    el.title.classList.toggle('hidden', name !== 'title');
    el.over.classList.toggle('hidden', name !== 'over');
    el.hud.classList.toggle('hidden', name !== 'play');
    el.pauseOv.classList.toggle('hidden', name !== 'pause');
    if (name !== 'play') el.hint.classList.add('hidden');
  }

  /* ---------- title ---------- */
  function refreshTitle() {
    const st = store.get();
    el.tBest.textContent = fmt(st.best); el.tCoins.textContent = fmt(st.coins);
    store.ensureMissions();
    const claimable = st.missions.list.some(m => m.done && !m.claimed) || store.dailyStatus().can;
    el.badgeM.classList.toggle('hidden', !claimable);
    renderGutterBoard();
  }
  function setNet(on) {
    el.netPill.classList.toggle('on', on);
    el.netPill.querySelector('span').textContent = on ? 'ONLINE' : 'OFFLINE';
    el.netPill.title = on ? 'Connected - scores sync live' : 'Playing offline - scores sync when you reconnect';
  }
  PT.bus.on('net', setNet);
  PT.bus.on('coins', c => { el.tCoins.textContent = fmt(c); });
  PT.bus.on('mission-done', () => toast('Mission complete! Claim your reward'));
  PT.bus.on('entitlements', () => { toast('Purchase unlocked - thank you!'); refreshTitle(); });

  async function renderGutterBoard() {
    if (!el.gutterBoard || getComputedStyle(el.gutterBoard.parentElement).display === 'none') return;
    const lb = await PT.net.leaderboard();
    el.gutterBoard.innerHTML = '';
    lb.top.slice(0, 10).forEach(e => { const li = document.createElement('li'); li.textContent = e.name; const s = document.createElement('span'); s.textContent = fmt(e.score); li.appendChild(s); if (e.me) li.style.color = 'var(--basil)'; el.gutterBoard.appendChild(li); });
    if (!lb.top.length) el.gutterBoard.innerHTML = '<li>Be the first chef!</li>';
  }

  /* ---------- game flow ---------- */
  async function startRun() {
    click();
    await PT.ads.maybeInterstitial();
    const st = store.get();
    run = { banked: 0, perfects: 0, counted: false, doubled: false };
    PT.game.start(false);
    show('play');
    el.score.textContent = '0'; el.runCoins.querySelector('span').textContent = '0';
    el.combo.classList.remove('on', 'fever');
    if (!st.tutorialDone) el.hint.classList.remove('hidden');
    PT.audio.ensure(); PT.audio.syncMusic(); PT.audio.setMuffle(false); PT.audio.setEnergy(false);
  }
  function goHome() { click(); PT.game.start(true); show('title'); refreshTitle(); PT.audio.setMuffle(false); PT.audio.setEnergy(false); }

  function onTap(e) {
    if (screen !== 'play') return;
    if (e && e.target && e.target.closest && e.target.closest('button')) return;
    if (PT.game.tap()) {
      const st = store.get();
      if (!st.tutorialDone) { st.tutorialDone = true; store.save(); el.hint.classList.add('hidden'); }
    }
  }
  el.stage.addEventListener('pointerdown', onTap);
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
      e.preventDefault();
      if (screen === 'play') onTap();
      else if (screen === 'title' && el.modal.classList.contains('hidden')) startRun();
      else if (screen === 'over' && el.modal.classList.contains('hidden') && over && performance.now() - over.at > 600) $('#btnRetry').click();
    } else if (e.code === 'Escape') {
      if (!el.modal.classList.contains('hidden')) closeModal();
      else if (screen === 'play') pause(true);
      else if (screen === 'pause') pause(false);
    }
  });

  function pause(p) {
    if (p && screen === 'play') { PT.game.setPause(true); show('pause'); el.hud.classList.remove('hidden'); }
    else if (!p && screen === 'pause') { PT.game.setPause(false); show('play'); }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  $('#btnPause').onclick = () => { click(); pause(true); };
  $('#btnResume').onclick = () => { click(); pause(false); };
  $('#btnQuit').onclick = () => { PT.game.setPause(false); goHome(); };

  PT.bus.on('score', (score, combo, fever, coins) => {
    if (screen !== 'play') return;
    el.score.textContent = score; el.score.classList.remove('pop'); void el.score.offsetWidth; el.score.classList.add('pop');
    el.runCoins.querySelector('span').textContent = coins;
    el.combo.classList.toggle('on', combo > 0 || fever);
    el.combo.classList.toggle('fever', fever);
    el.comboFill.style.width = fever ? '100%' : ((combo % 8) / 8 * 100) + '%';
    el.combo.querySelector('.combo-txt').textContent = fever ? 'PIZZA FEVER!' : (combo > 1 ? 'COMBO x' + combo : 'COMBO');
  });
  PT.bus.on('fever', f => { PT.audio.setEnergy(f); if (f) { const fl = document.getElementById('flash'); fl.style.transition = 'none'; fl.style.opacity = .5; requestAnimationFrame(() => { fl.style.transition = 'opacity .5s'; fl.style.opacity = 0; }); } });

  /* ---------- game over ---------- */
  let over = null;
  PT.bus.on('over-start', () => { if (screen === 'play') { PT.audio.setEnergy(false); PT.audio.setMuffle(true); } });
  PT.bus.on('over', r => {
    const st = store.get();
    const first = !run.counted;
    const newBest = r.score > st.best;
    if (first) { st.games++; run.counted = true; }
    const coinDelta = Math.max(0, r.coins - run.banked), perfDelta = Math.max(0, r.perfects - run.perfects);
    run.banked = r.coins; run.perfects = r.perfects;
    st.perfects += perfDelta; st.bestCombo = Math.max(st.bestCombo, r.bestCombo); st.bestHeight = Math.max(st.bestHeight, r.layers);
    if (newBest) st.best = r.score;
    store.addCoins(coinDelta);
    if (first) store.progress('games', 1);
    store.progress('height', r.layers); store.progress('combo', r.bestCombo);
    if (perfDelta) store.progress('perfects', perfDelta);
    if (coinDelta) store.progress('coins', coinDelta);
    store.save();
    PT.net.submitScore(r).then(renderGutterBoard);

    over = { r, at: performance.now(), newBest };
    el.oScore.textContent = r.score; el.oBest.textContent = st.best; el.oLayers.textContent = r.layers; el.oPerf.textContent = r.perfects;
    el.oCoins.textContent = '+' + r.coins;
    el.newBest.classList.toggle('hidden', !newBest || r.score < 3);
    el.btnRevive.classList.toggle('hidden', r.revived || r.score < 4);
    el.btnDouble.classList.toggle('hidden', run.doubled || r.coins < 5);
    // next unlock progress
    const next = PT.game.SKINS.filter(s => !st.skins.includes(s.id) && s.id !== 'golden').sort((a, b) => a.price - b.price)[0];
    if (next) { const pct = Math.min(100, st.coins / next.price * 100); el.unlockFill.style.width = pct + '%'; el.unlockTxt.textContent = `${next.name.toUpperCase()}  ${fmt(Math.min(st.coins, next.price))}/${fmt(next.price)}`; el.unlockBar.style.display = ''; }
    else el.unlockBar.style.display = 'none';
    show('over');
    PT.audio.win();
    refreshTitle();
  });
  el.unlockBar = document.getElementById('unlockBar');

  $('#btnRetry').onclick = startRun;
  $('#btnHome').onclick = goHome;
  $('#btnPlay').onclick = startRun;
  $('#btnShopO').onclick = () => { click(); openModal('shop'); };
  $('#btnRevive').onclick = async () => {
    click();
    const ok = await PT.ads.showRewarded('Continue your stack');
    if (ok && PT.game.revive()) { PT.audio.setMuffle(false); show('play'); el.combo.classList.remove('on', 'fever'); toast('Back in the kitchen!'); } else if (!ok) toast('Watch the full video to continue');
  };
  $('#btnDouble').onclick = async () => {
    click();
    const ok = await PT.ads.showRewarded('Double your coins');
    if (ok && over && !run.doubled) { run.doubled = true; store.addCoins(over.r.coins); el.oCoins.textContent = '+' + over.r.coins * 2; el.btnDouble.classList.add('hidden'); PT.audio.coin(); toast('Coins doubled!'); refreshTitle(); }
  };
  $('#btnShare').onclick = async () => {
    click();
    const r = over ? over.r.score : store.get().best;
    const text = `I stacked ${r} on Pizza Stack by Pizza Technologies! Can you beat me?`;
    const url = /^https?:/.test(location.href) ? location.href.split('#')[0] : cfg.studioUrl;
    try { if (navigator.share) await navigator.share({ title: 'Pizza Stack', text, url }); else { await navigator.clipboard.writeText(text + ' ' + url); toast('Copied to clipboard'); } } catch (e) { /* cancelled */ }
  };

  /* ---------- modals ---------- */
  function openModal(kind) {
    click();
    const map = { shop: ['SHOP', renderShop], missions: ['MISSIONS', renderMissions], board: ['TOP CHEFS', renderBoard], settings: ['SETTINGS', renderSettings] };
    const m = map[kind]; el.mTitle.textContent = m[0]; el.mBody.innerHTML = ''; el.modal.classList.remove('hidden'); m[1]();
  }
  function closeModal() { el.modal.classList.add('hidden'); refreshTitle(); }
  $('#mClose').onclick = () => { click(); closeModal(); };
  el.modal.addEventListener('pointerdown', e => { if (e.target === el.modal) closeModal(); e.stopPropagation(); });
  $$('[data-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.open)));
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  /* ----- shop ----- */
  let shopTab = 'skins';
  function renderShop() {
    const st = store.get(), body = el.mBody; body.innerHTML = '';
    const tabs = mk('div', 'tabs');
    const list = [['skins', 'Pizzas'], ['up', 'Upgrades']];
    if (storeAvailable()) list.push(['buy', 'Store']);
    list.forEach(([id, label]) => { const t = mk('button', 'tab' + (shopTab === id ? ' on' : ''), label); t.onclick = () => { click(); shopTab = id; renderShop(); }; tabs.appendChild(t); });
    body.appendChild(tabs);
    const wallet = mk('div', 'row', `<i class="coin"></i><div class="grow"><b>${fmt(st.coins)} coins</b><small>Earn coins every run</small></div>`);
    const free = mk('button', 'btn sm ad', `+${REWARD_COINS} <i class="coin" style="width:16px;height:16px"></i> <small>watch ad</small>`);
    free.onclick = async () => { click(); if (await PT.ads.showRewarded('Free coins')) { store.addCoins(REWARD_COINS); PT.audio.coin(); toast(`+${REWARD_COINS} coins!`); renderShop(); } };
    wallet.appendChild(free); body.appendChild(wallet);

    if (shopTab === 'skins') {
      const grid = mk('div', 'grid');
      PT.game.SKINS.forEach(s => {
        const owned = st.skins.includes(s.id), sel = st.skin === s.id;
        const card = mk('div', 'item' + (sel ? ' sel' : '')); const cv = mk('canvas'); card.appendChild(cv); card.appendChild(mk('b', '', s.name));
        const b = mk('button', 'btn sm' + (owned ? '' : ' gold'), sel ? 'EQUIPPED' : owned ? 'EQUIP' : (s.id === 'golden' && !st.pass ? `${fmt(s.price)} <i class="coin" style="width:16px;height:16px"></i>` : `${fmt(s.price)} <i class="coin" style="width:16px;height:16px"></i>`));
        if (sel) b.disabled = true;
        b.onclick = () => {
          if (!owned) { if (!store.spend(s.price)) { toast('Not enough coins - play or watch an ad!'); return; } st.skins.push(s.id); PT.audio.coin(); }
          st.skin = s.id; store.save(); click(); renderShop();
        };
        card.appendChild(b); grid.appendChild(card);
        requestAnimationFrame(() => PT.game.drawPreview(cv, s.id));
      });
      body.appendChild(grid);
    } else if (shopTab === 'up') {
      Object.entries(store.UPGRADES).forEach(([k, u]) => {
        const lvl = st.up[k], maxed = lvl >= u.max;
        const row = mk('div', 'row'); const g = mk('div', 'grow', `<b>${u.name}</b><small>${u.desc}</small>`);
        const pips = mk('div', 'pips'); for (let i = 0; i < u.max; i++) pips.appendChild(mk('i', i < lvl ? 'on' : '')); g.appendChild(pips);
        const b = mk('button', 'btn sm gold', maxed ? 'MAX' : `${fmt(u.cost[lvl])} <i class="coin" style="width:16px;height:16px"></i>`);
        b.disabled = maxed;
        b.onclick = () => { if (!store.spend(u.cost[lvl])) { toast('Not enough coins'); return; } st.up[k]++; store.save(); PT.audio.coin(); click(); renderShop(); };
        row.appendChild(g); row.appendChild(b); body.appendChild(row);
      });
    } else renderBuy(body);
  }
  const storeAvailable = () => !PT.ads.native && Object.values(cfg.store).some(i => i.url);
  function renderBuy(body) {
    const st = store.get();
    Object.entries(cfg.store).forEach(([k, it]) => {
      const owned = (k === 'removeAds' && (st.adsRemoved || st.pass)) || (k === 'pizzaPass' && st.pass);
      const row = mk('div', 'row'); row.appendChild(mk('div', 'grow', `<b>${it.title}</b><small>${it.desc}</small>`));
      const b = mk('button', 'btn sm gold', owned ? 'OWNED' : it.price); b.disabled = owned || !it.url;
      b.onclick = () => { click(); const u = it.url + (it.url.includes('?') ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(st.id); window.open(u, '_blank', 'noopener'); toast('Complete checkout, then return here'); };
      row.appendChild(b); body.appendChild(row);
    });
    const r = mk('button', 'btn ghost', 'Restore / refresh purchases'); r.onclick = async () => { click(); await PT.net.syncPurchases(); renderShop(); toast('Purchases refreshed'); }; body.appendChild(r);
    body.appendChild(mk('div', 'note', 'Purchases are linked to your player ID and need an internet connection to confirm.'));
  }

  /* ----- missions + daily ----- */
  function renderMissions() {
    const st = store.get(), body = el.mBody; body.innerHTML = ''; store.ensureMissions();
    const d = store.dailyStatus();
    body.appendChild(mk('div', 'note', 'DAILY REWARD'));
    const days = mk('div', 'days');
    store.DAILY.forEach((amt, i) => {
      const cls = d.can ? (i === d.index ? 'now' : (i < d.index ? 'done' : '')) : (i < ((st.daily.streak - 1) % 7) + 1 ? 'done' : '');
      days.appendChild(mk('div', 'day ' + cls, `Day ${i + 1}<b>${amt}</b>`));
    });
    body.appendChild(days);
    if (d.can) {
      const b = mk('button', 'btn gold', `CLAIM ${store.DAILY[d.index]} COINS`); b.onclick = () => { const a = store.claimDaily(1); PT.audio.coin(); toast(`+${a} coins! Streak: ${st.daily.streak} day(s)`); renderMissions(); };
      const b2 = mk('button', 'btn ad', `CLAIM x2 <small>watch ad</small>`); b2.style.marginTop = '10px';
      b2.onclick = async () => { if (await PT.ads.showRewarded('Double daily reward')) { const a = store.claimDaily(2); PT.audio.coin(); toast(`+${a} coins!`); renderMissions(); } };
      body.appendChild(b); body.appendChild(b2);
    } else body.appendChild(mk('div', 'note', 'Come back tomorrow to keep your streak alive!'));
    body.appendChild(mk('div', 'note', 'TODAY\'S MISSIONS'));
    st.missions.list.forEach((m, i) => {
      const row = mk('div', 'row'); const g = mk('div', 'grow', `<b>${m.text}</b><small>${m.progress}/${m.goal}</small><div class="bar"><i style="width:${m.progress / m.goal * 100}%"></i></div>`);
      const b = mk('button', 'btn sm gold', m.claimed ? 'DONE' : m.done ? `CLAIM ${m.reward}` : `${m.reward} <i class="coin" style="width:16px;height:16px"></i>`);
      b.disabled = !m.done || m.claimed;
      b.onclick = () => { const a = store.claimMission(i); if (a) { PT.audio.coin(); toast(`+${a} coins!`); renderMissions(); } };
      row.appendChild(g); row.appendChild(b); body.appendChild(row);
    });
    body.appendChild(mk('div', 'note', 'New missions every day.'));
  }

  /* ----- leaderboard ----- */
  async function renderBoard() {
    const body = el.mBody; body.innerHTML = '<div class="note">Loading…</div>';
    const lb = await PT.net.leaderboard();
    body.innerHTML = '';
    const msg = lb.source === 'online' ? 'Live leaderboard' : lb.source === 'cache' ? 'Offline - showing saved leaderboard' : (PT.net.hasServer() ? 'Offline - connect to see global ranks' : 'Your best scores (online board not enabled)');
    body.appendChild(mk('div', 'note', msg));
    const ol = mk('ol', 'lb'); lb.top.forEach((e, i) => { const li = mk('li', e.me ? 'me' : ''); li.appendChild(mk('span', 'rk', String(i + 1))); const n = mk('span', 'nm'); n.textContent = e.name; li.appendChild(n); li.appendChild(mk('span', 'sc', fmt(e.score))); ol.appendChild(li); });
    body.appendChild(ol);
    if (lb.me && !lb.top.some(e => e.me)) body.appendChild(mk('div', 'note', `Your rank: #${fmt(lb.me.rank)} with ${fmt(lb.me.score)}`));
    if (!lb.top.length) body.appendChild(mk('div', 'note', 'No scores yet - go stack some pizza!'));
  }

  /* ----- settings ----- */
  function renderSettings() {
    const st = store.get(), body = el.mBody; body.innerHTML = '';
    [['sound', 'Sound effects'], ['music', 'Music'], ['vibe', 'Vibration']].forEach(([k, label]) => {
      const t = mk('div', 'toggle', `<span>${label}</span>`); const sw = mk('button', 'sw' + (st.settings[k] ? ' on' : '')); sw.setAttribute('aria-label', label);
      sw.onclick = () => { st.settings[k] = !st.settings[k]; store.save(); sw.classList.toggle('on', st.settings[k]); if (k === 'music') PT.audio.syncMusic(); click(); if (k === 'vibe') PT.audio.vibrate(30); };
      t.appendChild(sw); body.appendChild(t);
    });
    body.appendChild(mk('div', 'note', 'LEADERBOARD NAME'));
    const inp = mk('input', 'txt'); inp.maxLength = 16; inp.value = st.name; inp.addEventListener('change', () => { const v = inp.value.replace(/[<>]/g, '').trim().slice(0, 16); st.name = v || st.name; inp.value = st.name; store.save(); });
    inp.addEventListener('keydown', e => e.stopPropagation()); body.appendChild(inp);
    const adst = PT.ads.status(); if (adst) { const n = mk('div', 'note'); n.textContent = 'Ad status: ' + adst.text; n.style.userSelect = 'text'; body.appendChild(n); }
    if (adst && cfg.ads.testMode) {                         // test builds only: tools for setting up ads in the LevelPlay dashboard
      const ts = mk('button', 'btn ghost', 'Open ad test suite'); ts.onclick = () => { click(); PT.ads.launchTestSuite(); }; body.appendChild(ts);
      const idn = mk('div', 'note'); idn.style.userSelect = 'text'; idn.textContent = 'Device ad ID (for LevelPlay test devices): …'; body.appendChild(idn);
      PT.ads.deviceAdId().then(id => { idn.textContent = 'Device ad ID (for LevelPlay test devices): ' + (id || 'not available yet'); });
    }
    if (PT.ads.hasPrivacyOptions()) { const b = mk('button', 'btn ghost', 'Ad &amp; privacy choices'); b.onclick = () => { click(); PT.ads.showPrivacyOptions(); }; body.appendChild(b); }
    if (installPrompt) { const b = mk('button', 'btn ghost', 'Install on this device'); b.onclick = async () => { installPrompt.prompt(); installPrompt = null; closeModal(); }; body.appendChild(b); }
    const a = mk('div', 'about', `<img src="img/pt-logo.png" alt="Pizza Technologies logo"><p class="note">Pizza Stack v${cfg.version}<br>A game by <b>${cfg.studio}</b><br><a class="lnk" href="${cfg.privacyUrl}" target="_blank" rel="noopener">Privacy Policy</a> &middot; <a class="lnk" href="mailto:${cfg.supportEmail}">Support</a></p><p class="note" style="font-size:11px">Player ID: ${st.id.slice(0, 8)}</p>`);
    body.appendChild(a);
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });

  /* ---------- boot ---------- */
  function boot() {
    store.load(); store.ensureMissions();
    document.getElementById('yr').textContent = new Date().getFullYear();
    el.haLink.href = cfg.studioUrl;
    PT.game.init(el.cv, el.stage);
    PT.ads.init(); PT.net.ping();
    setNet(false);
    refreshTitle();
    if (!PT.ads.native && !PT.ads.electron && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
    let done = false, stage = 1;
    const toGameSplash = () => { if (done || stage !== 1) return; stage = 2; el.splash.classList.add('stage2'); };
    const finish = () => {
      if (done) return; done = true;
      el.splash.classList.add('out'); show('title'); setTimeout(() => el.splash.remove(), 700);
      if (store.dailyStatus().can) setTimeout(() => { if (screen === 'title') openModal('missions'); }, 600);
    };
    el.splash.addEventListener('pointerdown', () => { if (stage === 1) toGameSplash(); else finish(); });
    setTimeout(toGameSplash, 2300);   // studio logo, then the game's own splash
    setTimeout(finish, 5300);
    show('splash');
  }
  window.addEventListener('contextmenu', e => e.preventDefault());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.PT_debug = { show, startRun, get run() { return run; }, openModal };
})();
