// Every texture in the game is generated procedurally on a 2D canvas, so the
// build stays a single self-contained folder with no binary assets.
import * as THREE from 'three';
import { makeRng } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function finish(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------------ *
 *  Tuna skin — near-white base so the vertex colours drive the hue.
 *  Adds the fine lateral striation and pearly speckle of a fresh fish.
 * ------------------------------------------------------------------ */
export function skinTexture() {
  const W = 512, H = 256;
  const c = canvas(W, H), g = c.getContext('2d');
  const rng = makeRng(9137);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, W, H);

  // long lateral streaks (the fish reads as "brushed" along its length)
  for (let i = 0; i < 260; i++) {
    const y = rng() * H;
    const len = 40 + rng() * 300;
    const x = rng() * W;
    const v = 190 + rng() * 65;
    g.strokeStyle = `rgba(${v},${v},${v},${0.10 + rng() * 0.22})`;
    g.lineWidth = 0.6 + rng() * 2.4;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + len * 0.33, y + (rng() - 0.5) * 5, x + len * 0.66, y + (rng() - 0.5) * 5, x + len, y + (rng() - 0.5) * 3);
    g.stroke();
  }
  // pearl speckle
  for (let i = 0; i < 2600; i++) {
    const v = rng() < 0.5 ? 255 : 165;
    g.fillStyle = `rgba(${v},${v},${v},${0.05 + rng() * 0.13})`;
    g.beginPath();
    g.arc(rng() * W, rng() * H, 0.5 + rng() * 1.9, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c, { repeat: [1, 1] });
}

/* ------------------------------------------------------------------ *
 *  Flesh marbling (sujime). Light streaks = fat lines. Multiplied by
 *  the akami/chutoro/otoro vertex gradient.
 * ------------------------------------------------------------------ */
