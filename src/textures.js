/* =========================================================
   textures.js — 手続き的なテクスチャ生成
   画像ファイルを一切持たずに、木・麻布・煉瓦・漆喰・鉄・
   パン皮の アルベド / ラフネス / 法線 を canvas 上で焼く。
   ・すべて実寸に基づく（repeat は「1タイル＝何メートル」で決める）
   ・汚れ、摩耗、打ち粉、煤 を必ず含める（新品に見せない）
   ========================================================= */
import * as THREE from 'three';

const cache = new Map();

function make(w, h, paint) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  return c;
}

function tex(canvas, { srgb = false, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/* 高さマップ → 法線マップ（Sobel） */
export function heightToNormal(src, strength = 2.0) {
  const w = src.width, h = src.height;
  const sctx = src.getContext('2d');
  const s = sctx.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const d = img.data;
  const at = (x, y) => {
    const xx = (x + w) % w, yy = (y + h) % h;
    return s[(yy * w + xx) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = at(x - 1, y - 1), t0 = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t0 + tr);
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/* 値ノイズ（シード固定・タイル可能） */
function noiseField(size, freq, seed) {
  const rnd = mulberry(seed);
  const g = new Float32Array(freq * freq);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x * freq, fy = y * freq;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = smooth(fx - x0), ty = smooth(fy - y0);
    const i = (a, b) => g[((b % freq) + freq) % freq * freq + (((a % freq) + freq) % freq)];
    const a = i(x0, y0), b = i(x0 + 1, y0), c = i(x0, y0 + 1), d = i(x0 + 1, y0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}
function fbm(size, baseFreq, octaves, seed) {
  const layers = [];
  let f = baseFreq, amp = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    layers.push({ n: noiseField(size, Math.max(2, Math.round(f)), seed + o * 97), amp });
    norm += amp; f *= 2; amp *= 0.5;
  }
  return (x, y) => {
    let v = 0;
    for (const l of layers) v += l.n(x, y) * l.amp;
    return v / norm;
  };
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* =========================================================
   使い込まれた作業台の木 — 1タイル = 1.0m
   ========================================================= */
export function woodMaps() {
  if (cache.has('wood')) return cache.get('wood');
  const S = 1024;
  const grainN = fbm(S, 4, 4, 11);
  const blotch = fbm(S, 6, 4, 23);
  const fine = fbm(S, 40, 3, 31);
  const micro = fbm(S, 150, 2, 131);

  const height = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        /* 年輪：uを歪ませた縞 */
        const warp = grainN(u * 0.6, v * 2.2) * 0.35;
        const rings = Math.sin((v * 9.0 + warp * 6.0) * Math.PI * 2);
        let hgt = 0.5 + rings * 0.10 + fine(u * 3, v * 3) * 0.14 + (micro(u, v) - 0.5) * 0.16;
        /* 板の継ぎ目（4枚張り） */
        const plank = (v * 4) % 1;
        if (plank < 0.012 || plank > 0.988) hgt -= 0.42;
        /* 使い込んだ傷 */
        const sc = fine(u * 7 + 3.1, v * 0.4);
        if (sc > 0.86) hgt -= (sc - 0.86) * 2.2;
        const c = Math.max(0, Math.min(1, hgt)) * 255;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });

  const albedo = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    const base = [124, 84, 50], dark = [78, 49, 27], pale = [176, 133, 88];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const warp = grainN(u * 0.6, v * 2.2) * 0.35;
        const rings = Math.sin((v * 9.0 + warp * 6.0) * Math.PI * 2) * 0.5 + 0.5;
        const bl = blotch(u * 1.6, v * 1.6);
        let k = rings * 0.55 + bl * 0.45 + (micro(u, v) - 0.5) * 0.16;
        let c = [
          base[0] + (pale[0] - base[0]) * k + (dark[0] - base[0]) * (1 - k) * 0.7,
          base[1] + (pale[1] - base[1]) * k + (dark[1] - base[1]) * (1 - k) * 0.7,
          base[2] + (pale[2] - base[2]) * k + (dark[2] - base[2]) * (1 - k) * 0.7,
        ];
        /* 継ぎ目は暗い */
        const plank = (v * 4) % 1;
        if (plank < 0.014 || plank > 0.986) { c = [46, 29, 16]; }
        /* 打ち粉が擦り込まれた白い曇り（中央ほど濃い＝使う場所） */
        const dust = Math.pow(Math.max(0, fbm(S, 3, 3, 77)(u, v)), 1.6);
        const centre = 1 - Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 1.9);
        const dk = Math.min(0.55, dust * centre * 1.5);
        c = [c[0] + (238 - c[0]) * dk, c[1] + (232 - c[1]) * dk, c[2] + (218 - c[2]) * dk];
        const i = (y * w + x) * 4;
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });

  const rough = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        /* 使われて磨り減った所ほど少しつるつる */
        const centre = 1 - Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 1.9);
        const r = 0.92 - centre * 0.26 + (fine(u * 5, v * 5) - 0.5) * 0.18;
        const c = Math.max(0, Math.min(1, r)) * 255;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });

  const r = {
    map: tex(albedo, { srgb: true, repeat: [1, 1] }),
    roughnessMap: tex(rough, { repeat: [1, 1] }),
    normalMap: tex(heightToNormal(height, 1.6), { repeat: [1, 1] }),
  };
  cache.set('wood', r);
  return r;
}

