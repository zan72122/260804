// The chain: wax -> dye -> more wax -> another dye -> remove the wax -> the
// pattern that was hidden underneath appears. Every phase below is one link.

import { V3, clamp, damp, lerp, smoothstep } from './math.js';
import { Cloth } from './cloth.js';
import { Fabric, DYES } from './fabric.js';
import { Scene, Camera, WORLD } from './scene.js';
import { getPattern, snapToGuide, sampleGuide } from './patterns.js';

const DIP_TRAVEL = 1.98;
const DYE_TARGET = 0.62;
const WAX_CAPACITY = 22;      // seconds of drawing per fill

export const PHASE = {
  PICK: 'pick',
  WAX1: 'wax1',
  DIP1: 'dip1',
  WAX2: 'wax2',
  DIP2: 'dip2',
  LOROD: 'lorod',
  REVEAL: 'reveal',
  UNFURL: 'unfurl',
  DONE: 'done',
};

export class Game {
  constructor(renderer, input, sfx, ui) {
    this.r = renderer;
    this.input = input;
    this.sfx = sfx;
    this.ui = ui;

    this.scene = new Scene(renderer);
    this.camera = new Camera();
    this.fabric = new Fabric(renderer, this.pickFabricSize());
    this.cloth = new Cloth(40, 40, WORLD.clothSize);
    this.clothMesh = renderer.mesh(this.cloth.buildMeshData());

    this.time = 0;
    this.phase = PHASE.PICK;
    this.phaseTime = 0;
    this.patternId = 'flower';
    this.pattern = null;
    this.guideStage = 1;
    this.guidePoints = [];
    this.waxLayer = 0;
    this.waxLevel = 1;
    this.dyeAmount = 0;
    this.dipDepth = 0;
    this.dipHeld = false;
    this.lorodFront = 0;
    this.foldAmount = 0;
    this.unfurlDrag = 0;
    this.revealPulse = 0;
    this.history = [];          // what each colour owes to which waxing round
    this.activeVat = null;
    this.lorodOut = false;
    this.freeMode = false;

    this.prevUV = null;
    this.drawing = false;
    this.refill = null;
    this.aim = V3.create(-0.8, 2.1, 0.25);
    this.aimTarget = V3.create(-0.8, 2.1, 0.25);
    this.robotMode = 'idle';
    this.splashDone = false;
    this.dripTimer = 0;
    this.shotBlend = 0;

    this.camShot = { target: V3.create(0, 1.95, 0), fit: 1.7, z: 1, y: 0 };
    this.setPhase(PHASE.PICK);
  }

  pickFabricSize() {
    const small = Math.min(window.innerWidth, window.innerHeight) < 420;
    const mem = navigator.deviceMemory || 4;
    return (small || mem <= 2) ? 768 : 1024;
  }

  // ---- phases --------------------------------------------------------------

