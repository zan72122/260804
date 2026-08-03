import { Game } from './game';

/**
 * Single-pointer input: the first finger wins, extra fingers are ignored
 * (no multi-touch is ever required). Coordinates are canvas-relative CSS px,
 * recomputed from the element rect on every event, so rotation never leaves
 * stale mappings.
 */
export class InputManager {
  private activePointer: number | null = null;
  private readonly el: HTMLElement;
  private readonly game: Game;
  private readonly onFirstGesture: () => void;

  constructor(el: HTMLElement, game: Game, onFirstGesture: () => void) {
    this.el = el;
    this.game = game;
    this.onFirstGesture = onFirstGesture;
    el.addEventListener('pointerdown', this.down, { passive: false });
    el.addEventListener('pointermove', this.move, { passive: false });
    el.addEventListener('pointerup', this.up, { passive: false });
    el.addEventListener('pointercancel', this.cancel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private coords(e: PointerEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down = (e: PointerEvent): void => {
    e.preventDefault();
    this.onFirstGesture();
    if (this.activePointer !== null) return; // second finger: ignored safely
    this.activePointer = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    const { x, y } = this.coords(e);
    if (x < -30 || y < -30 || x > this.el.clientWidth + 30 || y > this.el.clientHeight + 30) return;
    this.game.pointerDown(x, y);
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointer) return;
    e.preventDefault();
    const { x, y } = this.coords(e);
    this.game.pointerMove(x, y);
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointer) return;
    e.preventDefault();
    this.activePointer = null;
    const { x, y } = this.coords(e);
    this.game.pointerUp(x, y);
  };

  private cancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    this.game.cancelPointer();
  };

  /** Rotation / resize: drop the in-flight gesture so nothing sticks. */
  reset(): void {
    this.activePointer = null;
    this.game.cancelPointer();
  }
}
