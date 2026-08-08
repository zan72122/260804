import { approach, clamp, TAU } from './util.js';

/*
 * Gesture reading for small hands.
 *
 * A four-year-old does not draw circles; they draw wobbly potatoes, they stop
 * halfway, they change direction. So nothing here demands accuracy. Circling is
 * measured as accumulated turn about a *rolling* centroid of the last few
 * hundred milliseconds, which tolerates a drifting, lopsided path, and any
 * sustained movement at all falls back to driving the lure at a gentle baseline
 * speed. Swipes only need to go roughly the right way.
 */

const TAP_MS = 320;
const TAP_PX = 22;

export function createInput(el) {
  const listeners = { tap: [], swipeUp: [], swipeIn: [], dragShort: [], down: [], up: [] };
  const on = (name, fn) => (listeners[name].push(fn), api);
  const emit = (name, arg) => listeners[name].forEach((f) => f(arg));

  const state = {
    down: false,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    startT: 0,
    pathLen: 0,
    // circle tracking
    turn: 0, // signed accumulated angle over the recent window
    omega: 0, // smoothed angular velocity, rad/s
    radius: 0,
    speed: 0, // px/s
    circling: false,
    lastMoveT: 0,
    idleFor: 0,
  };

  const hist = []; // {x, y, t}
  const WINDOW = 0.62;

  function now() {
    return performance.now() / 1000;
  }

  function pos(e) {
    const r = el.getBoundingClientRect();
    const t = e.touches && e.touches.length ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function pushSample(x, y, t) {
    hist.push({ x, y, t });
    while (hist.length && t - hist[0].t > WINDOW) hist.shift();
  }

  function analyse(t) {
    if (hist.length < 4) {
      state.circling = false;
      return;
    }
    let cx = 0,
      cy = 0;
    for (const h of hist) {
      cx += h.x;
      cy += h.y;
    }
    cx /= hist.length;
    cy /= hist.length;

    // Accumulated signed turn about the rolling centroid.
    let turn = 0;
    let prev = null;
    let rSum = 0;
    for (const h of hist) {
      const dx = h.x - cx,
        dy = h.y - cy;
      const r = Math.hypot(dx, dy);
      rSum += r;
      if (r < 6) {
        prev = null;
        continue;
      }
      const a = Math.atan2(dy, dx);
      if (prev !== null) {
        let d = a - prev;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        turn += d;
      }
      prev = a;
    }
    state.radius = rSum / hist.length;
    state.turn = turn;
    const span = Math.max(hist[hist.length - 1].t - hist[0].t, 1e-3);
    const measured = turn / span;
    // Heavy smoothing: the lure should glide, not twitch with every wobble.
    state.omega += (measured - state.omega) * 0.28;
    state.circling = state.radius > 16 && Math.abs(turn) > 0.9;
  }

  function onDown(e) {
    const p = pos(e);
    state.down = true;
    state.x = state.startX = p.x;
    state.y = state.startY = p.y;
    state.startT = now();
    state.pathLen = 0;
    state.idleFor = 0;
    state.lastMoveT = state.startT;
    hist.length = 0;
    pushSample(p.x, p.y, state.startT);
    emit('down', { x: p.x, y: p.y });
  }

  function onMove(e) {
    if (!state.down) return;
    const p = pos(e);
    const t = now();
    const dx = p.x - state.x,
      dy = p.y - state.y;
    const d = Math.hypot(dx, dy);
    state.pathLen += d;
    const dt = Math.max(t - state.lastMoveT, 1e-3);
    state.speed += (d / dt - state.speed) * 0.3;
    state.x = p.x;
    state.y = p.y;
    state.lastMoveT = t;
    state.idleFor = 0;
    pushSample(p.x, p.y, t);
    analyse(t);
  }

  function onUp() {
    if (!state.down) return;
    state.down = false;
    const t = now();
    const dur = t - state.startT;
    const dx = state.x - state.startX;
    const dy = state.y - state.startY;
    const dist = Math.hypot(dx, dy);

    if (dur < TAP_MS / 1000 && dist < TAP_PX) {
      emit('tap', { x: state.startX, y: state.startY });
    } else if (dist < 90 && state.pathLen < 220 && dur < 0.9) {
      // A short tug — accepted anywhere a tap is, so unclipping the leash works
      // whether the child pokes it or pulls it.
      emit('dragShort', { x: state.startX, y: state.startY, dx, dy });
    }

    if (dist > 46) {
      const straightness = dist / Math.max(state.pathLen, 1);
      const info = {
        x: state.startX,
        y: state.startY,
        ex: state.x,
        ey: state.y,
        dx,
        dy,
        dist,
        dur,
        straightness,
      };
      // Upward flick: generous, only needs to be mostly up.
      if (dy < -46 && Math.abs(dy) > Math.abs(dx) * 0.6 && straightness > 0.55) {
        emit('swipeUp', info);
      }
      if (straightness > 0.6) emit('swipeIn', info);
    }
    emit('up', {});
  }

  function onCancel() {
    state.down = false;
    emit('up', {});
  }

  const opts = { passive: false };
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture?.(e.pointerId);
    onDown(e);
  }, opts);
  el.addEventListener('pointermove', onMove, opts);
  el.addEventListener('pointerup', onUp, opts);
  el.addEventListener('pointercancel', onCancel, opts);
  el.addEventListener('pointerleave', onUp, opts);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('touchstart', (e) => e.preventDefault(), opts);
  el.addEventListener('touchmove', (e) => e.preventDefault(), opts);
  el.addEventListener('gesturestart', (e) => e.preventDefault());
  el.addEventListener('dblclick', (e) => e.preventDefault());

  /** Called once per frame; decays the gesture state when the finger rests. */
  function tick(dt) {
    const t = now();
    if (state.down) {
      if (t - state.lastMoveT > 0.09) {
        state.speed *= Math.exp(-dt * 6);
        state.omega *= Math.exp(-dt * 3.2);
        analyse(t);
      }
    } else {
      state.speed *= Math.exp(-dt * 5);
      state.omega *= Math.exp(-dt * 2.2);
      state.circling = false;
      state.idleFor += dt;
    }
    return state;
  }

  const api = { on, tick, state, get isDown() { return state.down; } };
  return api;
}

