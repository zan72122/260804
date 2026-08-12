'use strict';
window.PPG = window.PPG || {};
(function (PPG) {
  const TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function map(v, a, b, c, d, noClamp) {
    let t = (v - a) / (b - a);
    if (!noClamp) t = clamp(t, 0, 1);
    return c + (d - c) * t;
  }
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeInOutCubic(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutBack(t) {
    t = clamp(t, 0, 1);
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeOutElastic(t) {
    t = clamp(t, 0, 1);
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -9 * t) * Math.sin((t * 8 - 0.75) * (TAU / 3)) + 1;
  }
  // smallest signed difference between two angles
  function angDiff(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }
  function lerpAngle(a, b, t) { return a + angDiff(a, b) * t; }

  // deterministic PRNG
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // deterministic 0..1 from two ints (stable across frames)
  function hash2(i, seed) {
    let h = (i * 374761393 + seed * 668265263) | 0;
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }

  function hsla(h, s, l, a) {
    h = ((h % 360) + 360) % 360;
    return 'hsla(' + h.toFixed(1) + ',' + clamp(s, 0, 100).toFixed(1) + '%,' +
      clamp(l, 0, 100).toFixed(1) + '%,' + clamp(a == null ? 1 : a, 0, 1).toFixed(3) + ')';
  }

  PPG.util = {
    TAU, clamp, lerp, map, dist, smoothstep,
    easeOutCubic, easeInOutCubic, easeOutBack, easeOutElastic,
    angDiff, lerpAngle, mulberry32, hash2, hsla
  };

  // global quality knobs (main.js adjusts these when fps drops)
  PPG.quality = { level: 1, particleMul: 1, glitterFlowers: 6, speckle: 1 };
})(window.PPG);
