/* =========================================================================
   game3d.js — the play loop driving real 3D transforms.
   All positions are millimetres in the scene's coordinate frame (Y up).
   Gestures work on an interaction plane per step: the pointer ray is
   intersected with it, so dragging is physical rather than screen-relative.
   ========================================================================= */
'use strict';

const DRINKS = {
  latte:  { esp: true, base: 'crema', foamMax: 0.35, cocoa: 0,
            steps: ['grind', 'level', 'tamp', 'lock', 'cupset', 'extract', 'steam', 'pour', 'serve'] },
  cappu:  { esp: true, base: 'crema', foamMax: 0.85, cocoa: 0,
            steps: ['grind', 'level', 'tamp', 'lock', 'cupset', 'extract', 'steam', 'pour', 'serve'] },
  milk:   { esp: false, base: 'honey', foamMax: 0.6, cocoa: 0,
            steps: ['cupset', 'steam', 'pour', 'serve'] },
  cocoa:  { esp: false, base: 'cocoa', foamMax: 0.5, cocoa: 1,
            steps: ['cupset', 'steam', 'pour', 'serve'] }
};

/* Interaction planes.  'z' = a vertical plane facing the player (most work),
   'y' = a horizontal plane (setting things down, drawing on a liquid surface).
   Ptr.x / Ptr.y always mean "the two free axes of the active plane": for a
   vertical plane that is world X and Y, for a horizontal one world X and Z. */
const PLANE = {
  menu:    { axis: 'y', v: 950 },
  grind:   { axis: 'z', v: -240 },
  level:   { axis: 'z', v: -150 },
  tamp:    { axis: 'z', v: -150 },
  lock:    { axis: 'z', v: -150 },
  cupset:  { axis: 'z', v: -132 },
  extract: { axis: 'z', v: -228 },
  steam:   { axis: 'z', v: -104 },
  pour:    s => ({ axis: 'y', v: s.cup.y + G3.surfaceGeo(s.cup).y }),
  free:    s => ({ axis: 'y', v: s.cup.y + G3.surfaceGeo(s.cup).y }),
  serve:   { axis: 'y', v: 950 }
};

/* Camera framing: a point of interest, the radius to fit, and the direction
   to view it from.  Distance is solved so the radius fits the narrower FOV,
   which makes portrait and landscape frame the same subject correctly.      */
const SHOT = {
  menu:    { at: [-30, 1010, -70],  r: 530, yaw: 0.05, pitch: 0.40 },
  grind:   { at: [-1050, 1105, -240], r: 340, yaw: 0.26, pitch: 0.28 },
  level:   { at: [-560, 1035, -150], r: 175, yaw: 0.16, pitch: 0.46 },
  tamp:    { at: [-560, 1090, -150], r: 235, yaw: 0.16, pitch: 0.30 },
  lock:    { at: [10, 1080, -140],  r: 235, yaw: 0.14, pitch: 0.50 },
  cupset:  { at: [90, 1200, -260],  r: 430, yaw: 0.10, pitch: 0.26 },
  extract: { at: [-40, 1105, -170], r: 260, yaw: 0.15, pitch: 0.30 },
  steam:   { at: [505, 1075, -115], r: 215, yaw: -0.20, pitch: 0.36 },
  pour:    { at: [178, 1040, -46],  r: 98,  yaw: 0.04, pitch: 0.66 },
  free:    { at: [178, 1040, -46],  r: 98,  yaw: 0.04, pitch: 0.66 },
  serve:   { at: [610, 1005, -110], r: 590, yaw: -0.05, pitch: 0.44 }
};

const A_UNLOCK = -0.62;    // handle swung out to the left
const A_LOCK = 0;          // …home, pointing at the barista
const PF_REST = { x: -560, y: 1032, z: -150 };
const GRIND_REST = { x: -1180, y: 1040, z: -240 };
const PF_LOCK_REST = { x: 190, y: 1054, z: -150 };
const CUP = { x: LAY.cup.x, z: LAY.cup.z, rim: 42.5, h: 62 };
const POUR_SPOT = { x: 178, z: -46 };   // clear of the portafilter handle

