/* =========================================================================
   art.js — the world layout + every piece of rendering
   Everything is drawn in "world units" (1080 x 640); the camera scales it.
   ========================================================================= */
'use strict';

const WORLD = {
  w: 1180, h: 640,
  counterY: 478,                    // top surface of the counter
  grinder: { cx: 112, chuteY: 358, pfY: 402 },
  tampMat: { x: 260, y: 478, pfY: 432 },
  machine: { x0: 320, x1: 800, y0: 140, y1: 300 },
  group: { cx: 445, cy: 338 },      // portafilter rotation pivot
  trayY: 468,                       // drip-tray surface (cup stands here)
  cup: { x: 445, y: 468, rx: 46, ry: 17, h: 58 },  // rim ends up at y = 410,
                                                   // leaving a visible fall from the spouts
  cupStack: { x: 390, y: 98 },      // clean cups warming on top of the machine
  wand: { mx: 772, my: 250, ex: 772, ey: 286, tx: 726, ty: 372 },
  pitcherRest: { x: 820, y: 478 },
  lever: { px: 330, py: 260 },
  serve: { x: 1010, y: 470 }
};

const Art = {
  _grads: new Map(),
  /** cached gradient (world-space coords are stable, so caching is safe) */
  grad(ctx, key, x0, y0, x1, y1, stops) {
    let g = this._grads.get(key);
    if (!g) {
      g = ctx.createLinearGradient(x0, y0, x1, y1);
      for (const s of stops) g.addColorStop(s[0], s[1]);
      this._grads.set(key, g);
    }
    return g;
  },
  rgrad(ctx, key, x0, y0, r0, x1, y1, r1, stops) {
    let g = this._grads.get(key);
    if (!g) {
      g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
      for (const s of stops) g.addColorStop(s[0], s[1]);
      this._grads.set(key, g);
    }
    return g;
  },

  /* ------------------------------------------------------------- shapes */
  rr(ctx, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  },
  ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, TAU); },
  starPath(ctx, cx, cy, ro, ri, n = 5) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? ri : ro;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  },
  heartPath(ctx, cx, cy, s) {
    const k = s / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + k * 0.95);
    ctx.bezierCurveTo(cx - k * 1.45, cy - k * 0.15, cx - k * 0.72, cy - k * 1.25, cx, cy - k * 0.38);
    ctx.bezierCurveTo(cx + k * 0.72, cy - k * 1.25, cx + k * 1.45, cy - k * 0.15, cx, cy + k * 0.95);
    ctx.closePath();
  },
  flower(ctx, cx, cy, r, petal, center, n = 5, rot = 0) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.fillStyle = petal;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      this.ell(ctx, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.52, r * 0.42);
      ctx.fill();
    }
    ctx.fillStyle = center; this.ell(ctx, 0, 0, r * 0.36, r * 0.36); ctx.fill();
    ctx.restore();
  },
  /** soft contact shadow under an object */
  shadow(ctx, x, y, rx, ry, a = 0.3) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, 1));
    g.addColorStop(0, `rgba(40,22,16,${a})`);
    g.addColorStop(0.6, `rgba(40,22,16,${a * 0.45})`);
    g.addColorStop(1, 'rgba(40,22,16,0)');
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / Math.max(rx, 1)); ctx.translate(-x, -y);
    ctx.fillStyle = g; this.ell(ctx, x, y, rx, rx); ctx.fill(); ctx.restore();
  },

  /* --------------------------------------------------------- metal fills */
  /** vertical brushed-steel column between x0..x1 */
  steelV(ctx, key, x0, x1, dark = 0) {
    return this.grad(ctx, 'sv' + key, x0, 0, x1, 0, [
      [0, `rgb(${118 - dark},${124 - dark},${131 - dark})`],
      [0.12, `rgb(${196 - dark},${203 - dark},${210 - dark})`],
      [0.28, `rgb(${233 - dark},${238 - dark},${243 - dark})`],
      [0.42, `rgb(${170 - dark},${178 - dark},${186 - dark})`],
      [0.58, `rgb(${205 - dark},${212 - dark},${219 - dark})`],
      [0.78, `rgb(${138 - dark},${146 - dark},${154 - dark})`],
      [1, `rgb(${92 - dark},${98 - dark},${105 - dark})`]
    ]);
  },
  /** horizontal chrome band between y0..y1 (bright sky reflection on top) */
  chromeH(ctx, key, y0, y1) {
    return this.grad(ctx, 'ch' + key, 0, y0, 0, y1, [
      [0, '#f4f8fb'], [0.2, '#cdd6dd'], [0.42, '#8e979f'],
      [0.5, '#6e767d'], [0.58, '#aab3ba'], [0.8, '#e6edf2'], [1, '#9aa3aa']
    ]);
  },

  /* ---------------------------------------------------------- background */
  drawBackground(ctx, t) {
    const W = WORLD;
    // wall — deliberately over-sized so a tall portrait viewport is never bare
    ctx.fillStyle = this.grad(ctx, 'wall', 0, -700, 0, W.counterY, [
      [0, '#e9b9a6'], [0.3, '#f6ddd0'], [0.72, '#f2cfc0'], [1, '#e6b8a8']
    ]);
    ctx.fillRect(-900, -1400, W.w + 1800, W.counterY + 1400);

    // splashback tiles behind the machine
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let y = 150; y < W.counterY; y += 42) {
      for (let x = -420; x < W.w + 420; x += 42) {
        const off = ((y / 42) | 0) % 2 ? 21 : 0;
        this.rr(ctx, x + off + 2, y + 2, 38, 38, 6);
        ctx.fillStyle = ((x / 42 + y / 42) | 0) % 3 === 0 ? '#fff3ec' : '#fbe6dc';
        ctx.fill();
      }
    }
    ctx.restore();

    // shelf with jars + plant
    const shelfY = 118;
    ctx.fillStyle = '#a8705a';
    this.rr(ctx, 60, shelfY, 300, 13, 5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(60, shelfY + 13, 300, 5);
    for (let i = 0; i < 4; i++) {
      const jx = 92 + i * 72, jh = 44 + (i % 2) * 10;
      ctx.fillStyle = ['#efc3d4', '#c9e3d4', '#f6dcae', '#d5cdf0'][i];
      this.rr(ctx, jx, shelfY - jh, 42, jh, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      this.rr(ctx, jx + 5, shelfY - jh + 6, 10, jh - 16, 5); ctx.fill();
      ctx.fillStyle = '#8d6350';
      this.rr(ctx, jx - 3, shelfY - jh - 9, 48, 11, 4); ctx.fill();
    }
    // hanging star garland
    ctx.strokeStyle = 'rgba(160,110,90,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 380; x <= W.w + 60; x += 8) {
      const y = 70 + Math.sin((x - 380) / 150) * 6 + Math.sin(x * 0.02 + t) * 1.2 + (x - 380) * 0.02;
      x === 380 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const x = 400 + i * 84;
      const y = 70 + Math.sin((x - 380) / 150) * 6 + (x - 380) * 0.02 + 16;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.3 + i) * 0.12);
      ctx.fillStyle = ['#ffb7c8', '#ffe08a', '#b9e2f2', '#d9c2f2'][i % 4];
      this.starPath(ctx, 0, 0, 13, 6, 5); ctx.fill();
      ctx.restore();
    }
    // framed picture high on the wall (fills the top of a tall portrait screen)
    ctx.save();
    ctx.translate(300, -60);
    ctx.fillStyle = 'rgba(90,55,40,0.18)';
    this.rr(ctx, -86, -60, 176, 128, 8); ctx.fill();
    ctx.fillStyle = '#a8705a'; this.rr(ctx, -90, -64, 176, 128, 8); ctx.fill();
    ctx.fillStyle = '#fdf3e6'; this.rr(ctx, -78, -52, 152, 104, 4); ctx.fill();
    ctx.fillStyle = '#cfe7f5'; this.rr(ctx, -78, -52, 152, 62, 4); ctx.fill();
    ctx.fillStyle = '#f7c9d8';
    ctx.beginPath(); ctx.arc(-30, 10, 34, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#ffe08a'; this.starPath(ctx, 34, -26, 16, 7, 5); ctx.fill();
    ctx.fillStyle = '#b9dcb4'; ctx.fillRect(-78, 10, 152, 42);
    ctx.restore();
    // a second little shelf up high with beans jars
    ctx.fillStyle = '#a8705a';
    this.rr(ctx, 640, -34, 260, 12, 5); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const jx = 672 + i * 78;
      ctx.fillStyle = ['#f6dcae', '#efc3d4', '#c9e3d4'][i];
      this.rr(ctx, jx, -34 - 46, 48, 46, 9); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; this.rr(ctx, jx + 6, -74, 11, 30, 5); ctx.fill();
      ctx.fillStyle = '#8d6350'; this.rr(ctx, jx - 4, -90, 56, 12, 4); ctx.fill();
    }
    // potted plant top-left
    ctx.save();
    ctx.translate(30, shelfY - 6);
    ctx.fillStyle = '#7fb069';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.42 + Math.sin(t * 0.8 + i) * 0.05;
      ctx.save(); ctx.rotate(a);
      this.ell(ctx, 0, -30, 10, 30); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#e29a7c';
    this.rr(ctx, -22, -8, 44, 30, 6); ctx.fill();
    ctx.restore();
  },

  drawCounter(ctx, t) {
    const W = WORLD, y = W.counterY;
    // counter top edge highlight
    ctx.fillStyle = this.grad(ctx, 'ctop', 0, y - 4, 0, y + 18, [
      [0, '#fff7f1'], [0.25, '#f0dccd'], [1, '#dcbfae']
    ]);
    ctx.fillRect(-900, y - 4, W.w + 1800, 22);
    // counter front
    ctx.fillStyle = this.grad(ctx, 'cfront', 0, y + 18, 0, W.h + 460, [
      [0, '#c69a83'], [0.28, '#b2846d'], [0.7, '#8d6350'], [1, '#6d4a3c']
    ]);
    ctx.fillRect(-900, y + 18, W.w + 1800, W.h + 1400);
    // wood grain
    ctx.save(); ctx.globalAlpha = 0.10; ctx.strokeStyle = '#4d2f22'; ctx.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      const yy = y + 32 + i * 17;
      ctx.beginPath();
      for (let x = -900; x < W.w + 900; x += 26)
        x === -900 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy + Math.sin(x * 0.02 + i) * 2.2);
      ctx.stroke();
    }
    ctx.restore();

    // cabinet doors below the counter, so a tall portrait view is furnished
    const dy = y + 96;
    for (let i = 0; i < 5; i++) {
      const dx = -160 + i * 300;
      ctx.fillStyle = 'rgba(60,34,25,0.16)';
      this.rr(ctx, dx + 6, dy + 8, 250, 210, 12); ctx.fill();
      ctx.fillStyle = '#a9785f'; this.rr(ctx, dx, dy, 250, 210, 12); ctx.fill();
      ctx.fillStyle = '#bd8a6e'; this.rr(ctx, dx + 16, dy + 16, 218, 178, 8); ctx.fill();
      ctx.fillStyle = '#f2d3c0';
      ctx.beginPath(); ctx.arc(dx + 220, dy + 105, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff9fbe';
      this.heartPath(ctx, dx + 125, dy + 40, 26); ctx.fill();
    }
    // floor
    ctx.fillStyle = this.grad(ctx, 'floor', 0, y + 330, 0, y + 900,
      [[0, '#8a5f4c'], [1, '#5c3d31']]);
    ctx.fillRect(-900, y + 330, W.w + 1800, 1200);
    ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = '#fff';
    for (let i = 0; i < 14; i++) ctx.fillRect(-900 + i * 170, y + 330, 84, 1200);
    ctx.restore();

    // pink gingham cloth under the tamping mat
    this.cloth(ctx, 190, y - 3, 140, 20);
    // little vase of flowers on the counter's left corner
    ctx.save();
    ctx.translate(26, y);
    this.shadow(ctx, 0, 2, 24, 7, 0.3);
    ctx.fillStyle = '#cfe7f5'; this.rr(ctx, -13, -34, 26, 34, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; this.rr(ctx, -9, -30, 7, 24, 3); ctx.fill();
    ctx.strokeStyle = '#7fb069'; ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(i * 10, -48, i * 16, -62); ctx.stroke();
    }
    this.flower(ctx, -16, -64, 11, '#ff9fbe', '#ffe08a', 5, t * 0.3);
    this.flower(ctx, 0, -72, 12, '#fff0f5', '#ffc46b', 5, -t * 0.25);
    this.flower(ctx, 16, -62, 11, '#c9a7f0', '#ffe08a', 5, t * 0.2);
    ctx.restore();
  },
  cloth(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#f7b8c8'; this.rr(ctx, x, y, w, h, 5); ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++)
      if ((i + j) % 2) ctx.fillRect(x + i * 12, y + j * 7, 12, 7);
    ctx.restore();
  },

  /* ------------------------------------------------------------- grinder */
  /** active: 0..1 how hard it is running */
  drawGrinder(ctx, t, active) {
    const W = WORLD, cx = W.grinder.cx, baseY = W.counterY;
    ctx.save();
    this.shadow(ctx, cx, baseY + 2, 78, 12, 0.35);

    // ---- hopper full of beans
    const hy0 = 96, hy1 = 168;
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.beginPath();
    ctx.moveTo(cx - 52, hy0); ctx.lineTo(cx + 52, hy0);
    ctx.lineTo(cx + 30, hy1); ctx.lineTo(cx - 30, hy1); ctx.closePath();
    ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 0; i < 26; i++) {
      const bx = cx - 44 + ((i * 37) % 88);
      const jitter = active > 0 ? Math.sin(t * 26 + i) * 1.6 * active : 0;
      const by = hy1 - 8 - ((i * 23) % 52) + jitter;
      this.bean(ctx, bx, by, 8.5, (i * 1.7) % TAU);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 52, hy0); ctx.lineTo(cx + 52, hy0);
    ctx.moveTo(cx - 52, hy0); ctx.lineTo(cx - 30, hy1);
    ctx.moveTo(cx + 52, hy0); ctx.lineTo(cx + 30, hy1);
    ctx.stroke();

    // ---- body
    const bx0 = cx - 46, bx1 = cx + 46;
    ctx.fillStyle = this.steelV(ctx, 'gr', bx0, bx1);
    this.rr(ctx, bx0, 162, 92, 128, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
    this.rr(ctx, bx0 + 1, 163, 90, 126, 12); ctx.stroke();
    // black control face
    ctx.fillStyle = '#2c2c31';
    this.rr(ctx, cx - 30, 186, 60, 40, 8); ctx.fill();
    // running lamp
    const lamp = active > 0.05;
    ctx.fillStyle = lamp ? '#ff6b6b' : '#5c3f3f';
    this.ell(ctx, cx, 206, 9, 9); ctx.fill();
    if (lamp) {
      ctx.globalAlpha = 0.45 + Math.sin(t * 18) * 0.2;
      ctx.fillStyle = '#ff9d9d'; this.ell(ctx, cx, 206, 16, 16); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // pink heart sticker
    ctx.fillStyle = '#ff8fb0'; this.heartPath(ctx, cx + 30, 250, 22); ctx.fill();

    // ---- throat + chute (the fork the portafilter slides under)
    ctx.fillStyle = this.steelV(ctx, 'gr2', cx - 26, cx + 26, 26);
    this.rr(ctx, cx - 26, 286, 52, 56, 8); ctx.fill();
    ctx.fillStyle = '#3a3a40';
    this.rr(ctx, cx - 15, 336, 30, 22, 5); ctx.fill();
    // fork arms that cradle the portafilter
    ctx.fillStyle = this.chromeH(ctx, 'gfork', 358, 378);
    this.rr(ctx, cx - 64, 358, 32, 16, 5); ctx.fill();
    this.rr(ctx, cx + 32, 358, 32, 16, 5); ctx.fill();

    // ---- pedestal down to the counter
    ctx.fillStyle = this.steelV(ctx, 'gr3', cx - 34, cx + 34, 40);
    this.rr(ctx, cx - 34, 430, 68, baseY - 430 + 2, 8); ctx.fill();
    ctx.fillStyle = this.steelV(ctx, 'gr4', cx - 56, cx + 56, 60);
    this.rr(ctx, cx - 56, baseY - 14, 112, 16, 6); ctx.fill();
    ctx.restore();
  },
  bean(ctx, x, y, r, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = '#5a3520';
    this.ell(ctx, 0, 0, r, r * 0.74); ctx.fill();
    ctx.strokeStyle = '#2f1b10'; ctx.lineWidth = r * 0.19;
    ctx.beginPath(); ctx.moveTo(-r * 0.72, 0);
    ctx.quadraticCurveTo(0, r * 0.34, r * 0.72, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,180,0.28)';
    this.ell(ctx, -r * 0.25, -r * 0.34, r * 0.34, r * 0.16); ctx.fill();
    ctx.restore();
  },

  /* ------------------------------------------------------------- machine */
  /** st: { leverAngle, lampBrew, steamOn, pressure } */
  drawMachine(ctx, t, st) {
    const W = WORLD, M = W.machine;
    ctx.save();
    this.shadow(ctx, (M.x0 + M.x1) / 2, W.counterY + 4, 250, 16, 0.35);

    // ---- side columns that frame the brew area
    ctx.fillStyle = this.steelV(ctx, 'mc1', M.x0, M.x0 + 46, 18);
    this.rr(ctx, M.x0, M.y1 - 12, 46, W.counterY - M.y1 + 12, 8); ctx.fill();
    ctx.fillStyle = this.steelV(ctx, 'mc2', M.x1 - 46, M.x1, 18);
    this.rr(ctx, M.x1 - 46, M.y1 - 12, 46, W.counterY - M.y1 + 12, 8); ctx.fill();

    // ---- recess behind the group head: dark, but with a lit steel back panel
    // so the portafilter always has something to read against
    const rx0 = M.x0 + 40, rw = M.x1 - M.x0 - 80;
    ctx.fillStyle = this.grad(ctx, 'recessBack', 0, M.y1 - 6, 0, W.counterY, [
      [0, '#4a3b3c'], [0.42, '#6b5a58'], [0.8, '#544544'], [1, '#3a2e2e']
    ]);
    ctx.fillRect(rx0, M.y1 - 6, rw, W.counterY - M.y1 + 6);
    // tiled back wall of the recess
    ctx.save();
    ctx.beginPath(); ctx.rect(rx0, M.y1 - 6, rw, W.counterY - M.y1 + 6); ctx.clip();
    ctx.globalAlpha = 0.10; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    for (let x = rx0; x < rx0 + rw; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, M.y1 - 6); ctx.lineTo(x, W.counterY); ctx.stroke();
    }
    for (let y2 = M.y1 + 20; y2 < W.counterY; y2 += 34) {
      ctx.beginPath(); ctx.moveTo(rx0, y2); ctx.lineTo(rx0 + rw, y2); ctx.stroke();
    }
    // pool of light spilling down from under the machine
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.rgrad(ctx, 'recessLit', W.group.cx, M.y1 + 10, 4,
                               W.group.cx, M.y1 + 10, 210,
      [[0, 'rgba(255,235,205,0.30)'], [0.55, 'rgba(255,225,190,0.10)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(rx0, M.y1 - 6, rw, W.counterY - M.y1 + 6);
    // vignette at the sides
    ctx.fillStyle = this.grad(ctx, 'recessVig', rx0, 0, rx0 + rw, 0, [
      [0, 'rgba(0,0,0,0.45)'], [0.22, 'rgba(0,0,0,0.05)'],
      [0.78, 'rgba(0,0,0,0.05)'], [1, 'rgba(0,0,0,0.45)']
    ]);
    ctx.fillRect(rx0, M.y1 - 6, rw, W.counterY - M.y1 + 6);
    ctx.restore();

    // ---- main body
    ctx.fillStyle = this.steelV(ctx, 'body', M.x0, M.x1);
    this.rr(ctx, M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0 + 8, 20); ctx.fill();
    // brushed streaks
    ctx.save();
    this.rr(ctx, M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0 + 8, 20); ctx.clip();
    ctx.globalAlpha = 0.10; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    for (let x = M.x0 + 4; x < M.x1; x += 5) {
      ctx.beginPath(); ctx.moveTo(x, M.y0); ctx.lineTo(x, M.y1 + 8); ctx.stroke();
    }
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(M.x0, M.y0 + 60); ctx.lineTo(M.x1, M.y0 + 18);
    ctx.lineTo(M.x1, M.y0 + 40); ctx.lineTo(M.x0, M.y0 + 84); ctx.closePath(); ctx.fill();
    ctx.restore();

    // ---- chrome crown
    ctx.fillStyle = this.chromeH(ctx, 'crown', M.y0 - 26, M.y0 + 12);
    this.rr(ctx, M.x0 - 12, M.y0 - 26, M.x1 - M.x0 + 24, 40, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    this.rr(ctx, M.x0 - 4, M.y0 - 22, M.x1 - M.x0 + 8, 7, 4); ctx.fill();
    // cups warming on top, upside down (the player takes one from here)
    for (let i = st.cupsTaken || 0; i < 4; i++) {
      const cx = M.x0 + 70 + i * 100, cy = M.y0 - 30;
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; this.ell(ctx, cx, cy + 1, 23, 6); ctx.fill();
      ctx.fillStyle = i % 2 ? '#ffd9e4' : '#fff6ef';
      ctx.beginPath();
      ctx.moveTo(cx - 21, cy);
      ctx.bezierCurveTo(cx - 20, cy - 18, cx - 16, cy - 30, cx - 15, cy - 34);
      ctx.lineTo(cx + 15, cy - 34);
      ctx.bezierCurveTo(cx + 16, cy - 30, cx + 20, cy - 18, cx + 21, cy);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      this.rr(ctx, cx - 15, cy - 28, 7, 24, 3); ctx.fill();
      // handle
      ctx.strokeStyle = i % 2 ? '#ffd9e4' : '#fff6ef'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + 19, cy - 24);
      ctx.bezierCurveTo(cx + 32, cy - 24, cx + 32, cy - 6, cx + 20, cy - 6);
      ctx.stroke();
      // the foot, now facing up
      ctx.fillStyle = 'rgba(0,0,0,0.10)'; this.ell(ctx, cx, cy - 34, 15, 4); ctx.fill();
      ctx.fillStyle = '#ffffff'; this.ell(ctx, cx, cy - 35, 11, 3); ctx.fill();
    }

    // ---- badge panel
    ctx.fillStyle = '#3b2b2b';
    this.rr(ctx, M.x0 + 150, M.y0 + 30, 180, 62, 14); ctx.fill();
    ctx.strokeStyle = '#d9b26a'; ctx.lineWidth = 3;
    this.rr(ctx, M.x0 + 156, M.y0 + 36, 168, 50, 10); ctx.stroke();
    // a drawn (not written) emblem: cup + steam + star
    const ex = M.x0 + 240, ey = M.y0 + 61;
    ctx.fillStyle = '#f4e3c8';
    ctx.beginPath(); ctx.moveTo(ex - 16, ey - 2); ctx.lineTo(ex + 16, ey - 2);
    ctx.quadraticCurveTo(ex + 13, ey + 16, ex, ey + 16);
    ctx.quadraticCurveTo(ex - 13, ey + 16, ex - 16, ey - 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f4e3c8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex + 16, ey + 2); ctx.quadraticCurveTo(ex + 26, ey + 4, ex + 20, ey + 11); ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(ex + i * 9, ey - 10);
      ctx.quadraticCurveTo(ex + i * 9 + 5, ey - 17, ex + i * 9, ey - 24); ctx.stroke();
    }
    ctx.fillStyle = '#ffd66b'; this.starPath(ctx, ex - 34, ey + 2, 9, 4, 5); ctx.fill();
    ctx.fillStyle = '#ff9fbe'; this.heartPath(ctx, ex + 36, ey + 3, 17); ctx.fill();

    // ---- pressure gauge (needle reacts to brewing)
    const gx = M.x1 - 74, gy = M.y0 + 62;
    ctx.fillStyle = this.chromeH(ctx, 'gaugeR', gy - 34, gy + 34);
    this.ell(ctx, gx, gy, 34, 34); ctx.fill();
    ctx.fillStyle = '#fdf6e8'; this.ell(ctx, gx, gy, 27, 27); ctx.fill();
    ctx.strokeStyle = '#c9c0ae'; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i <= 8; i++) {
      const a = deg(140) + i / 8 * deg(260);
      ctx.strokeStyle = i > 5 ? '#e05a5a' : '#8a8172'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx + Math.cos(a) * 20, gy + Math.sin(a) * 20);
      ctx.lineTo(gx + Math.cos(a) * 25, gy + Math.sin(a) * 25); ctx.stroke();
    }
    const pr = sat(st.pressure || 0);
    const na = deg(140) + (pr * 0.72 + (pr > 0 ? Math.sin(t * 22) * 0.02 : 0)) * deg(260);
    ctx.strokeStyle = '#d0413f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.cos(na) * 21, gy + Math.sin(na) * 21); ctx.stroke();
    ctx.fillStyle = '#4a4a4a'; this.ell(ctx, gx, gy, 4, 4); ctx.fill();
    // glass glare
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(gx - 8, gy - 10, 16, 9, -0.6, 0, TAU); ctx.fill();

    // ---- brew lever (pull it down to extract)
    this.drawLever(ctx, st.leverAngle || 0, st.lampBrew || 0);

    // ---- group head
    this.drawGroupHead(ctx, t, st);

    // ---- drip tray
    const tx0 = M.x0 + 46, tx1 = M.x1 - 46;
    ctx.fillStyle = this.steelV(ctx, 'tray', tx0, tx1, 30);
    this.rr(ctx, tx0, W.trayY, tx1 - tx0, 22, 5); ctx.fill();
    ctx.fillStyle = '#54565b';
    this.rr(ctx, tx0 + 8, W.trayY + 2, tx1 - tx0 - 16, 9, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(230,238,244,0.9)'; ctx.lineWidth = 3;
    for (let x = tx0 + 14; x < tx1 - 12; x += 13) {
      ctx.beginPath(); ctx.moveTo(x, W.trayY + 2); ctx.lineTo(x, W.trayY + 11); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(tx0 + 4, W.trayY + 13, tx1 - tx0 - 8, 2);

    // ---- steam wand
    this.drawWand(ctx, t, st);
    ctx.restore();
  },

  drawLever(ctx, ang, lamp) {
    const L = WORLD.lever;
    ctx.save();
    ctx.translate(L.px, L.py);
    // pivot boss
    ctx.fillStyle = this.chromeH(ctx, 'lp', -18, 18);
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7c848b'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.rotate(ang);
    // arm
    ctx.fillStyle = this.chromeH(ctx, 'la', -8, 8);
    this.rr(ctx, -76, -8, 80, 16, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    this.rr(ctx, -70, -6, 62, 4, 2); ctx.fill();
    // knob
    const kg = ctx.createRadialGradient(-78, -6, 2, -74, 0, 20);
    kg.addColorStop(0, '#5b4139'); kg.addColorStop(0.5, '#3a2721'); kg.addColorStop(1, '#241713');
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.arc(-76, 0, 18, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.beginPath(); ctx.ellipse(-81, -6, 7, 4, -0.6, 0, TAU); ctx.fill();
    ctx.restore();
    // brew lamp beside the lever
    ctx.fillStyle = lamp > 0.05 ? '#8fe37a' : '#3d4a3c';
    ctx.beginPath(); ctx.arc(L.px + 36, L.py + 4, 8, 0, TAU); ctx.fill();
    if (lamp > 0.05) {
      ctx.globalAlpha = 0.5 * lamp; ctx.fillStyle = '#b6f5a4';
      ctx.beginPath(); ctx.arc(L.px + 36, L.py + 4, 16, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  drawGroupHead(ctx, t, st) {
    const G = WORLD.group;
    ctx.save();
    // bracket up into the body
    ctx.fillStyle = this.steelV(ctx, 'ghb', G.cx - 30, G.cx + 30, 10);
    this.rr(ctx, G.cx - 30, WORLD.machine.y1 - 18, 60, 44, 6); ctx.fill();
    // head block
    ctx.fillStyle = this.steelV(ctx, 'gh', G.cx - 48, G.cx + 48);
    this.rr(ctx, G.cx - 48, G.cy - 44, 96, 40, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
    this.rr(ctx, G.cx - 47, G.cy - 43, 94, 38, 9); ctx.stroke();
    // three bolts
    ctx.fillStyle = '#8d959c';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(G.cx + i * 30, G.cy - 34, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(G.cx + i * 30 - 1.5, G.cy - 35.5, 2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8d959c';
    }
    // the locking collar the portafilter twists into
    ctx.fillStyle = this.chromeH(ctx, 'ghc', G.cy - 12, G.cy + 12);
    this.ell(ctx, G.cx, G.cy - 4, 56, 15); ctx.fill();
    ctx.fillStyle = '#2b2b30';
    this.ell(ctx, G.cx, G.cy - 2, 45, 11); ctx.fill();
    // dispersion screen
    ctx.fillStyle = '#767c82';
    this.ell(ctx, G.cx, G.cy - 2, 36, 8.5); ctx.fill();
    ctx.save();
    this.ell(ctx, G.cx, G.cy - 2, 36, 8.5); ctx.clip();
    ctx.strokeStyle = 'rgba(40,40,45,0.6)'; ctx.lineWidth = 1;
    for (let x = -36; x <= 36; x += 5) {
      ctx.beginPath(); ctx.moveTo(G.cx + x, G.cy - 12); ctx.lineTo(G.cx + x, G.cy + 8); ctx.stroke();
    }
    ctx.restore();
    // wet gasket sheen
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(G.cx, G.cy - 4, 50, 12, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.restore();
  },

  /** the guide slots the portafilter ears ride into */
  drawGroupSlots(ctx, highlight) {
    const G = WORLD.group;
    ctx.save();
    ctx.globalAlpha = 0.35 + highlight * 0.6;
    ctx.strokeStyle = highlight > 0.02 ? '#ffe98a' : '#6d7378';
    ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(G.cx, G.cy - 2, 52, s > 0 ? deg(-14) : deg(166), s > 0 ? deg(14) : deg(194));
      ctx.stroke();
    }
    ctx.restore();
  },

  drawWand(ctx, t, st) {
    const W = WORLD.wand;
    ctx.save();
    // knob
    ctx.translate(W.mx + 8, W.my - 26);
    ctx.rotate(st.steamOn ? deg(-38) : 0);
    ctx.fillStyle = this.chromeH(ctx, 'wk', -9, 9);
    this.rr(ctx, -26, -7, 52, 14, 7); ctx.fill();
    ctx.fillStyle = '#e8574f';
    ctx.beginPath(); ctx.arc(-26, 0, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(-28, -3, 3.4, 0, TAU); ctx.fill();
    ctx.restore();
    // ball joint
    ctx.fillStyle = this.chromeH(ctx, 'wj', W.my - 16, W.my + 16);
    ctx.beginPath(); ctx.arc(W.mx, W.my, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(W.mx - 4, W.my - 5, 5, 0, TAU); ctx.fill();
    // tube: mount -> elbow -> tip
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#6f767d'; ctx.lineWidth = 15;
    ctx.beginPath(); ctx.moveTo(W.mx, W.my); ctx.lineTo(W.ex, W.ey); ctx.lineTo(W.tx, W.ty); ctx.stroke();
    ctx.strokeStyle = this.chromeH(ctx, 'wt', W.my, W.ty); ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(W.mx, W.my); ctx.lineTo(W.ex, W.ey); ctx.lineTo(W.tx, W.ty); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W.mx - 3, W.my + 4); ctx.lineTo(W.ex - 3, W.ey); ctx.lineTo(W.tx - 2, W.ty - 5); ctx.stroke();
    // black grip + steam tip
    const a = Math.atan2(W.ty - W.ey, W.tx - W.ex);
    ctx.save();
    ctx.translate(W.tx, W.ty); ctx.rotate(a);
    ctx.fillStyle = '#2f3237'; this.rr(ctx, -30, -8, 22, 16, 5); ctx.fill();
    ctx.fillStyle = this.chromeH(ctx, 'wtip', -8, 8);
    this.rr(ctx, -8, -7, 16, 14, 4); ctx.fill();
    ctx.fillStyle = '#1e2124';
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(6, i * 4, 1.8, 0, TAU); ctx.fill(); }
    ctx.restore();
  },

  /* --------------------------------------------------------- portafilter */
  /**
   * cx,cy  : the centre of the basket ring
   * ang    : rotation about that centre (0 = locked, negative = unlocked)
   * o      : { dose 0..1, tamped, wet, spouts }
   */
  drawPortafilter(ctx, cx, cy, ang, o) {
    o = o || {};
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);

    // ---- handle (points right) with a pink wooden grip
    ctx.fillStyle = this.chromeH(ctx, 'pfn', -11, 11);
    this.rr(ctx, 40, -11, 42, 22, 8); ctx.fill();
    const hg = ctx.createLinearGradient(0, -17, 0, 17);
    hg.addColorStop(0, '#5c3b32'); hg.addColorStop(0.35, '#3f2721'); hg.addColorStop(1, '#251511');
    ctx.fillStyle = hg;
    this.rr(ctx, 78, -17, 84, 34, 16); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    this.rr(ctx, 86, -12, 66, 6, 3); ctx.fill();
    // cute band + star on the grip
    ctx.fillStyle = '#ff9fbe'; this.rr(ctx, 112, -17, 15, 34, 6); ctx.fill();
    ctx.fillStyle = '#ffe08a'; this.starPath(ctx, 119.5, 0, 6.6, 3, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    this.rr(ctx, 150, -13, 8, 26, 4); ctx.fill();

    // ---- spouts under the basket
    ctx.fillStyle = this.chromeH(ctx, 'pfs', 24, 44);
    this.rr(ctx, -20, 22, 40, 14, 5); ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 4, 34); ctx.lineTo(s * 15, 34);
      ctx.lineTo(s * 10, 46); ctx.lineTo(s * 6, 46); ctx.closePath();
      ctx.fillStyle = '#98a1a8'; ctx.fill();
    }

    // ---- the ring/basket body
    ctx.fillStyle = this.chromeH(ctx, 'pfb', -16, 30);
    ctx.beginPath();
    ctx.moveTo(-52, -4);
    ctx.lineTo(-40, 26); ctx.lineTo(40, 26); ctx.lineTo(52, -4);
    ctx.closePath(); ctx.fill();
    // locking ears (these are what the group slots grab)
    ctx.fillStyle = this.chromeH(ctx, 'pfe', -12, 8);
    this.rr(ctx, -68, -10, 22, 13, 5); ctx.fill();
    this.rr(ctx, 46, -10, 22, 13, 5); ctx.fill();
    // rim
    ctx.fillStyle = this.chromeH(ctx, 'pfr', -14, 6);
    this.ell(ctx, 0, -4, 52, 15); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -4, 52, 15, 0, Math.PI, TAU); ctx.stroke();
    // inside of the basket
    ctx.fillStyle = '#4b4f54';
    this.ell(ctx, 0, -2, 43, 12); ctx.fill();
    ctx.fillStyle = '#2e3236';
    this.ell(ctx, 0, 0, 43, 12); ctx.fill();

    // ---- coffee bed
    const dose = sat(o.dose || 0);
    if (dose > 0.001) {
      ctx.save();
      this.ell(ctx, 0, 0, 43, 12); ctx.clip();
      const mound = o.tamped ? 0 : 1;
      const top = 6 - dose * 12;
      ctx.fillStyle = o.wet ? '#31190f' : '#3d2415';
      ctx.beginPath();
      ctx.moveTo(-43, 14);
      if (mound) {
        // loose grounds pile up in the middle
        const lv = sat(o.leveled || 0);
        for (let x = -43; x <= 43; x += 4) {
          const bump = Math.cos(x / 43 * Math.PI / 2) * 9 * dose * (1 - lv * 0.88);
          const noise = Math.sin(x * 0.9 + (o.seed || 0)) * 1.1 * dose * (1 - lv);
          ctx.lineTo(x, top - bump + noise);
        }
      } else {
        ctx.lineTo(-43, top); ctx.lineTo(43, top);
      }
      ctx.lineTo(43, 14); ctx.closePath(); ctx.fill();
      // grain speckle
      ctx.globalAlpha = o.tamped ? 0.22 : 0.5;
      for (let i = 0; i < 46; i++) {
        const x = -42 + ((i * 61) % 84);
        const bump = mound ? Math.cos(x / 43 * Math.PI / 2) * 9 * dose * (1 - sat(o.leveled || 0) * 0.88) : 0;
        const y = top - bump + ((i * 37) % 9) * 0.6 + 1.5;
        ctx.fillStyle = i % 3 ? '#5a3823' : '#28150c';
        ctx.fillRect(x, y, 2.4, 1.9);
      }
      ctx.globalAlpha = 1;
      if (o.tamped) {
        // polished puck: a flat disc with a soft sheen
        ctx.fillStyle = 'rgba(255,220,180,0.16)';
        this.ell(ctx, 0, top + 1, 40, 9); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        this.ell(ctx, -12, top - 1, 18, 4); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  },

  drawTamper(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot || 0);
    // base disc
    ctx.fillStyle = this.chromeH(ctx, 'tb', -8, 12);
    this.rr(ctx, -38, -6, 76, 16, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    this.rr(ctx, -34, -4, 60, 4, 2); ctx.fill();
    // stem
    ctx.fillStyle = this.chromeH(ctx, 'ts', -40, -6);
    this.rr(ctx, -11, -42, 22, 38, 5); ctx.fill();
    // wooden knob
    const g = ctx.createRadialGradient(-10, -76, 4, 0, -66, 40);
    g.addColorStop(0, '#f0b7c9'); g.addColorStop(0.45, '#dd8fa8'); g.addColorStop(1, '#a35f78');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-30, -40);
    ctx.bezierCurveTo(-36, -70, -22, -92, 0, -92);
    ctx.bezierCurveTo(22, -92, 36, -70, 30, -40);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(-11, -74, 9, 5, -0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff0f5'; this.heartPath(ctx, 6, -62, 15); ctx.fill();
    ctx.restore();
  },

  /* ----------------------------------------------------------------- cup */
  /** The colour of the drink seen through the cup.  Interpolated through a
      real latte tan rather than a straight average, which would go grey. */
  liquidColor(esp, milk, cocoa) {
    const m = sat(milk / (milk + esp + cocoa + 0.001));
    const ramp = cocoa > 0.35
      ? [[107, 66, 48], [156, 103, 74], [206, 172, 142]]      // cocoa -> cocoa latte
      : [[59, 29, 16], [196, 146, 100], [248, 240, 222]];     // espresso -> latte -> milk
    const i = m < 0.5 ? 0 : 1, t = m < 0.5 ? m * 2 : (m - 0.5) * 2;
    const a = ramp[i], b = ramp[i + 1];
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  },
  /** Where the liquid surface sits, in cup-local units (cup base = 0,0).
      Shared by the renderer and the latte-art input mapping so they can
      never drift apart. */
  cupSurface(o) {
    const C = WORLD.cup;
    const esp = sat(o.espresso || 0), milk = sat(o.milk || 0), cocoa = sat(o.cocoa || 0);
    const vol = sat(esp * 0.50 + milk * 0.55 + cocoa * 0.50);
    const innerRX = C.rx - 3.4, innerRY = C.ry - 1.4;
    const k = 0.88 + vol * 0.12;
    return { vol, innerRX, innerRY,
             surfY: -C.h + 3 + (1 - vol) * (C.h * 0.30),
             sRX: innerRX * k, sRY: innerRY * k };
  },

  /**
   * o : { espresso 0..1, milk 0..1, cocoa, style, surface(canvas), foam 0..1,
   *       scale, tilt }
   */
  drawCup(ctx, x, y, o) {
    o = o || {};
    const C = WORLD.cup;
    const s = o.scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    if (o.tilt) ctx.rotate(o.tilt);

    const h = C.h, rx = C.rx, ry = C.ry;
    const rimY = -h, baseRX = rx * 0.68;

    if (!o.noShadow) this.shadow(ctx, 0, 2, rx * 1.25, ry * 0.7, 0.32);

    // saucer
    if (o.saucer) {
      ctx.fillStyle = '#f4e2ea'; this.ell(ctx, 0, 0, rx * 1.7, ry * 1.35); ctx.fill();
      ctx.fillStyle = '#e8cbd8'; this.ell(ctx, 0, -3, rx * 1.7, ry * 1.35); ctx.fill();
      ctx.fillStyle = '#fff5f9'; this.ell(ctx, 0, -4, rx * 1.15, ry * 0.9); ctx.fill();
    }

    // handle (behind the body)
    ctx.save();
    ctx.strokeStyle = '#efe2da'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rx * 0.82, rimY + h * 0.34);
    ctx.bezierCurveTo(rx * 1.7, rimY + h * 0.28, rx * 1.7, rimY + h * 0.78, rx * 0.78, rimY + h * 0.74);
    ctx.stroke();
    ctx.strokeStyle = '#fffaf6'; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(rx * 0.82, rimY + h * 0.36);
    ctx.bezierCurveTo(rx * 1.62, rimY + h * 0.31, rx * 1.62, rimY + h * 0.74, rx * 0.78, rimY + h * 0.71);
    ctx.stroke();
    ctx.restore();

    // body
    ctx.beginPath();
    ctx.moveTo(-rx, rimY);
    ctx.bezierCurveTo(-rx + 1, rimY + h * 0.66, -baseRX - 3, h - 6, -baseRX, 0);
    ctx.lineTo(baseRX, 0);
    ctx.bezierCurveTo(baseRX + 3, h - 6, rx - 1, rimY + h * 0.66, rx, rimY);
    ctx.closePath();
    ctx.fillStyle = this.grad(ctx, 'cupbody', -rx, 0, rx, 0, [
      [0, '#dcc9c1'], [0.16, '#fbf2ee'], [0.45, '#ffffff'],
      [0.72, '#f3e6e0'], [1, '#cdb6ad']
    ]);
    ctx.fill();
    // porcelain bounce light at the foot
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,190,205,0.30)';
    this.ell(ctx, 0, 4, rx, ry * 1.4); ctx.fill();
    ctx.restore();
    // cute band
    if (o.style !== 'plain') {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-rx, rimY);
      ctx.bezierCurveTo(-rx + 1, rimY + h * 0.66, -baseRX - 3, h - 6, -baseRX, 0);
      ctx.lineTo(baseRX, 0);
      ctx.bezierCurveTo(baseRX + 3, h - 6, rx - 1, rimY + h * 0.66, rx, rimY);
      ctx.closePath(); ctx.clip();
      ctx.fillStyle = '#ffc9da';
      ctx.fillRect(-rx, rimY + h * 0.44, rx * 2, h * 0.2);
      ctx.fillStyle = '#fff';
      for (let i = -2; i <= 2; i++) {
        this.starPath(ctx, i * (rx * 0.42), rimY + h * 0.54, 5.6, 2.4, 5);
        ctx.fill();
      }
      ctx.restore();
    }
    // rim
    ctx.fillStyle = '#ffffff'; this.ell(ctx, 0, rimY, rx, ry); ctx.fill();
    ctx.fillStyle = '#efe0da'; this.ell(ctx, 0, rimY + 1.4, rx - 3.4, ry - 1.4); ctx.fill();

    // ---------- contents ----------
    const esp = sat(o.espresso || 0), milk = sat(o.milk || 0), cocoa = sat(o.cocoa || 0);
    const G0 = this.cupSurface(o);
    const vol = G0.vol;
    if (vol > 0.004) {
      const innerRX = G0.innerRX;
      const surfY = G0.surfY, sRX = G0.sRX, sRY = G0.sRY;
      // the shaft of liquid below the surface
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-innerRX, rimY); ctx.lineTo(-baseRX + 2, 0);
      ctx.lineTo(baseRX - 2, 0); ctx.lineTo(innerRX, rimY); ctx.closePath();
      ctx.clip();
      ctx.fillStyle = this.liquidColor(esp, milk, cocoa);
      ctx.fillRect(-innerRX, surfY, innerRX * 2, h);
      ctx.restore();

      // surface
      ctx.fillStyle = this.liquidColor(esp, milk, cocoa);
      this.ell(ctx, 0, surfY, sRX, sRY); ctx.fill();

      if (o.surface) {
        // latte-art fluid texture, mapped onto the ellipse
        ctx.save();
        this.ell(ctx, 0, surfY, sRX, sRY); ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(o.surface, -sRX, surfY - sRY, sRX * 2, sRY * 2);
        // a cappuccino's deep foam shows as a pale collar around the art
        if (o.foam > 0.5) {
          ctx.globalAlpha = (o.foam - 0.5) * 1.3;
          ctx.strokeStyle = '#fffaf0';
          ctx.lineWidth = sRX * 0.16;
          ctx.beginPath();
          ctx.ellipse(0, surfY, sRX * 0.93, sRY * 0.93, 0, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      } else if (esp > 0.05 && milk < 0.02) {
        // crema: hazelnut foam with a tiger-mottled edge
        const cr = sat(o.crema === undefined ? esp : o.crema);
        ctx.globalAlpha = cr;
        ctx.fillStyle = '#c8965c';
        this.ell(ctx, 0, surfY, sRX, sRY); ctx.fill();
        ctx.fillStyle = '#e0b478';
        this.ell(ctx, -sRX * 0.16, surfY - sRY * 0.12, sRX * 0.7, sRY * 0.66); ctx.fill();
        ctx.globalAlpha = cr * 0.5;
        for (let i = 0; i < 22; i++) {
          const a = i * 2.39, r = Math.sqrt((i + 1) / 23);
          ctx.fillStyle = i % 2 ? '#a9743f' : '#efd0a2';
          this.ell(ctx, Math.cos(a) * sRX * r * 0.86, surfY + Math.sin(a) * sRY * r * 0.86,
                   1.9 + (i % 3), 1.1 + (i % 3) * 0.5);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // foam cap for plain steamed milk
      if (o.foam > 0.02 && !o.surface) {
        ctx.globalAlpha = sat(o.foam);
        ctx.fillStyle = '#fffaf2';
        this.ell(ctx, 0, surfY - 0.5, sRX * 0.94, sRY * 0.9); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // inner-wall shadow across the liquid
      ctx.save();
      this.ell(ctx, 0, surfY, sRX, sRY); ctx.clip();
      ctx.fillStyle = 'rgba(60,30,15,0.22)';
      this.ell(ctx, 0, surfY - sRY * 1.05, sRX * 1.1, sRY * 1.1); ctx.fill();
      ctx.restore();
      // specular
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.save(); ctx.beginPath();
      ctx.ellipse(-sRX * 0.42, surfY - sRY * 0.34, sRX * 0.3, sRY * 0.34, -0.4, 0, TAU);
      ctx.fill(); ctx.restore();
    }

    // rim gloss
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, rimY, rx - 1, ry - 0.6, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.restore();
  },

  /** a cup scaled to fit exactly inside a box of half-width `half`, centred on cx,cy.
      drawCup's natural bounds are x:-46..78, y:-83..17 — we normalise those away. */
  miniCup(ctx, cx, cy, half, o) {
    o = o || {};
    const sc = (2 * half) / 124;
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-16, 33);
    this.drawCup(ctx, 0, 0, Object.assign({ noShadow: true, style: 'cute' }, o));
    if (o.mark) {
      // decorate the liquid surface (a heart, foam, sprinkles…)
      const g = this.cupSurface(o);
      ctx.save();
      ctx.translate(0, g.surfY);
      this.ell(ctx, 0, 0, g.sRX, g.sRY); ctx.clip();
      o.mark(ctx, g.sRX, g.sRY);
      ctx.restore();
    }
    ctx.restore();
  },

  /* ------------------------------------------------------------- pitcher */
  /**
   * o : { milk 0..1, foam 0..1, swirl (radians), swirlSpeed, tilt, surface:true }
   */
  /** the spout tip in pitcher-local units, before rotation */
  PITCHER_SPOUT: { x: -74, y: -126 },
  /** world position of the spout for a pitcher at (x,y) rotated by rot */
  pitcherSpout(x, y, rot, scale) {
    const s = scale || 1, c = Math.cos(rot || 0), n = Math.sin(rot || 0);
    const lx = this.PITCHER_SPOUT.x * s, ly = this.PITCHER_SPOUT.y * s;
    return { x: x + lx * c - ly * n, y: y + lx * n + ly * c };
  },

  drawPitcher(ctx, x, y, rot, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    if (o.scale) ctx.scale(o.scale, o.scale);
    const W = 96, H = 118, topY = -H, rx = W / 2;

    if (!o.noShadow) this.shadow(ctx, 0, 4, 58, 12, 0.3);

    // handle
    ctx.save();
    ctx.strokeStyle = '#8b939a'; ctx.lineWidth = 13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rx - 4, topY + 24);
    ctx.bezierCurveTo(rx + 44, topY + 26, rx + 44, topY + 86, rx - 4, topY + 84);
    ctx.stroke();
    ctx.strokeStyle = this.chromeH(ctx, 'ph', topY + 20, topY + 90); ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(rx - 4, topY + 25);
    ctx.bezierCurveTo(rx + 40, topY + 28, rx + 40, topY + 83, rx - 4, topY + 81);
    ctx.stroke();
    ctx.restore();

    // body (slightly conical, with the pouring spout on the left)
    ctx.beginPath();
    ctx.moveTo(-rx, topY + 6);
    ctx.lineTo(-rx + 9, 0);
    ctx.quadraticCurveTo(0, 8, rx - 9, 0);
    ctx.lineTo(rx, topY + 6);
    ctx.closePath();
    ctx.fillStyle = this.steelV(ctx, 'pit', -rx, rx);
    ctx.fill();
    ctx.save(); ctx.clip();
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-rx, topY + 40); ctx.lineTo(rx, topY + 14);
    ctx.lineTo(rx, topY + 30); ctx.lineTo(-rx, topY + 58); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.14; ctx.fillStyle = '#2b3a46';
    ctx.fillRect(-rx, topY + 74, W, 60);
    ctx.globalAlpha = 1;
    // cute sticker
    ctx.fillStyle = '#ff9fbe'; this.heartPath(ctx, -12, topY + 78, 24); ctx.fill();
    ctx.fillStyle = '#ffe08a'; this.starPath(ctx, 14, topY + 84, 8, 3.6, 5); ctx.fill();
    ctx.restore();

    // spout beak
    ctx.fillStyle = this.chromeH(ctx, 'psp', topY - 4, topY + 18);
    ctx.beginPath();
    ctx.moveTo(-rx + 2, topY + 10);
    ctx.quadraticCurveTo(-rx - 24, topY + 2, -rx - 26, topY - 8);
    ctx.quadraticCurveTo(-rx - 12, topY - 2, -rx + 2, topY - 1);
    ctx.closePath(); ctx.fill();

    // rim ellipse
    const rimRY = 20;
    ctx.fillStyle = this.chromeH(ctx, 'prim', topY - rimRY, topY + rimRY);
    this.ell(ctx, 0, topY, rx, rimRY); ctx.fill();
    // inside
    ctx.fillStyle = '#5d666d';
    this.ell(ctx, 0, topY + 2, rx - 4, rimRY - 3); ctx.fill();

    // ---- milk inside
    const m = sat(o.milk === undefined ? 0.62 : o.milk);
    if (m > 0.01) {
      const level = topY + 2 + (1 - m) * 54;
      const lrx = (rx - 5) * (0.86 + m * 0.14), lry = (rimRY - 3) * (0.86 + m * 0.14);
      // milk stays level with the world even when the pitcher is tipped over
      const tc = o.levelWorld ? -(rot || 0) : 0;
      ctx.save();
      this.ell(ctx, 0, topY + 2, rx - 4, rimRY - 3); ctx.clip();
      ctx.rotate(tc);
      // wall of milk below the surface
      ctx.fillStyle = '#efe6d8';
      ctx.fillRect(-rx * 1.6, level, W * 1.6, 90);
      ctx.restore();
      ctx.save();
      this.ell(ctx, 0, topY + 2, rx - 4, rimRY - 3); ctx.clip();
      ctx.rotate(tc);
      this.ell(ctx, 0, level, lrx, lry); ctx.clip();
      ctx.fillStyle = '#fbf6ec';
      ctx.fillRect(-rx, level - lry, W, lry * 2 + 2);
      // whirlpool
      const sw = o.swirl || 0, spd = sat(o.swirlSpeed || 0);
      if (spd > 0.02) {
        ctx.save();
        ctx.translate(0, level); ctx.scale(1, lry / lrx); ctx.rotate(sw);
        for (let i = 0; i < 5; i++) {
          const r0 = lrx * (0.16 + i * 0.17);
          ctx.strokeStyle = i % 2 ? `rgba(226,214,192,${0.55 * spd})` : `rgba(255,255,255,${0.75 * spd})`;
          ctx.lineWidth = lrx * 0.13;
          ctx.beginPath();
          for (let a = 0; a <= 3.6; a += 0.12) {
            const r = r0 * (1 - a * 0.1);
            const px = Math.cos(a * 1.7 + i * 1.3) * r, py = Math.sin(a * 1.7 + i * 1.3) * r;
            a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.restore();
        // dimple at the vortex centre
        ctx.fillStyle = `rgba(196,182,158,${0.5 * spd})`;
        this.ell(ctx, 0, level, lrx * 0.17, lry * 0.17); ctx.fill();
      }
      // micro-foam texture
      const f = sat(o.foam || 0);
      if (f > 0.02) {
        ctx.globalAlpha = f;
        ctx.fillStyle = '#ffffff';
        this.ell(ctx, 0, level, lrx * 0.98, lry * 0.98); ctx.fill();
        ctx.globalAlpha = f * 0.55;
        for (let i = 0; i < 34; i++) {
          const a = i * 2.399 + sw * 0.4, r = Math.sqrt((i + 1) / 35);
          ctx.fillStyle = i % 2 ? '#ffffff' : '#e6ddcb';
          this.ell(ctx, Math.cos(a) * lrx * r * 0.9, level + Math.sin(a) * lry * r * 0.9, 2.4, 1.5);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // glossy sheen
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(-lrx * 0.34, level - lry * 0.36, lrx * 0.3, lry * 0.3, -0.5, 0, TAU); ctx.fill();
      ctx.restore();
      // shadow from the near wall
      ctx.save();
      this.ell(ctx, 0, topY + 2, rx - 4, rimRY - 3); ctx.clip();
      ctx.rotate(tc);
      this.ell(ctx, 0, level, lrx, lry); ctx.clip();
      ctx.fillStyle = 'rgba(120,110,95,0.22)';
      this.ell(ctx, 0, level - lry * 1.06, lrx * 1.1, lry * 1.05); ctx.fill();
      ctx.restore();
    }
    // rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(0, topY, rx, rimRY, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
    ctx.restore();
  },

  /* ------------------------------------------------------------ serve tray */
  drawTray(ctx, drinks, t) {
    const S = WORLD.serve;
    ctx.save();
    this.shadow(ctx, S.x, S.y + 4, 108, 13, 0.32);
    ctx.fillStyle = '#c98d6d';
    this.rr(ctx, S.x - 88, S.y - 16, 176, 22, 8); ctx.fill();
    ctx.fillStyle = '#e6b48f';
    this.rr(ctx, S.x - 88, S.y - 22, 176, 12, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    this.rr(ctx, S.x - 82, S.y - 20, 164, 4, 2); ctx.fill();
    // little placemat doily
    ctx.fillStyle = '#fff2f6';
    this.ell(ctx, S.x, S.y - 20, 72, 11); ctx.fill();
    ctx.restore();
    // finished drinks lined up on the tray
    drinks.forEach((d, i) => {
      const n = drinks.length;
      const x = S.x + (i - (n - 1) / 2) * Math.min(64, 150 / Math.max(1, n));
      const bob = Math.sin(t * 2 + i) * 1.2;
      this.drawCup(ctx, x, S.y - 22 + bob, {
        espresso: d.espresso, milk: d.milk, cocoa: d.cocoa,
        surface: d.surface, foam: d.foam, scale: 0.62, saucer: true
      });
    });
  },

  /* -------------------------------------------------------------- steam */
  /** rising heat wisps above a hot drink */
  steamWisps(ctx, x, y, t, amt, w = 26, h = 60) {
    if (amt <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = 0.3 * amt;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const p = k / 10;
        const px = x + i * w * 0.5 + Math.sin(p * 3.6 + t * 1.7 + i * 2) * (7 + p * 9);
        const py = y - p * h;
        k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.globalAlpha = 0.3 * amt * (1 - Math.abs(i) * 0.25);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* ------------------------------------------------------------ UI bits */
  /** a pointing hand used for every hint — no words anywhere in this game */
  hand(ctx, x, y, rot, alpha, scale) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(scale || 1, scale || 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(60,30,20,0.22)';
    this.handPath(ctx, 2.5, 3.5); ctx.fill();
    ctx.fillStyle = '#ffe0c4'; this.handPath(ctx, 0, 0); ctx.fill();
    ctx.strokeStyle = '#c98f6a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  },
  handPath(ctx, ox, oy) {
    ctx.beginPath();
    ctx.moveTo(ox + 0, oy - 30);
    ctx.quadraticCurveTo(ox + 8, oy - 30, ox + 8, oy - 16);
    ctx.lineTo(ox + 8, oy - 4);
    ctx.quadraticCurveTo(ox + 20, oy - 8, ox + 22, oy + 2);
    ctx.quadraticCurveTo(ox + 24, oy + 22, ox + 14, oy + 32);
    ctx.quadraticCurveTo(ox + 6, oy + 40, ox - 6, oy + 38);
    ctx.quadraticCurveTo(ox - 20, oy + 34, ox - 22, oy + 16);
    ctx.lineTo(ox - 22, oy + 2);
    ctx.quadraticCurveTo(ox - 20, oy - 6, ox - 8, oy - 2);
    ctx.lineTo(ox - 8, oy - 16);
    ctx.quadraticCurveTo(ox - 8, oy - 30, ox + 0, oy - 30);
    ctx.closePath();
  },
  /** dotted guidance arrow along a quadratic curve */
  guideArc(ctx, x0, y0, cx, cy, x1, y1, alpha, col) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col || '#ffe98a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.setLineDash([2, 20]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    // arrow head along the final tangent
    const a = Math.atan2(y1 - cy, x1 - cx);
    ctx.translate(x1, y1); ctx.rotate(a);
    ctx.fillStyle = col || '#ffe98a';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  /** round icon button */
  button(ctx, b, t) {
    const pressed = b.press || 0;
    const s = 1 + (b.pulse ? Math.sin(t * 3 + (b.phase || 0)) * 0.03 : 0) - pressed * 0.07;
    ctx.save();
    ctx.translate(b.x, b.y); ctx.scale(s, s);
    this.shadow(ctx, 0, b.r * 0.92, b.r * 0.9, b.r * 0.24, 0.35);
    const g = ctx.createLinearGradient(0, -b.r, 0, b.r);
    g.addColorStop(0, b.c1 || '#fff1f5'); g.addColorStop(1, b.c2 || '#ffb7ce');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, b.r - 2, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(0, -b.r * 0.45, b.r * 0.62, b.r * 0.3, 0, 0, TAU); ctx.fill();
    if (b.icon) b.icon(ctx, b.r, t);
    ctx.restore();
  }
};
