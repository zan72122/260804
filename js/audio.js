/* =========================================================
   audio.js — 合成音のみ（外部ファイルなし）
   ========================================================= */
(function (global) {
  'use strict';

  var A = {
    ctx: null, master: null, verb: null, verbGain: null,
    ready: false, muted: false,
    droneNodes: null, polishSrc: null
  };

  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

  function noteHz(semi, base) { return (base || 261.63) * Math.pow(2, semi / 12); }

  A.init = function () {
    if (A.ready) return;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { return; }

    A.master = A.ctx.createGain();
    A.master.gain.value = 0.85;
    A.master.connect(A.ctx.destination);

    /* 簡易リバーブ（ノイズのインパルス応答を合成） */
    var len = Math.floor(A.ctx.sampleRate * 2.6);
    var buf = A.ctx.createBuffer(2, len, A.ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * 0.7;
      }
    }
    try {
      A.verb = A.ctx.createConvolver();
      A.verb.buffer = buf;
      A.verbGain = A.ctx.createGain();
      A.verbGain.gain.value = 0.5;
      A.verb.connect(A.verbGain);
      A.verbGain.connect(A.master);
    } catch (e) { A.verb = null; }

    A.ready = true;
  };

  A.resume = function () {
    if (!A.ready) A.init();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };

  function out(node, wet) {
    node.connect(A.master);
    if (A.verb && wet) {
      var g = A.ctx.createGain();
      g.gain.value = wet;
      node.connect(g);
      g.connect(A.verb);
    }
  }

  function env(gain, t0, a, d, peak) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  /* --- 基本トーン --- */
  A.tone = function (freq, dur, type, vol, wet, detune, glideTo) {
    if (!A.ready || A.muted) return;
    var t0 = A.ctx.currentTime;
    var o = A.ctx.createOscillator();
    var g = A.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    if (detune) o.detune.value = detune;
    env(g, t0, Math.min(0.02, dur * 0.2), dur, vol === undefined ? 0.2 : vol);
    o.connect(g);
    out(g, wet === undefined ? 0.35 : wet);
    o.start(t0);
    o.stop(t0 + dur + 0.12);
  };

  /* --- ノイズ --- */
  function noiseBuf(sec) {
    var n = Math.floor(A.ctx.sampleRate * sec);
    var b = A.ctx.createBuffer(1, n, A.ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  A.noise = function (dur, f0, f1, vol, wet, q) {
    if (!A.ready || A.muted) return;
    var t0 = A.ctx.currentTime;
    var s = A.ctx.createBufferSource();
    s.buffer = noiseBuf(Math.max(0.2, dur));
    var f = A.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q || 1.2;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t0 + dur);
    var g = A.ctx.createGain();
    env(g, t0, dur * 0.15, dur * 0.9, vol === undefined ? 0.12 : vol);
    s.connect(f); f.connect(g);
    out(g, wet === undefined ? 0.4 : wet);
    s.start(t0); s.stop(t0 + dur + 0.1);
  };

  /* ========== 効果音 ========== */

  A.tap = function () { A.tone(700, 0.09, 'sine', 0.16, 0.2); };

  A.pop = function (i) {
    var n = PENTA[(i || 0) % PENTA.length];
    A.tone(noteHz(n, 523.25), 0.5, 'sine', 0.16, 0.6);
    A.tone(noteHz(n + 12, 523.25), 0.3, 'sine', 0.05, 0.6);
  };

  A.click = function () {
    A.tone(1200, 0.05, 'square', 0.07, 0.1);
    A.tone(330, 0.14, 'triangle', 0.13, 0.3);
  };

  A.snap = function () {
    A.tone(180, 0.12, 'sine', 0.22, 0.2);
    A.tone(880, 0.18, 'triangle', 0.1, 0.4);
    A.noise(0.09, 3000, 900, 0.07, 0.2, 2);
  };

  A.chime = function (base) {
    var b = base || 523.25;
    [0, 4, 7, 12].forEach(function (n, i) {
      setTimeout(function () {
        A.tone(noteHz(n, b), 1.4, 'sine', 0.15, 0.8);
        A.tone(noteHz(n + 19, b), 0.7, 'sine', 0.04, 0.8);
      }, i * 90);
    });
  };

  A.sparkle = function () {
    var n = PENTA[Math.floor(Math.random() * 8) + 4];
    A.tone(noteHz(n, 880), 0.35, 'sine', 0.07, 0.7);
  };

  A.whoosh = function (dur) {
    A.noise(dur || 2.2, 900, 90, 0.16, 0.6, 0.8);
  };

  A.rumble = function () {
    if (!A.ready || A.muted) return;
    var t0 = A.ctx.currentTime;
    var o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t0);
    o.frequency.exponentialRampToValueAtTime(28, t0 + 3.0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
    o.connect(g); out(g, 0.2);
    o.start(t0); o.stop(t0 + 3.6);
  };

  A.shoot = function () {
    if (!A.ready || A.muted) return;
    A.tone(2400, 0.75, 'sine', 0.09, 0.9, 0, 420);
    A.noise(0.55, 5200, 700, 0.05, 0.7, 1.6);
  };

  A.bloom = function () {
    A.chime(392.0);
    setTimeout(function () { A.chime(523.25); }, 380);
    A.rumble();
  };

  /* --- レンズを磨く連続音 --- */
  A.polishOn = function () {
    if (!A.ready || A.muted || A.polishSrc) return;
    var s = A.ctx.createBufferSource();
    s.buffer = noiseBuf(2);
    s.loop = true;
    var f = A.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.9;
    var g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, A.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.035, A.ctx.currentTime + 0.12);
    s.connect(f); f.connect(g); g.connect(A.master);
    s.start();
    A.polishSrc = { s: s, g: g, f: f };
  };
  A.polishOff = function () {
    if (!A.polishSrc) return;
    var p = A.polishSrc; A.polishSrc = null;
    try {
      p.g.gain.linearRampToValueAtTime(0.0001, A.ctx.currentTime + 0.15);
      p.s.stop(A.ctx.currentTime + 0.25);
    } catch (e) {}
  };
  A.polishPitch = function (v) {
    if (A.polishSrc) {
      try { A.polishSrc.f.frequency.setTargetAtTime(1500 + v * 2600, A.ctx.currentTime, 0.05); } catch (e) {}
    }
  };

  /* --- 星空のパッド（フィナーレ中ずっと） --- */
  A.droneOn = function (rootHz) {
    if (!A.ready || A.muted || A.droneNodes) return;
    var t0 = A.ctx.currentTime;
    var g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.13, t0 + 4.0);
    var f = A.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.6;
    var lfo = A.ctx.createOscillator(), lfoG = A.ctx.createGain();
    lfo.frequency.value = 0.06; lfoG.gain.value = 380;
    lfo.connect(lfoG); lfoG.connect(f.frequency); lfo.start();

    var oscs = [];
    var base = rootHz || 130.81;
    [[0, 0], [7, 4], [12, -6], [19, 7], [24, -3]].forEach(function (p) {
      var o = A.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = noteHz(p[0], base);
      o.detune.value = p[1];
      var og = A.ctx.createGain();
      og.gain.value = 0.34 / (1 + p[0] * 0.06);
      o.connect(og); og.connect(f);
      o.start(); oscs.push(o);
    });
    f.connect(g);
    g.connect(A.master);
    if (A.verb) { var wg = A.ctx.createGain(); wg.gain.value = 0.9; g.connect(wg); wg.connect(A.verb); }
    A.droneNodes = { g: g, oscs: oscs, lfo: lfo };
  };
  A.droneOff = function () {
    if (!A.droneNodes) return;
    var d = A.droneNodes; A.droneNodes = null;
    try {
      d.g.gain.linearRampToValueAtTime(0.0001, A.ctx.currentTime + 1.6);
      setTimeout(function () {
        d.oscs.forEach(function (o) { try { o.stop(); } catch (e) {} });
        try { d.lfo.stop(); } catch (e) {}
      }, 1900);
    } catch (e) {}
  };

  /* --- きらきらメロディ（星が広がるとき） --- */
  A.starRun = function (count, base) {
    for (var i = 0; i < count; i++) {
      (function (k) {
        setTimeout(function () {
          var n = PENTA[Math.min(PENTA.length - 1, k + 2)];
          A.tone(noteHz(n, base || 523.25), 1.1, 'sine', 0.1, 0.85);
        }, k * 105);
      })(i);
    }
  };

  global.Snd = A;
})(window);
