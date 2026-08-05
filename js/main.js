// かげえげきじょう — 影絵劇スタッフ3Dゲーム
// 実ジオメトリ + 透視投影 + レンダーターゲット投影による WebGL 3D
import * as THREE from 'three';
import * as TX from './textures.js';
import { initAudio, sfx, startMusic, stopMusic } from './audio.js';
import {
  puppetSpec, buildPuppet, addCelloToPuppet, buildBackdrop,
  setCardMaterials, projectables, swapToProj, swapToMain, unregisterProj,
  registerProj, CELLO_COLORS, SHEET_H,
} from './shapes.js';

// ---------------- 基本セットアップ ----------------
const app = document.getElementById('app');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('err').style.display = 'flex';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0906);
scene.fog = new THREE.FogExp2(0x0d0906, 0.075);

const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.05, 30);

// ---------------- 寸法定数（実世界スケール・メートル） ----------------
const SCREEN_W = 1.5, SCREEN_H = 1.125;
const SCREEN_C = new THREE.Vector3(0, 1.15, 0);
const PUPPET_Z = -0.40;                    // 人形の定位置（幕の裏）
const PUPPET_POS = new THREE.Vector3(-0.02, 1.12, PUPPET_Z);
const LAMP_MIN = -2.2, LAMP_MAX = -0.58;   // ライト移動範囲
const RAIL_Y = 3.02;                       // 背景吊りレール
const PARK_Y = 2.36, ACTIVE_Y = 1.15;      // 背景カードの待機/上演位置
const SLOT_Z = { mori: -0.10, oshiro: -0.16, umi: -0.22 };
const TABLE_P = new THREE.Vector3(0.95, 0, -1.15);
const TABLE_H = 0.73;

// ---------------- 材質 ----------------
const texFloor = TX.floorWood();
const texTable = TX.tableWood();
const texCloth = TX.clothScreen();
const texClothOv = TX.clothOverlay();
const texWall = TX.wallPlaster();
const texCard = TX.cardboard();
const texDrape = TX.darkDrape();
const texRug = TX.rugTex();

const matFloor = new THREE.MeshStandardMaterial({ map: texFloor, roughness: 0.9, metalness: 0 });
const matWall = new THREE.MeshStandardMaterial({ map: texWall, roughness: 0.95 });
const matWood = new THREE.MeshStandardMaterial({ color: 0x9a6c3f, roughness: 0.75 });
const matWoodDark = new THREE.MeshStandardMaterial({ color: 0x5d3f24, roughness: 0.8 });
const matTable = new THREE.MeshStandardMaterial({ map: texTable, roughness: 0.8 });
const matCard = new THREE.MeshStandardMaterial({ map: texCard, color: 0xbdb2a6, roughness: 0.88, side: THREE.DoubleSide });
const matDrape = new THREE.MeshStandardMaterial({ map: texDrape, roughness: 0.95, side: THREE.DoubleSide });
const matMetal = new THREE.MeshStandardMaterial({ color: 0x54504c, roughness: 0.45, metalness: 0.85 });
const matMetalDark = new THREE.MeshStandardMaterial({ color: 0x2e2b28, roughness: 0.6, metalness: 0.7 });
setCardMaterials(matCard, null);

// ---------------- 部屋 ----------------
const ROOM = { x: 3.2, z: 3.4, h: 3.2 };
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const mkWall = (w, h, px, py, pz, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matWall);
    m.position.set(px, py, pz); m.rotation.y = ry; m.receiveShadow = true;
    scene.add(m);
  };
  mkWall(ROOM.x * 2, ROOM.h, 0, ROOM.h / 2, -ROOM.z, 0);
  mkWall(ROOM.x * 2, ROOM.h, 0, ROOM.h / 2, ROOM.z, Math.PI);
  mkWall(ROOM.z * 2, ROOM.h, -ROOM.x, ROOM.h / 2, 0, Math.PI / 2);
  mkWall(ROOM.z * 2, ROOM.h, ROOM.x, ROOM.h / 2, 0, -Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2),
    new THREE.MeshStandardMaterial({ color: 0x241c15, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h;
  scene.add(ceil);
}

// 舞台裏の壁ポスター（遠景の読み）
function poster(px, py, draw) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 170;
  const x = c.getContext('2d');
  draw(x);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.02), matWoodDark);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.54),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  pic.position.z = 0.011;
  g.add(frame, pic);
  g.position.set(px, py, -ROOM.z + 0.02);
  scene.add(g);
}
poster(-1.1, 1.85, (x) => {
  x.fillStyle = '#1c2547'; x.fillRect(0, 0, 128, 170);
  x.fillStyle = '#f5e6b8'; x.beginPath(); x.arc(80, 55, 30, 0, 7); x.fill();
  x.fillStyle = '#1c2547'; x.beginPath(); x.arc(92, 48, 26, 0, 7); x.fill();
  x.fillStyle = '#fff';
  for (let i = 0; i < 12; i++) x.fillRect(Math.random() * 128, Math.random() * 170, 2, 2);
  x.fillStyle = '#e8d9a8'; x.font = 'bold 20px sans-serif'; x.fillText('かげえ', 30, 150);
});
poster(2.0, 1.75, (x) => {
  x.fillStyle = '#5c2e2e'; x.fillRect(0, 0, 128, 170);
  x.fillStyle = '#111'; x.beginPath();
  x.moveTo(20, 130); x.quadraticCurveTo(64, 20, 108, 130); x.fill();
  x.fillStyle = '#f0c96a'; x.beginPath(); x.arc(64, 60, 14, 0, 7); x.fill();
  x.fillStyle = '#e8d9a8'; x.font = 'bold 18px sans-serif'; x.fillText('こうえん', 24, 155);
});

// ---------------- 劇場（額縁・幕・スカート・脇マスク） ----------------
{
  const postG = new THREE.BoxGeometry(0.09, 2.1, 0.09);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(postG, matWoodDark);
    post.position.set(s * 0.83, 1.05, 0);
    post.castShadow = true; post.receiveShadow = true;
    scene.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.1, 0.09), matWoodDark);
  beam.position.set(0, 2.05, 0); beam.castShadow = true;
  scene.add(beam);
  // 上飾り（暗幕バランス）
  const valance = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.32), matDrape);
  valance.position.set(0, 1.87, 0.048);
  scene.add(valance);
  // 幕下スカート（客席から仕込みを隠す）
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.62), matDrape);
  skirt.position.set(0, 0.31, 0.048);
  scene.add(skirt);
  // 脇マスク幕
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 2.1), matDrape);
    wing.position.set(s * 1.14, 1.05, 0.03);
    scene.add(wing);
  }
  // 背景レール（天井近くの吊りバー）
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.0, 10), matMetal);
  rail.rotation.z = Math.PI / 2; rail.position.set(0, RAIL_Y, -0.16);
  scene.add(rail);
  for (const s of [-1, 1]) {
    const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, ROOM.h - RAIL_Y, 8), matMetal);
    drop.position.set(s * 0.98, (RAIL_Y + ROOM.h) / 2, -0.16);
    scene.add(drop);
  }
}

// 白い幕（表・裏、投影面）
const rt = new THREE.WebGLRenderTarget(1024, 768);
const rtCam = new THREE.PerspectiveCamera(40, SCREEN_W / SCREEN_H, 0.04, 8);
rtCam.layers.set(1);

const clothMatF = new THREE.MeshStandardMaterial({ map: texCloth, roughness: 0.92 });
const clothMatB = clothMatF.clone();
const screenGeo = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H);
const frontCloth = new THREE.Mesh(screenGeo, clothMatF);
frontCloth.position.copy(SCREEN_C); frontCloth.position.z = 0.004;
frontCloth.receiveShadow = true;
scene.add(frontCloth);
const backCloth = new THREE.Mesh(screenGeo, clothMatB);
backCloth.position.copy(SCREEN_C); backCloth.position.z = -0.004;
backCloth.rotation.y = Math.PI;
scene.add(backCloth);

