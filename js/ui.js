// The DOM layer: a handful of very large buttons, one short line of hiragana
// at a time, and a small chain of icons so a child can see where they are in
// the process. Nothing here explains the causality in words — the swatch that
// says "this is the colour the wax is holding" does that job.

import { PATTERNS } from './patterns.js';
import { PHASE } from './game.js';

const COLOURS = {
  cream: '#efe4cd',
  indigo: '#2f4d7d',
  soga: '#8a5423',
  dark: '#2b2420',
};

export class UI {
  constructor() {
    this.el = {
      chain: document.getElementById('chain'),
      protect: document.getElementById('protect'),
      protectChip: document.getElementById('protect-chip'),
      prompt: document.getElementById('prompt'),
      promptText: document.getElementById('prompt-text'),
      actions: document.getElementById('actions'),
      waxmeter: document.getElementById('waxmeter'),
      waxfill: document.getElementById('waxmeter-fill'),
      picker: document.getElementById('picker'),
      pickerGrid: document.getElementById('picker-grid'),
      legend: document.getElementById('legend'),
      lg: [document.getElementById('lg1'), document.getElementById('lg2'), document.getElementById('lg3')],
      endbar: document.getElementById('endbar'),
      info: document.getElementById('info'),
      boot: document.getElementById('boot'),
      btnSound: document.getElementById('btn-sound'),
      btnInfo: document.getElementById('btn-info'),
    };
    this.game = null;
    this.refillFlash = 0;
    this.lastPrompt = '';
    this.buildPicker();

    this.el.btnInfo.addEventListener('click', () => {
      this.el.info.classList.toggle('hidden');
    });
    document.getElementById('info-close').addEventListener('click', () => {
      this.el.info.classList.add('hidden');
    });
    this.el.endbar.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        if (!this.game) return;
        this.game.sfx.pop();
        this.game.restart(b.dataset.mode);
      });
    });
  }

  bind(game) {
    this.game = game;
    this.el.btnSound.addEventListener('click', () => {
      const on = this.el.btnSound.classList.toggle('off');
      game.sfx.setEnabled(!on);
      this.el.btnSound.textContent = on ? '🔇' : '🔊';
    });
    this.onPhase(game);
  }

  // ---- motif chooser -------------------------------------------------------

  buildPicker() {
    const grid = this.el.pickerGrid;
    grid.innerHTML = '';
    for (const p of PATTERNS) {
      const card = document.createElement('button');
      card.className = 'card';
      card.dataset.id = p.id;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 200;
      drawPreview(cv, p);
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = p.label;
      const sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = p.hint;
      card.appendChild(cv);
      card.appendChild(name);
      card.appendChild(sub);
      card.addEventListener('click', () => {
        if (!this.game) return;
        this.game.sfx.chime(2);
        this.game.startPattern(p.id);
      });
      grid.appendChild(card);
    }
  }

  // ---- per-phase furniture -------------------------------------------------

  onPhase(game) {
    const p = game.phase;
    const e = this.el;
    e.picker.classList.toggle('hidden', p !== PHASE.PICK);
    e.endbar.classList.toggle('hidden', p !== PHASE.DONE);
    e.chain.classList.toggle('hidden', p === PHASE.PICK);
    e.waxmeter.classList.toggle('hidden', !(p === PHASE.WAX1 || p === PHASE.WAX2));

    const showProtect = [PHASE.WAX1, PHASE.DIP1, PHASE.WAX2, PHASE.DIP2].includes(p);
    e.protect.classList.toggle('hidden', !showProtect);
    if (showProtect) {
      const held = (p === PHASE.WAX1 || p === PHASE.DIP1) ? COLOURS.cream : COLOURS.indigo;
      e.protectChip.style.background = held;
    }

    const showLegend = [PHASE.REVEAL, PHASE.UNFURL, PHASE.DONE].includes(p);
    e.legend.classList.toggle('hidden', !showLegend);
    if (showLegend) {
      e.lg[0].style.background = COLOURS.cream;
      e.lg[1].style.background = COLOURS.indigo;
      e.lg[2].style.background = COLOURS.dark;
    }

    // Chain highlight
    const order = ['wax1', 'dip1', 'wax2', 'dip2', 'lorod'];
    const current = { wax1: 0, dip1: 1, wax2: 2, dip2: 3, lorod: 4, reveal: 5, unfurl: 5, done: 5 }[p];
    e.chain.querySelectorAll('.step').forEach((el) => {
      const i = order.indexOf(el.dataset.step);
      el.classList.toggle('now', i === current);
      el.classList.toggle('done', current !== undefined && i < current);
    });

    this.buildActions(game);
  }

  clearActions() { this.el.actions.innerHTML = ''; }

  addAction(label, icon, cls, fn) {
    const b = document.createElement('button');
    b.className = `big ${cls || ''}`;
    if (icon) {
      const s = document.createElement('span');
      s.textContent = icon;
      b.appendChild(s);
    }
    b.appendChild(document.createTextNode(label));
    b.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (this.game) this.game.sfx.pop();
      fn(b);
    });
    this.el.actions.appendChild(b);
    return b;
  }

  buildActions(game) {
    this.clearActions();
    const p = game.phase;
    if (p === PHASE.WAX1 || p === PHASE.WAX2) {
      this.refillBtn = this.addAction('ろうを すくう', '🕯️', 'calm', () => game.startRefill());
      this.nextBtn = this.addAction('つぎへ', '➡️', '', () => {
        game.setPhase(p === PHASE.WAX1 ? PHASE.DIP1 : PHASE.DIP2);
      });
    } else if (p === PHASE.DIP1 || p === PHASE.DIP2) {
      this.dipBtn = this.addAction('しずめる', '⬇️', 'calm', () => { game.autoDip = true; game.autoLift = false; });
      this.liftBtn = this.addAction('ひきあげる', '⬆️', '', () => { game.autoLift = true; game.autoDip = false; });
      this.liftBtn.classList.add('hidden');
    } else if (p === PHASE.LOROD) {
      this.addAction('ろうを とる', '✨', 'calm', () => { game.autoLorod = true; });
    } else if (p === PHASE.UNFURL) {
      this.addAction('ひろげる', '↔️', 'calm', () => { game.autoUnfurl = true; });
    }
  }

  flashRefill() {
    this.refillFlash = 1.2;
  }

  // ---- per-frame -----------------------------------------------------------

  tick(game, dt) {
    const e = this.el;
    const p = game.phase;

    if (p === PHASE.WAX1 || p === PHASE.WAX2) {
      e.waxfill.style.width = `${Math.round(game.waxLevel * 100)}%`;
      const low = game.waxLevel < 0.18;
      if (this.refillBtn) this.refillBtn.classList.toggle('pulse', low || this.refillFlash > 0);
      if (this.nextBtn) {
        this.nextBtn.classList.toggle('pulse', game.guideProgress() > 0.5 || game.phaseTime > 24);
      }
    }
    if (this.refillFlash > 0) this.refillFlash -= dt;

    if (p === PHASE.DIP1 || p === PHASE.DIP2) {
      const soaked = game.soaked;
      if (this.dipBtn) this.dipBtn.classList.toggle('hidden', soaked || game.dipDepth > 0.55);
      if (this.liftBtn) this.liftBtn.classList.toggle('hidden', !(soaked || game.dipDepth > 0.55));
      if (this.dipBtn) this.dipBtn.classList.toggle('pulse', game.dipDepth < 0.05 && game.phaseTime > 4);
      if (this.liftBtn) this.liftBtn.classList.toggle('pulse', soaked);
    }

    let text = '';
    switch (p) {
      case PHASE.WAX1:
        text = game.refill ? 'canting に ろうを いれるよ'
          : game.waxLevel < 0.02 ? 'ろうを すくおう'
            : game.freeMode ? 'すきなように かいてね'
              : 'ゆっくり なぞってね';
        break;
      case PHASE.WAX2:
        text = game.refill ? 'canting に ろうを いれるよ'
          : game.waxLevel < 0.02 ? 'ろうを すくおう'
            : 'あおを まもろう';
        break;
      case PHASE.DIP1:
      case PHASE.DIP2:
        text = game.soaked ? 'ひきあげよう ⬆️'
          : game.dipDepth > 0.5 ? 'いろが しみて いくよ…'
            : 'したへ ⬇️ しずめてね';
        break;
      case PHASE.LOROD:
        text = game.lorodFront < 0.02 ? 'よこに すーっと なでてね ➡️' : 'ろうが とけて いくよ…';
        break;
      case PHASE.REVEAL:
        text = 'わあっ！ かくれて いた もようが でてきた';
        break;
      case PHASE.UNFURL:
        text = game.foldAmount > 0.02 ? 'ひろげてね ↔️' : 'ばさっ！';
        break;
      default:
        text = '';
    }
    if (text !== this.lastPrompt) {
      this.lastPrompt = text;
      e.promptText.textContent = text;
      e.prompt.classList.toggle('hidden', !text);
      // restart the breathing animation so a new line catches the eye
      e.prompt.style.animation = 'none';
      void e.prompt.offsetWidth;
      e.prompt.style.animation = '';
    }
  }

  hideBoot() {
    this.el.boot.classList.add('gone');
    setTimeout(() => this.el.boot.classList.add('hidden'), 700);
  }

  fatal(msg) {
    const f = document.getElementById('fatal');
    f.textContent = msg;
    f.classList.remove('hidden');
  }
}

// A small 2D preview of what the child is about to trace: round 1 in wax
// amber, round 2 dashed, on a scrap of cream cloth.
function drawPreview(canvas, pattern) {
  const g = canvas.getContext('2d');
  const S = canvas.width;
  g.fillStyle = '#efe4cd';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < S; i += 5) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
  }
  if (pattern.free) {
    g.fillStyle = 'rgba(42,29,19,0.32)';
    g.font = `${S * 0.42}px serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('✋', S / 2, S / 2);
    return;
  }
  const built = pattern.build();
  const draw = (lines, style, w, dash) => {
    g.strokeStyle = style;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.setLineDash(dash || []);
    for (const line of lines) {
      g.beginPath();
      line.forEach(([x, y], i) => {
        const px = x * S, py = (1 - y) * S;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      });
      g.stroke();
    }
    g.setLineDash([]);
  };
  draw(built.stage2, 'rgba(47,77,125,0.55)', S * 0.022, [S * 0.03, S * 0.03]);
  draw(built.stage1, '#c98f39', S * 0.030);
}
