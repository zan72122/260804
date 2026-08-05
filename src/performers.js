// 出演者。小さなバレリーナが3人。光を当てると、うれしそうにする。
import * as THREE from '../vendor/three.module.min.js';
import { lerp, clamp, damp, rand, easeOutCubic, smoothstep, Spring } from './util.js';
import {
  faceTexture, glowSprite, tulleNetTexture, fabricRoughTexture,
  hairRampTexture, contactShadowTexture,
} from './textures.js';

/* ============================================================
   小さな道具
   ============================================================ */

// 体に対して動かない部品どうしを、ひとつのジオメトリにまとめる。
// three の BufferGeometryUtils は同梱していないので、必要な分だけ自前で。
function mergeParts(parts) {
  const geos = [];
  for (const p of parts) {
    const g = p.geo.clone();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(p.pos || [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot || [0, 0, 0]))),
      new THREE.Vector3(...(p.scale || [1, 1, 1]))
    );
    g.applyMatrix4(m);
    // 多面体などは index を持たないので、その場でつくる
    if (!g.index) {
      const n = g.attributes.position.count;
      const seq = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
      for (let i = 0; i < n; i++) seq[i] = i;
      g.setIndex(new THREE.BufferAttribute(seq, 1));
    }
    geos.push(g);
    p.geo.dispose();
  }
  let vc = 0, ic = 0;
  for (const g of geos) {
    vc += g.attributes.position.count;
    ic += g.index.count;
  }
  const pos = new Float32Array(vc * 3);
  const nrm = new Float32Array(vc * 3);
  const uv = new Float32Array(vc * 2);
  const idx = vc > 65535 ? new Uint32Array(ic) : new Uint16Array(ic);
  let vo = 0, io = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nrm.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += n; io += gi.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// 頂点カラー（白）を用意する。同じ素材を使う面はすべて持たせておく。
