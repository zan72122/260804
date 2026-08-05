/**
 * 一本指だけの入力。
 * 押している／離しているの 2 状態しかなく、マルチタッチは最初の 1 点だけ拾う。
 * スクロールもピンチも起きないよう、画面上の既定動作は全部止める。
 */
import * as THREE from 'three';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.ndc = new THREE.Vector2(0, 0);       // -1..1 の正規化座標
    this.screen = new THREE.Vector2(0, 0);    // CSS ピクセル
    this.down = false;
    this.justPressed = false;
    this.hasMoved = false;
    this.activeId = null;
    this.lastActivity = performance.now() / 1000;
    this._raycaster = new THREE.Raycaster();

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', this._onDown, opts);
    window.addEventListener('pointermove', this._onMove, opts);
    window.addEventListener('pointerup', this._onUp, opts);
    window.addEventListener('pointercancel', this._onUp, opts);
    // iOS のダブルタップ拡大・ゴムバンドスクロールを抑える保険。
    document.addEventListener('gesturestart', (e) => e.preventDefault(), opts);
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 1) e.preventDefault();
    }, opts);
  }

  _set(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.screen.set(x, y);
    this.ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
  }

  _onDown = (e) => {
    if (this.activeId !== null) return;
    e.preventDefault();
    this.activeId = e.pointerId;
    this._set(e);
    this.down = true;
    this.justPressed = true;
    this.hasMoved = false;
    this.lastActivity = performance.now() / 1000;
    if (this.canvas.setPointerCapture) {
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* 非対応でも問題なし */ }
    }
  };

  _onMove = (e) => {
    if (this.activeId !== e.pointerId) return;
    e.preventDefault();
    const px = this.screen.x, py = this.screen.y;
    this._set(e);
    if (Math.hypot(this.screen.x - px, this.screen.y - py) > 1.5) this.hasMoved = true;
    this.lastActivity = performance.now() / 1000;
  };

  _onUp = (e) => {
    if (this.activeId !== e.pointerId) return;
    e.preventDefault();
    this.activeId = null;
    this.down = false;
    this.lastActivity = performance.now() / 1000;
  };

  /** 指の位置から、指定した平面上のワールド座標を求める。 */
  pickOnPlane(camera, plane, out = new THREE.Vector3()) {
    this._raycaster.setFromCamera(this.ndc, camera);
    const hit = this._raycaster.ray.intersectPlane(plane, out);
    return hit ? out : null;
  }

  endFrame() {
    this.justPressed = false;
  }
}
