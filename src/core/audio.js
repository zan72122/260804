// Fully synthesized workshop audio.  No sample files: the bell's voice has to
// change with its shape, its metal and its decoration, so every sound is built
// from oscillators and noise at runtime.
//
// iOS notes:
//  * the context can only be created/resumed inside a user gesture
//  * Web Audio alone rides the ringer channel, so the hardware silent switch
//    kills it -- a silent looping <audio> element moves the page onto the
//    media channel, and audioSession.type does the same on Safari 16.4+

import { clamp, clamp01, lerp } from './util.js';

/* ---------- a 0.4s silent wav, used only to claim the media channel ---------- */
function silentWavURI() {
  const sr = 8000, n = sr * 0.4, bytes = 44 + n * 2;
  const b = new ArrayBuffer(bytes), v = new DataView(b);
  const s = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  s(0, 'RIFF'); v.setUint32(4, bytes - 8, true); s(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
  let bin = '';
  const u8 = new Uint8Array(b);
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

/* =========================== bell voices =========================== */
// Amplitudes/decays are hand-tuned so each silhouette reads as a different
// instrument: a western tulip bell, a deep Japanese temple bell, a squat bell.
export const BELL_VOICES = {
  // ratio, amplitude, decay seconds
  tulip: {
    f0: 174.6,                        // F3 strike note
    beat: 0.9,
    partials: [
      [0.500, 1.00, 13.0],            // hum
      [1.000, 0.80, 9.0],             // prime
      [1.190, 0.52, 7.0],             // tierce (minor third -- the bell's colour)
      [1.500, 0.30, 5.5],             // quint
      [2.000, 0.62, 5.0],             // nominal
      [2.510, 0.22, 3.2],             // deciem
      [3.010, 0.16, 2.4],
      [4.020, 0.11, 1.6],
      [5.430, 0.06, 1.0],
    ],
    strikeNoise: 0.55, strikeTone: 2400,
  },
  temple: {
    f0: 110.0,                        // A2 -- 梵鐘 sits low and hums forever
    beat: 1.9,                        // the characteristic slow 唸り
    partials: [
      [0.500, 1.15, 20.0],
      [1.000, 0.70, 14.0],
      [1.180, 0.26, 9.0],
      [1.660, 0.20, 7.0],
      [2.000, 0.40, 8.0],
      [2.720, 0.14, 4.0],
      [3.400, 0.09, 2.6],
      [4.610, 0.05, 1.6],
    ],
    strikeNoise: 0.75, strikeTone: 1300,
  },
  squat: {
    f0: 261.6,                        // C4 -- small, bright, quick
    beat: 0.5,
    partials: [
      [0.500, 0.85, 8.0],
      [1.000, 0.85, 6.0],
      [1.230, 0.60, 5.0],
      [1.520, 0.34, 3.6],
      [2.000, 0.70, 3.8],
      [2.560, 0.30, 2.2],
      [3.180, 0.20, 1.6],
      [4.300, 0.14, 1.1],
      [5.900, 0.08, 0.7],
    ],
    strikeNoise: 0.45, strikeTone: 3400,
  },
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.enabled = true;
    this.master = null;
    this._loops = new Map();
    this._voices = 0;
    this._silent = null;
    this._noiseBuf = null;
  }

  /* must be called from inside a real user gesture */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { return; }

    if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (_) {} }

    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24;
    comp.ratio.value = 4; comp.attack.value = 0.006; comp.release.value = 0.26;
    this.master.connect(comp); comp.connect(c.destination);

    // pre-render 2s of pink-ish noise, reused by every noise voice
    const len = Math.floor(c.sampleRate * 2);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
    this._noiseBuf = buf;

    // silent media element -> escape the ringer switch on iOS
    try {
      const a = new Audio(silentWavURI());
      a.loop = true; a.volume = 0.0001;
      a.setAttribute('playsinline', ''); a.setAttribute('webkit-playsinline', '');
      a.play().catch(() => {});
      this._silent = a;
    } catch (_) {}

    // Safari suspends the context when the tab is hidden and does not always
    // resume it; nudge it back on every return.
    const wake = () => { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    window.addEventListener('focus', wake);

    c.resume().catch(() => {});
    this.ready = true;
  }

  setEnabled(on) {
    this.enabled = on;
    // the toggle can be pressed before (or without) a working audio context
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    if (this._silent) { if (on) this._silent.play().catch(() => {}); else this._silent.pause(); }
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  _noise() {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noiseBuf; s.loop = true;
    return s;
  }

  /* ------------------------------------------------------------------ *
   *  looping beds -- stages open and close these with a target volume    *
   * ------------------------------------------------------------------ */

  /** Get (creating on demand) a named looping voice. */
  _loop(name, build) {
    if (!this.ready) return null;
    let l = this._loops.get(name);
    if (!l) { l = build(); this._loops.set(name, l); }
    return l;
  }

  /** Set the level of a looping bed. level 0 fades it out (nodes stay alive). */
  setLoop(name, level, rampMs = 220) {
    const l = this._loops.get(name);
    if (!l) return;
    l.gain.gain.setTargetAtTime(clamp01(level) * l.scale, this.t, rampMs / 3000);
    if (l.setLevel) l.setLevel(clamp01(level));
  }

  /** low steady room tone -- kiln breath, distant yard */
  ambient(level = 1) {
    this._loop('amb', () => {
      const c = this.ctx, g = c.createGain(); g.gain.value = 0;
      const src = this._noise();
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 0.4;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40;
      src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(this.master);
      src.start();
      return { gain: g, scale: 0.10 };
    });
    this.setLoop('amb', level, 900);
  }

  /** the furnace: broadband roar + a low resonant throb */
  furnace(level = 1) {
    this._loop('furnace', () => {
      const c = this.ctx, g = c.createGain(); g.gain.value = 0;
      const src = this._noise();
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 190; bp.Q.value = 0.7;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      src.connect(bp); bp.connect(lp); lp.connect(g);
      // slow breathing of the flame
      const lfo = c.createOscillator(); lfo.frequency.value = 0.23;
      const lfoG = c.createGain(); lfoG.gain.value = 90;
      lfo.connect(lfoG); lfoG.connect(bp.frequency); lfo.start();
      // sub rumble
      const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = 44;
      const subG = c.createGain(); subG.gain.value = 0.22;
      sub.connect(subG); subG.connect(g); sub.start();
      g.connect(this.master); src.start();
      return { gain: g, scale: 0.5 };
    });
    this.setLoop('furnace', level, 700);
  }

  /** clay being swept smooth by the strickle board */
  scrape(level = 0, speed = 0) {
    this._loop('scrape', () => {
      const c = this.ctx, g = c.createGain(); g.gain.value = 0;
      const src = this._noise();
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.1;
      src.connect(bp); bp.connect(g); g.connect(this.master); src.start();
      return { gain: g, scale: 0.30, bp };
    });
    const l = this._loops.get('scrape');
    if (l) l.bp.frequency.setTargetAtTime(430 + clamp01(speed) * 1100, this.t, 0.08);
    this.setLoop('scrape', level, 120);
  }

  /** the brush laying outer-mould mud */
  brush(level = 0) {
    this._loop('brush', () => {
      const c = this.ctx, g = c.createGain(); g.gain.value = 0;
      const src = this._noise();
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.master); src.start();
      return { gain: g, scale: 0.22 };
    });
    this.setLoop('brush', level, 100);
  }

  /** molten bronze falling into the sprue */
  pour(level = 0, rate = 0) {
    this._loop('pour', () => {
      const c = this.ctx, g = c.createGain(); g.gain.value = 0;
      const src = this._noise();
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 0.6;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      src.connect(bp); bp.connect(lp); lp.connect(g);
      const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = 58;
      const subG = c.createGain(); subG.gain.value = 0.3;
      sub.connect(subG); subG.connect(g); sub.start();
      g.connect(this.master); src.start();
      return { gain: g, scale: 0.55, bp, lp };
    });
    const l = this._loops.get('pour');
    if (l) {
      l.bp.frequency.setTargetAtTime(200 + rate * 420, this.t, 0.1);
      l.lp.frequency.setTargetAtTime(1200 + rate * 3200, this.t, 0.1);
    }
    this.setLoop('pour', level, 160);
  }

  /* ------------------------------------------------------------------ *
   *  one shots                                                          *
   * ------------------------------------------------------------------ */

  _burst({ freq = 400, q = 1, dur = 0.3, gain = 0.4, type = 'bandpass', sweep = 0 }) {
    if (!this.ready || this._voices > 26) return;
    const c = this.ctx, t = c.currentTime;
    const src = this._noise();
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
    this._voices++;
    src.onended = () => { this._voices--; try { src.disconnect(); f.disconnect(); g.disconnect(); } catch (_) {} };
  }

  _tone({ freq = 300, dur = 0.3, gain = 0.2, type = 'sine', to = 0 }) {
    if (!this.ready || this._voices > 26) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
    this._voices++;
    o.onended = () => { this._voices--; try { o.disconnect(); g.disconnect(); } catch (_) {} };
  }

  /** soft wet slap -- clay landing, decoration pressed home */
  clayPat(p = 1) { this._burst({ freq: 220 * p, q: 0.8, dur: 0.16, gain: 0.34, sweep: 0.35 }); this._tone({ freq: 110 * p, to: 60, dur: 0.12, gain: 0.12 }); }

  /** small friendly confirmation */
  blip(p = 1) { this._tone({ freq: 660 * p, to: 990 * p, dur: 0.16, gain: 0.13, type: 'triangle' }); }

  /** heavy metal / wooden mechanism */
  clank(p = 1) {
    this._burst({ freq: 2200 * p, q: 2.4, dur: 0.22, gain: 0.22, sweep: 0.3 });
    this._tone({ freq: 420 * p, to: 190 * p, dur: 0.3, gain: 0.14, type: 'square' });
  }

  /** the safety door rolling shut */
  doorSlide() {
    this._burst({ freq: 500, q: 0.8, dur: 0.55, gain: 0.24, sweep: 0.4 });
    setTimeout(() => this.clank(0.7), 520);
  }

  /** lever / crank tick */
  ratchet() { this._burst({ freq: 3000, q: 6, dur: 0.06, gain: 0.16 }); }

  /** the first crack in the mould -- BAKI! */
  crackSnap(power = 1) {
    this._burst({ freq: 1800, q: 1.1, dur: 0.09 + 0.05 * power, gain: 0.5 * power, sweep: 0.12 });
    this._tone({ freq: 160, to: 55, dur: 0.32, gain: 0.3 * power, type: 'triangle' });
    this._burst({ freq: 380, q: 0.5, dur: 0.5, gain: 0.2 * power, sweep: 0.3 });
  }

  /** loose earth pattering down -- パラパラ */
  rubble(amount = 1) {
    const n = Math.round(3 + amount * 5);
    for (let i = 0; i < n; i++) {
      setTimeout(() => this._burst({
        freq: 900 + Math.random() * 2400, q: 3 + Math.random() * 4,
        dur: 0.05 + Math.random() * 0.09, gain: 0.10 + Math.random() * 0.12, sweep: 0.4,
      }), Math.random() * 420);
    }
  }

  /**
   * One piece of fired earth hitting the ground.  Fired per landing rather
   * than as a canned rattle at the moment of the blow, so what you hear is
   * what you just watched land -- big slabs low and slow, chips bright and
   * short.
   * @param {number} force 0..1 from the impact speed
   * @param {number} size  the piece's radius in metres
   */
  earthThud(force = 0.5, size = 0.3) {
    const f = clamp(force, 0.05, 1);
    const big = clamp01((size - 0.15) / 0.45);          // 0 chip .. 1 slab
    this._burst({
      freq: lerp(900, 260, big), q: 0.7,
      dur: 0.09 + big * 0.16, gain: (0.10 + f * 0.26) * (0.6 + big * 0.6), sweep: 0.25,
    });
    this._tone({
      freq: lerp(150, 62, big), to: lerp(90, 38, big),
      dur: 0.10 + big * 0.22, gain: (0.05 + f * 0.16) * (0.4 + big * 0.9), type: 'sine',
    });
    // loose grit thrown off by the impact
    if (f > 0.35) this._burst({ freq: 2400, q: 2.5, dur: 0.07, gain: 0.05 * f, sweep: 0.5 });
  }

  /** the dust cloud blooming out */
  dustPuff() { this._burst({ freq: 900, q: 0.4, dur: 0.9, gain: 0.3, sweep: 0.12 }); }

  /** chain running over the crane sheave */
  chain(level = 0) {
    this._loop('chain', () => {
      const c = this.ctx, g = c.createGain(); g.gain.value = 0;
      const src = this._noise(); src.playbackRate.value = 1.6;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 3.5;
      src.connect(bp); bp.connect(g); g.connect(this.master); src.start();
      return { gain: g, scale: 0.26 };
    });
    this.setLoop('chain', level, 90);
  }

  /** air displaced by the swinging bell */
  whoosh(power = 1) { this._burst({ freq: 500, q: 0.5, dur: 0.6, gain: 0.16 * power, sweep: 0.25 }); }

  /** bright sparkle for reveals */
  sparkle() {
    [1, 1.5, 2.25].forEach((m, i) =>
      setTimeout(() => this._tone({ freq: 900 * m, dur: 0.5, gain: 0.075, type: 'sine' }), i * 70));
  }

  /* ------------------------------------------------------------------ *
   *  THE BELL                                                           *
   * ------------------------------------------------------------------ */
  /**
   * @param {object} o
   * @param {string} o.voice   key into BELL_VOICES (bell silhouette)
   * @param {number} o.bright  0..1 from the metal alloy
   * @param {number} o.decor   0..1 from how much relief is on the bell
   * @param {number} o.power   0..1 strike strength
   */
  bellStrike({ voice = 'tulip', bright = 0.5, decor = 0, power = 1 } = {}) {
    if (!this.ready) return;
    const V = BELL_VOICES[voice] || BELL_VOICES.tulip;
    const c = this.ctx, t = c.currentTime;

    // Relief on the surface stiffens the wall a touch and adds inharmonicity:
    // the bell a child decorated heavily really does answer differently.
    const stretch = 1 + decor * 0.012;
    const f0 = V.f0 * (1 + (bright - 0.5) * 0.03);
    const out = c.createGain();
    out.gain.value = clamp(power, 0.25, 1) * 0.62;
    out.connect(this.master);

    let maxDur = 0;
    V.partials.forEach(([ratio, amp, dec], i) => {
      const f = f0 * Math.pow(ratio, stretch);
      if (f > 12000) return;
      // brighter alloys hold their upper partials longer
      const dur = dec * lerp(1.0, i > 2 ? 1.35 : 0.95, bright) * (1 - decor * 0.06);
      maxDur = Math.max(maxDur, dur);
      const g = c.createGain();
      const a = amp * lerp(1, i > 2 ? 1.5 : 0.85, bright);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a * 0.25, t + 0.004);
      g.gain.exponentialRampToValueAtTime(Math.max(0.00002, a * 0.0006), t + dur);
      g.connect(out);
      // two detuned partners give the bell its slow living beat
      const beat = V.beat * (0.6 + i * 0.22) * (1 + decor * 0.3);
      for (const sign of [-1, 1]) {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = f + sign * beat * 0.5;
        o.connect(g);
        o.start(t); o.stop(t + dur + 0.1);
        if (sign > 0) o.onended = () => { try { g.disconnect(); } catch (_) {} };
      }
    });

    // the clapper hitting the wall: a short metallic transient over the tail
    this._burst({ freq: V.strikeTone * lerp(0.7, 1.35, bright), q: 0.9, dur: 0.16, gain: 0.3 * V.strikeNoise * power, sweep: 0.18 });
    this._tone({ freq: f0 * 0.5, to: f0 * 0.48, dur: 0.9, gain: 0.16 * power, type: 'sine' });

    setTimeout(() => { try { out.disconnect(); } catch (_) {} }, (maxDur + 0.6) * 1000);
    return maxDur;
  }
}

export const audio = new AudioEngine();
