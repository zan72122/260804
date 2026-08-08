// Procedural material bakery.
// No image files ship with the game, so every surface's albedo / roughness /
// normal is generated once at boot from seeded noise. Each generator describes a
// real material: oak boards with a wear lane, painted plaster with roller
// texture, filament-wound composite on the SCBA cylinder, Nomex twill, and so on.

import * as THREE from '../vendor/three.module.js';
import { makeFbm2D, makeRidged2D, mulberry32 } from './noise.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/**
 * Runs `fn(u, v, px, py)` for every texel and returns { map, roughnessMap, normalMap }.
 * fn must return [r, g, b, roughness, height], all 0..1.
 */
function bake(size, fn, { normalStrength = 2.0, repeat = 1, aniso = 8 } = {}) {
  const albedo = new Uint8ClampedArray(size * size * 4);
  const rough = new Uint8ClampedArray(size * size * 4);
  const height = new Float32Array(size * size);

  const out = [0, 0, 0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      fn(x / size, y / size, x, y, out);
      const i = (y * size + x) * 4;
      albedo[i] = out[0] * 255; albedo[i + 1] = out[1] * 255; albedo[i + 2] = out[2] * 255; albedo[i + 3] = 255;
      const r = out[3] * 255;
      rough[i] = r; rough[i + 1] = r; rough[i + 2] = r; rough[i + 3] = 255;
      height[y * size + x] = out[4];
    }
  }

  // Sobel the height field into a tangent-space normal map (wrapping at edges).
  const normal = new Uint8ClampedArray(size * size * 4);
  const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy =
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * normalStrength, ny = -dy * normalStrength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      normal[i] = (nx * 0.5 + 0.5) * 255;
      normal[i + 1] = (ny * 0.5 + 0.5) * 255;
      normal[i + 2] = (nz * 0.5 + 0.5) * 255;
      normal[i + 3] = 255;
    }
  }

  const mk = (data, srgb) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = aniso;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  };

  return { map: mk(albedo, true), roughnessMap: mk(rough, false), normalMap: mk(normal, false) };
}

const cache = new Map();
function once(key, factory) {
  if (!cache.has(key)) cache.set(key, factory());
  return cache.get(key);
}

/* ------------------------------------------------------------------ *
 * Oak strip flooring — 7 cm boards, satin lacquer, worn traffic lane. *
 * ------------------------------------------------------------------ */
export function oakFloor() {
  return once('oakFloor', () => {
    const grain = makeRidged2D(11, 4);
    const blot = makeFbm2D(12, 4);
    const dust = makeFbm2D(13, 3);
    const rnd = mulberry32(77);
    // 8 boards across the tile, staggered ends.
    const boards = 8;
    const tone = [];
    for (let i = 0; i < boards * 4; i++) tone.push(0.82 + rnd() * 0.36);

    return bake(512, (u, v, x, y, out) => {
      const bi = Math.floor(v * boards);
      const rowOffset = (bi % 2) * 0.37;
      const along = (u + rowOffset) % 1;
      const seg = Math.floor(along * 2);
      const t = tone[(bi * 4 + seg) % tone.length];

      // Grain stretched along the board length.
      const g = grain(along * 26 + bi * 3.1, (v * boards - bi) * 3.4 + bi * 7.7);
      const g2 = blot(along * 9, v * boards * 2.2);
      let base = 0.56 * t + g * 0.12 + g2 * 0.05;

      // Patches where the lacquer has been polished thin by years of feet.
      const wear = clamp01(blot(along * 3.5 + 40, v * 3.5) * 1.3 + 0.35) * 0.8;
      base += wear * 0.045;

      let r = base * 1.00, gg = base * 0.72, b = base * 0.46;

      // Board seams: dark v-groove.
      const seamV = Math.abs((v * boards) % 1 - 0.5);
      const seam = smooth(0.5, 0.455, seamV);
      // Butt joints between board segments.
      const seamU = Math.abs((along * 2) % 1 - 0.5);
      const butt = smooth(0.5, 0.487, seamU);
      const groove = Math.max(seam, butt);
      r *= 1 - groove * 0.75; gg *= 1 - groove * 0.78; b *= 1 - groove * 0.8;

      // Household dust settles in grain and grooves.
      const d = clamp01(dust(u * 6, v * 6) * 0.5 + 0.5);
      r = r * (1 - d * 0.06) + d * 0.035;
      gg = gg * (1 - d * 0.06) + d * 0.034;
      b = b * (1 - d * 0.06) + d * 0.032;

      const rough = clamp01(0.34 + g * 0.22 + wear * 0.30 + d * 0.18 + groove * 0.3);
      const h = 0.55 + g * 0.20 - groove * 0.65 - Math.max(0, g) * 0.05;
      out[0] = r; out[1] = gg; out[2] = b; out[3] = rough; out[4] = h;
    }, { normalStrength: 2.6, repeat: 1 });
  });
}

