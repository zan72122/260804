// ---------------------------------------------------------------------------
//  Cut paths.
//
//  Every gesture in the game — the collar cut, the roll, the long cut down the
//  backbone, the lift, the saku cuts — is the same object: an arc-length
//  parameterised 3D polyline that carries, at each point, the outward surface
//  normal and the direction the edge bites, plus the axis the blade lies along.
//
//  The player's finger is never asked to be accurate. It is projected onto
//  this line in screen space and snapped to it, so the blade can only ever
//  travel the one safe route a butcher would take.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { bodyPoint, U_COLLAR, X_OF, yTopOf, yBotOf } from './tuna.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _v = new THREE.Vector3();

export class CutPath {
  /**
   * @param object Object3D the local data belongs to (null => already world)
   * @param pts    [{p, n, e}] position, outward surface normal, edge-bite dir
   * @param opts   blade: local axis the blade lies along (handle -> tip)
   *               contact: [near, far] metres along the blade that touch the
   *                        work at progress 0 and 1 — the long drawing stroke
   */
  constructor(object, pts, opts = {}) {
    this.object = object || null;
    this.n = pts.length;
    this.lp = pts.map((q) => q.p.clone());
    this.ln = pts.map((q) => q.n.clone().normalize());
    this.le = pts.map((q) => q.e.clone().normalize());
    this.wp = pts.map(() => new THREE.Vector3());
    this.wn = pts.map(() => new THREE.Vector3());
    this.we = pts.map(() => new THREE.Vector3());
    this.cum = new Float32Array(this.n);
    this.sx = new Float32Array(this.n);
    this.sy = new Float32Array(this.n);
    this.length = 0;
    this.bladeLocal = (opts.blade || new THREE.Vector3(1, 0, 0)).clone().normalize();
    this.bladeWorld = this.bladeLocal.clone();
    this.contact = opts.contact || [0.18, 1.24];
    this.speedCap = opts.speedCap ?? 1.05;      // metres of path travel / second
    this.rollAmp = opts.rollAmp ?? 0.10;
    this.kind = opts.kind || 'cut';
    this._nm = new THREE.Matrix3();
    this.updateWorld();
  }

  updateWorld() {
    const o = this.object;
    if (o) o.updateWorldMatrix(true, false);
    const m = o ? o.matrixWorld : null;
    if (m) this._nm.getNormalMatrix(m);
    for (let i = 0; i < this.n; i++) {
      this.wp[i].copy(this.lp[i]);
      this.wn[i].copy(this.ln[i]);
      this.we[i].copy(this.le[i]);
      if (m) {
        this.wp[i].applyMatrix4(m);
        this.wn[i].applyMatrix3(this._nm).normalize();
        this.we[i].applyMatrix3(this._nm).normalize();
      }
    }
    this.bladeWorld.copy(this.bladeLocal);
    if (m) this.bladeWorld.applyMatrix3(this._nm).normalize();
    this.cum[0] = 0;
    for (let i = 1; i < this.n; i++) this.cum[i] = this.cum[i - 1] + this.wp[i].distanceTo(this.wp[i - 1]);
    this.length = this.cum[this.n - 1] || 1e-4;
    return this;
  }

  _seg(t) {
    const d = clamp(t, 0, 1) * this.length;
    let lo = 0, hi = this.n - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= d) lo = mid; else hi = mid;
    }
    const span = Math.max(1e-6, this.cum[hi] - this.cum[lo]);
    return { i: lo, j: hi, f: clamp((d - this.cum[lo]) / span, 0, 1) };
  }

  pointAt(t, out) { const s = this._seg(t); return out.copy(this.wp[s.i]).lerp(this.wp[s.j], s.f); }
  normalAt(t, out) { const s = this._seg(t); return out.copy(this.wn[s.i]).lerp(this.wn[s.j], s.f).normalize(); }
  edgeAt(t, out) { const s = this._seg(t); return out.copy(this.we[s.i]).lerp(this.we[s.j], s.f).normalize(); }
  tangentAt(t, out) {
    const s = this._seg(t);
    out.copy(this.wp[s.j]).sub(this.wp[s.i]);
    if (out.lengthSq() < 1e-10) out.set(1, 0, 0);
    return out.normalize();
  }

  project(camera, w, h) {
    for (let i = 0; i < this.n; i++) {
      _v.copy(this.wp[i]).project(camera);
      this.sx[i] = (_v.x * 0.5 + 0.5) * w;
      this.sy[i] = (-_v.y * 0.5 + 0.5) * h;
    }
  }

  /** Nearest point on the projected path, searched only inside [tMin, tMax]. */
  nearestScreen(px, py, tMin = 0, tMax = 1) {
    let best = Infinity, bestT = tMin;
    const L = this.length;
    for (let i = 0; i < this.n - 1; i++) {
      const t0 = this.cum[i] / L, t1 = this.cum[i + 1] / L;
      if (t1 < tMin || t0 > tMax) continue;
      const ax = this.sx[i], ay = this.sy[i];
      const dx = this.sx[i + 1] - ax, dy = this.sy[i + 1] - ay;
      const dd = dx * dx + dy * dy;
      let f = dd < 1e-6 ? 0 : ((px - ax) * dx + (py - ay) * dy) / dd;
      f = clamp(f, 0, 1);
      let t = lerp(t0, t1, f);
      if (t < tMin) t = tMin;
      if (t > tMax) t = tMax;
      f = clamp((t - t0) / Math.max(1e-9, t1 - t0), 0, 1);
      const cx = ax + dx * f, cy = ay + dy * f;
      const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (d2 < best) { best = d2; bestT = t; }
    }
    return { t: bestT, dist: Math.sqrt(best) };
  }

  screenLength() {
    let L = 0;
    for (let i = 0; i < this.n - 1; i++) L += Math.hypot(this.sx[i + 1] - this.sx[i], this.sy[i + 1] - this.sy[i]);
    return L;
  }
}

