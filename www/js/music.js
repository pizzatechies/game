/* Pizza Stack - lofi-pop music engine.
 * Pure WebAudio synthesis driven by a "song spec" (see js/song.js): no audio files, works offline, tiny download.
 * The engine only needs a context + an output node, so the exact same code renders in an OfflineAudioContext
 * for tests (tools/music-render.js).
 *
 *   const eng = PT.music.create(ctx, outNode, PT.songs.lofipop, { seed });
 *   eng.start(ctx.currentTime + 0.1);       // begins fade-in + vinyl hiss
 *   eng.scheduleStep(n)  // schedule 16th-note step n (0..); call for steps inside a short lookahead window
 *   eng.timeOf(n)        // when step n sounds (includes swing)
 *   eng.setEnergy(0|1)   // Pizza Fever: brighter filter, extra hats, doubled lead
 *   eng.setMuffle(bool)  // game over: muffled "underwater" filter
 *   eng.stop()
 */
(function () {
  const PT = (window.PT = window.PT || {});
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(ctx, out, song, opts) {
    opts = opts || {};
    const rnd = mulberry32(opts.seed || 20260101);
    const sd = 60 / song.bpm / 4;              // one sixteenth note, seconds
    const swing = song.swing || 0.5;
    const SR = ctx.sampleRate;
    let t0 = 0, started = false, hiss = null, energy = 0, muffled = false;

    /* ---------- shared noise (pre-filtered once, so drum hits need no per-hit filter nodes) + impulse response ---------- */
    const white = new Float32Array(SR * 1); for (let i = 0; i < white.length; i++) white[i] = rnd() * 2 - 1;
    const onePoleLP = (src, fc) => { const a = 1 - Math.exp(-2 * Math.PI * fc / SR), o = new Float32Array(src.length); let y = 0; for (let i = 0; i < src.length; i++) { y += a * (src[i] - y); o[i] = y; } return o; };
    const hpf = (src, fc, n) => { let x = src; for (let k = 0; k < (n || 2); k++) { const lp = onePoleLP(x, fc), o = new Float32Array(x.length); for (let i = 0; i < x.length; i++) o[i] = x[i] - lp[i]; x = o; } return x; };
    const mkBuf = (data, gain) => { const b = ctx.createBuffer(1, data.length, SR); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = data[i] * gain; return b; };
    const bufs = {
      hat: mkBuf(hpf(white, 5200, 2), 2.8),                          // closed / open hat
      snare: mkBuf(onePoleLP(hpf(white, 900, 2), 4500), 2.4),         // body of the snare
      ghost: mkBuf(onePoleLP(hpf(white, 1600, 2), 3500), 2.6),        // ghost-note ticks
      click: mkBuf(onePoleLP(white, 1500), 1.6),                      // kick beater
      crackle: mkBuf(hpf(white, 2500, 1), 1.0),                       // vinyl pops
      hiss: mkBuf(hpf(white, 4200, 2), 1.2)                           // constant hiss (looped)
    };
    const irLen = Math.floor(SR * 1.3), ir = ctx.createBuffer(2, irLen, SR);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0;
      for (let i = 0; i < irLen; i++) {
        lp += ((rnd() * 2 - 1) - lp) * 0.35;            // darker tail
        d[i] = lp * Math.pow(1 - i / irLen, 2.6) * (i < SR * 0.012 ? i / (SR * 0.012) : 1);
      }
    }
    /* one oscillator per note: the harmonics live in a wave table instead of extra oscillators */
    const wave = (h) => ctx.createPeriodicWave(new Float32Array(h.length), Float32Array.from(h));
    const WAVE_KEY = wave([0, 1, 0.34, 0.12, 0.05]), WAVE_LEAD = wave([0, 1, 0.22, 0.07]), WAVE_BASS = wave([0, 1, 0.42, 0.06]);

    /* ---------- bus chain: sum -> hp -> saturate -> warm lp -> glue comp -> out ---------- */
    const bus = ctx.createGain(); bus.gain.value = 0;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38;
    const sat = ctx.createWaveShaper();
    { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(1.5 * x) / Math.tanh(1.5); } sat.curve = c; }
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5600; lp.Q.value = 0.55;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 3; glue.attack.value = 0.012; glue.release.value = 0.22;
    bus.connect(hp); hp.connect(sat); sat.connect(lp); lp.connect(glue); glue.connect(out);

    /* sub-mixes */
    const mix = (g) => { const n = ctx.createGain(); n.gain.value = g; n.connect(bus); return n; };
    const bassBus = mix(0.45), drumBus = mix(0.7), leadBus = mix(2.0);
    const keysLp = ctx.createBiquadFilter(); keysLp.type = 'lowpass'; keysLp.frequency.value = 3200; keysLp.Q.value = 0.5; keysLp.connect(bus);   // one shared filter for all electric-piano notes
    const keysBus = ctx.createGain(); keysBus.gain.value = 1.6; keysBus.connect(keysLp);

    /* reverb (post-saturation so it stays clean) + dotted-eighth echo for the lead */
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const verbIn = ctx.createGain(); verbIn.gain.value = 1; verbIn.connect(verb);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.55; verb.connect(verbOut); verbOut.connect(lp);
    const send = (src, g) => { const s = ctx.createGain(); s.gain.value = g; src.connect(s); s.connect(verbIn); };
    send(keysBus, 0.28); send(leadBus, 0.34); send(drumBus, 0.1);
    const echo = ctx.createDelay(2); echo.delayTime.value = sd * 3;       // dotted eighth
    const echoFb = ctx.createGain(); echoFb.gain.value = 0.34;
    const echoLp = ctx.createBiquadFilter(); echoLp.type = 'lowpass'; echoLp.frequency.value = 2600;
    const echoOut = ctx.createGain(); echoOut.gain.value = 0.42;
    const echoSend = ctx.createGain(); echoSend.gain.value = 0.55; leadBus.connect(echoSend);
    echoSend.connect(echo); echo.connect(echoLp); echoLp.connect(echoFb); echoFb.connect(echo); echoLp.connect(echoOut); echoOut.connect(lp);

    /* ---------- helpers ---------- */
    // tape wow/flutter in cents, evaluated analytically so no LFO nodes are left connected to dead voices
    const wob = t => 6 * Math.sin(6.2832 * 0.43 * t) + 3 * Math.sin(6.2832 * 0.91 * t + 1.3);
    function wobble(osc, t, end, extra) {
      osc.detune.setValueAtTime(wob(t) + (extra || 0), t);
      osc.detune.linearRampToValueAtTime(wob(end) + (extra || 0), end);
    }
    // attack / exponential decay to sustain / hold / release; returns the time the voice is silent
    function adsr(param, t, dur, o) {
      const a = o.a, peak = o.peak, sus = Math.max(peak * o.s, 0.0002);
      const d = Math.max(0.02, Math.min(o.d, dur - a));
      param.setValueAtTime(0.0001, t);
      param.linearRampToValueAtTime(Math.max(peak, 0.0003), t + a);
      param.exponentialRampToValueAtTime(sus, t + a + d);
      param.setValueAtTime(sus, Math.max(t + a + d, t + dur));
      param.exponentialRampToValueAtTime(0.0001, t + dur + o.r);
      return t + dur + o.r + 0.03;
    }
    function noiseSrc(buf, t, len) {
      const s = ctx.createBufferSource(); s.buffer = buf; s.start(t, rnd() * (buf.duration - len - 0.02), len); return s;
    }
    const jitter = (ms) => (rnd() - 0.5) * 2 * ms / 1000;
    const tone = (type, wv, f) => { const o = ctx.createOscillator(); if (wv) o.setPeriodicWave(wv); else o.type = type; o.frequency.value = f; return o; };

    /* ---------- voices (each one is 2-3 nodes: that is what keeps this cheap enough for a phone) ---------- */
    function key(t, midi, dur, vel) {              // warm electric piano
      const end = t + dur, o = tone(null, WAVE_KEY, mtof(midi)), g = ctx.createGain();
      const stopAt = adsr(g.gain, t, dur, { a: 0.007, peak: 0.12 * vel, d: 0.7, s: 0.4, r: 0.4 });
      wobble(o, t, end);
      o.connect(g); g.connect(keysBus); o.start(t); o.stop(stopAt);
    }
    function bass(t, midi, dur, vel) {             // sine fundamental + 2nd harmonic (audible on phone speakers)
      const end = t + dur, o = tone(null, WAVE_BASS, mtof(midi)), g = ctx.createGain();
      const stopAt = adsr(g.gain, t, dur, { a: 0.012, peak: 0.46 * vel, d: 0.3, s: 0.62, r: 0.1 });
      wobble(o, t, end, -3);
      o.connect(g); g.connect(bassBus); o.start(t); o.stop(stopAt);
    }
    function lead(t, midi, dur, vel, level) {      // soft bell / pluck
      const end = t + dur, o = tone(null, WAVE_LEAD, mtof(midi)), g = ctx.createGain();
      const stopAt = adsr(g.gain, t, dur, { a: 0.006, peak: 0.2 * vel * (level || 1), d: 0.3, s: 0.36, r: 0.3 });
      wobble(o, t, end, 4);
      o.connect(g); g.connect(leadBus); o.start(t); o.stop(stopAt);
    }
    function kick(t, v) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(128, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
      g.gain.setValueAtTime(0.8 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      o.connect(g); g.connect(drumBus); o.start(t); o.stop(t + 0.36);
      const n = noiseSrc(bufs.click, t, 0.012), ng = ctx.createGain();   // soft beater click
      ng.gain.value = 0.1 * v; n.connect(ng); ng.connect(drumBus);
    }
    function snare(t, v) {
      const n = noiseSrc(bufs.snare, t, 0.22), g = ctx.createGain();
      g.gain.setValueAtTime(0.34 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.connect(g); g.connect(drumBus);
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
      og.gain.setValueAtTime(0.2 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(og); og.connect(drumBus); o.start(t); o.stop(t + 0.14);
    }
    function ghost(t, v) {
      const n = noiseSrc(bufs.ghost, t, 0.07), g = ctx.createGain();
      g.gain.setValueAtTime(0.06 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      n.connect(g); g.connect(drumBus);
    }
    function hat(t, v, open) {
      const len = open ? 0.26 : 0.05, n = noiseSrc(bufs.hat, t, len + 0.02), g = ctx.createGain();
      g.gain.setValueAtTime((open ? 0.25 : 0.28) * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      n.connect(g); g.connect(drumBus);
    }
    function crackle(t) {                          // a vinyl pop
      const n = noiseSrc(bufs.crackle, t, 0.004 + rnd() * 0.004), g = ctx.createGain();
      g.gain.value = 0.02 + rnd() * 0.05; n.connect(g); g.connect(bus);
    }

    /* ---------- spec -> per-step event table ---------- */
    const table = Array.from({ length: 8 }, () => Array.from({ length: 16 }, () => ({ comp: [], bass: [], drums: [], mel: [] })));
    for (let bar = 0; bar < 8; bar++) {
      const d = bar === 7 ? song.drums.fill : song.drums;
      song.comp[bar < 4 ? 0 : 1].forEach(h => table[bar][h.step].comp.push(h));
      song.bassPattern.forEach(h => table[bar][h.step].bass.push(h));
      [['kick', kick], ['snare', snare], ['ghost', ghost]].forEach(([k, fn]) => (d[k] || []).forEach(s => table[bar][s].drums.push([fn, 1])));
      (d.hat || []).forEach(s => table[bar][s].drums.push([(t, v) => hat(t, v, false), 1]));
      (d.openHat || []).forEach(s => table[bar][s].drums.push([(t, v) => hat(t, v, true), 1]));
    }
    song.melody.forEach(n => table[n.bar][n.step].mel.push(n));

    function timeOf(n) { return t0 + Math.floor(n / 2) * 2 * sd + (n % 2 ? 2 * sd * swing : 0); }

    function scheduleStep(n) {
      const bar = Math.floor(n / 16) % 8, s = n % 16, t = timeOf(n), ev = table[bar][s], chord = song.chords[bar];
      ev.comp.forEach(h => {
        const notes = chord.notes.slice().sort((a, b) => a - b);
        notes.forEach((m, i) => key(Math.max(t, ctx.currentTime) + i * 0.011 + jitter(3) + 0.004, m, h.dur * sd, clamp(h.vel * (1 - i * 0.04) * (0.92 + rnd() * 0.16), 0.15, 1)));
      });
      ev.bass.forEach(h => bass(t + jitter(2), chord.bass + 12 * h.oct, h.dur * sd, h.vel));
      ev.drums.forEach(([fn]) => fn(t + jitter(3), 0.85 + rnd() * 0.25));
      ev.mel.forEach(m => {
        const tt = t + 0.008 + jitter(4);                                     // lead sits slightly behind the beat
        lead(tt, m.midi, m.dur * sd, m.vel);
        if (energy > 0.5) lead(tt, m.midi + 12, m.dur * sd, m.vel, 0.35);       // Pizza Fever: octave shimmer
      });
      if (energy > 0.5 && s % 2 === 1 && !ev.drums.length) hat(t + jitter(3), 0.55, false);    // extra off-beat hats
      if (rnd() < 0.18) crackle(t + rnd() * sd);
    }

    function setFilter() {
      const target = muffled ? 700 : (energy > 0.5 ? 8200 : 5600);
      lp.frequency.cancelScheduledValues(ctx.currentTime);
      lp.frequency.setValueAtTime(lp.frequency.value, ctx.currentTime);
      lp.frequency.linearRampToValueAtTime(target, ctx.currentTime + 0.5);
    }

    return {
      sd, stepsPerLoop: 128,
      timeOf, scheduleStep,
      start(when) {
        t0 = when; started = true;
        const now = ctx.currentTime;                                  // continue from wherever a just-started fade-out left the gain
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(opts.noFade ? 1 : Math.max(bus.gain.value, 0.0001), now);
        if (!opts.noFade) bus.gain.exponentialRampToValueAtTime(1, when + 1.2);
        hiss = ctx.createBufferSource(); hiss.buffer = bufs.hiss; hiss.loop = true;
        const hg = ctx.createGain(); hg.gain.value = 0.0045;
        hiss.connect(hg); hg.connect(bus); hiss.start(when);
      },
      stop() {
        if (!started) return; started = false;
        const now = ctx.currentTime;
        bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0002), now); bus.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        const h = hiss; hiss = null; if (h) { try { h.stop(now + 0.4); } catch (e) { /* already stopped */ } }
      },
      setEnergy(x) { energy = x ? 1 : 0; setFilter(); },
      setMuffle(b) { muffled = !!b; setFilter(); },
      get bus() { return bus; }
    };
  }

  PT.music = { create, mtof };
})();
