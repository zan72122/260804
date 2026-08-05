// 大工ロボット。道具を握るのはいつもこの子で、プレイヤーの手は画面に出ない。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makePatternTexture } from '../core/materials.js';
import { damp, clamp, lerp, tween, easeOutBack, easeOutCubic, rand } from '../core/util.js';

const paint = (color, rough = 0.42, metal = 0.05) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 1.0 });

export class Robot {
  constructor(scene, apron) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.apron = apron;
    this._t = 0;
    this._blink = rand(2, 5);
    this._lookTarget = new THREE.Vector3(0, 0.1, 0.4);
    this._lookCur = new THREE.Vector3(0, 0.1, 0.4);
    this.hands = {
      L: { target: null, cur: new THREE.Vector3(), rest: new THREE.Vector3() },
      R: { target: null, cur: new THREE.Vector3(), rest: new THREE.Vector3() },
    };
    this._build();
  }

  _build() {
    const g = this.group;
    const shell = paint('#f3f6fa', 0.35);
    const accent = paint('#5aa9e6', 0.4);
    const dark = paint('#3d4a5c', 0.5);

    // 腰・胴
    const hips = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.14, 0.18, 3, 0.05), accent);
    hips.position.y = -0.14;
    g.add(hips);
    const torso = new THREE.Mesh(new RoundedBoxGeometry(0.30, 0.30, 0.20, 3, 0.07), shell);
    torso.position.y = 0.05;
    g.add(torso);
    this.torso = torso;

    // エプロン（柄を選べる）
    const tex = makePatternTexture(this.apron.pattern, this.apron.bg, this.apron.fg);
    const apronMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.24, 0.34, 0.03, 2, 0.02),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }),
    );
    apronMesh.position.set(0, 0.0, 0.105);
    g.add(apronMesh);
    this.apronMesh = apronMesh;
    const strapMat = paint(this.apron.bg, 0.7);
    for (const x of [-0.08, 0.08]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.02), strapMat);
      s.position.set(x, 0.19, 0.1);
      s.rotation.x = 0.1;
      g.add(s);
    }
    // 胸のランプ
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffd166', toneMapped: false }));
    lamp.position.set(0, 0.15, 0.115);
    g.add(lamp);
    this.lamp = lamp;

    // 首・頭
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 12), dark);
    neck.position.y = 0.21;
    g.add(neck);
    const head = new THREE.Group();
    head.position.y = 0.33;
    g.add(head);
    this.head = head;
    const skull = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.22, 0.22, 4, 0.085), shell);
    head.add(skull);
    const faceplate = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.13, 0.02, 3, 0.045), paint('#2f3a49', 0.25, 0.1));
    faceplate.position.set(0, 0.005, 0.108);
    head.add(faceplate);

    // 目
    this.eyes = [];
    for (const x of [-0.05, 0.05]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 14), new THREE.MeshBasicMaterial({ color: '#8ff0e2', toneMapped: false }));
      eye.position.set(x, 0.01, 0.115);
      head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 10), new THREE.MeshBasicMaterial({ color: '#123', toneMapped: false }));
      pupil.position.set(x, 0.01, 0.135);
      head.add(pupil);
      this.eyes.push({ eye, pupil, baseX: x });
    }
    // ほっぺ
    for (const x of [-0.095, 0.095]) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffb3c1', transparent: true, opacity: 0.75, toneMapped: false }));
      c.scale.set(1, 0.7, 0.4);
      c.position.set(x, -0.035, 0.098);
      head.add(c);
    }
    // アンテナ
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), dark);
    ant.position.y = 0.15;
    head.add(ant);
    const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 12), new THREE.MeshStandardMaterial({ color: '#ff6b6b', emissive: '#ff3b3b', emissiveIntensity: 0.35, roughness: 0.35 }));
    antBall.position.y = 0.2;
    head.add(antBall);
    this.antBall = antBall;

    // ゴーグル（作業前にすっと下ろす）
    const goggles = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.016, 8, 24), paint('#ff8a5c', 0.6));
    band.rotation.x = Math.PI / 2;
    band.scale.set(1, 1, 1.05);
    goggles.add(band);
    for (const x of [-0.055, 0.055]) {
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.02, 18),
        new THREE.MeshPhysicalMaterial({ color: '#bfe9ff', transparent: true, opacity: 0.42, roughness: 0.1, metalness: 0, transmission: 0.6, thickness: 0.02 }),
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(x, 0, 0.1);
      goggles.add(lens);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.008, 8, 18), paint('#ff8a5c', 0.5));
      rim.position.set(x, 0, 0.1);
      goggles.add(rim);
    }
    goggles.position.set(0, 0.115, 0.0);
    goggles.rotation.x = -1.15;  // ふだんは額の上
    head.add(goggles);
    this.goggles = goggles;

    // 腕
    this.arms = {};
    for (const side of ['L', 'R']) {
      const s = side === 'L' ? -1 : 1;
      const shoulder = new THREE.Object3D();
      shoulder.position.set(s * 0.175, 0.14, 0.01);
      g.add(shoulder);
      const ballJ = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 12), accent);
      shoulder.add(ballJ);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 1, 12), shell);
      upper.geometry.translate(0, -0.5, 0);
      upper.castShadow = true;
      g.add(upper);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), accent);
      g.add(elbow);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.024, 1, 12), shell);
      fore.geometry.translate(0, -0.5, 0);
      fore.castShadow = true;
      g.add(fore);
      const hand = new THREE.Mesh(new RoundedBoxGeometry(0.062, 0.07, 0.05, 3, 0.024), paint('#ffd166', 0.45));
      hand.castShadow = true;
      g.add(hand);
      const rest = new THREE.Vector3(s * 0.3, -0.02, 0.22);
      this.arms[side] = { shoulder, upper, elbow, fore, hand, a: 0.40, b: 0.38, s };
      this.hands[side].cur.copy(rest);
      this.hands[side].rest.copy(rest);
    }

    // 脚（作業台の奥でちらりと見える程度）
    for (const x of [-0.08, 0.08]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.42, 12), paint('#3d4a5c', 0.55));
      leg.position.set(x, -0.4, 0);
      leg.castShadow = true;
      g.add(leg);
      const foot = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.06, 0.16, 3, 0.025), paint('#5aa9e6', 0.45));
      foot.position.set(x, -0.6, 0.03);
      foot.castShadow = true;
      g.add(foot);
    }

    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  setApron(apron) {
    this.apron = apron;
    const tex = makePatternTexture(apron.pattern, apron.bg, apron.fg);
    this.apronMesh.material.map = tex;
    this.apronMesh.material.needsUpdate = true;
  }

  lookAt(v) { this._lookTarget.copy(v); }
  /** ワールド座標で見る / 握る */
  lookAtWorld(v) { this._lookTarget.copy(v).sub(this.group.position); }
  setHandWorld(side, world) {
    if (!world) { this.setHand(side, null); return; }
    const local = world.clone().sub(this.group.position);
    // 届かない所へは無理に伸ばさず、見守る姿勢に戻す
    const arm = this.arms[side];
    if (arm && local.distanceTo(arm.shoulder.position) > (arm.a + arm.b) * 1.02) {
      this.setHand(side, null);
      return;
    }
    this.setHand(side, local);
  }
  setHand(side, pos) {
    this.hands[side].target = pos ? this.hands[side].target || new THREE.Vector3() : null;
    if (pos) this.hands[side].target.copy(pos);
  }
  releaseHands() { this.hands.L.target = null; this.hands.R.target = null; }

  /** ゴーグルを下ろす / 上げる */
  setGoggles(down) {
    const to = down ? 0.05 : -1.15;
    if (this._gogglesTo === to) return;
    this._gogglesTo = to;
    tween({
      from: this.goggles.rotation.x, to, dur: 0.45, ease: easeOutBack,
      onUpdate: (v) => { this.goggles.rotation.x = v; },
    });
  }

  cheer() {
    this._cheerT = 0.9;
    const up = new THREE.Vector3(-0.3, 0.42, 0.16);
    this.setHand('L', up);
    this.setHand('R', new THREE.Vector3(0.3, 0.42, 0.16));
    tween({
      from: 0, to: 1, dur: 0.7,
      onUpdate: (v) => {
        this.group.position.y = this._baseY + Math.sin(v * Math.PI * 2) * 0.05;
      },
      onDone: () => { this.group.position.y = this._baseY; this.releaseHands(); },
    });
  }

  /** 次の場所をそっと指す */
  point(pos) {
    const side = pos.x < this.group.position.x ? 'L' : 'R';
    const p = pos.clone().sub(this.group.position);
    p.y += 0.06;
    this.setHand(side, p);
    this.lookAt(pos.clone().sub(this.group.position));
    this._pointT = 1.6;
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
    this._baseY = y;
    return this;
  }

  update(dt, t) {
    this._t += dt;
    if (this._baseY === undefined) this._baseY = this.group.position.y;
    // ゆっくりした呼吸
    const br = Math.sin(this._t * 1.6) * 0.006;
    this.torso.position.y = 0.05 + br;
    this.head.position.y = 0.33 + br * 1.4;
    this.head.rotation.z = Math.sin(this._t * 0.7) * 0.02;
    this.antBall.position.y = 0.2 + Math.sin(this._t * 2.4) * 0.006;

    // 視線
    this._lookCur.x = damp(this._lookCur.x, this._lookTarget.x, 4, dt);
    this._lookCur.y = damp(this._lookCur.y, this._lookTarget.y, 4, dt);
    this._lookCur.z = damp(this._lookCur.z, this._lookTarget.z, 4, dt);
    const dir = this._lookCur.clone().sub(new THREE.Vector3(0, 0.33, 0));
    const yaw = clamp(Math.atan2(dir.x, Math.max(0.05, dir.z)), -0.9, 0.9);
    const pitch = clamp(-Math.atan2(dir.y, Math.max(0.05, Math.hypot(dir.x, dir.z))), -0.55, 0.55);
    this.head.rotation.y = damp(this.head.rotation.y, yaw, 6, dt);
    this.head.rotation.x = damp(this.head.rotation.x, pitch, 6, dt);
    for (const e of this.eyes) {
      e.pupil.position.x = e.baseX + clamp(yaw, -0.4, 0.4) * 0.02;
      e.pupil.position.y = 0.01 - clamp(pitch, -0.4, 0.4) * 0.02;
    }
    // まばたき
    this._blink -= dt;
    if (this._blink < 0) {
      this._blink = rand(2.2, 5.5);
      tween({
        from: 0, to: 1, dur: 0.16,
        onUpdate: (v) => {
          const s = 1 - Math.sin(v * Math.PI) * 0.92;
          this.eyes.forEach((e) => { e.eye.scale.y = s; e.pupil.scale.y = s; });
        },
      });
    }

    if (this._pointT > 0) {
      this._pointT -= dt;
      if (this._pointT <= 0) this.releaseHands();
    }

    // 腕の 2 関節 IK
    for (const side of ['L', 'R']) {
      const arm = this.arms[side];
      const h = this.hands[side];
      const idleOffset = new THREE.Vector3(0, Math.sin(this._t * 1.5 + (side === 'L' ? 0 : 1.2)) * 0.012, 0);
      const goal = (h.target || h.rest).clone().add(h.target ? new THREE.Vector3() : idleOffset);
      h.cur.x = damp(h.cur.x, goal.x, 8, dt);
      h.cur.y = damp(h.cur.y, goal.y, 8, dt);
      h.cur.z = damp(h.cur.z, goal.z, 8, dt);
      this._solveArm(arm, h.cur);
    }
  }

  _solveArm(arm, handLocal) {
    const S = arm.shoulder.position;
    const H = handLocal;
    const d = new THREE.Vector3().subVectors(H, S);
    const len = clamp(d.length(), 0.02, arm.a + arm.b - 0.005);
    d.normalize();
    // 肘は外側・下向きへ逃がす
    const pole = new THREE.Vector3(arm.s * 0.7, -0.9, 0.35).normalize();
    let perp = new THREE.Vector3().crossVectors(d, pole);
    if (perp.lengthSq() < 1e-6) perp.set(0, 0, 1);
    perp.crossVectors(perp, d).normalize().negate();
    const cosA = clamp((len * len + arm.a * arm.a - arm.b * arm.b) / (2 * len * arm.a), -1, 1);
    const proj = arm.a * cosA;
    const h = Math.sqrt(Math.max(0, arm.a * arm.a - proj * proj));
    const E = new THREE.Vector3().copy(S).addScaledVector(d, proj).addScaledVector(perp, h);

    this._orient(arm.upper, S, E);
    this._orient(arm.fore, E, H);
    arm.elbow.position.copy(E);
    arm.hand.position.copy(H);
    arm.hand.quaternion.copy(arm.fore.quaternion);
  }

  _orient(mesh, from, to) {
    const d = new THREE.Vector3().subVectors(to, from);
    const len = Math.max(0.001, d.length());
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(DOWN, d.clone().normalize());
    mesh.scale.set(1, len, 1);
  }
}

const DOWN = new THREE.Vector3(0, -1, 0);
