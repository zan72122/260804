// 筐体の「形」だけを扱う共有部分。描画にも物理にも、
// ヘッドレスの挙動テストにも同じ数値を使わせるため、ここに一本化する。

import { Vector3, Quaternion } from '../vendor/three.module.js';
import { BAR, BAR_LENGTH, CAB, PRIZE, PRIZE_START_Z, SLOT_X, SLOT_Y, TRAY } from './config.js';

const X_AXIS = new Vector3(1, 0, 0);
const Z_AXIS = new Vector3(0, 0, 1);

export function makeBarState() {
  return { placed: false, side: 0, front: { xi: 1, yi: 1 }, back: { xi: 1, yi: 1 } };
}

// バーの両端（置かれていなければ工具台の上）
export function barEnds(bar, trayIndex, a = new Vector3(), b = new Vector3()) {
  if (bar.placed) {
    a.set(bar.side * SLOT_X[bar.front.xi], SLOT_Y[bar.front.yi], BAR.z0);
    b.set(bar.side * SLOT_X[bar.back.xi], SLOT_Y[bar.back.yi], BAR.z1);
  } else {
    a.set(-BAR_LENGTH / 2, TRAY.y + 0.020, TRAY.z[trayIndex]);
    b.set(BAR_LENGTH / 2, TRAY.y + 0.020, TRAY.z[trayIndex]);
  }
  return { a, b };
}

// ある z におけるバー上面（景品が乗る線）
export function barTopAt(bar, z) {
  const t = Math.max(0, Math.min(1, (z - BAR.z0) / (BAR.z1 - BAR.z0)));
  const x = bar.side * (SLOT_X[bar.front.xi] + (SLOT_X[bar.back.xi] - SLOT_X[bar.front.xi]) * t);
  const y = SLOT_Y[bar.front.yi] + (SLOT_Y[bar.back.yi] - SLOT_Y[bar.front.yi]) * t;
  return { x, y: y + BAR.radius, slope: (SLOT_Y[bar.back.yi] - SLOT_Y[bar.front.yi]) / (BAR.z1 - BAR.z0) };
}

// 二本のバーに載せた「スタート姿勢」。毎回ここから始めるので前回と比べられる。
export function startPose(bars, prize) {
  const li = bars[0].side < 0 ? 0 : 1;
  const L = barTopAt(bars[li], PRIZE_START_Z);
  const R = barTopAt(bars[1 - li], PRIZE_START_Z);
  const roll = Math.atan2(R.y - L.y, R.x - L.x);
  const pitch = -Math.atan((L.slope + R.slope) / 2);
  const quat = new Quaternion().setFromAxisAngle(Z_AXIS, roll)
    .multiply(new Quaternion().setFromAxisAngle(X_AXIS, pitch));
  const half = prize.kind === 'capsule' ? PRIZE.capsule.radius : PRIZE.box.hy;
  const up = new Vector3(0, 1, 0).applyQuaternion(quat);
  const center = new Vector3((L.x + R.x) / 2, (L.y + R.y) / 2, PRIZE_START_Z)
    .addScaledVector(up, half + 0.0015);
  const com = center.sub(new Vector3().copy(prize.shapeOffset).applyQuaternion(quat));
  return { com, quat };
}

// 筐体の固定面（斜面・シュート・壁）
export function addStaticSurfaces(world) {
  const v = new Vector3(0, CAB.rampNearY - CAB.rampFarY, CAB.rampNearZ - CAB.farZ);
  const n = new Vector3(0, v.z, -v.y).normalize();
  const p0 = new Vector3(0, CAB.rampFarY, CAB.farZ);
  world.addPlane({
    n, d: p0.dot(n), mu: 0.08, tag: 'ramp',
    bounds: { z: [CAB.farZ - 0.05, CAB.rampNearZ] },
  });
  // シュートは斜面の続き（急）。段差を作らず必ず滑り落ちる。
  const cv = new Vector3(0, CAB.chuteY - CAB.rampNearY, CAB.chuteNearZ - CAB.rampNearZ);
  const cn = new Vector3(0, cv.z, -cv.y).normalize();
  const c0 = new Vector3(0, CAB.rampNearY, CAB.rampNearZ);
  world.addPlane({
    n: cn, d: c0.dot(cn), mu: 0.10, tag: 'chute',
    bounds: { z: [CAB.rampNearZ - 0.002, CAB.chuteNearZ + 0.02] },
  });
  world.addPlane({ n: new Vector3(0, 0, -1), d: -(CAB.chuteNearZ - 0.008), mu: 0.4, tag: 'wall' });
  world.addPlane({ n: new Vector3(1, 0, 0), d: -CAB.hx, mu: 0.3, tag: 'wall' });
  world.addPlane({ n: new Vector3(-1, 0, 0), d: -CAB.hx, mu: 0.3, tag: 'wall' });
  world.addPlane({ n: new Vector3(0, 0, 1), d: CAB.farZ + 0.006, mu: 0.3, tag: 'wall' });
  // 手前のソケット盤。バーの上にある景品だけを止める（落ちた景品は下を通ってシュートへ）
  world.addPlane({
    n: new Vector3(0, 0, -1), d: -(CAB.nearZ - 0.006), mu: 0.3, tag: 'wall',
    bounds: { y: [0.205, CAB.topY] }, minComY: SLOT_Y[0] - 0.05,
  });
}

// シュートに入ったか
// 斜面を過ぎて、バーよりずっと下にある = シュートに入った
export function inChute(pos) {
  return pos.z > CAB.rampNearZ + 0.03 && pos.y < SLOT_Y[0] - 0.08;
}
