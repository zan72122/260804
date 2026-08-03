// src/audio/engine.ts
// 所有: A4 (audio)。これは A1 が用意した最小スタブ実装。

import type { GameState } from '../core/types';
import { bus } from '../core/events';

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let initialized = false;

export const audio: {
  init(): void;
  update(dt: number, state: GameState): void;
  setVolume(v: number): void;
} = {
  init() {
    if (initialized) return;
    initialized = true;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        ctx = new AC();
        masterGain = ctx.createGain();
        masterGain.gain.value = 1;
        masterGain.connect(ctx.destination);
        if (ctx.state === 'suspended') {
          void ctx.resume();
        }
      }
    } catch {
      ctx = null;
    }

    // TODO(A4): sfx/loopStart/loopStop の購読と WebAudio 合成実装。
    bus.on('sfx', (_e) => {
      /* no-op stub */
    });
    bus.on('loopStart', (_e) => {
      /* no-op stub */
    });
    bus.on('loopStop', (_e) => {
      /* no-op stub */
    });
  },

  update(_dt: number, _state: GameState) {
    // TODO(A4): ループ音の状態同期など。
  },

  setVolume(v: number) {
    if (masterGain) {
      masterGain.gain.value = Math.max(0, Math.min(1, v));
    }
  }
};
