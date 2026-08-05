// 音はすべて WebAudio で合成する（音源ファイルなし）
import { rand, clamp } from './util.js';

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioKit {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.musicTimer = null;
    this.step = 0;
    this.musicGainValue = 0.32;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;

    this.master = c.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(c.destination);

    // 少しだけ広がりのある残響
    this.reverb = c.createConvolver();
    this.reverb.buffer = this._impulse(2.6, 2.4);
    this.wet = c.createGain();
    this.wet.gain.value = 0.34;
    this.reverb.connect(this.wet);
    this.wet.connect(this.master);

    this.dry = c.createGain();
    this.dry.gain.value = 0.85;
    this.dry.connect(this.master);

    this.musicGain = c.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.dry);
    this.musicGain.connect(this.reverb);

    this.sfxGain = c.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.dry);
    this.sfxGain.connect(this.reverb);

    this.ready = true;
    if (c.state === 'suspended') c.resume();
  }

  _impulse(dur, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _noiseBuffer(dur = 1) {
    const c = this.ctx, len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* ---------- 単発の音 ---------- */
  tone(freq, { dur = 0.9, type = 'sine', gain = 0.16, delay = 0, detune = 0, attack = 0.005 } = {}) {
    if (!this.ready) return;
    const c = this.ctx, t0 = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // やさしい鈴の音
  chime(degree = 0, { gain = 0.14, delay = 0, octave = 0 } = {}) {
    if (!this.ready) return;
    const base = 72 + octave * 12 + PENTA[((degree % PENTA.length) + PENTA.length) % PENTA.length];
    const f = mtof(base);
    this.tone(f, { dur: 1.5, type: 'sine', gain, delay });
    this.tone(f * 2.01, { dur: 0.8, type: 'sine', gain: gain * 0.45, delay });
    this.tone(f * 3.02, { dur: 0.5, type: 'sine', gain: gain * 0.18, delay: delay + 0.01 });
  }

  arpeggio(n = 4, { up = true, gain = 0.12, spread = 0.075 } = {}) {
    for (let i = 0; i < n; i++) {
      this.chime(up ? i + 2 : n - i + 1, { gain, delay: i * spread });
    }
  }

  // 幕やセットが動く「すーっ」
  whoosh({ dur = 1.1, gain = 0.18, up = true } = {}) {
    if (!this.ready) return;
    const c = this.ctx, t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.2);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(up ? 320 : 1700, t0);
    f.frequency.exponentialRampToValueAtTime(up ? 1800 : 300, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.1);
  }

  // ゴロゴロ（キャスターの音）。start→stop で持続。
  rumbleStart() {
    if (!this.ready || this._rumble) return;
    const c = this.ctx, t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 260; f.Q.value = 1.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.18);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t0);
    this._rumble = { src, g };
  }
  rumbleStop() {
    if (!this.ready || !this._rumble) return;
    const { src, g } = this._rumble;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.25);
    src.stop(t + 0.3);
    this._rumble = null;
  }

  // ウインチのカタカタ
  winch(delay = 0) {
    if (!this.ready) return;
    for (let i = 0; i < 3; i++) {
      this.tone(rand(180, 260), { dur: 0.09, type: 'square', gain: 0.03, delay: delay + i * 0.13 });
    }
  }

  pop() {
    if (!this.ready) return;
    const c = this.ctx, t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(rand(700, 1300), t0);
    o.frequency.exponentialRampToValueAtTime(rand(180, 320), t0 + 0.09);
    const g = c.createGain();
    g.gain.setValueAtTime(0.09, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + 0.15);
  }

  sparkle() {
    if (!this.ready) return;
    for (let i = 0; i < 7; i++) {
      this.tone(mtof(88 + PENTA[i % PENTA.length]), {
        dur: 0.5, type: 'triangle', gain: 0.05, delay: i * 0.045,
      });
    }
  }

  // 拍手：短いノイズのつぶを大量に散らす
  applause(dur = 4.5, gain = 0.5) {
    if (!this.ready) return;
    const c = this.ctx, t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.5);
    src.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 900;
    const bp = c.createBiquadFilter();
    bp.type = 'peaking'; bp.frequency.value = 2400; bp.gain.value = 6; bp.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain * 0.9, t0 + 0.35);
    // 揺らぎ
    const lfo = c.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 6.5;
    const lg = c.createGain(); lg.gain.value = gain * 0.16;
    lfo.connect(lg); lg.connect(g.gain);
    lfo.start(t0); lfo.stop(t0 + dur);
    g.gain.setValueAtTime(gain * 0.9, t0 + dur * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(this.sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.2);
    // ぱち、ぱち、と粒立ちを足す
    for (let i = 0; i < 46; i++) {
      const d = rand(0, dur * 0.85);
      const s2 = c.createBufferSource();
      s2.buffer = this._noiseBuffer(0.05);
      const f2 = c.createBiquadFilter();
      f2.type = 'bandpass'; f2.frequency.value = rand(1200, 3800); f2.Q.value = 1.2;
      const g2 = c.createGain();
      g2.gain.setValueAtTime(rand(0.05, 0.16), t0 + d);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.06);
      s2.connect(f2); f2.connect(g2); g2.connect(this.sfxGain);
      s2.start(t0 + d); s2.stop(t0 + d + 0.08);
    }
  }

  // どーん、と幕開けの一撃
  fanfare() {
    if (!this.ready) return;
    const degs = [0, 4, 7, 11, 14];
    degs.forEach((d, i) => {
      const f = mtof(62 + d);
      this.tone(f, { dur: 2.6, type: 'triangle', gain: 0.09, delay: i * 0.055 });
      this.tone(f * 2, { dur: 1.8, type: 'sine', gain: 0.05, delay: i * 0.055 });
    });
    this.tone(mtof(38), { dur: 2.4, type: 'sine', gain: 0.22 });
    this.whoosh({ dur: 1.6, gain: 0.1, up: true });
  }

  /* ---------- ゆるやかな伴奏 ---------- */
  startMusic(scale = 0) {
    if (!this.ready || this.musicTimer) return;
    this.musicRoot = [60, 62, 57][scale % 3];
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, this.ctx.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(this.musicGainValue, this.ctx.currentTime + 2.5);
    const beat = 0.46;
    this.musicTimer = setInterval(() => this._musicStep(), beat * 1000);
    this._pad();
  }
  setMusicLevel(v) {
    if (!this.ready) return;
    this.musicGainValue = v;
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, this.ctx.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 1.6);
  }
  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (this.ready) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, this.ctx.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);
    }
    if (this._padNodes) {
      for (const o of this._padNodes) { try { o.stop(this.ctx.currentTime + 1.4); } catch (_) {} }
      this._padNodes = null;
    }
  }
  _pad() {
    if (!this.ready) return;
    const c = this.ctx, t0 = c.currentTime;
    [0, 7, 12, 16].forEach((iv, i) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = mtof(this.musicRoot - 12 + iv);
      o.detune.value = rand(-7, 7);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.055 - i * 0.008, t0 + 3);
      o.connect(g); g.connect(this.musicGain);
      o.start(t0);
      this._padNodes = this._padNodes || [];
      this._padNodes.push(o);
    });
  }
  _musicStep() {
    if (!this.ready) return;
    const s = this.step++;
    const c = this.ctx, t0 = c.currentTime;
    const notes = [0, 4, 2, 7, 4, 9, 7, 11];
    if (s % 2 === 0 || Math.random() < 0.45) {
      const deg = notes[s % notes.length] + (Math.random() < 0.2 ? 12 : 0);
      const f = mtof(this.musicRoot + 12 + deg);
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
      o.connect(g); g.connect(this.musicGain);
      o.start(t0); o.stop(t0 + 1.5);
      // 倍音のきらめき
      const o2 = c.createOscillator();
      o2.type = 'sine'; o2.frequency.value = f * 2;
      const g2 = c.createGain();
      g2.gain.setValueAtTime(0.0001, t0);
      g2.gain.exponentialRampToValueAtTime(0.016, t0 + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
      o2.connect(g2); g2.connect(this.musicGain);
      o2.start(t0); o2.stop(t0 + 0.8);
    }
  }
}
