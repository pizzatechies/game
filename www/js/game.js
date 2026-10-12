/* Pizza Stack - game engine + renderer (Canvas 2D). All art is drawn in code: no image assets needed. */
(function () {
  const PT = window.PT;
  const W = 420;                 // logical width; height adapts to the screen
  const BH = 36;                 // layer height
  const BASE_W = 210;            // starting dough width
  const MIN_W = 8;

  let canvas, ctx, stageEl, H = 760, dpr = 1, scale = 1, baseY = 600;
  let G = null;                  // current game / demo state
  let last = 0, running = false;
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    // older Android WebViews: minimal roundRect polyfill (uniform radius)
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(Array.isArray(r) ? r[0] : r, w / 2, h / 2); this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
    };
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = (n) => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; };

  /* ---------------- skins ---------------- */
  const hsl = (h, s, l, a) => `hsl(${h} ${s}% ${l}%${a != null ? ' / ' + a : ''})`;
  const T = {
    pepperoni(c, x, y, s) { c.fillStyle = '#b3201c'; c.beginPath(); c.arc(x, y, 7.5, 0, 6.3); c.fill(); c.fillStyle = '#d4463a'; c.beginPath(); c.arc(x - 2, y - 2, 3, 0, 6.3); c.fill(); },
    mushroom(c, x, y) { c.fillStyle = '#f2e3c9'; c.beginPath(); c.ellipse(x, y, 7, 5, 0, 0, 6.3); c.fill(); c.fillStyle = '#c9b08a'; c.fillRect(x - 1.5, y, 3, 6); },
    pepper(c, x, y, s) { c.strokeStyle = '#2f9e44'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 5.5, s * 6, s * 6 + 4.2); c.stroke(); },
    olive(c, x, y) { c.strokeStyle = '#2b2b2b'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 4.5, 0, 6.3); c.stroke(); },
    pineapple(c, x, y) { c.fillStyle = '#ffe14d'; c.fillRect(x - 5, y - 4, 10, 8); c.fillStyle = '#ffc800'; c.fillRect(x - 5, y + 1, 10, 3); },
    ham(c, x, y) { c.fillStyle = '#f08c8c'; c.beginPath(); c.roundRect(x - 6, y - 4, 12, 8, 3); c.fill(); },
    chili(c, x, y, s) { c.fillStyle = '#ff2e1f'; c.beginPath(); c.ellipse(x, y, 7, 3.2, s * 3, 0, 6.3); c.fill(); c.fillStyle = '#3fae3a'; c.fillRect(x + Math.cos(s * 3) * 6 - 1, y + Math.sin(s * 3) * 6 - 1, 3, 3); },
    star(c, x, y, s, t) { c.fillStyle = '#fff4a8'; const r = 5 + Math.sin(t * 5 + s * 20) * 1.2; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .4 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); },
    blob(c, x, y, s) { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x, y, 7 + s * 3, 4, 0, 0, 6.3); c.fill(); },
    gold(c, x, y, s, t) { c.fillStyle = '#fff'; const k = (Math.sin(t * 6 + s * 30) + 1) / 2; c.globalAlpha = .4 + .6 * k; c.beginPath(); c.arc(x, y, 2 + k * 2.5, 0, 6.3); c.fill(); c.globalAlpha = 1; }
  };
  const SKINS = [
    { id: 'margherita', name: 'Margherita',   price: 0,    crust: i => [hsl(30, 62, 52), hsl(26, 62, 38)], cheese: i => [hsl(46, 96, 66 + Math.sin(i * .9) * 4), hsl(40, 92, 54)], tops: ['pepper', 'blob'] },
    { id: 'pepperoni',  name: 'Pepperoni',    price: 150,  crust: i => [hsl(28, 66, 50), hsl(24, 66, 36)], cheese: i => [hsl(42, 98, 62 + Math.sin(i) * 4), hsl(36, 94, 50)], tops: ['pepperoni'] },
    { id: 'veggie',     name: 'Veggie Supreme', price: 300, crust: i => [hsl(34, 55, 55), hsl(30, 55, 40)], cheese: i => [hsl(52, 90, 64), hsl(48, 85, 52)], tops: ['pepper', 'olive', 'mushroom'] },
    { id: 'hawaiian',   name: 'Hawaiian',     price: 500,  crust: i => [hsl(32, 66, 56), hsl(28, 64, 40)], cheese: i => [hsl(48, 100, 70), hsl(44, 95, 58)], tops: ['pineapple', 'ham'] },
    { id: 'quattro',    name: 'Four Cheese',  price: 800,  crust: i => [hsl(36, 60, 58), hsl(32, 58, 42)], cheese: i => [hsl(44 + (i % 4) * 4, 100, 74), hsl(46, 94, 60)], tops: ['blob'] },
    { id: 'inferno',    name: 'Inferno',      price: 1200, crust: i => [hsl(12, 70, 36), hsl(8, 70, 24)],  cheese: i => [hsl(18 + Math.sin(i * .6) * 8, 100, 56), hsl(8, 95, 42)], tops: ['chili', 'pepperoni'] },
    { id: 'galaxy',     name: 'Galaxy Pie',   price: 2000, crust: i => [hsl(250, 45, 36), hsl(255, 50, 22)], cheese: i => [hsl(265 + (i * 9) % 70, 85, 58), hsl(280, 80, 38)], tops: ['star'] },
    { id: 'golden',     name: 'Golden Pizza', price: 5000, crust: i => [hsl(42, 90, 52), hsl(36, 92, 34)], cheese: i => [hsl(48, 100, 72 + Math.sin(i) * 4), hsl(42, 96, 52)], tops: ['gold'] }
  ];
  const skinById = id => SKINS.find(s => s.id === id) || SKINS[0];

  /* ---------------- world zones (background) ---------------- */
  const ZONES = [
    { at: 0,   name: 'The Kitchen',  top: [40, 30, 28],  bot: [140, 70, 40] },
    { at: 20,  name: 'Rooftop',      top: [58, 40, 90],  bot: [255, 140, 90] },
    { at: 45,  name: 'City Lights',  top: [12, 14, 48],  bot: [60, 40, 110] },
    { at: 75,  name: 'Orbit',        top: [4, 6, 22],    bot: [22, 20, 70] },
    { at: 110, name: 'Pizza Galaxy', top: [30, 6, 50],   bot: [120, 28, 100] }
  ];
  function zoneIndex(h) { let z = 0; ZONES.forEach((q, i) => { if (h >= q.at) z = i; }); return z; }
  function zoneColors(h) {
    const z = zoneIndex(h), a = ZONES[z], b = ZONES[Math.min(z + 1, ZONES.length - 1)];
    const t = a === b ? 0 : clamp((h - a.at) / (b.at - a.at), 0, 1);
    const mix = (p, q) => p.map((v, i) => Math.round(lerp(v, q[i], t)));
    return { top: mix(a.top, b.top), bot: mix(a.bot, b.bot), starAlpha: clamp((h - 28) / 40, 0, 1), cloudAlpha: clamp(1 - (h - 10) / 50, 0, 1) };
  }
  const STARS = Array.from({ length: 90 }, (_, i) => ({ x: hash(i * 3 + 1) * W, y: hash(i * 3 + 2) * 1400, r: .6 + hash(i * 3 + 3) * 1.8, f: .02 + hash(i * 7) * .12 }));
  const CLOUDS = Array.from({ length: 7 }, (_, i) => ({ x: hash(i * 11) * W, y: hash(i * 13) * 900, s: .6 + hash(i * 17) * 1.1, sp: 4 + hash(i * 19) * 10, f: .15 + hash(i * 23) * .3 }));

  /* ---------------- state ---------------- */
  function newState(demo) {
    const st = PT.store.get();
    const bw = BASE_W + st.up.dough * 8;
    const g = {
      demo: !!demo, mode: 'play', t: 0, cam: 0, camT: 0, shake: 0, flash: 0,
      layers: [{ x: (W - bw) / 2, w: bw, i: 0, sq: 0 }], baseW: bw,
      cur: null, falling: [], parts: [], texts: [], rings: [],
      score: 0, combo: 0, bestCombo: 0, perfects: 0, coinF: 0, fever: 0, feverMax: 8,
      speedMul: 1, over: false, overT: 0, revived: false, startedAt: performance.now(), zone: 0,
      tol: 5 + st.up.perfect * 1.5, aiWait: rand(.5, 1.1), pause: false
    };
    spawn(g);
    return g;
  }
  function spawn(g) {
    const top = g.layers[g.layers.length - 1], i = g.layers.length;
    const w = top.w;
    const lo = -w * .3, hi = W - w * .7;
    const left = i % 2 === 0;
    g.cur = { i, w, x: left ? lo : hi, dir: left ? 1 : -1, lo, hi, born: g.t };
  }
  const speedFor = (i) => (200 + Math.min(i, 90) * 4.4);
  const layerTop = (i) => (i + 1) * BH;             // world height of a layer's top edge above the table
  const sy = (wy) => baseY + G.cam - wy;            // world -> screen y

  /* ---------------- gameplay ---------------- */
  function tap() {
    if (!G || G.over || G.mode !== 'play' || G.pause || !G.cur) return false;
    const g = G, c = g.cur, top = g.layers[g.layers.length - 1];
    const delta = c.x - top.x;
    const fever = g.fever > 0;
    const tol = g.tol * (fever ? 2.2 : 1);
    const quiet = g.demo;
    const wasFever = g.fever > 0;
    if (Math.abs(delta) <= tol) {
      // PERFECT: snap to the layer below
      c.x = top.x;
      g.combo++; g.perfects++; g.bestCombo = Math.max(g.bestCombo, g.combo);
      if (g.combo >= 2) c.w = Math.min(g.baseW, c.w + (fever ? 8 : 5));
      const pts = fever ? 3 : 2;
      land(c, true);
      g.score += pts;
      if (!quiet) {
        PT.audio.perfect(g.combo); PT.audio.vibrate(12);
        addText(`PERFECT${g.combo > 1 ? ' x' + g.combo : ''}`, c.x + c.w / 2, layerTop(c.i) + 18, fever ? '#ffe14d' : '#ffffff', 26);
      }
      ring(c); burst(c.x, c.w, layerTop(c.i), 14 + Math.min(g.combo, 10), true);
      g.shake = Math.max(g.shake, 2 + Math.min(g.combo, 6) * .4);
      if (g.combo > 0 && g.combo % 8 === 0 && g.fever <= 0) {
        g.fever = g.feverMax; g.flash = 1;
        if (!quiet) { PT.audio.fever(); addText('PIZZA FEVER!', W / 2, layerTop(c.i) + 70, '#ff5d3a', 34); }
        PT.bus.emit('fever', true);
      }
    } else {
      const overlap = c.w - Math.abs(delta);
      if (overlap <= MIN_W * .5) { // total miss
        g.falling.push(piece(c.x, c.w, layerTop(c.i), c.i, delta > 0 ? 1 : -1, 0));
        g.cur = null; g.over = true; g.overT = 0; g.shake = 14;
        if (!quiet) { PT.audio.over(); PT.audio.vibrate([40, 40, 80]); }
        PT.bus.emit('over-start', g);
        return true;
      }
      const nx = Math.max(c.x, top.x);
      const cut = c.w - overlap;
      if (delta > 0) g.falling.push(piece(c.x + overlap, cut, layerTop(c.i), c.i, 1, 0));
      else g.falling.push(piece(c.x, cut, layerTop(c.i), c.i, -1, 0));
      c.x = nx; c.w = overlap;
      g.combo = 0;
      if (g.fever > 0) { g.fever = 0; PT.bus.emit('fever', false); }
      g.score += 1;
      land(c, false);
      if (!quiet) { PT.audio.drop(); PT.audio.trim(); PT.audio.vibrate(8); }
      burst(c.x, c.w, layerTop(c.i), 5, false);
      g.shake = Math.max(g.shake, 3);
    }
    if (wasFever && g.fever > 0) { g.fever--; if (g.fever === 0) PT.bus.emit('fever', false); }
    // coins
    const earn = (Math.abs(delta) <= tol ? 2 : 1) * (g.fever > 0 ? 2 : 1) * (g.demo ? 0 : PT.store.coinMultiplier());
    g.coinF += earn;
    g.layers.push({ x: c.x, w: c.w, i: c.i, sq: 1 });
    if (c.w < MIN_W) { g.over = true; if (!quiet) PT.audio.over(); PT.bus.emit('over-start', g); }
    // zone change
    const z = zoneIndex(g.layers.length - 1);
    if (z !== g.zone) { g.zone = z; if (!quiet) { PT.audio.zone(); addText(ZONES[z].name.toUpperCase(), W / 2, layerTop(c.i) + 120, '#9ff4ff', 30); } PT.bus.emit('zone', ZONES[z].name); }
    spawn(g);
    if (!quiet) PT.bus.emit('score', g.score, g.combo, g.fever > 0, Math.floor(g.coinF));
    return true;
  }
  function land(c, perfect) { /* hook for squash, sounds handled by caller */ if (perfect) c.glow = 1; }
  const piece = (x, w, wy, i, side) => ({ x, w, wy, i, vy: 0, vx: side * rand(30, 70), rot: 0, vr: side * rand(.6, 1.6), a: 1 });
  function ring(c) { G.rings.push({ x: c.x, w: c.w, wy: layerTop(c.i), t: 0 }); }
  function addText(txt, x, wy, color, size) {
    if (txt.startsWith('PERFECT')) G.texts = G.texts.filter(t => !t.txt.startsWith('PERFECT')); // one popup at a time
    G.texts.push({ txt, x: clamp(x, 100, W - 100), wy, color, size, t: 0 });
  }
  function burst(x, w, wy, n, perfect) {
    const st = skinById(PT.store.get().skin);
    for (let k = 0; k < n; k++) {
      const hue = G.fever > 0 ? Math.floor(rand(0, 360)) : (perfect ? rand(35, 60) : rand(20, 40));
      G.parts.push({ x: x + rand(0, w), wy: wy - 4, vx: rand(-90, 90), vy: rand(60, 240), life: rand(.5, 1), t: 0, size: rand(2, 5), color: hsl(hue, 100, perfect ? 70 : 55), kind: perfect ? 'conf' : 'bit' });
    }
  }

  function update(dt) {
    const g = G; if (!g || g.pause) return;
    g.t += dt;
    g.shake *= Math.pow(.0008, dt); if (g.shake < .1) g.shake = 0;
    g.flash = Math.max(0, g.flash - dt * 1.6);

    if (g.cur && !g.over) {
      const c = g.cur;
      const v = speedFor(c.i) * g.speedMul * (c.i < 3 ? .8 : 1);
      c.x += c.dir * v * dt;
      if (c.x > c.hi) { c.x = c.hi; c.dir = -1; } else if (c.x < c.lo) { c.x = c.lo; c.dir = 1; }
      if (g.revived && g.speedMul < 1) g.speedMul = Math.min(1, g.speedMul + dt * .05);
      if (g.demo) { // attract-mode autopilot
        g.aiWait -= dt;
        const top = g.layers[g.layers.length - 1];
        if (g.aiWait <= 0 && Math.abs(c.x - top.x) < 3 + (Math.random() < .25 ? 14 : 0)) { tap(); g.aiWait = .1; }
        if (g.layers.length > 5 || g.over) { G = newState(true); return; }
      }
    }
    for (const l of g.layers) if (l.sq > 0) l.sq = Math.max(0, l.sq - dt * 5);
    for (const l of g.layers) if (l.glow > 0) l.glow = Math.max(0, l.glow - dt * 2.2);

    // camera follows the stack
    const n = g.layers.length;
    g.camT = g.demo ? 0 : Math.max(0, .5 * H + layerTop(n) - baseY - 20);
    g.cam += (g.camT - g.cam) * Math.min(1, dt * 4.5);

    for (const p of g.falling) { p.vy += 1500 * dt; p.wy -= p.vy * dt; p.x += p.vx * dt; p.rot += p.vr * dt; }
    g.falling = g.falling.filter(p => sy(p.wy) < H + 150);
    for (const p of g.parts) { p.t += dt; p.vy -= 520 * dt; p.wy += p.vy * dt; p.x += p.vx * dt; }
    g.parts = g.parts.filter(p => p.t < p.life);
    for (const r of g.rings) r.t += dt * 2.6;
    g.rings = g.rings.filter(r => r.t < 1);
    for (const t of g.texts) t.t += dt;
    g.texts = g.texts.filter(t => t.t < 1.1);

    // fever steam / embers
    if (g.fever > 0 && !g.over && Math.random() < dt * 40) {
      const top = g.layers[g.layers.length - 1];
      g.parts.push({ x: rand(top.x, top.x + top.w), wy: layerTop(top.i), vx: rand(-20, 20), vy: rand(60, 160), life: rand(.5, 1), t: 0, size: rand(2, 4), color: hsl(rand(0, 360), 100, 65), kind: 'conf' });
    }
    if (g.over) {
      g.overT += dt;
      if (g.overT > .75 && !g.overFired) { g.overFired = true; if (!g.demo) PT.bus.emit('over', result()); }
    }
  }
  function result() {
    const g = G;
    return { score: g.score, layers: g.layers.length - 1, perfects: g.perfects, bestCombo: g.bestCombo, coins: Math.floor(g.coinF), seconds: Math.max(1, Math.round((performance.now() - g.startedAt) / 1000)), revived: g.revived };
  }

  /* ---------------- rendering ---------------- */
  function drawBackground() {
    const hgt = Math.max(0, (G.layers.length - 1));
    const c = zoneColors(hgt);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `rgb(${c.top})`); grad.addColorStop(1, `rgb(${c.bot})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    const t = G.t, cam = G.cam;
    if (c.starAlpha > 0) {
      for (const s of STARS) {
        const y = ((s.y - cam * s.f) % (H + 20) + (H + 20)) % (H + 20);
        ctx.globalAlpha = c.starAlpha * (.5 + .5 * Math.sin(t * 2 + s.x));
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 6.3); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (c.cloudAlpha > 0) {
      for (const k of CLOUDS) {
        const x = ((k.x + t * k.sp) % (W + 160)) - 80;
        const y = ((k.y - cam * k.f) % (H + 100) + (H + 100)) % (H + 100) - 50;
        ctx.globalAlpha = c.cloudAlpha * .45; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(x, y, 46 * k.s, 15 * k.s, 0, 0, 6.3); ctx.ellipse(x + 26 * k.s, y - 8 * k.s, 28 * k.s, 14 * k.s, 0, 0, 6.3); ctx.ellipse(x - 24 * k.s, y - 4 * k.s, 24 * k.s, 11 * k.s, 0, 0, 6.3); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // city silhouette (rooftop / city zones)
    if (hgt > 14 && hgt < 100) {
      const a = clamp((hgt - 14) / 20, 0, 1) * clamp((100 - hgt) / 25, 0, 1), y0 = H - 40 + cam * .25;
      ctx.fillStyle = `rgba(15,10,30,${.55 * a})`;
      for (let i = 0; i < 12; i++) { const bw = 34 + hash(i + 5) * 22, bh = 60 + hash(i + 9) * 150, bx = i * 36 - 6; ctx.fillRect(bx, y0 - bh, bw, bh + 200); if (hgt > 40) { ctx.fillStyle = `rgba(255,220,120,${.7 * a})`; for (let w = 0; w < 6; w++) if (hash(i * 9 + w) > .5) ctx.fillRect(bx + 6 + (w % 2) * 14, y0 - bh + 10 + Math.floor(w / 2) * 22, 6, 8); ctx.fillStyle = `rgba(15,10,30,${.55 * a})`; } }
    }
    // moon / planets / UFO as you climb
    if (hgt > 45) {
      const a = clamp((hgt - 45) / 20, 0, 1);
      ctx.globalAlpha = a; ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.arc(330, 120 + cam * .03, 34, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.arc(318, 112 + cam * .03, 9, 0, 6.3); ctx.arc(340, 132 + cam * .03, 6, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (hgt > 78) {
      const ux = ((t * 40) % (W + 120)) - 60, uy = 200 + Math.sin(t * 2) * 8;
      ctx.fillStyle = '#b8f2ff'; ctx.beginPath(); ctx.ellipse(ux, uy - 7, 12, 9, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#8d9bb5'; ctx.beginPath(); ctx.ellipse(ux, uy, 26, 8, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#ffe14d'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(ux + k * 14, uy + 1, 2.4, 0, 6.3); ctx.fill(); }
      const px = 70, py = 330 + cam * .02;
      const pg = ctx.createRadialGradient(px - 10, py - 10, 4, px, py, 46); pg.addColorStop(0, '#ff9ae0'); pg.addColorStop(1, '#6a2bd8');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 40, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,255,.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(px, py, 62, 14, -.3, 0, 6.3); ctx.stroke();
    }
    // table (kitchen) - scrolls away
    const ty = sy(0);
    if (ty < H + 30) {
      ctx.fillStyle = '#6b3a1e'; ctx.fillRect(0, ty, W, H - ty + 40);
      ctx.fillStyle = '#8a4d27'; ctx.fillRect(0, ty, W, 8);
      for (let x = 0; x < W + 28; x += 28) { for (let r = 0; r < 12; r++) { if ((Math.floor(x / 28) + r) % 2) { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x, ty + 8 + r * 28, 28, 28); } } }
      ctx.fillStyle = '#d9d9e0'; ctx.beginPath(); ctx.ellipse(W / 2, ty + 2, W * .46, 9, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#b9bac6'; ctx.beginPath(); ctx.ellipse(W / 2, ty + 5, W * .46, 8, 0, 0, Math.PI); ctx.fill();
    }
  }

  function drawBlock(x, w, i, wy, opts) {
    opts = opts || {};
    const sk = opts.skin || skinById(PT.store.get().skin);
    const fever = G.fever > 0 && !opts.noFever;
    const top = sy(wy);
    const sq = opts.sq || 0;
    const h = BH - sq * 7;
    const y = top + (BH - h);
    const [c1, c2] = fever ? [hsl((G.t * 200 + i * 25) % 360, 85, 50), hsl((G.t * 200 + i * 25 + 30) % 360, 85, 35)] : sk.crust(i);
    const [h1, h2] = fever ? [hsl((G.t * 200 + i * 25 + 40) % 360, 100, 72), hsl((G.t * 200 + i * 25 + 60) % 360, 95, 56)] : sk.cheese(i);
    ctx.save();
    // soft shadow under block
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.roundRect(x + 2, y + 5, w, h, 13); ctx.fill();
    const g1 = ctx.createLinearGradient(0, y, 0, y + h); g1.addColorStop(0, c1); g1.addColorStop(1, c2);
    ctx.fillStyle = g1; ctx.beginPath(); ctx.roundRect(x, y, w, h, 13); ctx.fill();
    // cheese
    if (w > 14) {
      const g2 = ctx.createLinearGradient(0, y, 0, y + h * .75); g2.addColorStop(0, h1); g2.addColorStop(1, h2);
      ctx.fillStyle = g2; ctx.beginPath(); ctx.roundRect(x + 4, y + 3, w - 8, h * .66, 9); ctx.fill();
      // toppings are anchored in world-x so they stay put when a layer is trimmed
      ctx.save(); ctx.beginPath(); ctx.roundRect(x + 4, y + 3, w - 8, h * .66, 9); ctx.clip();
      const step = 34, k0 = Math.floor((x - 20) / step), k1 = Math.ceil((x + w + 20) / step);
      for (let k = k0; k <= k1; k++) {
        const seed = hash(i * 131 + k * 17);
        const px = k * step + 6 + seed * 20, py = y + 3 + h * .33 + (hash(k * 7 + i) - .5) * 5;
        if (px < x + 4 || px > x + w - 4) continue;
        const name = sk.tops[Math.floor(hash(k * 3 + i * 5) * sk.tops.length)];
        T[name](ctx, px, py, seed, G.t);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.roundRect(x + 10, y + 5, Math.max(0, w - 20), 3, 2); ctx.fill();
    }
    if (opts.glow) { ctx.globalAlpha = opts.glow; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 13); ctx.fill(); }
    ctx.restore();
  }

  function draw() {
    if (!G) return;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const sh = G.shake;
    ctx.save();
    if (sh > 0) ctx.translate(rand(-sh, sh), rand(-sh, sh));
    drawBackground();
    // layers (only visible ones)
    const g = G;
    for (const l of g.layers) {
      const wy = layerTop(l.i), y = sy(wy);
      if (y > H + 40 || y < -60) continue;
      drawBlock(l.x, l.w, l.i, wy, { sq: l.sq, glow: l.glow ? l.glow * .5 : 0 });
    }
    if (g.cur && !g.over) {
      const c = g.cur, wy = layerTop(c.i);
      // guide line to the layer below
      const top = g.layers[g.layers.length - 1];
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(top.x, sy(wy)); ctx.lineTo(top.x, sy(wy) + BH); ctx.moveTo(top.x + top.w, sy(wy)); ctx.lineTo(top.x + top.w, sy(wy) + BH); ctx.stroke(); ctx.setLineDash([]);
      drawBlock(c.x, c.w, c.i, wy + 0, { skin: null });
    }
    for (const p of g.falling) {
      ctx.save(); const cx = p.x + p.w / 2, cy = sy(p.wy) + BH / 2;
      ctx.translate(cx, cy); ctx.rotate(p.rot); ctx.translate(-cx, -cy);
      drawBlock(p.x, p.w, p.i, p.wy, {}); ctx.restore();
    }
    for (const r of g.rings) {
      const e = r.t, y = sy(r.wy);
      ctx.globalAlpha = (1 - e) * .9; ctx.strokeStyle = g.fever > 0 ? '#ffe14d' : '#fff'; ctx.lineWidth = 3 + (1 - e) * 3;
      ctx.beginPath(); ctx.roundRect(r.x - e * 14, y - e * 6, r.w + e * 28, BH + e * 12, 14 + e * 8); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of g.parts) {
      const k = 1 - p.t / p.life; ctx.globalAlpha = clamp(k * 1.4, 0, 1); ctx.fillStyle = p.color;
      if (p.kind === 'conf') { ctx.save(); ctx.translate(p.x, sy(p.wy)); ctx.rotate(p.t * 8 + p.x); ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, sy(p.wy), p.size * k + .5, 0, 6.3); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    for (const t of g.texts) {
      const k = t.t / 1.1, y = sy(t.wy) - k * 46, a = k < .1 ? k / .1 : 1 - Math.max(0, (k - .6) / .4);
      const sc = k < .15 ? .6 + k / .15 * .55 : 1.15 - Math.min(.15, (k - .15));
      ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); ctx.translate(t.x, y); ctx.scale(sc, sc);
      ctx.font = `900 ${t.size}px "Trebuchet MS", "Arial Rounded MT Bold", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(40,10,0,.75)'; ctx.lineJoin = 'round'; ctx.strokeText(t.txt, 0, 0);
      ctx.fillStyle = t.color; ctx.fillText(t.txt, 0, 0); ctx.restore();
    }
    ctx.restore();
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,240,200,${g.flash * .5})`; ctx.fillRect(0, 0, W, H); }
    if (g.fever > 0) { // heat vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .75); vg.addColorStop(0, 'rgba(255,90,20,0)'); vg.addColorStop(1, `rgba(255,70,10,${.22 + Math.sin(g.t * 8) * .06})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------------- loop / sizing ---------------- */
  function resize() {
    if (!stageEl) return;
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    scale = w / W; H = h / scale;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    baseY = H * .84;
  }
  function frame(now) {
    if (!running) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    baseY = G && G.demo ? H * .7 : H * .84;
    update(dt); draw();
    requestAnimationFrame(frame);
  }

  /* ---------------- public API ---------------- */
  function start(demo) {
    G = newState(demo);
    G.cam = 0;
    if (!demo) PT.bus.emit('score', 0, 0, false, 0);
  }
  function revive() {
    if (!G || !G.over || G.revived) return false;
    const g = G; g.revived = true; g.over = false; g.overFired = false; g.shake = 0;
    g.falling = []; g.speedMul = .55; g.combo = 0;
    spawn(g);
    return true;
  }
  function setPause(p) { if (G && G.mode === 'play' && !G.over) G.pause = p; }

  function drawPreview(cv, skinId) {
    const sk = skinById(skinId), dp = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 150, h = cv.clientHeight || 96; cv.width = w * dp; cv.height = h * dp;
    const c = cv.getContext('2d'), k = w / 200, lh = h / k;
    // temporarily borrow the renderer
    const keepCtx = ctx, keepG = G, keepBase = baseY;
    ctx = c; ctx.setTransform(dp * k, 0, 0, dp * k, 0, 0);
    G = { cam: 0, t: performance.now() / 1000, fever: 0, shake: 0 }; baseY = lh - 4;
    const ws = [120, 106, 92];
    for (let i = 0; i < 3; i++) drawBlock((200 - ws[i]) / 2 + (i === 1 ? 6 : i === 2 ? -4 : 0), ws[i], i + 2, (i + 1) * BH, { skin: sk, noFever: true });
    ctx = keepCtx; G = keepG; baseY = keepBase;
  }

  function init(cv, stage) {
    canvas = cv; ctx = cv.getContext('2d'); stageEl = stage;
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
    start(true);
    running = true; last = performance.now(); requestAnimationFrame(frame);
  }

  PT.game = { init, start, tap, revive, setPause, resize, SKINS, skinById, drawPreview, ZONES, get state() { return G; }, result };
})();
