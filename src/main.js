import * as THREE from 'three';
import { createGame } from './game.js';

/*
 * Boot, resize and the frame loop.
 *
 * Phones are the target, so the renderer caps its pixel ratio, the canvas is
 * sized from visualViewport (which is the only measurement that survives an
 * iOS rotation with the URL bar sliding about), and every layout change is
 * re-applied a beat later because Safari reports stale sizes mid-rotation.
 */

const stage = document.getElementById('stage');
const hintLayer = document.getElementById('hint-layer');
const boot = document.getElementById('boot');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

// A low-quality mode for weak GPUs (and for automated playtests, which run on
// a software rasteriser and would otherwise crawl).
const params = new URLSearchParams(location.search);
const quality = params.get('quality') === 'low' ? 'low' : 'high';
if (quality === 'low') {
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(1);
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);

const game = createGame({
  scene,
  camera,
  renderer,
  dom: renderer.domElement,
  hintLayer,
  quality,
});

/* ---------- sizing ---------- */

function viewportSize() {
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : window.innerWidth);
  const h = Math.round(vv ? vv.height : window.innerHeight);
  return { w: Math.max(w, 1), h: Math.max(h, 1) };
}

let lastW = 0,
  lastH = 0;

function resize(force) {
  const { w, h } = viewportSize();
  if (!force && w === lastW && h === lastH) return;
  lastW = w;
  lastH = h;
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  hintLayer.style.width = w + 'px';
  hintLayer.style.height = h + 'px';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

resize(true);
window.addEventListener('resize', () => resize(false));
window.addEventListener('orientationchange', () => {
  // Safari reports the pre-rotation size for a few frames; re-measure after.
  resize(true);
  [60, 180, 400, 800].forEach((ms) => setTimeout(() => resize(true), ms));
});
window.visualViewport?.addEventListener('resize', () => resize(false));
window.visualViewport?.addEventListener('scroll', () => resize(false));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    resize(true);
    last = performance.now();
  }
});

/* ---------- loop ---------- */

let last = performance.now();
let elapsed = 0;
let frames = 0;
let acc = 0;
let resScale = 1;

function frame(now) {
  requestAnimationFrame(frame);
  // Clamp on both ends. The upper bound guards against tab sleeps and rotation
  // stalls; the lower bound matters because the first rAF timestamp can predate
  // the `last` we captured at module scope (texture generation takes a moment),
  // and a negative step makes every exponential smoother run backwards.
  // `__timeScale` is a debug hook so a playtest harness can run the whole
  // falconry loop faster than a software rasteriser would otherwise allow.
  const scale = window.__timeScale || 1;
  let dt = Math.max(0, Math.min(((now - last) / 1000) * scale, 0.05 * scale));
  last = now;
  elapsed += dt;
  resize(false);

  game.update(dt, elapsed);
  renderer.render(scene, camera);

  // Adaptive resolution: if a device cannot hold a reasonable frame rate,
  // step the pixel ratio down once rather than stuttering forever.
  frames++;
  acc += dt;
  if (acc > 2.5) {
    const fps = frames / acc;
    if (fps < 34 && resScale > 0.68 && quality !== 'low') {
      resScale = 0.68;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * resScale);
      resize(true);
    }
    frames = 0;
    acc = 0;
  }
}

requestAnimationFrame(frame);

// Hide the loader once the first real frames are on screen.
setTimeout(() => boot.classList.add('gone'), 320);
setTimeout(() => boot.remove(), 1400);

// iOS will happily bounce or zoom the page out from under a canvas game.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

window.__takajo = game;
