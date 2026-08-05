// 一本指のタップと、大きなスワイプだけを扱う入力。
// むずかしい操作・長押し・マルチタッチは使わない。
export class TouchInput {
  constructor(el) {
    this.el = el;
    this.active = false;
    this.pointerId = null;
    this.start = { x: 0, y: 0, t: 0 };
    this.cur = { x: 0, y: 0 };
    this.prev = { x: 0, y: 0 };
    this.delta = { x: 0, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.moved = 0;
    this.listeners = { down: [], move: [], up: [], tap: [], swipe: [] };

    const opts = { passive: false };
    el.addEventListener('pointerdown', (e) => this._down(e), opts);
    el.addEventListener('pointermove', (e) => this._move(e), opts);
    el.addEventListener('pointerup', (e) => this._up(e), opts);
    el.addEventListener('pointercancel', (e) => this._up(e), opts);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS のダブルタップ拡大・スクロールを抑える
    el.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, opts);
    el.addEventListener('touchmove', (e) => e.preventDefault(), opts);
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  on(name, fn) { this.listeners[name].push(fn); return this; }
  _emit(name, payload) { for (const fn of this.listeners[name]) fn(payload); }

  _pos(e) {
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    return {
      x, y,
      nx: (x / r.width) * 2 - 1,
      ny: -(y / r.height) * 2 + 1,
      w: r.width, h: r.height,
    };
  }

  _down(e) {
    if (this.active) return;              // 二本目以降は無視
    this.active = true;
    this.pointerId = e.pointerId;
    const p = this._pos(e);
    this.start = { x: p.x, y: p.y, t: performance.now() };
    this.cur = p; this.prev = p;
    this.delta = { x: 0, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.moved = 0;
    try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
    this._emit('down', p);
  }

  _move(e) {
    const p = this._pos(e);
    if (!this.active || e.pointerId !== this.pointerId) {
      this.hover = p;
      return;
    }
    this.delta = { x: p.x - this.cur.x, y: p.y - this.cur.y };
    this.vel.x = this.vel.x * 0.7 + this.delta.x * 0.3;
    this.vel.y = this.vel.y * 0.7 + this.delta.y * 0.3;
    this.moved += Math.hypot(this.delta.x, this.delta.y);
    this.prev = this.cur;
    this.cur = p;
    this._emit('move', { ...p, dx: this.delta.x, dy: this.delta.y, moved: this.moved });
  }

  _up(e) {
    if (!this.active || e.pointerId !== this.pointerId) return;
    const p = this._pos(e);
    const dt = (performance.now() - this.start.t) / 1000;
    const dx = p.x - this.start.x, dy = p.y - this.start.y;
    const dist = Math.hypot(dx, dy);
    const ref = Math.min(p.w, p.h);
    this.active = false;
    this.pointerId = null;
    try { this.el.releasePointerCapture(e.pointerId); } catch (_) {}
    this._emit('up', { ...p, dist, dt, dx, dy });
    if (dist < ref * 0.045 && dt < 0.6) {
      this._emit('tap', p);
    } else if (dist > ref * 0.10) {
      const dir = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down' : 'up');
      this._emit('swipe', { ...p, dx, dy, dist, dir, speed: dist / Math.max(dt, 0.05) });
    }
  }
}
