// ============================================================================
// レーン正面シーンの背景 — 木目レーン・ガター・観客壁・天井照明・奥の機械マスク。
// 「静的」な部分もカメラのズーム/パンに追従する必要があるため、ワールド座標系で
// 毎フレーム描画する（形状/グラデーション/パターンはモジュールスコープでキャッシュ）。
// ============================================================================
import type { CameraController } from '../../core/camera';
import type { Layout, MachineState, RenderHints } from '../../core/types';
import { LANE_VIEW } from '../../core/geometry';
import { boardsHalfWidthAt, clamp01, laneHalfWidthAt } from './util';

// ── 木目パターン(1回だけタイルを焼いてキャッシュ) ──────────────────────
let woodPattern: CanvasPattern | null = null;
function getWoodPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (!woodPattern) {
    const tile = document.createElement('canvas');
    tile.width = 96;
    tile.height = 320;
    const t = tile.getContext('2d')!;
    const g = t.createLinearGradient(0, 0, 96, 0);
    g.addColorStop(0, '#e6bd76');
    g.addColorStop(0.5, '#f2d597');
    g.addColorStop(1, '#deb56c');
    t.fillStyle = g;
    t.fillRect(0, 0, 96, 320);

    t.strokeStyle = 'rgba(110,72,34,0.22)';
    t.lineWidth = 1.4;
    for (let px = 0; px <= 96; px += 32) {
      t.beginPath();
      t.moveTo(px, 0);
      t.lineTo(px, 320);
      t.stroke();
    }

    let seed = 4211;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 1000) / 1000;
    };
    t.strokeStyle = 'rgba(130,88,40,0.16)';
    t.lineWidth = 1;
    for (let i = 0; i < 46; i++) {
      const x0 = rand() * 96;
      const y0 = rand() * 320;
      const len = 24 + rand() * 70;
      t.beginPath();
      t.moveTo(x0, y0);
      t.quadraticCurveTo(x0 + (rand() - 0.5) * 6, y0 + len / 2, x0 + (rand() - 0.5) * 4, y0 + len);
      t.stroke();
    }

    const gloss = t.createLinearGradient(0, 0, 0, 320);
    gloss.addColorStop(0, 'rgba(255,255,255,0.12)');
    gloss.addColorStop(0.5, 'rgba(255,255,255,0)');
    gloss.addColorStop(1, 'rgba(255,255,255,0.05)');
    t.fillStyle = gloss;
    t.fillRect(0, 0, 96, 320);

    woodPattern = ctx.createPattern(tile, 'repeat')!;
  }
  return woodPattern;
}

function getVoidGrad(ctx: CanvasRenderingContext2D, top: number, bottom: number): CanvasGradient {
  // 画面全体を覆う背景色。カメラのズーム/パンで毎フレーム範囲が変わるため、
  // 生成コスト自体が小さいグラデーションはここでは都度作る(色停止は固定)。
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, '#241f38');
  g.addColorStop(0.35, '#332a4a');
  g.addColorStop(1, '#463a56');
  return g;
}

let gutterGrad: CanvasGradient | null = null;
function getGutterGrad(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (!gutterGrad) {
    const g = ctx.createLinearGradient(0, 0, 40, 0);
    g.addColorStop(0, 'rgba(10,12,20,0.95)');
    g.addColorStop(0.5, 'rgba(30,34,46,0.9)');
    g.addColorStop(1, 'rgba(10,12,20,0.95)');
    gutterGrad = g;
  }
  return gutterGrad;
}

let downlightGrad: CanvasGradient | null = null;
function getDownlightGrad(ctx: CanvasRenderingContext2D): CanvasGradient {
  if (!downlightGrad) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(255,248,222,0.55)');
    g.addColorStop(1, 'rgba(255,248,222,0)');
    downlightGrad = g;
  }
  return downlightGrad;
}

function drawDownlight(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r, r);
  ctx.fillStyle = getDownlightGrad(ctx);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function laneTrapezoidPath(halfWidthAt: (y: number) => number, yTop: number, yBottom: number): Path2D {
  const p = new Path2D();
  p.moveTo(LANE_VIEW.centerX - halfWidthAt(yTop), yTop);
  p.lineTo(LANE_VIEW.centerX + halfWidthAt(yTop), yTop);
  p.lineTo(LANE_VIEW.centerX + halfWidthAt(yBottom), yBottom);
  p.lineTo(LANE_VIEW.centerX - halfWidthAt(yBottom), yBottom);
  p.closePath();
  return p;
}

/**
 * レーン背景一式を描画する。ctxはすでに cam.applyTransform 済み(ワールド座標系)。
 */
