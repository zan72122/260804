// 影人形・背景カードの実ジオメトリ（厚み 3mm のカード紙を層で貼り合わせる工作物として作る）
import * as THREE from 'three';

export const CARD_T = 0.003;          // カード紙の厚み
export const LAYER = 0.0036;          // 貼り合わせ層の段差（厚みより大きく取り重なりを防ぐ）

export const CELLO_COLORS = {
  pink:   { main: 0xff77b0, name: 'ピンク' },
  yellow: { main: 0xffd83a, name: 'きいろ' },
  blue:   { main: 0x58b7ff, name: 'あお' },
  orange: { main: 0xff9a3c, name: 'オレンジ' },
};

// ---------- 低レベルヘルパ ----------
function poly(pts, smooth = false) {
  const s = new THREE.Shape();
  if (smooth) {
    s.moveTo(pts[0][0], pts[0][1]);
    s.splineThru(pts.slice(1).map(p => new THREE.Vector2(p[0], p[1])));
  } else {
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  }
  s.closePath();
  return s;
}
function ell(cx, cy, rx, ry, rot = 0) {
  const s = new THREE.Shape();
  s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, rot);
  return s;
}
function holeC(cx, cy, r) {
  const p = new THREE.Path(); p.absarc(cx, cy, r, 0, Math.PI * 2, true); return p;
}
function holeE(cx, cy, rx, ry, rot = 0) {
  const p = new THREE.Path(); p.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, true, rot); return p;
}
function extrude(shape, t = CARD_T) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: t, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004,
    bevelSegments: 1, curveSegments: 28,
  });
  return g;
}

let cardMaterial = null, cardMaterialLight = null;
export function setCardMaterials(dark, light) { cardMaterial = dark; cardMaterialLight = light; }

// 投影レンダリング用マテリアル（黒 / 乗算カラー）
export const projBlack = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
export function projCello(color) {
  return new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide, blending: THREE.MultiplyBlending,
    transparent: true, depthWrite: false,
  });
}

// mesh を「投影に映る」ものとして登録（layer 1 + 素材スワップ台帳）
export const projectables = [];
export function registerProj(mesh, projMat = projBlack) {
  mesh.layers.enable(1);
  projectables.push({ mesh, mainMat: mesh.material, projMat });
}
export function swapToProj() { for (const e of projectables) e.mesh.material = e.projMat; }
export function swapToMain() { for (const e of projectables) e.mesh.material = e.mainMat; }
export function unregisterProj(mesh) {
  const i = projectables.findIndex(e => e.mesh === mesh);
  if (i >= 0) projectables.splice(i, 1);
}

function cardMesh(shape, z = 0, mat = null, t = CARD_T) {
  const m = new THREE.Mesh(extrude(shape, t), mat || cardMaterial);
  m.position.z = z;
  m.castShadow = true;
  registerProj(m);
  return m;
}

// セロファン片（穴より一回り大きい薄片、光源側=−z に貼る）
export function celloMesh(shapeGeomShape, colorKey, z) {
  const cc = CELLO_COLORS[colorKey];
  const mat = new THREE.MeshStandardMaterial({
    color: cc.main, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    roughness: 0.25, metalness: 0, emissive: cc.main, emissiveIntensity: 0.12,
    depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shapeGeomShape, 24), mat);
  m.position.z = z;
  m.renderOrder = 5;
  registerProj(m, projCello(cc.main));
  return m;
}

// ---------- 影人形の定義 ----------
// 各パーツ: { name, build() -> {shape, z}, hole用セロファン情報, pivot(可動部) }
// 人形はローカル XY 平面（+z が幕側）で作られる。全高 ~0.3m。

export function puppetSpec(kind) {
  if (kind === 'usagi') return rabbitSpec();
  if (kind === 'tori') return birdSpec();
  return fishSpec();
}

