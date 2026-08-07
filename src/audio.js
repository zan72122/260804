/* =========================================================================
   audio.js — WebAudio による完全合成の効果音（音声ファイル不要）
   養蜂の作業音を，やわらかく，こわくないトーンで作る。
   ========================================================================= */
(function (global) {
  'use strict';

  var SFX = {
    ctx: null, master: null, ready: false, muted: false,
    _noise: null, _loops: {}
  };

  function now() { return SFX.ctx.currentTime; }

  SFX.init = function () {
    if (SFX.ctx) { if (SFX.ctx.state === 'suspended') SFX.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    SFX.ctx = new AC();
    var m = SFX.ctx.createGain();
    m.gain.value = 0.85;
    // 全体を少し丸めて，子どもの耳にやさしくする
    var soft = SFX.ctx.createBiquadFilter();
    soft.type = 'lowpass'; soft.frequency.value = 9000; soft.Q.value = 0.4;
    var comp = SFX.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 3.5;
    comp.attack.value = 0.005; comp.release.value = 0.22;
    m.connect(soft); soft.connect(comp); comp.connect(SFX.ctx.destination);
    SFX.master = m;
    SFX.ready = true;

    // 使い回すホワイトノイズ
    var len = SFX.ctx.sampleRate * 2;
    var buf = SFX.ctx.createBuffer(1, len, SFX.ctx.sampleRate);
    var d = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      // ややピンク寄りに（耳あたりが柔らかい）
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
    SFX._noise = buf;
    if (SFX.ctx.state === 'suspended') SFX.ctx.resume();
  };

  function noiseSrc(loop) {
    var s = SFX.ctx.createBufferSource();
    s.buffer = SFX._noise;
    s.loop = loop !== false;
    return s;
  }
  function gain(v) { var g = SFX.ctx.createGain(); g.gain.value = v; return g; }
  function filt(type, f, q) {
    var b = SFX.ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q;
    return b;
  }
  function osc(type, f) { var o = SFX.ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }

  function env(g, t0, a, peak, d, sustain, rel) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(peak * 0.0001, 0.00005), t0 + a + d);
  }

  /* ---------- 単発音 ---------- */

  // 燻煙器：シュポッ
  SFX.puff = function (strength) {
    if (!SFX.ready) return;
    strength = strength == null ? 1 : strength;
    var t = now();
    // 空気の抜ける「シュッ」
    var n = noiseSrc(true);
    var bp = filt('bandpass', 900, 1.1);
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(420, t + 0.30);
    var g = gain(0.0001);
    n.connect(bp); bp.connect(g); g.connect(SFX.master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * strength, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    n.start(t); n.stop(t + 0.4);
    // 蛇腹のぽふっという低音
    var o = osc('sine', 180);
    o.frequency.exponentialRampToValueAtTime(84, t + 0.16);
    var og = gain(0.0001);
    o.connect(og); og.connect(SFX.master);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.24 * strength, t + 0.015);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.start(t); o.stop(t + 0.3);
  };

  // 木のふた：ゴトッ
  SFX.woodThunk = function (v) {
    if (!SFX.ready) return;
    v = v == null ? 1 : v;
    var t = now();
    [128, 196, 305].forEach(function (f, i) {
      var o = osc(i === 0 ? 'sine' : 'triangle', f);
      var g = gain(0.0001);
      o.connect(g); g.connect(SFX.master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((0.3 - i * 0.08) * v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20 + i * 0.05);
      o.start(t); o.stop(t + 0.32);
    });
    var n = noiseSrc(true), lp = filt('lowpass', 1200), g2 = gain(0.0001);
    n.connect(lp); lp.connect(g2); g2.connect(SFX.master);
    g2.gain.setValueAtTime(0.22 * v, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.start(t); n.stop(t + 0.15);
  };

  // ガラス／金属：チン
  SFX.clink = function (p) {
    if (!SFX.ready) return;
    var t = now(), base = 1180 * (p || 1);
    [1, 1.62, 2.41].forEach(function (m, i) {
      var o = osc('sine', base * m);
      var g = gain(0.0001);
      o.connect(g); g.connect(SFX.master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16 / (i + 1), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7 - i * 0.18);
      o.start(t); o.stop(t + 0.8);
    });
  };

  // ぽろん（ごほうび用の一音）
  SFX.chime = function (semi, vol) {
    if (!SFX.ready) return;
    var t = now();
    var f = 523.25 * Math.pow(2, (semi || 0) / 12);
    vol = vol == null ? 1 : vol;
    [[1, .22], [2, .10], [3.01, .05], [4.2, .03]].forEach(function (pr) {
      var o = osc('sine', f * pr[0]); var g = gain(0.0001);
      o.connect(g); g.connect(SFX.master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(pr[1] * vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5 / pr[0]);
      o.start(t); o.stop(t + 1.6);
    });
  };

  // やったね（ペンタトニックの上昇）
  SFX.fanfare = function () {
    if (!SFX.ready) return;
    var notes = [0, 4, 7, 12, 16];
    notes.forEach(function (s, i) {
      setTimeout(function () { SFX.chime(s, 0.9); }, i * 105);
    });
  };

  // 蜜蓋をこそぐ：一掻きぶんのザリッ
  SFX.scrape = function (v) {
    if (!SFX.ready) return;
    var t = now();
    var n = noiseSrc(true);
    var hp = filt('highpass', 900);
    var bp = filt('bandpass', 2400, 0.9);
    var g = gain(0.0001);
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(SFX.master);
    bp.frequency.setValueAtTime(3000, t);
    bp.frequency.exponentialRampToValueAtTime(1300, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.20 * (v || 1), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    n.start(t); n.stop(t + 0.3);
  };

  // しずくが落ちる
  SFX.drip = function () {
    if (!SFX.ready) return;
    var t = now();
    var o = osc('sine', 700);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.06);
    var g = gain(0.0001);
    o.connect(g); g.connect(SFX.master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.start(t); o.stop(t + 0.2);
  };

  /* ---------- 持続音（ループ） ---------- */

  function makeLoop(key, build) {
    if (!SFX.ready) return null;
    if (SFX._loops[key]) return SFX._loops[key];
    var L = build();
    SFX._loops[key] = L;
    return L;
  }

  // 巣枠を引き抜く：スーーーッ（木と木がこすれる）
  SFX.slideLoop = function (amount) {
    var L = makeLoop('slide', function () {
      var n = noiseSrc(true);
      var bp = filt('bandpass', 1500, 1.6);
      var g = gain(0.0001);
      var o = osc('sawtooth', 96);
      var lp = filt('lowpass', 420);
      var og = gain(0.0001);
      n.connect(bp); bp.connect(g); g.connect(SFX.master);
      o.connect(lp); lp.connect(og); og.connect(SFX.master);
      n.start(); o.start();
      return { g: g, og: og, bp: bp, o: o };
    });
    if (!L) return;
    var t = now();
    var a = U.sat(amount);
    L.g.gain.setTargetAtTime(0.0001 + a * 0.20, t, 0.05);
    L.og.gain.setTargetAtTime(0.0001 + a * 0.06, t, 0.05);
    L.bp.frequency.setTargetAtTime(1100 + a * 1400, t, 0.08);
  };

  // 遠心分離機：回転の唸り
  SFX.spinLoop = function (speed) {
    var L = makeLoop('spin', function () {
      var o1 = osc('sawtooth', 40), o2 = osc('sawtooth', 40 * 1.005);
      var lp = filt('lowpass', 500, 3.5);
      var g = gain(0.0001);
      var n = noiseSrc(true);
      var bp = filt('bandpass', 900, 1.0);
      var ng = gain(0.0001);
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(SFX.master);
      n.connect(bp); bp.connect(ng); ng.connect(SFX.master);
      o1.start(); o2.start(); n.start();
      return { o1: o1, o2: o2, lp: lp, g: g, bp: bp, ng: ng };
    });
    if (!L) return;
    var t = now();
    var s = U.sat(speed);
    var f = 34 + s * 150;
    L.o1.frequency.setTargetAtTime(f, t, 0.10);
    L.o2.frequency.setTargetAtTime(f * 1.006, t, 0.10);
    L.lp.frequency.setTargetAtTime(320 + s * 2200, t, 0.10);
    L.g.gain.setTargetAtTime(0.0001 + s * 0.17, t, 0.10);
    L.bp.frequency.setTargetAtTime(500 + s * 2600, t, 0.10);
    L.ng.gain.setTargetAtTime(0.0001 + s * s * 0.13, t, 0.10);
  };

  // 蜂蜜が流れる：トローーー
  SFX.pourLoop = function (amount) {
    var L = makeLoop('pour', function () {
      var n = noiseSrc(true);
      var lp = filt('lowpass', 600, 1.2);
      var g = gain(0.0001);
      var o = osc('sine', 88);
      var og = gain(0.0001);
      var lfo = osc('sine', 1.7);
      var lfoG = gain(140);
      lfo.connect(lfoG); lfoG.connect(lp.frequency);
      n.connect(lp); lp.connect(g); g.connect(SFX.master);
      o.connect(og); og.connect(SFX.master);
      n.start(); o.start(); lfo.start();
      return { g: g, og: og, lp: lp };
    });
    if (!L) return;
    var t = now(), a = U.sat(amount);
    L.g.gain.setTargetAtTime(0.0001 + a * 0.16, t, 0.08);
    L.og.gain.setTargetAtTime(0.0001 + a * 0.05, t, 0.08);
    L.lp.frequency.setTargetAtTime(420 + a * 500, t, 0.10);
  };

  // ミツバチの羽音
  SFX.beeLoop = function (amount) {
    var L = makeLoop('bee', function () {
      var o1 = osc('sawtooth', 172), o2 = osc('sawtooth', 178.5), o3 = osc('sine', 344);
      var lp = filt('lowpass', 760, 2.0);
      var g = gain(0.0001);
      var lfo = osc('sine', 6.3), lfoG = gain(0.35);
      var trem = SFX.ctx.createGain(); trem.gain.value = 0.7;
      lfo.connect(lfoG); lfoG.connect(trem.gain);
      o1.connect(lp); o2.connect(lp); o3.connect(lp);
      lp.connect(trem); trem.connect(g); g.connect(SFX.master);
      o1.start(); o2.start(); o3.start(); lfo.start();
      return { g: g, lp: lp };
    });
    if (!L) return;
    var t = now(), a = U.sat(amount);
    L.g.gain.setTargetAtTime(0.0001 + a * 0.075, t, 0.35);
    L.lp.frequency.setTargetAtTime(520 + a * 500, t, 0.35);
  };

  // 草原の風（常時うっすら）
  SFX.windLoop = function (amount) {
    var L = makeLoop('wind', function () {
      var n = noiseSrc(true);
      var lp = filt('lowpass', 380, 0.7);
      var g = gain(0.0001);
      var lfo = osc('sine', 0.11), lfoG = gain(150);
      lfo.connect(lfoG); lfoG.connect(lp.frequency);
      n.connect(lp); lp.connect(g); g.connect(SFX.master);
      n.start(); lfo.start();
      return { g: g };
    });
    if (!L) return;
    L.g.gain.setTargetAtTime(0.0001 + U.sat(amount) * 0.055, now(), 0.6);
  };

  SFX.silenceAll = function () {
    if (!SFX.ready) return;
    SFX.slideLoop(0); SFX.spinLoop(0); SFX.pourLoop(0);
  };

  SFX.setMuted = function (m) {
    SFX.muted = m;
    if (SFX.master) SFX.master.gain.setTargetAtTime(m ? 0.0001 : 0.85, now(), 0.1);
  };

  global.SFX = SFX;
})(window);
