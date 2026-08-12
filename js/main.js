'use strict';
(function (PPG) {
  const U = PPG.util;
  const C = PPG.crayon;
  const FL = PPG.flower;
  const SND = PPG.sound;

  const BLOOM_DUR = 1.7;
  const MAX_FLOWERS = 18;
  const GKEY = 'ppg.garden.v1';
  const TKEY = 'ppg.tut.v1';

  // ---------------- canvases ----------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const strokeCv = document.createElement('canvas'); // screen-space live stroke
  const strokeCtx = strokeCv.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  let T = 0, lastTs = 0;

  // ---------------- state ----------------
  const state = {
    mode: 'idle',              // idle | draw | pon | bloom
    colorId: 'pink',
    raw: [], sm: [],
    lastBaked: 0,
    strokeSeed: 1,
    activeId: null,
    ponSince: 0,
    ponHold: null,             // {t0}
    lastTick: 0,
    lastInput: 0,
    lastMoveT: 0, lastMoveP: null
  };

  let flowers = [];
  let blooms = [];             // in-progress bloom animations [{f,t0,last}]
  let gardenData = [];         // serializable source of truth (normalized)
  let butterflies = [];
  let ladybugs = [];
  const partsW = [];           // world-space particles
  const partsS = [];           // screen-space particles
  let glitterLive = [];
  let nextSlot = null;
  let lastSlotSparkle = 0;
  const rainbow = { on: false, t0: 0 };
  const cam = { cur: 1, holdUntil: 0 };
  const tut = { active: false, t0: 0, pts: null, slot: null };
  let lastAmbient = 0;
  let tutDone = false;

  // fps adaptation
  let emaDt = 1 / 60, lastQualityCheck = 0;

  function strokeWidth() { return U.clamp(Math.min(W, H) * 0.026, 8, 14); }
  function currentTheme() { return FL.theme(state.colorId); }

  // ---------------- camera ----------------
  function camTarget() {
    let t = U.clamp(1 - flowers.length * 0.012, 0.88, 1);
    if (T < cam.holdUntil) t *= 0.94;
    return t;
  }
  function camApply(c) {
    const px = W / 2, py = H * 0.62;
    c.translate(px, py);
    c.scale(cam.cur, cam.cur);
    c.translate(-px, -py);
  }
  function toWorld(x, y) {
    const px = W / 2, py = H * 0.62;
    return { x: (x - px) / cam.cur + px, y: (y - py) / cam.cur + py };
  }

  // ---------------- resize ----------------
  let resizeTimer = null;
  function doResize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.ceil(W * dpr);
    canvas.height = Math.ceil(H * dpr);
    strokeCv.width = canvas.width;
    strokeCv.height = canvas.height;
    strokeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    PPG.bg.rebuild(W, H, dpr);
    // abandon any in-progress stroke (rare: mid-draw rotation)
    cancelStroke(true);
    blooms = [];
    state.mode = 'idle';
    rebuildFlowers();
    ladybugs = [];
    for (const b of butterflies) { b.state = 'roam'; b.target = null; b.anchor = { x: b.x, y: b.y }; b.roamUntil = T + 2; }
    chooseNextSlot();
    if (tut.active) buildTutorial();
  }
  function scheduleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(doResize, 250);
  }

  // ---------------- persistence ----------------
  function save() {
    try {
      localStorage.setItem(GKEY, JSON.stringify(gardenData));
    } catch (e) { }
  }
  function recordOf(f) {
    const stride = Math.max(1, Math.floor(f.pts.length / 60));
    const p = [];
    for (let i = 0; i < f.pts.length; i += stride) {
      p.push([+(f.pts[i].x / W).toFixed(4), +(f.pts[i].y / H).toFixed(4)]);
    }
    const lp = f.pts[f.pts.length - 1];
    p.push([+(lp.x / W).toFixed(4), +(lp.y / H).toFixed(4)]);
    return { p, c: f.colorId, h: f.hold, s: f.seed, w: f.strokeW / Math.min(W, H) };
  }
  function flowerFromRecord(r) {
    const pts = r.p.map(q => ({ x: q[0] * W, y: q[1] * H }));
    const f = FL.create(pts, r.c, r.h || 0.3, (r.w || 0.026) * Math.min(W, H), r.s);
    FL.bake(f, dpr);
    return f;
  }
  function rebuildFlowers() {
    flowers = [];
    for (const r of gardenData) {
      try { flowers.push(flowerFromRecord(r)); } catch (e) { }
    }
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(GKEY) || '[]');
      if (Array.isArray(d)) gardenData = d.slice(0, MAX_FLOWERS);
    } catch (e) { gardenData = []; }
    try { tutDone = !!localStorage.getItem(TKEY); } catch (e) { }
  }

  // ---------------- particles ----------------
  function spawn(arr, p) {
    if (arr.length > 340 * PPG.quality.particleMul) return;
    arr.push(p);
  }
  function spark(arr, x, y, hue, opts) {
    const o = opts || {};
    spawn(arr, {
      kind: 'spark', x, y,
      vx: (Math.random() - 0.5) * (o.spread || 30),
      vy: (Math.random() - 0.5) * (o.spread || 30) - (o.up || 10),
      life: o.life || (0.5 + Math.random() * 0.6), age: 0,
      hue: hue == null ? 50 : hue,
      r: o.r || (1.2 + Math.random() * 1.6),
      tw: Math.random() * U.TAU
    });
  }
  function glow(arr, x, y, hue, r) {
    spawn(arr, { kind: 'glow', x, y, vx: 0, vy: 0, life: 0.5, age: 0, hue, r: r || 9 });
  }
  function pollen(x, y, hue) {
    spawn(partsW, {
      kind: 'pollen', x, y,
      vx: (Math.random() - 0.5) * 60,
      vy: -30 - Math.random() * 55,
      life: 1.2 + Math.random() * 1.2, age: 0,
      hue: hue == null ? 48 : hue,
      r: 1 + Math.random() * 1.6,
      ph: Math.random() * U.TAU
    });
  }
  function fluffSeed(x, y) {
    spawn(partsW, {
      kind: 'fluff', x, y,
      vx: 10 + Math.random() * 18, vy: -14 - Math.random() * 12,
      life: 3.5 + Math.random() * 2, age: 0, ph: Math.random() * U.TAU, r: 2.1
    });
  }
  function updateParticles(arr, dt) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.age += dt;
      if (p.age >= p.life) { arr.splice(i, 1); continue; }
      if (p.kind === 'pollen') {
        p.vy += 55 * dt;
        p.x += (p.vx + Math.sin(p.age * 6 + p.ph) * 16) * dt;
        p.y += p.vy * dt;
      } else if (p.kind === 'fluff') {
        p.x += (p.vx + Math.sin(p.age * 2.2 + p.ph) * 14) * dt;
        p.y += (p.vy + Math.sin(p.age * 3.1 + p.ph) * 6) * dt;
      } else if (p.kind === 'mote') {
        p.x += Math.sin(p.age * 1.4 + p.tw) * 8 * dt;
        p.y += p.vy * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= (1 - 1.6 * dt);
        p.vy *= (1 - 1.6 * dt);
      }
    }
  }
  function drawParticles(c, arr) {
    for (const p of arr) {
      const k = 1 - p.age / p.life;
      if (p.kind === 'spark') {
        const a = k * (0.5 + 0.5 * Math.abs(Math.sin(p.age * 9 + p.tw)));
        const r = p.r * (0.6 + 0.6 * k);
        c.strokeStyle = U.hsla(p.hue, 90, 82, a);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(p.x - r, p.y); c.lineTo(p.x + r, p.y);
        c.moveTo(p.x, p.y - r); c.lineTo(p.x, p.y + r);
        c.stroke();
        c.fillStyle = U.hsla(p.hue, 60, 92, a);
        c.beginPath(); c.arc(p.x, p.y, r * 0.35, 0, U.TAU); c.fill();
      } else if (p.kind === 'glow') {
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, U.hsla(p.hue, 85, 80, 0.35 * k));
        g.addColorStop(1, U.hsla(p.hue, 85, 80, 0));
        c.fillStyle = g;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, U.TAU); c.fill();
      } else if (p.kind === 'pollen') {
        c.fillStyle = U.hsla(p.hue, 95, 72, 0.85 * k);
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, U.TAU); c.fill();
      } else if (p.kind === 'fluff') {
        c.save();
        c.globalAlpha = Math.min(1, k * 2) * 0.8;
        c.strokeStyle = 'rgba(255,255,255,0.8)';
        c.lineWidth = 0.8;
        for (let a2 = 0; a2 < 6; a2++) {
          const aa = (a2 / 6) * U.TAU + p.ph;
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(p.x + Math.cos(aa) * p.r * 2, p.y + Math.sin(aa) * p.r * 2);
          c.stroke();
        }
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.beginPath(); c.arc(p.x, p.y, 1.1, 0, U.TAU); c.fill();
        c.restore();
      } else if (p.kind === 'mote') {
        const a = Math.sin(Math.min(1, p.age / p.life) * Math.PI) * 0.5;
        c.fillStyle = 'rgba(255,250,220,' + a.toFixed(3) + ')';
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, U.TAU); c.fill();
      } else if (p.kind === 'poof') {
        c.strokeStyle = 'rgba(255,255,255,' + (0.5 * k).toFixed(3) + ')';
        c.lineWidth = 2;
        c.beginPath(); c.arc(p.x, p.y, p.r * (1.2 - k), 0, U.TAU); c.stroke();
      }
    }
  }

  // ---------------- stroke capture ----------------
  function strokeOpts() {
    return { theme: currentTheme(), width: strokeWidth(), seed: state.strokeSeed, alpha: 1 };
  }
  function addRawPoint(x, y) {
    const raw = state.raw, sm = state.sm;
    const n = raw.length;
    if (n) {
      const d = Math.hypot(x - raw[n - 1].x, y - raw[n - 1].y);
      if (d < 2.6) return;
    }
    if (n > 850) return;
    raw.push({ x, y });
    const m = raw.length;
    if (m === 1) { sm[0] = { x, y }; }
    else if (m === 2) { sm[1] = { x, y }; }
    else {
      // gentle online smoothing (window of 3) — wobble is preserved
      const a = raw[m - 3], b = raw[m - 2], c2 = raw[m - 1];
      sm[m - 2] = { x: a.x * 0.22 + b.x * 0.56 + c2.x * 0.22, y: a.y * 0.22 + b.y * 0.56 + c2.y * 0.22 };
      sm[m - 1] = { x, y };
    }
    // incrementally bake confirmed segments into the stroke layer
    const upto = sm.length - 2;
    if (upto > state.lastBaked) {
      C.drawSegs(strokeCtx, sm, state.lastBaked, upto, strokeOpts());
      state.lastBaked = upto;
    }
    // fingertip magic
    if (PPG.quality.particleMul > 0.3) {
      const th = currentTheme();
      const hue = th.rainbow ? (sm.length * 12) % 360 : th.h;
      glow(partsS, x, y, hue, 8 + Math.random() * 5);
      if (Math.random() < 0.3) spark(partsS, x, y, hue, { spread: 26, up: 16 });
    }
  }

  function cancelStroke(silent) {
    state.raw = []; state.sm = [];
    state.lastBaked = 0;
    state.ponHold = null;
    glitterLive = [];
    strokeCtx.clearRect(0, 0, W, H);
    if (!silent) SND.stopDraw();
  }

  function finishStroke() {
    SND.stopDraw();
    const sm = state.sm;
    if (!sm.length) { state.mode = 'idle'; return; }
    C.drawSegs(strokeCtx, sm, state.lastBaked, sm.length - 1, strokeOpts());
    state.lastBaked = sm.length - 1;
    glitterLive = C.collectGlitter(sm, state.strokeSeed);
    state.mode = 'pon';
    state.ponSince = T;
    state.lastTick = T;
  }

  function repaintStroke() {
    strokeCtx.clearRect(0, 0, W, H);
    const upto = state.mode === 'pon' ? state.sm.length - 1 : Math.max(0, state.sm.length - 2);
    C.drawSegs(strokeCtx, state.sm, 0, upto, strokeOpts());
    state.lastBaked = upto;
  }

  // ---------------- bloom ----------------
  function startBloom(hold) {
    const sm = state.sm;
    if (!sm.length) { state.mode = 'idle'; return; }
    SND.pon(hold);
    const wpts = sm.map(p => toWorld(p.x, p.y));
    const f = FL.create(wpts, state.colorId, hold, strokeWidth() / cam.cur, state.strokeSeed);
    flowers.push(f);
    gardenData.push(recordOf(f));
    while (flowers.length > MAX_FLOWERS) { flowers.shift(); gardenData.shift(); }
    blooms.push({ f, t0: T, last: 0 });
    // back to idle right away: the next stroke can start while this one blooms
    state.mode = 'idle';
    state.ponHold = null;
    // pon burst at the child's final dot
    const tip = wpts[wpts.length - 1];
    const th = f.theme;
    for (let i = 0; i < 10 * PPG.quality.particleMul; i++) {
      spark(partsW, tip.x, tip.y, th.rainbow ? Math.random() * 360 : th.h, { spread: 90, up: 40, life: 0.8 });
    }
    glow(partsW, tip.x, tip.y, th.rainbow ? 300 : th.h, 26);
    cancelStroke(true);
    if (!tutDone) {
      tutDone = true;
      try { localStorage.setItem(TKEY, '1'); } catch (e) { }
    }
  }

  function bloomEvents(f, e) {
    const th = f.theme;
    const q = PPG.quality.particleMul;
    if (e.type === 'mound') {
      for (let i = 0; i < 5 * q; i++) spark(partsW, e.x, e.y, 35, { spread: 40, up: 20, life: 0.5, r: 1 });
    } else if (e.type === 'leaf') {
      SND.leafPop(Math.floor(e.t * 10));
      for (let i = 0; i < 4 * q; i++) spark(partsW, e.x, e.y, 110, { spread: 40, up: 22, life: 0.5 });
    } else if (e.type === 'bud') {
      SND.budSwell();
      glow(partsW, e.x, e.y, th.rainbow ? 320 : th.h, 20);
    } else if (e.type === 'petal') {
      SND.petalPop(e.i || 0);
      const hue = th.rainbow ? ((e.i || 0) * 47) % 360 : th.h;
      spark(partsW, e.x, e.y, hue, { spread: 66, up: 26, life: 0.6 });
    } else if (e.type === 'pollen') {
      for (let i = 0; i < 16 * q; i++) pollen(e.x, e.y, th.rainbow ? Math.random() * 360 : 48);
    } else if (e.type === 'chime') {
      SND.chime();
      for (let i = 0; i < 12 * q; i++) spark(partsW, e.x, e.y, 50, { spread: 120, up: 40, life: 1, r: 1.8 });
    }
  }

  function updateBloom() {
    for (let i = blooms.length - 1; i >= 0; i--) {
      const bl = blooms[i];
      if (flowers.indexOf(bl.f) < 0) { blooms.splice(i, 1); continue; } // undone mid-bloom
      const p = (T - bl.t0) / BLOOM_DUR;
      for (const e of FL.eventsBetween(bl.f, bl.last, Math.min(1, p))) bloomEvents(bl.f, e);
      bl.last = p;
      if (p >= 1) {
        FL.bake(bl.f, dpr);
        blooms.splice(i, 1);
        afterBloom(bl.f);
      }
    }
  }

  function afterBloom(f) {
    cam.holdUntil = T + 2.0;
    save();
    // neighbours bow to the new flower
    for (const o of flowers) {
      if (o === f || !o.sprite) continue;
      const d = U.dist(o.pts[0].x, o.pts[0].y, f.pts[0].x, f.pts[0].y);
      if (d < 220) {
        o.impT = T; o.impA = 0.05 * (1 - d / 220) * (o.pts[0].x < f.pts[0].x ? -1 : 1);
      }
      // heads close together → a little arc of light between them
      const hd = U.dist(o.head.x, o.head.y, f.head.x, f.head.y);
      if (hd < 150) {
        for (let i = 0; i < 7; i++) {
          const tt = i / 6;
          spark(partsW, U.lerp(o.head.x, f.head.x, tt), U.lerp(o.head.y, f.head.y, tt) - Math.sin(tt * Math.PI) * 18,
            f.theme.rainbow ? tt * 360 : f.theme.h, { spread: 8, up: 6, life: 0.9 });
        }
      }
    }
    dispatchButterfly(f);
    // sometimes a ladybug climbs the child's line
    if (flowers.length >= 2 && f.seed % 3 === 0 && ladybugs.length < 2) {
      ladybugs.push(new PPG.creatures.Ladybug(f));
    }
    // three flowers → a little rainbow blesses the garden
    if (flowers.length >= 3 && !rainbow.on) {
      rainbow.on = true; rainbow.t0 = T + 0.6;
      setTimeout(() => SND.rainbowAppear(), 600);
    }
    chooseNextSlot();
  }

  // ---------------- creatures ----------------
  function butterflyHue(th) {
    return th.rainbow ? Math.random() * 360 : th.h + 140 + Math.random() * 60;
  }
  function dispatchButterfly(f) {
    const want = Math.min(1 + Math.floor(flowers.length / 3), 4);
    if (butterflies.length < want) {
      const side = Math.random() < 0.5 ? -0.15 : 1.15;
      butterflies.push(new PPG.creatures.Butterfly(side * W, H * (0.15 + Math.random() * 0.2), butterflyHue(f.theme)));
    }
    // the nearest free butterfly comes to see the new flower
    let pick = null, best = 1e9;
    for (const b of butterflies) {
      const d = U.dist(b.x, b.y, f.head.x, f.head.y) + (b.state === 'sit' ? 500 : 0);
      if (d < best) { best = d; pick = b; }
    }
    if (pick) pick.flyTo(f, T, onButterflyLand);
  }
  function onButterflyLand(f) {
    SND.flutter();
    const h = PPG.creatures.headWorld(f, T);
    for (let i = 0; i < 6 * PPG.quality.particleMul; i++) {
      spark(partsW, h.x, h.y - 6, 55, { spread: 40, up: 14, life: 0.7 });
    }
    if (f.impT == null || T - f.impT > 1) { f.impT = T; f.impA = 0.03; }
  }
  const creatureEnv = {
    flowers: [],
    spark: (x, y, hue) => spark(partsW, x, y, hue, { spread: 8, up: 4, life: 0.5, r: 1 }),
    onLand: null
  };

  // ---------------- next slot glow ----------------
  function chooseNextSlot() {
    const bed = PPG.bg.bed(W, H);
    const cand = [];
    for (const fx of [-0.72, -0.38, 0, 0.38, 0.72]) {
      for (const fy of [-0.35, 0.45]) {
        const c = { x: bed.cx + fx * bed.rx, y: bed.cy + fy * bed.ry };
        // keep suggestions clear of the color buttons / undo button
        if (c.y > H - 125 && Math.abs(c.x - W / 2) < 200) continue;
        if (c.y > H - 95) continue;
        cand.push(c);
      }
    }
    const minD = Math.max(60, Math.min(W, H) * 0.16);
    const free = cand.filter(c =>
      flowers.every(f => U.dist(f.pts[0].x, f.pts[0].y, c.x, c.y) > minD));
    if (!free.length) { nextSlot = null; return; }
    free.sort((a, b) =>
      U.dist(a.x, a.y, bed.cx, bed.cy - bed.ry * 0.2) - U.dist(b.x, b.y, bed.cx, bed.cy - bed.ry * 0.2));
    const top = free.slice(0, Math.min(3, free.length));
    nextSlot = Object.assign({ ph: Math.random() * U.TAU }, top[Math.floor(Math.random() * top.length)]);
  }
  function drawNextSlot(c) {
    if (!nextSlot || state.mode !== 'idle' || blooms.length || tut.active) return;
    const s = nextSlot;
    const pul = 0.5 + 0.5 * Math.sin(T * 2.6 + s.ph);
    const r = 26 + 6 * pul;
    const th = currentTheme();
    const hue = th.rainbow ? (T * 60) % 360 : th.h;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
    g.addColorStop(0, 'rgba(255,252,235,' + (0.40 + 0.22 * pul).toFixed(3) + ')');
    g.addColorStop(0.55, U.hsla(hue, 70, 72, 0.20 + 0.12 * pul));
    g.addColorStop(1, U.hsla(hue, 70, 72, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(s.x, s.y, r, 0, U.TAU); c.fill();
    c.restore();
    // orbiting sparkles
    for (let k = 0; k < 3; k++) {
      const a = T * 1.6 + k * (U.TAU / 3) + s.ph;
      const px = s.x + Math.cos(a) * (r + 6), py = s.y + Math.sin(a) * (r + 6) * 0.5;
      c.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.4 * Math.sin(T * 5 + k * 2)).toFixed(3) + ')';
      c.beginPath(); c.arc(px, py, 1.6, 0, U.TAU); c.fill();
    }
    if (T - lastSlotSparkle > 0.5 && PPG.quality.particleMul > 0.3) {
      lastSlotSparkle = T;
      spawn(partsW, {
        kind: 'mote', x: s.x + (Math.random() - 0.5) * 30, y: s.y,
        vy: -16, life: 1.6, age: 0, r: 1.3, tw: Math.random() * U.TAU
      });
    }
  }

  // ---------------- rainbow ----------------
  function drawRainbow(c) {
    if (!rainbow.on || T < rainbow.t0) return;
    const k = U.easeOutCubic(U.clamp((T - rainbow.t0) / 2.2, 0, 1));
    let cx = 0, cy = 0, n2 = 0;
    for (const f of flowers) { cx += f.head.x; cy += f.head.y; n2++; }
    if (!n2) return;
    cx /= n2; cy = cy / n2 + 30;
    const R0 = Math.min(W, H) * 0.34;
    const hues = [0, 32, 56, 125, 210, 275];
    c.save();
    c.lineCap = 'round';
    for (let i = 0; i < hues.length; i++) {
      const r = R0 + i * Math.min(W, H) * 0.020;
      c.strokeStyle = U.hsla(hues[i], 85, 68, 0.17 * k);
      c.lineWidth = Math.min(W, H) * 0.020;
      c.beginPath();
      c.arc(cx, cy, r, Math.PI + 0.25, U.TAU - 0.25);
      c.stroke();
    }
    c.restore();
  }

  // ---------------- pon light ----------------
  function drawPonLight(c) {
    const sm = state.sm;
    if (!sm.length) return;
    const tip = sm[sm.length - 1];
    const th = currentTheme();
    let k = 1 + 0.15 * Math.sin(T * 4.5);
    let holdK = 0;
    if (state.ponHold) {
      holdK = U.clamp((T - state.ponHold.t0) / 0.6, 0, 1);
      k += holdK * 1.4;
    }
    C.tipGlow(c, tip.x, tip.y, T, th, 1.5 * k);
    // orbiting invitation sparkles
    for (let i = 0; i < 3; i++) {
      const a = T * 1.9 + i * (U.TAU / 3);
      const r = 19 + 3 * Math.sin(T * 3 + i);
      c.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * Math.sin(T * 6 + i * 2)).toFixed(3) + ')';
      c.beginPath();
      c.arc(tip.x + Math.cos(a) * r, tip.y + Math.sin(a) * r, 1.8, 0, U.TAU);
      c.fill();
    }
    if (state.ponHold) {
      c.strokeStyle = 'rgba(255,255,255,0.75)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(tip.x, tip.y, 12 + holdK * 26, 0, U.TAU);
      c.stroke();
    }
  }

  // ---------------- tutorial ghost ----------------
  function buildTutorial() {
    const bed = PPG.bg.bed(W, H);
    const p0 = { x: bed.cx, y: Math.min(bed.cy + bed.ry * 0.25, H - 135) };
    const rise = Math.min(H * 0.30, 260);
    const c1 = { x: p0.x - W * 0.045, y: p0.y - rise * 0.38 };
    const c2 = { x: p0.x + W * 0.055, y: p0.y - rise * 0.72 };
    const p1 = { x: p0.x + W * 0.01, y: p0.y - rise };
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const it = 1 - t;
      pts.push({
        x: it * it * it * p0.x + 3 * it * it * t * c1.x + 3 * it * t * t * c2.x + t * t * t * p1.x,
        y: it * it * it * p0.y + 3 * it * it * t * c1.y + 3 * it * t * t * c2.y + t * t * t * p1.y
      });
    }
    tut.pts = pts;
    tut.slot = p0;
  }
  function drawTutorial(c) {
    if (!tut.active || !tut.pts || T < tut.t0) return;
    const cycle = 5.6;
    const tau = (((T - tut.t0) % cycle) + cycle) % cycle;
    const pts = tut.pts;
    const tip = pts[pts.length - 1];
    const th = currentTheme();
    const fadeAll = tau > 4.6 ? U.clamp(1 - (tau - 4.6), 0, 1) : 1;
    c.save();
    c.globalAlpha = fadeAll;

    // start ripple ("touch here")
    if (tau < 0.6) {
      const rp = tau / 0.6;
      c.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - rp)).toFixed(3) + ')';
      c.lineWidth = 2.5;
      c.beginPath(); c.arc(pts[0].x, pts[0].y, 8 + rp * 30, 0, U.TAU); c.stroke();
    }
    // ghost line grows
    const du = U.clamp((tau - 0.5) / 1.8, 0, 1);
    const upto = Math.floor(U.smoothstep(du) * (pts.length - 1));
    if (upto > 0) {
      c.globalAlpha = 0.5 * fadeAll;
      C.drawSegs(c, pts, 0, upto, { theme: th, width: strokeWidth() * 0.9, seed: 424242, alpha: 1 });
      c.globalAlpha = fadeAll;
    }
    // pulsing pon dot at the tip
    if (tau > 2.3) {
      const pk = tau < 3.0 ? 1 : 1.6;
      C.tipGlow(c, tip.x, tip.y, T, th, pk);
    }
    // tap burst
    if (tau > 3.05 && tau < 3.6) {
      const bp = (tau - 3.05) / 0.55;
      c.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - bp)).toFixed(3) + ')';
      c.lineWidth = 2.5;
      c.beginPath(); c.arc(tip.x, tip.y, 6 + bp * 34, 0, U.TAU); c.stroke();
    }
    // ghost fingertip
    let fx = null, fy = null, press = 1;
    if (tau < 0.5) { fx = pts[0].x + 14; fy = pts[0].y + 22; }
    else if (tau < 2.3) {
      const i = Math.floor(U.smoothstep(U.clamp((tau - 0.5) / 1.8, 0, 1)) * (pts.length - 1));
      fx = pts[i].x; fy = pts[i].y;
    } else if (tau < 3.0) {
      const l = U.smoothstep(U.clamp((tau - 2.3) / 0.4, 0, 1));
      fx = U.lerp(tip.x, tip.x + 26, l); fy = U.lerp(tip.y, tip.y + 34, l);
    } else if (tau < 3.45) {
      const l = U.smoothstep(U.clamp((tau - 3.0) / 0.25, 0, 1));
      fx = U.lerp(tip.x + 26, tip.x, l); fy = U.lerp(tip.y + 34, tip.y, l);
      press = tau > 3.2 ? 0.8 : 1;
    } else if (tau < 4.2) {
      fx = tip.x + (tau - 3.45) * 40; fy = tip.y + 34 + (tau - 3.45) * 30;
    }
    if (fx != null) {
      const g = c.createRadialGradient(fx, fy, 0, fx, fy, 16 * press);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(fx, fy, 16 * press, 0, U.TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.65)';
      c.lineWidth = 1.6;
      c.beginPath(); c.arc(fx, fy, 9 * press, 0, U.TAU); c.stroke();
    }
    c.restore();
  }

  // ---------------- undo ----------------
  function undo() {
    state.lastInput = T;
    if (state.mode === 'draw' || state.mode === 'pon') {
      cancelStroke();
      state.mode = 'idle';
      SND.poof();
      return;
    }
    if (state.mode !== 'idle' || !flowers.length) return;
    const f = flowers.pop();
    gardenData.pop();
    SND.poof();
    spawn(partsW, { kind: 'poof', x: f.head.x, y: f.head.y, vx: 0, vy: 0, life: 0.6, age: 0, r: f.petalR });
    for (let i = 0; i < 12 * PPG.quality.particleMul; i++) {
      spark(partsW, f.head.x, f.head.y, f.theme.rainbow ? Math.random() * 360 : f.theme.h, { spread: 90, up: 30, life: 0.9 });
      fluffSeed(f.pts[0].x, f.pts[0].y);
    }
    ladybugs = ladybugs.filter(lb => lb.f !== f);
    if (flowers.length < 3) rainbow.on = false;
    save();
    chooseNextSlot();
  }

  // ---------------- input ----------------
  function onDown(e) {
    e.preventDefault();
    SND.init();
    state.lastInput = T;
    if (tut.active) tut.active = false;
    const x = e.clientX, y = e.clientY;
    if (state.mode === 'idle') {
      state.mode = 'draw';
      state.activeId = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
      state.raw = []; state.sm = [];
      state.lastBaked = 0;
      state.strokeSeed = (Math.floor(Math.random() * 0x7fffffff) || 1);
      strokeCtx.clearRect(0, 0, W, H);
      glitterLive = [];
      SND.startDraw();
      addRawPoint(x, y);
      state.lastMoveP = { x, y }; state.lastMoveT = T;
    } else if (state.mode === 'pon') {
      // any tap completes the flower — it snaps to the stroke's tip
      state.ponHold = { t0: T };
      state.activeId = e.pointerId;
    }
  }
  function onMove(e) {
    if (state.mode !== 'draw' || e.pointerId !== state.activeId) return;
    e.preventDefault();
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [e];
    for (const ev of evs) addRawPoint(ev.clientX, ev.clientY);
    const p = { x: e.clientX, y: e.clientY };
    if (state.lastMoveP) {
      const dt2 = Math.max(0.008, T - state.lastMoveT);
      const speed = U.dist(p.x, p.y, state.lastMoveP.x, state.lastMoveP.y) / dt2;
      SND.setDrawLevel(speed);
    }
    state.lastMoveP = p; state.lastMoveT = T;
  }
  function onUp(e) {
    if (e.pointerId !== state.activeId) return;
    state.lastInput = T;
    if (state.mode === 'draw') {
      e.preventDefault();
      const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
      for (const ev of evs) addRawPoint(ev.clientX, ev.clientY);
      finishStroke();
    } else if (state.mode === 'pon' && state.ponHold) {
      e.preventDefault();
      const hold = U.clamp((T - state.ponHold.t0) / 0.6, 0, 1);
      startBloom(hold);
    }
    state.activeId = null;
  }

  function bindInput() {
    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp, { passive: false });
    canvas.addEventListener('pointercancel', onUp, { passive: false });
    document.addEventListener('touchmove', (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // UI
    for (const btn of document.querySelectorAll('.colorBtn')) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        SND.init();
        state.lastInput = T;
        const id = btn.dataset.color;
        if (id === state.colorId) return;
        state.colorId = id;
        for (const b of document.querySelectorAll('.colorBtn')) b.classList.toggle('selected', b === btn);
        SND.select();
        // recolor an in-progress line instantly — the child's choice always wins
        if (state.mode === 'pon' || state.mode === 'draw') {
          repaintStroke();
          if (state.mode === 'pon') glitterLive = C.collectGlitter(state.sm, state.strokeSeed);
        }
      }, { passive: false });
    }
    const ub = document.getElementById('undoBtn');
    ub.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      SND.init();
      undo();
    }, { passive: false });

    window.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', scheduleResize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) SND.stopDraw(true);
    });
  }

  // ---------------- quality adaptation ----------------
  function adaptQuality(dt) {
    emaDt = U.lerp(emaDt, dt, 0.04);
    if (T - lastQualityCheck < 2) return;
    lastQualityCheck = T;
    const q = PPG.quality;
    if (emaDt > 0.030 && q.level > 0.3) {
      q.level = 0.3; q.particleMul = 0.25; q.glitterFlowers = 1; q.speckle = 0.35;
    } else if (emaDt > 0.022 && q.level > 0.5) {
      q.level = 0.5; q.particleMul = 0.5; q.glitterFlowers = 3; q.speckle = 0.6;
    }
  }

  // ---------------- main loop ----------------
  function frame(ts) {
    requestAnimationFrame(frame);
    const now = ts / 1000;
    const dt = U.clamp(now - (lastTs || now), 0.001, 0.05);
    lastTs = now;
    T = now;
    adaptQuality(dt);

    // camera eases only when the child is not mid-creation
    if (state.mode !== 'draw' && state.mode !== 'pon') {
      cam.cur = U.lerp(cam.cur, camTarget(), Math.min(1, dt * 2.2));
    }

    // pon: auto-bloom on a long press; gentle reminder if waiting
    if (state.mode === 'pon') {
      if (state.ponHold && T - state.ponHold.t0 > 0.75) startBloom(1);
      else if (!state.ponHold && T - state.lastTick > 3.2) {
        state.lastTick = T;
        if (T - state.ponSince > 4) SND.tick();
      }
    }
    updateBloom();

    // creatures
    creatureEnv.flowers = flowers;
    creatureEnv.onLand = onButterflyLand;
    for (const b of butterflies) b.update(dt, T, creatureEnv);
    ladybugs = ladybugs.filter(lb => lb.update(dt, T, flowers));

    updateParticles(partsW, dt);
    updateParticles(partsS, dt);

    // ambient motes drifting through the garden
    if (T - lastAmbient > 0.7 && PPG.quality.particleMul > 0.3) {
      lastAmbient = T;
      spawn(partsW, {
        kind: 'mote', x: Math.random() * W, y: H * (0.45 + Math.random() * 0.5),
        vy: -9 - Math.random() * 8, life: 3 + Math.random() * 3,
        age: 0, r: 0.9 + Math.random() * 1.2, tw: Math.random() * U.TAU
      });
      // fluffy flowers release a seed once in a while
      for (const f of flowers) {
        if (f.type === 'fuwa' && f.sprite && Math.random() < 0.10) {
          fluffSeed(f.head.x, f.head.y);
        }
      }
    }

    // tutorial reappears if the garden is empty and nothing happens
    if (!tut.active && !tutDone && !flowers.length && state.mode === 'idle' && T - state.lastInput > 22) {
      tut.active = true; tut.t0 = T;
      buildTutorial();
    }

    // ---------------- draw ----------------
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    camApply(ctx);

    PPG.bg.draw(ctx);
    drawRainbow(ctx);
    drawNextSlot(ctx);

    for (const f of flowers) {
      const bl = blooms.find(b => b.f === f);
      if (bl) {
        FL.render(ctx, f, U.clamp((T - bl.t0) / BLOOM_DUR, 0, 1), T);
      } else if (f.sprite) {
        FL.drawBaked(ctx, f, T);
      }
    }
    // glitter shimmer on the most recent flowers
    const gn = PPG.quality.glitterFlowers;
    for (let i = Math.max(0, flowers.length - gn); i < flowers.length; i++) {
      const f = flowers[i];
      if (!f.sprite) continue;
      const b = f.pts[0];
      const a = FL.swayAngle(f, T);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      ctx.translate(-b.x, -b.y);
      C.drawGlitter(ctx, f.glitter, T + i, 0.8);
      ctx.restore();
    }

    for (const lb of ladybugs) lb.draw(ctx);
    for (const b of butterflies) b.draw(ctx, T);
    drawParticles(ctx, partsW);
    PPG.bg.drawFront(ctx, T);
    ctx.restore();

    // ------ screen-space: the live stroke is always on top ------
    if (state.mode === 'draw' || state.mode === 'pon') {
      ctx.drawImage(strokeCv, 0, 0, W, H);
      const sm = state.sm;
      if (state.mode === 'draw' && sm.length >= 2) {
        // live (not yet baked) tail segments
        C.drawSegs(ctx, sm, Math.max(0, state.lastBaked), sm.length - 1, strokeOpts());
        const tip = sm[sm.length - 1];
        C.tipGlow(ctx, tip.x, tip.y, T, currentTheme(), 1);
      }
      if (state.mode === 'pon') {
        C.drawGlitter(ctx, glitterLive, T, 1);
        drawPonLight(ctx);
      }
    }
    drawParticles(ctx, partsS);
    drawTutorial(ctx);

    // undo visibility
    const ub = document.getElementById('undoBtn');
    const showUndo = flowers.length > 0 || state.mode === 'pon' || state.mode === 'draw';
    ub.classList.toggle('hidden', !showUndo);
  }

  // debug snapshot (used by automated tests; harmless in production)
  PPG.debug = () => ({
    mode: state.mode,
    flowers: flowers.length,
    types: flowers.map(f => f.type),
    sprites: flowers.map(f => !!f.sprite),
    heads: flowers.map(f => [Math.round(f.head.x), Math.round(f.head.y)]),
    bases: flowers.map(f => [Math.round(f.pts[0].x), Math.round(f.pts[0].y)]),
    cam: cam.cur,
    butterflies: butterflies.map(b => [b.state, Math.round(b.x), Math.round(b.y)]),
    tut: tut.active
  });

  // ---------------- boot ----------------
  load();
  doResize();
  bindInput();
  rainbow.on = flowers.length >= 3;
  rainbow.t0 = -10;
  if (!flowers.length && !tutDone) {
    tut.active = true; tut.t0 = 0.6;
    buildTutorial();
  }
  // returning gardens get their butterflies back right away
  if (flowers.length) {
    const want = Math.min(1 + Math.floor(flowers.length / 3), 4);
    for (let i = 0; i < want; i++) {
      const b = new PPG.creatures.Butterfly(Math.random() * W, H * 0.3, butterflyHue(flowers[i % flowers.length].theme));
      b.roamUntil = 1 + i;
      butterflies.push(b);
    }
  }
  requestAnimationFrame(frame);
})(window.PPG);
