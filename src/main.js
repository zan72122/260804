// ============================================================================
// 起動 — 「しばって！そめて！ひらくとびっくり！あいぞめラボ」
// ============================================================================

import { UI } from './ui.js';
import { Sound } from './audio.js';
import { PointerInput } from './input.js';
import { Game, STAGE } from './game.js';
import { now } from './util.js';

const canvas = document.getElementById('gl');
const ui = new UI();
const sound = new Sound();

let game = null;
let last = now();
let raf = 0;
let running = false;
let lastOrientation = null;

function fail(msg) {
  const boot = document.getElementById('boot');
  boot.classList.remove('hidden');
  boot.innerHTML =
    '<div class="boot-inner"><div class="boot-text">' + msg + '</div></div>';
}

function loop() {
  raf = requestAnimationFrame(loop);
  const t = now();
  let dt = (t - last) / 1000;
  last = t;
  if (dt > 0.1) dt = 0.1;      // タブ復帰やカクつきで飛ばない
  if (dt <= 0) dt = 1 / 60;
  if (!running) return;
  try {
    game.update(dt);
    game.render();
  } catch (e) {
    console.error(e);
  }
}

function handleResize() {
  if (!game) return;
  game.resize();
  const o = window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';
  if (lastOrientation && o !== lastOrientation && game.stage !== STAGE.TITLE) {
    // 状態はそのまま。見え方だけ切りかえる。
    if (o === 'landscape') ui.flashRotateHint();
  }
  lastOrientation = o;
}

function boot() {
  let input;
  try {
    input = new PointerInput(canvas);
    game = new Game(canvas, ui, sound, input);
  } catch (e) {
    console.error(e);
    fail('この ブラウザでは うごきません（WebGL）');
    return;
  }

  game.resize();
  lastOrientation = window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';
  game.showTitleScene();
  running = true;
  loop();

  // 1 フレーム描いてからタイトルを見せる
  requestAnimationFrame(() => {
    ui.bootDone();
    ui.showTitle(true);
  });

  // ---- ボタン ----
  ui.el.startBtn.addEventListener('click', () => {
    sound.ensure();
    ui.showTitle(false);
    ui.showHud(true);
    game.startPlay();
  });

  ui.el.next.addEventListener('click', (e) => {
    e.stopPropagation();
    game.onNext();
  });

  ui.el.againBtn.addEventListener('click', () => {
    ui.showReveal(null);
    ui.showHud(true);
    game.startPlay();
  });

  ui.el.lookBtn.addEventListener('click', () => {
    ui.showReveal(null);
    ui.setHint('👀', 'できあがった ぬのを ゆっくり みてね');
    ui.showNext(null);
    ui.setTools([{ id: 'again', glyph: '🔁', label: 'もういちど' }], () => {
      ui.setTools(null);
      game.startPlay();
    });
  });

  let soundOn = true;
  ui.setSound(true);
  ui.el.soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    sound.ensure();
    sound.setEnabled(soundOn);
    ui.setSound(soundOn);
  });

  ui.el.restartBtn.addEventListener('click', () => {
    ui.showReveal(null);
    ui.showHud(true);
    game.startPlay();
  });

  // ---- 画面まわり ----
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => setTimeout(handleResize, 260));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize);
  }
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    last = now();
  });

  // ---- 検証用フック（自動テストから工程を進めるため） ----
  window.__aizome = {
    game, ui, sound, input,
    stage: () => game.stage,
    next: () => game.onNext(),
    setStage: (s) => game.setStage(s),
    state: () => ({
      stage: game.stage,
      fold: game.fold.family,
      ties: game.binding.ties.length,
      boards: game.binding.boards.length,
      dye: game.dye,
      ox: game.ox,
      dips: game.dips,
      foldT: game.cloth.foldT,
      rinse: game.rinse,
      submerged: game.submerged,
      unfold: game.unfoldProgress,
      wet: game.wet,
      pattern: game.patternInfo ? game.patternInfo.name : null
    })
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