const G3 = {
  t: 0, W: 0, H: 0, portrait: true, s: null,
  cam: { at: V3.make(0, 1050, -100), eye: V3.make(0, 1500, 800), fov: 0.62,
         tAt: V3.make(0, 1050, -100), tEye: V3.make(0, 1500, 800) },
  hint: null,

  init() {
    this.s = this.fresh();
    this.setStep('menu', true);
  },

  fresh() {
    return {
      step: 'menu', stepT: 0, idle: 0, flash: 0, drink: 'latte', freeMode: false,
      pf: { x: PF_REST.x, y: PF_REST.y, z: PF_REST.z, ang: A_UNLOCK, dose: 0, leveled: 0,
            tamped: false, wet: false, held: false, phase: 'free', locked: false,
            ip: 0, tickN: 0, lockAnim: 0, grabAng: 0 },
      tamper: { y: 1200, held: false, press: 0, done: false, lift: 0, touch: false },
      grinder: { run: 0, spawn: 0 },
      cup: { x: CUP.x, y: LAY.trayY, z: CUP.z, held: false, placed: false,
             espresso: 0, milk: 0, cocoa: 0, foam: 0, crema: 0, art: false, surface: null },
      paddle: { a: 0, held: false, latched: false },
      brew: { t: 0, on: false, done: false, pressure: 0 },
      pitcher: { x: LAY.pitcherRest.x, y: LAY.counterY, z: LAY.pitcherRest.z, rot: 0, tiltZ: 0,
                 milk: 0.55, foam: 0, swirl: 0, swirlSpd: 0, held: false, steaming: 0,
                 prog: 0, done: false, chirrT: 0, tilt: 0 },
      pour: { flow: 0, poured: 0, wiggles: 0, lastDir: 0, upRun: 0, done: false, doneT: 0,
              pattern: 'heart', px: 0.5, py: 0.5, everPoured: false, idleAfter: 0 },
      tray: [], serveDone: false, sparkleT: 0,
      _work: 0, _done: false, _settle: 0, _tick: 0, _after: 0, _resist: 0,
      _puff: 0, _placeT: -1, _full: false
    };
  },

  /* ---------------------------------------------------------------- steps */
  setStep(step, instant) {
    const s = this.s;
    s.step = step; s.stepT = 0; s.idle = 0;
    s._work = 0; s._done = false; s._settle = 0; s._tick = 0;
    s._after = 0; s._resist = 0; s._puff = 0; s._placeT = -1; s._full = false;
    // the sample drinks belong to the menu only
    if (step !== 'menu' && Scene.menuCups) {
      Scene.menuCups.forEach(mc => {
        mc.cup.visible = mc.saucer.visible = mc.drink.visible = false;
      });
    }
    const h = this.scenes[step];
    if (h && h.enter) h.enter(s);
    this.aimCamera();
    if (instant) { V3.copy(this.cam.at, this.cam.tAt); V3.copy(this.cam.eye, this.cam.tEye); }
  },
  nextStep() {
    const s = this.s;
    if (s.freeMode) return;
    const list = DRINKS[s.drink].steps;
    const i = list.indexOf(s.step);
    if (i >= 0 && i < list.length - 1) this.setStep(list[i + 1]);
    else this.setStep('menu');
  },

  startDrink(kind) {
    const s = this.s, keep = s.tray;
    const d = DRINKS[kind];
    Object.assign(s, this.fresh());
    s.tray = keep; s.drink = kind;
    s.cup.cocoa = d.cocoa || 0;
    Fluid.reset();
    R3.parts.clear();
    this.setStep(d.steps[0]);
  },
  startFree() {
    const s = this.s, keep = s.tray;
    Object.assign(s, this.fresh());
    s.tray = keep; s.freeMode = true; s.drink = 'latte';
    s.cup = { x: POUR_SPOT.x, y: LAY.trayY, z: POUR_SPOT.z, held: false, placed: true,
              espresso: 1, milk: 0, cocoa: 0, foam: 0, crema: 1, art: true, surface: null };
    s.pitcher.milk = 1; s.pitcher.foam = 0.65; s.pitcher.done = true;
    Fluid.reset();
    R3.parts.clear();
    this.setStep('free');
  },

  /* --------------------------------------------------------------- camera */
  aimCamera() {
    const sh = SHOT[this.s.step] || SHOT.menu;
    const aspect = this.W / this.H;
    const fov = this.cam.fov;
    const halfV = fov / 2;
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    const half = Math.min(halfV, halfH);
    const dist = sh.r / Math.tan(half) * 1.06;
    const cp = Math.cos(sh.pitch);
    V3.set(this.cam.tAt, sh.at[0], sh.at[1], sh.at[2]);
    V3.set(this.cam.tEye,
      sh.at[0] + Math.sin(sh.yaw) * cp * dist,
      sh.at[1] + Math.sin(sh.pitch) * dist,
      sh.at[2] + Math.cos(sh.yaw) * cp * dist);
  },
  moveCamera(dt) {
    const k = 0.0009;
    for (let i = 0; i < 3; i++) {
      this.cam.at[i] = approach(this.cam.at[i], this.cam.tAt[i], k, dt);
      this.cam.eye[i] = approach(this.cam.eye[i], this.cam.tEye[i], k, dt);
    }
    R3.setCam(this.cam.eye, this.cam.at, this.cam.fov);
  },

  /* -------------------------------------------------------------- helpers */
  near(x, y, ox, oy, r) { return Math.hypot(x - ox, y - oy) < r; },
  /** is the finger on this world point?  measured on screen, so an object
      that is not on the interaction plane is still comfortably grabbable */
  onScreen(p3, frac) {
    const o = [0, 0, 0];
    R3.project(p3, o);
    if (o[2] <= 0) return false;
    const r = (frac || 0.24) * Math.min(this.W, this.H);
    return Math.hypot(Ptr.sx - o[0], Ptr.sy - o[1]) < r;
  },
  snap(o, tx, ty, radius, strength, dt) {
    const d = Math.hypot(o.x - tx, o.y - ty);
    if (d < radius) {
      const k = (1 - d / radius) * strength;
      o.x = approach(o.x, tx, 1 - k, dt);
      o.y = approach(o.y, ty, 1 - k, dt);
      return true;
    }
    return false;
  },
  puff(x, y, z, n, col, spread, size) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), b = rnd(0, TAU);
      R3.parts.add({ x, y, z, vx: Math.cos(a) * rnd(20, spread), vy: rnd(10, spread * 0.7),
                     vz: Math.sin(b) * rnd(20, spread) * 0.5, g: -260, drag: 0.90,
                     life: rnd(0.35, 0.8), size: size || 9, size1: (size || 9) * 2.4, a0: 0.5 });
    }
  },
  sparkle(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU);
      R3.parts.add({ x, y, z, vx: Math.cos(a) * rnd(60, 320), vy: rnd(90, 380),
                     vz: Math.sin(a) * rnd(40, 180), g: -900, drag: 0.94,
                     life: rnd(0.5, 1.0), size: 7, size1: 2, a0: 0.85 });
    }
  },

  /* ----------------------------------------------------------------- loop */
  update(dt) {
    this.t += dt;
    const s = this.s;
    s.stepT += dt;
    s.flash = Math.max(0, s.flash - dt * 2.4);
    if (Ptr.down && (Math.abs(Ptr.dsx) + Math.abs(Ptr.dsy)) > 0.6) s.idle = 0; else s.idle += dt;
    if (Ptr.justDown) s.idle = 0;

    this.aimCamera();
    this.moveCamera(dt);
    R3.buildMatrices();
    const pl = PLANE[s.step] || PLANE.lock;
    Ptr.place(typeof pl === 'function' ? pl(s) : pl, dt);

    this.hint = null;
    const h = this.scenes[s.step];
    if (h && h.update) h.update(s, dt);

    R3.parts.update(dt);
    this.syncNodes();
  },

  /* ------------------------------------------- state -> scene-graph matrices */
  syncNodes() {
    const s = this.s, N = Scene.named, M = M4;
    const pf = s.pf;

    const showPF = s.step !== 'menu' && (DRINKS[s.drink].esp || pf.locked) && !s.freeMode;
    N.portafilter.visible = showPF;
    N.pfHandle.visible = showPF;
    N.puck.visible = showPF && pf.dose > 0.01;
    if (showPF) {
      const px = pf.locked && s.step !== 'lock' ? LAY.group.x : pf.x;
      const py = pf.locked && s.step !== 'lock' ? LAY.group.y : pf.y;
      const pz = pf.locked && s.step !== 'lock' ? LAY.group.z : pf.z;
      const ang = pf.locked && s.step !== 'lock' ? A_LOCK : pf.ang;
      M.compose(N.portafilter.mat, px, py, pz, 0, -Math.PI / 2 + ang, 0, 1, 1, 1);
      N.pfHandle.mat.set(N.portafilter.mat);
      const th = pf.dose * (pf.tamped ? 2.2 : 2.9 - pf.leveled * 0.7);
      M.compose(N.puck.mat, px, py - 46, pz, 0, -Math.PI / 2 + ang, 0, 1, th, 1);
      N.puck.material.tint = pf.wet ? [0.55, 0.5, 0.48] : [1, 1, 1];
    }

    // tamper
    N.tamper.visible = N.tamperKnob.visible = (s.step === 'tamp');
    if (s.step === 'tamp') {
      M.compose(N.tamper.mat, PF_REST.x, s.tamper.y, PF_REST.z, 0, 0, 0, 1, 1, 1);
      M.compose(N.tamperKnob.mat, PF_REST.x, s.tamper.y + 44, PF_REST.z, 0, 0, 0, 1, 1, 1);
    }

    // cup + saucer + drink surface
    const c = s.cup;
    const cupSteps = ['cupset', 'extract', 'steam', 'pour', 'serve', 'free'];
    N.cup.visible = cupSteps.includes(s.step) && !(s.step === 'serve' && s.serveDone);
    N.saucer.visible = N.cup.visible && (s.step === 'serve');
    if (N.cup.visible) {
      M.compose(N.cup.mat, c.x, c.y, c.z, 0, 0.5, 0, 1, 1, 1);
      M.compose(N.saucer.mat, c.x, c.y - 12, c.z, 0, 0, 0, 1, 1, 1);
      const g = this.surfaceGeo(c);
      const showArt = (c.art || s.freeMode) && (s.pour.everPoured || s.freeMode || c.surface);
      N.drink.visible = showArt && g.vol > 0.02;
      N.liquid.visible = !showArt && g.vol > 0.02;
      const tgt = N.drink.visible ? N.drink : N.liquid;
      M.compose(tgt.mat, c.x, c.y + g.y, c.z, 0, 0, 0, g.r, 1, g.r);
      if (N.liquid.visible) {
        N.liquid.material.tint = this.liquidTint(c);
        N.liquid.material.mode = 2;
      }
    } else { N.drink.visible = false; N.liquid.visible = false; }

    // pitcher + its milk surface
    const p = s.pitcher;
    N.pitcher.visible = ['steam', 'pour', 'free'].includes(s.step);
    N.milk.visible = N.pitcher.visible && p.milk > 0.05;
    if (N.pitcher.visible) {
      M.compose(N.pitcher.mat, p.x, p.y, p.z, p.tiltZ * 0.35, p.rot, p.tiltZ, 1, 1, 1);
      const lvl = 12 + p.milk * 108;
      const swirlY = Math.max(0.12, Math.min(1.4, p.swirlSpd * 1.5));
      M.compose(N.milk.mat, p.x, p.y + lvl, p.z, p.tiltZ * 0.35, p.swirl, p.tiltZ, 1, swirlY, 1);
      N.milk.material.tint = [1.02 - p.foam * 0.02, 1.0 + p.foam * 0.01, 0.95 + p.foam * 0.05];
      N.milk.material.rough = [0.5 + p.foam * 0.9, 0.06];
    }

    // espresso threads
    const br = s.brew;
    const pouring = br.on && br.t > 1.0;
    for (let i = 0; i < 2; i++) {
      const n = N.stream[i];
      n.visible = pouring;
      if (!pouring) continue;
      const flow = smoothstep(1.0, 1.7, br.t) * (1 - smoothstep(4.6, 5.2, br.t));
      const sx = LAY.group.x + (i ? 11 : -11);
      const top = LAY.group.y - 60;
      const bot = c.y + this.surfaceGeo(c).y;
      const wob = Math.sin(this.t * 22 + i * 2) * 0.5;
      M.compose(n.mat, sx + wob, bot, LAY.group.z, 0, 0, 0,
                1.5 * flow, top - bot, 1.5 * flow);
    }

    // milk thread
    const P = s.pour;
    const showMilk = (s.step === 'pour' || s.step === 'free') && P.flow > 0.05;
    N.milkStream.visible = showMilk;
    if (showMilk) {
      const sp = this.spout(p);
      const g = this.surfaceGeo(c);
      const tx = c.x + (P.px - 0.5) * g.r * 2, tz = c.z + (P.py - 0.5) * g.r * 2;
      const ty = c.y + g.y;
      const dx = tx - sp[0], dy = ty - sp[1], dz = tz - sp[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      const rz = Math.atan2(dx, -dy);
      const rx = Math.atan2(-dz, Math.hypot(dx, dy));
      const m = M4.compose(M4.make(), sp[0], sp[1], sp[2], rx, 0, rz, 1, 1, 1);
      const sc = M4.compose(M4.make(), 0, 0, 0, 0, 0, 0, 2.6 + P.flow * 2.2, -len, 2.6 + P.flow * 2.2);
      M4.mul(N.milkStream.mat, m, sc);
    }

    // machine feedback
    if (N.paddle) {
      const b = Scene.named.paddleBase;
      M.compose(N.paddle.mat, b[0], b[1], b[2], -s.paddle.a, 0, 0, 1, 1, 1);
    }
    if (N.steamKnob) {
      const b = Scene.named.steamKnobBase;
      M.compose(N.steamKnob.mat, b[0], b[1], b[2], 0, 0, p.steaming > 0.05 ? -0.9 : 0, 1, 1, 1);
    }
    if (N.brewLamp) N.brewLamp.material.emissive = br.on ? [0.3, 1.5, 0.5] : [0.2, 0.5, 0.25];
    if (N.grindLamp) {
      N.grindLamp.material.emissive = s.grinder.run > 0.1 ? [2.6, 0.35, 0.25] : [0.25, 0.05, 0.04];
    }
    if (N.gauge) {
      const a = -2.4 + sat(br.pressure) * 4.2;
      const gx = LAY.machine.cx + 200, gy = LAY.counterY + 22 + 348, gz = LAY.machine.front + 26;
      const m = M4.compose(M4.make(), gx, gy, gz, Math.PI / 2, 0, 0, 1, 1, 1);
      const r = M4.compose(M4.make(), 0, 0, 0, 0, a, 0, 1, 1, 1);
      const t = M4.compose(M4.make(), 0, 0, -16, 0, 0, 0, 1, 1, 1);
      M4.mul(N.gauge.mat, m, M4.mul(M4.make(), r, t));
    }
    // clean cups on the warmer: one disappears when the player takes it
    const taken = (c.placed || c.held) ? 1 : 0;
    N.stackCups.forEach((n, i) => { n.visible = i >= taken; });

    // finished drinks on the tray
    N.trayCups.forEach((tc, i) => {
      const d = s.tray[i];
      tc.cup.visible = tc.saucer.visible = !!d;
      tc.drink.visible = !!(d && d.tex);
      if (!d) return;
      const n = s.tray.length;
      const x = LAY.serve.x + (i - (n - 1) / 2) * Math.min(150, 340 / Math.max(1, n));
      const y = LAY.counterY + 22, z = LAY.serve.z;
      M.compose(tc.saucer.mat, x, y, z, 0, i * 0.7, 0, 1, 1, 1);
      M.compose(tc.cup.mat, x, y + 12, z, 0, 0.5 + i * 0.7, 0, 1, 1, 1);
      if (d.tex) {
        const g = this.surfaceGeo(d);
        tc.drink.material.extra = d.tex;
        tc.drink.material.mode = 1;
        M.compose(tc.drink.mat, x, y + 12 + g.y, z, 0, 0, 0, g.r, 1, g.r);
      }
    });
  },

  /** liquid surface height (relative to the cup base) and radius */
  surfaceGeo(c) {
    const esp = sat(c.espresso || 0), milk = sat(c.milk || 0), cocoa = sat(c.cocoa || 0);
    const vol = sat(esp * 0.50 + milk * 0.55 + cocoa * 0.50);
    return { vol, y: 13 + vol * 40, r: (CUP.rim - 4.5) * (0.80 + vol * 0.20) };
  },
  liquidTint(c) {
    const esp = sat(c.espresso || 0), milk = sat(c.milk || 0), cocoa = sat(c.cocoa || 0);
    const m = sat(milk / (milk + esp + cocoa + 0.001));
    const ramp = cocoa > 0.35 ? [[0.16, 0.09, 0.06], [0.30, 0.18, 0.12], [0.62, 0.48, 0.38]]
                              : [[0.055, 0.026, 0.014], [0.42, 0.26, 0.15], [0.86, 0.82, 0.72]];
    const i = m < 0.5 ? 0 : 1, t = m < 0.5 ? m * 2 : (m - 0.5) * 2;
    const a = ramp[i], b = ramp[i + 1];
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  },
  /** world position of the pitcher spout */
  spout(p) {
    const lx = -74, ly = 128, lz = 0;
    const m = M4.compose(M4.make(), p.x, p.y, p.z, p.tiltZ * 0.35, p.rot, p.tiltZ, 1, 1, 1);
    const o = V3.make();
    M4.xformPoint(o, m, [lx, ly, lz]);
    return o;
  },

  scenes: {}
};

