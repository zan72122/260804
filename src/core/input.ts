/**
 * One-finger pointer layer.
 *
 * We deliberately track a *single* pointer: a four-year-old rests a palm on
 * the glass, and extra contacts must never steal control. The first pointer
 * down owns the gesture until it lifts. Multi-touch, pinch and rotate are
 * never required by any scene.
 */

import * as THREE from 'three';

export interface Pointer {
  /** Normalised device coords, -1..1. */
  ndc: THREE.Vector2;
  /** CSS pixels. */
  screen: THREE.Vector2;
  /** CSS pixels moved since the previous frame sample. */
  delta: THREE.Vector2;
  down: boolean;
  /** Rose this frame. */
  justDown: boolean;
  /** Released this frame. */
  justUp: boolean;
  /** Screen position where the gesture began. */
  start: THREE.Vector2;
  /** Seconds the current gesture has been held. */
  heldFor: number;
  /** ms timestamp of the last input of any kind — drives the idle hints. */
  lastActivity: number;
}

export class InputManager {
  readonly pointer: Pointer = {
    ndc: new THREE.Vector2(),
    screen: new THREE.Vector2(),
    delta: new THREE.Vector2(),
    down: false,
    justDown: false,
    justUp: false,
    start: new THREE.Vector2(),
    heldFor: 0,
    lastActivity: performance.now(),
  };

  private activeId: number | null = null;
  private pendingDown = false;
  private pendingUp = false;
  private prev = new THREE.Vector2();
  private accum = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();

  constructor(private readonly el: HTMLElement) {
    const opts = { passive: false } as AddEventListenerOptions;
    el.addEventListener('pointerdown', this.onDown, opts);
    el.addEventListener('pointermove', this.onMove, opts);
    window.addEventListener('pointerup', this.onUp, opts);
    window.addEventListener('pointercancel', this.onUp, opts);
    // Safari still fires these for double-tap zoom / rubber-banding.
    el.addEventListener('touchstart', this.block, opts);
    el.addEventListener('touchmove', this.block, opts);
    el.addEventListener('gesturestart', this.block as EventListener, opts);
  }

  private block = (e: Event): void => {
    e.preventDefault();
  };

  private setFrom(e: PointerEvent): void {
    const r = this.el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    this.pointer.screen.set(x, y);
    this.pointer.ndc.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1);
    this.pointer.lastActivity = performance.now();
  }

  private onDown = (e: PointerEvent): void => {
    if (this.activeId !== null) return; // ignore palm / second finger
    this.activeId = e.pointerId;
    this.setFrom(e);
    this.prev.copy(this.pointer.screen);
    this.pointer.start.copy(this.pointer.screen);
    this.pointer.heldFor = 0;
    this.pendingDown = true;
    e.preventDefault();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable — plain window listeners still work */
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (this.activeId !== null && e.pointerId !== this.activeId) return;
    this.setFrom(e);
    if (this.activeId !== null) {
      this.accum.add(this.pointer.screen.clone().sub(this.prev));
      this.prev.copy(this.pointer.screen);
    }
    e.preventDefault();
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    this.pendingUp = true;
    this.pointer.lastActivity = performance.now();
  };

  /** Call once per frame *before* scene updates. */
  beginFrame(dt: number): void {
    const p = this.pointer;
    p.justDown = this.pendingDown;
    p.justUp = this.pendingUp;
    if (this.pendingDown) p.down = true;
    if (this.pendingUp) p.down = false;
    this.pendingDown = false;
    this.pendingUp = false;
    p.delta.copy(this.accum);
    this.accum.set(0, 0);
    p.heldFor = p.down ? p.heldFor + dt : 0;
  }

  /** Forget any in-flight gesture (used on scene change and on resume). */
  reset(): void {
    this.activeId = null;
    this.pendingDown = false;
    this.pendingUp = this.pointer.down;
    this.accum.set(0, 0);
  }

  /**
   * Where the pointer meets a horizontal plane at height `y`.
   * Returns null when the ray is parallel or points at the sky.
   */
  worldOnPlane(camera: THREE.Camera, y: number, out = new THREE.Vector3()): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointer.ndc, camera);
    const { origin, direction } = this.raycaster.ray;
    if (Math.abs(direction.y) < 1e-5) return null;
    const t = (y - origin.y) / direction.y;
    if (t < 0) return null;
    return out.copy(origin).addScaledVector(direction, t);
  }

  /** Project a world point to CSS pixels (for placing DOM hints). */
  static project(v: THREE.Vector3, camera: THREE.Camera, w: number, h: number): THREE.Vector2 {
    const p = v.clone().project(camera);
    return new THREE.Vector2(((p.x + 1) / 2) * w, ((-p.y + 1) / 2) * h);
  }
}
