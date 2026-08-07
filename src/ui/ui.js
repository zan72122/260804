import './ui.css';

// ---------------------------------------------------------------------------
// 画面の上にのせる案内。ぜんぶ ひらがな。数字も点も、できたぶんだけ。
// 点数も時間も出さない。急かさない。
// ---------------------------------------------------------------------------

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

export class UI {
  constructor(root, steps) {
    this.root = root;
    this.steps = steps;

    this.card = el('div', 'card');
    root.appendChild(this.card);

    this.dots = el('div', 'dots');
    this.dotEls = steps.map(() => {
      const d = el('div', 'dot');
      this.dots.appendChild(d);
      return d;
    });
    this.dots.style.opacity = '0';
    this.dots.style.transition = 'opacity .4s ease';
    root.appendChild(this.dots);

    this.hint = el('div', 'hint', '<div class="ring"></div><div class="finger"></div>');
    root.appendChild(this.hint);

    this.praiseEl = el('div', 'praise');
    root.appendChild(this.praiseEl);

    this.sound = el('button', 'sound', '♪');
    this.sound.setAttribute('aria-label', 'おと');
    root.appendChild(this.sound);
    this.muted = false;
    this.sound.addEventListener('click', () => {
      this.muted = !this.muted;
      this.sound.textContent = this.muted ? '✕' : '♪';
      this.onMute?.(this.muted);
    });

    this.title = el('div', 'veil');
    this.title.appendChild(
      el(
        'h1',
        null,
        'ねじって！<br>よりあわせて！<small>ながい ロープみち</small>'
      )
    );
    this.title.appendChild(
      el(
        'p',
        null,
        'ながい ながい しごとばで、<br>ほそい あさの たばを ねじって、<br>ふとい ロープを つくります。'
      )
    );
    this.startBtn = el('button', 'btn', 'はじめる');
    this.title.appendChild(this.startBtn);
    root.appendChild(this.title);

    this.end = el('div', 'veil hide');
    this.end.appendChild(el('h1', null, 'できあがり！<small>りっぱな ロープ</small>'));
    this.endText = el('p', null, '');
    this.end.appendChild(this.endText);
    this.replayBtn = el('button', 'btn', 'もういちど');
    this.end.appendChild(this.replayBtn);
    root.appendChild(this.end);

    this.startBtn.addEventListener('click', () => this.onStart?.());
    this.replayBtn.addEventListener('click', () => this.onReplay?.());
  }

  showStep(index) {
    const s = this.steps[index];
    if (!s) return;
    this.card.innerHTML = `<span class="step">${index + 1} / ${this.steps.length}</span>${s.text}`;
    this.card.classList.add('show');
    this.dotEls.forEach((d, i) => {
      d.classList.toggle('done', i < index);
      d.classList.toggle('now', i === index);
    });
    this.setHintKind(s.gesture);
  }

  setCardText(html) {
    this.card.innerHTML = html;
    this.card.classList.add('show');
  }

  hideCard() {
    this.card.classList.remove('show');
  }

  setHintKind(kind) {
    this.hint.className = 'hint' + (kind ? ' ' + kind : '');
    this._hintKind = kind;
  }

  showHint(x, y) {
    this.hint.style.transform = `translate(${x}px, ${y}px)`;
    this.hint.classList.add('show');
  }

  hideHint() {
    this.hint.classList.remove('show');
  }

  praise(text) {
    this.praiseEl.textContent = text;
    this.praiseEl.classList.remove('pop');
    // 再生しなおすために一度リフローさせる
    void this.praiseEl.offsetWidth;
    this.praiseEl.classList.add('pop');
  }

  hideTitle() {
    this.title.classList.add('hide');
    this.dots.style.opacity = '1';
  }

  showEnd(text) {
    this.endText.innerHTML = text;
    this.end.classList.remove('hide');
    this.hideCard();
    this.hideHint();
    this.dots.style.opacity = '0';
  }

  hideEnd() {
    this.end.classList.add('hide');
    this.dots.style.opacity = '1';
  }
}
