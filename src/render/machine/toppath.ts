// ============================================================================
// 上部搬送路(TOP_PATH): レール+小ローラー列。エレベーター上端→選別機→ラック投入口。
// ============================================================================
import { TOP_PATH, pathLength, pointOnPath } from '../../core/geometry';
import { cachedRadial } from './util';

export function drawTopPath(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();

  // 2本のレール（上下オフセット）
  for (const off of [-16, 16]) {
    ctx.strokeStyle = off < 0 ? '#7a8494' : '#4a525f';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (const [px, py] of TOP_PATH) {
      if (!started) { ctx.moveTo(px, py + off); started = true; } else ctx.lineTo(px, py + off);
    }
    ctx.stroke();
  }

  // 小ローラー列（等間隔、わずかに自転しているように見せる）
  const total = pathLength(TOP_PATH);
  const spacing = 50;
  const count = Math.floor(total / spacing);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const p = pointOnPath(TOP_PATH, t);
    const spin = time * 3 + i;
    ctx.save();
    ctx.translate(p.x, p.y);
    const rg = cachedRadial(ctx, `toproller-${i}`, -3, -3, 1, 0, 0, 12, [
      [0, '#c9d0da'], [0.6, '#7f8896'], [1, '#333a44'],
    ]);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(spin) * 8, Math.sin(spin) * 8);
    ctx.lineTo(-Math.cos(spin) * 8, -Math.sin(spin) * 8);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}
