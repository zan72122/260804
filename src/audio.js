// All sound is synthesised with the Web Audio API — no asset downloads, and the
// effects can be modulated by gameplay (motor pitch follows claw speed, etc).
//
// There is intentionally no continuous music bed: the contact sounds are the
// point, so the mix stays quiet and reactive.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.enabled = true;
    this.master = null;
    this._noise = null;
    this._motor = null;
  }

  /** Must be called from inside a user gesture (iOS unlock). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    // silent tick — some iOS versions need a source started in the gesture
    const b = this.ctx.createBuffer(1, 1, 22050);
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.master);
    s.start(0);

    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.ready = true;
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  noiseBuffer() {
    if (this._noise) return this._noise;
    const len = Math.floor(this.ctx.sampleRate * 1.2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  _gain(v = 1) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(this.master);
    return g;
  }

  _env(node, { a = 0.005, d = 0.2, peak = 1, t0 = null } = {}) {
    const t = t0 ?? this.t;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return t + a + d;
  }

  tone(freq, { type = 'sine', dur = 0.2, gain = 0.2, attack = 0.005, detune = 0, slideTo = null, delay = 0 } = {}) {
    if (!this.ready || !this.enabled) return;
    const t0 = this.t + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    o.detune.value = detune;
    const g = this._gain(0);
    o.connect(g);
    this._env(g, { a: attack, d: dur, peak: gain, t0 });
    o.start(t0);
    o.stop(t0 + dur + attack + 0.06);
  }

  noise({ dur = 0.15, gain = 0.2, freq = 1200, q = 1, type = 'bandpass', delay = 0, sweepTo = null, attack = 0.004 } = {}) {
    if (!this.ready || !this.enabled) return;
    const t0 = this.t + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
    f.Q.value = q;
    const g = this._gain(0);
    src.connect(f); f.connect(g);
    this._env(g, { a: attack, d: dur, peak: gain, t0 });
    src.start(t0);
    src.stop(t0 + dur + attack + 0.08);
  }

  /* ---------------- game sounds ---------------- */

  /** Continuous gantry motor; call setMotor(0..1) each frame. */
  setMotor(amount, pitch = 1) {
    if (!this.ready || !this.enabled) return;
    if (!this._motor) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 62;
      const o2 = this.ctx.createOscillator();
      o2.type = 'square';
      o2.frequency.value = 31;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      f.Q.value = 3;
      const g = this._gain(0);
      o.connect(f); o2.connect(f); f.connect(g);
      o.start(); o2.start();
      this._motor = { o, o2, f, g };
    }
    const m = this._motor;
    const target = Math.min(0.055, amount * 0.055);
    m.g.gain.setTargetAtTime(target, this.t, 0.05);
    m.o.frequency.setTargetAtTime(58 * pitch, this.t, 0.08);
    m.o2.frequency.setTargetAtTime(29 * pitch, this.t, 0.08);
    m.f.frequency.setTargetAtTime(320 + amount * 380, this.t, 0.08);
  }

  servo(open = true) {
    if (!this.ready) return;
    this.noise({ dur: 0.055, gain: 0.16, freq: 2600, q: 2, type: 'bandpass' });
    this.tone(open ? 320 : 260, { type: 'square', dur: 0.09, gain: 0.035, slideTo: open ? 420 : 190 });
    this.noise({ dur: 0.22, gain: 0.05, freq: 700, q: 1.4, sweepTo: open ? 1100 : 520, delay: 0.02 });
  }

  clunk() {
    if (!this.ready) return;
    this.tone(150, { type: 'sine', dur: 0.09, gain: 0.16, slideTo: 90 });
    this.noise({ dur: 0.05, gain: 0.1, freq: 1800, q: 1 });
  }

  /** Claw meets fabric: soft, dull, no click. */
  softTouch(strength = 1) {
    if (!this.ready) return;
    const s = Math.min(1, Math.max(0.15, strength));
    this.noise({ dur: 0.16 + s * 0.1, gain: 0.09 * s, freq: 420, q: 0.7, type: 'lowpass', sweepTo: 190, attack: 0.012 });
    this.tone(120 + 40 * s, { type: 'sine', dur: 0.13, gain: 0.05 * s, slideTo: 74 });
  }

  /** The "ゴトン" — prize hitting the delivery bin. */
  goton() {
    if (!this.ready) return;
    this.tone(88, { type: 'sine', dur: 0.42, gain: 0.42, slideTo: 44, attack: 0.004 });
    this.tone(132, { type: 'triangle', dur: 0.2, gain: 0.15, slideTo: 70 });
    this.noise({ dur: 0.09, gain: 0.24, freq: 900, q: 0.8, type: 'lowpass', sweepTo: 260 });
    this.noise({ dur: 0.3, gain: 0.07, freq: 240, q: 3, type: 'bandpass', delay: 0.07 });
    // small second tap, the toy settling
    this.tone(96, { type: 'sine', dur: 0.16, gain: 0.12, slideTo: 60, delay: 0.16 });
  }

  success() {
    if (!this.ready) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone(f, { type: 'triangle', dur: 0.3, gain: 0.14, delay: i * 0.085, attack: 0.008 });
      this.tone(f * 2, { type: 'sine', dur: 0.2, gain: 0.045, delay: i * 0.085 });
    });
    this.noise({ dur: 0.5, gain: 0.05, freq: 5200, q: 0.6, type: 'highpass', delay: 0.05 });
  }

  /** Something moved but was not caught — encouraging, not a failure buzzer. */
  wobble() {
    if (!this.ready) return;
    this.tone(392, { type: 'triangle', dur: 0.16, gain: 0.09 });
    this.tone(523.25, { type: 'triangle', dur: 0.22, gain: 0.08, delay: 0.09 });
  }

  blip(freq = 660) {
    if (!this.ready) return;
    this.tone(freq, { type: 'triangle', dur: 0.12, gain: 0.1 });
  }

  pop() {
    if (!this.ready) return;
    this.tone(760, { type: 'sine', dur: 0.1, gain: 0.11, slideTo: 1180 });
    this.noise({ dur: 0.05, gain: 0.04, freq: 3000, q: 1 });
  }

  cheer() {
    if (!this.ready) return;
    [0, 0.09, 0.18].forEach((d, i) => {
      this.tone([659.25, 880, 1174.66][i], { type: 'triangle', dur: 0.26, gain: 0.11, delay: d });
    });
  }

  stopMotor() { this.setMotor(0); }
}
