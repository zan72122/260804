/* ============================================================
 *  textures.js — 手続き型テクスチャ生成
 *  すべて Canvas2D で描き、外部アセットに依存しない。
 *  材質応答（粗さ・法線・汚れ・摩耗）を持たせるのが目的。
 * ============================================================ */
import * as THREE from 'three';

/* ---------- 乱数 ---------- */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- タイル可能な値ノイズ / fbm ---------- */
function lattice(size, rand) {
  const a = new Float32Array(size * size);
  for (let i = 0; i < a.length; i++) a[i] = rand();
  return a;
}
function sampleLattice(a, size, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const j0 = ((xi % size) + size) % size, j1 = ((xi + 1) % size + size) % size;
  const i0 = ((yi % size) + size) % size, i1 = ((yi + 1) % size + size) % size;
  const v00 = a[i0 * size + j0], v10 = a[i0 * size + j1];
  const v01 = a[i1 * size + j0], v11 = a[i1 * size + j1];
  return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy;
}

/**
 * タイル可能な fbm 場を返す（0..1）
 */
export function fbm(w, h, { octaves = 4, base = 8, gain = 0.5, seed = 1, aspect = 1 } = {}) {
  const rand = mulberry32(seed);
  const out = new Float32Array(w * h);
  let amp = 1, tot = 0, freq = base;
  for (let o = 0; o < octaves; o++) {
    const sizeX = Math.max(2, Math.round(freq * aspect));
    const sizeY = Math.max(2, Math.round(freq));
    const size = Math.max(sizeX, sizeY);
    const lat = lattice(size, rand);
    for (let y = 0; y < h; y++) {
      const ly = (y / h) * sizeY;
      for (let x = 0; x < w; x++) {
        out[y * w + x] += amp * sampleLattice(lat, size, (x / w) * sizeX, ly);
      }
    }
    tot += amp; amp *= gain; freq *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

/* ---------- Canvas ヘルパ ---------- */
export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function texFromCanvas(c, { srgb = true, repeat = [1, 1], aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** 高さ場 -> 法線マップテクスチャ */
export function normalTexFromField(field, w, h, strength = 2.0) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const at = (x, y) => field[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return texFromCanvas(c, { srgb: false });
}

/** グレースケール場 -> テクスチャ（roughness / metalness 等） */
export function grayTexFromField(field, w, h, lo = 0, hi = 1) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < field.length; i++) {
    const v = Math.max(0, Math.min(1, lo + field[i] * (hi - lo))) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return texFromCanvas(c, { srgb: false });
}

/* ============================================================
 *  1. 地層断面（切り取られた大地の切り口）
 *     y 方向に層、z 方向に長く伸びる
 * ============================================================ */
export function makeStrataTextures(seed = 7) {
  const W = 512, H = 1024;               // H が「深さ方向(y)」
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);

  // 層の定義（下から上へ）
  const bands = [];
  let y = 0;
  const palette = [
    ['#4a3524', '#5d452e'],   // 褐色土
    ['#3d3a38', '#4b4744'],   // 砂利混じり
    ['#5a5450', '#6b6560'],   // 灰岩
    ['#463a30', '#57483b'],   // 粘土
    ['#6a6055', '#7a7064'],   // 砂岩
    ['#33383d', '#414850'],   // 硬岩
    ['#4e4038', '#5f4e44'],
    ['#5c5b57', '#6d6c66'],
  ];
  while (y < H) {
    const th = 40 + rand() * 130;
    const p = palette[(bands.length + Math.floor(rand() * 2)) % palette.length];
    bands.push({ y0: y, y1: Math.min(H, y + th), c0: p[0], c1: p[1], tilt: (rand() - 0.5) * 26 });
    y += th;
  }

  // ベース
  ctx.fillStyle = '#3a332c'; ctx.fillRect(0, 0, W, H);
  for (const b of bands) {
    const g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
    g.addColorStop(0, b.c0); g.addColorStop(1, b.c1);
    ctx.save();
    ctx.beginPath();
    // 少し波打った層境界（タイル継ぎ目を保つため両端の y は同一）
    ctx.moveTo(0, b.y0);
    for (let x = 0; x <= W; x += 16) {
      const w1 = Math.sin((x / W) * Math.PI * 2) * b.tilt * 0.4;
      const w2 = Math.sin((x / W) * Math.PI * 6 + b.y0) * b.tilt * 0.18;
      ctx.lineTo(x, b.y0 + w1 + w2);
    }
    ctx.lineTo(W, b.y1); ctx.lineTo(0, b.y1); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  }

  // 粒・礫
  const noise = fbm(W, H, { octaves: 5, base: 10, seed: seed + 3 });
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) {
    const n = (noise[i] - 0.5) * 46;
    img.data[i * 4] = Math.max(0, Math.min(255, img.data[i * 4] + n));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, img.data[i * 4 + 1] + n));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, img.data[i * 4 + 2] + n * 0.9));
  }
  ctx.putImageData(img, 0, 0);

  // 礫（丸い石）
  for (let i = 0; i < 900; i++) {
    const x = rand() * W, yy = rand() * H;
    const r = 1.5 + rand() * 7;
    const l = 0.55 + rand() * 0.5;
    ctx.beginPath(); ctx.ellipse(x, yy, r, r * (0.6 + rand() * 0.6), rand() * 3, 0, 7);
    ctx.fillStyle = `rgba(${Math.floor(150 * l)},${Math.floor(142 * l)},${Math.floor(130 * l)},0.55)`;
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - r * 0.25, yy - r * 0.3, r * 0.5, r * 0.35, 0, 0, 7);
    ctx.fillStyle = 'rgba(255,250,235,0.10)'; ctx.fill();
  }

  // 鉱物のきらめき層（数本）
  for (let k = 0; k < 3; k++) {
    const yy = rand() * H, th = 8 + rand() * 16;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 260; i++) {
      const x = rand() * W;
      const py = yy + (rand() - 0.5) * th;
      const s = 0.8 + rand() * 2.2;
      ctx.fillStyle = ['rgba(190,225,255,0.7)', 'rgba(255,215,240,0.6)', 'rgba(210,255,235,0.55)'][i % 3];
      ctx.beginPath(); ctx.arc(x, py, s, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  const map = texFromCanvas(c, { srgb: true });
  const nrm = normalTexFromField(noise, W, H, 2.6);
  const rgh = grayTexFromField(noise, W, H, 0.72, 1.0);
  return { map, normalMap: nrm, roughnessMap: rgh };
}

/* ============================================================
 *  2. 切羽（掘削面）— 同心の削り溝
 * ============================================================ */
export function makeFaceTextures(seed = 11) {
  const S = 512;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const rand = mulberry32(seed);
  ctx.fillStyle = '#584a3c'; ctx.fillRect(0, 0, S, S);

  // 岩の斑
  const noise = fbm(S, S, { octaves: 5, base: 7, seed: seed + 1 });
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    const base = 60 + n * 90;
    img.data[i * 4] = base * 1.12;
    img.data[i * 4 + 1] = base * 0.98;
    img.data[i * 4 + 2] = base * 0.82;
  }
  ctx.putImageData(img, 0, 0);

  // 同心円の削り溝（カッターディスクの軌跡）
  ctx.save();
  ctx.translate(S / 2, S / 2);
  for (let r = 6; r < S * 0.72; r += 7.5) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7);
    ctx.strokeStyle = 'rgba(24,18,12,0.32)'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r + 2.4, 0, 7);
    ctx.strokeStyle = 'rgba(255,240,215,0.10)'; ctx.lineWidth = 1.4; ctx.stroke();
  }
  // 破砕痕
  for (let i = 0; i < 220; i++) {
    const a = rand() * 7, r = rand() * S * 0.7;
    ctx.save(); ctx.rotate(a); ctx.translate(r, 0);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(4 + rand() * 12, (rand() - 0.5) * 14);
    ctx.lineTo(2 + rand() * 8, (rand() - 0.5) * 18);
    ctx.closePath();
    ctx.fillStyle = `rgba(0,0,0,${0.10 + rand() * 0.18})`;
    ctx.fill(); ctx.restore();
  }
  ctx.restore();

  const map = texFromCanvas(c);
  const nrm = normalTexFromField(noise, S, S, 3.2);
  return { map, normalMap: nrm };
}

