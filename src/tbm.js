/* ============================================================
 *  tbm.js — トンネルボーリングマシン本体のモデル
 *
 *  「カットモデル」として作る：手前側(-X)の外板だけを省き、
 *  リブ・機械・コンベアはすべて残す。断面から内部が丸見えになる。
 * ============================================================ */
import * as THREE from 'three';
import * as C from './config.js';
import {
  makePaintedSteel, makeBeltTexture, makeGlowTexture, makeGratingTexture,
  makeHazardTexture, mulberry32,
} from './textures.js';

const D2R = Math.PI / 180;

/* ---------- ジオメトリ小道具 ---------- */
function axialCyl(rt, rb, h, seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  g.rotateX(Math.PI / 2);
  return g;
}
/** 軸=Z の筒。周方向を alpha0..alpha0+alphaLen（度・+X から反時計回り）だけ残す */
function shell(r, len, alpha0, alphaLen, seg = 48) {
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true,
    (alpha0 + 90) * D2R, alphaLen * D2R);
  g.rotateX(Math.PI / 2);
  return g;
}
function axialTorus(r, tube, seg = 10, rad = 56) {
  return new THREE.TorusGeometry(r, tube, seg, rad);   // 既に XY 平面＝軸 Z
}
/** 周方向を alpha0..alpha0+alphaLen（度）だけ残したトーラス（カットモデル用） */
function axialTorusArc(r, tube, alpha0, alphaLen, seg = 8, rad = 40) {
  const g = new THREE.TorusGeometry(r, tube, seg, rad, alphaLen * D2R);
  g.rotateZ(alpha0 * D2R);
  return g;
}
function tube(points, r, seg = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, Math.max(12, points.length * 6), r, seg, false);
}

/* ---------- 材質 ---------- */
export function buildMaterials() {
  const yellow = makePaintedSteel(0xd7a520, 3, { wear: 1.15 });
  const orange = makePaintedSteel(0xc6621c, 8, { wear: 1.0 });
  const gray = makePaintedSteel(0x707880, 12, { wear: 1.3 });
  const dark = makePaintedSteel(0x3c4148, 17, { rivets: false, wear: 1.4 });
  const belt = makeBeltTexture();

  const mk = (t, opts) => new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    metalness: 0.55, roughness: 0.7, ...opts,
  });

  return {
    // 塗装面は誘電体。金属度を上げすぎると玩具っぽく光ってしまう。
    yellow: mk(yellow, { metalness: 0.18, roughness: 0.66 }),
    orange: mk(orange, { metalness: 0.18, roughness: 0.64 }),
    gray: mk(gray, { metalness: 0.45, roughness: 0.62 }),
    dark: mk(dark, { metalness: 0.5, roughness: 0.6 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xb9c1c8, metalness: 1.0, roughness: 0.18 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x6e767d, metalness: 0.85, roughness: 0.46 }),
    wear: new THREE.MeshStandardMaterial({ color: 0x9b958d, metalness: 0.9, roughness: 0.36 }),
    rubber: new THREE.MeshStandardMaterial({ map: belt, color: 0xffffff, metalness: 0.0, roughness: 0.95 }),
    black: new THREE.MeshStandardMaterial({ color: 0x23262a, metalness: 0.3, roughness: 0.85 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb02a24, metalness: 0.35, roughness: 0.55 }),
    pink: new THREE.MeshStandardMaterial({ color: 0xef7fb0, metalness: 0.15, roughness: 0.5 }),
    lampOn: new THREE.MeshStandardMaterial({
      color: 0xfff2d0, emissive: 0xffd487, emissiveIntensity: 3.2, roughness: 0.3,
    }),
    beacon: new THREE.MeshStandardMaterial({
      color: 0xffb347, emissive: 0xff7a1a, emissiveIntensity: 2.6, roughness: 0.4,
    }),
    screen: new THREE.MeshStandardMaterial({
      color: 0x0d2b33, emissive: 0x2ad0c0, emissiveIntensity: 1.1, roughness: 0.25,
    }),
    glow: new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: 0xffd9a0,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85,
    }),
    hazard: new THREE.MeshStandardMaterial({
      map: makeHazardTexture(), metalness: 0.25, roughness: 0.62,
    }),
    grating: new THREE.MeshStandardMaterial({
      map: makeGratingTexture(), transparent: true, alphaTest: 0.4,
      color: 0x9aa0a6, metalness: 0.7, roughness: 0.6, side: THREE.DoubleSide,
    }),
  };
}

