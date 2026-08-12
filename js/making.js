'use strict';
/* ============================================================
 * making.js — 制作台。
 * 子どもの一本の線がごちそうに育つ場所。
 * 状態: ready → draw → grow → top → pop → celebrate
 * ============================================================ */

const MakingScene = {
  shop: null,
  resident: null,
  t: 0,
  state: 'ready',
  toolIdx: 0,
  // ストローク
  raw: [],
  pending: [],           // まだstrokeCanvasに描いていない生点
  lastPt: null,
  path: null,
  isDot: false,
  growT: 0,
  seed: 1,
  // トッピング
  top: null,             // {x,y,kind}
  popT: 0,
  sprinkles: [],
  // 完成
  celebT: 0,
  workCanvas: null,
  savedWork: null,
  // 見た目
  baseCanvas: null,
  baseKey: '',
  strokeCanvas: null,
  strokeCtx: null,
  creamCanvas: null,     // 完成クリームのキャッシュ
  toolThumbs: new Map(),
  sparkles: [],
  hearts: [],
  hintT: 0,
  drawnOnce: false,
  undoPress: 0,
  homePress: 0,
  toolPress: -1,

  /* ---------- レイアウト ---------- */
  layout(w, h) {
    const portrait = h > w * 1.05;
    const toolbarH = Math.min(h * 0.17, Math.max(96, h * 0.13));
    const availH = h - toolbarH;
    let cx, cy, s;
    if (portrait) {
      s = Math.min(w * 0.94, availH * 0.72);
      cx = w * 0.5;
      cy = availH * 0.56;
    } else {
      s = Math.min(w * 0.52, availH * 0.86);
      cx = w * 0.42;
      cy = availH * 0.55;
    }
    const btnR = U.clamp(Math.min(w, h) * 0.062, 30, 46);
    const lay = {
      portrait, w, h, toolbarH, cx, cy, s,
      undo: { x: btnR * 1.5, y: btnR * 1.5, r: btnR },
      home: { x: w - btnR * 1.5, y: btnR * 1.5, r: btnR * 0.88 },
      tools: [],
      resident: portrait
        ? { x: w * 0.84, y: h - toolbarH - 8, hgt: Math.min(w, h) * 0.21 }
        : { x: w * 0.83, y: availH * 0.92, hgt: Math.min(w, h) * 0.30 },
    };
    const tr = Math.min(toolbarH * 0.40, w * 0.09);
    const gap = Math.min(w * 0.24, tr * 3.2);
    for (let i = 0; i < 3; i++) {
      lay.tools.push({ x: w / 2 + (i - 1) * gap, y: h - toolbarH / 2, r: tr });
    }
    return lay;
  },

  enter(shopId, resident) {
    this.shop = shopById(shopId);
    this.resident = resident || makeResident(0);
    this.t = 0;
    this.state = 'ready';
    this.toolIdx = 0;
    this.raw = [];
    this.pending = [];
    this.path = null;
    this.isDot = false;
    this.top = null;
    this.sprinkles = [];
    this.celebT = 0;
    this.workCanvas = null;
    this.savedWork = null;
    this.creamCanvas = null;
    this.sparkles = [];
    this.hearts = [];
    this.hintT = 0;
    this.drawnOnce = false;
    this.leaving = false;
    this.seed = 1 + ((Math.random() * 1e9) | 0);
    this.baseKey = '';
  },

  /* ---------- 土台のプリレンダ ---------- */
  ensureBase(w, h) {
    const key = `${w}x${h}|${this.shop.id}`;
    if (this.baseKey === key && this.baseCanvas) return;
    this.baseKey = key;
    const old = this.lay;
    this.lay = this.layout(w, h);
    // 回転・リサイズ時: 描いた線を新しいレイアウトへ写像して壊さない
    if (old && (old.cx !== this.lay.cx || old.cy !== this.lay.cy || old.s !== this.lay.s)) {
      const map = p => ({
        x: (p.x - old.cx) / old.s * this.lay.s + this.lay.cx,
        y: (p.y - old.cy) / old.s * this.lay.s + this.lay.cy,
      });
      if (this.state === 'draw') {
        // 描画途中の回転は仕切り直し(ポインタも失われるため)
        this.state = 'ready';
        this.raw = [];
        this.pending = [];
        SFX.drawLoopStop();
      } else if (this.raw.length) {
        this.raw = this.raw.map(map);
        if (this.path) this.path = buildPath(this.raw, Math.max(2.5, this.lay.s * 0.012));
      }
      if (this.top) {
        const m = map(this.top);
        this.top.x = m.x; this.top.y = m.y;
      }
      for (const sp of this.sprinkles) {
        const m = map({ x: sp.tx, y: sp.ty });
        sp.tx = m.x; sp.ty = m.y;
        const m2 = map({ x: sp.x, y: sp.y });
        sp.x = m2.x; sp.y = m2.y;
      }
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    this.paintRoom(ctx, w, h, this.lay);
    this.shop.drawBase(ctx, this.lay.cx, this.lay.cy, this.lay.s);
    this.baseCanvas = c;
    // ストローク用キャンバス
    this.strokeCanvas = document.createElement('canvas');
    this.strokeCanvas.width = Math.ceil(w * dpr);
    this.strokeCanvas.height = Math.ceil(h * dpr);
    this.strokeCtx = this.strokeCanvas.getContext('2d');
    this.strokeCtx.scale(dpr, dpr);
    this.creamCanvas = null;
    if (this.path) this.cacheCream(w, h); // 回転後の再構築
  },

  paintRoom(ctx, w, h, lay) {
    // 制作室のやわらかい背景
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#FCE7EE');
    g.addColorStop(0.55, '#FBF0E7');
    g.addColorStop(1, '#F6E0D2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 壁の水玉
    const rng = mulberry32(15);
    for (let i = 0; i < 26; i++) {
      const x = rng() * w, y = rng() * h * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${0.18 + rng() * 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y, 4 + rng() * 9, 0, U.TAU);
      ctx.fill();
    }
    // バンティング(旗かざり)
    const fx0 = w * 0.16, fx1 = w * 0.84, fy = h * 0.035;
    const sag = Math.min(h * 0.055, 46);
    ctx.strokeStyle = 'rgba(190,150,170,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx0, fy);
    ctx.quadraticCurveTo(w * 0.5, fy + sag * 2, fx1, fy);
    ctx.stroke();
    const fcols = ['#F6A8C4', '#FBDD8A', '#9BD8C6', '#AFC3F5', '#E9B4EE'];
    const fn = 8;
    for (let i = 0; i <= fn; i++) {
      const tt = i / fn;
      const fx = U.lerp(fx0, fx1, tt);
      const fyy = fy + Math.sin(Math.PI * tt) * sag * 1.5;
      const fs = Math.min(w, h) * 0.022;
      ctx.fillStyle = fcols[i % fcols.length];
      ctx.beginPath();
      ctx.moveTo(fx - fs, fyy);
      ctx.lineTo(fx + fs, fyy);
      ctx.lineTo(fx, fyy + fs * 1.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(fx - fs, fyy);
      ctx.lineTo(fx + fs, fyy);
      ctx.lineTo(fx + fs * 0.6, fyy + fs * 0.35);
      ctx.lineTo(fx - fs * 0.6, fyy + fs * 0.35);
      ctx.closePath();
      ctx.fill();
    }
    // 作業台(大理石風)
    const tableY = lay.cy + lay.s * 0.22;
    const tg = ctx.createLinearGradient(0, tableY, 0, h);
    tg.addColorStop(0, '#FDF6F0');
    tg.addColorStop(0.12, '#F7E9E4');
    tg.addColorStop(1, '#EDD5CC');
    ctx.fillStyle = tg;
    ctx.fillRect(0, tableY, w, h - tableY);
    ctx.strokeStyle = 'rgba(220,180,175,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, tableY);
    ctx.lineTo(w, tableY);
    ctx.stroke();
    // 大理石の筋
    ctx.strokeStyle = 'rgba(205,170,175,0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const y0 = tableY + rng() * (h - tableY);
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.bezierCurveTo(w * 0.3, y0 + rng() * 30 - 15, w * 0.6, y0 + rng() * 30 - 15, w, y0 + rng() * 20 - 10);
      ctx.stroke();
    }
  },

  /* ---------- ツールボタンのミニ渦巻き ---------- */
  toolThumb(tool, r) {
    const key = `${tool.col.name}|${Math.round(r)}`;
    if (!this.toolThumbs.has(key)) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = document.createElement('canvas');
      c.width = Math.ceil(r * 2 * dpr); c.height = Math.ceil(r * 2 * dpr);
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      const pts = makeRosette(r, r + r * 0.05, r * 0.66, 2.2, mulberry32(5));
      const path = buildPath(pts, 2);
      drawPiped(ctx, path, { W: r * 0.42, style: tool.style, col: tool.col, grow: 1, seed: 5, shadowOn: false });
      this.toolThumbs.set(key, c);
    }
    return this.toolThumbs.get(key);
  },

  /* ---------- ストローク確定 ---------- */
  finishStroke(w, h) {
    const lay = this.lay;
    SFX.drawLoopStop();
    let total = 0;
    for (let i = 1; i < this.raw.length; i++) {
      total += U.dist(this.raw[i - 1].x, this.raw[i - 1].y, this.raw[i].x, this.raw[i].y);
    }
    if (this.raw.length < 3 || total < lay.s * 0.02) {
      // 一点だけ → 小さなクリームのお花
      const p = this.raw[0] || this.lastPt;
      if (!p) { this.state = 'ready'; return; }
      this.isDot = true;
      const R = lay.s * this.shop.W * 0.9;
      this.raw = makeRosette(p.x, p.y, R, 2.3, mulberry32(this.seed));
    } else {
      this.isDot = false;
    }
    this.path = buildPath(this.raw, Math.max(2.5, lay.s * 0.012));
    this.state = 'grow';
    this.growT = 0;
    SFX.grow();
  },

  cacheCream(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const tool = this.shop.tools[this.toolIdx];
    drawPiped(ctx, this.path, {
      W: this.lay.s * this.shop.W * (this.isDot ? 0.8 : 1),
      style: tool.style, col: tool.col, grow: 1, seed: this.seed,
      drips: this.shop.id === 'donut',
    });
    this.creamCanvas = c;
  },

  /* ---------- 完成処理 ---------- */
  makeWork(w, h) {
    const lay = this.lay;
    const s = lay.s;
    const norm = p => ({ x: Math.round((p.x - lay.cx) / s * 1000) / 1000, y: Math.round((p.y - lay.cy) / s * 1000) / 1000 });
    // 保存用は間引いた生点(再構築で同じ形になる)
    let pts = dedupePts(this.raw, Math.max(2, s * 0.01));
    if (pts.length > 160) {
      const step = pts.length / 160;
      const out = [];
      for (let i = 0; i < 160; i++) out.push(pts[Math.floor(i * step)]);
      out.push(pts[pts.length - 1]);
      pts = out;
    }
    const work = {
      id: Game.nextId(),
      shop: this.shop.id,
      tool: this.toolIdx,
      seed: this.seed,
      pts: pts.map(norm),
      top: this.top ? { ...norm(this.top), kind: this.top.kind } : null,
    };
    this.savedWork = work;
    Game.addWork(work);
    this.workCanvas = renderWorkCanvas(work, Math.min(240, s * 0.5));
  },

  toppingKind() {
    const shop = this.shop;
    if (shop.topping === 'strawberry') return 'strawberry';
    if (shop.topping === 'sprinkles') return 'sprinkles';
    const t = shop.tools[this.toolIdx];
    return t.top || 'cherry';
  },

  /* ---------- 入力 ---------- */
  hitButton(x, y, b, grow) {
    const r = b.r * (grow || 1.35); // 当たり判定は見た目より広く
    return U.dist(x, y, b.x, b.y) <= r;
  },

  pointerDown(x, y, w, h) {
    this.ensureBase(w, h);
    const lay = this.lay;
    if (this.state === 'celebrate' || this.state === 'pop') return;

    // もどるボタン
    if (this.hitButton(x, y, lay.home)) {
      this.homePress = 1;
      SFX.tap();
      Main.gotoStreet(null);
      return;
    }
    // やりなおし
    if (this.hitButton(x, y, lay.undo)) {
      this.undoPress = 1;
      if (this.state === 'draw' || this.state === 'grow' || this.state === 'top' || this.state === 'ready') {
        SFX.tap();
        this.clearStroke(w, h);
      }
      return;
    }
    // クレヨン選択
    if (this.state === 'ready') {
      for (let i = 0; i < lay.tools.length; i++) {
        if (this.hitButton(x, y, lay.tools[i], 1.5)) {
          this.toolIdx = i;
          this.toolPress = i;
          SFX.tap();
          return;
        }
      }
    } else if (y > h - lay.toolbarH) {
      return; // 描けない状態でツールバーを触っても何も起きない
    }

    if (this.state === 'ready') {
      // お絵かき開始
      this.state = 'draw';
      this.drawnOnce = true;
      this.raw = [{ x, y }];
      this.pending = [];
      this.lastPt = { x, y, t: this.t };
      SFX.drawLoopSet(0.3);
      return;
    }
    if (this.state === 'top') {
      // 最後の「ぽん」
      this.top = { x, y, kind: this.toppingKind() };
      this.state = 'pop';
      this.popT = 0;
      SFX.pon();
      if (this.top.kind === 'sprinkles') {
        // タップ点から広がるスプリンクル(着地点は決定的レイアウトと同じ)
        const list = sprinkleLayout(x, y, lay.s * 0.17, this.seed, lay.s);
        this.sprinkles = list.map((sp, i) => ({
          ...sp, tx: sp.x, ty: sp.y, delay: i * 0.03, t: 0,
        }));
      }
      for (let i = 0; i < 8; i++) {
        this.sparkles.push({
          x, y, a: (i / 8) * U.TAU + Math.random() * 0.4,
          sp: U.rand(40, 120), r: U.rand(3, 7), t: 0, life: U.rand(0.4, 0.7),
          col: U.pick(['#FFE9A8', '#FFD1E0', '#FFFFFF']),
        });
      }
      return;
    }
  },

  pointerMove(x, y, w, h) {
    if (this.state !== 'draw') return;
    const lp = this.lastPt;
    // 画面外に少し出ても続行(座標をゆるくクランプ)
    x = U.clamp(x, -30, w + 30);
    y = U.clamp(y, -30, h + 30);
    const d = U.dist(lp.x, lp.y, x, y);
    if (d < 1.5) return;
    const p = { x, y };
    this.raw.push(p);
    this.pending.push({ ax: lp.x, ay: lp.y, bx: x, by: y, d });
    this.lastPt = { x, y, t: this.t };
    SFX.drawLoopSet(U.clamp(d / 14, 0.15, 1));
  },

  pointerUp(x, y, w, h) {
    if (this.state === 'draw') {
      this.finishStroke(w, h);
    }
  },

  clearStroke(w, h) {
    this.state = 'ready';
    this.raw = [];
    this.pending = [];
    this.path = null;
    this.top = null;
    this.creamCanvas = null;
    this.sprinkles = [];
    this.hintT = 0;
    SFX.drawLoopStop();
    if (this.strokeCtx) {
      this.strokeCtx.clearRect(0, 0, w, h);
    }
    this.seed = 1 + ((Math.random() * 1e9) | 0);
  },

  /* ---------- 更新 ---------- */
  update(dt, w, h) {
    this.t += dt;
    this.ensureBase(w, h);
    this.undoPress = Math.max(0, this.undoPress - dt * 4);
    this.homePress = Math.max(0, this.homePress - dt * 4);
    if (this.state === 'ready' || this.state === 'top') this.hintT += dt;

    // ライブ描画(即時反応)
    if (this.pending.length && this.strokeCtx) {
      const tool = this.shop.tools[this.toolIdx];
      const baseW = U.clamp(this.lay.s * this.shop.W * 0.42, 9, 22);
      for (const seg of this.pending) {
        const speedW = baseW * U.clamp(1 + (6 - seg.d) * 0.012, 0.9, 1.12);
        drawLiveSegment(this.strokeCtx, seg.ax, seg.ay, seg.bx, seg.by, speedW, tool.col);
      }
      this.pending = [];
    }

    if (this.state === 'grow') {
      this.growT += dt / 1.15;
      if (this.growT >= 1) {
        this.growT = 1;
        this.state = 'top';
        this.hintT = 0;
        this.cacheCream(w, h);
        if (this.strokeCtx) this.strokeCtx.clearRect(0, 0, w, h);
        SFX.pofu();
        SFX.bell(0.1);
      }
    }

    if (this.state === 'pop') {
      this.popT += dt;
      for (const sp of this.sprinkles) sp.t += dt;
      if (this.popT >= 0.55) {
        this.state = 'celebrate';
        this.celebT = 0;
        this.makeWork(w, h);
        SFX.bell();
      }
    }

    if (this.state === 'celebrate') {
      const was = this.celebT;
      this.celebT += dt;
      if (was < 1.3 && this.celebT >= 1.3) SFX.cheer();
      if (was < 1.55 && this.celebT >= 1.55) { SFX.munch(0); SFX.munch(0.22); }
      // ハート
      if (this.celebT > 1.4 && this.hearts.length < 3 && Math.random() < dt * 3.5) {
        const r = this.lay.resident;
        this.hearts.push({ x: r.x + U.rand(-20, 20), y: r.y - r.hgt * 1.1, t: 0 });
      }
      if (this.celebT >= 2.75 && !this.leaving) {
        this.leaving = true;
        Main.gotoStreet(this.shop.id);
      }
    }

    for (const sp of this.sparkles) sp.t += dt;
    this.sparkles = this.sparkles.filter(sp => sp.t < sp.life);
    for (const hh of this.hearts) hh.t += dt;
    this.hearts = this.hearts.filter(hh => hh.t < 1.6);
  },

  /* ---------- 描画 ---------- */
  draw(ctx, w, h) {
    this.ensureBase(w, h);
    const lay = this.lay;
    const tool = this.shop.tools[this.toolIdx];

    // ヒーローズーム(完成直後)
    let zoom = 1, zx = lay.cx, zy = lay.cy;
    if (this.state === 'celebrate') {
      const ct = this.celebT;
      if (ct < 0.9) zoom = 1 + 0.13 * Ease.inOutCubic(U.clamp(ct / 0.45, 0, 1)) * Ease.inOutCubic(U.clamp((0.9 - ct) / 0.45, 0, 1)) * 2;
      zoom = Math.min(zoom, 1.13);
    } else if (this.state === 'pop') {
      zoom = 1 + 0.02 * Math.sin(this.popT * 12);
    }
    ctx.save();
    if (zoom !== 1) {
      ctx.translate(zx, zy);
      ctx.scale(zoom, zoom);
      ctx.translate(-zx, -zy);
    }

    ctx.drawImage(this.baseCanvas, 0, 0, w, h);

    // ---- クリーム ----
    if (this.state === 'grow' && this.path) {
      // 成長中: ライブ線からクリームへ連続変化
      const p = Ease.outCubic(this.growT);
      if (this.strokeCanvas && this.growT < 0.3) {
        ctx.globalAlpha = 1 - this.growT / 0.3;
        ctx.drawImage(this.strokeCanvas, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      drawPiped(ctx, this.path, {
        W: lay.s * this.shop.W * (this.isDot ? 0.8 : 1),
        style: tool.style, col: tool.col, grow: p, seed: this.seed,
        drips: false,
      });
      // 成長の光が線を走る
      if (this.growT < 0.95 && this.path.total > 1) {
        const s = this.path;
        const target = p * s.total;
        let idx = 0;
        while (idx < s.pts.length - 1 && s.len[idx] < target) idx++;
        const gp = s.pts[idx];
        const gr = lay.s * 0.05;
        const gg = ctx.createRadialGradient(gp.x, gp.y, 1, gp.x, gp.y, gr);
        gg.addColorStop(0, 'rgba(255,252,230,0.9)');
        gg.addColorStop(1, 'rgba(255,252,230,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(gp.x, gp.y, gr, 0, U.TAU);
        ctx.fill();
        drawSparkle(ctx, gp.x, gp.y, gr * 0.4, this.t * 6, 0.9, '#FFF7D6');
      }
    } else if (this.creamCanvas && (this.state === 'top' || this.state === 'pop' || this.state === 'celebrate')) {
      ctx.drawImage(this.creamCanvas, 0, 0, w, h);
    } else if (this.strokeCanvas && this.state === 'draw') {
      ctx.drawImage(this.strokeCanvas, 0, 0, w, h);
    }

    // ---- トッピング ----
    if (this.top && (this.state === 'pop' || this.state === 'celebrate')) {
      const pt = this.state === 'pop' ? U.clamp(this.popT / 0.4, 0, 1) : 1;
      const pop = Ease.outBack(pt);
      if (this.top.kind === 'sprinkles') {
        for (const sp of this.sprinkles) {
          const tt = U.clamp((sp.t - sp.delay) / 0.3, 0, 1);
          if (tt <= 0) continue;
          const e = Ease.outCubic(tt);
          const sx = U.lerp(this.top.x, sp.tx, e);
          const sy = U.lerp(this.top.y, sp.ty, e) - Math.sin(e * Math.PI) * lay.s * 0.06;
          drawSprinkle(ctx, sx, sy, sp.a + (1 - e) * 3, sp.len, sp.w, sp.color);
        }
      } else {
        const s = lay.s;
        ctx.save();
        ctx.translate(this.top.x, this.top.y);
        ctx.scale(pop, pop);
        if (this.top.kind === 'strawberry') drawStrawberry(ctx, 0, 0, s * 0.20, this.seed);
        else if (this.top.kind === 'cherry') drawCherry(ctx, 0, 0, s * 0.17);
        else if (this.top.kind === 'heart') drawSugarHeart(ctx, 0, 0, s * 0.15, -0.15);
        else if (this.top.kind === 'star') drawSugarStar(ctx, 0, 0, s * 0.16, 0.12);
        ctx.restore();
      }
    }

    ctx.restore(); // zoom

    // ---- ヒント ----
    if (this.state === 'ready' && !Main.transition.active) this.drawDrawHint(ctx, lay);
    if (this.state === 'top' && this.hintT > 0.7) this.drawTapHint(ctx, lay);

    // ---- スパークル ----
    for (const sp of this.sparkles) {
      const e = Ease.outCubic(U.clamp(sp.t / sp.life, 0, 1));
      drawSparkle(ctx, sp.x + Math.cos(sp.a) * sp.sp * e, sp.y + Math.sin(sp.a) * sp.sp * e - e * 20,
        sp.r * (1 - e * 0.6), sp.a + sp.t * 4, 1 - e, sp.col);
    }

    // ---- 住民 ----
    this.drawResidentSide(ctx, lay);

    // ---- UI ----
    this.drawButtons(ctx, lay);
  },

  drawDrawHint(ctx, lay) {
    // 点線の例示スクイグル+ゆびのお手本(最初の1回はしっかり、以降は控えめ)
    const alpha = this.drawnOnce ? 0.35 : 0.8;
    const tt = (this.hintT % 2.4) / 2.4;
    const cx = lay.cx, cy = lay.cy - lay.s * (this.shop.id === 'cupcake' ? 0.13 : this.shop.id === 'donut' ? 0.28 : 0.11);
    const span = lay.s * 0.27;
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      pts.push({
        x: cx - span + u * span * 2,
        y: cy + Math.sin(u * Math.PI * 2.2) * lay.s * 0.055,
      });
    }
    ctx.save();
    ctx.globalAlpha = alpha * (0.6 + Math.sin(this.t * 2.5) * 0.2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.setLineDash([1, 14]);
    ctx.lineDashOffset = -this.t * 30;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    // 動くゆび玉
    const fi = Math.floor(Ease.inOutCubic(tt) * 40);
    const fp = pts[U.clamp(fi, 0, 40)];
    const fg = ctx.createRadialGradient(fp.x, fp.y, 1, fp.x, fp.y, 16);
    fg.addColorStop(0, 'rgba(255,255,255,0.95)');
    fg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fp.x, fp.y, 16, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  },

  drawTapHint(ctx, lay) {
    // 「ここをぽんっ」の妖精スパーク
    const wx = lay.cx + Math.sin(this.t * 0.9) * lay.s * 0.15;
    const wy = lay.cy - lay.s * 0.16 + Math.sin(this.t * 1.7) * lay.s * 0.05;
    const bounce = Math.abs(Math.sin(this.t * 3.2));
    const y = wy - bounce * 14;
    ctx.save();
    const pulse = (this.t % 1.1) / 1.1;
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - pulse)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wx, wy, 12 + pulse * 30, 0, U.TAU);
    ctx.stroke();
    drawSparkle(ctx, wx, y, 13, this.t * 2, 0.95, '#FFE9A8');
    drawSparkle(ctx, wx + 16, y - 12, 6, -this.t * 3, 0.8, '#FFD1E0');
    ctx.restore();
  },

  drawResidentSide(ctx, lay) {
    const r = lay.resident;
    let mood = 'idle';
    if (this.state === 'draw' || this.state === 'grow') mood = 'excite';
    if (this.state === 'pop') mood = 'cheer';
    if (this.state === 'celebrate') mood = this.celebT < 1.3 ? 'cheer' : 'eat';
    let sweet = null;
    // 完成品が住民の手へ飛ぶ
    if (this.state === 'celebrate' && this.workCanvas) {
      const ct = this.celebT;
      if (ct >= 0.8 && ct < 1.3) {
        const tt = Ease.inOutCubic(U.clamp((ct - 0.8) / 0.5, 0, 1));
        const sx = lay.cx, sy = lay.cy;
        const ex = r.x, ey = r.y - r.hgt * 0.65;
        const mx = U.lerp(sx, ex, tt);
        const my = U.lerp(sy, ey, tt) - Math.sin(tt * Math.PI) * lay.s * 0.25;
        const sc = U.lerp(0.9, 0.42, tt);
        const ws = this.workCanvas.width / Math.min(window.devicePixelRatio || 1, 2);
        ctx.save();
        ctx.translate(mx, my);
        ctx.scale(sc, sc);
        ctx.drawImage(this.workCanvas, -ws / 2, -ws / 2, ws, ws);
        ctx.restore();
      } else if (ct >= 1.3) {
        sweet = this.shop.id;
      }
    }
    drawResident(ctx, this.resident, r.x, r.y, r.hgt, {
      t: this.t, mood, flip: !lay.portrait, sweet: sweet === this.shop.id ? this.shop.id : null,
    });
    // ハート
    for (const hh of this.hearts) {
      const e = hh.t / 1.6;
      drawFloatHeart(ctx, hh.x + Math.sin(hh.t * 4) * 8, hh.y - e * 60, 13 * (1 - e * 0.3), 1 - e);
    }
  },

  /* ---------- ボタン ---------- */
  candyButton(ctx, x, y, r, baseCol, press, selected) {
    ctx.save();
    const sc = 1 - press * 0.12;
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    // 影
    ctx.fillStyle = 'rgba(150,90,110,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.18, r * 1.02, r * 0.95, 0, 0, U.TAU);
    ctx.fill();
    // 本体
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.35, '#FFF7F0');
    g.addColorStop(1, '#F2DCD2');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, U.TAU);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#F7C948';
      ctx.lineWidth = r * 0.13;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.02, 0, U.TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = r * 0.045;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.09, 0, U.TAU);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(220,175,190,0.8)';
      ctx.lineWidth = r * 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, U.TAU);
      ctx.stroke();
    }
    // つや
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.42, r * 0.26, r * 0.15, -0.5, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  },

  drawButtons(ctx, lay) {
    const canDraw = this.state === 'ready';
    // ---- ツールバー ----
    const barY = lay.h - lay.toolbarH;
    const bg = ctx.createLinearGradient(0, barY, 0, lay.h);
    bg.addColorStop(0, 'rgba(255,250,246,0.0)');
    bg.addColorStop(0.35, 'rgba(255,245,240,0.85)');
    bg.addColorStop(1, 'rgba(250,228,222,0.95)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, barY, lay.w, lay.toolbarH);

    for (let i = 0; i < lay.tools.length; i++) {
      const b = lay.tools[i];
      const sel = i === this.toolIdx;
      const dim = canDraw ? 1 : 0.45;
      ctx.save();
      ctx.globalAlpha = dim;
      const pulse = sel && canDraw ? 1 + Math.sin(this.t * 3.4) * 0.03 : 1;
      ctx.translate(b.x, b.y);
      ctx.scale(pulse, pulse);
      ctx.translate(-b.x, -b.y);
      this.candyButton(ctx, b.x, b.y, b.r, null, this.toolPress === i ? 0.5 : 0, sel);
      // 白いクリームでも見えるように、うっすら色付きの受け皿
      const dg = ctx.createRadialGradient(b.x, b.y - b.r * 0.2, b.r * 0.1, b.x, b.y, b.r * 0.82);
      dg.addColorStop(0, 'rgba(244,216,206,0.55)');
      dg.addColorStop(1, 'rgba(238,199,189,0.85)');
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.80, 0, U.TAU);
      ctx.fill();
      const th = this.toolThumb(this.shop.tools[i], b.r * 0.78);
      const ts = b.r * 1.56;
      ctx.drawImage(th, b.x - ts / 2, b.y - ts / 2, ts, ts);
      ctx.restore();
    }
    this.toolPress = -1;

    // ---- やりなおし(くるん矢印) ----
    {
      const b = lay.undo;
      const active = this.state === 'draw' || this.state === 'grow' || this.state === 'top';
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.4;
      this.candyButton(ctx, b.x, b.y, b.r, null, this.undoPress, false);
      ctx.strokeStyle = '#E8747C';
      ctx.fillStyle = '#E8747C';
      ctx.lineWidth = b.r * 0.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.44, Math.PI * 0.05, Math.PI * 1.55);
      ctx.stroke();
      // 矢じり
      const aa = Math.PI * 0.05;
      const ax = b.x + Math.cos(aa) * b.r * 0.44;
      const ay = b.y + Math.sin(aa) * b.r * 0.44;
      ctx.beginPath();
      ctx.moveTo(ax + b.r * 0.30, ay - b.r * 0.26);
      ctx.lineTo(ax + b.r * 0.02, ay - b.r * 0.34);
      ctx.lineTo(ax + b.r * 0.22, ay + b.r * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ---- おうち(通りへ戻る) ----
    {
      const b = lay.home;
      ctx.save();
      this.candyButton(ctx, b.x, b.y, b.r, null, this.homePress, false);
      // ちいさなお店アイコン
      ctx.fillStyle = '#B98BC9';
      ctx.beginPath();
      ctx.moveTo(b.x - b.r * 0.42, b.y - b.r * 0.02);
      ctx.lineTo(b.x, b.y - b.r * 0.44);
      ctx.lineTo(b.x + b.r * 0.42, b.y - b.r * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#D9AEE3';
      rr(ctx, b.x - b.r * 0.34, b.y - b.r * 0.02, b.r * 0.68, b.r * 0.44, b.r * 0.08);
      ctx.fill();
      ctx.fillStyle = '#8E5AA8';
      rr(ctx, b.x - b.r * 0.1, b.y + b.r * 0.1, b.r * 0.2, b.r * 0.32, b.r * 0.07);
      ctx.fill();
      ctx.restore();
    }
  },
};
