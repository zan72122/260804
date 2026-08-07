// Every piece of on-screen guidance, with no words anywhere.
//
// A four-year-old cannot read the instructions, so the game only ever shows
// them: a hand tracing the gesture it wants, anchored to the object it wants
// it on.  The hint appears after a few idle seconds and disappears the moment
// the child touches anything, so it never nags a player who already knows.

import { decorSvg } from '../world/decorations.js';

const $ = (id) => document.getElementById(id);

/* ---------- hint graphics: pure svg, animated by css ---------- */
const HINTS = {
  circle: `
    <g class="hStroke spin">
      <circle cx="100" cy="100" r="58" />
    </g>
    <g class="hFill">
      <path d="M150 76 l16 26 -30 2 z" />
    </g>
    <g class="hStroke"><path d="M100 24 l0 0" /></g>
    ${hand(100, 42)}`,
  tap: `
    <circle class="hStroke tapRing" cx="100" cy="100" r="34" />
    <circle class="hStroke tapRing" cx="100" cy="100" r="34" style="animation-delay:.55s" />
    <g class="press">${hand(100, 96)}</g>`,
  dragDown: `
    <g class="hStroke"><path d="M100 52 L100 140" /><path d="M84 124 L100 144 L116 124" /></g>
    <g class="bobDown">${hand(100, 46)}</g>`,
  dragUp: `
    <g class="hStroke"><path d="M100 148 L100 60" /><path d="M84 76 L100 56 L116 76" /></g>
    <g class="bobUp">${hand(100, 152)}</g>`,
  dragSide: `
    <g class="hStroke"><path d="M46 100 L154 100" /><path d="M136 84 L156 100 L136 116" /></g>
    <g class="bobSide">${hand(60, 100)}</g>`,
  paint: `
    <g class="hStroke"><path d="M40 128 C 70 80, 130 156, 162 96" /></g>
    <g class="bobSide">${hand(100, 118)}</g>`,
  wait: `
    <g class="hStroke spin"><circle cx="100" cy="100" r="46" /></g>`,
};

function hand(x, y) {
  // a chunky mitten so it reads at any size
  return `<g transform="translate(${x - 22},${y - 8}) scale(1.15)">
    <path class="hFill" d="M14 6 c0-3.3 2.7-6 6-6 s6 2.7 6 6 v18 l4-6 c1.6-2.6 5-3.4 7.6-1.8
      c2.5 1.5 3.3 4.8 1.9 7.4 l-8.6 15.6 c-2.4 4.4-7 7.1-12 7.1 h-4.6
      c-7.2 0-13-5.8-13-13 v-14 c0-3.3 2.7-6 6-6 c2.3 0 4.3 1.3 5.3 3.2 z" />
  </g>`;
}

export class Hud {
  constructor(rig) {
    this.rig = rig;
    this.hint = $('hint');
    this.hintSvg = $('hintSvg');
    this.progress = $('progress');
    this.pFill = $('pFill');
    this.pIcon = $('pIcon');
    this.tray = $('tray');
    this.choice = $('choice');
    this.choiceRow = $('choiceRow');
    this.replay = $('replayBtn');
    this.next = $('nextBtn');
    this.sndBtn = $('sndBtn');

    this._anchor = null;         // world Vector3 the hint sticks to
    this._screen = { x: 0, y: 0 };
    this._idle = 0;
    this._delay = 3.0;
    this._on = false;
    this._suppressed = false;

    this.flash = document.createElement('div');
    this.flash.className = 'flash';
    $('ui').appendChild(this.flash);
    this.rippleEl = document.createElement('div');
    this.rippleEl.className = 'ripple';
    $('ui').appendChild(this.rippleEl);
    this.ghost = null;
  }

  /* ---------------- hints ---------------- */

  /**
   * @param {string} kind key of HINTS
   * @param {THREE.Vector3|null} anchor world point to pin to (null = screen centre)
   * @param {number} delay seconds of idleness before it shows
   */
  setHint(kind, anchor = null, delay = 3.0) {
    if (this._kind !== kind) {
      this._kind = kind;
      this.hintSvg.innerHTML = HINTS[kind] || '';
    }
    this._anchor = anchor;
    this._delay = delay;
    this._idle = 0;
    this._suppressed = false;
    this._show(false);
  }

  clearHint() { this._kind = null; this.hintSvg.innerHTML = ''; this._show(false); this._anchor = null; }

  /** call whenever the player does something -- resets the idle timer */
  poke() { this._idle = 0; this._show(false); }

  /** stop showing this hint entirely (the step is understood) */
  suppress() { this._suppressed = true; this._show(false); }

  _show(on) {
    if (on === this._on) return;
    this._on = on;
    this.hint.classList.toggle('on', on);
  }

