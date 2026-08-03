// ============================================================================
// src/ui/index.ts — 画面座標系オーバーレイUI。UIOverlay を公開。
// draw(ctx, layout, time) は dpr 適用済み・CSSピクセル=画面座標の前提で呼ばれる。
// ============================================================================
import type { Interactable, Layout, PointerInfo, Progress } from '../core/types';
import type { InputSystem } from '../core/input';
import type { LayoutManager } from '../core/layout';
import { bus } from '../core/events';
import { loadProgress } from '../core/save';

import type { UIAction, UIMode, UIState } from './actions';
import { getButtons, hitTest, buttonCenter } from './layout';
import {
  drawCurtain, drawCard, drawCircleButton, drawTitleLogo, popScale, pressScale,
} from './chrome';
import type { PressPhase } from './chrome';

export type { UIAction } from './actions';

const ALL_ACTIONS: UIAction[] = [
  'start', 'replay-same', 'replay-new', 'free-play', 'go-bowling',
  'toggle-xray', 'cycle-speed', 'toggle-mute', 'cycle-decor', 'exit-free',
];

const DECOR_ORDER: Progress['decoration'][] = ['classic', 'pink', 'rainbow', 'flower'];

const ENTER_STAGGER_MS = 90;
const ENTER_DUR_MS = 420;

export class UIOverlay {
  mode: UIMode = 'none';
  onAction: (a: UIAction) => void = () => { /* flowが差し替える */ };

  private lm: LayoutManager;
  private uiState: UIState = { muted: false, speedLevel: 1, decorIdx: 0, xray: false };
  private press = new Map<UIAction, { phase: PressPhase; t0: number }>();
  private lastMode: UIMode | null = null;
  private modeEnterTime = 0;

  constructor(lm: LayoutManager) {
    this.lm = lm;
    // 初期表示だけでも実際の保存値に寄せておく（ミュート/かざり）。
    // xray・速度は MachineState 側にしか無いため、既定値のまま(ui からは不可視)。
    try {
      const p = loadProgress();
      this.uiState.muted = p.muted;
      const idx = DECOR_ORDER.indexOf(p.decoration);
      this.uiState.decorIdx = idx >= 0 ? idx : 0;
    } catch {
      // 保存が読めなくても既定値で継続
    }
  }

  show(mode: UIMode): void {
    this.mode = mode;
  }

  register(input: InputSystem): void {
    for (const action of ALL_ACTIONS) {
      const item: Interactable = {
        id: action,
        scene: 'ui',
        enabled: () => this.mode !== 'none' && this.findButton(action) !== null,
        hit: (x: number, y: number) => {
          const b = this.findButton(action);
          return b ? hitTest(b, x, y) : false;
        },
        onDown: () => {
          if (!this.findButton(action)) return;
          this.press.set(action, { phase: 'down', t0: performance.now() });
        },
        onUp: (p: PointerInfo) => {
          const b = this.findButton(action);
          if (!b) { this.press.delete(action); return; }
          this.press.set(action, { phase: 'released', t0: performance.now() });
          if (hitTest(b, p.sx, p.sy)) {
            bus.emit('sfx', { id: 'tap' });
            this.applyLocalState(action);
            this.onAction(action);
          }
        },
      };
      input.register(item);
    }
  }

  draw(ctx: CanvasRenderingContext2D, layout: Layout, time: number): void {
    if (this.mode !== this.lastMode) {
      this.modeEnterTime = time;
      this.lastMode = this.mode;
    }
    if (this.mode === 'none') return;

    const buttons = getButtons(this.mode, layout, this.uiState);

    if (this.mode === 'title' || this.mode === 'replay') {
      const focus = buttons.find((b) => b.hero) ?? buttons[0];
      const fp = focus ? buttonCenter(focus) : { x: layout.w / 2, y: layout.h / 2 };
      drawCurtain(ctx, layout, fp.y);
    }

    if (this.mode === 'title') {
      const topY = layout.safe.top + Math.max(22, layout.h * 0.055);
      drawTitleLogo(ctx, layout, topY, time);
    }

    for (const b of buttons) {
      const enterT = (time - this.modeEnterTime - b.order * ENTER_STAGGER_MS) / ENTER_DUR_MS;
      const pop = popScale(enterT);
      if (pop <= 0) continue;
      const pr = this.press.get(b.id);
      const press = pr ? pressScale(pr.phase, time - pr.t0) : 1;
      const scale = pop * press;
      if (b.shape === 'card') {
        drawCard(ctx, b, scale, time);
      } else {
        drawCircleButton(ctx, b, scale, time, pr?.phase === 'down');
      }
    }
  }

  // ── 内部 ──────────────────────────────────────────────────────────
  private findButton(action: UIAction) {
    return getButtons(this.mode, this.lm.layout, this.uiState).find((b) => b.id === action) ?? null;
  }

  /** タップ直後にローカルの見た目状態を楽観的に更新する（真の状態は sim/flow 側）。 */
  private applyLocalState(action: UIAction): void {
    switch (action) {
      case 'toggle-mute':
        this.uiState.muted = !this.uiState.muted;
        break;
      case 'cycle-speed':
        this.uiState.speedLevel = ((this.uiState.speedLevel + 1) % 3) as 0 | 1 | 2;
        break;
      case 'cycle-decor':
        this.uiState.decorIdx = (this.uiState.decorIdx + 1) % DECOR_ORDER.length;
        break;
      case 'toggle-xray':
        this.uiState.xray = !this.uiState.xray;
        break;
      default:
        break;
    }
  }
}
