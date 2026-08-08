/* ------------------------------------------------------------------
   game.js — エンジン（レイアウト・カメラ・入力・描画パイプライン）
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const A = PZ.art;
  const S = PZ.snd;
  const TAU = U.TAU;

  const AUTO_HELP = 15;
  const GUIDE_DELAY = 1.1;

  /* カメラ枠（ワールド座標の矩形。contain で画面に収める） */
  const CAMS = {
    choose: { L: { x: 480, y: 260, w: 1180, h: 820 }, P: { x: 150, y: 300, w: 600, h: 1000 } },
    bench: { L: { x: -70, y: 655, w: 800, h: 520 }, P: { x: 140, y: 770, w: 620, h: 620 } },
    toss: { L: { x: -70, y: 470, w: 800, h: 520 }, P: { x: 140, y: 700, w: 620, h: 620 } },
    topping: { L: { x: -150, y: 660, w: 840, h: 570 }, P: { x: 130, y: 880, w: 640, h: 660 } },
    oven: { L: { x: 480, y: 390, w: 1150, h: 670 }, P: { x: 170, y: 380, w: 560, h: 930 } },
    bake: { L: { x: 900, y: 430, w: 620, h: 420 }, P: { x: 215, y: 400, w: 470, h: 450 } }
  };

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fx = document.createElement('canvas');
    this.fctx = this.fx.getContext('2d');

    this.dpr = 1;
    this.W = 0; this.H = 0;
    this.t = 0;
    this.parts = new A.Particles();
    this.pizza = new PZ.Pizza(2);
    this.recipe = PZ.RECIPES[0];

    this.pz = { visible: false, x: 0, y: 0, scale: 1, squash: 0.6, flip: 0, inOven: false, v: -1, shade: 1, groundY: null };
    this.peel = { visible: false, held: false, x: 0, y: 0, scale: 1, squash: 0.5, shade: 1, inOven: false, glow: 0, shadow: true, under: false };

    this.input = {
      down: false, x: 0, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, vx: 0, vy: 0,
      dt: 1 / 60, hist: [], moved: false, downTime: 0
    };
    this.pending = { down: false, up: false, x: 0, y: 0, has: false };

    this.idle = 0;
    this.autoT = AUTO_HELP;
    this.guideAlpha = 0;
    this.shakeAmt = 0;
    this.shakeT = 0;
    this.squish = 0;
    this.flare = 0;
    this.camPush = 0;
    this.fireLevel = 0.8;
    this.fireSmooth = 0.8;
    this.vBake = 0.60;
    this.chefX = 0;
    this.chefCut = null;
    this.stage = null;
    this.stageName = '';
    this.trans = 0;
  }

  /* ================================================================
     レイアウト
  ================================================================ */
  Game.prototype.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, Math.round(window.innerWidth));
    const h = Math.max(1, Math.round(window.innerHeight));
    this.dpr = dpr;
    this.W = w; this.H = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.fx.width = this.canvas.width;
    this.fx.height = this.canvas.height;
    this.buildWorld();
    this.applyCamTarget(true);
  };

  Game.prototype.buildWorld = function () {
    const land = (this.land = this.W >= this.H);
    if (land) {
      this.ov = {
        cx: 1195, baseY: 890, domeH: 640, domeHalfW: 410, pedestalH: 250,
        mHalfW: 250, mFrontY: 830, mTopY: 450, backY: 660, backHalfW: 128
      };
      this.board = { x: 330, y: 915, rx: 272, ry: 160 };
      this.counter = { x: 400, topY: 1000, halfW: 640, depth: 520 };
      this.pathA = { x: 686, y: 1012 };
      this.pathM = { x: 1195, y: 745 };
      this.pathB = { x: 1195, y: 668 };
      this.chefBase = { x: 815, y: 1024, scale: 1.0, faceDir: 1, ik: true };
      this.chefRest = { x: 900, y: 840 };
      this.wallTop = -400; this.wallBottom = 1030;
      this.worldW = 1700;
    } else {
      this.ov = {
        cx: 450, baseY: 880, domeH: 620, domeHalfW: 350, pedestalH: 220,
        mHalfW: 235, mFrontY: 800, mTopY: 440, backY: 640, backHalfW: 118
      };
      this.board = { x: 450, y: 1090, rx: 262, ry: 154 };
      this.counter = { x: 450, topY: 1272, halfW: 580, depth: 560 };
      this.pathA = { x: 450, y: 1348 };
      this.pathM = { x: 450, y: 722 };
      this.pathB = { x: 450, y: 655 };
      this.chefBase = { x: 200, y: 1300, scale: 0.60, faceDir: 1, ik: false };
      this.chefRest = { x: 320, y: 1150 };
      this.wallTop = -400; this.wallBottom = 1300;
      this.worldW = 1000;
    }
    this.props = land
      ? [{ kind: 'sack', x: -130, y: this.counter.topY - 4, s: 1 },
         { kind: 'basket', x: 30, y: this.counter.topY - 2, s: 0.95 },
         { kind: 'basket', x: 690, y: this.counter.topY - 2, s: 0.8 }]
      : [{ kind: 'basket', x: 716, y: this.counter.topY - 4, s: 0.86 }];
    this.ov.flameX = this.ov.cx + (land ? 62 : 42);

    const dx = this.pathA.x - this.pathM.x, dy = this.pathA.y - this.pathM.y;
    const dl = Math.hypot(dx, dy) || 1;
    this.nearDir = { x: dx / dl, y: dy / dl };

    // 炎の方位（床面での向き。焼きムラの計算に使う）
    const q = this.pathAt(this.vBake);
    const fdx = this.ov.flameX - q.x;
    const fdy = (this.ov.backY - q.y) / Math.max(0.15, q.squash);
    this.flameAngle = Math.atan2(fdy, fdx);
    this.chefX = this.chefBase.x;
    this.buildStatic();
  };

  /* 動かない背景（壁・窯の外観）はあらかじめ焼いておく */
  function bakeLayer(rect, px, fn) {
    const c = document.createElement('canvas');
    const s = Math.min(px / rect.w, px / rect.h, 1.1);
    c.width = Math.max(2, Math.round(rect.w * s));
    c.height = Math.max(2, Math.round(rect.h * s));
    const x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, -rect.x * s, -rect.y * s);
    fn(x);
    return { canvas: c, rect: rect };
  }

  Game.prototype.buildStatic = function () {
    const self = this;
    const wr = { x: -600, y: this.wallTop, w: this.worldW + 1200, h: this.wallBottom - this.wallTop };
    this.wallLayer = bakeLayer(wr, 1400, function (x) {
      A.drawWall(x, self.worldW, self.wallTop, self.wallBottom, 0);
    });
    const o = this.ov;
    const fr = {
      x: o.cx - o.domeHalfW - 90, y: o.baseY - o.domeH * 1.16,
      w: o.domeHalfW * 2 + 180, h: o.domeH * 1.16 + o.pedestalH + 160
    };
    this.facadeLayer = bakeLayer(fr, 1250, function (x) {
      A.drawOvenFacade(x, o, 0, 1);
    });
    const c = this.counter, pr = this.props;
    const cr = {
      x: c.x - c.halfW - 40, y: c.topY - 230,
      w: c.halfW * 2 + 80, h: c.depth + 280
    };
    this.counterLayer = bakeLayer(cr, 1500, function (x) {
      A.drawCounter(x, c.x, c.topY, c.halfW, c.depth);
      A.drawProps(x, pr);
    });
  };

  Game.prototype.blit = function (ctx, layer) {
    if (!layer) return;
    const r = layer.rect;
    ctx.drawImage(layer.canvas, r.x, r.y, r.w, r.h);
  };

  /* v: -1(手前) → 0(窯口) → 1(いちばん奥) */
  Game.prototype.pathAt = function (v) {
    const A1 = this.pathA, M = this.pathM, B = this.pathB;
    const s1x = A1.x + (M.x - A1.x) * (v + 1), s1y = A1.y + (M.y - A1.y) * (v + 1);
    const s2x = M.x + (B.x - M.x) * v, s2y = M.y + (B.y - M.y) * v;
    const w = U.smooth((v + 0.3) / 0.6);
    const scale = v <= 0 ? U.lerp(1.0, 0.78, v + 1) : U.lerp(0.78, 0.52, v);
    const squash = v <= 0 ? U.lerp(0.60, 0.44, v + 1) : U.lerp(0.44, 0.36, v);
    const shade = v <= 0 ? U.lerp(1.0, 0.94, v + 1) : U.lerp(0.94, 0.70, v);
    return {
      x: s1x + (s2x - s1x) * w, y: s1y + (s2y - s1y) * w,
      scale: scale, squash: squash, shade: shade
    };
  };

  Game.prototype.projectV = function (wx, wy) {
    let best = -1, bd = Infinity;
    for (let i = 0; i <= 56; i++) {
      const v = -1.25 + (i / 56) * 2.3;
      const p = this.pathAt(v);
      const d = U.dist2(wx, wy, p.x, p.y);
      if (d < bd) { bd = d; best = v; }
    }
    for (let i = -4; i <= 4; i++) {
      const v = best + i * 0.01;
      const p = this.pathAt(v);
      const d = U.dist2(wx, wy, p.x, p.y);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  };

  /* ================================================================
     カメラ
  ================================================================ */
  Game.prototype.camRect = function (name) {
    const c = CAMS[name] || CAMS.bench;
    const r = this.land ? c.L : c.P;
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  };

  Game.prototype.applyCamTarget = function (instant) {
    const name = (this.stage && this.stage.cam) || 'bench';
    this.camT = this.camRect(name);
    if (instant || !this.cam) this.cam = { x: this.camT.x, y: this.camT.y, w: this.camT.w, h: this.camT.h };
  };

  Game.prototype.camUpdate = function (dt) {
    if (!this.camT) this.applyCamTarget(true);
    const c = this.cam, t = this.camT;
    const rate = 3.4;
    c.x = U.approach(c.x, t.x, rate, dt);
    c.y = U.approach(c.y, t.y, rate, dt);
    c.w = U.approach(c.w, t.w, rate, dt);
    c.h = U.approach(c.h, t.h, rate, dt);
    const push = 1 - this.camPush * 0.045;
    this.zoom = Math.min(this.W / c.w, this.H / c.h) / push;
    this.camTX = this.W / 2 - (c.x + c.w / 2) * this.zoom;
    this.camTY = this.H / 2 - (c.y + c.h / 2) * this.zoom;
  };

  Game.prototype.applyCam = function (ctx) {
    const sh = this.shakeAmt;
    const ox = sh ? Math.sin(this.shakeT * 47) * sh : 0;
    const oy = sh ? Math.cos(this.shakeT * 39) * sh : 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.camTX + ox, this.camTY + oy);
    ctx.scale(this.zoom, this.zoom);
  };

  Game.prototype.toWorld = function (sx, sy) {
    return { x: (sx - this.camTX) / this.zoom, y: (sy - this.camTY) / this.zoom };
  };
  Game.prototype.toScreen = function (wx, wy) {
    return { x: wx * this.zoom + this.camTX, y: wy * this.zoom + this.camTY };
  };

  /* ================================================================
     ステージ制御
  ================================================================ */
  Game.prototype.setStage = function (name) {
    if (this.stage && this.stage.exit) this.stage.exit(this);
    this.stage = PZ.stages[name];
    this.stageName = name;
    this.pz.flip = 0;
    this.pz.shade = 1;
    this.chefCut = null;
    this.wake();
    this.trans = 1;
    if (this.stage.enter) this.stage.enter(this);
    this.applyCamTarget(false);
  };

  Game.prototype.wake = function () {
    this.idle = 0;
    this.autoT = AUTO_HELP;
  };
  Game.prototype.shake = function (a) { this.shakeAmt = Math.max(this.shakeAmt, a); };

  /* ================================================================
     入力
  ================================================================ */
  Game.prototype.bindInput = function () {
    const self = this;
    const c = this.canvas;
    let pid = null;
    const q = (this.queue = []);

    function pos(e) {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function push(kind, e) {
      const p = pos(e);
      if (q.length > 120) q.shift();
      q.push({ k: kind, x: p.x, y: p.y, t: U.now() / 1000 });
    }
    function onDown(e) {
      if (pid !== null) return;
      pid = e.pointerId === undefined ? 1 : e.pointerId;
      push('d', e);
      S.unlock();
      if (e.preventDefault) e.preventDefault();
    }
    function onMove(e) {
      if (pid === null) return;
      if (e.pointerId !== undefined && e.pointerId !== pid) return;
      // 端末がまとめた中間点も拾って、指の軌跡を取りこぼさない
      if (e.getCoalescedEvents) {
        const list = e.getCoalescedEvents();
        if (list && list.length > 1) {
          for (let i = 0; i < list.length; i++) push('m', list[i]);
          if (e.preventDefault) e.preventDefault();
          return;
        }
      }
      push('m', e);
      if (e.preventDefault) e.preventDefault();
    }
    function onUp(e) {
      if (pid === null) return;
      if (e.pointerId !== undefined && e.pointerId !== pid) return;
      push('u', e);
      pid = null;
      if (e.preventDefault) e.preventDefault();
    }

    if (window.PointerEvent) {
      c.addEventListener('pointerdown', onDown, { passive: false });
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp, { passive: false });
      window.addEventListener('pointercancel', onUp, { passive: false });
    } else {
      c.addEventListener('touchstart', function (e) { onDown(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
      window.addEventListener('touchmove', function (e) { onMove(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
      window.addEventListener('touchend', function (e) { onUp(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
      c.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  /* 入力は「イベントが起きた時刻つきの点列」として処理する。
     こうしておくと、描画が重い端末でもフリックの速さを取りこぼさない。 */
  Game.prototype.processInput = function (dt) {
    const i = this.input, st = this.stage;
    const q = this.queue;
    if (!q) return;
    i.dt = dt;

    // 1 フレームに大量に溜まったら間引く（先頭・末尾は必ず残す）
    if (q.length > 24) {
      const keep = [];
      const step = q.length / 20;
      for (let k = 0; k < q.length; k++) {
        if (q[k].k !== 'm' || k === q.length - 1 || Math.floor(k / step) !== Math.floor((k - 1) / step)) keep.push(q[k]);
      }
      q.length = 0;
      for (let k = 0; k < keep.length; k++) q.push(keep[k]);
    }

    let n = q.length;
    for (let k = 0; k < n; k++) {
      const e = q[k];
      const w = this.toWorld(e.x, e.y);
      if (e.k === 'd') {
        i.down = true; i.sx = e.x; i.sy = e.y;
        i.x = w.x; i.y = w.y; i.lx = w.x; i.ly = w.y;
        i.vx = 0; i.vy = 0; i.moved = false; i.downTime = e.t;
        i.lastT = e.t;
        i.hist.length = 0;
        i.hist.push({ t: e.t, x: w.x, y: w.y });
        this.wake();
        if (st && st.down) st.down(this);
      } else if (e.k === 'm') {
        if (!i.down) continue;
        const sdt = U.clamp(e.t - (i.lastT || e.t), 0.001, 0.1);
        i.lastT = e.t;
        i.dt = sdt;
        i.lx = i.x; i.ly = i.y;
        i.sx = e.x; i.sy = e.y;
        i.x = w.x; i.y = w.y;
        i.vx = (i.x - i.lx) / sdt;
        i.vy = (i.y - i.ly) / sdt;
        i.hist.push({ t: e.t, x: i.x, y: i.y });
        while (i.hist.length > 24) i.hist.shift();
        if (Math.abs(i.x - i.lx) > 0.01 || Math.abs(i.y - i.ly) > 0.01) i.moved = true;
        if (st && st.move) st.move(this);
      } else {
        if (!i.down) continue;
        i.sx = e.x; i.sy = e.y;
        i.x = w.x; i.y = w.y;
        // 直近 130ms のふり速度（フリック判定用）
        let ref = i.hist[0];
        for (let m = i.hist.length - 1; m >= 0; m--) {
          if (e.t - i.hist[m].t >= 0.13) { ref = i.hist[m]; break; }
          ref = i.hist[m];
        }
        const el = Math.max(0.016, e.t - ref.t);
        i.vx = (i.x - ref.x) / el;
        i.vy = (i.y - ref.y) / el;
        i.dt = dt;
        if (st && st.up) st.up(this);
        i.down = false;
        i.vx = 0; i.vy = 0;
      }
    }
    q.length = 0;
    i.dt = dt;
  };

  /* ================================================================
     更新
  ================================================================ */
  Game.prototype.update = function (dt) {
    this.t += dt;
    this.fireLevel = 0.8;
    this.pz.visible = true;
    this.pz.inOven = false;
    this.pz.groundY = null;
    this.peel.visible = false;
    this.peel.under = false;
    this.peel.held = false;
    this.chefCut = null;

    this.camUpdate(dt);
    this.processInput(dt);

    if (this.stage && this.stage.update) this.stage.update(this, dt);

    // 職人はピールを持つ手に体を寄せる（押し込むと前へ、引くと後ろへ）
    if (this.chefBase.ik && this.peel.held) {
      const h = this.chefHands();
      const tgt = U.clamp(h.handR.x - 120, this.chefBase.x - 300, this.chefBase.x + 240);
      this.chefX = U.approach(this.chefX, tgt, 5.5, dt);
    } else {
      this.chefX = U.approach(this.chefX, this.chefBase.x, 3.5, dt);
    }

    this.parts.update(dt);
    this.pizza.updateToppings(dt);

    this.idle += dt;
    this.guideAlpha = U.approach(this.guideAlpha, this.idle > GUIDE_DELAY ? 1 : 0,
      this.idle > GUIDE_DELAY ? 2.2 : 9, dt);
    if (this.input.down) this.guideAlpha = U.approach(this.guideAlpha, 0.18, 8, dt);

    this.autoT -= dt;
    if (this.autoT <= 0 && this.stage && this.stage.auto) {
      this.stage.auto(this);
      if (this.autoT <= 0) this.autoT = AUTO_HELP;
    }

    this.shakeT += dt;
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 46);
    this.squish = Math.max(0, this.squish - dt * 3.2);
    this.flare = Math.max(0, this.flare - dt * 1.6);
    this.camPush = Math.max(0, this.camPush - dt * 1.4);
    this.trans = Math.max(0, this.trans - dt * 2.6);

    this.fireSmooth = U.approach(this.fireSmooth, this.fireLevel + this.flare * 0.5, 3, dt);
    S.fireLevel(this.fireSmooth * 0.9);
    S.updateMusic(dt);
    this.applyCamTarget(false);
  };

  /* ================================================================
     描画
  ================================================================ */
  Game.prototype.drawPizza = function (ctx) {
    const p = this.pz;
    const sq = p.squash * (1 - this.squish * 0.30);
    const sc = p.scale * (1 + this.squish * 0.10);
    if (p.inOven) {
      // 石床への接地影
      ctx.save();
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = '#1a0703';
      U.ellipse(ctx, p.x, p.y + this.pizza.meanR() * sc * sq * 0.30,
        this.pizza.meanR() * sc * 0.99, this.pizza.meanR() * sc * sq * 0.72);
      ctx.fill();
      ctx.restore();
    }
    // 空中にいるときは、影は台の上に落として小さくする
    const air = p.groundY !== null ? Math.max(0, p.groundY - p.y) : 0;
    const shY = p.groundY !== null
      ? (p.groundY - p.y) + this.pizza.meanR() * sq * 0.16
      : this.pizza.meanR() * sq * 0.16;
    this.pizza.draw(ctx, p.x, p.y, sc, sq, {
      flip: p.flip,
      shadow: !p.inOven,
      shadowY: shY,
      shadowScale: air > 0 ? U.clamp(1 - air / 620, 0.42, 1) : 1,
      shadowAlpha: air > 0 ? U.clamp(0.3 - air / 1500, 0.10, 0.3) : 0.3,
      cuts: this.stageName === 'CUT' || this.stageName === 'DONE',
      spread: this.pizza.cuts.length >= 4 ? 4 : 0,
      sliceLift: this.sliceLiftInfo()
    });
    if (p.inOven) {
      // 窯の中の陰影と炎の照り
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, sq);
      const m = this.pizza.meanR() * sc;
      ctx.beginPath(); ctx.arc(0, 0, m * 1.01, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(30,8,2,' + (1 - p.shade) * 1.5 + ')';
      ctx.fillRect(-m, -m, m * 2, m * 2);
      ctx.globalCompositeOperation = 'lighter';
      const fa = this.flameAngle - 0;
      const fx = Math.cos(fa) * m * 0.8, fy = Math.sin(fa) * m * 0.8;
      const gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, m * 1.8);
      gr.addColorStop(0, 'rgba(255,150,60,0.42)');
      gr.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(-m, -m, m * 2, m * 2);
      ctx.restore();
    }
  };

  Game.prototype.sliceLiftInfo = function () {
    const st = this.stage;
    if (st && st.lift && st.lift.k > 0.01) {
      const l = st.lift;
      return {
        index: l.index,
        x: Math.cos(l.mid - this.pizza.rot) * 190 * l.k,
        y: Math.sin(l.mid - this.pizza.rot) * 190 * l.k - 60 * l.k
      };
    }
    return null;
  };

  Game.prototype.peelDir = function () { return this.nearDir; };

  Game.prototype.chefHands = function () {
    const s = this.chefBase.scale;
    if (this.peel.held && this.chefBase.ik) {
      const d = this.nearDir;
      const rest = this.chefRest;
      let sProj = (rest.x - this.peel.x) * d.x + (rest.y - this.peel.y) * d.y;
      const minS = 210 * this.peel.scale + 60;
      sProj = U.clamp(sProj, minS, 1500);
      const hr = { x: this.peel.x + d.x * sProj, y: this.peel.y + d.y * sProj };
      const hl = { x: this.peel.x + d.x * (sProj + 130), y: this.peel.y + d.y * (sProj + 130) };
      return { handR: hr, handL: hl, grip: sProj + 160 };
    }
    const b = this.chefBase;
    // 手ぶらのときは腕をすっと下ろす（手は作業台のかげに入る）
    const sw = Math.sin(this.t * 1.5) * 3 * s;
    return {
      handR: { x: this.chefX + 76 * s, y: b.y + 24 * s + sw },
      handL: { x: this.chefX - 76 * s, y: b.y + 24 * s - sw },
      grip: 0
    };
  };

  Game.prototype.drawChefNow = function (ctx, hands) {
    const b = this.chefBase;
    A.drawChef(ctx, this.chefX, b.y, b.scale, {
      faceDir: b.faceDir, t: this.t,
      handR: hands.handR, handL: hands.handL
    });
  };

  Game.prototype.drawPeelNow = function (ctx, part, grip) {
    const p = this.peel;
    const d = this.nearDir;
    if (p.glow > 0.02 && part !== 'handle') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      A.glow(ctx, p.x, p.y, 240 * p.scale,
        'rgba(255,226,150,' + 0.22 * p.glow * (0.6 + 0.4 * Math.sin(this.t * 3.6)) + ')',
        'rgba(255,226,150,0)');
      ctx.restore();
    }
    A.drawPeel(ctx, p.x, p.y, d.x, d.y, p.scale, p.squash, {
      shade: p.shade, shadow: p.shadow, part: part,
      gripCenter: grip ? grip - 95 : 0,
      handleLen: Math.max(620, (grip || 0) + 150)
    });
  };

  Game.prototype.ovenPass = function () {
    const ctx = this.ctx, f = this.fctx, ov = this.ov;
    const fire = this.fireSmooth;

    // 0) 窯の外観（静的レイヤ）— 窯口の中身はこのあと上から重ねる
    ctx.save();
    this.applyCam(ctx);
    this.blit(ctx, this.facadeLayer);
    ctx.restore();

    const hands = this.chefHands();
    const top = this.toScreen(ov.cx, ov.mTopY - ov.mHalfW * 0.3);
    const bot = this.toScreen(ov.cx, ov.mFrontY);
    const y0 = Math.max(0, Math.floor(top.y) - 4);
    const y1 = Math.min(this.H, Math.ceil(bot.y) + 4);
    // 窯が小さくしか映っていないときは、ゆらぎ用の中間バッファを省く
    const shimmer = (y1 - y0) > this.H * 0.20 && y1 > 0 && y0 < this.H;

    if (!shimmer) {
      ctx.save();
      this.applyCam(ctx);
      A.drawOvenInterior(ctx, ov, this.t, fire);
      if (this.peel.visible && this.peel.inOven) this.drawPeelNow(ctx, 'blade', hands.grip);
      if (this.pz.visible && this.pz.inOven) this.drawPizza(ctx);
      ctx.restore();
    } else {
      // 1) 窯の中身をオフスクリーンへ
      f.setTransform(1, 0, 0, 1, 0, 0);
      f.clearRect(0, (y0 - 6) * this.dpr, this.fx.width, (y1 - y0 + 12) * this.dpr);
      this.applyCam(f);
      A.drawOvenInterior(f, ov, this.t, fire);
      if (this.peel.visible && this.peel.inOven) this.drawPeelNow(f, 'blade', hands.grip);
      if (this.pz.visible && this.pz.inOven) this.drawPizza(f);

      // 2) 熱でゆらぐ空気（横スライスをずらして転写）
      ctx.save();
      this.applyCam(ctx);
      A.ovenMouthPath(ctx, ov);
      ctx.clip();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const step = 5;
      const heat = 0.6 + fire * 0.5;
      for (let y = y0; y < y1; y += step) {
        const u = (y - y0) / Math.max(1, y1 - y0);
        const edge = Math.min(1, Math.min(u, 1 - u) * 5);   // 上下のふちでは弱める
        const amp = (1.1 + 1.5 * (1 - u)) * heat * edge;
        const dx = Math.sin(y * 0.075 + this.t * 4.6) * amp + Math.sin(y * 0.021 - this.t * 2.7) * amp * 0.5;
        const sh = Math.min(step, y1 - y);
        ctx.drawImage(this.fx,
          0, y * this.dpr, this.fx.width, sh * this.dpr,
          dx, y, this.W, sh);
      }
      ctx.restore();
    }

    // 3) 窯口の内ぶち＋もれ出る光
    ctx.save();
    this.applyCam(ctx);
    A.drawOvenMouthEdge(ctx, ov);
    A.drawOvenGlow(ctx, ov, fire);
    ctx.restore();
  };

  Game.prototype.draw = function () {
    const ctx = this.ctx;
    const ov = this.ov;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);

    const mouth = this.toScreen(ov.cx, ov.mFrontY - ov.mHalfW * 0.4);
    A.drawBackdrop(ctx, this.W, this.H, {
      x: mouth.x, y: mouth.y, r: Math.max(this.W, this.H) * 0.9,
      i: U.sat(this.fireSmooth)
    });

    // --- ワールド ---
    ctx.save();
    this.applyCam(ctx);
    this.blit(ctx, this.wallLayer);
    ctx.restore();

    // 石窯（中身＋ゆらぎ＋外観）
    this.ovenPass();

    const hands = this.chefHands();

    // 職人（窯の前に立つ）
    ctx.save();
    this.applyCam(ctx);
    this.drawChefNow(ctx, hands);
    // 作業台（職人の下半身を隠す）
    this.blit(ctx, this.counterLayer);
    ctx.restore();

    // --- 手前のもの ---
    ctx.save();
    this.applyCam(ctx);

    if (this.stage && this.stage.drawWorld) this.stage.drawWorld(this, ctx);

    // 板（生地をさわる場面）
    if (['DOUGH', 'SHAPE', 'TOSS', 'SAUCE', 'TOPPING'].indexOf(this.stageName) >= 0) {
      A.drawBoard(ctx, this.board.x, this.board.y + 8, this.board.rx, this.board.ry, 0.8);
    }

    // ピール（窯の外にあるとき、ピザの下）
    if (this.peel.visible && !this.peel.inOven) this.drawPeelNow(ctx, 'all', hands.grip);
    // ピザ（窯の外）
    if (this.pz.visible && !this.pz.inOven) this.drawPizza(ctx);
    // ピールの柄（窯の中にあるときは外観より手前へ）
    if (this.peel.visible && this.peel.inOven) this.drawPeelNow(ctx, 'handle', hands.grip);

    // 職人の手（柄の上に重ねて握って見せる）
    if (this.peel.held && this.chefBase.ik) {
      ctx.fillStyle = U.css(A.colors.skin);
      ctx.beginPath(); ctx.arc(hands.handR.x, hands.handR.y, 19 * this.chefBase.scale, 0, TAU); ctx.fill();
      ctx.fillStyle = U.css(A.colors.skinShade);
      ctx.beginPath(); ctx.arc(hands.handL.x, hands.handL.y, 17 * this.chefBase.scale, 0, TAU); ctx.fill();
    }

    if (this.stage && this.stage.drawTop) this.stage.drawTop(this, ctx);

    this.parts.draw(ctx);

    if (this.guideAlpha > 0.02 && this.stage && this.stage.guide) {
      this.stage.guide(this, ctx, this.guideAlpha);
    }
    ctx.restore();

    // --- 画面座標の UI ---
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.stage && this.stage.drawScreen) this.stage.drawScreen(this, ctx);
    if (this.guideAlpha > 0.02 && this.stage && this.stage.guideScreen) {
      this.stage.guideScreen(this, ctx, this.guideAlpha);
    }

    // 画面のふち（あたたかいビネット）
    const vg = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35,
      this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(30,10,4,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.W, this.H);

    if (this.trans > 0.01) {
      ctx.fillStyle = 'rgba(255,240,220,' + this.trans * 0.22 + ')';
      ctx.fillRect(0, 0, this.W, this.H);
    }
  };

  /* ================================================================
     起動
  ================================================================ */
  Game.prototype.start = function () {
    const self = this;
    this.resize();
    this.bindInput();
    this.setStage('CHOOSE');
    let last = U.now();
    function loop(now) {
      const t = now === undefined ? U.now() : now;
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.05) dt = 0.05;
      if (dt < 0) dt = 0;
      self.update(dt);
      self.draw();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    window.addEventListener('resize', function () { self.resize(); });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { self.resize(); }, 120);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () { self.resize(); });
    }
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) last = U.now();
    });
  };

  /* ---- 起動 ---- */
  function boot() {
    const canvas = document.getElementById('game');
    const g = new Game(canvas);
    window.PZ.game = g;
    g.start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
