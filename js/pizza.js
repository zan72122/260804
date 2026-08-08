/* ------------------------------------------------------------------
   pizza.js — ピザそのもののモデルと描画
   ・生地は 72 点の可変半径ポリゴン（押すと伸び、回すとまるくなる）
   ・オフスクリーンに真上から描き、ゲーム側で潰して 3/4 視点にする
   ・焼成は「炎に近い側ほど焦げる」ため、窯の中で回す意味が生まれる
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const A = PZ.art;
  const C = A.colors;
  const TAU = U.TAU;

  const N = 72;               // 生地の輪郭点数
  const HALF = 240;           // オフスクリーンの半径（モデル単位）
  const MAXR = 200;           // ピザ最大半径（モデル単位）

  function Pizza(supersample) {
    this.SS = supersample || 2;
    const px = Math.round(HALF * 2 * this.SS);
    this.oc = document.createElement('canvas');
    this.oc.width = px; this.oc.height = px;
    this.octx = this.oc.getContext('2d');

    this.sc = document.createElement('canvas');   // ソース層
    this.sc.width = px; this.sc.height = px;
    this.sctx = this.sc.getContext('2d');

    this.reset();
  }
  PZ.Pizza = Pizza;
  Pizza.MAXR = MAXR;
  Pizza.HALF = HALF;

  Pizza.prototype.reset = function () {
    this.rad = new Float32Array(N);
    this.vel = new Float32Array(N);
    this.r0 = 46;                       // 生地玉の半径
    for (let i = 0; i < N; i++) this.rad[i] = this.r0 * (0.95 + Math.random() * 0.1);
    this.rot = 0;
    this.spin = 0;
    this.thick = 26;
    this.rimPuff = 0;
    this.bake = 0;
    this.flourAmt = 1;
    this.toppings = [];
    this.charSpots = [];
    this.blisters = [];
    this.cuts = [];
    this.sauceCover = 0;
    this.sauceCells = null;
    this.sauceCellsN = 0;
    this.sctx.setTransform(1, 0, 0, 1, 0, 0);
    this.sctx.clearRect(0, 0, this.sc.width, this.sc.height);
    this.dirty = true;
    this.bakeGlow = 0;
    this.steam = 0;
  };

  Pizza.prototype.meanR = function () {
    let s = 0;
    for (let i = 0; i < N; i++) s += this.rad[i];
    return s / N;
  };

  Pizza.prototype.maxRad = function () {
    let m = 0;
    for (let i = 0; i < N; i++) if (this.rad[i] > m) m = this.rad[i];
    return m;
  };

  /* 輪郭の丸さ（1 = 完全な円） */
  Pizza.prototype.roundness = function () {
    const m = this.meanR();
    let d = 0;
    for (let i = 0; i < N; i++) d += Math.abs(this.rad[i] - m);
    return U.sat(1 - (d / N) / (m * 0.16));
  };

  Pizza.prototype.radAt = function (ang) {
    let a = ang % TAU; if (a < 0) a += TAU;
    const f = (a / TAU) * N;
    const i = Math.floor(f), t = f - i;
    return U.lerp(this.rad[i % N], this.rad[(i + 1) % N], t);
  };

  /* --- 生地をつまんで押し広げる ---------------------------------- */
  Pizza.prototype.press = function (mx, my, speed, dt) {
    const d = Math.hypot(mx, my);
    const ang = Math.atan2(my, mx);
    const local = this.radAt(ang);
    // 中心寄りで押すほど全体が広がり、ふちを押すとその方向に伸びる
    const nearEdge = U.sat(d / Math.max(1, local));
    const force = (0.35 + speed * 0.0016) * (0.4 + nearEdge * 1.1);
    let grew = 0;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const dd = Math.abs(U.angDiff(a, ang));
      const w = Math.exp(-(dd * dd) / (2 * 0.62 * 0.62));
      if (w < 0.02) continue;
      const add = force * w * 62 * dt;
      const room = U.sat((MAXR - this.rad[i]) / 60);
      this.rad[i] += add * room;
      grew += add * room;
    }
    this.thick = U.clamp(26 * Math.pow(this.r0 / Math.max(this.r0, this.meanR()) * 3.4, 0.55), 9, 26);
    this.dirty = true;
    return grew;
  };

  /* --- 回転（遠心力でまるく・大きくなる） ------------------------ */
  Pizza.prototype.applySpin = function (dt) {
    const w = Math.abs(this.spin);
    this.rot += this.spin * dt;
    // 遠心力で外へ
    if (w > 0.2) {
      const m = this.meanR();
      const grow = Math.min(w, 7) * 1.5 * dt;
      for (let i = 0; i < N; i++) {
        const room = U.sat((MAXR - this.rad[i]) / 70);
        this.rad[i] += grow * room;
      }
      this.dirty = true;
    }
    // 表面張力でまるくなる（回すほど速く）
    const relax = 1.4 + Math.min(w, 8) * 1.5;
    const m = this.meanR();
    for (let i = 0; i < N; i++) {
      const nb = (this.rad[(i - 1 + N) % N] + this.rad[(i + 1) % N]) * 0.5;
      const target = U.lerp(nb, m, 0.42);
      this.rad[i] = U.approach(this.rad[i], target, relax, dt);
    }
    this.spin *= Math.exp(-1.05 * dt);
    if (Math.abs(this.spin) < 0.02) this.spin = 0;
  };

  /* --- ふるふる緩和（常時） -------------------------------------- */
  Pizza.prototype.relax = function (dt, rate) {
    const m = this.meanR();
    for (let i = 0; i < N; i++) {
      const nb = (this.rad[(i - 1 + N) % N] + this.rad[(i + 1) % N]) * 0.5;
      this.rad[i] = U.approach(this.rad[i], U.lerp(nb, m, 0.3), rate || 1.2, dt);
    }
    this.dirty = true;
  };

  /* 投げたあとに少しだけ均一に大きく */
  Pizza.prototype.tossGrow = function (power) {
    const add = 6 + power * 16;
    for (let i = 0; i < N; i++) {
      const room = U.sat((MAXR - this.rad[i]) / 60);
      this.rad[i] += add * room;
    }
    const m = this.meanR();
    for (let i = 0; i < N; i++) this.rad[i] = U.lerp(this.rad[i], m, 0.35 + power * 0.3);
    this.thick = U.clamp(this.thick * 0.94, 9, 26);
    this.dirty = true;
  };

  /* --- ソース ------------------------------------------------------ */
  Pizza.prototype.innerR = function () { return Math.max(10, this.meanR() - this.rimW()); };
  Pizza.prototype.rimW = function () {
    const m = this.meanR();
    return (11 + m * 0.075) * (1 + this.rimPuff * 1.05);
  };

  Pizza.prototype.paintSauce = function (mx, my, radius) {
    const lim = this.innerR() * 1.02;
    const d = Math.hypot(mx, my);
    if (d > lim) {                                 // ふちにはみ出さないよう内側へ寄せる
      const k = lim / d;
      mx *= k; my *= k;
    }
    const s = this.sctx;
    s.setTransform(this.SS, 0, 0, this.SS, 0, 0);
    s.translate(HALF, HALF);
    const g = s.createRadialGradient(mx, my, 0, mx, my, radius);
    g.addColorStop(0, U.css(C.sauce, 0.95));
    g.addColorStop(0.6, U.css(C.sauce, 0.8));
    g.addColorStop(1, U.css(C.sauce, 0));
    s.fillStyle = g;
    s.beginPath(); s.arc(mx, my, radius, 0, TAU); s.fill();
    // 少し濃いむら
    if (U.chance(0.5)) {
      const g2 = s.createRadialGradient(mx, my, 0, mx, my, radius * 0.6);
      g2.addColorStop(0, U.css(C.sauceDeep, 0.35));
      g2.addColorStop(1, U.css(C.sauceDeep, 0));
      s.fillStyle = g2;
      s.beginPath(); s.arc(mx + U.rand(-8, 8), my + U.rand(-8, 8), radius * 0.6, 0, TAU); s.fill();
    }
    s.setTransform(1, 0, 0, 1, 0, 0);

    // カバレッジ計測
    if (!this.sauceCells) {
      this.grid = 18;
      this.sauceCells = new Uint8Array(this.grid * this.grid);
      this.sauceCellsN = 0;
      this.gridTotal = 0;
      for (let gy = 0; gy < this.grid; gy++) {
        for (let gx = 0; gx < this.grid; gx++) {
          const cx = (gx + 0.5) / this.grid * 2 - 1, cy = (gy + 0.5) / this.grid * 2 - 1;
          if (cx * cx + cy * cy <= 1) this.gridTotal++;
        }
      }
    }
    const R = this.innerR();
    const g0 = Math.max(0, Math.floor(((mx - radius) / R + 1) / 2 * this.grid));
    const g1 = Math.min(this.grid - 1, Math.ceil(((mx + radius) / R + 1) / 2 * this.grid));
    const h0 = Math.max(0, Math.floor(((my - radius) / R + 1) / 2 * this.grid));
    const h1 = Math.min(this.grid - 1, Math.ceil(((my + radius) / R + 1) / 2 * this.grid));
    for (let gy = h0; gy <= h1; gy++) {
      for (let gx = g0; gx <= g1; gx++) {
        const cx = ((gx + 0.5) / this.grid * 2 - 1) * R;
        const cy = ((gy + 0.5) / this.grid * 2 - 1) * R;
        if (cx * cx + cy * cy > R * R) continue;
        if (Math.hypot(cx - mx, cy - my) <= radius * 0.8) {
          const idx = gy * this.grid + gx;
          if (!this.sauceCells[idx]) { this.sauceCells[idx] = 1; this.sauceCellsN++; }
        }
      }
    }
    this.sauceCover = this.gridTotal ? this.sauceCellsN / this.gridTotal : 0;
    this.flourAmt *= 0.985;
    this.dirty = true;
  };

  /* --- 具材 -------------------------------------------------------- */
  Pizza.prototype.addTopping = function (type, mx, my) {
    const lim = this.innerR() * (type === 'cheese' ? 1.0 : 0.94);
    const d = Math.hypot(mx, my);
    if (d > lim) { const k = lim / Math.max(1, d); mx *= k; my *= k; }
    const base = A.toppingRadius[type] || 20;
    const t = {
      type: type, x: mx, y: my,
      r: base * U.rand(0.86, 1.12),
      rot: U.rand(0, TAU),
      melt: 0,
      drop: 1,             // 落下アニメ
      seed: Math.random()
    };
    this.toppings.push(t);
    if (this.toppings.length > 130) this.toppings.shift();
    this.dirty = true;
    return t;
  };

  Pizza.prototype.countType = function (type) {
    let n = 0;
    for (let i = 0; i < this.toppings.length; i++) if (this.toppings[i].type === type) n++;
    return n;
  };

  Pizza.prototype.updateToppings = function (dt) {
    let any = false;
    for (let i = 0; i < this.toppings.length; i++) {
      const t = this.toppings[i];
      if (t.drop > 0) { t.drop = Math.max(0, t.drop - dt * 3.6); any = true; }
    }
    if (any) this.dirty = true;
  };

  /* --- 焼成 -------------------------------------------------------- */
  Pizza.prototype.startBake = function () {
    this.charSpots.length = 0;
    const nRim = 26, nSurf = 16;
    for (let i = 0; i < nRim; i++) {
      const a = U.rand(0, TAU);
      this.charSpots.push({ a: a, rr: U.rand(0.90, 0.99), size: U.rand(7, 17), dose: 0, onRim: true });
    }
    for (let i = 0; i < nSurf; i++) {
      const a = U.rand(0, TAU);
      this.charSpots.push({ a: a, rr: U.rand(0.2, 0.82), size: U.rand(5, 11), dose: 0, onRim: false });
    }
    this.blisters.length = 0;
    for (let i = 0; i < 22; i++) {
      this.blisters.push({ a: U.rand(0, TAU), rr: U.rand(0.88, 0.99), s: U.rand(0.5, 1.3), ph: U.rand(0, TAU) });
    }
  };

  /* flameAngleWorld: ワールド上で炎がある方向（ラジアン）
     rot を考慮してモデル空間の方位に変換して焦げを配分する */
  Pizza.prototype.bakeStep = function (dt, heat, flameAngleWorld) {
    this.bake = U.sat(this.bake + dt * 0.052 * heat);
    this.rimPuff = U.approach(this.rimPuff, U.sat(this.bake * 2.4), 0.9, dt);
    const flameModel = flameAngleWorld - this.rot;
    for (let i = 0; i < this.charSpots.length; i++) {
      const s = this.charSpots[i];
      const face = Math.max(0, Math.cos(s.a - flameModel));
      const near = 0.35 + 0.65 * Math.pow(face, 1.4);
      const rimBoost = s.onRim ? 1.25 : 0.8;
      s.dose = U.sat(s.dose + dt * heat * 0.115 * near * rimBoost);
    }
    for (let i = 0; i < this.toppings.length; i++) {
      const t = this.toppings[i];
      if (t.type === 'cheese') t.melt = U.sat(t.melt + dt * 0.30 * heat);
      else t.melt = U.sat(t.melt + dt * 0.12 * heat);
    }
    this.bakeGlow = U.approach(this.bakeGlow, heat, 2, dt);
    this.dirty = true;
  };

  /* 焦げの偏り（0=均一, 1=片側に寄っている）— 回すヒントの判定に使う */
  Pizza.prototype.charImbalance = function (flameAngleWorld) {
    let sx = 0, sy = 0, tot = 0;
    for (let i = 0; i < this.charSpots.length; i++) {
      const s = this.charSpots[i];
      sx += Math.cos(s.a + this.rot) * s.dose;
      sy += Math.sin(s.a + this.rot) * s.dose;
      tot += s.dose;
    }
    if (tot < 0.001) return 0;
    return Math.hypot(sx, sy) / tot;
  };

  /* ================================================================
     描画（オフスクリーン）
  ================================================================ */
  Pizza.prototype.render = function () {
    if (!this.dirty) return;
    this.dirty = false;
    const ctx = this.octx, SS = this.SS;
    ctx.setTransform(SS, 0, 0, SS, 0, 0);
    ctx.clearRect(0, 0, HALF * 2, HALF * 2);
    ctx.save();
    ctx.translate(HALF, HALF);

    const m = this.meanR();
    const rimW = this.rimW();
    const bake = this.bake;

    // 輪郭
    const outer = [], inner = [];
    const innerK = Math.max(0.18, 1 - rimW / Math.max(1, m));
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const rr = this.rad[i];
      const puff = 1 + this.rimPuff * 0.10 * (0.7 + 0.3 * Math.sin(i * 1.7));
      outer.push([Math.cos(a) * rr * puff, Math.sin(a) * rr * puff]);
      inner.push([Math.cos(a) * rr * innerK, Math.sin(a) * rr * innerK]);
    }

    // 生地の側面（厚み）
    const sideH = this.thick * (1 + this.rimPuff * 0.9) * 1.35;
    ctx.save();
    ctx.translate(0, sideH);
    ctx.beginPath(); U.closedCurve(ctx, outer);
    ctx.fillStyle = U.css(U.mixColor(C.doughDeep, C.bakedDeep, U.sat(bake * 1.2)));
    ctx.fill();
    ctx.restore();

    // 生地の上面
    ctx.beginPath(); U.closedCurve(ctx, outer);
    const baseCol = U.mixColor(
      U.mixColor(C.doughPale, C.bakedLight, U.sat(bake * 1.6)),
      C.bakedMid, U.sat((bake - 0.45) * 1.6));
    const g = ctx.createRadialGradient(-m * 0.25, -m * 0.3, m * 0.1, 0, 0, m * 1.1);
    g.addColorStop(0, U.css(U.mixColor(baseCol, [255, 255, 255], 0.10)));
    g.addColorStop(0.7, U.css(baseCol));
    g.addColorStop(1, U.css(U.mixColor(baseCol, C.doughDeep, 0.45)));
    ctx.fillStyle = g;
    ctx.fill();

    // 生地の粉っぽさ
    if (this.flourAmt > 0.02) {
      ctx.save();
      ctx.beginPath(); U.closedCurve(ctx, outer); ctx.clip();
      ctx.globalAlpha = 0.35 * this.flourAmt;
      for (let i = 0; i < 26; i++) {
        const a = (i * 2.399), rr = Math.sqrt((i + 0.5) / 26) * m;
        A.softBlob(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 10 + (i % 5) * 6, [255, 255, 255], 0.5);
      }
      ctx.restore();
    }

    // 表面の焦げ斑点（ソースの下）
    this.drawChar(ctx, false, outer, m);

    // ソース
    if (this.sauceCover > 0 || this.sauceCellsN > 0) {
      ctx.save();
      ctx.beginPath(); U.closedCurve(ctx, inner); ctx.clip();
      ctx.globalAlpha = 1;
      ctx.drawImage(this.sc, -HALF, -HALF, HALF * 2, HALF * 2);
      // 焼けたソースは色が濃くなる
      if (bake > 0.05) {
        ctx.globalAlpha = U.sat(bake * 0.55);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgb(214,150,120)';
        ctx.beginPath(); U.closedCurve(ctx, inner); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }

    // 具材（チーズを先に、その他をあとに）
    ctx.save();
    ctx.beginPath(); U.closedCurve(ctx, inner); ctx.clip();
    // とろけたチーズの土台
    const meltAvg = this.cheeseMeltAvg();
    if (meltAvg > 0.15) {
      ctx.globalAlpha = 0.5 * meltAvg;
      ctx.fillStyle = U.css(U.mixColor(C.cheeseMelt, C.cheeseGold, U.sat(bake * 0.9)));
      ctx.beginPath();
      for (let i = 0; i < N; i += 2) {
        const a = (i / N) * TAU;
        const rr = this.rad[i] * innerK * (0.86 + 0.1 * Math.sin(i * 0.9));
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.toppings.length; i++) {
        const t = this.toppings[i];
        const isCheese = t.type === 'cheese';
        if ((pass === 0) !== isCheese) continue;
        const dropK = t.drop > 0 ? t.drop : 0;
        const sc = 1 + dropK * 0.9;
        const dy = -dropK * dropK * 40;
        ctx.save();
        if (dropK > 0.02) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          U.ellipse(ctx, t.x, t.y + 3, t.r * 0.9, t.r * 0.5); ctx.fill();
        }
        A.drawTopping(ctx, t.type, t.x, t.y + dy, t.r * sc, t.rot, t.melt, bake);
        ctx.restore();
      }
    }
    // チーズの焼き色
    if (bake > 0.35) {
      ctx.globalAlpha = U.sat((bake - 0.35) * 1.4) * 0.5;
      for (let i = 0; i < this.toppings.length; i++) {
        const t = this.toppings[i];
        if (t.type !== 'cheese' || t.seed > 0.45) continue;
        A.softBlob(ctx, t.x + (t.seed - 0.25) * 8, t.y, t.r * 0.8, [196, 132, 58], 0.7);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // ふち（コルニチョーネ）
    ctx.save();
    ctx.beginPath(); U.closedCurve(ctx, outer);
    ctx.beginPath();
    U.closedCurve(ctx, outer);
    U.closedCurve(ctx, inner);
    ctx.clip('evenodd');
    const rimCol = U.mixColor(
      U.mixColor(C.doughPale, C.bakedLight, U.sat(bake * 1.9)),
      C.bakedDeep, U.sat((bake - 0.4) * 1.5));
    const rg = ctx.createRadialGradient(0, 0, m * innerK * 0.9, 0, 0, m * 1.02);
    rg.addColorStop(0, U.css(U.mixColor(rimCol, [120, 74, 40], 0.28)));
    rg.addColorStop(0.45, U.css(U.mixColor(rimCol, [255, 250, 235], 0.18 + this.rimPuff * 0.12)));
    rg.addColorStop(1, U.css(U.mixColor(rimCol, [110, 66, 34], 0.30)));
    ctx.fillStyle = rg;
    ctx.beginPath(); U.closedCurve(ctx, outer); ctx.fill();

    // ふちのぷくぷく
    if (this.rimPuff > 0.05) {
      for (let i = 0; i < this.blisters.length; i++) {
        const b = this.blisters[i];
        const rr = this.radAt(b.a) * U.lerp(innerK, 1, b.rr);
        const bx = Math.cos(b.a) * rr, by = Math.sin(b.a) * rr;
        const s = b.s * rimW * 0.36 * this.rimPuff;
        ctx.globalAlpha = 0.55 * this.rimPuff;
        A.softBlob(ctx, bx - s * 0.2, by - s * 0.25, s * 1.5, [255, 246, 224], 0.75);
        ctx.globalAlpha = 0.35 * this.rimPuff;
        A.softBlob(ctx, bx + s * 0.3, by + s * 0.35, s * 1.3, [140, 92, 48], 0.5);
      }
      ctx.globalAlpha = 1;
    }
    // ふちの焦げ
    this.drawChar(ctx, true, outer, m);
    ctx.restore();

    // ふち内側の落ち影
    ctx.save();
    ctx.beginPath(); U.closedCurve(ctx, inner); ctx.clip();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = 'rgba(90,50,24,0.9)';
    ctx.lineWidth = rimW * 0.5;
    ctx.beginPath(); U.closedCurve(ctx, inner); ctx.stroke();
    ctx.restore();

    // 焼けているときのつや
    if (bake > 0.1) {
      ctx.save();
      ctx.beginPath(); U.closedCurve(ctx, inner); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 * U.sat(bake * 1.5);
      A.softBlob(ctx, -m * 0.3, -m * 0.35, m * 0.75, [255, 240, 200], 0.7);
      ctx.restore();
    }

    ctx.restore();
  };

  Pizza.prototype.cheeseMeltAvg = function () {
    let s = 0, n = 0;
    for (let i = 0; i < this.toppings.length; i++) {
      if (this.toppings[i].type === 'cheese') { s += this.toppings[i].melt; n++; }
    }
    return n ? s / n : 0;
  };

  Pizza.prototype.drawChar = function (ctx, onRim, outer, m) {
    let any = false;
    for (let i = 0; i < this.charSpots.length; i++) if (this.charSpots[i].onRim === onRim && this.charSpots[i].dose > 0.02) { any = true; break; }
    if (!any) return;
    ctx.save();
    for (let i = 0; i < this.charSpots.length; i++) {
      const s = this.charSpots[i];
      if (s.onRim !== onRim || s.dose < 0.02) continue;
      const rr = this.radAt(s.a) * s.rr;
      const x = Math.cos(s.a) * rr, y = Math.sin(s.a) * rr;
      const k = U.smooth(s.dose);
      const col = U.mixColor(C.bakedDeep, C.char, U.sat((s.dose - 0.4) * 1.8));
      A.softBlob(ctx, x, y, s.size * (0.6 + k * 0.9), col, 0.16 + k * 0.6);
    }
    ctx.restore();
  };

  /* ================================================================
     ゲーム側からの描画ヘルパー
     x,y: ワールド座標の中心 / scale: 拡大率 / squash: 上下の潰し
     flip: 空中回転（0..1 で 1 回転）
  ================================================================ */
  Pizza.prototype.draw = function (ctx, x, y, scale, squash, opt) {
    opt = opt || {};
    this.render();
    const flip = opt.flip || 0;
    const cosf = Math.cos(flip * TAU);
    const face = Math.abs(cosf);
    const m = this.meanR();

    ctx.save();
    ctx.translate(x, y);

    if (opt.shadow) {
      ctx.save();
      ctx.globalAlpha = opt.shadowAlpha === undefined ? 0.3 : opt.shadowAlpha;
      ctx.fillStyle = '#000';
      const ss = opt.shadowScale === undefined ? 1 : opt.shadowScale;
      U.ellipse(ctx, 0, opt.shadowY || 0, m * scale * 1.02 * ss, m * scale * squash * 0.9 * ss);
      ctx.fill();
      ctx.restore();
    }

    // 真横に近いときは生地の断面を見せる
    if (face < 0.995 && flip !== 0) {
      const edgeA = 1 - face;
      ctx.save();
      ctx.globalAlpha = edgeA;
      const th = this.thick * scale * 1.1;
      const gg = ctx.createLinearGradient(0, -th, 0, th);
      gg.addColorStop(0, U.css(U.mixColor(C.doughPale, C.bakedLight, this.bake)));
      gg.addColorStop(1, U.css(U.mixColor(C.doughDeep, C.bakedDeep, this.bake)));
      ctx.fillStyle = gg;
      U.roundRect(ctx, -m * scale, -th * 0.5, m * scale * 2, th, th * 0.5);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.scale(1, squash * (flip !== 0 ? face : 1));
    ctx.rotate(this.rot + (opt.extraRot || 0));
    ctx.globalAlpha = opt.alpha === undefined ? 1 : opt.alpha;
    const S = HALF * 2 * scale;
    if (opt.cuts && this.cuts.length >= 2) {
      this.drawSliced(ctx, S, opt);
    } else {
      ctx.drawImage(this.oc, -S / 2, -S / 2, S, S);
    }
    ctx.restore();

    // 窯の熱で暗くなる／照らされる
    if (opt.shade !== undefined && opt.shade !== 1) {
      ctx.save();
      ctx.scale(1, squash);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.restore();
    }
    ctx.restore();
  };

  /* カット後：くさび形にクリップして 1 切れずつ描く */
  Pizza.prototype.drawSliced = function (ctx, S, opt) {
    const n = this.cuts.length * 2;
    const lift = opt.sliceLift || null;
    for (let i = 0; i < n; i++) {
      const a0 = this.cuts[0] + (i / n) * TAU;
      const a1 = this.cuts[0] + ((i + 1) / n) * TAU;
      ctx.save();
      let ox = 0, oy = 0;
      if (lift && lift.index === i) { ox = lift.x; oy = lift.y; }
      else {
        const mid = (a0 + a1) / 2;
        const sp = opt.spread || 0;
        ox = Math.cos(mid) * sp; oy = Math.sin(mid) * sp;
      }
      ctx.translate(ox, oy);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, S, a0, a1);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(this.oc, -S / 2 - ox, -S / 2 - oy, S, S);
      ctx.restore();
    }
  };

  /* チーズがのびる糸 */
  Pizza.prototype.drawCheeseStrands = function (ctx, x0, y0, x1, y1, amount, t) {
    if (amount <= 0.01) return;
    ctx.save();
    ctx.lineCap = 'round';
    const n = 4;
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * 14;
      const sag = 26 + i * 9 + Math.sin(t * 3 + i) * 4;
      ctx.strokeStyle = 'rgba(255,244,205,' + (0.85 - i * 0.13) * amount + ')';
      ctx.lineWidth = (9 - i * 1.6) * (1 - amount * 0.35);
      ctx.beginPath();
      ctx.moveTo(x0 + o, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + o * 0.4, (y0 + y1) / 2 + sag, x1 + o * 0.6, y1);
      ctx.stroke();
    }
    ctx.restore();
  };

  /* 小さいピザ（メニュー用） */
  A.drawMiniPizza = function (ctx, x, y, r, recipe, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    U.ellipse(ctx, 0, r * 0.14, r * 1.02, r * 0.9); ctx.fill();
    // 生地
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#f0d5a4');
    g.addColorStop(0.72, '#e0bd85');
    g.addColorStop(1, '#c39355');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    if (recipe.sauce !== false) {
      ctx.fillStyle = '#c33a25';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.fill();
    }
    if (recipe.rainbow) {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = A.rainbow[i];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r * 0.78, (i / 6) * TAU, ((i + 1) / 6) * TAU);
        ctx.closePath(); ctx.fill();
      }
    }
    // 具
    const list = recipe.icon || recipe.items || [];
    let k = 0;
    for (let ring = 0; ring < 2; ring++) {
      const cnt = ring === 0 ? 3 : 6;
      for (let i = 0; i < cnt; i++) {
        const a = (i / cnt) * TAU + ring * 0.5 + (t || 0) * 0.0;
        const rr = ring === 0 ? r * 0.26 : r * 0.55;
        const type = list[k % list.length];
        k++;
        if (!type) continue;
        A.drawTopping(ctx, type, Math.cos(a) * rr, Math.sin(a) * rr, r * 0.15, a, 0.55, 0.3);
      }
    }
    // ふち
    ctx.strokeStyle = 'rgba(198,140,72,0.95)';
    ctx.lineWidth = r * 0.17;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,206,150,0.6)';
    ctx.lineWidth = r * 0.07;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU); ctx.stroke();
    ctx.restore();
  };

})();
