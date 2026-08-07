import * as THREE from 'three';

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1e-6));
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach. `speed` ~ how many e-folds per second. */
export function damp(current: number, target: number, speed: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-speed * dt));
}

export function dampVec(out: THREE.Vector3, target: THREE.Vector3, speed: number, dt: number) {
  const k = 1 - Math.exp(-speed * dt);
  out.x += (target.x - out.x) * k;
  out.y += (target.y - out.y) * k;
  out.z += (target.z - out.z) * k;
  return out;
}

export function easeOutCubic(t: number) {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}
export function easeInOutCubic(t: number) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
export function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp01(t);
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** Deterministic small PRNG (mulberry32). */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap value noise, deterministic, good enough for terrain + textures. */
export function makeNoise2D(seed: number) {
  const rng = makeRng(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (hash: number, x: number, y: number) => {
    switch (hash & 3) {
      case 0:
        return x + y;
      case 1:
        return -x + y;
      case 2:
        return x - y;
      default:
        return -x - y;
    }
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v); // roughly [-1, 1]
  };
}

export function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves = 4, lac = 2.02, gain = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / (norm || 1);
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = (m as unknown as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
}

/** Uniformly resample a polyline to `count` points by arc length. Writes into `out`. */
export function resamplePolyline(src: THREE.Vector3[], count: number, out: THREE.Vector3[]): THREE.Vector3[] {
  const n = src.length;
  while (out.length < count) out.push(new THREE.Vector3());
  out.length = count;
  if (n === 0) return out;
  if (n === 1) {
    for (let i = 0; i < count; i++) out[i].copy(src[0]);
    return out;
  }
  const cum: number[] = new Array(n);
  cum[0] = 0;
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + src[i].distanceTo(src[i - 1]);
  const total = cum[n - 1];
  if (total <= 1e-6) {
    for (let i = 0; i < count; i++) out[i].copy(src[0]);
    return out;
  }
  let seg = 0;
  for (let i = 0; i < count; i++) {
    const d = (i / (count - 1)) * total;
    while (seg < n - 2 && cum[seg + 1] < d) seg++;
    const segLen = cum[seg + 1] - cum[seg];
    const t = segLen > 1e-6 ? (d - cum[seg]) / segLen : 0;
    out[i].lerpVectors(src[seg], src[seg + 1], t);
  }
  return out;
}

export function polylineLength(pts: THREE.Vector3[]) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += pts[i].distanceTo(pts[i - 1]);
  return s;
}
