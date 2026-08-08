/* =========================================================================
   main.js — canvas setup, iOS-safe input, resize/rotation, the frame loop
   ========================================================================= */
'use strict';

(function () {
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const gate = document.getElementById('gate');
  let started = false;
  let raf = 0, last = 0;

  /* ------------------------------------------------------------- resize */
  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    Cam.dpr = dpr;
    Game.W = w; Game.H = h;
    Game.portrait = h >= w;                       // rotation keeps all game state
    Game.focusCamera();
    Game.updateView();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => {
    // iOS reports the old size during the event — settle afterwards too
    resize();
    setTimeout(resize, 60);
    setTimeout(resize, 320);
  });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  /* -------------------------------------------------------------- input */
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDown(e) {
    if (!started) return;
    if (Ptr.id !== null) return;                  // strictly one finger
    Ptr.id = e.pointerId !== undefined ? e.pointerId : 0;
    const p = local(e);
    Ptr.begin(p.x, p.y);
    if (canvas.setPointerCapture && e.pointerId !== undefined) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    e.preventDefault();
  }
  function onMove(e) {
    if (!started) return;
    const id = e.pointerId !== undefined ? e.pointerId : 0;
    if (Ptr.id !== id) return;
    const p = local(e);
    Ptr.move(p.x, p.y);
    e.preventDefault();
  }
  function onUp(e) {
    if (!started) return;
    const id = e.pointerId !== undefined ? e.pointerId : 0;
    if (Ptr.id !== id) return;
    Ptr.id = null;
    Ptr.end();
    e.preventDefault();
  }

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', onUp, { passive: false });
  } else {
    // older iOS Safari
    const t2p = t => ({ clientX: t.clientX, clientY: t.clientY, pointerId: t.identifier,
                        preventDefault: () => {} });
    canvas.addEventListener('touchstart', e => { onDown(t2p(e.changedTouches[0])); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', e => { onMove(t2p(e.changedTouches[0])); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', e => { onUp(t2p(e.changedTouches[0])); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchcancel', e => { onUp(t2p(e.changedTouches[0])); e.preventDefault(); }, { passive: false });
  }
  // block the browser's own gestures (pinch zoom, double-tap zoom, rubber-band)
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(n =>
    document.addEventListener(n, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  document.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Sfx.stopAll(); if (Game.s) Game.s.grinder.run = 0; }
    else { Sfx.resume(); last = performance.now(); }
  });

  /* --------------------------------------------------------------- loop */
  function frame(now) {
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 1 / 20);                    // never let physics explode

    Ptr.sync(Game.W, Game.H, now / 1000, dt);
    Game.update(dt);

    ctx.setTransform(Cam.dpr, 0, 0, Cam.dpr, 0, 0);
    ctx.fillStyle = '#241713';
    ctx.fillRect(0, 0, Game.W, Game.H);
    Game.draw(ctx);
  }

  /* --------------------------------------------------------------- gate */
  function drawGateArt() {
    const gc = document.getElementById('gateArt');
    if (!gc) return;
    const g = gc.getContext('2d');
    g.clearRect(0, 0, 420, 420);
    g.save();
    g.translate(210, 250);
    g.scale(2.05, 2.05);
    // a latte with a heart — the promise of the game, no words needed
    Art.drawCup(g, 0, 0, { espresso: 1, milk: 1, crema: 1, style: 'cute', scale: 1 });
    // heart on the surface
    g.save();
    g.beginPath(); g.ellipse(0, -63, 40, 15, 0, 0, TAU); g.clip();
    g.fillStyle = '#b7794b'; g.fillRect(-46, -80, 92, 34);
    g.fillStyle = '#fffaf0';
    Art.heartPath(g, 0, -62, 46);
    g.save(); g.scale(1, 0.36); g.translate(0, -62 / 0.36 + 62 * 2.78);
    g.restore();
    g.fill();
    g.restore();
    g.restore();
    // steam + sparkles
    Art.steamWisps(g, 210, 118, 0.8, 1, 60, 90);
    g.fillStyle = '#ffd66b'; Art.starPath(g, 330, 120, 20, 9, 5); g.fill();
    g.fillStyle = '#ff9fbe'; Art.heartPath(g, 84, 96, 40); g.fill();
    g.fillStyle = '#fff3c4'; Art.starPath(g, 108, 300, 13, 6, 5); g.fill();
    g.fillStyle = '#b9e2f2'; Art.starPath(g, 322, 292, 16, 7, 5); g.fill();
  }

  function start(e) {
    if (started) return;
    started = true;
    Sfx.init();
    Sfx.resume();
    Sfx.sparkle(4, 660);
    gate.classList.add('hidden');
    setTimeout(() => { gate.style.display = 'none'; }, 500);
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
    if (e) e.preventDefault();
  }
  gate.addEventListener('pointerdown', start, { passive: false });
  gate.addEventListener('touchstart', start, { passive: false });
  gate.addEventListener('click', start);

  /* --------------------------------------------------------------- boot */
  Game.init();
  resize();
  Cam.snap();
  drawGateArt();
  // render one frame behind the gate so it is warm when the child taps
  ctx.setTransform(Cam.dpr, 0, 0, Cam.dpr, 0, 0);
  ctx.fillStyle = '#241713';
  ctx.fillRect(0, 0, Game.W, Game.H);
  Game.draw(ctx);

  // expose a little for the automated playtest harness
  window.__barista = { Game, Ptr, Cam, Fluid, Sfx, start, resize };
})();
