// fx — パーティクル演出 + WebAudio 効果音（Agent-FX 所有）
// CONTRACT.md の「FX」節に準拠。他ファイルは一切参照/編集しない。
(function () {
  'use strict';

  var MAX_PARTICLES = 200;

  // ---- パーティクルプール --------------------------------------------
  function makeParticle() {
    return {
      active: false, kind: '',
      x: 0, y: 0, vx: 0, vy: 0, ax: 0,
      rot: 0, vrot: 0,
      size: 0, size0: 0, growAmt: 0,
      color: '#ffffff',
      life: 0, maxLife: 0,
      vyMax: 0,
      flutterFreq: 0, flutterAmp: 0, seed: 0, t: 0,
    };
  }

  var particles = [];
  for (var pi = 0; pi < MAX_PARTICLES; pi++) particles.push(makeParticle());
  var cursor = 0;

  function acquire() {
    for (var c = 0; c < particles.length; c++) {
      var idx = (cursor + c) % particles.length;
      if (!particles[idx].active) {
        cursor = (idx + 1) % particles.length;
        return particles[idx];
      }
    }
    return null; // プール満杯なら諦めて描画スキップ（キャップ厳守）
  }

  function spawn(opts) {
    if (!opts) return null;
    var p = acquire();
    if (!p) return null;
    p.active = true;
    p.kind = opts.kind || '';
    p.x = opts.x || 0; p.y = opts.y || 0;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0; p.ax = opts.ax || 0;
    p.rot = opts.rot || 0; p.vrot = opts.vrot || 0;
    p.size = opts.size || 4;
    p.size0 = opts.size0 || 0;
    p.growAmt = opts.growAmt || 0;
    p.color = opts.color || '#ffffff';
    p.life = (typeof opts.life === 'number') ? opts.life : 0.5;
    p.maxLife = p.life > 0 ? p.life : 0.0001;
    p.vyMax = (typeof opts.vyMax === 'number') ? opts.vyMax : 999;
    p.flutterFreq = opts.flutterFreq || 0;
    p.flutterAmp = opts.flutterAmp || 0;
    p.seed = opts.seed || 0;
    p.t = 0;
    return p;
  }

  // 時間差発火キュー（ring:complete の順次きらめき、flower:complete の紙吹雪散布用）
  var pendingSpawns = [];

  function clearAllFx() {
    for (var i = 0; i < particles.length; i++) particles[i].active = false;
    pendingSpawns.length = 0;
  }

  // ---- 直近の描画情報キャッシュ（emit時点でのcanvasサイズ/viewが必要なため）----
  var lastView = { cx: 0, cy: 0, scale: 100, rotation: 0 };
  var lastW = (typeof window !== 'undefined' && window.innerWidth) || 360;
  var lastH = (typeof window !== 'undefined' && window.innerHeight) || 640;

  function cacheFromRender(ctx, view) {
    try {
      if (view) lastView = view;
      if (ctx && ctx.canvas) {
        var cw = ctx.canvas.clientWidth, ch = ctx.canvas.clientHeight;
        if (cw) lastW = cw;
        if (ch) lastH = ch;
      }
    } catch (e) { /* noop */ }
    if (!lastView) lastView = { cx: lastW / 2, cy: lastH / 2, scale: 100, rotation: 0 };
  }

  // ローカル角/半径 → スクリーン座標。NerikiriRender未定義なら画面中央フォールバック。
  function toScreen(angle, radius) {
    try {
      var R = window.NerikiriRender;
      if (R && typeof R.localToScreen === 'function') {
        var pt = R.localToScreen(angle, radius);
        if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') return pt;
      }
    } catch (e) { /* noop */ }
    var cx = (lastView && typeof lastView.cx === 'number') ? lastView.cx : lastW / 2;
    var cy = (lastView && typeof lastView.cy === 'number') ? lastView.cy : lastH / 2;
    return { x: cx, y: cy };
  }

  // 現在テーマ配色（読み取り専用フォールバック付き）。
  // main.js が window.__game をQA用に公開しているため、あれば使い分け、無ければ既定パステルで代替する。
  var FALLBACK_THEME = { base: '#f6b8c8', deep: '#e88aa6', tip: '#fdeef3', shibe: '#f4cf6a' };
  function currentTheme() {
    try {
      var themes = (window.NCFG && window.NCFG.THEMES) || null;
      if (!themes || !themes.length) return FALLBACK_THEME;
      var idx = 0;
      var g = window.__game;
      if (g && g.state && typeof g.state.themeIndex === 'number') idx = g.state.themeIndex;
      return themes[idx] || themes[0] || FALLBACK_THEME;
    } catch (e) {
      return FALLBACK_THEME;
    }
  }

  // ---- 物理更新 --------------------------------------------------------
  function stepParticles(dt) {
    for (var i = pendingSpawns.length - 1; i >= 0; i--) {
      var ps = pendingSpawns[i];
      ps.delay -= dt;
      if (ps.delay <= 0) {
        pendingSpawns.splice(i, 1);
        try { ps.fn(); } catch (e) { /* noop */ }
      }
    }

    for (var k = 0; k < particles.length; k++) {
      var p = particles[k];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }

      switch (p.kind) {
        case 'confetti':
          p.vy += p.ax * dt;
          p.vx *= (1 - Math.min(1, 1.1 * dt));
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vrot * dt;
          break;
        case 'sparkle':
        case 'star':
          p.rot += p.vrot * dt;
          p.y -= 4 * dt;
          break;
        case 'poww':
          break;
        case 'puff':
          p.y -= 8 * dt;
          break;
        case 'petal':
          p.t += dt;
          p.vy = Math.min(p.vy + p.ax * dt, p.vyMax);
          p.x += Math.sin(p.t * p.flutterFreq + p.seed) * p.flutterAmp * dt;
          p.y += p.vy * dt;
          p.rot += p.vrot * dt;
          break;
        default:
          break;
      }
    }
  }

  // ---- 描画 --------------------------------------------------------
  function drawConfetti(ctx, p) {
    var frac = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, frac * 2.5));
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    var s = p.size;
    ctx.fillRect(-s / 2, -s * 0.35, s, s * 0.7);
    ctx.restore();
  }

  function drawSparkle(ctx, p) {
    var frac = p.life / p.maxLife; // 1 -> 0
    var pop = Math.sin(Math.max(0, Math.min(1, 1 - frac)) * Math.PI); // 0→1→0
    if (pop <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = pop;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    var s = p.size * (0.55 + 0.45 * pop);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.28, -s * 0.28);
    ctx.lineTo(s, 0);
    ctx.lineTo(s * 0.28, s * 0.28);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.28, s * 0.28);
    ctx.lineTo(-s, 0);
    ctx.lineTo(-s * 0.28, -s * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPoww(ctx, p) {
    var frac = Math.max(0, p.life / p.maxLife); // 1 -> 0
    var grow = 1 - frac;
    var r = p.size0 + grow * p.growAmt;
    ctx.save();
    ctx.globalAlpha = frac * 0.55;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1 + 2.5 * frac;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.1, r), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPuff(ctx, p) {
    var frac = Math.max(0, p.life / p.maxLife);
    var grow = 1 - frac;
    var r = p.size0 + grow * p.growAmt;
    ctx.save();
    ctx.globalAlpha = frac * 0.5;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.1, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPetal(ctx, p) {
    var frac = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, frac * 2.5));
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(ctx) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!p.active) continue;
      switch (p.kind) {
        case 'confetti': drawConfetti(ctx, p); break;
        case 'sparkle':
        case 'star': drawSparkle(ctx, p); break;
        case 'poww': drawPoww(ctx, p); break;
        case 'puff': drawPuff(ctx, p); break;
        case 'petal': drawPetal(ctx, p); break;
        default: break;
      }
    }
  }

  // =====================================================================
  // WebAudio（合成のみ・外部音源禁止）
  // =====================================================================
  var actx = null;
  var masterGain = null;
  var noiseBuffer = null;

  function ensureAudio() {
    try {
      if (actx) {
        if (actx.state === 'suspended') {
          try { actx.resume(); } catch (e) { /* noop */ }
        }
        return actx;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      masterGain = actx.createGain();
      var g = 0.35;
      try {
        if (window.NCFG && window.NCFG.AUDIO && typeof window.NCFG.AUDIO.masterGain === 'number') {
          g = window.NCFG.AUDIO.masterGain;
        }
      } catch (e2) { /* noop */ }
      masterGain.gain.value = g;
      masterGain.connect(actx.destination);
      if (actx.state === 'suspended') {
        try { actx.resume(); } catch (e3) { /* noop */ }
      }
    } catch (e) {
      actx = null; masterGain = null;
    }
    return actx;
  }

  function getNoiseBuffer(ctx) {
    if (noiseBuffer && noiseBuffer._ownerCtx === ctx) return noiseBuffer;
    var len = Math.max(1, Math.floor(ctx.sampleRate * 0.3));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    buf._ownerCtx = ctx;
    noiseBuffer = buf;
    return buf;
  }

  function safeStopStart(node, t0, t1) {
    try { node.start(t0); } catch (e) { /* noop */ }
    try { node.stop(t1); } catch (e2) { /* noop */ }
  }

  // 「シャキッ」— チョキ音。短ノイズバースト2連 + クリック。切るたびピッチ僅かに揺らぐ。
  function playCut() {
    var ctx = ensureAudio();
    if (!ctx || !masterGain) return;
    try {
      var t0 = ctx.currentTime;
      var wobble = (Math.random() * 2 - 1); // -1..1

      var offsets = [0, 0.045];
      for (var i = 0; i < offsets.length; i++) {
        var off = offsets[i];
        var dur = 0.02 + Math.random() * 0.02; // 20-40ms
        var src = ctx.createBufferSource();
        src.buffer = getNoiseBuffer(ctx);
        var hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 3200 + i * 900 + wobble * 500;
        var ng = ctx.createGain();
        var start = t0 + off;
        ng.gain.setValueAtTime(0.0001, start);
        ng.gain.exponentialRampToValueAtTime(0.85, start + 0.004);
        ng.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        src.connect(hp); hp.connect(ng); ng.connect(masterGain);
        safeStopStart(src, start, start + dur + 0.01);
      }

      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      var f0 = 1700 + wobble * 260;
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(80, f0 * 0.55), t0 + 0.055);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(0.45, t0 + 0.006);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);
      osc.connect(og); og.connect(masterGain);
      safeStopStart(osc, t0, t0 + 0.09);
    } catch (e) { /* 絶対に例外を投げない */ }
  }

  // やわらかい「ぽよん」— 下降ピッチベンドのサイン波。
  function playMiss() {
    var ctx = ensureAudio();
    if (!ctx || !masterGain) return;
    try {
      var t0 = ctx.currentTime;
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t0);
      osc.frequency.exponentialRampToValueAtTime(210, t0 + 0.26);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.26, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      osc.connect(g); g.connect(masterGain);
      safeStopStart(osc, t0, t0 + 0.32);
    } catch (e) { /* noop */ }
  }

  // 明るい3音アルペジオ（ペンタトニック C5-E5-G5、玉が転がるように）
  function playRingComplete() {
    var ctx = ensureAudio();
    if (!ctx || !masterGain) return;
    try {
      var t0 = ctx.currentTime;
      var notes = [523.25, 659.25, 784.0];
      for (var i = 0; i < notes.length; i++) {
        var start = t0 + i * 0.09;
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(notes[i], start);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.3, start + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.26);
        osc.connect(g); g.connect(masterGain);
        safeStopStart(osc, start, start + 0.28);
      }
    } catch (e) { /* noop */ }
  }

  // 「ぽん」— 短いサイン + 軽いノイズ
  function playCenterPress() {
    var ctx = ensureAudio();
    if (!ctx || !masterGain) return;
    try {
      var t0 = ctx.currentTime;
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, t0);
      osc.frequency.exponentialRampToValueAtTime(300, t0 + 0.09);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.38, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      osc.connect(g); g.connect(masterGain);
      safeStopStart(osc, t0, t0 + 0.13);

      var src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(0.14, t0 + 0.006);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
      src.connect(lp); lp.connect(ng); ng.connect(masterGain);
      safeStopStart(src, t0, t0 + 0.07);
    } catch (e) { /* noop */ }
  }

  // 和風ペンタトニック上昇(D-E-G-A-B-D) + キラキラチャイム
  function playFlowerComplete() {
    var ctx = ensureAudio();
    if (!ctx || !masterGain) return;
    try {
      var t0 = ctx.currentTime;
      var notes = [293.66, 329.63, 392.0, 440.0, 493.88, 587.33]; // D4 E4 G4 A4 B4 D5
      for (var i = 0; i < notes.length; i++) {
        var start = t0 + i * 0.085;
        var osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(notes[i], start);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.3, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
        osc.connect(g); g.connect(masterGain);
        safeStopStart(osc, start, start + 0.24);
      }

      var chimeStart = t0 + notes.length * 0.085 + 0.06;
      var chimeFreqs = [1046.5, 1318.5, 1568.0, 2093.0]; // C6 E6 G6 C7
      for (var j = 0; j < chimeFreqs.length; j++) {
        var cs = chimeStart + j * 0.055;
        var cosc = ctx.createOscillator();
        cosc.type = 'sine';
        cosc.frequency.setValueAtTime(chimeFreqs[j], cs);
        var cg = ctx.createGain();
        cg.gain.setValueAtTime(0.0001, cs);
        cg.gain.exponentialRampToValueAtTime(0.16, cs + 0.02);
        cg.gain.exponentialRampToValueAtTime(0.0001, cs + 1.1);
        cosc.connect(cg); cg.connect(masterGain);
        safeStopStart(cosc, cs, cs + 1.2);
      }
    } catch (e) { /* noop */ }
  }

  // =====================================================================
  // NBus イベントハンドラ
  // =====================================================================
  function onCutDone(payload) {
    payload = payload || {};
    try {
      var pos = toScreen(payload.angle || 0, payload.radius || 0);
      var theme = currentTheme();
      var palette = [theme.base, theme.deep, theme.tip, '#ffffff'];

      var nFrag = 4 + Math.floor(Math.random() * 4); // 4-7
      for (var i = 0; i < nFrag; i++) {
        var ang = Math.random() * Math.PI * 2;
        var spd = 40 + Math.random() * 70;
        spawn({
          kind: 'confetti',
          x: pos.x, y: pos.y,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 25,
          ax: 150,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() * 2 - 1) * 8,
          size: 4 + Math.random() * 4,
          color: palette[Math.floor(Math.random() * palette.length)],
          life: 0.5 + Math.random() * 0.3,
        });
      }
      var nSpark = 2 + Math.floor(Math.random() * 2); // 2-3
      for (var j = 0; j < nSpark; j++) {
        var a2 = Math.random() * Math.PI * 2;
        var d2 = Math.random() * 8;
        spawn({
          kind: 'sparkle',
          x: pos.x + Math.cos(a2) * d2, y: pos.y + Math.sin(a2) * d2,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() * 2 - 1) * 3,
          size: 5 + Math.random() * 3,
          color: '#ffffff',
          life: 0.26 + Math.random() * 0.16,
        });
      }
    } catch (e) { /* noop */ }
    playCut();
  }

  function onCutMiss(payload) {
    payload = payload || {};
    try {
      var x = (typeof payload.x === 'number') ? payload.x : lastW / 2;
      var y = (typeof payload.y === 'number') ? payload.y : lastH / 2;
      var theme = currentTheme();
      spawn({
        kind: 'poww',
        x: x, y: y,
        size0: 3, growAmt: 20,
        color: theme.tip || '#ffffff',
        life: 0.45 + Math.random() * 0.15,
      });
    } catch (e) { /* noop */ }
    playMiss();
  }

  function onRingComplete(payload) {
    payload = payload || {};
    try {
      var ringIndex = (typeof payload.ringIndex === 'number') ? payload.ringIndex : 0;
      var ringCfg = null;
      try { ringCfg = window.NCFG && window.NCFG.RINGS && window.NCFG.RINGS[ringIndex]; } catch (e0) { /* noop */ }
      var ringR = (ringCfg && typeof ringCfg.r === 'number') ? ringCfg.r : 0.6;
      var count = 16;
      for (var i = 0; i < count; i++) {
        (function (idx) {
          var ang = (idx / count) * Math.PI * 2;
          pendingSpawns.push({
            delay: idx * (0.5 / count),
            fn: function () {
              var pos = toScreen(ang, ringR);
              var theme = currentTheme();
              spawn({
                kind: 'sparkle',
                x: pos.x, y: pos.y,
                rot: Math.random() * Math.PI * 2,
                vrot: (Math.random() * 2 - 1) * 4,
                size: 6 + Math.random() * 3,
                color: (Math.random() < 0.5) ? '#ffffff' : (theme.tip || '#ffffff'),
                life: 0.32 + Math.random() * 0.16,
              });
            },
          });
        })(i);
      }
    } catch (e) { /* noop */ }
    playRingComplete();
  }

  function onCenterPress(payload) {
    payload = payload || {};
    try {
      var pos = toScreen(0, 0);
      var theme = currentTheme();
      var n = 5 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var d = Math.random() * 6;
        spawn({
          kind: 'puff',
          x: pos.x + Math.cos(a) * d, y: pos.y + Math.sin(a) * d,
          size0: 2, growAmt: 14 + Math.random() * 8,
          color: theme.shibe || '#f4cf6a',
          life: 0.28 + Math.random() * 0.16,
        });
      }
    } catch (e) { /* noop */ }
    playCenterPress();
  }

  function onFlowerComplete() {
    try {
      var w = lastW, h = lastH;
      var theme = currentTheme();
      var palette = [theme.base, theme.deep, theme.tip, theme.shibe || '#f4cf6a', '#ffffff'];

      var petalCount = 46;
      for (var i = 0; i < petalCount; i++) {
        (function () {
          var delay = Math.random() * 1.6;
          pendingSpawns.push({
            delay: delay,
            fn: function () {
              spawn({
                kind: 'petal',
                x: Math.random() * w,
                y: -20 - Math.random() * 60,
                vy: 40 + Math.random() * 40,
                vyMax: 170,
                ax: 70,
                rot: Math.random() * Math.PI * 2,
                vrot: (Math.random() * 2 - 1) * 3,
                size: 6 + Math.random() * 5,
                color: palette[Math.floor(Math.random() * palette.length)],
                flutterFreq: 1.4 + Math.random() * 1.6,
                flutterAmp: 26 + Math.random() * 30,
                seed: Math.random() * Math.PI * 2,
                life: 1.6 + Math.random() * 0.8,
              });
            },
          });
        })();
      }

      var starCount = 26;
      for (var j = 0; j < starCount; j++) {
        (function () {
          var delay2 = Math.random() * 1.8;
          pendingSpawns.push({
            delay: delay2,
            fn: function () {
              spawn({
                kind: 'star',
                x: Math.random() * w,
                y: Math.random() * h * 0.85,
                rot: Math.random() * Math.PI * 2,
                vrot: (Math.random() * 2 - 1) * 2,
                size: 6 + Math.random() * 6,
                color: '#ffffff',
                life: 0.5 + Math.random() * 0.4,
              });
            },
          });
        })();
      }
    } catch (e) { /* noop */ }
    playFlowerComplete();
  }

  function onPhaseChange(payload) {
    try {
      if (payload && payload.phase === 'play') clearAllFx();
    } catch (e) { /* noop */ }
  }

  function onAudioUnlock() {
    ensureAudio();
  }

  // =====================================================================
  // 公開 API
  // =====================================================================
  var inited = false;

  function init() {
    if (inited) return;
    inited = true;
    try {
      if (!window.NBus) return;
      window.NBus.on('cut:done', onCutDone);
      window.NBus.on('cut:miss', onCutMiss);
      window.NBus.on('ring:complete', onRingComplete);
      window.NBus.on('center:press', onCenterPress);
      window.NBus.on('flower:complete', onFlowerComplete);
      window.NBus.on('phase:change', onPhaseChange);
      window.NBus.on('audio:unlock', onAudioUnlock);
    } catch (e) { /* noop */ }
  }

  function update(dt) {
    try {
      stepParticles(typeof dt === 'number' ? dt : 0);
    } catch (e) { /* noop */ }
  }

  function render(ctx, view) {
    try {
      cacheFromRender(ctx, view);
      if (!ctx) return;
      ctx.save();
      drawParticles(ctx);
      ctx.restore();
    } catch (e) { /* noop */ }
  }

  window.NerikiriFX = {
    init: init,
    update: update,
    render: render,
  };
})();