/* =============================================================== MENU ==== */
/* Four finished drinks stand on the counter.  Tapping one starts it.        */
const MENU_SPOTS = [
  { id: 'latte', x: -520 }, { id: 'cappu', x: -190 },
  { id: 'milk', x: 140 }, { id: 'cocoa', x: 470 }
];
G3.scenes.menu = {
  enter(s) {
    s.pf.locked = false;
    if (!Scene.menuCups) {
      Scene.menuCups = MENU_SPOTS.map(sp => ({
        cup: Scene.node(Scene.mesh(Scene.cupGeo()), mat('porcelain'), M4.make()),
        saucer: Scene.node(Scene.mesh(Scene.saucerGeo()), mat('porcelain'), M4.make()),
        drink: Scene.node(Scene.mesh(Geo.disc(1, 40, 1)), mat('porcelain', { mode: 2 }),
                          M4.make(), { noShadow: true }),
        id: sp.id, x: sp.x
      }));
    }
  },
  update(s, dt) {
    const cups = Scene.menuCups;
    const y = LAY.counterY, z = -60;
    cups.forEach((mc, i) => {
      mc.cup.visible = mc.saucer.visible = mc.drink.visible = true;
      M4.compose(mc.saucer.mat, mc.x, y, z, 0, i * 0.6, 0, 1, 1, 1);
      M4.compose(mc.cup.mat, mc.x, y + 12, z, 0, 0.5 + i * 0.6, 0, 1, 1, 1);
      const fake = { espresso: DRINKS[mc.id].esp ? 1 : 0, milk: 1, cocoa: DRINKS[mc.id].cocoa || 0 };
      const g = G3.surfaceGeo(fake);
      M4.compose(mc.drink.mat, mc.x, y + 12 + g.y, z, 0, 0, 0, g.r, 1, g.r);
      mc.drink.material.tint = G3.liquidTint(fake);
      // a little steam so they read as freshly made
      if (Math.random() < dt * 6) {
        R3.parts.add({ x: mc.x + rnd(-14, 14), y: y + 12 + g.y + 6, z: z + rnd(-10, 10),
                       vx: rnd(-14, 14), vy: rnd(50, 110), vz: rnd(-10, 10), g: 30, drag: 0.985,
                       life: rnd(1.0, 1.9), size: 16, size1: 60, a0: 0.16 });
      }
    });
    if (Ptr.justDown) {
      let best = null, bd = 1e9;
      for (const mc of cups) {
        const d = Math.hypot(Ptr.x - mc.x, Ptr.y - z);
        if (d < bd) { bd = d; best = mc; }
      }
      if (best && bd < 150) {
        cups.forEach(mc => { mc.cup.visible = mc.saucer.visible = mc.drink.visible = false; });
        Sfx.blip(760, 0.12, 'triangle', 0.3);
        Sfx.sparkle(3, 880);
        G3.sparkle(best.x, LAY.counterY + 90, z, 14);
        G3.startDrink(best.id);
      }
    }
    G3.hint = { type: 'tap', p: [cups[0].x, LAY.counterY + 70, z] };
  }
};

