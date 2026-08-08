// ツリースペード本体。巨大湾曲刃 4 枚 + 油圧シリンダー + キャリア車両 + 作業員。
import * as THREE from '../vendor/three.module.js';
import * as TEX from './textures.js';
import { makeRng, rr, lerp, clamp01, smoothstep } from './util.js';
import { mergeGeoms, applyCutaway } from './world.js';

/* ---------- 円錐の寸法（刃が作る円錐） ---------- */
export const CONE = (() => {
  const R_TOP = 2.16, R_TIP = 0.95, H = 3.02;
  const H_APEX = H / (1 - R_TIP / R_TOP);
  const len = Math.hypot(R_TOP, H_APEX);
  const g = new THREE.Vector3(-R_TOP / len, -H_APEX / len, 0);      // 差し込み方向（局所）
  const n = new THREE.Vector3(H_APEX / len, -R_TOP / len, 0);       // 外向き法線（局所）
  const slant = H / Math.abs(g.y);
  return { R_TOP, R_TIP, H, H_APEX, g, n, slant, RETRACT: slant * 1.05 };
})();

export const BLADE_AZ = [45, 135, 225, 315].map((d) => (d * Math.PI) / 180);
export const GATE_BLADES = [1, 2];          // ゲート側（開く）の刃
const GATE_OPEN = (39 * Math.PI) / 180;
export const RING_R = 3.46, RING_Y = 2.96, LIFT_MAX = 4.70;

/* ---------- 刃のジオメトリ ---------- */
function bladeGeometry(arcDeg = 58, thickness = 0.085, seed = 1) {
  const { R_TOP, R_TIP, H } = CONE;
  const NS = 10, NA = 18;
  const half = (arcDeg * Math.PI) / 360;
  const rng = makeRng(seed);
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const steelTop = new THREE.Color(0.115, 0.125, 0.140);
  const steelMid = new THREE.Color(0.075, 0.062, 0.050);
  const steelTip = new THREE.Color(0.300, 0.310, 0.325);

  const push = (r, y, a, thick, side) => {
    const rr2 = r - thick * side;
    const x = Math.cos(a) * rr2, z = Math.sin(a) * rr2;
    pos.push(x, y, z);
    const nn = new THREE.Vector3(Math.cos(a) * CONE.n.x, CONE.n.y, Math.sin(a) * CONE.n.x);
    if (side) nn.negate();
    nor.push(nn.x, nn.y, nn.z);
  };
  const colorAt = (v) => {
    const c = new THREE.Color();
    if (v < 0.45) c.lerpColors(steelTop, steelMid, v / 0.45);
    else c.lerpColors(steelMid, steelTip, (v - 0.45) / 0.55);
    return c;
  };

  // 0: 外面, 1: 内面
  for (let side = 0; side < 2; side++) {
    for (let j = 0; j <= NS; j++) {
      const v = j / NS;
      const y = -H * v;
      const r = lerp(R_TOP, R_TIP, v);
      const thick = thickness * lerp(1.0, 0.16, Math.pow(v, 1.6));
      for (let i = 0; i <= NA; i++) {
        const a = lerp(-half, half, i / NA);
        // 端は少し薄く
        const edge = 1 - Math.pow(Math.abs(i / NA * 2 - 1), 5) * 0.7;
        push(r, y, a, thick * edge, side);
        uv.push(i / NA, v);
        const c = colorAt(v);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const stride = (NS + 1) * (NA + 1);
  for (let j = 0; j < NS; j++) for (let i = 0; i < NA; i++) {
    const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);                                     // 外面
    const A = a + stride, B = b + stride, C = c + stride, D = d + stride;
    idx.push(A, B, C, B, D, C);                                     // 内面
  }
  // 側端 + 上端 + 下端（刃先）
  for (let j = 0; j < NS; j++) {
    const l0 = j * (NA + 1), l1 = (j + 1) * (NA + 1);
    idx.push(l0, l0 + stride, l1, l1, l0 + stride, l1 + stride);
    const r0 = j * (NA + 1) + NA, r1 = (j + 1) * (NA + 1) + NA;
    idx.push(r0, r1, r0 + stride, r1, r1 + stride, r0 + stride);
  }
  for (let i = 0; i < NA; i++) {
    idx.push(i, i + 1, i + stride, i + 1, i + 1 + stride, i + stride);
    const b0 = NS * (NA + 1) + i;
    idx.push(b0, b0 + stride, b0 + 1, b0 + 1, b0 + stride, b0 + 1 + stride);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ---------- 材質 ---------- */
function materials() {
  const grime = TEX.grimeTexture(41);
  grime.repeat.set(2, 2);
  return {
    paint: new THREE.MeshStandardMaterial({
      color: 0xe0a018, roughness: 0.45, metalness: 0.30, map: grime,
    }),
    paintDirty: new THREE.MeshStandardMaterial({
      color: 0x8a6a26, roughness: 0.82, metalness: 0.16, map: grime,
    }),
    dark: new THREE.MeshStandardMaterial({ color: 0x33383e, roughness: 0.58, metalness: 0.62 }),
    // 刃は扇の切り取り角を小さくして、断面の左右に必ず残るようにする
    steel: applyCutaway(new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.74, metalness: 0.26,
      envMapIntensity: 0.22,
    }), 0.52),
    chrome: new THREE.MeshStandardMaterial({ color: 0xb6bdc4, roughness: 0.22, metalness: 0.90, envMapIntensity: 0.7 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x191a1c, roughness: 0.95, metalness: 0.0 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x2a3d4d, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.62,
    }),
    hose: new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.85, metalness: 0.1 }),
    vest: new THREE.MeshStandardMaterial({ color: 0xd9e83a, roughness: 0.8, metalness: 0.0 }),
    helmet: new THREE.MeshStandardMaterial({ color: 0xf0f3f5, roughness: 0.42, metalness: 0.05 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd6a887, roughness: 0.75, metalness: 0.0 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x33506e, roughness: 0.92, metalness: 0.0 }),
    beacon: new THREE.MeshStandardMaterial({
      color: 0xff8a1f, emissive: 0xff6a00, emissiveIntensity: 1.2, roughness: 0.4,
    }),
  };
}

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
};
const cyl = (r1, r2, h, mat, seg = 14) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
};

