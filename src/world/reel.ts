/**
 * The water reel ("egg-beater").
 *
 * Deliberately *not* boat-shaped, mower-shaped or tractor-shaped: two slim
 * pontoons, a bright hood, and — the point of the whole machine — two big
 * exposed paddle drums that turn on a transverse axis and beat the water
 * right at the surface line. The drums are the largest, clearest thing on
 * the machine, because they are what does the work the child needs to see.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clampToBog, type FieldVariant } from './layout';
import { clamp, damp, smoothstep } from '../core/math';

/**
 * How close the machine may get to the fingertip before it stops steering.
 * Roughly its own half-length: past this the bearing to the finger is not
 * meaningful any more, it is just noise.
 */
const DEAD_ZONE = 1.6;

export class Reel {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector2(0, 0);
  /** Heading in radians (0 = +Z). */
  heading = 0;
  /**
   * A lazier copy of the heading for the chase camera to sit behind. Keeping
   * these separate means the machine can answer the finger immediately while
   * the frame still swings gently — which is the whole trick to a follow cam
   * a small child can watch without feeling sick.
   */
  viewHeading = 0;
  /** Metres per second right now. */
  speed = 0;
  /** Reel rotation, radians. */
  spin = 0;

  private readonly drums: THREE.Group[] = [];
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly hull = new THREE.Group();
  private bob = 0;
  private roll = 0;
  /** Angular velocity actually applied, rad/s — drives the hull lean. */
  private turnRate = 0;
  /** Smoothed flotation height, so the hull cannot buzz vertically. */
  private floatY = Number.NaN;
  /** True while the machine is actively chasing the finger. */
  private engaged = false;

  /** World-space centre of the churn, a little behind the drums. */
  readonly churn = new THREE.Vector3();
  /** How wide a swathe the machine strips, in world units. */
  readonly swathe = 2.2;

  constructor(private readonly v: FieldVariant) {
    this.group.name = 'reel';
    this.group.add(this.hull);

    const steel = new THREE.MeshStandardMaterial({
      color: '#8d97a2',
      roughness: 0.38,
      metalness: 0.8,
    });
    const hood = new THREE.MeshStandardMaterial({
      color: '#e5b524',
      roughness: 0.48,
      metalness: 0.2,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: '#3c4348',
      roughness: 0.62,
      metalness: 0.45,
    });
    const white = new THREE.MeshStandardMaterial({ color: '#eceee6', roughness: 0.55 });
    this.disposables.push(steel, hood, dark, white);

    /* ---- pontoons: long, low, slightly tapered ---- */
    const pontoonGeo = new THREE.CapsuleGeometry(0.38, 2.9, 4, 10);
    pontoonGeo.rotateX(Math.PI / 2);
    for (const dx of [-1.55, 1.55]) {
      const p = new THREE.Mesh(pontoonGeo, hood);
      p.position.set(dx, 0.06, -0.25);
      p.castShadow = true;
      this.hull.add(p);
    }
    this.disposables.push(pontoonGeo);

    /* ---- cross frame ---- */
    const barGeo = new THREE.BoxGeometry(3.5, 0.16, 0.24);
    for (const dz of [-1.35, 0.15, 1.15]) {
      const b = new THREE.Mesh(barGeo, steel);
      b.position.set(0, 0.5, dz);
      this.hull.add(b);
    }
    this.disposables.push(barGeo);

    /* ---- the two paddle drums ---- */
    // Eighty little arms would be eighty draw calls; the whole paddle rack
    // is baked into two merged geometries per drum instead.
    const armSrc = new THREE.BoxGeometry(0.09, 0.62, 0.09);
    const bladeSrc = new THREE.BoxGeometry(0.34, 0.26, 0.1);
    const armParts: THREE.BufferGeometry[] = [];
    const bladeParts: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    const e = new THREE.Euler();
    const arms = 8;
    const rows = 5;
    for (let a = 0; a < arms; a++) {
      const ang = (a / arms) * Math.PI * 2;
      for (let r = 0; r < rows; r++) {
        const x = -1.28 + (r / (rows - 1)) * 2.56;
        e.set(-ang, 0, 0);
        m.makeRotationFromEuler(e);
        m.setPosition(x, Math.cos(ang) * 0.36, Math.sin(ang) * 0.36);
        armParts.push(armSrc.clone().applyMatrix4(m));
        e.set(-ang + 0.4, 0, 0);
        m.makeRotationFromEuler(e);
        m.setPosition(x, Math.cos(ang) * 0.7, Math.sin(ang) * 0.7);
        bladeParts.push(bladeSrc.clone().applyMatrix4(m));
      }
    }
    const armGeo = mergeGeometries(armParts, false)!;
    const bladeGeo = mergeGeometries(bladeParts, false)!;
    armParts.forEach((g) => g.dispose());
    bladeParts.forEach((g) => g.dispose());
    armSrc.dispose();
    bladeSrc.dispose();

    const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 3.05, 10);
    hubGeo.rotateZ(Math.PI / 2);

