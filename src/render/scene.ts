// src/render/scene.ts
// 所有: A2 (sim/render)。
// scene.render は冒頭で layout.camera 変換を ctx に適用し、
// 背景 → 機械(exterior または cutaway/inside) → fault.render → mechanic.render → effects.render
// の順で描画する。
//
// ビジュアル方針(統括レビュー対応・2026-08-03): 「上質な玩具+科学館の断面模型」。
// - cutaway/inside: 暖色の機械室(トラス外周フレーム+点検灯)の中に、L字断面(踏板+蹴込み)の
//   ステップが輪になって循環する。チェーンは太い帯(丸ピン+棒リンク)。ステップは進行方向
//   tangent にそって回転し、turnaround で連続的に反転する(裏では踏板が下向き)。
// - exterior: 太いトラス土台・ガラス欄干・階段状のステップ+建物床スラブでロケーションの
//   文脈を見せる。
// - 60fps維持のため、静的レイヤー(背景グラデ/ロケーションモチーフ/トラス外周枠/建物床スラブ)は
//   OffscreenCanvas にキャッシュし、location/視口(または初回)変更時のみ再構築する。

import type { GameState, PathPoint, ViewMode } from '../core/types';
import { layout } from '../core/layout';
import { mechanic } from './mechanic';
import { effects } from './effects';
import { ESC_GEOM, STEP_DEPTH, buildLoopGeometry, addScaled, rawPointOnGeometry, type LoopGeometry } from '../sim/escalator';

// ---------------------------------------------------------------------------
// デバッグフック: URL hash で view を強制切り替え(通常動作には影響しない)。
// 確認用: location.hash === '#debug-cutaway' | '#debug-inside' | '#debug-exterior'
// ---------------------------------------------------------------------------
function effectiveView(state: GameState): ViewMode {
  if (typeof location !== 'undefined') {
    const h = location.hash;
    if (h.startsWith('#debug-cutaway')) return 'cutaway';
    if (h.startsWith('#debug-inside')) return 'inside';
    if (h.startsWith('#debug-exterior')) return 'exterior';
  }
  return state.view;
}

// デバッグ専用: URL hash に "loc=0|1|2" が含まれる場合、確認用にロケーションパレットを
// 強制切り替える(通常動作は state.location をそのまま使う)。
function effectiveLocation(state: GameState): 0 | 1 | 2 {
  if (typeof location !== 'undefined') {
    const m = location.hash.match(/loc=([012])/);
    if (m) return Number(m[1]) as 0 | 1 | 2;
  }
  return state.location;
}

// ---------------------------------------------------------------------------
// ワールド座標一覧 (A5 flow が安全柵/スイッチ/鍵/床板取っ手/クランクのホットスポットを
// 配置する際に使うべき座標。CONTRACT外の追加公開だが scene.ts の所有者(A2)として提供)
// ---------------------------------------------------------------------------
// 注意: src/game/coords.ts (A5所有) はこの WORLD を import して座標を一元化している
// (fenceDrop/switchPos/keyholePos/crankCenter/plateHandle は WORLD が一次情報源)。
// plateHandle は CONTRACT.md が明記する「上端床の点検床板」に従って上端に置く
// (A7統合裁定: 2026-08-03 で coords.ts 側を上端に統一済み)。
// ※ ここに書かれた座標値は他モジュールが直接依存しているため変更禁止(A7裁定)。
// 見た目の大きさ・質感は描画側(drawSafetyControls等)だけで調整する。
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
const FRONT_ROLLER = '#5cc8ff';
const FRONT_ROLLER_DARK = '#1c7fb0';
const BACK_ROLLER = '#ffb454';
const BACK_ROLLER_DARK = '#c9781f';
const RISER_BAND = '#ffb454';
const CHAIN_DARK = '#20232b';
const CHAIN_LIGHT = '#4a5162';
const TRUSS_BASE = '#c9a06a';
const TRUSS_DARK = '#4a3524';
const LAMP_FIXTURE_XFRACS = [0.14, 0.38, 0.62, 0.86];

// ---------------------------------------------------------------------------
// 汎用ヘルパ(OffscreenCanvasRenderingContext2D でも使えるよう Ctx2D 型で受ける)
// ---------------------------------------------------------------------------
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function metalFill(ctx: Ctx2D, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, METAL_LIGHT);
  g.addColorStop(0.5, METAL_MID);
  g.addColorStop(1, METAL_DARK);
  return g;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function mixColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function sampleLoop(pathFn: (t: number) => PathPoint, n: number): PathPoint[] {
  const pts: PathPoint[] = [];
  for (let i = 0; i <= n; i++) pts.push(pathFn(i / n));
  return pts;
}

