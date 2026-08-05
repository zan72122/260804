// きらきら ひょうぞうまつり — 4歳向け 雪像・氷像制作3Dゲーム
import * as THREE from '../vendor/three.module.min.js';
import { SHAPES, BLOCK_DEFS, stackedBlocksSDF, hash3 } from './shapes.js';
import { AudioFX } from './audio.js';

// ---------------------------------------------------------------- 基本設定
const PHASE = { TITLE: 0, STACK: 1, CARVE: 2, BRUSH: 3, ICE: 4, LIGHT: 5, NIGHT: 6, SHOW: 7 };
const PEDESTAL_H = 0.35;

const audio = new AudioFX();
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe0ee, 40, 190);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 800);

const state = {
  phase: PHASE.TITLE,
  shapeKey: null,
  night: 0, nightTarget: 0,
  exposure: 1.0, exposureTarget: 1.0,
  stackCount: 0, stackAnim: null, stackQueue: 0,
  carving: false, lastCarve: 0,
  finishing: false,
  revealT: -1, revealMode: 0, glow: 0, glowTarget: 0,
  fireworkTimer: 0,
  shake: 0,
  celebrating: false,
  musicOn: false,
};

const cam = { yaw: 0.65, yawTarget: 0.65, radius: 10, radiusTarget: 10, height: 3.1, heightTarget: 3.1, lookY: 2.2, lookYTarget: 2.2, zoom: 1 };

// ---------------------------------------------------------------- テクスチャ生成
function makeCanvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const texGlow = makeCanvasTex(128, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
});
const texFlake = makeCanvasTex(64, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
});
const texSnowGround = makeCanvasTex(256, (g, s) => {
  g.fillStyle = '#f2f6fb'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const a = 0.03 + Math.random() * 0.08;
    g.fillStyle = Math.random() < 0.5 ? `rgba(160,185,215,${a})` : `rgba(255,255,255,${a * 2})`;
    const r = 0.5 + Math.random() * 1.6;
    g.beginPath(); g.arc(Math.random() * s, Math.random() * s, r, 0, 7); g.fill();
  }
});
texSnowGround.wrapS = texSnowGround.wrapT = THREE.RepeatWrapping;
texSnowGround.repeat.set(50, 50);
const texBump = makeCanvasTex(256, (g, s) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 3500; i++) {
    const v = 100 + Math.random() * 80;
    g.fillStyle = `rgb(${v},${v},${v})`;
    const r = 0.5 + Math.random() * 2.2;
    g.beginPath(); g.arc(Math.random() * s, Math.random() * s, r, 0, 7); g.fill();
  }
});
texBump.wrapS = texBump.wrapT = THREE.RepeatWrapping;
texBump.repeat.set(50, 50);
texBump.colorSpace = THREE.NoColorSpace;

// ---------------------------------------------------------------- 空
const skyUniforms = {
  uNight: { value: 0 },
  uTime: { value: 0 },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(420, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uNight; uniform float uTime;
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        float h = clamp(vDir.y, -0.05, 1.0);
        vec3 dayTop = vec3(0.42,0.65,0.90), dayHor = vec3(0.91,0.95,0.99);
        vec3 duskTop = vec3(0.25,0.28,0.55), duskHor = vec3(0.95,0.62,0.38);
        vec3 nightTop = vec3(0.012,0.025,0.10), nightHor = vec3(0.06,0.10,0.24);
        float d1 = smoothstep(0.0, 0.55, uNight);
        float d2 = smoothstep(0.45, 1.0, uNight);
        vec3 top = mix(mix(dayTop, duskTop, d1), nightTop, d2);
        vec3 hor = mix(mix(dayHor, duskHor, d1), nightHor, d2);
        vec3 col = mix(hor, top, pow(max(h, 0.0), 0.62));
        // 星
        float nf = smoothstep(0.6, 1.0, uNight);
        if (nf > 0.0 && vDir.y > 0.02) {
          vec2 sp = vDir.xz / (vDir.y + 0.35);
          vec2 cell = floor(sp * 42.0);
          float hh = hash(cell);
          if (hh > 0.90) {
            vec2 c = (cell + 0.5 + (vec2(hash(cell+1.3), hash(cell+2.7))-0.5)*0.8) / 42.0;
            float dist = length(sp - c) * 42.0;
            float tw = 0.6 + 0.4 * sin(uTime * (2.0 + hh * 3.0) + hh * 40.0);
            col += nf * tw * smoothstep(0.10, 0.02, dist) * vec3(0.9, 0.93, 1.0) * (0.5 + hh);
          }
        }
        // 月
        vec3 moonDir = normalize(vec3(0.36, 0.57, -0.74));
        float md = dot(normalize(vDir), moonDir);
        col += nf * (smoothstep(0.9990, 0.99965, md) * vec3(1.0, 0.98, 0.9) * 1.6
                   + pow(smoothstep(0.994, 0.9997, md), 2.0) * vec3(0.55, 0.62, 0.85) * 0.4);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
scene.add(sky);

// ---------------------------------------------------------------- ライト
const sun = new THREE.DirectionalLight(0xfff2dd, 2.3);
sun.position.set(26, 38, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
sun.shadow.bias = -0.0005;
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbcd8ff, 0xe8eef8, 0.9);
scene.add(hemi);

// ---------------------------------------------------------------- 地面・遠景
const groundGeo = new THREE.CircleGeometry(260, 100, 0, Math.PI * 2);
groundGeo.rotateX(-Math.PI / 2);
{
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 7 && r < 60) {
      pos.setY(i, (hash3(x * 0.3, 0, z * 0.3) - 0.5) * 0.5 * Math.min(1, (r - 7) / 8));
    }
  }
  groundGeo.computeVertexNormals();
}
const groundMat = new THREE.MeshStandardMaterial({ color: 0xf0f5fb, roughness: 0.97, metalness: 0, map: texSnowGround, bumpMap: texBump, bumpScale: 0.5 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.receiveShadow = true;
scene.add(ground);

// 台座と氷のステージ
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(3.4, 3.8, PEDESTAL_H, 48),
  new THREE.MeshStandardMaterial({ color: 0xeaf1f9, roughness: 0.92 })
);
pedestal.position.y = PEDESTAL_H / 2;
pedestal.receiveShadow = true; pedestal.castShadow = true;
scene.add(pedestal);
const iceFloor = new THREE.Mesh(
  new THREE.CylinderGeometry(3.15, 3.15, 0.06, 48),
  new THREE.MeshStandardMaterial({ color: 0xa8c9e6, roughness: 0.18, metalness: 0.08 })
);
iceFloor.position.y = PEDESTAL_H + 0.03;
iceFloor.receiveShadow = true;
scene.add(iceFloor);

// 山（遠景2層 — 空気遠近用に色を持ち替える）
const mountainMats = [];
function addMountains(ring, count, hMin, hMax, colDay) {
  const mat = new THREE.MeshStandardMaterial({ color: colDay, roughness: 1, flatShading: true });
  mat.userData = { day: new THREE.Color(colDay), night: new THREE.Color(colDay).multiplyScalar(0.16) };
  mountainMats.push(mat);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + hash3(i, ring, 1) * 0.5;
    const h = hMin + hash3(i, ring, 2) * (hMax - hMin);
    const m = new THREE.Mesh(new THREE.ConeGeometry(h * (0.9 + hash3(i, ring, 3) * 0.8), h, 5 + (i % 3)), mat);
    m.position.set(Math.sin(a) * ring, h * 0.42, Math.cos(a) * ring);
    m.rotation.y = hash3(i, ring, 4) * 3;
    scene.add(m);
  }
}
addMountains(165, 14, 30, 52, 0xb6c6da);
addMountains(95, 12, 9, 17, 0xcdd9e8);

// 木（中景）
const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.95 });
const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0xdfe9e2, roughness: 0.95, flatShading: true });
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2 + hash3(i, 9, 9) * 0.6;
  const r = 15 + hash3(i, 5, 5) * 24;
  const s = 0.8 + hash3(i, 6, 6) * 0.9;
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 0.9 * s, 6), treeTrunkMat);
  trunk.position.y = 0.45 * s; tree.add(trunk);
  for (let k = 0; k < 3; k++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry((1.35 - k * 0.32) * s, 1.4 * s, 7), treeLeafMat);
    cone.position.y = (1.25 + k * 0.85) * s;
    cone.castShadow = true;
    tree.add(cone);
  }
  tree.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
  scene.add(tree);
}

