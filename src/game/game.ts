/**
 * The harvest day, as a state machine.
 *
 * Each step owns exactly one verb, one gesture and one visible consequence:
 *
 *   Gate    swipe up      → water pours in and the level climbs
 *   Reel    drag          → the machine churns and fruit comes loose
 *   Reveal  (watch/stir)  → the bog turns red
 *   Boom    pull a buoy   → the raft is corralled and squeezed
 *   Hose    drag          → the nozzle clicks onto the coupling
 *   Pump    press & hold  → fruit runs up the hose into the truck
 *   Done    tap a picture → play again
 *
 * Nothing here can fail, time out or be scored.
 */

import * as THREE from 'three';
import { World } from './world';
import { CameraDirector, type Shot } from './camera';
import { InputManager } from '../core/input';
import { UI, type HintKind } from '../ui/ui';
import {
  WATER_DRY,
  WATER_FULL,
  bogInset,
  clampToBog,
  type FieldVariant,
} from '../world/layout';
import { clamp, damp, lerp, smoothstep } from '../core/math';
import {
  ambienceLoop,
  gateLoop,
  pumpLoop,
  reelLoop,
  say,
  sfxChime,
  sfxClick,
  sfxLap,
  sfxTumble,
} from '../core/audio';
import { prefersReducedMotion, quality } from '../core/settings';

export const enum Step {
  Intro,
  Gate,
  Reel,
  Reveal,
  Boom,
  Hose,
  Pump,
  Done,
  Sandbox,
}

const BEAD_OF: Record<number, number> = {
  [Step.Intro]: 0,
  [Step.Gate]: 0,
  [Step.Reel]: 1,
  [Step.Reveal]: 1,
  [Step.Boom]: 2,
  [Step.Hose]: 3,
  [Step.Pump]: 3,
  [Step.Done]: 4,
  [Step.Sandbox]: 4,
};

/** Fraction of the bog the reel must sweep before the big reveal. */
const REEL_TARGET = 0.45;
/** How tightly a corralled raft may pack: 1 = single layer, lower = heaped. */
const PACK_TIGHT = 0.52;
/** Water-surface area one berry needs when fully packed, plus slack. */
const berryArea = (r: number): number => (r * 1.92 * PACK_TIGHT) ** 2 * 0.866 * 0.95;

export class Game {
  readonly scene = new THREE.Scene();
  readonly director = new CameraDirector();
  world: World;

  private step: Step = Step.Intro;
  private stepTime = 0;
  private seed: number;

  /* per-step scratch state */
  private fill = 0; // 0..1 flood progress driven by the gate
  private revealPhase = 0;
  private boomGrab: 'a' | 'b' | null = null;
  private boomSettled = 0;
  private hoseGrabbed = false;
  private pumping = false;
  private pumpProgress = 0;
  private pumpTotal = 1;
  private doneT = 0;
  private endShown = false;
  private lastStirSound = 0;
  private gateAssist = 0;

  private readonly tmp3 = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector2();
  private readonly tmpB = new THREE.Vector2();
  private readonly shot: Shot = {
    target: new THREE.Vector3(),
    yaw: 0.35,
    pitch: 0.4,
    dist: 60,
    fov: 46,
    bias: 0,
    rate: 1.6,
  };

  constructor(
    private readonly input: InputManager,
    private readonly ui: UI,
    seed: number,
  ) {
    this.seed = seed;
    this.scene.background = null;
    this.world = new World(seed);
    this.scene.add(this.world.root);
    this.enter(Step.Intro);
  }

  get currentStep(): Step {
    return this.step;
  }

  /** Seconds of simulated time spent in the current step. */
  get elapsedInStep(): number {
    return this.stepTime;
  }

  /** 0..1 through the suction stage — drives the camera slide. */
  get suctionProgress(): number {
    return this.pumpProgress;
  }

  get variant(): FieldVariant {
    return this.world.variant;
  }

  /* ------------------------------------------------------------------ *
   * lifecycle
   * ------------------------------------------------------------------ */

