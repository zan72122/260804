// ぱてぃしえ だいすき！ — 4歳向けパティシエ3Dゲーム（マルチレシピ コア）
// レンダラー/シーン/カメラ/入力/UIヘルパー/ループ/キッチン環境/共有スタンドのみを持つ。
// 各レシピの中身は src/recipes/<id>.js（動的import）。契約: docs/recipe-contract.md
import * as THREE from '../vendor/three.module.js';
import { buildKitchen } from './env.js';
import { createCakeStand } from './cake.js';
import { updateTweens, clamp } from './util.js';
import { unlock, startBGM, sfx, setPourSound, setStirSound, setTorchSound } from './audio.js';

// -------------------------------------------------------------------------
// レンダラー・シーン
// -------------------------------------------------------------------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 20);

const env = buildKitchen(scene);

// -------------------------------------------------------------------------
// 共有ケーキスタンド（全レシピ共通の土台）
// -------------------------------------------------------------------------
const stand = createCakeStand();
stand.group.position.set(0, 0.018, 0);
stand.group.visible = false;
scene.add(stand.group);
const STAND_TOP = 0.018 + stand.topY;

// -------------------------------------------------------------------------
// UI要素（DOM）
// -------------------------------------------------------------------------
const dom = {
  title: document.getElementById('title'),
  recipeSelect: document.getElementById('recipeSelect'),
  hint: document.getElementById('hint'),
  hintIcon: document.getElementById('hintIcon'),
  progress: document.getElementById('progress'),
  progressFill: document.getElementById('progressFill'),
  replayBtn: document.getElementById('replayBtn'),
  banner: document.getElementById('banner'),
  finger: document.getElementById('finger'),
};

function setHint(text, icon = '') {
  dom.hint.textContent = text;
  dom.hintIcon.textContent = icon;
  dom.hint.parentElement.classList.toggle('show', !!text);
}
function setProgress(v) {
  dom.progress.classList.toggle('show', v !== null);
  if (v !== null) dom.progressFill.style.width = `${clamp(v, 0, 1) * 100}%`;
}
function showBanner(text) {
  dom.banner.textContent = text;
  dom.banner.classList.add('show');
  setTimeout(() => dom.banner.classList.remove('show'), 1600);
}
function setFinger(mode) { // 'circle' | 'hold' | null
  dom.finger.className = mode ? `show ${mode}` : '';
}

// 下部トレイ生成: <div id="{id}" class="trayBar"><button data-key="{key}">…</button></div>
function makeTray(id, items, onPick) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  el.className = 'trayBar';
  el.innerHTML = '';
  for (const it of items) {
    const btn = document.createElement('button');
    btn.dataset.key = it.key;
    btn.textContent = it.emoji;
    if (it.bg) btn.style.background = it.bg;
    btn.addEventListener('click', () => onPick(it.key));
    el.appendChild(btn);
  }
  return {
    el,
    show() { el.classList.add('show'); },
    hide() { el.classList.remove('show'); },
  };
}

// 右側の大ボタン（doneBtn風緑）
function makeActionButton(id, label, onClick) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('button');
    el.id = id;
    document.body.appendChild(el);
  }
  el.className = 'bigBtn actionBtn';
  el.textContent = label;
  el.onclick = onClick;
  return {
    el,
    show() { el.classList.add('show'); },
    hide() { el.classList.remove('show'); },
  };
}

// -------------------------------------------------------------------------
// カメラ制御
// -------------------------------------------------------------------------
const camState = {
  pos: new THREE.Vector3(0.9, 0.75, 1.5),
  look: new THREE.Vector3(0, 0.1, -0.2),
  targetPos: new THREE.Vector3(0.9, 0.75, 1.5),
  targetLook: new THREE.Vector3(0, 0.1, -0.2),
};
function isPortrait() { return window.innerHeight > window.innerWidth; }
function setCam(pos, look) {
  camState.targetPos.set(...pos);
  camState.targetLook.set(...look);
  if (isPortrait()) {
    // 縦画面では少し引いて全体が収まるように
    const dir = camState.targetPos.clone().sub(camState.targetLook);
    dir.multiplyScalar(1.4);
    camState.targetPos.copy(camState.targetLook).add(dir);
    camState.targetPos.y += 0.06;
  }
}
let camPhaseArgs = null;
function applyCamPhase() { if (camPhaseArgs) setCam(...camPhaseArgs); }
function camPhase(pos, look) { camPhaseArgs = [pos, look]; applyCamPhase(); }

