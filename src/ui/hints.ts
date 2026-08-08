import { Vector3 } from 'three';
import { Stage } from '../core/stage';
import { clamp01, TAU } from '../core/util';

export interface HintSpec {
  /** World point the gesture starts from. */
  anchor: Vector3;
  /** Screen-space direction to swipe, normalised-ish. */
  dx: number;
  dy: number;
  /** Trail length in CSS px. */
  len?: number;
  hue?: 'ember' | 'water' | 'pale';
}

const HUES = {
  ember: [255, 170, 80],
  water: [150, 205, 255],
  pale: [255, 240, 220],
} as const;

/**
 * Wordless coaching. If a child hesitates, a soft trail of dots shows which
 * way to move a finger, starting from the thing that wants moving. There is no
 * text, no timer, and no penalty for ignoring it.
 */
export class Hints {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spec: HintSpec | null = null;
  private strength = 0;
  private phase = 0;
  private p = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  show(spec: HintSpec): void {
    this.spec = spec;
  }

  hide(): void {
    this.spec = null;
  }

  resize(w: number, h: number, dpr: number): void {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  update(dt: number, stage: Stage): void {
    this.phase += dt;
    const want = this.spec ? 1 : 0;
    this.strength += (want - this.strength) * Math.min(1, dt * 3.2);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, stage.width, stage.height);
    if (this.strength < 0.01 || !this.spec) return;

    const s = this.spec;
    if (!stage.project(s.anchor, this.p)) return;

    const hue = HUES[s.hue ?? 'pale'];
    const rgb = `${hue[0]}, ${hue[1]}, ${hue[2]}`;
    const short = Math.min(stage.width, stage.height);
    const len = s.len ?? short * 0.19;
    const mag = Math.hypot(s.dx, s.dy) || 1;
    const ux = s.dx / mag;
    const uy = s.dy / mag;

    // Pulsing ring on the thing that wants a finger.
    const ring = 0.5 + 0.5 * Math.sin(this.phase * 2.6);
    ctx.save();
    ctx.globalAlpha = this.strength * (0.16 + ring * 0.2);
    ctx.strokeStyle = `rgba(${rgb}, 1)`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(this.p.x, this.p.y, short * (0.036 + ring * 0.018), 0, TAU);
    ctx.stroke();
    ctx.restore();

    // Travelling dots along the gesture path.
    const N = 7;
    for (let i = 0; i < N; i++) {
      const base = i / (N - 1);
      const t = (base + this.phase * 0.42) % 1;
      const eased = t * t * (3 - 2 * t);
      const x = this.p.x + ux * len * eased;
      const y = this.p.y + uy * len * eased;
      const fade = Math.sin(t * Math.PI);
      const r = short * (0.008 + 0.014 * eased);
      ctx.save();
      ctx.globalAlpha = clamp01(this.strength * fade * 0.85);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
      g.addColorStop(0, `rgba(${rgb}, 0.95)`);
      g.addColorStop(0.4, `rgba(${rgb}, 0.35)`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // A soft fingertip riding the trail.
    const ft = (this.phase * 0.42) % 1;
    const fe = ft * ft * (3 - 2 * ft);
    const fx = this.p.x + ux * len * fe;
    const fy = this.p.y + uy * len * fe;
    ctx.save();
    ctx.globalAlpha = this.strength * 0.5 * Math.sin(ft * Math.PI);
    ctx.fillStyle = `rgba(${rgb}, 0.5)`;
    ctx.beginPath();
    ctx.arc(fx, fy, short * 0.032, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
