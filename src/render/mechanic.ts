// src/render/mechanic.ts
// 所有: A6 (character/ui) — 整備ロボット「レンチちゃん」
// 丸くて親しみやすいホバー型ロボ。歩行なし(浮遊)。CONTRACT の mechanic API を実装する。

import type { EscalatorModel, GameState } from '../core/types';
import { bus } from '../core/events';
import { layout } from '../core/layout';

interface Vec {
  x: number;
  y: number;
}

// ---- 見た目寸法(ワールド単位。escalator.ts の DEPTH=40 等と同スケール感) ----
const HEAD_R = 27;
const HEAD_Y = -60;
const BODY_W = 46;
const BODY_H = 52;
const BODY_TOP = -44;
const ARM_LEN = 30;
const POINT_ARM_LEN = 46;

// ---- 画面内クランプ用の(スケール1における)ロボの概算バウンディング ----
// 原点(translate 基準点、ホバー光輪の高さ)からの上下左右の張り出し。
// 指差し・万歳・工具振り等、最大まで腕が伸びた状態でも収まるよう余裕を持たせてある。
const NOMINAL_HALF_W = 80;
const NOMINAL_TOP_EXT = 105; // アンテナ+頭 上端
const NOMINAL_BOTTOM_EXT = 42; // 胴体下端+ホバー光輪
const NOMINAL_HEIGHT = NOMINAL_TOP_EXT + NOMINAL_BOTTOM_EXT;

// ロボの画面上サイズ(可視ワールド矩形の高さに対する割合)。フェーズごとに微調整:
// 作業系フェーズはやや小さめ(操作対象を隠しすぎない)、celebrateは豪華に大きく。
const SIZE_FRACTION_DEFAULT = 0.3;
const SIZE_FRACTION_WORK = 0.24;
const SIZE_FRACTION_CELEBRATE = 0.34;

const MOVE_RATE = 4.5; // 立ち位置追従の速さ(フェーズ切替直後もすぐ画面内へ追いつくよう高め)
const LOOK_RATE = 9; // 視線の滑らかさ
const TURN_RATE = 8; // 体の向き(bodyTurn)の滑らかさ
const POINT_DURATION = 3; // pointAt の持続秒数(CONTRACT: 3秒で解除)

// ---- 内部状態(ロボは常に1体なのでモジュール単一インスタンス) ----
const pos: Vec = { x: -420, y: 70 };
let velX = 0;
let velY = 0;
let blinkTimer = 2.2;
let blinking = false;
let blinkT = 0;
let pointTarget: Vec | null = null;
let pointTimer = 0;
let lookX = 0;
let lookY = 0;
let faceAngle = 0; // 視線先への角度(atan2)。repair時の工具指向・体の向きに使う
let bodyTurn = 0; // 体を目標方向へ向ける回転量(平滑化済み)

function setPointTarget(x: number, y: number) {
  pointTarget = { x, y };
  pointTimer = POINT_DURATION;
}

// hint イベント購読: pointAt と同じ挙動(視線+指差し)。A5 が bus.emit('hint',{x,y}) する。
bus.on('hint', (e) => setPointTarget(e.x, e.y));

function offsetSide(p: { x: number; y: number; angle: number }, dist: number): Vec {
  const nx = Math.cos(p.angle + Math.PI / 2);
  const ny = Math.sin(p.angle + Math.PI / 2);
  return { x: p.x + nx * dist, y: p.y + ny * dist };
}

// ---- 可視ワールド矩形(layout.camera から毎フレーム導出) ----
interface Rect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function visibleWorldRect(): Rect {
  const { w, h, camera } = layout;
  const halfW = w / 2 / camera.scale;
  const halfH = h / 2 / camera.scale;
  return {
    minX: camera.cx - halfW,
    maxX: camera.cx + halfW,
    minY: camera.cy - halfH,
    maxY: camera.cy + halfH
  };
}

