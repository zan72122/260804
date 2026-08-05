// 形状定義: 彫刻ターゲットのSDF（符号付き距離場）とボクセル分類
// 単位はメートル。原点=台座中心、+Yが上。

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

function sdBox(px, py, pz, bx, by, bz) {
  const dx = Math.abs(px) - bx, dy = Math.abs(py) - by, dz = Math.abs(pz) - bz;
  const ax = Math.max(dx, 0), ay = Math.max(dy, 0), az = Math.max(dz, 0);
  return Math.sqrt(ax * ax + ay * ay + az * az) + Math.min(Math.max(dx, Math.max(dy, dz)), 0);
}

function sdSphere(px, py, pz, cx, cy, cz, r) {
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

// 楕円体の近似SDF
function sdEllipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = px - cx, y = py - cy, z = pz - cz;
  const k0 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2);
  const k1 = Math.sqrt((x / (rx * rx)) ** 2 + (y / (ry * ry)) ** 2 + (z / (rz * rz)) ** 2);
  if (k1 === 0) return -Math.min(rx, ry, rz);
  return (k0 * (k0 - 1)) / k1;
}

// Y軸方向の円柱（cx,czが軸、y0..y1）
function sdCylY(px, py, pz, cx, cz, y0, y1, r) {
  const dRad = Math.hypot(px - cx, pz - cz) - r;
  const dY = Math.max(y0 - py, py - y1);
  const outside = Math.hypot(Math.max(dRad, 0), Math.max(dY, 0));
  return outside + Math.min(Math.max(dRad, dY), 0);
}

// Y軸方向の円錐台（近似SDF・ボクセル化には十分な精度）
function sdConeY(px, py, pz, cx, cz, y0, y1, rBottom, rTop) {
  const t = Math.min(1, Math.max(0, (py - y0) / (y1 - y0)));
  const rAt = rBottom + (rTop - rBottom) * t;
  const dRad = Math.hypot(px - cx, pz - cz) - rAt;
  const dY = Math.max(y0 - py, py - y1);
  const outside = Math.hypot(Math.max(dRad, 0), Math.max(dY, 0));
  return outside + Math.min(Math.max(dRad, dY), 0);
}

function smin(a, b, k) {
  const h = Math.min(1, Math.max(0, 0.5 + 0.5 * (b - a) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

// ---- 氷のお城 ----
function castleSDF(x, y, z) {
  // 中央の天守（円塔＋屋根）
  let d = sdCylY(x, y, z, 0, 0, 0, 2.9, 0.85);
  d = Math.min(d, sdConeY(x, y, z, 0, 0, 2.82, 4.15, 1.05, 0.05));
  // 四隅の塔
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      d = Math.min(d, sdCylY(x, y, z, sx * 1.35, sz * 1.35, 0, 2.25, 0.5));
      d = Math.min(d, sdConeY(x, y, z, sx * 1.35, sz * 1.35, 2.18, 3.12, 0.62, 0.04));
    }
  }
  // 城壁（±Z、±Xの4枚）
  d = Math.min(d, sdBox(x, y - 0.8, Math.abs(z) - 1.35, 1.35, 0.8, 0.26));
  d = Math.min(d, sdBox(Math.abs(x) - 1.35, y - 0.8, z, 0.26, 0.8, 1.35));
  // 正面（+Z）の門をくり抜く
  const archRound = Math.max(Math.hypot(x, y - 0.95) - 0.5, Math.abs(z - 1.35) - 0.6);
  const archBody = sdBox(x, y - 0.5, z - 1.35, 0.5, 0.5, 0.6);
  d = Math.max(d, -Math.min(archRound, archBody));
  return d;
}

// ---- ぺんぎん ----
function penguinSDF(x, y, z) {
  let d = sdEllipsoid(x, y, z, 0, 2.0, 0, 1.35, 1.95, 1.15);
  d = smin(d, sdSphere(x, y, z, 0, 3.58, 0, 0.95), 0.35);
  // くちばし
  d = Math.min(d, sdSphere(x, y, z, 0, 3.5, 0.95, 0.3));
  d = Math.min(d, sdSphere(x, y, z, 0, 3.44, 1.16, 0.17));
  // 羽
  d = smin(d, sdEllipsoid(x, y, z, 1.38, 2.1, 0, 0.4, 1.15, 0.72), 0.18);
  d = smin(d, sdEllipsoid(x, y, z, -1.38, 2.1, 0, 0.4, 1.15, 0.72), 0.18);
  // 足
  d = Math.min(d, sdEllipsoid(x, y, z, 0.55, 0.16, 0.55, 0.5, 0.2, 0.66));
  d = Math.min(d, sdEllipsoid(x, y, z, -0.55, 0.16, 0.55, 0.5, 0.2, 0.66));
  // しっぽ
  d = smin(d, sdEllipsoid(x, y, z, 0, 0.72, -1.12, 0.55, 0.42, 0.4), 0.2);
  return d;
}

// 積み上げる雪ブロック（つむフェーズの見た目とボクセル初期形状を一致させる）
// [中心Y, 半幅X, 半高Y, 半幅Z, オフセットX, オフセットZ]
export const BLOCK_DEFS = [
  [0.72, 2.1, 0.74, 2.1, 0.0, 0.0],
  [2.08, 1.92, 0.68, 1.92, 0.05, -0.04],
  [3.22, 1.62, 0.58, 1.62, -0.06, 0.05],
  [4.18, 1.28, 0.5, 1.28, 0.03, 0.03],
];

export function stackedBlocksSDF(x, y, z) {
  let d = Infinity;
  for (const [cy, hx, hy, hz, ox, oz] of BLOCK_DEFS) {
    d = Math.min(d, sdBox(x - ox, y - cy, z - oz, hx, hy, hz) - 0.06);
  }
  return d;
}

export const SHAPES = {
  castle: {
    label: 'おしろ',
    emoji: '🏰',
    sdf: castleSDF,
    // 透明な氷パーツ [名前, x, y, z]
    iceParts: [
      { kind: 'star', pos: [0, 4.55, 0] },
      { kind: 'spike', pos: [1.35, 3.5, 1.35] },
      { kind: 'spike', pos: [-1.35, 3.5, 1.35] },
      { kind: 'spike', pos: [1.35, 3.5, -1.35] },
      { kind: 'spike', pos: [-1.35, 3.5, -1.35] },
    ],
    // 照明スポット [x,y,z, 色]（'rainbow'は虹色）
    lightSpots: [
      [0, 3.3, 0, '#59b7ff'],
      [0, 1.8, 0, '#b06bff'],
      [1.35, 1.2, 1.35, '#ff6fd8'],
      [-1.35, 1.2, -1.35, '#59ffe6'],
      [0, 0.95, 1.0, 'rainbow'],
    ],
  },
  penguin: {
    label: 'ぺんぎん',
    emoji: '🐧',
    sdf: penguinSDF,
    iceParts: [
      { kind: 'crown', pos: [0, 4.6, 0] },
      { kind: 'heart', pos: [0, 2.25, 1.2] },
      { kind: 'star', pos: [1.62, 2.85, 0.15] },
      { kind: 'star', pos: [-1.62, 2.85, 0.15] },
      { kind: 'fish', pos: [0.62, 0.45, 1.05] },
    ],
    lightSpots: [
      [0, 2.1, 0, '#59b7ff'],
      [0, 3.55, 0, '#b06bff'],
      [-0.85, 1.35, 0.3, '#ff6fd8'],
      [0.85, 1.35, 0.3, '#59ffe6'],
      [0, 0.65, 0.6, 'rainbow'],
    ],
  },
};
