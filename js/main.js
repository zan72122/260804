/* Rainbow Glass Tower — bootstrap, input, buttons. */
'use strict';

(function () {
  const canvas = document.getElementById('game');
  const btnSound = document.getElementById('btn-sound');
  const btnReset = document.getElementById('btn-reset');
  const btnReplay = document.getElementById('btn-replay');

  const params = new URLSearchParams(location.search);
  const AUTO = params.has('auto');     // test/demo: pours by itself
  const TURBO = params.has('turbo');   // test: everything much faster

  if (Sound.isMuted()) btnSound.classList.add('muted');

  Game.init(canvas, {
    turbo: TURBO,
    round: parseInt(params.get('round') || '0', 10) || 0,
    onComplete: () => btnReplay.classList.remove('hidden'),
  });

  // ---- pouring: press and hold anywhere on the canvas ----
  const activePointers = new Set();

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.init();
    Sound.resume();
    activePointers.add(e.pointerId);
    Game.tapAt(e.clientX, e.clientY);
    Game.setPouring(true, e.clientX);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (activePointers.has(e.pointerId)) Game.pointerMove(e.clientX);
  });
  function release(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size === 0) Game.setPouring(false);
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  window.addEventListener('blur', () => {
    activePointers.clear();
    Game.setPouring(false);
  });

  // stop iOS gestures (double-tap zoom, long-press magnifier)
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- buttons ----
  btnSound.addEventListener('click', () => {
    Sound.init();
    const muted = Sound.toggleMute();
    btnSound.classList.toggle('muted', muted);
  });
  btnReset.addEventListener('click', () => {
    btnReplay.classList.add('hidden');
    Game.reset(false);
  });
  btnReplay.addEventListener('click', () => {
    btnReplay.classList.add('hidden');
    Game.reset(true);            // next drink theme + next tower layout
  });

  // ---- responsive / orientation ----
  window.addEventListener('resize', () => Game.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => Game.resize(), 250));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Game.setPouring(false);
    else Sound.resume();
  });

  // ---- headless test / demo mode ----
  if (params.has('sim')) {
    const sec = parseFloat(params.get('sim')) || 10;
    setTimeout(() => {
      Game.simulate(sec);
      document.title = 'sim:' + JSON.stringify(Game.debug());
    }, 400);
  }
  if (AUTO) {
    setTimeout(() => {
      const tick = setInterval(() => {
        if (Game.getState() === 'play') Game.setPouring(true);
        else { Game.setPouring(false); clearInterval(tick); }
      }, 100);
    }, 600);
  }
  window.__RGT__ = Game;   // debug hook
})();
