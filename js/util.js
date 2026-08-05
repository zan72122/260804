/* =========================================================
   util.js — 数学とちいさな道具
   ========================================================= */
(function (global) {
  'use strict';

  var U = {};

  /* ---------- 汎用 ---------- */
  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.smoothstep = function (e0, e1, x) {
    var t = U.clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  U.easeInOutCubic = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  U.easeOutBack = function (t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  U.easeOutElastic = function (t) {
    var c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };
  U.rad = function (d) { return d * Math.PI / 180; };

  /* 種つき乱数（テーマごとに同じ星空が出る） */
  U.rng = function (seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  };

  /* ---------- vec3 ---------- */
  var V = {};
  V.norm = function (v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  V.cross = function (a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  };
  V.dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  V.add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  V.sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
  V.scale = function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; };
  U.V = V;

  /* 方位角(度)・高度(度) -> 単位ベクトル (Y up) */
  U.dirFromAzAlt = function (azDeg, altDeg) {
    var az = U.rad(azDeg), al = U.rad(altDeg);
    var c = Math.cos(al);
    return [Math.cos(az) * c, Math.sin(al), Math.sin(az) * c];
  };

  /* アンカー方向の接平面に、ローカル2D点(度単位)を置く */
  U.tangentPoint = function (anchorDir, x, y, rotDeg) {
    var up = [0, 1, 0];
    if (Math.abs(U.V.dot(anchorDir, up)) > 0.985) up = [0, 0, 1];
    var right = V.norm(V.cross(up, anchorDir));
    var realUp = V.norm(V.cross(anchorDir, right));
    var r = U.rad(rotDeg || 0);
    var xr = x * Math.cos(r) - y * Math.sin(r);
    var yr = x * Math.sin(r) + y * Math.cos(r);
    var kx = Math.tan(U.rad(xr));
    var ky = Math.tan(U.rad(yr));
    return V.norm([
      anchorDir[0] + right[0] * kx + realUp[0] * ky,
      anchorDir[1] + right[1] * kx + realUp[1] * ky,
      anchorDir[2] + right[2] * kx + realUp[2] * ky
    ]);
  };

  /* ---------- mat4 (列優先) ---------- */
  var M = {};
  M.identity = function () {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  };
  M.perspective = function (fovyRad, aspect, near, far) {
    var f = 1 / Math.tan(fovyRad / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  };
  M.multiply = function (a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
                       a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  };
  M.rotateX = function (rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  };
  M.rotateY = function (rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  };
  M.rotateZ = function (rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  };
  M.translate = function (x, y, z) {
    var m = M.identity(); m[12] = x; m[13] = y; m[14] = z; return m;
  };
  M.scale = function (x, y, z) {
    var m = M.identity(); m[0] = x; m[5] = y; m[10] = z; return m;
  };
  U.M = M;

  /* ---------- トゥイーン ---------- */
  function Tweener() { this.list = []; }
  Tweener.prototype.to = function (obj, key, target, dur, ease, delay, onDone) {
    var self = this;
    this.list = this.list.filter(function (t) { return !(t.obj === obj && t.key === key); });
    this.list.push({
      obj: obj, key: key, from: obj[key], to: target,
      dur: Math.max(0.0001, dur), t: -(delay || 0),
      ease: ease || U.easeInOutCubic, onDone: onDone || null
    });
    return self;
  };
  Tweener.prototype.kill = function (obj, key) {
    this.list = this.list.filter(function (t) { return !(t.obj === obj && (key === undefined || t.key === key)); });
  };
  Tweener.prototype.update = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var tw = this.list[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      var p = U.clamp(tw.t / tw.dur, 0, 1);
      tw.obj[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(p);
      if (p >= 1) {
        this.list.splice(i, 1);
        if (tw.onDone) tw.onDone();
      }
    }
  };
  U.Tweener = Tweener;

  /* ---------- タイムライン ---------- */
  function Timeline() { this.evts = []; this.t = 0; this.running = false; }
  Timeline.prototype.at = function (time, fn) { this.evts.push({ t: time, fn: fn, done: false }); return this; };
  Timeline.prototype.start = function () { this.t = 0; this.running = true; this.evts.forEach(function (e) { e.done = false; }); };
  Timeline.prototype.stop = function () { this.running = false; };
  Timeline.prototype.clear = function () { this.evts = []; this.t = 0; this.running = false; };
  Timeline.prototype.update = function (dt) {
    if (!this.running) return;
    this.t += dt;
    for (var i = 0; i < this.evts.length; i++) {
      var e = this.evts[i];
      if (!e.done && this.t >= e.t) { e.done = true; e.fn(); }
    }
  };
  U.Timeline = Timeline;

  /* ---------- DOM ---------- */
  U.$ = function (sel) { return document.querySelector(sel); };
  U.$$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  U.el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  U.show = function (e) { if (e) e.classList.remove('hidden'); };
  U.hide = function (e) { if (e) e.classList.add('hidden'); };

  /* 要素中心の画面座標 */
  U.centerOf = function (e) {
    var r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  };

  /* ポインタ統一 */
  /* opts.stop = true なら、親の drag に イベントを つたえない
     （入れ子の drag が ポインタ捕捉を うばい合うのを ふせぐ） */
  U.drag = function (el, handlers, opts) {
    var active = null;
    var stop = !!(opts && opts.stop);
    function pos(ev) {
      var t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]) || ev;
      return { x: t.clientX, y: t.clientY };
    }
    function down(ev) {
      if (stop) ev.stopPropagation();
      if (active !== null) return;
      ev.preventDefault();
      active = (ev.pointerId !== undefined) ? ev.pointerId : 1;
      var p = pos(ev);
      if (el.setPointerCapture && ev.pointerId !== undefined) {
        try { el.setPointerCapture(ev.pointerId); } catch (e) {}
      }
      if (handlers.start) handlers.start(p, ev);
    }
    function move(ev) {
      if (stop) ev.stopPropagation();
      if (active === null) return;
      ev.preventDefault();
      if (handlers.move) handlers.move(pos(ev), ev);
    }
    function up(ev) {
      if (stop) ev.stopPropagation();
      if (active === null) return;
      ev.preventDefault();
      active = null;
      if (handlers.end) handlers.end(pos(ev), ev);
    }
    if (window.PointerEvent) {
      el.addEventListener('pointerdown', down, { passive: false });
      el.addEventListener('pointermove', move, { passive: false });
      el.addEventListener('pointerup', up, { passive: false });
      el.addEventListener('pointercancel', up, { passive: false });
    } else {
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchmove', move, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
      el.addEventListener('mousedown', function (e) {
        down(e);
        var mm = function (e2) { move(e2); };
        var mu = function (e2) { up(e2); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
        window.addEventListener('mousemove', mm);
        window.addEventListener('mouseup', mu);
      }, { passive: false });
    }
  };

  global.U = U;
})(window);
