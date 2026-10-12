/* Save data, daily rewards and daily missions. Works 100% offline (localStorage, with in-memory fallback). */
(function () {
  const PT = window.PT;
  const KEY = 'pt_pizzastack_v1';

  const rid = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36));

  const DEFAULT = () => ({
    v: 1, id: rid(), name: 'Chef' + (1000 + Math.floor(Math.random() * 9000)),
    best: 0, coins: 0, totalCoins: 0, games: 0, perfects: 0, bestCombo: 0, bestHeight: 0,
    skin: 'margherita', skins: ['margherita'],
    up: { dough: 0, coin: 0, perfect: 0 },
    settings: { sound: true, music: true, vibe: true },
    daily: { last: '', streak: 0 },
    missions: { date: '', list: [] },
    adsRemoved: false, pass: false,
    scoreQueue: [], lbCache: null, gamesSinceAd: 0, tutorialDone: false, claimed: {}
  });

  let data = null;
  let memory = null;

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = memory; }
    let d = DEFAULT();
    if (raw) { try { d = Object.assign(d, JSON.parse(raw)); d.up = Object.assign(DEFAULT().up, d.up); d.settings = Object.assign(DEFAULT().settings, d.settings); } catch (e) { /* corrupt save: start fresh */ } }
    data = d;
    return d;
  }
  function save() {
    const raw = JSON.stringify(data);
    try { localStorage.setItem(KEY, raw); } catch (e) { memory = raw; }
  }

  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const dayNum = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };

  /* ---------- upgrades ---------- */
  const UPGRADES = {
    dough:   { name: 'Thicker Dough',  desc: 'Start with a wider base (+8 px per level)', max: 5, cost: [200, 450, 900, 1700, 3200] },
    coin:    { name: 'Coin Magnet',    desc: '+20% coins every run per level',             max: 5, cost: [250, 500, 1000, 2000, 4000] },
    perfect: { name: 'Chef\'s Eye',    desc: 'Bigger perfect window (+1.5 px per level)',  max: 4, cost: [300, 700, 1500, 3000] }
  };

  /* ---------- daily reward ---------- */
  const DAILY = [50, 75, 100, 150, 200, 300, 500];
  function dailyStatus() {
    const t = todayStr();
    const can = data.daily.last !== t;
    let nextStreak = 1;
    if (data.daily.last) {
      const gap = dayNum(t) - dayNum(data.daily.last);
      nextStreak = gap === 1 ? data.daily.streak + 1 : (gap === 0 ? data.daily.streak : 1);
    }
    return { can, streak: data.daily.streak, nextStreak, rewards: DAILY, index: (nextStreak - 1) % 7 };
  }
  function claimDaily(mult) {
    const s = dailyStatus();
    if (!s.can) return 0;
    const amount = DAILY[s.index] * (mult || 1);
    data.daily.last = todayStr(); data.daily.streak = s.nextStreak;
    addCoins(amount); save();
    return amount;
  }

  /* ---------- missions ---------- */
  const TEMPLATES = [
    { type: 'height',  text: 'Reach {n} layers in one run',  goals: [15, 25, 40],   reward: [40, 70, 120] },
    { type: 'perfects', text: 'Land {n} perfect drops',      goals: [10, 25, 50],   reward: [40, 80, 140] },
    { type: 'games',   text: 'Play {n} runs',                goals: [3, 5, 8],      reward: [30, 60, 100] },
    { type: 'combo',   text: 'Get a {n}x perfect combo',     goals: [3, 5, 8],      reward: [50, 90, 150] },
    { type: 'coins',   text: 'Earn {n} coins',               goals: [60, 120, 250], reward: [40, 80, 140] }
  ];
  function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
  function ensureMissions() {
    const t = todayStr();
    if (data.missions.date === t && data.missions.list.length) return;
    const rnd = seeded('pizza' + t + data.id);
    const pool = TEMPLATES.slice();
    const list = [];
    for (let k = 0; k < 3; k++) {
      const tpl = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const tier = Math.min(2, Math.floor(rnd() * 3));
      list.push({ type: tpl.type, text: tpl.text.replace('{n}', tpl.goals[tier]), goal: tpl.goals[tier], reward: tpl.reward[tier], progress: 0, done: false, claimed: false });
    }
    data.missions = { date: t, list };
    save();
  }
  /* kind: 'height'|'combo' take max-in-run values, others add. */
  function progress(kind, n) {
    ensureMissions();
    let changed = false;
    data.missions.list.forEach(m => {
      if (m.type !== kind || m.done) return;
      m.progress = (kind === 'height' || kind === 'combo') ? Math.max(m.progress, n) : m.progress + n;
      if (m.progress >= m.goal) { m.progress = m.goal; m.done = true; changed = true; }
    });
    if (changed) PT.bus.emit('mission-done');
    save();
  }
  function claimMission(i) {
    const m = data.missions.list[i];
    if (!m || !m.done || m.claimed) return 0;
    m.claimed = true; addCoins(m.reward); save();
    return m.reward;
  }

  /* ---------- currency ---------- */
  function addCoins(n) { data.coins += n; if (n > 0) data.totalCoins += n; save(); PT.bus.emit('coins', data.coins); }
  function spend(n) { if (data.coins < n) return false; data.coins -= n; save(); PT.bus.emit('coins', data.coins); return true; }

  const coinMultiplier = () => (1 + data.up.coin * 0.2) * (data.pass ? 2 : 1);

  PT.store = {
    load, save, get: () => data, todayStr, UPGRADES, DAILY, dailyStatus, claimDaily,
    ensureMissions, progress, claimMission, addCoins, spend, coinMultiplier
  };
})();
