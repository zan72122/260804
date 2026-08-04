// Shared visual helpers: room background, wordless hint hand, small props.
import { mk, rr, lerp, ease, clamp, TAU, mulberry32 } from './util.js';

export const hint = { idle: 0 };

// ---------- room background (cached per size/variant) ----------
let roomCache = { key: '', c: null };
export function roomBg(ctx, L, variant = '') {
  const key = L.W + 'x' + L.H + variant;
  if (roomCache.key !== key) {
    const c = mk(L.W, L.H);
    paintRoom(c.getContext('2d'), L, variant);
    roomCache = { key, c };
  }
  ctx.drawImage(roomCache.c, 0, 0);
}

function paintRoom(g, L, variant) {
  const { W, H } = L;
  const R = mulberry32(99);
  const wg = g.createLinearGradient(0, 0, 0, H);
  wg.addColorStop(0, '#ddd2ba');
  wg.addColorStop(0.55, '#d0c2a8');
  wg.addColorStop(1, '#b9a888');
  g.fillStyle = wg;
  g.fillRect(0, 0, W, H);
  // warm lamp pool
  const lg = g.createRadialGradient(W * 0.5, H * 0.08, 10, W * 0.5, H * 0.08, H * 0.75);
  lg.addColorStop(0, 'rgba(255,244,214,0.45)');
  lg.addColorStop(1, 'rgba(255,244,214,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, W, H);

  if (variant === 'window') {
    // tall warm window, light rays (higher & smaller in portrait so the
    // drying sheet doesn't cut across it)
    const portrait = H >= W;
    const wx = W * (portrait ? 0.66 : 0.62), wy = H * (portrait ? 0.025 : 0.06);
    const ww = W * (portrait ? 0.26 : 0.30), wh = H * (portrait ? 0.20 : 0.42);
    g.fillStyle = '#8a6f50';
    rr(g, wx - 8, wy - 8, ww + 16, wh + 16, 14); g.fill();
    const sky = g.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, '#ffeec9');
    sky.addColorStop(1, '#ffd9a0');
    g.fillStyle = sky;
    rr(g, wx, wy, ww, wh, 8); g.fill();
    g.strokeStyle = '#8a6f50'; g.lineWidth = 6;
    g.beginPath();
    g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh);
    g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2);
    g.stroke();
    g.fillStyle = 'rgba(255,235,190,0.20)';
    g.beginPath();
    g.moveTo(wx, wy + wh);
    g.lineTo(wx - W * 0.2, H);
    g.lineTo(wx + ww * 0.7, H);
    g.lineTo(wx + ww, wy + wh);
    g.closePath();
    g.fill();
  }

  // shelf with jars & brushes (skip on very narrow screens)
  if (W > 500 || H > W) {
    const sy = H * 0.10, sx = W * 0.04, sw = Math.min(W * 0.30, 240);
    g.fillStyle = '#8a6f50';
    rr(g, sx, sy + 54, sw, 10, 4); g.fill();
    for (let i = 0; i < 3; i++) {
      const jx = sx + 20 + i * (sw / 3.2), jw = sw / 4.6, jh = 46;
      g.fillStyle = 'rgba(210,225,225,0.55)';
      rr(g, jx, sy + 54 - jh, jw, jh, 6); g.fill();
      g.strokeStyle = 'rgba(120,130,130,0.5)'; g.lineWidth = 1.5;
      rr(g, jx, sy + 54 - jh, jw, jh, 6); g.stroke();
      // brushes / tools sticking out
      g.strokeStyle = i === 1 ? '#a3763f' : '#6b4f2f';
      g.lineWidth = 3.5;
      for (let b = 0; b < 2 + i % 2; b++) {
        g.beginPath();
        g.moveTo(jx + 6 + b * 7, sy + 54 - jh + 8);
        g.lineTo(jx + 4 + b * 8, sy + 54 - jh - 14 - b * 5);
        g.stroke();
      }
    }
  }

  // work bench
  const by = H * 0.865;
  const bg2 = g.createLinearGradient(0, by, 0, H);
  bg2.addColorStop(0, '#a07c50');
  bg2.addColorStop(1, '#7a5c3a');
  g.fillStyle = bg2;
  g.fillRect(0, by, W, H - by);
  g.fillStyle = 'rgba(60,40,20,0.28)';
  g.fillRect(0, by, W, 4);
  g.strokeStyle = 'rgba(70,48,25,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const yy = by + 12 + R() * (H - by - 16);
    g.beginPath();
    g.moveTo(0, yy);
    g.bezierCurveTo(W * 0.3, yy + (R() - 0.5) * 8, W * 0.7, yy + (R() - 0.5) * 8, W, yy);
    g.stroke();
  }
  // vignette
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(50,35,20,0.20)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
}

