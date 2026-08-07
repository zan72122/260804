import * as THREE from 'three';
import { wrapAngle } from './util.js';

// ---------------------------------------------------------------------------
// 指ひとつだけ。ドラッグ、ぐるぐる（円運動）、スワイプ。
// マルチタッチもピンチも使わない。まちがえようがない入力にする。
// ---------------------------------------------------------------------------

export class Input {
  constructor(dom) {
    this.dom = dom;
    this.isDown = false;
    this.justPressed = false;
    this.justReleased = false;

    this.pos = new THREE.Vector2();     // CSSピクセル
    this.prev = new THREE.Vector2();
    this.start = new THREE.Vector2();
    this.delta = new THREE.Vector2();   // このフレームの移動量
    this.ndc = new THREE.Vector2();     // -1..1
    this.travel = 0;                    // 押してからの総移動距離
    this.speed = 0;                     // 平滑化した速さ px/s
    this.downTime = 0;
    this.lastRelease = null;            // {dx, dy, speed, duration}

    this._pending = new THREE.Vector2();
    this._pendingTravel = 0;
    this._pointerId = null;
    this._lastMoveTime = 0;
    this._instSpeed = 0;
    this._prevAngle = null;
    this.angleDelta = 0;                // ぐるぐるの角度差（ラジアン、符号つき）
    this.idle = 0;                      // 何も触っていない時間

    this._onDown = this._down.bind(this);
    this._onMove = this._move.bind(this);
    this._onUp = this._up.bind(this);

    dom.addEventListener('pointerdown', this._onDown, { passive: false });
    dom.addEventListener('pointermove', this._onMove, { passive: false });
    window.addEventListener('pointerup', this._onUp, { passive: false });
    window.addEventListener('pointercancel', this._onUp, { passive: false });
    dom.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS Safari のダブルタップ拡大よけ
    dom.addEventListener('dblclick', (e) => e.preventDefault());
  }

  _local(e) {
    const r = this.dom.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, r];
  }

  _down(e) {
    if (this._pointerId !== null) return; // 一本目の指だけ見る
    e.preventDefault();
    this._pointerId = e.pointerId;
    try { this.dom.setPointerCapture(e.pointerId); } catch { /* 無視 */ }
    const [x, y] = this._local(e);
    this.pos.set(x, y);
    this.prev.set(x, y);
    this.start.set(x, y);
    this.isDown = true;
    this._justPressedPending = true;
    this.travel = 0;
    this._pendingTravel = 0;
    this._pending.set(0, 0);
    this.downTime = performance.now();
    this._lastMoveTime = this.downTime;
    this._prevAngle = null;
    this._instSpeed = 0;
  }

  _move(e) {
    if (e.pointerId !== this._pointerId) return;
    e.preventDefault();
    const [x, y] = this._local(e);
    const dx = x - this.pos.x;
    const dy = y - this.pos.y;
    this._pending.x += dx;
    this._pending.y += dy;
    const d = Math.hypot(dx, dy);
    this._pendingTravel += d;
    this.pos.set(x, y);
    const now = performance.now();
    const dt = Math.max(8, now - this._lastMoveTime) / 1000;
    this._instSpeed = d / dt;
    this._lastMoveTime = now;
  }

  _up(e) {
    if (e.pointerId !== this._pointerId) return;
    this._pointerId = null;
    try { this.dom.releasePointerCapture(e.pointerId); } catch { /* 無視 */ }
    this.isDown = false;
    this._justReleasedPending = true;
    this.lastRelease = {
      dx: this.pos.x - this.start.x,
      dy: this.pos.y - this.start.y,
      speed: this._instSpeed,
      duration: (performance.now() - this.downTime) / 1000,
    };
    this._instSpeed = 0;
  }

  /** 毎フレーム、ゲーム更新の前に呼ぶ */
  update(dt, width, height) {
    this.justPressed = !!this._justPressedPending;
    this.justReleased = !!this._justReleasedPending;
    this._justPressedPending = false;
    this._justReleasedPending = false;

    this.delta.copy(this._pending);
    this._pending.set(0, 0);
    this.travel += this._pendingTravel;
    this._pendingTravel = 0;

    const target = this.isDown ? this._instSpeed : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 12);
    if (!this.isDown) this._instSpeed *= Math.max(0, 1 - dt * 8);

    this.ndc.set((this.pos.x / width) * 2 - 1, -(this.pos.y / height) * 2 + 1);
    this.idle = this.isDown || this.delta.lengthSq() > 0.5 ? 0 : this.idle + dt;
  }

  /** 指を離したときのスワイプ。読み終わったら消える。 */
  takeSwipe(minDistance = 40) {
    const r = this.lastRelease;
    if (!r) return null;
    this.lastRelease = null;
    if (Math.hypot(r.dx, r.dy) < minDistance) return null;
    return r;
  }

  /**
   * 画面上の点 (cx, cy) のまわりの回転量。時計まわり/反時計まわりどちらでも
   * よいように、呼び出し側で絶対値を取れる。
   */
  angleAround(cx, cy) {
    if (!this.isDown) {
      this._prevAngle = null;
      return 0;
    }
    const a = Math.atan2(this.pos.y - cy, this.pos.x - cx);
    if (this._prevAngle === null) {
      this._prevAngle = a;
      return 0;
    }
    const r = Math.hypot(this.pos.x - cx, this.pos.y - cy);
    const d = wrapAngle(a - this._prevAngle);
    this._prevAngle = a;
    // 中心に近すぎると角度が暴れるので、そこは効かせない
    if (r < 24) return 0;
    return Math.abs(d) > 1.2 ? 0 : d;
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this._onDown);
    this.dom.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
  }
}
