// 画面まわり。文字は最小限にして、絵と大きな当たり判定で進める。
import { ICONS, iconEl } from './icons.js';
import { PROJECTS, FINISHES, STICKERS, WOODS, APRONS } from '../game/blueprints.js';

const STEP_ORDER = [
  { id: 'wood', icon: 'wood' },
  { id: 'tape', icon: 'tape' },
  { id: 'pencil', icon: 'pencil' },
  { id: 'clamp', icon: 'clamp' },
  { id: 'saw', icon: 'saw' },
  { id: 'sand', icon: 'sand' },
  { id: 'assemble', icon: 'assemble' },
  { id: 'hammer', icon: 'hammer' },
  { id: 'paint', icon: 'paint' },
  { id: 'sticker', icon: 'sticker' },
  { id: 'done', icon: 'done' },
];

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.stickerList = STICKERS;
    this._build();
  }

  _build() {
    const r = this.root;
    r.innerHTML = `
      <div id="loading"><div class="spin"></div><p>じゅんび ちゅう…</p></div>

      <div id="title" class="screen hidden">
        <h1><span>はかって！トントン！</span><b>ちいさな大工さん</b></h1>
        <div class="rowlabel"><i>${ICONS.wood}</i></div>
        <div id="woodrow" class="chips"></div>
        <div id="projrow" class="cards"></div>
        <div class="rowlabel apron-label"><i>${ICONS.sticker}</i></div>
        <div id="apronrow" class="chips"></div>
      </div>

      <div id="steps" class="hidden"></div>

      <div id="corner" class="hidden">
        <button id="homeBtn" class="round">${ICONS.home}</button>
        <button id="muteBtn" class="round">${ICONS.sound}</button>
      </div>

      <div id="goal" class="hidden"><canvas width="180" height="180"></canvas></div>

      <div id="bubble" class="hidden"></div>

      <div id="palette" class="tray hidden"></div>
      <div id="stickertray" class="tray hidden"></div>

      <div id="endchoices" class="screen hidden">
        <div class="cards big"></div>
      </div>

      <div id="freebar" class="tray hidden"></div>
    `;
    this.loading = r.querySelector('#loading');
    this.title = r.querySelector('#title');
    this.steps = r.querySelector('#steps');
    this.corner = r.querySelector('#corner');
    this.goal = r.querySelector('#goal');
    this.bubble = r.querySelector('#bubble');
    this.palette = r.querySelector('#palette');
    this.stickertray = r.querySelector('#stickertray');
    this.endchoices = r.querySelector('#endchoices');
    this.freebar = r.querySelector('#freebar');

    // 工程アイコン
    STEP_ORDER.forEach((s) => {
      const d = document.createElement('div');
      d.className = 'stepicon';
      d.dataset.id = s.id;
      d.innerHTML = ICONS[s.icon];
      this.steps.appendChild(d);
    });

    r.querySelector('#homeBtn').addEventListener('click', () => {
      this.game.audio.uiTap();
      this.game.goHome();
    });
    const mute = r.querySelector('#muteBtn');
    mute.addEventListener('click', () => {
      const m = !this.game.audio.muted;
      this.game.audio.setMuted(m);
      mute.innerHTML = m ? ICONS.mute : ICONS.sound;
      if (!m) this.game.audio.uiTap();
    });
  }

  /* ---------------- タイトル ---------------- */
  buildTitle(thumbs, onStart) {
    const woodRow = this.root.querySelector('#woodrow');
    woodRow.innerHTML = '';
    this.selectedWood = null;
    WOODS.forEach((w) => {
      const b = document.createElement('button');
      b.className = 'chip wood';
      b.style.background = `linear-gradient(135deg, ${w.base}, ${w.grain})`;
      b.innerHTML = `<span>${w.name}</span>`;
      b.addEventListener('click', () => {
        this.selectedWood = w;
        [...woodRow.children].forEach((c) => c.classList.remove('on'));
        b.classList.add('on');
        this.game.audio.uiTap();
      });
      woodRow.appendChild(b);
    });

    const apronRow = this.root.querySelector('#apronrow');
    apronRow.innerHTML = '';
    APRONS.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'chip apron' + (i === 0 ? ' on' : '');
      b.style.background = a.bg;
      b.innerHTML = `<span style="color:${a.fg}">${a.name}</span>`;
      b.addEventListener('click', () => {
        [...apronRow.children].forEach((c) => c.classList.remove('on'));
        b.classList.add('on');
        this.game.setApron(a);
        this.game.audio.uiTap();
      });
      apronRow.appendChild(b);
    });

    const row = this.root.querySelector('#projrow');
    row.innerHTML = '';
    PROJECTS.forEach((p) => {
      const card = document.createElement('button');
      card.className = 'card';
      const holder = document.createElement('div');
      holder.className = 'thumb';
      if (thumbs[p.id]) holder.appendChild(thumbs[p.id]);
      card.appendChild(holder);
      const nm = document.createElement('b');
      nm.textContent = p.name;
      card.appendChild(nm);
      card.addEventListener('click', () => {
        this.game.audio.uiTap();
        onStart(p, this.selectedWood);
      });
      row.appendChild(card);
    });
    // じゆうに つくる
    const free = document.createElement('button');
    free.className = 'card free';
    free.innerHTML = `<div class="thumb">${ICONS.free}</div><b>じゆうに つくる</b>`;
    free.addEventListener('click', () => {
      this.game.audio.uiTap();
      onStart('free', this.selectedWood);
    });
    row.appendChild(free);
  }

  showLoading(v) { this.loading.classList.toggle('hidden', !v); }
  showTitle(v) {
    this.title.classList.toggle('hidden', !v);
    this.steps.classList.toggle('hidden', v);
    this.corner.classList.toggle('hidden', v);
    this.goal.classList.toggle('hidden', v);
  }

  /* ---------------- 進行 ---------------- */
  setStep(id) {
    [...this.steps.children].forEach((c) => {
      c.classList.toggle('on', c.dataset.id === id);
      c.classList.toggle('past', STEP_ORDER.findIndex((s) => s.id === c.dataset.id) < STEP_ORDER.findIndex((s) => s.id === id));
    });
  }
  setStepsVisible(v) { this.steps.classList.toggle('hidden', !v); }

  /** 完成見本（絵） */
  setGoalImage(canvas) {
    const c = this.goal.querySelector('canvas');
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    if (canvas) ctx.drawImage(canvas, 0, 0, c.width, c.height);
    this.goal.classList.toggle('hidden', !canvas);
  }

  say(text) {
    if (!text) return;
    this.bubble.textContent = text;
    this.bubble.classList.remove('hidden');
    clearTimeout(this._bubbleT);
    this._bubbleT = setTimeout(() => this.bubble.classList.add('hidden'), 2600);
  }

  /* ---------------- 塗料パレット ---------------- */
  showPalette(v, onPick) {
    this.palette.classList.toggle('hidden', !v);
    // じゆうモードでは道具バーの上へずらす
    this.palette.classList.toggle('raised', !this.freebar.classList.contains('hidden'));
    if (!v) return;
    this.palette.innerHTML = '';
    FINISHES.forEach((f, i) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (i === 1 ? ' on' : '');
      b.style.background = f.rainbow
        ? 'conic-gradient(#ff7b7b,#ffb457,#ffe66d,#7bd88f,#6fc7ff,#b58cff,#ff7b7b)'
        : f.color;
      b.title = f.name;
      b.addEventListener('click', () => {
        [...this.palette.children].forEach((c) => c.classList.remove('on'));
        b.classList.add('on');
        this.game.audio.pop();
        onPick && onPick(f);
      });
      this.palette.appendChild(b);
    });
    onPick && onPick(FINISHES[1]);
  }

  /* ---------------- シール ---------------- */
  showStickers(v, onPick, onDone) {
    this.stickertray.classList.toggle('hidden', !v);
    if (!v) return;
    this.stickertray.innerHTML = '';
    STICKERS.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'swatch sticker' + (i === 0 ? ' on' : '');
      b.innerHTML = svgSticker(s.id, s.color);
      b.addEventListener('click', () => {
        [...this.stickertray.children].forEach((c) => c.classList.remove('on'));
        b.classList.add('on');
        this.game.audio.pop();
        onPick && onPick(s);
      });
      this.stickertray.appendChild(b);
    });
    const done = document.createElement('button');
    done.className = 'swatch okbtn';
    done.innerHTML = ICONS.done;
    done.addEventListener('click', () => { this.game.audio.uiTap(); onDone && onDone(); });
    this.stickertray.appendChild(done);
  }

  /* ---------------- おしまいの 3 つの選択 ---------------- */
  showEndChoices(onPick) {
    const box = this.endchoices.querySelector('.cards');
    box.innerHTML = '';
    const items = [
      { id: 'again', icon: 'again', label: 'もういちど' },
      { id: 'other', icon: 'other', label: 'べつのもの' },
      { id: 'free', icon: 'free', label: 'じゆうに つくる' },
    ];
    items.forEach((it) => {
      const b = document.createElement('button');
      b.className = 'card';
      b.innerHTML = `<div class="thumb">${ICONS[it.icon]}</div><b>${it.label}</b>`;
      b.addEventListener('click', () => {
        this.game.audio.uiTap();
        this.hideEndChoices();
        onPick(it.id);
      });
      box.appendChild(b);
    });
    this.endchoices.classList.remove('hidden');
  }
  hideEndChoices() { this.endchoices.classList.add('hidden'); }

  /* ---------------- じゆうモードの道具バー ---------------- */
  showFreeBar(v, items) {
    this.freebar.classList.toggle('hidden', !v);
    if (!v) return;
    this.freebar.innerHTML = '';
    items.forEach((it) => {
      const b = document.createElement('button');
      b.className = 'freebtn' + (it.on ? ' on' : '');
      b.innerHTML = ICONS[it.icon];
      b.dataset.id = it.id;
      b.addEventListener('click', () => {
        this.game.audio.uiTap();
        it.onPick();
      });
      this.freebar.appendChild(b);
    });
  }
  setFreeMode(id) {
    [...this.freebar.children].forEach((c) => c.classList.toggle('on', c.dataset.id === id));
  }
}

