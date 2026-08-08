// ---------------------------------------------------------------------------
//  Bootstrap: renderer, resize handling, the frame loop and the two icon
//  buttons. Everything else lives in game.js.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { createGame } from './game.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('scene');
const app = document.getElementById('app');
const boot = document.getElementById('boot');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.12, 90);
scene.add(camera);

const audio = createAudio();
const input = createInput(canvas);
const game = createGame({ scene, camera, renderer, audio });

/* ----------------------------------------------------------- sizing ----- */
let W = 1, H = 1, portrait = false;

function resize() {
  const vv = window.visualViewport;
  const cw = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
  const ch = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
  W = cw; H = ch;
  portrait = ch > cw * 1.02;

  // A tall phone needs a wider lens or the fish never fits; a tablet in
  // landscape wants a longer one so the hall reads deep instead of bulging.
  const aspect = cw / ch;
  camera.fov = portrait ? 46 : aspect > 1.7 ? 34 : 38;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(cw, ch, false);
  // an in-flight stroke is dropped, but its progress is kept
  input.cancel();
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => { resize(); setTimeout(resize, 260); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

/* ------------------------------------------------------------- HUD ------ */
const btnRestart = document.getElementById('btn-restart');
const btnSound = document.getElementById('btn-sound');
btnRestart.addEventListener('click', () => { game.restart(); resize(); });
btnSound.addEventListener('click', () => {
  audio.start(); audio.resume();
  const on = !audio.enabled;
  audio.setEnabled(on);
  btnSound.classList.toggle('muted', !on);
});
// audio may only start from a gesture — the first touch anywhere does it
const kick = () => { audio.start(); audio.resume(); };
canvas.addEventListener('pointerdown', kick, { once: true, passive: true });

/* ------------------------------------------------------------- loop ----- */
let last = performance.now();
let first = true;
let booted = false;

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
  last = now;

  const dragging = game.update(dt, input, W, H, portrait, first);
  if (window.__debugCam) {                     // used by the automated play-through
    camera.up.set(0, 1, 0);
    camera.position.fromArray(window.__debugCam.p);
    camera.lookAt(...window.__debugCam.t);
  }
  app.classList.toggle('dragging', !!dragging);
  input.endFrame();
  first = false;

  renderer.render(scene, camera);

  if (!booted) {
    booted = true;
    boot.classList.add('hidden');
    setTimeout(() => { boot.style.display = 'none'; }, 700);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ------------------------------------------------- automated play-through -
 * Advances the simulation without rendering, driving the real pointer -> path
 * -> stroke pipeline, so the test exercises the same snapping and speed cap a
 * finger does. Used by the QA script; harmless in normal play.
 * ------------------------------------------------------------------------ */
window.__game = game;
window.__three = { scene, camera, renderer };
window.__view = () => ({ W, H, portrait });
window.__sim = (seconds, driver, dtc = 1 / 60) => {
  const n = Math.max(1, Math.round(seconds / dtc));
  for (let i = 0; i < n; i++) {
    if (driver) {
      const q = driver(i / n, game);
      if (q) {
        if (!input.p.active) { input.p.justDown = true; input.p.downX = q[0]; input.p.downY = q[1]; }
        input.p.active = true; input.p.x = q[0]; input.p.y = q[1];
      } else if (input.p.active) {
        input.p.active = false; input.p.justUp = true;
      }
    }
    game.update(dtc, input, W, H, portrait, false);
    input.endFrame();
  }
  return game.stage;
};
window.__tapAt = (x, y) => {
  input.p.x = x; input.p.y = y; input.p.tap = true;
  game.update(1 / 60, input, W, H, portrait, false);
  input.endFrame();
};