export function drawLaneBackground(
  ctx: CanvasRenderingContext2D,
  cam: CameraController,
  layout: Layout,
  state: MachineState,
  hints: RenderHints,
  time: number,
): void {
  const margin = 260;
  const c0 = cam.screenToWorld(0, 0, layout);
  const c1 = cam.screenToWorld(layout.w, layout.h, layout);
  const top = Math.min(c0.y, c1.y) - margin;
  const bottom = Math.max(c0.y, c1.y) + margin;
  const left = Math.min(c0.x, c1.x) - margin;
  const right = Math.max(c0.x, c1.x) + margin;

  // 全景を埋める(横画面でLANE_VIEW外周がのぞいても破綻しないように)
  ctx.fillStyle = getVoidGrad(ctx, top, bottom);
  ctx.fillRect(left, top, right - left, bottom - top);

  // 側壁(観客席風パネル) — レーン台形の外側全部
  drawSideWalls(ctx, left, right, top, bottom);

  // 天井ダウンライト(奥から手前へ数段)
  const lightYs = [LANE_VIEW.backWallY + 60, 640, 1000, 1320];
  for (const ly of lightYs) {
    const hw = laneHalfWidthAt(ly);
    const cols = 3;
    for (let i = 0; i < cols; i++) {
      const lx = LANE_VIEW.centerX + lerpN(-hw * 0.7, hw * 0.7, i / (cols - 1));
      drawDownlight(ctx, lx, ly - 40, 90 * (0.6 + 0.4 * (ly / LANE_VIEW.h)));
    }
  }

  // ガター(左右)
  drawGutter(ctx, -1);
  drawGutter(ctx, 1);

  // レーン板(木目)
  const laneClip = laneTrapezoidPath(boardsHalfWidthAt, LANE_VIEW.backWallY, LANE_VIEW.h + 40);
  ctx.save();
  ctx.clip(laneClip);
  ctx.fillStyle = getWoodPattern(ctx);
  ctx.fillRect(0, LANE_VIEW.backWallY, LANE_VIEW.w, LANE_VIEW.h + 40 - LANE_VIEW.backWallY);
  // 光沢(斜めの帯)
  const sheen = ctx.createLinearGradient(0, LANE_VIEW.backWallY, LANE_VIEW.w, LANE_VIEW.h);
  sheen.addColorStop(0.15, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.32, 'rgba(255,255,255,0.16)');
  sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.72, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.82, 'rgba(255,255,255,0.09)');
  sheen.addColorStop(0.9, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, LANE_VIEW.backWallY, LANE_VIEW.w, LANE_VIEW.h + 40 - LANE_VIEW.backWallY);
  ctx.restore();

  // ファウルライン
  const flHalf = boardsHalfWidthAt(LANE_VIEW.nearY);
  ctx.save();
  ctx.strokeStyle = 'rgba(60,40,30,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(LANE_VIEW.centerX - flHalf, LANE_VIEW.nearY);
  ctx.lineTo(LANE_VIEW.centerX + flHalf, LANE_VIEW.nearY);
  ctx.stroke();
  ctx.restore();

  // 奥の機械マスク
  drawMachineMask(ctx, state, hints, time);
}