function ensureColors(geo) {
  if (geo.attributes.color) return geo;
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// 部品の継ぎ目に、そっと陰りを焼き込む（貼り合わせに見えないように）
function shadeBand(geo, { from, to, dark = 0.55, axis = 'y' }) {
  ensureColors(geo);
  const pos = geo.attributes.position;
  const col = geo.attributes.color;
  const a = axis === 'y' ? 1 : axis === 'x' ? 0 : 2;
  for (let i = 0; i < pos.count; i++) {
    const v = pos.getComponent(i, a);
    const k = 1 - smoothstep(from, to, v);           // from 側ほど暗い
    const f = lerp(1, dark, k);
    col.setXYZ(i, col.getX(i) * f, col.getY(i) * f, col.getZ(i) * f);
  }
  col.needsUpdate = true;
  return geo;
}

// 暗い背景から人物が抜けるように、いまの照明色でふちを光らせる
function addRimLight(material, uni) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = uni.color;
    shader.uniforms.uRimPower = uni.power;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uRimColor;
        uniform float uRimPower;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          float ct = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
          gl_FragColor.rgb += uRimColor * pow(1.0 - ct, 3.2) * uRimPower;
        }`);
  };
  material.customProgramCacheKey = () => 'rim';
  return material;
}

// 髪のかぶりもの。球の一部を切り貼りすると、生え際が定規で引いたような
// まっすぐな線になってしまうので、生え際そのものを曲線として定義する。
function hairShell({ radius, edge, rows = 22, cols = 64 }) {
  const n = (rows + 1) * (cols + 1);
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const idx = [];
  const TH = Math.PI * 0.80;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const phi = (i / cols) * Math.PI * 2;
      // 生え際より下は、生え際の線にぴたりと重ねてしまう（段差を出さない）
      const theta = Math.min((j / rows) * TH, edge(phi));
      const k = j * (cols + 1) + i;
      const st = Math.sin(theta);
      pos[k * 3] = -radius * Math.cos(phi) * st;
      pos[k * 3 + 1] = radius * Math.cos(theta);
      pos[k * 3 + 2] = radius * Math.sin(phi) * st;
      uv[k * 2] = i / cols;
      uv[k * 2 + 1] = 1 - j / rows;
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 生え際の線。前は前髪、横は耳の下、後ろはうなじまで。
function hairEdge({ fringe = 0.98, side = 1.62, back = 2.05, teeth = 0.05, seed = 0 }) {
  return (phi) => {
    let d = (phi - Math.PI / 2 + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    d = Math.abs(d);                                  // 0=正面 π=後ろ
    const front = 1 - smoothstep(0.42, 1.05, d);
    const rear = smoothstep(1.05, 2.10, d);
    let e = lerp(lerp(fringe, side, 1 - front), back, rear);
    e += teeth * Math.sin(phi * 9 + seed) * front;    // 前髪のふぞろい
    e += 0.055 * Math.sin(phi * 3.1 + seed * 1.7);    // 全体のゆらぎ
    return e;
  };
}

// 高さから UV を引き直す（寄せ集めた面のグラデを、ひとつながりにする）
function rampByY(geo, from, to) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, 0.5, clamp((pos.getY(i) - from) / (to - from), 0.02, 0.98));
  }
  uv.needsUpdate = true;
  return geo;
}

// 回転体のプロフィールから、なめらかな手足・胴をつくる
function lathe(profile, segments = 16) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

/* ============================================================
   チュチュ（シルエットの主役）
   ============================================================ */
// 角 A × 半径 R の輪をつくる。外周は扇状にうねらせ、外へ行くほど薄くする。
function tutuLayer({
  rInner = 0.19, rOuter = 0.58, rise = 0.10, droop = 0.02,
  wave = 0.035, freq = 12, phase = 0, ripple = 0.018,
  edgeAlpha = 0.30, A = 38, R = 5,
}) {
  const cols = A + 1, rows = R + 1;
  const n = cols * rows;
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 4);
  const idx = [];
  for (let j = 0; j < rows; j++) {
    const t = j / R;
    for (let i = 0; i < cols; i++) {
      const a = (i / A) * Math.PI * 2;
      const scallop = 1 + wave * Math.sin(a * freq + phase) * t;
      const r = lerp(rInner, rOuter, t) * scallop;
      const y = rise * Math.pow(t, 1.25) - droop * Math.pow(t, 2.0)
        + ripple * Math.sin(a * freq + phase) * t * t;
      const k = j * cols + i;
      pos[k * 3] = Math.cos(a) * r;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = Math.sin(a) * r;
      uv[k * 2] = (i / A) * 9;
      uv[k * 2 + 1] = t * 2.2;
      // 外に行くほど薄く、ほんの少し明るく
      const alpha = lerp(1.0, edgeAlpha, Math.pow(t, 1.6));
      const tone = lerp(0.92, 1.14, t);
      col[k * 4] = tone; col[k * 4 + 1] = tone; col[k * 4 + 2] = tone; col[k * 4 + 3] = alpha;
    }
  }
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < A; i++) {
      const p = j * cols + i;
      idx.push(p, p + cols, p + 1, p + 1, p + cols, p + cols + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const TUTU_STYLES = {
  // 水平にぱりっと張った、クラシックチュチュ
  classic: {
    y: 0.90,
    layers: [
      { rOuter: 0.50, rise: 0.085, droop: 0.010, wave: 0.030, freq: 14, phase: 0.0, edgeAlpha: 0.42 },
      { rOuter: 0.58, rise: 0.070, droop: 0.030, wave: 0.038, freq: 11, phase: 1.1, edgeAlpha: 0.34 },
      { rOuter: 0.65, rise: 0.050, droop: 0.060, wave: 0.045, freq: 9, phase: 2.3, edgeAlpha: 0.26 },
    ],
  },
  // ふんわり釣鐘型の、ロマンティックチュチュ
  romantic: {
    y: 0.94,
    layers: [
      { rOuter: 0.40, rise: 0.02, droop: 0.26, wave: 0.045, freq: 9, phase: 0.4, edgeAlpha: 0.58 },
      { rOuter: 0.47, rise: 0.01, droop: 0.36, wave: 0.055, freq: 7, phase: 1.7, edgeAlpha: 0.46 },
      { rOuter: 0.53, rise: 0.00, droop: 0.46, wave: 0.062, freq: 6, phase: 3.0, edgeAlpha: 0.32 },
    ],
  },
  // 短くて元気な、げいこ用チュチュ
  short: {
    y: 0.88,
    layers: [
      { rOuter: 0.40, rise: 0.055, droop: 0.045, wave: 0.040, freq: 12, phase: 0.7, edgeAlpha: 0.44 },
      { rOuter: 0.48, rise: 0.040, droop: 0.090, wave: 0.050, freq: 10, phase: 2.0, edgeAlpha: 0.30 },
    ],
  },
};

/* ============================================================
   3人の描き分け
   ============================================================ */
export const CAST = [
  {
    skin: 0xffd8bf, tights: 0xf6c9da, satin: 0xffb8cf, leotard: 0xf4649a, accentA: 0xffe9a8,
    hairRoot: '#4a2838', hairTip: '#8d5a72',
    tutu: 'classic', bun: 'low', ornament: 'tiara', faceKind: 0, scale: 1.0,
  },
  {
    skin: 0xffe0c8, tights: 0xc9ecdd, satin: 0xa8e6cf, leotard: 0x4fc6a4, accentA: 0xffc0d8,
    hairRoot: '#2f3550', hairTip: '#6f7fa8', hairShine: 0x9fb0d8,
    tutu: 'romantic', bun: 'high', ornament: 'flower', faceKind: 1, scale: 1.06,
  },
  {
    skin: 0xffd2b4, tights: 0xdccdf2, satin: 0xc7b4f0, leotard: 0x9a7ae0, accentA: 0xbff0ff,
    hairRoot: '#5a3520', hairTip: '#a87444',
    tutu: 'short', bun: 'mid', ornament: 'bow', faceKind: 2, scale: 0.93,
  },
];

/* ============================================================
   出演者ひとり
   ============================================================ */
const HIP_Y = 0.86;
const SHOULDER_Y = 1.36;
const HEAD_Y = 1.87;
const SKULL_R = 0.325;

export class Performer {
  constructor(look = CAST[0], { homeX = 0, homeZ = -3.0, fromX = -10 } = {}) {
    this.look = look;
    this.group = new THREE.Group();
    this.homeX = homeX; this.homeZ = homeZ; this.fromX = fromX;
    this.group.position.set(fromX, 0, homeZ);
    this.t = rand(0, 10);
    this.state = 'wing';
    this.enterT = 0;
    this.spotlit = 0;
    this.joy = new Spring(0, { stiffness: 60, damping: 6 });
    this.blinkTimer = rand(1.5, 5);
    this.blink = 0;
    this.gaze = new THREE.Vector2(0, 0);
    this.gazeTarget = new THREE.Vector2(0, 0);

    // ふちの光は、いまの照明色を全素材で共有する
    this.rim = {
      color: { value: new THREE.Color(0xfff0d8) },
      power: { value: 0.0 },
    };

    const body = new THREE.Group();
    body.scale.setScalar(look.scale || 1);
    this.body = body;
    this.group.add(body);

    this._buildMaterials();
    this._buildLegs();
    this._buildBody();
    this._buildTutu();
    this._buildArms();
    this._buildHead();
    this._buildGround();
  }

  /* ---------- 素材 ---------- */
  _buildMaterials() {
    const L = this.look;
    const rough = fabricRoughTexture();

    this.matSkin = addRimLight(new THREE.MeshStandardMaterial({
      color: L.skin, roughness: 0.62, metalness: 0, vertexColors: true,
    }), this.rim);

    this.matTights = addRimLight(new THREE.MeshStandardMaterial({
      color: L.tights, roughness: 0.52, metalness: 0,
      roughnessMap: rough, vertexColors: true,
    }), this.rim);

    // レオタードはサテン。つやを sheen で出す。
    this.matLeotard = addRimLight(new THREE.MeshPhysicalMaterial({
      color: L.leotard, roughness: 0.55, metalness: 0.0,
      roughnessMap: rough,
      sheen: 0.8, sheenColor: new THREE.Color(0xffd8e6), sheenRoughness: 0.58,
      vertexColors: true,
    }), this.rim);

    // チュール。網目はアルファマップ、外周のぼかしは頂点アルファ。
    const net = tulleNetTexture();
    this.matTulle = addRimLight(new THREE.MeshPhysicalMaterial({
      color: L.leotard, roughness: 0.62, metalness: 0,
      sheen: 1, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.55,
      alphaMap: net, transparent: true, opacity: 0.92,
      side: THREE.DoubleSide, depthWrite: false, vertexColors: true,
    }), this.rim);

    this.matHair = addRimLight(new THREE.MeshStandardMaterial({
      color: 0xffffff, map: hairRampTexture(L.hairRoot, L.hairTip),
      roughness: 0.44, metalness: 0.05,
    }), this.rim);

    this.matSatin = addRimLight(new THREE.MeshStandardMaterial({
      color: L.satin || 0xffd9e2, roughness: 0.24, metalness: 0.04, roughnessMap: rough,
    }), this.rim);

    this.matAccent = new THREE.MeshStandardMaterial({
      color: L.accentA, roughness: 0.30, metalness: 0.35,
      emissive: L.accentA, emissiveIntensity: 0.20,
    });

    this.matEye = new THREE.MeshStandardMaterial({
      color: 0x24182c, roughness: 0.12, metalness: 0.0,
      emissive: 0x120c18, emissiveIntensity: 0.35,
    });
    this.matSpark = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.15, emissive: 0xffffff, emissiveIntensity: 0.45,
    });
  }

  /* ---------- 脚・タイツ・トウシューズ ---------- */
  _buildLegs() {
    // 腰から足首まで、ひと続きの回転体。膝とふくらはぎがわかる形にする。
    const legProfile = [
      [0.040, -0.760], [0.046, -0.720], [0.058, -0.660], [0.070, -0.560],
      [0.074, -0.470], [0.068, -0.390], [0.070, -0.330], [0.078, -0.240],
      [0.086, -0.140], [0.094, -0.050], [0.096, 0.020],
    ];
    this.legs = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.115, HIP_Y, 0);
      this.body.add(pivot);
      this.legs.push(pivot);

      const g = lathe(legProfile, 12);
      shadeBand(g, { from: -0.02, to: -0.22, dark: 0.62 });   // チュチュの下は暗く
      const leg = new THREE.Mesh(g, this.matTights);
      leg.castShadow = true;
      leg.receiveShadow = true;
      pivot.add(leg);

      // トウシューズ（サテンのつま先＋足首のリボン）
      const shoe = new THREE.Mesh(mergeParts([
        { geo: new THREE.SphereGeometry(0.075, 12, 8), pos: [0, -0.795, 0.030], scale: [0.92, 0.70, 1.45] },
        { geo: new THREE.CylinderGeometry(0.050, 0.056, 0.030, 12), pos: [0, -0.822, 0.088], rot: [0.18, 0, 0] },
        { geo: new THREE.TorusGeometry(0.048, 0.0095, 4, 10), pos: [0, -0.720, 0.004], rot: [1.32, 0, 0.34] },
        { geo: new THREE.TorusGeometry(0.050, 0.0095, 4, 10), pos: [0, -0.690, 0.004], rot: [1.36, 0, -0.34] },
      ]), this.matSatin);
      shoe.castShadow = true;
      pivot.add(shoe);
    }
  }

  /* ---------- レオタードと首 ---------- */
  _buildBody() {
    // 腰をくびれさせ、胸でふくらむプロフィール
    const bodice = lathe([
      [0.150, 0.780], [0.178, 0.830], [0.186, 0.880], [0.170, 0.960],
      [0.158, 1.030], [0.166, 1.100], [0.184, 1.170], [0.190, 1.240],
      [0.182, 1.310], [0.160, 1.380], [0.128, 1.430], [0.112, 1.455],
    ], 18);
    // 肩ひもも同じ生地なので、胴と一体にしてしまう
    const torsoGeo = mergeParts([
      { geo: bodice },
      { geo: new THREE.TorusGeometry(0.088, 0.016, 5, 10, Math.PI * 1.05), pos: [-0.118, 1.372, -0.005], rot: [0.16, 0, -0.30] },
      { geo: new THREE.TorusGeometry(0.088, 0.016, 5, 10, Math.PI * 1.05), pos: [0.118, 1.372, -0.005], rot: [0.16, 0, 0.30] },
    ]);
    shadeBand(torsoGeo, { from: 0.78, to: 0.95, dark: 0.60 });
    const torso = new THREE.Mesh(torsoGeo, this.matLeotard);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.body.add(torso);

    // 首
    const neck = lathe([
      [0.100, 1.395], [0.093, 1.470], [0.092, 1.545], [0.104, 1.615], [0.125, 1.672],
    ], 14);
    shadeBand(neck, { from: 1.40, to: 1.53, dark: 0.62 });
    const neckMesh = new THREE.Mesh(neck, this.matSkin);
    neckMesh.castShadow = true;
    this.body.add(neckMesh);
  }

  /* ---------- チュチュ ---------- */
  _buildTutu() {
    const style = TUTU_STYLES[this.look.tutu] || TUTU_STYLES.classic;
    const tutu = new THREE.Group();
    tutu.position.y = style.y;
    this.body.add(tutu);
    this.skirt = tutu;          // 既存のアニメーションはこの名前を使う

    style.layers.forEach((cfg, i) => {
      const mesh = new THREE.Mesh(tutuLayer({ rInner: 0.185, ...cfg }), this.matTulle);
      mesh.rotation.y = i * 0.7;
      mesh.renderOrder = 3 + i;
      tutu.add(mesh);
    });

    // 腰のベルト（バスク）と飾り石
    const basque = new THREE.Mesh(
      ensureColors(new THREE.CylinderGeometry(0.192, 0.186, 0.075, 20, 1, true)),
      this.matLeotard
    );
    basque.position.y = 0.010;
    tutu.add(basque);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), this.matAccent);
    gem.position.set(0, 0.012, 0.192);
    gem.scale.set(1, 1.3, 0.6);
    tutu.add(gem);

    if (this.look.tutu === 'short') {
      // サッシュ（腰から流れる帯）
      const sash = new THREE.Mesh(mergeParts([
        { geo: new THREE.TorusGeometry(0.055, 0.020, 6, 12), pos: [0.16, 0.02, 0.10], rot: [0.5, 0.6, 0] },
        { geo: new THREE.SphereGeometry(0.035, 10, 8), pos: [0.22, -0.10, 0.10], scale: [0.7, 2.6, 0.4] },
        { geo: new THREE.SphereGeometry(0.035, 10, 8), pos: [0.13, -0.13, 0.14], scale: [0.7, 2.9, 0.4] },
      ]), this.matAccent);
      tutu.add(sash);
    }
  }

  /* ---------- 腕（バレエらしいゆるいカーブを形で持たせる） ---------- */
  _buildArms() {
    this.arms = [];
    for (const sx of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * 0.185, SHOULDER_Y, 0);
      this.body.add(shoulder);
      this.arms.push(shoulder);

      const upper = lathe([
        [0.044, -0.235], [0.048, -0.180], [0.054, -0.100], [0.058, -0.030], [0.056, 0.020],
      ], 12);
      shadeBand(upper, { from: 0.02, to: -0.06, dark: 0.72 });
      const upperMesh = new THREE.Mesh(upper, this.matSkin);
      upperMesh.castShadow = true;
      shoulder.add(upperMesh);

      // 前腕はここで固定の角度をつける。動かすのは肩だけ。
      const elbow = new THREE.Group();
      elbow.position.y = -0.235;
      elbow.rotation.set(-0.12, 0, sx * 0.42);
      shoulder.add(elbow);

      const fore = new THREE.Mesh(mergeParts([
        {
          geo: lathe([
            [0.030, -0.215], [0.034, -0.170], [0.040, -0.100], [0.044, -0.030], [0.046, 0.010],
          ], 12),
        },
        // 手：やや平たい楕円で、指の向きをほのめかす
        { geo: new THREE.SphereGeometry(0.052, 10, 8), pos: [0, -0.258, 0], scale: [0.80, 1.30, 0.44] },
        { geo: new THREE.SphereGeometry(0.020, 8, 6), pos: [0.016, -0.310, 0.004], scale: [0.6, 1.5, 0.5] },
        { geo: new THREE.SphereGeometry(0.018, 8, 6), pos: [-0.014, -0.305, 0.004], scale: [0.6, 1.4, 0.5] },
      ]), this.matSkin);
      ensureColors(fore.geometry);
      fore.castShadow = true;
      elbow.add(fore);
    }
  }

  /* ---------- 頭・お顔・髪 ---------- */
  _buildHead() {
    const head = new THREE.Group();
    head.position.y = HEAD_Y;
    this.body.add(head);
    this.head = head;

    const skullGeo = ensureColors(new THREE.SphereGeometry(SKULL_R, 22, 15));
    skullGeo.scale(1.02, 1.0, 0.99);
    const skull = new THREE.Mesh(skullGeo, this.matSkin);
    skull.castShadow = true;
    skull.receiveShadow = true;
    head.add(skull);

    // 口・ほっぺ・まゆは貼り絵で
    const face = new THREE.Mesh(
      new THREE.SphereGeometry(SKULL_R + 0.006, 20, 14, Math.PI / 2 - 0.91, 1.82, 0.90, 1.22),
      new THREE.MeshStandardMaterial({
        map: faceTexture(this.look.faceKind), transparent: true,
        roughness: 0.66, depthWrite: false,
      })
    );
    face.scale.set(1.02, 1.0, 0.99);
    face.renderOrder = 2;
    head.add(face);

    // 目は立体。まばたきは目そのものを縦につぶす（まぶたの殻は髪を突き抜けるのでやめた）
    this.eyes = [];

    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      const ex = sx * 0.132, ey = 0.030;
      const ez = Math.sqrt(Math.max(0.01, SKULL_R * SKULL_R - ex * ex - ey * ey)) - 0.020;
      eye.position.set(ex, ey, ez);
      eye.lookAt(0, ey * 0.4, ez + 1);
      head.add(eye);
      this.eyes.push(eye);

      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 9), this.matEye);
      ball.scale.set(0.86, 1.16, 0.46);
      eye.add(ball);
      const spark = new THREE.Mesh(mergeParts([
        { geo: new THREE.SphereGeometry(0.014, 8, 6), pos: [-sx * 0.015, 0.019, 0.022], scale: [1, 1, 0.5] },
        { geo: new THREE.SphereGeometry(0.0065, 6, 5), pos: [sx * 0.017, -0.019, 0.021], scale: [1, 1, 0.5] },
      ]), this.matSpark);
      eye.add(spark);

    }

    this._buildHair(head);
  }

  _buildHair(head) {
    const L = this.look;
    const HS = [1.02, 1.0, 0.99];             // 頭のつぶし具合に合わせる
    const parts = [];
    // てっぺんを覆うキャップ
    // 頭をひとつづきに覆うかぶりもの。生え際は曲線で切る。
    const style = L.bun === 'high'
      ? { fringe: 1.16, side: 1.50, back: 1.98, teeth: 0.045, seed: 1.3 }
      : L.bun === 'mid'
        ? { fringe: 1.10, side: 1.70, back: 2.10, teeth: 0.060, seed: 2.7 }
        : { fringe: 1.14, side: 1.64, back: 2.06, teeth: 0.050, seed: 0.4 };
    parts.push({
      geo: hairShell({ radius: SKULL_R + 0.024, edge: hairEdge(style) }),
      scale: HS,
    });
    // 前髪のふくらみ（生え際に厚みを持たせる）
    parts.push({
      geo: new THREE.SphereGeometry(0.115, 12, 8),
      pos: [0, 0.230, 0.190], scale: [1.7, 0.62, 0.80],
    });
    // 耳ぎわのおくれ毛
    for (const sx of [-1, 1]) {
      parts.push({
        geo: new THREE.SphereGeometry(0.058, 10, 8),
        pos: [sx * 0.250, -0.055, 0.150], scale: [0.52, 2.1, 0.78], rot: [0.14, sx * 0.30, sx * 0.20],
      });
    }

    // おだんご（球＋巻いた輪）。かならず後頭部につける。
    const bunPos = L.bun === 'high' ? [0, 0.290, -0.145]
      : L.bun === 'mid' ? [0, 0.120, -0.290]
        : [0, -0.055, -0.315];
    parts.push({ geo: new THREE.SphereGeometry(0.105, 14, 10), pos: bunPos, scale: [1.08, 0.92, 1.0] });
    parts.push({
      geo: new THREE.TorusGeometry(0.094, 0.028, 6, 14),
      pos: bunPos, rot: [Math.PI / 2 - 0.30, 0, 0],
    });
    // うなじからおだんごへ、束ねた毛の流れ
    parts.push({
      geo: new THREE.SphereGeometry(0.09, 10, 8),
      pos: [bunPos[0], bunPos[1] * 0.55 - 0.02, bunPos[2] * 0.62],
      scale: [1.25, 1.15, 1.25],
    });

    const hair = new THREE.Mesh(rampByY(mergeParts(parts), -0.24, 0.36), this.matHair);
    hair.castShadow = true;
    head.add(hair);

    // 髪飾り（3人で違う）
    const orn = new THREE.Group();
    if (L.ornament === 'tiara') {
      const tp = [{ geo: new THREE.TorusGeometry(0.255, 0.017, 5, 18, Math.PI * 0.92), pos: [0, 0.175, 0.055], rot: [-0.46, 0, 0] }];
      for (const [dx, dy, dz, r] of [[0, 0.320, 0.185, 0.032], [-0.115, 0.300, 0.160, 0.023], [0.115, 0.300, 0.160, 0.023]]) {
        tp.push({ geo: new THREE.OctahedronGeometry(r, 0), pos: [dx, dy, dz] });
      }
      orn.add(new THREE.Mesh(mergeParts(tp), this.matAccent));
    } else if (L.ornament === 'flower') {
      const fp = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        fp.push({
          geo: new THREE.SphereGeometry(0.042, 10, 8),
          pos: [Math.cos(a) * 0.048, Math.sin(a) * 0.048, 0],
          scale: [1, 1, 0.42],
        });
      }
      const petals = new THREE.Mesh(mergeParts(fp), new THREE.MeshStandardMaterial({
        color: 0xfff2f6, roughness: 0.4, emissive: 0xffd9e8, emissiveIntensity: 0.12,
      }));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), this.matAccent);
      core.scale.z = 0.5;
      petals.add(core);
      petals.position.set(0.145, 0.245, -0.130);
      petals.rotation.set(0.2, 0.7, 0);
      orn.add(petals);
    } else {
      // 大きめリボン
      const bp = [];
      for (const sx of [-1, 1]) {
        bp.push({
          geo: new THREE.SphereGeometry(0.075, 12, 10),
          pos: [sx * 0.085, 0, 0], scale: [1.2, 0.85, 0.42], rot: [0, 0, sx * 0.35],
        });
      }
      bp.push({ geo: new THREE.SphereGeometry(0.030, 10, 8), pos: [0, 0, 0.010], scale: [1, 1, 0.7] });
      const bow = new THREE.Mesh(mergeParts(bp), this.matAccent);
      bow.position.set(0, 0.180, -0.245);
      bow.rotation.set(0.35, 0, 0);
      orn.add(bow);
    }
    head.add(orn);
  }

  /* ---------- 接地と、光を浴びたときの暈 ---------- */
  _buildGround() {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x000000, alphaMap: contactShadowTexture(),
        transparent: true, opacity: 0.52, depthWrite: false, toneMapped: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.014;
    shadow.scale.setScalar(1.15);
    shadow.renderOrder = 2;
    shadow.userData.noReflect = true;
    this.contact = shadow;
    this.group.add(shadow);

    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite('rgba(255,255,255,0.85)', 'rgba(255,255,255,0.22)'),
      color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, toneMapped: false, opacity: 0,
    }));
    this.aura.scale.setScalar(4.2);
    this.aura.position.y = 1.1;
    this.group.add(this.aura);
  }

  /* ============================================================
     動き（入退場・ダンス・おじぎは今までどおり）
     ============================================================ */
  enter(delay = 0) {
    if (this.state !== 'wing') return;
    this.state = 'entering';
    this.enterT = -delay;
  }
  bow() { if (this.state === 'dancing') { this.state = 'bowing'; this.bowT = 0; } }
  dance() { if (this.state === 'standing') this.state = 'dancing'; }

  setSpotlit(v) {
    if (v > 0.5 && this.spotlit <= 0.5) this.joy.kick(6);
    this.spotlit = v;
  }

  // 照明の色と、いま光が当たっている場所（視線用）
  setLightColor(color) { if (color) this.rim.color.value.copy(color); }
  setGaze(x, y) { this.gazeTarget.set(clamp(x, -1, 1), clamp(y, -1, 1)); }

  _updateFace(dt) {
    // まばたき
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = rand(2.4, 6.0);
      this.blink = 1;
    }
    let shut = 0;
    if (this.blink > 0) {
      this.blink = Math.max(0, this.blink - dt / 0.16);
      shut = Math.sin((1 - this.blink) * Math.PI);      // 0→1→0
    }
    const openY = lerp(1, 0.07, shut);

    // 視線（ほんの少しだけ動かす）
    this.gaze.x = damp(this.gaze.x, this.gazeTarget.x, 5, dt);
    this.gaze.y = damp(this.gaze.y, this.gazeTarget.y, 5, dt);
    for (const e of this.eyes) {
      e.rotation.y = this.gaze.x * 0.30;   // 位置は固定、向きだけ動かす
      e.rotation.x = -this.gaze.y * 0.20;
      e.scale.y = openY;
    }
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.joy.target = this.spotlit;
    this.joy.step(dt);
    const joy = clamp(this.joy.value, 0, 1.6);

    this._updateFace(dt);
    this.rim.power.value = 0.16 + joy * 0.42;

    if (this.state === 'entering') {
      this.enterT += dt;
      const k = clamp(this.enterT / 2.0, 0, 1);
      if (k > 0) {
        this.group.position.x = lerp(this.fromX, this.homeX, easeOutCubic(k));
        // とことこ歩く
        const step = Math.sin(this.enterT * 9) * (1 - k);
        this.legs[0].rotation.x = step * 0.6;
        this.legs[1].rotation.x = -step * 0.6;
        this.body.position.y = Math.abs(Math.sin(this.enterT * 9)) * 0.045 * (1 - k);
        this.body.rotation.y = lerp(Math.sign(this.homeX - this.fromX) * 1.3, 0, easeOutCubic(k));
      }
      if (k >= 1) { this.state = 'standing'; this.legs[0].rotation.x = 0; this.legs[1].rotation.x = 0; }
      this._updateGround();
      return;
    }

    if (this.state === 'bowing') {
      this.bowT += dt;
      const k = clamp(this.bowT / 1.1, 0, 1);
      const a = Math.sin(k * Math.PI) * 0.85;
      this.body.rotation.x = a * 0.6;
      this.head.rotation.x = a * 0.35;
      this.arms[0].rotation.z = -a * 0.9;
      this.arms[1].rotation.z = a * 0.9;
      this.arms[0].rotation.x = -a * 0.3;
      this.arms[1].rotation.x = -a * 0.3;
      if (k >= 1) { this.state = 'dancing'; this.body.rotation.x = 0; this.head.rotation.x = 0; }
      this._updateGround();
      return;
    }

    const dancing = this.state === 'dancing';
    const amp = dancing ? 1 : 0.32;
    const sw = Math.sin(t * (dancing ? 2.4 : 1.1));
    const bob = Math.sin(t * (dancing ? 4.8 : 2.2));

    this.body.rotation.z = sw * 0.055 * amp;
    this.body.rotation.y = sw * 0.22 * amp;
    this.body.position.y = (dancing ? Math.abs(bob) * 0.075 : 0) + joy * 0.05 * Math.abs(Math.sin(t * 6));
    this.head.rotation.z = -sw * 0.09 * amp;
    this.head.rotation.y = sw * 0.12 * amp;

    const raise = dancing ? lerp(0.7, 2.1, (Math.sin(t * 2.4) * 0.5 + 0.5)) : 0.52;
    const extra = joy * 0.7;
    // 左腕は -x 側。外へ開くには z を負に回す。
    this.arms[0].rotation.z = -(raise + extra) * 0.9 + sw * 0.25;
    this.arms[1].rotation.z = (raise + extra) * 0.9 + sw * 0.25;
    this.arms[0].rotation.x = -0.15 - joy * 0.2;
    this.arms[1].rotation.x = -0.15 - joy * 0.2;

    // つま先立ちと、チュチュのふわり
    const rise = dancing ? Math.max(0, bob) * 0.5 : 0;
    this.legs[0].rotation.x = -rise * 0.10;
    this.legs[1].rotation.x = rise * 0.10;

    this.skirt.scale.set(1 + Math.abs(sw) * 0.05 * amp, 1, 1 + Math.abs(sw) * 0.05 * amp);
    this.skirt.rotation.y = sw * 0.3 * amp;

    this.aura.material.opacity = joy * 0.5;
    this.aura.scale.setScalar(3.6 + joy * 1.4);
    this._updateGround();
  }

  // 跳ねたら影は薄く大きく。止まれば濃く小さく。
  _updateGround() {
    const lift = clamp(this.body.position.y, 0, 0.2);
    const s = (this.look.scale || 1) * (1.15 + lift * 1.6);
    this.contact.scale.set(s, s, 1);
    this.contact.material.opacity = 0.52 * (1 - lift * 2.2) * clamp(1 - this.spotlit * 0.25, 0.4, 1);
  }

  get worldPos() {
    return new THREE.Vector3(this.group.position.x, 0, this.group.position.z);
  }
}

/* ============================================================
   一座
   ============================================================ */
export class Troupe {
  constructor(theme) {
    this.group = new THREE.Group();
    const spots = [
      { homeX: -2.3, homeZ: -3.0, fromX: -10 },
      { homeX: 0.2, homeZ: -2.2, fromX: 10 },
      { homeX: 2.6, homeZ: -3.2, fromX: 10 },
    ];
    this.members = CAST.map((look, i) => {
      const perf = new Performer(look, spots[i]);
      this.group.add(perf.group);
      return perf;
    });
  }

  enter() { this.members.forEach((m, i) => m.enter(i * 0.55)); }
  dance() { this.members.forEach((m) => m.dance()); }
  bow() { this.members.forEach((m, i) => setTimeout(() => m.bow(), i * 220)); }

  updateSpot(aim, color) {
    for (const m of this.members) {
      const dx = aim.x - m.group.position.x;
      const dz = aim.z - m.group.position.z;
      const d = Math.hypot(dx, dz);
      m.setSpotlit(smoothstep(2.4, 0.9, d));
      m.setLightColor(color);
      // 光のほうをちらりと見る
      m.setGaze(clamp(dx * 0.5, -1, 1), clamp(-dz * 0.25, -1, 1));
    }
  }

  update(dt) { for (const m of this.members) m.update(dt); }
  attractorPoints() { return this.members.map((m) => m.worldPos); }
  get onStage() { return this.members.some((m) => m.state !== 'wing' && m.state !== 'entering'); }
}
