import * as THREE from 'three';
import { CameraRig, CamPose, v3 } from './camera';
import { SoundKit } from './audio';
import { StageRefs } from './scene';
import {
  RAIL, CLAW, FALL_X, OUTLET, CAPSULE_START_X, CAPSULE_R,
  capsuleRestY, rollRadius, danger, CAPSULE_STYLES
} from './params';

type State = 'aim' | 'descend' | 'push' | 'teeter' | 'rise' | 'fall' | 'chute' | 'celebrate' | 'result';

const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function clamp(v: number, a: number, b: number): number { return Math.min(b, Math.max(a, v)); }
function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }
function easeInOutQuad(t: number): number { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

// "コロン" easing: slow press → quick tumble over the balance point → settle
function koronEase(t: number): number {
  if (t < 0.32) return 0.1 * (t / 0.32) * (t / 0.32);           // lean
  if (t < 0.72) { const u = (t - 0.32) / 0.4; return 0.1 + 0.82 * u * u * (3 - 2 * u); } // tumble
  const u = (t - 0.72) / 0.28;                                   // settle w/ tiny overshoot
  const back = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);
  return 0.92 + 0.08 * back;
}

export class Game {
  state: State = 'aim';
  pushCount = 0;
  dropCount = 0;
  styleIndex = 0;

  private stage: StageRefs;
  private rig: CameraRig;
  private snd: SoundKit;
  private resultUI: HTMLElement;

  // capsule assisted-physics state
  private capX = CAPSULE_START_X;
  private rollAngle = 0;      // accumulated roll (rad)
  private toyLag = 0;
  private toyLagV = 0;
  private prevOmega = 0;

  // claw state
  private clawX = 0;
  private clawTargetX = 0;
  private clawY = CLAW.cruiseY;
  private clawOpen = 1;

  // sequence bookkeeping
  private t = 0;              // time in current state
  private phaseFrom = 0;      // claw x correction start
  private phaseTo = 0;
  private pushRevs = 1;
  private pushWillDrop = false;
  private pushStartX = 0;
  private pushStartAngle = 0;
  private pushTravelPred = 0;
  private koronPlayed = 0;
  private tapPlayed = false;

  // fall / chute
  private fallVy = 0;
  private fallY = 0;
  private fallLandY = 0;
  private bounced = false;
  private chuteCurve: THREE.CatmullRomCurve3 | null = null;
  private chuteS = 0;
  private chuteLen = 0;
  private lastTickS = 0;
  private prevChutePos = new THREE.Vector3();

  private dragging = false;
  private queuedRelease = false;
  private hadFirstPush = false;
  private idleTime = 0;
  private sparkleT = -1;
  private sparkleVel: Float32Array | null = null;

  constructor(stage: StageRefs, rig: CameraRig, snd: SoundKit, resultUI: HTMLElement) {
    this.stage = stage;
    this.rig = rig;
    this.snd = snd;
    this.resultUI = resultUI;
    this.applyCapsuleReset();
    this.clawX = this.clawTargetX = 0;
    this.rig.jumpTo(this.poseAim());
    stage.capsule.setStyle(CAPSULE_STYLES[0]);
  }

  // ---------- poses ----------
  private poseOverview(): CamPose {
    return { pos: v3(0.6, 6.8, 7.6), look: v3(0.1, 1.9, 0), halfWidth: 4.0 };
  }
  private poseAim(): CamPose {
    const lx = clamp(this.clawX * 0.3, -0.8, 0.8);
    return { pos: v3(lx + 0.5, 6.1, 8.3), look: v3(lx, 1.75, 0), halfWidth: 3.95 };
  }
  private poseContact(cx: number): CamPose {
    return { pos: v3(cx + 0.55, 3.5, 3.9), look: v3(cx + 0.4, 2.2, 0), halfWidth: 1.9 };
  }
  private poseDrop(): CamPose {
    return { pos: v3(FALL_X - 0.2, 3.4, 5.6), look: v3(FALL_X + 0.15, 1.7, 0), halfWidth: 2.9 };
  }
  private poseChute(p: THREE.Vector3): CamPose {
    return { pos: v3(p.x + 1.5, p.y + 1.7, p.z + 3.6), look: p.clone(), halfWidth: 2.1 };
  }
  private poseCelebrate(): CamPose {
    return { pos: v3(OUTLET.x + 0.6, 2.6, 7.6), look: v3(OUTLET.x, 0.9, 2.4), halfWidth: 2.6 };
  }

