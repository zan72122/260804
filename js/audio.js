/* ------------------------------------------------------------------
   audio.js — WebAudio による効果音合成（外部ファイルなし）
   すべて手続き的に生成する。やさしい音色・耳に痛くない帯域。
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;

  function Snd() {
    this.ctx = null;
    this.master = null;
    this.ready = false;
    this.enabled = true;
    this.noiseBuf = null;
    this.fire = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.musicOn = true;
  }

  Snd.prototype.unlock = function () {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    try {
      this.ctx = new AC();
    } catch (e) { this.enabled = false; return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.85;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(c.destination);

    // ホワイトノイズ素材
    const len = Math.floor(c.sampleRate * 2);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    this.ready = true;
    if (c.state === 'suspended') c.resume();
  };

  Snd.prototype.t = function () { return this.ctx.currentTime; };

  /* --- 基本パーツ ------------------------------------------------ */

  Snd.prototype.noise = function (opt) {
    if (!this.ready || !this.enabled) return null;
    const c = this.ctx, t0 = this.t() + (opt.delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = opt.rate || 1;
    const f = c.createBiquadFilter();
    f.type = opt.type || 'bandpass';
    f.frequency.setValueAtTime(opt.f0 || 800, t0);
    if (opt.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(40, opt.f1), t0 + (opt.dur || 0.3));
    f.Q.value = opt.q === undefined ? 1 : opt.q;
    const g = c.createGain();
    const vol = (opt.vol === undefined ? 0.3 : opt.vol);
    const atk = opt.atk === undefined ? 0.012 : opt.atk;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opt.dur || 0.3));
    src.connect(f); f.connect(g); g.connect(opt.dest || this.master);
    src.start(t0);
    src.stop(t0 + (opt.dur || 0.3) + 0.05);
    return g;
  };

  Snd.prototype.tone = function (opt) {
    if (!this.ready || !this.enabled) return null;
    const c = this.ctx, t0 = this.t() + (opt.delay || 0);
    const o = c.createOscillator();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(opt.f0 || 440, t0);
    if (opt.f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), t0 + (opt.dur || 0.3));
    const g = c.createGain();
    const vol = opt.vol === undefined ? 0.15 : opt.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (opt.atk === undefined ? 0.01 : opt.atk));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opt.dur || 0.3));
    o.connect(g); g.connect(opt.dest || this.master);
    o.start(t0);
    o.stop(t0 + (opt.dur || 0.3) + 0.05);
    return g;
  };

  /* --- 効果音 ---------------------------------------------------- */

  // 生地をぽんと置く
  Snd.prototype.doughDrop = function () {
    this.noise({ f0: 420, f1: 120, q: 0.8, dur: 0.26, vol: 0.34, type: 'lowpass' });
    this.tone({ type: 'sine', f0: 150, f1: 70, dur: 0.22, vol: 0.2 });
  };

  // 押し広げる（連続、指の速さで音量）
  Snd.prototype.press = function (amt) {
    this.noise({ f0: 700 + amt * 900, f1: 300, q: 0.7, dur: 0.16, vol: 0.05 + amt * 0.1, type: 'lowpass' });
  };

  // 粉がふわっ
  Snd.prototype.flour = function (v) {
    this.noise({ f0: 3200, f1: 1200, q: 0.5, dur: 0.3, vol: 0.035 * (v || 1), type: 'highpass', atk: 0.05 });
  };

  // 生地をくるくる回す
  Snd.prototype.spin = function (v) {
    this.noise({ f0: 300 + v * 500, f1: 200, q: 1.2, dur: 0.3, vol: 0.05 + v * 0.06, type: 'bandpass' });
  };

  // 空中へ投げる
  Snd.prototype.toss = function (power) {
    const p = U.sat(power);
    this.noise({ f0: 500, f1: 2400 + p * 1800, q: 1.0, dur: 0.34 + p * 0.2, vol: 0.16 + p * 0.16 });
    this.tone({ type: 'sine', f0: 300 + p * 200, f1: 900 + p * 700, dur: 0.3, vol: 0.07 });
  };

  // 生地をキャッチ
  Snd.prototype.catchDough = function (power) {
    const p = U.sat(power);
    this.noise({ f0: 900, f1: 110, q: 0.6, dur: 0.28, vol: 0.22 + p * 0.2, type: 'lowpass' });
    this.tone({ type: 'sine', f0: 190, f1: 80, dur: 0.24, vol: 0.16 + p * 0.1 });
  };

  // ソースをぬる
  Snd.prototype.sauce = function (v) {
    this.noise({ f0: 900 + v * 500, f1: 500, q: 0.9, dur: 0.2, vol: 0.03 + v * 0.05, type: 'bandpass' });
  };

  // 具材がぽとん
  Snd.prototype.plop = function (pitch) {
    const f = 380 * (pitch || 1);
    this.tone({ type: 'triangle', f0: f, f1: f * 0.45, dur: 0.18, vol: 0.12 });
    this.noise({ f0: 1800, f1: 700, q: 1.2, dur: 0.1, vol: 0.05 });
  };

  // 木のピールに載る／すべる
  Snd.prototype.slide = function (v, dur) {
    this.noise({ f0: 260 + v * 260, f1: 180, q: 0.6, dur: dur || 0.4, vol: 0.05 + v * 0.13, type: 'bandpass', atk: 0.06 });
    this.noise({ f0: 2600, f1: 1400, q: 0.4, dur: dur || 0.4, vol: 0.02 + v * 0.05, type: 'highpass', atk: 0.07 });
  };

  // ピザが石床にスルッ
  Snd.prototype.landStone = function () {
    this.noise({ f0: 2000, f1: 500, q: 0.5, dur: 0.5, vol: 0.16, type: 'bandpass', atk: 0.02 });
    this.tone({ type: 'sine', f0: 120, f1: 60, dur: 0.3, vol: 0.12 });
  };

  // 窯の中でくるっ
  Snd.prototype.kuru = function () {
    this.noise({ f0: 1400, f1: 2600, q: 1.4, dur: 0.3, vol: 0.1 });
    const c = this.ready ? [880, 1174, 1318] : [];
    for (let i = 0; i < c.length; i++) {
      this.tone({ type: 'sine', f0: c[i], dur: 0.28, vol: 0.09, delay: i * 0.055 });
    }
  };

  // カット
  Snd.prototype.cut = function () {
    this.noise({ f0: 2600, f1: 900, q: 0.8, dur: 0.22, vol: 0.2, type: 'bandpass' });
    this.tone({ type: 'triangle', f0: 700, f1: 300, dur: 0.14, vol: 0.08 });
  };

  // チーズがのびる
  Snd.prototype.stretch = function () {
    this.tone({ type: 'sine', f0: 240, f1: 640, dur: 0.7, vol: 0.09, atk: 0.15 });
    this.tone({ type: 'triangle', f0: 480, f1: 1280, dur: 0.7, vol: 0.03, atk: 0.2 });
  };

  // きらきら
  Snd.prototype.sparkle = function (n) {
    const base = [1046, 1318, 1568, 2093];
    n = n || 4;
    for (let i = 0; i < n; i++) {
      this.tone({ type: 'sine', f0: base[i % base.length] * (i > 3 ? 2 : 1), dur: 0.4, vol: 0.06, delay: i * 0.06 });
    }
  };

  // できた！
  Snd.prototype.fanfare = function () {
    const notes = [523, 659, 784, 1046, 1318];
    for (let i = 0; i < notes.length; i++) {
      this.tone({ type: 'triangle', f0: notes[i], dur: 0.55, vol: 0.11, delay: i * 0.1 });
      this.tone({ type: 'sine', f0: notes[i] * 2, dur: 0.4, vol: 0.04, delay: i * 0.1 });
    }
  };

  // 決定音
  Snd.prototype.tap = function (p) {
    this.tone({ type: 'sine', f0: 620 * (p || 1), f1: 900 * (p || 1), dur: 0.16, vol: 0.11 });
    this.noise({ f0: 2200, q: 1.5, dur: 0.08, vol: 0.05 });
  };

  // ぶわっと火が上がる
  Snd.prototype.flare = function () {
    this.noise({ f0: 220, f1: 900, q: 0.7, dur: 0.6, vol: 0.16, type: 'bandpass', atk: 0.08 });
  };

  // ジュージュー（焼成中の単発）
  Snd.prototype.sizzle = function (v) {
    this.noise({ f0: 4200, f1: 2600, q: 0.4, dur: 0.5, vol: 0.02 * (v || 1), type: 'highpass', atk: 0.15 });
  };

  /* --- 窯の火のループ音 ------------------------------------------ */

  Snd.prototype.startFire = function () {
    if (!this.ready || !this.enabled || this.fire) return;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.0001;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start();
    this.fire = { src: src, gain: g, filt: lp };
  };

  Snd.prototype.fireLevel = function (v) {
    if (!this.fire) return;
    const t = this.t();
    this.fire.gain.gain.cancelScheduledValues(t);
    this.fire.gain.gain.setTargetAtTime(Math.max(0.0001, v * 0.16), t, 0.4);
    this.fire.filt.frequency.setTargetAtTime(300 + v * 500, t, 0.5);
  };

  /* --- ごく控えめな BGM（ペンタトニックのマリンバ） --------------- */

  const MEL = [0, 4, 7, 9, 7, 4, 0, 4, 7, 12, 9, 7, 4, 2, 0, 4];
  Snd.prototype.updateMusic = function (dt) {
    if (!this.ready || !this.enabled || !this.musicOn) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.42;
    const s = this.musicStep++;
    const root = 261.63;
    const n = MEL[s % MEL.length];
    const f = root * Math.pow(2, n / 12);
    this.tone({ type: 'sine', f0: f * 2, dur: 0.5, vol: 0.028, atk: 0.006 });
    this.tone({ type: 'triangle', f0: f, dur: 0.42, vol: 0.018, atk: 0.006 });
    if (s % 4 === 0) this.tone({ type: 'sine', f0: root / 2, dur: 0.8, vol: 0.03, atk: 0.02 });
  };

  PZ.snd = new Snd();
})();
