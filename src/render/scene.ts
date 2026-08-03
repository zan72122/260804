// src/render/scene.ts
// 所有: A2 (sim/render)。これは A1 が用意した最小スタブ実装。
// scene.render は冒頭で layout.camera 変換を ctx に適用し、背景+機械+fault.render+mechanic+effects を呼ぶ。

import type { GameState } from '../core/types';
import { layout } from '../core/layout';
import { mechanic } from './mechanic';
import { effects } from './effects';

const LOCATION_BG: Record<0 | 1 | 2, string> = {
  0: '#ffe9de', // モール: ピーチ/クリーム
  1: '#dbe7f2', // 駅: ブルー/グレー
  2: '#cdeff0'  // 水族館: アクア/深青
};

export const scene: {
  render(ctx: CanvasRenderingContext2D, state: GameState): void;
} = {
  render(ctx: CanvasRenderingContext2D, state: GameState) {
    const { w, h, dpr } = layout;

    // 背景(スクリーン座標、カメラ変換の影響を受けない)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = LOCATION_BG[state.location] ?? '#eeeeee';
    ctx.fillRect(0, 0, w, h);

    // カメラ変換を適用(ワールド座標での描画はここから)
    ctx.translate(w / 2, h / 2);
    ctx.scale(layout.camera.scale, layout.camera.scale);
    ctx.translate(-layout.camera.cx, -layout.camera.cy);

    // TODO(A2): エスカレーター本体(輪・ステップ・チェーン・ローラー・手すり)の描画。
    // スタブ: 簡易な矩形でおおよその通路を示す。
    const model = state.escalator;
    ctx.save();
    ctx.strokeStyle = '#8892a0';
    ctx.lineWidth = 6;
    ctx.beginPath();
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const p = model.pathPoint(i / steps);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    if (state.fault) {
      state.fault.render(ctx, state);
    }

    mechanic.render(ctx, state);
    effects.render(ctx, state);

    // 描画後は変換をリセット(次フレームの誤累積防止)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
};
