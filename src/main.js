// ---------------------------------------------------------------------------
// Boot, wordless HUD, and the frame loop.
// ---------------------------------------------------------------------------

import { Game } from './game.js';

class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.hintEl = document.getElementById('hint');
    this.starEls = Array.from(document.querySelectorAll('#stars .pip'));
    this.progEl = document.getElementById('prog-fill');
    this.replayEl = document.getElementById('replay');
    this.hint = '';
  }

  setHint(name) {
    if (this.hint === name) return;
    this.hint = name;
    this.root.setAttribute('data-hint', name);
    this.replayEl.classList.toggle('on', name === 'replay');
  }

  setStars(n) {
    this.starEls.forEach((el, i) => el.classList.toggle('on', i < n));
  }

  setProgress(f) {
    this.progEl.style.transform = `scaleX(${Math.max(0, Math.min(1, f))})`;
    this.progEl.parentElement.classList.toggle('on', f > 0.01);
  }
}

function boot() {
  const canvas = document.getElementById('view');
  const hud = new Hud();
  const loading = document.getElementById('loading');
  const title = document.getElementById('title');

  // Let the loading screen paint before the (heavy) procedural build starts.
  requestAnimationFrame(() => setTimeout(() => {
    let game;
    try {
      game = new Game(canvas, hud);
    } catch (err) {
      loading.innerHTML = '<div class="sad">😿</div>';
      console.error(err);
      return;
    }
    window.__game = game;

    loading.classList.add('gone');
    title.classList.add('on');

    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      title.classList.remove('on');
      game.start();
    };
    title.addEventListener('pointerdown', (e) => { e.preventDefault(); begin(); });
    canvas.addEventListener('pointerdown', () => { if (!started) begin(); }, { capture: true });

    document.getElementById('replay').addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      game.reset();
    });

    const sound = document.getElementById('sound');
    sound.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const m = !sound.classList.contains('off');
      sound.classList.toggle('off', m);
      game.audio.setMuted(m);
    });

    let prev = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      let dt = (now - prev) / 1000;
      prev = now;
      if (dt > 0.05) dt = 0.05;
      game.update(dt);
      game.render();
    };
    requestAnimationFrame(loop);
  }, 60));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
