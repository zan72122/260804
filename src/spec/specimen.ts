/**
 * Procedural specimen. One seed produces:
 *   - `tissue`   pale, low-contrast tissue seen inside the paraffin block,
 *                in the ribbon and in the floating section
 *   - `fluoroFar`  the whole-section fluorescence image (low power)
 *   - `fluoroNear` the same specimen at cell level (used by the final zoom-in)
 *
 * The three architectures are deliberately *shape* driven, not disease driven:
 *   gland  — rings of nuclei around round lumens
 *   branch — a big branching tree of tubes
 *   dense  — packed sheets of cells
 *
 * Everything is drawn with Canvas2D and additive compositing, so the
 * fluorescence look (dark field, saturated, glowing overlaps) comes for free
 * and costs nothing at runtime.
 */
import * as THREE from 'three';
import { TAU, clamp, lerp, makeRng, rand, randInt, type Rng } from '../core/util';

export type SpecimenKind = 'gland' | 'branch' | 'dense';

export interface Specimen {
  seed: number;
  kind: SpecimenKind;
  /** friendly label, only used for a tiny caption at the very end */
  label: string;
  tissue: THREE.Texture;
  fluoroFar: THREE.Texture;
  fluoroNear: THREE.Texture;
  /** normalised outline (0..1 space) of the tissue island inside the block */
  outline: { x: number; y: number }[];
  /** accent colour used by hint rings / mountant tint for this run */
  accent: THREE.Color;
  dispose(): void;
}

const KIND_LABEL: Record<SpecimenKind, string> = {
  gland: 'まるい　トンネルの　そしき',
  branch: 'えだわかれの　そしき',
  dense: 'つぶつぶが　あつまった　そしき',
};

// ---------------------------------------------------------------------------
// canvas helpers
// ---------------------------------------------------------------------------

function makeCanvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  return { c, g };
}

function texFrom(c: HTMLCanvasElement, aniso: number) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** soft additive dot */
function glow(
  g: CanvasRenderingContext2D, x: number, y: number, r: number,
  rgb: [number, number, number], a: number, coreBoost = 1,
) {
  const grd = g.createRadialGradient(x, y, 0, x, y, Math.max(0.6, r));
  const [R, G, B] = rgb;
  grd.addColorStop(0, `rgba(${Math.min(255, R * coreBoost) | 0},${Math.min(255, G * coreBoost) | 0},${Math.min(255, B * coreBoost) | 0},${a})`);
  grd.addColorStop(0.45, `rgba(${R},${G},${B},${a * 0.55})`);
  grd.addColorStop(1, `rgba(${R},${G},${B},0)`);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** an elongated nucleus with a little chromatin texture */
function nucleus(
  g: CanvasRenderingContext2D, r: Rng, x: number, y: number,
  rx: number, ry: number, rot: number, rgb: [number, number, number], a: number,
) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(1, ry / rx);
  glow(g, 0, 0, rx * 1.5, rgb, a * 0.5);
  glow(g, 0, 0, rx, rgb, a, 1.35);
  // chromatin speckles — invisible when defocused, delicious when sharp
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const ang = r() * TAU, rr = Math.sqrt(r()) * rx * 0.62;
    glow(g, Math.cos(ang) * rr, Math.sin(ang) * rr, rx * 0.22, rgb, a * 0.85, 1.8);
  }
  g.restore();
}

/** wobbly closed blob path, used for tissue islands and masks */
function blobPath(g: CanvasRenderingContext2D, r: Rng, cx: number, cy: number, rad: number, wob = 0.22) {
  const pts: { x: number; y: number }[] = [];
  const n = 14;
  const ph = r() * TAU;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = rad * (1 + wob * (Math.sin(a * 3 + ph) * 0.5 + Math.sin(a * 5 + ph * 2.1) * 0.32 + (r() - 0.5) * 0.35));
    pts.push({ x: cx + Math.cos(a) * k, y: cy + Math.sin(a) * k });
  }
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i % n], p2 = pts[(i + 1) % n];
    const c1x = p1.x - (p2.x - p0.x) / 6, c1y = p1.y - (p2.y - p0.y) / 6;
    if (i === 0) g.moveTo(p1.x, p1.y);
    else g.bezierCurveTo(c1x, c1y, c1x, c1y, p1.x, p1.y);
  }
  g.closePath();
  return pts;
}

