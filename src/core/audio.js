// すべての効果音を WebAudio で合成する（外部アセット無し）。
// 連続音（のこぎり・巻き尺・紙やすり）は速度に追従するループ音源で表現する。
import { clamp } from './util.js';

function makeNoiseBuffer(ctx, seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02; // 少しブラウン寄りにして耳当たりを柔らかく
    d[i] = w * 0.7 + last * 3.0;
  }
  return buf;
}

class Loop {
  constructor(audio, { type = 'bandpass', freq = 900, q = 1.2, gain = 0.0 } = {}) {
    const ctx = audio.ctx;
    this.audio = audio;
    this.src = ctx.createBufferSource();
    this.src.buffer = audio.noise;
    this.src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = type;
    this.filter.frequency.value = freq;
    this.filter.Q.value = q;
    this.gain = ctx.createGain();
    this.gain.gain.value = gain;
    this.src.connect(this.filter).connect(this.gain).connect(audio.bus);
    this.src.start(0);
    this.running = true;
  }
  set(gain, freq, rate = 1) {
    if (!this.running) return;
    const t = this.audio.ctx.currentTime;
    this.gain.gain.setTargetAtTime(gain, t, 0.03);
    if (freq) this.filter.frequency.setTargetAtTime(freq, t, 0.04);
    try { this.src.playbackRate.setTargetAtTime(rate, t, 0.05); } catch (e) { /* noop */ }
  }
  stop() {
    if (!this.running) return;
    this.running = false;
    const t = this.audio.ctx.currentTime;
    this.gain.gain.setTargetAtTime(0, t, 0.05);
    try { this.src.stop(t + 0.4); } catch (e) { /* noop */ }
  }
}

export class Audio {
  constructor() {
    this.ready = false;
    this.muted = false;
    this.ctx = null;
    this.speechOn = true;
    this._lastSay = 0;
  }
  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.noise = makeNoiseBuffer(this.ctx, 2.5);
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 0.9;
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 6;
    this.bus.connect(this.comp).connect(this.ctx.destination);
    this.ready = true;
    this.startAmbient();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  setMuted(m) {
    this.muted = m;
    if (this.bus) this.bus.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    if (m && window.speechSynthesis) window.speechSynthesis.cancel();
  }
  get t() { return this.ctx.currentTime; }

  // --- 基本パーツ ---
  blip({ freq = 440, dur = 0.16, type = 'sine', gain = 0.25, at = 0, slide = 0, attack = 0.006 }) {
    if (!this.ready) return;
    const t0 = this.t + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.bus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noiseBurst({ dur = 0.12, freq = 1800, q = 1, gain = 0.3, at = 0, type = 'bandpass', sweep = 0 }) {
    if (!this.ready) return;
    const t0 = this.t + at;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, freq + sweep), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(this.bus);
    s.start(t0); s.stop(t0 + dur + 0.05);
  }

  // --- ゲーム内の音 ---
  uiTap() { this.blip({ freq: 640, dur: 0.09, type: 'triangle', gain: 0.18, slide: 220 }); }
  pop() { this.blip({ freq: 380, dur: 0.14, type: 'sine', gain: 0.22, slide: 420 }); }

  /** 巻き尺の「シャーッ」 */
  tapeLoop() { return new Loop(this, { type: 'bandpass', freq: 2400, q: 0.8 }); }
  /** 鉛筆の「スーッ」 */
  pencilLoop() { return new Loop(this, { type: 'bandpass', freq: 3400, q: 1.6 }); }
  /** のこぎりの「ギコギコ」 */
  sawLoop() { return new Loop(this, { type: 'bandpass', freq: 950, q: 1.4 }); }
  /** 紙やすりの「サーッ」 */
  sandLoop() { return new Loop(this, { type: 'highpass', freq: 1800, q: 0.6 }); }
  /** 刷毛の「サッサッ」 */
  brushLoop() { return new Loop(this, { type: 'lowpass', freq: 1100, q: 0.4 }); }

