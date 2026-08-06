// 会場装花ゲーム本体：フェーズ進行・入力（一指操作）・カメラ・演出。
// 文字なし／失敗なし。準備中は扉とカーテンで全体像を隠し、最後に大扉が開いてフィナーレ。

import * as THREE from 'three';
import { GameAudio } from './audio.js';
import { FlowerSystem, FLOWER_COLORS, makeBow, makeLoosePetalGeometry } from './flowers.js';
import { buildWorld } from './world.js';

// ---------- 基盤 ----------

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const PREP_FOG = new THREE.Color(0x241f2b);
const PARTY_FOG = new THREE.Color(0xf0ddc4);
scene.fog = new THREE.Fog(PREP_FOG.clone(), 6, 30);
scene.background = PREP_FOG.clone();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 90);
const camLook = new THREE.Vector3(0, 1.2, 6.3);
camera.position.set(0, 1.5, 8.6);

const audio = new GameAudio();
const world = buildWorld(scene, renderer);
const flowers = new FlowerSystem(scene);

// ---------- 汎用トゥイーン ----------

const tweens = [];
const smooth = (k) => k * k * (3 - 2 * k);
function tween(dur, fn, { delay = 0, ease = smooth, done = null } = {}) {
  tweens.push({ t: -delay, dur, fn, ease, done });
}
function schedule(d, fn) { tween(0.001, () => {}, { delay: d, done: fn }); }
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.ease(k));
    if (k >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
  }
}

// ---------- カメラショット ----------

const SHOTS = {
  pickType: { pos: [0, 1.52, 8.5], look: [0, 1.18, 6.35], fov: 42, maxF: 1.5, light: [[0.6, 4.2, 8.0], [0, 1, 6.5]] },
  stems:    { pos: [0, 1.62, 8.6], look: [0, 1.42, 6.5], fov: 42, maxF: 1.5, light: [[0.6, 4.2, 8.0], [0, 1.5, 6.5]] },
  water:    { pos: [0, 1.95, 8.6], look: [0, 0.95, 6.5], fov: 46, maxF: 1.4, light: [[0.6, 4.2, 8.0], [0, 1, 6.5]] },
  arch:     { pos: [0, 1.7, -5.3], look: [0, 1.75, -9.3], fov: 50, maxF: 1.9, light: [[0, 4.6, -5.6], [0, 1.6, -9.3]] },
  table:    { pos: [3.4, 2.0, 0.35], look: [3.4, 0.8, -2.2], fov: 45, maxF: 1.6, light: [[3.4, 4.2, -0.6], [3.4, 0.9, -2.2]] },
  hang:     { pos: [0, 1.35, 0.9], look: [0, 4.7, -4.5], fov: 54, maxF: 1.0, light: [[2.2, 3.0, -1.0], [0, 5.6, -4.5]] },
  doors:    { pos: [0, 1.7, 14.7], look: [0, 2.1, 10], fov: 46, maxF: 1.3, light: [[0, 4.4, 13.8], [0, 1.6, 10.2]] },
  finale:   { pos: [0, 2.35, 6.9], look: [0, 1.95, -5.5], fov: 50, maxF: 1.15, light: [[0, 4.4, 5], [0, 1, -3]] },
};
let currentShotName = 'pickType';

function aspectFactor() {
  const a = window.innerWidth / window.innerHeight;
  return a < 1.35 ? Math.min(2.1, Math.pow(1.35 / a, 0.55)) : 1;
}
function shotVectors(name) {
  const s = SHOTS[name];
  const desired = aspectFactor();
  const f = Math.min(desired, s.maxF || 2.1);
  const look = new THREE.Vector3(...s.look);
  const pos = new THREE.Vector3(...s.pos).sub(look).multiplyScalar(f).add(look);
  // 後退しきれない分は画角を広げる（縦画面対応）
  const fov = Math.min(78, s.fov * (1 + (desired / f - 1) * 1.2));
  return { pos, look, fov };
}
function applyShot(name, dur = 1.4, done = null) {
  currentShotName = name;
  const from = { pos: camera.position.clone(), look: camLook.clone(), fov: camera.fov };
  const to = shotVectors(name);
  const s = SHOTS[name];
  if (s.light) {
    const lf = world.workLight.position.clone();
    const tf = world.workLight.target.position.clone();
    tween(Math.max(0.5, dur * 0.8), (k) => {
      world.workLight.position.lerpVectors(lf, new THREE.Vector3(...s.light[0]), k);
      world.workLight.target.position.lerpVectors(tf, new THREE.Vector3(...s.light[1]), k);
    });
  }
  if (dur <= 0.01) {
    camera.position.copy(to.pos); camLook.copy(to.look); camera.fov = to.fov;
    camera.updateProjectionMatrix();
    if (done) done();
    return;
  }
  cameraBusy = true;
  tween(dur, (k) => {
    camera.position.lerpVectors(from.pos, to.pos, k);
    camLook.lerpVectors(from.look, to.look, k);
    camera.fov = from.fov + (to.fov - from.fov) * k;
    camera.updateProjectionMatrix();
  }, { done: () => { cameraBusy = false; if (done) done(); } });
}

// ---------- 画面フェード（文字なし・DOMの黒幕） ----------

const fadeDiv = document.createElement('div');
fadeDiv.style.cssText = 'position:fixed;inset:0;background:#0d0a12;opacity:0;pointer-events:none;transition:opacity .45s ease;z-index:5;';
document.body.appendChild(fadeDiv);
function fadeThrough(mid, total = 1.0) {
  inputEnabled = false;
  fadeDiv.style.opacity = '1';
  setTimeout(() => {
    mid();
    fadeDiv.style.opacity = '0';
    setTimeout(() => { inputEnabled = true; }, 480);
  }, total * 500);
}
// カーテンをまたぐ移動は暗転カットで（幕を突き抜けない）
function cutTo(shotName, after) {
  fadeThrough(() => {
    applyShot(shotName, 0.01);
    if (after) schedule(0.25, after);
  });
}

// ---------- パーティクル：きらきら ----------

const SPARK_N = 260;
const sparkGeo = new THREE.BufferGeometry();
const sparkPos = new Float32Array(SPARK_N * 3);
const sparkCol = new Float32Array(SPARK_N * 3);
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
const sparkMat = new THREE.PointsMaterial({
  size: 0.055, map: world.glowTex, transparent: true, depthWrite: false,
  blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true,
});
const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
sparkPoints.frustumCulled = false;
scene.add(sparkPoints);
const sparks = [];
for (let i = 0; i < SPARK_N; i++) sparks.push({ life: 0, max: 1, pos: new THREE.Vector3(0, -100, 0), vel: new THREE.Vector3() });
let sparkNext = 0;
const SPARK_COLORS = [new THREE.Color(0xfff3b8), new THREE.Color(0xffc9e2), new THREE.Color(0xd8c6ff), new THREE.Color(0xbdefff)];
function burstSparkles(p, n = 18, speed = 0.9) {
  for (let i = 0; i < n; i++) {
    const idx = sparkNext; sparkNext = (sparkNext + 1) % SPARK_N;
    const s = sparks[idx];
    s.pos.copy(p);
    s.vel.set((Math.random() - 0.5), Math.random() * 0.9 + 0.15, (Math.random() - 0.5)).multiplyScalar(speed);
    s.life = s.max = 0.6 + Math.random() * 0.6;
    const c = SPARK_COLORS[Math.random() * SPARK_COLORS.length | 0];
    sparkCol[idx * 3] = c.r; sparkCol[idx * 3 + 1] = c.g; sparkCol[idx * 3 + 2] = c.b;
  }
  sparkGeo.attributes.color.needsUpdate = true;
}
function updateSparkles(dt) {
  for (let i = 0; i < SPARK_N; i++) {
    const s = sparks[i];
    if (s.life > 0) {
      s.life -= dt;
      s.vel.y -= dt * 0.9;
      s.pos.addScaledVector(s.vel, dt);
      if (s.life <= 0) s.pos.set(0, -100, 0);
    }
    sparkPos[i * 3] = s.pos.x; sparkPos[i * 3 + 1] = s.pos.y; sparkPos[i * 3 + 2] = s.pos.z;
  }
  sparkGeo.attributes.position.needsUpdate = true;
}