/* ============================================================== GRIND ==== */
G3.scenes.grind = {
  enter(s) {
    s.pf.x = GRIND_REST.x; s.pf.y = GRIND_REST.y; s.pf.z = PLANE.grind.v;
    s.pf.ang = A_UNLOCK * 0.4;
    s.grinder.run = 0;
    if (Scene.menuCups) Scene.menuCups.forEach(mc => { mc.cup.visible = mc.saucer.visible = mc.drink.visible = false; });
  },
  update(s, dt) {
    const pf = s.pf, G = LAY.grinder;
    const TX = G.x, TY = G.forkY + 12;
    if (Ptr.justDown && G3.onScreen([pf.x + 60, pf.y - 20, pf.z], 0.30)) pf.held = true;
    if (!Ptr.down) pf.held = false;
    if (pf.held) {
      pf.x = approach(pf.x, Ptr.x - 90, 0.0002, dt);
      pf.y = approach(pf.y, Ptr.y + 20, 0.0002, dt);
      G3.snap(pf, TX, TY, 130, 0.55, dt);
    } else if (pf.dose < 0.02) {
      pf.x = approach(pf.x, GRIND_REST.x, 0.05, dt);
      pf.y = approach(pf.y, GRIND_REST.y, 0.05, dt);
    } else if (pf.dose < 1) {
      // once the grind has started it stays put until the dose is complete
      pf.x = approach(pf.x, TX, 0.02, dt);
      pf.y = approach(pf.y, TY, 0.02, dt);
    }
    const inPlace = Math.hypot(pf.x - TX, pf.y - TY) < 34 && pf.dose < 1;
    const running = inPlace && (pf.held || pf.dose > 0.02);
    s.grinder.run = approach(s.grinder.run, running ? 1 : 0, 0.001, dt);

    if (running) {
      if (!Sfx.loops.grind) Sfx.grindStart();
      pf.dose = Math.min(1, pf.dose + dt * 0.46);
      s.grinder.spawn += dt;
      while (s.grinder.spawn > 0.012) {
        s.grinder.spawn -= 0.012;
        R3.parts.add({ x: TX + rnd(-9, 9), y: G.chuteY - 30, z: PLANE.grind.v + rnd(-8, 8),
                       vx: rnd(-16, 16), vy: rnd(-90, -40), vz: rnd(-8, 8), g: -2600,
                       drag: 1, life: 0.16, size: 3.4, size1: 2.6, a0: 0.95 });
      }
    } else if (Sfx.loops.grind) Sfx.grindStop();

    if (pf.dose >= 1) {
      Sfx.grindStop();
      if (!s._full) {
        s._full = true; Sfx.sparkle(3, 700); G3.sparkle(pf.x, pf.y + 40, pf.z, 8); s.flash = 0.35;
      }
      pf.x = approach(pf.x, GRIND_REST.x, 0.004, dt);
      pf.y = approach(pf.y, GRIND_REST.y, 0.004, dt);
      s._after += dt;
      if (s._after > 0.9) G3.nextStep();
    }
    if (pf.dose < 1) G3.hint = { type: 'drag', from: [pf.x + 60, pf.y, pf.z], to: [TX + 60, TY, pf.z] };
  }
};

