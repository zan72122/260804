// src/render/scene.ts
// 所有: A2 (sim/render)。
// scene.render は冒頭で layout.camera 変換を ctx に適用し、
// 背景 → 機械(exterior または cutaway/inside) → fault.render → mechanic.render → effects.render
// の順で描画する。

import type { GameState, PathPoint, ViewMode } from '../core/types';
import { layout } from '../core/layout';
import { mechanic } from './mechanic';
import { effects } from './effects';
import { ESC_GEOM, STEP_DEPTH } from '../sim/escalator';

// ---------------------------------------------------------------------------
// デバッグフック: URL hash で view を強制切り替え(通常動作には影響しない)。
// 確認用: location.hash === '#debug-cutaway' | '#debug-inside' | '#debug-exterior'
// ---------------------------------------------------------------------------
function effectiveView(state: GameState): ViewMode {
  if (typeof location !== 'undefined') {
    const h = location.hash;
    if (h === '#debug-cutaway') return 'cutaway';
    if (h === '#debug-inside') return 'inside';
    if (h === '#debug-exterior') return 'exterior';
  }
  return state.view;
}

// ---------------------------------------------------------------------------
// ワールド座標一覧 (A5 flow が安全柵/スイッチ/鍵/床板取っ手/クランクのホットスポットを
// 配置する際に使うべき座標。CONTRACT外の追加公開だが scene.ts の所有者(A2)として提供)
// ---------------------------------------------------------------------------
// 注意: src/game/coords.ts (A5所有) と座標系を極力揃えてある(A5のCOORDSと
// 同じ値: fenceDrop/switchPos/keyholePos/crankCenter)。ただし plateHandle は
// CONTRACT.md が明記する「上端床の点検床板」に従って上端に置いている
// (A5の COORDS.plateHandleBottom は下端(15,-55)にあり、これは CONTRACT との
// 不一致。レポートで要調整として報告済み)。
export const WORLD = {
  // 大きな手回しホイールの中心(断面図下部、下部歯車Cbotのすぐそば = 同軸のイメージ)
  // A5 coords.ts の COORDS.crankWheel と同値。
  crankCenter: { x: 0, y: 65 },
  crankVisualRadius: 62,
  // 上端の点検床板(取っ手はこの少し上)。CONTRACT.md: 「上端床の点検床板」。
  // A5 coords.ts の COORDS.topPlate(予約値: 570,-300)とほぼ同位置に合わせてある。
  plateCenter: { x: 570, y: -300 },
  plateHandle: { x: 570, y: -308 },
  plateSize: { w: 132, h: 46 },
  // 乗り口(下端)まわりの安全装備。A5 coords.ts の COORDS と同値。
  fenceDrop: { x: -55, y: -30 },
  switchPos: { x: -60, y: -95 },
  keyholePos: { x: -60, y: -15 },
  // 参考: 下端/上端インクライン境界(ホットスポット配置の基準に)
  bottomBoard: ESC_GEOM.main.points.A0,
  topBoard: ESC_GEOM.main.points.A1
};

// ---------------------------------------------------------------------------
// ロケーション別パレット
// ---------------------------------------------------------------------------
interface Palette {
  bgTop: string;
  bgBot: string;
  wall: string;
  wallAccent: string;
  floor: string;
  glow: string;
  fishA?: string;
  fishB?: string;
}

const PALETTES: Record<0 | 1 | 2, Palette> = {
  0: { bgTop: '#fff2e6', bgBot: '#ffd9c2', wall: '#ffe3d1', wallAccent: '#ff9fb6', floor: '#ffcaa8', glow: '#ffd9ec' },
  1: { bgTop: '#eef4fa', bgBot: '#c9d7e6', wall: '#dde8f2', wallAccent: '#6f93c9', floor: '#b9c6d6', glow: '#dbe9ff' },
  2: {
    bgTop: '#cdf3f2',
    bgBot: '#1c5a78',
    wall: '#b7ecec',
    wallAccent: '#0f7a8c',
    floor: '#1e6a82',
    glow: '#bdf2ff',
    fishA: '#ff9f5a',
    fishB: '#ffe08a'
  }
};