// 屋台（お祭りの気配）
const tentWindowMats = [];
for (let i = 0; i < 4; i++) {
  const a = Math.PI * 0.3 + i * Math.PI * 0.42;
  const g = new THREE.Group();
  const bodyCol = [0xc95b5b, 0x5b9ac9, 0xc9a15b, 0x7bc95b][i];
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 1.8), new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.85 }));
  body.position.y = 0.75; body.castShadow = true; g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 4), new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.9, flatShading: true }));
  roof.position.y = 1.95; roof.rotation.y = Math.PI / 4; g.add(roof);
  const winMat = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffb45e, emissiveIntensity: 0 });
  tentWindowMats.push(winMat);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), winMat);
  win.position.set(0, 0.9, 0.91); g.add(win);
  g.position.set(Math.sin(a) * 14.5, 0, Math.cos(a) * 14.5);
  g.lookAt(0, 0, 0);
  scene.add(g);
}

// 提灯ポール（会場の輪）
const lanternMats = [];
const lanternGlows = [];
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2 + 0.31;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.1, 6), treeTrunkMat);
  pole.position.y = 1.55; pole.castShadow = true; g.add(pole);
  const lm = new THREE.MeshStandardMaterial({ color: 0xffe9c9, emissive: 0xffa64d, emissiveIntensity: 0, roughness: 0.6 });
  lanternMats.push(lm);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), lm);
  lamp.position.y = 3.1; g.add(lamp);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow, color: 0xffa64d, transparent: true, opacity: 0, depthWrite: false }));
  glow.scale.set(1.6, 1.6, 1);
  glow.position.y = 3.1; g.add(glow);
  lanternGlows.push(glow.material);
  g.position.set(Math.sin(a) * 6.7, 0, Math.cos(a) * 6.7);
  scene.add(g);
}

// ---------------------------------------------------------------- カーテン（幕）
const CURTAIN_R = 10, CURTAIN_H = 7.2;
const curtainUniforms = THREE.UniformsUtils.merge([
  THREE.UniformsLib.fog,
  { uTime: { value: 0 }, uDrop: { value: 0 }, uNight: { value: 0 } },
]);
const curtain = new THREE.Mesh(
  new THREE.CylinderGeometry(CURTAIN_R, CURTAIN_R, CURTAIN_H, 96, 10, true),
  new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    fog: true,
    uniforms: curtainUniforms,
    vertexShader: `
      #include <fog_pars_vertex>
      uniform float uTime; uniform float uDrop;
      varying vec2 vUv; varying vec3 vNorm; varying float vWave;
      float hash1(float n){ return fract(sin(n)*43758.5453); }
      void main(){
        vUv = uv;
        vec3 p = position;
        float ang = atan(p.x, p.z);
        float wave = sin(ang*14.0 + uTime*0.8)*0.10 + sin(p.y*2.2 + uTime*1.3 + ang*3.0)*0.06;
        wave *= (1.0 + uDrop*3.0);
        float rr = 1.0 + wave/10.0;
        p.x *= rr; p.z *= rr;
        float fall = uDrop*uDrop * (${CURTAIN_H.toFixed(1)}*1.25) * (0.65 + 0.35*hash1(floor(ang*8.0)));
        p.y = max(p.y - fall, -${(CURTAIN_H / 2).toFixed(1)});
        vWave = wave;
        vNorm = normalize(vec3(sin(ang), 0.0, cos(ang)));
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uDrop; uniform float uNight;
      varying vec2 vUv; varying vec3 vNorm; varying float vWave;
      float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 base = vec3(0.94, 0.965, 1.0);
        float stripe = 0.93 + 0.07*sin(vUv.x*300.0);
        float shade = 0.72 + 0.28*max(dot(vNorm, normalize(vec3(0.5,0.7,0.3))), 0.0) + vWave*1.2;
        // 雪の結晶ドット
        vec2 gp = vUv*vec2(46.0, 12.0);
        vec2 cell = floor(gp);
        float hh = hash2(cell);
        vec3 col = base*stripe*shade;
        if (hh > 0.82) {
          float dd = length(fract(gp)-0.5);
          col = mix(col, vec3(0.65,0.8,1.0)*shade, smoothstep(0.13,0.05,dd)*0.55);
        }
        // 上下の縁どり
        col = mix(col, vec3(0.55,0.72,0.95)*shade, smoothstep(0.055,0.0,vUv.y)+smoothstep(0.955,1.0,vUv.y));
        col *= mix(1.0, 0.16, uNight);
        float alpha = 0.985 * (1.0 - smoothstep(0.75, 1.0, uDrop));
        gl_FragColor = vec4(col, alpha);
        #include <fog_fragment>
      }`,
  })
);
curtain.position.y = CURTAIN_H / 2;
scene.add(curtain);
// 支柱とリング
const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a6d52, roughness: 0.9 });
const curtainRig = new THREE.Group(); // カーテン落下時に支柱ごと沈める
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, CURTAIN_H + 0.5, 8), poleMat);
  p.position.set(Math.sin(a) * (CURTAIN_R + 0.15), (CURTAIN_H + 0.5) / 2, Math.cos(a) * (CURTAIN_R + 0.15));
  p.castShadow = true;
  curtainRig.add(p);
}
const topRing = new THREE.Mesh(new THREE.TorusGeometry(CURTAIN_R + 0.1, 0.05, 6, 64), poleMat);
topRing.rotation.x = Math.PI / 2;
topRing.position.y = CURTAIN_H + 0.15;
curtainRig.add(topRing);
scene.add(curtainRig);

// ---------------------------------------------------------------- 霧（制作中に全貌を隠す）
const mistMat = new THREE.SpriteMaterial({ map: texGlow, color: 0xf2f7ff, transparent: true, opacity: 0.2, depthWrite: false });
const mists = [];
for (let i = 0; i < 8; i++) {
  const sp = new THREE.Sprite(mistMat);
  const a = (i / 8) * Math.PI * 2;
  // 上半分に集めて「全貌」を隠しつつ、作業面は見えるようにする
  sp.userData = { a, r: 2.0 + hash3(i, 1, 1) * 1.4, y: 2.6 + hash3(i, 2, 2) * 2.2, sp: 0.06 + hash3(i, 3, 3) * 0.1 };
  const sc = 1.9 + hash3(i, 4, 4) * 1.3;
  sp.scale.set(sc, sc * 0.62, 1);
  scene.add(sp);
  mists.push(sp);
}

// ---------------------------------------------------------------- 降雪
function makeSnowCloud(count, range, size, opacity) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 2); // 落下速度・横揺れ位相
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * range * 2;
    pos[i * 3 + 1] = Math.random() * 22;
    pos[i * 3 + 2] = (Math.random() - 0.5) * range * 2;
    vel[i * 2] = 0.7 + Math.random() * 1.1;
    vel[i * 2 + 1] = Math.random() * 7;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: texFlake, size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true, color: 0xffffff });
  const pts = new THREE.Points(geo, mat);
  pts.userData = { vel, range, count };
  scene.add(pts);
  return pts;
}
const snowNear = makeSnowCloud(700, 24, 0.14, 0.9);
const snowFar = makeSnowCloud(900, 60, 0.3, 0.55);
const snowHeavy = makeSnowCloud(900, 20, 0.2, 0.0); // フィナーレ用
function updateSnow(pts, dt, speedMul, t) {
  const pos = pts.geometry.attributes.position.array;
  const { vel, range, count } = pts.userData;
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 1] -= vel[i * 2] * speedMul * dt;
    pos[i * 3] += Math.sin(t * 0.8 + vel[i * 2 + 1]) * dt * 0.5;
    if (pos[i * 3 + 1] < 0) {
      pos[i * 3 + 1] += 22;
      pos[i * 3] = (Math.random() - 0.5) * range * 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * range * 2;
    }
  }
  pts.geometry.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------- ボクセル彫刻
const VS = 0.16, NX = 30, NY = 31, NZ = 30;
const GMINX = -2.4, GMINZ = -2.4;
const sculptGroup = new THREE.Group();
sculptGroup.position.y = PEDESTAL_H;
scene.add(sculptGroup);

