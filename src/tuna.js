// ---------------------------------------------------------------------------
//  The giant bluefin.
//
//  Built as real, separable geometry: the head/collar, the upper loin (in four
//  future-saku segments) and the lower half with the frame are independent
//  solids that start flush against each other. Nothing is faked with opacity —
//  the crimson median faces genuinely exist inside the fish and are genuinely
//  occluded until the loin is lifted away. That is the payoff moment.
//
//  Local frame:  +X -> nose,  +Y -> dorsal,  +Z -> the fish's right flank.
//  u = 0 at the tail root, u = 1 at the snout.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { curve, clamp, lerp, smoothstep, buildGrid, orientGeometry } from './util.js';
import { skinTexture, fleshTexture } from './textures.js';

export const NOSE_X = 1.22;
export const TAIL_X = -1.22;
export const BODY_LEN = NOSE_X - TAIL_X;              // 2.44 m of body …
export const TOTAL_LEN = 2.68;                        // … 2.68 m including the tail fin
export const X_OF = (u) => lerp(TAIL_X, NOSE_X, u);

/** Full dorsal-ventral height of the body at station u (metres). */
const HFULL = curve([
  [0.000, 0.012], [0.030, 0.062], [0.070, 0.104], [0.105, 0.146],
  [0.160, 0.242], [0.240, 0.358], [0.340, 0.478], [0.450, 0.566],
  [0.560, 0.622], [0.650, 0.646], [0.740, 0.614], [0.830, 0.522],
  [0.900, 0.418], [0.950, 0.302], [0.985, 0.168], [1.000, 0.044],
]);
/** Full lateral width at station u (metres). */
const WFULL = curve([
  [0.000, 0.010], [0.030, 0.040], [0.070, 0.068], [0.105, 0.094],
  [0.160, 0.154], [0.240, 0.232], [0.340, 0.314], [0.450, 0.376],
  [0.560, 0.412], [0.650, 0.422], [0.740, 0.402], [0.830, 0.352],
  [0.900, 0.292], [0.950, 0.216], [0.985, 0.122], [1.000, 0.034],
]);
/** The lateral line — the body axis is not perfectly straight. */
const YAX = curve([
  [0.000, 0.004], [0.200, 0.012], [0.450, 0.014], [0.700, 0.006],
  [0.880, -0.012], [1.000, -0.052],
]);

export const yTopOf = (u) => YAX(u) + 0.47 * HFULL(u);
export const yBotOf = (u) => YAX(u) - 0.53 * HFULL(u);
export const halfWidthOf = (u) => 0.5 * WFULL(u);

/** Collar cut: angled, running behind the head high on the back and further
 *  forward under the belly — exactly where a butcher takes the kama off. */
export const U_COLLAR = (a) => 0.762 - 0.054 * Math.sin(a);
const U_COLLAR_TOP = U_COLLAR(Math.PI / 2);

/** Where the four saku segments of the upper loin divide. */
export const SAKU_U = [0.145, 0.300, 0.452, 0.604, 1.0];
export const LOIN_U0 = SAKU_U[0];

const SECTION_N = 2.35;                                // super-ellipse fullness
function sectionK(a, out) {
  const e = 2 / SECTION_N;
  const s = Math.sin(a), c = Math.cos(a);
  out[0] = Math.sign(s) * Math.pow(Math.abs(s), e);
  out[1] = Math.sign(c) * Math.pow(Math.abs(c), e);
  return out;
}
const _k = [0, 0];

/** A point on the body surface. a = 0 -> right flank(+Z), a = PI/2 -> dorsal. */
export function bodyPoint(u, a, out) {
  sectionK(a, _k);
  const y0 = YAX(u);
  const h = _k[0] >= 0 ? 0.47 * HFULL(u) : 0.53 * HFULL(u);
  return out.set(X_OF(u), y0 + _k[0] * h, _k[1] * 0.5 * WFULL(u));
}

/* -------------------------------------------------------------- colours -- */

const C = (hex) => new THREE.Color(hex);
const SKIN_DORSAL = C('#101c27');
const SKIN_UPPER = C('#2f4356');
const SKIN_FLANK = C('#8ba1b1');
const SKIN_SHEEN = C('#c8d6e0');
const SKIN_BELLY = C('#dfe8ec');

