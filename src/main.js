// 起動・画面遷移・メインループ
import * as THREE from '../vendor/three.module.js';
import * as A from './audio.js';
import { UI } from './ui.js';
import { Game, DESTINATIONS, P } from './game.js';
import { SPECIES } from './tree.js';

const canvas = document.getElementById('gl');
const loading = document.getElementById('loading');
const fatal = document.getElementById('fatal');

function die(msg) {
  fatal.classList.remove('hidden');
  fatal.textContent = 'エラーが おきました\n\n' + msg;
  loading.classList.add('hidden');
}
window.addEventListener('error', (e) => die(e.message + '\n' + (e.error && e.error.stack || '')));
window.addEventListener('unhandledrejection', (e) => die(String(e.reason)));

/* ================= レンダラ ================= */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    stencil: false,
  });
} catch (e) {
  die('WebGL を つかえません: ' + e.message);
  throw e;
}
renderer.setClearColor(0x9fc4de);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const ui = new UI();
const game = new Game(renderer, ui);

/* ================= リサイズ / 画面回転 ================= */
let vw = 1, vh = 1;
function resize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  if (w === vw && h === vh) return;
  vw = w; vh = h;
  const area = w * h;
  // 端末負荷にあわせて解像度を抑える
  let dpr = window.devicePixelRatio || 1;
  const maxDpr = area > 900000 ? 1.5 : 2.0;
  dpr = Math.min(dpr, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  game.onResize(w, h);
}
window.addEventListener('resize', resize, { passive: true });
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize, { passive: true });

/* ================= 画面 ================= */
const state = { tree: 'oak', dest: 'park', started: false };

const treeThumb = (key) => {
  const sp = SPECIES[key];
  const c = sp.icon;
  if (key === 'poplar') {
    return `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#20301c"/>
      <ellipse cx="50" cy="46" rx="15" ry="38" fill="${c}"/>
      <ellipse cx="44" cy="34" rx="9" ry="20" fill="#5a9c6a" opacity=".5"/>
      <rect x="46" y="72" width="8" height="24" fill="#6b5138"/></svg>`;
  }
  if (key === 'cherry') {
    return `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#2b2430"/>
      <circle cx="34" cy="40" r="20" fill="${c}"/><circle cx="64" cy="36" r="21" fill="${c}"/>
      <circle cx="50" cy="53" r="21" fill="#efaec6"/>
      <rect x="46" y="62" width="9" height="34" fill="#7a5f52"/>
      <path d="M50 66 L34 50 M50 66 L66 48" stroke="#7a5f52" stroke-width="5"/></svg>`;
  }
  return `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#1d2a1a"/>
    <circle cx="36" cy="40" r="19" fill="${c}"/><circle cx="63" cy="38" r="20" fill="${c}"/>
    <circle cx="50" cy="30" r="19" fill="#77b34d"/><circle cx="50" cy="50" r="21" fill="${c}"/>
    <rect x="45" y="60" width="10" height="36" fill="#5c4630"/></svg>`;
};
const destThumb = (key) => {
  const d = DESTINATIONS[key];
  const g = `rgb(${d.grass.join(',')})`;
  if (key === 'park') {
    return `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#8fb9d8"/>
      <rect y="52" width="100" height="48" fill="${g}"/>
      <ellipse cx="50" cy="66" rx="15" ry="6" fill="#4a3a28"/>
      <rect x="12" y="52" width="26" height="4" fill="#8a6a45"/><rect x="14" y="56" width="3" height="8" fill="#5d6469"/><rect x="33" y="56" width="3" height="8" fill="#5d6469"/>
      <circle cx="80" cy="40" r="9" fill="#3d6b32"/><rect x="78" y="46" width="4" height="10" fill="#5a4634"/></svg>`;
  }
  if (key === 'field') {
    return `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#8ec0e4"/>
      <rect y="50" width="100" height="50" fill="${g}"/>
      <ellipse cx="50" cy="64" rx="15" ry="6" fill="#6b4530"/>
      <rect x="0" y="46" width="100" height="2.5" fill="#8a6a45"/>
      <rect x="10" y="42" width="3" height="12" fill="#8a6a45"/><rect x="46" y="42" width="3" height="12" fill="#8a6a45"/><rect x="82" y="42" width="3" height="12" fill="#8a6a45"/></svg>`;
  }
  return `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#9cc3e0"/>
    <rect y="54" width="100" height="46" fill="${g}"/>
    <rect x="8" y="22" width="56" height="32" fill="#d8cdb8"/><rect x="6" y="19" width="60" height="4" fill="#7c8a94"/>
    <rect x="14" y="28" width="9" height="7" fill="#6f93a8"/><rect x="28" y="28" width="9" height="7" fill="#6f93a8"/><rect x="42" y="28" width="9" height="7" fill="#6f93a8"/>
    <ellipse cx="72" cy="70" rx="14" ry="6" fill="#7a6a4a"/></svg>`;
};

