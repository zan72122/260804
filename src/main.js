/* =========================================================================
   main.js — boot, canvases, iOS-safe input, resize/rotation, the frame loop
   ========================================================================= */
'use strict';

(function () {
  const glCanvas = document.getElementById('stage');
  const uiCanvas = document.getElementById('overlay');
  const gate = document.getElementById('gate');
  let started = false, raf = 0, last = 0, ready = false;

  /* ------------------------------------------------------------- resize */
  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    R3.resize(w, h, dpr);
    glCanvas.width = R3.W; glCanvas.height = R3.H;
    glCanvas.style.width = w + 'px'; glCanvas.style.height = h + 'px';
    UI.resize(w, h, Math.min(dpr, 2));
    G3.W = w; G3.H = h;
    G3.portrait = h >= w;
    G3.aimCamera();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => {
    resize(); setTimeout(resize, 60); setTimeout(resize, 320);
  });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  /* -------------------------------------------------------------- input */
  function local(e) {
    const r = uiCanvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDown(e) {
    if (!started || Ptr.id !== null) return;
    Ptr.id = e.pointerId !== undefined ? e.pointerId : 0;
    const p = local(e); Ptr.begin(p.x, p.y);
    if (uiCanvas.setPointerCapture && e.pointerId !== undefined) {
      try { uiCanvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    e.preventDefault();
  }
  function onMove(e) {
    if (!started) return;
    const id = e.pointerId !== undefined ? e.pointerId : 0;
    if (Ptr.id !== id) return;
    const p = local(e); Ptr.move(p.x, p.y);
    e.preventDefault();
  }
  function onUp(e) {
    if (!started) return;
    const id = e.pointerId !== undefined ? e.pointerId : 0;
    if (Ptr.id !== id) return;
    Ptr.id = null; Ptr.end();
    e.preventDefault();
  }
  if (window.PointerEvent) {
    uiCanvas.addEventListener('pointerdown', onDown, { passive: false });
    uiCanvas.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', onUp, { passive: false });
  } else {
    const t2p = t => ({ clientX: t.clientX, clientY: t.clientY, pointerId: t.identifier,
                        preventDefault: () => {} });
    uiCanvas.addEventListener('touchstart', e => { onDown(t2p(e.changedTouches[0])); e.preventDefault(); }, { passive: false });
    uiCanvas.addEventListener('touchmove', e => { onMove(t2p(e.changedTouches[0])); e.preventDefault(); }, { passive: false });
    uiCanvas.addEventListener('touchend', e => { onUp(t2p(e.changedTouches[0])); e.preventDefault(); }, { passive: false });
    uiCanvas.addEventListener('touchcancel', e => { onUp(t2p(e.changedTouches[0])); e.preventDefault(); }, { passive: false });
  }
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(n =>
    document.addEventListener(n, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { Sfx.stopAll(); if (G3.s) G3.s.grinder.run = 0; }
    else { Sfx.resume(); last = performance.now(); }
  });

  /* --------------------------------------------------------------- loop */
  let acc = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 1 / 20);

    Ptr.sync(now / 1000, dt);
    G3.update(dt);
    R3.render(Scene, G3.W, G3.H);
    UI.draw(G3);

    // keep the frame budget: drop SSAO first if we are consistently late
    acc = acc * 0.94 + dt * 0.06;
    if (acc > 0.030 && R3.quality.ssao) R3.quality.ssao = false;
    else if (acc > 0.055 && R3.quality.bloom) R3.quality.bloom = false;
  }

  /* --------------------------------------------------------------- boot */
  function boot() {
    if (!R3.init(glCanvas)) {
      gate.innerHTML = '<div style="color:#e8d5c0;font:600 20px system-ui;padding:24px;' +
        'text-align:center">WebGL 2</div>';
      return false;
    }
    UI.init(uiCanvas);
    Fluid.init();
    Scene.build();
    G3.W = window.innerWidth; G3.H = window.innerHeight;
    G3.init();
    resize();
    ready = true;
    return true;
  }

  function start(e) {
    if (started || !ready) return;
    started = true;
    Sfx.init(); Sfx.resume(); Sfx.sparkle(4, 660);
    gate.classList.add('hidden');
    setTimeout(() => { gate.style.display = 'none'; }, 500);
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
    if (e) e.preventDefault();
  }
  gate.addEventListener('pointerdown', start, { passive: false });
  gate.addEventListener('touchstart', start, { passive: false });
  gate.addEventListener('click', start);

  if (boot()) {
    // draw one frame behind the gate so the café is already there on first tap
    G3.update(1 / 60);
    R3.render(Scene, G3.W, G3.H);
    UI.draw(G3);
  }
  window.__barista = { G3, R3, Scene, Ptr, Fluid, Sfx, UI, start, resize };
})();