/**
 * Turns raw finger motion into a smooth, always-plausible lure orbit.
 * Fast scribbling spins the lure fast, slow drawing spins it slowly, and a
 * child who merely wiggles still gets a lure going round.
 */
export function createCircleDriver() {
  let phase = Math.PI * 0.5;
  let omega = 0;
  let dir = 1;
  let energy = 0; // 0..1, how engaged the player currently is

  function update(dt, input) {
    const s = input.state;
    let want = 0;
    if (s.down && s.speed > 30) {
      if (s.circling && Math.abs(s.omega) > 0.6) {
        dir = Math.sign(s.omega) || dir;
        want = clamp(Math.abs(s.omega), 1.0, 4.2) * dir;
      } else {
        // Not a circle — but they are moving, so keep the lure turning at a
        // pace that matches their energy rather than stalling.
        const pace = clamp(s.speed / 420, 0, 1);
        want = (1.0 + pace * 2.0) * dir;
      }
      energy = Math.min(1, energy + dt * 1.5);
    } else {
      // Momentum: the lure keeps swinging for a moment, then eases down to a
      // slow idle whirl so it never looks dead.
      want = omega * 0.985;
      if (Math.abs(want) < 0.75) want = 0.75 * dir;
      energy = Math.max(0, energy - dt * 0.35);
    }
    omega += (want - omega) * approach(5.5, dt);
    phase += omega * dt;
    return { phase, omega, dir, energy, speed: Math.abs(omega) };
  }

  return { update, get phase() { return phase; }, get omega() { return omega; } };
}
