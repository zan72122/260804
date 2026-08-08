// ---------------------------------------------------------------------------
// Procedural texture generation.
// Everything is synthesised at runtime: no external image assets, no CDN.
// Each surface gets a colour map, a tangent-space normal map derived from a
// height field, and a packed roughness/metalness map (G = roughness,
// B = metalness) so one texture drives both PBR channels.
// ---------------------------------------------------------------------------

import * as THREE from '../vendor/three/three.module.js';

// --- value noise ------------------------------------------------------------

function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1013904223);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

// Tiling value noise: coordinates wrap on `period` lattice cells.
function vnoise(x, y, s, period) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const w = (v) => (period ? ((v % period) + period) % period : v);
  const x0 = w(xi), x1 = w(xi + 1), y0 = w(yi), y1 = w(yi + 1);
  const u = smooth(xf), v = smooth(yf);
  const a = hash(x0, y0, s), b = hash(x1, y0, s);
  const c = hash(x0, y1, s), d = hash(x1, y1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x, y, oct = 4, s = 0, period = 0) {
  let f = 1, a = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * vnoise(x * f, y * f, s + i * 37, period ? period * f : 0);
    norm += a;
    f *= 2;
    a *= 0.5;
  }
  return sum / norm;
}

// Ridged noise — good for scratches, cracks and rain channels.
export function ridge(x, y, oct = 3, s = 0, period = 0) {
  let f = 1, a = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = Math.abs(vnoise(x * f, y * f, s + i * 91, period ? period * f : 0) * 2 - 1);
    sum += a * (1 - n);
    norm += a;
    f *= 2.1;
    a *= 0.55;
  }
  return sum / norm;
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const mix = (a, b, t) => a + (b - a) * t;

// --- map builder ------------------------------------------------------------

/**
 * @param {number} size    texture resolution (square)
 * @param {function} fn    fn(u, v, out) fills out.{r,g,b,a,h,rough,metal}
 * @param {object} opts    { normalStrength, repeat:[x,y], anisotropy }
 */
export function makeTexSet(size, fn, opts = {}) {
  const n = size * size;
  const col = new Uint8Array(n * 4);
  const rm = new Uint8Array(n * 4);
  const hgt = new Float32Array(n);
  const out = { r: 1, g: 1, b: 1, a: 1, h: 0.5, rough: 0.8, metal: 0 };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      out.r = out.g = out.b = 0.5; out.a = 1; out.h = 0.5; out.rough = 0.8; out.metal = 0;
      fn(x / size, y / size, out, x, y);
      col[i * 4] = clamp01(out.r) * 255;
      col[i * 4 + 1] = clamp01(out.g) * 255;
      col[i * 4 + 2] = clamp01(out.b) * 255;
      col[i * 4 + 3] = clamp01(out.a) * 255;
      hgt[i] = out.h;
      rm[i * 4] = 255;
      rm[i * 4 + 1] = clamp01(out.rough) * 255;
      rm[i * 4 + 2] = clamp01(out.metal) * 255;
      rm[i * 4 + 3] = 255;
    }
  }

  // Sobel the height field into a tangent-space normal map (wrapping).
  const strength = opts.normalStrength === undefined ? 2.0 : opts.normalStrength;
  const nrm = new Uint8Array(n * 4);
  const H = (x, y) => hgt[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x - 1, y) - H(x + 1, y)) * strength;
      const dy = (H(x, y - 1) - H(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      nrm[i] = (dx / len * 0.5 + 0.5) * 255;
      nrm[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
      nrm[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      nrm[i + 3] = 255;
    }
  }

  const mk = (data, srgb) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = opts.anisotropy || 8;
    if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    t.needsUpdate = true;
    return t;
  };

  return { map: mk(col, true), normalMap: mk(nrm, false), rmMap: mk(rm, false) };
}

