/* にじいろタウン - クレヨンストローク：描画・解析 */
window.NT = window.NT || {};
(function () {
  const U = NT.U;
  const S = {};

  /* ============ クレヨン質感描画 ============
     pal: {base, dark, light, sparkle}
     セグメント単位で描く（ライブ描画と完成後の再描画で共用） */

  S.segment = function (ctx, x0, y0, x1, y1, w, pal, rng) {
    const d = U.dist(x0, y0, x1, y1);
    if (d < 0.01) { S.dab(ctx, x1, y1, w, pal, rng); return; }
    const nx = -(y1 - y0) / d, ny = (x1 - x0) / d; // 法線

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 下側の淡い影（顔料の重なり感）
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = pal.dark;
    ctx.lineWidth = w * 1.06;
    ctx.beginPath(); ctx.moveTo(x0 + 1.2, y0 + 1.8); ctx.lineTo(x1 + 1.2, y1 + 1.8); ctx.stroke();

    // 本体
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = pal.base;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();

    // 上側ハイライト（不均一に）
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = pal.light;
    ctx.lineWidth = w * 0.42;
    const hx = nx * w * 0.2, hy = ny * w * 0.2;
    ctx.beginPath(); ctx.moveTo(x0 - hx, y0 - hy - 0.6); ctx.lineTo(x1 - hx, y1 - hy - 0.6); ctx.stroke();

    // 顔料の粒（グレイン）
    const grains = Math.min(6, Math.max(2, Math.round(d / 3)));
    for (let i = 0; i < grains; i++) {
      const t = rng();
      const off = (rng() - 0.5) * w * 0.85;
      const gx = U.lerp(x0, x1, t) + nx * off;
      const gy = U.lerp(y0, y1, t) + ny * off;
      const r = 0.5 + rng() * 1.4;
      const c = rng();
      ctx.globalAlpha = 0.14 + rng() * 0.2;
      ctx.fillStyle = c < 0.35 ? pal.dark : (c < 0.7 ? pal.light : '#ffffff');
      ctx.beginPath(); ctx.arc(gx, gy, r, 0, U.TAU); ctx.fill();
    }

    // 微細なラメ
    if (rng() < 0.16) {
      const t = rng();
      const gx = U.lerp(x0, x1, t) + nx * (rng() - 0.5) * w * 0.5;
      const gy = U.lerp(y0, y1, t) + ny * (rng() - 0.5) * w * 0.5;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = pal.sparkle || '#fff';
      ctx.beginPath(); ctx.arc(gx, gy, 0.9 + rng() * 0.7, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(gx, gy, 2.2, 0, U.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // 点（打点・線の端）
  S.dab = function (ctx, x, y, w, pal, rng) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pal.base;
    ctx.beginPath(); ctx.arc(x, y, w * 0.5, 0, U.TAU); ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = pal.light;
    ctx.beginPath(); ctx.arc(x - w * 0.14, y - w * 0.16, w * 0.28, 0, U.TAU); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = rng() * U.TAU, rr = rng() * w * 0.42;
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = rng() < 0.5 ? pal.dark : '#fff';
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.8 + rng(), 0, U.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // にじいろクレヨン：位置に応じて色相が巡る
  S.rainbowPal = function (i) {
    const h = (i * 5) % 360;
    return {
      base: `hsl(${h},92%,72%)`,
      dark: `hsl(${h},70%,55%)`,
      light: `hsl(${h},100%,88%)`,
      sparkle: '#fff'
    };
  };

  // 保存済みストローク全体をクレヨン質感で再描画（決定論的）
  S.drawFull = function (ctx, pts, pal, seed, widthScale) {
    if (!pts.length) return;
    const rng = U.mulberry32(seed);
    const ws = widthScale || 1;
    if (pts.length === 1) {
      S.dab(ctx, pts[0].x, pts[0].y, (pts[0].w || 14) * ws, pal.rainbow ? S.rainbowPal(0) : pal, rng);
      return;
    }
    for (let i = 1; i < pts.length; i++) {
      const p = pal.rainbow ? S.rainbowPal(i) : pal;
      S.segment(ctx, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, (pts[i].w || 14) * ws, p, rng);
    }
  };

  // 線に沿った柔らかい発光（グロー演出用）
  S.drawGlow = function (ctx, pts, alpha, width, color) {
    if (pts.length < 2) {
      if (pts.length === 1) {
        ctx.globalAlpha = alpha;
        const g = ctx.createRadialGradient(pts[0].x, pts[0].y, 0, pts[0].x, pts[0].y, width);
        g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, width, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      return;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.6;
    ctx.lineWidth = width * 2;
    ctx.stroke();
    ctx.restore();
  };

  /* ============ ストローク解析 ============ */
  S.analyze = function (rawPts) {
    if (!rawPts || !rawPts.length) return null;
    let pts = U.resample(rawPts, 6);
    const f = {};
    f.pts = pts;
    f.n = pts.length;

    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, sx = 0, sy = 0;
    for (const p of pts) {
      minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
      miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
      sx += p.x; sy += p.y;
    }
    f.bbox = { minx, miny, maxx, maxy, w: Math.max(1, maxx - minx), h: Math.max(1, maxy - miny) };
    f.cx = sx / f.n; f.cy = sy / f.n;
    f.length = U.polylineLength(pts);
    f.start = pts[0]; f.end = pts[pts.length - 1];
    f.isDot = f.length < 24;
    f.aspect = f.bbox.w / Math.max(1, f.bbox.h);

    // 曲がり
    let absTurn = 0, netTurn = 0;
    const turns = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      const a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      let d = a2 - a1;
      while (d > Math.PI) d -= U.TAU;
      while (d < -Math.PI) d += U.TAU;
      turns.push(d);
      absTurn += Math.abs(d); netTurn += d;
    }
    f.absTurn = absTurn; f.netTurn = netTurn;
    f.spiralness = Math.abs(netTurn) / U.TAU; // 回転数
    f.isSpiral = f.spiralness > 1.5;

    // 波打ち：曲がり方向の反転回数
    let flips = 0, lastSign = 0, accum = 0;
    for (const d of turns) {
      accum += d;
      if (Math.abs(accum) > 0.5) {
        const s = Math.sign(accum);
        if (lastSign !== 0 && s !== lastSign) flips++;
        lastSign = s;
        accum = 0;
      }
    }
    f.waviness = flips;
    f.isWavy = flips >= 3 && !f.isSpiral;

    // 閉曲線度
    const endGap = U.dist(f.start.x, f.start.y, f.end.x, f.end.y);
    f.closed = f.length > 120 && endGap < Math.max(36, f.length * 0.18) && !f.isSpiral;

    // 山（画面上方向のピーク）と谷
    const sm = U.smoothPts(pts, 2);
    f.peaks = []; f.valleys = [];
    const prom = Math.max(10, f.bbox.h * 0.12);
    for (let i = 2; i < sm.length - 2; i++) {
      const y = sm[i].y;
      if (y < sm[i - 1].y && y <= sm[i + 1].y && y < sm[i - 2].y && y <= sm[i + 2].y) {
        let l = y, r = y;
        for (let j = Math.max(0, i - 8); j < Math.min(sm.length, i + 8); j++) { l = Math.max(l, sm[j].y); }
        if (l - y > prom) f.peaks.push({ x: sm[i].x, y: sm[i].y, i, t: i / (sm.length - 1) });
      }
      if (y > sm[i - 1].y && y >= sm[i + 1].y && y > sm[i - 2].y && y >= sm[i + 2].y) {
        let l = y;
        for (let j = Math.max(0, i - 8); j < Math.min(sm.length, i + 8); j++) { l = Math.min(l, sm[j].y); }
        if (y - l > prom) f.valleys.push({ x: sm[i].x, y: sm[i].y, i, t: i / (sm.length - 1) });
      }
    }
    // 近すぎるピークを間引く
    const filterClose = arr => {
      const out = [];
      for (const p of arr) {
        if (!out.length || Math.abs(p.x - out[out.length - 1].x) > f.bbox.w * 0.12) out.push(p);
      }
      return out;
    };
    f.peaks = filterClose(f.peaks);
    f.valleys = filterClose(f.valleys);

    // 左右の偏り (-1..1)
    f.bias = U.clamp((f.cx - (minx + maxx) / 2) / (f.bbox.w * 0.5 || 1), -1, 1);

    // なめらか版（生成用・個性は保持）
    f.smooth = U.smoothPts(pts, 1);
    return f;
  };

  NT.stroke = S;
})();
