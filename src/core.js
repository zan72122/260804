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

/* --------------------------------------------------------------- pointer */
/* One finger only.  Raw screen pixels are kept here; the game turns them into
   world points by intersecting the camera ray with an interaction plane.     */
const Ptr = {
  down: false, justDown: false, justUp: false,
  sx: 0, sy: 0, psx: 0, psy: 0, dsx: 0, dsy: 0,   // screen space
  x: 0, y: 0, z: 0, px: 0, py: 0, dx: 0, dy: 0,   // world, on the active plane
  vx: 0, vy: 0, travel: 0, downT: 0,
  id: null, _q: [], _rawX: 0, _rawY: 0,
  begin(x, y) { this._q.push({ type: 'down', x, y }); },
  move(x, y) { this._rawX = x; this._rawY = y; },
  end() { this._q.push({ type: 'up' }); },

  /** step 1: consume one queued event and update screen-space state */
  sync(t, dt) {
    this.justDown = false; this.justUp = false;
    const ev = this._q.length ? this._q.shift() : null;
    this.psx = this.sx; this.psy = this.sy;
    if (ev && ev.type === 'down') {
      this.sx = this.psx = this._rawX = ev.x;
      this.sy = this.psy = this._rawY = ev.y;
      this.down = true; this.justDown = true;
      this.downT = t; this.travel = 0;
      this.dsx = this.dsy = 0; this.vx = this.vy = 0;
      return;
    }
    if (ev && ev.type === 'up') { this.down = false; this.justUp = true; }
    this.sx = this._rawX; this.sy = this._rawY;
    this.dsx = this.sx - this.psx; this.dsy = this.sy - this.psy;
  },

  /** step 2: project onto the interaction plane the current step cares about */
  place(plane, dt) {
    const p = [0, 0, 0];
    if (plane.axis === 'y') R3.rayPlaneY(this.sx, this.sy, plane.v, p);
    else R3.rayPlaneZ(this.sx, this.sy, plane.v, p);
    if (this.justDown) { this.px = p[0]; this.py = (plane.axis === 'y' ? p[2] : p[1]); }
    else { this.px = this.x; this.py = this.y; }
    this.x = p[0];
    this.y = plane.axis === 'y' ? p[2] : p[1];
    this.z = plane.axis === 'y' ? plane.v : p[2];
    this.dx = this.x - this.px; this.dy = this.y - this.py;
    if (this.down) this.travel += Math.hypot(this.dx, this.dy);
    const k = dt > 0 ? 1 / dt : 0;
    this.vx = lerp(this.vx, this.dx * k, 0.35);
    this.vy = lerp(this.vy, this.dy * k, 0.35);
  },
  speed() { return Math.hypot(this.vx, this.vy); }
};

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
