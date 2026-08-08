/* =========================================================================
   core.js — math helpers, camera, pointer input, synthesized sound engine
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = lerp;
const inv = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));
const sat = v => clamp(v, 0, 1);
const smoothstep = (e0, e1, x) => { const t = sat((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInCubic = t => t * t * t;
const easeOutBack = (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const easeOutElastic = t => t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * 2.1) + 1;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const deg = d => d * Math.PI / 180;
/** shortest signed angular difference b-a, wrapped to [-PI,PI] */
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
/** frame-rate independent exponential approach; rate = fraction remaining after 1s */
const approach = (cur, target, rate, dt) => target + (cur - target) * Math.pow(rate, dt * 60);

/* ---------------------------------------------------------------- camera */
/* One shared "world" (see game.js WORLD). The camera maps world -> screen so
   that portrait can zoom onto the hands while landscape shows the counter.  */
const Cam = {
  x: 500, y: 340, scale: 1,          // current (eased)
  tx: 500, ty: 340, tscale: 1,       // target
  shake: 0, sx: 0, sy: 0,
  snap() { this.x = this.tx; this.y = this.ty; this.scale = this.tscale; },
  update(dt) {
    this.x = approach(this.x, this.tx, 0.0005, dt);
    this.y = approach(this.y, this.ty, 0.0005, dt);
    this.scale = approach(this.scale, this.tscale, 0.0005, dt);
    if (this.shake > 0.001) {
      this.shake *= Math.pow(0.02, dt);
      this.sx = rnd(-1, 1) * this.shake;
      this.sy = rnd(-1, 1) * this.shake;
    } else { this.shake = 0; this.sx = this.sy = 0; }
  },
  kick(a) { this.shake = Math.max(this.shake, a); },
  dpr: 1,
  /** apply transform: after this, ctx draws in world units */
  apply(ctx, W, H) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(W / 2 + this.sx, H / 2 + this.sy);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.x, -this.y);
  },
  toWorld(px, py, W, H) {
    return { x: (px - W / 2 - this.sx) / this.scale + this.x,
             y: (py - H / 2 - this.sy) / this.scale + this.y };
  }
};

/* --------------------------------------------------------------- pointer */
/* Single-finger model: we only ever track the first active pointer.        */
const Ptr = {
  down: false, justDown: false, justUp: false,
  x: 0, y: 0, px: 0, py: 0,       // world coords, current & previous frame
  dx: 0, dy: 0,                    // world delta this frame
  vx: 0, vy: 0,                    // smoothed world velocity (units/sec)
  downX: 0, downY: 0, downT: 0,
  travel: 0,                       // total path length since press
  id: null,
  _rawX: 0, _rawY: 0, _q: [],
  // Events are queued, never overwritten: a tap whose press and release land in
  // the same frame must still produce one justDown frame and one justUp frame.
  begin(x, y) { this._q.push({ type: 'down', x, y }); },
  move(x, y) { this._rawX = x; this._rawY = y; },
  end() { this._q.push({ type: 'up' }); },
  /** called once per frame before scene update */
  sync(W, H, t, dt) {
    this.justDown = false; this.justUp = false;
    const ev = this._q.length ? this._q.shift() : null;
    if (ev && ev.type === 'down') {
      const w = Cam.toWorld(ev.x, ev.y, W, H);
      this.x = this.px = w.x; this.y = this.py = w.y;
      this._rawX = ev.x; this._rawY = ev.y;
      this.down = true; this.justDown = true;
      this.downX = w.x; this.downY = w.y; this.downT = t;
      this.travel = 0; this.vx = this.vy = 0;
      this.dx = this.dy = 0;
      return;
    }
    if (ev && ev.type === 'up') {
      this.down = false; this.justUp = true;
    }
    this.px = this.x; this.py = this.y;
    const w = Cam.toWorld(this._rawX, this._rawY, W, H);
    this.x = w.x; this.y = w.y;
    this.dx = this.x - this.px; this.dy = this.y - this.py;
    if (this.down) this.travel += Math.hypot(this.dx, this.dy);
    const k = dt > 0 ? 1 / dt : 0;
    this.vx = lerp(this.vx, this.dx * k, 0.35);
    this.vy = lerp(this.vy, this.dy * k, 0.35);
  },
  speed() { return Math.hypot(this.vx, this.vy); }
};

