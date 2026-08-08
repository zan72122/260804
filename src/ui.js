// 画面上の操作部品。指 1 本・大きな当たり判定・吸着。
import { clamp01, lerp } from './util.js';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

const SVG = {
  drop: '<svg viewBox="0 0 24 24"><path d="M12 3s6 6.6 6 10.6A6 6 0 0 1 6 13.6C6 9.6 12 3 12 3z"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  arrowL: '<svg viewBox="0 0 24 24"><path d="M19 12H6M11 6l-6 6 6 6"/></svg>',
  truck: '<svg viewBox="0 0 24 24"><path d="M2 16V7h11v9M13 10h4l4 4v2h-2M4 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM15 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 13l4.5 4.5L19 7"/></svg>',
};

/* ============ レバー ============ */
class Lever {
  constructor(opts) {
    this.o = Object.assign({ dir: 'down', label: '', value: 0, big: false }, opts);
    const root = el('div', 'lever' + (this.o.dir === 'up' ? ' up' : '') + (this.o.big ? ' big' : ''));
    const track = el('div', 'lever-track');
    const fill = el('div', 'lever-fill');
    const knob = el('div', 'lever-knob');
    const arrow = el('div', 'lever-arrow');
    track.append(fill, knob, arrow);
    root.append(track);
    if (this.o.label) root.append(el('div', 'lever-label', this.o.label));
    this.root = root; this.track = track; this.fill = fill; this.knob = knob;
    this.value = this.o.value;
    this.dragging = false;
    this.nudgeTarget = null;
    this._bind();
    this.setValue(this.value, true);
  }
  _bind() {
    const t = this.track;
    let startY = 0, startV = 0, moved = 0, pid = null;
    const down = (e) => {
      if (this.o.locked) return;
      pid = e.pointerId;
      t.setPointerCapture(pid);
      startY = e.clientY; startV = this.value; moved = 0;
      this.dragging = true; this.nudgeTarget = null;
      this.root.classList.add('active', 'dragging');
      if (this.o.onGrab) this.o.onGrab();
      e.preventDefault();
    };
    const move = (e) => {
      if (!this.dragging || e.pointerId !== pid) return;
      const dy = e.clientY - startY;
      moved = Math.max(moved, Math.abs(dy));
      const range = Math.max(60, t.getBoundingClientRect().height * 0.86);
      const sign = this.o.dir === 'up' ? -1 : 1;
      this.setValue(startV + (dy * sign) / range);
      e.preventDefault();
    };
    const up = (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.root.classList.remove('active', 'dragging');
      try { t.releasePointerCapture(pid); } catch (err) { }
      if (moved < 8) {
        // タップ：少しだけ進める（4 歳児のための救済）
        this.nudgeTarget = clamp01(this.value + 0.34);
      } else if (this.value > 0.70) {
        this.nudgeTarget = 1;
      } else if (this.value < 0.06) {
        this.nudgeTarget = 0;
      }
      if (this.o.onRelease) this.o.onRelease(this.value);
    };
    t.addEventListener('pointerdown', down);
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
  }
  setValue(v, silent = false) {
    v = clamp01(v);
    const prev = this.value;
    this.value = v;
    const pct = this.o.dir === 'up' ? 88 - v * 76 : 12 + v * 76;
    this.knob.style.top = pct + '%';
    this.fill.style.height = (v * 100).toFixed(1) + '%';
    this.root.classList.toggle('done', v > 0.995);
    if (!silent && this.o.onChange && Math.abs(v - prev) > 1e-4) this.o.onChange(v, this.dragging);
  }
  update(dt) {
    if (this.nudgeTarget !== null && !this.dragging) {
      const d = this.nudgeTarget - this.value;
      if (Math.abs(d) < 0.004) { this.setValue(this.nudgeTarget); this.nudgeTarget = null; }
      else this.setValue(this.value + d * Math.min(1, dt * 7.5));
    }
  }
  lock(v) { this.o.locked = v; this.root.style.opacity = v ? 0.55 : 1; }
}

