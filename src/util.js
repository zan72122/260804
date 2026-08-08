// Small math / helper toolbox shared by every module.
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
export const easeInCubic = (t) => t * t * t;

/** Framerate independent approach of `a` toward `b`. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function dampV(v, target, lambda, dt) {
  const k = 1 - Math.exp(-lambda * dt);
  v.x += (target.x - v.x) * k;
  v.y += (target.y - v.y) * k;
  v.z += (target.z - v.z) * k;
  return v;
}

/**
 * Catmull-Rom style sampler over a sorted list of [t, value] control points.
 * Used for the tuna's body profile curves, so the silhouette stays smooth.
 */
export function curve(pts) {
  const n = pts.length;
  return function sample(t) {
    if (t <= pts[0][0]) return pts[0][1];
    if (t >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0;
    while (i < n - 2 && t > pts[i + 1][0]) i++;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const h = p2[0] - p1[0];
    const s = (t - p1[0]) / h;
    const m1 = ((p2[1] - p0[1]) / Math.max(1e-6, p2[0] - p0[0])) * h;
    const m2 = ((p3[1] - p1[1]) / Math.max(1e-6, p3[0] - p1[0])) * h;
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * p1[1] + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * p2[1] + (s3 - s2) * m2;
  };
}

/** Deterministic PRNG so the scene dressing is identical on every load. */
export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Smooth value noise in 1D — used for wobble, breathing, flicker. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = (n) => {
    let k = (n + seed * 374761393) | 0;
    k = Math.imul(k ^ (k >>> 15), 2246822519);
    k = Math.imul(k ^ (k >>> 13), 3266489917);
    return ((k ^ (k >>> 16)) >>> 0) / 4294967296;
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

/** Build an indexed grid geometry from a point function. `flip` reverses winding. */
export function buildGrid(pointFn, ni, nj, flip, attrFn) {
  const vc = (ni + 1) * (nj + 1);
  const pos = new Float32Array(vc * 3);
  const uv = new Float32Array(vc * 2);
  const col = new Float32Array(vc * 3);
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  const tmp = { uv: [0, 0] };
  for (let i = 0; i <= ni; i++) {
    const si = i / ni;
    for (let j = 0; j <= nj; j++) {
      const sj = j / nj;
      const k = i * (nj + 1) + j;
      p.set(0, 0, 0); c.setRGB(1, 1, 1); tmp.uv[0] = sj; tmp.uv[1] = si;
      pointFn(si, sj, p, c, tmp);
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      uv[k * 2] = tmp.uv[0]; uv[k * 2 + 1] = tmp.uv[1];
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      if (attrFn) attrFn(k, si, sj);
    }
  }
  const idx = [];
  for (let i = 0; i < ni; i++) {
    for (let j = 0; j < nj; j++) {
      const a = i * (nj + 1) + j, b = a + 1, d = a + (nj + 1), e = d + 1;
      if (flip) { idx.push(a, e, b, a, d, e); }
      else { idx.push(a, b, e, a, e, d); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Flip the winding if the geometry's average normal disagrees with the
 * expected outward direction. Saves a lot of by-hand index bookkeeping.
 */
export function orientGeometry(geom, expected) {
  const nrm = geom.getAttribute('normal');
  let sx = 0, sy = 0, sz = 0;
  for (let i = 0; i < nrm.count; i++) { sx += nrm.getX(i); sy += nrm.getY(i); sz += nrm.getZ(i); }
  if (sx * expected.x + sy * expected.y + sz * expected.z < 0) {
    const idx = geom.getIndex().array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    geom.getIndex().needsUpdate = true;
    geom.computeVertexNormals();
  }
  return geom;
}

const _up = new THREE.Vector3(0, 1, 0);
/** Position + orient a Y-axis capsule/cylinder so it spans `from` -> `to`. */
export function aimBone(mesh, from, to) {
  mesh.position.copy(from).lerp(to, 0.5);
  const d = to.clone().sub(from);
  const len = d.length() || 1e-5;
  d.divideScalar(len);
  mesh.quaternion.setFromUnitVectors(_up, d);
  const base = mesh.userData.boneLen || 1;
  mesh.scale.y = len / base;
  return mesh;
}

/** Planar two-bone IK. Returns the elbow/knee position in `out`. */
export function solveIK(root, target, l1, l2, pole, out) {
  // `out` may alias nothing else, but it must not alias `d` — writing the
  // result would otherwise clobber the direction mid-calculation.
  const d = _ikD.copy(target).sub(root);
  let dist = d.length();
  const max = (l1 + l2) * 0.995;
  const min = Math.abs(l1 - l2) * 1.02 + 1e-4;
  if (dist > max) dist = max;
  if (dist < min) dist = min;
  d.normalize();
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const perp = _ikP.copy(pole).addScaledVector(d, -pole.dot(d));
  if (perp.lengthSq() < 1e-8) perp.set(-d.y, d.x, 0);
  perp.normalize();
  out.copy(root).addScaledVector(d, a).addScaledVector(perp, h);
  return out;
}
const _ikD = new THREE.Vector3();
const _ikP = new THREE.Vector3();

/** Frame a set of world points: returns the camera distance that fits them. */
export function fitDistance(points, camera, dir, target, marginX = 1.0, marginY = 1.0) {
  // Two-pass numeric fit: measure NDC extent at a probe distance, then rescale.
  let dist = 6;
  const probe = camera.clone();
  const v = new THREE.Vector3();
  for (let pass = 0; pass < 3; pass++) {
    probe.position.copy(target).addScaledVector(dir, dist);
    probe.up.copy(camera.up);
    probe.lookAt(target);
    probe.updateMatrixWorld(true);
    probe.updateProjectionMatrix();
    let mx = 1e-6, my = 1e-6;
    for (const p of points) {
      v.copy(p).project(probe);
      mx = Math.max(mx, Math.abs(v.x));
      my = Math.max(my, Math.abs(v.y));
    }
    const need = Math.max(mx / marginX, my / marginY);
    dist *= need;
    dist = clamp(dist, 1.4, 40);
  }
  return dist;
}
