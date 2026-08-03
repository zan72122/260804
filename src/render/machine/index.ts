// ============================================================================
// render-machine: 「巨大なピン工場」機械カットモデル描画。
// CONTRACTS.md: drawMachineScene(ctx, cam, state, layout, hints, time)
// ============================================================================
import type { CameraController } from '../../core/camera';
import type { Layout, MachineState, RenderHints } from '../../core/types';

import { getAccent } from './decoration';
import { drawBackground } from './background';
import { drawHousingFrame, drawDoorCover } from './housing';
import { drawPit, drawBelt, drawRoller } from './belt';
import { drawElevator } from './elevator';
import { drawTopPath } from './toppath';
import { drawOrienter } from './orienter';
import { drawRackShell, drawRackSlots } from './rack';
import { drawTableRails, drawTablePlate } from './table';
import { drawSweep } from './sweep';
import { drawBallTunnel } from './ballreturn';
import { drawLaneDeck } from './lane';
import { drawMachinePins } from './pins';
import { drawMachineBall } from './ball';
import { drawPanel } from './panel';
import { drawSpotlight, drawHintRobot, drawGesture, drawCelebrate } from './hints';
import { drawPowerOverlay, drawLockLamps } from './overlays';
import { RACK, TABLE } from '../../core/geometry';

export { decorationStyle, setDecoration } from './decoration';

export function drawMachineScene(
  ctx: CanvasRenderingContext2D,
  cam: CameraController,
  state: MachineState,
  layout: Layout,
  hints: RenderHints,
  time: number,
): void {
  ctx.save();
  cam.applyTransform(ctx, layout);

  const accent = getAccent(time);

  // 1. 背景
  drawBackground(ctx);

  // 2. ハウジング奥板
  drawHousingFrame(ctx);

  // 3. 機構(奥→手前の順)
  drawPit(ctx, time);
  drawBelt(ctx, state, time);
  drawRoller(ctx, state, accent);
  drawElevator(ctx, state, time, accent);
  drawTopPath(ctx, time);
  drawOrienter(ctx, state, time, accent);
  drawRackShell(ctx);
  drawRackSlots(ctx, state, time, accent);
  drawTableRails(ctx);
  drawTablePlate(ctx, state, time, accent);
  drawSweep(ctx, state);
  drawBallTunnel(ctx, state, time, accent);
  drawLaneDeck(ctx);

  // 4. ピン
  drawMachinePins(ctx, state);

  // 5. ボール
  drawMachineBall(ctx, state);

  // 6. 扉/カバー(内部を覆う。開くほど退く)
  drawDoorCover(ctx, state, time, accent);

  // 7. 操作パネル・安全レバー(ハウジング外なので扉状態に関係なく常に見える)
  drawPanel(ctx, state, time, accent);

  // 8. ヒント演出
  drawSpotlight(ctx, hints, time, accent);
  drawHintRobot(ctx, hints, time);
  drawGesture(ctx, hints, time, accent);
  drawCelebrate(ctx, hints, time, RACK.x, TABLE.yUp);

  // 9. 電源オフ減光 / ロックランプ
  drawPowerOverlay(ctx, state, time);
  drawLockLamps(ctx, state, time);

  ctx.restore();
}
