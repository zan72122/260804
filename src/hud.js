/* =========================================================
   hud.js — 3Dの上に重ねる2DのHUD（文字なし）
   丸ボタン・ゴーストハンド・工程インジケータのみ。
   世界の見た目は3D側が担当し、ここは操作の合図だけを描く。
   ========================================================= */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function star(ctx, x, y, R, r, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rr = i % 2 ? r : R;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export const HUD = {};

HUD.button = function (ctx, b, time) {
  if (b.hidden) return;
  const pulse = b.pulse ? 1 + Math.sin(time * 3.4) * 0.05 : 1;
  const r = b.r * pulse * (b.press ? 0.93 : 1);
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.pulse) {
    const k = (time * 0.9) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${(0.40 * (1 - k)).toFixed(3)})`;
    ctx.lineWidth = Math.max(3, r * 0.07);
    ctx.beginPath(); ctx.arc(0, 0, r * (1 + k * 0.30), 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(30,16,6,0.34)';
  ctx.beginPath(); ctx.arc(0, r * 0.12, r * 1.02, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, -r, 0, r);
  const c = b.color || ['#fdf3e2', '#efd9b8'];
  g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = b.ring || 'rgba(198,120,70,0.9)';
  ctx.lineWidth = Math.max(3, r * 0.085);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.96, 0, TAU); ctx.stroke();
  ctx.save();
  ctx.scale(r / 50, r / 50);
  HUD.icon(ctx, b.icon, time, b);
  ctx.restore();
  ctx.restore();
};

HUD.hit = function (b, x, y, slop) {
  if (!b || b.hidden) return false;
  return Math.hypot(b.x - x, b.y - y) <= b.r * (b.hitScale || 1.4) + (slop || 0);
};

function drawBaguetteIcon(ctx, L, R, cuts) {
  const g = ctx.createLinearGradient(0, -R, 0, R);
  g.addColorStop(0, '#e7c58c'); g.addColorStop(0.45, '#cd9a52'); g.addColorStop(1, '#9d6a30');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const u = -1 + i / 20;
    const p = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 5)), 0.28);
    ctx.lineTo(u * L, -R * p);
  }
  for (let i = 40; i >= 0; i--) {
    const u = -1 + i / 20;
    const p = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 5)), 0.28);
    ctx.lineTo(u * L, R * p);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#f7e6c2'; ctx.lineWidth = R * 0.42; ctx.lineCap = 'round';
  for (let i = 0; i < cuts; i++) {
    const cx = -L * 0.56 + (L * 1.12 * i) / Math.max(1, cuts - 1);
    ctx.beginPath();
    ctx.moveTo(cx - L * 0.11, R * 0.42); ctx.lineTo(cx + L * 0.11, -R * 0.42);
    ctx.stroke();
  }
}

function drawLameIcon(ctx, s) {
  ctx.save();
  ctx.scale(s, s);
  ctx.rotate(0.55);
  const g = ctx.createLinearGradient(-8, 0, 8, 0);
  g.addColorStop(0, '#8f5f2e'); g.addColorStop(0.45, '#c9903f'); g.addColorStop(1, '#7d5228');
  ctx.fillStyle = g;
  roundRect(ctx, -8, -6, 16, 52, 8); ctx.fill();
  ctx.fillStyle = '#c8ced4';
  roundRect(ctx, -7, -12, 14, 8, 3); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-5, -12); ctx.quadraticCurveTo(-2, -34, 1, -42);
  ctx.quadraticCurveTo(5, -32, 5, -12); ctx.closePath();
  const bg = ctx.createLinearGradient(-5, -40, 6, -12);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.55, '#d5dce3'); bg.addColorStop(1, '#98a4ae');
  ctx.fillStyle = bg; ctx.fill();
  ctx.restore();
}

HUD.icon = function (ctx, name, time, b) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (name) {
    case 'home':
      ctx.fillStyle = '#b45c42';
      ctx.beginPath();
      ctx.moveTo(0, -26); ctx.lineTo(28, 0); ctx.lineTo(20, 0);
      ctx.lineTo(20, 26); ctx.lineTo(-20, 26); ctx.lineTo(-20, 0);
      ctx.lineTo(-28, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff4e4';
      roundRect(ctx, -8, 6, 16, 20, 3); ctx.fill();
      break;
    case 'sound':
    case 'mute':
      ctx.fillStyle = '#b45c42';
      ctx.beginPath();
      ctx.moveTo(-20, -8); ctx.lineTo(-8, -8); ctx.lineTo(4, -22);
      ctx.lineTo(4, 22); ctx.lineTo(-8, 8); ctx.lineTo(-20, 8);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#b45c42'; ctx.lineWidth = 5;
      if (name === 'sound') {
        ctx.beginPath(); ctx.arc(6, 0, 13, -0.9, 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(6, 0, 22, -0.9, 0.9); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(12, -12); ctx.lineTo(28, 12);
        ctx.moveTo(28, -12); ctx.lineTo(12, 12);
        ctx.stroke();
      }
      break;
    case 'arrowR': {
      const k = Math.sin(time * 4) * 3;
      ctx.fillStyle = '#d96f2f';
      ctx.save(); ctx.translate(k, 0);
      ctx.beginPath();
      ctx.moveTo(-18, -10); ctx.lineTo(6, -10); ctx.lineTo(6, -22);
      ctx.lineTo(28, 0); ctx.lineTo(6, 22); ctx.lineTo(6, 10);
      ctx.lineTo(-18, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }
    case 'oven': {
      ctx.fillStyle = '#6d4a38';
      roundRect(ctx, -28, -26, 56, 52, 7); ctx.fill();
      const g = ctx.createRadialGradient(0, 8, 2, 0, 8, 26);
      g.addColorStop(0, '#ffd071'); g.addColorStop(0.6, '#f08a24'); g.addColorStop(1, '#c9540f');
      ctx.fillStyle = g;
      roundRect(ctx, -20, -12, 40, 32, 5); ctx.fill();
      ctx.fillStyle = '#4e352a';
      roundRect(ctx, -23, -24, 46, 9, 4); ctx.fill();
      break;
    }
    case 'steam': {
      ctx.strokeStyle = '#7cb3d6'; ctx.lineWidth = 7;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        const ph = time * 2.6 + i;
        for (let j = 0; j <= 10; j++) {
          const y = 22 - j * 4.6;
          const x = i * 15 + Math.sin(ph + j * 0.7) * 5;
          j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'baguette': drawBaguetteIcon(ctx, 34, 8, 4); break;
    case 'petite': drawBaguetteIcon(ctx, 23, 6, 3); break;
    case 'batard': drawBaguetteIcon(ctx, 22, 13, 3); break;
    case 'three': {
      ctx.save(); ctx.translate(-2, -17); ctx.rotate(-0.10); ctx.scale(0.62, 0.62); drawBaguetteIcon(ctx, 23, 6, 3); ctx.restore();
      ctx.save(); ctx.translate(0, 2); ctx.rotate(0.04); ctx.scale(0.62, 0.62); drawBaguetteIcon(ctx, 34, 8, 4); ctx.restore();
      ctx.save(); ctx.translate(2, 21); ctx.rotate(0.14); ctx.scale(0.62, 0.62); drawBaguetteIcon(ctx, 22, 13, 3); ctx.restore();
      break;
    }
    case 'lame': drawLameIcon(ctx, 0.62); break;
    case 'sparkleLame': {
      ctx.save(); ctx.translate(-5, 3); drawLameIcon(ctx, 0.55); ctx.restore();
      ctx.fillStyle = '#ffd24d';
      star(ctx, 21, -17, 12, 5, 4, time * 2); ctx.fill();
      star(ctx, -20, -23, 7, 3, 4, -time * 2); ctx.fill();
      break;
    }
  }
  if (b && b.badge) HUD.badge(ctx, b.badge);
};

HUD.badge = function (ctx, n) {
  ctx.save();
  ctx.translate(31, -31);
  ctx.fillStyle = '#d94f45';
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.9;
    ctx.beginPath(); ctx.arc(Math.cos(a) * 7, Math.sin(a) * 7 + 3, 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
};

HUD.hand = function (ctx, x, y, s, rot, alpha) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.fillStyle = '#ffe7d2';
  ctx.strokeStyle = 'rgba(120,74,44,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, 40);
  ctx.quadraticCurveTo(-22, 16, -16, 2);
  ctx.quadraticCurveTo(-12, -6, -6, -2);
  ctx.lineTo(-6, -26);
  ctx.quadraticCurveTo(-6, -34, 0, -34);
  ctx.quadraticCurveTo(6, -34, 6, -26);
  ctx.lineTo(6, -4);
  ctx.quadraticCurveTo(14, -8, 18, 0);
  ctx.quadraticCurveTo(24, 14, 20, 40);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
};

HUD.hintTap = function (ctx, x, y, time, s) {
  const k = (time * 1.15) % 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `rgba(255,255,255,${(0.8 * (1 - k)).toFixed(3)})`;
  ctx.lineWidth = 5 * s;
  ctx.beginPath(); ctx.arc(0, 0, (18 + k * 44) * s, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(226,120,70,${(0.6 * (1 - k)).toFixed(3)})`;
  ctx.beginPath(); ctx.arc(0, 0, (12 + k * 30) * s, 0, TAU); ctx.stroke();
  const press = Math.sin(time * 3.6) * 0.5 + 0.5;
  HUD.hand(ctx, 6 * s, (16 + press * 8) * s, 0.72 * s, 0.15, 0.9);
  ctx.restore();
};

