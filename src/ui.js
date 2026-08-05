// DOM overlay UI: big hiragana instructions, star progress, giant buttons.
// Everything is tap-only and impossible to fail.

const css = `
  #ui { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, sans-serif;
    -webkit-user-select: none; user-select: none; }
  .banner { position: absolute; top: max(10px, env(safe-area-inset-top)); left: 50%;
    transform: translateX(-50%); background: rgba(12, 40, 66, 0.82); color: #fff;
    padding: 10px 22px; border-radius: 999px; font-size: clamp(17px, 4.5vw, 26px);
    font-weight: 700; white-space: nowrap; border: 3px solid rgba(255,255,255,0.65);
    box-shadow: 0 4px 18px rgba(0,0,0,0.45); transition: opacity 0.4s, transform 0.4s;
    max-width: 94vw; overflow: hidden; text-overflow: ellipsis; }
  .banner.hide { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  .stars { position: absolute; top: max(64px, calc(env(safe-area-inset-top) + 54px));
    left: 50%; transform: translateX(-50%); display: flex; gap: 6px;
    font-size: clamp(16px, 4vw, 22px); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
    transition: opacity 0.4s; }
  .stars.hide { opacity: 0; }
  .star { opacity: 0.35; transition: transform 0.3s, opacity 0.3s; }
  .star.on { opacity: 1; transform: scale(1.25); }
  .bigbtn { position: absolute; bottom: max(26px, env(safe-area-inset-bottom)); left: 50%;
    transform: translateX(-50%); pointer-events: auto; border: none; cursor: pointer;
    background: linear-gradient(#63d66a, #2fa53a); color: #fff;
    font-size: clamp(20px, 5.5vw, 30px); font-weight: 800; padding: 16px 44px;
    border-radius: 999px; border-bottom: 6px solid #1d7a28; white-space: nowrap;
    box-shadow: 0 6px 22px rgba(0,0,0,0.5); animation: pulse 1.2s ease-in-out infinite;
    font-family: inherit; }
  .bigbtn:active { transform: translateX(-50%) scale(0.94); }
  .bigbtn.hide { display: none; }
  @keyframes pulse { 0%,100% { transform: translateX(-50%) scale(1); }
    50% { transform: translateX(-50%) scale(1.06); } }
  #title { position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 4vh; pointer-events: none;
    transition: opacity 0.8s; }
  #title.hide { opacity: 0; }
  #title h1 { color: #fff; font-size: clamp(34px, 9vw, 64px); font-weight: 900;
    text-shadow: 0 4px 0 rgba(20,60,90,0.9), 0 8px 30px rgba(0,0,0,0.6);
    letter-spacing: 0.06em; margin: 0; text-align: center; }
  #title p { color: #ffe9b8; font-size: clamp(15px, 4vw, 22px); font-weight: 700;
    margin: 0; text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
  #fade { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none;
    transition: opacity 0.7s; }
  #flash { position: absolute; inset: 0; background: radial-gradient(circle,
    rgba(220,245,255,0.95), rgba(160,210,240,0.85)); opacity: 0; pointer-events: none; }
  #msg { position: absolute; top: 34%; left: 50%; transform: translate(-50%,-50%) scale(0.6);
    color: #fff; font-size: clamp(34px, 10vw, 72px); font-weight: 900; opacity: 0;
    text-shadow: 0 4px 0 rgba(200,60,120,0.85), 0 10px 34px rgba(0,0,0,0.65);
    transition: opacity 0.5s, transform 0.5s cubic-bezier(.2,1.6,.4,1); white-space: nowrap; }
  #msg.show { opacity: 1; transform: translate(-50%,-50%) scale(1); }
`;

export class UI {
  constructor() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'ui';
    this.root.innerHTML = `
      <div id="fade"></div>
      <div id="flash"></div>
      <div class="banner hide" id="banner"></div>
      <div class="stars hide" id="stars"></div>
      <div id="msg"></div>
      <div id="title" class="hide">
        <h1>ふんすいを<br>なおそう！</h1>
        <p>ちかの ポンプしつで おしごと だよ</p>
      </div>
      <button class="bigbtn hide" id="bigbtn"></button>
    `;
    document.body.appendChild(this.root);
    this.banner = this.root.querySelector('#banner');
    this.starsEl = this.root.querySelector('#stars');
    this.btn = this.root.querySelector('#bigbtn');
    this.titleEl = this.root.querySelector('#title');
    this.fadeEl = this.root.querySelector('#fade');
    this.flashEl = this.root.querySelector('#flash');
    this.msgEl = this.root.querySelector('#msg');
    this._btnCb = null;
    this.btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const cb = this._btnCb;
      if (cb) cb();
    });
    this.starsEl.innerHTML = Array.from({ length: 5 }, () => '<span class="star">⭐</span>').join('');
  }
  setBanner(text) {
    if (!text) { this.banner.classList.add('hide'); return; }
    this.banner.classList.remove('hide');
    this.banner.textContent = text;
  }
  showStars(v) { this.starsEl.classList.toggle('hide', !v); }
  setStars(n) {
    this.starsEl.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('on', i < n));
  }
  showTitle(v) { this.titleEl.classList.toggle('hide', !v); }
  button(text, cb) {
    if (!text) { this.btn.classList.add('hide'); this._btnCb = null; return; }
    this.btn.classList.remove('hide');
    this.btn.textContent = text;
    this._btnCb = cb;
  }
  fade(opacity, secs = 0.7) {
    this.fadeEl.style.transition = `opacity ${secs}s`;
    this.fadeEl.style.opacity = String(opacity);
  }
  flash(peak = 1, secs = 1.2) {
    this.flashEl.style.transition = 'opacity 0.12s';
    this.flashEl.style.opacity = String(peak);
    setTimeout(() => {
      this.flashEl.style.transition = `opacity ${secs}s`;
      this.flashEl.style.opacity = '0';
    }, 140);
  }
  message(text, dur = 2.4) {
    this.msgEl.textContent = text;
    this.msgEl.classList.add('show');
    clearTimeout(this._msgT);
    if (dur > 0) this._msgT = setTimeout(() => this.msgEl.classList.remove('show'), dur * 1000);
  }
}
