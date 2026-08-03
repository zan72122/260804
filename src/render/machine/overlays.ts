// ============================================================================
// 最終オーバーレイ: powerOn=false時の減光+非常灯、locked=true時の回転部ロックランプ。
// ============================================================================
import type { MachineState } from '../../core/types';
import { WORLD, ELEVATOR, ROLLER } from '../../core/geometry';

export function drawPowerOverlay(ctx: CanvasRenderingContext2D, state: MachineState, time: number): void {
  if (state.powerOn) return;

  ctx.save();
  ctx.fillStyle = 'rgba(4,6,10,0.42)';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // 非常灯(琥珀色、ゆっくり明滅) — 2箇所
  const spots: Array<[number, number]> = [[220, 200], [1400, 220]];
  for (const [sx, sy] of spots) {
    const pulse = 0.35 + 0.25 * Math.sin(time * 1.4 + sx * 0.01);
    ctx.save();
    ctx.globalAlpha = pulse;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 220);
    g.addColorStop(0, 'rgba(255,170,60,0.55)');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function lockLamp(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 3);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
  g.addColorStop(0, '#3bff7a');
  g.addColorStop(1, 'rgba(59,255,122,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#c9ffdd';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawLockLamps(ctx: CanvasRenderingContext2D, state: MachineState, time: number): void {
  if (!state.locked) return;
  lockLamp(ctx, ELEVATOR.cx + ELEVATOR.r * 0.72, ELEVATOR.cy - ELEVATOR.r * 0.1, time);
  lockLamp(ctx, ROLLER.x, ROLLER.y - ROLLER.r - 14, time);
}
