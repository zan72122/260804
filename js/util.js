/* ============================================================
   ぬいぬい！ フェルトタウン — util.js
   数学ヘルパー・乱数・イージング・ポリライン処理
   ============================================================ */
'use strict';

const U = {};

U.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
U.lerp = (a, b, t) => a + (b - a) * t;
U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
U.TAU = Math.PI * 2;

// 決定論的乱数（種つき）— 同じ入力なら同じ町並みを再現できる
U.mulberry32 = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ---- イージング ----
U.easeOutCubic = t => 1 - Math.pow(1 - t, 3);
U.easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
U.easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
// ぽよんっと弾む（ボタンやフェルトの出現用）
U.easeOutElastic = t => {
  if (t <= 0) return 0; if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (U.TAU / 3)) + 1;
};

// 区間 [t0,t1] 内での進行度 0..1
U.span = (t, t0, t1) => U.clamp((t - t0) / (t1 - t0), 0, 1);

// ---- ポリライン処理 ----

// 総延長
U.polyLength = function (pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += U.dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  return L;
};

// 等間隔リサンプリング（n 点）
U.resample = function (pts, n) {
  if (pts.length < 2) {
    const p = pts[0] || { x: 0, y: 0 };
    return Array.from({ length: n }, () => ({ x: p.x, y: p.y }));
  }
  const total = U.polyLength(pts);
  if (total < 1e-6) return Array.from({ length: n }, () => ({ x: pts[0].x, y: pts[0].y }));
  const out = [{ x: pts[0].x, y: pts[0].y }];
  const step = total / (n - 1);
  let acc = 0, i = 1, prev = pts[0];
  let target = step;
  while (out.length < n - 1 && i < pts.length) {
    const seg = U.dist(prev.x, prev.y, pts[i].x, pts[i].y);
    if (acc + seg >= target) {
      const t = (target - acc) / seg;
      const nx = U.lerp(prev.x, pts[i].x, t), ny = U.lerp(prev.y, pts[i].y, t);
      out.push({ x: nx, y: ny });
      prev = { x: nx, y: ny };
      acc = 0; target = step;
    } else {
      acc += seg; prev = pts[i]; i++;
    }
  }
  while (out.length < n) out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
  return out;
};

// Chaikin 平滑化 — 幼児のガタガタ線をやわらかい糸の曲線に
U.smooth = function (pts, iters) {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      q.push({ x: U.lerp(a.x, b.x, 0.25), y: U.lerp(a.y, b.y, 0.25) });
      q.push({ x: U.lerp(a.x, b.x, 0.75), y: U.lerp(a.y, b.y, 0.75) });
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
};

// ポリライン上の位置 t(0..1) の点と向き
U.pointAt = function (pts, t) {
  const n = pts.length;
  if (n === 1) return { x: pts[0].x, y: pts[0].y, ang: 0 };
  const f = U.clamp(t, 0, 1) * (n - 1);
  const i = Math.min(Math.floor(f), n - 2);
  const u = f - i;
  const a = pts[i], b = pts[i + 1];
  return {
    x: U.lerp(a.x, b.x, u),
    y: U.lerp(a.y, b.y, u),
    ang: Math.atan2(b.y - a.y, b.x - a.x)
  };
};

// ---- 線の性格分析 ----
// 長さ・丸み・山型・波型…厳密さは求めず「大まかな個性」だけ拾う
U.analyzeStroke = function (rawPts) {
  const pts = U.resample(rawPts, 48);
  const len = U.polyLength(pts);
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1);

  // 曲がり具合と、曲がり方向の反転回数（波っぽさ）
  let totalTurn = 0, flips = 0, lastSign = 0, peak = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
    const a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
    let d = a2 - a1;
    while (d > Math.PI) d -= U.TAU;
    while (d < -Math.PI) d += U.TAU;
    totalTurn += Math.abs(d);
    peak = Math.max(peak, Math.abs(d));
    const s = Math.sign(d);
    if (s !== 0 && lastSign !== 0 && s !== lastSign && Math.abs(d) > 0.06) flips++;
    if (s !== 0) lastSign = s;
  }
  const closedness = 1 - U.clamp(U.dist(pts[0].x, pts[0].y, pts[47].x, pts[47].y) / Math.max(len * 0.5, 1), 0, 1);

  return {
    pts,
    len,
    bbox: { x: minX, y: minY, w, h },
    curvy: U.clamp(totalTurn / Math.PI, 0, 3),      // 0=直線 大=ぐるぐる
    wavy: U.clamp(flips / 6, 0, 1),                  // 波線っぽさ
    pointy: U.clamp(peak / 2.4, 0, 1),               // 尖った折り返し
    round: closedness,                               // 端がつながる丸さ
    horizontal: w > h * 1.4,
    aspect: w / h
  };
};

// ---- 色ヘルパー ----
U.hexToRgb = function (hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
U.shade = function (hex, amt) { // amt: -1..1（暗く..明るく）
  const c = U.hexToRgb(hex);
  const f = v => Math.round(U.clamp(amt > 0 ? v + (255 - v) * amt : v * (1 + amt), 0, 255));
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
};
U.rgba = function (hex, a) {
  const c = U.hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
};
