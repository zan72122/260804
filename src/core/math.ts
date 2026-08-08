/** Small math helpers shared across the world modules. */

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp((v - a) / (b - a), 0, 1);

export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

export const smootherstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/**
 * Frame-rate independent exponential approach.
 * `rate` is roughly "how many e-folds per second".
 */
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  target + (current - target) * Math.exp(-rate * dt);

/** Deterministic PRNG so a "field seed" reproduces the same bog. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  (): number;
  range(a: number, b: number): number;
  int(a: number, b: number): number;
  pick<T>(arr: readonly T[]): T;
  /** Bell-ish distribution in 0..1 — nicer for natural variation. */
  bell(): number;
}

export function rng(seed: number): Rng {
  const base = makeRng(seed);
  const r = (() => base()) as Rng;
  r.range = (a, b) => a + base() * (b - a);
  r.int = (a, b) => Math.floor(a + base() * (b - a + 1));
  r.pick = (arr) => arr[Math.floor(base() * arr.length) % arr.length];
  r.bell = () => (base() + base() + base()) / 3;
  return r;
}

/** Cheap 2D value noise — used for bog floor, wave detail and vine scatter. */
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (a: number, b: number): number => {
    let n = a * 374761393 + b * 668265263;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
