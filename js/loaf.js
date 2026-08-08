/* =========================================================
   loaf.js — バゲット本体のモデルと描画
   ------------------------------------------------------
   このファイルがゲームの心臓部。
   「クープを入れた場所」を正規化座標(t, off, angle, len, depth)で保持し、
   焼成パラメータ bake を上げると【同じ座標が】徐々に開く。
   画像の差し替えは一切していない。全部その場で計算して描いている。
   ========================================================= */
(function (global) {
  'use strict';

  /* ---- 種類ごとの寸法（loaf unit: 完成バゲットの半長=約1.0） ---- */
  const TYPES = {
    normal: { len: 1.00, rad: 0.132, cuts: 4, label: 'normal' },
    petite: { len: 0.62, rad: 0.116, cuts: 3, label: 'petite' },
    batard: { len: 0.70, rad: 0.192, cuts: 3, label: 'batard' },
    free: { len: 1.00, rad: 0.140, cuts: 5, label: 'free' },
  };

  const IDEAL_ANGLE = 0.36;      // 軸に対する理想の傾き（約21度）
  const CORRECT_ANGLE = 0.78;    // 角度補正の強さ（通常モード）
  const CORRECT_ANGLE_FREE = 0.20;
  const MIN_ANGLE = 0.27;        // これより寝るとクープに見えない（約15度）
  const MAX_ANGLE = 0.82;        // これより立つとバゲットらしくない（約47度）

  /* 焼き色のランプ（生地の白 → 黄金 → 香ばしい茶） */
  const CRUST = U.ramp([
    [0.00, '#f0e3c9'],
    [0.16, '#ecdcbb'],
    [0.32, '#e9d5a6'],
    [0.48, '#e0bd7c'],
    [0.63, '#d4a256'],
    [0.79, '#c1873c'],
    [1.00, '#b0742f'],
  ]);
  /* クープの中（クラム）— 外皮よりいつも淡い */
  const CRUMB = U.ramp([
    [0.00, '#f8f1e0'],
    [0.35, '#f5ebd2'],
    [0.62, '#f0dcae'],
    [0.85, '#e5c384'],
    [1.00, '#d6ab66'],
  ]);

  /* 影は黒ではなく「焼けた茶」に寄せる。ハイライトは温かい生成り */
  const DARK = U.hex2rgb('#6b4a2a');
  const LIGHT = U.hex2rgb('#fffaf0');
  function dk(c, a) { return U.mixRgb(c, DARK, a); }
  function lt(c, a) { return U.mixRgb(c, LIGHT, a); }

  function Loaf(type, seed) {
    this.type = TYPES[type] ? type : 'normal';
    this.spec = TYPES[this.type];
    this.seed = seed || ((Math.random() * 1e9) | 0);
    const rnd = U.mulberry32(this.seed);
    this.rnd = rnd;

    /* 工程パラメータ（すべて 0..1） */
    this.press = 0;
    this.roll = 0;
    this.stretch = 0;
    this.proof = 0;
    this.bake = 0;
    this.cool = 0;

    this.scores = [];
    this.lean = -1;            // クープの傾く向き（最初の1本で決まる）
    this.wobble = 0;           // 触ったときのぷるん
    this.wobblePhase = 0;

    /* --- 見た目のゆらぎ（個体差） --- */
    this.edgeNoise = [];
    for (let i = 0; i < 12; i++) this.edgeNoise.push(rnd() * 2 - 1);
    this.pores = [];
    for (let i = 0; i < 130; i++) {
      this.pores.push({
        u: rnd() * 2 - 1,
        v: rnd() * 2 - 1,
        r: 0.06 + rnd() * 0.16,
        a: 0.05 + rnd() * 0.14,
        dark: rnd() < 0.55,
      });
    }
    this.flour = [];
    for (let i = 0; i < 170; i++) {
      this.flour.push({
        u: rnd() * 2 - 1,
        v: (rnd() * 2 - 1) * 0.92,
        r: 0.035 + rnd() * 0.13,
        a: 0.10 + rnd() * 0.4,
      });
    }
    this.blisters = [];
    for (let i = 0; i < 46; i++) {
      this.blisters.push({
        u: rnd() * 2 - 1,
        v: (rnd() * 2 - 1) * 0.8,
        r: 0.03 + rnd() * 0.05,
        born: 0.55 + rnd() * 0.3,
      });
    }
    /* 布の襞のあと */
    this.clothMarks = [];
    const nm = 6 + ((rnd() * 3) | 0);
    for (let i = 0; i < nm; i++) this.clothMarks.push(-0.8 + (1.6 * i) / (nm - 1) + (rnd() - 0.5) * 0.08);
  }

  Loaf.TYPES = TYPES;
  Loaf.CRUST = CRUST;

  /* オーブンスプリングの伸び方（最初にぐっと、あとはゆっくり） */
  function springCurve(b) {
    return U.smooth(U.range(b, 0.04, 0.52)) * 0.78 + U.range(b, 0.45, 1.0) * 0.22;
  }

  /* ---- 現在の寸法 ---- */
  Loaf.prototype.dims = function () {
    const sp = this.spec;
    let hl = U.lerp(0.26, 0.335, this.press);
    let R = U.lerp(0.26, 0.205, this.press);
    hl = U.lerp(hl, 0.40, this.roll);
    R = U.lerp(R, 0.190, this.roll);
    hl = U.lerp(hl, sp.len, this.stretch);
    R = U.lerp(R, sp.rad, this.stretch);

    R *= 1 + 0.14 * this.proof;
    hl *= 1 + 0.015 * this.proof;

    const sp2 = springCurve(this.bake);
    R *= 1 + 0.21 * sp2;
    hl *= 1 + 0.05 * sp2;

    /* 冷めると気持ち締まる */
    R *= 1 - 0.018 * this.cool;

    const logness = U.smooth(Math.max(this.roll, this.stretch * 1.0));
    return { hl: hl, R: R, logness: logness };
  };

  /* 断面の太さプロファイル u∈[-1,1] */
  Loaf.prototype.profile = function (u, d) {
    const au = Math.min(1, Math.abs(u));
    const circle = Math.sqrt(Math.max(0, 1 - au * au));
    const bag = Math.pow(Math.max(0, 1 - Math.pow(au, 4.6)), 0.30);
    let p = U.lerp(circle, bag, d.logness);
    /* クープのところは焼くとそこだけ気持ちふくらむ（因果の補強） */
    if (this.bake > 0.02 && this.scores.length) {
      let bulge = 0;
      for (let i = 0; i < this.scores.length; i++) {
        const s = this.scores[i];
        const su = s.t * 2 - 1;
        const dd = (u - su) / Math.max(0.08, s.len * 0.34 + 0.16);
        bulge += Math.exp(-dd * dd * 2.2) * s.depth;
      }
      p *= 1 + Math.min(0.14, bulge * 0.045) * springCurve(this.bake);
    }
    return p;
  };

  /* エッジのゆらぎ（手作り感） */
  Loaf.prototype.edgeWobble = function (u, side) {
    const n = this.edgeNoise;
    const x = (u + 1) * 3.0 + (side > 0 ? 5.7 : 0);
    const i = Math.floor(x) % n.length;
    const j = (i + 1) % n.length;
    const f = x - Math.floor(x);
    const v = U.lerp(n[(i + n.length) % n.length], n[(j + n.length) % n.length], U.smooth(f));
    return v * 0.028;
  };

  /* 輪郭の点列 */
  Loaf.prototype.outline = function (N) {
    const d = this.dims();
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const k = -1 + (2 * i) / N;
      const u = Math.sign(k) * Math.pow(Math.abs(k), 0.72); /* 端を密に */
      const p = this.profile(u, d);
      const rt = d.R * (p + this.edgeWobble(u, -1) * p);
      const rb = d.R * (p + this.edgeWobble(u, 1) * p);
      top.push([u * d.hl, -rt]);
      bot.push([u * d.hl, rb]);
    }
    return { top: top, bot: bot, d: d };
  };

  function pathFromOutline(ctx, o) {
    ctx.beginPath();
    ctx.moveTo(o.top[0][0], o.top[0][1]);
    for (let i = 1; i < o.top.length; i++) ctx.lineTo(o.top[i][0], o.top[i][1]);
    for (let i = o.bot.length - 1; i >= 0; i--) ctx.lineTo(o.bot[i][0], o.bot[i][1]);
    ctx.closePath();
  }

  /* =========================================================
     クープの追加（入力補正つき）
     p0,p1 : ローカル座標（軸=x, 単位=loaf unit）
     ========================================================= */
  Loaf.prototype.addScore = function (x0, y0, x1, y1, durSec, freeMode) {
    const d = this.dims();
    const max = freeMode ? 8 : 5;
    if (this.scores.length >= max) return null;

    let dx = x1 - x0, dy = y1 - y0;
    let rawLen = Math.hypot(dx, dy);
    if (rawLen < 1e-4) { dx = 1; dy = 0; rawLen = 0.0001; }

    /* 生の角度を -90..90 に畳む（右向き基準） */
    let a = Math.atan2(dy, dx);
    if (a > Math.PI / 2) a -= Math.PI;
    if (a < -Math.PI / 2) a += Math.PI;

    /* 最初の1本で「傾く向き」を決め、以降は揃える（バゲットらしい平行なクープ） */
    if (this.scores.length === 0) this.lean = a > 0.06 ? 1 : -1;
    const target = this.lean * IDEAL_ANGLE;

    let ang;
    if (freeMode) {
      /* 自由モードは指の向きをほぼそのまま生かす */
      ang = U.lerp(a, target, CORRECT_ANGLE_FREE);
      const sgn = Math.sign(ang) || 1;
      ang = sgn * U.clamp(Math.abs(ang), 0.12, 1.30);
    } else {
      /* 逆向きに引かれた線は「鏡写し」にしてから寄せる。
         0度をまたいで補間すると、軸と平行な線になってしまうため。 */
      let aFold = a;
      if (Math.abs(a) > 0.05 && Math.sign(a) !== this.lean) aFold = -a;
      ang = U.lerp(aFold, target, CORRECT_ANGLE);
      const sgn = this.lean;
      ang = sgn * U.clamp(Math.abs(ang), MIN_ANGLE, MAX_ANGLE);
    }

    /* 中心位置：軸方向はほぼそのまま、横方向は中央へ強く吸着 */
    const mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5;
    let t = U.clamp((mx / d.hl + 1) * 0.5, 0.11, 0.89);
    let off = U.clamp((my / (d.R * 0.5)) * (freeMode ? 0.6 : 0.3), -0.65, 0.65);

    /* 近すぎるクープは少し離す（重なって潰れないように） */
    for (let i = 0; i < this.scores.length; i++) {
      const dt = t - this.scores[i].t;
      if (Math.abs(dt) < 0.075) {
        t = this.scores[i].t + (dt >= 0 ? 0.075 : -0.075);
        t = U.clamp(t, 0.11, 0.89);
      }
    }

    /* 長さ：指の動いた距離を素直に反映（下限・上限つき） */
    const lr = rawLen / Math.max(0.001, d.hl);
    let len = U.clamp(U.inv(0.12, 0.60, lr), 0, 1);

    /* 深さ：ゆっくり引いたほど深い */
    const pace = (durSec || 0.3) / Math.max(0.06, lr);
    const depth = U.clamp(0.66 + 0.30 * pace, 0.62, 1.32);

    /* 生地からはみ出す場合は、角度を寝かせるのではなく長さを詰める。
       （角度を崩すとクープらしさが失われるため） */
    const maxPerp = d.R * 0.70;
    const maxHalf = maxPerp / Math.max(0.18, Math.abs(Math.sin(ang)));
    const wantHalf = U.lerp(0.14, 0.30, len) * d.hl;
    if (wantHalf > maxHalf) {
      len = U.clamp(U.inv(0.14 * d.hl, 0.30 * d.hl, maxHalf), 0, 1);
    }

    const sc = {
      t: t,
      off: off,
      angle: ang,
      len: len,
      depth: depth,
      index: this.scores.length,
      openStart: 0.13 + this.scores.length * 0.052,
      seed: (this.rnd() * 1e6) | 0,
      settle: 0,          // 生の軌跡→補正後へなじむアニメ
      born: 0,            // 描かれた直後のきらめき
      raw: { x0: x0, y0: y0, x1: x1, y1: y1 },
      popped: false,
    };
    /* 生の軌跡から見た中心・角度・半長（settle補間用） */
    sc.rawGeom = {
      t: U.clamp((mx / d.hl + 1) * 0.5, 0.02, 0.98),
      off: U.clamp(my / (d.R * 0.5), -1.6, 1.6),
      angle: a,
      halfLenU: Math.max(0.02, (rawLen * 0.5) / Math.max(0.001, d.hl)),
    };
    this.scores.push(sc);
    return sc;
  };

  Loaf.prototype.update = function (dt) {
    for (let i = 0; i < this.scores.length; i++) {
      const s = this.scores[i];
      if (s.settle < 1) s.settle = Math.min(1, s.settle + dt * 5.0);
      if (s.born < 1) s.born = Math.min(1, s.born + dt * 2.4);
    }
    if (this.wobble > 0.0005) {
      this.wobble *= Math.pow(0.06, dt);
      this.wobblePhase += dt * 22;
    }
  };

  /* クープ1本の幾何（settle と bake を反映） */
  Loaf.prototype.scoreGeom = function (s, d) {
    const st = U.smoother(s.settle);
    const t = U.lerp(s.rawGeom.t, s.t, st);
    const off = U.lerp(s.rawGeom.off, s.off, st);
    const ang = U.angleLerp(s.rawGeom.angle, s.angle, st);
    const halfU = U.lerp(s.rawGeom.halfLenU, U.lerp(0.14, 0.30, s.len), st);

    const cx = (t * 2 - 1) * d.hl;
    const cy = off * d.R * 0.5;
    const half = halfU * d.hl;
    return { cx: cx, cy: cy, ang: ang, half: half };
  };

  /* このクープの開き具合（0..1） */
  Loaf.prototype.scoreOpen = function (s) {
    const b = this.bake;
    if (b <= 0.001) return 0;
    const a = s.openStart;
    let op = U.easeOut(U.range(b, a, a + 0.40));
    op = op * 0.82 + U.smooth(U.range(b, 0.46, 1.0)) * 0.18;
    return U.clamp(op, 0, 1);
  };

  /* 焼成中に「今まさに開き始めた」クープを知らせる（音用） */
  Loaf.prototype.consumePops = function () {
    const out = [];
    for (let i = 0; i < this.scores.length; i++) {
      const s = this.scores[i];
      if (!s.popped && this.scoreOpen(s) > 0.16) { s.popped = true; out.push(s); }
    }
    return out;
  };

  /* =========================================================
     描画（呼び出し側でローカル空間へ transform 済みの想定。
     単位は loaf unit。1.0 = 完成バゲットの半長）
     ========================================================= */
  Loaf.prototype.draw = function (ctx, opt) {
    opt = opt || {};
    const d = this.dims();
    const b = this.bake;
    const crust = CRUST(b);
    const o = this.outline(opt.quality === 'low' ? 34 : 64);

    ctx.save();

    /* ぷるん（叩いたとき／置いたとき） */
    if (this.wobble > 0.002) {
      const w = this.wobble * Math.sin(this.wobblePhase);
      ctx.transform(1 + w * 0.06, 0, 0, 1 - w * 0.10, 0, 0);
    }

    /* --- 影（接地） --- */
    if (opt.shadow !== false) {
      ctx.save();
      const g = ctx.createLinearGradient(0, d.R * 0.2, 0, d.R * 2.0);
      g.addColorStop(0, 'rgba(60,38,20,0.30)');
      g.addColorStop(1, 'rgba(60,38,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, d.R * 0.62, d.hl * 1.02, d.R * 1.15, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }

    /* --- 本体 --- */
    pathFromOutline(ctx, o);
    ctx.save();
    ctx.clip();

    const gg = ctx.createLinearGradient(0, -d.R * 1.05, 0, d.R * 1.05);
    gg.addColorStop(0.00, U.rgb2css(lt(crust, 0.06)));
    gg.addColorStop(0.15, U.rgb2css(lt(crust, 0.15)));
    gg.addColorStop(0.40, U.rgb2css(lt(crust, 0.04)));
    gg.addColorStop(0.62, U.rgb2css(crust));
    gg.addColorStop(0.84, U.rgb2css(dk(crust, 0.24)));
    gg.addColorStop(1.00, U.rgb2css(dk(crust, 0.44)));
    ctx.fillStyle = gg;
    ctx.fillRect(-d.hl * 1.2, -d.R * 1.6, d.hl * 2.4, d.R * 3.2);

    /* 焼き色の斑（テクスチャ） */
    const texA = 0.35 + 0.65 * U.smooth(b);
    for (let i = 0; i < this.pores.length; i++) {
      const p = this.pores[i];
      const x = p.u * d.hl * 0.99;
      const pr = this.profile(p.u, d);
      const y = p.v * d.R * pr * 0.94;
      const rr = p.r * d.R * (0.5 + 0.5 * texA);
      ctx.fillStyle = p.dark
        ? `rgba(96,58,26,${(p.a * texA * 0.40).toFixed(3)})`
        : `rgba(255,242,214,${(p.a * 0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rr * 1.5, rr, 0, 0, U.TAU);
      ctx.fill();
    }

    /* 布の襞のあと（発酵後～焼き始めに薄く残る） */
    const cm = U.clamp(this.proof * (1 - U.range(b, 0.15, 0.75)), 0, 1) * 0.5;
    if (cm > 0.01) {
      ctx.save();
      ctx.lineWidth = d.R * 0.10;
      for (let i = 0; i < this.clothMarks.length; i++) {
        const u = this.clothMarks[i];
        const x = u * d.hl;
        const pr = this.profile(u, d);
        ctx.strokeStyle = `rgba(255,250,238,${(0.30 * cm).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x, -d.R * pr);
        ctx.lineTo(x + d.R * 0.16, d.R * pr);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 打ち粉 */
    const flourA = U.lerp(1.0, 0.42, U.smooth(b)) * (opt.flour === undefined ? 1 : opt.flour);
    if (flourA > 0.02) {
      for (let i = 0; i < this.flour.length; i++) {
        const p = this.flour[i];
        const pr = this.profile(p.u, d);
        const x = p.u * d.hl * 0.995;
        const y = p.v * d.R * pr * 0.92;
        ctx.fillStyle = `rgba(255,252,244,${(p.a * 0.5 * flourA).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, p.r * d.R * 0.9, p.r * d.R * 0.72, 0, 0, U.TAU);
        ctx.fill();
      }
    }

    /* 端は少し濃く焼ける */
    if (b > 0.25) {
      const ea = 0.26 * U.range(b, 0.25, 0.9);
      [-1, 1].forEach((sgn) => {
        const g2 = ctx.createRadialGradient(sgn * d.hl, 0, d.R * 0.1, sgn * d.hl, 0, d.hl * 0.34);
        g2.addColorStop(0, `rgba(104,54,16,${ea})`);
        g2.addColorStop(1, 'rgba(104,54,16,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(-d.hl * 1.1, -d.R * 1.4, d.hl * 2.2, d.R * 2.8);
      });
    }

    /* 焼き上がりの小さな水ぶくれ（皮の質感） */
    if (b > 0.5) {
      for (let i = 0; i < this.blisters.length; i++) {
        const bl = this.blisters[i];
        if (b < bl.born) continue;
        const k = U.range(b, bl.born, bl.born + 0.2);
        const pr = this.profile(bl.u, d);
        const x = bl.u * d.hl;
        const y = bl.v * d.R * pr * 0.8;
        const r = bl.r * d.R * k;
        ctx.fillStyle = `rgba(255,236,196,${(0.30 * k).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.3, r, r * 0.8, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = `rgba(120,66,22,${(0.22 * k).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(x + r * 0.2, y + r * 0.35, r * 0.8, r * 0.6, 0, 0, U.TAU); ctx.fill();
      }
    }

    ctx.restore(); /* clip解除 */

    /* --- クープ（本体の上に描く） --- */
    if (this.scores.length) {
      ctx.save();
      pathFromOutline(ctx, o);
      ctx.clip();
      for (let i = 0; i < this.scores.length; i++) this._drawScore(ctx, this.scores[i], d, crust, b);
      ctx.restore();
    }

    /* --- 全体のつや（焼けた皮の光） --- */
    const sheen = U.range(b, 0.42, 1.0);
    if (sheen > 0.02) {
      ctx.save();
      pathFromOutline(ctx, o);
      ctx.clip();
      const sg = ctx.createLinearGradient(0, -d.R, 0, d.R * 0.3);
      sg.addColorStop(0, `rgba(255,240,205,0)`);
      sg.addColorStop(0.45, `rgba(255,244,214,${(0.20 * sheen).toFixed(3)})`);
      sg.addColorStop(1, 'rgba(255,240,205,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(-d.hl, -d.R, d.hl * 2, d.R * 1.4);
      ctx.restore();
    }

    /* --- 輪郭のやわらかい締め --- */
    ctx.save();
    pathFromOutline(ctx, o);
    ctx.lineWidth = d.R * 0.045;
    ctx.strokeStyle = U.rgb2css(dk(crust, 0.40), 0.42);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  };

  /* --------- クープ1本 --------- */
  Loaf.prototype._drawScore = function (ctx, s, d, crust, b) {
    const g = this.scoreGeom(s, d);
    const op = this.scoreOpen(s);
    const dep = s.depth;

    const ca = Math.cos(g.ang), sa = Math.sin(g.ang);
    const nx = -sa, ny = ca;                 // 法線（+側 = 下唇）
    const N = 26;
    const rnd = U.mulberry32(s.seed);
    /* 低い周波数のゆらぎ（のこぎり歯にならないよう2回ならす） */
    const jag = [];
    for (let i = 0; i <= N; i++) jag.push(rnd() * 2 - 1);
    for (let pass = 0; pass < 3; pass++) {
      const cp = jag.slice();
      for (let i = 1; i < N; i++) jag[i] = (cp[i - 1] + cp[i] * 1.6 + cp[i + 1]) / 3.6;
    }

    /* 開き幅と耳の持ち上がり */
    const gapW = d.R * (0.050 + 0.34 * op * dep);
    const lift = d.R * 0.34 * op * dep;
    const anchor = d.R * (0.04 + 0.30 * op) * dep;

    const P = (s0, offN) => {
      const x = g.cx + ca * s0 * g.half + nx * offN;
      const y = g.cy + sa * s0 * g.half + ny * offN;
      return [x, y];
    };
    const taperG = (s0) => Math.pow(Math.max(0, 1 - s0 * s0), 0.60);
    const taperE = (s0) => Math.pow(Math.max(0, 1 - s0 * s0), 0.48);

    const crumb = CRUMB(b);

    /* 1) 割れ目（内側） */
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const s0 = -1 + (2 * i) / N;
      const w = gapW * 0.5 * taperG(s0);
      const l = lift * taperE(s0);
      const p = P(s0, -(w + l * 0.92));
      i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]);
    }
    for (let i = N; i >= 0; i--) {
      const s0 = -1 + (2 * i) / N;
      const w = gapW * 0.5 * taperG(s0) * (1 + jag[i] * 0.16 * op);
      const p = P(s0, w);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();

    if (op < 0.02) {
      /* 焼く前：浅い一本線。うっすら影と、切り口の白い縁 */
      ctx.fillStyle = U.rgb2css(dk(crust, 0.46), 0.66);
      ctx.fill();
      ctx.save();
      ctx.lineWidth = d.R * 0.016;
      ctx.strokeStyle = 'rgba(255,255,248,0.42)';
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const s0 = -1 + (2 * i) / N;
        const p = P(s0, -gapW * 0.5 * taperG(s0) - d.R * 0.012);
        i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
      ctx.restore();
    } else {
      /* 焼成中：内側はクラム色。耳の下は影 */
      const gx0 = g.cx + nx * -(gapW * 0.5 + lift);
      const gy0 = g.cy + ny * -(gapW * 0.5 + lift);
      const gx1 = g.cx + nx * (gapW * 0.6);
      const gy1 = g.cy + ny * (gapW * 0.6);
      const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      grad.addColorStop(0.00, U.rgb2css(dk(crumb, 0.78)));
      grad.addColorStop(0.30, U.rgb2css(dk(crumb, 0.54)));
      grad.addColorStop(0.56, U.rgb2css(dk(crumb, 0.22)));
      grad.addColorStop(0.80, U.rgb2css(crumb));
      grad.addColorStop(1.00, U.rgb2css(lt(U.warm(crumb, 0.6 * b), 0.10)));
      ctx.fillStyle = grad;
      ctx.fill();

      /* 割れ目の中のクラムの粗さ */
      ctx.save();
      ctx.clip();
      const cr = U.mulberry32(s.seed + 11);
      for (let i = 0; i < 16; i++) {
        const s1 = cr() * 2 - 1;
        const w1 = gapW * 0.5 * taperG(s1);
        const pp = P(s1, (cr() * 2 - 1) * w1 * 0.9 - lift * taperE(s1) * 0.4);
        const rr = d.R * (0.012 + cr() * 0.030);
        ctx.fillStyle = cr() < 0.5
          ? `rgba(120,80,40,${(0.10 + cr() * 0.10).toFixed(3)})`
          : `rgba(255,248,228,${(0.10 + cr() * 0.14).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(pp[0], pp[1], rr * 1.4, rr, g.ang, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    }

    if (op < 0.02) return;

    /* 2) 耳（持ち上がった皮のフラップ） */
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const s0 = -1 + (2 * i) / N;
      const w = gapW * 0.5 * taperG(s0);
      const l = lift * taperE(s0) * (1 + jag[i] * 0.22);
      const p = P(s0, -(w + l));
      i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]);
    }
    for (let i = N; i >= 0; i--) {
      const s0 = -1 + (2 * i) / N;
      const p = P(s0, -anchor * taperE(s0) * 0.9);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();

    const earTop = lt(U.mixRgb(crust, U.hex2rgb('#f2dfba'), 0.24 * (1 - b * 0.5)), 0.09);
    const ex0 = g.cx + nx * -(gapW * 0.5 + lift);
    const ey0 = g.cy + ny * -(gapW * 0.5 + lift);
    const ex1 = g.cx + nx * -anchor * 0.4;
    const ey1 = g.cy + ny * -anchor * 0.4;
    const eg = ctx.createLinearGradient(ex0, ey0, ex1, ey1);
    eg.addColorStop(0.00, U.rgb2css(lt(earTop, 0.36)));
    eg.addColorStop(0.30, U.rgb2css(earTop));
    eg.addColorStop(0.72, U.rgb2css(dk(crust, 0.10)));
    eg.addColorStop(1.00, U.rgb2css(dk(crust, 0.26)));
    ctx.fillStyle = eg;
    ctx.fill();

    /* 3) 稜線のすぐ内側に落ちる影（耳が浮いている証拠） */
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineWidth = d.R * 0.10 * op;
    ctx.strokeStyle = U.rgb2css(dk(crumb, 0.85), 0.42 * op);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const s0 = -1 + (2 * i) / N;
      const w = gapW * 0.5 * taperG(s0);
      const l = lift * taperE(s0) * (1 + jag[i] * 0.22);
      const p = P(s0, -(w + l) + d.R * 0.045 * op);
      i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.restore();

    /* 4) 耳の稜線（パリッとした縁）— 中央ほど太い */
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const rimCol = U.rgb2css(
      U.mixRgb(U.hex2rgb('#fffaf0'), lt(crust, 0.34), U.clamp(b * 0.8, 0, 1)),
      0.62
    );
    for (let i = 0; i < N; i++) {
      const s0 = -1 + (2 * i) / N;
      const s1 = -1 + (2 * (i + 1)) / N;
      const w0 = gapW * 0.5 * taperG(s0), w1 = gapW * 0.5 * taperG(s1);
      const l0 = lift * taperE(s0) * (1 + jag[i] * 0.22);
      const l1 = lift * taperE(s1) * (1 + jag[i + 1] * 0.22);
      const p0 = P(s0, -(w0 + l0)), p1 = P(s1, -(w1 + l1));
      ctx.strokeStyle = rimCol;
      ctx.lineWidth = d.R * (0.018 + 0.036 * taperE(s0)) * (0.4 + 0.6 * op);
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    }
    ctx.restore();

    /* 5) 割れ目のふちから伸びる細かいひび */
    if (b > 0.55) {
      const ck = U.range(b, 0.55, 0.95);
      ctx.save();
      ctx.lineWidth = d.R * 0.012;
      ctx.strokeStyle = U.rgb2css(dk(crust, 0.34), 0.38 * ck);
      const nc = 5;
      for (let i = 0; i < nc; i++) {
        const s0 = -0.8 + (1.6 * i) / (nc - 1);
        const w = gapW * 0.5 * taperG(s0);
        const p = P(s0, w);
        const dir = (i % 2 ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(
          p[0] + nx * d.R * 0.22 * ck + ca * dir * d.R * 0.10,
          p[1] + ny * d.R * 0.22 * ck + sa * dir * d.R * 0.10
        );
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  /* クープの画面上の位置（きらめきや音の発生位置に使う） */
  Loaf.prototype.scoreCenterLocal = function (s) {
    const d = this.dims();
    const g = this.scoreGeom(s, d);
    return { x: g.cx, y: g.cy, ang: g.ang, half: g.half };
  };

  /* 生地の上かどうか（ローカル座標） */
  Loaf.prototype.contains = function (x, y, pad) {
    const d = this.dims();
    const u = x / d.hl;
    if (Math.abs(u) > 1.05) return false;
    const p = this.profile(U.clamp(u, -1, 1), d);
    return Math.abs(y) <= d.R * p + (pad || 0);
  };

  global.Loaf = Loaf;
})(window);
