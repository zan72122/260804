// Procedural canvas textures: concrete, stone tiles, metal, stains, sprites.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function noise(ctx, w, h, alpha, n = 2500) {
  for (let i = 0; i < n; i++) {
    const g = Math.floor(Math.random() * 255);
    ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

// Worn concrete wall — greenish grey, stains, streaks.
export function concreteTex(base = '#5a6060', w = 512) {
  const c = canvas(w, w), ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, w);
  noise(ctx, w, w, 0.05, 6000);
  // big soft blotches
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * w, y = Math.random() * w, r = 30 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = Math.random() < 0.6;
    g.addColorStop(0, dark ? 'rgba(30,36,34,0.16)' : 'rgba(190,195,185,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  // drip streaks from top area
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * w, y0 = Math.random() * w * 0.5, len = 40 + Math.random() * 160;
    const g = ctx.createLinearGradient(x, y0, x, y0 + len);
    g.addColorStop(0, 'rgba(25,30,28,0.22)');
    g.addColorStop(1, 'rgba(25,30,28,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 2 - Math.random() * 3, y0, 4 + Math.random() * 6, len);
  }
  return tex(c);
}

// Stone tile floor for the plaza.
export function tileTex(w = 512, tile = 64, colA = '#8b8578', colB = '#7a745f') {
  const c = canvas(w, w), ctx = c.getContext('2d');
  for (let y = 0; y < w / tile; y++) {
    for (let x = 0; x < w / tile; x++) {
      const m = (x + y) % 2 === 0;
      ctx.fillStyle = m ? colA : colB;
      const j = () => (Math.random() - 0.5) * 12;
      ctx.fillStyle = shade(m ? colA : colB, j());
      ctx.fillRect(x * tile, y * tile, tile, tile);
      ctx.strokeStyle = 'rgba(35,32,26,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x * tile + 1, y * tile + 1, tile - 2, tile - 2);
    }
  }
  noise(ctx, w, w, 0.05, 7000);
  // weathering blotches
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * w, y = Math.random() * w, r = 20 + Math.random() * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(40,42,36,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  return tex(c);
}

function shade(hex, d) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + d));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + d));
  const b = Math.max(0, Math.min(255, (n & 255) + d));
  return `rgb(${r},${g},${b})`;
}

// Brushed / worn metal for pipes.
export function metalTex(base = '#7d8388', w = 256) {
  const c = canvas(w, w), ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, w);
  for (let i = 0; i < 220; i++) {
    const y = Math.random() * w;
    ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '20,25,30'},${0.03 + Math.random() * 0.05})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + (Math.random() - 0.5) * 6); ctx.stroke();
  }
  // rust patches
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * w, y = Math.random() * w, r = 8 + Math.random() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(122,72,40,0.30)');
    g.addColorStop(0.6, 'rgba(96,58,34,0.14)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  return tex(c);
}

// Soft round particle sprite (white core → transparent).
export function dotSprite(w = 64, core = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.45)') {
  const c = canvas(w, w), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, core);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
  return tex(c, 1, false);
}

// Radial glow decal for wet-ground light pools.
export function glowSprite(w = 128) {
  return dotSprite(w, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0.25)');
}

// Soft ring texture (for expanding water rings on the pool surface).
export function ringSprite(w = 128) {
  const c = canvas(w, w), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(w / 2, w / 2, w * 0.30, w / 2, w / 2, w * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, w);
  return tex(c, 1, false);
}

// Shimmering caustics-ish overlay for the pool.
export function causticsTex(w = 256) {
  const c = canvas(w, w), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0, 0, w, w);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w, y = Math.random() * w, r = 6 + Math.random() * 22;
    ctx.strokeStyle = `rgba(180,230,255,${0.05 + Math.random() * 0.10})`;
    ctx.lineWidth = 1.5 + Math.random() * 2;
    ctx.beginPath(); ctx.arc(x, y, r, Math.random() * 6, Math.random() * 3 + 2); ctx.stroke();
  }
  return tex(c, 2, false);
}