const _c1 = new THREE.Color(), _c2 = new THREE.Color();

function skinColor(u, a, out) {
  const s = Math.sin(a);
  out.copy(SKIN_FLANK);
  // bright lateral flash just below the mid-line
  out.lerp(SKIN_SHEEN, Math.exp(-Math.pow((s + 0.06) / 0.20, 2)) * 0.85);
  out.lerp(SKIN_UPPER, smoothstep(0.10, 0.52, s));
  out.lerp(SKIN_DORSAL, smoothstep(0.34, 0.86, s));
  out.lerp(SKIN_BELLY, smoothstep(-0.12, -0.66, s));
  // the head and gill plate carry a cooler, harder sheen
  const headness = smoothstep(0.70, 0.95, u);
  out.lerp(_c1.setRGB(out.r * 0.86, out.g * 0.94, out.b * 1.06), headness * 0.55);
  // gill cover seam
  const gill = Math.exp(-Math.pow((u - 0.808) / 0.012, 2));
  out.lerp(_c2.setStyle('#4a5c6b'), gill * 0.55 * smoothstep(0.9, 0.4, Math.abs(s)));
  return out;
}

const FLESH_STOPS = [
  [0.00, C('#6f0f12')], [0.28, C('#8f1519')], [0.52, C('#b02f28')],
  [0.74, C('#d16a5c')], [0.90, C('#e79c8c')], [1.00, C('#f3c0b0')],
];
const CHIAI = C('#5d151d');
const FATLINE = C('#f8e6d8');

/** toro = 0 deep akami … 1 pale otoro. */
export function fleshColor(toro, chiai, rim, out) {
  const t = clamp(toro, 0, 1);
  let i = 0;
  while (i < FLESH_STOPS.length - 2 && t > FLESH_STOPS[i + 1][0]) i++;
  const a = FLESH_STOPS[i], b = FLESH_STOPS[i + 1];
  out.copy(a[1]).lerp(b[1], (t - a[0]) / (b[0] - a[0]));
  if (chiai > 0) out.lerp(CHIAI, chiai);
  if (rim > 0) out.lerp(FATLINE, rim);
  return out;
}

/** Grade across the median cut face. v = 0 at the belly, 1 at the back. */
function medianFlesh(u, v, out) {
  // Belly end fatty and pale, back end deep akami, with the dark lateral
  // stripe where the chiai runs. The proportions match a real loin.
  const toro = clamp(smoothstep(0.66, -0.06, v) * 0.98 + 0.12 * smoothstep(0.50, 0.90, u), 0, 1);
  const chiai = Math.exp(-Math.pow((v - 0.575) / 0.048, 2)) * 0.62;
  const rim = smoothstep(0.045, 0.0, v) * 0.75 + smoothstep(0.955, 1.0, v) * 0.65;
  return fleshColor(toro, chiai, rim, out);
}

/* ------------------------------------------------------------ geometry --- */

function buildSkin(a0, a1, na, uLo, uHi, nu) {
  return buildGrid((si, sj, p, col, o) => {
    const a = lerp(a0, a1, si);
    const u = lerp(uLo(a), uHi(a), sj);
    bodyPoint(u, a, p);
    skinColor(u, a, col);
    o.uv[0] = u * 2.6;
    o.uv[1] = a * 0.30;
  }, na, nu, false);
}

/** The big flat cut face lying in the median plane. */
function buildMedianCap(u0, u1Fn, ns, nv, forTop) {
  const g = buildGrid((si, sj, p, col, o) => {
    const v = sj;
    const u = lerp(u0, u1Fn(v), si);
    p.set(X_OF(u), lerp(yBotOf(u), yTopOf(u), v), 0);
    medianFlesh(u, v, col);
    o.uv[0] = u * 2.3;
    o.uv[1] = v * 0.95;
  }, ns, nv, !forTop);
  return g;
}

