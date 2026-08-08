// Boot, resize, orientation and the frame loop.

import { Renderer } from './gl.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { UI } from './ui.js';
import { Game, PHASE } from './game.js';

const canvas = document.getElementById('stage');
const ui = new UI();
const sfx = new Sfx();

let renderer = null;
let game = null;
let input = null;
let running = false;
let lastT = 0;

function pixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  const area = window.innerWidth * window.innerHeight;
  // Full density on phones, trimmed on large tablets so the fill rate holds up.
  const cap = area > 900000 ? 1.6 : 2.0;
  return Math.min(dpr, cap);
}

function resize() {
  if (!renderer) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.resize(w, h, pixelRatio());
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

function boot(restoreState) {
  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    ui.fatal('この ブラウザでは あそべません\n(WebGL2 が つかえません)\n\n' + e.message);
    return false;
  }
  resize();
  input = new Input(canvas);
  game = new Game(renderer, input, sfx, ui);
  ui.bind(game);

  if (restoreState) {
    game.patternId = restoreState.patternId;
    game.history = restoreState.history;
    game.fabric.replay(restoreState.journal);
    game.guideStage = restoreState.guideStage;
    game.waxLayer = restoreState.waxLayer;
    game.applyGuide();
    game.setPhase(restoreState.phase);
    game.waxLevel = restoreState.waxLevel;
  }
  return true;
}

function snapshot() {
  if (!game) return null;
  return {
    journal: game.fabric.journal.slice(),
    phase: game.phase,
    patternId: game.patternId,
    history: game.history.slice(),
    guideStage: game.guideStage,
    waxLayer: game.waxLayer,
    waxLevel: game.waxLevel,
  };
}

// iOS can drop the GL context when the tab is backgrounded. Rebuild and replay
// so a half-finished cloth is never lost.
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  running = false;
  window._pendingState = snapshot();
}, false);

canvas.addEventListener('webglcontextrestored', () => {
  const state = window._pendingState;
  window._pendingState = null;
  if (boot(state)) {
    running = true;
    lastT = performance.now();
    requestAnimationFrame(frame);
  }
}, false);

function frame(t) {
  if (!running) return;
  requestAnimationFrame(frame);
  let dt = (t - lastT) / 1000;
  lastT = t;
  if (!isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.05);
  try {
    game.update(dt);
    game.render();
  } catch (e) {
    running = false;
    console.error(e);
    ui.fatal('エラーが おきました\n' + (e && e.message ? e.message : e));
  }
}

let resizeTimer = 0;
function onViewportChange() {
  clearTimeout(resizeTimer);
  resize();
  // Some iOS versions report stale metrics right at the rotation boundary.
  resizeTimer = setTimeout(resize, 260);
}

window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', onViewportChange);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', onViewportChange);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sfx.stopPour();
    sfx.stopSoak();
    sfx.stopShimmer();
  } else if (sfx.ctx && sfx.ctx.state === 'suspended') {
    sfx.ctx.resume();
  }
});

function start() {
  if (running) return;
  sfx.unlock();
  if (!renderer && !boot(null)) return;
  ui.hideBoot();
  running = true;
  lastT = performance.now();
  requestAnimationFrame(frame);
}

document.getElementById('boot-start').addEventListener('click', start);
canvas.addEventListener('pointerdown', () => sfx.unlock(), { once: true });

// Expose a small hook so the game can be driven from an automated play-through.
window.__batik = {
  get game() { return game; },
  get ui() { return ui; },
  start,
  snapshot,
  isRunning: () => running,
  PHASE,
};
