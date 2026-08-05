// Every sound is synthesised — no files to load, nothing to wait for.
// Soft, toy-like, and quiet enough to live with.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ready = false;
    this._motor = null;
  }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;

    this.master = c.createGain();
    this.master.gain.value = 0.85;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    this.master.connect(comp).connect(c.destination);

    this.sfx = c.createGain();
    this.sfx.gain.value = 1.0;
    this.sfx.connect(this.master);

    this.music = c.createGain();
    this.music.gain.value = 0.34;
    this.music.connect(this.master);

    // reverb-ish shimmer for bells
    this.verb = c.createConvolver();
    this.verb.buffer = this._impulse(1.7, 2.4);
    const verbGain = c.createGain();
    verbGain.gain.value = 0.3;
    this.verb.connect(verbGain).connect(this.master);

    this.noise = this._noiseBuffer(2.0);
    this.ready = true;
    this._scheduleMusic();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(on ? 0.85 : 0.0, t, 0.08);
    }
  }

  _impulse(dur, decay) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _noiseBuffer(dur) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _noiseSource(when, dur, type, f0, f1, q, gain, dest) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, when);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), when + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + dur * 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filt).connect(g).connect(dest || this.sfx);
    src.start(when);
    src.stop(when + dur + 0.02);
    return g;
  }

  _tone(when, freq, dur, type, gain, dest, glideTo) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, when + dur * 0.9);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(dest || this.sfx);
    o.start(when);
    o.stop(when + dur + 0.03);
    return g;
  }

  // ----------------------------------------------------------- game sounds

  /** ふわっ — cloth blooming open. */
  fluff(strength = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._noiseSource(t, 0.5 + strength * 0.4, 'bandpass', 500, 1900, 0.9, 0.1 * strength);
  }

  /** Chalk tracing whisper. */
  chalk() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._noiseSource(t, 0.11, 'bandpass', 1600 + Math.random() * 900, 900, 3.5, 0.055);
  }

  /** ちょきっ — one scissor snip. */
  snip() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._noiseSource(t, 0.055, 'bandpass', 3400, 1400, 7, 0.16);
    this._tone(t + 0.012, 2100 + Math.random() * 400, 0.07, 'triangle', 0.045);
    this._noiseSource(t + 0.05, 0.05, 'bandpass', 2500, 5200, 8, 0.1);
  }

  /** カタッ — one stitch of the sewing machine. */
  stitch() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._tone(t, 240, 0.05, 'square', 0.05);
    this._noiseSource(t, 0.04, 'highpass', 2400, 3200, 1, 0.07);
  }

  /** Low motor hum while the machine is running. */
  motor(on) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    if (on && !this._motor) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 74;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.15);
      o.connect(lp).connect(g).connect(this.sfx);
      o.start(t);
      this._motor = { o, g };
    } else if (!on && this._motor) {
      const { o, g } = this._motor;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.stop(t + 0.25);
      this._motor = null;
    }
  }

  /** くるん — the turn. */
  twirl() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._noiseSource(t, 0.7, 'bandpass', 400, 2600, 1.4, 0.09);
    for (let i = 0; i < 6; i++) {
      this._tone(t + i * 0.075, 523.25 * Math.pow(2, PENTA[i] / 12), 0.5, 'triangle', 0.06, this.verb);
      this._tone(t + i * 0.075, 523.25 * Math.pow(2, PENTA[i] / 12), 0.45, 'sine', 0.05);
    }
  }

  /** Placing a decoration. */
  pop(step = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const f = 523.25 * Math.pow(2, PENTA[step % PENTA.length] / 12);
    this._tone(t, f, 0.42, 'sine', 0.13, this.verb);
    this._tone(t, f * 2, 0.16, 'triangle', 0.05);
    this._tone(t + 0.005, f * 0.5, 0.3, 'sine', 0.05);
  }

  /** A phase is complete. */
  chime() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    [0, 4, 7, 12].forEach((s, i) => {
      const f = 523.25 * Math.pow(2, s / 12);
      this._tone(t + i * 0.06, f, 0.9, 'sine', 0.09, this.verb);
      this._tone(t + i * 0.06, f, 0.6, 'triangle', 0.04);
    });
  }

  /** The garment is finished. */
  fanfare() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const notes = [0, 4, 7, 12, 16, 19, 24];
    notes.forEach((s, i) => {
      const f = 523.25 * Math.pow(2, s / 12);
      this._tone(t + i * 0.085, f, 1.1, 'sine', 0.1, this.verb);
      this._tone(t + i * 0.085, f, 0.7, 'triangle', 0.045);
    });
    this._noiseSource(t + 0.1, 1.2, 'highpass', 2000, 6000, 0.7, 0.05);
  }

  /** Gentle tick when a tool is picked up. */
  tick() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._tone(t, 880, 0.16, 'sine', 0.07, this.verb);
  }

  // ----------------------------------------------------------- music box

  _scheduleMusic() {
    if (!this.ready) return;
    const c = this.ctx;
    let step = 0;
    const bar = [0, 4, 7, 9, 7, 4, 2, 4];
    const play = () => {
      if (!this.ctx || this.ctx.state === 'closed') return;
      const t = c.currentTime + 0.05;
      const s = bar[step % bar.length];
      const oct = step % 16 < 8 ? 0 : 12;
      const f = 261.63 * Math.pow(2, (s + oct) / 12);
      this._tone(t, f * 2, 1.5, 'sine', 0.05, this.verb);
      this._tone(t, f * 2, 0.9, 'triangle', 0.022, this.music);
      if (step % 4 === 0) this._tone(t, f * 0.5, 2.4, 'sine', 0.035, this.music);
      if (step % 8 === 3) this._tone(t + 0.3, f * 3, 1.1, 'sine', 0.02, this.verb);
      step++;
      this._musicTimer = setTimeout(play, 780);
    };
    play();
  }
}