/* ======================================================================== *
 *  Builders
 * ======================================================================== */

/** Analytic outward normal of the body surface at (u, a). */
export function bodyNormal(u, a, out) {
  const e = 1.5e-3;
  bodyPoint(clamp(u + e, 0, 1), a, _a);
  bodyPoint(clamp(u - e, 0, 1), a, _b);
  _a.sub(_b);                                    // d/du
  bodyPoint(u, a + e, _b);
  bodyPoint(u, a - e, _c);
  _b.sub(_c);                                    // d/da
  out.crossVectors(_a, _b).normalize();
  // orient it away from the body axis
  bodyPoint(u, a, _c);
  const axisY = (yTopOf(u) + yBotOf(u)) * 0.5;
  if (out.y * (_c.y - axisY) + out.z * _c.z < 0) out.negate();
  return out;
}

/**
 * 1) The collar cut.
 *    The blade is held across the fish and driven down through the collar, so
 *    the visible line the player traces runs from the dorsal ridge, over the
 *    near flank, down to the belly — one long downward stroke.
 */
export function collarPath(tuna) {
  const pts = [];
  const N = 60;
  const n = new THREE.Vector3();
  const edge = new THREE.Vector3(0.34, -0.94, 0).normalize();
  for (let i = 0; i <= N; i++) {
    const a = lerp(Math.PI / 2, -Math.PI / 2, i / N);
    const u = U_COLLAR(a);
    const p = new THREE.Vector3();
    bodyPoint(u, a, p);
    bodyNormal(u, a, n);
    pts.push({ p: p.clone().addScaledVector(n, 0.010), n: n.clone(), e: edge.clone() });
  }
  return new CutPath(tuna.root, pts, {
    blade: new THREE.Vector3(0.52, 0.14, 0.84),
    contact: [0.42, 1.14],
    speedCap: 0.92,
    rollAmp: 0.12,
    kind: 'collar',
  });
}

/**
 * 2) Rolling the fish onto its side — a wide arc swipe, world space, because
 *    the fish is what moves, not the gesture.
 */
export function rollPath(center) {
  const pts = [];
  const N = 40;
  const R = 0.66;
  for (let i = 0; i <= N; i++) {
    const b = lerp(-0.50, 1.48, i / N);            // from the near flank up and over
    const nrm = new THREE.Vector3(0, Math.sin(b), Math.cos(b)).normalize();
    pts.push({
      p: new THREE.Vector3(center.x + 0.12, center.y + Math.sin(b) * R, center.z + Math.cos(b) * R),
      n: nrm,
      e: nrm.clone().negate(),
    });
  }
  const path = new CutPath(null, pts, { speedCap: 1.6, kind: 'roll' });
  return path;
}

/**
 * 3) The long one. Nose end to tail along the dorsal edge, straight down the
 *    backbone: 1.5 m of travel, drawn heel-to-tip across the whole blade.
 */
export function spinePath(tuna) {
  const pts = [];
  const N = 84;
  const uHi = U_COLLAR(Math.PI / 2) - 0.010;
  const uLo = 0.055;
  const n = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const u = lerp(uHi, uLo, i / N);
    const p = new THREE.Vector3(X_OF(u), yTopOf(u), 0);
    bodyNormal(u, Math.PI / 2, n);
    pts.push({ p: p.clone().addScaledVector(n, 0.012), n: n.clone(), e: new THREE.Vector3(0, -1, 0) });
  }
  return new CutPath(tuna.root, pts, {
    blade: new THREE.Vector3(1, 0, 0),
    contact: [0.16, 1.26],
    speedCap: 1.12,
    rollAmp: 0.08,
    kind: 'spine',
  });
}

/** 4) Lifting the loin free: a straight upward pull in world space. */
export function liftPath(center) {
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push({
      p: new THREE.Vector3(center.x + t * 0.05, lerp(center.y + 0.16, center.y + 1.02, t), center.z + lerp(0.06, 0.34, t)),
      n: new THREE.Vector3(0, 0, 1),
      e: new THREE.Vector3(0, 1, 0),
    });
  }
  return new CutPath(null, pts, { speedCap: 1.35, kind: 'lift' });
}

/** 5) Trimming the loin into saku: short cross-strokes drawn toward the player. */
export function sakuPath(x, y, z0, z1) {
  const pts = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    pts.push({
      p: new THREE.Vector3(x, y, lerp(z0, z1, i / N)),
      n: new THREE.Vector3(0, 1, 0),
      e: new THREE.Vector3(0, -1, 0),
    });
  }
  return new CutPath(null, pts, {
    blade: new THREE.Vector3(0, 0, 1),
    contact: [0.20, 1.18],
    speedCap: 0.72,
    rollAmp: 0.05,
    kind: 'saku',
  });
}