  /** ぴったりの位置に吸着した合図 */
  snap() {
    this.blip({ freq: 880, dur: 0.1, type: 'triangle', gain: 0.22 });
    this.blip({ freq: 1320, dur: 0.18, type: 'sine', gain: 0.2, at: 0.05 });
    this.noiseBurst({ dur: 0.05, freq: 5200, gain: 0.14 });
  }
  /** クランプの「カチッ」 */
  clampClick() {
    this.noiseBurst({ dur: 0.05, freq: 2600, q: 3, gain: 0.3 });
    this.blip({ freq: 300, dur: 0.12, type: 'square', gain: 0.12, slide: -120 });
  }
  clampTick() {
    this.noiseBurst({ dur: 0.03, freq: 3200, q: 6, gain: 0.14 });
  }
  /** 金づちの「トントン」 */
  hammer(step = 0) {
    const p = 1 + step * 0.13;
    this.noiseBurst({ dur: 0.09, freq: 260 * p, q: 0.7, gain: 0.5, sweep: -140 });
    this.blip({ freq: 150 * p, dur: 0.14, type: 'sine', gain: 0.4, slide: -60 });
    this.blip({ freq: 2100 * p, dur: 0.07, type: 'triangle', gain: 0.1 });
  }
  /** 木が置かれる・落ちる音 */
  thunk(v = 1) {
    this.blip({ freq: 120, dur: 0.2, type: 'sine', gain: 0.34 * v, slide: -50 });
    this.noiseBurst({ dur: 0.1, freq: 500, q: 0.8, gain: 0.2 * v, sweep: -260 });
  }
  /** 部品がはまった音 */
  fit() {
    this.blip({ freq: 520, dur: 0.1, type: 'triangle', gain: 0.22 });
    this.blip({ freq: 780, dur: 0.16, type: 'sine', gain: 0.2, at: 0.06 });
    this.thunk(0.5);
  }
  sparkle() {
    const base = 900 + Math.random() * 200;
    for (let i = 0; i < 4; i++) {
      this.blip({ freq: base * (1 + i * 0.42), dur: 0.22, type: 'sine', gain: 0.11, at: i * 0.045 });
    }
  }
  /** 工程クリアのファンファーレ（点数評価はしない、ただの気持ちよさ） */
  chime(kind = 0) {
    const scales = [
      [523.25, 659.25, 783.99, 1046.5],
      [587.33, 739.99, 880, 1174.7],
      [493.88, 622.25, 739.99, 987.77],
    ];
    const s = scales[kind % scales.length];
    s.forEach((f, i) => this.blip({ freq: f, dur: 0.45, type: 'triangle', gain: 0.17, at: i * 0.09 }));
  }
  fanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.blip({ freq: f, dur: 0.6, type: 'triangle', gain: 0.16, at: i * 0.12 });
      this.blip({ freq: f * 2, dur: 0.3, type: 'sine', gain: 0.06, at: i * 0.12 });
    });
    this.noiseBurst({ dur: 0.5, freq: 6000, gain: 0.08, at: 0.5, type: 'highpass' });
  }
  /** 次の操作を促す小さな合図 */
  hint() {
    this.blip({ freq: 780, dur: 0.16, type: 'sine', gain: 0.13 });
    this.blip({ freq: 1040, dur: 0.2, type: 'sine', gain: 0.11, at: 0.11 });
  }

  /** ゆるやかな環境音（工房の空気） */
  startAmbient() {
    if (!this.ready || this._amb) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0.055;
    g.connect(this.bus);
    // 柔らかいパッド
    [130.81, 196.0, 261.63, 392.0].forEach((f, i) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      og.gain.value = 0.24 / (i + 1);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 0.05 + i * 0.017;
      lg.gain.value = 0.12 / (i + 1);
      lfo.connect(lg).connect(og.gain);
      lfo.start();
      o.connect(og).connect(g);
      o.start();
    });
    this._amb = g;
  }

  /** 短い日本語の声かけ（対応端末のみ / 文字が読めなくても伝わる補助） */
  say(text) {
    if (!this.speechOn || this.muted) return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const now = performance.now();
    if (now - this._lastSay < 700) return;
    this._lastSay = now;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.rate = 1.0;
      u.pitch = 1.35;
      u.volume = 0.85;
      const v = synth.getVoices().find((x) => /ja[-_]JP/i.test(x.lang));
      if (v) u.voice = v;
      synth.speak(u);
    } catch (e) { /* 未対応端末では無視 */ }
  }
}

export const audio = new Audio();
export { clamp };
