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
    // A little help is on from the very first grab: a freshly seated box is the
    // most reluctant one there is, and the first move a child makes has to
    // visibly do something.
    this.assist = 0.25;
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

  /** True when the aim is out on one of the ends rather than over the middle. */
  _isEndGrab(offX) {
    return Math.abs(offX) > this.p.prizeDims.w * 0.21;
  }

  /**
   * Gentle target correction, applied once when Grab is pressed. A four-year-old
   * points at "the end of the box"; this quietly moves the claw a centimetre or
   * two towards the spot where the closing prong will actually bite.
   *
   * Only the two ends are magnetic — nothing ever pulls the aim towards the
   * middle, so "aim at the middle" keeps meaning exactly that. Inside the end
   * region the pull stays weak, because the precise aim is meaningful there: the
   * prong sweeps a fixed arc, so how far outboard the claw sits decides how much
   * of that sweep lands on the box.
   */
  _applyAimAssist(x, z) {
    const ends = this.prizeEnds();
    if (!ends) return { x, z };
    const ideal = 0.046;
    const hw = this.p.prizeDims.w / 2;
    const u = x - ends.c.x;
    let bx = x;
    if (this._isEndGrab(u)) {
      const spot = u < 0 ? ends.left.x + ideal : ends.right.x - ideal;
      const d = spot - x;
      if (Math.abs(d) < 0.11) bx = x + d * 0.35;
    }
    let bz = z;
    const zSpots = [ends.c.z - ends.dz * 0.72, ends.c.z + ends.dz * 0.72];
    for (const s of zSpots) {
      const d = s - z;
      if (Math.abs(d) < 0.028) {
        bz = z + d * 0.35 * (1 - Math.abs(d) / 0.028);
        break;
      }
    }
    if (!this._isEndGrab(u)) {
      // A grab aimed at the middle comes straight down onto the lid, so keep the
      // prongs off the front and back edges: catching an edge there would fling
      // the box, and "aim at the middle" has to stay the quiet option.
      const lim = Math.max(0.004, ends.dz - 0.018);
      bz = clamp(bz, ends.c.z - lim, ends.c.z + lim);
    }
    return { x: bx, z: bz };
  }

  /**
   * While the player is aiming the claw tracks the finger exactly — no magnet,
   * so dragging stays honestly one-to-one. The correction is applied once, at
   * the moment Grab is pressed, while the claw is already moving; a couple of
   * centimetres of drift as it starts down is not something you can see.
   */
  setAim(x, z) {
    if (this.busy) return;
    this.aimRaw.x = this.aim.x = clamp(x, CRANE.minX, CRANE.maxX);
    this.aimRaw.z = this.aim.z = clamp(z, CRANE.minZ, CRANE.maxZ);
  }

  // --------------------------------------------------------------- the grab

  grab() {
    if (this.busy) return false;
    const st = this.p.prizeState();
    if (!st) return false;
    const a = this._applyAimAssist(this.aimRaw.x, this.aimRaw.z);
    this.aim.x = clamp(a.x, CRANE.minX, CRANE.maxX);
    this.aim.z = clamp(a.z, CRANE.minZ, CRANE.maxZ);
    this._snapshot = {
      x: st.pos.x, y: st.pos.y, z: st.pos.z,
      yaw: this.p.prizeYaw(), tilt: this.p.prizeTilt(),
    };
    const offX = this.aim.x - st.pos.x;
    this._grabInfo = { offX, offZ: this.aim.z - st.pos.z, touched: false };
    // Fold the prong that would land on top of the box up out of the way, so
    // the other one can reach down past the overhanging end the player picked.
    // A grab aimed at the middle folds nothing and simply presses down.
    this._foldSide = this._isEndGrab(offX) ? -Math.sign(offX) : 0;
    this.grabs++;
    this.p.setSwingSoft(true);
    this.p.setOpenness(1, false, this._foldSide);
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
        P.setOpenness(1, false, this._foldSide);
        if (blocked || pos.y <= deep + 1e-4 || this.t > 3.2) {
          this._setPhase(PHASE.CLOSE);
          P.setOpenness(1, true, this._foldSide);
        }
        break;
      }

      case PHASE.CLOSE: {
        // Keep pressing gently downwards while the prongs close: as soon as the
        // box gives way the claw settles further, which is how a prong ends up
        // hooked underneath an overhanging end.
        const deep = this._trolleyYForTip(CRANE.tipFloorY);
        const soft = P.cableCompression() > CRANE.contactCompression + 0.018;
        P.setTrolleyTarget(this.aim.x, soft ? P.trolley.translation().y : deep, this.aim.z);
        P.driveTrolley(h, CRANE.moveSpeed, 0.15);

        const k = clamp(this.t / 0.55, 0, 1);
        P.setOpenness(1 - k, true, this._foldSide);
        this._assistContact(h, 1.0);
        if (this.t > 0.82) this._setPhase(PHASE.LIFT);
        break;
      }

      case PHASE.LIFT: {
        // Two stages. First a short, slow pull that raises a hooked end by
        // barely more than a centimetre — enough to tip the box and let it slide
        // off the hook, never enough to carry the prize away. Then the claw
        // climbs clear of the box so it cannot bulldoze it sideways afterwards.
        const t = P.trolley.translation();
        const nudge = this._trolleyYForTip(BAR.topY + 0.030, true);
        const clear = this._trolleyYForTip(BAR.topY + this.p.prizeDims.h + 0.030, true);
        const stage2 = this.t > 0.62;
        P.setTrolleyTarget(this.aim.x, stage2 ? clear : nudge, this.aim.z);
        P.driveTrolley(h, CRANE.moveSpeed, stage2 ? 0.44 : 0.19);
        this._assistContact(h, stage2 ? 0.35 : 0.8);
        if ((stage2 && t.y >= clear - 1e-3) || this.t > 1.9) {
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
        const reach = Math.min(0.030, len);
        P.setTrolleyTarget(from.x + (dx / len) * reach, P.trolley.translation().y, from.z + (dz / len) * reach);
        P.driveTrolley(h, 0.16, 0.30);
        this._assistContact(h, 0.5);
        if (this.t > 0.45) {
          this._setPhase(PHASE.RELEASE);
        }
        break;
      }

      case PHASE.RELEASE: {
        // Opening also brings the folded arm back down, so the claw always
        // returns to the top looking like a claw again.
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
    // Turning and sliding are helped separately: a child reads rotation much
    // more easily than a couple of centimetres of travel, and over-helping the
    // slide is what used to shove the box off the outside edge.
    const step = scale * (h * 120);
    const turnK = (0.75 + this.assist * 1.3) * step;
    const slideK = (0.28 + this.assist * 0.85) * step;

    const pushDir = info.offX === 0 ? 0 : -Math.sign(info.offX);
    const lever = clamp(info.offZ / 0.055, -1.2, 1.2);

    const st = this.p.prizeState();
    const [leftBar, rightBar] = this.p.barSupport();
    const bridged = leftBar > 0 && rightBar > 0;
    const hangingSide = st ? Math.sign(st.pos.x || 1) : 1;
    const outward = Math.sign(pushDir) === hangingSide;
    let slide = 1;

    if (bridged) {
      // Still sitting on both bars: the interesting direction is off the bar, so
      // ease off on pushes that would recentre the box, and stop helping it
      // travel outwards once it is right at the point of losing a bar (the drop
      // should happen into the gap, not off the outside edge).
      const edge = this.p.prizeDims.w / 2 - this.p.barSpacing / 2 + BAR.radius - 0.014;
      if (st) slide -= 0.9 * clamp((Math.abs(st.pos.x) - edge) / 0.022, 0, 1);
      if (st && Math.abs(st.pos.x) > 0.018 && !outward) slide *= 0.7;
    } else {
      // One end has already lost its bar and the box is balanced on the other.
      // Now the finishing move is the push that carries the centre of mass back
      // over the gap, so that is the one that gets the help.
      slide = outward ? 0.5 : 1.5;
    }

    // Turning is never damped by direction: a child who turns the box back the
    // other way should see it turn back just as clearly.
    let yawAssist = lever * pushDir;
    if (!bridged) yawAssist *= 1.4;

    // yaw about the vertical axis: r x F, with F along the push direction
    this.p.applyPrizeTorque(0, 2.2e-3 * turnK * yawAssist, 0);
    // and a whisper of the slide that the same contact would produce
    this.p.applyPrizeImpulse(2.6e-4 * slideK * slide * pushDir, 0, 0);
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
