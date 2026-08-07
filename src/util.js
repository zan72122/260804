// 汎用の数学ユーティリティ。依存なし。
// Small math helpers shared by the fold engine, the resist baker and the renderer.

export const TAU = Math.PI * 2;

export function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
export function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function invLerp(a, b, x) { return (x - a) / (b - a || 1e-9); }
export function mix(a, b, t) { return a + (b - a) * t; }

export function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-9));
  return t * t * (3 - 2 * t);
}
export function smootherstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-9));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
export function easeInOut(t) {
  t = clamp01(t);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) * 0.5;
}
export function easeOutCubic(t) { t = clamp01(t); const u = 1 - t; return 1 - u * u * u; }
export function easeInCubic(t) { t = clamp01(t); return t * t * t; }
export function easeOutBack(t) {
  t = clamp01(t);
  const c1 = 1.70158, c3 = c1 + 1, u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

// 指数的な追従（フレームレート非依存）
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const r = mulberry32(seed);
  const fn = () => r();
  fn.range = (a, b) => a + (b - a) * r();
  fn.int = (a, b) => Math.floor(a + (b - a + 1) * r()) > b ? b : Math.floor(a + (b - a + 1) * r());
  fn.pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
  fn.chance = (p) => r() < p;
  fn.sign = () => (r() < 0.5 ? -1 : 1);
  return fn;
}

// ---- value noise -----------------------------------------------------------

function hash2i(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2i(xi, yi), b = hash2i(xi + 1, yi);
  const c = hash2i(xi, yi + 1), d = hash2i(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm2(x, y, octaves = 4, lac = 2.03, gain = 0.5) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / (norm || 1);
}

// signed, roughly [-1,1]
export function snoise2(x, y) { return valueNoise2(x, y) * 2 - 1; }

// ---- misc ------------------------------------------------------------------

export function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

export function now() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

export function isCoarsePointer() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

export function detectMobile() {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  return iOS || android || isCoarsePointer();
}
