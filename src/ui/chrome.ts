// ============================================================================
// src/ui/chrome.ts — カード/丸ボタンの共通描画、暗幕、タイトルロゴ、アニメ数式。
// ============================================================================
import type { Layout } from '../core/types';
import { roundRectPath, PALETTE, drawPlayTriangle } from './icons';
import type { ButtonSpec } from './layout';

const FONT_STACK =
  '"Hiragino Maru Gothic ProN", "Hiragino Kaku Gothic ProN", -apple-system, BlinkMacSystemFont, "Yu Gothic", system-ui, sans-serif';

/** 0→1 の弾むポップイン（elastic-out）。t<0 は 0、t>1 は 1 に飽和。 */
export function popScale(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export type PressPhase = 'idle' | 'down' | 'released';

/** 押下中はキュッと縮み、離すとちょっと弾んで戻る倍率。 */
export function pressScale(phase: PressPhase, elapsedMs: number): number {
  if (phase === 'down') {
    const t = Math.min(1, elapsedMs / 90);
    return 1 - 0.12 * t;
  }
  if (phase === 'released') {
    const t = Math.min(1, elapsedMs / 260);
    const bounce = Math.pow(2, -8 * t) * Math.sin((t * 9) ) ;
    return 0.88 + 0.12 * t + bounce * 0.05;
  }
  return 1;
}

/** 中心が明るい柔らかな暗幕（radialGradient）。下のシーンが透ける。 */
export function drawCurtain(ctx: CanvasRenderingContext2D, layout: Layout, focusY?: number): void {
  const cx = layout.w / 2;
  const cy = focusY ?? layout.h * 0.5;
  const outer = Math.hypot(layout.w, layout.h) * 0.62;
  const grad = ctx.createRadialGradient(cx, cy, outer * 0.05, cx, cy, outer);
  grad.addColorStop(0, 'rgba(24,18,38,0.30)');
  grad.addColorStop(0.55, 'rgba(20,15,32,0.55)');
  grad.addColorStop(1, 'rgba(14,10,24,0.80)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, layout.w, layout.h);
}

function cardGradient(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): CanvasGradient {
  void w;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(255,255,255,0.97)');
  grad.addColorStop(1, 'rgba(255,255,255,0.90)');
  return grad;
}

/** 角丸カードボタン（replay等）。scale は中心基準の拡縮（ポップ+押下）。 */
export function drawCard(
  ctx: CanvasRenderingContext2D, b: ButtonSpec, scale: number, time: number,
): void {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(Math.max(0.001, scale), Math.max(0.001, scale));
  ctx.translate(-cx, -cy);

  const r = Math.min(b.w, b.h) * 0.14;

  ctx.save();
  ctx.shadowColor = 'rgba(20,14,30,0.35)';
  ctx.shadowBlur = b.hero ? 26 : 16;
  ctx.shadowOffsetY = b.hero ? 10 : 6;
  roundRectPath(ctx, b.x, b.y, b.w, b.h, r);
  ctx.fillStyle = cardGradient(ctx, b.x, b.y, b.w, b.h);
  ctx.fill();
  ctx.restore();

  // アクセントの縁取りバンド（上部）
  ctx.save();
  roundRectPath(ctx, b.x, b.y, b.w, b.h, r);
  ctx.clip();
  const band = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h * 0.5);
  band.addColorStop(0, b.accent + '55');
  band.addColorStop(1, b.accent + '00');
  ctx.fillStyle = band;
  ctx.fillRect(b.x, b.y, b.w, b.h * 0.5);
  ctx.restore();

  roundRectPath(ctx, b.x, b.y, b.w, b.h, r);
  ctx.lineWidth = b.hero ? 5 : 3.5;
  ctx.strokeStyle = b.accent;
  ctx.stroke();

  if (b.hero) {
    // 星バッジ的なグロー（最重要ボタンを目立たせる）
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(time / 420);
    roundRectPath(ctx, b.x - 3, b.y - 3, b.w + 6, b.h + 6, r + 3);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + pulse * 0.25})`;
    ctx.stroke();
    ctx.restore();
  }

  const iconSize = Math.min(b.w, b.h) * (b.hero ? 0.56 : 0.5);
  const iconCy = cy - (b.caption ? Math.min(b.w, b.h) * 0.07 : 0);
  b.icon(ctx, cx, iconCy, iconSize, time);

  if (b.caption) {
    ctx.font = `700 ${Math.max(11, Math.min(b.w, b.h) * (b.hero ? 0.075 : 0.1))}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.ink;
    const ty = b.y + b.h - Math.min(b.w, b.h) * 0.14;
    wrapText(ctx, b.caption, cx, ty, b.w * 0.9, Math.max(12, Math.min(b.w, b.h) * 0.11));
  }

  ctx.restore();
}

