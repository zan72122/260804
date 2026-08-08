// Everything is synthesised — no asset loading, so the game starts instantly
// and the sounds can follow the child's hand continuously.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.pour = null;
    this.shimmer = null;
    this.noiseBuf = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.ambient();
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.value = v ? 0.85 : 0;
  }

  noise(dur, gainVal, filterType, freq, q = 1) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.value = gainVal;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    src.stop(this.t + dur + 0.05);
    return { src, f, g };
  }

  tone(freq, dur, type = 'sine', gainVal = 0.2, detune = 0) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, this.t);
    g.gain.exponentialRampToValueAtTime(gainVal, this.t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.t + dur + 0.05);
    return { o, g };
  }

  // A soft metallophone-like note; a nod to the gamelan without pretending to
  // be one. Pentatonic degrees keep it gentle for small ears.
  chime(degree = 0, gainVal = 0.16) {
    if (!this.ctx || !this.enabled) return;
    const scale = [0, 2, 5, 7, 9, 12, 14];
    const semi = scale[((degree % scale.length) + scale.length) % scale.length];
    const f = 392 * Math.pow(2, semi / 12);
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, this.t);
    g.gain.exponentialRampToValueAtTime(gainVal, this.t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 1.6);
    g.connect(this.master);
    for (const [mul, amp] of [[1, 1], [2.76, 0.28], [5.4, 0.12]]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mul;
      const og = c.createGain();
      og.gain.value = amp;
      o.connect(og); og.connect(g);
      o.start(); o.stop(this.t + 1.8);
    }
  }

  pop(pitch = 1) {
    if (!this.ctx || !this.enabled) return;
    this.tone(420 * pitch, 0.14, 'triangle', 0.16);
  }

  // ---- signature sounds ----------------------------------------------------

  // "とろーっ" — molten wax running out of the spout.
  startPour() {
    if (!this.ctx || !this.enabled || this.pour) return;
    const c = this.ctx;
    const n = this.noise(9999, 0.0, 'bandpass', 780, 1.4);
    const o = c.createOscillator();
    o.type = 'sine'; o.frequency.value = 132;
    const og = c.createGain(); og.gain.value = 0.0;
    o.connect(og); og.connect(this.master); o.start();
    this.pour = { n, o, og, lvl: 0 };
  }

  updatePour(intensity, speed) {
    if (!this.pour) return;
    const p = this.pour;
    const target = Math.min(1, intensity);
    p.lvl += (target - p.lvl) * 0.2;
    p.n.g.gain.value = 0.05 * p.lvl;
    p.n.f.frequency.value = 620 + speed * 900;
    p.og.gain.value = 0.045 * p.lvl;
    p.o.frequency.value = 118 + speed * 60;
  }

  stopPour() {
    if (!this.pour) return;
    const p = this.pour;
    try {
      p.n.g.gain.setTargetAtTime(0, this.t, 0.05);
      p.og.gain.setTargetAtTime(0, this.t, 0.05);
      p.n.src.stop(this.t + 0.4);
      p.o.stop(this.t + 0.4);
    } catch (e) { /* already stopped */ }
    this.pour = null;
  }

  // A single fat droplet of wax landing.
  drop() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(760, this.t);
    o.frequency.exponentialRampToValueAtTime(230, this.t + 0.09);
    const g = c.createGain();
    g.gain.setValueAtTime(0.10, this.t);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.13);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.t + 0.16);
  }

  // "チャプン" — the cloth touching the surface of the dye.
  chapun(strength = 1) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(540 * (0.8 + Math.random() * 0.3), this.t);
    o.frequency.exponentialRampToValueAtTime(120, this.t + 0.16);
    const g = c.createGain();
    g.gain.setValueAtTime(0.22 * strength, this.t);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.3);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.t + 0.32);
    const n = this.noise(0.32, 0.0, 'bandpass', 1600, 0.9);
    n.g.gain.setValueAtTime(0.16 * strength, this.t);
    n.g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.30);
  }

  // The steady body of liquid while the cloth is under.
  soak(level) {
    if (!this.ctx || !this.enabled) return;
    if (!this._soak) {
      this._soak = this.noise(9999, 0.0, 'lowpass', 420, 0.7);
    }
    this._soak.g.gain.value = 0.05 * level;
  }

  stopSoak() {
    if (this._soak) {
      try { this._soak.src.stop(this.t + 0.2); } catch (e) { /* noop */ }
      this._soak = null;
    }
  }

  // Dripping after the lift.
  drip() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    const f0 = 900 + Math.random() * 500;
    o.frequency.setValueAtTime(f0, this.t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.35, this.t + 0.07);
    const g = c.createGain();
    g.gain.setValueAtTime(0.07, this.t);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.12);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.t + 0.14);
  }

  // "するする" — the wax letting go of the cloth.
  startShimmer() {
    if (!this.ctx || !this.enabled || this.shimmer) return;
    const c = this.ctx;
    const n = this.noise(9999, 0.0, 'highpass', 2400, 0.6);
    const oscs = [];
    for (const f of [523.25, 659.25, 783.99]) {
      const o = c.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = 0;
      o.connect(g); g.connect(this.master); o.start();
      oscs.push({ o, g });
    }
    this.shimmer = { n, oscs, lvl: 0 };
  }

  updateShimmer(level, progress) {
    if (!this.shimmer) return;
    const s = this.shimmer;
    s.lvl += (level - s.lvl) * 0.15;
    s.n.g.gain.value = 0.035 * s.lvl;
    s.oscs.forEach((x, i) => {
      x.g.gain.value = 0.022 * s.lvl * (1 - i * 0.22);
      x.o.frequency.value = [523.25, 659.25, 783.99][i] * (1 + progress * 0.18);
    });
  }

  stopShimmer() {
    if (!this.shimmer) return;
    const s = this.shimmer;
    try {
      s.n.src.stop(this.t + 0.3);
      s.oscs.forEach((x) => { x.g.gain.setTargetAtTime(0, this.t, 0.08); x.o.stop(this.t + 0.5); });
    } catch (e) { /* noop */ }
    this.shimmer = null;
  }

  // "バサッ" — the finished cloth thrown open.
  basa() {
    if (!this.ctx || !this.enabled) return;
    const n = this.noise(0.9, 0.0, 'bandpass', 900, 0.5);
    n.g.gain.setValueAtTime(0.0001, this.t);
    n.g.gain.exponentialRampToValueAtTime(0.26, this.t + 0.05);
    n.g.gain.exponentialRampToValueAtTime(0.0001, this.t + 0.75);
    n.f.frequency.setValueAtTime(1800, this.t);
    n.f.frequency.exponentialRampToValueAtTime(340, this.t + 0.7);
    setTimeout(() => { this.chime(4, 0.13); }, 120);
    setTimeout(() => { this.chime(6, 0.11); }, 300);
  }

  fanfare() {
    if (!this.ctx || !this.enabled) return;
    [0, 2, 4, 5].forEach((d, i) => setTimeout(() => this.chime(d, 0.15), i * 130));
  }

  ambient() {
    if (!this.ctx) return;
    const c = this.ctx;
    const n = this.noise(1e6, 0.008, 'lowpass', 260, 0.4);
    this._amb = n;
    // A very quiet, slow swell so the room never feels dead.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06;
    const lg = c.createGain(); lg.gain.value = 0.004;
    lfo.connect(lg); lg.connect(n.g.gain);
    lfo.start();
  }
}
