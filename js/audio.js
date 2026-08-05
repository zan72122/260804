// ------------------------------------------------------------------
// audio.js — all sound is synthesized with WebAudio (no asset files)
// ------------------------------------------------------------------
export class SoundKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.humNodes = null;
    this.music = null;       // { timer, stop }
    this._lastSqueak = 0;
    this._clatter = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  _now() { return this.ctx.currentTime; }

  _tone({ freq = 440, dur = 0.2, type = 'sine', gain = 0.2, at = 0, glideTo = null, pan = 0 }) {
    if (!this.ctx) return;
    const t0 = this._now() + at;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, glideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(this.master); }
    else g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _noise({ dur = 0.2, gain = 0.15, at = 0, band = null, q = 1, glideTo = null }) {
    if (!this.ctx) return;
    const t0 = this._now() + at;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = src;
    if (band) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(band, t0);
      if (glideTo) f.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
      f.Q.value = q;
      src.connect(f); node = f;
    }
    node.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // ---- one-shot effects -------------------------------------------
  click()  { this._noise({ dur: 0.05, gain: 0.2, band: 2000, q: 2 }); }
  clunk()  {
    this._tone({ freq: 130, glideTo: 60, dur: 0.16, type: 'square', gain: 0.22 });
    this._noise({ dur: 0.08, gain: 0.22, band: 500, q: 1 });
  }
  pop()    { this._tone({ freq: 300, glideTo: 700, dur: 0.09, type: 'sine', gain: 0.25 }); }
  boing()  {
    this._tone({ freq: 160, glideTo: 420, dur: 0.28, type: 'triangle', gain: 0.3 });
    this._tone({ freq: 320, glideTo: 840, dur: 0.24, type: 'sine', gain: 0.12, at: 0.02 });
  }
  plugIn() {
    this.click();
    this._tone({ freq: 220, glideTo: 440, dur: 0.12, type: 'square', gain: 0.14, at: 0.05 });
  }
  swish(dur = 0.6) { this._noise({ dur, gain: 0.12, band: 900, q: 0.7, glideTo: 300 }); }
  whoosh(dur = 1.2) { this._noise({ dur, gain: 0.10, band: 250, q: 0.6, glideTo: 1200 }); }

  squeak() { // lens polishing, rate limited
    const t = performance.now();
    if (t - this._lastSqueak < 110) return;
    this._lastSqueak = t;
    const f = 900 + Math.random() * 700;
    this._noise({ dur: 0.09, gain: 0.08, band: f, q: 6, glideTo: f * 1.5 });
  }

  sparkle() {
    const base = 1400 + Math.random() * 400;
    [0, 1, 2].forEach(i =>
      this._tone({ freq: base * Math.pow(1.335, i), dur: 0.16, type: 'sine', gain: 0.07, at: i * 0.045 }));
  }

  chime(step = 0) { // per-step success jingle, rises with progress
    const root = 392 * Math.pow(1.0595, step); // G4 upward
    const seq = [1, 1.26, 1.5, 2];
    seq.forEach((r, i) =>
      this._tone({ freq: root * r, dur: 0.35, type: 'triangle', gain: 0.2, at: i * 0.09 }));
    this._noise({ dur: 0.5, gain: 0.05, band: 5000, q: 1, at: 0.1 });
  }

  fanfare() {
    const N = [523, 659, 784, 1047, 784, 1047];
    N.forEach((f, i) => {
      this._tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.22, at: i * 0.13 });
      this._tone({ freq: f / 2, dur: 0.3, type: 'sine', gain: 0.12, at: i * 0.13 });
    });
    this._noise({ dur: 0.8, gain: 0.06, band: 6000, q: 0.8, at: 0.5 });
  }

  speakerTest() {
    this._tone({ freq: 70, glideTo: 55, dur: 0.22, type: 'sine', gain: 0.5 });
    this._tone({ freq: 70, glideTo: 55, dur: 0.22, type: 'sine', gain: 0.5, at: 0.3 });
    this._tone({ freq: 523, dur: 0.25, type: 'triangle', gain: 0.16, at: 0.62 });
    this._tone({ freq: 784, dur: 0.35, type: 'triangle', gain: 0.16, at: 0.78 });
  }

  reelTick() { this._noise({ dur: 0.03, gain: 0.05, band: 3000, q: 3 }); }

  // ---- projector hum (looped) -------------------------------------
  humStart() {
    if (!this.ctx || this.humNodes) return;
    const t0 = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = 48;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 8;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 4;
    lfo.connect(lfoG); lfoG.connect(osc.frequency);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 260;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 1.2);
    osc.connect(filt); filt.connect(g); g.connect(this.master);
    osc.start(); lfo.start();
    const clatter = setInterval(() => this.reelTick(), 178);
    this.humNodes = { osc, lfo, g, clatter };
  }
  humStop() {
    if (!this.humNodes) return;
    const { osc, lfo, g, clatter } = this.humNodes;
    clearInterval(clatter);
    const t0 = this._now();
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    osc.stop(t0 + 0.7); lfo.stop(t0 + 0.7);
    this.humNodes = null;
  }

  // ---- theme music (simple sequencer) ------------------------------
  musicStart(theme) {
    this.musicStop();
    if (!this.ctx) return;
    const themes = {
      ocean: {
        bpm: 92, wave: 'sine', bassWave: 'sine',
        mel: [523, 587, 659, 784, 659, 587, 523, 392, 440, 523, 587, 659, 587, 523, 440, 392],
        bass: [131, 0, 98, 0, 110, 0, 98, 0],
      },
      meadow: {
        bpm: 128, wave: 'triangle', bassWave: 'triangle',
        mel: [392, 440, 494, 587, 494, 440, 392, 330, 392, 494, 587, 659, 587, 494, 440, 392],
        bass: [98, 98, 131, 131, 110, 110, 131, 131],
      },
      space: {
        bpm: 76, wave: 'sine', bassWave: 'sine',
        mel: [440, 523, 659, 880, 659, 523, 494, 587, 740, 880, 740, 587, 523, 659, 523, 440],
        bass: [110, 0, 0, 82, 0, 0, 98, 0],
      },
    };
    const T = themes[theme] || themes.meadow;
    const stepDur = 60 / T.bpm / 2; // 8th notes
    let step = 0;
    const tick = () => {
      const m = T.mel[step % T.mel.length];
      if (m) this._tone({ freq: m, dur: stepDur * 1.6, type: T.wave, gain: 0.11, pan: 0.25 });
      if (step % 2 === 0) {
        const b = T.bass[(step / 2) % T.bass.length];
        if (b) this._tone({ freq: b, dur: stepDur * 2.5, type: T.bassWave, gain: 0.13, pan: -0.2 });
      }
      if (theme === 'space' && step % 8 === 4)
        this._tone({ freq: 1760, dur: 0.6, type: 'sine', gain: 0.03 });
      step++;
    };
    tick();
    const timer = setInterval(tick, stepDur * 1000);
    this.music = { timer };
  }
  musicStop() {
    if (this.music) { clearInterval(this.music.timer); this.music = null; }
  }
}
