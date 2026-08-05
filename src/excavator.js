/**
 * ショベルカー（パワーショベル）
 * ・ゆびの いち → せんかい(yaw) + アームIK
 * ・つちに はいったら じどうで すくう
 * ・ダンプの うえに いったら じどうで あける
 * すべて ばね で なめらかに おいかける ＝ おおきな きかいの おもみ。
 */
import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, roundedBox, matteMaterial, addMesh, bakeStatic, Spring, DEG } from './util.js';
import { FLOOR_Y } from './terrain.js';

// アームの ながさ
const L_BOOM = 3.05;
const L_STICK = 2.35;
const BUCKET_TIP = new THREE.Vector2(0.95, -0.34); // バケット ローカルの さきっぽ (z, y)
const L_BUCKET = BUCKET_TIP.length();
const PHI = Math.atan2(BUCKET_TIP.y, BUCKET_TIP.x); // -19.7°

const CURL_DUMP = -2.30;   // ぜんぶ ひらいた とき の さきっぽ かくど
const CURL_CARRY = -0.34;  // かかえた とき（くちが うえ むき）
const curlAngle = (c) => lerp(CURL_DUMP, CURL_CARRY, clamp(c, 0, 1));

const COL_BODY = '#ffc42e';
const COL_BODY_D = '#f0a81c';
const COL_DARK = '#3f4550';
const COL_STEEL = '#8d949e';
const COL_GLASS = '#5f7f96';

/** へいめん(r,y) での かいてん */
function rot2(lr, ly, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { r: lr * c - ly * s, y: lr * s + ly * c };
}

export class Excavator {
  constructor(terrain, opts = {}) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.position.set(opts.x ?? -8.9, 0, opts.z ?? 1.4);

    this.pivot = { r: 0.80, y: 1.46 };   // ブームの つけね（せんかい ちゅうしんから）

    this.homeYaw = opts.yaw ?? 1.95;      // つちやまの ほうを むいて スタート
    this.yaw = this.homeYaw;
    this.yawTarget = this.homeYaw;
    this.yawVel = 0;

    this.a1 = 0.55;   // ブーム
    this.a2 = -0.9;   // アーム
    this.curl = 1;    // バケットの まるめ 0..1
    this.curlTarget = 1;

    this.tipSpring = { r: new Spring(4.0, 46, 13), y: new Spring(1.1, 46, 13) };
    this.targetTip = new THREE.Vector3(
      this.group.position.x + Math.sin(this.homeYaw) * 4.0,
      1.1,
      this.group.position.z + Math.cos(this.homeYaw) * 4.0
    );
    this.mode = 'idle';           // idle | dig | air | dump
    this.load = 0;                // 0..1
    this.capacity = 0.62;         // ㎥ そうとう
    this.loadVolume = 0;
    this.digging = false;
    this.tipWorld = new THREE.Vector3();
    this.tipPrev = new THREE.Vector3();
    this.tipSpeed = 0;
    this.enabled = true;
    this.onDig = null;      // (pos, amount) => void
    this.onDumpTick = null; // (pos, amount) => void
    this.onFull = null;

