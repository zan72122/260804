// ============================================================================
// ピット(PIT) + 回収ベルト(BELT_PATH/BELT_Y) + 張力ローラー(ROLLER)。
// ============================================================================
import type { MachineState } from '../../core/types';
import { PIT, BELT_PATH, BELT_CORNER_T, ROLLER, pathLength, pointOnPath } from '../../core/geometry';
import { cachedLinear, cachedRadial, clamp, roundRectPath } from './util';
import type { Accent } from './decoration';

export function drawPit(ctx: CanvasRenderingContext2D, time: number): void {
  const { x, y, w, h } = PIT;
  ctx.save();

  // 掘り込み影
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRectPath(ctx, x - 8, y - 6, w + 16, h + 24, 18);
  ctx.fill();

  // ゴム床
  const floor = cachedLinear(ctx, 'pit-floor', x, y, x, y + h, [
    [0, '#232323'], [0.5, '#1a1a1a'], [1, '#0d0d0d'],
  ]);
  roundRectPath(ctx, x, y, w, h, 14);
  ctx.fillStyle = floor;
  ctx.fill();

  // ゴム床のうねうね質感（横線）
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 3;
  for (let ly = y + 16; ly < y + h; ly += 18) {
    ctx.beginPath();
    ctx.moveTo(x + 8, ly);
    ctx.lineTo(x + w - 8, ly);
    ctx.stroke();
  }

  ctx.restore();

  // クッションカーテン（上端からぶら下がる短冊、ゆらゆら揺れる）
  const strips = 8;
  const sw = w / strips;
  for (let i = 0; i < strips; i++) {
    const sx = x + i * sw;
    const sway = Math.sin(time * 1.6 + i * 0.7) * 4;
    ctx.save();
    ctx.globalAlpha = 0.85;
    const g = ctx.createLinearGradient(sx, y - 30, sx, y + 30);
    g.addColorStop(0, 'rgba(60,30,30,0.95)');
    g.addColorStop(1, 'rgba(30,15,15,0.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(sx + 1, y - 34);
    ctx.lineTo(sx + sw - 1, y - 34);
    ctx.lineTo(sx + sw - 1 + sway, y + 26);
    ctx.lineTo(sx + 1 + sway, y + 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

/** ROLLER位置の詰まり変形を考慮したベルト経路点を返す */
function deformedBeltPath(state: MachineState): Array<[number, number]> {
  const derail = state.belt.derail;
  return BELT_PATH.map(([px, py], i) => {
    if (derail <= 0) return [px, py] as [number, number];
    // ROLLER付近(t~0.72)の点ほど大きく垂れ下がる
    const t = i / (BELT_PATH.length - 1);
    const near = Math.max(0, 1 - Math.abs(t - BELT_CORNER_T) * 4);
    return [px, py + derail * near * 46] as [number, number];
  });
}

export function drawBelt(ctx: CanvasRenderingContext2D, state: MachineState, time: number): void {
  const vib = state.belt.vibrate;
  const jitterX = vib > 0 ? Math.sin(time * 55) * vib * 4 : 0;
  const jitterY = vib > 0 ? Math.cos(time * 61) * vib * 3 : 0;

  const path = deformedBeltPath(state);
  const halfW = 20;

  ctx.save();
  ctx.translate(jitterX, jitterY);

  // ベルト本体（帯を太線で表現）
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 影
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = halfW * 2 + 8;
  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1] + 6);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1] + 6);
  ctx.stroke();

  // ゴム本体グラデーション（縦方向の簡易グラデを都度作ると重いので単色+ハイライトで質感）
  ctx.strokeStyle = '#111318';
  ctx.lineWidth = halfW * 2;
  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = halfW * 2 - 8;
  ctx.beginPath();
  ctx.moveTo(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i][0], path[i][1]);
  ctx.stroke();

  // 流れる縞（state.belt.offsetで実際に流れる）
  const total = pathLength(path);
  const spacing = 34;
  const stripeCount = Math.ceil(total / spacing) + 2;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < stripeCount; i++) {
    const along = ((i * spacing - state.belt.offset) % total + total) % total;
    const t = along / total;
    const p = pointOnPath(path, t);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillRect(-3, -(halfW - 4), 6, (halfW - 4) * 2);
    ctx.restore();
  }

  // 端のローラー（黒いドラム）
  const endCaps: Array<[number, number]> = [path[0], path[path.length - 1]];
  for (const [ex, ey] of endCaps) {
    const rg = cachedRadial(ctx, `belt-endcap-${ex}-${ey}`, ex - 6, ey - 6, 2, ex, ey, halfW + 6, [
      [0, '#4a4f57'], [0.55, '#1c1f24'], [1, '#050607'],
    ]);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(ex, ey, halfW * 0.62, halfW + 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawRoller(ctx: CanvasRenderingContext2D, state: MachineState, accent: Accent): void {
  const { x, y, r } = ROLLER;
  const derail = state.belt.derail;

  ctx.save();
  ctx.translate(x, y);

  // 取付ブラケット
  ctx.fillStyle = '#20262f';
  roundRectPath(ctx, -10, -r - 20, 20, 24, 5);
  ctx.fill();

  // ドラム本体
  const drum = cachedRadial(ctx, 'roller-drum', -8, -8, 2, 0, 0, r, [
    [0, '#3d434c'], [0.55, '#22262c'], [1, '#0a0c0f'],
  ]);
  ctx.fillStyle = drum;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // スポーク（回転が見える）
  ctx.save();
  ctx.rotate(state.belt.rollerAngle);
  ctx.strokeStyle = 'rgba(200,210,225,0.35)';
  ctx.lineWidth = 5;
  const spokes = 6;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6));
    ctx.stroke();
  }
  ctx.restore();

  // ハブ
  ctx.fillStyle = '#565f6b';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();

  // 外れているとき: ベルトが外れているのでリング状ハイライトを弱め、少し露出した雰囲気に
  if (derail > 0.05) {
    ctx.strokeStyle = `rgba(255,180,90,${clamp(derail, 0, 1) * 0.55})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r + 8, 0, Math.PI * 2 * clamp(derail, 0, 1));
    ctx.stroke();
  } else {
    ctx.strokeStyle = `${accent.a}55`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
