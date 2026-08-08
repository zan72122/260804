/**
 * The corral boom.
 *
 * Modelled the way a crew actually works one: a floating loop with two big
 * handle buoys on opposite sides, which you *haul in*. Dragging a handle
 * toward the middle takes in loop and the whole ring shrinks; dragging it
 * sideways slides the ring across the water; dragging outward lets it back
 * out. The gesture can be repeated as many times as the child likes, which
 * matters — one perfect drag is not a thing a four-year-old does.
 *
 * Geometrically it is just a circle, so the fruit has an exact signed
 * distance to push against and the ring is always a smooth closed curve no
 * matter how erratic the dragging was.
 */

import * as THREE from 'three';
import { clampToBog, type FieldVariant } from './layout';
import { clamp, damp } from '../core/math';

const FLOATS = 72;

export class Boom {
  readonly group = new THREE.Group();
  /** Ring centre on the water plane. */
  readonly centre = new THREE.Vector2();
  /** Ring radius. */
  radius = 9;

  /** Handle angles, always half a turn apart. */
  private angleA = 0;
  readonly handleA: THREE.Group;
  readonly handleB: THREE.Group;
  readonly posA = new THREE.Vector2();
  readonly posB = new THREE.Vector2();

  private readonly floats: THREE.InstancedMesh;
  private readonly skirts: THREE.InstancedMesh;
  private readonly disposables: Array<{ dispose(): void }> = [];

  private rMin = 4;
  private rMax = 9;
  private targetRadius = 9;
  /** Ramps 0→1 on deploy so nothing is shoved on the first frame. */
  strength = 0;
  private time = 0;

  /** Metres of ring taken in this frame — drives ripples and sound. */
  haulRate = 0;

  constructor(private readonly v: FieldVariant) {
    this.group.name = 'boom';

    const yellow = new THREE.MeshStandardMaterial({
      color: '#f4c623',
      roughness: 0.5,
      metalness: 0.05,
    });
    const white = new THREE.MeshStandardMaterial({ color: '#f2f4ee', roughness: 0.55 });
    const skirtMat = new THREE.MeshStandardMaterial({
      color: '#33403f',
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    this.disposables.push(yellow, white, skirtMat);

    const floatGeo = new THREE.CapsuleGeometry(0.26, 0.5, 3, 8);
    floatGeo.rotateZ(Math.PI / 2);
    this.floats = new THREE.InstancedMesh(floatGeo, yellow, FLOATS);
    this.floats.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FLOATS * 3), 3);
    const cy = new THREE.Color('#f4c623');
    const cw = new THREE.Color('#f6f7f1');
    for (let i = 0; i < FLOATS; i++) this.floats.setColorAt(i, i % 2 ? cy : cw);
    this.floats.instanceColor.needsUpdate = true;
    this.floats.frustumCulled = false;
    this.group.add(this.floats);
    this.disposables.push(floatGeo);

    // a skirt below the floats: this is what makes the ring read as a barrier
    const skirtGeo = new THREE.BoxGeometry(0.72, 0.42, 0.03);
    this.skirts = new THREE.InstancedMesh(skirtGeo, skirtMat, FLOATS);
    this.skirts.frustumCulled = false;
    this.group.add(this.skirts);
    this.disposables.push(skirtGeo);

    this.handleA = this.buildHandle(yellow, white);
    this.handleB = this.buildHandle(yellow, white);
    this.group.add(this.handleA, this.handleB);
  }