// 投影テクスチャ面（フェードで現れる）
const rtMatF = new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, opacity: 0 });
rtMatF.color.setRGB(1.18, 1.08, 0.92);   // ランプの暖かさを足す
const rtFront = new THREE.Mesh(screenGeo, rtMatF);
rtFront.position.copy(SCREEN_C); rtFront.position.z = 0.006;
scene.add(rtFront);
const rtMatB = new THREE.MeshBasicMaterial({ map: rt.texture, transparent: true, opacity: 0 });
rtMatB.color.setRGB(1.12, 1.04, 0.92);
const rtBack = new THREE.Mesh(screenGeo, rtMatB);
rtBack.position.copy(SCREEN_C); rtBack.position.z = -0.006;
rtBack.rotation.y = Math.PI;
scene.add(rtBack);

// 布の織り目・周辺減光（乗算オーバーレイ）
for (const [z, ry] of [[0.007, 0], [-0.007, Math.PI]]) {
  const ov = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({
    map: texClothOv, blending: THREE.MultiplyBlending, transparent: true, depthWrite: false,
  }));
  ov.position.copy(SCREEN_C); ov.position.z = z; ov.rotation.y = ry;
  ov.renderOrder = 6;
  scene.add(ov);
}

// ---------------- 人形ホルダー（幕裏のスタンド） ----------------
const holder = new THREE.Group();
{
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.03, 20), matMetalDark);
  base.position.y = 0.015; base.castShadow = true;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.76, 10), matMetal);
  pole.position.y = 0.41; pole.castShadow = true;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.04), matMetalDark);
  clip.position.y = 0.79;
  holder.add(base, pole, clip);
  holder.position.set(PUPPET_POS.x, 0, PUPPET_Z);
  scene.add(holder);
}

// ---------------- 作業机と道具 ----------------
const bulbRefs = [];   // 電球マテリアル参照（暗転で減光）
const tableG = new THREE.Group();
{
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.035, 0.68), matTable);
  top.position.y = TABLE_H - 0.018;
  top.castShadow = true; top.receiveShadow = true;
  tableG.add(top);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, TABLE_H - 0.035, 0.05), matWoodDark);
    leg.position.set(sx * 0.51, (TABLE_H - 0.035) / 2, sz * 0.28);
    leg.castShadow = true;
    tableG.add(leg);
  }
  // 道具（はさみ・のり・テープ・切れ端）
  const sc = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.004, 0.014), matMetal);
  const blade2 = blade.clone(); blade2.rotation.y = 0.5;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xc84848, roughness: 0.5 }));
  ring.position.set(-0.07, 0, 0.008); ring.rotation.x = Math.PI / 2;
  const ring2 = ring.clone(); ring2.position.z = -0.012;
  sc.add(blade, blade2, ring, ring2);
  sc.position.set(-0.42, TABLE_H + 0.006, -0.2); sc.rotation.y = 2.6;
  tableG.add(sc);
  const glue = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.07, 14),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.6 }));
  glue.position.set(-0.48, TABLE_H + 0.035, 0.12); glue.castShadow = true;
  tableG.add(glue);
  const tape = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.012, 10, 20),
    new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.7 }));
  tape.position.set(0.47, TABLE_H + 0.014, -0.22); tape.rotation.x = Math.PI / 2;
  tableG.add(tape);
  for (let i = 0; i < 5; i++) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.05 + Math.random() * 0.04, 0.04),
      new THREE.MeshStandardMaterial({
        color: [0xff77b0, 0xffd83a, 0x58b7ff, 0x353028, 0xff9a3c][i],
        side: THREE.DoubleSide, roughness: 0.6, transparent: i !== 3, opacity: i === 3 ? 1 : 0.6,
      }));
    scr.rotation.x = -Math.PI / 2; scr.rotation.z = Math.random() * 3;
    scr.position.set(-0.1 + Math.random() * 0.5, TABLE_H + 0.002 + i * 0.0008, 0.18 + Math.random() * 0.12);
    tableG.add(scr);
  }
  tableG.position.copy(TABLE_P);
  scene.add(tableG);

  // 机上の作業ペンダントライト
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, ROOM.h - 2.5, 6), matMetalDark);
  cord.position.set(TABLE_P.x, (ROOM.h + 2.5) / 2, TABLE_P.z);
  scene.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x3c5b3f, roughness: 0.5, side: THREE.DoubleSide }));
  shade.position.set(TABLE_P.x, 2.48, TABLE_P.z);
  scene.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffdf9e, emissiveIntensity: 2.2 }));
  bulb.position.set(TABLE_P.x, 2.44, TABLE_P.z);
  scene.add(bulb);
  bulbRefs.push(bulb.material);
}

// ---------------- 客席側 ----------------
{
  const rug = new THREE.Mesh(new THREE.CircleGeometry(0.95, 36),
    new THREE.MeshStandardMaterial({ map: texRug, roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.004, 1.75);
  rug.receiveShadow = true;
  scene.add(rug);
  const cushCols = [0xb85a64, 0xd8a054, 0x6a7aa8, 0x67976f];
  [[-0.5, 1.45], [0.42, 1.5], [-0.15, 2.0], [0.62, 2.1]].forEach(([cx, cz], i) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.09, 18),
      new THREE.MeshStandardMaterial({ color: cushCols[i], roughness: 0.95 }));
    c.position.set(cx, 0.045, cz); c.castShadow = true; c.receiveShadow = true;
    scene.add(c);
  });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.26, 0.32), matWood);
  bench.position.set(0.1, 0.13, 2.65); bench.castShadow = true; bench.receiveShadow = true;
  scene.add(bench);
  // 客席ペンダント × 2
  for (const sx of [-1.15, 1.15]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, ROOM.h - 2.52, 6), matMetalDark);
    cord.position.set(sx, (ROOM.h + 2.52) / 2, 1.7);
    scene.add(cord);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.1, 18, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x7a4a35, roughness: 0.5, side: THREE.DoubleSide }));
    shade.position.set(sx, 2.5, 1.7);
    scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffdf9e, emissiveIntensity: 2.0 }));
    bulb.position.set(sx, 2.47, 1.7);
    scene.add(bulb);
    bulbRefs.push(bulb.material);
  }
}

// ---------------- 背景カード ----------------
const backdrops = {};
const backdropCords = {};
const cordMat = new THREE.MeshBasicMaterial({ color: 0x7a6a52 });
['mori', 'oshiro', 'umi'].forEach((kind, i) => {
  const g = buildBackdrop(kind, matWoodDark);
  // 舞台裏のラックに立てかけて待機
  g.position.set(-1.44 + i * 0.04, 0.72, -2.05 - i * 0.11);
  g.rotation.set(-0.1, 0.55, 0.02 * i);
  g.userData.state = 'lean';
  scene.add(g);
  backdrops[kind] = g;
  const cords = [];
  for (let k = 0; k < 2; k++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 1, 6), cordMat);
    c.visible = false;
    scene.add(c);
    cords.push(c);
  }
  backdropCords[kind] = cords;
});
// 立てかけ用ラック
{
  const rack = new THREE.Group();
  for (const s of [-0.75, 0.75]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), matWood);
    pole.position.set(s, 0.75, 0); pole.rotation.x = -0.12; pole.castShadow = true;
    rack.add(pole);
  }
  rack.position.set(-1.52, 0, -2.28); rack.rotation.y = 0.55;
  scene.add(rack);
}

function updateBackdropCords() {
  for (const kind of Object.keys(backdrops)) {
    const g = backdrops[kind];
    const cords = backdropCords[kind];
    const hung = g.userData.state === 'hung';
    for (let k = 0; k < 2; k++) {
      cords[k].visible = hung;
      if (!hung) continue;
      const battenY = g.position.y + SHEET_H / 2 + 0.02;
      const len = Math.max(0.02, RAIL_Y - battenY);
      const x = g.position.x + (k === 0 ? -1 : 1) * 0.72;
      cords[k].scale.y = len;
      cords[k].position.set(x, battenY + len / 2, g.position.z);
    }
  }
}