const vox = {
  state: new Uint8Array(NX * NY * NZ), // 0空 1芯 2表皮 3余分
  instId: new Int32Array(NX * NY * NZ).fill(-1),
  mesh: null, count: 0,
  instCell: null, instY: null, instHash: null, aCol: null,
  excessTotal: 0, excessLeft: 0, skinTotal: 0, skinLeft: 0,
  dummy: new THREE.Matrix4(),
};
const cellIdx = (ix, iy, iz) => (iz * NY + iy) * NX + ix;
const glowUniform = { value: 0 };
const voxMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.0 });
voxMat.onBeforeCompile = (sh) => {
  sh.uniforms.uGlow = glowUniform;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 aCol;\nvarying vec3 vCol2;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCol2 = aCol;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCol2;\nuniform float uGlow;')
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vCol2;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vCol2 * vCol2 * uGlow;');
};

function buildVoxels(shapeKey) {
  const sdf = SHAPES[shapeKey].sdf;
  let count = 0;
  const kinds = new Uint8Array(NX * NY * NZ);
  for (let iz = 0; iz < NZ; iz++) for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
    const x = GMINX + (ix + 0.5) * VS, y = (iy + 0.5) * VS, z = GMINZ + (iz + 0.5) * VS;
    const jitter = (hash3(ix * 1.3, iy * 1.7, iz * 2.1) - 0.5) * 0.1;
    if (stackedBlocksSDF(x, y, z) + jitter * 0.6 > 0) continue;
    const d = sdf(x, y, z);
    let kind;
    if (d <= 0.02) kind = 1;
    else if (d <= 0.22 + jitter) kind = 2;
    else kind = 3;
    kinds[cellIdx(ix, iy, iz)] = kind;
    count++;
  }
  vox.count = count;
  vox.instCell = new Int32Array(count);
  vox.instY = new Float32Array(count);
  vox.instHash = new Float32Array(count);
  const geo = new THREE.BoxGeometry(VS * 1.03, VS * 1.03, VS * 1.03);
  const colArr = new Float32Array(count * 3);
  vox.aCol = new THREE.InstancedBufferAttribute(colArr, 3);
  vox.aCol.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aCol', vox.aCol);
  const mesh = new THREE.InstancedMesh(geo, voxMat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true; mesh.receiveShadow = true;
  let id = 0;
  const m = new THREE.Matrix4();
  for (let iz = 0; iz < NZ; iz++) for (let iy = 0; iy < NY; iy++) for (let ix = 0; ix < NX; ix++) {
    const ci = cellIdx(ix, iy, iz);
    const kind = kinds[ci];
    if (!kind) continue;
    vox.state[ci] = kind;
    vox.instId[ci] = id;
    vox.instCell[id] = ci;
    const y = (iy + 0.5) * VS;
    vox.instY[id] = y;
    const h = hash3(ix * 3.1, iy * 4.3, iz * 5.7);
    vox.instHash[id] = h;
    m.makeTranslation(GMINX + (ix + 0.5) * VS, y, GMINZ + (iz + 0.5) * VS);
    mesh.setMatrixAt(id, m);
    const tint = 0.85 + h * 0.15; // 雪塊ごとの明度差で立体感を出す
    colArr[id * 3] = tint * 0.96; colArr[id * 3 + 1] = tint * 0.99; colArr[id * 3 + 2] = Math.min(1, tint * 1.04);
    if (kind === 3) vox.excessTotal++;
    if (kind === 2) vox.skinTotal++;
    id++;
  }
  vox.excessLeft = vox.excessTotal;
  vox.skinLeft = vox.skinTotal;
  mesh.visible = false;
  sculptGroup.add(mesh);
  vox.mesh = mesh;
}

const HIDDEN_M = new THREE.Matrix4().makeScale(0, 0, 0);
function removeCell(ci, spawnFx) {
  const id = vox.instId[ci];
  if (id < 0) return;
  const kind = vox.state[ci];
  if (kind === 3) vox.excessLeft--;
  else if (kind === 2) vox.skinLeft--;
  vox.state[ci] = 0;
  vox.mesh.setMatrixAt(id, HIDDEN_M);
  if (spawnFx) {
    const iz = Math.floor(ci / (NY * NX));
    const iy = Math.floor((ci - iz * NY * NX) / NX);
    const ix = ci - (iz * NY + iy) * NX;
    spawnDebris(GMINX + (ix + 0.5) * VS, (iy + 0.5) * VS + PEDESTAL_H, GMINZ + (iz + 0.5) * VS);
  }
}

// 球範囲の削り。kind: 3=荒削り, 2=みがき
function removeSphere(wx, wy, wz, radius, kind) {
  const ly = wy - PEDESTAL_H;
  const x0 = Math.max(0, Math.floor((wx - radius - GMINX) / VS));
  const x1 = Math.min(NX - 1, Math.floor((wx + radius - GMINX) / VS));
  const y0 = Math.max(0, Math.floor((ly - radius) / VS));
  const y1 = Math.min(NY - 1, Math.floor((ly + radius) / VS));
  const z0 = Math.max(0, Math.floor((wz - radius - GMINZ) / VS));
  const z1 = Math.min(NZ - 1, Math.floor((wz + radius - GMINZ) / VS));
  let removed = 0;
  const r2 = radius * radius;
  for (let iz = z0; iz <= z1; iz++) for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) {
    const ci = cellIdx(ix, iy, iz);
    if (vox.state[ci] !== kind) continue;
    const dx = GMINX + (ix + 0.5) * VS - wx;
    const dy = (iy + 0.5) * VS - ly;
    const dz = GMINZ + (iz + 0.5) * VS - wz;
    if (dx * dx + dy * dy + dz * dz > r2) continue;
    removeCell(ci, removed < 5);
    removed++;
  }
  if (removed) vox.mesh.instanceMatrix.needsUpdate = true;
  return removed;
}

// グリッドDDAレイキャスト（ワールド座標のレイ → 最初の占有ボクセル）
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
function voxelRaycast(ray) {
  _ro.copy(ray.origin); _ro.y -= PEDESTAL_H;
  _rd.copy(ray.direction);
  // AABB入場
  let tmin = 0, tmax = 100;
  const min = [GMINX, 0, GMINZ], max = [GMINX + NX * VS, NY * VS, GMINZ + NZ * VS];
  const ro = [_ro.x, _ro.y, _ro.z], rd = [_rd.x, _rd.y, _rd.z];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(rd[a]) < 1e-9) {
      if (ro[a] < min[a] || ro[a] > max[a]) return null;
    } else {
      let t1 = (min[a] - ro[a]) / rd[a], t2 = (max[a] - ro[a]) / rd[a];
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  let t = Math.max(tmin, 0) + 1e-4;
  let px = ro[0] + rd[0] * t, py = ro[1] + rd[1] * t, pz = ro[2] + rd[2] * t;
  let ix = Math.min(NX - 1, Math.max(0, Math.floor((px - GMINX) / VS)));
  let iy = Math.min(NY - 1, Math.max(0, Math.floor(py / VS)));
  let iz = Math.min(NZ - 1, Math.max(0, Math.floor((pz - GMINZ) / VS)));
  const stepX = rd[0] > 0 ? 1 : -1, stepY = rd[1] > 0 ? 1 : -1, stepZ = rd[2] > 0 ? 1 : -1;
  const tdx = Math.abs(VS / (rd[0] || 1e-9)), tdy = Math.abs(VS / (rd[1] || 1e-9)), tdz = Math.abs(VS / (rd[2] || 1e-9));
  let tmx = ((GMINX + (ix + (stepX > 0 ? 1 : 0)) * VS) - ro[0]) / (rd[0] || 1e-9);
  let tmy = (((iy + (stepY > 0 ? 1 : 0)) * VS) - ro[1]) / (rd[1] || 1e-9);
  let tmz = ((GMINZ + (iz + (stepZ > 0 ? 1 : 0)) * VS) - ro[2]) / (rd[2] || 1e-9);
  if (Math.abs(rd[0]) < 1e-9) tmx = Infinity;
  if (Math.abs(rd[1]) < 1e-9) tmy = Infinity;
  if (Math.abs(rd[2]) < 1e-9) tmz = Infinity;
  for (let n = 0; n < 140; n++) {
    if (ix < 0 || ix >= NX || iy < 0 || iy >= NY || iz < 0 || iz >= NZ) return null;
    const ci = cellIdx(ix, iy, iz);
    if (vox.state[ci] !== 0) {
      return {
        ci, kind: vox.state[ci],
        x: GMINX + (ix + 0.5) * VS, y: (iy + 0.5) * VS + PEDESTAL_H, z: GMINZ + (iz + 0.5) * VS,
      };
    }
    if (tmx < tmy && tmx < tmz) { ix += stepX; t = tmx; tmx += tdx; }
    else if (tmy < tmz) { iy += stepY; t = tmy; tmy += tdy; }
    else { iz += stepZ; t = tmz; tmz += tdz; }
    if (t > tmax) return null;
  }
  return null;
}