  setPhase(p) {
    this.phase = p;
    this.phaseTime = 0;
    this.prevUV = null;
    this.autoDip = false;
    this.autoLift = false;
    this.autoLorod = false;
    this.autoUnfurl = false;
    this.liftTimer = 0;
    this.doneTimer = 0;

    if (p === PHASE.PICK) {
      this.scene.robot.setShadowCasting(true);
      this.activeVat = null;
      this.lorodOut = false;
      this.foldAmount = 0;
      this.cloth.setFrameMode(WORLD.clothRestCentre, 0.10);
    }
    if (p === PHASE.WAX1 || p === PHASE.WAX2) {
      this.scene.robot.setShadowCasting(true);
      this.activeVat = null;
      this.lorodOut = false;
      this.waxLayer = p === PHASE.WAX1 ? 0 : 1;
      this.guideStage = p === PHASE.WAX1 ? 1 : 2;
      this.applyGuide();
      this.cloth.setFrameMode(WORLD.clothRestCentre, 0.10);
      this.startRefill(true);
    }
    if (p === PHASE.DIP1 || p === PHASE.DIP2) {
      this.activeVat = p === PHASE.DIP1 ? 'indigo' : 'soga';
      this.dye = p === PHASE.DIP1 ? DYES.indigo : DYES.soga;
      this.dyeAmount = 0;
      this.dipDepth = 0;
      this.dipHeld = false;
      this.splashDone = false;
      this.soaked = false;
      this.scene.robot.setGripVisible(true);
    }
    if (p === PHASE.LOROD) {
      this.scene.robot.setShadowCasting(false);
      this.activeVat = null;
      this.lorodOut = true;
      this.lorodFront = 0;
      this.cloth.setFrameMode([0, 1.78, 0], 0.06);
      this.scene.robot.setGripVisible(false);
      this.sfx.startShimmer();
    }
    if (p === PHASE.REVEAL) {
      this.scene.robot.setShadowCasting(false);
      this.sfx.stopShimmer();
      this.sfx.fanfare();
      this.revealPulse = 1;
    }
    if (p === PHASE.UNFURL) {
      this.lorodOut = false;          // the hot-water pan is wheeled away
      this.foldAmount = 1;
      this.unfurlDrag = 0;
      this.cloth.setFoldTargets([0, 1.9, 0.25], 1);
      for (let i = 0; i < this.cloth.count; i++) this.cloth.pin[i] = 0.42;
      this.cloth.setPinRow(0, 0.95);
      this.cloth.pullToTargets(1);
    }
    if (p === PHASE.DONE) {
      this.sfx.chime(5, 0.14);
    }
    this.ui.onPhase(this);
  }

  applyGuide() {
    this.pattern = getPattern(this.patternId);
    this.freeMode = !!this.pattern.free;
    const built = this.pattern.build();
    this.guideLines = this.guideStage === 1 ? built.stage1 : built.stage2;
    if (this.freeMode || !this.guideLines.length) {
      this.fabric.clearGuide();
      this.guidePoints = [];
    } else {
      this.fabric.drawGuide(this.guideLines);
      this.guidePoints = sampleGuide(this.guideLines, 0.022);
    }
  }

  startPattern(id) {
    this.patternId = id;
    this.fabric.reset();
    this.cloth.wet.fill(0);
    this.history = [];
    this.dyeAmount = 0;
    this.setPhase(PHASE.WAX1);
  }

  guideProgress() {
    if (!this.guidePoints.length) return 1;
    let hit = 0;
    for (const p of this.guidePoints) if (p.hit) hit++;
    return hit / this.guidePoints.length;
  }

  // ---- wax refill ("canting に ろうを いれる") ------------------------------

  startRefill(auto = false) {
    if (this.refill) return;
    this.refill = { t: 0, auto, done: false };
    this.robotMode = 'refill';
  }

  updateRefill(dt) {
    const rf = this.refill;
    rf.t += dt;
    const stove = this.scene.stovePos;
    const home = V3.create(0, WORLD.clothRestCentre[1], 0.28);
    const dwellIn = 0.55, dwell = 0.7, dwellOut = 0.6;
    const total = dwellIn + dwell + dwellOut;
    if (rf.t < dwellIn) {
      const t = smoothstep(0, 1, rf.t / dwellIn);
      V3.lerp(this.aimTarget, home, [stove[0], stove[1] + 0.16, stove[2]], t);
    } else if (rf.t < dwellIn + dwell) {
      const t = (rf.t - dwellIn) / dwell;
      const dip = Math.sin(t * Math.PI);
      V3.set(this.aimTarget, stove[0], stove[1] + 0.16 - dip * 0.14, stove[2]);
      if (!rf.done && t > 0.45) {
        rf.done = true;
        this.waxLevel = 1;
        this.sfx.drop();
        for (let i = 0; i < 14; i++) {
          this.scene.particles.spawn(
            stove[0] + (Math.random() - 0.5) * 0.12, stove[1] + 0.02, stove[2] + (Math.random() - 0.5) * 0.12,
            (Math.random() - 0.5) * 0.25, 0.35 + Math.random() * 0.4, (Math.random() - 0.5) * 0.25,
            2, 0.05, 1.2 + Math.random(), 0.5, 0.9);
        }
      }
    } else if (rf.t < total) {
      const t = smoothstep(0, 1, (rf.t - dwellIn - dwell) / dwellOut);
      V3.lerp(this.aimTarget, [stove[0], stove[1] + 0.16, stove[2]], home, t);
    } else {
      this.refill = null;
      this.robotMode = 'idle';
    }
  }

