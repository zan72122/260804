// src/ui/hud.ts
// 所有: A6 (character/ui) — DOM アイコンHUD。テキストラベルなし、絵文字アイコンのみ。
// 4歳児向け: タップ領域は最小72px、余白広め。

import type { GameState } from '../core/types';
import { bus } from '../core/events';

const SETTINGS_KEY = 'escalatorGame.settings.v1';

interface StoredSettings {
  volume: number;
  reducedMotion: boolean;
}

function loadSettings(): StoredSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as StoredSettings).volume === 'number' &&
      typeof (parsed as StoredSettings).reducedMotion === 'boolean'
    ) {
      const s = parsed as StoredSettings;
      return { volume: s.volume, reducedMotion: s.reducedMotion };
    }
  } catch {
    /* 破損データは無視 */
  }
  return null;
}

function saveSettings(s: StoredSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* プライベートモード等で失敗しても無視 */
  }
}

// ---- DOM要素キャッシュ ----
let root: HTMLDivElement | null = null;
let styleInjected = false;

let elTitle: HTMLDivElement;
let elStart: HTMLButtonElement;
let elTestRun: HTMLDivElement;
let elTurtle: HTMLButtonElement;
let elTurtleCheck: HTMLSpanElement;
let elRabbit: HTMLButtonElement;
let elSelect: HTMLDivElement;
let elReplay: HTMLButtonElement;
let elNext: HTMLButtonElement;
let elObserve: HTMLButtonElement;
let elStepPlay: HTMLButtonElement;
let elBack: HTMLButtonElement;
let elGear: HTMLButtonElement;
let elSettingsPanel: HTMLDivElement;
let elVolumeSlider: HTMLInputElement;
let elReducedToggle: HTMLButtonElement;

let settingsOpen = false;
let selectReadyTimer: number | null = null;

// 直近同期値(状態が変化した時だけDOM操作する)
const last: {
  phase: GameState['phase'] | null;
  mode: GameState['mode'] | null;
  testRunStage: GameState['testRunStage'] | -1;
  location: GameState['location'] | -1;
  volume100: number;
  reducedMotion: boolean | null;
} = {
  phase: null,
  mode: null,
  testRunStage: -1,
  location: -1,
  volume100: -1,
  reducedMotion: null
};

function playTap() {
  bus.emit('sfx', { name: 'uiTap' });
}

function emitHotspot(id: string) {
  bus.emit('hotspot', { id, type: 'activated', x: 0, y: 0 });
}

function persist(state: GameState) {
  saveSettings({ volume: state.settings.volume, reducedMotion: state.settings.reducedMotion });
}