/* ============================================================== LEVEL ==== */
G3.scenes.level = {
  enter(s) {
    s.pf.x = PF_REST.x; s.pf.y = PF_REST.y; s.pf.z = PF_REST.z; s.pf.ang = A_UNLOCK * 0.4;
    s.pf.leveled = 0;
  },
  update(s, dt) {
    const pf = s.pf;
    const over = Ptr.down && Math.abs(Ptr.x - pf.x) < 90 && Math.abs(Ptr.y - (pf.y + 6)) < 70;
    if (over && Math.abs(Ptr.dx) > 0.2) {
      const w = Math.abs(Ptr.dx) * (Math.abs(Ptr.dx) > Math.abs(Ptr.dy) ? 1 : 0.35);
      s._work += w;
      pf.leveled = sat(s._work / 320);
      if (Math.random() < w * 0.05) {
        R3.parts.add({ x: Ptr.x + rnd(-14, 14), y: pf.y - 4, z: pf.z + rnd(-14, 14),
                       vx: Ptr.dx * 12, vy: rnd(20, 70), vz: rnd(-30, 30), g: -1800, drag: 0.95,
                       life: 0.3, size: 3, size1: 1.5, a0: 0.8 });
      }
      s._tick += w;
      if (s._tick > 30) { s._tick = 0; Sfx.tick(0.45, 0.05); }
    }
    if (pf.leveled >= 1 && !s._done) {
      s._done = true; Sfx.blip(560, 0.12, 'sine', 0.22); G3.sparkle(pf.x, pf.y + 30, pf.z, 6);
    }
    if (s._done) { s._settle += dt; if (s._settle > 0.5) G3.nextStep(); }
    else G3.hint = { type: 'sweep', p: [pf.x, pf.y + 6, pf.z], w: 70 };
  }
};

/* =============================================================== TAMP ==== */
G3.scenes.tamp = {
  enter(s) {
    s.pf.x = PF_REST.x; s.pf.y = PF_REST.y; s.pf.z = PF_REST.z; s.pf.ang = A_UNLOCK * 0.4;
    s.tamper = { y: PF_REST.y + 150, held: false, press: 0, done: false, lift: 0, touch: false };
  },
  update(s, dt) {
    const pf = s.pf, tm = s.tamper;
    const contactY = pf.y - 44 + pf.dose * 15;
    const restY = pf.y + 150;
    if (tm.done) {
      tm.lift += dt;
      tm.y = approach(tm.y, restY + 60, 0.004, dt);
      if (tm.lift > 0.8) G3.nextStep();
      return;
    }
    if (Ptr.justDown && G3.onScreen([PF_REST.x, tm.y + 40, PF_REST.z], 0.30)) tm.held = true;
    if (!Ptr.down) tm.held = false;
    if (tm.held) {
      const want = Ptr.y - 40;
      if (want >= contactY) { tm.y = approach(tm.y, want, 0.0002, dt); tm.press = 0; tm.touch = false; }
      else {
        const over = contactY - want;
        tm.press = Math.min(34, over);
        tm.y = contactY - tm.press * 0.30;
        if (tm.press > 3 && !tm.touch) {
          tm.touch = true; Sfx.tick(0.5, 0.08);
          G3.puff(pf.x, contactY, pf.z, 5, null, 40, 5);
        }
        if (tm.press >= 24) {
          tm.done = true; pf.tamped = true; pf.leveled = 1;
          Sfx.tamp(1); s.flash = 0.45;
          G3.puff(pf.x, contactY - 6, pf.z, 16, null, 120, 7);
          G3.sparkle(pf.x, contactY + 30, pf.z, 8);
        }
      }
    } else {
      tm.press = approach(tm.press, 0, 0.001, dt);
      tm.y = approach(tm.y, restY, 0.001, dt);
      tm.touch = false;
    }
    G3.hint = { type: 'press', from: [PF_REST.x + 60, tm.y + 50, pf.z], to: [PF_REST.x + 60, contactY + 20, pf.z] };
  }
};

/* =============================================================== LOCK ==== *
 * The signature move.  Carry it up under the group, feel it bite, then twist
 * it home about the group's own vertical axis — the last few degrees fight
 * back before it clicks.
 * ---------------------------------------------------------------------- */
G3.scenes.lock = {
  enter(s) {
    const pf = s.pf;
    pf.phase = 'free'; pf.locked = false; pf.ang = A_UNLOCK;
    pf.x = PF_LOCK_REST.x; pf.y = PF_LOCK_REST.y; pf.z = PF_LOCK_REST.z;
    pf.ip = 0; pf.tickN = 0; pf.lockAnim = 0; pf.held = false;
  },
  update(s, dt) {
    const pf = s.pf, G = LAY.group;

    if (pf.phase === 'locked') {
      pf.lockAnim += dt;
      const k = sat(pf.lockAnim / 0.16);
      pf.ang = lerp(pf._from, A_LOCK, easeOutBack(k, 2.6));
      if (pf.lockAnim > 0.6) { pf.locked = true; G3.nextStep(); }
      return;
    }

    if (pf.phase === 'rot') {
      // the finger angle about the group's vertical axis drives the twist
      const hp = [0, 0, 0];
      R3.rayPlaneY(Ptr.sx, Ptr.sy, G.y - 40, hp);
      const fa = Math.atan2(hp[0] - G.x, hp[2] - G.z);
      if (Ptr.justDown) {
        const d = Math.hypot(hp[0] - G.x, hp[2] - G.z);
        if (d > 20 && d < 420) { pf.held = true; pf.grabAng = fa - pf.ang; }
      }
      if (!Ptr.down) pf.held = false;

      if (pf.held) {
        const want = fa - pf.grabAng;
        let ip = clamp((want - A_UNLOCK) / (A_LOCK - A_UNLOCK), 0, 1.4);
        pf.ip = approach(pf.ip, ip, 0.0004, dt);
        let dp = pf.ip <= 0.70 ? pf.ip : 0.70 + (pf.ip - 0.70) * 0.40;
        dp = Math.min(dp, 0.96);
        pf.ang = A_UNLOCK + dp * (A_LOCK - A_UNLOCK);
        s._resist = smoothstep(0.72, 1.05, pf.ip);
        const n = Math.floor(dp * 11);
        if (n !== pf.tickN) { pf.tickN = n; if (n > 0) Sfx.tick(0.85 + dp * 0.7, 0.10 + s._resist * 0.10); }
        if (pf.ip >= 1.12) {
          pf.phase = 'locked'; pf._from = pf.ang; pf.lockAnim = 0; pf.held = false;
          Sfx.clack(); s.flash = 0.6;
          G3.sparkle(G.x, G.y - 10, G.z, 24);
          G3.puff(G.x, G.y - 24, G.z, 8, null, 80, 8);
          Sfx.sparkle(4, 780);
        }
      } else {
        pf.ip = approach(pf.ip, Math.max(0, pf.ip - 0.06), 0.02, dt);
        let dp = pf.ip <= 0.70 ? pf.ip : 0.70 + (pf.ip - 0.70) * 0.40;
        pf.ang = A_UNLOCK + Math.min(dp, 0.96) * (A_LOCK - A_UNLOCK);
        s._resist = 0;
      }
      G3.hint = { type: 'twist', p: [G.x, G.y - 30, G.z], from: pf.ang, to: A_LOCK,
                  fade: 1 - sat(pf.ip * 1.15) };
      return;
    }

    // ---- carrying it up under the group
    pf.z = approach(pf.z, G.z, 0.02, dt);
    if (Ptr.justDown && G3.onScreen([pf.x + 60, pf.y - 16, pf.z], 0.34)) pf.held = true;
    if (!Ptr.down) pf.held = false;
    if (pf.held) {
      pf.x = approach(pf.x, Ptr.x - 40, 0.0002, dt);
      pf.y = approach(pf.y, Ptr.y + 20, 0.0002, dt);
      if (pf.y < G.y + 30 && Math.abs(pf.x - G.x) < 150) G3.snap(pf, G.x, G.y - 6, 150, 0.5, dt);
      if (Math.abs(pf.x - G.x) < 30 && pf.y > G.y - 34 && pf.y < G.y + 26) {
        pf.phase = 'rot'; pf.x = G.x; pf.y = G.y; pf.z = G.z;
        pf.ang = A_UNLOCK; pf.ip = 0; pf.tickN = 0;
        const hp = [0, 0, 0];
        R3.rayPlaneY(Ptr.sx, Ptr.sy, G.y - 40, hp);
        pf.grabAng = Math.atan2(hp[0] - G.x, hp[2] - G.z) - A_UNLOCK;
        pf.held = true;
        Sfx.seat();
        G3.puff(G.x, G.y - 20, G.z, 5, null, 50, 5);
      }
    } else {
      pf.x = approach(pf.x, PF_LOCK_REST.x, 0.05, dt);
      pf.y = approach(pf.y, PF_LOCK_REST.y, 0.05, dt);
    }
    G3.hint = { type: 'drag', from: [pf.x + 40, pf.y - 30, pf.z], to: [G.x + 40, G.y - 20, G.z] };
  }
};