// ---------- 花びらの舞い ----------

const RAIN_N = 460;
const rainMesh = new THREE.InstancedMesh(
  makeLoosePetalGeometry(),
  new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide }),
  RAIN_N
);
rainMesh.count = 0;
rainMesh.frustumCulled = false;
rainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(rainMesh);
const rain = [];
const _rd = new THREE.Object3D();
let rainActive = false;
function startPetalRain(colorHex) {
  const base = new THREE.Color(colorHex);
  const c = new THREE.Color();
  for (let i = 0; i < RAIN_N; i++) {
    rain.push({
      p: new THREE.Vector3((Math.random() - 0.5) * 15, 1 + Math.random() * 6.5, -11 + Math.random() * 19),
      phase: Math.random() * 6.28, spin: 1 + Math.random() * 2.5,
      fall: 0.22 + Math.random() * 0.28, drift: 0.3 + Math.random() * 0.5,
      s: 0.8 + Math.random() * 0.9,
    });
    c.copy(base).offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.22 + 0.08);
    rainMesh.setColorAt(i, c);
  }
  rainMesh.count = RAIN_N;
  if (rainMesh.instanceColor) rainMesh.instanceColor.needsUpdate = true;
  rainActive = true;
}
function burstPetals(p, n = 14) {
  if (!rainActive) return;
  for (let i = 0; i < n; i++) {
    const r = rain[(Math.random() * rain.length) | 0];
    r.p.set(p.x + (Math.random() - 0.5) * 0.3, p.y + Math.random() * 0.4, p.z + (Math.random() - 0.5) * 0.3);
  }
}
function updateRain(dt, t) {
  if (!rainActive) return;
  for (let i = 0; i < RAIN_N; i++) {
    const r = rain[i];
    r.p.y -= r.fall * dt;
    r.p.x += Math.sin(t * 1.1 + r.phase) * r.drift * dt;
    r.p.z += Math.cos(t * 0.8 + r.phase * 1.6) * r.drift * 0.6 * dt;
    if (r.p.y < 0.02) { r.p.y = 5.5 + Math.random() * 1.5; r.p.x = (Math.random() - 0.5) * 15; r.p.z = -11 + Math.random() * 19; }
    _rd.position.copy(r.p);
    _rd.rotation.set(t * r.spin + r.phase, r.phase * 2, t * r.spin * 0.7);
    _rd.scale.setScalar(r.s);
    _rd.updateMatrix();
    rainMesh.setMatrixAt(i, _rd.matrix);
  }
  rainMesh.instanceMatrix.needsUpdate = true;
}

// ---------- 落下物（切った茎など） ----------

const falling = [];
function dropPiece(mesh, floorY, vel = null) {
  scene.add(mesh);
  falling.push({
    mesh, floorY,
    vel: vel || new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.2),
    rot: new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4),
    life: 2.2, landed: false,
  });
}
function updateFalling(dt) {
  for (let i = falling.length - 1; i >= 0; i--) {
    const f = falling[i];
    if (!f.landed) {
      f.vel.y -= 3.5 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.rotation.x += f.rot.x * dt;
      f.mesh.rotation.z += f.rot.z * dt;
      if (f.mesh.position.y <= f.floorY) {
        f.mesh.position.y = f.floorY;
        f.landed = true;
        f.mesh.rotation.x = Math.PI / 2 * Math.sign(f.mesh.rotation.x || 1);
      }
    } else {
      f.life -= dt;
      if (f.life < 0.6) {
        f.mesh.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = f.life / 0.6; } });
      }
      if (f.life <= 0) { scene.remove(f.mesh); falling.splice(i, 1); }
    }
  }
}

// ---------- 波紋（水） ----------

function ripple(p) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.02, 0.03, 24),
    new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.copy(p);
  scene.add(m);
  tween(0.7, (k) => { m.scale.setScalar(1 + k * 5); m.material.opacity = 0.9 * (1 - k); },
    { done: () => scene.remove(m) });
}

// ---------- 入力とターゲット ----------

const raycaster = new THREE.Raycaster();
raycaster.layers.set(1);
const pointer = new THREE.Vector2();
let hitTargets = []; // {sphere, marker, data}
let cameraBusy = false;
let inputEnabled = true;
let dragging = null;
let lastInteract = 0;
const hitGeo = new THREE.SphereGeometry(1, 8, 6);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });

function addTarget(pos, r, data, markerPos = null) {
  const sphere = new THREE.Mesh(hitGeo, hitMat);
  sphere.scale.setScalar(r);
  sphere.position.copy(pos);
  sphere.layers.set(1);
  scene.add(sphere);
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({
    map: world.glowTex, color: 0xffe9a8, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  }));
  marker.scale.setScalar(r * 1.15);
  marker.position.copy(markerPos || pos);
  marker.userData.baseScale = r * 1.15;
  marker.userData.phase = Math.random() * 6.28;
  scene.add(marker);
  const t = { sphere, marker, data };
  hitTargets.push(t);
  return t;
}
function removeTarget(t) {
  scene.remove(t.sphere, t.marker);
  const i = hitTargets.indexOf(t);
  if (i >= 0) hitTargets.splice(i, 1);
}
function clearTargets() { while (hitTargets.length) removeTarget(hitTargets[0]); }

function updateMarkers(t) {
  const boost = (t - lastInteract > 7) ? 1.6 : 1;
  for (const h of hitTargets) {
    const s = h.marker.userData.baseScale * (1 + 0.25 * boost * Math.sin(t * 3.2 + h.marker.userData.phase));
    h.marker.scale.setScalar(s);
    h.marker.material.opacity = 0.55 + 0.35 * Math.sin(t * 3.2 + h.marker.userData.phase) * boost * 0.5 + 0.2;
  }
}

