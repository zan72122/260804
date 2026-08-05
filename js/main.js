/* =========================================================
   main.js — 起動と ループ
   ========================================================= */
(function (global) {
  'use strict';

  var last = 0, raf = null;

  function fail(msg) {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;padding:8vw;' +
      'text-align:center;font-family:sans-serif;color:#fff;background:#0a0a18;z-index:99;' +
      'font-size:4.2vmin;line-height:1.7';
    d.innerHTML = '✦<br>' + msg;
    document.body.appendChild(d);
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (!last) last = ts;
    var dt = Math.min(0.10, (ts - last) / 1000);
    last = ts;
    Game.update(dt);
    Scene.render(dt);
  }

  function boot() {
    var canvas = document.getElementById('stage');
    if (!Scene.init(canvas)) {
      fail('この ブラウザでは 3D が つかえないみたい。<br>Safari や Chrome で ひらいてね。');
      return;
    }
    Scene.resize();
    Game.init();
    raf = requestAnimationFrame(loop);
  }

  /* サイズ変更（回転をふくむ） */
  var resizeT = null;
  function onResize() {
    Scene.resize();
    if (resizeT) clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      Scene.resize();
      if (global.UI) {
        try { UI.cable.redraw(); } catch (e) {}
        try { UI.lever.reposition(); } catch (e) {}
      }
    }, 220);
  }
  global.addEventListener('resize', onResize);
  global.addEventListener('orientationchange', function () {
    setTimeout(onResize, 120);
    setTimeout(onResize, 420);
  });

  /* 音は 最初のタッチで 目ざめる */
  function unlock() {
    if (global.Snd) { Snd.init(); Snd.resume(); }
  }
  ['touchstart', 'pointerdown', 'mousedown', 'keydown'].forEach(function (e) {
    global.addEventListener(e, unlock, { once: false, passive: true });
  });

  /* うっかりスクロール・ピンチを ふせぐ */
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* 画面が かくれたら 休む */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    } else if (!raf) {
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
