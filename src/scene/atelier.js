// The workshop. Everything is modelled at true scale in meters so that depth,
// occlusion and parallax read correctly: the bench top is y = 0.
//
// Layering, deliberately separated so a glance reads the depth:
//   FAR  (z < -1.4)  shoji glow, timber posts, hanging bundles - silhouettes in haze
//   MID  (-1.4..-0.4) back shelf, paper stock, jars, indigo noren
//   NEAR (-0.4..0.4)  the bench itself and every tool the child touches

import { mat4 } from '../core/math.js';
import * as G from '../core/geometry.js';
import * as GL from '../core/gl.js';

const M = (t = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => mat4.fromTRS(mat4.create(), t, r, s);

export const MAT = {
  tatami: { baseColor: [0.105, 0.098, 0.052], roughness: 0.85, matType: 8, wear: 0.5 },
  plaster: { baseColor: [0.088, 0.076, 0.062], roughness: 0.92, matType: 5, wear: 0.4 },
  timber: { baseColor: [0.030, 0.021, 0.015], roughness: 0.78, matType: 1, wear: 0.7 },
  postWood: { baseColor: [0.052, 0.034, 0.022], roughness: 0.7, matType: 1, wear: 0.6 },
  benchTop: { baseColor: [0.098, 0.058, 0.031], roughness: 0.52, matType: 1, wear: 0.75 },
  shojiPaper: { baseColor: [0.60, 0.54, 0.43], roughness: 0.95, matType: 4, emissive: 1.55, translucency: 0.6 },
  shojiFrame: { baseColor: [0.040, 0.028, 0.019], roughness: 0.7, matType: 1, wear: 0.5 },
  hide: { baseColor: [0.075, 0.048, 0.030], roughness: 0.88, matType: 7, wear: 0.6 },
  washi: { baseColor: [0.215, 0.150, 0.085], roughness: 0.86, matType: 4, wear: 0.45 },
  washiPale: { baseColor: [0.34, 0.30, 0.23], roughness: 0.9, matType: 4, wear: 0.3 },
  bamboo: { baseColor: [0.190, 0.150, 0.070], roughness: 0.36, matType: 3, wear: 0.4 },
  lacquer: { baseColor: [0.0125, 0.0075, 0.0065], roughness: 0.16, matType: 2, wear: 0.45 },
  lacquerRim: { baseColor: [0.085, 0.012, 0.010], roughness: 0.13, matType: 2, wear: 0.4 },
  iron: { baseColor: [0.075, 0.072, 0.070], roughness: 0.40, metalness: 1, matType: 6, wear: 0.8 },
  brass: { baseColor: [0.62, 0.44, 0.18], roughness: 0.34, metalness: 1, matType: 6, wear: 0.7 },
  bristle: { baseColor: [0.145, 0.115, 0.085], roughness: 0.62, matType: 9, wear: 0.3 },
  cotton: { baseColor: [0.52, 0.48, 0.42], roughness: 0.95, matType: 9, wear: 0.2 },
  indigo: { baseColor: [0.022, 0.030, 0.062], roughness: 0.85, matType: 9, wear: 0.4, translucency: 0.5 },
  ceramic: { baseColor: [0.055, 0.058, 0.062], roughness: 0.22, matType: 2, wear: 0.3 },
  stone: { baseColor: [0.048, 0.046, 0.044], roughness: 0.6, matType: 5, wear: 0.6 },
};

function node(gl, geo, mat, model = mat4.create(), opts = {}) {
  const packed = G.pack(geo);
  return {
    mesh: GL.createMesh(gl, packed.data, packed.indices),
    model,
    mat,
    castShadow: opts.castShadow !== false,
    visible: true,
    name: opts.name,
  };
}

/** A shoji screen: glowing washi behind a kumiko lattice. */
function shoji(w, h, cols, rows) {
  const parts = [];
  const frame = 0.028, bar = 0.010, depth = 0.030;
  parts.push(G.translated(G.box(w, frame, depth), 0, h / 2 - frame / 2, 0));
  parts.push(G.translated(G.box(w, frame, depth), 0, -h / 2 + frame / 2, 0));
  parts.push(G.translated(G.box(frame, h, depth), -w / 2 + frame / 2, 0, 0));
  parts.push(G.translated(G.box(frame, h, depth), w / 2 - frame / 2, 0, 0));
  for (let i = 1; i < cols; i++) {
    parts.push(G.translated(G.box(bar, h - frame * 2, depth * 0.6), -w / 2 + (w / cols) * i, 0, 0.004));
  }
  for (let j = 1; j < rows; j++) {
    parts.push(G.translated(G.box(w - frame * 2, bar, depth * 0.6), 0, -h / 2 + (h / rows) * j, 0.004));
  }
  return { lattice: G.merge(...parts), paper: G.translated(G.quadXY(w - frame, h - frame, { uvScale: 0.25 }), 0, 0, -0.014) };
}

/** Stack of beaten-paper sheets (箔打ち紙) — slightly irregular, like a real bundle. */
export function paperStack(w, d, sheets, gap) {
  const parts = [];
  for (let i = 0; i < sheets; i++) {
    const jx = (Math.sin(i * 12.9898) * 0.5) * 0.004;
    const jz = (Math.sin(i * 78.233) * 0.5) * 0.004;
    const ry = Math.sin(i * 3.1) * 0.012;
    parts.push(G.placed(G.box(w, gap * 0.92, d, { uvScale: 0.05 }),
      [jx, gap * (i + 0.5), jz], [0, ry, 0]));
  }
  return G.merge(...parts);
}

export function buildAtelier(gl) {
  const nodes = [];
  const add = (geo, mat, model, opts) => {
    const n = node(gl, geo, mat, model, opts);
    nodes.push(n);
    return n;
  };

  // ---------------- FAR ----------------
  // Tatami floor, 0.75 m below the bench top.
  add(G.planeGrid(7, 7, 1, 1, { uvScale: 0.9 }), MAT.tatami, M([0, -0.75, -1.0]), { castShadow: false });

  // Back plaster wall + two shoji bays that carry the key light.
  add(G.translated(G.quadXY(6.4, 3.0, { uvScale: 0.8 }), 0, 0.65, -2.55), MAT.plaster, M([0, 0, 0]), { castShadow: false });
  for (const x of [-0.98, 0.98]) {
    const s = shoji(1.62, 1.55, 4, 6);
    add(G.translated(s.paper, x, 0.42, -2.42), MAT.shojiPaper, M([0, 0, 0]), { castShadow: false });
    add(G.translated(s.lattice, x, 0.42, -2.40), MAT.shojiFrame, M([0, 0, 0]), { castShadow: false });
  }
  // Sill and header timber.
  add(G.translated(G.box(6.4, 0.10, 0.14), 0, -0.36, -2.40), MAT.timber, M(), { castShadow: false });
  add(G.translated(G.box(6.4, 0.16, 0.16), 0, 1.24, -2.40), MAT.timber, M(), { castShadow: false });
  // Ceiling beams recede overhead — strong silhouettes against the glow.
  for (let i = 0; i < 4; i++) {
    add(G.translated(G.box(6.4, 0.14, 0.13), 0, 1.62, -2.1 + i * 0.62), MAT.timber, M(), { castShadow: false });
  }
  // Corner posts.
  for (const x of [-2.15, 2.15]) {
    add(G.translated(G.box(0.15, 2.6, 0.15), x, 0.55, -2.3), MAT.postWood, M(), { castShadow: false });
  }
  // Indigo noren hung left of frame: a soft, dark vertical silhouette.
  for (let i = 0; i < 3; i++) {
    add(G.translated(G.quadXY(0.30, 0.86, { uvScale: 0.2 }), -1.62 + i * 0.315, 0.62, -1.72),
      MAT.indigo, M(), { castShadow: false });
  }
  add(G.translated(G.cylinder(0.016, 0.016, 1.1, 10), -1.78, 1.03, -1.72),
    MAT.postWood, M([0, 0, 0], [0, 0, Math.PI / 2]), { castShadow: false });

  // ---------------- MID ----------------
  // Back shelf holding paper stock and jars; sits between wall and bench.
  add(G.translated(G.box(2.05, 0.045, 0.42), 0, -0.10, -1.05), MAT.postWood, M());
  for (const x of [-0.94, 0.94]) {
    add(G.translated(G.box(0.06, 0.65, 0.38), x, -0.44, -1.05), MAT.postWood, M());
  }
  add(G.translated(paperStack(0.30, 0.30, 16, 0.006), -0.62, -0.077, -1.03), MAT.washi, M());
  add(G.translated(paperStack(0.26, 0.26, 22, 0.005), -0.20, -0.077, -1.08), MAT.washiPale, M());
  // Lidded jars of glue and ash lye.
  add(G.translated(G.lathe([[0, 0], [0.055, 0.005], [0.065, 0.06], [0.048, 0.13], [0.052, 0.145], [0.030, 0.152], [0, 0.155]], 28),
    0.32, -0.077, -1.03), MAT.ceramic, M());
  add(G.translated(G.lathe([[0, 0], [0.048, 0.004], [0.056, 0.05], [0.040, 0.11], [0.044, 0.12], [0, 0.126]], 28),
    0.52, -0.077, -1.10), MAT.ceramic, M());
  // Bundled bamboo tools standing in a pot.
  add(G.translated(G.lathe([[0, 0], [0.052, 0.004], [0.056, 0.10], [0.050, 0.14], [0, 0.142]], 24),
    0.76, -0.077, -1.02), MAT.stone, M());
  for (let i = 0; i < 6; i++) {
    const a = i * 1.04;
    add(G.translated(G.cylinder(0.0035, 0.003, 0.30, 7), 0.76 + Math.cos(a) * 0.022, -0.045, -1.02 + Math.sin(a) * 0.022),
      MAT.bamboo, M([0, 0, 0], [Math.sin(a) * 0.10, 0, -Math.cos(a) * 0.10]));
  }

  // ---------------- NEAR: the bench ----------------
  // 1.42 x 0.78 keyaki top, 45 mm thick, top face exactly at y = 0.
  add(G.translated(G.chamferBox(1.42, 0.045, 0.78, 0.004), 0, -0.0225, 0), MAT.benchTop, M());
  add(G.translated(G.box(1.44, 0.018, 0.80), 0, -0.052, 0), MAT.postWood, M());
  for (const [x, z] of [[-0.62, -0.30], [0.62, -0.30], [-0.62, 0.30], [0.62, 0.30]]) {
    add(G.translated(G.box(0.070, 0.70, 0.070), x, -0.41, z), MAT.postWood, M());
  }
  add(G.translated(G.box(1.28, 0.05, 0.05), 0, -0.60, -0.30), MAT.postWood, M());
  add(G.translated(G.box(1.28, 0.05, 0.05), 0, -0.60, 0.30), MAT.postWood, M());

  return nodes;
}

/** Airborne particulate: fine paper dust in the light shafts, gold flecks on demand. */
export function buildMotes(gl, count = 320) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 0.6);
    pos[i * 3] = (Math.random() - 0.5) * 1.15;
    pos[i * 3 + 1] = 0.01 + Math.random() * 0.42;
    pos[i * 3 + 2] = -0.55 + Math.random() * 0.95 * r;
    seed[i * 3] = Math.random();
    seed[i * 3 + 1] = Math.random();
    seed[i * 3 + 2] = Math.random();
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vboP = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vboP);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const vboS = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vboS);
  gl.bufferData(gl.ARRAY_BUFFER, seed, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, count, intensity: 0.35, color: [1.0, 0.86, 0.62] };
}

export { node as makeNode, M as trs };