/* =========================================================
   発酵布（麻のクーシュ）— 1タイル = 0.25m
   ========================================================= */
export function linenMaps() {
  if (cache.has('linen')) return cache.get('linen');
  const S = 512;
  const slub = fbm(S, 24, 3, 5);
  const stain = fbm(S, 3, 4, 61);

  const height = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        /* 平織：縦糸と横糸が交互に浮く */
        const n = 34;
        const cx = Math.floor(u * n), cy = Math.floor(v * n);
        const fx = (u * n) % 1, fy = (v * n) % 1;
        const over = (cx + cy) % 2 === 0;
        const warp = Math.sin(fx * Math.PI);
        const weft = Math.sin(fy * Math.PI);
        let hh = over ? 0.35 + warp * 0.55 : 0.35 + weft * 0.55;
        hh += (slub(u, v) - 0.5) * 0.22;      /* 糸のふし */
        const c = Math.max(0, Math.min(1, hh)) * 255;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });

  const albedo = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const n = 34;
        const cx = Math.floor(u * n), cy = Math.floor(v * n);
        const over = (cx + cy) % 2 === 0;
        let c = over ? [211, 196, 168] : [204, 189, 161];
        const sl = slub(u, v);
        c = c.map((z) => z * (0.88 + sl * 0.24));
        /* 何年も使った布のしみ（生地・油） */
        const st = Math.pow(Math.max(0, stain(u, v) - 0.42) / 0.58, 1.4);
        c = [c[0] - st * 46, c[1] - st * 40, c[2] - st * 26];
        /* 打ち粉が繊維に残る */
        const fl = Math.pow(Math.max(0, fbm(S, 7, 3, 91)(u, v) - 0.35) / 0.65, 1.1);
        c = [c[0] + (247 - c[0]) * fl * 0.62, c[1] + (243 - c[1]) * fl * 0.62, c[2] + (232 - c[2]) * fl * 0.62];
        const i = (y * w + x) * 4;
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });

  const r = {
    map: tex(albedo, { srgb: true }),
    normalMap: tex(heightToNormal(height, 1.1)),
  };
  cache.set('linen', r);
  return r;
}

/* =========================================================
   耐火煉瓦（オーブン外装・炉床）— 煤つき。1タイル = 1.0m
   ========================================================= */
