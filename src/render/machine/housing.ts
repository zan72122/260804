// ============================================================================
// ハウジング奥板（金属パネル・フレーム）と、扉/カバー（HOUSINGを覆う開閉ハッチ）。
// ============================================================================
import type { MachineState } from '../../core/types';
import { HOUSING, DOOR_HANDLE } from '../../core/geometry';
import { cachedLinear, cachedRadial, clamp, lerp, roundRectPath, hump } from './util';
import type { Accent } from './decoration';

/** 奥のマウントパネル（常に見える機械の骨格） */
export function drawHousingFrame(ctx: CanvasRenderingContext2D): void {
  const { x, y, w, h } = HOUSING;
  ctx.save();

  // 本体金属パネル
  const panel = cachedLinear(ctx, 'housing-panel', x, y, x, y + h, [
    [0, '#3a4457'],
    [0.08, '#4c586f'],
    [0.5, '#2c3546'],
    [0.92, '#232b39'],
    [1, '#161c26'],
  ]);
  roundRectPath(ctx, x, y, w, h, 26);
  ctx.fillStyle = panel;
  ctx.fill();

  // 縁のベベル（ハイライト上左・影下右）
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 26);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h - 4);
  ctx.lineTo(x + 4, y + 4);
  ctx.lineTo(x + w - 4, y + 4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(x + w - 4, y + 4);
  ctx.lineTo(x + w - 4, y + h - 4);
  ctx.lineTo(x + 4, y + h - 4);
  ctx.stroke();
  ctx.restore();

  // フレーム縁取り
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#171d27';
  roundRectPath(ctx, x, y, w, h, 26);
  ctx.stroke();

  // 太いリブ（縦フレーム3本）で骨格感
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (const fx of [x + w * 0.28, x + w * 0.62]) {
    ctx.fillRect(fx, y + 14, 18, h - 28);
  }

  // コーナーボルト
  const bolt = (bx: number, by: number): void => {
    const bg = cachedRadial(ctx, `bolt-${bx}-${by}`, bx - 2, by - 2, 0.5, bx, by, 9, [
      [0, '#eef2f7'], [0.5, '#8b96a6'], [1, '#20262f'],
    ]);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fill();
  };
  bolt(x + 22, y + 22);
  bolt(x + w - 22, y + 22);
  bolt(x + 22, y + h - 22);
  bolt(x + w - 22, y + h - 22);

  ctx.restore();
}

/** 開いている最中、露出部分にあたたかい光を差す（驚きの演出） */
function drawOpeningGlow(ctx: CanvasRenderingContext2D, door: number, time: number, accent: Accent): void {
  if (door <= 0.001 || door >= 0.999) return;
  const { x, y, w, h } = HOUSING;
  const pulse = 0.65 + 0.35 * Math.sin(time * 5.5);
  ctx.save();
  ctx.globalAlpha = 0.5 * pulse * hump(door);
  const cx = x + w * 0.55;
  const cy = y + h * 0.5;
  const g = ctx.createRadialGradient(cx, cy, 40, cx, cy, w * 0.62);
  g.addColorStop(0, accent.glowStrong);
  g.addColorStop(0.6, accent.glow);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, 26);
  ctx.fill();
  ctx.restore();
}

function drawHandle(ctx: CanvasRenderingContext2D, lx: number, ly: number, accent: Accent): void {
  ctx.save();
  ctx.translate(lx, ly);
  // 台座
  ctx.fillStyle = '#20262f';
  roundRectPath(ctx, -16, -34, 32, 68, 8);
  ctx.fill();
  // グリップバー
  const grip = ctx.createLinearGradient(-46, 0, 46, 0);
  grip.addColorStop(0, '#ffd23f');
  grip.addColorStop(0.5, '#ffe98a');
  grip.addColorStop(1, '#e0a300');
  ctx.fillStyle = grip;
  roundRectPath(ctx, -46, -14, 92, 28, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, -46, -14, 92, 28, 14);
  ctx.stroke();
  // アクセント差し色のドット
  ctx.fillStyle = accent.a;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 扉/カバー本体。HOUSING左端(x)を蝶番に、door(0..1)に応じてX方向に
 * 遠近圧縮(scaleX=cos)させることで「奥へ開く」立体感を疑似的に表現する。
 */
export function drawDoorCover(
  ctx: CanvasRenderingContext2D, state: MachineState, time: number, accent: Accent,
): void {
  const door = clamp(state.door, 0, 1);

  drawOpeningGlow(ctx, door, time, accent);

  if (door >= 0.995) {
    // 全開: パネルは格納され、取っ手のみ蝶番脇に小さく見える
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawHandle(ctx, HOUSING.x + 6, DOOR_HANDLE.y, accent);
    ctx.restore();
    return;
  }

  const hingeX = HOUSING.x;
  const angle = door * (Math.PI * 0.47); // 最大約85度
  const scaleX = Math.max(0.015, Math.cos(angle));
  const fadeAlpha = door > 0.9 ? lerp(1, 0.15, (door - 0.9) / 0.1) : 1;
  const edgeShade = clamp(1 - door * 1.15, 0, 1); // 開くほど陰る(エッジオン)

  ctx.save();
  ctx.globalAlpha = fadeAlpha;
  ctx.translate(hingeX, 0);
  ctx.scale(scaleX, 1);

  const w = HOUSING.w;
  const y = HOUSING.y;
  const h = HOUSING.h;

  const base = ctx.createLinearGradient(0, 0, w, 0);
  base.addColorStop(0, `rgba(${Math.round(90 * edgeShade + 30)},${Math.round(100 * edgeShade + 34)},${Math.round(120 * edgeShade + 42)},1)`);
  base.addColorStop(0.5, '#9aa7ba');
  base.addColorStop(1, '#4a5567');
  ctx.fillStyle = base;
  roundRectPath(ctx, 0, y, w, h, 24);
  ctx.fill();

  // 縦の型押しライン（軽い装飾パネルっぽさ）
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 4;
  for (let lx = 40; lx < w - 20; lx += 90) {
    ctx.beginPath();
    ctx.moveTo(lx, y + 20);
    ctx.lineTo(lx, y + h - 20);
    ctx.stroke();
  }
  // 上下ハイライト/影の縁
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(6, y + 6);
  ctx.lineTo(w - 6, y + 6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.moveTo(6, y + h - 6);
  ctx.lineTo(w - 6, y + h - 6);
  ctx.stroke();

  // フレーム枠
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#232b39';
  roundRectPath(ctx, 0, y, w, h, 24);
  ctx.stroke();

  // 差し色のブランドライン（装飾）
  ctx.fillStyle = accent.a;
  ctx.globalAlpha *= 0.85;
  roundRectPath(ctx, 24, y + h - 46, w - 48, 10, 5);
  ctx.fill();
  ctx.globalAlpha = fadeAlpha;

  // 取っ手（DOOR_HANDLE, ドア座標系ではhingeX基準のローカルx）
  const localHandleX = DOOR_HANDLE.x - hingeX;
  drawHandle(ctx, localHandleX, DOOR_HANDLE.y, accent);

  ctx.restore();
}
