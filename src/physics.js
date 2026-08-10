/**
 * Rigid-body simulation for ころころ橋渡しクレーン (Rapier3D).
 *
 * Everything the player sees move is driven from here — there is no scripted
 * animation of the prize. The crane is modelled the way a real machine works:
 *
 *   trolley  (kinematic)         moves in X/Z/Y, carries the claw
 *      |  prismatic joint + spring motor  <- the "cable": vertical compliance so
 *      |                                     the claw can never crush anything
 *   claw head (dynamic)
 *      |  two revolute joints with torque-limited position motors
 *   prong L / prong R (dynamic)  <- these are what actually touch the prize
 *
 * Because the prongs are force-limited dynamic bodies, where the player aims
 * decides what happens: a prong that lands on top of the box presses and drags
 * it, a prong that comes down beside an overhanging end hooks under and lifts.
 */

import { PHYS, BAR, FIELD, CRANE, GROUPS } from './config.js';

let RAPIER = null;

export async function initPhysics() {
  const mod = await import('../vendor/rapier/rapier.mjs');
  await mod.init();
  RAPIER = mod;
  return RAPIER;
}

const V = (x, y, z) => ({ x, y, z });

/** Quaternion for a rotation of `a` radians about an axis. */
function quatAxis(ax, ay, az, a) {
  const s = Math.sin(a / 2);
  return { x: ax * s, y: ay * s, z: az * s, w: Math.cos(a / 2) };
}

/**
 * Local geometry of one prong, expressed relative to its pivot.
 * `side` is -1 for the left prong, +1 for the right one.
 */
export function prongParts(side) {
  const armAng = side * 0.24;
  const armHalf = 0.040;
  const armC = V(side * Math.sin(0.24) * armHalf, -Math.cos(0.24) * armHalf, 0);
  const armEnd = V(armC.x * 2, armC.y * 2, 0);

  // A deep curl, so the closed tips very nearly meet: the hook can then bite
  // anywhere from the very corner of the box inwards, which is what lets the
  // aim assist stay small enough to be imperceptible.
  const hookAng = -side * 0.72;
  const hookHalf = 0.026;
  const hookC = V(
    armEnd.x + Math.sin(hookAng) * hookHalf,
    armEnd.y - Math.cos(hookAng) * hookHalf,
    0,
  );
  const tip = V(
    armEnd.x + Math.sin(hookAng) * hookHalf * 2,
    armEnd.y - Math.cos(hookAng) * hookHalf * 2,
    0,
  );

  return {
    arm: { half: V(0.0090, armHalf, 0.0110), pos: armC, ang: armAng },
    hook: { half: V(0.0080, hookHalf, 0.0100), pos: hookC, ang: hookAng },
    tip,
  };
}

/** Joint angle for a prong at a given openness (0 = closed, 1 = open). */
export function prongAngle(side, openness) {
  return side * (CRANE.closedAngle + (CRANE.openAngle - CRANE.closedAngle) * openness);
}

export class CranePhysics {
  constructor() {
    this.world = new RAPIER.World(V(0, PHYS.gravity, 0));
    this.world.timestep = PHYS.fixedDt;
    this.world.numSolverIterations = PHYS.solverIterations;
    this.events = new RAPIER.EventQueue(true);

    this.acc = 0;
    this.barSpacing = BAR.spacing;
    this.prize = null;
    this.prizeCollider = null;
    this.bars = [];
    this._contactImpulse = 0;
    this._scrape = 0;

    this._buildStatic();
    this._buildCrane();
  }

  // ---------------------------------------------------------------- statics

