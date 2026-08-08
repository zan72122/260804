// Gesture layer.
//
// Four-year-old hands: no buttons to hit, no precision required.
//   swipe down            -> get low
//   swipe up              -> stand up
//   swipe left/right      -> one crawl stroke (rub back and forth to keep going)
//   press and hold        -> keep crawling on your own
//   tap / drag anywhere   -> point the torch there
// Keyboard equivalents keep it playable on a desktop.

const SWIPE = 34;        // px before a drag counts as a direction
const STROKE = 46;       // px of sideways travel per crawl stroke
const HOLD_MS = 260;

export class Input {
  constructor(el) {
    this.el = el;
    this.listeners = {};
    this.pointers = new Map();
    this.aim = { x: 0, y: 0 };      // -1..1 normalised, for the torch
    this.holding = false;
    this._bind();
  }

  on(type, fn) { (this.listeners[type] ||= []).push(fn); return this; }
  emit(type, data) { (this.listeners[type] || []).forEach((f) => f(data)); }

  _norm(e) {
    const r = this.el.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: -(((e.clientY - r.top) / r.height) * 2 - 1),
    };
  }

  _bind() {
    const el = this.el;
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId);
      const n = this._norm(e);
      this.pointers.set(e.pointerId, {
        sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
        strokeAcc: 0, t0: performance.now(), dir: null, moved: 0, holdFired: false,
      });
      this.aim = n;
      this.emit('aim', n);
      this.emit('press', n);
    });

    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      const n = this._norm(e);
      this.aim = n;
      this.emit('aim', n);
      if (!p) return;
      const dx = e.clientX - p.lx, dy = e.clientY - p.ly;
      p.lx = e.clientX; p.ly = e.clientY;
      p.moved += Math.hypot(dx, dy);

      const tx = e.clientX - p.sx, ty = e.clientY - p.sy;
      if (!p.dir && Math.hypot(tx, ty) > SWIPE) {
        p.dir = Math.abs(ty) > Math.abs(tx) * 1.15 ? 'v' : 'h';
        if (p.dir === 'v') {
          this.emit(ty > 0 ? 'down' : 'up', n);
          p.vFired = true;
        }
      }
      if (p.dir === 'v' && !p.vFired) {
        // A second vertical flick inside the same drag still counts.
        if (Math.abs(ty) > SWIPE * 2) { this.emit(ty > 0 ? 'down' : 'up', n); p.vFired = true; }
      }
      if (p.dir === 'h') {
        p.strokeAcc += Math.abs(dx);
        if (p.strokeAcc >= STROKE) {
          p.strokeAcc = 0;
          this.emit('stroke', { dir: Math.sign(dx) || 1 });
        }
      }
    });

    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.holding && this.pointers.size === 0) { this.holding = false; this.emit('holdEnd'); }
      if (!p) return;
      const dt = performance.now() - p.t0;
      if (p.moved < SWIPE * 0.8 && dt < 400) this.emit('tap', this._norm(e));
      this.emit('release');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);

    // Press-and-hold: still on screen, barely moving, for long enough.
    this._holdTimer = setInterval(() => {
      if (this.holding) {
        let anyStill = false;
        for (const p of this.pointers.values()) if (p.moved < 900) anyStill = true;
        if (!anyStill || this.pointers.size === 0) { this.holding = false; this.emit('holdEnd'); }
        return;
      }
      for (const p of this.pointers.values()) {
        if (performance.now() - p.t0 > HOLD_MS && p.moved < 26) {
          this.holding = true;
          this.emit('holdStart');
          break;
        }
      }
    }, 60);

    // --- keyboard, so the game is playable without a touchscreen ----------
    this.keys = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') e.preventDefault();
        return;
      }
      this.keys.add(e.code);
      switch (e.code) {
        case 'ArrowDown': case 'KeyS': this.emit('down', this.aim); e.preventDefault(); break;
        case 'ArrowUp': case 'KeyW': this.emit('up', this.aim); e.preventDefault(); break;
        case 'ArrowLeft': case 'KeyA': this.emit('stroke', { dir: -1 }); e.preventDefault(); break;
        case 'ArrowRight': case 'KeyD': this.emit('stroke', { dir: 1 }); e.preventDefault(); break;
        case 'Space': case 'Enter': this.emit('tap', this.aim); e.preventDefault(); break;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Holding an arrow key crawls continuously.
    this._keyTimer = setInterval(() => {
      if (this.keys.has('ArrowLeft') || this.keys.has('ArrowRight') || this.keys.has('KeyA') || this.keys.has('KeyD')) {
        this.emit('stroke', { dir: this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? -1 : 1, auto: true });
      }
    }, 620);

    // Desktop torch aiming without a button held down.
    el.addEventListener('mousemove', (e) => {
      if (this.pointers.size) return;
      const n = this._norm(e);
      this.aim = n;
      this.emit('aim', n);
    });
  }
}
