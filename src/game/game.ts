/**
 * The play loop: ten scenes chained by causation, never by "next" buttons.
 *
 * Guiding rules encoded here:
 *  - nothing can fail, nothing can be lost, nothing is timed or scored
 *  - every drop target is a magnet; a release anywhere sensible still works
 *  - after a few seconds of hesitation the game points instead of explaining
 *  - the fluorescence image does not exist on screen until the very last beat
 */
import * as THREE from 'three';
import { CircleTracker, Input } from '../core/input';
import { CameraRig, type Shot, type ShotName } from '../core/rig';
import { audio } from '../core/audio';
import {
  TAU, clamp, damp, easeInOutCubic, easeOutCubic, invLerp, lerp, makeRng, rand, smoothstep,
} from '../core/util';
import { setLightLevel, tickMaterials } from '../gfx/materials';
import { Ribbon, PORTRAIT_SHAPE, LANDSCAPE_SHAPE } from '../gfx/ribbon';
import { Section } from '../gfx/section';
import { FluoroField } from '../gfx/fluoro';
import { Hints } from '../gfx/hints';
import { BindingView, Wisps } from '../gfx/fx';
import { buildLab, type Lab, BATH_SIZE, STATION } from '../world/lab';
import { Droplets, makeCarryShadow, makeCoverGlass, makeMountant, makeSlide } from '../world/props';
import { shotsFor } from '../world/shots';
import { createSpecimen, type Specimen } from '../spec/specimen';

export type Quality = 'low' | 'high';

enum Stage {
  Intro, BlockMount, Slicing, BathDrop, BathRelax, Pickup,
  Dewax, Stain, Mount, DarkRoom, ScopeMount, Focus, Reveal,
}

/** Wheel angles (within one revolution) between which the knife is in the block. */
const CUT_A = 0.82;
const CUT_B = 2.32;
const MAX_SECTIONS = 9;
const RIBBON_READY = 4;         // sections after which the ribbon may be taken
const CARRIAGE_MID = 0.62;
const CARRIAGE_THROW = 0.22;
const ADVANCE_PER_SECTION = 0.009;
/** height the slide is carried at around the staining bench */
const SLIDE_HOVER = 0.98;

const SHOT_OF: Record<Stage, ShotName> = {
  [Stage.Intro]: 'posture',
  [Stage.BlockMount]: 'posture',
  [Stage.Slicing]: 'action',
  [Stage.BathDrop]: 'bath',
  [Stage.BathRelax]: 'bath',
  [Stage.Pickup]: 'pickup',
  [Stage.Dewax]: 'dewax',
  [Stage.Stain]: 'stain',
  [Stage.Mount]: 'mount',
  [Stage.DarkRoom]: 'scope',
  [Stage.ScopeMount]: 'scope',
  [Stage.Focus]: 'optical',
  [Stage.Reveal]: 'optical',
};

/** Simple position/rotation tween for props being handed between scenes. */
class Mover {
  private active = false;
  private t = 0; private dur = 1;
  private from = new THREE.Vector3(); private to = new THREE.Vector3();
  private fromQ = new THREE.Quaternion(); private toQ = new THREE.Quaternion();
  private obj: THREE.Object3D | null = null;
  private done?: () => void;
  private rot = false;

  go(obj: THREE.Object3D, to: THREE.Vector3, toEuler: THREE.Euler | null, dur: number, done?: () => void) {
    this.obj = obj; this.from.copy(obj.position); this.to.copy(to);
    this.fromQ.copy(obj.quaternion);
    this.rot = !!toEuler;
    if (toEuler) this.toQ.setFromEuler(toEuler);
    this.t = 0; this.dur = Math.max(0.0001, dur); this.active = true; this.done = done;
  }
  cancel() { this.active = false; this.obj = null; this.done = undefined; }
  get running() { return this.active; }
  update(dt: number) {
    if (!this.active || !this.obj) return;
    this.t = clamp(this.t + dt / this.dur);
    const e = easeInOutCubic(this.t);
    this.obj.position.lerpVectors(this.from, this.to, e);
    if (this.rot) this.obj.quaternion.slerpQuaternions(this.fromQ, this.toQ, e);
    if (this.t >= 1) { this.active = false; const d = this.done; this.done = undefined; this.obj = null; d?.(); }
  }
}

export class Game {
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  private input: Input;
  private lab: Lab;
  private specimen: Specimen;
  private quality: Quality;
  private w = 1; private h = 1;
  private portrait = true;
  private clock = 0;

  private stage: Stage = Stage.Intro;
  private stageT = 0;

  // microtome
  private wheelTracker = new CircleTracker({ friction: 2.2, deadzone: 14 });
  private knobTracker = new CircleTracker({ friction: 3.4, deadzone: 14 });
  private ribbon!: Ribbon;
  private ribbonLen = 0;
  private ribbonCut = 0;          // sections already taken off the ribbon
  private completed = 0;          // full sections produced
  private lastTickAngle = 0;
  private cutFired = false;
  private macroPending = false;
  private macroTimer = 0;
  private inMacro = false;
  private wheelEngaged = false;
  private grabbing: 'none' | 'block' | 'section' | 'slide' | 'cover' | 'dropper' = 'none';
  private grabLift = 0;

  // props
  private section: Section | null = null;
  private sectionHolder = new THREE.Group();
  private slide = makeSlide();
  private cover = makeCoverGlass();
  private mountant = makeMountant();
  private droplets = new Droplets(8);
  private carryShadow = makeCarryShadow();
  private wisps = new Wisps(8);
  private binding = new BindingView();
  private hints = new Hints();
  private fluoro!: FluoroField;

