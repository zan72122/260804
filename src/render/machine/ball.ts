// ============================================================================
// ボール描画: return経路上のボール('pit'/'return'/'returned')。
// 'lane'/'rack'/'hidden' はこのシーンでは描かない(lane正面シーンやUI側の管轄)。
// ============================================================================
import type { MachineState } from '../../core/types';
import { drawBall } from '../sprites';
import { BALL_R } from '../../core/geometry';

const MACHINE_BALL_ZONES = new Set(['pit', 'return', 'returned']);

export function drawMachineBall(ctx: CanvasRenderingContext2D, state: MachineState): void {
  const b = state.ball;
  if (!MACHINE_BALL_ZONES.has(b.zone)) return;
  drawBall(ctx, b.x, b.y, BALL_R, b.rot, b.color);
}
