// src/render/mechanic.ts
// 所有: A6 (character/ui)。これは A1 が用意した最小スタブ実装。

import type { GameState } from '../core/types';

let pointTarget: { x: number; y: number } | null = null;

export const mechanic: {
  update(dt: number, state: GameState): void;
  render(ctx: CanvasRenderingContext2D, state: GameState): void;
  pointAt(x: number, y: number): void;
} = {
  update(_dt: number, _state: GameState) {
    // TODO(A6): ロボの状態更新(登場アニメ・視線など)。
  },

  render(ctx: CanvasRenderingContext2D, state: GameState) {
    // TODO(A6): 整備ロボの描画。
    if (state.phase === 'title') return;
    ctx.save();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(pointTarget ? pointTarget.x : 0, pointTarget ? pointTarget.y - 60 : -60, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  pointAt(x: number, y: number) {
    pointTarget = { x, y };
  }
};
