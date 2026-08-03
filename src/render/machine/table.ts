// ============================================================================
// ピンテーブル(TABLE): yUp..yDownで上下する保持盤。保持カップ10個。
// ============================================================================
import type { MachineState } from '../../core/types';
import { TABLE } from '../../core/geometry';
import { cachedLinear, cachedRadial, lerp, roundRectPath } from './util';
import type { Accent } from './decoration';

const CUPS = 10;

export function drawTableRails(ctx: CanvasRenderingContext2D): void {
  const { x, w, yUp, yDown } = TABLE;
  ctx.save();
  ctx.strokeStyle = '#454e5c';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  for (const rx of [x - w / 2 + 14, x + w / 2 - 14]) {
    ctx.beginPath();
    ctx.moveTo(rx, yUp - 20);
    ctx.lineTo(rx, yDown + 40);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 3;
  for (const rx of [x - w / 2 + 14, x + w / 2 - 14]) {
    ctx.beginPath();
    ctx.moveTo(rx - 2, yUp - 20);
    ctx.lineTo(rx - 2, yDown + 40);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawTablePlate(
  ctx: CanvasRenderingContext2D, state: MachineState, time: number, accent: Accent,
): void {
  const { x, w, yUp, yDown } = TABLE;
  const y = lerp(yUp, yDown, state.table.y);

  ctx.save();
  ctx.translate(x, y);

  // 影(下に落ちる影、降下中ほど濃い)
  ctx.fillStyle = `rgba(0,0,0,${0.25 + 0.2 * state.table.y})`;
  ctx.beginPath();
  ctx.ellipse(0, 26 + state.table.y * 10, w / 2, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // 盤本体
  const plate = cachedLinear(ctx, 'table-plate', -w / 2, 0, w / 2, 0, [
    [0, '#3a4250'], [0.5, '#6b7686'], [1, '#3a4250'],
  ]);
  ctx.fillStyle = plate;
  roundRectPath(ctx, -w / 2, -18, w, 36, 10);
  ctx.fill();
  ctx.strokeStyle = '#20252d';
  ctx.lineWidth = 4;
  roundRectPath(ctx, -w / 2, -18, w, 36, 10);
  ctx.stroke();

  // 差し色ライン
  ctx.strokeStyle = accent.a;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 12, -18 - 4);
  ctx.lineTo(w / 2 - 12, -18 - 4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 保持カップ10個
  for (let i = 0; i < CUPS; i++) {
    const cx = -w / 2 + (i + 0.5) * (w / CUPS);
    const holding = state.table.holding.length > i;
    ctx.save();
    ctx.translate(cx, 6);
    const cup = cachedRadial(ctx, `table-cup-${i}`, 0, -4, 1, 0, 0, 18, [
      [0, '#20242b'], [1, '#0c0e12'],
    ]);
    ctx.fillStyle = cup;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = holding ? `${accent.a}88` : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // 通電ランプ(降下フェーズの示唆、控えめ)
  if (state.table.phase !== 'up') {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(time * 8);
    ctx.fillStyle = accent.a;
    ctx.beginPath();
    ctx.arc(w / 2 - 16, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}
