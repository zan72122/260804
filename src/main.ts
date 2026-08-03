import { Game } from "./game";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const game = new Game(canvas);

// Read-only handle for automated end-to-end tests.
declare global {
  interface Window { __lab: { snapshot: () => Record<string, unknown> }; }
}
window.__lab = { snapshot: () => game.snapshot() };

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