/* ============ 横スライダー ============ */
class Slider {
  constructor(opts) {
    this.o = Object.assign({ dir: 'right', value: 0 }, opts);
    const root = el('div', 'slider' + (this.o.dir === 'left' ? ' rtl' : ''));
    const fill = el('div', 'slider-fill');
    const knob = el('div', 'slider-knob', SVG.truck);
    const arrow = el('div', 'slider-arrow a1', this.o.dir === 'left' ? SVG.arrowL : SVG.arrowR);
    root.append(fill, knob, arrow);
    this.root = root; this.fill = fill; this.knob = knob;
    this.value = this.o.value; this.dragging = false;
    this._bind();
    this.setValue(this.value, true);
  }
  _bind() {
    const r = this.root;
    let startX = 0, startV = 0, pid = null;
    const down = (e) => {
      pid = e.pointerId; r.setPointerCapture(pid);
      startX = e.clientX; startV = this.value; this.dragging = true;
      e.preventDefault();
    };
    const move = (e) => {
      if (!this.dragging || e.pointerId !== pid) return;
      const dx = e.clientX - startX;
      const range = Math.max(80, r.getBoundingClientRect().width * 0.80);
      const sign = this.o.dir === 'left' ? -1 : 1;
      this.setValue(startV + (dx * sign) / range);
      e.preventDefault();
    };
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false;
      try { r.releasePointerCapture(pid); } catch (err) { }
      if (this.o.onRelease) this.o.onRelease(this.value);
    };
    r.addEventListener('pointerdown', down);
    r.addEventListener('pointermove', move);
    r.addEventListener('pointerup', up);
    r.addEventListener('pointercancel', up);
  }
  setValue(v, silent) {
    v = clamp01(v);
    const prev = this.value;
    this.value = v;
    const pct = 8 + v * 84;
    this.knob.style.left = (this.o.dir === 'left' ? 100 - pct : pct) + '%';
    this.fill.style.width = (v * 100).toFixed(1) + '%';
    if (!silent && this.o.onChange && Math.abs(v - prev) > 1e-4) this.o.onChange(v, this.dragging);
  }
  update() { }
}

/* ============ 丸ボタン ============ */
class RoundButton {
  constructor(opts) {
    this.o = Object.assign({ mode: 'tap', label: '', icon: '', cls: '' }, opts);
    const b = el('button', 'round-btn ' + this.o.cls);
    b.innerHTML = (this.o.icon || '') + (this.o.label ? `<span class="cap">${this.o.label}</span>` : '');
    this.root = b;
    if (this.o.mode === 'hold') {
      const start = (e) => {
        b.classList.add('held'); this.held = true;
        if (this.o.onHoldStart) this.o.onHoldStart();
        try { b.setPointerCapture(e.pointerId); } catch (err) { }
        e.preventDefault();
      };
      const end = () => {
        if (!this.held) return;
        this.held = false; b.classList.remove('held');
        if (this.o.onHoldEnd) this.o.onHoldEnd();
      };
      b.addEventListener('pointerdown', start);
      b.addEventListener('pointerup', end);
      b.addEventListener('pointercancel', end);
      b.addEventListener('pointerleave', end);
    } else {
      b.addEventListener('click', () => { if (this.o.onTap) this.o.onTap(); });
    }
  }
  update() { }
}

/* ============ UI 全体 ============ */
export class UI {
  constructor() {
    this.uiRoot = document.getElementById('ui');
    this.dock = document.getElementById('dock');
    this.hint = document.getElementById('hint');
    this.hintText = this.hint.querySelector('.hint-text');
    this.toastEl = document.getElementById('toast');
    this.dots = document.getElementById('stepdots');
    this.screen = document.getElementById('overlay');
    this.screenBody = document.getElementById('screen-body');
    this.widgets = [];
    this._toastTimer = null;
  }

  show(v) { this.uiRoot.classList.toggle('hidden', !v); }

  /* --- ドック --- */
  clearDock() {
    this.dock.innerHTML = '';
    this.widgets.length = 0;
  }
  addLever(opts) { const w = new Lever(opts); this.dock.append(w.root); this.widgets.push(w); return w; }
  addSlider(opts) { const w = new Slider(opts); this.dock.append(w.root); this.widgets.push(w); return w; }
  addButton(opts) { const w = new RoundButton(opts); this.dock.append(w.root); this.widgets.push(w); return w; }
  update(dt) { for (const w of this.widgets) w.update(dt); }

  /* --- ヒント --- */
  showHint(text, dir = 'down') {
    this.hintText.textContent = text;
    this.hint.className = 'hint ' + dir;
    // アニメーションを再生し直す
    void this.hint.offsetWidth;
  }
  hideHint() { this.hint.className = 'hint hidden'; }

  /* --- トースト --- */
  toast(text, dur = 1500) {
    clearTimeout(this._toastTimer);
    this.toastEl.textContent = text;
    this.toastEl.className = 'toast';
    void this.toastEl.offsetWidth;
    this._toastTimer = setTimeout(() => {
      this.toastEl.classList.add('out');
      this._toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), 450);
    }, dur);
  }
  clearToast() {
    clearTimeout(this._toastTimer);
    this.toastEl.className = 'toast hidden';
  }

  /* --- 進行ドット --- */
  setSteps(total, current) {
    if (this.dots.childElementCount !== total) {
      this.dots.innerHTML = '';
      for (let i = 0; i < total; i++) this.dots.append(el('i'));
    }
    [...this.dots.children].forEach((c, i) => {
      c.className = i < current ? 'done' : i === current ? 'now' : '';
    });
  }

  /* --- オーバーレイ --- */
  showScreen(html, bind) {
    this.screenBody.innerHTML = html;
    this.screen.classList.remove('hidden');
    if (bind) bind(this.screenBody);
  }
  hideScreen() { this.screen.classList.add('hidden'); }
  get screenVisible() { return !this.screen.classList.contains('hidden'); }
}

export { SVG };