// ---------------- ライト（背面投影ランプ） ----------------
const lamp = new THREE.Group();
const lampBulbY = 1.15;
let lampZ = -1.9;
let lampOn = false;
{
  // 三脚ドリー
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.62, 8), matMetalDark);
    leg.position.set(Math.cos(a) * 0.14, 0.26, Math.sin(a) * 0.14);
    leg.rotation.z = -Math.cos(a) * 0.45;
    leg.rotation.x = Math.sin(a) * 0.45;
    leg.castShadow = true;
    lamp.add(leg);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), matMetalDark);
    wheel.position.set(Math.cos(a) * 0.24, 0.026, Math.sin(a) * 0.24);
    lamp.add(wheel);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.72, 10), matMetal);
  pole.position.y = 0.82; pole.castShadow = true;
  lamp.add(pole);
  // 灯体（円筒・前開口）
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.2, 18, 1, true), matMetalDark);
  housing.rotation.x = Math.PI / 2;
  housing.position.y = lampBulbY;
  housing.castShadow = true;
  lamp.add(housing);
  const backCap = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.08, 0.05, 18), matMetalDark);
  backCap.rotation.x = Math.PI / 2; backCap.position.set(0, lampBulbY, -0.12);
  lamp.add(backCap);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.01, 8, 20), matMetal);
  rim.position.set(0, lampBulbY, 0.1);
  lamp.add(rim);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xc84828, roughness: 0.4 }));
  knob.position.set(0, lampBulbY - 0.02, -0.16);
  lamp.add(knob);
  // ケーブル（床を這う）
  const cablePts = [
    new THREE.Vector3(0.04, 0.05, -0.2), new THREE.Vector3(0.2, 0.01, -0.5),
    new THREE.Vector3(0.05, 0.01, -0.9), new THREE.Vector3(0.3, 0.01, -1.3),
  ];
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 20, 0.008, 6),
    matMetalDark);
  lamp.add(cable);
}
const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 12),
  new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xffe6b0, emissiveIntensity: 0.05 }));
lampBulb.position.y = lampBulbY;
lamp.add(lampBulb);
lamp.position.set(0, 0, lampZ);
scene.add(lamp);

// ビーム円錐
const beamGeo = new THREE.ConeGeometry(1, 1, 26, 1, true);
beamGeo.translate(0, -0.5, 0);
const beamMat = new THREE.MeshBasicMaterial({
  color: 0xffdfae, transparent: true, opacity: 0, side: THREE.BackSide,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const beam = new THREE.Mesh(beamGeo, beamMat);
beam.rotation.x = -Math.PI / 2;
beam.renderOrder = 3;
scene.add(beam);

// ビーム内の塵
const DUST_N = 60;
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST_N * 3), 3));
const dustSeeds = [];
for (let i = 0; i < DUST_N; i++) {
  dustSeeds.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, p: Math.random(), s: 0.5 + Math.random() });
}
const dustTexC = document.createElement('canvas'); dustTexC.width = dustTexC.height = 32;
{
  const x = dustTexC.getContext('2d');
  const g = x.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,240,210,1)'); g.addColorStop(1, 'rgba(255,240,210,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
}
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  size: 0.014, map: new THREE.CanvasTexture(dustTexC), transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffe6c0,
}));
dust.frustumCulled = false;
scene.add(dust);

// ---------------- 照明リグ ----------------
const hemi = new THREE.HemisphereLight(0xffe8c8, 0x33241a, 0.55);
scene.add(hemi);
const workDir = new THREE.DirectionalLight(0xffd9a8, 1.6);
workDir.position.set(2.2, 3.0, -2.0);
workDir.target.position.copy(TABLE_P);
workDir.castShadow = true;
workDir.shadow.mapSize.set(1024, 1024);
workDir.shadow.camera.left = -2.8; workDir.shadow.camera.right = 2.8;
workDir.shadow.camera.top = 2.8; workDir.shadow.camera.bottom = -2.8;
workDir.shadow.camera.far = 9;
workDir.shadow.bias = -0.0006;
scene.add(workDir, workDir.target);
const pendantL = new THREE.PointLight(0xffb46a, 6, 7, 2);
pendantL.position.set(-1.15, 2.4, 1.7);
const pendantR = pendantL.clone();
pendantR.position.x = 1.15;
scene.add(pendantL, pendantR);
const workPendant = new THREE.PointLight(0xffd9a0, 9, 6, 2);
workPendant.position.set(TABLE_P.x, 2.36, TABLE_P.z);
scene.add(workPendant);
const lampSpot = new THREE.SpotLight(0xffe2b0, 0, 9, 1.0, 0.55, 1.6);
lampSpot.castShadow = true;
lampSpot.shadow.mapSize.set(1024, 1024);
lampSpot.shadow.bias = -0.0004;
lampSpot.target.position.copy(SCREEN_C);
scene.add(lampSpot, lampSpot.target);
const screenGlow = new THREE.PointLight(0xffe6c0, 0, 6, 2);
screenGlow.position.set(0, 1.25, 0.85);
scene.add(screenGlow);

// 照明モード（滑らかに遷移）
const lightState = { hemi: 0.55, work: 1.6, pendant: 6, workPend: 9, bulbGlow: 2.2, fog: 0.075 };
let lightTarget = { ...lightState };
function setHouse(mode) {
  if (mode === 'prep') lightTarget = { hemi: 0.55, work: 1.6, pendant: 6, workPend: 9, bulbGlow: 2.2, fog: 0.075 };
  if (mode === 'dark') lightTarget = { hemi: 0.045, work: 0.06, pendant: 0.18, workPend: 0.1, bulbGlow: 0.06, fog: 0.10 };
}

// ---------------- スプライト（誘導リング・きらきら） ----------------
const ringTex = TX.ringSprite();
const starTex = TX.starSprite();
const rings = [];
for (let i = 0; i < 4; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: ringTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
  }));
  s.renderOrder = 20;
  s.scale.setScalar(0.1);
  scene.add(s);
  rings.push(s);
}
let hintPoints = [];   // [{pos: Vector3|() => Vector3, r}]
function setHints(list) { hintPoints = list; }

const sparkles = [];
function burst(pos, n = 14, spread = 0.16) {
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: starTex, transparent: true, depthWrite: false, opacity: 1,
      color: [0xfff0b0, 0xffc4e0, 0xb0e0ff, 0xffe08a][i % 4],
    }));
    s.position.copy(pos);
    s.scale.setScalar(0.035 + Math.random() * 0.03);
    const a = Math.random() * Math.PI * 2;
    s.userData.v = new THREE.Vector3(Math.cos(a) * spread * (0.5 + Math.random()),
      0.2 + Math.random() * 0.25, Math.sin(a) * spread * (0.5 + Math.random()));
    s.userData.life = 1;
    s.renderOrder = 21;
    scene.add(s);
    sparkles.push(s);
  }
}

// ---------------- ツイーン ----------------
const tweens = [];
const easeIO = (t) => t * t * (3 - 2 * t);
const easeO = (t) => 1 - (1 - t) * (1 - t);
function addTween(dur, onUpdate, { ease = easeIO, onDone = null, delay = 0 } = {}) {
  tweens.push({ t: -delay, dur, onUpdate, ease, onDone });
}
function tickTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(1, tw.t / tw.dur);
    tw.onUpdate(tw.ease(k));
    if (k >= 1) { tweens.splice(i, 1); if (tw.onDone) tw.onDone(); }
  }
}

