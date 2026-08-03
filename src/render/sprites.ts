// ============================================================================
// 共有スプライト集 — ピン / ボール / 整備ロボット / 星エフェクト。
// render-machine と render-lane の双方から import される「顔」となるモジュール。
// パフォーマンス方針: 形状(Path2D)とグラデーションは「引数依存が薄いもの」を
// モジュールスコープでキャッシュし、毎フレームは translate/rotate/scale の
// アフィン変換だけで使い回す（座標をベイクしない）。
// ============================================================================

// ── 共通ユーティリティ ──────────────────────────────────────────────────
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ============================================================================
// drawPin — 本物のボウリングピン形状
// ローカル座標系: y=0 がピンの重心(x,yに渡される点)。上(頭)がマイナス、
// 下(底)がプラス。scale=1 で全高 96（geometry.PIN_SIZE.h と一致）。
// ============================================================================

const PIN_TOP_Y = -54;
const PIN_NECK_Y = -42;
const PIN_SHOULDER_Y = -20;
const PIN_WAIST_Y = 8;
const PIN_BASE_TOP_Y = 34;
const PIN_BOTTOM_Y = 42;

const PIN_R_CAP = 3;
const PIN_R_HEAD = 11;
const PIN_R_SHOULDER = 20;
const PIN_R_WAIST = 11;
const PIN_R_BASE = 26;

/** くびれのあるピンのシルエット（ベジェ）。1回だけ構築してキャッシュ。 */
const PIN_PATH: Path2D = (() => {
  const p = new Path2D();
  p.moveTo(0, PIN_TOP_Y);
  // 右側: 頭頂 → ネック(首・細)
  p.bezierCurveTo(PIN_R_CAP, PIN_TOP_Y, PIN_R_HEAD, PIN_TOP_Y + 6, PIN_R_HEAD, PIN_NECK_Y);
  // ネック → 肩(いちばん膨らむところ)
  p.bezierCurveTo(PIN_R_HEAD, PIN_NECK_Y + 8, PIN_R_SHOULDER, PIN_SHOULDER_Y - 10, PIN_R_SHOULDER, PIN_SHOULDER_Y);
  // 肩 → ウエスト(くびれ)
  p.bezierCurveTo(PIN_R_SHOULDER, PIN_SHOULDER_Y + 14, PIN_R_WAIST + 3, PIN_WAIST_Y - 10, PIN_R_WAIST, PIN_WAIST_Y);
  // ウエスト → 裾(台形に広がる)
  p.bezierCurveTo(PIN_R_WAIST, PIN_WAIST_Y + 10, PIN_R_BASE, PIN_BASE_TOP_Y - 6, PIN_R_BASE, PIN_BASE_TOP_Y);
  // 裾 → 底中心
  p.bezierCurveTo(PIN_R_BASE, PIN_BOTTOM_Y - 4, PIN_R_BASE * 0.55, PIN_BOTTOM_Y, 0, PIN_BOTTOM_Y);
  // 左側(鏡映)を戻る
  p.bezierCurveTo(-PIN_R_BASE * 0.55, PIN_BOTTOM_Y, -PIN_R_BASE, PIN_BOTTOM_Y - 4, -PIN_R_BASE, PIN_BASE_TOP_Y);
  p.bezierCurveTo(-PIN_R_BASE, PIN_BASE_TOP_Y - 6, -PIN_R_WAIST, PIN_WAIST_Y + 10, -PIN_R_WAIST, PIN_WAIST_Y);
  p.bezierCurveTo(-(PIN_R_WAIST + 3), PIN_WAIST_Y - 10, -PIN_R_SHOULDER, PIN_SHOULDER_Y + 14, -PIN_R_SHOULDER, PIN_SHOULDER_Y);
  p.bezierCurveTo(-PIN_R_SHOULDER, PIN_SHOULDER_Y - 10, -PIN_R_HEAD, PIN_NECK_Y + 8, -PIN_R_HEAD, PIN_NECK_Y);
  p.bezierCurveTo(-PIN_R_HEAD, PIN_TOP_Y + 6, -PIN_R_CAP, PIN_TOP_Y, 0, PIN_TOP_Y);
  p.closePath();
  return p;
})();

