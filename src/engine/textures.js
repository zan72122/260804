// Procedural texture factory.
//
// Every surface in the game gets its albedo / roughness / bump from canvases
// painted here — no image files, but the maps carry the things that make a
// material read as real: grain direction, tool marks, grime pooling in the
// crevices, edge wear where hands and crates rub, and roughness that varies
// across the surface instead of a single flat number.

import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { makeRng, clamp, lerp } from './util.js';

const noise = new ImprovedNoise();
const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d', { willReadFrequently: true }) };
}

function fbm(x, y, z, octaves = 4, lac = 2.0, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise.noise(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= gain; freq *= lac;
  }
  return sum / norm; // ~[-1, 1]
}

/** Per-pixel painting helper. cb(x, y, u, v) -> [r,g,b] in 0..255 */
function paint(w, h, cb) {
  const { c, ctx } = canvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rgb = cb(x, y, x / w, y / h);
      d[i++] = rgb[0]; d[i++] = rgb[1]; d[i++] = rgb[2]; d[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { c, ctx };
}

function finish(c, { srgb = false, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

function memo(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

const hexRgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const shade = (rgb, k) => [clamp(rgb[0] * k, 0, 255), clamp(rgb[1] * k, 0, 255), clamp(rgb[2] * k, 0, 255)];

// ---------------------------------------------------------------- wood ----

/**
 * Sawn plank: rings running along U, cross-cut saw marks, darkened knots and
 * grime that collects along the plank seams.
 * @param {object} o  base/dark colours, plank count, wear amount
 */
export function wood(o = {}) {
  const {
    base = 0xa9855a, dark = 0x5d4023, planks = 4, size = 512,
    rings = 26, wear = 0.5, seed = 7, horizontal = false,
  } = o;
  const key = `wood|${base}|${dark}|${planks}|${rings}|${wear}|${seed}|${horizontal}|${size}`;
  return memo(key, () => {
    const cBase = hexRgb(base), cDark = hexRgb(dark);
    const rng = makeRng(seed);
    const plankOff = Array.from({ length: planks }, () => rng.range(0, 10));
    const plankTone = Array.from({ length: planks }, () => rng.range(0.86, 1.12));

    const albedo = paint(size, size, (x, y, u, v) => {
      const su = horizontal ? v : u, sv = horizontal ? u : v;
      const pIdx = Math.min(planks - 1, Math.floor(sv * planks));
      const pLocal = sv * planks - pIdx;               // 0..1 within plank
      const off = plankOff[pIdx];

      // Growth rings: near-vertical bands warped by low-freq noise.
      const warp = fbm(su * 3.0 + off, sv * 1.4, 0.3, 3) * 0.35;
      let ring = Math.sin((su + warp + off) * rings * Math.PI);
      ring = Math.pow(Math.abs(ring), 0.55);
      let t = 0.35 + ring * 0.4;

      // Fine fibre streaks along the grain.
      t += fbm(su * 160, sv * 6 + off * 3, 1.7, 2) * 0.09;
      // Blotchy figure.
      t += fbm(su * 7, sv * 7, 4.2, 3) * 0.1;

      // Knots.
      const kx = 0.28 + off * 0.05, ky = 0.5;
      const dk = Math.hypot((su - kx) * 1.0, (pLocal - ky) * 0.42);
      if (dk < 0.09) t -= (0.09 - dk) * 6.0 * (pIdx % 2 ? 1 : 0.4);

      let rgb = mixRgb(cDark, cBase, clamp(t, 0, 1));
      rgb = shade(rgb, plankTone[pIdx]);

      // Seam between planks: deep shadow gap + dirt bleeding out of it.
      const seam = Math.min(pLocal, 1 - pLocal);
      if (seam < 0.028) rgb = shade(rgb, lerp(0.22, 1, seam / 0.028));
      else if (seam < 0.12) rgb = shade(rgb, lerp(0.78, 1, (seam - 0.028) / 0.092));

      // Wear: bleached scuff patches + greasy dark patches.
      const scuff = fbm(su * 5.5 + 30, sv * 5.5, 9.1, 4);
      rgb = shade(rgb, 1 + scuff * 0.18 * wear);
      const grime = clamp(fbm(su * 2.2, sv * 2.2, 21.0, 3) * 1.6, 0, 1);
      rgb = mixRgb(rgb, [52, 40, 30], grime * 0.3 * wear);
      return rgb;
    }).c;

    const rough = paint(size >> 1, size >> 1, (x, y, u, v) => {
      const su = horizontal ? v : u, sv = horizontal ? u : v;
      const pIdx = Math.min(planks - 1, Math.floor(sv * planks));
      const pLocal = sv * planks - pIdx;
      let r = 0.62 + fbm(su * 90, sv * 5, 5.5, 2) * 0.12;
      r += fbm(su * 4, sv * 4, 13.0, 3) * 0.2;      // polished vs raw patches
      const seam = Math.min(pLocal, 1 - pLocal);
      if (seam < 0.05) r = clamp(r + 0.25, 0, 1);   // dusty seams stay matte
      const g = Math.round(clamp(r, 0.18, 0.98) * 255);
      return [g, g, g];
    }).c;

    const bump = paint(size >> 1, size >> 1, (x, y, u, v) => {
      const su = horizontal ? v : u, sv = horizontal ? u : v;
      const pIdx = Math.min(planks - 1, Math.floor(sv * planks));
      const pLocal = sv * planks - pIdx;
      const warp = fbm(su * 3.0, sv * 1.4, 0.3, 3) * 0.35;
      let h = 0.5 + Math.sin((su + warp) * rings * Math.PI) * 0.08;
      h += fbm(su * 140, sv * 6, 1.7, 2) * 0.14;
      const seam = Math.min(pLocal, 1 - pLocal);
      if (seam < 0.03) h -= (0.03 - seam) * 9;
      const g = Math.round(clamp(h, 0, 1) * 255);
      return [g, g, g];
    }).c;

    return {
      map: finish(albedo, { srgb: true }),
      roughnessMap: finish(rough),
      bumpMap: finish(bump),
    };
  });
}

// ------------------------------------------------------------- masonry ----

/** Cobblestone plaza paving with mortar gaps, puddled grime and worn crowns. */
export function cobble(o = {}) {
  const { base = 0x8b8378, seed = 3, size = 512, cells = 9 } = o;
  return memo(`cobble|${base}|${seed}|${cells}`, () => {
    const rng = makeRng(seed);
    const pts = [];
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        pts.push({
          x: (i + 0.5 + rng.range(-0.34, 0.34)) / cells,
          y: (j + 0.5 + rng.range(-0.34, 0.34)) / cells,
          tone: rng.range(0.74, 1.2),
          hue: rng.range(-0.06, 0.06),
        });
      }
    }
    const cBase = hexRgb(base);

    const sample = (u, v) => {
      // Toroidal Worley: nearest and second-nearest give us stone + mortar.
      let d1 = 9, d2 = 9, best = pts[0];
      for (const p of pts) {
        let dx = Math.abs(u - p.x), dy = Math.abs(v - p.y);
        if (dx > 0.5) dx = 1 - dx;
        if (dy > 0.5) dy = 1 - dy;
        const d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; best = p; }
        else if (d < d2) d2 = d;
      }
      return { edge: d2 - d1, p: best, d1 };
    };

    const albedo = paint(size, size, (x, y, u0, v0) => {
      const u = u0 + fbm(u0 * 8, v0 * 8, 3.1, 2) * 0.012;
      const v = v0 + fbm(u0 * 8, v0 * 8, 7.7, 2) * 0.012;
      const { edge, p } = sample(u, v);
      let rgb = shade(cBase, p.tone);
      rgb = [rgb[0] * (1 + p.hue), rgb[1], rgb[2] * (1 - p.hue * 0.6)];
      rgb = shade(rgb, 1 + fbm(u * 70, v * 70, 11.0, 3) * 0.16);       // stone speckle
      const m = clamp(edge / 0.02, 0, 1);                              // 0 in mortar
      rgb = mixRgb(shade(cBase, 0.34), rgb, m);                        // dark mortar
      const damp = clamp(fbm(u * 2.4, v * 2.4, 41.0, 3) * 1.4 + 0.1, 0, 1);
      rgb = mixRgb(rgb, [46, 44, 42], damp * 0.34);                    // damp/dirt pools
      return rgb;
    }).c;

    const bump = paint(size >> 1, size >> 1, (x, y, u, v) => {
      const { edge } = sample(u, v);
      let h = clamp(edge / 0.025, 0, 1);
      h = 0.15 + h * 0.85;
      h += fbm(u * 60, v * 60, 17.0, 2) * 0.08;
      const g = Math.round(clamp(h, 0, 1) * 255);
      return [g, g, g];
    }).c;

    const rough = paint(size >> 1, size >> 1, (x, y, u, v) => {
      const { edge } = sample(u, v);
      const wet = clamp(fbm(u * 2.4, v * 2.4, 41.0, 3) * 1.4 + 0.1, 0, 1);
      let r = 0.94 - clamp(edge / 0.05, 0, 1) * 0.22;   // worn crowns are smoother
      r -= wet * 0.3;                                    // damp patches gloss up
      const g = Math.round(clamp(r, 0.2, 1) * 255);
      return [g, g, g];
    }).c;

    return {
      map: finish(albedo, { srgb: true }),
      bumpMap: finish(bump),
      roughnessMap: finish(rough),
    };
  });
}

/** Rendered/plastered wall: trowel swirl, hairline cracks, rising damp at base. */
export function plaster(o = {}) {
  const { base = 0xd9c3a2, seed = 11, size = 256, weather = 0.6 } = o;
  return memo(`plaster|${base}|${seed}|${weather}`, () => {
    const cBase = hexRgb(base);
    const albedo = paint(size, size, (x, y, u, v) => {
      let rgb = shade(cBase, 1 + fbm(u * 5, v * 5, seed, 4) * 0.14);
      rgb = shade(rgb, 1 + fbm(u * 40, v * 40, seed + 3, 2) * 0.07);
      // Streaks of rain-washed dirt running down the wall.
      const streak = clamp(fbm(u * 26, v * 1.5, seed + 9, 3), 0, 1);
      rgb = mixRgb(rgb, [96, 88, 78], streak * 0.3 * weather * clamp(v * 1.4, 0, 1));
      // Damp/soot at the bottom edge.
      rgb = mixRgb(rgb, [74, 68, 62], clamp((v - 0.82) / 0.18, 0, 1) * 0.45 * weather);
      // Occasional chipped render showing brick.
      const chip = fbm(u * 12, v * 12, seed + 21, 3);
      if (chip > 0.52) rgb = mixRgb(rgb, [141, 84, 62], (chip - 0.52) * 3.4 * weather);
      return rgb;
    }).c;
    const rough = paint(size >> 1, size >> 1, (x, y, u, v) => {
      const g = Math.round(clamp(0.86 + fbm(u * 9, v * 9, seed + 5, 3) * 0.12, 0.4, 1) * 255);
      return [g, g, g];
    }).c;
    const bump = paint(size >> 1, size >> 1, (x, y, u, v) => {
      let h = 0.5 + fbm(u * 18, v * 18, seed + 2, 4) * 0.35;
      h += fbm(u * 70, v * 70, seed + 8, 2) * 0.1;
      const g = Math.round(clamp(h, 0, 1) * 255);
      return [g, g, g];
    }).c;
    return { map: finish(albedo, { srgb: true }), roughnessMap: finish(rough), bumpMap: finish(bump) };
  });
}

/**
 * Building facade: windows, sills, shutters and balconies drawn as a texture
 * strip so the distant blocks stay cheap while still reading as architecture.
 * Returns { map, emissiveMap } — emissive carries the lit windows at night.
 */
export function facade(o = {}) {
  const {
    wall = 0xd8bf9c, trim = 0xf0e6d5, shutter = 0x4a6b5c,
    floors = 4, bays = 3, seed = 5, litChance = 0.45, size = 256,
  } = o;
  return memo(`facade|${wall}|${trim}|${shutter}|${floors}|${bays}|${seed}|${litChance}`, () => {
    const { c, ctx } = canvas(size, size);
    const rng = makeRng(seed);
    const px = (n) => n * size;

    // Base wall from the plaster generator so facades share the same grain.
    const base = plaster({ base: wall, seed: seed * 3, size: 256 });
    ctx.drawImage(base.map.image, 0, 0, size, size);

    const { c: ec, ctx: ectx } = canvas(size, size);
    ectx.fillStyle = '#000'; ectx.fillRect(0, 0, size, size);

    const fh = 1 / floors, bw = 1 / bays;
    for (let f = 0; f < floors; f++) {
      for (let b = 0; b < bays; b++) {
        const cx = (b + 0.5) * bw, cy = (f + 0.52) * fh;
        const w = bw * 0.42, h = fh * 0.5;
        const x0 = px(cx - w / 2), y0 = px(cy - h / 2), ww = px(w), hh = px(h);

        // Reveal + sill.
        ctx.fillStyle = `#${trim.toString(16).padStart(6, '0')}`;
        ctx.fillRect(x0 - 3, y0 - 3, ww + 6, hh + 6);
        ctx.fillRect(x0 - 6, y0 + hh + 1, ww + 12, 4);

        // Glass: dark, with a sky reflection gradient.
        const g = ctx.createLinearGradient(x0, y0, x0, y0 + hh);
        g.addColorStop(0, '#2b3138'); g.addColorStop(0.45, '#171b20'); g.addColorStop(1, '#0d1013');
        ctx.fillStyle = g; ctx.fillRect(x0, y0, ww, hh);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x0, y0, ww, hh * 0.3);
        // Muntins.
        ctx.strokeStyle = `#${trim.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0 + ww / 2, y0); ctx.lineTo(x0 + ww / 2, y0 + hh);
        ctx.moveTo(x0, y0 + hh * 0.45); ctx.lineTo(x0 + ww, y0 + hh * 0.45);
        ctx.stroke();

        // Half the windows get a shutter folded against the reveal.
        if (rng() < 0.5) {
          ctx.fillStyle = `#${shutter.toString(16).padStart(6, '0')}`;
          const sw = ww * 0.3;
          const sx = rng() < 0.5 ? x0 - sw - 3 : x0 + ww + 3;
          ctx.fillRect(sx, y0 - 2, sw, hh + 4);
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          for (let s = 0; s < 7; s++) ctx.fillRect(sx, y0 + (s + 0.5) * (hh / 7), sw, 1.5);
        }

        // Lit interior for the emissive pass.
        if (rng() < litChance) {
          const warm = rng() < 0.75 ? [255, 196, 118] : [188, 214, 255];
          ectx.fillStyle = `rgb(${warm[0]},${warm[1]},${warm[2]})`;
          ectx.globalAlpha = rng.range(0.5, 1);
          ectx.fillRect(x0 + 1, y0 + 1, ww - 2, hh - 2);
          ectx.globalAlpha = 1;
          ctx.fillStyle = `rgba(${warm[0]},${warm[1]},${warm[2]},0.5)`;
          ctx.fillRect(x0 + 1, y0 + 1, ww - 2, hh - 2);
        }
      }
      // Floor band / string course.
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(0, px((f + 1) * fh) - 2, size, 3);
    }

    // Ground-floor shopfront on the bottom band.
    ctx.fillStyle = 'rgba(30,22,18,0.55)';
    ctx.fillRect(0, size - px(fh * 0.42), size, px(fh * 0.42));

    return { map: finish(c, { srgb: true }), emissiveMap: finish(ec, { srgb: true }) };
  });
}

