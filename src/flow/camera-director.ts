// ============================================================================
// flow/camera-director.ts — ステップ×向き(portrait/landscape)ごとのカメラ構図。
// portrait = 注目機構へズームイン＋追従 / landscape = fitRectで関連機構を俯瞰。
// 純粋計算のみ行い、実際の cam.focus/snap 呼び出しは呼び出し側(index.ts)が行う。
// ============================================================================
import type { FlowStep, Layout, MachineState, Orientation, SceneId } from '../core/types';
import type { CameraController } from '../core/camera';
import {
  WORLD, HOUSING, DOOR_HANDLE, PANEL, TABLE, RACK, ORIENTER, TOP_PATH, FLAP, LANE_VIEW,
} from '../core/geometry';

export interface CameraRequest {
  step: FlowStep;
  scene: SceneId;
  orientation: Orientation;
  layout: Layout;
  state: MachineState;
  /** 'fix' ステップ中の注目故障座標(machine-space) */
  faultFocusPoint: { x: number; y: number } | null;
  /** table-drop完了後、低い位置から見せる演出 */
  tableLowShot: boolean;
  /** full-run見せ場の一時的なズーム上書き */
  showcase: { x: number; y: number; zoom: number } | null;
  /** laneシーンでのボールy(縦追従用) */
  laneBallY: number;
}

export interface CameraResult { x: number; y: number; zoom: number; lerp?: number }

