// Prize-pile simulation.
//
// Deliberately not a general rigid-body engine: each toy is a soft sphere with
// a quaternion. That is enough to give a 4-year-old a readable cause->effect
// ("the claw pushed it, so it rolled toward me") at a fraction of the cost, and
// it lets the pile sleep almost all of the time.
//
// The case now holds a three-layer heap (PILE.layers): a bottom row on the
// mat, a row nestled in its gaps, and a row perched on top at the back. That
// means some pairs of toys are genuinely stacked rather than merely adjacent,
// so the separation solver below runs several relaxation passes and tracks
// which bodies rest on which — both to keep the heap from jittering forever
// and so a settled stack can actually go to sleep.

import * as THREE from '../vendor/three/three.module.min.js';
import { CAB } from './cabinet.js';
import { Plush, SPECIES, SPECIES_INFO } from './plush.js';
import { PILE, TIER, GAME_TIER_COUNT } from './contracts.js';
import { clamp, lerp } from './util.js';

const GRAVITY = -9.2;
const REST = 0.24;
const FLOOR_FRICTION = 0.78;

// How much two touching bodies are allowed to overlap (plush squish) before
// the separation solver in _stepOnce() calls them not-overlapping and stops
// applying any correction force at all. saddlePosition()/seatOn() below
// solve for a genuinely tangent seat using this *same* factor — placing a
// body at the full, un-squished sum of radii instead left it just outside
// the solver's own contact threshold, meaning no contact force applied and
// it free-fell straight through to the floor no matter how good the seat
// math was.
const REST_SEPARATION = 0.8;

// step()'s own internal sub-step size — see the comment on step() itself for
// why a large caller-supplied dt has to be broken up before it touches any
// contact detection here.
const MAX_SUBSTEP = 1 / 60;

// A stacked toy is never "grounded" on the floor plane, so these have to be
// generous enough that a body resting only on other bodies still falls
// asleep — that is the main CPU saving now that the heap is three deep.
const SLEEP_SPEED = 0.05;
const SLEEP_TIME = 0.30;

// Extra sleep-aware settle steps layout() runs after its staged physical
// settle, so an already-stable heap starts the round already asleep rather
// than depending on real playtime frames to accumulate SLEEP_TIME (see the
// comment where this is used). Comfortably more than SLEEP_TIME/dt so a
// wake propagating bottom-up through three tiers has room to finish.
const SLEEP_SETTLE_STEPS = 300;

// A stacked pair leans a small fraction of its horizontal correction toward
// vertical, helping a body settle upward into a saddle instead of sliding
// back out of it under gravity between relaxation passes — even a properly
// solved, exactly-tangent starting position (see saddlePosition()) needs
// *some* restoring push, or small numerical asymmetries between passes let
// it slide off its seat over hundreds of settle steps. A large lean here
// once caused the opposite failure (a body ratcheting upward indefinitely,
// never touching anything again — see LIFT_CAP_FRAC below, which bounds
// that risk directly regardless of how many passes or contacts combine).
const STACK_LEAN = 0.18;

// Hard ceiling on how far *up* any single body may be pushed by positional
// correction in one step, regardless of how many overlapping pairs or
// relaxation passes contribute — the direct fix for the "a body ratchets
// upward until it clears every contact and can never sleep again" failure
// mode. A body genuinely needing more lift than this just takes another
// step to get there instead of teleporting in one; downward correction and
// horizontal correction are not capped, only the unsafe direction is.
const LIFT_CAP_FRAC = 0.2;   // fraction of the body's own radius, per step

// One separation pass cannot hold a three-layer heap together (each pass only
// resolves the *worst* overlap a body is in); a handful of cheap relaxation
// passes converges close enough without turning this into a real solver.
const SEP_ITERS = 6;

// Extra horizontal damping applied to a body found resting on another one, so
// a toy in the saddle between two neighbours settles into that seat instead
// of sliding around on top of them. Below the speed floor it is zeroed
// outright so a seated toy stops dead instead of creeping forever.
const CONTACT_DAMP = 0.35;
const CONTACT_STOP_SPEED = 0.03;

// Shared "is B sitting on A?" thresholds — used both by the per-step contact
// mark (for sleep/damping) and by refreshCoverage() (for the drama director).
const SUPPORT_DY = 0.35;   // vertical offset, as a fraction of the radius sum
const SUPPORT_DXZ = 0.8;   // horizontal offset, as a fraction of the radius sum

// A contact pair only wakes each other when it actually carries relative
// motion. Two bodies resting quietly against each other still touch (that is
// what "resting" means for a soft-sphere pile) — waking on mere geometric
// overlap, regardless of speed, meant *any* contact reset both bodies'
// sleep timers every single step, so a crowded pile could never sleep at
// all (only fully isolated bodies ever accumulated enough quiet time).
const WAKE_REL_SPEED = SLEEP_SPEED * 2;

// The old `radius * 0.8` clamp let 20% of every toy hang out through the
// glass. No squash allowance at all (0, not a couple of centimetres) because
// a toy's *sphere* is its full collision extent — any positive allowance
// here means the sphere itself pokes through the wall, not just a texture
// dent; the plush mesh's own give already reads as squash against the glass.
const WALL_SQUASH = 0;

// Resting contact and penetration are different questions and must not
// share a threshold: the relaxation solver settles a stacked pair right at
// the rest distance, where it no longer *overlaps* (d >= rr) even though it
// is still genuinely touching, so a same-frame "is this body supported?"
// check gated on overlap alone flickers false on the very steps where a toy
// is most calmly seated — resetting its sleep progress forever. Support
// detection gets a few extra centimetres of slack that positional
// correction (rr, unchanged) does not.
const SUPPORT_SLACK = 0.02;

// A body's support flag bridges a short gap after the last step that
// actually detected contact, so one missed-overlap frame amid an otherwise
// settled stack cannot single-handedly force it to keep re-passing through
// "unsupported" and repeatedly stall its sleep timer.
const SUPPORT_GRACE = 0.25;

// Backstop, independent of any detected support at all: if a body is this
// close to motionless for a full second, let it sleep regardless — nothing
// should be able to stay awake forever purely because the contact flags
// never line up, however small the actual residual jitter is.
const BACKSTOP_SPEED = 0.006;
const BACKSTOP_TIME = 1.0;

