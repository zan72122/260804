/**
 * Procedurally drawn prize packaging.
 *
 * Everything here is original artwork made from primitives — no external
 * assets, no licensed characters. Each design produces six canvases (one per
 * box face) plus a shared roughness map, so the box reads as a printed carton
 * with a glossy panel rather than a coloured cube.
 */

import * as THREE from '../vendor/three/three.module.min.js';

const TAU = Math.PI * 2;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d') };
}

function tex(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function star(g, cx, cy, r, points = 5) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  g.fill();
}

/** Soft printed-paper speckle so the flat colours are not perfectly flat. */
function speckle(g, w, h, alpha = 0.05) {
  const n = Math.floor((w * h) / 900);
  g.save();
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(0,0,0,${alpha * Math.random()})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.restore();
}

/** Thin darker line along the panel border — the carton's folded seam. */
function seams(g, w, h) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(0,0,0,0.22)');
  grd.addColorStop(0.1, 'rgba(255,255,255,0.06)');
  grd.addColorStop(0.85, 'rgba(0,0,0,0.04)');
  grd.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(0,0,0,0.30)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, w - 4, h - 4);
}

// --------------------------------------------------------------- characters

function faceBear(g, cx, cy, r, fur, dark) {
  g.fillStyle = fur;
  g.beginPath(); g.arc(cx - r * 0.78, cy - r * 0.72, r * 0.42, 0, TAU); g.fill();
  g.beginPath(); g.arc(cx + r * 0.78, cy - r * 0.72, r * 0.42, 0, TAU); g.fill();
  g.fillStyle = dark;
  g.beginPath(); g.arc(cx - r * 0.78, cy - r * 0.72, r * 0.20, 0, TAU); g.fill();
  g.beginPath(); g.arc(cx + r * 0.78, cy - r * 0.72, r * 0.20, 0, TAU); g.fill();
  g.fillStyle = fur;
  g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.fillStyle = '#fff4e2';
  g.beginPath(); g.ellipse(cx, cy + r * 0.30, r * 0.52, r * 0.40, 0, 0, TAU); g.fill();
  g.fillStyle = '#3a2418';
  g.beginPath(); g.ellipse(cx - r * 0.36, cy - r * 0.16, r * 0.11, r * 0.14, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + r * 0.36, cy - r * 0.16, r * 0.11, r * 0.14, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx, cy + r * 0.16, r * 0.14, r * 0.11, 0, 0, TAU); g.fill();
  g.strokeStyle = '#3a2418';
  g.lineWidth = r * 0.07;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(cx - r * 0.16, cy + r * 0.30, r * 0.17, 0, Math.PI);
  g.arc(cx + r * 0.16, cy + r * 0.30, r * 0.17, 0, Math.PI);
  g.stroke();
  g.fillStyle = 'rgba(255,120,140,0.55)';
  g.beginPath(); g.arc(cx - r * 0.62, cy + r * 0.20, r * 0.16, 0, TAU); g.fill();
  g.beginPath(); g.arc(cx + r * 0.62, cy + r * 0.20, r * 0.16, 0, TAU); g.fill();
}

