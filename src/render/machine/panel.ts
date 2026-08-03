// ============================================================================
// 操作パネル(PANEL) + 安全レバー(SAFETY_LEVER) + テーブルレバー(TABLE_LEVER)。
// 大きな安全レバー。子どもが「これを動かす」と分かる大きさ・ハンドル形状。
// ============================================================================
import type { MachineState } from '../../core/types';
import { PANEL, SAFETY_LEVER } from '../../core/geometry';
import { cachedLinear, cachedRadial, clamp, lerp, roundRectPath } from './util';
import type { Accent } from './decoration';

export function drawPanel(
  ctx: CanvasRenderingContext2D, state: MachineState, time: number, accent: Accent,
): void {
  const { x, y, w, h } = PANEL;

  ctx.save();

  // 筐体
  const body = cachedLinear(ctx, 'panel-body', x, y, x, y + h, [
    [0, '#4a5566'], [0.5, '#333c4a'], [1, '#1e232c'],
  ]);
  ctx.fillStyle = body;
  roundRectPath(ctx, x, y, w, h, 20);
  ctx.fill();
  ctx.strokeStyle = '#171b22';
  ctx.lineWidth = 6;
  roundRectPath(ctx, x, y, w, h, 20);
  ctx.stroke();

  // ロックランプ(赤→緑)
  const lampX = x + w / 2;
  const lampY = y + 32;
  const locked = state.locked;
  const lampColor = locked ? '#3bff7a' : '#ff3b3b';
  const glow = cachedRadial(ctx, `panel-lamp-${locked ? 'g' : 'r'}`, lampX, lampY, 1, lampX, lampY, 30, [
    [0, lampColor], [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.save();
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * (locked ? 3 : 7));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(lampX, lampY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = lampColor;
  ctx.beginPath();
  ctx.arc(lampX, lampY, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // レバーのレール(縦の溝)
  const { x: lx, y: ly, travel } = SAFETY_LEVER;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx, ly + travel);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx, ly + travel);
  ctx.stroke();

  // 目盛り(上=解除, 下=ロック / テーブル降下)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(lx, ly, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lx, ly + travel, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  drawLever(ctx, state, accent);
}

/**
 * SAFETY_LEVER と TABLE_LEVER は同一座標(同じ物理レバーを局面ごとに再利用)。
 * どちらか進んでいる方の値でハンドル位置を決める。
 */
function drawLever(ctx: CanvasRenderingContext2D, state: MachineState, accent: Accent): void {
  const { x, y, travel } = SAFETY_LEVER;
  const t = clamp(Math.max(state.safetyLever, state.tableLever), 0, 1);
  const hy = y + travel * t;

  ctx.save();
  ctx.translate(x, hy);

  // 支点の陰
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // アーム(パネル固定点から現在位置へ、傾いた棒)
  ctx.strokeStyle = '#2a3038';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, y - hy);
  ctx.lineTo(0, 0);
  ctx.stroke();

  // 大きな赤いハンドル握り玉(4歳児にも「これだ」と分かる大きさ)
  const knob = cachedRadial(ctx, 'lever-knob', -10, -12, 4, 0, 0, 34, [
    [0, '#ff8a70'], [0.5, '#e83b2b'], [1, '#8f1c14'],
  ]);
  ctx.fillStyle = knob;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 差し色リング
  ctx.strokeStyle = accent.a;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
