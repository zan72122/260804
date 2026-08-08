/**
 * The DOM overlay.
 *
 * Rules this file exists to enforce:
 *  - nothing the child must do requires reading a word;
 *  - every required control is a big round target with a picture in it;
 *  - the only prose in the game lives behind the gear, for the parent.
 */

import { settings, saveSettings } from '../core/settings';
import { setVolume, sfxClick, initAudio, stopSpeech } from '../core/audio';

export type HintKind = 'swipe-up' | 'drag' | 'pull' | 'hold' | 'tap' | 'stir';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(paths: string, viewBox = '0 0 48 48', extra = ''): string {
  return `<svg xmlns="${SVG_NS}" viewBox="${viewBox}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;
}

const ICON = {
  gear: svg(
    `<circle cx="24" cy="24" r="7" stroke="#ffe9c9" stroke-width="3.4"/>
     <path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4.2 4.2M33.8 33.8L38 38M38 10l-4.2 4.2M14.2 33.8L10 38"
       stroke="#ffe9c9" stroke-width="3.4"/>`,
  ),
  sound: svg(
    `<path d="M12 19h7l9-7v24l-9-7h-7z" fill="#ffe9c9"/>
     <path d="M33 18c2.6 2.4 2.6 9.6 0 12M38 13c5 5 5 17 0 22" stroke="#ffe9c9" stroke-width="3.2"/>`,
  ),
  mute: svg(
    `<path d="M12 19h7l9-7v24l-9-7h-7z" fill="#ffe9c9"/>
     <path d="M33 18l11 12M44 18L33 30" stroke="#ffe9c9" stroke-width="3.4"/>`,
  ),
  pump: svg(
    `<circle cx="24" cy="24" r="15" fill="#b81f38"/>
     <path d="M24 12v13M24 25l-7 8M24 25l7 8" stroke="#ffe9c9" stroke-width="4"/>
     <circle cx="24" cy="36" r="3.4" fill="#ffe9c9"/>`,
  ),
  replay: svg(
    `<path d="M38 24a14 14 0 1 1-4.6-10.4" stroke="#a3132c" stroke-width="5"/>
     <path d="M36 6v10H26" stroke="#a3132c" stroke-width="5"/>`,
  ),
  newField: svg(
    `<path d="M6 32c6-4 12-4 18 0s12 4 18 0" stroke="#2f7a6c" stroke-width="4.5"/>
     <path d="M6 40c6-4 12-4 18 0s12 4 18 0" stroke="#2f7a6c" stroke-width="4.5"/>
     <circle cx="15" cy="16" r="5" fill="#a3132c"/>
     <circle cx="27" cy="12" r="5" fill="#c8324c"/>
     <circle cx="36" cy="19" r="5" fill="#7d0f22"/>`,
  ),
  sandbox: svg(
    `<circle cx="17" cy="30" r="6" fill="#a3132c"/>
     <circle cx="30" cy="33" r="5" fill="#c8324c"/>
     <circle cx="26" cy="20" r="4.5" fill="#7d0f22"/>
     <path d="M8 40h32" stroke="#2f7a6c" stroke-width="4"/>
     <path d="M22 9c0 4-4 4-4 8" stroke="#ffe9c9" stroke-width="3"/>
     <path d="M32 7c0 4-4 4-4 8" stroke="#ffe9c9" stroke-width="3"/>`,
  ),
  hand: svg(
    `<path d="M22 40c-6 0-10-4-11-9l-3-8c-.8-2 .4-3.7 2.2-4 1.5-.3 2.8.5 3.5 1.9L16 25V9c0-2 1.4-3.2 3-3.2S22 7 22 9v10V6.5C22 4.5 23.4 3.3 25 3.3S28 4.5 28 6.5V19v-9c0-2 1.4-3.2 3-3.2S34 8 34 10v9.5V14c0-1.9 1.4-3 3-3s3 1.1 3 3v14c0 7-4.5 12-11 12z"
      fill="#ffe9c9" stroke="#8a5a2b" stroke-width="1.6"/>`,
  ),
};

export interface UICallbacks {
  onPumpDown(): void;
  onPumpUp(): void;
  onReplaySame(): void;
  onReplayNew(): void;
  onSandbox(): void;
  onSettingsChanged(): void;
}

export class UI {
  private readonly beads: HTMLElement[] = [];
  private readonly hint: HTMLElement;
  private readonly pumpBtn: HTMLButtonElement;
  private readonly endcard: HTMLElement;
  private readonly sheet: HTMLElement;
  private readonly soundChip: HTMLButtonElement;
  private readonly boot: HTMLElement | null;

  constructor(
    root: HTMLElement,
    private readonly cb: UICallbacks,
    stepCount: number,
  ) {
    this.boot = document.getElementById('boot');

    /* progress beads */
    const beads = document.createElement('div');
    beads.className = 'beads';
    for (let i = 0; i < stepCount; i++) {
      const b = document.createElement('div');
      b.className = 'bead';
      beads.appendChild(b);
      this.beads.push(b);
    }
    root.appendChild(beads);

    /* top-right chips */
    const bar = document.createElement('div');
    bar.className = 'topbar';
    this.soundChip = document.createElement('button');
    this.soundChip.className = 'chip';
    this.soundChip.setAttribute('aria-label', '音のオン・オフ');
    this.soundChip.innerHTML = settings.volume > 0.01 ? ICON.sound : ICON.mute;
    this.soundChip.onclick = () => {
      settings.volume = settings.volume > 0.01 ? 0 : 0.8;
      setVolume(settings.volume);
      if (settings.volume <= 0.01) stopSpeech();
      this.soundChip.innerHTML = settings.volume > 0.01 ? ICON.sound : ICON.mute;
      saveSettings();
      this.syncSheet();
      cb.onSettingsChanged();
    };
    const gear = document.createElement('button');
    gear.className = 'chip';
    gear.setAttribute('aria-label', 'せってい');
    gear.innerHTML = ICON.gear;
    gear.onclick = () => this.openSheet(true);
    bar.append(this.soundChip, gear);
    root.appendChild(bar);

    /* pointing hand hint */
    this.hint = document.createElement('div');
    this.hint.className = 'hint';
    this.hint.innerHTML = `<div class="hint-inner">${ICON.hand}</div>`;
    root.appendChild(this.hint);

    /* the pump button (scene 7) */
    this.pumpBtn = document.createElement('button');
    this.pumpBtn.className = 'big-btn hidden';
    this.pumpBtn.setAttribute('aria-label', 'すいこむ');
    this.pumpBtn.innerHTML = ICON.pump;
    const down = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      this.pumpBtn.classList.add('pressed');
      cb.onPumpDown();
    };
    const up = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      this.pumpBtn.classList.remove('pressed');
      cb.onPumpUp();
    };
    this.pumpBtn.addEventListener('pointerdown', down);
    this.pumpBtn.addEventListener('pointerup', up);
    this.pumpBtn.addEventListener('pointercancel', up);
    this.pumpBtn.addEventListener('pointerleave', up);
    root.appendChild(this.pumpBtn);

    /* end card */
    this.endcard = document.createElement('div');
    this.endcard.className = 'endcard';
    const mk = (icon: string, label: string, size: number, fn: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.className = 'big-btn';
      b.style.width = `${size}px`;
      b.style.height = `${size}px`;
      b.setAttribute('aria-label', label);
      b.innerHTML = icon;
      b.onclick = () => {
        sfxClick();
        fn();
      };
      return b;
    };
    // "same field again" is biggest and centre-most: the default choice
    const again = mk(ICON.replay, 'おなじ はたけで もういちど', 128, cb.onReplaySame);
    again.classList.add('calling');
    this.endcard.append(
      mk(ICON.newField, 'べつの はたけ', 88, cb.onReplayNew),
      again,
      mk(ICON.sandbox, 'じゆうに あそぶ', 88, cb.onSandbox),
    );
    root.appendChild(this.endcard);

    /* settings sheet */
    this.sheet = this.buildSheet();
    root.appendChild(this.sheet);

    this.layout();
  }

  /* ---------------- settings sheet ---------------- */

  private volSlider!: HTMLInputElement;
  private voiceTgl!: HTMLButtonElement;
  private motionTgl!: HTMLButtonElement;
  private lowTgl!: HTMLButtonElement;

  private buildSheet(): HTMLElement {
    const s = document.createElement('div');
    s.className = 'sheet';
    const card = document.createElement('div');
    card.className = 'sheet-card';
    card.innerHTML = `
      <h2>せってい / Settings</h2>
      <p class="sub">保護者のかた向けの設定です。ゲームの進行はリセットされません。</p>`;

    const rowVol = document.createElement('div');
    rowVol.className = 'row';
    rowVol.innerHTML = `<label>おと の おおきさ<small>Volume</small></label>`;
    this.volSlider = document.createElement('input');
    this.volSlider.type = 'range';
    this.volSlider.min = '0';
    this.volSlider.max = '1';
    this.volSlider.step = '0.05';
    this.volSlider.value = String(settings.volume);
    this.volSlider.oninput = () => {
      settings.volume = Number(this.volSlider.value);
      setVolume(settings.volume);
      if (settings.volume <= 0.01) stopSpeech();
      this.soundChip.innerHTML = settings.volume > 0.01 ? ICON.sound : ICON.mute;
      saveSettings();
      this.cb.onSettingsChanged();
    };
    rowVol.appendChild(this.volSlider);
    card.appendChild(rowVol);

    const toggle = (
      title: string,
      sub: string,
      get: () => boolean,
      set: (v: boolean) => void,
    ): HTMLButtonElement => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<label>${title}<small>${sub}</small></label>`;
      const t = document.createElement('button');
      t.className = 'toggle' + (get() ? ' on' : '');
      t.innerHTML = '<i></i>';
      t.onclick = () => {
        set(!get());
        t.classList.toggle('on', get());
        saveSettings();
        this.cb.onSettingsChanged();
      };
      row.appendChild(t);
      card.appendChild(row);
      return t;
    };

    this.voiceTgl = toggle(
      'こえ の あんない',
      'Short spoken cues (Japanese)',
      () => settings.voice,
      (v) => {
        settings.voice = v;
        if (!v) stopSpeech();
      },
    );
    this.motionTgl = toggle(
      'うごき を よわく',
      'Reduce motion — shorter camera moves',
      () => settings.reduceMotion,
      (v) => {
        settings.reduceMotion = v;
      },
    );
    this.lowTgl = toggle(
      'かるい モード',
      'Low graphics — fewer particles, simpler water',
      () => settings.lowGraphics,
      (v) => {
        settings.lowGraphics = v;
      },
    );

    const close = document.createElement('button');
    close.className = 'sheet-close';
    close.textContent = 'とじる / Close';
    close.onclick = () => this.openSheet(false);
    card.appendChild(close);

    s.appendChild(card);
    s.addEventListener('pointerdown', (e) => {
      if (e.target === s) this.openSheet(false);
    });
    return s;
  }

  private syncSheet(): void {
    this.volSlider.value = String(settings.volume);
    this.voiceTgl.classList.toggle('on', settings.voice);
    this.motionTgl.classList.toggle('on', settings.reduceMotion);
    this.lowTgl.classList.toggle('on', settings.lowGraphics);
  }

  openSheet(open: boolean): void {
    initAudio();
    this.syncSheet();
    this.sheet.classList.toggle('on', open);
  }

  get sheetOpen(): boolean {
    return this.sheet.classList.contains('on');
  }

  /* ---------------- runtime API ---------------- */

  setStep(i: number): void {
    this.beads.forEach((b, k) => {
      b.classList.toggle('done', k < i);
      b.classList.toggle('now', k === i);
    });
  }

  showHint(x: number, y: number, kind: HintKind): void {
    this.hint.style.left = `${x}px`;
    this.hint.style.top = `${y}px`;
    const inner = this.hint.firstElementChild as HTMLElement;
    inner.className = `hint-inner hint-${kind}`;
    this.hint.classList.add('on');
  }

  hideHint(): void {
    this.hint.classList.remove('on');
  }

  showPump(visible: boolean): void {
    this.pumpBtn.classList.toggle('hidden', !visible);
    this.pumpBtn.classList.toggle('calling', visible);
  }

  setPumpCalling(on: boolean): void {
    this.pumpBtn.classList.toggle('calling', on);
  }

  showEndCard(visible: boolean): void {
    this.endcard.classList.toggle('on', visible);
  }

  bootProgress(t: number): void {
    const bar = this.boot?.querySelector('i') as HTMLElement | null;
    if (bar) bar.style.width = `${Math.round(t * 100)}%`;
  }

  hideBoot(): void {
    this.boot?.classList.add('gone');
    window.setTimeout(() => this.boot?.remove(), 600);
  }

  /** Re-place the orientation-sensitive controls. */
  layout(): void {
    const portrait = window.innerHeight >= window.innerWidth;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = Math.round(Math.min(Math.max(Math.min(w, h) * 0.26, 96), 156));
    this.pumpBtn.style.width = `${size}px`;
    this.pumpBtn.style.height = `${size}px`;
    if (portrait) {
      // bottom centre: the thumb zone, and clear of the water surface above
      this.pumpBtn.style.left = `calc(50% - ${size / 2}px)`;
      this.pumpBtn.style.right = 'auto';
      this.pumpBtn.style.bottom = `calc(var(--safe-b) + 26px)`;
    } else {
      // bottom right, so the left hand can still drag the hose
      this.pumpBtn.style.left = 'auto';
      this.pumpBtn.style.right = `calc(var(--safe-r) + 26px)`;
      this.pumpBtn.style.bottom = `calc(var(--safe-b) + 22px)`;
    }
  }

  /** Rect the pump button occupies, so world dragging can avoid it. */
  pumpRect(): DOMRect {
    return this.pumpBtn.getBoundingClientRect();
  }

  get pumpVisible(): boolean {
    return !this.pumpBtn.classList.contains('hidden');
  }
}
