/* =========================================================================
   util.js — 数学・補間・入力ジェスチャの小道具
   ========================================================================= */
(function (global) {
  'use strict';

  var U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.inv = function (a, b, v) { return b === a ? 0 : (v - a) / (b - a); };
  U.sat = function (v) { return v < 0 ? 0 : (v > 1 ? 1 : v); };
  U.smooth = function (a, b, v) { var t = U.sat(U.inv(a, b, v)); return t * t * (3 - 2 * t); };
  U.mix = function (a, b, t) { return a + (b - a) * t; };

  // フレームレート非依存の指数追従
  U.damp = function (cur, goal, lambda, dt) {
    return U.lerp(cur, goal, 1 - Math.exp(-lambda * dt));
  };
  U.dampV = function (cur, goal, lambda, dt) {
    var k = 1 - Math.exp(-lambda * dt);
    cur.x += (goal.x - cur.x) * k;
    cur.y += (goal.y - cur.y) * k;
    cur.z += (goal.z - cur.z) * k;
    return cur;
  };

  U.easeOut = function (t) { t = U.sat(t); return 1 - Math.pow(1 - t, 3); };
  U.easeIn = function (t) { t = U.sat(t); return t * t * t; };
  U.easeInOut = function (t) { t = U.sat(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  U.easeBack = function (t) {
    t = U.sat(t); var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  U.easeElastic = function (t) {
    t = U.sat(t); if (t === 0 || t === 1) return t;
    var c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };

  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  // 決定的な擬似乱数（テクスチャ生成用）
  U.mulberry = function (seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  // 角度差を -PI..PI に畳む
  U.angDelta = function (a, b) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  // 3D 点 → 画面ピクセル座標
  var _p = null;
  U.toScreen = function (vec3, camera, w, h, out) {
    if (!_p) _p = new THREE.Vector3();
    _p.copy(vec3).project(camera);
    out = out || {};
    out.x = (_p.x * 0.5 + 0.5) * w;
    out.y = (-_p.y * 0.5 + 0.5) * h;
    out.z = _p.z;
    return out;
  };

  /* -----------------------------------------------------------------------
     Pointer — 1本指のみを追跡する素直な入力層。
     iOS Safari のスクロール／ズーム／長押しメニューを完全に殺す。
  ----------------------------------------------------------------------- */
  U.Pointer = function (el) {
    var self = this;
    this.el = el;
    this.down = false;
    this.id = null;
    this.x = 0; this.y = 0;          // 現在位置(px)
    this.px = 0; this.py = 0;        // 前フレーム位置
    this.dx = 0; this.dy = 0;        // このフレームの移動量
    this.sx = 0; this.sy = 0;        // 押し始めた位置
    this.downTime = 0;
    this.travel = 0;                 // 押してからの総移動距離
    this.speed = 0;                  // px/s
    this.justDown = false;
    this.justUp = false;
    this.tapped = false;             // 直近の up がタップだったか
    this.holdTime = 0;
    this.listeners = { down: [], move: [], up: [] };

    function pos(e) {
      var r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function emit(kind) {
      var L = self.listeners[kind];
      for (var i = 0; i < L.length; i++) L[i](self);
    }

    this._onDown = function (e) {
      if (self.down) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      self.down = true; self.id = e.pointerId;
      var p = pos(e);
      self.x = self.px = self.sx = p.x;
      self.y = self.py = self.sy = p.y;
      self.dx = self.dy = 0; self.travel = 0; self.speed = 0;
      self.downTime = performance.now(); self.holdTime = 0;
      self.justDown = true; self.tapped = false;
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) { } }
      emit('down');
      e.preventDefault();
    };
    this._onMove = function (e) {
      if (!self.down || e.pointerId !== self.id) return;
      var p = pos(e);
      self.x = p.x; self.y = p.y;
      emit('move');
      e.preventDefault();
    };
    this._onUp = function (e) {
      if (!self.down || (self.id !== null && e.pointerId !== self.id)) return;
      self.down = false; self.id = null;
      self.justUp = true;
      self.tapped = (self.travel < 26 && performance.now() - self.downTime < 520);
      emit('up');
    };

    el.addEventListener('pointerdown', this._onDown, { passive: false });
    window.addEventListener('pointermove', this._onMove, { passive: false });
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

    // 毎フレーム末尾で呼ぶ
    this.tick = function (dt) {
      this.dx = this.x - this.px;
      this.dy = this.y - this.py;
      var d = Math.hypot(this.dx, this.dy);
      this.travel += d;
      this.speed = dt > 0 ? d / dt : 0;
      this.px = this.x; this.py = this.y;
      if (this.down) this.holdTime += dt;
      else this.holdTime = 0;
    };
    this.endFrame = function () {
      this.justDown = false; this.justUp = false;
    };
    this.on = function (kind, fn) { this.listeners[kind].push(fn); };
  };

  /* -----------------------------------------------------------------------
     CircleTracker — 「指でぐるぐる」を検出する。
     4歳児のいい加減な円でも回るよう、往復するだけでも回転量を稼げるように
     角度差の絶対値を積算する。
  ----------------------------------------------------------------------- */
  U.CircleTracker = function () {
    this.cx = 0; this.cy = 0;
    this.last = 0;
    this.active = false;
    this.turns = 0;   // 累積回転量(rad, 常に正)

    this.setCenter = function (x, y) { this.cx = x; this.cy = y; };
    this.begin = function (x, y) {
      this.last = Math.atan2(y - this.cy, x - this.cx);
      this.active = true;
    };
    this.update = function (x, y) {
      if (!this.active) return 0;
      var vx = x - this.cx, vy = y - this.cy;
      var r = Math.hypot(vx, vy);
      if (r < 6) return 0;                      // 中心付近は角度が暴れるので無視
      var a = Math.atan2(vy, vx);
      var d = U.angDelta(this.last, a);
      this.last = a;
      if (Math.abs(d) > 2.6) return 0;          // 極端な飛びだけ棄却
      this.turns += Math.abs(d);
      return d;
    };
    this.end = function () { this.active = false; };
  };

  global.U = U;
})(window);
