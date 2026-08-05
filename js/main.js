// はねばし キャナルタウン — 4歳向け 跳ね橋・運河管理 3D ゲーム
// One-finger play: fix the bridge machinery, pull the giant lever,
// and watch the whole town move as a big ship passes through.
import * as THREE from './vendor/three.module.js';
import { SFX } from './audio.js';
import { makeWater, REFLECT_HIDE_LAYER } from './water.js';
import * as TEX from './textures.js';

const HIT_LAYER = 8; // raycast-only invisible tap targets

// ---------------------------------------------------------------- setup
const app = document.getElementById('app');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  const err = document.getElementById('err');
  err.style.display = 'flex';
  err.textContent = 'ごめんね、この ブラウザでは あそべないみたい (WebGL エラー)';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0xcfdde8);
scene.fog = new THREE.Fog(FOG_COLOR, 55, 230);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 600);
camera.layers.enable(REFLECT_HIDE_LAYER);

const sfx = new SFX();

// ---------------------------------------------------------------- lights
const SUN_DIR = new THREE.Vector3(20, 50, 34);
const sun = new THREE.DirectionalLight(0xfff0d8, 3.4);
sun.position.copy(SUN_DIR);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
sun.shadow.camera.near = 5; sun.shadow.camera.far = 160;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const hemi = new THREE.HemisphereLight(0xbdd8ec, 0x6a604c, 0.85);
scene.add(hemi);

// ---------------------------------------------------------------- helpers
function mat(opt) { return new THREE.MeshStandardMaterial(opt); }
function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}
function cyl(rt, rb, h, seg, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z);
  return m;
}
function shadow(m, cast = true, receive = true) {
  m.traverse ? m.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } })
             : (m.castShadow = cast, m.receiveShadow = receive);
  return m;
}
function glowTexture(hex) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, hex); g.addColorStop(0.35, hex + 'cc'); g.addColorStop(1, hex + '00');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX_GLOW_W = glowTexture('#ffffff');
const TEX_GLOW_Y = glowTexture('#ffd75e');
const TEX_GLOW_R = glowTexture('#ff5040');
const TEX_GLOW_G = glowTexture('#40ff70');
function sprite(texture, size, color = 0xffffff) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, color, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  s.scale.set(size, size, 1);
  s.layers.set(REFLECT_HIDE_LAYER);
  return s;
}

// tiny tween engine
const tweens = [];
function tween({ dur, delay = 0, ease = easeInOut, update, done }) {
  tweens.push({ t: -delay, dur, ease, update, done });
}
function easeInOut(t) { return t * t * (3 - 2 * t); }
function easeOut(t) { return 1 - (1 - t) * (1 - t); }
function easeOutBack(t) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function stepTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(1, tw.t / tw.dur);
    tw.update && tw.update(tw.ease(k), k);
    if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
  }
}

// ---------------------------------------------------------------- sky
{
  const skyGeo = new THREE.SphereGeometry(340, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR.clone().normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.05, 1.0);
        vec3 zen = vec3(0.22, 0.45, 0.75);
        vec3 hor = vec3(0.86, 0.90, 0.93);
        vec3 col = mix(hor, zen, pow(max(h, 0.0), 0.55));
        float s = max(dot(vDir, sunDir), 0.0);
        col += vec3(1.0, 0.85, 0.55) * pow(s, 350.0) * 3.0;   // sun disc
        col += vec3(1.0, 0.75, 0.45) * pow(s, 12.0) * 0.16;   // warm haze
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// clouds — soft flattened puff clusters drifting slowly
const clouds = new THREE.Group();
{
  const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8a9aa8, fog: false });
  for (let i = 0; i < 7; i++) {
    const cl = new THREE.Group();
    const n = 3 + (i % 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 7, 10, 8), cm);
      s.position.set((j - n / 2) * 8 + Math.random() * 4, Math.random() * 2.5, Math.random() * 5);
      s.scale.y = 0.42;
      cl.add(s);
    }
    cl.position.set(-140 + i * 45 + Math.random() * 20, 42 + Math.random() * 18, -90 - Math.random() * 120);
    if (i % 3 === 0) cl.position.z = -40 - Math.random() * 40;
    clouds.add(cl);
  }
  scene.add(clouds);
}

// ---------------------------------------------------------------- ground / canal
const WATER_Y = -1.4;
const CANAL_HALF = 9;

const pavingMat = mat({ map: TEX.T(TEX.pavingTex(), 8, 40), roughness: 0.9 });
const grassMat = mat({ map: TEX.T(TEX.grassTex(), 30, 60), roughness: 1 });
const asphaltMat = mat({ map: TEX.T(TEX.asphaltTex(), 24, 1), roughness: 0.95 });
const stoneMat = mat({ map: TEX.T(TEX.stoneWallTex(), 30, 1), roughness: 0.9 });

for (const side of [1, -1]) {
  // paved quay strip along the canal
  const quay = box(11, 0.4, 400, pavingMat, side * (CANAL_HALF + 0.6 + 5.5), -0.2, 0);
  quay.receiveShadow = true;
  scene.add(quay);
  // grass beyond
  const grass = box(90, 0.36, 400, grassMat, side * (CANAL_HALF + 11.1 + 45), -0.24, 0);
  grass.receiveShadow = true;
  scene.add(grass);
  // canal wall
  const wall = box(0.7, 3.2, 400, stoneMat, side * (CANAL_HALF + 0.25), -1.55, 0);
  wall.receiveShadow = true;
  scene.add(wall);
  // road (on land only)
  const road = box(110, 0.06, 7, asphaltMat, side * (CANAL_HALF + 0.6 + 55), 0.03, 0);
  road.receiveShadow = true;
  scene.add(road);
  // center line
  const line = new THREE.Mesh(new THREE.PlaneGeometry(110, 0.9),
    new THREE.MeshBasicMaterial({ map: TEX.roadLineTex(), transparent: true, depthWrite: false }));
  line.material.map.repeat.set(14, 1);
  line.rotation.x = -Math.PI / 2;
  line.position.set(side * (CANAL_HALF + 0.6 + 55), 0.075, 0);
  scene.add(line);
  // sidewalks
  for (const sz of [1, -1]) {
    const sw = box(110, 0.14, 1.3, pavingMat, side * (CANAL_HALF + 0.6 + 55), 0.07, sz * 4.2);
    sw.receiveShadow = true;
    scene.add(sw);
  }
  // bridge abutment
  const ab = box(1.6, 3.4, 9.6, stoneMat, side * (CANAL_HALF + 0.6), -1.55, 0);
  shadow(ab); scene.add(ab);
}

// water
const water = makeWater({ width: CANAL_HALF * 2, length: 400, sunDir: SUN_DIR, fog: scene.fog });
water.position.y = WATER_Y;
scene.add(water);

// canal bed (dark, under water — seen only at glancing angles)
const bed = box(CANAL_HALF * 2, 0.2, 400, mat({ color: 0x0c2029, roughness: 1 }), 0, WATER_Y - 2.3, 0);
scene.add(bed);

// ---------------------------------------------------------------- town (mid + far)
function facadeCanvas(baseHex) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.drawImage(TEX.brickTex(baseHex), 0, 0, 128, 256);
  // windows
  x.fillStyle = '#20262e';
  x.strokeStyle = '#e8e2d2'; x.lineWidth = 5;
  for (let fy = 0; fy < 3; fy++) for (let fx = 0; fx < 2; fx++) {
    const wx = 22 + fx * 56, wy = 26 + fy * 68;
    x.fillRect(wx, wy, 32, 44); x.strokeRect(wx, wy, 32, 44);
    x.fillStyle = 'rgba(160,190,215,0.55)'; x.fillRect(wx + 2, wy + 2, 28, 16);
    x.fillStyle = '#20262e';
  }
  // door
  x.fillStyle = '#4c3620';
  x.fillRect(48, 208, 34, 48);
  x.strokeStyle = '#d8d2c2'; x.strokeRect(48, 208, 34, 48);
  return c;
}
const houseBaseColors = ['#a8563c', '#7a4a35', '#9c6a48', '#5c6b70', '#8a4a52', '#b06a3a'];
const facadeMats = houseBaseColors.map(h => mat({ map: TEX.T(facadeCanvas(h)), roughness: 0.9 }));
const wallMats = houseBaseColors.map(h => mat({ map: TEX.T(TEX.brickTex(h), 3, 4), roughness: 0.9 }));
const roofMatA = mat({ color: 0x6e3a2a, roughness: 0.85 });
const roofMatB = mat({ color: 0x45505c, roughness: 0.85 });

function roofPrism(ridgeLen, span, h, material) {
  const s = span / 2, L = ridgeLen / 2;
  const R1 = [-L, h, 0], R2 = [L, h, 0];
  const E1 = [-L, 0, s], E2 = [L, 0, s];   // +z eave
  const F1 = [-L, 0, -s], F2 = [L, 0, -s]; // -z eave
  const v = [
    R1, E1, E2, R1, E2, R2, // slope +z
    R1, R2, F2, R1, F2, F1, // slope -z
    R1, F1, E1,             // gable -x
    R2, E2, F2,             // gable +x
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

function house(i, w, h, d) {
  const g = new THREE.Group();
  const fi = i % facadeMats.length;
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const mats = [wallMats[fi], wallMats[fi], wallMats[fi], wallMats[fi], wallMats[fi], wallMats[fi]];
  const body = new THREE.Mesh(bodyGeo, mats);
  body.position.y = h / 2;
  g.add(body);
  const roof = roofPrism(d, w + 0.4, 1.6 + (i % 3) * 0.5, i % 2 ? roofMatA : roofMatB);
  roof.rotation.y = Math.PI / 2;
  roof.position.y = h;
  g.add(roof);
  // chimney
  if (i % 2) g.add(box(0.5, 1.2, 0.5, wallMats[(fi + 1) % 6], w * 0.25, h + 1.1, d * 0.2));
  g.userData.facade = { body, fi };
  return g;
}

// rows of canal houses receding into the fog (both banks, both directions)
const housePositions = [];
for (const sx of [1, -1]) {
  for (const sz of [1, -1]) {
    for (let i = 0; i < 8; i++) {
      const z = sz * (13 + i * 8.2 + (i * 7 % 3));
      if (sx === 1 && Math.abs(z) < 32) continue; // keep the east-bank plaza + camera views clear
      housePositions.push([sx, z, i]);
    }
  }
}
housePositions.forEach(([sx, z, i], idx) => {
  const w = 5 + (idx % 3), h = 5.5 + ((idx * 13) % 4), d = 6.5;
  const hs = house(idx, w, h, d);
  hs.position.set(sx * (CANAL_HALF + 6.2 + (idx % 2) * 1.5), 0, z);
  // facade faces the canal
  const facadeSide = sx === 1 ? 1 : 0;
  hs.userData.facade.body.material = hs.userData.facade.body.material.slice();
  hs.userData.facade.body.material[facadeSide] = facadeMats[hs.userData.facade.fi];
  shadow(hs);
  scene.add(hs);
});

// far skyline + church + windmill + hills (aerial perspective does the rest)
{
  const farMat = mat({ color: 0x5e7185, roughness: 1 });
  for (let i = 0; i < 12; i++) {
    const w = 8 + (i * 7) % 12, h = 10 + (i * 11) % 16;
    const b = box(w, h, 8, farMat, -80 + i * 15 + ((i * 5) % 9), h / 2, -150 - (i % 4) * 18);
    scene.add(b);
  }
  // church
  const church = new THREE.Group();
  church.add(box(8, 14, 8, farMat, 0, 7, 0));
  church.add(cyl(0, 3.4, 8, 4, mat({ color: 0x4d5f70 }), 0, 18, 0));
  church.position.set(26, 0, -135);
  scene.add(church);
  // hills
  const hillMat = mat({ color: 0x718a66, roughness: 1 });
  for (const [hx, hz, hr] of [[-120, -180, 60], [90, -190, 70], [-60, -220, 90]]) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(hr, 16, 10), hillMat);
    hill.scale.y = 0.22;
    hill.position.set(hx, -2, hz);
    scene.add(hill);
  }
}