  update(dt, active) {
    this._idle += dt;
    if (this._kind && !this._suppressed && !active && this._idle > this._delay) this._show(true);
    if (this._on || this._anchor) {
      if (this._anchor) {
        this.rig.project(this._anchor, this._screen);
        this.hint.style.transform = `translate(${this._screen.x}px, ${this._screen.y}px)`;
      } else {
        const r = this.rig.canvas.getBoundingClientRect();
        this.hint.style.transform = `translate(${r.width / 2}px, ${r.height * 0.55}px)`;
      }
    }
  }

  /* ---------------- progress ring ---------------- */
  setProgress(v, iconSvg = null) {
    this.progress.classList.add('on');
    const C = 2 * Math.PI * 18;
    this.pFill.style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, v))));
    if (iconSvg != null && this._icon !== iconSvg) {
      this._icon = iconSvg;
      this.pIcon.innerHTML = iconSvg;
    }
  }
  hideProgress() { this.progress.classList.remove('on'); this._icon = null; }

  /* ---------------- decoration tray ---------------- */
  showTray(keys, onPick) {
    this.tray.innerHTML = '';
    this.tray.classList.add('on');
    this._trayPick = onPick;
    for (const k of keys) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.innerHTML = decorSvg(k);
      b.dataset.key = k;
      // pointerdown, not click: the child drags straight off the chip
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        onPick(k, e, b);
      }, { passive: false });
      this.tray.appendChild(b);
    }
  }
  hideTray() { this.tray.classList.remove('on'); this.tray.innerHTML = ''; }

  /* ---------------- drag ghost ---------------- */
  showGhost(key, x, y) {
    if (!this.ghost) {
      this.ghost = document.createElement('div');
      this.ghost.className = 'ghost';
      $('ui').appendChild(this.ghost);
    }
    this.ghost.innerHTML = decorSvg(key);
    this.ghost.style.display = 'block';
    this.moveGhost(x, y);
  }
  moveGhost(x, y) { if (this.ghost) this.ghost.style.transform = `translate(${x}px, ${y}px)`; }
  hideGhost() { if (this.ghost) this.ghost.style.display = 'none'; }

  /* ---------------- big picker ---------------- */
  /** @param {{svg:string, value:any}[]} opts */
  showChoice(opts, onPick) {
    this.choiceRow.innerHTML = '';
    this.choice.classList.add('on');
    for (const o of opts) {
      const b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = o.svg;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        this.hideChoice();
        onPick(o.value);
      });
      this.choiceRow.appendChild(b);
    }
  }
  hideChoice() { this.choice.classList.remove('on'); this.choiceRow.innerHTML = ''; }

  /* ---------------- flourishes ---------------- */
  doFlash() {
    this.flash.classList.remove('go');
    void this.flash.offsetWidth;
    this.flash.classList.add('go');
  }
  doRipple() {
    this.rippleEl.classList.remove('go');
    void this.rippleEl.offsetWidth;
    this.rippleEl.classList.add('go');
  }
  showReplay(on) { this.replay.classList.toggle('on', on); }

  /** forward arrow -- the only "I'm finished" control in the game */
  showNext(on, onTap) {
    this.next.classList.toggle('on', on);
    if (this._nextFn) this.next.removeEventListener('click', this._nextFn);
    this._nextFn = null;
    if (on && onTap) {
      this._nextFn = (e) => { e.preventDefault(); onTap(); };
      this.next.addEventListener('click', this._nextFn);
    }
  }
}

/* ---------- small icons for the progress ring ---------- */
export const STEP_ICONS = {
  core: icon(`<path d="M12 21c-4 0-6-1-6-2 0-3 1-9 6-14 5 5 6 11 6 14 0 1-2 2-6 2z"/>`),
  decor: icon(`<path d="M12 3l2.2 5.1 5.5.5-4.2 3.6 1.3 5.4L12 14.8 7.2 17.6l1.3-5.4L4.3 8.6l5.5-.5z"/>`),
  mold: icon(`<path d="M5 20c0-6 2-12 7-16 5 4 7 10 7 16z" opacity=".55"/><path d="M4 21h16"/>`),
  fire: icon(`<path d="M12 2c3 4 6 6 6 10a6 6 0 0 1-12 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 1-6 2-9z"/>`),
  pour: icon(`<path d="M4 6h8v4a5 5 0 0 1-5 5H4z"/><path d="M13 10c2 3 3 6 3 10"/>`),
  cool: icon(`<path d="M12 2v20M4 7l16 10M20 7L4 17"/>`),
  break: icon(`<path d="M13 2L5 13h5l-1 9 9-12h-5z"/>`),
  lift: icon(`<path d="M12 21V8"/><path d="M7 12l5-5 5 5"/><path d="M5 4h14"/>`),
  ring: icon(`<path d="M12 3a1.6 1.6 0 0 1 1.6 1.6c3 .8 5.4 3.7 5.4 7.1V17l1.4 2.2c.3.5 0 1.1-.6 1.1H4.2c-.6 0-.9-.6-.6-1.1L5 17v-5.3c0-3.4 2.3-6.3 5.4-7.1A1.6 1.6 0 0 1 12 3z"/>`),
};
function icon(inner) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="#ffe0bd" stroke-width="1.9"
    stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