function faceCat(g, cx, cy, r, fur) {
  g.fillStyle = fur;
  g.beginPath();
  g.moveTo(cx - r * 0.95, cy - r * 0.45);
  g.lineTo(cx - r * 0.70, cy - r * 1.28);
  g.lineTo(cx - r * 0.25, cy - r * 0.80);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(cx + r * 0.95, cy - r * 0.45);
  g.lineTo(cx + r * 0.70, cy - r * 1.28);
  g.lineTo(cx + r * 0.25, cy - r * 0.80);
  g.closePath(); g.fill();
  g.fillStyle = '#ffb7c8';
  g.beginPath();
  g.moveTo(cx - r * 0.80, cy - r * 0.56);
  g.lineTo(cx - r * 0.68, cy - r * 1.02);
  g.lineTo(cx - r * 0.44, cy - r * 0.76);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(cx + r * 0.80, cy - r * 0.56);
  g.lineTo(cx + r * 0.68, cy - r * 1.02);
  g.lineTo(cx + r * 0.44, cy - r * 0.76);
  g.closePath(); g.fill();
  g.fillStyle = fur;
  g.beginPath(); g.ellipse(cx, cy, r * 1.02, r * 0.92, 0, 0, TAU); g.fill();
  g.fillStyle = '#2f2a35';
  g.beginPath(); g.ellipse(cx - r * 0.36, cy - r * 0.10, r * 0.13, r * 0.17, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + r * 0.36, cy - r * 0.10, r * 0.13, r * 0.17, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(cx - r * 0.32, cy - r * 0.16, r * 0.05, 0, TAU); g.fill();
  g.beginPath(); g.arc(cx + r * 0.40, cy - r * 0.16, r * 0.05, 0, TAU); g.fill();
  g.fillStyle = '#ff8fa6';
  g.beginPath();
  g.moveTo(cx, cy + r * 0.28);
  g.lineTo(cx - r * 0.11, cy + r * 0.13);
  g.lineTo(cx + r * 0.11, cy + r * 0.13);
  g.closePath(); g.fill();
  g.strokeStyle = '#2f2a35';
  g.lineWidth = r * 0.05;
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(cx + s * r * 0.30, cy + r * 0.26 + i * r * 0.10);
      g.lineTo(cx + s * r * 0.92, cy + r * 0.20 + i * r * 0.20);
      g.stroke();
    }
  }
}

function faceRobot(g, cx, cy, r, body, glow) {
  g.strokeStyle = '#9aa6b8';
  g.lineWidth = r * 0.10;
  g.beginPath(); g.moveTo(cx, cy - r * 0.95); g.lineTo(cx, cy - r * 1.35); g.stroke();
  g.fillStyle = glow;
  g.beginPath(); g.arc(cx, cy - r * 1.42, r * 0.14, 0, TAU); g.fill();
  g.fillStyle = body;
  roundRect(g, cx - r, cy - r * 0.95, r * 2, r * 1.9, r * 0.34);
  g.fill();
  g.fillStyle = '#161b26';
  roundRect(g, cx - r * 0.76, cy - r * 0.55, r * 1.52, r * 0.94, r * 0.24);
  g.fill();
  g.fillStyle = glow;
  g.beginPath(); g.ellipse(cx - r * 0.34, cy - r * 0.10, r * 0.16, r * 0.20, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(cx + r * 0.34, cy - r * 0.10, r * 0.16, r * 0.20, 0, 0, TAU); g.fill();
  g.strokeStyle = glow;
  g.lineWidth = r * 0.09;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - r * 0.26, cy + r * 0.24);
  g.quadraticCurveTo(cx, cy + r * 0.46, cx + r * 0.26, cy + r * 0.24);
  g.stroke();
  g.fillStyle = '#e6ecf5';
  for (let i = -1; i <= 1; i++) {
    g.beginPath(); g.arc(cx + i * r * 0.34, cy + r * 0.70, r * 0.09, 0, TAU); g.fill();
  }
}

function faceCandy(g, cx, cy, r, a, b) {
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.3);
  for (let i = 0; i < 10; i++) {
    g.fillStyle = i % 2 ? a : b;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, r, (i / 10) * TAU, ((i + 1) / 10) * TAU);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.arc(cx - r * 0.3, cy - r * 0.34, r * 0.20, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = r * 0.12;
  g.beginPath(); g.arc(cx, cy, r * 0.97, 0, TAU); g.stroke();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(cx, cy, r * 0.26, 0, TAU); g.fill();
  g.fillStyle = '#ff5f8a';
  star(g, cx, cy, r * 0.20, 5);
}