// ---------------------------------------------------------------------------
// Sky — generated as a float equirectangular map so the sun carries real HDR
// energy. Drives both the visible sky dome and the IBL environment.
// ---------------------------------------------------------------------------

export const SUN_AZIMUTH = 0.62;   // radians, measured from +Z toward +X
export const SUN_ELEVATION = 0.30; // radians above horizon (low golden light)

export function sunDirection() {
  const ce = Math.cos(SUN_ELEVATION);
  return new THREE.Vector3(
    Math.sin(SUN_AZIMUTH) * ce,
    Math.sin(SUN_ELEVATION),
    Math.cos(SUN_AZIMUTH) * ce
  ).normalize();
}

export function makeSkyTexture(w = 1024, h = 512) {
  // Half float rather than float: linear filtering of half-float textures is
  // core in WebGL2, so this works on iOS without relying on an extension.
  const data = new Uint16Array(w * h * 4);
  const half = THREE.DataUtils.toHalfFloat;
  const sun = sunDirection();

  // Late-afternoon palette, linear-light values.
  const zenith = [0.050, 0.150, 0.46];
  const mid = [0.185, 0.400, 0.74];
  const horizon = [0.76, 0.63, 0.55];
  const belowHz = [0.34, 0.34, 0.36];

  for (let y = 0; y < h; y++) {
    const theta = (y + 0.5) / h * Math.PI;       // 0 at zenith
    const cy = Math.cos(theta), sy = Math.sin(theta);
    for (let x = 0; x < w; x++) {
      const phi = (x + 0.5) / w * Math.PI * 2 - Math.PI;
      const dx = sy * Math.sin(phi), dz = sy * Math.cos(phi), dy = cy;

      const up = clamp01(dy);
      let r, g, b;
      if (dy >= 0) {
        const t = Math.pow(up, 0.22);
        const t2 = Math.pow(up, 1.10);
        r = mix(mix(horizon[0], mid[0], t), zenith[0], t2);
        g = mix(mix(horizon[1], mid[1], t), zenith[1], t2);
        b = mix(mix(horizon[2], mid[2], t), zenith[2], t2);
      } else {
        const t = clamp01(-dy * 3);
        r = mix(horizon[0] * 0.75, belowHz[0], t);
        g = mix(horizon[1] * 0.75, belowHz[1], t);
        b = mix(horizon[2] * 0.78, belowHz[2], t);
      }

      // Sun disc + Mie-ish forward glow.
      const cosA = dx * sun.x + dy * sun.y + dz * sun.z;
      const ang = Math.acos(clamp01(cosA) * (cosA < 0 ? 0 : 1) || Math.min(1, Math.max(-1, cosA)));
      const glow = Math.pow(Math.max(0, cosA), 220) * 3.0 + Math.pow(Math.max(0, cosA), 14) * 0.55;
      r += glow * 1.55; g += glow * 1.16; b += glow * 0.74;
      if (ang < 0.0175) {
        const e = 1 - clamp01((ang - 0.012) / 0.0055);
        r += 46 * e; g += 38 * e; b += 27 * e;
      }

      // Cloud deck: flattened fbm, denser near the horizon, warm sunlit tops.
      if (dy > -0.02) {
        const scale = 2.2 / Math.max(0.10, dy + 0.13);
        const cu = (dx * scale) * 0.5 + 40, cv = (dz * scale) * 0.5 + 40;
        let d = fbm(cu, cv, 5, 7);
        d = clamp01((d - 0.44) * 5.4);
        const wisp = clamp01((fbm(cu * 2.4 + 11, cv * 2.4, 4, 19) - 0.42) * 3.2) * 0.55;
        // A distinct cumulus deck plus higher wisps, both fading at the horizon.
        const cov = clamp01(d * 1.2 + wisp * 0.7) * clamp01((dy + 0.015) * 14.0) * clamp01(1.35 - dy * 0.9);
        if (cov > 0.001) {
          // Sunlit tops, cool shadowed undersides: the cue that sells depth.
          const shade = clamp01(0.30 + d * 0.9);
          const lit = clamp01(0.30 + Math.max(0, cosA) * 0.85) * shade;
          const cr = mix(0.30, 1.32, lit), cg = mix(0.32, 1.18, lit), cb = mix(0.42, 1.02, lit);
          r = mix(r, cr, cov); g = mix(g, cg, cov); b = mix(b, cb, cov);
        }
      }

      // A soft rainbow arc opposite the sun: shows up in clean glass.
      const anti = -(dx * sun.x + dy * sun.y + dz * sun.z);
      const aAng = Math.acos(Math.min(1, Math.max(-1, anti)));
      const bandC = 0.7156; // 41 deg
      const dBand = Math.abs(aAng - bandC);
      if (dBand < 0.075 && dy > -0.01) {
        const t = (aAng - (bandC - 0.075)) / 0.15;
        const fall = Math.pow(1 - Math.abs(t - 0.5) * 2, 0.7) * 0.16 * clamp01(dy * 6);
        r += fall * (0.9 - t * 0.6);
        g += fall * (0.55 + Math.sin(t * Math.PI) * 0.5);
        b += fall * (0.25 + t * 0.95);
      }

      const i = (y * w + x) * 4;
      data[i] = half(Math.min(65000, r));
      data[i + 1] = half(Math.min(65000, g));
      data[i + 2] = half(Math.min(65000, b));
      data[i + 3] = half(1);
    }
  }

  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Surface libraries
// ---------------------------------------------------------------------------

// Anodised aluminium extrusion: fine drawing lines along the profile axis,
// light oxide mottle, a few handling scuffs.
export function aluminiumMaps(size = 512) {
  return makeTexSet(size, (u, v, o) => {
    const lines = vnoise(u * size * 0.75, v * 6, 3, 0) * 0.5 + vnoise(u * size * 2.1, v * 2, 11, 0) * 0.5;
    const mottle = fbm(u * 7, v * 7, 4, 3, 7);
    const base = 0.60 + (lines - 0.5) * 0.055 + (mottle - 0.5) * 0.05;
    const scuff = clamp01((ridge(u * 26, v * 3.5, 3, 55, 26) - 0.80) * 6);
    o.r = base + scuff * 0.13;
    o.g = base * 0.995 + scuff * 0.13;
    o.b = base * 1.02 + scuff * 0.12;
    o.h = 0.5 + (lines - 0.5) * 0.16 + scuff * 0.12;
    o.rough = 0.30 + (lines - 0.5) * 0.13 + (mottle - 0.5) * 0.10 + scuff * 0.28;
    o.metal = 1.0;
  }, { normalStrength: 1.4, anisotropy: 8 });
}

// Precast concrete spandrel with exposed aggregate, form marks and the rain
// staining that always collects under a horizontal joint.
export function concreteMaps(size = 512) {
  return makeTexSet(size, (u, v, o) => {
    const grain = fbm(u * 30, v * 30, 5, 13, 30);
    const blotch = fbm(u * 4.5, v * 4.5, 4, 71, 4.5);
    const agg = vnoise(u * 150, v * 150, 5, 150);
    const aggMask = agg > 0.80 ? (agg - 0.80) * 5 : 0;
    let l = 0.615 + (grain - 0.5) * 0.10 + (blotch - 0.5) * 0.085;
    l -= aggMask * 0.075;
    // Vertical rain channels, strongest just under the top edge.
    const streak = clamp01((ridge(u * 20, v * 0.6, 3, 5, 20) - 0.62) * 3.2);
    const streakFall = clamp01(1 - Math.abs(v - 0.18) * 2.6);
    l -= streak * streakFall * 0.13;
    // Dust film accumulating on the lower half.
    l += clamp01((v - 0.55) * 1.4) * 0.02;
    o.r = l * 0.985; o.g = l * 1.0; o.b = l * 1.005;
    o.h = 0.5 + (grain - 0.5) * 0.42 - aggMask * 0.5 + (blotch - 0.5) * 0.12;
    o.rough = 0.82 + (grain - 0.5) * 0.14 + streak * streakFall * 0.10 - aggMask * 0.18;
    o.metal = 0;
  }, { normalStrength: 2.6 });
}

// Painted steel / powder-coated panel for plant rooms and roof kit.
export function paintedMetalMaps(size = 256, tint = [0.36, 0.40, 0.43]) {
  return makeTexSet(size, (u, v, o) => {
    const orange = fbm(u * 55, v * 55, 3, 23, 55);           // orange-peel finish
    const chalk = fbm(u * 3.5, v * 3.5, 3, 91, 3.5);
    const chip = clamp01((ridge(u * 18, v * 18, 3, 44, 18) - 0.86) * 8);
    const rust = clamp01((fbm(u * 9, v * 9, 4, 5, 9) - 0.64) * 3.4) * clamp01((v - 0.5) * 2);
    let l = 1 + (orange - 0.5) * 0.07 + (chalk - 0.5) * 0.09;
    o.r = tint[0] * l + rust * 0.30 + chip * 0.25;
    o.g = tint[1] * l + rust * 0.13 + chip * 0.25;
    o.b = tint[2] * l + rust * 0.03 + chip * 0.26;
    o.h = 0.5 + (orange - 0.5) * 0.25 - chip * 0.4;
    o.rough = 0.48 + (orange - 0.5) * 0.10 + rust * 0.35 + chip * 0.2;
    o.metal = chip * 0.8;
  }, { normalStrength: 1.8 });
}

// Kernmantle rope: 32-carrier braid, two yarn colours, fibre fuzz.
export function ropeMaps(size = 256) {
  return makeTexSet(size, (u, v, o) => {
    // u runs around the circumference, v along the rope.
    const s1 = Math.sin((u * 8 + v * 26) * Math.PI * 2);
    const s2 = Math.sin((-u * 8 + v * 26) * Math.PI * 2);
    const braid = Math.max(s1, s2);
    const over = s1 > s2 ? 0 : 1;
    const fuzz = fbm(u * 90, v * 90, 3, 17, 90);
    const band = Math.sin(v * Math.PI * 2 * 3.0) > 0.72 ? 1 : 0; // pattern picks
    let r, g, b;
    if (over) { r = 0.93; g = 0.94; b = 0.95; }
    else { r = 0.14; g = 0.42; b = 0.72; }
    if (band) { r = 0.95; g = 0.62; b = 0.18; }
    const shade = 0.55 + clamp01(braid) * 0.45;
    o.r = r * shade + (fuzz - 0.5) * 0.06;
    o.g = g * shade + (fuzz - 0.5) * 0.06;
    o.b = b * shade + (fuzz - 0.5) * 0.06;
    o.h = clamp01(braid) * 0.85 + (fuzz - 0.5) * 0.18;
    o.rough = 0.80 + (fuzz - 0.5) * 0.14;
    o.metal = 0;
  }, { normalStrength: 2.4 });
}

// Polyester harness webbing: twill weave, edge selvedge, stitch rows.
export function webbingMaps(size = 256, tint = [0.92, 0.36, 0.50]) {
  return makeTexSet(size, (u, v, o) => {
    const wx = Math.floor(u * 42), wy = Math.floor(v * 42);
    const weave = ((wx + wy) % 2) ? 0.82 : 1.06;
    const rib = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * 21);
    const fuzz = fbm(u * 70, v * 70, 3, 31, 70);
    const edge = (u < 0.055 || u > 0.945) ? 0.86 : 1;
    const stitch = (Math.abs(u - 0.16) < 0.012 || Math.abs(u - 0.84) < 0.012)
      ? (Math.sin(v * Math.PI * 2 * 34) > 0.1 ? 1 : 0) : 0;
    const l = weave * edge * (0.88 + rib * 0.14) + (fuzz - 0.5) * 0.09;
    o.r = mix(tint[0] * l, 0.98, stitch * 0.8);
    o.g = mix(tint[1] * l, 0.98, stitch * 0.8);
    o.b = mix(tint[2] * l, 0.99, stitch * 0.8);
    o.h = 0.5 + (weave - 0.94) * 1.4 + rib * 0.16 + stitch * 0.5;
    o.rough = 0.86 + (fuzz - 0.5) * 0.12 - stitch * 0.14;
    o.metal = 0;
  }, { normalStrength: 2.2 });
}

