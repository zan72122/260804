// src/input/gestures.ts
// 所有: A3 (input)。これは A1 が用意した最小スタブ実装。

import type { Hotspot } from '../core/types';
import { bus } from '../core/events';

let hotspots: Hotspot[] = [];
let attachedCanvas: HTMLCanvasElement | null = null;

export const input: {
  attach(canvas: HTMLCanvasElement): void;
  setHotspots(h: Hotspot[]): void;
  update(dt: number): void;
  dragVisual(): { id: string; x: number; y: number } | null;
} = {
  attach(canvas: HTMLCanvasElement) {
    attachedCanvas = canvas;
    // TODO(A3): pointerdown/move/up によるタップ/スワイプ/ドラッグ/クランク/トレース/こすり判定を実装。
    // ここでは hotspot 'tap' の最低限の動作確認用にダミーの pointerdown ハンドラのみ用意。
    canvas.addEventListener('pointerdown', (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      if (hotspots.length > 0) {
        const hs = hotspots[0];
        bus.emit('hotspot', { id: hs.id, type: 'activated', x, y });
      }
    });
  },

  setHotspots(h: Hotspot[]) {
    hotspots = h;
  },

  update(_dt: number) {
    // TODO(A3): idle検知やドラッグ中の継続処理など。
  },

  dragVisual() {
    return null;
  }
};
