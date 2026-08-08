/**
 * Boot: renderer, quality tier, resize/orientation handling, the frame loop
 * and the two DOM buttons (sound, play again). Everything else lives in the
 * game.
 */
import * as THREE from 'three';
import { Game, type Quality } from './game/game';
import { audio } from './core/audio';
import { buildEnvironment } from './gfx/materials';

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const boot = document.getElementById('boot') as HTMLDivElement;
const bootTap = document.getElementById('bootTap') as HTMLDivElement;
const btnSound = document.getElementById('btnSound') as HTMLButtonElement;
const btnAgain = document.getElementById('btnAgain') as HTMLButtonElement;
const fallback = document.getElementById('fallback') as HTMLDivElement;

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,          // resolution scaling looks better per watt on phones
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });
} catch {
  fallback.style.display = 'flex';
  boot.style.display = 'none';
  throw new Error('no webgl');
}

// ---------------------------------------------------------------------------
// quality tier
// ---------------------------------------------------------------------------
function detectQuality(): Quality {
  const dpr = window.devicePixelRatio || 1;
  const mem = (navigator as any).deviceMemory as number | undefined;
  const cores = navigator.hardwareConcurrency || 4;
  const small = Math.min(window.innerWidth, window.innerHeight) < 360;
  if (small) return 'low';
  if (mem !== undefined && mem <= 3) return 'low';
  if (cores <= 4 && dpr > 2.5) return 'low';
  return 'high';
}

let quality: Quality = detectQuality();
/** Rendering scale, lowered automatically if frames get expensive. */
let pixelCap = quality === 'high' ? 2.0 : 1.35;
let renderScale = 1;

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.32;
renderer.setClearColor(0x0b1018, 1);

const game = new Game(canvas, quality, onRunFinished);
game.scene.environment = buildEnvironment(renderer);
game.scene.environmentIntensity = 1.0;

// ---------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------
function applySize() {
  // visualViewport is the only thing iOS Safari tells the truth with while the
  // URL bar is collapsing
  const vv = window.visualViewport;
  const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
  const h = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, pixelCap) * renderScale;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  game.resize(w, h);
}

let resizePending = 0;
function scheduleResize() {
  clearTimeout(resizePending);
  resizePending = window.setTimeout(applySize, 60);
  applySize();
}

window.addEventListener('resize', scheduleResize);
window.visualViewport?.addEventListener('resize', scheduleResize);
window.addEventListener('orientationchange', () => {
  // iOS reports the old size for a beat or two after the rotation begins
  setTimeout(applySize, 80);
  setTimeout(applySize, 320);
  setTimeout(applySize, 700);
});

applySize();

// ---------------------------------------------------------------------------
// buttons
// ---------------------------------------------------------------------------
const SPEAKER_ON = `<svg viewBox="0 0 32 32" fill="none" stroke="#bfe8ff" stroke-width="2.4"
  stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h5l6-5v18l-6-5H6z"/>
  <path d="M22 11a7 7 0 0 1 0 10"/><path d="M25.5 7.5a12 12 0 0 1 0 17"/></svg>`;
const SPEAKER_OFF = `<svg viewBox="0 0 32 32" fill="none" stroke="#8fa6b6" stroke-width="2.4"
  stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h5l6-5v18l-6-5H6z"/>
  <path d="M22 12l7 8M29 12l-7 8"/></svg>`;

let muted = false;
try { muted = localStorage.getItem('lab-muted') === '1'; } catch { /* private mode */ }
audio.setMuted(muted);
btnSound.innerHTML = muted ? SPEAKER_OFF : SPEAKER_ON;
btnSound.classList.add('on');
btnSound.addEventListener('click', (e) => {
  e.stopPropagation();
  muted = !muted;
  audio.unlock();
  audio.setMuted(muted);
  btnSound.innerHTML = muted ? SPEAKER_OFF : SPEAKER_ON;
  try { localStorage.setItem('lab-muted', muted ? '1' : '0'); } catch { /* ignore */ }
});

btnAgain.addEventListener('click', (e) => {
  e.stopPropagation();
  btnAgain.classList.remove('on');
  game.requestRestart();
});

function onRunFinished() {
  if (!btnAgain.classList.contains('on')) btnAgain.classList.add('on');
}

// ---------------------------------------------------------------------------
// background / foreground
// ---------------------------------------------------------------------------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.suspend();
  else { audio.resume(); last = performance.now(); }
});
window.addEventListener('pagehide', () => audio.suspend());
window.addEventListener('pageshow', () => { audio.resume(); last = performance.now(); });

// ---------------------------------------------------------------------------
// frame loop
// ---------------------------------------------------------------------------
let last = performance.now();
let started = false;
/** Dev only: lets the automated pass advance game time on a slow software GL. */
let timeScale = 1;
let frameAccum = 0;
let frameCount = 0;
let scaleChecks = 0;

function frame(now: number) {
  requestAnimationFrame(frame);
  // clamp: coming back from the background must never fast-forward the game
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
  last = now;

  game.update(dt * timeScale);
  renderer.render(game.scene, game.rig.camera);

  if (!started) {
    started = true;
    bootTap.textContent = 'さわって　あそぼう';
    setTimeout(() => {
      boot.classList.add('hide');
      setTimeout(() => { boot.style.display = 'none'; }, 600);
    }, 420);
  }

  // adaptive resolution: three sustained slow seconds and we quietly back off
  frameAccum += dt;
  frameCount++;
  if (frameAccum > 1.5) {
    const avg = frameAccum / frameCount;
    if (avg > 0.030 && renderScale > 0.62 && scaleChecks < 4) {
      renderScale = Math.max(0.62, renderScale - 0.16);
      scaleChecks++;
      applySize();
    }
    frameAccum = 0;
    frameCount = 0;
  }
}
requestAnimationFrame(frame);

// expose for debugging in the browser console during development
(window as any).__lab = { game, renderer };

if (import.meta.env.DEV) {
  const q = new URLSearchParams(location.search);
  const stage = q.get('stage');
  if (stage) setTimeout(() => game.debugJump(stage, Number(q.get('ribbon') ?? 6)), 200);
  const fast = Number(q.get('fast') ?? 0);
  if (fast > 0) timeScale = Math.min(12, fast);
}
