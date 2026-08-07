/* ============================================================
 *  ui.js — 画面上の大きなタッチ操作系
 *  4 歳児が指 1 本で扱えるサイズ・当たり判定にする。
 * ============================================================ */

const $ = (id) => document.getElementById(id);

/** 縦ドラッグで 0→1 になる大きなレバー */
class DragLever {
  constructor(el, { axis = 'y', dir = -1, travel = 120, onChange, onComplete, onRelease }) {
    this.el = el;
    this.knob = el.querySelector('.knob');
    this.axis = axis; this.dir = dir; this.travel = travel;
    this.onChange = onChange; this.onComplete = onComplete; this.onRelease = onRelease;
    this.value = 0; this.active = false; this.done = false;
    this.pid = null;

    el.addEventListener('pointerdown', (e) => this._down(e), { passive: false });
    el.addEventListener('pointermove', (e) => this._move(e), { passive: false });
    el.addEventListener('pointerup', (e) => this._up(e), { passive: false });
    el.addEventListener('pointercancel', (e) => this._up(e), { passive: false });
  }
  reset() {
    this.value = 0; this.done = false; this.active = false;
    this._apply();
  }
  _down(e) {
    if (this.done) return;
    e.preventDefault();
    this.pid = e.pointerId;
    this.el.setPointerCapture(e.pointerId);
    this.active = true;
    this.startX = e.clientX; this.startY = e.clientY;
    this.startV = this.value;
    this.el.classList.add('grab');
  }
  _move(e) {
    if (!this.active || e.pointerId !== this.pid) return;
    e.preventDefault();
    const d = this.axis === 'y' ? (e.clientY - this.startY) : (e.clientX - this.startX);
    let v = this.startV + (d * this.dir) / this.travel;
    v = Math.max(0, Math.min(1, v));
    this.value = v;
    this._apply();
    this.onChange && this.onChange(v);
    if (v >= 0.999 && !this.done) {
      this.done = true;
      this.active = false;
      try { this.el.releasePointerCapture(this.pid); } catch (_) { }
      this.el.classList.remove('grab');
      this.el.classList.add('done');
      this.onComplete && this.onComplete();
    }
  }
  _up(e) {
    if (e.pointerId !== this.pid) return;
    e.preventDefault();
    this.active = false;
    this.el.classList.remove('grab');
    try { this.el.releasePointerCapture(this.pid); } catch (_) { }
    this.onRelease && this.onRelease(this.value);
  }
  _apply() {
    const t = this.value * this.travel;
    if (this.axis === 'y') this.knob.style.transform = `translateY(${this.dir < 0 ? -t : t}px)`;
    else this.knob.style.transform = `translateX(${this.dir < 0 ? -t : t}px)`;
    this.el.style.setProperty('--v', this.value.toFixed(3));
  }
}

export class UI {
  constructor(game) {
    this.game = game;
    this.root = $('ui');
    this.coach = $('coach');
    this.coachText = $('coachText');
    this.hand = $('hand');
    this.ringCount = $('ringCount');
    this.depth = $('depthVal');
    this.flash = $('flash');
    this.banner = $('banner');
    this.bannerText = $('bannerText');
    this.title = $('title');
    this.pedal = $('pedal');
    this.leverEl = $('lever');
    this.jackEl = $('jack');
    this.pushBtn = $('pushBtn');
    this.ringDots = $('ringDots');

    /* --- 始動レバー --- */
    this.lever = new DragLever(this.leverEl, {
      axis: 'y', dir: -1, travel: 130,
      onChange: (v) => game.onLever(v),
      onComplete: () => game.onLeverDone(),
      onRelease: (v) => { if (v < 0.999) { this.lever.value = 0; this.lever._apply(); game.onLever(0); } },
    });

    /* --- ジャッキ ハンドル --- */
    this.jack = new DragLever(this.jackEl, {
      axis: 'y', dir: 1, travel: 130,
      onChange: (v) => game.onJack(v),
      onComplete: () => game.onJackDone(),
    });

    /* --- 掘進ペダル（長押し）--- */
    const press = (on) => (e) => {
      e.preventDefault();
      this.pedal.classList.toggle('press', on);
      game.setDigging(on);
    };
    this.pedal.addEventListener('pointerdown', press(true), { passive: false });
    this.pedal.addEventListener('pointerup', press(false), { passive: false });
    this.pedal.addEventListener('pointercancel', press(false), { passive: false });
    this.pedal.addEventListener('pointerleave', press(false), { passive: false });

    /* --- K セグメント 押し込みボタン --- */
    this.pushBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      game.pushKey();
    }, { passive: false });

    /* --- タイトル --- */
    $('startBtn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.title.classList.add('gone');
      game.start();
    }, { passive: false });

    $('againBtn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.hideBanner();
      game.continueAfterReveal();
    }, { passive: false });

    this.setControls({});
  }

  /* 表示する操作系を切り替える */
  setControls({ lever = false, pedal = false, jack = false, push = false }) {
    this.leverEl.classList.toggle('show', lever);
    this.pedal.classList.toggle('show', pedal);
    this.jackEl.classList.toggle('show', jack);
    this.pushBtn.classList.toggle('show', push);
    if (!pedal) this.pedal.classList.remove('press');
  }

  resetLever() { this.lever.reset(); }
  resetJack() { this.jack.reset(); }

  setCoach(text, hint = '') {
    if (this.coachText.textContent !== text) {
      this.coachText.textContent = text;
      this.coach.classList.remove('pop');
      void this.coach.offsetWidth;
      this.coach.classList.add('pop');
    }
    this.coach.classList.toggle('hidden', !text);
    this.hand.className = 'hand ' + (hint || 'none');
  }

  setRings(n, target) {
    this.ringCount.textContent = String(n);
    // 進捗ドット
    if (this.ringDots.childElementCount !== target) {
      this.ringDots.innerHTML = '';
      for (let i = 0; i < target; i++) {
        const d = document.createElement('i');
        this.ringDots.appendChild(d);
      }
    }
    const k = n % target;
    [...this.ringDots.children].forEach((d, i) => {
      d.classList.toggle('on', i < (k === 0 && n > 0 ? target : k));
    });
  }

  setDepth(m) { this.depth.textContent = m.toFixed(1); }

  doFlash(dur = 900) {
    this.flash.classList.remove('go');
    void this.flash.offsetWidth;
    this.flash.style.setProperty('--dur', dur + 'ms');
    this.flash.classList.add('go');
  }

  showBanner(text, showAgain = true) {
    this.bannerText.innerHTML = text;
    this.banner.classList.add('show');
    $('againBtn').classList.toggle('show', showAgain);
  }
  hideBanner() { this.banner.classList.remove('show'); }

  setOrientation(portrait) {
    this.root.classList.toggle('portrait', portrait);
    this.root.classList.toggle('landscape', !portrait);
  }
}
