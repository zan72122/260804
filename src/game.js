// The play scene: framing, input, the grab state machine and the "hero moment"
// choreography.
//
// Sequence: intro -> aim -> open -> descend -> touch -> close -> settle ->
// [regrip] -> lift -> carry -> teeter? -> release -> fall -> won -> (aim).
// Every beat length comes from contracts.js's BEAT table so the pile, the
// drama director and this file cannot drift apart. The rule the whole
// machine is built around: there is no beat in which nothing is moving, and
// a caught toy always hangs from the exact point the fingers closed on,
// rotating around that pinned point rather than floating from its centre.

import * as THREE from '../vendor/three/three.module.min.js';
import { CAB, buildCabinet, buildBackdrop } from './cabinet.js';
import { Claw } from './claw.js';
import { Pile } from './pile.js';
import { Drama, forceDrag } from './drama.js';
import { SLIP_HOLD, MIN_DRAMA, BEAT, PILE, CHUTE } from './contracts.js';
import { softBlob } from './textures.js';
import { clamp, damp, lerp, easeInOutCubic, easeOutCubic, makeRng, smoothstep } from './util.js';

/* aim / capture tuning — the invisible kindness lives here */
const CAPTURE_DIST = 0.50;   // aim-assist "close enough" band
const ATTACH_DIST = 0.74;    // within this the claw always gets a grip on *something*;
                              // whether it holds is choice.hold's job now, not distance
const PUSH_DIST = 1.25;      // beyond ATTACH_DIST but within this: a miss that still shoves
const ASSIST_PULL_NEAR = 0.63; // silently pulled into the win band
const ASSIST_PULL_FAR = 0.95;

const GRAVITY = -9.2;

export class Game {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {import('./audio.js').GameAudio} audio
   */
  constructor(renderer, audio, { quality = 1 } = {}) {
    this.renderer = renderer;
    this.audio = audio;
    this.quality = quality;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);

    this.cabinet = buildCabinet(this.scene, { quality });
    this.backdrop = buildBackdrop(this.scene, { quality });
    this.claw = new Claw(this.scene);
    this.pile = new Pile(this.scene, { quality });
    this.pile.onSoftHit = (b, s) => this.audio.softTouch(s * 0.7);

    // radial reach of an open finger from the claw's vertical axis, derived
    // from the same joint offsets/angles claw.js builds its OPEN pose from
    // (not guessed — see _deriveClawReach)
    this.clawReach = this._deriveClawReach();

    // the drama director: decides what a body gets caught by and whether a
    // grab earned its keep. Guarded so a not-yet-landed drama.js cannot take
    // the whole scene down with it.
    try {
      this.drama = new Drama(this.pile);
    } catch (e) {
      this.drama = { begin() {}, evaluate: () => ({ score: MIN_DRAMA, events: [], maxMove: 0, maxRotDeg: 0, neighbours: 0 }) };
    }

    this._lights(quality);
    this._aimMarker();
    this._contactRing();

    /* ---- state ---- */
    this.state = 'intro';
    this.stateT = 0;
    this.aim = new THREE.Vector2(0, 0);
    this.held = null;          // Body currently in the claw
    this.pending = null;       // outcome of the current grab
    this.hasInteracted = false;
    this.roundSeed = (Math.random() * 1e9) | 0;
    this.pileCount = PILE.count;

    this.pendulum = { x: 0, z: 0, vx: 0, vz: 0 };
    this.hero = 0;             // 0 = wide, 1 = hero close-up
    this.heroTarget = new THREE.Vector3();
    this.binFocus = 0;
    this._camPos = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();
    this._grip = new THREE.Vector3();
    this._tmpV = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
    this._prevClawVel = new THREE.Vector3();
    this._touchStart = { x: 0, z: 0 };

    // grab-point hang state (see _attach / _computeHangQuat / _updateHeld)
    this.grabChoice = null;
    this.grabStartQuat = new THREE.Quaternion();
    this.hangQuat = new THREE.Quaternion();
    this.hangBlend = 1;
    this.hangBlendDur = 0.2;
    this.gripClose = 0.58;

    // per-grab director bookkeeping
    this.regripped = false;
    this.lastEval = null;
    this.chuteResult = null;
    this.teeterBody = null;
    this.carrySwingPeak = 0;
    this.lastGrab = null;
    this.dramaLog = [];        // last ~50 entries, oldest first

    this.onWin = null;         // ({species, variant, fromPos, fromQuat}) => void
    this.onStateChange = null;
    this.framing = {
      fov: 44, dist: 8, portrait: true,
      dir: new THREE.Vector3(0.21, 0.36, 0.91).normalize(),
      target: new THREE.Vector3(0, 0.6, 0),
    };

