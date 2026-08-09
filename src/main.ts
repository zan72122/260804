import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildStage } from './scene';
import { CameraRig } from './camera';
import { SoundKit } from './audio';
import { Game } from './game';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const stage = buildStage(scene);
const rig = new CameraRig(window.innerWidth / window.innerHeight);
const snd = new SoundKit();
const resultUI = document.getElementById('resultUI')!;
const game = new Game(stage, rig, snd, resultUI);

// ---- input (single pointer only) ----
let activePointer: number | null = null;
const el = renderer.domElement;
el.addEventListener('pointerdown', (e) => {
  if (activePointer !== null) return;
  activePointer = e.pointerId;
  el.setPointerCapture(e.pointerId);
  game.onPointerDown(e.clientX / window.innerWidth);
});
el.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer) return;
  game.onPointerMove(e.clientX / window.innerWidth);
});
const endPointer = (e: PointerEvent) => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  game.onPointerUp();
};
el.addEventListener('pointerup', endPointer);
el.addEventListener('pointercancel', endPointer);

// suppress double-tap zoom / pinch inside the game
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

document.getElementById('btnReplay')!.addEventListener('click', () => {
  snd.unlock();
  game.restart(false);
});
document.getElementById('btnNew')!.addEventListener('click', () => {
  snd.unlock();
  game.restart(true);
});

// ---- resize / rotation (state survives, only the view reframes) ----
function onResize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  rig.onAspect(w / h);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 60));

// ---- adaptive quality: drop resolution (then shadows) if frames run long ----
let frameCount = 0;
let frameAccum = 0;
let qualityTier = 0;
function adapt(dtMs: number): void {
  frameAccum += dtMs;
  frameCount++;
  if (frameCount >= 90) {
    const avg = frameAccum / frameCount;
    frameCount = 0; frameAccum = 0;
    if (avg > 24 && qualityTier < 2) {
      qualityTier++;
      if (qualityTier === 1) renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
      if (qualityTier === 2) { renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; }
    }
  }
}

let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = (now - last) / 1000;
  adapt(now - last);
  last = now;
  game.update(dt);
  renderer.render(scene, rig.camera);
});

// test hooks (harmless in production)
(window as any).__game = {
  get state() { return game.state; },
  get capsuleX() { return game.capsuleX; },
  get pushCount() { return game.pushCount; },
  get dropCount() { return game.dropCount; }
};
