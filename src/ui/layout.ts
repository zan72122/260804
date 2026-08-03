// ============================================================================
// src/ui/layout.ts — モード×orientation×safe area からボタン配置(幾何)を計算する
// 純関数群。当たり判定(hit)と描画(draw)の両方がここから同じ矩形を読むことで
// 見た目とヒットエリアのズレを防ぐ。
// ============================================================================
import type { Layout } from '../core/types';
import type { UIAction, UIMode, UIState } from './actions';

export type ButtonShape = 'card' | 'circle';

export interface ButtonSpec {
  id: UIAction;
  shape: ButtonShape;
  /** card: 左上基準の矩形。circle: 中心+直径(w=h)。 */
  x: number; y: number; w: number; h: number;
  /** 出現アニメのずらし順（0始まり）。 */
  order: number;
  caption: string;
  accent: string;
  /** アイコン描画（中心cx,cyとアイコン目安サイズを渡す）。 */
  icon: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, time: number) => void;
  /** trueなら特に目立たせる（replay-same等）。 */
  hero?: boolean;
  /** circleボタンの添え字キャプションを円の上/下どちらに出すか（画面端での食み出し防止）。既定 'below'。 */
  captionPos?: 'above' | 'below';
}

const MIN_HIT = 60;

/** ボタンrectのヒット判定用の実効半径/矩形を返す（見た目より大きめ・最小60px）。 */
export function hitTest(b: ButtonSpec, sx: number, sy: number): boolean {
  if (b.shape === 'circle') {
    const r = Math.max(b.w, MIN_HIT) / 2;
    const cx = b.x, cy = b.y;
    return Math.hypot(sx - cx, sy - cy) <= r;
  }
  const padX = Math.max(0, (MIN_HIT - b.w) / 2);
  const padY = Math.max(0, (MIN_HIT - b.h) / 2);
  return sx >= b.x - padX && sx <= b.x + b.w + padX && sy >= b.y - padY && sy <= b.y + b.h + padY;
}

