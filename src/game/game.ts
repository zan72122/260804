import { Rail, TRACK_LENGTH } from './rail';
import { Phase, canGo } from './states';
import { SparkSystem } from './sparks';
import { AudioEngine } from './audio';
import {
  Settings,
  loadSettings,
  saveSettings,
  loadProgress,
  saveProgress,
  Progress,
} from './settings';
import { computeLayout, Layout, Insets, inRect, rectCenter, Rect } from './layout';
import { makeProjection, Projection } from './project';

export const CAR_LENGTH = 8;
/** Grinding unit positions relative to the car front (metres). */
export const UNIT_OFFSETS = [-2.6, -4.9];
const WHEEL_OFFSETS = [-1.1, -6.9];
const CAR_START = 8;
const CAR_MAX = 56;
const ARRIVE_FROM = 46;
const ARRIVE_FROM_SHORT = 32;
export const TRAIN_LENGTH = 6;
const TRAIN_WHEELS = [-0.8, -5.2];
const SCAN_START = 2;
const SCAN_END = 54;
const SCAN_SPEED = 16;
const HINT_DELAY = 4;

type DragMode = 'none' | 'unit' | 'lever' | 'drive' | 'train';

export interface Hint {
  kind: 'tap' | 'swipe';
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface TrainState {
  pos: number;
  speed: number;
  launched: boolean;
  bob: number;
}

/**
 * The whole vertical-slice game. DOM-free: rendering and event wiring live
 * outside; tests can drive it headlessly.
 */
export class Game {
  phase: Phase = 'title';
  phaseTime = 0;
  phaseLog: Phase[] = ['title'];

  seed: number;
  rail: Rail;
  beforeHeights: Float32Array | null = null;

  // scanning
  scanActive = false;
  scanPos = -100;
  scanMode: 'before' | 'after' = 'before';
  revealFront = -100;
  revealedBefore = false;
  afterScanDone = false;
  private blipCooldown = 0;

  // grinder car
  carPos = ARRIVE_FROM;
  carSpeed = 0;
  targetSpeed = 0;
  unitsDocked: [boolean, boolean] = [false, false];
  dragUnitIndex = -1;
  dragPos: { x: number; y: number } | null = null;
  leverProgress = 0;
  leverStage = 0; // 0 up, 1 mid, 2 contact, 3 locked
  locked = false;
  spin = 0;
  unitDrop = 0; // 0 raised .. 1 on rail (render)
  grindDone = false;
  private raiseT = 0;

  train: TrainState = { pos: -4, speed: 0, launched: false, bob: 0 };

  mistLevel = 0;
  private mistBoostT = 0;
  shake = 0;
  private holdT = 0;

  settings: Settings;
  settingsOpen = false;
  progress: Progress;

  readonly sparkSystem = new SparkSystem();
  readonly audio: AudioEngine;

  private dragMode: DragMode = 'none';
  private leverGrab = { startY: 0, startProgress: 0 };
  private lastLeverTick = 0;
  private drive = { lastX: 0, lastY: 0, lastT: 0 };
  private trainSwipe = 0;
  lastInputT = 0;
  clock = 0;

  viewW = 800;
  viewH = 600;
  insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private camS = ARRIVE_FROM;
  private wheelTickAt = new Map<string, number>();
  private rnd: () => number = Math.random;

  constructor(audio: AudioEngine, seed?: number) {
    this.audio = audio;
    this.settings = loadSettings();
    this.progress = loadProgress();
    this.audio.setSoft(this.settings.softSound);
    this.seed = seed ?? (this.progress.lastSeed || 1);
    this.rail = new Rail(this.seed);
    this.resetWorld(false);
  }

  // ---------------------------------------------------------------- state

  advance(to: Phase): boolean {
    if (!canGo(this.phase, to)) return false;
    this.phase = to;
    this.phaseTime = 0;
    this.phaseLog.push(to);
    if (this.phaseLog.length > 64) this.phaseLog.shift();
    this.audio.quietLoops();
    if (to === 'arrive') {
      // fresh round begins
    } else if (to === 'testRun') {
      this.train = { pos: -4, speed: 0, launched: false, bob: 0 };
      this.trainSwipe = 0;
    } else if (to === 'replay') {
      this.progress = { rounds: this.progress.rounds + 1, lastSeed: this.seed };
      saveProgress(this.progress);
    }
    return true;
  }