/* ------------------------------------------------------------- particles */
class Particles {
  constructor(max = 700) { this.p = []; this.max = max; }
  add(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 1, age: 0, r: 3, r1: null,
      col: '#fff', kind: 'dot', rot: 0, vrot: 0, drag: 1, a0: 1
    }, o));
  }
  update(dt) {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.age += dt;
      if (q.age >= q.life) { this.p.splice(i, 1); continue; }
      q.vy += q.g * dt;
      if (q.drag !== 1) { const d = Math.pow(q.drag, dt * 60); q.vx *= d; q.vy *= d; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.rot += q.vrot * dt;
      if (q.onStep) q.onStep(q, dt);
    }
  }
  clear() { this.p.length = 0; }
  draw(ctx) {
    for (const q of this.p) {
      const t = q.age / q.life;
      const a = q.a0 * (1 - t * t);
      ctx.globalAlpha = a;
      const r = q.r1 === null ? q.r : lerp(q.r, q.r1, t);
      ctx.save();
      if (q.kind === 'dot') {
        ctx.fillStyle = q.col;
        ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.2, r), 0, TAU); ctx.fill();
      } else if (q.kind === 'star') {
        ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.fillStyle = q.col; Art.starPath(ctx, 0, 0, r, r * 0.45, 5); ctx.fill();
      } else if (q.kind === 'heart') {
        ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.fillStyle = q.col; Art.heartPath(ctx, 0, 0, r * 2); ctx.fill();
      } else if (q.kind === 'ring') {
        ctx.strokeStyle = q.col; ctx.lineWidth = Math.max(0.5, r * 0.22);
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.stroke();
      } else if (q.kind === 'puff') {
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
        g.addColorStop(0, q.col); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

/* ------------------------------------------------------------------ sfx */
/* Everything is synthesized with WebAudio — zero asset loading, so sounds
   stay perfectly in sync with the gesture that causes them.                */
const Sfx = {
  ctx: null, master: null, noiseBuf: null, ready: false, muted: false,
  loops: {},
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.85;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    this.master.connect(comp); comp.connect(c.destination);
    // 2 s of noise, reused by every noisy voice
    const len = Math.floor(c.sampleRate * 2);
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ready = true;
  },
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); },
  get t() { return this.ctx ? this.ctx.currentTime : 0; },
  _noise(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = loop;
    s.playbackRate.value = rnd(0.9, 1.1);
    return s;
  },
  _gain(v = 0) { const g = this.ctx.createGain(); g.gain.value = v; return g; },
  _filt(type, f, q) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; },
  _osc(type, f) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; },

  /* ---- one-shots ---- */
  blip(f = 700, dur = 0.09, type = 'sine', vol = 0.3) {
    if (!this.ready) return; const t = this.t, c = this.ctx;
    const o = this._osc(type, f), g = this._gain(0);
    o.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.frequency.exponentialRampToValueAtTime(f * 0.92, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  },
  /** "トン" — tamper meeting the coffee bed: soft wood-on-puck thud */
  tamp(power = 1) {
    if (!this.ready) return; const t = this.t;
    const o = this._osc('sine', 138), g = this._gain(0);
    o.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55 * power, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(72, t + 0.16);
    o.start(t); o.stop(t + 0.3);
    // dry knock body
    const n = this._noise(false), nf = this._filt('lowpass', 900, 1.1), ng = this._gain(0);
    n.connect(nf); nf.connect(ng); ng.connect(this.master);
    ng.gain.setValueAtTime(0.35 * power, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.start(t); n.stop(t + 0.12);
  },
  /** "カチッ" — the portafilter seating hard into the group head */
  clack() {
    if (!this.ready) return; const t = this.t;
    // bright metallic transient
    const n = this._noise(false), bp = this._filt('bandpass', 3100, 3.5), g = this._gain(0);
    n.connect(bp); bp.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0.75, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    n.start(t); n.stop(t + 0.08);
    // metal body ring
    [1180, 2360, 3550].forEach((f, i) => {
      const o = this._osc('triangle', f), og = this._gain(0);
      o.connect(og); og.connect(this.master);
      og.gain.setValueAtTime(0.22 / (i + 1), t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14 - i * 0.03);
      o.start(t); o.stop(t + 0.18);
    });
    // low seating thunk
    const o2 = this._osc('sine', 150), g2 = this._gain(0);
    o2.connect(g2); g2.connect(this.master);
    g2.gain.setValueAtTime(0.4, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o2.frequency.exponentialRampToValueAtTime(80, t + 0.1);
    o2.start(t); o2.stop(t + 0.15);
  },
  /** softer "コッ" — portafilter slipping up into the groove */
  seat() {
    if (!this.ready) return; const t = this.t;
    const n = this._noise(false), bp = this._filt('bandpass', 1500, 2.2), g = this._gain(0);
    n.connect(bp); bp.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0.34, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.start(t); n.stop(t + 0.09);
    const o = this._osc('sine', 240), og = this._gain(0.22);
    o.connect(og); og.connect(this.master);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.start(t); o.stop(t + 0.13);
  },
  /** ratchet tick while the portafilter rotates */
  tick(pitch = 1, vol = 0.16) {
    if (!this.ready) return; const t = this.t;
    const n = this._noise(false), bp = this._filt('bandpass', 2600 * pitch, 6), g = this._gain(0);
    n.connect(bp); bp.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.start(t); n.stop(t + 0.05);
  },
  /** "コトン" — cup set down on the tray */
  cupPlace() {
    if (!this.ready) return; const t = this.t;
    const o = this._osc('sine', 420), g = this._gain(0);
    o.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(215, t + 0.13);
    o.start(t); o.stop(t + 0.24);
    const n = this._noise(false), lp = this._filt('lowpass', 1600), ng = this._gain(0.3);
    n.connect(lp); lp.connect(ng); ng.connect(this.master);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.start(t); n.stop(t + 0.09);
  },
  /** tiny milk droplet plink */
  drop(f = 1500) {
    if (!this.ready) return; const t = this.t;
    const o = this._osc('sine', f), g = this._gain(0);
    o.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.09);
    o.start(t); o.stop(t + 0.12);
  },
  /** "チリチリ" — fine milk texture crackle while stretching */
  chirr() {
    if (!this.ready) return; const t = this.t;
    const n = this._noise(false), bp = this._filt('bandpass', rnd(3800, 6200), 9), g = this._gain(0);
    n.connect(bp); bp.connect(g); g.connect(this.master);
    g.gain.setValueAtTime(rnd(0.05, 0.13), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rnd(0.03, 0.08));
    n.start(t); n.stop(t + 0.12);
  },
  sparkle(n = 5, base = 660) {
    if (!this.ready) return; const t0 = this.t;
    const scale = [0, 2, 4, 7, 9, 12, 16];
    for (let i = 0; i < n; i++) {
      const f = base * Math.pow(2, scale[i % scale.length] / 12);
      const t = t0 + i * 0.075;
      const o = this._osc('sine', f), g = this._gain(0);
      const o2 = this._osc('sine', f * 2.01), g2 = this._gain(0);
      o.connect(g); g.connect(this.master); o2.connect(g2); g2.connect(this.master);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.24, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(0.09, t + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.start(t); o.stop(t + 0.55); o2.start(t); o2.stop(t + 0.4);
    }
  },

  /* ---- loops ---- */
  _stopLoop(key, fade = 0.12) {
    const L = this.loops[key]; if (!L) return;
    const t = this.t;
    try {
      L.gain.gain.cancelScheduledValues(t);
      L.gain.gain.setValueAtTime(Math.max(L.gain.gain.value, 0.0001), t);
      L.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      L.nodes.forEach(n => { try { n.stop(t + fade + 0.05); } catch (e) {} });
    } catch (e) {}
    delete this.loops[key];
  },
  /** グラインダー — burr grinder: motor rumble + bean crunch */
  grindStart() {
    if (!this.ready || this.loops.grind) return;
    const c = this.ctx, t = this.t;
    const out = this._gain(0); out.connect(this.master);
    const n = this._noise(), bp = this._filt('bandpass', 1150, 1.1), hp = this._filt('highpass', 320);
    const ng = this._gain(0.5);
    n.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(out);
    const mot = this._osc('sawtooth', 96), mlp = this._filt('lowpass', 260), mg = this._gain(0.16);
    mot.connect(mlp); mlp.connect(mg); mg.connect(out);
    const lfo = this._osc('sine', 17), lg = this._gain(340);
    lfo.connect(lg); lg.connect(bp.frequency);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.34, t + 0.05);
    [n, mot, lfo].forEach(x => x.start(t));
    this.loops.grind = { gain: out, nodes: [n, mot, lfo] };
  },
  grindStop() { this._stopLoop('grind', 0.1); },

  /** 抽出機の低い機械音 — vibration pump */
  pumpStart() {
    if (!this.ready || this.loops.pump) return;
    const t = this.t;
    const out = this._gain(0); out.connect(this.master);
    const o = this._osc('sawtooth', 51), lp = this._filt('lowpass', 300, 3), g = this._gain(0.5);
    o.connect(lp); lp.connect(g); g.connect(out);
    const o2 = this._osc('square', 102), lp2 = this._filt('lowpass', 420), g2 = this._gain(0.12);
    o2.connect(lp2); lp2.connect(g2); g2.connect(out);
    const n = this._noise(), nf = this._filt('bandpass', 480, 2), ng = this._gain(0.1);
    n.connect(nf); nf.connect(ng); ng.connect(out);
    const lfo = this._osc('sine', 12.5), lg = this._gain(0.35 * 0.5);
    lfo.connect(lg); lg.connect(g.gain);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.3, t + 0.12);
    [o, o2, n, lfo].forEach(x => x.start(t));
    this.loops.pump = { gain: out, nodes: [o, o2, n, lfo] };
  },
  pumpStop() { this._stopLoop('pump', 0.25); },

  /** エスプレッソがカップへ落ちる — thin stream hitting liquid */
  dripStart() {
    if (!this.ready || this.loops.drip) return;
    const t = this.t;
    const out = this._gain(0); out.connect(this.master);
    const n = this._noise(), bp = this._filt('bandpass', 2100, 1.6), g = this._gain(0.5);
    n.connect(bp); bp.connect(g); g.connect(out);
    const res = this._filt('bandpass', 620, 9), rg = this._gain(0.35);
    const n2 = this._noise(); n2.connect(res); res.connect(rg); rg.connect(out);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.15, t + 0.2);
    [n, n2].forEach(x => x.start(t));
    this.loops.drip = { gain: out, nodes: [n, n2], res };
  },
  /** as the cup fills, the resonance rises in pitch — real espresso does this */
  dripSet(fill) {
    const L = this.loops.drip; if (!L) return;
    try { L.res.frequency.setTargetAtTime(560 + fill * 700, this.t, 0.15); } catch (e) {}
  },
  dripStop() { this._stopLoop('drip', 0.2); },

  /** スチームの「シューーー」 */
  steamStart() {
    if (!this.ready || this.loops.steam) return;
    const t = this.t;
    const out = this._gain(0); out.connect(this.master);
    const n = this._noise(), hp = this._filt('highpass', 900), bp = this._filt('bandpass', 2600, 0.8);
    const g = this._gain(0.6);
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(out);
    const n2 = this._noise(), lp2 = this._filt('lowpass', 700), g2 = this._gain(0.22);
    n2.connect(lp2); lp2.connect(g2); g2.connect(out);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.2, t + 0.09);
    [n, n2].forEach(x => x.start(t));
    this.loops.steam = { gain: out, nodes: [n, n2], bp, out };
  },
  /** depth 0 = tip in the air (airy screech), 1 = deep in the milk (muffled roar) */
  steamSet(vol, depth) {
    const L = this.loops.steam; if (!L) return;
    try {
      L.out.gain.setTargetAtTime(Math.max(0.0001, vol * 0.3), this.t, 0.08);
      L.bp.frequency.setTargetAtTime(lerp(3400, 1250, sat(depth)), this.t, 0.12);
    } catch (e) {}
  },
  steamStop() { this._stopLoop('steam', 0.18); },

  /** ミルクを注ぐ音 */
  pourStart() {
    if (!this.ready || this.loops.pour) return;
    const t = this.t;
    const out = this._gain(0); out.connect(this.master);
    const n = this._noise(), bp = this._filt('bandpass', 1250, 1.2), g = this._gain(0.5);
    n.connect(bp); bp.connect(g); g.connect(out);
    const res = this._filt('bandpass', 380, 7), rg = this._gain(0.4), n2 = this._noise();
    n2.connect(res); res.connect(rg); rg.connect(out);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.17, t + 0.12);
    [n, n2].forEach(x => x.start(t));
    this.loops.pour = { gain: out, nodes: [n, n2], res, out };
  },
  pourSet(rate) {
    const L = this.loops.pour; if (!L) return;
    try {
      L.out.gain.setTargetAtTime(Math.max(0.0001, 0.06 + rate * 0.15), this.t, 0.06);
      L.res.frequency.setTargetAtTime(340 + rate * 420, this.t, 0.1);
    } catch (e) {}
  },
  pourStop() { this._stopLoop('pour', 0.14); },

  stopAll() { Object.keys(this.loops).forEach(k => this._stopLoop(k, 0.05)); }
};
