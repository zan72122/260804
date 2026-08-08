import {
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
  Vector3,
} from 'three';
import { PAL } from '../core/palette';
import { clamp01, damp, easeInOutSine, easeOutCubic, lerp, makeRng, randRange } from '../core/util';
import { bezier, DynamicTube, ellipsoid, lathe, mergeAll } from './geom';
import { FishKind } from './fish';

export type BirdState =
  | 'perch'
  | 'launch'
  | 'swim'
  | 'dive'
  | 'under'
  | 'rising'
  | 'surface'
  | 'board'
  | 'settle';

interface NeckPose {
  p1: Vector3;
  p2: Vector3;
  p3: Vector3;
}

const NECK_LEN = 8;

/**
 * Skull, bill, hooked tip, throat patch and eyes all live in one vertex-coloured
 * mesh — a cormorant's head is a dozen tiny painted pieces and there are five
 * birds on screen.
 */
const HEAD_MAT = new MeshPhysicalMaterial({
  vertexColors: true,
  roughness: 0.82,
  metalness: 0.02,
  clearcoat: 0.1,
  clearcoatRoughness: 0.55,
});

function pose(p1: number[], p2: number[], p3: number[]): NeckPose {
  return {
    p1: new Vector3(p1[0], p1[1], p1[2]),
    p2: new Vector3(p2[0], p2[1], p2[2]),
    p3: new Vector3(p3[0], p3[1], p3[2]),
  };
}

/** Neck shapes, in neck-base local space. Forward is -Z. */
const POSES: Record<string, NeckPose> = {
  alert: pose([0, 0.17, -0.15], [0, 0.36, 0.04], [0, 0.42, -0.12]),
  calm: pose([0, 0.14, -0.1], [0, 0.3, 0.02], [0, 0.34, -0.1]),
  swim: pose([0, 0.13, -0.14], [0, 0.26, -0.11], [0, 0.3, -0.25]),
  dive: pose([0, 0.1, -0.17], [0, 0.06, -0.33], [0, -0.02, -0.45]),
  hunt: pose([0, 0.09, -0.18], [0, 0.05, -0.34], [0, 0.03, -0.47]),
  proud: pose([0, 0.19, -0.13], [0, 0.4, -0.02], [0, 0.45, -0.2]),
};

/**
 * One cormorant, rigged rather than posed: a body, a Bezier neck that is
 * re-swept every frame, wings that flick when it breaks the surface, and the
 * neck ring the tezuna is tied to.
 *
 * All of the movement here is written to read at a glance and from a distance
 * — the tail-up tip into a dive, the head-first burst back out — because those
 * two shapes are what make a dark bird on dark water legible as a cormorant.
 */
export class Cormorant {
  readonly group = new Group();
  readonly index: number;
  state: BirdState = 'perch';

  /** World-space rope attachment (the neck ring). */
  readonly ringWorld = new Vector3();
  /** World-space beak tip; the fish rides here. */
  readonly beakWorld = new Vector3();

  hasFish = false;
  fishKind: FishKind = 'ayu';
  /** 0 while slack is being taken up, 1 when the bird is at the boat. */
  haulProgress = 0;
  /** Set once the bird has something and is waiting to be hauled. */
  waitingToHaul = false;

  readonly pos = new Vector3();
  private yaw = 0;
  private pitch = 0;
  private roll = 0;
  private targetYaw = 0;

  private timer = 0;
  private duration = 1;
  private from = new Vector3();
  private to = new Vector3();
  private searchTime = 3;
  private wanderSeed: number;
  private restTime = 1.4;

  private neck: DynamicTube;
  private neckPts: Vector3[] = [];
  private neckBase = new Vector3(0, 0.09, -0.24);
  private cur: NeckPose;
  private tgt: NeckPose;
  private headGroup = new Group();
  private ring: Mesh;
  private wings: Object3D[] = [];
  private tail: Mesh;
  private feet: Mesh;
  private wingLift = 0;
  private wingTarget = 0;
  private flickT = 10;
  private wet = 0;
  private under = 0;
  private feather: MeshPhysicalMaterial;
  private fishSlot = new Group();
  private rng: () => number;
  private tmp = new Vector3();
  private tmpA = new Vector3();
  private tmpB = new Vector3();
  private tmpC = new Vector3();
  private tmpD = new Vector3();
  private bobPhase: number;