// ------------------------------------------------------------- fabric ----

/** Awning canvas: woven weft, printed stripes, sun-bleaching and mildew. */
export function stripes(o = {}) {
  const { a = 0xf2ece0, b = 0xc2452f, count = 7, seed = 13, size = 256, dirt = 0.5 } = o;
  return memo(`stripes|${a}|${b}|${count}|${seed}|${dirt}`, () => {
    const cA = hexRgb(a), cB = hexRgb(b);
    const albedo = paint(size, size, (x, y, u, v) => {
      const band = Math.floor(u * count) % 2 === 0;
      let rgb = band ? [...cA] : [...cB];
      // Weave: alternating warp/weft brightness at pixel scale.
      const weave = (Math.sin(u * size * Math.PI) * 0.5 + Math.sin(v * size * Math.PI) * 0.5);
      rgb = shade(rgb, 1 + weave * 0.05 + fbm(u * 120, v * 120, seed, 2) * 0.06);
      // Sun bleach toward the outer edge, mildew along the folds.
      rgb = mixRgb(rgb, [246, 240, 230], clamp(1 - v, 0, 1) * 0.16);
      const grime = clamp(fbm(u * 4, v * 6, seed + 4, 3) * 1.5, 0, 1);
      rgb = mixRgb(rgb, [96, 96, 84], grime * 0.28 * dirt);
      rgb = mixRgb(rgb, [70, 66, 58], clamp((v - 0.88) / 0.12, 0, 1) * 0.4 * dirt);
      return rgb;
    }).c;
    const bump = paint(size >> 1, size >> 1, (x, y, u, v) => {
      const g = Math.round(clamp(0.5 + Math.sin(u * size * 1.6) * 0.2 + Math.sin(v * size * 1.6) * 0.2, 0, 1) * 255);
      return [g, g, g];
    }).c;
    return { map: finish(albedo, { srgb: true }), bumpMap: finish(bump) };
  });
}