/* ============================================================
 *  カッターヘッド
 * ============================================================ */
function buildCutterhead(M) {
  const g = new THREE.Group();
  g.name = 'cutterhead';
  const R = C.HEAD_R;
  const ARMS = 6;
  const FRONT = 0.0;      // ヘッド前面をローカル 0 とする

  // --- 外周リム（大径の輪。回転が一目で分かる要）---
  const rim = new THREE.Mesh(axialTorus(R - 0.14, 0.26, 12, 64), M.dark);
  rim.position.z = FRONT - 0.26;
  g.add(rim);
  const rimBand = new THREE.Mesh(shell(R - 0.02, 0.5, 0, 360, 64), M.wear);
  rimBand.position.z = FRONT - 0.3;
  rimBand.material = M.wear;
  g.add(rimBand);
  // 外周の摩耗保護リング（黄色の警戒色）
  const rimWarn = new THREE.Mesh(axialTorus(R - 0.16, 0.13, 8, 72), M.hazard);
  rimWarn.position.z = FRONT - 0.66;
  g.add(rimWarn);

  // --- 中央ハブ（円錐状に前へ出る）---
  const hubCone = new THREE.Mesh(axialCyl(0.55, 1.25, 0.75, 28), M.dark);
  hubCone.position.z = FRONT - 0.06;
  g.add(hubCone);
  const hubCap = new THREE.Mesh(axialCyl(0.55, 0.55, 0.14, 24), M.wear);
  hubCap.position.z = FRONT + 0.30;
  g.add(hubCap);

  // --- 放射状アーム（間が土砂取込口になる）---
  const armGeo = new THREE.BoxGeometry(0.74, R - 1.0, 0.62);
  const armFace = new THREE.BoxGeometry(0.86, R - 1.0, 0.18);
  for (let i = 0; i < ARMS; i++) {
    const a = (i / ARMS) * Math.PI * 2;
    const arm = new THREE.Group();
    arm.rotation.z = a;
    const body = new THREE.Mesh(armGeo, M.dark);
    body.position.set(0, (R - 1.0) / 2 + 0.85, FRONT - 0.42);
    arm.add(body);
    const face = new THREE.Mesh(armFace, M.wear);
    face.position.set(0, (R - 1.0) / 2 + 0.85, FRONT - 0.03);
    arm.add(face);
    // アーム背面の補強リブ
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.26, R - 1.2, 0.42), M.gray);
    rib.position.set(0, (R - 1.1) / 2 + 0.9, FRONT - 0.95);
    arm.add(rib);
    // 取込口のリップ（スクレーパ）
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.42), M.wear);
    lip.position.set(0.62, R * 0.62, FRONT - 0.20);
    lip.rotation.z = 0.22;
    arm.add(lip);
    g.add(arm);
  }

  // --- 背面のスポーク（ハブとリムをつなぐ）---
  for (let i = 0; i < ARMS; i++) {
    const a = (i / ARMS) * Math.PI * 2 + Math.PI / ARMS;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.3, R - 1.2, 0.3), M.gray);
    s.position.set(Math.cos(a) * (R * 0.5 + 0.3), Math.sin(a) * (R * 0.5 + 0.3), FRONT - 1.05);
    s.rotation.z = a - Math.PI / 2;
    g.add(s);
  }

  /* --- ディスクカッター（インスタンス化）--- */
  // 断面プロファイル（V 字のリング刃）
  const prof = [];
  prof.push(new THREE.Vector2(0.11, -0.11));
  prof.push(new THREE.Vector2(0.26, -0.11));
  prof.push(new THREE.Vector2(0.345, -0.030));
  prof.push(new THREE.Vector2(0.345, 0.030));
  prof.push(new THREE.Vector2(0.26, 0.11));
  prof.push(new THREE.Vector2(0.11, 0.11));
  const discGeo = new THREE.LatheGeometry(prof, 18);     // 軸 = Y
  const hubGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.34, 10);
  const houseGeo = new THREE.BoxGeometry(0.44, 0.40, 0.30);

  const slots = [];
  const rand = mulberry32(5);
  for (let i = 0; i < ARMS; i++) {
    const a = (i / ARMS) * Math.PI * 2;
    // 半径方向に少しずつずらして螺旋状の切削軌跡を作る
    for (let k = 0; k < 8; k++) {
      const rr = 1.05 + k * 0.44 + (i % 2) * 0.22;
      if (rr > R - 0.45) continue;
      slots.push({ a, rr, tilt: 0, z: FRONT + 0.12 });
    }
  }
  // 中心カッター
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    slots.push({ a, rr: 0.42, tilt: 0.5, z: FRONT + 0.30 });
  }
  // ゲージカッター（外周を斜めに削る）
  for (let i = 0; i < ARMS; i++) {
    const a = (i / ARMS) * Math.PI * 2;
    slots.push({ a, rr: R - 0.34, tilt: -0.55, z: FRONT - 0.02 });
    slots.push({ a: a + 0.12, rr: R - 0.62, tilt: -0.3, z: FRONT + 0.04 });
  }

  const N = slots.length;
  const discs = new THREE.InstancedMesh(discGeo, M.wear, N);
  const hubs = new THREE.InstancedMesh(hubGeo, M.steel, N);
  const houses = new THREE.InstancedMesh(houseGeo, M.dark, N);
  discs.frustumCulled = false; hubs.frustumCulled = false; houses.frustumCulled = false;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(),
    pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1);
  const eul = new THREE.Euler();
  const spins = new Float32Array(N);
  for (let i = 0; i < N; i++) spins[i] = rand() * 6.28;

  function writeCutters(spinAmount) {
    for (let i = 0; i < N; i++) {
      const s = slots[i];
      pos.set(Math.cos(s.a) * s.rr, Math.sin(s.a) * s.rr, s.z);
      eul.set(s.tilt, spins[i] + spinAmount * (2.4 + (i % 5) * 0.3), s.a, 'ZXY');
      q.setFromEuler(eul);
      mtx.compose(pos, q, scl);
      discs.setMatrixAt(i, mtx);
      hubs.setMatrixAt(i, mtx);
      // ハウジングは回さない
      eul.set(s.tilt, 0, s.a, 'ZXY');
      q.setFromEuler(eul);
      const p2 = pos.clone(); p2.z -= 0.26;
      mtx.compose(p2, q, scl);
      houses.setMatrixAt(i, mtx);
    }
    discs.instanceMatrix.needsUpdate = true;
    hubs.instanceMatrix.needsUpdate = true;
    houses.instanceMatrix.needsUpdate = true;
  }
  writeCutters(0);
  houses.instanceMatrix.needsUpdate = true;
  g.add(discs, hubs, houses);

  // --- 取込口のバケット（外周で土砂をすくう）---
  for (let i = 0; i < ARMS; i++) {
    const a = (i / ARMS) * Math.PI * 2 + Math.PI / ARMS;
    const b = new THREE.Group();
    b.rotation.z = a;
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.85), M.gray);
    scoop.position.set(0, R - 0.55, FRONT - 0.72);
    b.add(scoop);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.9), M.wear);
    wall.position.set(0, R - 0.22, FRONT - 0.7);
    b.add(wall);
    g.add(b);
  }

  return { group: g, writeCutters };
}