  restart(sameField: boolean, sandbox = false): void {
    const seed = sameField ? this.seed : (Math.random() * 0xffffff) | 0;
    this.seed = seed;
    this.scene.remove(this.world.root);
    this.world.dispose();
    this.world = new World(seed);
    this.scene.add(this.world.root);
    this.fill = 0;
    this.pumping = false;
    this.pumpProgress = 0;
    this.doneT = 0;
    this.endShown = false;
    this.boomGrab = null;
    this.boomSettled = 0;
    this.hoseGrabbed = false;
    this.gateAssist = 0;
    this.ui.showEndCard(false);
    this.ui.showPump(false);
    gateLoop.stop();
    reelLoop.stop();
    pumpLoop.stop();
    this.input.reset();
    this.enter(sandbox ? Step.Sandbox : Step.Intro);
  }

  /**
   * Put the world into the state a given step assumes — flooded bog, fruit
   * afloat, boom laid out — and enter it. Used when the world has to be
   * rebuilt underneath the player (quality change), and by the QA sweep.
   */
  debugJump(step: Step): void {
    const w = this.world;
    if (step >= Step.Reel && step !== Step.Intro) {
      this.fill = 1;
      // flooded and shut off, exactly as the gate step leaves it
      w.gate.setTarget(0);
      w.gate.open = 0;
      w.water.targetLevel = WATER_FULL;
      w.water.level = WATER_FULL;
    }
    if (step >= Step.Boom && step <= Step.Done) {
      w.reel.group.visible = true;
      w.berries.harvestAll();
      for (let i = 0; i < 400; i++) w.berries.update(1 / 30, this.director.camera);
    }
    if (step >= Step.Hose && step <= Step.Done) {
      w.boom.group.visible = true;
      const c = w.berries.floatCentroid(this.tmp2);
      w.boom.deploy(c, w.berries.floatingCount, berryArea(w.berries.radius));
      w.berries.setContainment(w.boom.contain);
      w.berries.packFactor = PACK_TIGHT;
      w.reel.reset(-w.variant.halfX * 0.72, -w.variant.halfZ * 0.72, 2.4);
    }
    if (step >= Step.Pump && step <= Step.Done) {
      w.hose.group.visible = true;
      w.hose.place(w.boom.centre.x, w.boom.centre.y, w.boom.centre);
      w.hose.connected = true;
    }
    this.enter(step);
  }

  /**
   * Rebuild the world when the parent changes the quality setting: the berry
   * count is baked into the buffers, so the field has to be remade. The
   * child keeps their place — the new world is fast-forwarded to the state
   * the current step assumes.
   */
  rebuildForQuality(): void {
    const step = this.step;
    const fill = this.fill;
    this.scene.remove(this.world.root);
    this.world.dispose();
    this.world = new World(this.seed);
    this.scene.add(this.world.root);
    this.fill = step >= Step.Reel ? 1 : fill;
    if (step < Step.Reel) {
      this.world.water.targetLevel = lerp(WATER_DRY, WATER_FULL, smoothstep(fill));
      this.world.water.level = this.world.water.targetLevel;
      this.world.gate.setTarget(fill);
      this.world.gate.open = fill;
      this.enter(step);
    } else {
      this.debugJump(step);
    }
  }