  private buildHandle(yellow: THREE.Material, white: THREE.Material): THREE.Group {
    const g = new THREE.Group();
    const buoyGeo = new THREE.SphereGeometry(0.62, 16, 12);
    const buoy = new THREE.Mesh(buoyGeo, yellow);
    buoy.scale.y = 0.84;
    g.add(buoy);
    const bandGeo = new THREE.TorusGeometry(0.6, 0.1, 10, 22);
    const band = new THREE.Mesh(bandGeo, white);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.1;
    g.add(band);
    const poleGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.3, 6);
    const pole = new THREE.Mesh(poleGeo, white);
    pole.position.y = 0.75;
    g.add(pole);
    // a grab ring on top: the visual affordance for "pull me"
    const ringGeo = new THREE.TorusGeometry(0.26, 0.06, 8, 18);
    const ring = new THREE.Mesh(ringGeo, yellow);
    ring.position.y = 1.4;
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
    this.disposables.push(buoyGeo, bandGeo, poleGeo, ringGeo);
    return g;
  }

  /**
   * Lay the boom around the floating fruit.
   * `perBerryArea` sets how tight the ring is allowed to get, so the squeeze
   * always ends packed rather than either crushed or still loose.
   */
  deploy(centre: THREE.Vector2, berryCount: number, perBerryArea: number): void {
    this.rMax = Math.min(this.v.halfX, this.v.halfZ) * 0.98;
    const targetArea = Math.max(10, berryCount * perBerryArea);
    this.rMin = clamp(Math.sqrt(targetArea / Math.PI), 1.8, this.rMax * 0.72);
    this.centre.copy(centre);
    clampToBog(this.v, this.centre, 1.0);
    this.radius = this.rMax;
    this.targetRadius = this.rMax;
    this.angleA = 0;
    this.strength = 0;
    this.updateHandlePositions();
  }

  private updateHandlePositions(): void {
    this.posA.set(
      this.centre.x + Math.cos(this.angleA) * this.radius,
      this.centre.y + Math.sin(this.angleA) * this.radius,
    );
    this.posB.set(
      this.centre.x - Math.cos(this.angleA) * this.radius,
      this.centre.y - Math.sin(this.angleA) * this.radius,
    );
  }

  /** Which handle a touch should grab. Extremely forgiving on purpose. */
  pickHandle(p: THREE.Vector2): 'a' | 'b' {
    return p.distanceToSquared(this.posA) <= p.distanceToSquared(this.posB) ? 'a' : 'b';
  }

  /**
   * Haul on a handle.
   *
   * The radial part of the drag takes the ring in or lets it out; the
   * tangential part swings the ring around and slides it a little, which is
   * what makes an untidy scribble still feel like it is doing something.
   */
  haul(which: 'a' | 'b', to: THREE.Vector2, dt: number): void {
    const sign = which === 'a' ? 1 : -1;
    const dx = to.x - this.centre.x;
    const dz = to.y - this.centre.y;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      this.targetRadius = clamp(this.targetRadius - 3 * dt, this.rMin, this.rMax);
      return;
    }
    const wantAngle = Math.atan2(dz, dx);
    const wantRadius = clamp(dist, this.rMin, this.rMax);

    // radius follows the finger, but only as fast as the fruit can be herded
    const maxRate = 4.5 * dt;
    const before = this.targetRadius;
    this.targetRadius = clamp(
      this.targetRadius + clamp(wantRadius - this.targetRadius, -maxRate, maxRate),
      this.rMin,
      this.rMax,
    );
    this.haulRate = Math.abs(before - this.targetRadius) / Math.max(dt, 1e-3);

    // swing the handle around the ring toward the finger, so the buoy stays
    // under the fingertip instead of snapping to a fixed axis
    const target = sign > 0 ? wantAngle : wantAngle + Math.PI;
    let diff = target - this.angleA;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angleA += clamp(diff, -2.4 * dt, 2.4 * dt);
  }

  /** 0 = wide open, 1 = as packed as this crop gets. */
  get tightness(): number {
    return clamp(1 - (this.radius - this.rMin) / Math.max(0.001, this.rMax - this.rMin), 0, 1);
  }

  get area(): number {
    return Math.PI * this.radius * this.radius;
  }

  /**
   * Containment for the fruit: how far outside the ring a point is (<= 0 when
   * inside), with an inward unit direction written into `out`.
   */
  contain = (x: number, z: number, out: THREE.Vector3): number => {
    if (this.strength <= 0.001) return -1;
    let dx = x - this.centre.x;
    let dz = z - this.centre.y;
    const d = Math.hypot(dx, dz);
    const limit = this.radius - 0.28;
    if (d <= limit) return -1;
    if (d < 1e-5) {
      dx = 1;
      dz = 0;
    } else {
      dx /= d;
      dz /= d;
    }
    out.set(-dx, 0, -dz);
    return (d - limit) * this.strength;
  };

  update(dt: number, waterHeight: (x: number, z: number) => number): void {
    this.time += dt;
    this.strength = Math.min(1, this.strength + dt * 0.85);
    this.haulRate = damp(this.haulRate, 0, 6, dt);
    this.radius = damp(this.radius, this.targetRadius, 6, dt);
    this.updateHandlePositions();

    const R = this.radius;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const tangent = new THREE.Vector3();
    const xAxis = new THREE.Vector3(1, 0, 0);
    const segLen = (Math.PI * 2 * R) / FLOATS;

    for (let i = 0; i < FLOATS; i++) {
      const a = (i / FLOATS) * Math.PI * 2;
      const px = this.centre.x + Math.cos(a) * R;
      const pz = this.centre.y + Math.sin(a) * R;
      const y = waterHeight(px, pz);
      tangent.set(-Math.sin(a), 0, Math.cos(a));
      q.setFromUnitVectors(xAxis, tangent);
      p.set(px, y + 0.05, pz);
      s.set(clamp(segLen / 1.02, 0.6, 2.6), 1, 1);
      m.compose(p, q, s);
      this.floats.setMatrixAt(i, m);

      p.set(px, y - 0.22, pz);
      s.set(clamp(segLen / 0.72, 0.6, 2.8), 1, 1);
      m.compose(p, q, s);
      this.skirts.setMatrixAt(i, m);
    }
    this.floats.instanceMatrix.needsUpdate = true;
    this.skirts.instanceMatrix.needsUpdate = true;

    const bobA = Math.sin(this.time * 1.9) * 0.04;
    const bobB = Math.sin(this.time * 1.9 + 1.7) * 0.04;
    this.handleA.position.set(this.posA.x, waterHeight(this.posA.x, this.posA.y) + bobA, this.posA.y);
    this.handleB.position.set(this.posB.x, waterHeight(this.posB.x, this.posB.y) + bobB, this.posB.y);
    this.handleA.rotation.z = Math.sin(this.time * 1.3) * 0.07;
    this.handleB.rotation.z = Math.sin(this.time * 1.3 + 2.1) * 0.07;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
