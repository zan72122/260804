// Tiny synthesised sound kit. No audio files: everything is generated with
// WebAudio so the game stays a couple of hundred KB and works offline.
//
// The palette is deliberately soft — knocks, taps and shimmers, nothing that
// startles a small child.

export class AudioKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.wet = null;
    this.enabled = true;
  }

  // Must be called from inside a user gesture (iOS requirement).
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { this.enabled = false; return; }
      try { this.ctx = new Ctx(); } catch (e) { this.enabled = false; return; }
      this._build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _build() {
    const ctx = this.ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);

    // Short synthetic room so knocks sound like they happen on a wooden table.
    const conv = ctx.createConvolver();
    conv.buffer = this._impulse(1.1, 2.6);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.32;
    this.wet.connect(conv);
    conv.connect(this.master);
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * 0.6;
      }
    }
    return buf;
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  _out(node, send) {
    node.connect(this.master);
    if (send > 0 && this.wet) {
      const s = this.ctx.createGain();
      s.gain.value = send;
      node.connect(s);
      s.connect(this.wet);
    }
  }

  tone(o) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = this.t + (o.delay || 0);
    const dur = o.dur ?? 0.25;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t0 + dur);

    const g = ctx.createGain();
    const peak = o.gain ?? 0.18;
    const atk = o.attack ?? 0.006;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    this._out(g, o.send ?? 0.25);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(o) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = this.t + (o.delay || 0);
    const dur = o.dur ?? 0.2;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type = o.filter || 'bandpass';
    filt.frequency.setValueAtTime(o.freq ?? 1200, t0);
    if (o.sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(60, o.sweepTo), t0 + dur);
    filt.Q.value = o.q ?? 1.0;

    const g = ctx.createGain();
    const peak = o.gain ?? 0.1;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filt); filt.connect(g);
    this._out(g, o.send ?? 0.2);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ---- game events -------------------------------------------------------

  pick() {
    this.tone({ freq: 520, slideTo: 760, dur: 0.11, type: 'sine', gain: 0.10, send: 0.15 });
    this.noise({ dur: 0.05, freq: 2400, gain: 0.03, send: 0.1 });
  }

  // continuous-ish "the bottom is touching the caramel" tick
  dipTouch() {
    this.noise({ dur: 0.18, filter: 'lowpass', freq: 900, sweepTo: 380, gain: 0.055, send: 0.3 });
  }

  dipDone() {
    this.tone({ freq: 300, slideTo: 520, dur: 0.22, type: 'sine', gain: 0.11, send: 0.35 });
    this.tone({ freq: 1180, dur: 0.3, type: 'sine', gain: 0.035, delay: 0.05, send: 0.4 });
  }

  // caramel thread snapping as the choux leaves the pot
  thread() {
    this.tone({ freq: 1500, slideTo: 2600, dur: 0.16, type: 'sine', gain: 0.045, send: 0.4 });
  }

  // "kotsu / kachi" — the heart of the game
  attach(level) {
    const base = 168 * Math.pow(2, (level || 0) * 0.13);
    this.tone({ freq: base, slideTo: base * 0.82, dur: 0.16, type: 'triangle', gain: 0.26, send: 0.3 });
    this.tone({ freq: base * 2.02, dur: 0.09, type: 'sine', gain: 0.09, send: 0.25 });
    this.noise({ dur: 0.045, freq: 2100, q: 2.4, gain: 0.075, send: 0.25 });   // the "kachi" click
    this.noise({ dur: 0.13, filter: 'lowpass', freq: 520, gain: 0.05, send: 0.35 }); // sticky body
  }

  wrong() { // gentle "not yet" — never harsh
    this.tone({ freq: 300, slideTo: 240, dur: 0.16, type: 'sine', gain: 0.07, send: 0.2 });
  }

  ringDone(level) {
    const scale = [0, 2, 4, 7, 9, 12];
    const root = 392 * Math.pow(2, level * 0.16);
    for (let i = 0; i < 3; i++) {
      this.tone({
        freq: root * Math.pow(2, scale[i + 1] / 12), dur: 0.42, type: 'sine',
        gain: 0.10, delay: i * 0.085, send: 0.5,
      });
    }
  }

  crown() {
    const root = 523.25;
    [0, 4, 7, 12, 16].forEach((s, i) => {
      this.tone({ freq: root * Math.pow(2, s / 12), dur: 0.9, type: 'sine', gain: 0.10, delay: i * 0.07, send: 0.6 });
    });
    this.tone({ freq: 130.8, dur: 1.2, type: 'sine', gain: 0.14, send: 0.4 });
  }

  whoosh(i) {
    this.noise({
      dur: 0.42, filter: 'bandpass', freq: 700 + (i % 3) * 240, sweepTo: 4200,
      q: 0.8, gain: 0.075, send: 0.45,
    });
    this.tone({ freq: 1800 + (i % 5) * 130, slideTo: 3200, dur: 0.28, type: 'sine', gain: 0.028, send: 0.6 });
  }

  finale() {
    const root = 659.25;
    [0, 7, 12, 19, 24].forEach((s, i) => {
      this.tone({ freq: root * Math.pow(2, s / 12), dur: 1.8, type: 'sine', gain: 0.09, delay: i * 0.11, send: 0.7 });
    });
    for (let i = 0; i < 9; i++) {
      this.tone({
        freq: 1400 + Math.random() * 2600, dur: 0.5 + Math.random() * 0.5,
        type: 'sine', gain: 0.022, delay: 0.25 + i * 0.09, send: 0.75,
      });
    }
  }

  sparkle() {
    this.tone({ freq: 2100 + Math.random() * 1800, dur: 0.32, type: 'sine', gain: 0.024, send: 0.6 });
  }
}
