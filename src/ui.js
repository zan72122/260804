/**
 * ui.js — 文字が読めなくても遊べるオーバーレイ。
 * 絵（ピクトグラム）と大きなアニメーションだけで「いま何をするか」を伝える。
 */
const CIRC = 2 * Math.PI * 84;

export function createUI() {
  const $ = (id) => document.getElementById(id);
  const el = {
    ui: $('ui'), onomat: $('onomat'), gauge: $('gaugeSvg'), gFill: document.querySelector('#gaugeSvg .g-fill'),
    hintCircle: $('hintCircle'), hintSwipe: $('hintSwipe'), hintHold: $('hintHold'),
    title: $('titleScreen'), replay: $('replayScreen'), loading: $('loading'),
    badge: $('taskBadge'), badgeIcon: $('taskIcon'), badgeWord: $('taskWord'),
    ladleCount: $('ladleCount'), soundBtn: $('soundBtn'),
    startBtn: $('startBtn'), againBtn: $('againBtn'), freeBtn: $('freeBtn'),
  };

  // 追加の演出レイヤ（貫通フラッシュと熱のベール）
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0',
    background: 'radial-gradient(60% 45% at 50% 42%, #fff8e0 0%, #ffb03a 35%, rgba(255,90,0,0) 72%)',
    mixBlendMode: 'screen',
  });
  el.ui.appendChild(flash);

  const heat = document.createElement('div');
  Object.assign(heat.style, {
    position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0',
    background: 'radial-gradient(80% 60% at 50% 78%, rgba(255,110,20,.55) 0%, rgba(255,60,0,.16) 45%, rgba(0,0,0,0) 75%)',
    mixBlendMode: 'screen', transition: 'opacity .35s ease',
  });
  el.ui.appendChild(heat);

  let flashV = 0;
  let hintTimer = null, curHint = null;

  const hideHints = () => {
    for (const h of [el.hintCircle, el.hintSwipe, el.hintHold]) h.classList.add('hidden');
    curHint = null;
  };

  const api = {
    el,
    ready() { el.loading.classList.add('hidden'); },

    /* 擬音ポップ */
    say(text, color) {
      el.onomat.textContent = text;
      el.onomat.style.color = color || '#fff';
      el.onomat.classList.remove('pop');
      void el.onomat.offsetWidth;
      el.onomat.classList.add('pop');
    },

    /* 上部の「いま何をする？」バッジ */
    task(icon, word) {
      if (!icon) { el.badge.classList.add('hidden'); return; }
      const changed = el.badgeIcon.textContent !== icon || el.badgeWord.textContent !== word;
      const wasHidden = el.badge.classList.contains('hidden');
      el.badgeIcon.textContent = icon;
      el.badgeWord.textContent = word || '';
      el.badge.classList.remove('hidden');
      if (changed || wasHidden) {
        el.badge.style.animation = 'none'; void el.badge.offsetWidth; el.badge.style.animation = '';
      }
    },

    /* 進み具合リング */
    gauge(v) {
      if (v == null) { el.gauge.classList.add('hidden'); return; }
      el.gauge.classList.remove('hidden');
      const c = Math.max(0, Math.min(1, v));
      el.gFill.style.strokeDashoffset = String(CIRC * (1 - c));
      el.gauge.classList.toggle('done', c > 0.995);
    },

    /* ヒント（迷ったら自然に出る） */
    hint(kind) {
      if (curHint === kind) return;
      hideHints();
      curHint = kind;
      if (kind === 'circle') el.hintCircle.classList.remove('hidden');
      else if (kind === 'swipe') el.hintSwipe.classList.remove('hidden');
      else if (kind === 'hold') el.hintHold.classList.remove('hidden');
    },
    noHint() { hideHints(); },

    flash(v = 1) { flashV = Math.max(flashV, v); },
    heat(v) { heat.style.opacity = String(Math.max(0, Math.min(0.9, v))); },

    screen(which) {
      el.title.classList.toggle('hidden', which !== 'title');
      el.replay.classList.toggle('hidden', which !== 'replay');
    },
    ladle(n, cap) {
      el.ladleCount.textContent = '🫗 ' + '●'.repeat(n) + '○'.repeat(Math.max(0, cap - n));
    },

    update(dt) {
      if (flashV > 0) {
        flashV = Math.max(0, flashV - dt * 2.6);
        flash.style.opacity = String(Math.min(1, flashV));
      }
    },
  };
  return api;
}
