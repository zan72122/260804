// main — 起動とメインループ（ディレクター所有）
(function () {
  'use strict';

  function boot() {
    var canvas = document.getElementById('game');
    var game = window.NerikiriCore.create();
    window.NerikiriRender.init(canvas);
    window.NerikiriFX.init();
    window.NerikiriInput.init(canvas, game);
    window.NerikiriUI.init(game);
    window.__game = game; // デバッグ/QA用フック

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      window.NerikiriRender.resize(w, h, dpr);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 60); });
    resize();

    var last = performance.now();
    function frame(now) {
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      try {
        game.update(dt);
        window.NerikiriRender.render(game.state, dt);
        var ctx = canvas.getContext('2d');
        window.NerikiriFX.update(dt);
        window.NerikiriFX.render(ctx, window.NerikiriRender.getView());
      } catch (e) {
        console.error('frame error', e);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