/** Half-disc fan closing a cross-cut. `rim(k)` walks a = -PI/2 … +PI/2. */
function buildHalfFan(uFn, nr, na, expected, gradeShift = 0) {
  const cTop = new THREE.Vector3(), cBot = new THREE.Vector3(), center = new THREE.Vector3();
  bodyPoint(uFn(Math.PI / 2), Math.PI / 2, cTop);
  bodyPoint(uFn(-Math.PI / 2), -Math.PI / 2, cBot);
  center.copy(cTop).lerp(cBot, 0.5);
  const rim = new THREE.Vector3();
  const g = buildGrid((si, sj, p, col, o) => {
    const r = Math.max(si, 0.004) * 0.984;
    const a = lerp(-Math.PI / 2, Math.PI / 2, sj);
    bodyPoint(uFn(a), a, rim);
    p.copy(center).lerp(rim, r);
    // grade the fan by height, same rule as the median face
    const v = clamp((p.y - cBot.y) / Math.max(1e-4, cTop.y - cBot.y), 0, 1);
    const uu = clamp((p.x - TAIL_X) / BODY_LEN, 0, 1);
    medianFlesh(uu, v, col);
    if (gradeShift) col.lerp(_c1.setStyle('#f3b0a2'), gradeShift);
    o.uv[0] = sj * 2.4;
    o.uv[1] = r * 1.15;
  }, nr, na, false);
  return orientGeometry(g, expected);
}

/** Full ring fan — closes the collar end of the head. */
function buildRingFan(uFn, nr, na, expected) {
  const center = new THREE.Vector3(X_OF(uFn(0)), YAX(uFn(0)) - 0.02, 0);
  const rim = new THREE.Vector3();
  let yLo = Infinity, yHi = -Infinity;
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    bodyPoint(uFn(a), a, rim);
    yLo = Math.min(yLo, rim.y); yHi = Math.max(yHi, rim.y);
  }
  const g = buildGrid((si, sj, p, col, o) => {
    const r = Math.max(si, 0.004) * 0.984;
    const a = sj * Math.PI * 2;
    bodyPoint(uFn(a), a, rim);
    p.copy(center).lerp(rim, r);
    const v = clamp((p.y - yLo) / Math.max(1e-4, yHi - yLo), 0, 1);
    medianFlesh(0.78, v, col);
    o.uv[0] = sj * 3.0;
    o.uv[1] = r * 1.1;
  }, nr, na, false);
  return orientGeometry(g, expected);
}

/* ----------------------------------------------------------------- fins -- */

function extrudeShape(pts, depth) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const q = pts[i];
    if (q.length === 2) s.lineTo(q[0], q[1]);
    else s.quadraticCurveTo(q[0], q[1], q[2], q[3]);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.5,
    bevelSegments: 2, curveSegments: 14,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

function caudalFin() {
  // deeply forked lunate tail — the single most recognisable tuna silhouette
  const pts = [
    [-1.150, 0.040],
    [-1.250, 0.180, -1.395, 0.455],          // leading edge to the upper tip
    [-1.360, 0.250, -1.298, 0.010],          // concave trailing edge to the fork
    [-1.360, -0.235, -1.392, -0.430],        // down to the lower tip
    [-1.248, -0.170, -1.150, -0.040],        // back along the lower leading edge
  ];
  const g = extrudeShape(pts, 0.020);
  return g;
}

function dorsalFin1() {
  const pts = [
    [0.552, 0.318], [0.606, 0.470, 0.652, 0.492], [0.700, 0.430, 0.742, 0.322],
  ];
  return extrudeShape(pts, 0.014);
}
function dorsalFin2() {
  const pts = [[0.386, 0.318], [0.418, 0.398, 0.452, 0.402], [0.470, 0.372, 0.486, 0.318]];
  return extrudeShape(pts, 0.012);
}
function analFin() {
  const pts = [[0.318, -0.318], [0.350, -0.400, 0.386, -0.404], [0.404, -0.374, 0.420, -0.318]];
  return extrudeShape(pts, 0.012);
}

function finlet(size) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(size * 0.9, size * 0.72); s.lineTo(size * 1.5, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.007, bevelEnabled: false });
  g.translate(0, 0, -0.0035);
  return g;
}