// -------------------------------------------------------------- misc ----

/** Generic grime / roughness breakup map. */
export function grunge(o = {}) {
  const { scale = 5, seed = 17, size = 256, lo = 0.35, hi = 1 } = o;
  return memo(`grunge|${scale}|${seed}|${lo}|${hi}`, () =>
    finish(paint(size, size, (x, y, u, v) => {
      const n = fbm(u * scale, v * scale, seed, 5) * 0.5 + 0.5;
      const g = Math.round(lerp(lo, hi, clamp(n, 0, 1)) * 255);
      return [g, g, g];
    }).c)
  );
}

/** Soft radial falloff used for contact shadows and light pools. */
export function radialFalloff(power = 2.2, size = 128) {
  return memo(`radial|${power}|${size}`, () =>
    finish(paint(size, size, (x, y, u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      const a = Math.pow(clamp(1 - d, 0, 1), power);
      const g = Math.round(a * 255);
      return [g, g, g];
    }).c)
  );
}

/** Alpha disc with a soft edge — particles, dust puffs, light glow. */
export function sprite(kind = 'glow', size = 128) {
  return memo(`sprite|${kind}|${size}`, () => {
    const { c, ctx } = canvas(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    if (kind === 'glow') {
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Text/label canvas — chalkboards, price tags, order tickets, jar labels. */
export function label(o = {}) {
  const {
    w = 256, h = 128, bg = 'rgba(0,0,0,0)', lines = [], seed = 2,
    border = null, grain = 0.1, radius = 0,
  } = o;
  const { c, ctx } = canvas(w, h);
  if (radius > 0) {
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, radius);
    ctx.clip();
  }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  if (border) {
    ctx.strokeStyle = border; ctx.lineWidth = 4;
    ctx.strokeRect(7, 7, w - 14, h - 14);
  }
  for (const ln of lines) {
    ctx.save();
    ctx.font = `${ln.weight || 700} ${ln.size || 28}px ${ln.font || '"Hiragino Sans", "Noto Sans JP", system-ui, sans-serif'}`;
    ctx.fillStyle = ln.color || '#fff';
    ctx.textAlign = ln.align || 'center';
    ctx.textBaseline = 'middle';
    if (ln.rotate) { ctx.translate(w / 2, h / 2); ctx.rotate(ln.rotate); ctx.translate(-w / 2, -h / 2); }
    ctx.fillText(ln.text, ln.x ?? w / 2, ln.y ?? h / 2, w * 0.92);
    ctx.restore();
  }
  // Paper/chalk grain so labels never look like clean vector art.
  if (grain > 0) {
    const rng = makeRng(seed);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rng() - 0.5) * 255 * grain;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
    ctx.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

