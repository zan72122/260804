import { clamp01 } from '../core/util';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(paths: string, viewBox = '0 0 24 24', fill = 'none', stroke = '#eaf6ff') {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', viewBox);
  s.innerHTML = paths;
  s.setAttribute('fill', fill);
  s.setAttribute('stroke', stroke);
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  return s;
}

const ICONS = {
  soundOn: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a9 9 0 0 1 0 12"/>',
  soundOff: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  map: '<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/>',
  replay: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
  go: '<path d="M4 15c2.2 1.4 4.4 2 6.6 2 3.2 0 5.9-1.4 8.9-2l-2.2 4.6c-2.4.6-4.4 1.4-6.7 1.4-2.3 0-4.4-.6-6.6-2V15z" fill="#06322a" stroke="#eafff6"/><path d="M6.5 15V8.6h9.8L19 15" stroke="#eafff6"/><path d="M11.5 8.6V4.5h4.8" stroke="#eafff6"/>',
  arrowDown: '<path d="M12 4v14M6 13l6 6 6-6"/>',
  boat: '<path d="M3 15c2.6 1.6 5.2 2.3 7.8 2.3 3.8 0 6.9-1.6 10.2-2.3l-2.5 5.2C15.7 20.9 13.4 22 10.8 22 8.1 22 5.6 21.2 3 19.4V15z" fill="#0b2a3d"/><path d="M6 15V7h11l3 8" fill="#144a68"/><path d="M11 7V2h5v5"/>',
  island: '<path d="M2 19h20" /><path d="M6 19c1-5 3-8 6-8s5 3 6 8" fill="#123c2a"/><circle cx="12" cy="6" r="2"/>',
};

export type HudButton = 'mute' | 'home' | 'replay' | 'go';

export class Hud {
  root: HTMLElement;
  private lever: HTMLElement;
  private leverKnob: HTMLElement;
  private hand: HTMLElement;
  private rail: HTMLElement;
  private railFill: HTMLElement;
  private railBoat: HTMLElement;
  private flash: HTMLElement;
  private vig: HTMLElement;
  private fade: HTMLElement;
  private titleEl: HTMLElement;
  private picker: HTMLElement;
  private buttons: Record<HudButton, HTMLButtonElement>;
  private leverHeld = false;

  onButton: (b: HudButton) => void = () => {};
  onLeverDown: () => void = () => {};
  onLeverUp: () => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;

    // ---- title ------------------------------------------------------------
    this.titleEl = document.createElement('div');
    this.titleEl.id = 'title';
    this.titleEl.innerHTML = `
      <div class="card">
        <svg class="art" viewBox="0 0 300 150" fill="none">
          <defs>
            <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#2aa3c4"/><stop offset="1" stop-color="#052033"/>
            </linearGradient>
          </defs>
          <rect x="0" y="72" width="300" height="78" fill="url(#sea)" rx="10"/>
          <path d="M40 72c20 0 26 44 62 44s52-44 86-44 46 40 72 40" stroke="#ffc93c" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="M60 72h120l-16 24H76z" fill="#123c56"/>
          <path d="M84 48h56v24H84z" fill="#e9eef2"/>
          <path d="M96 30h20v18H96z" fill="#d8622f"/>
          <circle cx="182" cy="66" r="9" fill="#8d949a"/>
          <circle cx="250" cy="122" r="10" fill="#f7b520"/>
          <path d="M240 122h20M250 112v20" stroke="#2b3136" stroke-width="3"/>
        </svg>
        <h1>するする！しずめて！<br/>うみのケーブルせん</h1>
      </div>`;
    root.appendChild(this.titleEl);

