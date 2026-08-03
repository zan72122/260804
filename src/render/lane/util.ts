// ============================================================================
// lane シーン共通ユーティリティ — 疑似遠近スケール・レーン幅・補間。
// ============================================================================
import { LANE_VIEW } from '../../core/geometry';

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 奥(y小)ほど小さく、手前(y大)ほど大きい疑似遠近スケール。 */
export function perspScale(y: number): number {
  return 0.55 + 0.45 * clamp01(y / LANE_VIEW.h);
}

/** レーン(+ガター)のワールド半幅。奥で狭く、手前で広い台形。 */
export function laneHalfWidthAt(y: number): number {
  const t = clamp01((y - LANE_VIEW.backWallY) / (LANE_VIEW.h - LANE_VIEW.backWallY));
  return lerp(95, 430, t);
}

/** ガターを含まないレーン板部分だけの半幅(意匠用)。 */
export function boardsHalfWidthAt(y: number): number {
  return laneHalfWidthAt(y) * 0.86;
}