let pinShadeGrad: CanvasGradient | null = null;
function getPinShadeGrad(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (!pinShadeGrad) {
    const g = ctx.createLinearGradient(-PIN_R_BASE - 4, 0, PIN_R_BASE + 4, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.06)');
    g.addColorStop(0.62, 'rgba(35,28,24,0.05)');
    g.addColorStop(1, 'rgba(28,20,18,0.4)');
    pinShadeGrad = g;
  }
  return pinShadeGrad;
}

let pinHighlightGrad: CanvasGradient | null = null;
function getPinHighlightGrad(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (!pinHighlightGrad) {
    const g = ctx.createRadialGradient(-6, -44, 0, -6, -44, 16);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    pinHighlightGrad = g;
  }
  return pinHighlightGrad;
}

let pinShadowGrad: CanvasGradient | null = null;
function getPinShadowGrad(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (!pinShadowGrad) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(18,14,10,0.4)');
    g.addColorStop(1, 'rgba(18,14,10,0)');
    pinShadowGrad = g;
  }
  return pinShadowGrad;
}

function drawPinShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, scale: number): void {
  const h = 96 * scale;
  const rBase = PIN_R_BASE * scale;
  const lying = Math.abs(Math.sin(rot));
  const upright = 1 - lying;
  const w = rBase * 2.3 * upright + h * 0.86 * lying;
  const hh = rBase * 1.05 * upright + rBase * 1.2 * lying;
  const offY = h * 0.44 * upright;
  ctx.save();
  ctx.translate(x, y + offY);
  ctx.scale(Math.max(0.001, w / 2), Math.max(0.001, hh / 2));
  ctx.fillStyle = getPinShadowGrad(ctx);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 本物のボウリングピン。x,yはピンの重心。rot=0で直立(頭が上)。
 * scale=1でgeometry.PIN_SIZE(高さ96)に一致。
 */
export function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rot: number,
  scale: number,
  opts?: { ring?: string; shadow?: boolean; glow?: number },
): void {
  if (opts?.shadow) drawPinShadow(ctx, x, y, rot, scale);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);

  if (opts?.glow && opts.glow > 0) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,241,168,0.95)';
    ctx.shadowBlur = 20 * opts.glow;
    ctx.fillStyle = 'rgba(255,241,168,0.4)';
    ctx.fill(PIN_PATH);
    ctx.fill(PIN_PATH);
    ctx.restore();
  }

  ctx.save();
  ctx.clip(PIN_PATH);
  ctx.fillStyle = '#fbfaf6';
  ctx.fillRect(-32, -60, 64, 112);
  ctx.fillStyle = '#d81f39';
  ctx.fillRect(-32, PIN_SHOULDER_Y - 10, 64, 7);
  ctx.fillRect(-32, PIN_WAIST_Y - 21, 64, 7);
  if (opts?.ring) {
    ctx.fillStyle = opts.ring;
    ctx.fillRect(-32, PIN_NECK_Y - 6, 64, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-32, PIN_NECK_Y - 6, 64, 1.4);
  }
  ctx.fillStyle = getPinShadeGrad(ctx);
  ctx.fillRect(-32, -60, 64, 112);
  ctx.fillStyle = getPinHighlightGrad(ctx);
  ctx.beginPath();
  ctx.ellipse(-6, -44, 9, 15, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgba(50,40,35,0.32)';
  ctx.stroke(PIN_PATH);

  ctx.restore();
}

// ============================================================================
// drawBall — 大理石模様のハウスボール
// ============================================================================

const BALL_UNIT: Path2D = (() => {
  const p = new Path2D();
  p.arc(0, 0, 1, 0, Math.PI * 2);
  return p;
})();

const MARBLE_STREAKS: Path2D[] = (() => {
  const defs: Array<[number, number, number, number, number, number, number, number]> = [
    [-0.9, -0.5, -0.3, -0.9, 0.4, -0.7, 0.9, -0.15],
    [-0.82, 0.12, -0.2, 0.5, 0.32, 0.02, 0.85, 0.5],
    [-0.6, -0.12, 0.02, -0.42, 0.2, 0.3, 0.72, 0.85],
    [-0.88, 0.6, -0.4, 0.18, 0.5, 0.55, 0.9, -0.55],
  ];
  return defs.map(([sx, sy, c1x, c1y, c2x, c2y, ex, ey]) => {
    const p = new Path2D();
    p.moveTo(sx, sy);
    p.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
    return p;
  });
})();

