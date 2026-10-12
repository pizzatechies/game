#!/usr/bin/env node
/* Pizza Stack online backend (zero dependencies, Node 18+).
 *   GET  /api/health
 *   POST /api/score                 { id, name, score, layers, perfects, seconds }
 *   GET  /api/leaderboard?limit=50&id=<playerId>
 *   GET  /api/entitlements/:id      -> { adsRemoved, pass, coinCredits }
 *   POST /api/stripe/webhook        Stripe checkout.session.completed (signature verified)
 *
 * Config (env): PORT, DATA_DIR, ALLOW_ORIGIN, STRIPE_WEBHOOK_SECRET,
 *               PAYMENT_LINKS = {"plink_xxx":"removeAds","plink_yyy":"coinPack","plink_zzz":"pizzaPass"}
 *               COIN_PACK_COINS (default 1500)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +process.env.PORT || 8787;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const COIN_PACK = +process.env.COIN_PACK_COINS || 1500;
let PAYMENT_LINKS = {};
try { PAYMENT_LINKS = JSON.parse(process.env.PAYMENT_LINKS || '{}'); } catch (e) { console.error('PAYMENT_LINKS is not valid JSON'); }

fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');
let db = { players: {}, events: [] };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) { /* first run */ }
let dirty = false;
const flush = () => { if (!dirty) return; dirty = false; const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); };
setInterval(flush, 3000).unref();
process.on('SIGTERM', () => { flush(); process.exit(0); });
process.on('SIGINT', () => { flush(); process.exit(0); });

/* ---- tiny per-IP rate limiter ---- */
const hits = new Map();
function limited(ip, max) {
  const now = Date.now(), h = (hits.get(ip) || []).filter(t => now - t < 60000);
  h.push(now); hits.set(ip, h);
  return h.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 60000)) hits.delete(k); }, 60000).unref();

const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOW_ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};
function readBody(req, max = 32768) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const validId = id => typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id);
const cleanName = n => String(n || 'Chef').replace(/[\u0000-\u001f<>&"'`]/g, '').trim().slice(0, 16) || 'Chef';
const player = id => (db.players[id] = db.players[id] || { name: 'Chef', best: 0, games: 0, updated: 0, ent: { adsRemoved: false, pass: false, coinCredits: 0 } });

/* Plausibility checks (not bulletproof anti-cheat, but blocks trivial score spoofing). */
function plausible(b) {
  const { score, layers, perfects, seconds } = b;
  if (![score, layers, perfects, seconds].every(Number.isInteger)) return false;
  if (score < 0 || score > 100000 || layers < 0 || perfects < 0 || perfects > layers || seconds < 1) return false;
  if (score > layers * 3 + 3) return false;       // max 3 points per layer
  if (layers > seconds * 4 + 2) return false;       // can't tap faster than ~4 per second
  return true;
}

function verifyStripe(raw, header) {
  if (!WEBHOOK_SECRET) return false;
  const parts = Object.fromEntries(String(header || '').split(',').map(p => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - +parts.t) > 300) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(parts.t + '.' + raw.toString('utf8')).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const server = http.createServer(async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (url.pathname === '/api/health') return send(res, 200, { ok: true, game: 'pizza-stack', by: 'Pizza Technologies' });
    if (limited(ip, 120)) return send(res, 429, { error: 'slow down' });

    if (url.pathname === '/api/score' && req.method === 'POST') {
      if (limited(ip + ':score', 30)) return send(res, 429, { error: 'slow down' });
      const b = JSON.parse((await readBody(req)).toString() || '{}');
      if (!validId(b.id)) return send(res, 400, { error: 'bad id' });
      if (!plausible(b)) return send(res, 422, { error: 'implausible score' });
      const p = player(b.id); p.name = cleanName(b.name); p.games++; p.updated = Date.now();
      if (b.score > p.best) p.best = b.score;
      dirty = true;
      return send(res, 200, { ok: true, best: p.best });
    }

    if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
      const limit = Math.max(1, Math.min(100, +url.searchParams.get('limit') || 50)), me = url.searchParams.get('id');
      const all = Object.entries(db.players).filter(([, p]) => p.best > 0).sort((a, b) => b[1].best - a[1].best || a[1].updated - b[1].updated);
      const top = all.slice(0, limit).map(([id, p]) => ({ name: p.name, score: p.best, me: id === me }));
      const idx = me ? all.findIndex(([id]) => id === me) : -1;
      return send(res, 200, { top, me: idx >= 0 ? { rank: idx + 1, score: all[idx][1].best } : null, total: all.length });
    }

    const ent = /^\/api\/entitlements\/([A-Za-z0-9-]{8,64})$/.exec(url.pathname);
    if (ent && req.method === 'GET') {
      const p = db.players[ent[1]];
      return send(res, 200, p ? p.ent : { adsRemoved: false, pass: false, coinCredits: 0 });
    }

    if (url.pathname === '/api/stripe/webhook' && req.method === 'POST') {
      const raw = await readBody(req, 262144);
      if (!verifyStripe(raw, req.headers['stripe-signature'])) return send(res, 400, { error: 'bad signature' });
      const ev = JSON.parse(raw.toString());
      if (db.events.includes(ev.id)) return send(res, 200, { ok: true, duplicate: true });
      if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
        const s = ev.data.object, id = s.client_reference_id;
        if (s.payment_status === 'paid' && validId(id)) {
          const product = PAYMENT_LINKS[s.payment_link] || (s.metadata && s.metadata.product);
          const p = player(id);
          if (product === 'removeAds') p.ent.adsRemoved = true;
          else if (product === 'pizzaPass') { p.ent.pass = true; p.ent.adsRemoved = true; }
          else if (product === 'coinPack') p.ent.coinCredits += COIN_PACK;
          else console.warn('unknown product for payment link', s.payment_link);
        }
      }
      db.events.push(ev.id); if (db.events.length > 5000) db.events.splice(0, 1000);
      dirty = true;
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 400, { error: 'bad request' });
  }
});

if (require.main === module) server.listen(PORT, () => console.log(`Pizza Stack server on :${PORT}  (data: ${DATA_DIR})`));
module.exports = { server, flush };
