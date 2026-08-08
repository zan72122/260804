import {
  CapsuleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  TorusGeometry,
  Vector3,
} from 'three';
import { PAL } from '../core/palette';
import { clamp, clamp01, damp, easeInOutSine, makeRng, randRange, TAU } from '../core/util';
import { ellipsoid, lathe, mergeAll, roundedBox, tubeThrough } from './geom';

const UP = new Vector3(0, 1, 0);

/** Point a unit-tall (along +Y, centred) mesh from `a` to `b`. */
function aim(o: Object3D, a: Vector3, b: Vector3, tmp: Vector3, q: Quaternion): void {
  tmp.subVectors(b, a);
  const len = tmp.length() || 1e-4;
  o.position.copy(a).addScaledVector(tmp, 0.5);
  tmp.divideScalar(len);
  q.setFromUnitVectors(UP, tmp);
  o.quaternion.copy(q);
  o.scale.y = len;
}

/** Two-bone analytic IK. Returns the elbow position. */
function solveIK(
  shoulder: Vector3,
  target: Vector3,
  l1: number,
  l2: number,
  pole: Vector3,
  out: Vector3,
  tmpDir: Vector3,
  tmpAxis: Vector3,
): void {
  tmpDir.subVectors(target, shoulder);
  let d = tmpDir.length();
  const min = Math.abs(l1 - l2) + 0.01;
  const max = l1 + l2 - 0.01;
  d = clamp(d, min, max);
  tmpDir.normalize();
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a = Math.acos(cosA);
  tmpAxis.crossVectors(tmpDir, pole);
  if (tmpAxis.lengthSq() < 1e-8) tmpAxis.set(0, 1, 0);
  tmpAxis.normalize();
  out.copy(tmpDir).applyAxisAngle(tmpAxis, -a).multiplyScalar(l1).add(shoulder);
}

export type FigureKind = 'usho' | 'nakanori';

/**
 * The usho. A grown-up does the dangerous work; the player's finger only ever
 * helps. His left fist holds the whole bundle of tezuna at once — the detail
 * that makes the fan of ropes make sense — and his right arm works hand over
 * hand when the player hauls.
 */
export class Figure {
  readonly group = new Group();
  /** World point where every rope begins (the left fist). */
  readonly handWorld = new Vector3();

  private torso = new Group();
  private head = new Group();
  private upperArms: Mesh[] = [];
  private foreArms: Mesh[] = [];
  private hands: Group[] = [];
  private sleeves: Mesh[] = [];
  private shoulders: Vector3[] = [];
  private leftHandLocal = new Vector3();
  private handTargets: Vector3[] = [];
  private handCurrent: Vector3[] = [];
  private ropeBundle = new Group();

  private haulPhase = 1.2;
  private haulQueue = 0;
  private fanPhase = 1.2;
  private sway = 0;
  private lookYaw = 0;
  private lookTarget = 0;
  private rng: () => number;
  private bob: number;
  private pole?: Mesh;

  private tmp = new Vector3();
  private tmp2 = new Vector3();
  private tmp3 = new Vector3();
  private elbow = new Vector3();
  private q = new Quaternion();

  private readonly L1 = 0.3;
  private readonly L2 = 0.29;