// ---------------------------------------------------------------- 破片・パフ・きらきら
const DEBRIS_N = 220;
const debrisMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.11, 0.11, 0.11),
  new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.9 }),
  DEBRIS_N
);
debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
debrisMesh.frustumCulled = false;
scene.add(debrisMesh);
const debris = [];
for (let i = 0; i < DEBRIS_N; i++) debris.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, life: 0, s: 1 });
let debrisCursor = 0;
const _dm = new THREE.Matrix4(), _de = new THREE.Euler(), _dq = new THREE.Quaternion(), _dv = new THREE.Vector3(), _ds = new THREE.Vector3();
function spawnDebris(x, y, z) {
  const n = 1 + ((Math.random() * 2) | 0);
  for (let k = 0; k < n; k++) {
    const d = debris[debrisCursor];
    debrisCursor = (debrisCursor + 1) % DEBRIS_N;
    d.on = true;
    d.x = x; d.y = y; d.z = z;
    const a = Math.random() * Math.PI * 2;
    const sp = 0.8 + Math.random() * 2.0;
    d.vx = Math.sin(a) * sp * 0.7; d.vz = Math.cos(a) * sp * 0.7;
    d.vy = 1.2 + Math.random() * 2.2;
    d.rx = Math.random() * 6; d.ry = Math.random() * 6;
    d.life = 0; d.s = 0.6 + Math.random() * 0.9;
  }
}
function updateDebris(dt) {
  let any = false;
  for (let i = 0; i < DEBRIS_N; i++) {
    const d = debris[i];
    if (!d.on) continue;
    any = true;
    d.life += dt;
    d.vy -= 9.8 * dt;
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    d.rx += dt * 5; d.ry += dt * 4;
    if (d.y < 0.06 || d.life > 2.5) {
      d.on = false;
      debrisMesh.setMatrixAt(i, HIDDEN_M);
      continue;
    }
    _de.set(d.rx, d.ry, 0); _dq.setFromEuler(_de);
    _dv.set(d.x, d.y, d.z);
    const sc = d.s * Math.max(0.1, 1 - d.life * 0.45);
    _ds.set(sc, sc, sc);
    _dm.compose(_dv, _dq, _ds);
    debrisMesh.setMatrixAt(i, _dm);
  }
  if (any) debrisMesh.instanceMatrix.needsUpdate = true;
}
for (let i = 0; i < DEBRIS_N; i++) debrisMesh.setMatrixAt(i, HIDDEN_M);

// パフ（雪煙）
const puffs = [];
for (let i = 0; i < 16; i++) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  sp.visible = false;
  scene.add(sp);
  puffs.push({ sp, t: 1, max: 0.6, s0: 1 });
}
let puffCursor = 0;
function spawnPuff(x, y, z, scale = 1.6, dur = 0.6) {
  const p = puffs[puffCursor];
  puffCursor = (puffCursor + 1) % puffs.length;
  p.sp.visible = true;
  p.sp.position.set(x, y, z);
  p.t = 0; p.max = dur; p.s0 = scale;
}
function updatePuffs(dt) {
  for (const p of puffs) {
    if (!p.sp.visible) continue;
    p.t += dt;
    const k = p.t / p.max;
    if (k >= 1) { p.sp.visible = false; continue; }
    const s = p.s0 * (0.5 + k * 1.6);
    p.sp.scale.set(s, s * 0.8, 1);
    p.sp.material.opacity = 0.75 * (1 - k);
  }
}

// きらきら（フィナーレの浮遊光）
const sparkleClouds = [];
for (let g = 0; g < 3; g++) {
  const n = 90;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.2 + Math.random() * 2.6;
    pos[i * 3] = Math.sin(a) * r;
    pos[i * 3 + 1] = 0.5 + Math.random() * 4.8;
    pos[i * 3 + 2] = Math.cos(a) * r;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: texFlake, size: 0.1, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: [0x9fd8ff, 0xd8b0ff, 0xfff0b0][g] });
  const pts = new THREE.Points(geo, mat);
  pts.position.y = PEDESTAL_H;
  scene.add(pts);
  sparkleClouds.push(pts);
}

// 花火
const fireworks = [];
function launchFirework() {
  const n = 90;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const a0 = Math.random() * Math.PI * 2;
  const cx = Math.sin(a0) * (14 + Math.random() * 14);
  const cy = 14 + Math.random() * 8;
  const cz = Math.cos(a0) * (14 + Math.random() * 14);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = cx; pos[i * 3 + 1] = cy; pos[i * 3 + 2] = cz;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    const sp = 3.5 + Math.random() * 3.5;
    vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
    vel[i * 3 + 1] = Math.cos(ph) * sp;
    vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const col = new THREE.Color().setHSL(Math.random(), 0.9, 0.65);
  const mat = new THREE.PointsMaterial({ map: texFlake, size: 0.4, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, color: col });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  fireworks.push({ pts, vel, life: 0, max: 2.1 });
  audio.firework();
}
function updateFireworks(dt) {
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const f = fireworks[i];
    f.life += dt;
    const pos = f.pts.geometry.attributes.position.array;
    for (let k = 0; k < pos.length / 3; k++) {
      f.vel[k * 3 + 1] -= 3.2 * dt;
      pos[k * 3] += f.vel[k * 3] * dt;
      pos[k * 3 + 1] += f.vel[k * 3 + 1] * dt;
      pos[k * 3 + 2] += f.vel[k * 3 + 2] * dt;
    }
    f.pts.geometry.attributes.position.needsUpdate = true;
    f.pts.material.opacity = Math.max(0, 1 - f.life / f.max);
    if (f.life >= f.max) {
      scene.remove(f.pts);
      f.pts.geometry.dispose(); f.pts.material.dispose();
      fireworks.splice(i, 1);
    }
  }
}

// 浮かぶ提灯（フィナーレ）
const skyLanterns = [];
const skyLanternMat = new THREE.SpriteMaterial({ map: texGlow, color: 0xffb45e, transparent: true, opacity: 0, depthWrite: false });
for (let i = 0; i < 12; i++) {
  const sp = new THREE.Sprite(skyLanternMat.clone());
  const a = Math.random() * Math.PI * 2;
  sp.userData = { a, r: 8 + Math.random() * 9, y: -2 - Math.random() * 26, sp: 0.5 + Math.random() * 0.5, ph: Math.random() * 7 };
  sp.scale.set(0.8, 1.0, 1);
  sp.visible = false;
  scene.add(sp);
  skyLanterns.push(sp);
}

// ---------------------------------------------------------------- 積みブロック
const blockMat = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.9 });
const blockMeshes = BLOCK_DEFS.map(([cy, hx, hy, hz, ox, oz]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), blockMat);
  m.position.set(ox, cy + PEDESTAL_H, oz);
  m.castShadow = true; m.receiveShadow = true;
  m.visible = false;
  scene.add(m);
  return m;
});

