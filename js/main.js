// OWNER: A1 app-shell. Boot, resize, main loop, phase state machine. See CONTRACT.md.
import bus from './bus.js';
import config from './config.js';
import { createState } from './state.js';
import scene, { applyCamera } from './scene.js';
import threads from './threads.js';
import tool from './tool.js';
import input from './input.js';
import finish from './finish.js';
import audio from './audio.js';

// Lifecycle/resize order per contract; update/render orders are separate (below).
const MODULES = [
  ['scene', scene], ['threads', threads], ['tool', tool],
  ['input', input], ['finish', finish], ['audio', audio],
];
const UPDATE_MODULES = [
  ['input', input], ['scene', scene], ['tool', tool],
  ['threads', threads], ['finish', finish], ['audio', audio],
];
const RENDER_MODULES = [
  ['scene', scene], ['threads', threads], ['tool', tool], ['finish', finish],
];

// A broken module call is logged once and cooled down (not disabled forever) so a single
// transient exception (e.g. from finish.js's game:reset handling) can't soft-lock the phase
// machine. After RETRY_MS the call is retried; a persistent bug logs again at that cadence
// instead of spamming every frame.
const RETRY_MS = 2000;
const failed = new Map(); // key -> resume timestamp (performance.now() ms)
function safeCall(key, fn) {
  const resumeAt = failed.get(key);
  const now = performance.now();
  if (resumeAt !== undefined) {
    if (now < resumeAt) return;
    failed.delete(key);
  }
  try { fn(); } catch (err) {
    failed.set(key, now + RETRY_MS);
    console.error(`[main] ${key} failed, retrying in ${RETRY_MS}ms:`, err);
  }
}

function boot() {
  const canvas = document.getElementById('game');
  if (!canvas) { console.error('[main] #game canvas not found'); return; }
  const ctx = canvas.getContext('2d', { alpha: false });
  const state = createState();

  function computeSize() {
    const vv = window.visualViewport;
    const w = Math.round(vv ? vv.width : window.innerWidth);
    const h = Math.round(vv ? vv.height : window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, config.MAX_DPR);
    return { w, h, dpr };
  }

  function applySize() {
    const { w, h, dpr } = computeSize();
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    state.w = w; state.h = h; state.dpr = dpr;
  }

  applySize();

  const ctxArg = { canvas, ctx, bus, state, config };
  for (const [name, mod] of MODULES) {
    if (mod && typeof mod.init === 'function') safeCall(`${name}.init`, () => mod.init(ctxArg));
  }
  for (const [name, mod] of MODULES) {
    if (mod && typeof mod.resize === 'function') safeCall(`${name}.resize`, () => mod.resize(state));
  }

  // Phase state machine — A1 owns state.phase.
  bus.on('lift:start', () => { state.phase = 'lift'; });
  bus.on('nest:placed', () => { state.phase = 'celebrate'; });
  bus.on('game:reset', () => { state.phase = 'play'; });

  // Debounced resize/orientation handling.
  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      applySize();
      for (const [name, mod] of MODULES) {
        if (mod && typeof mod.resize === 'function') safeCall(`${name}.resize`, () => mod.resize(state));
      }
    }, 150);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  // Prevent iOS double-tap zoom / pinch / scroll bounce.
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('gesturechange', (e) => e.preventDefault());

  // Watchdog: if a bug leaves us stuck in 'celebrate' (game:reset never fires — finish.js is
  // the sole emitter), force the reset ourselves after CELEBRATE_TIMEOUT so the game never
  // permanently freezes on the finale screen.
  const CELEBRATE_TIMEOUT = 8; // seconds
  let celebrateSince = null;
  let celebrateResetSent = false;

  // Main loop.
  let last = null;
  function loop(now) {
    requestAnimationFrame(loop);
    if (last === null) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > config.MAX_DT) dt = config.MAX_DT;
    state.time += dt;

    if (state.phase === 'celebrate') {
      if (celebrateSince === null) celebrateSince = state.time;
      if (!celebrateResetSent && state.time - celebrateSince > CELEBRATE_TIMEOUT) {
        celebrateResetSent = true; // guard against double emission
        bus.emit('game:reset', {});
      }
    } else {
      celebrateSince = null;
      celebrateResetSent = false;
    }

    for (const [name, mod] of UPDATE_MODULES) {
      if (mod && typeof mod.update === 'function') safeCall(`${name}.update`, () => mod.update(dt, state));
    }

    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.fillStyle = config.BG_BOTTOM;
    ctx.fillRect(0, 0, state.w, state.h);
    ctx.save();
    safeCall('scene.applyCamera', () => applyCamera(ctx, state));
    for (const [name, mod] of RENDER_MODULES) {
      if (mod && typeof mod.render === 'function') safeCall(`${name}.render`, () => mod.render(ctx, state));
    }
    ctx.restore();
  }
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
