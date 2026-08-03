// src/ui/hud.ts
// 所有: A6 (character/ui)。これは A1 が用意した最小スタブ実装。

import type { GameState } from '../core/types';

export const hud: {
  init(state: GameState): void;
  sync(state: GameState): void;
} = {
  init(_state: GameState) {
    // TODO(A6): #hud にアイコンボタン等のDOMを構築。
    const el = document.getElementById('hud');
    if (!el) return;
    // スタブ段階では何も描画しない。
  },

  sync(_state: GameState) {
    // TODO(A6): stateに応じてHUD DOMを更新。
  }
};
