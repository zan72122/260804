// src/sim/escalator.ts
// 所有: A2 (sim/render)。
//
// 幾何仕様 (CONTRACT.md ワールド座標系):
// 傾斜30°、水平投影長520、階高300、下端・上端に水平助走部(各~100)と
// 丸い折り返し(turnaround、半径~55の半円)。ステップ奥行40。
//
// 実装方針:
// 「インクライン(登り直線) + 上部水平助走」と「リターン(下り直線) + 下部水平助走」を
// 平行な2本の直線として構成し、両端を半径55の半円(ターンアラウンド)でつなぐ
// 「角丸スタジアム(オーバル)」形状にする。この構成だと:
//  - インクラインとリターンが常に平行 → 側面断面図で「1本の輪」であることが一目で分かる
//  - 水平助走部はターンアラウンドの直前/直後の直線区間として自然に配置される
//  - 半円の始点/終点の接線方向が厳密にインクライン方向(u)/リターン方向(-u)と一致するため
//    継ぎ目に不連続な折れが出ない(なめらかな輪)
//
// pathPoint(t) は弧長(区分ごとの実長)で按分した弧長パラメータ化。
// segment は 'incline' → 'topTurn'(水平助走+半円) → 'return' → 'bottomTurn'(水平助走+半円) の順。

import type { EscalatorModel, PathPoint } from '../core/types';

// ---- 幾何定数 -------------------------------------------------------------

export const INCLINE_DX = 520; // 水平投影長
export const INCLINE_DY = -300; // 階高(y-が上なので負)
export const RUNIN = 100; // 水平助走部の長さ(各端)
export const RADIUS = 55; // ターンアラウンド半径
export const STEP_COUNT = 14;
export const STEP_DEPTH = 40; // ステップ奥行

const INCLINE_LEN = Math.hypot(INCLINE_DX, INCLINE_DY);

// u: インクライン方向(上り)単位ベクトル。n: uを+90°回転(下方向へ厚みを取る)。
const U = { x: INCLINE_DX / INCLINE_LEN, y: INCLINE_DY / INCLINE_LEN };
const N = { x: -U.y, y: U.x };
const ANGLE_U = Math.atan2(U.y, U.x); // インクライン進行角
const ANGLE_N = Math.atan2(N.y, N.x);

interface Vec2 {
  x: number;
  y: number;
}

function addScaled(p: Vec2, dir: Vec2, len: number): Vec2 {
  return { x: p.x + dir.x * len, y: p.y + dir.y * len };
}