    this._build();
    this._applyPose(0.016, true);
  }

  // ---------------- モデル ----------------

  _build() {
    const body = matteMaterial(COL_BODY, { roughness: 0.45, metalness: 0.12 });
    const bodyD = matteMaterial(COL_BODY_D, { roughness: 0.5, metalness: 0.1 });
    const dark = matteMaterial(COL_DARK, { roughness: 0.72, metalness: 0.18 });
    const steel = matteMaterial(COL_STEEL, { roughness: 0.32, metalness: 0.55 });
    const glass = matteMaterial(COL_GLASS, { roughness: 0.08, metalness: 0.25, extra: { envMapIntensity: 1 } });
    this.mats = { body, bodyD, dark, steel, glass };

    /* --- くるま台（キャタピラ） --- */
    const under = new THREE.Group();
    under.rotation.y = this.homeYaw - 0.25;   // つちやまの ほうへ とめて ある
    this.group.add(under);
    this.under = under;

    for (const side of [-1, 1]) {
      const track = new THREE.Group();
      track.position.set(side * 1.16, 0, 0);
      under.add(track);
      // ゴムの わ
      const shoe = addMesh(track, roundedBox(0.62, 0.86, 3.5, 0.36, 4), dark, [0, 0.44, 0]);
      shoe.scale.set(1, 1, 1);
      // ホイール
      for (const z of [-1.28, -0.62, 0, 0.62, 1.28]) {
        const w = addMesh(track, new THREE.CylinderGeometry(0.3, 0.3, 0.66, 14), steel, [0, 0.42, z], [0, 0, Math.PI / 2]);
        w.castShadow = false;
      }
      // すべりどめ の でっぱり
      const cleatGeo = roundedBox(0.68, 0.09, 0.16, 0.04);
      const cleatMat = matteMaterial('#2c313a', { roughness: 0.85 });
      for (let i = 0; i < 11; i++) {
        const z = -1.6 + i * 0.32;
        addMesh(track, cleatGeo, cleatMat, [0, 0.02, z]);
        addMesh(track, cleatGeo, cleatMat, [0, 0.86, z]);
      }
    }
    // だいしゃ フレーム
    addMesh(under, roundedBox(2.2, 0.34, 1.9, 0.1), bodyD, [0, 0.62, 0]);
    bakeStatic(under);   // うごかない ので 1つに まとめる

    /* --- せんかいたい --- */
    const turret = new THREE.Group();
    turret.position.y = 0.86;
    this.group.add(turret);
    this.turret = turret;

    addMesh(turret, new THREE.CylinderGeometry(0.98, 1.05, 0.2, 22), steel, [0, 0.02, 0]);
    // ほんたい
    addMesh(turret, roundedBox(2.05, 0.86, 2.9, 0.16), body, [0, 0.55, -0.25]);
    // カウンターウェイト
    addMesh(turret, roundedBox(2.0, 0.98, 0.62, 0.2), bodyD, [0, 0.55, -1.62]);
    // エンジンフード の ライン
    addMesh(turret, roundedBox(1.7, 0.1, 1.5, 0.05), bodyD, [0, 0.99, -0.85]);
    // うんてんせき
    const cab = new THREE.Group();
    cab.position.set(-0.72, 0.95, 0.42);
    turret.add(cab);
    addMesh(cab, roundedBox(1.02, 1.22, 1.32, 0.14), body, [0, 0.6, 0]);
    addMesh(cab, roundedBox(0.92, 0.72, 0.06, 0.03), glass, [0, 0.78, 0.65]);
    addMesh(cab, roundedBox(0.06, 0.72, 1.12, 0.03), glass, [-0.5, 0.78, 0]);
    addMesh(cab, roundedBox(0.06, 0.72, 1.12, 0.03), glass, [0.5, 0.78, 0]);
    addMesh(cab, roundedBox(1.06, 0.1, 1.36, 0.05), bodyD, [0, 1.2, 0]);
    // ライト
    const lamp = matteMaterial('#fff6d5', { roughness: 0.3, extra: { emissive: new THREE.Color('#ffe9a8'), emissiveIntensity: 0.7 } });
    addMesh(cab, roundedBox(0.2, 0.14, 0.1, 0.04), lamp, [0.32, 1.16, 0.62]);
    // マフラー
    addMesh(turret, new THREE.CylinderGeometry(0.1, 0.12, 0.5, 10), dark, [0.62, 1.2, 0.35]);
    this.exhaust = new THREE.Object3D();
    this.exhaust.position.set(0.62, 1.5, 0.35);
    turret.add(this.exhaust);
    // てすり
    const rail = matteMaterial('#e8e2d4', { roughness: 0.5 });
    addMesh(turret, roundedBox(0.07, 0.07, 1.2, 0.03), rail, [0.98, 1.06, -0.9]);
    addMesh(turret, roundedBox(0.07, 0.24, 0.07, 0.03), rail, [0.98, 0.94, -0.32]);

    /* --- ブーム --- */
    const boom = new THREE.Group();
    boom.position.set(0, this.pivot.y - 0.86, this.pivot.r);
    turret.add(boom);
    this.boom = boom;
    // まがった ブームらしく 2ぶんかつ
    addMesh(boom, roundedBox(0.44, 0.5, 1.62, 0.12), body, [0, 0.16, 0.78], [-0.13, 0, 0]);
    addMesh(boom, roundedBox(0.4, 0.46, 1.5, 0.12), body, [0, 0.2, 2.1], [0.14, 0, 0]);
    addMesh(boom, new THREE.CylinderGeometry(0.26, 0.26, 0.5, 14), steel, [0, 0, 0], [0, 0, Math.PI / 2]);
    addMesh(boom, new THREE.CylinderGeometry(0.2, 0.2, 0.46, 14), steel, [0, 0.16, L_BOOM], [0, 0, Math.PI / 2]);

    /* --- アーム（スティック） --- */
    const stick = new THREE.Group();
    stick.position.set(0, 0.16, L_BOOM);
    boom.add(stick);
    this.stick = stick;
    addMesh(stick, roundedBox(0.34, 0.42, L_STICK - 0.12, 0.1), body, [0, 0.02, (L_STICK - 0.12) / 2 + 0.06]);
    addMesh(stick, new THREE.CylinderGeometry(0.16, 0.16, 0.4, 12), steel, [0, 0, L_STICK], [0, 0, Math.PI / 2]);

    /* --- バケット --- */
    const bucket = new THREE.Group();
    bucket.position.set(0, 0, L_STICK);
    stick.add(bucket);
    this.bucket = bucket;

    const bmat = matteMaterial('#d8d2c4', { roughness: 0.42, metalness: 0.35 });
    const bmatD = matteMaterial('#b9b2a2', { roughness: 0.5, metalness: 0.3 });
    // そこ
    addMesh(bucket, roundedBox(0.9, 0.1, 0.92, 0.04), bmat, [0, -0.34, 0.5]);
    // うしろ
    addMesh(bucket, roundedBox(0.9, 0.68, 0.1, 0.04), bmatD, [0, -0.04, 0.07]);
    // よこ
    for (const s of [-1, 1]) {
      addMesh(bucket, roundedBox(0.09, 0.62, 0.94, 0.04), bmat, [s * 0.44, -0.06, 0.5]);
    }
    // つけね の みみ
    addMesh(bucket, roundedBox(0.5, 0.3, 0.3, 0.06), bmatD, [0, 0.08, 0.12]);
    // つめ
    const tooth = new THREE.ConeGeometry(0.075, 0.26, 4);
    tooth.rotateX(Math.PI / 2);
    for (let i = -2; i <= 2; i++) {
      addMesh(bucket, tooth, matteMaterial('#efe9dc', { roughness: 0.3, metalness: 0.5 }),
              [i * 0.175, -0.34, 1.02]);
    }
    // バケットの なかの つち
    const soilMat = matteMaterial('#7a5334', { roughness: 0.98 });
    this.soilMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 9), soilMat);
    this.soilMesh.position.set(0, -0.12, 0.5);
    this.soilMesh.scale.set(1.6, 0.5, 1.7);
    this.soilMesh.castShadow = true;
    this.soilMesh.visible = false;
    bucket.add(this.soilMesh);

    /* --- ゆあつシリンダー --- */
    this.pistons = [];
    const mkPiston = (barrelR, rodR, colorA = COL_STEEL) => {
      const g = new THREE.Group();
      const barrelGeo = new THREE.CylinderGeometry(barrelR, barrelR, 1, 12);
      barrelGeo.rotateX(Math.PI / 2);
      barrelGeo.translate(0, 0, 0.5);
      const rodGeo = new THREE.CylinderGeometry(rodR, rodR, 1, 10);
      rodGeo.rotateX(Math.PI / 2);
      rodGeo.translate(0, 0, 0.5);
      const barrel = new THREE.Mesh(barrelGeo, matteMaterial(colorA, { roughness: 0.35, metalness: 0.6 }));
      const rod = new THREE.Mesh(rodGeo, matteMaterial('#dfe3e8', { roughness: 0.16, metalness: 0.85 }));
      barrel.castShadow = true; rod.castShadow = true;
      g.add(rod); g.add(barrel);
      turret.add(g);
      const obj = { g, barrel, rod };
      this.pistons.push(obj);
      return obj;
    };
    this.pBoom = mkPiston(0.13, 0.075);
    this.pStick = mkPiston(0.12, 0.07);
    this.pBucket = mkPiston(0.105, 0.062);

    this.group.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  // ---------------- そうさ ----------------

  /** ゆびの さきの ワールドざひょう を うけとる */
  setTarget(worldPoint, mode) {
    this.targetTip.copy(worldPoint);
    this.mode = mode;
  }

  idle() { this.mode = 'idle'; }

  /** おしごと おわり：どうろから アームを どけて たたむ */
  park(yawOffset = -1.5) {
    this.mode = 'idle';
    const y = this.homeYaw + yawOffset;
    this.yawTarget = y;
    const g = this.group.position;
    this.targetTip.set(
      g.x + Math.sin(y) * 3.0,
      1.05,
      g.z + Math.cos(y) * 3.0
    );
  }

  worldToPlane(p) {
    const dx = p.x - this.group.position.x;
    const dz = p.z - this.group.position.z;
    return {
      yaw: Math.atan2(dx, dz),
      r: Math.hypot(dx, dz),
      y: p.y,
    };
  }

  planeToWorld(yaw, r, y, out = new THREE.Vector3()) {
    return out.set(
      this.group.position.x + Math.sin(yaw) * r,
      y,
      this.group.position.z + Math.cos(yaw) * r
    );
  }

  get reachMax() { return L_BOOM + L_STICK + L_BUCKET - 0.35; }
  get reachMin() { return 1.75; }

  update(dt) {
    const p = this.worldToPlane(this.targetTip);

    // とどく はんい に そっと おさめる（にゅうりょく ほじょ）
    const pr = p.r - this.pivot.r;
    const py = p.y - this.pivot.y;
    let d = Math.hypot(pr, py);
    const dMax = this.reachMax, dMin = 1.6;
    let cr = pr, cy = py;
    if (d > dMax) { cr = pr / d * dMax; cy = py / d * dMax; }
    else if (d < dMin) { const k = dMin / Math.max(d, 1e-4); cr = pr * k; cy = py * k; }
    if (cr < 1.0) cr = 1.0;                 // からだに ぶつからない ように
    if (cy < FLOOR_Y - 0.55 - this.pivot.y) cy = FLOOR_Y - 0.55 - this.pivot.y;

    // せんかい：ゆっくり おおきく まわる
    if (this.mode !== 'idle') this.yawTarget = p.yaw;
    const prevYaw = this.yaw;
    this.yaw = dampAngle(this.yaw, this.yawTarget, 3.4, dt);
    this.yawVel = damp(this.yawVel, (this.yaw - prevYaw) / Math.max(dt, 1e-4), 8, dt);

    // さきっぽ を ばね で おいかける
    this.tipSpring.r.target = this.pivot.r + cr;
    this.tipSpring.y.target = this.pivot.y + cy;
    const tipR = this.tipSpring.r.step(dt);
    const tipY = this.tipSpring.y.step(dt);

    // バケットの まるめ
    this.curl = damp(this.curl, this.curlTarget, 6.5, dt);

    this._solveIK(tipR - this.pivot.r, tipY - this.pivot.y);
    this._applyPose(dt);

    // さきっぽの ワールドいち
    this.tipPrev.copy(this.tipWorld);
    const a3 = curlAngle(this.curl);
    const tipPlaneR = this.pivot.r + Math.cos(this._a1) * L_BOOM + Math.cos(this._a2) * L_STICK + Math.cos(a3) * L_BUCKET;
    const tipPlaneY = this.pivot.y + Math.sin(this._a1) * L_BOOM + Math.sin(this._a2) * L_STICK + Math.sin(a3) * L_BUCKET;
    this.planeToWorld(this.yaw, tipPlaneR, tipPlaneY, this.tipWorld);
    this.tipSpeed = damp(this.tipSpeed, this.tipWorld.distanceTo(this.tipPrev) / Math.max(dt, 1e-4), 10, dt);

    this._handleSoil(dt);
    return this;
  }

  _solveIK(tr, ty) {
    const a3 = curlAngle(this.curl);
    // てくび（アームの さき）の いち
    const wr = tr - Math.cos(a3) * L_BUCKET;
    const wy = ty - Math.sin(a3) * L_BUCKET;
    let d = Math.hypot(wr, wy);
    const dmax = L_BOOM + L_STICK - 0.02;
    const dmin = Math.abs(L_BOOM - L_STICK) + 0.35;
    d = clamp(d, dmin, dmax);
    const base = Math.atan2(wy, wr);
    const cosA = clamp((L_BOOM * L_BOOM + d * d - L_STICK * L_STICK) / (2 * L_BOOM * d), -1, 1);
    const A = Math.acos(cosA);
    let a1 = base + A;
    a1 = clamp(a1, -12 * DEG, 68 * DEG);
    const bx = Math.cos(a1) * L_BOOM, by = Math.sin(a1) * L_BOOM;
    const wx2 = Math.cos(base) * d, wy2 = Math.sin(base) * d;
    let a2 = Math.atan2(wy2 - by, wx2 - bx);
    // アームの まがりすぎ を ふせぐ
    const rel = clamp(a2 - a1, -145 * DEG, -12 * DEG);
    a2 = a1 + rel;
    this._a1 = a1;
    this._a2 = a2;
    this._a3 = a3;
  }

  _applyPose(dt, immediate = false) {
    const a1 = this._a1 ?? 0.5, a2 = this._a2 ?? -0.5, a3 = this._a3 ?? CURL_CARRY;

    this.turret.rotation.y = this.yaw;
    // せんかいの はんどうで ちょっと かたむく
    const tiltZ = clamp(-this.yawVel * 0.055, -0.05, 0.05);
    this.turret.rotation.z = immediate ? tiltZ : damp(this.turret.rotation.z, tiltZ, 8, dt);
    this.turret.position.y = 0.86;

    this.boom.rotation.x = -a1;
    this.stick.rotation.x = -(a2 - a1);
    this.bucket.rotation.x = -(a3 - PHI - a2);

    // ゆあつシリンダー
    const P = this.pivot;
    const boomMid = rot2(1.55, 0.36, a1);
    const stickBase = rot2(L_BOOM, 0.16, a1);
    const stickAtt = rot2(0.5, 0.4, a2);
    const bucketLink = rot2(L_STICK, 0, a2);
    const bucketArm = rot2(0.42, 0.42, a3 - PHI);

    this._setPiston(this.pBoom, { r: P.r - 0.45, y: P.y - 0.72 }, { r: P.r + boomMid.r, y: P.y + boomMid.y });
    this._setPiston(this.pStick,
      { r: P.r + rot2(0.95, 0.52, a1).r, y: P.y + rot2(0.95, 0.52, a1).y },
      { r: P.r + stickBase.r + stickAtt.r, y: P.y + stickBase.y + stickAtt.y });
    this._setPiston(this.pBucket,
      { r: P.r + stickBase.r + rot2(0.42, 0.34, a2).r, y: P.y + stickBase.y + rot2(0.42, 0.34, a2).y },
      { r: P.r + stickBase.r + bucketLink.r + bucketArm.r, y: P.y + stickBase.y + bucketLink.y + bucketArm.y });

    // つちの みため
    const l = this.load;
    this.soilMesh.visible = l > 0.02;
    const s = 0.55 + l * 0.45;
    this.soilMesh.scale.set(1.28 * s, 0.30 + l * 0.36, 1.34 * s);
    this.soilMesh.position.set(0, -0.30 + l * 0.20, 0.52);
  }

  _setPiston(piston, A, B) {
    const dr = B.r - A.r, dy = B.y - A.y;
    const len = Math.hypot(dr, dy);
    const ang = Math.atan2(dy, dr);
    piston.g.position.set(0, A.y - 0.86, A.r);
    piston.g.rotation.set(-ang, 0, 0);
    piston.barrel.scale.z = Math.max(0.2, len * 0.62);
    piston.rod.scale.z = Math.max(0.2, len);
  }

  // ---------------- つち ----------------

  _handleSoil(dt) {
    const t = this.terrain;
    const tip = this.tipWorld;

    if (this.mode === 'dig' && this.load < 1) {
      const h = t.heightAt(tip.x, tip.z);
      const depth = h - tip.y;
      if (depth > 0.02 && t.inside(tip.x, tip.z, -0.2)) {
        // ざくっ！ ほりながら まえに すすむと たくさん とれる
        // うごかさずに おいて いる だけでも ちゃんと たまる（4さいむけの ほじょ）
        const speed = clamp(this.tipSpeed, 0, 2.6);
        const rate = clamp(1.0 + speed * 0.8, 0, 3.0);
        const removed = t.carve(tip.x, tip.z, 0.66, Math.min(depth, 0.34) * rate * dt * 3.8);
        if (removed > 0) {
          this.loadVolume += removed;
          this.load = clamp(this.loadVolume / this.capacity, 0, 1);
          this.digging = true;
          // すくうほど バケットが まるまる
          this.curlTarget = clamp(0.55 + this.load * 0.45, 0.55, 1);
          if (this.onDig) this.onDig(tip, removed, speed);
          if (this.load >= 1 && this.onFull) { this.onFull(); this.onFull = null; }
        }
      } else {
        this.digging = false;
        this.curlTarget = this.load > 0.05 ? 1 : 0.62;
      }
    } else if (this.mode === 'dump') {
      this.digging = false;
      this.curlTarget = 0;
      if (this.curl < 0.42 && this.load > 0) {
        const rate = Math.min(this.load, dt * 1.25);
        this.load -= rate;
        this.loadVolume = this.load * this.capacity;
        if (this.onDumpTick) this.onDumpTick(this.tipWorld, rate);
        if (this.load < 0.005) { this.load = 0; this.loadVolume = 0; }
      }
    } else {
      this.digging = false;
      this.curlTarget = this.load > 0.02 ? 1 : 0.78;
    }
  }

  reset() {
    this.load = 0;
    this.loadVolume = 0;
    this.curl = 1;
    this.curlTarget = 1;
    this.mode = 'idle';
    this.yaw = this.homeYaw;
    this.yawTarget = this.homeYaw;
    this.tipSpring.r.set(4.0);
    this.tipSpring.y.set(1.1);
    this.targetTip.set(
      this.group.position.x + Math.sin(this.homeYaw) * 4.0,
      1.1,
      this.group.position.z + Math.cos(this.homeYaw) * 4.0
    );
  }
}
