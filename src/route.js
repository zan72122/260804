// The search route.
//
// A 4-year-old should never be lost, so movement runs on a rail: a smooth curve
// from the front door to the kitten's hiding place. Corners steer themselves,
// which leaves the player's whole attention on the one thing that matters —
// getting low and staying low.

import * as THREE from '../vendor/three.module.js';

const WAYPOINTS = [
  [0.00, 2.35],
  [0.00, 1.25],
  [0.00, 0.20],
  [-0.10, -0.80],
  [-0.55, -1.95],
  [-1.30, -3.05],
  [-2.20, -4.10],
  [-3.40, -4.52],
  [-4.60, -4.58],
  [-5.60, -4.40],
  [-6.28, -4.52],
];

export function buildRoute() {
  const pts = WAYPOINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
  const length = curve.getLength();
  const lut = curve.getSpacedPoints(400);

  return {
    curve,
    length,
    /** World position at arc-length s (metres from the door). */
    at(s) {
      return curve.getPointAt(THREE.MathUtils.clamp(s / length, 0, 1));
    },
    /** Unit tangent at arc-length s. */
    tangentAt(s) {
      return curve.getTangentAt(THREE.MathUtils.clamp(s / length, 0, 1)).normalize();
    },
    lut,
  };
}

/** Things hidden along the way, keyed by arc-length so the HUD can hint. */
export const FINDS = {
  teddy: { pos: new THREE.Vector3(0.44, 0, -1.92), s: 4.6, radius: 1.35 },
  kitten: { pos: new THREE.Vector3(-7.02, 0, -4.44), s: 12.6, radius: 1.55 },
};
