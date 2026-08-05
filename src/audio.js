// WebAudio 合成サウンド。外部アセットなし。
// すべて優しい音量・音色（4歳児向け）。初回ポインタ操作で unlock() を呼ぶ。

const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 784.0, 880.0]; // Cペンタトニック

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.mode = 'off'; // off | prep | party
    this._musicTimer = null;
    this._nextNoteTime = 0;
    this._partyStep = 0;
    this._noiseBuf = null;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 6;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(comp);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    // ノイズバッファ（効果音用）
    const len = this.ctx.sampleRate * 1.2;
    this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._startMusicLoop();
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---- 基本音素 ----

  _pluck(freq, t, { gain = 0.22, dur = 0.9, bright = 0.35 } = {}) {
    // オルゴール風：正弦＋高調波、速い減衰
    const ctx = this.ctx; if (!ctx) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    g.connect(this.master);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 4;
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(gain * bright, t);
    g2.gain.exponentialRampToValueAtTime(0.0004, t + dur * 0.35);
    o1.connect(g); o2.connect(g2); g2.connect(this.master);
    o1.start(t); o1.stop(t + dur + 0.1);
    o2.start(t); o2.stop(t + dur * 0.4);
  }

  _noise(t, { dur = 0.15, gain = 0.2, type = 'bandpass', f0 = 1000, f1 = null, q = 1 } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    if (f1 !== null) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  // ---- 効果音 ----

  tap() { if (!this.ctx) return; this._pluck(PENTA[2 + (Math.random() * 3 | 0)], this.now, { gain: 0.1, dur: 0.4 }); }

  pop() {
    if (!this.ctx) return; const t = this.now;
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.16);
    this._noise(t, { dur: 0.05, gain: 0.08, f0: 2500, q: 0.8 });
  }

  place(i = 0) {
    if (!this.ctx) return; const t = this.now;
    this.pop();
    this._pluck(PENTA[(i % 5) + 3], t + 0.05, { gain: 0.16, dur: 0.7 });
  }

  snip() {
    if (!this.ctx) return; const t = this.now;
    this._noise(t, { dur: 0.05, gain: 0.22, type: 'highpass', f0: 3000, q: 1 });
    this._noise(t + 0.07, { dur: 0.06, gain: 0.26, type: 'highpass', f0: 2600, q: 1 });
    this._pluck(PENTA[5], t + 0.1, { gain: 0.08, dur: 0.35 });
  }

  splash() {
    if (!this.ctx) return; const t = this.now;
    this._noise(t, { dur: 0.3, gain: 0.2, f0: 900, f1: 260, q: 1.4 });
    // しずくの跳ね
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const tt = t + 0.06 + i * 0.07;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(700 + Math.random() * 400, tt);
      o.frequency.exponentialRampToValueAtTime(1400 + Math.random() * 600, tt + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.linearRampToValueAtTime(0.09, tt + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0005, tt + 0.1);
      o.connect(g); g.connect(this.master);
      o.start(tt); o.stop(tt + 0.12);
    }
  }

  chimeSuccess() {
    if (!this.ctx) return; const t = this.now;
    [0, 2, 4, 7].forEach((n, i) => this._pluck(PENTA[n], t + i * 0.09, { gain: 0.18, dur: 1.0 }));
  }

  gliss(up = true) {
    if (!this.ctx) return; const t = this.now;
    for (let i = 0; i < 9; i++) {
      const idx = up ? i : 8 - i;
      this._pluck(PENTA[idx], t + i * 0.05, { gain: 0.13, dur: 0.8 });
    }
  }

  whoosh(dur = 1.2) {
    if (!this.ctx) return; const t = this.now;
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuf; src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 0.7;
    flt.frequency.setValueAtTime(180, t);
    flt.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.55);
    flt.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.1);
  }

  doorCreak() {
    if (!this.ctx) return; const t = this.now;
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(95, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.15);
    g.gain.linearRampToValueAtTime(0, t + 1.1);
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 300;
    o.connect(flt); flt.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 1.2);
    this.whoosh(1.6);
  }

  bloomNote(i) {
    if (!this.ctx) return;
    this._pluck(PENTA[i % PENTA.length], this.now, { gain: 0.12, dur: 0.9 });
  }

  fanfare() {
    if (!this.ctx) return; const t = this.now;
    const seq = [0, 2, 4, 5, 7, 9, 7, 9];
    seq.forEach((n, i) => this._pluck(PENTA[n % PENTA.length], t + i * 0.11, { gain: 0.2, dur: 1.2 }));
    this._noise(t + 0.1, { dur: 1.4, gain: 0.05, type: 'highpass', f0: 6000, q: 0.5 });
  }

  // ---- BGM ----

  setMode(mode) { this.mode = mode; this._partyStep = 0; }

  _startMusicLoop() {
    if (this._musicTimer) return;
    this._nextNoteTime = this.now + 0.3;
    this._musicTimer = setInterval(() => this._scheduleMusic(), 120);
  }

  _scheduleMusic() {
    if (!this.ctx || this.mode === 'off') return;
    const ahead = 0.35;
    while (this._nextNoteTime < this.now + ahead) {
      if (this.mode === 'prep') this._prepNote(this._nextNoteTime);
      else if (this.mode === 'party') this._partyNote(this._nextNoteTime);
      this._nextNoteTime += this.mode === 'party' ? 0.2727 : (1.6 + Math.random() * 1.4);
    }
  }

  _prepNote(t) {
    // まばらなオルゴール（準備中の静けさ）
    const n = PENTA[(Math.random() * 6 | 0)];
    this._mgPluck(n, t, 0.35, 1.6);
  }

  _partyNote(t) {
    // C - G - Am - F を8分でアルペジオ（オルゴール）
    const chords = [
      [261.63, 329.63, 392.0, 523.25],
      [196.0, 293.66, 392.0, 493.88],
      [220.0, 329.63, 440.0, 523.25],
      [174.61, 261.63, 349.23, 440.0],
    ];
    const bar = (this._partyStep / 8 | 0) % 4;
    const step = this._partyStep % 8;
    const ch = chords[bar];
    const order = [0, 2, 1, 3, 2, 0, 3, 1];
    this._mgPluck(ch[order[step]] * 2, t, 0.5, 0.9);
    if (step === 0) this._mgPluck(ch[0] / 2, t, 0.5, 1.4); // ベース
    if (step === 4) this._mgPluck(ch[0], t, 0.3, 1.0);
    this._partyStep++;
  }

  _mgPluck(freq, t, gain, dur) {
    const ctx = this.ctx; if (!ctx) return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    g.connect(this.musicGain);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 3;
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(gain * 0.25, t);
    g2.gain.exponentialRampToValueAtTime(0.0004, t + dur * 0.3);
    o1.connect(g); o2.connect(g2); g2.connect(this.musicGain);
    o1.start(t); o1.stop(t + dur + 0.1);
    o2.start(t); o2.stop(t + dur * 0.35);
  }
}
