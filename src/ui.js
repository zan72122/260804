// The only 2D layer in the game: one big onomatopoeia word and one animated
// gesture icon. No numbers, no timer, no score, no sentences to read.

const GESTURE_SVG = {
  tap: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <circle class="g-ring" cx="60" cy="58" r="30"/>
    <circle class="g-ring g-ring2" cx="60" cy="58" r="30"/>
    <g class="g-hand g-tap"><path d="M60 34c-6 0-10 5-10 11v22l-8-6c-4-3-9-2-11 2s-1 8 2 11l16 16c4 4 9 6 14 6h10c9 0 16-7 16-16V56c0-5-4-9-9-9-2 0-4 1-5 2-1-4-4-7-8-7-2 0-4 1-6 2-1-6-5-10-11-10z"/></g>
  </svg>`,
  swipeUp: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <path class="g-trail" d="M60 96 L60 34"/>
    <path class="g-arrow" d="M46 46 L60 30 L74 46"/>
    <g class="g-hand g-swipe"><path d="M60 40c-6 0-10 5-10 11v22l-8-6c-4-3-9-2-11 2s-1 8 2 11l16 16c4 4 9 6 14 6h10c9 0 16-7 16-16V62c0-5-4-9-9-9-2 0-4 1-5 2-1-4-4-7-8-7-2 0-4 1-6 2-1-6-5-10-11-10z"/></g>
  </svg>`,
  wave: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <path class="g-trail g-wave1" d="M18 52c14-14 28 14 42 0s28 14 42 0"/>
    <path class="g-trail g-wave2" d="M18 70c14-14 28 14 42 0s28 14 42 0"/>
    <g class="g-hand g-fan"><path d="M60 20c-6 0-10 5-10 11v22l-8-6c-4-3-9-2-11 2s-1 8 2 11l16 16c4 4 9 6 14 6h10c9 0 16-7 16-16V42c0-5-4-9-9-9-2 0-4 1-5 2-1-4-4-7-8-7-2 0-4 1-6 2-1-6-5-10-11-10z"/></g>
  </svg>`,
  drag: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <path class="g-trail g-dash" d="M28 34 C 50 40, 66 62, 90 82"/>
    <circle class="g-dot" cx="28" cy="34" r="7"/>
    <path class="g-arrow" d="M76 80 L92 86 L86 70"/>
    <g class="g-hand g-drag"><path d="M60 30c-6 0-10 5-10 11v22l-8-6c-4-3-9-2-11 2s-1 8 2 11l16 16c4 4 9 6 14 6h10c9 0 16-7 16-16V52c0-5-4-9-9-9-2 0-4 1-5 2-1-4-4-7-8-7-2 0-4 1-6 2-1-6-5-10-11-10z"/></g>
  </svg>`,
  stroke: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <path class="g-trail g-brushline" d="M22 66 H 98"/>
    <g class="g-hand g-brush"><path d="M60 24c-6 0-10 5-10 11v22l-8-6c-4-3-9-2-11 2s-1 8 2 11l16 16c4 4 9 6 14 6h10c9 0 16-7 16-16V46c0-5-4-9-9-9-2 0-4 1-5 2-1-4-4-7-8-7-2 0-4 1-6 2-1-6-5-10-11-10z"/></g>
  </svg>`,
};

export class UI {
  constructor(root) {
    this.root = root;
    this.word = root.querySelector('#word');
    this.sub = root.querySelector('#sub');
    this.hint = root.querySelector('#hint');
    this.again = root.querySelector('#again');
    this.beads = root.querySelector('#beads');
    this.currentGesture = null;
  }

  setAction(word, gesture, sub = '') {
    if (this.word.textContent !== word) {
      this.word.textContent = word;
      this.word.classList.remove('pop');
      void this.word.offsetWidth;
      this.word.classList.add('pop');
    }
    this.sub.textContent = sub;
    this.word.style.opacity = word ? '1' : '0';
    if (gesture !== this.currentGesture) {
      this.currentGesture = gesture;
      this.hint.innerHTML = gesture ? GESTURE_SVG[gesture] : '';
      this.hint.style.opacity = gesture ? '1' : '0';
    }
  }

  /** Three beads for the three hammer blows — shape, not digits. */
  setBeads(total, filled) {
    if (!total) { this.beads.style.opacity = '0'; this.beads.innerHTML = ''; return; }
    if (this.beads.children.length !== total) {
      this.beads.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const b = document.createElement('span');
        this.beads.appendChild(b);
      }
    }
    [...this.beads.children].forEach((b, i) => b.classList.toggle('on', i < filled));
    this.beads.style.opacity = '1';
  }

  showAgain(show) {
    this.again.classList.toggle('show', !!show);
  }

  /** Hide the hint once the child is clearly doing the action. */
  fadeHint(v) {
    this.hint.style.opacity = String(v);
  }
}
