/* =========================================================
   main.js — 起動
   ========================================================= */
import { Game } from './game.js';

function boot() {
  const gl = document.getElementById('gl');
  const hud = document.getElementById('hud');
  const game = new Game(gl, hud);
  window.Game = game;

  function resize() {
    const w = Math.round(document.documentElement.clientWidth);
    const h = Math.round(window.innerHeight);
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    gl.style.width = w + 'px'; gl.style.height = h + 'px';
    hud.style.width = w + 'px'; hud.style.height = h + 'px';
    game.resize(w, h, dpr);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 140));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  resize();

  let last = 0;
  function frame(ts) {
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    dt = Math.max(0, Math.min(dt, 0.05));
    /* paused は検証用のフック。通常のプレイでは常に false */
    if (!game.paused) { game.update(dt); game.render(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.body.classList.add('ready');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