    const drumZ = [0.95, -0.55];
    for (let d = 0; d < 2; d++) {
      const drum = new THREE.Group();
      drum.position.set(0, 0.32, drumZ[d]);
      drum.add(new THREE.Mesh(hubGeo, dark));
      drum.add(new THREE.Mesh(armGeo, steel));
      // bright paddles on both drums: the child has to see them turn
      drum.add(new THREE.Mesh(bladeGeo, d === 0 ? hood : white));
      this.drums.push(drum);
      this.hull.add(drum);
    }
    this.disposables.push(hubGeo, armGeo, bladeGeo);

    /* ---- hood over the front drum, so the machine reads as purpose-built ---- */
    const shroudGeo = new THREE.CylinderGeometry(0.98, 0.98, 3.2, 14, 1, true, Math.PI * 0.06, Math.PI * 0.88);
    shroudGeo.rotateZ(Math.PI / 2);
    const shroud = new THREE.Mesh(shroudGeo, hood);
    shroud.material.side = THREE.DoubleSide;
    shroud.position.set(0, 0.32, 0.95);
    shroud.castShadow = true;
    this.hull.add(shroud);
    this.disposables.push(shroudGeo);

    /* ---- drive housing + mast ---- */
    const boxGeo = new THREE.BoxGeometry(1.05, 0.66, 1.1);
    const housing = new THREE.Mesh(boxGeo, dark);
    housing.position.set(0, 0.78, -1.2);
    housing.castShadow = true;
    this.hull.add(housing);
    this.disposables.push(boxGeo);

    const mastGeo = new THREE.CylinderGeometry(0.055, 0.055, 1.5, 6);
    const mast = new THREE.Mesh(mastGeo, steel);
    mast.position.set(0, 1.6, -1.2);
    this.hull.add(mast);
    this.disposables.push(mastGeo);

