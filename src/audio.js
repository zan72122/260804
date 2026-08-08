// ---------------------------------------------------------------------------
// All sound is synthesised with the Web Audio API — no files, no network.
// The rope zip and the squeegee are continuous voices whose filter and gain
// follow the player's finger, so the sound is the feedback.
// ---------------------------------------------------------------------------

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.knee.value = 12;
    this.master.connect(comp).connect(ctx.destination);

    this.sfx = ctx.createGain(); this.sfx.gain.value = 1.0; this.sfx.connect(this.master);
    this.mus = ctx.createGain(); this.mus.gain.value = 0.30; this.mus.connect(this.master);

    // Shared noise buffer.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;      // a touch of brown for body
      d[i] = w * 0.7 + last * 3.0;
    }
    this.noiseBuf = buf;

    this._buildAmbient();
    this._buildRopeVoice();
    this._buildSqueegeeVoice();
    this.ready = true;
    if (ctx.state === 'suspended') ctx.resume();
  }

  _noise(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  }

  _buildAmbient() {
    const ctx = this.ctx;
    const src = this._noise();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const g = ctx.createGain(); g.gain.value = 0.10;
    src.connect(hp).connect(lp).connect(g).connect(this.master);
    src.start();
    this.windGain = g; this.windLp = lp;

    // Slow gusts.
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 190;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.041;
    const lfoG2 = ctx.createGain(); lfoG2.gain.value = 0.05;
    lfo2.connect(lfoG2).connect(g.gain);
    lfo2.start();
  }

  _buildRopeVoice() {
    const ctx = this.ctx;
    const src = this._noise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.6;
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'peaking'; bp2.frequency.value = 2400; bp2.gain.value = 7; bp2.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp).connect(bp2).connect(g).connect(this.sfx);
    src.start();
    this.ropeGain = g; this.ropeBp = bp;
  }

  _buildSqueegeeVoice() {
    const ctx = this.ctx;
    const src = this._noise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 3.5;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp).connect(g).connect(this.sfx);
    src.start();
    this.sqGain = g; this.sqBp = bp;
    // A soft resonant squeak riding on top.
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 1250;
    const og = ctx.createGain(); og.gain.value = 0;
    osc.connect(og).connect(this.sfx); osc.start();
    this.sqOsc = osc; this.sqOscGain = og;
  }

  /** Continuous rope-descent sound; v is metres per second. */
  rope(v) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const a = Math.min(1, v / 1.6);
    this.ropeGain.gain.setTargetAtTime(a * 0.16, t, 0.05);
    this.ropeBp.frequency.setTargetAtTime(700 + a * 1500, t, 0.06);
  }

  /** Continuous squeegee sound; v is drag speed in screen units per second. */
  squeegee(v, wet) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const a = Math.min(1, v * 0.9);
    this.sqGain.gain.setTargetAtTime(a * (wet ? 0.10 : 0.05), t, 0.04);
    this.sqBp.frequency.setTargetAtTime(900 + a * 2200 + (wet ? 0 : 500), t, 0.05);
    this.sqOsc.frequency.setTargetAtTime(700 + a * 900, t, 0.08);
    this.sqOscGain.gain.setTargetAtTime(wet ? a * 0.028 : 0, t, 0.06);
  }

  /** Metallic click — buckles, connectors, the descender catching. */
  click(pitch = 1, vol = 1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this._noise(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600 * pitch; bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.075);
    n.connect(bp).connect(g).connect(this.sfx);
    n.start(t); n.stop(t + 0.09);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(1500 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(680 * pitch, t + 0.06);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.20 * vol, t);
    og.gain.exponentialRampToValueAtTime(0.0008, t + 0.11);
    o.connect(og).connect(this.sfx);
    o.start(t); o.stop(t + 0.13);
  }

  /** The "pita!" of the descender locking off. */
  lock() {
    this.click(0.8, 1.0);
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.24);
  }

  spray() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = this._noise(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(5200, t);
    bp.frequency.exponentialRampToValueAtTime(1700, t + 0.24);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.17, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.30);
    n.connect(bp).connect(g).connect(this.sfx);
    n.start(t); n.stop(t + 0.34);
  }

  /** Bright bell used for sparkles and progress. */
  chime(step = 0, vol = 0.5, dur = 1.1) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const f = 523.25 * Math.pow(2, (PENTA[Math.min(PENTA.length - 1, step)] || 0) / 12);
    for (const [mul, amp, d] of [[1, 1, 1], [2.01, 0.34, 0.6], [3.02, 0.16, 0.4], [5.4, 0.07, 0.28]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * amp * 0.5, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * d);
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + dur * d + 0.05);
    }
  }

  /** Rising sparkle run — a window coming clean. */
  sparkleRun(n = 6, base = 3) {
    if (!this.ready) return;
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.chime(base + i, 0.32, 0.8), i * 55);
    }
  }

  fanfare() {
    if (!this.ready) return;
    const seq = [0, 2, 4, 5, 7, 9, 7, 10];
    seq.forEach((s, i) => setTimeout(() => this.chime(s, 0.5, 1.5), i * 130));
    const ctx = this.ctx, t = ctx.currentTime;
    [261.63, 329.63, 392.0, 523.25].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      o.connect(g).connect(this.mus);
      o.start(t); o.stop(t + 4.6);
    });
  }

  /** Soft bubbly pop for water droplets. */
  pop() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(400 + Math.random() * 500, t);
    o.frequency.exponentialRampToValueAtTime(1200 + Math.random() * 900, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.11);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.13);
  }

  /** A calm pad plus an occasional pentatonic bell, started once. */
  startMusic() {
    if (!this.ready || this._music) return;
    this._music = true;
    const ctx = this.ctx;
    const chord = [130.81, 196.0, 246.94, 329.63];
    for (const f of chord) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const det = ctx.createOscillator(); det.type = 'sine'; det.frequency.value = f * 1.004;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      const g = ctx.createGain(); g.gain.value = 0.035;
      o.connect(lp); det.connect(lp); lp.connect(g).connect(this.mus);
      o.start(); det.start();
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.05;
      const lg = ctx.createGain(); lg.gain.value = 0.018;
      lfo.connect(lg).connect(g.gain); lfo.start();
    }
    const tick = () => {
      if (!this._music) return;
      if (!this.muted && Math.random() < 0.75) {
        this.chime(Math.floor(Math.random() * 7) + 2, 0.10, 2.4);
      }
      setTimeout(tick, 1800 + Math.random() * 2600);
    };
    setTimeout(tick, 2000);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }
}