export function buttonCenter(b: ButtonSpec): { x: number; y: number } {
  return b.shape === 'circle' ? { x: b.x, y: b.y } : { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

interface Usable { x: number; y: number; w: number; h: number }

function usableArea(layout: Layout, margin: number): Usable {
  return {
    x: layout.safe.left + margin,
    y: layout.safe.top + margin,
    w: layout.w - layout.safe.left - layout.safe.right - margin * 2,
    h: layout.h - layout.safe.top - layout.safe.bottom - margin * 2,
  };
}

// icons を遅延importせず直接importすると layout.ts が icons.ts に依存するだけなので問題ない
import {
  drawPinIcon, drawBallIcon, drawJammedReplay, drawWrench, drawQuestionGlow,
  drawHand, drawPinCluster, drawNote, drawHome, drawRibbon, drawSpeedGauge,
  drawXrayIcon, PALETTE,
} from './icons';

const DECOR_COLORS = [PALETTE.metal, PALETTE.pink, PALETTE.sun, PALETTE.lavender];

export function getButtons(mode: UIMode, layout: Layout, state: UIState): ButtonSpec[] {
  const out: ButtonSpec[] = [];
  const u = usableArea(layout, 14);

  // ミュートは title / hud で共通の右上小ボタン
  if (mode === 'title' || mode === 'hud') {
    const r = 44;
    out.push({
      id: 'toggle-mute', shape: 'circle', order: 1, caption: '',
      x: u.x + u.w - r / 2, y: u.y + r / 2, w: r, h: r,
      accent: 'rgba(30,24,46,0.45)',
      icon: (ctx, cx, cy, size, time) => drawNote(ctx, cx, cy, size * 0.62, state.muted),
    });
  }

  if (mode === 'title') {
    const portrait = layout.orientation === 'portrait';
    const d = Math.max(150, Math.min(portrait ? u.w * 0.62 : u.h * 0.62, 250));
    const cx = u.x + u.w / 2;
    const cy = portrait ? u.y + u.h * 0.66 : u.y + u.h * 0.58;
    const captionReserve = 44; // 「はじめる」添え字ぶんの下マージン
    out.push({
      id: 'start', shape: 'circle', order: 0, caption: 'はじめる', hero: true,
      x: cx, y: Math.min(cy, u.y + u.h - d / 2 - captionReserve), w: d, h: d,
      accent: PALETTE.pink,
      icon: (ctx, ccx, ccy, size, time) => {
        drawPinIcon(ctx, ccx - size * 0.06, ccy + size * 0.02, size * 0.78, { ring: PALETTE.pink });
        const bx = ccx + size * 0.32, by = ccy + size * 0.3;
        ctx.beginPath();
        ctx.arc(bx, by, size * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.mintDeep;
        ctx.fill();
        ctx.lineWidth = size * 0.03;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
        const r = size * 0.12;
        ctx.beginPath();
        ctx.moveTo(bx - r * 0.5, by - r * 0.8);
        ctx.lineTo(bx + r * 0.95, by);
        ctx.lineTo(bx - r * 0.5, by + r * 0.8);
        ctx.closePath();
        ctx.fillStyle = PALETTE.white;
        ctx.fill();
      },
    });
  }

  if (mode === 'replay') {
    const portrait = layout.orientation === 'portrait';
    const gap = 14;
    if (portrait) {
      const heroH = u.h * 0.42;
      out.push(replayButton('replay-same', u.x, u.y, u.w, heroH, 0, true));
      const rowY = u.y + heroH + gap;
      const rowH = u.h - heroH - gap;
      const cw = (u.w - gap * 2) / 3;
      out.push(replayButton('replay-new', u.x, rowY, cw, rowH, 1, false));
      out.push(replayButton('free-play', u.x + cw + gap, rowY, cw, rowH, 2, false));
      out.push(replayButton('go-bowling', u.x + (cw + gap) * 2, rowY, cw, rowH, 3, false));
    } else {
      const heroW = u.w * 0.46;
      out.push(replayButton('replay-same', u.x, u.y, heroW, u.h, 0, true));
      const colX = u.x + heroW + gap;
      const colW = u.w - heroW - gap;
      const rh = (u.h - gap * 2) / 3;
      out.push(replayButton('replay-new', colX, u.y, colW, rh, 1, false));
      out.push(replayButton('free-play', colX, u.y + rh + gap, colW, rh, 2, false));
      out.push(replayButton('go-bowling', colX, u.y + (rh + gap) * 2, colW, rh, 3, false));
    }
  }

  if (mode === 'freeplay') {
    const r = 68;
    const half = r / 2;
    out.push({
      id: 'toggle-xray', shape: 'circle', order: 0, caption: 'すけすけ',
      x: u.x + half, y: u.y + half, w: r, h: r,
      accent: state.xray ? PALETTE.skyDeep : 'rgba(30,24,46,0.5)',
      icon: (ctx, cx, cy, size) => drawXrayIcon(ctx, cx, cy, size, state.xray),
    });
    out.push({
      id: 'cycle-decor', shape: 'circle', order: 1, caption: 'かざり',
      x: u.x + u.w - half, y: u.y + half, w: r, h: r,
      accent: 'rgba(30,24,46,0.5)',
      icon: (ctx, cx, cy, size) => drawRibbon(ctx, cx, cy, size * 0.66, DECOR_COLORS[state.decorIdx % DECOR_COLORS.length]),
    });
    out.push({
      id: 'exit-free', shape: 'circle', order: 2, caption: 'もどる', captionPos: 'above',
      x: u.x + half, y: u.y + u.h - half, w: r, h: r,
      accent: 'rgba(30,24,46,0.5)',
      icon: (ctx, cx, cy, size) => drawHome(ctx, cx, cy, size * 0.62),
    });
    out.push({
      id: 'cycle-speed', shape: 'circle', order: 3, caption: 'はやさ', captionPos: 'above',
      x: u.x + u.w - half, y: u.y + u.h - half, w: r, h: r,
      accent: 'rgba(30,24,46,0.5)',
      icon: (ctx, cx, cy, size) => drawSpeedGauge(ctx, cx, cy, size * 0.8, state.speedLevel),
    });
  }

  return out;

  function replayButton(id: UIAction, x: number, y: number, w: number, h: number, order: number, hero: boolean): ButtonSpec {
    const captions: Record<string, string> = {
      'replay-same': 'おなじつまりを もういちど',
      'replay-new': 'べつのこしょう',
      'free-play': 'じゆうにあそぶ',
      'go-bowling': 'ボウリング',
    };
    const accents: Record<string, string> = {
      'replay-same': PALETTE.pink,
      'replay-new': PALETTE.sun,
      'free-play': PALETTE.mint,
      'go-bowling': PALETTE.sky,
    };
    const icons: Record<string, (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, time: number) => void> = {
      'replay-same': (ctx, cx, cy, size, time) => drawJammedReplay(ctx, cx, cy, size, time),
      'replay-new': (ctx, cx, cy, size, time) => {
        drawWrench(ctx, cx - size * 0.14, cy + size * 0.06, size * 0.72);
        drawQuestionGlow(ctx, cx + size * 0.32, cy - size * 0.3, size * 0.46, time);
      },
      'free-play': (ctx, cx, cy, size) => {
        drawPinCluster(ctx, cx - size * 0.08, cy - size * 0.12, size * 0.72);
        drawHand(ctx, cx + size * 0.3, cy + size * 0.3, size * 0.56);
      },
      'go-bowling': (ctx, cx, cy, size) => {
        drawBallIcon(ctx, cx - size * 0.2, cy + size * 0.16, size * 0.28);
        drawPinIcon(ctx, cx + size * 0.24, cy - size * 0.08, size * 0.62, { ring: PALETTE.sky });
      },
    };
    return {
      id, shape: 'card', x, y, w, h, order, hero,
      caption: captions[id], accent: accents[id], icon: icons[id],
    };
  }
}