function strokeLoop(ctx: Ctx2D, pts: PathPoint[]): void {
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Offscreen キャッシュ基盤(静的レイヤーの再描画コスト削減。60fps維持のため)
// ---------------------------------------------------------------------------
function makeCanvas(w: number, h: number): AnyCanvas {
  const width = Math.max(1, Math.ceil(w));
  const height = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function ctx2d(c: AnyCanvas): Ctx2D {
  // HTMLCanvasElement/OffscreenCanvas いずれも getContext('2d') を持つ。
  const cc = (c as unknown as { getContext(id: '2d'): Ctx2D | null }).getContext('2d');
  if (!cc) throw new Error('2d context unavailable');
  return cc;
}

// --- 画面空間キャッシュ(背景グラデ+ロケーションモチーフ+機械室の壁/点検灯筐体) ---
interface ScreenCacheEntry { key: string; canvas: AnyCanvas; }
let backdropCache: ScreenCacheEntry | null = null;

function getBackdropCanvas(view: ViewMode, pal: Palette, location: 0 | 1 | 2, w: number, h: number, dpr: number): AnyCanvas {
  const isExterior = view === 'exterior';
  const key = `${isExterior ? 'ext' : 'cut'}|${location}|${w.toFixed(1)}|${h.toFixed(1)}|${dpr.toFixed(2)}`;
  if (backdropCache && backdropCache.key === key) return backdropCache.canvas;
  const canvas = makeCanvas(w * dpr, h * dpr);
  const c = ctx2d(canvas);
  c.scale(dpr, dpr);
  if (isExterior) paintExteriorBackdrop(c, w, h, pal, location);
  else paintCutawayBackdrop(c, w, h, pal);
  backdropCache = { key, canvas };
  return canvas;
}

// --- ワールド空間キャッシュ(トラス外周枠/建物床スラブ。カメラ変換下でそのまま drawImage) ---
interface WorldBitmap { canvas: AnyCanvas; x: number; y: number; w: number; h: number; }
const trussBitmaps = new Map<number, WorldBitmap>();
const buildingBitmaps = new Map<number, WorldBitmap>();

function getTrussBitmap(location: 0 | 1 | 2): WorldBitmap {
  const cached = trussBitmaps.get(location);
  if (cached) return cached;
  const pal = PALETTES[location];
  const main = ESC_GEOM.main;
  const pad = 46;
  const outerOrigin = addScaled(main.points.A0, ESC_GEOM.n, -pad);
  const outer = buildLoopGeometry(outerOrigin, main.radius + pad, main.runin + 24);
  const pts = [outer.points.A0, outer.points.A1, outer.points.B1, outer.points.C1, outer.points.D0, outer.points.E0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const margin = outer.radius + 26;
  minX -= margin; minY -= margin; maxX += margin; maxY += margin;
  const w = maxX - minX;
  const h = maxY - minY;
  const SS = 2; // 拡大縮小してもにじまないよう軽く supersample
  const canvas = makeCanvas(w * SS, h * SS);
  const c = ctx2d(canvas);
  c.scale(SS, SS);
  c.translate(-minX, -minY);
  paintTrussFrame(c, outer, pal);
  const bmp: WorldBitmap = { canvas, x: minX, y: minY, w, h };
  trussBitmaps.set(location, bmp);
  return bmp;
}

function getBuildingBitmap(location: 0 | 1 | 2): WorldBitmap {
  const cached = buildingBitmaps.get(location);
  if (cached) return cached;
  const pal = PALETTES[location];
  const geom = ESC_GEOM.main;
  const marginX = 320;
  const marginYTop = 170;
  const marginYBot = 170;
  const minX = geom.points.A0.x - marginX;
  const maxX = geom.points.A1.x + marginX;
  const minY = geom.points.A1.y - marginYTop;
  const maxY = geom.points.A0.y + marginYBot;
  const w = maxX - minX;
  const h = maxY - minY;
  const SS = 1.6;
  const canvas = makeCanvas(w * SS, h * SS);
  const c = ctx2d(canvas);
  c.scale(SS, SS);
  c.translate(-minX, -minY);
  paintBuilding(c, pal, geom);
  const bmp: WorldBitmap = { canvas, x: minX, y: minY, w, h };
  buildingBitmaps.set(location, bmp);
  return bmp;
}

// ---------------------------------------------------------------------------
// 静的レイヤーの中身(キャッシュへ一度だけ描く)
// ---------------------------------------------------------------------------
function drawWallColumns(ctx: Ctx2D, w: number, h: number, pal: Palette): void {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = pal.wall;
  for (let i = 0; i < 3; i++) {
    const px = (i / 3) * w - w * 0.1;
    roundRectPath(ctx, px, 0, w * 0.18, h, 24);
    ctx.fill();
  }
  ctx.restore();
}

function drawMallMotif(ctx: Ctx2D, w: number, h: number, pal: Palette): void {
  // 棚(右上寄り、商品ドットの列)
  ctx.save();
  const sx = w * 0.72, sy = h * 0.1, sw = w * 0.24, sh = h * 0.34;
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = pal.wallAccent;
  for (let i = 0; i < 3; i++) {
    const ry = sy + (i / 3) * sh;
    roundRectPath(ctx, sx, ry, sw, sh / 3 - 8, 6);
    ctx.fill();
  }
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff6ee';
  for (let i = 0; i < 3; i++) {
    const ry = sy + (i / 3) * sh + sh / 6;
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.arc(sx + 14 + j * (sw - 28) / 3, ry, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 観葉植物のシルエット(左下)
  ctx.save();
  const px = w * 0.1, py = h * 0.82;
  ctx.fillStyle = '#8a5a3a';
  roundRectPath(ctx, px - 16, py, 32, 34, 6);
  ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#5a9e6f';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(px + Math.cos(a) * 20, py - 18 + Math.sin(a) * 14, 20, 11, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStationMotif(ctx: Ctx2D, w: number, h: number, pal: Palette): void {
  // タイル壁(帯状、薄いグリッド)
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = pal.wallAccent;
  ctx.lineWidth = 1.4;
  const bandY = h * 0.06, bandH = h * 0.26;
  for (let x = 0; x < w; x += 34) {
    ctx.beginPath(); ctx.moveTo(x, bandY); ctx.lineTo(x, bandY + bandH); ctx.stroke();
  }
  for (let y = bandY; y < bandY + bandH; y += 34) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.restore();

  // 丸時計(右上)
  ctx.save();
  const cx = w * 0.84, cy = h * 0.14, r = Math.min(w, h) * 0.055;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = pal.wallAccent; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = '#43506b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r * 0.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.4, cy + r * 0.2); ctx.stroke();
  ctx.restore();

  // 案内サイン(矢印付き角丸パネル、左上)
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = pal.wallAccent;
  roundRectPath(ctx, w * 0.06, h * 0.08, w * 0.16, h * 0.06, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  const ax = w * 0.06 + w * 0.13, ay = h * 0.08 + h * 0.03;
  ctx.moveTo(ax, ay - 8); ctx.lineTo(ax + 12, ay); ctx.lineTo(ax, ay + 8); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawAquariumMotif(ctx: Ctx2D, w: number, h: number, pal: Palette): void {
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = pal.wall;
  roundRectPath(ctx, w * 0.06, h * 0.06, w * 0.88, h * 0.42, 26);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#eafeff';
  ctx.lineWidth = 5;
  roundRectPath(ctx, w * 0.06, h * 0.06, w * 0.88, h * 0.42, 26);
  ctx.stroke();
  // 水面ハイライト
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, w * 0.09, h * 0.08, w * 0.82, h * 0.05, 10);
  ctx.fill();
  ctx.restore();
}

function paintExteriorBackdrop(ctx: Ctx2D, w: number, h: number, pal: Palette, location: 0 | 1 | 2): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, pal.bgTop);
  g.addColorStop(1, pal.bgBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  drawWallColumns(ctx, w, h, pal);

  if (location === 0) drawMallMotif(ctx, w, h, pal);
  else if (location === 1) drawStationMotif(ctx, w, h, pal);
  else drawAquariumMotif(ctx, w, h, pal);
}

function paintCutawayBackdrop(ctx: Ctx2D, w: number, h: number, pal: Palette): void {
  // 「床下の秘密の場所」= 暖色の機械室。真っ黒を避け、こげ茶〜アンバーの奥行きを出す。
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#33261a');
  g.addColorStop(0.5, '#20160e');
  g.addColorStop(1, '#140d08');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // ロケーションの淡い色ムード(機械室でも「どこの下か」がうっすら分かる)
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = pal.glow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 上から差し込む暖色の光の帯(ワクワク感)
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 3; i++) {
    const cx = w * (0.22 + i * 0.28);
    const grad = ctx.createLinearGradient(cx, 0, cx, h * 0.75);
    grad.addColorStop(0, 'rgba(255,214,140,0.5)');
    grad.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - 60, 0);
    ctx.lineTo(cx + 60, 0);
    ctx.lineTo(cx + 130, h * 0.7);
    ctx.lineTo(cx - 130, h * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 床(奥行きのあるリベット床)
  ctx.save();
  ctx.fillStyle = 'rgba(70,48,30,0.6)';
  ctx.fillRect(0, h * 0.87, w, h * 0.13);
  ctx.strokeStyle = 'rgba(255,206,150,0.14)';
  ctx.lineWidth = 2;
  for (let x = 16; x < w; x += 46) {
    ctx.beginPath(); ctx.moveTo(x, h * 0.87); ctx.lineTo(x, h); ctx.stroke();
  }
  ctx.restore();

  // 点検灯の筐体(発光自体は毎フレーム上に描く動的部分)
  ctx.save();
  ctx.fillStyle = '#2c2013';
  ctx.strokeStyle = 'rgba(255,214,150,0.35)';
  ctx.lineWidth = 1.5;
  for (const fx of LAMP_FIXTURE_XFRACS) {
    const x = w * fx, y = h * 0.045;
    roundRectPath(ctx, x - 15, y - 6, 30, 12, 4);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function paintBuilding(ctx: Ctx2D, pal: Palette, geom: LoopGeometry): void {
  const { A0, A1 } = geom.points;
  ctx.save();
  // 下階の床スラブ(下端乗り口の外側へ伸びる)
  ctx.fillStyle = pal.floor;
  roundRectPath(ctx, A0.x - 340, A0.y + 16, 320, 50, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  roundRectPath(ctx, A0.x - 340, A0.y + 16, 320, 50, 10);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  roundRectPath(ctx, A0.x - 336, A0.y + 20, 312, 8, 5);
  ctx.fill();

  // 上階の床スラブ(上端乗り口の外側へ伸びる)
  ctx.fillStyle = pal.floor;
  roundRectPath(ctx, A1.x + 20, A1.y - 50, 320, 50, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  roundRectPath(ctx, A1.x + 20, A1.y - 50, 320, 50, 10);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRectPath(ctx, A1.x + 24, A1.y - 46, 312, 8, 5);
  ctx.fill();

  // 開口部の縁(手すり支柱)。上下階をつないでいる文脈をはっきりさせる
  ctx.strokeStyle = pal.wallAccent;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(A0.x - 22, A0.y + 16); ctx.lineTo(A0.x - 22, A0.y - 46); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(A1.x + 22, A1.y - 50); ctx.lineTo(A1.x + 22, A1.y + 16); ctx.stroke();
  ctx.restore();
}

function paintTrussFrame(ctx: Ctx2D, outerGeom: LoopGeometry, pal: Palette): void {
  const pts = sampleLoop((t) => rawPointOnGeometry(t, outerGeom), 140);
  const warm = mixColor(TRUSS_BASE, pal.wallAccent, 0.22);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = TRUSS_DARK;
  ctx.lineWidth = 22;
  strokeLoop(ctx, pts);
  ctx.strokeStyle = warm;
  ctx.lineWidth = 14;
  strokeLoop(ctx, pts);
  ctx.strokeStyle = 'rgba(255,240,210,0.22)';
  ctx.lineWidth = 3;
  strokeLoop(ctx, pts);

  // リベット(装飾、輪郭に沿って点々)
  ctx.fillStyle = 'rgba(30,18,8,0.55)';
  const rivetN = 40;
  for (let i = 0; i < rivetN; i++) {
    const p = pts[Math.floor((i / rivetN) * (pts.length - 1))];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ターンアラウンド付近だけの短い斜材(内部を横切る線は最小限に)
  const g = ESC_GEOM.main;
  const ranges: [number, number][] = [[g.t.T1b, g.t.T2], [g.t.T3b, 1]];
  ctx.strokeStyle = 'rgba(40,26,12,0.55)';
  ctx.lineWidth = 6;
  for (const [a, b] of ranges) {
    for (const f of [0.22, 0.5, 0.78]) {
      const t = a + (b - a) * f;
      const inner = rawPointOnGeometry(t, g);
      const outer = rawPointOnGeometry(t, outerGeom);
      ctx.beginPath();
      ctx.moveTo(inner.x, inner.y);
      ctx.lineTo(outer.x, outer.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 動的レイヤー(毎フレーム描く軽量な演出。キャッシュの上に重ねる)
// ---------------------------------------------------------------------------
function drawLampGlow(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, reduced: boolean): void {
  ctx.save();
  for (let i = 0; i < LAMP_FIXTURE_XFRACS.length; i++) {
    const x = w * LAMP_FIXTURE_XFRACS[i];
    const y = h * 0.045 + 6;
    const pulse = reduced ? 0.75 : 0.6 + 0.3 * Math.sin(time * 2.1 + i * 1.6);
    const r = 50;
    const glow = ctx.createRadialGradient(x, y, 2, x, y, r);
    glow.addColorStop(0, `rgba(255,222,160,${0.55 * pulse})`);
    glow.addColorStop(1, 'rgba(255,222,160,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,205,0.95)';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAquariumDynamic(ctx: CanvasRenderingContext2D, w: number, h: number, pal: Palette, time: number, reduced: boolean): void {
  if (!pal.fishA || !pal.fishB) return;
  // 魚
  ctx.save();
  ctx.globalAlpha = 0.85;
  const amp = reduced ? 4 : 14;
  for (let i = 0; i < 5; i++) {
    const t = time * 0.15 + i * 1.7;
    const fx = ((Math.sin(t) * 0.5 + 0.5) * (w * 0.76 + 100)) + w * 0.08;
    const fy = h * (0.12 + 0.07 * i) + Math.sin(t * 1.3) * amp;
    ctx.fillStyle = i % 2 === 0 ? pal.fishA : pal.fishB;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(Math.sin(t) >= 0 ? 1 : -1, 1);
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
    ctx.moveTo(-18, 0);
    ctx.lineTo(-30, -9);
    ctx.lineTo(-30, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // 泡
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.4;
  const bubbleAmp = reduced ? 0 : 1;
  for (let i = 0; i < 10; i++) {
    const seed = i * 12.7;
    const bx = w * (0.12 + (i % 5) * 0.16);
    const cycle = (time * 0.12 * bubbleAmp + seed * 0.05) % 1;
    const by = h * 0.46 - cycle * h * 0.4;
    const r = 2 + (i % 3);
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
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
  ctx.fillStyle = metalFill(ctx, -36, -10, 36, 10);
  roundRectPath(ctx, -40, -12, 80, 20, 6);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.fillStyle = METAL_DARK;
  for (let i = -6; i <= 6; i++) {
    ctx.fillRect(i * 6 - 1, -12 * facing, 2, 7 * facing);
  }
  ctx.restore();
}

function drawExteriorSteps(ctx: CanvasRenderingContext2D, state: GameState): void {
  const model = state.escalator;
  ctx.save();
  const treadW = 108, treadH = 18, riserW = 22, riserH = 36;
  for (let i = 0; i < model.stepCount; i++) {
    if (model.removedStep === i) continue;
    const t = model.stepT(i);
    const p = model.pathPoint(t);
    if (p.segment !== 'incline') continue;
    const j = jitterFor(state, i * 1.7);
    ctx.save();
    ctx.translate(p.x + j.x, p.y + j.y);

    // 蹴込み(riser) — 段差らしさを出すため踏板の下・進行方向後方に描く
    ctx.fillStyle = metalFill(ctx, -riserW / 2, 0, riserW / 2, riserH);
    roundRectPath(ctx, -treadW / 2, 2, riserW, riserH, 5);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = RISER_BAND;
    roundRectPath(ctx, -treadW / 2, riserH - 9, riserW, 9, 3);
    ctx.fill();

    // 踏板(tread)
    ctx.fillStyle = metalFill(ctx, -treadW / 2, -treadH / 2, treadW / 2, treadH / 2);
    roundRectPath(ctx, -treadW / 2, -treadH / 2, treadW, treadH, 5);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // 踏面クリート(すべり止め)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    for (let g = -4; g <= 4; g++) {
      ctx.beginPath();
      ctx.moveTo(g * 11, -treadH / 2 + 3);
      ctx.lineTo(g * 11, treadH / 2 - 3);
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
  const n = 28;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ガラス欄干(半透明+光沢、太く)
  const glassPts: PathPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * T1;
    const p = model.pathPoint(t);
    glassPts.push({ ...p, y: p.y - 46 });
  }
  ctx.strokeStyle = 'rgba(205,228,255,0.4)';
  ctx.lineWidth = 64;
  strokeLoop(ctx, glassPts);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 62;
  ctx.setLineDash([]);
  strokeLoop(ctx, glassPts);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 6;
  const glossPts = glassPts.map((p) => ({ ...p, x: p.x - 10, y: p.y - 16 }));
  strokeLoop(ctx, glossPts);

  // 手すりベルト(太く、厚み・進行方向のVマーク付き)
  const beltPts: PathPoint[] = [];
  for (let i = 0; i <= n; i++) beltPts.push(model.handrailPoint((i / n) * T1));
  ctx.strokeStyle = HANDRAIL_PINK_DARK;
  ctx.lineWidth = 24;
  strokeLoop(ctx, beltPts);
  ctx.strokeStyle = HANDRAIL_PINK;
  ctx.lineWidth = 17;
  strokeLoop(ctx, beltPts);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  const beltHi = beltPts.map((p) => ({ ...p, x: p.x, y: p.y - 5 }));
  strokeLoop(ctx, beltHi);

  // 移動方向を示す V マーク(移動アニメ)
  if (!state.stopped) {
    const chevCount = 6;
    ctx.fillStyle = HANDRAIL_PINK_DARK;
    for (let i = 0; i < chevCount; i++) {
      const tt = (((i / chevCount) + model.loopT * 0.6) % 1) * T1;
      const p = model.handrailPoint(tt);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.beginPath();
      ctx.moveTo(-7, -9);
      ctx.lineTo(7, 0);
      ctx.lineTo(-7, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawInspectionPlate(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { plateCenter: c, plateSize: sz } = WORLD;
  const openAngle = -state.plateOpen * (Math.PI * 0.62);
  ctx.save();
  ctx.translate(c.x, c.y);

  // 開いたときに漏れる暖色の光
  if (state.plateOpen > 0.02) {
    const glowR = 46 + state.plateOpen * 96;
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, glowR);
    glow.addColorStop(0, 'rgba(255,214,140,0.9)');
    glow.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 開口部(床の穴、常に描く)。大きめの縁取りで「触れる場所」感を強調
  ctx.fillStyle = '#241a10';
  roundRectPath(ctx, -sz.w / 2, -sz.h / 2, sz.w, sz.h, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,196,120,0.5)';
  ctx.lineWidth = 3;
  roundRectPath(ctx, -sz.w / 2, -sz.h / 2, sz.w, sz.h, 7);
  ctx.stroke();

  // 蓋(ヒンジは奥辺、手前へパカッと開く)
  ctx.save();
  ctx.translate(0, -sz.h / 2);
  ctx.rotate(openAngle);
  ctx.fillStyle = metalFill(ctx, -sz.w / 2, 0, sz.w / 2, sz.h);
  roundRectPath(ctx, -sz.w / 2, 0, sz.w, sz.h, 7);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // 取っ手(大きく目立つ形に)
  ctx.strokeStyle = HANDRAIL_PINK_DARK;
  ctx.fillStyle = HANDRAIL_PINK;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-20, sz.h * 0.34);
  ctx.lineTo(20, sz.h * 0.34);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-20, sz.h * 0.34, 5.5, 0, Math.PI * 2);
  ctx.arc(20, sz.h * 0.34, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawSafetyControls(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { switchPos, keyholePos } = WORLD;

  // 操作盤ポスト(大きめ)
  ctx.save();
  ctx.fillStyle = metalFill(ctx, switchPos.x - 20, switchPos.y - 26, switchPos.x + 20, keyholePos.y + 26);
  roundRectPath(ctx, switchPos.x - 24, switchPos.y - 30, 48, keyholePos.y - switchPos.y + 54, 12);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // 停止スイッチ(赤い大ボタン、存在感アップ)
  ctx.beginPath();
  ctx.arc(switchPos.x, switchPos.y, 23, 0, Math.PI * 2);
  ctx.fillStyle = '#8a1620';
  ctx.fill();
  ctx.strokeStyle = '#ffe3a8';
  ctx.lineWidth = 2;
  ctx.stroke();
  const btnR = state.stopped ? 15 : 18.5;
  const btnGrad = ctx.createRadialGradient(switchPos.x - 5, switchPos.y - 5, 1, switchPos.x, switchPos.y, btnR);
  btnGrad.addColorStop(0, '#ff9a9a');
  btnGrad.addColorStop(1, state.stopped ? '#c21f2c' : '#ef2d3a');
  ctx.beginPath();
  ctx.arc(switchPos.x, switchPos.y, btnR, 0, Math.PI * 2);
  ctx.fillStyle = btnGrad;
  ctx.fill();
  ctx.strokeStyle = '#5c0d13';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (!state.stopped) {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(state.time * 5) * 0.3;
    ctx.strokeStyle = '#ff8a8a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(switchPos.x, switchPos.y, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 鍵穴(ロック時に点灯、大きめ)
  ctx.beginPath();
  ctx.arc(keyholePos.x, keyholePos.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = state.locked ? '#8affb0' : '#2b323d';
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (state.locked) {
    ctx.save();
    ctx.globalAlpha = 0.6 + Math.sin(state.time * 6) * 0.25;
    ctx.fillStyle = '#baffd4';
    ctx.beginPath();
    ctx.arc(keyholePos.x, keyholePos.y, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(keyholePos.x, keyholePos.y + 3);
  ctx.lineTo(keyholePos.x, keyholePos.y + 11);
  ctx.strokeStyle = '#12161c';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  // 安全柵: 描画は sim/faults.ts (A5所有, renderProps/drawFenceInstalled) に一本化。
  // (A7統合修正: ここで独立に描いていた旧デザインの柵が、faults.ts の新デザインの柵と
  // 二重描画になり、しかもどちらも停止スイッチの操作盤に重なって表示される不具合の原因に
  // なっていたため削除。設置有無の判定・磁石吸着ロジックは従来通り COORDS.fenceDrop を使う。)
}

function drawExterior(ctx: CanvasRenderingContext2D, state: GameState, loc: 0 | 1 | 2): void {
  const model = state.escalator;
  const geom = ESC_GEOM.main;

  // 建物の床スラブ(静的、キャッシュしたワールド空間ビットマップを合成)
  const building = getBuildingBitmap(loc);
  ctx.drawImage(building.canvas as CanvasImageSource, building.x, building.y, building.w, building.h);

  // 側面パネル(太いトラス土台・外板)
  ctx.save();
  ctx.strokeStyle = TRUSS_DARK;
  ctx.lineWidth = 78;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(geom.points.A0.x, geom.points.A0.y + 10);
  ctx.lineTo(geom.points.A1.x, geom.points.A1.y + 10);
  ctx.stroke();
  ctx.strokeStyle = metalFill(ctx, geom.points.A0.x, geom.points.A0.y, geom.points.A1.x, geom.points.A1.y);
  ctx.lineWidth = 66;
  ctx.beginPath();
  ctx.moveTo(geom.points.A0.x, geom.points.A0.y + 8);
  ctx.lineTo(geom.points.A1.x, geom.points.A1.y + 8);
  ctx.stroke();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
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
function drawGuideRails(ctx: CanvasRenderingContext2D, model: GameState['escalator'], detailed: boolean): void {
  const pts = sampleLoop((t) => model.pathPoint(t), 110);
  ctx.save();
  ctx.strokeStyle = '#e7d9c2';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  strokeLoop(ctx, pts);
  ctx.restore();

  if (detailed) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,230,190,0.5)';
    for (let i = 0; i < pts.length; i += 6) {
      const p = pts[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawChainBand(ctx: CanvasRenderingContext2D, model: GameState['escalator']): void {
  const geom = ESC_GEOM.main;
  const spacing = 15;
  const n = Math.max(24, Math.round(geom.totalLen / spacing));
  ctx.save();
  for (let i = 0; i < n; i++) {
    const t = ((i / n) + model.loopT * 0.35) % 1;
    const p = model.pathPoint(t);
    if (i % 2 === 0) {
      // ピン(丸コマ)
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      const rg = ctx.createRadialGradient(p.x - 1.5, p.y - 1.5, 0.5, p.x, p.y, 5);
      rg.addColorStop(0, CHAIN_LIGHT);
      rg.addColorStop(1, CHAIN_DARK);
      ctx.fillStyle = rg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // 棒リンク
      const len = (geom.totalLen / n) * 0.62;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = metalFill(ctx, -len, -3.4, len, 3.4);
      roundRectPath(ctx, -len, -3.6, len * 2, 7.2, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.32)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
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
  // ベルトに厚みを持たせる(濃い縁+明るい面+ハイライト筋)
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = HANDRAIL_PINK_DARK;
  ctx.lineWidth = 11;
  ctx.globalAlpha = 0.9;
  strokeLoop(ctx, pts);
  ctx.strokeStyle = HANDRAIL_PINK;
  ctx.lineWidth = 7.5;
  strokeLoop(ctx, pts);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  strokeLoop(ctx, pts);
  ctx.restore();

  // 駆動ローラー(経路内側に複数個。ベルトを支えている見た目)
  const hg = ESC_GEOM.handrail;
  const rollerTs = [
    (hg.t.T1b + hg.t.T2) / 2,
    (hg.t.T3b + 1) / 2,
    hg.t.T1 * 0.5,
    hg.t.T2 + (hg.t.T3 - hg.t.T2) * 0.5
  ];
  for (const t of rollerTs) {
    const p = model.handrailPoint(t);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = metalFill(ctx, -12, -12, 12, 12);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-3, -3, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.restore();
  }
}

// ステップ: L字断面(踏板+蹴込み)。tangent(p.angle)方向にそのまま回転させるので、
// incline では踏板が斜面沿いに立ち上がって見え、turnaround で連続的に反転し、
// return では踏板が下向き(逆さま)になることが一目で分かる。
function drawStepInCutaway(
  ctx: CanvasRenderingContext2D,
  p: PathPoint,
  alpha: number,
  liftOffset: number,
  detailed: boolean
): void {
  const dirx = Math.cos(p.angle);
  const diry = Math.sin(p.angle);
  // outward(踏面が向く方向) = -N。N = (cos(angle+90°), sin(angle+90°))
  const nx = Math.cos(p.angle + Math.PI / 2);
  const ny = Math.sin(p.angle + Math.PI / 2);

  ctx.save();
  ctx.globalAlpha = alpha;

  // 台車(前後ローラー2個+リンク)。色分け: 前輪(進行方向側)=青、後輪=橙。
  const gap = 22;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.strokeStyle = METAL_DARK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-dirx * gap, -diry * gap);
  ctx.lineTo(dirx * gap, diry * gap);
  ctx.stroke();
  const rollerSpecs: [number, string, string][] = [
    [1, FRONT_ROLLER, FRONT_ROLLER_DARK],
    [-1, BACK_ROLLER, BACK_ROLLER_DARK]
  ];
  for (const [s, fill, dark] of rollerSpecs) {
    const rx = dirx * gap * s;
    const ry = diry * gap * s;
    ctx.beginPath();
    ctx.arc(rx, ry, 7.5, 0, Math.PI * 2);
    const rg = ctx.createRadialGradient(rx - 2, ry - 2, 0.6, rx, ry, 7.5);
    rg.addColorStop(0, detailed ? fill : RUBBER);
    rg.addColorStop(1, detailed ? dark : '#15171c');
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (detailed) {
      ctx.beginPath();
      ctx.arc(rx - 1.6, ry - 1.6, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    }
  }
  ctx.restore();

  // L字断面(踏板+蹴込み)。tangent方向にそのまま回転。
  const halfDepth = STEP_DEPTH / 2;
  const treadThick = 9;
  const riserLen = 15;
  ctx.save();
  ctx.translate(p.x - nx * liftOffset, p.y - ny * liftOffset);
  ctx.rotate(p.angle);
  // ローカル座標系: +x = 進行方向(tangent), +y = 内側(機構側)。踏面は -y 側(外側)を向く。

  // 蹴込み(riser): 後方(-x側)に、内側(+y)へ伸びる帯
  ctx.fillStyle = metalFill(ctx, -halfDepth, 0, -halfDepth + riserLen, riserLen);
  roundRectPath(ctx, -halfDepth, -1, riserLen, riserLen + 1, 3);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = RISER_BAND;
  roundRectPath(ctx, -halfDepth, riserLen - 5, riserLen, 5, 2);
  ctx.fill();

  // 踏板(tread): 外側(-y)に薄い板。上面(-y端)にクリート(縞)を描く。
  ctx.fillStyle = metalFill(ctx, -halfDepth, -treadThick, halfDepth, 0);
  roundRectPath(ctx, -halfDepth, -treadThick, STEP_DEPTH, treadThick, 3);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // クリート(踏面の溝、外側の面)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.2;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * (STEP_DEPTH / 8), -treadThick + 1.5);
    ctx.lineTo(i * (STEP_DEPTH / 8), -1.5);
    ctx.stroke();
  }
  // 段鼻(ノージング)ハイライト
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-halfDepth, -treadThick + 1);
  ctx.lineTo(halfDepth, -treadThick + 1);
  ctx.stroke();

  if (detailed) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * (STEP_DEPTH / 6), -treadThick / 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.restore();
}

function drawCutaway(ctx: CanvasRenderingContext2D, state: GameState, detailed: boolean, loc: 0 | 1 | 2): void {
  const model = state.escalator;
  const geom = ESC_GEOM.main;

  // トラス外周枠(静的、キャッシュ済みビットマップを合成)
  const truss = getTrussBitmap(loc);
  ctx.drawImage(truss.canvas as CanvasImageSource, truss.x, truss.y, truss.w, truss.h);

  drawHandrailLoop(ctx, model);
  drawGuideRails(ctx, model, detailed);
  drawChainBand(ctx, model);

  // 歯車は本体半径をチェーン経路より内側に抑え、歯先とステップ/チェーンが重ならない
  // クリアランスを確保する(実車のスプロケット感)。
  const gearAngle = (model.loopT * geom.totalLen) / geom.radius;
  const gearVisualR = geom.radius - 17;
  drawGear(ctx, geom.points.Ctop.x, geom.points.Ctop.y, gearVisualR, gearAngle, detailed);
  drawGear(ctx, geom.points.Cbot.x, geom.points.Cbot.y, gearVisualR, gearAngle, detailed);
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
    const loc = effectiveLocation(state);
    const pal = PALETTES[loc] ?? PALETTES[0];

    // 背景(スクリーン座標、カメラ変換の影響を受けない)。静的部分はキャッシュから合成。
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = getBackdropCanvas(view, pal, loc, w, h, dpr);
    ctx.drawImage(bg as CanvasImageSource, 0, 0, w, h);
    if (view === 'exterior') {
      if (loc === 2) drawAquariumDynamic(ctx, w, h, pal, state.time, state.settings.reducedMotion);
    } else {
      drawLampGlow(ctx, w, h, state.time, state.settings.reducedMotion);
    }

    // カメラ変換を適用(ワールド座標での描画はここから)
    ctx.translate(w / 2, h / 2);
    ctx.scale(layout.camera.scale, layout.camera.scale);
    ctx.translate(-layout.camera.cx, -layout.camera.cy);

    ctx.save();
    if (view === 'exterior') {
      drawExterior(ctx, state, loc);
    } else {
      drawCutaway(ctx, state, view === 'inside', loc);
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
