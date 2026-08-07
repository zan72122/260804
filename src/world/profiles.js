// Bell silhouettes and the family of surfaces derived from them.
//
// The whole game is one axis of revolution.  Every skin in the pipeline --
// core, false bell, outer mould, and finally the bell itself -- is the same
// silhouette offset by a real wall thickness, which is what makes the causal
// chain readable: you can see the core inside the false bell inside the mould.
//
// Units are metres.  These are big bells: ~1.8 m across the mouth.

import { sampleCurve, clamp01, lerp, smoothstep, angNoise } from '../core/util.js';

const P = (t, r) => ({ t, r });

export const SHAPES = {
  // Western tulip bell -- flared sound bow, waisted shoulder.
  tulip: {
    key: 'tulip',
    voice: 'tulip',
    height: 2.10,
    rim: 0.90,
    outer: [
      P(0.000, 0.900), P(0.035, 0.905), P(0.075, 0.885), P(0.130, 0.820),
      P(0.220, 0.735), P(0.330, 0.680), P(0.450, 0.648), P(0.580, 0.620),
      P(0.700, 0.586), P(0.800, 0.532), P(0.880, 0.446), P(0.940, 0.330),
      P(0.980, 0.230), P(1.000, 0.190),
    ],
    wall: [P(0.0, 0.135), P(0.06, 0.128), P(0.16, 0.098), P(0.35, 0.072),
           P(0.62, 0.062), P(0.85, 0.058), P(1.0, 0.070)],
    // decorations sit on the smooth waist, away from the sound bow
    decorBand: [0.30, 0.80],
    crown: 'ring',
  },

  // Japanese temple bell (梵鐘) -- near-cylindrical barrel, domed 笠形 crown.
  temple: {
    key: 'temple',
    voice: 'temple',
    height: 2.40,
    rim: 0.855,
    outer: [
      P(0.000, 0.855), P(0.040, 0.860), P(0.090, 0.852), P(0.200, 0.836),
      P(0.350, 0.818), P(0.500, 0.800), P(0.640, 0.782), P(0.760, 0.760),
      P(0.845, 0.722), P(0.900, 0.650), P(0.945, 0.520), P(0.975, 0.360),
      P(1.000, 0.235),
    ],
    wall: [P(0.0, 0.150), P(0.05, 0.146), P(0.18, 0.112), P(0.40, 0.088),
           P(0.68, 0.078), P(0.88, 0.080), P(1.0, 0.110)],
    decorBand: [0.22, 0.78],
    crown: 'dragon',
  },

  // Squat round bell -- wide, soft-shouldered, bright.
  squat: {
    key: 'squat',
    voice: 'squat',
    height: 1.75,
    rim: 0.98,
    outer: [
      P(0.000, 0.980), P(0.045, 0.985), P(0.110, 0.972), P(0.200, 0.938),
      P(0.320, 0.884), P(0.450, 0.818), P(0.570, 0.744), P(0.690, 0.652),
      P(0.790, 0.556), P(0.870, 0.446), P(0.935, 0.322), P(0.975, 0.226),
      P(1.000, 0.185),
    ],
    wall: [P(0.0, 0.128), P(0.07, 0.120), P(0.20, 0.092), P(0.42, 0.070),
           P(0.66, 0.062), P(0.86, 0.060), P(1.0, 0.072)],
    decorBand: [0.26, 0.76],
    crown: 'loop',
  },
};

export const SHAPE_KEYS = ['tulip', 'temple', 'squat'];

/* --------------------------- surface families --------------------------- */

/** outer radius of the finished bell at normalised height t (0 = rim) */
export function outerR(shape, t) { return sampleCurve(shape.outer, clamp01(t)); }

/** metal wall thickness at t */
export function wallAt(shape, t) { return sampleCurve(shape.wall, clamp01(t)); }

