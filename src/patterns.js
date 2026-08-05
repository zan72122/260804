// Garment patterns (型紙) and fabric colourways.
//
// A pattern is authored as the RIGHT half of a symmetric silhouette, walking
// from the top of the centre line down to the bottom of the centre line, and
// is then mirrored into a closed outline. The very first stretch is flagged
// `seam = false`: that is the opening left unsewn so the garment can be
// turned right side out (返し口) — and it is exactly the neck / waistband
// hole a child expects to see on the finished piece.

import { HalfOutline } from './geom2d.js';

function dress() {
  return new HalfOutline({ x: 0, y: 1.00 })
    // scooped neckline — the turning gap
    .curve({ x: 0.15, y: 1.02 }, { x: 0.26, y: 1.29 }, { x: 0.40, y: 1.30 }, false, 16)
    // shoulder
    .curve({ x: 0.48, y: 1.31 }, { x: 0.55, y: 1.30 }, { x: 0.61, y: 1.26 }, true, 8)
    // armhole
    .curve({ x: 0.68, y: 1.08 }, { x: 0.56, y: 0.86 }, { x: 0.45, y: 0.66 }, true, 14)
    // waist and flaring skirt
    .curve({ x: 0.39, y: 0.30 }, { x: 0.70, y: -0.26 }, { x: 0.97, y: -0.90 }, true, 22)
    // hem
    .curve({ x: 0.72, y: -1.01 }, { x: 0.38, y: -1.07 }, { x: 0, y: -1.05 }, true, 16)
    .close();
}

function tee() {
  return new HalfOutline({ x: 0, y: 0.96 })
    .curve({ x: 0.12, y: 0.98 }, { x: 0.21, y: 1.22 }, { x: 0.33, y: 1.23 }, false, 16)
    // shoulder into sleeve
    .curve({ x: 0.55, y: 1.24 }, { x: 0.78, y: 1.14 }, { x: 0.95, y: 0.99 }, true, 16)
    // sleeve hem
    .curve({ x: 1.03, y: 0.90 }, { x: 1.05, y: 0.74 }, { x: 1.00, y: 0.62 }, true, 10)
    // under the sleeve
    .curve({ x: 0.84, y: 0.56 }, { x: 0.68, y: 0.53 }, { x: 0.57, y: 0.55 }, true, 12)
    // side seam
    .curve({ x: 0.60, y: 0.20 }, { x: 0.62, y: -0.44 }, { x: 0.61, y: -0.86 }, true, 18)
    .curve({ x: 0.45, y: -0.96 }, { x: 0.22, y: -0.99 }, { x: 0, y: -0.97 }, true, 14)
    .close();
}

function skirt() {
  return new HalfOutline({ x: 0, y: 0.92 })
    .curve({ x: 0.16, y: 0.93 }, { x: 0.32, y: 0.93 }, { x: 0.46, y: 0.90 }, false, 14)
    .curve({ x: 0.62, y: 0.52 }, { x: 0.86, y: 0.02 }, { x: 1.01, y: -0.80 }, true, 22)
    .curve({ x: 0.74, y: -0.94 }, { x: 0.38, y: -1.00 }, { x: 0, y: -0.98 }, true, 16)
    .close();
}

function pants() {
  return new HalfOutline({ x: 0, y: 1.02 })
    .curve({ x: 0.20, y: 1.03 }, { x: 0.42, y: 1.03 }, { x: 0.58, y: 0.98 }, false, 14)
    // outer leg
    .curve({ x: 0.66, y: 0.62 }, { x: 0.62, y: -0.20 }, { x: 0.55, y: -0.96 }, true, 20)
    // ankle hem
    .curve({ x: 0.46, y: -1.04 }, { x: 0.33, y: -1.05 }, { x: 0.23, y: -1.00 }, true, 10)
    // inseam up to the crotch
    .curve({ x: 0.17, y: -0.60 }, { x: 0.12, y: -0.26 }, { x: 0.06, y: -0.08 }, true, 18)
    .line({ x: 0, y: -0.03 }, true, 4)
    .close();
}

/** Every garment, with the extras the rest of the game needs. */
export const GARMENTS = [
  { id: 'dress', build: dress, puff: 0.30, clipHanger: false },
  { id: 'tee', build: tee, puff: 0.28, clipHanger: false },
  { id: 'skirt', build: skirt, puff: 0.27, clipHanger: true },
  { id: 'pants', build: pants, puff: 0.24, clipHanger: true },
];

/** Soft, sunny colourways. `print` selects the procedural fabric motif. */
export const COLOURWAYS = [
  { base: '#ffd7e3', ink: '#ff9ec2', accent: '#ffeaa7', thread: '#fff6fa', print: 'flower' },
  { base: '#d3e9ff', ink: '#8ec6f2', accent: '#fff0c4', thread: '#ffffff', print: 'dots' },
  { base: '#d9f3e1', ink: '#8bd8ae', accent: '#ffd3e2', thread: '#ffffff', print: 'gingham' },
  { base: '#fff1d2', ink: '#ffcb79', accent: '#c9e6ff', thread: '#fffaf0', print: 'star' },
  { base: '#ecdfff', ink: '#bda6ef', accent: '#ffe5b8', thread: '#ffffff', print: 'stripe' },
  { base: '#ffe1d2', ink: '#ffa98a', accent: '#c2e8dd', thread: '#fff8f2', print: 'check' },
  { base: '#d6f1f5', ink: '#87cfdc', accent: '#ffdbb0', thread: '#ffffff', print: 'wave' },
  { base: '#ffe4ef', ink: '#f0a8c8', accent: '#d8f0c0', thread: '#ffffff', print: 'heart' },
];

/**
 * Builds the concrete pattern for round `n`: outline points, seam flags,
 * bounds and the arc-parameter window covering the unsewn opening.
 */
export function makePattern(n) {
  const g = GARMENTS[n % GARMENTS.length];
  const c = COLOURWAYS[(n + Math.floor(n / GARMENTS.length)) % COLOURWAYS.length];
  const { pts, seam, openCount } = g.build();

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  // The sewing run starts where the opening ends and wraps around the whole
  // silhouette to the mirrored end of the opening.
  const seamStart = openCount;
  const seamEnd = pts.length - openCount;

  return {
    id: g.id,
    puff: g.puff,
    clipHanger: g.clipHanger,
    colour: c,
    outline: pts,
    seamFlags: seam,
    seamStart,
    seamEnd,
    bounds: { minX, maxX, minY, maxY },
  };
}
