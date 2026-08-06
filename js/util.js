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
  U.deg = function (r) { return r * 180 / Math.PI; };

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

  /* 逆行列（レイキャストで 画面→世界 に もどすのに使う） */
  M.invert = function (a) {
    var o = new Float32Array(16);
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
    var b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    var b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    var b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    var b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
    var b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M.identity();
    det = 1.0 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  };

  /* 点を 変換（w で 割る） */
  M.project = function (m, p) {
    var x = p[0], y = p[1], z = p[2];
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (!w) w = 1e-6;
    return [
      (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
    ];
  };

  /* カメラ行列（位置 eye から target を見る） */
  M.lookAt = function (eye, target, up) {
    var z = V.norm(V.sub(eye, target));
    var x = V.cross(up || [0, 1, 0], z);
    var xl = Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
    if (xl < 1e-5) { x = V.cross([0, 0, 1], z); }
    x = V.norm(x);
    var y = V.norm(V.cross(z, x));
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
      -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
      -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1
    ]);
  };

  /* 位置・向き(Y回転)・拡大 から モデル行列 */
  M.trs = function (pos, yawRad, s, pitchRad, rollRad) {
    var m = M.identity();
    if (pitchRad || rollRad) {
      m = M.multiply(M.rotateY(yawRad || 0),
            M.multiply(M.rotateX(pitchRad || 0), M.rotateZ(rollRad || 0)));
    } else {
      m = M.rotateY(yawRad || 0);
    }
    if (s !== undefined && s !== 1) {
      m = M.multiply(m, M.scale(s, s, s));
    }
    m[12] = pos[0]; m[13] = pos[1]; m[14] = pos[2];
    return m;
  };

  /* +Z を dir に むけた 行列 */
  M.orient = function (pos, dir, upHint) {
    var z = V.norm(dir);
    var up = upHint || [0, 1, 0];
    var x = V.cross(up, z);
    var xl = Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
    if (xl < 1e-4) x = V.cross([1, 0, 0], z);
    x = V.norm(x);
    var y = V.norm(V.cross(z, x));
    return new Float32Array([
      x[0], x[1], x[2], 0,
      y[0], y[1], y[2], 0,
      z[0], z[1], z[2], 0,
      pos[0], pos[1], pos[2], 1
    ]);
  };

  /* p0 から p1 へ のびる 骨の 行列（骨は 原点から -Y 方向に つくる） */
  M.bone = function (p0, p1, upHint) {
    var d = V.sub(p1, p0);
    var len = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) || 1e-5;
    var yA = [-d[0] / len, -d[1] / len, -d[2] / len];
    var h = upHint || [0, 0, 1];
    var xA = V.cross(h, yA);
    var xl = Math.sqrt(xA[0] * xA[0] + xA[1] * xA[1] + xA[2] * xA[2]);
    if (xl < 1e-4) { xA = V.cross([1, 0, 0], yA); }
    xA = V.norm(xA);
    var zA = V.norm(V.cross(xA, yA));
    return new Float32Array([
      xA[0], xA[1], xA[2], 0,
      yA[0], yA[1], yA[2], 0,
      zA[0], zA[1], zA[2], 0,
      p0[0], p0[1], p0[2], 1
    ]);
  };

  /* 2関節の 逆運動学。肩(s)から 目標(t)へ、長さ a・b の腕。
     pole は ひじを 曲げたい がわ。 */
  M.ik2 = function (s, t, a, b, pole) {
    var u = V.sub(t, s);
    var d = Math.sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
    var maxD = a + b - 0.02, minD = Math.abs(a - b) + 0.02;
    var clamped = U.clamp(d, minD, maxD);
    var un = [u[0] / (d || 1), u[1] / (d || 1), u[2] / (d || 1)];
    var end = [s[0] + un[0] * clamped, s[1] + un[1] * clamped, s[2] + un[2] * clamped];
    var cosA = U.clamp((a * a + clamped * clamped - b * b) / (2 * a * clamped), -1, 1);
    var alpha = Math.acos(cosA);
    var n = V.cross(un, pole);
    var nl = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
    if (nl < 1e-4) { n = V.cross(un, [0, 1, 0]); }
    n = V.norm(n);
    var w = V.norm(V.cross(n, un));
    var ca = Math.cos(alpha) * a, sa = Math.sin(alpha) * a;
    return {
      elbow: [s[0] + un[0] * ca + w[0] * sa,
              s[1] + un[1] * ca + w[1] * sa,
              s[2] + un[2] * ca + w[2] * sa],
      end: end
    };
  };

  U.M = M;

  /* 角度を -180..180 に */
  U.wrapDeg = function (d) {
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };
  /* 角度を なめらかに 追う */
  U.approachAngle = function (cur, target, rate, dt) {
    var d = U.wrapDeg(target - cur);
    return cur + d * (1 - Math.exp(-rate * dt));
  };
  U.approach = function (cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  };

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