let activePointer = null;
function toNDC(e) {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
}
function pickTarget() {
  raycaster.setFromCamera(pointer, camera);
  const objs = hitTargets.map(h => h.sphere);
  const hits = raycaster.intersectObjects(objs, false);
  if (!hits.length) return null;
  return hitTargets.find(h => h.sphere === hits[0].object) || null;
}
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function missSparkle() {
  raycaster.setFromCamera(pointer, camera);
  const p = new THREE.Vector3();
  raycaster.ray.at(2.2, p);
  burstSparkles(p, 8, 0.5);
  audio.tap();
  if (phaseName === 'party') { burstPetals(p, 10); }
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (activePointer !== null) return; // 一指のみ
  activePointer = e.pointerId;
  audio.unlock();
  if (audio.mode === 'off' && phaseName !== 'party') audio.setMode('prep');
  if (!inputEnabled || cameraBusy) return;
  lastInteract = clockTime;
  toNDC(e);
  const hit = pickTarget();
  if (hit) {
    if (hit.data.drag) {
      dragging = hit;
      hit.data.onGrab && hit.data.onGrab(hit);
    } else {
      hit.data.onTap(hit);
    }
  } else {
    missSparkle();
  }
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer || !dragging) return;
  toNDC(e);
  dragging.data.onDrag && dragging.data.onDrag(dragging);
});
function endPointer(e) {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  if (dragging) {
    const d = dragging; dragging = null;
    d.data.onDrop && d.data.onDrop(d);
  }
}
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', endPointer);

// ---------- ゲーム状態 ----------

let phaseName = 'loading';
const chosen = { type: null, colorIdx: 0 };
const chosenColor = () => FLOWER_COLORS[chosen.colorIdx];
let clockTime = 0;

// つる下げボール等、後で使う参照
const swayPivots = [];
const stemRigs = [];
let scissors = null;

// ---------- 小物ビルダー ----------

const potMat = new THREE.MeshStandardMaterial({ color: 0xc06a4a, roughness: 0.8 });
function makePot() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.09, 12), potMat);
  body.position.y = 0.045;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.072, 0.025, 12), potMat);
  rim.position.y = 0.095;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.02, 12),
    new THREE.MeshStandardMaterial({ color: 0x3d2b1c, roughness: 1 }));
  soil.position.y = 0.095;
  g.add(body, rim, soil);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xeaf6ff, transparent: true, opacity: 0.3, roughness: 0.06, metalness: 0, side: THREE.DoubleSide,
});
const waterMat = new THREE.MeshPhysicalMaterial({
  color: 0x7cc4de, transparent: true, opacity: 0.35, roughness: 0.1,
});
function makeVase() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.17, 14, 1, true), glassMat);
  body.position.y = 0.085;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.042, 14), glassMat);
  bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.004;
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.04, 0.1, 14), waterMat);
  water.position.y = 0.055;
  g.add(body, bottom, water);
  return g;
}

const stemMat = new THREE.MeshStandardMaterial({ color: 0x4c7a35, roughness: 0.6 });
const stemGeoUnit = new THREE.CylinderGeometry(0.0045, 0.0055, 1, 7);
stemGeoUnit.translate(0, -0.5, 0); // 原点＝上端
function makeStem(len) {
  const m = new THREE.Mesh(stemGeoUnit, stemMat);
  m.scale.y = len;
  m.castShadow = true;
  return m;
}

const leafGeoS = new THREE.PlaneGeometry(0.03, 0.07);
leafGeoS.translate(0, 0.035, 0);
const leafMatS = new THREE.MeshStandardMaterial({ color: 0x55853d, roughness: 0.7, side: THREE.DoubleSide });

function makeScissors() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8c2c8, roughness: 0.25, metalness: 0.85 });
  const grip = new THREE.MeshStandardMaterial({ color: 0xe86f9a, roughness: 0.5 });
  for (const s of [-1, 1]) {
    const half = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.11, 0.006), metal);
    blade.position.y = 0.055;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.007, 8, 14), grip);
    ring.position.y = -0.035;
    half.add(blade, ring);
    half.rotation.z = s * 0.28;
    half.userData.side = s;
    g.add(half);
  }
  g.userData.setOpen = (o) => {
    for (const h of g.children) h.rotation.z = h.userData.side * (0.08 + o * 0.3);
  };
  return g;
}

// 選んだ色に近いゆらぎ色
function jitterColor(amount = 0.05) {
  return new THREE.Color(chosenColor()).offsetHSL((Math.random() - 0.5) * amount, 0, (Math.random() - 0.5) * 0.1).getHex();
}

// テーブル装花（1卓分）：花器＋花（count本）
function makeTableArrangement(colorHex, count = 5) {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.055, 0.075, 14), potMat.clone());
  bowl.material.color.set(0xd8cfc0);
  bowl.position.y = 0.038;
  bowl.castShadow = true;
  g.add(bowl);
  const handles = [];
  const dirs = [[0, 1, 0.001], [0.8, 0.75, 0], [-0.8, 0.75, 0], [0, 0.75, 0.8], [0, 0.75, -0.8]];
  if (count > 5) {
    for (let i = 0; i < count - 5; i++) {
      const a = (i / (count - 5)) * Math.PI * 2 + Math.PI / 4;
      dirs.push([Math.cos(a) * 1.0, 0.62, Math.sin(a) * 1.0]);
    }
  }
  dirs.forEach((d) => {
    const dir = new THREE.Vector3(...d).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const h = flowers.add(chosen.type, jitterColor(), {
      parent: g,
      position: new THREE.Vector3(dir.x * 0.05, 0.075 + dir.y * 0.05, dir.z * 0.05),
      quaternion: q, scale: 1.35, bloom: 0.15,
    });
    handles.push(h);
  });
  return { group: g, handles };
}

// 床置きの小さな花束（通路の縁どり）
const moundMat = new THREE.MeshStandardMaterial({ color: 0x3f6330, roughness: 0.9 });
function makePosy(pos, scale = 1) {
  const g = new THREE.Group();
  g.position.copy(pos);
  scene.add(g);
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), moundMat);
  mound.scale.y = 0.55;
  mound.position.y = 0.03;
  mound.castShadow = true;
  g.add(mound);
  const dirs = [[0, 1, 0.001], [0.75, 0.75, 0], [-0.75, 0.75, 0], [0, 0.75, 0.75], [0, 0.75, -0.75]];
  const handles = [];
  for (const d of dirs) {
    const dir = new THREE.Vector3(...d).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const h = flowers.add(chosen.type, jitterColor(), {
      parent: g, position: dir.clone().multiplyScalar(0.055).add(new THREE.Vector3(0, 0.02, 0)),
      quaternion: q, scale: 1.25 * scale, bloom: 0.15,
    });
    handles.push(h);
  }
  return { group: g, handles };
}

// 床置きの大壺ブーケ（ステージ脇）
const urnMat = new THREE.MeshStandardMaterial({ color: 0xb9a98e, roughness: 0.5 });
function makeUrn(x, z = -8.7) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.11, 0.52, 14), urnMat);
  body.position.y = 0.26;
  body.castShadow = true;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.06, 14), urnMat);
  foot.position.y = 0.03;
  g.add(body, foot);
  const handles = [];
  const dirs = [[0, 1, 0.001]];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    dirs.push([Math.cos(a) * 0.85, 0.75, Math.sin(a) * 0.85]);
  }
  for (const d of dirs) {
    const dir = new THREE.Vector3(...d).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const h = flowers.add(chosen.type, jitterColor(), {
      parent: g, position: dir.clone().multiplyScalar(0.09).add(new THREE.Vector3(0, 0.5, 0)),
      quaternion: q, scale: 1.6, bloom: 0.15,
    });
    handles.push(h);
  }
  return { group: g, handles };
}