/* ============================================================= CUPSET ==== */
G3.scenes.cupset = {
  enter(s) {
    const st = LAY.stack;
    s.cup.x = st.x - 65; s.cup.y = st.y; s.cup.z = st.z - 60;
    s.cup.held = false; s.cup.placed = false;
  },
  update(s, dt) {
    const c = s.cup;
    if (s._placeT >= 0) { s._placeT += dt; if (s._placeT > 0.5) G3.nextStep(); return; }
    if (Ptr.justDown && G3.onScreen([c.x, c.y + 30, c.z], 0.30)) c.held = true;
    if (!Ptr.down && c.held) {
      c.held = false;
      if (Math.hypot(c.x - CUP.x, c.y - LAY.trayY) < 130) this.place(s);
    }
    if (c.held) {
      c.x = approach(c.x, Ptr.x, 0.0001, dt);
      c.y = approach(c.y, Ptr.y - 30, 0.0001, dt);
      c.z = approach(c.z, CUP.z, 0.01, dt);
      const o = { x: c.x, y: c.y };
      if (G3.snap(o, CUP.x, LAY.trayY, 150, 0.6, dt)) { c.x = o.x; c.y = o.y; }
      if (Math.hypot(c.x - CUP.x, c.y - LAY.trayY) < 14) this.place(s);
    }
    if (!c.placed) G3.hint = { type: 'drag', from: [c.x, c.y, c.z], to: [CUP.x, LAY.trayY + 40, CUP.z] };
  },
  place(s) {
    const c = s.cup;
    c.held = false; c.placed = true;
    c.x = CUP.x; c.y = LAY.trayY; c.z = CUP.z;
    if (DRINKS[s.drink].cocoa) c.cocoa = 1;
    s._placeT = 0;
    Sfx.cupPlace();
    G3.puff(c.x, c.y + 10, c.z, 5, null, 40, 6);
  }
};

/* ============================================================ EXTRACT ==== */
G3.scenes.extract = {
  enter(s) { s.brew = { t: 0, on: false, done: false, pressure: 0 }; s.paddle = { a: 0, held: false, latched: false }; },
  update(s, dt) {
    const pd = s.paddle, br = s.brew, c = s.cup;
    const B = Scene.named.paddleBase;
    const knobY = () => B[1] - 96 * Math.cos(pd.a) + 0;
    if (!pd.latched) {
      if (Ptr.justDown && G3.onScreen([B[0], knobY(), B[2] + 20], 0.30)) pd.held = true;
      if (!Ptr.down) pd.held = false;
      if (pd.held) {
        const dy = (B[1] - 96) - Ptr.y;      // how far below the rest position
        pd.a = clamp(dy * 0.011, -0.1, 1.15);
        if (pd.a >= 0.75) {
          pd.latched = true; pd.held = false; br.on = true;
          Sfx.blip(320, 0.09, 'square', 0.2);
          Sfx.pumpStart();
        }
      } else pd.a = approach(pd.a, 0, 0.004, dt);
    } else pd.a = approach(pd.a, 1.15, 0.002, dt);

    if (br.on) {
      br.t += dt;
      br.pressure = smoothstep(0, 0.9, br.t) * (1 - smoothstep(4.6, 5.4, br.t));
      if (br.t > 1.0) {
        const flow = smoothstep(1.0, 1.7, br.t) * (1 - smoothstep(4.6, 5.2, br.t));
        c.espresso = Math.min(1, c.espresso + dt * flow * 0.30);
        c.crema = Math.min(1, c.crema + dt * flow * 0.42);
        s.pf.wet = true;
        if (!Sfx.loops.drip && flow > 0.15) Sfx.dripStart();
        Sfx.dripSet(c.espresso);
        if (flow > 0.2 && Math.random() < flow * 0.5) {
          const g = G3.surfaceGeo(c);
          R3.parts.add({ x: c.x + rnd(-10, 10), y: c.y + g.y + 3, z: c.z + rnd(-10, 10),
                         vx: rnd(-30, 30), vy: rnd(30, 90), vz: rnd(-20, 20), g: -1600,
                         drag: 0.94, life: 0.3, size: 3, size1: 1, a0: 0.5 });
        }
      }
      if (c.espresso >= 1 || br.t > 5.4) {
        br.on = false; br.done = true; br.pressure = 0; pd.latched = false;
        Sfx.pumpStop(); Sfx.dripStop(); Sfx.sparkle(4, 620);
        G3.sparkle(c.x, c.y + 90, c.z, 10);
        s.flash = 0.3; s._after = 0;
      }
    }
    if (br.done) {
      pd.a = approach(pd.a, 0, 0.004, dt);
      s._after += dt;
      if (s._after > 1.2) G3.nextStep();
    }
    if (!br.on && !br.done) {
      G3.hint = { type: 'press', from: [B[0], B[1] - 80, B[2] + 40], to: [B[0], B[1] - 150, B[2] + 40] };
    }
  }
};