// ---------------------------------------------------------------- 氷パーツと照明オーブ
const icePartMat = new THREE.MeshPhysicalMaterial({
  color: 0xcfeaff, roughness: 0.06, metalness: 0,
  transmission: 0.9, thickness: 0.6, ior: 1.31,
  transparent: true, clearcoat: 1, clearcoatRoughness: 0.1,
  specularIntensity: 1,
});
function makeIcePartMesh(kind) {
  const g = new THREE.Group();
  const add = (geo, y = 0, x = 0, z = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, icePartMat);
    m.position.set(x, y, z); m.rotation.y = ry; m.rotation.z = rz;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (kind === 'star') {
    const m = add(new THREE.OctahedronGeometry(0.4));
    m.scale.set(0.7, 1.25, 0.7);
  } else if (kind === 'spike') {
    add(new THREE.ConeGeometry(0.19, 0.85, 6));
  } else if (kind === 'crown') {
    add(new THREE.TorusGeometry(0.44, 0.09, 8, 20), 0, 0, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(new THREE.ConeGeometry(0.09, 0.4, 5), 0.22, Math.sin(a) * 0.44, Math.cos(a) * 0.44);
    }
  } else if (kind === 'heart') {
    const shp = new THREE.Shape();
    shp.moveTo(0, -0.32);
    shp.bezierCurveTo(-0.5, 0.05, -0.32, 0.42, 0, 0.18);
    shp.bezierCurveTo(0.32, 0.42, 0.5, 0.05, 0, -0.32);
    const geo = new THREE.ExtrudeGeometry(shp, { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
    geo.center();
    add(geo);
  } else if (kind === 'fish') {
    const body = add(new THREE.SphereGeometry(0.3, 10, 8));
    body.scale.set(1.3, 0.75, 0.55);
    add(new THREE.ConeGeometry(0.18, 0.3, 6), 0, -0.45, 0, 0, Math.PI / 2);
  }
  return g;
}
const iceSlots = []; // {ghost, piece, pos, placed, anim}
const lightSpots = []; // {marker, pos, color, placed, orb, light}
const orbGroup = new THREE.Group();
scene.add(orbGroup);

function setupSlots(shapeKey) {
  const def = SHAPES[shapeKey];
  for (const part of def.iceParts) {
    const ghost = makeIcePartMesh(part.kind);
    ghost.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshBasicMaterial({ color: 0xaee6ff, transparent: true, opacity: 0.3, depthWrite: false });
        o.castShadow = false;
      }
    });
    const pos = new THREE.Vector3(part.pos[0], part.pos[1] + PEDESTAL_H, part.pos[2]);
    ghost.position.copy(pos);
    ghost.visible = false;
    scene.add(ghost);
    const piece = makeIcePartMesh(part.kind);
    piece.position.copy(pos);
    piece.visible = false;
    scene.add(piece);
    iceSlots.push({ ghost, piece, pos, placed: false, anim: -1 });
  }
  for (const [x, y, z, color] of def.lightSpots) {
    const pos = new THREE.Vector3(x, y + PEDESTAL_H, z);
    const isRainbow = color === 'rainbow';
    const c = new THREE.Color(isRainbow ? '#ffffff' : color);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow, color: c, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }));
    marker.position.copy(pos);
    marker.scale.set(0.7, 0.7, 1);
    marker.visible = false;
    scene.add(marker);
    lightSpots.push({ marker, pos, color, isRainbow, placed: false, orb: null, glowSprite: null, light: null });
  }
}

function placeLightSpot(spot) {
  spot.placed = true;
  spot.marker.visible = false;
  const c = new THREE.Color(spot.isRainbow ? '#ffffff' : spot.color);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x222233, emissive: c, emissiveIntensity: 1.2 })
  );
  orb.position.copy(spot.pos);
  orbGroup.add(orb);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow, color: c, transparent: true, opacity: 0.35, depthWrite: false, depthTest: false }));
  glow.position.copy(spot.pos);
  glow.scale.set(1.0, 1.0, 1);
  orbGroup.add(glow);
  const light = new THREE.PointLight(c, 0, 16, 1.6);
  light.position.copy(spot.pos);
  scene.add(light);
  spot.orb = orb; spot.glowSprite = glow; spot.light = light;
}

// ---------------------------------------------------------------- UI
const ui = {
  title: document.getElementById('title'),
  banner: document.getElementById('banner'),
  action: document.getElementById('action'),
  progressWrap: document.getElementById('progressWrap'),
  progressFill: document.getElementById('progressFill'),
  progressLabel: document.getElementById('progressLabel'),
  rotL: document.getElementById('rotL'),
  rotR: document.getElementById('rotR'),
  bigSwitch: document.getElementById('bigSwitch'),
  cheer: document.getElementById('cheer'),
  replay: document.getElementById('replay'),
  mute: document.getElementById('mute'),
};
function setBanner(text, sub = '') {
  ui.banner.innerHTML = text + (sub ? `<span class="sub">${sub}</span>` : '');
  ui.banner.classList.remove('pop');
  void ui.banner.offsetWidth;
  ui.banner.classList.add('pop');
  ui.banner.style.display = text ? 'block' : 'none';
}
function setAction(text, visible = true) {
  ui.action.textContent = text;
  ui.action.style.display = visible ? 'block' : 'none';
}
function setProgress(pct, label) {
  ui.progressWrap.style.display = pct == null ? 'none' : 'flex';
  if (pct != null) {
    ui.progressFill.style.width = `${Math.round(pct * 100)}%`;
    ui.progressLabel.textContent = label || '';
  }
}
function showRotate(v) {
  ui.rotL.style.display = ui.rotR.style.display = v ? 'flex' : 'none';
}

// ---------------------------------------------------------------- フェーズ進行
function startGame(shapeKey) {
  audio.start(); audio.pop();
  state.shapeKey = shapeKey;
  buildVoxels(shapeKey);
  setupSlots(shapeKey);
  ui.title.style.display = 'none';
  state.phase = PHASE.STACK;
  state.stackCount = 0;
  cam.radiusTarget = 9.0; cam.heightTarget = 3.4; cam.lookYTarget = 2.4;
  setBanner('ゆきを つみあげよう！', 'ボタンを おしてね');
  setAction('❄️ ゆきを つむ！');
}

function dropNextBlock() {
  const pending = state.stackCount + (state.stackAnim ? 1 : 0) + state.stackQueue;
  if (pending >= BLOCK_DEFS.length) return;
  if (state.stackAnim) { state.stackQueue++; return; } // 連打はキューして順番に落とす
  audio.click();
  const i = state.stackCount;
  const mesh = blockMeshes[i];
  const targetY = BLOCK_DEFS[i][0] + PEDESTAL_H;
  mesh.visible = true;
  mesh.position.y = targetY + 9;
  state.stackAnim = { mesh, targetY, t: 0, dur: 0.62, squash: -1 };
}

function updateStackAnim(dt) {
  const a = state.stackAnim;
  if (!a) return;
  if (a.squash < 0) {
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    a.mesh.position.y = a.targetY + 9 * (1 - k * k);
    if (k >= 1) {
      a.squash = 0;
      audio.thud();
      state.shake = 0.35;
      if (navigator.vibrate) navigator.vibrate(30);
      const [cy, hx, , hz, ox, oz] = BLOCK_DEFS[state.stackCount];
      for (let p = 0; p < 5; p++) {
        const ang = Math.random() * Math.PI * 2;
        spawnPuff(ox + Math.sin(ang) * hx, cy - BLOCK_DEFS[state.stackCount][2] + PEDESTAL_H + 0.1, oz + Math.cos(ang) * hz, 2.2, 0.7);
      }
    }
  } else {
    a.squash += dt;
    const k = Math.min(1, a.squash / 0.35);
    const sy = 1 - 0.18 * Math.sin(k * Math.PI);
    a.mesh.scale.set(1 + 0.1 * Math.sin(k * Math.PI), sy, 1 + 0.1 * Math.sin(k * Math.PI));
    if (k >= 1) {
      a.mesh.scale.set(1, 1, 1);
      state.stackAnim = null;
      state.stackCount++;
      if (state.stackCount >= BLOCK_DEFS.length) {
        setAction('', false);
        setBanner('おおきな ゆきのやま！');
        setTimeout(() => mergeBlocks(), 700);
      } else if (state.stackQueue > 0) {
        state.stackQueue--;
        dropNextBlock();
      }
    }
  }
}

function mergeBlocks() {
  audio.whoosh(0.8);
  for (const m of blockMeshes) m.visible = false;
  vox.mesh.visible = true;
  for (let p = 0; p < 8; p++) {
    spawnPuff((Math.random() - 0.5) * 3.5, 0.8 + Math.random() * 3.5, (Math.random() - 0.5) * 3.5, 3.2, 0.9);
  }
  state.phase = PHASE.CARVE;
  cam.radiusTarget = 8.2; cam.heightTarget = 3.0; cam.lookYTarget = 2.3;
  setBanner('なぞって けずろう！', 'ゆびで ゴシゴシ');
  setProgress(0, 'けずる');
  showRotate(true);
}

function finishPhaseCelebrate(nextLabel, cb) {
  state.celebrating = true;
  setProgress(null);
  setBanner('できた！ ⭐', '');
  audio.chime(0); audio.chime(2); audio.chime(4);
  for (let i = 0; i < 5; i++) spawnPuff((Math.random() - 0.5) * 3, 1 + Math.random() * 3.4, (Math.random() - 0.5) * 3, 2, 0.8);
  setTimeout(() => {
    state.celebrating = false;
    setAction(nextLabel);
    ui.action.onclick = () => { audio.click(); setAction('', false); cb(); };
  }, 900);
}

