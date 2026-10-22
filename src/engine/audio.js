/**
 * Tiny dependency-free synth: SFX + generative ambient music.
 * No audio files are shipped; everything is generated with the Web Audio API.
 */
let ctx = null, master = null, musicGain = null, sfxGain = null, reverb = null;
let muted = false, musicTimer = null, started = false;
const listeners = new Set();

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
  // synthetic reverb impulse
  const len = ctx.sampleRate * 2.4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  reverb = ctx.createConvolver(); reverb.buffer = buf;
  const rg = ctx.createGain(); rg.gain.value = 0.6; reverb.connect(rg); rg.connect(musicGain);
  return true;
}

function tone(freq, dur = 0.12, type = 'sine', vol = 0.3, slideTo = null, delay = 0, dest = null) {
  if (!ensure() || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || sfxGain);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur = 0.4, f0 = 400, f1 = 4000, vol = 0.25, delay = 0) {
  if (!ensure() || muted) return;
  const t = ctx.currentTime + delay;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxGain);
  s.start(t);
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Am - F - C - G pad progression (MIDI roots)
const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]];
let chordIdx = 0;
function padChord() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const chord = CHORDS[chordIdx++ % CHORDS.length];
  chord.forEach((m, i) => {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = NOTE(m - 12); o.detune.value = det;
      f.type = 'lowpass'; f.frequency.setValueAtTime(260, t); f.frequency.linearRampToValueAtTime(900, t + 3.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 1.6);
      g.gain.linearRampToValueAtTime(0.0001, t + 6.2);
      o.connect(f); f.connect(g); g.connect(musicGain); g.connect(reverb);
      o.start(t + i * 0.04); o.stop(t + 6.4);
    }
  });
  // sparse arpeggio sparkles
  for (let i = 0; i < 6; i++) {
    const m = chord[Math.floor(Math.random() * chord.length)] + 12 * (1 + (Math.random() > 0.5 ? 1 : 0));
    const when = 0.6 + i * 0.7 + Math.random() * 0.2;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = NOTE(m);
    g.gain.setValueAtTime(0.0001, t + when);
    g.gain.exponentialRampToValueAtTime(0.06, t + when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + when + 1.2);
    o.connect(g); g.connect(musicGain); g.connect(reverb);
    o.start(t + when); o.stop(t + when + 1.3);
  }
}

export const audio = {
  init() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!started) { started = true; this.startMusic(); }
  },
  startMusic() {
    if (!ensure() || musicTimer) return;
    padChord();
    musicTimer = setInterval(padChord, 5200);
  },
  stopMusic() { clearInterval(musicTimer); musicTimer = null; },
  get muted() { return muted; },
  setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
    listeners.forEach((fn) => fn(m));
  },
  toggle() { this.setMuted(!muted); return muted; },
  onMute(fn) { listeners.add(fn); },
  sfx: {
    hover: () => tone(880, 0.05, 'sine', 0.08),
    click: () => { tone(520, 0.08, 'square', 0.12, 780); },
    key: () => tone(1200 + Math.random() * 200, 0.04, 'triangle', 0.12),
    swap: () => tone(300, 0.14, 'triangle', 0.2, 620),
    pick: () => tone(660, 0.07, 'triangle', 0.16),
    hit: () => { tone(180, 0.18, 'sawtooth', 0.22, 60); noise(0.12, 2000, 300, 0.2); },
    error: () => { tone(140, 0.22, 'sawtooth', 0.22, 90); },
    coin: () => { tone(988, 0.07, 'square', 0.12); tone(1319, 0.2, 'square', 0.12, null, 0.07); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, null, i * 0.08)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, 'sawtooth', 0.16, null, i * 0.12)),
    tick: () => tone(1500, 0.03, 'square', 0.06),
    whoosh: () => noise(0.9, 200, 5000, 0.28),
    warp: () => { noise(1.1, 120, 6000, 0.3); tone(80, 1.1, 'sawtooth', 0.12, 700); },
    shard: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, 'sine', 0.14, null, i * 0.07)),
    launch: () => { noise(1.0, 150, 2500, 0.3); tone(60, 1.0, 'sawtooth', 0.2, 400); },
    boot: () => tone(110, 1.4, 'sawtooth', 0.12, 440),
    shot: () => { noise(0.09, 1800, 220, 0.26); tone(220, 0.08, 'sawtooth', 0.22, 55); },
    hitmark: () => { tone(2100, 0.035, 'triangle', 0.18); tone(2800, 0.04, 'sine', 0.14, null, 0.02); },
    headshot: () => {
      tone(1480, 0.09, 'triangle', 0.24);
      tone(2217, 0.22, 'sine', 0.24, null, 0.045);
      tone(2960, 0.28, 'sine', 0.16, null, 0.09);
    },
    rev: (speedRatio = 0.5) => tone(68 + speedRatio * 140, 0.07, 'sawtooth', 0.05),
  },
};
