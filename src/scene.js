/**
 * せかい：そら・ひかり・くさはら・とおくの おか・き・くも
 * それと、たて／よこ どちらの がめんでも きれいに おさまる カメラ。
 */
import * as THREE from 'three';
import { AREA } from './terrain.js';
import { clamp, lerp, invLerp, damp, roundedBox, matteMaterial, makeNoise, mergeStatic, bakeStatic, DEG } from './util.js';

export const SKY_TOP = new THREE.Color('#7fc7ee');
export const SKY_MID = new THREE.Color('#bfe4f5');
export const SKY_LOW = new THREE.Color('#ffe6bf');

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(SKY_MID, 1);
  return renderer;
}

/* ---------------- そら ---------------- */

function makeSky() {
  const geo = new THREE.SphereGeometry(200, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: SKY_TOP },
      mid: { value: SKY_MID },
      low: { value: SKY_LOW },
      sunDir: { value: new THREE.Vector3(13, 9.2, 10).normalize() },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 top, mid, low;
      uniform vec3 sunDir;
      void main() {
        float h = clamp(vDir.y * 1.15 + 0.06, -1.0, 1.0);
        vec3 c = mix(low, mid, smoothstep(-0.06, 0.36, h));
        c = mix(c, top, smoothstep(0.28, 0.95, h));
        // たいようの まわりの ふんわりした ひかり
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += vec3(1.0, 0.88, 0.66) * pow(s, 8.0) * 0.30;
        c += vec3(1.0, 0.94, 0.80) * pow(s, 180.0) * 0.9;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  return sky;
}

/* ---------------- くも ---------------- */

function makeClouds() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, metalness: 0,
    transparent: true, opacity: 0.95, fog: false,
    emissive: new THREE.Color('#dceeff'), emissiveIntensity: 0.25,
  });
  const geo = new THREE.SphereGeometry(1, 11, 8);
  const rnd = makeNoise(7);
  const defs = [
    [-32, 20, -44, 1.5], [18, 25, -52, 1.9], [44, 17, -30, 1.2],
    [-46, 22, -14, 1.35], [8, 28, -70, 2.3], [-14, 19, -64, 1.15],
    [56, 24, -60, 1.7], [-60, 26, -52, 1.5],
  ];
  for (const [x, y, z, s] of defs) {
    const puff = new THREE.Group();
    const n = 5 + Math.floor(Math.abs(rnd(x, z)) * 8);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      const a = (i / n) * Math.PI * 2;
      m.position.set(Math.cos(a) * (1.5 + rnd(i, x) * 1.6) * 1.9,
                     Math.abs(rnd(i * 3, z)) * 1.5,
                     Math.sin(a) * (0.8 + rnd(i, z) * 0.8));
      const r = 1.5 + Math.abs(rnd(i * 7, x * 0.3)) * 1.7;
      m.scale.set(r, r * 0.72, r);
      puff.add(m);
    }
    bakeStatic(puff);           // 1つの メッシュに まとめる
    puff.position.set(x, y, z);
    puff.scale.setScalar(s);
    puff.userData.speed = 0.12 + Math.abs(rnd(x, y)) * 0.16;
    for (const c of puff.children) { c.castShadow = false; c.receiveShadow = false; }
    group.add(puff);
  }
  group.userData.tick = (dt) => {
    for (const p of group.children) {
      p.position.x += p.userData.speed * dt;
      if (p.position.x > 90) p.position.x = -90;
    }
  };
  return group;
}

/* ---------------- くさはら と けしき ---------------- */

