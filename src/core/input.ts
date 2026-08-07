import * as THREE from 'three';
import { clamp } from './util';

export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

type Cb = (p: Input) => void;

/**
 * One-finger input only, exactly as the design brief requires: tap, swipe,
 * long-press and "trace a fat path". Extra touches are ignored rather than
 * cancelling the gesture, so a toddler resting a second finger on the glass
 * never breaks the interaction.
 */
export class Input {
  el: HTMLElement;
  active = false;
  /** id of the touch we are tracking; extra fingers are ignored */
  private pid: number | null = null;

  x = 0;
  y = 0;
  downX = 0;
  downY = 0;
  dx = 0;
  dy = 0;
  /** smoothed velocity in css px / second */
  vx = 0;
  vy = 0;
  downAt = 0;
  travel = 0;
  /** seconds the finger has been down (0 when up) */
  holdTime = 0;

  ndc = new THREE.Vector2();
  downNdc = new THREE.Vector2();

  private samples: PointerSample[] = [];
  private frameDx = 0;
  private frameDy = 0;
  private tapPending = false;
  private tapLatch = false;

  onDown: Cb | null = null;
  onMove: Cb | null = null;
  onUp: Cb | null = null;
  onTap: Cb | null = null;

  private w = 1;
  private h = 1;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener('pointerdown', this.handleDown, { passive: false });
    window.addEventListener('pointermove', this.handleMove, { passive: false });
    window.addEventListener('pointerup', this.handleUp, { passive: false });
    window.addEventListener('pointercancel', this.handleUp, { passive: false });
    // Belt & braces for iOS Safari: kill scroll / pinch / double-tap zoom.
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    // Safari-only pinch-zoom gesture events; harmless no-ops elsewhere.
    for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(name, (e: Event) => e.preventDefault(), { passive: false });
    }
    this.resize();
  }

  resize() {
    const r = this.el.getBoundingClientRect();
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
  }

  private toNdc(x: number, y: number, out: THREE.Vector2) {
    const r = this.el.getBoundingClientRect();
    out.set(((x - r.left) / (r.width || 1)) * 2 - 1, -(((y - r.top) / (r.height || 1)) * 2 - 1));
    return out;
  }

  private handleDown = (e: PointerEvent) => {
    if (this.active) return; // ignore additional fingers
    // Let DOM buttons in the UI overlay handle their own taps.
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-ui-button]')) return;
    e.preventDefault();
    this.pid = e.pointerId;
    this.active = true;
    this.x = this.downX = e.clientX;
    this.y = this.downY = e.clientY;
    this.dx = this.dy = 0;
    this.frameDx = this.frameDy = 0;
    this.vx = this.vy = 0;
    this.travel = 0;
    this.holdTime = 0;
    this.downAt = performance.now();
    this.samples.length = 0;
    this.samples.push({ x: this.x, y: this.y, t: this.downAt });
    this.toNdc(this.x, this.y, this.ndc);
    this.downNdc.copy(this.ndc);
    this.onDown?.(this);
  };

  private handleMove = (e: PointerEvent) => {
    if (!this.active || e.pointerId !== this.pid) return;
    e.preventDefault();
    const nx = e.clientX;
    const ny = e.clientY;
    const d = Math.hypot(nx - this.x, ny - this.y);
    this.frameDx += nx - this.x;
    this.frameDy += ny - this.y;
    this.travel += d;
    this.x = nx;
    this.y = ny;
    this.toNdc(nx, ny, this.ndc);
    this.samples.push({ x: nx, y: ny, t: performance.now() });
    if (this.samples.length > 24) this.samples.shift();
    this.onMove?.(this);
  };

  private handleUp = (e: PointerEvent) => {
    if (!this.active || e.pointerId !== this.pid) return;
    e.preventDefault();
    const dur = (performance.now() - this.downAt) / 1000;
    const isTap = this.travel < 22 && dur < 0.6;
    this.onUp?.(this);
    if (isTap) {
      this.tapLatch = true;
      this.onTap?.(this);
    }
    this.active = false;
    this.pid = null;
    this.holdTime = 0;
    // Deliberately NOT clearing frameDx/frameDy: a whole gesture can begin and
    // end between two frames if the device hitches, and throwing that movement
    // away means the child's swipe simply did nothing.
  };

  /** True once for a tap that has not been read yet. */
  consumeTap() {
    const t = this.tapPending;
    this.tapPending = false;
    return t;
  }

  /** Did the finger move at all in the frame just gone? */
  get moved() {
    return this.dx !== 0 || this.dy !== 0;
  }

  /** Call once per frame, before systems read dx/dy/velocity. */
  update(dt: number) {
    this.dx = this.frameDx;
    this.dy = this.frameDy;
    this.frameDx = 0;
    this.frameDy = 0;
    // a tap is visible for exactly the frame after it happened
    this.tapPending = this.tapLatch;
    this.tapLatch = false;
    if (this.active) this.holdTime += dt;
    const inst = dt > 0 ? this.dx / dt : 0;
    const insty = dt > 0 ? this.dy / dt : 0;
    const k = 1 - Math.exp(-14 * dt);
    this.vx += (inst - this.vx) * k;
    this.vy += (insty - this.vy) * k;
    if (!this.active) {
      this.vx *= Math.exp(-6 * dt);
      this.vy *= Math.exp(-6 * dt);
    }
  }

  /** Screen-space drag distance normalised by the shorter screen edge. */
  normalisedDelta() {
    const s = Math.min(this.w, this.h) || 1;
    return { x: this.dx / s, y: this.dy / s };
  }

  /** How far the finger travelled this frame in "screen units" (0..1-ish). */
  frameTravel() {
    const s = Math.min(this.w, this.h) || 1;
    return Math.hypot(this.dx, this.dy) / s;
  }

  isHeld(seconds = 0.18) {
    return this.active && this.holdTime >= seconds;
  }

  /** Signed drag component along a screen direction, normalised. */
  along(dirX: number, dirY: number) {
    const s = Math.min(this.w, this.h) || 1;
    const len = Math.hypot(dirX, dirY) || 1;
    return (this.dx * dirX + this.dy * dirY) / len / s;
  }

  speedNorm() {
    const s = Math.min(this.w, this.h) || 1;
    return clamp(Math.hypot(this.vx, this.vy) / s, 0, 6);
  }
}