// ---------------- カメラ制御 ----------------
const POSES = {
  intro:     { pos: [2.7, 1.9, 3.1],  tgt: [0, 1.1, -0.6] },
  table:     { pos: [0.95, 2.12, -1.78], tgt: [0.95, 0.6, -1.0] },
  backstage: { pos: [-2.6, 2.05, -3.1], tgt: [0.3, 0.95, -0.5] },
  rail:      { pos: [-2.75, 1.8, -3.2], tgt: [0.3, 1.35, -0.3], fov: 56 },   // 吊りレールも入る広角
  light:     { pos: [-2.35, 1.6, -1.35], tgt: [0.15, 1.02, -0.8] },
  frontSide: { pos: [-2.5, 1.5, 1.9], tgt: [0, 1.12, 0] },   // 客席へ回り込む中継点
  front:     { pos: [0, 1.35, 3.05], tgt: [0, 1.12, 0] },
  show:      { pos: [0, 1.22, 2.7],  tgt: [0, 1.16, 0] },
};
let poseName = 'intro';
let camK = 2.2;                 // 追従の速さ
const camPos = new THREE.Vector3(2.7, 1.9, 3.1);
const camTgt = new THREE.Vector3(0, 1.1, -0.6);
function setPose(name, k = 2.2) { poseName = name; camK = k; }
const _gp = new THREE.Vector3(), _gt = new THREE.Vector3();
function goalPose(out, outT) {
  const p = POSES[poseName];
  outT.set(p.tgt[0], p.tgt[1], p.tgt[2]);
  out.set(p.pos[0], p.pos[1], p.pos[2]);
  const aspect = innerWidth / innerHeight;
  const mult = THREE.MathUtils.clamp(1.08 / aspect, 1, 2.05);
  out.sub(outT).multiplyScalar(mult).add(outT);
}
function updateCamera(dt, t) {
  goalPose(_gp, _gt);
  const l = 1 - Math.exp(-camK * dt);
  camPos.lerp(_gp, l);
  camTgt.lerp(_gt, l);
  const goalFov = POSES[poseName].fov || 44;
  if (Math.abs(camera.fov - goalFov) > 0.05) {
    camera.fov = THREE.MathUtils.lerp(camera.fov, goalFov, l);
    camera.updateProjectionMatrix();
  }
  camera.position.copy(camPos);
  // 呼吸のような微揺れ
  camera.position.x += Math.sin(t * 0.4) * 0.012;
  camera.position.y += Math.sin(t * 0.6 + 1) * 0.009;
  camera.lookAt(camTgt);
}

// ---------------- UI ----------------
const $ = (id) => document.getElementById(id);
const banner = $('banner'), bannerText = $('bannerText'), bannerIcon = $('bannerIcon');
const starsEl = $('stars');
function setBanner(icon, text) {
  if (!text) { banner.classList.add('hidden'); return; }
  banner.classList.remove('hidden');
  bannerIcon.textContent = icon;
  bannerText.textContent = text;
}
let starCount = 0;
function earnStar() {
  starCount++;
  const spans = starsEl.querySelectorAll('span');
  for (let i = 0; i < starCount && i < spans.length; i++) spans[i].classList.add('on');
}

// ---------------- 入力（一指操作） ----------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let activePointer = null;
let dragging = false;
let lastPX = 0, lastPY = 0;
const handlers = { tap: null, dragStart: null, dragMove: null, dragEnd: null };

function toNDC(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (activePointer !== null) return;      // 二本目の指は無視
  activePointer = e.pointerId;
  initAudio();
  lastPX = e.clientX; lastPY = e.clientY;
  toNDC(e);
  dragging = false;
  if (handlers.dragStart) { dragging = handlers.dragStart(e) || false; }
  if (!dragging && handlers.tap) handlers.tap(e);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer) return;
  const dx = e.clientX - lastPX, dy = e.clientY - lastPY;
  lastPX = e.clientX; lastPY = e.clientY;
  toNDC(e);
  if (dragging && handlers.dragMove) handlers.dragMove(e, dx, dy);
});
function endPointer(e) {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  if (dragging && handlers.dragEnd) handlers.dragEnd(e);
  dragging = false;
}
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', endPointer);

function raycastHit(objects) {
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(objects, true);
  return hits.length ? hits[0] : null;
}
// 当たり判定用の不可視メッシュ
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
function hitSphere(r) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), hitMat);
  return m;
}

// ---------------- ゲーム状態 ----------------
let stepName = 'intro';
let puppet = null;         // buildPuppet の返値
let ghost = null;
let chosenKind = null;
const stepStart = {};      // デバッグ用

// 影の拡大率（ライト距離から）
function shadowScale() {
  const d = -lampZ;
  return d / Math.max(0.05, d - (-PUPPET_Z));
}

// ---------------- 工程 1: どうぶつ選び ----------------
const chooser = { cards: [], hits: [] };
function enterChoose() {
  stepName = 'choose';
  setPose('table');
  setBanner('🎭', 'すきな どうぶつを タッチして えらんでね');
  starsEl.classList.remove('hidden');
  const kinds = ['usagi', 'tori', 'sakana'];
  kinds.forEach((k, i) => {
    const p = buildPuppet(puppetSpec(k));
    p.group.scale.setScalar(0.62);
    const x = TABLE_P.x - 0.3 + i * 0.3;
    p.group.position.set(x, TABLE_H + 0.1, TABLE_P.z + 0.02);
    p.group.rotation.set(-0.18, 0, 0);
    scene.add(p.group);
    // 支えの木ブロック
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.06), matWood);
    block.position.set(x, TABLE_H + 0.025, TABLE_P.z + 0.06);
    block.castShadow = true;
    scene.add(block);
    const hit = hitSphere(0.14);
    hit.position.set(x, TABLE_H + 0.12, TABLE_P.z);
    hit.userData.kind = k;
    scene.add(hit);
    chooser.cards.push({ p, block, hit, kind: k });
    chooser.hits.push(hit);
  });
  setHints(chooser.cards.map(c => ({ pos: c.hit.position.clone().add(new THREE.Vector3(0, 0.06, 0)) })));
  handlers.tap = () => {
    const h = raycastHit(chooser.hits);
    if (!h) { sfx.tap(); return; }
    const kind = h.object.userData.kind;
    sfx.pop();
    chooseAnimal(kind);
  };
}
function chooseAnimal(kind) {
  chosenKind = kind;
  handlers.tap = null;
  setHints([]);
  for (const c of chooser.cards) {
    if (c.kind === kind) {
      burst(c.hit.position);
      addTween(0.5, (k) => { c.p.group.scale.setScalar(0.62 * (1 - k)); },
        { onDone: () => { disposePuppetVisual(c.p); } });
    } else {
      addTween(0.4, (k) => {
        c.p.group.position.y = TABLE_H + 0.1 - k * 0.06;
        c.p.group.rotation.x = -0.18 - k * 1.4;
        c.p.group.scale.setScalar(0.62 * (1 - k * 0.9));
      }, { onDone: () => disposePuppetVisual(c.p) });
    }
    scene.remove(c.block, c.hit);
  }
  chooser.cards.length = 0; chooser.hits.length = 0;
  sfx.chime(); earnStar();
  setTimeout(() => enterBuild(), 550);
}
function disposePuppetVisual(p) {
  p.group.traverse((o) => { if (o.isMesh) unregisterProj(o); });
  scene.remove(p.group);
}

