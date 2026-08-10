/* Rainbow Glass Tower — bootstrap, input forwarding, buttons. */
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
    forceRows: parseInt(params.get('rows') || '0', 10) || 0,
    onComplete: () => btnReplay.classList.remove('hidden'),
  });

  // ---- pointer forwarding: the game decides what each finger does
  //      (touch a stream = push it, a glass = tilt it, anywhere else = pour)
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.init();
    Sound.resume();
    Game.pointerDown(e.pointerId, e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', (e) => {
    Game.pointerMove(e.pointerId, e.clientX, e.clientY);
  });
  function release(e) {
    Game.pointerUp(e.pointerId);
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  window.addEventListener('blur', () => {
    Game.releaseAll();       // drop all touches if the page loses focus
    Sound.setPour(false);
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
    Game.reset(true);            // next drink theme
  });

  // ---- responsive / orientation ----
  window.addEventListener('resize', () => Game.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => Game.resize(), 250));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Sound.setPour(false);
    else Sound.resume();
  });

  // ---- headless test / demo hooks ----
  // ?script=tilt:0:0:1;grab:1:0:R:2:0;cloudgrab:1:1 — scripted inputs before ?sim
  if (params.has('script')) {
    setTimeout(() => {
      for (const cmd of params.get('script').split(';')) {
        const f = cmd.split(':');
        if (f[0] === 'tilt') Game.test.tilt(+f[1], +f[2], +f[3]);
        else if (f[0] === 'grab') Game.test.grab(+f[1], +f[2], f[3], +f[4], +f[5]);
        else if (f[0] === 'cloudgrab') Game.test.grabCloud(+f[1], +f[2]);
      }
    }, 300);
  }
  if (params.has('sim')) {
    const sec = parseFloat(params.get('sim')) || 10;
    setTimeout(() => {
      Game.simulate(sec);
      document.title = 'sim:' + JSON.stringify(Game.debug());
    }, 400);
  }
  if (params.has('bench')) {
    setTimeout(() => {
      const res = Game.bench(parseInt(params.get('bench') || '240', 10) || 240);
      document.title = 'bench:' + JSON.stringify(res);
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
