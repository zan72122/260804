// ============================================================================
// ボール軌道・ピン倒壊の純関数ヘルパー
// ============================================================================
import { LANE_VIEW } from '../core/geometry';
import { clamp, easeInOutQuad, lerp } from './pins';

/** bowl() の投球アニメ: t(0..1) → LANE_VIEW 座標。dirXは-1..1(左右)、中央へ緩やかに補正。 */
export function bowlPosition(t: number, dirX: number): { x: number; y: number } {
  const k = easeInOutQuad(t);
  const y = lerp(LANE_VIEW.nearY, LANE_VIEW.deckY, k);
  // 序盤は dirX の影響が強いが、進むほど中央へ補正される（初心者救済ガター無し）
  const drift = clamp(dirX, -1, 1) * 220 * (1 - k * 0.85);
  const x = LANE_VIEW.centerX + drift;
  return { x, y };
}

/** 投球所要時間（秒）。power 0..1 で速さが変わる */
export function bowlDuration(power: number): number {
  return lerp(1.6, 0.95, clamp(power, 0, 1));
}

/**
 * 倒すピンのslotを選ぶ。strike=trueなら全10本。
 * falseなら「9本倒れ1本残る」定番演出（1番=手前の単独ピンを残す）。
 */
export function pickStanding(strike: boolean): number[] {
  if (strike) return [];
  // slot 9 = 最前列(手前)の単独ピン (ROW_SIZES=[4,3,2,1]の最後) を残す
  return [9];
}