function faceJuice(g, cx, cy, r, juice) {
  g.fillStyle = '#f2f6ff';
  roundRect(g, cx - r * 0.62, cy - r * 1.05, r * 1.24, r * 2.0, r * 0.16);
  g.fill();
  g.fillStyle = juice;
  roundRect(g, cx - r * 0.50, cy - r * 0.30, r * 1.0, r * 1.16, r * 0.10);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  roundRect(g, cx - r * 0.42, cy - r * 0.22, r * 0.18, r * 1.0, r * 0.08);
  g.fill();
  g.fillStyle = '#ffd166';
  g.beginPath(); g.arc(cx, cy - r * 0.62, r * 0.30, 0, TAU); g.fill();
  g.fillStyle = '#ff8f4a';
  g.beginPath(); g.arc(cx, cy - r * 0.62, r * 0.18, 0, TAU); g.fill();
  g.strokeStyle = '#5fc4e8';
  g.lineWidth = r * 0.14;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx + r * 0.24, cy - r * 1.02);
  g.lineTo(cx + r * 0.44, cy - r * 1.5);
  g.stroke();
  g.fillStyle = '#3a4a5e';
  for (let i = 0; i < 3; i++) {
    roundRect(g, cx - r * 0.34, cy + r * 1.0 + i * r * 0.16, r * (0.68 - i * 0.16), r * 0.08, r * 0.04);
    g.fill();
  }
}

// ------------------------------------------------------------------ designs

const DESIGNS = {
  bear: {
    bg: '#ffd76b', band: '#e2452f', accent: '#7c3f1d', ink: '#5a2f14',
    draw: (g, w, h) => faceBear(g, w / 2, h * 0.46, Math.min(w, h) * 0.24, '#c98a4b', '#8a5a2b'),
  },
  candy: {
    bg: '#ff9ec7', band: '#7d4bd6', accent: '#fff0f6', ink: '#5b2a7a',
    draw: (g, w, h) => faceCandy(g, w / 2, h * 0.46, Math.min(w, h) * 0.27, '#ff5f8a', '#fff1f6'),
  },
  robot: {
    bg: '#3ec1e8', band: '#123a5c', accent: '#d7f2ff', ink: '#0d2c46',
    draw: (g, w, h) => faceRobot(g, w / 2, h * 0.50, Math.min(w, h) * 0.24, '#dbe4ef', '#ffd23f'),
  },
  cat: {
    bg: '#b7e5a1', band: '#3e7d3a', accent: '#fdfbe8', ink: '#2c5b2a',
    draw: (g, w, h) => faceCat(g, w / 2, h * 0.48, Math.min(w, h) * 0.25, '#f6f0e2'),
  },
  juice: {
    bg: '#ffb45c', band: '#d64545', accent: '#fff6e0', ink: '#8c3a1f',
    draw: (g, w, h) => faceJuice(g, w / 2, h * 0.46, Math.min(w, h) * 0.24, '#ff7a45'),
  },
};