  private resetWorld(short: boolean): void {
    this.rail = new Rail(this.seed);
    this.beforeHeights = null;
    this.scanActive = false;
    this.scanPos = -100;
    this.revealFront = -100;
    this.revealedBefore = false;
    this.afterScanDone = false;
    this.carPos = short ? ARRIVE_FROM_SHORT : ARRIVE_FROM;
    this.carSpeed = 0;
    this.targetSpeed = 0;
    this.unitsDocked = [false, false];
    this.dragUnitIndex = -1;
    this.dragPos = null;
    this.leverProgress = 0;
    this.leverStage = 0;
    this.locked = false;
    this.spin = 0;
    this.unitDrop = 0;
    this.grindDone = false;
    this.raiseT = 0;
    this.train = { pos: -4, speed: 0, launched: false, bob: 0 };
    this.mistLevel = 0;
    this.mistBoostT = 0;
    this.sparkSystem.clear();
    this.dragMode = 'none';
    this.wheelTickAt.clear();
    this.camS = this.carPos;
  }

  /** Replay choice. keepTrack=true → identical corrugation; else a new one. */
  chooseReplay(keepTrack: boolean): void {
    if (this.phase !== 'replay') return;
    if (!keepTrack) {
      this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0 || 1;
    }
    this.resetWorld(true);
    this.advance('arrive');
  }

  // ---------------------------------------------------------------- layout

  layout(): Layout {
    return computeLayout(this.viewW, this.viewH, this.insets);
  }

  projection(): Projection {
    const portrait = this.viewH >= this.viewW;
    const cam = portrait ? this.camS - 14 : this.camS;
    return makeProjection(this.viewW, this.viewH, this.insets.top, cam);
  }

  setViewport(w: number, h: number, insets: Insets): void {
    this.viewW = w;
    this.viewH = h;
    this.insets = insets;
    this.cancelPointer(); // mid-gesture rotation: drop the gesture safely
  }

  private cameraFocus(): number {
    switch (this.phase) {
      case 'title':
        return 16;
      case 'arrive':
      case 'prepUnits':
      case 'lower':
        return this.carPos - 4;
      case 'scanBefore':
      case 'scanAfter':
        // portrait: stay with the car and watch the laser recede into depth
        if (this.viewH >= this.viewW) return this.carPos - 4;
        return this.scanActive ? this.scanPos : this.carPos - 4;
      case 'grind':
        return this.carPos - 3;
      case 'testRun':
        return this.train.pos + 2; // keep the waiting train in view in both projections
      case 'replay':
        return this.camS;
    }
  }

  /**
   * Screen-space rects for the two unit sockets (one per rail).
   * Portrait shows them on the car's visible rear-face lower corners so the
   * magnetic snap is never hidden behind the body.
   */
  socketRect(i: number, proj?: Projection): Rect {
    const pr = proj ?? this.projection();
    const p = pr.portrait
      ? pr.toScreen(this.carPos - CAR_LENGTH + 0.3, 0.55, i === 0 ? -0.95 : 0.95)
      : pr.toScreen(this.carPos + UNIT_OFFSETS[i], 0.55, i === 0 ? -0.75 : 0.75);
    const size = 88;
    return { x: p.x - size / 2, y: p.y - size / 2, w: size, h: size };
  }

  trainRect(proj?: Projection): Rect {
    const p = (proj ?? this.projection()).toScreen(this.train.pos - TRAIN_LENGTH / 2, 0.8, 0);
    const size = Math.max(120, Math.min(this.viewW, this.viewH) * 0.3);
    return { x: p.x - size / 2, y: p.y - size / 2, w: size, h: size };
  }

  // ---------------------------------------------------------------- update

