/* =========================================================================
   game.js — play loop, gestures, and the per-step scenes
   No text, no score, no timers, no failure.  One finger only.
   ========================================================================= */
'use strict';

const DRINKS = {
  latte:  { esp: true, milk: true, base: 'crema', foamMax: 0.35, art: true,
            steps: ['grind', 'level', 'tamp', 'lock', 'cupset', 'extract', 'steam', 'pour', 'serve'] },
  cappu:  { esp: true, milk: true, base: 'crema', foamMax: 0.85, art: true,
            steps: ['grind', 'level', 'tamp', 'lock', 'cupset', 'extract', 'steam', 'pour', 'serve'] },
  milk:   { esp: false, milk: true, base: 'honey', foamMax: 0.6, art: true, cocoa: 0,
            steps: ['cupset', 'steam', 'pour', 'serve'] },
  cocoa:  { esp: false, milk: true, base: 'cocoa', foamMax: 0.5, art: true, cocoa: 1,
            steps: ['cupset', 'steam', 'pour', 'serve'] }
};

/* How tightly the camera frames each step.  In portrait these rects are sized
   so one station fills the screen; in landscape they are blended toward the
   full counter view by weight k.                                            */
const FOCUS = {
  menu:    { x: 560, y: 336, w: 860, h: 620, k: 0 },
  grind:   { x: 172, y: 424, w: 330, h: 330, k: 0.35 },
  level:   { x: 262, y: 418, w: 280, h: 280, k: 0.42 },
  tamp:    { x: 260, y: 388, w: 290, h: 310, k: 0.42 },
  lock:    { x: 478, y: 392, w: 370, h: 340, k: 0.45 },
  cupset:  { x: 428, y: 300, w: 290, h: 460, k: 0.32 },
  extract: { x: 388, y: 372, w: 340, h: 320, k: 0.40 },
  steam:   { x: 788, y: 378, w: 330, h: 330, k: 0.42 },
  pour:    { x: 496, y: 356, w: 270, h: 300, k: 0.85 },
  serve:   { x: 700, y: 402, w: 720, h: 340, k: 0.25 },
  again:   { x: 620, y: 336, w: 1120, h: 640, k: 0 },
  free:    { x: 496, y: 356, w: 270, h: 300, k: 0.85 }
};

/* The portafilter enters the groove with its handle low and to the right, then
   sweeps up to horizontal.  Both extremes stay clear of the machine body and
   the counter, so the whole twist is visible.                                */
const A_UNLOCK = 0.72;
const A_LOCK = 0;
const PF_GRAB = { x: 88, y: 58 };            // where the finger sits on the handle
const PF_REST = { x: 252, y: 432 };          // parked on the tamping mat
const PF_LOCK_REST = { x: WORLD.group.cx + 85, y: WORLD.trayY - 46 };  // stood on the drip tray

const Game = {
  W: 0, H: 0, portrait: true, uiScale: 1, U: 1,
  t: 0, ps: null, psTop: null,
  view: { x0: 0, y0: 0, x1: 0, y1: 0 },
  buttons: [],
  s: null,

  /* --------------------------------------------------------------- setup */
  init() {
    Fluid.init();
    this.ps = new Particles(600);
    this.psTop = new Particles(400);
    this.s = this.freshState();
    this.setStep('menu', true);
  },

  freshState() {
    return {
      step: 'menu', stepT: 0, drink: 'latte', stepIndex: 0,
      idle: 0, flash: 0, freeMode: false,
      pf: { x: PF_REST.x, y: PF_REST.y, angle: A_UNLOCK, dose: 0, leveled: 0, tamped: false,
            wet: false, held: false, phase: 'free', locked: false, seed: rnd(0, 9),
            grabAng: 0, ip: 0, tickN: 0, lockAnim: 0 },
      tamper: { y: 300, held: false, press: 0, done: false },
      grinder: { run: 0, spawn: 0 },
      cup: { x: WORLD.cup.x, y: WORLD.cup.y, held: false, placed: false,
             espresso: 0, milk: 0, cocoa: 0, foam: 0, crema: 0, surface: null, art: false },
      lever: { a: 0, held: false, latched: false },
      brew: { t: 0, on: false, done: false, pressure: 0 },
      pitcher: { x: WORLD.pitcherRest.x, y: WORLD.pitcherRest.y, rot: 0,
                 milk: 0.55, foam: 0, swirl: 0, swirlSpd: 0, held: false,
                 steaming: 0, prog: 0, done: false, chirrT: 0, tilt: 0 },
      pour: { flow: 0, poured: 0, wiggles: 0, lastDir: 0, upRun: 0, done: false,
              doneT: 0, pattern: 'heart', px: 0.5, py: 0.5, everPoured: false },
      tray: [], serveDone: false, sparkleT: 0
    };
  },

  setStep(step, instant) {
    const s = this.s;
    s.step = step; s.stepT = 0; s.idle = 0;
    // clear every per-step scratch field, or a replay inherits the last run's
    // "already finished" flags and skips the step
    s._work = 0; s._done = false; s._settle = 0; s._tick = 0;
    s._after = 0; s._resist = 0; s._puff = 0; s._placeT = -1;
    s.pf._full = false;
    const h = this.scenes[step];
    if (h && h.enter) h.enter(s);
    if (instant) { this.focusCamera(); Cam.snap(); }
  },

  /** advance along the current drink's recipe */
  nextStep() {
    const s = this.s;
    if (s.freeMode) return;
    const list = DRINKS[s.drink].steps;
    const i = list.indexOf(s.step);
    if (i >= 0 && i < list.length - 1) this.setStep(list[i + 1]);
    else this.setStep('again');
  },

  startDrink(kind) {
    const s = this.s;
    s.drink = kind;
    const d = DRINKS[kind];
    s.freeMode = false;
    s.pf = { x: PF_REST.x, y: PF_REST.y, angle: A_UNLOCK, dose: 0, leveled: 0, tamped: false,
             wet: false, held: false, phase: 'free', locked: false, seed: rnd(0, 9),
             grabAng: 0, ip: 0, tickN: 0, lockAnim: 0 };
    s.tamper = { y: 300, held: false, press: 0, done: false };
    s.cup = { x: WORLD.cup.x, y: WORLD.cup.y, held: false, placed: false,
              espresso: 0, milk: 0, cocoa: d.cocoa || 0, foam: 0, crema: 0,
              surface: null, art: false };
    s.lever = { a: 0, held: false, latched: false };
    s.brew = { t: 0, on: false, done: false, pressure: 0 };
    s.pitcher = { x: WORLD.pitcherRest.x, y: WORLD.pitcherRest.y, rot: 0,
                  milk: 0.5, foam: 0, swirl: 0, swirlSpd: 0, held: false,
                  steaming: 0, prog: 0, done: false, chirrT: 0, tilt: 0 };
    s.pour = { flow: 0, poured: 0, wiggles: 0, lastDir: 0, upRun: 0, done: false,
               doneT: 0, pattern: 'heart', px: 0.5, py: 0.5, everPoured: false };
    s.serveDone = false;
    Fluid.reset();
    this.ps.clear(); this.psTop.clear();
    this.setStep(d.steps[0]);
  },

  startFree() {
    const s = this.s;
    s.freeMode = true;
    s.drink = 'latte';
    s.cup = { x: WORLD.cup.x, y: WORLD.cup.y, held: false, placed: true,
              espresso: 1, milk: 0, cocoa: 0, foam: 0, crema: 1, surface: null, art: true };
    s.pitcher.milk = 1; s.pitcher.foam = 0.7; s.pitcher.done = true;
    s.pour = { flow: 0, poured: 0, wiggles: 0, lastDir: 0, upRun: 0, done: false,
               doneT: 0, pattern: 'heart', px: 0.5, py: 0.5, everPoured: false };
    Fluid.reset();
    this.ps.clear(); this.psTop.clear();
    this.setStep('free');
  },

  /* -------------------------------------------------------------- camera */
  focusCamera() {
    const f = FOCUS[this.s.step] || FOCUS.menu;
    const fitS = Math.min(this.W / WORLD.w, this.H / WORLD.h);
    const focS = Math.min(this.W / f.w, this.H / f.h);
    let scale, cx, cy;
    if (this.portrait) {
      scale = Math.max(fitS, focS);
      cx = f.x; cy = f.y;
    } else {
      const k = f.k;
      scale = lerp(fitS, Math.max(fitS, focS), k);
      cx = lerp(WORLD.w / 2, f.x, k * 0.92);
      cy = lerp(WORLD.h / 2, f.y, k * 0.92);
    }
    // keep the visible rect roughly over the counter
    const vw = this.W / scale, vh = this.H / scale;
    if (vw < WORLD.w) cx = clamp(cx, vw / 2 - 70, WORLD.w - vw / 2 + 70);
    else cx = WORLD.w / 2;
    if (vh < WORLD.h) cy = clamp(cy, vh / 2 - 40, WORLD.h - vh / 2 + 60);
    else cy = WORLD.h / 2 + 20;
    Cam.tx = cx; Cam.ty = cy; Cam.tscale = scale;
  },

  updateView() {
    const vw = this.W / Cam.scale, vh = this.H / Cam.scale;
    this.view.x0 = Cam.x - vw / 2; this.view.x1 = Cam.x + vw / 2;
    this.view.y0 = Cam.y - vh / 2; this.view.y1 = Cam.y + vh / 2;
    this.U = 1 / Cam.scale;                       // 1 screen px in world units
    this.uiScale = clamp(Math.min(this.W, this.H) / 400, 0.9, 2.2);
  },

  /* --------------------------------------------------------------- helpers */
  /** drag with magnetic snap; returns true while grabbed */
  grabbed(obj, r) {
    return Ptr.down && dist(Ptr.x, Ptr.y, obj.x, obj.y) < r;
  },
  snapTo(obj, tx, ty, radius, strength, dt) {
    const d = dist(obj.x, obj.y, tx, ty);
    if (d < radius) {
      const k = (1 - d / radius) * strength;
      obj.x = approach(obj.x, tx, 1 - k, dt);
      obj.y = approach(obj.y, ty, 1 - k, dt);
      return true;
    }
    return false;
  },
  puff(x, y, n, col, spread, up) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU);
      this.ps.add({ x, y, vx: Math.cos(a) * rnd(10, spread), vy: Math.sin(a) * rnd(10, spread) - (up || 0),
                    g: 60, life: rnd(0.4, 0.9), r: rnd(1.4, 3.6), r1: 0.4, col, drag: 0.9, a0: 0.8 });
    }
  },
  celebrate(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), sp = rnd(40, 190);
      this.psTop.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 150,
        life: rnd(0.7, 1.3), r: rnd(5, 11), r1: 1,
        kind: i % 3 === 0 ? 'heart' : 'star', rot: rnd(0, TAU), vrot: rnd(-6, 6),
        col: pick(['#ffd66b', '#ff9fbe', '#fff6e0', '#b9e2f2', '#c9a7f0']), drag: 0.94
      });
    }
  },

  /* ---------------------------------------------------------------- loop */
  update(dt) {
    this.t += dt;
    const s = this.s;
    s.stepT += dt;
    s.flash = Math.max(0, s.flash - dt * 2.4);
    if (Ptr.down && (Math.abs(Ptr.dx) + Math.abs(Ptr.dy)) > 0.4) s.idle = 0; else s.idle += dt;
    if (Ptr.justDown) s.idle = 0;

    this.focusCamera();
    Cam.update(dt);
    this.updateView();

    // Buttons are laid out during update, before anything hit-tests them —
    // laying out in draw would make them un-tappable.
    this.buttons.length = 0;
    this.layoutHud();
    const h = this.scenes[s.step];
    if (h && h.update) h.update(s, dt);

    this.ps.update(dt);
    this.psTop.update(dt);
  },

  draw(ctx) {
    const s = this.s;
    ctx.save();
    Cam.apply(ctx, this.W, this.H);

    Art.drawBackground(ctx, this.t);
    Art.drawCounter(ctx, this.t);
    Art.drawGrinder(ctx, this.t, s.grinder.run);

    const showLockedPF = s.pf.locked;
    Art.drawMachine(ctx, this.t, {
      leverAngle: s.lever.a, lampBrew: s.brew.on ? 1 : (s.brew.done ? 0.4 : 0),
      steamOn: s.pitcher.steaming > 0.05, pressure: s.brew.pressure,
      cupsTaken: s.cup.placed || s.cup.held ? 1 : 0
    });

    // tamping mat
    if (['level', 'tamp'].includes(s.step)) {
      ctx.fillStyle = '#5c3b46';
      Art.rr(ctx, WORLD.tampMat.x - 62, WORLD.tampMat.y - 12, 124, 14, 5); ctx.fill();
      ctx.fillStyle = '#78505c';
      Art.rr(ctx, WORLD.tampMat.x - 62, WORLD.tampMat.y - 16, 124, 8, 4); ctx.fill();
    }

    Art.drawTray(ctx, s.tray, this.t);

    this.ps.draw(ctx);

    // once locked, the portafilter belongs to the machine: it sits behind the
    // cup and the pitcher, which are nearer the player
    if (showLockedPF && s.step !== 'lock') {
      Art.drawPortafilter(ctx, WORLD.group.cx, WORLD.group.cy, A_LOCK,
        { dose: s.pf.dose, tamped: true, leveled: 1, wet: s.pf.wet, seed: s.pf.seed });
    }

    const h = this.scenes[s.step];
    if (h && h.draw) h.draw(s, ctx);

    this.psTop.draw(ctx);
    if (h && h.overlay) h.overlay(s, ctx);
    this.drawHud(ctx);
    ctx.restore();

    // screen-space finish: a soft vignette keeps the eye on the hands
    ctx.save();
    ctx.setTransform(Cam.dpr, 0, 0, Cam.dpr, 0, 0);
    if (!this._vig || this._vigW !== this.W || this._vigH !== this.H) {
      const R = Math.hypot(this.W, this.H) * 0.62;
      const g = ctx.createRadialGradient(this.W / 2, this.H * 0.46, R * 0.34,
                                         this.W / 2, this.H * 0.46, R);
      g.addColorStop(0, 'rgba(40,20,14,0)');
      g.addColorStop(0.72, 'rgba(40,20,14,0.10)');
      g.addColorStop(1, 'rgba(40,20,14,0.38)');
      this._vig = g; this._vigW = this.W; this._vigH = this.H;
    }
    ctx.fillStyle = this._vig;
    ctx.fillRect(0, 0, this.W, this.H);
    if (s.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.28})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.restore();
  },

  /* ------------------------------------------------------------------ HUD */
  layoutHud() {
    const s = this.s;
    if (s.step === 'menu') return;
    const U = this.U, r = 26 * this.uiScale * U;
    this.buttons.push({
      x: this.view.x0 + r + 14 * U, y: this.view.y0 + r + 14 * U, r,
      c1: '#fff6f8', c2: '#ffc7d8',
      icon: (c, rr) => {
        c.fillStyle = '#c2607f';
        c.beginPath();
        c.moveTo(0, -rr * 0.55); c.lineTo(rr * 0.6, -rr * 0.02); c.lineTo(rr * 0.38, -rr * 0.02);
        c.lineTo(rr * 0.38, rr * 0.5); c.lineTo(-rr * 0.38, rr * 0.5); c.lineTo(-rr * 0.38, -rr * 0.02);
        c.lineTo(-rr * 0.6, -rr * 0.02); c.closePath(); c.fill();
        c.fillStyle = '#fff6f8';
        c.fillRect(-rr * 0.14, rr * 0.12, rr * 0.28, rr * 0.38);
      },
      id: 'home'
    });
  },
  drawHud(ctx) {
    for (const b of this.buttons) if (b.id === 'home') Art.button(ctx, b, this.t);
  },

  hitButtons() {
    if (!Ptr.justDown) return null;
    for (const b of this.buttons) {
      if (dist(Ptr.x, Ptr.y, b.x, b.y) < b.r * 1.25) return b;
    }
    return null;
  },
  /** returns true only when the tap was consumed by a global control */
  handleCommonButtons() {
    const b = this.hitButtons();
    if (b && b.id === 'home') {
      Sfx.blip(880, 0.1, 'sine', 0.25);
      Sfx.stopAll();
      this.s.grinder.run = 0;
      this.s.pf.held = false; this.s.cup.held = false; this.s.pitcher.held = false;
      this.setStep('menu');
      return true;
    }
    return false;
  },

  /* ============================================================= SCENES == */
  scenes: {}
};

