'use strict';
(function (PPG) {
  const U = PPG.util;

  // ============================================================
  // The magic crayon line — the hero material of the whole game.
  // Rendering is fully deterministic per (point index, seed) so a
  // stroke looks identical when re-rendered into the final flower:
  // the child's line is never replaced, only dressed up.
  // ============================================================

  function strokeHue(themeObj, i, seed) {
    if (themeObj.rainbow) return (i * 2.6 + (seed % 360)) % 360;
    return themeObj.h + (U.hash2(i * 3 + 1, seed) - 0.5) * 14;
  }

  function seg(ctx, ax, ay, bx, by, w, style) {
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  // Draw crayon segments for indices [i0, i1)  (segment i = pts[i] → pts[i+1])
  // opts: { theme:{h,s,l,rainbow}, width, seed, alpha }
  function drawSegs(ctx, pts, i0, i1, opts) {
    const n = pts.length;
    if (n < 2) return;
    const seed = opts.seed | 0;
    const w0 = opts.width || 10;
    const al = opts.alpha == null ? 1 : opts.alpha;
    const th = opts.theme;
    const spk = PPG.quality.speckle;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const from = Math.max(0, i0), to = Math.min(i1, n - 1);
    for (let i = from; i < to; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl, ny = dx / dl;
      const h = strokeHue(th, i, seed);
      const s = th.rainbow ? 74 : th.s;
      const l = th.rainbow ? 66 : th.l;
      const n1 = U.hash2(i, seed), n2 = U.hash2(i + 1, seed);
      // gentle width breathing → hand pressure feel
      const wv = w0 * (0.80 + 0.38 * ((n1 + n2) * 0.5)) *
        (0.9 + 0.14 * Math.sin(i * 0.31 + seed % 7));

      // main body
      seg(ctx, a.x, a.y, b.x, b.y, wv, U.hsla(h, s, l, 0.60 * al));
      // sunlit edge (top-left)
      seg(ctx, a.x + nx * wv * 0.22, a.y + ny * wv * 0.22,
        b.x + nx * wv * 0.22, b.y + ny * wv * 0.22,
        wv * 0.60, U.hsla(h - 4, Math.max(24, s - 10), Math.min(92, l + 12), 0.32 * al));
      // shaded edge (bottom-right) — gives the line its waxy thickness
      seg(ctx, a.x - nx * wv * 0.27, a.y - ny * wv * 0.27,
        b.x - nx * wv * 0.27, b.y - ny * wv * 0.27,
        wv * 0.52, U.hsla(h + 7, s, Math.max(20, l - 14), 0.30 * al));

      // pigment speckles (crayon grain)
      const sp = U.hash2(i * 13 + 5, seed);
      if (sp < 0.62 * spk) {
        const off = (U.hash2(i * 17 + 2, seed) - 0.5) * wv * 1.5;
        const px = a.x + dx * 0.5 + nx * off;
        const py = a.y + dy * 0.5 + ny * off;
        const r = 0.5 + U.hash2(i * 23 + 9, seed) * 1.2;
        const lightFleck = U.hash2(i * 31 + 4, seed) < 0.5;
        ctx.fillStyle = lightFleck
          ? U.hsla(h, s - 15, l + 20, 0.30 * al)
          : U.hsla(h + 10, s, l - 22, 0.22 * al);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, U.TAU);
        ctx.fill();
      }
      // tiny bright lamé fleck
      if (U.hash2(i * 41 + 7, seed) < 0.10 * spk) {
        const off = (U.hash2(i * 43 + 3, seed) - 0.5) * wv;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * al).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(a.x + nx * off, a.y + ny * off, 0.8, 0, U.TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // deterministic glitter anchor points along the stroke (twinkled at runtime)
  function collectGlitter(pts, seed) {
    const out = [];
    for (let i = 2; i < pts.length - 1; i += 3) {
      if (U.hash2(i * 29 + 11, seed) < 0.30) {
        const j1 = (U.hash2(i * 5 + 1, seed) - 0.5) * 9;
        const j2 = (U.hash2(i * 5 + 2, seed) - 0.5) * 9;
        out.push({
          x: pts[i].x + j1, y: pts[i].y + j2,
          ph: U.hash2(i * 7 + 3, seed) * U.TAU,
          r: 1.1 + U.hash2(i * 7 + 4, seed) * 1.7
        });
        if (out.length >= 42) break;
      }
    }
    return out;
  }

  function drawGlitter(ctx, list, t, alphaMul) {
    const am = alphaMul == null ? 1 : alphaMul;
    ctx.save();
    ctx.lineCap = 'round';
    for (const g of list) {
      const a = Math.max(0, Math.sin(t * 2.4 + g.ph));
      if (a < 0.08) continue;
      const al = (0.15 + 0.65 * a) * am;
      ctx.strokeStyle = 'rgba(255,255,255,' + al.toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(g.x - g.r, g.y); ctx.lineTo(g.x + g.r, g.y);
      ctx.moveTo(g.x, g.y - g.r); ctx.lineTo(g.x, g.y + g.r);
      ctx.stroke();
      const d = g.r * 0.5;
      ctx.strokeStyle = 'rgba(255,255,240,' + (al * 0.6).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(g.x - d, g.y - d); ctx.lineTo(g.x + d, g.y + d);
      ctx.moveTo(g.x + d, g.y - d); ctx.lineTo(g.x - d, g.y + d);
      ctx.stroke();
    }
    ctx.restore();
  }

  // soft glowing fingertip / pen tip while drawing
  function tipGlow(ctx, x, y, t, themeObj, k) {
    const r = (13 + 3 * Math.sin(t * 5)) * (k == null ? 1 : k);
    const h = themeObj.rainbow ? (t * 90) % 360 : themeObj.h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.4, U.hsla(h, 80, 78, 0.5));
    g.addColorStop(1, U.hsla(h, 80, 78, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, U.TAU);
    ctx.fill();
  }

  PPG.crayon = { drawSegs, collectGlitter, drawGlitter, tipGlow, strokeHue };
})(window.PPG);