// ---------------------------------------------------------------------------
// fluorescence painting
// ---------------------------------------------------------------------------

const BLUE: [number, number, number] = [86, 132, 255];
const CYAN: [number, number, number] = [110, 220, 255];
const GREEN: [number, number, number] = [70, 255, 150];
const MAG: [number, number, number] = [255, 76, 190];
const RED: [number, number, number] = [255, 96, 92];

interface PaintOpts {
  /** 1 = whole section, ~4 = cell level */
  zoom: number;
  size: number;
}

function paintGland(g: CanvasRenderingContext2D, r: Rng, o: PaintOpts) {
  const S = o.size, z = o.zoom;
  const glands: { x: number; y: number; r: number }[] = [];
  if (z > 2) {
    // Cell level: one gland fills the middle of the field and its neighbours
    // crowd in from the corners, so wherever the zoom lands there is structure.
    glands.push({ x: S * 0.5, y: S * 0.5, r: S * 0.21 });
    for (const [dx, dy] of [[0, 1], [1, 0.25], [-0.95, -0.3], [0.35, -1], [-0.5, 0.85], [0.85, -0.65]])
      glands.push({ x: S * (0.5 + dx * 0.46), y: S * (0.5 + dy * 0.46), r: S * rand(r, 0.17, 0.23) });
  } else {
    const baseR = S * 0.14;
    let guard = 0;
    while (glands.length < randInt(r, 5, 8) && guard++ < 400) {
      const rr = baseR * rand(r, 0.72, 1.3);
      const x = rand(r, rr * 1.1, S - rr * 1.1), y = rand(r, rr * 1.1, S - rr * 1.1);
      if (glands.every((q) => Math.hypot(q.x - x, q.y - y) > (q.r + rr) * 1.06)) glands.push({ x, y, r: rr });
    }
  }

  // stroma between glands: magenta fibres
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = rand(r, 0, S), y = rand(r, 0, S);
    const a = rand(r, 0, TAU), len = rand(r, S * 0.04, S * 0.16);
    g.strokeStyle = `rgba(${MAG[0]},${MAG[1]},${MAG[2]},${rand(r, 0.05, 0.16)})`;
    g.lineWidth = rand(r, 1, 3.4) * (z > 2 ? 2.2 : 1);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(
      x + Math.cos(a) * len * 0.5 + rand(r, -12, 12),
      y + Math.sin(a) * len * 0.5 + rand(r, -12, 12),
      x + Math.cos(a) * len, y + Math.sin(a) * len,
    );
    g.stroke();
  }
  // scattered stromal nuclei
  for (let i = 0; i < (z > 2 ? 26 : 60); i++) {
    const x = rand(r, 0, S), y = rand(r, 0, S);
    if (glands.some((q) => Math.hypot(q.x - x, q.y - y) < q.r * 1.02)) continue;
    const rx = S * (z > 2 ? 0.016 : 0.0058) * rand(r, 0.8, 1.5);
    nucleus(g, r, x, y, rx, rx * rand(r, 0.42, 0.7), rand(r, 0, TAU), BLUE, 0.6);
  }

  for (const q of glands) {
    // green cytoplasm annulus
    const ring = g.createRadialGradient(q.x, q.y, q.r * 0.34, q.x, q.y, q.r * 1.02);
    ring.addColorStop(0, 'rgba(70,255,150,0)');
    ring.addColorStop(0.45, 'rgba(70,255,150,0.42)');
    ring.addColorStop(0.86, 'rgba(70,255,150,0.30)');
    ring.addColorStop(1, 'rgba(70,255,150,0)');
    g.fillStyle = ring;
    g.beginPath(); g.arc(q.x, q.y, q.r * 1.02, 0, TAU); g.fill();

    // magenta basement membrane
    g.strokeStyle = `rgba(${MAG[0]},${MAG[1]},${MAG[2]},0.5)`;
    g.lineWidth = Math.max(1.5, q.r * 0.075);
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      const k = q.r * (0.99 + 0.045 * Math.sin(a * 6 + q.x));
      const px = q.x + Math.cos(a) * k, py = q.y + Math.sin(a) * k;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.stroke();

    // epithelial nuclei standing radially around the lumen
    const nn = Math.max(7, Math.round(q.r * (z > 2 ? 0.09 : 0.34)));
    for (let i = 0; i < nn; i++) {
      const a = (i / nn) * TAU + rand(r, -0.08, 0.08);
      const rr = q.r * rand(r, 0.7, 0.79);
      const nx = q.x + Math.cos(a) * rr, ny = q.y + Math.sin(a) * rr;
      const w = q.r * (z > 2 ? 0.1 : 0.115) * rand(r, 0.85, 1.2);
      nucleus(g, r, nx, ny, w, w * rand(r, 0.44, 0.62), a, BLUE, 0.85);
      if (r() < 0.16) glow(g, nx, ny, w * 0.5, CYAN, 0.5, 1.6);
    }
    // faint lumen shimmer
    glow(g, q.x, q.y, q.r * 0.5, [40, 90, 130], 0.16);
  }
}