  // ---- main update ---------------------------------------------------------

  update(dt) {
    this.time += dt;
    this.phaseTime += dt;
    this.frames = (this.frames || 0) + 1;
    this.fps = this.fps ? this.fps * 0.92 + (1 / Math.max(dt, 1e-3)) * 0.08 : 1 / Math.max(dt, 1e-3);
    this.scene.time = this.time;
    this.input.update(dt);

    if (this.refill) this.updateRefill(dt);

    switch (this.phase) {
      case PHASE.PICK: this.updatePick(dt); break;
      case PHASE.WAX1:
      case PHASE.WAX2: this.updateWax(dt); break;
      case PHASE.DIP1:
      case PHASE.DIP2: this.updateDip(dt); break;
      case PHASE.LOROD: this.updateLorod(dt); break;
      case PHASE.REVEAL: this.updateReveal(dt); break;
      case PHASE.UNFURL: this.updateUnfurl(dt); break;
      case PHASE.DONE: this.updateDone(dt); break;
      default: break;
    }

    this.fabric.coolWax(dt);
    if (this.phase !== PHASE.DIP1 && this.phase !== PHASE.DIP2) {
      this.fabric.dry(dt * 0.6);
      this.cloth.dryOff(dt);
    }

    // Cloth simulation
    this.cloth.liquidY = (this.phase === PHASE.DIP1 || this.phase === PHASE.DIP2)
      ? WORLD.liquidY : -999;
    const windy = this.phase === PHASE.UNFURL || this.phase === PHASE.DONE ? 0.14 : 0.05;
    this.cloth.step(dt, { wind: windy });
    this.clothMesh.update('position', this.cloth.pos);
    this.clothMesh.update('normal', this.cloth.normal);

    // Robot + props
    V3.lerp(this.aim, this.aim, this.aimTarget, 1 - Math.exp(-16 * dt));
    this.scene.robot.canting.visible = this.robotMode === 'draw' || this.robotMode === 'refill'
      || this.robotMode === 'idle';
    this.scene.robot.update(dt, this.time, this.aim, this.robotMode);
    this.scene.layoutVessels({ activeVat: this.activeVat, lorodOut: this.lorodOut }, dt);
    this.scene.particles.update(dt);
    this.scene.revealGlow = damp(this.scene.revealGlow, this.revealPulse * 0.085, 4, dt);
    this.revealPulse = Math.max(0, this.revealPulse - dt * 0.85);

    this.updateCamera(dt);
    this.ui.tick(this, dt);
  }

  // ---- camera --------------------------------------------------------------

  shotFor(phase) {
    const portrait = this.camera.aspect < 1;
    switch (phase) {
      case PHASE.PICK:
        return { target: [0, 1.85, 0], w: portrait ? 2.4 : 3.4, h: 2.6, z: 0.15, y: 0.0 };
      case PHASE.WAX1:
      case PHASE.WAX2:
        if (this.refill) {
          // Pull back to show the pot: the child needs to see the wax go in.
          return { target: [-0.55, 1.90, 0.2], w: portrait ? 2.5 : 3.2, h: 2.2, z: 0.1, y: 0 };
        }
        return { target: [0.06, 1.95, 0], w: portrait ? 1.62 : 2.05, h: 1.55, z: 0.0, y: 0.0 };
      case PHASE.DIP1:
      case PHASE.DIP2:
        // Rise and tip down as the cloth goes under, so the child is looking
        // into the bath and can watch the colour climb the cloth.
        return {
          target: [0, 1.55 - this.dipDepth * 0.62, 0.05],
          w: portrait ? 2.15 : 2.9, h: 2.5, z: 0.1,
          ey: 0.30 + this.dipDepth * 0.95,
        };
      case PHASE.LOROD:
        return { target: [0, 1.86, 0], w: portrait ? 1.62 : 2.2, h: 1.7, z: 0.0, ey: 0.06 };
      case PHASE.REVEAL:
        return { target: [0, 1.94, 0], w: portrait ? 1.36 : 1.7, h: 1.38, z: -0.1, ey: 0.0 };
      case PHASE.UNFURL:
      case PHASE.DONE:
        return {
          target: [0, 1.95, 0.2], w: portrait ? 1.85 : 2.4,
          h: portrait ? 1.95 : 1.5, z: 0.2, ey: 0.0,
        };
      default:
        return { target: [0, 1.9, 0], w: 2.0, h: 2.0, z: 0, y: 0 };
    }
  }

