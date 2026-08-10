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

// A stacked toy is never "grounded" on the floor plane, so these have to be
// generous enough that a body resting only on other bodies still falls
// asleep — that is the main CPU saving now that the heap is three deep.
const SLEEP_SPEED = 0.05;
const SLEEP_TIME = 0.30;

// One separation pass cannot hold a three-layer heap together (each pass only
// resolves the *worst* overlap a body is in); a handful of cheap relaxation
// passes converges close enough without turning this into a real solver.
const SEP_ITERS = 3;

// Extra horizontal damping applied to a body found resting on another one, so
// a toy in the saddle between two neighbours settles into that seat instead
// of sliding around on top of them.
const CONTACT_DAMP = 0.5;

// Shared "is B sitting on A?" thresholds — used both by the per-step contact
// mark (for sleep/damping) and by refreshCoverage() (for the drama director).
const SUPPORT_DY = 0.35;   // vertical offset, as a fraction of the radius sum
const SUPPORT_DXZ = 0.8;   // horizontal offset, as a fraction of the radius sum

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
      s.y = s.layer === 0 ? floorY + 0.02
          : s.layer === 1 ? floorY + s.radius * 1.5
          : floorY + s.radius * 3.0;
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

    // settle so nothing starts interpenetrating (and stacked toys actually land)
    for (let i = 0; i < 90; i++) this.step(1 / 60, true);
    for (const b of this.bodies) { b.vel.set(0, 0, 0); b.angVel.multiplyScalar(0.2); }
    return this.bodies;
  }

  /** Physics step. `settling` skips the sleep logic and the soft-hit callback. */
  step(dt, settling = false) {
    const bodies = this.bodies;
    const n = bodies.length;
    const h = CAB.hole;

    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b.held || b.inChute) continue;
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

      // ---- showcase walls ----
      const lx = CAB.inX - b.radius * 0.8;
      const lz = CAB.inZ - b.radius * 0.8;
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
      const angDamp = Math.pow(b.grounded ? 0.86 : 0.985, dt * 60);
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
          const rr = (a.radius + b.radius) * 0.9;   // 10% overlap allowed = plush squish
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-8) continue;
          const d = Math.sqrt(d2);
          const inv = 1 / d;
          const nx = dx * inv, ny = dy * inv, nz = dz * inv;
          const pen = (rr - d) * 0.5;
          a.pos.x -= nx * pen; a.pos.y -= ny * pen; a.pos.z -= nz * pen;
          b.pos.x += nx * pen; b.pos.y += ny * pen; b.pos.z += nz * pen;

          // waking is contagious: contact with a moving body wakes a sleeping
          // one, and repeating this over several passes lets the wake ripple
          // down through a stack within a single step
          if (!a.sleeping || !b.sleeping) { a.wake(); b.wake(); }

          // mark vertical support (for sleep bookkeeping and the seat-damping
          // pass below) on every iteration, not just the velocity one
          const support = (a.radius + b.radius) * SUPPORT_DY;
          if (dy > support) b.restingOnBody = true;
          else if (-dy > support) a.restingOnBody = true;

          if (resolveVelocity) {
            const rvx = b.vel.x - a.vel.x, rvy = b.vel.y - a.vel.y, rvz = b.vel.z - a.vel.z;
            const vn = rvx * nx + rvy * ny + rvz * nz;
            if (vn < 0) {
              const jimp = -vn * 0.5 * (1 + REST);
              a.vel.x -= nx * jimp; a.vel.y -= ny * jimp; a.vel.z -= nz * jimp;
              b.vel.x += nx * jimp; b.vel.y += ny * jimp; b.vel.z += nz * jimp;
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

    // ---- a body resting on another one bleeds its horizontal speed faster
    // than one only touching the floor, so it finds a stable seat between its
    // neighbours instead of jittering there indefinitely ----
    for (const b of bodies) {
      if (b.held || b.inChute || b.sleeping || !b.restingOnBody) continue;
      const f = Math.pow(CONTACT_DAMP, dt * 60);
      b.vel.x *= f; b.vel.z *= f;
    }

    // clamp everything back inside after separation
    for (const b of bodies) {
      if (b.held || b.inChute) continue;
      const lx = CAB.inX - b.radius * 0.8, lz = CAB.inZ - b.radius * 0.8;
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
        const speed = b.vel.length() + b.angVel.length() * 0.25;
        if (speed < SLEEP_SPEED && (b.grounded || b.restingOnBody)) {
          b.sleepTimer += dt;
          if (b.sleepTimer > SLEEP_TIME) {
            b.sleeping = true;
            b.vel.set(0, 0, 0);
            b.angVel.set(0, 0, 0);
          }
        } else {
          b.sleepTimer = 0;
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
