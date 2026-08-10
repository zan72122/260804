/* Rainbow Glass Tower — core simulation + Canvas 2D rendering.

   The "fluid" is a lightweight overflow graph: each glass holds 0..1, excess
   flows to its two children. The split is 50:50 with a weak bias toward
   emptier subtrees (so the tower always completes), and the player can
   override it by tilting glasses or deflecting the falling streams.

   Glasses are stemmed coupes: the bowl is the only wide part, so the whole
   region where liquid falls is open space a small finger can reach.

   Rendering is optimized for large towers (55-170 glasses):
   - static glass art is cached into sprites (one drawImage per glass)
   - the liquid body is drawn once per frame and blitted per glass
   - streams are a rotated blit of a single per-frame ribbon sprite
   - a frame-time monitor lowers quality tiers before dropping rows */
'use strict';

window.Game = (function () {
  const TAU = Math.PI * 2;
  const CAP = 1;
  const MAXTILT = 0.42;            // ~24° visual tilt at full drag
  const MIN_GLASS_W = 30;          // touch-friendly minimum glass width
  const MAX_ROWS = 18, MIN_ROWS = 6;

  // layout factors (glass height == glass width for a coupe)
  const SPAN_F = 1.22;             // horizontal pitch / glass width
  const RATIO = 1.00;              // glass height / glass width
  const STEP_F = 1.30;             // row pitch / glass height (0.30 = airy gap)

  // coupe profile, as fractions of glass height/width
  const BOWL_H = 0.52;             // bowl depth
  const BOWL_TIP = 0.26;           // bowl half-width at its base, / rim half-width
  const TH = Math.acos(BOWL_TIP);  // ellipse angle where the bowl meets the stem
  const BOWL_RY = BOWL_H / Math.sin(TH);
  const STEM_HW = 0.048, FOOT_T = 0.88, FOOT_HW = 0.23;
  const REROUTE_STR = 0.35;        // field strength needed to actually re-aim a stream

  // ---------- sky/sparkle themes (cycled on each replay) ----------
  // the drink itself is no longer themed — its colour comes from Tint / LiquidArt
  const THEMES = [
    { sparkle: '#fff3c9', sky: ['#241a52', '#5c2e91', '#c95e9e', '#ffb98a'] },
    { sparkle: '#ffe1ec', sky: ['#2b1247', '#7a2a6b', '#d9578c', '#ffc2a8'] },
    { sparkle: '#e3fbff', sky: ['#0e2a52', '#1e5d8e', '#57a8c9', '#b7ecd9'] },
    { sparkle: '#f2e4ff', sky: ['#1d1240', '#4d2483', '#8a4bb0', '#e08bb5'] },
    { sparkle: '#fff8dc', sky: ['#3a1c4f', '#8a3f66', '#d97a58', '#ffd28a'] },
  ];
  const RAINBOW = ['#ff5f6d', '#ffa14f', '#ffe95f', '#7be07b', '#5fc9ff', '#b78bff'];

  // ---------- state ----------
  let canvas, ctx, W = 0, H = 0, dpr = 1, safeTop = 0, paletteH = 0;
  let glasses = [], rows = 10, theme = THEMES[0], roundNum = 0, forceRows = 0;
  let glassW = 60, glassH = 60, spanX = 73, rowStep = 78, cloudS = 70;
  let towerCx = 0, towerTopY = 0, tableY = 0;
  let cloud = { x: 0, y: 0, drawY: 0, targetX: 0 };
  let autoPour = false, simPour = false, pouring = false;
  let pourVis = 0, holdT = 0, totalPoured = 0;
  let pool = 0, poolTint = Tint.WHITE, fullCount = 0, glowPulse = 0, topOverflowed = false, overflowAt = 0;
  let cloudTint = Tint.WHITE, brush = null;      // colour painting state (Tint {h,c})
  let state = 'play';                    // 'play' | 'celebrate'
  let celebT = 0, celebNotified = false;
  let hintT = 0, idleT = 0, time = 0, lastTs = 0;
  let streamHintT = -1, streamHintShown = false, everDeflected = false;
  let stickers = 0;
  let onComplete = null;
  let turbo = false;
  const parts = [];                      // global particle pool

  // input
  const pointers = new Map();            // pointerId -> {role, gi?, startX?}
  const deflectors = new Map();          // pointerId -> magic-finger field
  const grabs = new Map();               // streamKey -> {d, targetIdx}
  const forcedGrabs = new Map();         // test-only pinned grabs
  let streamSegs = [];                   // last frame's stream geometry

  // performance tiers
  let tier = 0, rowPenalty = 0;
  let frameMsAcc = 0, frameMsN = 0, perfTimer = 0, avgFrameMs = 0;
  const TIER = [
    { dpr: 2.0, maxParts: 400, core: true,  glints: true,  extras: true  },
    { dpr: 1.6, maxParts: 280, core: true,  glints: true,  extras: true  },
    { dpr: 1.35, maxParts: 180, core: false, glints: false, extras: false },
    { dpr: 1.2, maxParts: 140, core: false, glints: false, extras: false },
  ];

  // cached art
  let sprBack = null, sprFront = null, sprPad = 6;
  let radialSpr = null;
  let skyGrad = null, tableGrad = null;
  const glowQueue = [];
  const tiltedQueue = [];

  try { stickers = Math.min(99, parseInt(localStorage.getItem('rgt_stars') || '0', 10) || 0); } catch (e) {}

  // ---------- small utils ----------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
  const gIdx = (r, i) => r * (r + 1) / 2 + i;
  const glassAt = (r, i) => glasses[gIdx(r, i)];

  function tiltAngle(g) { return g.bias * MAXTILT; }

  // glass-local (origin = rim center, +y down) → world, honoring tilt
  function localToWorld(g, lx, ly) {
    const a = tiltAngle(g);
    if (a === 0) return { x: g.x + lx, y: g.y + ly };
    const c = Math.cos(a), s = Math.sin(a);
    const rx = lx, ry = ly - g.h;        // pivot = foot center
    return { x: g.x + rx * c - ry * s, y: g.y + g.h + rx * s + ry * c };
  }
  const rimPoint = (g, sx) => localToWorld(g, sx, 0);

  // liquid only lives in the bowl
  function surfLocal(g) {
    const bottom = g.h * BOWL_H - g.h * 0.015;
    const innerTop = g.rimRy * 1.0;
    return bottom - (bottom - innerTop) * clamp(g.disp, 0, 1.06);
  }
  const surfaceWorld = (g) => localToWorld(g, 0, surfLocal(g));

  function halfWidthLocal(g, ly) {
    const ry = g.h * BOWL_RY;
    const t = clamp(ly / ry, 0, 1);
    return (g.w / 2) * Math.sqrt(Math.max(0, 1 - t * t));
  }

  // ---------- tower setup ----------
  function computeRows() {
    if (forceRows) return clamp(forceRows, 4, 20);
    const availH = H - H * 0.15 - Math.max(H * 0.09, 42);
    const availW = W * 0.96;
    let best = MIN_ROWS;
    for (let r = MIN_ROWS; r <= MAX_ROWS; r++) {
      const gw = Math.min(availW / ((r - 1) * SPAN_F + 1),
                          availH / (r * STEP_F * RATIO));
      if (gw >= MIN_GLASS_W) best = r; else break;
    }
    return clamp(best - rowPenalty, MIN_ROWS, MAX_ROWS);
  }

  function buildTower() {
    glasses = [];
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i <= r; i++) {
        glasses.push({
          r, i, x: 0, y: 0, w: 0, h: 0, rimRy: 0,
          amount: 0, disp: 0, full: false,
          receive: 0, streamL: 0, streamR: 0, foam: 0,
          bias: 0, biasT: 0, biasV: 0, tiltHeld: false,
          seed: hash(r * 31 + i * 7) * 100,
          bubbles: [],
        });
      }
    }
    pool = 0; fullCount = 0; topOverflowed = false; overflowAt = 0;
    holdT = 0; totalPoured = 0; pourVis = 0;
    state = 'play'; celebT = 0; celebNotified = false;
    hintT = 0; idleT = 0;
    streamHintShown = false; streamHintT = -1;
    autoPour = false; simPour = false; pouring = false;
    parts.length = 0;
    grabs.clear(); forcedGrabs.clear(); deflectors.clear(); pointers.clear();
    streamSegs = [];
  }

  function layout() {
    const availH = H - H * 0.15 - Math.max(H * 0.09, 42);
    const availW = W * 0.96;
    glassW = Math.max(16, Math.min(availW / ((rows - 1) * SPAN_F + 1),
                                   availH / (rows * STEP_F * RATIO)));
    glassH = glassW * RATIO;
    spanX = glassW * SPAN_F;
    rowStep = glassH * STEP_F;
    const towerH = (rows - 1) * rowStep + glassH;
    towerCx = W / 2;
    // bias the leftover vertical slack upward: the tower sits low on the
    // table and the freed sky becomes a long, easy-to-catch pour stream
    towerTopY = H * 0.15 + Math.max(0, (availH - towerH) * 0.72);
    tableY = towerTopY + towerH + glassH * 0.06;
    for (const g of glasses) {
      g.x = towerCx + (g.i - g.r / 2) * spanX;
      g.y = towerTopY + g.r * rowStep;
      g.w = glassW; g.h = glassH;
      g.rimRy = glassW * 0.09;
    }
    cloudS = clamp(glassW * 1.7, 52, 96);
    const top = glasses[0];
    // keep a long, obvious pour stream between the cloud and the top glass
    cloud.y = Math.max(safeTop + cloudS * 0.8,
                       top.y - clamp(glassH * 3.2, cloudS * 1.15, H * 0.22));
    if (!cloud.x) cloud.x = top.x;
    cloud.targetX = top.x;
    buildStaticArt();
  }

  // ---------- glass geometry paths (local space) ----------
  function glassOutlinePath(c, w, h) {
    const hw = w * 0.5, ry = h * BOWL_RY, bh = h * BOWL_H;
    const sx = w * STEM_HW, fx = w * FOOT_HW;
    const ft = h * FOOT_T, fb = h;
    c.beginPath();
    c.ellipse(0, 0, hw, ry, 0, 0, TH);                        // right bowl wall
    c.quadraticCurveTo(w * 0.085, bh + h * 0.05, sx, bh + h * 0.09);
    c.lineTo(sx, ft);
    c.quadraticCurveTo(sx, ft + h * 0.05, fx * 0.85, fb - h * 0.018);
    c.quadraticCurveTo(fx, fb, fx * 0.7, fb);
    c.lineTo(-fx * 0.7, fb);
    c.quadraticCurveTo(-fx, fb, -fx * 0.85, fb - h * 0.018);
    c.quadraticCurveTo(-sx, ft + h * 0.05, -sx, ft);
    c.lineTo(-sx, bh + h * 0.09);
    c.quadraticCurveTo(-w * 0.085, bh + h * 0.05, -hw * BOWL_TIP, bh);
    c.ellipse(0, 0, hw, ry, 0, Math.PI - TH, Math.PI);        // left bowl wall
    c.closePath();
  }

  function bowlPath(c, w, h, inset) {
    const hw = w * 0.5 - inset, ry = h * BOWL_RY - inset;
    const bh = h * BOWL_H;
    const th = Math.asin(clamp(bh / ry, 0, 1));
    c.beginPath();
    c.moveTo(hw, 0);
    c.ellipse(0, 0, hw, ry, 0, 0, th);
    c.lineTo(-hw * Math.cos(th), bh);
    c.ellipse(0, 0, hw, ry, 0, Math.PI - th, Math.PI);
    c.closePath();
  }

  // ---------- cached sprites & gradients ----------
  function makeSprite(draw) {
    const cw = Math.ceil((glassW + sprPad * 2) * dpr);
    const ch = Math.ceil((glassH + sprPad * 2) * dpr);
    const cv = document.createElement('canvas');
    cv.width = Math.max(2, cw); cv.height = Math.max(2, ch);
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.translate(glassW / 2 + sprPad, sprPad);   // origin = rim center
    draw(c, glassW, glassH);
    return cv;
  }

  function buildStaticArt() {
    const rimRy = glassW * 0.09;
    sprBack = makeSprite((c, w, h) => {
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(0, 0, w / 2, rimRy, 0, Math.PI, TAU); c.stroke();
      // faint cool tint inside the bowl
      c.save();
      bowlPath(c, w, h, 0);
      c.clip();
      const bg = c.createLinearGradient(-w / 2, 0, w / 2, 0);
      bg.addColorStop(0, 'rgba(255,255,255,0.18)');
      bg.addColorStop(0.28, 'rgba(255,255,255,0.05)');
      bg.addColorStop(0.72, 'rgba(200,225,255,0.06)');
      bg.addColorStop(1, 'rgba(255,255,255,0.20)');
      c.fillStyle = bg;
      c.fillRect(-w / 2, 0, w, h * BOWL_H + 2);
      c.restore();
    });

    sprFront = makeSprite((c, w, h) => {
      // glassy body fill for stem + foot (thin, so keep it bright)
      c.save();
      glassOutlinePath(c, w, h);
      c.clip();
      const sg = c.createLinearGradient(-w * 0.1, 0, w * 0.1, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0.10)');
      sg.addColorStop(0.45, 'rgba(255,255,255,0.55)');
      sg.addColorStop(1, 'rgba(255,255,255,0.12)');
      c.fillStyle = sg;
      c.fillRect(-w * 0.3, h * BOWL_H, w * 0.6, h * 0.5);
      // curved highlight on the left of the bowl
      const hl = c.createLinearGradient(-w * 0.34, 0, -w * 0.12, 0);
      hl.addColorStop(0, 'rgba(255,255,255,0)');
      hl.addColorStop(0.5, 'rgba(255,255,255,0.34)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = hl;
      c.fillRect(-w * 0.38, h * 0.05, w * 0.28, h * BOWL_H * 0.85);
      c.restore();
      // outline + front rim
      c.strokeStyle = 'rgba(255,255,255,0.45)';
      c.lineWidth = 1.4;
      glassOutlinePath(c, w, h);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.6)';
      c.lineWidth = 1.8;
      c.beginPath(); c.ellipse(0, 0, w / 2, rimRy, 0, 0, Math.PI); c.stroke();
    });

    if (!radialSpr) {
      radialSpr = document.createElement('canvas');
      radialSpr.width = radialSpr.height = 128;
      const c = radialSpr.getContext('2d');
      const g = c.createRadialGradient(64, 64, 2, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    }

    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, theme.sky[0]);
    skyGrad.addColorStop(0.45, theme.sky[1]);
    skyGrad.addColorStop(0.8, theme.sky[2]);
    skyGrad.addColorStop(1, theme.sky[3]);

    tableGrad = ctx.createLinearGradient(0, tableY, 0, H);
    tableGrad.addColorStop(0, 'rgba(70,40,120,0.85)');
    tableGrad.addColorStop(0.15, 'rgba(48,26,90,0.9)');
    tableGrad.addColorStop(1, 'rgba(26,12,56,0.95)');
  }

  function liquidGradient(c, y0, y1) {
    const grad = c.createLinearGradient(0, y0, 0, y1);
    if (theme.rainbow) {
      const base = time * 18;
      for (let k = 0; k <= 5; k++) {
        grad.addColorStop(k / 5, 'hsl(' + ((base + k * 42) % 360) + ' 88% 62%)');
      }
    } else {
      const st = theme.stops;
      for (let k = 0; k < st.length; k++) grad.addColorStop(k / (st.length - 1), st[k]);
    }
    return grad;
  }

  // the bowl's liquid, drawn once per frame; each glass blits the part below
  // its own surface line (a horizontal cut of a convex shape is still correct)
  function buildLiquidSprite() {
    liquidSprScl = dpr;
    const bh = glassH * BOWL_H;
    const cw = Math.ceil((glassW + LQ_PAD * 2) * liquidSprScl);
    const ch = Math.ceil((bh + LQ_PAD * 2) * liquidSprScl);
    if (!liquidSpr) liquidSpr = document.createElement('canvas');
    if (liquidSpr.width !== cw || liquidSpr.height !== ch) {
      liquidSpr.width = Math.max(2, cw); liquidSpr.height = Math.max(2, ch);
    }
    const c = liquidSpr.getContext('2d');
    c.clearRect(0, 0, liquidSpr.width, liquidSpr.height);
    c.save();
    c.scale(liquidSprScl, liquidSprScl);
    c.translate(glassW / 2 + LQ_PAD, LQ_PAD);
    c.fillStyle = liquidGradient(c, 0, bh);
    bowlPath(c, glassW, glassH, 1.1);
    c.fill();
    c.restore();
  }

  // one ribbon sprite per frame: drink gradient + baked white core
  function buildStreamSprite() {
    if (!streamSpr) {
      streamSpr = document.createElement('canvas');
      streamSpr.width = 24; streamSpr.height = 64;
    }
    const c = streamSpr.getContext('2d');
    c.clearRect(0, 0, 24, 64);
    const grad = c.createLinearGradient(0, 0, 0, 64);
    if (theme.rainbow) {
      const base = time * 30;
      for (let k = 0; k <= 4; k++) grad.addColorStop(k / 4, 'hsl(' + ((base + k * 50) % 360) + ' 90% 66%)');
    } else {
      const st = theme.stops;
      grad.addColorStop(0, st[0]); grad.addColorStop(1, st[st.length - 1]);
    }
    // soft outer bloom so the ribbon reads against the dark sky
    c.globalAlpha = 0.35;
    c.fillStyle = grad;
    c.fillRect(1, 2, 22, 60);
    c.globalAlpha = 1;
    c.beginPath();
    c.moveTo(4, 6); c.quadraticCurveTo(4, 0, 12, 0); c.quadraticCurveTo(20, 0, 20, 6);
    c.lineTo(20, 58); c.quadraticCurveTo(20, 64, 12, 64); c.quadraticCurveTo(4, 64, 4, 58);
    c.closePath();
    c.fill();
    if (TIER[tier].core) {
      c.fillStyle = 'rgba(255,255,255,0.38)';
      c.fillRect(9, 3, 6, 58);
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.fillRect(10.8, 3, 2.4, 58);
    }
  }

  // ---------- pacing ----------
  function paceK() {
    const N = glasses.length;
    return (N * 1.1) / clamp(N * 0.8, 40, 90);
  }
  function pourRate() {
    const r = paceK() * Math.min(1.7, 0.4 + holdT * 0.022);
    return turbo ? r * 6 : r;
  }

  // ---------- stream routing ----------
  function grabCandidates(key) {
    if (key === 'cloud') {
      const out = [0];
      if (rows > 1) out.push(1, 2);
      return out;
    }
    const g = glasses[+key.split(':')[0]];
    if (!g || g.r >= rows - 1) return [];
    const out = [];
    const cr = g.r + 1;
    for (let i = Math.max(0, g.i - 2); i <= Math.min(cr, g.i + 3); i++) out.push(gIdx(cr, i));
    return out;
  }

  function nearestCandidate(key, x) {
    const cands = grabCandidates(key);
    if (!cands.length) return null;
    let best = cands[0], bd = 1e12;
    for (const idx of cands) {
      const d = Math.abs(x - glasses[idx].x);
      if (d < bd) { bd = d; best = idx; }
    }
    return best;
  }

  // route a portion of flow: deflected → target (or spray), else default child
  function deliver(portion, defIdx, key) {
    if (portion <= 0) return;
    const grab = key ? grabs.get(key) : null;
    if (grab && grab.targetIdx != null && grab.str >= REROUTE_STR) {
      const t = glasses[grab.targetIdx];
      if (grab.d.sprayT > 0) {
        const sibs = [];
        if (t.i > 0) sibs.push(glassAt(t.r, t.i - 1));
        if (t.i < t.r) sibs.push(glassAt(t.r, t.i + 1));
        t.amount += portion * 0.45;
        t.receive = Math.min(1, t.receive + portion * 2.5);
        for (const s of sibs) {
          s.amount += portion * (0.45 / sibs.length);
          s.receive = Math.min(1, s.receive + portion * 2);
        }
        pool = Math.min(pool + portion * 0.1, 8);
      } else {
        t.amount += portion;
        t.receive = Math.min(1, t.receive + portion * 6);
      }
      return;
    }
    if (defIdx == null) {
      pool = Math.min(pool + portion, 8);
    } else {
      const d = glasses[defIdx];
      d.amount += portion;
      d.receive = Math.min(1, d.receive + portion * 6);
    }
  }

  function distToSegSq(px, py, seg) {
    let best = 1e12;
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const qx = lerp(lerp(seg.x0, seg.cx, t), lerp(seg.cx, seg.x1, t), t);
      const qy = lerp(lerp(seg.y0, seg.cy, t), lerp(seg.cy, seg.y1, t), t);
      const d = (px - qx) * (px - qx) + (py - qy) * (py - qy);
      if (d < best) best = d;
    }
    return best;
  }

  function deflectRadius() { return Math.max(58, glassW * 1.9); }

  // every stream inside a finger's field bends toward it — no aiming needed
  function rebuildGrabs(dt) {
    grabs.clear();
    for (const d of deflectors.values()) d.sprayT = Math.max(0, d.sprayT - dt);
    if (deflectors.size && streamSegs.length) {
      const R = deflectRadius(), R2 = R * R;
      for (const seg of streamSegs) {
        if (seg.intensity < 0.12) continue;
        let bestD = null, bd = R2;
        for (const d of deflectors.values()) {
          const dd = distToSegSq(d.x, d.y, seg);
          if (dd < bd) { bd = dd; bestD = d; }
        }
        if (bestD) {
          // falloff: streams under the fingertip bend fully, the outer ones
          // only lean toward it — reads as a force field, not a magnet
          const str = clamp(1 - Math.sqrt(bd) / R, 0, 1);
          const ti = nearestCandidate(seg.key, bestD.x);
          if (ti != null) grabs.set(seg.key, { d: bestD, targetIdx: ti, str });
        }
      }
    }
    for (const [k, v] of forcedGrabs) grabs.set(k, v);
  }

  // ---------- simulation ----------
  function update(dt) {
    time += dt;
    glowPulse = Math.max(0, glowPulse - dt * 1.4);
    if (state !== 'play') autoPour = false;
    pouring = state === 'play' && (autoPour || simPour);

    rebuildGrabs(dt);

    // --- pouring from the cloud ---
    const top = glasses[0];
    if (pouring) {
      holdT += dt;
      idleT = 0;
      const add = pourRate() * dt;
      totalPoured += add;
      deliver(add, 0, 'cloud');
      pourVis += (1 - pourVis) * Math.min(1, dt * 8);
      if (Math.random() < 0.5 && !grabs.has('cloud')) {
        const sp = surfaceWorld(top);
        spawnSplash(sp.x + rnd(-4, 4), sp.y, 1);
      }
    } else {
      holdT = Math.max(0, holdT - dt * 1.2);
      idleT += dt;
      pourVis += (0 - pourVis) * Math.min(1, dt * 5);
    }

    // --- tilt dynamics ---
    for (const g of glasses) {
      if (g.tiltHeld) {
        g.bias += (g.biasT - g.bias) * Math.min(1, dt * 12);
        g.biasV = 0;
      } else if (g.bias !== 0 || g.biasV !== 0) {
        g.biasV += (-g.bias * 70 - g.biasV * 8) * dt;
        g.bias += g.biasV * dt;
        if (Math.abs(g.bias) < 0.002 && Math.abs(g.biasV) < 0.01) { g.bias = 0; g.biasV = 0; }
      }
    }

    // --- subtree "thirst" (floor keeps deep towers from stalling) ---
    const need = new Float32Array(glasses.length);
    for (let k = glasses.length - 1; k >= 0; k--) {
      const g = glasses[k];
      let n = g.full ? 0 : Math.max(0.25, CAP - g.amount);
      if (g.r < rows - 1) {
        n += Math.max(need[gIdx(g.r + 1, g.i)], need[gIdx(g.r + 1, g.i + 1)]) * 0.98;
      }
      need[k] = n;
    }
    // weak assist early (player agency), strong assist late (always completes)
    const eps = lerp(0.3, 0.04, Math.pow(fullCount / Math.max(1, glasses.length), 1.2));

    // --- overflow transfer, top row downward ---
    const flowK = turbo ? 6 : 1;
    for (let k = 0; k < glasses.length; k++) {
      const g = glasses[k];
      let flowL = 0, flowR = 0;
      const capEff = CAP - Math.max(0, Math.abs(g.bias) - 0.5) * 0.3;
      if (g.amount > capEff) {
        const excess = g.amount - capEff;
        const out = Math.min(excess, dt * (1.5 + excess * 3.5) * flowK);
        g.amount -= out;
        if (g.r === 0 && !topOverflowed && out > 0) {
          topOverflowed = true;
          overflowAt = time;
          glowPulse = 1;
          Sound.sparkle();
          spawnRing(g.x, g.y, g.w * 1.4, theme.sparkle);
        }
        if (g.r < rows - 1) {
          const idxL = gIdx(g.r + 1, g.i), idxR = gIdx(g.r + 1, g.i + 1);
          const wl = need[idxL] + eps, wr = need[idxR] + eps;
          let s = wl / (wl + wr);
          const b = g.bias;
          if (Math.abs(b) > 0.03) s = lerp(s, b > 0 ? 0 : 1, Math.min(1, Math.abs(b) * 1.15));
          deliver(out * s, idxL, k + ':L');
          deliver(out * (1 - s), idxR, k + ':R');
          flowL = (out * s) / Math.max(dt, 1e-4);
          flowR = (out * (1 - s)) / Math.max(dt, 1e-4);
        } else {
          pool = Math.min(pool + out, 8);
          flowL = flowR = (out * 0.5) / Math.max(dt, 1e-4);
        }
        if (g.amount > 1.5) g.amount = 1.5;
      }
      const sm = Math.min(1, dt * 7);
      const norm = 1 / Math.max(0.6, paceK());
      // any live stream stays clearly visible even when split many ways
      const visL = flowL * norm > 0.02 ? 0.4 + 0.6 * Math.min(1, flowL * 1.5 * norm) : 0;
      const visR = flowR * norm > 0.02 ? 0.4 + 0.6 * Math.min(1, flowR * 1.5 * norm) : 0;
      g.streamL += (visL - g.streamL) * sm;
      g.streamR += (visR - g.streamR) * sm;
      g.foam += ((g.streamL + g.streamR > 0.06 ? 1 : 0) - g.foam) * sm;
    }

    // --- per-glass bookkeeping / events / bubbles ---
    const N = glasses.length;
    const maxBub = tier >= 2 ? 1 : (N > 60 ? 2 : 4);
    const bubScale = Math.min(1, 40 / N);
    for (const g of glasses) {
      g.disp += (Math.min(g.amount, 1.03) - g.disp) * Math.min(1, dt * 7);
      g.receive = Math.max(0, g.receive - g.receive * dt * 4);

      if (!g.full && g.amount >= CAP * 0.999) {
        g.full = true;
        fullCount++;
        Sound.chime(fullCount - 1);
        spawnRing(g.x, g.y, g.w, theme.sparkle);
        spawnStars(g.x, g.y, 4, g.w);
        let rowFull = true;
        for (let i = 0; i <= g.r; i++) if (!glassAt(g.r, i).full) rowFull = false;
        if (rowFull && g.r > 0) {
          glowPulse = Math.max(glowPulse, 0.8);
          for (let i = 0; i <= g.r; i += (g.r > 7 ? 2 : 1)) {
            const gg = glassAt(g.r, i);
            spawnStars(gg.x, gg.y, 2, gg.w);
          }
        }
      }

      if (g.receive > 0.1 && Math.random() < g.receive * 0.8 * bubScale) {
        const sp = surfaceWorld(g);
        spawnSplash(sp.x + rnd(-g.w * 0.2, g.w * 0.2), sp.y, g.receive);
      }
      if (g.disp > 0.12 && g.bubbles.length < maxBub &&
          Math.random() < dt * (1.2 + g.receive * 4) * bubScale) {
        g.bubbles.push({ u: rnd(-0.6, 0.6), t: 0, spd: rnd(0.25, 0.55), r: rnd(1.2, 2.6) });
      }
      for (let b = g.bubbles.length - 1; b >= 0; b--) {
        const bb = g.bubbles[b];
        bb.t += dt * bb.spd;
        if (bb.t >= 1) g.bubbles.splice(b, 1);
      }
    }

    // --- completion ---
    if (state === 'play' && fullCount === glasses.length) {
      state = 'celebrate';
      celebT = 0;
      autoPour = false;
      for (const g of glasses) { g.amount = Math.max(g.amount, CAP); g.tiltHeld = false; }
      grabs.clear(); forcedGrabs.clear(); deflectors.clear();
      stickers = Math.min(99, stickers + 1);
      try { localStorage.setItem('rgt_stars', String(stickers)); } catch (e) {}
      Sound.setPour(false);
      Sound.fanfare();
      glowPulse = 1;
      spawnRing(towerCx, towerTopY + rows * rowStep * 0.45, glassW * rows * 0.7, '#ffffff');
    }

    // --- celebration timeline ---
    if (state === 'celebrate') {
      celebT += dt;
      if (celebT < 5 && Math.random() < dt * 5) {
        spawnFirework(rnd(W * 0.15, W * 0.85), rnd(H * 0.12, H * 0.5));
      }
      if (celebT < 6 && Math.random() < dt * 14) {
        parts.push({ type: 'confetti', x: rnd(0, W), y: -10, vx: rnd(-20, 20), vy: rnd(40, 90),
                     t: 0, life: rnd(3, 5), size: rnd(4, 8), hue: rnd(0, 360),
                     rot: rnd(0, TAU), rv: rnd(-4, 4), sway: rnd(1, 3) });
      }
      if (!celebNotified && celebT > 1.3) {
        celebNotified = true;
        if (onComplete) onComplete();
      }
    }

    // --- hints ---
    // 👆 on the cloud whenever the water is off
    const wantHint = state === 'play' && !pouring && idleT > 0.8;
    hintT += ((wantHint ? 1 : 0) - hintT) * Math.min(1, dt * 4);
    if (!streamHintShown && state === 'play' && topOverflowed && !everDeflected &&
        time - overflowAt > 5 && pourVis > 0.3) {
      streamHintShown = true;
      streamHintT = 0;
    }
    if (streamHintT >= 0) {
      streamHintT += dt;
      if (streamHintT > 4.5 || everDeflected) streamHintT = -1;
    }

    cloud.targetX = glasses[0].x;
    cloud.x += (cloud.targetX - cloud.x) * Math.min(1, dt * 3);

    updateParticles(dt);
  }

  // ---------- performance monitor ----------
  function notePerf(cpuMs, dt) {
    frameMsAcc += cpuMs; frameMsN++;
    perfTimer += dt;
    if (perfTimer >= 2 && frameMsN > 30) {
      avgFrameMs = frameMsAcc / frameMsN;
      frameMsAcc = 0; frameMsN = 0; perfTimer = 0;
      if (time > 3 && avgFrameMs > 12 && tier < TIER.length - 1) {
        tier++;
        resizeInternal();
      } else if (time > 3 && avgFrameMs > 14 && tier === TIER.length - 1) {
        rowPenalty = Math.min(rowPenalty + 2, 6);   // applies on next reset
      }
    }
  }

  // ---------- particles ----------
  function push(p) {
    if (parts.length > TIER[tier].maxParts) parts.shift();
    parts.push(p);
  }
  function spawnSplash(x, y, power) {
    const n = 1 + Math.floor(power * 2);
    for (let k = 0; k < n; k++) {
      push({ type: 'drop', x: x + rnd(-3, 3), y, vx: rnd(-40, 40) * power, vy: rnd(-90, -30) * power,
             t: 0, life: rnd(0.35, 0.6), size: rnd(1.5, 3) });
    }
  }
  function spawnRing(x, y, size, color) {
    push({ type: 'ring', x, y, t: 0, life: 0.7, size, color });
  }
  function spawnStars(x, y, n, spread) {
    for (let k = 0; k < n; k++) {
      push({ type: 'star', x: x + rnd(-spread, spread) * 0.6, y: y + rnd(-6, 6),
             vx: rnd(-50, 50), vy: rnd(-120, -40), t: 0, life: rnd(0.7, 1.2),
             size: rnd(3, 6), hue: rnd(0, 360), rot: rnd(0, TAU), rv: rnd(-6, 6) });
    }
  }
  function spawnFirework(x, y) {
    const hue = rnd(0, 360);
    spawnRing(x, y, rnd(30, 70), 'hsl(' + hue + ' 90% 75%)');
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU + rnd(-0.1, 0.1);
      const sp = rnd(60, 170);
      push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
             t: 0, life: rnd(0.7, 1.3), size: rnd(2, 4), hue: hue + rnd(-25, 25) });
    }
    Sound.pop();
  }
  function tapBurst(x, y) {
    spawnRing(x, y, 36, '#ffffff');
    spawnStars(x, y, 6, 30);
    Sound.pop();
  }
  function spawnSpray(x, y, dir) {
    for (let k = 0; k < 4; k++) {
      push({ type: 'drop', x: x + rnd(-4, 4), y: y + rnd(-4, 4),
             vx: dir * rnd(60, 220) + rnd(-40, 40), vy: rnd(-120, 30),
             t: 0, life: rnd(0.3, 0.6), size: rnd(1.5, 3) });
    }
  }

  function updateParticles(dt) {
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(k, 1); continue; }
      switch (p.type) {
        case 'drop':
        case 'star':
          p.vy += 330 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.rot != null) p.rot += p.rv * dt;
          break;
        case 'spark':
          p.vy += 90 * dt; p.vx *= (1 - dt * 1.6); p.vy *= (1 - dt * 0.4);
          p.x += p.vx * dt; p.y += p.vy * dt;
          break;
        case 'confetti':
          p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(p.t * p.sway * 3) * 24 * dt;
          p.rot += p.rv * dt;
          break;
      }
    }
  }

  function drawParticles(c) {
    for (const p of parts) {
      if (p.type !== 'confetti') continue;
      const a = 1 - p.t / p.life;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.globalAlpha = Math.min(1, a * 2);
      c.fillStyle = 'hsl(' + p.hue + ' 90% 65%)';
      c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      c.restore();
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      const a = 1 - p.t / p.life;
      switch (p.type) {
        case 'drop':
          c.globalAlpha = a * 0.9;
          c.fillStyle = 'rgba(255,255,255,0.95)';
          c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill();
          break;
        case 'spark':
          c.globalAlpha = a;
          c.fillStyle = 'hsl(' + p.hue + ' 95% 72%)';
          c.beginPath(); c.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, TAU); c.fill();
          break;
        case 'star':
          c.globalAlpha = a;
          drawStarShape(c, p.x, p.y, p.size, p.rot, 'hsl(' + p.hue + ' 95% 78%)');
          break;
        case 'ring': {
          const rr = p.size * (0.3 + (p.t / p.life) * 1.2);
          c.globalAlpha = a * 0.8;
          c.strokeStyle = p.color;
          c.lineWidth = 3 * a + 0.5;
          c.beginPath(); c.arc(p.x, p.y, rr, 0, TAU); c.stroke();
          break;
        }
      }
    }
    c.restore();
    c.globalAlpha = 1;
  }

  function drawStarShape(c, x, y, r, rot, fill) {
    c.save();
    c.translate(x, y); c.rotate(rot || 0);
    c.fillStyle = fill;
    c.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + k * TAU / 5;
      const b = a + TAU / 10;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      c.lineTo(Math.cos(b) * r * 0.45, Math.sin(b) * r * 0.45);
    }
    c.closePath(); c.fill();
    c.restore();
  }

  // ---------- glass rendering ----------
  function drawGlass(c, g) {
    const ang = tiltAngle(g);
    const w = g.w, h = g.h;
    c.save();
    c.translate(g.x, g.y + h);
    if (ang !== 0) c.rotate(ang);
    c.translate(0, -h);                        // origin = rim center (local)

    const sw = w + sprPad * 2, sh = h + sprPad * 2;
    c.drawImage(sprBack, -w / 2 - sprPad, -sprPad, sw, sh);

    if (g.disp > 0.015) {
      const wob = Math.sin(time * 6 + g.seed) * (0.6 + Math.min(g.receive * 5, 3)) * h * 0.008;
      const surfY = Math.max(0, surfLocal(g) + wob);
      const shw = halfWidthLocal(g, surfY) - 1.1;

      const srcY = clamp((surfY + LQ_PAD) * liquidSprScl, 0, liquidSpr.height);
      const srcH = liquidSpr.height - srcY;
      if (srcH > 0.5) {
        c.globalAlpha = 0.93;
        c.drawImage(liquidSpr, 0, srcY, liquidSpr.width, srcH,
                    -w / 2 - LQ_PAD, surfY, w + LQ_PAD * 2, srcH / liquidSprScl);
        c.globalAlpha = 1;
      }

      if (g.bubbles.length) {
        c.fillStyle = 'rgba(255,255,255,0.75)';
        for (const bb of g.bubbles) {
          const byy = lerp(h * BOWL_H - 3, surfY + 3, bb.t);
          if (byy < surfY + 2) continue;
          const bx = bb.u * halfWidthLocal(g, byy) * 0.75 + Math.sin(bb.t * 9 + g.seed) * 1.5;
          c.globalAlpha = 0.35 + 0.4 * bb.t;
          c.beginPath(); c.arc(bx, byy, bb.r, 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
      }

      // liquid surface — stays level in world space while the glass tilts
      if (shw > 1) {
        c.save();
        c.translate(0, surfY);
        if (ang !== 0) c.rotate(-ang);
        c.fillStyle = 'rgba(255,255,255,0.32)';
        c.beginPath();
        c.ellipse(0, 0, shw, g.rimRy * 0.7 + Math.abs(wob) * 0.4, 0, 0, TAU);
        c.fill();
        if (tier < 1) {
          c.strokeStyle = 'rgba(255,255,255,0.5)';
          c.lineWidth = 1;
          c.stroke();
        }
        c.restore();
      }
    }

    c.drawImage(sprFront, -w / 2 - sprPad, -sprPad, sw, sh);
    c.restore();

    if (g.full || g.foam > 0.05) glowQueue.push(g);
  }

  // soft magic light under every foot — justifies the levitating rows
  function drawFootGlows(c) {
    if (!TIER[tier].extras) return;
    const gw = glassW * 0.8, gh = glassW * 0.34;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.16;
    for (const g of glasses) {
      const p = localToWorld(g, 0, g.h + gh * 0.15);
      c.drawImage(radialSpr, p.x - gw / 2, p.y - gh / 2, gw, gh);
    }
    c.restore();
  }

  // one composite pass for every glowing / foaming rim
  function drawGlowPass(c) {
    if (!glowQueue.length) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = theme.sparkle;
    c.lineWidth = 4;
    for (const g of glowQueue) {
      if (!g.full) continue;
      const rc = rimPoint(g, 0);
      c.globalAlpha = 0.35 * (0.55 + 0.45 * Math.sin(time * 5 + g.seed));
      c.beginPath(); c.ellipse(rc.x, rc.y, g.w / 2, g.rimRy, tiltAngle(g), 0, TAU); c.stroke();
    }
    c.restore();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    for (const g of glowQueue) {
      if (g.foam <= 0.05) continue;
      const rc = rimPoint(g, 0);
      c.globalAlpha = g.foam * (0.5 + 0.3 * Math.sin(time * 14 + g.seed));
      c.beginPath(); c.ellipse(rc.x, rc.y, g.w / 2, g.rimRy, tiltAngle(g), 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
    glowQueue.length = 0;
  }

  // ---------- streams ----------
  function drawStream(c, key, x0, y0, x1, y1, w, intensity, ctrl) {
    if (intensity < 0.03) return;
    const a = Math.min(1, 0.55 + clamp(intensity, 0, 1) * 0.45);
    const wig = 0.88 + 0.12 * Math.sin(time * 22 + x0 * 0.3);
    if (ctrl) {
      // bent by a finger: two blits through the control point
      drawStraight(c, x0, y0, ctrl.x, ctrl.y, w * wig, a);
      drawStraight(c, ctrl.x, ctrl.y, x1, y1, w * wig, a);
    } else {
      drawStraight(c, x0, y0, x1, y1, w * wig, a);
    }
    if (key) {
      streamSegs.push({ key, x0, y0,
                        cx: ctrl ? ctrl.x : (x0 + x1) / 2,
                        cy: ctrl ? ctrl.y : (y0 + y1) / 2,
                        x1, y1, intensity });
    }
    if (TIER[tier].glints && Math.random() < intensity * 0.25) {
      const t = Math.random();
      push({ type: 'drop', x: lerp(x0, x1, t) + rnd(-2, 2), y: lerp(y0, y1, t),
             vx: rnd(-10, 10), vy: rnd(20, 60), t: 0, life: 0.3, size: rnd(1, 2.2) });
    }
  }

  function drawStraight(c, x0, y0, x1, y1, w, alpha) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1.5) return;
    c.save();
    c.translate(x0, y0);
    c.rotate(Math.atan2(dy, dx) - Math.PI / 2);
    c.globalAlpha = alpha;
    c.drawImage(streamSpr, -w * 0.75, -2, w * 1.5, len + 4);
    c.restore();
  }

  function drawStreams(c) {
    const sw = Math.max(7, glassW * 0.26);
    for (let k = 0; k < glasses.length; k++) {
      const g = glasses[k];
      if (g.streamL < 0.03 && g.streamR < 0.03) continue;
      const pl = rimPoint(g, -g.w * 0.47);
      const pr = rimPoint(g, g.w * 0.47);
      if (g.r < rows - 1) {
        const L = glassAt(g.r + 1, g.i), R = glassAt(g.r + 1, g.i + 1);
        emitStream(c, k + ':L', pl, g.streamL, sw, L.x + L.w * 0.1, L.y + 2);
        emitStream(c, k + ':R', pr, g.streamR, sw, R.x - R.w * 0.1, R.y + 2);
      } else {
        drawStream(c, null, pl.x, pl.y + 1, pl.x - g.w * 0.06, tableY + 3, sw * 0.9, g.streamL);
        drawStream(c, null, pr.x, pr.y + 1, pr.x + g.w * 0.06, tableY + 3, sw * 0.9, g.streamR);
      }
    }
  }

  function emitStream(c, key, from, intensity, sw, defX, defY) {
    if (intensity < 0.03) return;
    const grab = grabs.get(key);
    let ex = defX, ey = defY;
    if (!grab || grab.targetIdx == null) {
      drawStream(c, key, from.x, from.y + 1, ex, ey, sw, intensity);
      return;
    }
    if (grab.str >= REROUTE_STR) {
      if (grab.d.sprayT > 0) {                    // fast swipe shatters the flow
        drawStream(c, key, from.x, from.y + 1, grab.d.x, grab.d.y, sw, intensity);
        spawnSpray(grab.d.x, grab.d.y, grab.d.vx >= 0 ? 1 : -1);
        return;
      }
      const e = surfaceWorld(glasses[grab.targetIdx]);
      ex = e.x; ey = e.y - 2;
    }
    drawStream(c, key, from.x, from.y + 1, ex, ey, sw, intensity, {
      x: lerp((from.x + ex) / 2, grab.d.x, grab.str),
      y: lerp((from.y + ey) / 2, grab.d.y, grab.str),
    });
  }

  // the finger, rendered as a transparent spoon catching the flow
  function drawDeflectors(c) {
    if (!deflectors.size) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const R = deflectRadius();
    for (const d of deflectors.values()) {
      c.globalAlpha = 0.13;
      c.drawImage(radialSpr, d.x - R, d.y - R, R * 2, R * 2);
      c.globalAlpha = 0.6;
      c.drawImage(radialSpr, d.x - 20, d.y - 20, 40, 40);
      c.globalAlpha = 0.85;
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(d.x, d.y + 4, 12, Math.PI * 0.08, Math.PI * 0.92);
      c.stroke();
    }
    c.restore();
  }

  // ---------- cloud (the pourer / on-off switch) ----------
  function drawCloud(c) {
    const s = cloudS;
    const x = cloud.x;
    const y = cloud.y + Math.sin(time * 1.7) * s * 0.05;
    cloud.drawY = y;

    if (pourVis > 0.03) {
      const top = glasses[0];
      const sy0 = y + s * 0.28;
      const w = Math.max(10, glassW * 0.34) * (0.75 + 0.25 * Math.min(1, pourRate() / (1.7 * paceK())));
      const end = surfaceWorld(top);
      emitStream(c, 'cloud', { x, y: sy0 - 1 }, pourVis, w, top.x, end.y);
    }

    // tappable affordance while the water is off
    if (!pouring && state === 'play') {
      const pulse = (time * 0.9) % 1;
      c.save();
      c.globalAlpha = (1 - pulse) * 0.55;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 3;
      c.beginPath(); c.arc(x, y, s * (0.55 + pulse * 0.5), 0, TAU); c.stroke();
      c.restore();
    }

    c.save();
    const puffs = [
      [0, 0, 0.42], [-0.42, 0.08, 0.3], [0.42, 0.08, 0.3],
      [-0.2, -0.18, 0.3], [0.22, -0.16, 0.32],
    ];
    c.fillStyle = '#ffffff';
    for (const [px, py, pr] of puffs) {
      c.beginPath(); c.arc(x + px * s, y + py * s, pr * s, 0, TAU); c.fill();
    }
    const sh = c.createLinearGradient(0, y - s * 0.3, 0, y + s * 0.4);
    sh.addColorStop(0, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(150,160,220,0.35)');
    c.fillStyle = sh;
    for (const [px, py, pr] of puffs) {
      c.beginPath(); c.arc(x + px * s, y + py * s, pr * s, 0, TAU); c.fill();
    }

    const happy = pouring || state === 'celebrate';
    c.strokeStyle = '#6b5a8e';
    c.fillStyle = '#6b5a8e';
    c.lineWidth = Math.max(1.6, s * 0.045);
    c.lineCap = 'round';
    const ey = y - s * 0.02, ex = s * 0.16;
    if (happy) {
      for (const sgn of [-1, 1]) {
        c.beginPath();
        c.arc(x + sgn * ex, ey + s * 0.03, s * 0.07, Math.PI * 1.15, Math.PI * 1.85);
        c.stroke();
      }
    } else {
      const blink = (Math.sin(time * 0.9) > 0.97) ? 0.2 : 1;
      for (const sgn of [-1, 1]) {
        c.beginPath();
        c.ellipse(x + sgn * ex, ey, s * 0.045, s * 0.045 * blink, 0, 0, TAU);
        c.fill();
      }
    }
    c.beginPath();
    c.arc(x, y + s * 0.08, s * 0.09, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
    c.fillStyle = 'rgba(255,150,180,0.55)';
    for (const sgn of [-1, 1]) {
      c.beginPath();
      c.ellipse(x + sgn * s * 0.3, y + s * 0.08, s * 0.07, s * 0.045, 0, 0, TAU);
      c.fill();
    }
    c.restore();
  }

  // ---------- background & scenery ----------
  function drawBackground(c) {
    c.fillStyle = skyGrad;
    c.fillRect(0, 0, W, H);
    c.save();
    for (let k = 0; k < 34; k++) {
      const sx = hash(k * 3.7) * W;
      const sy = hash(k * 9.1) * H * 0.55;
      const tw = (Math.sin(time * (1 + hash(k) * 2) + k) + 1) / 2;
      c.globalAlpha = 0.15 + tw * 0.5;
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(sx, sy, 0.8 + hash(k * 5.3) * 1.4, 0, TAU); c.fill();
    }
    for (let k = 0; k < 7; k++) {
      const bx = (hash(k * 13.1) * W + time * (4 + k * 2)) % (W + 160) - 80;
      const by = hash(k * 7.7) * H * 0.8;
      const br = 26 + hash(k * 3.3) * 44;
      c.globalAlpha = 0.10;
      c.drawImage(radialSpr, bx - br, by - br, br * 2, br * 2);
    }
    c.restore();
    const aw = Math.max(6, glassW * 0.16);
    c.save();
    c.globalAlpha = state === 'celebrate' ? Math.min(0.55, 0.12 + celebT * 0.2) : 0.10;
    c.lineCap = 'butt';
    const r0 = Math.min(W, H) * 0.52;
    for (let k = 0; k < RAINBOW.length; k++) {
      c.strokeStyle = RAINBOW[k];
      c.lineWidth = aw;
      c.beginPath();
      c.arc(towerCx, tableY, r0 - k * aw, Math.PI, TAU);
      c.stroke();
    }
    c.restore();
  }

  function drawTable(c) {
    c.fillStyle = tableGrad;
    c.fillRect(0, tableY, W, H - tableY);
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.fillRect(0, tableY, W, 2);
    const shW = (rows - 1) * spanX + glassW;
    c.save();
    c.globalAlpha = 0.3;
    c.translate(towerCx, tableY + 8);
    c.scale(1, 0.18);
    const gd = c.createRadialGradient(0, 0, 1, 0, 0, shW * 0.65);
    gd.addColorStop(0, 'rgba(10,4,30,1)');
    gd.addColorStop(1, 'rgba(10,4,30,0)');
    c.fillStyle = gd;
    c.beginPath(); c.arc(0, 0, shW * 0.65, 0, TAU); c.fill();
    c.restore();
  }

  function drawPool(c) {
    if (pool < 0.02) return;
    const pw = ((rows - 1) * spanX + glassW) * 0.55 * Math.min(1, 0.3 + pool / 4);
    const py = tableY + 6;
    c.save();
    c.globalAlpha = Math.min(0.75, 0.25 + pool * 0.15);
    c.fillStyle = liquidGradient(c, py - 6, py + 8);
    c.beginPath();
    c.ellipse(towerCx, py, pw, Math.max(5, glassW * 0.16), 0, 0, TAU);
    c.fill();
    c.globalAlpha *= 0.7;
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();
  }

  // ---------- HUD ----------
  function drawStickers(c) {
    if (stickers <= 0) return;
    const n = Math.min(stickers, 8);
    const sz = 9, gap = sz * 2.4;
    const y0 = Math.min(tableY + (H - tableY) * 0.55, H - 18);
    const x0 = W / 2 - ((n - 1) * gap + (stickers > 8 ? 34 : 0)) / 2;
    c.save();
    for (let k = 0; k < n; k++) {
      const bounce = Math.sin(time * 2.4 + k * 0.9) * 1.5;
      drawStarShape(c, x0 + k * gap, y0 + bounce, sz, 0, '#ffd94f');
      drawStarShape(c, x0 + k * gap, y0 + bounce, sz * 0.45, 0, '#fff3b8');
    }
    if (stickers > 8) {
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.font = '600 14px -apple-system, sans-serif';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText('×' + stickers, x0 + n * gap - gap * 0.3, y0);
    }
    c.restore();
  }

  // 👆 pointing at the cloud: tap it to start the water
  function drawHint(c) {
    if (hintT < 0.05) return;
    const hx = cloud.x + cloudS * 0.1;
    const hy = cloud.drawY + cloudS * 0.75;
    const pulse = (time * 1.1) % 1;
    c.save();
    c.globalAlpha = hintT;
    c.font = (30 - Math.sin(pulse * TAU) * 4) + 'px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('👆', hx, hy + Math.sin(pulse * TAU) * 5);
    c.restore();
  }

  // one-time wordless hint: a ghost finger slides across the pour stream
  function drawStreamHint(c) {
    if (streamHintT < 0) return;
    const top = glasses[0];
    const a = Math.min(1, streamHintT * 2) * Math.min(1, 4.5 - streamHintT);
    const hx = top.x + Math.sin(streamHintT * 2.2) * glassW * 1.2;
    const hy = (cloud.drawY + cloudS * 0.28 + top.y) / 2;
    c.save();
    c.globalAlpha = clamp(a, 0, 1) * 0.9;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    c.beginPath(); c.arc(hx, hy, 13, 0, TAU); c.stroke();
    c.font = '24px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('👆', hx, hy + 20);
    c.restore();
  }

  function drawTitle(c) {
    const ty = safeTop + Math.max(12, H * 0.018);
    if (cloud.y - cloudS * 0.8 < ty + 26) return;
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.font = '700 ' + Math.max(13, Math.min(19, W * 0.032)) + 'px -apple-system, "Hiragino Maru Gothic ProN", sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.shadowColor = 'rgba(255,160,220,0.8)';
    c.shadowBlur = 8;
    c.fillText('✦ にじいろ グラスタワー ✦', W / 2, ty);
    c.restore();
  }

  // ---------- master render ----------
  let profOn = false;
  const prof = {};
  function mark(name, t0) {
    if (!profOn) return 0;
    const t = performance.now();
    prof[name] = (prof[name] || 0) + (t - t0);
    return t;
  }

  function render() {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    streamSegs = [];
    buildStreamSprite();
    buildLiquidSprite();

    let t = profOn ? performance.now() : 0;
    drawBackground(c);
    drawTable(c);
    drawPool(c);
    drawFootGlows(c);
    t = mark('bg', t);
    // a glass the child is tipping goes on top, so it never hides behind a neighbor
    for (const g of glasses) {
      if (g.bias > 0.02 || g.bias < -0.02) tiltedQueue.push(g); else drawGlass(c, g);
    }
    for (const g of tiltedQueue) drawGlass(c, g);
    tiltedQueue.length = 0;
    t = mark('glasses', t);
    drawStreams(c);
    t = mark('streams', t);
    drawGlowPass(c);
    drawDeflectors(c);
    drawCloud(c);
    drawParticles(c);
    mark('parts', t);
    drawTitle(c);
    drawStickers(c);
    drawHint(c);
    drawStreamHint(c);

    if (glowPulse > 0.01) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = glowPulse * 0.16;
      const r = Math.max(W, H) * 0.7;
      c.drawImage(radialSpr, towerCx - r, H * 0.4 - r, r * 2, r * 2);
      c.restore();
    }
  }

  // ---------- input ----------
  // the bowl is the tilt handle; everything below it is open water
  function hitBowl(x, y) {
    let best = null, bd = 1e12;
    for (let k = 0; k < glasses.length; k++) {
      const g = glasses[k];
      if (y < g.y - g.rimRy * 1.8 || y > g.y + g.h * 0.62) continue;
      const dx = Math.abs(x - g.x);
      if (dx > Math.max(g.w * 0.52, 20)) continue;
      if (dx < bd) { bd = dx; best = k; }
    }
    return best;
  }

  function hitCloud(x, y) {
    return Math.abs(x - cloud.x) < cloudS * 0.8 && Math.abs(y - cloud.drawY) < cloudS * 0.65;
  }

  function streamsNear(x, y) {
    const R2 = deflectRadius() * deflectRadius();
    for (const seg of streamSegs) {
      if (seg.intensity < 0.12) continue;
      if (distToSegSq(x, y, seg) < R2) return true;
    }
    return false;
  }

  function setPour(on) {
    autoPour = on && state === 'play';
    Sound.setPour(autoPour);
  }

  function pointerDown(id, x, y) {
    if (state === 'celebrate') {
      tapBurst(x, y);
      pointers.set(id, { role: 'none' });
      return;
    }
    if (hitCloud(x, y)) {                       // the cloud is the on/off switch
      setPour(!autoPour);
      Sound.pop();
      pointers.set(id, { role: 'none' });
      idleT = 0;
      return;
    }
    const bi = hitBowl(x, y);
    if (bi != null) {
      glasses[bi].tiltHeld = true;
      pointers.set(id, { role: 'tilt', gi: bi, startX: x });
      idleT = 0;
      return;
    }
    // open water: always arm the magic finger; if nothing is flowing here
    // yet, the same touch also starts the pour
    const wasDry = !streamsNear(x, y);
    deflectors.set(id, { x, y, vx: 0, speed: 0, sprayT: 0,
                         lastX: x, lastT: performance.now() });
    pointers.set(id, { role: 'deflect' });
    if (!wasDry) everDeflected = true;
    if (wasDry && !autoPour) setPour(true);
    idleT = 0;
  }

  function pointerMove(id, x, y) {
    const p = pointers.get(id);
    if (!p) return;
    if (p.role === 'tilt') {
      const g = glasses[p.gi];
      if (g) g.biasT = clamp((x - p.startX) / (glassW * 1.3), -1, 1);
    } else if (p.role === 'deflect') {
      const d = deflectors.get(id);
      if (!d) return;
      const now = performance.now();
      const dtms = Math.max(1, now - d.lastT);
      d.vx = d.vx * 0.6 + ((x - d.lastX) / dtms * 1000) * 0.4;
      d.speed = Math.abs(d.vx);
      d.lastX = x; d.lastT = now;
      d.x = x; d.y = y;
      if (d.speed > Math.max(700, glassW * 20)) d.sprayT = 0.22;
      everDeflected = true;
    }
  }

  function pointerUp(id) {
    const p = pointers.get(id);
    pointers.delete(id);
    if (!p) return;
    if (p.role === 'tilt') {
      const g = glasses[p.gi];
      if (g) {
        g.tiltHeld = false;
        if (Math.abs(g.bias) > 0.3) Sound.boing();
      }
    } else if (p.role === 'deflect') {
      deflectors.delete(id);
    }
  }

  function releaseAll() {
    for (const id of [...pointers.keys()]) pointerUp(id);
  }

  // ---------- loop / lifecycle ----------
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = clamp(dt, 0, 1 / 20);
    const t0 = performance.now();
    update(dt);
    render();
    notePerf(performance.now() - t0, dt);
    requestAnimationFrame(frame);
  }

  function resizeInternal() {
    dpr = Math.min(window.devicePixelRatio || 1, TIER[tier].dpr);
    W = window.innerWidth;
    H = window.innerHeight;
    safeTop = parseFloat(getComputedStyle(document.documentElement)
                .getPropertyValue('--safe-top')) || 0;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    layout();
  }

  function init(cv, opts) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    onComplete = (opts && opts.onComplete) || null;
    turbo = !!(opts && opts.turbo);
    forceRows = (opts && opts.forceRows) || 0;
    roundNum = (opts && opts.round) || 0;
    theme = THEMES[roundNum % THEMES.length];
    W = window.innerWidth; H = window.innerHeight;
    rows = computeRows();
    buildTower();
    resizeInternal();
    cloud.x = glasses[0].x;
    requestAnimationFrame(frame);
  }

  function reset(next) {
    if (next) roundNum++;
    theme = THEMES[roundNum % THEMES.length];
    rows = computeRows();
    Sound.setPour(false);
    buildTower();
    layout();
    cloud.x = glasses[0].x;
  }

  // ---------- test / demo hooks ----------
  function setPouring(on) { simPour = !!on && state === 'play'; }

  function simulate(sec) {
    const dt = 1 / 60;
    for (let k = 0, n = Math.floor(sec / dt); k < n; k++) {
      simPour = (state === 'play');
      update(dt);
    }
    simPour = false;
  }

  function bench(frames) {
    simulate(30 / Math.max(1, turbo ? 6 : 1));
    simPour = true;
    profOn = true;
    for (const k in prof) delete prof[k];
    for (let k = 0; k < 20; k++) { update(1 / 60); render(); }
    for (const k in prof) delete prof[k];
    let acc = 0, mx = 0, updAcc = 0;
    for (let k = 0; k < frames; k++) {
      const t0 = performance.now();
      update(1 / 60);
      const t1 = performance.now();
      render();
      const ms = performance.now() - t0;
      updAcc += t1 - t0;
      acc += ms; if (ms > mx) mx = ms;
    }
    simPour = false;
    profOn = false;
    const phases = {};
    for (const k in prof) phases[k] = +(prof[k] / frames).toFixed(2);
    return { avgMs: +(acc / frames).toFixed(2), maxMs: +mx.toFixed(2),
             updMs: +(updAcc / frames).toFixed(2), phases,
             rows, glasses: glasses.length, dpr: +dpr.toFixed(2), tier };
  }

  const test = {
    tilt(r, i, b) { const g = glassAt(r, i); g.tiltHeld = true; g.biasT = b; },
    untilt(r, i) { glassAt(r, i).tiltHeld = false; },
    grab(r, i, side, tr, ti) {
      const s = glassAt(r, i), t = glassAt(tr, ti);
      forcedGrabs.set(gIdx(r, i) + ':' + side, {
        d: { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2, vx: 0, speed: 0, sprayT: 0 },
        targetIdx: gIdx(tr, ti), str: 1 });
      everDeflected = true;
    },
    grabCloud(tr, ti) {
      const t = glassAt(tr, ti);
      forcedGrabs.set('cloud', {
        d: { x: (cloud.x + t.x) / 2, y: (cloud.y + t.y) / 2, vx: 0, speed: 0, sprayT: 0 },
        targetIdx: gIdx(tr, ti), str: 1 });
      everDeflected = true;
    },
    release() { forcedGrabs.clear(); for (const g of glasses) g.tiltHeld = false; },
    at(r, i) { return +glassAt(r, i).amount.toFixed(3); },
    pos(r, i) {
      const g = glassAt(r, i);
      return { x: g.x, y: g.y, w: g.w, h: g.h,
               bowlY: g.y + g.h * 0.3, stemY: g.y + g.h * 0.8 };
    },
    bias(r, i) { return +glassAt(r, i).bias.toFixed(3); },
    grabCount() { return grabs.size; },
    deflectorCount() { return deflectors.size; },
    isPouring() { return pouring; },
    cloudPos() { return { x: cloud.x, y: cloud.drawY, s: cloudS }; },
    geom() {
      return { glassW: +glassW.toFixed(1), spanX: +spanX.toFixed(1),
               rowStep: +rowStep.toFixed(1),
               rimGap: +(spanX - glassW).toFixed(1),
               stemCorridor: +(spanX - glassW * STEM_HW * 2).toFixed(1),
               rowGap: +(rowStep - glassH).toFixed(1),
               deflectR: +deflectRadius().toFixed(1) };
    },
  };

  return {
    init, reset, simulate, bench, test, setPouring,
    pointerDown, pointerMove, pointerUp, releaseAll,
    resize: resizeInternal,
    getState: () => state,
    debug: () => ({ rows, glasses: glasses.length, fullCount, state,
                    pool: +pool.toFixed(2), totalPoured: +totalPoured.toFixed(2),
                    tier, avgFrameMs: +avgFrameMs.toFixed(2),
                    unfilled: glasses.filter(g => !g.full)
                      .map(g => g.r + ',' + g.i + '=' + g.amount.toFixed(2)).slice(0, 8) }),
  };
})();
