import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const smoothstep = THREE.MathUtils.smoothstep;
export const TAU = Math.PI * 2;

/**
 * Frame-rate independent exponential approach. `rate` ~ how fast, in 1/sec.
 * The blend factor is clamped to [0,1] so a bad time step can never push a
 * value away from its target instead of toward it.
 */
export function approach(rate, dt) {
  return dt > 0 ? 1 - Math.exp(-rate * dt) : 0;
}

export function damp(current, target, rate, dt) {
  return current + (target - current) * approach(rate, dt);
}

export function dampAngle(current, target, rate, dt) {
  let d = target - current;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return current + d * approach(rate, dt);
}

export const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  in: (t) => t * t * t,
  /** Overshoots then settles — used for the arm snapping to the offer pose. */
  outBack: (t, s = 1.5) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  /** A soft landing bob. */
  outElastic: (t) =>
    t === 0 || t === 1
      ? t
      : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};

/* ---------- geometry helpers ---------- */

export { RoundedBoxGeometry, mergeGeometries };

/**
 * A tapered, softly-bent limb: rounded at both ends, thicker at the root.
 * Used for arms, legs, branches and the hawk's tarsi.
 */
export function limbGeometry(len, rTop, rBot, seg = 10, radial = 12, bend = 0) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    // Rounded caps via a sine profile blended into the linear taper.
    const r = lerp(rBot, rTop, t) * Math.sin(Math.acos(clamp(t * 2 - 1, -1, 1)) * 0.5 + 0.0001) ** 0.35;
    pts.push(new THREE.Vector2(Math.max(r, 0.001), t * len));
  }
  const g = new THREE.LatheGeometry(pts, radial);
  if (bend !== 0) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const t = y / len;
      p.setX(i, p.getX(i) + bend * t * t * len);
    }
    g.computeVertexNormals();
  }
  return g;
}

/** Capsule-ish blob defined by a radius profile — the workhorse for bodies. */
export function blobGeometry(len, profile, seg = 20, radial = 18) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    pts.push(new THREE.Vector2(Math.max(profile(t), 0.0008), t * len));
  }
  return new THREE.LatheGeometry(pts, radial);
}

/**
 * One feather: a tapered vane with a rounded tip, cambered along its length and
 * slightly cupped across it, so it catches light like a real quill rather than
 * reading as a flat card.
 */
export function featherGeometry(len, width, opts = {}) {
  const { camber = 0.16, cup = 0.35, tip = 0.24, root = 0.42, slot = 0 } = opts;
  const nl = 10,
    nw = 5;
  const g = new THREE.PlaneGeometry(1, 1, nw, nl);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5; // 0..1 across the vane
    const v = p.getY(i) + 0.5; // 0..1 root -> tip
    // Width profile: narrow at the quill, widest at 45%, rounded off at the tip.
    let w = width * (root + (1 - root) * Math.sin(Math.pow(v, 0.75) * Math.PI));
    if (slot > 0) w *= 1 - slot * Math.pow(v, 3.0); // emarginated primary tips
    const x = (u - 0.5) * w;
    const y = v * len;
    // Camber down the shaft + cup across the vane.
    const z = -camber * len * v * v - cup * Math.abs(u - 0.5) * Math.abs(u - 0.5) * w * 2.4;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/** Thin strap (jesses, leash, trim) with a little sag baked in. */
export function strapGeometry(len, width, thick, sag = 0.15) {
  const g = new RoundedBoxGeometry(width, len, thick, 2, Math.min(thick, width) * 0.45);
  g.translate(0, -len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = clamp(-p.getY(i) / len, 0, 1);
    p.setZ(i, p.getZ(i) + sag * len * t * t);
  }
  g.computeVertexNormals();
  return g;
}

/* ---------- tiny scheduler ---------- */

/** A cue list: run callbacks at times along a sequence, plus per-frame updates. */
export class Timeline {
  constructor() {
    this.t = 0;
    this.cues = [];
    this.done = false;
    this.duration = 0;
  }
  at(time, fn) {
    this.cues.push({ time, fn, fired: false });
    this.duration = Math.max(this.duration, time);
    return this;
  }
  hold(time) {
    this.duration = Math.max(this.duration, time);
    return this;
  }
  update(dt) {
    this.t += dt;
    for (const c of this.cues) {
      if (!c.fired && this.t >= c.time) {
        c.fired = true;
        c.fn();
      }
    }
    if (!this.done && this.t >= this.duration) this.done = true;
    return this.t;
  }
}

/* ---------- misc ---------- */

const _v = new THREE.Vector3();

/** Point a group along `dir` with an optional bank (roll) about that axis. */
export function orientAlong(obj, dir, up, bank = 0) {
  _v.copy(dir);
  if (_v.lengthSq() < 1e-8) return;
  _v.normalize();
  const m = new THREE.Matrix4();
  const right = new THREE.Vector3().crossVectors(up, _v);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const realUp = new THREE.Vector3().crossVectors(_v, right).normalize();
  m.makeBasis(right, realUp, _v);
  obj.quaternion.setFromRotationMatrix(m);
  if (bank !== 0) obj.rotateZ(bank);
}

export function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
