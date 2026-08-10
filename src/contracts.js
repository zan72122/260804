// Shared contract for the game-feel rework.
//
// Every module below agrees on these numbers and shapes. Nothing here does
// work; it exists so the pile, the plush rig, the drama director and the state
// machine cannot drift apart.

/* ------------------------------------------------------------------ */
/* grab points                                                         */
/* ------------------------------------------------------------------ */

/**
 * Where the claw can catch a toy, and what that does.
 *  hold — how well the fingers keep it. Below SLIP_HOLD it comes loose mid-lift.
 *  spin — how far the toy rotates as it settles under the claw. An ear grab
 *         swings the whole body round; a body grab barely turns it.
 */
export const GRAB_TYPES = {
  body: { hold: 1.00, spin: 0.00 },
  head: { hold: 0.92, spin: 0.18 },
  arm:  { hold: 0.72, spin: 0.55 },
  leg:  { hold: 0.66, spin: 0.62 },
  ear:  { hold: 0.46, spin: 1.00 },
  tail: { hold: 0.38, spin: 0.90 },
};

/** A grab weaker than this slips out during the lift. */
export const SLIP_HOLD = 0.55;

/**
 * @typedef {Object} GrabPoint
 * @property {import('../vendor/three/three.module.min.js').Vector3} pos
 *   position in the plush's *unit* build space (multiply by plush.size for
 *   body-local metres — the same space the meshes are authored in)
 * @property {keyof GRAB_TYPES} type
 */

/**
 * @typedef {Object} GrabChoice
 * @property {number} index      index into plush.grabPoints
 * @property {string} type
 * @property {number} hold
 * @property {number} spin
 * @property {import('../vendor/three/three.module.min.js').Vector3} local
 *   the point in body-local metres (already multiplied by plush.size)
 */

/* ------------------------------------------------------------------ */
/* detail tiers                                                        */
/* ------------------------------------------------------------------ */

export const TIER = {
  /** reveal close-up and a small collection room: every stitch */
  HERO: 'hero',
  /** front / top of the pile: faces and limbs, no micro-trim */
  GAME: 'game',
  /** buried or at the back: silhouette and face only */
  FAR: 'far',
};

/** How many pile toys get the GAME tier; the rest are FAR. */
export const GAME_TIER_COUNT = 6;

/* ------------------------------------------------------------------ */
/* drama thresholds                                                    */
/* ------------------------------------------------------------------ */

/**
 * What counts as "an event a four-year-old can follow". Measured against a
 * snapshot taken when the grab started.
 */
export const DRAMA = {
  /** radians the grabbed toy must turn */
  ROT: 1.0,
  /** metres the grabbed toy must move */
  MOVE: 0.28,
  /** metres a *different* toy must move */
  NEIGHBOUR: 0.20,
  /** metres a buried toy must rise to count as "uncovered" */
  EXPOSE: 0.12,
  /** metres of lift that counts on its own */
  LIFT: 0.25,
};

/** Every grab must reach at least this score before the outcome is committed. */
export const MIN_DRAMA = 1;

/* ------------------------------------------------------------------ */
/* beat lengths (seconds) — one grab is ~6.3s and never idle           */
/* ------------------------------------------------------------------ */

export const BEAT = {
  open: 0.30,      // claw spreads
  touch: 0.35,     // fingers press into the fabric, the toy dents and shifts
  close: 0.45,     // fingers converge, the toy is drawn to the claw axis
  settle: 0.42,    // claw holds still; the toy rotates into its hanging pose
  retry: 0.35,     // director-only: nudge and re-close when nothing happened
  liftMin: 0.85,
  carryMin: 0.95,
  teeter: 0.62,    // caught on the chute rim, wobbles, tips in
  release: 0.16,
  landHold: 0.95,  // after the ゴトン, before the close-up
  recover: 0.45,
};

/* ------------------------------------------------------------------ */
/* pile                                                                */
/* ------------------------------------------------------------------ */

export const PILE = {
  count: 12,
  /** bodies per layer, front/bottom first */
  layers: [5, 4, 3],
  /** dropped to this when the device cannot keep up */
  lowCount: 9,
};

/* ------------------------------------------------------------------ */
/* chute finishes                                                      */
/* ------------------------------------------------------------------ */

export const CHUTE = {
  CLEAN: 'clean',   // drops straight through
  RIM: 'rim',       // lands half on the rim, teeters, tips in
  BOUNCE: 'bounce', // clips the chute wall and rolls in
};
