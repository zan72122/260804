// ============================================================================
// flow/camera-director.ts — ステップ×向き(portrait/landscape)ごとのカメラ構図。
// portrait = 注目機構へズームイン＋追従 / landscape = fitRectで関連機構を俯瞰。
// 純粋計算のみ行い、実際の cam.focus/snap 呼び出しは呼び出し側(index.ts)が行う。
// ============================================================================
import type { FlowStep, Layout, MachineState, Orientation, SceneId } from '../core/types';
import type { CameraController } from '../core/camera';
import {
  WORLD, HOUSING, DOOR_HANDLE, PANEL, TABLE, TABLE_LEVER, RACK, ORIENTER, TOP_PATH, FLAP, LANE_VIEW,
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

/**
 * 幅を優先しつつ、最低限必要な縦の可視高さ(minVisibleH)は必ず確保する構図。
 * landscapeのlaneシーンで、高さ基準のfitRectだと左右に余白が余ってしまう
 * ケース向け。幅だけを無条件に最大化すると、ボール開始位置(手前)とピン
 * デッキ(奥)の両方が画面外になりうるため、必要な縦幅は落とさないよう
 * zoomにcapをかける(cam.fitRectと同じsafe-area補正ロジックをここで直接
 * 計算する。fitRectはw/h両方を満たす最小zoomしか返せないため)。
 */
function fitWidthAt(
  centerX: number, w: number, centerY: number, layout: Layout, margin: number, minVisibleH = 0,
): CameraResult {
  const safe = layout.safe;
  const availW = Math.max(1, layout.w - safe.left - safe.right - margin * 2);
  const availH = Math.max(1, layout.h - safe.top - safe.bottom - margin * 2);
  let zoom = Math.max(0.001, availW / Math.max(1, w));
  if (minVisibleH > 0) zoom = Math.min(zoom, availH / minVisibleH);
  const offX = (safe.left - safe.right) / 2 / zoom;
  const offY = (safe.top - safe.bottom) / 2 / zoom;
  return { x: centerX - offX, y: centerY - offY, zoom };
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
        const y = clamp(req.laneBallY, LANE_VIEW.deckY, LANE_VIEW.nearY);
        const cy = (y + LANE_VIEW.deckY) / 2;
        if (portrait) return { x: LANE_VIEW.centerX, y: cy, zoom: 0.62 };
        // landscape: 高さ基準のfitRectだと横に余白が余るので、幅を活かして
        // ボール/ピンデッキ付近を追う構図にする。ただし幅だけを無条件に
        // 最大化すると、投球前(ボールが手前rackにいる間)にピンデッキと
        // ボールの両方が画面外になってしまうため、その時点で必要な縦幅は
        // 落とさないようcapをかける(ボールがデッキに近づくほど必要な縦幅が
        // 減り、自然にズームイン=幅を活かす画になっていく)。
        const neededHalfH = Math.max(Math.abs(cy - LANE_VIEW.deckY), Math.abs(cy - y)) + 130;
        return fitWidthAt(LANE_VIEW.centerX, LANE_VIEW.w, cy, layout, 40, neededHalfH * 2);
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

    case 'open-door': {
      if (state.door < 0.9) {
        if (portrait) return { x: DOOR_HANDLE.x, y: DOOR_HANDLE.y, zoom: 1.3 };
        return fit(cam, DOOR_HANDLE.x - 260, DOOR_HANDLE.y - 260, 520, 520, layout, 30);
      }
      // パカッと開いた後: 全景の驚き演出。固定zoomだと390幅などで機械の一部しか
      // 入らなかったため、縦横ともfitRectでHOUSING全体+余白が収まるようにする。
      const r = fit(cam, HOUSING.x - 40, HOUSING.y - 40, HOUSING.w + 80, HOUSING.h + 80, layout, 30);
      return portrait ? { ...r, lerp: 0.035 } : r;
    }

    case 'find-fault': {
      const r = fit(cam, HOUSING.x - 40, HOUSING.y - 40, HOUSING.w + 80, HOUSING.h + 80, layout, 30);
      return portrait ? { ...r, lerp: 0.05 } : r;
    }

    case 'fix': {
      const p = req.faultFocusPoint ?? { x: WORLD.w / 2, y: WORLD.h / 2 };
      // 全景→クローズアップの急カットを和らげるため緩いlerpで追従する。
      if (portrait) return { x: p.x, y: p.y, zoom: 1.55, lerp: 0.05 };
      return { ...fit(cam, p.x - 300, p.y - 260, 600, 520, layout, 30), lerp: 0.05 };
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
      // テーブル(TABLE, x=1290)とレバー(TABLE_LEVER, x=1620)の両方が画面内に
      // 収まるようfitRect化(旧portrait固定zoomはレバーが画面外になっていた)。
      // margin多めでtablet横でも右端がギリギリにならないようにする。
      return fit(cam, 1120, 430, TABLE_LEVER.x + 100 - 1120, 380, layout, 40);

    case 'ball-return':
      if (portrait) return { x: FLAP.x, y: FLAP.y, zoom: 1.3 };
      return fit(cam, FLAP.x - 300, FLAP.y - 180, 600, 340, layout, 30);

    case 'unlock': {
      // 'safety-lever'と'door-handle'を同時に有効化するステップなので、
      // PANEL(ハウジング外)とDOOR_HANDLE(ハウジング内)の両方が画面内に入る
      // 矩形を動的に組む(旧portrait固定zoomはPANEL中心のみでdoor-handleが
      // 画面外になっていた。旧landscapeのHOUSING全体fitも同様にPANEL側が外に
      // 出ていた)。
      const x0 = Math.min(DOOR_HANDLE.x, PANEL.x) - 140;
      const x1 = Math.max(DOOR_HANDLE.x, PANEL.x + PANEL.w) + 100;
      const y0 = Math.min(DOOR_HANDLE.y, PANEL.y) - 100;
      const y1 = Math.max(DOOR_HANDLE.y, PANEL.y + PANEL.h) + 100;
      return fit(cam, x0, y0, x1 - x0, y1 - y0, layout, 30);
    }

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
