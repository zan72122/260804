// One finger, that is all. Extra touches are ignored so a small hand resting
// on the screen can never break anything.

import * as THREE from 'three';

export class Input {
  constructor(el) {
    this.el = el;
    this.ndc = new THREE.Vector2();
    this.prevNdc = new THREE.Vector2();
    this.down = false;
    this.justDown = false;
    this.justUp = false;
    this.moved = 0;          // screen travel this frame, in NDC units
    this.heldFor = 0;
    this.id = null;
    this._pendingDown = false;
    this._pendingUp = false;

    const opts = { passive: false };
    el.addEventListener('pointerdown', (e) => this._down(e), opts);
    el.addEventListener('pointermove', (e) => this._move(e), opts);
    el.addEventListener('pointerup', (e) => this._up(e), opts);
    el.addEventListener('pointercancel', (e) => this._up(e), opts);
    el.addEventListener('pointerleave', (e) => this._up(e), opts);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('touchmove', (e) => {
      if (e.target === el) e.preventDefault();
    }, { passive: false });
  }

  _set(e) {
    this.ndc.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
  }

  _down(e) {
    if (this.id !== null) return;
    this.id = e.pointerId;
    try { this.el.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    this._set(e);
    this.prevNdc.copy(this.ndc);
    this.down = true;
    this._pendingDown = true;
    this.heldFor = 0;
    e.preventDefault();
  }

  _move(e) {
    if (e.pointerId !== this.id) return;
    this._set(e);
    e.preventDefault();
  }

  _up(e) {
    if (e.pointerId !== this.id) return;
    this.id = null;
    this.down = false;
    this._pendingUp = true;
  }

  /** Call once per frame, before the game logic. */
  beginFrame(dt) {
    this.justDown = this._pendingDown;
    this.justUp = this._pendingUp;
    this._pendingDown = false;
    this._pendingUp = false;
    this.moved = this.ndc.distanceTo(this.prevNdc);
    this.prevNdc.copy(this.ndc);
    if (this.down) this.heldFor += dt; else this.heldFor = 0;
  }
}