// 吊り下げフラワーボール
function makeHangingBall(colorHex, beamPoint) {
  const pivot = new THREE.Group();
  pivot.position.copy(beamPoint);
  const ribbonLen = 1.05 + Math.random() * 0.2;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, ribbonLen, 6),
    new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45 }));
  ribbon.position.y = -ribbonLen / 2;
  pivot.add(ribbon);
  const bow = makeBow(colorHex, 1.1);
  bow.position.y = -0.03;
  pivot.add(bow);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x35502a, roughness: 0.9 }));
  core.position.y = -ribbonLen - 0.13;
  core.castShadow = true;
  pivot.add(core);
  const dirs = [[0, -1, 0.001], [0, 1, 0.001]];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    dirs.push([Math.cos(a) * 0.95, -0.32, Math.sin(a) * 0.95]);
    const a2 = a + Math.PI / 5;
    dirs.push([Math.cos(a2) * 0.92, 0.45, Math.sin(a2) * 0.92]);
  }
  const handles = [];
  for (const d of dirs) {
    const dir = new THREE.Vector3(...d).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const h = flowers.add(chosen.type, colorHex, {
      parent: core,
      position: dir.clone().multiplyScalar(0.1),
      quaternion: q, scale: 1.15, bloom: 0.15, dynamic: true,
    });
    handles.push(h);
  }
  pivot.userData.swayPhase = Math.random() * 6.28;
  pivot.userData.swayAmp = 0;
  swayPivots.push(pivot);
  scene.add(pivot);
  return { pivot, handles };
}

// ---------- フェーズ ----------

const benchY = world.benchTopY; // 0.92
const benchZ = 6.5;

// -- 1. 花の種類えらび --
const samples = [];
function enterPickType() {
  phaseName = 'pickType';
  applyShot('pickType', 0.01);
  const defs = [
    { type: 'rose', color: 0xff86b3 },
    { type: 'tulip', color: 0xffd25e },
    { type: 'daisy', color: 0xfff4f6 },
  ];
  defs.forEach((d, i) => {
    const pot = makePot();
    pot.position.set((i - 1) * 0.62, benchY, benchZ - 0.12);
    pot.scale.setScalar(0.01);
    scene.add(pot);
    const stem = makeStem(0.22);
    stem.position.y = 0.32;
    pot.add(stem);
    for (const sl of [[0.35, 0.02, 2.6], [-0.4, -0.02, 5.7]]) {
      const leaf = new THREE.Mesh(leafGeoS, leafMatS);
      leaf.position.set(0, 0.32 - 0.1 - sl[1] * 4, 0);
      leaf.rotation.set(0.9, sl[2], 0);
      pot.add(leaf);
    }
    const fl = flowers.add(d.type, d.color, {
      parent: pot, position: new THREE.Vector3(0, 0.32, 0), bloom: 0.9, scale: 1.1, dynamic: true,
    });
    samples.push({ pot, fl, def: d });
    tween(0.5, (k) => pot.scale.setScalar(k), { delay: 0.4 + i * 0.22, done: () => audio.pop() });
    schedule(0.45 + i * 0.22, () => burstSparkles(pot.position.clone().add(new THREE.Vector3(0, 0.35, 0)), 10, 0.5));
  });
  schedule(1.3, () => {
    samples.forEach((s, i) => {
      addTarget(s.pot.position.clone().add(new THREE.Vector3(0, 0.34, 0)), 0.24, {
        onTap: () => chooseType(i),
      }, s.pot.position.clone().add(new THREE.Vector3(0, 0.05, 0.1)));
    });
  });
}
function chooseType(i) {
  clearTargets();
  chosen.type = samples[i].def.type;
  audio.chimeSuccess();
  const keep = samples[i];
  burstSparkles(keep.pot.position.clone().add(new THREE.Vector3(0, 0.35, 0)), 24, 0.9);
  samples.forEach((s, j) => {
    if (j === i) return;
    tween(0.4, (k) => s.pot.scale.setScalar(1 - k), { done: () => { s.fl.visible = false; s.fl.dirty = true; scene.remove(s.pot); } });
  });
  const from = keep.pot.position.x;
  tween(0.6, (k) => { keep.pot.position.x = from * (1 - k) - 0.95 * k; keep.pot.position.z = benchZ - 0.12 + 0.34 * k; }, { delay: 0.35 });
  schedule(1.1, enterPickColor);
}

// -- 2. 色えらび --
const colorPots = [];
function enterPickColor() {
  phaseName = 'pickColor';
  FLOWER_COLORS.forEach((c, i) => {
    const pot = makePot();
    pot.position.set(-0.68 + i * 0.45, benchY, benchZ - 0.05);
    pot.scale.setScalar(0.01);
    scene.add(pot);
    const stem = makeStem(0.2);
    stem.position.y = 0.3;
    pot.add(stem);
    const fl = flowers.add(chosen.type, c, {
      parent: pot, position: new THREE.Vector3(0, 0.3, 0), bloom: 0.9, scale: 1.05, dynamic: true,
    });
    colorPots.push({ pot, fl });
    tween(0.45, (k) => pot.scale.setScalar(k), { delay: i * 0.16, done: () => audio.place(i) });
  });
  schedule(1.0, () => {
    colorPots.forEach((cp, i) => {
      addTarget(cp.pot.position.clone().add(new THREE.Vector3(0, 0.32, 0)), 0.2, {
        onTap: () => chooseColor(i),
      }, cp.pot.position.clone().add(new THREE.Vector3(0, 0.05, 0.1)));
    });
  });
}
function chooseColor(i) {
  clearTargets();
  chosen.colorIdx = i;
  audio.chimeSuccess();
  const c = new THREE.Color(chosenColor());
  for (const m of world.accentMeshes) m.color.copy(c).lerp(new THREE.Color(0xffffff), 0.25);
  burstSparkles(colorPots[i].pot.position.clone().add(new THREE.Vector3(0, 0.32, 0)), 26, 1);
  colorPots.forEach((cp, j) => {
    if (j === i) return;
    tween(0.4, (k) => cp.pot.scale.setScalar(1 - k), { done: () => { cp.fl.visible = false; cp.fl.dirty = true; scene.remove(cp.pot); } });
  });
  const kp = colorPots[i].pot;
  const fx = kp.position.x;
  tween(0.6, (k) => { kp.position.x = fx + (0.98 - fx) * k; kp.position.z = benchZ - 0.05 + 0.4 * k; }, { delay: 0.3 });
  schedule(1.1, enterStems);
}

