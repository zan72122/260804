import { Game } from './game.js';

const canvas = document.getElementById('view');

function hasWebGL2() {
  try {
    // 判定は使い捨ての canvas で行う（本番 canvas の context 属性を壊さないため）
    return !!document.createElement('canvas').getContext('webgl2');
  } catch (e) {
    return false;
  }
}

if (!hasWebGL2()) {
  document.getElementById('fallback').hidden = false;
  document.getElementById('fallback').textContent = 'WebGL2 が使えません / WebGL2 is required';
  canvas.hidden = true;
} else {
  const ui = {
    root: document.getElementById('ui'),
    capsule: document.getElementById('btn-capsule'),
    box: document.getElementById('btn-box'),
    play: document.getElementById('btn-play'),
    build: document.getElementById('btn-build'),
  };

  const game = new Game(canvas, ui);
  window.__game = game;

  const onResize = () => game.resize();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 120));

  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // iOS の二本指ズームやダブルタップ拡大を止める
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
}
