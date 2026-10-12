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

    /* ---------- shared noise + impulse response ---------- */
    const noiseBuf = ctx.createBuffer(1, SR * 2, SR);
    { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
    const irLen = Math.floor(SR * 1.7), ir = ctx.createBuffer(2, irLen, SR);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0;
      for (let i = 0; i < irLen; i++) {
        lp += ((rnd() * 2 - 1) - lp) * 0.35;            // darker tail
        d[i] = lp * Math.pow(1 - i / irLen, 2.6) * (i < SR * 0.012 ? i / (SR * 0.012) : 1);
      }
    }

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
    const keysBus = mix(1.6), bassBus = mix(0.5), drumBus = mix(0.7), leadBus = mix(2.0);

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
    function noiseSrc(t, len) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.start(t, rnd() * 1.5, len); return s;
    }
    const jitter = (ms) => (rnd() - 0.5) * 2 * ms / 1000;

    /* ---------- voices ---------- */
    function key(t, midi, dur, vel) {              // warm electric piano
      const f = mtof(midi), end = t + dur;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain(), flt = ctx.createBiquadFilter();
      o1.type = 'triangle'; o2.type = 'sine'; o1.frequency.value = f; o2.frequency.value = f * 2;
      g2.gain.setValueAtTime(0.32, t); g2.gain.exponentialRampToValueAtTime(0.02, t + 0.4);
      flt.type = 'lowpass'; flt.frequency.value = 650 + vel * 2700; flt.Q.value = 0.5;
      const stopAt = adsr(g.gain, t, dur, { a: 0.007, peak: 0.16 * vel, d: 0.7, s: 0.4, r: 0.5 });
      wobble(o1, t, end); wobble(o2, t, end);
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(flt); flt.connect(keysBus);
      o1.start(t); o2.start(t); o1.stop(stopAt); o2.stop(stopAt);
    }
    function bass(t, midi, dur, vel) {
      const f = mtof(midi), end = t + dur;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain(), flt = ctx.createBiquadFilter();
      o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = f; o2.frequency.value = f; g2.gain.value = 0.22;
      flt.type = 'lowpass'; flt.frequency.value = 520; flt.Q.value = 0.4;
      const stopAt = adsr(g.gain, t, dur, { a: 0.012, peak: 0.52 * vel, d: 0.3, s: 0.62, r: 0.1 });
      wobble(o1, t, end, -3); wobble(o2, t, end, -3);
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(flt); flt.connect(bassBus);
      o1.start(t); o2.start(t); o1.stop(stopAt); o2.stop(stopAt);
    }
    function lead(t, midi, dur, vel, level) {      // soft bell / pluck
      const f = mtof(midi), end = t + dur;
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
      const g = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain();
      o1.type = 'sine'; o2.type = 'sine'; o3.type = 'triangle';
      o1.frequency.value = f; o2.frequency.value = f * 2; o3.frequency.value = f; o3.detune.value = 5;
      g2.gain.setValueAtTime(0.2, t); g2.gain.exponentialRampToValueAtTime(0.01, t + 0.25); g3.gain.value = 0.28;
      const stopAt = adsr(g.gain, t, dur, { a: 0.006, peak: 0.22 * vel * (level || 1), d: 0.3, s: 0.36, r: 0.32 });
      wobble(o1, t, end, 4); wobble(o2, t, end, 4);
      o1.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g); g.connect(leadBus);
      o1.start(t); o2.start(t); o3.start(t); o1.stop(stopAt); o2.stop(stopAt); o3.stop(stopAt);
    }
    function kick(t, v) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(128, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
      g.gain.setValueAtTime(0.8 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      o.connect(g); g.connect(drumBus); o.start(t); o.stop(t + 0.36);
      const n = noiseSrc(t, 0.012), nf = ctx.createBiquadFilter(), ng = ctx.createGain();   // soft beater click
      nf.type = 'lowpass'; nf.frequency.value = 1500; ng.gain.value = 0.1 * v; n.connect(nf); nf.connect(ng); ng.connect(drumBus);
    }
    function snare(t, v) {
      const n = noiseSrc(t, 0.22), bp = ctx.createBiquadFilter(), lpf = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8; lpf.type = 'lowpass'; lpf.frequency.value = 5500;
      g.gain.setValueAtTime(0.3 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.connect(bp); bp.connect(lpf); lpf.connect(g); g.connect(drumBus);
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
      og.gain.setValueAtTime(0.2 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(og); og.connect(drumBus); o.start(t); o.stop(t + 0.14);
    }
    function ghost(t, v) {
      const n = noiseSrc(t, 0.07), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 2300; bp.Q.value = 0.9;
      g.gain.setValueAtTime(0.06 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      n.connect(bp); bp.connect(g); g.connect(drumBus);
    }
    function hat(t, v, open) {
      const len = open ? 0.26 : 0.05, n = noiseSrc(t, len + 0.02), hpf = ctx.createBiquadFilter(), g = ctx.createGain();
      hpf.type = 'highpass'; hpf.frequency.value = open ? 6500 : 7500;
      g.gain.setValueAtTime((open ? 0.2 : 0.22) * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      n.connect(hpf); hpf.connect(g); g.connect(drumBus);
    }
    function crackle(t) {                          // a vinyl pop
      const n = noiseSrc(t, 0.004 + rnd() * 0.004), hpf = ctx.createBiquadFilter(), g = ctx.createGain();
      hpf.type = 'highpass'; hpf.frequency.value = 1500 + rnd() * 1500; g.gain.value = 0.02 + rnd() * 0.05;
      n.connect(hpf); hpf.connect(g); g.connect(bus);
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
        bus.gain.cancelScheduledValues(when); bus.gain.setValueAtTime(opts.noFade ? 1 : 0.0001, when);
        if (!opts.noFade) bus.gain.exponentialRampToValueAtTime(1, when + 1.2);
        hiss = ctx.createBufferSource(); hiss.buffer = noiseBuf; hiss.loop = true;
        const hh = ctx.createBiquadFilter(), hg = ctx.createGain(); hh.type = 'highpass'; hh.frequency.value = 4200; hg.gain.value = 0.0045;
        hiss.connect(hh); hh.connect(hg); hg.connect(bus); hiss.start(when);
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
