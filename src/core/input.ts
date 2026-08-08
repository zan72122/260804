/**
 * One-finger pointer input. Everything in the game is reachable with a single
 * finger — no pinch, no two-finger camera, no long-press.
 *
 * Also exposes `CircleTracker`, the shared implementation behind both
 * signature circular gestures (the microtome handwheel and the focus knob).
 */
import { TAU, angleDelta, clamp } from './util';

export interface PointerState {
  /** css pixels, origin top-left of the canvas */
  x: number; y: number;
  /** normalised device coords, -1..1, y up */
  nx: number; ny: number;
  /** movement since last frame, css px */
  dx: number; dy: number;
  down: boolean;
  /** true only on the frame the finger landed */
  justDown: boolean;
  /** true only on the frame the finger lifted */
  justUp: boolean;
  /** css px where the gesture began */
  startX: number; startY: number;
  /** seconds since the gesture began */
  age: number;
  /** total distance travelled this gesture, css px */
  travel: number;
}

export class Input {
  readonly p: PointerState = {
    x: 0, y: 0, nx: 0, ny: 0, dx: 0, dy: 0,
    down: false, justDown: false, justUp: false,
    startX: 0, startY: 0, age: 0, travel: 0,
  };
  /** seconds since the last time the player touched anything */
  idle = 0;
  private el: HTMLElement;
  private activeId: number | null = null;
  private pendingDown = false;
  private pendingUp = false;
  private lastX = 0;
  private lastY = 0;
  private onFirst?: () => void;
  private firstDone = false;

  constructor(el: HTMLElement, onFirstTouch?: () => void) {
    this.el = el;
    this.onFirst = onFirstTouch;
    const opts = { passive: false } as AddEventListenerOptions;
    el.addEventListener('pointerdown', this.down, opts);
    window.addEventListener('pointermove', this.move, opts);
    window.addEventListener('pointerup', this.up, opts);
    window.addEventListener('pointercancel', this.up, opts);
    // Belt and braces for iOS: kill double-tap zoom / rubber-banding.
    el.addEventListener('touchstart', (e) => e.preventDefault(), opts);
    el.addEventListener('touchmove', (e) => e.preventDefault(), opts);
    document.addEventListener('gesturestart', (e) => e.preventDefault(), opts as any);
  }

  private local(e: PointerEvent) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }

  private down = (e: PointerEvent) => {
    if (this.activeId !== null) return; // strictly one finger drives the game
    e.preventDefault();
    this.activeId = e.pointerId;
    const l = this.local(e);
    this.p.x = this.lastX = this.p.startX = l.x;
    this.p.y = this.lastY = this.p.startY = l.y;
    this.p.travel = 0;
    this.p.age = 0;
    this.pendingDown = true;
    this.idle = 0;
    if (!this.firstDone) { this.firstDone = true; this.onFirst?.(); }
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.activeId) return;
    e.preventDefault();
    const l = this.local(e);
    this.p.x = l.x;
    this.p.y = l.y;
    this.idle = 0;
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    this.pendingUp = true;
    this.idle = 0;
  };

  /** Called once per frame, before game logic. */
  update(dt: number, w: number, h: number) {
    const p = this.p;
    p.justDown = this.pendingDown;
    p.justUp = this.pendingUp;
    if (this.pendingDown) p.down = true;
    if (this.pendingUp) p.down = false;
    this.pendingDown = false;
    this.pendingUp = false;

    p.dx = p.x - this.lastX;
    p.dy = p.y - this.lastY;
    this.lastX = p.x;
    this.lastY = p.y;
    if (p.down) {
      p.age += dt;
      p.travel += Math.hypot(p.dx, p.dy);
    }
    p.nx = (p.x / Math.max(1, w)) * 2 - 1;
    p.ny = -((p.y / Math.max(1, h)) * 2 - 1);
    if (!p.down && Math.abs(p.dx) < 0.01 && Math.abs(p.dy) < 0.01) this.idle += dt;
  }

  /** Forget any in-flight gesture (used when the app returns from background). */
  reset() {
    this.activeId = null;
    this.p.down = false;
    this.p.dx = this.p.dy = 0;
    this.pendingDown = this.pendingUp = false;
  }
}

/**
 * Turns a finger dragging around a screen-space centre into continuous,
 * unwrapped rotation. Used by both クルッ and クルクル.
 *
 * Design notes that matter for feel:
 *  - The finger does not have to start on the widget's exact centre distance;
 *    anything outside a small dead zone counts.
 *  - Rotation is unwrapped, so the wheel keeps turning past ±180°.
 *  - Releasing mid-circle leaves smooth inertia instead of a hard stop.
 *  - Reversing is always allowed and never punished.
 */
export class CircleTracker {
  /** accumulated angle in radians, signed, unbounded */
  angle = 0;
  /** rad/sec, smoothed — includes inertia after release */
  velocity = 0;
  /** true while the finger is driving it */
  active = false;
  /** rotation contributed this frame */
  delta = 0;
  private prevAngle = 0;
  private hasPrev = false;
  private friction: number;
  private deadzone: number;

  constructor(opts: { friction?: number; deadzone?: number } = {}) {
    this.friction = opts.friction ?? 2.4;
    this.deadzone = opts.deadzone ?? 16;
  }

  /**
   * @param engaged whether the finger is currently allowed to drive this wheel
   * @param cx,cy   widget centre in the same css-pixel space as px,py
   */
  update(dt: number, engaged: boolean, px: number, py: number, cx: number, cy: number) {
    this.delta = 0;
    const r = Math.hypot(px - cx, py - cy);
    if (engaged && r > this.deadzone) {
      const a = Math.atan2(py - cy, px - cx);
      if (this.hasPrev) {
        const d = angleDelta(this.prevAngle, a);
        // ignore absurd jumps (finger teleporting across the centre)
        if (Math.abs(d) < 1.4) {
          this.delta = d;
          this.angle += d;
          if (dt > 0) this.velocity = this.velocity * 0.55 + (d / dt) * 0.45;
        }
      }
      this.prevAngle = a;
      this.hasPrev = true;
      this.active = true;
    } else {
      this.hasPrev = false;
      this.active = false;
      // coast
      const damping = Math.exp(-this.friction * dt);
      this.velocity *= damping;
      if (Math.abs(this.velocity) < 0.02) this.velocity = 0;
      const d = this.velocity * dt;
      this.delta = d;
      this.angle += d;
    }
    // sane speed ceiling so a frantic finger cannot break the simulation
    this.velocity = clamp(this.velocity, -14, 14);
    return this.delta;
  }

  /** revolutions per second (unsigned) */
  get revsPerSec() { return Math.abs(this.velocity) / TAU; }

  reset() {
    this.angle = 0; this.velocity = 0; this.hasPrev = false;
    this.active = false; this.delta = 0;
  }
}
