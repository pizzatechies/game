/* All sound is synthesized with WebAudio: no audio files, so it works offline and keeps the APK tiny. */
(function () {
  const PT = window.PT;
  let ctx = null, master = null, sfxGain = null, musicGain = null, noiseBuf = null;
  let musicTimer = null, step = 0, nextT = 0;
  const S = () => PT.store.get().settings;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  const hz = (semi) => 261.63 * Math.pow(2, semi / 12);

  function tone(freq, dur, type, vol, when, slideTo, out) {
    if (!ensure()) return;
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || sfxGain); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, hp) {
    if (!ensure()) return;
    const t = ctx.currentTime, s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp || 800;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t); s.stop(t + dur);
  }
  const on = () => S().sound;
  const PENTA = [0, 2, 4, 7, 9];

  const sfx = {
    click() { if (on()) tone(520, 0.06, 'triangle', 0.18); },
    drop() { if (on()) { tone(150, 0.12, 'sine', 0.5, 0, 60); noise(0.07, 0.12, 1500); } },
    perfect(combo) {
      if (!on()) return;
      const n = Math.max(0, combo - 1), idx = n % 5, oct = Math.min(2, Math.floor(n / 5));
      const base = PENTA[idx] + oct * 12 + 7;
      tone(hz(base), 0.28, 'triangle', 0.4);
      tone(hz(base + 12), 0.2, 'sine', 0.16, ctx.currentTime + 0.02);
    },
    trim() { if (on()) { tone(210, 0.1, 'square', 0.12, 0, 120); } },
    coin() { if (on()) { tone(988, 0.07, 'square', 0.1); tone(1319, 0.14, 'square', 0.1, ctx.currentTime + 0.07); } },
    fever() { if (on()) [0, 4, 7, 12, 16].forEach((s, i) => tone(hz(s + 12), 0.25, 'sawtooth', 0.14, ensure().currentTime + i * 0.06)); },
    over() { if (on()) { [7, 4, 0, -5].forEach((s, i) => tone(hz(s), 0.28, 'triangle', 0.35, ensure().currentTime + i * 0.13, hz(s) * 0.9)); noise(0.3, 0.2, 300); } },
    win() { if (on()) [0, 4, 7, 12].forEach((s, i) => tone(hz(s + 12), 0.2, 'square', 0.12, ensure().currentTime + i * 0.08)); },
    zone() { if (on()) [0, 7, 12, 19].forEach((s, i) => tone(hz(s + 12), 0.3, 'sine', 0.22, ensure().currentTime + i * 0.09)); }
  };

  /* ---------- music: simple 4-chord loop (bass + arpeggio + hat) ---------- */
  const CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]]; // C Am F G (relative)
  function schedule() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 16) % 4, s16 = step % 16, ch = CHORDS[bar];
      if (s16 % 4 === 0) tone(hz(ch[0] - 12), 0.22, 'triangle', 0.5, nextT, null, musicGain);
      if (s16 % 2 === 0) tone(hz(ch[(s16 / 2) % 3] + 12), 0.14, 'square', 0.16, nextT, null, musicGain);
      if (s16 % 2 === 1) { // hat
        const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
        g.gain.setValueAtTime(0.12, nextT); g.gain.exponentialRampToValueAtTime(0.0001, nextT + 0.04);
        s.connect(f); f.connect(g); g.connect(musicGain); s.start(nextT); s.stop(nextT + 0.05);
      }
      nextT += 60 / 132 / 4; step++;
    }
  }
  function startMusic() {
    if (musicTimer || !S().music || !ensure()) return;
    nextT = ctx.currentTime + 0.05; step = 0;
    musicTimer = setInterval(schedule, 90);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
  function syncMusic() { if (S().music) startMusic(); else stopMusic(); }

  /* Browsers/WebViews only allow audio after a gesture. */
  function unlock() { ensure(); syncMusic(); }
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, unlock, { once: false, passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); } else { ctx.resume(); }
  });

  function vibrate(ms) { if (PT.store.get().settings.vibe && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }

  PT.audio = Object.assign({ ensure, syncMusic, vibrate }, sfx);
})();