/* --------------------------------------------------------------- MENU --- */
Game.scenes.menu = {
  enter(s) { s.tray = s.tray.slice(-4); },
  update(s, dt) {
    Game.layoutMenu(s);
    const b = Game.hitButtons();
    if (b) {
      Sfx.blip(720, 0.12, 'triangle', 0.3);
      Sfx.sparkle(3, 880);
      Game.celebrate(b.x, b.y, 12);
      if (b.id === 'free') Game.startFree(); else Game.startDrink(b.id);
    }
  },
  draw(s, ctx) { Game.drawMenu(s, ctx); }
};

Game.layoutMenu = function (s) {
  const U = this.U, vw = this.view.x1 - this.view.x0, vh = this.view.y1 - this.view.y0;
  const cx = (this.view.x0 + this.view.x1) / 2, cy = (this.view.y0 + this.view.y1) / 2;
  const R = Math.min(vw * (this.portrait ? 0.20 : 0.105), vh * 0.17);
  const items = [
    { id: 'latte', c1: '#fff4e8', c2: '#e6b98a' },
    { id: 'cappu', c1: '#fffaf0', c2: '#f0d3ae' },
    { id: 'milk', c1: '#ffffff', c2: '#ffe6c9' },
    { id: 'cocoa', c1: '#ffeee4', c2: '#c88c6a' }
  ];
  const rows = this.portrait ? 2 : 1;
  const per = 4 / rows;
  items.forEach((it, i) => {
    const row = Math.floor(i / per), col = i % per;
    const x = cx + (col - (per - 1) / 2) * R * 2.45;
    const y = cy + (row - (rows - 1) / 2) * R * 2.5 - (this.portrait ? vh * 0.06 : vh * 0.02);
    this.buttons.push({ x, y, r: R, c1: it.c1, c2: it.c2, id: it.id, pulse: true, phase: i,
      icon: (c, rr) => Game.drinkIcon(c, rr, it.id) });
  });
  // free latte-art button, a bit lower
  const fy = cy + (this.portrait ? R * 2.9 : vh * 0.30);
  this.buttons.push({ x: cx, y: fy, r: R * 0.86, c1: '#fff0f6', c2: '#ffa8c8', id: 'free',
    pulse: true, phase: 2, icon: (c, rr) => Game.freeIcon(c, rr) });
};

/* Each drink gets a distinct surface so a child can tell them apart without
   reading anything: latte wears a heart, cappuccino a domed foam with cocoa
   dust, hot milk a plain white cap, cocoa a marshmallow.                   */