    const beaconGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: '#ffb4c4',
      emissive: '#ff5f86',
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 2.4, -1.2);
    this.hull.add(beacon);
    this.disposables.push(beaconGeo, beaconMat);

    // handlebar — reads as "a person walks this thing"
    const barsGeo = new THREE.TorusGeometry(0.5, 0.06, 6, 14, Math.PI);
    const bars = new THREE.Mesh(barsGeo, steel);
    bars.position.set(0, 1.05, -1.75);
    bars.rotation.x = Math.PI / 2.6;
    this.hull.add(bars);
    this.disposables.push(barsGeo);
  }

  /** Place the machine before the reel scene starts. */
  reset(x: number, z: number, heading: number): void {
    this.pos.set(x, z);
    this.heading = heading;
    this.speed = 0;
    this.spin = 0;
    this.turnRate = 0;
    this.roll = 0;
    this.floatY = Number.NaN;
    this.engaged = false;
    this.viewHeading = heading;
  }

  /**
   * Steer toward a world-space target.
   *
   * The dead zone is the important part. Without it the machine drives at
   * the fingertip, overshoots it, and the bearing to the finger then swings
   * wildly as it crosses over — heading jitters, the hull rocks, and because
   * the chase camera is anchored to the heading the whole picture shakes.
   * Inside DEAD_ZONE the machine simply holds its heading and coasts to a
   * stop under the finger, which is also what a child expects to happen.
   *
   * The threshold is hysteretic because the chase camera turns a *held*
   * fingertip into a slowly moving world target: without it the machine
   * would sit on the boundary steering on and off forever.
   */
  steerTo(target: THREE.Vector2, throttle: number, dt: number): void {
    const dx = target.x - this.pos.x;
    const dz = target.y - this.pos.y;
    const dist = Math.hypot(dx, dz);

    const threshold = this.engaged ? DEAD_ZONE : DEAD_ZONE * 1.7;
    this.engaged = dist > threshold;

    if (this.engaged) {
      const want = Math.atan2(dx, dz);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // ease the turn down as the bearing error shrinks, so the last few
      // degrees are approached rather than bounced between
      const maxTurn = 2.1 * dt;
      const turn = clamp(diff * 0.6, -maxTurn, maxTurn);
      this.heading += turn;
      this.turnRate = damp(this.turnRate, turn / Math.max(dt, 1e-3), 7, dt);
    } else {
      this.turnRate = damp(this.turnRate, 0, 6, dt);
    }

    // Lean into the turn the machine is *actually* making, never into the
    // raw bearing error — that error changes sign far too readily.
    this.roll = damp(this.roll, clamp(this.turnRate * 0.16, -0.22, 0.22), 5, dt);

    // Speed reaches zero *at* the dead zone, not inside it. If the machine
    // were still creeping where it has stopped steering it would sail past
    // the finger, re-acquire, turn back, and orbit forever.
    const reach = this.engaged ? smoothstep((dist - DEAD_ZONE) / 1.8) : 0;
    this.speed = damp(this.speed, clamp(throttle, 0, 1) * 3.0 * reach, 3.0, dt);
  }

  coast(dt: number): void {
    this.engaged = false;
    this.speed = damp(this.speed, 0, 2.2, dt);
    this.turnRate = damp(this.turnRate, 0, 4, dt);
    this.roll = damp(this.roll, 0, 4, dt);
  }

  update(dt: number, waterHeight: (x: number, z: number) => number): void {
    let lag = this.heading - this.viewHeading;
    while (lag > Math.PI) lag -= Math.PI * 2;
    while (lag < -Math.PI) lag += Math.PI * 2;
    this.viewHeading = damp(this.viewHeading + lag, this.heading, 2.4, dt);

    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.y += Math.cos(this.heading) * this.speed * dt;
    clampToBog(this.v, this.pos, 2.0);

    // drums always turn a little, faster when travelling
    const rpm = 5.2 + this.speed * 3.6;
    this.spin += rpm * dt;
    this.drums[0].rotation.x = -this.spin;
    this.drums[1].rotation.x = -this.spin * 1.15 + 0.4;

    this.bob += dt * (2.4 + this.speed);
    // A hull has mass: it follows the surface, it does not snap to it.
    const wh = waterHeight(this.pos.x, this.pos.y) - 0.22;
    this.floatY = Number.isNaN(this.floatY) ? wh : damp(this.floatY, wh, 6, dt);
    this.group.position.set(this.pos.x, this.floatY + Math.sin(this.bob) * 0.035, this.pos.y);
    this.group.rotation.y = this.heading;
    this.hull.rotation.z = this.roll;
    this.hull.rotation.x = Math.sin(this.bob * 0.7) * 0.02 - this.speed * 0.015;

    this.churn.set(
      this.pos.x - Math.sin(this.heading) * 0.2,
      wh,
      this.pos.y - Math.cos(this.heading) * 0.2,
    );
  }

  /** Front of the machine, where the paddles actually enter the water. */
  frontPoint(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(
      this.pos.x + Math.sin(this.heading) * 1.0,
      this.group.position.y + 0.3,
      this.pos.y + Math.cos(this.heading) * 1.0,
    );
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