/* ============================================================
 *  3. 素掘り坑壁
 * ============================================================ */
export function makeBoreTextures(seed = 23) {
  const S = 512;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const noise = fbm(S, S, { octaves: 5, base: 9, seed });
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = noise[i];
    img.data[i * 4] = 52 + n * 74;
    img.data[i * 4 + 1] = 46 + n * 66;
    img.data[i * 4 + 2] = 40 + n * 54;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const rand = mulberry32(seed + 5);
  for (let i = 0; i < 400; i++) {
    const x = rand() * S, y = rand() * S, r = 2 + rand() * 9;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, rand() * 3, 0, 7);
    ctx.fillStyle = `rgba(20,16,12,${0.08 + rand() * 0.2})`; ctx.fill();
  }
  return {
    map: texFromCanvas(c),
    normalMap: normalTexFromField(noise, S, S, 3.0),
    roughnessMap: grayTexFromField(noise, S, S, 0.75, 1.0),
  };
}

/* ============================================================
 *  4. コンクリートセグメント
 * ============================================================ */
export function makeConcreteTextures(seed = 31) {
  const S = 512;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const noise = fbm(S, S, { octaves: 5, base: 22, seed });
  const stain = fbm(S, S, { octaves: 3, base: 3, seed: seed + 9 });
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const n = noise[i], s = stain[i];
    let v = 150 + (n - 0.5) * 34 - (s - 0.5) * 30;
    img.data[i * 4] = v * 1.02;
    img.data[i * 4 + 1] = v * 1.0;
    img.data[i * 4 + 2] = v * 0.96;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const rand = mulberry32(seed + 2);
  // 気泡・骨材
  for (let i = 0; i < 1400; i++) {
    const x = rand() * S, y = rand() * S, r = 0.6 + rand() * 2.4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    ctx.fillStyle = `rgba(90,88,84,${0.10 + rand() * 0.25})`; ctx.fill();
  }
  // 型枠の跡（水平線）
  for (let i = 0; i < 4; i++) {
    const y = rand() * S;
    ctx.fillStyle = 'rgba(120,118,114,0.25)';
    ctx.fillRect(0, y, S, 1.5);
  }
  return {
    map: texFromCanvas(c),
    normalMap: normalTexFromField(noise, S, S, 1.1),
    roughnessMap: grayTexFromField(noise, S, S, 0.78, 0.97),
  };
}