// -- 3. 茎をそろえる --
let stemsCut = 0;
let cutLine = null, rack = null;
function enterStems() {
  phaseName = 'stems';
  applyShot('stems', 1.2);
  rack = new THREE.Group();
  rack.position.set(0, 0, benchZ);
  const rackY = benchY + 0.74;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.6 }));
  bar.position.y = rackY;
  bar.castShadow = true;
  rack.add(bar);
  for (const px of [-0.7, 0.7]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.76, 0.05), bar.material);
    post.position.set(px, benchY + 0.38, 0);
    rack.add(post);
  }
  scene.add(rack);
  const lineY = benchY + 0.3;
  cutLine = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.007, 0.007),
    new THREE.MeshBasicMaterial({ color: 0xffd75e, toneMapped: false, transparent: true, opacity: 0.95 }));
  cutLine.position.set(0, lineY, benchZ + 0.06);
  scene.add(cutLine);
  scissors = makeScissors();
  scissors.position.set(-0.95, lineY, benchZ + 0.12);
  scissors.rotation.z = Math.PI / 2;
  scene.add(scissors);
  const lens = [0.62, 0.5, 0.68, 0.44, 0.58];
  stemsCut = 0;
  lens.forEach((len, i) => {
    const x = -0.56 + i * 0.28;
    const grp = new THREE.Group();
    grp.position.set(x, rackY, benchZ);
    grp.scale.setScalar(0.01);
    scene.add(grp);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xd8b25f, roughness: 0.4, metalness: 0.6 }));
    grp.add(clip);
    const stem = makeStem(len);
    stem.position.y = -0.02;
    grp.add(stem);
    const fl = flowers.add(chosen.type, chosenColor(), {
      parent: grp, position: new THREE.Vector3(0, 0.045, 0.02), bloom: 0.4, scale: 1.35, dynamic: true,
    });
    const rig = { grp, stem, fl, len, cut: false, x, rackY, lineY };
    stemRigs.push(rig);
    tween(0.4, (k) => grp.scale.setScalar(k), { delay: 0.5 + i * 0.14, done: () => audio.pop() });
  });
  schedule(1.6, () => {
    stemRigs.forEach((rig) => {
      addTarget(new THREE.Vector3(rig.x, (rig.lineY + rig.rackY - rig.len) / 2 + 0.02, benchZ), 0.13, {
        onTap: (h) => cutStem(rig, h),
      });
    });
  });
}
function cutStem(rig, target) {
  if (rig.cut) return;
  rig.cut = true;
  if (target) removeTarget(target);
  // はさみが飛んできて切る
  const sx = scissors.position.x, sy = scissors.position.y;
  tween(0.22, (k) => {
    scissors.position.x = sx + (rig.x - 0.06 - sx) * k;
    scissors.position.y = sy + (rig.lineY - sy) * k;
  }, {
    done: () => {
      scissors.userData.setOpen(1);
      schedule(0.08, () => {
        scissors.userData.setOpen(0);
        audio.snip();
        const keepLen = rig.rackY - rig.lineY - 0.02;
        const cutLen = rig.len - keepLen;
        rig.stem.scale.y = keepLen;
        const piece = makeStem(cutLen);
        piece.position.set(rig.x, rig.lineY, benchZ);
        dropPiece(piece, benchY + 0.02);
        burstSparkles(new THREE.Vector3(rig.x, rig.lineY, benchZ + 0.05), 10, 0.5);
        stemsCut++;
        if (stemsCut >= stemRigs.length) {
          schedule(0.5, () => {
            audio.chimeSuccess();
            clearTargets();
            tween(0.5, (k) => { cutLine.material.opacity = 0.9 * (1 - k); scissors.scale.setScalar(1 - k); },
              { delay: 0.3, done: () => { scene.remove(cutLine); scene.remove(scissors); } });
            // そろった花たちが喜ぶ
            stemRigs.forEach((r, i) => {
              tween(0.4, (k) => { r.grp.position.y = r.rackY + Math.sin(k * Math.PI) * 0.06; }, { delay: i * 0.08 });
            });
            schedule(1.4, enterArch);
          });
        }
      });
    },
  });
}

// -- 4. アーチに飾る --
let archPlaced = 0;
function enterArch() {
  phaseName = 'arch';
  // 茎ラックは片づける（暗転中に消える）
  tween(0.45, (k) => {
    const s = Math.max(0.001, 1 - k);
    if (rack) rack.scale.setScalar(s);
    stemRigs.forEach(r => r.grp.scale.setScalar(s));
  }, {
    done: () => {
      if (rack) scene.remove(rack);
      stemRigs.forEach(r => { r.fl.visible = false; r.fl.dirty = true; scene.remove(r.grp); });
    },
  });
  cutTo('arch', () => {
    world.arch.updateWorldMatrix(true, false);
    world.archSlots.forEach((slot, i) => {
      const wp = slot.local.clone().applyMatrix4(world.arch.matrixWorld);
      addTarget(wp, 0.2, { onTap: (h) => placeArchFlower(slot, i, h) });
    });
  });
}
function placeArchFlower(slot, i, h) {
  removeTarget(h);
  const jitter = new THREE.Color(chosenColor()).offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.08);
  const fl = flowers.add(chosen.type, jitter.getHex(), {
    parent: world.arch, position: slot.local.clone(), quaternion: slot.quaternion.clone(),
    scale: 1.6, bloom: 0.18,
  });
  fl.popT = 0;
  audio.place(i);
  const wp = slot.local.clone().applyMatrix4(world.arch.matrixWorld);
  burstSparkles(wp, 14, 0.7);
  archPlaced++;
  if (archPlaced >= world.archSlots.length) {
    schedule(0.6, () => { audio.chimeSuccess(); schedule(0.9, enterTable); });
  }
}

// -- 5. テーブル装花 --
let tablePlaced = 0;
let mainArrangement = null;
function enterTable() {
  phaseName = 'table';
  applyShot('table', 1.6, () => {
    const tb = world.tables[1];
    mainArrangement = { group: new THREE.Group(), handles: [] };
    mainArrangement.group.position.set(tb.x, tb.topY, tb.z);
    scene.add(mainArrangement.group);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.055, 0.075, 14),
      new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.55 }));
    bowl.position.y = 0.038;
    bowl.castShadow = true;
    mainArrangement.group.add(bowl);
    const dirs = [[0, 1, 0.001], [0.8, 0.75, 0], [-0.8, 0.75, 0], [0, 0.75, 0.8], [0, 0.75, -0.8]];
    dirs.forEach((d, i) => {
      const dir = new THREE.Vector3(...d).normalize();
      const wp = new THREE.Vector3(tb.x + dir.x * 0.3, tb.topY + 0.14 + dir.y * 0.14, tb.z + dir.z * 0.3);
      addTarget(wp, 0.14, {
        onTap: (h) => {
          removeTarget(h);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          const fl = flowers.add(chosen.type, chosenColor(), {
            parent: mainArrangement.group,
            position: new THREE.Vector3(dir.x * 0.05, 0.075 + dir.y * 0.05, dir.z * 0.05),
            quaternion: q, scale: 1.35, bloom: 0.15,
          });
          fl.popT = 0;
          mainArrangement.handles.push(fl);
          audio.place(i);
          burstSparkles(wp, 12, 0.6);
          tablePlaced++;
          if (tablePlaced >= dirs.length) {
            schedule(0.6, () => { audio.chimeSuccess(); schedule(0.9, enterWater); });
          }
        },
      });
    });
  });
}

