'use strict';
(function (PPG) {
  const U = PPG.util;

  // The garden diorama is painted procedurally once per resize into an
  // offscreen canvas covering the world rect [-0.25W..1.25W] x [-0.25H..1.25H]
  // (larger than the screen so the camera can pull back without showing edges).
  const bg = {
    canvas: null,
    W: 0, H: 0,
    blades: [],   // animated foreground grass
    dews: [],     // sparkling dew points (twinkle dynamically)

    rebuild(W, H, dpr) {
      this.W = W; this.H = H;
      const cw = Math.ceil(W * 1.5 * dpr), ch = Math.ceil(H * 1.5 * dpr);
      if (!this.canvas) this.canvas = document.createElement('canvas');
      this.canvas.width = cw; this.canvas.height = ch;
      const x = this.canvas.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, W * 0.25 * dpr, H * 0.25 * dpr);
      const rnd = U.mulberry32(20240811);
      const S = Math.min(W, H);
      paint(x, W, H, S, rnd);
      this.buildDynamic(W, H, S);
    },

    buildDynamic(W, H, S) {
      const rnd = U.mulberry32(777);
      this.blades = [];
      // foreground grass tufts hugging the bottom corners
      const spots = [
        { x: -0.02 * W, y: 1.02 * H, n: 9 }, { x: 0.10 * W, y: 1.05 * H, n: 7 },
        { x: 0.92 * W, y: 1.03 * H, n: 9 }, { x: 1.02 * W, y: 1.05 * H, n: 7 }
      ];
      for (const sp of spots) {
        for (let i = 0; i < sp.n; i++) {
          this.blades.push({
            x: sp.x + (rnd() - 0.5) * 0.13 * W,
            y: sp.y + (rnd() - 0.5) * 0.03 * H,
            len: S * (0.06 + rnd() * 0.075),
            lean: (rnd() - 0.5) * 0.9,
            ph: rnd() * U.TAU,
            hue: 105 + rnd() * 25,
            li: 26 + rnd() * 14,
            w: 2.5 + rnd() * 2.5
          });
        }
      }
      this.dews = [];
      for (let i = 0; i < 26; i++) {
        this.dews.push({
          x: (0.06 + rnd() * 0.9) * W,
          y: (0.5 + rnd() * 0.52) * H,
          r: 0.8 + rnd() * 1.4,
          ph: rnd() * U.TAU
        });
      }
    },

    draw(ctx) {
      const W = this.W, H = this.H;
      ctx.drawImage(this.canvas, -0.25 * W, -0.25 * H, 1.5 * W, 1.5 * H);
    },

    // animated foreground: swaying blades + twinkling dew
    drawFront(ctx, t) {
      ctx.save();
      for (const b of this.blades) {
        const sway = Math.sin(t * 1.3 + b.ph) * 0.12 + b.lean * 0.25;
        const tipX = b.x + sway * b.len, tipY = b.y - b.len;
        ctx.strokeStyle = U.hsla(b.hue, 48, b.li, 0.95);
        ctx.lineWidth = b.w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.quadraticCurveTo(b.x + sway * b.len * 0.3, b.y - b.len * 0.6, tipX, tipY);
        ctx.stroke();
      }
      for (const d of this.dews) {
        const a = 0.18 + 0.5 * Math.max(0, Math.sin(t * 1.7 + d.ph));
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, U.TAU);
        ctx.fill();
      }
      ctx.restore();
    },

    // soil bed geometry, shared with main.js (drawing hints / slots)
    // in landscape the bed sits higher so the color buttons don't cover it
    bed(W, H) {
      if (W > H) return { cx: 0.5 * W, cy: 0.71 * H, rx: 0.34 * W, ry: 0.17 * H };
      return { cx: 0.5 * W, cy: 0.78 * H, rx: 0.42 * W, ry: 0.15 * H };
    }
  };

  // ======================= painting helpers =======================
  function paint(x, W, H, S, rnd) {
    const horizon = 0.44 * H;
    // ---- sky ----
    let g = x.createLinearGradient(0, -0.25 * H, 0, horizon + 0.05 * H);
    g.addColorStop(0, '#9edbf2');
    g.addColorStop(0.55, '#c8ecf6');
    g.addColorStop(1, '#fdf3d6');
    x.fillStyle = g;
    x.fillRect(-0.25 * W, -0.25 * H, 1.5 * W, horizon + 0.3 * H);

    // sun glow
    g = x.createRadialGradient(0.8 * W, 0.06 * H, 0, 0.8 * W, 0.06 * H, 0.3 * S);
    g.addColorStop(0, 'rgba(255,246,200,0.95)');
    g.addColorStop(0.35, 'rgba(255,240,180,0.45)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    x.fillStyle = g;
    x.fillRect(0.8 * W - 0.32 * S, 0.06 * H - 0.32 * S, 0.64 * S, 0.64 * S);

    // clouds
    cloud(x, 0.16 * W, 0.08 * H, 0.11 * S, rnd);
    cloud(x, 0.55 * W, 0.16 * H, 0.08 * S, rnd);
    cloud(x, 1.02 * W, 0.10 * H, 0.10 * S, rnd);
    cloud(x, -0.12 * W, 0.20 * H, 0.07 * S, rnd);

    // ---- far hills ----
    hill(x, W, H, 0.40 * H, 0.10 * H, 'hsla(150,32%,72%,1)');
    // greenhouse on the far hill
    greenhouse(x, 0.14 * W, 0.395 * H, 0.085 * S);
    hill(x, W, H, 0.44 * H, 0.085 * H, 'hsla(135,38%,63%,1)');
    // little lollipop trees
    for (let i = 0; i < 7; i++) {
      const tx = (-0.15 + i * 0.22 + rnd() * 0.06) * W;
      const ty = 0.415 * H + rnd() * 0.02 * H;
      tree(x, tx, ty, S * (0.030 + rnd() * 0.022), rnd);
    }

    // ---- meadow ----
    g = x.createLinearGradient(0, horizon, 0, 1.25 * H);
    g.addColorStop(0, 'hsla(112,44%,62%,1)');
    g.addColorStop(0.5, 'hsla(114,46%,53%,1)');
    g.addColorStop(1, 'hsla(118,48%,44%,1)');
    x.fillStyle = g;
    x.fillRect(-0.25 * W, horizon, 1.5 * W, 1.25 * H - horizon + 0.25 * H);

    // grass texture flecks
    for (let i = 0; i < 420; i++) {
      const gx = (-0.25 + 1.5 * rnd()) * W;
      const gy = horizon + (1.25 * H - horizon) * (rnd() * rnd());
      const l = rnd() < 0.5 ? -8 : 8;
      x.strokeStyle = U.hsla(112 + rnd() * 16, 45, 50 + l + rnd() * 6, 0.35);
      x.lineWidth = 1.4;
      x.beginPath();
      x.moveTo(gx, gy);
      x.lineTo(gx + (rnd() - 0.5) * 3, gy - 3 - rnd() * 5);
      x.stroke();
    }

    // sandy path from bottom to the gate area
    path(x, W, H, rnd);

    // bushes behind the fence
    for (let i = 0; i < 6; i++) {
      const bx = (-0.1 + i * 0.26 + rnd() * 0.05) * W;
      blob(x, bx, 0.475 * H, S * (0.045 + rnd() * 0.03), 'hsla(125,40%,46%,1)', rnd);
      blob(x, bx - 0.02 * W, 0.468 * H, S * 0.03, 'hsla(128,42%,54%,1)', rnd);
    }

    // ---- wooden fence ----
    fence(x, W, H, S, rnd);

    // decorative already-bloomed mini flowers near fence
    for (let i = 0; i < 8; i++) {
      const fx = (-0.05 + rnd() * 1.1) * W;
      const fy = (0.52 + rnd() * 0.045) * H;
      miniFlower(x, fx, fy, S * (0.012 + rnd() * 0.008), rnd);
    }

    // ---- soil bed (the stage) ----
    const bed = PPG.bg.bed(W, H);
    soilBed(x, bed, S, rnd);

    // stones near the bed
    for (let i = 0; i < 7; i++) {
      const a = rnd() * U.TAU;
      const sx = bed.cx + Math.cos(a) * bed.rx * (1.06 + rnd() * 0.16);
      const sy = bed.cy + Math.sin(a) * bed.ry * (1.15 + rnd() * 0.3);
      stone(x, sx, sy, S * (0.010 + rnd() * 0.012), rnd);
    }

    // cute watering can on the grass
    wateringCan(x, 0.115 * W, 0.60 * H, S * 0.075);

    // soft vignette on the whole baked layer
    g = x.createRadialGradient(0.5 * W, 0.55 * H, 0.2 * S, 0.5 * W, 0.55 * H, 1.1 * Math.max(W, H));
    g.addColorStop(0, 'rgba(70,40,90,0)');
    g.addColorStop(1, 'rgba(70,40,90,0.14)');
    x.fillStyle = g;
    x.fillRect(-0.25 * W, -0.25 * H, 1.5 * W, 1.5 * H);
  }

  function cloud(x, cx, cy, r, rnd) {
    x.save();
    x.fillStyle = 'rgba(255,255,255,0.85)';
    const lobes = [[0, 0, 1], [-1.1, 0.25, 0.72], [1.1, 0.28, 0.78], [-0.5, -0.4, 0.6], [0.55, -0.35, 0.62]];
    for (const [ox, oy, s] of lobes) {
      x.beginPath();
      x.ellipse(cx + ox * r, cy + oy * r, r * s * (0.95 + rnd() * 0.15), r * s * 0.72, 0, 0, U.TAU);
      x.fill();
    }
    x.fillStyle = 'rgba(210,230,245,0.5)';
    x.beginPath();
    x.ellipse(cx, cy + r * 0.45, r * 1.6, r * 0.4, 0, 0, U.TAU);
    x.fill();
    x.restore();
  }

  function hill(x, W, H, baseY, amp, color) {
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(-0.25 * W, baseY + amp);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const hx = (-0.25 + 1.5 * t) * W;
      const hy = baseY - Math.sin(t * Math.PI * 2.2 + 0.6) * amp * 0.5 - Math.sin(t * Math.PI * 0.9) * amp * 0.5;
      x.lineTo(hx, hy);
    }
    x.lineTo(1.25 * W, baseY + 0.3 * H);
    x.lineTo(-0.25 * W, baseY + 0.3 * H);
    x.closePath();
    x.fill();
  }

  function tree(x, cx, cy, r, rnd) {
    x.fillStyle = 'hsla(28,35%,42%,0.9)';
    x.fillRect(cx - r * 0.10, cy - r * 0.15, r * 0.22, r * 0.9);
    const g = x.createRadialGradient(cx - r * 0.3, cy - r * 1.15, r * 0.1, cx, cy - r * 0.9, r * 1.15);
    g.addColorStop(0, 'hsla(130,40%,66%,0.95)');
    g.addColorStop(1, 'hsla(140,42%,48%,0.95)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy - r * 0.9, r, 0, U.TAU);
    x.arc(cx - r * 0.65, cy - r * 0.55, r * 0.6, 0, U.TAU);
    x.arc(cx + r * 0.65, cy - r * 0.55, r * 0.62, 0, U.TAU);
    x.fill();
  }

  function greenhouse(x, cx, baseY, s) {
    x.save();
    x.translate(cx, baseY);
    x.fillStyle = 'rgba(220,245,250,0.55)';
    x.strokeStyle = 'rgba(255,255,255,0.85)';
    x.lineWidth = s * 0.05;
    x.beginPath();
    x.rect(-s, -s * 0.75, 2 * s, s * 0.75);
    x.fill(); x.stroke();
    x.beginPath();
    x.moveTo(-s * 1.1, -s * 0.75);
    x.lineTo(0, -s * 1.45);
    x.lineTo(s * 1.1, -s * 0.75);
    x.closePath();
    x.fill(); x.stroke();
    x.beginPath();
    x.moveTo(0, -s * 1.42); x.lineTo(0, 0);
    x.moveTo(-s * 0.55, -s * 0.75); x.lineTo(-s * 0.55, 0);
    x.moveTo(s * 0.55, -s * 0.75); x.lineTo(s * 0.55, 0);
    x.stroke();
    x.restore();
  }

  function blob(x, cx, cy, r, color, rnd) {
    x.fillStyle = color;
    x.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * U.TAU;
      const rr = r * (0.85 + 0.2 * Math.sin(a * 3 + rnd() * 6));
      const px = cx + Math.cos(a) * rr * 1.25;
      const py = cy + Math.sin(a) * rr * 0.8;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
  }

  function path(x, W, H, rnd) {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push({
        x: (0.68 - 0.10 * Math.sin(t * 4.2)) * W - 0.02 * W * t,
        y: (1.22 - t * 0.70) * H
      });
    }
    x.save();
    x.lineCap = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1);
      const w = U.lerp(0.13 * W, 0.045 * W, t);
      x.strokeStyle = 'hsla(42,42%,74%,0.85)';
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(pts[i].x, pts[i].y);
      x.lineTo(pts[i + 1].x, pts[i + 1].y);
      x.stroke();
    }
    // pebbles in the path
    for (let i = 0; i < 46; i++) {
      const t = rnd();
      const p = pts[Math.floor(t * (pts.length - 1))];
      const w = U.lerp(0.11 * W, 0.04 * W, t);
      x.fillStyle = rnd() < 0.5 ? 'hsla(40,35%,66%,0.7)' : 'hsla(44,45%,82%,0.8)';
      x.beginPath();
      x.ellipse(p.x + (rnd() - 0.5) * w, p.y + (rnd() - 0.5) * 14, 2.4 + rnd() * 2.6, 1.7 + rnd() * 1.8, rnd() * 3, 0, U.TAU);
      x.fill();
    }
    x.restore();
  }

  function fence(x, W, H, S, rnd) {
    const y = 0.495 * H;
    const postH = 0.062 * S + 14, postW = Math.max(7, 0.016 * S);
    x.save();
    // rails
    for (const ry of [y - postH * 0.62, y - postH * 0.24]) {
      x.fillStyle = 'hsla(30,42%,58%,1)';
      rr(x, -0.25 * W, ry - postW * 0.26, 1.5 * W, postW * 0.52, postW * 0.26);
      x.fillStyle = 'hsla(32,50%,68%,0.5)';
      rr(x, -0.25 * W, ry - postW * 0.26, 1.5 * W, postW * 0.18, postW * 0.09);
    }
    // posts
    const step = 0.075 * W + 18;
    for (let px = -0.22 * W; px < 1.28 * W; px += step) {
      const wob = (rnd() - 0.5) * 3;
      x.fillStyle = 'hsla(28,44%,54%,1)';
      rr(x, px + wob - postW / 2, y - postH, postW, postH, postW * 0.45);
      x.fillStyle = 'hsla(30,52%,66%,0.55)';
      rr(x, px + wob - postW / 2 + 1.5, y - postH + 2, postW * 0.32, postH - 6, postW * 0.2);
      // round cap
      x.fillStyle = 'hsla(28,40%,48%,1)';
      x.beginPath();
      x.arc(px + wob, y - postH, postW * 0.52, Math.PI, 0);
      x.fill();
    }
    x.restore();
  }

  function rr(x, px, py, w, h, r) {
    x.beginPath();
    if (x.roundRect) { x.roundRect(px, py, w, h, r); }
    else { x.rect(px, py, w, h); }
    x.fill();
  }

  function miniFlower(x, fx, fy, r, rnd) {
    const hue = [335, 268, 45, 200][Math.floor(rnd() * 4)];
    x.strokeStyle = 'hsla(115,40%,38%,0.9)';
    x.lineWidth = r * 0.32;
    x.beginPath();
    x.moveTo(fx, fy + r * 2.6);
    x.quadraticCurveTo(fx + (rnd() - 0.5) * r, fy + r * 1.2, fx, fy);
    x.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * U.TAU + rnd();
      x.fillStyle = U.hsla(hue, 70, 74, 0.95);
      x.beginPath();
      x.ellipse(fx + Math.cos(a) * r * 0.85, fy + Math.sin(a) * r * 0.85, r * 0.62, r * 0.45, a, 0, U.TAU);
      x.fill();
    }
    x.fillStyle = 'hsla(48,90%,68%,1)';
    x.beginPath();
    x.arc(fx, fy, r * 0.42, 0, U.TAU);
    x.fill();
  }

  function soilBed(x, bed, S, rnd) {
    const { cx, cy, rx, ry } = bed;
    // wobbly organic ellipse
    const edge = (a) => 1 + 0.05 * Math.sin(a * 3 + 1.2) + 0.04 * Math.sin(a * 5 + 4);
    // shadow under bed
    x.fillStyle = 'rgba(40,60,30,0.25)';
    x.beginPath();
    x.ellipse(cx, cy + ry * 0.28, rx * 1.04, ry * 1.06, 0, 0, U.TAU);
    x.fill();

    let g = x.createRadialGradient(cx, cy - ry * 0.3, ry * 0.2, cx, cy, Math.max(rx, ry) * 1.05);
    g.addColorStop(0, 'hsla(26,42%,40%,1)');
    g.addColorStop(0.7, 'hsla(24,44%,33%,1)');
    g.addColorStop(1, 'hsla(22,46%,27%,1)');
    x.fillStyle = g;
    bedPath(x, cx, cy, rx, ry, edge);
    x.fill();

    // inner rim (soft raised edge)
    x.strokeStyle = 'hsla(28,40%,48%,0.55)';
    x.lineWidth = Math.max(4, S * 0.012);
    bedPath(x, cx, cy, rx * 0.97, ry * 0.94, edge);
    x.stroke();

    // soil speckles
    for (let i = 0; i < 260; i++) {
      const a = rnd() * U.TAU, rr2 = Math.sqrt(rnd());
      const px = cx + Math.cos(a) * rx * 0.94 * rr2;
      const py = cy + Math.sin(a) * ry * 0.9 * rr2;
      const light = rnd() < 0.4;
      x.fillStyle = light ? 'hsla(30,45%,52%,0.4)' : 'hsla(20,50%,20%,0.4)';
      x.beginPath();
      x.ellipse(px, py, 1 + rnd() * 2.2, 0.7 + rnd() * 1.4, rnd() * 3, 0, U.TAU);
      x.fill();
    }
    // tiny sprouts of moss at the rim
    for (let i = 0; i < 26; i++) {
      const a = rnd() * U.TAU;
      const px = cx + Math.cos(a) * rx * (0.99 + rnd() * 0.05);
      const py = cy + Math.sin(a) * ry * (1.0 + rnd() * 0.08);
      x.fillStyle = 'hsla(110,45%,45%,0.8)';
      x.beginPath();
      x.arc(px, py, 1.6 + rnd() * 1.8, 0, U.TAU);
      x.fill();
    }
  }

  function bedPath(x, cx, cy, rx, ry, edge) {
    x.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * U.TAU;
      const e = edge(a);
      const px = cx + Math.cos(a) * rx * e;
      const py = cy + Math.sin(a) * ry * e;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.closePath();
  }

  function stone(x, cx, cy, r, rnd) {
    const g = x.createRadialGradient(cx - r * 0.4, cy - r * 0.5, r * 0.1, cx, cy, r * 1.4);
    g.addColorStop(0, 'hsla(210,10%,82%,1)');
    g.addColorStop(1, 'hsla(215,12%,58%,1)');
    x.fillStyle = 'rgba(30,50,25,0.3)';
    x.beginPath();
    x.ellipse(cx + r * 0.15, cy + r * 0.4, r * 1.1, r * 0.5, 0, 0, U.TAU);
    x.fill();
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(cx, cy, r * (1 + rnd() * 0.3), r * 0.75, rnd() * 0.8 - 0.4, 0, U.TAU);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.4)';
    x.beginPath();
    x.ellipse(cx - r * 0.35, cy - r * 0.3, r * 0.3, r * 0.16, -0.5, 0, U.TAU);
    x.fill();
  }

  function wateringCan(x, cx, cy, s) {
    x.save();
    x.translate(cx, cy);
    // shadow
    x.fillStyle = 'rgba(30,50,25,0.28)';
    x.beginPath();
    x.ellipse(0, s * 0.52, s * 0.85, s * 0.2, 0, 0, U.TAU);
    x.fill();
    const g = x.createLinearGradient(-s * 0.6, -s * 0.5, s * 0.6, s * 0.5);
    g.addColorStop(0, 'hsla(185,45%,72%,1)');
    g.addColorStop(0.5, 'hsla(185,40%,60%,1)');
    g.addColorStop(1, 'hsla(190,42%,48%,1)');
    // body
    x.fillStyle = g;
    rr(x, -s * 0.52, -s * 0.34, s * 1.04, s * 0.88, s * 0.16);
    // spout
    x.strokeStyle = 'hsla(188,40%,55%,1)';
    x.lineWidth = s * 0.17;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-s * 0.5, s * 0.05);
    x.quadraticCurveTo(-s * 1.05, -s * 0.15, -s * 1.12, -s * 0.52);
    x.stroke();
    // rose (sprinkler head)
    x.fillStyle = 'hsla(190,40%,58%,1)';
    x.beginPath();
    x.ellipse(-s * 1.14, -s * 0.55, s * 0.17, s * 0.12, -0.7, 0, U.TAU);
    x.fill();
    // handle
    x.strokeStyle = 'hsla(188,38%,52%,1)';
    x.lineWidth = s * 0.13;
    x.beginPath();
    x.arc(s * 0.1, -s * 0.42, s * 0.42, Math.PI * 1.05, Math.PI * 1.98);
    x.stroke();
    // shine
    x.fillStyle = 'rgba(255,255,255,0.45)';
    rr(x, -s * 0.36, -s * 0.24, s * 0.14, s * 0.6, s * 0.07);
    // little heart
    x.fillStyle = 'rgba(255,180,205,0.95)';
    heart(x, s * 0.12, s * 0.1, s * 0.16);
    x.restore();
  }

  function heart(x, cx, cy, s) {
    x.beginPath();
    x.moveTo(cx, cy + s * 0.6);
    x.bezierCurveTo(cx - s * 1.1, cy - s * 0.2, cx - s * 0.5, cy - s * 0.9, cx, cy - s * 0.3);
    x.bezierCurveTo(cx + s * 0.5, cy - s * 0.9, cx + s * 1.1, cy - s * 0.2, cx, cy + s * 0.6);
    x.fill();
  }

  PPG.bg = bg;
})(window.PPG);
