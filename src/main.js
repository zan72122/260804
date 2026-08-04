import { G, newGame } from './state.js';
import { unlock } from './audio.js';
import { hint } from './ui.js';
import { sceneBook, sceneLight, scenePlace } from './scenes_intro.js';
import { sceneTank, sceneFree } from './scenes_tank.js';
import { sceneCouch, scenePress, sceneDry, sceneReturn, sceneMenu } from './scenes_finish.js';

const scenes = {
  book: sceneBook, light: sceneLight, place: scenePlace,
  tank: sceneTank, free: sceneFree,
  couch: sceneCouch, press: scenePress, dry: sceneDry,
  ret: sceneReturn, menu: sceneMenu,
};

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');

const L = { W: 0, H: 0, portrait: true, dpr: 1 };
G.L = L;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  L.W = w; L.H = h; L.portrait = h >= w; L.dpr = dpr;
}
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 60));
resize();

newGame('first');
// dev/QA shortcut: ?scene=menu|free — only scenes that need no prior state
{
  const q = new URLSearchParams(location.search).get('scene');
  if (q === 'menu' || q === 'free') G.scene = q;
}

// ---- scene switching with fade (model state survives; only visuals fade)
let fade = 0, fadeDir = 0, pending = null;
G.go = (name) => {
  if (pending || fadeDir === 1) return;
  pending = name;
  fadeDir = 1;
};
function cur() { return scenes[G.scene]; }
if (cur().enter) cur().enter();

// ---- single-pointer input (extra fingers ignored so multi-touch can't break)
let ptr = null;
function toP(e) { return { x: e.clientX, y: e.clientY }; }
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  unlock();
  if (ptr || fadeDir === 1) return;
  try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ }
  const { x, y } = toP(e);
  ptr = { id: e.pointerId, x, y, px: x, py: y, vx: 0, vy: 0, t: performance.now() };
  hint.idle = 0;
  if (cur().down) cur().down(ptr);
}, { passive: false });

cv.addEventListener('pointermove', (e) => {
  if (!ptr || e.pointerId !== ptr.id) return;
  e.preventDefault();
  const { x, y } = toP(e);
  const now = performance.now();
  const dt = Math.max(1, now - ptr.t) / 1000;
  ptr.vx = ptr.vx * 0.6 + ((x - ptr.x) / dt) * 0.4;
  ptr.vy = ptr.vy * 0.6 + ((y - ptr.y) / dt) * 0.4;
  ptr.px = ptr.x; ptr.py = ptr.y;
  ptr.x = x; ptr.y = y; ptr.t = now;
  hint.idle = 0;
  if (cur().move) cur().move(ptr);
}, { passive: false });

function endPtr(e) {
  if (!ptr || (e && e.pointerId !== ptr.id)) return;
  if (cur().up) cur().up(ptr);
  ptr = null;
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
window.addEventListener('blur', () => endPtr(null));
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ---- main loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  hint.idle += dt;
  const s = cur();
  if (s.update) s.update(dt);
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.clearRect(0, 0, L.W, L.H);
  s.render(ctx, L);
  if (fadeDir === 1) {
    fade += dt * 3.2;
    if (fade >= 1) {
      fade = 1;
      const n = pending;
      pending = null;
      endPtr(null);
      G.scene = n;
      if (scenes[n].enter) scenes[n].enter();
      fadeDir = -1;
    }
  } else if (fadeDir === -1) {
    fade -= dt * 2.4;
    if (fade <= 0) { fade = 0; fadeDir = 0; }
  }
  if (fade > 0) {
    ctx.fillStyle = `rgba(43,35,32,${fade})`;
    ctx.fillRect(0, 0, L.W, L.H);
  }
}
requestAnimationFrame(frame);

// ---- QA hook (read-only introspection for automated verification)
window.__qa = {
  state() {
    return {
      scene: G.scene,
      pending,
      seed: G.seed,
      kind: G.kind,
      flags: G.flags ? { ...G.flags, clothPos: undefined } : null,
      level: G.scene === 'free' ? G.freeSim?.level : G.sim?.level,
      draining: G.scene === 'free' ? G.freeSim?.draining : G.sim?.draining,
      fill: G.paper ? G.paper.fillRatio() : 0,
      fibersActive: (G.scene === 'free' ? G.freeSim : G.sim)?.activeCount() ?? 0,
      fibersPoured: (G.scene === 'free' ? G.freeSim : G.sim)?.poured ?? 0,
      need: G.sim?.need,
      dispersion: (G.scene === 'free' ? G.freeSim : G.sim)?.dispersion() ?? 0,
      damages: G.paper ? G.paper.damages.map(d => ({
        type: d.type, found: d.found, done: d.done,
        fill: d.cap > 0 ? Math.min(1, d.got / d.cap) : 0,
      })) : [],
      size: { W: L.W, H: L.H, portrait: L.portrait },
    };
  },
  targets() {
    const s = cur();
    return s.qa ? s.qa(L) : {};
  },
};