Game.drinkIcon = function (ctx, r, id) {
  const o = {};
  if (id === 'latte') {
    o.espresso = 1; o.milk = 1;
    o.mark = (c, rx, ry) => {
      c.fillStyle = '#fffaf0';
      c.save(); c.scale(1, ry / rx); Art.heartPath(c, 0, 0, rx * 1.5); c.fill(); c.restore();
    };
  } else if (id === 'cappu') {
    o.espresso = 1; o.milk = 1; o.foam = 1;
    o.mark = (c, rx, ry) => {
      c.fillStyle = '#fffdf6'; Art.ell(c, 0, -ry * 0.12, rx * 0.98, ry * 0.95); c.fill();
      c.fillStyle = '#b98356';
      for (let i = 0; i < 9; i++) {
        const a = i * 2.399, d = Math.sqrt((i + 1) / 10) * 0.72;
        Art.ell(c, Math.cos(a) * rx * d, Math.sin(a) * ry * d, rx * 0.07, ry * 0.17); c.fill();
      }
    };
  } else if (id === 'milk') {
    o.milk = 1; o.foam = 1;
    o.mark = (c, rx, ry) => {
      c.fillStyle = '#ffffff'; Art.ell(c, 0, -ry * 0.1, rx, ry); c.fill();
      c.fillStyle = '#ffd66b'; Art.starPath(c, 0, 0, rx * 0.34, rx * 0.15, 5); c.fill();
    };
  } else {
    o.cocoa = 1; o.milk = 0.55;
    o.mark = (c, rx, ry) => {
      c.fillStyle = '#fffaf4';
      Art.rr(c, -rx * 0.30, -ry * 0.55, rx * 0.60, ry * 1.1, rx * 0.14); c.fill();
      c.fillStyle = '#f6e6d8';
      Art.rr(c, -rx * 0.22, -ry * 0.35, rx * 0.44, ry * 0.4, rx * 0.10); c.fill();
    };
  }
  Art.miniCup(ctx, 0, r * 0.12, r * 0.62, o);
  Art.steamWisps(ctx, 0, -r * 0.40, Game.t, 0.8, r * 0.40, r * 0.46);
};
Game.freeIcon = function (ctx, r) {
  ctx.save();
  ctx.fillStyle = '#a9743f';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d3a068';
  ctx.beginPath(); ctx.arc(-r * 0.06, -r * 0.07, r * 0.50, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fffaf0';
  Art.heartPath(ctx, 0, r * 0.02, r * 0.80); ctx.fill();
  ctx.fillStyle = '#ffd66b';
  Art.starPath(ctx, r * 0.54, -r * 0.50, r * 0.18, r * 0.08, 5); ctx.fill();
  ctx.restore();
};

Game.drawMenu = function (s, ctx) {
  // soft scrim so the buttons read against the café without hiding it
  const v = this.view;
  ctx.fillStyle = 'rgba(255,240,235,0.42)';
  ctx.fillRect(v.x0 - 10, v.y0 - 10, v.x1 - v.x0 + 20, v.y1 - v.y0 + 20);
  for (const b of this.buttons) Art.button(ctx, b, this.t);
  // hint hand, tucked just outside the first cup so it hides nothing
  const bob = Math.sin(this.t * 2.6) * 6 * this.U * this.uiScale;
  const target = this.buttons[0];
  if (target) Art.hand(ctx, target.x + target.r * 0.86, target.y + target.r * 1.02 + bob,
                       0.3, 0.8, this.U * this.uiScale * 1.5);
};

/* -------------------------------------------------------------- GRIND --- */
Game.scenes.grind = {
  enter(s) { s.pf.x = PF_REST.x; s.pf.y = PF_REST.y; s.pf.angle = 0; s.grinder.run = 0; },
  update(s, dt) {
    if (Game.handleCommonButtons()) return;
    const pf = s.pf, T = { x: WORLD.grinder.cx, y: WORLD.grinder.pfY };

    if (Ptr.justDown && dist(Ptr.x, Ptr.y, pf.x + 60, pf.y) < 190) pf.held = true;
    if (!Ptr.down) pf.held = false;

    if (pf.held) {
      pf.x = approach(pf.x, Ptr.x - 60, 0.0002, dt);
      pf.y = approach(pf.y, Ptr.y, 0.0002, dt);
      Game.snapTo(pf, T.x, T.y, 96, 0.55, dt);
    } else if (pf.dose < 1) {
      pf.x = approach(pf.x, PF_REST.x, 0.05, dt);
      pf.y = approach(pf.y, PF_REST.y, 0.05, dt);
    }

    const inPlace = dist(pf.x, pf.y, T.x, T.y) < 26 && pf.dose < 1;
    const running = inPlace && (pf.held || pf.dose > 0.02);
    s.grinder.run = approach(s.grinder.run, running ? 1 : 0, 0.001, dt);

    if (running) {
      if (!Sfx.loops.grind) Sfx.grindStart();
      pf.dose = Math.min(1, pf.dose + dt * 0.46);
      // grounds falling out of the chute
      s.grinder.spawn += dt;
      while (s.grinder.spawn > 0.014) {
        s.grinder.spawn -= 0.014;
        Game.ps.add({
          x: T.x + rnd(-9, 9), y: WORLD.grinder.chuteY + 4, vx: rnd(-12, 12), vy: rnd(60, 120),
          g: 900, life: (pf.y - WORLD.grinder.chuteY) / 260 + 0.16, r: rnd(1.1, 2.4), r1: 1,
          col: pick(['#4a2c1a', '#5f3a22', '#33200f']), a0: 1
        });
      }
      Cam.kick(0.5);
    } else if (Sfx.loops.grind) {
      Sfx.grindStop();
    }

    if (pf.dose >= 1 && s.stepT > 0.4) {
      Sfx.grindStop();
      if (!pf._full) {
        pf._full = true;
        Sfx.sparkle(3, 700);
        Game.celebrate(pf.x, pf.y - 20, 10);
        s.flash = 0.4;
      }
      // slide over to the tamping mat
      pf.x = approach(pf.x, WORLD.tampMat.x, 0.004, dt);
      pf.y = approach(pf.y, WORLD.tampMat.pfY, 0.004, dt);
      if (dist(pf.x, pf.y, WORLD.tampMat.x, WORLD.tampMat.pfY) < 6) { pf._full = false; Game.nextStep(); }
    }
  },
  draw(s, ctx) {
    const pf = s.pf;
    Art.drawPortafilter(ctx, pf.x, pf.y, pf.angle,
      { dose: pf.dose, leveled: 0, seed: pf.seed });
  },
  overlay(s, ctx) {
    if (s.pf.dose >= 1) return;
    const T = { x: WORLD.grinder.cx, y: WORLD.grinder.pfY };
    const a = smoothstep(0.6, 1.6, s.idle) * 0.85;
    if (dist(s.pf.x, s.pf.y, T.x, T.y) > 40) {
      Art.guideArc(ctx, s.pf.x, s.pf.y - 30, (s.pf.x + T.x) / 2, s.pf.y - 120, T.x, T.y - 34, a);
      const k = (Game.t % 1.4) / 1.4;
      Art.hand(ctx, lerp(s.pf.x + 60, T.x + 60, easeOutCubic(k)),
               lerp(s.pf.y + 26, T.y + 26, easeOutCubic(k)), 0, a, Game.U * Game.uiScale * 1.6);
    }
  }
};

/* -------------------------------------------------------------- LEVEL --- */
Game.scenes.level = {
  enter(s) { s.pf.x = WORLD.tampMat.x; s.pf.y = WORLD.tampMat.pfY; s.pf.angle = 0; s.pf.leveled = 0; },
  update(s, dt) {
    if (Game.handleCommonButtons()) return;
    const pf = s.pf;
    const over = Ptr.down && Math.abs(Ptr.x - pf.x) < 78 && Math.abs(Ptr.y - (pf.y - 6)) < 62;
    if (over && Math.abs(Ptr.dx) > 0.2) {
      const w = Math.abs(Ptr.dx) * (Math.abs(Ptr.dx) > Math.abs(Ptr.dy) ? 1 : 0.35);
      s._work += w;
      pf.leveled = sat(s._work / 250);
      if (Math.random() < w * 0.05) {
        Game.ps.add({ x: Ptr.x + rnd(-16, 16), y: pf.y - 8, vx: Ptr.dx * 16, vy: rnd(-40, -8),
                      g: 420, life: 0.5, r: rnd(0.9, 1.9), r1: 0.3, col: '#4a2c1a', a0: 0.9 });
      }
      s._tick = (s._tick || 0) + w;
      if (s._tick > 26) { s._tick = 0; Sfx.tick(0.45, 0.05); }
    }
    if (pf.leveled >= 1 && !s._done) {
      s._done = true;
      Sfx.blip(560, 0.12, 'sine', 0.22);
      Game.celebrate(pf.x, pf.y - 24, 8);
    }
    if (s._done) {
      s._settle += dt;
      if (s._settle > 0.45) Game.nextStep();
    }
  },
  draw(s, ctx) {
    const pf = s.pf;
    Art.drawPortafilter(ctx, pf.x, pf.y, 0, { dose: pf.dose, leveled: pf.leveled, seed: pf.seed });
  },
  overlay(s, ctx) {
    const a = smoothstep(0.4, 1.2, s.idle) * 0.85;
    if (a < 0.02 || s.pf.leveled >= 1) return;
    const pf = s.pf, k = (Game.t % 1.6) / 1.6;
    const x = pf.x + Math.sin(k * TAU) * 52;
    Art.guideArc(ctx, pf.x - 54, pf.y - 34, pf.x, pf.y - 52, pf.x + 54, pf.y - 34, a);
    Art.hand(ctx, x, pf.y + 8, 0, a, Game.U * Game.uiScale * 1.5);
  }
};

/* --------------------------------------------------------------- TAMP --- */
Game.scenes.tamp = {
  enter(s) {
    s.pf.x = WORLD.tampMat.x; s.pf.y = WORLD.tampMat.pfY; s.pf.angle = 0;
    s.tamper = { y: s.pf.y - 150, held: false, press: 0, done: false, lift: 0 };
  },
  update(s, dt) {
    if (Game.handleCommonButtons()) return;
    const pf = s.pf, tm = s.tamper;
    const contactY = pf.y - 34;                 // where the tamper meets the bed
    const restY = pf.y - 150;

    if (tm.done) {
      tm.lift += dt;
      tm.y = approach(tm.y, restY - 60, 0.004, dt);
      if (tm.lift > 0.7) Game.nextStep();
      return;
    }

    if (Ptr.justDown && dist(Ptr.x, Ptr.y - 44, WORLD.tampMat.x, tm.y - 40) < 150) tm.held = true;
    if (!Ptr.down) tm.held = false;

    if (tm.held) {
      const want = Ptr.y - 44;
      if (want <= contactY) {
        tm.y = approach(tm.y, want, 0.0002, dt);
        tm.press = 0;
      } else {
        // past contact the tamper barely moves — that is the resistance
        const over = want - contactY;
        tm.press = Math.min(30, over);
        tm.y = contactY + tm.press * 0.30;
        if (tm.press > 3 && !tm._touch) {
          tm._touch = true;
          Sfx.tick(0.5, 0.08);
          Game.puff(pf.x, contactY + 6, 5, '#5a3a24', 40, 10);
        }
        if (tm.press >= 22) {
          tm.done = true;
          pf.tamped = true; pf.leveled = 1;
          Sfx.tamp(1);
          Cam.kick(6);
          s.flash = 0.45;
          Game.puff(pf.x, contactY + 8, 16, '#6b4a30', 130, 20);
          Game.celebrate(pf.x, contactY - 6, 10);
        }
      }
    } else {
      tm.press = approach(tm.press, 0, 0.001, dt);
      tm.y = approach(tm.y, restY, 0.001, dt);
      tm._touch = false;
    }
  },
  draw(s, ctx) {
    const pf = s.pf, tm = s.tamper;
    Art.drawPortafilter(ctx, pf.x, pf.y, 0,
      { dose: pf.dose, leveled: pf.leveled, tamped: pf.tamped, seed: pf.seed });
    // squash the tamper slightly at full press for weight
    ctx.save();
    ctx.translate(WORLD.tampMat.x, tm.y);
    const sq = 1 - sat(tm.press / 30) * 0.05;
    ctx.scale(1 + (1 - sq) * 1.4, sq);
    Art.drawTamper(ctx, 0, 0, 0);
    ctx.restore();
  },
  overlay(s, ctx) {
    if (s.tamper.done) return;
    const a = smoothstep(0.4, 1.2, s.idle) * 0.85;
    if (a < 0.02) return;
    const pf = s.pf, tm = s.tamper;
    const k = (Game.t % 1.3) / 1.3;
    Art.guideArc(ctx, pf.x + 66, tm.y - 40, pf.x + 66, tm.y + 10, pf.x + 66, pf.y - 46, a);
    Art.hand(ctx, pf.x + 66, lerp(tm.y - 46, pf.y - 52, easeInCubic(k)), 0, a,
             Game.U * Game.uiScale * 1.5);
  }
};

/* --------------------------------------------------------------- LOCK --- *
 * The signature gesture:
 *   drag up from below -> the ears find the groove -> twist across ->
 *   the last few degrees fight back -> カチッ
 * ---------------------------------------------------------------------- */
Game.scenes.lock = {
  enter(s) {
    const pf = s.pf;
    pf.phase = 'free'; pf.locked = false; pf.angle = 0;
    pf.x = PF_LOCK_REST.x; pf.y = PF_LOCK_REST.y;
    pf.ip = 0; pf.tickN = 0; pf.lockAnim = 0; pf.held = false;
    s._resist = 0;
  },
  update(s, dt) {
    if (Game.handleCommonButtons()) return;
    const pf = s.pf, G = WORLD.group;

    /* ---- 1. locked: play the click animation, then move on */
    if (pf.phase === 'locked') {
      pf.lockAnim += dt;
      const k = sat(pf.lockAnim / 0.16);
      pf.angle = lerp(pf._lockFrom, A_LOCK, easeOutBack(k, 2.6));
      if (pf.lockAnim > 0.6) { pf.locked = true; Game.nextStep(); }
      return;
    }

    /* ---- 2. seated: rotate it home */
    if (pf.phase === 'rot') {
      if (Ptr.justDown) {
        const d = dist(Ptr.x, Ptr.y, G.cx, G.cy);
        if (d > 24 && d < 260) {
          pf.held = true;
          pf.grabAng = Math.atan2(Ptr.y - G.cy, Ptr.x - G.cx) - pf.angle;
        }
      }
      if (!Ptr.down) pf.held = false;

      if (pf.held) {
        const want = Math.atan2(Ptr.y - G.cy, Ptr.x - G.cx) - pf.grabAng;
        // input progress: 0 at the groove, 1 at "looks locked", >1 = pushing through
        let ip = clamp((want - A_UNLOCK) / (A_LOCK - A_UNLOCK), 0, 1.4);
        pf.ip = approach(pf.ip, ip, 0.0004, dt);
        // resistance: past 70 % the handle only gives 40 % of what the finger asks
        let dp = pf.ip <= 0.70 ? pf.ip : 0.70 + (pf.ip - 0.70) * 0.40;
        dp = Math.min(dp, 0.96);
        pf.angle = A_UNLOCK + dp * (A_LOCK - A_UNLOCK);
        s._resist = smoothstep(0.72, 1.05, pf.ip);
        if (s._resist > 0.15) Cam.kick(s._resist * 1.3);

        const n = Math.floor(dp * 11);
        if (n !== pf.tickN) {
          pf.tickN = n;
          if (n > 0) Sfx.tick(0.85 + dp * 0.7, 0.10 + s._resist * 0.10);
        }
        if (pf.ip >= 1.12) {
          pf.phase = 'locked'; pf._lockFrom = pf.angle; pf.lockAnim = 0; pf.held = false;
          Sfx.clack();
          Cam.kick(9);
          s.flash = 0.6;
          // a burst of sparks around the collar
          for (let i = 0; i < 22; i++) {
            const a = rnd(0, TAU), sp = rnd(60, 210);
            Game.psTop.add({ x: G.cx, y: G.cy - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5,
                             g: 260, life: rnd(0.4, 0.8), r: rnd(3, 7), r1: 0.5, kind: 'star',
                             rot: rnd(0, TAU), vrot: rnd(-8, 8), drag: 0.9,
                             col: pick(['#fff3c4', '#ffd66b', '#ffffff']) });
          }
          Game.psTop.add({ x: G.cx, y: G.cy - 2, vx: 0, vy: 0, g: 0, life: 0.5,
                           r: 30, r1: 110, kind: 'ring', col: '#fff6d0', a0: 0.85 });
          Game.celebrate(G.cx, G.cy - 30, 14);
          Sfx.sparkle(4, 780);
        }
      } else {
        // released mid-twist: relax a hair, keep the progress
        pf.ip = approach(pf.ip, Math.max(0, pf.ip - 0.06), 0.02, dt);
        let dp = pf.ip <= 0.70 ? pf.ip : 0.70 + (pf.ip - 0.70) * 0.40;
        pf.angle = A_UNLOCK + Math.min(dp, 0.96) * (A_LOCK - A_UNLOCK);
        s._resist = 0;
      }
      return;
    }

    /* ---- 3. free: carry it up into the group head */
    const entryY = G.cy;
    if (Ptr.justDown && dist(Ptr.x, Ptr.y, pf.x + PF_GRAB.x, pf.y + PF_GRAB.y) < 220) pf.held = true;
    if (!Ptr.down) pf.held = false;

    // it stands level on the tray and tips to the entry angle once picked up
    pf.angle = approach(pf.angle, pf.held ? A_UNLOCK : 0, 0.002, dt);

    if (pf.held) {
      pf.x = approach(pf.x, Ptr.x - PF_GRAB.x, 0.0002, dt);
      pf.y = approach(pf.y, Ptr.y - PF_GRAB.y, 0.0002, dt);
      // magnetic guidance toward the groove, only from below
      if (pf.y > G.cy - 10 && Math.abs(pf.x - G.cx) < 110) {
        Game.snapTo(pf, G.cx, entryY + 10, 110, 0.5, dt);
      }
      // it only bites when it arrives from underneath
      if (Math.abs(pf.x - G.cx) < 34 && pf.y > entryY - 8 && pf.y < entryY + 36) {
        // it finds the slot
        pf.phase = 'rot';
        pf.x = G.cx; pf.y = G.cy;
        pf.angle = A_UNLOCK; pf.ip = 0; pf.tickN = 0;
        pf.grabAng = Math.atan2(Ptr.y - G.cy, Ptr.x - G.cx) - A_UNLOCK;
        pf.held = true;
        Sfx.seat();
        Cam.kick(3.5);
        Game.puff(G.cx, G.cy + 4, 6, '#cfd6db', 60, 0);
      }
    } else {
      pf.x = approach(pf.x, PF_LOCK_REST.x, 0.05, dt);
      pf.y = approach(pf.y, PF_LOCK_REST.y, 0.05, dt);
    }
  },
  draw(s, ctx) {
    const pf = s.pf, G = WORLD.group;
    // groove highlight — brightens as the portafilter nears / bites
    let near;
    if (pf.phase === 'free') near = smoothstep(160, 40, dist(pf.x, pf.y, G.cx, G.cy));
    else if (pf.phase === 'rot') near = 0.5 + s._resist * 0.5;
    else near = 1 - sat(pf.lockAnim / 0.35);      // the guides retire once it is home
    Art.drawGroupSlots(ctx, near);

    // ghost of where it goes
    if (pf.phase === 'free') {
      ctx.save();
      ctx.globalAlpha = 0.20 + Math.sin(Game.t * 3) * 0.05;
      Art.drawPortafilter(ctx, G.cx, G.cy, A_UNLOCK, { dose: pf.dose, tamped: true, leveled: 1 });
      ctx.restore();
    }

    ctx.save();
    if (pf.phase === 'rot' && s._resist > 0.05) {
      // it shudders as it bites
      ctx.translate(rnd(-1, 1) * s._resist * 2.2, rnd(-1, 1) * s._resist * 2.2);
    }
    // a light drop shadow sells that the handle is in front of the machine
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.translate(pf.x + 6, pf.y + 11); ctx.rotate(pf.angle);
    ctx.fillStyle = '#2a1610';
    Art.rr(ctx, -64, -12, 228, 38, 19); ctx.fill();
    ctx.restore();

    Art.drawPortafilter(ctx, pf.x, pf.y, pf.angle,
      { dose: pf.dose, tamped: true, leveled: 1, seed: pf.seed });
    ctx.restore();
  },
  overlay(s, ctx) {
    const pf = s.pf, G = WORLD.group;
    if (pf.phase === 'locked') return;
    const a = smoothstep(0.35, 1.1, s.idle) * 0.9;

    if (pf.phase === 'free') {
      if (a > 0.02) {
        Art.guideArc(ctx, pf.x + 10, pf.y + 40, G.cx - 6, G.cy + 78, G.cx, G.cy + 26, a, '#ffe98a');
        const k = (Game.t % 1.5) / 1.5;
        Art.hand(ctx, lerp(pf.x + 52, G.cx + 52, easeOutCubic(k)),
                 lerp(pf.y + PF_GRAB.y + 30, G.cy + PF_GRAB.y + 30, easeOutCubic(k)), 0, a,
                 Game.U * Game.uiScale * 1.4);
      }
    } else {
      // A tapered swipe trail along the twist path — this is the key move, so
      // the cue stays up until the handle actually starts moving.
      const R = 126;
      const cur = A_UNLOCK + sat(pf.ip) * (A_LOCK - A_UNLOCK);
      const to = A_LOCK - 0.05;
      const av = Math.max(a, 0.55) * (1 - sat(pf.ip * 1.15));
      if (av > 0.02 && Math.abs(cur - to) > 0.06) {
        ctx.save();
        ctx.globalAlpha = av;
        const steps = 12;
        for (let i = 0; i < steps; i++) {
          const t0 = i / steps, t1 = (i + 1) / steps;
          const a0 = lerp(cur, to, t0), a1 = lerp(cur, to, t1);
          const fade = 0.25 + t0 * 0.75;
          ctx.strokeStyle = `rgba(255,233,138,${fade})`;
          ctx.lineWidth = 3 + t0 * 9;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(G.cx, G.cy, R, a0, a1, A_LOCK < A_UNLOCK);
          ctx.stroke();
        }
        // arrow head at the lock position
        ctx.translate(G.cx + Math.cos(to) * R, G.cy + Math.sin(to) * R);
        ctx.rotate(to);
        ctx.fillStyle = '#ffe98a';
        ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(-14, 11); ctx.lineTo(14, 11);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        const k = (Game.t % 1.6) / 1.6;
        const ha = lerp(cur, to, easeOutCubic(k));
        Art.hand(ctx, G.cx + Math.cos(ha) * (R + 12), G.cy + Math.sin(ha) * (R + 12),
                 ha, av, Game.U * Game.uiScale * 1.3);
      }
      // "one more push" cue right at the end: chevrons stacking up at the handle
      if (s._resist > 0.1) {
        ctx.save();
        ctx.globalAlpha = s._resist;
        const hx = G.cx + Math.cos(pf.angle) * 150, hy = G.cy + Math.sin(pf.angle) * 150;
        ctx.translate(hx, hy); ctx.rotate(pf.angle);
        ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const o = 8 + i * 15 + Math.sin(Game.t * 16 - i) * 3;
          ctx.globalAlpha = s._resist * (1 - i * 0.26);
          // the twist runs anticlockwise, which is "up" in the handle's frame
          ctx.beginPath();
          ctx.moveTo(-13, 13 - o); ctx.lineTo(0, -o); ctx.lineTo(13, 13 - o);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
};

/* ------------------------------------------------------------- CUPSET --- */
Game.scenes.cupset = {
  enter(s) {
    s.cup.x = WORLD.cupStack.x; s.cup.y = WORLD.cupStack.y + 30;
    s.cup.held = false; s.cup.placed = false;
    s.cup.espresso = 0; s.cup.milk = 0;
  },
  update(s, dt) {
    if (Game.handleCommonButtons()) return;
    const c = s.cup, T = WORLD.cup;
    if (s._placeT >= 0) {
      s._placeT += dt;
      if (s._placeT > 0.45) Game.nextStep();
      return;
    }
    if (Ptr.justDown && dist(Ptr.x, Ptr.y - 30, c.x, c.y - 30) < 130) c.held = true;
    if (!Ptr.down && c.held) {
      c.held = false;
      if (dist(c.x, c.y, T.x, T.y) < 90) this.place(s);
    }
    if (c.held) {
      c.x = approach(c.x, Ptr.x, 0.0001, dt);
      c.y = approach(c.y, Ptr.y + 30, 0.0001, dt);
      if (Game.snapTo(c, T.x, T.y, 100, 0.6, dt) && dist(c.x, c.y, T.x, T.y) < 10) this.place(s);
    }
  },
  place(s) {
    const c = s.cup;
    c.held = false; c.placed = true; c.x = WORLD.cup.x; c.y = WORLD.cup.y;
    if (DRINKS[s.drink].cocoa) c.cocoa = 1;
    s._placeT = 0;
    Sfx.cupPlace();
    Cam.kick(4);
    Game.puff(c.x, c.y, 6, '#ffffff', 50, 0);
    Game.celebrate(c.x, c.y - 60, 8);
  },
  draw(s, ctx) {
    const c = s.cup;
    Art.drawCup(ctx, c.x, c.y, { cocoa: c.cocoa, milk: 0, espresso: 0, style: 'cute' });
  },
  overlay(s, ctx) {
    const c = s.cup, T = WORLD.cup;
    if (c.placed) return;
    const a = smoothstep(0.4, 1.2, s.idle) * 0.85;
    if (a < 0.02) return;
    Art.guideArc(ctx, c.x + 10, c.y + 6, c.x + 40, (c.y + T.y) / 2, T.x, T.y - 40, a);
    const k = (Game.t % 1.6) / 1.6;
    Art.hand(ctx, lerp(c.x, T.x, easeOutCubic(k)) + 14, lerp(c.y - 20, T.y - 40, easeOutCubic(k)),
             0, a, Game.U * Game.uiScale * 1.5);
    // target ring on the drip tray
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(Game.t * 4) * 0.15;
    ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 5; ctx.setLineDash([10, 12]);
    ctx.beginPath(); ctx.ellipse(T.x, T.y - 2, 52, 18, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
};

/* ------------------------------------------------------------ EXTRACT --- */
Game.scenes.extract = {
  enter(s) { s.brew = { t: 0, on: false, done: false, pressure: 0 }; s.lever.a = 0; s.lever.latched = false; },
  update(s, dt) {
    if (Game.handleCommonButtons()) return;
    const L = WORLD.lever, lv = s.lever, br = s.brew, c = s.cup;
    const knob = () => ({ x: L.px - 76 * Math.cos(lv.a), y: L.py - 76 * Math.sin(lv.a) });

    if (!lv.latched) {
      const k = knob();
      if (Ptr.justDown && dist(Ptr.x, Ptr.y, k.x, k.y) < 92) lv.held = true;
      if (!Ptr.down) lv.held = false;
      if (lv.held) {
        const want = Math.atan2(Ptr.y - L.py, Ptr.x - L.px);
        // the arm points left, so its bearing is PI + lv.a
        lv.a = clamp(angDiff(Math.PI, want), -0.85, 0.05);
        if (lv.a <= -0.55) {
          lv.latched = true; lv.held = false; br.on = true;
          Sfx.blip(320, 0.09, 'square', 0.2);
          Sfx.pumpStart();
          Cam.kick(3);
        }
      } else {
        lv.a = approach(lv.a, 0, 0.004, dt);
      }
    } else {
      lv.a = approach(lv.a, -0.85, 0.002, dt);
    }

    if (br.on) {
      br.t += dt;
      br.pressure = smoothstep(0, 0.9, br.t) * (1 - smoothstep(4.6, 5.4, br.t));
      Cam.kick(0.35);
      if (br.t > 1.0) {
        // first drips, then a steady thin stream
        const flow = smoothstep(1.0, 1.7, br.t) * (1 - smoothstep(4.6, 5.2, br.t));
        c.espresso = Math.min(1, c.espresso + dt * flow * 0.30);
        c.crema = Math.min(1, c.crema + dt * flow * 0.42);
        s.pf.wet = true;
        if (!Sfx.loops.drip && flow > 0.15) Sfx.dripStart();
        Sfx.dripSet(c.espresso);
        // the stream itself is drawn; add splash droplets in the cup
        if (flow > 0.2 && Math.random() < flow * 0.6) {
          const sy = c.y + Art.cupSurface(c).surfY;
          Game.ps.add({ x: WORLD.cup.x + rnd(-11, 11), y: sy + rnd(-3, 3),
                        vx: rnd(-24, 24), vy: rnd(-46, -14), g: 420, life: 0.35,
                        r: rnd(1, 2.2), r1: 0.3, col: '#c9a06a', a0: 0.9 });
        }
      }
      if (c.espresso >= 1 || br.t > 5.4) {
        br.on = false; br.done = true; br.pressure = 0;
        lv.latched = false;
        Sfx.pumpStop(); Sfx.dripStop();
        Sfx.sparkle(4, 620);
        Game.celebrate(WORLD.cup.x, 392, 12);
        s.flash = 0.35;
        s._after = 0;
      }
    }
    if (br.done) {
      lv.a = approach(lv.a, 0, 0.004, dt);
      s._after = (s._after || 0) + dt;
      if (s._after > 1.1) Game.nextStep();
    }
  },
  draw(s, ctx) {
    const c = s.cup, br = s.brew;
    Art.drawCup(ctx, c.x, c.y, {
      espresso: c.espresso, milk: c.milk, cocoa: c.cocoa, crema: c.crema, style: 'cute'
    });
    // The espresso falling from the spouts, drawn over the cup so the whole
    // thread from spout to crema stays visible.
    if (br.on && br.t > 1.0) {
      const flow = smoothstep(1.0, 1.7, br.t) * (1 - smoothstep(4.6, 5.2, br.t));
      const topY = WORLD.group.cy + 44;
      const g = Art.cupSurface(c);
      // stop inside the cup's opening, never over its near wall
      const endY = Math.min(c.y + g.surfY, c.y - WORLD.cup.h + WORLD.cup.ry * 0.45);
      ctx.save();
      for (const sx of [-9, 9]) {
        const x0 = WORLD.cup.x + sx;
        ctx.beginPath();
        ctx.moveTo(x0, topY);
        for (let y = topY; y <= endY; y += 3) {
          const p = (y - topY) / (endY - topY + 0.001);
          const w = Math.sin(Game.t * 13 + y * 0.35 + sx) * 0.9 * (1 - p * 0.4);
          ctx.lineTo(x0 + w - sx * 0.34 * p, y);
        }
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(56,28,12,${0.9 * flow})`;
        ctx.lineWidth = 3.4 + Math.sin(Game.t * 9 + sx) * 0.4;
        ctx.stroke();
        ctx.strokeStyle = `rgba(206,152,88,${0.7 * flow})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
    }
    if (c.espresso > 0.15) {
      Art.steamWisps(ctx, c.x + 26, c.y - WORLD.cup.h - 4, Game.t, sat(c.espresso) * 0.55, 20, 44);
    }
  },
  overlay(s, ctx) {
    if (s.brew.on || s.brew.done) return;
    const a = smoothstep(0.35, 1.1, s.idle) * 0.9;
    if (a < 0.02) return;
    const L = WORLD.lever;
    const k = (Game.t % 1.4) / 1.4;
    const ang = lerp(0, -0.8, easeOutCubic(k));
    const kx = L.px - 76 * Math.cos(ang), ky = L.py - 76 * Math.sin(ang);
    Art.guideArc(ctx, L.px - 82, L.py - 6, L.px - 106, L.py + 30, L.px - 60, L.py + 56, a);
    Art.hand(ctx, kx - 6, ky + 40, 0, a, Game.U * Game.uiScale * 1.5);
  }
};

/* -------------------------------------------------------------- STEAM --- */
Game.scenes.steam = {
  enter(s) {
    const p = s.pitcher;
    p.x = WORLD.pitcherRest.x; p.y = WORLD.pitcherRest.y;
    p.milk = 0.5; p.foam = 0; p.swirl = 0; p.swirlSpd = 0;
    p.prog = 0; p.steaming = 0; p.done = false; p.rot = 0; p.tilt = 0;
    s._puff = 0;
  },
  update(s, dt) {
    if (Game.handleCommonButtons()) return;
    const p = s.pitcher, Wd = WORLD.wand;
    // where the milk surface currently is, relative to the pitcher base
    const surfOff = -118 + 2 + (1 - p.milk) * 54;
    // ideal: tip just under the surface, a little off-centre -> a real whirlpool
    const idealX = Wd.tx + 26;
    const idealY = Wd.ty - surfOff + 8;

    if (p.done) {
      p.steaming = approach(p.steaming, 0, 0.0005, dt);
      Sfx.steamStop();
      p.x = approach(p.x, WORLD.pitcherRest.x, 0.004, dt);
      p.y = approach(p.y, WORLD.pitcherRest.y, 0.004, dt);
      p.rot = approach(p.rot, 0, 0.004, dt);
      p.swirlSpd = approach(p.swirlSpd, 0.15, 0.02, dt);
      p.swirl += p.swirlSpd * dt * 5;
      s._after = (s._after || 0) + dt;
      if (s._after > 1.1) Game.nextStep();
      return;
    }

    if (Ptr.justDown && dist(Ptr.x, Ptr.y - 60, p.x, p.y - 60) < 190) p.held = true;
    if (!Ptr.down) p.held = false;

    if (p.held) {
      p.x = approach(p.x, Ptr.x, 0.0002, dt);
      p.y = approach(p.y, Ptr.y + 60, 0.0002, dt);
      // strong auto-correction: a 4-year-old can never get this "wrong"
      const d = dist(p.x, p.y, idealX, idealY);
      if (d < 180) {
        const k = (1 - d / 180) * 0.72;
        p.x = approach(p.x, idealX, 1 - k, dt);
        p.y = approach(p.y, idealY, 1 - k, dt);
      }
      // small sideways drag tilts the pitcher, which tightens the whirlpool
      p.tilt = clamp(p.tilt + Ptr.dx * 0.004, -1, 1);
    } else {
      p.tilt = approach(p.tilt, 0, 0.02, dt);
      if (p.prog < 0.02) {
        p.x = approach(p.x, WORLD.pitcherRest.x, 0.02, dt);
        p.y = approach(p.y, WORLD.pitcherRest.y, 0.02, dt);
      }
    }
    p.rot = approach(p.rot, p.tilt * 0.16, 0.002, dt);

    // is the wand in the milk?
    const surfY = p.y + surfOff;
    const depth = sat((Wd.ty - surfY) / 26);        // 0 = above, 1 = well under
    const inside = Math.abs(Wd.tx - p.x) < 62 && Wd.ty > surfY - 40 && Wd.ty < surfY + 60;
    const engaged = inside ? 1 : 0;
    p.steaming = approach(p.steaming, engaged, 0.0008, dt);

    if (p.steaming > 0.08) {
      if (!Sfx.loops.steam) Sfx.steamStart();
      Sfx.steamSet(p.steaming, depth);
      Cam.kick(0.5 * p.steaming);
      // stretching (air in) happens near the surface; texturing happens deeper
      const stretch = (1 - Math.abs(depth - 0.28) * 1.8) * p.steaming;
      p.foam = Math.min(DRINKS[s.drink].foamMax, p.foam + Math.max(0, stretch) * dt * 0.42);
      p.milk = Math.min(0.92, p.milk + Math.max(0, stretch) * dt * 0.13);
      p.swirlSpd = approach(p.swirlSpd, 0.45 + Math.abs(p.tilt) * 0.55 + depth * 0.3, 0.02, dt);
      p.prog = Math.min(1, p.prog + dt * 0.20 * (0.6 + p.steaming * 0.4));
      // チリチリ
      p.chirrT -= dt;
      if (p.chirrT <= 0) { p.chirrT = rnd(0.03, 0.13); Sfx.chirr(); }
      // steam escaping around the tip
      s._puff += dt;
      while (s._puff > 0.03) {
        s._puff -= 0.03;
        Game.psTop.add({
          x: Wd.tx + rnd(-10, 10), y: surfY + rnd(-6, 4), vx: rnd(-70, 70), vy: rnd(-110, -40),
          g: -30, life: rnd(0.5, 1.0), r: rnd(6, 14), r1: 30, kind: 'puff',
          col: 'rgba(255,255,255,0.55)', drag: 0.93, a0: 0.55
        });
      }
      if (Math.random() < 0.35) {
        Game.psTop.add({ x: Wd.tx + rnd(-16, 16), y: surfY + rnd(-4, 6),
                         vx: rnd(-60, 60), vy: rnd(-90, -20), g: 300, life: 0.4,
                         r: rnd(1, 2.4), r1: 0.4, col: '#fffaf0', a0: 0.9 });
      }
    } else {
      Sfx.steamStop();
      p.swirlSpd = approach(p.swirlSpd, 0.08, 0.06, dt);
    }
    p.swirl += p.swirlSpd * dt * 6;

    if (p.prog >= 1) {
      p.done = true; p.steaming = 0;
      Sfx.steamStop();
      Sfx.cupPlace();
      Sfx.sparkle(4, 700);
      Game.celebrate(p.x, p.y - 130, 14);
      s.flash = 0.4; s._after = 0;
    }
  },
  draw(s, ctx) {
    const c = s.cup, p = s.pitcher;
    Art.drawCup(ctx, c.x, c.y, { espresso: c.espresso, milk: c.milk, cocoa: c.cocoa,
                                 crema: c.crema, style: 'cute' });
    Art.drawPitcher(ctx, p.x, p.y, p.rot,
      { milk: p.milk, foam: p.foam, swirl: p.swirl, swirlSpeed: p.swirlSpd });
    // a plume of steam rising out of the pitcher
    if (p.steaming > 0.1) {
      Art.steamWisps(ctx, p.x, p.y - 128, Game.t, p.steaming * 0.9, 40, 110);
    }
  },
  overlay(s, ctx) {
    const p = s.pitcher, Wd = WORLD.wand;
    if (p.done) return;
    // progress shown as the foam ring filling — no numbers
    if (p.prog > 0.01) {
      ctx.save();
      const rx = p.x, ry = p.y - 132, rr = 80;
      ctx.strokeStyle = 'rgba(96,62,48,0.30)'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(rx, ry, rr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + p.prog * TAU);
      ctx.stroke();
      ctx.strokeStyle = '#ffc94d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + p.prog * TAU);
      ctx.stroke();
      // a little bead riding the head of the arc
      const ha = -Math.PI / 2 + p.prog * TAU;
      ctx.fillStyle = '#fffdf2';
      ctx.beginPath(); ctx.arc(rx + Math.cos(ha) * rr, ry + Math.sin(ha) * rr, 7, 0, TAU); ctx.fill();
      ctx.restore();
    }
    const a = smoothstep(0.5, 1.4, s.idle) * 0.85;
    if (a < 0.02 || p.steaming > 0.3) return;
    const surfOff = -118 + 2 + (1 - p.milk) * 54;
    const tx = Wd.tx + 26, ty = Wd.ty - surfOff + 8;
    Art.guideArc(ctx, p.x, p.y - 60, (p.x + tx) / 2, p.y - 150, tx + 4, ty - 70, a);
    const k = (Game.t % 1.6) / 1.6;
    Art.hand(ctx, lerp(p.x, tx, easeOutCubic(k)) + 30, lerp(p.y - 60, ty - 60, easeOutCubic(k)),
             0, a, Game.U * Game.uiScale * 1.5);
  }
};

/* --------------------------------------------------- POUR / LATTE ART --- */
const PITCH_SCALE = 0.82;          // the pitcher reads smaller while pouring
const PourScene = {
  enter(s) {
    const p = s.pitcher;
    p.rot = -0.20;
    const g = Art.cupSurface(s.cup);
    const off = Art.pitcherSpout(0, 0, p.rot, PITCH_SCALE);
    p.x = s.cup.x - 24 - off.x; p.y = s.cup.y + g.surfY - 96 - off.y;
    if (s.freeMode) { p.milk = 1; p.foam = 0.6; }
    s.pour.done = false; s.pour.doneT = 0; s.pour.flow = 0;
    s.pour.wiggles = 0; s.pour.lastDir = 0; s.pour.upRun = 0; s.pour.everPoured = false;
    s.cup.art = true;
  },
  baseKind(s) {
    if (s.freeMode) return 'crema';
    const d = DRINKS[s.drink];
    return d.base;
  },
  /** map a world point onto normalised cup-surface coords (0..1) */
  toSurface(s, x, y) {
    const c = s.cup;
    const g = Art.cupSurface(c);
    const surfY = c.y + g.surfY;
    return { u: (x - c.x) / (g.sRX * 2) + 0.5, v: (y - surfY) / (g.sRY * 2) + 0.5,
             surfY, sRX: g.sRX, sRY: g.sRY };
  },
  update(s, dt) {
    if (Game.handleCommonButtons()) return;
    const c = s.cup, p = s.pitcher, P = s.pour;

    if (P.done) {
      P.doneT += dt;
      P.flow = Math.max(0, P.flow - dt * 4);      // the stream cuts off cleanly
      Fluid.step(dt);
      p.rot = approach(p.rot, -0.12, 0.004, dt);
      p.x = approach(p.x, WORLD.cup.x + 140, 0.004, dt);
      p.y = approach(p.y, WORLD.cup.y - 150, 0.004, dt);
      Sfx.pourStop();
      if (P.doneT > 1.5 && !s.freeMode) {
        c.surface = Fluid.snapshot(PourScene.baseKind(s));
        Game.nextStep();
      }
      if (s.freeMode) Game.layoutFreeButtons(s);
      return;
    }

    const geo = PourScene.toSurface(s, 0, 0);
    // the finger IS the pouring point — the pitcher follows above it
    let tx = Ptr.x, ty = Ptr.y;
    if (Ptr.down) {
      // hold the pour point inside the cup
      const du = (tx - c.x) / geo.sRX, dv = (ty - geo.surfY) / geo.sRY;
      const rr = Math.hypot(du, dv);
      if (rr > 1.15) { tx = c.x + du / rr * 1.15 * geo.sRX; ty = geo.surfY + dv / rr * 1.15 * geo.sRY; }
      P.flow = Math.min(1, P.flow + dt * 2.4);
    } else {
      P.flow = Math.max(0, P.flow - dt * 3.4);
      tx = c.x - 40; ty = geo.surfY - 10;
    }

    // The pitcher is positioned from its SPOUT: the spout hovers just above and
    // slightly left of the pour point, and the body swings around it as the
    // wrist tips further over.  That keeps the stream short and readable.
    p.rot = approach(p.rot, -0.20 - P.flow * 0.46, 0.0008, dt);
    const off = Art.pitcherSpout(0, 0, p.rot, PITCH_SCALE);
    const px = tx - 24 - off.x, py = ty - 74 - P.flow * 10 - off.y;
    p.x = approach(p.x, px, 0.0004, dt);
    p.y = approach(p.y, py, 0.0004, dt);

    if (P.flow > 0.05) {
      const su = (tx - c.x) / (geo.sRX * 2) + 0.5;
      const sv = (ty - geo.surfY) / (geo.sRY * 2) + 0.5;
      P.px = su; P.py = sv;
      const vx = Ptr.dx / (geo.sRX * 2) / Math.max(dt, 1e-3);
      const vy = Ptr.dy / (geo.sRY * 2) / Math.max(dt, 1e-3);
      Fluid.pour(clamp(su, 0.06, 0.94), clamp(sv, 0.06, 0.94), P.flow,
                 clamp(vx, -3, 3), clamp(vy, -3, 3), dt);
      P.poured += dt * P.flow;
      P.everPoured = true;
      // The pitcher never actually runs dry — a child who loves pouring must
      // never be locked out of finishing their picture.
      p.milk = Math.max(0.18, p.milk - dt * P.flow * 0.055);
      c.milk = Math.min(1, c.milk + dt * P.flow * 0.30);
      c.foam = Math.max(c.foam, p.foam * sat(c.milk * 1.6));   // cappuccino keeps its cap
      if (!Sfx.loops.pour) Sfx.pourStart();
      Sfx.pourSet(P.flow * (0.4 + Math.min(1, Math.abs(Ptr.vx) / 260) * 0.6));
    } else {
      Sfx.pourStop();
    }

    if (Ptr.down && P.everPoured) {
      // wiggle counting: each left/right reversal is one "swing"
      const dir = Ptr.dx > 1.2 ? 1 : Ptr.dx < -1.2 ? -1 : 0;
      if (dir !== 0) {
        if (P.lastDir !== 0 && dir !== P.lastDir) {
          P.wiggles++;
          Game.psTop.add({ x: tx, y: ty, vx: 0, vy: -20, g: 0, life: 0.45, r: 5, r1: 26,
                           kind: 'ring', col: '#fff6e0', a0: 0.5 });
        }
        P.lastDir = dir;
      }
      // pulling straight through toward the far side finishes the art
      if (Math.abs(Ptr.dx) < Math.abs(Ptr.dy) * 0.9 && Ptr.dy < -0.15) {
        P.upRun += -Ptr.dy / (geo.sRY * 2);
      } else if (Ptr.dy > 0.4) {
        P.upRun *= 0.55;
      }
      if (P.upRun > 0.42 && P.poured > 0.30) PourScene.finishArt(s, tx, ty);
      // a very long pour resolves itself so the picture never stays unfinished
      if (P.poured > 14) PourScene.finishArt(s, tx, ty);
      P.idleAfter = 0;
    } else if (!Ptr.down && P.everPoured) {
      P.idleAfter = (P.idleAfter || 0) + dt;
      // never leave a child stuck: after a while the art finishes itself
      if (P.idleAfter > 3.2 && P.poured > 0.25) PourScene.finishArt(s, c.x, geo.surfY);
    }

    Fluid.step(dt);
    if (s.freeMode) Game.layoutFreeButtons(s);
  },

  finishArt(s, tx, ty) {
    const P = s.pour;
    if (P.done) return;
    P.done = true; P.doneT = 0;
    P.pattern = P.wiggles >= 5 ? 'leaf' : (P.wiggles >= 2 ? 'tulip' : 'heart');
    const geo = PourScene.toSurface(s, 0, 0);
    // carve the pull-through line, then let the field converge
    Fluid.strokeThrough(clamp(P.px, 0.1, 0.9), 0.86, clamp(P.px, 0.1, 0.9), 0.16, 1);
    Fluid.finish(P.pattern, 0);
    Sfx.pourStop();
    Sfx.sparkle(6, 700);
    Sfx.drop(1300);
    s.flash = 0.5;
    Game.celebrate(s.cup.x, geo.surfY - 20, 22);
    for (let i = 0; i < 10; i++) {
      Game.psTop.add({ x: s.cup.x, y: geo.surfY, vx: 0, vy: 0, g: 0, life: 0.7 + i * 0.05,
                       r: 6 + i * 3, r1: 80 + i * 8, kind: 'ring', col: '#fff6e0', a0: 0.3 });
    }
  },

  draw(s, ctx) {
    const c = s.cup, p = s.pitcher, P = s.pour;
    const surf = Fluid.render(PourScene.baseKind(s));
    const geo = PourScene.toSurface(s, 0, 0);

    // wisps go behind the cup so they never scribble over the art
    Art.steamWisps(ctx, c.x, geo.surfY - 6, Game.t, 0.3, 30, 64);
    Art.drawCup(ctx, c.x, c.y, {
      espresso: c.espresso, milk: Math.max(c.milk, 0.02), cocoa: c.cocoa, foam: c.foam,
      crema: c.crema, surface: P.everPoured || s.freeMode ? surf : null, style: 'cute'
    });

    // the milk stream from the spout down to the surface
    if (P.flow > 0.04 && p.milk > 0.02) {
      const sp = PourScene.spoutPos(p);
      const tx = c.x + (P.px - 0.5) * geo.sRX * 2;
      const ty = geo.surfY + (P.py - 0.5) * geo.sRY * 2;
      ctx.save();
      const w = 3 + P.flow * 5.5;
      ctx.strokeStyle = 'rgba(255,253,246,0.96)';
      ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      const midX = lerp(sp.x, tx, 0.55) + Math.sin(Game.t * 12) * 1.6;
      const midY = lerp(sp.y, ty, 0.62);
      ctx.quadraticCurveTo(midX, midY, tx, ty);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = w * 0.4;
      ctx.stroke();
      // splash ring where it lands
      ctx.globalAlpha = 0.5 * P.flow;
      ctx.fillStyle = '#fffdf6';
      Art.ell(ctx, tx, ty, 7 + P.flow * 6, 3 + P.flow * 2.4); ctx.fill();
      ctx.restore();
    }

    Art.drawPitcher(ctx, p.x, p.y, p.rot,
      { milk: p.milk, foam: p.foam, swirl: p.swirl, swirlSpeed: 0.25,
        scale: PITCH_SCALE, levelWorld: true });
  },

  spoutPos(p) { return Art.pitcherSpout(p.x, p.y, p.rot, PITCH_SCALE); },

  overlay(s, ctx) {
    const P = s.pour, c = s.cup;
    if (s.freeMode) for (const b of Game.buttons) if (b.id !== 'home') Art.button(ctx, b, Game.t);
    if (P.done) return;
    const geo = PourScene.toSurface(s, 0, 0);
    const a = smoothstep(0.5, 1.3, s.idle) * 0.9;

    if (!P.everPoured) {
      if (a > 0.02) {
        // "put your finger on the milk and draw"
        ctx.save();
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 4; ctx.setLineDash([8, 10]);
        ctx.beginPath(); ctx.ellipse(c.x, geo.surfY, geo.sRX * 0.8, geo.sRY * 0.8, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
        const k = (Game.t % 1.8) / 1.8;
        Art.hand(ctx, c.x + Math.sin(k * TAU * 2) * geo.sRX * 0.5,
                 geo.surfY + Math.cos(k * TAU) * geo.sRY * 0.3 + 14,
                 0, a, Game.U * Game.uiScale * 1.4);
      }
    } else if (P.poured > 0.30) {
      // the finishing pull-through cue
      const pulse = 0.45 + Math.sin(Game.t * 4) * 0.25;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#fff2b0'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.setLineDash([3, 18]);
      ctx.beginPath();
      ctx.moveTo(c.x, geo.surfY + geo.sRY * 0.95);
      ctx.lineTo(c.x, geo.surfY - geo.sRY * 0.95);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.translate(c.x, geo.surfY - geo.sRY * 1.0);
      ctx.fillStyle = '#fff2b0';
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(-10, 8); ctx.lineTo(10, 8); ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (!Ptr.down) {
        const k = (Game.t % 1.5) / 1.5;
        Art.hand(ctx, c.x + 16, lerp(geo.surfY + geo.sRY * 0.95, geo.surfY - geo.sRY * 0.9,
                 easeOutCubic(k)), 0, 0.75, Game.U * Game.uiScale * 1.4);
      }
    }
  }
};
Game.scenes.pour = PourScene;

/* ------------------------------------------------------------ FREE ART -- */
Game.scenes.free = Object.assign({}, PourScene, {
  enter(s) {
    PourScene.enter(s);
    s.cup.espresso = 1; s.cup.crema = 1; s.cup.milk = 0;
    s.pitcher.milk = 1; s.pitcher.foam = 0.65;
  },
  update(s, dt) { PourScene.update(s, dt); }
});

Game.layoutFreeButtons = function (s) {
  const U = this.U, r = 30 * this.uiScale * U;
  const x = this.view.x1 - r - 16 * U;
  const b = {
    x, y: this.view.y0 + r + 16 * U, r, c1: '#f2fbff', c2: '#a9dcf5', id: 'refill', pulse: s.pour.done,
    icon: (c, rr) => {
      c.strokeStyle = '#2f7ea3'; c.lineWidth = rr * 0.22; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 0, rr * 0.5, 0.6, 5.2); c.stroke();
      c.fillStyle = '#2f7ea3';
      c.save(); c.translate(rr * 0.42, -rr * 0.30); c.rotate(0.9);
      c.beginPath(); c.moveTo(0, -rr * 0.30); c.lineTo(-rr * 0.26, rr * 0.18);
      c.lineTo(rr * 0.26, rr * 0.18); c.closePath(); c.fill();
      c.restore();
    }
  };
  this.buttons.push(b);
  if (Ptr.justDown && dist(Ptr.x, Ptr.y, b.x, b.y) < b.r * 1.25) {
    Sfx.blip(820, 0.1, 'sine', 0.25);
    Sfx.cupPlace();
    Fluid.reset();
    s.pour = { flow: 0, poured: 0, wiggles: 0, lastDir: 0, upRun: 0, done: false,
               doneT: 0, pattern: 'heart', px: 0.5, py: 0.5, everPoured: false };
    s.pitcher.milk = 1;
    s.cup.milk = 0;
    Game.celebrate(s.cup.x, s.cup.y - 80, 10);
  }
};

/* -------------------------------------------------------------- SERVE --- */
Game.scenes.serve = {
  enter(s) {
    s.cup.held = false; s.serveDone = false;
    s.cup.x = WORLD.cup.x; s.cup.y = WORLD.cup.y;
  },
  update(s, dt) {
    if (Game.handleCommonButtons()) return;
    const c = s.cup, T = { x: WORLD.serve.x + (s.tray.length - 1.5) * 30, y: WORLD.serve.y - 22 };
    if (s.serveDone) {
      s.sparkleT += dt;
      if (s.sparkleT > 1.2) Game.setStep('again');
      return;
    }
    if (Ptr.justDown && dist(Ptr.x, Ptr.y - 30, c.x, c.y - 30) < 130) c.held = true;
    if (!Ptr.down && c.held) {
      c.held = false;
      if (dist(c.x, c.y, T.x, T.y) < 110) this.drop(s, T);
    }
    if (c.held) {
      c.x = approach(c.x, Ptr.x, 0.0001, dt);
      c.y = approach(c.y, Ptr.y + 30, 0.0001, dt);
      if (Game.snapTo(c, T.x, T.y, 120, 0.55, dt) && dist(c.x, c.y, T.x, T.y) < 12) this.drop(s, T);
    } else if (!s.serveDone) {
      c.x = approach(c.x, WORLD.cup.x, 0.02, dt);
      c.y = approach(c.y, WORLD.cup.y, 0.02, dt);
    }
  },
  drop(s, T) {
    const c = s.cup;
    c.held = false; s.serveDone = true; s.sparkleT = 0;
    s.tray.push({ espresso: c.espresso, milk: c.milk, cocoa: c.cocoa,
                  foam: c.foam, surface: c.surface });
    if (s.tray.length > 5) s.tray.shift();
    Sfx.cupPlace();
    Sfx.sparkle(6, 660);
    Cam.kick(4);
    s.flash = 0.4;
    Game.celebrate(T.x, T.y - 40, 26);
  },
  draw(s, ctx) {
    const c = s.cup;
    if (!s.serveDone) {
      const surf = c.surface || (c.art ? Fluid.render(PourScene.baseKind(s)) : null);
      Art.drawCup(ctx, c.x, c.y, { espresso: c.espresso, milk: c.milk, cocoa: c.cocoa,
                                   crema: c.crema, surface: surf, foam: c.foam, style: 'cute' });
      Art.steamWisps(ctx, c.x, c.y - 74, Game.t, 0.5, 26, 56);
    }
  },
  overlay(s, ctx) {
    if (s.serveDone) return;
    const c = s.cup, T = { x: WORLD.serve.x + (s.tray.length - 1.5) * 30, y: WORLD.serve.y - 22 };
    const a = smoothstep(0.4, 1.2, s.idle) * 0.85;
    if (a < 0.02) return;
    Art.guideArc(ctx, c.x + 40, c.y - 40, (c.x + T.x) / 2, c.y - 130, T.x, T.y - 44, a);
    const k = (Game.t % 1.7) / 1.7;
    Art.hand(ctx, lerp(c.x, T.x, easeOutCubic(k)) + 16,
             lerp(c.y - 30, T.y - 34, easeOutCubic(k)) + Math.sin(k * Math.PI) * -26,
             0, a, Game.U * Game.uiScale * 1.5);
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(Game.t * 4) * 0.15;
    ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 5; ctx.setLineDash([10, 12]);
    ctx.beginPath(); ctx.ellipse(T.x, T.y + 4, 48, 15, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
};

/* -------------------------------------------------------------- AGAIN --- */
Game.scenes.again = {
  enter(s) { s.sparkleT = 0; },
  update(s, dt) {
    if (Game.handleCommonButtons()) return;
    Game.layoutAgain(s);
    const b = Game.hitButtons();
    if (b) {
      Sfx.blip(760, 0.12, 'triangle', 0.3);
      Game.celebrate(b.x, b.y, 12);
      if (b.id === 'same') Game.startDrink(s.drink);
      else if (b.id === 'other') Game.setStep('menu');
      else if (b.id === 'freeart') Game.startFree();
    }
  },
  draw(s, ctx) {
    ctx.fillStyle = 'rgba(255,242,236,0.5)';
    ctx.fillRect(Game.view.x0 - 10, Game.view.y0 - 10,
                 Game.view.x1 - Game.view.x0 + 20, Game.view.y1 - Game.view.y0 + 20);
    for (const b of Game.buttons) if (b.id !== 'home') Art.button(ctx, b, Game.t);
  }
};

Game.layoutAgain = function (s) {
  const vw = this.view.x1 - this.view.x0, vh = this.view.y1 - this.view.y0;
  const cx = (this.view.x0 + this.view.x1) / 2, cy = (this.view.y0 + this.view.y1) / 2;
  const R = Math.min(vw * (this.portrait ? 0.22 : 0.12), vh * 0.20);
  const defs = [
    { id: 'same', c1: '#fff6ec', c2: '#f0c79b' },
    { id: 'other', c1: '#f4fbff', c2: '#a9d9f2' },
    { id: 'freeart', c1: '#fff0f6', c2: '#ffa8c8' }
  ];
  const rows = this.portrait ? 3 : 1;
  defs.forEach((d, i) => {
    const x = this.portrait ? cx : cx + (i - 1) * R * 2.5;
    const y = this.portrait ? cy + (i - 1) * R * 2.45 : cy + vh * 0.04;
    this.buttons.push({ x, y, r: R, c1: d.c1, c2: d.c2, id: d.id, pulse: true, phase: i * 1.3,
      icon: (c, rr) => Game.againIcon(c, rr, d.id, s) });
  });
};

Game.againIcon = function (ctx, r, id, s) {
  if (id === 'same') {
    const d = DRINKS[s.drink];
    Art.miniCup(ctx, 0, r * 0.10, r * 0.42,
      { espresso: d.esp ? 1 : 0, milk: 1, cocoa: d.cocoa || 0, foam: 0.4 });
    ctx.strokeStyle = '#b8763f'; ctx.lineWidth = r * 0.13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.70, 0.5, 5.3); ctx.stroke();
    ctx.fillStyle = '#b8763f';
    ctx.save(); ctx.translate(r * 0.60, -r * 0.44); ctx.rotate(1.0);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.24); ctx.lineTo(-r * 0.20, r * 0.15); ctx.lineTo(r * 0.20, r * 0.15);
    ctx.closePath(); ctx.fill(); ctx.restore();
  } else if (id === 'other') {
    const sets = [{ espresso: 1, milk: 1 }, { milk: 1, foam: 0.7 }, { cocoa: 1, milk: 0.8 }];
    sets.forEach((o, i) => {
      Art.miniCup(ctx, (i - 1) * r * 0.60, r * 0.14 + (i === 1 ? -r * 0.16 : 0), r * 0.33, o);
    });
    ctx.fillStyle = '#ffd66b'; Art.starPath(ctx, r * 0.58, -r * 0.50, r * 0.15, r * 0.07, 5); ctx.fill();
  } else {
    ctx.fillStyle = '#a9743f'; ctx.beginPath(); ctx.arc(0, 0, r * 0.64, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d3a068'; ctx.beginPath(); ctx.arc(-r * 0.06, -r * 0.08, r * 0.52, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffaf0'; Art.heartPath(ctx, 0, r * 0.02, r * 0.82); ctx.fill();
    ctx.fillStyle = '#ffd66b'; Art.starPath(ctx, r * 0.55, -r * 0.50, r * 0.18, r * 0.08, 5); ctx.fill();
  }
};