function makeGround() {
  const group = new THREE.Group();

  // どうろの ぶんだけ あなを あけた くさはら
  // Shape は XY へいめん。rotateX(-90°) で world.z = -shape.y に なる。
  const sy = (z) => -z;
  const shape = new THREE.Shape();
  const S = 120;
  shape.moveTo(-S, -S); shape.lineTo(S, -S); shape.lineTo(S, S); shape.lineTo(-S, S); shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(AREA.minX, sy(AREA.minZ));
  hole.lineTo(AREA.minX, sy(AREA.maxZ));
  hole.lineTo(AREA.maxX, sy(AREA.maxZ));
  hole.lineTo(AREA.maxX, sy(AREA.minZ));
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#8fc46a', roughness: 0.98, metalness: 0 });
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  ground.position.y = 0;
  group.add(ground);

  // どうろぎわの すこし こい くさ（ふちどり）
  const shoulderShape = new THREE.Shape();
  const ox = AREA.maxX + 1.25, oz = AREA.maxZ + 1.25;
  shoulderShape.moveTo(-ox, -oz); shoulderShape.lineTo(ox, -oz);
  shoulderShape.lineTo(ox, oz); shoulderShape.lineTo(-ox, oz); shoulderShape.closePath();
  const shoulderHole = new THREE.Path();
  shoulderHole.moveTo(AREA.minX, sy(AREA.minZ));
  shoulderHole.lineTo(AREA.minX, sy(AREA.maxZ));
  shoulderHole.lineTo(AREA.maxX, sy(AREA.maxZ));
  shoulderHole.lineTo(AREA.maxX, sy(AREA.minZ));
  shoulderHole.closePath();
  shoulderShape.holes.push(shoulderHole);
  const shoulderGeo = new THREE.ShapeGeometry(shoulderShape);
  shoulderGeo.rotateX(-Math.PI / 2);
  const shoulder = new THREE.Mesh(shoulderGeo, new THREE.MeshStandardMaterial({
    color: '#7db358', roughness: 1, metalness: 0,
  }));
  shoulder.position.y = 0.008;
  shoulder.receiveShadow = true;
  group.add(shoulder);

  return group;
}

function makeHills() {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const defs = [
    [-52, -74, 22, 9, '#7fb96a'], [-14, -92, 30, 12, '#8ec178'],
    [30, -80, 26, 10, '#79b268'], [70, -96, 34, 13, '#95c983'],
    [-92, -66, 20, 8, '#8ec178'], [96, -70, 24, 9, '#7fb96a'],
    [4, -120, 44, 17, '#a6d295'],
  ];
  for (const [x, z, r, h, c] of defs) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0 }));
    m.scale.set(r, h, r * 0.9);
    m.position.set(x, -0.6, z);
    m.castShadow = false;
    m.receiveShadow = false;
    group.add(m);
  }
  return group;
}

// けしきの マテリアルは つかいまわす（メッシュを まとめる ため）
const M = {
  trunk: matteMaterial('#8b6a4a', { roughness: 0.95 }),
  leaf: ['#63b45c', '#54a552', '#77c268'].map((c) => matteMaterial(c, { roughness: 0.96 })),
  bush: matteMaterial('#6fb85f', { roughness: 0.98 }),
  coneBase: matteMaterial('#e8622c', { roughness: 0.7 }),
  coneBody: matteMaterial('#f4762f', { roughness: 0.6 }),
  coneBand: matteMaterial('#fdf6e6', { roughness: 0.6 }),
};

function makeTree(scale = 1, tone = 0) {
  const g = new THREE.Group();
  const trunkMat = M.trunk;
  const leafMat = M.leaf[tone % M.leaf.length];

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.3, 9), trunkMat);
  trunk.position.y = 0.65;
  trunk.castShadow = true; trunk.receiveShadow = true;
  g.add(trunk);

  const blobGeo = new THREE.SphereGeometry(1, 11, 8);
  const blobs = [[0, 1.85, 0, 0.95], [0.55, 1.55, 0.2, 0.66], [-0.5, 1.6, -0.25, 0.6], [0.05, 2.4, -0.1, 0.6]];
  for (const [x, y, z, r] of blobs) {
    const b = new THREE.Mesh(blobGeo, leafMat);
    b.position.set(x, y, z);
    b.scale.set(r, r * 0.92, r);
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  }
  g.scale.setScalar(scale);
  return g;
}

function makeBush(scale = 1) {
  const g = new THREE.Group();
  const mat = M.bush;
  const geo = new THREE.SphereGeometry(1, 10, 7);
  for (const [x, y, z, r] of [[0, 0.3, 0, 0.45], [0.38, 0.24, 0.1, 0.32], [-0.32, 0.22, -0.12, 0.3]]) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.setScalar(r);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  g.scale.setScalar(scale);
  return g;
}

