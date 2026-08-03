// ============================================================================
// レーンシーンの演出まわり — スイープバー・スポットライト・ジェスチャー誘導・
// お祝い演出・ロボット配置。すべて MachineState / RenderHints を読むだけ。
// ============================================================================
import type { MachineState, RenderHints } from '../../core/types';
import { LANE_VIEW } from '../../core/geometry';
import { drawRobot, drawStars } from '../sprites';
import { boardsHalfWidthAt, clamp01, lerp, perspScale } from './util';

// ── スイープバー ────────────────────────────────────────────────────────
// state.sweep は機械座標(SWEEP)を基準にした概念だが、レーン正面ビューには
// 対応する座標が無いため、pos(0..1)をレーン奥(ピンデッキ付近)の左右移動として
// 描画する(「奥へ降りて倒れたピンを掃く」演出のための解釈)。
export function drawSweepBar(ctx: CanvasRenderingContext2D, state: MachineState, time: number): void {
  const { phase, pos } = state.sweep;
  if (phase === 'idle') return;

  const sweepY = LANE_VIEW.deckY - 26;
  const half = boardsHalfWidthAt(sweepY);
  const t = clamp01(pos);
  const x = LANE_VIEW.centerX + lerp(-half * 0.95, half * 0.95, phase === 'returning' ? 1 - t : t);
  const lowered = phase === 'sweeping' || phase === 'returning' ? 1 : 0;
  const dropY = lerp(-60, 0, lowered) + Math.sin(time * 9) * 1.5 * lowered;

  ctx.save();
  ctx.translate(0, dropY);
  const barW = half * 1.9;
  const barH = 16;
  ctx.beginPath();
  ctx.roundRect(LANE_VIEW.centerX - barW / 2, sweepY - barH / 2, barW, barH, 8);
  const g = ctx.createLinearGradient(0, sweepY - barH / 2, 0, sweepY + barH / 2);
  g.addColorStop(0, '#f4d968');
  g.addColorStop(0.5, '#e0b53a');
  g.addColorStop(1, '#b98a1f');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(70,50,10,0.5)';
  ctx.stroke();

  // 端の支柱(移動位置の目印)
  ctx.beginPath();
  ctx.arc(x, sweepY, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#8f98a3';
  ctx.fill();

  ctx.restore();
}

// ── スポットライト誘導 ───────────────────────────────────────────────────
let spotGlow: CanvasGradient | null = null;
function getSpotGlow(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (!spotGlow) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(255,246,200,0.55)');
    g.addColorStop(0.6, 'rgba(255,246,200,0.18)');
    g.addColorStop(1, 'rgba(255,246,200,0)');
    spotGlow = g;
  }
  return spotGlow;
}

export function drawSpotlight(ctx: CanvasRenderingContext2D, hints: RenderHints, time: number): void {
  const s = hints.spotlight;
  if (!s || s.strength <= 0.01) return;
  const pulse = 0.9 + 0.1 * Math.sin(time * 2.4);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(s.x, s.y);
  ctx.scale(s.r * pulse, s.r * pulse);
  ctx.globalAlpha = clamp01(s.strength);
  ctx.fillStyle = getSpotGlow(ctx);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── ジェスチャーガイド(控えめな矢印/円/タップ波紋) ─────────────────────
export function drawGesture(ctx: CanvasRenderingContext2D, hints: RenderHints, time: number): void {
  const g = hints.gesture;
  if (!g) return;
  const pulse = (time * 1.4) % 1;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#fff6c8';
  ctx.fillStyle = '#fff6c8';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (g.kind === 'tap') {
    ctx.globalAlpha = 1 - pulse;
    ctx.beginPath();
    ctx.arc(0, 0, 14 + pulse * 26, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (g.kind === 'circle') {
    ctx.rotate(time * 1.6);
    ctx.beginPath();
    ctx.arc(0, 0, 30, -0.6, Math.PI * 1.1);
    ctx.stroke();
    const tipA = Math.PI * 1.1;
    drawArrowHead(ctx, Math.cos(tipA) * 30, Math.sin(tipA) * 30, tipA + Math.PI / 2, 10);
  } else {
    // swipe / drag: 往復するふわっとした矢印
    const off = Math.sin(time * 2.4) * 14;
    ctx.rotate(g.dir);
    ctx.beginPath();
    ctx.moveTo(-24, off);
    ctx.lineTo(24, off);
    ctx.stroke();
    drawArrowHead(ctx, 24, off, 0, 11);
  }
  ctx.restore();
}

function drawArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.65);
  ctx.lineTo(-size, size * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── お祝い演出(ストライク等) ─────────────────────────────────────────────
export function drawCelebrateFlash(ctx: CanvasRenderingContext2D, hints: RenderHints): void {
  const c = clamp01(hints.celebrate);
  if (c <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = c * 0.35;
  ctx.fillStyle = '#fff8e0';
  ctx.fillRect(0, 0, LANE_VIEW.w, LANE_VIEW.h);
  ctx.restore();
}

export function drawCelebrateStars(ctx: CanvasRenderingContext2D, hints: RenderHints, time: number): void {
  const c = clamp01(hints.celebrate);
  if (c <= 0.01) return;
  drawStars(ctx, LANE_VIEW.centerX, LANE_VIEW.deckY - 30, c, time);
}

// ── ロボット配置 ────────────────────────────────────────────────────────
export function drawHintRobot(ctx: CanvasRenderingContext2D, hints: RenderHints, time: number): void {
  const r = hints.robot;
  if (!r.visible) return;
  const scale = perspScale(r.y);
  drawRobot(ctx, r.x, r.y, scale, r.pose, time, r.lookX, r.lookY);
}