function startBrushPhase() {
  state.phase = PHASE.BRUSH;
  setBanner('ブラシで つるつるに！', 'やさしく なでてね');
  setProgress(0, 'みがく');
}

function startIcePhase() {
  state.phase = PHASE.ICE;
  showRotate(true);
  setBanner('ひかる こおりを つけよう！', 'ひかる ばしょを タッチ');
  setProgress(0, 'こおり');
  for (const s of iceSlots) if (!s.placed) s.ghost.visible = true;
  // 磨き上がった雪面をつややかに
  voxMat.roughness = 0.55;
  voxMat.needsUpdate = true;
}

function startLightPhase() {
  state.phase = PHASE.LIGHT;
  setBanner('なかに あかりを いれよう！', 'ひかる たまを タッチ');
  setProgress(0, 'あかり');
  for (const s of lightSpots) if (!s.placed) s.marker.visible = true;
}

function startNightPhase() {
  state.phase = PHASE.NIGHT;
  showRotate(false);
  setBanner('よるに なるよ…', '');
  setProgress(null);
  state.nightTarget = 1;
  state.switchShown = false;
  cam.radiusTarget = 15.5; cam.heightTarget = 3.6; cam.lookYTarget = 2.6;
}
function maybeShowSwitch() {
  // 夜が十分深まってからスイッチを出す（ゲーム内時間基準）
  if (state.phase === PHASE.NIGHT && !state.switchShown && state.night > 0.93) {
    state.switchShown = true;
    setBanner('じゅんび OK！', 'スイッチを おしてね');
    ui.bigSwitch.style.display = 'flex';
  }
}

function pressSwitch() {
  if (state.phase !== PHASE.NIGHT) return;
  ui.bigSwitch.style.display = 'none';
  setBanner('');
  audio.click();
  state.phase = PHASE.SHOW;
  state.revealT = 0;
  state.exposureTarget = 0.8;
  state.glowTarget = 0;
}

// フィナーレのタイムライン
const revealFlags = { drop: false, blue: false, purple: false, rainbow: false, replay: false };
function updateReveal(dt) {
  state.revealT += dt;
  const t = state.revealT;
  if (!revealFlags.drop && t > 0.7) {
    revealFlags.drop = true;
    audio.whoosh(1.6);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      spawnPuff(Math.sin(a) * CURTAIN_R, 0.6, Math.cos(a) * CURTAIN_R, 4.5, 1.2);
    }
  }
  if (revealFlags.drop) {
    const d = Math.min(1, curtainUniforms.uDrop.value + dt / 2.2);
    curtainUniforms.uDrop.value = d;
    // 支柱とリングも一緒に地面へ沈む
    curtainRig.position.y = -d * d * (CURTAIN_H + 1.2);
    if (d >= 1) { curtain.visible = false; curtainRig.visible = false; }
  }
  if (!revealFlags.blue && t > 2.9) {
    revealFlags.blue = true;
    state.revealMode = 1;
    state.glowTarget = 1.1;
    state.exposureTarget = 1.12;
    audio.chime(0); audio.chime(2);
  }
  if (!revealFlags.purple && t > 5.4) {
    revealFlags.purple = true;
    state.revealMode = 2;
    audio.chime(1); audio.chime(3);
  }
  if (!revealFlags.rainbow && t > 7.9) {
    revealFlags.rainbow = true;
    state.revealMode = 3;
    audio.startMusic();
    audio.jingle();
    ui.cheer.style.display = 'block';
    snowHeavy.material.opacity = 0.95;
    for (const sp of skyLanterns) sp.visible = true;
  }
  if (revealFlags.rainbow) {
    state.fireworkTimer -= dt;
    if (state.fireworkTimer <= 0 && fireworks.length < 3) {
      launchFirework();
      state.fireworkTimer = 2.2 + Math.random() * 2.2;
    }
  }
  if (!revealFlags.replay && t > 14) {
    revealFlags.replay = true;
    ui.replay.style.display = 'block';
    ui.cheer.classList.add('small');
  }
  // ライトの強さと色
  const orbOn = revealFlags.blue ? Math.min(1, (t - 2.9) / 1.6) : 0;
  let i = 0;
  for (const s of lightSpots) {
    if (!s.placed) continue;
    let c;
    if (state.revealMode <= 1) c = new THREE.Color().setHSL(0.58 + i * 0.015, 0.9, 0.6);
    else if (state.revealMode === 2) c = new THREE.Color().setHSL(0.75 + i * 0.02, 0.85, 0.62);
    else if (s.isRainbow) c = new THREE.Color().setHSL((clock.elapsedTime * 0.08 + i * 0.2) % 1, 0.9, 0.6);
    else c = new THREE.Color(s.color);
    s.light.color.copy(c);
    s.light.intensity = orbOn * (state.revealMode === 3 ? 9 : 6);
    s.orb.material.emissive.copy(c);
    s.orb.material.emissiveIntensity = 0.5 + orbOn * 2.5;
    s.glowSprite.material.color.copy(c);
    s.glowSprite.material.opacity = orbOn * 0.55;
    const gs = 1.2 + orbOn * 1.4 + Math.sin(clock.elapsedTime * 3 + i) * 0.2;
    s.glowSprite.scale.set(gs, gs, 1);
    i++;
  }
  // 透明な氷パーツも祭りの色で内側から光る
  if (state.revealMode > 0) {
    let ec;
    if (state.revealMode === 1) ec = new THREE.Color().setHSL(0.58, 0.9, 0.5);
    else if (state.revealMode === 2) ec = new THREE.Color().setHSL(0.76, 0.85, 0.5);
    else ec = new THREE.Color().setHSL((clock.elapsedTime * 0.055) % 1, 0.9, 0.5);
    icePartMat.emissive.copy(ec);
    icePartMat.emissiveIntensity = orbOn * (0.5 + 0.25 * Math.sin(clock.elapsedTime * 2.2));
  }
  // きらきら
  for (let g = 0; g < 3; g++) {
    sparkleClouds[g].material.opacity = orbOn * (0.35 + 0.3 * Math.sin(clock.elapsedTime * 2.4 + g * 2.1));
    sparkleClouds[g].rotation.y += dt * 0.06 * (g + 1);
  }
  // カメラはゆっくり回る
  cam.yawTarget += dt * 0.13;
  cam.radiusTarget = 13.5;
}

// 氷の中を走る光（インスタンス色アニメーション）
function hsl2rgb(h, s, l, out, o) {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  out[o] = f(0); out[o + 1] = f(8); out[o + 2] = f(4);
}
function updateFinaleColors(time) {
  const arr = vox.aCol.array;
  const mode = state.revealMode;
  const pulseY = ((time * 1.6) % 7.5) - 1.2;
  for (let i = 0; i < vox.count; i++) {
    if (vox.state[vox.instCell[i]] !== 1) continue;
    const y = vox.instY[i], h = vox.instHash[i];
    let hue, sat, light;
    if (mode === 1) {
      hue = 0.56 + h * 0.06;
      sat = 0.85;
      light = 0.5 + 0.18 * Math.sin(y * 1.5 + time * 1.8 + h * 3) + h * 0.12;
    } else if (mode === 2) {
      hue = 0.72 + 0.06 * Math.sin(y * 0.9 + time * 0.9) + h * 0.04;
      sat = 0.8;
      light = 0.52 + 0.16 * Math.sin(y * 1.2 + time * 2.1 + h * 4) + h * 0.1;
    } else {
      hue = time * 0.055 + y * 0.085 + h * 0.06;
      sat = 0.9;
      light = 0.55 + 0.1 * Math.sin(time * 2.5 + h * 6) + h * 0.08;
    }
    const band = Math.max(0, 1 - Math.abs(y - pulseY) / 0.65);
    light = Math.min(0.95, light + band * band * 0.42);
    hsl2rgb(hue, sat, light, arr, i * 3);
  }
  vox.aCol.needsUpdate = true;
}

// ---------------------------------------------------------------- 入力
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let carveJuiceAcc = 0;