/* ============================================================
 *  スクリューコンベア（泥土圧シールドの象徴的な装置）
 * ============================================================ */
function buildScrew(M) {
  const g = new THREE.Group();
  const A = new THREE.Vector3(0, -2.78, 9.90);
  const B = new THREE.Vector3(0, -1.42, 6.70);
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);

  const holder = new THREE.Group();
  holder.position.copy(mid);
  holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
  g.add(holder);

  // ケーシング（手前 120°を切り欠いて中のスクリューを見せる）
  const casing = new THREE.Mesh(shell(0.62, len, -60, 240, 32), M.orange);
  casing.material.side = THREE.DoubleSide;
  holder.add(casing);
  // 端部のフランジ
  for (const z of [-len / 2, len / 2]) {
    const f = new THREE.Mesh(axialTorus(0.64, 0.09, 8, 28), M.gray);
    f.position.z = z; holder.add(f);
  }

  // スクリュー羽根（螺旋のリボン）
  const turns = 5.5, segs = 200, rIn = 0.14, rOut = 0.52;
  const posArr = [], idx = [], nrm = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = t * turns * Math.PI * 2;
    const z = -len / 2 + t * len;
    const ca = Math.cos(a), sa = Math.sin(a);
    posArr.push(ca * rIn, sa * rIn, z);
    posArr.push(ca * rOut, sa * rOut, z);
    nrm.push(0, 0, 1, 0, 0, 1);
    if (i < segs) {
      const b = i * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const ribbon = new THREE.BufferGeometry();
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  ribbon.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  ribbon.setIndex(idx);
  ribbon.computeVertexNormals();
  const flight = new THREE.Mesh(ribbon, new THREE.MeshStandardMaterial({
    color: 0x9a8163, metalness: 0.85, roughness: 0.45, side: THREE.DoubleSide,
  }));
  const shaft = new THREE.Mesh(axialCyl(0.13, 0.13, len, 14), M.steel);
  const spinner = new THREE.Group();
  spinner.add(flight, shaft);
  holder.add(spinner);

  // 排土ゲート
  const gate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.5), M.yellow);
  gate.position.set(0, -1.48, 6.55);
  g.add(gate);

  return { group: g, spinner };
}

