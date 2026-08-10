// OWNER: agent A6 finish — 100% procedural WebAudio. Soft, warm, never startling. See CONTRACT.md.

const PENTATONIC = [523.25, 659.25, 783.99, 880.0, 1174.66]; // C5 E5 G5 A5 D6

let ctx = null;
let master = null;
let noiseBuffer = null;

let lastSwipe = -Infinity;
let lastShimmer = -Infinity;

function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    if (comp.threshold) comp.threshold.value = -18;
    if (comp.knee) comp.knee.value = 24;
    if (comp.ratio) comp.ratio.value = 8;
    if (comp.attack) comp.attack.value = 0.003;
    if (comp.release) comp.release.value = 0.25;
    master.connect(comp);
    comp.connect(ctx.destination);
  } catch (_e) { ctx = null; master = null; }
  return ctx;
}

function live() { return !!ctx && ctx.state === 'running'; }

function unlock() {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
}

function makeNoiseBuffer() {
  if (noiseBuffer) return noiseBuffer;
  try {
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
  } catch (_e) { noiseBuffer = null; }
  return noiseBuffer;
}

// gentle attack/decay envelope on a fresh gain node
function envGain(peak, attack, decay, t0) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0005, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  return g;
}

function playSwipe(speed) {
  if (!live()) return;
  const t = ctx.currentTime;
  if (t - lastSwipe < 0.08) return;
  lastSwipe = t;
  const buf = makeNoiseBuffer();
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  const sp = Math.min(1, (speed || 0) / 1200);
  bp.frequency.value = 500 + sp * 2200;
  bp.Q.value = 0.8;
  const g = envGain(0.16 + sp * 0.10, 0.02, 0.16, t);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t); src.stop(t + 0.24);
}

function playShimmer() {
  if (!live()) return;
  const t = ctx.currentTime;
  if (t - lastShimmer < 0.15) return;
  lastShimmer = t;
  const n = 2 + (Math.random() < 0.5 ? 0 : 1);
  for (let i = 0; i < n; i++) {
    const freq = PENTATONIC[(Math.random() * PENTATONIC.length) | 0] * (1 + (Math.random() - 0.5) * 0.01);
    const startT = t + i * 0.03;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = envGain(0.09, 0.008, 0.22, startT);
    osc.connect(g); g.connect(master);
    osc.start(startT); osc.stop(startT + 0.3);
  }
}

function playDip() {
  if (!live()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.25);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 500;
  const g = envGain(0.20, 0.01, 0.24, t);
  osc.connect(lp); lp.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + 0.3);
}

function playReady() {
  if (!live()) return;
  const t = ctx.currentTime;
  const notes = [392.0, 523.25, 659.25]; // G4 C5 E5, warm rising arpeggio
  notes.forEach((f, i) => {
    const startT = t + i * 0.12;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = envGain(0.15, 0.02, 0.35, startT);
    osc.connect(g); g.connect(master);
    osc.start(startT); osc.stop(startT + 0.45);
  });
}

function playPlaced() {
  if (!live()) return;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((f) => { // C5 E5 G5 bell chord
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = envGain(0.13, 0.01, 0.9, t);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + 1.0);
  });
  const fifth = ctx.createOscillator(); // fifth above, delayed sparkle
  fifth.type = 'sine';
  fifth.frequency.value = 1046.5;
  const g2 = envGain(0.08, 0.02, 0.7, t + 0.06);
  fifth.connect(g2); g2.connect(master);
  fifth.start(t + 0.06); fifth.stop(t + 0.9);
}

function safe(fn) { return (payload) => { try { fn(payload); } catch (_e) { /* never throw */ } }; }

export default {
  init({ bus }) {
    bus.on('pointer:down', safe(unlock));
    bus.on('swipe', safe(({ speed }) => playSwipe(speed)));
    bus.on('threads:added', safe(() => playShimmer()));
    bus.on('tool:dipped', safe(() => playDip()));
    bus.on('nest:ready', safe(() => playReady()));
    bus.on('nest:placed', safe(() => playPlaced()));
    // 'game:reset' — intentionally silent (a very soft pad here would add nothing for a toddler).
  },
  update() {},
};