function pointerToNdc(e) {
  const r = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

function carveAtPointer(e) {
  pointerToNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = voxelRaycast(raycaster.ray);
  if (!hit) return;
  const isCarve = state.phase === PHASE.CARVE;
  const kind = isCarve ? 3 : 2;
  const radius = isCarve ? 0.38 : 0.5;
  const removed = removeSphere(hit.x, hit.y, hit.z, radius, kind);
  if (removed > 0) {
    carveJuiceAcc += removed;
    state.shake = Math.min(0.12, state.shake + 0.03);
    if (navigator.vibrate) navigator.vibrate(8);
    const now = performance.now();
    if (now - state.lastCarve > 70) {
      state.lastCarve = now;
      if (isCarve) audio.scrape(Math.min(1, removed / 14));
      else audio.brush();
    }
    spawnPuff(hit.x, hit.y, hit.z, 0.55, 0.35);
    updateCarveProgress();
  } else if (hit.kind === 1) {
    // 完成面に当たった
    const now = performance.now();
    if (now - state.lastCarve > 260) {
      state.lastCarve = now;
      audio.ting();
      spawnPuff(hit.x, hit.y, hit.z, 0.35, 0.3);
    }
  }
}

function updateCarveProgress() {
  if (state.finishing || state.celebrating) return;
  // 奥まって届きにくいボクセルが残るため、7〜8割で楽しい自動仕上げに切り替える
  if (state.phase === PHASE.CARVE) {
    const pct = 1 - vox.excessLeft / Math.max(1, vox.excessTotal);
    setProgress(pct, 'けずる');
    if (pct >= 0.78) beginAutoFinish(3);
  } else if (state.phase === PHASE.BRUSH) {
    const pct = 1 - vox.skinLeft / Math.max(1, vox.skinTotal);
    setProgress(pct, 'みがく');
    if (pct >= 0.75) beginAutoFinish(2);
  }
}

function beginAutoFinish(kind) {
  state.finishing = kind;
  state.carving = false;
}
function updateAutoFinish() {
  if (!state.finishing) return;
  const kind = state.finishing;
  let removed = 0;
  for (let ci = 0; ci < vox.state.length && removed < 300; ci++) {
    if (vox.state[ci] === kind) { removeCell(ci, removed < 10); removed++; }
  }
  if (removed) {
    vox.mesh.instanceMatrix.needsUpdate = true;
    audio.scrape(0.8);
    state.shake = 0.1;
    setProgress(kind === 3 ? 1 - vox.excessLeft / Math.max(1, vox.excessTotal) : 1 - vox.skinLeft / Math.max(1, vox.skinTotal), kind === 3 ? 'けずる' : 'みがく');
  } else {
    state.finishing = false;
    if (kind === 3) finishPhaseCelebrate('🖌️ つぎは みがき！', startBrushPhase);
    else finishPhaseCelebrate('🧊 つぎは こおり！', startIcePhase);
  }
}

function tapSlots(e) {
  pointerToNdc(e);
  const v = new THREE.Vector3();
  const pickList = state.phase === PHASE.ICE ? iceSlots : lightSpots;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  let best = null, bestD = Math.max(80, Math.min(w, h) * 0.13); // 子ども向けに大きな当たり判定
  for (const s of pickList) {
    if (s.placed) continue;
    v.copy(s.pos).project(camera);
    const d = Math.hypot((v.x - ndc.x) * w / 2, (v.y - ndc.y) * h / 2);
    if (d < bestD) { best = s; bestD = d; }
  }
  if (!best) return;
  if (state.phase === PHASE.ICE) {
    best.placed = true;
    best.ghost.visible = false;
    best.piece.visible = true;
    best.anim = 0;
    const done = iceSlots.filter((s) => s.placed).length;
    audio.chime(done);
    setProgress(done / iceSlots.length, 'こおり');
    if (done >= iceSlots.length) {
      setTimeout(() => finishPhaseCelebrate('💡 つぎは あかり！', startLightPhase), 700);
    }
  } else {
    placeLightSpot(best);
    const done = lightSpots.filter((s) => s.placed).length;
    audio.chime(done);
    spawnPuff(best.pos.x, best.pos.y, best.pos.z, 0.9, 0.5);
    setProgress(done / lightSpots.length, 'あかり');
    if (done >= lightSpots.length) {
      setTimeout(() => finishPhaseCelebrate('🌙 よるに しよう！', startNightPhase), 700);
    }
  }
}

canvas.addEventListener('pointerdown', (e) => {
  audio.start();
  if (state.phase === PHASE.CARVE || state.phase === PHASE.BRUSH) {
    if (!state.finishing && !state.celebrating) {
      state.carving = true;
      carveAtPointer(e);
    }
  } else if (state.phase === PHASE.ICE || state.phase === PHASE.LIGHT) {
    if (!state.celebrating) tapSlots(e);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (state.carving) {
    const now = performance.now();
    if (now - (state._lastMove || 0) > 28) {
      state._lastMove = now;
      carveAtPointer(e);
    }
  }
});
window.addEventListener('pointerup', () => { state.carving = false; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.zoom = Math.min(1.35, Math.max(0.72, cam.zoom + e.deltaY * 0.0008));
}, { passive: false });
// ピンチズーム
let pinchDist = 0;
canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinchDist > 0) cam.zoom = Math.min(1.35, Math.max(0.72, cam.zoom * (pinchDist / d)));
    pinchDist = d;
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { pinchDist = 0; });

ui.rotL.addEventListener('click', () => { audio.click(); cam.yawTarget += Math.PI / 4; });
ui.rotR.addEventListener('click', () => { audio.click(); cam.yawTarget -= Math.PI / 4; });
ui.bigSwitch.addEventListener('click', pressSwitch);
ui.replay.addEventListener('click', () => location.reload());
ui.mute.addEventListener('click', () => {
  audio.start();
  state.musicOn = !state.musicOn;
  if (audio.master) audio.master.gain.value = state.musicOn ? 0 : 0.55;
  ui.mute.textContent = state.musicOn ? '🔇' : '🔊';
});
document.getElementById('chooseCastle').addEventListener('click', () => startGame('castle'));
document.getElementById('choosePenguin').addEventListener('click', () => startGame('penguin'));
ui.action.addEventListener('click', () => {
  if (state.phase === PHASE.STACK) dropNextBlock();
});

// ---------------------------------------------------------------- 昼夜
const sunPosDay = new THREE.Vector3(26, 38, 14);
const sunPosNight = new THREE.Vector3(21.6, 34.2, -44.4);
const fogDay = new THREE.Color(0xcfe0ee), fogNight = new THREE.Color(0x0a1230);
const sunColDay = new THREE.Color(0xfff2dd), sunColNight = new THREE.Color(0x9db8ff);
const hemiSkyDay = new THREE.Color(0xbcd8ff), hemiSkyNight = new THREE.Color(0x1a2450);
const hemiGndDay = new THREE.Color(0xe8eef8), hemiGndNight = new THREE.Color(0x0a0f22);
function applyEnvironment(dt) {
  const k = 1 - Math.exp(-dt * 1.1);
  state.night += (state.nightTarget - state.night) * k;
  const n = state.night;
  skyUniforms.uNight.value = n;
  curtainUniforms.uNight.value = n;
  scene.fog.color.lerpColors(fogDay, fogNight, n);
  scene.fog.near = 40 - n * 8;
  scene.fog.far = 190 - n * 30;
  sun.position.lerpVectors(sunPosDay, sunPosNight, n);
  sun.color.lerpColors(sunColDay, sunColNight, n);
  sun.intensity = 2.3 * (1 - n) + 0.5 * n;
  hemi.color.lerpColors(hemiSkyDay, hemiSkyNight, n);
  hemi.groundColor.lerpColors(hemiGndDay, hemiGndNight, n);
  hemi.intensity = 0.9 * (1 - n) + 0.34 * n;
  for (const m of mountainMats) m.color.lerpColors(m.userData.day, m.userData.night, n);
  // 提灯・屋台は夜に点く
  const warm = Math.max(0, n - 0.5) * 2;
  for (const m of lanternMats) m.emissiveIntensity = warm * 1.6;
  for (const g of lanternGlows) g.opacity = warm * 0.5;
  for (const m of tentWindowMats) m.emissiveIntensity = warm * 1.4;
  // 霧スプライトは夜に消える
  mistMat.opacity = 0.2 * (1 - n);
  state.exposure += (state.exposureTarget - state.exposure) * k;
  renderer.toneMappingExposure = state.exposure;
  state.glow += (state.glowTarget - state.glow) * (1 - Math.exp(-dt * 2));
  glowUniform.value = state.glow;
}