  update(dt: number): void {
    this.clock += dt;
    if (this.settingsOpen) return; // world pauses under the settings overlay
    this.phaseTime += dt;
    this.shake *= Math.exp(-6 * dt);

    // camera easing
    const focus = this.cameraFocus();
    this.camS += (focus - this.camS) * Math.min(1, dt * 3.5);

    switch (this.phase) {
      case 'arrive':
        this.updateArrive(dt);
        break;
      case 'scanBefore':
      case 'scanAfter':
        this.updateScan(dt);
        break;
      case 'prepUnits':
        if (this.unitsDocked[0] && this.unitsDocked[1] && this.phaseTime > 0.7) {
          if (this.dragMode === 'unit') this.dragMode = 'none';
          this.advance('lower');
        }
        break;
      case 'lower':
        this.updateLever(dt);
        break;
      case 'grind':
        this.updateGrind(dt);
        break;
      case 'testRun':
        this.updateTrain(dt);
        break;
      case 'title':
      case 'replay':
        break;
    }

    // particles always simulate (they die out naturally on phase change)
    const grinding = this.phase === 'grind' && !this.grindDone;
    const intensity = grinding ? this.grindIntensity() : 0;
    const autoMist = intensity > 0.05 ? 0.45 : 0;
    this.mistBoostT = Math.max(0, this.mistBoostT - dt);
    this.mistLevel = Math.max(autoMist, this.mistBoostT > 0 ? 1 : 0) * (grinding ? 1 : 0);
    const particleScale = this.settings.softMotion ? 0.5 : 1;
    this.sparkSystem.update(dt, intensity * particleScale, this.carSpeed, this.mistLevel * particleScale, this.rnd);

    this.audio.setGrind(intensity, Math.min(1, this.carSpeed / 3));
    this.audio.setMist(this.mistLevel);
  }

  private updateArrive(dt: number): void {
    if (this.carPos > CAR_START) {
      this.carSpeed = Math.min(8, Math.max(1.4, (this.carPos - CAR_START) * 0.9));
      this.carPos -= this.carSpeed * dt;
      this.wheelNoise('car', WHEEL_OFFSETS.map((o) => this.carPos + o), dt);
      if (this.carPos <= CAR_START) {
        this.carPos = CAR_START;
        this.carSpeed = 0;
      }
    } else if (this.phaseTime > 0.5 && this.carSpeed === 0) {
      this.advance('scanBefore');
    }
  }

  private updateScan(dt: number): void {
    if (!this.scanActive) {
      // after the sweep finished, dwell a moment then move on
      if (this.phase === 'scanBefore' && this.revealedBefore && this.phaseTime > 0.6) {
        this.advance('prepUnits');
      }
      if (this.phase === 'scanAfter' && this.afterScanDone && this.phaseTime > 1.2) {
        this.advance('testRun');
      }
      return;
    }
    this.scanPos += SCAN_SPEED * dt;
    this.revealFront = Math.max(this.revealFront, this.scanPos);
    this.blipCooldown -= dt;
    const h = Math.abs(this.rail.heightAt(this.scanPos));
    if (h > 0.35 && this.blipCooldown <= 0) {
      this.audio.scanBlip(Math.min(1, h / 1.3));
      this.blipCooldown = 0.11;
    }
    if (this.scanPos >= SCAN_END) {
      this.scanActive = false;
      this.phaseTime = 0;
      if (this.phase === 'scanBefore') {
        this.revealedBefore = true;
        this.beforeHeights = this.rail.snapshotHeights();
      } else {
        this.afterScanDone = true;
        this.audio.chime();
      }
    }
  }

  private updateLever(dt: number): void {
    // unit drop animation follows lever stages
    const target = this.leverStage >= 3 ? 1 : this.leverStage === 2 ? 0.92 : this.leverStage === 1 ? 0.55 : this.leverProgress * 0.4;
    this.unitDrop += (target - this.unitDrop) * Math.min(1, dt * 8);
    if (this.dragMode !== 'lever' && !this.locked && this.leverProgress > 0) {
      // released early: past the stage-2 clunk counts as intent → auto-complete
      if (this.leverProgress >= 0.62) {
        this.setLeverProgress(Math.min(1, this.leverProgress + dt * 2.2));
      } else {
        this.leverProgress = Math.max(0, this.leverProgress - dt * 1.6);
        if (this.leverProgress < 0.3 && this.leverStage > 0) {
          this.leverStage = 0;
          this.audio.servo(false);
        }
      }
    }
    if (this.locked) {
      this.spin = Math.min(1, this.spin + dt * 1.4);
      if (this.spin >= 1 && this.phaseTime > 0.4) this.advance('grind');
    }
  }

  private grindIntensity(): number {
    if (!this.locked || this.spin < 0.8) return 0;
    // sample the untouched rail just AHEAD of the leading stone — the stones
    // flatten everything under them, so sampling there would always read 0
    const rough = Math.max(
      Math.abs(this.rail.heightAt(this.carPos - 1.4)),
      Math.abs(this.rail.heightAt(this.carPos - 1.05)),
      Math.abs(this.rail.heightAt(this.carPos - 0.7))
    );
    const speedF = Math.min(1, this.carSpeed / 2.6);
    return speedF > 0.02 ? speedF * (0.35 + 0.65 * Math.min(1, rough / 1.1)) : 0;
  }

