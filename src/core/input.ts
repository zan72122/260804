export interface Stroke {
  /** Where the finger first landed (CSS px). */
  sx: number;
  sy: number;
  /** Current finger position (CSS px). */
  x: number;
  y: number;
  /** Movement since the previous chunk. */
  dx: number;
  dy: number;
  len: number;
  /** Total path length travelled so far in this stroke. */
  total: number;
  /** Straight-line displacement from the touch-down point. */
  netX: number;
  netY: number;
}

export interface GestureHandlers {
  onDown?(x: number, y: number): void;
  /** Fired repeatedly: once per `chunkPx` of travel, plus once on release. */
  onChunk?(s: Stroke): void;
  onDrag?(x: number, y: number): void;
  onTap?(x: number, y: number): void;
  onUp?(s: Stroke): void;
}

const CHUNK_PX = 42;
const TAIL_PX = 13;
const TAP_PX = 16;
const TAP_MS = 420;

/**
 * One-finger gesture reader. It deliberately reports *chunks* of travel rather
 * than one swipe per touch: a child who scrubs their finger back and forth gets
 * a haul pulse for every stroke, and a plain tap still counts as a small one.
 */
export class Gestures {
  private el: HTMLElement;
  private h: GestureHandlers;
  private id: number | null = null;
  private sx = 0;
  private sy = 0;
  private lx = 0;
  private ly = 0;
  private cx = 0;
  private cy = 0;
  private total = 0;
  private t0 = 0;
  private emitted = false;

  constructor(el: HTMLElement, handlers: GestureHandlers) {
    this.el = el;
    this.h = handlers;
    el.addEventListener('pointerdown', this.down, { passive: false });
    el.addEventListener('pointermove', this.move, { passive: false });
    el.addEventListener('pointerup', this.up, { passive: false });
    el.addEventListener('pointercancel', this.up, { passive: false });
    // Belt and braces for older iOS: block gesture zoom / double-tap zoom.
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('touchmove', prevent, { passive: false });
    el.addEventListener('gesturestart', prevent as EventListener, { passive: false });
    el.addEventListener('dblclick', prevent, { passive: false });
  }

  private down = (e: PointerEvent): void => {
    if (this.id !== null) return; // strictly one finger
    this.id = e.pointerId;
    this.sx = this.lx = this.cx = e.clientX;
    this.sy = this.ly = this.cy = e.clientY;
    this.total = 0;
    this.emitted = false;
    this.t0 = performance.now();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
    e.preventDefault();
    this.h.onDown?.(this.sx, this.sy);
  };

  private move = (e: PointerEvent): void => {
    if (this.id !== e.pointerId) return;
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    this.total += Math.hypot(x - this.cx, y - this.cy);
    this.cx = x;
    this.cy = y;
    this.h.onDrag?.(x, y);

    const dx = x - this.lx;
    const dy = y - this.ly;
    const len = Math.hypot(dx, dy);
    if (len >= CHUNK_PX) {
      this.lx = x;
      this.ly = y;
      this.emitted = true;
      this.h.onChunk?.(this.stroke(x, y, dx, dy, len));
    }
  };

  private up = (e: PointerEvent): void => {
    if (this.id !== e.pointerId) return;
    this.id = null;
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;
    const dx = x - this.lx;
    const dy = y - this.ly;
    const len = Math.hypot(dx, dy);
    const s = this.stroke(x, y, dx, dy, len);

    if (len >= TAIL_PX) {
      this.emitted = true;
      this.h.onChunk?.(s);
    }
    const dt = performance.now() - this.t0;
    if (!this.emitted && this.total < TAP_PX && dt < TAP_MS) {
      this.h.onTap?.(x, y);
    }
    this.h.onUp?.(s);
  };

  private stroke(x: number, y: number, dx: number, dy: number, len: number): Stroke {
    return {
      sx: this.sx,
      sy: this.sy,
      x,
      y,
      dx,
      dy,
      len,
      total: this.total,
      netX: x - this.sx,
      netY: y - this.sy,
    };
  }
}

function prevent(e: Event): void {
  if ((e as TouchEvent).touches && (e as TouchEvent).touches.length > 1) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
}