const METAL_LIGHT = '#eef1f5';
const METAL_MID = '#aab3bf';
const METAL_DARK = '#6c7684';
const OUTLINE = '#3a3f4b';
const RUBBER = '#2c2f38';
const HANDRAIL_PINK = '#ff7fa8';
const HANDRAIL_PINK_DARK = '#e0567f';

// ---------------------------------------------------------------------------
// 汎用ヘルパ
// ---------------------------------------------------------------------------
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function metalFill(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, METAL_LIGHT);
  g.addColorStop(0.5, METAL_MID);
  g.addColorStop(1, METAL_DARK);
  return g;
}

function sampleLoop(pathFn: (t: number) => PathPoint, n: number): PathPoint[] {
  const pts: PathPoint[] = [];
  for (let i = 0; i <= n; i++) pts.push(pathFn(i / n));
  return pts;
}

function strokeLoop(ctx: CanvasRenderingContext2D, pts: PathPoint[]): void {
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 背景
// ---------------------------------------------------------------------------
function drawExteriorBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette, time: number, reduced: boolean): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, pal.bgTop);
  g.addColorStop(1, pal.bgBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // ふんわりした柱/壁の飾り(左右)
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = pal.wall;
  for (let i = 0; i < 3; i++) {
    const px = (i / 3) * w - w * 0.1;
    roundRectPath(ctx, px, 0, w * 0.18, h, 24);
    ctx.fill();
  }
  ctx.restore();

  // 水族館: 魚のシルエットがゆらゆら
  if (pal.fishA && pal.fishB) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    const amp = reduced ? 4 : 14;
    for (let i = 0; i < 5; i++) {
      const t = time * 0.15 + i * 1.7;
      const fx = ((Math.sin(t) * 0.5 + 0.5) * (w + 160)) - 80;
      const fy = h * (0.15 + 0.15 * i) + Math.sin(t * 1.3) * amp;
      ctx.fillStyle = i % 2 === 0 ? pal.fishA : pal.fishB;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(Math.sin(t) >= 0 ? 1 : -1, 1);
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2);
      ctx.moveTo(-20, 0);
      ctx.lineTo(-34, -10);
      ctx.lineTo(-34, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawCutawayBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1b1f2a');
  g.addColorStop(1, '#0d0f16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // ブループリント風グリッド + ロケーションの淡いトーン
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = pal.wallAccent;
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// EXTERIOR: 建物内観のエスカレーター外観
// ---------------------------------------------------------------------------
function jitterFor(state: GameState, seed: number): { x: number; y: number } {
  const amp = state.escalator.wobbleAmp * (state.settings.reducedMotion ? 0.25 : 1);
  if (amp <= 0) return { x: 0, y: 0 };
  const t = state.time * 26;
  return {
    x: Math.sin(t + seed) * amp * 1.6,
    y: Math.cos(t * 1.3 + seed) * amp * 1.1
  };
}

function drawCombPlate(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, facing: 1 | -1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = metalFill(ctx, -30, -8, 30, 8);
  roundRectPath(ctx, -34, -10, 68, 16, 5);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = METAL_DARK;
  for (let i = -5; i <= 5; i++) {
    ctx.fillRect(i * 6 - 1, -10 * facing, 2, 6 * facing);
  }
  ctx.restore();
}

function drawExteriorSteps(ctx: CanvasRenderingContext2D, state: GameState): void {
  const model = state.escalator;
  const { angleU } = ESC_GEOM;
  ctx.save();
  for (let i = 0; i < model.stepCount; i++) {
    if (model.removedStep === i) continue;
    const t = model.stepT(i);
    const p = model.pathPoint(t);
    if (p.segment !== 'incline') continue;
    const j = jitterFor(state, i * 1.7);
    ctx.save();
    ctx.translate(p.x + j.x, p.y + j.y);
    ctx.rotate(angleU);
    const w = 96;
    const th = 20;
    ctx.fillStyle = metalFill(ctx, 0, -th / 2, 0, th / 2);
    roundRectPath(ctx, -w / 2, -th / 2, w, th, 4);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 踏面の溝(すべり止めライン)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let g = -3; g <= 3; g++) {
      ctx.beginPath();
      ctx.moveTo(g * 12, -th / 2 + 3);
      ctx.lineTo(g * 12, th / 2 - 3);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawExteriorHandrail(ctx: CanvasRenderingContext2D, state: GameState): void {
  const model = state.escalator;
  const geom = ESC_GEOM.main;
  const T1 = geom.t.T1;
  const n = 24;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // ガラス欄干(半透明の帯、インクラインに沿う)
  ctx.strokeStyle = 'rgba(200,225,255,0.35)';
  ctx.lineWidth = 46;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * T1;
    const p = model.pathPoint(t);
    if (i === 0) ctx.moveTo(p.x, p.y - 34);
    else ctx.lineTo(p.x, p.y - 34);
  }
  ctx.stroke();

  // 手すりベルト(ピンク、駆動して動く質感を出すため縞模様)
  ctx.strokeStyle = HANDRAIL_PINK;
  ctx.lineWidth = 14;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * T1;
    const p = model.handrailPoint(t);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  ctx.strokeStyle = HANDRAIL_PINK_DARK;
  ctx.lineWidth = 3;
  ctx.setLineDash(state.stopped ? [] : [10, 14]);
  ctx.lineDashOffset = -model.loopT * 400;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * T1;
    const p = model.handrailPoint(t);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawInspectionPlate(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { plateCenter: c, plateSize: sz } = WORLD;
  const openAngle = -state.plateOpen * (Math.PI * 0.62);
  ctx.save();
  ctx.translate(c.x, c.y);

  // 開いたときに漏れる暖色の光
  if (state.plateOpen > 0.02) {
    const glowR = 40 + state.plateOpen * 90;
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, glowR);
    glow.addColorStop(0, 'rgba(255,214,140,0.85)');
    glow.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 開口部(床の穴、常に描く)
  ctx.fillStyle = '#241a10';
  roundRectPath(ctx, -sz.w / 2, -sz.h / 2, sz.w, sz.h, 6);
  ctx.fill();

  // 蓋(ヒンジは奥辺、手前へパカッと開く)
  ctx.save();
  ctx.translate(0, -sz.h / 2);
  ctx.rotate(openAngle);
  ctx.fillStyle = metalFill(ctx, -sz.w / 2, 0, sz.w / 2, sz.h);
  roundRectPath(ctx, -sz.w / 2, 0, sz.w, sz.h, 6);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  // 取っ手
  ctx.strokeStyle = HANDRAIL_PINK_DARK;
  ctx.fillStyle = HANDRAIL_PINK;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-16, sz.h * 0.32);
  ctx.lineTo(16, sz.h * 0.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-16, sz.h * 0.32, 4, 0, Math.PI * 2);
  ctx.arc(16, sz.h * 0.32, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawSafetyControls(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { switchPos, keyholePos, fenceDrop } = WORLD;

  // 操作盤ポスト
  ctx.save();
  ctx.fillStyle = metalFill(ctx, switchPos.x - 16, switchPos.y - 20, switchPos.x + 16, keyholePos.y + 20);
  roundRectPath(ctx, switchPos.x - 20, switchPos.y - 26, 40, keyholePos.y - switchPos.y + 46, 10);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 停止スイッチ(赤い大ボタン)
  ctx.beginPath();
  ctx.arc(switchPos.x, switchPos.y, 17, 0, Math.PI * 2);
  ctx.fillStyle = '#8a1620';
  ctx.fill();
  const btnR = state.stopped ? 11 : 13.5;
  const btnGrad = ctx.createRadialGradient(switchPos.x - 4, switchPos.y - 4, 1, switchPos.x, switchPos.y, btnR);
  btnGrad.addColorStop(0, '#ff8a8a');
  btnGrad.addColorStop(1, state.stopped ? '#c21f2c' : '#ef2d3a');
  ctx.beginPath();
  ctx.arc(switchPos.x, switchPos.y, btnR, 0, Math.PI * 2);
  ctx.fillStyle = btnGrad;
  ctx.fill();
  ctx.strokeStyle = '#5c0d13';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 鍵穴(ロック時に点灯)
  ctx.beginPath();
  ctx.arc(keyholePos.x, keyholePos.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = state.locked ? '#8affb0' : '#2b323d';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (state.locked) {
    ctx.save();
    ctx.globalAlpha = 0.6 + Math.sin(state.time * 6) * 0.25;
    ctx.fillStyle = '#baffd4';
    ctx.beginPath();
    ctx.arc(keyholePos.x, keyholePos.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(keyholePos.x, keyholePos.y + 2);
  ctx.lineTo(keyholePos.x, keyholePos.y + 8);
  ctx.strokeStyle = '#12161c';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // 安全柵
  if (state.fencePlaced) {
    ctx.save();
    ctx.translate(fenceDrop.x, fenceDrop.y);
    ctx.fillStyle = HANDRAIL_PINK;
    roundRectPath(ctx, -46, -58, 92, 12, 6);
    ctx.fill();
    ctx.strokeStyle = HANDRAIL_PINK_DARK;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 13, -50);
      ctx.lineTo(i * 13, 0);
      ctx.strokeStyle = HANDRAIL_PINK_DARK;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.fillStyle = metalFill(ctx, -50, -6, 50, 6);
    roundRectPath(ctx, -50, -6, 100, 8, 4);
    ctx.fill();
    ctx.restore();
  }
}

function drawExterior(ctx: CanvasRenderingContext2D, state: GameState): void {
  const model = state.escalator;
  const geom = ESC_GEOM.main;

  // 側面パネル(欄干下地・外板)
  ctx.save();
  ctx.strokeStyle = metalFill(ctx, geom.points.A0.x, geom.points.A0.y, geom.points.A1.x, geom.points.A1.y);
  ctx.lineWidth = 58;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(geom.points.A0.x, geom.points.A0.y + 6);
  ctx.lineTo(geom.points.A1.x, geom.points.A1.y + 6);
  ctx.stroke();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  drawExteriorSteps(ctx, state);
  drawExteriorHandrail(ctx, state);
  drawCombPlate(ctx, geom.points.A0.x, geom.points.A0.y, ESC_GEOM.angleU, 1);
  drawCombPlate(ctx, geom.points.A1.x, geom.points.A1.y, ESC_GEOM.angleU, -1);

  // 乗降口の床
  ctx.save();
  ctx.fillStyle = '#00000014';
  roundRectPath(ctx, -112, 0, 122, 30, 4);
  ctx.fill();
  ctx.restore();

  drawSafetyControls(ctx, state);
  drawInspectionPlate(ctx, state);
  void model;
}

// ---------------------------------------------------------------------------
// CUTAWAY / INSIDE: 側面断面(輪全体・機構)
// ---------------------------------------------------------------------------
function drawTruss(ctx: CanvasRenderingContext2D): void {
  const geom = ESC_GEOM.main;
  const { A0, A1, B1, C1, D0, E0 } = geom.points;
  ctx.save();
  ctx.strokeStyle = 'rgba(150,165,190,0.35)';
  ctx.lineWidth = 3;
  // 上弦材(インクライン+上部助走)
  ctx.beginPath();
  ctx.moveTo(A0.x, A0.y);
  ctx.lineTo(B1.x, B1.y);
  ctx.stroke();
  // 下弦材(リターン+下部助走)
  ctx.beginPath();
  ctx.moveTo(C1.x, C1.y);
  ctx.lineTo(E0.x, E0.y);
  ctx.stroke();
  // ラティス(斜め材)
  ctx.strokeStyle = 'rgba(150,165,190,0.2)';
  ctx.lineWidth = 2;
  const n = 9;
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const top = { x: A0.x + (B1.x - A0.x) * u, y: A0.y + (B1.y - A0.y) * u };
    const bot = { x: D0.x + (C1.x - D0.x) * (1 - u), y: D0.y + (C1.y - D0.y) * (1 - u) };
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bot.x, bot.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGuideRails(ctx: CanvasRenderingContext2D, model: GameState['escalator']): void {
  const pts = sampleLoop((t) => model.pathPoint(t), 96);
  ctx.save();
  ctx.strokeStyle = METAL_DARK;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.8;
  strokeLoop(ctx, pts);
  ctx.restore();
}

function drawChainDots(ctx: CanvasRenderingContext2D, model: GameState['escalator']): void {
  const count = 70;
  ctx.save();
  ctx.fillStyle = '#1c2029';
  for (let i = 0; i < count; i++) {
    const t = (i / count + model.loopT * 0.35) % 1;
    const p = model.pathPoint(t);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGear(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, angle: number, detailed: boolean): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  // 外周ギア歯
  const teeth = 12;
  ctx.fillStyle = metalFill(ctx, -radius, -radius, radius, radius);
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / teeth / 2;
    const rOut = radius + 8;
    const rIn = radius;
    ctx.lineTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
    ctx.lineTo(Math.cos(a1) * rOut, Math.sin(a1) * rOut);
    ctx.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 本体円盤
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = metalFill(ctx, -radius, -radius, radius, radius);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // スポーク
  ctx.strokeStyle = METAL_DARK;
  ctx.lineWidth = detailed ? 7 : 5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * radius * 0.82, Math.sin(a) * radius * 0.82);
    ctx.stroke();
  }

  // 中心ハブ
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = METAL_LIGHT;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  if (detailed) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * radius * 0.55, Math.sin(a) * radius * 0.55, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawCrankWheel(ctx: CanvasRenderingContext2D, angle: number): void {
  const { crankCenter: c, crankVisualRadius: r } = WORLD;
  ctx.save();
  ctx.translate(c.x, c.y);

  // 支柱
  ctx.strokeStyle = METAL_DARK;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.6);
  ctx.lineTo(0, r + 30);
  ctx.stroke();

  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = metalFill(ctx, -r, -r, r, r);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = HANDRAIL_PINK;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.strokeStyle = METAL_DARK;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    ctx.stroke();
  }

  // ハンドル(取っ手)
  ctx.save();
  ctx.translate(r * 0.72, 0);
  ctx.fillStyle = HANDRAIL_PINK;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = HANDRAIL_PINK_DARK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = METAL_LIGHT;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawHandrailLoop(ctx: CanvasRenderingContext2D, model: GameState['escalator']): void {
  const pts = sampleLoop((t) => model.handrailPoint(t), 96);
  ctx.save();
  ctx.strokeStyle = HANDRAIL_PINK;
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.85;
  ctx.lineJoin = 'round';
  strokeLoop(ctx, pts);
  ctx.restore();

  // 駆動ローラー(上下の助走部中央)
  const hg = ESC_GEOM.handrail;
  const topMidT = (hg.t.T1b + hg.t.T2) / 2;
  const botMidT = (hg.t.T3b + 1) / 2;
  for (const t of [topMidT, botMidT]) {
    const p = model.handrailPoint(t);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fillStyle = metalFill(ctx, -13, -13, 13, 13);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

function drawStepInCutaway(
  ctx: CanvasRenderingContext2D,
  p: PathPoint,
  alpha: number,
  liftOffset: number,
  detailed: boolean
): void {
  const treadAngle = p.angle - ESC_GEOM.angleU;
  // ロール方向(実際のチェーン接線方向)沿いに2つのローラーを配置
  const gap = 22;
  const dirx = Math.cos(p.angle);
  const diry = Math.sin(p.angle);

  ctx.save();
  ctx.globalAlpha = alpha;

  // 台車(ローラー2個+リンク)
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = METAL_DARK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-dirx * gap, -diry * gap);
  ctx.lineTo(dirx * gap, diry * gap);
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(dirx * gap * s, diry * gap * s, 7, 0, Math.PI * 2);
    ctx.fillStyle = RUBBER;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dirx * gap * s - 1.5, diry * gap * s - 1.5, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
  }
  ctx.restore();

  // 踏段(角度に応じて回転。inclineで直立、returnで逆さま、turnaroundで遷移)
  const w = 30;
  ctx.save();
  const nx = Math.cos(p.angle + Math.PI / 2);
  const ny = Math.sin(p.angle + Math.PI / 2);
  ctx.translate(p.x - nx * liftOffset, p.y - ny * liftOffset);
  ctx.rotate(treadAngle);
  ctx.fillStyle = metalFill(ctx, -w, -STEP_DEPTH / 2, w, STEP_DEPTH / 2);
  roundRectPath(ctx, -w, -STEP_DEPTH / 2, w * 2, STEP_DEPTH, 5);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 段鼻(ノージング) — 表側だけに明るいラインを入れて上下判別しやすくする
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-w, -STEP_DEPTH / 2 + 3);
  ctx.lineTo(w, -STEP_DEPTH / 2 + 3);
  ctx.stroke();
  if (detailed) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * (w / 2.6), STEP_DEPTH / 2 - 5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.restore();
}

function drawCutaway(ctx: CanvasRenderingContext2D, state: GameState, detailed: boolean): void {
  const model = state.escalator;
  const geom = ESC_GEOM.main;

  drawTruss(ctx);
  drawHandrailLoop(ctx, model);
  drawGuideRails(ctx, model);
  drawChainDots(ctx, model);

  const gearAngle = (model.loopT * geom.totalLen) / geom.radius;
  drawGear(ctx, geom.points.Ctop.x, geom.points.Ctop.y, geom.radius, gearAngle, detailed);
  drawGear(ctx, geom.points.Cbot.x, geom.points.Cbot.y, geom.radius, gearAngle, detailed);
  drawCrankWheel(ctx, gearAngle);

  const alphaBase = state.mode === 'freeObserve' ? 0.42 : 1;
  for (let i = 0; i < model.stepCount; i++) {
    const t = model.stepT(i);
    const p = model.pathPoint(t);
    const j = jitterFor(state, i * 2.3);
    const pj: PathPoint = { ...p, x: p.x + j.x, y: p.y + j.y };

    if (model.removedStep === i) {
      // 引き抜きアニメの中間描画: 少しだけ持ち上がって薄くなる
      if (state.stepRemoved < 0.97) {
        const lift = state.stepRemoved * 46;
        const a = alphaBase * Math.max(0, 1 - state.stepRemoved * 1.05);
        if (a > 0.01) drawStepInCutaway(ctx, pj, a, lift, detailed);
      }
      continue; // 完全に抜けている間はガイドレールだけ見える
    }
    drawStepInCutaway(ctx, pj, alphaBase, 0, detailed);
  }

  if (detailed && state.fault) {
    const p = model.pathPoint(state.fault.anchorT);
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(state.time * 5) * 0.2;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------
export const scene: {
  render(ctx: CanvasRenderingContext2D, state: GameState): void;
} = {
  render(ctx: CanvasRenderingContext2D, state: GameState) {
    const { w, h, dpr } = layout;
    const view = effectiveView(state);
    const pal = PALETTES[state.location] ?? PALETTES[0];

    // 背景(スクリーン座標、カメラ変換の影響を受けない)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (view === 'exterior') {
      drawExteriorBackdrop(ctx, w, h, pal, state.time, state.settings.reducedMotion);
    } else {
      drawCutawayBackdrop(ctx, w, h, pal);
    }

    // カメラ変換を適用(ワールド座標での描画はここから)
    ctx.translate(w / 2, h / 2);
    ctx.scale(layout.camera.scale, layout.camera.scale);
    ctx.translate(-layout.camera.cx, -layout.camera.cy);

    ctx.save();
    if (view === 'exterior') {
      drawExterior(ctx, state);
    } else {
      drawCutaway(ctx, state, view === 'inside');
    }
    ctx.restore();

    if (state.fault) {
      state.fault.render(ctx, state);
    }

    mechanic.render(ctx, state);
    effects.render(ctx, state);

    // 描画後は変換をリセット(次フレームの誤累積防止)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
};
