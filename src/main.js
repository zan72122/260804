/**
 * main.js — 起動・描画ループ・端末対応。
 * WebGL2 前提（WebGPU がなくても看板体験は壊れない）。
 */
import * as THREE from 'three';
import { buildMaterials, buildEnvironment } from './materials.js';
import { buildWorld } from './world.js';
import { buildDrill, buildMudGun } from './machines.js';
import { createMolten } from './molten.js';
import { createCameraRig } from './camera.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { Audio2 } from './audio.js';
import { createGame } from './game.js';

const canvas = document.getElementById('gl');

/** WebGL が使えない端末には、責めない言い方で伝える */
function bail(msg) {
  const el = document.getElementById('loading');
  if (el) {
    el.innerHTML = '<div style="text-align:center;line-height:1.7">🛠️<br>' + msg + '</div>';
    el.classList.remove('hidden');
  }
  throw new Error(msg);
}
try {
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
    bail('このブラウザでは 3D が つかえません<br>Safari / Chrome で ひらいてね');
  }
} catch (e) { bail('このブラウザでは 3D が つかえません'); }

/* ---------------- 端末に合わせた品質の自動判定 ---------------- */
function guessQuality() {
  const dpr = window.devicePixelRatio || 1;
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const small = Math.min(window.innerWidth, window.innerHeight) * dpr < 700;
  if (mem <= 2 || cores <= 2 || small) return 'low';
  return 'high';
}
let quality = guessQuality();

/* ---------------- レンダラ ---------------- */
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: quality !== 'low', alpha: false,
  powerPreference: 'high-performance', stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = quality !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const MAX_PR = quality === 'low' ? 1.0 : 1.75;
let prScale = 1.0;
const applySize = () => {
  const w = window.innerWidth, h = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio || 1, MAX_PR) * prScale;
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  cam.setViewport(w, h);
  camera.updateProjectionMatrix();
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 220);

/* ---------------- 組み立て ---------------- */
const M = buildMaterials(quality);
scene.environment = buildEnvironment(renderer);
scene.environmentIntensity = 0.55;

const world = buildWorld(scene, M, quality);
const drill = buildDrill(scene, M, quality);
const mudgun = buildMudGun(scene, M, quality);
const molten = createMolten(scene, M, world, quality);

const cam = createCameraRig(camera);
const ui = createUI();
const input = createInput(canvas);
const sfx = new Audio2();

const game = createGame({ world, drill, mudgun, molten, cam, ui, input, sfx });

applySize();
window.addEventListener('resize', applySize);
window.addEventListener('orientationchange', () => setTimeout(applySize, 250));

/* ---------------- UI 配線 ---------------- */
const unlock = () => { sfx.ensure(); };
document.addEventListener('pointerdown', unlock, { once: true });

ui.el.startBtn.addEventListener('click', (e) => { e.stopPropagation(); sfx.ensure(); game.start(); });
// タイトルはどこを触っても始まる（4歳児にボタンを狙わせない）
ui.el.title.addEventListener('pointerup', () => { sfx.ensure(); game.start(); });
ui.el.againBtn.addEventListener('click', (e) => { e.stopPropagation(); sfx.ensure(); game.again(false); });
ui.el.freeBtn.addEventListener('click', (e) => { e.stopPropagation(); sfx.ensure(); game.again(true); });
ui.el.soundBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const on = ui.el.soundBtn.classList.toggle('off');
  sfx.setEnabled(!on);
  sfx.voiceOn = !on;
  ui.el.soundBtn.textContent = on ? '🔇' : '🔊';
});
document.addEventListener('visibilitychange', () => { if (document.hidden) sfx.stopAll(); });

/* ---------------- ループ ---------------- */
let last = performance.now();
let fpsAcc = 0, fpsN = 0, degraded = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  game.update(dt);
  cam.update(dt);
  molten.update(dt, camera, renderer.getPixelRatio());
  drill.update(now / 1000);
  mudgun.update(now / 1000);
  ui.update(dt);

  renderer.render(scene, camera);

  // 低性能端末では内部解像度と影を自動的に落とす
  if (!degraded && dt > 0) {
    fpsAcc += 1 / dt; fpsN++;
    if (fpsN > 150) {
      const fps = fpsAcc / fpsN;
      if (fps < 34) {
        degraded = true;
        prScale = 0.72;
        renderer.shadowMap.enabled = false;
        scene.traverse(o => { if (o.isMesh) o.castShadow = false; });
        applySize();
      }
      fpsAcc = 0; fpsN = 0;
    }
  }
  requestAnimationFrame(frame);
}

/* 1フレーム目を描いてから読み込み表示を消す */
renderer.compile(scene, camera);
requestAnimationFrame((t) => { last = t; frame(t); ui.ready(); });

/* テスト／デバッグ用 */
window.__game = { game, cam, world, drill, mudgun, molten, sfx, ui, input, renderer, scene, camera, THREE };
