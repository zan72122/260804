// Minimal static-geometry merger.
//
// three's BufferGeometryUtils lives in examples/jsm, which this project does
// not vendor, and the cabinet alone is ~50 boxes that never move. Collapsing
// them per material takes the frame from "lots of tiny draw calls" to a handful,
// which is the thing mobile Safari actually cares about.

import * as THREE from '../vendor/three/three.module.min.js';

function mergeGeometries(geos) {
  let vCount = 0, iCount = 0;
  for (const g of geos) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nrm = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);

  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    pos.set(p.array, vo * 3);
    if (g.attributes.normal) nrm.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < p.count; i++) idx[io + i] = i + vo;
      io += p.count;
    }
    vo += p.count;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/**
 * Collapse every descendant of `root` marked `userData.mergeable` into one mesh
 * per material. Transforms are baked, so only use it on things that never move
 * relative to `root`.
 *
 * `skip` lets a caller fence off subtrees that *do* move — a plush's spring
 * pivots, for instance, sit inside the same group as its static trim.
 */
export function mergeStatic(root, { skip = null } = {}) {
  const groups = new Map();
  const victims = [];

  const walk = (o, mat) => {
    for (const child of o.children.slice()) {
      if (skip && skip(child)) continue;
      child.updateMatrix();
      const m = new THREE.Matrix4().multiplyMatrices(mat, child.matrix);
      if (child.isMesh && child.userData.mergeable && child.geometry?.attributes?.position) {
        const key = child.material.uuid;
        if (!groups.has(key)) groups.set(key, { material: child.material, geos: [], cast: false, receive: false });
        const g = groups.get(key);
        const geo = child.geometry.clone();
        geo.applyMatrix4(m);
        if (!geo.attributes.normal) geo.computeVertexNormals();
        g.geos.push(geo);
        g.cast = g.cast || child.castShadow;
        g.receive = g.receive || child.receiveShadow;
        victims.push(child);
      }
      if (child.children.length) walk(child, m);
    }
  };
  walk(root, _root.identity());

  for (const o of victims) o.parent?.remove(o);

  let saved = 0;
  for (const g of groups.values()) {
    if (!g.geos.length) continue;
    saved += g.geos.length - 1;
    const m = new THREE.Mesh(mergeGeometries(g.geos), g.material);
    m.castShadow = g.cast;
    m.receiveShadow = g.receive;
    m.matrixAutoUpdate = false;
    root.add(m);
    for (const geo of g.geos) geo.dispose();
  }
  return saved;
}

const _root = new THREE.Matrix4();
