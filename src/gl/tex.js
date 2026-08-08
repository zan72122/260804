/* =========================================================================
   tex.js — procedural materials.  Every surface gets albedo + ORM
   (occlusion / roughness / metallic) + a normal map derived from a height
   field, so wear, grain, grime and machining marks respond to the light.
   ========================================================================= */
'use strict';

/* ------------------------------------------------------------------ noise */
const Noise = {
  p: new Uint8Array(512),
  seed(s) {
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    let r = s || 1;
    const rand = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  },
  g(ix, iy) { return this.p[(ix + this.p[iy & 255]) & 255] / 255; },
  /** tileable value noise over a period of `per` cells */
  n2(x, y, per) {
    per = per || 256;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = this.g(((x0 % per) + per) % per, ((y0 % per) + per) % per);
    const b = this.g(((x0 + 1) % per + per) % per, ((y0 % per) + per) % per);
    const c = this.g(((x0 % per) + per) % per, ((y0 + 1) % per + per) % per);
    const d = this.g(((x0 + 1) % per + per) % per, ((y0 + 1) % per + per) % per);
    return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
  },
  fbm(x, y, oct, per) {
    let v = 0, a = 0.5, f = 1, norm = 0;
    for (let i = 0; i < (oct || 5); i++) {
      v += a * this.n2(x * f, y * f, (per || 8) * f);
      norm += a; a *= 0.5; f *= 2;
    }
    return v / norm;
  },
  ridge(x, y, oct, per) {
    let v = 0, a = 0.5, f = 1, norm = 0;
    for (let i = 0; i < (oct || 4); i++) {
      v += a * (1 - Math.abs(this.n2(x * f, y * f, (per || 8) * f) * 2 - 1));
      norm += a; a *= 0.5; f *= 2;
    }
    return v / norm;
  }
};
Noise.seed(20260808);

