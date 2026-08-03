// ============================================================================
// 選別機(ORIENTER): 透明カバーの箱+ガイド板2枚。guideOffsetでガイドがずれた見た目。
// ============================================================================
import type { MachineState } from '../../core/types';
import { ORIENTER } from '../../core/geometry';
import { roundRectPath, clamp } from './util';
import type { Accent } from './decoration';

export function drawOrienter(
  ctx: CanvasRenderingContext2D, state: MachineState, time: number, accent: Accent,
): void {
  const { x: cx, y: cy, w, h } = ORIENTER;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const offset = clamp(state.orienter.guideOffset, 0, 1);

  ctx.save();

  // 台座
  ctx.fillStyle = '#2a3038';
  roundRectPath(ctx, x - 10, y + h - 14, w + 20, 26, 8);
  ctx.fill();

  // 内部空間(中が見える箱の中身: 薄暗い庫内)
  ctx.fillStyle = '#11151c';
  roundRectPath(ctx, x + 6, y + 6, w - 12, h - 12, 14);
  ctx.fill();

  // ガイド板2枚（斜めのシュート、正常時はハの字で中央へ導く。ずれると隙間ができる）
  const guideY = y + h * 0.42;
  const spread = 26 + offset * 46;
  ctx.save();
  ctx.strokeStyle = '#c7cdd6';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  // 左ガイド
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 18);
  ctx.lineTo(cx - spread, guideY);
  ctx.stroke();
  // 右ガイド（ずれると余計に開く／傾く）
  ctx.beginPath();
  ctx.moveTo(x + w - 16, y + 18 - offset * 18);
  ctx.lineTo(cx + spread + offset * 20, guideY + offset * 10);
  ctx.stroke();
  // ガイド裏面の陰
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 18);
  ctx.lineTo(cx - spread, guideY);
  ctx.moveTo(x + w - 16, y + 18 - offset * 18);
  ctx.lineTo(cx + spread + offset * 20, guideY + offset * 10);
  ctx.stroke();
  ctx.restore();

  // くるん、を示す控えめな回転矢印(装飾)
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = accent.a;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, guideY + 34, 20, time * 2, time * 2 + Math.PI * 1.5);
  ctx.stroke();
  ctx.restore();

  // 透明カバー(箱)本体 — 最後に描いてガラス反射を上に乗せる
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 18);
  ctx.strokeStyle = 'rgba(200,225,255,0.55)';
  ctx.lineWidth = 5;
  ctx.stroke();
  const glass = ctx.createLinearGradient(x, y, x, y + h);
  glass.addColorStop(0, 'rgba(180,220,255,0.20)');
  glass.addColorStop(0.4, 'rgba(180,220,255,0.04)');
  glass.addColorStop(1, 'rgba(180,220,255,0.10)');
  ctx.fillStyle = glass;
  roundRectPath(ctx, x, y, w, h, 18);
  ctx.fill();
  // ハイライトの筋（ガラス反射）
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x + 14, y + 8);
  ctx.lineTo(x + 34, y + 8);
  ctx.lineTo(x + 14, y + h - 8);
  ctx.lineTo(x + 4, y + h - 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // フレーム角ボルト
  ctx.fillStyle = '#8b96a6';
  for (const [bx, by] of [[x + 10, y + 10], [x + w - 10, y + 10], [x + 10, y + h - 10], [x + w - 10, y + h - 10]] as const) {
    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