    this.newRound(true);
  }

  /* ------------------------------------------------------------------ */
  /* setup                                                               */
  /* ------------------------------------------------------------------ */

  _lights(quality) {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xffeedd, 0x3a3550, 0.42));

    const key = new THREE.DirectionalLight(0xfff3e2, 1.35);
    key.position.set(2.6, 5.0, 3.2);
    key.castShadow = quality > 0.35;
    if (key.castShadow) {
      const size = quality > 0.75 ? 1024 : 512;
      key.shadow.mapSize.set(size, size);
      const c = key.shadow.camera;
      c.left = -2.2; c.right = 2.2; c.top = 3.4; c.bottom = -2.4;
      c.near = 1.5; c.far = 14;
      key.shadow.bias = -0.0012;
      key.shadow.normalBias = 0.02;
      key.shadow.radius = 2.2;
    }
    s.add(key);
    this.keyLight = key;

    const rim = new THREE.DirectionalLight(0x9fc8ff, 0.45);
    rim.position.set(-3.2, 2.4, -2.6);
    s.add(rim);

    // inside-the-showcase practicals: what makes the plush read as lit merchandise
    const p1 = new THREE.PointLight(0xffe9cf, 1.5, 4.0, 2);
    p1.position.set(0, CAB.ceilY - 0.18, 0.1);
    s.add(p1);
    const p2 = new THREE.PointLight(0xffb8d8, 0.7, 2.8, 2);
    p2.position.set(-0.85, CAB.ceilY - 0.3, 0.55);
    s.add(p2);
    const p3 = new THREE.PointLight(0xa8d8ff, 0.65, 2.8, 2);
    p3.position.set(0.9, CAB.ceilY - 0.3, -0.4);
    s.add(p3);
  }

  _aimMarker() {
    const g = new THREE.Group();
    this.scene.add(g);
    this.marker = g;

    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshBasicMaterial({ map: softBlob('120,40,80', 0.5), transparent: true, depthWrite: false, opacity: 0.85 })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.006;
    g.add(blob);
    this.markerBlob = blob;

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffe89a, transparent: true, opacity: 0.95, depthWrite: false,
      depthTest: false, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.235, 32), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    ring.renderOrder = 20;
    g.add(ring);
    this.markerRing = ring;

    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.055, 0.085, 20), ringMat.clone());
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.012;
    ring2.renderOrder = 20;
    g.add(ring2);
    this.markerDot = ring2;

  }

  _contactRing() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.15, 24), mat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    this.scene.add(m);
    this.puff = { mesh: m, t: 0, active: false };
  }

  /**
   * Radius from the claw's central Y-axis to an open fingertip, worked out
   * from claw.js's own OPEN-pose joint chain (upperPivot offset (0,-0.062,
   * 0.085) rotated -0.62 rad, a further 0.24 to the lower joint rotated
   * +0.12 rad more, then 0.27 to the tip), scaled by the head's 1.15x. Kept
   * here as real forward kinematics rather than a guessed constant so it
   * cannot silently drift from the rig if the claw's proportions change.
   */
  _deriveClawReach() {
    const rotX = (y, z, a) => ({ y: y * Math.cos(a) - z * Math.sin(a), z: y * Math.sin(a) + z * Math.cos(a) });
    const upperAngle = -0.62, lowerAngle = 0.12;
    const upper = { y: -0.062, z: 0.085 };
    const lower = rotX(-0.24, 0, upperAngle);
    const tip = rotX(-0.27, 0, upperAngle + lowerAngle);
    const z = upper.z + lower.z + tip.z;
    return Math.hypot(0, z) * 1.15;
  }

  setEnvironment(envTexture) {
    this.scene.environment = envTexture;
  }

  /* ------------------------------------------------------------------ */
  /* rounds                                                              */
  /* ------------------------------------------------------------------ */

  newRound(force = false) {
    if (!force && this.pile.bodies.length >= 5) return;
    this.roundSeed = (this.roundSeed * 1103515245 + 12345) & 0x7fffffff;
    const rng = makeRng(this.roundSeed);
    this.pile.layout(rng, { count: this.pileCount, quality: this.quality });
  }

  /* ------------------------------------------------------------------ */
  /* input                                                               */
  /* ------------------------------------------------------------------ */

  get canAim() { return this.state === 'aim'; }

  /** Convert a pointer position to a point on the aiming plane. */
  pointerToPlane(nx, ny, out = new THREE.Vector3()) {
    _ray.setFromCamera(_v2.set(nx, ny), this.camera);
    const plane = _plane.set(_up, -0.35);
    if (!_ray.ray.intersectPlane(plane, out)) return null;
    return out;
  }

  beginDrag(nx, ny) {
    const p = this.pointerToPlane(nx, ny, _dragP);
    if (!p) return false;
    this.dragOffset = { x: this.aim.x - p.x, z: this.aim.y - p.z };
    this.dragging = true;
    return true;
  }

  moveDrag(nx, ny) {
    if (!this.dragging || !this.canAim) return;
    const p = this.pointerToPlane(nx, ny, _dragP);
    if (!p) return;
    this.setAim(p.x + this.dragOffset.x, p.z + this.dragOffset.z);
    this.hasInteracted = true;
  }

  endDrag() { this.dragging = false; }

  /** Tap anywhere on the floor to send the crane there (no dragging required). */
  tapAt(nx, ny) {
    if (!this.canAim) return;
    const p = this.pointerToPlane(nx, ny, _dragP);
    if (!p) return;
    this.setAim(p.x, p.z);
    this.hasInteracted = true;
    this.audio.blip(880);
  }

  setAim(x, z) {
    this.aim.set(clamp(x, CAB.aim.minX, CAB.aim.maxX), clamp(z, CAB.aim.minZ, CAB.aim.maxZ));
  }

  /* ------------------------------------------------------------------ */
  /* grab sequence                                                       */
  /* ------------------------------------------------------------------ */

  startGrab() {
    if (this.state !== 'aim') return false;
    this.dragging = false;
    this.hasInteracted = true;
    // commit the aim now: the crane must already be heading for the spot the
    // child pointed at before the assist is measured against it
    this.claw.setAim(this.aim.x, this.aim.y);

    // ---- hidden aim assist: quietly reward "close enough" ----
    const near = this.pile.nearestTo(this.aim.x, this.aim.y, ASSIST_PULL_FAR);
    this.assistTarget = null;
    if (near) {
      const d = near.dist;
      let pull = 0;
      if (d > CAPTURE_DIST * 0.68 && d <= ASSIST_PULL_NEAR) {
        // close just enough of the gap to land inside the win band — the crane
        // creeps a few centimetres, it does not snap onto the toy
        pull = 1 - (CAPTURE_DIST * 0.68) / d;
      } else if (d > ASSIST_PULL_NEAR && d <= ASSIST_PULL_FAR) {
        pull = 0.26;                       // a near miss becomes a proper shove
      }
      if (pull > 0) {
        this.assistTarget = {
          x: lerp(this.aim.x, near.body.pos.x, pull),
          z: lerp(this.aim.y, near.body.pos.z, pull),
        };
      }
      this.descendTarget = near.body;
    } else {
      this.descendTarget = null;
    }

    this._setState('open');
    this.audio.servo(true);
    return true;
  }

  _setState(s) {
    // the drag scrape is only ever legitimate during touch/close — stopping
    // it on every other transition means it can never hang on, however the
    // state machine gets there
    if (s !== 'touch' && s !== 'close') this._stopDrag();
    this.state = s;
    this.stateT = 0;
    this.onStateChange?.(s);
  }

  _stopDrag() {
    if (typeof this.audio.stopDrag === 'function') this.audio.stopDrag();
  }

  _resolveContact() {
    const cx = this.claw.pos.x, cz = this.claw.pos.z;
    const near = this.pile.nearestTo(cx, cz, PUSH_DIST);
    this.pending = { kind: 'air', body: null };
    if (!near) return;
    const { body, dist } = near;
    if (dist <= ATTACH_DIST) this.pending = { kind: 'catch', body, dist };
    else this.pending = { kind: 'push', body, dist };
  }

  /** Ask the drama director for a grab point, falling back to a plain centre
   *  grab if drama.js hasn't landed yet or throws — never lets a missing
   *  contract module break the sequence. */
  _resolveGrab(body, gx, gz, gy) {
    try {
      const c = Drama.resolveGrabPoint(body, gx, gz, gy, this.clawReach);
      if (c) return c;
    } catch (e) { /* fall through */ }
    return { index: -1, type: 'body', hold: 1, spin: 0, local: new THREE.Vector3(0, body.radius * 0.3, 0) };
  }

  _chuteFinish(grabType, swingMag) {
    try {
      if (typeof Drama.chuteFinish === 'function') return Drama.chuteFinish(grabType, swingMag) || CHUTE.CLEAN;
    } catch (e) { /* fall through */ }
    return CHUTE.CLEAN;
  }

  /** Guarantees that a stalled grab (nothing dramatic happened even after a
   *  regrip) still drags the toy over its neighbours during the lift. */
  _forceDud(body) {
    if (!body) return;
    try {
      if (typeof forceDrag === 'function') {
        const dx = 0 - body.pos.x, dz = 0.18 - body.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        forceDrag(body, dx / d, dz / d, 1);
        return;
      }
    } catch (e) { /* fall through */ }
    // last-resort fallback if drama.js landed without forceDrag: still shove
    // the pile so the beat is never empty
    if (typeof this.pile.wakeAround === 'function') {
      this.pile.wakeAround(body.pos.x, body.pos.y, body.pos.z, body.radius * 3);
    }
  }

  /** Orientation that hangs the toy from `choice.local`: that point ends up
   *  pointing straight up (so it sits at the grip), with a partial yaw so
   *  the toy turns to face the room instead of staying however it landed. */
  _computeHangQuat(body, choice) {
    this.grabStartQuat.copy(body.quat);
    const localDir = _localDir.copy(choice.local);
    if (localDir.lengthSq() < 1e-8) localDir.set(0, 1, 0); else localDir.normalize();
    this.hangQuat.setFromUnitVectors(localDir, _UP);
    const e = _eTmp.setFromQuaternion(body.quat, 'YXZ');
    const yaw = Math.atan2(Math.sin(e.y), Math.cos(e.y));
    const faceBlend = lerp(0.35, 0.65, choice.spin);
    _faceQ.setFromAxisAngle(_UP, yaw * faceBlend);
    this.hangQuat.premultiply(_faceQ);
    // a body grab settles almost immediately; an ear grab visibly swings the
    // whole toy round over most of the settle beat
    this.hangBlendDur = lerp(BEAT.settle * 0.32, BEAT.settle * 1.05, choice.spin);
  }

  _attach(body, choice) {
    body.held = true;
    body.wake();
    this.held = body;
    this.grabChoice = choice;
    this.gripClose = 0.58;
    this._computeHangQuat(body, choice);
    this.hangBlend = 0;
    this.pendulum.x = 0; this.pendulum.z = 0; this.pendulum.vx = 0; this.pendulum.vz = 0;
    body.plush.setSquash(0.24);

    // the pile visibly subsides where the toy used to sit — a free, honest
    // "something big moved" on every successful grab
    if (typeof this.pile.wakeAround === 'function') {
      this.pile.wakeAround(body.pos.x, body.pos.y, body.pos.z, body.radius * 2.2);
    }
    if (typeof this.pile.refreshCoverage === 'function') this.pile.refreshCoverage();
  }

  _detach(extraVel) {
    const b = this.held;
    if (!b) return null;
    b.held = false;
    b.plush.setSquash(0);
    const grip = this.claw.gripWorld(this._grip);
    const armLen = Math.max(0.05, grip.distanceTo(b.pos));
    // hand the pendulum's swing over as real velocity
    const swingV = new THREE.Vector3(
      Math.cos(this.pendulum.z) * this.pendulum.vz * armLen,
      0,
      -Math.cos(this.pendulum.x) * this.pendulum.vx * armLen
    );
    b.vel.copy(this.claw.velocity).multiplyScalar(0.55).add(swingV);
    if (extraVel) b.vel.add(extraVel);
    b.angVel.set((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.2);
    b.wake();
    this.held = null;
    return b;
  }

  _puffAt(x, y, z, scale = 1) {
    const p = this.puff;
    p.mesh.position.set(x, y, z);
    p.baseScale = scale;
    p.mesh.scale.setScalar(scale * 0.6);
    p.mesh.visible = true;
    p.mesh.material.opacity = 0.5;
    p.t = 0;
    p.active = true;
  }

  /** The whole platform shakes when the claw hits the mat. */
  _floorJolt(x, z) {
    for (const b of this.pile.bodies) {
      if (b.held || b.inChute) continue;
      const d = Math.hypot(b.pos.x - x, b.pos.z - z);
      const k = clamp(1 - d / 1.9, 0.12, 1) * 0.42;
      b.applyImpulse(
        new THREE.Vector3((b.pos.x - x) * 0.35 * k, 0.75 * k, (b.pos.z - z) * 0.35 * k),
        new THREE.Vector3((Math.random() - 0.5) * 2.4 * k, 0, (Math.random() - 0.5) * 2.4 * k)
      );
      b.plush.impact(0.28 * k);
    }
  }

  /** Miss handling that still changes the world in a way a child can read. */
  _nudge(body, strength = 1) {
    const dx = body.pos.x - this.claw.pos.x;
    const dz = body.pos.z - this.claw.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d;
    // pushed away from the claw, tipped up, and biased toward the player /
    // the middle of the case so the next try is easier, never harder.
    const towardFrontX = (0 - body.pos.x) * 0.5;
    const towardFrontZ = (0.18 - body.pos.z) * 0.6;
    body.applyImpulse(
      new THREE.Vector3(nx * 1.05 * strength + towardFrontX, 1.5 * strength, nz * 1.05 * strength + towardFrontZ),
      new THREE.Vector3((Math.random() - 0.5) * 5.5, (Math.random() - 0.5) * 4.5, (Math.random() - 0.5) * 5.5)
    );
    body.plush.impact(0.7);
  }

  /** A light impulse to whatever is standing near (x,z) — the readable
   *  "neighbours got shoved" beat during touch, independent of exactly how
   *  pile.js's own collision response behaves. */
  _shoveNearby(x, z, radius, strength, exclude) {
    let hit = false;
    for (const b of this.pile.bodies) {
      if (b === exclude || b.held || b.inChute) continue;
      const dx = b.pos.x - x, dz = b.pos.z - z;
      const d = Math.hypot(dx, dz);
      if (d > radius || d < 1e-4) continue;
      const k = (1 - d / radius) * strength;
      b.applyImpulse(
        _tmpImp.set((dx / d) * 0.5 * k, 0.22 * k, (dz / d) * 0.5 * k),
        _tmpImp2.set((Math.random() - 0.5) * 1.2 * k, 0, (Math.random() - 0.5) * 1.2 * k)
      );
      b.plush.impact(0.3 * k);
      if (k > 0.25) hit = true;
    }
    if (hit) this.audio.topple(0.6);
  }

  /* ------------------------------------------------------------------ */
  /* grab beat helpers                                                   */
  /* ------------------------------------------------------------------ */

  _beginClose() {
    const kind = this.pending.kind;
    const b = this.pending.body;
    if (kind === 'catch' && b) {
      // resolve the grab point at the START of the close beat, from the
      // claw's real grip position and its real open-finger reach
      const grip = this.claw.gripWorld(this._grip);
      this.grabChoice = this._resolveGrab(b, grip.x, grip.z, grip.y);
      this._closeStartX = b.pos.x; this._closeStartZ = b.pos.z;
    }
    this.closeAttached = false;
    this._setState('close');
  }

  _beginRegrip() {
    this.audio.regrip();
    const b = this.held;
    const grip = this.claw.gripWorld(this._grip);
    // shift the claw a few centimetres toward the toy's centre, then pick a
    // fresh grab point from there — this is what actually changes the read
    const dx = clamp(b.pos.x - grip.x, -0.05, 0.05);
    const dz = clamp(b.pos.z - grip.z, -0.05, 0.05);
    this.claw.setAim(this.claw.pos.x + dx, this.claw.pos.z + dz);
    const choice = this._resolveGrab(b, grip.x + dx, grip.z + dz, grip.y);
    this.grabChoice = choice;
    this._computeHangQuat(b, choice);
    this.hangBlend = 0.1;   // partial continuity, still a visible re-settle
    this._setState('regrip');
  }

  _beginLift() {
    this.gripClose = this.claw.closeTarget;
    this.liftFrom = this.claw.pos.y;
    this.liftTo = CAB.clawHomeY;
    this.liftDur = Math.max(BEAT.liftMin, (this.liftTo - this.liftFrom) / 1.05);
    this.slipped = false;
    this.carrySwingPeak = 0;
    this._setState('lift');
  }

  _logGrab(outcome, evalResult, chute) {
    const entry = {
      grabType: this.grabChoice?.type ?? null,
      outcome,
      chute: chute ?? null,
      events: evalResult?.events ?? [],
      score: evalResult?.score ?? 0,
      retried: !!this.regripped,
    };
    this.lastGrab = entry;
    this.dramaLog.push(entry);
    if (this.dramaLog.length > 50) this.dramaLog.shift();
  }

  /* ------------------------------------------------------------------ */
  /* per-frame                                                           */
  /* ------------------------------------------------------------------ */

  update(dt) {
    this.stateT += dt;
    const claw = this.claw;

    switch (this.state) {
      case 'intro':
        if (this.stateT > 0.35) this._setState('aim');
        break;

      case 'aim':
        claw.setAim(this.aim.x, this.aim.y);
        claw.targetY = CAB.clawHomeY;
        claw.closeTarget = 0.42;   // resting半開き, so the shape reads as a claw
        this.hero = damp(this.hero, 0, 3.0, dt);
        break;

      case 'open': {
        claw.closeTarget = 0;
        if (this.assistTarget) {
          // slide the crane the last few centimetres — reads as the machine
          // settling, not as an auto-aim
          const t = smoothstep(this.stateT / BEAT.open);
          claw.setAim(lerp(this.aim.x, this.assistTarget.x, t), lerp(this.aim.y, this.assistTarget.z, t));
        }
        this.hero = damp(this.hero, 0.7, 4.0, dt);
        this.heroTarget.copy(claw.gripWorld(_gp));
        if (this.stateT > BEAT.open) {
          const t = this.descendTarget;
          const stopY = t
            ? t.pos.y + t.radius * 0.55 + 0.30
            : CAB.clawFloorY;
          this.descendFrom = claw.pos.y;
          this.descendTo = clamp(stopY, CAB.clawFloorY, CAB.clawHomeY);
          this.descendDur = Math.max(0.62, (this.descendFrom - this.descendTo) / 1.45);
          this._setState('descend');
        }
        break;
      }

      case 'descend': {
        const t = clamp(this.stateT / this.descendDur, 0, 1);
        claw.targetY = lerp(this.descendFrom, this.descendTo, easeInOutCubic(t));
        this.hero = damp(this.hero, 1, 4.0, dt);
        this.heroTarget.copy(claw.gripWorld(_gp));
        this.audio.setMotor(0.85, 0.86, 0);
        if (t >= 1) {
          this._resolveContact();
          this.drama.begin();
          this.regripped = false;
          this.grabChoice = null;
          this.lastEval = null;
          this.chuteResult = null;
          const b = this.pending.body;
          this.touchFromY = claw.pos.y;
          this._touchStart.x = b ? b.pos.x : claw.pos.x;
          this._touchStart.z = b ? b.pos.z : claw.pos.z;
          this.nudged = false;
          if (this.pending.kind !== 'air' && b) {
            this.audio.softTouch(1);
            b.plush.impact(0.55);
            b.applyImpulse(_tmpV.set(0, -0.3, 0));
            b.wake();
            this._puffAt(b.pos.x, b.pos.y + b.radius * 0.6, b.pos.z, b.radius * 3.4);
          } else {
            // grabbed bare floor: the thump still travels through the platform,
            // so the pile always answers with *something*
            this.audio.clunk();
            this._puffAt(claw.pos.x, 0.02, claw.pos.z, 1.0);
            this._floorJolt(claw.pos.x, claw.pos.z);
          }
          this.audio.servo(false);
          this.audio.setMotor(0, 1, 0);
          this._setState('touch');
        }
        break;
      }

      case 'touch': {
        const kind = this.pending.kind;
        const b = this.pending.body;
        const p = clamp(this.stateT / BEAT.touch, 0, 1);
        // the claw keeps sinking a couple of centimetres — the beat is never static
        claw.targetY = this.touchFromY - 0.045 * smoothstep(p);
        this.heroTarget.copy(claw.gripWorld(_gp));
        this.hero = damp(this.hero, 1, 5.0, dt);
        // the sustained scrape only makes sense while there's fabric or a
        // toy under the fingers, not while pressing on bare acrylic floor
        if (kind !== 'air') this.audio.startDrag(0.3 + 0.4 * p);
        if (kind === 'catch' && b) {
          // the fabric dents, and the toy is pressed down and drawn a touch
          // toward the claw axis; its neighbours feel it too
          b.plush.setSquash(0.16 * p);
          const pull = 0.10 * p;
          b.pos.x = lerp(this._touchStart.x, claw.pos.x, pull);
          b.pos.z = lerp(this._touchStart.z, claw.pos.z, pull);
          b.wake();
          if (p > 0.45 && !this.nudged) {
            this.nudged = true;
            this._shoveNearby(b.pos.x, b.pos.z, b.radius * 2.4, 0.55, b);
          }
        } else if (kind === 'push' && b && !this.nudged) {
          this.nudged = true;
          this._nudge(b, 1);
          this.audio.wobble();
        }
        if (p >= 1) {
          this.nudged = false;
          this._beginClose();
        }
        break;
      }

      case 'close': {
        const kind = this.pending.kind;
        const b = this.pending.body;
        const holding = kind === 'catch';
        claw.closeTarget = holding ? 0.58 : 1;
        const p = clamp(this.stateT / BEAT.close, 0, 1);
        this.heroTarget.copy(claw.gripWorld(_gp));
        this.hero = damp(this.hero, 1, 5.0, dt);
        if (kind !== 'air') this.audio.startDrag(0.55 + 0.4 * p);
        if (holding && b && !this.closeAttached) {
          // fingers converge and *drag* the toy toward the claw axis — this
          // is where "the claw hooked its ear and pulled" reads
          b.plush.setSquash(0.26 * p);
          const e = easeInOutCubic(p);
          b.pos.x = lerp(this._closeStartX, claw.pos.x, e * 0.85);
          b.pos.z = lerp(this._closeStartZ, claw.pos.z, e * 0.85);
          b.wake();
          if (p > 0.6) { this.closeAttached = true; this._attach(b, this.grabChoice); }
        }
        if (this.stateT >= BEAT.close) {
          if (this.held) {
            this._setState('settle');
          } else {
            this.lastEval = this.drama.evaluate(null);
            this._beginLift();
          }
        }
        break;
      }

      case 'settle': {
        claw.closeTarget = this.gripClose;
        // the claw holds still; the camera holds on the toy, which rotates
        // into its hanging pose continuously in _updateHeld
        this.heroTarget.copy(this.held ? this.held.pos : claw.gripWorld(_gp));
        this.hero = damp(this.hero, 1, 4.0, dt);
        if (this.stateT >= BEAT.settle) {
          this.lastEval = this.drama.evaluate(this.held);
          if (this.lastEval.score < MIN_DRAMA && !this.regripped) {
            this.regripped = true;
            this._beginRegrip();
          } else {
            this._beginLift();
          }
        }
        break;
      }

      case 'regrip': {
        const p = clamp(this.stateT / BEAT.retry, 0, 1);
        const openness = Math.sin(p * Math.PI);
        claw.closeTarget = clamp(this.gripClose - openness * 0.22, 0.15, 1);
        this.heroTarget.copy(this.held ? this.held.pos : claw.gripWorld(_gp));
        this.hero = damp(this.hero, 1, 4.0, dt);
        if (this.stateT >= BEAT.retry) {
          this.lastEval = this.drama.evaluate(this.held);
          if (this.lastEval.score < MIN_DRAMA) this._forceDud(this.held);
          this._beginLift();
        }
        break;
      }

      case 'lift': {
        claw.closeTarget = this.slipped ? 0.25 : this.gripClose;
        const t = clamp(this.stateT / this.liftDur, 0, 1);
        claw.targetY = lerp(this.liftFrom, this.liftTo, easeInOutCubic(t));
        this.audio.setMotor(0.7, 1.15, this.held ? 1 : 0);
        this.hero = damp(this.hero, 1, 3.4, dt);
        this.heroTarget.copy(this.held ? this.held.pos : claw.gripWorld(_gp));
        // slip is a property of what was caught: a weak grab point comes
        // loose partway through the lift, and always lands somewhere easier
        if (this.held && this.grabChoice.hold < SLIP_HOLD && !this.slipped && t > 0.42) {
          this.slipped = true;
          claw.closeTarget = 0.25;
          const b = this._detach(new THREE.Vector3(
            (0 - claw.pos.x) * 0.5 + (Math.random() - 0.5) * 0.4,
            0.25,
            (0.18 - claw.pos.z) * 0.6 + (Math.random() - 0.5) * 0.3
          ));
          if (b) {
            b.plush.impact(0.5);
            // mostly a yaw spin, not a tumble — it should land upright
            b.angVel.set(0, (Math.random() - 0.5) * 1.5, 0);
          }
          this.audio.servo(true);
          this.audio.wobble();
          this._logGrab('slip', this.lastEval, null);
        }
        if (t >= 1) {
          this.audio.setMotor(0, 1, 0);
          if (this.held) {
            this.carryFromX = claw.pos.x; this.carryFromZ = claw.pos.z;
            this.carryDist = Math.hypot(claw.pos.x - CAB.hole.x, claw.pos.z - CAB.hole.z);
            this.carryDur = Math.max(BEAT.carryMin, this.carryDist / 1.05);
            this._setState('carry');
          } else {
            if (this.pending.kind !== 'catch') this._logGrab(this.pending.kind, this.lastEval, null);
            this._setState('recover');
          }
        }
        break;
      }

      case 'carry': {
        claw.closeTarget = this.gripClose;
        const t = clamp(this.stateT / this.carryDur, 0, 1);
        const e = easeInOutCubic(t);
        claw.setAim(lerp(this.carryFromX, CAB.hole.x, e), lerp(this.carryFromZ, CAB.hole.z, e));
        claw.followSpeed = 9.0;
        this.audio.setMotor(0.9, 1.0, this.held ? 1 : 0);
        // ease back out so the swinging toy stays in frame rather than
        // filling the whole screen for the entire carry
        this.hero = damp(this.hero, 0.55, 2.6, dt);
        this.heroTarget.copy(this.held ? this.held.pos : claw.gripWorld(_gp));
        this.carrySwingPeak = Math.max(this.carrySwingPeak, Math.abs(this.pendulum.x), Math.abs(this.pendulum.z));
        if (t >= 1 && this.stateT > this.carryDur + 0.28) {
          this.audio.setMotor(0, 1, 0);
          this.audio.servo(true);
          this.chuteResult = this._chuteFinish(this.grabChoice?.type, this.carrySwingPeak);
          this._setState('release');
        }
        break;
      }

      case 'release': {
        claw.closeTarget = 0;
        this.hero = damp(this.hero, 0.4, 3.0, dt);
        this.heroTarget.copy(this.held ? this.held.pos : claw.gripWorld(_gp));
        this.binFocus = damp(this.binFocus, 0.5, 3.0, dt);
        if (this.held && this.stateT > BEAT.release) {
          const b = this._detach();
          if (this.chuteResult === CHUTE.RIM) {
            // lands half on the rim first — guaranteed to tip in afterward,
            // never back into the case
            b.pos.set(
              CAB.hole.x + (Math.random() - 0.5) * CAB.hole.r * 0.6,
              CAB.floorY + b.radius * 0.9,
              CAB.hole.z + (Math.random() - 0.5) * CAB.hole.r * 0.6
            );
            b.vel.set(0, 0, 0);
            this.teeterBody = b;
            this._teeterLastPhase = -1;
            this.teeterDir = Math.random() < 0.5 ? -1 : 1;
            this._setState('teeter');
          } else {
            if (this.chuteResult === CHUTE.BOUNCE) {
              // clip the chute wall on the way down for a visible carom
              b.vel.x += (Math.random() < 0.5 ? -1 : 1) * 1.1;
            }
            b.inChute = true;
            this.falling = b;
            this.fallLanded = false;
            this._setState('fall');
          }
        }
        break;
      }

      case 'teeter': {
        const b = this.teeterBody;
        const p = clamp(this.stateT / BEAT.teeter, 0, 1);
        // 2-3 decaying rocks, then tips past the balance point
        const rocks = 2.5;
        const amp = (1 - p) * 0.45;
        const angle = Math.sin(p * Math.PI * 2 * rocks) * amp * this.teeterDir;
        b.quat.setFromEuler(_eTeeter.set(0, 0, angle, 'XYZ'));
        b.syncMesh();
        const phase = Math.floor(p * rocks * 2);
        if (phase !== this._teeterLastPhase) { this._teeterLastPhase = phase; this.audio.creak(phase); }
        this.binFocus = damp(this.binFocus, 1, 3.0, dt);
        this.hero = damp(this.hero, 0, 3.0, dt);
        if (p >= 1) {
          // guaranteed: it always tips in, never back into the case
          b.inChute = true;
          b.vel.set((CAB.hole.x - b.pos.x) * 1.4, -0.2, (CAB.hole.z - b.pos.z) * 1.4);
          this.falling = b;
          this.fallLanded = false;
          this.teeterBody = null;
          this._setState('fall');
        }
        break;
      }

      case 'fall': {
        const b = this.falling;
        if (b) {
          b.vel.y += GRAVITY * dt;
          b.pos.addScaledVector(b.vel, dt);
          const wl = b.angVel.length();
          if (wl > 1e-4) {
            this._tmpQ.setFromAxisAngle(this._tmpV.copy(b.angVel).divideScalar(wl), wl * dt);
            b.quat.premultiply(this._tmpQ).normalize();
          }
          // keep it inside the chute walls (a small bounce off them for BOUNCE finishes)
          const C = CAB.chute;
          if (b.pos.x < C.minX) { b.pos.x = C.minX; b.vel.x = Math.abs(b.vel.x) * 0.4; }
          if (b.pos.x > C.maxX) { b.pos.x = C.maxX; b.vel.x = -Math.abs(b.vel.x) * 0.4; }
          if (b.pos.z < C.minZ) { b.pos.z = C.minZ; b.vel.z = Math.abs(b.vel.z) * 0.4; }
          if (b.pos.z > C.maxZ) { b.pos.z = C.maxZ; b.vel.z = -Math.abs(b.vel.z) * 0.4; }
          const landY = CAB.binY + 0.03 + b.radius * 0.95;
          if (b.pos.y <= landY) {
            b.pos.y = landY;
            if (!this.fallLanded) {
              this.fallLanded = true;
              this.audio.goton();
              b.plush.impact(1.35);
              b.vel.y = -b.vel.y * 0.28;
              b.vel.x *= 0.5; b.vel.z *= 0.5;
              b.angVel.multiplyScalar(0.4);
              this.binShake = 1;
            } else {
              b.vel.y = Math.abs(b.vel.y) < 0.35 ? 0 : -b.vel.y * 0.2;
              b.vel.x *= 0.8; b.vel.z *= 0.8;
              b.angVel.multiplyScalar(0.9);
            }
          }
          b.syncMesh();
          b.plush.update(dt, b.vel, 0);
        }
        this.binFocus = damp(this.binFocus, 1, 3.6, dt);
        this.hero = damp(this.hero, 0, 3.0, dt);
        if (this.fallLanded && this.stateT > BEAT.landHold) {
          this.audio.success();
          const fromPos = b.pos.clone();
          const fromQuat = b.quat.clone();
          this._logGrab('win', this.lastEval, this.chuteResult);
          this.pile.remove(b);
          this.scene.remove(b.plush.root);
          const species = b.plush.species, variant = b.plush.variant;
          b.plush.dispose();
          this.falling = null;
          this._setState('won');
          this.onWin?.({ species, variant, fromPos, fromQuat });
        }
        break;
      }

      case 'recover': {
        // a miss: park the claw and hand control straight back
        claw.closeTarget = 0.42;
        claw.targetY = CAB.clawHomeY;
        this.hero = damp(this.hero, 0, 3.0, dt);
        if (this.stateT > BEAT.recover) {
          this.setAim(claw.pos.x, claw.pos.z);
          this._setState('aim');
        }
        break;
      }

      case 'won':
        this.hero = damp(this.hero, 0, 2.0, dt);
        break;
    }

    /* ---- crane + physics ---- */
    // Y is tweened explicitly by the state machine, so the claw's own damping is
    // bypassed for that axis only
    claw.followSpeed = this.state === 'aim' ? 6.2 : 9.0;
    claw.update(dt, { ySpeed: 1e9, closeSpeed: this.state === 'close' ? 11 : 9 });

    // the gantry hums whenever it is actually travelling — including while aiming
    if (this.state === 'aim') {
      const sp = Math.hypot(claw.velocity.x, claw.velocity.z);
      this.audio.setMotor(clamp(sp / 1.1, 0, 1) * 0.8, 0.95, 0);
    }

    if (this.state !== 'fall' && this.state !== 'teeter') this.pile.step(dt);
    this.pile.render(dt);

    if (this.held) this._updateHeld(dt);

    /* ---- marker / beam ---- */
    this._updateMarker(dt);
    this._updatePuff(dt);

    if (this.binShake > 0) {
      this.binShake = Math.max(0, this.binShake - dt * 2.6);
    }

    // binFocus decays back to 0 everywhere except the states that actively
    // drive it toward 1 (they set their own target above)
    if (this.state !== 'fall' && this.state !== 'won' && this.state !== 'teeter' && this.state !== 'release') {
      this.binFocus = damp(this.binFocus, 0, 2.2, dt);
    }

    /* ---- camera ---- */
    this._updateCamera(dt);
  }

  _updateHeld(dt) {
    const b = this.held;
    const claw = this.claw;
    const grip = claw.gripWorld(this._grip);
    const choice = this.grabChoice;

    // pendulum driven by the crane's acceleration
    const acc = _acc.copy(claw.velocity).sub(this._prevClawVel).divideScalar(Math.max(dt, 1 / 120));
    this._prevClawVel.copy(claw.velocity);
    acc.clampLength(0, 60);

    const p = this.pendulum;
    const k = 26, c = 3.4, gain = 0.055;
    const steps = 2;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const ax = -k * p.x - c * p.vx + acc.z * gain;
      const az = -k * p.z - c * p.vz - acc.x * gain;
      p.vx += ax * h; p.x += p.vx * h;
      p.vz += az * h; p.z += p.vz * h;
    }
    p.x = clamp(p.x, -0.6, 0.6);
    p.z = clamp(p.z, -0.6, 0.6);

    // orientation: blend from the pose it was lying in to the hanging pose,
    // at a rate scaled by choice.spin (see _computeHangQuat), then layer the
    // pendulum's world-space sway on top
    if (this.hangBlend < 1) {
      this.hangBlend = Math.min(1, this.hangBlend + dt / Math.max(0.05, this.hangBlendDur));
    }
    _hangNow.slerpQuaternions(this.grabStartQuat, this.hangQuat, easeOutCubic(this.hangBlend));
    _swing.setFromEuler(_e.set(p.x, 0, p.z, 'XYZ'));
    b.quat.copy(_hangNow).premultiply(_swing);

    // the signature effect: solve position from the rotation so the caught
    // grab point stays pinned under the claw while the body turns around it
    _localRot.copy(choice.local).applyQuaternion(b.quat);
    b.pos.set(grip.x - _localRot.x, grip.y - _localRot.y, grip.z - _localRot.z);

    // vertical acceleration pumps the squash a little
    const squash = clamp(0.2 + acc.y * 0.004, 0.12, 0.36);
    b.plush.setSquash(squash);

    b.syncMesh();
    b.vel.copy(claw.velocity);
    b.plush.update(dt, b.vel, 1);
  }

  _updateMarker(dt) {
    const show = this.state === 'aim' ? 1 : 0.18;
    const m = this.marker;
    m.position.x = damp(m.position.x, this.aim.x, 22, dt);
    m.position.z = damp(m.position.z, this.aim.y, 22, dt);
    const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.06;
    this.markerRing.scale.setScalar(pulse);
    this.markerBlob.material.opacity = damp(this.markerBlob.material.opacity, 0.8 * show, 8, dt);
    this.markerRing.material.opacity = damp(this.markerRing.material.opacity, 0.95 * show, 8, dt);
    this.markerDot.material.opacity = this.markerRing.material.opacity;

    const cx = this.claw.pos.x, cz = this.claw.pos.z, cy = this.claw.pos.y;

    // the crane's own soft shadow on the floor
    if (!this.clawShadow) {
      const s = new THREE.Mesh(
        new THREE.PlaneGeometry(0.75, 0.75),
        new THREE.MeshBasicMaterial({ map: softBlob('60,20,50', 0.5), transparent: true, depthWrite: false, opacity: 0.5 })
      );
      s.rotation.x = -Math.PI / 2;
      this.scene.add(s);
      this.clawShadow = s;
    }
    const drop = clamp(1 - (cy - 0.3) / 1.4, 0.25, 1);
    this.clawShadow.position.set(cx, 0.004, cz);
    this.clawShadow.scale.setScalar(lerp(1.25, 0.7, drop));
    this.clawShadow.material.opacity = lerp(0.18, 0.5, drop);
  }

  _updatePuff(dt) {
    const p = this.puff;
    if (!p.active) return;
    p.t += dt;
    const t = clamp(p.t / 0.45, 0, 1);
    const s = lerp(0.6, 2.1, easeOutCubic(t)) * (p.baseScale || 1);
    p.mesh.scale.set(s, s, s);
    p.mesh.material.opacity = (1 - t) * 0.5;
    if (t >= 1) { p.active = false; p.mesh.visible = false; }
  }

  /* ------------------------------------------------------------------ */
  /* camera                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Re-frame for the current viewport.
   *
   * Fits the glass showcase interior (CAB.inX/inZ, floor to ceiling) plus a
   * small margin — not the whole cabinet: the marquee and base are meant to
   * fall off the top/bottom edges now that the case itself is the star. The
   * real bounding box is projected and the rig solved iteratively (rather
   * than guessed from a nominal width/height), then nudged in screen space
   * so the controls never sit on top of the glass. A narrow phone in
   * portrait is allowed a little horizontal overscan (the frame posts get
   * cropped) to buy apparent size; landscape and tablets keep the whole
   * glass comfortably inside.
   */
  resize(w, h) {
    const aspect = w / h;
    const portrait = aspect < 1.0;
    this.camera.aspect = aspect;

    const narrow = portrait && aspect < 0.62;
    const fov = portrait ? (aspect < 0.55 ? 46 : 43) : 38;
    const az = (portrait ? 13 : 17) * Math.PI / 180;
    const el = (portrait ? 21 : 23) * Math.PI / 180;
    this.camera.fov = fov;

    // what must stay on screen: the glass interior plus a small margin
    const bx = CAB.inX + 0.14;
    const bzz = CAB.inZ + 0.14;
    const byTop = CAB.ceilY + 0.1;
    const byBot = -0.15;
    // >1 crops (overscan, bigger apparent size); <=1 leaves room to spare
    const mx = narrow ? 1.09 : (portrait ? 1.0 : 0.96);
    const my = narrow ? 1.0 : (portrait ? 0.9 : 0.98);
    const anchorX = portrait ? 0 : -0.2;
    const anchorY = narrow ? 0.1 : (portrait ? 0.06 : 0.02);

    const dir = new THREE.Vector3(
      Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)
    );
    const target = new THREE.Vector3(0, (byTop + byBot) / 2, 0);
    let dist = 6;

    const corners = [];
    for (const sx of [-bx, bx]) for (const sy of [byBot, byTop]) for (const sz of [-bzz, bzz]) {
      corners.push(new THREE.Vector3(sx, sy, sz));
    }

    const project = () => {
      this.camera.position.copy(target).addScaledVector(dir, dist);
      this.camera.lookAt(target);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld(true);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const c of corners) {
        const p = _proj.copy(c).project(this.camera);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      return { minX, maxX, minY, maxY };
    };

    let b = project();
    for (let i = 0; i < 6; i++) {
      const k = Math.max((b.maxX - b.minX) / (2 * mx), (b.maxY - b.minY) / (2 * my));
      dist *= 0.35 + 0.65 * k;          // damped so it converges instead of ringing
      b = project();
      if (Math.abs(k - 1) < 0.005) break;
    }

    // slide the rig so the machine sits where the layout wants it
    const halfH = Math.tan((fov * Math.PI) / 360) * dist;
    const halfW = halfH * aspect;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    target.x += (cx - anchorX) * halfW;
    target.y += (cy - anchorY) * halfH;

    this.framing = { fov, dist, dir, target: target.clone(), portrait };
    this.camera.updateProjectionMatrix();
  }

  _baseCamera(outPos, outTarget) {
    const f = this.framing;
    outTarget.copy(f.target);
    outPos.copy(f.target).addScaledVector(f.dir, f.dist);
  }

  _updateCamera(dt) {
    this._baseCamera(_bp, _bt);

    // gentle parallax so the world feels dimensional while aiming
    const followX = this.aim.x * 0.05;
    const followZ = this.aim.y * 0.02;
    _bp.x += followX; _bt.x += followX * 0.6;
    _bp.z += followZ;

    // hero push-in, beat-driven: heroTarget follows the actual subject
    // (contact point while descending in, the toy itself once it's caught)
    if (this.hero > 0.001) {
      const tgt = this.heroTarget;
      _ht.copy(_bt).lerp(tgt, 0.55 * this.hero);
      _hp.copy(_bp).lerp(tgt, 0.16 * this.hero);
      _hp.y = lerp(_bp.y, tgt.y + this.framing.dist * 0.22, this.hero * 0.5);
      _bt.copy(_ht); _bp.copy(_hp);
    }

    // then guide the eye down to the prize chute
    if (this.binFocus > 0.001) {
      _bin.set(CAB.hole.x + 0.06, CAB.binY + 0.35, 0.45);
      _bt.lerp(_bin, this.binFocus * 0.62);
      _binP.copy(_bin).add(_binOff);
      _bp.lerp(_binP, this.binFocus * 0.36);
    }

    const lam = this.state === 'aim' ? 5.0 : 3.2;
    this._camPos.lerp(_bp, 1 - Math.exp(-lam * dt));
    this._camTarget.lerp(_bt, 1 - Math.exp(-lam * dt));

    // tiny settle bump when the prize lands — weight, not an earthquake
    let shake = 0;
    if (this.binShake > 0) shake = this.binShake * this.binShake * 0.022;
    this.camera.position.copy(this._camPos);
    if (shake > 0) {
      this.camera.position.y += Math.sin(performance.now() * 0.05) * shake;
      this.camera.position.x += Math.sin(performance.now() * 0.071) * shake * 0.6;
    }
    this.camera.lookAt(this._camTarget);
  }

  /** Called by main after the reveal, to hand control back. */
  resumeAfterReveal() {
    this.binFocus = 0;
    this.newRound();
    this.setAim(this.aim.x, this.aim.y);
    this._setState('aim');
  }

  setQuality(q) {
    this.quality = q;
    this.keyLight.castShadow = q > 0.35;
    // weak devices get fewer toys — takes effect on the next layout only,
    // never mid-grab
    this.pileCount = q < 0.5 ? PILE.lowCount : PILE.count;
  }
}

/* scratch objects — avoid per-frame allocation */
const _ray = new THREE.Raycaster();
const _v2 = new THREE.Vector2();
const _plane = new THREE.Plane();
const _up = new THREE.Vector3(0, 1, 0);
const _dragP = new THREE.Vector3();
const _acc = new THREE.Vector3();
const _swing = new THREE.Quaternion();
const _e = new THREE.Euler();
const _eTeeter = new THREE.Euler();
const _bp = new THREE.Vector3();
const _bt = new THREE.Vector3();
const _hp = new THREE.Vector3();
const _ht = new THREE.Vector3();
const _gp = new THREE.Vector3();
const _bin = new THREE.Vector3();
const _binOff = new THREE.Vector3(0.9, 1.15, 2.5);
const _binP = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _localDir = new THREE.Vector3();
const _localRot = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
const _faceQ = new THREE.Quaternion();
const _eTmp = new THREE.Euler();
const _hangNow = new THREE.Quaternion();
const _tmpImp = new THREE.Vector3();
const _tmpImp2 = new THREE.Vector3();
