// 地面・穴・地下の土ブロック・空・光。カットアウェイ（局所半透明）もここ。
import * as THREE from '../vendor/three.module.js';
import * as TEX from './textures.js';
import { makeRng, rr, clamp01, lerp, smoothstep } from './util.js';

/* ================= 寸法定数（ゲーム全体の基準） ================= */
export const DIM = {
  BALL_TOP_R: 1.95,   // 根鉢の上面半径（刃の内側に少し隙間をつくる）
  BALL_BOT_R: 0.80,   // 根鉢の底面半径
  BALL_DEPTH: 2.95,   // 根鉢の深さ
  HOLE_R: 2.02,       // 地面に開く穴の半径
  PIT_BOT_R: 1.00,
  SOIL_R: 6.6,        // 地下土ブロックの半径
  SOIL_D: 4.4,        // 地下土ブロックの深さ
  GROUND_R: 58,
};

/* ================= 土質 ================= */
export const SOIL_TYPES = {
  kuroboku: { name: 'くろつち', color: [84, 64, 47], wet: [96, 72, 51], crumb: 1.15, grain: 0.9, pitch: 0.92, seed: 3 },
  akatsuchi: { name: 'あかつち', color: [138, 84, 55], wet: [148, 88, 56], crumb: 0.85, grain: 0.7, pitch: 1.0, seed: 8 },
  sandy: { name: 'すなつち', color: [162, 133, 95], wet: [156, 124, 88], crumb: 1.5, grain: 1.3, pitch: 1.12, seed: 14 },
};

/* ================= カットアウェイ（共有ユニフォーム） ================= */
/* 地面を「輪切り」にして地中を見せる。
   半透明の重ね合わせではなく、カメラ手前側の半分を discard で切り落とす
   ＝ 本物の断面。透明ソートの破綻がなく、因果が一目で分かる。 */
export const cutU = {
  center: { value: new THREE.Vector3(0, 0, 0) },
  dir: { value: new THREE.Vector3(0, 0, 1) },   // サイト → カメラ の水平方向
  radius: { value: 5.6 },
  wedge: { value: 0.98 },      // 切り取る扇の半角（ラジアン）
  amount: { value: 0.0 },
};

export function applyCutaway(material, wedgeScale = 1.0) {
  material.userData.cutWedgeScale = { value: wedgeScale };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCutWedgeScale = material.userData.cutWedgeScale;
    shader.uniforms.uCutCenter = cutU.center;
    shader.uniforms.uCutDir = cutU.dir;
    shader.uniforms.uCutRadius = cutU.radius;
    shader.uniforms.uCutWedge = cutU.wedge;
    shader.uniforms.uCutAmount = cutU.amount;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutWP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vCutWP = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;
        #else
          vCutWP = (modelMatrix * vec4(transformed,1.0)).xyz;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vCutWP;
        uniform vec3 uCutCenter; uniform vec3 uCutDir;
        uniform float uCutRadius; uniform float uCutWedge; uniform float uCutAmount;
        uniform float uCutWedgeScale;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if (uCutAmount > 0.002) {
        vec2 rel = vCutWP.xz - uCutCenter.xz;
        float dcut = length(rel);
        vec2 cd = normalize(uCutDir.xz + vec2(1e-5));
        float ca = dot(normalize(rel + vec2(1e-6)), cd);
        float halfW = uCutAmount * uCutWedge * uCutWedgeScale;
        if (dcut < uCutRadius && (ca > cos(halfW) || dcut < 0.04)) discard;
      }`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      if (uCutAmount > 0.002) {
        vec2 rel2 = vCutWP.xz - uCutCenter.xz;
        float d2 = length(rel2);
        vec2 cd2 = normalize(uCutDir.xz + vec2(1e-5));
        float ca2 = dot(normalize(rel2 + vec2(1e-6)), cd2);
        float hw = uCutAmount * uCutWedge * uCutWedgeScale;
        float edge = smoothstep(cos(hw + 0.14), cos(hw), ca2) * step(d2, uCutRadius);
        gl_FragColor.rgb *= mix(1.0, 0.5, edge);
      }`);
  };
  material.customProgramCacheKey = () => 'cut' + wedgeScale;
  return material;
}

