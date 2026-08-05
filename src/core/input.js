// 一本指の操作をひとつの流れに正規化する。
// 工程側は down / move / up と「平面上のワールド座標」を受け取るだけでよい。
import * as THREE from 'three';

export class Input {
  constructor(stage, domElement) {
    this.stage = stage;
    this.el = domElement;
    this.ndc = new THREE.Vector2();
    this.prevNdc = new THREE.Vector2();
    this.down = false;
    this.handlers = null;    // 現在の工程のハンドラ
    this.lastActivity = performance.now();
    this._plane = new THREE.Plane();
    this._hit = new THREE.Vector3();
    this.screen = new THREE.Vector2();
    this.prevScreen = new THREE.Vector2();
    this.velocity = new THREE.Vector2();

    const opts = { passive: false };
    el_bind(this.el, 'pointerdown', (e) => this._onDown(e), opts);
    el_bind(window, 'pointermove', (e) => this._onMove(e), opts);
    el_bind(window, 'pointerup', (e) => this._onUp(e), opts);
    el_bind(window, 'pointercancel', (e) => this._onUp(e), opts);
    // iOS Safari の二本指ズーム・ダブルタップズーム抑制
    el_bind(document, 'gesturestart', (e) => e.preventDefault(), opts);
    el_bind(document, 'dblclick', (e) => e.preventDefault(), opts);
  }

  setHandlers(h) { this.handlers = h; }
  clearHandlers() {
    if (this.down && this.handlers && this.handlers.up) {
      try { this.handlers.up(this._payload()); } catch (e) { /* noop */ }
    }
    this.handlers = null;
    this.down = false;
  }

  _updateFromEvent(e) {
    const r = this.el.getBoundingClientRect();
    this.prevNdc.copy(this.ndc);
    this.prevScreen.copy(this.screen);
    this.screen.set(e.clientX - r.left, e.clientY - r.top);
    this.ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.velocity.copy(this.screen).sub(this.prevScreen);
    this.lastActivity = performance.now();
  }

  _payload() {
    return {
      ndc: this.ndc,
      prevNdc: this.prevNdc,
      screen: this.screen,
      velocity: this.velocity,
      down: this.down,
      input: this,
    };
  }

  _onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    this.el.setPointerCapture && this.el.setPointerCapture(e.pointerId);
    this._updateFromEvent(e);
    this.prevNdc.copy(this.ndc);
    this.prevScreen.copy(this.screen);
    this.velocity.set(0, 0);
    this.down = true;
    if (this.handlers && this.handlers.down) this.handlers.down(this._payload());
  }
  _onMove(e) {
    this._updateFromEvent(e);
    if (this.down) e.preventDefault();
    // カメラの微妙な視差（指の位置に合わせて空間が生きて見える）
    this.stage.setSway(this.ndc.x, this.ndc.y);
    if (this.handlers && this.handlers.move) this.handlers.move(this._payload());
  }
  _onUp(e) {
    if (!this.down) return;
    this._updateFromEvent(e);
    this.down = false;
    if (this.handlers && this.handlers.up) this.handlers.up(this._payload());
  }

  /** 任意平面（法線 + 通過点）とレイの交点 */
  rayToPlane(normal, point, out = new THREE.Vector3()) {
    this._plane.setFromNormalAndCoplanarPoint(normal, point);
    const ray = this.stage.rayFrom(this.ndc).ray;
    const hit = ray.intersectPlane(this._plane, out);
    return hit ? out : null;
  }
  /** 水平面 y = height との交点 */
  rayToGround(height = 0, out = new THREE.Vector3()) {
    return this.rayToPlane(UP, new THREE.Vector3(0, height, 0), out);
  }
  /** カメラに正対する平面（点をつまんで動かすとき用） */
  rayToViewPlane(point, out = new THREE.Vector3()) {
    const n = new THREE.Vector3();
    this.stage.camera.getWorldDirection(n);
    return this.rayToPlane(n.negate(), point, out);
  }
  intersect(objects, recursive = true) {
    const ray = this.stage.rayFrom(this.ndc);
    return ray.intersectObjects(objects, recursive);
  }
  idleSeconds() {
    return (performance.now() - this.lastActivity) / 1000;
  }
  poke() { this.lastActivity = performance.now(); }
}

const UP = new THREE.Vector3(0, 1, 0);

function el_bind(el, type, fn, opts) {
  el.addEventListener(type, fn, opts);
}