// Technical workwear softshell: fine twill weave, seam-adjacent sheen,
// micro-fuzz. This is what stops the character reading as moulded plastic.
export function clothMaps(size = 256, tint = [0.9, 0.4, 0.55]) {
  return makeTexSet(size, (u, v, o) => {
    const wx = Math.floor(u * 96), wy = Math.floor(v * 96);
    const twill = ((wx + wy * 2) % 3) === 0 ? 1.09 : ((wx + wy) % 2 ? 0.93 : 1.02);
    const thread = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 96);
    const fuzz = fbm(u * 120, v * 120, 3, 41, 120);
    const drape = fbm(u * 7, v * 5, 4, 13, 7);
    const l = twill * (0.94 + (drape - 0.5) * 0.14) + (fuzz - 0.5) * 0.05;
    o.r = tint[0] * l; o.g = tint[1] * l; o.b = tint[2] * l;
    o.h = 0.5 + (twill - 1.0) * 1.6 + thread * 0.10 + (drape - 0.5) * 0.30;
    o.rough = 0.72 + (fuzz - 0.5) * 0.14 + (1.09 - twill) * 0.4;
    o.metal = 0;
  }, { normalStrength: 1.6 });
}

// Painted birch ply seat board: end-grain laminations on the edge, worn paint
// where the rope legs and the wearer's weight bear on it.
export function plywoodMaps(size = 256) {
  return makeTexSet(size, (u, v, o) => {
    const grain = fbm(u * 3, v * 44, 4, 61, 3);
    const wear = clamp01((fbm(u * 5 + 3, v * 5, 4, 8, 5) - 0.50) * 2.6);
    const scratch = clamp01((ridge(u * 30, v * 4, 3, 12, 30) - 0.74) * 4.5);
    const paint = [0.94, 0.86, 0.42];
    const wood = [0.80, 0.63, 0.42];
    const t = clamp01(wear * 0.85 + scratch * 0.7);
    o.r = mix(paint[0], wood[0], t) * (0.92 + (grain - 0.5) * 0.16);
    o.g = mix(paint[1], wood[1], t) * (0.92 + (grain - 0.5) * 0.16);
    o.b = mix(paint[2], wood[2], t) * (0.92 + (grain - 0.5) * 0.18);
    o.h = 0.5 + (grain - 0.5) * 0.3 - scratch * 0.35;
    o.rough = mix(0.42, 0.78, t) + (grain - 0.5) * 0.1;
    o.metal = 0;
  }, { normalStrength: 2.0 });
}

