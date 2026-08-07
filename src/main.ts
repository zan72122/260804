import './ui/styles.css';
import { Game } from './game/game';

function boot() {
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  const bootEl = document.getElementById('boot') as HTMLElement;

  try {
    const game = new Game(canvas, ui);
    game.start();
    (window as unknown as { __game?: Game }).__game = game;
    // one extra frame before lifting the curtain, so nothing pops in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bootEl.classList.add('hide');
        window.setTimeout(() => bootEl.remove(), 800);
      });
    });
  } catch (err) {
    console.error(err);
    bootEl.innerHTML =
      '<div style="color:#eaf6ff;text-align:center;padding:24px;font-size:15px;line-height:1.7">' +
      '🌊<br/>WebGL を使えませんでした<br/>ブラウザを更新してみてください</div>';
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
