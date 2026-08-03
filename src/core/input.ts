// ============================================================================
// InputSystem — Pointer Events で単一ポインタ追跡。UI優先→ワールドhit判定→寛容判定。
// ============================================================================
import type { Interactable, PointerInfo, SceneId } from './types';
import type { CameraController } from './camera';
import type { LayoutManager } from './layout';

const GRAB_RADIUS = 90; // ワールド単位: 寛容判定の探索半径
const GRID_N = 5;       // 5x5グリッドサンプリング

export class InputSystem {
  private canvas: HTMLCanvasElement;
  private cam: CameraController;
  private lm: LayoutManager;
  private getScene: () => SceneId;

  private items: Interactable[] = [];
  private allowed: Set<string> | 'all' = 'all';

  private pointerId: number | null = null;
  private grabbed: Interactable | null = null;
  private downX = 0;
  private downY = 0;
  private lastWX = 0;
  private lastWY = 0;
  private downTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    cam: CameraController,
    lm: LayoutManager,
    getScene: () => SceneId,
  ) {
    this.canvas = canvas;
    this.cam = cam;
    this.lm = lm;
    this.getScene = getScene;

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    canvas.addEventListener('pointermove', this.onMove, { passive: false });
    canvas.addEventListener('pointerup', this.onUp, { passive: false });
    canvas.addEventListener('pointercancel', this.onCancel, { passive: false });
    canvas.addEventListener('pointerleave', this.onCancel, { passive: false });
    // ダブルタップズーム/スクロール抑止の保険
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  register(i: Interactable): () => void {
    this.items.push(i);
    return () => {
      const idx = this.items.indexOf(i);
      if (idx >= 0) this.items.splice(idx, 1);
    };
  }

  setAllowed(ids: string[] | 'all'): void {
    this.allowed = ids === 'all' ? 'all' : new Set(ids);
  }

  private isAllowed(id: string): boolean {
    return this.allowed === 'all' || this.allowed.has(id);
  }

  private screenXY(e: PointerEvent): { sx: number; sy: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  private candidates(scene: SceneId | 'ui'): Interactable[] {
    const list = this.items.filter(
      (i) => i.scene === scene && i.enabled() && this.isAllowed(i.id),
    );
    list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return list;
  }

  private pickTarget(sx: number, sy: number, wx: number, wy: number): Interactable | null {
    // 1. ui: 画面座標で最優先判定
    for (const it of this.candidates('ui')) {
      if (it.hit(sx, sy)) return it;
    }

    // 2. 現在シーン: ワールド座標で判定
    const scene = this.getScene();
    const sceneItems = this.candidates(scene);
    for (const it of sceneItems) {
      if (it.hit(wx, wy)) return it;
    }

    // 3. 寛容判定: 90ワールド単位以内を5x5グリッドで粗くサンプリング
    let best: Interactable | null = null;
    let bestDist = Infinity;
    let bestPriority = -Infinity;
    for (const it of sceneItems) {
      let minDist = Infinity;
      for (let gx = 0; gx < GRID_N; gx++) {
        for (let gy = 0; gy < GRID_N; gy++) {
          const px = wx - GRAB_RADIUS + (gx * (2 * GRAB_RADIUS)) / (GRID_N - 1);
          const py = wy - GRAB_RADIUS + (gy * (2 * GRAB_RADIUS)) / (GRID_N - 1);
          if (it.hit(px, py)) {
            const d = Math.hypot(px - wx, py - wy);
            if (d < minDist) minDist = d;
          }
        }
      }
      if (minDist < Infinity) {
        const pr = it.priority ?? 0;
        if (minDist < bestDist || (minDist === bestDist && pr > bestPriority)) {
          best = it;
          bestDist = minDist;
          bestPriority = pr;
        }
      }
    }
    return best;
  }

  private makeInfo(sx: number, sy: number, wx: number, wy: number, now: number): PointerInfo {
    const dx = wx - this.lastWX;
    const dy = wy - this.lastWY;
    return {
      x: wx, y: wy, sx, sy,
      dx, dy,
      downX: this.downX, downY: this.downY,
      heldTime: (now - this.downTime) / 1000,
    };
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return; // 2本目以降は無視
    e.preventDefault();
    this.pointerId = e.pointerId;

    const { sx, sy } = this.screenXY(e);
    const { x: wx, y: wy } = this.cam.screenToWorld(sx, sy, this.lm.layout);

    this.downX = wx;
    this.downY = wy;
    this.lastWX = wx;
    this.lastWY = wy;
    this.downTime = performance.now();

    this.grabbed = this.pickTarget(sx, sy, wx, wy);
    if (this.grabbed?.onDown) {
      this.grabbed.onDown(this.makeInfo(sx, sy, wx, wy, this.downTime));
    }
    this.lastWX = wx;
    this.lastWY = wy;
  };

  private onMove = (e: PointerEvent): void => {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const { sx, sy } = this.screenXY(e);
    const { x: wx, y: wy } = this.cam.screenToWorld(sx, sy, this.lm.layout);
    const now = performance.now();
    if (this.grabbed?.onMove) {
      this.grabbed.onMove(this.makeInfo(sx, sy, wx, wy, now));
    }
    this.lastWX = wx;
    this.lastWY = wy;
  };

  private endPointer = (e: PointerEvent): void => {
    if (this.pointerId === null || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const { sx, sy } = this.screenXY(e);
    const { x: wx, y: wy } = this.cam.screenToWorld(sx, sy, this.lm.layout);
    const now = performance.now();
    if (this.grabbed?.onUp) {
      this.grabbed.onUp(this.makeInfo(sx, sy, wx, wy, now));
    }
    this.pointerId = null;
    this.grabbed = null;
  };

  private onUp = (e: PointerEvent): void => this.endPointer(e);
  private onCancel = (e: PointerEvent): void => this.endPointer(e);
}
