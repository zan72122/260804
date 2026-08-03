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
      min-width: 72px;
      min-height: 72px;
      font-size: 34px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg,#ffffff 0%,#ffe3ef 100%);
      box-shadow: 0 6px 0 rgba(0,0,0,0.12), 0 3px 10px rgba(0,0,0,0.18);
      color: #4a3b45;
      cursor: pointer;
      transition: transform 0.12s ease, opacity 0.25s ease;
      position: relative;
      padding: 0;
    }
    .hud-btn:active { transform: scale(0.9) translateY(3px); box-shadow: 0 2px 0 rgba(0,0,0,0.12); }
    .hud-btn.big { min-width: 104px; min-height: 104px; font-size: 48px; }
    .hud-btn.small { min-width: 72px; min-height: 72px; font-size: 26px; }
    .hud-btn.disabled { opacity: 0.35; pointer-events: none; }
    .hud-check {
      position: absolute; top: -6px; right: -6px;
      background: #7fd88f; color: #fff; border-radius: 999px;
      width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
      font-size: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.25);
    }
    #hud-title {
      position: absolute; inset: 0; display: none; flex-direction: column;
      align-items: center; justify-content: center; gap: 30px;
    }
    .hud-logo {
      font-size: 28px; font-weight: 900; text-align: center; line-height: 1.6;
      color: #ff6fa5; white-space: pre-line;
      text-shadow: 3px 3px 0 #ffd166, -2px -2px 0 #fff;
      letter-spacing: 0.04em;
      transform: rotate(-2deg);
      max-width: 82vw;
      margin: 0 auto;
    }
    @media (max-width: 420px) {
      .hud-logo { font-size: 22px; }
    }
    #hud-start {
      width: 156px; height: 156px; font-size: 68px;
      background: radial-gradient(circle at 35% 30%, #ffffff, #ffd8e6 60%, #ff9ec4 100%);
      box-shadow: 0 10px 0 rgba(0,0,0,0.15), 0 6px 24px rgba(255,120,170,0.5);
    }
    #hud-testrun {
      position: absolute; left: 0; right: 0;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 30px);
      display: none; justify-content: center; align-items: flex-start; gap: 44px;
    }
    #hud-select {
      position: absolute; inset: 0; display: none; flex-direction: column;
      align-items: center; justify-content: center; gap: 28px;
      opacity: 0; pointer-events: none;
      transition: opacity 0.4s ease;
    }
    #hud-select.ready { opacity: 1; pointer-events: auto; }
    .hud-select-row { display: flex; gap: 28px; }
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
  const logo = document.createElement('div');
  logo.className = 'hud-logo';
  logo.textContent = 'パカッ！ぐるん！\nエスカレーターひみつ整備室';
  elStart = createButton('ui:start', '▶️');
  elStart.id = 'hud-start';
  bindTap(elStart, () => emitHotspot('ui:start'));
  elTitle.appendChild(logo);
  elTitle.appendChild(elStart);
  hudEl.appendChild(elTitle);

  // ---- testRun(🐢→🐇) ----
  elTestRun = document.createElement('div');
  elTestRun.id = 'hud-testrun';
  elTurtle = createButton('ui:slow', '🐢', 'big');
  elTurtleCheck = document.createElement('span');
  elTurtleCheck.className = 'hud-check';
  elTurtleCheck.textContent = '✓';
  elTurtleCheck.style.display = 'none';
  elTurtle.appendChild(elTurtleCheck);
  elRabbit = createButton('ui:fast', '🐇', 'big disabled');
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