export function setCutaway(center, amount, radius, camPos) {
  if (center) cutU.center.value.copy(center);
  if (radius !== undefined) cutU.radius.value = radius;
  cutU.amount.value = amount;
  if (camPos) {
    cutU.dir.value.set(camPos.x - cutU.center.value.x, 0, camPos.z - cutU.center.value.z);
    if (cutU.dir.value.lengthSq() < 1e-6) cutU.dir.value.set(0, 0, 1);
    cutU.dir.value.normalize();
  }
}

/* ================= サイト（掘る場所） ================= */
export class Site {
  constructor(world, pos, soilType) {
    this.world = world;
    this.pos = pos.clone();
    this.soil = soilType;
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    world.scene.add(this.group);
    this.hasHole = false;
    this._build();
  }

  _build() {
    const s = this.soil;
    const soilMap = TEX.soilTexture(s.seed, s.color, 0);
    const soilBump = TEX.soilBumpTexture(s.seed);
    soilMap.repeat.set(2.4, 2.4);

    const strata = TEX.strataTexture(s.seed, s.color);
    strata.repeat.set(7, 1);
    const wallMat = applyCutaway(new THREE.MeshStandardMaterial({
      map: strata, bumpMap: soilBump, bumpScale: 0.5,
      roughness: 0.98, metalness: 0.0, side: THREE.DoubleSide,
    }));
    this.wallMat = wallMat;
    const flatMat = applyCutaway(new THREE.MeshStandardMaterial({
      map: soilMap, bumpMap: soilBump, bumpScale: 0.5,
      roughness: 0.98, metalness: 0.0, side: THREE.DoubleSide,
      color: new THREE.Color(0.80, 0.78, 0.76),
    }));
    this.flatMat = flatMat;

    const pitMat = applyCutaway(new THREE.MeshStandardMaterial({
      map: TEX.soilTexture(s.seed, s.wet, 0.15), bumpMap: soilBump, bumpScale: 0.85,
      roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide,
    }));
    pitMat.map.repeat.set(2.0, 1.4);
    this.pitMat = pitMat;

    const D = DIM;
    // 地下の土ブロック外周
    const outer = new THREE.Mesh(
      new THREE.CylinderGeometry(D.SOIL_R, D.SOIL_R * 0.94, D.SOIL_D, 44, 1, true), wallMat);
    outer.position.y = -D.SOIL_D / 2;
    this.group.add(outer);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(D.SOIL_R * 0.94, 44), flatMat);
    bottom.rotation.x = -Math.PI / 2; bottom.position.y = -D.SOIL_D + 0.001;
    this.group.add(bottom);
    // 地表直下（草の下の土）
    const topRing = new THREE.Mesh(new THREE.RingGeometry(D.HOLE_R, D.SOIL_R, 44, 1), flatMat);
    topRing.rotation.x = -Math.PI / 2; topRing.position.y = -0.02;
    this.group.add(topRing);

    // 穴（内側）
    const pitWallGeo = makeConeWallGeometry(D.HOLE_R, D.PIT_BOT_R, D.BALL_DEPTH, 40, 8, 0.045, s.seed + 2);
    this.pitWall = new THREE.Mesh(pitWallGeo, pitMat);
    this.pitWall.receiveShadow = true;
    this.group.add(this.pitWall);
    this.pitFloor = new THREE.Mesh(new THREE.CircleGeometry(D.PIT_BOT_R * 1.02, 26), pitMat);
    this.pitFloor.rotation.x = -Math.PI / 2;
    this.pitFloor.position.y = -D.BALL_DEPTH + 0.01;
    this.group.add(this.pitFloor);

    // 穴のふち（土の唇）— 穴が開いた後に見える
    const rimMat = applyCutaway(new THREE.MeshStandardMaterial({
      map: TEX.soilTexture(s.seed, s.color, 0.05), bumpMap: soilBump, bumpScale: 0.6,
      roughness: 1.0, metalness: 0,
    }));
    rimMat.map.repeat.set(6, 1);
    this.rim = new THREE.Mesh(makeRimGeometry(D.HOLE_R, 0.34, 0.10, s.seed + 5), rimMat);
    this.rim.visible = false;
    this.rim.receiveShadow = true;
    this.group.add(this.rim);

