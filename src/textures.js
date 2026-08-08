import * as THREE from 'three';

/*
 * Every surface in this game is textured with something generated at runtime on
 * a 2D canvas: leather grain for the gauntlet, barred plumage for the hawk,
 * woven wool for the falconer's tunic, wood for the perch. Keeping it
 * procedural means the whole build stays a single file with no asset fetches,
 * while still giving materials the surface variation that stops them reading as
 * flat plastic.
 */

const cache = new Map();
function memo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/* ---------- tileable value noise ---------- */

function hash2(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Value noise on a wrapping lattice, so every texture tiles seamlessly. */
function noise2(x, y, period, seed) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const x0 = ((xi % period) + period) % period;
  const y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const u = smooth(xf),
    v = smooth(yf);
  const a = hash2(x0, y0, seed),
    b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed),
    d = hash2(x1, y1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

function fbm(x, y, octaves, period, seed) {
  let sum = 0,
    amp = 0.5,
    freq = 1,
    norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, period * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/* ---------- height -> normal map ---------- */

/**
 * Sobel-filters a greyscale height canvas into a tangent-space normal map.
 * This is what gives leather its pebbling and wool its weave under the moving
 * key light, without shipping a single image file.
 */
function heightToNormal(heightCanvas, strength = 2.2) {
  const size = heightCanvas.width;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, size, size).data;
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const octx = out.getContext('2d');
  const img = octx.createImageData(size, size);
  const h = (x, y) => {
    const xx = (x + size) % size;
    const yy = (y + size) % size;
    return src[(yy * size + xx) * 4] / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        h(x - 1, y - 1) + 2 * h(x - 1, y) + h(x - 1, y + 1) -
        (h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1));
      const dy =
        h(x - 1, y - 1) + 2 * h(x, y - 1) + h(x + 1, y - 1) -
        (h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1));
      let nx = dx * strength,
        ny = dy * strength,
        nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

function tex(canvas, repeat = 1, srgb = false) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lerpHex(a, b, t) {
  const ar = (a >> 16) & 255,
    ag = (a >> 8) & 255,
    ab = a & 255;
  const br = (b >> 16) & 255,
    bg = (b >> 8) & 255,
    bb = b & 255;
  return [
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  ];
}

/* ---------- leather ---------- */

/**
 * Thick, well-oiled gauntlet leather: broad tonal mottling, fine pebble grain,
 * and a few soft creases where a real glove would have folded over years of
 * being worn.
 */
export function leather(dark = 0x6b3f24, light = 0xb07a49, seed = 7) {
  return memo(`leather${dark}${light}${seed}`, () => {
    const S = 512;
    const col = makeCanvas(S);
    const ctx = col.getContext('2d');
    const hgt = makeCanvas(S);
    const hctx = hgt.getContext('2d');
    const cimg = ctx.createImageData(S, S);
    const himg = hctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = (x / S) * 8,
          v = (y / S) * 8;
        // Two grain scales: broad blotches plus tight pebbling.
        const blotch = fbm(u, v, 4, 8, seed);
        const pebble = fbm(u * 9, v * 9, 3, 72, seed + 40);
        const grain = pebble * 0.55 + blotch * 0.45;
        // Creases: thin dark valleys following a warped stripe field.
        const warp = fbm(u * 1.4, v * 1.4, 3, 12, seed + 90);
        const crease = Math.pow(
          Math.abs(Math.sin((v * 1.15 + warp * 2.6) * Math.PI)),
          14,
        );
        const t = THREE.MathUtils.clamp(grain * 1.05 - crease * 0.45, 0, 1);
        const [r, g, b] = lerpHex(dark, light, t);
        const i = (y * S + x) * 4;
        cimg.data[i] = r;
        cimg.data[i + 1] = g;
        cimg.data[i + 2] = b;
        cimg.data[i + 3] = 255;
        const hv = THREE.MathUtils.clamp(pebble * 0.8 + blotch * 0.2 - crease * 0.6, 0, 1);
        const hb = hv * 255;
        himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hb;
        himg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(cimg, 0, 0);
    hctx.putImageData(himg, 0, 0);
    return { map: tex(col, 1, true), normalMap: tex(heightToNormal(hgt, 1.6)) };
  });
}

/* ---------- plumage ---------- */

/**
 * Hawk plumage: overlapping scalloped feather tips with the horizontal barring
 * a buteo carries on its breast. Rendered as rows of offset scallops rather
 * than noise so the bird reads as feathered, not fuzzy.
 */
export function plumage(base = 0x6f5540, tip = 0x3a2a1e, pale = 0xd9c4a4, bars = 0) {
  return memo(`plum${base}${tip}${pale}${bars}`, () => {
    const S = 512;
    const col = makeCanvas(S);
    const ctx = col.getContext('2d');
    const hgt = makeCanvas(S);
    const hctx = hgt.getContext('2d');
    const [br, bg, bb] = lerpHex(base, base, 0);
    ctx.fillStyle = `rgb(${br},${bg},${bb})`;
    ctx.fillRect(0, 0, S, S);
    hctx.fillStyle = '#808080';
    hctx.fillRect(0, 0, S, S);

    const rows = 17;
    const rh = S / rows;
    for (let r = -1; r <= rows; r++) {
      const cols = 13;
      const cw = S / cols;
      const stagger = (r % 2) * cw * 0.5;
      for (let c = -1; c <= cols; c++) {
        const cx = c * cw + stagger + cw * 0.5;
        const cy = r * rh + rh * 0.5;
        const n = hash2(c, r, 3);
        const w = cw * (0.62 + n * 0.16);
        const h = rh * (1.15 + n * 0.2);
        // Feather body
        const shade = 0.28 + n * 0.5;
        const [pr, pg, pb] = lerpHex(base, pale, shade * 0.42);
        ctx.beginPath();
        ctx.ellipse(cx, cy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
        ctx.fill();
        // Darker rounded tip, the scalloped edge you see on a folded wing
        const [tr, tg, tb] = lerpHex(base, tip, 0.55 + n * 0.35);
        ctx.beginPath();
        ctx.ellipse(cx, cy + h * 0.22, w * 0.5, h * 0.3, 0, 0, Math.PI);
        ctx.fillStyle = `rgba(${tr},${tg},${tb},0.85)`;
        ctx.fill();
        // Shaft highlight
        ctx.beginPath();
        ctx.moveTo(cx, cy - h * 0.42);
        ctx.lineTo(cx, cy + h * 0.3);
        ctx.strokeStyle = `rgba(255,240,220,${0.1 + n * 0.12})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();

        hctx.beginPath();
        hctx.ellipse(cx, cy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
        hctx.fillStyle = `rgba(255,255,255,0.5)`;
        hctx.fill();
        hctx.beginPath();
        hctx.ellipse(cx, cy + h * 0.3, w * 0.5, h * 0.26, 0, 0, Math.PI);
        hctx.fillStyle = `rgba(0,0,0,0.55)`;
        hctx.fill();
      }
    }

    // Optional horizontal barring for breast feathering.
    if (bars > 0) {
      ctx.globalAlpha = 0.32;
      for (let i = 0; i < bars; i++) {
        const y = (i / bars) * S;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= S; x += 8) {
          ctx.lineTo(x, y + Math.sin((x / S) * Math.PI * 6 + i) * 3.2);
        }
        ctx.strokeStyle = `rgb(${(tip >> 16) & 255},${(tip >> 8) & 255},${tip & 255})`;
        ctx.lineWidth = S / bars / 2.6;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    return { map: tex(col, 1, true), normalMap: tex(heightToNormal(hgt, 1.0)) };
  });
}

/**
 * A single flight feather's vane, mapped along the quill: pale near the body,
 * darkening to the tip, with the shaft as a bright ridge and the fine comb of
 * barbs running diagonally off it.
 */
export function featherVane(base = 0x8a7050, tip = 0x33261b, shaft = 0xe8dcc6, barred = false) {
  return memo(`vane${base}${tip}${shaft}${barred}`, () => {
    const W = 96,
      H = 256;
    const col = document.createElement('canvas');
    col.width = W;
    col.height = H;
    const ctx = col.getContext('2d');
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const v = y / H; // 0 = quill root, 1 = tip
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const fromShaft = Math.abs(u - 0.5) * 2;
        // Darker toward the tip and toward the trailing edge.
        let t = Math.pow(v, 1.35) * 0.85 + fromShaft * 0.16;
        if (barred) {
          const band = Math.sin(v * Math.PI * 5.5 + fromShaft * 0.8) * 0.5 + 0.5;
          t += Math.pow(band, 2.4) * 0.24;
        }
        // Barbs: fine diagonal combing away from the shaft.
        const barb = Math.sin(v * 34 + fromShaft * 9) * 0.5 + 0.5;
        t += (barb - 0.5) * 0.05;
        t = THREE.MathUtils.clamp(t, 0, 1);
        let [r, g, b] = lerpHex(base, tip, t);
        // The shaft itself.
        const s = Math.max(0, 1 - fromShaft * 14) * (1 - v * 0.55);
        if (s > 0) {
          const [sr, sg, sb] = lerpHex(base, shaft, 1);
          r = Math.round(r + (sr - r) * s);
          g = Math.round(g + (sg - g) * s);
          b = Math.round(b + (sb - b) * s);
        }
        const i = (y * W + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(col);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    return { map: t };
  });
}

/* ---------- woven cloth ---------- */

export function cloth(a = 0x2f5d6b, b = 0x498396, seed = 11) {
  return memo(`cloth${a}${b}${seed}`, () => {
    const S = 256;
    const col = makeCanvas(S);
    const ctx = col.getContext('2d');
    const hgt = makeCanvas(S);
    const hctx = hgt.getContext('2d');
    const cimg = ctx.createImageData(S, S);
    const himg = hctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        // Over-under weave: alternating warp and weft dominance.
        const wx = Math.sin((x / S) * Math.PI * 64) * 0.5 + 0.5;
        const wy = Math.sin((y / S) * Math.PI * 64) * 0.5 + 0.5;
        const cell = (Math.floor((x / S) * 32) + Math.floor((y / S) * 32)) % 2;
        const weave = cell ? wx : wy;
        const fuzz = fbm((x / S) * 16, (y / S) * 16, 3, 16, seed);
        const t = THREE.MathUtils.clamp(weave * 0.55 + fuzz * 0.45, 0, 1);
        const [r, g, bl] = lerpHex(a, b, t);
        const i = (y * S + x) * 4;
        cimg.data[i] = r;
        cimg.data[i + 1] = g;
        cimg.data[i + 2] = bl;
        cimg.data[i + 3] = 255;
        const hv = weave * 0.75 + fuzz * 0.25;
        himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv * 255;
        himg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(cimg, 0, 0);
    hctx.putImageData(himg, 0, 0);
    return { map: tex(col, 1, true), normalMap: tex(heightToNormal(hgt, 0.9)) };
  });
}

/* ---------- wood ---------- */

export function wood(a = 0x6a4a2e, b = 0xa9814f, seed = 23) {
  return memo(`wood${a}${b}${seed}`, () => {
    const S = 256;
    const col = makeCanvas(S);
    const ctx = col.getContext('2d');
    const hgt = makeCanvas(S);
    const hctx = hgt.getContext('2d');
    const cimg = ctx.createImageData(S, S);
    const himg = hctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = (x / S) * 4,
          v = (y / S) * 4;
        const warp = fbm(u * 2.2, v * 0.5, 3, 8, seed) * 2.4;
        // Growth rings run along one axis, warped by low-frequency noise.
        const rings = Math.sin((v * 7 + warp) * Math.PI) * 0.5 + 0.5;
        const fibre = fbm(u * 30, v * 2, 2, 120, seed + 5);
        const t = THREE.MathUtils.clamp(rings * 0.6 + fibre * 0.4, 0, 1);
        const [r, g, bl] = lerpHex(a, b, t);
        const i = (y * S + x) * 4;
        cimg.data[i] = r;
        cimg.data[i + 1] = g;
        cimg.data[i + 2] = bl;
        cimg.data[i + 3] = 255;
        himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = t * 255;
        himg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(cimg, 0, 0);
    hctx.putImageData(himg, 0, 0);
    return { map: tex(col, 1, true), normalMap: tex(heightToNormal(hgt, 0.8)) };
  });
}

/* ---------- meadow ground ---------- */

export function meadow() {
  return memo('meadow', () => {
    const S = 512;
    const col = makeCanvas(S);
    const ctx = col.getContext('2d');
    const cimg = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = (x / S) * 6,
          v = (y / S) * 6;
        const broad = fbm(u, v, 4, 6, 3);
        const clump = fbm(u * 7, v * 7, 3, 42, 19);
        // Occasional bare patches of dry earth showing through the sward.
        const dirt = Math.pow(fbm(u * 2.5, v * 2.5, 3, 15, 61), 7.0);
        const t = THREE.MathUtils.clamp(broad * 0.55 + clump * 0.45, 0, 1);
        let [r, g, b] = lerpHex(0x3f5c2a, 0x86a24d, t);
        const [dr, dg, db] = lerpHex(0x8a7248, 0xb59a6c, clump);
        const k = THREE.MathUtils.clamp((dirt - 0.02) * 4.0, 0, 0.55);
        r = Math.round(r + (dr - r) * k);
        g = Math.round(g + (dg - g) * k);
        b = Math.round(b + (db - b) * k);
        const i = (y * S + x) * 4;
        cimg.data[i] = r;
        cimg.data[i + 1] = g;
        cimg.data[i + 2] = b;
        cimg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(cimg, 0, 0);
    return { map: tex(col, 1, true) };
  });
}

/**
 * A cumulus cloud: a heap of lobes with a flattish, slightly shaded base and a
 * bright piled-up top. Everything fades right out at the canvas edge — a cloud
 * whose alpha still has weight at the border reads as a painted ribbon rather
 * than as sky.
 */
export function cloudSprite(seed = 1) {
  return memo(`cloud${seed}`, () => {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const lobes = 16;
    for (let i = 0; i < lobes; i++) {
      const n1 = hash2(i, seed, 2),
        n2 = hash2(i, seed, 9),
        n3 = hash2(i, seed, 17);
      const u = i / (lobes - 1);
      // Lobes crowd along the base and pile up toward the middle of the top.
      const arch = Math.sin(u * Math.PI);
      const x = S * (0.2 + u * 0.6) + (n1 - 0.5) * S * 0.1;
      const y = S * (0.66 - arch * 0.22) + (n2 - 0.5) * S * 0.07;
      const r = S * (0.07 + n3 * 0.06) * (0.55 + arch * 0.9);
      const g = ctx.createRadialGradient(x, y - r * 0.35, r * 0.08, x, y, r);
      // Sunlit crown, cooler shaded underside.
      g.addColorStop(0, 'rgba(255,255,255,0.94)');
      g.addColorStop(0.5, 'rgba(243,247,253,0.6)');
      g.addColorStop(0.82, 'rgba(214,226,240,0.2)');
      g.addColorStop(1, 'rgba(206,219,235,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Guarantee the edges are empty so no cloud ever shows a cut-off border.
    const vign = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.5);
    vign.addColorStop(0, 'rgba(0,0,0,0)');
    vign.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export { fbm, noise2, hash2 };
