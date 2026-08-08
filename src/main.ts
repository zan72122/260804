import './style.css';
import { Stage } from './core/stage';
import { Hints } from './ui/hints';
import { Game } from './game/game';
import { FISH_KINDS, makeFish } from './world/fish';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLCanvasElement;
const replay = document.getElementById('replay') as HTMLButtonElement;

const stage = new Stage(canvas);
const hints = new Hints(overlay);
const game = new Game(stage, hints, replay);

function layout(): void {
  stage.resize();
  hints.resize(stage.width, stage.height, Math.min(window.devicePixelRatio || 1, 2));
  game.layoutForOrientation();
}
layout();

// iOS fires resize late on rotation and again when the URL bar settles.
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => {
  layout();
  window.setTimeout(layout, 120);
  window.setTimeout(layout, 450);
});
if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);

let last = performance.now();
let running = true;

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  last = performance.now();
});

function frame(now: number): void {
  requestAnimationFrame(frame);
  if (!running) return;
  // Clamp so a backgrounded tab never fast-forwards the evening.
  const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
  last = now;

  game.update(dt);
  hints.update(dt, stage);
  stage.render();
  stage.monitorPerf(dt);
}
requestAnimationFrame(frame);

// Handy for the automated play-through harness; harmless otherwise.
(window as unknown as Record<string, unknown>).__ukai = { stage, game };
(window as unknown as Record<string, unknown>).__mkFish = (i: number) =>
  makeFish(FISH_KINDS[i % FISH_KINDS.length], i + 1);
