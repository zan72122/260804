// ============================================================================
// 入力 — タップ / ドラッグ / 円をかく / ながおし / スワイプ の 5 つだけ。
// 途中で指をはなしても、必ず後始末が走るようにする。
// ============================================================================

import { TAU, angleDelta, now, clamp01 } from './util.js';

export class PointerInput {
  constructor(el) {
    this.el = el;
    this.active = false;
    this.id = null;
    this.x = 0; this.y = 0;
    this.startX = 0; this.startY = 0;
    this.prevX = 0; this.prevY = 0;
    this.dx = 0; this.dy = 0;
    this.vx = 0; this.vy = 0;
    this.downTime = 0;
    this.held = 0;
    this.travel = 0;
    this.moved = false;

    // 円をかく判定
    this.circleCenter = null;   // {x, y} in CSS px
    this.circleAccum = 0;
    this.circleTotal = 0;
    this._lastAngle = 0;

    this.handlers = {
      down: [], move: [], up: [], cancel: []
    };

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onCancel = this._onCancel.bind(this);

    el.addEventListener('pointerdown', this._onDown, { passive: false });
    window.addEventListener('pointermove', this._onMove, { passive: false });
    window.addEventListener('pointerup', this._onUp, { passive: false });
    window.addEventListener('pointercancel', this._onCancel, { passive: false });
    window.addEventListener('blur', this._onCancel);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._onCancel();
    });
    // iOS Safari の引っぱり更新・拡大を止める
    el.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    el.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    el.addEventListener('gesturestart', e => e.preventDefault());
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  on(type, fn) { this.handlers[type].push(fn); return this; }
  _emit(type, arg) { for (const f of this.handlers[type]) f(arg, this); }

  _local(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }

  _onDown(e) {
    if (this.active) return;
    if (e.cancelable) e.preventDefault();
    const p = this._local(e);
    this.active = true;
    this.id = e.pointerId;
    this.x = this.startX = this.prevX = p.x;
    this.y = this.startY = this.prevY = p.y;
    this.dx = this.dy = this.vx = this.vy = 0;
    this.downTime = now();
    this.held = 0;
    this.travel = 0;
    this.moved = false;
    this.circleAccum = 0;
    this.circleTotal = 0;
    if (this.circleCenter) {
      this._lastAngle = Math.atan2(p.y - this.circleCenter.y, p.x - this.circleCenter.x);
    }
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    this._emit('down', p);
  }

  _onMove(e) {
    if (!this.active || e.pointerId !== this.id) return;
    if (e.cancelable) e.preventDefault();
    const p = this._local(e);
    this.dx = p.x - this.x;
    this.dy = p.y - this.y;
    this.prevX = this.x; this.prevY = this.y;
    this.x = p.x; this.y = p.y;
    const d = Math.hypot(this.dx, this.dy);
    this.travel += d;
    if (this.travel > 8) this.moved = true;
    const k = 0.35;
    this.vx = this.vx * (1 - k) + this.dx * k;
    this.vy = this.vy * (1 - k) + this.dy * k;

    if (this.circleCenter) {
      const a = Math.atan2(p.y - this.circleCenter.y, p.x - this.circleCenter.x);
      const r = Math.hypot(p.x - this.circleCenter.x, p.y - this.circleCenter.y);
      if (r > 18) {
        const da = angleDelta(this._lastAngle, a);
        this.circleAccum += da;
        this.circleTotal += Math.abs(da);
      }
      this._lastAngle = a;
    }
    this._emit('move', p);
  }

  _finish(cancelled) {
    if (!this.active) return;
    const dur = (now() - this.downTime) / 1000;
    const dist = Math.hypot(this.x - this.startX, this.y - this.startY);
    const info = {
      x: this.x, y: this.y,
      startX: this.startX, startY: this.startY,
      duration: dur,
      distance: dist,
      travel: this.travel,
      isTap: !cancelled && dur < 0.35 && dist < 14,
      isSwipe: !cancelled && dist > 42 && (Math.hypot(this.vx, this.vy) > 4.5 || dur < 0.5),
      dirX: dist > 1 ? (this.x - this.startX) / dist : 0,
      dirY: dist > 1 ? (this.y - this.startY) / dist : 0,
      cancelled: !!cancelled
    };
    this.active = false;
    this.id = null;
    this.held = 0;
    this._emit(cancelled ? 'cancel' : 'up', info);
  }

  _onUp(e) {
    if (!this.active || (e && e.pointerId !== this.id)) return;
    if (e && e.cancelable) e.preventDefault();
    this._finish(false);
  }

  _onCancel(e) {
    if (!this.active) return;
    this._finish(true);
  }

  tick(dt) {
    if (this.active) this.held += dt;
    // 動きが止まったら速度も落とす
    if (!this.active) { this.vx *= 0.8; this.vy *= 0.8; }
  }

  // 円運動から「巻いた回数」を取り出す（1 回 = 半周ぶん）
  takeWraps(perWrap = Math.PI) {
    let n = 0;
    while (Math.abs(this.circleAccum) >= perWrap) {
      this.circleAccum -= Math.sign(this.circleAccum) * perWrap;
      n++;
    }
    return n;
  }
}