// ---------------- 工程 2: 人形の組み立て ----------------
const ASSEMBLY = new THREE.Vector3(TABLE_P.x - 0.02, TABLE_H + 0.015, TABLE_P.z - 0.02);
const build = { remaining: [], scatter: new Map() };
function enterBuild() {
  stepName = 'build'; stepStart.build = performance.now();
  setBanner('✂️', 'ひかる パーツを タッチして くみたてよう');
  puppet = buildPuppet(puppetSpec(chosenKind));
  puppet.group.position.copy(ASSEMBLY);
  puppet.group.rotation.set(-Math.PI / 2, 0, Math.PI);
  scene.add(puppet.group);
  // 組み立てガイド（うっすら光る下絵）
  ghost = buildPuppet(puppetSpec(chosenKind));
  const gm = new THREE.MeshBasicMaterial({ color: 0xffeab0, transparent: true, opacity: 0.16, depthWrite: false });
  ghost.group.traverse((o) => { if (o.isMesh) { unregisterProj(o); o.material = gm; o.castShadow = false; } });
  ghost.group.position.copy(ASSEMBLY);
  ghost.group.position.y -= 0.004;
  ghost.group.rotation.copy(puppet.group.rotation);
  scene.add(ghost.group);
  // パーツを散らす
  const n = puppet.parts.length;
  build.remaining = [...puppet.parts];
  puppet.parts.forEach((part, i) => {
    const a = (i / n) * Math.PI * 2 + 0.6;
    const r = 0.24 + (i % 2) * 0.05;
    const sp = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.8, 0.006 + i * 0.004);
    build.scatter.set(part.name, sp);
    part.obj.position.copy(sp);
    part.obj.rotation.z = (Math.random() - 0.5) * 1.4;
  });
  refreshBuildHints();
  handlers.tap = () => {
    // どの残りパーツをタッチしても OK（近いものを選ぶ）
    ray.setFromCamera(ndc, camera);
    let best = null, bestD = 0.09;
    for (const part of build.remaining) {
      const wp = new THREE.Vector3();
      part.obj.getWorldPosition(wp);
      const d = ray.ray.distanceToPoint(wp);
      if (d < bestD) { bestD = d; best = part; }
    }
    if (!best) { sfx.tap(); return; }
    snapPart(best);
  };
}
function refreshBuildHints() {
  setHints(build.remaining.map(part => ({
    pos: () => { const v = new THREE.Vector3(); part.obj.getWorldPosition(v); return v; },
  })));
}
function snapPart(part) {
  build.remaining.splice(build.remaining.indexOf(part), 1);
  refreshBuildHints();
  sfx.paper();
  const from = part.obj.position.clone();
  const fromR = part.obj.rotation.z;
  const to = part.home;
  addTween(0.45, (k) => {
    part.obj.position.lerpVectors(from, to, k);
    part.obj.position.z += Math.sin(k * Math.PI) * 0.05;
    part.obj.rotation.z = fromR * (1 - k);
  }, {
    onDone: () => {
      part.obj.position.copy(to);
      sfx.snap();
      const wp = new THREE.Vector3(); part.obj.getWorldPosition(wp);
      burst(wp, 6, 0.08);
      if (!build.remaining.length && ghost) {   // 完了処理は一度だけ
        scene.remove(ghost.group); ghost = null;
        sfx.chime(); earnStar();
        setTimeout(() => enterColor(), 500);
      }
    },
  });
}

// ---------------- 工程 3: 色紙はり ----------------
const palette = { stacks: [], hits: [], slotIdx: 0 };
function enterColor() {
  stepName = 'color';
  setBanner('🌈', 'すきな いろがみを タッチして はろう');
  const cols = ['pink', 'yellow', 'blue', 'orange'];
  cols.forEach((ck, i) => {
    const g = new THREE.Group();
    for (let l = 0; l < 4; l++) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.085),
        new THREE.MeshStandardMaterial({
          color: CELLO_COLORS[ck].main, transparent: true, opacity: 0.62,
          roughness: 0.3, side: THREE.DoubleSide, emissive: CELLO_COLORS[ck].main, emissiveIntensity: 0.1,
        }));
      sheet.rotation.x = -Math.PI / 2;
      sheet.rotation.z = (Math.random() - 0.5) * 0.4;
      sheet.position.y = 0.0012 * l;
      g.add(sheet);
    }
    g.position.set(TABLE_P.x - 0.36 + i * 0.24, TABLE_H + 0.004, TABLE_P.z + 0.245);
    scene.add(g);
    const hit = hitSphere(0.09);
    hit.position.copy(g.position);
    hit.userData.colorKey = ck;
    scene.add(hit);
    palette.stacks.push({ g, hit, ck });
    palette.hits.push(hit);
  });
  palette.slotIdx = 0;
  setHints(palette.stacks.map(s => ({ pos: s.g.position.clone().add(new THREE.Vector3(0, 0.04, 0)) })));
  handlers.tap = () => {
    const h = raycastHit(palette.hits);
    if (!h) { sfx.tap(); return; }
    if (palette.slotIdx >= puppet.spec.cello.length) return;
    const ck = h.object.userData.colorKey;
    const idx = palette.slotIdx++;
    sfx.paper();
    const meshes = addCelloToPuppet(puppet, idx, ck);
    for (const m of meshes) {
      const endPos = m.position.clone();
      const endScale = m.scale.clone();
      const startWorld = h.object.position.clone().add(new THREE.Vector3(0, 0.05, 0));
      const startLocal = m.parent.worldToLocal(startWorld.clone());
      m.position.copy(startLocal);
      m.scale.setScalar(0.3);
      addTween(0.5, (k) => {
        m.position.lerpVectors(startLocal, endPos, k);
        m.scale.lerpVectors(new THREE.Vector3(0.3, 0.3, 0.3), endScale, k);
      }, {
        onDone: () => {
          sfx.snap();
          const wp = new THREE.Vector3(); m.getWorldPosition(wp);
          burst(wp, 5, 0.06);
        },
      });
    }
    if (palette.slotIdx >= puppet.spec.cello.length) {
      handlers.tap = null;
      setHints([]);
      setTimeout(() => {
        sfx.chime(); earnStar();
        for (const s of palette.stacks) { scene.remove(s.g, s.hit); }
        palette.stacks.length = 0; palette.hits.length = 0;
        enterBackdrop();
      }, 700);
    }
  };
}

// ---------------- 工程 4: 背景を吊るす ----------------
const backdropStep = { remaining: [], finished: false };
function enterBackdrop() {
  stepName = 'backdrop';
  setPose('rail');
  setBanner('🖼️', 'はいけいの いたを タッチして レールに つるそう');
  backdropStep.remaining = ['mori', 'oshiro', 'umi'];
  const hits = [];
  backdropStep.remaining.forEach((kind, i) => {
    const hit = hitSphere(0.5);
    hit.position.copy(backdrops[kind].position).add(new THREE.Vector3(0, 0.1, 0));
    hit.userData.kind = kind;
    scene.add(hit);
    backdrops[kind].userData.hit = hit;
    hits.push(hit);
  });
  refreshBackdropHints();
  handlers.tap = () => {
    const avail = backdropStep.remaining.map(k => backdrops[k].userData.hit).filter(Boolean);
    const h = raycastHit(avail);
    if (!h) { sfx.tap(); return; }
    hangBackdrop(h.object.userData.kind);
  };
}
function refreshBackdropHints() {
  setHints(backdropStep.remaining.map(k => ({
    pos: backdrops[k].position.clone().add(new THREE.Vector3(0, 0.1, 0)), r: 0.15,
  })));
}
function hangBackdrop(kind) {
  backdropStep.remaining.splice(backdropStep.remaining.indexOf(kind), 1);
  const g = backdrops[kind];
  scene.remove(g.userData.hit);
  g.userData.hit = null;
  refreshBackdropHints();
  sfx.swoosh();
  const fromP = g.position.clone(), fromR = g.rotation.clone();
  const toP = new THREE.Vector3(0, PARK_Y, SLOT_Z[kind]);
  addTween(1.3, (k) => {
    g.position.lerpVectors(fromP, toP, k);
    g.position.y += Math.sin(k * Math.PI) * 0.35;
    g.rotation.set(fromR.x * (1 - k), fromR.y * (1 - k), fromR.z * (1 - k));
  }, {
    onDone: () => {
      g.userData.state = 'hung';
      g.userData.swing = 0.3;                    // 着地後にふらっと揺れる
      sfx.snap();
      burst(toP.clone().add(new THREE.Vector3(0, -0.3, 0.2)), 8, 0.2);
      if (!backdropStep.remaining.length && !backdropStep.finished) {
        backdropStep.finished = true;
        sfx.chime(); earnStar();
        setTimeout(() => enterRod(), 500);
      }
    },
  });
}

// ---------------- 工程 5: 棒と糸 ----------------
const rodStep = { items: [], hits: [], finished: false };
function lineBetween(p1, p2, r, mat) {
  const dir = p2.clone().sub(p1);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(p1).add(p2).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}
