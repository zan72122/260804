// src/input/gesture-logic.ts
// 所有: A3 (input)
//
// gestures.ts (DOM/bus/layout に依存する副作用コード) から使う「純粋関数」だけを集めたモジュール。
// DOM/bus に一切触れないので Node 単体でロジックをテストできる。
//
// 4歳児向けの「寛容な当たり判定」を実現するための幾何ヘルパー群。

export interface Vec2 {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// -pi..pi に正規化
export function normalizeAngle(rad: number): number {
  let a = rad % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

// b から見た a への最短差分角 (a - b を -pi..pi に正規化)
export function angleDiff(a: number, b: number): number {
  return normalizeAngle(a - b);
}

// CONTRACT の world 座標系: x+ = 右, y+ = 下 (y- が上)。
// 数学角(atan2(dy,dx))と一致する向きとして定義。
export function dirToAngle(dir: 'up' | 'down' | 'left' | 'right'): number {
  switch (dir) {
    case 'right':
      return 0;
    case 'down':
      return Math.PI / 2;
    case 'left':
      return Math.PI;
    case 'up':
      return -Math.PI / 2;
  }
}

const SWIPE_DIR_TOLERANCE = (60 * Math.PI) / 180; // ±60°

// dir が指定されていなければどの向きでもOK
export function swipeMatchesDir(dx: number, dy: number, dir?: 'up' | 'down' | 'left' | 'right'): boolean {
  if (!dir) return true;
  if (dx === 0 && dy === 0) return false;
  const moveAngle = Math.atan2(dy, dx);
  const target = dirToAngle(dir);
  return Math.abs(angleDiff(moveAngle, target)) <= SWIPE_DIR_TOLERANCE;
}

export const TAP_MAX_MOVE_PX = 20;
export const TAP_MAX_MS = 400;
export const SWIPE_MIN_MOVE_PX = 60;

export function isTapMotion(dx: number, dy: number, elapsedMs: number): boolean {
  return Math.hypot(dx, dy) < TAP_MAX_MOVE_PX && elapsedMs < TAP_MAX_MS;
}

export function isSwipeMotion(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > SWIPE_MIN_MOVE_PX;
}

// 線分 ab 上で点 p に最も近い点を返す (0<=t<=1 にクランプ)
export function nearestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return { point: { x: a.x, y: a.y }, t: 0 };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = clamp(t, 0, 1);
  return { point: { x: a.x + abx * t, y: a.y + aby * t }, t };
}

export interface PathNearest {
  point: Vec2;
  distance: number;
  // 経路の始点からの累積弧長 (0..totalLength)
  arcLength: number;
  totalLength: number;
}

export function pathTotalLength(path: Vec2[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += dist(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
  }
  return total;
}

// 折れ線 path 上で point に最も近い点・そこまでの累積弧長を求める。
// path が1点以下なら距離無限大扱い。
export function nearestPointOnPath(point: Vec2, path: Vec2[]): PathNearest {
  const totalLength = pathTotalLength(path);
  if (path.length === 0) {
    return { point: { x: point.x, y: point.y }, distance: Infinity, arcLength: 0, totalLength: 0 };
  }
  if (path.length === 1) {
    return { point: path[0], distance: dist(point.x, point.y, path[0].x, path[0].y), arcLength: 0, totalLength: 0 };
  }

  let best: PathNearest = {
    point: path[0],
    distance: Infinity,
    arcLength: 0,
    totalLength
  };
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const segLen = dist(a.x, a.y, b.x, b.y);
    const { point: near, t } = nearestPointOnSegment(point, a, b);
    const d = dist(point.x, point.y, near.x, near.y);
    if (d < best.distance) {
      best = { point: near, distance: d, arcLength: acc + segLen * t, totalLength };
    }
    acc += segLen;
  }
  return best;
}

export const TRACE_FOLLOW_PX = 60; // これ以内なら進捗前進
export const TRACE_HOLD_PX = 120; // これを超えても失敗にせずホールド (実質どこまで離れても失敗にはしない)

// 経路進捗の更新: 後退はしない。60px 以内のときだけ前進を許可。
export function advanceTraceProgress(currentT: number, near: PathNearest): number {
  if (near.totalLength <= 0) return currentT;
  if (near.distance > TRACE_FOLLOW_PX) return currentT; // ホールド(前進も後退もしない)
  const candidateT = clamp(near.arcLength / near.totalLength, 0, 1);
  return Math.max(currentT, candidateT);
}

export const RUB_DISTANCE_FOR_T1 = 300; // これくらい往復させれば t=1

export function rubDistanceToT(cumulativeDistance: number): number {
  return clamp(cumulativeDistance / RUB_DISTANCE_FOR_T1, 0, 1);
}

// 円ジェスチャー: 中心から見た角度の差分 (delta) を返す。t 蓄積は呼び出し側で delta/(2*PI) を足しこむ。
export function crankDelta(prevAngle: number, curAngle: number): number {
  return angleDiff(curAngle, prevAngle);
}

export function angleFromCenter(center: Vec2, p: Vec2): number {
  return Math.atan2(p.y - center.y, p.x - center.x);
}

// --- ホットスポット選定 (エンゲージ判定) 用の汎用ヘルパー ---
// 「候補の中から最も近い1つ」を選ぶための比較専用の軽量ヘルパー。
export interface EngageCandidate<T> {
  item: T;
  distance: number;
}

export function pickNearest<T>(candidates: EngageCandidate<T>[]): T | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].distance < best.distance) best = candidates[i];
  }
  return best.item;
}

// --- drag の磁石スナップ ---
export const DRAG_SNAP_PX = 150; // この距離以内なら磁石スナップ成功
export const DRAG_MAGNET_PULL_PX = 220; // 見た目の吸い寄せ補間を開始する距離

// スナップ吸着の見た目補間: drop に近いほど強く引き寄せる (0..1 の係数)。
// distance>=DRAG_MAGNET_PULL_PX で 0 (補間なし=生の指位置), distance<=0 で 1 (完全に drop に一致)。
export function magnetPullFactor(distanceToDrop: number): number {
  if (!isFinite(distanceToDrop)) return 0;
  const t = 1 - clamp(distanceToDrop / DRAG_MAGNET_PULL_PX, 0, 1);
  // 2乗イージングで、近づくほど急激に吸い付く感覚を出す
  return t * t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