function makeCone() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(roundedBox(0.44, 0.07, 0.44, 0.03), M.coneBase);
  base.position.y = 0.035;
  base.castShadow = true; base.receiveShadow = true;
  g.add(base);
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.52, 14), M.coneBody);
  body.position.y = 0.30;
  body.castShadow = true;
  g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.116, 0.135, 0.1, 14), M.coneBand);
  band.position.y = 0.30;
  g.add(band);
  return g;
}

function makeFlowerField() {
  // くさの ツンツン と おはな を インスタンスで
  const group = new THREE.Group();
  const rnd = makeNoise(99);
  const bladeGeo = new THREE.ConeGeometry(0.075, 0.22, 5);
  bladeGeo.translate(0, 0.11, 0);
  const bladeMat = matteMaterial('#84c96a', { roughness: 1 });
  const COUNT = 620;
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, COUNT);
  blades.castShadow = false;
  blades.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < COUNT * 3 && n < COUNT; i++) {
    const x = (rnd(i * 0.7, 3.1) * 2) * 26;
    const z = (rnd(5.5, i * 0.31) * 2) * 16 + 2;
    if (x > AREA.minX - 1.4 && x < AREA.maxX + 1.4 && z > AREA.minZ - 1.4 && z < AREA.maxZ + 1.4) continue;
    if (Math.abs(x) > 30 || z < -22 || z > 22) continue;
    pos.set(x, 0, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd(i, 9) * 6.28);
    scl.setScalar(0.7 + Math.abs(rnd(i * 2, 1)) * 0.9);
    m.compose(pos, q, scl);
    blades.setMatrixAt(n++, m);
  }
  blades.count = n;
  blades.instanceMatrix.needsUpdate = true;
  group.add(blades);

  // おはな（クリア えんしゅつで ふえる）
  const petalGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const flowerColors = ['#ff8fb1', '#ffd166', '#fff3f7', '#c39bff'];
  group.userData.flowers = [];
  for (let f = 0; f < 4; f++) {
    const mat = matteMaterial(flowerColors[f], { roughness: 0.8 });
    const inst = new THREE.InstancedMesh(petalGeo, mat, 46);
    inst.count = 0;
    inst.castShadow = false;
    group.add(inst);
    group.userData.flowers.push(inst);
  }
  // さく ばしょは さきに ランダムに きめて おく（きれいに ちらばる ように）
  const spots = group.userData.flowers.map((_, fi) => {
    const list = [];
    for (let i = 0; i < 46; i++) {
      const side = (i % 2 === 0) ? 1 : -1;
      const rx = rnd(fi * 3.7 + i * 0.83, 1.3);
      const rz = rnd(2.9, fi * 1.7 + i * 0.61);
      const rs = rnd(fi * 0.5 + i * 1.13, 7.7);
      const x = lerp(AREA.minX - 0.6, AREA.maxX + 0.6, (i / 46 + rx * 0.35 + 1) % 1);
      const z = side * (AREA.maxZ + 0.45 + Math.abs(rz) * 2.2);
      list.push([x, 0.1 + Math.abs(rs) * 0.18, z, 0.75 + Math.abs(rx) * 1.1]);
    }
    return list;
  });
  group.userData.bloom = (t) => {
    // t: 0..1 で おはなが さいて いく
    const mm = new THREE.Matrix4();
    const qq = new THREE.Quaternion();
    const pp = new THREE.Vector3();
    const ss = new THREE.Vector3();
    group.userData.flowers.forEach((inst, fi) => {
      const target = Math.floor(clamp(t, 0, 1) * 46);
      for (let i = 0; i < target; i++) {
        const [x, y, z, sc] = spots[fi][i];
        // さいた ばかりは ちいさく、ぷくっと ふくらむ
        const age = clamp(t * 46 - i, 0, 1);
        pp.set(x, y * age, z);
        ss.setScalar(sc * (0.3 + 0.7 * age));
        mm.compose(pp, qq, ss);
        inst.setMatrixAt(i, mm);
      }
      inst.count = target;
      inst.instanceMatrix.needsUpdate = true;
    });
  };
  return group;
}