// Distant curtain-wall tower facade: floor bands, mullion grid, lit offices.
export function towerFacadeTexture(size = 512, opt = {}) {
  const cols = opt.cols || 16, rows = opt.rows || 22;
  const tint = opt.tint || [0.30, 0.38, 0.47];
  const litChance = opt.lit === undefined ? 0.12 : opt.lit;
  return makeTexSet(size, (u, v, o) => {
    const fx = u * cols, fy = v * rows;
    const cx = Math.floor(fx), cy = Math.floor(fy);
    const ix = fx - cx, iy = fy - cy;
    const mull = (ix < 0.07 || ix > 0.93 || iy < 0.09 || iy > 0.91);
    const spandrel = iy > 0.68;
    const r = hash(cx, cy, opt.seed || 3);
    const lit = r < litChance;
    let l, met, rough;
    if (mull) {
      l = 0.52; met = 0.9; rough = 0.36;
      o.r = l; o.g = l; o.b = l * 1.03;
    } else if (spandrel) {
      const n = fbm(u * 40, v * 40, 3, 4, 40);
      l = 0.42 + (n - 0.5) * 0.12; met = 0.2; rough = 0.62;
      o.r = tint[0] * l * 1.6; o.g = tint[1] * l * 1.6; o.b = tint[2] * l * 1.6;
    } else {
      const n = fbm(u * 22, v * 22, 3, 9, 22);
      l = 0.9 + (n - 0.5) * 0.2;
      o.r = tint[0] * l * 1.9; o.g = tint[1] * l * 1.9; o.b = tint[2] * l * 1.9;
      if (lit) { o.r += 0.55; o.g += 0.44; o.b += 0.26; }
      met = 0.92; rough = 0.09;
    }
    o.h = mull ? 0.85 : (spandrel ? 0.4 : 0.25);
    o.rough = rough; o.metal = met;
  }, { normalStrength: 1.2, anisotropy: 4 });
}

