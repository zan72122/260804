// Procedural canvas textures: brick, stone, planks, asphalt, grass, rust...
// Small canvases with baked grime/wear so materials read as real surfaces.
import * as THREE from './vendor/three.module.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// deterministic-ish rng so reloads look the same
let seed = 12345;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

function speckle(ctx, w, h, n, alpha, dark) {
  for (let i = 0; i < n; i++) {
    const v = dark ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * (0.4 + rnd() * 0.6)})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

export function brickTex(base = '#a8563c', mortar = '#c9bfae') {
  const [c, x] = canvas(256, 256);
  x.fillStyle = mortar; x.fillRect(0, 0, 256, 256);
  const bh = 16, bw = 40;
  for (let ry = 0; ry < 256 / bh; ry++) {
    const off = (ry % 2) * bw / 2;
    for (let bxi = -1; bxi < 256 / bw + 1; bxi++) {
      const hue = -10 + rnd() * 20, lit = -14 + rnd() * 22;
      x.fillStyle = shade(base, lit, hue);
      x.fillRect(bxi * bw + off + 2, ry * bh + 2, bw - 4, bh - 4);
    }
  }
  speckle(x, 256, 256, 500, 0.08, true);
  // grime streaks
  x.fillStyle = 'rgba(40,30,20,0.10)';
  for (let i = 0; i < 12; i++) x.fillRect(rnd() * 256, 0, 3 + rnd() * 8, 256);
  return c;
}

export function stoneWallTex() {
  // quay wall — big stone blocks, dark waterline stain at the bottom
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#8d8878'; x.fillRect(0, 0, 256, 256);
  const bh = 42, bw = 62;
  for (let ry = 0; ry < 7; ry++) {
    const off = (ry % 2) * bw / 2;
    for (let bxi = -1; bxi < 6; bxi++) {
      x.fillStyle = shade('#9a927e', -12 + rnd() * 24, 0);
      x.fillRect(bxi * bw + off + 3, ry * bh + 3, bw - 6, bh - 6);
      x.fillStyle = 'rgba(0,0,0,0.18)';
      x.fillRect(bxi * bw + off + 3, ry * bh + bh - 8, bw - 6, 4);
    }
  }
  speckle(x, 256, 256, 700, 0.10, true);
  // waterline stain + algae
  const g = x.createLinearGradient(0, 150, 0, 256);
  g.addColorStop(0, 'rgba(30,50,40,0)');
  g.addColorStop(0.6, 'rgba(25,45,38,0.45)');
  g.addColorStop(1, 'rgba(15,35,30,0.75)');
  x.fillStyle = g; x.fillRect(0, 150, 256, 106);
  return c;
}

export function pavingTex() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#7f7a70'; x.fillRect(0, 0, 256, 256);
  const s = 32;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    x.fillStyle = shade('#8b867b', -10 + rnd() * 20, 0);
    x.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
  }
  speckle(x, 256, 256, 600, 0.09, true);
  return c;
}

export function asphaltTex() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#3d3f43'; x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 2400, 0.10, false);
  speckle(x, 256, 256, 1400, 0.16, true);
  // tire wear bands
  x.fillStyle = 'rgba(0,0,0,0.14)';
  x.fillRect(0, 52, 256, 26); x.fillRect(0, 178, 256, 26);
  return c;
}

export function roadLineTex() {
  // center dashed line, drawn along X of the texture
  const [c, x] = canvas(256, 64);
  x.clearRect(0, 0, 256, 64);
  x.fillStyle = 'rgba(240,240,230,0.92)';
  for (let i = 0; i < 4; i++) x.fillRect(i * 64 + 8, 28, 40, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function plankTex(base = '#8a6a44') {
  const [c, x] = canvas(256, 256);
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  const pw = 32;
  for (let i = 0; i < 8; i++) {
    x.fillStyle = shade(base, -12 + rnd() * 24, -4 + rnd() * 8);
    x.fillRect(i * pw + 1, 0, pw - 2, 256);
    // grain
    x.strokeStyle = 'rgba(40,25,10,0.25)';
    for (let g = 0; g < 5; g++) {
      x.beginPath();
      const gx = i * pw + 4 + rnd() * (pw - 8);
      x.moveTo(gx, 0); x.bezierCurveTo(gx + 4, 80, gx - 4, 170, gx + 2, 256);
      x.stroke();
    }
  }
  speckle(x, 256, 256, 350, 0.10, true);
  return c;
}

export function rustTex() {
  const [c, x] = canvas(128, 128);
  x.fillStyle = '#6e4a2c'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    x.fillStyle = `rgba(${120 + rnd() * 80},${60 + rnd() * 40},${20 + rnd() * 20},${0.2 + rnd() * 0.5})`;
    const r = 1 + rnd() * 5;
    x.beginPath(); x.arc(rnd() * 128, rnd() * 128, r, 0, 7); x.fill();
  }
  speckle(x, 128, 128, 300, 0.2, true);
  return c;
}

export function grassTex() {
  const [c, x] = canvas(128, 128);
  x.fillStyle = '#5d7a3a'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = shade('#63823e', -14 + rnd() * 28, -6 + rnd() * 12);
    x.fillRect(rnd() * 128, rnd() * 128, 2, 3);
  }
  return c;
}

export function metalTex() {
  const [c, x] = canvas(128, 128);
  x.fillStyle = '#7d8890'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 60; i++) {
    x.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.06})`;
    x.fillRect(0, rnd() * 128, 128, 1 + rnd() * 2);
  }
  speckle(x, 128, 128, 250, 0.08, true);
  return c;
}

export function hullTex(base = '#27415c') {
  const [c, x] = canvas(256, 128);
  x.fillStyle = base; x.fillRect(0, 0, 256, 128);
  // plate lines + rivets
  x.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 1; i < 4; i++) x.fillRect(0, i * 32, 256, 2);
  for (let i = 1; i < 8; i++) x.fillRect(i * 32, 0, 2, 128);
  x.fillStyle = 'rgba(255,255,255,0.10)';
  for (let j = 0; j < 4; j++) for (let i = 0; i < 16; i++) x.fillRect(i * 16 + 4, j * 32 + 4, 2, 2);
  // rust streaks near bottom
  for (let i = 0; i < 14; i++) {
    x.fillStyle = `rgba(140,70,30,${0.10 + rnd() * 0.2})`;
    const sx = rnd() * 256;
    x.fillRect(sx, 90 + rnd() * 10, 3 + rnd() * 5, 38);
  }
  return c;
}

function shade(hex, lightDelta, hueDelta) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, r + lightDelta + hueDelta));
  g = Math.max(0, Math.min(255, g + lightDelta));
  b = Math.max(0, Math.min(255, b + lightDelta - hueDelta));
  return `rgb(${r|0},${g|0},${b|0})`;
}

export function T(c, rx = 1, ry = 1) { return tex(c, rx, ry); }