  updateCamera(dt) {
    const s = this.shotFor(this.phase);
    const cam = this.camera;
    const dist = cam.fitDistance(s.w, s.h) + s.z;
    const drift = Math.sin(this.time * 0.31) * 0.035;
    const driftY = Math.cos(this.time * 0.23) * 0.02;
    const tx = s.target[0], ty = s.target[1] + (s.y || 0), tz = s.target[2];
    const k = 1 - Math.exp(-2.6 * dt);
    cam.target[0] = lerp(cam.target[0], tx, k);
    cam.target[1] = lerp(cam.target[1], ty, k);
    cam.target[2] = lerp(cam.target[2], tz, k);
    const wantX = tx + 0.10 + drift;
    const wantY = ty + 0.16 + (s.ey || 0) + driftY;
    const wantZ = tz + dist;
    cam.pos[0] = lerp(cam.pos[0], wantX, k);
    cam.pos[1] = lerp(cam.pos[1], wantY, k);
    cam.pos[2] = lerp(cam.pos[2], wantZ, k);
  }

  // ---- pick ---------------------------------------------------------------

  updatePick(dt) {
    this.robotMode = this.refill ? 'refill' : 'idle';
    if (!this.refill) {
      V3.set(this.aimTarget, -0.55 + Math.sin(this.time * 0.6) * 0.12,
        2.05 + Math.cos(this.time * 0.5) * 0.06, 0.30);
    }
  }

  // ---- waxing --------------------------------------------------------------

  clothHit() {
    const inp = this.input;
    const r = this.camera.ray(inp.x, inp.y);
    return this.cloth.raycast(r.origin, r.dir);
  }

