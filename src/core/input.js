// Pointer handling. Only four gestures exist in this game: tap, swipe, big drag
// and stroke — all of them forgiving, none of them requiring precision.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = false;
    this.x = 0; this.y = 0;         // css px
    this.px = 0; this.py = 0;       // previous
    this.startX = 0; this.startY = 0;
    this.startTime = 0;
    this.travel = 0;                // total path length of the current press
    this.speed = 0;                 // px/s, smoothed
    this.ndc = [0, 0];
    this.moved = false;
    this.handlers = {};

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this._down(e), opts);
    canvas.addEventListener('pointermove', (e) => this._move(e), opts);
    canvas.addEventListener('pointerup', (e) => this._up(e), opts);
    canvas.addEventListener('pointercancel', (e) => this._up(e), opts);
    canvas.addEventListener('pointerleave', (e) => this._up(e), opts);
    // Stop Safari from scrolling / zooming the page under small fingers.
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), opts);
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), opts);
    canvas.addEventListener('gesturestart', (e) => e.preventDefault(), opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  on(name, fn) { this.handlers[name] = fn; return this; }
  _emit(name, arg) { const f = this.handlers[name]; if (f) f(arg); }

  _coords(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    this.ndc[0] = (x / r.width) * 2 - 1;
    this.ndc[1] = 1 - (y / r.height) * 2;
    return { x, y };
  }

  _down(e) {
    if (this.down && e.isPrimary === false) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    const c = this._coords(e);
    this.down = true;
    this.moved = false;
    this.travel = 0;
    this.speed = 0;
    this.x = this.px = this.startX = c.x;
    this.y = this.py = this.startY = c.y;
    this.startTime = performance.now();
    this._emit('down', this.state());
  }

  _move(e) {
    const c = this._coords(e);
    this.px = this.x; this.py = this.y;
    this.x = c.x; this.y = c.y;
    if (!this.down) { this._emit('hover', this.state()); return; }
    const dx = this.x - this.px, dy = this.y - this.py;
    const d = Math.hypot(dx, dy);
    this.travel += d;
    this.speed = this.speed * 0.7 + d * 0.3 * 60;
    if (this.travel > 8) this.moved = true;
    this._emit('move', this.state());
  }

  _up(e) {
    if (!this.down) return;
    this.down = false;
    const dt = performance.now() - this.startTime;
    const s = this.state();
    if (!this.moved && dt < 500) this._emit('tap', s);
    this._emit('up', s);
    this.speed = 0;
  }

  state() {
    return {
      x: this.x, y: this.y,
      dx: this.x - this.px, dy: this.y - this.py,
      ndc: [this.ndc[0], this.ndc[1]],
      travel: this.travel,
      speed: this.speed,
      down: this.down,
      moved: this.moved,
    };
  }
}
