/**
 * ころころ橋渡しクレーン — entry point.
 *
 * Wires the physics world, the renderer, the touch input and the sound
 * synthesiser together, and owns the frame loop.
 */

import { initPhysics, CranePhysics } from './physics.js';
import { CraneGame, PHASE } from './crane.js';
import { View } from './view.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { makeRound, BAR, FIELD } from './config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

class Game {
  constructor(physics) {
    this.p = physics;
    this.canvas = document.getElementById('stage');
    this.view = new View(this.canvas);
    this.game = new CraneGame(physics);
    this.input = new Input(this.canvas, this.view.camera);
    this.audio = new Audio();

    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.slowTimer = 0;
    this.prevTrolley = { x: 0, y: 0, z: 0 };
    this.nextRoundIn = 0;
    this.landed = false;
    this.hintShown = true;
    this.hintTimer = 0;
    this.dprScale = 1;
    this._frameAcc = 0;
    this._frameN = 0;

    this._bindUI();
    this._bindEvents();
    this._resize();
    this.newRound();
  }

  // -------------------------------------------------------------------- ui

  _bindUI() {
    this.grabBtn = document.getElementById('grab');
    this.newBtn = document.getElementById('newgame');
    this.soundBtn = document.getElementById('sound');
    this.hint = document.getElementById('hint');

    const press = (el, fn) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.audio.unlock();
        fn();
      }, { passive: false });
    };

    press(this.grabBtn, () => this._doGrab());
    press(this.newBtn, () => this.newRound());
    press(this.soundBtn, () => {
      const muted = this.soundBtn.classList.toggle('muted');
      this.audio.setEnabled(!muted);
    });

    this.input.onFirstTouch = () => {
      this.audio.unlock();
      this._hideHint();
    };

    // keyboard convenience for desktop testing
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this._doGrab(); }
      if (e.code === 'KeyN') this.newRound();
    });
  }

  _hideHint() {
    if (!this.hintShown) return;
    this.hintShown = false;
    this.hint.classList.remove('show');
  }

  _doGrab() {
    if (this.game.phase !== PHASE.IDLE) return;
    this._hideHint();
    if (this.game.grab()) this.audio.servo(false);
  }

  _bindEvents() {
    const onResize = () => this._resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
    window.visualViewport?.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); });

    this.p.onTouch = (kind, speed) => this._onTouch(kind, speed);

    this.game.onPhase = (phase) => {
      if (phase === PHASE.CLOSE) this.audio.servo(true);
      if (phase === PHASE.RELEASE) this.audio.servo(false);
      if (phase === PHASE.IDLE) this.audio.ready_();
    };
    this.game.onWin = () => this._onWin();
  }

  _resize() {
    const w = Math.max(1, Math.round(window.innerWidth));
    const h = Math.max(1, Math.round(window.innerHeight));
    // Cap the render resolution: quality on retina screens without melting the GPU.
    const raw = window.devicePixelRatio || 1;
    const budget = 2.35e6;
    let dpr = Math.min(raw, 2);
    if (w * h * dpr * dpr > budget) dpr = Math.max(1, Math.sqrt(budget / (w * h)));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.baseDpr = dpr;
    this.view.setViewport(w, h, dpr * this.dprScale);
  }

  // ---------------------------------------------------------------- rounds

  newRound() {
    const round = makeRound();
    this.round = round;
    this.view.setPrize(round);
    this.game.startRound(round);
    this.landed = false;
    this.nextRoundIn = 0;
    this.timeScaleTarget = 1;
    this.input.target.x = 0;
    this.input.target.z = -0.02;
    if (this.hintShown) {
      this.hintTimer = 0.8;
    }
  }

  _onWin() {
    const st = this.p.prizeState();
    this.view.celebrate(st.pos.x, st.pos.y, st.pos.z);
    this.audio.fanfare();
    this.timeScaleTarget = 0.45;
    this.slowTimer = 0.75;
    this.nextRoundIn = 3.4;
  }

  _onTouch(kind, speed) {
    if (kind === 'floor') {
      if (!this.landed) {
        this.landed = true;
        this.audio.drop();
        this.view.flash = Math.max(this.view.flash, 0.7);
      }
      return;
    }
    if (kind === 'bar') {
      if (speed > 0.28) this.audio.settle(clamp(speed * 1.5, 0.3, 1));
      else if (speed > 0.05) this.audio.tap(speed * 4);
      return;
    }
    this.audio.tap(clamp(0.35 + speed * 3, 0.2, 1));
  }

  // ------------------------------------------------------------------ loop

  start() {
    this.last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const real = (now - this.last) / 1000;
      this.last = now;
      if (!(real > 0)) return;
      this._adaptQuality(real);
      this.tick(Math.min(real, 0.05), Math.min(real, 0.25));
    };
    requestAnimationFrame(loop);
  }

  /**
   * Keeps the frame rate ahead of the resolution: if the device cannot hold a
   * comfortable frame time, render fewer pixels rather than drop frames.
   */
  _adaptQuality(real) {
    this._frameAcc += real;
    this._frameN++;
    if (this._frameAcc < 1.1) return;
    const avg = this._frameAcc / this._frameN;
    this._frameAcc = 0;
    this._frameN = 0;
    let next = this.dprScale;
    if (avg > 0.024) next = Math.max(0.62, this.dprScale - 0.14);
    else if (avg < 0.0135 && this.dprScale < 1) next = Math.min(1, this.dprScale + 0.08);
    if (Math.abs(next - this.dprScale) > 1e-3) {
      this.dprScale = next;
      this.view.renderer.setPixelRatio(this.baseDpr * this.dprScale);
      this.view.renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
  }

  tick(dt, realDt = dt) {
    const g = this.game;

    // ------------------------------------------------------------- aiming
    if (g.phase === PHASE.IDLE) {
      g.setAim(this.input.target.x, this.input.target.z);
    }

    // ------------------------------------------------- dramatic time scale
    const st = this.p.prizeState();
    if (g.phase !== PHASE.WON && st) {
      const rest = BAR.topY + this.p.prizeDims.h / 2;
      const slipping = st.pos.y < rest - 0.035 && st.pos.y > FIELD.fallenY;
      const vy = this.p.prize.linvel().y;
      this.timeScaleTarget = slipping && vy < -0.22 ? 0.6 : 1;
    }
    if (this.slowTimer > 0) {
      this.slowTimer -= realDt;
      if (this.slowTimer <= 0) this.timeScaleTarget = 1;
    }
    this.timeScale += (this.timeScaleTarget - this.timeScale) * Math.min(1, dt * 9);

    g.update(dt * this.timeScale);

    // ------------------------------------------------------------- audio
    const tr = this.p.trolley.translation();
    const move = Math.hypot(tr.x - this.prevTrolley.x, tr.y - this.prevTrolley.y, tr.z - this.prevTrolley.z) / Math.max(dt, 1e-3);
    this.prevTrolley = { x: tr.x, y: tr.y, z: tr.z };
    this.audio.motor(clamp(move * 2.2, 0, 1), 0.85 + clamp(move, 0, 1) * 0.5);

    const rubbing = st && Math.abs(st.pos.y - (BAR.topY + this.p.prizeDims.h / 2)) < 0.06;
    this.audio.scrape(rubbing ? clamp(st.speed * 3.2, 0, 1) : 0, clamp(st?.speed ?? 0, 0, 1));

    // ------------------------------------------------------------ visuals
    this.view.syncFromPhysics(this.p);
    const over = this._aimOverPrize();
    this.view.updateAim(this.p, g.phase === PHASE.IDLE, over);
    const dropping = st && st.pos.y < BAR.topY - 0.05;
    this.view.update(dt, {
      instability: g.instability,
      pushIn: g.phase === PHASE.DESCEND || g.phase === PHASE.CLOSE ? 1 : 0,
      focusY: dropping ? Math.max(0.20, st.pos.y + 0.10) : undefined,
    });
    this.view.render();

    // ----------------------------------------------------------- ui state
    const canGrab = g.phase === PHASE.IDLE;
    if (this.grabBtn.disabled === canGrab) this.grabBtn.disabled = !canGrab;

    if (this.hintTimer > 0) {
      this.hintTimer -= realDt;
      if (this.hintTimer <= 0 && this.hintShown) this.hint.classList.add('show');
    }

    if (this.nextRoundIn > 0) {
      this.nextRoundIn -= realDt;
      if (this.nextRoundIn <= 0) this.newRound();
    }
  }

  /** True when the claw is over the prize footprint — used to tint the reticle. */
  _aimOverPrize() {
    const ends = this.game.prizeEnds();
    if (!ends) return false;
    const head = this.p.head.translation();
    const dx = head.x - ends.c.x;
    const dz = head.z - ends.c.z;
    const ax = ends.right.x - ends.c.x;
    const az = ends.right.z - ends.c.z;
    const len = Math.hypot(ax, az) || 1;
    const along = (dx * ax + dz * az) / len;
    const across = (dx * -az + dz * ax) / len;
    return Math.abs(along) < this.p.prizeDims.w / 2 + 0.05 && Math.abs(across) < this.p.prizeDims.d / 2 + 0.05;
  }
}

async function boot() {
  const bootEl = document.getElementById('boot');
  try {
    await initPhysics();
    const physics = new CranePhysics();
    const game = new Game(physics);
    // expose for the end-to-end browser test
    window.__crane = game;
    game.start();
    requestAnimationFrame(() => {
      bootEl.classList.add('gone');
      setTimeout(() => bootEl.remove(), 600);
    });
  } catch (err) {
    console.error(err);
    bootEl.innerHTML =
      '<div style="color:#ffb4b4;font:16px/1.6 system-ui;padding:24px;text-align:center">' +
      'ゲームを読み込めませんでした<br><small style="opacity:.7">' + String(err && err.message) + '</small></div>';
  }
}

boot();