function enterRod() {
  stepName = 'rod';
  setPose('table');
  setBanner('🥢', 'ぼうを タッチして にんぎょうに つけよう');
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.7 });
  // 机に置かれた 2 本の棒
  const mainRod = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.42, 8), rodMat);
  mainRod.rotation.z = Math.PI / 2; mainRod.rotation.y = 0.4;
  mainRod.position.set(TABLE_P.x + 0.33, TABLE_H + 0.008, TABLE_P.z + 0.16);
  mainRod.castShadow = true;
  const ctrlRod = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, 0.3, 8), rodMat);
  ctrlRod.rotation.z = Math.PI / 2; ctrlRod.rotation.y = 0.15;
  ctrlRod.position.set(TABLE_P.x + 0.3, TABLE_H + 0.008, TABLE_P.z + 0.26);
  ctrlRod.castShadow = true;
  scene.add(mainRod, ctrlRod);
  const h1 = hitSphere(0.1); h1.position.copy(mainRod.position); h1.userData.rod = 'main'; scene.add(h1);
  const h2 = hitSphere(0.1); h2.position.copy(ctrlRod.position); h2.userData.rod = 'ctrl'; scene.add(h2);
  rodStep.items = [{ mesh: mainRod, hit: h1, id: 'main' }, { mesh: ctrlRod, hit: h2, id: 'ctrl' }];
  rodStep.hits = [h1, h2];
  refreshRodHints();
  handlers.tap = () => {
    const avail = rodStep.items.filter(i => !i.done).map(i => i.hit);
    const h = raycastHit(avail);
    if (!h) { sfx.tap(); return; }
    attachRod(rodStep.items.find(i => i.hit === h.object));
  };
}
function refreshRodHints() {
  setHints(rodStep.items.filter(i => !i.done).map(i => ({ pos: i.mesh.position.clone().add(new THREE.Vector3(0, 0.03, 0)) })));
}
function attachRod(item) {
  item.done = true;
  scene.remove(item.hit);
  refreshRodHints();
  sfx.paper();
  const spec = puppet.spec;
  const rodMat = item.mesh.material;
  // 人形ローカルでの最終位置
  let finalMesh;
  if (item.id === 'main') {
    const [ax, ay] = spec.rodAttach;
    finalMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.42, 8), rodMat);
    finalMesh.position.set(ax, ay - 0.2, -0.008);
    registerProj(finalMesh);
    puppet.rodMain = finalMesh;
  } else {
    const [sx, sy] = spec.stringAttach;
    const [ax, ay] = spec.rodAttach;
    const g = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0036, 0.0036, 0.3, 8), rodMat);
    rod.position.set(ax + 0.07, ay - 0.16, -0.012);
    rod.rotation.z = -0.12;
    registerProj(rod);
    const str = lineBetween(new THREE.Vector3(ax + 0.088, ay - 0.02, -0.012), new THREE.Vector3(sx, sy, -0.006),
      0.0014, new THREE.MeshBasicMaterial({ color: 0x6a6258 }));
    registerProj(str);
    g.add(rod, str);
    finalMesh = g;
    puppet.rodCtrl = g;
  }
  finalMesh.castShadow = true;
  puppet.group.add(finalMesh);
  // 机の上の棒 → 人形へ飛ぶ演出
  const start = item.mesh.position.clone();
  scene.remove(item.mesh);
  const endPos = finalMesh.position.clone();
  const startLocal = puppet.group.worldToLocal(start.clone());
  finalMesh.position.copy(startLocal);
  addTween(0.45, (k) => { finalMesh.position.lerpVectors(startLocal, endPos, k); }, {
    onDone: () => {
      finalMesh.position.copy(endPos);
      sfx.snap();
      const wp = new THREE.Vector3(); finalMesh.getWorldPosition(wp);
      burst(wp, 5, 0.07);
      if (rodStep.items.every(i => i.done) && !rodStep.finished) {
        rodStep.finished = true;
        sfx.chime(); earnStar();
        setTimeout(() => liftPuppet(), 450);
      }
    },
  });
}
function liftPuppet() {
  // 人形を持ち上げて立てる → 幕裏へ運ぶ工程へ
  const q1 = puppet.group.quaternion.clone();
  const q2 = new THREE.Quaternion();
  const p1 = puppet.group.position.clone();
  const p2 = new THREE.Vector3(0.62, 1.06, -0.88);
  sfx.swoosh();
  addTween(1.0, (k) => {
    puppet.group.position.lerpVectors(p1, p2, k);
    puppet.group.position.y += Math.sin(k * Math.PI) * 0.1;
    puppet.group.quaternion.slerpQuaternions(q1, q2, k);
  }, { onDone: () => enterPlace() });
}

// ---------------- 工程 6: 幕の裏へ配置（ドラッグ） ----------------
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PUPPET_Z);
const placeState = { snapped: false };
function enterPlace() {
  stepName = 'place';
  setPose('backstage');
  setBanner('🤲', 'にんぎょうを ゆびで ひっぱって ひかる クリップまで つれてこう');
  placeState.snapped = false;
  setHints([{ pos: PUPPET_POS.clone() }, {
    pos: () => { const v = new THREE.Vector3(); puppet.group.getWorldPosition(v); return v; },
  }]);
  handlers.tap = null;
  handlers.dragStart = () => {
    if (placeState.snapped) return false;
    sfx.tap();
    addTween(0.3, (k) => {
      puppet.group.position.z = THREE.MathUtils.lerp(puppet.group.position.z, PUPPET_Z, k);
    });
    return true;
  };
  handlers.dragMove = () => {
    if (placeState.snapped) return;
    ray.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(dragPlane, p)) {
      p.x = THREE.MathUtils.clamp(p.x, -0.62, 0.75);
      p.y = THREE.MathUtils.clamp(p.y, 0.82, 1.5);
      puppet.group.position.x = THREE.MathUtils.damp(puppet.group.position.x, p.x, 18, 1 / 60);
      puppet.group.position.y = THREE.MathUtils.damp(puppet.group.position.y, p.y, 18, 1 / 60);
      // 十分近づいたら磁石スナップ
      if (puppet.group.position.distanceTo(PUPPET_POS) < 0.17) snapPuppet();
    }
  };
  handlers.dragEnd = () => {
    if (placeState.snapped) return;
    if (puppet.group.position.distanceTo(PUPPET_POS) < 0.32) snapPuppet();
  };
}
function snapPuppet() {
  if (placeState.snapped) return;
  placeState.snapped = true;
  handlers.dragStart = handlers.dragMove = handlers.dragEnd = null;
  setHints([]);
  const from = puppet.group.position.clone();
  addTween(0.35, (k) => {
    puppet.group.position.lerpVectors(from, PUPPET_POS, k);
  }, {
    onDone: () => {
      puppet.group.position.copy(PUPPET_POS);
      sfx.snap(); sfx.chime(); earnStar();
      burst(PUPPET_POS.clone(), 12, 0.14);
      setTimeout(() => enterLight(), 600);
    },
  });
}

