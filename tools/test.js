// Server integration tests. Run: npm test
const assert = require('assert');
const crypto = require('crypto');
const os = require('os'), fs = require('fs'), path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pizza-'));
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.PAYMENT_LINKS = JSON.stringify({ plink_ads: 'removeAds', plink_coins: 'coinPack', plink_pass: 'pizzaPass' });
const { server } = require('../server/server');

const call = async (base, p, opts) => { const r = await fetch(base + p, opts); return { status: r.status, body: await r.json() }; };
const post = (base, p, body, headers) => call(base, p, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: Object.assign({ 'Content-Type': 'application/json' }, headers) });
const sign = (raw) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=` + crypto.createHmac('sha256', 'whsec_test').update(t + '.' + raw).digest('hex'); };
const A = 'aaaaaaaa-1111', B = 'bbbbbbbb-2222';

server.listen(0, async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  let n = 0; const ok = (name) => console.log('  ok', ++n, name);
  try {
    assert.strictEqual((await call(base, '/api/health')).body.ok, true); ok('health');
    let r = await post(base, '/api/score', { id: A, name: 'Mario', score: 40, layers: 25, perfects: 12, seconds: 60 }); assert.strictEqual(r.status, 200); ok('accepts a plausible score');
    r = await post(base, '/api/score', { id: B, name: '<b>Luigi</b>', score: 90, layers: 50, perfects: 40, seconds: 120 }); assert.strictEqual(r.status, 200); ok('second player');
    r = await post(base, '/api/score', { id: A, name: 'Mario', score: 99999, layers: 5, perfects: 1, seconds: 5 }); assert.strictEqual(r.status, 422); ok('rejects impossible score');
    r = await post(base, '/api/score', { id: A, name: 'Mario', score: 10, layers: 500, perfects: 1, seconds: 3 }); assert.strictEqual(r.status, 422); ok('rejects superhuman tapping');
    r = await post(base, '/api/score', { id: 'x', score: 1 }); assert.strictEqual(r.status, 400); ok('rejects bad id');
    r = await post(base, '/api/score', { id: A, name: 'Mario', score: 30, layers: 20, perfects: 5, seconds: 40 }); assert.strictEqual(r.body.best, 40); ok('keeps best score only');
    r = await call(base, '/api/leaderboard?id=' + A);
    assert.deepStrictEqual(r.body.top.map(e => e.score), [90, 40]); assert.strictEqual(r.body.me.rank, 2); assert.strictEqual(r.body.top[1].me, true);
    assert.ok(!/[<>]/.test(r.body.top[0].name)); ok('leaderboard order, rank, name sanitising');

    // Stripe webhook
    const ev = (id, link, ref, status = 'paid') => JSON.stringify({ id, type: 'checkout.session.completed', data: { object: { client_reference_id: ref, payment_link: link, payment_status: status } } });
    r = await post(base, '/api/stripe/webhook', ev('evt_1', 'plink_ads', A), { 'Stripe-Signature': 't=1,v1=bad' }); assert.strictEqual(r.status, 400); ok('webhook rejects bad signature');
    let raw = ev('evt_2', 'plink_ads', A); r = await post(base, '/api/stripe/webhook', raw, { 'Stripe-Signature': sign(raw) }); assert.strictEqual(r.status, 200);
    assert.strictEqual((await call(base, '/api/entitlements/' + A)).body.adsRemoved, true); ok('remove-ads unlocked');
    r = await post(base, '/api/stripe/webhook', raw, { 'Stripe-Signature': sign(raw) }); assert.strictEqual(r.body.duplicate, true); ok('webhook is idempotent');
    raw = ev('evt_3', 'plink_coins', A); await post(base, '/api/stripe/webhook', raw, { 'Stripe-Signature': sign(raw) });
    raw = ev('evt_4', 'plink_coins', A); await post(base, '/api/stripe/webhook', raw, { 'Stripe-Signature': sign(raw) });
    assert.strictEqual((await call(base, '/api/entitlements/' + A)).body.coinCredits, 3000); ok('coin packs accumulate');
    raw = ev('evt_5', 'plink_pass', B, 'unpaid'); await post(base, '/api/stripe/webhook', raw, { 'Stripe-Signature': sign(raw) });
    assert.strictEqual((await call(base, '/api/entitlements/' + B)).body.pass, false); ok('unpaid sessions grant nothing');
    raw = ev('evt_6', 'plink_pass', B); await post(base, '/api/stripe/webhook', raw, { 'Stripe-Signature': sign(raw) });
    const e = (await call(base, '/api/entitlements/' + B)).body; assert.ok(e.pass && e.adsRemoved); ok('pizza pass unlocks pass + no ads');
    console.log(`\nAll ${n} server tests passed`);
    server.close(); process.exit(0);
  } catch (e) { console.error('FAILED:', e); process.exit(1); }
});
