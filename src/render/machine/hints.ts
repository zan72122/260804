// ============================================================================
// 演出ヒント: spotlight(誘導光) / robot / gesture(手アイコン+矢印) / celebrate。
// ============================================================================
import type { RenderHints } from '../../core/types';
import { drawRobot, drawStars } from '../sprites';
import type { Accent } from './decoration';
import { clamp } from './util';

export function drawSpotlight(ctx: CanvasRenderingContext2D, hints: RenderHints, time: number, accent: Accent): void {
  const s = hints.spotlight;
  if (!s) return;
  const pulse = 0.75 + 0.25 * Math.sin(time * 3);
  ctx.save();
  ctx.globalAlpha = clamp(s.strength, 0, 1) * pulse;
  const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, accent.glowStrong);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  ctx.fill();

  // 呼吸するリング
  ctx.globalAlpha = clamp(s.strength, 0, 1) * (0.5 + 0.5 * Math.sin(time * 3));
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r * (0.55 + 0.1 * Math.sin(time * 2)), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawHintRobot(ctx: CanvasRenderingContext2D, hints: RenderHints, time: number): void {
  const r = hints.robot;
  if (!r.visible) return;
  drawRobot(ctx, r.x, r.y, 1, r.pose, time, r.lookX, r.lookY);
}

/** ふんわりした「手」アイコン(絵文字なし、丸みのミトン型) */
function drawHandIcon(ctx: CanvasRenderingContext2D, scale: number): void {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255, 235, 210, 0.92)';
  ctx.strokeStyle = 'rgba(120, 90, 60, 0.5)';
  ctx.lineWidth = 2;
  // 手のひら
  ctx.beginPath();
  ctx.ellipse(0, 6, 20, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 親指
  ctx.beginPath();
  ctx.ellipse(-20, -2, 9, 14, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // 指(まとめて2本の丸みシルエット)
  ctx.beginPath();
  ctx.ellipse(6, -20, 8, 15, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-6, -21, 8, 15, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, len: number, accent: Accent): void {
  ctx.save();
  ctx.strokeStyle = accent.a;
  ctx.fillStyle = accent.a;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.lineTo(len / 2, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(len / 2 + 14, 0);
  ctx.lineTo(len / 2 - 10, -12);
  ctx.lineTo(len / 2 - 10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawGesture(ctx: CanvasRenderingContext2D, hints: RenderHints, time: number, accent: Accent): void {
  const g = hints.gesture;
  if (!g) return;
  const cycle = (time * 1.1) % 1;

  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.dir);

  if (g.kind === 'swipe' || g.kind === 'drag') {
    const travel = 70;
    const off = (Math.sin(cycle * Math.PI * 2) * 0.5 + 0.5) * travel - travel / 2;
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawArrow(ctx, 110, accent);
    ctx.restore();
    ctx.save();
    ctx.translate(off, 0);
    ctx.globalAlpha = 0.95;
    drawHandIcon(ctx, 1.1);
    ctx.restore();
  } else if (g.kind === 'circle') {
    const a = cycle * Math.PI * 2;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = accent.a;
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 1.6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.save();
    ctx.translate(Math.cos(a) * 46, Math.sin(a) * 46);
    drawHandIcon(ctx, 0.9);
    ctx.restore();
  } else {
    // tap: 波紋 + 手が上下にトントン
    const bob = Math.abs(Math.sin(cycle * Math.PI * 2)) * 18;
    ctx.save();
    ctx.globalAlpha = 1 - bob / 18 * 0.6;
    ctx.strokeStyle = accent.a;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 24 + bob * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(0, -bob);
    drawHandIcon(ctx, 1);
    ctx.restore();
  }

  ctx.restore();
}

export function drawCelebrate(ctx: CanvasRenderingContext2D, hints: RenderHints, time: number, cx: number, cy: number): void {
  const power = clamp(hints.celebrate, 0, 1);
  if (power <= 0) return;
  const spots: Array<[number, number]> = [
    [cx, cy], [cx - 220, cy - 120], [cx + 220, cy - 100], [cx - 120, cy + 140], [cx + 150, cy + 160],
  ];
  for (let i = 0; i < spots.length; i++) {
    const [sx, sy] = spots[i];
    drawStars(ctx, sx, sy, power, time + i * 0.6);
  }
}