/** Wavy "brand" ribbon standing in for a logotype — readable at any age. */
function ribbon(g, w, h, design) {
  const bh = h * 0.20;
  const by = h * 0.795;
  g.fillStyle = design.band;
  roundRect(g, w * 0.06, by - bh / 2, w * 0.88, bh, bh * 0.42);
  g.fill();
  g.fillStyle = design.accent;
  const n = 5;
  for (let i = 0; i < n; i++) {
    const cx = w * (0.16 + (i * 0.68) / (n - 1));
    star(g, cx, by, bh * 0.30, 5);
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(g, w * 0.06, by - bh / 2, w * 0.88, bh * 0.30, bh * 0.2);
  g.fill();
}

function frontPanel(design, w = 512, h = 256) {
  const { c, g } = makeCanvas(w, h);
  g.fillStyle = design.bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = -h; i < w; i += 56) {
    g.beginPath();
    g.moveTo(i, h); g.lineTo(i + 26, h); g.lineTo(i + 26 + h * 0.5, 0); g.lineTo(i + h * 0.5, 0);
    g.closePath(); g.fill();
  }
  // glossy window with the character inside
  g.fillStyle = 'rgba(255,255,255,0.9)';
  roundRect(g, w * 0.30, h * 0.06, w * 0.40, h * 0.66, h * 0.09);
  g.fill();
  g.save();
  roundRect(g, w * 0.30, h * 0.06, w * 0.40, h * 0.66, h * 0.09);
  g.clip();
  const wg = g.createLinearGradient(0, h * 0.06, 0, h * 0.72);
  wg.addColorStop(0, design.accent);
  wg.addColorStop(1, design.bg);
  g.fillStyle = wg;
  g.fillRect(w * 0.30, h * 0.06, w * 0.40, h * 0.66);
  design.draw(g, w, h * 0.80);
  const gl = g.createLinearGradient(w * 0.30, 0, w * 0.70, h * 0.7);
  gl.addColorStop(0, 'rgba(255,255,255,0.22)');
  gl.addColorStop(0.35, 'rgba(255,255,255,0.02)');
  gl.addColorStop(1, 'rgba(255,255,255,0.10)');
  g.fillStyle = gl;
  g.fillRect(w * 0.30, h * 0.06, w * 0.40, h * 0.66);
  g.restore();
  g.strokeStyle = design.ink;
  g.lineWidth = 5;
  roundRect(g, w * 0.30, h * 0.06, w * 0.40, h * 0.66, h * 0.09);
  g.stroke();

  // side badges
  for (const s of [0.155, 0.845]) {
    g.fillStyle = design.band;
    g.beginPath(); g.arc(w * s, h * 0.34, h * 0.15, 0, TAU); g.fill();
    g.fillStyle = design.accent;
    star(g, w * s, h * 0.34, h * 0.095, 6);
    g.fillStyle = design.ink;
    roundRect(g, w * s - h * 0.16, h * 0.58, h * 0.32, h * 0.05, h * 0.025); g.fill();
    roundRect(g, w * s - h * 0.11, h * 0.66, h * 0.22, h * 0.04, h * 0.02); g.fill();
  }

  ribbon(g, w, h, design);
  speckle(g, w, h, 0.06);
  seams(g, w, h);
  return c;
}

function sidePanel(design, w = 256, h = 256) {
  const { c, g } = makeCanvas(w, h);
  g.fillStyle = design.band;
  g.fillRect(0, 0, w, h);
  g.fillStyle = design.bg;
  roundRect(g, w * 0.10, h * 0.10, w * 0.80, h * 0.80, w * 0.10);
  g.fill();
  g.save();
  roundRect(g, w * 0.10, h * 0.10, w * 0.80, h * 0.80, w * 0.10);
  g.clip();
  design.draw(g, w, h * 0.95);
  g.restore();
  g.fillStyle = design.ink;
  for (let i = 0; i < 4; i++) {
    roundRect(g, w * 0.22, h * 0.80 + i * h * 0.045, w * (0.5 - i * 0.09), h * 0.024, h * 0.012);
    g.fill();
  }
  speckle(g, w, h, 0.06);
  seams(g, w, h);
  return c;
}

function topPanel(design, w = 512, h = 256) {
  const { c, g } = makeCanvas(w, h);
  g.fillStyle = design.bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = design.band;
  g.fillRect(0, h * 0.40, w, h * 0.20);
  g.fillStyle = design.accent;
  for (let i = 0; i < 9; i++) star(g, w * (0.08 + i * 0.105), h * 0.50, h * 0.055, 5);
  // carton flap seam down the middle
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, h * 0.5); g.lineTo(w, h * 0.5); g.stroke();
  g.fillStyle = design.ink;
  roundRect(g, w * 0.06, h * 0.10, w * 0.24, h * 0.05, h * 0.025); g.fill();
  roundRect(g, w * 0.70, h * 0.85, w * 0.24, h * 0.05, h * 0.025); g.fill();
  speckle(g, w, h, 0.05);
  seams(g, w, h);
  return c;
}

