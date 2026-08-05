// ---------------------------------------------------------------------------
// 音: すべて WebAudio で合成 (外部素材なし)
// ---------------------------------------------------------------------------
'use strict';

const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];

class Sound {
  constructor() {
    this.ok = false;
    this.ctx = null;
  }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    // 雑音バッファ
    const n = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const dat = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      dat[i] = w * 0.6 + last * 3.2;
    }
    this.noiseBuf = buf;

    // 部屋の空気音
    this.room = this._noiseLoop(160, 0.02);
    // 磨き音 (常時再生してゲインで制御)
    this.rub = this._noiseLoop(1400, 0.0, 900);
    // 雨戸のごろごろ
    this.rumble = this._noiseLoop(120, 0.0);

    this.ok = true;
    if (ctx.state === 'suspended') ctx.resume();
  }

  _noiseLoop(freq, gain, q) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = q ? 'bandpass' : 'lowpass';
    f.frequency.value = freq;
    if (q) f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    return { src, filter: f, gain: g };
  }

  _env(node, t0, a, d, peak) {
    const g = node.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  // 澄んだ音 (色をはめる / 完成)
  chime(i, vol) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const f = SCALE[((i % SCALE.length) + SCALE.length) % SCALE.length];
    const g = ctx.createGain();
    g.connect(this.master);
    this._env(g, t, 0.008, 1.1, (vol || 1) * 0.20);
    for (const [mult, amp, type] of [[1, 1, 'sine'], [2.01, 0.32, 'sine'], [2.76, 0.16, 'triangle'], [5.4, 0.05, 'sine']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mult;
      const gg = ctx.createGain();
      gg.gain.value = amp;
      o.connect(gg); gg.connect(g);
      o.start(t); o.stop(t + 1.3);
    }
  }

  // ガラスを切る音
  cut(intensity) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.4;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1700, t);
    f.frequency.exponentialRampToValueAtTime(4600, t + 0.14);
    f.Q.value = 3.5;
    const g = ctx.createGain();
    this._env(g, t, 0.01, 0.16, 0.16 * (0.5 + intensity));
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.3);
  }

  // 金属の継ぎ目
  clink(i) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(this.master);
    this._env(g, t, 0.004, 0.22, 0.13);
    const base = 1450 + (i % 5) * 190;
    for (const [m, a] of [[1, 1], [1.71, 0.5], [2.43, 0.28]]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = base * m;
      const gg = ctx.createGain(); gg.gain.value = a;
      o.connect(gg); gg.connect(g);
      o.start(t); o.stop(t + 0.35);
    }
  }

  // 磨く (連続音)
  rubbing(amount) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.rub.gain.gain.setTargetAtTime(Math.min(0.10, amount * 0.10), t, 0.05);
    this.rub.filter.frequency.setTargetAtTime(1100 + amount * 2200, t, 0.08);
  }

  shutter(amount) {
    if (!this.ok) return;
    const t = this.ctx.currentTime;
    this.rumble.gain.gain.setTargetAtTime(Math.min(0.30, amount * 0.30), t, 0.05);
    this.rumble.filter.frequency.setTargetAtTime(110 + amount * 260, t, 0.1);
  }

  knock() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.16);
    const g = ctx.createGain();
    this._env(g, t, 0.004, 0.28, 0.28);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.4);
  }

  pop(i) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = SCALE[i % SCALE.length];
    o.frequency.setValueAtTime(f * 0.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    const g = ctx.createGain();
    this._env(g, t, 0.006, 0.22, 0.14);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.35);
  }

  // 揭幕: あたたかいパッド + きらめくアルペジオ
  reveal() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(this.master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 1.6);
    g.gain.setValueAtTime(0.16, t + 6.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 11.0);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(340, t);
    filt.frequency.exponentialRampToValueAtTime(2600, t + 3.4);
    filt.connect(g);
    for (const [f, a, det] of [[130.81, 1, 0], [196.0, 0.8, 4], [261.63, 0.7, -5], [329.63, 0.5, 6], [392.0, 0.35, -3]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const gg = ctx.createGain(); gg.gain.value = a * 0.25;
      o.connect(gg); gg.connect(filt);
      o.start(t); o.stop(t + 11.5);
    }
    const order = [0, 2, 4, 5, 7, 5, 4, 6, 8, 7, 5, 3];
    for (let i = 0; i < order.length; i++) {
      setTimeout(() => this.chime(order[i], 0.55 - i * 0.02), 900 + i * 320);
    }
  }

  bird() {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t0 = t + i * 0.11;
      const o = ctx.createOscillator();
      o.type = 'sine';
      const f = 2100 + Math.random() * 1500;
      o.frequency.setValueAtTime(f * 0.8, t0);
      o.frequency.exponentialRampToValueAtTime(f * 1.35, t0 + 0.04);
      o.frequency.exponentialRampToValueAtTime(f * 0.9, t0 + 0.09);
      const g = ctx.createGain();
      this._env(g, t0, 0.01, 0.09, 0.045);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 0.2);
    }
  }

  ambience(on) {
    if (!this.ok) return;
    this.room.gain.gain.setTargetAtTime(on ? 0.035 : 0.0, this.ctx.currentTime, 0.5);
  }
}