const windmill = new THREE.Group();
{
  windmill.add(cyl(2.2, 3.4, 12, 8, mat({ color: 0x74584a, roughness: 0.9 }), 0, 6, 0));
  windmill.add(cyl(0, 2.6, 3, 8, mat({ color: 0x4a5a66 }), 0, 13.4, 0));
  const blades = new THREE.Group();
  const bm = mat({ color: 0xd8d2c0, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const bl = box(1.6, 7, 0.12, bm, 0, 4.6, 0);
    const arm = new THREE.Group();
    arm.add(bl);
    arm.rotation.z = i * Math.PI / 2;
    blades.add(arm);
  }
  blades.position.set(0, 12.4, 2.9);
  windmill.add(blades);
  windmill.userData.blades = blades;
  windmill.position.set(-34, 0, -78);
  shadow(windmill);
  scene.add(windmill);
}

// ---------------------------------------------------------------- bridge
const steelMat = mat({ map: TEX.T(TEX.metalTex(), 2, 2), color: 0x51704f, roughness: 0.55, metalness: 0.5 });
const steelDark = mat({ color: 0x36474a, roughness: 0.5, metalness: 0.6 });
const plankMat = mat({ map: TEX.T(TEX.plankTex(), 3, 3), roughness: 0.85 });
const rustMat = mat({ map: TEX.T(TEX.rustTex(), 2, 2), color: 0x8a5a34, roughness: 0.95, metalness: 0.25 });
const shinyMat = mat({ color: 0x9aa4ae, roughness: 0.3, metalness: 0.9 });
const concreteMat = mat({ color: 0x8f8b80, roughness: 0.9 });

const LEAF_LEN = 9.0;
const PIVOT_X = 9.3;
const OPEN_ANGLE = THREE.MathUtils.degToRad(72);

function buildLeaf(side) { // side: -1 left (west), +1 right (east)
  const g = new THREE.Group();
  g.position.set(side * PIVOT_X, 0.0, 0);
  const leaf = new THREE.Group();
  // deck: planks on steel
  const deck = box(LEAF_LEN, 0.24, 8.2, plankMat, -side * LEAF_LEN / 2, 0.22, 0);
  leaf.add(deck);
  // steel frame under deck (visible when the bridge opens!)
  for (const z of [-3.6, 0, 3.6]) leaf.add(box(LEAF_LEN, 0.5, 0.34, steelMat, -side * LEAF_LEN / 2, -0.15, z));
  for (let i = 0; i < 4; i++) leaf.add(box(0.3, 0.42, 7.6, steelDark, -side * (0.9 + i * 2.4), -0.12, 0));
  leaf.add(box(LEAF_LEN, 0.16, 8.2, steelMat, -side * LEAF_LEN / 2, -0.42, 0));
  // side skirts
  for (const z of [-4.05, 4.05]) leaf.add(box(LEAF_LEN, 0.7, 0.1, steelMat, -side * LEAF_LEN / 2, 0.05, z));
  // railings
  for (const z of [-3.95, 3.95]) {
    for (let i = 0; i <= 4; i++) leaf.add(box(0.09, 1.0, 0.09, steelDark, -side * (0.4 + i * 2.05), 0.85, z));
    leaf.add(box(LEAF_LEN - 0.6, 0.1, 0.07, steelMat, -side * LEAF_LEN / 2, 1.32, z));
    leaf.add(box(LEAF_LEN - 0.6, 0.07, 0.06, steelMat, -side * LEAF_LEN / 2, 0.9, z));
  }
  shadow(leaf);
  g.add(leaf);
  return g;
}
const leafL = buildLeaf(-1); const leafR = buildLeaf(1);
scene.add(leafL, leafR);

// portal towers with balance beams + counterweights (Dutch bascule style)
const towerMat = mat({ map: TEX.T(TEX.metalTex(), 1, 3), color: 0x7a2f26, roughness: 0.6, metalness: 0.35 });
function buildTower(side) {
  const g = new THREE.Group();
  const TX = side * 10.1;
  for (const z of [-4.3, 4.3]) {
    g.add(box(0.55, 11.2, 0.55, towerMat, TX, 5.6, z));                    // legs
    g.add(box(0.4, 0.4, 0.4, steelDark, TX, 10.9, z));
  }
  g.add(box(0.5, 0.5, 9.2, towerMat, TX, 10.9, 0));                        // top crossbeam
  g.add(box(0.4, 0.45, 9.2, towerMat, TX, 6.4, 0));                        // mid brace
  // diagonal braces
  for (const z of [-4.3, 4.3]) {
    const d = box(0.18, 4.6, 0.18, steelDark, TX, 3.2, z * 0.62);
    d.rotation.x = -0.62 * Math.sign(z);
    g.add(d);
  }
  // balance beams (rotate with the leaf)
  const beams = new THREE.Group();
  beams.position.set(TX, 10.2, 0);
  for (const z of [-3.0, 3.0]) {
    beams.add(box(9.9, 0.5, 0.34, towerMat, -side * (9.9 / 2 - 0.2), 0, z)); // front arm (over canal)
    beams.add(box(4.6, 0.55, 0.4, towerMat, side * 4.6 / 2, 0, z));          // back arm
  }
  beams.add(box(0.5, 0.5, 6.6, steelDark, -side * 9.2, 0, 0));               // front tie
  const cw = box(3.0, 1.8, 5.4, concreteMat, side * 3.9, -0.4, 0);           // counterweight
  cw.material = mat({ map: TEX.T(TEX.stoneWallTex(), 2, 1), roughness: 0.95 });
  beams.add(cw);
  shadow(beams);
  g.add(beams);
  g.userData.beams = beams;
  shadow(g);
  scene.add(g);
  return g;
}
const towerL = buildTower(-1); const towerR = buildTower(1);

// flags on tower tops
const flags = [];
function addFlag(x, y, z, color) {
  const pole = cyl(0.045, 0.045, 2.2, 6, steelDark, x, y + 1.1, z);
  scene.add(pole);
  const geo = new THREE.PlaneGeometry(1.5, 0.9, 8, 4);
  const m = new THREE.Mesh(geo, mat({ color, side: THREE.DoubleSide, roughness: 0.8 }));
  m.position.set(x + 0.78, y + 1.75, z);
  scene.add(m);
  flags.push({ mesh: m, base: geo.attributes.position.array.slice() });
}
addFlag(-10.1, 11.2, -4.3, 0xe84d3d);
addFlag(10.1, 11.2, 4.3, 0x3d7de8);

// chains: beam tips -> leaf tips (4 chains), rebuilt every frame
const chainOld = mat({ map: TEX.T(TEX.rustTex(), 1, 6), color: 0x7a4a28, roughness: 1, metalness: 0.1 });
const chainNew = mat({ color: 0xb8c2cc, roughness: 0.35, metalness: 0.95 });
const chains = [];
for (const side of [-1, 1]) for (const z of [-2.8, 2.8]) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1, 8), chainOld);
  c.castShadow = true;
  scene.add(c);
  chains.push({ mesh: c, side, z });
}
const V_A = new THREE.Vector3(), V_B = new THREE.Vector3(), V_D = new THREE.Vector3(), Y_UP = new THREE.Vector3(0, 1, 0);
function updateChains() {
  for (const ch of chains) {
    const beams = (ch.side < 0 ? towerL : towerR).userData.beams;
    V_A.set(-ch.side * 9.2, -0.3, ch.z);
    beams.localToWorld(V_A);
    const leaf = ch.side < 0 ? leafL : leafR;
    V_B.set(-ch.side * (LEAF_LEN - 0.4), 0.35, ch.z);
    leaf.localToWorld(V_B);
    V_D.subVectors(V_B, V_A);
    const len = Math.max(V_D.length(), 0.001);
    ch.mesh.position.copy(V_A).addScaledVector(V_D, 0.5);
    ch.mesh.quaternion.setFromUnitVectors(Y_UP, V_D.normalize());
    ch.mesh.scale.set(1, len, 1);
  }
}

// gears at the near tower base (the oiling target)
const gearGroup = new THREE.Group();
const gearRust = mat({ map: TEX.T(TEX.rustTex(), 2, 2), color: 0x9a5c2e, roughness: 1, metalness: 0.15 });
const gearOiled = mat({ color: 0x6b747c, roughness: 0.35, metalness: 0.85 });
function buildGear(r, teeth, thickness, material) {
  const g = new THREE.Group();
  const body = cyl(r, r, thickness, 24, material);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  for (let i = 0; i < teeth; i++) {
    const t = box(0.22, 0.3, thickness, material, 0, 0, 0);
    const a = i / teeth * Math.PI * 2;
    t.position.set(Math.cos(a) * (r + 0.13), Math.sin(a) * (r + 0.13), 0);
    t.rotation.z = a;
    g.add(t);
  }
  const hub = cyl(r * 0.25, r * 0.25, thickness + 0.16, 12, steelDark);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  // spokes
  for (let i = 0; i < 4; i++) {
    const sp = box(r * 1.5, 0.16, thickness * 0.5, material);
    sp.rotation.z = i * Math.PI / 4;
    g.add(sp);
  }
  shadow(g);
  return g;
}
const bigGear = buildGear(1.15, 16, 0.3, gearRust);
bigGear.position.set(11.05, 1.5, 5.15);
const smallGear = buildGear(0.55, 9, 0.3, gearRust);
smallGear.position.set(12.83, 1.05, 5.15);
// gearbox housing behind the gears (canal side, so it never blocks the view)
const gearHouse = box(3.4, 1.4, 0.8, steelDark, 11.8, 0.7, 4.62);
shadow(gearHouse);
gearGroup.add(bigGear, smallGear, gearHouse);
gearGroup.add(box(1.2, 2.6, 0.5, steelDark, 10.05, 1.3, 4.68));
scene.add(gearGroup);

// mirrored decorative gearbox on the far tower
{
  const g2 = buildGear(1.15, 16, 0.3, gearOiled);
  g2.position.set(-11.05, 1.5, -5.15);
  scene.add(g2);
  g2.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(shadow(box(3.4, 1.4, 0.8, steelDark, -11.8, 0.7, -5.55)));
}

