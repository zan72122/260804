// Geometry construction helpers.
//
// Nothing in this game is a bare BoxGeometry with a colour on it: every solid is
// built with real thickness, chamfered arrises and modelled joints, because those
// edges are what catch the torch beam and tell the eye how big a thing is.

import * as THREE from '../vendor/three.module.js';

/** Rounded rectangle path in the XY plane. */
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * A block with rounded vertical arrises and a chamfer on the two end faces —
 * the shape almost every manufactured object actually has.
 */
export function chamferBox(w, h, d, r = 0.012, bevel = 0.008, curveSeg = 3) {
  bevel = Math.min(bevel, d / 2 - 1e-4, r * 0.98);
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, Math.max(r, bevel + 1e-4)), {
    depth: d - bevel * 2,
    bevelEnabled: bevel > 1e-4,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: curveSeg,
    steps: 1,
  });
  geo.translate(0, 0, -(d - bevel * 2) / 2);
  geo.computeVertexNormals();
  applyBoxUV(geo, 1);
  return geo;
}

/** Extrudes an arbitrary 2D profile (moulding, skirting, rail) along +Z. */
export function extrudeProfile(pts, length, { bevel = 0.002, close = true } = {}) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  if (close) s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: length - bevel * 2,
    bevelEnabled: bevel > 1e-4,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1,
  });
  geo.translate(0, 0, -(length - bevel * 2) / 2);
  geo.computeVertexNormals();
  applyBoxUV(geo, 1);
  return geo;
}

/** Surface of revolution from a [x, y] profile (x = radius). */
export function lathe(profile, segments = 32, phiLength = Math.PI * 2) {
  const pts = profile.map(([x, y]) => new THREE.Vector2(Math.max(x, 1e-5), y));
  const geo = new THREE.LatheGeometry(pts, segments, 0, phiLength);
  geo.computeVertexNormals();
  return geo;
}

/** Smooth tube through a list of points — hoses, straps, limbs, cables. */
export function tube(points, radius, { tubular = 48, radial = 10, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed, 'catmullrom', 0.4);
  return new THREE.TubeGeometry(curve, tubular, radius, radial, closed);
}

/**
 * Triplanar-ish box UVs so a single tiling texture reads at a consistent
 * physical scale no matter how a piece is proportioned.
 */
export function applyBoxUV(geo, scale = 1) {
  geo.computeBoundingBox();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  if (!nor) geo.computeVertexNormals();
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) { u = z; v = y; }
    else if (ny >= nx && ny >= nz) { u = x; v = z; }
    else { u = x; v = y; }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Rewrites UVs in world scale for a mesh already placed in the scene. */
export function worldScaleUV(geo, scale = 1) {
  return applyBoxUV(geo, scale);
}

export function mesh(geo, mat, { pos, rot, scale, shadow = true, receive = true, name } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale != null) {
    if (typeof scale === 'number') m.scale.setScalar(scale);
    else m.scale.set(scale[0], scale[1], scale[2]);
  }
  m.castShadow = shadow;
  m.receiveShadow = receive;
  if (name) m.name = name;
  return m;
}

export function group(name, children = []) {
  const g = new THREE.Group();
  g.name = name;
  for (const c of children) g.add(c);
  return g;
}
