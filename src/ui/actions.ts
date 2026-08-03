// ============================================================================
// src/ui/actions.ts — UIAction 型のみを持つ小さなファイル。
// index.ts と layout.ts の循環importを避けるために分離。
// ============================================================================
export type UIAction =
  | 'start' | 'replay-same' | 'replay-new' | 'free-play' | 'go-bowling'
  | 'toggle-xray' | 'cycle-speed' | 'toggle-mute' | 'cycle-decor' | 'exit-free';

export type UIMode = 'none' | 'title' | 'replay' | 'freeplay' | 'hud';

/** UIOverlay が内部で管理する「見た目のためだけ」の楽観的な状態。
    MachineState / Progress の真の値は ui からは見えないため、タップ時にローカルで
    トグルして表示に反映する（詳細は最終レポートの契約逸脱要望を参照）。 */
export interface UIState {
  muted: boolean;
  speedLevel: 0 | 1 | 2;
  decorIdx: number; // 0..3 → classic/pink/rainbow/flower
  xray: boolean;
}

