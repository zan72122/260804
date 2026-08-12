'use strict';
(function (PPG) {
  const U = PPG.util;
  const C = PPG.crayon;

  // ============================================================
  // A flower is grown FROM the child's stroke, never instead of it.
  // The stroke stays as the stem (same points, same crayon renderer);
  // we only add soil, leaves and a blossom at the tip the child taps.
  // Every visible trait is driven by the stroke, not by dice:
  //   length → height/size, corners → leaves, loops → spiral flower,
  //   zigzag → cluster flower, S-curve → fluff flower, straight → star,
  //   short → chubby round flower, tip direction → where the head faces,
  //   chosen color → whole color theme, press length → blossom size.
  // ============================================================

  const THEMES = {
    pink: { id: 'pink', h: 336, s: 82, l: 70 },
    purple: { id: 'purple', h: 268, s: 62, l: 70 },
    rainbow: { id: 'rainbow', rainbow: true, h: 0, s: 75, l: 70 }
  };
  function theme(id) { return THEMES[id] || THEMES.pink; }

  function mixHue(a, b, t) {
    const d = ((b - a + 540) % 360) - 180;
    return a + d * t;
  }

  // keep the wobble: only resample to even spacing, no curve fitting
  function resample(pts, spacing) {
    if (pts.length < 2) return pts.slice();
    const out = [{ x: pts[0].x, y: pts[0].y }];
    let prev = pts[0], acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      let d = Math.hypot(p.x - prev.x, p.y - prev.y);
      while (acc + d >= spacing) {
        const t = (spacing - acc) / d;
        const nx = prev.x + (p.x - prev.x) * t;
        const ny = prev.y + (p.y - prev.y) * t;
        out.push({ x: nx, y: ny });
        d = Math.hypot(p.x - nx, p.y - ny);
        prev = { x: nx, y: ny };
        acc = 0;
      }
      acc += d;
      prev = p;
    }
    const last = pts[pts.length - 1];
    const ol = out[out.length - 1];
    if (Math.hypot(last.x - ol.x, last.y - ol.y) > spacing * 0.4) out.push({ x: last.x, y: last.y });
    return out;
  }

  function analyze(pts) {
    const n = pts.length;
    const cum = [0];
    let len = 0;
    for (let i = 1; i < n; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      cum.push(len);
    }
    const chord = Math.hypot(pts[n - 1].x - pts[0].x, pts[n - 1].y - pts[0].y);
    const straightness = len > 1 ? chord / len : 1;

    const angs = [];
    for (let i = 0; i < n - 1; i++) {
      angs.push(Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x));
    }
    const deltas = [];
    for (let i = 0; i < angs.length - 1; i++) deltas.push(U.angDiff(angs[i], angs[i + 1]));

    let winding = 0;
    for (const d of deltas) winding += d;
    const absW = Math.abs(winding);

    // corners: a lot of turning packed into a short span
    let corners = 0;
    const cornerIdx = [];
    let lastC = -99;
    for (let i = 0; i < deltas.length - 2; i++) {
      const wsum = deltas[i] + deltas[i + 1] + deltas[i + 2];
      if (Math.abs(wsum) > 0.85 && i - lastC > 8) {
        corners++; cornerIdx.push(i + 1); lastC = i;
      }
    }

    // wiggles: how often the curve flips bending direction
    let wiggles = 0, lastSign = 0, lastW = -99;
    for (let i = 3; i < deltas.length - 3; i++) {
      let s = 0;
      for (let k = -3; k <= 3; k++) s += deltas[i + k];
      if (Math.abs(s) > 0.30) {
        const sign = s > 0 ? 1 : -1;
        if (lastSign !== 0 && sign !== lastSign && i - lastW > 6) { wiggles++; lastW = i; }
        lastSign = sign;
      }
    }

    // S-curve: first and second half bend clearly in opposite directions
    const half = Math.floor(deltas.length / 2);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < half; i++) s1 += deltas[i];
    for (let i = half; i < deltas.length; i++) s2 += deltas[i];
    const sCurve = (s1 * s2 < 0) && Math.abs(s1) > 0.55 && Math.abs(s2) > 0.55;

    const k = Math.max(1, Math.min(7, n - 1));
    const tipAngle = Math.atan2(pts[n - 1].y - pts[n - 1 - k].y, pts[n - 1].x - pts[n - 1 - k].x);

    return { len, cum, chord, straightness, winding, absW, corners, cornerIdx, wiggles, sCurve, tipAngle };
  }

  function chooseType(ft) {
    if (ft.absW > 4.2) return 'kuru';       // ぐるぐる → 渦巻きの花
    if (ft.corners >= 4) return 'tsubu';    // ジグザグ → つぶつぶの房の花
    if (ft.sCurve && ft.len > 110) return 'fuwa'; // S字 → ふわふわ綿毛
    if (ft.len < 90) return 'maru';         // 短い → ちいさなまるまる花
    if (ft.straightness > 0.93) return 'hoshi'; // まっすぐ → ほしほし花
    return 'hira';                          // ゆるいカーブ → ひらひら花
  }

  function create(rawPts, colorId, hold, strokeW, seedIn) {
    // pts   = the child's line exactly as drawn (rendered forever as the stem)
    // rpts  = evenly resampled copy used only for measuring the shape
    let pts = rawPts.map(p => ({ x: p.x, y: p.y }));
    let rpts = resample(pts, 3.5);
    if (rpts.length < 4) {
      // a bare dot still succeeds: a tiny magical sprout grows from it
      const p = rawPts[0] || { x: 0, y: 0 };
      pts = [
        { x: p.x, y: p.y }, { x: p.x + 1.5, y: p.y - 5 },
        { x: p.x - 1.2, y: p.y - 11 }, { x: p.x + 0.6, y: p.y - 17 }
      ];
      rpts = pts;
    }
    const ft = analyze(rpts);
    const type = chooseType(ft);
    const last = rpts[rpts.length - 1];
    const seed = seedIn ? (seedIn >>> 0) || 1 :
      ((Math.floor(ft.len * 7) + rpts.length * 131 +
        Math.floor(Math.abs(last.x * 13 + last.y * 7))) >>> 0) || 1;
    const rnd = U.mulberry32(seed);

    const sizeF = U.map(ft.len, 30, 480, 0.55, 1.5);
    const holdF = 0.8 + 0.6 * hold;
    const petalR = U.clamp((30 + 30 * sizeF) * holdF, 22, 96);
    const centerR = petalR * (0.30 + 0.13 * hold);

    let petalCount =
      type === 'maru' ? 6 :
      type === 'hira' ? 8 :
      type === 'hoshi' ? 5 :
      type === 'tsubu' ? 9 + Math.min(5, ft.corners) :
      type === 'fuwa' ? 26 : 10;
    if (type === 'maru' && seed % 2) petalCount = 7;
    if (type === 'hoshi' && ft.len > 380) petalCount = 6;

    const a = ft.tipAngle;
    const head = {
      x: last.x + Math.cos(a) * centerR * 0.55,
      y: last.y + Math.sin(a) * centerR * 0.55,
      ang: a
    };

    // ---- leaves: born at the stroke's own corners and turns ----
    const leafCount = U.clamp(
      1 + ft.corners + Math.floor(ft.wiggles / 2) + Math.floor(ft.len / 200), 1, 6);
    const params = [];
    for (const ci of ft.cornerIdx) {
      const s = ft.cum[Math.min(ci, ft.cum.length - 1)] / Math.max(1, ft.len);
      if (s > 0.12 && s < 0.82) params.push(s);
    }
    for (let k2 = 0; params.length < leafCount && k2 < 10; k2++) {
      const s = 0.18 + 0.62 * ((k2 + 0.5) / leafCount) + (rnd() - 0.5) * 0.06;
      if (params.every(q => Math.abs(q - s) > 0.09)) params.push(U.clamp(s, 0.1, 0.85));
    }
    params.sort((x, y) => x - y);
    const anchorAt = (s) => {
      const idx = Math.min(idxAtParam(ft, s), rpts.length - 2);
      const p = rpts[idx], q = rpts[idx + 1];
      return { x: p.x, y: p.y, tang: Math.atan2(q.y - p.y, q.x - p.x) };
    };
    const leaves = params.slice(0, leafCount).map((s, k2) => {
      const an = anchorAt(s);
      return {
        x: an.x, y: an.y, tang: an.tang,
        side: (k2 % 2 === 0 ? 1 : -1) * (seed % 2 === 0 ? 1 : -1),
        size: (13 + 10 * sizeF) * (0.85 + 0.35 * rnd()),
        t: 0.10 + 0.30 * (k2 / Math.max(1, leafCount - 1)),
        jit: (rnd() - 0.5) * 0.5
      };
    });

    // curly tendrils for wiggly "vine" strokes
    const tendrils = [];
    if (ft.wiggles >= 3) {
      const tn = Math.min(2, Math.floor(ft.wiggles / 3) + 1);
      for (let k2 = 0; k2 < tn; k2++) {
        const an = anchorAt(0.3 + 0.4 * rnd());
        tendrils.push({
          x: an.x, y: an.y, tang: an.tang,
          side: rnd() < 0.5 ? 1 : -1,
          size: 8 + 8 * sizeF,
          t: 0.25 + 0.2 * rnd()
        });
      }
    }

    // dew drops on the blossom (tiny, seeded decoration only)
    const dews = [];
    if (type !== 'fuwa') {
      const dn = 1 + (seed % 2);
      for (let k2 = 0; k2 < dn; k2++) {
        dews.push({ a: rnd() * U.TAU, rad: petalR * (0.42 + 0.28 * rnd()), r: 2.6 + rnd() * 1.9 });
      }
    }

    const f = {
      pts, rpts, ft, type, seed, colorId, theme: theme(colorId), hold,
      strokeW: strokeW || 10,
      petalR, centerR, petalCount, head, leaves, tendrils, dews,
      glitter: C.collectGlitter(pts, seed),
      swayAmp: 0.010 + Math.min(0.012, ft.len / 22000),
      swayPh: rnd() * U.TAU,
      impT: null, impA: 0,
      sprite: null
    };
    f.events = buildEvents(f);
    return f;
  }

  function idxAtParam(ft, s) {
    const target = s * ft.len;
    for (let i = 0; i < ft.cum.length; i++) if (ft.cum[i] >= target) return i;
    return ft.cum.length - 1;
  }

  function pointAt(f, s) {
    const i = idxAtParam(f.ft, U.clamp(s, 0, 1));
    return f.rpts[Math.min(i, f.rpts.length - 1)];
  }

  function buildEvents(f) {
    const ev = [];
    const base = f.pts[0];
    ev.push({ t: 0.02, type: 'mound', x: base.x, y: base.y });
    for (const lf of f.leaves) {
      ev.push({ t: lf.t, type: 'leaf', x: lf.x, y: lf.y });
    }
    ev.push({ t: 0.32, type: 'bud', x: f.head.x, y: f.head.y });
    const pn = (f.type === 'fuwa' || f.type === 'kuru') ? 6 : f.petalCount;
    for (let i = 0; i < pn; i++) {
      ev.push({ t: 0.46 + 0.36 * (i / Math.max(1, pn - 1)), type: 'petal', x: f.head.x, y: f.head.y, i });
    }
    ev.push({ t: 0.83, type: 'pollen', x: f.head.x, y: f.head.y });
    ev.push({ t: 0.90, type: 'chime', x: f.head.x, y: f.head.y });
    ev.push({ t: 0.94, type: 'dew', x: f.head.x, y: f.head.y });
    ev.sort((a, b) => a.t - b.t);
    return ev;
  }

  function eventsBetween(f, p0, p1) {
    return f.events.filter(e => e.t > p0 && e.t <= p1);
  }

  function swayAngle(f, t) {
    let a = f.swayAmp * (Math.sin(t * 0.9 + f.swayPh) + 0.5 * Math.sin(t * 1.7 + f.swayPh * 1.7));
    if (f.impT != null) {
      const tau = t - f.impT;
      if (tau >= 0 && tau < 3) a += f.impA * Math.exp(-2.2 * tau) * Math.sin(8 * tau);
    }
    return a;
  }

  // ======================= rendering =======================

  function petalCols(f, i, n) {
    const th = f.theme, sd = f.seed;
    if (th.rainbow) {
      const h = (i * 360 / Math.max(1, n) + sd % 40) % 360;
      return {
        inner: U.hsla(h, 58, 83, 1), mid: U.hsla(h, 74, 70, 1),
        edge: U.hsla(h, 80, 58, 1), vein: U.hsla(h, 60, 40, 1)
      };
    }
    const j = (U.hash2(i * 3, sd) - 0.5) * 6;
    return {
      inner: U.hsla(th.h - 6, th.s - 18, th.l + 14 + j, 1),
      mid: U.hsla(th.h, th.s, th.l + j, 1),
      edge: U.hsla(th.h + 8, th.s + 6, th.l - 10 + j, 1),
      vein: U.hsla(th.h + 10, th.s, th.l - 25, 1)
    };
  }

  function petalPath(ctx, len, wid, sharp) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    if (sharp) {
      ctx.quadraticCurveTo(-wid, -len * 0.45, 0, -len);
      ctx.quadraticCurveTo(wid, -len * 0.45, 0, 0);
    } else {
      ctx.bezierCurveTo(-wid * 0.95, -len * 0.25, -wid, -len * 0.80, 0, -len);
      ctx.bezierCurveTo(wid, -len * 0.80, wid * 0.95, -len * 0.25, 0, 0);
    }
    ctx.closePath();
  }

  function drawPetal(ctx, ang, baseOff, len, wid, cols, alpha, sharp) {
    ctx.save();
    ctx.rotate(ang);
    ctx.translate(0, -baseOff);
    // faint under-shadow → petals feel like they have thickness
    ctx.save();
    ctx.translate(1.1, 1.6);
    petalPath(ctx, len, wid, sharp);
    ctx.fillStyle = 'rgba(70,35,60,0.13)';
    ctx.fill();
    ctx.restore();

    petalPath(ctx, len, wid, sharp);
    const g = ctx.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, cols.inner);
    g.addColorStop(0.55, cols.mid);
    g.addColorStop(1, cols.edge);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fill();

    // veins
    ctx.globalAlpha = alpha * 0.22;
    ctx.strokeStyle = cols.vein;
    ctx.lineWidth = 0.9;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.10);
      ctx.quadraticCurveTo(k * wid * 0.30, -len * 0.5, k * wid * 0.40, -len * 0.82);
      ctx.stroke();
    }
    // translucent rim light
    ctx.globalAlpha = alpha * 0.40;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.1;
    petalPath(ctx, len, wid, sharp);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawCenter(ctx, f, scale) {
    const r = f.centerR * scale;
    if (r <= 0.5) return;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, U.hsla(52, 100, 88, 1));
    g.addColorStop(0.5, U.hsla(46, 95, 68, 1));
    g.addColorStop(1, U.hsla(36, 85, 50, 1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, U.TAU);
    ctx.fill();
    // pollen stipple ring
    const cnt = Math.max(8, Math.floor(r * 0.9));
    for (let k = 0; k < cnt; k++) {
      const a = (k / cnt) * U.TAU + f.seed % 7;
      const rr = r * 0.62 * (0.86 + 0.24 * U.hash2(k * 3 + 1, f.seed));
      ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.8)' : U.hsla(44, 92, 52, 0.9);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, Math.max(0.7, r * 0.075), 0, U.TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(150,90,20,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, U.TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.6, 0, U.TAU);
    ctx.fill();
  }

  function drawDews(ctx, f, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const d of f.dews) {
      const px = Math.cos(d.a) * d.rad, py = Math.sin(d.a) * d.rad;
      const g = ctx.createRadialGradient(px - d.r * 0.3, py - d.r * 0.35, d.r * 0.1, px, py, d.r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.5, 'rgba(240,250,255,0.4)');
      g.addColorStop(1, 'rgba(220,240,255,0.06)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, d.r, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,110,160,0.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(px, py, d.r * 0.92, 0.3, Math.PI - 0.3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(px - d.r * 0.32, py - d.r * 0.35, d.r * 0.22, 0, U.TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLeaf(ctx, f, lf, scale) {
    const ang = lf.tang + lf.side * 1.25 + lf.jit;
    const size = lf.size;
    const th = f.theme;
    const tipHue = mixHue(114, th.rainbow ? 46 : th.h, 0.32);

    ctx.save();
    ctx.translate(lf.x, lf.y);
    ctx.rotate(ang);
    ctx.scale(scale, scale);
    // shadow
    ctx.save();
    ctx.translate(1, 1.6);
    leafPath(ctx, size);
    ctx.fillStyle = 'rgba(30,50,20,0.15)';
    ctx.fill();
    ctx.restore();

    leafPath(ctx, size);
    const g = ctx.createLinearGradient(0, 0, size, 0);
    g.addColorStop(0, U.hsla(112, 50, 32, 1));
    g.addColorStop(0.6, U.hsla(116, 52, 42, 1));
    g.addColorStop(1, U.hsla(tipHue, 52, 55, 1));
    ctx.fillStyle = g;
    ctx.fill();
    // veins
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(size * 0.06, 0);
    ctx.lineTo(size * 0.92, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    for (const s2 of [0.3, 0.55, 0.78]) {
      ctx.beginPath();
      ctx.moveTo(size * s2, 0);
      ctx.lineTo(size * (s2 + 0.13), -size * 0.14);
      ctx.moveTo(size * s2, 0);
      ctx.lineTo(size * (s2 + 0.13), size * 0.14);
      ctx.stroke();
    }
    ctx.restore();
  }

  function leafPath(ctx, size) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(size * 0.25, -size * 0.36, size * 0.75, -size * 0.30, size, 0);
    ctx.bezierCurveTo(size * 0.75, size * 0.30, size * 0.25, size * 0.36, 0, 0);
    ctx.closePath();
  }

  function drawTendril(ctx, f, td, scale) {
    ctx.save();
    ctx.translate(td.x, td.y);
    ctx.rotate(td.tang + td.side * 1.4);
    ctx.strokeStyle = U.hsla(110, 45, 45, 0.85);
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const turns = 2.2 * scale;
    for (let i = 0; i <= 30; i++) {
      const tt = i / 30;
      const aa = tt * turns * U.TAU;
      const rr = td.size * (0.15 + 0.85 * tt) * scale;
      const px = Math.cos(aa) * rr + td.size * tt * 0.8;
      const py = Math.sin(aa) * rr * 0.8 - td.size * tt * 0.3;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- flower head variants ----

  function drawHeadPetals(ctx, f, p) {
    const type = f.type, n = f.petalCount, R = f.petalR;
    const baseOff = f.centerR * 0.25;
    if (type === 'hira') {
      // two translucent rings, each petal doubled slightly rotated → ひらひら
      for (let ring = 1; ring >= 0; ring--) {
        const rn = 8, rl = R * (ring ? 0.68 : 1.05), rw = R * (ring ? 0.30 : 0.40);
        for (let i = 0; i < rn; i++) {
          const t0 = 0.46 + 0.36 * (i / rn) + ring * 0.05;
          const pp = U.clamp((p - t0) / 0.20, 0, 1);
          if (pp <= 0) continue;
          const sc = U.easeOutBack(pp);
          const ang = (i / rn) * U.TAU + (ring ? U.TAU / rn / 2 : 0);
          const cols = petalCols(f, i + ring * rn, rn * 2);
          ctx.save();
          ctx.rotate((1 - pp) * -0.4);
          ctx.scale(sc, sc);
          drawPetal(ctx, ang - 0.05, baseOff, rl, rw, cols, 0.60, false);
          drawPetal(ctx, ang + 0.05, baseOff, rl * 0.96, rw, cols, 0.50, false);
          ctx.restore();
        }
      }
    } else if (type === 'maru' || type === 'hoshi') {
      const sharp = type === 'hoshi';
      const len = sharp ? R * 1.15 : R;
      const wid = sharp ? R * 0.42 : R * 0.60;
      for (let i = 0; i < n; i++) {
        const t0 = 0.46 + 0.36 * (i / Math.max(1, n - 1));
        const pp = U.clamp((p - t0) / 0.20, 0, 1);
        if (pp <= 0) continue;
        const sc = U.easeOutBack(pp);
        const ang = (i / n) * U.TAU;
        const cols = petalCols(f, i, n);
        ctx.save();
        ctx.scale(sc, sc);
        drawPetal(ctx, ang, baseOff, len, wid, cols, sharp ? 0.96 : 0.93, sharp);
        ctx.restore();
      }
      if (sharp && p > 0.86) {
        // sparkling star tips
        const a2 = U.clamp((p - 0.86) / 0.14, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.85 * a2;
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * U.TAU;
          const tx = Math.sin(ang) * (baseOff + len) * 0.98;
          const ty = -Math.cos(ang) * (baseOff + len) * 0.98;
          sparkle(ctx, tx, ty, 3.2);
        }
        ctx.restore();
      }
    } else if (type === 'tsubu') {
      const GA = 2.39996;
      for (let k = 0; k < n; k++) {
        const t0 = 0.44 + 0.42 * (k / n);
        const pp = U.clamp((p - t0) / 0.18, 0, 1);
        if (pp <= 0) continue;
        const rr = R * 0.85 * Math.sqrt((k + 0.4) / n);
        const a2 = k * GA + f.seed % 5;
        const px = Math.cos(a2) * rr, py = Math.sin(a2) * rr;
        const sz = R * 0.30 * (1.12 - 0.45 * rr / (R * 0.85)) * U.easeOutBack(pp);
        const cols = petalCols(f, k, n);
        const g = ctx.createRadialGradient(px - sz * 0.3, py - sz * 0.3, sz * 0.1, px, py, sz);
        g.addColorStop(0, cols.inner);
        g.addColorStop(0.7, cols.mid);
        g.addColorStop(1, cols.edge);
        ctx.fillStyle = 'rgba(70,35,60,0.13)';
        ctx.beginPath(); ctx.arc(px + 1, py + 1.4, sz, 0, U.TAU); ctx.fill();
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(px, py, sz, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(px - sz * 0.3, py - sz * 0.35, sz * 0.24, 0, U.TAU); ctx.fill();
      }
    } else if (type === 'fuwa') {
      const halo = U.clamp((p - 0.5) / 0.4, 0, 1);
      if (halo > 0) {
        const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.05);
        g.addColorStop(0, 'rgba(255,255,255,0.20)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = halo;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, R * 1.05, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      const th = f.theme;
      for (let k = 0; k < n; k++) {
        const t0 = 0.44 + 0.40 * (k / n);
        const pp = U.clamp((p - t0) / 0.16, 0, 1);
        if (pp <= 0) continue;
        const a2 = (k / n) * U.TAU + (U.hash2(k * 3, f.seed) - 0.5) * 0.25;
        const L = R * (0.80 + 0.35 * U.hash2(k * 5 + 1, f.seed)) * U.easeOutCubic(pp);
        const bend = (U.hash2(k * 7 + 2, f.seed) - 0.5) * L * 0.5;
        const hue = th.rainbow ? (k * 360 / n) : th.h;
        ctx.save();
        ctx.rotate(a2);
        ctx.strokeStyle = U.hsla(hue, th.rainbow ? 55 : 38, 86, 0.62);
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -f.centerR * 0.2);
        ctx.quadraticCurveTo(bend, -L * 0.55, bend * 0.7, -L);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * pp).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(bend * 0.7, -L, 2.3, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }
    } else if (type === 'kuru') {
      const sp = U.clamp((p - 0.40) / 0.48, 0, 1);
      if (sp > 0) {
        const th = f.theme;
        const full = Math.PI * 3.4;
        const thMax = full * U.easeOutCubic(sp);
        let prevX = 0, prevY = 0;
        for (let a2 = 0.12; a2 <= thMax; a2 += 0.12) {
          const rr = R * Math.pow(a2 / full, 0.85);
          const px = Math.cos(a2 - Math.PI / 2) * rr;
          const py = Math.sin(a2 - Math.PI / 2) * rr;
          const hue = th.rainbow ? (a2 * 57) % 360 : th.h + a2 * 6;
          const w = Math.max(2, R * 0.20 * (1 - (a2 / full) * 0.45));
          ctx.strokeStyle = U.hsla(hue, th.rainbow ? 74 : th.s, th.l, 0.9);
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          ctx.lineTo(px, py);
          ctx.stroke();
          // pearly lobes along the swirl
          if (Math.floor(a2 / 0.75) !== Math.floor((a2 - 0.12) / 0.75) && a2 > 1) {
            ctx.fillStyle = U.hsla(hue, th.rainbow ? 70 : th.s - 5, th.l + 16, 0.85);
            ctx.beginPath();
            ctx.arc(px, py, R * 0.13, 0, U.TAU);
            ctx.fill();
          }
          prevX = px; prevY = py;
        }
        if (p < 0.95) {
          const g = ctx.createRadialGradient(prevX, prevY, 0, prevX, prevY, 9);
          g.addColorStop(0, 'rgba(255,255,255,0.8)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(prevX, prevY, 9, 0, U.TAU); ctx.fill();
        }
      }
    }
  }

  function sparkle(ctx, x, y, r) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
    ctx.stroke();
  }

  // full flower render at bloom progress p (0..1); world coordinates
  function render(ctx, f, p, time) {
    const pts = f.pts;
    // soft contact shadow under the stroke → the line sits IN the garden
    ctx.save();
    ctx.strokeStyle = 'rgba(45,30,20,0.10)';
    ctx.lineWidth = f.strokeW * 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y + 2.5);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y + 2.5);
    ctx.stroke();
    ctx.restore();

    // little soil mound where the stem is "planted"
    const mp = U.clamp(p / 0.12, 0, 1);
    if (mp > 0) {
      const sc = U.easeOutBack(mp);
      const b = pts[0];
      ctx.fillStyle = 'rgba(88,60,40,0.92)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 2, f.strokeW * 1.7 * sc, f.strokeW * 0.8 * sc, 0, 0, U.TAU);
      ctx.fill();
      for (let k = 0; k < 4; k++) {
        const hx = (U.hash2(k * 3 + 1, f.seed) - 0.5) * f.strokeW * 3 * sc;
        ctx.fillStyle = 'rgba(70,45,28,0.8)';
        ctx.beginPath();
        ctx.arc(b.x + hx, b.y + 2 + (U.hash2(k * 5, f.seed) - 0.2) * 4, 1.4, 0, U.TAU);
        ctx.fill();
      }
    }

    // ===== the stem IS the child's stroke, re-rendered identically =====
    const wMul = 1 + 0.20 * U.smoothstep(Math.min(1, p * 2.2));
    C.drawSegs(ctx, pts, 0, pts.length - 1, {
      theme: f.theme, width: f.strokeW * wMul, seed: f.seed, alpha: 1
    });

    // magic shine travelling up the stem while it grows
    if (p < 1) {
      const s = Math.min(1, p * 1.5);
      const pt = pointAt(f, s);
      const r = f.strokeW * 2.2;
      const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
      g.addColorStop(0, 'rgba(255,255,240,' + (0.35 * (1 - p * 0.6)).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,255,240,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, U.TAU);
      ctx.fill();
    }

    // leaves & tendrils grow out of the stroke's own turning points
    for (const lf of f.leaves) {
      const lp = U.clamp((p - lf.t) / 0.22, 0, 1);
      if (lp <= 0) continue;
      drawLeaf(ctx, f, lf, U.easeOutBack(lp));
    }
    for (const td of f.tendrils) {
      const tp = U.clamp((p - td.t) / 0.3, 0, 1);
      if (tp <= 0) continue;
      drawTendril(ctx, f, td, U.easeOutCubic(tp));
    }

    // ===== blossom =====
    ctx.save();
    ctx.translate(f.head.x, f.head.y);
    ctx.rotate(f.head.ang + Math.PI / 2);
    // bud swell before petals
    const bp = U.clamp((p - 0.30) / 0.16, 0, 1);
    const petalsStarted = p > 0.46;
    if (bp > 0 && p < 0.75) {
      const bsc = U.easeOutBack(bp) * (petalsStarted ? U.clamp(1 - (p - 0.46) / 0.29, 0, 1) : 1);
      if (bsc > 0.02) {
        const br = f.centerR * 1.05 * bsc;
        const squash = 1 + 0.1 * Math.sin(p * 46);
        ctx.save();
        ctx.scale(squash, 2 - squash);
        const cols = petalCols(f, 0, 1);
        const g = ctx.createRadialGradient(0, 0, br * 0.1, 0, 0, br);
        g.addColorStop(0, cols.inner);
        g.addColorStop(1, cols.edge);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, br, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    drawHeadPetals(ctx, f, p);
    const cp = U.clamp((p - 0.55) / 0.25, 0, 1);
    if (cp > 0) {
      drawCenter(ctx, f, U.easeOutBack(cp) * (f.type === 'fuwa' ? 0.6 : 1));
    }
    const dp = U.clamp((p - 0.93) / 0.07, 0, 1);
    if (dp > 0 && f.dews.length) drawDews(ctx, f, dp);
    ctx.restore();
  }

  // bake the finished flower into a sprite (so 10+ flowers stay 60fps)
  function bake(f, dpr) {
    const m = 30;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of f.pts) {
      if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x;
      if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
    }
    const hr = f.petalR * 1.7 + f.centerR;
    minx = Math.min(minx, f.head.x - hr); maxx = Math.max(maxx, f.head.x + hr);
    miny = Math.min(miny, f.head.y - hr); maxy = Math.max(maxy, f.head.y + hr);
    for (const lf of f.leaves) {
      const e = lf.size * 1.4;
      minx = Math.min(minx, lf.x - e); maxx = Math.max(maxx, lf.x + e);
      miny = Math.min(miny, lf.y - e); maxy = Math.max(maxy, lf.y + e);
    }
    const ox = minx - m, oy = miny - m;
    const w = Math.min(1600, maxx - minx + m * 2);
    const h = Math.min(1600, maxy - miny + m * 2);
    const scale = Math.min(2, dpr);
    const cv = document.createElement('canvas');
    cv.width = Math.max(4, Math.ceil(w * scale));
    cv.height = Math.max(4, Math.ceil(h * scale));
    const x = cv.getContext('2d');
    x.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale);
    render(x, f, 1, 0.7);
    f.sprite = cv;
    f.sox = ox; f.soy = oy; f.sw = w; f.sh = h;
  }

  function drawBaked(ctx, f, t) {
    if (!f.sprite) return;
    const b = f.pts[0];
    const a = swayAngle(f, t);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    ctx.drawImage(f.sprite, f.sox - b.x, f.soy - b.y, f.sw, f.sh);
    ctx.restore();
  }

  PPG.flower = {
    THEMES, theme, create, render, bake, drawBaked,
    pointAt, swayAngle, eventsBetween, resample
  };
})(window.PPG);