  constructor(index: number) {
    this.index = index;
    this.rng = makeRng(4001 + index * 131);
    this.wanderSeed = randRange(this.rng, 0, 100);
    this.bobPhase = randRange(this.rng, 0, 6.28);

    this.feather = new MeshPhysicalMaterial({
      color: PAL.featherBase,
      roughness: 0.88,
      metalness: 0.02,
      clearcoat: 0.1,
      clearcoatRoughness: 0.6,
      iridescence: 0.12,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [140, 460],
    });
    const beakMat = new MeshStandardMaterial({ color: PAL.beak, roughness: 0.42, metalness: 0.12 });
    const throatMat = new MeshStandardMaterial({ color: PAL.featherThroat, roughness: 0.7 });
    const eyeMat = new MeshStandardMaterial({
      color: PAL.eye,
      emissive: PAL.eye,
      emissiveIntensity: 0.16,
      roughness: 0.2,
    });
    const pupilMat = new MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.3 });
    const ropeMat = new MeshStandardMaterial({ color: PAL.rope, roughness: 0.95 });

    // ---- body -------------------------------------------------------------
    const body = new Mesh(ellipsoid(0.155, 0.142, 0.33, 18), this.feather);
    body.position.set(0, 0, 0.03);
    // Breast, slightly proud of the body so the silhouette isn't one blob.
    const breast = new Mesh(ellipsoid(0.13, 0.115, 0.13, 14), this.feather);
    breast.position.set(0, -0.015, -0.19);
    const trunk = mergeAll([body, breast], this.feather);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    this.group.add(trunk);

    // ---- tail: long, stiff, and the thing that flips up on a dive ---------
    this.tail = new Mesh(
      lathe(
        [
          [0.001, 0],
          [0.075, 0.02],
          [0.062, 0.18],
          [0.042, 0.32],
          [0.001, 0.38],
        ],
        10,
      ),
      this.feather,
    );
    this.tail.rotation.x = -Math.PI / 2;
    this.tail.scale.set(1.35, 1, 0.42);
    this.tail.position.set(0, 0.02, 0.29);
    this.group.add(this.tail);

    // ---- wings ------------------------------------------------------------
    for (const side of [-1, 1]) {
      const pivot = new Group();
      pivot.position.set(side * 0.1, 0.05, 0.0);
      const wing = new Mesh(ellipsoid(0.055, 0.085, 0.245, 12), this.feather);
      wing.position.set(side * 0.05, 0, 0.03);
      wing.rotation.z = side * 0.16;
      // Primaries as a slim trailing blade — reads at small size.
      const prim = new Mesh(ellipsoid(0.022, 0.05, 0.13, 8), this.feather);
      prim.position.set(side * 0.07, -0.02, 0.22);
      prim.rotation.x = 0.2;
      const blade = mergeAll([wing, prim], this.feather);
      blade.castShadow = true;
      pivot.add(blade);
      pivot.userData.side = side;
      this.wings.push(pivot);
      this.group.add(pivot);
    }

    // ---- feet -------------------------------------------------------------
    const footMat = new MeshStandardMaterial({ color: 0x25201c, roughness: 0.75 });
    const webs: Mesh[] = [];
    for (const side of [-1, 1]) {
      const web = new Mesh(ellipsoid(0.05, 0.012, 0.075, 8), footMat);
      web.position.set(side * 0.065, -0.135, 0.06);
      webs.push(web);
    }
    this.feet = mergeAll(webs, footMat);
    this.group.add(this.feet);

    // ---- neck -------------------------------------------------------------
    this.neck = new DynamicTube(NECK_LEN, 8, this.feather);
    this.neck.setRadii((t) => lerp(0.072, 0.038, Math.pow(t, 0.8)));
    this.neck.mesh.castShadow = true;
    for (let i = 0; i < NECK_LEN; i++) this.neckPts.push(new Vector3());
    this.group.add(this.neck.mesh);

    this.cur = pose([0, 0.17, -0.15], [0, 0.36, 0.04], [0, 0.42, -0.12]);
    this.tgt = POSES.alert;

    // Neck ring (tanawa) — where the hand rope is tied.
    this.ring = new Mesh(new TorusGeometry(0.062, 0.017, 6, 14), ropeMat);
    this.group.add(this.ring);

    // ---- head -------------------------------------------------------------
    const headParts: Mesh[] = [];
    const skull = new Mesh(ellipsoid(0.058, 0.056, 0.085, 14), this.feather);
    headParts.push(skull);
    const nape = new Mesh(ellipsoid(0.05, 0.048, 0.05, 10), this.feather);
    nape.position.set(0, -0.01, 0.05);
    headParts.push(nape);

    const throat = new Mesh(ellipsoid(0.038, 0.03, 0.05, 10), throatMat);
    throat.position.set(0, -0.038, -0.035);
    headParts.push(throat);

    // Bill: long, with the hooked tip that says "cormorant" and nothing else.
    const bill = new Mesh(
      lathe(
        [
          [0.001, 0],
          [0.026, 0.012],
          [0.022, 0.09],
          [0.016, 0.15],
          [0.009, 0.185],
          [0.001, 0.195],
        ],
        8,
      ),
      beakMat,
    );
    bill.rotation.x = -Math.PI / 2;
    bill.scale.set(1, 1, 0.72);
    bill.position.set(0, -0.008, -0.07);
    headParts.push(bill);
    const hook = new Mesh(ellipsoid(0.011, 0.016, 0.018, 8), beakMat);
    hook.position.set(0, -0.004, -0.256);
    hook.rotation.x = 0.5;
    headParts.push(hook);
    const lowerBill = new Mesh(ellipsoid(0.016, 0.011, 0.075, 8), beakMat);
    lowerBill.position.set(0, -0.028, -0.135);
    headParts.push(lowerBill);

    for (const side of [-1, 1]) {
      const eye = new Mesh(ellipsoid(0.014, 0.014, 0.014, 8), eyeMat);
      eye.position.set(side * 0.043, 0.016, -0.036);
      headParts.push(eye);
      const pupil = new Mesh(ellipsoid(0.008, 0.008, 0.008, 6), pupilMat);
      pupil.position.set(side * 0.05, 0.016, -0.046);
      headParts.push(pupil);
    }
    const headMesh = mergeAll(headParts, HEAD_MAT, true);
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    this.fishSlot.position.set(0, -0.03, -0.18);
    this.headGroup.add(this.fishSlot);
    this.group.add(this.headGroup);

    this.group.scale.setScalar(1.05);
  }

  /** Give the bird a caught fish to carry home in its bill. */
  giveFish(kind: FishKind, mesh: Object3D): void {
    this.hasFish = true;
    this.fishKind = kind;
    mesh.position.set(0, 0, -0.02);
    mesh.rotation.set(0, Math.PI / 2, 0.3);
    mesh.scale.setScalar(0.9);
    this.fishSlot.add(mesh);
  }

  takeFish(): Object3D | null {
    const m = this.fishSlot.children[0];
    if (!m) return null;
    this.fishSlot.remove(m);
    this.hasFish = false;
    return m;
  }

  get idle(): boolean {
    return this.state === 'perch';
  }

  get submerged(): boolean {
    return this.state === 'under' || (this.state === 'dive' && this.timer > this.duration * 0.45);
  }

  /** Send the bird over the side. `entry` is where it should hit the water. */
  launch(fromWorld: Vector3, entry: Vector3): void {
    this.state = 'launch';
    this.timer = 0;
    this.duration = 0.72;
    this.from.copy(fromWorld);
    this.to.copy(entry);
    this.pos.copy(fromWorld);
    this.haulProgress = 0;
    this.waitingToHaul = false;
    this.searchTime = randRange(this.rng, 2.4, 4.6);
    this.targetYaw = Math.atan2(entry.x - fromWorld.x, entry.z - fromWorld.z) + Math.PI;
  }

  /** Player pulled the rope. Returns true if this stroke landed the bird. */
  haul(amount: number): boolean {
    if (this.state !== 'under' && this.state !== 'rising') return false;
    this.haulProgress = clamp01(this.haulProgress + amount);
    // Taking up slack is free, but the bird does not start coming up until it
    // actually has something — otherwise an eager player lands an empty bird.
    if (!this.waitingToHaul) this.haulProgress = Math.min(this.haulProgress, 0.33);
    if (this.state === 'under' && this.waitingToHaul && this.haulProgress > 0.34) {
      this.state = 'rising';
      this.from.copy(this.pos);
    }
    return this.haulProgress >= 1;
  }

  /** Put the bird back on the rail as if the evening had not happened yet. */
  reset(): void {
    this.state = 'perch';
    this.timer = 0;
    this.duration = 1;
    this.haulProgress = 0;
    this.waitingToHaul = false;
    this.hasFish = false;
    this.wingLift = 0;
    this.wingTarget = 0;
    this.flickT = 10;
    this.wet = 0;
    this.under = 0;
    this.pitch = 0;
    this.roll = 0;
  }

  /** Nobody comes up empty-handed: bring the search to an end right now. */
  hurryFind(): void {
    if (this.state === 'under' && !this.waitingToHaul) {
      this.searchTime = Math.min(this.searchTime, this.timer);
    }
  }

  private setPose(name: keyof typeof POSES): void {
    this.tgt = POSES[name];
  }

  update(
    dt: number,
    t: number,
    ctx: {
      perch: Vector3;
      perchOutward: number;
      hand: Vector3;
      surfaceAt: (x: number, z: number) => number;
      onSplash: (p: Vector3, power: number) => void;
      onBubbles: (p: Vector3, n: number) => void;
      onRipple: (x: number, z: number, s: number) => void;
      onBoard: (bird: Cormorant) => void;
      onFound: (bird: Cormorant) => void;
      onSurfaced: (bird: Cormorant) => void;
    },
  ): void {
    this.timer += dt;
    const surf = ctx.surfaceAt(this.pos.x, this.pos.z);

    switch (this.state) {
      case 'perch':
      case 'settle': {
        this.pos.copy(ctx.perch);
        this.pos.y += 0.155 + Math.sin(t * 1.6 + this.bobPhase) * 0.012;
        this.targetYaw = ctx.perchOutward;
        this.pitch = damp(this.pitch, -0.06, 6, dt);
        this.roll = damp(this.roll, 0, 6, dt);
        this.setPose(this.hasFish ? 'proud' : t % 7 < 3.2 ? 'alert' : 'calm');
        this.wingTarget = 0;
        if (this.state === 'settle' && this.timer > this.restTime) this.state = 'perch';
        break;
      }

      case 'launch': {
        const k = clamp01(this.timer / this.duration);
        const e = easeInOutSine(k);
        this.tmp.lerpVectors(this.from, this.to, e);
        // A real leap: up and out, then a nose-down entry.
        this.tmp.y += Math.sin(k * Math.PI) * 0.42 - k * k * 0.1;
        this.pos.copy(this.tmp);
        this.pitch = damp(this.pitch, lerp(0.25, -0.75, clamp01(k * 1.5 - 0.25)), 9, dt);
        this.setPose(k < 0.5 ? 'alert' : 'dive');
        this.wingTarget = k < 0.72 ? 0.85 : 0.2;
        if (k >= 1) {
          ctx.onSplash(this.pos, 0.8);
          ctx.onRipple(this.pos.x, this.pos.z, 1.0);
          this.state = 'swim';
          this.timer = 0;
          this.duration = randRange(this.rng, 0.9, 1.7);
          this.wet = 1;
        }
        break;
      }

      case 'swim': {
        // Paddle a little further out before going down.
        const dir = this.tmpA.set(Math.sin(this.yaw + Math.PI), 0, Math.cos(this.yaw + Math.PI));
        this.pos.addScaledVector(dir, dt * 0.55);
        this.pos.y = damp(this.pos.y, surf - 0.055, 7, dt);
        this.pitch = damp(this.pitch, -0.05, 6, dt);
        this.roll = Math.sin(t * 3.1 + this.bobPhase) * 0.06;
        this.setPose('swim');
        this.wingTarget = 0;
        if (Math.random() < dt * 2.2) ctx.onRipple(this.pos.x, this.pos.z, 0.22);
        if (this.timer > this.duration) {
          this.state = 'dive';
          this.timer = 0;
          this.duration = 0.72;
          this.from.copy(this.pos);
          this.to.set(this.pos.x, -0.85, this.pos.z - 0.55);
        }
        break;
      }

      case 'dive': {
        const k = clamp01(this.timer / this.duration);
        // Rear up, tip head-down, slide under, tail last.
        const e = easeOutCubic(k);
        this.pos.lerpVectors(this.from, this.to, e);
        this.pos.y += Math.sin(k * Math.PI) * 0.14 * (1 - k);
        this.pitch = lerp(0.32, -1.15, easeInOutSine(clamp01(k * 1.35)));
        this.setPose('dive');
        this.wingTarget = 0;
        if (this.timer - dt < 0.1 && this.timer >= 0.1) {
          ctx.onSplash(this.pos, 1.15);
          ctx.onRipple(this.pos.x, this.pos.z, 1.35);
          ctx.onBubbles(this.pos, 14);
        }
        if (k >= 1) {
          this.state = 'under';
          this.timer = 0;
        }
        break;
      }

      case 'under': {
        // Slow underwater sweep, nose first.
        const w = this.wanderSeed;
        const drift = this.tmpA.set(
          Math.sin(t * 0.5 + w) * 0.35,
          0,
          Math.cos(t * 0.42 + w * 1.3) * 0.3,
        );
        this.pos.x = damp(this.pos.x, this.from.x + drift.x, 1.2, dt);
        this.pos.z = damp(this.pos.z, this.from.z + drift.z, 1.2, dt);
        this.pos.y = damp(this.pos.y, -0.72 + Math.sin(t * 0.9 + w) * 0.13, 2.0, dt);
        this.pitch = damp(this.pitch, Math.sin(t * 0.8 + w) * 0.18, 3, dt);
        this.targetYaw = this.yaw + Math.sin(t * 0.4 + w) * 0.5 * dt;
        this.roll = damp(this.roll, Math.sin(t * 1.1 + w) * 0.12, 3, dt);
        this.setPose('hunt');
        this.wingTarget = 0;

        if (Math.random() < dt * 7.0) ctx.onBubbles(this.pos, 2);
        if (Math.random() < dt * 1.6) ctx.onRipple(this.pos.x, this.pos.z, 0.26);
        if (!this.waitingToHaul && this.timer > this.searchTime) {
          this.waitingToHaul = true;
          ctx.onFound(this);
          ctx.onBubbles(this.pos, 10);
          ctx.onRipple(this.pos.x, this.pos.z, 0.55);
        }
        break;
      }

      case 'rising': {
        // Reeled in: toward the boat and up, faster as the rope shortens.
        const k = clamp01((this.haulProgress - 0.34) / 0.66);
        const target = this.tmpB.copy(ctx.hand);
        target.y = -0.05;
        target.z += 0.35;
        this.pos.lerpVectors(this.from, target, easeInOutSine(k) * 0.92);
        this.pos.y = lerp(this.from.y, -0.06, easeOutCubic(k));
        this.pitch = damp(this.pitch, lerp(-0.3, 0.35, k), 5, dt);
        this.setPose(k > 0.5 ? 'swim' : 'hunt');
        this.targetYaw = Math.atan2(ctx.hand.x - this.pos.x, ctx.hand.z - this.pos.z);
        if (Math.random() < dt * 8) ctx.onBubbles(this.pos, 1);
        if (Math.random() < dt * 5) ctx.onRipple(this.pos.x, this.pos.z, 0.28);
        if (this.haulProgress >= 1) {
          this.state = 'surface';
          this.timer = 0;
          this.duration = 0.85;
          ctx.onSplash(this.pos, 1.5);
          ctx.onRipple(this.pos.x, this.pos.z, 1.5);
          ctx.onSurfaced(this);
          this.flickT = 0;
          this.wet = 1;
        }
        break;
      }

      case 'surface': {
        const k = clamp01(this.timer / this.duration);
        this.pos.y = damp(this.pos.y, surf + 0.02, 9, dt);
        this.pitch = damp(this.pitch, 0.1, 6, dt);
        this.setPose('proud');
        this.roll = Math.sin(t * 14) * 0.08 * (1 - k);
        if (k >= 1) {
          this.state = 'board';
          this.timer = 0;
          this.duration = 0.8;
          this.from.copy(this.pos);
        }
        break;
      }

      case 'board': {
        const k = clamp01(this.timer / this.duration);
        this.to.copy(ctx.perch).setY(ctx.perch.y + 0.155);
        this.pos.lerpVectors(this.from, this.to, easeInOutSine(k));
        this.pos.y += Math.sin(k * Math.PI) * 0.34;
        this.pitch = damp(this.pitch, 0.12, 6, dt);
        this.targetYaw = ctx.perchOutward;
        this.wingTarget = k < 0.8 ? 0.95 : 0.15;
        this.setPose('proud');
        if (k >= 1) {
          this.state = 'settle';
          this.timer = 0;
          this.restTime = randRange(this.rng, 1.1, 2.2);
          this.flickT = 0;
          ctx.onBoard(this);
          this.haulProgress = 0;
          this.waitingToHaul = false;
        }
        break;
      }
    }

    // --- orientation -------------------------------------------------------
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 7);
    this.group.position.copy(this.pos);
    this.group.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');

    // --- wings -------------------------------------------------------------
    if (this.flickT < 1) {
      this.flickT += dt * 1.7;
      // Two quick shakes, the way a bird sheds water.
      this.wingTarget = Math.max(this.wingTarget, Math.sin(this.flickT * Math.PI * 2.2) * 0.75);
    }
    this.wingLift = damp(this.wingLift, this.wingTarget, 11, dt);
    for (const w of this.wings) {
      const side = w.userData.side as number;
      w.rotation.z = side * (this.wingLift * 0.85 + 0.02);
      w.rotation.x = -this.wingLift * 0.22;
      w.position.x = side * (0.1 + this.wingLift * 0.035);
    }
    this.feet.visible = this.state === 'perch' || this.state === 'settle';
    // Tail lifts as the bird tips into a dive: the classic ukai silhouette.
    this.tail.rotation.x = -Math.PI / 2 + clamp01(-this.pitch) * 0.55;

    // --- neck --------------------------------------------------------------
    const k = Math.min(1, dt * 7);
    this.cur.p1.lerp(this.tgt.p1, k);
    this.cur.p2.lerp(this.tgt.p2, k);
    this.cur.p3.lerp(this.tgt.p3, k);
    // A little live sway so the bird never freezes.
    const sway = Math.sin(t * 2.3 + this.bobPhase) * 0.012;
    const p0 = this.neckBase;
    const p1 = this.tmpA.copy(p0).add(this.cur.p1);
    const p2 = this.tmpB.copy(p0).add(this.cur.p2);
    const p3 = this.tmp.copy(p0).add(this.cur.p3);
    p1.x += sway;
    p2.x += sway * 1.6;
    p3.x += sway * 1.2;
    for (let i = 0; i < NECK_LEN; i++) {
      bezier(p0, p1, p2, p3, i / (NECK_LEN - 1), this.neckPts[i]);
    }
    this.neck.update(this.neckPts);

    // Head rides the tip of the neck and looks the way the neck points.
    this.headGroup.position.copy(p3);
    const tan = this.tmpC.copy(p3).sub(p2).normalize();
    this.headGroup.rotation.set(Math.atan2(tan.y, -tan.z), 0, 0);

    // Neck ring (tanawa) sits a little way up from the shoulders, square to
    // the neck — this is what the tezuna is actually tied to.
    bezier(p0, p1, p2, p3, 0.22, this.tmpD);
    this.ring.position.copy(this.tmpD);
    const rt = this.tmpC.copy(this.neckPts[3]).sub(this.neckPts[1]).normalize();
    this.ring.rotation.set(Math.atan2(-rt.y, rt.z), 0, 0);

    // --- world anchors -----------------------------------------------------
    this.group.updateMatrixWorld(true);
    this.ringWorld.copy(this.ring.position).applyMatrix4(this.group.matrixWorld);
    this.beakWorld.set(0, -0.02, -0.24).applyMatrix4(this.headGroup.matrixWorld);

    // --- wet sheen ---------------------------------------------------------
    this.wet = Math.max(0, this.wet - dt * 0.16);
    const wetness = Math.max(this.submerged ? 1 : 0, this.wet);
    // Dry, a cormorant is matte soot; the moment it comes out of the river it
    // is lacquer. That contrast is most of what sells the dive.
    this.feather.clearcoat = 0.08 + wetness * 0.62;
    this.feather.clearcoatRoughness = 0.6 - wetness * 0.42;
    this.feather.roughness = 0.9 - wetness * 0.42;
    // A diving cormorant carries a skin of trapped air; under the surface that
    // reads as a faint silver shape rather than as nothing at all, which is
    // exactly what the player needs to be able to see.
    this.under = damp(this.under, this.pos.y < -0.08 ? 1 : 0, 4, dt);
    this.feather.emissive.setRGB(0.1 * this.under, 0.16 * this.under, 0.22 * this.under);
    this.feather.emissiveIntensity = 1;
  }
}