// タイトル画面の背後に実際の 3D 風景を出す
function ensureShowcase() {
  if (game.built) { game.idleShowcase(); return; }
  try {
    game.build({ treeKey: state.tree, destKey: state.dest, mode: 'story' });
    game.idleShowcase();
  } catch (e) {
    die(e.message + '\n' + e.stack);
  }
}

function screenTitle() {
  ui.show(false);
  A.stopAll();
  ensureShowcase();
  ui.showScreen(`
    <h1 class="title">き の おひっこし<small>ツリースペード</small></h1>
    <p class="sub">おおきな き を、つち ごと スポン と ぬいて<br>あたらしい ばしょ へ うえかえよう</p>
    <button class="big-cta" id="go">はじめる</button>
    <div class="row" style="margin-top:22px">
      <button class="mini" id="free">ズズズ → スポン だけ あそぶ</button>
    </div>
  `, (root) => {
    root.querySelector('#go').onclick = () => { A.unlock(); screenSelect(); };
    root.querySelector('#free').onclick = () => { A.unlock(); startGame('free'); };
  });
}

function screenSelect() {
  ui.show(false);
  ensureShowcase();
  const cards = (items, thumbFn, sel, cls) => items.map((k) =>
    `<button class="card ${k === sel ? 'sel' : ''}" data-k="${k}" data-g="${cls}">
       <span class="thumb">${thumbFn(k)}</span><span>${cls === 'tree' ? SPECIES[k].label : DESTINATIONS[k].label}</span>
     </button>`).join('');
  ui.showScreen(`
    <div class="section-label">どの き を うごかす？</div>
    <div class="cards">${cards(Object.keys(SPECIES), treeThumb, state.tree, 'tree')}</div>
    <div class="section-label">どこ へ うえる？</div>
    <div class="cards">${cards(Object.keys(DESTINATIONS), destThumb, state.dest, 'dest')}</div>
    <button class="big-cta" id="start" style="margin-top:14px">スタート</button>
    <div class="row" style="margin-top:14px"><button class="mini" id="back">もどる</button></div>
  `, (root) => {
    root.querySelectorAll('.card').forEach((b) => {
      b.onclick = () => {
        const g = b.dataset.g;
        root.querySelectorAll(`.card[data-g="${g}"]`).forEach((o) => o.classList.remove('sel'));
        b.classList.add('sel');
        if (g === 'tree') state.tree = b.dataset.k; else state.dest = b.dataset.k;
        A.click(700, 0.12);
      };
    });
    root.querySelector('#start').onclick = () => startGame('story');
    root.querySelector('#back').onclick = () => screenTitle();
  });
}

function screenFinish() {
  ui.show(false);
  ui.showScreen(`
    <h1 class="title" style="font-size:clamp(24px,7vw,48px)">できた！</h1>
    <p class="sub">おおきな き が、あたらしい ばしょ に ひっこしたよ</p>
    <div class="row">
      <button class="mini primary" id="again">おなじ き で もういちど</button>
      <button class="mini" id="other">べつの き</button>
    </div>
    <div class="row" style="margin-top:10px">
      <button class="mini" id="free">ズズズ → スポン だけ</button>
      <button class="mini" id="title">タイトル</button>
    </div>
  `, (root) => {
    root.querySelector('#again').onclick = () => startGame('story');
    root.querySelector('#other').onclick = () => screenSelect();
    root.querySelector('#free').onclick = () => startGame('free');
    root.querySelector('#title').onclick = () => screenTitle();
  });
}