// synchronizing shaft between the towers (the "connect" target)
const shaftY = 9.55, shaftZ = 4.3;
const shaftMat = mat({ color: 0x86929c, roughness: 0.4, metalness: 0.85 });
const shaftL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 9.0, 10), shaftMat);
shaftL.rotation.z = Math.PI / 2;
shaftL.position.set(-5.3, shaftY, shaftZ);
const shaftR = shaftL.clone();
shaftR.position.x = 5.3;
const flangeL = cyl(0.34, 0.34, 0.22, 12, shinyMat, -0.8, shaftY, shaftZ);
flangeL.rotation.z = Math.PI / 2;
const flangeR = flangeL.clone(); flangeR.position.x = 0.8;
scene.add(shaftL, shaftR, flangeL, flangeR);
[shaftL, shaftR, flangeL, flangeR].forEach(o => o.castShadow = true);
// bearing brackets
scene.add(box(0.5, 0.7, 0.5, steelDark, -9.8, shaftY - 0.1, shaftZ), box(0.5, 0.7, 0.5, steelDark, 9.8, shaftY - 0.1, shaftZ));

// ---------------------------------------------------------------- signals & barriers
function lampHead(color, tex) {
  const g = new THREE.Group();
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10),
    mat({ color: 0x1a1a1a, emissive: color, emissiveIntensity: 0.0, roughness: 0.4 }));
  const glow = sprite(tex, 0.0);
  g.add(lamp, glow);
  g.userData = { lamp, glow };
  return g;
}
function setLamp(head, on, size = 1.6) {
  head.userData.lamp.material.emissiveIntensity = on ? 2.6 : 0.0;
  head.userData.glow.scale.setScalar(on ? size : 0.001);
}

// boat signal on the near tower (the "fix the signal" target)
const boatSignal = new THREE.Group();
{
  const housing = box(0.9, 2.1, 0.4, steelDark, 0, 0, 0);
  boatSignal.add(housing);
  const red = lampHead(0xff2211, TEX_GLOW_R); red.position.set(0, 0.55, 0.26);
  const green = lampHead(0x22ff55, TEX_GLOW_G); green.position.set(0, -0.45, 0.26);
  boatSignal.add(red, green);
  boatSignal.userData = { red, green };
  boatSignal.position.set(10.1, 6.6, 4.75);
  shadow(boatSignal, true, false);
  scene.add(boatSignal);
}

// car traffic lights at each approach
const carSignals = [];
for (const side of [1, -1]) {
  const g = new THREE.Group();
  g.add(cyl(0.09, 0.11, 3.2, 8, steelDark, 0, 1.6, 0));
  const headBox = box(0.5, 1.1, 0.4, steelDark, 0, 3.35, 0);
  g.add(headBox);
  const red = lampHead(0xff2211, TEX_GLOW_R); red.position.set(-side * 0.26, 3.6, 0);
  const green = lampHead(0x22ff55, TEX_GLOW_G); green.position.set(-side * 0.26, 3.1, 0);
  g.add(red, green);
  g.position.set(side * 13.6, 0, side * 4.35);
  g.userData = { red, green };
  shadow(g, true, false);
  scene.add(g);
  carSignals.push(g);
}
function setCarSignals(go) {
  for (const s of carSignals) { setLamp(s.userData.red, !go, 1.3); setLamp(s.userData.green, go, 1.3); }
}

// crossing barriers (遮断機)
const barriers = [];
function stripeTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#e8352a' : '#f5f2ea'; x.fillRect(i * 16, 0, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1);
  return t;
}
const stripeMat = mat({ map: stripeTex(), roughness: 0.7 });
for (const side of [1, -1]) {
  const g = new THREE.Group();
  g.position.set(side * 11.8, 0, side * 4.1);
  const cab = box(0.8, 1.3, 0.8, mat({ color: 0x8f979e, roughness: 0.6 }), 0, 0.65, side * 0.55);
  g.add(cab);
  const pivot = new THREE.Group();
  pivot.position.set(0, 1.15, 0);
  const arm = box(0.16, 0.16, 7.6, stripeMat, 0, 0, -side * 3.7);
  pivot.add(arm);
  const cwB = box(0.4, 0.4, 1.1, steelDark, 0, 0, side * 0.75);
  pivot.add(cwB);
  // blinking lamps on the arm
  const l1 = lampHead(0xff2211, TEX_GLOW_R); l1.position.set(0, 0.22, -side * 2.2);
  const l2 = lampHead(0xff2211, TEX_GLOW_R); l2.position.set(0, 0.22, -side * 5.6);
  pivot.add(l1, l2);
  g.userData = { pivot, side, lamps: [l1, l2] };
  shadow(g);
  scene.add(g);
  barriers.push(g);
}
function setBarrierAngle(a) { // a: 0 = closed(horizontal), 1 = open(up)
  for (const b of barriers) b.userData.pivot.rotation.x = b.userData.side * a * THREE.MathUtils.degToRad(82);
}
setBarrierAngle(1);

// ---------------------------------------------------------------- sluice gate + trash
const sluice = new THREE.Group();
{
  const frame = mat({ color: 0x5a7062, roughness: 0.7, metalness: 0.4 });
  sluice.add(box(0.5, 3.6, 0.5, frame, 0, -0.6, -1.5));
  sluice.add(box(0.5, 3.6, 0.5, frame, 0, -0.6, 1.5));
  sluice.add(box(0.5, 0.6, 3.5, frame, 0, 1.4, 0));
  sluice.add(box(0.24, 2.4, 2.6, mat({ map: TEX.T(TEX.rustTex(), 2, 2), color: 0x87817a, roughness: 0.9 }), 0.1, -0.6, 0));
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 8, 16), rustMat);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(0, 1.95, 0);
  sluice.add(wheel);
  // grate bars in the water
  for (let i = 0; i < 6; i++) sluice.add(box(0.08, 1.6, 0.08, steelDark, -0.5, -1.6, -1.25 + i * 0.5));
  sluice.position.set(9.55, 0.1, 12.5);
  shadow(sluice);
  scene.add(sluice);
}
const trashItems = [];
{
  const bottle = new THREE.Group();
  bottle.add(cyl(0.16, 0.16, 0.62, 10, mat({ color: 0x3f7d4a, roughness: 0.2, metalness: 0.1 }), 0, 0, 0));
  bottle.add(cyl(0.07, 0.1, 0.22, 8, mat({ color: 0x3f7d4a, roughness: 0.2 }), 0, 0.4, 0));
  bottle.rotation.z = 1.35;
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.13, 10, 18), mat({ color: 0x22262a, roughness: 0.95 }));
  tire.rotation.x = Math.PI / 2.2;
  const plank = box(1.1, 0.09, 0.3, mat({ map: TEX.T(TEX.plankTex('#6b5436')), roughness: 1 }));
  plank.rotation.y = 0.7;
  const defs = [[bottle, 8.1, 11.4], [tire, 7.9, 12.7], [plank, 8.3, 13.8]];
  for (const [m, x, z] of defs) {
    m.position.set(x, WATER_Y + 0.1, z);
    m.castShadow = true;
    scene.add(m);
    trashItems.push({ mesh: m, x, z, taken: false, phase: Math.random() * 6 });
  }
}
// trash bin on the quay
const bin = new THREE.Group();
{
  bin.add(cyl(0.55, 0.45, 1.0, 12, mat({ color: 0x3a7d5c, roughness: 0.6, metalness: 0.3 }), 0, 0.5, 0));
  bin.add(new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 16), steelDark)).children[1].position.y = 1.0;
  bin.children[1].rotation.x = Math.PI / 2;
  bin.position.set(11.4, 0, 12.9);
  shadow(bin);
  scene.add(bin);
}

// ---------------------------------------------------------------- lever platform (foreground)
const lever = new THREE.Group();
const leverArm = new THREE.Group();
{
  const base = box(2.8, 0.5, 2.4, concreteMat, 0, 0.25, 0);
  const pedM = mat({ color: 0x2f3b44, roughness: 0.5, metalness: 0.7 });
  const pedestal = box(0.6, 0.9, 0.55, pedM, 0, 0.9, 0);
  // cheek plates the axle passes through
  const cheekGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16);
  for (const zz of [-0.34, 0.34]) {
    const cheek = new THREE.Mesh(cheekGeo, pedM);
    cheek.rotation.x = Math.PI / 2;
    cheek.position.set(0, 1.35, zz);
    lever.add(cheek);
  }
  const axle = cyl(0.09, 0.09, 0.9, 10, shinyMat, 0, 1.35, 0);
  axle.rotation.x = Math.PI / 2;
  const armShaft = cyl(0.08, 0.11, 2.1, 10, mat({ color: 0xb02020, roughness: 0.4, metalness: 0.6 }), 0, 1.0, 0);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12),
    mat({ color: 0xd42a1e, roughness: 0.25, metalness: 0.2, emissive: 0x8a0d06, emissiveIntensity: 0.15 }));
  knob.position.y = 2.1;
  leverArm.add(armShaft, knob);
  leverArm.position.set(0, 1.35, 0);
  lever.add(base, pedestal, axle, leverArm);
  lever.position.set(13.8, 0, 9.4);
  lever.rotation.y = 0.47;
  lever.userData.knob = knob;
  shadow(lever);
  scene.add(lever);
}
function setLeverT(t) { leverArm.rotation.z = -t * THREE.MathUtils.degToRad(62); }

// keeper's hut behind the lever
{
  const hut = new THREE.Group();
  const hm = mat({ map: TEX.T(TEX.plankTex('#7a5c3c'), 2, 2), roughness: 0.9 });
  hut.add(box(3.4, 2.9, 3.0, hm, 0, 1.45, 0));
  const r = roofPrism(3.6, 3.8, 1.1, roofMatA);
  r.position.y = 2.9; r.rotation.y = Math.PI / 2;
  hut.add(r);
  hut.add(box(0.9, 1.7, 0.08, mat({ color: 0x35424d }), -1.0, 0.85, 1.52));
  hut.add(box(1.0, 0.9, 0.08, mat({ color: 0x9cc4d8, roughness: 0.1, metalness: 0.4 }), 0.75, 1.7, 1.52));
  hut.position.set(17.2, 0, 7.2);
  hut.rotation.y = -0.45;
  shadow(hut);
  scene.add(hut);
}

