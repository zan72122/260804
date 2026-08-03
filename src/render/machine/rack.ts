// ============================================================================
// ラック(RACK.slots): 10スロットの格納棚。疑似奥行き(奥の列は小さく上に)。
// 各スロットに gateOpen[i] で開閉するゲート爪。空/埋まりが一目で分かる。
// ============================================================================
import type { MachineState } from '../../core/types';
import { RACK } from '../../core/geometry';
import { cachedLinear, roundRectPath, clamp } from './util';
import type { Accent } from './decoration';

// 手前(0-3)→奥(9)へ行くほど小さく描く行番号とスケール
const ROW_OF_SLOT = [0, 0, 0, 0, 1, 1, 1, 2, 2, 3];
const ROW_SCALE = [1, 0.9, 0.8, 0.7];

export function drawRackShell(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = RACK;
  ctx.save();
  const back = cachedLinear(ctx, 'rack-back', x, y, x, y + h, [
    [0, '#333c4a'], [1, '#1b212b'],
  ]);
  ctx.fillStyle = back;
  roundRectPath(ctx, x, y - 20, w, h + 40, 18);
  ctx.fill();
  ctx.strokeStyle = '#151a22';
  ctx.lineWidth = 6;
  roundRectPath(ctx, x, y - 20, w, h + 40, 18);
  ctx.stroke();
  ctx.restore();
}

export function drawRackSlots(
  ctx: CanvasRenderingContext2D, state: MachineState, time: number, accent: Accent,
): void {
  const { slots } = RACK;

  for (let i = 0; i < slots.length; i++) {
    const [sx, sy] = slots[i];
    const row = ROW_OF_SLOT[i] ?? 0;
    const scale = ROW_SCALE[row] ?? 0.7;
    const filled = state.rack.slots[i] !== null;
    const isStuck = state.rack.stuckGate === i;
    const gateOpen = clamp(state.rack.gateOpen[i] ?? 0, 0, 1);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);

    // 穴(ソケット)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 6, 34, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = filled ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // 空の時のうっすら光る誘導リング（差し色、経路が追える）
    if (!filled) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(time * 2 + i);
      ctx.strokeStyle = accent.a;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 6, 40, 24, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ゲート爪（開閉するフラップ、下端が軸で上端が開く）
    ctx.save();
    const openAngle = -gateOpen * (Math.PI * 0.55);
    ctx.translate(0, 22);
    ctx.rotate(openAngle);
    const gg = ctx.createLinearGradient(0, -30, 0, 0);
    gg.addColorStop(0, '#cfd6df');
    gg.addColorStop(1, '#7a8492');
    ctx.fillStyle = gg;
    roundRectPath(ctx, -30, -30, 60, 16, 5);
    ctx.fill();
    ctx.strokeStyle = isStuck ? '#5c6570' : '#333a44';
    ctx.lineWidth = 2;
    roundRectPath(ctx, -30, -30, 60, 16, 5);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}
