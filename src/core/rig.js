// Camera rig.
//
// Stages never set a camera position; they describe the thing they want on
// screen (a centre and a real-world width/height) and the rig solves for a
// distance that fits it in the current aspect.  That is what makes rotating
// the device a non-event: the same shot re-solves for the new aspect, and
// portrait naturally pushes in on the bell's height while landscape pulls back
// to hold the furnace, the mould and the crane in one frame.

import * as THREE from './three.js';
import { damp, lerp, clamp } from './util.js';

export class Rig {
  constructor(canvas) {
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.35, 90);
    this.target = new THREE.Vector3(0, 1.4, 0);
    this.current = new THREE.Vector3(0, 1.4, 0);
    this.shot = { target: new THREE.Vector3(0, 1.4, 0), w: 4, h: 3.4, yaw: 0.16, pitch: 0.20 };
    this.landShot = null;
    this._dist = 8;
    this._distNow = 8;
    this._yawNow = 0.16; this._pitchNow = 0.2;
    this.portrait = true;
    this.shake = 0;
    this._t = 0;
    this._parallax = new THREE.Vector2();
    this._parallaxTarget = new THREE.Vector2();
    this.canvas = canvas;
    this.snapNext = true;
    this._move = 1;
    this.moveDur = 1.15;
  }

  resize(w, h) {
    this.portrait = h >= w;
    this.camera.aspect = w / h;
    // a narrow phone held upright needs a taller cone or the bell will not fit
    this.camera.fov = this.portrait ? 46 : 40;
    this.camera.updateProjectionMatrix();
    this._solve();
  }

  /**
   * @param {object} s {target:Vector3|array, w, h, yaw, pitch}
   * @param {object} [land] overrides used only in landscape
   */
  setShot(s, land = null, snap = false) {
    const t = s.target;
    this.shot = {
      target: t.isVector3 ? t.clone() : new THREE.Vector3(t[0], t[1], t[2]),
      w: s.w, h: s.h, yaw: s.yaw ?? 0.16, pitch: s.pitch ?? 0.2,
    };
    this.landShot = land ? {
      target: land.target ? (land.target.isVector3 ? land.target.clone()
        : new THREE.Vector3(land.target[0], land.target[1], land.target[2])) : this.shot.target.clone(),
      w: land.w ?? s.w, h: land.h ?? s.h,
      yaw: land.yaw ?? this.shot.yaw, pitch: land.pitch ?? this.shot.pitch,
    } : null;
    if (snap) this.snapNext = true;
    else { this._move = 0; this.moveDur = 1.15; }
    this._solve();
  }

  get active() { return (!this.portrait && this.landShot) ? this.landShot : this.shot; }

  _solve() {
    const s = this.active;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const tanV = Math.tan(vFov / 2);
    const tanH = tanV * this.camera.aspect;
    const dv = (s.h * 0.5) / tanV;
    const dh = (s.w * 0.5) / tanH;
    this._dist = clamp(Math.max(dv, dh) * 1.12, 2.2, 34);
    this.target.copy(s.target);
  }

  /** small pointer-driven parallax; keeps the scene feeling like a real room */
  setParallax(x, y) { this._parallaxTarget.set(clamp(x, -1, 1), clamp(y, -1, 1)); }

  kick(power = 1) { this.shake = Math.min(1.4, this.shake + power); }

  update(dt) {
    this._t += dt;
    this._solve();
    const s = this.active;
    // Ease in and out of a reframe instead of crawling asymptotically toward
    // it: the old exponential chase was still visibly gliding several seconds
    // in, so the player's first action always happened on a moving camera.
    this._move = Math.min(1, (this._move ?? 1) + dt / this.moveDur);
    const ease = this._move * this._move * (3 - 2 * this._move);
    const k = this.snapNext ? 1 : Math.min(1, (1 - Math.exp(-4.6 * dt)) + ease * ease * dt * 6);
    this.current.lerp(this.target, k);
    this._distNow = lerp(this._distNow, this._dist, k);
    this._yawNow = lerp(this._yawNow, s.yaw, k);
    this._pitchNow = lerp(this._pitchNow, s.pitch, k);
    this.snapNext = false;

    this._parallax.lerp(this._parallaxTarget, 1 - Math.exp(-3.5 * dt));
    // a slow breath so a still frame never looks like a screenshot
    const drift = Math.sin(this._t * 0.21) * 0.012;
    const yaw = this._yawNow + this._parallax.x * 0.055 + drift;
    const pitch = this._pitchNow + this._parallax.y * 0.035;

    const d = this._distNow;
    const cp = Math.cos(pitch);
    const px = this.current.x + Math.sin(yaw) * cp * d;
    const py = this.current.y + Math.sin(pitch) * d;
    const pz = this.current.z + Math.cos(yaw) * cp * d;

    // Shake.  A person watching a mould crack from two metres away does not
    // have their head thrown 15 cm sideways; their view jolts a centimetre or
    // two and settles within a third of a second.  So the amplitude is small,
    // the decay is quick, and most of the motion is a slight roll rather than
    // translation -- which is what a startled head actually does.
    let sx = 0, sy = 0, roll = 0;
    if (this.shake > 0.001) {
      this.shake = Math.max(0, this.shake - dt * 4.2);
      const a = this.shake * this.shake * 0.016;
      sx = Math.sin(this._t * 38) * a;
      sy = Math.cos(this._t * 31) * a * 0.7;
      roll = Math.sin(this._t * 26) * this.shake * this.shake * 0.011;
    }
    this.camera.position.set(px + sx, py + sy, pz);
    this.camera.lookAt(this.current.x, this.current.y + sy * 0.4, this.current.z);
    if (roll) this.camera.rotateZ(roll);
  }

  /** project a world point to css pixels inside the canvas */
  project(v3, out) {
    const p = v3.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    out.x = r.left + ((p.x + 1) / 2) * r.width;
    out.y = r.top + ((-p.y + 1) / 2) * r.height;
    out.behind = p.z > 1;
    return out;
  }
}
