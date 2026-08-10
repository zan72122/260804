// Prize-pile simulation.
//
// Deliberately not a general rigid-body engine: each toy is a soft sphere with
// a quaternion. That is enough to give a 4-year-old a readable cause->effect
// ("the claw pushed it, so it rolled toward me") at a fraction of the cost, and
// it lets the pile sleep almost all of the time.

import * as THREE from '../vendor/three/three.module.min.js';
import { CAB } from './cabinet.js';
import { Plush, SPECIES } from './plush.js';
import { clamp } from './util.js';

const GRAVITY = -9.2;
const REST = 0.24;
const FLOOR_FRICTION = 0.78;
const SLEEP_SPEED = 0.035;
const SLEEP_TIME = 0.45;

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
   * Build a fresh, always-winnable layout. Poses vary every round (upright,
   * on its side, on its back, leaning on a neighbour, half-buried) so the same
   * toy needs a slightly different aim next time.
   */
  layout(rng, { count = 7, quality = 1 } = {}) {
    this.clear();
    const order = rng.shuffle(SPECIES.slice());
    const picks = [];
    for (let i = 0; i < count; i++) picks.push(order[i % order.length]);

    // spots: a loose arc across the showcase, back row higher (stacked)
    const spots = [];
    const A = CAB.aim;
    const cols = 3, rows = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const fx = (c + 0.5) / cols, fz = (r + 0.5) / rows;
        spots.push({
          x: A.minX + 0.1 + fx * (A.maxX - A.minX - 0.2) + (rng() - 0.5) * 0.14,
          z: A.minZ + 0.06 + fz * (A.maxZ - A.minZ - 0.12) + (rng() - 0.5) * 0.12,
        });
      }
    }
    // extra toys go on top of the back row -> a second visual depth layer
    while (spots.length < count) {
      const base = spots[rng.int(0, 2)];
      spots.push({ x: base.x + (rng() - 0.5) * 0.16, z: base.z + (rng() - 0.5) * 0.12, stack: true });
    }

    const shuffledSpots = rng.shuffle(spots).slice(0, count);

    for (let i = 0; i < count; i++) {
      const species = picks[i];
      const variantCount = 3;
      const variant = rng.int(0, variantCount - 1);
      const plush = new Plush(species, variant, { quality, seed: rng.int(1, 9999), fuzz: quality > 0.55, detail: 'game' });
      const b = new Body(plush);
      const s = shuffledSpots[i];

      let x = clamp(s.x, CAB.aim.minX, CAB.aim.maxX);
      let z = clamp(s.z, CAB.aim.minZ, CAB.aim.maxZ);
      // never let a toy sit on the prize hole
      const dh = Math.hypot(x - CAB.hole.x, z - CAB.hole.z);
      const minH = CAB.hole.rim + b.radius + 0.05;
      if (dh < minH) {
        const nx = (x - CAB.hole.x) / (dh || 1), nz = (z - CAB.hole.z) / (dh || 1);
        x = CAB.hole.x + nx * minH;
        z = CAB.hole.z + nz * minH;
        x = clamp(x, CAB.aim.minX, CAB.aim.maxX);
        z = clamp(z, CAB.aim.minZ, CAB.aim.maxZ);
      }

      b.pos.set(x, b.floorY + (s.stack ? b.radius * 1.5 : 0) + 0.02, z);

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

    // settle so nothing starts interpenetrating
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

      // ---- sleep ----
      if (!settling) {
        const speed = b.vel.length() + wl * 0.25;
        if (speed < SLEEP_SPEED && b.grounded) {
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

    // ---- pairwise separation (soft toys squeeze a bit before pushing) ----
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
        const rvx = b.vel.x - a.vel.x, rvy = b.vel.y - a.vel.y, rvz = b.vel.z - a.vel.z;
        const vn = rvx * nx + rvy * ny + rvz * nz;
        if (vn < 0) {
          const jimp = -vn * 0.5 * (1 + REST);
          a.vel.x -= nx * jimp; a.vel.y -= ny * jimp; a.vel.z -= nz * jimp;
          b.vel.x += nx * jimp; b.vel.y += ny * jimp; b.vel.z += nz * jimp;
          a.wake(); b.wake();
          if (!settling && -vn > 0.8) {
            a.plush.impact(clamp(-vn * 0.09, 0.1, 0.6));
            b.plush.impact(clamp(-vn * 0.09, 0.1, 0.6));
            if (this.onSoftHit) this.onSoftHit(b, clamp(-vn / 5, 0, 0.8));
          }
        } else if (!a.sleeping || !b.sleeping) {
          a.wake(); b.wake();
        }
      }
    }

    // clamp everything back inside after separation
    for (const b of bodies) {
      if (b.held || b.inChute) continue;
      const lx = CAB.inX - b.radius * 0.8, lz = CAB.inZ - b.radius * 0.8;
      b.pos.x = clamp(b.pos.x, -lx, lx);
      b.pos.z = clamp(b.pos.z, -lz, lz);
      if (b.pos.y < b.floorY) b.pos.y = b.floorY;
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
}
