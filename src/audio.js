/**
 * Everything you hear is synthesised at runtime with the Web Audio API — no
 * sample files, so the game works offline and stays tiny. Muting it (or having
 * no audio context at all) never affects gameplay.
 */

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ready = false;
    this._motorGain = null;
    this._scrapeGain = null;
    this._lastTick = 0;
  }

  /** Must be called from a user gesture on iOS. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const g = this.ctx.createGain();
    g.gain.value = 0.9;
    g.connect(this.ctx.destination);
    this.master = g;

    this._noiseBuf = this._makeNoise(1.5);
    this._buildMotor();
    this._buildScrape();
    this.ready = true;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
  }

  _makeNoise(seconds) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _noiseSource(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noiseBuf;
    s.loop = loop;
    return s;
  }

  // ------------------------------------------------------------- continuous

  _buildMotor() {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 78;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 39;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    lp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(lp);
    osc2.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    osc.start();
    osc2.start();
    this._motorGain = g;
    this._motorOsc = osc;
  }

  _buildScrape() {
    const ctx = this.ctx;
    const src = this._noiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start();
    this._scrapeGain = g;
    this._scrapeFilter = bp;
  }

  /** `level` 0..1 — crane motor hum while the gantry moves. */
  motor(level, pitch = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._motorGain.gain.setTargetAtTime(0.055 * level, t, 0.08);
    this._motorOsc.frequency.setTargetAtTime(78 * pitch, t, 0.15);
  }

  /** `level` 0..1 — cardboard sliding over steel. */
  scrape(level, speed = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._scrapeGain.gain.setTargetAtTime(0.10 * level, t, 0.05);
    this._scrapeFilter.frequency.setTargetAtTime(1400 + 1800 * speed, t, 0.08);
  }

  // ------------------------------------------------------------------ hits

  _env(node, gain, attack, decay, when = 0) {
    const t = this.ctx.currentTime + when;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g);
    g.connect(this.master);
    return { g, t };
  }

  _tone(freq, gain, decay, type = 'sine', when = 0, bend = 1) {
    if (!this.ready) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    const { t } = this._env(osc, gain, 0.004, decay, when);
    osc.frequency.setValueAtTime(freq, t);
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(freq * bend, t + decay);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  _click(gain, freq, q, decay, when = 0) {
    if (!this.ready) return;
    const src = this._noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    src.connect(bp);
    const { t } = this._env(bp, gain, 0.003, decay, when);
    src.start(t);
    src.stop(t + decay + 0.05);
  }

  /** Small mechanical clack of the claw servo. */
  servo(closing) {
    if (!this.ready) return;
    this._click(0.10, closing ? 1800 : 2400, 4, 0.06);
    this._tone(closing ? 320 : 420, 0.035, 0.10, 'square', 0.01, closing ? 0.7 : 1.3);
  }

  /** Metal prong touching the carton. */
  tap(strength = 1) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now - this._lastTick < 0.045) return;
    this._lastTick = now;
    const s = Math.min(1, strength);
    this._click(0.09 * s, 2600, 2.5, 0.05);
    this._tone(880 + Math.random() * 260, 0.045 * s, 0.09, 'triangle');
  }

  /** The box settling back down onto the bars — コトッ. */
  settle(strength = 1) {
    if (!this.ready) return;
    const s = Math.min(1, strength);
    this._click(0.14 * s, 420, 1.1, 0.11);
    this._tone(178, 0.11 * s, 0.16, 'sine', 0, 0.55);
  }

  /** The big one: the prize hits the tray — ゴトン. */
  drop() {
    if (!this.ready) return;
    this._tone(96, 0.32, 0.34, 'sine', 0, 0.45);
    this._click(0.22, 240, 0.8, 0.20);
    this._tone(132, 0.14, 0.22, 'triangle', 0.06, 0.6);
    this._click(0.10, 900, 1.2, 0.12, 0.09);
  }

  /** Short, warm success flourish. */
  fanfare() {
    if (!this.ready) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this._tone(f, 0.10, 0.34, 'triangle', 0.06 * i);
      this._tone(f * 2, 0.035, 0.22, 'sine', 0.06 * i);
    });
  }

  /** Gentle "your turn" chime. */
  ready_() {
    if (!this.ready) return;
    this._tone(659.25, 0.05, 0.18, 'triangle');
    this._tone(987.77, 0.035, 0.22, 'sine', 0.08);
  }
}
