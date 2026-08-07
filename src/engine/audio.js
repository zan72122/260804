// Tiny synthesised sound set — no audio files, everything is oscillators and
// filtered noise. Muted until the player's first gesture, per browser policy.

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
  }

  _ensure() {
    if (this.ctx) return this.ctx.state === 'running';
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
      // A little room: everything sounds like it happens on a street.
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this._impulse(1.1, 2.4);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.18;
      this.reverb.connect(wet);
      wet.connect(this.master);
      this.wet = wet;
    } catch { return false; }
    return true;
  }

  _impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  resume() {
    if (this._ensure() === false && this.ctx) this.ctx.resume?.();
    else this.ctx?.resume?.();
  }

  _tone({ freq = 440, type = 'sine', dur = 0.16, gain = 0.3, glide = 0, delay = 0, reverb = 0.5 }) {
    if (!this.enabled || !this._ensure()) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * glide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    if (this.wet && reverb > 0) {
      const sendGain = this.ctx.createGain();
      sendGain.gain.value = reverb;
      g.connect(sendGain);
      sendGain.connect(this.reverb);
    }
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _noise({ dur = 0.12, gain = 0.25, freq = 900, q = 1.2, delay = 0, type = 'lowpass' }) {
    if (!this.enabled || !this._ensure()) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    if (this.wet) { const s = this.ctx.createGain(); s.gain.value = 0.3; g.connect(s); s.connect(this.reverb); }
    src.start(t);
  }

  pickup() { this._tone({ freq: 520, type: 'triangle', dur: 0.07, gain: 0.12, glide: 1.25, reverb: 0.2 }); }

  drop(mass = 1) {
    this._noise({ dur: 0.1, gain: 0.16, freq: 420 - mass * 30, q: 0.7 });
    this._tone({ freq: 150 - mass * 8, type: 'sine', dur: 0.12, gain: 0.16, glide: 0.6, reverb: 0.25 });
  }

  merge(tier = 2) {
    const base = 330 * Math.pow(1.09, tier);
    [0, 4, 7, 12].forEach((semi, i) => {
      this._tone({
        freq: base * Math.pow(2, semi / 12), type: 'triangle',
        dur: 0.28, gain: 0.11, delay: i * 0.045, reverb: 0.6,
      });
    });
    this._noise({ dur: 0.18, gain: 0.07, freq: 3200, type: 'highpass' });
  }

  coin(n = 4) {
    for (let i = 0; i < Math.min(n, 5); i++) {
      this._tone({ freq: 1180 + i * 190, type: 'square', dur: 0.1, gain: 0.05, delay: i * 0.05, reverb: 0.4 });
    }
  }

  /** Something burst: a wet, low, unmusical thump. */
  splat() {
    this._noise({ dur: 0.16, gain: 0.26, freq: 320, q: 0.6 });
    this._noise({ dur: 0.1, gain: 0.14, freq: 1400, q: 0.9, delay: 0.01 });
    this._tone({ freq: 96, type: 'sine', dur: 0.18, gain: 0.2, glide: 0.55, reverb: 0.3 });
  }

  produce() {
    this._noise({ dur: 0.09, gain: 0.2, freq: 1100, q: 1.6 });
    this._tone({ freq: 220, type: 'sine', dur: 0.1, gain: 0.14, glide: 0.7, reverb: 0.2 });
  }

  levelup() {
    [0, 4, 7, 12, 16].forEach((semi, i) => {
      this._tone({ freq: 392 * Math.pow(2, semi / 12), type: 'triangle', dur: 0.5, gain: 0.1, delay: i * 0.09, reverb: 0.8 });
    });
  }

  deny() {
    this._tone({ freq: 190, type: 'sawtooth', dur: 0.16, gain: 0.1, glide: 0.7, reverb: 0.2 });
  }

  travel() {
    [0, 5, 9, 14, 21].forEach((semi, i) => {
      this._tone({ freq: 294 * Math.pow(2, semi / 12), type: 'sine', dur: 0.8, gain: 0.09, delay: i * 0.13, reverb: 0.9 });
    });
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.32 : 0;
  }
}
