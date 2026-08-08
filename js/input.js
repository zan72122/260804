// One finger at a time. Everything the game needs is a position, a velocity
// and whether the finger is down — no taps on small targets, no gestures a
// four year old cannot perform.

export class Input {
  constructor(el) {
    this.el = el;
    this.active = false;
    this.id = null;
    this.x = 0; this.y = 0;          // normalised device coords, -1..1
    this.px = 0; this.py = 0;        // css pixels
    this.dx = 0; this.dy = 0;        // ndc delta since last frame
    this.vx = 0; this.vy = 0;        // smoothed ndc velocity per second
    this.speed = 0;
    this.stillTime = 0;
    this.downTime = 0;
    this.startX = 0; this.startY = 0;
    this.travel = 0;
    this.moved = false;
    this.onDown = null;
    this.onUp = null;
    this._lastX = 0; this._lastY = 0;

    const opts = { passive: false };
    el.addEventListener('pointerdown', (e) => this._down(e), opts);
    el.addEventListener('pointermove', (e) => this._move(e), opts);
    el.addEventListener('pointerup', (e) => this._up(e), opts);
    el.addEventListener('pointercancel', (e) => this._up(e), opts);
    el.addEventListener('touchstart', (e) => e.preventDefault(), opts);
    el.addEventListener('touchmove', (e) => e.preventDefault(), opts);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _coords(e) {
    const r = this.el.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    return {
      px, py,
      x: (px / r.width) * 2 - 1,
      y: -((py / r.height) * 2 - 1),
    };
  }

  _down(e) {
    if (this.active) return;
    if (this.el.setPointerCapture) {
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }
    const c = this._coords(e);
    this.active = true;
    this.id = e.pointerId;
    this.x = this._lastX = this.startX = c.x;
    this.y = this._lastY = this.startY = c.y;
    this.px = c.px; this.py = c.py;
    this.dx = this.dy = 0;
    this.vx = this.vy = 0;
    this.travel = 0;
    this.moved = false;
    this.downTime = 0;
    this.stillTime = 0;
    if (this.onDown) this.onDown(this);
    e.preventDefault();
  }

  _move(e) {
    if (!this.active || e.pointerId !== this.id) return;
    const c = this._coords(e);
    this.x = c.x; this.y = c.y;
    this.px = c.px; this.py = c.py;
    e.preventDefault();
  }

  _up(e) {
    if (!this.active || e.pointerId !== this.id) return;
    this.active = false;
    this.id = null;
    if (this.onUp) this.onUp(this);
    e.preventDefault();
  }

  // Called once per frame after the events have landed.
  update(dt) {
    if (!this.active) {
      this.dx = this.dy = 0;
      this.vx *= Math.exp(-6 * dt);
      this.vy *= Math.exp(-6 * dt);
      this.speed = Math.hypot(this.vx, this.vy);
      return;
    }
    this.downTime += dt;
    this.dx = this.x - this._lastX;
    this.dy = this.y - this._lastY;
    this._lastX = this.x; this._lastY = this.y;
    const step = Math.hypot(this.dx, this.dy);
    this.travel += step;
    if (this.travel > 0.04) this.moved = true;
    const k = 1 - Math.exp(-14 * dt);
    this.vx += ((this.dx / Math.max(dt, 1e-3)) - this.vx) * k;
    this.vy += ((this.dy / Math.max(dt, 1e-3)) - this.vy) * k;
    this.speed = Math.hypot(this.vx, this.vy);
    if (step < 0.002) this.stillTime += dt;
    else this.stillTime = 0;
  }
}