function paintBranch(g: CanvasRenderingContext2D, r: Rng, o: PaintOpts) {
  const S = o.size, z = o.zoom;
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  const walls: { x: number; y: number; a: number; w: number }[] = [];

  const draw = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    const steps = 8;
    const pts: { x: number; y: number }[] = [];
    let cx = x, cy = y, ca = a;
    for (let i = 0; i <= steps; i++) {
      pts.push({ x: cx, y: cy });
      ca += rand(r, -0.14, 0.14);
      cx += Math.cos(ca) * (len / steps);
      cy += Math.sin(ca) * (len / steps);
    }
    // outer tube wall (green)
    g.strokeStyle = `rgba(${GREEN[0]},${GREEN[1]},${GREEN[2]},0.42)`;
    g.lineWidth = w;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    // hollow the lumen out so it reads as a tube, not a rope
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.strokeStyle = 'rgba(0,0,0,0.92)';
    g.lineWidth = w * 0.56;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    g.restore();
    // magenta fibrous sheath
    g.strokeStyle = `rgba(${MAG[0]},${MAG[1]},${MAG[2]},0.30)`;
    g.lineWidth = w * 1.5;
    g.globalAlpha = 0.55;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.stroke();
    g.globalAlpha = 1;

    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const ang = Math.atan2(p.y - pts[i - 1].y, p.x - pts[i - 1].x);
      walls.push({ x: p.x, y: p.y, a: ang, w });
    }
    if (depth <= 0 || len < S * 0.05) return;
    const branches = r() < 0.22 ? 3 : 2;
    for (let b = 0; b < branches; b++) {
      const na = ca + rand(r, 0.3, 0.95) * (b % 2 === 0 ? 1 : -1);
      draw(cx, cy, na, len * rand(r, 0.6, 0.78), w * 0.72, depth - 1);
    }
  };

  const rootA = rand(r, 0, TAU);
  if (z > 2) {
    // cell level: run two big trunks straight across the middle of the field
    draw(S * 0.5 - Math.cos(rootA) * S * 0.75, S * 0.5 - Math.sin(rootA) * S * 0.75,
      rootA, S * 0.34, S * 0.20, 2);
    const b = rootA + 1.9;
    draw(S * 0.5 - Math.cos(b) * S * 0.7, S * 0.5 - Math.sin(b) * S * 0.7, b, S * 0.3, S * 0.16, 1);
  } else {
    draw(S * 0.5 - Math.cos(rootA) * S * 0.34, S * 0.5 - Math.sin(rootA) * S * 0.34,
      rootA, S * 0.2, S * 0.075, 4);
  }

  // nuclei studded along the walls
  for (const wpt of walls) {
    if (r() > (z > 2 ? 0.85 : 0.5)) continue;
    for (const side of [-1, 1]) {
      if (r() < 0.35) continue;
      const off = wpt.w * 0.42 * side;
      const nx = wpt.x + Math.cos(wpt.a + Math.PI / 2) * off;
      const ny = wpt.y + Math.sin(wpt.a + Math.PI / 2) * off;
      const rx = wpt.w * 0.2 * rand(r, 0.8, 1.25);
      nucleus(g, r, nx, ny, rx, rx * rand(r, 0.45, 0.7), wpt.a, BLUE, 0.8);
    }
  }
  // sparse background cells
  for (let i = 0; i < (z > 2 ? 30 : 80); i++) {
    const x = rand(r, 0, S), y = rand(r, 0, S);
    const rx = S * (z > 2 ? 0.014 : 0.0055) * rand(r, 0.8, 1.6);
    nucleus(g, r, x, y, rx, rx * rand(r, 0.5, 0.8), rand(r, 0, TAU), BLUE, 0.5);
    if (r() < 0.1) glow(g, x, y, rx * 3, RED, 0.14);
  }
}

