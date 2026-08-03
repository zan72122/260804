// src/render/effects.ts
// 所有: A6 (character/ui)。これは A1 が用意した最小スタブ実装。

import type { GameState } from '../core/types';

interface Particle {
  x: number; y: number; life: number; kind: string;
}

let particles: Particle[] = [];
let glow: { x: number; y: number } | null = null;

export const effects: {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, state: GameState): void;
  burst(x: number, y: number, kind: 'spark' | 'star' | 'confetti' | 'dust' | 'shine'): void;
  glowAt(x: number, y: number): void;
  clearGlow(): void;
} = {
  update(dt: number) {
    // TODO(A6): パーティクルの寿命更新。
    particles = particles.filter((p) => {
      p.life -= dt;
      return p.life > 0;
    });
  },

  render(ctx: CanvasRenderingContext2D, _state: GameState) {
    // TODO(A6): パーティクル/グロー描画。
    if (glow) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff59d';
      ctx.beginPath();
      ctx.arc(glow.x, glow.y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  burst(x: number, y: number, kind: 'spark' | 'star' | 'confetti' | 'dust' | 'shine') {
    particles.push({ x, y, life: 0.6, kind });
  },

  glowAt(x: number, y: number) {
    glow = { x, y };
  },

  clearGlow() {
    glow = null;
  }
};
