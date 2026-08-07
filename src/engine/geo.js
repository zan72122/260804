// Geometry helpers — every prop and every ingredient is built from these.
// Real thickness matters: slabs have edges, crates have slat gaps you can see
// through, plates have a rim you can catch the light on.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { RoundedBoxGeometry, mergeGeometries };

const geoCache = new Map();
const cached = (key, build) => {
  if (!geoCache.has(key)) {
    const g = build();
    g.userData.shared = true;   // never disposed when a scene is torn down
    geoCache.set(key, g);
  }
  return geoCache.get(key);
};

/** Rounded box with a sane default fillet for the scale we work at (cm-ish). */
export function box(w, h, d, radius = Math.min(w, h, d) * 0.08, seg = 2) {
  return cached(`box${w}${h}${d}${radius}${seg}`,
    () => new RoundedBoxGeometry(w, h, d, seg, Math.min(radius, Math.min(w, h, d) * 0.49)));
}

export function cyl(rt, rb, h, seg = 20, open = false) {
  return cached(`cyl${rt}${rb}${h}${seg}${open}`,
    () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
}

export function sphere(r, seg = 20) {
  return cached(`sph${r}${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)));
}

export function capsule(r, len, seg = 14) {
  return cached(`cap${r}${len}${seg}`, () => new THREE.CapsuleGeometry(r, len, 4, seg));
}

export function torus(r, tube, seg = 24, tubeSeg = 10, arc = Math.PI * 2) {
  return cached(`tor${r}${tube}${seg}${tubeSeg}${arc}`,
    () => new THREE.TorusGeometry(r, tube, tubeSeg, seg, arc));
}

export function cone(r, h, seg = 16) {
  return cached(`cone${r}${h}${seg}`, () => new THREE.ConeGeometry(r, h, seg));
}

export function plane(w, h, sw = 1, sh = 1) {
  return cached(`pl${w}${h}${sw}${sh}`, () => new THREE.PlaneGeometry(w, h, sw, sh));
}

/**
 * Lathe a silhouette. `pts` is a list of [radius, height] pairs describing the
 * profile from bottom to top — this is how every jar, pot, glass and cup in the
 * game gets its shape, so the wall thickness is a real modelled thing.
 */
export function lathe(pts, seg = 24) {
  const key = `lathe${seg}${pts.flat().join(',')}`;
  return cached(key, () => {
    const v = pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.00001), y));
    const g = new THREE.LatheGeometry(v, seg);
    g.computeVertexNormals();
    return g;
  });
}

/** Squashed sphere — tomatoes, dough, loaves, heads. */
export function blob(r, sx = 1, sy = 1, sz = 1, seg = 20) {
  return cached(`blob${r}${sx}${sy}${sz}${seg}`, () => {
    const g = new THREE.SphereGeometry(r, seg, seg >> 1);
    g.scale(sx, sy, sz);
    return g;
  });
}

/** Mesh shorthand with shadow flags already set the way the scene expects. */
export function mesh(geometry, material, o = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.scale) {
    if (Array.isArray(o.scale)) m.scale.set(...o.scale);
    else m.scale.setScalar(o.scale);
  }
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.name) m.name = o.name;
  if (o.parent) o.parent.add(m);
  return m;
}

export function group(o = {}) {
  const g = new THREE.Group();
  if (o.pos) g.position.set(...o.pos);
  if (o.rot) g.rotation.set(...o.rot);
  if (o.scale) g.scale.setScalar(o.scale);
  if (o.name) g.name = o.name;
  if (o.parent) o.parent.add(g);
  return g;
}

/**
 * Slatted crate: four sides of horizontal boards with visible gaps, corner
 * posts, and an open top. Used for produce crates all over the market.
 */
export function crate(w, h, d, matBoard, matPost, slats = 3) {
  const g = new THREE.Group();
  const post = 0.018;
  const boardH = (h - post) / slats * 0.62;
  for (let i = 0; i < slats; i++) {
    const y = -h / 2 + post * 0.5 + (i + 0.5) * ((h - post) / slats);
    for (const [sx, sz, rot] of [[0, d / 2, 0], [0, -d / 2, 0], [w / 2, 0, Math.PI / 2], [-w / 2, 0, Math.PI / 2]]) {
      const len = rot ? d : w;
      mesh(box(len, boardH, 0.012, 0.002), matBoard, {
        pos: [sx, y, sz], rot: [0, rot, 0], parent: g,
      });
    }
  }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    mesh(box(post, h, post, 0.003), matPost, {
      pos: [sx * (w / 2 - post * 0.2), 0, sz * (d / 2 - post * 0.2)], parent: g,
    });
  }
  // Floor of the crate, inset so you see depth when you look inside.
  mesh(box(w - post, 0.01, d - post, 0.002), matBoard, { pos: [0, -h / 2 + 0.02, 0], parent: g });
  return g;
}

const MERGE_ATTRS = ['position', 'normal', 'uv'];

/**
 * Bake a prop into one mesh per material.
 *
 * A slatted crate is twenty little boards; a market stall is sixty pieces.
 * Modelled that way they look right, but drawn that way they cost a draw call
 * each — and every one is paid again for every shadow map. Freezing collapses a
 * finished static prop into a couple of draws while keeping the exact geometry.
 *
 * Only for props that never animate internally. Lights and sprites are carried
 * across untouched so lamp posts still work.
 */
export function freeze(root, o = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const local = new THREE.Matrix4();
  const buckets = new Map();
  const keep = [];

  root.traverse((obj) => {
    if (obj.isMesh) {
      const g = (obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone());
      for (const name of Object.keys(g.attributes)) {
        if (!MERGE_ATTRS.includes(name)) g.deleteAttribute(name);
      }
      if (!g.attributes.uv) {
        g.setAttribute('uv', new THREE.Float32BufferAttribute(
          new Float32Array((g.attributes.position.count) * 2), 2));
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(local.multiplyMatrices(inv, obj.matrixWorld));
      const key = obj.material.uuid;
      if (!buckets.has(key)) buckets.set(key, { mat: obj.material, geos: [], cast: obj.castShadow, receive: obj.receiveShadow });
      buckets.get(key).geos.push(g);
    } else if (obj.isLight || obj.isSprite) {
      keep.push(obj);
    }
  });

  const out = new THREE.Group();
  out.position.copy(root.position);
  out.quaternion.copy(root.quaternion);
  out.scale.copy(root.scale);

  for (const b of buckets.values()) {
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (b.geos.length > 1) b.geos.forEach((g) => g.dispose());
    if (!merged) continue;   // attribute mismatch: leave the prop unmerged
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = o.cast ?? b.cast;
    m.receiveShadow = o.receive ?? b.receive;
    out.add(m);
  }
  for (const k of keep) {
    const wp = new THREE.Vector3();
    k.getWorldPosition(wp);
    k.parent?.remove(k);
    k.position.copy(wp.applyMatrix4(inv));
    out.add(k);
  }
  return out;
}

/** Catenary between two points — string lights, ropes, cables. */
export function catenary(a, b, sag, segments = 24) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(Math.PI * t) * sag;
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

export function tube(curve, radius, seg = 24, radial = 6) {
  return new THREE.TubeGeometry(curve, seg, radius, radial, false);
}

/**
 * Cloth-ish sagging quad — awning panels, tablecloths, banners. Sags in the
 * middle and ripples along the free edge so it reads as fabric, not cardboard.
 */
export function draped(w, d, sag = 0.03, ripple = 0.012, segs = 16) {
  const g = new THREE.PlaneGeometry(w, d, segs, segs);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const u = x / w + 0.5, v = y / d + 0.5;
    const s = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * sag;
    const r = Math.sin(u * Math.PI * 7) * ripple * v;
    p.setZ(i, -s + r);
  }
  g.computeVertexNormals();
  return g;
}

/** Low ridge line for distant hills / rooftops — pure silhouette work. */
export function ridge(width, height, segments, rand, roughness = 0.5) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height);
  let h = height * 0.45;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -width / 2 + t * width;
    h += (rand() - 0.5) * height * roughness;
    h = Math.max(height * 0.12, Math.min(height, h));
    const env = Math.sin(t * Math.PI) * 0.6 + 0.4;
    shape.lineTo(x, h * env - height);
  }
  shape.lineTo(width / 2, -height);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

