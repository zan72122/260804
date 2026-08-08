/**
 * audio.js — 擬音ちゅうしんの効果音。
 * すべて WebAudio の手続き生成なので素材ファイル 0 個で鳴る。
 * あとから本物の声・効果音に差し替えられるよう、VOICE_FILES / SFX_FILES に
 * URL を入れるだけで合成音より優先して再生される構成にしてある。
 */

/** 差し替え用：{ 'guru': './assets/voice_guru.mp3', ... } を入れると合成音より優先 */
export const VOICE_FILES = {};
export const SFX_FILES = {};

/** 擬音の表示テキスト（UIと共有） */
export const ONOMAT = {
  guru: 'ぐるるるる！',
  aita: 'あいた！',
  doba: 'どばーっ！',
  gogo: 'ごごごご……',
  gugu: 'ぐぐぐっ！',
  fusa: 'ふさがった！',
  again: 'もういっかい！',
  ready: 'いくよー！',
};

export class Audio2 {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.nodes = {};
    this.voiceOn = true;
    this._buf = null;
    this._files = {};
  }

  /* ---------- 基盤 ---------- */
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return this.ctx; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      // ホワイトノイズ（火花・噴出・蒸気の素）
      const n = this.ctx.sampleRate * 2;
      const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 2.2; }
      this._buf = b;
    } catch (e) { this.ctx = null; }
    return this.ctx;
  }
  get t() { return this.ctx ? this.ctx.currentTime : 0; }
  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.85 : 0.0, this.t, 0.05);
    if (!v && window.speechSynthesis) try { speechSynthesis.cancel(); } catch (_) {}
  }

  _noise(gain = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._buf; s.loop = true;
    const g = this.ctx.createGain(); g.gain.value = gain;
    s.connect(g);
    return { src: s, gain: g };
  }
  _osc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    return o;
  }

  /* ---------- 1) ぐるるるる（ドリル回転ループ） ---------- */
  startDrill() {
    if (!this.ensure() || this.nodes.drill) return;
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0; out.connect(this.master);

    const saw = this._osc('sawtooth', 62);
    const sq = this._osc('square', 31);
    const bp = c.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 620; bp.Q.value = 6;
    const sg = c.createGain(); sg.gain.value = 0.34;
    saw.connect(bp); sq.connect(bp); bp.connect(sg); sg.connect(out);

    // 「ぐるる」の粒立ち＝振幅の高速トレモロ
    const lfo = this._osc('sine', 17);
    const lfoG = c.createGain(); lfoG.gain.value = 0.42;
    lfo.connect(lfoG); lfoG.connect(sg.gain);

    const nz = this._noise(0.16);
    const nf = c.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 1500; nf.Q.value = 1.1;
    nz.gain.connect(nf); nf.connect(out);

    saw.start(); sq.start(); lfo.start(); nz.src.start();
    out.gain.setTargetAtTime(0.0, this.t, 0.02);
    this.nodes.drill = { out, saw, sq, lfo, nz, bp, nf, sg };
    this.setDrill(0);
  }
  setDrill(x) {
    const n = this.nodes.drill; if (!n) return;
    const v = Math.max(0, Math.min(1.6, x));
    const t = this.t;
    n.out.gain.setTargetAtTime(0.30 * Math.min(1, v * 1.5), t, 0.06);
    n.saw.frequency.setTargetAtTime(46 + v * 74, t, 0.07);
    n.sq.frequency.setTargetAtTime(23 + v * 37, t, 0.07);
    n.lfo.frequency.setTargetAtTime(9 + v * 30, t, 0.07);
    n.bp.frequency.setTargetAtTime(420 + v * 1500, t, 0.08);
    n.nf.frequency.setTargetAtTime(900 + v * 2600, t, 0.08);
  }
  stopDrill() {
    const n = this.nodes.drill; if (!n) return;
    this.nodes.drill = null;
    const t = this.t;
    n.out.gain.setTargetAtTime(0, t, 0.08);
    setTimeout(() => { try { n.saw.stop(); n.sq.stop(); n.lfo.stop(); n.nz.src.stop(); } catch (_) {} }, 400);
  }

  /* ---------- 2) 貫通（あいた！） ---------- */
  breakthrough() {
    if (!this.ensure()) return;
    const c = this.ctx, t = this.t;
    // 金属的なヒット
    for (const [f, d, g] of [[880, 0.5, 0.16], [1320, 0.42, 0.10], [1760, 0.34, 0.07]]) {
      const o = this._osc('triangle', f);
      const gg = c.createGain(); gg.gain.setValueAtTime(0, t);
      gg.gain.linearRampToValueAtTime(g, t + 0.006);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(gg); gg.connect(this.master); o.start(t); o.stop(t + d + 0.05);
    }
    // 破れる感じ
    const nz = this._noise(1);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(320, t + 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    nz.gain.connect(f); f.connect(g); g.connect(this.master);
    nz.src.start(t); nz.src.stop(t + 0.7);
  }

  /* ---------- 3) どばーっ（噴出ループ） ---------- */
  startGush() {
    if (!this.ensure() || this.nodes.gush) return;
    const c = this.ctx, t = this.t;
    const out = c.createGain(); out.gain.value = 0; out.connect(this.master);
    const nz = this._noise(1);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;
    nz.gain.connect(lp); lp.connect(hp); hp.connect(out);
    // 低いゴウゴウ
    const sub = this._osc('sine', 54);
    const sg = c.createGain(); sg.gain.value = 0.12;
    sub.connect(sg); sg.connect(out);
    nz.src.start(t); sub.start(t);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.5, t + 0.18);
    this.nodes.gush = { out, nz, sub, lp };
  }
  setGush(x) {
    const n = this.nodes.gush; if (!n) return;
    const t = this.t;
    n.out.gain.setTargetAtTime(0.14 + 0.34 * x, t, 0.15);
    n.lp.frequency.setTargetAtTime(420 + 1500 * x, t, 0.2);
  }
  stopGush() {
    const n = this.nodes.gush; if (!n) return;
    this.nodes.gush = null;
    const t = this.t;
    n.out.gain.setTargetAtTime(0, t, 0.25);
    setTimeout(() => { try { n.nz.src.stop(); n.sub.stop(); } catch (_) {} }, 1400);
  }

  /* ---------- 4) ごごごご（mud gun 旋回） ---------- */
  startRumble() {
    if (!this.ensure() || this.nodes.rum) return;
    const c = this.ctx, t = this.t;
    const out = c.createGain(); out.gain.value = 0.0001; out.connect(this.master);
    const o1 = this._osc('sawtooth', 41);
    const o2 = this._osc('sawtooth', 27.5);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 3;
    const g = c.createGain(); g.gain.value = 0.5;
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
    // ごご…ごご… という粗いうねり
    const lfo = this._osc('square', 6.2);
    const lg = c.createGain(); lg.gain.value = 0.34;
    lfo.connect(lg); lg.connect(g.gain);
    const nz = this._noise(0.10);
    const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 420;
    nz.gain.connect(nf); nf.connect(out);
    o1.start(t); o2.start(t); lfo.start(t); nz.src.start(t);
    out.gain.exponentialRampToValueAtTime(0.42, t + 0.3);
    this.nodes.rum = { out, o1, o2, lfo, nz };
  }
  setRumble(x) {
    const n = this.nodes.rum; if (!n) return;
    n.out.gain.setTargetAtTime(0.12 + 0.36 * x, this.t, 0.12);
  }
  stopRumble() {
    const n = this.nodes.rum; if (!n) return;
    this.nodes.rum = null;
    const t = this.t;
    n.out.gain.setTargetAtTime(0.0001, t, 0.18);
    setTimeout(() => { try { n.o1.stop(); n.o2.stop(); n.lfo.stop(); n.nz.src.stop(); } catch (_) {} }, 900);
  }

  /* ---------- 5) ぐぐぐっ（閉塞材の押し込み） ---------- */
  startPush() {
    if (!this.ensure() || this.nodes.push) return;
    const c = this.ctx, t = this.t;
    const out = c.createGain(); out.gain.value = 0.0001; out.connect(this.master);
    const o = this._osc('sawtooth', 74);
    const bp = c.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 300; bp.Q.value = 9;
    o.connect(bp); bp.connect(out);
    const nz = this._noise(0.22);
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 700; nf.Q.value = 1.4;
    nz.gain.connect(nf); nf.connect(out);
    o.start(t); nz.src.start(t);
    out.gain.exponentialRampToValueAtTime(0.34, t + 0.1);
    this.nodes.push = { out, o, bp, nz, nf };
  }
  setPush(x) {
    const n = this.nodes.push; if (!n) return;
    const t = this.t;
    n.o.frequency.setTargetAtTime(62 + x * 120, t, 0.12);
    n.bp.frequency.setTargetAtTime(240 + x * 900, t, 0.12);
    n.nf.frequency.setTargetAtTime(500 + x * 1400, t, 0.12);
    n.out.gain.setTargetAtTime(0.18 + x * 0.24, t, 0.1);
  }
  stopPush() {
    const n = this.nodes.push; if (!n) return;
    this.nodes.push = null;
    const t = this.t;
    n.out.gain.setTargetAtTime(0.0001, t, 0.1);
    setTimeout(() => { try { n.o.stop(); n.nz.src.stop(); } catch (_) {} }, 600);
  }

  /* ---------- 6) ふさがった！／もういっかい ---------- */
  sealed() {
    if (!this.ensure()) return;
    const c = this.ctx, t0 = this.t;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.10;
      const o = this._osc('triangle', f);
      const o2 = this._osc('sine', f * 2);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.20, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g); o2.connect(g); g.connect(this.master);
      o.start(t); o2.start(t); o.stop(t + 1.0); o2.stop(t + 1.0);
    });
  }
  hiss(dur = 0.9) {
    if (!this.ensure()) return;
    const c = this.ctx, t = this.t;
    const nz = this._noise(1);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3800; f.Q.value = 0.6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    nz.gain.connect(f); f.connect(g); g.connect(this.master);
    nz.src.start(t); nz.src.stop(t + dur + 0.1);
  }
  blip(freq = 700, dur = 0.12) {
    if (!this.ensure()) return;
    const c = this.ctx, t = this.t;
    const o = this._osc('square', freq);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  thud() {
    if (!this.ensure()) return;
    const c = this.ctx, t = this.t;
    const o = this._osc('sine', 160);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.5);
  }

  /* ---------- 声（擬音） ---------- */
  say(key) {
    if (!this.enabled || !this.voiceOn) return;
    const url = VOICE_FILES[key];
    if (url) {
      try { const a = new Audio(url); a.volume = 0.95; a.play().catch(() => {}); } catch (_) {}
      return;
    }
    if (!('speechSynthesis' in window)) return;
    const text = ONOMAT[key];
    if (!text) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; u.rate = 0.95; u.pitch = 1.55; u.volume = 0.95;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (_) {}
  }
  stopAll() {
    this.stopDrill(); this.stopGush(); this.stopRumble(); this.stopPush();
  }
}