function pectoralFin() {
  // long, sabre-like, curving back and down along the flank
  return buildGrid((si, sj, p, col, o) => {
    const t = sj;                                     // 0 root … 1 tip
    const w = si;                                     // across the chord
    const len = 0.46;
    const chord = 0.135 * (1 - t * 0.86);
    const x = -len * t;
    const y = -0.055 * t * t - 0.02;
    const z = 0.020 + 0.055 * Math.sin(t * 2.4) - 0.03 * t;
    p.set(x + (w - 0.5) * chord * 0.55, y + (w - 0.5) * chord, z);
    col.setRGB(0.16, 0.21, 0.27);
    o.uv[0] = sj; o.uv[1] = si;
  }, 8, 18, false);
}

/* -------------------------------------------------------------- saku bar -- */

/** A trimmed rectangular saku block with rounded edges and marbled ends. */
export function buildSakuGeometry(len, hy, hz, toroLo, toroHi) {
  const n = 4.2;
  const sect = (a, out) => {
    const s = Math.sin(a), c = Math.cos(a), e = 2 / n;
    out[0] = Math.sign(s) * Math.pow(Math.abs(s), e);
    out[1] = Math.sign(c) * Math.pow(Math.abs(c), e);
  };
  const kk = [0, 0];
  const shell = buildGrid((si, sj, p, col, o) => {
    const a = si * Math.PI * 2;
    sect(a, kk);
    const x = lerp(-len / 2, len / 2, sj);
    const taper = 1 - 0.06 * Math.pow(Math.abs(sj - 0.5) * 2, 3);
    p.set(x, kk[0] * hy * taper, kk[1] * hz * taper);
    const v = clamp(0.5 + kk[1] * 0.5, 0, 1);          // graded across the block
    const belowSkin = smoothstep(-0.55, -0.95, kk[0]);
    fleshColor(lerp(toroLo, toroHi, v), 0.16 * Math.exp(-Math.pow((v - 0.32) / 0.12, 2)),
      smoothstep(-0.70, -1.0, kk[0]) * 0.55, col);
    if (belowSkin > 0.6) col.lerp(_c1.setStyle('#cfd8dd'), (belowSkin - 0.6) * 2.0);
    o.uv[0] = sj * 2.0; o.uv[1] = si * 1.6;
  }, 30, 10, false);

  const caps = [];
  for (const s of [-1, 1]) {
    const g = buildGrid((si, sj, p, col, o) => {
      const r = Math.max(si, 0.006);
      const a = sj * Math.PI * 2;
      sect(a, kk);
      p.set((s * len) / 2, kk[0] * hy * r * 0.94, kk[1] * hz * r * 0.94);
      const v = clamp(0.5 + kk[1] * r * 0.5, 0, 1);
      fleshColor(lerp(toroLo, toroHi, v), 0.20 * Math.exp(-Math.pow((v - 0.34) / 0.13, 2)), 0, col);
      o.uv[0] = sj * 2.6; o.uv[1] = r * 1.2;
    }, 8, 30, false);
    caps.push(orientGeometry(g, new THREE.Vector3(s, 0, 0)));
  }
  return { shell, caps };
}

/* ----------------------------------------------------------- assembly ---- */