    // 地割れデカール
    const crackMat = new THREE.MeshBasicMaterial({
      map: TEX.crackTexture(s.seed + 9), transparent: true, opacity: 0,
      depthWrite: false, color: 0x1a1108, blending: THREE.NormalBlending,
    });
    this.crackMat = crackMat;
    this.crack = new THREE.Mesh(new THREE.PlaneGeometry(D.HOLE_R * 5.0, D.HOLE_R * 5.0), crackMat);
    this.crack.rotation.x = -Math.PI / 2;
    this.crack.position.y = 0.012;
    this.crack.renderOrder = 3;
    this.crack.visible = false;
    this.group.add(this.crack);

    // 濡れ（水やり用）
    const wetMat = new THREE.MeshBasicMaterial({
      map: TEX.radialTexture(0.18, s.seed), transparent: true, opacity: 0,
      depthWrite: false, color: 0x120b06, blending: THREE.NormalBlending,
    });
    this.wetMat = wetMat;
    this.wet = new THREE.Mesh(new THREE.PlaneGeometry(D.HOLE_R * 3.2, D.HOLE_R * 3.2), wetMat);
    this.wet.rotation.x = -Math.PI / 2;
    this.wet.position.y = 0.022;
    this.wet.renderOrder = 4;
    this.wet.visible = false;
    this.group.add(this.wet);

    // 水たまり
    const puddleMat = new THREE.MeshStandardMaterial({
      color: 0x1d2a33, transparent: true, opacity: 0, roughness: 0.03, metalness: 0.18,
      depthWrite: false,
    });
    this.puddleMat = puddleMat;
    this.puddle = new THREE.Mesh(new THREE.CircleGeometry(1.0, 30), puddleMat);
    this.puddle.rotation.x = -Math.PI / 2;
    this.puddle.position.y = 0.030;
    this.puddle.renderOrder = 5;
    this.puddle.visible = false;
    this.group.add(this.puddle);

