// src/game/flow.ts
// 所有: A5 (flow)。これは A1 が用意した最小スタブ実装。

import type { GameState } from '../core/types';
import { layout } from '../core/layout';

export const flow: {
  start(state: GameState): void;
  update(dt: number, state: GameState): void;
  layoutChanged(state: GameState): void;
} = {
  start(_state: GameState) {
    // TODO(A5): タイトル→noticeなどのゲームフロー開始処理。
    layout.setCameraTarget(0, -150, 1);
    layout.snapCamera();
  },

  update(_dt: number, _state: GameState) {
    // TODO(A5): フェーズ進行・idleSeconds加算・hint発火など。
  },

  layoutChanged(_state: GameState) {
    // TODO(A5): 画面回転時にフェーズに応じたカメラ目標を再設定。
    layout.setCameraTarget(layout.camera.cx, layout.camera.cy, layout.camera.scale);
  }
};