// dock props: bollards, barrels, crates, life ring, rowboat, lamp posts
let mooredBoat = null;
{
  const bolM = mat({ color: 0x2e3338, roughness: 0.5, metalness: 0.6 });
  for (const side of [1, -1]) for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    b.add(cyl(0.14, 0.18, 0.55, 10, bolM, 0, 0.27, 0));
    b.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), bolM)).children[1].position.y = 0.55;
    b.position.set(side * 9.95, 0, side * (6.5 + i * 5.5));
    shadow(b);
    scene.add(b);
  }
  const barrelM = mat({ map: TEX.T(TEX.plankTex('#6e4f30'), 2, 1), roughness: 0.9 });
  scene.add(shadow(cyl(0.42, 0.42, 1.0, 12, barrelM, 15.8, 0.5, 10.8)));
  scene.add(shadow(cyl(0.42, 0.42, 1.0, 12, barrelM, 16.7, 0.5, 10.3)));
  scene.add(shadow(box(1.0, 1.0, 1.0, mat({ map: TEX.T(TEX.plankTex('#8a6a44')), roughness: 0.9 }), 16.2, 0.5, 12.2)));
  scene.add(shadow(box(0.8, 0.8, 0.8, mat({ map: TEX.T(TEX.plankTex('#95754e')), roughness: 0.9 }), 16.1, 1.4, 12.1)));
  // life ring on the hut
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.1, 8, 18), mat({ color: 0xe8552a, roughness: 0.6 }));
  ring.position.set(15.65, 1.6, 8.6); ring.rotation.y = -0.45;
  scene.add(ring);
  // moored rowboat (bobs on the water)
  const boat = new THREE.Group();
  const bm2 = mat({ map: TEX.T(TEX.plankTex('#5f758a'), 2, 1), roughness: 0.8 });
  boat.add(box(2.4, 0.5, 1.0, bm2, 0, 0.2, 0));
  boat.add(box(0.5, 0.5, 1.0, bm2, 1.35, 0.35, 0)).children[1].rotation.z = 0.5;
  boat.add(box(2.0, 0.3, 0.7, mat({ color: 0x40506a }), 0, 0.42, 0));
  boat.position.set(7.6, WATER_Y, -8.5);
  boat.rotation.y = 0.3;
  shadow(boat);
  scene.add(boat);
  mooredBoat = boat;
  // lamp posts
  const lm = mat({ color: 0x2c3438, roughness: 0.5, metalness: 0.5 });
  for (const [lx, lz] of [[10.6, -12], [-10.6, 14], [10.6, 18], [-10.6, -18]]) {
    const p = new THREE.Group();
    p.add(cyl(0.07, 0.1, 3.4, 8, lm, 0, 1.7, 0));
    p.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8),
      mat({ color: 0xf5e8c8, emissive: 0xffe8b0, emissiveIntensity: 0.25, roughness: 0.3 }))).children[1].position.y = 3.5;
    p.position.set(lx, 0, lz);
    shadow(p, true, false);
    scene.add(p);
  }
}

// ---------------------------------------------------------------- cars & people
const cars = [];
{
  const colors = [0xd94a38, 0x3a86c8, 0xe8b02a, 0x4a9e56, 0x9058b8, 0xe07830];
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.26, 12);
  const wheelMat = mat({ color: 0x1c1e22, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const bodyM = mat({ color: colors[i], roughness: 0.35, metalness: 0.25 });
    g.add(box(3.4, 0.75, 1.7, bodyM, 0, 0.72, 0));
    const cab = box(1.8, 0.65, 1.55, bodyM, -0.2, 1.4, 0);
    g.add(cab);
    g.add(box(1.7, 0.5, 1.45, mat({ color: 0x9cc8dc, roughness: 0.1, metalness: 0.4 }), -0.2, 1.42, 0));
    const wheels = [];
    for (const [wx, wz] of [[1.15, 0.85], [1.15, -0.85], [-1.15, 0.85], [-1.15, -0.85]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.34, wz);
      g.add(w); wheels.push(w);
    }
    shadow(g);
    scene.add(g);
    const dir = i % 2 === 0 ? 1 : -1;
    cars.push({
      g, wheels, dir,
      prog: -60 + (i * 41) % 120,  // progress coordinate = dir * x
      speed: 0, vmax: 7.5 + (i % 3),
    });
  }
}
const STOP_PROG = -14.2;
function carUpdate(dt, trafficOpen) {
  for (const dir of [1, -1]) {
    const lane = cars.filter(c => c.dir === dir).sort((a, b) => b.prog - a.prog);
    lane.forEach((c, idx) => {
      let target = Infinity;
      if (!trafficOpen && c.prog < -12.6) {
        // queue behind the stop line
        let queue = 0;
        for (let j = 0; j < idx; j++) if (lane[j].prog < -11.5) queue++;
        target = STOP_PROG - queue * 5.2;
      } else if (idx > 0) {
        target = lane[idx - 1].prog - 5.2; // keep distance
      }
      const gap = target - c.prog;
      let want = c.vmax;
      if (gap < 12) want = Math.max(0, Math.min(c.vmax, (gap - 0.4) * 1.4));
      c.speed += Math.max(-14 * dt, Math.min(6 * dt, want - c.speed));
      c.prog += c.speed * dt;
      if (c.prog > 62) { c.prog = -62; c.speed = c.vmax; }
      const x = c.dir * c.prog;
      c.g.position.set(x, 0.02, -c.dir * 1.75);
      c.g.rotation.y = c.dir > 0 ? 0 : Math.PI;
      c.g.position.y += Math.sin(perfNow * 9 + c.prog) * 0.012 * (c.speed / c.vmax);
      for (const w of c.wheels) w.rotation.z -= c.speed * dt * 3;
    });
  }
}

// simple people (one is a kid with a balloon)
const people = [];
{
  const defs = [
    { c: 0xe07830, h: 1.0, z: 4.35, dir: 1, kid: false },
    { c: 0x3a86c8, h: 0.72, z: 4.35, dir: 1, kid: true },
    { c: 0x9058b8, h: 1.0, z: -4.35, dir: -1, kid: false },
  ];
  defs.forEach((d, i) => {
    const g = new THREE.Group();
    const bodyM = mat({ color: d.c, roughness: 0.8 });
    const skin = mat({ color: 0xf0c8a0, roughness: 0.8 });
    const body = cyl(0.16 * d.h, 0.2 * d.h, 0.55 * d.h, 8, bodyM, 0, 0.62 * d.h, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16 * d.h, 10, 8), skin);
    head.position.y = 1.05 * d.h;
    const legL = cyl(0.05, 0.05, 0.36 * d.h, 6, mat({ color: 0x35424d }), 0, 0.18 * d.h, 0.07);
    const legR = legL.clone(); legR.position.z = -0.07;
    const armL = cyl(0.04, 0.04, 0.3 * d.h, 6, bodyM, 0, 0.7 * d.h, 0.2 * d.h);
    const armR = armL.clone(); armR.position.z = -0.2 * d.h;
    g.add(body, head, legL, legR, armL, armR);
    let balloon = null;
    if (d.kid) {
      balloon = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat({ color: 0xe83a4a, roughness: 0.3 }));
      b.position.y = 1.9;
      const str = cyl(0.008, 0.008, 1.0, 4, mat({ color: 0xd8d8d8 }), 0, 1.35, 0);
      balloon.add(b, str);
      balloon.position.z = 0.22;
      g.add(balloon);
    }
    shadow(g);
    scene.add(g);
    people.push({ g, ...d, prog: -30 - i * 8, speed: 0, vmax: d.kid ? 1.5 : 1.3, legs: [legL, legR], arms: [armL, armR], balloon, ph: i * 2 });
  });
}
function peopleUpdate(dt, trafficOpen) {
  for (const p of people) {
    let want = p.vmax;
    if (!trafficOpen && p.prog < -13.2) want = Math.min(p.vmax, Math.max(0, (-13.4 - p.prog) * 1.5));
    p.speed += Math.max(-6 * dt, Math.min(2 * dt, want - p.speed));
    p.prog += p.speed * dt;
    if (p.prog > 55) p.prog = -55;
    p.g.position.set(p.dir * p.prog, 0.14, p.z);
    p.g.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const sw = Math.sin(perfNow * 7 + p.ph) * 0.5 * Math.min(1, p.speed / p.vmax);
    p.legs[0].rotation.z = sw; p.legs[1].rotation.z = -sw;
    p.arms[0].rotation.z = -sw * 0.7; p.arms[1].rotation.z = sw * 0.7;
    if (p.speed < 0.1) { // idle bounce while waiting
      p.g.position.y = 0.14 + Math.abs(Math.sin(perfNow * 3 + p.ph)) * 0.05;
    }
    if (p.balloon) {
      p.balloon.rotation.x = Math.sin(perfNow * 1.7 + 1) * 0.12;
      p.balloon.rotation.z = Math.sin(perfNow * 1.3) * 0.15;
    }
  }
}

