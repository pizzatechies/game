// Renders the game music offline (OfflineAudioContext in headless Chromium), measures it, and writes a WAV preview.
//   node tools/music-render.js [out.wav]        env: PLAYWRIGHT_MODULE, CHROMIUM, LOOPS (default 2)
// Exits non-zero if the audio is clipped, silent, DC-offset, or clicks at the loop seam.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(require('os').tmpdir(), 'pizza-music.wav');
const LOOPS = +process.env.LOOPS || 2;
const SOLO = process.env.SOLO || '';      // keys | bass | lead | kick | snare | hat | all-but:<part>  -> isolate one instrument for mix analysis
const MUSIC_GAIN = +(process.env.MUSIC_GAIN || require('fs').readFileSync(path.join(root, 'www/js/audio.js'), 'utf8').match(/MUSIC_LEVEL\s*=\s*([0-9.]+)/)?.[1] || 0.3);
const db = x => 20 * Math.log10(Math.max(x, 1e-9));

function fft(re, im) {                 // in-place radix-2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
}
function wav(path_, L, R, sr) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4); buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4); }
  fs.writeFileSync(path_, buf);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage();
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(2); });
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: 'window.PT = window.PT || {};' });
  for (const f of ['js/song.js', 'js/music.js']) await page.addScriptTag({ path: path.join(root, 'www', f) });
  const sr = 44100;
  const res = await page.evaluate(async ({ LOOPS, sr, MUSIC_GAIN, SOLO }) => {
    const song = JSON.parse(JSON.stringify(PT.songs.lofipop));
    if (SOLO) {
      const keep = (k) => SOLO === k;
      if (!keep('keys')) song.comp = [[], []];
      if (!keep('bass')) song.bassPattern = [];
      if (!keep('lead')) song.melody = [];
      const dr = (o) => ({ kick: keep('kick') ? o.kick : [], snare: keep('snare') ? o.snare : [], hat: keep('hat') ? o.hat : [], ghost: [], openHat: keep('hat') ? o.openHat : [] });
      song.drums = Object.assign(dr(song.drums), { fill: dr(song.drums.fill) });
    }
    const sd = 60 / song.bpm / 4, steps = LOOPS * 128, dur = steps * sd + 3.5;
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    const master = ctx.createGain(); master.gain.value = MUSIC_GAIN; master.connect(ctx.destination);
    const eng = PT.music.create(ctx, master, song, { noFade: true, seed: 7 });
    eng.start(0.05);
    for (let n = 0; n < steps; n++) eng.scheduleStep(n);
    const b = await ctx.startRendering();
    const enc = (arr) => { const u = new Int16Array(arr.length); for (let i = 0; i < arr.length; i++) u[i] = Math.max(-32768, Math.min(32767, Math.round(arr[i] * 32767))); let s = ''; const bytes = new Uint8Array(u.buffer); for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
    return { L: enc(b.getChannelData(0)), R: enc(b.getChannelData(1)), bpm: song.bpm, sd, loopSec: 128 * sd, title: song.title, peakRaw: 0 };
  }, { LOOPS, sr, MUSIC_GAIN, SOLO });
  await browser.close();

  const dec = s => { const b = Buffer.from(s, 'base64'); const i16 = new Int16Array(b.buffer, b.byteOffset, b.length / 2); const f = new Float32Array(i16.length); for (let i = 0; i < f.length; i++) f[i] = i16[i] / 32767; return f; };
  const L = dec(res.L), R = dec(res.R), mono = L.map((v, i) => (v + R[i]) / 2);
  wav(OUT, L, R, sr);

  const rms = (a, s, e) => { let t = 0; for (let i = s; i < e; i++) t += a[i] * a[i]; return Math.sqrt(t / Math.max(1, e - s)); };
  let peak = 0, clip = 0, dc = 0; for (let i = 0; i < mono.length; i++) { const v = Math.abs(L[i]); peak = Math.max(peak, v, Math.abs(R[i])); if (v > 0.999) clip++; dc += mono[i]; } dc /= mono.length;
  const loopN = Math.round(res.loopSec * sr), playN = loopN * LOOPS;
  const overall = rms(mono, Math.round(0.05 * sr), Math.round(0.05 * sr) + playN);
  const barN = Math.round(res.loopSec / 8 * sr), perBar = [];
  for (let b = 0; b < 8; b++) perBar.push(+db(rms(mono, Math.round(0.05 * sr) + b * barN, Math.round(0.05 * sr) + (b + 1) * barN)).toFixed(1));
  // loop seam: largest sample-to-sample jump in +-30 ms around the seam vs the 99.9th percentile elsewhere
  const jumps = new Float32Array(mono.length - 1); for (let i = 0; i < jumps.length; i++) jumps[i] = Math.abs(mono[i + 1] - mono[i]);
  const sorted = Float32Array.from(jumps).sort(); const p999 = sorted[Math.floor(sorted.length * 0.999)];
  let seamMax = 0; const seam = Math.round(0.05 * sr) + loopN; for (let i = seam - Math.round(0.03 * sr); i < seam + Math.round(0.03 * sr); i++) seamMax = Math.max(seamMax, jumps[i]);
  // spectrum
  const N = 4096, hann = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  const spec = new Float64Array(N / 2); let frames = 0;
  for (let s = Math.round(0.05 * sr); s + N < Math.round(0.05 * sr) + playN; s += N) { const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = mono[s + i] * hann[i]; fft(re, im); for (let k = 0; k < N / 2; k++) spec[k] += Math.hypot(re[k], im[k]); frames++; }
  const hz = k => k * sr / N; const band = (a, b) => { let t = 0; for (let k = 0; k < N / 2; k++) if (hz(k) >= a && hz(k) < b) t += spec[k] * spec[k]; return t; };
  const tot = band(0, sr / 2) || 1; let cen = 0, mag = 0; for (let k = 1; k < N / 2; k++) { cen += hz(k) * spec[k]; mag += spec[k]; }
  const bands = { 'sub<120': band(0, 120), 'low120-500': band(120, 500), 'mid500-2k': band(500, 2000), 'high2k-6k': band(2000, 6000), 'air>6k': band(6000, sr / 2) };
  Object.keys(bands).forEach(k => bands[k] = +(100 * bands[k] / tot).toFixed(1));
  // silence
  const w = Math.round(0.05 * sr); let quiet = 0, wins = 0; for (let s = Math.round(0.05 * sr); s + w < Math.round(0.05 * sr) + playN; s += w) { wins++; if (db(rms(mono, s, s + w)) < -60) quiet++; }

  const m = { title: res.title, bpm: res.bpm, loopSeconds: +res.loopSec.toFixed(2), musicGain: MUSIC_GAIN, peakDb: +db(peak).toFixed(1), rmsDb: +db(overall).toFixed(1), crestDb: +(db(peak) - db(overall)).toFixed(1),
    clippedSamples: clip, dcOffset: +dc.toExponential(1), perBarRmsDb: perBar, spectralCentroidHz: Math.round(cen / mag), bandPercentEnergy: bands, silentWindowPct: +(100 * quiet / wins).toFixed(1),
    seamMaxJump: +seamMax.toFixed(4), p999Jump: +p999.toFixed(4), wav: OUT };
  console.log(JSON.stringify(m, null, 1));
  const fails = [];
  if (clip > 0) fails.push('clipping'); if (m.peakDb > -3) fails.push('peak above -3 dBFS (too hot for a background bed)');
  if (m.rmsDb < -38) fails.push('too quiet'); if (m.rmsDb > -20) fails.push('too loud for a background bed (> -20 dBFS RMS)');
  if (Math.abs(dc) > 0.005) fails.push('DC offset'); if (m.silentWindowPct > 5) fails.push('dead air');
  if (seamMax > p999 * 2.5 && seamMax > 0.02) fails.push('click at the loop seam');
  if (SOLO) { console.log(`(solo "${SOLO}": measurements only, thresholds skipped)`); return; }
  if (fails.length) { console.error('MUSIC CHECK FAILED: ' + fails.join('; ')); process.exit(1); }
  console.log('music checks passed');
})().catch(e => { console.error(e); process.exit(2); });
