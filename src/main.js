import { Stage } from './core/stage.js';
import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { UI } from './ui/ui.js';
import { Game, STEPS } from './game/game.js';

const canvas = document.getElementById('stage');
const uiRoot = document.getElementById('ui');

let stage;
try {
  stage = new Stage(canvas);
} catch (err) {
  uiRoot.innerHTML =
    '<div class="veil"><h1>3Dが つかえません<small>WebGL</small></h1>' +
    '<p>この ブラウザでは えを だせませんでした。<br>Safari や Chrome の さいしんばんで ためしてね。</p></div>';
  throw err;
}

const input = new Input(canvas);
const ui = new UI(uiRoot, STEPS);
const game = new Game(stage, input, ui);

ui.onStart = () => {
  audio.resume();
  ui.hideTitle();
  game.start();
};
ui.onReplay = () => {
  audio.resume();
  ui.hideEnd();
  game.start();
};
ui.onMute = (m) => audio.setMuted(m);

// iOS は最初のタッチでしか音を鳴らしはじめられない
const wake = () => audio.resume();
window.addEventListener('pointerdown', wake, { once: true });
window.addEventListener('touchstart', wake, { once: true });

let last = performance.now();
let hidden = false;
document.addEventListener('visibilitychange', () => {
  hidden = document.hidden;
  if (hidden) audio.silenceAll();
  last = performance.now();
});

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
});
canvas.addEventListener('webglcontextrestored', () => {
  stage.resize();
});

function loop(now) {
  requestAnimationFrame(loop);
  if (hidden) return;
  // 1コマが長すぎたら間引く。戻ってきた瞬間に一気に進まないように。
  const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
  last = now;

  input.update(dt, stage.width, stage.height);
  game.update(dt);
  stage.update(dt);
  stage.render();
}
requestAnimationFrame(loop);

// 動作確認と自動試遊のための覗き窓。読むだけ。
window.__rope = { stage, game, input, ui, audio };
