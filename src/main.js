// Bootstrap: renderer, environment, the three scenes, input, adaptive quality.

import * as THREE from '../vendor/three/three.module.min.js';
import { Game } from './game.js';
import { RevealScene, RoomScene } from './showcase.js';
import { GameAudio } from './audio.js';
import { environmentEquirect } from './textures.js';
import { addToCollection, loadCollection } from './storage.js';
import { SPECIES_INFO } from './plush.js';
import { clamp } from './util.js';

const canvas = document.getElementById('gl');
const ui = {
  grab: document.getElementById('btn-grab'),
  room: document.getElementById('btn-room'),
  back: document.getElementById('btn-back'),
  again: document.getElementById('btn-again'),
  toRoom: document.getElementById('btn-toroom'),
  revealUI: document.getElementById('reveal-ui'),
  roomUI: document.getElementById('room-ui'),
  playUI: document.getElementById('play-ui'),
  hint: document.getElementById('hint'),
  count: document.getElementById('count-value'),
  revealName: document.getElementById('reveal-name'),
  roomEmpty: document.getElementById('room-empty'),
  boot: document.getElementById('boot'),
};

/* ------------------------------------------------------------------ */
/* renderer                                                            */
/* ------------------------------------------------------------------ */

const maxDpr = clamp(window.devicePixelRatio || 1, 1, 2);
let dpr = maxDpr > 1.75 ? 1.75 : maxDpr;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: dpr < 1.5,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
});
renderer.setPixelRatio(dpr);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// environment: gives the chrome claw and the acrylic something to reflect
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envRT = pmrem.fromEquirectangular(environmentEquirect());
const envMap = envRT.texture;

const audio = new GameAudio();

let quality = maxDpr > 1.9 ? 1 : 0.85;
const game = new Game(renderer, audio, { quality });
game.setEnvironment(envMap);
const reveal = new RevealScene();
reveal.scene.environment = envMap;
const room = new RoomScene();
room.scene.environment = envMap;

/* ------------------------------------------------------------------ */
/* mode switching                                                      */
/* ------------------------------------------------------------------ */

let mode = 'play';
let collection = loadCollection();
updateCount();

// index (into `collection`) of the toy that should visibly drop into the
// room the next time it opens — set on a win, consumed once by the reveal's
// おへや button, and never touched by the plain play-screen room button.
let pendingArrival = null;

function setMode(next) {
  if (mode === next) return;
  if (next === 'play' && game.state === 'won') game.resumeAfterReveal();
  if (mode === 'reveal' && next !== 'reveal') reveal.clear();
  if (mode === 'room' && next !== 'room') room.clear();
  mode = next;
  ui.playUI.classList.toggle('hidden', mode !== 'play');
  ui.revealUI.classList.toggle('hidden', mode !== 'reveal');
  ui.roomUI.classList.toggle('hidden', mode !== 'room');
  document.body.dataset.mode = mode;
  resize();
}

function updateCount() {
  ui.count.textContent = String(collection.length);
}

game.onWin = (record) => {
  collection = addToCollection(record.species, record.variant);
  pendingArrival = collection.length - 1;
  updateCount();
  // fromPos/fromQuat may not have arrived yet from upstream (or this build
  // of game.js may predate them) — RevealScene.show() degrades gracefully
  // to a neutral entrance when they are undefined.
  reveal.show(record, quality, { fromPos: record.fromPos, fromQuat: record.fromQuat });
  reveal.resize(size.w, size.h);
  ui.revealName.textContent = SPECIES_INFO[record.species]?.name ?? '';
  setMode('reveal');
  audio.cheer();
};

game.onStateChange = (s) => {
  const busy = s !== 'aim';
  ui.grab.classList.toggle('busy', busy);
  ui.grab.setAttribute('aria-disabled', busy ? 'true' : 'false');
};

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */

const size = { w: 1, h: 1 };
let activePointer = null;
let downPos = { x: 0, y: 0, t: 0 };

function ndc(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * 2 - 1,
    y: -((e.clientY - r.top) / r.height) * 2 + 1,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (activePointer !== null) return;
  activePointer = e.pointerId;
  canvas.setPointerCapture?.(e.pointerId);
  const p = ndc(e);
  downPos = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (mode === 'play') {
    game.beginDrag(p.x, p.y);
    hideHint();
  } else if (mode === 'room') {
    const pl = room.pick(p.x, p.y);
    if (pl) {
      const kind = room.react(pl);
      if (kind === 'hop') audio.pop();
      else if (kind === 'spin') audio.blip(1046);
      else audio.blip(784);
      audio.softTouch(0.5);
    }
  }
}, { passive: true });

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer) return;
  if (mode !== 'play') return;
  const p = ndc(e);
  game.moveDrag(p.x, p.y);
}, { passive: true });

function endPointer(e) {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  if (mode !== 'play') return;
  const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
  const moved = Math.hypot(dx, dy);
  game.endDrag();
  if (moved < 12 && performance.now() - downPos.t < 600) {
    const p = ndc(e);
    game.tapAt(p.x, p.y);
  }
}
canvas.addEventListener('pointerup', endPointer, { passive: true });
canvas.addEventListener('pointercancel', endPointer, { passive: true });

/* big buttons */
function bindButton(el, fn) {
  if (!el) return;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    audio.unlock();
    el.classList.add('pressed');
  });
  const release = (e) => {
    el.classList.remove('pressed');
    e.preventDefault();
    e.stopPropagation();
  };
  el.addEventListener('pointerup', (e) => {
    release(e);
    fn();
  });
  el.addEventListener('pointerleave', (e) => el.classList.remove('pressed'));
  el.addEventListener('pointercancel', release);
  el.addEventListener('click', (e) => { e.preventDefault(); });
}