// Concrete roof pavers on pedestals: crisp joints, chipped arrises, ponding
// stains where water sits after rain.
export function pavingMaps(size = 512) {
  return makeTexSet(size, (u, v, o) => {
    const N = 5;
    const gx = u * N, gy = v * N;
    const ix = gx - Math.floor(gx), iy = gy - Math.floor(gy);
    const joint = Math.min(ix, 1 - ix, iy, 1 - iy);
    const inJoint = joint < 0.035;
    const seed = Math.floor(gx) * 31 + Math.floor(gy) * 7;
    const grain = fbm(u * 90, v * 90, 4, 3, 90);
    const stain = fbm(u * 6 + seed * 0.13, v * 6, 4, 21, 6);
    const tone = 0.60 + ((seed * 37 % 17) / 17 - 0.5) * 0.07;
    let l = tone + (grain - 0.5) * 0.11 + (stain - 0.5) * 0.09;
    if (inJoint) l *= 0.55;
    const chip = clamp01((ridge(u * 40, v * 40, 3, 9, 40) - 0.85) * 7) * (joint < 0.07 ? 1 : 0);
    l += chip * 0.10;
    o.r = l * 1.01; o.g = l; o.b = l * 0.96;
    o.h = inJoint ? 0.10 : 0.62 + (grain - 0.5) * 0.25 - chip * 0.3;
    o.rough = 0.80 + (grain - 0.5) * 0.10 + (inJoint ? 0.08 : 0);
    o.metal = 0;
  }, { normalStrength: 3.0 });
}