// -------------------------------------------------------------------------
// 入力
// -------------------------------------------------------------------------
const pointer = { down: false, x: 0, y: 0, ndc: new THREE.Vector2() };
const raycaster = new THREE.Raycaster();
let audioReady = false;

function onPointerDown(e) { pointer.down = true; updatePointer(e); }
function onPointerMove(e) { updatePointer(e); }
function onPointerUp() { pointer.down = false; }
function updatePointer(e) {
  const x = e.touches ? e.touches[0]?.clientX : e.clientX;
  const y = e.touches ? e.touches[0]?.clientY : e.clientY;
  if (x === undefined) return;
  pointer.x = x; pointer.y = y;
  pointer.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
}
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// 水平面との交点を求める
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();
function pointOnPlane(y) {
  _plane.constant = -y;
  raycaster.setFromCamera(pointer.ndc, camera);
  return raycaster.ray.intersectPlane(_plane, _hit) ? _hit : null;
}
function raycastMeshes(meshes) {
  raycaster.setFromCamera(pointer.ndc, camera);
  return raycaster.intersectObjects(meshes, true);
}

// -------------------------------------------------------------------------
// レシピ選択・状態公開
// -------------------------------------------------------------------------
const RECIPES = [
  { id: 'dome', title: 'ひみつのドームケーキ', emoji: '🍫' },
  { id: 'glaze', title: 'かがみのケーキ', emoji: '🪞' },
  { id: 'brulee', title: 'あぶってパリン！', emoji: '🔥' },
];

let activeRecipe = null;
let publicState = null;
function registerState(obj) { publicState = obj; }

function finish() {
  dom.replayBtn.classList.add('show');
}

const ctx = {
  scene, camera, renderer,
  camPhase,
  isPortrait,
  pointer,
  pointOnPlane,
  raycastMeshes,
  ui: { setHint, setProgress, showBanner, setFinger, makeTray, makeActionButton },
  audio: { sfx, setPourSound, setStirSound, setTorchSound },
  stand,
  STAND_TOP,
  env,
  finish,
  registerState,
};

async function select(id) {
  if (!audioReady) { unlock(); startBGM(); audioReady = true; }
  sfx.sparkle();
  dom.title.classList.add('hide');
  setTimeout(() => { dom.title.style.display = 'none'; }, 700);
  try {
    const mod = await import(`./recipes/${id}.js`);
    activeRecipe = mod.createRecipe(ctx);
    activeRecipe.start();
  } catch (err) {
    // 未完成のレシピでも落ちない: バナー表示のみ（console.errorは出さない）
    showBanner('じゅんびちゅう…');
    dom.title.classList.remove('hide');
    dom.title.style.display = '';
  }
}

for (const btn of dom.recipeSelect.querySelectorAll('button[data-recipe]')) {
  btn.addEventListener('click', () => select(btn.dataset.recipe));
}
dom.replayBtn.addEventListener('click', () => location.reload());

window.__game = {
  select,
  get state() { return publicState; },
};

// -------------------------------------------------------------------------
// メインループ
// -------------------------------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);        // 連続的な見た目の更新用
  const hdt = Math.min(rawDt, 0.25);       // 進捗・トゥイーン用（低fpsでも実時間で進む）
  const timeNow = clock.elapsedTime;

  if (activeRecipe) activeRecipe.update(dt, hdt, timeNow);
  updateTweens(hdt);

  // カメラのなめらかな追従
  const k = 1 - Math.pow(0.005, dt);
  camState.pos.lerp(camState.targetPos, k);
  camState.look.lerp(camState.targetLook, k);
  camera.position.copy(camState.pos);
  camera.lookAt(camState.look);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// -------------------------------------------------------------------------
// リサイズ
// -------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = isPortrait() ? 44 : 38;
  camera.updateProjectionMatrix();
  applyCamPhase();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

// タイトルのカメラ
setCam([0.3, 0.3, 0.58], [-0.02, 0.09, 0]);
animate();
