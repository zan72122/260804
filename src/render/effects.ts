// src/render/effects.ts
// 所有: A6 (character/ui) — パーティクル(5種)+ヒント用グロー。
// 軽量プール(最大300)で使い回す。CONTRACT の effects API を実装する。

import type { GameState } from '../core/types';
import { bus } from '../core/events';

type BurstKind = 'spark' | 'star' | 'confetti' | 'dust' | 'shine';

interface Particle {
  active: boolean;
  kind: BurstKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
  sway: number;
  big: boolean; // shine: 中心フラッシュ用フラグ
}

const POOL_SIZE = 300;

const CONFETTI_COLORS = ['#ff8fab', '#ffd166', '#8ecae6', '#b892ff', '#95d5b2', '#ffb4a2'];
const STAR_COLORS = ['#ffd166', '#ff8fab', '#fff3b0'];
const DUST_COLORS = ['#e6d9c6', '#d8cbb8', '#f1e7d6'];

function makeParticle(): Particle {
  return {
    active: false,
    kind: 'spark',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    rot: 0,
    vrot: 0,
    size: 4,
    color: '#fff',
    sway: 0,
    big: false
  };
}

const pool: Particle[] = Array.from({ length: POOL_SIZE }, makeParticle);
let cursor = 0;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function pick<T>(arr: T[]): T {
  return arr[(Math.random() * arr.length) | 0];
}

function spawnOne(kind: BurstKind, x: number, y: number) {
  const p = pool[cursor];
  cursor = (cursor + 1) % POOL_SIZE;
  p.active = true;
  p.kind = kind;
  p.x = x;
  p.y = y;
  p.rot = rand(0, Math.PI * 2);
  p.sway = rand(0, Math.PI * 2);
  p.big = false;

  switch (kind) {
    case 'spark': {
      const a = rand(0, Math.PI * 2);
      const spd = rand(70, 160);
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = p.maxLife = rand(0.22, 0.4);
      p.size = rand(2.5, 5);
      p.vrot = 0;
      p.color = pick(['#fff8e1', '#ffd166', '#9be3ff']);
      break;
    }
    case 'star': {
      const a = rand(-Math.PI * 0.85, -Math.PI * 0.15);
      const spd = rand(20, 55);
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = p.maxLife = rand(0.6, 1.0);
      p.size = rand(6, 12);
      p.vrot = rand(-2, 2);
      p.color = pick(STAR_COLORS);
      break;
    }
    case 'confetti': {
      const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const spd = rand(60, 220);
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = p.maxLife = rand(1.1, 1.9);
      p.size = rand(5, 10);
      p.vrot = rand(-6, 6);
      p.color = pick(CONFETTI_COLORS);
      break;
    }
    case 'dust': {
      const a = rand(-Math.PI, 0);
      const spd = rand(15, 45);
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd - 15;
      p.life = p.maxLife = rand(0.45, 0.8);
      p.size = rand(3, 6);
      p.vrot = rand(-1, 1);
      p.color = pick(DUST_COLORS);
      break;
    }
    case 'shine': {
      const a = rand(0, Math.PI * 2);
      const spd = rand(10, 40);
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.rot = a;
      p.life = p.maxLife = rand(0.35, 0.55);
      p.size = rand(3, 6);
      p.vrot = 0;
      p.color = '#fffdf3';
      break;
    }
  }
}

const BURST_COUNTS: Record<BurstKind, number> = {
  spark: 10,
  star: 8,
  confetti: 28,
  dust: 12,
  shine: 14
};

let reducedMotionCached = false;

interface Glow {
  x: number;
  y: number;
  timer: number;
}
let glow: Glow | null = null;
const GLOW_DURATION = 3.2; // mechanic の pointAt 解除タイミングと合わせる

function doBurst(x: number, y: number, kind: BurstKind) {
  const base = BURST_COUNTS[kind];
  const count = Math.max(1, Math.round(base * (reducedMotionCached ? 0.25 : 1)));
  for (let i = 0; i < count; i++) spawnOne(kind, x, y);

  if (kind === 'shine') {
    // 中心の「ピカーン」フラッシュを1個追加
    spawnOne('shine', x, y);
    const p = pool[(cursor - 1 + POOL_SIZE) % POOL_SIZE];
    p.big = true;
    p.size = reducedMotionCached ? 14 : 26;
    p.vx = 0;
    p.vy = 0;
    p.life = p.maxLife = 0.4;
  }
}

// hint: 点検灯グローを自動発火(A5 が bus.emit('hint',...) する)
bus.on('hint', (e) => {
  glow = { x: e.x, y: e.y, timer: GLOW_DURATION };
});

// celebrate: 紙吹雪を自動発火(A5 との二重発火を避けるため bus 経由のみ)
bus.on('celebrate', () => {
  doBurst(-60, -260, 'confetti');
  doBurst(60, -260, 'confetti');
  doBurst(0, -300, 'confetti');
});

export const effects: {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, state: GameState): void;
  burst(x: number, y: number, kind: BurstKind): void;
  glowAt(x: number, y: number): void;
  clearGlow(): void;
} = {
  update(dt: number) {
    for (const p of pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.kind === 'confetti') p.vy += 260 * dt;
      else if (p.kind === 'star') p.vy += 40 * dt;
      else if (p.kind === 'dust') p.vy += 6 * dt;

      p.x += p.vx * dt + Math.sin(p.sway + p.life * 6) * (p.kind === 'confetti' ? 12 : 4) * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      p.vx *= 1 - Math.min(1, dt * 1.2);
    }

    if (glow) {
      glow.timer -= dt;
      if (glow.timer <= 0) glow = null;
    }
  },

  render(ctx: CanvasRenderingContext2D, state: GameState) {
    reducedMotionCached = state.settings.reducedMotion;

    if (glow) {
      ctx.save();
      const pulse = reducedMotionCached ? 0.55 : 0.35 + Math.sin(state.time * 6) * 0.25;
      const r = 46;
      const grad = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, r);
      grad.addColorStop(0, `rgba(255,143,171,${0.55 * pulse + 0.15})`);
      grad.addColorStop(1, 'rgba(255,143,171,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(glow.x, glow.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const p of pool) {
      if (!p.active) continue;
      const t = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = t;
      ctx.translate(p.x, p.y);
      drawParticle(ctx, p, t);
      ctx.restore();
    }
  },

  burst(x: number, y: number, kind: BurstKind) {
    doBurst(x, y, kind);
  },

  glowAt(x: number, y: number) {
    glow = { x, y, timer: GLOW_DURATION };
  },

  clearGlow() {
    glow = null;
  }
};

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, t: number) {
  switch (p.kind) {
    case 'spark': {
      const ang = Math.atan2(p.vy, p.vx);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * -p.size * 1.4, Math.sin(ang) * -p.size * 1.4);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'star': {
      ctx.rotate(p.rot);
      drawStar(ctx, p.size, p.color);
      break;
    }
    case 'confetti': {
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size * 0.5, -p.size * 0.35, p.size, p.size * 0.7);
      break;
    }
    case 'dust': {
      ctx.fillStyle = p.color;
      ctx.globalAlpha *= 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * (0.6 + 0.4 * (1 - t)), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'shine': {
      if (p.big) {
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(p.rot) * p.size * 2.2, Math.sin(p.rot) * p.size * 2.2);
        ctx.stroke();
      }
      break;
    }
  }
}

function drawStar(ctx: CanvasRenderingContext2D, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size : size * 0.42;
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