HUD.hintSwipe = function (ctx, x0, y0, x1, y1, time, s) {
  const k = (time * 0.62) % 1;
  const ke = smooth(range(k, 0.06, 0.86));
  const x = x0 + (x1 - x0) * ke, y = y0 + (y1 - y0) * ke;
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.save();
  ctx.setLineDash([12 * s, 10 * s]);
  ctx.lineDashOffset = -time * 40 * s;
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.lineWidth = 7 * s;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.translate(x1, y1); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.moveTo(2 * s, 0); ctx.lineTo(-16 * s, -12 * s); ctx.lineTo(-11 * s, 0); ctx.lineTo(-16 * s, 12 * s);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  const fade = smooth(range(k, 0, 0.10)) * (1 - smooth(range(k, 0.88, 1)));
  HUD.hand(ctx, x, y + 10 * s, 0.78 * s, 0.12, 0.9 * fade);
  ctx.restore();
};

HUD.steps = function (ctx, W, H, idx, total) {
  const r = Math.max(4, Math.min(W, H) * 0.0082);
  const gap = r * 3.0;
  const w = gap * (total - 1);
  const x0 = W / 2 - w / 2;
  const y = H - Math.max(16, H * 0.024);
  ctx.save();
  ctx.fillStyle = 'rgba(24,14,6,0.36)';
  roundRect(ctx, x0 - r * 2.4, y - r * 2.2, w + r * 4.8, r * 4.4, r * 2.2);
  ctx.fill();
  for (let i = 0; i < total; i++) {
    const x = x0 + gap * i;
    ctx.fillStyle = i <= idx ? 'rgba(246,182,102,0.98)' : 'rgba(255,244,226,0.28)';
    ctx.beginPath(); ctx.arc(x, y, i === idx ? r * 1.5 : r, 0, TAU); ctx.fill();
    if (i === idx) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = Math.max(2, r * 0.4);
      ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
};

/* 指の生の軌跡（クープ中） */
HUD.trail = function (ctx, pts, mn) {
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const w = mn * 0.012;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = w * 2.0;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,238,196,0.95)';
  ctx.lineWidth = w * 0.8;
  ctx.stroke();
  ctx.restore();
};

HUD.celebrate = function (ctx, W, H, t) {
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const a = ((i * 9301 + 49297) % 233280) / 233280;
    const b = ((i * 4021 + 7919) % 104729) / 104729;
    const x = a * W;
    const y = ((t * 130 * (0.5 + b) + b * H) % (H + 60)) - 30;
    const r = 5 + b * 9;
    const hue = [38, 24, 44, 12, 50][i % 5];
    ctx.fillStyle = `hsla(${hue},92%,72%,0.9)`;
    star(ctx, x, y, r, r * 0.42, 5, t * 2 + i);
    ctx.fill();
  }
  ctx.restore();
};
