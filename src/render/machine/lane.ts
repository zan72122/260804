// ============================================================================
// レーン端(LANE): 機械シーン右側に見える木目レーン面とピンデッキ。
// ============================================================================
import { LANE, PIN_DECK, HOUSING } from '../../core/geometry';
import { cachedLinear, roundRectPath } from './util';

export function drawLaneDeck(ctx: CanvasRenderingContext2D): void {
  const { leftX, rightX, surfaceY } = LANE;

  ctx.save();

  // レーン面(木目)
  const wood = cachedLinear(ctx, 'lane-wood', leftX, 0, rightX, 0, [
    [0, '#7a5230'], [0.3, '#a0723f'], [0.5, '#8a5f36'], [0.75, '#a67543'], [1, '#6e4a2a'],
  ]);
  ctx.fillStyle = wood;
  ctx.fillRect(leftX, surfaceY - 24, rightX - leftX, 200);

  // 木目の筋
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const lx = leftX + (i + 0.5) * ((rightX - leftX) / 14);
    ctx.beginPath();
    ctx.moveTo(lx, surfaceY - 24);
    ctx.lineTo(lx + 6, surfaceY + 176);
    ctx.stroke();
  }

  // 上端ハイライト(奥からの光の反射)
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(leftX, surfaceY - 24, rightX - leftX, 8);

  // 側壁(機械側との境目、少し立ち上がったガード)
  ctx.fillStyle = '#3a4250';
  roundRectPath(ctx, leftX - 16, HOUSING.y, 20, surfaceY - HOUSING.y + 20, 6);
  ctx.fill();

  // ピンデッキの目印(ピンが立つ場所、10個分のうっすらしたマーク)
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  const cols = [-124, -62, 0, 62, 124];
  for (const dx of cols) {
    ctx.beginPath();
    ctx.ellipse(PIN_DECK.x + dx, PIN_DECK.y + 26, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}