function screenPause() {
  ui.showScreen(`
    <h1 class="title" style="font-size:clamp(22px,6vw,40px)">ちょっと やすみ</h1>
    <div class="row" style="margin-top:18px">
      <button class="mini primary" id="resume">つづける</button>
      <button class="mini" id="restart">さいしょ から</button>
      <button class="mini" id="title">タイトル</button>
    </div>
  `, (root) => {
    root.querySelector('#resume').onclick = () => { ui.hideScreen(); ui.show(true); };
    root.querySelector('#restart').onclick = () => startGame(game.mode);
    root.querySelector('#title').onclick = () => { A.stopAll(); screenTitle(); };
  });
  ui.show(false);
}

function startGame(mode) {
  A.unlock();
  ui.hideScreen();
  ui.clearToast();
  loading.classList.remove('hidden');
  // 1 フレームおいて重い生成を実行（ローディング表示を出すため）
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      game.build({ treeKey: state.tree, destKey: state.dest, mode });
      game.onFinish = () => screenFinish();
      game.start(mode);
      state.started = true;
    } catch (e) {
      die(e.message + '\n' + e.stack);
      return;
    }
    loading.classList.add('hidden');
  }));
}

/* ================= 上部ボタン ================= */
document.getElementById('btn-menu').onclick = () => screenPause();
const soundBtn = document.getElementById('btn-sound');
const SOUND_KEY = 'treespade.sound';
try {
  if (localStorage.getItem(SOUND_KEY) === 'off') { A.setEnabled(false); soundBtn.classList.add('muted'); }
} catch (e) { /* プライベートモードなど */ }
soundBtn.onclick = () => {
  A.unlock();
  const on = !A.isEnabled();
  A.setEnabled(on);
  soundBtn.classList.toggle('muted', !on);
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch (e) { }
};

// 最初のタッチで音声を解禁
const unlockOnce = () => { A.unlock(); window.removeEventListener('pointerdown', unlockOnce); };
window.addEventListener('pointerdown', unlockOnce);

// iOS のダブルタップズーム抑止
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

/* ================= メインループ ================= */
let last = performance.now();
let acc = 0, frames = 0, slowCount = 0;
let paused = false;
function loop(now) {
  requestAnimationFrame(loop);
  if (paused) { last = now; return; }
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;      // タブ復帰などでの飛びを抑える
  if (dt <= 0) return;

  resize();
  game.update(dt);
  renderer.render(game.world.scene, game.dir.camera);

  // 簡易な自動品質調整（低性能端末で影を切る）
  acc += dt; frames++;
  if (acc > 2.0) {
    const fps = frames / acc;
    acc = 0; frames = 0;
    if (fps < 26) {
      slowCount++;
      if (slowCount === 2 && renderer.shadowMap.enabled) {
        renderer.shadowMap.enabled = false;
        game.world.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
      } else if (slowCount >= 4 && renderer.getPixelRatio() > 1) {
        renderer.setPixelRatio(1);
      }
    } else slowCount = Math.max(0, slowCount - 1);
  }
}

resize();
requestAnimationFrame(loop);
// 最初のフレームを描いてから重い生成を行い、タイトルを実景の上に出す
requestAnimationFrame(() => requestAnimationFrame(() => {
  screenTitle();
  loading.classList.add('hidden');
}));

// デバッグ / 自動テスト用（実機の動作には影響しない）
window.__game = game;
window.__ui = ui;
window.__start = startGame;
window.__state = state;
window.__pause = (v) => { paused = !!v; };
window.__tick = (dt = 1 / 60, render = true) => {
  game.update(Math.min(0.05, dt));
  if (render) renderer.render(game.world.scene, game.dir.camera);
};
window.__advance = (seconds, step = 1 / 60) => {
  const n = Math.round(seconds / step);
  for (let i = 0; i < n; i++) game.update(step);
  renderer.render(game.world.scene, game.dir.camera);
};
window.__quality = (dpr) => renderer.setPixelRatio(dpr);
