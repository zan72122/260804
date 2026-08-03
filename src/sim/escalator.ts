// src/sim/escalator.ts
// 所有: A2 (sim/render)。これは A1 が用意した最小スタブ実装。
// 幾何仕様 (CONTRACT.md ワールド座標系): 傾斜30°、水平投影長520、階高300、ステップ奥行40。
// A2 が実際のカーブ(ターンアラウンド)や滑らかな踏段配置に置き換えること。

import type { EscalatorModel, PathPoint } from '../core/types';

const INCLINE_DX = 520;
const INCLINE_DY = 300; // 階高 (y- が上なので実際の変位は -INCLINE_DY)
const DEPTH = 40; // ステップ奥行(ここでは往路/復路のオフセット量として簡易利用)

const inclineLen = Math.hypot(INCLINE_DX, INCLINE_DY);
const ux = INCLINE_DX / inclineLen;
const uy = -INCLINE_DY / inclineLen; // 上に行くほど y は減る
// u に直交するベクトル(復路側=機械内部方向へのオフセット)
const px = -uy;
const py = ux;

const P0 = { x: 0, y: 0 };
const P1 = { x: P0.x + ux * inclineLen, y: P0.y + uy * inclineLen };
const P2 = { x: P1.x + px * DEPTH, y: P1.y + py * DEPTH };
const P3 = { x: P0.x + px * DEPTH, y: P0.y + py * DEPTH };

const turnLen = Math.hypot(P2.x - P1.x, P2.y - P1.y) || 1;

const segLens = {
  incline: inclineLen,
  topTurn: turnLen,
  return: inclineLen,
  bottomTurn: turnLen
};
const totalLen = segLens.incline + segLens.topTurn + segLens.return + segLens.bottomTurn;

const T0 = 0;
const T1 = segLens.incline / totalLen;
const T2 = T1 + segLens.topTurn / totalLen;
const T3 = T2 + segLens.return / totalLen;
const T4 = 1;

function lerpPoint(a: { x: number; y: number }, b: { x: number; y: number }, u: number) {
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

function angleOf(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function rawPathPoint(tIn: number): PathPoint {
  let t = tIn % 1;
  if (t < 0) t += 1;

  if (t < T1) {
    const u = (t - T0) / (T1 - T0);
    const p = lerpPoint(P0, P1, u);
    return { x: p.x, y: p.y, angle: angleOf(P0, P1), segment: 'incline' };
  }
  if (t < T2) {
    const u = (t - T1) / (T2 - T1);
    const p = lerpPoint(P1, P2, u);
    return { x: p.x, y: p.y, angle: angleOf(P1, P2), segment: 'topTurn' };
  }
  if (t < T3) {
    const u = (t - T2) / (T3 - T2);
    const p = lerpPoint(P2, P3, u);
    return { x: p.x, y: p.y, angle: angleOf(P2, P3), segment: 'return' };
  }
  const u = (t - T3) / (T4 - T3);
  const p = lerpPoint(P3, P0, u);
  return { x: p.x, y: p.y, angle: angleOf(P3, P0), segment: 'bottomTurn' };
}

const HANDRAIL_OFFSET = -20; // 踏段面より外側(手前)にオフセット

class EscalatorModelImpl implements EscalatorModel {
  loopT = 0;
  speed = 0.08;
  targetSpeed = 0.08;
  stepCount = 14;
  removedStep: number | null = null;
  wobbleAmp = 0;

  pathPoint(t: number): PathPoint {
    return rawPathPoint(t);
  }

  stepT(i: number): number {
    let t = this.loopT + i / this.stepCount;
    t = t % 1;
    if (t < 0) t += 1;
    return t;
  }

  handrailPoint(t: number): PathPoint {
    const base = rawPathPoint(t);
    return {
      x: base.x + px * HANDRAIL_OFFSET,
      y: base.y + py * HANDRAIL_OFFSET,
      angle: base.angle,
      segment: base.segment
    };
  }

  update(dt: number): void {
    const diff = this.targetSpeed - this.speed;
    this.speed += diff * Math.min(1, dt * 4);
    this.loopT = (this.loopT + this.speed * dt) % 1;
    if (this.loopT < 0) this.loopT += 1;
  }

  crank(delta: number): void {
    this.loopT = (this.loopT + delta / (Math.PI * 2)) % 1;
    if (this.loopT < 0) this.loopT += 1;
  }
}

export function createEscalator(): EscalatorModel {
  return new EscalatorModelImpl();
}
