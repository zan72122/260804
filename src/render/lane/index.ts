// ============================================================================
// render-lane: レーン正面シーン(ボウリング場)の統括描画。
// ワールドは LANE_VIEW(1000x1600, y小=奥)。奥へ向かって幅が狭まる疑似遠近ビュー。
// ============================================================================
import type { CameraController } from '../../core/camera';
import type { Layout, MachineState, Pin, RenderHints } from '../../core/types';
import { BALL_R, LANE_VIEW } from '../../core/geometry';
import { drawBall, drawPin } from '../sprites';
import { drawLaneBackground } from './background';
import {
  drawCelebrateFlash,
  drawCelebrateStars,
  drawGesture,
  drawHintRobot,
  drawPitSuckIn,
  drawSpotlight,
  drawSweepBar,
} from './effects';
import { perspScale } from './util';

interface Depth {
  y: number;
  draw: () => void;
}

/** イージング(ease-out)。ボールが「ポン」と顔を出す演出に使う。 */
function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

function drawLanePin(ctx: CanvasRenderingContext2D, pin: Pin, hints: RenderHints): void {
  const scale = perspScale(pin.y);
  const glow = hints.celebrate > 0.05 ? Math.min(1, hints.celebrate) * 0.6 : undefined;
  drawPin(ctx, pin.x, pin.y, pin.rot, scale, { ring: pin.ring, shadow: true, glow });
}

function drawLaneBall(ctx: CanvasRenderingContext2D, state: MachineState, time: number): Depth | null {
  const ball = state.ball;
  if (ball.zone === 'rack') {
    const bob = Math.sin(time * 1.6) * 2.2;
    const x = LANE_VIEW.ballRack.x;
    const y = LANE_VIEW.ballRack.y + bob;
    const r = BALL_R * perspScale(LANE_VIEW.ballRack.y);
    return { y, draw: () => drawBall(ctx, x, y, r, Math.sin(time * 1.1) * 0.05, ball.color) };
  }
  if (ball.zone === 'returned') {
    const t = Math.max(0, Math.min(1, ball.t));
    const eased = easeOutCubic(t);
    const popHeight = 46;
    const x = LANE_VIEW.ballRack.x;
    const y = LANE_VIEW.ballRack.y - popHeight * eased + Math.sin(time * 2) * (1 - eased) * 4;
    const r = BALL_R * perspScale(y);
    const rot = eased * 1.4;
    return { y, draw: () => drawBall(ctx, x, y, r, rot, ball.color) };
  }
  if (ball.zone === 'lane') {
    const r = BALL_R * perspScale(ball.y);
    return { y: ball.y, draw: () => drawBall(ctx, ball.x, ball.y, r, ball.rot, ball.color) };
  }
  return null;
}

/**
 * レーン正面シーンを描画する。
 * ctx は変換前の状態で渡ってくる想定 — 自前で cam.applyTransform を適用し、
 * 描画後は元の変換状態に復帰する(save/restoreで自己完結)。
 */
export function drawLaneScene(
  ctx: CanvasRenderingContext2D,
  cam: CameraController,
  state: MachineState,
  layout: Layout,
  hints: RenderHints,
  time: number,
): void {
  ctx.save();
  cam.applyTransform(ctx, layout);

  drawLaneBackground(ctx, cam, layout, state, hints, time);
  drawSweepBar(ctx, state, time);
  drawPitSuckIn(ctx, state, time);

  const depths: Depth[] = [];
  for (const pin of state.pins) {
    if (pin.zone !== 'lane' && pin.zone !== 'placed') continue;
    depths.push({ y: pin.y, draw: () => drawLanePin(ctx, pin, hints) });
  }
  const ballDepth = drawLaneBall(ctx, state, time);
  if (ballDepth) depths.push(ballDepth);

  depths.sort((a, b) => a.y - b.y);
  for (const d of depths) d.draw();

  drawHintRobot(ctx, hints, time);
  drawSpotlight(ctx, hints, time);
  drawGesture(ctx, hints, time);
  drawCelebrateFlash(ctx, hints);
  drawCelebrateStars(ctx, hints, time);

  ctx.restore();
}
