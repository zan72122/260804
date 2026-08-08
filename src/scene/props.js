// Tools of the trade, at the sizes a 箔職人 actually uses.
//   革板   deer-hide board the leaf is transferred onto      ~300 mm square
//   打紙束  bundle of beaten papers with leaf between sheets  ~155 mm square
//   槌     beating hammer                                    head 65 mm
//   箔箸   bamboo chopsticks for lifting leaf                 ~190 mm
//   毛棒   soft brush that presses the leaf down              ~150 mm
//   下地   dark lacquered base the leaf is laid onto          ~115 mm

import { mat4 } from '../core/math.js';
import * as G from '../core/geometry.js';
import { MAT, makeNode, paperStack } from './atelier.js';

const M = (t = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => mat4.fromTRS(mat4.create(), t, r, s);

export const LAYOUT = {
  board: [0, 0, -0.055],       // 革盤 centre, its hide face at y = BOARD_TOP
  packet: [0, 0, -0.115],      // 打紙束 sits at the back of the board
  cut: [0, 0, 0.035],          // where the 枠 cuts the leaf, on bare hide
  base: [0, 0, 0.185],         // 下地 (lacquer object) centre on the bench
};
export const BOARD_TOP = 0.025;

// The gold's sizes along the way, in metres.
//   上澄 is cut into a dozen pieces; one piece is the 小間 you start beating.
//   Beating spreads it well past the finished size, and 箔切り cuts it back to
//   the Kanazawa standard 三寸六分 = 109 mm square.
export const LEAF_KOMA = 0.055;  // 小間, as it goes into the papers
export const LEAF_RAW = 0.128;   // as it comes off the papers, ragged
export const LEAF_CUT = 0.109;   // 金沢四号 / 三寸六分, cut square
export const LEAF_MESH = 0.140;  // simulation grid, larger than any of them
export const LEAF_SIZE = LEAF_CUT;

export function buildProps(gl) {
  const nodes = [];
  const refs = {};
  const add = (key, geo, mat, model, opts) => {
    const n = makeNode(gl, geo, mat, model || mat4.create(), opts);
    nodes.push(n);
    if (key) refs[key] = n;
    return n;
  };

  // ---- 革板 : hardwood board faced with deer hide -------------------------
  add('boardWood', G.translated(G.chamferBox(0.322, 0.020, 0.322, 0.003), 0, 0.010, 0),
    MAT.postWood, M(LAYOUT.board));
  add('boardHide', G.translated(G.box(0.298, 0.006, 0.298, { uvScale: 0.06 }), 0, 0.022, 0),
    MAT.hide, M(LAYOUT.board));

  // ---- 打紙束 : the bundle you beat -------------------------------------
  // 24 sheets at 2.1 mm apparent spacing -> a 50 mm bundle.
  refs.packet = add('packet', paperStack(0.158, 0.158, 24, 0.0021), MAT.washi,
    M([LAYOUT.packet[0], BOARD_TOP, LAYOUT.packet[2]]));
  // The single sheet that gets peeled open sits on top of the bundle and is
  // rebuilt as a deformable mesh in peel.js; this is only its resting stand-in.

  // ---- 槌 : iron-headed beating hammer -----------------------------------
  {
    // Head lies across the handle, so it always reads as a hammer in profile.
    const head = G.merge(
      G.placed(G.cylinder(0.032, 0.030, 0.074, 20), [0.037, 0, 0], [0, 0, Math.PI / 2]),
      G.placed(G.lathe([[0, 0], [0.030, 0.002], [0.032, 0.007]], 20), [-0.037, 0, 0], [0, 0, Math.PI / 2]),
    );
    const handle = G.placed(G.cylinder(0.0125, 0.0155, 0.24, 14), [0, 0.028, 0], [0, 0, 0]);
    add('hammerHead', head, MAT.iron, M([-0.30, 0.035, 0.02], [0, 0.3, Math.PI / 2]));
    add('hammerHandle', handle, MAT.postWood, M([-0.30, 0.035, 0.02], [0, 0.3, Math.PI / 2]));
  }

  // ---- 箔箸 : bamboo chopsticks, static-free, used to lift the leaf -------
  {
    // Built tip-first at the origin so the tips can be parked exactly where the
    // leaf is picked up, with the shafts running back toward the hand.
    const stick = () => G.placed(G.cylinder(0.0011, 0.0042, 0.19, 8), [0, 0, 0], [Math.PI / 2, 0, 0]);
    add('chopsticks', G.merge(stick(), G.placed(stick(), [0.0095, 0.0015, 0.001])),
      MAT.bamboo, M([0.30, 0.006, -0.06], [0.06, -0.5, 0]));
  }

  // ---- 毛棒 : soft brush ------------------------------------------------
  {
    const handle = G.placed(G.chamferBox(0.019, 0.007, 0.115, 0.002), [0, 0, 0.058]);
    const ferrule = G.placed(G.box(0.021, 0.009, 0.016), [0, 0, -0.006]);
    const bristles = [];
    for (let i = 0; i < 11; i++) {
      const x = (i / 10 - 0.5) * 0.019;
      const len = 0.030 - Math.abs(i / 10 - 0.5) * 0.006;
      bristles.push(G.placed(G.cylinder(0.0016, 0.0006, len, 5), [x, 0, -0.014],
        [Math.PI / 2 + 0.06, 0, 0]));
    }
    add('brushHandle', G.merge(handle, ferrule), MAT.postWood, M([0.33, 0.006, 0.20], [0, 0.7, 0]));
    add('brushHair', G.merge(...bristles), MAT.bristle, M([0.33, 0.006, 0.20], [0, 0.7, 0]));
  }

  // ---- 真綿 : cotton puff for burnishing ---------------------------------
  add('cotton', G.placed(G.sphere(0.026, 16, 10), [0, 0, 0], [0, 0, 0], [1, 0.62, 1]),
    MAT.cotton, M([-0.31, 0.016, 0.21]));
  // small lacquer tray it rests in
  add('cottonTray', G.lathe([[0, 0], [0.045, 0.001], [0.048, 0.014], [0.044, 0.015], [0.040, 0.004], [0, 0.003]], 28),
    MAT.lacquerRim, M([-0.31, 0.0005, 0.21]));

  // ---- 下地 : three dark lacquered bases, cycled between rounds ----------
  const bases = [];
  {
    // 小皿 — shallow dish, 156 mm across: a 109 mm leaf lands inside the well
    const dish = G.lathe([
      [0, 0], [0.068, 0.002], [0.0765, 0.012], [0.078, 0.024],
      [0.0745, 0.0255], [0.068, 0.016], [0.040, 0.009], [0, 0.007],
    ], 56);
    bases.push(add('base0', dish, MAT.lacquer, M(LAYOUT.base)));
  }
  {
    // 椀 — rice bowl on a foot ring
    const bowl = G.lathe([
      [0, 0], [0.030, 0.0015], [0.032, 0.014], [0.028, 0.016], [0.036, 0.023],
      [0.056, 0.046], [0.066, 0.072], [0.068, 0.082], [0.0645, 0.0825],
      [0.0615, 0.070], [0.046, 0.040], [0.024, 0.020], [0, 0.018],
    ], 56);
    bases.push(add('base1', bowl, MAT.lacquer, M(LAYOUT.base)));
  }
  {
    // まり — lacquered ball on a ring stand
    const ball = G.merge(
      G.translated(G.sphere(0.042, 40, 26), 0, 0.050, 0),
      G.lathe([[0.026, 0], [0.036, 0.002], [0.030, 0.011], [0.024, 0.012], [0.022, 0.002]], 32),
    );
    bases.push(add('base2', ball, MAT.lacquer, M(LAYOUT.base)));
  }
  refs.bases = bases;

  // 枠 — the square bamboo blade that cuts the beaten leaf to size. Its inside
  // edge is exactly 109 mm, because that is what defines 金沢四号.
  {
    const half = LEAF_CUT / 2, bar = 0.012, thick = 0.009;
    const f = G.merge(
      G.translated(G.box(LEAF_CUT + bar * 2, thick, bar), 0, 0, -half - bar / 2),
      G.translated(G.box(LEAF_CUT + bar * 2, thick, bar), 0, 0, half + bar / 2),
      G.translated(G.box(bar, thick, LEAF_CUT), -half - bar / 2, 0, 0),
      G.translated(G.box(bar, thick, LEAF_CUT), half + bar / 2, 0, 0),
    );
    refs.frame = add('frame', f, MAT.bamboo, M([-0.30, 0.005, -0.20], [0, 0.25, 0]));
  }

  return { nodes, refs };
}

/** Height of the current base's top surface above the bench, at local radius r. */
export function baseHeight(kind, r) {
  if (kind === 0) { // dish: shallow spherical cap
    const R = 0.078;
    const t = Math.min(r / R, 1);
    return 0.007 + 0.0170 * t * t;
  }
  if (kind === 1) { // bowl: steeper flare
    const R = 0.068;
    const t = Math.min(r / R, 1);
    return 0.018 + 0.0640 * Math.pow(t, 1.7);
  }
  // ball: sphere cap of radius 42 mm centred at y = 0.050
  const R = 0.042;
  const rr = Math.min(r, R * 0.999);
  return 0.050 + Math.sqrt(Math.max(R * R - rr * rr, 0));
}

/** Radius over which the leaf can wrap onto the base before it hangs free. */
export const BASE_RADIUS = [0.078, 0.068, 0.042];

/**
 * The top of the solid at a given radius — the height below which a point is
 * inside the piece. Outside the piece there is nothing, so the answer is the
 * bench. This is what stops the leaf from cutting through the lacquerware.
 */
export function baseClearance(kind, r) {
  if (kind === 0) {                       // 小皿: well, then rim, then nothing
    if (r <= 0.0735) return baseHeight(0, r);
    if (r <= 0.0785) return 0.0258;
    return 0;
  }
  if (kind === 1) {                       // 椀
    if (r <= 0.0645) return baseHeight(1, r);
    if (r <= 0.0685) return 0.0828;
    return 0;
  }
  if (r <= 0.0418) return baseHeight(2, r); // まり
  if (r <= 0.0365) return 0.012;
  return 0;
}