function rabbitSpec() {
  const bodyShape = ell(0, 0, 0.088, 0.075);
  bodyShape.holes.push(holeC(-0.008, -0.004, 0.04));
  const headShape = ell(0.068, 0.102, 0.056, 0.052);
  headShape.holes.push(holeC(0.088, 0.116, 0.011));
  const earL = ell(0.036, 0.208, 0.021, 0.064, 0.20);
  earL.holes.push(holeE(0.036, 0.208, 0.010, 0.042, 0.20));
  const earR = ell(0.100, 0.202, 0.020, 0.060, -0.16);
  earR.holes.push(holeE(0.100, 0.202, 0.009, 0.038, -0.16));

  return {
    kind: 'usagi', label: 'うさぎ',
    parts: [
      { name: 'からだ', shapes: [bodyShape], z: 0 },
      { name: 'あたま', shapes: [headShape], z: LAYER },
      { name: 'みみ', shapes: [earL, earR], z: -LAYER, pivot: [0.068, 0.15], moving: true, swing: 0.13 },
      { name: 'しっぽ', shapes: [ell(-0.095, -0.012, 0.027, 0.027)], z: LAYER },
      { name: 'あし', shapes: [ell(0.022, -0.08, 0.056, 0.02)], z: 2 * LAYER },
    ],
    cello: [
      { part: 'からだ', shape: ell(-0.008, -0.004, 0.048, 0.048) },
      { part: 'あたま', shape: ell(0.088, 0.116, 0.017, 0.017) },
      { part: 'みみ', shape: null, multi: [ell(0.036, 0.208, 0.015, 0.048, 0.20), ell(0.100, 0.202, 0.014, 0.044, -0.16)] },
    ],
    rodAttach: [0.0, -0.07],       // 主棒の付け根（ローカル）
    stringAttach: [0.068, 0.19],   // 糸で操る可動部の位置
  };
}

function birdSpec() {
  const bodyShape = ell(0, 0, 0.096, 0.054);
  bodyShape.holes.push(holeC(-0.012, -0.008, 0.031));
  const headShape = ell(0.086, 0.036, 0.041, 0.039);
  headShape.holes.push(holeC(0.098, 0.046, 0.0095));
  const wing = poly([
    [0.012, 0.012], [-0.03, 0.062], [-0.085, 0.096], [-0.138, 0.082],
    [-0.12, 0.04], [-0.06, 0.006], [-0.02, -0.006],
  ], true);
  wing.holes.push(holeE(-0.075, 0.055, 0.030, 0.012, 0.45));

  return {
    kind: 'tori', label: 'ことり',
    parts: [
      { name: 'からだ', shapes: [bodyShape], z: 0 },
      { name: 'あたま', shapes: [headShape, poly([[0.09, 0.068], [0.10, 0.095], [0.112, 0.066]])], z: LAYER },
      { name: 'くちばし', shapes: [poly([[0.118, 0.052], [0.168, 0.034], [0.118, 0.014]])], z: 2 * LAYER },
      { name: 'しっぽ', shapes: [poly([[-0.078, 0.014], [-0.15, 0.052], [-0.163, 0.018], [-0.166, -0.022], [-0.148, -0.05], [-0.078, -0.02]], true)], z: LAYER },
      { name: 'つばさ', shapes: [wing], z: -LAYER, pivot: [0.012, 0.012], moving: true, swing: 0.35 },
    ],
    cello: [
      { part: 'からだ', shape: ell(-0.012, -0.008, 0.038, 0.038) },
      { part: 'あたま', shape: ell(0.098, 0.046, 0.015, 0.015) },
      { part: 'つばさ', shape: ell(-0.075, 0.055, 0.036, 0.017, 0.45) },
    ],
    rodAttach: [0.0, -0.05],
    stringAttach: [-0.06, 0.07],
  };
}

function fishSpec() {
  const bodyShape = ell(0, 0, 0.106, 0.06);
  bodyShape.holes.push(holeC(0.064, 0.013, 0.011));
  bodyShape.holes.push(holeC(-0.006, -0.014, 0.021));
  bodyShape.holes.push(holeC(-0.048, 0.01, 0.018));
  const tail = poly([
    [-0.098, 0.0], [-0.158, 0.052], [-0.146, 0.004], [-0.158, -0.05], [-0.1, -0.008],
  ], true);

  return {
    kind: 'sakana', label: 'おさかな',
    parts: [
      { name: 'からだ', shapes: [bodyShape], z: 0 },
      { name: 'せびれ', shapes: [poly([[-0.03, 0.048], [0.004, 0.1], [0.05, 0.046]], true)], z: LAYER },
      { name: 'おびれ', shapes: [tail], z: -LAYER, pivot: [-0.098, 0.0], moving: true, swing: 0.3 },
      { name: 'くち', shapes: [ell(0.108, -0.002, 0.013, 0.013)], z: LAYER },
      { name: 'はらびれ', shapes: [poly([[0.01, -0.052], [0.032, -0.09], [0.058, -0.05]], true)], z: 2 * LAYER },
    ],
    cello: [
      { part: 'からだ', shape: ell(0.064, 0.013, 0.017, 0.017) },
      { part: 'からだ', shape: ell(-0.006, -0.014, 0.028, 0.028) },
      { part: 'からだ', shape: ell(-0.048, 0.01, 0.025, 0.025) },
    ],
    rodAttach: [0.02, -0.055],
    stringAttach: [-0.11, 0.02],
  };
}