  private enter(step: Step): void {
    this.step = step;
    this.stepTime = 0;
    this.ui.setStep(BEAD_OF[step] ?? 0);
    this.ui.hideHint();
    const w = this.world;

    switch (step) {
      case Step.Intro:
        w.reel.group.visible = false;
        w.boom.group.visible = false;
        w.hose.group.visible = false;
        break;

      case Step.Gate:
        say('おみずを いれてみよう');
        break;

      case Step.Reel: {
        w.reel.group.visible = true;
        w.reel.reset(-w.variant.halfX * 0.42, -w.variant.halfZ * 0.42, 0.7);
        // the bog is at depth: shut the gate, the way a crew would
        w.gate.setTarget(0);
        say('ぐるぐる いくよ');
        break;
      }

      case Step.Reveal:
        this.revealPhase = 0;
        // whatever is still on the vine comes up now — this is the big moment
        w.berries.harvestAll();
        break;

      case Step.Boom: {
        w.boom.group.visible = true;
        const c = w.berries.floatCentroid(this.tmp2);
        w.boom.deploy(c, w.berries.floatingCount, berryArea(w.berries.radius));
        w.berries.setContainment(w.boom.contain);
        say('ぎゅーっと あつめよう');
        break;
      }

      case Step.Hose: {
        w.hose.group.visible = true;
        const c = w.boom.centre;
        // strays escape under the boom before the pump arrives
        w.berries.makeStrays(10, c);
        // start the nozzle on the near side of the raft, so the child's drag
        // is a simple push away from themselves toward the glowing ring
        const edge = new THREE.Vector2(c.x + w.variant.halfX * 0.12, c.y - w.variant.halfZ * 0.62);
        clampToBog(w.variant, edge, 1.6);
        w.hose.place(edge.x, edge.y, c);
        say('ホースを もっていこう');
        break;
      }

      case Step.Pump:
        this.ui.showPump(true);
        this.pumpTotal = Math.max(1, w.berries.onWater - w.berries.strays);
        // pace the pump so a full bog takes about half a minute of holding,
        // whatever the quality tier decided the crop size should be
        w.berries.intakeRate = this.pumpTotal / 32;
        w.berries.setHose(w.hose.curve, 0.62);
        say('すいこむよー！');
        break;

      case Step.Done:
        this.doneT = 0;
        this.ui.showPump(false);
        w.berries.setIntake(false);
        pumpLoop.stop();
        say('トラック いっぱい！');
        sfxChime();
        break;

      case Step.Sandbox: {
        // free play: flooded bog, reel in hand, hose already coupled
        w.water.level = WATER_FULL;
        w.water.targetLevel = WATER_FULL;
        w.gate.setTarget(1);
        w.gate.open = 1;
        this.fill = 1;
        w.reel.group.visible = true;
        w.reel.reset(0, 0, 0.4);
        w.hose.group.visible = true;
        const c = new THREE.Vector2(w.variant.halfX * 0.3, w.variant.halfZ * 0.3);
        w.hose.place(c.x, c.y, c);
        w.hose.connected = true;
        w.berries.setHose(w.hose.curve, 0.62);
        w.berries.recycleToVine = true;
        this.ui.showPump(true);
        say('すきなだけ あそんでね');
        break;
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * per-frame
   * ------------------------------------------------------------------ */

  update(dt: number, width: number, height: number): void {
    this.stepTime += dt;
    const w = this.world;
    const portrait = height >= width;

    if (!this.ui.sheetOpen) this.handleInput(dt, width, height, portrait);

    /* ---- world systems ---- */
    w.gate.update(dt);
    w.water.update(dt);
    w.vines.update(dt, w.water.flood);
    w.reel.update(dt, (x, z) => w.water.heightAt(x, z));
    if (w.boom.group.visible) w.boom.update(dt, (x, z) => w.water.heightAt(x, z));
    if (w.hose.group.visible) {
      w.hose.update(dt, (x, z) => w.water.heightAt(x, z), this.pumping ? 1 : 0);
      w.berries.setHose(w.hose.curve, 0.62);
    }
    w.truck.update(dt, this.pumping ? 1 : 0);
    w.berries.update(dt, this.director.camera);
    w.particles.update(dt, w.water.level);
    w.particles.setProjection(height, this.director.camera.fov);

    /* ---- ambience & loops ---- */
    ambienceLoop.set(0.05);
    gateLoop.set(w.gate.open * (this.fill < 1 ? 0.55 : 0.12));
    const reelActive =
      (this.step === Step.Reel || this.step === Step.Sandbox) && w.reel.group.visible;
    reelLoop.set(reelActive ? 0.18 + clamp(w.reel.speed / 3.6, 0, 1) * 0.5 : 0);
    pumpLoop.set(this.pumping ? 0.6 : 0);

    this.updateStep(dt, width, height, portrait);
    this.composeShot(portrait, width, height);
    this.director.set(this.shot);
    this.director.update(dt);
    this.updateHint(dt, width, height);
  }

  /* ------------------------------------------------------------------ *
   * input
   * ------------------------------------------------------------------ */

  private handleInput(dt: number, width: number, height: number, portrait: boolean): void {
    const p = this.input.pointer;
    const w = this.world;

    switch (this.step) {
      case Step.Intro:
        // any touch skips the establishing shot
        if (p.justDown) this.enter(Step.Gate);
        break;

      case Step.Gate: {
        if (p.down && (Math.abs(p.delta.y) > 0.01 || Math.abs(p.delta.x) > 0.01)) {
          // up anywhere on screen opens; down closes. Portrait and landscape
          // both read "lift" as up, so the same gesture works either way.
          const travel = -p.delta.y / (height * 0.32);
          w.gate.nudge(travel);
        }
        break;
      }

      case Step.Reel:
      case Step.Sandbox: {
        if (p.down && !this.overPumpButton(p.screen.x, p.screen.y)) {
          const hit = this.input.worldOnPlane(this.director.camera, w.water.level, this.tmp3);
          if (hit) {
            this.tmp2.set(hit.x, hit.z);
            // Holding the finger still still drives the machine at a useful
            // pace; moving it faster only adds on top. A child who parks a
            // fingertip and waits must not be punished with a crawl.
            const pxSpeed = p.delta.length() / Math.max(dt, 1e-3);
            const throttle = clamp(0.55 + pxSpeed / (height * 0.9), 0.55, 1);
            w.reel.steerTo(this.tmp2, throttle, dt);
          }
        } else {
          w.reel.coast(dt);
        }
        break;
      }

      case Step.Reveal: {
        // free stirring while the fruit comes up
        if (p.down) {
          const hit = this.input.worldOnPlane(this.director.camera, w.water.level, this.tmp3);
          if (hit && bogInset(w.variant, hit.x, hit.z) > 0) {
            w.berries.setStir(this.tmp2.set(hit.x, hit.z), 1);
            w.water.setDisturb(1, hit.x, hit.z, 0.1, 2.2);
            this.stirSound(hit.x, hit.z);
          }
        } else {
          w.berries.setStir(null);
          w.water.fadeDisturb(1, dt, 2.5);
        }
        break;
      }

      case Step.Boom: {
        // Grab whichever buoy is nearer — anywhere on screen counts, so a
        // four-year-old cannot miss the handle.
        if (p.justDown) {
          const hit = this.input.worldOnPlane(this.director.camera, w.water.level, this.tmp3);
          if (hit) this.boomGrab = w.boom.pickHandle(this.tmp2.set(hit.x, hit.z));
        }
        if (p.down && this.boomGrab) {
          const hit = this.input.worldOnPlane(this.director.camera, w.water.level, this.tmp3);
          if (hit) {
            w.boom.haul(this.boomGrab, this.tmp2.set(hit.x, hit.z), dt);
            const h = this.boomGrab === 'a' ? w.boom.posA : w.boom.posB;
            w.water.setDisturb(3, h.x, h.y, 0.06, 2.6);
            if (w.boom.haulRate > 0.6) this.stirSound(h.x, h.y, 0.5);
          }
        }
        if (p.justUp) this.boomGrab = null;
        if (!p.down) w.water.fadeDisturb(3, dt, 2);
        break;
      }

      case Step.Hose: {
        if (p.justDown) {
          const hit = this.input.worldOnPlane(this.director.camera, w.water.level, this.tmp3);
          // grabbing anywhere counts: the nozzle is the only draggable thing
          if (hit) this.hoseGrabbed = true;
        }
        if (p.down && this.hoseGrabbed) {
          const hit = this.input.worldOnPlane(this.director.camera, w.water.level, this.tmp3);
          if (hit) {
            const q = this.tmpB.set(hit.x, hit.z);
            w.hose.dragTo(q.x, q.y, dt);
            w.water.setDisturb(2, q.x, q.y, 0.07, 1.8);
          }
        }
        if (p.justUp) this.hoseGrabbed = false;
        break;
      }

      case Step.Pump:
      case Step.Done:
        break;
    }
    void width;
    void portrait;
  }

  /**
   * Once the churning is finished the machine drives itself out of the way,
   * so it never stands between the child and the fruit they are working on.
   */
  private parkReel(dt: number): void {
    const w = this.world;
    const home = this.tmpB.set(-w.variant.halfX * 0.74, -w.variant.halfZ * 0.74);
    if (w.reel.pos.distanceTo(home) > 1.2) w.reel.steerTo(home, 0.55, dt);
    else w.reel.coast(dt);
  }

  private stirSound(x: number, z: number, gain = 1): void {
    const now = performance.now();
    if (now - this.lastStirSound > 220) {
      this.lastStirSound = now;
      sfxLap(0.5 * gain);
    }
    void x;
    void z;
  }

  private overPumpButton(x: number, y: number): boolean {
    if (!this.ui.pumpVisible) return false;
    const r = this.ui.pumpRect();
    return x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12;
  }

  /* ------------------------------------------------------------------ *
   * step logic
   * ------------------------------------------------------------------ */

  private updateStep(dt: number, width: number, height: number, portrait: boolean): void {
    const w = this.world;

    switch (this.step) {
      case Step.Intro:
        if (this.stepTime > (prefersReducedMotion() ? 2.4 : 4.5)) this.enter(Step.Gate);
        break;

      case Step.Gate: {
        // If the gate is left shut for a long time, it creeps open on its own.
        // Not a punishment timer — just the game refusing to stall.
        if (w.gate.target < 0.05) {
          this.gateAssist += dt;
          if (this.gateAssist > 18) w.gate.nudge(dt * 0.09);
        } else {
          this.gateAssist = 0;
        }
        this.fill = clamp(this.fill + w.gate.open * dt * 0.15, 0, 1);
        w.water.targetLevel = lerp(WATER_DRY, WATER_FULL, smoothstep(this.fill));
        // splash where the sheet meets the bog
        if (w.gate.open > 0.05 && Math.random() < w.gate.open * 0.9) {
          w.spawnChurn(w.gate.mouth.x, w.water.level, w.gate.mouth.z + 1.4, w.gate.open * 0.8);
        }
        w.water.setDisturb(0, w.gate.mouth.x, w.gate.mouth.z + 1.6, w.gate.open * 0.09, 5.5);
        if (this.fill >= 0.999) this.enter(Step.Reel);
        break;
      }

      case Step.Reel: {
        w.water.setDisturb(
          0,
          w.reel.churn.x,
          w.reel.churn.z,
          0.06 + clamp(w.reel.speed / 3.6, 0, 1) * 0.16,
          3.4,
        );
        const front = w.reel.frontPoint(this.tmp3);
        const moving = clamp(w.reel.speed / 1.8, 0, 1);
        w.berries.harvestAt(front.x, front.z, w.reel.swathe, 0.07 + moving * 0.5);
        if (Math.random() < 0.7) {
          w.spawnChurn(w.reel.churn.x, w.water.level, w.reel.churn.z, 0.25 + moving * 0.75);
        }
        if (w.berries.harvested >= REEL_TARGET) this.enter(Step.Reveal);
        break;
      }

      case Step.Reveal: {
        w.reel.coast(dt);
        w.water.fadeDisturb(0, dt, 1.2);
        const fast = prefersReducedMotion();
        const diveEnd = fast ? 1.6 : 3.2;
        const riseEnd = diveEnd + (fast ? 1.6 : 3.4);
        const lingerEnd = riseEnd + (fast ? 1.4 : 2.6);
        this.revealPhase =
          this.stepTime < diveEnd ? 0 : this.stepTime < riseEnd ? 1 : 2;
        if (this.stepTime > lingerEnd) this.enter(Step.Boom);
        if (this.revealPhase === 1 && this.stepTime - dt < diveEnd) say('いっぱい ういた！');
        break;
      }

      case Step.Boom: {
        this.parkReel(dt);
        // Done when the ring is as tight as this crop allows.
        const tight = w.boom.tightness;
        // the raft is allowed to heap as the ring closes: this is what turns
        // "berries move together" into "berries pack into a red mass"
        w.berries.packFactor = lerp(1, PACK_TIGHT, smoothstep(tight));
        if (tight > 0.93) {
          this.boomSettled += dt;
          if (this.boomSettled === dt) sfxTumble();
          if (this.boomSettled > 1.6) this.enter(Step.Hose);
        } else {
          this.boomSettled = Math.max(0, this.boomSettled - dt * 0.5);
        }
        break;
      }

      case Step.Hose: {
        this.parkReel(dt);
        if (w.hose.trySnap(3.8)) {
          sfxClick();
          say('カチッ');
          window.setTimeout(() => {
            if (this.step === Step.Hose) this.enter(Step.Pump);
          }, 700);
        }
        break;
      }

      case Step.Pump: {
        // the mouth reaches across the whole corral, so the last few berries
        // are never left bobbing out of range
        w.berries.setIntake(this.pumping, w.hose.intakePoint(this.tmp3), w.boom.radius + 1.5);
        if (this.pumping) {
          w.water.setDisturb(2, w.hose.mouth.x, w.hose.mouth.z, 0.11, 2.4);
          if (Math.random() < 0.5) {
            w.spawnChurn(w.hose.mouth.x, w.water.level, w.hose.mouth.z, 0.35);
          }
          if (Math.random() < 0.3) sfxTumble();
        } else {
          w.water.fadeDisturb(2, dt, 2);
        }
        const remaining = w.berries.onWater - w.berries.strays;
        this.pumpProgress = damp(
          this.pumpProgress,
          clamp(1 - remaining / this.pumpTotal, 0, 1),
          1.4,
          dt,
        );
        this.ui.setPumpCalling(!this.pumping);
        if (remaining <= 0 && w.berries.inHoseCount === 0) {
          this.pumping = false;
          this.enter(Step.Done);
        }
        break;
      }

      case Step.Done: {
        this.doneT += dt;
        w.setEvening(clamp(this.doneT / 6, 0, 1));
        w.water.fadeDisturb(2, dt, 1.5);
        // the crew lifts the hose out before the truck pulls away, otherwise
        // it would stretch across the field after it
        if (this.doneT > 2.2) w.hose.group.visible = false;
        if (this.doneT > 2.6 && !w.truck.leaving) w.truck.driveAway();
        if (this.doneT > 6.5 && !this.endShown) {
          this.endShown = true;
          this.ui.showEndCard(true);
        }
        break;
      }

      case Step.Sandbox: {
        w.water.setDisturb(
          0,
          w.reel.churn.x,
          w.reel.churn.z,
          0.06 + clamp(w.reel.speed / 3.6, 0, 1) * 0.16,
          3.4,
        );
        const front = w.reel.frontPoint(this.tmp3);
        const moving = clamp(w.reel.speed / 1.8, 0, 1);
        w.berries.harvestAt(front.x, front.z, w.reel.swathe, 0.07 + moving * 0.5);
        if (Math.random() < 0.6) {
          w.spawnChurn(w.reel.churn.x, w.water.level, w.reel.churn.z, 0.25 + moving * 0.75);
        }
        w.berries.setIntake(this.pumping, w.hose.intakePoint(this.tmp3), 5.5);
        if (this.pumping && Math.random() < 0.3) sfxTumble();
        break;
      }
    }
    void width;
    void height;
    void portrait;
  }

  /* ------------------------------------------------------------------ *
   * camera
   * ------------------------------------------------------------------ */

  private composeShot(portrait: boolean, width: number, height: number): void {
    const w = this.world;
    const v = w.variant;
    const s = this.shot;
    const wide = Math.max(v.halfX, v.halfZ);
    // Portrait is a different composition, not a squeezed one: wider lens,
    // steeper look-down, and a bias that lifts the subject clear of the
    // thumb zone at the bottom of the screen.
    const pf = portrait ? 1.34 : 1;
    const fovBase = portrait ? 60 : 46;
    s.rate = 1.6;
    s.bias = 0;

    switch (this.step) {
      case Step.Intro: {
        const t = clamp(this.stepTime / 5, 0, 1);
        s.target.set(0, 0.6, 1.5);
        s.yaw = 0.5 - t * 0.16;
        s.pitch = (portrait ? 0.64 : 0.46) + t * 0.03;
        s.dist = wide * 2.9 * (portrait ? 1.14 : 1) - t * wide * 0.32;
        s.fov = fovBase;
        s.rate = 0.7;
        break;
      }

      case Step.Gate: {
        const g = w.gate.group.position;
        // gate and the flooding front held in one frame throughout
        s.target.set(g.x * 0.6, 1.0, lerp(g.z + 5.5, -v.halfZ * 0.1, this.fill * 0.85));
        s.yaw = portrait ? 0.12 : 0.24;
        s.pitch = portrait ? 0.44 : 0.3;
        s.dist = (portrait ? 18 : 17) * pf;
        s.fov = fovBase;
        s.bias = portrait ? 1.5 : 0.5;
        s.rate = 1.1;
        break;
      }

      case Step.Reel: {
        const r = w.reel;
        // three-quarters behind, close enough that the paddles fill the frame
        s.target.set(
          r.pos.x + Math.sin(r.viewHeading) * 2.0,
          w.water.level + 0.5,
          r.pos.y + Math.cos(r.viewHeading) * 2.0,
        );
        s.yaw = r.viewHeading + Math.PI + (portrait ? 0.22 : 0.36);
        s.pitch = portrait ? 0.52 : 0.3;
        s.dist = portrait ? 15.5 : 10.5;
        s.fov = portrait ? 58 : 52;
        s.bias = portrait ? 1.0 : 0.35;
        s.rate = 2.2;
        break;
      }

      case Step.Reveal: {
        const c = w.berries.floatCentroid(this.tmp2);
        const fast = prefersReducedMotion();
        const diveEnd = fast ? 1.6 : 3.2;
        const riseLen = fast ? 1.6 : 3.4;
        if (this.revealPhase === 0) {
          // down to the waterline, right behind the machine, no cut
          s.target.set(w.reel.churn.x, w.water.level + 0.15, w.reel.churn.z);
          s.yaw = w.reel.viewHeading + Math.PI + 0.95;
          s.pitch = 0.08;
          s.dist = 6.6;
          s.fov = portrait ? 66 : 58;
          s.bias = 0.75;
          s.rate = 1.1;
        } else {
          // and up, in one move, to show what the whole bog just became
          const t = clamp((this.stepTime - diveEnd) / riseLen, 0, 1);
          const e = smoothstep(t);
          s.target.set(c.x * 0.5, w.water.level, c.y * 0.5);
          s.yaw = w.reel.viewHeading + Math.PI + 0.95 - e * 0.6;
          s.pitch = lerp(0.05, portrait ? 1.05 : 0.88, e);
          s.dist = lerp(6.6, wide * (portrait ? 2.1 : 1.7), e);
          s.fov = lerp(portrait ? 66 : 58, fovBase, e);
          s.bias = lerp(0.75, 0, e);
          s.rate = 0.95;
        }
        break;
      }

      case Step.Boom: {
        const c = w.boom.centre;
        const span = w.boom.radius * 2;
        s.target.set(c.x, w.water.level, c.y);
        s.yaw = portrait ? 0.06 : 0.16;
        s.pitch = portrait ? 1.0 : 0.82;
        // frame the ring, tightening with it so the squeeze reads
        s.dist = clamp(span * (portrait ? 1.5 : 1.15) + 5, 11, wide * 2.6);
        s.fov = fovBase;
        s.rate = 0.9;
        break;
      }

      case Step.Hose: {
        const c = w.boom.centre;
        const n = w.hose.nozzle.position;
        // from the bog side: the hose runs away from the lens toward the
        // pump, instead of charging straight down the barrel of it
        s.target.set((c.x + n.x) / 2, w.water.level + 0.2, (c.y + n.z) / 2);
        s.yaw = Math.PI + (portrait ? 0.14 : 0.3);
        s.pitch = portrait ? 0.62 : 0.5;
        s.dist = portrait ? 15 : 13.5;
        s.fov = fovBase;
        s.bias = portrait ? 1.2 : 0.4;
        s.rate = 1.2;
        break;
      }

      case Step.Pump: {
        // one continuous slide: water → the clear window → the truck bed
        const t = clamp(this.pumpProgress, 0, 1);
        // stand on the far side of the bog: raft in front, hose leading away
        // to the pump and the truck, all three changes in one frame
        const a: Shot = {
          target: new THREE.Vector3(w.hose.mouth.x, w.water.level + 0.1, w.hose.mouth.z),
          yaw: Math.PI + (portrait ? 0.1 : 0.26),
          pitch: portrait ? 0.62 : 0.52,
          dist: portrait ? 10.5 : 9.5,
          fov: portrait ? 64 : 54,
          bias: portrait ? 1.5 : 0.5,
        };
        // the arch out of the water, viewed from the bog side: the clear
        // window fills the foreground and the truck waits behind it
        const arch = w.hose.archPoint(this.tmp3);
        const b: Shot = {
          target: arch.clone(),
          yaw: Math.PI + (portrait ? 0.34 : 0.46),
          pitch: portrait ? 0.3 : 0.24,
          dist: portrait ? 5.4 : 5.0,
          fov: portrait ? 62 : 52,
          bias: portrait ? 0.35 : 0.1,
        };
        const bed = w.truck.bedOrigin;
        const c: Shot = {
          target: new THREE.Vector3(bed.x, bed.y + 0.9, bed.z),
          // from beyond the truck, so the hose runs away from us and the
          // heap in the bed is never blocked by the pipework
          yaw: portrait ? 1.35 : 1.25,
          pitch: portrait ? 0.4 : 0.34,
          dist: portrait ? 7.2 : 7.6,
          fov: portrait ? 60 : 50,
          bias: portrait ? 0.35 : 0.2,
        };
        // dwell on the clear window through the middle of the run
        const seg =
          t < 0.4
            ? CameraDirector.blend(a, b, smoothstep(t / 0.4))
            : t < 0.72
              ? b
              : CameraDirector.blend(b, c, smoothstep((t - 0.72) / 0.28));
        s.target.copy(seg.target);
        s.yaw = seg.yaw;
        s.pitch = seg.pitch;
        s.dist = seg.dist;
        s.fov = seg.fov;
        s.bias = seg.bias ?? 0;
        s.rate = 0.8;
        break;
      }

      case Step.Done: {
        // hold on the full bed first, then pull wide while the truck leaves
        const t = smoothstep(clamp((this.doneT - 2.8) / 5.5, 0, 1));
        const bed = w.truck.bedOrigin;
        s.target.set(lerp(bed.x, 0, t), lerp(bed.y + 1, 1.5, t), lerp(bed.z, v.halfZ * 0.25, t));
        s.yaw = lerp(1.25, 0.5, t);
        s.pitch = lerp(0.4, portrait ? 0.44 : 0.32, t);
        s.dist = lerp(8, wide * 2.4 * pf, t);
        s.fov = lerp(portrait ? 60 : 50, fovBase, t);
        s.rate = 0.5;
        break;
      }

      case Step.Sandbox: {
        const r = w.reel;
        s.target.set(r.pos.x, w.water.level + 0.5, r.pos.y);
        s.yaw = r.viewHeading + Math.PI + 0.4;
        s.pitch = portrait ? 0.58 : 0.44;
        s.dist = portrait ? 18 : 14;
        s.fov = portrait ? 62 : 52;
        s.bias = portrait ? 1.1 : 0.35;
        s.rate = 1.8;
        break;
      }
    }
    void width;
    void height;
  }

  /* ------------------------------------------------------------------ *
   * hints — a silent hand, never a sentence
   * ------------------------------------------------------------------ */

  private updateHint(dt: number, width: number, height: number): void {
    const idle = performance.now() - this.input.pointer.lastActivity;
    let anchor: THREE.Vector3 | null = null;
    let kind: HintKind = 'tap';
    const w = this.world;

    switch (this.step) {
      case Step.Gate:
        if (w.gate.target < 0.06) {
          anchor = w.gate.handle;
          kind = 'swipe-up';
        }
        break;
      case Step.Reel:
      case Step.Sandbox:
        anchor = this.tmp3.set(w.reel.pos.x, w.water.level + 1, w.reel.pos.y);
        kind = 'drag';
        break;
      case Step.Reveal:
        if (this.revealPhase === 2) {
          const c = w.berries.floatCentroid(this.tmp2);
          anchor = this.tmp3.set(c.x, w.water.level, c.y);
          kind = 'stir';
        }
        break;
      case Step.Boom: {
        anchor = this.tmp3.copy(w.boom.handleA.position);
        kind = 'pull';
        break;
      }
      case Step.Hose:
        anchor = this.tmp3.copy(w.hose.nozzle.position);
        kind = 'drag';
        break;
      case Step.Pump: {
        if (!this.pumping) {
          const r = this.ui.pumpRect();
          this.ui.showHint(r.left + r.width / 2, r.top + r.height / 2, 'hold');
          return;
        }
        break;
      }
      default:
        break;
    }

    if (!anchor || idle < 3200) {
      this.ui.hideHint();
      return;
    }
    const p = anchor.clone().project(this.director.camera);
    if (p.z > 1) {
      this.ui.hideHint();
      return;
    }
    const x = clamp(((p.x + 1) / 2) * width, 60, width - 60);
    const y = clamp(((-p.y + 1) / 2) * height, 80, height - 80);
    this.ui.showHint(x, y, kind);
    void dt;
  }

  /* ------------------------------------------------------------------ *
   * UI callbacks
   * ------------------------------------------------------------------ */

  setPumping(on: boolean): void {
    if (this.step !== Step.Pump && this.step !== Step.Sandbox) return;
    this.pumping = on;
    if (on) this.input.pointer.lastActivity = performance.now();
  }

  get quality(): ReturnType<typeof quality> {
    return quality();
  }
}