/* ---------- 作業員（成人・ヘルメットと高視認ベスト） ---------- */
export function makeWorker(M, withStand = false) {
  const w = new THREE.Group();
  for (const z of [-0.11, 0.11]) {
    const l = cyl(0.085, 0.075, 0.82, M.cloth, 8);
    l.position.set(0, 0.41, z);
    w.add(l);
  }
  const torso = cyl(0.20, 0.24, 0.66, M.vest, 10);
  torso.position.y = 1.14; w.add(torso);
  const band = cyl(0.245, 0.245, 0.09, M.chrome, 10);
  band.position.y = 1.22; w.add(band);
  const armL = new THREE.Group(), armR = new THREE.Group();
  const mkArm = () => { const a = cyl(0.062, 0.055, 0.62, M.vest, 7); a.position.y = -0.31; return a; };
  armL.add(mkArm()); armR.add(mkArm());
  armL.position.set(0, 1.42, 0.27); armR.position.set(0, 1.42, -0.27);
  armL.rotation.x = -0.18; armR.rotation.x = 0.18;
  w.add(armL); w.add(armR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), M.skin);
  head.position.y = 1.58; w.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), M.helmet);
  helmet.position.y = 1.60; w.add(helmet);
  const brim = cyl(0.185, 0.185, 0.02, M.helmet, 12);
  brim.position.y = 1.585; w.add(brim);
  w.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  if (withStand) {
    const stand = new THREE.Group();
    stand.add(cyl(0.07, 0.07, 1.0, M.dark, 8).translateY(0.5));
    const panel = box(0.44, 0.30, 0.24, M.paint, 0, 1.08, 0);
    panel.rotation.x = -0.35;
    stand.add(panel);
    stand.position.set(0.55, 0, 0);
    w.add(stand);
  }
  return { group: w, armL, armR };
}

