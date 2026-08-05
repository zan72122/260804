// Procedural fabric prints, drawn once per garment into a canvas texture.
// Nothing here changes at runtime, so the texture is uploaded a single time.

import * as THREE from 'three';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

function petalFlower(g, x, y, r, petals, fill, core) {
  g.save();
  g.translate(x, y);
  g.fillStyle = fill;
  for (let i = 0; i < petals; i++) {
    g.save();
    g.rotate((i / petals) * Math.PI * 2);
    g.beginPath();
    g.ellipse(0, -r * 0.62, r * 0.36, r * 0.62, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.fillStyle = core;
  g.beginPath();
  g.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function starShape(g, x, y, r, fill) {
  g.save();
  g.translate(x, y);
  g.fillStyle = fill;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.restore();
}

function heartShape(g, x, y, r, fill) {
  g.save();
  g.translate(x, y);
  g.scale(r / 10, r / 10);
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(0, 8);
  g.bezierCurveTo(-11, -1, -7, -11, 0, -5);
  g.bezierCurveTo(7, -11, 11, -1, 0, 8);
  g.closePath();
  g.fill();
  g.restore();
}

const PRINTS = {
  gingham(g, S, c) {
    const n = 14, cell = S / n;
    g.globalAlpha = 0.5;
    g.fillStyle = c.ink;
    for (let i = 0; i < n; i++) { g.fillRect(i * cell + cell * 0.5, 0, cell * 0.5, S); }
    for (let j = 0; j < n; j++) { g.fillRect(0, j * cell + cell * 0.5, S, cell * 0.5); }
    g.globalAlpha = 1;
  },
  check(g, S, c) {
    const n = 9, cell = S / n;
    g.globalAlpha = 0.34;
    g.fillStyle = c.ink;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i + j) % 2 === 0) g.fillRect(i * cell, j * cell, cell, cell);
    }
    g.globalAlpha = 0.5;
    g.strokeStyle = c.accent;
    g.lineWidth = S * 0.006;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, S); g.stroke();
      g.beginPath(); g.moveTo(0, i * cell); g.lineTo(S, i * cell); g.stroke();
    }
    g.globalAlpha = 1;
  },
  stripe(g, S, c) {
    const n = 22, cell = S / n;
    for (let i = 0; i < n; i++) {
      g.globalAlpha = i % 2 === 0 ? 0.42 : 0.16;
      g.fillStyle = i % 4 === 0 ? c.accent : c.ink;
      g.fillRect(i * cell, 0, cell * 0.55, S);
    }
    g.globalAlpha = 1;
  },
  dots(g, S, c) {
    const n = 11, cell = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ox = (j % 2) * cell * 0.5;
      const big = (i + j) % 3 === 0;
      g.globalAlpha = big ? 0.55 : 0.3;
      g.fillStyle = big ? c.ink : c.accent;
      g.beginPath();
      g.arc(i * cell + ox + cell * 0.5, j * cell + cell * 0.5, cell * (big ? 0.24 : 0.15), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  },
  flower(g, S, c) {
    const n = 7, cell = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ox = (j % 2) * cell * 0.5;
      g.globalAlpha = 0.6;
      petalFlower(g, i * cell + ox + cell * 0.5, j * cell + cell * 0.5, cell * 0.3,
        5, c.ink, c.accent);
      g.globalAlpha = 0.3;
      g.fillStyle = c.accent;
      g.beginPath();
      g.arc(i * cell + ox + cell * 0.06, j * cell + cell * 0.08, cell * 0.05, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  },
  star(g, S, c) {
    const n = 8, cell = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ox = (j % 2) * cell * 0.5;
      g.globalAlpha = 0.55;
      starShape(g, i * cell + ox + cell * 0.5, j * cell + cell * 0.5, cell * 0.27,
        (i + j) % 2 ? c.ink : c.accent);
    }
    g.globalAlpha = 1;
  },
  heart(g, S, c) {
    const n = 8, cell = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ox = (j % 2) * cell * 0.5;
      g.globalAlpha = 0.55;
      heartShape(g, i * cell + ox + cell * 0.5, j * cell + cell * 0.5, cell * 0.3,
        (i + j) % 2 ? c.ink : c.accent);
    }
    g.globalAlpha = 1;
  },
  wave(g, S, c) {
    const rows = 13, h = S / rows;
    g.lineWidth = S * 0.012;
    g.lineCap = 'round';
    for (let j = 0; j < rows; j++) {
      g.globalAlpha = j % 2 ? 0.4 : 0.24;
      g.strokeStyle = j % 2 ? c.ink : c.accent;
      g.beginPath();
      for (let x = 0; x <= S; x += 8) {
        const y = j * h + h * 0.5 + Math.sin((x / S) * Math.PI * 7 + j) * h * 0.28;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  },
};

/** Faint woven-thread noise so the cloth never looks like flat plastic. */
function weave(g, S) {
  const step = 3;
  g.globalAlpha = 0.05;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1;
  for (let y = 0; y < S; y += step) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
  }
  g.globalAlpha = 0.035;
  g.strokeStyle = '#000000';
  for (let x = 0; x < S; x += step) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke();
  }
  g.globalAlpha = 1;
}

/**
 * Builds { map, roughnessMap } for a colourway.
 * `size` should be 512 or 1024 depending on the device tier.
 */
export function makeFabricTexture(colour, size = 1024) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');

  // soft gradient ground so the cloth has depth even before lighting
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, mix(colour.base, '#ffffff', 0.35));
  grad.addColorStop(0.5, colour.base);
  grad.addColorStop(1, mix(colour.base, colour.ink, 0.18));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  (PRINTS[colour.print] || PRINTS.dots)(g, size, colour);
  weave(g, size);

  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = 4;
  return map;
}

/** Pale "wrong side" of the same cloth, used before the garment is turned. */
export function makeLiningTexture(colour, size = 256) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.fillStyle = mix(colour.base, '#fffdf8', 0.62);
  g.fillRect(0, 0, size, size);
  weave(g, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
