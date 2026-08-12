'use strict';
/* ============================================================
 * util.js — 数学・スプライン・乱数・イージング
 * ============================================================ */
const U = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); },
  smoothstep(a, b, t) {
    t = U.clamp((t - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  },
  rand(a, b) { return a + Math.random() * (b - a); },
  pick(arr) { return arr[(Math.random() * arr.length) | 0]; },
  TAU: Math.PI * 2,
};

const Ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuad: t => 1 - (1 - t) * (1 - t),
  outBack: t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: t => {
    if (t <= 0) return 0; if (t >= 1) return 1;
    const c4 = U.TAU / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounceSoft: t => {
    // ぽよんと弾む(控えめ)
    if (t >= 1) return 1;
    return 1 - Math.abs(Math.cos(t * Math.PI * 1.5)) * Math.pow(1 - t, 2.2);
  },
};

/* 決定的な乱数(保存した作品を毎回同じ見た目で再描画するため) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- ストローク処理 ----------
 * 子どもの線の「大きな形」を保ったまま、手ぶれだけを取る。
 */

/** 近すぎる点を間引く */
function dedupePts(pts, minD) {
  if (pts.length === 0) return [];
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = out[out.length - 1];
    if (U.dist(p.x, p.y, q.x, q.y) >= minD) out.push(p);
  }
  if (out.length > 1) {
    const last = pts[pts.length - 1];
    const q = out[out.length - 1];
    if (last !== q) out.push(last);
  }
  return out;
}

/** 端点を固定した軽い移動平均。passesを増やしすぎると形が変わるので2〜3まで */
function smoothPts(pts, passes) {
  let cur = pts;
  for (let p = 0; p < passes; p++) {
    if (cur.length < 3) break;
    const out = [cur[0]];
    for (let i = 1; i < cur.length - 1; i++) {
      out.push({
        x: cur[i - 1].x * 0.25 + cur[i].x * 0.5 + cur[i + 1].x * 0.25,
        y: cur[i - 1].y * 0.25 + cur[i].y * 0.5 + cur[i + 1].y * 0.25,
      });
    }
    out.push(cur[cur.length - 1]);
    cur = out;
  }
  return cur;
}

/** 弧長で等間隔に再サンプリング */
function resamplePts(pts, spacing) {
  if (pts.length < 2) return pts.slice();
  const out = [{ x: pts[0].x, y: pts[0].y }];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    let ax = pts[i - 1].x, ay = pts[i - 1].y;
    const bx = pts[i].x, by = pts[i].y;
    let seg = U.dist(ax, ay, bx, by);
    while (carry + seg >= spacing) {
      const t = (spacing - carry) / seg;
      const nx = ax + (bx - ax) * t, ny = ay + (by - ay) * t;
      out.push({ x: nx, y: ny });
      seg = seg - (spacing - carry);
      ax = nx; ay = ny;
      carry = 0;
    }
    carry += seg;
  }
  const last = pts[pts.length - 1];
  const ol = out[out.length - 1];
  if (U.dist(last.x, last.y, ol.x, ol.y) > spacing * 0.35) out.push({ x: last.x, y: last.y });
  return out;
}

/** Catmull-Rom スプラインで滑らかに補間した密な点列を返す */
function catmullRom(pts, seg) {
  if (pts.length < 3) return pts.slice();
  const out = [];
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 0; i < P.length - 3; i++) {
    const p0 = P[i], p1 = P[i + 1], p2 = P[i + 2], p3 = P[i + 3];
    for (let j = 0; j < seg; j++) {
      const t = j / seg, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
  return out;
}

/**
 * 生ストローク → 描画用パス。
 * 返り値: { pts, nx, ny, len, total }  (nx,ny = 単位法線)
 */
function buildPath(rawPts, spacing) {
  let p = dedupePts(rawPts, 1.5);
  p = smoothPts(p, 2);
  p = resamplePts(p, Math.max(4, spacing));
  p = catmullRom(p, 5);
  p = resamplePts(p, Math.max(2.5, spacing * 0.45));
  const n = p.length;
  const nx = new Float32Array(n), ny = new Float32Array(n), len = new Float32Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const m = Math.hypot(tx, ty) || 1;
    tx /= m; ty /= m;
    nx[i] = -ty; ny[i] = tx;
    if (i > 0) total += U.dist(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y);
    len[i] = total;
  }
  return { pts: p, nx, ny, len, total };
}

/** ぐるぐるロゼット(点しか描かなかった時の「小さなクリームのお花」)用の渦巻き点列 */
function makeRosette(cx, cy, R, turns, rng) {
  const pts = [];
  const N = 64;
  const jig = rng || Math.random;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ang = t * turns * U.TAU - Math.PI / 2;
    const r = R * (0.18 + 0.82 * (1 - t));
    pts.push({
      x: cx + Math.cos(ang) * r + (jig() - 0.5) * 1.2,
      y: cy + Math.sin(ang) * r * 0.86 + (jig() - 0.5) * 1.2,
    });
  }
  return pts;
}

/* roundRect ポリフィル的ヘルパ */
function rr(ctx, x, y, w, h, r) {
  const rr_ = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr_, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr_);
  ctx.arcTo(x + w, y + h, x, y + h, rr_);
  ctx.arcTo(x, y + h, x, y, rr_);
  ctx.arcTo(x, y, x + w, y, rr_);
  ctx.closePath();
}