  // ---------- helpers ----------
  private idealClawX(): number { return this.capX - CLAW.sideOffset; }

  private applyCapsuleReset(): void {
    this.capX = CAPSULE_START_X;
    this.rollAngle = 0;
    const c = this.stage.capsule;
    c.group.position.set(this.capX, capsuleRestY(this.capX), 0);
    c.group.rotation.set(0, 0, 0);
    c.spinner.quaternion.identity();
    c.group.visible = true;
    c.group.scale.setScalar(1);
    this.toyLag = 0; this.toyLagV = 0;
  }

  // predicted travel if the capsule rolls `revs` revolutions from x
  private integrateTravel(x0: number, revs: number): number {
    let x = x0;
    const steps = 60;
    const dTheta = (revs * Math.PI * 2) / steps;
    for (let i = 0; i < steps; i++) {
      x += rollRadius(x) * dTheta;
      if (x >= FALL_X) break;
    }
    return x - x0;
  }

  // ---------- input ----------
  // aiming input is also accepted while the claw is still rising, so an
  // impatient small player never loses a tap — the push starts once ready
  onPointerDown(fx: number): void {
    this.snd.unlock();
    this.idleTime = 0;
    if (this.state !== 'aim' && this.state !== 'rise' && this.state !== 'teeter') return;
    this.dragging = true;
    this.queuedRelease = false;
    this.onPointerMove(fx);
  }

  onPointerMove(fx: number): void {
    this.idleTime = 0;
    if (!this.dragging) return;
    this.clawTargetX = clamp(
      CLAW.minX + fx * (CLAW.maxX - CLAW.minX),
      CLAW.minX, CLAW.maxX
    );
  }

  onPointerUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.state === 'aim') {
      this.beginDescend();
    } else if (this.state === 'rise' || this.state === 'teeter') {
      this.queuedRelease = true;
    }
  }

  // ---------- sequence ----------
  private beginDescend(): void {
    // gently correct the aim to a valid push position on the narrow side —
    // aim quality is judged on where the finger was released, the claw itself
    // always ends up at a real contact point
    const ideal = this.idealClawX();
    const q = 1 - clamp(Math.abs(this.clawTargetX - ideal) / 1.3, 0, 1);
    const corrected = clamp(this.clawTargetX, this.capX - 0.95, this.capX - 0.55);
    this.pushRevs = 0.9 + 0.35 * q;          // perfect aim → a full clean revolution+
    this.phaseFrom = this.clawX;
    this.phaseTo = corrected;
    this.pushTravelPred = this.integrateTravel(this.capX, this.pushRevs);
    this.pushWillDrop = this.capX + this.integrateTravel(this.capX, this.pushRevs) >= FALL_X - 0.001;
    this.state = 'descend';
    this.t = 0;
    this.tapPlayed = false;
    const cx = this.capX + this.pushTravelPred * 0.55;
    this.rig.glideTo(this.pushWillDrop ? this.poseDrop() : this.poseContact(cx), 0.95);
    this.snd.descend();
  }

  private beginPush(): void {
    this.state = 'push';
    this.t = 0;
    this.pushStartX = this.capX;
    this.pushStartAngle = this.rollAngle;
    this.koronPlayed = 0;
    this.pushCount++;
    this.hadFirstPush = true;
  }

  private beginFall(): void {
    this.state = 'fall';
    this.t = 0;
    this.fallY = this.stage.capsule.group.position.y;
    this.fallVy = -0.6;
    this.fallLandY = 0.66 - 0.05 * this.capX + CAPSULE_R; // tray surface + radius
    this.bounced = false;
    this.rig.glideTo(this.poseDrop(), 0.4);
  }

  private beginChute(): void {
    this.state = 'chute';
    this.t = 0;
    const sx = this.capX;
    const startY = this.fallLandY;
    this.chuteCurve = new THREE.CatmullRomCurve3([
      v3(sx, startY, 0),
      v3(sx * 0.45 + 0.75, startY - 0.03, 0.8),
      v3(1.45, 0.83, 1.55),
      v3(OUTLET.x, 0.72, 2.35),
      v3(OUTLET.x + 0.03, 0.75, 2.85)
    ]);
    this.chuteLen = this.chuteCurve.getLength();
    this.chuteS = 0;
    this.lastTickS = 0;
    this.prevChutePos.copy(this.chuteCurve.getPointAt(0));
  }

  private beginCelebrate(): void {
    this.state = 'celebrate';
    this.t = 0;
    this.dropCount++;
    this.snd.chime();
    this.rig.glideTo(this.poseCelebrate(), 0.8);
    // sparkle burst at the capsule
    const p = this.stage.capsule.group.position;
    const pos = this.stage.sparkles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const n = pos.count;
    this.sparkleVel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.setXYZ(i, p.x, p.y + 0.1, p.z);
      const a = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 1.6;
      this.sparkleVel[i * 3] = Math.cos(a) * s * 0.7;
      this.sparkleVel[i * 3 + 1] = 1.2 + Math.random() * 1.6;
      this.sparkleVel[i * 3 + 2] = Math.sin(a) * s * 0.5;
    }
    pos.needsUpdate = true;
    this.stage.sparkles.visible = true;
    this.stage.sparkleMat.opacity = 1;
    this.sparkleT = 0;
  }

  private showResult(): void {
    this.state = 'result';
    this.resultUI.classList.add('show');
  }

  restart(newStyle: boolean): void {
    if (newStyle) {
      this.styleIndex = (this.styleIndex + 1) % CAPSULE_STYLES.length;
      this.stage.capsule.setStyle(CAPSULE_STYLES[this.styleIndex]);
    }
    this.resultUI.classList.remove('show');
    this.applyCapsuleReset();
    this.clawTargetX = this.idealClawX();
    this.state = 'aim';
    this.t = 0;
    this.snd.pop();
    this.rig.glideTo(this.poseAim(), 1.0);
    this.stage.outletGlow.intensity = 0;
  }

  // ---------- per-frame ----------
  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    this.idleTime += dt;
    const c = this.stage.capsule;
    const claw = this.stage.claw;

    switch (this.state) {
      case 'aim': {
        // claw eases toward the drag target
        const prev = this.clawX;
        this.clawX += (this.clawTargetX - this.clawX) * Math.min(1, dt * 9);
        const speed = Math.abs(this.clawX - prev) / Math.max(dt, 1e-4);
        this.snd.setSlide(this.dragging ? speed : 0);
        this.clawY += (CLAW.cruiseY - this.clawY) * Math.min(1, dt * 5);
        this.clawOpen += (1 - this.clawOpen) * Math.min(1, dt * 6);
        if (this.dragging) this.rig.retarget(this.poseAim());
        break;
      }
      case 'descend': {
        this.snd.setSlide(0);
        const tCorrect = 0.28, tDrop = 0.62, tClose = 0.34;
        if (this.t < tCorrect) {
          const u = easeInOutQuad(this.t / tCorrect);
          this.clawX = this.phaseFrom + (this.phaseTo - this.phaseFrom) * u;
        } else if (this.t < tCorrect + tDrop) {
          this.clawX = this.phaseTo;
          const u = easeInOutQuad((this.t - tCorrect) / tDrop);
          this.clawY = CLAW.cruiseY + (CLAW.pushY - CLAW.cruiseY) * u;
        } else if (this.t < tCorrect + tDrop + tClose) {
          const u = (this.t - tCorrect - tDrop) / tClose;
          this.clawOpen = 1 - easeOutCubic(u) * 0.92;
          if (!this.tapPlayed && u > 0.75) { this.tapPlayed = true; this.snd.tap(); }
        } else {
          this.beginPush();
        }
        break;
      }
      case 'push': {
        const dur = 1.2;
        const u = clamp(this.t / dur, 0, 1);
        const thetaTotal = this.pushRevs * Math.PI * 2;
        const theta = koronEase(u) * thetaTotal;
        // advance the capsule by integrating roll from the push start
        let x = this.pushStartX;
        let remaining = theta;
        const step = 0.05;
        while (remaining > 0) {
          const d = Math.min(step, remaining);
          x += rollRadius(x) * d;
          remaining -= d;
          if (x >= FALL_X) break;
        }
        const newAngle = this.pushStartAngle + theta;
        this.prevOmega = (newAngle - this.rollAngle) / Math.max(dt, 1e-4);
        this.rollAngle = newAngle;
        this.capX = Math.min(x, FALL_X + 0.02);
        c.group.position.set(this.capX, capsuleRestY(this.capX), 0);
        c.spinner.quaternion.setFromAxisAngle(Z_AXIS, -this.rollAngle);
        // claw stays in visible contact: it closes the initial gap during the
        // lean, follows the capsule through the tumble, then lets it roll on
        const contactX = this.capX - CLAW.sideOffset;
        if (u < 0.22) {
          this.clawX = this.phaseTo + (contactX - this.phaseTo) * easeInOutQuad(u / 0.22);
        } else if (u < 0.6) {
          this.clawX = contactX;
        } // after that the claw holds still and the capsule rolls away
        // koron sound as each revolution lands
        const revsDone = Math.floor((this.rollAngle - this.pushStartAngle) / (Math.PI * 2 * 0.96));
        if (revsDone > this.koronPlayed) { this.koronPlayed = revsDone; this.snd.koron(); }
        if (this.capX >= FALL_X) { this.beginFall(); break; }
        if (u >= 1) {
          if (this.koronPlayed === 0) this.snd.koron();
          if (danger(this.capX) > 0.8) {
            this.state = 'teeter'; this.t = 0; this.snd.wobble();
          } else {
            this.state = 'rise'; this.t = 0; this.snd.rise();
          }
        }
        break;
      }
      case 'teeter': {
        const dur = 0.7;
        const u = clamp(this.t / dur, 0, 1);
        const decay = (1 - u);
        c.group.rotation.x = Math.sin(u * Math.PI * 5) * 0.07 * decay;
        c.group.position.y = capsuleRestY(this.capX) - Math.abs(Math.sin(u * Math.PI * 5)) * 0.02 * decay;
        if (u >= 1) {
          c.group.rotation.x = 0;
          c.group.position.y = capsuleRestY(this.capX);
          this.state = 'rise'; this.t = 0; this.snd.rise();
        }
        break;
      }
      case 'rise': {
        const dur = 0.75;
        const u = clamp(this.t / dur, 0, 1);
        this.clawOpen = 0.08 + easeInOutQuad(u) * 0.92;
        this.clawY = CLAW.pushY + (CLAW.cruiseY - CLAW.pushY) * easeInOutQuad(u);
        if (u >= 1) {
          this.state = 'aim'; this.t = 0;
          if (!this.dragging && !this.queuedRelease) {
            this.clawTargetX = clamp(this.idealClawX(), CLAW.minX, CLAW.maxX);
          }
          this.rig.glideTo(this.poseAim(), 0.9);
          if (this.queuedRelease) {
            this.queuedRelease = false;
            this.beginDescend();
          }
        }
        break;
      }
      case 'fall': {
        // keep spinning a little while dropping
        this.rollAngle += dt * 5;
        c.spinner.quaternion.setFromAxisAngle(Z_AXIS, -this.rollAngle);
        this.fallVy -= 13.5 * dt;
        this.fallY += this.fallVy * dt;
        this.capX += dt * 0.25;
        if (this.fallY <= this.fallLandY) {
          if (!this.bounced) {
            this.bounced = true;
            this.snd.ston();
            this.fallY = this.fallLandY;
            this.fallVy = Math.abs(this.fallVy) * 0.28;
          } else {
            this.fallY = this.fallLandY;
            c.group.position.set(this.capX, this.fallY, 0);
            this.beginChute();
            break;
          }
        }
        c.group.position.set(this.capX, this.fallY, 0);
        break;
      }
      case 'chute': {
        if (!this.chuteCurve) break;
        const speed = 1.1 + this.t * 1.3;
        this.chuteS = Math.min(this.chuteLen, this.chuteS + speed * dt);
        const s01 = this.chuteS / this.chuteLen;
        const p = this.chuteCurve.getPointAt(s01);
        const dir = p.clone().sub(this.prevChutePos);
        const ds = dir.length();
        if (ds > 1e-5) {
          dir.normalize();
          const axis = new THREE.Vector3().crossVectors(UP, dir).normalize();
          c.spinner.rotateOnWorldAxis(axis, ds / CAPSULE_R);
        }
        this.prevChutePos.copy(p);
        c.group.position.copy(p);
        if (this.chuteS - this.lastTickS > 0.55) {
          this.lastTickS = this.chuteS;
          this.snd.chuteTick(0.9 + s01 * 0.4);
        }
        this.rig.retarget(this.poseChute(p));
        this.stage.outletGlow.intensity = s01 * 5;
        if (s01 >= 1) this.beginCelebrate();
        break;
      }
      case 'celebrate': {
        // happy little landing bounce
        const u = clamp(this.t / 0.9, 0, 1);
        const bounce = Math.abs(Math.sin(u * Math.PI * 2)) * 0.12 * (1 - u);
        c.group.position.y = 0.75 + bounce;
        this.stage.outletGlow.intensity = 5 + Math.sin(this.t * 6) * 1.5;
        if (this.t > 1.1) this.showResult();
        break;
      }
      case 'result':
        this.stage.outletGlow.intensity = 4.5 + Math.sin(this.t * 3) * 1.2;
        break;
    }

    // ----- shared cosmetic updates -----
    // claw pose
    claw.group.position.set(this.clawX, this.clawY, 0);
    claw.setOpen(this.clawOpen);
    claw.trolley.position.x = this.clawX;
    const poleLen = Math.max(0.2, 5.24 - this.clawY);
    claw.pole.scale.y = poleLen;
    claw.pole.position.y = poleLen / 2 + 0.12;

    // toy pendulum lag (sells the weight inside the capsule)
    const drive = this.state === 'push' ? this.prevOmega * 0.045 : 0;
    this.toyLagV += (-26 * this.toyLag - 6 * this.toyLagV + drive) * dt;
    this.toyLag = clamp(this.toyLag + this.toyLagV * dt, -0.55, 0.55);
    c.toy.rotation.z = this.toyLag;
    if (this.state !== 'push') this.prevOmega *= Math.max(0, 1 - dt * 8);

    // aim beam follows the claw while aiming
    const beam = this.stage.aimBeam;
    beam.visible = this.state === 'aim';
    if (beam.visible) {
      beam.position.x = this.clawX;
      const near = Math.abs(this.clawX - this.idealClawX()) < 0.55;
      (beam.material as THREE.MeshBasicMaterial).color.setHex(near ? 0xffe1a6 : 0xbfeee0);
      (beam.material as THREE.MeshBasicMaterial).opacity = near ? 0.2 : 0.11;
    }

    // ghost hint until the first push (and again when idle)
    const ghost = this.stage.ghostClaw;
    const showGhost = this.state === 'aim' && (!this.hadFirstPush || this.idleTime > 10);
    ghost.visible = showGhost;
    if (showGhost) {
      const pulse = (Math.sin(this.t * 3.2) + 1) / 2;
      ghost.position.set(this.idealClawX(), CLAW.pushY + 0.25 + pulse * 0.22, 0);
      ghost.traverse(o => {
        const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m && m.transparent) m.opacity = 0.25 + pulse * 0.35;
      });
    }

    // warm floor glow breathes
    const glowMat = this.stage.dropGlow.material as THREE.MeshBasicMaterial;
    glowMat.opacity = 0.42 + Math.sin(performance.now() * 0.002) * 0.12;

    // sparkles
    if (this.sparkleT >= 0 && this.sparkleVel) {
      this.sparkleT += dt;
      const pos = this.stage.sparkles.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        this.sparkleVel[i * 3 + 1] -= 3.2 * dt;
        pos.setXYZ(i,
          pos.getX(i) + this.sparkleVel[i * 3] * dt,
          pos.getY(i) + this.sparkleVel[i * 3 + 1] * dt,
          pos.getZ(i) + this.sparkleVel[i * 3 + 2] * dt
        );
      }
      pos.needsUpdate = true;
      this.stage.sparkleMat.opacity = Math.max(0, 1 - this.sparkleT / 1.6);
      if (this.sparkleT > 1.6) { this.sparkleT = -1; this.stage.sparkles.visible = false; }
    }

    this.rig.update(dt);
  }

  // test hooks
  get capsuleX(): number { return this.capX; }
}