  _fixedCuboid(hx, hy, hz, x, y, z, friction = 0.5) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setFriction(friction)
      .setRestitution(0.02)
      .setCollisionGroups(GROUPS.world);
    return this.world.createCollider(desc, body);
  }

  _buildStatic() {
    const halfDepth = (FIELD.frontZ - FIELD.backZ) / 2;
    const midZ = (FIELD.frontZ + FIELD.backZ) / 2;

    // Prize tray floor (soft — the prize should land with a thud, not a bounce).
    this.floor = this._fixedCuboid(0.36, 0.02, halfDepth, 0, -0.02, midZ, 0.9);
    this.floor.setRestitution(0.0);

    // Cabinet walls keep the prize inside the play area.
    this._fixedCuboid(0.02, 0.5, halfDepth, -(FIELD.wallX + 0.02), 0.5, midZ, 0.3);
    this._fixedCuboid(0.02, 0.5, halfDepth, FIELD.wallX + 0.02, 0.5, midZ, 0.3);
    this._fixedCuboid(0.34, 0.5, 0.02, 0, 0.5, FIELD.backZ - 0.02, 0.3);
    this._fixedCuboid(0.34, 0.5, 0.02, 0, 0.5, FIELD.frontZ + 0.02, 0.3);

    this._makeBars(BAR.spacing);
  }

  /** (Re)creates the two support bars at a given centre-to-centre spacing. */
  _makeBars(spacing) {
    for (const b of this.bars) this.world.removeRigidBody(b.body);
    this.bars = [];
    this.barSpacing = spacing;

    const halfLen = (BAR.zFront - BAR.zBack) / 2;
    const midZ = (BAR.zFront + BAR.zBack) / 2;
    const cy = BAR.topY - BAR.radius;

    for (const s of [-1, 1]) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation((s * spacing) / 2, cy, midZ),
      );
      const desc = RAPIER.ColliderDesc.cylinder(halfLen, BAR.radius)
        .setRotation(quatAxis(1, 0, 0, Math.PI / 2))
        .setFriction(0.45)
        .setRestitution(0.02)
        .setCollisionGroups(GROUPS.world);
      const col = this.world.createCollider(desc, body);
      this.bars.push({ body, col, x: (s * spacing) / 2, side: s });
    }
  }

  // ------------------------------------------------------------------ crane

  _buildCrane() {
    const { pivotX, pivotY } = CRANE;

    this.trolley = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(CRANE.homeX, CRANE.restY, CRANE.homeZ),
    );

    // Massless-ish carriage that rides up and down on the "cable" spring.
    this.cage = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(CRANE.homeX, CRANE.restY - CRANE.cableDrop, CRANE.homeZ)
        .setAdditionalMass(0.05)
        .setLinearDamping(0.8)
        .setAngularDamping(3.0)
        .setCanSleep(false),
    );

    this.head = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(CRANE.homeX, CRANE.restY - CRANE.cableDrop - CRANE.swingDrop, CRANE.homeZ)
        .setLinearDamping(0.7)
        .setAngularDamping(4.0)
        .setCanSleep(false),
    );
    this.world.createCollider(
      // Sits high above the pivots so the claw can drop its arms past the side
      // of the prize before the body of the head touches the top of it.
      RAPIER.ColliderDesc.cuboid(0.026, 0.020, 0.024)
        .setTranslation(0, 0.046, 0)
        .setDensity(900)
        .setFriction(0.4)
        .setRestitution(0.0)
        .setCollisionGroups(GROUPS.claw),
      this.head,
    );

    // The "cable": one translational degree of freedom with a spring motor, so
    // the claw can be stopped by whatever it lands on instead of crushing it.
    const cable = RAPIER.JointData.prismatic(V(0, 0, 0), V(0, CRANE.cableDrop, 0), V(0, 1, 0));
    this.cable = this.world.createImpulseJoint(cable, this.trolley, this.cage, true);
    this.cable.setLimits(CRANE.cableMin, CRANE.cableMax);
    this.cable.configureMotorModel(RAPIER.MotorModel.ForceBased);
    this.cable.setMotorMaxForce(CRANE.cableMaxForce);
    this.cable.configureMotorPosition(0, CRANE.cableStiffness, CRANE.cableDamping);

    // ...and the swing: the claw hangs from the carriage like a real one. While
    // travelling it is held rigid so aiming stays exact; the moment it starts to
    // descend it goes soft, so it can only ever shove the prize sideways with a
    // limited, believable force.
    const swing = RAPIER.JointData.spherical(V(0, 0, 0), V(0, CRANE.swingDrop, 0));
    this.swing = this.world.createImpulseJoint(swing, this.cage, this.head, true);
    this.swing.setContactsEnabled(false);
    // rapier.js hands back the generic wrapper for spherical joints; the motor
    // API lives on the specialised prototype and works on the same handle.
    Object.setPrototypeOf(this.swing, RAPIER.SphericalImpulseJoint.prototype);
    for (const axis of [RAPIER.JointAxis.AngX, RAPIER.JointAxis.AngY, RAPIER.JointAxis.AngZ]) {
      this.swing.configureMotorModel(axis, RAPIER.MotorModel.ForceBased);
    }
    this.setSwingSoft(false);

    this.prongs = [];
    for (const side of [-1, 1]) {
      const parts = prongParts(side);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(
            CRANE.homeX + side * pivotX,
            CRANE.restY - CRANE.cableDrop - CRANE.swingDrop + pivotY,
            CRANE.homeZ,
          )
          .setLinearDamping(0.4)
          .setAngularDamping(1.2)
          .setCanSleep(false),
      );
      for (const p of [parts.arm, parts.hook]) {
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(p.half.x, p.half.y, p.half.z)
            .setTranslation(p.pos.x, p.pos.y, p.pos.z)
            .setRotation(quatAxis(0, 0, 1, p.ang))
            .setDensity(1600)
            .setFriction(0.85)
            .setRestitution(0.0)
            .setCollisionGroups(GROUPS.claw)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
            .setContactForceEventThreshold(1.2),
          body,
        );
      }

      const jd = RAPIER.JointData.revolute(V(side * pivotX, pivotY, 0), V(0, 0, 0), V(0, 0, 1));
      const joint = this.world.createImpulseJoint(jd, this.head, body, true);
      joint.setContactsEnabled(false);
      // The "open" end of the travel has plenty of extra room so that a prong
      // landing on top of the prize can splay right out of the way and let the
      // claw keep descending, exactly like a real spring-loaded claw.
      const open = prongAngle(side, 1);
      const shut = prongAngle(side, 0);
      const lo = Math.min(shut + (shut < open ? -0.10 : 0), open - (open < shut ? CRANE.prongSplay : 0)) - 0.02;
      const hi = Math.max(shut + (shut > open ? 0.10 : 0), open + (open > shut ? CRANE.prongSplay : 0)) + 0.02;
      joint.setLimits(lo, hi);
      joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
      joint.setMotorMaxForce(CRANE.prongMaxTorqueOpen);
      joint.configureMotorPosition(prongAngle(side, 1), CRANE.prongMotorStiffness, CRANE.prongMotorDamping);

      this.prongs.push({ side, body, joint, parts });
    }

    this.openness = 1;
    this.trolleyTarget = { x: CRANE.homeX, y: CRANE.restY, z: CRANE.homeZ };
  }

  // ------------------------------------------------------------------ prize

  /** Creates the prize box for a new round (removing the previous one). */
  spawnPrize(round) {
    if (this.prize) {
      this.world.removeRigidBody(this.prize);
      this.prize = null;
      this.prizeCollider = null;
    }
    if (Math.abs(round.barSpacing - this.barSpacing) > 1e-6) this._makeBars(round.barSpacing);

    const { w, h, d, mass, friction, restitution } = round.box;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(round.start.x, BAR.topY + h / 2 + 0.0015, round.start.z)
        .setRotation(quatAxis(0, 1, 0, round.start.yaw))
        .setLinearDamping(0.22)
        .setAngularDamping(0.55)
        .setCcdEnabled(true),
    );
    const r = 0.006;
    const desc = RAPIER.ColliderDesc.roundCuboid(w / 2 - r, h / 2 - r, d / 2 - r, r)
      .setMass(mass)
      .setFriction(friction)
      .setRestitution(restitution)
      .setCollisionGroups(GROUPS.prize)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(1.2);
    this.prizeCollider = this.world.createCollider(desc, body);
    this.prize = body;
    this.prizeDims = { w, h, d };
    return body;
  }

  // -------------------------------------------------------------- commands

  setTrolleyTarget(x, y, z) {
    this.trolleyTarget.x = x;
    this.trolleyTarget.y = y;
    this.trolleyTarget.z = z;
  }

  /** Moves the trolley towards its target with per-axis speed limits. */
  driveTrolley(dt, hSpeed = CRANE.moveSpeed, vSpeed = CRANE.descendSpeed) {
    const t = this.trolley.translation();
    const step = (cur, tgt, sp) => {
      const d = tgt - cur;
      const m = sp * dt;
      return Math.abs(d) <= m ? tgt : cur + Math.sign(d) * m;
    };
    const nx = step(t.x, this.trolleyTarget.x, hSpeed);
    const nz = step(t.z, this.trolleyTarget.z, hSpeed);
    const ny = step(t.y, this.trolleyTarget.y, vSpeed);
    this.trolley.setNextKinematicTranslation(V(nx, ny, nz));
    return { x: nx, y: ny, z: nz };
  }

  /** Rigid while travelling, compliant while touching the prize. */
  setSwingSoft(soft) {
    this.swingSoft = soft;
    for (const axis of [RAPIER.JointAxis.AngX, RAPIER.JointAxis.AngY, RAPIER.JointAxis.AngZ]) {
      const spin = axis === RAPIER.JointAxis.AngY;
      this.swing.setMotorMaxForce(axis, spin ? 1.2 : soft ? CRANE.swingMaxTorque : 3.0);
      this.swing.configureMotorPosition(
        axis, 0,
        spin ? 6.0 : soft ? CRANE.swingStiffness : 45,
        spin ? 0.8 : soft ? CRANE.swingDamping : 4.0,
      );
    }
  }

  /**
   * Commands the two prongs. `foldSide` (-1, 0 or +1) folds one prong right out
   * of the way past fully-open: the machine does this to the prong that would
   * otherwise land on top of the prize, so the other one can reach down beside
   * the end the player aimed at. Everything the prongs then do is still ordinary
   * simulated contact — this only chooses where the arms are pointed.
   */
  setOpenness(o, closing = false, foldSide = 0) {
    this.openness = Math.max(0, Math.min(1, o));
    this.foldSide = foldSide;
    for (const p of this.prongs) {
      const folded = foldSide === p.side;
      p.joint.setMotorMaxForce(closing && !folded ? CRANE.prongMaxTorqueClose : CRANE.prongMaxTorqueOpen);
      const target = folded
        ? prongAngle(p.side, 1) + p.side * CRANE.prongSplay * 0.98
        : prongAngle(p.side, this.openness);
      p.joint.configureMotorPosition(target, CRANE.prongMotorStiffness, CRANE.prongMotorDamping);
    }
  }

  /** How far the cable spring is compressed (>0 means the claw is pushing on something). */
  cableCompression() {
    const t = this.trolley.translation();
    const h = this.cage.translation();
    return (h.y + CRANE.cableDrop) - t.y;
  }

  /** World-space position of a prong tip. */
  prongTip(i) {
    const p = this.prongs[i];
    const t = p.body.translation();
    const r = p.body.rotation();
    const v = p.parts.tip;
    // rotate v by quaternion r
    const { x, y, z, w } = r;
    const ix = w * v.x + y * v.z - z * v.y;
    const iy = w * v.y + z * v.x - x * v.z;
    const iz = w * v.z + x * v.y - y * v.x;
    const iw = -x * v.x - y * v.y - z * v.z;
    return {
      x: t.x + ix * w + iw * -x + iy * -z - iz * -y,
      y: t.y + iy * w + iw * -y + iz * -x - ix * -z,
      z: t.z + iz * w + iw * -z + ix * -y - iy * -x,
    };
  }

  /** Lowest point currently reached by either prong tip. */
  lowestTipY() {
    return Math.min(this.prongTip(0).y, this.prongTip(1).y);
  }

  // ----------------------------------------------------------------- update

  /**
   * Advances the simulation by `dt` seconds using a fixed internal timestep.
   * `onStep(h)` runs once per sub-step so gameplay logic stays deterministic.
   */
  step(dt, onStep) {
    this._contactImpulse = 0;
    this._scrape = 0;
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    const h = PHYS.fixedDt;
    while (this.acc >= h && n < PHYS.maxSubSteps) {
      this.acc -= h;
      n++;
      if (onStep) onStep(h);
      this.world.step(this.events);
      this._drainEvents();
    }
    if (n === PHYS.maxSubSteps) this.acc = 0;
    return n;
  }

  _drainEvents() {
    const cbCollision = (h1, h2, started) => {
      if (!started || !this.prizeCollider) return;
      const ph = this.prizeCollider.handle;
      if (h1 !== ph && h2 !== ph) return;
      const other = h1 === ph ? h2 : h1;
      const col = this.world.getCollider(other);
      if (!col) return;
      const isBar = this.bars.some((b) => b.col.handle === other);
      const v = this.prize ? this.prize.linvel() : { x: 0, y: 0, z: 0 };
      const speed = Math.hypot(v.x, v.y, v.z);
      this.onTouch?.(isBar ? 'bar' : col.handle === this.floor.handle ? 'floor' : 'claw', speed);
    };
    this.events.drainCollisionEvents(cbCollision);
    this.events.drainContactForceEvents((ev) => {
      const m = ev.totalForceMagnitude();
      if (m > this._contactImpulse) this._contactImpulse = m;
    });
  }

  lastContactForce() {
    return this._contactImpulse;
  }

  // ------------------------------------------------------------ prize state

  prizeState() {
    if (!this.prize) return null;
    const t = this.prize.translation();
    const r = this.prize.rotation();
    const lv = this.prize.linvel();
    const av = this.prize.angvel();
    return {
      pos: t,
      rot: r,
      speed: Math.hypot(lv.x, lv.y, lv.z),
      spin: Math.hypot(av.x, av.y, av.z),
      sleeping: this.prize.isSleeping(),
    };
  }

  /**
   * Yaw of the box about the vertical axis, folded into [-90°, 90°]:
   * 0 = square across the bars, ±90° = lying parallel to them (about to fall in).
   */
  prizeYaw() {
    if (!this.prize) return 0;
    const q = this.prize.rotation();
    // World-space direction of the box's local +X axis (first column of the
    // rotation matrix), projected onto the floor plane.
    const ax = 1 - 2 * (q.y * q.y + q.z * q.z);
    const az = 2 * (q.x * q.z - q.w * q.y);
    let a = Math.atan2(-az, ax);
    while (a > Math.PI / 2) a -= Math.PI;
    while (a < -Math.PI / 2) a += Math.PI;
    return a;
  }

  /** Signed tilt of the box's up-axis away from vertical, in radians. */
  prizeTilt() {
    if (!this.prize) return 0;
    const q = this.prize.rotation();
    const uy = 1 - 2 * (q.x * q.x + q.z * q.z);
    return Math.acos(Math.max(-1, Math.min(1, Math.abs(uy))));
  }

  applyPrizeImpulse(ix, iy, iz) {
    this.prize?.applyImpulse(V(ix, iy, iz), true);
  }

  applyPrizeTorque(tx, ty, tz) {
    this.prize?.applyTorqueImpulse(V(tx, ty, tz), true);
  }

  /**
   * How many solver contacts the prize currently has with each support bar —
   * the honest read-out of what is still holding the box up. Two healthy
   * contact patches means bridged; one means it is hanging on a single bar.
   */
  barSupport() {
    const out = [0, 0];
    if (!this.prizeCollider) return out;
    for (let i = 0; i < this.bars.length; i++) {
      this.world.contactPair(this.prizeCollider, this.bars[i].col, (manifold) => {
        out[i] += manifold.numSolverContacts();
      });
    }
    return out;
  }

  /**
   * True when a claw prong is genuinely in contact with the prize. The broad
   * phase reports pairs long before they touch, so the manifolds are checked.
   */
  prongTouchingPrize() {
    if (!this.prizeCollider) return false;
    let hit = false;
    for (const p of this.prongs) {
      if (hit) break;
      for (let i = 0; i < p.body.numColliders(); i++) {
        const col = p.body.collider(i);
        this.world.contactPair(this.prizeCollider, col, (manifold) => {
          if (manifold.numSolverContacts() > 0) hit = true;
        });
        if (hit) break;
      }
    }
    return hit;
  }
}
