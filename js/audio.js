// Procedural WebAudio sound effects — no audio assets needed.
export class SFX {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this._bellTimer = null;
    this._motor = null;
    this._noiseBuf = null;
  }

  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.55;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.master.connect(this.comp).connect(c.destination);
    // white noise buffer
    const len = c.sampleRate;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
    this.enabled = true;
    this._startAmbient();
    c.resume();
  }

  _startAmbient() {
    const c = this.ctx;
    // gentle water lapping: filtered noise with slow amplitude wobble
    const src = c.createBufferSource();
    src.buffer = this._noiseBuf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.028;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.23;
    const lfoG = c.createGain(); lfoG.gain.value = 0.014;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start(); lfo.start();
    // soft wind band
    const w = c.createBufferSource(); w.buffer = this._noiseBuf; w.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.4;
    const wg = c.createGain(); wg.gain.value = 0.008;
    w.connect(bp).connect(wg).connect(this.master);
    w.start();
  }

  _noise(dur, filterType, freq, q, gain, sweepTo) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this._noiseBuf;
    const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.linearRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5, dur + 0.05);
    src.stop(t + dur + 0.06);
  }

  _tone(type, f0, f1, dur, gain, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  tap() { if (this.ctx) this._tone('sine', 620, 880, 0.09, 0.12); }

  pop() { if (!this.ctx) return; this._tone('sine', 300, 900, 0.12, 0.2); this._noise(0.08, 'highpass', 2000, 1, 0.08); }

  squeak() {
    if (!this.ctx) return;
    this._tone('sine', 1900, 900, 0.22, 0.05);
    this._tone('sine', 2450, 1300, 0.18, 0.03);
  }

  pour() {
    if (!this.ctx) return;
    this._noise(0.7, 'bandpass', 900, 2, 0.10, 500);
    // glug blips
    for (let i = 0; i < 4; i++) this._tone('sine', 500 - i * 60, 300 - i * 40, 0.1, 0.07, 0.12 + i * 0.14);
  }

  clank(big = false) {
    if (!this.ctx) return;
    const fs = big ? [140, 233, 380, 620] : [220, 355, 590];
    fs.forEach((f, i) => this._tone('square', f, f * 0.98, big ? 0.4 : 0.22, (big ? 0.10 : 0.07) / (i + 1)));
    this._noise(0.1, 'highpass', 1500, 1, big ? 0.18 : 0.1);
  }

  ratchet() { if (!this.ctx) return; this._tone('square', 900, 700, 0.03, 0.05); this._noise(0.03, 'highpass', 2500, 1, 0.05); }

  splash() {
    if (!this.ctx) return;
    this._noise(0.45, 'lowpass', 1400, 0.7, 0.20, 300);
    this._tone('sine', 260, 90, 0.3, 0.1);
  }

  chime(step = 0) {
    if (!this.ctx) return;
    const pent = [523, 587, 659, 784, 880, 1047, 1175];
    const f = pent[step % pent.length];
    this._tone('sine', f, f, 0.5, 0.16);
    this._tone('sine', f * 2, f * 2, 0.3, 0.05);
  }

  fanfare() {
    if (!this.ctx) return;
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => {
      this._tone('triangle', f, f, 0.4, 0.16, i * 0.16);
      this._tone('sine', f * 2, f * 2, 0.25, 0.05, i * 0.16);
    });
    this._tone('triangle', 1319, 1319, 0.8, 0.14, seq.length * 0.16);
  }

  horn(dur = 1.6, delay = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.12);
    g.gain.setValueAtTime(0.32, t + dur - 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 2;
    g.connect(lp).connect(this.master);
    [65, 97.5, 130].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = f * (1 + (i - 1) * 0.0015);
      const og = c.createGain(); og.gain.value = i === 2 ? 0.35 : 1;
      o.connect(og).connect(g);
      o.start(t); o.stop(t + dur + 0.1);
    });
  }

  bellStart() {
    const c = this.ctx; if (!c || this._bellTimer) return;
    const strike = () => {
      this._tone('triangle', 1180, 1160, 0.28, 0.10);
      this._tone('sine', 2360, 2320, 0.15, 0.03);
      this._noise(0.03, 'highpass', 3000, 1, 0.04);
    };
    strike();
    this._bellTimer = setInterval(strike, 640);
  }
  bellStop() { if (this._bellTimer) { clearInterval(this._bellTimer); this._bellTimer = null; } }

  motorStart() {
    const c = this.ctx; if (!c || this._motor) return;
    const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 1.2);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 190; lp.Q.value = 1.4;
    g.connect(lp).connect(this.master);
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 46;
    const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 46.6;
    const chug = c.createOscillator(); chug.frequency.value = 7.3;
    const chugG = c.createGain(); chugG.gain.value = 0.05;
    chug.connect(chugG).connect(g.gain);
    o1.connect(g); o2.connect(g);
    // gear whirr
    const n = c.createBufferSource(); n.buffer = this._noiseBuf; n.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 340; bp.Q.value = 2;
    const ng = c.createGain(); ng.gain.value = 0.03;
    n.connect(bp).connect(ng).connect(this.master);
    o1.start(); o2.start(); chug.start(); n.start();
    this._motor = { g, ng, nodes: [o1, o2, chug, n] };
  }
  motorStop() {
    const c = this.ctx; if (!c || !this._motor) return;
    const m = this._motor; this._motor = null;
    const t = c.currentTime;
    m.g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    m.ng.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    setTimeout(() => m.nodes.forEach(n => { try { n.stop(); } catch (e) {} }), 1000);
  }

  gullCry() {
    if (!this.ctx) return;
    this._tone('sawtooth', 1250, 850, 0.28, 0.014);
    this._tone('sawtooth', 1400, 950, 0.22, 0.010, 0.32);
  }
}
