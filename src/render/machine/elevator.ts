// ============================================================================
// エレベーター(ELEVATOR): 大きな回転ホイール。縁にピンを載せるポケット(シェルフ)。
// このゲーム最大の見せ場の中でも一番目を引く回転体。
// ============================================================================
import type { MachineState } from '../../core/types';
import { ELEVATOR } from '../../core/geometry';
import { cachedRadial, roundRectPath } from './util';
import type { Accent } from './decoration';

const POCKETS = 7;

export function drawElevator(
  ctx: CanvasRenderingContext2D, state: MachineState, time: number, accent: Accent,
): void {
  const { cx, cy, r } = ELEVATOR;

  ctx.save();
  ctx.translate(cx, cy);

  // 背面の固定マウント（円い台座、回転しない）
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, r + 26, 0, Math.PI * 2);
  ctx.fill();

  // 外周リング（固定枠）
  const ring = cachedRadial(ctx, 'elev-ring', -r * 0.3, -r * 0.3, 10, 0, 0, r + 18, [
    [0, '#5b6577'], [0.7, '#333c4a'], [1, '#1b212b'],
  ]);
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(0, 0, r + 18, 0, Math.PI * 2);
  ctx.fill();

  // ── 回転部 ──
  ctx.save();
  ctx.rotate(state.elevator.angle);

  const disk = cachedRadial(ctx, 'elev-disk', -r * 0.35, -r * 0.35, 8, 0, 0, r, [
    [0, '#8b96ab'], [0.35, '#5c6579'], [0.75, '#333b48'], [1, '#1a1f27'],
  ]);
  ctx.fillStyle = disk;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // スポーク
  ctx.strokeStyle = 'rgba(20,24,30,0.55)';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r - 30), Math.sin(a) * (r - 30));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r - 30), Math.sin(a) * (r - 30));
    ctx.stroke();
  }

  // 内周の飾りリング（差し色）
  ctx.strokeStyle = accent.a;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 縁のポケット(シェルフ) — ピンを載せる受け皿
  for (let i = 0; i < POCKETS; i++) {
    const a = (i / POCKETS) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(r - 6, 0);
    ctx.rotate(Math.PI / 2);
    const pg = ctx.createLinearGradient(-24, 0, 24, 0);
    pg.addColorStop(0, '#dfe4ea');
    pg.addColorStop(0.5, '#aeb6c2');
    pg.addColorStop(1, '#6b7481');
    ctx.fillStyle = pg;
    roundRectPath(ctx, -24, -6, 48, 34, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, -24, -6, 48, 34, 8);
    ctx.stroke();
    // ポケットの窪み
    ctx.fillStyle = 'rgba(20,22,26,0.55)';
    roundRectPath(ctx, -17, -1, 34, 20, 6);
    ctx.fill();
    ctx.restore();
  }

  // ハブ
  const hub = cachedRadial(ctx, 'elev-hub', -8, -8, 2, 0, 0, 34, [
    [0, '#f1f4f8'], [0.4, '#98a2b2'], [1, '#2a3038'],
  ]);
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#12151b';
  ctx.lineWidth = 4;
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.fillStyle = '#5a6270';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 22, Math.sin(a) * 22, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // 回転部おわり

  // ツヤ（回転しないハイライト筋、金属玩具っぽい光沢）
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.04 * Math.sin(time * 1.5);
  const gloss = ctx.createLinearGradient(-r, -r, r * 0.2, -r * 0.2);
  gloss.addColorStop(0, 'rgba(255,255,255,0.9)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 1.05, Math.PI * 1.4);
  ctx.arc(0, 0, r * 0.55, Math.PI * 1.4, Math.PI * 1.05, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