export class Body {
  /** @param {Plush} plush */
  constructor(plush) {
    this.plush = plush;
    this.radius = plush.size * 0.99;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.angVel = new THREE.Vector3();
    this.sleeping = false;
    this.sleepTimer = 0;
    this.held = false;
    this.inChute = false;
    this.grounded = false;
    this.layer = 0;            // which PILE.layers row this toy was placed in
    this.covered = 0;          // how many toys refreshCoverage() found on top of it
    this.restingOnBody = false; // this-step signal: touching a body below it
    this.supportTimer = 0;     // grace period bridging a single missed-contact frame (see SUPPORT_GRACE)
    this.calmTimer = 0;        // backstop: seconds spent under BACKSTOP_SPEED regardless of detected support
  }
  get floorY() { return this.radius * 0.93; }
  wake() { this.sleeping = false; this.sleepTimer = 0; }
  applyImpulse(v, spin) {
    this.vel.add(v);
    if (spin) this.angVel.add(spin);
    this.wake();
  }
  syncMesh() {
    this.plush.root.position.copy(this.pos);
    this.plush.root.quaternion.copy(this.quat);
  }
}

/**
 * Split `count` bodies into a 3-tier heap shaped like PILE.layers (n, n-1,
 * n-2), whatever `count` turns out to be, so layer 1 always has exactly one
 * nesting gap per layer-0 pair and layer 2 one per layer-1 pair. For the two
 * counts the game actually uses (PILE.count=12, PILE.lowCount=9) this
 * reproduces PILE.layers and [4,3,2] exactly.
 */
function layerCounts(count) {
  // Two tiers, not three. A third tier stacks spheres that touch, but a plush
  // is not a sphere — its mesh is smaller than its collision radius in most
  // directions, so a tall stack reads on screen as toys hovering with air
  // between them rather than as a heap. A wide base with one row nestled into
  // its gaps gives the same burial (something is always underneath something)
  // while looking like a pile someone dumped in a case.
  const n0 = Math.max(2, Math.round(count * 0.58));
  return [n0, Math.max(0, count - n0), 0];
}

/**
 * Solve for where a sphere of `radius` genuinely rests tangent to BOTH of
 * two support spheres at once — not a guess. The two spheres A, B (radii
 * arad/brad — generally different, unlike an earlier version that averaged
 * them, which was wrong whenever they actually differed) define a circle of
 * possible tangent points (the intersection of two spheres of radius
 * arad+radius and brad+radius centred on A and B); this returns the point
 * on that circle with the greatest height, i.e. sitting up in the saddle
 * rather than out to a side. Returns null if no such point exists (the
 * supports are too far apart, or too close, for a sphere this size to touch
 * both) — the caller should then rest it directly on the nearer support.
 */
function saddlePosition(radius, ax, ay, az, arad, bx, by, bz, brad) {
  const dA = (arad + radius) * REST_SEPARATION, dB = (brad + radius) * REST_SEPARATION;
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const d = Math.hypot(abx, aby, abz);
  if (d < 1e-6 || d > dA + dB || d < Math.abs(dA - dB)) return null;
  // standard sphere/sphere intersection: a circle of radius h, centred at
  // distance `a` from A along the A->B axis, in the plane perpendicular to it
  const a = (d * d + dA * dA - dB * dB) / (2 * d);
  const h2 = dA * dA - a * a;
  if (h2 <= 0) return null;
  const h = Math.sqrt(h2);
  const ux = abx / d, uy = aby / d, uz = abz / d;
  const cx = ax + a * ux, cy = ay + a * uy, cz = az + a * uz;
  // within that circle, lean toward whichever direction climbs highest:
  // project "up" onto the plane perpendicular to the A->B axis
  let px = -uy * ux, py = 1 - uy * uy, pz = -uy * uz;
  const pl = Math.hypot(px, py, pz);
  if (pl < 1e-6) { px = 1; py = 0; pz = 0; }   // axis is vertical -- any horizontal lean is equivalent
  else { px /= pl; py /= pl; pz /= pl; }
  return { x: cx + h * px, y: cy + h * py, z: cz + h * pz };
}

/**
 * saddlePosition() with a fallback for when no saddle exists: rest directly
 * on top of whichever support is horizontally nearer to (hintX, hintZ) —
 * the spot's already-chosen target — tangent, centred above it.
 */
function seatOn(radius, ax, ay, az, arad, bx, by, bz, brad, hintX, hintZ) {
  const p = saddlePosition(radius, ax, ay, az, arad, bx, by, bz, brad);
  if (p) return p;
  const distA = Math.hypot(hintX - ax, hintZ - az);
  const distB = Math.hypot(hintX - bx, hintZ - bz);
  return distA <= distB
    ? { x: ax, y: ay + (arad + radius) * REST_SEPARATION, z: az }
    : { x: bx, y: by + (brad + radius) * REST_SEPARATION, z: bz };
}

export class Pile {
  /** @param {THREE.Object3D} parent */
  constructor(parent, { quality = 1 } = {}) {
    this.parent = parent;
    this.quality = quality;
    /** @type {Body[]} */
    this.bodies = [];
    this._tmp = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._zero = new THREE.Vector3();
    this.onSoftHit = null;   // (body, strength) => void
    // Scratch for the per-step upward-lift cap in _stepOnce (see LIFT_CAP_FRAC):
    // pre-allocated once and grown only if the body count ever exceeds it, so
    // capping never allocates inside the hot per-frame path.
    this._liftCap = new Float64Array(32);
    this._liftUsed = new Float64Array(32);
  }

  clear() {
    for (const b of this.bodies) {
      this.parent.remove(b.plush.root);
      b.plush.dispose();
    }
    this.bodies.length = 0;
  }