export function buildWorld(scene) {
  scene.background = SKY_MID.clone();
  scene.fog = new THREE.Fog(new THREE.Color('#d3e8f2'), 34, 150);

  const sky = makeSky();
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(new THREE.Color('#cfe9ff'), new THREE.Color('#caa982'), 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(new THREE.Color('#fff2d2'), 3.2);
  sun.position.set(13.0, 9.2, 10.0);
  sun.castShadow = true;
  const S = 16;
  sun.shadow.camera.left = -S;
  sun.shadow.camera.right = S;
  sun.shadow.camera.top = S;
  sun.shadow.camera.bottom = -S;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0011;
  sun.shadow.normalBias = 0.035;
  const shadowSize = Math.min(2048, (window.devicePixelRatio || 1) > 1 && Math.min(window.innerWidth, window.innerHeight) < 500 ? 1024 : 2048);
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0, 0, 1);

  const fill = new THREE.DirectionalLight(new THREE.Color('#bcd9ff'), 0.42);
  fill.position.set(-11, 7, -8);
  scene.add(fill);

  // うしろから の あたたかい ふちどり（りんかくが たつ）
  const rim = new THREE.DirectionalLight(new THREE.Color('#ffd9a0'), 0.55);
  rim.position.set(-6, 5, -13);
  scene.add(rim);

  scene.add(makeGround());
  scene.add(makeHills());

  const clouds = makeClouds();
  scene.add(clouds);

  const flowers = makeFlowerField();
  scene.add(flowers);

  // き と しげみ
  const decor = new THREE.Group();
  const treeSpots = [
    [-13.5, -6.2, 1.05, 0], [-10.6, -8.4, 0.85, 1], [12.8, -6.6, 1.1, 2],
    [15.5, -9.0, 0.9, 0], [-16.5, 2.5, 1.0, 1], [17.0, 3.4, 0.95, 2],
    [-12.0, 9.5, 0.8, 2], [13.4, 10.4, 0.9, 1], [-19.5, -3.5, 1.2, 0],
    [20.5, -2.0, 1.15, 1], [-8.5, 14.0, 0.75, 0], [7.5, 15.0, 0.8, 2],
  ];
  for (const [x, z, s, t] of treeSpots) {
    const tr = makeTree(s, t);
    tr.position.set(x, 0, z);
    tr.rotation.y = x * 1.7;
    decor.add(tr);
  }
  for (const [x, z, s] of [[-9.6, -5.0, 1], [10.2, -5.4, 0.9], [-11.2, 5.5, 1.1], [11.6, 6.3, 1], [-6.0, -6.6, 0.8], [5.2, -6.8, 0.85]]) {
    const b = makeBush(s);
    b.position.set(x, 0, z);
    decor.add(b);
  }
  // コーン（こうじちゅう の しるし）
  for (const [x, z] of [[AREA.minX - 0.9, AREA.minZ - 0.7], [AREA.minX - 0.9, AREA.maxZ + 0.7],
                        [AREA.maxX + 0.9, AREA.minZ - 0.7], [AREA.maxX + 0.9, AREA.maxZ + 0.7],
                        [0, AREA.minZ - 1.0], [-4.2, AREA.minZ - 1.0], [4.2, AREA.minZ - 1.0]]) {
    const c = makeCone();
    c.position.set(x, 0, z);
    decor.add(c);
  }
  scene.add(mergeStatic(decor));   // き・しげみ・コーンを まとめて かるく

  return {
    sun, hemi, sky, clouds, flowers,
    tick(dt) { clouds.userData.tick(dt); },
  };
}