export function brickMaps(sooty = 0) {
  const key = 'brick' + sooty;
  if (cache.has(key)) return cache.get(key);
  const S = 1024;
  const grit = fbm(S, 60, 3, 13);
  const patch = fbm(S, 4, 4, 41);
  const rows = 7, cols = 3.5;

  const brickAt = (u, v) => {
    const ry = v * rows;
    const row = Math.floor(ry);
    const offset = (row % 2) * 0.5;
    const rx = u * cols + offset;
    const col = Math.floor(rx);
    return { fx: rx - col, fy: ry - row, id: (row * 71 + col * 131) % 997 };
  };

  const height = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    const mortar = 0.055;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const b = brickAt(u, v);
        const inX = Math.min(b.fx, 1 - b.fx), inY = Math.min(b.fy, 1 - b.fy);
        let hh;
        if (inX < mortar * 0.6 || inY < mortar * 2.4) {
          hh = 0.22 + grit(u * 2, v * 2) * 0.10;              /* 目地は凹む */
        } else {
          const rnd = mulberry(b.id)();
          hh = 0.66 + rnd * 0.10 + (grit(u, v) - 0.5) * 0.14;
          /* 角の欠け */
          const edge = Math.min(inX / mortar, inY / (mortar * 2.4));
          hh -= Math.max(0, 1 - edge) * 0.10;
        }
        const c = Math.max(0, Math.min(1, hh)) * 255;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });

  const albedo = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    const mortar = 0.055;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const b = brickAt(u, v);
        const inX = Math.min(b.fx, 1 - b.fx), inY = Math.min(b.fy, 1 - b.fy);
        let c;
        if (inX < mortar * 0.6 || inY < mortar * 2.4) {
          c = [146, 138, 126];
        } else {
          const rnd = mulberry(b.id);
          const k = rnd();
          c = [118 + k * 26, 92 + k * 20, 78 + k * 16];
        }
        const gr = grit(u * 1.5, v * 1.5);
        c = c.map((z) => z * (0.82 + gr * 0.34));
        /* 煤：下側と炉口まわりが黒い */
        const soot = sooty * Math.pow(Math.max(0, patch(u, v)), 1.1) * (0.35 + 0.65 * v);
        c = [c[0] * (1 - soot * 0.82), c[1] * (1 - soot * 0.85), c[2] * (1 - soot * 0.86)];
        const i = (y * w + x) * 4;
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });

  const r = {
    map: tex(albedo, { srgb: true }),
    normalMap: tex(heightToNormal(height, 2.2)),
  };
  cache.set(key, r);
  return r;
}

/* =========================================================
   漆喰の壁 — 1タイル = 2.0m
   ========================================================= */
export function plasterMaps() {
  if (cache.has('plaster')) return cache.get('plaster');
  const S = 512;
  const trowel = fbm(S, 5, 4, 3);
  const fine = fbm(S, 48, 2, 19);
  const height = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const hh = 0.5 + (trowel(u, v) - 0.5) * 0.5 + (fine(u, v) - 0.5) * 0.14;
        const c = Math.max(0, Math.min(1, hh)) * 255;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
  const albedo = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const t = trowel(u, v);
        const base = [231, 218, 199];
        const c = base.map((z) => z * (0.90 + t * 0.16));
        /* 下の方は汚れて少し濃い */
        const dirt = Math.pow(v, 2.2) * 0.10;
        const i = (y * w + x) * 4;
        img.data[i] = c[0] * (1 - dirt); img.data[i + 1] = c[1] * (1 - dirt * 1.05); img.data[i + 2] = c[2] * (1 - dirt * 1.1);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
  const r = { map: tex(albedo, { srgb: true }), normalMap: tex(heightToNormal(height, 1.0)) };
  cache.set('plaster', r);
  return r;
}

/* =========================================================
   パンの皮のディテール（気孔・水ぶくれ・打ち粉）
   色はシェーダ側で決めるので、ここは明暗と凹凸だけ
   ========================================================= */
