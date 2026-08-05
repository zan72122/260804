/* =========================================================
   main.js — 起動と ループ、ゆびの うけつけ
   ========================================================= */
(function (global) {
  'use strict';

  var last = 0, raf = null;

  function fail(msg) {
    var d = document.createElement('div');
    d.id = 'nogl';
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

  /* ---------- ゆび ---------- */
  function bindInput(canvas) {
    var active = null;
    function pos(ev) {
      var t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]) || ev;
      return { x: t.clientX, y: t.clientY };
    }
    function down(ev) {
      if (active !== null) return;
      ev.preventDefault();
      unlock();
      active = (ev.pointerId !== undefined) ? ev.pointerId : 1;
      if (canvas.setPointerCapture && ev.pointerId !== undefined) {
        try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      }
      var p = pos(ev);
      Game.down(p.x, p.y);
    }
    function move(ev) {
      if (active === null) return;
      ev.preventDefault();
      var p = pos(ev);
      Game.move(p.x, p.y);
    }
    function up(ev) {
      if (active === null) return;
      ev.preventDefault();
      active = null;
      var p = pos(ev);
      Game.up(p.x, p.y);
    }
    if (global.PointerEvent) {
      canvas.addEventListener('pointerdown', down, { passive: false });
      canvas.addEventListener('pointermove', move, { passive: false });
      canvas.addEventListener('pointerup', up, { passive: false });
      canvas.addEventListener('pointercancel', up, { passive: false });
    } else {
      canvas.addEventListener('touchstart', down, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', up, { passive: false });
      canvas.addEventListener('mousedown', function (e) {
        down(e);
        var mm = function (e2) { move(e2); };
        var mu = function (e2) {
          up(e2);
          global.removeEventListener('mousemove', mm);
          global.removeEventListener('mouseup', mu);
        };
        global.addEventListener('mousemove', mm);
        global.addEventListener('mouseup', mu);
      }, { passive: false });
    }
  }

  function boot() {
    var canvas = document.getElementById('stage');
    if (!Scene.init(canvas)) {
      fail('この ブラウザでは 3D が つかえないみたい。<br>Safari や Chrome で ひらいてね。');
      return;
    }
    Scene.resize();
    Game.init();
    bindInput(canvas);
    raf = requestAnimationFrame(loop);
  }

  var resizeT = null;
  function onResize() {
    Scene.resize();
    if (resizeT) clearTimeout(resizeT);
    resizeT = setTimeout(function () { Scene.resize(); }, 220);
  }
  global.addEventListener('resize', onResize);
  global.addEventListener('orientationchange', function () {
    setTimeout(onResize, 120);
    setTimeout(onResize, 420);
  });

  function unlock() {
    if (global.Snd) { Snd.init(); Snd.resume(); }
  }
  ['touchstart', 'pointerdown', 'mousedown', 'keydown'].forEach(function (e) {
    global.addEventListener(e, unlock, { passive: true });
  });

  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

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
