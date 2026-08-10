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
  ceilY: 1.02,
  /** Below this height the prize has definitively left the bars. */
  fallenY: 0.30,
};

export const CRANE = {
  /** Rest height of the trolley (claw parked). */
  restY: 0.88,
  homeX: 0.0,
  homeZ: 0.255,
  /** Aim limits so the claw always stays inside the cabinet. */
  minX: -0.205,
  maxX: 0.205,
  minZ: -0.30,
  maxZ: 0.265,
  moveSpeed: 0.72,
  descendSpeed: 0.46,
  riseSpeed: 0.60,
  /** Prong pivot offset from the claw head origin. */
  pivotX: 0.018,
  pivotY: -0.004,
  prongLen: 0.086,
  openAngle: 0.78,
  closedAngle: 0.02,
  /** Vertical offset from the claw head origin down to the prong tips (open). */
  tipDrop: 0.074,
  /** Same, but with the prongs closed (they reach further down). */
  tipDropClosed: 0.093,
  /** Deepest the prong tips are allowed to travel. */
  tipFloorY: BAR.topY - 0.075,
  /** Trolley -> cage drop (the spring-loaded cable) and cage -> head drop (the swing). */
  cableDrop: 0.09,
  swingDrop: 0.075,
  swingStiffness: 4.5,
  swingDamping: 0.45,
  swingMaxTorque: 0.34,
  /** Prismatic (cable) spring between trolley and cage. */
  cableStiffness: 300,
  cableDamping: 14,
  cableMaxForce: 13,
  cableMin: -0.085,
  cableMax: 0.115,
  /** Compression of the cable spring that counts as "the claw hit something". */
  contactCompression: 0.022,
  prongMotorStiffness: 26,
  prongMotorDamping: 1.4,
  prongMaxTorqueOpen: 0.30,
  prongMaxTorqueClose: 0.42,
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
 * generated round obeys the two rules that make 橋渡し work:
 *
 *   overhang  — the box must stick out past each bar far enough for the claw
 *               to get at an end:            w  >  spacing + 0.076
 *   tip-in    — once one end loses its bar the centre of mass must already be
 *               inside the gap, so the box falls *between* the bars rather
 *               than being shoved over the far one:   w  <  2*spacing - 2*r
 *
 * `d` and `h` must both clear the gap, otherwise the box could never drop in.
 */
const BOX_SHAPES = [
  { over: 0.070, hRatio: 0.76, dRatio: 0.74, mass: 0.30 },
  { over: 0.064, hRatio: 0.84, dRatio: 0.70, mass: 0.28 },
  { over: 0.078, hRatio: 0.70, dRatio: 0.76, mass: 0.33 },
  { over: 0.068, hRatio: 0.80, dRatio: 0.78, mass: 0.27 },
];

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
  const spacing = easy ? 0.178 : rand(0.172, 0.190);

  const clear = spacing - 2 * BAR.radius;
  const w = Math.min(spacing + shape.over, 2 * spacing - 2 * BAR.radius - 0.060);
  const h = Math.min(clear * shape.hRatio, clear - 0.010);
  const d = Math.min(clear * shape.dRatio, clear - 0.010);

  return {
    pkg: pick(PACKAGES),
    box: {
      w, h, d,
      mass: shape.mass,
      friction: easy ? 0.52 : rand(0.44, 0.60),
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
