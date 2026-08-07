/* 起動・メインループ・入力の受け口 */
(function (root) {
  'use strict';
  var DD = (root.DD = root.DD || {});

  function boot() {
    var canvas = document.getElementById('gl');
    var gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    if (!gl) {
      document.getElementById('fallback').style.display = 'flex';
      return;
    }
    if (!gl.getExtension('EXT_color_buffer_half_float') && !gl.getExtension('EXT_color_buffer_float')) {
      DD.noFloat = true;
    }

    var renderer, game, audio;
    try {
      renderer = new DD.Renderer(gl, canvas);
    } catch (e) {
      console.error(e);
      document.getElementById('fallback').style.display = 'flex';
      return;
    }
    audio = new DD.Audio();
    game = new DD.Game(renderer, audio);

    var cssW = 1, cssH = 1, dpr = 1;
    function resize() {
      cssW = Math.max(1, window.innerWidth);
      cssH = Math.max(1, window.innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      renderer.resize(cssW, cssH, dpr);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
    resize();

    /* --- 入力 --- */
    var activeId = null;
    function toNdc(e) {
      var r = canvas.getBoundingClientRect();
      return [
        ((e.clientX - r.left) / r.width) * 2 - 1,
        1 - ((e.clientY - r.top) / r.height) * 2
      ];
    }
    function down(e) {
      if (activeId !== null) return;
      activeId = e.pointerId;
      audio.start();
      hideSplash();
      var n = toNdc(e);
      game.pointerDown(n[0], n[1]);
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
      e.preventDefault();
    }
    function move(e) {
      if (activeId !== e.pointerId) return;
      var n = toNdc(e);
      game.pointerMove(n[0], n[1]);
      e.preventDefault();
    }
    function up(e) {
      if (activeId !== e.pointerId) return;
      activeId = null;
      game.pointerUp();
      e.preventDefault();
    }
    canvas.addEventListener('pointerdown', down, { passive: false });
    canvas.addEventListener('pointermove', move, { passive: false });
    canvas.addEventListener('pointerup', up, { passive: false });
    canvas.addEventListener('pointercancel', up, { passive: false });
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

    var splash = document.getElementById('splash');
    var splashHidden = false;
    function hideSplash() {
      if (splashHidden) return;
      splashHidden = true;
      splash.classList.add('gone');
      setTimeout(function () { splash.style.display = 'none'; }, 700);
    }
    setTimeout(function () { if (!splashHidden) splash.classList.add('idle'); }, 3000);

    /* --- ループ --- */
    var last = performance.now();
    var acc = 0;
    function frame(now) {
      var dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25;

      game.update(dt, cssW / cssH);
      renderer.render(game.st, game.camera, game.P);

      if (renderer.adapt(dt)) resize();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // デバッグ用フック
    root.__dd = {
      game: game, renderer: renderer, audio: audio,
      setPhase: function (p) { game.setPhase(p); },
      setLevel: function (v) {
        game.pumpSet = 1 - v / DD.W.SEA_Y;
        game.st.waterLevel = v;
        game.st.shipY = Math.max(DD.W.SHIP_LAND_Y, v - DD.W.SHIP_DRAFT);
      },
      step: function (seconds, dt) {
        dt = dt || 1 / 60;
        var n = Math.min(60000, Math.round(seconds / dt));
        for (var i = 0; i < n; i++) game.update(dt, cssW / cssH);
      },
      jump: function (phase, level) {
        game.setPhase(phase);
        if (level !== undefined) root.__dd.setLevel(level);
        game.st.shipX = 4;
        if (phase >= 1 && phase <= 4) game.st.gateAngle = Math.PI * 0.5;
        game.camState = null;
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : this);