/* ------------------------------------------- *
 * Roller-applied matte wall paint over plaster *
 * ------------------------------------------- */
export function wallPaint(tint = [0.74, 0.71, 0.66], seed = 21) {
  return once('wall' + seed + tint.join(','), () => {
    const stipple = makeFbm2D(seed, 5);
    const large = makeFbm2D(seed + 1, 3);
    return bake(384, (u, v, x, y, out) => {
      const s = stipple(u * 40, v * 40) * 0.5 + 0.5;   // orange-peel from the roller
      const l = large(u * 3, v * 3) * 0.5 + 0.5;        // subtle patchiness
      const shade = 0.94 + s * 0.06 + (l - 0.5) * 0.05;
      // Scuffs and hand-grime in irregular patches, not in bands (the texture
      // tiles across walls of every height).
      const grime = clamp01(large(u * 1.7 + 9, v * 1.7) * 1.1 + 0.28) * 0.045;
      out[0] = tint[0] * shade * (1 - grime);
      out[1] = tint[1] * shade * (1 - grime * 1.05);
      out[2] = tint[2] * shade * (1 - grime * 1.1);
      out[3] = clamp01(0.86 + s * 0.10 - grime * 0.1);
      out[4] = 0.5 + (s - 0.5) * 0.5 + (l - 0.5) * 0.15;
    }, { normalStrength: 1.1, repeat: 1 });
  });
}

/* ------------------------------ *
 * Sprayed / skimmed plaster ceiling *
 * ------------------------------ */
export function ceilingPlaster() {
  return once('ceil', () => {
    const f = makeFbm2D(41, 5);
    return bake(256, (u, v, x, y, out) => {
      const n = f(u * 26, v * 26) * 0.5 + 0.5;
      const c = 0.74 + n * 0.035;
      out[0] = c; out[1] = c * 0.99; out[2] = c * 0.965;
      out[3] = clamp01(0.93 + n * 0.05);
      out[4] = 0.5 + (n - 0.5) * 0.35;
    }, { normalStrength: 0.5 });
  });
}

/* --------------------------------------------------- *
 * 65 mm rubber-covered fire hose — circular woven jacket *
 * --------------------------------------------------- */
export function hoseJacket() {
  return once('hose', () => {
    const soil = makeFbm2D(61, 4);
    return bake(256, (u, v, x, y, out) => {
      // Circular weave: warp yarns along the hose, weft spiralling round it.
      const warp = Math.sin(v * Math.PI * 2 * 42);
      const weft = Math.sin(u * Math.PI * 2 * 10 + v * 5.0);
      const weave = warp * 0.55 + weft * 0.45;
      const s = soil(u * 7, v * 7) * 0.5 + 0.5;
      let r = 0.42, g = 0.075, b = 0.075;                  // service red jacket
      const shade = 0.82 + weave * 0.12 + s * 0.14;
      r *= shade; g *= shade; b *= shade;
      // Soot and floor grime picked up on the job.
      const soot = clamp01(s * 1.25 - 0.45) * 0.55;
      r = r * (1 - soot) + 0.035 * soot;
      g = g * (1 - soot) + 0.032 * soot;
      b = b * (1 - soot) + 0.030 * soot;
      out[0] = r; out[1] = g; out[2] = b;
      out[3] = clamp01(0.66 + weave * 0.08 + soot * 0.2);
      out[4] = 0.5 + weave * 0.35 + (s - 0.5) * 0.1;
    }, { normalStrength: 2.2 });
  });
}

/* ---------------------------------------- *
 * Nomex turnout-coat shell: twill + soiling *
 * ---------------------------------------- */
export function turnoutShell(tint = [0.52, 0.30, 0.06]) {
  return once('turnout' + tint.join(','), () => {
    const soil = makeFbm2D(81, 5);
    return bake(256, (u, v, x, y, out) => {
      // Nomex twill: a 2/1 diagonal, coarse enough to read at arm's length
      // without aliasing into moire when the camera pulls back.
      const twill = Math.sin((u * 26 + v * 26) * Math.PI * 2 / 3.0);
      const cross = Math.sin((u * 26 - v * 26) * Math.PI * 2 / 9.0) * 0.35;
      const w = twill * 0.20 + cross * 0.6;
      const s = soil(u * 5, v * 5) * 0.5 + 0.5;
      const shade = 0.90 + w * 0.035 + (s - 0.5) * 0.20;
      const soot = clamp01(s * 1.5 - 0.62) * 0.6;
      out[0] = tint[0] * shade * (1 - soot) + 0.030 * soot;
      out[1] = tint[1] * shade * (1 - soot) + 0.028 * soot;
      out[2] = tint[2] * shade * (1 - soot) + 0.027 * soot;
      out[3] = clamp01(0.80 + w * 0.06 + soot * 0.1);
      out[4] = 0.5 + w * 0.30;
    }, { normalStrength: 1.0 });
  });
}

