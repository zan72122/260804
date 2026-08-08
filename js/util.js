/* =========================================================
   util.js — 数学 / 色 / 乱数 の小道具
   ========================================================= */
(function (global) {
  'use strict';

  const U = {};

  U.TAU = Math.PI * 2;

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

  /* 0..1 に正規化してから ease をかける便利関数
     range(v, a, b) → a以下で0, b以上で1 */
  U.range = (v, a, b) => U.clamp((v - a) / (b - a), 0, 1);

  U.smooth = (t) => {
    t = U.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.smoother = (t) => {
    t = U.clamp(t, 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  U.easeOut = (t) => 1 - Math.pow(1 - U.clamp(t, 0, 1), 3);
  U.easeIn = (t) => Math.pow(U.clamp(t, 0, 1), 3);
  U.easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    t = U.clamp(t, 0, 1);
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  U.easeOutElastic = (t) => {
    const c4 = (2 * Math.PI) / 3;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };

  /* 角度を -PI..PI に */
  U.wrapAngle = (a) => {
    while (a > Math.PI) a -= U.TAU;
    while (a < -Math.PI) a += U.TAU;
    return a;
  };
  U.angleLerp = (a, b, t) => a + U.wrapAngle(b - a) * t;

  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

  /* ---- 乱数（シード固定） ---- */
  U.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.rnd = Math.random;
  U.rr = (a, b) => a + Math.random() * (b - a);
  U.pick = (arr) => arr[(Math.random() * arr.length) | 0];

  /* ---- 色 ---- */
  U.hex2rgb = function (hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgb2css = (c, a) =>
    a === undefined
      ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
      : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  U.mixRgb = function (c1, c2, t) {
    return [
      U.lerp(c1[0], c2[0], t),
      U.lerp(c1[1], c2[1], t),
      U.lerp(c1[2], c2[2], t),
    ];
  };

  /* 多段グラデーションのサンプラ
     stops = [[pos, '#hex'], ...] (posは昇順) */
  U.ramp = function (stops) {
    const parsed = stops.map((s) => [s[0], U.hex2rgb(s[1])]);
    return function (t) {
      t = U.clamp(t, 0, 1);
      if (t <= parsed[0][0]) return parsed[0][1].slice();
      const last = parsed[parsed.length - 1];
      if (t >= last[0]) return last[1].slice();
      for (let i = 0; i < parsed.length - 1; i++) {
        const a = parsed[i], b = parsed[i + 1];
        if (t >= a[0] && t <= b[0]) {
          const k = (t - a[0]) / (b[0] - a[0]);
          return U.mixRgb(a[1], b[1], k);
        }
      }
      return last[1].slice();
    };
  };

  /* 明度を上げ下げ */
  U.shade = function (c, amt) {
    if (amt >= 0) return [U.lerp(c[0], 255, amt), U.lerp(c[1], 255, amt), U.lerp(c[2], 255, amt)];
    const a = -amt;
    return [U.lerp(c[0], 0, a), U.lerp(c[1], 0, a), U.lerp(c[2], 0, a)];
  };
  /* 彩度/暖色寄せ */
  U.warm = function (c, amt) {
    return [U.clamp(c[0] + 26 * amt, 0, 255), U.clamp(c[1] + 8 * amt, 0, 255), U.clamp(c[2] - 16 * amt, 0, 255)];
  };

  /* ---- 補間つきの値（ばね的に追従させる） ---- */
  U.approach = function (cur, target, rate, dt) {
    const k = 1 - Math.exp(-rate * dt);
    return cur + (target - cur) * k;
  };

  /* ---- 角丸矩形パス ---- */
  U.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  global.U = U;
})(window);