export function fleshTexture() {
  const W = 512, H = 512;
  const c = canvas(W, H), g = c.getContext('2d');
  const rng = makeRng(4471);
  g.fillStyle = '#b9b0ae'; g.fillRect(0, 0, W, H);

  // broad soft tonal drift
  for (let i = 0; i < 40; i++) {
    const x = rng() * W, y = rng() * H, r = 60 + rng() * 200;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const v = rng() < 0.5 ? 'rgba(255,240,238,0.16)' : 'rgba(120,96,96,0.13)';
    grd.addColorStop(0, v); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // sujime: fine fat lines fanning across the cut face
  for (let i = 0; i < 220; i++) {
    const y0 = rng() * H;
    const x0 = -40 + rng() * (W + 80);
    const len = 90 + rng() * 340;
    const bow = (rng() - 0.5) * 90;
    const a = 0.10 + rng() * 0.42;
    g.strokeStyle = `rgba(255,238,232,${a})`;
    g.lineWidth = 0.7 + rng() * 3.2;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(x0 + len * 0.5, y0 + bow, x0 + len, y0 + bow * 0.3);
    g.stroke();
  }
  // very fine grain
  for (let i = 0; i < 5200; i++) {
    const v = rng() < 0.55 ? 255 : 130;
    g.fillStyle = `rgba(${v},${v - 12},${v - 14},${0.03 + rng() * 0.09})`;
    g.fillRect(rng() * W, rng() * H, 1 + rng() * 3, 0.8 + rng() * 1.4);
  }
  return finish(c, { repeat: [1, 1] });
}

/* ------------------------------------------------------------------ *
 *  Worn hinoki work-table top: wet, scored by years of knife work.
 * ------------------------------------------------------------------ */
export function woodTexture(seed = 12, base = '#c8a877', dark = '#8d6f45') {
  const W = 1024, H = 512;
  const c = canvas(W, H), g = c.getContext('2d');
  const rng = makeRng(seed);
  g.fillStyle = base; g.fillRect(0, 0, W, H);

  // grain
  for (let i = 0; i < 420; i++) {
    const y = rng() * H;
    const amp = 3 + rng() * 16;
    g.strokeStyle = rng() < 0.5
      ? `rgba(120,92,58,${0.05 + rng() * 0.20})`
      : `rgba(232,208,172,${0.05 + rng() * 0.18})`;
    g.lineWidth = 0.6 + rng() * 3.4;
    g.beginPath();
    g.moveTo(-10, y);
    for (let x = 0; x <= W + 10; x += 32) g.lineTo(x, y + Math.sin(x * 0.011 + i) * amp);
    g.stroke();
  }
  // knots
  for (let i = 0; i < 5; i++) {
    const x = rng() * W, y = rng() * H;
    for (let r = 2; r < 26; r += 2.2) {
      g.strokeStyle = `rgba(110,80,48,${0.30 - r * 0.009})`;
      g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(x, y, r, r * 0.5, rng() * 0.6, 0, Math.PI * 2); g.stroke();
    }
  }
  // knife scoring + wet patches (wear + dirt)
  for (let i = 0; i < 130; i++) {
    g.strokeStyle = `rgba(96,74,50,${0.06 + rng() * 0.20})`;
    g.lineWidth = 0.5 + rng() * 1.5;
    const x = rng() * W, y = rng() * H, l = 20 + rng() * 190, ang = (rng() - 0.5) * 0.55;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
  }
  for (let i = 0; i < 26; i++) {
    const x = rng() * W, y = rng() * H, r = 20 + rng() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(74,58,38,${0.10 + rng() * 0.14})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  void dark;
  return finish(c, { repeat: [1, 1] });
}

/* ------------------------------------------------------------------ *
 *  Wet market concrete with drains, puddles and grime.
 * ------------------------------------------------------------------ */
export function concreteTexture() {
  const W = 1024, H = 1024;
  const c = canvas(W, H), g = c.getContext('2d');
  const rng = makeRng(777);
  g.fillStyle = '#6a6f72'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 8000; i++) {
    const v = 90 + rng() * 90;
    g.fillStyle = `rgba(${v},${v + 3},${v + 5},${0.05 + rng() * 0.16})`;
    g.fillRect(rng() * W, rng() * H, 1 + rng() * 4, 1 + rng() * 4);
  }
  for (let i = 0; i < 60; i++) {
    const x = rng() * W, y = rng() * H, r = 40 + rng() * 190;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rng() < 0.55 ? 'rgba(40,50,58,0.30)' : 'rgba(150,158,162,0.20)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // expansion joints
  g.strokeStyle = 'rgba(38,44,50,0.55)'; g.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo((i * W) / 4, 0); g.lineTo((i * W) / 4, H); g.stroke();
    g.beginPath(); g.moveTo(0, (i * H) / 4); g.lineTo(W, (i * H) / 4); g.stroke();
  }
  return finish(c, { repeat: [7, 7] });
}

/* Steel / stainless brushing for legs, trays, buckets. */
export function steelTexture() {
  const W = 512, H = 512;
  const c = canvas(W, H), g = c.getContext('2d');
  const rng = makeRng(2025);
  g.fillStyle = '#c6cbcf'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2400; i++) {
    const v = 150 + rng() * 105;
    g.strokeStyle = `rgba(${v},${v + 2},${v + 4},${0.05 + rng() * 0.18})`;
    g.lineWidth = 0.5 + rng() * 1.6;
    const y = rng() * H;
    g.beginPath(); g.moveTo(rng() * W - 200, y); g.lineTo(rng() * W + 200, y + (rng() - 0.5) * 2); g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const x = rng() * W, y = rng() * H, r = 8 + rng() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(90,96,100,0.22)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return finish(c, { repeat: [1, 1] });
}

/* Crushed ice, used in the market bins. */
export function iceTexture() {
  const W = 512, H = 512;
  const c = canvas(W, H), g = c.getContext('2d');
  const rng = makeRng(51);
  g.fillStyle = '#d3e2ea'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 3000; i++) {
    const x = rng() * W, y = rng() * H, s = 3 + rng() * 12;
    g.save(); g.translate(x, y); g.rotate(rng() * 6.28);
    const v = rng();
    g.fillStyle = v < 0.4 ? 'rgba(255,255,255,0.75)' : v < 0.75 ? 'rgba(178,205,220,0.6)' : 'rgba(120,155,175,0.5)';
    g.fillRect(-s / 2, -s / 2, s, s * 0.7);
    g.restore();
  }
  return finish(c, { repeat: [2, 2] });
}

