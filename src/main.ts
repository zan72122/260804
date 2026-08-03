import { Game } from './game/game';
import { AudioEngine } from './game/audio';
import { InputManager } from './game/input';
import { render } from './game/render';
import { attachTestApi } from './game/testapi';

const errors: string[] = [];
window.addEventListener('error', (e) => {
  errors.push(String(e.message ?? e));
});
window.addEventListener('unhandledrejection', (e) => {
  errors.push(`unhandledrejection: ${String(e.reason)}`);
});

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const audio = new AudioEngine();
const game = new Game(audio);
attachTestApi(game, errors);

const input = new InputManager(canvas, game, () => audio.unlock());

function safeInsets(): { top: number; right: number; bottom: number; left: number } {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string): number => {
    const v = cs.getPropertyValue(name).trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    top: read('--sat'),
    right: read('--sar'),
    bottom: read('--sab'),
    left: read('--sal'),
  };
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // DPR cap
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  input.reset();
  game.setViewport(w, h, safeInsets());
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
  // some browsers fire orientationchange before the new innerWidth settles
  setTimeout(resize, 60);
});
resize();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.suspend();
  else audio.resume();
});

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000); // clamp long frames
  last = now;
  try {
    game.update(dt);
    render(ctx, game);
  } catch (err) {
    errors.push(String(err));
    // keep the loop alive; a toddler must never see a frozen toy
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