  updateWax(dt) {
    const inp = this.input;
    if (this.refill) { this.drawing = false; this.prevUV = null; return; }

    if (!inp.active) {
      if (this.drawing) {
        this.drawing = false;
        this.sfx.stopPour();
      }
      this.prevUV = null;
      this.robotMode = 'idle';
      // The canting drifts to a resting hover just off the cloth.
      const rest = [0.0, WORLD.clothRestCentre[1] + 0.05, 0.30];
      V3.lerp(this.aimTarget, this.aimTarget, rest, 1 - Math.exp(-2.5 * dt));
      return;
    }

    const hit = this.clothHit();
    if (!hit) { this.prevUV = null; return; }

    // The spout runs a little above the fingertip so the child can see the
    // line appearing instead of hiding it under their own hand.
    let u = hit.u;
    let v = clamp(hit.v + 0.055, 0, 1);

    // Guide attraction: near the drawn motif the line is pulled onto it.
    if (!this.freeMode && this.guideLines && this.guideLines.length) {
      const snap = snapToGuide(u, v, this.guideLines, 0.075);
      if (snap) {
        const pull = 0.82 * (1 - smoothstep(0.02, 0.075, snap.dist));
        u = lerp(u, snap.x, pull);
        v = lerp(v, snap.y, pull);
      }
    }

    if (this.waxLevel <= 0.001) {
      // No wax left: nothing bad happens, the pot just starts asking for a dip.
      this.drawing = false;
      this.sfx.stopPour();
      this.robotMode = 'draw';
      this.aimFromUV(u, v);
      this.ui.flashRefill();
      return;
    }

    this.robotMode = 'draw';
    this.aimFromUV(u, v);

    // Line weight follows how fast the hand is moving.
    const sp = inp.speed;                      // ndc / second
    const slow = smoothstep(0.55, 0.06, sp);   // 1 when barely moving
    const fast = smoothstep(0.55, 1.9, sp);
    const radius = lerp(lerp(0.0125, 0.0175, slow), 0.0082, fast);
    const drop = smoothstep(0.12, 0.42, inp.stillTime) * 0.9;
    const flow = 0.85 * smoothstep(0, 0.08, this.waxLevel) + 0.15;

    if (!this.drawing) {
      this.drawing = true;
      this.sfx.startPour();
    }
    this.sfx.updatePour(0.35 + 0.65 * smoothstep(0.02, 0.8, sp), clamp(sp, 0, 2));

    const a = this.prevUV || [u, v];
    const seed = (this.time * 13.7) % 100;
    // Break long jumps into pieces so a fast flick still lays a continuous line.
    const dist = Math.hypot(u - a[0], v - a[1]);
    const steps = Math.max(1, Math.min(8, Math.ceil(dist / 0.02)));
    for (let i = 1; i <= steps; i++) {
      const t0 = (i - 1) / steps, t1 = i / steps;
      this.fabric.waxStroke(
        lerp(a[0], u, t0), lerp(a[1], v, t0),
        lerp(a[0], u, t1), lerp(a[1], v, t1),
        radius, flow, drop, this.waxLayer, seed + i,
      );
    }
    this.prevUV = [u, v];
    this.waxLevel = Math.max(0, this.waxLevel - dt / WAX_CAPACITY * (0.5 + flow));

    // Mark guide checkpoints so we know when the motif is well covered.
    if (this.guidePoints.length) {
      for (const p of this.guidePoints) {
        if (!p.hit && Math.hypot(p.x - u, p.y - v) < 0.035) p.hit = true;
      }
    }

    if (drop > 0.5 && Math.random() < dt * 4) this.sfx.drop();
    if (Math.random() < dt * 6) {
      const w = this.cloth.pointAt(u, v);
      this.scene.particles.spawn(w[0], w[1] + 0.01, w[2] + 0.02,
        (Math.random() - 0.5) * 0.05, 0.02, 0.05, 3, 0.012, 0.5, -0.2, 1.5);
    }
  }

  aimFromUV(u, v) {
    const w = this.cloth.pointAt(u, v);
    const n = this.cloth.normalAt(u, v);
    V3.set(this.aimTarget, w[0] + n[0] * 0.028, w[1] + n[1] * 0.028, w[2] + n[2] * 0.028 + 0.012);
  }

  // ---- dipping -------------------------------------------------------------

