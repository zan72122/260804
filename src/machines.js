/**
 * machines.js — taphole drill（開孔機）と mud gun（閉塞機）。
 * どちらも「旋回する土台 → ブーム → 前後にスライドする工具」という
 * 剛体の階層 + 単純な transform だけで作る（物理は使わない）。
 */
import * as THREE from 'three';
import { roundedBox } from './geom.js';
import { TAPHOLE, DRILL_PIVOT, MUDGUN_PIVOT } from './world.js';

const YELLOW = 0xf4bd18;
const ORANGE = 0xe2671c;
const STEEL = 0x9aa2a8;
const DARK = 0x3c3b3a;
const CHROME = 0xcfd6db;

function aim(pivot) {
  const dx = TAPHOLE.x - pivot.x;
  const dz = TAPHOLE.z - pivot.z;
  return { angle: Math.atan2(dx, dz), reach: Math.hypot(dx, dz) };
}

function beacon(parent, x, y, z, color = 0xff9a1f) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.07, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: .6, metalness: .5 }));
  g.add(base);
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: .95 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 7), mat);
  dome.position.y = 0.08; g.add(dome);
  parent.add(g);
  return { mesh: dome, mat };
}

/* ================================================================== */
/* taphole drill                                                       */
/* ================================================================== */
export function buildDrill(scene, M, quality) {
  const LOW = quality === 'low';
  const { angle, reach } = aim(DRILL_PIVOT);
  const root = new THREE.Group();
  root.position.copy(DRILL_PIVOT);
  scene.add(root);

  const paint = M.metal(YELLOW, { metalness: 0.42, roughness: 0.46, repeat: [2, 2] });
  const paintDark = M.metal(ORANGE, { metalness: 0.45, roughness: 0.44, repeat: [2, 2] });
  const steel = M.metal(STEEL, { metalness: 0.92, roughness: 0.33, repeat: [2, 2] });
  const dark = M.metal(DARK, { metalness: 0.6, roughness: 0.62, repeat: [2, 2] });
  const chrome = M.metal(CHROME, { metalness: 1.0, roughness: 0.12, repeat: [1, 4] });

  const add = (parent, geo, mat, x, y, z, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true;
    parent.add(m); return m;
  };

  /* --- 台車 --- */
  const carriage = new THREE.Group();
  root.add(carriage);
  add(carriage, roundedBox(2.1, 0.85, 2.6, 0.12), paint, 0, 0.62, -0.35);
  add(carriage, roundedBox(2.3, 0.28, 2.9, 0.08), dark, 0, 0.24, -0.35);
  for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) {
    const w = add(carriage, new THREE.CylinderGeometry(0.30, 0.30, 0.30, LOW ? 8 : 12), dark, sx * 1.06, 0.30, -0.35 + sz * 0.95);
    w.rotation.z = Math.PI / 2;
  }
  // 遠隔操作をあらわす制御ボックス＋アンテナ
  add(carriage, roundedBox(0.62, 0.5, 0.42, 0.08), paintDark, 0.68, 1.28, -1.05);
  const ant = add(carriage, new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), steel, 0.68, 1.9, -1.05, false);
  add(carriage, new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x6ef0ff, toneMapped: false }), 0.68, 2.3, -1.05, false);

  /* --- 旋回部（root ごと回す） --- */
  const column = add(root, new THREE.CylinderGeometry(0.55, 0.68, 1.55, LOW ? 10 : 16), paint, 0, 1.35, 0);
  add(root, new THREE.CylinderGeometry(0.72, 0.72, 0.18, LOW ? 10 : 16), dark, 0, 1.02, 0, false);

  /* --- ブーム --- */
  // ビットは advance=1 で孔の奥 1.35 まで入る（＝閉塞材をほぼ貫く）
  // toolLen = スライド原点からビット先端までの長さ（下のロッド長と一致させること）
  const slideMax = 2.50, toolLen = 2.53, penetration = 1.35;
  const boomEnd = reach + penetration - slideMax - toolLen;
  const boomStart = 0.45;
  const boomLen = boomEnd - boomStart;

  const boom = new THREE.Group();
  boom.position.set(0, TAPHOLE.y, 0);
  root.add(boom);
  add(boom, roundedBox(0.52, 0.52, boomLen, 0.09), paint, 0, 0, boomStart + boomLen / 2);
  add(boom, roundedBox(0.66, 0.66, 0.3, 0.08), paintDark, 0, 0, boomStart + 0.1);
  // 上のガイドレール
  add(boom, roundedBox(0.14, 0.14, boomLen + 1.6, 0.04), steel, 0.20, 0.30, boomStart + boomLen / 2 + 0.6, false);
  add(boom, roundedBox(0.14, 0.14, boomLen + 1.6, 0.04), steel, -0.20, 0.30, boomStart + boomLen / 2 + 0.6, false);
  beacon(boom, 0, 0.42, boomStart + 0.15);
  const bcn = beacon(root, 0.0, 2.05, -0.05);

  /* --- スライドする削岩ヘッド --- */
  const slide = new THREE.Group();
  slide.position.set(0, 0, boomEnd);
  boom.add(slide);
  add(slide, roundedBox(0.74, 0.66, 0.92, 0.10), paintDark, 0, 0, 0.30);
  add(slide, roundedBox(0.84, 0.20, 0.30, 0.06), dark, 0, 0.36, 0.28, false);
  // 油圧シリンダ（左右）
  for (const sx of [-1, 1]) {
    const cyl = add(boom, new THREE.CylinderGeometry(0.115, 0.115, 1.15, 8), dark, sx * 0.42, -0.16, boomEnd - 0.62);
    cyl.rotation.x = Math.PI / 2;
    const rod = add(slide, new THREE.CylinderGeometry(0.052, 0.052, 1.5, 6), chrome, sx * 0.42, -0.16, -0.72, false);
    rod.rotation.x = Math.PI / 2;
  }

  /* --- 回転するロッドとビット（ぐるるるる） --- */
  const spin = new THREE.Group();
  spin.position.set(0, 0, 0.72);
  slide.add(spin);
  const ROD = 1.60;
  const rod = add(spin, new THREE.CylinderGeometry(0.078, 0.078, ROD, LOW ? 8 : 12), steel, 0, 0, ROD / 2);
  rod.rotation.x = Math.PI / 2;
  // らせん状のフルート（回転が目で分かる）
  for (let i = 0; i < 3; i++) {
    const f = add(spin, roundedBox(0.05, 0.05, ROD - 0.06, 0.02), chrome, 0, 0, ROD / 2, false);
    f.rotation.z = (i / 3) * Math.PI * 2;
    f.position.x = Math.cos(f.rotation.z) * 0.095;
    f.position.y = Math.sin(f.rotation.z) * 0.095;
  }
  for (let i = 0; i < 5; i++) {
    add(spin, new THREE.TorusGeometry(0.10, 0.021, 4, 10), chrome, 0, 0, 0.18 + i * 0.30, false);
  }
  // 先端の十字ビット
  const bitG = new THREE.Group();
  bitG.position.set(0, 0, ROD + 0.10);
  spin.add(bitG);
  const bitBody = add(bitG, new THREE.CylinderGeometry(0.125, 0.105, 0.26, LOW ? 8 : 12), chrome, 0, 0, 0.0, false);
  bitBody.rotation.x = Math.PI / 2;
  for (let i = 0; i < 2; i++) {
    const b = add(bitG, roundedBox(0.28, 0.065, 0.10, 0.02), chrome, 0, 0, 0.12, false);
    b.rotation.z = i * Math.PI / 2;
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    add(bitG, new THREE.SphereGeometry(0.034, 6, 5), new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: .25, metalness: .8 }),
      Math.cos(a) * 0.098, Math.sin(a) * 0.098, 0.155, false);
  }

  root.rotation.y = angle;
  root.traverse(o => { if (o.isMesh) o.frustumCulled = true; });

  const tipLocal = new THREE.Vector3();
  const api = {
    root, spin, slide, boom, reach, angleEngaged: angle, angleParked: angle - 1.75,
    slideMax, penetration, boreLen: 1.50, bcn,
    /** advance=0.46 でビット先端が出銑口の面に触れる */
    contactAdvance: (slideMax + toolLen - penetration) / slideMax * 0 + (reach - (boomEnd + toolLen)) / slideMax,
    setSwing(t) { root.rotation.y = THREE.MathUtils.lerp(api.angleParked, api.angleEngaged, t); },
    setAdvance(t) { slide.position.z = boomEnd + slideMax * THREE.MathUtils.clamp(t, 0, 1); },
    setSpin(dTheta) { spin.rotation.z += dTheta; },
    shake(a) {
      slide.position.y = (Math.random() - 0.5) * a;
      slide.position.x = (Math.random() - 0.5) * a;
      boom.rotation.z = (Math.random() - 0.5) * a * 0.25;
    },
    tipWorld(out = new THREE.Vector3()) { return bitG.getWorldPosition(out); },
    update(t) { bcn.mat.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 6.0)); },
  };
  api.setSwing(0); api.setAdvance(0);
  return api;
}