/* ---------------- カメラ ---------------- */

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 400);
    this.target = new THREE.Vector3(0.4, 0.5, 1.6);
    this.focus = this.target.clone();
    this.roi = new THREE.Box3(new THREE.Vector3(-8, 0, -3), new THREE.Vector3(8, 2.2, 6.5));
    this.roiTarget = this.roi.clone();
    this.aspect = 1;
    this.time = 0;
    this.dist = 20;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this.shake = 0;
  }

  /** よこ画面ようと たて画面ようの わくを アスペクトで まぜる */
  setROI(land, portrait) {
    const p = portrait || land;
    const t = clamp(invLerp(0.60, 1.30, this.aspect), 0, 1); // 0=たて 1=よこ
    this.roiTarget.min.lerpVectors(p.min, land.min, t);
    this.roiTarget.max.lerpVectors(p.max, land.max, t);
    this.target.lerpVectors(p.focus, land.focus, t);
  }

  resize(w, h) {
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
  }

  /** たて画面では みちに そって ななめから みる（ながい どうろが おさまる） */
  _orientation() {
    const t = clamp(invLerp(0.60, 1.30, this.aspect), 0, 1);
    return {
      // たて画面では みちに そって ななめから。よこ画面では ほぼ しょうめん。
      azimuth: lerp(84 * DEG, 12 * DEG, t),
      elevation: lerp(34 * DEG, 19 * DEG, t),
      fov: lerp(56, 40, t),
      // がめんの うえに そらを のこす わりあい
      skyBias: lerp(0.12, 0.09, t),
      portrait: 1 - t,
    };
  }

  update(dt, immediate = false) {
    this.time += dt;
    const k = immediate ? 1 : 1 - Math.exp(-2.2 * dt);
    this.roi.min.lerp(this.roiTarget.min, k);
    this.roi.max.lerp(this.roiTarget.max, k);
    this.focus.lerp(this.target, immediate ? 1 : 1 - Math.exp(-2.6 * dt));

    const o = this._orientation();
    const cam = this.camera;
    if (Math.abs(cam.fov - o.fov) > 0.01) { cam.fov = o.fov; cam.updateProjectionMatrix(); }

    // ゆっくり ゆれる（いきている かんじ）
    const swayA = Math.sin(this.time * 0.16) * 0.9 * DEG;
    const swayE = Math.sin(this.time * 0.21 + 1.1) * 0.6 * DEG;
    const az = o.azimuth + swayA;
    const el = o.elevation + swayE;

    // offset = ちゅうしん → カメラ の むき（+z がわ、ななめ うえ から）
    const offset = new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el)
    ).normalize();
    const dir = offset.clone().negate(); // カメラの みている むき

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, dir).normalize();

    const vfov = o.fov * DEG;
    // うえがわに そらの ぶん の よゆうを もたせる
    const tvFull = Math.tan(vfov / 2);
    const tv = tvFull * (1 - o.skyBias) / 1.05;
    const th = tvFull * this.aspect / 1.04;

    // ROI の 8すみ が わくに おさまる さいしょうきょり
    let d = 6;
    const c = [this.roi.min, this.roi.max];
    const P = new THREE.Vector3();
    const rel = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      P.set(c[i & 1].x, c[(i >> 1) & 1].y, c[(i >> 2) & 1].z);
      rel.copy(P).sub(this.focus);
      const a = rel.dot(right);
      const b = rel.dot(camUp);
      const cc = rel.dot(dir);
      d = Math.max(d, Math.abs(a) / th - cc, Math.abs(b) / tv - cc);
    }
    d = clamp(d, 8, 70);
    this.dist = immediate ? d : damp(this.dist, d, 2.4, dt);

    this._pos.copy(this.focus).addScaledVector(offset, this.dist);
    if (this.shake > 0.0001) {
      const s = this.shake;
      this._pos.x += Math.sin(this.time * 61) * s * 0.06;
      this._pos.y += Math.sin(this.time * 47 + 2) * s * 0.05;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    cam.position.copy(this._pos);
    // すこし うえを むいて、がめんの うえに そらを だす
    this._look.copy(this.focus);
    this._look.y += this.dist * Math.tan(vfov / 2) * o.skyBias;
    cam.lookAt(this._look);
    cam.updateMatrixWorld();
  }

  bump(amount = 1) { this.shake = Math.min(1.4, this.shake + amount); }
}
