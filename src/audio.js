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
    this._drag = null;
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

  /**
   * Continuous gantry motor; call setMotor(0..1) each frame.
   * `load` (0..1, optional, default 0) is new: it is the fraction of the
   * carry weight the claw is currently fighting (0 while empty/descending,
   * ~1 while lifting/carrying a heavy plush). It only adds a low detuned
   * "straining" voice and a small dip in pitch/tone brightness — with
   * load=0 the output is bit-for-bit the same as before, so every existing
   * call site (which never passes a third argument) is unaffected.
   */
  setMotor(amount, pitch = 1, load = 0) {
    if (!this.ready || !this.enabled) return;
    if (!this._motor) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 62;
      const o2 = this.ctx.createOscillator();
      o2.type = 'square';
      o2.frequency.value = 31;
      // third voice: a low, slightly detuned growl that only surfaces under
      // load, so a heavy carry reads as the gantry working harder
      const o3 = this.ctx.createOscillator();
      o3.type = 'sawtooth';
      o3.frequency.value = 44;
      o3.detune.value = 17;
      const g3 = this.ctx.createGain();
      g3.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      f.Q.value = 3;
      const g = this._gain(0);
      o.connect(f); o2.connect(f); o3.connect(g3); g3.connect(f); f.connect(g);
      o.start(); o2.start(); o3.start();
      this._motor = { o, o2, o3, g3, f, g };
    }
    const m = this._motor;
    const l = Math.min(1, Math.max(0, load));
    // small headroom above the old 0.055 cap for the loaded case only —
    // the bed stays a bed, it just leans in a little when the claw strains
    const target = Math.min(0.06, amount * 0.055 * (1 + l * 0.2));
    m.g.gain.setTargetAtTime(target, this.t, 0.05);
    m.o.frequency.setTargetAtTime(58 * pitch * (1 - l * 0.035), this.t, 0.08);
    m.o2.frequency.setTargetAtTime(29 * pitch, this.t, 0.08);
    m.f.frequency.setTargetAtTime(320 + amount * 380 - l * 70, this.t, 0.08);
    m.g3.gain.setTargetAtTime(l * amount * 0.022, this.t, 0.1);
  }

  servo(open = true) {
    if (!this.ready) return;
    // mix: trimmed slightly (0.16->0.13, 0.05->0.045) now that regrip()
    // shares this timbre — the pair need headroom between them so a
    // regrip right after a full open/close doesn't read as a repeat
    this.noise({ dur: 0.055, gain: 0.13, freq: 2600, q: 2, type: 'bandpass' });
    this.tone(open ? 320 : 260, { type: 'square', dur: 0.09, gain: 0.035, slideTo: open ? 420 : 190 });
    this.noise({ dur: 0.22, gain: 0.045, freq: 700, q: 1.4, sweepTo: open ? 1100 : 520, delay: 0.02 });
  }

  /**
   * Small servo double-click for the director nudging the claw and
   * re-closing it — same electric-click timbre as servo() (same filter
   * bandpass, same square-wave click) but two short taps instead of one
   * open/close gesture, and quieter/shorter overall so it reads as a
   * correction rather than a full open or close.
   */
  regrip() {
    if (!this.ready) return;
    this.noise({ dur: 0.03, gain: 0.09, freq: 3000, q: 2.5, type: 'bandpass' });
    this.tone(300, { type: 'square', dur: 0.035, gain: 0.018, slideTo: 360 });
    this.noise({ dur: 0.03, gain: 0.08, freq: 2750, q: 2.5, type: 'bandpass', delay: 0.075 });
    this.tone(280, { type: 'square', dur: 0.035, gain: 0.016, slideTo: 330, delay: 0.075 });
  }

  clunk() {
    if (!this.ready) return;
    // trimmed 0.16->0.14: with softTouch/topple now firing nearby in the
    // same beat range, clunk no longer needs to be this loud to read
    this.tone(150, { type: 'sine', dur: 0.09, gain: 0.14, slideTo: 90 });
    this.noise({ dur: 0.05, gain: 0.1, freq: 1800, q: 1 });
  }

  /**
   * Short, slightly pitched wooden/plastic teeter — the prize catching on
   * the chute rim and rocking before it tips in. Called 2-3 times with an
   * increasing `phase`; each call decays the level and speeds up/raises the
   * pitch a touch, and alternates detune sign, so the repeats read as one
   * settling rock (tick...tick..tick.) rather than three identical hits.
   */
  creak(phase = 0) {
    if (!this.ready) return;
    const p = Math.max(0, phase);
    const decay = Math.pow(0.6, p);
    const base = 340 + p * 55;
    this.tone(base, {
      type: 'square', dur: 0.09, gain: 0.075 * decay, slideTo: base * 1.3,
      attack: 0.006, detune: (p % 2 ? 1 : -1) * (10 + p * 3),
    });
    this.noise({ dur: 0.045, gain: 0.03 * decay, freq: 1500 + p * 220, q: 3, type: 'bandpass', attack: 0.004 });
  }

  /** Claw meets fabric: soft, dull, no click. */
  softTouch(strength = 1) {
    if (!this.ready) return;
    const s = Math.min(1, Math.max(0.15, strength));
    // mix: bumped 0.09->0.1 base — contact is the star of the sequence,
    // so the first touch should sit clearly above the motor bed
    this.noise({ dur: 0.16 + s * 0.1, gain: 0.1 * s, freq: 420, q: 0.7, type: 'lowpass', sweepTo: 190, attack: 0.012 });
    this.tone(120 + 40 * s, { type: 'sine', dur: 0.13, gain: 0.055 * s, slideTo: 74 });
  }

  /**
   * Fingers pressing into fabric and dragging a toy sideways.
   * One-shot bump: layered filtered noise (a low breathy body + a higher
   * rasp for the fabric texture), gentle attack so it never clicks, and a
   * short downward sweep so each call sounds like a single scrape rather
   * than a static hiss. Runs ~0.3-0.6s scaled by `strength`.
   *
   * Design choice: I built BOTH a one-shot (this method, matching the
   * requested signature) and a sustained pair (startDrag/stopDrag,
   * below) sharing the same voice. The drag beat in this game spans a
   * variable, director-controlled span (a few cm nudge vs. a long drag
   * across the pile) — retriggering a fixed-length one-shot every frame
   * either stutters or leaves gaps, so a *continuous* drag reads far more
   * convincingly through startDrag()/stopDrag(), driven every frame like
   * setMotor(). fabricDrag() itself is kept for a single short scrape
   * (e.g. one bump against a neighbouring toy) where a sustained voice
   * would be overkill.
   */
  fabricDrag(strength = 1) {
    if (!this.ready) return;
    const s = Math.min(1, Math.max(0.15, strength));
    const dur = 0.3 + 0.3 * s;
    this.noise({ dur, gain: 0.05 * s, freq: 380, q: 0.6, type: 'bandpass', sweepTo: 260, attack: 0.03 });
    this.noise({ dur: dur * 0.7, gain: 0.025 * s, freq: 900, q: 1.2, type: 'bandpass', sweepTo: 650, attack: 0.05, delay: 0.03 });
  }

  /**
   * Sustained form of fabricDrag(): call startDrag(strength) every frame
   * while the claw is dragging (strength 0..1, e.g. drag speed or load),
   * and stopDrag() once when the drag ends — same calling convention as
   * setMotor()/stopMotor(). Built like the motor bed (one persistent
   * source, gain ramped rather than retriggered) but with a slow LFO on
   * the bandpass centre frequency so the texture "breathes" instead of
   * sitting as a static hiss — that irregularity is what reads as fabric
   * catching and slipping rather than a synth pad. Kept well under the
   * one-shot contact cues (max ~0.06) so it layers under the motor
   * without muddying either.
   */
  startDrag(strength = 1) {
    if (!this.ready || !this.enabled) return;
    if (!this._drag) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 340;
      f.Q.value = 0.6;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 5;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 80;
      lfo.connect(lfoGain); lfoGain.connect(f.frequency);
      const g = this._gain(0);
      src.connect(f); f.connect(g);
      src.start(); lfo.start();
      this._drag = { src, f, g, lfo, lfoGain };
    }
    const d = this._drag;
    const s = Math.min(1, Math.max(0.1, strength));
    d.g.gain.setTargetAtTime(0.06 * s, this.t, 0.06);
    d.lfo.frequency.setTargetAtTime(4 + s * 4, this.t, 0.12);
    d.lfoGain.gain.setTargetAtTime(60 + s * 60, this.t, 0.12);
  }

  stopDrag() {
    if (!this._drag) return;
    this._drag.g.gain.setTargetAtTime(0.0001, this.t, 0.08);
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

  /**
   * A neighbouring toy knocked over, flopping onto the pile — soft and
   * dull like softTouch, but two damped low thumps (body landing, then a
   * lighter settle) instead of one light contact, so it reads as a heavier
   * flop. Kept well under goton()'s peak (0.42) and without goton's bright
   * high-passed noise or hard attack, so it never gets confused with the
   * bin drop even though both are "something lands" sounds.
   */
  topple(strength = 1) {
    if (!this.ready) return;
    const s = Math.min(1, Math.max(0.2, strength));
    this.tone(78, { type: 'sine', dur: 0.16, gain: 0.13 * s, slideTo: 50, attack: 0.01 });
    this.noise({ dur: 0.1, gain: 0.05 * s, freq: 260, q: 0.9, type: 'lowpass', sweepTo: 140, attack: 0.015 });
    // lighter settling tap, ~130ms later
    this.tone(65, { type: 'sine', dur: 0.14, gain: 0.09 * s, slideTo: 42, attack: 0.015, delay: 0.13 });
    this.noise({ dur: 0.08, gain: 0.035 * s, freq: 220, q: 0.9, type: 'lowpass', sweepTo: 120, attack: 0.02, delay: 0.13 });
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