// Ground: city blocks seen from 150 m up — roofs, roads, blocks of green.
export function cityGroundMaps(size = 512) {
  return makeTexSet(size, (u, v, o) => {
    const BX = 5;
    const gx = u * BX, gy = v * BX;
    const bx = Math.floor(gx), by = Math.floor(gy);
    const ix = gx - bx, iy = gy - by;
    const road = ix < 0.14 || iy < 0.14;
    const r = hash(bx, by, 21);
    let col;
    if (road) {
      const wear = fbm(u * 90, v * 90, 3, 2, 90);
      col = [0.115 + wear * 0.05, 0.118 + wear * 0.05, 0.125 + wear * 0.05];
      // lane markings
      if (Math.abs(ix - 0.07) < 0.008 && (Math.floor(gy * 26) % 2)) col = [0.55, 0.52, 0.35];
      if (Math.abs(iy - 0.07) < 0.008 && (Math.floor(gx * 26) % 2)) col = [0.55, 0.52, 0.35];
    } else if (r < 0.12) {
      const n = fbm(u * 60, v * 60, 4, 33, 60);
      col = [0.15 + n * 0.07, 0.24 + n * 0.10, 0.14 + n * 0.06];   // park
    } else {
      const n = fbm(u * 110, v * 110, 3, bx * 7 + by, 110);
      const base = 0.21 + r * 0.14;
      col = [base + n * 0.06, base * 0.99 + n * 0.06, base * 0.97 + n * 0.06];
      // rooftop plant boxes
      if (ix > 0.35 && ix < 0.55 && iy > 0.4 && iy < 0.6) col = [0.42, 0.43, 0.44];
    }
    o.r = col[0]; o.g = col[1]; o.b = col[2];
    o.h = road ? 0.35 : 0.6;
    o.rough = road ? 0.62 : 0.80;
    o.metal = 0;
  }, { normalStrength: 0.8, repeat: [1, 1], anisotropy: 8 });
}

