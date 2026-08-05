/**
 * All game audio is synthesized with WebAudio – no asset files.
 * Everything routes through a master gain + soft compressor.
 */
export class SoundKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.waterGain = null;
    this._noiseBuf = null;
  }

  /** must be called from a user gesture */
  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.75;
    this.master.connect(comp);
    this._makeNoise();
    this._makeWaterLoop();
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
  }

  _makeWaterLoop() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 620;
    lp.Q.value = 0.8;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.7;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);
    this.waterGain = this.ctx.createGain();
    this.waterGain.gain.value = 0;
    src.connect(lp).connect(this.waterGain).connect(this.master);
    src.start();
    lfo.start();
  }

  /** 0..1 loudness of running water */
  setWater(level) {
    if (!this.ctx) return;
    this.waterGain.gain.setTargetAtTime(level * 0.5, this.ctx.currentTime, 0.25);
  }

  _env(node, t0, a, peak, d) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  _tone(freq, { type = 'sine', dur = 0.2, vol = 0.25, slide = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    const g = this.ctx.createGain();
    this._env(g, t0, 0.008, vol, dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  }

  _noise({ dur = 0.15, vol = 0.2, freq = 1200, q = 1, type = 'bandpass', delay = 0, slide = 0 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t0 + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t0, 0.01, vol, dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.1);
  }

  // ------- one-shot game sounds -------
  tap() { this._tone(520, { dur: 0.09, vol: 0.18, slide: 240 }); }

  swish() {
    this._noise({ dur: 0.22, vol: 0.16, freq: 2600, q: 0.7, slide: -1400 });
  }

  scrape() {
    this._noise({ dur: 0.14, vol: 0.14, freq: 420, q: 1.4, type: 'bandpass' });
    this._noise({ dur: 0.1, vol: 0.06, freq: 1600, q: 0.6 });
  }

  plant() {
    this._tone(300, { type: 'triangle', dur: 0.12, vol: 0.22, slide: -140 });
    this._tone(660, { dur: 0.14, vol: 0.12, slide: 160, delay: 0.05 });
  }

  snap() {
    this._noise({ dur: 0.06, vol: 0.3, freq: 900, q: 2 });
    this._tone(392, { dur: 0.18, vol: 0.2, delay: 0.05 });
    this._tone(523, { dur: 0.24, vol: 0.18, delay: 0.12 });
  }

  boing() {
    this._tone(180, { type: 'triangle', dur: 0.3, vol: 0.24, slide: 420 });
    this._tone(784, { dur: 0.2, vol: 0.14, delay: 0.16 });
  }

  ratchet() {
    this._noise({ dur: 0.05, vol: 0.22, freq: 700, q: 3 });
    this._tone(120, { type: 'square', dur: 0.05, vol: 0.05 });
  }

  splash() {
    this._noise({ dur: 0.5, vol: 0.4, freq: 900, q: 0.8, slide: -600 });
    this._noise({ dur: 0.35, vol: 0.2, freq: 2400, q: 0.7, delay: 0.06, slide: -1500 });
  }

  rumble() {
    this._noise({ dur: 1.2, vol: 0.35, freq: 140, q: 1, type: 'lowpass' });
  }

  chimeNote(i, delay = 0, vol = 0.2) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5];
    const f = scale[i % scale.length] * (1 + Math.floor(i / scale.length));
    this._tone(f, { dur: 0.5, vol, delay });
    this._tone(f * 2, { dur: 0.3, vol: vol * 0.3, delay });
  }

  fanfare() {
    const seq = [0, 2, 4, 5, 7, 5, 7];
    seq.forEach((n, i) => this.chimeNote(n, i * 0.13, 0.22));
  }

  bigFanfare() {
    const seq = [0, 4, 7, 12, 7, 12, 14, 16];
    const scale = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5,
      1174.66, 1318.51, 1396.91, 1567.98, 1760, 1975.53, 2093, 2349.32, 2637];
    seq.forEach((n, i) => {
      this._tone(scale[Math.min(n, 16)], { dur: 0.6, vol: 0.2, delay: i * 0.16 });
    });
  }

  bird() {
    const base = 2200 + Math.random() * 1200;
    this._tone(base, { dur: 0.07, vol: 0.07, slide: 900 });
    this._tone(base * 1.2, { dur: 0.06, vol: 0.06, slide: -700, delay: 0.09 });
    this._tone(base * 0.9, { dur: 0.05, vol: 0.05, slide: 800, delay: 0.17 });
  }

  creakLoopTick() {
    this._noise({ dur: 0.09, vol: 0.08, freq: 260, q: 4 });
  }
}