// ---------------------------------------------------------------- ship
// Big coastal freighter, built from a real hull plan-form (pointed bow,
// rounded stern) extruded vertically, with proper draft below the waterline.
// Ship origin sits AT the waterline; bow points +Z.
const ship = new THREE.Group();
{
  const DECK = 2.4; // deck height above waterline
  const hullNavy = mat({ color: 0x2b4560, roughness: 0.52, metalness: 0.35 });
  const hullRed = mat({ color: 0x9e2f24, roughness: 0.65, metalness: 0.15 });
  const bootTop = mat({ color: 0xd8d2c2, roughness: 0.55, metalness: 0.2 });
  const whiteM = mat({ color: 0xe9e6dc, roughness: 0.5 });
  const darkM = mat({ color: 0x22282e, roughness: 0.6, metalness: 0.4 });
  const buffM = mat({ color: 0xc8a24a, roughness: 0.55, metalness: 0.3 });

  function hullShape(L, B) {
    // plan-form in shape space: x = beam, y = length (+y = bow)
    const hb = B / 2, hl = L / 2, bowLen = L * 0.30;
    const s = new THREE.Shape();
    s.moveTo(-hb, -hl + 1.6);
    s.quadraticCurveTo(-hb, -hl, -hb + 1.8, -hl);   // rounded stern
    s.lineTo(hb - 1.8, -hl);
    s.quadraticCurveTo(hb, -hl, hb, -hl + 1.6);
    s.lineTo(hb, hl - bowLen);                       // parallel mid-body
    s.quadraticCurveTo(hb, hl - bowLen * 0.3, 0, hl); // bow curve to the stem
    s.quadraticCurveTo(-hb, hl - bowLen * 0.3, -hb, hl - bowLen);
    s.closePath();
    return s;
  }
  function hullPiece(L, B, h, material, bevel) {
    const geo = new THREE.ExtrudeGeometry(hullShape(L, B), {
      depth: h, curveSegments: 10,
      bevelEnabled: bevel, bevelThickness: 0.45, bevelSize: 0.32, bevelSegments: 2,
    });
    geo.translate(0, 0, -h);
    geo.rotateX(Math.PI / 2); // walls now span y 0..h, bow at +z
    return new THREE.Mesh(geo, material);
  }

  const bottom = hullPiece(25.0, 5.55, 1.1, hullRed, true);   // anti-fouling red
  bottom.position.y = -1.25;
  const topsides = hullPiece(26, 6.2, 2.6, hullNavy, false);  // navy plating
  topsides.position.y = -0.2;
  const boot = hullPiece(26.1, 6.28, 0.34, bootTop, false);   // boot-top at the waterline
  boot.position.y = -0.04;
  const rub = hullPiece(26.12, 6.3, 0.14, darkM, false);      // rub rail
  rub.position.y = 1.62;
  ship.add(bottom, topsides, boot, rub);

  // wooden main deck
  const deckGeo = new THREE.ShapeGeometry(hullShape(25.5, 5.9), 10);
  deckGeo.rotateX(Math.PI / 2);
  const deckTex = TEX.T(TEX.plankTex('#9a7a50'));
  deckTex.repeat.set(0.28, 0.28);
  const deck = new THREE.Mesh(deckGeo, mat({ map: deckTex, roughness: 0.8, side: THREE.DoubleSide }));
  deck.position.y = DECK + 0.03; // just above the hull's top cap
  ship.add(deck);

  // porthole rows (canvas strip, both sides)
  {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 64;
    const x = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const px = 40 + i * 70;
      x.fillStyle = '#c9c2b2'; x.beginPath(); x.arc(px, 32, 15, 0, 7); x.fill();
      x.fillStyle = '#101820'; x.beginPath(); x.arc(px, 32, 11, 0, 7); x.fill();
      x.fillStyle = 'rgba(180,210,235,0.5)'; x.beginPath(); x.arc(px - 3, 28, 5, 0, 7); x.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    for (const sx of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(13, 0.8),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4 }));
      p.position.set(sx * 3.115, 0.85, -1.5);
      p.rotation.y = sx * Math.PI / 2;
      ship.add(p);
    }
  }
  // ship's name on the bow — かなるまる
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const x = c.getContext('2d');
    x.font = '700 60px "Hiragino Maru Gothic ProN", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#f2ede0'; x.fillText('かなる まる', 256, 50);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    for (const sx of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.1 }));
      p.position.set(sx * 3.06, 1.55, 5.4);
      p.rotation.y = sx * Math.PI / 2;
      ship.add(p);
    }
  }

  // window-strip texture for the superstructure tiers
  function windowStrip(bg, rows) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#1c2830';
    for (let r = 0; r < rows; r++) for (let i = 0; i < 6; i++)
      x.fillRect(14 + i * 40, 24 + r * 48, 26, 30);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return mat({ map: t, roughness: 0.5 });
  }
  const houseWin = windowStrip('#e9e6dc', 1);
  function houseBox(w, h, d, y, z, winMat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      [winMat, winMat, whiteM, whiteM, winMat, winMat]);
    m.position.set(0, y, z);
    return m;
  }
  // aft superstructure: two tiers + wheelhouse with bridge wings
  ship.add(houseBox(4.9, 1.9, 5.4, DECK + 0.95, -8.9, houseWin));
  ship.add(houseBox(4.3, 1.7, 4.4, DECK + 2.75, -9.1, houseWin));
  const bridgeWin = windowStrip('#e9e6dc', 1);
  ship.add(houseBox(4.0, 1.5, 2.8, DECK + 4.35, -8.4, bridgeWin));
  ship.add(box(6.5, 0.75, 1.7, whiteM, 0, DECK + 4.25, -7.6));           // bridge wings
  ship.add(box(6.7, 0.12, 1.9, darkM, 0, DECK + 3.82, -7.6));            // wing walkway
  // navigation lights on the wings (green = starboard, red = port)
  const navG = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8),
    mat({ color: 0x0a3010, emissive: 0x22ff55, emissiveIntensity: 1.8 }));
  navG.position.set(3.3, DECK + 4.3, -7.6);
  const navR = navG.clone();
  navR.material = mat({ color: 0x300a0a, emissive: 0xff2211, emissiveIntensity: 1.8 });
  navR.position.x = -3.3;
  ship.add(navG, navR);
  // funnel: red with white band and black cap + steam pipe
  ship.add(cyl(1.0, 1.15, 2.7, 16, mat({ color: 0xd8402e, roughness: 0.5 }), 0, DECK + 4.6, -10.6));
  ship.add(cyl(1.02, 1.03, 0.5, 16, whiteM, 0, DECK + 5.1, -10.6));
  ship.add(cyl(0.98, 1.0, 0.45, 16, darkM, 0, DECK + 5.95, -10.6));
  ship.add(cyl(0.07, 0.07, 2.2, 6, darkM, 0.9, DECK + 4.9, -11.3));
  // cowl ventilators
  for (const [vx, vz] of [[1.5, -6.4], [-1.5, -6.4]]) {
    ship.add(cyl(0.22, 0.26, 1.3, 10, buffM, vx, DECK + 0.65, vz));
    const cowl = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), buffM);
    cowl.position.set(vx, DECK + 1.35, vz);
    cowl.scale.z = 1.25;
    ship.add(cowl);
  }

  // cargo hold: hatch coaming + colorful containers (two abreast, one stack)
  ship.add(box(5.3, 0.5, 9.4, mat({ color: 0x6e7880, roughness: 0.7, metalness: 0.3 }), 0, DECK + 0.25, 3.6));
  const cg = [0x4a9e56, 0xe8b02a, 0x3a86c8, 0xb05838, 0x8058b8];
  let ci = 0;
  for (const cz of [0.4, 3.6, 6.8]) for (const cx of [-1.28, 1.28]) {
    ship.add(box(2.42, 1.85, 2.95, mat({ color: cg[ci++ % 5], roughness: 0.65 }), cx, DECK + 1.45, cz));
  }
  ship.add(box(2.42, 1.85, 2.95, mat({ color: cg[3], roughness: 0.65 }), -1.28, DECK + 3.3, 3.6));
  ship.add(box(2.42, 1.85, 2.95, mat({ color: cg[4], roughness: 0.65 }), 1.28, DECK + 3.3, 0.4));

  // bow gear: windlass and anchors on the curved bow flanks
  ship.add(cyl(0.3, 0.3, 0.5, 10, darkM, 0, DECK + 0.55, 10.4));          // windlass drum
  ship.add(box(1.3, 0.18, 0.5, darkM, 0, DECK + 0.45, 10.4));
  for (const sx of [1, -1]) {
    ship.add(box(0.14, 0.85, 0.5, darkM, sx * 1.98, 1.35, 10.6));         // anchor shank
    ship.add(box(0.1, 0.32, 0.95, darkM, sx * 2.0, 0.95, 10.6));          // flukes
  }

  // fore mast with crosstree, derrick booms and rigging
  const mastM = mat({ color: 0xb8a068, roughness: 0.6 });
  ship.add(cyl(0.08, 0.13, 5.6, 8, mastM, 0, DECK + 3.6, 9.4));
  ship.add(box(1.6, 0.1, 0.1, mastM, 0, DECK + 5.0, 9.4));
  const rigM = mat({ color: 0x2a2e33, roughness: 0.8 });
  function strut(ax, ay, az, bx, by, bz, r) {
    const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
    const d = b.clone().sub(a);
    const m = cyl(r, r, d.length(), 5, rigM, 0, 0, 0);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  ship.add(strut(0, DECK + 5.8, 9.4, 0.9, DECK + 0.6, 5.6, 0.035));       // derrick boom
  ship.add(strut(0, DECK + 5.8, 9.4, -0.9, DECK + 0.6, 5.6, 0.035));
  ship.add(strut(0, DECK + 6.3, 9.4, 0, 1.7, 12.6, 0.018));               // forestay
  ship.add(strut(0, DECK + 6.3, 9.4, 0, DECK + 5.6, -7.0, 0.018));        // stay to the bridge

  // deck railing along both sides
  // (only along the parallel mid-body — the hull narrows toward the bow)
  const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.85, 5);
  for (const sx of [1, -1]) {
    for (let z = -11.4; z <= 5.0; z += 2.05) {
      const p = new THREE.Mesh(postGeo, darkM);
      p.position.set(sx * 2.92, DECK + 0.42, z);
      ship.add(p);
    }
    ship.add(box(0.05, 0.07, 16.6, whiteM, sx * 2.92, DECK + 0.85, -3.2));
    ship.add(box(0.04, 0.05, 16.6, darkM, sx * 2.92, DECK + 0.45, -3.2));
  }
  // life rings on the rails
  for (const [lx, lz] of [[2.95, -5.2], [-2.95, 2.4]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 14),
      mat({ color: 0xe8552a, roughness: 0.6 }));
    ring.position.set(lx, DECK + 0.55, lz);
    ring.rotation.y = Math.PI / 2;
    ship.add(ring);
  }

  // flags: house flag on the fore mast, ensign at the stern
  const shipFlagGeo = new THREE.PlaneGeometry(1.2, 0.75, 8, 4);
  const shipFlag = new THREE.Mesh(shipFlagGeo, mat({ color: 0xe8b02a, side: THREE.DoubleSide }));
  shipFlag.position.set(0.62, DECK + 6.0, 9.4);
  ship.add(shipFlag);
  flags.push({ mesh: shipFlag, base: shipFlagGeo.attributes.position.array.slice() });
  ship.add(cyl(0.04, 0.05, 1.6, 6, mastM, 0, DECK + 0.9, -12.6));
  const ensignGeo = new THREE.PlaneGeometry(0.95, 0.6, 8, 4);
  const ensign = new THREE.Mesh(ensignGeo, mat({ color: 0xd8402e, side: THREE.DoubleSide }));
  ensign.position.set(0.5, DECK + 1.45, -12.6);
  ship.add(ensign);
  flags.push({ mesh: ensign, base: ensignGeo.attributes.position.array.slice() });

  shadow(ship);
  scene.add(ship);
}
const shipState = { mode: 'waiting', z: -46, speed: 0, dir: 1 };
function shipUpdate(dt) {
  const s = shipState;
  if (s.mode === 'gone') { ship.visible = false; return; }
  ship.visible = true;
  if (s.mode === 'passing') {
    s.speed = Math.min(2.9, s.speed + dt * 0.5);
    s.z += s.speed * s.dir * dt;
    if (s.z * s.dir > 95) s.mode = 'gone';
  }
  ship.position.set(0, WATER_Y, s.z); // origin rides at the waterline
  ship.rotation.y = s.dir > 0 ? 0 : Math.PI;
  // gentle bobbing
  ship.position.y += Math.sin(perfNow * 0.9) * 0.05;
  ship.rotation.z = Math.sin(perfNow * 0.7) * 0.007;
  ship.rotation.x = Math.sin(perfNow * 0.55 + 2) * 0.005 + (s.dir > 0 ? 1 : -1) * s.speed * 0.002;
}

// ---------------------------------------------------------------- particles
function makePool(n, texture, size, color) {
  const items = [];
  for (let i = 0; i < n; i++) {
    const s = sprite(texture, size, color);
    s.visible = false;
    scene.add(s);
    items.push({ s, life: 0, max: 1, vel: new THREE.Vector3(), grow: 0, fade: 1 });
  }
  return items;
}
const sparkles = makePool(36, TEX_GLOW_Y, 0.5);
const smokes = makePool(30, TEX_GLOW_W, 1.6, 0x778088);
const foams = makePool(64, TEX_GLOW_W, 1.4);
const confetti = makePool(70, TEX_GLOW_W, 0.4);
const confColors = [0xff5a5a, 0xffd75e, 0x6ad07a, 0x5aa8ff, 0xda7aff];

