/** Thin DOM layer: banner, task chips, gesture hint hand, celebration. */
export class UI {
  constructor() {
    this.banner = document.getElementById('banner');
    this.bannerIcon = document.getElementById('banner-icon');
    this.bannerText = document.getElementById('banner-text');
    this.bannerCount = document.getElementById('banner-count');
    this.tasks = [...document.querySelectorAll('#tasks .task')];
    this.hint = document.getElementById('hint');
    this.hintHand = document.getElementById('hint-hand');
    this.cheer = document.getElementById('cheer');
    this.title = document.getElementById('title-screen');
    this.startBtn = document.getElementById('start-btn');
    this.hintMode = null;
    this.hintT = 0;
    this.hintA = { x: 0, y: 0 };
    this.hintB = { x: 0, y: 0 };
  }

  onStart(fn) {
    this.startBtn.addEventListener('click', () => {
      this.title.classList.add('hidden');
      fn();
    }, { once: true });
  }

  showBanner(icon, text, count = '') {
    this.bannerIcon.textContent = icon;
    this.bannerText.textContent = text;
    this.bannerCount.textContent = count;
    this.banner.classList.remove('hidden');
  }

  setCount(count) { this.bannerCount.textContent = count; }

  hideBanner() { this.banner.classList.add('hidden'); }

  setTask(i) {
    this.tasks.forEach((el, j) => {
      el.classList.toggle('current', j === i);
      el.classList.toggle('done', j < i);
    });
  }

  allTasksDone() {
    this.tasks.forEach((el) => { el.classList.remove('current'); el.classList.add('done'); });
  }

  celebrate() {
    this.cheer.classList.remove('hidden', 'pop');
    void this.cheer.offsetWidth; // restart the animation
    this.cheer.classList.add('pop');
    setTimeout(() => this.cheer.classList.add('hidden'), 1300);
  }

  /**
   * mode: 'tap' | 'swipe' | 'drag' | 'dragup' | null
   * a/b: screen-space anchors (b used by 'drag')
   */
  setHint(mode, a, b) {
    this.hintMode = mode;
    if (a) this.hintA = a;
    if (b) this.hintB = b;
    this.hint.classList.toggle('hidden', !mode);
  }

  updateHint(dt) {
    if (!this.hintMode) return;
    this.hintT += dt;
    const t = this.hintT;
    let x = this.hintA.x, y = this.hintA.y, s = 1, rot = -15;
    const cyc = (p) => (t % p) / p;
    if (this.hintMode === 'tap') {
      const k = cyc(0.9);
      s = k < 0.25 ? 1 - Math.sin((k / 0.25) * Math.PI) * 0.25 : 1;
      y += Math.sin(t * 2) * 4;
    } else if (this.hintMode === 'swipe') {
      const k = cyc(1.2);
      x += Math.sin(k * Math.PI * 2) * 46;
      y += 6;
    } else if (this.hintMode === 'dragup') {
      const k = cyc(1.3);
      y += 30 - Math.min(k * 1.4, 1) * 70;
      s = k < 0.12 ? 0.85 : 1;
    } else if (this.hintMode === 'drag') {
      const k = Math.min(cyc(1.7) * 1.25, 1);
      const e = k * k * (3 - 2 * k);
      x = this.hintA.x + (this.hintB.x - this.hintA.x) * e;
      y = this.hintA.y + (this.hintB.y - this.hintA.y) * e;
    }
    this.hint.style.transform = `translate(${x - 14}px, ${y - 8}px) scale(${s}) rotate(${rot}deg)`;
  }
}