// spec からパーツ群を実体化。
// 返値: { group, parts: [{name, obj, homePos, homeQuat, moving}], spec }
export function buildPuppet(spec) {
  const group = new THREE.Group();
  const parts = [];
  for (const p of spec.parts) {
    let obj;
    if (p.pivot) {
      obj = new THREE.Group();
      const inner = new THREE.Group();
      for (const s of p.shapes) inner.add(cardMesh(s, 0));
      inner.position.set(-p.pivot[0], -p.pivot[1], 0);
      obj.add(inner);
      obj.position.set(p.pivot[0], p.pivot[1], p.z);
      obj.userData.isPivot = true;
    } else {
      obj = new THREE.Group();
      for (const s of p.shapes) obj.add(cardMesh(s, 0));
      obj.position.set(0, 0, p.z);
    }
    obj.userData.partName = p.name;
    group.add(obj);
    parts.push({ name: p.name, obj, spec: p, home: obj.position.clone(), moving: !!p.moving, swing: p.swing || 0 });
  }
  return { group, parts, spec };
}

// セロファンを人形へ追加（colorKey で着色）。slotIndex は spec.cello の添字。
export function addCelloToPuppet(puppet, slotIndex, colorKey) {
  const slot = puppet.spec.cello[slotIndex];
  const meshes = [];
  const shapes = slot.multi || [slot.shape];
  for (const s of shapes) {
    const m = celloMesh(s, colorKey, 0);
    // 可動パーツに属するセロファンはその子として追従させる
    const part = puppet.parts.find(pp => pp.name === slot.part);
    if (part.spec.pivot) {
      const inner = part.obj.children[0];
      m.position.z = -0.0009;
      inner.add(m);
    } else {
      m.position.z = part.obj.position.z - 0.0009;
      puppet.group.add(m);
    }
    meshes.push(m);
  }
  return meshes;
}

// ---------- 背景カード（幅 1.55 × 高 1.2、ローカル中心原点） ----------
export const SHEET_W = 1.55, SHEET_H = 1.2;
const B = -SHEET_H / 2; // 下端 y

function battenAndStrings(group, woodMat) {
  const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, SHEET_W + 0.06, 10), woodMat);
  bat.rotation.z = Math.PI / 2;
  bat.position.y = SHEET_H / 2 + 0.02;
  bat.castShadow = true;
  group.add(bat);
  // 吊り紐を結ぶ小さなループ
  const strMat = new THREE.MeshBasicMaterial({ color: 0x8a7a5a });
  for (const sx of [-SHEET_W / 2 + 0.055, SHEET_W / 2 - 0.055]) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 6, 12), strMat);
    s.position.set(sx, SHEET_H / 2 + 0.045, 0);
    group.add(s);
  }
}

function crenellated(x0, x1, yBase, yTop, tooth = 0.055, gap = 0.055, toothH = 0.05) {
  // 上端が凸凹（狭間）の壁
  const pts = [[x0, yBase]];
  pts.push([x0, yTop - toothH]);
  let x = x0;
  let up = true;
  while (x < x1 - 0.001) {
    const w = up ? tooth : gap;
    const nx = Math.min(x + w, x1);
    if (up) { pts.push([x, yTop]); pts.push([nx, yTop]); }
    else { pts.push([x, yTop - toothH]); pts.push([nx, yTop - toothH]); }
    x = nx; up = !up;
  }
  pts.push([x1, yTop - toothH]);
  pts.push([x1, yBase]);
  return poly(pts);
}

