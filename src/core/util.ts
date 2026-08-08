/** Small math / random helpers shared by every subsystem. */

export const TAU = Math.PI * 2;

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix = lerp;
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));

/** Frame-rate independent exponential approach. `speed` ~ how fast, in 1/sec. */
export const damp = (cur: number, target: number, speed: number, dt: number) =>
  lerp(cur, target, 1 - Math.exp(-speed * dt));

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t: number) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c4 = TAU / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** Shortest signed angular difference, result in (-PI, PI]. */
export function angleDelta(from: number, to: number) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Deterministic PRNG (mulberry32) so a seed reproduces a whole specimen. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return rng;
}

export type Rng = () => number;
export const rand = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const randInt = (r: Rng, a: number, b: number) => Math.floor(a + (b - a + 1) * r());
export const pick = <T>(r: Rng, arr: readonly T[]) => arr[Math.floor(r() * arr.length) % arr.length];

/** 1D value noise, cheap and smooth — used for ribbon waviness. */
export function noise1(x: number, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    let t = (n * 374761393 + seed * 668265263) | 0;
    t = (t ^ (t >>> 13)) * 1274126177;
    return (((t ^ (t >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}
