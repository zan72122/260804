/* ============================================================
 *  main.js — 起動とメインループ
 * ============================================================ */
import { Game } from './game.js';

function boot() {
  const canvas = document.getElementById('stage');
  let game;
  try {
    game = new Game(canvas);
  } catch (err) {
    console.error(err);
    const t = document.getElementById('title');
    if (t) {
      t.innerHTML = '<div class="tcard"><h1>あれ？</h1>'
        + '<p class="sub">この ブラウザでは 3D を ひょうじ できません。<br>'
        + 'WebGL に たいおう した ブラウザで ひらいてね。</p></div>';
    }
    return;
  }

  // ページが隠れている間は掘進を止める
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.setDigging(false);
  });
  // ダブルタップ拡大などのブラウザ既定動作を抑止
  ['gesturestart', 'gesturechange', 'contextmenu'].forEach((ev) => {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.06, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 自動テスト用のフック
  window.__tbm = game;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