function spawn(pool, pos, vel, life, size, grow = 0, color = null) {
  const p = pool.find(i => i.life <= 0);
  if (!p) return;
  p.s.visible = true;
  p.s.position.copy(pos);
  p.vel.copy(vel);
  p.life = p.max = life;
  p.size = size; p.grow = grow;
  if (color !== null) p.s.material.color.setHex(color);
  p.s.material.opacity = 1;
  p.s.scale.setScalar(size);
}
function stepPool(pool, dt, gravity = 0) {
  for (const p of pool) {
    if (p.life <= 0) { p.s.visible = false; continue; }
    p.life -= dt;
    p.vel.y -= gravity * dt;
    p.s.position.addScaledVector(p.vel, dt);
    const k = Math.max(p.life / p.max, 0);
    p.s.material.opacity = k * 0.9;
    p.s.scale.setScalar(p.size + (1 - k) * p.grow);
    if (p.life <= 0) p.s.visible = false;
  }
}
function burst(pos, n = 10) {
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5 + 0.5, (Math.random() - 0.5) * 3);
    spawn(sparkles, pos, v, 0.6 + Math.random() * 0.4, 0.3 + Math.random() * 0.35);
  }
  sfx.pop();
}

// birds
const birds = [];
for (let i = 0; i < 2; i++) {
  const b = new THREE.Group();
  const wm = mat({ color: 0xe8e8e8, side: THREE.DoubleSide });
  const w1 = box(1.1, 0.04, 0.34, wm, 0.55, 0, 0);
  const w2 = box(1.1, 0.04, 0.34, wm, -0.55, 0, 0);
  b.add(w1, w2);
  scene.add(b);
  birds.push({ g: b, w1, w2, ph: i * 3, r: 20 + i * 9, h: 14 + i * 5, speed: 0.14 + i * 0.04 });
}

// ---------------------------------------------------------------- oil can (appears during the oil task)
const oilCan = new THREE.Group();
{
  const cm = mat({ color: 0x3a76b8, roughness: 0.35, metalness: 0.7 });
  oilCan.add(cyl(0.3, 0.36, 0.55, 12, cm, 0, 0.28, 0));
  oilCan.add(cyl(0.05, 0.05, 0.28, 8, cm, 0, 0.65, 0));
  const spout = cyl(0.03, 0.07, 0.7, 8, cm, 0.35, 0.65, 0);
  spout.rotation.z = -1.1;
  oilCan.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 12), cm);
  handle.position.set(-0.3, 0.45, 0); handle.rotation.y = Math.PI / 2;
  oilCan.add(handle);
  oilCan.visible = false;
  oilCan.layers.set(REFLECT_HIDE_LAYER);
  oilCan.traverse(o => o.layers.set(REFLECT_HIDE_LAYER));
  scene.add(oilCan);
}

// ---------------------------------------------------------------- marker (shows what to tap)
const marker = new THREE.Group();
{
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.95, depthTest: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.09, 8, 32), ringM);
  ring.rotation.x = Math.PI / 2;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 4), // pointing down
    new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.95, depthTest: false }));
  cone.rotation.x = Math.PI;
  cone.position.y = 1.7;
  marker.add(ring, cone);
  marker.traverse(o => { o.renderOrder = 950; o.layers.set(REFLECT_HIDE_LAYER); });
  marker.visible = false;
  scene.add(marker);
  marker.userData = { ring, cone };
}
let markerTarget = null; // { getPos: ()=>Vector3, r }
function showMarker(getPos, r = 1.2) { markerTarget = { getPos, r }; marker.visible = true; }
function hideMarker() { markerTarget = null; marker.visible = false; }

// ---------------------------------------------------------------- hit targets
function hitSphere(r, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial());
  m.position.set(x, y, z);
  m.layers.set(HIT_LAYER);
  scene.add(m);
  return m;
}
const hits = {
  oil: hitSphere(2.2, 11.2, 1.4, 5.15),
  chain: hitSphere(2.8, 0.8, 5.0, 2.8),
  signal: hitSphere(2.0, 10.1, 6.6, 4.75),
  trash: trashItems.map(t => hitSphere(1.35, t.x, WATER_Y + 0.2, t.z)),
  coupling: hitSphere(2.4, 0, shaftY, shaftZ),
  lever: hitSphere(2.4, 13.8, 2.4, 9.4),
};

// ---------------------------------------------------------------- camera system
let aspectFactor = 1;
function computeAspectFactor() {
  const a = camera.aspect;
  aspectFactor = a >= 1 ? 1 : Math.min(2.0, Math.pow(1 / a, 0.8));
}
const camState = {
  pos: new THREE.Vector3(19, 9, 25),
  tgt: new THREE.Vector3(0, 3, -4),
  basePos: new THREE.Vector3(19, 9, 25),
  baseTgt: new THREE.Vector3(0, 3, -4),
  shake: 0,
  followShip: false,
};
const POSES = {
  overview: { pos: [20, 9.5, 26], tgt: [0, 3, -4] },
  oil: { pos: [12.4, 3.0, 10.0], tgt: [11.2, 1.4, 5.15] },
  chain: { pos: [7.5, 6.2, 12.0], tgt: [1.2, 5.0, 1.0] },
  signal: { pos: [14.2, 6.8, 10.5], tgt: [10.1, 6.4, 4.75] },
  trash: { pos: [13.8, 7.2, 16.8], tgt: [8.0, -1.0, 12.4] },
  coupling: { pos: [6.5, 10.4, 13.8], tgt: [0, 9.4, 4.2] },
  lever: { pos: [16.6, 4.2, 14.3], tgt: [13.4, 3.5, 9.2] },
  spectate: { pos: [22, 10, 27], tgt: [0, 4, -3] },
  shipwatch: { pos: [25, 7.8, -17], tgt: [0, 4.2, -1] },
  celebrate: { pos: [16, 6.5, 19], tgt: [0, 3.5, 0] },
};
function applyPose(name, dur = 1.6) {
  const p = POSES[name];
  const dir = new THREE.Vector3(...p.pos).sub(new THREE.Vector3(...p.tgt));
  const pos = new THREE.Vector3(...p.tgt).addScaledVector(dir, aspectFactor);
  const fromP = camState.basePos.clone(), fromT = camState.baseTgt.clone();
  const toT = new THREE.Vector3(...p.tgt);
  camState.poseName = name;
  if (dur <= 0) {
    camState.basePos.copy(pos); camState.baseTgt.copy(toT);
    return;
  }
  tween({
    dur, ease: easeInOut,
    update: (k) => {
      camState.basePos.lerpVectors(fromP, pos, k);
      camState.baseTgt.lerpVectors(fromT, toT, k);
    },
  });
}

// ---------------------------------------------------------------- UI
const hintEl = document.getElementById('hint');
const starsEl = document.getElementById('stars');
const starEls = starsEl.querySelectorAll('.st');
let hintTimer = null;
function say(text, sticky = true) {
  hintEl.textContent = text;
  hintEl.classList.add('show');
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  if (!sticky) hintTimer = setTimeout(() => hintEl.classList.remove('show'), 3800);
}
function setStars(n) {
  starEls.forEach((el, i) => el.classList.toggle('on', i < n));
}

// ---------------------------------------------------------------- game state machine
let phase = 'title';
let phaseT = 0;
let taskIndex = 0;
let starsDone = 0;
let oilDone = false, chainDone = false, signalDone = false, coupled = false;
let leafAngle = 0;      // 0..1
let barrierT = 1;       // 0 closed .. 1 open
let leverT = 0;
let leverLocked = false;
let roundCount = 0;
let trafficOpen = true;
let gearSqueakT = 0;
let waitHornT = 6;
let gullT = 8;

const TASKS = [
  {
    name: 'oil',
    hint: 'はぐるまに あぶらを さそう！\nはぐるまを タップ！',
    pose: 'oil',
    markerPos: () => new THREE.Vector3(11.05, 1.5, 5.5), markerR: 1.6,
    hit: () => [hits.oil],
  },
  {
    name: 'chain',
    hint: 'さびた くさりを あたらしく しよう！\nくさりを タップ！',
    pose: 'chain',
    markerPos: () => { V_A.set(0, 0, 0); chains[3].mesh.getWorldPosition(V_A); return V_A.clone(); }, markerR: 1.4,
    hit: () => [hits.chain],
  },
  {
    name: 'signal',
    hint: 'しんごうの でんきが きれてるよ！\nしんごうを タップ！',
    pose: 'signal',
    markerPos: () => new THREE.Vector3(10.1, 6.6, 4.75), markerR: 1.3,
    hit: () => [hits.signal],
  },
  {
    name: 'trash',
    hint: 'すいもんの ごみを ぜんぶ とろう！\nごみを タップ！',
    pose: 'trash',
    markerPos: () => {
      const t = trashItems.find(t => !t.taken);
      return t ? t.mesh.position.clone() : new THREE.Vector3();
    }, markerR: 1.0,
    hit: () => hits.trash.filter((h, i) => !trashItems[i].taken),
  },
  {
    name: 'coupling',
    hint: 'ひだりと みぎの きかいを つなごう！\nまんなかを タップ！',
    pose: 'coupling',
    markerPos: () => new THREE.Vector3(0, shaftY, shaftZ), markerR: 1.5,
    hit: () => [hits.coupling],
  },
];

function startTask(i) {
  taskIndex = i;
  const t = TASKS[i];
  applyPose(t.pose, 1.7);
  setTimeout(() => { if (phase === 'tasks' && taskIndex === i) say(t.hint); }, 500);
  showMarker(t.markerPos, t.markerR);
}

function taskComplete() {
  starsDone++;
  setStars(starsDone);
  sfx.chime(starsDone);
  hideMarker();
  if (taskIndex + 1 < TASKS.length) {
    setTimeout(() => { if (phase === 'tasks') startTask(taskIndex + 1); }, 1100);
  } else {
    setTimeout(() => { if (phase === 'tasks') enterLeverPhase(true); }, 1100);
  }
}

function enterLeverPhase(first) {
  phase = 'lever'; phaseT = 0;
  leverLocked = false;
  applyPose('lever', 1.8);
  say(first ? 'じゅんび かんりょう！\nおおきな レバーを したに ひっぱろう！'
            : 'また ふねが きたよ！\nレバーを したに ひっぱろう！');
  showMarker(() => { V_A.set(0, 0, 0); lever.userData.knob.getWorldPosition(V_A); return V_A.clone(); }, 1.0);
  lever.userData.knob.material.emissiveIntensity = 1.2;
}

function triggerBridge() {
  leverLocked = true;
  hideMarker();
  lever.userData.knob.material.emissiveIntensity = 0.15;
  sfx.clank(true);
  if (navigator.vibrate) navigator.vibrate(60);
  setStars(6);
  starsDone = 6;
  phase = 'barriers_down'; phaseT = 0;
  say('カンカンカン！ ふみきりが おりるよ！', false);
  sfx.bellStart();
  setCarSignals(false);
  trafficOpen = false;
  setLamp(boatSignal.userData.red, true);
  setTimeout(() => applyPose('spectate', 3.2), 1300);
  camState.shake = 0.02;
}

function roadClear() {
  return cars.every(c => c.prog < -12.9 || c.prog > 11.5)
    && people.every(p => p.prog < -12.9 || p.prog > 11.5);
}