// -- 6. つぼみを水へ --
const waterVases = [];
const waterBuds = [];
let budsInWater = 0;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(benchZ + 0.1));
function enterWater() {
  phaseName = 'water';
  cutTo('water', () => {
    for (let i = 0; i < 5; i++) {
      const vase = makeVase();
      vase.position.set(-0.4 + i * 0.2, benchY, benchZ - 0.18);
      vase.scale.setScalar(0.01);
      scene.add(vase);
      waterVases.push({ vase, filled: false });
      tween(0.35, (k) => vase.scale.setScalar(k), { delay: i * 0.1, done: () => audio.pop() });
    }
    for (let i = 0; i < 5; i++) {
      const grp = new THREE.Group();
      grp.position.set(-0.4 + i * 0.2, benchY + 0.03, benchZ + 0.36);
      grp.rotation.z = Math.PI / 2 - 0.12;
      grp.rotation.y = (Math.random() - 0.5) * 0.5;
      grp.scale.setScalar(0.01);
      scene.add(grp);
      const stem = makeStem(0.2);
      stem.position.y = 0;
      grp.add(stem);
      const fl = flowers.add(chosen.type, chosenColor(), {
        parent: grp, position: new THREE.Vector3(0, 0.01, 0), bloom: 0.05, scale: 1, dynamic: true,
      });
      const bud = { grp, fl, done: false, home: grp.position.clone() };
      waterBuds.push(bud);
      tween(0.35, (k) => grp.scale.setScalar(k), { delay: 0.4 + i * 0.1 });
    }
    schedule(1.2, () => {
      waterBuds.forEach((bud) => {
        bud.target = addTarget(bud.grp.position.clone(), 0.13, {
          drag: true,
          bud,
          onGrab: () => { audio.tap(); },
          onDrag: (h) => {
            raycaster.setFromCamera(pointer, camera);
            const p = new THREE.Vector3();
            if (!raycaster.ray.intersectPlane(dragPlane, p)) return;
            p.x = THREE.MathUtils.clamp(p.x, -0.9, 0.9);
            p.y = THREE.MathUtils.clamp(p.y, benchY + 0.05, benchY + 0.7);
            bud.grp.position.set(p.x, p.y, benchZ + 0.1);
            const up = Math.min(1, (p.y - benchY - 0.05) / 0.3);
            bud.grp.rotation.z = (Math.PI / 2 - 0.12) * (1 - up);
            h.sphere.position.copy(bud.grp.position);
            h.marker.position.copy(bud.grp.position);
          },
          onDrop: () => dropBudInVase(bud),
        });
      });
    });
  });
}
function dropBudInVase(bud) {
  if (bud.done) return;
  const slot = waterVases.find(v => !v.filled);
  if (!slot) return;
  bud.done = true;
  slot.filled = true;
  removeTarget(bud.target);
  const from = bud.grp.position.clone();
  const fromRz = bud.grp.rotation.z;
  const to = slot.vase.position.clone().add(new THREE.Vector3(0, 0.26, 0));
  tween(0.45, (k) => {
    bud.grp.position.lerpVectors(from, to, k);
    bud.grp.position.y += Math.sin(k * Math.PI) * 0.22;
    bud.grp.rotation.z = fromRz * (1 - k);
    bud.grp.rotation.y *= (1 - k);
  }, {
    done: () => {
      audio.splash();
      ripple(slot.vase.position.clone().add(new THREE.Vector3(0, 0.16, 0)));
      burstSparkles(to, 10, 0.5);
      tween(0.3, (k) => { bud.grp.position.y = to.y - 0.06 * Math.sin(k * Math.PI); });
      budsInWater++;
      if (budsInWater >= 5) {
        schedule(0.7, () => { audio.chimeSuccess(); schedule(0.9, enterHang); });
      }
    },
  });
}

// -- 7. リボンと吊り飾り --
let hangPlaced = 0;
const hangBalls = [];
function enterHang() {
  phaseName = 'hang';
  cutTo('hang', () => {
    const beamY = 6.6, beamZ = -4.5;
    [-2.1, -0.7, 0.7, 2.1].forEach((x) => {
      addTarget(new THREE.Vector3(x, beamY - 0.9, beamZ), 0.38, {
        onTap: (h) => {
          removeTarget(h);
          const ball = makeHangingBall(chosenColor(), new THREE.Vector3(x, beamY - 0.16, beamZ));
          hangBalls.push(ball);
          ball.pivot.scale.setScalar(0.01);
          tween(0.55, (k) => ball.pivot.scale.setScalar(k), {
            done: () => {
              ball.pivot.userData.swayAmp = 0.16;
              tween(2.5, (k) => { ball.pivot.userData.swayAmp = 0.16 * (1 - k) + 0.045; });
            },
          });
          audio.place(hangPlaced);
          burstSparkles(new THREE.Vector3(x, beamY - 1.2, beamZ), 16, 0.8);
          hangPlaced++;
          if (hangPlaced >= 4) {
            schedule(0.8, () => { audio.chimeSuccess(); schedule(1.0, enterFill); });
          }
        },
      });
    });
  });
}

