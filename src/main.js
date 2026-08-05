// ---------------------------------------------------------------------------
// 起動・入力・メインループ
// ---------------------------------------------------------------------------
'use strict';

(function () {
  const canvas = document.getElementById('gl');
  const gl = createGL(canvas);
  if (!gl) {
    showError('この端末では WebGL が使えないみたいです。\nSafari / Chrome の最新版でおためしください。');
    return;
  }

  // --- 画面まわりの小さな UI ------------------------------------------------
  const wordEl = document.getElementById('stageWord');
  const paletteEl = document.getElementById('palette');
  const viewBtns = document.getElementById('viewButtons');
  let wordTimer = null;

  const ui = {
    setStage(word) {
      clearTimeout(wordTimer);
      if (!word) { wordEl.classList.remove('show', 'small'); return; }
      wordEl.textContent = word;
      wordEl.classList.remove('small');
      wordEl.classList.add('show');
      clearTimeout(wordTimer);
      wordTimer = setTimeout(() => wordEl.classList.add('small'), 1900);
    },
    setPalette(colors, onPick) {
      paletteEl.innerHTML = '';
      colors.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'chip' + (i === 0 ? ' on' : '');
        b.style.background = 'radial-gradient(circle at 36% 30%, ' + c + 'ee, ' + c + ' 55%, ' + shade(c, -30) + ')';
        b.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          [].forEach.call(paletteEl.children, (n) => n.classList.remove('on'));
          b.classList.add('on');
          onPick(i);
        });
        paletteEl.appendChild(b);
      });
    },
    showPalette(on) { paletteEl.classList.toggle('hidden', !on); },
    showViewButtons(on) { viewBtns.classList.toggle('hidden', !on); },
  };

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    const g2 = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    const b = Math.max(0, Math.min(255, (n & 255) + amt));
    return '#' + ((r << 16) | (g2 << 8) | b).toString(16).padStart(6, '0');
  }

  function showError(msg) {
    const el = document.getElementById('err');
    document.getElementById('errMsg').textContent = msg;
    el.classList.remove('hidden');
  }

  // --- 初期化 --------------------------------------------------------------
  let renderer, game, sound;
  try {
    renderer = new Renderer(gl, canvas);
    sound = new Sound();
    game = new Game(gl, canvas, renderer, sound, ui);
  } catch (e) {
    showError('えらーが おきました: ' + e.message);
    console.error(e);
    return;
  }

  // --- リサイズ -------------------------------------------------------------
  let scale = 1;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dprCap = 2.0;
    let dpr = Math.min(window.devicePixelRatio || 1, dprCap) * scale;
    // 総ピクセル数の上限 (モバイル GPU 保護)
    const maxPix = 2100000;
    if (w * h * dpr * dpr > maxPix) dpr = Math.sqrt(maxPix / (w * h));
    canvas.width = Math.max(2, Math.round(w * dpr));
    canvas.height = Math.max(2, Math.round(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    renderer.setSize(canvas.width, canvas.height);
    game.setViewport(w, h);
  }
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showError('えを つくる ぶぶんが とまりました。\nページを もういちど ひらいてね。');
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));
  resize();

  // --- 入力 (一本指) --------------------------------------------------------
  const pos = (e) => {
    const t = e.touches ? e.touches[0] : e;
    return [t.clientX, t.clientY];
  };
  let activeId = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (activeId !== null) return;
    activeId = e.pointerId;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    game.onDown(p[0], p[1]);
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId) return;
    const p = pos(e);
    game.onMove(p[0], p[1]);
    e.preventDefault();
  }, { passive: false });

  const up = (e) => {
    if (e.pointerId !== undefined && e.pointerId !== activeId) return;
    activeId = null;
    game.onUp();
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // --- ボタン ---------------------------------------------------------------
  document.getElementById('btnAgain').addEventListener('pointerdown', (e) => {
    e.stopPropagation(); game.replay();
  });
  document.getElementById('btnColor').addEventListener('pointerdown', (e) => {
    e.stopPropagation(); game.nextPalette();
  });
  document.getElementById('btnTime').addEventListener('pointerdown', (e) => {
    e.stopPropagation(); game.nextTime();
  });

  const titleEl = document.getElementById('title');
  document.getElementById('startBtn').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    sound.start();
    sound.chime(4, 0.9);
    titleEl.classList.add('hidden');
    setTimeout(() => { titleEl.style.display = 'none'; }, 700);
    game.setStage('motif');
  });

  // --- ループ ---------------------------------------------------------------
  let last = performance.now();
  let acc = 0, frames = 0, slow = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    renderer.render(game);

    // 負荷が高い端末では解像度を落とす
    acc += dt; frames++;
    if (acc > 1.2) {
      const fps = frames / acc;
      acc = 0; frames = 0;
      if (fps < 42 && scale > 0.62) { slow++; if (slow >= 2) { scale = Math.max(0.62, scale - 0.16); slow = 0; resize(); } }
      else if (fps > 57 && scale < 1) { scale = Math.min(1, scale + 0.08); resize(); }
      else slow = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__game = game;
})();
