/**
 * ころころ橋渡しクレーン — tuning constants and per-round setup generation.
 *
 * Units are metres / kilograms / seconds. The playfield is modelled at roughly
 * the scale of a real Japanese "橋渡し" (bridge) crane machine, which keeps the
 * physics solver in a numerically comfortable range.
 *
 * World axes:  +X = right,  +Y = up,  +Z = towards the player (front).
 */

export const PHYS = {
  gravity: -9.2,
  fixedDt: 1 / 120,
  maxSubSteps: 6,
  solverIterations: 10,
};

/** Two parallel support bars ("橋"). They run front-to-back along Z. */
export const BAR = {
  radius: 0.014,
  /** Half of the centre-to-centre spacing; overridden per round. */
  spacing: 0.178,
  zBack: -0.28,
  zFront: 0.28,
  /** Y of the top surface of the bars — the plane the prize rests on. */
  topY: 0.46,
};

export const FIELD = {
  wallX: 0.29,
  backZ: -0.375,
  frontZ: 0.40,
  floorY: 0.0,
  ceilY: 1.06,
  /** Below this height the prize has definitively left the bars. */
  fallenY: 0.30,
};

export const CRANE = {
  /** Rest height of the trolley (claw parked). */
  restY: 0.925,
  homeX: 0.0,
  homeZ: 0.255,
  /** Aim limits so the claw always stays inside the cabinet. */
  minX: -0.205,
  maxX: 0.205,
  minZ: -0.30,
  maxZ: 0.265,
  moveSpeed: 0.72,
  descendSpeed: 0.40,
  riseSpeed: 0.60,
  /** Prong pivot offset from the claw head origin. */
  pivotX: 0.018,
  pivotY: -0.004,
  prongLen: 0.086,
  openAngle: 0.62,
  closedAngle: 0.02,
  /** Vertical offset from the claw head origin down to the prong tips (open). */
  tipDrop: 0.104,
  /** Same, but with the prongs closed (they reach further down). */
  tipDropClosed: 0.122,
  /** Deepest the prong tips are allowed to travel. */
  tipFloorY: BAR.topY - 0.075,
  /** Trolley -> cage drop (the spring-loaded cable) and cage -> head drop (the swing). */
  cableDrop: 0.09,
  swingDrop: 0.075,
  swingStiffness: 4.5,
  swingDamping: 0.45,
  swingMaxTorque: 0.15,
  /** Prismatic (cable) spring between trolley and cage. */
  cableStiffness: 210,
  cableDamping: 14,
  cableMaxForce: 7.5,
  cableMin: -0.085,
  cableMax: 0.115,
  /**
   * How far the cable spring may compress before the descent is considered
   * bottomed out. Generous on purpose: the spring force is capped low, so
   * letting the claw settle firmly costs the prize nothing and makes the
   * closing stroke start from the deepest position it can reach.
   */
  contactCompression: 0.048,
  prongMotorStiffness: 26,
  prongMotorDamping: 1.4,
  /**
   * While descending the prongs are almost limp: one that lands on top of the
   * prize is pushed aside instead of stopping the claw, so the other prong can
   * reach down past an overhanging end. Closing is much stronger — that is the
   * stroke that hooks under the box and lifts it.
   */
  prongMaxTorqueOpen: 0.115,
  prongMaxTorqueClose: 0.30,
  /** Extra travel past "fully open" so a prong can fold right up out of the way. */
  prongSplay: 1.30,
};

export const COLLISION = {
  WORLD: 0x0001,
  CLAW: 0x0002,
  PRIZE: 0x0004,
};
const g = (member, filter) => ((member << 16) | filter) >>> 0;
export const GROUPS = {
  world: g(COLLISION.WORLD, COLLISION.CLAW | COLLISION.PRIZE),
  claw: g(COLLISION.CLAW, COLLISION.WORLD | COLLISION.PRIZE),
  prize: g(COLLISION.PRIZE, COLLISION.WORLD | COLLISION.CLAW | COLLISION.PRIZE),
};

/**
 * Prize box proportions, expressed relative to the bar spacing so that every
 * generated round obeys the three rules that make 橋渡し work:
 *
 *   overhang  — the box must stick out past each bar far enough for the claw
 *               to get at an end:                      w > spacing
 *   tip-in    — once one end loses its bar the centre of mass must already be
 *               inside the gap, so the box falls *between* the bars rather
 *               than being shoved over the far one:    w < 2*spacing - 2*r
 *   no-jam    — the box's height/depth *diagonal* must fit through the gap, so
 *               that a box which starts dropping in can never lock across it at
 *               some intermediate angle:        hypot(h, d) < spacing - 2*r
 *
 * That last rule is the one that turns "wedged forever" into the ズルッ slip:
 * whatever attitude the box tips in at, the gap is always wide enough for it.
 * `hFrac`/`dFrac` are directions on that diagonal, so the rule holds by
 * construction and only the aspect ratio varies between prizes.
 */
const BOX_SHAPES = [
  { over: 0.106, hFrac: 0.78, dFrac: 0.63, mass: 0.30 },
  { over: 0.114, hFrac: 0.84, dFrac: 0.55, mass: 0.28 },
  { over: 0.114, hFrac: 0.66, dFrac: 0.75, mass: 0.33 },
  { over: 0.104, hFrac: 0.72, dFrac: 0.70, mass: 0.27 },
];
/** Safety margin on the no-jam rule. */
const JAM_MARGIN = 0.90;

export const PACKAGES = ['bear', 'candy', 'robot', 'cat', 'juice'];

let roundIndex = 0;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/**
 * Builds the initial physical state for a round. Variation comes only from the
 * starting configuration — the rules never change. The first couple of rounds
 * are deliberately gentle so a small child gets an easy win early on.
 */
export function makeRound() {
  const easy = roundIndex < 1;
  roundIndex++;

  const shape = easy ? BOX_SHAPES[0] : pick(BOX_SHAPES);
  const spacing = easy ? 0.200 : rand(0.194, 0.212);

  const clear = spacing - 2 * BAR.radius;
  const w = Math.min(spacing + shape.over, 2 * spacing - 2 * BAR.radius - 0.060);
  // Put h and d on a diagonal that is guaranteed to fit through the gap.
  const diag = clear * JAM_MARGIN;
  const norm = Math.hypot(shape.hFrac, shape.dFrac);
  const h = (diag * shape.hFrac) / norm;
  const d = (diag * shape.dFrac) / norm;

  return {
    pkg: pick(PACKAGES),
    box: {
      w, h, d,
      mass: shape.mass,
      friction: easy ? 0.48 : rand(0.44, 0.56),
      restitution: 0.03,
    },
    barSpacing: spacing,
    start: {
      x: easy ? 0 : rand(-0.018, 0.018),
      z: easy ? -0.02 : rand(-0.06, 0.02),
      yaw: (easy ? rand(-4, 4) : rand(-11, 11)) * Math.PI / 180,
    },
  };
}

export function resetRoundCounter() {
  roundIndex = 0;
}