// ---------- wordless hint hand ----------
export function drawHand(ctx, x, y, s = 1, alpha = 1, press = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  if (press > 0) {
    ctx.strokeStyle = 'rgba(255,250,235,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -34, 10 + press * 26, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = '#f7e8d6';
  ctx.strokeStyle = 'rgba(90,60,40,0.85)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-7, -6);
  ctx.lineTo(-7, -27);
  ctx.arcTo(-7, -34, 0, -34, 7);
  ctx.arcTo(7, -34, 7, -27, 7);
  ctx.lineTo(7, -6);
  ctx.arc(4, 8, 15, -0.35, 2.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// kind: 'tap' | 'drag' | 'swipe' | 'stroke'
export function hintGesture(ctx, kind, ax, ay, bx, by, time) {
  const tt = (time % 1.7) / 1.7;
  if (kind === 'tap') {
    const pulse = 1 + 0.08 * Math.sin(time * 6);
    const press = tt < 0.3 ? tt / 0.3 : 0;
    drawHand(ctx, ax, ay + 26, pulse, 0.9, press);
    return;
  }
  const e = ease(clamp(tt * 1.25, 0, 1));
  let x = lerp(ax, bx, e), y = lerp(ay, by, e);
  if (kind === 'stroke') {
    // wavy back-and-forth
    const w = Math.sin(tt * TAU * 1.5);
    x = lerp(ax, bx, 0.5 + 0.5 * w * (1 - tt * 0.3));
    y = lerp(ay, by, tt);
  }
  // ghost path
  ctx.save();
  ctx.strokeStyle = 'rgba(255,250,235,0.55)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.setLineDash([2, 16]);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  drawHand(ctx, x, y + 26, 1, 0.9 * (1 - Math.max(0, tt - 0.85) / 0.15), 0.6);
}

// soft attention glow ring
export function glowRing(ctx, x, y, r, time, col = '255,235,170') {
  const p = (time % 1.4) / 1.4;
  ctx.save();
  ctx.strokeStyle = `rgba(${col},${0.55 * (1 - p)})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r * (0.8 + p * 0.5), 0, TAU);
  ctx.stroke();
  ctx.restore();
}

// weave cloth pattern (support cloth / felt)
export function drawCloth(ctx, x, y, w, h, col = '#f2dfe4', alpha = 0.85, r = 10) {
  ctx.save();
  ctx.globalAlpha = alpha;
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(160,120,130,0.25)';
  ctx.lineWidth = 1.2;
  const st = Math.max(6, w / 26);
  for (let i = -h; i < w + h; i += st) {
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + h, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + i + h, y); ctx.lineTo(x + i, y + h); ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(150,110,120,0.5)';
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();
}

export function drawFelt(ctx, x, y, w, h, col = '#e9c9cf', r = 12) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  const R = mulberry32(5);
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    ctx.arc(x + R() * w, y + R() * h, 1 + R() * 2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(150,100,110,0.45)';
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
}

// mesh screen pattern inside a rect (assumes caller clips)
export function drawMesh(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(110,125,135,0.30)';
  ctx.lineWidth = 1;
  const st = Math.max(6, w / 42);
  for (let i = 0; i <= w; i += st) {
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); ctx.stroke();
  }
  for (let j = 0; j <= h; j += st) {
    ctx.beginPath(); ctx.moveTo(x, y + j); ctx.lineTo(x + w, y + j); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(110,125,135,0.45)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i <= w; i += st * 4) {
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); ctx.stroke();
  }
  ctx.restore();
}
