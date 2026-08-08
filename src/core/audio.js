// Every sound is synthesised at runtime — no assets, no loading.
// The five signature actions each get a different physical model so a child can
// tell them apart with eyes closed:
//   トントン  wood + iron impact, low and blunt
//   ペロン    dry fibre release, a rising band of noise
//   フワッ    moving air, no attack at all
//   ぺたっ    soft damped contact, almost no tail
//   キラッ    struck metal, long shimmering partials

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noiseBuf = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;   // gently pink
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;
    this._roomTone();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  get t() { return this.ctx.currentTime; }

  _noise(dur, gainVal, filter) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
    src.stop(this.t + dur + 0.15);
    return g;
  }

  _roomTone() {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0.012;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this.roomGain = g;
  }

  /** トントン — the hammer. Iron on a leather-backed bundle of damp paper. */
  tonton(power = 1) {
    if (!this.ctx) return;
    const t = this.t;
    // body thump
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150 * (0.9 + Math.random() * 0.2), t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.75 * power, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.35);
    // wood knock resonance
    const b = this.ctx.createBiquadFilter();
    b.type = 'bandpass';
    b.frequency.value = 430;
    b.Q.value = 5;
    const gn = this._noise(0.2, 0.4, b);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.42 * power, t + 0.004);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    // dry slap on top
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const gh = this._noise(0.09, 0.2, hp);
    gh.gain.setValueAtTime(0.0001, t);
    gh.gain.exponentialRampToValueAtTime(0.16 * power, t + 0.003);
    gh.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  }

  /** ペロン — dry paper separating, a band of noise sweeping upward. */
  peron(speed = 1) {
    if (!this.ctx) return;
    const t = this.t;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(3600 * speed, t + 0.34);
    const g = this._noise(0.5, 0.3, bp);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.30, t + 0.05);
    g.gain.linearRampToValueAtTime(0.20, t + 0.26);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
    // fibre crackle
    for (let i = 0; i < 7; i++) {
      const dt = 0.02 + Math.random() * 0.28;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 2200 + Math.random() * 2600;
      hp.Q.value = 8;
      const gc = this._noise(0.05, 0.1, hp);
      gc.gain.setValueAtTime(0.0001, t + dt);
      gc.gain.exponentialRampToValueAtTime(0.09, t + dt + 0.002);
      gc.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.045);
    }
  }

  /** フワッ — air alone. Swelling, no transient, gone before you notice. */
  fuwa(power = 1) {
    if (!this.ctx) return;
    const t = this.t;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, t);
    lp.frequency.linearRampToValueAtTime(1500 * power, t + 0.30);
    lp.frequency.linearRampToValueAtTime(500, t + 0.85);
    lp.Q.value = 1.4;
    const g = this._noise(1.0, 0.2, lp);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.20 * power, t + 0.22);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.85);
    // a breath of high shimmer riding on top
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4200;
    const gh = this._noise(0.7, 0.1, hp);
    gh.gain.setValueAtTime(0.0001, t);
    gh.gain.linearRampToValueAtTime(0.035 * power, t + 0.18);
    gh.gain.linearRampToValueAtTime(0.0001, t + 0.7);
  }

  /** ぺたっ — soft contact, immediately damped by the adhesive underneath. */
  peta() {
    if (!this.ctx) return;
    const t = this.t;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = this._noise(0.12, 0.2, lp);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.09);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.24, t + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 0.16);
  }

  /** キラッ — struck metal with long partials. */
  kira(pitch = 0) {
    if (!this.ctx) return;
    const t = this.t;
    const base = 1046.5 * Math.pow(2, pitch / 12);
    const ratios = [1, 2.01, 3.02, 4.7];
    const amps = [0.16, 0.10, 0.06, 0.035];
    ratios.forEach((r, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * r;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amps[i], t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 + i * 0.15);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 1.6);
    });
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const gh = this._noise(0.3, 0.1, hp);
    gh.gain.setValueAtTime(0.0001, t);
    gh.gain.exponentialRampToValueAtTime(0.07, t + 0.004);
    gh.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  }

  /** A short plucked phrase on the yo scale for the finished piece. */
  joy() {
    if (!this.ctx) return;
    const notes = [587.33, 659.25, 783.99, 880.0, 1174.66];
    notes.forEach((f, i) => {
      const t = this.t + i * 0.13;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const o2 = this.ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(0.05, t + 0.006);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(this.master);
      o2.connect(g2); g2.connect(this.master);
      o.start(t); o.stop(t + 1.0);
      o2.start(t); o2.stop(t + 0.6);
    });
  }

  /** Continuous brush noise while a stroke is in progress. */
  brushStart() {
    if (!this.ctx || this.brushGain) return;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.8;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start();
    this.brushGain = g;
    this.brushSrc = src;
    this.brushFilter = bp;
  }

  brushLevel(v) {
    if (!this.brushGain) return;
    const t = this.t;
    this.brushGain.gain.cancelScheduledValues(t);
    this.brushGain.gain.setTargetAtTime(Math.max(0.0001, v * 0.10), t, 0.05);
    this.brushFilter.frequency.setTargetAtTime(1800 + v * 2600, t, 0.08);
  }

  brushStop() {
    if (!this.brushGain) return;
    const g = this.brushGain, s = this.brushSrc;
    g.gain.setTargetAtTime(0.0001, this.t, 0.08);
    s.stop(this.t + 0.5);
    this.brushGain = null;
    this.brushSrc = null;
  }
}