// per-frame phase logic
function stepPhase(dt) {
  phaseT += dt;
  switch (phase) {
    case 'barriers_down': {
      barrierT = Math.max(0, barrierT - dt / 2.2);
      setBarrierAngle(easeInOut(barrierT));
      if (barrierT <= 0 && phaseT > 2.6 && roadClear()) {
        phase = 'bridge_up'; phaseT = 0;
        sfx.bellStop();
        sfx.motorStart();
        sfx.horn(1.2, 0.4);
        say('はしが あがるよ！ ゴゴゴゴ…', false);
        camState.shake = 0.05;
      }
      break;
    }
    case 'bridge_up': {
      const k = Math.min(1, phaseT / 9.5);
      setLeaf(easeInOut(k));
      if (k >= 1) {
        phase = 'ship_pass'; phaseT = 0;
        sfx.motorStop();
        camState.shake = 0;
        setLamp(boatSignal.userData.red, false);
        setLamp(boatSignal.userData.green, true);
        shipState.mode = 'passing';
        sfx.horn(2.2, 0.6);
        say('おおきな ふねが とおるよ！', false);
        applyPose('shipwatch', 2.5);
        camState.followShip = true;
      }
      break;
    }
    case 'ship_pass': {
      if (shipState.z * shipState.dir > 34) {
        phase = 'bridge_down'; phaseT = 0;
        camState.followShip = false;
        sfx.motorStart();
        setLamp(boatSignal.userData.green, false);
        setLamp(boatSignal.userData.red, true);
        say('はしが おりてくるよ！', false);
        applyPose('spectate', 2.0);
        camState.shake = 0.045;
      }
      break;
    }
    case 'bridge_down': {
      const k = Math.min(1, phaseT / 8);
      setLeaf(1 - easeInOut(k));
      if (k >= 1) {
        phase = 'barriers_up'; phaseT = 0;
        sfx.motorStop();
        sfx.clank(true);
        camState.shake = 0;
        sfx.bellStart();
        setTimeout(() => sfx.bellStop(), 1600);
      }
      break;
    }
    case 'barriers_up': {
      barrierT = Math.min(1, barrierT + dt / 1.8);
      setBarrierAngle(easeInOut(barrierT));
      if (barrierT >= 1) {
        phase = 'celebrate'; phaseT = 0;
        trafficOpen = true;
        setCarSignals(true);
        sfx.fanfare();
        say('やったね！ まちが うごきだした！', false);
        applyPose('celebrate', 2.0);
        for (let i = 0; i < 50; i++) {
          const pos = new THREE.Vector3((Math.random() - 0.5) * 22, 8 + Math.random() * 6, (Math.random() - 0.5) * 14);
          const vel = new THREE.Vector3((Math.random() - 0.5) * 2, -1.2 - Math.random(), (Math.random() - 0.5) * 2);
          spawn(confetti, pos, vel, 2.5 + Math.random() * 2, 0.25 + Math.random() * 0.25, 0.1,
            confColors[i % confColors.length]);
        }
      }
      break;
    }
    case 'celebrate': {
      if (phaseT > 4.5) {
        roundCount++;
        // new ship waits on the other side; lever resets
        shipState.dir = roundCount % 2 === 0 ? 1 : -1;
        shipState.z = -46 * shipState.dir;
        shipState.speed = 0;
        shipState.mode = 'waiting';
        const from = leverT;
        tween({ dur: 1.2, update: k => { leverT = from * (1 - k); setLeverT(leverT); } });
        enterLeverPhase(false);
      }
      break;
    }
  }
}

function setLeaf(t) {
  const prev = leafAngle;
  leafAngle = t;
  const a = t * OPEN_ANGLE;
  leafL.rotation.z = a;
  leafR.rotation.z = -a;
  towerL.userData.beams.rotation.z = a;
  towerR.userData.beams.rotation.z = -a;
  const d = (t - prev);
  bigGear.rotation.z += d * 22;
  smallGear.rotation.z -= d * 22 * (1.15 / 0.55);
  // spinning about local X keeps the tilted cylinder's axis fixed (its length axis)
  const spin = d * 40;
  shaftL.rotation.x += spin;
  shaftR.rotation.x += spin;
  flangeL.rotation.x += spin; flangeR.rotation.x += spin;
}

// ---------------------------------------------------------------- task actions
function doOil() {
  if (oilDone) return;
  oilDone = true;
  sfx.tap();
  // oil can flies in, tips, pours, gear gets shiny
  oilCan.visible = true;
  oilCan.position.set(11.0, 4.6, 5.9);
  oilCan.rotation.z = 0;
  tween({ dur: 0.7, ease: easeOut, update: k => { oilCan.position.y = 4.6 - k * 2.1; } });
  tween({
    dur: 0.6, delay: 0.7, update: k => { oilCan.rotation.z = -k * 0.9; },
    done: () => {
      sfx.pour();
      let drops = 0;
      const dropTimer = setInterval(() => {
        spawn(sparkles, new THREE.Vector3(11.5, 2.4, 5.5),
          new THREE.Vector3((Math.random() - 0.5) * 0.4, -2.2, (Math.random() - 0.5) * 0.4),
          0.5, 0.22, 0, 0xe8a52a);
        if (++drops > 8) clearInterval(dropTimer);
      }, 90);
    },
  });
  tween({
    dur: 0.7, delay: 2.0, update: k => { oilCan.rotation.z = -0.9 + k * 0.9; oilCan.position.y = 2.5 + k * 2.4; },
    done: () => {
      oilCan.visible = false;
      // gears become clean & spin happily for a moment
      [bigGear, smallGear].forEach(g => g.traverse(o => { if (o.isMesh && o.material === gearRust) o.material = gearOiled; }));
      burst(new THREE.Vector3(11.05, 1.6, 5.6), 12);
      const t0 = bigGear.rotation.z;
      tween({ dur: 1.4, update: k => { bigGear.rotation.z = t0 + k * 2.6; smallGear.rotation.z = -k * 2.6 * 2.1; } });
      say('ピカピカ！ よく まわるね！', false);
      taskComplete();
    },
  });
}

function doChain() {
  if (chainDone) return;
  chainDone = true;
  sfx.clank();
  // old chains drop into the canal, new shiny ones grow in
  for (const ch of chains) {
    const m = ch.mesh;
    const fall = m.clone();
    fall.material = chainOld;
    scene.add(fall);
    m.material = chainNew;
    m.scale.y = 0.001;
    m.userData.grow = 0.001;
    const fx = fall.position.x, fy = fall.position.y;
    tween({
      dur: 0.9, ease: t => t * t, update: k => { fall.position.y = fy - k * (fy - WATER_Y + 0.5); fall.rotation.z += 0.06; },
      done: () => { scene.remove(fall); sfx.splash(); spawn(foams, new THREE.Vector3(fx, WATER_Y + 0.05, fall.position.z), new THREE.Vector3(), 1.6, 1.2, 2.4); },
    });
  }
  tween({ dur: 1.1, delay: 0.9, ease: easeOutBack, update: k => { for (const ch of chains) ch.mesh.userData.grow = Math.max(0.001, k); } });
  setTimeout(() => {
    burst(new THREE.Vector3(0.8, 5.0, 2.8), 10);
    say('あたらしい くさり、ピッカピカ！', false);
    taskComplete();
  }, 2100);
}

function doSignal() {
  if (signalDone) return;
  signalDone = true;
  sfx.tap();
  let flick = 0;
  const iv = setInterval(() => {
    setLamp(boatSignal.userData.red, flick % 2 === 0);
    sfx.ratchet();
    if (++flick > 5) {
      clearInterval(iv);
      setLamp(boatSignal.userData.red, true);
      burst(new THREE.Vector3(10.1, 6.6, 4.9), 12);
      say('しんごう てんとう！ あかは 「とまれ」だよ', false);
      taskComplete();
    }
  }, 160);
}

function doTrash(i) {
  const t = trashItems[i];
  if (t.taken) return;
  t.taken = true;
  sfx.splash();
  const m = t.mesh;
  const from = m.position.clone();
  const to = bin.position.clone().setY(1.2);
  tween({
    dur: 0.85, ease: easeInOut,
    update: (k) => {
      m.position.lerpVectors(from, to, k);
      m.position.y = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * 2.2;
      m.rotation.y += 0.15; m.rotation.x += 0.1;
      m.scale.setScalar(1 - k * 0.5);
    },
    done: () => {
      m.visible = false;
      burst(bin.position.clone().setY(1.3), 8);
      const left = trashItems.filter(t => !t.taken).length;
      if (left > 0) {
        sfx.chime(3 - left);
        say(left === 1 ? 'あと ひとつ！' : `あと ${left}こ！`, false);
      } else {
        say('みずが きれいに なった！', false);
        taskComplete();
      }
    },
  });
}

function doCouple() {
  if (coupled) return;
  coupled = true;
  sfx.tap();
  tween({
    dur: 0.9, ease: easeInOut,
    update: k => {
      const gap = 0.8 - k * 0.62;
      flangeL.position.x = -gap; flangeR.position.x = gap;
      shaftL.position.x = -5.3 + k * 0.55;
      shaftR.position.x = 5.3 - k * 0.55;
    },
    done: () => {
      sfx.clank(true);
      burst(new THREE.Vector3(0, shaftY, shaftZ), 14);
      // both shafts give a happy test spin
      tween({ dur: 1.2, update: k => { const s = k * 4; shaftL.rotation.x = s; shaftR.rotation.x = s; flangeL.rotation.x = s; flangeR.rotation.x = s; } });
      say('ガッチャン！ つながった！', false);
      taskComplete();
    },
  });
}

// ---------------------------------------------------------------- input
const raycaster = new THREE.Raycaster();
raycaster.layers.enableAll();
const pointer = new THREE.Vector2();
let dragging = false;
let dragStartY = 0;
let dragStartT = 0;

function pick(clientX, clientY, objects) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(objects, false);
}