  updateDip(dt) {
    const inp = this.input;
    this.robotMode = 'dip';
    const soaked = this.dyeAmount >= DYE_TARGET * 0.97;
    this.soaked = soaked;

    // The child pulls down; the artisan keeps lowering once it is committed.
    // Buttons drive the same values, so nothing depends on a gesture landing.
    if (this.autoLift) {
      this.dipDepth = damp(this.dipDepth, 0, 3.0, dt);
      // Pulling the cloth out early is allowed: once it is up, hand control
      // back so the child can lower it again rather than getting stuck.
      if (this.dipDepth < 0.03 && !soaked) this.autoLift = false;
    } else if (this.autoDip) {
      this.dipDepth = damp(this.dipDepth, 1, 2.4, dt);
      if (this.dipDepth > 0.985) this.autoDip = false;
    } else if (inp.active) {
      this.dipDepth = clamp(this.dipDepth - inp.dy * 1.5, 0, 1);
      this.liftTimer = 0;
    } else if (!soaked) {
      this.dipDepth = damp(this.dipDepth, this.dipDepth > 0.25 ? 1 : 0, 2.8, dt);
    }
    if (this.dipDepth > 0.9) this.dipHeld = true;

    if (soaked) {
      // No rush, but a child who wanders off still gets their cloth back.
      this.liftTimer = (this.liftTimer || 0) + dt;
      if (this.liftTimer > 7) this.autoLift = true;
      if (this.dipDepth < 0.05) {
        this.doneTimer = (this.doneTimer || 0) + dt;
        if (this.doneTimer > 1.4) { this.doneTimer = 0; this.liftTimer = 0; this.finishDip(); return; }
      } else {
        this.doneTimer = 0;
      }
    }

    const topY = WORLD.clothTopY - this.dipDepth * DIP_TRAVEL;
    // The tub confines the cloth once the cloth is down inside it.
    this.cloth.vessel = {
      x: 0, z: 0.15, r: WORLD.vatRadius * 0.80,
      floorY: 0.14, topY: WORLD.vatHeight + 0.02,
    };
    // The grips sit a little closer together than the cloth is wide, so the top
    // edge hangs in a slack curve instead of going taut and buckling.
    const half = (WORLD.clothSize / 2) * 0.92;
    const sway = Math.sin(this.time * 1.3) * 0.012 * (1 - this.dipDepth);
    const l = [-half + sway, topY, 0.06];
    const r = [half + sway, topY, 0.06];
    this.cloth.setGripMode(l, r);
    this.scene.robot.placeGrips(l, r);
    V3.set(this.aimTarget, r[0] + 0.10, r[1] + 0.06, r[2] + 0.10);
    V3.set(this.scene.robot.leftHandPos, l[0] - 0.10, l[1] + 0.06, l[2] + 0.10);

    // Contact with the surface.
    const b = this.cloth.bounds();
    const touching = b.minY <= WORLD.liquidY;
    if (touching && !this.splashDone) {
      this.splashDone = true;
      this.sfx.chapun(1);
      this.scene.addRipple(0, 0.15, 1.0);
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = 0.1 + Math.random() * 0.45;
        this.scene.particles.spawn(
          Math.cos(a) * rr, WORLD.liquidY + 0.02, 0.15 + Math.sin(a) * rr * 0.5,
          Math.cos(a) * 0.5, 0.9 + Math.random() * 0.8, Math.sin(a) * 0.35,
          0, 0.022, 0.9 + Math.random() * 0.4, -3.0, 0.4);
      }
    }
    if (!touching) this.splashDone = false;

    // How far up the cloth the bath has reached, measured on the real mesh.
    let front = 0;
    if (touching) {
      for (let j = 0; j < this.cloth.ny; j++) {
        let below = 0;
        for (let i = 0; i < this.cloth.nx; i += 4) {
          if (this.cloth.pos[this.cloth.idx(i, j) * 3 + 1] < WORLD.liquidY) below++;
        }
        if (below > 0) front = Math.max(front, j / (this.cloth.ny - 1) + 0.02);
      }
    }
    this.wetFront = front;

    if (front > 0 && this.dyeAmount < DYE_TARGET) {
      const rate = 0.30 * dt;
      this.fabric.dyeStepBatched(this.dye, rate, front, 0.055, dt);
      this.dyeAmount += rate * front;
      this.cloth.soak(front, dt * 0.9);
      this.sfx.soak(clamp(front, 0, 1) * 0.9);
      if (Math.random() < dt * 8) {
        this.scene.addRipple((Math.random() - 0.5) * 0.6, 0.15 + (Math.random() - 0.5) * 0.4, 0.35);
      }
    } else {
      this.sfx.soak(front > 0 ? 0.3 : 0);
    }

