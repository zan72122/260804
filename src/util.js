/**
 * こまごました けいさん ヘルパー
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const invLerp = (a, b, v) => clamp((v - a) / (b - a || 1e-6), 0, 1);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** フレームレートに よらない なめらか追従 (指数減衰) */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** ばね + ダンパー。おおきな きかいの おもみを だす */
export class Spring {
  constructor(value = 0, stiffness = 90, damping = 16) {
    this.value = value;
    this.vel = 0;
    this.target = value;
    this.k = stiffness;
    this.d = damping;
  }
  set(v) { this.value = v; this.target = v; this.vel = 0; }
  step(dt) {
    // あんてい化のため サブステップ
    const steps = Math.min(24, Math.max(1, Math.ceil(dt / 0.012)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = this.k * (this.target - this.value) - this.d * this.vel;
      this.vel += a * h;
      this.value += this.vel * h;
    }
    return this.value;
  }
}

/** かくどの さいたんけいろ 補間 */
export function dampAngle(current, target, lambda, dt) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

/** 決定論的な 2D バリューノイズ (じめんの でこぼこ用) */
export function makeNoise(seed = 1) {
  const p = new Uint8Array(512);
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];

  const grad = (h, x, y) => {
    switch (h & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  };
  return function noise2(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = smoothstep(xf);
    const v = smoothstep(yf);
    const aa = p[p[xi] + yi];
    const ab = p[p[xi] + yi + 1];
    const ba = p[p[xi + 1] + yi];
    const bb = p[p[xi + 1] + yi + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v) * 0.5; // だいたい -1..1
  };
}

/** かどまるの はこ。おもちゃっぽさの みなもと */
const roundedCache = new Map();
export function roundedBox(w, h, d, r = 0.06, seg = 2) {
  const rr = Math.min(r, Math.min(w, h, d) * 0.49);
  const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${rr.toFixed(3)}|${seg}`;
  let g = roundedCache.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, seg, rr);
    roundedCache.set(key, g);
  }
  return g;
}

/** つや消しの トゥーンっぽい きんぞく／プラスチック */
export function matteMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness ?? 0.62,
    metalness: opts.metalness ?? 0.06,
    flatShading: opts.flatShading ?? false,
    ...(opts.extra || {}),
  });
}

/** メッシュを つくって おやに つける ショートカット */
export function addMesh(parent, geometry, material, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * うごかない かざりを マテリアルごとに 1つの メッシュに まとめる。
 * ドローコールが へって、スマホでも かるく うごく。
 */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const local = new THREE.Matrix4();
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const key = o.material;
    if (!byMat.has(key)) byMat.set(key, []);
    const g = o.geometry.clone();
    local.multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(local);
    // まとめるには ぞくせいが そろって いる ひつよう が ある
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.getAttribute('uv')) {
      const n = g.getAttribute('position').count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    byMat.get(key).push(g);
  });

  const out = new THREE.Group();
  for (const [mat, geos] of byMat) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) { for (const g of geos) out.add(new THREE.Mesh(g, mat)); continue; }
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    out.add(m);
    for (const g of geos) if (g !== merged) g.dispose();
  }
  return out;
}

/** うごかない こどもメッシュを その場で まとめる（グループの いちは そのまま） */
export function bakeStatic(group) {
  const merged = mergeStatic(group);
  const doomed = [];
  group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) doomed.push(o); });
  for (const m of doomed) m.parent?.remove(m);
  // からっぽに なった グループも かたづける
  const empties = [];
  group.traverse((o) => { if (o !== group && o.children.length === 0 && !o.isMesh) empties.push(o); });
  for (const e of empties) e.parent?.remove(e);
  while (merged.children.length) group.add(merged.children[0]);
  return group;
}

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