function onDown(e) {
  if (phase === 'title') return;
  const x = e.clientX, y = e.clientY;
  if (window.__dbg) window.__dbg.lastDown = { x, y, phase, taskIndex, t: performance.now() };
  if (phase === 'tasks') {
    const t = TASKS[taskIndex];
    const hs = t.hit();
    const hit = pick(x, y, hs);
    if (window.__dbg) window.__dbg.lastDown.hits = hit.length;
    if (hit.length > 0) {
      if (t.name === 'oil') doOil();
      else if (t.name === 'chain') doChain();
      else if (t.name === 'signal') doSignal();
      else if (t.name === 'coupling') doCouple();
      else if (t.name === 'trash') {
        const idx = hits.trash.indexOf(hit[0].object);
        if (idx >= 0) doTrash(idx);
      }
    } else {
      sfx.tap();
    }
  } else if (phase === 'lever' && !leverLocked) {
    const hit = pick(x, y, [hits.lever]);
    if (hit.length > 0) {
      dragging = true;
      dragStartY = y;
      dragStartT = leverT;
      hideMarker();
      try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }
}
let lastRatchet = 0;
function onMove(e) {
  if (!dragging) return;
  const dy = e.clientY - dragStartY;
  const nt = Math.max(0, Math.min(1, dragStartT + dy / (window.innerHeight * 0.3)));
  if (Math.floor(nt * 8) !== lastRatchet) { lastRatchet = Math.floor(nt * 8); sfx.ratchet(); if (navigator.vibrate) navigator.vibrate(8); }
  leverT = nt;
  setLeverT(leverT);
  if (leverT >= 0.98) {
    dragging = false;
    triggerBridge();
  }
}
function onUp() {
  if (!dragging) return;
  dragging = false;
  if (!leverLocked) {
    const from = leverT;
    tween({ dur: 0.5, ease: easeOut, update: k => { leverT = from * (1 - k); setLeverT(leverT); } });
    showMarker(() => { V_A.set(0, 0, 0); lever.userData.knob.getWorldPosition(V_A); return V_A.clone(); }, 1.0);
  }
}
renderer.domElement.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('dblclick', e => e.preventDefault());

// title
document.getElementById('title').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (phase !== 'title') return;
  sfx.unlock();
  document.getElementById('title').classList.add('hide');
  phase = 'tasks'; phaseT = 0;
  setCarSignals(true);
  say('ふねが まってるよ！ はしの じゅんびを しよう！', false);
  setTimeout(() => { if (phase === 'tasks') startTask(0); }, 2600);
  applyPose('overview', 0);
  camState.pos.copy(camState.basePos);
  camState.tgt.copy(camState.baseTgt);
});

// ---------------------------------------------------------------- resize
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  computeAspectFactor();
  camera.updateProjectionMatrix();
  if (camState.poseName) applyPose(camState.poseName, 0.01);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
computeAspectFactor();
applyPose('overview', 0);
camState.pos.copy(camState.basePos);
camState.tgt.copy(camState.baseTgt);

// ---------------------------------------------------------------- main loop
let perfNow = 0;
const clock = new THREE.Clock();
const shipFollowTgt = new THREE.Vector3();
// fixed timestep for automated testing on slow software renderers (?fixeddt=0.25)
const FIXED_DT = parseFloat(new URLSearchParams(location.search).get('fixeddt')) || 0;

function animate() {
  const dt = FIXED_DT || Math.min(clock.getDelta(), 0.066);
  perfNow += dt;
  stepTweens(dt);
  if (phase !== 'title') stepPhase(dt);

  // world life
  water.update(perfNow);
  carUpdate(dt, trafficOpen);
  peopleUpdate(dt, trafficOpen);
  shipUpdate(dt);
  windmill.userData.blades.rotation.z += dt * 0.35;
  clouds.children.forEach((c, i) => {
    c.position.x += dt * (0.35 + i * 0.06);
    if (c.position.x > 200) c.position.x = -220;
  });
  for (const b of birds) {
    b.ph += dt * b.speed * 4;
    const a = b.ph * 0.5;
    b.g.position.set(Math.cos(a) * b.r, b.h + Math.sin(b.ph * 0.7) * 1.5, -20 + Math.sin(a) * b.r);
    b.g.rotation.y = -a + Math.PI / 2;
    const flap = Math.sin(perfNow * 8 + b.ph) * 0.5;
    b.w1.rotation.x = flap; b.w2.rotation.x = -flap;
  }
  // flags wave
  for (const f of flags) {
    const pos = f.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = f.base[i * 3], by = f.base[i * 3 + 1];
      const w = (bx + 0.75) / 1.5;
      pos.setZ(i, Math.sin(bx * 4 + perfNow * 6) * 0.09 * w + Math.sin(by * 3 + perfNow * 4) * 0.04 * w);
    }
    pos.needsUpdate = true;
    f.mesh.geometry.computeVertexNormals();
  }
  // chains follow machinery; growth animation for the new chain
  updateChains();
  for (const ch of chains) {
    if (ch.mesh.userData.grow !== undefined && ch.mesh.userData.grow < 1) {
      ch.mesh.scale.y *= Math.max(ch.mesh.userData.grow, 0.001);
    }
  }
  // trash bobbing
  for (const t of trashItems) {
    if (t.taken) continue;
    t.mesh.position.y = WATER_Y + 0.1 + Math.sin(perfNow * 1.3 + t.phase) * 0.06;
    t.mesh.rotation.y += dt * 0.1;
  }
  // moored boat bobbing
  if (mooredBoat) {
    mooredBoat.position.y = WATER_Y + Math.sin(perfNow * 1.1 + 2) * 0.07;
    mooredBoat.rotation.z = Math.sin(perfNow * 0.9) * 0.03;
  }
  // ship wake + smoke
  if (shipState.mode !== 'gone' && ship.visible) {
    if (shipState.speed > 0.4 && Math.random() < dt * 18) {
      const back = shipState.dir > 0 ? -13.6 : 13.6;
      spawn(foams, new THREE.Vector3((Math.random() - 0.5) * 4.0, WATER_Y + 0.04, shipState.z + back),
        new THREE.Vector3((Math.random() - 0.5) * 0.7, 0, -shipState.dir * 0.6), 3.2, 1.1, 4.0);
      const bowZ = shipState.dir > 0 ? 12.6 : -12.6;
      spawn(foams, new THREE.Vector3((Math.random() < 0.5 ? -1.6 : 1.6), WATER_Y + 0.04, shipState.z + bowZ),
        new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * 1.0, 0, shipState.dir * 0.9), 2.0, 0.6, 2.6);
      // side wash along the parallel mid-body
      spawn(foams, new THREE.Vector3((Math.random() < 0.5 ? -3.25 : 3.25), WATER_Y + 0.04,
        shipState.z + (Math.random() - 0.5) * 16),
        new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * 0.4, 0, 0), 1.6, 0.45, 1.6);
    }
    const puffRate = shipState.mode === 'passing' ? 3.2 : 1.1;
    if (Math.random() < dt * puffRate) {
      const fz = shipState.z + (shipState.dir > 0 ? -10.6 : 10.6);
      spawn(smokes, new THREE.Vector3(0, WATER_Y + 8.8, fz),
        new THREE.Vector3((Math.random() - 0.5) * 0.4 + 0.5, 1.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4), 3.2, 1.0, 3.0);
    }
  }
  stepPool(sparkles, dt, 3);
  stepPool(smokes, dt, -0.05);
  stepPool(foams, dt, 0);
  stepPool(confetti, dt, 0.4);

  // barrier lamps blink while traffic is stopped
  if (!trafficOpen) {
    const blink = Math.floor(perfNow * 2.5) % 2 === 0;
    barriers.forEach((b, i) => {
      setLamp(b.userData.lamps[0], blink !== (i === 1), 0.9);
      setLamp(b.userData.lamps[1], blink === (i === 1), 0.9);
    });
  } else {
    barriers.forEach(b => { setLamp(b.userData.lamps[0], false); setLamp(b.userData.lamps[1], false); });
  }

  // rusty gear wiggles & squeaks until oiled
  if (phase === 'tasks' && !oilDone) {
    gearSqueakT -= dt;
    bigGear.rotation.z = Math.sin(perfNow * 2.2) * 0.05;
    if (gearSqueakT <= 0) { sfx.squeak(); gearSqueakT = 3.4; }
  }
  // waiting ship honks now and then (come open the bridge!)
  if (shipState.mode === 'waiting' && (phase === 'tasks' || phase === 'lever')) {
    waitHornT -= dt;
    if (waitHornT <= 0) { sfx.horn(0.7); waitHornT = 15 + Math.random() * 6; }
  }
  gullT -= dt;
  if (gullT <= 0) { sfx.gullCry(); gullT = 12 + Math.random() * 14; }

  // lever knob pulse while waiting
  if (phase === 'lever' && !leverLocked && !dragging) {
    lever.userData.knob.material.emissiveIntensity = 0.8 + Math.sin(perfNow * 4) * 0.5;
  }

  // marker
  if (markerTarget) {
    const p = markerTarget.getPos();
    marker.position.copy(p);
    const s = markerTarget.r * (1 + Math.sin(perfNow * 5) * 0.12);
    marker.userData.ring.scale.setScalar(s);
    marker.userData.cone.position.y = markerTarget.r + 0.8 + Math.abs(Math.sin(perfNow * 3.2)) * 0.45;
    marker.rotation.y += dt * 1.2;
  }

  // camera
  camState.pos.lerp(camState.basePos, Math.min(1, dt * 5));
  if (camState.followShip && ship.visible) {
    shipFollowTgt.set(0, 3, THREE.MathUtils.clamp(shipState.z * 0.45, -14, 14));
    camState.tgt.lerp(shipFollowTgt, Math.min(1, dt * 2));
  } else {
    camState.tgt.lerp(camState.baseTgt, Math.min(1, dt * 5));
  }
  const sway = phase === 'title' ? 0.6 : 0.14;
  camera.position.set(
    camState.pos.x + Math.sin(perfNow * 0.31) * sway,
    camState.pos.y + Math.sin(perfNow * 0.43) * sway * 0.5 + (camState.shake ? (Math.random() - 0.5) * camState.shake * 2 : 0),
    camState.pos.z + Math.cos(perfNow * 0.27) * sway,
  );
  if (camState.shake) {
    camera.position.x += (Math.random() - 0.5) * camState.shake;
    camera.position.z += (Math.random() - 0.5) * camState.shake;
  }
  camera.lookAt(camState.tgt);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// ---------------------------------------------------------------- debug hooks (for automated testing)
window.__dbg = {
  phase: () => phase,
  taskIndex: () => taskIndex,
  stars: () => starsDone,
  leafAngle: () => leafAngle,
  ship: () => ({ ...shipState }),
  screenPos(name) {
    let obj = null;
    if (name === 'lever') obj = hits.lever;
    else if (name.startsWith('trash')) obj = hits.trash[parseInt(name.slice(5), 10) || 0];
    else obj = hits[name];
    if (!obj) return null;
    const v = new THREE.Vector3();
    if (name.startsWith('trash')) {
      const i = parseInt(name.slice(5), 10) || 0;
      v.copy(trashItems[i].mesh.position);
    } else obj.getWorldPosition(v);
    v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, behind: v.z > 1 };
  },
  trashLeft: () => trashItems.filter(t => !t.taken).length,
  flags: () => ({ oilDone, chainDone, signalDone, coupled, tweens: tweens.length, oilCanVis: oilCan.visible }),
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
    geoms: renderer.info.memory.geometries, tex: renderer.info.memory.textures }),
  skipToLever() { // test helper: mark tasks done and jump to the lever phase
    if (phase !== 'tasks') return;
    oilDone = chainDone = signalDone = coupled = true;
    trashItems.forEach(t => { t.taken = true; t.mesh.visible = false; });
    starsDone = 5; setStars(5);
    enterLeverPhase(true);
  },
  lastDown: null,
  ray(x, y, name) {
    const obj = name === 'lever' ? hits.lever : name.startsWith('trash') ? hits.trash[parseInt(name.slice(5), 10) || 0] : hits[name];
    const r = pick(x, y, [obj]);
    return { n: r.length, dist: r[0] && r[0].distance };
  },
};
