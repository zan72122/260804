/* ------------------------------------------------------------------
   util.js — 数学・補間・乱数などの小道具
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = (window.PZ = window.PZ || {});
  const U = (PZ.util = {});

  const TAU = Math.PI * 2;
  U.TAU = TAU;

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.map = (v, a, b, c, d) => U.lerp(c, d, U.sat(U.inv(a, b, v)));
  U.smooth = (t) => { t = U.sat(t); return t * t * (3 - 2 * t); };
  U.smoother = (t) => { t = U.sat(t); return t * t * t * (t * (t * 6 - 15) + 10); };

  U.easeOut = (t) => 1 - Math.pow(1 - t, 3);
  U.easeIn = (t) => t * t * t;
  U.easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  U.easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
  U.easeOutBack = (t, s) => { s = s === undefined ? 1.6 : s; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
  U.easeOutElastic = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1);
  U.bump = (t) => Math.sin(U.sat(t) * Math.PI); // 0 -> 1 -> 0

  U.rand = (a, b) => (b === undefined ? Math.random() * (a === undefined ? 1 : a) : a + Math.random() * (b - a));
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  U.chance = (p) => Math.random() < p;
  U.sign = (v) => (v < 0 ? -1 : 1);

  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };

  U.angDiff = (a, b) => {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };

  /* フレームレート非依存の指数近似 */
  U.approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  U.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* 値ノイズ（1次元・滑らか） */
  const noiseTable = (function () {
    const r = U.mulberry32(1337);
    const t = new Float32Array(512);
    for (let i = 0; i < 512; i++) t[i] = r();
    return t;
  })();
  U.noise1 = function (x) {
    const i = Math.floor(x), f = x - i;
    const a = noiseTable[i & 511], b = noiseTable[(i + 1) & 511];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
  U.fbm1 = function (x) {
    return U.noise1(x) * 0.55 + U.noise1(x * 2.3 + 11.3) * 0.28 + U.noise1(x * 4.7 + 31.7) * 0.17;
  };

  /* 色 */
  U.rgba = (r, g, b, a) => 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')';
  U.mixColor = function (c1, c2, t) {
    return [
      U.lerp(c1[0], c2[0], t),
      U.lerp(c1[1], c2[1], t),
      U.lerp(c1[2], c2[2], t)
    ];
  };
  U.css = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')';

  /* 点列を滑らかな閉曲線としてパス化 */
  U.closedCurve = function (ctx, pts) {
    const n = pts.length;
    if (n < 3) return;
    let mx = (pts[n - 1][0] + pts[0][0]) / 2;
    let my = (pts[n - 1][1] + pts[0][1]) / 2;
    ctx.moveTo(mx, my);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  };

  /* 角の丸い長方形 */
  U.roundRect = function (ctx, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  U.ellipse = function (ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU);
  };

  /* 移動平均つきベクトル（指の速度など） */
  U.Smoothed = function (rate) {
    this.x = 0; this.y = 0; this.rate = rate || 18;
  };
  U.Smoothed.prototype.push = function (x, y, dt) {
    this.x = U.approach(this.x, x, this.rate, dt);
    this.y = U.approach(this.y, y, this.rate, dt);
  };

  U.now = () => (window.performance && performance.now ? performance.now() : Date.now());
})();