    // Coming back up: the cloth is heavy and drips.
    if (this.dipHeld && this.dipDepth < 0.92 && b.minY > WORLD.liquidY - 0.4) {
      this.dripTimer -= dt;
      if (this.dripTimer <= 0) {
        this.dripTimer = 0.05 + Math.random() * 0.08;
        const u = Math.random();
        const p = this.cloth.pointAt(u, 0.0);
        this.scene.particles.spawn(p[0], p[1] - 0.01, p[2],
          0, -0.15, 0, 0, 0.019, 1.5, -3.2, 0.15);
        if (Math.random() < 0.35) this.sfx.drip();
      }
    }
  }

  finishDip() {
    this.sfx.stopSoak();
    this.cloth.vessel = null;
    this.scene.robot.setGripVisible(false);
    this.cloth.setFrameMode(WORLD.clothRestCentre, 0.10);
    const dyeName = this.dye.id;
    this.history.push({
      dye: dyeName,
      protectedBy: this.waxLayer,
      swatch: this.dye.swatch,
    });
    if (this.phase === PHASE.DIP1) this.setPhase(PHASE.WAX2);
    else this.setPhase(PHASE.LOROD);
  }

  // ---- nglorod -------------------------------------------------------------

  updateLorod(dt) {
    const inp = this.input;
    this.robotMode = 'lorod';
    // Both hands stay to the left of the kain so nothing crosses the reveal.
    V3.set(this.aimTarget, -0.74, 1.66 + Math.sin(this.time * 2.2) * 0.03, 0.5);
    V3.set(this.scene.robot.leftHandPos, -1.95, 1.25, 0.7);

    if (inp.active) {
      // Any horizontal movement pushes the front along; direction is forgiving.
      // Capped per frame: a violent swipe must not skip the whole reveal.
      const push = Math.min(Math.abs(inp.dx) * 0.42 + Math.max(0, -inp.dy) * 0.1, dt * 0.55);
      this.lorodFront = clamp(this.lorodFront + push, 0, 1.25);
      this.sfx.updateShimmer(clamp(Math.abs(inp.vx) * 0.8, 0.25, 1), this.lorodFront);
    } else if (this.autoLorod) {
      this.lorodFront = clamp(this.lorodFront + dt * 0.26, 0, 1.25);
      this.sfx.updateShimmer(0.7, this.lorodFront);
    } else {
      this.sfx.updateShimmer(0.12, this.lorodFront);
    }

    this.fabric.lorodStep(this.lorodFront, 0.22, dt);
    this.revealPulse = Math.max(this.revealPulse, clamp(this.lorodFront, 0, 1) * 0.7);

    // Steam off the pan, and wax lifting off the cloth as small pale flakes.
    if (Math.random() < dt * 26) {
      const x = (Math.random() - 0.5) * 1.6;
      this.scene.particles.spawn(x, 1.0, 0.15 + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.12, 0.28 + Math.random() * 0.22, 0.02,
        2, 0.10, 2.2 + Math.random(), 0.28, 0.5);
    }
    const f = clamp(this.lorodFront, 0, 1);
    if (f > 0.001 && f < 1) {
      const n = Math.random() < dt * 46 ? 2 : (Math.random() < dt * 30 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const v = Math.random();
        const p = this.cloth.pointAt(f + (Math.random() - 0.5) * 0.1, v);
        this.scene.particles.spawn(p[0], p[1], p[2] + 0.02,
          (Math.random() - 0.5) * 0.10, 0.10 + Math.random() * 0.22, 0.05 + Math.random() * 0.1,
          1, 0.023, 1.1 + Math.random() * 0.6, -0.25, 0.9);
      }
    }

    if (this.lorodFront >= 1.24) this.setPhase(PHASE.REVEAL);
  }

  updateReveal(dt) {
    this.robotMode = 'present';
    // Hands stay clear of the cloth so nothing crosses the reveal.
    V3.set(this.aimTarget, -0.86, 1.62 + Math.sin(this.time * 1.6) * 0.05, 0.55);
    V3.set(this.scene.robot.leftHandPos, -2.05, 1.18, 0.72);
    // Keep dissolving any last specks of wax.
    this.fabric.lorodStep(1.4, 0.22, dt);
    this.revealPulse = Math.max(0, 1 - this.phaseTime * 0.7);
    if (Math.random() < dt * 30 && this.phaseTime < 2.0) {
      const u = Math.random(), v = Math.random();
      const p = this.cloth.pointAt(u, v);
      this.scene.particles.spawn(p[0], p[1], p[2] + 0.03,
        (Math.random() - 0.5) * 0.1, 0.14 + Math.random() * 0.2, 0.1,
        3, 0.02, 1.0 + Math.random(), -0.1, 1.0);
    }
    if (this.phaseTime > 3.4) this.setPhase(PHASE.UNFURL);
  }

  // ---- unfurl --------------------------------------------------------------

  updateUnfurl(dt) {
    const inp = this.input;
    this.robotMode = 'present';
    const half = WORLD.clothSize / 2;
    V3.set(this.aimTarget, -half - 0.24, 2.30, 0.45);
    V3.set(this.scene.robot.leftHandPos, -half - 0.95, 1.20, 0.72);

    if (this.autoUnfurl) this.unfurlDrag += dt * 0.75;
    if ((inp.active || this.autoUnfurl) && this.foldAmount > 0) {
      if (inp.active) this.unfurlDrag += Math.abs(inp.dx) * 1.35;
      const next = clamp(1 - this.unfurlDrag, 0, 1);
      if (next < this.foldAmount - 0.002 && !this._basa) {
        this._basa = true;
        this.sfx.basa();
      }
      this.foldAmount = Math.min(this.foldAmount, next);
    }

    this.cloth.setFoldTargets([0, 1.9, 0.25], this.foldAmount);
    const grip = 0.55 * this.foldAmount + 0.06;
    for (let i = 0; i < this.cloth.count; i++) this.cloth.pin[i] = grip;
    this.cloth.setPinRow(0, 0.9);

    if (this.foldAmount <= 0.001 && !this._opened) {
      this._opened = true;
      // A wave runs out from the middle so the far edges snap last.
      this.cloth.addImpulse((u, v) => {
        const d = Math.abs(u - 0.5);
        return [0, 0, -0.05 * Math.sin(d * Math.PI * 2) - 0.02];
      });
      this.sfx.basa();
      setTimeout(() => { if (this.phase === PHASE.UNFURL) this.setPhase(PHASE.DONE); }, 1500);
    }
  }

  updateDone(dt) {
    this.robotMode = 'present';
    const half = WORLD.clothSize / 2;
    V3.set(this.aimTarget, -half - 0.26, 2.28 + Math.sin(this.time * 1.1) * 0.03, 0.5);
    V3.set(this.scene.robot.leftHandPos, -half - 0.98, 1.18, 0.72);
    for (let i = 0; i < this.cloth.count; i++) this.cloth.pin[i] = 0.05;
    this.cloth.setPinRow(0, 0.92);
    if (Math.random() < dt * 1.2) {
      this.cloth.addImpulse((u, v) => [0, 0, -0.004 * Math.sin(u * 6.2)]);
    }
  }

  restart(mode) {
    this._basa = false;
    this._opened = false;
    this.foldAmount = 0;
    this.lorodFront = 0;
    this.waxLevel = 1;
    this.cloth.setFrameMode(WORLD.clothRestCentre, 0.10);
    if (mode === 'same') this.startPattern(this.patternId);
    else if (mode === 'free') this.startPattern('free');
    else this.setPhase(PHASE.PICK);
  }

  // ---- render --------------------------------------------------------------

  render() {
    const scene = this.scene;
    const cam = this.camera;
    cam.update(this.r.width / this.r.height);

    scene.renderShadow(this.cloth, this.clothMesh);
    scene.beginFrame(cam);
    scene.renderProps(cam);

    const dipping = this.phase === PHASE.DIP1 || this.phase === PHASE.DIP2;
    scene.renderCloth(cam, this.clothMesh, this.fabric, {
      liquidY: dipping ? WORLD.liquidY : -999,
      liquidColor: dipping ? this.dye.liquid : [0, 0, 0],
      liquidDensity: 1.5,
      guideVisible: (this.phase === PHASE.WAX1 || this.phase === PHASE.WAX2) && !this.freeMode ? 1 : 0,
      lorodFront: this.phase === PHASE.LOROD ? this.lorodFront : -1,
      lorodWidth: 0.22,
    });
    scene.renderLiquids(cam, this);
    scene.particles.tint = dipping ? this.dye.liquid : [0.9, 0.85, 0.7];
    scene.renderParticles(cam);
    scene.present(this);
  }
}