    // 草の房（刃が入ると少し持ち上がる）
    this._buildGrassTufts();
  }

  _buildGrassTufts() {
    const rng = makeRng(91 + this.soil.seed);
    const N = 130;
    const geo = grassTuftGeometry();
    const mat = applyCutaway(new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
      map: TEX.grassBladeTexture(), alphaTest: 0.42,
    }));
    const inst = new THREE.InstancedMesh(geo, mat, N);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    inst.castShadow = false; inst.receiveShadow = true;
    this.tufts = [];
    const D = DIM;
    for (let i = 0; i < N; i++) {
      const a = rng() * Math.PI * 2;
      const r = D.HOLE_R * 1.03 + Math.pow(rng(), 0.6) * 2.6;
      this.tufts.push({
        a, r, y: 0, sc: rr(rng, 0.7, 1.35), rot: rr(rng, 0, Math.PI),
        lift: 0, tilt: 0,
      });
    }
    this.tuftMesh = inst;
    this.group.add(inst);
    this._updateTufts();
  }

  _updateTufts() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < this.tufts.length; i++) {
      const t = this.tufts[i];
      v.set(Math.cos(t.a) * (t.r + t.tilt * 0.10), t.y + t.lift * 0.16, Math.sin(t.a) * (t.r + t.tilt * 0.10));
      e.set(t.tilt * 0.5, t.rot, Math.cos(t.a) * t.tilt * 0.35);
      q.setFromEuler(e);
      sc.set(t.sc, t.sc * (1 + t.lift * 0.12), t.sc);
      m.compose(v, q, sc);
      this.tuftMesh.setMatrixAt(i, m);
    }
    this.tuftMesh.instanceMatrix.needsUpdate = true;
  }

  // 特定の方位角付近の草を持ち上げる
  disturbGrass(azimuth, amount) {
    let changed = false;
    for (const t of this.tufts) {
      let d = Math.abs(((t.a - azimuth + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const w = 1 - smoothstep(0.35, 1.0, d);
      if (w <= 0.001) continue;
      const target = w * amount;
      if (Math.abs(target - t.lift) > 0.005) { t.lift = Math.max(t.lift, target); t.tilt = t.lift; changed = true; }
    }
    if (changed) this._updateTufts();
  }
  settleGrass(dt) {
    let changed = false;
    for (const t of this.tufts) {
      if (t.lift > 0.001) { t.lift *= Math.exp(-dt * 1.4); t.tilt = t.lift; changed = true; }
    }
    if (changed) this._updateTufts();
  }

  openHole() { this.hasHole = true; this.rim.visible = true; }
  closeHole() { this.hasHole = false; this.rim.visible = false; }

  setCrack(v) {
    this.crack.visible = v > 0.002;
    this.crackMat.opacity = clamp01(v) * 0.48;
  }
  setWet(v) {
    this.wet.visible = v > 0.002;
    this.wetMat.opacity = clamp01(v) * 0.50;
  }
  setPuddle(v, radius = 1.0) {
    this.puddle.visible = v > 0.002;
    this.puddleMat.opacity = clamp01(v) * 0.40;
    this.puddle.scale.setScalar(Math.max(0.05, radius));
  }
}

/* ================= 幾何ヘルパ ================= */
// 円錐台の側面（内外どちらからも見える、少しデコボコ）
export function makeConeWallGeometry(rTop, rBot, depth, radial, rows, jitter, seed) {
  const rng = makeRng(seed);
  const pos = [], nor = [], uv = [], idx = [];
  const noise = [];
  for (let j = 0; j <= rows; j++) {
    noise[j] = [];
    for (let i = 0; i <= radial; i++) {
      noise[j][i] = i === radial ? noise[j][0] : (rng() - 0.5) * 2;
    }
  }
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const y = -depth * v;
    const r0 = lerp(rTop, rBot, v);
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      const r = r0 + noise[j][i] * jitter * (0.4 + v * 0.9);
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      const n = new THREE.Vector3(Math.cos(a), (rTop - rBot) / depth, Math.sin(a)).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(i / radial, v);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < radial; i++) {
    const a = j * (radial + 1) + i, b = a + 1, c = a + radial + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 穴のふち（盛り上がった土のリップ）
function makeRimGeometry(r, width, height, seed) {
  const rng = makeRng(seed);
  const radial = 46, pos = [], uv = [], idx = [];
  const prof = [
    [0.0, 0.0], [0.30, height * 0.9], [0.62, height * 1.0], [1.0, -0.02],
  ];
  const nz = [];
  for (let i = 0; i <= radial; i++) nz.push(i === radial ? nz[0] : rr(rng, 0.65, 1.35));
  for (let k = 0; k < prof.length; k++) {
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      const rr2 = r + prof[k][0] * width * nz[i];
      const y = prof[k][1] * nz[i];
      pos.push(Math.cos(a) * rr2, y, Math.sin(a) * rr2);
      uv.push(i / radial * 3, k / (prof.length - 1));
    }
  }
  for (let k = 0; k < prof.length - 1; k++) for (let i = 0; i < radial; i++) {
    const a = k * (radial + 1) + i, b = a + 1, c = a + radial + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function grassTuftGeometry() {
  // 十字の板 2 枚。法線は上向きに固定して、地面と同じように明るく光らせる。
  const g1 = new THREE.PlaneGeometry(0.42, 0.34, 1, 1).translate(0, 0.17, 0);
  const g2 = g1.clone().rotateY(Math.PI / 2);
  const merged = mergeGeoms([g1, g2]);
  const n = merged.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  n.needsUpdate = true;
  return merged;
}

export function mergeGeoms(list) {
  let vCount = 0, iCount = 0;
  for (const g of list) { vCount += g.attributes.position.count; iCount += g.index ? g.index.count : 0; }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const hasColor = list.every((g) => g.attributes.color);
  const col = hasColor ? new Float32Array(vCount * 3) : null;
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    pos.set(p.array, vo * 3);
    if (n) nor.set(n.array, vo * 3);
    if (u) uv.set(u.array, vo * 2);
    if (hasColor) col.set(g.attributes.color.array, vo * 3);
    if (g.index) { const gi = g.index.array; for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo; io += gi.length; }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (hasColor) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (iCount) out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/* ================= 環境マップ ================= */
function buildEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  // 空
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(40, 20, 14),
    new THREE.MeshBasicMaterial({ map: TEX.skyTexture(), side: THREE.BackSide }));
  s.add(sky);
  // 地面の照り返し
  const gd = new THREE.CircleGeometry(60, 24).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gd, new THREE.MeshBasicMaterial({ color: 0x64703f }));
  ground.position.y = -8;
  s.add(ground);
  // 太陽（輝度 > 1）
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  sunMat.color.setRGB(9, 8.4, 7.0);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(4.4, 10, 8), sunMat);
  sun.position.set(20, 26, 15);
  s.add(sun);
  const tex = pmrem.fromScene(s, 0.03).texture;
  pmrem.dispose();
  sky.geometry.dispose(); gd.dispose(); sun.geometry.dispose();
  return tex;
}

/* ================= 世界 ================= */
export class World {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcfe0ea, 52, 138);

    // 空
    const skyGeo = new THREE.SphereGeometry(190, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: TEX.skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    // 環境マップ（金属・塗装のために必須）
    this.scene.environment = buildEnvironment(renderer);
    this.scene.environmentIntensity = 0.68;

    // 光
    this.hemi = new THREE.HemisphereLight(0xbcd8f0, 0x7d6a50, 0.58);
    this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffffff, 0.17);
    this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
    this.sun.position.set(14, 20, 11);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.near = 1; sc.far = 70; sc.left = -16; sc.right = 16; sc.top = 18; sc.bottom = -14;
    this.sun.shadow.bias = -0.0012;
    this.sun.shadow.normalBias = 0.045;
    this.scene.add(this.sun);
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;

    // カットアウェイ中に地中を照らす補助光
    this.cutLight = new THREE.PointLight(0xffeccd, 0, 14, 1.1);
    this.cutLight.position.set(0, -0.8, 0);
    this.scene.add(this.cutLight);
    this.cutLight2 = new THREE.PointLight(0xdcefff, 0, 9, 1.4);
    this.cutLight2.position.set(0, -2.2, 0);
    this.scene.add(this.cutLight2);

    this.sites = [];
    this.props = new THREE.Group();
    this.scene.add(this.props);
  }

  buildGround(holePositions, grassTone, soilType) {
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
    }
    const D = DIM;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, D.GROUND_R, 0, Math.PI * 2, false);
    for (const p of holePositions) {
      const h = new THREE.Path();
      h.absarc(p.x, -p.z, D.HOLE_R, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
    const geo = new THREE.ShapeGeometry(shape, 128);
    geo.rotateX(-Math.PI / 2);
    // UV を平面座標から再生成
    const pa = geo.attributes.position;
    const uvs = new Float32Array(pa.count * 2);
    for (let i = 0; i < pa.count; i++) {
      uvs[i * 2] = pa.getX(i) / 3.6;
      uvs[i * 2 + 1] = pa.getZ(i) / 3.6;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.computeVertexNormals();

    const gmap = TEX.grassTexture(11, grassTone);
    gmap.repeat.set(1, 1);
    const mat = applyCutaway(new THREE.MeshStandardMaterial({
      map: gmap, roughness: 0.97, metalness: 0.0,
    }));
    this.groundMat = mat;
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.receiveShadow = true;
    this.ground.renderOrder = 1;
    this.scene.add(this.ground);
  }

  addSite(pos, soilType) {
    const s = new Site(this, pos, soilType);
    this.sites.push(s);
    return s;
  }

  clearSites() {
    for (const s of this.sites) this.scene.remove(s.group);
    this.sites.length = 0;
  }

  setCutLight(center, amount) {
    this.cutLight.intensity = amount * 30;
    this.cutLight.position.set(center.x + 1.4, -0.9, center.z + 2.2);
    this.cutLight2.intensity = amount * 10;
    this.cutLight2.position.set(center.x - 1.2, -2.3, center.z - 1.4);
  }

  focusShadow(p) {
    this.sun.position.set(p.x + 14, 20, p.z + 11);
    this.sunTarget.position.set(p.x, 1.5, p.z);
    this.sunTarget.updateMatrixWorld();
  }
}
