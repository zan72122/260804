// OWNER: agent A2 input — pointer tracking + swipe detection. No game logic beyond this.
const TAU = 0.08; // ~80ms exponential smoothing window for velocity

let canvasRef = null, busRef = null, stateRef = null, configRef = null;

let activePointerId = null;
let gestureDown = false;

// raw pointer position (CSS px), updated synchronously on pointer events
let rawX = 0, rawY = 0;
// position at the time of the last update() call, for instantaneous velocity
let lastUpdX = 0, lastUpdY = 0;
// smoothed velocity
let vx = 0, vy = 0;
// x position marking the start of the current horizontal travel segment
// (reset on pointerdown and on every emitted swipe)
let anchorX = 0;

function tryReleaseCapture(pointerId) {
  try { canvasRef.releasePointerCapture(pointerId); } catch (_e) { /* already released */ }
}

function checkSwipe(reportedX) {
  const delta = reportedX - anchorX;
  const threshold = configRef.SWIPE_MIN_TRAVEL;
  if (Math.abs(delta) >= threshold) {
    const dir = delta > 0 ? 1 : -1;
    busRef.emit('swipe', { speed: stateRef.pointer.speed, dir });
    anchorX = reportedX;
    return true;
  }
  return false;
}

function onPointerDown(e) {
  if (activePointerId !== null) return; // one-finger game: ignore extra pointers
  activePointerId = e.pointerId;
  try { canvasRef.setPointerCapture(e.pointerId); } catch (_e) { /* ignore */ }
  rawX = e.clientX; rawY = e.clientY;
  lastUpdX = rawX; lastUpdY = rawY;
  anchorX = rawX;
  vx = 0; vy = 0;
  gestureDown = true;
  busRef.emit('pointer:down', { x: rawX, y: rawY });
}

function onPointerMove(e) {
  if (e.pointerId !== activePointerId) return;
  rawX = e.clientX; rawY = e.clientY;
  checkSwipe(rawX);
}

function endGesture(e, wasCancel) {
  if (e.pointerId !== activePointerId) return;
  if (typeof e.clientX === 'number') { rawX = e.clientX; rawY = e.clientY; }
  checkSwipe(rawX); // final swipe if enough travel since last reversal
  gestureDown = false;
  activePointerId = null;
  tryReleaseCapture(e.pointerId);
  busRef.emit('pointer:up', { x: rawX, y: rawY });
}

function onPointerUp(e) { endGesture(e, false); }
function onPointerCancel(e) { endGesture(e, true); } // treated same as up

function onReset() {
  // Clear swipe travel tracking so leftover pre-reset distance can't fire a
  // spurious swipe post-reset. Never force-end an in-progress gesture here —
  // that would corrupt mid-gesture state; just re-anchor it.
  anchorX = rawX;
}

export default {
  init({ canvas, bus, state, config }) {
    canvasRef = canvas; busRef = bus; stateRef = state; configRef = config;
    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointermove', onPointerMove, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });
    canvas.addEventListener('pointercancel', onPointerCancel, { passive: true });
    bus.on('game:reset', onReset);
  },
  resize() { /* pointer coords are viewport-relative; nothing to recompute */ },
  update(dt, state) {
    if (dt > 0) {
      const instVX = (rawX - lastUpdX) / dt;
      const instVY = (rawY - lastUpdY) / dt;
      const alpha = 1 - Math.exp(-dt / TAU);
      vx += (instVX - vx) * alpha;
      vy += (instVY - vy) * alpha;
    }
    lastUpdX = rawX; lastUpdY = rawY;
    const p = state.pointer;
    p.x = rawX; p.y = rawY; p.down = gestureDown;
    p.vx = vx; p.vy = vy; p.speed = Math.hypot(vx, vy);
  },
};