function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    #hud { font-family: -apple-system, 'Hiragino Maru Gothic ProN', 'Yu Gothic', sans-serif; }
    .hud-btn {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      border: none;
      border-radius: 999px;
      width: 72px;
      height: 72px;
      min-width: 72px;
      min-height: 72px;
      flex: none;
      font-size: 34px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: linear-gradient(180deg,#ffffff 0%,#ffe3ef 100%);
      box-shadow: 0 6px 0 rgba(0,0,0,0.12), 0 3px 10px rgba(0,0,0,0.18);
      color: #4a3b45;
      cursor: pointer;
      /* 押下: 素早く縮む。離す: バネのように弾んで戻る(ポヨン) */
      transition: transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, opacity 0.25s ease;
      position: relative;
      padding: 0;
      will-change: transform;
    }
    .hud-btn:active {
      transform: scale(0.86) translateY(4px);
      box-shadow: 0 2px 0 rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.15);
      transition: transform 0.08s ease-out, box-shadow 0.08s ease-out;
    }
    .hud-btn.big {
      width: clamp(84px, 24vw, 108px); height: clamp(84px, 24vw, 108px);
      min-width: 84px; min-height: 84px;
      font-size: clamp(38px, 11vw, 50px);
    }
    .hud-btn.xbig {
      width: clamp(104px, 30vw, 152px); height: clamp(104px, 30vw, 152px);
      min-width: 104px; min-height: 104px;
      font-size: clamp(48px, 16vw, 74px);
      box-shadow: 0 9px 0 rgba(0,0,0,0.14), 0 5px 18px rgba(0,0,0,0.22);
    }
    .hud-btn.small { width: 72px; height: 72px; min-width: 72px; min-height: 72px; font-size: 26px; }
    .hud-btn.disabled { opacity: 0.35; pointer-events: none; }
    .hud-check {
      position: absolute; top: -6px; right: -6px;
      background: #7fd88f; color: #fff; border-radius: 999px;
      width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
      font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.25);
    }
    #hud-title {
      position: absolute; inset: 0; display: none; flex-direction: column;
      align-items: center; justify-content: center; gap: 34px;
      overflow: hidden;
    }
    .hud-decor {
      position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;
    }
    .hud-decor span {
      position: absolute; opacity: 0.6; line-height: 1;
      filter: drop-shadow(0 2px 5px rgba(0,0,0,0.18));
      animation: hudFloat 6s ease-in-out infinite;
    }
    .hud-decor span:nth-child(1) { left: 7%;  top: 12%; font-size: 36px; animation-duration: 5.4s; }
    .hud-decor span:nth-child(2) { left: 84%; top: 9%;  font-size: 26px; animation-duration: 6.6s; animation-delay: .4s; }
    .hud-decor span:nth-child(3) { left: 10%; top: 76%; font-size: 30px; animation-duration: 7.2s; animation-delay: .9s; }
    .hud-decor span:nth-child(4) { left: 87%; top: 72%; font-size: 25px; animation-duration: 5.1s; animation-delay: 1.3s; }
    .hud-decor span:nth-child(5) { left: 50%; top: 5%;  font-size: 22px; animation-duration: 6.9s; animation-delay: .6s; }
    .hud-decor span:nth-child(6) { left: 45%; top: 88%; font-size: 27px; animation-duration: 6.1s; animation-delay: 1.1s; }
    @keyframes hudFloat {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      50% { transform: translateY(-18px) rotate(16deg); }
    }
    .hud-logo-wrap {
      position: relative; z-index: 1;
      display: grid;
      max-width: 88vw;
      margin: 0 auto;
      transform: rotate(-3deg);
      animation: hudLogoWiggle 3.4s ease-in-out infinite;
      filter: drop-shadow(0 6px 14px rgba(0,0,0,0.22));
    }
    .hud-logo-halo,
    .hud-logo {
      grid-area: 1 / 1;
      font-size: clamp(26px, 8vw, 46px); font-weight: 900; text-align: center; line-height: 1.55;
      white-space: pre-line;
      letter-spacing: 0.02em;
    }
    /* 白フチ層: グラデーション層の下に敷く単色の太いレイヤー(CJKでも塗り潰れない
       2レイヤー構成。text-shadowの多重がけは字形が込み入ったCJKだと内部まで白く
       潰れてしまうため、別レイヤーの -webkit-text-stroke で縁取りだけを担わせる) */
    .hud-logo-halo {
      color: #ffffff;
      -webkit-text-stroke: 10px #ffffff;
      paint-order: stroke;
    }
    .hud-logo {
      background: linear-gradient(135deg, #ff5c98 0%, #ff8fc4 26%, #ffcf5c 54%, #7fd4f0 78%, #b892ff 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    @keyframes hudLogoWiggle {
      0%, 100% { transform: rotate(-3deg) scale(1); }
      50% { transform: rotate(2deg) scale(1.035); }
    }
    #hud-start {
      position: relative; z-index: 1;
      width: 156px; height: 156px; font-size: 68px;
      background: radial-gradient(circle at 35% 30%, #ffffff, #ffd8e6 60%, #ff9ec4 100%);
      box-shadow: 0 10px 0 rgba(0,0,0,0.15), 0 6px 24px rgba(255,120,170,0.5);
      animation: hudStartPulse 1.15s ease-in-out infinite;
    }
    /* transform(scale)は使わない: バウンディングボックスが動き続けると自動テスト等の
       「要素が安定するまで待つ」判定が終わらなくなるため、box-shadow(グロー)のみで
       脈動を表現する(見た目の押し寄せ感は保ちつつ、ヒットボックスは常に静止させる) */
    @keyframes hudStartPulse {
      0%, 100% { box-shadow: 0 10px 0 rgba(0,0,0,0.15), 0 6px 24px rgba(255,120,170,0.5), 0 0 0 0 rgba(255,158,196,0.55); }
      50% { box-shadow: 0 10px 0 rgba(0,0,0,0.15), 0 6px 24px rgba(255,120,170,0.5), 0 0 0 16px rgba(255,158,196,0); }
    }
    #hud-testrun {
      position: absolute; left: 0; right: 0;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 22px);
      display: none; justify-content: center; align-items: flex-start; gap: 38px;
    }
    #hud-select {
      position: absolute; inset: 0; display: none; flex-direction: column;
      align-items: center; justify-content: flex-end; gap: 26px;
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 54px);
      opacity: 0; pointer-events: none;
      transition: opacity 0.4s ease;
    }
    #hud-select.ready { opacity: 1; pointer-events: auto; }
    .hud-select-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px 22px; max-width: 92vw; }
    #hud-back {
      position: absolute;
      top: calc(env(safe-area-inset-top, 0px) + 14px);
      left: calc(env(safe-area-inset-left, 0px) + 14px);
      display: none;
    }
    #hud-gear {
      position: absolute;
      top: calc(env(safe-area-inset-top, 0px) + 14px);
      right: calc(env(safe-area-inset-right, 0px) + 14px);
      display: none;
    }
    #hud-settings {
      position: absolute;
      top: calc(env(safe-area-inset-top, 0px) + 90px);
      right: calc(env(safe-area-inset-right, 0px) + 14px);
      width: min(300px, 76vw);
      background: rgba(255,255,255,0.97);
      border-radius: 26px;
      padding: 22px 22px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      display: none;
      flex-direction: column;
      gap: 20px;
    }
    .hud-settings-row { display: flex; align-items: center; gap: 16px; }
    .hud-settings-row .icon { font-size: 30px; flex: none; }
    #hud-volume {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      height: 16px;
      border-radius: 999px;
      background: linear-gradient(90deg,#ff9ec4,#ffd166);
      outline: none;
    }
    #hud-volume::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 36px; height: 36px; border-radius: 50%;
      background: #fff;
      border: 4px solid #ff6fa5;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      cursor: pointer;
    }
    #hud-volume::-moz-range-thumb {
      width: 36px; height: 36px; border-radius: 50%;
      background: #fff; border: 4px solid #ff6fa5;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;
    }
    #hud-reduced.on {
      background: linear-gradient(180deg,#c9f7d1,#7fd88f);
      box-shadow: 0 6px 0 rgba(0,0,0,0.12), 0 0 0 4px rgba(127,216,143,0.45);
    }
    @media (prefers-color-scheme: dark) {
      .hud-btn {
        background: linear-gradient(180deg,#3a3040,#2a2230); color: #fff5f8;
        box-shadow: 0 6px 0 rgba(0,0,0,0.4), 0 3px 12px rgba(0,0,0,0.5);
      }
      #hud-settings { background: rgba(35,28,38,0.97); color: #fff5f8; }
      #hud-start { background: radial-gradient(circle at 35% 30%, #55404f, #ff9ec4 90%); }
    }
  `;
  document.head.appendChild(style);
}

function createButton(id: string, emoji: string, extraClass = ''): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = `hud-btn ${extraClass}`.trim();
  btn.type = 'button';
  btn.setAttribute('aria-label', id);
  btn.textContent = emoji;
  return btn;
}

function bindTap(btn: HTMLButtonElement, onTap: () => void) {
  btn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    playTap();
    onTap();
  });
}

function nextLocationIcon(location: GameState['location']): string {
  const next = ((location + 1) % 3) as 0 | 1 | 2;
  if (next === 0) return '🏬';
  if (next === 1) return '🚉';
  return '🐠';
}

function buildDom(state: GameState, hudEl: HTMLElement) {
  injectStyle();

  // ---- タイトル ----
  elTitle = document.createElement('div');
  elTitle.id = 'hud-title';
  const decor = document.createElement('div');
  decor.className = 'hud-decor';
  for (const emoji of ['⚙️', '✨', '⭐', '🔩', '✨', '⚙️']) {
    const s = document.createElement('span');
    s.textContent = emoji;
    decor.appendChild(s);
  }
  const logoWrap = document.createElement('div');
  logoWrap.className = 'hud-logo-wrap';
  const logoText = 'パカッ！ぐるん！\nエスカレーターひみつ整備室';
  const logoHalo = document.createElement('div');
  logoHalo.className = 'hud-logo-halo';
  logoHalo.setAttribute('aria-hidden', 'true');
  logoHalo.textContent = logoText;
  const logo = document.createElement('div');
  logo.className = 'hud-logo';
  logo.textContent = logoText;
  logoWrap.appendChild(logoHalo);
  logoWrap.appendChild(logo);
  elStart = createButton('ui:start', '▶️');
  elStart.id = 'hud-start';
  bindTap(elStart, () => emitHotspot('ui:start'));
  elTitle.appendChild(decor);
  elTitle.appendChild(logoWrap);
  elTitle.appendChild(elStart);
  hudEl.appendChild(elTitle);

  // ---- testRun(🐢→🐇。片手の親指圏=画面下部中央寄りに特大表示) ----
  elTestRun = document.createElement('div');
  elTestRun.id = 'hud-testrun';
  elTurtle = createButton('ui:slow', '🐢', 'big xbig');
  elTurtleCheck = document.createElement('span');
  elTurtleCheck.className = 'hud-check';
  elTurtleCheck.textContent = '✓';
  elTurtleCheck.style.display = 'none';
  elTurtle.appendChild(elTurtleCheck);
  elRabbit = createButton('ui:fast', '🐇', 'big xbig disabled');
  bindTap(elTurtle, () => emitHotspot('ui:slow'));
  bindTap(elRabbit, () => emitHotspot('ui:fast'));
  elTestRun.appendChild(elTurtle);
  elTestRun.appendChild(elRabbit);
  hudEl.appendChild(elTestRun);

  // ---- select(もう一回/次のロケーション/観察 + ステップ遊び) ----
  elSelect = document.createElement('div');
  elSelect.id = 'hud-select';
  const row1 = document.createElement('div');
  row1.className = 'hud-select-row';
  elReplay = createButton('ui:replay', '🔁', 'big');
  elNext = createButton('ui:next', nextLocationIcon(state.location), 'big');
  elObserve = createButton('ui:observe', '🔍', 'big');
  bindTap(elReplay, () => emitHotspot('ui:replay'));
  bindTap(elNext, () => emitHotspot('ui:next'));
  bindTap(elObserve, () => emitHotspot('ui:observe'));
  row1.appendChild(elReplay);
  row1.appendChild(elNext);
  row1.appendChild(elObserve);
  elStepPlay = createButton('ui:stepPlay', '🪜', 'small');
  bindTap(elStepPlay, () => emitHotspot('ui:stepPlay'));
  elSelect.appendChild(row1);
  elSelect.appendChild(elStepPlay);
  hudEl.appendChild(elSelect);

  // ---- 戻る ----
  elBack = createButton('ui:back', '↩️');
  elBack.id = 'hud-back';
  bindTap(elBack, () => emitHotspot('ui:back'));
  hudEl.appendChild(elBack);

  // ---- 設定歯車+パネル ----
  elGear = createButton('ui:settings', '⚙️', 'small');
  elGear.id = 'hud-gear';
  bindTap(elGear, () => {
    settingsOpen = !settingsOpen;
    elSettingsPanel.style.display = settingsOpen ? 'flex' : 'none';
  });
  hudEl.appendChild(elGear);

  elSettingsPanel = document.createElement('div');
  elSettingsPanel.id = 'hud-settings';

  const volRow = document.createElement('div');
  volRow.className = 'hud-settings-row';
  const volIcon = document.createElement('span');
  volIcon.className = 'icon';
  volIcon.textContent = '🔊';
  elVolumeSlider = document.createElement('input');
  elVolumeSlider.type = 'range';
  elVolumeSlider.id = 'hud-volume';
  elVolumeSlider.min = '0';
  elVolumeSlider.max = '100';
  elVolumeSlider.step = '1';
  elVolumeSlider.setAttribute('aria-label', 'volume');
  volRow.appendChild(volIcon);
  volRow.appendChild(elVolumeSlider);
  elVolumeSlider.addEventListener('input', () => {
    const v = Number(elVolumeSlider.value) / 100;
    state.settings.volume = v;
    last.volume100 = Number(elVolumeSlider.value);
    bus.emit('settingsChanged', {});
    persist(state);
  });
  elVolumeSlider.addEventListener('change', playTap);

  const reducedRow = document.createElement('div');
  reducedRow.className = 'hud-settings-row';
  elReducedToggle = createButton('ui:reducedMotion', '🦋', 'small');
  elReducedToggle.id = 'hud-reduced';
  bindTap(elReducedToggle, () => {
    state.settings.reducedMotion = !state.settings.reducedMotion;
    elReducedToggle.classList.toggle('on', state.settings.reducedMotion);
    last.reducedMotion = state.settings.reducedMotion;
    bus.emit('settingsChanged', {});
    persist(state);
  });
  reducedRow.appendChild(elReducedToggle);

  elSettingsPanel.appendChild(volRow);
  elSettingsPanel.appendChild(reducedRow);
  hudEl.appendChild(elSettingsPanel);
}

export const hud: {
  init(state: GameState): void;
  sync(state: GameState): void;
} = {
  init(state: GameState) {
    const el = document.getElementById('hud');
    if (!el) return;
    root = el as HTMLDivElement;
    root.innerHTML = '';
    settingsOpen = false;

    const stored = loadSettings();
    if (stored) {
      state.settings.volume = stored.volume;
      state.settings.reducedMotion = stored.reducedMotion;
    }

    buildDom(state, root);

    elVolumeSlider.value = String(Math.round(state.settings.volume * 100));
    elReducedToggle.classList.toggle('on', state.settings.reducedMotion);

    if (stored) {
      bus.emit('settingsChanged', {});
    }

    last.phase = null; // sync() 初回呼び出しで確実に反映させる
    last.mode = null;
    last.testRunStage = -1;
    last.location = -1;
    last.volume100 = Math.round(state.settings.volume * 100);
    last.reducedMotion = state.settings.reducedMotion;
  },

  sync(state: GameState) {
    if (!root) return;

    if (last.phase !== state.phase) {
      elTitle.style.display = state.phase === 'title' ? 'flex' : 'none';
      elTestRun.style.display = state.phase === 'testRun' ? 'flex' : 'none';
      elGear.style.display = state.phase === 'title' ? 'none' : 'flex';

      if (state.phase === 'select') {
        elSelect.style.display = 'flex';
        elSelect.classList.remove('ready');
        if (selectReadyTimer !== null) window.clearTimeout(selectReadyTimer);
        // celebrate直後の誤タップ防止: 少し遅らせてから押せるようにする
        selectReadyTimer = window.setTimeout(() => {
          elSelect.classList.add('ready');
          selectReadyTimer = null;
        }, 900);
      } else {
        elSelect.style.display = 'none';
        elSelect.classList.remove('ready');
        if (selectReadyTimer !== null) {
          window.clearTimeout(selectReadyTimer);
          selectReadyTimer = null;
        }
      }
      last.phase = state.phase;
    }

    if (last.mode !== state.mode) {
      const showBack = state.mode === 'freeObserve' || state.mode === 'stepPlay';
      elBack.style.display = showBack ? 'flex' : 'none';
      last.mode = state.mode;
    }

    if (last.testRunStage !== state.testRunStage) {
      const passedSlow = state.testRunStage >= 1;
      elTurtleCheck.style.display = passedSlow ? 'flex' : 'none';
      elRabbit.classList.toggle('disabled', !passedSlow);
      last.testRunStage = state.testRunStage;
    }

    if (last.location !== state.location) {
      elNext.textContent = nextLocationIcon(state.location);
      last.location = state.location;
    }

    const vol100 = Math.round(state.settings.volume * 100);
    if (last.volume100 !== vol100) {
      elVolumeSlider.value = String(vol100);
      last.volume100 = vol100;
    }

    if (last.reducedMotion !== state.settings.reducedMotion) {
      elReducedToggle.classList.toggle('on', state.settings.reducedMotion);
      last.reducedMotion = state.settings.reducedMotion;
    }
  }
};