  /**
   * Build a fresh, always-winnable layout: a three-layer heap (bottom row on
   * the mat, a row nestled in its gaps, a row perched on top at the back).
   * Poses vary every round (upright, on its side, on its back, leaning on a
   * neighbour) so the same toy needs a slightly different aim next time.
   */
  layout(rng, { count = PILE.count, quality = 1 } = {}) {
    this.clear();
    const order = rng.shuffle(SPECIES.slice());
    const picks = [];
    for (let i = 0; i < count; i++) picks.push(order[i % order.length]);
    const speciesOrder = rng.shuffle(picks);   // decouple species from spatial slot

    const [n0, n1, n2] = layerCounts(count);
    const A = CAB.aim;

    // ---- layer 0: on the mat, spread across the width, weighted front ----
    const layer0 = [];
    for (let i = 0; i < n0; i++) {
      const fx = n0 <= 1 ? 0.5 : i / (n0 - 1);
      const x = lerp(A.minX + 0.16, A.maxX - 0.16, fx) + (rng() - 0.5) * 0.10;
      const z = lerp(A.minZ + 0.30, A.maxZ - 0.08, 0.55 + rng() * 0.35);
      layer0.push({ x, z, layer: 0 });
    }
    layer0.sort((p, q) => p.x - q.x);   // so neighbour-pairing below is meaningful

    // ---- layer 1: nestled into the saddle between each layer-0 pair, set back ----
    const backZ1 = A.minZ + 0.32;
    const layer1 = [];
    for (let i = 0; i < n1; i++) {
      const p = layer0[Math.min(i, n0 - 1)];
      const q = layer0[Math.min(i + 1, n0 - 1)];
      layer1.push({
        x: (p.x + q.x) / 2 + (rng() - 0.5) * 0.06,
        z: lerp((p.z + q.z) / 2, backZ1, 0.6) + (rng() - 0.5) * 0.08,
        layer: 1,
        supA: p, supB: q,   // the pair it nests between, for a real spawn height below
      });
    }

    // ---- layer 2: perched on top, further back still ----
    const backZ2 = A.minZ + 0.14;
    const layer2 = [];
    for (let i = 0; i < n2; i++) {
      const p = layer1[Math.min(i, n1 - 1)];
      const q = layer1[Math.min(i + 1, n1 - 1)];
      layer2.push({
        x: (p.x + q.x) / 2 + (rng() - 0.5) * 0.06,
        z: lerp((p.z + q.z) / 2, backZ2, 0.6) + (rng() - 0.5) * 0.06,
        layer: 2,
        supA: p, supB: q,
      });
    }

    const spots = layer0.concat(layer1, layer2);

    // Resolve final x/z/y per spot before any Plush is built: species (and so
    // radius) has to be known up front because prominence sorting needs a
    // real height, and `detail` is a constructor option.
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      s.species = speciesOrder[i];
      s.radius = SPECIES_INFO[s.species].size * 0.99;   // mirrors Body.radius

      let x = clamp(s.x, A.minX, A.maxX);
      let z = clamp(s.z, A.minZ, A.maxZ);
      // never let a toy start on or inside the prize-hole rim
      const dh = Math.hypot(x - CAB.hole.x, z - CAB.hole.z);
      const minH = CAB.hole.rim + s.radius + 0.05;
      if (dh < minH) {
        const nx = (x - CAB.hole.x) / (dh || 1), nz = (z - CAB.hole.z) / (dh || 1);
        x = clamp(CAB.hole.x + nx * minH, A.minX, A.maxX);
        z = clamp(CAB.hole.z + nz * minH, A.minZ, A.maxZ);
      }
      s.x = x; s.z = z;

      const floorY = s.radius * 0.93;   // Body.floorY, computed early for sorting
      if (s.layer === 0) {
        s.y = floorY + 0.02;
      } else {
        // Spawn a stacked toy at (roughly — this is pre-physics, only used
        // for prominence sorting below) the height it should actually
        // settle to, solved against both of the spot's two support
        // neighbours rather than guessed. supA/supB are already fully
        // resolved here: spots is layer0 then layer1 then layer2, so a
        // toy's supports were processed earlier in this loop.
        const supA = s.supA, supB = s.supB;
        const seat = seatOn(s.radius, supA.x, supA.y, supA.z, supA.radius,
                                       supB.x, supB.y, supB.z, supB.radius, s.x, s.z);
        s.y = Math.max(floorY, seat.y);
      }
    }

    // Prominence decides which toys are worth the expensive build: higher and
    // further front reads clearest to the player. Top GAME_TIER_COUNT spots
    // get TIER.GAME, the rest TIER.FAR — decided before any Plush exists.
    const byProminence = spots.slice().sort((a, b) => (b.y * 1.2 + b.z) - (a.y * 1.2 + a.z));
    for (let i = 0; i < byProminence.length; i++) {
      byProminence[i].detail = i < GAME_TIER_COUNT ? TIER.GAME : TIER.FAR;
    }

    for (const s of spots) {
      const variant = rng.int(0, 2);
      const plush = new Plush(s.species, variant, {
        quality, seed: rng.int(1, 9999), fuzz: quality > 0.55, detail: s.detail,
      });
      const b = new Body(plush);
      b.layer = s.layer;
      b.pos.set(s.x, s.y, s.z);
      s.body = b;   // spot -> body link so the staged settle below can read
                     // a support's REAL settled position, not its spawn guess
      // A stacked toy starts physics-inert ("held") until the tier under it
      // has actually finished settling — see the staged settle below.
      b.held = s.layer > 0;

      // pose: the variety that makes each round feel hand-arranged
      const pose = rng();
      // most toys are set out facing the player (that is where the faces are);
      // a couple are turned aside so the shelf still looks hand-arranged
      const yaw = rng() < 0.72 ? rng.range(-0.85, 0.85) : rng.range(-Math.PI, Math.PI);
      const e = new THREE.Euler();
      if (pose < 0.40) {            // sitting upright, slight lean
        e.set(rng.range(-0.18, 0.18), yaw, rng.range(-0.18, 0.18));
      } else if (pose < 0.62) {     // on its side
        e.set(rng.range(-0.2, 0.2), yaw, rng.sign() * rng.range(1.15, 1.5));
      } else if (pose < 0.78) {     // on its back, feet up
        e.set(rng.range(-1.5, -1.15), yaw, rng.range(-0.2, 0.2));
      } else if (pose < 0.9) {      // face down / tumbled forward
        e.set(rng.range(1.0, 1.4), yaw, rng.range(-0.3, 0.3));
      } else {                      // leaning steeply on a neighbour
        e.set(rng.range(-0.5, 0.5), yaw, rng.sign() * rng.range(0.6, 0.9));
      }
      b.quat.setFromEuler(e);
      b.plush.rememberPose?.();

      this.parent.add(plush.root);
      b.syncMesh();
      this.bodies.push(b);
    }

    // ---- staged settle: let each tier find its seat on the tier below
    // before the next tier drops onto it. Settling all three at once (the
    // old approach) let layer 0 spread apart from its overlapping start
    // *while* layers 1/2 were still falling toward positions computed for
    // the pre-spread layout — by the time they arrived the gap had already
    // widened out from under them, so they fell straight through to the
    // mat instead of landing in the saddle. Settling layer 0 alone first,
    // then reseating layer 1 on layer 0's *actual* rest positions (and
    // likewise layer 2 on layer 1), removes that race entirely.
    // A generous, one-time synchronous budget: a body reseated slightly off
    // from where it will actually end up can end up gently grazing an
    // already-settled neighbour on its way down rather than falling clean,
    // which (correctly, see the velocity-kill comment below) slows real
    // free-fall far more than an isolated drop would need — so this needs
    // real headroom, not just enough for the common case.
    const SETTLE_STEPS = 220;
    this._gentleSettle(SETTLE_STEPS);   // layer 0 alone