  private updateGrind(dt: number): void {
    if (this.grindDone) {
      // automatic raise sequence, then measure again
      this.raiseT += dt;
      this.leverProgress = Math.max(0, this.leverProgress - dt * 1.2);
      this.unitDrop = Math.max(0, this.unitDrop - dt * 1.1);
      this.spin = Math.max(0, this.spin - dt * 1.6);
      this.carSpeed = Math.max(0, this.carSpeed - dt * 3);
      if (this.raiseT > 1.3) this.advance('scanAfter');
      return;
    }
    if (this.dragMode === 'drive') {
      this.holdT += dt;
      if (this.holdT > 0.25 && this.targetSpeed < 0.8) this.targetSpeed = 0.8; // press & hold creeps
    } else {
      this.targetSpeed = 0;
    }
    const accel = this.targetSpeed > this.carSpeed ? 5 : 3;
    this.carSpeed += Math.sign(this.targetSpeed - this.carSpeed) * accel * dt;
    this.carSpeed = Math.max(0, Math.min(3.4, this.carSpeed));
    const ds = this.carSpeed * dt;
    if (ds > 0) {
      this.carPos = Math.min(CAR_MAX, this.carPos + ds);
      for (const off of UNIT_OFFSETS) this.rail.grindAt(this.carPos + off, ds);
      this.shake = Math.max(this.shake, 1.2 * this.grindIntensity());
    }
    const rearUnit = this.carPos + UNIT_OFFSETS[1];
    if (rearUnit > this.rail.zone.end + 1.5) {
      this.grindDone = true;
      this.audio.servo(false);
      this.dragMode = 'none';
      this.targetSpeed = 0;
    }
  }

  private updateTrain(dt: number): void {
    // the grinder clears the possession before the test train runs
    if (this.carPos < 85) this.carPos += 6 * dt;
    const t = this.train;
    if (!t.launched) {
      t.bob = Math.sin(this.phaseTime * 3) * 0.5;
      return;
    }
    t.speed = Math.min(8.5, t.speed + dt * 5);
    t.pos += t.speed * dt;
    this.wheelNoise('train', TRAIN_WHEELS.map((o) => t.pos + o), dt);
    // quiet whoosh only exists because the rail is now smooth
    const clean = Math.max(0, 1 - this.rail.rmsInZone() / 0.4);
    this.audio.setWhoosh((t.speed / 8.5) * clean);
    t.bob *= Math.exp(-3 * dt);
    if (t.pos > TRACK_LENGTH + 8) {
      this.audio.setWhoosh(0);
      if (this.phaseTime > 0.5) this.advance('replay');
    }
  }

  /** Periodic gata-gata ticks + shake when wheels cross corrugation. */
  private wheelNoise(id: string, wheelPositions: number[], _dt: number): void {
    for (let k = 0; k < wheelPositions.length; k++) {
      const key = `${id}${k}`;
      const pos = wheelPositions[k];
      const last = this.wheelTickAt.get(key);
      if (last === undefined) {
        this.wheelTickAt.set(key, pos);
        continue;
      }
      if (Math.abs(pos - last) >= 0.5) {
        this.wheelTickAt.set(key, pos);
        const h = Math.abs(this.rail.heightAt(pos));
        if (h > 0.22) {
          this.audio.gataTick(Math.min(1, h / 1.1));
          const kick = Math.min(1, h) * (this.settings.softMotion ? 1.2 : 3);
          this.shake = Math.max(this.shake, kick);
          if (id === 'train') this.train.bob = Math.min(1.6, this.train.bob + h * 0.9);
        }
      }
    }
  }

  // ---------------------------------------------------------------- input