// -- 7.5 仕上げモンタージュ：主人公の担当分に加えて、残りの花飾りが自動で盛られる --
function enterFill() {
  phaseName = 'fill';
  clearTargets();
  inputEnabled = false;
  const popFl = (fl, wp, i) => {
    fl.popT = 0;
    audio.place(i);
    if (wp && i % 2 === 0) burstSparkles(wp, 8, 0.6);
  };

  // カット1：アーチが花いっぱいに。壺・メインテーブルも仕上がる
  cutTo('arch', () => {
    inputEnabled = false;
    const ts = [0.05, 0.15, 0.28, 0.32, 0.43, 0.47, 0.55, 0.6, 0.68, 0.72, 0.82, 0.86, 0.95,
      0.12, 0.25, 0.38, 0.52, 0.65, 0.78, 0.9];
    world.arch.updateWorldMatrix(true, false);
    ts.forEach((tt, i) => {
      schedule(0.2 + i * 0.075, () => {
        const slot = world.archSlotAt(tt + (Math.random() - 0.5) * 0.02);
        const fl = flowers.add(chosen.type, jitterColor(), {
          parent: world.arch, position: slot.local, quaternion: slot.quaternion,
          scale: 1.15 + Math.random() * 0.55, bloom: 0.18,
        });
        const wp = slot.local.clone().applyMatrix4(world.arch.matrixWorld);
        popFl(fl, wp, i);
      });
    });
    // ステージ脇の大壺ブーケ
    schedule(0.6, () => { const u = makeUrn(-2.9); u.handles.forEach(h => { h.popT = 0; }); audio.pop(); });
    schedule(1.0, () => { const u = makeUrn(2.9); u.handles.forEach(h => { h.popT = 0; }); audio.pop(); });
    // メインテーブル（ステージ上）：ガーランド・花瓶・リボン・ステージ縁の花
    schedule(1.4, () => decorateHeadTable());
    schedule(2.0, () => audio.gliss(true));
  });

  // カット2：ゲスト卓・通路・椅子・窓辺・追加の吊り花
  schedule(3.4, () => cutTo('table', () => {
    inputEnabled = false;
    // 主人公の卓に追い花
    schedule(0.15, () => {
      if (mainArrangement) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const dir = new THREE.Vector3(Math.cos(a), 0.62, Math.sin(a)).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          const fl = flowers.add(chosen.type, jitterColor(), {
            parent: mainArrangement.group,
            position: new THREE.Vector3(dir.x * 0.05, 0.075 + dir.y * 0.05, dir.z * 0.05),
            quaternion: q, scale: 1.35, bloom: 0.15,
          });
          schedule(i * 0.1, () => popFl(fl, null, i));
        }
      }
    });
    // ほかのゲスト卓（9本アレンジ）
    [0, 2, 3].forEach((ti, n) => {
      schedule(0.5 + n * 0.35, () => {
        const tb = world.tables[ti];
        const arr = makeTableArrangement(chosenColor(), 9);
        arr.group.position.set(tb.x, tb.topY, tb.z);
        arr.group.scale.setScalar(0.01);
        scene.add(arr.group);
        tween(0.4, (k) => { arr.group.scale.setScalar(k); arr.handles.forEach(h => { h.dirty = true; }); });
        audio.place(n + 2);
        burstSparkles(new THREE.Vector3(tb.x, tb.topY + 0.3, tb.z), 12, 0.8);
      });
    });
    // 通路の縁どり・椅子リボン・窓辺・追加吊りボール
    schedule(0.9, () => {
      for (const z of [-7.5, -5, -2.5, 0, 2.5, 4.8]) {
        for (const sx of [-1.2, 1.2]) {
          const p = makePosy(new THREE.Vector3(sx + (Math.random() - 0.5) * 0.1, 0, z + (Math.random() - 0.5) * 0.3));
          p.handles.forEach(h => { h.popT = 0; });
        }
      }
      for (const ch of world.chairSpots) {
        const bow = makeBow(chosenColor(), 1.35);
        bow.position.set(0, 1.0, 0.22);
        ch.add(bow);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.4, 1).normalize());
        const fl = flowers.add(chosen.type, jitterColor(), {
          parent: ch, position: new THREE.Vector3(0, 0.9, 0.22), quaternion: q, scale: 1.1, bloom: 0.15,
        });
        fl.popT = 0;
      }
      for (const g of world.windowGroups) {
        for (const wx of [-0.42, 0, 0.42]) {
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(wx * 0.4, 0.55, 1).normalize());
          const fl = flowers.add(chosen.type, jitterColor(), {
            parent: g, position: new THREE.Vector3(wx, -1.2, 0.14), quaternion: q, scale: 1.2, bloom: 0.15,
          });
          fl.popT = 0;
        }
        const bow = makeBow(chosenColor(), 1.5);
        bow.position.set(0, -1.02, 0.12);
        g.add(bow);
      }
      // シャンデリアにも花飾り
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(Math.cos(a), 0.4, Math.sin(a)).normalize());
        const fl = flowers.add(chosen.type, jitterColor(), {
          parent: world.chandelier,
          position: new THREE.Vector3(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6),
          quaternion: q, scale: 1.15, bloom: 0.15,
        });
        fl.popT = 0;
      }
      for (const [bx, bz] of [[-2.6, -8.5], [2.6, -8.5], [-2.6, -0.5], [2.6, -0.5]]) {
        const ball = makeHangingBall(chosenColor(), new THREE.Vector3(bx, 6.44, bz));
        hangBalls.push(ball);
        ball.pivot.scale.setScalar(0.01);
        tween(0.5, (k) => ball.pivot.scale.setScalar(k), {
          done: () => { ball.pivot.userData.swayAmp = 0.045; },
        });
      }
      audio.gliss(true);
    });
    schedule(2.2, () => audio.chimeSuccess());
  }));

  schedule(6.6, enterDoors);
}

// メインテーブルとステージまわりの仕上げ
function decorateHeadTable() {
  const ht = world.headTable;
  for (let i = 0; i < 13; i++) {
    const x = -1.8 + i * 0.3;
    const fl = flowers.add(chosen.type, jitterColor(), {
      parent: ht, position: new THREE.Vector3(x, 0.76, 0.42),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.5, 1).normalize()),
      scale: 1.35, bloom: 0.2,
    });
    schedule(i * 0.05, () => { fl.popT = 0; });
  }
  for (let i = 0; i < 5; i++) {
    const vase = makeVase();
    vase.position.set(-1.1 + i * 0.55, 0.74, 0.1);
    ht.add(vase);
    const stem = makeStem(0.2);
    stem.position.set(-1.1 + i * 0.55, 0.74 + 0.26, 0.1);
    ht.add(stem);
    const fl = flowers.add(chosen.type, chosenColor(), {
      parent: ht, position: new THREE.Vector3(-1.1 + i * 0.55, 1.0, 0.1), bloom: 0.1, scale: 1,
    });
    fl.popT = 0;
  }
  const bowL = makeBow(chosenColor(), 2.2);
  bowL.position.set(-1.85, 1.1, 0.46);
  ht.add(bowL);
  const bowR = makeBow(chosenColor(), 2.2);
  bowR.position.set(1.85, 1.1, 0.46);
  ht.add(bowR);
  // ステージ前縁の花（アーチの左右）
  for (const x of [-4.2, -3.5, -2.8, 2.8, 3.5, 4.2]) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.6, 1).normalize());
    const fl = flowers.add(chosen.type, jitterColor(), {
      position: new THREE.Vector3(x, 0.38, -9.45), quaternion: q, scale: 1.45, bloom: 0.15,
    });
    fl.popT = 0;
  }
  // 奥の壁に花のスワッグ（垂れ飾り）
  const swagY = 4.7, swagZ = -11.72, sag = 0.55;
  const anchors = [-7, -4.7, -2.4, 0, 2.4, 4.7, 7];
  for (let s = 0; s < anchors.length - 1; s++) {
    const x0 = anchors[s], x1 = anchors[s + 1];
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.35, 1).normalize());
      const fl = flowers.add(chosen.type, jitterColor(), {
        position: new THREE.Vector3(x0 + (x1 - x0) * t, swagY - sag * Math.sin(t * Math.PI), swagZ),
        quaternion: q, scale: 1.5, bloom: 0.15,
      });
      schedule(s * 0.12 + i * 0.03, () => { fl.popT = 0; });
    }
  }
  for (const ax of anchors) {
    const bow = makeBow(chosenColor(), 1.9);
    bow.position.set(ax, swagY + 0.05, swagZ);
    scene.add(bow);
  }
  audio.pop();
  burstSparkles(new THREE.Vector3(0, 1.6, -10.2), 20, 1);
}

// -- 8. 大扉の前へ --
function enterDoors() {
  phaseName = 'doors';
  audio.setMode('off');
  clearTargets();
  fadeThrough(() => {
    applyShot('doors', 0.01);
    schedule(0.6, () => {
      addTarget(new THREE.Vector3(0, 1.6, 10.15), 0.5, { onTap: startReveal });
      // 期待感：すき間の光がゆらめく
      tween(2.0, (k) => { world.doorCrack.material.opacity = 0.7 + 0.3 * Math.sin(k * 12); });
    });
  });
}

