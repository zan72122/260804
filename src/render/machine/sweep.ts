// ============================================================================
// スイープバー(SWEEP): 倒れたピンをピットへ送る横棒。sweep.posで移動。
// ============================================================================
import type { MachineState } from '../../core/types';
import { SWEEP } from '../../core/geometry';
import { lerp, roundRectPath } from './util';

export function drawSweep(ctx: CanvasRenderingContext2D, state: MachineState): void {
  const { x0, x1, y } = SWEEP;
  const x = lerp(x0, x1, state.sweep.pos);
  const moving = state.sweep.phase !== 'idle';

  ctx.save();
  ctx.translate(x, y);

  // レール溝
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x1 - x - 20, 30);
  ctx.lineTo(x0 - x + 20, 30);
  ctx.stroke();

  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 20, 60, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // バー本体
  const skew = moving ? 4 : 0;
  const grad = ctx.createLinearGradient(0, -14, 0, 14);
  grad.addColorStop(0, '#ffd23f');
  grad.addColorStop(0.5, '#e0a300');
  grad.addColorStop(1, '#8a6300');
  ctx.fillStyle = grad;
  ctx.save();
  ctx.transform(1, 0, skew * 0.01, 1, 0, 0);
  roundRectPath(ctx, -56, -14, 112, 26, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, -56, -14, 112, 26, 8);
  ctx.stroke();
  ctx.restore();

  // 縞模様(注意柄)
  ctx.save();
  roundRectPath(ctx, -56, -14, 112, 26, 8);
  ctx.clip();
  ctx.fillStyle = 'rgba(30,30,30,0.55)';
  for (let sx = -56; sx < 56; sx += 18) {
    ctx.beginPath();
    ctx.moveTo(sx, -14);
    ctx.lineTo(sx + 9, -14);
    ctx.lineTo(sx - 5, 12);
    ctx.lineTo(sx - 14, 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}