let ballShadeGrad: CanvasGradient | null = null;
function getBallShadeGrad(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (!ballShadeGrad) {
    const g = ctx.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.15);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.04)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0.36)');
    ballShadeGrad = g;
  }
  return ballShadeGrad;
}

let ballHoleGrad: CanvasGradient | null = null;
function getBallHoleGrad(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (!ballHoleGrad) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, '#0a0806');
    g.addColorStop(0.7, '#1d1814');
    g.addColorStop(1, '#3c342c');
    ballHoleGrad = g;
  }
  return ballHoleGrad;
}

function drawBallHole(ctx: CanvasRenderingContext2D, hx: number, hy: number, hr: number): void {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.scale(hr, hr);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fillStyle = getBallHoleGrad(ctx);
  ctx.fill();
  ctx.restore();
}

/** 大理石模様のハウスボール。x,yは中心、rはワールド半径。 */
export function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(r, r);

  ctx.fillStyle = color;
  ctx.fill(BALL_UNIT);

  // 大理石の渦模様(色に依存しない半透明ストローク、overlay合成)
  ctx.save();
  ctx.clip(BALL_UNIT);
  ctx.globalCompositeOperation = 'overlay';
  ctx.lineCap = 'round';
  for (let i = 0; i < MARBLE_STREAKS.length; i++) {
    ctx.lineWidth = i % 2 === 0 ? 0.12 : 0.16;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)';
    ctx.stroke(MARBLE_STREAKS[i]);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // 球体シェーディング
  ctx.fillStyle = getBallShadeGrad(ctx);
  ctx.fill(BALL_UNIT);

  // 指穴3つ(回転と一緒に付いてくる)
  drawBallHole(ctx, 0.22, -0.4, 0.115);
  drawBallHole(ctx, 0.47, -0.06, 0.115);
  drawBallHole(ctx, 0.3, 0.22, 0.115);

  // ハイライト
  ctx.beginPath();
  ctx.ellipse(-0.4, -0.48, 0.22, 0.13, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();

  ctx.lineWidth = 0.02;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke(BALL_UNIT);

  ctx.restore();
}

// ============================================================================
// drawRobot — 親しみやすい丸型整備ロボット
// ローカル座標系: y=0 が接地点(足もと)。scale=1で身長 約140。
// ============================================================================

export type RobotPose = 'idle' | 'point' | 'work' | 'happy';

const ROBOT_BODY_PATH: Path2D = (() => {
  const p = new Path2D();
  p.moveTo(0, -92);
  p.bezierCurveTo(30, -92, 42, -70, 40, -52);
  p.bezierCurveTo(38, -32, 30, -20, 0, -18);
  p.bezierCurveTo(-30, -20, -38, -32, -40, -52);
  p.bezierCurveTo(-42, -70, -30, -92, 0, -92);
  p.closePath();
  return p;
})();

/** 手足の共通カプセル。ローカル(0,0)→(0,1)方向、幅0.34。translate/rotate/scaleで再利用。 */
const LIMB_PATH: Path2D = (() => {
  const w = 0.34;
  const p = new Path2D();
  p.moveTo(-w / 2, 0);
  p.bezierCurveTo(-w / 2, 0.5, -w * 0.6, 0.85, 0, 1);
  p.bezierCurveTo(w * 0.6, 0.85, w / 2, 0.5, w / 2, 0);
  p.closePath();
  return p;
})();

const FLOWER_PATH: Path2D = (() => {
  const p = new Path2D();
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5;
    const cx = Math.cos(a) * 0.9;
    const cy = Math.sin(a) * 0.9;
    p.moveTo(cx, cy);
    p.bezierCurveTo(cx + 0.5, cy - 0.5, cx - 0.5, cy - 0.5, 0, 0);
  }
  p.closePath();
  return p;
})();

let robotBodyGrad: CanvasGradient | null = null;
function getRobotBodyGrad(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (!robotBodyGrad) {
    const g = ctx.createLinearGradient(-42, -92, 42, -18);
    g.addColorStop(0, '#eaf9fb');
    g.addColorStop(0.5, '#bfe9ee');
    g.addColorStop(1, '#9ad3db');
    robotBodyGrad = g;
  }
  return robotBodyGrad;
}

let robotHeadGrad: CanvasGradient | null = null;
function getRobotHeadGrad(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (!robotHeadGrad) {
    const g = ctx.createRadialGradient(-10, -128, 4, 0, -118, 36);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, '#eaf6f8');
    g.addColorStop(1, '#c7e6ea');
    robotHeadGrad = g;
  }
  return robotHeadGrad;
}

