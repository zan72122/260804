// The crane: side rails, a bridge that travels in Z, a carriage that travels in
// X, a telescoping tube, and a three-fingered chrome claw.
//
// The claw is the second hero material — cold silver, brushed micro-scratches,
// visible joints and bolts, and it picks up the pink/blue of the cabinet LEDs
// from the environment map.

import * as THREE from '../vendor/three/three.module.min.js';
import { clawMetalMaterial, darkMetalMaterial, plasticMaterial, emissiveMaterial } from './materials.js';
import { CAB } from './cabinet.js';
import { mergeStatic } from './merge.js';
import { clamp, damp, lerp } from './util.js';

const OPEN = { upper: -0.62, lower: 0.12 };
const SHUT = { upper: -0.05, lower: 0.86 };

export class Claw {
  constructor(scene) {
    const metal = clawMetalMaterial();
    const dark = darkMetalMaterial();

    this.group = new THREE.Group();
    scene.add(this.group);

    /* ---- static side rails ---- */
    const railGeo = new THREE.BoxGeometry(0.07, 0.06, CAB.inZ * 2 - 0.02);
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(railGeo, metal);
      r.position.set(sx * (CAB.inX - 0.07), CAB.railY + 0.11, 0);
      this.group.add(r);
    }

    /* ---- bridge (moves in Z) ---- */
    this.bridge = new THREE.Group();
    this.group.add(this.bridge);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(CAB.inX * 2 - 0.1, 0.075, 0.075), metal);
    beam.position.y = CAB.railY + 0.11;
    this.bridge.add(beam);
    // trucks riding the rails
    for (const sx of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.16), dark);
      t.position.set(sx * (CAB.inX - 0.07), CAB.railY + 0.11, 0);
      this.bridge.add(t);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.14, 10), metal);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * (CAB.inX - 0.07), CAB.railY + 0.05, 0.055);
      this.bridge.add(w);
    }

    /* ---- carriage (moves in X along the bridge) ---- */
    this.carriage = new THREE.Group();
    this.bridge.add(this.carriage);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.18), plasticMaterial(0xe9edf3, { roughness: 0.35, metalness: 0.2 }));
    body.position.y = CAB.railY + 0.045;
    body.castShadow = true;
    this.carriage.add(body);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 14), dark);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(0, CAB.railY + 0.045, -0.1);
    this.carriage.add(motor);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), emissiveMaterial(0x6cff9a, 3));
    led.position.set(0.08, CAB.railY + 0.09, 0.09);
    this.carriage.add(led);
    this.led = led;
    this.ledMat = led.material;

    /* ---- telescoping tube from carriage to claw head ---- */
    this.tube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1, 10), metal);
    this.carriage.add(this.tube);
    this.tubeInner = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 1, 8), dark);
    this.carriage.add(this.tubeInner);

    /* ---- claw head ---- */
    this.head = new THREE.Group();
    this.head.scale.setScalar(1.15);   // the claw is a hero object; give it presence
    this.carriage.add(this.head);

    const hubTop = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.115, 0.09, 18), metal);
    hubTop.castShadow = true;
    this.head.add(hubTop);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.035, 18), dark);
    collar.position.y = -0.055;
    this.head.add(collar);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal);
    dome.position.y = 0.045;
    this.head.add(dome);
    // bolt ring
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 6), dark);
      b.position.set(Math.cos(a) * 0.095, 0.045, Math.sin(a) * 0.095);
      b.userData.mergeable = true;
      this.head.add(b);
    }
    mergeStatic(this.head);

    /* ---- three fingers ---- */
    this.fingers = [];
    for (let i = 0; i < 3; i++) {
      const yaw = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const root = new THREE.Group();
      root.rotation.y = yaw;
      this.head.add(root);

      const upperPivot = new THREE.Group();
      upperPivot.position.set(0, -0.062, 0.085);
      root.add(upperPivot);

      // shoulder joint
      const j1 = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 8), dark);
      upperPivot.add(j1);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.24, 10), metal);
      upper.position.y = -0.12;
      upper.scale.z = 0.62;
      upper.castShadow = true;
      upperPivot.add(upper);

      const lowerPivot = new THREE.Group();
      lowerPivot.position.y = -0.24;
      upperPivot.add(lowerPivot);
      const j2 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), dark);
      lowerPivot.add(j2);

      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.02, 0.21, 10), metal);
      lower.position.y = -0.105;
      lower.scale.z = 0.6;
      lower.castShadow = true;
      lowerPivot.add(lower);

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.021, 0.075, 10), metal);
      tip.position.y = -0.235;
      tip.rotation.x = Math.PI;
      tip.scale.z = 0.65;
      lowerPivot.add(tip);

      // rubber grip pad on the inside of the tip
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), plasticMaterial(0x33383f, { roughness: 0.85, clearcoat: 0.1 }));
      pad.position.set(0, -0.19, -0.018);
      pad.scale.set(0.9, 1.5, 0.5);
      lowerPivot.add(pad);

      const tipMarker = new THREE.Object3D();
      tipMarker.position.y = -0.27;
      lowerPivot.add(tipMarker);

      this.fingers.push({ root, upperPivot, lowerPivot, tipMarker });
    }

    /* ---- grip anchor: where a captured plush hangs from ---- */
    this.grip = new THREE.Object3D();
    this.grip.position.y = -0.30;
    this.head.add(this.grip);

    /* ---- state ---- */
    this.pos = new THREE.Vector3(0, CAB.clawHomeY, 0);   // logical claw head position (world)
    this.target = new THREE.Vector2(0, 0);                // desired x/z
    this.targetY = CAB.clawHomeY;
    this.closeAmount = 0;                                 // 0 open .. 1 shut
    this.closeTarget = 0;
    this.velocity = new THREE.Vector3();
    this._prev = this.pos.clone();
    this.followSpeed = 6.5;

    this._applyTransforms();
  }

  setAim(x, z) {
    this.target.set(
      clamp(x, -CAB.inX + 0.16, CAB.inX - 0.16),
      clamp(z, -CAB.inZ + 0.16, CAB.inZ - 0.16)
    );
  }

  /** World position of the point where a grabbed toy hangs. */
  gripWorld(out = new THREE.Vector3()) {
    return this.grip.getWorldPosition(out);
  }

  _applyTransforms() {
    this.bridge.position.z = this.pos.z;
    this.carriage.position.x = this.pos.x;
    const top = CAB.railY - 0.02;
    const len = Math.max(0.06, top - this.pos.y);
    this.tube.scale.y = len;
    this.tube.position.set(0, top - len / 2, 0);
    this.tubeInner.scale.y = len * 0.96;
    this.tubeInner.position.set(0, top - len * 0.48, 0);
    this.head.position.set(0, this.pos.y, 0);

    const t = this.closeAmount;
    const upper = lerp(OPEN.upper, SHUT.upper, t);
    const lower = lerp(OPEN.lower, SHUT.lower, t);
    for (const f of this.fingers) {
      f.upperPivot.rotation.x = upper;
      f.lowerPivot.rotation.x = lower;
    }
  }

  /**
   * @param {number} dt
   * @param {{instant?:boolean}} [opt]
   */
  update(dt, opt = {}) {
    this._prev.copy(this.pos);
    const s = opt.instant ? 1e9 : this.followSpeed;
    this.pos.x = damp(this.pos.x, this.target.x, s, dt);
    this.pos.z = damp(this.pos.z, this.target.y, s, dt);
    this.pos.y = damp(this.pos.y, this.targetY, opt.ySpeed ?? 7.0, dt);
    this.closeAmount = damp(this.closeAmount, this.closeTarget, opt.closeSpeed ?? 9.0, dt);
    if (dt > 0) this.velocity.copy(this.pos).sub(this._prev).divideScalar(dt);
    this._applyTransforms();
  }

  /** Squared horizontal distance from the claw axis, used for capture tests. */
  horizontalDistTo(x, z) {
    const dx = this.pos.x - x, dz = this.pos.z - z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}