    // ---- buttons ----------------------------------------------------------
    const mk = (id: string, cls: string, icon: string, key: HudButton) => {
      const b = document.createElement('button');
      b.id = id;
      b.className = `btn ${cls}`;
      b.setAttribute('data-ui-button', '1');
      b.setAttribute('aria-label', id);
      b.appendChild(svg(icon));
      const fire = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.onButton(key);
      };
      b.addEventListener('pointerup', fire);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      root.appendChild(b);
      return b;
    };
    this.buttons = {
      mute: mk('mute', 'small', ICONS.soundOn, 'mute'),
      home: mk('home', 'small', ICONS.map, 'home'),
      replay: mk('replay', 'small', ICONS.replay, 'replay'),
      go: mk('go', 'big', ICONS.go, 'go'),
    };

    // ---- lever -------------------------------------------------------------
    this.lever = document.createElement('div');
    this.lever.id = 'lever';
    this.lever.setAttribute('data-ui-button', '1');
    this.lever.innerHTML = `<div class="track"></div><div class="knob"></div>`;
    const arrow = svg(ICONS.arrowDown);
    arrow.classList.add('arrow');
    this.lever.appendChild(arrow);
    this.leverKnob = this.lever.querySelector('.knob') as HTMLElement;
    const down = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.leverHeld) return;
      this.leverHeld = true;
      this.lever.classList.add('pulled');
      this.onLeverDown();
    };
    const up = () => {
      if (!this.leverHeld) return;
      this.leverHeld = false;
      this.lever.classList.remove('pulled');
      this.onLeverUp();
    };
    this.lever.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    root.appendChild(this.lever);

    // ---- hint hand ---------------------------------------------------------
    this.hand = document.createElement('div');
    this.hand.id = 'hand';
    this.hand.innerHTML = `<div class="ring"></div><div class="dot"></div>`;
    root.appendChild(this.hand);

    // ---- progress rail -----------------------------------------------------
    this.rail = document.createElement('div');
    this.rail.id = 'rail';
    this.rail.innerHTML = `<div class="bar"><div class="fill"></div></div>`;
    const isA = svg(ICONS.island);
    isA.classList.add('end', 'a');
    const isB = svg(ICONS.island);
    isB.classList.add('end', 'b');
    const boat = svg(ICONS.boat);
    boat.classList.add('boat');
    this.rail.append(isA, isB, boat);
    this.railFill = this.rail.querySelector('.fill') as HTMLElement;
    this.railBoat = boat as unknown as HTMLElement;
    root.appendChild(this.rail);

    // ---- picker (icon chips) ------------------------------------------------
    this.picker = document.createElement('div');
    this.picker.id = 'picker';
    root.appendChild(this.picker);

    // ---- overlays -----------------------------------------------------------
    this.flash = document.createElement('div');
    this.flash.id = 'flash';
    root.appendChild(this.flash);
    this.vig = document.createElement('div');
    this.vig.id = 'vig';
    root.appendChild(this.vig);
    this.fade = document.createElement('div');
    this.fade.id = 'fade';
    root.appendChild(this.fade);
  }

  /** Black curtain used between stages. */
  setFade(v: number, ms = 450) {
    this.fade.style.transition = `opacity ${ms}ms ease`;
    this.fade.style.opacity = String(clamp01(v));
  }

  setTitle(on: boolean) {
    this.titleEl.classList.toggle('on', on);
    // never eats pointer events - the whole screen is the "start" target and
    // the canvas underneath must receive the tap
    this.titleEl.style.pointerEvents = 'none';
  }

  setButton(b: HudButton, on: boolean) {
    this.buttons[b].classList.toggle('on', on);
    this.buttons[b].style.pointerEvents = on ? 'auto' : 'none';
  }

  setMuteIcon(muted: boolean) {
    const b = this.buttons.mute;
    b.innerHTML = '';
    b.appendChild(svg(muted ? ICONS.soundOff : ICONS.soundOn));
  }

  setLever(on: boolean) {
    this.lever.classList.toggle('on', on);
    this.lever.style.pointerEvents = on ? 'auto' : 'none';
    if (!on && this.leverHeld) {
      this.leverHeld = false;
      this.lever.classList.remove('pulled');
      this.onLeverUp();
    }
  }

  /** Visual feedback: knob sinks in proportion to how much cable is running. */
  setLeverAmount(v: number) {
    const k = clamp01(v);
    this.leverKnob.style.top = `${18 + k * 90}px`;
  }

  isLeverHeld() {
    return this.leverHeld;
  }

  setHand(on: boolean, x?: number, y?: number) {
    this.hand.classList.toggle('on', on);
    if (x !== undefined && y !== undefined) {
      this.hand.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  setRail(on: boolean, progress = 0) {
    this.rail.classList.toggle('on', on);
    const p = clamp01(progress);
    this.railFill.style.width = `${p * 100}%`;
    const w = this.rail.clientWidth - 52;
    this.railBoat.style.left = `${26 + p * w}px`;
  }

  /** Build a row of icon-only choices; returns nothing, selection via callback. */
  setPicker(
    groups: { key: string; options: { draw: (c: HTMLCanvasElement) => void }[]; selected: number }[] | null,
    onPick?: (groupKey: string, index: number) => void,
  ) {
    this.picker.innerHTML = '';
    if (!groups) {
      this.picker.classList.remove('on');
      return;
    }
    for (const g of groups) {
      g.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'chip' + (i === g.selected ? ' sel' : '');
        b.setAttribute('data-ui-button', '1');
        b.dataset.group = g.key;
        b.dataset.index = String(i);
        const c = document.createElement('canvas');
        c.width = 96;
        c.height = 96;
        opt.draw(c);
        b.appendChild(c);
        b.addEventListener('pointerup', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.picker.querySelectorAll(`.chip[data-group="${g.key}"]`).forEach((n) => n.classList.remove('sel'));
          b.classList.add('sel');
          onPick?.(g.key, i);
        });
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.picker.appendChild(b);
      });
    }
    this.picker.classList.add('on');
  }

  hidePicker() {
    this.picker.classList.remove('on');
    this.picker.innerHTML = '';
  }

  flashOnce(strength = 0.75, ms = 520) {
    this.flash.style.transition = 'opacity 0.06s ease';
    this.flash.style.opacity = String(strength);
    window.setTimeout(() => {
      this.flash.style.transition = `opacity ${ms}ms ease`;
      this.flash.style.opacity = '0';
    }, 60);
  }

  setVignette(v: number) {
    this.vig.style.opacity = String(clamp01(v));
  }

  setOrientationClass(portrait: boolean) {
    document.body.classList.toggle('portrait', portrait);
    document.body.classList.toggle('landscape', !portrait);
  }
}