/* ============================================================
 *  ベルトコンベア（土砂を後方へ流す）
 * ============================================================ */
export const BELT_PATH = [
  new THREE.Vector3(0, -2.28, 6.30),
  new THREE.Vector3(0, -1.20, 2.40),
  new THREE.Vector3(0, -1.05, -6.00),
  new THREE.Vector3(0, -1.05, -19.5),
];

function buildBelt(M) {
  const g = new THREE.Group();
  const W = 1.20;
  const segs = [];
  for (let i = 0; i < BELT_PATH.length - 1; i++) {
    const A = BELT_PATH[i], B = BELT_PATH[i + 1];
    const dir = new THREE.Vector3().subVectors(B, A);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
    const holder = new THREE.Group();
    holder.position.copy(mid);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    g.add(holder);

    // ベルト面
    const beltGeo = new THREE.BoxGeometry(W, 0.08, len);
    const uv = beltGeo.attributes.uv;
    const mat = M.rubber.clone();
    mat.map = M.rubber.map.clone();
    mat.map.repeat.set(1, len / 1.2);
    mat.map.needsUpdate = true;
    const belt = new THREE.Mesh(beltGeo, mat);
    holder.add(belt);
    segs.push(mat.map);

    // 側板
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, len), M.yellow);
      side.position.set(s * (W / 2 + 0.04), 0.16, 0);
      holder.add(side);
    }
    // フレーム下弦
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, len), M.gray);
    beam.position.y = -0.32;
    holder.add(beam);

    // ローラー
    const n = Math.max(3, Math.round(len / 0.75));
    const rollGeo = new THREE.CylinderGeometry(0.12, 0.12, W * 0.96, 10);
    const rolls = new THREE.InstancedMesh(rollGeo, M.dark, n);
    const m4 = new THREE.Matrix4();
    for (let k = 0; k < n; k++) {
      m4.makeRotationZ(Math.PI / 2);
      m4.setPosition(0, -0.14, -len / 2 + (k + 0.5) * (len / n));
      rolls.setMatrixAt(k, m4);
    }
    holder.add(rolls);
  }

  // 排土シュート
  const chute = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.14), M.yellow);
  chute.position.set(0, -1.55, -19.6);
  chute.rotation.x = 0.35;
  g.add(chute);

  return { group: g, maps: segs };
}

/* ============================================================
 *  セグメントエレクター
 * ============================================================ */
