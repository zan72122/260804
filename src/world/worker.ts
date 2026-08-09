/**
 * The people who work this bog.
 *
 * The single strongest reason the farm read as a model kit was that nobody
 * was in it. With no figure in frame the eye has nothing to measure the
 * sluice, the beater or the truck against, and every guess it makes is
 * wrong. A person is also the answer to "who operates this?" — the beater
 * has handlebars, the sluice has a hand wheel, the pump has a lever, and
 * until now all of them were being worked by nobody.
 *
 * The figure is deliberately simple: chest waders, a jacket, a cap. It is
 * never close to the camera, so a readable silhouette and a believable walk
 * are worth far more than a face.
 */

import * as THREE from 'three';
import { clamp, damp } from '../core/math';

/** Eye height of an adult, in metres — the yardstick for the whole world. */
export const WORKER_HEIGHT = 1.78;

const JACKETS = ['#c85a2e', '#3f6f9c', '#8a8f3d', '#b0483f'];

export class Worker {
  readonly group = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly arms: THREE.Group[] = [];
  private readonly disposables: Array<{ dispose(): void }> = [];

  /** Gait phase, radians. */
  private phase = 0;
  private lean = 0;
  private lastX = 0;
  private lastZ = 0;
  private smoothedSpeed = 0;

  constructor(seed: number, jacketIndex = 0) {
    this.group.name = 'worker';

    const wader = new THREE.MeshStandardMaterial({ color: '#3c4a52', roughness: 0.55 });
    const jacket = new THREE.MeshStandardMaterial({
      color: JACKETS[jacketIndex % JACKETS.length],
      roughness: 0.82,
    });
    const skin = new THREE.MeshStandardMaterial({ color: '#c79a76', roughness: 0.78 });
    const cap = new THREE.MeshStandardMaterial({ color: '#2f3a3f', roughness: 0.85 });
    this.disposables.push(wader, jacket, skin, cap);

    // legs: hip pivot at 0.9, thigh + shin as one tapered limb each
    const legGeo = new THREE.CapsuleGeometry(0.098, 0.66, 3, 8);
    const bootGeo = new THREE.BoxGeometry(0.15, 0.09, 0.29);
    for (const dx of [-0.11, 0.11]) {
      const pivot = new THREE.Group();
      pivot.position.set(dx, 0.9, 0);
      const leg = new THREE.Mesh(legGeo, wader);
      leg.position.y = -0.43;
      leg.castShadow = true;
      pivot.add(leg);
      const boot = new THREE.Mesh(bootGeo, wader);
      boot.position.set(0, -0.85, 0.05);
      pivot.add(boot);
      this.legs.push(pivot);
      this.hips.add(pivot);
    }
    this.disposables.push(legGeo, bootGeo);

    // torso: waders up to the chest, jacket over the shoulders
    const bibGeo = new THREE.CapsuleGeometry(0.19, 0.34, 4, 10);
    const bib = new THREE.Mesh(bibGeo, wader);
    bib.position.y = 1.13;
    bib.scale.set(1.15, 1, 0.78);
    bib.castShadow = true;
    this.torso.add(bib);

    const jacketGeo = new THREE.CapsuleGeometry(0.205, 0.26, 4, 10);
    const jkt = new THREE.Mesh(jacketGeo, jacket);
    jkt.position.y = 1.36;
    jkt.scale.set(1.18, 1, 0.8);
    jkt.castShadow = true;
    this.torso.add(jkt);

    const neckGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.09, 6);
    const neck = new THREE.Mesh(neckGeo, skin);
    neck.position.y = 1.56;
    this.torso.add(neck);

    const headGeo = new THREE.SphereGeometry(0.098, 12, 10);
    const head = new THREE.Mesh(headGeo, skin);
    head.position.y = 1.65;
    head.scale.set(0.92, 1.08, 1);
    head.castShadow = true;
    this.torso.add(head);

    const capGeo = new THREE.SphereGeometry(0.104, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const capMesh = new THREE.Mesh(capGeo, cap);
    capMesh.position.y = 1.665;
    this.torso.add(capMesh);
    const peakGeo = new THREE.BoxGeometry(0.16, 0.018, 0.09);
    const peak = new THREE.Mesh(peakGeo, cap);
    peak.position.set(0, 1.665, 0.11);
    this.torso.add(peak);

    // arms
    const armGeo = new THREE.CapsuleGeometry(0.055, 0.44, 3, 8);
    for (const dx of [-0.235, 0.235]) {
      const pivot = new THREE.Group();
      pivot.position.set(dx, 1.46, 0);
      const arm = new THREE.Mesh(armGeo, jacket);
      arm.position.y = -0.27;
      arm.castShadow = true;
      pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), skin);
      hand.position.y = -0.53;
      pivot.add(hand);
      this.arms.push(pivot);
      this.torso.add(pivot);
    }
    this.disposables.push(bibGeo, jacketGeo, neckGeo, headGeo, capGeo, peakGeo, armGeo);

    this.group.add(this.hips, this.torso);
    void seed;
  }

  /**
   * Place the figure and step the gait from how far it actually moved. Tying
   * the stride to real displacement is what stops the classic ice-skating
   * look — the feet cannot slide, because the cycle is driven by the ground
   * covered rather than by a clock.
   */
  update(dt: number, x: number, y: number, z: number, facing: number): void {
    const moved = Math.hypot(x - this.lastX, z - this.lastZ);
    this.lastX = x;
    this.lastZ = z;
    const speed = moved / Math.max(dt, 1e-3);
    this.smoothedSpeed = damp(this.smoothedSpeed, speed, 6, dt);

    // ~0.72 m of ground per half-stride
    this.phase += (moved / 0.72) * Math.PI;
    const gait = clamp(this.smoothedSpeed / 1.2, 0, 1);
    const swing = Math.sin(this.phase) * 0.62 * gait;

    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    // the arms counter-swing, and lag the legs slightly
    const armSwing = Math.sin(this.phase - 0.35) * 0.42 * gait;
    this.arms[0].rotation.x = -armSwing;
    this.arms[1].rotation.x = armSwing;

    // the body rises and falls twice per stride, and leans into the walk
    const bounce = Math.abs(Math.cos(this.phase)) * 0.035 * gait;
    this.lean = damp(this.lean, gait * 0.09, 4, dt);
    this.hips.position.y = bounce;
    this.torso.position.y = bounce;
    this.torso.rotation.x = this.lean;
    this.torso.rotation.z = Math.sin(this.phase) * 0.035 * gait;

    this.group.position.set(x, y, z);
    this.group.rotation.y = facing;
  }

  /** Hold both hands out in front, as if on a handlebar. */
  gripForward(): void {
    this.arms[0].rotation.set(-1.02, 0, 0.16);
    this.arms[1].rotation.set(-1.02, 0, -0.16);
  }

  /** One hand raised to a wheel or a lever. */
  reachUp(t: number): void {
    this.arms[0].rotation.set(-2.1 + Math.sin(t) * 0.25, 0, 0.3);
    this.arms[1].rotation.set(-0.3, 0, -0.12);
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
