// ---------------------------------------------------------------------------
// Geometry helpers. Everything the player looks at closely is built from real
// extruded profiles with chamfers, reveals and joints rather than plain boxes.
// ---------------------------------------------------------------------------

import * as THREE from '../vendor/three/three.module.js';

/** Transform a geometry in place and return it. */
export function xf(g, { pos, rot, scale } = {}) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
  q.setFromEuler(e);
  m.compose(
    new THREE.Vector3(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0),
    q,
    new THREE.Vector3(scale ? scale[0] : 1, scale ? scale[1] : 1, scale ? scale[2] : 1)
  );
  g.applyMatrix4(m);
  return g;
}

/** Merge a list of geometries (position / normal / uv only). */
export function mergeGeoms(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of geos) {
    const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
    const c = p.count;
    pos.set(p.array.subarray(0, c * 3), o * 3);
    if (n) nrm.set(n.array.subarray(0, c * 3), o * 3);
    if (t) uv.set(t.array.subarray(0, c * 2), o * 2);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

/** Rounded rectangle Shape centred on the origin. */
export function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = w / 2, y = h / 2;
  r = Math.min(r, x, y);
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r);
  s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r);
  s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  return s;
}

/** Box with a real chamfer on every edge. */
export function beveledBox(w, h, d, bevel = 0.006, curve = 2) {
  const b = Math.min(bevel, w / 2.5, h / 2.5, d / 2.5);
  const g = new THREE.ExtrudeGeometry(roundedRect(w - b * 2, h - b * 2, b * 1.2), {
    depth: d - b * 2, bevelEnabled: true, bevelSize: b, bevelThickness: b,
    bevelSegments: curve, curveSegments: 3,
  });
  g.translate(0, 0, -(d - b * 2) / 2);
  return g;
}

/** Extrude a closed 2-D profile (array of [x,y]) along +Z for `len`. */
export function extrudeProfile(pts, len, opts = {}) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const holes = opts.holes || [];
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h[0][0], h[0][1]);
    for (let i = 1; i < h.length; i++) p.lineTo(h[i][0], h[i][1]);
    p.closePath();
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: opts.curveSegments || 4 });
  g.translate(0, 0, -len / 2);
  return g;
}

/** Rectangular frame (a ring) with bevelled edges — gaskets, hatch surrounds. */
export function frameGeom(w, h, t, d, bevel = 0.003) {
  const outer = roundedRect(w, h, bevel * 2);
  const inner = new THREE.Path();
  const ix = (w - t * 2) / 2, iy = (h - t * 2) / 2;
  inner.moveTo(-ix, -iy); inner.lineTo(ix, -iy); inner.lineTo(ix, iy); inner.lineTo(-ix, iy); inner.closePath();
  outer.holes.push(inner);
  const g = new THREE.ExtrudeGeometry(outer, {
    depth: d - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 2,
  });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  return g;
}

/** Lathe from an array of [radius, y] pairs. */
export function lathe(pts, seg = 24) {
  return new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg);
}

/** Capsule aligned to +Y, centred. */
export function capsule(r, len, cap = 6, rad = 12) {
  return new THREE.CapsuleGeometry(r, len, cap, rad);
}

/**
 * A dynamic tube around a polyline. Vertex data is rewritten in place each
 * frame so the rope can move without reallocating.
 */
export class DynamicTube {
  constructor(segments, radial, radius, uvRepeatPerMeter = 1.6) {
    this.seg = segments; this.rad = radial; this.radius = radius;
    this.uvRepeat = uvRepeatPerMeter;
    const vCount = (segments + 1) * (radial + 1);
    this.pos = new Float32Array(vCount * 3);
    this.nrm = new Float32Array(vCount * 3);
    this.uv = new Float32Array(vCount * 2);
    const idx = [];
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    this.geom = new THREE.BufferGeometry();
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geom.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3));
    this.geom.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    this.geom.setIndex(idx);
    this.geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3();
    this._b = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }

  /** @param {THREE.Vector3[]} pts  length must equal segments + 1 */
  update(pts, radiusScale = 1) {
    const { seg, rad } = this;
    const t = this._t, n = this._n, b = this._b;
    // Parallel-transport a frame along the curve to avoid twisting.
    let px = 1, py = 0, pz = 0;
    let arc = 0;
    for (let i = 0; i <= seg; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(seg, i + 1)];
      t.subVectors(p1, p0);
      if (t.lengthSq() < 1e-12) t.set(0, -1, 0);
      t.normalize();
      // project previous normal onto the plane perpendicular to t
      n.set(px, py, pz);
      const dot = n.dot(t);
      n.addScaledVector(t, -dot);
      if (n.lengthSq() < 1e-8) {
        n.set(0, 1, 0).addScaledVector(t, -t.y);
        if (n.lengthSq() < 1e-8) n.set(1, 0, 0);
      }
      n.normalize();
      px = n.x; py = n.y; pz = n.z;
      b.crossVectors(t, n);
      if (i > 0) arc += pts[i].distanceTo(pts[i - 1]);
      const r = this.radius * radiusScale;
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const nx = n.x * ca + b.x * sa, ny = n.y * ca + b.y * sa, nz = n.z * ca + b.z * sa;
        const vi = (i * (rad + 1) + j);
        this.pos[vi * 3] = pts[i].x + nx * r;
        this.pos[vi * 3 + 1] = pts[i].y + ny * r;
        this.pos[vi * 3 + 2] = pts[i].z + nz * r;
        this.nrm[vi * 3] = nx; this.nrm[vi * 3 + 1] = ny; this.nrm[vi * 3 + 2] = nz;
        this.uv[vi * 2] = j / rad;
        this.uv[vi * 2 + 1] = arc * this.uvRepeat;
      }
    }
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.normal.needsUpdate = true;
    this.geom.attributes.uv.needsUpdate = true;
  }
}

/** Standard PBR material wired to a generated texture set. */
export function pbr(maps, params = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.rmMap,
    metalnessMap: maps.rmMap,
    roughness: 1, metalness: 1,
    ...params,
  });
  return m;
}

/** Clone a texture with independent repeat settings. */
export function repeated(tex, rx, ry) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}