  constructor(kind: FigureKind = 'usho', seed = 1) {
    this.rng = makeRng(6100 + seed * 97);

    const robeCol = kind === 'usho' ? PAL.robe : 0x1d2233;
    const robe = new MeshStandardMaterial({
      color: robeCol,
      roughness: 0.86,
      metalness: 0.02,
      side: DoubleSide,
    });
    const trim = new MeshStandardMaterial({ color: PAL.robeTrim, roughness: 0.78 });
    const straw = new MeshStandardMaterial({ color: PAL.strawSkirt, roughness: 0.95, side: DoubleSide });
    const skin = new MeshStandardMaterial({ color: PAL.skin, roughness: 0.68 });
    const hatMat = new MeshStandardMaterial({ color: 0x101116, roughness: 0.42, metalness: 0.08 });
    const dark = new MeshStandardMaterial({ color: 0x0e1017, roughness: 0.9 });

    // ---- torso: a lathe so the robe has real fall ------------------------
    const body = new Mesh(
      lathe(
        [
          [0.001, 0],
          [0.19, 0.0],
          [0.2, 0.1],
          [0.185, 0.34],
          [0.175, 0.52],
          [0.185, 0.62],
          [0.15, 0.7],
          [0.09, 0.74],
          [0.001, 0.745],
        ],
        16,
      ),
      robe,
    );
    body.castShadow = true;
    body.receiveShadow = true;
    this.torso.add(body);

    // Crossed collar.
    for (const side of [-1, 1]) {
      const lapel = new Mesh(roundedBox(0.075, 0.3, 0.045, 0.02), trim);
      lapel.position.set(side * 0.045, 0.58, -0.135);
      lapel.rotation.z = side * 0.28;
      lapel.rotation.x = -0.12;
      this.torso.add(lapel);
    }
    // Obi.
    const obi = new Mesh(new CylinderGeometry(0.196, 0.192, 0.1, 16), trim);
    obi.position.y = 0.3;
    this.torso.add(obi);

    // ---- koshimino: the straw skirt, strand by strand ---------------------
    if (kind === 'usho') {
      const cone = new Mesh(
        lathe(
          [
            [0.001, 0.0],
            [0.24, 0.0],
            [0.25, 0.02],
            [0.235, 0.2],
            [0.19, 0.34],
          ],
          16,
        ),
        straw,
      );
      cone.castShadow = true;
      this.torso.add(cone);
      const strands: Mesh[] = [];
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU;
        const h = randRange(this.rng, 0.24, 0.36);
        const strand = new Mesh(
          tubeThrough(
            [
              new Vector3(Math.cos(a) * 0.2, 0.34, Math.sin(a) * 0.2),
              new Vector3(Math.cos(a) * 0.245, 0.34 - h * 0.55, Math.sin(a) * 0.245),
              new Vector3(Math.cos(a) * 0.255, 0.34 - h, Math.sin(a) * 0.255),
            ],
            0.014,
            4,
          ),
          straw,
        );
        strands.push(strand);
      }
      const skirt = mergeAll(strands, straw);
      skirt.castShadow = true;
      this.torso.add(skirt);
    } else {
      const hakama = new Mesh(
        lathe(
          [
            [0.001, 0.0],
            [0.2, 0.0],
            [0.215, 0.16],
            [0.19, 0.34],
          ],
          14,
        ),
        robe,
      );
      this.torso.add(hakama);
    }

    // ---- head -------------------------------------------------------------
    const skull = new Mesh(ellipsoid(0.093, 0.106, 0.093, 16), skin);
    skull.castShadow = true;
    this.head.add(skull);
    const hair = new Mesh(ellipsoid(0.098, 0.1, 0.098, 16), dark);
    hair.position.set(0, 0.022, 0.012);
    hair.scale.set(1, 0.86, 1);
    this.head.add(hair);
    // Quiet, kind face: two eyes and a suggestion of a brow. Nothing more.
    for (const side of [-1, 1]) {
      const eye = new Mesh(ellipsoid(0.014, 0.008, 0.006, 8), dark);
      eye.position.set(side * 0.035, 0.012, -0.088);
      this.head.add(eye);
    }
    const nose = new Mesh(ellipsoid(0.014, 0.02, 0.016, 8), skin);
    nose.position.set(0, -0.012, -0.092);
    this.head.add(nose);

    if (kind === 'usho') {
      // Kazaori eboshi: tall, folded forward at the crown.
      const cap = new Mesh(
        lathe(
          [
            [0.001, 0],
            [0.093, 0.005],
            [0.088, 0.06],
            [0.076, 0.15],
            [0.062, 0.21],
            [0.001, 0.225],
          ],
          14,
        ),
        hatMat,
      );
      cap.position.y = 0.075;
      cap.castShadow = true;
      this.head.add(cap);
      const fold = new Mesh(roundedBox(0.1, 0.055, 0.14, 0.022), hatMat);
      fold.position.set(0, 0.27, -0.05);
      fold.rotation.x = 0.5;
      this.head.add(fold);
      const cord = new Mesh(new TorusGeometry(0.09, 0.007, 4, 16), trim);
      cord.rotation.x = Math.PI / 2 - 0.15;
      cord.position.y = 0.082;
      this.head.add(cord);
    } else {
      const wrap = new Mesh(ellipsoid(0.1, 0.055, 0.1, 14), trim);
      wrap.position.y = 0.07;
      this.head.add(wrap);
    }
    this.head.position.set(0, 0.845, 0);
    this.torso.add(this.head);