/* ------------------------------------------------------------------ *
 *  Chevron ribbon for the cut guide (alpha only, tinted per-material).
 * ------------------------------------------------------------------ */
export function chevronTexture() {
  const W = 256, H = 96;
  const c = canvas(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.strokeStyle = '#ffffff';
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = 15;
  for (let i = 0; i < 3; i++) {
    const x = 30 + i * 85;
    g.globalAlpha = 0.95;
    g.beginPath();
    g.moveTo(x - 26, 20);
    g.lineTo(x + 26, H / 2);
    g.lineTo(x - 26, H - 20);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/* Soft round glow, used for the blade spark and the guide head. */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 128;
  const c = canvas(S, S), g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Four-point sparkle for the tidy-up / reveal moments. */
export function sparkTexture() {
  const S = 128;
  const c = canvas(S, S), g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.25, 'rgba(255,246,220,0.45)');
  grd.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(0, 0, S / 2, 0, 6.3); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.92)';
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2);
    g.beginPath();
    g.moveTo(0, -S / 2 + 4); g.quadraticCurveTo(5, -8, 0, 0); g.quadraticCurveTo(-5, -8, 0, -S / 2 + 4);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ *
 *  The pointing-hand pictogram: shows the gesture without any words.
 * ------------------------------------------------------------------ */
export function handTexture() {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  g.translate(S * 0.5, S * 0.5);
  g.scale(1.06, 1.06);

  const drawHand = (fill, stroke, lw) => {
    g.beginPath();
    // index finger
    g.moveTo(-16, -104);
    g.quadraticCurveTo(0, -118, 16, -104);
    g.lineTo(16, -18);
    // knuckles
    g.quadraticCurveTo(22, -34, 34, -30);
    g.quadraticCurveTo(46, -25, 46, -8);
    g.lineTo(46, 34);
    // palm bottom
    g.quadraticCurveTo(46, 92, -2, 100);
    g.quadraticCurveTo(-44, 100, -50, 56);
    g.lineTo(-56, 6);
    g.quadraticCurveTo(-60, -12, -46, -18);
    g.quadraticCurveTo(-32, -22, -26, -6);
    g.lineTo(-16, 12);
    g.closePath();
    if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.lineJoin = 'round'; g.stroke(); }
    if (fill) { g.fillStyle = fill; g.fill(); }
  };
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 16; g.shadowOffsetY = 5;
  drawHand(null, 'rgba(30,44,56,0.85)', 20);
  g.shadowColor = 'transparent';
  drawHand('#fdf6ee', 'rgba(30,44,56,0.9)', 9);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Vertical hall-haze gradient used as the scene backdrop. */
export function skyTexture() {
  const c = canvas(4, 256), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0.00, '#1b2a36');
  grd.addColorStop(0.34, '#33475a');
  grd.addColorStop(0.62, '#5b6f80');
  grd.addColorStop(0.85, '#69798a');
  grd.addColorStop(1.00, '#3c4956');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

/* Painted / worn plastic crate face. */
export function crateTexture(hue = '#1d5f8f') {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  const rng = makeRng(31);
  g.fillStyle = hue; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 6;
  for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(0, (i * S) / 5); g.lineTo(S, (i * S) / 5); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
  for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo((i * S) / 5, 0); g.lineTo((i * S) / 5, S); g.stroke(); }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(${rng() < 0.5 ? 255 : 0},${rng() < 0.5 ? 255 : 0},255,${0.02 + rng() * 0.06})`;
    g.fillRect(rng() * S, rng() * S, 1 + rng() * 4, 1 + rng() * 3);
  }
  return finish(c, { repeat: [1, 1] });
}

/* Fabric for the craftsman's coat / apron: subtle weave + honest wear. */
export function clothTexture(base = '#f2f0ea', seed = 5) {
  const S = 256;
  const c = canvas(S, S), g = c.getContext('2d');
  const rng = makeRng(seed);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const v = rng() < 0.5 ? 255 : 120;
    g.fillStyle = `rgba(${v},${v},${v},${0.02 + rng() * 0.07})`;
    g.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
  }
  for (let i = 0; i < 24; i++) {
    const x = rng() * S, y = rng() * S, r = 8 + rng() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(120,120,120,0.13)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return finish(c, { repeat: [2, 2] });
}