/* ============================================================== STEAM ==== */
G3.scenes.steam = {
  enter(s) {
    const p = s.pitcher;
    p.x = LAY.pitcherRest.x; p.y = LAY.counterY; p.z = LAY.pitcherRest.z;
    p.milk = 0.5; p.foam = 0; p.swirl = 0; p.swirlSpd = 0;
    p.prog = 0; p.steaming = 0; p.done = false; p.rot = 0; p.tilt = 0; p.tiltZ = 0;
  },
  update(s, dt) {
    const p = s.pitcher, W = LAY.wand;
    const lvl = () => p.y + 12 + p.milk * 108;
    const idealX = W.tipX - 26, idealY = W.tipY - (12 + p.milk * 108) + 22;

    if (p.done) {
      p.steaming = approach(p.steaming, 0, 0.0005, dt);
      Sfx.steamStop();
      p.x = approach(p.x, LAY.pitcherRest.x, 0.004, dt);
      p.y = approach(p.y, LAY.counterY, 0.004, dt);
      p.tiltZ = approach(p.tiltZ, 0, 0.004, dt);
      p.swirlSpd = approach(p.swirlSpd, 0.15, 0.02, dt);
      p.swirl += p.swirlSpd * dt * 5;
      s._after += dt;
      if (s._after > 1.2) G3.nextStep();
      return;
    }

    if (Ptr.justDown && G3.onScreen([p.x, p.y + 70, p.z], 0.32)) p.held = true;
    if (!Ptr.down) p.held = false;
    if (p.held) {
      p.x = approach(p.x, Ptr.x, 0.0002, dt);
      p.y = approach(p.y, Ptr.y - 70, 0.0002, dt);
      p.z = approach(p.z, PLANE.steam.v, 0.01, dt);
      // strong auto-correction: a child can never get this wrong
      const d = Math.hypot(p.x - idealX, p.y - idealY);
      if (d < 220) {
        const k = (1 - d / 220) * 0.72;
        p.x = approach(p.x, idealX, 1 - k, dt);
        p.y = approach(p.y, idealY, 1 - k, dt);
      }
      p.tilt = clamp(p.tilt + Ptr.dx * 0.004, -1, 1);
    } else {
      p.tilt = approach(p.tilt, 0, 0.02, dt);
      if (p.prog < 0.02) {
        p.x = approach(p.x, LAY.pitcherRest.x, 0.02, dt);
        p.y = approach(p.y, LAY.counterY, 0.02, dt);
      }
    }
    p.tiltZ = approach(p.tiltZ, p.tilt * 0.16, 0.002, dt);

    const surfY = lvl();
    const depth = sat((surfY - W.tipY) / 26);
    const inside = Math.abs(W.tipX - p.x) < 70 && W.tipY < surfY + 40 && W.tipY > surfY - 70;
    p.steaming = approach(p.steaming, inside ? 1 : 0, 0.0008, dt);

    if (p.steaming > 0.08) {
      if (!Sfx.loops.steam) Sfx.steamStart();
      Sfx.steamSet(p.steaming, depth);
      const stretch = (1 - Math.abs(depth - 0.28) * 1.8) * p.steaming;
      p.foam = Math.min(DRINKS[s.drink].foamMax, p.foam + Math.max(0, stretch) * dt * 0.42);
      p.milk = Math.min(0.92, p.milk + Math.max(0, stretch) * dt * 0.13);
      p.swirlSpd = approach(p.swirlSpd, 0.5 + Math.abs(p.tilt) * 0.6 + depth * 0.3, 0.02, dt);
      p.prog = Math.min(1, p.prog + dt * 0.20 * (0.6 + p.steaming * 0.4));
      p.chirrT -= dt;
      if (p.chirrT <= 0) { p.chirrT = rnd(0.03, 0.13); Sfx.chirr(); }
      s._puff += dt;
      while (s._puff > 0.028) {
        s._puff -= 0.028;
        R3.parts.add({ x: W.tipX + rnd(-18, 18), y: surfY + rnd(-4, 10), z: p.z + rnd(-18, 18),
                       vx: rnd(-70, 70), vy: rnd(120, 260), vz: rnd(-50, 50), g: 40, drag: 0.975,
                       life: rnd(0.7, 1.4), size: 18, size1: 90, a0: 0.30 });
      }
    } else {
      Sfx.steamStop();
      p.swirlSpd = approach(p.swirlSpd, 0.08, 0.06, dt);
    }
    p.swirl += p.swirlSpd * dt * 6;

    if (p.prog >= 1) {
      p.done = true; p.steaming = 0;
      Sfx.steamStop(); Sfx.cupPlace(); Sfx.sparkle(4, 700);
      G3.sparkle(p.x, p.y + 170, p.z, 14);
      s.flash = 0.35; s._after = 0;
    }
    if (p.steaming < 0.3) {
      G3.hint = { type: 'drag', from: [p.x, p.y + 70, p.z], to: [idealX, idealY + 70, PLANE.steam.v] };
    }
    G3.ring = p.prog > 0.01 && !p.done ? { p: [p.x, p.y + 190, p.z], v: p.prog } : null;
  }
};