function svgSticker(kind, color) {
  if (kind === 'star') return `<svg viewBox="0 0 64 64"><path d="M32 8 l7 15 l16 2 l-12 11 l3 16 l-14 -8 l-14 8 l3 -16 l-12 -11 l16 -2 z" fill="${color}"/></svg>`;
  if (kind === 'flower') return `<svg viewBox="0 0 64 64">${[0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i / 6) * Math.PI * 2;
    return `<ellipse cx="${32 + Math.cos(a) * 13}" cy="${32 + Math.sin(a) * 13}" rx="11" ry="8" transform="rotate(${(a * 180) / Math.PI} ${32 + Math.cos(a) * 13} ${32 + Math.sin(a) * 13})" fill="${color}"/>`;
  }).join('')}<circle cx="32" cy="32" r="8" fill="#fff3a8"/></svg>`;
  if (kind === 'heart') return `<svg viewBox="0 0 64 64"><path d="M32 54 C4 34 12 12 32 26 C52 12 60 34 32 54 z" fill="${color}"/></svg>`;
  if (kind === 'rainbow') return `<svg viewBox="0 0 64 64">${['#ff7b7b', '#ffb457', '#ffe66d', '#7bd88f', '#6fc7ff', '#b58cff'].map((c, i) => `<path d="M8 48 a${24 - i * 4} ${24 - i * 4} 0 0 1 ${48 - i * 8} 0" fill="none" stroke="${c}" stroke-width="4" transform="translate(${i * 4},${i * 0})"/>`).join('')}</svg>`;
  return `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="${color}"/></svg>`;
}
