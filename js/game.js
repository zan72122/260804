/* Rainbow Glass Tower — core simulation + Canvas 2D rendering.
   The "fluid" is a lightweight overflow graph: each glass holds 0..1,
   excess flows to its two children, weighted toward the emptier subtree
   so the cascade always reaches every glass (kind physics for a 4-year-old). */
'use strict';

window.Game = (function () {
  const TAU = Math.PI * 2;
  const CAP = 1;

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
  const ROW_CYCLE = [5, 4, 6];           // tower layouts, cycled with theme
  const RAINBOW = ['#ff5f6d', '#ffa14f', '#ffe95f', '#7be07b', '#5fc9ff', '#b78bff'];

  // ---------- state ----------
  let canvas, ctx, W = 0, H = 0, dpr = 1;
  let glasses = [], rows = 5, theme = THEMES[0], roundNum = 0;
  let glassW = 60, glassH = 76, spanX = 68, rowStep = 78;
  let towerCx = 0, towerTopY = 0, tableY = 0;
  let cloud = { x: 0, y: 0, drawY: 0, targetX: 0 };
  let pouring = false, pourVis = 0, holdT = 0, totalPoured = 0;
  let pool = 0, fullCount = 0, glowPulse = 0, topOverflowed = false;
  let state = 'play';                    // 'play' | 'celebrate'
  let celebT = 0, celebNotified = false;
  let hintT = 0, idleT = 0, time = 0, lastTs = 0;
  let pointerX = null;
  let safeTop = 0;
  let stickers = 0;
  let onComplete = null;
  let turbo = false;
  const parts = [];                      // global particle pool

  try { stickers = Math.min(99, parseInt(localStorage.getItem('rgt_stars') || '0', 10) || 0); } catch (e) {}

  // ---------- small utils ----------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
  const gIdx = (r, i) => r * (r + 1) / 2 + i;
  const glassAt = (r, i) => glasses[gIdx(r, i)];

  // ---------- tower setup ----------
  function buildTower() {
    glasses = [];
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i <= r; i++) {
        glasses.push({
          r, i, x: 0, y: 0,
          amount: 0, disp: 0, full: false,
          receive: 0, streamL: 0, streamR: 0, foam: 0,
          seed: hash(r * 31 + i * 7) * 100,
          bubbles: [],
        });
      }
    }
    pool = 0; fullCount = 0; topOverflowed = false;
    holdT = 0; totalPoured = 0; pourVis = 0;
    state = 'play'; celebT = 0; celebNotified = false;
    hintT = 0; idleT = 0;
    parts.length = 0;
  }

  function layout() {
    const topArea = H * 0.17;            // room for the cloud
    const bottomArea = Math.max(H * 0.1, 46);
    const availH = H - topArea - bottomArea;
    const availW = W * 0.95;
    const sxF = 1.13, stepF = 1.045, ratio = 1.24;
    glassW = Math.min(
      availW / ((rows - 1) * sxF + 1),
      availH / (rows * stepF * ratio)
    );
    glassW = Math.max(26, glassW);
    glassH = glassW * ratio;
    spanX = glassW * sxF;
    rowStep = glassH * stepF;
    const towerH = rows * rowStep;
    towerCx = W / 2;
    towerTopY = topArea + (availH - towerH) / 2;
    tableY = towerTopY + towerH + glassH * 0.06;
    for (const g of glasses) {
      g.x = towerCx + (g.i - g.r / 2) * spanX;
      g.y = towerTopY + g.r * rowStep;
      g.w = glassW; g.h = glassH;
      g.rimRy = glassW * 0.09;
    }
    const top = glasses[0];
    cloud.y = Math.max(glassW * 0.85, top.y - glassH * 0.95);
    if (!cloud.x) cloud.x = top.x;
    cloud.targetX = top.x;
  }

  // ---------- simulation ----------
  function pourRate() {
    // gently escalates the longer the child holds — the cascade grows;
    // bigger towers pour faster so every layout finishes in a similar time
    const scale = Math.max(1, glasses.length / 15);
    const r = Math.min(1.75, 0.55 + holdT * 0.22) * scale;
    return turbo ? r * 6 : r;
  }

  function update(dt) {
    time += dt;
    glowPulse = Math.max(0, glowPulse - dt * 1.4);

    // --- pouring into the top glass ---
    const top = glasses[0];
    if (state === 'play' && pouring) {
      holdT += dt;
      idleT = 0;
      const add = pourRate() * dt;
      top.amount += add;
      totalPoured += add;
      top.receive = Math.min(1, top.receive + add * 5);
      pourVis += (1 - pourVis) * Math.min(1, dt * 8);
      if (Math.random() < 0.5) spawnSplash(top.x + rnd(-4, 4), surfaceY(top), 1);
    } else {
      holdT = Math.max(0, holdT - dt * 1.2);
      idleT += dt;
      pourVis += (0 - pourVis) * Math.min(1, dt * 5);
    }

    // --- how "thirsty" is each subtree? (computed bottom-up) ---
    const need = new Float32Array(glasses.length);
    for (let k = glasses.length - 1; k >= 0; k--) {
      const g = glasses[k];
      let n = Math.max(0, CAP - g.amount);
      if (g.r < rows - 1) n += (need[gIdx(g.r + 1, g.i)] + need[gIdx(g.r + 1, g.i + 1)]) * 0.55;
      need[k] = n;
    }

    // --- overflow transfer, top row downward ---
    for (let k = 0; k < glasses.length; k++) {
      const g = glasses[k];
      let flowL = 0, flowR = 0;
      if (g.amount > CAP) {
        const excess = g.amount - CAP;
        const out = Math.min(excess, dt * (1.5 + excess * 3.5) * (turbo ? 6 : 1));
        g.amount -= out;
        if (g.r === 0 && !topOverflowed && out > 0) {
          topOverflowed = true;
          glowPulse = 1;
          Sound.sparkle();
          spawnRing(g.x, g.y, g.w * 1.4, theme.sparkle);
        }
        if (g.r < rows - 1) {
          const L = glassAt(g.r + 1, g.i);
          const R = glassAt(g.r + 1, g.i + 1);
          const wl = need[gIdx(g.r + 1, g.i)] + 0.07;
          const wr = need[gIdx(g.r + 1, g.i + 1)] + 0.07;
          const s = wl / (wl + wr);
          L.amount += out * s;
          R.amount += out * (1 - s);
          L.receive = Math.min(1, L.receive + out * s * 6);
          R.receive = Math.min(1, R.receive + out * (1 - s) * 6);
          flowL = (out * s) / Math.max(dt, 1e-4);
          flowR = (out * (1 - s)) / Math.max(dt, 1e-4);
        } else {
          pool = Math.min(pool + out, 8);
          flowL = flowR = (out * 0.5) / Math.max(dt, 1e-4);
        }
        if (g.amount > 1.5) g.amount = 1.5;
      }
      // smooth per-side stream intensity for drawing
      const sm = Math.min(1, dt * 7);
      g.streamL += (clamp(flowL * 1.5, 0, 1) - g.streamL) * sm;
      g.streamR += (clamp(flowR * 1.5, 0, 1) - g.streamR) * sm;
      g.foam += ((g.streamL + g.streamR > 0.06 ? 1 : 0) - g.foam) * sm;
    }

    // --- per-glass bookkeeping / events / bubbles ---
    for (const g of glasses) {
      g.disp += (Math.min(g.amount, 1.03) - g.disp) * Math.min(1, dt * 7);
      g.receive = Math.max(0, g.receive - g.receive * dt * 4);

      if (!g.full && g.amount >= CAP * 0.999) {
        g.full = true;
        fullCount++;
        Sound.chime(fullCount - 1);
        spawnRing(g.x, g.y, g.w, theme.sparkle);
        spawnStars(g.x, g.y, 5, g.w);
        // whole row just completed → shimmer wave across it
        let rowFull = true;
        for (let i = 0; i <= g.r; i++) if (!glassAt(g.r, i).full) rowFull = false;
        if (rowFull && g.r > 0) {
          glowPulse = Math.max(glowPulse, 0.8);
          for (let i = 0; i <= g.r; i++) {
            const gg = glassAt(g.r, i);
            spawnStars(gg.x, gg.y, 3, gg.w);
          }
        }
      }

      // splash sparkles where liquid lands
      if (g.receive > 0.1 && Math.random() < g.receive * 0.5) {
        spawnSplash(g.x + rnd(-g.w * 0.2, g.w * 0.2), surfaceY(g), g.receive);
      }
      // rising bubbles inside the drink
      if (g.disp > 0.12) {
        if (g.bubbles.length < 4 && Math.random() < dt * (1.2 + g.receive * 4)) {
          g.bubbles.push({ u: rnd(-0.6, 0.6), t: 0, spd: rnd(0.25, 0.55), r: rnd(1.2, 2.6) });
        }
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

    // --- hint (no reading required: pulsing finger near the cloud) ---
    const wantHint = state === 'play' && !pouring &&
                     (totalPoured < 0.05 ? idleT > 1.0 : idleT > 7);
    hintT += ((wantHint ? 1 : 0) - hintT) * Math.min(1, dt * 4);

    // --- cloud drifts toward the top glass (slight nudge from finger) ---
    let tx = glasses[0].x;
    if (pointerX != null && pouring) tx += clamp((pointerX - W / 2) * 0.12, -glassW * 0.5, glassW * 0.5);
    cloud.targetX = tx;
    cloud.x += (cloud.targetX - cloud.x) * Math.min(1, dt * 3);

    updateParticles(dt);
  }

  // ---------- particles ----------
  function push(p) { if (parts.length > 400) parts.shift(); parts.push(p); }

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
             t: 0, life: rnd(0.7, 1.3), size: rnd(2, 4),
             hue: hue + rnd(-25, 25) });
    }
    Sound.pop();
  }
  function tapBurst(x, y) {
    spawnRing(x, y, 36, '#ffffff');
    spawnStars(x, y, 6, 30);
    Sound.pop();
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
      const a = 1 - p.t / p.life;
      switch (p.type) {
        case 'confetti': {
          c.save();
          c.translate(p.x, p.y);
          c.rotate(p.rot);
          c.globalAlpha = Math.min(1, a * 2);
          c.fillStyle = 'hsl(' + p.hue + ' 90% 65%)';
          c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          c.restore();
          break;
        }
      }
    }
    // glowy pass
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
          drawStar(c, p.x, p.y, p.size, p.rot, 'hsl(' + p.hue + ' 95% 78%)');
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

  function drawStar(c, x, y, r, rot, fill) {
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
  function surfaceY(g) {
    const bottom = g.y + g.h - g.w * 0.06;
    const innerTop = g.y + g.rimRy * 1.3;
    return bottom - (bottom - innerTop) * clamp(g.disp, 0, 1.06);
  }
  function halfWidthAt(g, yy) {
    const t = clamp((yy - g.y) / g.h, 0, 1);
    return lerp(g.w / 2, g.w * 0.34, t);
  }

  function glassBodyPath(c, g) {
    const tw = g.w / 2, bw = g.w * 0.34;
    const x = g.x, y = g.y, b = y + g.h;
    const bry = g.w * 0.09;
    c.beginPath();
    c.moveTo(x - tw, y);
    c.lineTo(x - bw, b - bry);
    c.quadraticCurveTo(x - bw, b, x - bw * 0.6, b);
    c.lineTo(x + bw * 0.6, b);
    c.quadraticCurveTo(x + bw, b, x + bw, b - bry);
    c.lineTo(x + tw, y);
    c.closePath();
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

  function drawGlass(c, g) {
    const x = g.x, y = g.y;
    const bottom = y + g.h;
    const wob = Math.sin(time * 6 + g.seed) * (0.6 + Math.min(g.receive * 5, 3)) * g.h * 0.008;

    // back of rim (behind liquid)
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.ellipse(x, y, g.w / 2, g.rimRy, 0, Math.PI, TAU);
    c.stroke();

    // glass body — faint cool tint so empty glasses read on any sky
    c.save();
    glassBodyPath(c, g);
    c.clip();
    const bodyG = c.createLinearGradient(x - g.w / 2, 0, x + g.w / 2, 0);
    bodyG.addColorStop(0, 'rgba(255,255,255,0.16)');
    bodyG.addColorStop(0.25, 'rgba(255,255,255,0.05)');
    bodyG.addColorStop(0.75, 'rgba(200,225,255,0.06)');
    bodyG.addColorStop(1, 'rgba(255,255,255,0.18)');
    c.fillStyle = bodyG;
    c.fillRect(x - g.w / 2, y, g.w, g.h);

    // liquid
    if (g.disp > 0.015) {
      const sy = surfaceY(g) + wob;
      c.globalAlpha = 0.92;
      c.fillStyle = liquidGradient(c, sy, bottom);
      c.fillRect(x - g.w / 2, sy, g.w, bottom - sy + 2);

      // soft inner glow near the bottom
      const glow = c.createRadialGradient(x, bottom - g.h * 0.2, 1, x, bottom - g.h * 0.2, g.w * 0.6);
      glow.addColorStop(0, 'rgba(255,255,255,0.22)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = glow;
      c.fillRect(x - g.w / 2, sy, g.w, bottom - sy + 2);
      c.globalAlpha = 1;

      // bubbles
      c.fillStyle = 'rgba(255,255,255,0.75)';
      for (const bb of g.bubbles) {
        const byy = lerp(bottom - 4, sy + 3, bb.t);
        if (byy < sy + 2) continue;
        const bx = x + bb.u * halfWidthAt(g, byy) * 0.8 + Math.sin(bb.t * 9 + g.seed) * 2;
        c.globalAlpha = 0.35 + 0.4 * bb.t;
        c.beginPath(); c.arc(bx, byy, bb.r, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;

      // tiny twinkles inside the drink
      for (let k = 0; k < 3; k++) {
        const tw = (Math.sin(time * (2.2 + k) + g.seed * (k + 1)) + 1) / 2;
        if (tw < 0.55) continue;
        const px = x + (hash(g.seed + k * 13.7) - 0.5) * g.w * 0.55;
        const py = lerp(bottom - 5, sy + 5, hash(g.seed + k * 31.3));
        if (py < sy + 3) continue;
        c.globalAlpha = (tw - 0.55) * 1.6;
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(px, py, 1.3, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;

      // liquid surface
      const shw = halfWidthAt(g, sy) * 0.96;
      const sg = c.createLinearGradient(x - shw, 0, x + shw, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0.55)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0.25)');
      sg.addColorStop(1, 'rgba(255,255,255,0.55)');
      c.fillStyle = sg;
      c.beginPath();
      c.ellipse(x, sy, shw, g.rimRy * 0.75 + Math.abs(wob) * 0.4, 0, 0, TAU);
      c.fill();
    }

    // vertical shine streaks
    const shine = c.createLinearGradient(x - g.w * 0.36, 0, x - g.w * 0.12, 0);
    shine.addColorStop(0, 'rgba(255,255,255,0)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0.30)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = shine;
    c.fillRect(x - g.w * 0.4, y + 3, g.w * 0.3, g.h - 6);
    c.restore();

    // outline
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 1.4;
    glassBodyPath(c, g);
    c.stroke();

    // front rim + overflow foam / full glow
    const fullGlow = g.full ? (0.55 + 0.45 * Math.sin(time * 5 + g.seed)) : 0;
    if (fullGlow > 0) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = theme.sparkle;
      c.globalAlpha = 0.35 * fullGlow;
      c.lineWidth = 4;
      c.beginPath(); c.ellipse(x, y, g.w / 2, g.rimRy, 0, 0, TAU); c.stroke();
      c.restore();
    }
    c.strokeStyle = 'rgba(255,255,255,' + (0.55 + fullGlow * 0.4) + ')';
    c.lineWidth = 1.8;
    c.beginPath();
    c.ellipse(x, y, g.w / 2, g.rimRy, 0, 0, Math.PI);
    c.stroke();

    if (g.foam > 0.05) {
      // shimmering foam ring while overflowing
      c.save();
      c.globalAlpha = g.foam * (0.5 + 0.3 * Math.sin(time * 14 + g.seed));
      c.strokeStyle = '#ffffff';
      c.lineWidth = 3;
      c.beginPath(); c.ellipse(x, y, g.w / 2, g.rimRy, 0, 0, TAU); c.stroke();
      c.restore();
    }
  }

  // ---------- streams (overflow ribbons) ----------
  function drawStreamRibbon(c, x0, y0, x1, y1, w, intensity) {
    if (intensity < 0.03) return;
    const midX = (x0 + x1) / 2 + (x0 < x1 ? 1 : -1) * w * 0.4;
    const midY = (y0 + y1) / 2;
    const grad = c.createLinearGradient(x0, y0, x0, y1);
    if (theme.rainbow) {
      const base = time * 30;
      for (let k = 0; k <= 4; k++) grad.addColorStop(k / 4, 'hsl(' + ((base + k * 50) % 360) + ' 90% 66%)');
    } else {
      const st = theme.stops;
      grad.addColorStop(0, st[0]); grad.addColorStop(1, st[st.length - 1]);
    }
    c.save();
    c.lineCap = 'round';
    const wig = 0.85 + 0.15 * Math.sin(time * 22 + x0 * 0.3);
    c.globalAlpha = clamp(intensity, 0, 1) * 0.9;
    c.strokeStyle = grad;
    c.lineWidth = w * wig;
    c.beginPath();
    c.moveTo(x0, y0);
    c.quadraticCurveTo(midX, midY, x1, y1);
    c.stroke();
    // bright core
    c.globalAlpha *= 0.55;
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = w * 0.32 * wig;
    c.stroke();
    c.restore();
    // falling glints along the stream
    if (Math.random() < intensity * 0.35) {
      const t = Math.random();
      const qx = lerp(lerp(x0, midX, t), lerp(midX, x1, t), t);
      const qy = lerp(lerp(y0, midY, t), lerp(midY, y1, t), t);
      push({ type: 'drop', x: qx + rnd(-2, 2), y: qy, vx: rnd(-10, 10), vy: rnd(20, 60),
             t: 0, life: 0.3, size: rnd(1, 2.2) });
    }
  }

  function drawStreams(c) {
    const sw = glassW * 0.16;
    for (const g of glasses) {
      if (g.streamL < 0.03 && g.streamR < 0.03) continue;
      const lx = g.x - g.w * 0.46, rx = g.x + g.w * 0.46;
      if (g.r < rows - 1) {
        const L = glassAt(g.r + 1, g.i);
        const R = glassAt(g.r + 1, g.i + 1);
        drawStreamRibbon(c, lx, g.y + 1, L.x + L.w * 0.1, L.y + 2, sw, g.streamL);
        drawStreamRibbon(c, rx, g.y + 1, R.x - R.w * 0.1, R.y + 2, sw, g.streamR);
      } else {
        drawStreamRibbon(c, lx, g.y + 1, lx - g.w * 0.06, tableY + 3, sw * 0.9, g.streamL);
        drawStreamRibbon(c, rx, g.y + 1, rx + g.w * 0.06, tableY + 3, sw * 0.9, g.streamR);
      }
    }
  }

  // ---------- cloud (the pourer) ----------
  function drawCloud(c) {
    const s = glassW * 1.35;
    const x = cloud.x;
    const y = cloud.y + Math.sin(time * 1.7) * s * 0.05;
    cloud.drawY = y;

    // pour stream from cloud → top glass (drawn first, behind the cloud puffs)
    if (pourVis > 0.03) {
      const top = glasses[0];
      const sy0 = y + s * 0.28;
      const sy1 = Math.min(surfaceY(top) + 2, top.y + top.h - 4);
      const w = glassW * 0.16 * (0.7 + 0.3 * (pourRate() / 1.75));
      drawStreamRibbon(c, x, sy0, top.x, sy1, w, pourVis);
    }

    c.save();
    // puffs
    const puffs = [
      [0, 0, 0.42], [-0.42, 0.08, 0.3], [0.42, 0.08, 0.3],
      [-0.2, -0.18, 0.3], [0.22, -0.16, 0.32],
    ];
    c.fillStyle = '#ffffff';
    for (const [px, py, pr] of puffs) {
      c.beginPath();
      c.arc(x + px * s, y + py * s, pr * s, 0, TAU);
      c.fill();
    }
    // soft under-shading
    const sh = c.createLinearGradient(0, y - s * 0.3, 0, y + s * 0.4);
    sh.addColorStop(0, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(150,160,220,0.35)');
    c.fillStyle = sh;
    for (const [px, py, pr] of puffs) {
      c.beginPath();
      c.arc(x + px * s, y + py * s, pr * s, 0, TAU);
      c.fill();
    }

    // face
    const happy = pouring || state === 'celebrate';
    c.strokeStyle = '#6b5a8e';
    c.fillStyle = '#6b5a8e';
    c.lineWidth = Math.max(1.6, s * 0.045);
    c.lineCap = 'round';
    const ey = y - s * 0.02, ex = s * 0.16;
    if (happy) {
      // closed happy eyes ^ ^
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
    // smile
    c.beginPath();
    c.arc(x, y + s * 0.08, s * 0.09, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
    // blush
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
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, theme.sky[0]);
    sky.addColorStop(0.45, theme.sky[1]);
    sky.addColorStop(0.8, theme.sky[2]);
    sky.addColorStop(1, theme.sky[3]);
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    // twinkling stars
    c.save();
    for (let k = 0; k < 34; k++) {
      const sx = hash(k * 3.7) * W;
      const sy = hash(k * 9.1) * H * 0.55;
      const tw = (Math.sin(time * (1 + hash(k) * 2) + k) + 1) / 2;
      c.globalAlpha = 0.15 + tw * 0.5;
      c.fillStyle = '#ffffff';
      const r = 0.8 + hash(k * 5.3) * 1.4;
      c.beginPath(); c.arc(sx, sy, r, 0, TAU); c.fill();
    }
    // drifting bokeh lights
    for (let k = 0; k < 7; k++) {
      const bx = (hash(k * 13.1) * W + time * (4 + k * 2)) % (W + 160) - 80;
      const by = hash(k * 7.7) * H * 0.8;
      const br = 26 + hash(k * 3.3) * 44;
      const bg = c.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, 'rgba(255,255,255,0.10)');
      bg.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalAlpha = 1;
      c.fillStyle = bg;
      c.beginPath(); c.arc(bx, by, br, 0, TAU); c.fill();
    }
    c.restore();

    // faint rainbow arch behind the tower (blooms during the celebration)
    const archA = state === 'celebrate' ? Math.min(0.55, 0.12 + celebT * 0.2) : 0.10;
    drawRainbowArch(c, towerCx, tableY, Math.min(W, H) * 0.52, glassW * 0.16, archA);
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
    // table surface
    const tg = c.createLinearGradient(0, tableY, 0, H);
    tg.addColorStop(0, 'rgba(70,40,120,0.85)');
    tg.addColorStop(0.15, 'rgba(48,26,90,0.9)');
    tg.addColorStop(1, 'rgba(26,12,56,0.95)');
    c.fillStyle = tg;
    c.fillRect(0, tableY, W, H - tableY);
    // top edge highlight
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.fillRect(0, tableY, W, 2);
    // soft shadow under the tower
    const shW = (rows - 1) * spanX + glassW;
    const sh = c.createRadialGradient(towerCx, tableY + 8, 1, towerCx, tableY + 8, shW * 0.65);
    sh.addColorStop(0, 'rgba(10,4,30,0.35)');
    sh.addColorStop(1, 'rgba(10,4,30,0)');
    c.fillStyle = sh;
    c.save();
    c.translate(towerCx, tableY + 8);
    c.scale(1, 0.18);
    c.translate(-towerCx, -(tableY + 8));
    c.beginPath(); c.arc(towerCx, tableY + 8, shW * 0.65, 0, TAU); c.fill();
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
    c.ellipse(towerCx, py, pw, glassW * 0.16, 0, 0, TAU);
    c.fill();
    c.globalAlpha *= 0.7;
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();
  }

  // ---------- HUD: sticker stars + touch hint ----------
  function drawStickers(c) {
    if (stickers <= 0) return;
    const n = Math.min(stickers, 8);
    const sz = 9;
    const gap = sz * 2.4;
    // collected stars sit on the table, under the tower
    const y0 = Math.min(tableY + (H - tableY) * 0.55, H - 18);
    const x0 = W / 2 - ((n - 1) * gap + (stickers > 8 ? 34 : 0)) / 2;
    c.save();
    for (let k = 0; k < n; k++) {
      const bounce = Math.sin(time * 2.4 + k * 0.9) * 1.5;
      drawStar(c, x0 + k * gap, y0 + bounce, sz, 0, '#ffd94f');
      drawStar(c, x0 + k * gap, y0 + bounce, sz * 0.45, 0, '#fff3b8');
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
    const hx = Math.min(W - 60, cloud.x + glassW * 2.1);
    const hy = cloud.drawY + glassW * 1.1;
    const pulse = (time * 1.1) % 1;
    c.save();
    c.globalAlpha = hintT;
    // ripple rings
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
    // finger emoji on the pulsing dot
    c.font = (26 - Math.sin(pulse * TAU) * 3) + 'px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('👆', hx, hy + 22 + Math.sin(pulse * TAU) * 4);
    c.restore();
  }

  function drawTitle(c) {
    const ty = safeTop + Math.max(12, H * 0.018);
    // skip when the cloud floats high enough to collide (landscape phones)
    if (cloud.y - glassW * 1.0 < ty + 26) return;
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.font = '700 ' + Math.max(13, Math.min(19, W * 0.032)) + 'px -apple-system, "Hiragino Maru Gothic ProN", sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.shadowColor = 'rgba(255,160,220,0.8)';
    c.shadowBlur = 8;
    c.fillText('✦ にじいろ グラスタワー ✦', W / 2, safeTop + Math.max(12, H * 0.018));
    c.restore();
  }

  // ---------- master render ----------
  function render() {
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(c);
    drawTable(c);
    drawPool(c);
    for (const g of glasses) drawGlass(c, g);
    drawStreams(c);
    drawCloud(c);
    drawParticles(c);
    drawTitle(c);
    drawStickers(c);
    drawHint(c);

    // full-screen soft glow pulse on big moments
    if (glowPulse > 0.01) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const gp = c.createRadialGradient(towerCx, H * 0.4, 10, towerCx, H * 0.4, Math.max(W, H) * 0.7);
      gp.addColorStop(0, 'rgba(255,240,255,' + (glowPulse * 0.18) + ')');
      gp.addColorStop(1, 'rgba(255,240,255,0)');
      c.fillStyle = gp;
      c.fillRect(0, 0, W, H);
      c.restore();
    }
  }

  // ---------- loop / lifecycle ----------
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = clamp(dt, 0, 1 / 20);
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    roundNum = (opts && opts.round) || 0;
    theme = THEMES[roundNum % THEMES.length];
    rows = ROW_CYCLE[roundNum % ROW_CYCLE.length];
    buildTower();
    resize();
    cloud.x = glasses[0].x;
    requestAnimationFrame(frame);
  }

  function setPouring(on, px) {
    if (px != null) pointerX = px;
    if (state !== 'play') { pouring = false; Sound.setPour(false); return; }
    if (on === pouring) return;
    pouring = on;
    Sound.setPour(on);
  }

  function pointerMove(px) { pointerX = px; }

  function tapAt(x, y) {
    if (state === 'celebrate') tapBurst(x, y);
  }

  // next=true → next theme & layout (replay); false → same round again
  function reset(next) {
    if (next) roundNum++;
    theme = THEMES[roundNum % THEMES.length];
    rows = ROW_CYCLE[roundNum % ROW_CYCLE.length];
    pouring = false;
    Sound.setPour(false);
    buildTower();
    layout();
    cloud.x = glasses[0].x;
  }

  // Deterministic fast-forward used by headless tests (?sim=N):
  // steps the model synchronously with pouring held down.
  function simulate(sec) {
    const dt = 1 / 60;
    const steps = Math.floor(sec / dt);
    for (let k = 0; k < steps; k++) {
      pouring = (state === 'play');
      update(dt);
    }
    pouring = false;
  }

  return { init, resize, setPouring, pointerMove, tapAt, reset, simulate,
           getState: () => state,
           debug: () => ({ fullCount, total: glasses.length, state, pool, totalPoured }) };
})();