/* ----------------------------------------------------- *
 * Filament-wound composite SCBA cylinder (carbon over glass) *
 * ----------------------------------------------------- */
export function filamentWound() {
  return once('filament', () => {
    const fib = makeRidged2D(91, 3);
    const scuff = makeFbm2D(92, 4);
    return bake(256, (u, v, x, y, out) => {
      // Helical tows crossing at roughly +-20 degrees, plus hoop wraps.
      const a = Math.sin((u * 12 + v * 5) * Math.PI * 2);
      const b = Math.sin((u * 12 - v * 5) * Math.PI * 2);
      const hoop = Math.sin(v * Math.PI * 2 * 14) * 0.22;
      const tow = Math.max(a, b) * 0.42 + hoop;
      const f = fib(u * 60, v * 22);
      const s = scuff(u * 8, v * 8) * 0.5 + 0.5;
      // Bright safety yellow gelcoat, tow pattern showing through.
      const base = 0.84 + tow * 0.06 + f * 0.035;
      let r = 0.86 * base, g = 0.66 * base, bl = 0.07 * base;
      const wear = clamp01(s * 1.4 - 0.72) * 0.5;         // scuffs from ladder rungs
      r = r * (1 - wear) + 0.16 * wear; g = g * (1 - wear) + 0.14 * wear; bl = bl * (1 - wear) + 0.12 * wear;
      out[0] = r; out[1] = g; out[2] = bl;
      out[3] = clamp01(0.22 + f * 0.18 + wear * 0.35);
      out[4] = 0.5 + tow * 0.18 + f * 0.08;
    }, { normalStrength: 0.8 });
  });
}

/* ----------------------- *
 * Brushed / anodised metal *
 * ----------------------- */
export function brushedMetal(tint = [0.62, 0.63, 0.65], seed = 101) {
  return once('metal' + seed + tint.join(','), () => {
    const streak = makeFbm2D(seed, 4);
    const pit = makeFbm2D(seed + 5, 5);
    return bake(256, (u, v, x, y, out) => {
      const s = streak(u * 220, v * 4) * 0.5 + 0.5;   // brushing runs along u
      const p = pit(u * 40, v * 40) * 0.5 + 0.5;
      const shade = 0.86 + s * 0.20;
      out[0] = tint[0] * shade; out[1] = tint[1] * shade; out[2] = tint[2] * shade;
      out[3] = clamp01(0.24 + s * 0.22 + clamp01(p * 1.4 - 0.8) * 0.4);
      out[4] = 0.5 + (s - 0.5) * 0.5 + (p - 0.5) * 0.12;
    }, { normalStrength: 1.0 });
  });
}

/* ------------------------------------ *
 * Upholstery / rug wool — soft fibre nap *
 * ------------------------------------ */
export function wovenWool(tint = [0.30, 0.26, 0.34], seed = 131, fine = 90) {
  return once('wool' + seed + tint.join(',') + fine, () => {
    const nap = makeFbm2D(seed, 5);
    const yarn = makeRidged2D(seed + 3, 3);
    return bake(256, (u, v, x, y, out) => {
      const n = nap(u * fine, v * fine) * 0.5 + 0.5;
      const yv = yarn(u * 34, v * 34);
      const weave = Math.sin(u * Math.PI * 2 * 34) * Math.sin(v * Math.PI * 2 * 34);
      const shade = 0.90 + n * 0.13 + weave * 0.035 + yv * 0.035;
      out[0] = tint[0] * shade; out[1] = tint[1] * shade; out[2] = tint[2] * shade;
      out[3] = clamp01(0.88 + n * 0.10);
      out[4] = 0.5 + (n - 0.5) * 0.45 + weave * 0.10;
    }, { normalStrength: 1.1 });
  });
}

/* ------------------------------- *
 * Plush fur for the teddy / kitten *
 * ------------------------------- */
export function plushFur(tint = [0.72, 0.52, 0.30], seed = 151) {
  return once('fur' + seed + tint.join(','), () => {
    const f = makeRidged2D(seed, 4);
    const c = makeFbm2D(seed + 2, 3);
    return bake(256, (u, v, x, y, out) => {
      const strands = f(u * 70, v * 70);
      const clump = c(u * 12, v * 12) * 0.5 + 0.5;
      const shade = 0.78 + strands * 0.30 + (clump - 0.5) * 0.18;
      out[0] = tint[0] * shade; out[1] = tint[1] * shade; out[2] = tint[2] * shade;
      out[3] = clamp01(0.90 + strands * 0.08);
      out[4] = 0.5 + strands * 0.45;
    }, { normalStrength: 2.4 });
  });
}

