// Small math / timing helpers shared across the game.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

// Framerate independent exponential smoothing.
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const smoothstep = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInCubic = (t) => Math.pow(clamp(t, 0, 1), 3);
export const easeInOutCubic = (t) =>
  (t = clamp(t, 0, 1)) < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  t = clamp(t, 0, 1);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t) => {
  t = clamp(t, 0, 1);
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

// Deterministic PRNG so a "round layout" can be reproduced / varied on purpose.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const r = mulberry32(seed);
  const fn = r;
  fn.range = (a, b) => a + (b - a) * r();
  fn.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  fn.pick = (arr) => arr[Math.floor(r() * arr.length) % arr.length];
  fn.sign = () => (r() < 0.5 ? -1 : 1);
  fn.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return fn;
}

/**
 * Critically-ish damped 1D spring. Used everywhere for "soft toy" secondary motion:
 * limbs lagging behind the body, squash recovering, the pendulum under the claw.
 */
export class Spring {
  constructor(stiffness = 120, damping = 12, value = 0) {
    this.k = stiffness;
    this.d = damping;
    this.value = value;
    this.vel = 0;
  }
  set(v) { this.value = v; this.vel = 0; }
  /** @param {number} dt @param {number} target @param {number} [force] external accel */
  update(dt, target, force = 0) {
    // sub-step so large dt spikes (tab switch) cannot explode the spring
    const steps = dt > 1 / 45 ? Math.min(4, Math.ceil(dt * 60)) : 1;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = (target - this.value) * this.k - this.vel * this.d + force;
      this.vel += a * h;
      this.value += this.vel * h;
    }
    return this.value;
  }
}

export function nowSec() { return performance.now() / 1000; }