export function crustMaps() {
  if (cache.has('crust')) return cache.get('crust');
  const S = 1024;
  const pores = fbm(S, 52, 3, 7);
  const blotch = fbm(S, 14, 4, 29);
  const dust = fbm(S, 26, 3, 53);

  const height = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    const rnd = mulberry(99);
    /* 水ぶくれ（ブリスター）の中心をばらまく */
    const bl = [];
    for (let i = 0; i < 900; i++) bl.push([rnd(), rnd(), 0.002 + rnd() * 0.0075]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        let hh = 0.5 + (pores(u, v) - 0.5) * 0.30 + (blotch(u, v) - 0.5) * 0.16;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(1, hh)) * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    /* ブリスターを上から加算 */
    g.globalCompositeOperation = 'lighter';
    for (const [bx, by, br] of bl) {
      const rg = g.createRadialGradient(bx * w, by * h, 0, bx * w, by * h, br * w);
      rg.addColorStop(0, 'rgba(255,255,255,0.55)');
      rg.addColorStop(0.6, 'rgba(255,255,255,0.16)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(bx * w, by * h, br * w, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  });

  /* R=明暗(焼きムラ) G=打ち粉 B=気孔の濃さ */
  const detail = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const shade = 0.5 + (blotch(u, v) - 0.5) * 0.55 + (pores(u, v) - 0.5) * 0.30;
        const fl = Math.pow(Math.max(0, dust(u, v) - 0.34) / 0.66, 1.3);
        const po = Math.pow(Math.max(0, pores(u, v) - 0.5) * 2, 1.5);
        const i = (y * w + x) * 4;
        img.data[i] = Math.max(0, Math.min(1, shade)) * 255;
        img.data[i + 1] = fl * 255;
        img.data[i + 2] = po * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });

  const r = {
    detail: tex(detail, { repeat: [1, 1] }),
    normalMap: tex(heightToNormal(height, 2.2), { repeat: [1, 1] }),
  };
  cache.set('crust', r);
  return r;
}

/* =========================================================
   すり減った鉄（オーブンの扉・ラック）
   ========================================================= */
export function ironMaps() {
  if (cache.has('iron')) return cache.get('iron');
  const S = 512;
  const scratch = fbm(S, 70, 3, 17);
  const patina = fbm(S, 6, 4, 37);
  const albedo = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const p = patina(u, v);
        let c = [56 + p * 34, 52 + p * 30, 50 + p * 26];
        /* 錆の浮き */
        const rust = Math.pow(Math.max(0, patina(u * 2.3 + 1.7, v * 2.3) - 0.62) / 0.38, 1.4);
        c = [c[0] + (126 - c[0]) * rust, c[1] + (66 - c[1]) * rust, c[2] + (34 - c[2]) * rust];
        const s = scratch(u * 3, v * 0.4);
        c = c.map((z) => z * (0.86 + s * 0.3));
        const i = (y * w + x) * 4;
        img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
  const rough = make(S, S, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h;
        const s = scratch(u * 3, v * 0.4);
        const p = patina(u, v);
        const r = 0.42 + p * 0.42 + (s - 0.5) * 0.18;
        const c = Math.max(0, Math.min(1, r)) * 255;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
  const r = { map: tex(albedo, { srgb: true }), roughnessMap: tex(rough) };
  cache.set('iron', r);
  return r;
}

/* =========================================================
   室内の環境マップ（PMREM用の簡易 equirect）
   窓の明るい面と、オーブンの暖色を反射に乗せる
   ========================================================= */
export function envEquirect() {
  const w = 512, h = 256;
  return make(w, h, (g, W, H) => {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0.00, '#efe6d8');   /* 天井 */
    sky.addColorStop(0.45, '#d8cbb6');
    sky.addColorStop(0.55, '#9c8469');
    sky.addColorStop(1.00, '#54402d');   /* 床 */
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    /* 窓（左手前）：強い昼光 */
    const win = g.createRadialGradient(W * 0.20, H * 0.34, 4, W * 0.20, H * 0.34, W * 0.16);
    win.addColorStop(0, '#ffffff');
    win.addColorStop(0.45, '#f3f0e6');
    win.addColorStop(1, 'rgba(240,236,224,0)');
    g.fillStyle = win; g.fillRect(0, 0, W, H);
    /* 天井の照明 */
    const lamp = g.createRadialGradient(W * 0.62, H * 0.12, 2, W * 0.62, H * 0.12, W * 0.10);
    lamp.addColorStop(0, '#fff3d8');
    lamp.addColorStop(1, 'rgba(255,243,216,0)');
    g.fillStyle = lamp; g.fillRect(0, 0, W, H);
    /* オーブンの炉口（右奥）：暖色の反射源 */
    const ov = g.createRadialGradient(W * 0.80, H * 0.52, 2, W * 0.80, H * 0.52, W * 0.13);
    ov.addColorStop(0, '#ff9c3c');
    ov.addColorStop(0.5, 'rgba(214,110,34,0.45)');
    ov.addColorStop(1, 'rgba(190,90,20,0)');
    g.fillStyle = ov; g.fillRect(0, 0, W, H);
  });
}
