// All sound is synthesized with WebAudio — no assets, gentle levels for kids.
let ctx = null;
let master = null;
let waterBed = null;
let musicTimer = null;

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

function now() { return ctx ? ctx.currentTime : 0; }

function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function tone(freq, type, a, peak, d, when = 0, bend = 0) {
  if (!ctx) return;
  const t0 = now() + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + bend), t0 + a + d);
  env(g, t0, a, peak, d);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + a + d + 0.05);
}

function noiseBuf(len = 1) {
  const b = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function noiseBurst(fc, q, a, peak, d, when = 0, type = 'bandpass') {
  if (!ctx) return;
  const t0 = now() + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf(a + d + 0.1);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = fc; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t0, a, peak, d);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0); s.stop(t0 + a + d + 0.1);
}

// ---- one-shot effects ----
export const sfx = {
  tap() { tone(880, 'sine', 0.005, 0.15, 0.10); },
  snap() { // pipe click into place
    noiseBurst(2400, 2, 0.004, 0.25, 0.05);
    tone(523, 'triangle', 0.005, 0.22, 0.18, 0.02);
    tone(784, 'triangle', 0.005, 0.18, 0.22, 0.09);
  },
  pop() { // clog removed
    tone(300, 'sine', 0.004, 0.3, 0.08, 0, 500);
    noiseBurst(900, 1.5, 0.005, 0.2, 0.12, 0.01);
  },
  squish() { noiseBurst(420, 3, 0.02, 0.22, 0.16, 0, 'lowpass'); },
  cycle() { tone(660, 'sine', 0.005, 0.16, 0.09); tone(990, 'sine', 0.005, 0.12, 0.09, 0.06); },
  chime() { // task complete arpeggio
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 'sine', 0.008, 0.18, 0.5, i * 0.09));
  },
  creak(step = 0) { // valve turn
    noiseBurst(180 + step * 40, 6, 0.02, 0.3, 0.25, 0, 'lowpass');
    tone(90 + step * 18, 'sawtooth', 0.03, 0.10, 0.28, 0.02, 40);
  },
  thunk() { noiseBurst(120, 1, 0.01, 0.4, 0.25, 0, 'lowpass'); },
  whoosh(dur = 1.6, peak = 0.4) { // water rushing
    if (!ctx) return;
    const t0 = now();
    const s = ctx.createBufferSource(); s.buffer = noiseBuf(dur + 0.2);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(220, t0);
    f.frequency.exponentialRampToValueAtTime(1600, t0 + dur * 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + dur + 0.2);
  },
  burst() { // geyser launch
    noiseBurst(500, 0.8, 0.03, 0.5, 0.9, 0, 'lowpass');
    noiseBurst(1800, 1, 0.02, 0.25, 0.7, 0.05);
  },
  sparkle() {
    [1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 'sine', 0.004, 0.09, 0.35, i * 0.07));
  },
};

// ---- continuous water bed (fountain loop) ----
export function setWaterBed(level) { // 0..1
  if (!ctx) return;
  if (!waterBed) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf(2); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 950; f.Q.value = 0.4;
    const f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 300;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(f2); f2.connect(g); g.connect(master);
    s.start();
    waterBed = g;
  }
  waterBed.gain.linearRampToValueAtTime(level * 0.30, now() + 0.8);
}

// ---- music box melody for the show ----
const MELODY = [0, 4, 7, 12, 7, 4, 0, 7, 9, 12, 9, 7, 4, 7, 12, 16];
export function startMusic() {
  if (!ctx || musicTimer) return;
  let i = 0;
  const base = 523.25; // C5
  musicTimer = setInterval(() => {
    const semi = MELODY[i % MELODY.length];
    const f = base * Math.pow(2, semi / 12);
    tone(f, 'sine', 0.006, 0.10, 0.9);
    tone(f * 2, 'sine', 0.006, 0.03, 0.7);
    if (i % 4 === 0) tone(base / 2 * Math.pow(2, (semi % 12) / 12), 'triangle', 0.01, 0.05, 1.2);
    i++;
  }, 340);
}
export function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
