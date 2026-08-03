// ============================================================================
// 背景: 機械室の壁（濃紺〜チャコール、リベット・配管シルエット）。
// 静的なので一度オフスクリーンcanvasへ焼き込み、以後は drawImage するだけ。
// ============================================================================
import { WORLD } from '../../core/geometry';
import { roundRectPath } from './util';
import { decorationStyle } from './decoration';

let baked: HTMLCanvasElement | null = null;
let bakedStyle = '';

function buildWall(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD.w;
  c.height = WORLD.h;
  const g = c.getContext('2d')!;

  // 基調グラデーション: 濃紺(上)→チャコール(下)
  const wall = g.createLinearGradient(0, 0, 0, WORLD.h);
  wall.addColorStop(0, '#141c2b');
  wall.addColorStop(0.55, '#1b2436');
  wall.addColorStop(1, '#0f141e');
  g.fillStyle = wall;
  g.fillRect(0, 0, WORLD.w, WORLD.h);

  // 緩やかな縦パネル分割線（工場壁パネル）
  g.strokeStyle = 'rgba(255,255,255,0.035)';
  g.lineWidth = 3;
  for (let x = 40; x < WORLD.w; x += 220) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, WORLD.h);
    g.stroke();
  }
  // 微かな水平スジ
  g.strokeStyle = 'rgba(0,0,0,0.15)';
  g.lineWidth = 2;
  for (let y = 80; y < WORLD.h; y += 140) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(WORLD.w, y);
    g.stroke();
  }

  // リベット（等間隔の小さなボルト頭）: 各パネル境界の上下に
  const rivet = (x: number, y: number): void => {
    const rg = g.createRadialGradient(x - 2, y - 2, 0.5, x, y, 6);
    rg.addColorStop(0, 'rgba(255,255,255,0.55)');
    rg.addColorStop(0.5, 'rgba(160,175,195,0.4)');
    rg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, 6, 0, Math.PI * 2);
    g.fill();
  };
  for (let x = 40; x < WORLD.w; x += 220) {
    for (let y = 30; y < WORLD.h; y += 140) {
      rivet(x, y);
      rivet(x + 220, y);
    }
  }

  // 配管シルエット（左上から右下へ数本、工場感を強調）
  const pipe = (
    pts: Array<[number, number]>, r: number, tone: string,
  ): void => {
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // 影
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = r * 2 + 4;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1] + 5);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1] + 5);
    g.stroke();
    // 本体
    const grad = g.createLinearGradient(0, pts[0][1] - r, 0, pts[0][1] + r);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(0.4, tone);
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.strokeStyle = grad;
    g.lineWidth = r * 2;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
    // ハイライト筋
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = Math.max(1, r * 0.35);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1] - r * 0.4);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1] - r * 0.4);
    g.stroke();
    g.restore();
  };
  pipe([[20, 40], [120, 40], [120, 200], [260, 200]], 12, 'rgba(90,105,125,0.8)');
  pipe([[WORLD.w - 30, 60], [WORLD.w - 150, 60], [WORLD.w - 150, 260]], 10, 'rgba(80,95,115,0.8)');
  pipe([[60, WORLD.h - 30], [60, WORLD.h - 200], [260, WORLD.h - 200], [260, WORLD.h - 340]], 9, 'rgba(70,85,105,0.75)');

  // 電線トレイ（水平の短い破線帯）
  g.strokeStyle = 'rgba(60,72,90,0.6)';
  g.lineWidth = 6;
  g.setLineDash([26, 14]);
  g.beginPath();
  g.moveTo(0, 100);
  g.lineTo(WORLD.w, 100);
  g.stroke();
  g.setLineDash([]);

  // 隅の薄い暗角（ビネット）で奥行き感
  const vig = g.createRadialGradient(
    WORLD.w * 0.5, WORLD.h * 0.4, WORLD.w * 0.25,
    WORLD.w * 0.5, WORLD.h * 0.4, WORLD.w * 0.8,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vig;
  g.fillRect(0, 0, WORLD.w, WORLD.h);

  // 装飾: 壁の四隅にほんのり差し色のランプ（工場だけどメルヘン、を控えめに）
  let tint = 'rgba(63,208,255,0.10)';
  if (decorationStyle === 'pink') tint = 'rgba(255,111,174,0.10)';
  else if (decorationStyle === 'flower') tint = 'rgba(255,183,3,0.10)';
  else if (decorationStyle === 'rainbow') tint = 'rgba(190,120,255,0.10)';
  g.fillStyle = tint;
  roundRectPath(g, 10, 10, 90, 40, 10);
  g.fill();
  roundRectPath(g, WORLD.w - 100, 10, 90, 40, 10);
  g.fill();

  return c;
}

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  if (!baked || bakedStyle !== decorationStyle) {
    baked = buildWall();
    bakedStyle = decorationStyle;
  }
  ctx.drawImage(baked, 0, 0);
}