function lerpN(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drawSideWalls(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  top: number,
  bottom: number,
): void {
  const ys = [top, LANE_VIEW.backWallY, 700, 1100, LANE_VIEW.nearY, bottom];
  ctx.save();
  for (let side = -1; side <= 1; side += 2) {
    const p = new Path2D();
    p.moveTo(side < 0 ? left : LANE_VIEW.centerX + laneHalfWidthAt(top), top);
    for (const y of ys) {
      const hw = laneHalfWidthAt(Math.max(LANE_VIEW.backWallY, y));
      const x = LANE_VIEW.centerX + side * hw;
      p.lineTo(x, y);
    }
    p.lineTo(side < 0 ? left : right, bottom);
    p.lineTo(side < 0 ? left : right, top);
    p.closePath();
    ctx.save();
    ctx.clip(p);
    const g = ctx.createLinearGradient(LANE_VIEW.centerX, 0, side < 0 ? left : right, 0);
    g.addColorStop(0, 'rgba(30,26,44,0.9)');
    g.addColorStop(1, 'rgba(18,15,28,0.98)');
    ctx.fillStyle = g;
    ctx.fillRect(left, top, right - left, bottom - top);
    // 縦パネル筋(簡素な意匠、観客壁の雰囲気)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 2;
    for (let x = left; x < right; x += 70) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawGutter(ctx: CanvasRenderingContext2D, side: -1 | 1): void {
  const p = new Path2D();
  const yTop = LANE_VIEW.backWallY;
  const yBottom = LANE_VIEW.h + 40;
  p.moveTo(LANE_VIEW.centerX + side * boardsHalfWidthAt(yTop), yTop);
  p.lineTo(LANE_VIEW.centerX + side * laneHalfWidthAt(yTop), yTop);
  p.lineTo(LANE_VIEW.centerX + side * laneHalfWidthAt(yBottom), yBottom);
  p.lineTo(LANE_VIEW.centerX + side * boardsHalfWidthAt(yBottom), yBottom);
  p.closePath();
  ctx.save();
  ctx.clip(p);
  ctx.fillStyle = getGutterGrad(ctx);
  ctx.fillRect(0, yTop, LANE_VIEW.w, yBottom - yTop);
  ctx.restore();
}

let maskLogoPath: Path2D | null = null;
function getMaskLogo(): Path2D {
  if (!maskLogoPath) {
    const p = new Path2D();
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const cx = Math.cos(a) * 1;
      const cy = Math.sin(a) * 1;
      p.moveTo(cx, cy);
      p.bezierCurveTo(cx + 0.55, cy - 0.55, cx - 0.55, cy - 0.55, 0, 0);
    }
    p.closePath();
    maskLogoPath = p;
  }
  return maskLogoPath;
}

function drawMachineMask(
  ctx: CanvasRenderingContext2D,
  state: MachineState,
  hints: RenderHints,
  time: number,
): void {
  const w = laneHalfWidthAt(LANE_VIEW.backWallY) * 2.3;
  const h = 220;
  const cx = LANE_VIEW.centerX;
  const cy = LANE_VIEW.backWallY - h * 0.42;

  // 落ち着き無さ(異常)指標: ベルト振動 or 主電源オフ、あるいはスポットライトが
  // この付近を照らしているときに、扉の隙間が少し震えて光る。
  const vibrate = clamp01(state.belt.vibrate);
  const dead = state.powerOn ? 0 : 0.5;
  const spot = hints.spotlight && hints.spotlight.y < LANE_VIEW.backWallY + 180 ? hints.spotlight.strength : 0;
  const unrest = clamp01(vibrate * 0.85 + dead + spot * 0.4);
  const jitterX = unrest > 0.02 ? Math.sin(time * 47) * unrest * 2.6 + Math.sin(time * 12.3) * unrest * 1.3 : 0;

  ctx.save();
  ctx.translate(jitterX, 0);

  // 外枠(金属パネル)
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 18);
  const panelGrad = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
  panelGrad.addColorStop(0, '#5c6774');
  panelGrad.addColorStop(0.5, '#48515c');
  panelGrad.addColorStop(1, '#333a43');
  ctx.fillStyle = panelGrad;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#2a2f36';
  ctx.stroke();

  // カバー(ロゴ入り)
  const coverW = w * 0.62;
  const coverH = h * 0.66;
  ctx.beginPath();
  ctx.roundRect(cx - coverW / 2, cy - coverH / 2, coverW, coverH, 14);
  const coverGrad = ctx.createLinearGradient(cx - coverW / 2, cy - coverH / 2, cx + coverW / 2, cy + coverH / 2);
  coverGrad.addColorStop(0, '#8fd6de');
  coverGrad.addColorStop(1, '#5fb2bd');
  ctx.fillStyle = coverGrad;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(30,50,55,0.4)';
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy - 6);
  ctx.scale(20, 20);
  ctx.fillStyle = '#ffe38a';
  ctx.fill(getMaskLogo());
  ctx.beginPath();
  ctx.arc(0, 0, 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#ff8fb8';
  ctx.fill();
  ctx.restore();

  // 中央の扉の継ぎ目(奥へ進める気配の光)
  const doorGlow = 0.12 + 0.5 * unrest + 0.12 * Math.sin(time * 2.2) * unrest;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - coverW / 2, cy - coverH / 2, coverW, coverH);
  ctx.clip();
  ctx.strokeStyle = `rgba(40,32,20,${0.5 + unrest * 0.2})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - coverH / 2);
  ctx.lineTo(cx, cy + coverH / 2);
  ctx.stroke();
  if (doorGlow > 0.03) {
    const glow = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
    glow.addColorStop(0, 'rgba(255,214,120,0)');
    glow.addColorStop(0.5, `rgba(255,222,140,${doorGlow})`);
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 14, cy - coverH / 2, 28, coverH);
  }
  ctx.restore();

  ctx.restore();
}
