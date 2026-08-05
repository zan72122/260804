// 画面の上にかぶせる操作パネル。文字はつかわず、絵と光だけ。
const NS = 'http://www.w3.org/2000/svg';

const SVG = {
  play: `<svg viewBox="0 0 100 100"><path d="M38 26 L76 50 L38 74 Z" fill="currentColor"/></svg>`,
  replay: `<svg viewBox="0 0 100 100"><path d="M50 18a32 32 0 1 0 32 32" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round"/><path d="M50 4 L50 32 L72 18 Z" fill="currentColor"/></svg>`,
  freeplay: `<svg viewBox="0 0 100 100">
    <path d="M50 12 L74 84 L26 84 Z" fill="url(#beamg)" opacity="0.95"/>
    <circle cx="50" cy="14" r="9" fill="currentColor"/>
    <ellipse cx="50" cy="84" rx="24" ry="7" fill="currentColor" opacity="0.55"/>
    <defs><linearGradient id="beamg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff8d0" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#ff9ad8" stop-opacity="0.25"/>
    </linearGradient></defs></svg>`,

  // 舞台えらび
  forest: `<svg viewBox="0 0 100 100"><rect x="45" y="58" width="10" height="26" rx="4" fill="#7a5433"/>
    <circle cx="50" cy="44" r="20" fill="#3f9a63"/><circle cx="33" cy="55" r="14" fill="#59b877"/>
    <circle cx="67" cy="55" r="14" fill="#2f7a52"/><circle cx="50" cy="30" r="13" fill="#6dc98a"/>
    <circle cx="26" cy="34" r="3" fill="#fff3a0"/><circle cx="76" cy="30" r="2.4" fill="#fff3a0"/></svg>`,
  sea: `<svg viewBox="0 0 100 100"><circle cx="72" cy="26" r="11" fill="#ffe9a8"/>
    <path d="M0 52 q14 -12 26 0 t26 0 t26 0 t26 0 v40 H0Z" fill="#2f8fd0"/>
    <path d="M0 66 q14 -12 26 0 t26 0 t26 0 t26 0 v30 H0Z" fill="#53b4e8"/>
    <path d="M0 80 q14 -10 26 0 t26 0 t26 0 t26 0 v20 H0Z" fill="#8fdcff"/></svg>`,
  night: `<svg viewBox="0 0 100 100"><path d="M62 14a26 26 0 1 0 22 34A30 30 0 0 1 62 14Z" fill="#ffe9a8"/>
    <path d="M22 46l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="#fff4c8"/>
    <path d="M74 66l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#fff4c8"/>
    <path d="M0 84 q22 -16 44 0 t44 0 v18 H0Z" fill="#3a2570"/></svg>`,

  // 幕えらび
  velvet: `<svg viewBox="0 0 100 100"><rect x="6" y="10" width="88" height="8" rx="4" fill="#e0b45c"/>
    <path d="M8 18 h36 v72 q-6 -6 -9 0 -6 6 -9 0 -6 -6 -9 0 -6 6 -9 0Z" fill="#9c1330"/>
    <path d="M92 18 h-36 v72 q6 -6 9 0 6 6 9 0 6 -6 9 0 6 6 9 0Z" fill="#9c1330"/>
    <path d="M14 18 v70 M24 18 v72 M34 18 v70 M86 18 v70 M76 18 v72 M66 18 v70" stroke="#5e0a1d" stroke-width="2.6" fill="none" opacity="0.75"/></svg>`,
  austrian: `<svg viewBox="0 0 100 100"><rect x="6" y="10" width="88" height="8" rx="4" fill="#e0b45c"/>
    <path d="M8 18 h84 v22 q-10 20 -21 0 -10 20 -21 0 -10 20 -21 0 -10 20 -21 0Z" fill="#c48ad0"/>
    <path d="M8 40 q10 22 21 0 10 22 21 0 10 22 21 0 10 22 21 0 v14 q-10 22 -21 0 -10 22 -21 0 -10 22 -21 0 -10 22 -21 0Z" fill="#d2a0d8"/>
    <path d="M29 18 v30 M50 18 v30 M71 18 v30" stroke="#9a5faa" stroke-width="2.2" opacity="0.6"/></svg>`,
  starlight: `<svg viewBox="0 0 100 100"><rect x="6" y="10" width="88" height="8" rx="4" fill="#e0b45c"/>
    <path d="M8 18 h84 v58 q-10 8 -21 0 -10 -8 -21 0 -10 8 -21 0 -10 -8 -21 0Z" fill="#7fbfff" opacity="0.85"/>
    <g fill="#fffbe0"><circle cx="24" cy="34" r="3"/><circle cx="46" cy="48" r="2.4"/><circle cx="68" cy="30" r="3.4"/>
    <circle cx="80" cy="56" r="2.2"/><circle cx="34" cy="62" r="2.6"/><circle cx="58" cy="66" r="2"/></g></svg>`,

  // 作業
  roll: `<svg viewBox="0 0 100 100"><rect x="18" y="22" width="46" height="52" rx="5" fill="#63c283"/>
    <rect x="26" y="30" width="30" height="36" rx="4" fill="#3f9a63"/>
    <circle cx="27" cy="80" r="7" fill="#2a2c34"/><circle cx="55" cy="80" r="7" fill="#2a2c34"/>
    <path d="M72 50 h18 M82 42 l10 8 -10 8" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  lift: `<svg viewBox="0 0 100 100"><rect x="10" y="12" width="80" height="6" rx="3" fill="#4a4d58"/>
    <path d="M34 18 v22 M66 18 v22" stroke="#8a7a58" stroke-width="3"/>
    <circle cx="50" cy="58" r="19" fill="#ffe9a8"/><circle cx="43" cy="52" r="3.5" fill="#e8d090"/><circle cx="56" cy="62" r="2.6" fill="#e8d090"/>
    <path d="M50 82 v10 M42 86 l8 8 8 -8" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  spot: `<svg viewBox="0 0 100 100"><path d="M50 16 L78 82 H22 Z" fill="url(#sg)"/>
    <rect x="40" y="8" width="20" height="14" rx="4" fill="#33363f"/>
    <ellipse cx="50" cy="82" rx="28" ry="8" fill="#fff3c8" opacity="0.85"/>
    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff6d8" stop-opacity="0.95"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0.18"/>
    </linearGradient></defs></svg>`,
  curtainOpen: `<svg viewBox="0 0 100 100"><rect x="6" y="12" width="88" height="7" rx="3.5" fill="#e0b45c"/>
    <path d="M8 19 h22 v66 q-5 -6 -8 0 -5 6 -7 0Z" fill="#9c1330"/>
    <path d="M92 19 h-22 v66 q5 -6 8 0 5 6 7 0Z" fill="#9c1330"/>
    <path d="M36 50 h-12 M28 42 l-8 8 8 8" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M64 50 h12 M72 42 l8 8 -8 8" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 舞台効果
  petal: `<svg viewBox="0 0 100 100"><g fill="#ff9ec4">
    <path d="M50 20c10 8 10 24 0 32-10-8-10-24 0-32Z"/>
    <path d="M26 46c12-2 22 10 20 22-12 2-22-10-20-22Z"/>
    <path d="M74 46c-12-2-22 10-20 22 12 2 22-10 20-22Z"/></g>
    <circle cx="50" cy="52" r="7" fill="#fff0a0"/>
    <g fill="#ffc9de"><circle cx="22" cy="80" r="5"/><circle cx="50" cy="86" r="4"/><circle cx="78" cy="78" r="5.5"/></g></svg>`,
  bubble: `<svg viewBox="0 0 100 100"><g fill="none" stroke="#9fe6ff" stroke-width="4">
    <circle cx="38" cy="44" r="20"/><circle cx="70" cy="64" r="14"/><circle cx="62" cy="28" r="10"/></g>
    <circle cx="31" cy="37" r="5" fill="#ffffff" opacity="0.9"/>
    <circle cx="66" cy="60" r="3.4" fill="#ffffff" opacity="0.9"/></svg>`,
  sparkle: `<svg viewBox="0 0 100 100"><g fill="#fff3b0">
    <path d="M50 14 L58 42 L86 50 L58 58 L50 86 L42 58 L14 50 L42 42 Z"/>
    <path d="M78 16 L82 26 L92 30 L82 34 L78 44 L74 34 L64 30 L74 26 Z" opacity="0.9"/>
    <path d="M22 62 L25 70 L33 73 L25 76 L22 84 L19 76 L11 73 L19 70 Z" opacity="0.8"/></g></svg>`,

  hand: `<svg viewBox="0 0 100 100"><path d="M40 78 V36a7 7 0 0 1 14 0v18l4-2c8-3 16 2 16 11v9c0 12-9 20-21 20h-6c-9 0-14-4-18-11l-9-15c-2-4 3-8 6-5l14 10Z" fill="#fff" stroke="#20222c" stroke-width="3.5" stroke-linejoin="round"/></svg>`,
  arrowH: `<svg viewBox="0 0 120 60"><path d="M18 30 h84 M30 16 l-14 14 14 14 M90 16 l14 14 -14 14" stroke="currentColor" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  arrowR: `<svg viewBox="0 0 120 60"><path d="M16 30 h86 M86 14 l18 16 -18 16" stroke="currentColor" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  arrowD: `<svg viewBox="0 0 60 120"><path d="M30 14 v86 M14 84 l16 18 16 -18" stroke="currentColor" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><path d="M12 2l2.8 6.6L22 9.6l-5.3 4.7L18.3 22 12 18.3 5.7 22l1.6-7.7L2 9.6l7.2-1Z" fill="currentColor"/></svg>`,
};

export class UI {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="progress" id="progress"></div>
      <div class="choice" id="choice"></div>
      <div class="dock" id="dock"></div>
      <div class="palette" id="palette"></div>
      <div class="center" id="center"></div>
      <div class="hint" id="hint"><div class="hintInner"></div></div>
      <div class="tint" id="tint"></div>
    `;
    this.$progress = root.querySelector('#progress');
    this.$choice = root.querySelector('#choice');
    this.$dock = root.querySelector('#dock');
    this.$palette = root.querySelector('#palette');
    this.$center = root.querySelector('#center');
    this.$hint = root.querySelector('#hint');
    this.$tint = root.querySelector('#tint');
    this.onAnyPress = null;
  }

  _btn(cls, html, onTap, style = {}) {
    const b = document.createElement('button');
    b.className = cls;
    b.innerHTML = html;
    Object.assign(b.style, style);
    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      b.classList.remove('pressed');
      void b.offsetWidth;
      b.classList.add('pressed');
      if (this.onAnyPress) this.onAnyPress();
      onTap(b);
    };
    b.addEventListener('pointerup', fire);
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    return b;
  }

  /* ---------- 3つから選ぶ画面 ---------- */
  showChoice(items, onPick) {
    this.$choice.innerHTML = '';
    this.$choice.classList.add('on');
    items.forEach((it, i) => {
      const card = this._btn('card', `<div class="cardArt">${SVG[it.icon]}</div>`, () => {
        this.hideChoice();
        onPick(i, it);
      });
      card.style.setProperty('--a', it.colorA);
      card.style.setProperty('--b', it.colorB);
      card.style.animationDelay = `${i * 0.09}s`;
      this.$choice.appendChild(card);
    });
  }
  hideChoice() {
    this.$choice.classList.remove('on');
    this.$choice.innerHTML = '';
  }

  /* ---------- 下のボタン列 ---------- */
  setDock(buttons) {
    this.$dock.innerHTML = '';
    if (!buttons || !buttons.length) { this.$dock.classList.remove('on'); return; }
    this.$dock.classList.add('on');
    buttons.forEach((b, i) => {
      const el = this._btn('dockBtn' + (b.big ? ' big' : ''), SVG[b.icon] || b.icon, () => b.onTap(el));
      el.style.setProperty('--c', b.color || '#ffe9b8');
      el.style.animationDelay = `${i * 0.07}s`;
      if (b.id) el.dataset.id = b.id;
      this.$dock.appendChild(el);
    });
  }
  pulseDock(id) {
    const el = this.$dock.querySelector(`[data-id="${id}"]`);
    if (el) { el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge'); }
  }

  /* ---------- 照明の色チップ ---------- */
  setPalette(colors, onPick, activeIndex = -1) {
    this.$palette.innerHTML = '';
    if (!colors || !colors.length) { this.$palette.classList.remove('on'); return; }
    this.$palette.classList.add('on');
    colors.forEach((c, i) => {
      const el = this._btn('chip' + (i === activeIndex ? ' active' : ''), '', () => {
        [...this.$palette.children].forEach((x) => x.classList.remove('active'));
        el.classList.add('active');
        onPick(i, c);
      });
      el.style.setProperty('--c', c.ui);
      el.style.animationDelay = `${i * 0.06}s`;
      this.$palette.appendChild(el);
    });
  }

  /* ---------- 真ん中の大きなボタン ---------- */
  showCenter(items) {
    this.$center.innerHTML = '';
    if (!items || !items.length) { this.$center.classList.remove('on'); return; }
    this.$center.classList.add('on');
    items.forEach((it, i) => {
      const el = this._btn('bigBtn', SVG[it.icon] || it.icon, () => it.onTap(el));
      el.style.setProperty('--c', it.color || '#ffe9b8');
      el.style.animationDelay = `${i * 0.12}s`;
      this.$center.appendChild(el);
    });
  }
  hideCenter() { this.$center.classList.remove('on'); this.$center.innerHTML = ''; }

  /* ---------- すすみぐあいの星 ---------- */
  setProgress(done, total) {
    if (!total) { this.$progress.classList.remove('on'); this.$progress.innerHTML = ''; return; }
    this.$progress.classList.add('on');
    if (this.$progress.children.length !== total) {
      this.$progress.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const s = document.createElement('div');
        s.className = 'pstar';
        s.innerHTML = SVG.star;
        this.$progress.appendChild(s);
      }
    }
    [...this.$progress.children].forEach((s, i) => s.classList.toggle('lit', i < done));
  }

  /* ---------- 指のヒント ---------- */
  // type: 'tap' | 'swipeRight' | 'swipeLeft' | 'swipeDown' | 'swipeWide'
  setHint(type, xPct, yPct, color = '#ffe9b8') {
    if (!type) { this.$hint.classList.remove('on'); return; }
    const inner = this.$hint.querySelector('.hintInner');
    let arrow = '';
    if (type === 'swipeRight') arrow = `<div class="harrow">${SVG.arrowR}</div>`;
    else if (type === 'swipeLeft') arrow = `<div class="harrow flip">${SVG.arrowR}</div>`;
    else if (type === 'swipeDown') arrow = `<div class="harrow down">${SVG.arrowD}</div>`;
    else if (type === 'swipeWide') arrow = `<div class="harrow">${SVG.arrowH}</div>`;
    inner.innerHTML = `${arrow}<div class="hhand">${SVG.hand}</div><div class="hring"></div>`;
    this.$hint.className = 'hint on ' + type;
    this.$hint.style.left = xPct + '%';
    this.$hint.style.top = yPct + '%';
    this.$hint.style.setProperty('--c', color);
  }
  hideHint() { this.$hint.classList.remove('on'); }

  // 画面全体をふわっと色づける（幕開けのごほうび）
  tintFlash(color = '#fff6e0', ms = 900) {
    this.$tint.style.background = color;
    this.$tint.classList.remove('on');
    void this.$tint.offsetWidth;
    this.$tint.style.setProperty('--dur', ms + 'ms');
    this.$tint.classList.add('on');
  }

  clearAll() {
    this.setDock(null);
    this.setPalette(null);
    this.hideCenter();
    this.hideChoice();
    this.hideHint();
    this.setProgress(0, 0);
  }
}

export { SVG };