/* ---------- 本体 ---------- */
export class TreeSpade {
  constructor() {
    this.M = materials();
    this.group = new THREE.Group();
    this.blades = [];
    this.lift = 0;
    this.gate = 0;          // 0=閉, 1=開
    this.wheelSpin = 0;
    this.t = 0;

    this.assembly = new THREE.Group();
    this.group.add(this.assembly);

    this._buildCarrier();
    this._buildRing();
    for (let i = 0; i < 4; i++) this._buildBlade(i);
    this._buildWorker();
    this.setLift(0);
    this.setGate(0);
  }

  /* --- キャリア車両 ---
     刃の展開エンベロープ（半径 3.42 まで）に触れないよう、
     車体構造はすべて x >= 3.3 に置く。 */
  _buildCarrier() {
    const M = this.M;
    const c = new THREE.Group();
    this.carrier = c;
    this.group.add(c);

    // 後部デッキ（スペード支持）— 泥で汚れている
    c.add(box(2.3, 1.52, 3.1, M.paintDirty, 4.60, 1.66, 0));
    c.add(box(2.1, 0.34, 3.3, M.dark, 4.55, 0.95, 0));
    // フレーム
    for (const z of [-1.08, 1.08]) c.add(box(6.4, 0.44, 0.28, M.dark, 7.3, 1.24, z));
    // 油圧タンク / エンジン部
    c.add(box(1.9, 1.30, 2.45, M.paint, 6.8, 2.05, 0));
    c.add(box(1.15, 0.60, 2.0, M.dark, 6.8, 2.80, 0));
    for (let i = 0; i < 5; i++) c.add(box(0.06, 0.9, 1.9, M.chrome, 6.15 + i * 0.20, 2.15, 0));
    // 工具箱
    c.add(box(1.0, 0.55, 0.7, M.paintDirty, 8.0, 1.78, 1.28));
    // キャブ
    const cab = new THREE.Group();
    cab.position.set(9.25, 1.45, 0);
    c.add(cab);
    cab.add(box(2.2, 2.05, 2.35, M.paint, 0, 1.02, 0));
    cab.add(box(2.26, 0.10, 2.42, M.dark, 0, 2.06, 0));
    cab.add(box(0.06, 1.05, 2.02, M.glass, 1.09, 1.32, 0));
    cab.add(box(1.5, 0.95, 0.06, M.glass, -0.1, 1.32, 1.16));
    cab.add(box(1.5, 0.95, 0.06, M.glass, -0.1, 1.32, -1.16));
    cab.add(box(0.9, 0.55, 2.36, M.dark, -0.62, 0.30, 0));
    // ミラー
    for (const z of [-1.28, 1.28]) {
      const arm = cyl(0.03, 0.03, 0.42, M.dark, 6);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(1.02, 1.78, z * 0.84);
      cab.add(arm);
      cab.add(box(0.05, 0.40, 0.16, M.dark, 1.02, 1.70, z));
    }
    // 回転灯
    const beacon = cyl(0.13, 0.13, 0.22, M.beacon, 10);
    beacon.position.set(-0.55, 2.22, 0.70);
    cab.add(beacon);
    this.beacon = beacon;
    this.beaconLight = new THREE.PointLight(0xff7a10, 0, 8, 2);
    this.beaconLight.position.copy(beacon.position);
    cab.add(this.beaconLight);
    // 作業灯（根鉢を照らす）
    for (const z of [-1.0, 1.0]) {
      const lamp = box(0.24, 0.20, 0.26, M.dark, 4.9, 3.35, z);
      c.add(lamp);
      const lens = box(0.05, 0.15, 0.20, new THREE.MeshStandardMaterial({
        color: 0xfff4d6, emissive: 0xffe9b0, emissiveIntensity: 1.6, roughness: 0.3,
      }), 4.77, 3.35, z);
      c.add(lens);
    }
    this.workLight = new THREE.PointLight(0xfff0d2, 0, 11, 1.3);
    this.workLight.position.set(3.4, 3.2, 0);
    c.add(this.workLight);

    // 排気
    const stack = cyl(0.09, 0.075, 1.6, M.chrome, 10);
    stack.position.set(7.95, 3.10, -1.05);
    c.add(stack);

    // 車輪
    this.wheels = [];
    const wg = new THREE.CylinderGeometry(0.74, 0.74, 0.48, 18);
    wg.rotateX(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.26, 0.26, 0.52, 10);
    hub.rotateX(Math.PI / 2);
    for (const x of [5.95, 7.45, 10.35]) for (const z of [-1.30, 1.30]) {
      const g = new THREE.Group();
      const w = new THREE.Mesh(wg, M.rubber); w.castShadow = true;
      const h = new THREE.Mesh(hub, M.paintDirty); h.position.z = z > 0 ? 0.06 : -0.06;
      g.add(w); g.add(h);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const t = box(0.16, 0.10, 0.5, M.rubber, Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0);
        t.rotation.z = a; t.castShadow = false;
        g.add(t);
      }
      g.position.set(x, 0.74, z);
      c.add(g);
      this.wheels.push(g);
    }
    // 泥よけ
    for (const z of [-1.36, 1.36]) c.add(box(2.6, 0.10, 0.68, M.paintDirty, 6.7, 1.62, z));
  }

  /* --- リング（ゲート開口つき） --- */
  _buildRing() {
    const M = this.M;
    const a0 = (200 * Math.PI) / 180, a1 = (520 * Math.PI) / 180;
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const a = lerp(a0, a1, i / 48);
      pts.push(new THREE.Vector3(Math.cos(a) * RING_R, RING_Y, Math.sin(a) * RING_R));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const ring = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.17, 8, false), M.paint);
    ring.castShadow = true;
    this.assembly.add(ring);
    // 下側の補強リング
    const pts2 = pts.map((p) => new THREE.Vector3(p.x * 0.94, RING_Y - 0.80, p.z * 0.94));
    const ring2 = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 60, 0.12, 6, false), M.paint);
    this.assembly.add(ring2);
    // ゲート端の柱
    for (const a of [a0, a1]) {
      const post = cyl(0.15, 0.15, 0.95, M.paint, 10);
      post.position.set(Math.cos(a) * RING_R, RING_Y - 0.40, Math.sin(a) * RING_R);
      this.assembly.add(post);
    }
    // マストへつながる支持アーム + スライダー
    const MAST_X = 4.35, MAST_Z = 1.46;
    for (const z of [-MAST_Z, MAST_Z]) {
      const ringX = Math.sqrt(Math.max(0.1, RING_R * RING_R - z * z));
      const len = MAST_X - ringX + 0.5;
      this.assembly.add(box(len, 0.32, 0.30, M.paint, (ringX + MAST_X) / 2 + 0.1, RING_Y - 0.30, z));
      const slider = box(0.62, 0.80, 0.62, M.dark, MAST_X, RING_Y - 0.30, z);
      this.assembly.add(slider);
      // 斜めのブレース
      const br = box(0.9, 0.20, 0.20, M.paint, (ringX + MAST_X) / 2 + 0.1, RING_Y - 1.05, z);
      br.rotation.z = 0.5;
      this.assembly.add(br);
    }
    // マスト（車体側・固定）
    for (const z of [-MAST_Z, MAST_Z]) {
      this.carrier.add(box(0.36, 8.3, 0.36, M.dark, MAST_X, 4.15, z));
      this.carrier.add(box(0.5, 0.24, 0.5, M.paint, MAST_X, 8.35, z));
    }
    this.carrier.add(box(0.28, 0.28, 2 * MAST_Z, M.dark, MAST_X, 8.05, 0));

    // リフトシリンダー
    this.liftCyl = [];
    for (const z of [-0.72, 0.72]) {
      const body = cyl(0.20, 0.20, 1.8, M.dark, 12);
      body.position.set(MAST_X, 1.55, z);
      this.carrier.add(body);
      const cap = cyl(0.24, 0.24, 0.16, M.paint, 12);
      cap.position.set(MAST_X, 0.70, z);
      this.carrier.add(cap);
      const rod = cyl(0.12, 0.12, 1.0, M.chrome, 10);
      rod.position.set(MAST_X, 2.4, z);
      this.carrier.add(rod);
      this.liftCyl.push({ body, rod, z, bottom: 0.70 });
    }
    this.MAST_X = MAST_X;

    // ホース
    for (let i = 0; i < 4; i++) {
      const z = -1.05 + i * 0.7;
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(5.3, 2.4, z), new THREE.Vector3(4.8, 3.6 + i * 0.12, z * 1.2),
        new THREE.Vector3(4.1, 2.8, z * 1.35),
      ]);
      this.carrier.add(new THREE.Mesh(new THREE.TubeGeometry(c, 12, 0.045, 5, false), this.M.hose));
    }
  }

  /* --- 刃ユニット --- */
  _buildBlade(i) {
    const M = this.M;
    const g = new THREE.Group();
    g.rotation.y = -BLADE_AZ[i];       // x = r*cos(az), z = r*sin(az) となるよう
    this.assembly.add(g);

    const gd = CONE.g, nd = CONE.n;
    const R = CONE.RETRACT;
    const P0 = new THREE.Vector3(CONE.R_TOP, 0, 0);     // 刃の上端（円錐面上）
    const at = (along, out) => P0.clone().addScaledVector(gd, along).addScaledVector(nd, out);

    // レール
    const railLen = R + 1.35;
    const rail = box(0.30, railLen, 0.66, M.paint);
    const railAxis = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(railAxis, gd.clone().negate());
    rail.quaternion.copy(q);
    rail.position.copy(at(-R * 0.52, 0.38));
    g.add(rail);

    // レール上端の台座
    const head = box(0.56, 0.44, 0.92, M.paint);
    head.quaternion.copy(q);
    head.position.copy(at(-R - 0.42, 0.38));
    g.add(head);

    // シリンダー本体
    const body = cyl(0.155, 0.155, 1.55, M.dark, 12);
    body.quaternion.copy(q);
    const bodyCenter = at(-R + 0.10, 0.76);
    body.position.copy(bodyCenter);
    g.add(body);
    const cap = cyl(0.19, 0.19, 0.14, M.paint, 12);
    cap.quaternion.copy(q);
    cap.position.copy(at(-R - 0.65, 0.76));
    g.add(cap);

    // ロッド（伸縮）
    const rod = cyl(0.085, 0.085, 1, M.chrome, 10);
    rod.quaternion.copy(q);
    g.add(rod);

    // 刃 + キャリッジ
    const bladeUnit = new THREE.Group();
    g.add(bladeUnit);
    const blade = new THREE.Mesh(bladeGeometry(58, 0.095, i * 13 + 3), M.steel);
    blade.castShadow = true;
    blade.receiveShadow = true;
    bladeUnit.add(blade);
    // キャリッジ（黄色の板）
    const carriage = box(0.40, 0.34, 1.5, M.paint);
    carriage.quaternion.copy(q);
    carriage.position.copy(nd.clone().multiplyScalar(0.20).add(new THREE.Vector3(CONE.R_TOP, 0, 0)));
    bladeUnit.add(carriage);
    // 刃の上端の補強フランジ
    const flangePts = [];
    for (let k = 0; k <= 12; k++) {
      const a = lerp(-30, 30, k / 12) * Math.PI / 180;
      flangePts.push(new THREE.Vector3(Math.cos(a) * (CONE.R_TOP + 0.06), 0.0, Math.sin(a) * (CONE.R_TOP + 0.06)));
    }
    const flange = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(flangePts), 18, 0.075, 5, false), M.paint);
    bladeUnit.add(flange);

    // 当たり判定用（指で直接ドラッグする）
    const pick = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.2, 2.6),
      new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.set(CONE.R_TOP * 0.7, -CONE.H * 0.35, 0);
    bladeUnit.add(pick);

    // ハイライト（操作対象を示す）
    const hlMat = new THREE.MeshBasicMaterial({
      color: 0xffe66a, transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide,
    });
    const hl = new THREE.Mesh(bladeGeometry(62, 0.30, i * 13 + 3), hlMat);
    hl.scale.setScalar(1.03);
    bladeUnit.add(hl);

    const unit = {
      i, group: g, bladeUnit, blade, rod, pick, hl, hlMat,
      t: 0, baseAz: BLADE_AZ[i], az: BLADE_AZ[i],
      bodyCenter, gd, nd, R,
      tipLocal: new THREE.Vector3(CONE.R_TIP, -CONE.H, 0),
      midLocal: new THREE.Vector3((CONE.R_TOP + CONE.R_TIP) / 2, -CONE.H * 0.5, 0),
    };
    this.blades.push(unit);
    this.setBlade(i, 0);
  }

  /* --- 作業員（成人・安全な位置） --- */
  _buildWorker() {
    const w = makeWorker(this.M, true);
    this.worker = w.group;
    this.workerArmL = w.armL;
    this.workerArmR = w.armR;
    w.group.position.set(6.9, 0, 3.3);
    w.group.rotation.y = -Math.PI * 0.62;
    this.carrier.add(w.group);
  }

  /* ---------- 操作 ---------- */
  setBlade(i, t) {
    const u = this.blades[i];
    u.t = clamp01(t);
    const off = (u.t - 1) * u.R;
    u.bladeUnit.position.copy(u.gd).multiplyScalar(off);
    // ロッド：シリンダー本体からキャリッジまで
    const carriageP = u.gd.clone().multiplyScalar(off).addScaledVector(u.nd, 0.76)
      .add(new THREE.Vector3(CONE.R_TOP, 0, 0));
    const start = u.bodyCenter.clone().addScaledVector(u.gd, 0.72);
    const d = carriageP.clone().sub(start);
    const len = Math.max(0.12, d.length());
    u.rod.scale.y = len;
    u.rod.position.copy(start).addScaledVector(d, 0.5);
  }
  getBlade(i) { return this.blades[i].t; }

  setGate(v) {
    this.gate = clamp01(v);
    for (const u of this.blades) {
      const s = GATE_BLADES.includes(u.i) ? (u.i === 1 ? -1 : 1) : 0;
      u.az = u.baseAz + s * GATE_OPEN * this.gate;
      u.group.rotation.y = -u.az;
    }
  }

  setLift(y) {
    this.lift = y;
    this.assembly.position.y = y;
    const attachY = RING_Y - 0.30 + y;
    for (const lc of this.liftCyl) {
      const len = Math.max(0.3, attachY - lc.bottom);
      lc.rod.scale.y = len;
      lc.rod.position.y = lc.bottom + len * 0.5;
    }
  }

  highlight(i, v) {
    const u = this.blades[i];
    u.hlMat.opacity = v * 0.34;
  }

  /* ---------- 座標取得 ---------- */
  bladeTipWorld(i, out = new THREE.Vector3()) {
    const u = this.blades[i];
    out.copy(u.tipLocal);
    u.bladeUnit.localToWorld(out);
    return out;
  }
  bladeMidWorld(i, out = new THREE.Vector3()) {
    const u = this.blades[i];
    out.copy(u.midLocal);
    u.bladeUnit.localToWorld(out);
    return out;
  }
  bladeAzimuthWorld(i) {
    return this.blades[i].az - this.group.rotation.y;
  }
  ringCenterWorld(out = new THREE.Vector3()) {
    out.set(0, 0, 0);
    this.assembly.localToWorld(out);
    return out;
  }

  pickMeshes() { return this.blades.map((b) => b.pick); }

  /* ---------- 毎フレーム ---------- */
  update(dt, driveSpeed = 0) {
    this.t += dt;
    this.wheelSpin += driveSpeed * dt / 0.74;
    for (const w of this.wheels) w.rotation.z = -this.wheelSpin;
    // 回転灯
    const b = (Math.sin(this.t * 6.0) * 0.5 + 0.5);
    this.beacon.material.emissiveIntensity = 0.35 + b * 2.2;
    this.beaconLight.intensity = b * 1.6;
    // 作業員のちょっとした動き
    const s = Math.sin(this.t * 1.6) * 0.06;
    this.workerArmL.rotation.x = -0.18 + s;
    this.workerArmR.rotation.x = 0.18 - s;
  }

  setWorkLight(v) { this.workLight.intensity = v; }

  setBeacon(on) {
    this.beacon.visible = true;
    this.beaconLight.visible = on;
  }
}