function buildErector(M) {
  const g = new THREE.Group();
  g.position.z = C.ERECTOR_Z;

  // 固定側：リング状の支持架台（中央はコンベアが通る大穴）
  const stator = new THREE.Group();
  const ringA = new THREE.Mesh(axialTorus(2.15, 0.2, 10, 48), M.gray);
  const ringB = new THREE.Mesh(axialTorus(2.15, 0.2, 10, 48), M.gray);
  ringA.position.z = 0.42; ringB.position.z = -0.42;
  stator.add(ringA, ringB);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.95), M.gray);
    st.position.set(Math.cos(a) * 2.15, Math.sin(a) * 2.15, 0);
    stator.add(st);
    // 架台からシールドへの支持
    const sup = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.16), M.dark);
    sup.position.set(Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0.55);
    sup.rotation.z = a - Math.PI / 2;
    stator.add(sup);
  }
  g.add(stator);

  // 旋回体
  const rotor = new THREE.Group();
  g.add(rotor);
  const gear = new THREE.Mesh(axialCyl(1.92, 1.92, 0.36, 40), M.dark);
  rotor.add(gear);
  // 歯
  const toothGeo = new THREE.BoxGeometry(0.11, 0.17, 0.34);
  const teeth = new THREE.InstancedMesh(toothGeo, M.steel, 46);
  {
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(),
      ss = new THREE.Vector3(1, 1, 1), ee = new THREE.Euler();
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      pp.set(Math.cos(a) * 2.0, Math.sin(a) * 2.0, 0);
      ee.set(0, 0, a); qq.setFromEuler(ee);
      m4.compose(pp, qq, ss); teeth.setMatrixAt(i, m4);
    }
  }
  rotor.add(teeth);
  // 駆動ピニオン
  const pinion = new THREE.Mesh(axialCyl(0.34, 0.34, 0.4, 16), M.orange);
  pinion.position.set(2.42, 0.6, 0); pinion.rotation.z = 0.3;
  stator.add(pinion);

  // アーム（伸縮）
  const arm = new THREE.Group();
  rotor.add(arm);
  const armOuter = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.35, 0.62), M.yellow);
  armOuter.position.set(0, 2.35, 0);
  arm.add(armOuter);
  const armInner = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.5, 0.46), M.gray);
  arm.add(armInner);
  // 伸縮シリンダ
  const cylA = new THREE.Mesh(axialCyl(0.11, 0.11, 1.0, 12), M.dark);
  cylA.rotation.x = Math.PI / 2; cylA.position.set(0.42, 2.3, 0.0);
  arm.add(cylA);
  const rodA = new THREE.Mesh(axialCyl(0.07, 0.07, 1.0, 12), M.chrome);
  rodA.rotation.x = Math.PI / 2;
  arm.add(rodA);

  // 把持ヘッド（真空パッド付き、軸方向に後退した位置）
  const head = new THREE.Group();
  arm.add(head);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.24, 1.35), M.orange);
  head.add(plate);
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), M.gray);
  head.add(yoke);
  const padGeo = axialCyl(0.24, 0.26, 0.2, 14);
  for (const dx of [-0.62, 0.62]) {
    for (const dz of [-0.42, 0.42]) {
      const pad = new THREE.Mesh(padGeo, M.black);
      pad.rotation.x = Math.PI / 2;
      pad.position.set(dx, 0.2, dz);
      head.add(pad);
    }
  }
  // 油圧ホース
  const hose = new THREE.Mesh(tube([[0.2, 0.1, 0.1], [0.5, 1.0, 0.4], [0.25, 2.1, 0.1]], 0.055, 6), M.black);
  arm.add(hose);

  return { group: g, rotor, arm, armInner, rodA, head };
}

/* ============================================================
 *  推進ジャッキ
 * ============================================================ */
function buildJacks(M) {
  const g = new THREE.Group();
  const jacks = [];
  const barrelGeo = axialCyl(0.2, 0.2, C.JACK_LEN, 14);
  const rodGeo = axialCyl(0.125, 0.125, 1.0, 12);
  const shoeGeo = new THREE.BoxGeometry(0.66, 0.52, 0.22);

  for (let i = 0; i < C.JACK_N; i++) {
    const a = (i / C.JACK_N) * Math.PI * 2 + Math.PI / C.JACK_N;
    const x = Math.cos(a) * C.JACK_R, y = Math.sin(a) * C.JACK_R;

    const barrel = new THREE.Mesh(barrelGeo, M.gray);
    barrel.position.set(x, y, C.JACK_Z0 + C.JACK_LEN / 2);
    g.add(barrel);
    // 基部の取り付け座
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.26), M.dark);
    foot.position.set(x, y, C.JACK_Z0 + C.JACK_LEN + 0.14);
    foot.rotation.z = a;
    g.add(foot);
    // 給油ホース
    const hs = new THREE.Mesh(tube([
      [x, y, C.JACK_Z0 + 0.2],
      [x * 0.86, y * 0.86, C.JACK_Z0 + 0.9],
      [x * 0.82, y * 0.82, C.JACK_Z0 + C.JACK_LEN],
    ], 0.045, 6), M.black);
    g.add(hs);

    const rod = new THREE.Mesh(rodGeo, M.chrome);
    rod.position.set(x, y, 0);
    g.add(rod);

    const shoe = new THREE.Mesh(shoeGeo, M.yellow);
    shoe.position.set(x, y, 0);
    shoe.rotation.z = a;
    g.add(shoe);

    jacks.push({ a, x, y, rod, shoe });
  }
  return { group: g, jacks };
}