function sizeFractionFor(state: GameState): number {
  switch (state.phase) {
    case 'celebrate':
      return SIZE_FRACTION_CELEBRATE;
    case 'inspect':
    case 'repair':
    case 'crankCheck':
    case 'restoreStep':
      return SIZE_FRACTION_WORK;
    default:
      return SIZE_FRACTION_DEFAULT;
  }
}

// ロボの世界座標上の描画スケール。可視矩形の高さ(ワールド単位)の 1/4〜1/3 が
// 画面上の高さになるよう、カメラの scale に反比例させる(どれだけズームしても
// 画面上の見かけサイズは一定割合を保つ)。
// 注意(A7統合修正): 可視矩形の「高さ」だけを基準にすると、カメラのフレーミング対象が
// 横長(例: exterior の notice/celebrate 額装は幅648×高さ300程度)なのに画面が縦長
// (iPhone縦: 390×844)の場合、幅で律速されたカメラscaleのせいで可視矩形の高さが
// 極端に間延びし(例: 1688相当)、その割合でロボが不自然に巨大化してエスカレーター本体を
// 覆ってしまう(統括レビュー: 「notice/celebrateでロボがエスカレーターと重なる」)。
// 縦横どちらか短い方を基準にすることで、アスペクト比の不一致による暴走を防ぐ。
function computeDrawScale(state: GameState, rect: Rect): number {
  const worldRectW = rect.maxX - rect.minX;
  const worldRectH = rect.maxY - rect.minY;
  const worldRectBasis = Math.min(worldRectW, worldRectH);
  const fraction = sizeFractionFor(state);
  const targetWorldHeight = worldRectBasis * fraction;
  return Math.max(0.2, targetWorldHeight / NOMINAL_HEIGHT);
}

// 立ち位置を「必ず可視矩形内」へクランプする(ロボの見かけ上のバウンディングボックス分の余白を確保)
function clampToVisible(p: Vec, rect: Rect, drawScale: number): Vec {
  const halfW = NOMINAL_HALF_W * drawScale;
  const topExt = NOMINAL_TOP_EXT * drawScale;
  const botExt = NOMINAL_BOTTOM_EXT * drawScale;

  let minX = rect.minX + halfW;
  let maxX = rect.maxX - halfW;
  let x = p.x;
  if (minX <= maxX) x = Math.max(minX, Math.min(maxX, x));
  else x = (rect.minX + rect.maxX) / 2;

  let minY = rect.minY + topExt;
  let maxY = rect.maxY - botExt;
  let y = p.y;
  if (minY <= maxY) y = Math.max(minY, Math.min(maxY, y));
  else y = (rect.minY + rect.maxY) / 2;

  return { x, y };
}

// exterior(外観)フェーズ用の「床に立つ」立ち位置。
// 注意(A7統合修正): offsetSide(bottom, -N) のようにインクライン接線への垂直オフセットで
// 立ち位置を決めると、縦画面など可視矩形のアスペクト比が偏るケースで clampToVisible が
// x/y を軸ごとに独立して切り詰めてしまい、垂直オフセットの前提(常にインクラインから
// 一定の法線距離を保つ)が崩れてエスカレーター本体(トラス外周の太い帯)とロボが重なって
// 見えることがあった(統括レビュー: 「新しい外観カメラでロボがエスカレーター本体と重なる」)。
// 床レベル(y を大きめの一定値にする=画面下寄り)に固定してしまえば、トラス帯は
// 乗り口(A0)から右上へ登っていく一方なので、床レベルにいる限りどの視口でも
// 手前の空きスペースに収まる。
function frontFloorStand(model: EscalatorModel, xOffset: number, floorY: number): Vec {
  const bottom = model.pathPoint(0.02);
  return { x: bottom.x + xOffset, y: floorY };
}