function bottomPanel(design, w = 512, h = 256) {
  const { c, g } = makeCanvas(w, h);
  g.fillStyle = '#cfc4b0';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.10)';
  g.fillRect(w * 0.02, h * 0.44, w * 0.96, h * 0.12);
  // barcode-ish block
  g.fillStyle = '#ffffff';
  roundRect(g, w * 0.60, h * 0.12, w * 0.34, h * 0.30, 6); g.fill();
  g.fillStyle = '#20242c';
  let x = w * 0.63;
  while (x < w * 0.91) {
    const bw = 2 + Math.random() * 6;
    g.fillRect(x, h * 0.16, bw, h * 0.22);
    x += bw + 2 + Math.random() * 4;
  }
  g.fillStyle = design.ink;
  for (let i = 0; i < 3; i++) {
    roundRect(g, w * 0.07, h * 0.16 + i * h * 0.08, w * (0.34 - i * 0.08), h * 0.045, h * 0.02);
    g.fill();
  }
  speckle(g, w, h, 0.09);
  seams(g, w, h);
  return c;
}

/** Slightly glossier printed area, matte elsewhere. */
function roughnessMap(w = 256, h = 256) {
  const { c, g } = makeCanvas(w, h);
  g.fillStyle = '#9a9a9a';
  g.fillRect(0, 0, w, h);
  const grd = g.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.5);
  grd.addColorStop(0, '#4c4c4c');
  grd.addColorStop(1, '#a8a8a8');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const v = 140 + Math.random() * 70;
    g.fillStyle = `rgba(${v},${v},${v},0.10)`;
    g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  }
  return c;
}

/**
 * Builds the six materials for one prize design, ordered the way
 * BoxGeometry groups them: +X, -X, +Y, -Y, +Z, -Z.
 */
export function makePrizeMaterials(name, env) {
  const design = DESIGNS[name] ?? DESIGNS.bear;
  const rough = tex(roughnessMap(), false);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;

  const mk = (canvas, roughness) =>
    new THREE.MeshStandardMaterial({
      map: tex(canvas),
      roughnessMap: rough,
      roughness,
      metalness: 0.04,
      envMap: env ?? null,
      envMapIntensity: 0.5,
    });

  const side = sidePanel(design);
  return [
    mk(side, 0.74),
    mk(sidePanel(design), 0.74),
    mk(topPanel(design), 0.68),
    mk(bottomPanel(design), 0.92),
    mk(frontPanel(design), 0.56),
    mk(frontPanel(design), 0.56),
  ];
}

/** Printed side panel — keeps the cabinet walls from reading as dead space. */
export function makeSidePanelArt(w = 512, h = 512) {
  const { c, g } = makeCanvas(w, h);
  g.fillStyle = '#232a3d';
  g.fillRect(0, 0, w, h);
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(-0.5);
  for (let i = -12; i < 12; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,95,158,0.16)' : 'rgba(79,216,255,0.13)';
    g.fillRect(i * 74, -h, 38, h * 2.4);
  }
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < 16; i++) star(g, ((i * 173) % w), ((i * 271) % h), 10 + (i % 3) * 6, 5);
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = 6;
  g.strokeRect(18, 18, w - 36, h - 36);
  return tex(c);
}

/** Backdrop print for the inside of the cabinet. */
export function makeBackdrop(w = 1024, h = 512) {
  const { c, g } = makeCanvas(w, h);
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#2b6bd6');
  grd.addColorStop(0.55, '#5aa7ef');
  grd.addColorStop(1, '#bfe6ff');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 7; i++) {
    const cx = (i * 173) % w;
    const cy = h * (0.18 + 0.5 * ((i * 37) % 100) / 100);
    const r = 26 + ((i * 53) % 40);
    for (const [ox, oy, rr] of [[0, 0, r], [r * 0.8, r * 0.2, r * 0.75], [-r * 0.85, r * 0.25, r * 0.65]]) {
      g.beginPath(); g.arc(cx + ox, cy + oy, rr, 0, TAU); g.fill();
    }
  }
  g.fillStyle = 'rgba(255,240,150,0.9)';
  for (let i = 0; i < 22; i++) {
    star(g, ((i * 271) % w), ((i * 137) % (h * 0.6)), 6 + (i % 3) * 4, 5);
  }
  g.fillStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < w; i += 64) g.fillRect(i, 0, 26, h);
  return tex(c);
}
