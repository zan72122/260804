// ============================================================================
// 画面まわり（DOM）— 文字はひらがな中心、押せるものは大きく。
// ============================================================================

const $ = (id) => document.getElementById(id);

export const OX_LABELS = [
  { t: 0.00, name: 'きみどり' },
  { t: 0.28, name: 'みどり' },
  { t: 0.55, name: 'あおみどり' },
  { t: 0.78, name: 'あお' },
  { t: 0.94, name: 'ふかい あいいろ' }
];

export function oxLabel(ox) {
  let n = OX_LABELS[0].name;
  for (const l of OX_LABELS) if (ox >= l.t) n = l.name;
  return n;
}

export class UI {
  constructor() {
    this.el = {
      boot: $('boot'),
      title: $('title'),
      hud: $('hud'),
      stageStep: $('stage-step'),
      stageName: $('stage-name'),
      hint: $('hint'),
      hintIcon: $('hint-icon'),
      hintText: $('hint-text'),
      next: $('next-btn'),
      tools: $('tools'),
      dips: $('dips'),
      colorbar: $('colorbar'),
      cbMarker: document.querySelector('#colorbar .cb-marker'),
      cbLabel: document.querySelector('#colorbar .cb-label'),
      toast: $('toast'),
      reveal: $('reveal'),
      revealName: $('reveal-name'),
      revealNote: $('reveal-note'),
      revealRecipe: $('reveal-recipe'),
      startBtn: $('start-btn'),
      againBtn: $('again-btn'),
      lookBtn: $('look-btn'),
      soundBtn: $('sound-btn'),
      restartBtn: $('restart-btn'),
      rotateHint: $('rotate-hint')
    };
    this._toastTimer = null;
    this._toolPick = null;
    this.el.tools.addEventListener('click', (e) => {
      const b = e.target.closest('.tool');
      if (b && this._toolPick) this._toolPick(b.dataset.id);
    });
  }

  bootDone() { this.el.boot.classList.add('hidden'); }

  showTitle(on) { this.el.title.classList.toggle('hidden', !on); }
  showHud(on) { this.el.hud.classList.toggle('hidden', !on); }

  setStage(step, name) {
    this.el.stageStep.textContent = step || '';
    this.el.stageStep.style.display = step ? '' : 'none';
    this.el.stageName.textContent = name || '';
  }

  setHint(icon, text) {
    this.el.hintIcon.textContent = icon || '';
    this.el.hintText.innerHTML = text || '';
  }

  showNext(label) {
    if (!label) { this.el.next.classList.add('hidden'); return; }
    this.el.next.textContent = label;
    this.el.next.classList.remove('hidden');
  }

  setTools(list, onPick) {
    this._toolPick = onPick || null;
    if (!list || list.length === 0) {
      this.el.tools.classList.add('hidden');
      this.el.tools.innerHTML = '';
      return;
    }
    this.el.tools.classList.remove('hidden');
    this.el.tools.innerHTML = list.map(t =>
      `<button class="tool${t.on ? ' on' : ''}" data-id="${t.id}">
         <span class="gl">${t.glyph}</span><span>${t.label}</span>
       </button>`).join('');
  }

  updateToolStates(activeId) {
    for (const b of this.el.tools.querySelectorAll('.tool')) {
      b.classList.toggle('on', b.dataset.id === activeId);
    }
  }

  showDips(n) {
    if (n <= 0) { this.el.dips.classList.add('hidden'); return; }
    this.el.dips.classList.remove('hidden');
    this.el.dips.innerHTML = 'そめた かず ' +
      Array.from({ length: Math.min(n, 6) }, () => '<span class="drop"></span>').join('');
  }

  showColorbar(on) { this.el.colorbar.classList.toggle('hidden', !on); }

  setColorbar(ox) {
    this.el.cbMarker.style.left = (ox * 100).toFixed(1) + '%';
    this.el.cbLabel.textContent = oxLabel(ox);
  }

  toast(text, ms = 1500) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.remove('hidden');
    // 再生アニメーションのやり直し
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  showReveal(data) {
    if (!data) { this.el.reveal.classList.add('hidden'); return; }
    this.el.revealName.textContent = data.name;
    this.el.revealNote.textContent = data.note;
    this.el.revealRecipe.innerHTML = data.recipe || '';
    this.el.reveal.classList.remove('hidden');
    const card = this.el.reveal.querySelector('.reveal-card');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  }

  setSound(on) {
    this.el.soundBtn.textContent = on ? '🔊' : '🔇';
    this.el.soundBtn.classList.toggle('off', !on);
  }

  flashRotateHint() {
    const el = this.el.rotateHint;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(() => el.classList.add('hidden'), 5000);
  }
}
