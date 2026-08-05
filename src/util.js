import * as THREE from 'three';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

let seed = 12345;
export function srand() {
  // deterministic layout so the park looks the same every run
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
export const srange = (a, b) => a + (b - a) * srand();

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOutBack = (t) => {
  const c = 1.70158 * 1.2;
  const u = t - 1;
  return 1 + u * u * ((c + 1) * u + c);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// frame-rate independent damping
export const damp = (cur, goal, k, dt) => lerp(cur, goal, 1 - Math.exp(-k * dt));
export function dampV3(cur, goal, k, dt) {
  const t = 1 - Math.exp(-k * dt);
  cur.lerp(goal, t);
}

/**
 * Merge simple geometries into one BufferGeometry (position/normal, optional
 * per-part vertex color). Each item: { geom, matrix?, color? (THREE.Color) }.
 */
export function mergeGeoms(items, useColor = false) {
  const pos = [], nor = [], col = [];
  const c = new THREE.Color();
  for (const it of items) {
    let g = it.geom.index ? it.geom.toNonIndexed() : it.geom;
    if (g === it.geom) g = g.clone();
    if (it.matrix) g.applyMatrix4(it.matrix);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (useColor) {
        c.copy(it.color || new THREE.Color(1, 1, 1));
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (useColor) out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

export function mat4(px, py, pz, rx = 0, ry = 0, rz = 0, s = 1, sy = null, sz = null) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  m.compose(
    new THREE.Vector3(px, py, pz),
    q,
    new THREE.Vector3(s, sy === null ? s : sy, sz === null ? s : sz)
  );
  return m;
}

/** Soft round particle sprite texture. */
export function makeDotTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.55, inner.replace(/,1\)$/, ',0.7)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Vertical sky gradient texture; colors = [{stop,color(css)}...] */
export function makeSkyTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  for (const s of stops) grad.addColorStop(s[0], s[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