// ---------------- 工程 7: ライトの距離 ----------------
const lightStep = { on: false, dragged: false, cheered: false };
function enterLight() {
  stepName = 'light';
  setPose('light');
  setBanner('💡', 'ライトを タッチして つけよう');
  lightStep.on = false; lightStep.dragged = false; lightStep.cheered = false;
  const hit = hitSphere(0.3);
  hit.position.set(0, 1.1, lampZ);
  scene.add(hit);
  lightStep.hit = hit;
  setHints([{ pos: () => new THREE.Vector3(0, 1.35, lampZ) }]);
  handlers.tap = () => {
    if (lightStep.on) return;
    hit.position.z = lampZ;
    const h = raycastHit([hit]);
    if (!h) { sfx.tap(); return; }
    lightStep.on = true;
    lampOn = true;
    sfx.click();
    setTimeout(() => sfx.shimmer(), 250);
    setBanner('↔️', 'ゆびで ひっぱって ライトを ちかづけよう！かげが おおきくなるよ');
    setHints([{ pos: () => new THREE.Vector3(0, 1.35, lampZ) }]);
    handlers.tap = null;
    handlers.dragStart = () => true;
    handlers.dragMove = (e, dx, dy) => {
      // カメラの右方向に対して world +z がどちらに見えるかで符号を決める
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const sign = Math.sign(right.z) || 1;
      lampZ = THREE.MathUtils.clamp(lampZ + (dx * sign - dy * 0.4) * 0.006, LAMP_MIN, LAMP_MAX);
      lightStep.dragged = true;
      if (!lightStep.cheered && shadowScale() > 2.3) {
        lightStep.cheered = true;
        sfx.shimmer();
        burst(new THREE.Vector3(0, 1.3, -0.05), 14, 0.3);
      }
      if (lightStep.dragged) $('okBtn').classList.remove('hidden');
    };
    handlers.dragEnd = () => {};
  };
}
$('okBtn').addEventListener('click', () => {
  if (stepName !== 'light' || !lightStep.on) return;
  $('okBtn').classList.add('hidden');
  scene.remove(lightStep.hit);
  handlers.dragStart = handlers.dragMove = handlers.dragEnd = null;
  setHints([]);
  sfx.chime(); earnStar();
  enterSecret();
});

// ---------------- 工程 8: 客席チェック → 本番へ ----------------
function enterSecret() {
  stepName = 'secret';
  setPose('frontSide', 1.5);            // 脇を通って客席側へ（幕を突き抜けない）
  setTimeout(() => { if (stepName === 'secret' || stepName === 'show') setPose('front', 1.2); }, 1600);
  setBanner('🤫', 'おきゃくさまがわは まっしろ！じゅんびは ないしょだよ');
  setTimeout(() => {
    if (stepName === 'secret') $('showBtn').classList.remove('hidden');
  }, 1800);
}
$('showBtn').addEventListener('click', () => {
  if (stepName !== 'secret') return;
  $('showBtn').classList.add('hidden');
  startShow();
});

// ---------------- 本番 ----------------
const show = { t: 0, running: false, fired: new Set(), sceneIdx: -1, finShown: false, hopImpulse: 0 };
const SCENE_ORDER = ['mori', 'oshiro', 'umi'];
function startShow() {
  stepName = 'show';
  show.t = 0; show.running = true; show.fired.clear(); show.sceneIdx = -1; show.finShown = false;
  setBanner(null, null);
  starsEl.classList.add('hidden');
  sfx.click();
  setHouse('dark');
  setPose('show', 0.9);
  handlers.tap = () => {
    // 上演中のタッチはきらきら＋ジャンプ（ごほうび）
    ray.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.05), p);
    if (p) burst(p, 8, 0.15);
    sfx.pop();
    show.hopImpulse = 1;
  };
}
function fireOnce(key, fn) { if (!show.fired.has(key)) { show.fired.add(key); fn(); } }
function swapScene(idx) {
  const kind = SCENE_ORDER[idx % 3];
  sfx.swoosh();
  for (const k of SCENE_ORDER) {
    const g = backdrops[k];
    if (g.userData.state !== 'hung') continue;
    const from = g.position.y;
    const to = (k === kind) ? ACTIVE_Y : PARK_Y;
    if (Math.abs(from - to) < 0.01) continue;
    addTween(1.6, (t) => { g.position.y = THREE.MathUtils.lerp(from, to, t); });
  }
}
function updateShow(dt, t) {
  if (!show.running) return;
  show.t += dt;
  const st = show.t;
  fireOnce('reveal', () => {});
  if (st > 1.2) fireOnce('lampFull', () => {
    lampOn = true;
    addTween(1.8, (k) => { rtMatF.opacity = k; });
  });
  if (st > 2.2) fireOnce('music', () => startMusic());
  if (st > 3.0) fireOnce('zoom', () => {
    sfx.grow();
    const from = lampZ;
    addTween(4.6, (k) => { lampZ = THREE.MathUtils.lerp(from, -0.68, k); });
  });
  if (st > 7.6) fireOnce('spark', () => {
    sfx.bigChime();
    burst(new THREE.Vector3(0, 1.4, 0.1), 20, 0.4);
    burst(new THREE.Vector3(-0.4, 1.0, 0.1), 12, 0.3);
    burst(new THREE.Vector3(0.4, 1.2, 0.1), 12, 0.3);
  });
  // 場面切り替え
  if (st >= 8) {
    const idx = Math.floor((st - 8) / 12);
    if (idx !== show.sceneIdx) {
      show.sceneIdx = idx;
      swapScene(idx);
    }
  }
  if (st >= 44 && !show.finShown) {
    show.finShown = true;
    $('fin').classList.remove('hidden');
  }
  // 人形の演技
  if (st > 6 && puppet) {
    const a = Math.min(1, (st - 6) / 2);
    show.hopImpulse = Math.max(0, show.hopImpulse - dt * 2.2);
    const hop = Math.abs(Math.sin(t * 3.2)) * 0.035 * a + show.hopImpulse * 0.09;
    puppet.group.position.x = PUPPET_POS.x + Math.sin(t * 0.55) * 0.26 * a;
    puppet.group.position.y = PUPPET_POS.y + hop;
    puppet.group.rotation.z = Math.sin(t * 0.55 + 1.2) * 0.07 * a;
  }
}
$('againBtn').addEventListener('click', () => {
  $('fin').classList.add('hidden');
  show.t = 2.4; show.fired.clear(); show.fired.add('lampFull'); show.fired.add('music');
  show.sceneIdx = -1; show.finShown = false;
  lampZ = -1.9;
  sfx.click();
});
$('newBtn').addEventListener('click', () => location.reload());

// ---------------- 人形の可動部・待機アニメ ----------------
function updatePuppetIdle(t) {
  if (!puppet) return;
  for (const part of puppet.parts) {
    if (!part.moving) continue;
    const showing = show.running && show.t > 6;
    const amp = showing ? part.swing : part.swing * 0.15;
    const speed = showing ? 3.4 : 1.2;
    part.obj.rotation.z = Math.sin(t * speed) * amp;
  }
}

// ---------------- 背景の揺れ・仕掛け ----------------
function updateBackdrops(t, dt) {
  for (const kind of SCENE_ORDER) {
    const g = backdrops[kind];
    if (g.userData.state === 'hung') {
      // 吊り直後のふらつき → 減衰
      if (g.userData.swing > 0.002) {
        g.rotation.z = Math.sin(t * 3.2) * g.userData.swing * 0.15;
        g.userData.swing *= Math.exp(-dt * 1.2);
      } else g.rotation.z = 0;
    }
    const active = show.running && g.position.y < 1.6;
    for (const pivot of g.userData.sways) {
      const sw = pivot.userData.sway;
      pivot.rotation.z = Math.sin(t * 1.1 + sw.phase) * sw.amp * (active ? 1 : 0.25);
      const holderG = pivot.children[1];
      if (holderG && holderG.userData.flap) {
        holderG.userData.flap.forEach((w, i) => {
          w.rotation.z = Math.sin(t * 7 + sw.phase) * 0.45 * (i === 0 ? 1 : -1) * (active ? 1 : 0.2);
        });
      }
    }
    if (g.userData.boat) g.userData.boat.rotation.z = Math.sin(t * 0.9) * 0.07 * (active ? 1 : 0.3);
  }
  updateBackdropCords();
}

// ---------------- 投影レンダリング ----------------
const RT_BG = new THREE.Color(0xfff0d8);   // ランプの暖かい白
const MAIN_BG = scene.background;
function renderProjection() {
  const d = -lampZ;
  rtCam.position.set(0, lampBulbY, lampZ);
  rtCam.lookAt(SCREEN_C);
  rtCam.fov = 2 * Math.atan((SCREEN_H / 2) / d) * 180 / Math.PI;
  rtCam.updateProjectionMatrix();
  swapToProj();
  scene.background = RT_BG;
  const fog = scene.fog; scene.fog = null;
  renderer.setRenderTarget(rt);
  renderer.render(scene, rtCam);
  renderer.setRenderTarget(null);
  scene.background = MAIN_BG;
  scene.fog = fog;
  swapToMain();
}