/** inner radius -- this is exactly the surface of the core mould */
export function innerR(shape, t) {
  return Math.max(0.045, outerR(shape, t) - wallAt(shape, t));
}

/** The core (芯型) is capped a little below the crown -- the bell's head is solid-ish. */
export function coreR(shape, t) {
  const r = innerR(shape, t);
  // close the core to a neck near the top so it reads as a solid plug
  const closeAt = 0.86;
  if (t <= closeAt) return r;
  const u = (t - closeAt) / (1 - closeAt);
  return lerp(r, 0.055, smoothstep(0, 1, u));
}

/** thickness of the outer mould (外型) shell */
export function moldWall(t) { return lerp(0.24, 0.17, smoothstep(0, 1, t)); }

/** total height of the outer mould, including the cope above the bell */
export function moldHeight(shape) { return shape.height + 0.42; }

/**
 * Target radius of the outer mould surface, over its OWN normalised height
 * u (0 at the flask floor, 1 at the top of the cope).  It follows the bell to
 * the crown, then curves in to the sprue mouth.
 */
export function moldR(shape, u) {
  const H = moldHeight(shape);
  const y = u * H;
  const bellTop = shape.height;
  if (y <= bellTop) {
    const t = y / bellTop;
    return outerR(shape, t) + moldWall(t);
  }
  const v = clamp01((y - bellTop) / (H - bellTop));
  const r0 = outerR(shape, 1) + moldWall(1);
  return lerp(r0, SPRUE_R, smoothstep(0, 1, v * 0.92 + 0.08 * v * v));
}

/** radius of the pour opening on top of the mould */
export const SPRUE_R = 0.185;

/**
 * Inner face of the outer mould -- i.e. the wall of the cavity the bronze
 * fills.  Below the crown this is exactly the bell's outer surface, which is
 * the whole point of the false-bell method.
 */
export function moldInnerR(shape, u) {
  const H = moldHeight(shape);
  const y = u * H;
  const bellTop = shape.height;
  if (y <= bellTop) return outerR(shape, y / bellTop);
  const v = clamp01((y - bellTop) / (H - bellTop));
  return lerp(outerR(shape, 1), SPRUE_R * 0.6, smoothstep(0, 1, v));
}

/**
 * The raw lump of clay the player starts with: oversized, lopsided, lumpy.
 * `k` (0..1) morphs it toward the target profile.
 */
export function blobR(shape, t, theta, seed = 0) {
  const base = coreR(shape, t);
  const swell = 0.19 + 0.10 * Math.sin(t * 4.1 + seed);
  const lump =
    0.100 * angNoise(theta * 1.0 + t * 1.5, seed, 2) +
    0.048 * angNoise(theta * 1.9 - t * 2.6, seed + 3.1, 2);
  return Math.max(0.05, base + swell + lump);
}

/** lump of clay for the false bell layer, over the core */
export function falseBlobR(shape, t, theta, seed = 0) {
  const base = outerR(shape, t);
  const swell = 0.155 + 0.08 * Math.cos(t * 3.3 + seed * 1.7);
  const lump =
    0.078 * angNoise(theta * 1.1 - t * 1.7, seed + 1.9, 2) +
    0.038 * angNoise(theta * 2.1 + t * 2.4, seed + 5.3, 2);
  return Math.max(0.06, base + swell + lump);
}

/** surface normal in the (radial, y) plane, from the profile slope */
export function profileNormal(fn, t, H, eps = 0.006) {
  const t0 = Math.max(0, t - eps), t1 = Math.min(1, t + eps);
  const dr = fn(t1) - fn(t0);
  const dy = (t1 - t0) * H;
  const len = Math.hypot(dr, dy) || 1;
  return { nr: dy / len, ny: -dr / len };
}

/** world position of a point on a bell surface */
export function surfacePoint(shape, fn, t, theta, out) {
  const r = fn(t), y = t * shape.height;
  out.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
  return out;
}