    const allSeated = [];   // every layer>0 spot across both tiers, for the final validation pass below
    for (let tier = 1; tier <= 2; tier++) {
      const seated = [];   // [{body, supA, supB}] for this tier, for the re-seat pass below
      for (const s of spots) {
        if (s.layer !== tier) continue;
        // Reseat fully (x, y and z) against the support tier's *actual*
        // settled positions — not a height-only guess. A body genuinely
        // tangent to both supports on arrival means the general pairwise
        // solver only has to hold it there, not discover a seat by trial
        // and error, which is what made the outcome seed-dependent (some
        // layouts assembled a real heap, others quietly collapsed flat).
        const b = s.body, supA = s.supA.body, supB = s.supB.body;
        const seat = seatOn(
          b.radius, supA.pos.x, supA.pos.y, supA.pos.z, supA.radius,
          supB.pos.x, supB.pos.y, supB.pos.z, supB.radius, b.pos.x, b.pos.z);
        let x = clamp(seat.x, A.minX, A.maxX);
        let z = clamp(seat.z, A.minZ, A.maxZ);
        const dh = Math.hypot(x - CAB.hole.x, z - CAB.hole.z);
        const minH = CAB.hole.rim + b.radius + 0.05;
        if (dh < minH) {
          const invDh = dh || 1;
          x = clamp(CAB.hole.x + (x - CAB.hole.x) / invDh * minH, A.minX, A.maxX);
          z = clamp(CAB.hole.z + (z - CAB.hole.z) / invDh * minH, A.minZ, A.maxZ);
        }
        b.pos.set(x, Math.max(b.floorY, seat.y), z);
        b.held = false;
        b.syncMesh();
        seated.push({ body: b, supA, supB });
        allSeated.push({ body: b, supA, supB });
      }
      this._gentleSettle(SETTLE_STEPS);

      // A body whose neighbours in this tier claimed part of its seat (two
      // adjacent saddle spots can overlap slightly, since each is solved
      // independently against its own support pair) can still end up
      // shouldered down to the floor by the time the settle above finishes
      // — including all the way down (this spot's seat is always solved
      // against a real support, never the floor, so ending up grounded
      // here is itself the failure, not evidence the body "legitimately"
      // belongs there — checking for that and skipping it was the bug that
      // let a collapsed layout stay collapsed). Re-run the same tangent
      // solve against the support pair's *current* position and, if this
      // body has drifted meaningfully below that seat, put it back and
      // give it another settle window to hold on. A few attempts, not
      // just one — a single retry was not always enough.
      for (let attempt = 0; attempt < 16; attempt++) {
        let driftedAny = false;
        for (const { body: b, supA, supB } of seated) {
          const seat = seatOn(
            b.radius, supA.pos.x, supA.pos.y, supA.pos.z, supA.radius,
            supB.pos.x, supB.pos.y, supB.pos.z, supB.radius, b.pos.x, b.pos.z);
          // Checked both ways: a body that slid off its seat down toward
          // the floor is the common failure, but the small climbing lean
          // in the separation solver (STACK_LEAN) can occasionally push
          // one up clear of every contact instead — just as much a
          // failure (a levitator that can never be grounded or resting
          // again), so it gets the same re-seat treatment.
          if (Math.abs(b.pos.y - seat.y) > b.radius * 0.5) {
            b.pos.set(
              clamp(seat.x, A.minX, A.maxX), Math.max(b.floorY, seat.y),
              clamp(seat.z, A.minZ, A.maxZ));
            b.vel.set(0, 0, 0);
            b.syncMesh();
            driftedAny = true;
          }
        }
        if (!driftedAny) break;
        this._gentleSettle(SETTLE_STEPS);
      }
    }

    // ---- final validation, across every layer>0 spot at once (not just the
    // tier being processed): a spot's seat is always solved against a real
    // support, so a body that is still resting on the floor plane here is
    // never "legitimately" there — it is the per-tier retries above having
    // failed to hold it, most often when neighbouring seats collide during a
    // retry and knock each other back down together in a way one tier's own
    // retry loop cannot see. Re-seat any offenders against their current
    // supports one more time, together, with an extra-long gentle settle.
    for (let attempt = 0; attempt < 4; attempt++) {
      let anyBad = false;
      for (const { body: b, supA, supB } of allSeated) {
        if (!b.grounded) continue;
        const seat = seatOn(
          b.radius, supA.pos.x, supA.pos.y, supA.pos.z, supA.radius,
          supB.pos.x, supB.pos.y, supB.pos.z, supB.radius, b.pos.x, b.pos.z);
        b.pos.set(
          clamp(seat.x, A.minX, A.maxX), Math.max(b.floorY, seat.y),
          clamp(seat.z, A.minZ, A.maxZ));
        b.vel.set(0, 0, 0);
        b.syncMesh();
        anyBad = true;
      }
      if (!anyBad) break;
      this._gentleSettle(SETTLE_STEPS * 2);
    }

    // ---- let already-stable bodies actually fall asleep before the round
    // is shown, instead of leaving that entirely to whatever real frames
    // trickle in afterward. `settling=true` above deliberately skips the
    // sleep test throughout the staged settle (so a body reaching quiet
    // *mid*-settle doesn't freeze there before the tier above it has even
    // been reseated) — but that also means a body that is already fully at
    // rest by the time this method returns has never once been *checked*
    // for sleep, so it starts the round awake and burning a full solve
    // every frame for no reason until real playtime happens to accumulate
    // SLEEP_TIME of quiet on top. A slow renderer can take a long time to
    // deliver that much simulated time (frame dt is real wall-clock time,
    // capped, not free); running the sleep-aware step here costs nothing
    // but this synchronous call. onSoftHit is suppressed for it — nothing
    // actually happened yet from the player's point of view, so it should
    // not cue a sound.
    const savedOnSoftHit = this.onSoftHit;
    this.onSoftHit = null;
    for (let i = 0; i < SLEEP_SETTLE_STEPS; i++) this.step(1 / 60, false);
    this.onSoftHit = savedOnSoftHit;

    for (const b of this.bodies) {
      if (!b.sleeping) { b.vel.set(0, 0, 0); b.angVel.multiplyScalar(0.2); }
    }

