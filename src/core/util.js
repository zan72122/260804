// Small math / helper toolbox shared by every stage.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const TAU = Math.PI * 2;

/** shortest signed angular difference b-a, in (-PI, PI] */
export function angDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** frame-rate independent exponential approach */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** deterministic hash noise in [0,1) */
export function hash1(n) {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}
export function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** smooth periodic value noise over an angle (seamless around TAU) */
export function angNoise(theta, seed, octaves = 3) {
  let v = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * Math.sin(theta * freq * 3 + seed * 7.7 + i * 2.1) *
         Math.cos(theta * freq * 2 - seed * 3.3 + i * 1.3);
    norm += amp;
    amp *= 0.55; freq *= 2.1;
  }
  return v / norm; // roughly -1..1
}

/** seeded PRNG (mulberry32) */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Catmull-Rom sample over an array of {t, r} control points (t ascending, 0..1) */
export function sampleCurve(pts, t) {
  const n = pts.length;
  if (t <= pts[0].t) return pts[0].r;
  if (t >= pts[n - 1].t) return pts[n - 1].r;
  let i = 0;
  while (i < n - 2 && pts[i + 1].t < t) i++;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
  const u = (t - p1.t) / (p2.t - p1.t);
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (
    2 * p1.r +
    (-p0.r + p2.r) * u +
    (2 * p0.r - 5 * p1.r + 4 * p2.r - p3.r) * u2 +
    (-p0.r + 3 * p1.r - 3 * p2.r + p3.r) * u3
  );
}

/** simple event emitter */
export class Emitter {
  constructor() { this._m = new Map(); }
  on(k, fn) { if (!this._m.has(k)) this._m.set(k, new Set()); this._m.get(k).add(fn); return () => this.off(k, fn); }
  off(k, fn) { const s = this._m.get(k); if (s) s.delete(fn); }
  emit(k, ...a) { const s = this._m.get(k); if (s) for (const fn of [...s]) fn(...a); }
}
