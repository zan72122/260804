// ============================================================================
// CameraController — ワールド中心座標系{x,y,zoom}。focus追従・shake・fitRect。
// ============================================================================
import type { Camera, Layout } from './types';
import { bus } from './events';

const DEFAULT_LERP = 0.08;

interface Shake {
  power: number;
  t: number;
}

export class CameraController {
  camera: Camera = { x: 0, y: 0, zoom: 1 };

  private targetX = 0;
  private targetY = 0;
  private targetZoom = 1;
  private lerpRate = DEFAULT_LERP;
  private hasTarget = false;

  private shakes: Shake[] = [];
  private shakeX = 0;
  private shakeY = 0;

  constructor() {
    bus.on('camera:focus', (p) => {
      this.focus(p.x, p.y, p.zoom ?? this.targetZoom, p.lerp);
    });
    bus.on('camera:shake', (p) => {
      this.shakes.push({ power: p.power, t: 0 });
    });
  }

  focus(x: number, y: number, zoom: number, lerp?: number): void {
    this.targetX = x;
    this.targetY = y;
    this.targetZoom = zoom;
    this.lerpRate = lerp ?? DEFAULT_LERP;
    this.hasTarget = true;
  }

  snap(x: number, y: number, zoom: number): void {
    this.camera.x = x;
    this.camera.y = y;
    this.camera.zoom = zoom;
    this.targetX = x;
    this.targetY = y;
    this.targetZoom = zoom;
    this.hasTarget = true;
  }

  update(dt: number): void {
    if (this.hasTarget) {
      // フレームレート非依存の指数減衰追従
      const k = 1 - Math.exp(-this.lerpRate * 60 * dt);
      this.camera.x += (this.targetX - this.camera.x) * k;
      this.camera.y += (this.targetY - this.camera.y) * k;
      this.camera.zoom += (this.targetZoom - this.camera.zoom) * k;
    }

    // シェイク減衰（複数重ね合わせ可）
    this.shakeX = 0;
    this.shakeY = 0;
    if (this.shakes.length > 0) {
      const remain: Shake[] = [];
      for (const s of this.shakes) {
        s.t += dt;
        const life = 0.5; // 秒
        const decay = Math.max(0, 1 - s.t / life);
        if (decay > 0) {
          const amp = s.power * decay;
          const freq = 40;
          this.shakeX += Math.sin(s.t * freq) * amp;
          this.shakeY += Math.cos(s.t * freq * 1.3) * amp;
          remain.push(s);
        }
      }
      this.shakes = remain;
    }
  }

  applyTransform(ctx: CanvasRenderingContext2D, layout: Layout): void {
    const { dpr } = layout;
    const zoom = this.camera.zoom;
    const cx = this.camera.x - this.shakeX;
    const cy = this.camera.y - this.shakeY;
    ctx.setTransform(
      dpr * zoom, 0, 0, dpr * zoom,
      dpr * (layout.w / 2 - cx * zoom),
      dpr * (layout.h / 2 - cy * zoom),
    );
  }

  screenToWorld(sx: number, sy: number, layout: Layout): { x: number; y: number } {
    const zoom = this.camera.zoom;
    const cx = this.camera.x - this.shakeX;
    const cy = this.camera.y - this.shakeY;
    return {
      x: (sx - layout.w / 2) / zoom + cx,
      y: (sy - layout.h / 2) / zoom + cy,
    };
  }

  /** ワールド矩形が収まるようfocusを計算するヘルパ */
  fitRect(
    x: number, y: number, w: number, h: number, layout: Layout, margin = 40,
  ): { x: number; y: number; zoom: number } {
    const safe = layout.safe;
    const availW = Math.max(1, layout.w - safe.left - safe.right - margin * 2);
    const availH = Math.max(1, layout.h - safe.top - safe.bottom - margin * 2);
    const zoom = Math.max(0.001, Math.min(availW / Math.max(1, w), availH / Math.max(1, h)));
    // safe areaの左右/上下差分を中心に反映(canvas中心とsafe areaの中心のずれを補正)
    const offX = (safe.left - safe.right) / 2 / zoom;
    const offY = (safe.top - safe.bottom) / 2 / zoom;
    return { x: x + w / 2 - offX, y: y + h / 2 - offY, zoom };
  }
}