function wireCritter(group, buildFn, x, topY, phase) {
  // 上桟から針金で吊るす小さな仕掛け（本番で揺れる）
  const pivot = new THREE.Group();
  pivot.position.set(x, SHEET_H / 2 + 0.02, 0.004);
  const wireLen = SHEET_H / 2 + 0.02 - topY;
  const wire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0013, 0.0013, wireLen, 4),
    new THREE.MeshBasicMaterial({ color: 0x555049 })
  );
  wire.position.y = -wireLen / 2;
  registerProj(wire);
  pivot.add(wire);
  const holder = new THREE.Group();
  holder.position.y = -wireLen;
  pivot.add(holder);
  buildFn(holder);
  pivot.userData.sway = { phase, amp: 0.1 + Math.random() * 0.06 };
  group.userData.sways.push(pivot);
  group.add(pivot);
  return pivot;
}

export function buildBackdrop(kind, woodMat) {
  const g = new THREE.Group();
  g.userData.kind = kind;
  g.userData.sways = [];
  battenAndStrings(g, woodMat);

  if (kind === 'mori') {
    // 地面のうねり
    const groundPts = [[-SHEET_W / 2, B]];
    for (let i = 0; i <= 10; i++) {
      const x = -SHEET_W / 2 + (SHEET_W * i) / 10;
      groundPts.push([x, B + 0.13 + Math.sin(i * 1.7) * 0.035]);
    }
    groundPts.push([SHEET_W / 2, B]);
    g.add(cardMesh(poly(groundPts, false), 0));
    // 木々（幹＋こんもり団子）
    const trees = [[-0.52, 0.62], [0.06, 0.8], [0.56, 0.5]];
    for (const [tx, th] of trees) {
      g.add(cardMesh(poly([[tx - 0.035, B + 0.1], [tx - 0.022, B + th * 0.55], [tx + 0.022, B + th * 0.55], [tx + 0.035, B + 0.1]]), LAYER));
      const cy = B + th * 0.62;
      g.add(cardMesh(ell(tx, cy + th * 0.16, th * 0.21, th * 0.19), 2 * LAYER));
      g.add(cardMesh(ell(tx - th * 0.16, cy, th * 0.17, th * 0.15), 2 * LAYER));
      g.add(cardMesh(ell(tx + th * 0.16, cy, th * 0.17, th * 0.15), 2 * LAYER));
    }
    // 茂み
    g.add(cardMesh(ell(-0.24, B + 0.16, 0.085, 0.06), LAYER));
    g.add(cardMesh(ell(0.33, B + 0.14, 0.075, 0.055), LAYER));
    // ホタル（黄セロファン玉、吊り）
    for (const [fx, fy, ph] of [[-0.3, 0.06, 0], [0.18, 0.2, 2.1], [0.47, -0.02, 4.2]]) {
      wireCritter(g, (h) => { h.add(celloMesh(ell(0, 0, 0.02, 0.02), 'yellow', 0)); }, fx, fy, ph);
    }
  }

  if (kind === 'oshiro') {
    // 城壁（門穴つき）
    const wall = crenellated(-SHEET_W / 2, SHEET_W / 2, B, B + 0.33);
    const gate = new THREE.Path();
    gate.moveTo(-0.095, B);
    gate.lineTo(-0.095, B + 0.15);
    gate.absarc(0, B + 0.15, 0.095, Math.PI, 0, true);
    gate.lineTo(0.095, B);
    gate.closePath();
    wall.holes.push(gate);
    g.add(cardMesh(wall, 0));
    g.add(celloMesh(ell(0, B + 0.12, 0.13, 0.13), 'orange', -0.0012));
    // 天守（窓穴 2 つ）
    const keep = crenellated(-0.18, 0.18, B + 0.3, B + 1.0, 0.05, 0.05, 0.055);
    for (const wx of [-0.08, 0.08]) {
      const win = new THREE.Path();
      win.moveTo(wx - 0.032, B + 0.52);
      win.lineTo(wx - 0.032, B + 0.62);
      win.absarc(wx, B + 0.62, 0.032, Math.PI, 0, true);
      win.lineTo(wx + 0.032, B + 0.52);
      win.closePath();
      keep.holes.push(win);
    }
    g.add(cardMesh(keep, LAYER));
    for (const wx of [-0.08, 0.08]) g.add(celloMesh(ell(wx, B + 0.6, 0.048, 0.062), 'yellow', LAYER - 0.0012));
    // 旗
    g.add(cardMesh(poly([[-0.006, B + 0.99], [0.006, B + 0.99], [0.006, B + 1.13], [-0.006, B + 1.13]]), 2 * LAYER));
    g.add(cardMesh(poly([[0.006, B + 1.13], [0.09, B + 1.10], [0.006, B + 1.06]]), 2 * LAYER));
    // 両脇の塔（とんがり屋根＋窓）
    for (const s of [-1, 1]) {
      const tx = s * 0.52;
      const tower = poly([[tx - 0.09, B + 0.3], [tx - 0.09, B + 0.72], [tx, B + 0.94], [tx + 0.09, B + 0.72], [tx + 0.09, B + 0.3]]);
      tower.holes.push(holeC(tx, B + 0.55, 0.032));
      g.add(cardMesh(tower, LAYER));
      g.add(celloMesh(ell(tx, B + 0.55, 0.046, 0.046), 'yellow', LAYER - 0.0012));
    }
    // コウモリ（吊り・羽ばたき）
    wireCritter(g, (h) => {
      const wingShape = poly([[0, 0], [-0.05, 0.035], [-0.09, 0.01], [-0.05, -0.005]], true);
      const wing2 = poly([[0, 0], [0.05, 0.035], [0.09, 0.01], [0.05, -0.005]], true);
      h.add(cardMesh(ell(0, 0, 0.02, 0.026), 0));
      const w1 = cardMesh(wingShape, 0.0008), w2 = cardMesh(wing2, 0.0008);
      h.add(w1); h.add(w2);
      h.userData.flap = [w1, w2];
    }, -0.33, 0.28, 1.2);
  }

  if (kind === 'umi') {
    // 水面全体を青セロファンで
    const water = poly([[-SHEET_W / 2, B], [SHEET_W / 2, B], [SHEET_W / 2, B + 0.4], [-SHEET_W / 2, B + 0.4]]);
    g.add(celloMesh(water, 'blue', -0.004));
    // 波帯 × 2（スカラップ）
    const waveBand = (yTop, phase, z) => {
      const pts = [[-SHEET_W / 2, B]];
      const n = 12;
      for (let i = 0; i <= n; i++) {
        const x = -SHEET_W / 2 + (SHEET_W * i) / n;
        pts.push([x, yTop + Math.abs(Math.sin(i * 1.35 + phase)) * 0.05]);
      }
      pts.push([SHEET_W / 2, B]);
      return cardMesh(poly(pts, true), z);
    };
    g.add(waveBand(B + 0.24, 0, 0));
    g.add(waveBand(B + 0.11, 2.2, LAYER));
    // 帆かけ舟（揺れる）
    const boat = new THREE.Group();
    boat.position.set(0.36, B + 0.3, 2 * LAYER);
    const hull = cardMesh(poly([[-0.15, 0], [0.15, 0], [0.095, -0.075], [-0.095, -0.075]]), 0);
    const mast = cardMesh(poly([[-0.006, 0], [0.006, 0], [0.006, 0.2], [-0.006, 0.2]]), 0.0008);
    const sail = cardMesh(poly([[0.01, 0.19], [0.15, 0.05], [0.01, 0.03]]), 0.0008);
    boat.add(hull, mast, sail);
    boat.userData.rock = true;
    g.userData.boat = boat;
    g.add(boat);
    // 泡（青セロファン玉、吊り）
    for (const [bx, by, ph] of [[-0.42, 0.1, 0.5], [-0.28, 0.28, 2.8], [-0.5, 0.34, 4.9]]) {
      wireCritter(g, (h) => { h.add(celloMesh(ell(0, 0, 0.016 + Math.random() * 0.012, 0.016 + Math.random() * 0.012), 'blue', 0)); }, bx, by, ph);
    }
    // ちいさな魚の友だち（吊り・尾びれ）
    wireCritter(g, (h) => {
      const bd = ell(0, 0, 0.05, 0.028); bd.holes.push(holeC(0.03, 0.006, 0.005));
      h.add(cardMesh(bd, 0));
      const tl = cardMesh(poly([[-0.045, 0], [-0.078, 0.026], [-0.072, 0], [-0.078, -0.026]], true), 0.0008);
      h.add(tl);
      h.userData.flap = [tl];
    }, -0.1, 0.16, 3.6);
  }

  return g;
}