  // per-stage scratch
  private relaxT = 0;
  private stroke = 0;
  private lifting = false;
  private liftT = 0;
  private dipT = -1;
  private dipIndex = -1;
  private stained = [false, false, false];
  private dropped = false;
  private coverT = 0;
  private coverPlaced = false;
  private focalPos = -1;
  private focalBest = 0.35;
  private focusHold = 0;
  private revealT = -1;
  private zoomT = 0;
  private flash = 0;
  private movers: Mover[] = [new Mover(), new Mover(), new Mover()];
  private blockGhostPulse = 0;
  private restartRequested = false;
  private onFinish?: () => void;

  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private scr = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, quality: Quality, onFinish?: () => void) {
    this.quality = quality;
    this.onFinish = onFinish;
    this.rig = new CameraRig(1);
    this.scene.background = new THREE.Color(0x0e1a26);
    this.scene.fog = new THREE.Fog(0x12212f, 11, 30);

    this.specimen = createSpecimen(quality);
    this.lab = buildLab(this.specimen, quality);
    this.scene.add(this.lab.root);
    this.scene.add(this.rig.camera);
    this.scene.add(this.hints.group);
    this.scene.add(this.sectionHolder);
    this.scene.add(this.droplets.group, this.wisps.group);
    this.scene.add(this.carryShadow.mesh);
    this.scene.add(this.binding.mesh);

    this.buildRunObjects();

    this.input = new Input(canvas, () => audio.unlock());
    this.enter(Stage.Intro);
  }

  // -------------------------------------------------------------------------
  // run lifecycle
  // -------------------------------------------------------------------------

  private buildRunObjects() {
    const rng = makeRng(this.specimen.seed);
    this.ribbon = new Ribbon(this.specimen.tissue, MAX_SECTIONS, this.specimen.seed % 997, this.quality);
    this.ribbon.setShape(this.portrait ? PORTRAIT_SHAPE : LANDSCAPE_SHAPE);
    this.ribbon.group.position.copy(this.lab.microtome.ribbonAnchor.position);
    this.lab.microtome.group.add(this.ribbon.group);

    this.fluoro = new FluoroField(this.specimen.fluoroFar, this.specimen.fluoroNear, this.quality);
    this.rig.camera.add(this.fluoro.mesh);

    this.slide.group.visible = false;
    this.cover.group.visible = false;
    this.scene.add(this.slide.group, this.cover.group);
    this.slide.group.add(this.mountant.mesh);
    this.mountant.mesh.position.set(0.06, 0.009, 0);

    (this.lab.microtome.blockTissue.material as THREE.MeshBasicMaterial).map = this.specimen.tissue;
    this.focalBest = rand(rng, 0.16, 0.6);
  }

  /** Start a whole new specimen without rebuilding the lab. */
  restart() {
    this.restartRequested = false;
    // tear down run-specific objects
    this.lab.microtome.group.remove(this.ribbon.group);
    this.ribbon.dispose();
    this.rig.camera.remove(this.fluoro.mesh);
    this.fluoro.dispose();
    if (this.section) { this.sectionHolder.remove(this.section.mesh); this.section.dispose(); this.section = null; }
    this.scene.remove(this.slide.group, this.cover.group);
    this.slide.group.remove(this.mountant.mesh);
    this.specimen.dispose();

    this.specimen = createSpecimen(this.quality);
    this.buildRunObjects();

    // reset state
    this.wheelTracker.reset(); this.knobTracker.reset();
    this.ribbonLen = 0; this.ribbonCut = 0; this.completed = 0;
    this.lastTickAngle = 0; this.cutFired = false;
    this.macroPending = false; this.inMacro = false; this.macroTimer = 0;
    this.grabbing = 'none'; this.grabLift = 0;
    this.relaxT = 0; this.stroke = 0; this.lifting = false; this.liftT = 0;
    this.dipT = -1; this.dipIndex = -1; this.stained = [false, false, false];
    this.dropped = false; this.coverT = 0; this.coverPlaced = false;
    this.focalPos = -1; this.focusHold = 0; this.revealT = -1; this.zoomT = 0; this.flash = 0;
    for (const m of this.movers) m.cancel();
    this.droplets.clear(); this.wisps.clear(); this.binding.alpha = 0;
    this.carryShadow.hide();
    this.mountant.mesh.visible = false;
    this.mountant.mat.uniforms.uSpread.value = 0;
    this.slide.group.visible = false;
    this.slide.group.position.set(0, 0, 0);
    this.slide.group.rotation.set(0, 0, 0);
    this.slide.group.userData = {};
    this.cover.group.visible = false;
    this.cover.group.rotation.set(0, 0, 0);
    this.lab.stain.dropper.position.set(-0.26, 0, 0.86);
    this.lab.scope.knob.rotation.z = 0;
    this.lab.microtome.wheel.rotation.z = 0;
    this.fluoro.reveal = 0;
    this.fluoro.zoom = 1; this.fluoro.nearMix = 0; this.fluoro.cover = 0;
    this.lab.lights.scopePool.intensity = 0;
    this.lab.scope.lamp.intensity = 0;
    audio.stopRibbon();

    const mt = this.lab.microtome;
    mt.blockHolder.position.set(0, 0, 0);
    mt.carriage.position.set(0, CARRIAGE_MID, 0);
    mt.blockGhost.visible = true;
    mt.gauge.position.x = -0.55;
    this.setLights(1);
    this.enter(Stage.Intro);
  }

  // -------------------------------------------------------------------------
  // layout
  // -------------------------------------------------------------------------

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const wasPortrait = this.portrait;
    this.portrait = h >= w;
    this.rig.resize(w / h);
    this.fluoro.fit(this.rig.camera);
    if (wasPortrait !== this.portrait) {
      this.ribbon.setShape(this.portrait ? PORTRAIT_SHAPE : LANDSCAPE_SHAPE);
      // re-frame the current beat for the new orientation
      const s = this.stage === Stage.Slicing ? this.slicingShot() : this.shot(SHOT_OF[this.stage]);
      if (this.stage === Stage.Intro && this.stageT < 1.0) this.rig.snap(this.shot('establish'));
      else this.rig.moveTo(s, 0.5);
    }
  }

  private shot(name: ShotName): Shot { return shotsFor(this.portrait)[name]; }

  /** The slicing frame widens continuously as the ribbon gets longer. */
  private slicingShot(): Shot {
    const a = this.shot('action'), b = this.shot('ribbonPick');
    const k = clamp(this.ribbonLen / 7);
    return {
      pos: [lerp(a.pos[0], b.pos[0], k), lerp(a.pos[1], b.pos[1], k), lerp(a.pos[2], b.pos[2], k)],
      target: [lerp(a.target[0], b.target[0], k), lerp(a.target[1], b.target[1], k),
        lerp(a.target[2], b.target[2], k)],
      fov: lerp(a.fov, b.fov, k), drift: 0.5,
    };
  }

  // -------------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------------

  private worldOf(o: THREE.Object3D) { return o.getWorldPosition(this.tmp2); }

  private screenOf(world: THREE.Vector3) {
    return this.rig.project(world, this.w, this.h, this.scr);
  }

  private distToScreen(world: THREE.Vector3) {
    const s = this.screenOf(world);
    return Math.hypot(this.input.p.x - s.x, this.input.p.y - s.y);
  }

  /** Where the finger points, on a horizontal plane at height y, lifted so the
   *  object sits above the fingertip instead of under it. */
  private pointOnY(y: number, liftPx = 0, out = this.tmp) {
    _plane.set(_up, -y);
    this.rig.rayToPlane(this.input.p.x, this.input.p.y - liftPx, this.w, this.h, _plane, out);
    return out;
  }

  /** Same, on a plane facing the camera through `through`. */
  private pointOnFacing(through: THREE.Vector3, liftPx = 0, out = this.tmp) {
    this.rig.camera.getWorldDirection(_n);
    _plane.setFromNormalAndCoplanarPoint(_n, through);
    this.rig.rayToPlane(this.input.p.x, this.input.p.y - liftPx, this.w, this.h, _plane, out);
    return out;
  }

  private setLights(level: number) {
    const L = this.lab.lights;
    L.hemi.intensity = 1.5 * level + 0.06;
    L.key.intensity = 2.6 * level;
    L.fill.intensity = 1.1 * level + 0.05;
    setLightLevel(0.12 + 0.88 * level);
    this.scene.environmentIntensity = 0.08 + 0.92 * level;
    (this.scene.background as THREE.Color).setRGB(
      0.048 * level + 0.006, 0.088 * level + 0.010, 0.132 * level + 0.016,
    );
    (this.scene.fog as THREE.Fog).color.copy(this.scene.background as THREE.Color);
    audio.setAmbience(0.25 + 0.75 * level);
  }

  private enter(s: Stage) {
    this.stage = s;
    this.stageT = 0;
    this.hints.hide();
    const mt = this.lab.microtome;

    switch (s) {
      case Stage.Intro:
        this.rig.snap(this.shot('establish'));
        mt.blockGhost.visible = true;
        mt.block.position.set(-0.20, -0.60, 0.98);
        mt.carriage.position.y = CARRIAGE_MID + CARRIAGE_THROW;
        break;

      case Stage.BlockMount:
        this.rig.moveTo(this.shot('posture'), 1.5);
        audio.move();
        break;

      case Stage.Slicing:
        this.rig.moveTo(this.shot('action'), 1.5);
        audio.move();
        break;

      case Stage.BathDrop:
        this.rig.moveTo(this.shot('bath'), 1.7);
        audio.move();
        break;

      case Stage.BathRelax:
        audio.bloom();
        this.relaxT = 0;
        this.rig.moveTo({ ...this.shot('bath'), fov: this.shot('bath').fov - 7 }, 2.4);
        break;

      case Stage.Pickup:
        this.rig.moveTo(this.shot('pickup'), 1.6);
        this.slide.group.visible = true;
        this.slide.group.position.set(STATION.bath.x - 0.02, 0.34 - 0.16, 0.10);
        this.slide.group.rotation.set(0.06, 0, -0.05);
        this.lifting = false; this.liftT = 0;
        break;

      case Stage.Dewax:
        this.rig.moveTo(this.shot('dewax'), 1.7);
        audio.move();
        break;

      case Stage.Stain:
        this.rig.moveTo(this.shot('stain'), 1.5);
        audio.move();
        break;

      case Stage.Mount:
        this.rig.moveTo(this.shot('mount'), 1.5);
        audio.move();
        break;

      case Stage.DarkRoom:
        this.rig.moveTo(this.shot('scope'), 3.0);
        audio.move();
        break;

      case Stage.ScopeMount:
        break;

      case Stage.Focus:
        this.rig.moveTo(this.shot('optical'), 2.0);
        this.focalPos = -1;
        this.knobTracker.reset();
        break;

      case Stage.Reveal:
        this.zoomT = 0;
        this.fluoro.reveal = 1;
        break;
    }
  }

  // -------------------------------------------------------------------------
  // main update
  // -------------------------------------------------------------------------

  update(dt: number) {
    this.clock += dt;
    this.stageT += dt;
    this.input.update(dt, this.w, this.h);
    tickMaterials(this.clock);
    this.lab.bath.water.tick(dt);
    this.section?.tick(this.clock);
    this.binding.tick(this.clock);
    this.fluoro.tick(this.clock);
    // the fov changes shot to shot, so the field quad is refitted every frame
    if (this.stage >= Stage.Focus) this.fluoro.fit(this.rig.camera);
    this.mountant.mat.uniforms.uTime.value = this.clock;
    for (const m of this.movers) m.update(dt);
    this.droplets.update(dt);
    this.wisps.update(dt, this.rig.camera);
    this.flash = damp(this.flash, 0, 3.4, dt);
    this.fluoro.flash = this.flash;

    // the robot keeps working whatever the player is doing
    const r = this.lab.robot;
    r.group.position.y = Math.sin(this.clock * 1.1) * 0.012;
    r.head.rotation.y = Math.sin(this.clock * 0.5) * 0.22;
    r.armR.rotation.x = -0.5 + Math.sin(this.clock * 1.3) * 0.12;
    r.armL.rotation.x = -0.35 + Math.sin(this.clock * 1.3 + 1.0) * 0.1;

    switch (this.stage) {
      case Stage.Intro: this.upIntro(dt); break;
      case Stage.BlockMount: this.upBlockMount(dt); break;
      case Stage.Slicing: this.upSlicing(dt); break;
      case Stage.BathDrop: this.upBathDrop(dt); break;
      case Stage.BathRelax: this.upBathRelax(dt); break;
      case Stage.Pickup: this.upPickup(dt); break;
      case Stage.Dewax: this.upDewax(dt); break;
      case Stage.Stain: this.upStain(dt); break;
      case Stage.Mount: this.upMount(dt); break;
      case Stage.DarkRoom: this.upDarkRoom(dt); break;
      case Stage.ScopeMount: this.upScopeMount(dt); break;
      case Stage.Focus: this.upFocus(dt); break;
      case Stage.Reveal: this.upReveal(dt); break;
    }

    this.updateSlideLook();
    this.updateCarryShadow();
    this.rig.update(dt);
    this.hints.update(dt, this.rig.camera);
    if (this.restartRequested) this.restart();
  }

  private get idleHint() { return this.input.idle > 3.2; }

  /** Where the circular field sits while the focus knob still has to be reachable. */
  private get fieldCentre() {
    return this.portrait ? { x: 0, y: 0.22 } : { x: 0.34, y: 0.02 };
  }

  // -------------------------------------------------------------------------
  // Scene 1 — the block
  // -------------------------------------------------------------------------

  private upIntro(dt: number) {
    void dt;
    if (this.stageT > 1.1 && !this.rig.moving && this.rig.current !== 'posture') {
      this.rig.current = 'posture';
      this.rig.moveTo(this.shot('posture'), 1.8);
      audio.move();
    }
    if (this.stageT > 3.0) this.enter(Stage.BlockMount);
  }

  private upBlockMount(dt: number) {
    const mt = this.lab.microtome;
    const p = this.input.p;
    const target = _v1.set(-0.04, 0, 0.02);
    mt.blockGhost.visible = true;
    this.blockGhostPulse += dt;
    const gs = 1 + Math.sin(this.blockGhostPulse * 3) * 0.04;
    mt.blockGhost.scale.setScalar(gs);

    if (p.justDown && this.distToScreen(this.worldOf(mt.block)) < 130) {
      this.grabbing = 'block';
      this.grabLift = 0;
    }
    if (this.grabbing === 'block') {
      this.grabLift = damp(this.grabLift, 62, 9, dt);
      // the block's position is expressed inside the holder, which rides the
      // carriage — convert into that exact space or the block jumps
      const worldBlock = this.worldOf(mt.block);
      const hit = this.pointOnFacing(worldBlock, this.grabLift, _v2).clone();
      mt.blockHolder.worldToLocal(hit);
      // magnet assist as it nears the holder
      const d = hit.distanceTo(target);
      const pull = 1 - smoothstep(0.10, 0.34, d);
      hit.lerp(target, pull * 0.55);
      mt.block.position.lerp(hit, Math.min(1, dt * 22));

      if (p.justUp) {
        this.grabbing = 'none';
        const dist = mt.block.position.distanceTo(target);
        if (dist < 1.1 && p.travel > 18) {
          this.movers[0].go(mt.block, target, null, 0.28, () => {
            audio.click(1);
            this.rig.bump(0.5);
            mt.blockGhost.visible = false;
            this.enter(Stage.Slicing);
          });
        } else {
          this.movers[0].go(mt.block, new THREE.Vector3(-0.20, -0.60, 0.98), null, 0.4);
        }
      }
    }
    if (this.idleHint && this.grabbing === 'none') {
      this.hints.showRing(this.worldOf(mt.blockGhost), 0.30);
      if (this.input.idle > 3.3 && this.input.idle < 3.4) audio.hint();
    } else this.hints.hide();
  }

  // -------------------------------------------------------------------------
  // Scene 2/3 — クルッ and スルスル
  // -------------------------------------------------------------------------

  private upSlicing(dt: number) {
    const mt = this.lab.microtome;
    const p = this.input.p;
    const wheelWorld = this.worldOf(mt.wheel).clone();
    const ws = this.screenOf(wheelWorld);
    const wsx = ws.x, wsy = ws.y;

    // --- is the finger on the ribbon (take it) or on the wheel (make more)?
    const canTake = this.ribbonLen >= RIBBON_READY;
    let ribbonPx = Infinity;
    let ribbonU = 0;
    if (canTake && this.ribbon.samples.length > 1) {
      for (let i = 1; i < this.ribbon.samples.length; i++) {
        const w = this.ribbon.group.localToWorld(this.ribbon.samples[i].clone());
        const s = this.rig.project(w, this.w, this.h, { x: 0, y: 0 });
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        if (d < ribbonPx) {
          ribbonPx = d;
          ribbonU = (i / (this.ribbon.samples.length - 1)) * this.ribbonLen;
        }
      }
    }
    const onRibbon = canTake && ribbonPx < 78;

    if (p.justDown) this.wheelEngaged = !onRibbon;
    if (!p.down) this.wheelEngaged = false;

    if (onRibbon && p.justUp && p.travel < 26) {
      this.takeRibbon(ribbonU);
      return;
    }

    // --- クルッ : the handwheel
    this.wheelTracker.update(dt, this.wheelEngaged && p.down, p.x, p.y, wsx, wsy);
    const angle = this.wheelTracker.angle;
    mt.wheel.rotation.z = -angle;

    // carriage rides the crank; the block dives past the knife once per turn
    mt.carriage.position.y = CARRIAGE_MID + CARRIAGE_THROW * Math.cos(angle);

    // section emergence, tied to the exact part of the turn where the knife
    // is inside the block
    const rev = Math.floor(angle / TAU);
    const phase = angle - rev * TAU;
    const emerge = clamp((phase - CUT_A) / (CUT_B - CUT_A));
    const raw = rev + emerge;
    const floorNow = Math.floor(raw + 1e-5);
    if (floorNow > this.completed) {
      this.completed = Math.min(MAX_SECTIONS + this.ribbonCut, floorNow);
    }
    const len = clamp(Math.max(raw, this.completed) - this.ribbonCut, 0, MAX_SECTIONS);
    this.ribbonLen = len;

    // --- feedback --------------------------------------------------------
    // ratchet ticks proportional to actual rotation, so sound == motion
    const rps = this.wheelTracker.revsPerSec;
    if (Math.abs(angle - this.lastTickAngle) > 0.26) {
      this.lastTickAngle = angle;
      if (this.wheelTracker.active || Math.abs(this.wheelTracker.velocity) > 0.5) audio.tick(rps);
    }
    const inCut = phase > CUT_A && phase < CUT_B && Math.abs(this.wheelTracker.velocity) > 0.05;
    audio.ribbon(inCut ? clamp(Math.abs(this.wheelTracker.velocity) * 0.34) : 0);
    if (emerge > 0.985 && !this.cutFired && len < MAX_SECTIONS) {
      this.cutFired = true;
      audio.cut();
      this.ribbon.kick(1.0);
      this.rig.bump(0.35);
      mt.blockHolder.position.z = -ADVANCE_PER_SECTION * (this.completed + this.ribbonCut);
      mt.gauge.position.x = -0.55 + clamp((this.completed + this.ribbonCut) / MAX_SECTIONS) * 0.5;
      if (this.ribbonLen >= RIBBON_READY && !this.macroPending && !this.inMacro && this.completed <= RIBBON_READY)
        this.macroPending = true;
    }
    if (emerge < 0.5) this.cutFired = false;

    this.ribbon.update(dt, this.ribbonLen);
    this.ribbon.mat.uniforms.uHighlight.value = onRibbon ? Math.floor(this.ribbonLen - ribbonU) : -1;

    // the frame opens up as the ribbon grows — never a cut, always a drift
    if (!this.inMacro) this.rig.follow(this.slicingShot(), dt, 1.5);

    // --- Ribbon Macro insert: only when the player is not mid-crank -------
    if (this.macroPending && !p.down && Math.abs(this.wheelTracker.velocity) < 0.4) {
      this.macroPending = false;
      this.inMacro = true;
      this.macroTimer = 0;
      this.rig.moveTo(this.shot('ribbonMacro'), 1.3);
    }
    if (this.inMacro) {
      this.macroTimer += dt;
      if (this.macroTimer > 2.6) {
        this.inMacro = false;
        this.rig.moveTo(this.shot('ribbonPick'), 1.2);
      }
      // let the player crank straight out of the macro shot
      if (p.down && this.macroTimer > 0.5) {
        this.inMacro = false;
        this.rig.moveTo(this.shot('action'), 0.8);
      }
    }

    // --- hints -----------------------------------------------------------
    if (this.grabbing === 'none' && this.idleHint) {
      if (this.ribbonLen < RIBBON_READY) {
        this.hints.showCircle(wheelWorld, 0.36);
      } else {
        const u = Math.max(0.5, this.ribbonLen - 0.5);
        this.hints.showRing(this.ribbon.worldAt(u, _v1), 0.20);
      }
      if (this.input.idle > 3.3 && this.input.idle < 3.4) audio.hint();
    } else this.hints.hide();
  }

  /** The player picked a piece of the ribbon: take one section off it. */
  private takeRibbon(u: number) {
    audio.tear();
    audio.stopRibbon();
    this.hints.hide();
    const uSel = clamp(u, 0.5, Math.max(0.5, this.ribbonLen - 0.4));
    const world = this.ribbon.worldAt(uSel, new THREE.Vector3());

    const sec = new Section(this.specimen.tissue, 0.3, this.specimen.seed, this.quality);
    sec.setMorph(0);
    sec.paraffin = 1;
    sec.relief = 0.14;
    sec.mesh.position.copy(world);
    sec.mesh.quaternion.copy(this.rig.camera.quaternion);
    this.sectionHolder.add(sec.mesh);
    this.section = sec;

    this.ribbonCut += 1;
    this.ribbonLen = Math.max(0, this.ribbonLen - 1);
    this.ribbon.update(0, this.ribbonLen);
    this.ribbon.mat.uniforms.uHighlight.value = -1;

    // carry it forward into the bath scene
    const carry = new THREE.Vector3(STATION.bath.x - 0.02, 0.95, 0.55);
    this.movers[1].go(sec.mesh, carry, null, 1.6);
    this.enter(Stage.BathDrop);
  }

  // -------------------------------------------------------------------------
  // Scene 4 — フワッ
  // -------------------------------------------------------------------------

  private upBathDrop(dt: number) {
    const sec = this.section;
    if (!sec) return;
    const p = this.input.p;
    const bathY = this.lab.bath.surfaceY;
    sec.mesh.quaternion.slerp(_flat, Math.min(1, dt * 2.0));

    if (p.justDown && this.distToScreen(sec.mesh.position) < 150 && !this.movers[1].running) {
      this.grabbing = 'section';
      this.grabLift = 0;
    }
    if (this.grabbing === 'section') {
      this.grabLift = damp(this.grabLift, 58, 9, dt);
      const hit = this.pointOnY(bathY + 0.22, this.grabLift, _v2);
      sec.mesh.position.lerp(hit, Math.min(1, dt * 20));
      if (p.justUp) {
        this.grabbing = 'none';
        const bx = STATION.bath.x, half = BATH_SIZE * 0.5 - 0.16;
        const inside = Math.abs(sec.mesh.position.x - bx) < half && Math.abs(sec.mesh.position.z) < half;
        const dest = inside
          ? new THREE.Vector3(sec.mesh.position.x, bathY + 0.006, sec.mesh.position.z)
          // released off the bath: the game walks it back in, it never falls
          : new THREE.Vector3(bx, bathY + 0.006, 0);
        this.movers[1].go(sec.mesh, dest, new THREE.Euler(-Math.PI / 2, 0, rand(makeRng(this.clock * 1000 | 0), -0.5, 0.5)), inside ? 0.42 : 0.9, () => {
          audio.plop();
          this.lab.bath.water.rippleAtWorld(sec.mesh.position.clone(), BATH_SIZE, 1.0);
          this.rig.bump(0.3);
          sec.wet = 1;
          this.enter(Stage.BathRelax);
        });
      }
    }

    if (this.grabbing === 'none' && this.idleHint && !this.movers[1].running) {
      this.hints.showRing(_v1.set(STATION.bath.x, bathY + 0.02, 0), 0.34);
      if (this.input.idle > 3.3 && this.input.idle < 3.4) audio.hint();
    } else this.hints.hide();
  }

  private upBathRelax(dt: number) {
    const sec = this.section!;
    const p = this.input.p;
    const bathY = this.lab.bath.surfaceY;

    // the player may help it along by stroking the water; not required
    if (p.down) {
      const hit = this.pointOnY(bathY, 0, _v2);
      const bx = STATION.bath.x, half = BATH_SIZE * 0.5;
      if (Math.abs(hit.x - bx) < half && Math.abs(hit.z) < half) {
        this.stroke = clamp(this.stroke + dt * 1.4, 0, 1);
        if (Math.hypot(p.dx, p.dy) > 3 && Math.random() < 0.25) {
          this.lab.bath.water.rippleAtWorld(hit.clone(), BATH_SIZE, 0.45);
          audio.drip();
        }
      }
    } else this.stroke = damp(this.stroke, 0, 1.6, dt);

    this.relaxT += dt * (0.42 + this.stroke * 0.55);
    const m = easeOutCubic(clamp(this.relaxT));
    sec.setMorph(m);
    sec.relief = lerp(0.14, 0.02, m);
    sec.mesh.position.y = bathY + 0.006 + (1 - m) * 0.012;
    sec.mesh.rotation.z = damp(sec.mesh.rotation.z, 0, 1.4, dt);

    if (this.relaxT > 0.25 && this.relaxT < 0.28) audio.bloom();
    if (Math.random() < dt * 1.4 && this.relaxT < 1)
      this.lab.bath.water.rippleAtWorld(sec.mesh.position.clone(), BATH_SIZE, 0.3);

    if (this.idleHint && this.relaxT < 0.9) this.hints.showRing(sec.mesh.position, 0.26);
    else this.hints.hide();

    if (this.relaxT > 1.5) this.enter(Stage.Pickup);
  }

  // -------------------------------------------------------------------------
  // Scene 5 — スーッ
  // -------------------------------------------------------------------------

  private upPickup(dt: number) {
    const sec = this.section!;
    const p = this.input.p;
    const bathY = this.lab.bath.surfaceY;
    const g = this.slide.group;

    if (this.lifting) {
      this.liftT += dt;
      const k = clamp(this.liftT / 1.5);
      const e = easeInOutCubic(k);
      g.position.y = lerp(bathY - 0.16, bathY + 0.30, e);
      g.position.z = lerp(g.userData.z0 ?? 0.10, 0.34, e);
      g.rotation.z = lerp(-0.05, 0, e);
      // the section rides up on the glass
      sec.mesh.position.set(g.position.x + 0.06, g.position.y + 0.012, g.position.z);
      sec.mesh.rotation.set(-Math.PI / 2, 0, 0);
      sec.wet = lerp(1, 0.35, e);
      if (this.liftT > 0.28 && this.liftT < 0.32) this.droplets.burst(_v1.copy(g.position).setY(g.position.y - 0.02), 0.2);
      if (k >= 1) { this.enter(Stage.Dewax); this.beginCarryToDewax(); }
      return;
    }

    if (p.justDown && this.distToScreen(this.worldOf(g)) < 170) {
      this.grabbing = 'slide';
      this.grabLift = 0;
      g.userData.startY = p.y;
    }
    if (this.grabbing === 'slide') {
      this.grabLift = damp(this.grabLift, 46, 9, dt);
      const hit = this.pointOnY(bathY - 0.16, this.grabLift, _v2);
      const bx = STATION.bath.x, half = BATH_SIZE * 0.5 - 0.1;
      g.position.x = damp(g.position.x, clamp(hit.x, bx - half, bx + half), 18, dt);
      g.position.z = damp(g.position.z, clamp(hit.z, -half, half), 18, dt);
      g.position.y = bathY - 0.16;

      // upward swipe lifts the slide out
      const swipe = (g.userData.startY ?? p.y) - p.y;
      if (swipe > 46) {
        this.grabbing = 'none';
        this.lifting = true;
        this.liftT = 0;
        g.userData.z0 = g.position.z;
        audio.sweep();
        this.lab.bath.water.rippleAtWorld(_v1.copy(g.position).setY(bathY), BATH_SIZE, 0.8);
        // whatever the alignment, the section ends up nicely on the glass
        sec.mesh.position.x = g.position.x + 0.06;
        sec.mesh.position.z = g.position.z;
      }
      if (p.justUp) this.grabbing = 'none';
    }

    if (this.grabbing === 'none' && this.idleHint) {
      this.hints.showArrow(this.worldOf(g).clone(), 0.30, 0, 1);
      if (this.input.idle > 3.3 && this.input.idle < 3.4) audio.hint();
    } else if (this.grabbing === 'slide') {
      this.hints.showArrow(this.worldOf(g).clone(), 0.26, 0, 1);
    } else this.hints.hide();
  }

  /** Once the section is on the glass it travels with the slide from now on. */
  private attachSectionToSlide() {
    const sec = this.section!;
    if (sec.mesh.parent === this.slide.group) return;
    this.slide.group.add(sec.mesh);
    sec.mesh.position.set(0.06, 0.010, 0);
    sec.mesh.rotation.set(-Math.PI / 2, 0, 0);
    sec.mesh.scale.setScalar(1);
  }

  private beginCarryToDewax() {
    this.attachSectionToSlide();
    const st = STATION.stain;
    this.movers[2].go(
      this.slide.group,
      new THREE.Vector3(st.x - 0.21, SLIDE_HOVER, 0.10),
      new THREE.Euler(0, 0, 0), 1.6,
    );
  }

  // -------------------------------------------------------------------------
  // Scene 6 — clearing away the wax
  // -------------------------------------------------------------------------

  private upDewax(dt: number) {
    const sec = this.section!;
    const p = this.input.p;
    const tank = this.dewaxPos(_v1).clone();
    const g = this.slide.group;

    if (this.dipT >= 0) {
      this.dipT += dt;
      const k = clamp(this.dipT / 3.6);
      const sink = this.dipPose(k, tank);
      sec.paraffin = 1 - smoothstep(0.24, 0.76, k);
      if (sink > 0.4 && Math.random() < dt * 7)
        this.wisps.emit(_v2.set(g.position.x, 0.56, g.position.z), 0.09);
      if (this.dipT > 0.5 && this.dipT < 0.55) audio.thud();
      if (Math.random() < dt * 2.2 && k > 0.2 && k < 0.8) audio.drip();
      if (k >= 1) {
        this.dipT = -1;
        sec.paraffin = 0;
        g.rotation.set(0, 0, 0);
        this.enter(Stage.Stain);
        this.movers[2].go(g, new THREE.Vector3(STATION.stain.x, SLIDE_HOVER, 0.62), null, 1.0);
      }
      return;
    }

    if (this.movers[2].running) return;

    if (p.justDown && this.distToScreen(this.worldOf(g)) < 180) { this.grabbing = 'slide'; this.grabLift = 0; }
    if (this.grabbing === 'slide') {
      this.grabLift = damp(this.grabLift, 56, 9, dt);
      const hit = this.pointOnY(SLIDE_HOVER, this.grabLift, _v2);
      g.position.x = damp(g.position.x, hit.x, 18, dt);
      g.position.z = damp(g.position.z, hit.z, 18, dt);
      g.position.y = damp(g.position.y, SLIDE_HOVER, 12, dt);
      if (p.justUp) {
        this.grabbing = 'none';
        // magnet: anywhere near the jar counts, and if it is not near, the
        // slide walks itself over rather than refusing
        const d = Math.hypot(g.position.x - tank.x, g.position.z - tank.z);
        this.movers[2].go(g, new THREE.Vector3(tank.x, SLIDE_HOVER, tank.z), new THREE.Euler(0, 0, 0),
          d < 0.4 ? 0.28 : 0.6, () => { this.dipT = 0; });
      }
    }

    if (this.grabbing === 'none' && this.idleHint) {
      this.hints.showRing(_v2.set(tank.x, 0.68, tank.z), 0.26);
      if (this.input.idle > 3.3 && this.input.idle < 3.4) audio.hint();
    } else this.hints.hide();
  }

  // -------------------------------------------------------------------------
  // Scene 7 — staining (never reveals the picture)
  // -------------------------------------------------------------------------

  private wellPos(i: number, out: THREE.Vector3) {
    const st = STATION.stain;
    const pos = [
      [st.x + 0.21, -0.21], [st.x - 0.21, 0.21], [st.x + 0.21, 0.21],
    ][i];
    return out.set(pos[0], 0.62, pos[1]);
  }

  private dewaxPos(out: THREE.Vector3) {
    return out.set(STATION.stain.x - 0.21, 0.62, -0.21);
  }

  /**
   * One dip: the slide turns upright, sinks into the jar, waits, and comes
   * back out. `k` runs 0..1 over the whole move.
   */
  private dipPose(k: number, jar: THREE.Vector3) {
    const g = this.slide.group;
    const turn = smoothstep(0, 0.18, k) * (1 - smoothstep(0.84, 1, k));
    const sink = smoothstep(0.16, 0.42, k) * (1 - smoothstep(0.68, 0.92, k));
    g.rotation.set(0, 0, -Math.PI / 2 * turn);
    g.position.x = damp(g.position.x, jar.x, 14, 0.016);
    g.position.z = damp(g.position.z, jar.z, 14, 0.016);
    g.position.y = lerp(SLIDE_HOVER, 0.44, sink);
    return sink;
  }

  private upStain(dt: number) {
    const sec = this.section!;
    const p = this.input.p;
    const g = this.slide.group;

    if (this.dipT >= 0) {
      this.dipT += dt;
      const k = clamp(this.dipT / 3.0);
      this.dipPose(k, this.wellPos(this.dipIndex, _v1));
      // the binding window: dye finding its structure, shown abstractly
      const bw = smoothstep(0.14, 0.32, k) * (1 - smoothstep(0.76, 0.94, k));
      this.binding.alpha = bw;
      this.binding.progress = smoothstep(0.2, 0.75, k);
      this.placeBindingWindow();
      if (this.dipT > 0.5 && this.dipT < 0.55) audio.thud();
      if (Math.random() < dt * 2.0 && k > 0.2 && k < 0.8) audio.drip();
      if (k >= 1) {
        const c = this.lab.stain.wellColors[this.dipIndex];
        const cur = sec.mat.uniforms.uStain.value as THREE.Vector3;
        cur.x = Math.min(0.4, cur.x + c.r * 0.13);
        cur.y = Math.min(0.4, cur.y + c.g * 0.13);
        cur.z = Math.min(0.4, cur.z + c.b * 0.13);
        this.stained[this.dipIndex] = true;
        this.dipT = -1;
        this.dipIndex = -1;
        this.binding.alpha = 0;
        g.rotation.set(0, 0, 0);
        if (this.stained.every(Boolean)) {
          this.enter(Stage.Mount);
          this.movers[2].go(g, new THREE.Vector3(STATION.stain.x, 0.09, 0.82), new THREE.Euler(0, 0, 0), 1.4);
        } else {
          this.movers[2].go(g, new THREE.Vector3(STATION.stain.x, SLIDE_HOVER, 0.62), null, 0.6);
        }
      }
      return;
    }

    if (this.movers[2].running) return;

    if (p.justDown && this.distToScreen(this.worldOf(g)) < 190) { this.grabbing = 'slide'; this.grabLift = 0; }
    if (this.grabbing === 'slide') {
      this.grabLift = damp(this.grabLift, 56, 9, dt);
      const hit = this.pointOnY(SLIDE_HOVER, this.grabLift, _v2);
      g.position.x = damp(g.position.x, hit.x, 18, dt);
      g.position.z = damp(g.position.z, hit.z, 18, dt);
      g.position.y = damp(g.position.y, SLIDE_HOVER, 12, dt);
      if (p.justUp) {
        this.grabbing = 'none';
        // pick the nearest well that still needs doing, so a sloppy release
        // always makes progress
        let best = -1, bd = 1e9;
        for (let i = 0; i < 3; i++) {
          const w = this.wellPos(i, _v1);
          const d = Math.hypot(g.position.x - w.x, g.position.z - w.z) + (this.stained[i] ? 0.7 : 0);
          if (d < bd) { bd = d; best = i; }
        }
        const w = this.wellPos(best, _v1).clone();
        this.dipIndex = best;
        this.movers[2].go(g, new THREE.Vector3(w.x, SLIDE_HOVER, w.z), new THREE.Euler(0, 0, 0),
          bd < 0.45 ? 0.28 : 0.6, () => { this.dipT = 0; });
      }
    }

    if (this.grabbing === 'none' && this.idleHint) {
      const next = this.stained.findIndex((s) => !s);
      if (next >= 0) this.hints.showRing(this.wellPos(next, _v1).clone().setY(0.68), 0.26);
      if (this.input.idle > 3.3 && this.input.idle < 3.4) audio.hint();
    } else this.hints.hide();
  }

  private placeBindingWindow() {
    // float the window beside the slide, always facing the camera
    const cam = this.rig.camera;
    const g = this.slide.group;
    this.binding.mesh.position.copy(g.position);
    this.binding.mesh.position.y += 0.34;
    this.binding.mesh.position.z += 0.16;
    this.binding.mesh.quaternion.copy(cam.quaternion);
    const s = this.portrait ? 0.62 : 0.56;
    this.binding.mesh.scale.set(s, s, 1);
    if (this.dipIndex >= 0)
      this.binding.show(this.lab.stain.wellColors[this.dipIndex], this.dipIndex);
  }

  // -------------------------------------------------------------------------
  // Scene 8 — mounting
  // -------------------------------------------------------------------------

  private upMount(dt: number) {
    const p = this.input.p;
    const g = this.slide.group;
    const dropper = this.lab.stain.dropper;
    const slideWorld = this.worldOf(g).clone();

    if (!this.dropped) {
      if (p.justDown && this.distToScreen(this.worldOf(dropper)) < 150) { this.grabbing = 'dropper'; this.grabLift = 0; }
      if (this.grabbing === 'dropper') {
        this.grabLift = damp(this.grabLift, 60, 9, dt);
        const hit = this.pointOnY(0.30, this.grabLift, _v2);
        const local = this.lab.stain.group.worldToLocal(hit.clone());
        dropper.position.x = damp(dropper.position.x, local.x, 18, dt);
        dropper.position.z = damp(dropper.position.z, local.z, 18, dt);
        dropper.position.y = damp(dropper.position.y, 0.22, 10, dt);
        const over = Math.hypot(this.worldOf(dropper).x - slideWorld.x - 0.06,
          this.worldOf(dropper).z - slideWorld.z) < 0.30;
        if (p.justUp) {
          this.grabbing = 'none';
          if (over) {
            this.dropped = true;
            audio.drip();
            this.mountant.mesh.visible = true;
            this.mountant.mat.uniforms.uSpread.value = 0.14;
            this.cover.group.visible = true;
            this.cover.group.position.copy(slideWorld).add(new THREE.Vector3(0.06, 0.30, 0.26));
            this.cover.group.rotation.set(-0.55, 0, 0);
          }
          this.movers[0].go(dropper, new THREE.Vector3(-0.26, 0, 0.86), null, 0.6);
        }
      }
      if (this.grabbing === 'none' && this.idleHint) {
        this.hints.showRing(this.worldOf(dropper).clone(), 0.20);
        if (this.input.idle > 3.3 && this.input.idle < 3.4) audio.hint();
      } else this.hints.hide();
      return;
    }

    // --- lower the cover glass
    const rest = slideWorld.clone().add(new THREE.Vector3(0.06, 0.019, 0));
    if (this.coverPlaced) {
      this.coverT += dt;
      const k = clamp(this.coverT / 1.0);
      this.mountant.mat.uniforms.uSpread.value = lerp(0.5, 1.25, easeOutCubic(k));
      this.cover.group.position.lerp(rest, Math.min(1, dt * 8));
      this.cover.group.rotation.x = damp(this.cover.group.rotation.x, 0, 8, dt);
      if (k >= 1) this.enter(Stage.DarkRoom);
      return;
    }

    if (p.justDown && this.distToScreen(this.worldOf(this.cover.group)) < 170) { this.grabbing = 'cover'; this.grabLift = 0; }
    if (this.grabbing === 'cover') {
      this.grabLift = damp(this.grabLift, 58, 9, dt);
      const hit = this.pointOnFacing(this.worldOf(this.cover.group), this.grabLift, _v2);
      this.cover.group.position.x = damp(this.cover.group.position.x, hit.x, 16, dt);
      this.cover.group.position.y = damp(this.cover.group.position.y, Math.max(rest.y, hit.y), 16, dt);
      this.cover.group.position.z = damp(this.cover.group.position.z, hit.z, 16, dt);
      // the closer it gets, the more the game straightens it out for you
      const drop = clamp(invLerp(0.30, 0.02, this.cover.group.position.y - rest.y));
      this.cover.group.rotation.x = lerp(-0.55, -0.06, drop);
      this.cover.group.position.x = lerp(this.cover.group.position.x, rest.x, drop * 0.5);
      this.cover.group.position.z = lerp(this.cover.group.position.z, rest.z, drop * 0.4);
      this.mountant.mat.uniforms.uSpread.value = lerp(0.14, 0.5, drop);
      if (drop > 0.86 || p.justUp) {
        this.grabbing = 'none';
        if (drop > 0.35) {
          this.coverPlaced = true;
          this.coverT = 0;
          audio.click(0.7);
          this.rig.bump(0.25);
        } else {
          // let go too early: it floats back to where it started, ready again
          this.movers[1].go(this.cover.group,
            rest.clone().add(new THREE.Vector3(0, 0.30, 0.26)),
            new THREE.Euler(-0.55, 0, 0), 0.5);
        }
      }
    }

    if (this.grabbing === 'none' && this.idleHint) {
      this.hints.showArrow(this.worldOf(this.cover.group).clone(), 0.24, 0, -1);
      if (this.input.idle > 3.3 && this.input.idle < 3.4) audio.hint();
    } else this.hints.hide();
  }

  // -------------------------------------------------------------------------
  // Scene 9 — the lights go down
  // -------------------------------------------------------------------------

  private upDarkRoom(dt: number) {
    void dt;
    const k = clamp(this.stageT / 2.6);
    this.setLights(1 - easeInOutCubic(k) * 0.92);
    this.lab.lights.scopePool.intensity = easeInOutCubic(k) * 2.0;
    this.lab.scope.lamp.intensity = easeInOutCubic(k) * 1.1;
    // the slide travels to the scope with the camera
    if (this.stageT > 0.5 && !this.movers[2].running && !this.slide.group.userData.movedToScope) {
      this.slide.group.userData.movedToScope = true;
      this.movers[2].go(
        this.slide.group,
        new THREE.Vector3(STATION.scope.x + 0.42, 0.92, 0.52),
        new THREE.Euler(0, 0, 0), 2.0,
      );
    }
    if (k >= 1) this.enter(Stage.ScopeMount);
  }

  private upScopeMount(dt: number) {
    const p = this.input.p;
    const g = this.slide.group;
    const slot = this.worldOf(this.lab.scope.slideSlot).clone();

    if (this.movers[2].running) return;

    if (p.justDown && this.distToScreen(this.worldOf(g)) < 190) { this.grabbing = 'slide'; this.grabLift = 0; }
    if (this.grabbing === 'slide') {
      this.grabLift = damp(this.grabLift, 56, 9, dt);
      const hit = this.pointOnY(slot.y, this.grabLift, _v2);
      g.position.x = damp(g.position.x, hit.x, 16, dt);
      g.position.z = damp(g.position.z, hit.z, 16, dt);
      g.position.y = damp(g.position.y, slot.y + 0.05, 10, dt);
      if (p.justUp) {
        this.grabbing = 'none';
        const d = g.position.distanceTo(slot);
        this.movers[2].go(g, slot, new THREE.Euler(0, 0, 0), d < 0.5 ? 0.25 : 0.6, () => {
          audio.click(1);
          this.rig.bump(0.4);
          this.enter(Stage.Focus);
        });
      }
    }

    if (this.grabbing === 'none' && this.idleHint) {
      this.hints.showRing(slot, 0.26);
      if (this.input.idle > 3.3 && this.input.idle < 3.4) audio.hint();
    } else this.hints.hide();
  }

  // -------------------------------------------------------------------------
  // Scene 10 — パッ
  // -------------------------------------------------------------------------

  private upFocus(dt: number) {
    const p = this.input.p;
    const knobWorld = this.worldOf(this.lab.scope.knob).clone();
    const ks = this.screenOf(knobWorld);

    // the optical transition: the circular field opens up in front of the lab
    const open = clamp(this.stageT / 1.8);
    this.fluoro.reveal = easeOutCubic(open);
    this.fluoro.maskR = lerp(0.05, this.portrait ? 0.40 : 0.32, easeOutCubic(open));
    const fc = this.fieldCentre;
    this.fluoro.center(fc.x, fc.y);
    this.fluoro.cover = 0;
    this.setLights(0.08);

    // クルクル : the focus knob, same gesture vocabulary as the handwheel
    const engaged = p.down;
    this.knobTracker.update(dt, engaged, p.x, p.y, ks.x, ks.y);
    this.lab.scope.knob.rotation.z = -this.knobTracker.angle;
    this.focalPos = clamp(-1 + this.knobTracker.angle * 0.10, -1.4, 1.4);

    const sharp = 1 - clamp(Math.abs(this.focalPos - this.focalBest) / 0.62);
    const focus = Math.pow(sharp, 1.35);
    this.fluoro.focus = focus;

    if (Math.abs(this.knobTracker.angle - this.lastTickAngle) > 0.34) {
      this.lastTickAngle = this.knobTracker.angle;
      if (this.knobTracker.active) audio.knob(this.knobTracker.revsPerSec);
    }

    if (focus > 0.94) this.focusHold += dt; else this.focusHold = 0;
    if (this.focusHold > 0.3) {
      this.revealT = 0;
      this.flash = 1;
      audio.pop();
      this.rig.bump(0.5);
      this.enter(Stage.Reveal);
      return;
    }

    if (this.idleHint && this.stageT > 2.2) {
      this.hints.showCircle(knobWorld, 0.34);
      if (this.input.idle > 3.3 && this.input.idle < 3.4) audio.hint();
    } else this.hints.hide();
  }

  private upReveal(dt: number) {
    const p = this.input.p;
    this.revealT += dt;
    const k = clamp(this.revealT / 1.2);

    // lock focus, then close the world down to the eyepiece
    this.fluoro.focus = lerp(0.94, 1.0, easeOutCubic(k));
    this.fluoro.cover = easeInOutCubic(clamp((this.revealT - 0.25) / 1.1));
    this.fluoro.maskR = lerp(this.portrait ? 0.40 : 0.32, this.portrait ? 0.64 : 0.58,
      easeInOutCubic(clamp((this.revealT - 0.25) / 1.4)));
    const close = easeInOutCubic(clamp((this.revealT - 0.25) / 1.4));
    const fc = this.fieldCentre;
    this.fluoro.center(lerp(fc.x, 0, close), lerp(fc.y, 0, close));

    // then walk the camera in from the whole section down to single cells
    if (this.revealT > 1.6) {
      this.zoomT = clamp(this.zoomT + dt / 7.5);
      const z = easeInOutCubic(this.zoomT);
      this.fluoro.zoom = lerp(1, 1.7, z);
      this.fluoro.nearMix = smoothstep(0.30, 0.85, this.zoomT);
      this.fluoro.pan(Math.sin(this.revealT * 0.16) * 0.012 * z, Math.cos(this.revealT * 0.13) * 0.012 * z);
    }

    // a small amount of live focus control remains, so the knob still answers
    const knobWorld = this.worldOf(this.lab.scope.knob).clone();
    const ks = this.screenOf(knobWorld);
    this.knobTracker.update(dt, p.down, p.x, p.y, ks.x, ks.y);
    if (this.knobTracker.active) {
      this.lab.scope.knob.rotation.z = -this.knobTracker.angle;
      const wobble = clamp(Math.abs(this.knobTracker.velocity) * 0.02, 0, 0.1);
      this.fluoro.focus = 1 - wobble;
      if (Math.abs(this.knobTracker.angle - this.lastTickAngle) > 0.34) {
        this.lastTickAngle = this.knobTracker.angle;
        audio.knob(this.knobTracker.revsPerSec);
      }
    }

    this.hints.hide();
    if (this.revealT > 3.4) this.onFinish?.();
  }

  // -------------------------------------------------------------------------

  /** Ground the thing in the player's hand: a soft disc on the surface below. */
  private updateCarryShadow() {
    let obj: THREE.Object3D | null = null;
    let surface = 0.0;
    let size = 0.4;
    if (this.grabbing === 'section' && this.section) {
      obj = this.section.mesh; surface = this.lab.bath.surfaceY; size = 0.34;
    } else if (this.grabbing === 'slide' && this.stage !== Stage.Pickup) {
      obj = this.slide.group; surface = this.stage === Stage.ScopeMount ? 0.03 : 0.05; size = 0.7;
    } else if (this.grabbing === 'block') {
      obj = this.lab.microtome.block; surface = 0.02; size = 0.42;
    } else if (this.grabbing === 'cover' || this.grabbing === 'dropper') {
      obj = this.grabbing === 'cover' ? this.cover.group : this.lab.stain.dropper;
      surface = 0.06; size = 0.34;
    }
    if (!obj) { this.carryShadow.hide(); return; }
    const w = this.worldOf(obj).clone();
    this.carryShadow.place(w.x, w.z, surface, Math.max(0, w.y - surface), size);
  }

  /** The slide dims and loses its edge lights when it is under water. */
  private updateSlideLook() {
    const g = this.slide.group;
    if (!g.visible) return;
    const depth = clamp((this.lab.bath.surfaceY - g.position.y) / 0.2);
    const sub = this.stage === Stage.Pickup ? depth : 0;
    this.slide.mat.uniforms.uEdge.value = lerp(1.15, 0.85, sub);
    (this.slide.mat.uniforms.uTint.value as THREE.Color).setRGB(
      lerp(0.87, 0.68, sub), lerp(0.95, 0.94, sub), lerp(1.0, 1.0, sub),
    );
  }

  /**
   * Where the player is meant to touch right now, in css pixels. Used by the
   * automated device pass to check that every target actually lands on screen
   * and clear of the safe areas, in all four orientations.
   */
  probe() {
    const out: Record<string, { x: number; y: number }> = {};
    const put = (k: string, w: THREE.Vector3) => {
      const s = this.rig.project(w, this.w, this.h, { x: 0, y: 0 });
      out[k] = { x: s.x, y: s.y };
    };
    const mt = this.lab.microtome;
    switch (this.stage) {
      case Stage.BlockMount:
        put('grab', this.worldOf(mt.block).clone());
        put('drop', this.worldOf(mt.blockGhost).clone());
        break;
      case Stage.Slicing:
        put('wheel', this.worldOf(mt.wheel).clone());
        if (this.ribbonLen >= RIBBON_READY)
          put('ribbon', this.ribbon.worldAt(Math.max(0.5, this.ribbonLen - 0.6), _v1).clone());
        break;
      case Stage.BathDrop:
        if (this.section) put('grab', this.section.mesh.position.clone());
        put('drop', _v1.set(STATION.bath.x, this.lab.bath.surfaceY, 0).clone());
        break;
      case Stage.BathRelax:
        put('stroke', _v1.set(STATION.bath.x, this.lab.bath.surfaceY, 0).clone());
        break;
      case Stage.Pickup:
      case Stage.Dewax:
      case Stage.Stain:
      case Stage.ScopeMount:
        put('grab', this.worldOf(this.slide.group).clone());
        if (this.stage === Stage.Dewax) put('drop', this.dewaxPos(_v1).clone());
        if (this.stage === Stage.Stain) {
          const next = this.stained.findIndex((s) => !s);
          if (next >= 0) put('drop', this.wellPos(next, _v1).clone());
        }
        if (this.stage === Stage.ScopeMount)
          put('drop', this.worldOf(this.lab.scope.slideSlot).clone());
        break;
      case Stage.Mount:
        put('grab', this.dropped
          ? this.worldOf(this.cover.group).clone()
          : this.worldOf(this.lab.stain.dropper).clone());
        put('drop', this.worldOf(this.slide.group).clone());
        break;
      case Stage.Focus:
      case Stage.Reveal:
        put('knob', this.worldOf(this.lab.scope.knob).clone());
        break;
      default: break;
    }
    return {
      stage: Stage[this.stage],
      stageT: this.stageT,
      ribbon: this.ribbonLen,
      morph: this.section?.morph ?? 0,
      focus: this.stage === Stage.Focus || this.stage === Stage.Reveal
        ? (this.fluoro.mat.uniforms.uFocus.value as number) : 0,
      stained: this.stained.slice(),
      targets: out,
      size: { w: this.w, h: this.h },
    };
  }

  /**
   * Development only: drop straight into one beat so a change can be seen
   * without replaying the whole chain. Stripped from production builds.
   */
  debugJump(name: string, ribbon = 6) {
    const map: Record<string, Stage> = {
      intro: Stage.Intro, block: Stage.BlockMount, slicing: Stage.Slicing,
      bath: Stage.BathDrop, relax: Stage.BathRelax, pickup: Stage.Pickup,
      dewax: Stage.Dewax, stain: Stage.Stain, mount: Stage.Mount,
      dark: Stage.DarkRoom, scopemount: Stage.ScopeMount, focus: Stage.Focus,
      reveal: Stage.Reveal,
    };
    const s = map[name];
    if (s === undefined) return;
    const mt = this.lab.microtome;
    const st = STATION;

    if (s >= Stage.Slicing) {
      mt.block.position.set(-0.04, 0, 0.02);
      mt.blockGhost.visible = false;
    }
    if (s === Stage.Slicing) {
      this.wheelTracker.reset();
      this.wheelTracker.angle = ribbon * TAU + CUT_B;
      this.completed = ribbon;
      this.ribbonLen = ribbon;
      this.ribbon.update(0.016, ribbon);
    }
    if (s >= Stage.BathDrop && !this.section) {
      const sec = new Section(this.specimen.tissue, 0.3, this.specimen.seed, this.quality);
      sec.paraffin = s >= Stage.Stain ? 0 : 1;
      sec.setMorph(s >= Stage.BathRelax ? 1 : 0);
      sec.relief = 0.14;
      this.sectionHolder.add(sec.mesh);
      this.section = sec;
      this.ribbonLen = Math.max(0, ribbon - 1);
      this.ribbon.update(0.016, this.ribbonLen);
    }
    const sec = this.section!;
    if (s === Stage.BathDrop) sec.mesh.position.set(st.bath.x, 0.95, 0.55);
    if (s === Stage.BathRelax) {
      sec.mesh.position.set(st.bath.x, this.lab.bath.surfaceY + 0.006, 0);
      sec.mesh.rotation.set(-Math.PI / 2, 0, 0);
      sec.setMorph(0); this.relaxT = 0;
    }
    if (s >= Stage.Pickup) {
      this.slide.group.visible = true;
      if (s > Stage.Pickup) this.attachSectionToSlide();
    }
    if (s === Stage.Dewax) this.slide.group.position.set(st.stain.x - 0.21, SLIDE_HOVER, 0.10);
    if (s === Stage.Stain) { this.slide.group.position.set(st.stain.x, SLIDE_HOVER, 0.62); sec.paraffin = 0; }
    if (s === Stage.Mount) {
      this.slide.group.position.set(st.stain.x, 0.09, 0.82);
      this.stained = [true, true, true];
      sec.setStain(0.12, 0.16, 0.2);
    }
    if (s >= Stage.DarkRoom) {
      this.stained = [true, true, true];
      sec.paraffin = 0;
      sec.setStain(0.12, 0.16, 0.2);
      this.cover.group.visible = true;
      this.slide.group.position.set(st.scope.x + 0.42, 0.92, 0.52);
      this.cover.group.position.copy(this.slide.group.position).add(new THREE.Vector3(0.06, 0.019, 0));
      this.mountant.mesh.visible = true;
      this.mountant.mat.uniforms.uSpread.value = 1.25;
      this.dropped = true; this.coverPlaced = true;
    }
    if (s >= Stage.ScopeMount) {
      this.setLights(0.08);
      this.lab.lights.scopePool.intensity = 2.0;
      this.lab.scope.lamp.intensity = 1.1;
    }
    if (s >= Stage.Focus) {
      const slot = this.worldOf(this.lab.scope.slideSlot).clone();
      this.slide.group.position.copy(slot);
      this.cover.group.position.copy(slot).add(new THREE.Vector3(0.06, 0.019, 0));
      this.slide.group.userData.movedToScope = true;
    }
    if (s === Stage.Reveal) { this.revealT = 0; this.knobTracker.angle = (this.focalBest + 1) / 0.10; }
    this.enter(s);
    if (s === Stage.Slicing) this.rig.snap(this.slicingShot());
    else if (s !== Stage.Intro) this.rig.snap(this.shot(SHOT_OF[s]));
  }

  requestRestart() { this.restartRequested = true; }
  get finished() { return this.stage === Stage.Reveal && this.revealT > 3.4; }
  get specimenLabel() { return this.specimen.label; }

  dispose() {
    this.ribbon.dispose();
    this.fluoro.dispose();
    this.section?.dispose();
    this.hints.dispose();
    this.binding.dispose();
    this.wisps.dispose();
    this.droplets.dispose();
    this.mountant.mat.dispose();
    this.carryShadow.dispose();
    this.specimen.dispose();
    this.lab.dispose();
  }
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _n = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _plane = new THREE.Plane();
const _flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
