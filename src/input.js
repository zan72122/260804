// ---------------------------------------------------------------------------
//  Pointer handling + the stroke controller.
//
//  Design rules, all of them for a four year old's hands:
//   * a stroke may start anywhere on screen, not only on the line
//   * the finger is projected onto the cut path and snapped to it, so the
//     blade can never be steered somewhere unsafe or silly
//   * progress only ever moves forward, and it is capped in speed, so a wild
//     flick still produces the slow confident draw of a professional
//   * lifting the finger keeps the progress: a stroke can be resumed as many
//     times as it takes, from wherever the finger lands next
// ---------------------------------------------------------------------------
import { clamp, damp } from './util.js';

export function createInput(el) {
  const p = {
    active: false, id: -1,
    x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0,
    downX: 0, downY: 0, downTime: 0,
    travelled: 0, justDown: false, justUp: false, tap: false,
    speed: 0,
  };

  function pos(e) {
    const r = el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function down(e) {
    if (p.active) return;
    const [x, y] = pos(e);
    p.active = true; p.id = e.pointerId;
    p.x = p.px = p.downX = x;
    p.y = p.py = p.downY = y;
    p.dx = p.dy = 0; p.travelled = 0; p.justDown = true;
    p.downTime = performance.now();
    if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
  }
  function move(e) {
    if (!p.active || e.pointerId !== p.id) return;
    const [x, y] = pos(e);
    p.dx += x - p.x; p.dy += y - p.y;
    p.travelled += Math.hypot(x - p.x, y - p.y);
    p.x = x; p.y = y;
  }
  function up(e) {
    if (!p.active || (e.pointerId !== p.id && e.pointerId !== undefined)) return;
    p.active = false; p.id = -1; p.justUp = true;
    p.tap = p.travelled < 16 && performance.now() - p.downTime < 400;
  }

  el.addEventListener('pointerdown', down, { passive: true });
  el.addEventListener('pointermove', move, { passive: true });
  el.addEventListener('pointerup', up, { passive: true });
  el.addEventListener('pointercancel', up, { passive: true });
  el.addEventListener('lostpointercapture', up, { passive: true });
  // iOS: stop rubber-band scrolling / double-tap zoom stealing the gesture
  el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  el.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  el.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  function endFrame() {
    p.speed = Math.hypot(p.x - p.px, p.y - p.py);
    p.px = p.x; p.py = p.y;
    p.justDown = false; p.justUp = false; p.tap = false;
  }
  /** Drop any in-flight stroke — used when the device rotates. */
  function cancel() { p.active = false; p.id = -1; p.travelled = 0; }

  return { p, endFrame, cancel };
}

/* --------------------------------------------------------------------- *
 *  Stroke controller: turns raw pointer motion into path progress.
 * --------------------------------------------------------------------- */
export function createStroke() {
  const s = {
    path: null,
    progress: 0,
    engaged: false,
    velocity: 0,           // path metres per second, smoothed (drives the audio)
    lastMoveTime: 0,
    justFinished: false,
    idle: 0,
  };

  function begin(path) {
    s.path = path;
    s.progress = 0;
    s.engaged = false;
    s.velocity = 0;
    s.justFinished = false;
    s.idle = 0;
  }

  /**
   * @returns true while the stroke is being actively driven this frame.
   */
  function update(dt, input, camera, w, h) {
    s.justFinished = false;
    const path = s.path;
    if (!path) return false;
    path.project(camera, w, h);

    if (!input.active) {
      s.engaged = false;
      s.velocity = damp(s.velocity, 0, 9, dt);
      s.idle += dt;
      // a stroke left within a whisker of the end completes on its own, so a
      // small hand never gets stuck one pixel short
      if (s.progress > 0.94 && s.progress < 1) {
        s.progress = Math.min(1, s.progress + dt * 0.9);
        if (s.progress >= 1) s.justFinished = true;
      }
      return false;
    }

    s.idle = 0;
    // How far ahead of the current progress the finger may reach in one frame.
    // Generous, but bounded, so a stray tap near the end can't skip the cut.
    const look = 0.30;
    const hit = path.nearestScreen(input.x, input.y, s.progress, Math.min(1, s.progress + look));

    // Engage on contact from anywhere on screen — and also for a finger that
    // was already down when this stroke began, which is exactly what happens
    // when a small hand never lets go between steps.
    s.engaged = true;

    // Screen-space snap radius scales with the display so it feels the same
    // on a 4.7" phone and a 13" tablet.
    const target = hit.t;

    const cap = path.speedCap / path.length;          // progress per second
    const step = clamp(target - s.progress, 0, cap * dt);
    const before = s.progress;
    s.progress = clamp(s.progress + step, 0, 1);

    const inst = ((s.progress - before) / Math.max(dt, 1e-4)) * path.length;
    s.velocity = damp(s.velocity, inst, 12, dt);

    if (s.progress >= 1 && before < 1) s.justFinished = true;
    return step > 1e-6;
  }

  return { s, begin, update };
}