/** 丸ボタン（mute/freeplayアイコン等）。 */
export function drawCircleButton(
  ctx: CanvasRenderingContext2D, b: ButtonSpec, scale: number, time: number, pressed: boolean,
): void {
  const cx = b.x, cy = b.y, r = b.w / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(Math.max(0.001, scale), Math.max(0.001, scale));
  ctx.translate(-cx, -cy);

  ctx.save();
  ctx.shadowColor = 'rgba(20,14,30,0.4)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = pressed ? 'rgba(20,16,32,0.66)' : 'rgba(28,22,42,0.5)';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.stroke();

  b.icon(ctx, cx, cy, r * 1.35, time);

  if (b.caption) {
    const fontSize = b.hero ? Math.max(16, r * 0.24) : Math.max(11, r * 0.34);
    const above = b.captionPos === 'above';
    const ty = above ? cy - r - fontSize * 0.7 : cy + r + fontSize * 0.95;
    ctx.font = `800 ${fontSize}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = fontSize * 0.22;
    ctx.strokeStyle = PALETTE.ink;
    ctx.strokeText(b.caption, cx, ty);
    ctx.fillStyle = b.hero ? PALETTE.white : 'rgba(255,255,255,0.92)';
    ctx.fillText(b.caption, cx, ty);
  }
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxWidth: number, lineHeight: number): void {
  // 日本語向け: スペースが無い前提で、幅を超えたら文字単位で改行
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ch === ' ') {
      if (cur) lines.push(cur);
      cur = '';
      continue;
    }
    const test = cur + ch;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, startY + i * lineHeight);
  });
}

const LOGO_LINES = ['ガコン！くるん！', 'レーンのうらがわ こうじょう'];
const LOGO_COLORS = [PALETTE.pink, PALETTE.sun, PALETTE.sky, PALETTE.mintDeep, PALETTE.lavenderDeep];

/** かわいいレタリング風タイトルロゴ。1文字ずつ色と浮遊アニメを変える。 */
export function drawTitleLogo(ctx: CanvasRenderingContext2D, layout: Layout, topY: number, time: number): number {
  const isPortrait = layout.orientation === 'portrait';
  const maxLineChars = Math.max(...LOGO_LINES.map((l) => [...l].length));
  const fontSize = Math.max(22, Math.min(layout.w / (maxLineChars * 0.62), isPortrait ? 56 : 46));
  const lineHeight = fontSize * 1.18;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${fontSize}px ${FONT_STACK}`;

  let cursorY = topY + lineHeight * 0.5;
  let globalIdx = 0;
  for (const line of LOGO_LINES) {
    const chars = [...line];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const totalW = widths.reduce((a, w) => a + w, 0);
    let x = layout.w / 2 - totalW / 2;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const w = widths[i];
      const cx = x + w / 2;
      const bob = Math.sin(time / 480 + globalIdx * 0.5) * fontSize * 0.05;
      const color = LOGO_COLORS[globalIdx % LOGO_COLORS.length];
      ctx.save();
      ctx.translate(cx, cursorY + bob);
      // ドロップシャドウ
      ctx.shadowColor = 'rgba(20,10,30,0.5)';
      ctx.shadowBlur = fontSize * 0.14;
      ctx.shadowOffsetY = fontSize * 0.06;
      // 縁取り
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = fontSize * 0.16;
      ctx.strokeStyle = PALETTE.ink;
      ctx.strokeText(ch, 0, 0);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = color;
      ctx.fillText(ch, 0, 0);
      ctx.lineWidth = fontSize * 0.05;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.strokeText(ch, -fontSize * 0.02, -fontSize * 0.02);
      ctx.restore();
      x += w;
      globalIdx++;
    }
    cursorY += lineHeight;
  }
  return cursorY;
}

export function drawPlayBadgeGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, time: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(time / 500);
  ctx.beginPath();
  ctx.arc(cx, cy, r * (1 + pulse * 0.06), 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.25})`;
  ctx.lineWidth = 3;
  ctx.stroke();
  drawPlayTriangle(ctx, cx, cy, r * 0.5);
}