// フェーズに応じた立ち位置(演出の要: 駆けつけ/覗き込み/作業対象の横 など)
function stagePos(state: GameState): Vec {
  if (state.phase === 'title') {
    return { x: -420, y: 70 }; // 舞台袖で待機(notice で駆けつけてくる演出の起点)
  }
  const model = state.escalator;

  switch (state.phase) {
    case 'inspect':
    case 'repair': {
      const t = state.fault ? state.fault.anchorT : 0.15;
      const p = model.pathPoint(t);
      return offsetSide(p, -78); // 作業対象の横
    }
    case 'testRun':
      return frontFloorStand(model, -170, 130); // 少し離れて床から見守る
    case 'celebrate':
    case 'select':
      return frontFloorStand(model, -30, 120); // お祝い: 乗り口手前の床でお出迎え
    default:
      return frontFloorStand(model, -90, 130); // notice/safety等: 乗り口手前左の床の空きへ
  }
}

// ---- 描画ヘルパ ----
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawWrench(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#aab3bf';
  ctx.strokeStyle = '#707986';
  ctx.lineWidth = 1.5 * scale;
  roundRectPath(ctx, -6 * scale, -3.2 * scale, 28 * scale, 6.4 * scale, 3 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(24 * scale, 0, 8 * scale, 0.85, Math.PI * 2 - 0.85);
  ctx.lineWidth = 5 * scale;
  ctx.strokeStyle = '#aab3bf';
  ctx.stroke();
  ctx.restore();
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  angle: number,
  len: number,
  color: string
): Vec {
  const ex = ax + Math.cos(angle) * len;
  const ey = ay + Math.sin(angle) * len;
  ctx.strokeStyle = color;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(ax, ay, 6, 0, Math.PI * 2);
  ctx.fill();
  return { x: ex, y: ey };
}

type EyeMode = 'normal' | 'happy' | 'surprised';

function drawEye(
  ctx: CanvasRenderingContext2D,
  ex: number,
  ey: number,
  r: number,
  px: number,
  py: number,
  mode: EyeMode
) {
  if (mode === 'happy') {
    // celebrate: にこにこ(＞▽＜)な弧目
    ctx.beginPath();
    ctx.moveTo(ex - r, ey + r * 0.2);
    ctx.quadraticCurveTo(ex, ey - r * 1.1, ex + r, ey + r * 0.2);
    ctx.lineWidth = r * 0.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a2b23';
    ctx.stroke();
    return;
  }
  const surprised = mode === 'surprised';
  const rr = surprised ? r * 1.3 : r;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(ex, ey, rr, rr * (surprised ? 1.2 : 1.08), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = surprised ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.08)';
  ctx.lineWidth = surprised ? 1.4 : 1;
  ctx.stroke();
  const pr = rr * (surprised ? 0.58 : 0.52);
  const clampR = rr * 0.38;
  const dist = Math.min(clampR, Math.hypot(px, py));
  const a = Math.atan2(py, px);
  const pxC = Math.cos(a) * dist;
  const pyC = Math.sin(a) * dist;
  ctx.fillStyle = '#3a2b23';
  ctx.beginPath();
  ctx.arc(ex + pxC, ey + pyC, pr, 0, Math.PI * 2);
  ctx.fill();
  // ハイライト(生命感)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ex + pxC - pr * 0.35, ey + pyC - pr * 0.35, pr * 0.32, 0, Math.PI * 2);
  ctx.fill();
}

export const mechanic: {
  update(dt: number, state: GameState): void;
  render(ctx: CanvasRenderingContext2D, state: GameState): void;
  pointAt(x: number, y: number): void;
} = {
  update(dt: number, state: GameState) {
    const reduced = state.settings.reducedMotion;
    const rect = visibleWorldRect();
    const drawScale = computeDrawScale(state, rect);
    const desired = stagePos(state);
    const target = clampToVisible(desired, rect, drawScale);
    const k = 1 - Math.exp(-MOVE_RATE * dt);
    const nx = pos.x + (target.x - pos.x) * k;
    const ny = pos.y + (target.y - pos.y) * k;
    const safeDt = Math.max(dt, 1 / 240);
    velX = (nx - pos.x) / safeDt;
    velY = (ny - pos.y) / safeDt;
    pos.x = nx;
    pos.y = ny;

    // 瞬き
    if (blinking) {
      blinkT += dt;
      if (blinkT > 0.12) {
        blinking = false;
        blinkTimer = reduced ? 3.6 + Math.random() * 2.6 : 2.2 + Math.random() * 2.4;
      }
    } else {
      blinkTimer -= dt;
      if (blinkTimer <= 0) {
        blinking = true;
        blinkT = 0;
      }
    }

    // 指差し解除(3秒)
    if (pointTimer > 0) {
      pointTimer -= dt;
      if (pointTimer <= 0) pointTarget = null;
    }

    // 視線: pointAt優先 > 故障箇所 > 軽い左右アイドル
    let desiredX: number;
    let desiredY: number;
    if (pointTarget) {
      desiredX = pointTarget.x - pos.x;
      desiredY = pointTarget.y - pos.y;
    } else if ((state.phase === 'inspect' || state.phase === 'repair') && state.fault) {
      const p = state.escalator.pathPoint(state.fault.anchorT);
      desiredX = p.x - pos.x;
      desiredY = p.y - pos.y;
    } else {
      desiredX = Math.sin(state.time * 0.6) * 40;
      desiredY = 10;
    }
    const dlen = Math.hypot(desiredX, desiredY) || 1;
    const nlx = (desiredX / dlen) * 10;
    const nly = (desiredY / dlen) * 10;
    const lookK = 1 - Math.exp(-LOOK_RATE * dt);
    lookX += (nlx - lookX) * lookK;
    lookY += (nly - lookY) * lookK;

    // 体の向き: 指差し中、または repair 中は対象方向へ体ごと傾ける(要件6)
    faceAngle = Math.atan2(desiredY, desiredX);
    let turnTarget = 0;
    if (pointTarget) {
      turnTarget = Math.max(-0.4, Math.min(0.4, (desiredX / dlen) * 0.4));
    } else if (state.phase === 'repair' && state.fault) {
      turnTarget = Math.max(-0.32, Math.min(0.32, (desiredX / dlen) * 0.32));
    }
    const turnK = 1 - Math.exp(-TURN_RATE * dt);
    bodyTurn += (turnTarget - bodyTurn) * turnK;
  },

  render(ctx: CanvasRenderingContext2D, state: GameState) {
    if (state.phase === 'title') return; // タイトルでは登場しない

    const reduced = state.settings.reducedMotion;
    const isPointing = pointTimer > 0 && pointTarget !== null;
    const isCelebrate = state.phase === 'celebrate';
    const isSafety = state.phase === 'safety';
    const isInspect = state.phase === 'inspect';
    const isRepair = state.phase === 'repair';
    const isCrankCheck = state.phase === 'crankCheck';
    const isTestRun = state.phase === 'testRun';
    const isCheer = isInspect; // 故障を見つけて応援するポーズ(repairはコンコン作業モーションへ分離)
    const isPeek = state.phase === 'openPlate' || state.phase === 'removeStep';

    // ---- 画面内クランプ(常にこの位置で描画。update()の追従目標も同じ矩形を
    // 参照しているため通常は一致するが、フェーズ切替直後の一瞬もこれで保証する) ----
    const rect = visibleWorldRect();
    const drawScale = computeDrawScale(state, rect);
    const renderPos = clampToVisible(pos, rect, drawScale);

    const bobAmp = reduced ? 3 : 7;
    const bobSpeed = reduced ? 1.3 : 2.3;
    const bobY = Math.sin(state.time * bobSpeed) * bobAmp;

    const jumpSpeed = reduced ? 3 : 6.2;
    const jumpAmp = isCelebrate ? (reduced ? 7 : 24) : 0;
    const jumpY = isCelebrate ? -Math.abs(Math.sin(state.time * jumpSpeed)) * jumpAmp : 0;

    // crankCheck: 「ぐるん」に合わせて体が左右に揺れる(loopTの位相に連動)
    const crankWobble = isCrankCheck
      ? Math.sin(state.escalator.loopT * Math.PI * 8) * (reduced ? 0.05 : 0.16)
      : 0;

    const bankRaw = Math.max(-1, Math.min(1, velX * 0.0016));
    const bank = isPointing ? 0 : bankRaw * (reduced ? 0.3 : 1);
    const peekLean = isPeek ? 0.22 : 0;
    const turnApplied = reduced ? bodyTurn * 0.4 : bodyTurn;

    ctx.save();
    ctx.translate(renderPos.x, renderPos.y);
    ctx.rotate(bank * 0.5 + turnApplied + crankWobble);
    ctx.scale(drawScale, drawScale);
    ctx.translate(0, bobY + jumpY);

    // ホバーの光輪(足の代わり)
    const hoverPulse = reduced ? 0.5 : 0.45 + Math.sin(state.time * 3) * 0.15;
    const hg = ctx.createRadialGradient(0, 14, 2, 0, 14, 30);
    hg.addColorStop(0, `rgba(255,180,210,${0.5 * hoverPulse})`);
    hg.addColorStop(1, 'rgba(255,180,210,0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(0, 16, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(peekLean);
    if (isPeek) ctx.translate(0, 8);

    // ---- 腕(体より先に描いて肩の付け根が体で隠れるように) ----
    const armSway = Math.sin(state.time * (reduced ? 1.4 : 2.6)) * (reduced ? 0.05 : 0.14);
    let leftAngle = Math.PI / 2 + 0.55 + armSway;
    let rightAngle = Math.PI / 2 - 0.55 - armSway;
    let rightLen = ARM_LEN;

    if (isCelebrate) {
      // 万歳ジャンプ
      const raise = Math.sin(state.time * jumpSpeed) * 0.15;
      leftAngle = -Math.PI / 2 - 0.5 + raise;
      rightAngle = -Math.PI / 2 + 0.5 - raise;
    } else if (isSafety) {
      // 柵設置を手伝う仕草(押し込む動き)
      const push = Math.max(0, Math.sin(state.time * 3.2)) * 0.5;
      leftAngle = Math.PI / 2 + 0.15 + push;
    } else if (isCheer) {
      // 応援ポーズ
      const pump = Math.sin(state.time * (reduced ? 1.6 : 3.4)) * 0.18;
      leftAngle = -Math.PI / 2 - 0.35 + pump;
      rightAngle = -Math.PI / 2 + 0.35 - pump;
    } else if (isRepair) {
      // 工具を持ってコンコン作業(対象へ向いた方向へ腕を振る)
      const knockRate = reduced ? 3.2 : 6.5;
      const knock = Math.max(0, Math.sin(state.time * knockRate));
      leftAngle = Math.PI / 2 + 0.3;
      rightAngle = faceAngle;
      rightLen = ARM_LEN + knock * (reduced ? 5 : 15);
    } else if (isTestRun) {
      // 敬礼ポーズで試運転を見守る
      leftAngle = Math.PI / 2 + 0.35;
      rightAngle = -Math.PI / 2 - 0.3 + Math.sin(state.time * 1.6) * 0.04;
      rightLen = ARM_LEN * 0.78;
    }

    if (isPointing && pointTarget) {
      rightAngle = Math.atan2(pointTarget.y - pos.y, pointTarget.x - pos.x);
      rightLen = POINT_ARM_LEN;
    }

    const leftAnchor = { x: -BODY_W / 2 - 2, y: BODY_TOP + 18 };
    const rightAnchor = { x: BODY_W / 2 + 2, y: BODY_TOP + 18 };
    drawArm(ctx, leftAnchor.x, leftAnchor.y, leftAngle, ARM_LEN, '#f7a8c9');
    const rightEnd = drawArm(ctx, rightAnchor.x, rightAnchor.y, rightAngle, rightLen, '#f7a8c9');
    drawWrench(ctx, rightEnd.x, rightEnd.y, rightAngle, isPointing || isRepair ? 1.05 : 0.9);

    // ---- 胴体(つなぎ: ピンク→ラベンダー グラデ + 星ワッペン) ----
    const bodyGrad = ctx.createLinearGradient(-BODY_W / 2, BODY_TOP, BODY_W / 2, BODY_TOP + BODY_H);
    bodyGrad.addColorStop(0, '#ffc7dd');
    bodyGrad.addColorStop(1, '#e6b8ff');
    roundRectPath(ctx, -BODY_W / 2, BODY_TOP, BODY_W, BODY_H, 18);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff3b0';
    starPath(ctx, 0, BODY_TOP + BODY_H * 0.42, 8, 3.4);
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // ---- 頭 ----
    ctx.save();
    ctx.translate(0, HEAD_Y);

    // アンテナ+点滅ライト
    ctx.strokeStyle = '#c9b6ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -HEAD_R);
    ctx.lineTo(0, -HEAD_R - 12);
    ctx.stroke();
    const blip = 0.5 + Math.abs(Math.sin(state.time * 4)) * 0.5;
    ctx.fillStyle = `rgba(255,143,171,${0.5 + blip * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, -HEAD_R - 14, 3.6, 0, Math.PI * 2);
    ctx.fill();

    // 頭部本体
    ctx.fillStyle = '#fff6ec';
    ctx.beginPath();
    ctx.arc(0, 0, HEAD_R, 0, Math.PI * 2);
    ctx.fill();

    // ほっぺ
    ctx.fillStyle = 'rgba(255,150,170,0.55)';
    ctx.beginPath();
    ctx.ellipse(-HEAD_R * 0.62, HEAD_R * 0.28, 5.5, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(HEAD_R * 0.62, HEAD_R * 0.28, 5.5, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 目(視線が動く+瞬き+フェーズ連動の表情差分: 通常/にこ/びっくり)
    const eyeMode: EyeMode = isCelebrate
      ? 'happy'
      : state.phase === 'notice' || state.phase === 'openPlate'
        ? 'surprised'
        : 'normal';
    const eyeR = HEAD_R * 0.34;
    const eyeY = -HEAD_R * 0.05;
    const eyeSpacing = HEAD_R * 0.5;
    const eyeCloseT = blinking ? Math.max(0, 1 - blinkT / 0.12) : 1;
    if (eyeMode !== 'happy') {
      ctx.save();
      ctx.translate(-eyeSpacing, eyeY);
      ctx.scale(1, Math.max(0.06, eyeCloseT));
      drawEye(ctx, 0, 0, eyeR, lookX, lookY, eyeMode);
      ctx.restore();
      ctx.save();
      ctx.translate(eyeSpacing, eyeY);
      ctx.scale(1, Math.max(0.06, eyeCloseT));
      drawEye(ctx, 0, 0, eyeR, lookX, lookY, eyeMode);
      ctx.restore();
    } else {
      drawEye(ctx, -eyeSpacing, eyeY, eyeR, 0, 0, 'happy');
      drawEye(ctx, eyeSpacing, eyeY, eyeR, 0, 0, 'happy');
    }

    // 口
    ctx.strokeStyle = '#c98a63';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const mouthW = isCelebrate ? HEAD_R * 0.34 : HEAD_R * 0.22;
    ctx.moveTo(-mouthW, HEAD_R * 0.42);
    ctx.quadraticCurveTo(0, HEAD_R * 0.42 + mouthW * (isCelebrate ? 1.1 : 0.7), mouthW, HEAD_R * 0.42);
    ctx.stroke();

    // ヘルメット(半透明ドーム+リム)
    ctx.beginPath();
    ctx.ellipse(0, -HEAD_R * 0.12, HEAD_R * 1.04, HEAD_R * 0.82, 0, Math.PI, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,230,255,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-HEAD_R * 0.35, -HEAD_R * 0.55, HEAD_R * 0.28, HEAD_R * 0.14, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, HEAD_R * 0.02, HEAD_R * 1.05, HEAD_R * 0.2, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#c9b6ff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore(); // 頭
    ctx.restore(); // ロボ全体
  },

  pointAt(x: number, y: number) {
    setPointTarget(x, y);
  }
};