// ---------------- リサイズ ----------------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------- 開始 ----------------
$('startBtn').addEventListener('click', () => {
  initAudio();
  sfx.pop();
  $('overlay').classList.add('hidden');
  setTimeout(() => enterChoose(), 300);
});

// ---------------- メインループ ----------------
const clock = new THREE.Clock();
let lampGlow = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  tickTweens(dt);
  updateCamera(dt, t);
  updateShow(dt, t);
  updatePuppetIdle(t);
  updateBackdrops(t, dt);

  // 照明の緩やかな遷移
  for (const k of Object.keys(lightState)) {
    lightState[k] = THREE.MathUtils.damp(lightState[k], lightTarget[k], 1.6, dt);
  }
  hemi.intensity = lightState.hemi;
  workDir.intensity = lightState.work;
  pendantL.intensity = pendantR.intensity = lightState.pendant;
  workPendant.intensity = lightState.workPend;
  scene.fog.density = lightState.fog;
  for (const bm of bulbRefs) bm.emissiveIntensity = lightState.bulbGlow;

  // ランプ
  lamp.position.z = lampZ;
  const targetGlow = lampOn ? 1 : 0;
  lampGlow = THREE.MathUtils.damp(lampGlow, targetGlow, 5, dt);
  const dist = -lampZ;
  lampBulb.material.emissiveIntensity = 0.05 + lampGlow * 5;
  lampSpot.position.set(0, lampBulbY, lampZ + 0.05);
  lampSpot.angle = Math.min(1.35, Math.atan(1.0 / dist) * 1.1);
  lampSpot.intensity = lampGlow * 14;
  beam.position.set(0, lampBulbY, lampZ + 0.08);
  beam.scale.set(0.95, Math.max(0.1, dist - 0.08), 0.95);
  beamMat.opacity = lampGlow * 0.05;
  dust.material.opacity = lampGlow * 0.4;
  if (lampGlow > 0.02) {
    const pos = dustGeo.attributes.position.array;
    for (let i = 0; i < DUST_N; i++) {
      const s = dustSeeds[i];
      const prog = (s.p + t * 0.014 * s.s) % 1;
      pos[i * 3] = s.x * 0.68 * prog + Math.sin(t * 0.6 + i) * 0.02;
      pos[i * 3 + 1] = lampBulbY + s.y * 0.53 * prog + Math.cos(t * 0.5 + i * 2) * 0.02;
      pos[i * 3 + 2] = lampZ * (1 - prog);
    }
    dustGeo.attributes.position.needsUpdate = true;
  }
  // 幕裏の投影表示（準備中は裏のみ／本番で表に）
  rtMatB.opacity = THREE.MathUtils.damp(rtMatB.opacity, lampGlow, 4, dt);
  screenGlow.intensity = rtMatF.opacity * 4.5;

  // 誘導リング
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    if (i < hintPoints.length) {
      const hp = hintPoints[i];
      const p = typeof hp.pos === 'function' ? hp.pos() : hp.pos;
      r.position.copy(p);
      const pulse = 1 + Math.sin(t * 5 + i) * 0.18;
      r.scale.setScalar((hp.r || 0.09) * pulse);
      r.material.opacity = 0.75 + Math.sin(t * 5 + i) * 0.2;
    } else r.material.opacity = 0;
  }
  // きらきら
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i];
    s.userData.life -= dt * 1.1;
    if (s.userData.life <= 0) { scene.remove(s); sparkles.splice(i, 1); continue; }
    s.position.addScaledVector(s.userData.v, dt);
    s.userData.v.y -= dt * 0.35;
    s.material.opacity = s.userData.life;
    s.material.rotation += dt * 3;
  }

  if (lampOn) renderProjection();
  renderer.render(scene, camera);
}
animate();

// ---------------- デバッグ / 試遊 API ----------------
window.__game = {
  get step() { return stepName; },
  get lampZ() { return lampZ; },
  set lampZ(v) { lampZ = THREE.MathUtils.clamp(v, LAMP_MIN, LAMP_MAX); },
  get showT() { return show.t; },
  get shadowScale() { return shadowScale(); },
  get rtFrontOpacity() { return rtMatF.opacity; },
  hintScreen() {
    if (!hintPoints.length) return null;
    const hp = hintPoints[0];
    const p = (typeof hp.pos === 'function' ? hp.pos() : hp.pos).clone();
    p.project(camera);
    return { x: (p.x + 1) / 2 * innerWidth, y: (-p.y + 1) / 2 * innerHeight };
  },
  worldToScreen(x, y, z) {
    const p = new THREE.Vector3(x, y, z).project(camera);
    return { x: (p.x + 1) / 2 * innerWidth, y: (-p.y + 1) / 2 * innerHeight };
  },
  puppetScreen() {
    if (!puppet) return null;
    const v = new THREE.Vector3();
    puppet.group.getWorldPosition(v);
    return this.worldToScreen(v.x, v.y, v.z);
  },
  clipScreen() { return this.worldToScreen(PUPPET_POS.x, PUPPET_POS.y, PUPPET_POS.z); },
  lampScreen() { return this.worldToScreen(0, 1.1, lampZ); },
  get lightOn() { return lampOn; },
  jumpShow(tt) {
    if (stepName !== 'show') return;
    tweens.length = 0;                    // 進行中のツイーンを破棄して状態を直接決める
    show.t = tt;
    show.fired.add('lampFull'); show.fired.add('music'); show.fired.add('zoom'); show.fired.add('spark');
    if (tt > 3) { lampOn = true; rtMatF.opacity = 1; lampZ = -0.68; }
    if (tt >= 8) {
      const idx = Math.floor((tt - 8) / 12);
      show.sceneIdx = idx;
      const kind = SCENE_ORDER[idx % 3];
      for (const k of SCENE_ORDER) {
        const g = backdrops[k];
        if (g.userData.state === 'hung') g.position.y = (k === kind) ? ACTIVE_Y : PARK_Y;
      }
    }
  },
  tapTest() {
    const h = this.hintScreen(); if (!h) return null;
    ndc.set((h.x / innerWidth) * 2 - 1, -(h.y / innerHeight) * 2 + 1);
    const avail = backdropStep.remaining.map(k => backdrops[k].userData.hit).filter(Boolean);
    const r = raycastHit(avail);
    return {
      hint: h, availCount: avail.length, hitKind: r ? r.object.userData.kind : null,
      remaining: [...backdropStep.remaining],
      hasTapHandler: !!handlers.tap,
      hitPos: avail.length ? avail.map(a => a.position.toArray().map(v => +v.toFixed(2))) : [],
    };
  },
  debugProbe() {
    const g = backdrops['mori'];
    const saved = { p: g.position.clone(), r: g.rotation.clone() };
    g.position.set(0, ACTIVE_Y, SLOT_Z.mori);
    g.rotation.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const savedLamp = { on: lampOn, z: lampZ };
    lampOn = true; lampZ = -0.9;
    renderProjection();
    const read = (x, y) => {
      const buf = new Uint8Array(4 * 64 * 64);
      renderer.readRenderTargetPixels(rt, x, y, 64, 64, buf);
      let dark = 0;
      for (let i = 0; i < 64 * 64; i++) if (buf[i * 4] < 100) dark++;
      return { dark, sample: [buf[0], buf[1], buf[2], buf[3]] };
    };
    const center = read(512 - 32, 384 - 32);
    const bottom = read(512 - 32, 40);
    g.position.copy(saved.p); g.rotation.copy(saved.r);
    lampOn = savedLamp.on; lampZ = savedLamp.z;
    return { center, bottom, projCount: projectables.length };
  },
};