/* ============================================================
 *  TBM 全体
 * ============================================================ */
export function buildTBM(M) {
  const root = new THREE.Group();
  root.name = 'TBM';

  /* ---- 前胴シールド（手前側を切り欠いたカットモデル）---- */
  const skinLen = C.SHIELD_Z1 - C.SHIELD_Z0;
  const skin = new THREE.Mesh(shell(C.SHIELD_R, skinLen, -95, 200, 64), M.yellow);
  skin.material = M.yellow.clone();
  skin.material.side = THREE.DoubleSide;
  skin.position.z = C.SHIELD_Z0 + skinLen / 2;
  root.add(skin);
  // シールドの前端リング（刃口）
  const cutEdge = new THREE.Mesh(axialTorus(C.SHIELD_R - 0.06, 0.14, 10, 64), M.wear);
  cutEdge.position.z = C.SHIELD_Z1;
  root.add(cutEdge);

  /* ---- 円環リブ（切り欠いても円筒だと分かるように全周残す）---- */
  const ribZ = [0.55, 2.0, 3.5, 5.0, 6.4, 7.9, 9.35, 10.35];
  for (const z of ribZ) {
    const r = new THREE.Mesh(axialTorusArc(C.SHIELD_R - 0.16, 0.12, -96, 202), M.gray);
    r.position.z = z;
    root.add(r);
  }
  /* ---- 縦通材（手前側は開けておく）---- */
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (Math.cos(a) < -0.30) continue;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 10.0), M.gray);
    b.position.set(Math.cos(a) * (C.SHIELD_R - 0.3), Math.sin(a) * (C.SHIELD_R - 0.3), 5.2);
    root.add(b);
  }

  /* ---- 隔壁（チャンバとマシンを仕切る）---- */
  const bulkGeo = new THREE.RingGeometry(1.6, C.SHIELD_R - 0.18, 56, 1,
    -96 * D2R, 202 * D2R);
  const bulk = new THREE.Mesh(bulkGeo, M.gray.clone());
  bulk.position.z = C.BULKHEAD_Z;
  bulk.material.side = THREE.DoubleSide;
  root.add(bulk);
  // 切り欠いた縁（板厚を見せる）
  for (const a of [-96, 106]) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.12, C.SHIELD_R - 1.78, 0.16), M.wear);
    lip.position.set(Math.cos(a * D2R) * (C.SHIELD_R + 1.6) / 2,
      Math.sin(a * D2R) * (C.SHIELD_R + 1.6) / 2, C.BULKHEAD_Z);
    lip.rotation.z = a * D2R - Math.PI / 2;
    root.add(lip);
  }
  // チャンバ点検窓
  for (let i = 0; i < 3; i++) {
    const a = 0.6 + i * 1.3;
    const w = new THREE.Mesh(axialCyl(0.28, 0.28, 0.2, 16), M.dark);
    w.position.set(Math.cos(a) * 2.9, Math.sin(a) * 2.9, C.BULKHEAD_Z + 0.06);
    root.add(w);
  }

  /* ---- カッター駆動モーター（隔壁の後ろに環状に並ぶ）---- */
  const motorGeo = axialCyl(0.27, 0.27, 0.95, 12);
  const finGeo = axialTorus(0.30, 0.038, 6, 14);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.35;
    const x = Math.cos(a) * 2.35, y = Math.sin(a) * 2.35;
    const m = new THREE.Mesh(motorGeo, M.dark);
    m.position.set(x, y, C.BULKHEAD_Z - 1.05);
    root.add(m);
    for (let k = 0; k < 5; k++) {
      const f = new THREE.Mesh(finGeo, M.gray);
      f.position.set(x, y, C.BULKHEAD_Z - 1.45 + k * 0.19);
      root.add(f);
    }
    const gearbox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.42), M.orange);
    gearbox.position.set(x, y, C.BULKHEAD_Z - 0.35);
    gearbox.rotation.z = a;
    root.add(gearbox);
  }
  // 主軸受
  const mainBearing = new THREE.Mesh(shell(1.55, 0.7, -96, 202, 36), M.dark);
  mainBearing.position.z = C.BULKHEAD_Z - 0.4;
  root.add(mainBearing);
  const mainShaft = new THREE.Mesh(axialCyl(0.85, 0.85, 1.9, 24), M.dark);
  mainShaft.position.z = C.BULKHEAD_Z + 0.6;
  root.add(mainShaft);

  /* ---- カッターヘッド ---- */
  const head = buildCutterhead(M);
  head.group.position.z = C.HEAD_Z;
  root.add(head.group);

  /* ---- スクリューコンベア ---- */
  const screw = buildScrew(M);
  root.add(screw.group);

  /* ---- ベルトコンベア ---- */
  const belt = buildBelt(M);
  root.add(belt.group);

  /* ---- 推進ジャッキ ---- */
  const jacks = buildJacks(M);
  root.add(jacks.group);

  /* ---- エレクター ---- */
  const erector = buildErector(M);
  root.add(erector.group);

  /* ---- テールシール部（後胴）---- */
  const tailSkin = new THREE.Mesh(shell(C.SHIELD_R - 0.02, 1.2, -95, 200, 48), M.gray);
  tailSkin.material = M.gray.clone();
  tailSkin.material.side = THREE.DoubleSide;
  tailSkin.position.z = 0.6;
  root.add(tailSkin);
  const tailBrush = new THREE.Mesh(axialTorus(C.SHIELD_R - 0.12, 0.16, 8, 48), M.black);
  tailBrush.position.z = 0.03;
  root.add(tailBrush);

  /* ---- 歩廊（グレーチング）---- */
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 8.6), M.grating);
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(0, -3.05, 4.6);
  root.add(walk);
  // 手すり
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(tube([
      [s * 1.3, -1.7, 0.5], [s * 1.3, -1.72, 4.6], [s * 1.3, -1.7, 8.8],
    ], 0.055, 6), M.yellow);
    root.add(rail);
    const rail2 = new THREE.Mesh(tube([
      [s * 1.3, -2.2, 0.5], [s * 1.3, -2.22, 4.6], [s * 1.3, -2.2, 8.8],
    ], 0.045, 6), M.yellow);
    root.add(rail2);
    for (let z = 0.6; z < 8.8; z += 1.6) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.1, 0.09), M.yellow);
      post.position.set(s * 1.3, -2.25, z);
      root.add(post);
    }
  }

  /* ---- 油圧ユニット・電気盤（秘密基地感）---- */
  const boxes = [
    [2.55, -1.35, 3.3, 1.2, 1.5, 1.9, M.orange],
    [-2.55, -1.4, 4.6, 1.1, 1.4, 1.7, M.gray],
    [2.5, 0.9, 5.6, 0.9, 1.2, 1.4, M.yellow],
    [-2.4, 0.7, 2.6, 0.85, 1.1, 1.3, M.orange],
    [2.9, -2.0, 7.4, 0.9, 1.0, 1.1, M.gray],
  ];
  for (const [x, y, z, w, h, d, mat] of boxes) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y, z);
    b.rotation.z = Math.atan2(y, x) - Math.PI / 2;
    root.add(b);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.1, d * 0.7), M.dark);
    cap.position.set(x * 0.86, y * 0.86 + 0.02, z);
    root.add(cap);
  }

  /* ---- 操作室（小さな運転席）---- */
  const cab = new THREE.Group();
  cab.position.set(2.35, 0.2, 1.9);
  cab.rotation.z = -0.6;
  const cabBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 1.7), M.yellow);
  cab.add(cabBody);
  const cabScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), M.screen);
  cabScreen.position.set(-0.52, 0.25, 0.2);
  cabScreen.rotation.y = -Math.PI / 2;
  cab.add(cabScreen);
  root.add(cab);
  // ヘルメット（ピンク）
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10, 0, 6.3, 0, 1.5), M.pink);
  helm.position.set(1.42, -1.45, 2.5);
  helm.rotation.x = 0.3;
  root.add(helm);
  const brim = new THREE.Mesh(axialTorus(0.19, 0.035, 6, 14), M.pink);
  brim.position.set(1.42, -1.55, 2.5);
  brim.rotation.x = Math.PI / 2;
  root.add(brim);

  /* ---- ケーブル・ホース（垂れ下がりで近景の情報量を作る）---- */
  const hoseCols = [0x2c2f33, 0x8b2f2f, 0x27506e, 0xc7a233];
  for (let i = 0; i < 7; i++) {
    const a = -0.5 + i * 0.42;
    const r = C.SHIELD_R - 0.5;
    const m = new THREE.MeshStandardMaterial({ color: hoseCols[i % 4], roughness: 0.8, metalness: 0.1 });
    const t = new THREE.Mesh(tube([
      [Math.cos(a) * r, Math.sin(a) * r, 8.6],
      [Math.cos(a) * (r - 0.25), Math.sin(a) * (r - 0.25) - 0.35, 6.0],
      [Math.cos(a) * (r - 0.1), Math.sin(a) * (r - 0.1) - 0.2, 3.2],
      [Math.cos(a) * (r - 0.3), Math.sin(a) * (r - 0.3) - 0.45, 0.6],
      [Math.cos(a) * (r - 0.3), Math.sin(a) * (r - 0.3) - 0.5, -2.5],
    ], 0.06 + (i % 3) * 0.015, 6), m);
    root.add(t);
  }

  /* ---- 作業灯 ---- */
  const lamps = [];
  const lampSpots = [
    [-2.6, 3.3, 9.6, 0.35], [2.6, 3.3, 9.6, -0.35],
    [-3.3, 1.4, 6.2, 0.5], [3.3, 1.4, 6.2, -0.5],
    [-2.2, 3.5, 2.2, 0.3], [2.2, 3.5, 2.2, -0.3],
    [0, -2.0, 0.9, 0],
  ];
  for (const [x, y, z, yaw] of lampSpots) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    const housing = new THREE.Mesh(axialCyl(0.19, 0.24, 0.3, 14), M.dark);
    grp.add(housing);
    const lens = new THREE.Mesh(axialCyl(0.185, 0.185, 0.06, 14), M.lampOn);
    lens.position.z = 0.16;
    grp.add(lens);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), M.gray);
    bracket.position.y = 0.25;
    grp.add(bracket);
    const sp = new THREE.Sprite(M.glow.clone());
    sp.scale.set(2.0, 2.0, 1);
    sp.position.z = 0.24;
    grp.add(sp);
    grp.rotation.y = yaw;
    root.add(grp);
    lamps.push({ grp, sprite: sp, lens });
  }

  /* ---- 回転灯（安全表示）---- */
  const beaconGrp = new THREE.Group();
  beaconGrp.position.set(0, 3.55, 3.0);
  const bBase = new THREE.Mesh(axialCyl(0.16, 0.18, 0.12, 12), M.dark);
  bBase.rotation.x = Math.PI / 2;
  beaconGrp.add(bBase);
  const bDome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10, 0, 6.3, 0, 1.6), M.beacon);
  bDome.position.y = 0.06;
  beaconGrp.add(bDome);
  const beaconBeam = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 2.6, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffa23a, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
  beaconBeam.rotation.z = Math.PI / 2;
  beaconBeam.position.set(-1.3, 0.06, 0);
  const beaconSpin = new THREE.Group();
  beaconSpin.add(beaconBeam);
  beaconGrp.add(beaconSpin);
  root.add(beaconGrp);

  /* ---- ズリ鋼車（後方の運搬台車）---- */
  const car = new THREE.Group();
  car.position.set(0, -3.05, -20.6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.1, 2.6), M.orange);
  car.add(body);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 2.3), M.black);
  inner.position.y = 0.22;
  car.add(inner);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 14), M.dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 1.0, -0.68, sz * 0.9);
    car.add(wheel);
  }
  root.add(car);
  // レール
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 40), M.steel);
    rail.position.set(sx * 1.0, -3.85, -14);
    root.add(rail);
  }

  /* ---- セグメント供給台（下部のクレードル）---- */
  const feeder = new THREE.Group();
  feeder.position.set(0, -3.15, 2.4);
  const cradle = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.28, 1.9), M.gray);
  feeder.add(cradle);
  for (const sx of [-1, 1]) {
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 1.7), M.yellow);
    arm2.position.set(sx * 1.25, 0.35, 0);
    arm2.rotation.z = sx * 0.25;
    feeder.add(arm2);
  }
  root.add(feeder);

  return {
    root, head, screw, belt, jacks, erector, lamps,
    beaconSpin, feeder,
    cutterSpin: 0,
  };
}
