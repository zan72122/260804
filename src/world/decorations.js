// Relief patterns.
//
// Each pattern is defined once as a set of 2D contours in a -1..1 box.  The
// same contours become (a) the icon on the tray chip and (b) the extruded
// relief pressed into the false bell -- so the child picks up exactly the thing
// that ends up on the finished bell.  Because the mould takes its shape from
// the false bell, every decoration survives all the way through the casting.

import * as THREE from '../core/three.js';
import { TAU, lerp } from '../core/util.js';

/* ---------- contour builders ---------- */
const poly = (n, fn) => { const p = []; for (let i = 0; i < n; i++) p.push(fn(i / n, i)); return p; };
const ellipse = (cx, cy, rx, ry, n = 26, rot = 0) =>
  poly(n, (u) => {
    const a = u * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
  });

function starPts(points, rOuter, rInner, phase = -Math.PI / 2) {
  const p = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? rInner : rOuter;
    const a = phase + (i / (points * 2)) * TAU;
    p.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return p;
}

/** ribbon between two sampled curves */
function ribbon(n, top, bot) {
  const p = [];
  for (let i = 0; i <= n; i++) p.push(top(i / n));
  for (let i = n; i >= 0; i--) p.push(bot(i / n));
  return p;
}

export const DECORS = [
  {
    key: 'star', tone: 0.9,
    contours: () => [starPts(5, 0.95, 0.42)],
  },
  {
    key: 'flower', tone: 0.55,
    contours: () => {
      const out = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        out.push(ellipse(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.42, 0.28, 22, a));
      }
      out.push(ellipse(0, 0, 0.30, 0.30, 22));
      return out;
    },
  },
  {
    key: 'wave', tone: 0.3,
    contours: () => [ribbon(30,
      (u) => [lerp(-0.98, 0.98, u), Math.sin(u * TAU * 1.5) * 0.42 + 0.20],
      (u) => [lerp(-0.98, 0.98, u), Math.sin(u * TAU * 1.5) * 0.42 - 0.26])],
  },
  {
    // a gull in flight -- the classic two-stroke silhouette a child draws
    key: 'bird', tone: 1.0,
    contours: () => [[
      [-1.00, 0.18], [-0.78, 0.46], [-0.48, 0.54], [-0.22, 0.34],
      [0.00, 0.02],
      [0.22, 0.34], [0.48, 0.54], [0.78, 0.46], [1.00, 0.18],
      [0.58, 0.04], [0.26, 0.14],
      [0.00, -0.34],
      [-0.26, 0.14], [-0.58, 0.04],
    ]],
  },
  {
    key: 'fish', tone: 0.4,
    contours: () => [[
      ...poly(20, (u) => { const a = lerp(-Math.PI * 0.78, Math.PI * 0.78, u); return [Math.cos(a) * 0.62 + 0.18, Math.sin(a) * 0.44]; }),
      [-0.44, 0.30], [-0.95, 0.60], [-0.80, 0.0], [-0.95, -0.60], [-0.44, -0.30],
    ]],
  },
  {
    key: 'leaf', tone: 0.35,
    contours: () => [[
      ...poly(16, (u) => { const a = lerp(0, Math.PI, u); return [Math.cos(a) * 0.5, 0.15 + Math.sin(a) * 0.82]; }),
      ...poly(16, (u) => { const a = lerp(Math.PI, TAU, u); return [Math.cos(a) * 0.5, 0.15 + Math.sin(a) * 0.82]; }),
      [0.0, -0.95],
    ]],
  },
  {
    key: 'spiral', tone: 0.75,
    contours: () => [ribbon(46,
      (u) => { const a = u * TAU * 2.1, r = lerp(0.14, 0.92, u); return [Math.cos(a) * r, Math.sin(a) * r]; },
      (u) => { const a = u * TAU * 2.1, r = lerp(0.14, 0.92, u) - 0.20; return [Math.cos(a) * Math.max(0.02, r), Math.sin(a) * Math.max(0.02, r)]; })],
  },
  {
    // crescent: the big disc minus an offset one, walked as a single contour
    // from one horn round the outside and back along the bite
    key: 'moon', tone: 0.2,
    contours: () => {
      const R = 0.95, r = 0.90, d = 0.38;
      const ax = (R * R - r * r + d * d) / (2 * d);
      const ay = Math.sqrt(Math.max(0, R * R - ax * ax));
      const aOut = Math.atan2(ay, ax);                       // outer horn angle
      const aIn = Math.atan2(ay, ax - d);                    // inner horn angle
      const pts = [];
      const N = 26;
      for (let i = 0; i <= N; i++) {                         // outer, the long way
        const a = lerp(aOut, Math.PI * 2 - aOut, i / N);
        pts.push([Math.cos(a) * R, Math.sin(a) * R]);
      }
      for (let i = 0; i <= N; i++) {                         // inner bite, back
        const a = lerp(Math.PI * 2 - aIn, aIn, i / N);
        pts.push([d + Math.cos(a) * r, Math.sin(a) * r]);
      }
      return [pts];
    },
  },
  {
    key: 'sun', tone: 0.95,
    contours: () => [starPts(12, 0.98, 0.56), ellipse(0, 0, 0.5, 0.5, 24)],
  },
  {
    key: 'note', tone: 0.65,
    contours: () => [
      ellipse(-0.34, -0.52, 0.40, 0.30, 22, 0.32),
      [[-0.02, -0.60], [0.16, -0.60], [0.16, 0.86], [-0.02, 0.86]],
      [[0.16, 0.86], [0.16, 0.30], [0.86, 0.62], [0.86, 0.20], [0.16, -0.12], [0.16, 0.28]],
    ],
  },
  {
    key: 'drop', tone: 0.25,
    contours: () => [[
      [0, 0.98],
      ...poly(24, (u) => { const a = lerp(Math.PI * 0.42, Math.PI * 2.58, u); return [Math.cos(a) * 0.62, Math.sin(a) * 0.62 - 0.24]; }),
    ]],
  },
  {
    key: 'ring', tone: 0.5,
    contours: () => [ribbon(30,
      (u) => { const a = u * TAU; return [Math.cos(a) * 0.95, Math.sin(a) * 0.95]; },
      (u) => { const a = u * TAU; return [Math.cos(a) * 0.62, Math.sin(a) * 0.62]; })],
  },
];

