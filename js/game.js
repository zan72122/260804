/* Rainbow Glass Tower — core simulation + Canvas 2D rendering.
   The "fluid" is a lightweight overflow graph: each glass holds 0..1,
   excess flows to its two children. The split is 50:50 with a weak bias
   toward emptier subtrees (so the tower always completes), and the player
   can override it by tilting glasses or pushing the falling streams.

   Rendering is optimized for large towers (60-140 glasses):
   - static glass art is cached into sprites (one drawImage per glass)
   - liquid is a direct polygon fill (no per-glass clip)
   - one shared liquid gradient per frame (glasses draw in local space)
   - a frame-time monitor lowers quality tiers before dropping rows */
'use strict';

window.Game = (function () {
  const TAU = Math.PI * 2;
  const CAP = 1;
  const MAXTILT = 0.42;            // ~24° visual tilt at full drag
  const MIN_GLASS_W = 30;          // touch-friendly minimum glass width
  const MAX_ROWS = 16, MIN_ROWS = 6;

  // ---------- drink themes (cycled on each replay) ----------
  const THEMES = [
    { rainbow: true, sparkle: '#fff3c9',
      sky: ['#241a52', '#5c2e91', '#c95e9e', '#ffb98a'] },
    { stops: ['#ffa9c5', '#ff6f9d', '#ff4a80', '#e63067', '#c22257'], sparkle: '#ffe1ec',
      sky: ['#2b1247', '#7a2a6b', '#d9578c', '#ffc2a8'] },
    { stops: ['#a9f4ff', '#65dff7', '#3fc4f0', '#2f9fe8', '#2a7fd8'], sparkle: '#e3fbff',
      sky: ['#0e2a52', '#1e5d8e', '#57a8c9', '#b7ecd9'] },
    { stops: ['#e0b6ff', '#c08bff', '#a260f5', '#8442e2', '#6e2cc9'], sparkle: '#f2e4ff',
      sky: ['#1d1240', '#4d2483', '#8a4bb0', '#e08bb5'] },
    { stops: ['#ffefad', '#ffd968', '#ffc247', '#ffa834', '#f28a1f'], sparkle: '#fff8dc',
      sky: ['#3a1c4f', '#8a3f66', '#d97a58', '#ffd28a'] },
  ];
  const RAINBOW = ['#ff5f6d', '#ffa14f', '#ffe95f', '#7be07b', '#5fc9ff', '#b78bff'];

  // ---------- state ----------
  let canvas, ctx, W = 0, H = 0, dpr = 1, safeTop = 0;
  let glasses = [], rows = 10, theme = THEMES[0], roundNum = 0, forceRows = 0;
  let glassW = 60, glassH = 76, spanX = 68, rowStep = 78, cloudS = 70;
  let towerCx = 0, towerTopY = 0, tableY = 0;
  let cloud = { x: 0, y: 0, drawY: 0, targetX: 0 };
  let pouring = false, simPour = false, pourVis = 0, holdT = 0, totalPoured = 0;
  let pool = 0, fullCount = 0, glowPulse = 0, topOverflowed = false, overflowAt = 0;
  let state = 'play';                    // 'play' | 'celebrate'
  let celebT = 0, celebNotified = false;
  let hintT = 0, idleT = 0, time = 0, lastTs = 0;
  let streamHintShown = false, streamHintT = -1, everGrabbed = false;
  let pointerX = null;
  let stickers = 0;
  let onComplete = null;
  let turbo = false;
  const parts = [];                      // global particle pool

  // input roles
  const pointers = new Map();            // pointerId -> {role, gi?, key?, startX?}
  const grabs = new Map();               // streamKey ('cloud' | gi+':L'/':R') -> grab
  let streamSegs = [];                   // last frame's stream geometry, for hit tests

  // performance tiers
  let tier = 0, rowPenalty = 0;
  let frameMsAcc = 0, frameMsN = 0, perfTimer = 0, avgFrameMs = 0;
  const TIER = [
    { dpr: 2.0, maxParts: 400, core: true,  glints: true  },
    { dpr: 1.6, maxParts: 280, core: false, glints: true  },
    { dpr: 1.35, maxParts: 180, core: false, glints: false },
    { dpr: 1.2, maxParts: 140, core: false, glints: false },
  ];

  // cached art
  let sprBack = null, sprFront = null, sprPad = 6;
  let radialSpr = null;                  // generic soft white glow sprite
  let streamSpr = null;                  // per-frame ribbon sprite (fast stream draw)
  let liquidSpr = null, liquidSprScl = 1;  // full-glass liquid sprite (blit per glass)
  let skyGrad = null, tableGrad = null;
  let streamGradCache = {};
  const glowQueue = [];                  // rim glows batched into one composite pass

  try { stickers = Math.min(99, parseInt(localStorage.getItem('rgt_stars') || '0', 10) || 0); } catch (e) {}

  // ---------- small utils ----------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
  const gIdx = (r, i) => r * (r + 1) / 2 + i;
  const glassAt = (r, i) => glasses[gIdx(r, i)];

  function tiltAngle(g) { return g.bias * MAXTILT; }

  // glass-local (lx, ly; origin = rim center, +y down) → world, honoring tilt
  function localToWorld(g, lx, ly) {
    const a = tiltAngle(g);
    if (a === 0) return { x: g.x + lx, y: g.y + ly };
    const c = Math.cos(a), s = Math.sin(a);
    const rx = lx, ry = ly - g.h;        // pivot = bottom center
    return { x: g.x + rx * c - ry * s, y: g.y + g.h + rx * s + ry * c };
  }
  const rimPoint = (g, sx) => localToWorld(g, sx, 0);

  function surfLocal(g) {
    const b = g.h - g.w * 0.06;
    const innerTop = g.rimRy * 1.3;
    return b - (b - innerTop) * clamp(g.disp, 0, 1.06);
  }
  const surfaceWorld = (g) => localToWorld(g, 0, surfLocal(g));

  // ---------- tower setup ----------
  function computeRows() {
    if (forceRows) return clamp(forceRows, 4, 20);
    const topArea = H * 0.15;
    const bottomArea = Math.max(H * 0.09, 42);
    const availH = H - topArea - bottomArea;
    const availW = W * 0.96;
    let best = MIN_ROWS;
    for (let r = MIN_ROWS; r <= MAX_ROWS; r++) {
      const gw = Math.min(availW / ((r - 1) * 1.13 + 1),
                          availH / (r * 1.045 * 1.24));
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
    parts.length = 0;
    grabs.clear();
    pointers.clear();
    pouring = false;
  }

  function layout() {
    const topArea = H * 0.15;
    const bottomArea = Math.max(H * 0.09, 42);
    const availH = H - topArea - bottomArea;
    const availW = W * 0.96;
    glassW = Math.min(availW / ((rows - 1) * 1.13 + 1),
                      availH / (rows * 1.045 * 1.24));
    glassW = Math.max(16, glassW);
    glassH = glassW * 1.24;
    spanX = glassW * 1.13;
    rowStep = glassH * 1.045;
    const towerH = rows * rowStep;
    towerCx = W / 2;
    towerTopY = topArea + Math.max(0, (availH - towerH) / 2);
    tableY = towerTopY + towerH + glassH * 0.05;
    for (const g of glasses) {
      g.x = towerCx + (g.i - g.r / 2) * spanX;
      g.y = towerTopY + g.r * rowStep;
      g.w = glassW; g.h = glassH;
      g.rimRy = glassW * 0.09;
    }
    cloudS = clamp(glassW * 1.6, 46, 92);
    const top = glasses[0];
    cloud.y = Math.max(cloudS * 0.72, top.y - Math.max(glassH * 0.95, cloudS * 1.05));
    if (!cloud.x) cloud.x = top.x;
    cloud.targetX = top.x;
    buildStaticArt();
  }

  // ---------- cached sprites & gradients ----------
  function glassBodyPathLocal(c, w, h) {
    const tw = w / 2, bw = w * 0.34, bry = w * 0.09;
    c.beginPath();
    c.moveTo(-tw, 0);
    c.lineTo(-bw, h - bry);
    c.quadraticCurveTo(-bw, h, -bw * 0.6, h);
    c.lineTo(bw * 0.6, h);
    c.quadraticCurveTo(bw, h, bw, h - bry);
    c.lineTo(tw, 0);
    c.closePath();
  }

  function makeSprite(draw) {
    const pad = sprPad;
    const cw = Math.ceil((glassW + pad * 2) * dpr);
    const ch = Math.ceil((glassH + pad * 2) * dpr);
    const cv = document.createElement('canvas');
    cv.width = Math.max(2, cw); cv.height = Math.max(2, ch);
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.translate(glassW / 2 + pad, pad);   // origin = rim center
    draw(c, glassW, glassH);
    return cv;
  }

  function buildStaticArt() {
    const rimRy = glassW * 0.09;
    sprBack = makeSprite((c, w, h) => {
      // back half of the rim
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(0, 0, w / 2, rimRy, 0, Math.PI, TAU); c.stroke();
      // faint cool body tint
      c.save();
      glassBodyPathLocal(c, w, h);
      c.clip();
      const bodyG = c.createLinearGradient(-w / 2, 0, w / 2, 0);
      bodyG.addColorStop(0, 'rgba(255,255,255,0.16)');
      bodyG.addColorStop(0.25, 'rgba(255,255,255,0.05)');
      bodyG.addColorStop(0.75, 'rgba(200,225,255,0.06)');
      bodyG.addColorStop(1, 'rgba(255,255,255,0.18)');
      c.fillStyle = bodyG;
      c.fillRect(-w / 2, 0, w, h);
      c.restore();
    });
    sprFront = makeSprite((c, w, h) => {
      // vertical shine streak
      c.save();
      glassBodyPathLocal(c, w, h);
      c.clip();
      const shine = c.createLinearGradient(-w * 0.36, 0, -w * 0.12, 0);
      shine.addColorStop(0, 'rgba(255,255,255,0)');
      shine.addColorStop(0.5, 'rgba(255,255,255,0.30)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = shine;
      c.fillRect(-w * 0.4, 3, w * 0.3, h - 6);
      c.restore();
      // outline + front rim
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.lineWidth = 1.4;
      glassBodyPathLocal(c, w, h);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.55)';
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

  // full liquid rendered once per frame; each glass blits the part below its
  // own surface line (the shape is a vertical trapezoid, so a horizontal cut
  // of the full sprite IS the correct liquid silhouette)
  const LQ_PAD = 2;
  function buildLiquidSprite() {
    liquidSprScl = dpr;
    const cw = Math.ceil((glassW + LQ_PAD * 2) * liquidSprScl);
    const ch = Math.ceil((glassH + LQ_PAD * 2) * liquidSprScl);
    if (!liquidSpr) liquidSpr = document.createElement('canvas');
    if (liquidSpr.width !== cw || liquidSpr.height !== ch) {
      liquidSpr.width = Math.max(2, cw); liquidSpr.height = Math.max(2, ch);
    }
    const c = liquidSpr.getContext('2d');
    c.clearRect(0, 0, liquidSpr.width, liquidSpr.height);
    c.save();
    c.scale(liquidSprScl, liquidSprScl);
    c.translate(glassW / 2 + LQ_PAD, LQ_PAD);      // origin = rim center
    const w = glassW, h = glassH;
    const bw = w * 0.34 - 0.8, bry = w * 0.09, tw = w / 2 - 0.8;
    c.fillStyle = liquidGradient(c, 0, h);
    c.beginPath();
    c.moveTo(-tw, 0);
    c.lineTo(-bw, h - bry);
    c.quadraticCurveTo(-bw, h - 1, -bw * 0.6, h - 1);
    c.lineTo(bw * 0.6, h - 1);
    c.quadraticCurveTo(bw, h - 1, bw, h - bry);
    c.lineTo(tw, 0);
    c.closePath();
    c.fill();
    c.restore();
  }

  // one small ribbon sprite per frame: vertical drink gradient + baked white
  // core; every straight stream becomes a single rotated drawImage
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
    c.fillStyle = grad;
    // rounded ribbon with soft side falloff
    c.beginPath();
    c.moveTo(4, 6); c.quadraticCurveTo(4, 0, 12, 0); c.quadraticCurveTo(20, 0, 20, 6);
    c.lineTo(20, 58); c.quadraticCurveTo(20, 64, 12, 64); c.quadraticCurveTo(4, 64, 4, 58);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillRect(9.5, 3, 5, 58);
  }

  function drawStreamSprite(c, key, x0, y0, x1, y1, w, intensity) {
    if (intensity < 0.03) return;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const wig = 0.85 + 0.15 * Math.sin(time * 22 + x0 * 0.3);
    c.save();
    c.translate(x0, y0);
    c.rotate(Math.atan2(dy, dx) - Math.PI / 2);
    c.globalAlpha = clamp(intensity, 0, 1) * 0.9;
    c.drawImage(streamSpr, -w * wig * 0.75, -2, w * wig * 1.5, len + 4);
    c.restore();
    if (key) {
      streamSegs.push({ key, x0, y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, x1, y1, intensity });
    }
    if (TIER[tier].glints && Math.random() < intensity * 0.25) {
      const t = Math.random();
      push({ type: 'drop', x: lerp(x0, x1, t) + rnd(-2, 2), y: lerp(y0, y1, t),
             vx: rnd(-10, 10), vy: rnd(20, 60), t: 0, life: 0.3, size: rnd(1, 2.2) });
    }
  }

  function streamGrad(key, y0, y1) {
    let e = streamGradCache[key];
    if (!e) {
      e = ctx.createLinearGradient(0, y0, 0, y1);
      if (theme.rainbow) {
        const base = time * 30;
        for (let k = 0; k <= 4; k++) e.addColorStop(k / 4, 'hsl(' + ((base + k * 50) % 360) + ' 90% 66%)');
      } else {
        const st = theme.stops;
        e.addColorStop(0, st[0]); e.addColorStop(1, st[st.length - 1]);
      }
      streamGradCache[key] = e;
    }
    return e;
  }

  // ---------- pacing ----------
  function paceK() {
    // target pour duration grows with tower size: ~40s for small landscape
    // towers up to ~90s for the 136-glass iPad tower
    const N = glasses.length;
    const T = clamp(N * 0.8, 40, 90);
    return (N * 1.1) / T;
  }
  function pourRate() {
    const k = paceK();
    const r = k * Math.min(1.7, 0.4 + holdT * 0.022);
    return turbo ? r * 6 : r;
  }

  // ---------- stream grabs (push-the-flow) ----------
  function grabCandidates(key) {
    if (key === 'cloud') {
      const out = [0];
      if (rows > 1) out.push(1, 2);
      return out;
    }
    const [giStr] = key.split(':');
    const g = glasses[+giStr];
    if (!g || g.r >= rows - 1) return [];
    const out = [];
    const cr = g.r + 1;
    for (let i = Math.max(0, g.i - 2); i <= Math.min(cr, g.i + 3); i++) out.push(gIdx(cr, i));
    return out;
  }

  function resolveGrabTarget(grab, key) {
    if (grab.targetIdxForce != null) return grab.targetIdxForce;
    const cands = grabCandidates(key);
    if (!cands.length) return null;
    let best = cands[0], bd = 1e12;
    for (const idx of cands) {
      const d = Math.abs(grab.x - glasses[idx].x);
      if (d < bd) { bd = d; best = idx; }
    }
    return best;
  }

  // route a portion of flow: grabbed → target (or spray), else default child / pool
  function deliver(portion, defIdx, key) {
    if (portion <= 0) return;
    const grab = key ? grabs.get(key) : null;
    if (grab) {
      const ti = grab.targetIdx;
      if (ti != null) {
        const t = glasses[ti];
        if (grab.sprayT > 0) {
          // fast swipe → spray across the target and its row neighbors
          const sibs = [];
          if (t.i > 0) sibs.push(glassAt(t.r, t.i - 1));
          if (t.i < t.r) sibs.push(glassAt(t.r, t.i + 1));
          t.amount += portion * 0.4;
          t.receive = Math.min(1, t.receive + portion * 2.5);
          for (const s of sibs) {
            s.amount += portion * (0.5 / sibs.length);
            s.receive = Math.min(1, s.receive + portion * 2);
          }
          pool = Math.min(pool + portion * 0.05, 8);
        } else {
          t.amount += portion;
          t.receive = Math.min(1, t.receive + portion * 6);
        }
        return;
      }
    }
    if (defIdx == null) {
      pool = Math.min(pool + portion, 8);
    } else {
      const d = glasses[defIdx];
      d.amount += portion;
      d.receive = Math.min(1, d.receive + portion * 6);
    }
  }

  // ---------- simulation ----------
  function update(dt) {
    time += dt;
    glowPulse = Math.max(0, glowPulse - dt * 1.4);
    pouring = state === 'play' && (simPour || hasPourPointer());

    // resolve grab targets from finger position, tick spray timers
    for (const [key, grab] of grabs) {
      grab.targetIdx = resolveGrabTarget(grab, key);
      grab.sprayT = Math.max(0, grab.sprayT - dt);
    }

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
        // springy return with a jelly wobble
        g.biasV += (-g.bias * 70 - g.biasV * 8) * dt;
        g.bias += g.biasV * dt;
        if (Math.abs(g.bias) < 0.002 && Math.abs(g.biasV) < 0.01) { g.bias = 0; g.biasV = 0; }
      }
    }

    // --- subtree "thirst", propagated undamped via max() so deep corners
    //     still steer the flow near the top of tall towers ---
    const need = new Float32Array(glasses.length);
    for (let k = glasses.length - 1; k >= 0; k--) {
      const g = glasses[k];
      // floor of 0.25: a nearly-full glass must still project a clear demand,
      // or deep towers develop an exponentially slow fill tail
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
      // strong tilt lets a full glass actively dump a little
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
          // tilt override: 0.5 bias ≈ 80:20, full bias = 100:0
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
      // any active stream stays clearly visible even when the flow is split
      // across many columns; stronger flow still reads thicker/brighter
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

      if (g.receive > 0.1 && Math.random() < g.receive * 0.4 * bubScale * 2) {
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
      for (const g of glasses) { g.amount = Math.max(g.amount, CAP); g.tiltHeld = false; }
      grabs.clear();
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
    const wantHint = state === 'play' && !pouring &&
                     (totalPoured < 0.05 ? idleT > 1.0 : idleT > 7);
    hintT += ((wantHint ? 1 : 0) - hintT) * Math.min(1, dt * 4);
    // one-time wordless "you can touch the stream" hint
    if (!streamHintShown && state === 'play' && topOverflowed && !everGrabbed &&
        time - overflowAt > 5 && pourVis > 0.3) {
      streamHintShown = true;
      streamHintT = 0;
    }
    if (streamHintT >= 0) {
      streamHintT += dt;
      if (streamHintT > 4.5 || everGrabbed) streamHintT = -1;
    }

    // --- cloud drifts toward the top glass (slight nudge from finger) ---
    let tx = glasses[0].x;
    if (pointerX != null && pouring) tx += clamp((pointerX - W / 2) * 0.12, -glassW * 0.5, glassW * 0.5);
    cloud.targetX = tx;
    cloud.x += (cloud.targetX - cloud.x) * Math.min(1, dt * 3);

    updateParticles(dt);
  }

  function hasPourPointer() {
    for (const p of pointers.values()) if (p.role === 'pour') return true;
    return false;
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
        applyTier();
      } else if (time > 3 && avgFrameMs > 14 && tier === TIER.length - 1) {
        rowPenalty = Math.min(rowPenalty + 2, 6);   // takes effect on next reset
      }
    }
  }
  function applyTier() {
    resizeInternal();   // re-apply DPR cap
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
    const n = 18;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + rnd(-0.1, 0.1);
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
    for (let k = 0; k < 5; k++) {
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

  // ---------- glass rendering (glass-local space, tilt-aware) ----------
  let sharedLiquidGrad = null;   // rebuilt once per frame, used by every glass

  function halfWidthLocal(g, ly) {
    return lerp(g.w / 2, g.w * 0.34, clamp(ly / g.h, 0, 1));
  }

  function drawGlass(c, g) {
    const ang = tiltAngle(g);
    const w = g.w, h = g.h;
    c.save();
    c.translate(g.x, g.y + h);
    if (ang !== 0) c.rotate(ang);
    c.translate(0, -h);                       // origin = rim center (local)

    const sw = w + sprPad * 2, sh = h + sprPad * 2;
    let pt = profOn ? performance.now() : 0;
    c.drawImage(sprBack, -w / 2 - sprPad, -sprPad, sw, sh);
    pt = mark('g_back', pt);

    if (g.disp > 0.015) {
      const wob = Math.sin(time * 6 + g.seed) * (0.6 + Math.min(g.receive * 5, 3)) * h * 0.008;
      const surfY = Math.max(0, surfLocal(g) + wob);
      const shw = halfWidthLocal(g, surfY) - 0.8;

      // liquid: blit the below-surface part of the shared liquid sprite
      const srcY = Math.min(liquidSpr.height - 1, (surfY + LQ_PAD) * liquidSprScl);
      const srcH = liquidSpr.height - srcY;
      c.globalAlpha = 0.92;
      c.drawImage(liquidSpr, 0, srcY, liquidSpr.width, srcH,
                  -w / 2 - LQ_PAD, surfY, w + LQ_PAD * 2, srcH / liquidSprScl);
      pt = mark('g_liq', pt);

      // soft inner glow near the bottom (cached radial sprite)
      if (tier < 2) {
        c.globalAlpha = 0.20;
        c.drawImage(radialSpr, -w * 0.55, h - w * 1.0, w * 1.1, w * 1.1);
        c.globalAlpha = 1;
      }
      pt = mark('g_glow', pt);

      // bubbles
      if (g.bubbles.length) {
        c.fillStyle = 'rgba(255,255,255,0.75)';
        for (const bb of g.bubbles) {
          const byy = lerp(h - 4, surfY + 3, bb.t);
          if (byy < surfY + 2) continue;
          const bx = bb.u * halfWidthLocal(g, byy) * 0.8 + Math.sin(bb.t * 9 + g.seed) * 2;
          c.globalAlpha = 0.35 + 0.4 * bb.t;
          c.beginPath(); c.arc(bx, byy, bb.r, 0, TAU); c.fill();
        }
        c.globalAlpha = 1;
      }

      // a twinkle inside the drink (skipped on low tiers)
      if (tier < 2) {
        const tw = (Math.sin(time * 2.7 + g.seed) + 1) / 2;
        if (tw > 0.55) {
          const px = (hash(g.seed + 13.7) - 0.5) * w * 0.55;
          const py = lerp(h - 5, surfY + 5, hash(g.seed + 31.3));
          if (py > surfY + 3) {
            c.globalAlpha = (tw - 0.55) * 1.6;
            c.fillStyle = '#ffffff';
            c.beginPath(); c.arc(px, py, 1.3, 0, TAU); c.fill();
            c.globalAlpha = 1;
          }
        }
      }

      // liquid surface — stays level in world space while the glass tilts
      c.save();
      c.translate(0, surfY);
      if (ang !== 0) c.rotate(-ang);
      c.fillStyle = 'rgba(255,255,255,0.30)';
      c.beginPath();
      c.ellipse(0, 0, shw * 0.97, g.rimRy * 0.75 + Math.abs(wob) * 0.4, 0, 0, TAU);
      c.fill();
      if (tier < 1) {
        c.strokeStyle = 'rgba(255,255,255,0.45)';
        c.lineWidth = 1;
        c.stroke();
      }
      c.restore();
      pt = mark('g_surf', pt);
    }

    c.drawImage(sprFront, -w / 2 - sprPad, -sprPad, sw, sh);
    mark('g_front', pt);
    c.restore();

    // rim accents (full glow / overflow foam) are batched into one pass
    if (g.full || g.foam > 0.05) glowQueue.push(g);
  }

  // one composite pass for every glowing/foaming rim (state changes are costly)
  function drawGlowPass(c) {
    if (!glowQueue.length) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = theme.sparkle;
    c.lineWidth = 4;
    for (const g of glowQueue) {
      if (!g.full) continue;
      const fullGlow = 0.55 + 0.45 * Math.sin(time * 5 + g.seed);
      const rc = rimPoint(g, 0);
      c.globalAlpha = 0.35 * fullGlow;
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

  // ---------- streams (overflow ribbons, grabbable) ----------
  function drawStreamRibbon(c, key, x0, y0, x1, y1, w, intensity, gradKey, ctrl) {
    if (intensity < 0.03) return;
    const midX = ctrl ? ctrl.x : (x0 + x1) / 2 + (x0 < x1 ? 1 : -1) * w * 0.4;
    const midY = ctrl ? ctrl.y : (y0 + y1) / 2;
    c.save();
    c.lineCap = 'round';
    const wig = 0.85 + 0.15 * Math.sin(time * 22 + x0 * 0.3);
    c.globalAlpha = clamp(intensity, 0, 1) * 0.9;
    c.strokeStyle = streamGrad(gradKey, Math.min(y0, y1), Math.max(y0, y1) + 1);
    c.lineWidth = w * wig;
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo(midX, midY, x1, y1);
    c.stroke();
    if (TIER[tier].core) {
      c.globalAlpha *= 0.55;
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = w * 0.32 * wig;
      c.stroke();
    }
    c.restore();
    if (key) {
      streamSegs.push({ key, x0, y0, cx: midX, cy: midY, x1, y1, intensity });
    }
    if (TIER[tier].glints && Math.random() < intensity * 0.3) {
      const t = Math.random();
      const qx = lerp(lerp(x0, midX, t), lerp(midX, x1, t), t);
      const qy = lerp(lerp(y0, midY, t), lerp(midY, y1, t), t);
      push({ type: 'drop', x: qx + rnd(-2, 2), y: qy, vx: rnd(-10, 10), vy: rnd(20, 60),
             t: 0, life: 0.3, size: rnd(1, 2.2) });
    }
  }

  // a grabbed stream bends through the finger to its new target
  function drawGrabbedStream(c, key, grab, x0, y0, w, intensity, gradKey) {
    const ti = grab.targetIdx;
    if (ti == null) return;
    const t = glasses[ti];
    const end = surfaceWorld(t);
    if (grab.sprayT > 0) {
      // spray: stream reaches the finger, then bursts
      drawStreamRibbon(c, key, x0, y0, grab.x, grab.y, w, intensity, gradKey,
                       { x: (x0 + grab.x) / 2, y: (y0 + grab.y) / 2 });
      spawnSpray(grab.x, grab.y, grab.vx >= 0 ? 1 : -1);
    } else {
      drawStreamRibbon(c, key, x0, y0, end.x, end.y - 2, w, intensity, gradKey,
                       { x: grab.x, y: grab.y });
    }
    // the finger as a transparent spoon: a lens glow where flow is held
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.55 * intensity;
    c.drawImage(radialSpr, grab.x - 18, grab.y - 18, 36, 36);
    c.globalAlpha = 0.8 * intensity;
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(grab.x, grab.y + 4, 11, Math.PI * 0.1, Math.PI * 0.9);
    c.stroke();
    c.restore();
  }

  function drawStreams(c) {
    const sw = Math.max(4.5, glassW * 0.16);
    for (let k = 0; k < glasses.length; k++) {
      const g = glasses[k];
      if (g.streamL < 0.03 && g.streamR < 0.03) continue;
      const pl = rimPoint(g, -g.w * 0.46);
      const pr = rimPoint(g, g.w * 0.46);
      const gradKey = 'r' + g.r;
      if (g.r < rows - 1) {
        const kl = k + ':L', kr = k + ':R';
        const grabL = grabs.get(kl), grabR = grabs.get(kr);
        if (grabL) {
          drawGrabbedStream(c, kl, grabL, pl.x, pl.y + 1, sw, g.streamL, gradKey);
        } else {
          const L = glassAt(g.r + 1, g.i);
          drawStreamSprite(c, kl, pl.x, pl.y + 1, L.x + L.w * 0.1, L.y + 2, sw, g.streamL);
        }
        if (grabR) {
          drawGrabbedStream(c, kr, grabR, pr.x, pr.y + 1, sw, g.streamR, gradKey);
        } else {
          const R = glassAt(g.r + 1, g.i + 1);
          drawStreamSprite(c, kr, pr.x, pr.y + 1, R.x - R.w * 0.1, R.y + 2, sw, g.streamR);
        }
      } else {
        // bottom row spills to the table pool (not grabbable)
        drawStreamSprite(c, null, pl.x, pl.y + 1, pl.x - g.w * 0.06, tableY + 3, sw * 0.9, g.streamL);
        drawStreamSprite(c, null, pr.x, pr.y + 1, pr.x + g.w * 0.06, tableY + 3, sw * 0.9, g.streamR);
      }
    }
  }

  // ---------- cloud (the pourer) ----------
  function drawCloud(c) {
    const s = cloudS;
    const x = cloud.x;
    const y = cloud.y + Math.sin(time * 1.7) * s * 0.05;
    cloud.drawY = y;

    if (pourVis > 0.03) {
      const top = glasses[0];
      const sy0 = y + s * 0.28;
      const w = Math.max(7, glassW * 0.2) * (0.7 + 0.3 * Math.min(1, pourRate() / (1.7 * paceK())));
      const grab = grabs.get('cloud');
      if (grab) {
        drawGrabbedStream(c, 'cloud', grab, x, sy0, w, pourVis, 'cloud');
      } else {
        const end = surfaceWorld(top);
        drawStreamRibbon(c, 'cloud', x, sy0, top.x, Math.min(end.y + 2, top.y + top.h - 4),
                         w, pourVis, 'cloud');
      }
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

    const archA = state === 'celebrate' ? Math.min(0.55, 0.12 + celebT * 0.2) : 0.10;
    drawRainbowArch(c, towerCx, tableY, Math.min(W, H) * 0.52, Math.max(6, glassW * 0.16), archA);
  }

  function drawRainbowArch(c, cx, cy, r0, w, alpha) {
    c.save();
    c.globalAlpha = alpha;
    c.lineCap = 'butt';
    for (let k = 0; k < RAINBOW.length; k++) {
      c.strokeStyle = RAINBOW[k];
      c.lineWidth = w;
      c.beginPath();
      c.arc(cx, cy, r0 - k * w, Math.PI, TAU);
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

  // ---------- HUD: sticker stars + hints + title ----------
  function drawStickers(c) {
    if (stickers <= 0) return;
    const n = Math.min(stickers, 8);
    const sz = 9;
    const gap = sz * 2.4;
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

  function drawHint(c) {
    if (hintT < 0.05) return;
    const hx = Math.min(W - 60, cloud.x + cloudS * 2.0);
    const hy = cloud.drawY + cloudS * 1.0;
    const pulse = (time * 1.1) % 1;
    c.save();
    for (let k = 0; k < 2; k++) {
      const t = (pulse + k * 0.5) % 1;
      c.globalAlpha = hintT * (1 - t) * 0.7;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2.5;
      c.beginPath(); c.arc(hx, hy, 14 + t * 30, 0, TAU); c.stroke();
    }
    c.globalAlpha = hintT;
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath(); c.arc(hx, hy, 13 - Math.sin(pulse * TAU) * 2.5, 0, TAU); c.fill();
    c.font = (26 - Math.sin(pulse * TAU) * 3) + 'px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('👆', hx, hy + 22 + Math.sin(pulse * TAU) * 4);
    c.restore();
  }

  // one-time wordless hint: a ghost finger slides across the top pour stream
  function drawStreamHint(c) {
    if (streamHintT < 0) return;
    const top = glasses[0];
    const a = Math.min(1, streamHintT * 2) * Math.min(1, (4.5 - streamHintT));
    const sway = Math.sin(streamHintT * 2.2) * glassW * 1.1;
    const hx = top.x + sway;
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
    streamGradCache = {};
    streamSegs = [];
    sharedLiquidGrad = liquidGradient(c, 0, glassH);   // for the pool & accents
    buildStreamSprite();
    buildLiquidSprite();

    let t = profOn ? performance.now() : 0;
    drawBackground(c);
    drawTable(c);
    drawPool(c);
    t = mark('bg', t);
    for (const g of glasses) drawGlass(c, g);
    t = mark('glasses', t);
    drawStreams(c);
    t = mark('streams', t);
    drawGlowPass(c);
    t = mark('glow', t);
    drawCloud(c);
    drawParticles(c);
    t = mark('parts', t);
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

  // ---------- input (roles decided by what the finger lands on) ----------
  function distToSegSq(px, py, seg) {
    // sample the quadratic at a few points
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

  function hitStream(x, y) {
    const rad = Math.max(22, glassW * 0.55);
    let bestKey = null, bd = rad * rad;
    for (const seg of streamSegs) {
      if (seg.intensity < 0.15 || grabs.has(seg.key)) continue;
      const d = distToSegSq(x, y, seg);
      if (d < bd) { bd = d; bestKey = seg.key; }
    }
    return bestKey;
  }

  function hitGlass(x, y, strict) {
    let best = null, bd = 1e12;
    const rx = strict ? glassW * 0.42 : Math.max(glassW * 0.62, 22);
    for (let k = 0; k < glasses.length; k++) {
      const g = glasses[k];
      if (strict) {
        if (y < g.y + g.rimRy || y > g.y + g.h) continue;
      } else {
        if (y < g.y - g.rimRy * 2.5 || y > g.y + g.h + 8) continue;
      }
      const dx = Math.abs(x - g.x);
      if (dx > rx) continue;
      if (dx < bd) { bd = dx; best = k; }
    }
    return best;
  }

  function pointerDown(id, x, y) {
    if (state === 'celebrate') {
      tapBurst(x, y);
      pointers.set(id, { role: 'none' });
      return;
    }
    // a touch well inside a glass body always tilts that glass; streams win
    // only in the open space between glasses
    const strictGi = hitGlass(x, y, true);
    if (strictGi != null) {
      glasses[strictGi].tiltHeld = true;
      pointers.set(id, { role: 'tilt', gi: strictGi, startX: x });
      idleT = 0;
      return;
    }
    const sk = hitStream(x, y);
    if (sk) {
      grabs.set(sk, { x, y, vx: 0, speed: 0, sprayT: 0, lastX: x, lastT: performance.now(), targetIdx: null });
      pointers.set(id, { role: 'stream', key: sk });
      everGrabbed = true;
      idleT = 0;
      return;
    }
    const gi = hitGlass(x, y, false);
    if (gi != null) {
      const g = glasses[gi];
      g.tiltHeld = true;
      pointers.set(id, { role: 'tilt', gi, startX: x });
      idleT = 0;
      return;
    }
    pointers.set(id, { role: 'pour' });
    pointerX = x;
    Sound.setPour(true);
  }

  function pointerMove(id, x, y) {
    const p = pointers.get(id);
    if (!p) return;
    if (p.role === 'pour') {
      pointerX = x;
    } else if (p.role === 'tilt') {
      const g = glasses[p.gi];
      if (g) g.biasT = clamp((x - p.startX) / (glassW * 1.3), -1, 1);
    } else if (p.role === 'stream') {
      const grab = grabs.get(p.key);
      if (!grab) return;
      const now = performance.now();
      const dtms = Math.max(1, now - grab.lastT);
      const vx = (x - grab.lastX) / dtms * 1000;
      grab.vx = grab.vx * 0.6 + vx * 0.4;
      grab.speed = Math.abs(grab.vx);
      grab.lastX = x; grab.lastT = now;
      grab.x = x; grab.y = y;
      // fast swipe → spray for a moment
      if (grab.speed > Math.max(700, glassW * 20)) grab.sprayT = 0.22;
    }
  }

  function releaseAll() {
    for (const id of [...pointers.keys()]) pointerUp(id);
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
    } else if (p.role === 'stream') {
      grabs.delete(p.key);
    }
    if (!hasPourPointer()) Sound.setPour(false);
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
    // needs W/H before computing rows
    W = window.innerWidth; H = window.innerHeight;
    rows = computeRows();
    buildTower();
    resizeInternal();
    cloud.x = glasses[0].x;
    requestAnimationFrame(frame);
  }

  // kept for demo/auto mode and tests
  function setPouring(on, px) {
    if (px != null) pointerX = px;
    simPour = !!on && state === 'play';
  }

  function reset(next) {
    if (next) roundNum++;
    theme = THEMES[roundNum % THEMES.length];
    rows = computeRows();
    simPour = false;
    Sound.setPour(false);
    buildTower();
    layout();
    cloud.x = glasses[0].x;
  }

  // Deterministic fast-forward used by headless tests (?sim=N).
  function simulate(sec) {
    const dt = 1 / 60;
    const steps = Math.floor(sec / dt);
    for (let k = 0; k < steps; k++) {
      simPour = (state === 'play');
      update(dt);
    }
    simPour = false;
  }

  // Synchronous CPU benchmark (?bench): worst-case load, returns avg/max ms.
  function bench(frames) {
    simulate(30 / Math.max(1, turbo ? 6 : 1));   // get the cascade fully active
    simPour = true;
    profOn = true;
    for (const k in prof) delete prof[k];
    for (let k = 0; k < 20; k++) { update(1 / 60); render(); }   // warm-up
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

  // scripted-input hooks for headless verification (?script=...)
  const test = {
    tilt(r, i, b) { const g = glassAt(r, i); g.tiltHeld = true; g.biasT = b; },
    untilt(r, i) { glassAt(r, i).tiltHeld = false; },
    grab(r, i, side, tr, ti, x, y) {
      const s = glassAt(r, i), t = glassAt(tr, ti);
      grabs.set(gIdx(r, i) + ':' + side,
        { x: x != null ? x : (s.x + t.x) / 2, y: y != null ? y : (s.y + t.y) / 2,
          vx: 0, speed: 0, sprayT: 0, lastX: 0, lastT: 0,
          targetIdx: null, targetIdxForce: gIdx(tr, ti) });
      everGrabbed = true;
    },
    grabCloud(tr, ti, x, y) {
      const t = glassAt(tr, ti);
      grabs.set('cloud',
        { x: x != null ? x : (cloud.x + t.x) / 2, y: y != null ? y : (cloud.y + t.y) / 2,
          vx: 0, speed: 0, sprayT: 0, lastX: 0, lastT: 0,
          targetIdx: null, targetIdxForce: gIdx(tr, ti) });
      everGrabbed = true;
    },
    release() { grabs.clear(); for (const g of glasses) g.tiltHeld = false; },
    at(r, i) { return +glassAt(r, i).amount.toFixed(3); },
    pos(r, i) { const g = glassAt(r, i); return { x: g.x, y: g.y, w: g.w, h: g.h }; },
    bias(r, i) { return +glassAt(r, i).bias.toFixed(3); },
    grabCount() { return grabs.size; },
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
