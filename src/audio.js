// WebAudio による効果音・BGM（アセット不要の合成音）
let ctx = null;
let master = null;
let musicTimer = null;
let musicStep = 0;
let musicBright = false;

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  startMusic();
}

function now() { return ctx ? ctx.currentTime : 0; }

function env(gainNode, t0, a, peak, d) {
  gainNode.gain.setValueAtTime(0.0001, t0);
  gainNode.gain.linearRampToValueAtTime(peak, t0 + a);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function tone(freq, { type = 'sine', a = 0.005, d = 0.3, peak = 0.25, delay = 0, detune = 0, pan = 0 } = {}) {
  if (!ctx) return;
  const t0 = now() + delay;
  const o = ctx.createOscillator();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  const g = ctx.createGain();
  env(g, t0, a, peak, d);
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = pan; o.connect(g); g.connect(p); p.connect(master); }
  else { o.connect(g); g.connect(master); }
  o.start(t0); o.stop(t0 + a + d + 0.05);
}

function noiseBuffer(dur = 1) {
  const len = Math.max(1, ctx.sampleRate * dur | 0);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = b.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return b;
}

function noise({ dur = 0.4, a = 0.01, peak = 0.2, f0 = 800, f1 = 400, q = 1, type = 'bandpass', delay = 0 } = {}) {
  if (!ctx) return;
  const t0 = now() + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.1);
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
  const g = ctx.createGain();
  env(g, t0, a, peak, dur - a);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.1);
}

// --- 個別効果音 ---
export const sfx = {
  tap() { tone(660, { type: 'triangle', d: 0.12, peak: 0.18 }); },
  pop() {
    tone(420, { type: 'sine', d: 0.09, peak: 0.22 });
    tone(840, { type: 'sine', d: 0.14, peak: 0.12, delay: 0.02 });
  },
  whoosh(long = false) {
    noise({ dur: long ? 0.9 : 0.45, peak: long ? 0.3 : 0.22, f0: 3000, f1: 300, q: 0.7 });
  },
  clothSettle() {
    noise({ dur: 0.5, peak: 0.16, f0: 1200, f1: 200, q: 0.8 });
    tone(180, { type: 'sine', d: 0.2, peak: 0.1, delay: 0.25 });
  },
  squish() {
    noise({ dur: 0.28, peak: 0.2, f0: 600, f1: 150, q: 2 });
    tone(240, { type: 'sine', d: 0.18, peak: 0.1 });
  },
  peel(progress) {
    noise({ dur: 0.12, peak: 0.1 + progress * 0.08, f0: 1500 + progress * 2500, f1: 900, q: 3 });
  },
  paperFall() {
    noise({ dur: 0.6, peak: 0.15, f0: 900, f1: 150, q: 0.8 });
  },
  rollerTick() {
    noise({ dur: 0.13, peak: 0.09, f0: 500, f1: 250, q: 1.4 });
  },
  bucket() {
    tone(300, { type: 'sine', d: 0.2, peak: 0.2 });
    tone(600, { type: 'sine', d: 0.3, peak: 0.14, delay: 0.05 });
    noise({ dur: 0.2, peak: 0.08, f0: 2000, f1: 800 });
  },
  stamp() {
    tone(520, { type: 'triangle', d: 0.1, peak: 0.2 });
    tone(1040, { type: 'sine', d: 0.25, peak: 0.12, delay: 0.04 });
  },
  chime() {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      tone(f, { type: 'sine', d: 0.7, peak: 0.16, delay: i * 0.12 });
      tone(f * 2, { type: 'sine', d: 0.5, peak: 0.05, delay: i * 0.12 });
    });
  },
  install() {
    tone(392, { type: 'triangle', d: 0.3, peak: 0.18 });
    tone(523.25, { type: 'triangle', d: 0.4, peak: 0.18, delay: 0.12 });
  },
  bigPullCreak(p) {
    noise({ dur: 0.15, peak: 0.06 + p * 0.1, f0: 300 + p * 900, f1: 200, q: 4 });
  },
  fanfare() {
    const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    seq.forEach((f, i) => {
      tone(f, { type: 'triangle', d: 0.8, peak: 0.2, delay: i * 0.1 });
      tone(f * 0.5, { type: 'sine', d: 0.8, peak: 0.1, delay: i * 0.1 });
    });
    // きらきら
    for (let i = 0; i < 10; i++) {
      tone(1500 + Math.random() * 2500, { type: 'sine', d: 0.4, peak: 0.05, delay: 0.5 + i * 0.09, pan: Math.random() * 1.6 - 0.8 });
    }
    noise({ dur: 1.2, peak: 0.25, f0: 4000, f1: 200, q: 0.6 });
  },
  happy() {
    tone(659.25, { type: 'triangle', d: 0.15, peak: 0.16 });
    tone(880, { type: 'triangle', d: 0.25, peak: 0.16, delay: 0.09 });
  },
};

// ローラー用の連続音
let rollerNode = null;
export function rollerStart() {
  if (!ctx || rollerNode) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(1.5);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 1;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
  rollerNode = { src, g, f };
}
export function rollerMove(speed) {
  if (!rollerNode) return;
  const target = Math.min(0.14, speed * 2.2);
  rollerNode.g.gain.setTargetAtTime(target, now(), 0.05);
  rollerNode.f.frequency.setTargetAtTime(300 + speed * 5000, now(), 0.05);
}
export function rollerStop() {
  if (!rollerNode) return;
  rollerNode.g.gain.setTargetAtTime(0, now(), 0.08);
  const n = rollerNode;
  setTimeout(() => { try { n.src.stop(); } catch (e) { /* 停止済み */ } }, 400);
  rollerNode = null;
}

// --- BGM: 静かなオルゴール風ペンタトニック ---
const SCALE_CALM = [392, 440, 523.25, 587.33, 659.25, 783.99];
const SCALE_BRIGHT = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
function startMusic() {
  if (musicTimer) return;
  const step = () => {
    if (!ctx || ctx.state !== 'running') return;
    const scale = musicBright ? SCALE_BRIGHT : SCALE_CALM;
    const f = scale[[0, 2, 4, 1, 3, 5, 2, 0][musicStep % 8]];
    tone(f, { type: 'sine', d: musicBright ? 0.8 : 1.4, peak: musicBright ? 0.05 : 0.035, pan: (musicStep % 2) * 0.6 - 0.3 });
    if (musicStep % 4 === 0) tone(f / 2, { type: 'sine', d: 1.6, peak: 0.02 });
    musicStep++;
  };
  musicTimer = setInterval(step, 1100);
}
export function musicToBright() {
  musicBright = true;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  musicTimer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    const f = SCALE_BRIGHT[[0, 2, 4, 5, 3, 2, 1, 0][musicStep % 8]];
    tone(f, { type: 'sine', d: 0.7, peak: 0.045, pan: (musicStep % 2) * 0.6 - 0.3 });
    musicStep++;
  }, 700);
}
