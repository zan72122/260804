// ============================================================================
// ピン描画: state.pins のうち machine系ゾーン+placed を sprites.drawPin で描く。
// 'lane' と 'gone' はこのシーンでは描かない('lane'はrender-laneの正面シーン担当)。
// ============================================================================
import type { MachineState, Pin } from '../../core/types';
import { drawPin } from '../sprites';
import { RACK } from '../../core/geometry';

const ROW_OF_SLOT = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
const ROW_SCALE = [1, 0.9, 0.8, 0.7];

function scaleFor(pin: Pin): number {
  if (pin.zone === 'rack' && pin.slot >= 0 && pin.slot < RACK.slots.length) {
    const row = ROW_OF_SLOT[pin.slot] ?? 0;
    return ROW_SCALE[row] ?? 0.7;
  }
  return 1;
}

export function drawMachinePins(ctx: CanvasRenderingContext2D, state: MachineState): void {
  for (const pin of state.pins) {
    if (pin.zone === 'lane' || pin.zone === 'gone') continue;
    drawPin(ctx, pin.x, pin.y, pin.rot, scaleFor(pin), {
      ring: pin.ring,
      shadow: true,
    });
  }
}
