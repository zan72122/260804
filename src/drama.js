// Drama director.
//
// A grab is not a coin flip between "prize" and "nothing". This module picks
// *where* on the toy the fingers actually closed (a consequence of aim, never
// a die roll), and then measures whether the pile did anything a 4-year-old
// could see happen. It never touches the scene and never runs the state
// machine — it just hands the state machine numbers to react to.

import * as THREE from '../vendor/three/three.module.min.js';
import { GRAB_TYPES, DRAMA, CHUTE } from './contracts.js';

// The fingers close from above; they cannot grip a point that sits meaningfully
// higher than their own grip line. A little slack (a few cm) covers the toy
// leaning into the claw as it settles.
const FINGER_OVERHANG = 0.12;

// Scratch vector reused inside the (synchronous, non-reentrant) scoring pass
// in resolveGrabPoint so picking a point among many doesn't allocate one.
const _world = new THREE.Vector3();

/** 2*acos(|dot|) — the shortest rotation angle between two orientations. */
function quatAngle(a, b) {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  return 2 * Math.acos(Math.min(1, Math.abs(dot)));
}

export class Drama {
  /** @param {import('./pile.js').Pile} pile */
  constructor(pile) {
    this.pile = pile;
    /** @type {Array<{body:object,pos:THREE.Vector3,quat:THREE.Quaternion,covered:number}>|null} */
    this._snapshot = null;
    /** @type {Map<object,{body:object,pos:THREE.Vector3,quat:THREE.Quaternion,covered:number}>|null} */
    this._byBody = null;
  }

  /**
   * Which part of the toy did the fingers close on? Never null — a plush with
   * no reachable grab points (or none at all, e.g. the plush rig hasn't landed
   * its grabPoints yet) simply falls back to the body centre.
   */
  static resolveGrabPoint(body, clawX, clawZ, gripY, reach) {
    const plush = body.plush;
    const points = plush && plush.grabPoints;

    let bestIndex = -1;
    let bestScore = Infinity;

    if (points && points.length && typeof plush.grabLocal === 'function') {
      for (let i = 0; i < points.length; i++) {
        // body-local metres -> world, reusing the scratch vector each pass
        plush.grabLocal(i, _world).applyQuaternion(body.quat).add(body.pos);

        const dx = _world.x - clawX, dz = _world.z - clawZ;
        const dist = Math.hypot(dx, dz);
        if (dist > reach) continue;
        // fingers close from above; they can't meet a point well above their
        // own grip line
        if (_world.y > gripY + FINGER_OVERHANG) continue;

        // near the claw axis wins, with a bias toward the highest point —
        // that's what the fingers physically meet first as they close
        const score = dist - 0.55 * (_world.y - body.pos.y);
        if (score < bestScore) { bestScore = score; bestIndex = i; }
      }
    }

    if (bestIndex === -1) {
      return { index: -1, type: 'body', hold: GRAB_TYPES.body.hold, spin: GRAB_TYPES.body.spin, local: new THREE.Vector3() };
    }

    const type = points[bestIndex].type;
    const g = GRAB_TYPES[type] || GRAB_TYPES.body;
    // fresh vector: the caller keeps this one, unlike the scratch above
    const local = plush.grabLocal(bestIndex, new THREE.Vector3());
    return { index: bestIndex, type, hold: g.hold, spin: g.spin, local };
  }

  /** Snapshot the pile. Call at the moment the claw starts to close. */
  begin() {
    const snapshot = this.pile.snapshot();
    this._snapshot = snapshot;
    this._byBody = new Map();
    for (const s of snapshot) this._byBody.set(s.body, s);
  }

  /**
   * Measure what has visibly changed since begin(). One point per distinct
   * kind of event, not per toy — a pile that shudders is one "neighbour"
   * event whether one toy moved or four.
   */
  evaluate(heldBody) {
    const pile = this.pile;
    pile.refreshCoverage();

    const snapshot = this._snapshot;
    const byBody = this._byBody;
    const events = [];
    let score = 0;
    let maxMove = 0;
    let maxRotDeg = 0;
    let neighbours = 0;
    let exposed = false;

    if (!snapshot) {
      // evaluate() called without a matching begin() — nothing to compare
      // against, so report "nothing happened" rather than guessing.
      return { score, events, maxMove, maxRotDeg, neighbours };
    }

    // ---- the grabbed toy itself ----
    if (heldBody) {
      const before = byBody.get(heldBody);
      if (before) {
        const rot = quatAngle(before.quat, heldBody.quat);
        maxRotDeg = rot * THREE.MathUtils.RAD2DEG;
        maxMove = before.pos.distanceTo(heldBody.pos);
        const lift = heldBody.pos.y - before.pos.y;

        if (rot > DRAMA.ROT) { events.push('rotate'); score++; }
        if (maxMove > DRAMA.MOVE) { events.push('move'); score++; }
        if (lift > DRAMA.LIFT) { events.push('lift'); score++; }
      }
    }

    // ---- everyone else: did the pile itself react? ----
    for (const s of snapshot) {
      const body = s.body;
      // "expose" applies to any toy that surfaces, including the one just
      // lifted out — it uncovers whatever was under it either way.
      if ((s.covered > 0 && body.covered === 0) || (body.pos.y - s.pos.y > DRAMA.EXPOSE)) {
        exposed = true;
      }
      if (body === heldBody) continue; // "neighbour" means a *different* toy
      const move = s.pos.distanceTo(body.pos);
      if (move > DRAMA.NEIGHBOUR) neighbours++;
    }
    if (neighbours > 0) { events.push('neighbour'); score++; }
    if (exposed) { events.push('expose'); score++; }

    return { score, events, maxMove, maxRotDeg, neighbours };
  }

  /**
   * How the prize finishes at the chute. Deterministic — off-balance loads
   * (dangling by an ear, a limb swinging wide) catch the rim; a squarely-held
   * toy drops clean.
   */
  static chuteFinish(grabType, swingMagnitude) {
    switch (grabType) {
      case 'body':
        return swingMagnitude > 0.22 ? CHUTE.BOUNCE : CHUTE.CLEAN;
      case 'head':
        return CHUTE.CLEAN;
      case 'ear':
      case 'tail':
        // dangling by a thread of fabric — it lands on its side across the lip
        return CHUTE.RIM;
      case 'arm':
      case 'leg':
        return swingMagnitude > 0.18 ? CHUTE.BOUNCE : CHUTE.RIM;
      default:
        return CHUTE.CLEAN;
    }
  }
}

/**
 * Last-resort escalation when a grab produced nothing at all: shove the toy
 * so it topples into its neighbours instead of just nudging in place.
 * Mutates only the body's velocity/spin — no scene, no pile bookkeeping.
 */
export function forceDrag(body, dirX, dirZ, strength = 1) {
  const len = Math.hypot(dirX, dirZ) || 1;
  const nx = dirX / len, nz = dirZ / len;

  // a horizontal shove plus lift, so the toy climbs over whatever it meets
  // instead of wedging underneath it
  const push = 1.6 * strength;
  const lift = 1.0 * strength;
  const impulse = new THREE.Vector3(nx * push, lift, nz * push);

  // tumble around the horizontal axis perpendicular to the push (it topples
  // forward over the obstacle) plus a little vertical spin for flair
  const spin = new THREE.Vector3(nz * 4.2 * strength, 1.6 * strength, -nx * 4.2 * strength);

  body.applyImpulse(impulse, spin);
}