function armRestAngle(side: 'left' | 'right', time: number): number {
  const base = side === 'left' ? -0.35 : 0.35;
  const sway = Math.sin(time * 1.2 + (side === 'left' ? 0 : 1.4)) * 0.1;
  return base + sway;
}

function drawLimb(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  angle: number,
  len: number,
  color: string,
): { tx: number; ty: number } {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  ctx.scale(len, len);
  ctx.fillStyle = color;
  ctx.fill(LIMB_PATH);
  ctx.beginPath();
  ctx.arc(0, 1, 0.26, 0, Math.PI * 2);
  ctx.fillStyle = '#f4fdfe';
  ctx.fill();
  ctx.restore();
  return { tx: sx - len * Math.sin(angle), ty: sy + len * Math.cos(angle) };
}

function drawWrenchAt(ctx: CanvasRenderingContext2D, tx: number, ty: number, angle: number, time: number): void {
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(angle + Math.sin(time * 20) * 0.12);
  ctx.fillStyle = '#7a8896';
  ctx.strokeStyle = '#4d5760';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-3, -14, 6, 26, 3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -14, 6, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();
}

function drawRobotEye(
  ctx: CanvasRenderingContext2D,
  ex: number,
  ey: number,
  pupilX: number,
  pupilY: number,
  closed: boolean,
  happy: boolean,
): void {
  if (closed) {
    ctx.beginPath();
    ctx.moveTo(ex - 7, ey);
    ctx.quadraticCurveTo(ex, ey + 4, ex + 7, ey);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#3a4750';
    ctx.lineCap = 'round';
    ctx.stroke();
    return;
  }
  if (happy) {
    ctx.beginPath();
    ctx.moveTo(ex - 7, ey + 2);
    ctx.quadraticCurveTo(ex, ey - 8, ex + 7, ey + 2);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#3a4750';
    ctx.lineCap = 'round';
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.arc(ex, ey, 8.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(60,70,80,0.4)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ex + pupilX, ey + pupilY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#3f6fae';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex + pupilX, ey + pupilY, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = '#182636';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex + pupilX - 1.6, ey + pupilY - 1.8, 1.1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
}

/**
 * 親しみやすい丸型整備ロボット。x,yは接地点。scale=1で身長約140。
 * lookX,lookYはロボットが見つめるワールド座標(省略時はゆったり周囲を眺める)。
 */
export function drawRobot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  pose: RobotPose,
  time: number,
  lookX?: number,
  lookY?: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const hop = pose === 'happy' ? -Math.abs(Math.sin(time * 6.2)) * 14 : 0;
  const bob = pose === 'idle' ? Math.sin(time * 1.6) * 3 : 0;
  const bodyOffset = hop + bob;

  // 接地影
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(0, 3, 34, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(0, bodyOffset);

  // 目線方向
  const lx = lookX ?? x + Math.sin(time * 0.5) * 50;
  const ly = lookY ?? y - 90;
  const ddx = lx - x;
  const ddy = ly - y;
  const dlen = Math.max(1, Math.hypot(ddx, ddy));
  const lookAngle = Math.atan2(ddy, ddx);
  const pupilOffX = (ddx / dlen) * 3.4;
  const pupilOffY = (ddy / dlen) * 3;

  // 脚
  drawLimb(ctx, -15, -18, 0.05, 20, '#8fbfc8');
  drawLimb(ctx, 15, -18, -0.05, 20, '#8fbfc8');

  // 左腕(奥側、先に描く)
  let leftAngle = armRestAngle('left', time);
  let rightAngle = armRestAngle('right', time);
  if (pose === 'point') {
    rightAngle = lookAngle - Math.PI / 2;
  } else if (pose === 'work') {
    leftAngle = 0.2 + Math.sin(time * 20) * 0.05;
    rightAngle = -0.2 - Math.sin(time * 20 + 1) * 0.05;
  } else if (pose === 'happy') {
    leftAngle = Math.PI - 0.55 + Math.sin(time * 8) * 0.12;
    rightAngle = Math.PI + 0.55 + Math.sin(time * 8 + 1) * 0.12;
  }
  const armLen = pose === 'point' ? 54 : 46;
  drawLimb(ctx, -38, -86, leftAngle, pose === 'point' ? 46 : armLen, '#a9dee4');

  // 胴体
  ctx.fillStyle = getRobotBodyGrad(ctx);
  ctx.fill(ROBOT_BODY_PATH);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(60,110,120,0.35)';
  ctx.stroke(ROBOT_BODY_PATH);

  // 胸の花模様(差し色)
  ctx.save();
  ctx.translate(0, -58);
  ctx.scale(9, 9);
  ctx.fillStyle = '#ff8fb8';
  ctx.fill(FLOWER_PATH);
  ctx.beginPath();
  ctx.arc(0, 0, 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd76b';
  ctx.fill();
  ctx.restore();

  // 工具ベルト
  ctx.fillStyle = '#3c4a5c';
  ctx.beginPath();
  ctx.roundRect(-34, -30, 68, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#8a97a6';
  ctx.beginPath();
  ctx.roundRect(-8, -33, 16, 6, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-22, -25, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd76b';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(20, -25, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ff8fb8';
  ctx.fill();

  const rightTip = drawLimb(ctx, 38, -86, rightAngle, pose === 'point' ? 54 : armLen, '#a9dee4');
  if (pose === 'work') {
    drawWrenchAt(ctx, rightTip.tx, rightTip.ty, rightAngle, time);
  }

  // 頭部/ヘルメット
  ctx.save();
  ctx.translate(0, -118);
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fillStyle = getRobotHeadGrad(ctx);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(60,110,120,0.35)';
  ctx.stroke();

  // アンテナ
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(0, -46);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#9ad3db';
  ctx.lineCap = 'round';
  ctx.stroke();
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  ctx.beginPath();
  ctx.arc(0, -49, 5, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,143,184,${0.6 + 0.4 * pulse})`;
  ctx.fill();

  // 頬
  ctx.fillStyle = 'rgba(255,150,180,0.45)';
  ctx.beginPath();
  ctx.ellipse(-19, 6, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(19, 6, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // バイザー
  ctx.beginPath();
  ctx.roundRect(-21, -14, 42, 20, 10);
  ctx.fillStyle = 'rgba(45,60,75,0.14)';
  ctx.fill();

  // 目
  const blinking = pose !== 'happy' && time % 3.4 < 0.12;
  drawRobotEye(ctx, -10, -4, pupilOffX, pupilOffY, blinking, pose === 'happy');
  drawRobotEye(ctx, 10, -4, pupilOffX, pupilOffY, blinking, pose === 'happy');

  // リボン(女児にも好かれる差し色アクセサリ)
  ctx.save();
  ctx.translate(24, -26);
  ctx.rotate(-0.3);
  ctx.fillStyle = '#ff6fa8';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-10, -8, -12, 6, 0, 0);
  ctx.bezierCurveTo(10, -8, 12, 6, 0, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd76b';
  ctx.fill();
  ctx.restore();

  ctx.restore(); // 頭部

  ctx.restore(); // bodyOffset
  ctx.restore(); // scale/translate
}

// ============================================================================
// drawStars — ストライク等で放射する星パーティクル(状態を持たない時間関数)
// ============================================================================

function buildStarPath(spikes: number, inner: number): Path2D {
  const p = new Path2D();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 1 : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) p.moveTo(px, py);
    else p.lineTo(px, py);
  }
  p.closePath();
  return p;
}

const STAR_PATH: Path2D = buildStarPath(5, 0.45);

/** power(0..1)に応じて少量・上品に放射する星パーティクル。 */
export function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, power: number, time: number): void {
  const p = clamp01(power);
  if (p <= 0.001) return;
  const count = Math.max(3, Math.round(3 + p * 6));
  for (let i = 0; i < count; i++) {
    const phase = ((time * 0.6 + i / count) % 1 + 1) % 1;
    const angle = (i / count) * Math.PI * 2 + time * 0.35;
    const radius = phase * (55 + p * 45);
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius * 0.7 - phase * 26;
    const alpha = (1 - phase) * Math.min(1, p + 0.2);
    if (alpha <= 0.02) continue;
    const size = (5 + (1 - phase) * 7) * (0.6 + p * 0.4);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle + phase * 3.2);
    ctx.scale(size, size);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = i % 2 === 0 ? '#ffd76b' : '#ff9ecf';
    ctx.fill(STAR_PATH);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