function paintDense(g: CanvasRenderingContext2D, r: Rng, o: PaintOpts) {
  const S = o.size, z = o.zoom;
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  const cs: { x: number; y: number; r: number }[] = [];
  if (z > 2) {
    cs.push({ x: S * 0.5, y: S * 0.5, r: S * 0.5 });
    for (let i = 0; i < 3; i++)
      cs.push({ x: rand(r, S * 0.2, S * 0.8), y: rand(r, S * 0.2, S * 0.8), r: S * rand(r, 0.3, 0.45) });
  } else {
    for (let i = 0; i < randInt(r, 4, 7); i++)
      cs.push({ x: rand(r, S * 0.15, S * 0.85), y: rand(r, S * 0.15, S * 0.85), r: S * rand(r, 0.13, 0.26) });
  }

  // green cytoplasm patches
  for (const c of cs) {
    const grd = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    grd.addColorStop(0, 'rgba(70,255,150,0.34)');
    grd.addColorStop(0.6, 'rgba(70,255,150,0.18)');
    grd.addColorStop(1, 'rgba(70,255,150,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(c.x, c.y, c.r, 0, TAU); g.fill();
  }
  // magenta fibrils crossing the field
  for (let i = 0; i < 46; i++) {
    const x = rand(r, -S * 0.1, S * 1.1), y = rand(r, -S * 0.1, S * 1.1);
    const a = rand(r, 0, TAU), len = rand(r, S * 0.15, S * 0.5);
    g.strokeStyle = `rgba(${MAG[0]},${MAG[1]},${MAG[2]},${rand(r, 0.05, 0.14)})`;
    g.lineWidth = rand(r, 1, 3) * (z > 2 ? 2.4 : 1);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + rand(r, -30, 30),
      y + Math.sin(a) * len * 0.5 + rand(r, -30, 30),
      x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  // the cells themselves
  const total = z > 2 ? 60 : 340;
  for (let i = 0; i < total; i++) {
    let x: number, y: number;
    if (r() < 0.78 && cs.length) {
      const c = cs[Math.floor(r() * cs.length)];
      const a = r() * TAU, rr = Math.sqrt(r()) * c.r;
      x = c.x + Math.cos(a) * rr; y = c.y + Math.sin(a) * rr;
    } else { x = rand(r, 0, S); y = rand(r, 0, S); }
    const rx = S * (z > 2 ? 0.032 : 0.0092) * rand(r, 0.75, 1.35);
    if (z > 2) {
      // at cell level draw the membrane too
      g.strokeStyle = 'rgba(70,255,150,0.30)';
      g.lineWidth = 2.4;
      g.beginPath(); g.arc(x, y, rx * 2.0, 0, TAU); g.stroke();
    }
    nucleus(g, r, x, y, rx, rx * rand(r, 0.72, 1), rand(r, 0, TAU), BLUE, 0.8);
    if (r() < 0.07) glow(g, x, y, rx * 2.4, RED, 0.4, 1.3);
  }
}

function paintFluoro(size: number, kind: SpecimenKind, seed: number, zoom: number) {
  const { c, g } = makeCanvas(size);
  const r = makeRng(seed + (zoom > 2 ? 9871 : 0));
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);

  const o: PaintOpts = { zoom, size };
  if (kind === 'gland') paintGland(g, r, o);
  else if (kind === 'branch') paintBranch(g, r, o);
  else paintDense(g, r, o);

  // tissue island edge — only for the low-power view
  if (zoom <= 2) {
    const mask = makeCanvas(size);
    mask.g.drawImage(c, 0, 0);
    mask.g.globalCompositeOperation = 'destination-in';
    const mg = mask.g;
    mg.filter = 'blur(10px)';
    mg.fillStyle = '#fff';
    blobPath(mg, makeRng(seed ^ 0x5f3a), size * 0.5, size * 0.5, size * 0.475, 0.13);
    mg.fill();
    mg.filter = 'none';
    g.globalCompositeOperation = 'copy';
    g.fillStyle = '#000';
    g.fillRect(0, 0, size, size);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(mask.c, 0, 0);
  }

  // a whisper of camera noise keeps it from looking like flat vector art
  g.globalCompositeOperation = 'lighter';
  const nr = makeRng(seed * 7 + 3);
  for (let i = 0; i < size * 2; i++) {
    const x = nr() * size, y = nr() * size;
    g.fillStyle = `rgba(120,150,190,${0.02 + nr() * 0.05})`;
    g.fillRect(x, y, 1, 1);
  }
  g.globalCompositeOperation = 'source-over';
  return c;
}

// ---------------------------------------------------------------------------
// pale "in the wax" tissue
// ---------------------------------------------------------------------------

function paintTissue(size: number, kind: SpecimenKind, seed: number) {
  const { c, g } = makeCanvas(size);
  const r = makeRng(seed);
  g.clearRect(0, 0, size, size);

  // organic island
  g.save();
  blobPath(g, makeRng(seed ^ 0x5f3a), size * 0.5, size * 0.5, size * 0.44, 0.15);
  g.clip();
  const bg = g.createRadialGradient(size * 0.45, size * 0.4, size * 0.05, size * 0.5, size * 0.5, size * 0.55);
  bg.addColorStop(0, 'rgba(226,176,190,0.95)');
  bg.addColorStop(0.6, 'rgba(206,152,172,0.9)');
  bg.addColorStop(1, 'rgba(178,130,152,0.82)');
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);

  g.lineCap = 'round';
  if (kind === 'gland') {
    for (let i = 0; i < 7; i++) {
      const x = rand(r, size * 0.2, size * 0.8), y = rand(r, size * 0.2, size * 0.8);
      const rr = size * rand(r, 0.06, 0.13);
      g.fillStyle = 'rgba(255,242,246,0.85)';
      g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(126,74,104,0.65)';
      g.lineWidth = size * 0.012;
      g.beginPath(); g.arc(x, y, rr, 0, TAU); g.stroke();
    }
  } else if (kind === 'branch') {
    const walk = (x: number, y: number, a: number, len: number, w: number, d: number) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.strokeStyle = 'rgba(132,78,108,0.6)';
      g.lineWidth = w;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = 'rgba(255,240,245,0.5)';
      g.lineWidth = w * 0.45;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      if (d <= 0) return;
      walk(x2, y2, a + rand(r, 0.3, 0.8), len * 0.7, w * 0.72, d - 1);
      walk(x2, y2, a - rand(r, 0.3, 0.8), len * 0.7, w * 0.72, d - 1);
    };
    walk(size * 0.2, size * 0.8, -0.9, size * 0.19, size * 0.045, 3);
  } else {
    for (let i = 0; i < 220; i++) {
      const x = rand(r, 0, size), y = rand(r, 0, size);
      g.fillStyle = `rgba(120,64,96,${rand(r, 0.25, 0.6)})`;
      g.beginPath(); g.arc(x, y, size * rand(r, 0.006, 0.014), 0, TAU); g.fill();
    }
  }
  g.restore();
  return c;
}