/* ======================================================= POUR / LATTE ART = */
const Pour = {
  enter(s) {
    const p = s.pitcher;
    p.rot = -0.2; p.tiltZ = 0.2;
    s.cup.x = POUR_SPOT.x; s.cup.z = POUR_SPOT.z;
    const g = G3.surfaceGeo(s.cup);
    p.x = s.cup.x - 150; p.y = s.cup.y + g.y + 120; p.z = s.cup.z + 30;
    s.pour.done = false; s.pour.doneT = 0; s.pour.flow = 0;
    s.pour.wiggles = 0; s.pour.lastDir = 0; s.pour.upRun = 0; s.pour.everPoured = false;
    s.cup.art = true;
    if (s.freeMode) { p.milk = 1; p.foam = 0.6; }
  },
  baseKind(s) { return s.freeMode ? 'crema' : DRINKS[s.drink].base; },

  update(s, dt) {
    const c = s.cup, p = s.pitcher, P = s.pour;
    const g = G3.surfaceGeo(c);
    const surfY = c.y + g.y;

    if (P.done) {
      P.doneT += dt;
      P.flow = Math.max(0, P.flow - dt * 4);
      Fluid.step(dt);
      p.tiltZ = approach(p.tiltZ, 0.15, 0.004, dt);
      p.x = approach(p.x, c.x + 210, 0.004, dt);
      p.y = approach(p.y, surfY + 150, 0.004, dt);
      Sfx.pourStop();
      if (P.doneT > 1.6 && !s.freeMode) {
        c.surface = Fluid.snapshotTex(Pour.baseKind(s));
        G3.nextStep();
      }
      G3.uploadFluid(Pour.baseKind(s));
      return;
    }

    // the finger is the pour point on the surface
    let tx = Ptr.x, tz = Ptr.y;
    if (Ptr.down) {
      const du = (tx - c.x) / g.r, dv = (tz - c.z) / g.r;
      const rr = Math.hypot(du, dv);
      if (rr > 1.1) { tx = c.x + du / rr * 1.1 * g.r; tz = c.z + dv / rr * 1.1 * g.r; }
      P.flow = Math.min(1, P.flow + dt * 2.4);
    } else {
      P.flow = Math.max(0, P.flow - dt * 3.4);
      tx = c.x - 20; tz = c.z;
    }

    // pitcher tips further as the flow builds, spout hovering over the pour point
    p.tiltZ = approach(p.tiltZ, 0.22 + P.flow * 0.55, 0.0009, dt);
    p.rot = approach(p.rot, -0.20, 0.004, dt);
    const off = Pour.spoutOffset(p);
    p.x = approach(p.x, tx + 26 - off[0], 0.0004, dt);
    p.y = approach(p.y, surfY + 92 - off[1], 0.0004, dt);
    p.z = approach(p.z, tz + 16 - off[2], 0.0004, dt);

    if (P.flow > 0.05) {
      const su = (tx - c.x) / (g.r * 2) + 0.5;
      const sv = (tz - c.z) / (g.r * 2) + 0.5;
      P.px = su; P.py = sv;
      const vx = Ptr.dx / (g.r * 2) / Math.max(dt, 1e-3);
      const vy = Ptr.dy / (g.r * 2) / Math.max(dt, 1e-3);
      Fluid.pour(clamp(su, 0.06, 0.94), clamp(sv, 0.06, 0.94), P.flow,
                 clamp(vx, -3, 3), clamp(vy, -3, 3), dt);
      P.poured += dt * P.flow;
      P.everPoured = true;
      p.milk = Math.max(0.18, p.milk - dt * P.flow * 0.055);
      c.milk = Math.min(1, c.milk + dt * P.flow * 0.30);
      c.foam = Math.max(c.foam, p.foam * sat(c.milk * 1.6));
      if (!Sfx.loops.pour) Sfx.pourStart();
      Sfx.pourSet(P.flow * (0.4 + Math.min(1, Math.abs(Ptr.vx) / 260) * 0.6));
    } else Sfx.pourStop();

    if (Ptr.down && P.everPoured) {
      const dir = Ptr.dx > 1.2 ? 1 : Ptr.dx < -1.2 ? -1 : 0;
      if (dir !== 0) {
        if (P.lastDir !== 0 && dir !== P.lastDir) P.wiggles++;
        P.lastDir = dir;
      }
      // pulling through toward the far side (-z) finishes the picture
      if (Math.abs(Ptr.dx) < Math.abs(Ptr.dy) * 0.9 && Ptr.dy < -0.15) {
        P.upRun += -Ptr.dy / (g.r * 2);
      } else if (Ptr.dy > 0.4) P.upRun *= 0.55;
      if (P.upRun > 0.42 && P.poured > 0.30) Pour.finish(s);
      if (P.poured > 14) Pour.finish(s);
      P.idleAfter = 0;
    } else if (!Ptr.down && P.everPoured) {
      P.idleAfter += dt;
      if (P.idleAfter > 3.2 && P.poured > 0.25) Pour.finish(s);
    }

    Fluid.step(dt);
    G3.uploadFluid(Pour.baseKind(s));
    if (!P.everPoured) G3.hint = { type: 'circle', p: [c.x, surfY + 4, c.z], r: g.r * 0.8 };
    else if (P.poured > 0.30) G3.hint = { type: 'pull', p: [c.x, surfY + 4, c.z], r: g.r };
  },

  spoutOffset(p) {
    const m = M4.compose(M4.make(), 0, 0, 0, p.tiltZ * 0.35, p.rot, p.tiltZ, 1, 1, 1);
    const o = V3.make();
    M4.xformDir(o, m, [-74, 128, 0]);
    return o;
  },

  finish(s) {
    const P = s.pour;
    if (P.done) return;
    P.done = true; P.doneT = 0;
    P.pattern = P.wiggles >= 5 ? 'leaf' : (P.wiggles >= 2 ? 'tulip' : 'heart');
    Fluid.strokeThrough(clamp(P.px, 0.1, 0.9), 0.86, clamp(P.px, 0.1, 0.9), 0.16, 1);
    Fluid.finish(P.pattern, 0);
    Sfx.pourStop(); Sfx.sparkle(6, 700); Sfx.drop(1300);
    s.flash = 0.45;
    const g = G3.surfaceGeo(s.cup);
    G3.sparkle(s.cup.x, s.cup.y + g.y + 40, s.cup.z, 22);
  }
};
G3.scenes.pour = Pour;
G3.scenes.free = {
  enter(s) {
    Pour.enter(s);
    s.cup.espresso = 1; s.cup.crema = 1; s.cup.milk = 0;
    s.pitcher.milk = 1; s.pitcher.foam = 0.65;
  },
  update(s, dt) {
    Pour.update(s, dt);
    if (s.pour.done && s.pour.doneT > 2.4) {
      // tap anywhere to start a fresh canvas
      if (Ptr.justDown) {
        Sfx.blip(820, 0.1, 'sine', 0.25); Sfx.cupPlace();
        Fluid.reset();
        Object.assign(s.pour, { flow: 0, poured: 0, wiggles: 0, lastDir: 0, upRun: 0,
                                done: false, doneT: 0, everPoured: false, idleAfter: 0 });
        s.pitcher.milk = 1; s.cup.milk = 0;
      }
      G3.hint = { type: 'tap', p: [s.cup.x, s.cup.y + 90, s.cup.z] };
    }
  }
};

/* ============================================================== SERVE ==== */
G3.scenes.serve = {
  enter(s) {
    s.cup.held = false; s.serveDone = false;
    s.cup.y = LAY.trayY;
  },
  update(s, dt) {
    const c = s.cup;
    const n = s.tray.length;
    const TX = LAY.serve.x, TZ = LAY.serve.z;
    if (s.serveDone) {
      s.sparkleT += dt;
      if (s.sparkleT > 1.4) G3.setStep('menu');
      return;
    }
    if (Ptr.justDown && G3.onScreen([c.x, c.y + 40, c.z], 0.32)) c.held = true;
    if (!Ptr.down && c.held) {
      c.held = false;
      if (Math.hypot(c.x - TX, c.z - TZ) < 260) this.drop(s, TX, TZ);
    }
    if (c.held) {
      c.x = approach(c.x, Ptr.x, 0.0001, dt);
      c.z = approach(c.z, Ptr.y, 0.0001, dt);
      c.y = approach(c.y, LAY.counterY + 40, 0.004, dt);
      const o = { x: c.x, y: c.z };
      if (G3.snap(o, TX, TZ, 240, 0.5, dt)) { c.x = o.x; c.z = o.y; }
      if (Math.hypot(c.x - TX, c.z - TZ) < 20) this.drop(s, TX, TZ);
    } else if (!s.serveDone) {
      c.x = approach(c.x, POUR_SPOT.x, 0.02, dt);
      c.z = approach(c.z, POUR_SPOT.z, 0.02, dt);
      c.y = approach(c.y, LAY.trayY, 0.02, dt);
    }
    G3.hint = { type: 'drag', from: [c.x, c.y + 60, c.z], to: [TX, LAY.counterY + 80, TZ] };
  },
  drop(s, TX, TZ) {
    const c = s.cup;
    c.held = false; s.serveDone = true; s.sparkleT = 0;
    s.tray.push({ espresso: c.espresso, milk: c.milk, cocoa: c.cocoa, foam: c.foam, tex: c.surface });
    if (s.tray.length > 5) s.tray.shift();
    Sfx.cupPlace(); Sfx.sparkle(6, 660);
    s.flash = 0.35;
    G3.sparkle(TX, LAY.counterY + 90, TZ, 24);
  }
};

/* ------------------------------------------------- fluid → GPU each frame */
G3.uploadFluid = function (kind) {
  const cv = Fluid.render(kind);
  GLX.updateDynamic(Scene.latteTex, cv);
  Scene.named.drink.material.extra = Scene.latteTex;
};
Fluid.snapshotTex = function (kind) {
  const src = this.render(kind);
  const c = document.createElement('canvas');
  c.width = c.height = this.N;
  c.getContext('2d').drawImage(src, 0, 0);
  const t = GLX.texDynamic(this.N, this.N);
  GLX.updateDynamic(t, c);
  return t;
};
