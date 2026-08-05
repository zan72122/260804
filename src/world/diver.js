/**
 * 飼育員さん。
 * 4 歳児が一目で「ひと」だと分かる大きな頭と丸い体、
 * そして常にぶくぶくと泡を出すレギュレーターを持たせている。
 */
import * as THREE from 'three';
import { applyCaustics } from './shaders.js';
import { dampV3, damp, TAU, clamp } from '../core/util.js';

const GLASS_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GLASS_FRAG = /* glsl */ `
  uniform vec3 uTint;
  uniform float uAlpha;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.4);
    vec3 L = normalize(vec3(-0.3, 1.0, 0.6));
    float spec = pow(max(dot(reflect(-V, N), L), 0.0), 60.0);
    vec3 col = mix(uTint, vec3(1.0), fres) + spec * 1.8;
    gl_FragColor = vec4(col, clamp(uAlpha + fres * 0.55 + spec * 0.5, 0.0, 1.0));
  }
`;

export function makeGlassMaterial(tint = new THREE.Color(0.6, 0.85, 1.0), alpha = 0.12) {
  return new THREE.ShaderMaterial({
    uniforms: { uTint: { value: tint }, uAlpha: { value: alpha } },
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export class Diver {
  constructor(scene, shared, bubbles) {
    this.shared = shared;
    this.bubbles = bubbles;

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);

    this.position = new THREE.Vector3(0, 4.2, 1.4);
    this.target = new THREE.Vector3(0, 4.2, 1.4);
    this.lookAt = new THREE.Vector3(0, 4.2, 6);
    this._lookSmooth = new THREE.Vector3(0, 4.2, 6);
    this.kick = 0;
    this.bubbleTimer = 0;
    this.working = false;
    this._t = 0;
    this._toolQuat = new THREE.Quaternion();

    this._build();
    this.body.scale.setScalar(1.22); // 4 歳児の目でも表情が読める大きさに
    this.root.position.copy(this.position);
  }

  _mat(color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.62,
      metalness: opts.metalness ?? 0.05,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
    });
    applyCaustics(m, this.shared, { scale: 0.9, strength: 0.5 });
    return m;
  }

  _build() {
    const suit = this._mat(0xff7a3d, { roughness: 0.5 });
    const suitDark = this._mat(0x1d4a63, { roughness: 0.45 });
    const skin = this._mat(0xffd9b8, { roughness: 0.8 });
    const metal = this._mat(0xcfd8dc, { roughness: 0.28, metalness: 0.8 });
    const rubber = this._mat(0x22333d, { roughness: 0.85 });
    this.materials = { suit, suitDark, skin, metal, rubber };

    // 胴体（前は +z 向き）
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.44, 6, 16), suit);
    torso.position.y = 0.0;
    torso.castShadow = true;
    this.body.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), suitDark);
    belly.scale.set(1.0, 0.9, 0.5);
    belly.position.set(0, -0.12, 0.24);
    this.body.add(belly);

    // 胸のライン。オレンジのスーツが遠目にも分かるように。
    const chest = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 20), this._mat(0xfff0d0, { roughness: 0.5 }));
    chest.rotation.x = Math.PI / 2;
    chest.position.y = 0.24;
    chest.scale.set(1, 1, 0.75);
    this.body.add(chest);

    // 頭とヘルメット
    this.head = new THREE.Group();
    this.head.position.set(0, 0.62, 0.02);
    this.body.add(this.head);

    const face = new THREE.Mesh(new THREE.SphereGeometry(0.31, 24, 18), skin);
    face.castShadow = true;
    this.head.add(face);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.325, 24, 18, 0, TAU, 0, Math.PI * 0.55), this._mat(0x3a2b23, { roughness: 0.9 }));
    hair.position.y = 0.01;
    hair.rotation.x = -0.16;
    this.head.add(hair);

    const eyeGeo = new THREE.SphereGeometry(0.055, 14, 12);
    const eyeMat = this._mat(0x14202a, { roughness: 0.25 });
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(s * 0.115, 0.03, 0.275);
      this.head.add(eye);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 8), shineMat);
      shine.position.set(s * 0.098, 0.062, 0.315);
      this.head.add(shine);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), this._mat(0xff9d9d, { roughness: 0.9 }));
      blush.scale.set(1, 0.6, 0.35);
      blush.position.set(s * 0.185, -0.055, 0.245);
      this.head.add(blush);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.017, 8, 16, Math.PI), eyeMat);
    smile.position.set(0, -0.075, 0.288);
    smile.rotation.set(0, 0, Math.PI);
    this.head.add(smile);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.44, 28, 22), makeGlassMaterial(new THREE.Color(0.62, 0.88, 1.0), 0.1));
    dome.renderOrder = 12;
    this.head.add(dome);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.055, 10, 24), metal);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = -0.30;
    this.head.add(collar);

    // 背中のタンクとレギュレーター
    const tankMat = this._mat(0xffd23f, { roughness: 0.35, metalness: 0.4 });
    for (const s of [-1, 1]) {
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.42, 5, 12), tankMat);
      tank.position.set(s * 0.15, 0.12, -0.38);
      tank.castShadow = true;
      this.body.add(tank);
    }
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), metal);
    valve.position.set(0, 0.42, -0.36);
    this.body.add(valve);

    this.regulator = new THREE.Object3D();
    this.regulator.position.set(0.16, 0.40, 0.16);
    this.body.add(this.regulator);
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.40, -0.34),
      new THREE.Vector3(0.30, 0.48, -0.18),
      new THREE.Vector3(0.26, 0.44, 0.10),
      new THREE.Vector3(0.14, 0.40, 0.18),
    ]);
    const airHose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 24, 0.035, 8, false), rubber);
    this.body.add(airHose);

    // 腕。道具のほうへ伸ばす。
    this.arms = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.34, 0.22, 0.04);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.30, 4, 10), suit);
      upper.position.set(0, -0.20, 0);
      upper.castShadow = true;
      pivot.add(upper);
      const fore = new THREE.Group();
      fore.position.set(0, -0.38, 0);
      const foreMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.26, 4, 10), skin);
      foreMesh.position.set(0, -0.17, 0);
      fore.add(foreMesh);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10), skin);
      hand.position.set(0, -0.34, 0);
      fore.add(hand);
      pivot.add(fore);
      this.body.add(pivot);
      this.arms.push({ pivot, fore, side: s });
    }

    // 脚とフィン
    this.legs = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.16, -0.44, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.34, 4, 10), suitDark);
      leg.position.set(0, -0.22, 0);
      leg.castShadow = true;
      pivot.add(leg);
      const finGroup = new THREE.Group();
      finGroup.position.set(0, -0.44, 0);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 4, 1), this._mat(0x37c9b0, { roughness: 0.5 }));
      fin.scale.set(1, 1, 0.32);
      fin.rotation.x = Math.PI;
      fin.position.set(0, -0.2, 0.08);
      finGroup.add(fin);
      pivot.add(finGroup);
      this.body.add(pivot);
      this.legs.push({ pivot, fin: finGroup, side: s });
    }

    // 道具を持つ場所。handPivot を傾けると、体の向きはそのままで
    // 道具だけを下へ向けられる（＝顔を見せたまま底を掃除できる）。
    this.handPivot = new THREE.Group();
    this.handPivot.position.set(0, 0.16, 0.10);
    this.body.add(this.handPivot);

    this.hand = new THREE.Group();
    this.hand.position.set(0, 0, 0.60);
    this.handPivot.add(this.hand);

    this.toolPitch = 0;
    this.toolPitchTarget = 0;

    // 手元のライト。作業している所がふわっと明るくなる。
    this.workLight = new THREE.PointLight(0xfff0c8, 0, 3.6, 2);
    this.hand.add(this.workLight);
  }

  /** 道具の向き（ラジアン、正で下向き）。 */
  setToolPitch(rad) {
    this.toolPitchTarget = rad;
  }

  /** 体の原点から見た、手の位置のずれ（ワールド）。 */
  toolOffsetWorld(out = new THREE.Vector3()) {
    this.hand.getWorldPosition(out);
    return out.sub(this.root.position);
  }

  /** 道具が指している向き（ワールド）。 */
  toolDirWorld(out = new THREE.Vector3()) {
    this.hand.getWorldQuaternion(this._toolQuat);
    return out.set(0, 0, 1).applyQuaternion(this._toolQuat).normalize();
  }

  /** 目標の位置と、見る方向を指定する。 */
  moveTo(pos, lookAt) {
    this.target.copy(pos);
    if (lookAt) this.lookAt.copy(lookAt);
  }

  setWorking(on) {
    this.working = on;
  }

  handWorldPosition(out = new THREE.Vector3()) {
    this.hand.getWorldPosition(out);
    return out;
  }

  update(dt, t) {
    this._t += dt;

    dampV3(this.position, this.target, 0.0009, dt);
    this.root.position.copy(this.position);

    dampV3(this._lookSmooth, this.lookAt, 0.0025, dt);
    this.root.lookAt(this._lookSmooth);

    // ふわふわ漂う上下動と、ゆるい傾き
    const bob = Math.sin(this._t * 1.35) * 0.055;
    this.body.position.y = bob;
    this.body.rotation.z = Math.sin(this._t * 0.85) * 0.05;
    this.head.rotation.z = Math.sin(this._t * 1.1 + 0.6) * 0.06;
    this.head.rotation.x = Math.sin(this._t * 0.7) * 0.04;

    // 足はいつもゆっくりキック。作業中は少しだけ速く。
    const kickSpeed = this.working ? 3.1 : 1.7;
    for (const leg of this.legs) {
      const p = this._t * kickSpeed + (leg.side > 0 ? 0 : Math.PI);
      leg.pivot.rotation.x = Math.sin(p) * (this.working ? 0.42 : 0.28);
      leg.fin.rotation.x = Math.sin(p - 0.7) * 0.5;
    }

    // 道具の傾き。ガラスは前、砂は下。
    this.toolPitch = damp(this.toolPitch, this.toolPitchTarget, 0.02, dt);
    this.handPivot.rotation.x = this.toolPitch; // 正で下向き

    // 腕は道具のほうへ。作業中は小さく前後する。
    const reach = this.working ? 0.16 : 0.0;
    for (const arm of this.arms) {
      const wobble = Math.sin(this._t * 4.4 + (arm.side > 0 ? 0 : 1.2)) * reach;
      arm.pivot.rotation.x = -1.05 - wobble * 0.5 + this.toolPitch * 0.55;
      arm.pivot.rotation.z = arm.side * (0.42 + wobble * 0.2);
      arm.fore.rotation.x = -0.55 + wobble - this.toolPitch * 0.30;
    }

    this.workLight.intensity = damp(this.workLight.intensity, this.working ? 3.0 : 0.6, 0.02, dt);

    // ぶくぶく。作業中はちょっと多め。
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubbleTimer = this.working ? 0.10 + Math.random() * 0.12 : 0.20 + Math.random() * 0.24;
      const p = new THREE.Vector3();
      this.regulator.getWorldPosition(p);
      const n = this.working ? 2 : 1;
      for (let i = 0; i < n; i++) {
        this.bubbles.spawn(
          p.x + (Math.random() - 0.5) * 0.1,
          p.y + (Math.random() - 0.5) * 0.05,
          p.z + (Math.random() - 0.5) * 0.1,
          { r: 0.035 + Math.random() * 0.075 }
        );
      }
      return true; // 泡が出たフレーム（音を鳴らす合図）
    }
    return false;
  }
}
