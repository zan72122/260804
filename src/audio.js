// All sound is synthesised at runtime — no audio files, no network.
// The signature sound of this game is the SCBA: a regulator that opens with a
// rush on every breath in and sighs out through the exhalation valve.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return null; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 6;
      this.master.connect(this.comp).connect(this.ctx.destination);

      // Muffle bus: everything the firefighter hears through the facepiece.
      this.muffle = this.ctx.createBiquadFilter();
      this.muffle.type = 'lowpass';
      this.muffle.frequency.value = 20000;
      this.muffle.connect(this.master);

      this.noiseBuf = this._noiseBuffer(2.5);
      this._startAmbience();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.started = true;
    return this.ctx;
  }

  _noiseBuffer(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;    // brownish
      d[i] = last * 3.2 + w * 0.25;
    }
    return buf;
  }

  _noise(dest, gain = 1, loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    s.connect(g).connect(dest);
    return { src: s, gain: g };
  }

  /** Room tone: distant appliance pump, building rumble, a soft roar. */
  _startAmbience() {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0.0;
    bus.connect(this.muffle);
    this.ambBus = bus;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.7;
    lp.connect(bus);
    const n = this._noise(lp, 0.55);
    n.src.start();

    // The pump on the appliance, a steady low throb outside.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = 47;
    const og = ctx.createGain(); og.gain.value = 0.03;
    const olp = ctx.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 160;
    osc.connect(og).connect(olp).connect(bus);
    osc.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
    const lg = ctx.createGain(); lg.gain.value = 0.014;
    lfo.connect(lg).connect(og.gain); lfo.start();

    bus.gain.setTargetAtTime(0.5, ctx.currentTime, 1.2);
  }

  setMuffle(amount) {         // 0 = clear, 1 = deep inside with the mask on
    if (!this.ctx) return;
    const f = 20000 * Math.pow(0.06, amount);
    this.muffle.frequency.setTargetAtTime(Math.max(420, f), this.ctx.currentTime, 0.25);
  }

  setAmbience(level) {
    if (!this.ctx) return;
    this.ambBus.gain.setTargetAtTime(level, this.ctx.currentTime, 0.6);
  }

  /** One SCBA breath: the regulator cracks open, then a sigh out. */
  breath(intensity = 1) {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    // Inhale — air rushing past the demand valve
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 1.1;
    bp.connect(this.muffle);
    const n = this._noise(bp, 0);
    n.src.start(t);
    n.gain.gain.setValueAtTime(0.0001, t);
    n.gain.gain.exponentialRampToValueAtTime(0.24 * intensity, t + 0.16);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
    bp.frequency.setValueAtTime(380, t);
    bp.frequency.linearRampToValueAtTime(1150, t + 0.5);
    bp.frequency.linearRampToValueAtTime(500, t + 1.1);
    n.src.stop(t + 1.3);

    // Exhale — lower, softer, through the valve
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass'; bp2.frequency.value = 300; bp2.Q.value = 0.9;
    bp2.connect(this.muffle);
    const n2 = this._noise(bp2, 0);
    n2.src.start(t + 1.15);
    n2.gain.gain.setValueAtTime(0.0001, t + 1.15);
    n2.gain.gain.exponentialRampToValueAtTime(0.17 * intensity, t + 1.35);
    n2.gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.35);
    bp2.frequency.setValueAtTime(520, t + 1.15);
    bp2.frequency.linearRampToValueAtTime(240, t + 2.2);
    n2.src.stop(t + 2.5);
  }

  /** Turnout gear and knees dragging over floorboards. */
  scuff(strength = 1) {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
    bp.connect(this.muffle);
    const n = this._noise(bp, 0);
    n.src.start(t);
    n.gain.gain.setValueAtTime(0.0001, t);
    n.gain.gain.exponentialRampToValueAtTime(0.16 * strength, t + 0.05);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    bp.frequency.setValueAtTime(900 + Math.random() * 500, t);
    bp.frequency.exponentialRampToValueAtTime(320, t + 0.4);
    n.src.stop(t + 0.5);
    // The cylinder knocking gently against the backplate
    this.thud(0.35 * strength, 96 + Math.random() * 20);
  }

  thud(gain = 0.5, freq = 90) {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(this.muffle);
    o.start(t); o.stop(t + 0.3);
  }

  /** Metallic click — mask latching, cylinder valve, buckle. */
  click(freq = 2200, gain = 0.18) {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 5;
    o.connect(g).connect(bp).connect(this.muffle);
    o.start(t); o.stop(t + 0.09);
  }

  /** Air hissing as the cylinder valve is opened. */
  hiss(dur = 0.9, gain = 0.20) {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1800;
    hp.connect(this.muffle);
    const n = this._noise(hp, 0);
    n.src.start(t);
    n.gain.gain.setValueAtTime(0.0001, t);
    n.gain.gain.exponentialRampToValueAtTime(gain, t + 0.08);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.src.stop(t + dur + 0.1);
  }

  /** The reward: a rising bell figure. */
  chime(root = 660, n = 4, gain = 0.16) {
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = ctx.currentTime;
    const ratios = [1, 1.25, 1.5, 2, 2.5];
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.10;
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = root * ratios[i % ratios.length];
      const o2 = ctx.createOscillator();
      o2.type = 'sine'; o2.frequency.value = root * ratios[i % ratios.length] * 2.01;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      const g2 = ctx.createGain(); g2.gain.value = 0.3;
      o.connect(g).connect(this.master);
      o2.connect(g2).connect(g);
      o.start(t); o.stop(t + 1.0);
      o2.start(t); o2.stop(t + 1.0);
    }
  }

  /** A small, friendly meow. */
  meow() {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(760, t + 0.16);
    o.frequency.linearRampToValueAtTime(430, t + 0.62);
    const vib = ctx.createOscillator(); vib.frequency.value = 15;
    const vg = ctx.createGain(); vg.gain.value = 22;
    vib.connect(vg).connect(o.frequency); vib.start(t); vib.stop(t + 0.7);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 880; f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2100; f2.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.09);
    g.gain.setValueAtTime(0.16, t + 0.42);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    g.connect(this.master);
    o.start(t); o.stop(t + 0.75);
  }

  /** Whoosh as the body drops into the clear layer. */
  whoosh(down = true) {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(down ? 1400 : 400, t);
    bp.frequency.exponentialRampToValueAtTime(down ? 260 : 1500, t + 0.45);
    bp.connect(this.muffle);
    const n = this._noise(bp, 0);
    n.src.start(t);
    n.gain.gain.setValueAtTime(0.0001, t);
    n.gain.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
    n.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    n.src.stop(t + 0.6);
  }

  /** Big warm finish when everyone is outside. */
  fanfare() {
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = ctx.currentTime;
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.13;
      for (const [type, amp, det] of [['triangle', 0.13, 1], ['sine', 0.09, 2.0], ['sine', 0.05, 3.0]]) {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = f * det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        o.connect(g).connect(this.master);
        o.start(t); o.stop(t + 1.6);
      }
    });
    // A short two-tone from the appliance, friendly not blaring.
    for (let i = 0; i < 2; i++) {
      const t = t0 + 0.75 + i * 0.42;
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = i ? 466 : 587;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.10, t + 0.04);
      g.gain.setValueAtTime(0.10, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 0.45);
    }
  }

  /** Soft "not yet" nudge — never a punishment sound. */
  nudge() {
    const ctx = this.ensure(); if (!ctx) return;
    const t = ctx.currentTime;
    [740, 587].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      const s = t + i * 0.13;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.07, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.3);
      o.connect(g).connect(this.master);
      o.start(s); o.stop(s + 0.32);
    });
  }
}
