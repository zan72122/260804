// The play scene: framing, input, the grab state machine and the "hero moment"
// choreography (descend -> touch -> close -> lift -> swing -> carry -> drop).

import * as THREE from '../vendor/three/three.module.min.js';
import { CAB, buildCabinet, buildBackdrop } from './cabinet.js';
import { Claw } from './claw.js';
import { Pile } from './pile.js';
import { softBlob } from './textures.js';
import { clamp, damp, lerp, easeInOutCubic, easeOutCubic, makeRng, smoothstep } from './util.js';

/* aim / capture tuning — the invisible kindness lives here */
const CAPTURE_DIST = 0.50;   // clean win
const SLIP_DIST = 0.74;      // grabbed but slips out during the lift
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

    this.pendulum = { x: 0, z: 0, vx: 0, vz: 0 };
    this.hero = 0;             // 0 = wide, 1 = hero close-up
    this.binFocus = 0;
    this._camPos = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();
    this._grip = new THREE.Vector3();
    this._tmpV = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
    this._prevClawVel = new THREE.Vector3();

    this.onWin = null;         // ({species, variant}) => void
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

  setEnvironment(envTexture) {
    this.scene.environment = envTexture;
  }

  /* ------------------------------------------------------------------ */
  /* rounds                                                              */
  /* ------------------------------------------------------------------ */

  newRound(force = false) {
    if (!force && this.pile.bodies.length >= 4) return;
    this.roundSeed = (this.roundSeed * 1103515245 + 12345) & 0x7fffffff;
    const rng = makeRng(this.roundSeed);
    this.pile.layout(rng, { count: 6, quality: this.quality });
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
    this.state = s;
    this.stateT = 0;
    this.onStateChange?.(s);
  }

  _resolveContact() {
    const cx = this.claw.pos.x, cz = this.claw.pos.z;
    const near = this.pile.nearestTo(cx, cz, 1.25);
    this.pending = { kind: 'air', body: null };
    if (!near) return;
    const { body, dist } = near;
    if (dist <= CAPTURE_DIST) this.pending = { kind: 'catch', body, dist };
    else if (dist <= SLIP_DIST) this.pending = { kind: 'slip', body, dist };
    else this.pending = { kind: 'push', body, dist };
  }

  _attach(body) {
    body.held = true;
    body.wake();
    this.held = body;
    const grip = this.claw.gripWorld(this._grip);
    // hang from exactly where the fingers closed, so the toy never pops
    this.hangLen = clamp(grip.y - body.pos.y, body.radius * 0.3, body.radius * 1.15);
    this.grabOffset = new THREE.Vector3(body.pos.x - grip.x, 0, body.pos.z - grip.z);
    this.grabStartQuat = body.quat.clone();
    // where it will settle to while hanging: mostly upright, leaning by the offset
    const e = new THREE.Euler().setFromQuaternion(body.quat, 'YXZ');
    const tiltX = clamp(this.grabOffset.z * 1.9, -0.55, 0.55);
    const tiltZ = clamp(-this.grabOffset.x * 1.9, -0.55, 0.55);
    // wrap the yaw to the shortest way round, then let it swing most of the way
    // toward the player: hanging by one arm, a plush turns to face the room
    let yaw = Math.atan2(Math.sin(e.y), Math.cos(e.y));
    yaw *= 0.35;
    this.hangQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yaw, tiltZ, 'YXZ'));
    this.hangBlend = 0;
    this.pendulum.x = clamp(-this.grabOffset.z * 1.1, -0.4, 0.4);
    this.pendulum.z = clamp(this.grabOffset.x * 1.1, -0.4, 0.4);
    this.pendulum.vx = 0; this.pendulum.vz = 0;
    body.plush.setSquash(0.24);
  }

  _detach(extraVel) {
    const b = this.held;
    if (!b) return null;
    b.held = false;
    b.plush.setSquash(0);
    // hand the pendulum's swing over as real velocity
    const swingV = new THREE.Vector3(
      Math.cos(this.pendulum.z) * this.pendulum.vz * this.hangLen,
      0,
      -Math.cos(this.pendulum.x) * this.pendulum.vx * this.hangLen
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
          const t = smoothstep(this.stateT / 0.34);
          claw.setAim(lerp(this.aim.x, this.assistTarget.x, t), lerp(this.aim.y, this.assistTarget.z, t));
        }
        this.hero = damp(this.hero, 0.75, 4.0, dt);
        if (this.stateT > 0.34) {
          const t = this.descendTarget;
          const stopY = t
            ? t.pos.y + t.radius * 0.55 + 0.30
            : CAB.clawFloorY;
          this.descendFrom = claw.pos.y;
          this.descendTo = clamp(stopY, CAB.clawFloorY, CAB.clawHomeY);
          this.descendDur = Math.max(0.62, (this.descendFrom - this.descendTo) / 1.45);
          this.touched = false;
          this._setState('descend');
        }
        break;
      }

      case 'descend': {
        const t = clamp(this.stateT / this.descendDur, 0, 1);
        claw.targetY = lerp(this.descendFrom, this.descendTo, easeInOutCubic(t));
        this.hero = damp(this.hero, 1, 4.0, dt);
        this.audio.setMotor(0.85, 0.86);
        if (!this.touched && t > 0.86) {
          this.touched = true;
          this._resolveContact();
          const b = this.pending.body;
          if (this.pending.kind !== 'air' && b) {
            this.audio.softTouch(1);
            b.plush.impact(0.55);
            b.wake();
            this._puffAt(b.pos.x, b.pos.y + b.radius * 0.6, b.pos.z, b.radius * 3.4);
          } else {
            // grabbed bare floor: the thump still travels through the platform,
            // so the pile always answers with *something*
            this.audio.clunk();
            this._puffAt(claw.pos.x, 0.02, claw.pos.z, 1.0);
            this._floorJolt(claw.pos.x, claw.pos.z);
          }
        }
        if (t >= 1) {
          if (!this.touched) { this.touched = true; this._resolveContact(); }
          this._setState('close');
          this.audio.servo(false);
          this.audio.setMotor(0);
        }
        break;
      }

      case 'close': {
        // when there is a toy in the way the fingers stop against it — you can
        // see the grip, and the fabric gives instead of the metal passing through
        const holding = this.pending && (this.pending.kind === 'catch' || this.pending.kind === 'slip');
        claw.closeTarget = holding ? 0.58 : 1;
        const p = clamp(this.stateT / 0.42, 0, 1);
        const b = this.pending?.body;
        if (b && !b.held && this.pending.kind !== 'push' && this.pending.kind !== 'air') {
          // the fabric gives before the fingers stop
          b.plush.setSquash(0.24 * p);
          if (p > 0.55) this._attach(b);
        } else if (b && p > 0.5 && !this.nudged) {
          this.nudged = true;
          this._nudge(b, 1);
          this.audio.wobble();
        }
        if (this.stateT > 0.46) {
          this.nudged = false;
          this.gripClose = claw.closeTarget;
          this.liftFrom = claw.pos.y;
          this.liftTo = CAB.clawHomeY;
          this.liftDur = Math.max(0.8, (this.liftTo - this.liftFrom) / 1.05);
          this.slipped = false;
          this._setState('lift');
        }
        break;
      }

      case 'lift': {
        claw.closeTarget = this.slipped ? 0.25 : (this.gripClose ?? 1);
        const t = clamp(this.stateT / this.liftDur, 0, 1);
        claw.targetY = lerp(this.liftFrom, this.liftTo, easeInOutCubic(t));
        this.audio.setMotor(0.7, 1.15);
        this.hero = damp(this.hero, 1, 3.4, dt);
        if (this.held && this.pending.kind === 'slip' && !this.slipped && t > 0.42) {
          // deterministic, readable: aimed a bit off -> the fingers lose it
          this.slipped = true;
          claw.closeTarget = 0.25;
          const b = this._detach(new THREE.Vector3(
            (0 - claw.pos.x) * 0.5 + (Math.random() - 0.5) * 0.4,
            0.2,
            (0.18 - claw.pos.z) * 0.6 + (Math.random() - 0.5) * 0.3
          ));
          b?.plush.impact(0.5);
          this.audio.servo(true);
          this.audio.wobble();
        }
        if (t >= 1) {
          this.audio.setMotor(0);
          if (this.held) {
            this.carryFromX = claw.pos.x; this.carryFromZ = claw.pos.z;
            this.carryDur = Math.max(0.9, Math.hypot(claw.pos.x - CAB.hole.x, claw.pos.z - CAB.hole.z) / 1.05);
            this._setState('carry');
          } else {
            this._setState('recover');
          }
        }
        break;
      }

      case 'carry': {
        claw.closeTarget = this.gripClose ?? 1;
        const t = clamp(this.stateT / this.carryDur, 0, 1);
        const e = easeInOutCubic(t);
        claw.setAim(lerp(this.carryFromX, CAB.hole.x, e), lerp(this.carryFromZ, CAB.hole.z, e));
        claw.followSpeed = 9.0;
        this.audio.setMotor(0.9, 1.0);
        this.hero = damp(this.hero, 0.55, 2.6, dt);
        if (t >= 1 && this.stateT > this.carryDur + 0.28) {
          this.audio.setMotor(0);
          this.audio.servo(true);
          this._setState('release');
        }
        break;
      }

      case 'release': {
        claw.closeTarget = 0;
        if (this.held && this.stateT > 0.16) {
          const b = this._detach();
          b.inChute = true;
          this.falling = b;
          this.fallLanded = false;
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
          // keep it inside the chute walls
          b.pos.x = clamp(b.pos.x, -1.08, -0.40);
          b.pos.z = clamp(b.pos.z, -0.10, 0.72);
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
        if (this.fallLanded && this.stateT > 1.15) {
          this.audio.success();
          const rec = { species: b.plush.species, variant: b.plush.variant };
          this.pile.remove(b);
          this.scene.remove(b.plush.root);
          b.plush.dispose();
          this.falling = null;
          this._setState('won');
          this.onWin?.(rec);
        }
        break;
      }

      case 'recover': {
        // a miss: park the claw and hand control straight back
        claw.closeTarget = 0.42;
        claw.targetY = CAB.clawHomeY;
        this.hero = damp(this.hero, 0, 3.0, dt);
        if (this.stateT > 0.45) {
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
      this.audio.setMotor(clamp(sp / 1.1, 0, 1) * 0.8, 0.95);
    }

    if (this.state !== 'fall') this.pile.step(dt);
    this.pile.render(dt);

    if (this.held) this._updateHeld(dt);

    /* ---- marker / beam ---- */
    this._updateMarker(dt);
    this._updatePuff(dt);

    if (this.binShake > 0) {
      this.binShake = Math.max(0, this.binShake - dt * 2.6);
    }

    /* ---- camera ---- */
    this._updateCamera(dt);
  }

  _updateHeld(dt) {
    const b = this.held;
    const claw = this.claw;
    const grip = claw.gripWorld(this._grip);

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

    const L = this.hangLen;
    b.pos.set(
      grip.x + Math.sin(p.z) * L,
      grip.y - Math.cos(p.z) * Math.cos(p.x) * L,
      grip.z - Math.sin(p.x) * L
    );

    // orientation: settle from "however it was lying" to "hanging from the claw"
    this.hangBlend = Math.min(1, this.hangBlend + dt * 1.5);
    b.quat.slerpQuaternions(this.grabStartQuat, this.hangQuat, easeOutCubic(this.hangBlend));
    _swing.setFromEuler(_e.set(p.x, 0, p.z, 'XYZ'));
    b.quat.premultiply(_swing);

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
   * Rather than guessing a distance from a nominal width/height (which breaks
   * as soon as perspective and the 3/4 yaw are taken into account), the machine's
   * real bounding box is projected and the rig is solved iteratively, then
   * nudged in screen space so the controls never sit on top of the glass.
   * Portrait and landscape use different crops and different anchors.
   */
  resize(w, h) {
    const aspect = w / h;
    const portrait = aspect < 1.0;
    this.camera.aspect = aspect;

    // a phone in portrait is so narrow that the marquee has to be cropped to
    // keep the showcase big; a tablet has room for the whole machine
    const narrow = portrait && aspect < 0.62;
    const fov = portrait ? (aspect < 0.55 ? 46 : 43) : 38;
    const az = (portrait ? 13 : 17) * Math.PI / 180;
    const el = (portrait ? 21 : 23) * Math.PI / 180;
    this.camera.fov = fov;

    // what must stay on screen: the whole machine, marquee to delivery bin
    const bx = narrow ? 1.33 : 1.45;
    const bzz = narrow ? 1.0 : 1.1;
    const byTop = narrow ? 2.52 : (portrait ? 2.9 : 2.7);
    const byBot = narrow ? -1.32 : (portrait ? -1.5 : -1.34);
    // portrait keeps ~16% of the height under the machine for the grab button,
    // landscape keeps a right margin for the same reason
    const mx = narrow ? 1.02 : (portrait ? 0.96 : 0.98);
    const my = narrow ? 1.0 : (portrait ? 0.92 : 1.05);
    const anchorX = portrait ? 0 : -0.3;
    const anchorY = narrow ? 0.16 : (portrait ? 0.1 : 0.03);

    const dir = new THREE.Vector3(
      Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)
    );
    const target = new THREE.Vector3(0, (byTop + byBot) / 2, 0);
    let dist = 8;

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

    // hero push-in on the claw during the grab
    if (this.hero > 0.001) {
      const grip = this.claw.gripWorld(_gp);
      _ht.copy(_bt).lerp(grip, 0.55 * this.hero);
      _hp.copy(_bp).lerp(grip, 0.16 * this.hero);
      _hp.y = lerp(_bp.y, grip.y + this.framing.dist * 0.22, this.hero * 0.5);
      _bt.copy(_ht); _bp.copy(_hp);
    }

    // then guide the eye down to the prize chute
    if (this.binFocus > 0.001) {
      _bin.set(CAB.hole.x + 0.06, CAB.binY + 0.35, 0.45);
      _bt.lerp(_bin, this.binFocus * 0.62);
      _bp.lerp(_bin.clone().add(_binOff), this.binFocus * 0.36);
    }
    if (this.state !== 'fall' && this.state !== 'won') {
      this.binFocus = damp(this.binFocus, 0, 2.2, dt);
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
const _bp = new THREE.Vector3();
const _bt = new THREE.Vector3();
const _hp = new THREE.Vector3();
const _ht = new THREE.Vector3();
const _gp = new THREE.Vector3();
const _bin = new THREE.Vector3();
const _binOff = new THREE.Vector3(0.9, 1.15, 2.5);
const _proj = new THREE.Vector3();
