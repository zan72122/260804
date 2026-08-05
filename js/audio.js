// WebAudio 効果音・音楽（全て合成 — 外部アセットなし）
let ctx = null;
let master = null;
let musicTimer = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
}

function now() { return ctx ? ctx.currentTime : 0; }

function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}

function tone(freq, t0, dur, { type = 'sine', peak = 0.3, glide = 0, out = master } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), t0 + dur);
  env(g, t0, 0.008, peak, dur);
  o.connect(g); g.connect(out);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise(t0, dur, { peak = 0.2, lp = 3000, hp = 300 } = {}) {
  if (!ctx) return;
  const len = Math.max(1, (dur + 0.05) * ctx.sampleRate | 0);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = lp;
  const f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = hp;
  const g = ctx.createGain();
  env(g, t0, 0.01, peak, dur);
  src.connect(f1); f1.connect(f2); f2.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

// --- 効果音 ---
export const sfx = {
  tap() { if (!ctx) return; tone(620, now(), 0.09, { type: 'triangle', peak: 0.18, glide: -180 }); },
  snap() {
    if (!ctx) return; const t = now();
    noise(t, 0.05, { peak: 0.16, lp: 5000, hp: 800 });
    tone(340, t + 0.02, 0.1, { type: 'triangle', peak: 0.22, glide: 90 });
  },
  paper() { if (!ctx) return; noise(now(), 0.16, { peak: 0.12, lp: 4500, hp: 900 }); },
  swoosh() { if (!ctx) return; noise(now(), 0.45, { peak: 0.1, lp: 1600, hp: 200 }); },
  click() {
    if (!ctx) return; const t = now();
    noise(t, 0.03, { peak: 0.25, lp: 6000, hp: 1500 });
    tone(190, t + 0.01, 0.07, { type: 'square', peak: 0.1 });
  },
  chime() {
    if (!ctx) return; const t = now();
    [523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + i * 0.11, 0.5, { peak: 0.16 }));
  },
  bigChime() {
    if (!ctx) return; const t = now();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(f, t + i * 0.13, 0.8, { peak: 0.15 });
      tone(f * 2, t + i * 0.13, 0.5, { peak: 0.05 });
    });
  },
  shimmer() {
    if (!ctx) return; const t = now();
    for (let i = 0; i < 9; i++) tone(900 + i * 190, t + i * 0.06, 0.3, { peak: 0.05 });
  },
  grow() { // ライト接近 → 影が育つ演出音
    if (!ctx) return; const t = now();
    tone(120, t, 2.4, { type: 'sine', peak: 0.12, glide: 220 });
    for (let i = 0; i < 12; i++) tone(500 + i * 160, t + 0.4 + i * 0.14, 0.35, { peak: 0.045 });
  },
  pop() { if (!ctx) return; tone(300, now(), 0.12, { type: 'sine', peak: 0.2, glide: 260 }); },
};

// --- 本番の音楽: オルゴール風（きらきら星・パブリックドメイン） ---
const MELODY = [ // [半音(C4=0), 拍]
  [0, 1], [0, 1], [7, 1], [7, 1], [9, 1], [9, 1], [7, 2],
  [5, 1], [5, 1], [4, 1], [4, 1], [2, 1], [2, 1], [0, 2],
  [7, 1], [7, 1], [5, 1], [5, 1], [4, 1], [4, 1], [2, 2],
  [7, 1], [7, 1], [5, 1], [5, 1], [4, 1], [4, 1], [2, 2],
  [0, 1], [0, 1], [7, 1], [7, 1], [9, 1], [9, 1], [7, 2],
  [5, 1], [5, 1], [4, 1], [4, 1], [2, 1], [2, 1], [0, 2],
];

function pluck(freq, t0, out) {
  const o = ctx.createOscillator(); o.type = 'sine';
  const o2 = ctx.createOscillator(); o2.type = 'sine';
  o.frequency.value = freq; o2.frequency.value = freq * 3.01;
  const g = ctx.createGain(); const g2 = ctx.createGain();
  g.gain.setValueAtTime(0.16, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
  g2.gain.setValueAtTime(0.03, t0); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
  o.connect(g); o2.connect(g2); g.connect(out); g2.connect(out);
  o.start(t0); o.stop(t0 + 1.2); o2.start(t0); o2.stop(t0 + 0.5);
}

export function startMusic() {
  if (!ctx || musicTimer) return;
  const musicOut = ctx.createGain();
  musicOut.gain.value = 0.0001;
  const dly = ctx.createDelay(0.6); dly.delayTime.value = 0.34;
  const fb = ctx.createGain(); fb.gain.value = 0.22;
  const wet = ctx.createGain(); wet.gain.value = 0.3;
  musicOut.connect(master);
  musicOut.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(master);
  musicOut.gain.exponentialRampToValueAtTime(1.0, now() + 2.5);

  const beat = 0.42;
  let idx = 0;
  let nextT = now() + 0.3;
  const base = 523.25; // C5
  const schedule = () => {
    if (!musicTimer) return;
    while (nextT < now() + 0.8) {
      const [semi, len] = MELODY[idx % MELODY.length];
      pluck(base * Math.pow(2, semi / 12), nextT, musicOut);
      if (idx % 4 === 0) pluck(base / 2 * Math.pow(2, (semi % 12) / 12), nextT, musicOut); // 低音
      nextT += beat * len;
      idx++;
      if (idx % MELODY.length === 0) nextT += beat; // フレーズ間の息
    }
  };
  musicTimer = { id: setInterval(schedule, 200), out: musicOut };
  schedule();
}

export function stopMusic() {
  if (!musicTimer) return;
  const out = musicTimer.out;
  clearInterval(musicTimer.id); musicTimer = null;
  if (out && ctx) {
    out.gain.cancelScheduledValues(now());
    out.gain.setValueAtTime(out.gain.value, now());
    out.gain.exponentialRampToValueAtTime(0.0001, now() + 1.2);
    setTimeout(() => out.disconnect(), 1500);
  }
}
