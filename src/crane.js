/**
 * Gameplay logic: the grab sequence, the aim assist and the "did anything
 * actually happen?" bookkeeping that drives the invisible difficulty help.
 *
 * This module is deliberately free of any rendering dependency so that the
 * whole game loop can be exercised head-less in tests.
 */

import { BAR, CRANE, FIELD } from './config.js';

export const PHASE = {
  IDLE: 'idle',
  DESCEND: 'descend',
  CLOSE: 'close',
  LIFT: 'lift',
  DRAG: 'drag',
  RELEASE: 'release',
  RETURN: 'return',
  SETTLE: 'settle',
  WON: 'won',
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export class CraneGame {
  constructor(physics) {
    this.p = physics;
    this.phase = PHASE.IDLE;
    this.t = 0;
    this.aim = { x: CRANE.homeX, z: CRANE.homeZ };
    this.aimRaw = { x: CRANE.homeX, z: CRANE.homeZ };
    this.round = null;
    this.grabs = 0;
    this.stall = 0;
    this.assist = 0;
    this.instability = 0;
    this.lastGrabDelta = 0;
    this._snapshot = null;
    this._grabInfo = null;
    this._wedgeTimer = 0;
    this.onPhase = null;
    this.onWin = null;
    this.onResult = null;
  }

  // ------------------------------------------------------------------ round

  startRound(round) {
    this.round = round;
    this.p.spawnPrize(round);
    this.grabs = 0;
    this.stall = 0;
    this.assist = 0;
    this.instability = 0;
    this.aim.x = this.aimRaw.x = 0;
    this.aim.z = this.aimRaw.z = -0.02;
    this.p.setOpenness(1);
    this.p.setSwingSoft(false);
    this.p.setTrolleyTarget(CRANE.homeX, CRANE.restY, CRANE.homeZ);
    this.p.trolley.setTranslation({ x: CRANE.homeX, y: CRANE.restY, z: CRANE.homeZ }, true);
    this._setPhase(PHASE.IDLE);
  }

  _setPhase(p) {
    this.phase = p;
    this.t = 0;
    this.onPhase?.(p);
  }

  get busy() {
    return this.phase !== PHASE.IDLE && this.phase !== PHASE.WON;
  }

  // -------------------------------------------------------------- aiming

  /** Oriented world positions of the two ends of the prize box. */
  prizeEnds() {
    const st = this.p.prizeState();
    if (!st) return null;
    const q = st.rot;
    const ax = 1 - 2 * (q.y * q.y + q.z * q.z);
    const az = 2 * (q.x * q.z - q.w * q.y);
    const hw = this.p.prizeDims.w / 2;
    return {
      c: st.pos,
      left: { x: st.pos.x - ax * hw, z: st.pos.z - az * hw },
      right: { x: st.pos.x + ax * hw, z: st.pos.z + az * hw },
      dz: this.p.prizeDims.d / 2,
    };
  }

  /**
   * Gentle, invisible target correction. A four-year-old points at "the end of
   * the box"; we quietly move the claw to the spot where the prong sweep will
   * actually bite. The pull is small enough that dragging still feels 1:1.
   */
  _applyAimAssist(x, z) {
    const ends = this.prizeEnds();
    if (!ends) return { x, z };
    // Only the two ends are magnetic: they are the spots where a grab actually
    // does something. Nothing pulls the aim towards the middle.
    const ideal = 0.045;
    const spots = [ends.left.x + ideal, ends.right.x - ideal];
    let bx = x;
    for (const s of spots) {
      const d = s - x;
      if (Math.abs(d) < 0.036) {
        bx = x + d * 0.45 * (1 - Math.abs(d) / 0.036);
        break;
      }
    }
    let bz = z;
    const zSpots = [ends.c.z - ends.dz * 0.85, ends.c.z + ends.dz * 0.85];
    for (const s of zSpots) {
      const d = s - z;
      if (Math.abs(d) < 0.028) {
        bz = z + d * 0.35 * (1 - Math.abs(d) / 0.028);
        break;
      }
    }
    return { x: bx, z: bz };
  }

  setAim(x, z) {
    if (this.busy) return;
    this.aimRaw.x = clamp(x, CRANE.minX, CRANE.maxX);
    this.aimRaw.z = clamp(z, CRANE.minZ, CRANE.maxZ);
    const a = this._applyAimAssist(this.aimRaw.x, this.aimRaw.z);
    this.aim.x = clamp(a.x, CRANE.minX, CRANE.maxX);
    this.aim.z = clamp(a.z, CRANE.minZ, CRANE.maxZ);
  }

  // --------------------------------------------------------------- the grab

  grab() {
    if (this.busy) return false;
    const st = this.p.prizeState();
    if (!st) return false;
    this._snapshot = {
      x: st.pos.x, y: st.pos.y, z: st.pos.z,
      yaw: this.p.prizeYaw(), tilt: this.p.prizeTilt(),
    };
    this._grabInfo = {
      offX: this.aim.x - st.pos.x,
      offZ: this.aim.z - st.pos.z,
      pushed: 0,
      touched: false,
    };
    this.grabs++;
    this.p.setSwingSoft(true);
    this._setPhase(PHASE.DESCEND);
    return true;
  }

  /** Trolley Y that puts the prong tips at world height `tipY`. */
  _trolleyYForTip(tipY, closed = false) {
    return tipY + CRANE.cableDrop + CRANE.swingDrop + (closed ? CRANE.tipDropClosed : CRANE.tipDrop) + 0.006;
  }

  // --------------------------------------------------------------- stepping

  update(dt) {
    this.p.step(dt, (h) => this._fixedUpdate(h));
    this._updateInstability();
  }

  _fixedUpdate(h) {
    this.t += h;
    const P = this.p;

    switch (this.phase) {
      case PHASE.IDLE: {
        P.setTrolleyTarget(this.aim.x, CRANE.restY, this.aim.z);
        P.driveTrolley(h, CRANE.moveSpeed, CRANE.riseSpeed);
        this._checkFallen();
        break;
      }

      case PHASE.DESCEND: {
        const deep = this._trolleyYForTip(CRANE.tipFloorY);
        P.setTrolleyTarget(this.aim.x, deep, this.aim.z);
        const pos = P.driveTrolley(h, CRANE.moveSpeed, CRANE.descendSpeed);
        const blocked = P.cableCompression() > CRANE.contactCompression;
        if (blocked || pos.y <= deep + 1e-4 || this.t > 3.2) {
          this._setPhase(PHASE.CLOSE);
          P.setOpenness(1, true);
        }
        break;
      }

      case PHASE.CLOSE: {
        // Keep pressing gently downwards while the prongs close: as soon as the
        // box gives way the claw settles further, which is how a prong ends up
        // hooked underneath an overhanging end.
        const deep = this._trolleyYForTip(CRANE.tipFloorY);
        const soft = P.cableCompression() > 0.052;
        P.setTrolleyTarget(this.aim.x, soft ? P.trolley.translation().y : deep, this.aim.z);
        P.driveTrolley(h, CRANE.moveSpeed, 0.15);

        const k = clamp(this.t / 0.55, 0, 1);
        P.setOpenness(1 - k, true);
        this._assistContact(h, 1.0);
        if (this.t > 0.82) this._setPhase(PHASE.LIFT);
        break;
      }

      case PHASE.LIFT: {
        // Rise until the prongs clear the top of the box. Anything the claw is
        // actually hooked under comes up with it; anything it is merely leaning
        // on is released, so the claw can never bulldoze the prize sideways.
        const t = P.trolley.translation();
        const top = this._trolleyYForTip(BAR.topY + this.p.prizeDims.h + 0.030, true);
        P.setTrolleyTarget(this.aim.x, top, this.aim.z);
        P.driveTrolley(h, CRANE.moveSpeed, 0.42);
        this._assistContact(h, 0.7);
        if (t.y >= top - 1e-3 || this.t > 1.4) {
          this._dragFrom = { x: t.x, z: t.z };
          this._setPhase(PHASE.DRAG);
        }
        break;
      }

      case PHASE.DRAG: {
        // Short travel back towards the machine's home corner — the "寄せ" that
        // twists a prize that is still held by a prong.
        const from = this._dragFrom;
        let dx = CRANE.homeX - from.x;
        let dz = CRANE.homeZ - from.z;
        const len = Math.hypot(dx, dz) || 1;
        const reach = Math.min(0.055, len);
        P.setTrolleyTarget(from.x + (dx / len) * reach, P.trolley.translation().y, from.z + (dz / len) * reach);
        P.driveTrolley(h, 0.16, 0.30);
        this._assistContact(h, 0.5);
        if (this.t > 0.45) {
          this._setPhase(PHASE.RELEASE);
        }
        break;
      }

      case PHASE.RELEASE: {
        P.setOpenness(clamp(this.t / 0.3, 0, 1));
        if (this.t > 0.2) P.setSwingSoft(false);
        P.driveTrolley(h, 0.16, 0.30);
        if (this.t > 0.34) this._setPhase(PHASE.RETURN);
        break;
      }

      case PHASE.RETURN: {
        P.setTrolleyTarget(this.aim.x, CRANE.restY, this.aim.z);
        P.driveTrolley(h, 0.42, CRANE.riseSpeed);
        if (P.trolley.translation().y >= CRANE.restY - 1e-3 || this.t > 2.4) this._setPhase(PHASE.SETTLE);
        break;
      }

      case PHASE.SETTLE: {
        P.driveTrolley(h, CRANE.moveSpeed, CRANE.riseSpeed);
        this._unwedge(h);
        const st = P.prizeState();
        const calm = st && (st.sleeping || (st.speed < 0.035 && st.spin < 0.25));
        if (this._checkFallen()) break;
        // A box hanging half-way into the gap gets a longer beat so the
        // un-wedging nudge has time to finish the job — that pause before the
        // final slip is the best moment in the game.
        const teetering = this._wedgeTimer > 0.02;
        if ((calm && this.t > (teetering ? 2.6 : 0.45)) || this.t > 5.0) {
          this._finishGrab();
          this._setPhase(PHASE.IDLE);
        }
        break;
      }

      case PHASE.WON: {
        P.setTrolleyTarget(CRANE.homeX, CRANE.restY, CRANE.homeZ);
        P.driveTrolley(h, CRANE.moveSpeed, CRANE.riseSpeed);
        break;
      }
    }
  }

  /**
   * A very small, contact-gated nudge. It only ever runs while a prong is
   * genuinely touching the box, and it pushes in exactly the direction the
   * contact geometry already implies — so it amplifies the player's choice
   * rather than replacing it.
   */
  _assistContact(h, scale) {
    if (!this._grabInfo || !this.p.prongTouchingPrize()) return;
    this._grabInfo.touched = true;
    const info = this._grabInfo;
    const strength = (0.72 + this.assist * 1.5) * scale * (h * 120);

    const pushDir = info.offX === 0 ? 0 : -Math.sign(info.offX);
    const lever = clamp(info.offZ / 0.055, -1.2, 1.2);

    // Past the point where one end is about to lose its bar, stop helping the
    // box travel outwards: the drop should happen into the gap, not off the
    // outside edge. Turning stays fully available.
    const st = this.p.prizeState();
    const edge = this.p.prizeDims.w / 2 - this.p.barSpacing / 2 + BAR.radius - 0.014;
    let slide = st ? 1 - 0.9 * clamp((Math.abs(st.pos.x) - edge) / 0.022, 0, 1) : 1;

    // Ratchet: a hit that undoes previous progress still works, it just helps a
    // little less than one that adds to it. Children poke more or less at
    // random, and this quietly keeps a round moving forwards without ever
    // taking a direction away from a player who is aiming on purpose.
    let yawAssist = lever * pushDir;
    const yawNow = this.p.prizeYaw();
    if (Math.abs(yawNow) > 0.12 && Math.sign(yawAssist) !== Math.sign(yawNow)) yawAssist *= 0.4;
    if (st && Math.abs(st.pos.x) > 0.018 && Math.sign(pushDir) !== Math.sign(st.pos.x)) slide *= 0.5;

    // yaw about the vertical axis: r x F, with F along the push direction
    this.p.applyPrizeTorque(0, 2.2e-3 * strength * yawAssist, 0);
    // and a whisper of the slide that the same contact would produce
    this.p.applyPrizeImpulse(2.6e-4 * strength * slide * pushDir, 0, 0);
  }

  /**
   * A box that has dropped part-way into the gap but jammed there at an awkward
   * angle would otherwise dead-end the round. Tip it further onto its edge —
   * the one attitude narrow enough to pass between the bars — and press down.
   * It only ever helps the box downwards, never back up onto the bars.
   */
  _unwedge(h) {
    const st = this.p.prizeState();
    if (!st) return;
    // "Sunk" = the box is sitting lower than a squarely-bridged box would, i.e.
    // part of it is already down inside the gap.
    const sunk = BAR.topY + this.p.prizeDims.h / 2 - st.pos.y;
    const inGap = sunk > 0.022 && st.pos.y > FIELD.fallenY;
    if (!inGap || st.speed > 0.06) {
      this._wedgeTimer = 0;
      return;
    }
    this._wedgeTimer += h;
    if (this._wedgeTimer < 0.45) return;

    const q = st.rot;
    const ux = 2 * (q.x * q.y + q.w * q.z);
    const uy = 1 - 2 * (q.x * q.x + q.z * q.z);
    const lean = Math.atan2(ux, uy);
    // Which way it is already leaning; if it is still almost level, tip it
    // towards whichever bar it is hanging over.
    const sign = Math.abs(lean) > 0.05 ? Math.sign(lean) : (st.pos.x >= 0 ? 1 : -1);
    const k = Math.min(1, (this._wedgeTimer - 0.45) * 1.2) * (h * 120);
    const wiggle = Math.sin(this._wedgeTimer * 26) * 0.4;
    this.p.applyPrizeTorque(0, 0, -sign * 1.6e-3 * k);
    this.p.applyPrizeImpulse(0.0016 * k * wiggle, -0.0055 * k, 0);
  }

  _checkFallen() {
    const st = this.p.prizeState();
    if (!st || this.phase === PHASE.WON) return false;
    if (st.pos.y < FIELD.fallenY) {
      this._setPhase(PHASE.WON);
      this.onWin?.();
      return true;
    }
    return false;
  }

  /** Measures how much the board changed and adjusts the hidden assist. */
  _finishGrab() {
    const st = this.p.prizeState();
    const s = this._snapshot;
    if (!st || !s) return;
    const dPos = Math.hypot(st.pos.x - s.x, st.pos.z - s.z);
    const dYaw = Math.abs(this.p.prizeYaw() - s.yaw);
    const dTilt = Math.abs(this.p.prizeTilt() - s.tilt);
    const delta = dPos * 7 + dYaw * 1.1 + dTilt * 0.9;
    this.lastGrabDelta = delta;

    if (delta < 0.10) {
      this.stall++;
      this.assist = Math.min(1, this.assist + 0.34);
    } else {
      this.stall = 0;
      this.assist = Math.max(0, this.assist - 0.5);
    }
    // Long rounds get a little more help each turn so nobody's four-year-old is
    // ever stuck poking at the same box forever.
    this.assist = Math.max(this.assist, Math.min(1, (this.grabs - 3) * 0.16));
    this.onResult?.({ delta, dPos, dYaw, dTilt, touched: this._grabInfo?.touched ?? false });
  }

  /** 0 = squarely bridged, 1 = about to fall. Drives lighting and slow-motion. */
  _updateInstability() {
    const st = this.p.prizeState();
    if (!st) return;
    const yaw = Math.abs(this.p.prizeYaw()) / (Math.PI / 2);
    const tilt = clamp(this.p.prizeTilt() / 0.5, 0, 1);
    const off = clamp(Math.abs(st.pos.x) / (this.p.prizeDims.w / 2 - this.p.barSpacing / 2 + 0.02), 0, 1);
    const drop = clamp((BAR.topY - st.pos.y + this.p.prizeDims.h / 2) / 0.05, 0, 1);
    const v = 0.42 * yaw + 0.24 * tilt + 0.24 * off + 0.4 * drop;
    this.instability = lerp(this.instability, clamp(v, 0, 1), 0.12);
  }
}