export function createTuna() {
  const skinTex = skinTexture();
  const fleshTex = fleshTexture();

  const matSkin = new THREE.MeshPhysicalMaterial({
    vertexColors: true, map: skinTex,
    roughness: 0.30, metalness: 0.0,
    clearcoat: 0.66, clearcoatRoughness: 0.20,
    iridescence: 0.30, iridescenceIOR: 1.24, iridescenceThicknessRange: [120, 420],
    sheen: 0.28, sheenRoughness: 0.5, sheenColor: new THREE.Color('#bcd6e8'),
    envMapIntensity: 0.85,
  });
  const matFlesh = new THREE.MeshPhysicalMaterial({
    vertexColors: true, map: fleshTex,
    // Flesh is wet, not lacquered. A default 4% white specular under a 3.3
    // key is enough on its own to turn deep akami into pale salmon, so the
    // whole specular stack is dialled right back and the albedo carries it.
    roughness: 0.62, metalness: 0.0,
    specularIntensity: 0.30,
    clearcoat: 0.0,
    sheen: 0.06, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffb0a0'),
    envMapIntensity: 0.22,
  });
  const matFin = new THREE.MeshStandardMaterial({
    color: '#28323d', roughness: 0.52, metalness: 0.05, vertexColors: false,
    side: THREE.DoubleSide, envMapIntensity: 0.8,
  });
  const matPect = new THREE.MeshStandardMaterial({
    color: '#2b3a48', roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.8,
  });
  const matFinlet = new THREE.MeshStandardMaterial({ color: '#dcb636', roughness: 0.42, envMapIntensity: 0.9 });
  const matBone = new THREE.MeshPhysicalMaterial({
    color: '#e2d5be', roughness: 0.62, clearcoat: 0.18, envMapIntensity: 0.4,
  });
  const matEye = new THREE.MeshPhysicalMaterial({
    color: '#0b1015', roughness: 0.06, clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 1.6,
  });

  const root = new THREE.Group();
  root.name = 'tuna';

  const mesh = (g, m, cast = true) => {
    const o = new THREE.Mesh(g, m);
    o.castShadow = cast; o.receiveShadow = true;
    return o;
  };

  /* ---- lower half + frame (keeps the tail, the fins and the backbone) ---- */
  const lower = new THREE.Group();
  lower.name = 'loinLower';
  {
    const skin = buildSkin(Math.PI / 2, Math.PI * 1.5, 42, () => 0.0, (a) => U_COLLAR(a) + 0.008, 56);
    lower.add(mesh(skin, matSkin));

    const cap = buildMedianCap(0.0, (v) => U_COLLAR(lerp(-Math.PI / 2, Math.PI / 2, v)) + 0.008, 60, 30, false);
    lower.add(mesh(cap, matFlesh));

    // backbone: a clean ivory ridge running the length of the exposed face
    const spine = buildGrid((si, sj, p, col, o) => {
      const u = lerp(0.03, U_COLLAR(0) - 0.005, sj);
      const a = si * Math.PI * 2;
      const yS = lerp(yBotOf(u), yTopOf(u), 0.585);
      const r = 0.016 + 0.020 * (HFULL(u) / 0.646);
      const seg = 1 + 0.085 * Math.cos(u * 108);
      p.set(X_OF(u), yS + Math.sin(a) * r * seg, Math.cos(a) * r * seg * 0.9);
      col.setStyle('#d9cbb2');
      col.multiplyScalar(0.78 + 0.22 * (0.5 + 0.5 * Math.cos(u * 108)));
      o.uv[0] = sj * 4; o.uv[1] = si;
    }, 18, 90, false);
    lower.add(mesh(spine, matBone));

    // median fins stay with the frame
    const tail = mesh(caudalFin(), matFin); lower.add(tail);
    lower.add(mesh(dorsalFin1(), matFin));
    lower.add(mesh(dorsalFin2(), matFin));
    lower.add(mesh(analFin(), matFin));

    const fg = finlet(0.052);
    for (let i = 0; i < 9; i++) {
      const u = lerp(0.115, 0.352, i / 8);
      const f = new THREE.Mesh(fg, matFinlet);
      f.position.set(X_OF(u), yTopOf(u) - 0.004, 0);
      f.castShadow = true;
      lower.add(f);
    }
    const fg2 = finlet(0.048);
    for (let i = 0; i < 8; i++) {
      const u = lerp(0.128, 0.330, i / 7);
      const f = new THREE.Mesh(fg2, matFinlet);
      f.position.set(X_OF(u), yBotOf(u) + 0.004, 0);
      f.rotation.z = Math.PI;
      f.castShadow = true;
      lower.add(f);
    }
    // The loin is taken forward of the peduncle, so the upper half of the tail
    // section belongs to the frame. Without it the loin's rear cut face would
    // be visible as a red band before a single cut had been made.
    const tailBlock = new THREE.Group();
    const tailHi = () => LOIN_U0 + 0.008;
    tailBlock.add(mesh(buildSkin(-Math.PI / 2, Math.PI / 2, 22, () => 0.0, tailHi, 18), matSkin));
    tailBlock.add(mesh(buildMedianCap(0.0, tailHi, 18, 24, true), matFlesh));
    tailBlock.add(mesh(buildHalfFan(tailHi, 8, 26, new THREE.Vector3(1, 0, 0)), matFlesh));
    lower.add(tailBlock);

    // the lateral keels on the caudal peduncle
    for (const s of [-1, 1]) {
      const keel = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.016, 0.030), matFin);
      keel.position.set(X_OF(0.058), YAX(0.058), s * 0.028);
      keel.castShadow = true;
      lower.add(keel);
    }
  }
  lower.position.z = 0;
  root.add(lower);

  /* ---- upper loin: four segments, flush now, saku later ---- */
  const upper = new THREE.Group();
  upper.name = 'loinUpper';
  const segments = [];
  // Each segment reaches OVER the next one's rear face by OVERLAP, so no
  // crimson sliver of a hidden cut face can peek through a seam.
  const OVERLAP = 0.008;
  for (let p = 0; p < 4; p++) {
    const u0 = SAKU_U[p];
    const u1 = SAKU_U[p + 1];
    const last = p === 3;
    const uHi = last ? (a) => U_COLLAR(a) + OVERLAP : () => u1 + OVERLAP;
    const seg = new THREE.Group();
    seg.name = `loinSeg${p}`;

    seg.add(mesh(buildSkin(-Math.PI / 2, Math.PI / 2, 26, () => u0, uHi, last ? 26 : 22), matSkin));
    seg.add(mesh(buildMedianCap(u0, (v) => uHi(lerp(-Math.PI / 2, Math.PI / 2, v)), 26, 30, true), matFlesh));

    // The faces between adjacent segments are coincident with the neighbour's
    // skin, so while the loin is still one piece they are switched off
    // entirely rather than left to fight for the depth buffer.
    const capRear = mesh(buildHalfFan(() => u0, 9, 30, new THREE.Vector3(-1, 0, 0)), matFlesh);
    const capFront = mesh(buildHalfFan(uHi, 9, 30, new THREE.Vector3(1, 0, 0)), matFlesh);
    capRear.visible = false;
    capFront.visible = last;                       // the collar face is needed early
    seg.add(capRear, capFront);
    seg.userData.capRear = capRear;
    seg.userData.capFront = capFront;

    seg.userData.pivot = new THREE.Vector3(X_OF((u0 + Math.min(u1, U_COLLAR_TOP)) / 2), YAX((u0 + u1) / 2), 0);
    segments.push(seg);
    upper.add(seg);
  }
  upper.position.z = -0.0012;
  root.add(upper);

  /* ---- head + collar (kama), with the pectoral fins ---- */
  const head = new THREE.Group();
  head.name = 'head';
  {
    head.add(mesh(buildSkin(0, Math.PI * 2, 54, U_COLLAR, () => 1.0, 26), matSkin));
    head.add(mesh(buildRingFan(U_COLLAR, 9, 54, new THREE.Vector3(-1, 0, 0)), matFlesh));

    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 22, 16), matEye);
      const uu = 0.918;
      eye.position.set(X_OF(uu), YAX(uu) + 0.062, s * halfWidthOf(uu) * 0.80);
      eye.castShadow = true;
      head.add(eye);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.010, 8, 24), matSkin);
      ring.position.copy(eye.position);
      ring.rotation.y = Math.PI / 2;
      head.add(ring);
      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 10, 8),
        new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      );
      glint.position.copy(eye.position).add(new THREE.Vector3(0.018, 0.020, s * 0.036));
      head.add(glint);

      const pf = new THREE.Mesh(pectoralFin(), matPect);
      pf.position.set(X_OF(0.792), YAX(0.792) - 0.03, s * halfWidthOf(0.792) * 0.86);
      pf.scale.z = s;
      pf.castShadow = true;
      head.add(pf);
    }
    // closed jaw seam, kept neutral and calm
    const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 20, Math.PI * 0.9), matSkin);
    jaw.position.set(X_OF(0.972), YAX(0.972) - 0.028, 0);
    jaw.rotation.set(Math.PI / 2, 0, -0.5);
    head.add(jaw);
  }
  head.position.x = 0.010;
  root.add(head);

  /* ---- guide anchors, used to build the cut paths ---- */
  const bbox = new THREE.Box3().setFromObject(root);

  return {
    root, head, upper, lower, segments,
    materials: { matSkin, matFlesh, matFin, matBone, matFinlet },
    bbox,
    U_COLLAR_TOP,
  };
}