// -- 9. フィナーレ --
function startReveal() {
  clearTargets();
  phaseName = 'reveal';
  inputEnabled = false;
  audio.doorCreak();

  // 扉が左右へ開く
  tween(2.0, (k) => {
    world.doorL.rotation.y = 1.92 * k;
    world.doorR.rotation.y = -1.92 * k;
  }, { ease: (k) => smooth(smooth(k)) });
  schedule(0.15, () => { world.doorCrack.visible = false; });
  // まばゆい光
  tween(1.1, (k) => { world.doorBurst.material.opacity = k * 0.95; });
  tween(2.2, (k) => { world.doorBurst.material.opacity = 0.95 * (1 - k); }, { delay: 1.2 });
  tween(1.4, (k) => { world.doorRay.material.opacity = 0.3 * k; }, { delay: 0.5 });
  schedule(1.0, () => audio.gliss(true));

  // カメラが会場の中へ
  schedule(0.9, () => {
    cameraBusy = true;
    const fromP = camera.position.clone(), fromL = camLook.clone();
    const f = shotVectors('finale');
    tween(3.4, (k) => {
      camera.position.lerpVectors(fromP, f.pos, k);
      camLook.lerpVectors(fromL, f.look, k);
      camera.fov = 46 + (f.fov - 46) * k;
      camera.updateProjectionMatrix();
    }, { done: () => { cameraBusy = false; currentShotName = 'finale'; } });
  });

  // カーテンが開き、照明が温かく
  schedule(1.7, () => {
    audio.whoosh(1.4);
    const dl = world.dividerL, dr = world.dividerR;
    tween(1.7, (k) => { dl.userData.setOpen(k); dr.userData.setOpen(k); });
    for (const c of world.windowCurtains) tween(1.6, (k) => c.userData.setOpen(k), { delay: Math.random() * 0.5 });
    for (const r of world.windowRays) tween(2.2, (k) => { r.material.opacity = 0.16 * k; }, { delay: 0.7 });
    const fogFrom = scene.fog.color.clone();
    tween(3.0, (k) => {
      scene.fog.color.lerpColors(fogFrom, PARTY_FOG, k);
      scene.background.copy(scene.fog.color);
      scene.fog.near = 6 + 6 * k;
      scene.fog.far = 30 + 32 * k;
      world.hemi.intensity = 0.32 + 0.48 * k;
      world.hemi.color.lerpColors(new THREE.Color(0x8a7d92), new THREE.Color(0xffe8c9), k);
      world.sun.intensity = 2.1 * k;
      world.chandLight.intensity = 45 * k;
      world.stageLight.intensity = 16 * k;
      world.setEnvIntensity(0.25 + 0.55 * k);
      world.workLight.intensity = 95 * (1 - k);
      for (const b of world.chandBulbs) b.emissiveIntensity = 0.12 + 2.2 * k;
      world.stringBulbMat.emissiveIntensity = 2.6 * k;
      for (const g of world.windowGlows) g.color.setHSL(0.11, 0.42, 0.72 + 0.16 * k);
    });
    schedule(0.3, () => audio.fanfare());
  });

  // 一斉開花
  schedule(3.6, () => {
    flowers.setBloomAll(1, 0, 2.0);
    for (const f of flowers.flowers) f.bloomSpeed = 1.1;
  });

  // 花びらが舞い、音楽、パーティーへ
  schedule(4.2, () => {
    startPetalRain(chosenColor());
    audio.setMode('party');
    for (const p of swayPivots) p.userData.swayAmp = Math.max(p.userData.swayAmp, 0.055);
  });
  // 差し込み光の板はカメラが室内に落ち着いたら消す（内側から縞に見えるため）
  schedule(5.2, () => {
    const o = world.doorRay.material.opacity;
    tween(1.6, (k) => { world.doorRay.material.opacity = o * (1 - k); });
  });
  schedule(6.5, () => {
    phaseName = 'party';
    inputEnabled = true;
    partyT0 = clockTime;
  });
}

let partyT0 = 0;

// ---------- デバッグAPI（検証用・画面には出ない） ----------

window.__flower = {
  get phase() { return phaseName; },
  targets() {
    const out = [];
    const v = new THREE.Vector3();
    for (const h of hitTargets) {
      v.copy(h.sphere.position).project(camera);
      const x = (v.x + 1) / 2 * window.innerWidth;
      const y = (1 - v.y) / 2 * window.innerHeight;
      const entry = { x, y, drag: !!h.data.drag };
      if (h.data.drag) {
        const slot = waterVases.find(s => !s.filled);
        if (slot) {
          v.copy(slot.vase.position).add(new THREE.Vector3(0, 0.3, 0)).project(camera);
          entry.dropX = (v.x + 1) / 2 * window.innerWidth;
          entry.dropY = (1 - v.y) / 2 * window.innerHeight;
        }
      }
      out.push(entry);
    }
    return out;
  },
  get busy() { return cameraBusy || !inputEnabled; },
  get water() {
    return {
      buds: budsInWater,
      filled: waterVases.filter(v => v.filled).length,
      done: waterBuds.filter(b => b.done).length,
      pos: waterBuds.map(b => b.grp.position.toArray().map(n => +n.toFixed(2))),
      tweens: tweens.length,
    };
  },
  renderer,
};

// ---------- リサイズ ----------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (!cameraBusy && SHOTS[currentShotName]) {
    const s = shotVectors(currentShotName);
    camera.position.copy(s.pos);
    camLook.copy(s.look);
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
  }
});

// ---------- メインループ ----------

const clock = new THREE.Clock();
let bloomNoteCooldown = 0;
let bloomNoteIdx = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.12, clock.getDelta());
  clockTime += dt;
  updateTweens(dt);
  const bloomed = flowers.update(dt, camera);
  if (bloomed > 0 && bloomNoteCooldown <= 0) {
    audio.bloomNote(bloomNoteIdx++);
    bloomNoteCooldown = 0.13;
    // 開いた花からきらきら
    const f = flowers.flowers[(Math.random() * flowers.flowers.length) | 0];
    if (f && f.visible) {
      const wp = f.position.clone();
      if (f.parent) { f.parent.updateWorldMatrix(true, false); wp.applyMatrix4(f.parent.matrixWorld); }
      burstSparkles(wp, 6, 0.5);
    }
  }
  bloomNoteCooldown -= dt;
  updateSparkles(dt);
  updateRain(dt, clockTime);
  updateFalling(dt);
  updateMarkers(clockTime);
  // 吊り飾りのゆれ
  for (const p of swayPivots) {
    if (p.userData.swayAmp > 0) {
      p.rotation.z = Math.sin(clockTime * 1.4 + p.userData.swayPhase) * p.userData.swayAmp;
      p.rotation.x = Math.cos(clockTime * 1.1 + p.userData.swayPhase * 2) * p.userData.swayAmp * 0.6;
    }
  }
  // パーティー中のゆったりカメラ
  if (phaseName === 'party' && !cameraBusy) {
    const t = clockTime - partyT0;
    const s = shotVectors('finale');
    camera.position.x = s.pos.x + Math.sin(t * 0.13) * 1.4;
    camera.position.y = s.pos.y + Math.sin(t * 0.09) * 0.25;
    camera.position.z = s.pos.z + Math.cos(t * 0.11) * 0.7;
    camLook.x = s.look.x + Math.sin(t * 0.07) * 0.8;
  }
  camera.lookAt(camLook);
  renderer.render(scene, camera);
}

// ---------- 開始 ----------

const loader = document.getElementById('loader');
schedule(0.2, () => {
  loader.classList.add('gone');
  setTimeout(() => loader.remove(), 800);
});
enterPickType();
animate();
