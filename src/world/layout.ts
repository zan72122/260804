/**
 * The bog's fixed geography plus the per-playthrough variation.
 *
 * The *verbs* never change (flood → churn → float → corral → suck), only the
 * flavour: bog outline, berry density, colour mix, sky, truck paint, wave
 * character and where the last few berries end up floating.
 */

import * as THREE from 'three';
import { rng, type Rng } from '../core/math';

/** Bog floor is y = 0; everything is measured from there. */
export const FLOOR_Y = 0;
/** Water height before the gate opens — a puddle in the lowest corner only. */
export const WATER_DRY = -0.27;
/** Water height once flooded: vines fully under, berries have room to rise. */
export const WATER_FULL = 1.08;

/**
 * Berries are exaggerated roughly ten-fold against the machinery. That is a
 * deliberate trade: at true scale the flooded bog would read as pink haze,
 * and the whole point of the reveal is a surface that turns red.
 */
export const BERRY_R = 0.24;

export interface FieldVariant {
  seed: number;
  /** Bog half-extents in x / z. */
  halfX: number;
  halfZ: number;
  /** Corner rounding of the bog outline, in world units. */
  corner: number;
  berryCount: number;
  /** Fraction of berries that are pale/blush "white cranberries". */
  paleRatio: number;
  skyTop: THREE.Color;
  skyBottom: THREE.Color;
  sunColor: THREE.Color;
  waterTint: THREE.Color;
  truckColor: THREE.Color;
  /** Wave amplitude / frequency character for this day. */
  waveAmp: number;
  waveFreq: number;
  /** Suggested first sweep direction for the reel hint. */
  reelStart: THREE.Vector2;
  rng: Rng;
}

const SKIES: Array<[string, string, string]> = [
  ['#6fb3d0', '#dff0f2', '#ffd9a3'], // clear afternoon
  ['#7ba8c9', '#f6e2c8', '#ffcb8f'], // hazy autumn
  ['#5f9fb8', '#e8eddc', '#ffe0ae'], // crisp morning
  ['#8fb6c6', '#ffe6cf', '#ffc98a'], // soft overcast
];

const TRUCKS = ['#e8734a', '#4f9ad6', '#e2b83f', '#8f6fc4', '#5fb98a'];

export function makeVariant(seed: number): FieldVariant {
  const r = rng(seed);
  const sky = r.pick(SKIES);
  const halfX = r.range(10.5, 12);
  const halfZ = r.range(8.5, 9.8);
  return {
    seed,
    halfX,
    halfZ,
    corner: r.range(1.8, 3.6),
    berryCount: 0, // filled by the berry field from the quality profile
    paleRatio: r.range(0.015, 0.05),
    skyTop: new THREE.Color(sky[0]),
    skyBottom: new THREE.Color(sky[1]),
    sunColor: new THREE.Color(sky[2]),
    waterTint: new THREE.Color().setHSL(r.range(0.47, 0.53), r.range(0.34, 0.46), r.range(0.2, 0.27)),
    truckColor: new THREE.Color(r.pick(TRUCKS)),
    waveAmp: r.range(0.028, 0.055),
    waveFreq: r.range(0.28, 0.42),
    reelStart: new THREE.Vector2(r.range(-0.6, 0.6), r.range(-0.6, 0.6)).normalize(),
    rng: r,
  };
}

/**
 * Signed "insideness" of the rounded-rectangle bog: 1 deep inside,
 * 0 at the shoreline, negative outside. Used for flooding, vine scatter,
 * berry containment and the reel's soft walls.
 */
export function bogInset(v: FieldVariant, x: number, z: number): number {
  const ax = Math.abs(x) - (v.halfX - v.corner);
  const az = Math.abs(z) - (v.halfZ - v.corner);
  const qx = Math.max(ax, 0);
  const qz = Math.max(az, 0);
  const outside = Math.hypot(qx, qz) - v.corner;
  const inside = Math.min(Math.max(ax, az), 0) - v.corner;
  return -(outside + inside); // positive = inside, in world units from edge
}

/** Push a point back inside the bog with a soft margin. */
export function clampToBog(v: FieldVariant, p: THREE.Vector2, margin: number): void {
  const limX = v.halfX - margin;
  const limZ = v.halfZ - margin;
  p.x = Math.max(-limX, Math.min(limX, p.x));
  p.y = Math.max(-limZ, Math.min(limZ, p.y));
  // round the corners so the reel cannot sit in an impossible pocket
  const cx = Math.max(Math.abs(p.x) - (limX - v.corner), 0);
  const cz = Math.max(Math.abs(p.y) - (limZ - v.corner), 0);
  const d = Math.hypot(cx, cz);
  if (d > v.corner) {
    const k = v.corner / d;
    p.x = Math.sign(p.x) * (limX - v.corner + cx * k);
    p.y = Math.sign(p.y) * (limZ - v.corner + cz * k);
  }
}

/**
 * The bog floor is not flat: it dips toward the near-left so the flooding
 * front has somewhere to start from and reads as water *finding* the low
 * ground rather than a plane sliding upward.
 */
export function floorHeight(v: FieldVariant, x: number, z: number): number {
  const nx = x / v.halfX;
  const nz = z / v.halfZ;
  return -0.06 + 0.19 * (nx * 0.45 + nz * 0.55) + 0.05 * Math.sin(nx * 4.1) * Math.cos(nz * 3.3);
}

/** Sluice gate sits at the far edge, slightly left of centre. */
export function gatePosition(v: FieldVariant): THREE.Vector3 {
  return new THREE.Vector3(-v.halfX * 0.36, 0, -v.halfZ - 1.1);
}

/** Truck + pump station wait on the near berm, to the right. */
export function truckPosition(v: FieldVariant): THREE.Vector3 {
  return new THREE.Vector3(v.halfX * 0.55, 0, v.halfZ + 5.4);
}