function lerpPoint(a: Vec2, b: Vec2, u: number): Vec2 {
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

export interface LoopGeometry {
  radius: number;
  runin: number;
  inclineLen: number;
  totalLen: number;
  points: { A0: Vec2; A1: Vec2; B1: Vec2; C1: Vec2; D0: Vec2; E0: Vec2; Ctop: Vec2; Cbot: Vec2 };
  // t境界(セグメント切り替え位置)
  t: { T1: number; T1b: number; T2: number; T3: number; T3b: number };
}

// origin (=A0) を基準に、指定した半径・水平助走長でスタジアム状の輪ジオメトリを構築する。
function buildLoopGeometry(origin: Vec2, radius: number, runin: number): LoopGeometry {
  const thickness = radius * 2;
  const A0 = origin;
  const A1 = addScaled(A0, U, INCLINE_LEN);
  const B1 = addScaled(A1, U, runin);
  const C1 = addScaled(B1, N, thickness);
  const D0 = addScaled(C1, U, -INCLINE_LEN);
  const E0 = addScaled(D0, U, -runin);
  const Ctop = addScaled(B1, N, radius);
  const Cbot = addScaled(A0, N, radius);

  const Lincline = INCLINE_LEN;
  const Lflat = runin;
  const Larc = Math.PI * radius;
  const totalLen = 2 * Lincline + 2 * Lflat + 2 * Larc;

  const T1 = Lincline / totalLen;
  const T1b = T1 + Lflat / totalLen;
  const T2 = T1b + Larc / totalLen;
  const T3 = T2 + Lincline / totalLen;
  const T3b = T3 + Lflat / totalLen;

  return {
    radius,
    runin,
    inclineLen: Lincline,
    totalLen,
    points: { A0, A1, B1, C1, D0, E0, Ctop, Cbot },
    t: { T1, T1b, T2, T3, T3b }
  };
}

const MAIN_GEOM = buildLoopGeometry({ x: 0, y: 0 }, RADIUS, RUNIN);

// 手すりベルト: ステップ経路より少し大きい相似形の輪(外側にオフセット)。
const HANDRAIL_OFFSET = 40;
const HANDRAIL_GEOM = buildLoopGeometry(
  addScaled({ x: 0, y: 0 }, N, -HANDRAIL_OFFSET),
  RADIUS + HANDRAIL_OFFSET,
  RUNIN
);

// 他モジュール(scene.ts / 将来的にA5)が参照できるジオメトリ情報。CONTRACT外の追加公開だが
// ファイル所有権はA2のため問題なし。座標一覧はレポートに記載。
export const ESC_GEOM = {
  u: U,
  n: N,
  angleU: ANGLE_U,
  angleN: ANGLE_N,
  main: MAIN_GEOM,
  handrail: HANDRAIL_GEOM
};

function rawPointOnGeometry(tIn: number, geom: LoopGeometry): PathPoint {
  let t = tIn % 1;
  if (t < 0) t += 1;
  const { A0, A1, B1, C1, D0, E0, Ctop, Cbot } = geom.points;
  const { T1, T1b, T2, T3, T3b } = geom.t;
  const r = geom.radius;

  if (t < T1) {
    const u = t / T1;
    const p = lerpPoint(A0, A1, u);
    return { x: p.x, y: p.y, angle: ANGLE_U, segment: 'incline' };
  }
  if (t < T1b) {
    const u = (t - T1) / (T1b - T1);
    const p = lerpPoint(A1, B1, u);
    return { x: p.x, y: p.y, angle: ANGLE_U, segment: 'topTurn' };
  }
  if (t < T2) {
    const u = (t - T1b) / (T2 - T1b);
    const theta = ANGLE_N + Math.PI + u * Math.PI;
    const p = { x: Ctop.x + r * Math.cos(theta), y: Ctop.y + r * Math.sin(theta) };
    return { x: p.x, y: p.y, angle: theta + Math.PI / 2, segment: 'topTurn' };
  }
  if (t < T3) {
    const u = (t - T2) / (T3 - T2);
    const p = lerpPoint(C1, D0, u);
    return { x: p.x, y: p.y, angle: ANGLE_U + Math.PI, segment: 'return' };
  }
  if (t < T3b) {
    const u = (t - T3) / (T3b - T3);
    const p = lerpPoint(D0, E0, u);
    return { x: p.x, y: p.y, angle: ANGLE_U + Math.PI, segment: 'bottomTurn' };
  }
  const u = (t - T3b) / (1 - T3b);
  const theta = ANGLE_N + u * Math.PI;
  const p = { x: Cbot.x + r * Math.cos(theta), y: Cbot.y + r * Math.sin(theta) };
  return { x: p.x, y: p.y, angle: theta + Math.PI / 2, segment: 'bottomTurn' };
}

function wrap01(t: number): number {
  let v = t % 1;
  if (v < 0) v += 1;
  return v;
}

const SPEED_LERP_PER_SEC = 4;
const CRANK_GEAR = 0.05; // loopT(0..1)/rad: 1回転(2π)でおよそループの31%進む、気持ちよい重さ
const CRANK_DECAY_PER_SEC = 2.2; // 手を離した後の慣性減衰

class EscalatorModelImpl implements EscalatorModel {
  loopT = 0;
  speed = 0.05;
  targetSpeed = 0.05;
  stepCount = STEP_COUNT;
  removedStep: number | null = null;
  wobbleAmp = 0;

  private crankSpeed = 0; // クランクによる慣性成分(loopT/sec)
  private crankedThisFrame = false;

  pathPoint(t: number): PathPoint {
    return rawPointOnGeometry(t, MAIN_GEOM);
  }

  stepT(i: number): number {
    return wrap01(this.loopT + i / this.stepCount);
  }

  handrailPoint(t: number): PathPoint {
    return rawPointOnGeometry(t, HANDRAIL_GEOM);
  }

  update(dt: number): void {
    if (dt <= 0) return;

    // speed → targetSpeed へ滑らか追従
    const k = 1 - Math.exp(-SPEED_LERP_PER_SEC * dt);
    this.speed += (this.targetSpeed - this.speed) * k;

    // クランクの慣性(手を離すと徐々に減衰)
    if (!this.crankedThisFrame) {
      this.crankSpeed *= Math.exp(-CRANK_DECAY_PER_SEC * dt);
      if (Math.abs(this.crankSpeed) < 0.0005) this.crankSpeed = 0;
    }
    this.crankedThisFrame = false;

    this.loopT = wrap01(this.loopT + (this.speed + this.crankSpeed) * dt);
  }

  crank(delta: number): void {
    const dLoopT = delta * CRANK_GEAR;
    this.loopT = wrap01(this.loopT + dLoopT);
    // 直近の回転速度をそのまま慣性成分として保持(次フレームからdecay)
    this.crankSpeed = dLoopT / (1 / 60);
    this.crankedThisFrame = true;
  }
}

export function createEscalator(): EscalatorModel {
  return new EscalatorModelImpl();
}
