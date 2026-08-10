/* Rainbow Glass Tower — bootstrap, input forwarding, buttons. */
'use strict';

(function () {
  const canvas = document.getElementById('game');
  const btnSound = document.getElementById('btn-sound');
  const btnReset = document.getElementById('btn-reset');
  const btnReplay = document.getElementById('btn-replay');
  const btnAlbum = document.getElementById('btn-album');
  const albumBadge = document.getElementById('album-badge');
  const albumOverlay = document.getElementById('album-overlay');
  const palette = document.getElementById('palette');

  const params = new URLSearchParams(location.search);
  const AUTO = params.has('auto');     // test/demo: pours by itself
  const TURBO = params.has('turbo');   // test: everything much faster

  if (Sound.isMuted()) btnSound.classList.add('muted');

  function refreshAlbumBadge() {
    if (!albumBadge) return;
    const n = Album.count();
    albumBadge.textContent = n > 0 ? String(n) : '';
    albumBadge.classList.toggle('hidden', n === 0);
  }

  Game.init(canvas, {
    turbo: TURBO,
    round: parseInt(params.get('round') || '0', 10) || 0,
    forceRows: parseInt(params.get('rows') || '0', 10) || 0,
    onComplete: () => {
      Album.save(Game.getTintGrid());
      refreshAlbumBadge();
      btnReplay.classList.remove('hidden');
    },
  });

  Palette.init({
    onPick: (t) => {
      Game.setBrush(t);
      if (t) Sound.pick();   // blip on a real pick, not on deselect
    },
  });
  Album.init();
  refreshAlbumBadge();       // show whatever survived a reload

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

  // ---- palette / album never leak into the canvas's input model ----
  // The palette bar and album overlay are DOM elements stacked above the
  // canvas, so a tap that lands on them never reaches canvas's own pointer
  // listeners in the first place. The one gap: the canvas never calls
  // setPointerCapture, so a finger that started a grab/tilt on the canvas and
  // then drags onto the palette (or is released there) stops delivering
  // pointermove/pointerup to canvas — Game would keep that deflector forever.
  // Treat any pointer activity on these panels as "this finger is UI now".
  if (palette) {
    palette.addEventListener('pointerdown', () => Game.releaseAll());
    palette.addEventListener('pointerup', () => Game.releaseAll());
  }
  if (albumOverlay) {
    albumOverlay.addEventListener('pointerdown', () => Game.releaseAll());
  }

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
  if (btnAlbum) {
    btnAlbum.addEventListener('click', () => {
      // A finger may still be down on the canvas (multi-touch) when the
      // album is opened from a second finger — release it so nothing is
      // left grabbing a stream while the overlay covers the tower.
      Game.releaseAll();
      Album.open();
    });
  }

  // ---- responsive / orientation ----
  window.addEventListener('resize', () => Game.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => Game.resize(), 250));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Sound.setPour(false);
    else Sound.resume();
  });

  // ---- headless test / demo hooks ----
  // ?script=tilt:0:0:1;grab:1:0:R:2:0;cloudgrab:1:1;paint:1:0:L:32:1 — scripted
  // inputs before ?sim
  if (params.has('script')) {
    setTimeout(() => {
      for (const cmd of params.get('script').split(';')) {
        const f = cmd.split(':');
        if (f[0] === 'tilt') Game.test.tilt(+f[1], +f[2], +f[3]);
        else if (f[0] === 'grab') Game.test.grab(+f[1], +f[2], f[3], +f[4], +f[5]);
        else if (f[0] === 'cloudgrab') Game.test.grabCloud(+f[1], +f[2]);
        else if (f[0] === 'paint') Game.test.paintStream(+f[1], +f[2], f[3], Tint.make(+f[4], +f[5]));
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