// ---------------------------------------------------------------- ループ
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, fps = 60;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = h > w ? 62 : 50;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  skyUniforms.uTime.value = t;
  curtainUniforms.uTime.value = t;

  applyEnvironment(dt);
  maybeShowSwitch();
  updateStackAnim(dt);
  updateAutoFinish();
  updateDebris(dt);
  updatePuffs(dt);
  updateSnow(snowNear, dt, 1, t);
  updateSnow(snowFar, dt, 1, t);
  if (snowHeavy.material.opacity > 0.01) updateSnow(snowHeavy, dt, 0.65, t);
  updateFireworks(dt);

  // 霧の漂い
  for (const sp of mists) {
    const u = sp.userData;
    u.a += dt * u.sp;
    sp.position.set(Math.sin(u.a) * u.r, u.y + PEDESTAL_H + Math.sin(t * 0.5 + u.r) * 0.3, Math.cos(u.a) * u.r);
  }

  // 氷パーツの装着アニメ
  for (const s of iceSlots) {
    if (s.anim >= 0 && s.anim < 1) {
      s.anim = Math.min(1, s.anim + dt / 0.55);
      const k = s.anim;
      const drop = (1 - k) * (1 - k) * 2.4;
      s.piece.position.set(s.pos.x, s.pos.y + drop, s.pos.z);
      const sc = k < 0.85 ? 1 : 1 + Math.sin((k - 0.85) / 0.15 * Math.PI) * 0.15;
      s.piece.scale.set(sc, sc, sc);
      if (s.anim >= 1) spawnPuff(s.pos.x, s.pos.y, s.pos.z, 0.8, 0.5);
    }
    if (!s.placed && s.ghost.visible) {
      const p = 1 + Math.sin(t * 4) * 0.1;
      s.ghost.scale.set(p, p, p);
    }
  }
  for (const s of lightSpots) {
    if (!s.placed && s.marker.visible) {
      const p = 0.55 + Math.sin(t * 5 + s.pos.y) * 0.18;
      s.marker.scale.set(p, p, 1);
    }
  }

  // 置いたオーブは制作中もほんのり明滅
  if (state.phase === PHASE.LIGHT || state.phase === PHASE.NIGHT) {
    let i = 0;
    for (const s of lightSpots) {
      if (!s.placed) continue;
      const pulse = 0.8 + Math.sin(t * 2.5 + i * 1.3) * 0.3;
      s.orb.material.emissiveIntensity = pulse * (1 + state.night * 1.5);
      s.glowSprite.material.opacity = 0.25 * pulse * (1 + state.night);
      s.light.intensity = state.night * 1.2 * pulse;
      i++;
    }
  }

  if (state.phase === PHASE.SHOW) {
    updateReveal(dt);
    if (state.revealMode > 0) updateFinaleColors(t);
    // 浮かぶ提灯
    for (const sp of skyLanterns) {
      if (!sp.visible) continue;
      const u = sp.userData;
      u.y += dt * u.sp;
      if (u.y > 30) u.y = -3;
      u.a += dt * 0.05;
      sp.position.set(Math.sin(u.a) * u.r + Math.sin(t * 0.7 + u.ph) * 0.5, u.y, Math.cos(u.a) * u.r);
      sp.material.opacity = Math.min(0.85, Math.max(0, Math.min(u.y + 2, 26 - u.y) * 0.25));
    }
  }

  // カメラ
  const lerpK = 1 - Math.exp(-dt * 2.6);
  cam.yaw += (cam.yawTarget - cam.yaw) * lerpK;
  cam.radius += (cam.radiusTarget - cam.radius) * lerpK;
  cam.height += (cam.heightTarget - cam.height) * lerpK;
  cam.lookY += (cam.lookYTarget - cam.lookY) * lerpK;
  state.shake = Math.max(0, state.shake - dt * 1.8);
  const shx = (Math.random() - 0.5) * state.shake * 0.25;
  const shy = (Math.random() - 0.5) * state.shake * 0.25;
  const portrait = camera.aspect < 1 ? 1.28 : 1;
  let r = cam.radius * cam.zoom * portrait;
  // カーテンが立っている間はカーテンの内側に留まる
  if (state.phase < PHASE.NIGHT) r = Math.min(r, CURTAIN_R - 0.8);
  camera.position.set(Math.sin(cam.yaw) * r + shx, cam.height + Math.sin(t * 0.4) * 0.08 + shy, Math.cos(cam.yaw) * r);
  camera.lookAt(shx, cam.lookY, 0);

  renderer.render(scene, camera);
}
animate();

// タイトル画面はカメラがゆっくり漂う
setInterval(() => {
  if (state.phase === PHASE.TITLE) cam.yawTarget += 0.08;
}, 500);

// ---------------------------------------------------------------- デバッグAPI（自動試遊用）
window.__game = {
  PHASE,
  get phase() { return state.phase; },
  get errors() { return errors; },
  get fps() { return fps; },
  get voxels() { return { total: vox.count, excessLeft: vox.excessLeft, excessTotal: vox.excessTotal, skinLeft: vox.skinLeft, skinTotal: vox.skinTotal }; },
  choose(k) { startGame(k); },
  stack() { dropNextBlock(); },
  stackCount() { return state.stackCount; },
  time() { return clock.elapsedTime; },
  // ランダムな余分ボクセルを中心に指定割合まで削る（試遊補助）
  autoCarve(frac = 0.5) {
    if (state.phase !== PHASE.CARVE && state.phase !== PHASE.BRUSH) return;
    const kind = state.phase === PHASE.CARVE ? 3 : 2;
    const total = kind === 3 ? vox.excessTotal : vox.skinTotal;
    const target = Math.floor(total * frac);
    if (frac >= 1) {
      // 全走査で確実に削り切る
      for (let ci = 0; ci < vox.state.length; ci++) if (vox.state[ci] === kind) removeCell(ci, false);
      vox.mesh.instanceMatrix.needsUpdate = true;
    } else {
      let guard = 0;
      while ((kind === 3 ? vox.excessTotal - vox.excessLeft : vox.skinTotal - vox.skinLeft) < target && guard < 4000) {
        guard++;
        const ci = (Math.random() * vox.state.length) | 0;
        if (vox.state[ci] !== kind) continue;
        const iz = Math.floor(ci / (NY * NX));
        const iy = Math.floor((ci - iz * NY * NX) / NX);
        const ix = ci - (iz * NY + iy) * NX;
        removeSphere(GMINX + (ix + 0.5) * VS, (iy + 0.5) * VS + PEDESTAL_H, GMINZ + (iz + 0.5) * VS, 0.45, kind);
      }
    }
    updateCarveProgress();
  },
  placeAllIce() { for (const s of iceSlots) if (!s.placed) { s.placed = true; s.ghost.visible = false; s.piece.visible = true; s.anim = 0; } setProgress(1, 'こおり'); finishPhaseCelebrate('💡 つぎは あかり！', startLightPhase); },
  placeAllLights() { for (const s of lightSpots) if (!s.placed) placeLightSpot(s); setProgress(1, 'あかり'); finishPhaseCelebrate('🌙 よるに しよう！', startNightPhase); },
  night() { startNightPhase(); },
  pressSwitch() { pressSwitch(); },
  clickAction() { ui.action.click(); },
  get revealT() { return state.revealT; },
  env() {
    return {
      night: state.night, nightTarget: state.nightTarget,
      drop: curtainUniforms.uDrop.value, curtainNight: curtainUniforms.uNight.value,
      matDrop: curtain.material.uniforms.uDrop.value,
      sameUniforms: curtain.material.uniforms === curtainUniforms,
      mist: mistMat.opacity, glow: glowUniform.value,
      exposure: renderer.toneMappingExposure, revealMode: state.revealMode,
      camR: cam.radius, camYaw: cam.yaw,
      finishing: state.finishing, celebrating: state.celebrating,
    };
  },
  // 未設置スロットの画面座標（試遊でタップ位置を得るため）
  slotScreens() {
    const list = state.phase === PHASE.ICE ? iceSlots : lightSpots;
    const v = new THREE.Vector3();
    return list.filter((s) => !s.placed).map((s) => {
      v.copy(s.pos).project(camera);
      return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight };
    });
  },
};