    // ---- arms -------------------------------------------------------------
    const armMat = kind === 'usho' ? robe : robe;
    for (const side of [-1, 1]) {
      const shoulder = new Vector3(side * 0.185, 0.66, 0);
      this.shoulders.push(shoulder);

      const upper = new Mesh(new CapsuleGeometry(0.052, 1 - 0.104, 3, 8), armMat);
      upper.castShadow = true;
      this.upperArms.push(upper);
      this.torso.add(upper);

      const fore = new Mesh(new CapsuleGeometry(0.042, 1 - 0.084, 3, 8), skin);
      fore.castShadow = true;
      this.foreArms.push(fore);
      this.torso.add(fore);

      // Wide sleeve hanging from the upper arm.
      const sleeve = new Mesh(
        lathe(
          [
            [0.001, -0.03],
            [0.12, -0.02],
            [0.115, 0.0],
            [0.075, 0.16],
          ],
          12,
        ),
        robe,
      );
      sleeve.castShadow = true;
      this.sleeves.push(sleeve);
      this.torso.add(sleeve);

      const hand = new Group();
      const palm = new Mesh(ellipsoid(0.038, 0.045, 0.032, 8), skin);
      hand.add(palm);
      this.hands.push(hand);
      this.torso.add(hand);

      const rest = new Vector3(side * 0.3, 0.42, -0.1);
      this.handTargets.push(rest.clone());
      this.handCurrent.push(rest.clone());
    }

    // The bundle of hand ropes gathered in the left fist.
    if (kind === 'usho') {
      const ropeMat = new MeshStandardMaterial({ color: PAL.rope, roughness: 0.95 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        const loop = new Mesh(new TorusGeometry(0.05 + i * 0.012, 0.011, 4, 12), ropeMat);
        loop.rotation.set(1.2 + i * 0.2, a, 0.3);
        loop.position.set(0, -0.03 - i * 0.012, 0.01);
        this.ropeBundle.add(loop);
      }
      this.hands[0].add(this.ropeBundle);
      this.leftHandLocal.set(-0.3, 0.5, -0.24);
    } else {
      // Nakanori poles the boat: a long bamboo sao.
      this.pole = new Mesh(new CylinderGeometry(0.026, 0.02, 3.4, 6), new MeshStandardMaterial({ color: PAL.bamboo, roughness: 0.7 }));
      this.pole.castShadow = true;
      this.torso.add(this.pole);
      this.leftHandLocal.set(-0.24, 0.72, -0.2);
    }

    // ---- feet -------------------------------------------------------------
    for (const side of [-1, 1]) {
      const foot = new Mesh(roundedBox(0.09, 0.045, 0.2, 0.02), dark);
      foot.position.set(side * 0.075, 0.022, -0.02);
      this.torso.add(foot);
    }

    this.group.add(this.torso);
    this.bob = randRange(this.rng, 0, TAU);
  }

  /** One haul stroke; strokes queue so rapid swipes read as a rhythm. */
  pulseHaul(): void {
    this.haulQueue = Math.min(3, this.haulQueue + 1);
    if (this.haulPhase >= 1) this.haulPhase = 0;
  }

  pulseFan(): void {
    this.fanPhase = 0;
  }

  /** Turn the head toward whatever the player is helping with. */
  lookAt(worldX: number): void {
    this.lookTarget = clamp(worldX * 0.12, -0.7, 0.7);
  }

