// 効果音はすべてコード生成（外部素材なし）。iOS は最初のタッチで解錠する。

let ctx = null;
let master = null;
let motorGain = null;
let motorOsc = null;
let ready = false;

export function initAudio() {
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

  motorGain = ctx.createGain();
  motorGain.gain.value = 0;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 420;
  motorOsc = ctx.createOscillator();
  motorOsc.type = 'sawtooth';
  motorOsc.frequency.value = 62;
  motorOsc.connect(filt);
  filt.connect(motorGain);
  motorGain.connect(master);
  motorOsc.start();
  ready = true;
}

function now() { return ctx.currentTime; }

function ping(freq, t0, dur, gain, type = 'sine') {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function click(t0, gain, freq, q) {
  const len = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t0);
}

export function sfxSnap() {           // 「カコン」
  if (!ready) return;
  const t = now();
  click(t, 0.9, 1500, 3);
  click(t + 0.055, 0.7, 780, 5);
  ping(196, t + 0.05, 0.16, 0.16, 'triangle');
}

export function sfxPick() {
  if (!ready) return;
  const t = now();
  ping(620, t, 0.09, 0.12, 'triangle');
}

export function sfxPlace() {
  if (!ready) return;
  const t = now();
  ping(430, t, 0.10, 0.14, 'sine');
  ping(660, t + 0.06, 0.12, 0.10, 'sine');
}

export function sfxTick() {
  if (!ready) return;
  click(now(), 0.35, 2400, 6);
}

export function sfxClack(strength) {
  if (!ready) return;
  const g = Math.min(0.7, 0.15 + strength * 4);
  click(now(), g, 900 + strength * 900, 2.5);
}

export function sfxChute() {
  if (!ready) return;
  const t = now();
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    ping(f, t + i * 0.07, 0.35, 0.16, 'sine');
  });
}

export function sfxMode(up) {
  if (!ready) return;
  const t = now();
  const a = up ? [392, 587] : [587, 392];
  ping(a[0], t, 0.12, 0.13, 'triangle');
  ping(a[1], t + 0.08, 0.18, 0.13, 'triangle');
}

export function motor(level) {
  if (!ready) return;
  const t = now();
  motorGain.gain.setTargetAtTime(level * 0.07, t, 0.05);
  motorOsc.frequency.setTargetAtTime(58 + level * 26, t, 0.08);
}