bindButton(ui.grab, () => {
  if (mode !== 'play') return;
  if (game.startGrab()) {
    audio.blip(560);
    hideHint();
  }
});
bindButton(ui.room, () => {
  // opened from the play screen, not off a fresh win — nothing "arrives"
  room.populate(collection, quality);
  room.resize(size.w, size.h);
  ui.roomEmpty.classList.toggle('hidden', collection.length > 0);
  setMode('room');
  audio.blip(700);
});
bindButton(ui.back, () => { setMode('play'); audio.blip(520); });
bindButton(ui.again, () => { setMode('play'); audio.blip(660); });
bindButton(ui.toRoom, () => {
  const arrivingIndex = pendingArrival;
  pendingArrival = null;
  room.populate(collection, quality, arrivingIndex != null ? { arrivingIndex } : undefined);
  room.resize(size.w, size.h);
  ui.roomEmpty.classList.toggle('hidden', collection.length > 0);
  setMode('room');
  audio.blip(700);
});

/* hint hand: disappears the moment the child touches anything */
let hintHidden = false;
function hideHint() {
  if (hintHidden) return;
  hintHidden = true;
  ui.hint.classList.add('gone');
}

/* stop the page itself from moving under the game */
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1 || e.target === canvas) e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('contextmenu', (e) => e.preventDefault());

/* ------------------------------------------------------------------ */
/* resize                                                              */
/* ------------------------------------------------------------------ */

function resize() {
  const vv = window.visualViewport;
  const w = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
  const h = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
  size.w = w; size.h = h;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  game.resize(w, h);
  reveal.resize(w, h);
  room.resize(w, h);
  document.body.dataset.orient = w > h ? 'landscape' : 'portrait';
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
window.visualViewport?.addEventListener('resize', resize);
resize();

/* ------------------------------------------------------------------ */
/* adaptive quality                                                    */
/* ------------------------------------------------------------------ */

const perf = { acc: 0, n: 0, cooldown: 2 };

// The scene got heavier for this rework (twelve prizes instead of six, plus
// the drama/arrival extras), which raises the steady-state frame cost and
// pushes it closer to the old down-shift threshold. Widen the dead zone
// between the down- and up-shift triggers, average over a longer window,
// and take a smaller step on the way back up, so a device that idles near
// the boundary settles on a pixel ratio instead of oscillating every couple
// of seconds.
function tuneQuality(dt) {
  perf.cooldown -= dt;
  perf.acc += dt; perf.n++;
  if (perf.n < 60 || perf.cooldown > 0) return;
  const avg = perf.acc / perf.n;
  perf.acc = 0; perf.n = 0;
  if (avg > 0.024 && dpr > 0.85) {
    dpr = Math.max(0.85, dpr - 0.2);
    perf.cooldown = 3;
    resize();
    if (dpr <= 1.0 && quality > 0.4) {
      quality = 0.35;
      game.setQuality(quality);
    }
  } else if (avg < 0.0115 && dpr < maxDpr - 0.05) {
    dpr = Math.min(maxDpr, dpr + 0.1);
    perf.cooldown = 5;
    resize();
  }
}

/* ------------------------------------------------------------------ */
/* loop                                                                */
/* ------------------------------------------------------------------ */

let last = performance.now();
let booted = false;

// An exception anywhere in a per-frame path would otherwise leave a frozen
// picture on screen with no way out — and the player here cannot read an error
// or think to reload. Recover by reloading once; the collection is on disk, so
// nothing is lost. The guard stops a reproducible fault becoming a reload loop.
const CRASH_KEY = 'nuigurumi-crane.recovered';
function recoverFromCrash(err) {
  renderer.setAnimationLoop(null);
  audio.stopMotor();
  let already = false;
  try { already = sessionStorage.getItem(CRASH_KEY) === '1'; } catch (e) { /* private mode */ }
  if (already) {
    // second failure in a row: stop, and leave the boot screen up rather than
    // reloading forever
    ui.boot?.classList.remove('gone');
    throw err;
  }
  try { sessionStorage.setItem(CRASH_KEY, '1'); } catch (e) { /* private mode */ }
  window.location.reload();
}

renderer.setAnimationLoop(() => {
  try {
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;      // tab switch / hiccup guard
    if (dt <= 0) dt = 1 / 60;

    tuneQuality(dt);

    if (mode === 'play') {
      game.update(dt);
      renderer.render(game.scene, game.camera);
    } else if (mode === 'reveal') {
      game.update(Math.min(dt, 1 / 30));   // keep the pile settling behind the scenes
      reveal.update(dt);
      renderer.render(reveal.scene, reveal.camera);
    } else {
      room.update(dt);
      renderer.render(room.scene, room.camera);
    }

    if (!booted) {
      booted = true;
      ui.boot.classList.add('gone');
      setTimeout(() => ui.boot.remove(), 700);
      // a frame completed, so whatever went wrong last time is behind us
      try { sessionStorage.removeItem(CRASH_KEY); } catch (e) { /* private mode */ }
    }
  } catch (err) {
    recoverFromCrash(err);
  }
});

// iOS can drop the GL context when the tab is backgrounded for a while; the
// collection is already on disk, so the honest recovery is a clean reload.
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  audio.stopMotor();
}, false);
canvas.addEventListener('webglcontextrestored', () => window.location.reload(), false);

document.addEventListener('visibilitychange', () => {
  last = performance.now();
  if (document.hidden) audio.stopMotor();
});

// expose for debugging / manual testing
window.__crane = { game, reveal, room, audio, renderer };
