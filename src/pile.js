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

// One separation pass cannot hold a three-layer heap together (each pass only
// resolves the *worst* overlap a body is in); a handful of cheap relaxation
// passes converges close enough without turning this into a real solver.
const SEP_ITERS = 3;

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
  let n0 = Math.max(3, Math.round((count + 3) / 3));
  let n1 = Math.max(2, n0 - 1);
  let n2 = Math.max(0, count - n0 - n1);
  n0 += count - (n0 + n1 + n2);   // absorb any rounding slack into the base layer
  return [Math.max(1, n0), n1, n2];
}

/**
 * Height a sphere of `radius` rests at when perched symmetrically in the
 * saddle between two support spheres — resting against both at once, not
 * just guessed from its own size. Used both for the rough pre-physics spawn
 * guess (so prominence sorting has a real height) and to reseat a tier once
 * the tier below it has actually finished settling (see the staged settle
 * in layout()), so a stacked toy spawns at its seat instead of far above it.
 */
function perchY(radius, ax, ay, az, arad, bx, by, bz, brad) {
  const rSup = (arad + brad) / 2;
  const halfGap = Math.hypot(bx - ax, bz - az) / 2;
  const rTouch = rSup + radius;
  const riseSq = rTouch * rTouch - halfGap * halfGap;
  // if the two supports are too far apart to physically touch a sphere
  // resting between both, fall back to a reasonable perch height
  const rise = riseSq > 0 ? Math.sqrt(riseSq) : rTouch * 0.55;
  return (ay + by) / 2 + rise * 0.94;   // slightly under so gravity seats it, not hover-drop
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
        // Spawn a stacked toy right at the height it should actually settle
        // to — resting against both of the spot's two support neighbours —
        // rather than a fixed multiple of its own radius that ignores how
        // far apart (or how big) those neighbours actually are. supA/supB
        // are already fully resolved here: spots is layer0 then layer1 then
        // layer2, so a toy's supports were processed earlier in this loop.
        const supA = s.supA, supB = s.supB;
        s.y = Math.max(floorY, perchY(s.radius, supA.x, supA.y, supA.z, supA.radius,
                                                 supB.x, supB.y, supB.z, supB.radius));
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
    const SETTLE_STEPS = 70;
    for (let i = 0; i < SETTLE_STEPS; i++) this.step(1 / 60, true);   // layer 0 alone

    for (let tier = 1; tier <= 2; tier++) {
      for (const s of spots) {
        if (s.layer !== tier) continue;
        // reseat only the height: x/z keep the jittered variety already
        // chosen above, which still reads fine against a support that has
        // only shifted a little during its own settle
        const b = s.body, supA = s.supA.body, supB = s.supB.body;
        b.pos.y = Math.max(b.floorY, perchY(
          b.radius, supA.pos.x, supA.pos.y, supA.pos.z, supA.radius,
          supB.pos.x, supB.pos.y, supB.pos.z, supB.radius));
        b.held = false;
        b.syncMesh();
        if (globalThis.__PILE_DEBUG) console.log('reseat', tier, this.bodies.indexOf(b), 'y=', b.pos.y.toFixed(3));
      }
      const dbgSteps = (globalThis.__PILE_DEBUG && tier === 2) ? 600 : SETTLE_STEPS;
      for (let i = 0; i < dbgSteps; i++) {
        this.step(1 / 60, true);
        if (globalThis.__PILE_DEBUG && tier === 2 && (i % 20 === 0)) {
          console.log('  step', i, this.bodies.map((bb) => bb.pos.y.toFixed(3)).join(','));
        }
      }
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
    return this.bodies;
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

  _stepOnce(dt, settling = false) {
    const bodies = this.bodies;
    const n = bodies.length;
    const h = CAB.hole;

    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b.held || b.inChute) continue;
      const wasResting = b.restingOnBody;   // last step's value; this step's is only known after separation runs, below
      b.restingOnBody = false;   // recomputed below if separation finds a support
      if (b.sleeping) continue;

      b.vel.y += GRAVITY * dt;
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

          const rr = sumR * 0.9;   // 10% overlap allowed = plush squish
          if (d2 >= rr * rr) continue;   // touching, but nothing to resolve this pass
          const d = Math.sqrt(d2);
          const inv = 1 / d;
          const nx = dx * inv, ny = dy * inv, nz = dz * inv;   // true contact normal
          const pen = rr - d;
          const stacked = Math.abs(dy) > support * 0.5;

          // Position moves exactly along the true centre-to-centre normal —
          // NOT redirected toward vertical for a stacked pair. An earlier
          // version leaned the push direction upward here to help a toy
          // climb into a saddle, but that moves a body further than the
          // actual overlap requires: the correction no longer converges to
          // zero once the pair is genuinely separated along its real axis,
          // so repeated passes (three a step, hundreds of steps across a
          // settle) can ratchet a body upward indefinitely — once clear of
          // every neighbour it is never grounded or resting again and hangs
          // there forever, awake, in a limit cycle. The true-normal
          // correction is self-limiting: it always converges to exactly
          // resolving the real overlap and nothing more.
          //
          // The lower body of a stacked pair still moves less than the
          // upper one (some inertia, so the heap's base does not sink every
          // time something settles onto it) — but gently, not by giving the
          // upper body most of the correction, which is its own ratchet risk.
          let shareA = 0.5, shareB = 0.5;
          if (stacked) {
            if (dy >= 0) { shareA = 0.4; shareB = 0.6; }   // b sits above a
            else { shareA = 0.6; shareB = 0.4; }           // a sits above b
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
          a.pos.x -= nx * pen * shareA; a.pos.y -= ny * pen * shareA; a.pos.z -= nz * pen * shareA;
          b.pos.x += nx * pen * shareB; b.pos.y += ny * pen * shareB; b.pos.z += nz * pen * shareB;

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

          // A positional correction must never be "free": leaving the
          // velocity that drove a body into this overlap untouched means it
          // simply re-penetrates next step, and the same correction fires
          // again — the exact pump that let a body ratchet away from
          // equilibrium. This removes the closing component of the pair's
          // relative velocity (no bounce, split by the same shares as the
          // position fix above) on *every* pass, not only the last, so no
          // iteration's correction can ever be free. The bouncier,
          // restitution-based impulse below (with its impact sound) still
          // only fires once, on the final pass, as the "real" collision
          // response layered on top.
          const vnAll = rvx * nx + rvy * ny + rvz * nz;
          if (vnAll < 0) {
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
      // real motion — squash hard in both directions (matching CONTACT_DAMP's
      // own aggressive 0.35 factor is not enough on its own to stop a sink
      // that gets re-seeded every step, so this cuts harder than the
      // horizontal case above and then snaps what's left near zero).
      b.vel.y *= 0.1;
      if (Math.abs(b.vel.y) < 0.3) b.vel.y = 0;
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
