// Unified pointer input for a 4-year-old's hand.
//
// Only five gestures exist in this game: tap, circular motion, swipe, long
// press and wide drag.  Everything is driven by a single active pointer;
// extra fingers are ignored rather than fighting the first one, and losing a
// finger mid-gesture (pointercancel, leaving the surface, backgrounding the
// tab) always resolves cleanly through `end`.

import { Emitter, angDelta, TAU } from './util.js';

export class Input extends Emitter {
  constructor(el) {
    super();
    this.el = el;
    this.active = false;
    this.id = null;

    // css pixels
    this.x = 0; this.y = 0;
    this.startX = 0; this.startY = 0;
    this.prevX = 0; this.prevY = 0;
    this.dx = 0; this.dy = 0;         // delta since previous move event
    this.moved = 0;                    // accumulated path length
    this.downTime = 0;
    this.held = 0;                     // seconds the pointer has been down

    // normalized device coords (-1..1) for raycasting
    this.ndc = { x: 0, y: 0 };
    this.startNdc = { x: 0, y: 0 };

    // circular gesture accumulator
    this.circleCenter = null;          // {x,y} in css px
    this.circleAngle = 0;              // last measured angle
    this.circleTurns = 0;              // signed accumulated revolutions
    this.circleSpeed = 0;              // revolutions / second (smoothed)
    this._lastCircleT = 0;

    this._bind();
  }

  _bind() {
    const el = this.el;
    const opts = { passive: false };
    if (window.PointerEvent) {
      el.addEventListener('pointerdown', this._down, opts);
      el.addEventListener('pointermove', this._move, opts);
      window.addEventListener('pointerup', this._up, opts);
      window.addEventListener('pointercancel', this._up, opts);
    } else {
      // very old iOS fallback
      el.addEventListener('touchstart', this._tDown, opts);
      el.addEventListener('touchmove', this._tMove, opts);
      window.addEventListener('touchend', this._tUp, opts);
      window.addEventListener('touchcancel', this._tUp, opts);
      el.addEventListener('mousedown', this._down, opts);
      el.addEventListener('mousemove', this._move, opts);
      window.addEventListener('mouseup', this._up, opts);
    }
    // Safari: block the double-tap zoom and rubber-band scroll on the canvas
    el.addEventListener('gesturestart', (e) => e.preventDefault(), opts);
    el.addEventListener('touchmove', (e) => e.preventDefault(), opts);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this._forceEnd(); });
    window.addEventListener('blur', () => this._forceEnd());
  }

  _tDown = (e) => { const t = e.changedTouches[0]; this._begin(t.identifier, t.clientX, t.clientY); e.preventDefault(); };
  _tMove = (e) => {
    for (const t of e.changedTouches) if (t.identifier === this.id) this._update(t.clientX, t.clientY);
    e.preventDefault();
  };
  _tUp = (e) => { for (const t of e.changedTouches) if (t.identifier === this.id) this._end(); };

  _down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this._begin(e.pointerId ?? 'mouse', e.clientX, e.clientY);
    if (this.el.setPointerCapture && e.pointerId != null) {
      try { this.el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    e.preventDefault();
  };
  _move = (e) => {
    const id = e.pointerId ?? 'mouse';
    if (!this.active || id !== this.id) return;
    // coalesced events give smooth circles even when the main thread is busy
    const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (pts && pts.length > 1) { for (const p of pts) this._update(p.clientX, p.clientY); }
    else this._update(e.clientX, e.clientY);
    e.preventDefault();
  };
  _up = (e) => {
    const id = e.pointerId ?? 'mouse';
    if (!this.active || id !== this.id) return;
    this._end();
  };

  _toNdc(x, y, out) {
    const r = this.el.getBoundingClientRect();
    out.x = ((x - r.left) / r.width) * 2 - 1;
    out.y = -(((y - r.top) / r.height) * 2 - 1);
    return out;
  }

  _begin(id, x, y) {
    if (this.active) return;              // ignore additional fingers
    this.active = true; this.id = id;
    this.x = this.startX = this.prevX = x;
    this.y = this.startY = this.prevY = y;
    this.dx = this.dy = 0; this.moved = 0; this.held = 0;
    this.downTime = performance.now();
    this._toNdc(x, y, this.ndc);
    this.startNdc.x = this.ndc.x; this.startNdc.y = this.ndc.y;
    this.circleTurns = 0; this.circleSpeed = 0; this._lastCircleT = this.downTime;
    if (this.circleCenter) this.circleAngle = Math.atan2(y - this.circleCenter.y, x - this.circleCenter.x);
    this.emit('down', this);
  }

  _update(x, y) {
    this.dx = x - this.x; this.dy = y - this.y;
    this.prevX = this.x; this.prevY = this.y;
    this.x = x; this.y = y;
    this.moved += Math.hypot(this.dx, this.dy);
    this._toNdc(x, y, this.ndc);

    if (this.circleCenter) {
      const a = Math.atan2(y - this.circleCenter.y, x - this.circleCenter.x);
      const r = Math.hypot(y - this.circleCenter.y, x - this.circleCenter.x);
      // only count motion at a believable radius, so tiny jitters near the
      // centre cannot spin the accumulator
      if (r > 26) {
        const d = angDelta(this.circleAngle, a);
        this.circleTurns += d / TAU;
        const now = performance.now();
        const dt = Math.max(0.008, (now - this._lastCircleT) / 1000);
        this._lastCircleT = now;
        this.circleSpeed = this.circleSpeed * 0.7 + (Math.abs(d / TAU) / dt) * 0.3;
      }
      this.circleAngle = a;
    }
    this.emit('move', this);
  }

  _end() {
    if (!this.active) return;
    // A tap is "put a finger down and lift it without moving".  Deliberately
    // NOT time-limited: a four-year-old rests a finger for a beat, and on a
    // busy frame the up event can be delivered late enough that any duration
    // cut-off would silently swallow the touch.
    const isTap = this.moved < 24;
    this.active = false; this.id = null;
    this.circleSpeed = 0;
    this.emit('up', this);
    if (isTap) this.emit('tap', this);
  }

  /** used when the app loses focus mid-drag */
  _forceEnd() { if (this.active) this._end(); }

  /** stages call this each frame so `held` and idle decay stay accurate */
  tick(dt) {
    if (this.active) this.held += dt;
    else this.circleSpeed = Math.max(0, this.circleSpeed - dt * 3);
  }

  /** anchor for the circular gesture, in css px */
  setCircleCenter(x, y) {
    this.circleCenter = { x, y };
    if (this.active) this.circleAngle = Math.atan2(this.y - y, this.x - x);
  }
  clearCircleCenter() { this.circleCenter = null; }

  /** swipe direction helpers (screen px since pointerdown) */
  get totalDX() { return this.x - this.startX; }
  get totalDY() { return this.y - this.startY; }
}
