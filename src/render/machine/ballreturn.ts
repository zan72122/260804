// ============================================================================
// ボールリターン(BALL_PATH): 地下トンネル。xray=trueかball通過中は内部が見える。
// FLAP位置にフラップ板。BALL_EXITにボールリフト出口。
// ============================================================================
import type { MachineState } from '../../core/types';
import { BALL_PATH, FLAP, BALL_EXIT, pathLength, pointOnPath } from '../../core/geometry';
import { cachedRadial, clamp, roundRectPath } from './util';
import type { Accent } from './decoration';

export function drawBallTunnel(
  ctx: CanvasRenderingContext2D, state: MachineState, time: number, accent: Accent,
): void {
  const ballInside = state.ball.zone === 'return';
  const seeThrough = state.xray || ballInside;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 影(地面に埋まっている感)
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 58;
  ctx.beginPath();
  ctx.moveTo(BALL_PATH[0][0], BALL_PATH[0][1] + 8);
  for (let i = 1; i < BALL_PATH.length; i++) ctx.lineTo(BALL_PATH[i][0], BALL_PATH[i][1] + 8);
  ctx.stroke();

  // トンネル外壁
  ctx.strokeStyle = '#20242b';
  ctx.lineWidth = 50;
  ctx.beginPath();
  ctx.moveTo(BALL_PATH[0][0], BALL_PATH[0][1]);
  for (let i = 1; i < BALL_PATH.length; i++) ctx.lineTo(BALL_PATH[i][0], BALL_PATH[i][1]);
  ctx.stroke();

  // 内側: 通常は暗くほぼ塞がって見える／xrayか通過中は明るく透ける
  ctx.strokeStyle = seeThrough ? 'rgba(120,160,200,0.35)' : 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 38;
  ctx.beginPath();
  ctx.moveTo(BALL_PATH[0][0], BALL_PATH[0][1]);
  for (let i = 1; i < BALL_PATH.length; i++) ctx.lineTo(BALL_PATH[i][0], BALL_PATH[i][1]);
  ctx.stroke();

  if (seeThrough) {
    // 断面のガイドリング(等間隔)でトンネル感を強調
    const total = pathLength(BALL_PATH);
    const spacing = 90;
    const n = Math.floor(total / spacing);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = pointOnPath(BALL_PATH, t);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.strokeStyle = 'rgba(180,210,255,0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-19, 0);
      ctx.lineTo(19, 0);
      ctx.stroke();
      ctx.restore();
    }

    // ボールを追従するライト
    const t = ballInside ? clamp(state.ball.t, 0, 1) : (time * 0.15) % 1;
    const p = pointOnPath(BALL_PATH, t);
    const glow = cachedRadial(ctx, 'ball-tunnel-glow', 0, 0, 4, 0, 0, 70, [
      [0, accent.glowStrong], [1, 'rgba(0,0,0,0)'],
    ]);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = ballInside ? 0.85 : 0.35;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  drawFlap(ctx, state);
  drawExit(ctx, state, time, accent);
}

function drawFlap(ctx: CanvasRenderingContext2D, state: MachineState): void {
  const { x, y } = FLAP;
  const openA = -clamp(state.ballReturn.flap, 0, 1) * (Math.PI * 0.5);

  ctx.save();
  ctx.translate(x, y);
  // 蝶番
  ctx.fillStyle = '#161a20';
  ctx.beginPath();
  ctx.arc(0, 20, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(0, 20);
  ctx.rotate(openA);
  const grad = ctx.createLinearGradient(0, -44, 0, 0);
  grad.addColorStop(0, state.ballReturn.flapStuck ? '#8a7d6a' : '#c7cdd6');
  grad.addColorStop(1, state.ballReturn.flapStuck ? '#5c5346' : '#7a8492');
  ctx.fillStyle = grad;
  roundRectPath(ctx, -22, -44, 44, 46, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, -22, -44, 44, 46, 6);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawExit(
  ctx: CanvasRenderingContext2D, state: MachineState, time: number, accent: Accent,
): void {
  const { x, y } = BALL_EXIT;
  ctx.save();
  ctx.translate(x, y);

  // リフト筒
  const tube = ctx.createLinearGradient(-22, 0, 22, 0);
  tube.addColorStop(0, '#4a525f');
  tube.addColorStop(0.5, '#8b96a6');
  tube.addColorStop(1, '#333b48');
  ctx.fillStyle = tube;
  roundRectPath(ctx, -22, -70, 44, 90, 16);
  ctx.fill();
  ctx.strokeStyle = '#20242b';
  ctx.lineWidth = 4;
  roundRectPath(ctx, -22, -70, 44, 90, 16);
  ctx.stroke();

  // 出口の光(ボールが戻る時にポンと光る演出のベース)
  const excite = state.ball.zone === 'returned' ? 1 : 0.25;
  ctx.save();
  ctx.globalAlpha = excite * (0.5 + 0.5 * Math.sin(time * 6));
  ctx.fillStyle = accent.glow;
  ctx.beginPath();
  ctx.arc(0, -66, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