function fit(cam: CameraController, x: number, y: number, w: number, h: number, layout: Layout, margin: number): CameraResult {
  return cam.fitRect(x, y, w, h, layout, margin);
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function computeCamera(req: CameraRequest, cam: CameraController): CameraResult {
  const { step, scene, orientation, layout, state } = req;
  const portrait = orientation === 'portrait';

  if (scene === 'lane') {
    switch (step) {
      case 'title':
        return fit(cam, 0, 0, LANE_VIEW.w, LANE_VIEW.h, layout, 30);
      case 'bowl':
      case 'full-run': {
        if (portrait) {
          const y = clamp(req.laneBallY, LANE_VIEW.deckY, LANE_VIEW.nearY);
          return { x: LANE_VIEW.centerX, y: (y + LANE_VIEW.deckY) / 2, zoom: 0.62 };
        }
        return fit(
          cam, 0, LANE_VIEW.deckY - 120, LANE_VIEW.w,
          LANE_VIEW.nearY - LANE_VIEW.deckY + 260, layout, 40,
        );
      }
      case 'breakdown':
        if (portrait) return { x: LANE_VIEW.centerX, y: LANE_VIEW.deckY + 80, zoom: 0.8 };
        return fit(cam, 0, LANE_VIEW.deckY - 150, LANE_VIEW.w, 520, layout, 40);
      case 'approach':
        if (portrait) return { x: LANE_VIEW.centerX, y: LANE_VIEW.backWallY + 40, zoom: 0.85 };
        return fit(cam, 0, 0, LANE_VIEW.w, LANE_VIEW.backWallY + 260, layout, 40);
      default:
        return fit(cam, 0, 0, LANE_VIEW.w, LANE_VIEW.h, layout, 30);
    }
  }

  // scene === 'machine'
  switch (step) {
    case 'approach':
    case 'power-off':
      if (portrait) return { x: DOOR_HANDLE.x, y: DOOR_HANDLE.y, zoom: 1.3 };
      return fit(cam, DOOR_HANDLE.x - 260, DOOR_HANDLE.y - 260, 520, 520, layout, 30);

    case 'safety-lock':
      if (portrait) return { x: PANEL.x + PANEL.w / 2, y: PANEL.y + PANEL.h / 2, zoom: 1.35 };
      return fit(cam, PANEL.x - 160, PANEL.y - 120, PANEL.w + 320, PANEL.h + 240, layout, 30);

    case 'open-door':
      if (state.door < 0.9) {
        if (portrait) return { x: DOOR_HANDLE.x, y: DOOR_HANDLE.y, zoom: 1.3 };
        return fit(cam, DOOR_HANDLE.x - 260, DOOR_HANDLE.y - 260, 520, 520, layout, 30);
      }
      // パカッと開いた後: ゆっくり引いて全景の驚き演出
      if (portrait) {
        return { x: HOUSING.x + HOUSING.w / 2, y: HOUSING.y + HOUSING.h * 0.35, zoom: 0.62, lerp: 0.035 };
      }
      return fit(cam, HOUSING.x - 40, HOUSING.y - 40, HOUSING.w + 80, HOUSING.h + 80, layout, 30);

    case 'find-fault':
      if (portrait) {
        return { x: HOUSING.x + HOUSING.w / 2, y: HOUSING.y + HOUSING.h * 0.45, zoom: 0.58, lerp: 0.05 };
      }
      return fit(cam, HOUSING.x - 40, HOUSING.y - 40, HOUSING.w + 80, HOUSING.h + 80, layout, 30);

    case 'fix': {
      const p = req.faultFocusPoint ?? { x: WORLD.w / 2, y: WORLD.h / 2 };
      if (portrait) return { x: p.x, y: p.y, zoom: 1.55 };
      return fit(cam, p.x - 300, p.y - 260, 600, 520, layout, 30);
    }

    case 'close-cover':
      if (portrait) return { x: DOOR_HANDLE.x, y: DOOR_HANDLE.y, zoom: 1.15 };
      return fit(cam, HOUSING.x - 40, HOUSING.y - 40, HOUSING.w + 80, HOUSING.h + 80, layout, 30);

    case 'orient-pins':
      if (portrait) return { x: ORIENTER.x, y: ORIENTER.y, zoom: 1.7 };
      return fit(cam, ORIENTER.x - 260, TOP_PATH[0][1] - 120, 900, 420, layout, 30);

    case 'rack-fill':
      if (portrait) return { x: RACK.x + RACK.w / 2, y: RACK.y + RACK.h / 2, zoom: 1.35 };
      return fit(cam, RACK.x - 140, RACK.y - 100, RACK.w + 280, RACK.h + 240, layout, 30);

    case 'table-drop':
      if (req.tableLowShot) {
        if (portrait) return { x: TABLE.x, y: TABLE.yDown - 40, zoom: 1.15, lerp: 0.05 };
        return fit(cam, TABLE.x - 340, TABLE.yDown - 260, 680, 420, layout, 20);
      }
      if (portrait) return { x: TABLE.x, y: (TABLE.yUp + TABLE.yDown) / 2, zoom: 1.05 };
      return fit(cam, TABLE.x - 260, TABLE.yUp - 80, 520, TABLE.yDown - TABLE.yUp + 260, layout, 30);

    case 'ball-return':
      if (portrait) return { x: FLAP.x, y: FLAP.y, zoom: 1.3 };
      return fit(cam, FLAP.x - 300, FLAP.y - 180, 600, 340, layout, 30);

    case 'unlock':
      if (portrait) return { x: PANEL.x + PANEL.w / 2, y: PANEL.y + PANEL.h / 2, zoom: 1.2 };
      return fit(cam, HOUSING.x - 40, HOUSING.y - 40, HOUSING.w + 80, HOUSING.h + 80, layout, 30);

    case 'full-run':
    case 'celebrate':
      if (req.showcase) return { x: req.showcase.x, y: req.showcase.y, zoom: req.showcase.zoom, lerp: 0.1 };
      if (portrait) return { x: WORLD.w * 0.42, y: WORLD.h * 0.52, zoom: 0.5 };
      return fit(cam, 0, 0, WORLD.w, WORLD.h, layout, 20);

    default:
      if (portrait) return { x: WORLD.w / 2, y: WORLD.h / 2, zoom: 0.5 };
      return fit(cam, 0, 0, WORLD.w, WORLD.h, layout, 20);
  }
}
