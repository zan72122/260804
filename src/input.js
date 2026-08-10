/**
 * Touch / pointer aiming.
 *
 * The finger is projected onto the plane the prize sits on, so dragging moves
 * the claw exactly as far as the finger moves across that surface — one to one,
 * in both X and depth, with no camera control to learn. The projection point is
 * lifted a little above the fingertip so a small hand never hides the target.
 */

import * as THREE from '../vendor/three/three.module.min.js';
import { BAR, CRANE } from './config.js';

/**
 * The aim point sits a little above the fingertip so a small hand never covers
 * the target. It is a constant offset with continuous on-screen feedback (the
 * glowing ring), so it reads as "the crane follows my finger", not as an error.
 */
const fingerLift = (h) => Math.max(14, Math.min(30, h * 0.036));

export class Input {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BAR.topY);
    this.ndc = new THREE.Vector2();
    this.hit = new THREE.Vector3();
    this.target = { x: 0, z: -0.02 };
    this.active = false;
    this.pointerId = null;
    this.moved = false;
    this.onFirstTouch = null;

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this._down(e), opts);
    canvas.addEventListener('pointermove', (e) => this._move(e), opts);
    canvas.addEventListener('pointerup', (e) => this._up(e), opts);
    canvas.addEventListener('pointercancel', (e) => this._up(e), opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // stop iOS Safari from scrolling / rubber-banding behind the canvas
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), opts);
    canvas.addEventListener('gesturestart', (e) => e.preventDefault(), opts);
  }

  _project(e) {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top - fingerLift(r.height);
    this.ndc.set((px / r.width) * 2 - 1, -(py / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.hit)) return false;
    this.target.x = THREE.MathUtils.clamp(this.hit.x, CRANE.minX, CRANE.maxX);
    this.target.z = THREE.MathUtils.clamp(this.hit.z, CRANE.minZ, CRANE.maxZ);
    return true;
  }

  _down(e) {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.canvas.setPointerCapture?.(e.pointerId);
    this.active = true;
    this.moved = false;
    this.onFirstTouch?.();
    this._project(e);
  }

  _move(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.moved = true;
    this._project(e);
  }

  _up(e) {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.canvas.releasePointerCapture?.(e.pointerId);
    this.pointerId = null;
    this.active = false;
  }
}