  pointerDown(x: number, y: number): void {
    this.lastInputT = this.clock;
    const L = this.layout();
    if (this.settingsOpen) {
      if (inRect(L.toggleLight, x, y, 10)) this.toggleSetting('softLight');
      else if (inRect(L.toggleMotion, x, y, 10)) this.toggleSetting('softMotion');
      else if (inRect(L.toggleSound, x, y, 10)) this.toggleSetting('softSound');
      else if (inRect(L.closeSettings, x, y, 14) || inRect(L.gear, x, y, 6)) {
        this.settingsOpen = false; // the gear closes it too
      }
      return;
    }
    if (inRect(L.gear, x, y, 6)) {
      this.settingsOpen = true;
      this.audio.quietLoops();
      this.cancelPointer();
      return;
    }
    switch (this.phase) {
      case 'title':
        if (inRect(L.play, x, y, 30)) this.advance('arrive');
        break;
      case 'arrive':
        this.carPos = CAR_START; // impatient tap skips the roll-in
        this.carSpeed = 0;
        break;
      case 'scanBefore':
      case 'scanAfter':
        if (!this.scanActive && inRect(L.scan, x, y, 26) && !this.scanDoneForPhase()) {
          this.scanActive = true;
          this.scanMode = this.phase === 'scanBefore' ? 'before' : 'after';
          this.scanPos = SCAN_START;
          if (this.phase === 'scanAfter') this.revealFront = SCAN_START;
          this.audio.scanSweep();
        }
        break;
      case 'prepUnits': {
        const proj = this.projection();
        for (let i = 0; i < 2; i++) {
          if (this.unitsDocked[i]) continue;
          const tray = i === 0 ? L.tray0 : L.tray1;
          if (inRect(tray, x, y, 30)) {
            this.dragMode = 'unit';
            this.dragUnitIndex = i;
            this.dragPos = { x, y };
            return;
          }
          // also allow grabbing straight from the socket ghost
          if (inRect(this.socketRect(i, proj), x, y, 20)) {
            this.dragMode = 'unit';
            this.dragUnitIndex = i;
            this.dragPos = { x, y };
            return;
          }
        }
        break;
      }
      case 'lower':
        if (!this.locked && inRect(L.lever, x, y, 50)) {
          this.dragMode = 'lever';
          this.leverGrab = { startY: y, startProgress: this.leverProgress };
        }
        break;
      case 'grind':
        if (this.grindDone) break;
        if (inRect(L.mist, x, y, 14)) {
          this.mistBoostT = 1.5;
          this.audio.setMist(1);
          break;
        }
        this.dragMode = 'drive';
        this.holdT = 0;
        this.drive = { lastX: x, lastY: y, lastT: this.clock };
        break;
      case 'testRun':
        if (!this.train.launched) {
          this.dragMode = 'train';
          this.trainSwipe = 0;
          this.drive = { lastX: x, lastY: y, lastT: this.clock };
          if (inRect(this.trainRect(), x, y, 20)) this.launchTrain();
        }
        break;
      case 'replay':
        if (inRect(L.replaySame, x, y, 10)) this.chooseReplay(true);
        else if (inRect(L.replayNew, x, y, 10)) this.chooseReplay(false);
        break;
    }
  }

  pointerMove(x: number, y: number): void {
    this.lastInputT = this.clock;
    const L = this.layout();
    switch (this.dragMode) {
      case 'unit': {
        this.dragPos = { x, y };
        const proj = this.projection();
        const i = this.dragUnitIndex;
        if (i >= 0) {
          // dock only when the finger actually reaches the socket (still a
          // generous ~112px square) — proximity alone snapped from too far
          if (inRect(this.socketRect(i, proj), x, y, 12)) this.dockUnit(i);
        }
        break;
      }
      case 'lever': {
        const travel = L.lever.h * 0.72;
        const p = Math.min(1, Math.max(0, this.leverGrab.startProgress + (y - this.leverGrab.startY) / travel));
        this.setLeverProgress(p);
        break;
      }
      case 'drive': {
        const now = this.clock;
        const dtE = Math.max(0.008, now - this.drive.lastT);
        const forward = this.viewH >= this.viewW ? this.drive.lastY - y : x - this.drive.lastX;
        const v = forward / dtE; // px/s, negative when swiping backwards
        this.targetSpeed = Math.max(0, Math.min(3.4, v / 150));
        if (Math.abs(forward) > 2) this.holdT = 0;
        this.drive = { lastX: x, lastY: y, lastT: now };
        break;
      }
      case 'train': {
        const forward = this.viewH >= this.viewW ? this.drive.lastY - y : x - this.drive.lastX;
        this.trainSwipe += forward;
        if (this.trainSwipe > 40) this.launchTrain();
        break;
      }
      case 'none':
        break;
    }
  }