/* ============================================================
 *  5. 機械の塗装鋼板（色指定・傷・汚れ・リベット）
 * ============================================================ */
export function makePaintedSteel(hex, seed = 3, { rivets = true, wear = 1 } = {}) {
  const S = 512;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const col = new THREE.Color(hex);
  ctx.fillStyle = `rgb(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0})`;
  ctx.fillRect(0, 0, S, S);

  const noise = fbm(S, S, { octaves: 4, base: 14, seed });
  const grime = fbm(S, S, { octaves: 4, base: 4, seed: seed + 21 });
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < S * S; i++) {
    const n = (noise[i] - 0.5) * 24;
    const g = Math.max(0, grime[i] - 0.48) * 1.9 * wear;   // 上から汚れを乗せる
    for (let k = 0; k < 3; k++) {
      let v = img.data[i * 4 + k] + n;
      v = v * (1 - g * 0.75) + [70, 58, 44][k] * g * 0.75;
      img.data[i * 4 + k] = Math.max(0, Math.min(255, v));
    }
  }
  ctx.putImageData(img, 0, 0);

  const rand = mulberry32(seed + 77);
  // 引っかき傷
  for (let i = 0; i < 90 * wear; i++) {
    ctx.beginPath();
    const x = rand() * S, y = rand() * S, len = 6 + rand() * 60, a = rand() * 7;
    ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.strokeStyle = `rgba(${rand() > 0.5 ? '220,215,205' : '60,50,42'},${0.10 + rand() * 0.22})`;
    ctx.lineWidth = 0.6 + rand() * 1.6; ctx.stroke();
  }
  // 錆
  for (let i = 0; i < 40 * wear; i++) {
    const x = rand() * S, y = rand() * S, r = 3 + rand() * 16;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(126,66,28,0.42)');
    g.addColorStop(1, 'rgba(126,66,28,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // リベット
  if (rivets) {
    for (let gy = 24; gy < S; gy += 64) {
      for (let gx = 24; gx < S; gx += 64) {
        ctx.beginPath(); ctx.arc(gx, gy, 3.4, 0, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fill();
        ctx.beginPath(); ctx.arc(gx + 0.8, gy + 1.0, 3.2, 0, 7);
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
      }
    }
  }
  return {
    map: texFromCanvas(c),
    normalMap: normalTexFromField(noise, S, S, 0.8),
    roughnessMap: grayTexFromField(grime, S, S, 0.34, 0.92),
  };
}

/* ============================================================
 *  6. ベルトコンベアのゴム
 * ============================================================ */
export function makeBeltTexture() {
  const W = 128, H = 256;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b1a1a'; ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 32) {
    ctx.fillStyle = '#2b2927';
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(W / 2, y + 12); ctx.lineTo(W, y);
    ctx.lineTo(W, y + 7); ctx.lineTo(W / 2, y + 19); ctx.lineTo(0, y + 7);
    ctx.closePath(); ctx.fill();
  }
  const rand = mulberry32(9);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(90,74,54,${rand() * 0.3})`;
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 3);
  }
  const t = texFromCanvas(c);
  t.repeat.set(1, 8);
  return t;
}

/* ============================================================
 *  7. セグメントに付ける小さなマーク（星・ハート・花）
 * ============================================================ */
export function makeMarkTexture(kind, color) {
  const S = 128;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4;
  const R = 40;
  ctx.beginPath();
  if (kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? R * 0.46 : R;
      i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
  } else if (kind === 'heart') {
    ctx.moveTo(0, R * 0.75);
    ctx.bezierCurveTo(-R * 1.35, -R * 0.15, -R * 0.5, -R * 1.05, 0, -R * 0.35);
    ctx.bezierCurveTo(R * 0.5, -R * 1.05, R * 1.35, -R * 0.15, 0, R * 0.75);
  } else if (kind === 'flower') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.arc(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, R * 0.42, 0, 7);
    }
  } else { // circle / drop
    ctx.arc(0, 0, R * 0.8, 0, 7);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  const t = texFromCanvas(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* ============================================================
 *  8. 光の粒（スプライト用ソフト円）
 * ============================================================ */
export function makeGlowTexture(inner = 'rgba(255,240,205,1)', outer = 'rgba(255,190,110,0)') {
  const S = 128;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.32, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = texFromCanvas(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** ざらついた土埃の粒 */
export function makeDustTexture() {
  const S = 64;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(214,196,168,0.75)');
  g.addColorStop(0.5, 'rgba(170,150,124,0.22)');
  g.addColorStop(1, 'rgba(150,132,108,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = texFromCanvas(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** 警戒色の斜め縞（カッターヘッド外周など） */
export function makeHazardTexture() {
  const W = 256, H = 64;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8b21c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#22242a';
  for (let x = -H; x < W + H; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 16 - H, H); ctx.lineTo(x - H, H);
    ctx.closePath(); ctx.fill();
  }
  const rand = mulberry32(44);
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(70,58,44,${rand() * 0.42})`;
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 5, 1 + rand() * 3);
  }
  const t = texFromCanvas(c);
  t.repeat.set(10, 1);
  return t;
}

/** 格子状の歩廊グレーチング（アルファ付き） */
export function makeGratingTexture() {
  const S = 128;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#4a4744';
  for (let x = 0; x < S; x += 16) ctx.fillRect(x, 0, 6, S);
  for (let y = 0; y < S; y += 32) ctx.fillRect(0, y, S, 3);
  const t = texFromCanvas(c);
  return t;
}