  update(
    dt: number,
    t: number,
    ctx: { ropeDir: Vector3 | null; firePos: Vector3 | null; hauling: boolean },
  ): void {
    // Weight shifts with the boat.
    this.sway = Math.sin(t * 0.9 + this.bob) * 0.03 + Math.sin(t * 0.37) * 0.02;
    this.torso.rotation.z = this.sway * 0.5;
    this.torso.position.y = Math.sin(t * 1.1 + this.bob) * 0.008;
    this.lookYaw = damp(this.lookYaw, this.lookTarget, 4, dt);
    this.head.rotation.y = this.lookYaw;
    this.head.rotation.z = -this.sway * 0.6;

    // ---- left arm: holds the whole bundle, steady, slightly alive ---------
    const lt = this.handTargets[0];
    lt.copy(this.leftHandLocal);
    lt.y += Math.sin(t * 1.3 + this.bob) * 0.012;
    if (ctx.ropeDir) {
      // Braces against the pull of the birds.
      lt.x += clamp(ctx.ropeDir.x, -1, 1) * 0.035;
      lt.z += clamp(ctx.ropeDir.z, -1, 1) * 0.05;
    }

    // ---- right arm: fan the fire, or work hand over hand ------------------
    const rt = this.handTargets[1];
    if (this.fanPhase < 1) {
      this.fanPhase += dt * 2.1;
      const k = clamp01(this.fanPhase);
      const s = Math.sin(k * Math.PI);
      // Reach out to the basket and stir the embers up.
      const base = this.tmp.set(0.28, 0.62, -0.42);
      if (ctx.firePos) base.lerp(ctx.firePos, 0.55 * s);
      rt.copy(base);
      rt.y += Math.sin(k * Math.PI * 3) * 0.12 * s;
      rt.z -= s * 0.12;
    } else if (this.haulPhase < 1) {
      this.haulPhase += dt * 3.1;
      const k = clamp01(this.haulPhase);
      // Reach forward along the rope, close, pull back past the hip.
      const reach = this.tmp.set(0.26, 0.62, -0.5);
      if (ctx.ropeDir) reach.addScaledVector(ctx.ropeDir, 0.28);
      const pull = this.tmp2.set(0.3, 0.34, 0.06);
      const e = k < 0.42 ? easeInOutSine(k / 0.42) : 1 - easeInOutSine((k - 0.42) / 0.58);
      rt.copy(pull).lerp(reach, e);
      if (k >= 1) {
        if (this.haulQueue > 0) {
          this.haulQueue--;
          this.haulPhase = 0;
        }
      }
    } else {
      const idleR = this.tmp.set(0.27, 0.46, -0.12);
      idleR.y += Math.sin(t * 1.05 + this.bob * 1.3) * 0.015;
      rt.copy(idleR);
    }

    // ---- solve and draw ---------------------------------------------------
    for (let i = 0; i < 2; i++) {
      this.handCurrent[i].lerp(this.handTargets[i], Math.min(1, dt * (i === 1 ? 15 : 8)));
      const side = i === 0 ? -1 : 1;
      const pole = this.tmp3.set(side * 0.6, -0.8, 0.5).normalize();
      solveIK(
        this.shoulders[i],
        this.handCurrent[i],
        this.L1,
        this.L2,
        pole,
        this.elbow,
        this.tmp,
        this.tmp2,
      );
      aim(this.upperArms[i], this.shoulders[i], this.elbow, this.tmp, this.q);
      aim(this.foreArms[i], this.elbow, this.handCurrent[i], this.tmp, this.q);
      this.hands[i].position.copy(this.handCurrent[i]);
      this.hands[i].quaternion.copy(this.foreArms[i].quaternion);

      // Sleeve hangs from the elbow, always downward.
      const s = this.sleeves[i];
      s.position.copy(this.shoulders[i]).lerp(this.elbow, 0.55);
      s.quaternion.identity();
      s.rotation.z = side * 0.2 + this.sway;
    }

    if (this.pole) {
      // Nakanori leans on the sao, pushing off the river bed.
      const swing = Math.sin(t * 0.42) * 0.1;
      this.pole.position.set(0.3, 0.8, -0.3);
      this.pole.rotation.set(0.95 + swing, 0.06, 0.28);
    }

    this.group.updateMatrixWorld(true);
    this.handWorld.copy(this.handCurrent[0]).applyMatrix4(this.torso.matrixWorld);
  }
}

/** Convenience so callers read as intent rather than as constructor arguments. */
export function makeUsho(): Figure {
  return new Figure('usho', 1);
}

export function makeNakanori(): Figure {
  return new Figure('nakanori', 2);
}