    this._freezeHeap(allSeated);
    return this.bodies;
  }

  /**
   * Final, authored state of the heap.
   *
   * Everything above tries to *discover* a stable heap by simulating one, and
   * for most seeds it does. But a soft-sphere relaxation has no guarantee of
   * holding a saddle across hundreds of steps, so a minority of layouts still
   * ended with a toy slid down to the mat (a flat pile, nothing buried) or
   * ratcheted clear of every contact (a toy hanging in mid-air). Both are
   * immediately obvious to a player and neither is recoverable once the round
   * has started.
   *
   * A prize pile does not need to be discovered: it is arranged by hand and
   * then it does not move until something touches it. So put every stacked toy
   * back on the exact seat solved for it, push apart whatever residual overlap
   * that leaves *without gravity* (so nothing can slide off again), and hand
   * the round over asleep. The solver still owns everything that happens after
   * the claw arrives — it just no longer decides what the shelf looks like.
   */
  _freezeHeap(allSeated) {
    const A = CAB.aim;

    // tier by tier, so layer 2 seats against layer 1's final position
    for (const tier of [1, 2]) {
      for (const { body: b, supA, supB } of allSeated) {
        if (b.layer !== tier) continue;
        const seat = seatOn(
          b.radius, supA.pos.x, supA.pos.y, supA.pos.z, supA.radius,
          supB.pos.x, supB.pos.y, supB.pos.z, supB.radius, b.pos.x, b.pos.z);
        // A toy the claw cannot descend onto is not a prize, it is scenery.
        // The claw parks at CAB.clawHomeY and drops from there, so the top of
        // the heap has to stay clear of that line with room for the fingers.
        const reachTop = CAB.clawHomeY - b.radius - 0.14;
        b.pos.set(
          clamp(seat.x, A.minX, A.maxX),
          clamp(seat.y, b.floorY, reachTop),
          clamp(seat.z, A.minZ, A.maxZ));
        b._seatY = b.pos.y;
      }
    }
    // a body on the mat may never be lifted by the relaxation below
    for (const b of this.bodies) if (b._seatY === undefined) b._seatY = b.floorY;

    // Gravity-free relaxation: overlap only. Seats are solved at the same rest
    // separation the contact test uses, so this normally moves almost nothing —
    // it exists to unpick the case where two independently-solved seats claim
    // the same space.
    for (let pass = 0; pass < 24; pass++) {
      let worst = 0;
      for (let i = 0; i < this.bodies.length; i++) {
        const a = this.bodies[i];
        for (let j = i + 1; j < this.bodies.length; j++) {
          const b = this.bodies[j];
          const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z;
          const rr = (a.radius + b.radius) * REST_SEPARATION;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-9) continue;
          const d = Math.sqrt(d2);
          const pen = (rr - d) * 0.5;
          if (pen > worst) worst = pen;
          const nx = dx / d, ny = dy / d, nz = dz / d;
          // Symmetric. Giving the upper body the larger share is precisely
          // what ratchets a stack up into the ceiling over many passes; the
          // seat clamp below is what keeps the heap from sinking instead.
          a.pos.x -= nx * pen; a.pos.y -= ny * pen; a.pos.z -= nz * pen;
          b.pos.x += nx * pen; b.pos.y += ny * pen; b.pos.z += nz * pen;
        }
      }
      for (const b of this.bodies) {
        const lx = CAB.inX - b.radius + WALL_SQUASH, lz = CAB.inZ - b.radius + WALL_SQUASH;
        b.pos.x = clamp(b.pos.x, -lx, lx);
        b.pos.z = clamp(b.pos.z, -lz, lz);
        // Height is authored, never emergent: a body sits at the seat solved
        // for it and may sink toward the mat, but nothing may climb.
        b.pos.y = clamp(b.pos.y, b.floorY, b._seatY + 0.01);
        // keep clear of the raised chute lip
        const dx = b.pos.x - CAB.hole.x, dz = b.pos.z - CAB.hole.z;
        const d = Math.hypot(dx, dz);
        const minD = CAB.hole.rim + b.radius * 0.8;
        if (d < minD && b.pos.y < b.floorY + b.radius * 1.1) {
          const inv = 1 / (d || 1e-4);
          b.pos.x += dx * inv * (minD - d);
          b.pos.z += dz * inv * (minD - d);
        }
      }
      if (worst < 1e-4) break;
    }

    // Arranged, not simulated: the shelf is at rest until the claw disturbs it.
    for (const b of this.bodies) {
      b.vel.set(0, 0, 0);
      b.angVel.set(0, 0, 0);
      b.sleeping = true;
      b.sleepTimer = SLEEP_TIME;
      b.grounded = b.pos.y <= b.floorY + 1e-3;
      b.syncMesh();
    }
    this.refreshCoverage();
  }

  /**
   * Physics step. `settling` skips the sleep logic and the soft-hit callback.
   *
   * Splits a large `dt` into several small, fixed-size sub-steps before
   * touching any physics. Contact detection here is discrete (no continuous
   * sweep) and depends on nobody moving further in one step than the
   * "still touching" window — fine at the 1/60s this file's own settle
   * loop always uses, but main.js's render loop hands this real frame
   * time, capped only at 0.1s for tab-switch hiccups. Under the slow
   * software renderer this game actually ships to test with, ordinary
   * frames often run that slow, and a stacked toy can fall clean through a
   * neighbour's contact window inside one such frame: `restingOnBody`
   * never gets marked for it, so it can never sleep and the "layer 1/2
   * toys never settle" symptom looks identical to a logic bug in the sleep
   * test even though the sleep test itself is fine. Substepping here means
   * every caller — layout()'s settle loop, this file's own steady 1/60s
   * calls, and a real slow frame — all see the same small, safe dt.
   */
  step(dt, settling = false) {
    if (dt <= 0) return;
    const substeps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
    const subDt = dt / substeps;
    for (let i = 0; i < substeps; i++) this._stepOnce(subDt, settling);
  }

  /**
   * layout()-only: `steps` settle steps at 1/60s with gravity ramped from a
   * gentle fraction up to full over the first quarter of the window. Right
   * after a body is placed exactly tangent to its seat, full gravity
   * re-penetrates it faster than a handful of relaxation passes can resolve
   * every step — a much softer fall gives the correction solver
   * proportionally more say while the contact is still establishing itself,
   * without changing how gravity behaves anywhere the game is actually
   * played (this never runs outside layout()).
   */
  _gentleSettle(steps) {
    const rampSteps = Math.max(1, Math.floor(steps / 2));
    for (let i = 0; i < steps; i++) {
      const scale = i < rampSteps ? lerp(0.12, 1, i / rampSteps) : 1;
      this._stepOnce(1 / 60, true, scale);
    }
  }

  // gravityScale is internal-only (not part of the public step(dt, settling)
  // contract) — layout() uses it right after reseating a tier, so the
  // correction solver has proportionally more say over a much gentler fall
  // while a body first finds genuine contact with its seat, instead of
  // gravity re-penetrating it faster than a few relaxation passes can
  // resolve.
  _stepOnce(dt, settling = false, gravityScale = 1) {
    const bodies = this.bodies;
    const n = bodies.length;
    const h = CAB.hole;

    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b.held || b.inChute) continue;
      const wasResting = b.restingOnBody;   // last step's value; this step's is only known after separation runs, below
      b.restingOnBody = false;   // recomputed below if separation finds a support
      if (b.sleeping) continue;

      b.vel.y += GRAVITY * gravityScale * dt;
      b.pos.addScaledVector(b.vel, dt);

      // ---- floor ----
      const fy = b.floorY;
      if (b.pos.y < fy) {
        const impact = -b.vel.y;
        b.pos.y = fy;
        if (b.vel.y < 0) {
          b.vel.y = -b.vel.y * REST;
          if (Math.abs(b.vel.y) < 0.4) b.vel.y = 0;
          if (impact > 0.9) {
            b.plush.impact(clamp(impact * 0.16, 0.15, 1.1));
            if (!settling && this.onSoftHit) this.onSoftHit(b, clamp(impact / 4, 0, 1));
          }
        }
        const f = Math.pow(FLOOR_FRICTION, dt * 60);
        b.vel.x *= f; b.vel.z *= f;
        // rolling: horizontal motion on the ground spins the toy
        b.angVel.x += b.vel.z * dt * 5.5;
        b.angVel.z -= b.vel.x * dt * 5.5;
        b.grounded = true;
      } else {
        b.grounded = false;
      }

      // ---- showcase walls ---- clamp so no more than WALL_SQUASH of the
      // toy can dent past the interior glass, not 20% of its radius.
      const lx = CAB.inX - b.radius + WALL_SQUASH;
      const lz = CAB.inZ - b.radius + WALL_SQUASH;
      if (b.pos.x < -lx) { b.pos.x = -lx; b.vel.x = Math.abs(b.vel.x) * REST; }
      if (b.pos.x > lx) { b.pos.x = lx; b.vel.x = -Math.abs(b.vel.x) * REST; }
      if (b.pos.z < -lz) { b.pos.z = -lz; b.vel.z = Math.abs(b.vel.z) * REST; }
      if (b.pos.z > lz) { b.pos.z = lz; b.vel.z = -Math.abs(b.vel.z) * REST; }

      // ---- prize-hole rim (a raised lip; toys never fall in by accident) ----
      const dx = b.pos.x - h.x, dz = b.pos.z - h.z;
      const d = Math.hypot(dx, dz);
      const minD = h.rim + b.radius * 0.8;
      if (d < minD && b.pos.y < fy + b.radius * 1.1) {
        const inv = 1 / (d || 1e-4);
        const nx = dx * inv, nz = dz * inv;
        const push = minD - d;
        b.pos.x += nx * push;
        b.pos.z += nz * push;
        const vn = b.vel.x * nx + b.vel.z * nz;
        if (vn < 0) { b.vel.x -= vn * nx * 1.4; b.vel.z -= vn * nz * 1.4; }
      }

      // ---- integrate rotation ----
      const w = b.angVel;
      const wl = w.length();
      if (wl > 1e-4) {
        this._q.setFromAxisAngle(this._tmp.copy(w).divideScalar(wl), wl * dt);
        b.quat.premultiply(this._q).normalize();
      }
      // A body resting on another one (not the floor plane) used to keep
      // the slow 0.985 airborne/tumbling decay regardless — its own contact
      // is only known once separation runs, later this step, so this reads
      // last step's value, one step stale, which is fine since it does not
      // change abruptly for a settling body. Without this, angVel's small
      // contribution to the sleep test's speed measure could linger well
      // past when a stacked toy was otherwise ready to sleep.
      const angDamp = Math.pow(b.grounded || wasResting ? 0.86 : 0.985, dt * 60);
      w.multiplyScalar(angDamp);
    }

    // ---- pairwise separation: several cheap relaxation passes hold a
    // three-layer heap together far better than one. Positions resolve on
    // every pass; the velocity impulse (and its sound cue) is only applied on
    // the last one, so repeated passes cannot pump energy into the pile.
    if (this._liftCap.length < n) {
      this._liftCap = new Float64Array(n + 16);
      this._liftUsed = new Float64Array(n + 16);
    }
    for (let i = 0; i < n; i++) { this._liftCap[i] = 0; this._liftUsed[i] = 0; }
    const liftCap = this._liftCap, liftUsed = this._liftUsed;

    for (let iter = 0; iter < SEP_ITERS; iter++) {
      const resolveVelocity = iter === SEP_ITERS - 1;
      for (let i = 0; i < n; i++) {
        const a = bodies[i];
        if (a.held || a.inChute) continue;
        for (let j = i + 1; j < n; j++) {
          const b = bodies[j];
          if (b.held || b.inChute) continue;
          if (a.sleeping && b.sleeping) continue;
          const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, dz = b.pos.z - a.pos.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 1e-8) continue;
          const sumR = a.radius + b.radius;
          const support = sumR * SUPPORT_DY;

          // Support (for sleep bookkeeping and the seat-damping pass below)
          // is marked over a wider "touching" range than the one used to
          // trigger positional correction below — resting contact and
          // penetration are different questions. Right at the relaxed
          // pair's rest distance (d == rr, no penetration left to resolve)
          // it is still genuinely seated, but `d2 < rr*rr` alone would call
          // that "not touching" and reset its sleep progress. SUPPORT_GRACE
          // then keeps the flag alive for a short window after the last
          // frame that actually detected it, bridging any single frame
          // where even the widened check missed.
          const contactR = sumR + SUPPORT_SLACK;
          if (d2 < contactR * contactR) {
            if (dy > support) { b.restingOnBody = true; b.supportTimer = SUPPORT_GRACE; }
            else if (-dy > support) { a.restingOnBody = true; a.supportTimer = SUPPORT_GRACE; }
          }

          const rr = sumR * REST_SEPARATION;   // 10% overlap allowed = plush squish
          if (d2 >= rr * rr) continue;   // touching, but nothing to resolve this pass
          const d = Math.sqrt(d2);
          const inv = 1 / d;
          const nx = dx * inv, ny = dy * inv, nz = dz * inv;   // true contact normal, used for the bounce below
          const pen = rr - d;
          const stacked = Math.abs(dy) > support * 0.5;

          // Position mostly moves along the true centre-to-centre normal —
          // a large lean redirected toward vertical here once let a body
          // ratchet upward indefinitely (the correction no longer converges
          // to zero once actually separated along its real axis, so
          // hundreds of settle steps could pump it clear of every contact
          // and it would hang there forever, never grounded or resting
          // again). A *small* lean (STACK_LEAN) is safe precisely because
          // LIFT_CAP_FRAC below bounds how far up any single step can move
          // a body regardless of direction or how many pairs contribute —
          // it supplies the small restoring push a saddle-seated body needs
          // between relaxation passes (see saddlePosition()) without being
          // able to run away.
          let cx = nx, cy = ny, cz = nz;
          if (stacked) {
            const horiz = Math.hypot(nx, nz);
            if (horiz > 1e-4) {
              const upSign = dy >= 0 ? 1 : -1;
              cx = nx * (1 - STACK_LEAN);
              cz = nz * (1 - STACK_LEAN);
              cy = ny + upSign * STACK_LEAN * horiz;
              const cl = Math.hypot(cx, cy, cz) || 1;
              cx /= cl; cy /= cl; cz /= cl;
            }
          }

          // The lower body of a stacked pair moves less than the upper one
          // (some inertia, so the heap's base does not sink every time
          // something settles onto it) — the upper body absorbing most,
          // not all, of the correction is safe now that LIFT_CAP_FRAC
          // bounds how far any single step can lift it regardless of this
          // ratio.
          let shareA = 0.5, shareB = 0.5;
          if (stacked) {
            if (dy >= 0) { shareA = 0.35; shareB = 0.65; }   // b sits above a
            else { shareA = 0.65; shareB = 0.35; }           // a sits above b
          }
          // A sleeping body must not move at all until something actually
          // wakes it (below) — otherwise it silently drifts under an awake
          // neighbour's correction while its own velocity stays frozen at
          // zero, never reacting, and a support can erode out from under a
          // stack one imperceptible nudge at a time over hundreds of steps.
          // Treat it like a `held` body: immovable, and the awake side of
          // the pair absorbs the whole correction instead of its usual share.
          if (a.sleeping) { shareB += shareA; shareA = 0; }
          else if (b.sleeping) { shareA += shareB; shareB = 0; }

          // Apply x/z freely; apply y through the per-body upward-lift cap
          // (downward is never capped — sinking into the floor plane is
          // already handled separately, and is not the runaway direction).
          const dyA = -cy * pen * shareA, dyB = cy * pen * shareB;
          a.pos.x -= cx * pen * shareA; a.pos.z -= cz * pen * shareA;
          b.pos.x += cx * pen * shareB; b.pos.z += cz * pen * shareB;
          if (dyA > 0) {
            // the running cap grows to admit at least the largest single
            // pair's own demand (so one genuine deep overlap still resolves
            // in one go) but never past LIFT_CAP_FRAC of the body's own
            // radius, an absolute ceiling independent of how that demand
            // arose.
            liftCap[i] = Math.min(a.radius * LIFT_CAP_FRAC, Math.max(liftCap[i], dyA));
            const budget = Math.max(0, liftCap[i] - liftUsed[i]);
            const applied = Math.min(dyA, budget);
            a.pos.y += applied; liftUsed[i] += applied;
          } else {
            a.pos.y += dyA;
          }
          if (dyB > 0) {
            liftCap[j] = Math.min(b.radius * LIFT_CAP_FRAC, Math.max(liftCap[j], dyB));
            const budget = Math.max(0, liftCap[j] - liftUsed[j]);
            const applied = Math.min(dyB, budget);
            b.pos.y += applied; liftUsed[j] += applied;
          } else {
            b.pos.y += dyB;
          }

          // Waking is contagious, but only when the contact actually carries
          // relative motion — two bodies resting quietly against each other
          // still touch (that is what "resting" means here), so waking on
          // mere overlap regardless of speed reset both bodies' sleep timers
          // on every single step, and a crowded pile could never sleep.
          // (at least one of the pair is awake here — the loop above already
          // skipped fully-sleeping pairs)
          const rvx = b.vel.x - a.vel.x, rvy = b.vel.y - a.vel.y, rvz = b.vel.z - a.vel.z;
          if (rvx * rvx + rvy * rvy + rvz * rvz > WAKE_REL_SPEED * WAKE_REL_SPEED) {
            a.wake(); b.wake();
          }

          // A positional correction must never be "free" for a body that is
          // basically settling: leaving a small residual closing velocity
          // untouched means it simply re-penetrates next step, the same
          // correction fires again, and repeated across many relaxation
          // passes and steps that is the pump that lets a body ratchet away
          // from equilibrium. This removes a *small* closing component of
          // the pair's relative velocity (no bounce, split by the same
          // shares as the position fix above) on every pass, not only the
          // last. It deliberately does not touch a large closing speed —
          // that is a body still genuinely falling, only grazing this pair
          // for a single frame on its way past (skirting a crowded stack
          // toward open floor); killing a real fall's momentum every time
          // it grazes something turns a sub-second drop into one that takes
          // many seconds. A real impact is handled by the bouncier,
          // restitution-based impulse below, which still only fires once,
          // on the final pass, as the "real" collision response.
          const vnAll = rvx * nx + rvy * ny + rvz * nz;
          if (vnAll < 0 && vnAll > -1.0) {
            if (!a.sleeping) { a.vel.x -= nx * vnAll * shareA; a.vel.y -= ny * vnAll * shareA; a.vel.z -= nz * vnAll * shareA; }
            if (!b.sleeping) { b.vel.x += nx * vnAll * shareB; b.vel.y += ny * vnAll * shareB; b.vel.z += nz * vnAll * shareB; }
          }

          if (resolveVelocity) {
            const rvx2 = b.vel.x - a.vel.x, rvy2 = b.vel.y - a.vel.y, rvz2 = b.vel.z - a.vel.z;
            const vn = rvx2 * nx + rvy2 * ny + rvz2 * nz;
            if (vn < 0) {
              const jimp = -vn * 0.5 * (1 + REST);
              // A body that is still sleeping at this point (the wake check
              // above did not consider this contact worth waking it for)
              // must not receive an impulse either, or it drifts with a
              // nonzero velocity while flagged asleep — skip its half.
              if (!a.sleeping) { a.vel.x -= nx * jimp; a.vel.y -= ny * jimp; a.vel.z -= nz * jimp; }
              if (!b.sleeping) { b.vel.x += nx * jimp; b.vel.y += ny * jimp; b.vel.z += nz * jimp; }
              if (!settling && -vn > 0.8) {
                a.plush.impact(clamp(-vn * 0.09, 0.1, 0.6));
                b.plush.impact(clamp(-vn * 0.09, 0.1, 0.6));
                if (this.onSoftHit) this.onSoftHit(b, clamp(-vn / 5, 0, 0.8));
              }
            }
          }
        }
      }
    }

    // ---- a body touching the floor or resting on another one bleeds its
    // horizontal speed hard, so it finds a stable seat instead of jittering
    // there indefinitely — a crowded floor row squeezed from both sides by
    // its neighbours is just as prone to a standing, never-quite-zero
    // vibration as a stacked one is, so this uses the same grounded-or-
    // resting condition the sleep test below reads ----
    for (const b of bodies) {
      if (b.held || b.inChute || b.sleeping || !(b.grounded || b.restingOnBody || b.supportTimer > 0)) continue;
      const f = Math.pow(CONTACT_DAMP, dt * 60);
      if (Math.hypot(b.vel.x, b.vel.z) < CONTACT_STOP_SPEED) { b.vel.x = 0; b.vel.z = 0; }
      else { b.vel.x *= f; b.vel.z *= f; }
      // Positional correction above pushes an overlapping body back out of
      // its support, but a purely position-based fix leaves its *velocity*
      // untouched — if that pair no longer overlaps by the last relaxation
      // pass (the only one that resolves velocity), the impulse never
      // fires. Left alone this shows up two ways: a small negative vel.y
      // that quietly re-falls into its support every frame (a slow sink
      // that never actually stops), or a small positive one that stands
      // and micro-bounces forever without settling. Both are noise, not
      // real motion — squash hard in both directions.
      //
      // Only for a genuinely small residual, though: a body still actually
      // falling with real speed can graze another body's SUPPORT_SLACK
      // zone for a single frame without truly landing on it (skirting past
      // a crowded stack on the way to open floor) — squashing *that* every
      // time it grazes turns a normal ~0.3s fall into one that takes many
      // seconds, one grazed contact at a time. Only noise this small is a
      // seated toy's own jitter, never a real fall in progress.
      if (Math.abs(b.vel.y) < 0.5) {
        b.vel.y *= 0.1;
        if (Math.abs(b.vel.y) < 0.3) b.vel.y = 0;
      }
    }

    // clamp everything back inside after separation (same WALL_SQUASH rule)
    for (const b of bodies) {
      if (b.held || b.inChute) continue;
      const lx = CAB.inX - b.radius + WALL_SQUASH, lz = CAB.inZ - b.radius + WALL_SQUASH;
      b.pos.x = clamp(b.pos.x, -lx, lx);
      b.pos.z = clamp(b.pos.z, -lz, lz);
      if (b.pos.y < b.floorY) b.pos.y = b.floorY;
    }

    // ---- sleep: decided last, from this step's final grounded/support state,
    // so a stacked toy (never "grounded" on the floor plane) can sleep too —
    // the main CPU saving for a three-layer heap ----
    if (!settling) {
      for (const b of bodies) {
        if (b.held || b.inChute || b.sleeping) continue;
        b.supportTimer = Math.max(0, b.supportTimer - dt);
        const speed = b.vel.length() + b.angVel.length() * 0.25;
        // supportTimer bridges a short gap after the last frame that
        // actually detected contact, so one missed-overlap frame amid an
        // otherwise settled stack cannot single-handedly stall it here.
        const supported = b.grounded || b.restingOnBody || b.supportTimer > 0;
        if (speed < SLEEP_SPEED && supported) {
          b.sleepTimer += dt;
        } else {
          // Decay rather than hard-reset: a single stray frame (a contact
          // flag that briefly missed, a one-step speed blip) would otherwise
          // erase a body's entire accumulated quiet time and restart the
          // whole SLEEP_TIME wait from zero. A body under genuine sustained
          // disturbance still never accumulates net progress this way —
          // decay and accrual are the same rate, so it takes as long to
          // recover from a blip as the blip itself lasted.
          b.sleepTimer = Math.max(0, b.sleepTimer - dt);
        }
        // Backstop, independent of any detected support at all: nothing
        // should be able to stay awake forever purely because the contact
        // flags never line up, however small its actual residual jitter is.
        if (speed < BACKSTOP_SPEED) b.calmTimer += dt; else b.calmTimer = 0;

        if (b.sleepTimer > SLEEP_TIME || b.calmTimer > BACKSTOP_TIME) {
          b.sleeping = true;
          b.vel.set(0, 0, 0);
          b.angVel.set(0, 0, 0);
        }
      }
    }
  }

  /** Animate + sync meshes. Sleeping toys skip their (relatively costly) rig update. */
  render(dt) {
    for (const b of this.bodies) {
      if (b.held || b.inChute) continue;
      b.syncMesh();
      if (b.sleeping) {
        // still let a residual squash settle out, but skip the limb springs
        b.plush.update(Math.min(dt, 1 / 30), this._zero, 0);
      } else {
        b.plush.update(dt, b.vel, 0);
      }
    }
  }

  /** Nearest non-held toy to an (x,z) column, weighted so higher toys win ties. */
  nearestTo(x, z, maxDist = 999) {
    let best = null, bestScore = Infinity;
    for (const b of this.bodies) {
      if (b.held || b.inChute) continue;
      const d = Math.hypot(b.pos.x - x, b.pos.z - z);
      if (d > maxDist) continue;
      const score = d - b.pos.y * 0.28;   // prefer the toy on top of the heap
      if (score < bestScore) { bestScore = score; best = b; }
    }
    return best ? { body: best, dist: Math.hypot(best.pos.x - x, best.pos.z - z) } : null;
  }

  remove(body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  /**
   * Recompute `covered` for every body: B covers A when B's centre is above
   * A's by more than SUPPORT_DY*(rA+rB) and their horizontal distance is
   * under SUPPORT_DXZ*(rA+rB). Not run every step — the drama director calls
   * this once per grab to measure what got uncovered.
   */
  refreshCoverage() {
    const bodies = this.bodies;
    const n = bodies.length;
    for (let i = 0; i < n; i++) bodies[i].covered = 0;
    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        const rr = a.radius + b.radius;
        const dxz = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
        if (dxz >= rr * SUPPORT_DXZ) continue;
        const dy = b.pos.y - a.pos.y;
        if (dy > rr * SUPPORT_DY) a.covered++;
        else if (-dy > rr * SUPPORT_DY) b.covered++;
      }
    }
  }

  /** Wake every body within `radius` of a point — used when a toy is lifted
   *  out of the heap so the pile visibly subsides into the gap it left. */
  wakeAround(x, y, z, radius) {
    const r2 = radius * radius;
    for (const b of this.bodies) {
      if (b.held || b.inChute) continue;
      const dx = b.pos.x - x, dy = b.pos.y - y, dz = b.pos.z - z;
      if (dx * dx + dy * dy + dz * dz <= r2) b.wake();
    }
  }

  /** Snapshot every body's pose + coverage, for the drama director to diff
   *  against once a grab has played out. */
  snapshot() {
    return this.bodies.map((body) => ({
      body,
      pos: body.pos.clone(),
      quat: body.quat.clone(),
      covered: body.covered,
    }));
  }
}
