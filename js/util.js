/* にじいろタウン - 共有ユーティリティ */
window.NT = window.NT || {};
(function () {
  const U = {};
  U.TAU = Math.PI * 2;
  U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);
  U.easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  U.easeInOutCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  U.easeOutBack = t => { const c = 1.70158; const c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  U.easeOutElastic = t => {
    if (t <= 0) return 0; if (t >= 1) return 1;
    const c4 = U.TAU / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };

  // 決定論的乱数（mulberry32）
  U.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  U.rngHelpers = function (rng) {
    return {
      f: (a, b) => a + rng() * (b - a),
      i: (a, b) => Math.floor(a + rng() * (b - a + 1)),
      pick: arr => arr[Math.floor(rng() * arr.length)],
      chance: p => rng() < p,
      raw: rng
    };
  };

  // ポリライン再サンプリング（等間隔化）
  U.resample = function (pts, step) {
    if (!pts.length) return [];
    const out = [{ x: pts[0].x, y: pts[0].y, w: pts[0].w || 0 }];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      let p0 = pts[i - 1], p1 = pts[i];
      let d = U.dist(p0.x, p0.y, p1.x, p1.y);
      if (d < 1e-6) continue;
      while (acc + d >= step) {
        const t = (step - acc) / d;
        const nx = U.lerp(p0.x, p1.x, t), ny = U.lerp(p0.y, p1.y, t);
        const nw = U.lerp(p0.w || 0, p1.w || 0, t);
        out.push({ x: nx, y: ny, w: nw });
        p0 = { x: nx, y: ny, w: nw };
        d = U.dist(p0.x, p0.y, p1.x, p1.y);
        acc = 0;
      }
      acc += d;
    }
    const last = pts[pts.length - 1];
    const ol = out[out.length - 1];
    if (U.dist(ol.x, ol.y, last.x, last.y) > step * 0.35) out.push({ x: last.x, y: last.y, w: last.w || 0 });
    return out;
  };

  // 軽い平滑化（端点保持・個性は残す）
  U.smoothPts = function (pts, iterations) {
    let cur = pts;
    for (let k = 0; k < iterations; k++) {
      const out = [cur[0]];
      for (let i = 1; i < cur.length - 1; i++) {
        out.push({
          x: (cur[i - 1].x + cur[i].x * 2 + cur[i + 1].x) / 4,
          y: (cur[i - 1].y + cur[i].y * 2 + cur[i + 1].y) / 4,
          w: cur[i].w
        });
      }
      out.push(cur[cur.length - 1]);
      cur = out;
    }
    return cur;
  };

  U.polylineLength = function (pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += U.dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    return L;
  };

  // t(0..1)に対応するポリライン上の点と向き
  U.pointAlong = function (pts, t) {
    if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, ang: 0 };
    const total = U.polylineLength(pts);
    let target = U.clamp(t, 0, 1) * total, acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = U.dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      if (acc + d >= target && d > 0) {
        const k = (target - acc) / d;
        return {
          x: U.lerp(pts[i - 1].x, pts[i].x, k),
          y: U.lerp(pts[i - 1].y, pts[i].y, k),
          ang: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x)
        };
      }
      acc += d;
    }
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    return { x: b.x, y: b.y, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  };

  // 角丸長方形パス
  U.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // ハート形パス
  U.heartPath = function (ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.32);
    ctx.bezierCurveTo(x - s, y - s * 0.5, x - s * 0.42, y - s * 1.05, x, y - s * 0.42);
    ctx.bezierCurveTo(x + s * 0.42, y - s * 1.05, x + s, y - s * 0.5, x, y + s * 0.32);
    ctx.closePath();
  };

  // 星形パス
  U.starPath = function (ctx, x, y, r, n, inner) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const rad = (i % 2 === 0) ? r : r * inner;
      const a = -Math.PI / 2 + i * Math.PI / n;
      const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  U.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  NT.U = U;
})();