// ---------------------------------------------------------------------------
// Window grime — drawn into a 2D canvas so it can be erased interactively.
// ---------------------------------------------------------------------------

export function makeGrimeCanvas(size, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawGrime(c.getContext('2d'), size, seed);
  return c;
}

/**
 * Paints a convincing layer of city grime: a general film of airborne dust,
 * vertical rain-wash channels, salt haze near the edges where water pools
 * against the gasket, plus a few bird strikes and insect marks.
 */
export function drawGrime(ctx, S, seed = 1) {
  ctx.clearRect(0, 0, S, S);
  const img = ctx.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const film = fbm(u * 5, v * 5, 4, seed);
      const dust = fbm(u * 26, v * 26, 4, seed + 5);
      // rain runs: stretched vertically, they start at the head and fade down
      const run = clamp01((ridge(u * 26, v * 1.4, 3, seed + 11) - 0.55) * 2.6);
      const runFall = clamp01(1 - v * 0.55);
      // edge accumulation against the gasket
      const eu = Math.min(u, 1 - u), ev = Math.min(v, 1 - v);
      const edge = clamp01(1 - Math.min(eu, ev) * 7.5);

      let a = 0.30 + (film - 0.5) * 0.34 + (dust - 0.5) * 0.20;
      a += run * runFall * 0.34;
      a += edge * 0.36;
      a = clamp01(a) * 0.94;

      // grime is warm grey; rain channels read slightly darker and browner
      const l = 0.60 + (dust - 0.5) * 0.28 - run * 0.14;
      const i = (y * S + x) * 4;
      d[i] = clamp01(l * 0.98) * 255;
      d[i + 1] = clamp01(l * 0.94) * 255;
      d[i + 2] = clamp01(l * 0.87) * 255;
      d[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Bird strikes and pollen splats — high-contrast, obviously "dirt".
  const rnd = (() => { let s = seed * 9781 + 1; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  const splats = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < splats; i++) {
    const cx = rnd() * S, cy = rnd() * S * 0.85;
    const rad = S * (0.028 + rnd() * 0.045);
    ctx.save();
    ctx.globalAlpha = 0.85;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, 'rgba(246,244,232,0.98)');
    g.addColorStop(0.55, 'rgba(226,218,190,0.85)');
    g.addColorStop(1, 'rgba(210,200,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, rad, rad * (0.7 + rnd() * 0.5), rnd() * 3, 0, 7); ctx.fill();
    // drip tail
    ctx.fillStyle = 'rgba(232,226,200,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx + (rnd() - 0.5) * rad * 0.4, cy + rad * 1.5, rad * 0.22, rad * 1.4, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  // A couple of dried droplet rings.
  for (let i = 0; i < 14; i++) {
    const cx = rnd() * S, cy = rnd() * S, rad = S * (0.006 + rnd() * 0.02);
    ctx.strokeStyle = 'rgba(200,192,170,0.5)';
    ctx.lineWidth = Math.max(1, rad * 0.35);
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.stroke();
  }
}
