// ============================================================================
// ピンプール・イージング・レーン/ラックのレイアウト計算（純関数群）
// ============================================================================
import type { Pin, PinPose, PinZone } from '../core/types';
import { LANE_VIEW, RACK } from '../core/geometry';

/** 全ピン最大数（通常10本 + フリープレイのfree-dropで最大15本まで） */
export const POOL_SIZE = 15;
export const BASE_PIN_COUNT = 10;

/** ラック/レーン共通: 4-3-2-1 の三角配置（行0=奥/4本 … 行3=手前/1本） */
export const ROW_SIZES = [4, 3, 2, 1] as const;

export function slotToRowCol(slot: number): { row: number; col: number; rowSize: number } {
  let idx = slot;
  for (let row = 0; row < ROW_SIZES.length; row++) {
    const size = ROW_SIZES[row];
    if (idx < size) return { row, col: idx, rowSize: size };
    idx -= size;
  }
  return { row: 3, col: 0, rowSize: 1 };
}

/** slot(0..9) → LANE_VIEW 座標（正立時の正位置） */
export function laneDeckPosition(slot: number): { x: number; y: number } {
  const { row, col, rowSize } = slotToRowCol(slot);
  const y = LANE_VIEW.deckY + (row - 1.5) * LANE_VIEW.pinGapY;
  const x = LANE_VIEW.centerX + (col - (rowSize - 1) / 2) * LANE_VIEW.pinGapX;
  return { x, y };
}

/** slot(0..9) → RACK 機械座標 */
export function rackSlotPosition(slot: number): { x: number; y: number } {
  const p = RACK.slots[Math.max(0, Math.min(9, slot))];
  return { x: p[0], y: p[1] };
}

// ── イージング ──────────────────────────────────────────────────────
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}
export function easeInOutQuad(t: number): number {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
export function easeOutCubic(t: number): number {
  t = clamp(t, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}
export function easeOutBack(t: number): number {
  t = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
/** 角度の最短補間 */
export function lerpAngle(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
export function randRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

// ── ピンプール ──────────────────────────────────────────────────────
export function makePin(id: number): Pin {
  return {
    id,
    zone: 'gone',
    t: 0,
    x: 0,
    y: 0,
    rot: 0,
    pose: 'upright',
    stuck: false,
    slot: -1,
    vx: 0,
    vy: 0,
  };
}

export function createPool(): Pin[] {
  const pool: Pin[] = [];
  for (let i = 0; i < POOL_SIZE; i++) pool.push(makePin(i));
  return pool;
}

/** ピンごとの内部演出データ（MachineStateには載らないsim内部専用） */
export interface PinExtra {
  /** ベルト/エレベーター/上部搬送の速度ゆらぎ */
  speedJitter: number;
  /** 選別機での向き直しが完了済みか（周回ごとにリセットされる） */
  orientedDone: boolean;
  /** 位置をイージングで滑らかに遷移させる簡易トゥイーン */
  tween: null | {
    fromX: number; fromY: number; fromRot: number;
    toX: number; toY: number; toRot: number;
    dur: number; t: number;
    ease: (k: number) => number;
  };
}

export function makeExtra(): PinExtra {
  return { speedJitter: randRange(0.88, 1.15), orientedDone: false, tween: null };
}

/** 点から折れ線への最短距離（なぞり系インタラクションの当たり判定に使用） */
export function distanceToPath(
  path: ReadonlyArray<readonly [number, number]>, x: number, y: number,
): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [x1, y1] = path[i - 1];
    const [x2, y2] = path[i];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let k = len2 === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / len2;
    k = clamp(k, 0, 1);
    const px = x1 + dx * k, py = y1 + dy * k;
    const d = Math.hypot(x - px, y - py);
    if (d < best) best = d;
  }
  return best;
}

/** トゥイーンを設定 */
export function startTween(
  extra: PinExtra, p: Pin, toX: number, toY: number, toRot: number,
  dur: number, ease: (k: number) => number = easeOutCubic,
): void {
  extra.tween = { fromX: p.x, fromY: p.y, fromRot: p.rot, toX, toY, toRot, dur: Math.max(0.001, dur), t: 0, ease };
}

/** トゥイーンを進める。進行中なら true を返し p.x/y/rot を書き換える */
export function stepTween(extra: PinExtra, p: Pin, dt: number): boolean {
  const tw = extra.tween;
  if (!tw) return false;
  tw.t += dt;
  const k = tw.ease(tw.t / tw.dur);
  p.x = lerp(tw.fromX, tw.toX, k);
  p.y = lerp(tw.fromY, tw.toY, k);
  p.rot = lerpAngle(tw.fromRot, tw.toRot, k);
  if (tw.t >= tw.dur) {
    extra.tween = null;
  }
  return true;
}

export function poseUpright(): PinPose { return 'upright'; }
export function zoneOf(p: Pin): PinZone { return p.zone; }