// ---------------------------------------------------------------------------

let counter = 0;

export function createSpecimen(quality: 'low' | 'high', seed = (Math.random() * 1e9) | 0): Specimen {
  const kinds: SpecimenKind[] = ['gland', 'branch', 'dense'];
  // cycle the architecture so consecutive plays are never the same kind
  const kind = kinds[counter++ % 3];
  const r = makeRng(seed);
  const fSize = quality === 'high' ? 1024 : 512;
  const tSize = 256;

  const tissue = texFrom(paintTissue(tSize, kind, seed), 1);
  const fluoroFar = texFrom(paintFluoro(fSize, kind, seed, 1), quality === 'high' ? 4 : 1);
  const fluoroNear = texFrom(paintFluoro(fSize, kind, seed, 4), quality === 'high' ? 4 : 1);

  const outline: { x: number; y: number }[] = [];
  const or = makeRng(seed ^ 0x5f3a);
  const ph = or() * TAU;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const k = 0.44 * (1 + 0.15 * (Math.sin(a * 3 + ph) * 0.5 + Math.sin(a * 5 + ph * 2.1) * 0.32));
    outline.push({ x: 0.5 + Math.cos(a) * k, y: 0.5 + Math.sin(a) * k });
  }

  const accent = new THREE.Color().setHSL(lerp(0.45, 0.62, r()), 0.75, 0.6);

  return {
    seed, kind, label: KIND_LABEL[kind], tissue, fluoroFar, fluoroNear, outline, accent,
    dispose() { tissue.dispose(); fluoroFar.dispose(); fluoroNear.dispose(); },
  };
}

export { clamp };