export const DECOR_KEYS = DECORS.map((d) => d.key);
const BY_KEY = Object.fromEntries(DECORS.map((d) => [d.key, d]));

/* ---------- svg icons, generated from the same contours ---------- */
const svgCache = new Map();
export function decorSvgPath(key) {
  if (svgCache.has(key)) return svgCache.get(key);
  const d = BY_KEY[key].contours().map((c) =>
    c.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 46 + 50).toFixed(1)} ${(-y * 46 + 50).toFixed(1)}`).join(' ') + ' Z'
  ).join(' ');
  svgCache.set(key, d);
  return d;
}

/** full <svg> markup for a tray chip / drag ghost */
export function decorSvg(key, fill = '#ffd9a0') {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="${decorSvgPath(key)}" fill="${fill}" stroke="rgba(60,30,12,.55)" stroke-width="2.5"
      stroke-linejoin="round" fill-rule="nonzero"/></svg>`;
}

/* ---------- 3d relief ---------- */
const geoCache = new Map();

export function decorGeometry(key) {
  if (geoCache.has(key)) return geoCache.get(key);
  const shapes = BY_KEY[key].contours().map((c) => {
    const s = new THREE.Shape();
    c.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
  });
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: 0.55, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.12,
    bevelSegments: 2, curveSegments: 4,
  });
  geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}

export function decorTone(key) { return BY_KEY[key]?.tone ?? 0.5; }

/**
 * Orient a relief so it sits flat on a surface of revolution.
 * @param {THREE.Object3D} obj
 * @param {number} theta   angle around the axis
 * @param {number} y       world height
 * @param {number} r       surface radius at that height
 * @param {number} slope   dr/dy of the profile (for tilt)
 * @param {number} size    relief half-size in metres
 */
export function orientDecor(obj, theta, y, r, slope, size) {
  const cx = Math.cos(theta), cz = Math.sin(theta);
  // outward normal of the surface of revolution
  const n = new THREE.Vector3(cx, -slope, cz).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3(-cz, 0, cx);          // around the axis
  const meridian = new THREE.Vector3().crossVectors(n, tangent).normalize();
  const m = new THREE.Matrix4().makeBasis(tangent, meridian, n);
  obj.quaternion.setFromRotationMatrix(m);
  obj.position.set(cx * r, y, cz * r).addScaledVector(n, -size * 0.16);
  obj.scale.setScalar(size);
}

/** Build the relief mesh for one placement. */
export function makeDecorMesh(key, material) {
  const m = new THREE.Mesh(decorGeometry(key), material);
  m.castShadow = true;
  m.userData.decorKey = key;
  return m;
}
