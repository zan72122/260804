/**
 * おと（ぜんぶ WebAudio の ごうせい。ファイルは つかわない）
 * ちいさな こどもが きくので、たかい おとは ひかえめ・ぜんたいに やわらかく。
 */
import { clamp, lerp } from './util.js';

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.enabled = true;
    this.master = null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0;
    // やさしく きこえる ように たかいおとを おとす
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 4200;
    soften.Q.value = 0.4;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    master.connect(soften).connect(comp).connect(ctx.destination);
    this.master = master;

    // ノイズ げんおん
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;

    this._buildEngine();
    this._buildRumble();
    this.ready = true;
    master.gain.setTargetAtTime(this.enabled ? 0.85 : 0, ctx.currentTime, 0.4);
    if (ctx.state === 'suspended') ctx.resume();
  }

  _noiseSource(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  }

  /* --- エンジンの アイドリング --- */
  _buildEngine() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    g.connect(lp).connect(this.master);

    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth'; o1.frequency.value = 47;
    const o2 = ctx.createOscillator();
    o2.type = 'square'; o2.frequency.value = 70.5;
    const og = ctx.createGain(); og.gain.value = 0.35;
    o1.connect(g); o2.connect(og).connect(g);

    // ドロドロ した ゆらぎ
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6.2;
    const lfoG = ctx.createGain(); lfoG.gain.value = 7;
    lfo.connect(lfoG).connect(o1.frequency);

    o1.start(); o2.start(); lfo.start();
    this.engine = { gain: g, o1, o2, lp };
  }

  /* --- ローラーの ごろごろ --- */
  _buildRumble() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 180; lp.Q.value = 1.2;
    g.connect(lp).connect(this.master);
    const n = this._noiseSource(true);
    n.connect(g);
    const sub = ctx.createOscillator();
    sub.type = 'sine'; sub.frequency.value = 38;
    const subG = ctx.createGain(); subG.gain.value = 0.6;
    sub.connect(subG).connect(g);
    n.start(); sub.start();
    this.rumble = { gain: g, lp, sub };
  }

  setEngine(level) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.engine.gain.gain.setTargetAtTime(clamp(level, 0, 1) * 0.16, t, 0.18);
    this.engine.o1.frequency.setTargetAtTime(lerp(44, 62, clamp(level, 0, 1)), t, 0.25);
  }

  setRumble(level) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.rumble.gain.gain.setTargetAtTime(clamp(level, 0, 1) * 0.2, t, 0.12);
    this.rumble.lp.frequency.setTargetAtTime(lerp(120, 240, clamp(level, 0, 1)), t, 0.2);
  }

  /* --- たんぱつの おと --- */

  _env(node, t0, a, d, peak) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  /** ざくっ */
  dig(strength = 1) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1500, t);
    bp.frequency.exponentialRampToValueAtTime(240, t + 0.22);
    bp.Q.value = 0.9;
    const n = this._noiseSource();
    n.connect(bp).connect(g).connect(this.master);
    this._env(g, t, 0.012, 0.26, 0.32 * strength);
    n.start(t); n.stop(t + 0.35);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.16);
    const og = ctx.createGain();
    o.connect(og).connect(this.master);
    this._env(og, t, 0.008, 0.2, 0.28 * strength);
    o.start(t); o.stop(t + 0.3);
  }

  /** どさっ */
  dump(strength = 1) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.6);
    const n = this._noiseSource();
    n.connect(lp).connect(g).connect(this.master);
    this._env(g, t, 0.03, 0.7, 0.34 * strength);
    n.start(t); n.stop(t + 0.85);

    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const t0 = t + i * 0.06;
      o.frequency.setValueAtTime(120 - i * 14, t0);
      o.frequency.exponentialRampToValueAtTime(42, t0 + 0.2);
      const og = ctx.createGain();
      o.connect(og).connect(this.master);
      this._env(og, t0, 0.01, 0.26, 0.22 * strength);
      o.start(t0); o.stop(t0 + 0.4);
    }
  }

  /** カン、と かるい きんぞくおん */
  clank(vol = 0.2) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [f, v] of [[520, 1], [880, 0.5], [1330, 0.25]]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f * (0.97 + Math.random() * 0.06);
      const g = ctx.createGain();
      o.connect(g).connect(this.master);
      this._env(g, t, 0.004, 0.22, vol * v);
      o.start(t); o.stop(t + 0.3);
    }
  }

  /** クラクション */
  horn() {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const play = (t0, dur) => {
      for (const [f, v] of [[233, 0.5], [311, 0.4], [466, 0.16]]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1400;
        o.connect(lp).connect(g).connect(this.master);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(v * 0.24, t0 + 0.02);
        g.gain.setValueAtTime(v * 0.24, t0 + dur);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.12);
        o.start(t0); o.stop(t0 + dur + 0.2);
      }
    };
    play(t, 0.2);
    play(t + 0.32, 0.32);
  }

  /** できた！ の キラキラ */
  fanfare() {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      const t0 = t + i * 0.13;
      for (const [mul, v] of [[1, 1], [2, 0.32], [3, 0.12]]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f * mul;
        const g = ctx.createGain();
        o.connect(g).connect(this.master);
        this._env(g, t0, 0.01, 0.9, 0.16 * v);
        o.start(t0); o.stop(t0 + 1.1);
      }
    });
  }

  /** UI の ぽこっ */
  blip(f = 660) {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.08);
    const g = ctx.createGain();
    o.connect(g).connect(this.master);
    this._env(g, t, 0.006, 0.16, 0.18);
    o.start(t); o.stop(t + 0.25);
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.ready) this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.15);
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}