/* --------------------------------------------- *
 * Painted MDF joinery (doors, skirting, cabinets) *
 * --------------------------------------------- */
export function paintedJoinery(tint = [0.88, 0.87, 0.84]) {
  return once('joinery' + tint.join(','), () => {
    const brush = makeFbm2D(171, 4);
    const chip = makeFbm2D(172, 5);
    return bake(256, (u, v, x, y, out) => {
      const b = brush(u * 34, v * 6) * 0.5 + 0.5;   // brush drag marks
      const ch = clamp01(chip(u * 30, v * 30) * 1.6 - 0.95);
      const shade = 0.95 + b * 0.06;
      out[0] = tint[0] * shade * (1 - ch * 0.35);
      out[1] = tint[1] * shade * (1 - ch * 0.38);
      out[2] = tint[2] * shade * (1 - ch * 0.40);
      out[3] = clamp01(0.52 + b * 0.14 + ch * 0.4);
      out[4] = 0.5 + (b - 0.5) * 0.18 - ch * 0.4;
    }, { normalStrength: 0.5 });
  });
}

/* ----------------------------- *
 * Moulded rubber (boots, gaskets) *
 * ----------------------------- */
export function rubber(tint = [0.055, 0.055, 0.06], seed = 191) {
  return once('rubber' + seed + tint.join(','), () => {
    const g = makeFbm2D(seed, 5);
    return bake(128, (u, v, x, y, out) => {
      const n = g(u * 45, v * 45) * 0.5 + 0.5;
      const shade = 0.85 + n * 0.3;
      out[0] = tint[0] * shade; out[1] = tint[1] * shade; out[2] = tint[2] * shade;
      out[3] = clamp01(0.72 + n * 0.16);
      out[4] = 0.5 + (n - 0.5) * 0.6;
    }, { normalStrength: 1.6 });
  });
}

/* ------------------------------------------------------- *
 * Retro-reflective trim: glass-bead tape, silver + lime rows *
 * ------------------------------------------------------- */
export function reflectiveTape() {
  return once('tape', () => {
    const beads = makeFbm2D(211, 4);
    const soil = makeFbm2D(212, 3);
    return bake(128, (u, v, x, y, out) => {
      const band = v % 1;
      const lime = band < 0.28 || band > 0.72;      // fluorescent yellow-green edges
      const b = beads(u * 130, v * 130) * 0.5 + 0.5; // the glass bead layer sparkles
      const s = clamp01(soil(u * 9, v * 9) * 0.6 + 0.5);
      const sootiness = 1 - clamp01(s * 0.35);
      if (lime) {
        out[0] = 0.62 * (0.85 + b * 0.3) * sootiness;
        out[1] = 0.86 * (0.85 + b * 0.3) * sootiness;
        out[2] = 0.10 * (0.85 + b * 0.3) * sootiness;
      } else {
        const g = (0.72 + b * 0.34) * sootiness;
        out[0] = g * 0.94; out[1] = g * 0.97; out[2] = g;
      }
      out[3] = clamp01(0.30 + b * 0.25);
      out[4] = 0.5 + (b - 0.5) * 0.8;
    }, { normalStrength: 2.6 });
  });
}

/** Soft round contact-shadow blob used under furniture feet and bodies. */
export function contactShadowTexture() {
  return once('contact', () => {
    const size = 128;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
        const d = Math.hypot(dx, dy) * 2;
        const a = Math.pow(clamp01(1 - d), 2.2);
        const i = (y * size + x) * 4;
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = a * 255;
      }
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  });
}

/** Soft radial sprite for glows, dust motes and smoke puffs. */
export function softSprite(power = 2.0, inner = 1.0) {
  return once('soft' + power + inner, () => {
    const size = 128;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
        const d = Math.min(1, Math.hypot(dx, dy) * 2);
        const a = Math.pow(1 - d, power) * inner;
        const i = (y * size + x) * 4;
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = clamp01(a) * 255;
      }
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  });
}

/** Fluffy noise blob for smoke billows (alpha only). */
export function smokePuffTexture() {
  return once('puff', () => {
    const size = 128;
    const f = makeFbm2D(311, 5);
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
        const d = Math.min(1, Math.hypot(dx, dy) * 2);
        const n = f(x / size * 4, y / size * 4) * 0.5 + 0.5;
        const a = clamp01(Math.pow(1 - d, 1.6) * (0.35 + n * 1.15) - 0.06);
        const i = (y * size + x) * 4;
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = a * 255;
      }
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  });
}