  pointerUp(_x: number, _y: number): void {
    this.lastInputT = this.clock;
    if (this.dragMode === 'unit') {
      this.dragPos = null;
      this.dragUnitIndex = -1;
    }
    if (this.dragMode === 'drive') this.targetSpeed = 0;
    this.dragMode = 'none';
  }

  cancelPointer(): void {
    if (this.dragMode === 'unit') {
      this.dragPos = null;
      this.dragUnitIndex = -1;
    }
    if (this.dragMode === 'drive') this.targetSpeed = 0;
    this.dragMode = 'none';
  }

  private scanDoneForPhase(): boolean {
    return this.phase === 'scanBefore' ? this.revealedBefore : this.afterScanDone;
  }

  private dockUnit(i: number): void {
    if (this.unitsDocked[i]) return;
    this.unitsDocked[i] = true;
    this.dragMode = 'none';
    this.dragPos = null;
    this.dragUnitIndex = -1;
    this.audio.snap();
    this.shake = Math.max(this.shake, 1.2);
  }

  private setLeverProgress(p: number): void {
    const prev = this.leverProgress;
    this.leverProgress = p;
    if (Math.abs(p - this.lastLeverTick) > 0.09) {
      this.lastLeverTick = p;
      this.audio.ratchet();
    }
    if (this.leverStage < 1 && p >= 0.33 && prev < 0.33) {
      this.leverStage = 1;
      this.audio.servo(true);
    }
    if (this.leverStage < 2 && p >= 0.66) {
      this.leverStage = 2;
      this.audio.clunk();
      this.shake = Math.max(this.shake, 1.6);
    }
    if (!this.locked && p >= 0.97) {
      this.leverStage = 3;
      this.locked = true;
      this.leverProgress = 1;
      this.audio.gakon();
      this.shake = Math.max(this.shake, this.settings.softMotion ? 2 : 5);
      this.dragMode = 'none';
    }
  }

  private launchTrain(): void {
    if (this.train.launched) return;
    this.train.launched = true;
    this.dragMode = 'none';
  }

  private toggleSetting(key: keyof Settings): void {
    this.settings = { ...this.settings, [key]: !this.settings[key] };
    saveSettings(this.settings);
    this.audio.setSoft(this.settings.softSound);
  }

  // ---------------------------------------------------------------- hints

  /** Non-verbal hint after a few seconds of no input. Null while active. */
  currentHint(): Hint | null {
    if (this.settingsOpen) return null;
    if (this.clock - this.lastInputT < HINT_DELAY) return null;
    const L = this.layout();
    const portrait = this.viewH >= this.viewW;
    const fwd = (from: { x: number; y: number }): Hint => ({
      kind: 'swipe',
      from,
      to: portrait ? { x: from.x, y: from.y - 150 } : { x: from.x + 170, y: from.y },
    });
    switch (this.phase) {
      case 'title':
        return { kind: 'tap', from: rectCenter(L.play), to: rectCenter(L.play) };
      case 'scanBefore':
      case 'scanAfter':
        if (this.scanActive || this.scanDoneForPhase()) return null;
        return { kind: 'tap', from: rectCenter(L.scan), to: rectCenter(L.scan) };
      case 'prepUnits': {
        const i = this.unitsDocked[0] ? (this.unitsDocked[1] ? -1 : 1) : 0;
        if (i < 0) return null;
        const tray = i === 0 ? L.tray0 : L.tray1;
        return { kind: 'swipe', from: rectCenter(tray), to: rectCenter(this.socketRect(i)) };
      }
      case 'lower': {
        if (this.locked) return null;
        const c = rectCenter(L.lever);
        return { kind: 'swipe', from: { x: c.x, y: L.lever.y + 30 }, to: { x: c.x, y: L.lever.y + L.lever.h - 26 } };
      }
      case 'grind':
        if (this.grindDone || this.carSpeed > 0.2) return null;
        return fwd({ x: this.viewW / 2, y: this.viewH * (portrait ? 0.62 : 0.5) });
      case 'testRun':
        if (this.train.launched) return null;
        return fwd({ x: this.viewW / 2, y: this.viewH * (portrait ? 0.62 : 0.5) });
      case 'replay':
        return { kind: 'tap', from: rectCenter(L.replaySame), to: rectCenter(L.replaySame) };
      case 'arrive':
        return null;
    }
  }

  // ---------------------------------------------------------------- test observability

  sparkCount(): number {
    return this.sparkSystem.sparks.count();
  }
}