const Tex = {
  cache: {},

  cv(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  },

  /**
   * Build albedo / ORM / normal from a single per-texel callback.
   * fn(u, v) -> { r,g,b (0..1 linear-ish), ao, rough, metal, h }
   */
  build(size, fn, normalStrength) {
    const alb = this.cv(size), orm = this.cv(size), nrm = this.cv(size);
    const ac = alb.getContext('2d'), oc = orm.getContext('2d'), nc = nrm.getContext('2d');
    const ai = ac.createImageData(size, size);
    const oi = oc.createImageData(size, size);
    const ni = nc.createImageData(size, size);
    const H = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const s = fn((x + 0.5) / size, (y + 0.5) / size, x, y);
        ai.data[i * 4] = Math.max(0, Math.min(255, s.r * 255));
        ai.data[i * 4 + 1] = Math.max(0, Math.min(255, s.g * 255));
        ai.data[i * 4 + 2] = Math.max(0, Math.min(255, s.b * 255));
        ai.data[i * 4 + 3] = 255;
        oi.data[i * 4] = Math.max(0, Math.min(255, (s.ao === undefined ? 1 : s.ao) * 255));
        oi.data[i * 4 + 1] = Math.max(0, Math.min(255, (s.rough === undefined ? 0.6 : s.rough) * 255));
        oi.data[i * 4 + 2] = Math.max(0, Math.min(255, (s.metal === undefined ? 0 : s.metal) * 255));
        oi.data[i * 4 + 3] = 255;
        H[i] = s.h === undefined ? 0.5 : s.h;
      }
    }
    // Sobel the height field into a tangent-space normal map
    const st = normalStrength === undefined ? 2.2 : normalStrength;
    const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
                 - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
        const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))
                 - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
        let nx = -dx * st, ny = -dy * st, nz = 1;
        const l = Math.hypot(nx, ny, nz) || 1;
        ni.data[i * 4] = (nx / l * 0.5 + 0.5) * 255;
        ni.data[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255;
        ni.data[i * 4 + 2] = (nz / l * 0.5 + 0.5) * 255;
        ni.data[i * 4 + 3] = 255;
      }
    }
    ac.putImageData(ai, 0, 0); oc.putImageData(oi, 0, 0); nc.putImageData(ni, 0, 0);
    return { albedo: alb, orm, normal: nrm };
  },

  /* --------------------------------------------------------- the materials */
  makeAll() {
    const M = {};
    const N = Noise;

    // ---- brushed stainless steel: fine horizontal grain, micro pitting,
    //      fingerprints where hands go, dulled where it is wiped daily
    M.steel = this.build(512, (u, v) => {
      const brush = N.fbm(u * 640, v * 5, 4, 512) * 0.62 + N.n2(u * 1100, v * 3, 512) * 0.38;
      const pit = N.fbm(u * 220, v * 220, 4, 220);
      const wipe = N.fbm(u * 7 + 3, v * 7, 4, 8);
      const prints = Math.max(0, N.fbm(u * 26, v * 26, 3, 32) - 0.56) * 2.6;
      const g = 0.545 + (brush - 0.5) * 0.07 + (pit - 0.5) * 0.03;
      return {
        r: g * 0.99, g: g, b: g * 1.03,
        ao: 1 - Math.max(0, 0.45 - pit) * 0.25,
        rough: clamp(0.30 + (brush - 0.5) * 0.20 + (wipe - 0.5) * 0.10 + prints * 0.26, 0.08, 0.8),
        metal: 1,
        h: brush * 0.62 + pit * 0.32 + prints * 0.06
      };
    }, 1.6);

    // ---- polished chrome: near mirror, faint swirl marks and dust
    M.chrome = this.build(256, (u, v) => {
      const swirl = N.n2(u * 700, v * 700, 256);
      const dust = Math.max(0, N.fbm(u * 40, v * 40, 3, 48) - 0.6) * 2;
      return {
        r: 0.56, g: 0.57, b: 0.58,
        ao: 1, rough: clamp(0.055 + (swirl - 0.5) * 0.04 + dust * 0.35, 0.02, 0.5),
        metal: 1, h: swirl * 0.4 + dust * 0.6
      };
    }, 0.7);

    // ---- oiled oak counter: grain, end-grain darkening, coffee rings,
    //      a polished worn band where the barista stands
    M.wood = this.build(512, (u, v) => {
      const gx = u * 3.0, gy = v * 26;
      const warp = N.fbm(gx * 2, gy * 0.4, 4, 16) * 0.9;
      const rings = Math.abs(Math.sin((gy + warp * 3.2) * Math.PI));
      const grain = Math.pow(rings, 0.35);
      const fibre = N.n2(u * 1400, v * 30, 512);
      const knot = Math.max(0, 1 - Math.hypot(u - 0.72, v - 0.33) * 12);
      const stain = Math.max(0, N.fbm(u * 9 + 11, v * 9, 4, 12) - 0.58) * 2.4;
      const wear = N.fbm(u * 3.5 + 40, v * 3.5, 3, 5);
      let r = 0.40, g = 0.27, b = 0.17;
      const dark = grain * 0.34 + knot * 0.5;
      r -= dark * 0.22; g -= dark * 0.17; b -= dark * 0.11;
      r += fibre * 0.05; g += fibre * 0.04; b += fibre * 0.03;
      // coffee stain rings, darker and glossier
      r -= stain * 0.13; g -= stain * 0.11; b -= stain * 0.08;
      return {
        r, g, b,
        ao: 1 - grain * 0.12 - knot * 0.3,
        rough: clamp(0.72 - wear * 0.16 + grain * 0.10 - stain * 0.12, 0.34, 0.94),
        metal: 0,
        h: 1 - grain * 0.7 - knot * 0.4 + fibre * 0.2
      };
    }, 1.4);

    // ---- glazed subway tile splashback: bevelled edges, grout, milk splatter
    M.tile = this.build(512, (u, v) => {
      const rows = 10, cols = 5;
      const ry = v * rows;
      const row = Math.floor(ry);
      const off = (row % 2) * 0.5;
      const rx = (u * cols + off) % 1;
      const fy = ry - row;
      const gw = 0.045;
      const eu = Math.min(rx, 1 - rx), ev = Math.min(fy, 1 - fy);
      const e = Math.min(eu, ev);
      const grout = e < gw ? 1 : 0;
      const bevel = smoothstep(gw, gw + 0.05, e);
      const glaze = N.fbm(u * 60, v * 60, 3, 64);
      const splat = Math.max(0, N.fbm(u * 22 + 7, v * 22, 4, 24) - 0.62) * 2.2 * (1 - v * 0.5);
      const base = grout ? 0.30 : 0.90;
      const tint = grout ? 0.94 : 1.0;
      return {
        r: base * 0.99 * tint + splat * 0.05,
        g: base * 0.955 * tint + splat * 0.04,
        b: base * 0.92 * tint + splat * 0.03,
        ao: grout ? 0.55 : 1 - (1 - bevel) * 0.25,
        rough: grout ? 0.92 : clamp(0.13 + (glaze - 0.5) * 0.08 + splat * 0.5, 0.06, 0.9),
        metal: 0,
        h: grout ? 0.15 : 0.55 + bevel * 0.45 + glaze * 0.05
      };
    }, 2.6);

    // ---- concrete floor, scuffed
    M.floor = this.build(512, (u, v) => {
      const c = N.fbm(u * 14, v * 14, 5, 16);
      const scuff = N.fbm(u * 4 + 21, v * 4, 3, 6);
      const spec = Math.max(0, N.fbm(u * 90, v * 90, 3, 96) - 0.62);
      const g = 0.17 + c * 0.10 + spec * 0.25;
      return {
        r: g * 1.06, g: g * 1.0, b: g * 0.94,
        ao: 1 - c * 0.18, rough: clamp(0.78 - scuff * 0.2, 0.3, 0.95), metal: 0,
        h: c * 0.7 + spec * 0.3
      };
    }, 1.4);

    // ---- porcelain: very smooth, faint crazing, slight translucency tint
    M.porcelain = this.build(256, (u, v) => {
      const craze = Math.max(0, N.ridge(u * 30, v * 30, 3, 32) - 0.86) * 7;
      const dim = N.fbm(u * 8, v * 8, 3, 10);
      return {
        r: 0.93 + dim * 0.03, g: 0.915 + dim * 0.03, b: 0.885 + dim * 0.03,
        ao: 1 - craze * 0.1,
        rough: clamp(0.11 + craze * 0.25 + (dim - 0.5) * 0.03, 0.05, 0.6),
        metal: 0, h: 0.5 - craze * 0.5
      };
    }, 0.8);

    // ---- matte rubber (tamping mat, gaskets, feet)
    M.rubber = this.build(256, (u, v) => {
      const g1 = N.fbm(u * 120, v * 120, 3, 128);
      const worn = N.fbm(u * 5 + 60, v * 5, 3, 6);
      const g = 0.055 + g1 * 0.035 + worn * 0.02;
      return { r: g, g: g * 0.98, b: g * 0.99, ao: 1 - g1 * 0.1,
               rough: clamp(0.94 - worn * 0.25, 0.4, 1), metal: 0, h: g1 };
    }, 1.6);

    // ---- ground coffee: granular, very matte, oily sheen when fresh
    M.coffee = this.build(256, (u, v) => {
      const grain = N.fbm(u * 150, v * 150, 4, 160);
      const chunk = N.n2(u * 60, v * 60, 64);
      const g = 0.052 + grain * 0.055 + chunk * 0.02;
      return { r: g * 1.28, g: g * 0.88, b: g * 0.62,
               ao: 1 - grain * 0.35, rough: clamp(0.92 - chunk * 0.18, 0.5, 1), metal: 0,
               h: grain * 0.7 + chunk * 0.3 };
    }, 3.0);

    // ---- painted / powder-coated panels (grinder body, machine side panels)
    M.paint = this.build(256, (u, v) => {
      const orange = N.fbm(u * 90, v * 90, 3, 96);
      const chip = Math.max(0, N.fbm(u * 30 + 5, v * 30, 4, 32) - 0.86) * 1.6;
      const g = 0.055 + orange * 0.02;
      return { r: g + chip * 0.09, g: g + chip * 0.085, b: g * 1.05 + chip * 0.085,
               ao: 1 - chip * 0.2, rough: clamp(0.42 + orange * 0.12 + chip * 0.4, 0.2, 0.95),
               metal: chip > 0.4 ? 0.7 : 0, h: orange * 0.6 - chip * 0.4 + 0.4 };
    }, 1.2);

    // ---- brass / bronze fittings
    M.brass = this.build(256, (u, v) => {
      const p = N.fbm(u * 140, v * 140, 4, 150);
      const tarnish = N.fbm(u * 12, v * 12, 4, 14);
      return { r: 0.78 - tarnish * 0.16, g: 0.60 - tarnish * 0.18, b: 0.28 - tarnish * 0.10,
               ao: 1 - p * 0.1, rough: clamp(0.24 + tarnish * 0.35 + p * 0.1, 0.08, 0.8),
               metal: 1, h: p };
    }, 1.2);

    // ---- plain neutral, for parts that carry their own colour
    M.blank = this.build(8, () => ({ r: 1, g: 1, b: 1, ao: 1, rough: 0.5, metal: 0, h: 0.5 }), 0);

    return M;
  },

  /* ---------------------------------------------------------- environment */
  /**
   * An equirectangular room the metal can actually reflect: a warm ceiling
   * with two pendant lamps, a big cool window to the left, plaster walls,
   * a dark floor.  This is what gives stainless steel its readable shape.
   */
  environment(w, h) {
    const data = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const phi = (y + 0.5) / h * Math.PI;           // 0 = up
      const cy = Math.cos(phi), sy = Math.sin(phi);
      for (let x = 0; x < w; x++) {
        const th = ((x + 0.5) / w - 0.5) * TAU;
        const dx = sy * Math.sin(th), dz = sy * Math.cos(th);
        let r, g, b;
        if (cy > 0.15) {
          // ceiling: warm plaster with two hot pendant discs
          const t = (cy - 0.15) / 0.85;
          r = 0.42 + t * 0.34; g = 0.395 + t * 0.31; b = 0.355 + t * 0.27;
          // a broad soft trough over the bar — this is what shapes the steel
          const trough = Math.max(0, 1 - Math.abs(dz + 0.45) * 2.1) * Math.max(0, cy - 0.30) * 2.4;
          r += trough * 1.25; g += trough * 1.10; b += trough * 0.90;
          const lampA = Math.max(0, 1 - Math.hypot(dx - 0.22, dz + 0.30) * 6.5) * Math.max(0, cy - 0.55);
          const lampB = Math.max(0, 1 - Math.hypot(dx + 0.30, dz + 0.10) * 6.5) * Math.max(0, cy - 0.55);
          const L = (lampA + lampB) * 42;
          r += L * 1.00; g += L * 0.86; b += L * 0.66;
        } else if (cy > -0.16) {
          // wall band, with a bright window on the left (-x)
          const t = (cy + 0.16) / 0.31;
          r = 0.15 + t * 0.20; g = 0.132 + t * 0.175; b = 0.116 + t * 0.150;
          const win = Math.max(0, 1 - Math.abs(dx + 0.93) * 2.6)
                    * Math.max(0, 1 - Math.abs(dz - 0.05) * 1.5)
                    * smoothstep(-0.14, 0.05, cy);
          r += win * 11.0; g += win * 12.0; b += win * 13.6;
          // warm backbar glow behind the machine
          const bar = Math.max(0, 1 - Math.hypot(dx - 0.15, dz + 0.92) * 1.9) * (1 - Math.abs(cy) * 3);
          r += Math.max(0, bar) * 0.5; g += Math.max(0, bar) * 0.34; b += Math.max(0, bar) * 0.20;
        } else {
          // counter and floor: dark, warm, with a soft bounce near the horizon
          const t = Math.min(1, (-cy - 0.16) / 0.84);
          r = 0.065 - t * 0.042; g = 0.052 - t * 0.034; b = 0.043 - t * 0.028;
          const bounce = Math.max(0, 1 - t * 4) * 0.10;
          r += bounce; g += bounce * 0.82; b += bounce * 0.62;
        }
        const i = (y * w + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 1;
      }
    }
    return { w, h, data };
  }
};
