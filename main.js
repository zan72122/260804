'use strict';
(function () {

  /* =========================================================
     helpers
  ========================================================= */
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function easeOutCubic(t) { t = clamp(t, 0, 1); var u = 1 - t; return 1 - u * u * u; }
  function easeOutBack(t) {
    t = clamp(t, 0, 1);
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function hsla(h, s, l, a) {
    return 'hsla(' + ((h % 360) + 360) % 360 + ',' + s + '%,' + l + '%,' + a + ')';
  }
  function rr(c, x, y, w, h, r) { /* rounded rect path (Safari-safe) */
    r = Math.min(r, w / 2, h / 2);
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* =========================================================
     canvas / layout
  ========================================================= */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;

  var ROWS = 5;                    // pyramid: 1+2+3+4+5 = 15 cups
  var L = {};                      // layout metrics

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeLayout();
  }

  function computeLayout() {
    var topPad = Math.max(66, H * 0.145);          // watering can zone
    var groundH = Math.max(72, H * 0.13);
    var towerTop = topPad + 6;
    var towerH = H - groundH - towerTop - 6;
    var u = Math.min((W * 0.95) / ROWS, (towerH / ROWS) * 1.02);
    L.u = u;
    L.cupW = u * 0.84;
    L.mouthRy = L.cupW * 0.155;
    L.depth = L.cupW * 0.5;
    L.rowH = towerH / ROWS;
    L.towerTop = towerTop;
    L.groundY = H - groundH;
    L.groundH = groundH;
    L.canS = clamp(u * 0.62, 34, 92);
    L.canY = topPad * 0.52;
    L.minX = W / 2 - (ROWS - 1) * u / 2 - u * 0.55;
    L.maxX = W / 2 + (ROWS - 1) * u / 2 + u * 0.55;
    // re-place cups
    for (var i = 0; i < cups.length; i++) {
      var cp = cups[i];
      cp.x = W / 2 + (cp.c - cp.r / 2) * u;
      cp.y = towerTop + L.rowH * cp.r + L.rowH * 0.42;
    }
    // keep meadow flowers on the ground line
    for (var m = 0; m < meadow.length; m++) {
      meadow[m].x = clamp(meadow[m].fx * W, 8, W - 8);
      meadow[m].y = L.groundY + meadow[m].fy * (groundH * 0.72) + 6;
    }
  }

  /* =========================================================
     themes
  ========================================================= */
  var THEMES = [
    {
      name: 'pink',
      skyTop: '#ffd9ea', skyBot: '#fff6e3',
      hill: '#93db7c', hillDark: '#6fc562',
      liqHue: 335, liqSat: 88, liqLight: 72,
      rainbowLiquid: false,
      petalHues: [340, 325, 355, 312, 2, 330],
      petalSat: 82, petalLight: 74,
      centerCol: '#ffd76e',
      can: '#ff9ec7', canDark: '#e6799f', canLight: '#ffc9df',
      sparkle: '#fff3fb',
      stars: false, moon: false,
      notes: [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5],
      wave: 'sine', padFreqs: [261.63, 329.63],
      emoji: ['💮', '✨', '💖', '🌸']
    },
    {
      name: 'rainbow',
      skyTop: '#c9ecff', skyBot: '#fdfff0',
      hill: '#8fdc84', hillDark: '#68c46a',
      liqHue: 0, liqSat: 85, liqLight: 66,
      rainbowLiquid: true,
      petalHues: [0, 28, 52, 130, 200, 262, 320],
      petalSat: 84, petalLight: 66,
      centerCol: '#fff1a8',
      can: '#79c7ff', canDark: '#4d9fe0', canLight: '#c2e6ff',
      sparkle: '#ffffff',
      stars: false, moon: false,
      notes: [523.25, 587.33, 659.25, 739.99, 783.99, 987.77, 1046.5, 1174.7],
      wave: 'triangle', padFreqs: [293.66, 369.99],
      emoji: ['🌈', '✨', '💛', '🌼']
    },
    {
      name: 'star',
      skyTop: '#332d66', skyBot: '#7a63b5',
      hill: '#3f8a72', hillDark: '#2f6d59',
      liqHue: 188, liqSat: 90, liqLight: 74,
      rainbowLiquid: false,
      petalHues: [268, 288, 46, 318, 205, 250],
      petalSat: 78, petalLight: 70,
      centerCol: '#ffe48a',
      can: '#b3a0f2', canDark: '#8d78d6', canLight: '#d8ccff',
      sparkle: '#fff8c9',
      stars: true, moon: true,
      notes: [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7],
      wave: 'sine', padFreqs: [220, 277.18],
      emoji: ['⭐', '✨', '🌟', '💜']
    }
  ];
  var themeIdx = 0;
  function theme() { return THEMES[themeIdx]; }

  function liquidColor(alpha, offset) {
    var t = theme();
    if (t.rainbowLiquid) {
      return hsla(now * 55 + (offset || 0), t.liqSat, t.liqLight, alpha);
    }
    return hsla(t.liqHue, t.liqSat, t.liqLight, alpha);
  }

  /* =========================================================
     game state
  ========================================================= */
  var cups = [];          // {r,c,x,y,units,cap,frac,bloom,state,stateT,petalN,hueI,flowL,flowR,overflowed,splashT}
  var particles = [];
  var butterflies = [];
  var meadow = [];        // persistent ground flowers
  var stars = [];         // night sky
  var clouds = [];
  var groundUnits = 0, groundNext = 0.4;
  var bloomCount = 0;
  var rowDone = [false, false, false, false, false];
  var finale = false, finaleT = 0, goldenT = -99;
  var pouring = false, pointerId = null;
  var pointerX = 0, pointerY = 0, pressY = 0;
  var spoutX = 0, spoutXTarget = 0;
  var power = 1, powerTarget = 1;
  var pourTarget = null;
  var everPoured = false;
  var now = 0, last = 0;
  var POUR_RATE = 0.6;    // liquid units per second at power 1

  function makeCups() {
    cups = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c <= r; c++) {
        cups.push({
          r: r, c: c, x: 0, y: 0,
          units: 0,
          cap: 0.85 * (1 + 0.4 * r),
          frac: 0,
          bloom: 0,
          state: 'bud',           // bud -> wiggle -> blooming -> bloomed
          stateT: 0,
          petalN: randInt(6, 8),
          hueI: randInt(0, 99),
          hueJit: rand(-10, 10),
          flowL: 0, flowR: 0,
          overflowed: false,
          splashT: -99,
          phase: rand(0, TAU)
        });
      }
    }
  }
  function cupAt(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c > r) return null;
    return cups[r * (r + 1) / 2 + c];
  }

  function makeSky() {
    stars = [];
    for (var i = 0; i < 40; i++) {
      stars.push({ fx: Math.random(), fy: Math.random() * 0.55, s: rand(0.8, 2.2), p: rand(0, TAU) });
    }
    clouds = [];
    for (var j = 0; j < 3; j++) {
      clouds.push({ fx: Math.random(), fy: rand(0.05, 0.3), s: rand(0.7, 1.3), v: rand(3, 8) });
    }
  }

  function reset(keepMeadow) {
    makeCups();
    particles = [];
    butterflies = [];
    if (!keepMeadow) { meadow = []; groundUnits = 0; groundNext = 0.4; }
    bloomCount = 0;
    rowDone = [false, false, false, false, false];
    finale = false; finaleT = 0; goldenT = -99;
    everPoured = false;
    makeSky();
    computeLayout();
    document.getElementById('btnRestart').classList.remove('pulse');
  }

  /* =========================================================
     audio (Web Audio, generated — no external assets)
  ========================================================= */
  var AU = { ctx: null, master: null, muted: false, pourGain: null, padGains: [], padOscs: [], bellTimer: 0 };

  function audioInit() {
    if (AU.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ac = new AC();
    AU.ctx = ac;
    AU.master = ac.createGain();
    AU.master.gain.value = AU.muted ? 0 : 0.9;
    AU.master.connect(ac.destination);

    // pouring water: looping noise through bandpass
    var len = ac.sampleRate * 1.2;
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    var bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 0.9;
    var g = ac.createGain(); g.gain.value = 0;
    src.connect(bp); bp.connect(g); g.connect(AU.master);
    src.start();
    AU.pourGain = g;

    startPad();
  }

  function startPad() {
    var ac = AU.ctx;
    stopPad();
    var freqs = theme().padFreqs;
    for (var i = 0; i < freqs.length; i++) {
      var o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = freqs[i];
      o.detune.value = i * 4;
      var g = ac.createGain();
      g.gain.value = 0.012;
      o.connect(g); g.connect(AU.master);
      o.start();
      AU.padOscs.push(o); AU.padGains.push(g);
    }
  }
  function stopPad() {
    for (var i = 0; i < AU.padOscs.length; i++) {
      try { AU.padOscs[i].stop(); } catch (e) {}
    }
    AU.padOscs = []; AU.padGains = [];
  }

  function audioResume() {
    if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume();
  }

  function setPourSound(on, pw) {
    if (!AU.pourGain) return;
    var t = AU.ctx.currentTime;
    AU.pourGain.gain.cancelScheduledValues(t);
    AU.pourGain.gain.setTargetAtTime(on ? 0.05 + 0.04 * pw : 0, t, 0.08);
  }

  function tone(freq, dur, vol, type, when) {
    if (!AU.ctx) return;
    var ac = AU.ctx;
    var t0 = ac.currentTime + (when || 0);
    var o = ac.createOscillator();
    o.type = type || theme().wave;
    o.frequency.value = freq;
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(AU.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function sndDrip() {
    var n = theme().notes;
    tone(n[randInt(3, 5)] * 2, 0.14, 0.05, 'sine');
  }
  function sndBloom(idx) {
    var n = theme().notes;
    var f = n[idx % n.length];
    tone(f, 0.35, 0.16);
    tone(f * 1.5, 0.3, 0.07, 'sine', 0.03);
  }
  function sndRow(r) {
    var n = theme().notes;
    for (var i = 0; i < 3; i++) tone(n[(r + i * 2) % n.length], 0.3, 0.1, undefined, i * 0.09);
  }
  function sndFanfare() {
    var n = theme().notes;
    var seq = [0, 2, 4, 7, 4, 7];
    for (var i = 0; i < seq.length; i++) {
      tone(n[seq[i] % n.length], 0.5, 0.14, undefined, i * 0.13);
      tone(n[seq[i] % n.length] * 2, 0.4, 0.05, 'sine', i * 0.13 + 0.02);
    }
    for (var j = 0; j < 4; j++) tone(n[(j * 2) % n.length] * 2, 1.1, 0.04, 'sine', 0.85 + j * 0.05);
  }

  function toggleMute() {
    AU.muted = !AU.muted;
    if (AU.master) {
      AU.master.gain.setTargetAtTime(AU.muted ? 0 : 0.9, AU.ctx.currentTime, 0.05);
    }
    document.getElementById('btnSound').textContent = AU.muted ? '🔇' : '🔊';
  }

  /* =========================================================
     particles
  ========================================================= */
  var MAX_P = 230;
  function addP(p) { if (particles.length < MAX_P) particles.push(p); }

  function burstSparkles(x, y, n, col, spread) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU), sp = rand(20, spread || 90);
      addP({
        type: 'sparkle', x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        age: 0, life: rand(0.5, 1.0), size: rand(2, 5), col: col
      });
    }
  }
  function addRing(x, y, col) {
    addP({ type: 'ring', x: x, y: y, age: 0, life: 0.55, size: L.cupW * 0.4, col: col });
  }
  function addDroplet(x, y, vx, vy) {
    addP({
      type: 'drop', x: x, y: y, vx: vx, vy: vy,
      age: 0, life: rand(0.35, 0.6), size: rand(2, 3.6)
    });
  }
  function addEmoji(x, y, ch) {
    addP({
      type: 'emoji', x: x, y: y, ch: ch,
      vx: rand(-40, 40), vy: rand(-160, -60),
      age: 0, life: rand(1.4, 2.2), size: rand(16, 26), rot: rand(-1, 1)
    });
  }
  function addBigDrop(x, y, ty) {
    addP({ type: 'bigdrop', x: x, y: y, ty: ty, vy: 0, age: 0, life: 1.2, size: 5 });
  }

  function spawnButterflies() {
    var t = theme();
    for (var i = 0; i < 6; i++) {
      butterflies.push({
        x: rand(W * 0.15, W * 0.85), y: rand(H * 0.35, H * 0.75),
        px: rand(0, TAU), py: rand(0, TAU),
        hue: t.petalHues[i % t.petalHues.length],
        s: rand(7, 11)
      });
    }
  }

  function spawnMeadowFlower() {
    if (meadow.length >= 46) return;
    var fx = Math.random(), fy = Math.random();
    var t = theme();
    var f = {
      fx: fx, fy: fy,
      x: clamp(fx * W, 8, W - 8),
      y: L.groundY + fy * (L.groundH * 0.72) + 6,
      hue: t.petalHues[randInt(0, t.petalHues.length - 1)] + rand(-8, 8),
      s: rand(5, 9), born: now, phase: rand(0, TAU)
    };
    meadow.push(f);
    burstSparkles(f.x, f.y, 4, theme().sparkle, 50);
    sndDrip();
  }

  /* =========================================================
     input
  ========================================================= */
  function canTip() {
    // world position of the watering-can spout tip
    var tilt = pouring ? -0.22 : Math.sin(now * 1.7) * 0.04;
    var s = L.canS;
    var lx = -s * 0.82, ly = s * 0.5;
    var ca = Math.cos(tilt), sa = Math.sin(tilt);
    return {
      x: spoutX + lx * ca - ly * sa,
      y: L.canY + lx * sa + ly * ca,
      tilt: tilt
    };
  }

  function pickTarget(px) {
    var best = null, bestScore = 1e9;
    for (var i = 0; i < cups.length; i++) {
      var cp = cups[i];
      var score = Math.abs(cp.x - px) + cp.r * L.u * 0.32;
      if (score < bestScore) { bestScore = score; best = cp; }
    }
    return best;
  }

  function onDown(e) {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    pointerX = e.clientX; pointerY = e.clientY; pressY = e.clientY;
    pouring = true;
    everPoured = true;
    document.getElementById('splash').classList.add('hidden');
    audioInit(); audioResume();
    setPourSound(true, power);
    e.preventDefault();
  }
  function onMove(e) {
    if (e.pointerId !== pointerId) return;
    pointerX = e.clientX; pointerY = e.clientY;
    e.preventDefault();
  }
  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    pouring = false;
    setPourSound(false, 0);
    e.preventDefault();
  }

  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  /* =========================================================
     update
  ========================================================= */
  function update(dt) {
    // --- watering can follows the finger (heavily smoothed) ---
    if (pouring) {
      spoutXTarget = clamp(pointerX, L.minX, L.maxX);
      powerTarget = clamp(1 + (pressY - pointerY) / 220, 0.65, 1.7);
    } else {
      spoutXTarget = lerp(spoutXTarget, W / 2, dt * 0.8);
      powerTarget = 1;
    }
    spoutX = lerp(spoutX, spoutXTarget, 1 - Math.exp(-dt * 8));
    power = lerp(power, powerTarget, 1 - Math.exp(-dt * 6));

    // --- pour into the magnet-picked cup ---
    var tip = canTip();
    if (pouring) {
      pourTarget = pickTarget(spoutX);
      if (pourTarget) {
        pourTarget.units += POUR_RATE * power * dt;
        pourTarget.splashT = now;
        if (Math.random() < dt * 22) {
          addDroplet(pourTarget.x + rand(-6, 6), pourTarget.y - L.mouthRy,
            rand(-35, 35), rand(-70, -20));
        }
        if (Math.random() < dt * 8) {
          burstSparkles(lerp(tip.x, pourTarget.x, Math.random()),
            lerp(tip.y, pourTarget.y, Math.random()),
            1, theme().sparkle, 30);
        }
      }
      setPourSound(true, power);
    } else {
      pourTarget = null;
    }

    // --- overflow cascade (top to bottom) ---
    for (var i = 0; i < cups.length; i++) {
      var cp = cups[i];
      var excess = cp.units - cp.cap;
      var outL = 0, outR = 0;
      if (excess > 0) {
        if (!cp.overflowed) {
          cp.overflowed = true;
          // hero moment: the very first drop
          var chL = cupAt(cp.r + 1, cp.c);
          addBigDrop(cp.x, cp.y + 2, chL ? chL.y - L.mouthRy : L.groundY);
          addRing(cp.x, cp.y, theme().sparkle);
          sndDrip();
        }
        var out = excess * (1 - Math.exp(-dt * 5));
        cp.units -= out;
        var cl = cupAt(cp.r + 1, cp.c);
        var crr = cupAt(cp.r + 1, cp.c + 1);
        if (cl && crr) {
          // water prefers the emptier cup — self-balancing kindness
          var wl = (1 - clamp(cl.units / cl.cap, 0, 1)) + 0.12;
          var wr = (1 - clamp(crr.units / crr.cap, 0, 1)) + 0.12;
          outL = out * wl / (wl + wr);
          outR = out - outL;
          cl.units += outL;
          crr.units += outR;
          cl.splashT = now; crr.splashT = now;
        } else {
          groundUnits += out;
          outL = out * 0.5; outR = out * 0.5;
          while (groundUnits >= groundNext) {
            spawnMeadowFlower();
            groundNext += 0.42 + meadow.length * 0.012;
          }
        }
      }
      cp.flowL = lerp(cp.flowL, outL / Math.max(dt, 0.001), 1 - Math.exp(-dt * 7));
      cp.flowR = lerp(cp.flowR, outR / Math.max(dt, 0.001), 1 - Math.exp(-dt * 7));
      cp.frac = clamp(cp.units / cp.cap, 0, 1);

      // --- bloom state machine ---
      if (cp.state === 'bud' && cp.frac >= 0.98) {
        cp.state = 'wiggle'; cp.stateT = now;
      } else if (cp.state === 'wiggle' && now - cp.stateT > 0.38) {
        cp.state = 'blooming'; cp.stateT = now;
        bloomCount++;
        sndBloom(bloomCount - 1);
        burstSparkles(cp.x, cp.y - L.cupW * 0.2, 10, theme().sparkle, 110);
        addRing(cp.x, cp.y - L.cupW * 0.2, hsla(theme().petalHues[0], 80, 80, 1));
        if (bloomCount === 10) goldenT = now;      // big mid-game "wow"
        checkRow(cp.r);
        checkFinale();
      } else if (cp.state === 'blooming') {
        cp.bloom = easeOutBack((now - cp.stateT) / 0.7);
        if (now - cp.stateT > 0.7) { cp.state = 'bloomed'; cp.bloom = 1; }
      }
    }

    // --- particles ---
    for (var p = particles.length - 1; p >= 0; p--) {
      var q = particles[p];
      q.age += dt;
      if (q.type === 'sparkle' || q.type === 'emoji') {
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.vy += (q.type === 'emoji' ? 190 : 60) * dt;
        q.vx *= (1 - dt * 1.5);
      } else if (q.type === 'drop') {
        q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 520 * dt;
      } else if (q.type === 'bigdrop') {
        q.vy += 420 * dt; q.y += q.vy * dt;
        if (q.y >= q.ty) {
          burstSparkles(q.x, q.ty, 6, theme().sparkle, 60);
          q.age = q.life;
        }
      }
      if (q.age >= q.life) particles.splice(p, 1);
    }

    // --- butterflies ---
    for (var b = 0; b < butterflies.length; b++) {
      var bf = butterflies[b];
      bf.px += dt * rand(0.6, 1.2); bf.py += dt * rand(0.5, 1.0);
      bf.x += Math.sin(bf.px) * 42 * dt;
      bf.y += Math.cos(bf.py) * 30 * dt;
      bf.x = clamp(bf.x, 20, W - 20);
      bf.y = clamp(bf.y, H * 0.18, H * 0.85);
    }

    // --- finale sparkle rain ---
    if (finale) {
      var ft = now - finaleT;
      if (ft < 6 && Math.random() < dt * 14) {
        burstSparkles(rand(0, W), rand(0, H * 0.5), 2, theme().sparkle, 60);
      }
      if (ft < 4 && Math.random() < dt * 5) {
        addEmoji(rand(W * 0.1, W * 0.9), H * 0.25,
          theme().emoji[randInt(0, theme().emoji.length - 1)]);
      }
      if (!finaleRainLoop && ft > 6) finaleRainLoop = true;
      if (finaleRainLoop && Math.random() < dt * 1.5) {
        burstSparkles(rand(0, W), rand(0, H * 0.6), 1, theme().sparkle, 40);
      }
    }
  }
  var finaleRainLoop = false;

  function checkRow(r) {
    if (rowDone[r]) return;
    for (var c = 0; c <= r; c++) {
      var cp = cupAt(r, c);
      if (cp.state !== 'blooming' && cp.state !== 'bloomed') return;
    }
    rowDone[r] = true;
    sndRow(r);
    for (var c2 = 0; c2 <= r; c2++) {
      var q = cupAt(r, c2);
      burstSparkles(q.x, q.y, 6, theme().sparkle, 90);
    }
  }

  function checkFinale() {
    if (finale || bloomCount < cups.length) return;
    finale = true; finaleT = now; finaleRainLoop = false;
    sndFanfare();
    spawnButterflies();
    for (var i = 0; i < 26; i++) {
      addEmoji(rand(W * 0.05, W * 0.95), rand(H * 0.1, H * 0.4),
        theme().emoji[randInt(0, theme().emoji.length - 1)]);
    }
    document.getElementById('btnRestart').classList.add('pulse');
  }

  /* =========================================================
     drawing
  ========================================================= */
  function drawBackground() {
    var t = theme();
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, t.skyTop);
    g.addColorStop(1, t.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (t.stars) {
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        var a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 2 + st.p));
        ctx.fillStyle = 'rgba(255,244,200,' + a.toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(st.fx * W, st.fy * H, st.s, 0, TAU);
        ctx.fill();
      }
    }
    if (t.moon) {
      ctx.fillStyle = 'rgba(255,240,190,0.95)';
      ctx.beginPath();
      ctx.arc(W * 0.85, H * 0.12, 24, 0, TAU);
      ctx.fill();
      ctx.fillStyle = t.skyTop;
      ctx.beginPath();
      ctx.arc(W * 0.85 + 11, H * 0.12 - 6, 20, 0, TAU);
      ctx.fill();
    } else {
      // soft sun
      var sg = ctx.createRadialGradient(W * 0.86, H * 0.1, 4, W * 0.86, H * 0.1, 60);
      sg.addColorStop(0, 'rgba(255,235,150,0.95)');
      sg.addColorStop(1, 'rgba(255,235,150,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(W * 0.86 - 60, H * 0.1 - 60, 120, 120);
      // drifting clouds
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (var cI = 0; cI < clouds.length; cI++) {
        var cl = clouds[cI];
        var cx = ((cl.fx * W + now * cl.v) % (W + 160)) - 80;
        var cy = cl.fy * H;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 42 * cl.s, 16 * cl.s, 0, 0, TAU);
        ctx.ellipse(cx + 28 * cl.s, cy + 4, 30 * cl.s, 13 * cl.s, 0, 0, TAU);
        ctx.ellipse(cx - 30 * cl.s, cy + 5, 26 * cl.s, 11 * cl.s, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawGround() {
    var t = theme();
    ctx.fillStyle = t.hill;
    ctx.beginPath();
    ctx.moveTo(0, L.groundY + 14);
    ctx.quadraticCurveTo(W * 0.3, L.groundY - 12, W * 0.55, L.groundY + 6);
    ctx.quadraticCurveTo(W * 0.8, L.groundY + 18, W, L.groundY + 2);
    ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = t.hillDark;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.quadraticCurveTo(W * 0.5, L.groundY + L.groundH * 0.55, W, H);
    ctx.closePath();
    ctx.fill();

    // base pool below the tower
    var poolW = L.u * 2.6, poolFill = clamp(groundUnits / 6, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(W / 2, L.groundY + 10, poolW / 2, 10, 0, 0, TAU);
    ctx.fill();
    if (poolFill > 0.02) {
      ctx.fillStyle = liquidColor(0.55 + 0.25 * poolFill);
      ctx.beginPath();
      ctx.ellipse(W / 2, L.groundY + 10, (poolW / 2 - 4) * (0.4 + 0.6 * poolFill),
        8 * (0.5 + 0.5 * poolFill), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      var sx = W / 2 + Math.sin(now * 3) * poolW * 0.2;
      ctx.beginPath();
      ctx.ellipse(sx, L.groundY + 8, 8, 2.5, 0, 0, TAU);
      ctx.fill();
    }

    // meadow flowers born from the overflow
    for (var i = 0; i < meadow.length; i++) {
      var f = meadow[i];
      var grow = easeOutBack(clamp((now - f.born) / 0.6, 0, 1));
      var sway = Math.sin(now * 2 + f.phase) * 0.08;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(sway);
      ctx.scale(grow, grow);
      ctx.strokeStyle = '#3f9948';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -f.s * 1.6);
      ctx.stroke();
      ctx.fillStyle = hsla(f.hue, 80, 70, 1);
      for (var k = 0; k < 5; k++) {
        var a = k / 5 * TAU + f.phase;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * f.s * 0.55, -f.s * 1.6 + Math.sin(a) * f.s * 0.55,
          f.s * 0.42, f.s * 0.26, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffdd77';
      ctx.beginPath();
      ctx.arc(0, -f.s * 1.6, f.s * 0.32, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawColumn() {
    // decorative fountain column behind the cups
    var topY = L.towerTop + L.rowH * 0.42;
    var w1 = L.u * 0.16, w2 = L.u * 0.3;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(W / 2 - w1, topY);
    ctx.lineTo(W / 2 + w1, topY);
    ctx.lineTo(W / 2 + w2, L.groundY + 8);
    ctx.lineTo(W / 2 - w2, L.groundY + 8);
    ctx.closePath();
    ctx.fill();
  }

  function streamPath(x0, y0, x1, y1, w, alpha, hueOff) {
    var cx = (x0 + x1) / 2, cy = y0 + (y1 - y0) * 0.35;
    ctx.lineCap = 'round';
    ctx.strokeStyle = liquidColor(alpha, hueOff);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, w * 0.35);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
    // little bubbles travelling along the stream
    var n = 3;
    for (var i = 0; i < n; i++) {
      var tt = (now * 1.6 + i / n) % 1;
      var mt = 1 - tt;
      var bx = mt * mt * x0 + 2 * mt * tt * cx + tt * tt * x1;
      var by = mt * mt * y0 + 2 * mt * tt * cy + tt * tt * y1;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(1.2, w * 0.22), 0, TAU);
      ctx.fill();
    }
  }

  function drawStreams() {
    // pour stream from the can
    if (pouring && pourTarget) {
      var tip = canTip();
      streamPath(tip.x, tip.y, pourTarget.x, pourTarget.y - L.mouthRy * 0.4,
        3 + power * 3.2, 0.85, 0);
    }
    // overflow streams cup -> children
    for (var i = 0; i < cups.length; i++) {
      var cp = cups[i];
      if (cp.flowL < 0.01 && cp.flowR < 0.01) continue;
      var cl = cupAt(cp.r + 1, cp.c);
      var crr = cupAt(cp.r + 1, cp.c + 1);
      var rx = L.cupW / 2;
      if (cp.flowL > 0.01) {
        var lx = cp.x - rx * 0.66, ly = cp.y + 2;
        var tx = cl ? cl.x : cp.x - L.u * 0.3;
        var ty = cl ? cl.y - L.mouthRy * 0.4 : L.groundY + 8;
        streamPath(lx, ly, tx, ty, 2 + Math.sqrt(cp.flowL) * 7, 0.8, 40);
      }
      if (cp.flowR > 0.01) {
        var rx2 = cp.x + rx * 0.66, ry2 = cp.y + 2;
        var tx2 = crr ? crr.x : cp.x + L.u * 0.3;
        var ty2 = crr ? crr.y - L.mouthRy * 0.4 : L.groundY + 8;
        streamPath(rx2, ry2, tx2, ty2, 2 + Math.sqrt(cp.flowR) * 7, 0.8, 80);
      }
    }
  }

  function drawCup(cp) {
    var t = theme();
    var bw = L.cupW, rx = bw / 2, ry = L.mouthRy, depth = L.depth;
    var wig = 0;
    if (cp.state === 'wiggle') {
      wig = Math.sin((now - cp.stateT) * 34) * 0.09 * (1 - (now - cp.stateT) / 0.38);
    }
    ctx.save();
    ctx.translate(cp.x, cp.y);
    ctx.rotate(wig * 0.35);
    ctx.scale(1 + wig, 1 - wig);

    var hue = t.rainbowLiquid
      ? t.petalHues[(cp.r * 7 + cp.c * 3) % t.petalHues.length]
      : t.petalHues[cp.hueI % t.petalHues.length] + cp.hueJit;

    // ---- flower petals behind the bowl ----
    var b = cp.bloom;
    var cyF = -bw * 0.18;                         // flower centre
    if (b > 0.01) {
      var petLen = bw * (0.34 + 0.62 * b);
      var petW = bw * (0.2 + 0.16 * b);
      var breathe = 1 + Math.sin(now * 2 + cp.phase) * 0.03 * b;
      for (var k = 0; k < cp.petalN; k++) {
        var a = (k / cp.petalN) * TAU - Math.PI / 2 + Math.sin(now * 0.7 + cp.phase) * 0.05;
        ctx.fillStyle = hsla(hue + (t.rainbowLiquid ? k * 6 : 0), t.petalSat, t.petalLight, 0.95);
        ctx.save();
        ctx.translate(0, cyF);
        ctx.rotate(a);
        ctx.scale(breathe, breathe);
        ctx.beginPath();
        ctx.ellipse(petLen * 0.55, 0, petLen * 0.5, petW * 0.5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      // inner petals, lighter
      for (var k2 = 0; k2 < cp.petalN; k2++) {
        var a2 = (k2 / cp.petalN) * TAU - Math.PI / 2 + TAU / (cp.petalN * 2);
        ctx.fillStyle = hsla(hue, t.petalSat, Math.min(92, t.petalLight + 14), 0.9);
        ctx.save();
        ctx.translate(0, cyF);
        ctx.rotate(a2);
        ctx.beginPath();
        ctx.ellipse(petLen * 0.32, 0, petLen * 0.3, petW * 0.34, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    } else {
      // ---- closed bud peeking behind the rim ----
      var budH = bw * 0.32, budW = bw * 0.2;
      var lean = Math.sin(now * 1.4 + cp.phase) * 0.06;
      ctx.save();
      ctx.translate(0, -ry - budH * 0.4);
      ctx.rotate(lean);
      ctx.fillStyle = hsla(hue, t.petalSat - 20, t.petalLight - 12, 1);
      ctx.beginPath();
      ctx.ellipse(0, 0, budW, budH, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = hsla(120, 45, 45, 1);
      ctx.beginPath();
      ctx.ellipse(-budW * 0.7, budH * 0.35, budW * 0.55, budH * 0.3, -0.7, 0, TAU);
      ctx.ellipse(budW * 0.7, budH * 0.35, budW * 0.55, budH * 0.3, 0.7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // ---- stem ----
    ctx.fillStyle = 'rgba(80,150,80,0.9)';
    ctx.beginPath();
    ctx.moveTo(-bw * 0.07, depth * 0.9);
    ctx.lineTo(bw * 0.07, depth * 0.9);
    ctx.lineTo(bw * 0.1, depth * 1.35);
    ctx.lineTo(-bw * 0.1, depth * 1.35);
    ctx.closePath();
    ctx.fill();

    // ---- bowl body ----
    var bodyGrad = ctx.createLinearGradient(-rx, 0, rx, 0);
    bodyGrad.addColorStop(0, hsla(hue, 40, 88, 1));
    bodyGrad.addColorStop(0.5, hsla(hue, 34, 96, 1));
    bodyGrad.addColorStop(1, hsla(hue, 44, 82, 1));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-rx, 0);
    ctx.bezierCurveTo(-rx * 0.9, depth * 0.85, -rx * 0.45, depth, 0, depth);
    ctx.bezierCurveTo(rx * 0.45, depth, rx * 0.9, depth * 0.85, rx, 0);
    ctx.closePath();
    ctx.fill();

    // ---- liquid inside (clipped to bowl) ----
    if (cp.frac > 0.02) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-rx, 0);
      ctx.bezierCurveTo(-rx * 0.9, depth * 0.85, -rx * 0.45, depth, 0, depth);
      ctx.bezierCurveTo(rx * 0.45, depth, rx * 0.9, depth * 0.85, rx, 0);
      ctx.closePath();
      ctx.clip();
      var lvl = depth * (1 - cp.frac);
      ctx.fillStyle = liquidColor(0.9, cp.r * 25);
      ctx.beginPath();
      ctx.moveTo(-rx, lvl);
      var seg = 6;
      for (var s2 = 0; s2 <= seg; s2++) {
        var xx = -rx + (s2 / seg) * bw;
        var yy = lvl + Math.sin(now * 4 + s2 * 1.4 + cp.phase) * 1.6
                     + Math.sin(now * 7 + s2 * 2.6) * 0.8;
        ctx.lineTo(xx, yy);
      }
      ctx.lineTo(rx, depth + 2);
      ctx.lineTo(-rx, depth + 2);
      ctx.closePath();
      ctx.fill();
      // gloss on the liquid
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.3, lvl + (depth - lvl) * 0.45, rx * 0.22, (depth - lvl) * 0.2 + 1, 0.3, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // ---- mouth (rim) ----
    var brim = cp.units > cp.cap * 0.985;
    if (cp.frac > 0.9) {
      // liquid surface bulging right at the rim — hero moment
      var bulge = 1 + clamp((cp.frac - 0.9) * 0.5, 0, 0.05) + (brim ? 0.03 : 0);
      ctx.fillStyle = liquidColor(0.95, cp.r * 25);
      ctx.beginPath();
      ctx.ellipse(0, -ry * 0.15 * (brim ? 1.4 : 1), rx * 0.94 * bulge, ry * 0.8 * bulge, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.3, -ry * 0.3, rx * 0.25, ry * 0.28, 0.2, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = hsla(hue, 45, 70, 0.9);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.stroke();

    // near-full glow on the rim
    if (cp.frac > 0.75 && cp.state === 'bud') {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + 0.35 * Math.sin(now * 6)) * (cp.frac - 0.75) * 4 + ')';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + 2, ry + 2, 0, 0, TAU);
      ctx.stroke();
    }

    // ---- flower face (after bloom) ----
    if (b > 0.5) {
      var fa = clamp((b - 0.5) * 2, 0, 1);
      ctx.fillStyle = t.centerCol;
      ctx.beginPath();
      ctx.arc(0, cyF, bw * 0.15 * b, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,40,' + fa + ')';
      ctx.lineWidth = 1.6;
      var er = bw * 0.05;
      // happy closed eyes ˘ ˘ and a smile
      ctx.beginPath();
      ctx.arc(-bw * 0.055, cyF - bw * 0.015, er, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bw * 0.055, cyF - bw * 0.015, er, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, cyF + bw * 0.02, er * 0.9, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    // splash sparkle when receiving liquid
    if (now - cp.splashT < 0.1) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(0, -ry * 0.4, rx * 0.4, ry * 0.5, 0, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawCan() {
    var t = theme();
    var s = L.canS;
    var tip = canTip();
    ctx.save();
    ctx.translate(spoutX, L.canY);
    ctx.rotate(tip.tilt);

    // spout tube
    ctx.fillStyle = t.canDark;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, s * 0.05);
    ctx.lineTo(-s * 0.88, s * 0.42);
    ctx.lineTo(-s * 0.72, s * 0.56);
    ctx.lineTo(-s * 0.38, s * 0.24);
    ctx.closePath();
    ctx.fill();
    // spout head
    ctx.fillStyle = t.can;
    ctx.beginPath();
    ctx.arc(-s * 0.8, s * 0.49, s * 0.15, 0, TAU);
    ctx.fill();

    // handle
    ctx.strokeStyle = t.canDark;
    ctx.lineWidth = s * 0.11;
    ctx.beginPath();
    ctx.arc(s * 0.1, -s * 0.32, s * 0.32, Math.PI * 1.05, Math.PI * 1.98);
    ctx.stroke();

    // body
    ctx.fillStyle = t.can;
    ctx.beginPath();
    rr(ctx, -s * 0.52, -s * 0.34, s * 1.06, s * 0.78, s * 0.24);
    ctx.fill();
    // body shine
    ctx.fillStyle = t.canLight;
    ctx.beginPath();
    ctx.ellipse(-s * 0.2, -s * 0.1, s * 0.16, s * 0.26, 0.25, 0, TAU);
    ctx.fill();

    // kawaii face
    ctx.fillStyle = '#5a3b46';
    ctx.beginPath();
    ctx.arc(s * 0.02, s * 0.02, s * 0.045, 0, TAU);
    ctx.arc(s * 0.3, s * 0.02, s * 0.045, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5a3b46';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s * 0.16, s * 0.07, s * 0.08, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,150,0.4)';
    ctx.beginPath();
    ctx.arc(-s * 0.08, s * 0.1, s * 0.05, 0, TAU);
    ctx.arc(s * 0.4, s * 0.1, s * 0.05, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawHint() {
    if (everPoured) return;
    var bob = Math.sin(now * 4) * 8;
    ctx.save();
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now * 4);
    ctx.font = Math.round(L.canS * 0.9) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👆', spoutX + L.canS * 1.35, L.canY + L.canS * 0.7 + bob);
    ctx.restore();
    // pulsing circle around the can
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * Math.sin(now * 4)) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(spoutX, L.canY + L.canS * 0.1, L.canS * (1.15 + 0.1 * Math.sin(now * 4)), 0, TAU);
    ctx.stroke();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var q = particles[i];
      var lt = 1 - q.age / q.life;
      if (q.type === 'sparkle') {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.age * 4);
        ctx.globalAlpha = lt;
        ctx.strokeStyle = q.col || '#fff';
        ctx.lineWidth = 1.6;
        var s = q.size * (0.5 + lt);
        ctx.beginPath();
        ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
        ctx.moveTo(0, -s); ctx.lineTo(0, s);
        ctx.stroke();
        ctx.restore();
      } else if (q.type === 'drop') {
        ctx.globalAlpha = lt;
        ctx.fillStyle = liquidColor(0.9);
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (q.type === 'ring') {
        ctx.globalAlpha = lt * 0.8;
        ctx.strokeStyle = q.col || '#fff';
        ctx.lineWidth = 3 * lt + 1;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size * (1 + (1 - lt) * 1.6), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (q.type === 'emoji') {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(Math.sin(q.age * 3) * q.rot);
        ctx.globalAlpha = Math.min(1, lt * 2);
        ctx.font = Math.round(q.size) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(q.ch, 0, 0);
        ctx.restore();
      } else if (q.type === 'bigdrop') {
        ctx.fillStyle = liquidColor(0.95);
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(q.x - 1.5, q.y - 1.5, q.size * 0.35, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawButterflies() {
    for (var i = 0; i < butterflies.length; i++) {
      var b = butterflies[i];
      var flap = Math.abs(Math.sin(now * 9 + b.px));
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = hsla(b.hue, 80, 70, 0.95);
      ctx.beginPath();
      ctx.ellipse(-b.s * 0.6 * flap, 0, b.s * 0.75 * flap + 0.5, b.s * 0.55, -0.4, 0, TAU);
      ctx.ellipse(b.s * 0.6 * flap, 0, b.s * 0.75 * flap + 0.5, b.s * 0.55, 0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5a4632';
      ctx.beginPath();
      ctx.ellipse(0, 0, b.s * 0.14, b.s * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCelebrationOverlays() {
    // golden flash when the 10th flower blooms
    var gt = now - goldenT;
    if (gt >= 0 && gt < 1.2) {
      ctx.fillStyle = 'rgba(255,225,140,' + 0.28 * (1 - gt / 1.2) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (!finale) return;
    var ft = now - finaleT;
    // rotating light rays behind everything is expensive to layer correctly;
    // draw them softly on top with low alpha instead
    var raysA = ft < 6 ? 0.1 : 0.045;
    var cx = W / 2, cy = L.towerTop + L.rowH * 1.2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(now * 0.25);
    ctx.fillStyle = 'rgba(255,240,180,' + raysA + ')';
    for (var i = 0; i < 8; i++) {
      ctx.rotate(TAU / 8);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, Math.max(W, H), -0.13, 0.13);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (ft < 2.2) {
      ctx.fillStyle = 'rgba(255,255,255,' + 0.4 * (1 - ft / 2.2) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function draw() {
    drawBackground();
    drawColumn();
    drawGround();
    drawStreams();
    for (var i = cups.length - 1; i >= 0; i--) drawCup(cups[i]);
    drawCan();
    drawHint();
    drawButterflies();
    drawParticles();
    drawCelebrationOverlays();
  }

  /* =========================================================
     main loop
  ========================================================= */
  function frame(ts) {
    now = ts / 1000;
    var dt = Math.min(now - last, 0.05);
    last = now;
    if (dt > 0) update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  /* =========================================================
     UI wiring
  ========================================================= */
  document.getElementById('btnRestart').addEventListener('click', function () {
    audioInit(); audioResume();
    if (AU.ctx) sndDrip();
    reset(false);
  });
  document.getElementById('btnSound').addEventListener('click', function () {
    audioInit(); audioResume();
    toggleMute();
  });
  var themeBtns = document.querySelectorAll('.themeBtn');
  for (var tb = 0; tb < themeBtns.length; tb++) {
    themeBtns[tb].addEventListener('click', function () {
      audioInit(); audioResume();
      themeIdx = parseInt(this.getAttribute('data-theme'), 10);
      for (var k = 0; k < themeBtns.length; k++) themeBtns[k].classList.remove('active');
      this.classList.add('active');
      document.body.style.background = theme().skyTop;
      if (AU.ctx) { startPad(); sndRow(0); }
    });
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  // tiny state probe (used by automated checks; harmless in production)
  window.__state = function () {
    return { blooms: bloomCount, finale: finale, meadow: meadow.length, cups: cups.length };
  };

  /* =========================================================
     boot
  ========================================================= */
  makeCups();
  makeSky();
  resize();
  spoutX = spoutXTarget = W / 2;
  requestAnimationFrame(function (ts) { last = ts / 1000; requestAnimationFrame(frame); });

})();