/* ================================================================== */
/* mud gun                                                             */
/* ================================================================== */
export function buildMudGun(scene, M, quality) {
  const LOW = quality === 'low';
  const { angle, reach } = aim(MUDGUN_PIVOT);
  const root = new THREE.Group();
  root.position.copy(MUDGUN_PIVOT);
  scene.add(root);

  const paint = M.metal(0xd8452a, { metalness: 0.45, roughness: 0.45, repeat: [2, 2] });
  const paint2 = M.metal(0x2b2f36, { metalness: 0.6, roughness: 0.55, repeat: [2, 2] });
  const steel = M.metal(STEEL, { metalness: 0.92, roughness: 0.33, repeat: [2, 2] });
  const dark = M.metal(DARK, { metalness: 0.6, roughness: 0.62, repeat: [2, 2] });
  const chrome = M.metal(CHROME, { metalness: 1.0, roughness: 0.11, repeat: [1, 4] });
  const yellow = M.metal(YELLOW, { metalness: 0.4, roughness: 0.5, repeat: [2, 2] });

  const add = (parent, geo, mat, x, y, z, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true;
    parent.add(m); return m;
  };

  /* --- でかい土台（重量感） --- */
  add(root, roundedBox(3.2, 1.15, 3.4, 0.14), paint2, 0, 0.62, -0.55);
  add(root, roundedBox(3.5, 0.3, 3.7, 0.08), dark, 0, 0.2, -0.55);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = add(root, new THREE.CylinderGeometry(0.34, 0.46, 0.5, LOW ? 8 : 12), dark, sx * 1.5, 0.25, -0.55 + sz * 1.5);
  }
  // カウンターウェイト
  add(root, roundedBox(2.0, 1.5, 1.0, 0.1), dark, 0, 1.75, -1.85);
  for (let i = 0; i < 4; i++) add(root, roundedBox(2.05, 0.07, 1.05, 0.02), yellow, 0, 1.15 + i * 0.36, -1.85, false);

  /* --- 旋回タレット --- */
  add(root, new THREE.CylinderGeometry(0.95, 1.15, 1.5, LOW ? 12 : 20), paint, 0, 1.45, 0);
  add(root, new THREE.CylinderGeometry(1.22, 1.22, 0.22, LOW ? 12 : 20), dark, 0, 1.05, 0, false);
  const bcn = beacon(root, 0.0, 2.35, -0.5);

  /* --- ブーム --- */
  const slideMax = 1.20;
  const barrelLen = 2.60, nozzleLen = 0.85;
  const toolLen = barrelLen + nozzleLen;
  const boomEnd = reach - 0.02 - slideMax - toolLen;
  const boomStart = 0.55;

  const boom = new THREE.Group();
  boom.position.set(0, TAPHOLE.y, 0);
  root.add(boom);
  add(boom, roundedBox(0.86, 0.80, Math.max(0.5, boomEnd - boomStart), 0.10), paint, 0, 0, boomStart + (boomEnd - boomStart) / 2);
  add(boom, roundedBox(1.02, 0.98, 0.34, 0.08), paint2, 0, 0, boomStart);
  // 上下の大きな油圧シリンダ
  for (const sx of [-1, 1]) {
    const c = add(boom, new THREE.CylinderGeometry(0.19, 0.19, 1.05, 8), paint2, sx * 0.62, -0.30, boomEnd - 0.45);
    c.rotation.x = Math.PI / 2;
  }
  // 補強リブ
  for (let i = 0; i < 3; i++) add(boom, roundedBox(1.0, 0.1, 0.12, 0.03), yellow, 0, 0.44, boomStart + 0.4 + i * 0.42, false);

  /* --- スライドする砲身（クレイシリンダ） --- */
  const slide = new THREE.Group();
  slide.position.set(0, 0, boomEnd);
  boom.add(slide);
  for (const sx of [-1, 1]) {
    const rod = add(slide, new THREE.CylinderGeometry(0.085, 0.085, 1.45, 6), chrome, sx * 0.62, -0.30, -0.66, false);
    rod.rotation.x = Math.PI / 2;
  }
  const barrel = add(slide, new THREE.CylinderGeometry(0.52, 0.56, barrelLen, LOW ? 12 : 20), paint, 0, 0, barrelLen / 2);
  barrel.rotation.x = Math.PI / 2;
  // 砲身のバンド
  for (let i = 0; i < 4; i++) {
    const b = add(slide, new THREE.TorusGeometry(0.545, 0.055, 5, LOW ? 12 : 18), dark, 0, 0, 0.35 + i * 0.62, false);
  }
  // ノズル（円錐）— 出銑口に密着する
  const nozzle = add(slide, new THREE.CylinderGeometry(0.30, 0.53, nozzleLen, LOW ? 12 : 20), steel, 0, 0, barrelLen + nozzleLen / 2);
  nozzle.rotation.x = Math.PI / 2;
  const nozzleRing = add(slide, new THREE.TorusGeometry(0.30, 0.06, 5, LOW ? 12 : 18), chrome, 0, 0, barrelLen + nozzleLen - 0.02, false);

  /* --- 後方の押し込みラム（ぐぐぐっ） --- */
  const ramBody = add(slide, new THREE.CylinderGeometry(0.40, 0.40, 1.5, LOW ? 10 : 16), paint2, 0, 0, -0.78);
  ramBody.rotation.x = Math.PI / 2;
  const ramCap = add(slide, new THREE.CylinderGeometry(0.46, 0.46, 0.2, LOW ? 10 : 16), dark, 0, 0, -1.5, false);
  ramCap.rotation.x = Math.PI / 2;
  const ramRod = new THREE.Group();
  slide.add(ramRod);
  const rr = add(ramRod, new THREE.CylinderGeometry(0.15, 0.15, 1.35, 8), chrome, 0, 0, -2.1, false);
  rr.rotation.x = Math.PI / 2;
  const rrHead = add(ramRod, roundedBox(0.62, 0.62, 0.3, 0.06), yellow, 0, 0, -2.78, false);
  // 油圧ホース（垂れ下がり）
  {
    const hose = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.5, 0.1, -1.2), new THREE.Vector3(0.85, -0.55, -0.4),
      new THREE.Vector3(0.8, -0.35, 0.7), new THREE.Vector3(0.62, 0.05, 1.5),
    ]);
    const hm = new THREE.Mesh(new THREE.TubeGeometry(hose, LOW ? 8 : 16, 0.06, 5, false), paint2);
    slide.add(hm);
    const hose2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.5, 0.1, -1.2), new THREE.Vector3(-0.85, -0.6, -0.3),
      new THREE.Vector3(-0.8, -0.3, 0.8), new THREE.Vector3(-0.62, 0.05, 1.6),
    ]);
    slide.add(new THREE.Mesh(new THREE.TubeGeometry(hose2, LOW ? 8 : 16, 0.06, 5, false), paint2));
  }

  root.rotation.y = angle;

  const api = {
    root, boom, slide, nozzle, reach,
    angleEngaged: angle, angleParked: angle + 1.90, slideMax, bcn,
    setSwing(t) { root.rotation.y = THREE.MathUtils.lerp(api.angleParked, api.angleEngaged, t); },
    setAdvance(t) { slide.position.z = boomEnd + slideMax * THREE.MathUtils.clamp(t, 0, 1); },
    /** 0..1 でラムが前進、砲身が少し反動でふるえる */
    setPush(t) {
      const p = THREE.MathUtils.clamp(t, 0, 1);
      ramRod.position.z = p * 1.05;
      barrel.scale.set(1 + p * 0.012, 1, 1 + p * 0.012);
    },
    shake(a) {
      slide.position.y = (Math.random() - 0.5) * a;
      boom.rotation.z = (Math.random() - 0.5) * a * 0.3;
    },
    nozzleWorld(out = new THREE.Vector3()) { return nozzleRing.getWorldPosition(out); },
    update(t) { bcn.mat.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(t * 4.4 + 1.2)); },
  };
  api.setSwing(0); api.setAdvance(0); api.setPush(0);
  return api;
}
