/* =========================================================
   scene.js — 背景・道具・粒子（粉／蒸気／きらめき）
   ========================================================= */
(function (global) {
  'use strict';

  const S = {};

  /* ---------- 使い回し用オフスクリーン ---------- */
  function Cache() { this.c = null; this.key = ''; }
  Cache.prototype.get = function (w, h, key, paint) {
    w = Math.max(2, Math.ceil(w)); h = Math.max(2, Math.ceil(h));
    const k = w + 'x' + h + '|' + key;
    if (this.c && this.key === k) return this.c;
    if (!this.c) this.c = document.createElement('canvas');
    this.c.width = w; this.c.height = h;
    const g = this.c.getContext('2d');
    g.clearRect(0, 0, w, h);
    paint(g, w, h);
    this.key = k;
    return this.c;
  };

  const wallCache = new Cache();
  const benchCache = new Cache();
  const clothCache = new Cache();
  const ovenCache = new Cache();

  /* =========================================================
     粒子
     ========================================================= */
  function Particles() { this.list = []; }
  Particles.prototype.clear = function () { this.list.length = 0; };
  Particles.prototype.flour = function (x, y, n, spread) {
    spread = spread || 1;
    for (let i = 0; i < n; i++) {
      this.list.push({
        k: 'flour', x: x + U.rr(-14, 14) * spread, y: y + U.rr(-8, 8) * spread,
        vx: U.rr(-46, 46) * spread, vy: U.rr(-72, -18) * spread,
        r: U.rr(2, 8) * spread, life: 0, max: U.rr(0.6, 1.3), a: U.rr(0.35, 0.8),
      });
    }
  };
  Particles.prototype.steam = function (x, y, n, spread, power) {
    spread = spread || 1; power = power || 1;
    for (let i = 0; i < n; i++) {
      this.list.push({
        k: 'steam', x: x + U.rr(-30, 30) * spread, y: y + U.rr(-16, 16) * spread,
        vx: U.rr(-40, 40) * power, vy: U.rr(-70, -22) * power,
        r: U.rr(9, 24) * spread, grow: U.rr(15, 38) * spread,
        life: 0, max: U.rr(1.1, 2.2), a: U.rr(0.20, 0.46),
      });
    }
  };
  Particles.prototype.spark = function (x, y, n, hue) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        k: 'spark', x: x + U.rr(-16, 16), y: y + U.rr(-16, 16),
        vx: U.rr(-52, 52), vy: U.rr(-84, -14),
        r: U.rr(3, 8), life: 0, max: U.rr(0.5, 1.1), a: 1,
        hue: hue === undefined ? U.rr(35, 55) : hue,
      });
    }
  };
  Particles.prototype.crumb = function (x, y, n) {
    for (let i = 0; i < n; i++) {
      this.list.push({
        k: 'crumb', x: x, y: y, vx: U.rr(-70, 70), vy: U.rr(-120, -40),
        r: U.rr(1.5, 4), life: 0, max: U.rr(0.5, 0.9), a: 1, g: 420,
      });
    }
  };
  Particles.prototype.update = function (dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life += dt;
      if (p.life >= p.max) { l.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'flour') { p.vy += 46 * dt; p.vx *= 0.985; }
      else if (p.k === 'steam') { p.vy -= 8 * dt; p.vx *= 0.99; p.r += p.grow * dt; }
      else if (p.k === 'spark') { p.vy += 90 * dt; }
      else if (p.k === 'crumb') { p.vy += p.g * dt; }
    }
  };
  Particles.prototype.draw = function (ctx) {
    const l = this.list;
    for (let i = 0; i < l.length; i++) {
      const p = l[i];
      const t = p.life / p.max;
      if (p.k === 'steam') {
        const a = p.a * Math.sin(Math.min(1, t * 1.2) * Math.PI) * 0.9;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(255,255,255,${(a * 0.9).toFixed(3)})`);
        g.addColorStop(0.55, `rgba(255,252,246,${(a * 0.42).toFixed(3)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, U.TAU); ctx.fill();
      } else if (p.k === 'flour') {
        const a = p.a * (1 - t) * 0.9;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(255,253,247,${a.toFixed(3)})`);
        g.addColorStop(1, 'rgba(255,253,247,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, U.TAU); ctx.fill();
      } else if (p.k === 'spark') {
        const a = (1 - t);
        const r = p.r * (0.6 + 0.9 * Math.sin(t * Math.PI));
        ctx.fillStyle = `hsla(${p.hue},95%,72%,${a.toFixed(3)})`;
        star(ctx, p.x, p.y, r, r * 0.4, 4, p.life * 4);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(206,160,96,${(1 - t).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, U.TAU); ctx.fill();
      }
    }
  };

  function star(ctx, x, y, R, r, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i * Math.PI) / n;
      const rr = i % 2 ? r : R;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  S.star = star;

  /* =========================================================
     背景（お店の壁・棚・ガーランド）
     ========================================================= */
  S.background = function (ctx, L, time) {
    const w = L.w, h = L.h;
    const img = wallCache.get(w, h, 'wall', (g, W, H) => {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#fdf1e0');
      bg.addColorStop(0.55, '#f8e3cc');
      bg.addColorStop(1, '#eed3b6');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);

      /* 壁のストライプ（やさしいピンク） */
      g.save();
      g.globalAlpha = 0.32;
      const sw = Math.max(28, W / 14);
      for (let x = -H; x < W + H; x += sw * 2) {
        g.fillStyle = '#fbe0e4';
        g.fillRect(x, 0, sw, H);
      }
      g.restore();

      /* 上部のやわらかい光 */
      const gl = g.createRadialGradient(W * 0.3, -H * 0.15, 10, W * 0.3, -H * 0.15, H * 0.95);
      gl.addColorStop(0, 'rgba(255,246,220,0.85)');
      gl.addColorStop(1, 'rgba(255,246,220,0)');
      g.fillStyle = gl; g.fillRect(0, 0, W, H);

      /* 床の影 */
      const fs = g.createLinearGradient(0, H * 0.7, 0, H);
      fs.addColorStop(0, 'rgba(120,74,40,0)');
      fs.addColorStop(1, 'rgba(120,74,40,0.20)');
      g.fillStyle = fs; g.fillRect(0, H * 0.7, W, H * 0.3);
    });
    ctx.drawImage(img, 0, 0);

    /* ガーランド（虹色・装飾はカラフルでOK） */
    const yTop = h * 0.045;
    const n = Math.max(7, Math.round(w / 90));
    ctx.save();
    ctx.strokeStyle = 'rgba(196,140,110,0.5)';
    ctx.lineWidth = Math.max(1.5, h * 0.003);
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const x = (w * i) / 60;
      const y = yTop + Math.sin((i / 60) * Math.PI) * h * 0.028;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    const cols = ['#ffb3c7', '#ffd79a', '#b9e6b1', '#a9d8f5', '#d9b8f0', '#ffc4a3'];
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      const x = w * k;
      const y = yTop + Math.sin(k * Math.PI) * h * 0.028;
      const sway = Math.sin(time * 1.1 + i) * 0.10;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(sway);
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.moveTo(-w * 0.016, 0); ctx.lineTo(w * 0.016, 0); ctx.lineTo(0, h * 0.040);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

  /* =========================================================
     作業台
     ========================================================= */
  S.bench = function (ctx, L) {
    const y = L.benchY, w = L.w, h = L.h - L.benchY;
    const img = benchCache.get(w, h, 'bench', (g, W, H) => {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#c99a63');
      bg.addColorStop(0.12, '#bb8a54');
      bg.addColorStop(1, '#9d6f41');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);

      const rnd = U.mulberry32(7);
      /* 板目 */
      g.save();
      const planks = Math.max(3, Math.round(H / 90));
      for (let i = 1; i < planks; i++) {
        const py = (H * i) / planks;
        g.strokeStyle = 'rgba(96,60,28,0.30)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, py); g.lineTo(W, py); g.stroke();
        g.strokeStyle = 'rgba(255,225,185,0.20)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(0, py + 2.2); g.lineTo(W, py + 2.2); g.stroke();
      }
      /* 木目 */
      for (let i = 0; i < 90; i++) {
        const py = rnd() * H;
        g.strokeStyle = `rgba(${rnd() < 0.5 ? '120,76,36' : '226,186,140'},${0.05 + rnd() * 0.10})`;
        g.lineWidth = 0.7 + rnd() * 2.2;
        g.beginPath();
        g.moveTo(-10, py);
        for (let x = 0; x <= W + 10; x += 40) g.lineTo(x, py + Math.sin(x * 0.02 + i) * 2.5);
        g.stroke();
      }
      /* 天板のふち */
      const eg = g.createLinearGradient(0, 0, 0, H * 0.05);
      eg.addColorStop(0, 'rgba(255,232,196,0.55)');
      eg.addColorStop(1, 'rgba(255,232,196,0)');
      g.fillStyle = eg; g.fillRect(0, 0, W, H * 0.05);
      /* 打ち粉 */
      for (let i = 0; i < 260; i++) {
        const x = rnd() * W, py = rnd() * H, r = 1 + rnd() * 9;
        const rg = g.createRadialGradient(x, py, 0, x, py, r);
        rg.addColorStop(0, `rgba(255,252,244,${0.10 + rnd() * 0.28})`);
        rg.addColorStop(1, 'rgba(255,252,244,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x, py, r, 0, U.TAU); g.fill();
      }
      g.restore();
    });
    ctx.drawImage(img, 0, y);
    /* 台の前の影 */
    const sh = ctx.createLinearGradient(0, y - L.h * 0.05, 0, y + L.h * 0.02);
    sh.addColorStop(0, 'rgba(90,54,24,0)');
    sh.addColorStop(1, 'rgba(90,54,24,0.22)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, y - L.h * 0.05, L.w, L.h * 0.07);
  };

  /* =========================================================
     発酵布（クープ・発酵の舞台）
     折り目のある麻布。バゲットはこの襞の間に寝かせる。
     ========================================================= */
  S.cloth = function (ctx, L, opts) {
    opts = opts || {};
    const x = L.cloth.x, y = L.cloth.y, w = L.cloth.w, h = L.cloth.h;
    const ang = L.cloth.ang || 0;
    const img = clothCache.get(w, h, 'cloth' + (L.portrait ? 'p' : 'l'), (g, W, H) => {
      const bg = g.createLinearGradient(0, 0, W * 0.2, H);
      bg.addColorStop(0, '#f0e2c4');
      bg.addColorStop(0.5, '#e7d5b0');
      bg.addColorStop(1, '#dbc59a');
      g.fillStyle = bg;
      U.roundRect(g, 0, 0, W, H, Math.min(W, H) * 0.06);
      g.fill();

      g.save();
      U.roundRect(g, 0, 0, W, H, Math.min(W, H) * 0.06);
      g.clip();

      /* 織り目 */
      const rnd = U.mulberry32(31);
      g.globalAlpha = 0.35;
      for (let i = 0; i < H; i += 3) {
        g.strokeStyle = i % 6 ? 'rgba(255,255,255,0.35)' : 'rgba(190,166,128,0.35)';
        g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke();
      }
      for (let i = 0; i < W; i += 3) {
        g.strokeStyle = i % 6 ? 'rgba(255,255,255,0.22)' : 'rgba(190,166,128,0.22)';
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke();
      }
      g.globalAlpha = 1;

      /* 打ち粉 */
      for (let i = 0; i < 200; i++) {
        const px = rnd() * W, py = rnd() * H, r = 1 + rnd() * 7;
        const rg = g.createRadialGradient(px, py, 0, px, py, r);
        rg.addColorStop(0, `rgba(255,255,250,${0.15 + rnd() * 0.3})`);
        rg.addColorStop(1, 'rgba(255,255,250,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(px, py, r, 0, U.TAU); g.fill();
      }
      g.restore();
      /* 布のふち */
      g.strokeStyle = 'rgba(198,168,124,0.7)';
      g.lineWidth = 2;
      U.roundRect(g, 1, 1, W - 2, H - 2, Math.min(W, H) * 0.06);
      g.stroke();
    });

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    /* 布の影 */
    ctx.fillStyle = 'rgba(96,60,28,0.22)';
    U.roundRect(ctx, -w / 2 + 6, -h / 2 + 10, w, h, Math.min(w, h) * 0.06);
    ctx.fill();
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    /* 襞（ひだ）— 布のローカルx（＝バゲットの軸）に沿って走り、y方向に並ぶ */
    const folds = opts.folds || 3;
    ctx.save();
    U.roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.06);
    ctx.clip();
    for (let i = 0; i <= folds; i++) {
      const k = (i + 0.5) / (folds + 1);
      const pos = -h / 2 + h * k;
      const fw = (h / (folds + 1)) * 0.34;
      ctx.save();
      ctx.translate(0, pos);
      const gg = ctx.createLinearGradient(0, -fw, 0, fw);
      gg.addColorStop(0, 'rgba(140,108,64,0.00)');
      gg.addColorStop(0.28, 'rgba(140,108,64,0.28)');
      gg.addColorStop(0.5, 'rgba(255,248,228,0.42)');
      gg.addColorStop(0.72, 'rgba(140,108,64,0.28)');
      gg.addColorStop(1, 'rgba(140,108,64,0.00)');
      ctx.fillStyle = gg;
      ctx.fillRect(-w / 2, -fw, w, fw * 2);
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  };

  /* =========================================================
     オーブン
     ========================================================= */
  S.ovenExterior = function (ctx, L, doorOpen, glow, time) {
    const o = L.oven;
    const img = ovenCache.get(o.w, o.h, 'oven', (g, W, H) => {
      /* 本体 */
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#6f4d3c');
      bg.addColorStop(0.5, '#5c3f31');
      bg.addColorStop(1, '#472f24');
      g.fillStyle = bg;
      U.roundRect(g, 0, 0, W, H, W * 0.07);
      g.fill();
      /* レンガ */
      g.save();
      U.roundRect(g, 0, 0, W, H, W * 0.07); g.clip();
      const bh = H / 9;
      for (let r = 0; r < 10; r++) {
        for (let c = -1; c < 8; c++) {
          const bw = W / 6;
          const x = c * bw + (r % 2 ? bw / 2 : 0);
          const y = r * bh;
          g.fillStyle = `rgba(${150 + ((r * 7 + c * 13) % 26)},${96 + ((r * 5 + c * 3) % 20)},${72},0.20)`;
          U.roundRect(g, x + 2, y + 2, bw - 4, bh - 4, 3);
          g.fill();
        }
      }
      g.restore();
      /* ふち */
      g.strokeStyle = 'rgba(255,220,180,0.25)';
      g.lineWidth = 3;
      U.roundRect(g, 2, 2, W - 4, H - 4, W * 0.07); g.stroke();
    });
    ctx.drawImage(img, o.x, o.y, o.w, o.h);
  };

  /* オーブン庫内（焼成中の主役の舞台）
     ゲーム全体が真上からの視点なので、庫内も炉床を見下ろす画にする。 */
  S.ovenInterior = function (ctx, L, heat, time) {
    const o = L.ovenIn;
    const r = Math.min(o.w, o.h) * 0.06;
    ctx.save();
    U.roundRect(ctx, o.x, o.y, o.w, o.h, r);
    ctx.clip();

    /* 炉床（石） */
    const cx = o.x + o.w * 0.5, cy = o.y + o.h * 0.56;
    ctx.fillStyle = '#38200f';
    ctx.fillRect(o.x, o.y, o.w, o.h);
    const rnd = U.mulberry32(19);
    const cell = Math.max(38, Math.min(o.w, o.h) / 5);
    for (let y = o.y; y < o.y + o.h; y += cell) {
      for (let x = o.x - cell; x < o.x + o.w; x += cell) {
        const ox = (Math.round((y - o.y) / cell) % 2) * cell * 0.5;
        ctx.fillStyle = `rgba(${96 + rnd() * 28 | 0},${58 + rnd() * 18 | 0},${34 + rnd() * 14 | 0},0.5)`;
        U.roundRect(ctx, x + ox + 2, y + 2, cell - 4, cell - 4, 5);
        ctx.fill();
      }
    }

    /* 熱：中心のパンのあたりが一番明るい */
    const hi = 0.30 + 0.30 * heat + Math.sin(time * 3.1) * 0.02;
    const hg = ctx.createRadialGradient(cx, cy, Math.min(o.w, o.h) * 0.03, cx, cy, Math.max(o.w, o.h) * 0.72);
    hg.addColorStop(0, `rgba(255,176,86,${hi.toFixed(3)})`);
    hg.addColorStop(0.35, `rgba(255,134,44,${(hi * 0.45).toFixed(3)})`);
    hg.addColorStop(1, 'rgba(210,70,16,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(o.x, o.y, o.w, o.h);

    /* 四隅から炎のゆらぎ */
    for (let i = 0; i < 4; i++) {
      const ex = i % 2 ? o.x + o.w : o.x;
      const ey = i < 2 ? o.y : o.y + o.h;
      const fl = 0.55 + Math.sin(time * 5.2 + i * 1.7) * 0.16 + Math.sin(time * 2.6 + i) * 0.10;
      const g2 = ctx.createRadialGradient(ex, ey, 0, ex, ey, Math.max(o.w, o.h) * 0.42);
      g2.addColorStop(0, `rgba(255,146,50,${(0.45 * fl * (0.35 + heat)).toFixed(3)})`);
      g2.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }

    /* 周辺を落として奥行きを出す */
    const vg = ctx.createRadialGradient(cx, cy, Math.min(o.w, o.h) * 0.18, cx, cy, Math.max(o.w, o.h) * 0.68);
    vg.addColorStop(0, 'rgba(20,8,2,0)');
    vg.addColorStop(1, 'rgba(16,6,2,0.82)');
    ctx.fillStyle = vg;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.restore();
  };

  /* オーブンの扉（ガラス＋枠）— 庫内の手前に重ねる */
  S.ovenFrame = function (ctx, L, openK, time) {
    const o = L.ovenIn;
    ctx.save();
    /* ガラスの反射 */
    ctx.save();
    U.roundRect(ctx, o.x, o.y, o.w, o.h, Math.min(o.w, o.h) * 0.06);
    ctx.clip();
    const rg = ctx.createLinearGradient(o.x, o.y, o.x + o.w * 0.7, o.y + o.h);
    rg.addColorStop(0, 'rgba(255,255,255,0.13)');
    rg.addColorStop(0.35, 'rgba(255,255,255,0.03)');
    rg.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = rg;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.restore();

    /* 枠 */
    ctx.lineWidth = Math.max(6, o.w * 0.030);
    ctx.strokeStyle = '#3f2a1e';
    U.roundRect(ctx, o.x, o.y, o.w, o.h, Math.min(o.w, o.h) * 0.06);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, o.w * 0.010);
    ctx.strokeStyle = 'rgba(255,214,160,0.35)';
    U.roundRect(ctx, o.x + 3, o.y + 3, o.w - 6, o.h - 6, Math.min(o.w, o.h) * 0.055);
    ctx.stroke();
    ctx.restore();
  };

  /* =========================================================
     ピール（パン板）
     ========================================================= */
  S.peel = function (ctx, x, y, w, h, ang) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang || 0);
    ctx.fillStyle = 'rgba(80,50,24,0.25)';
    U.roundRect(ctx, -w * 0.5 + 4, -h * 0.5 + 6, w, h, h * 0.3); ctx.fill();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#e0bb85');
    g.addColorStop(0.5, '#cfa168');
    g.addColorStop(1, '#b2854f');
    ctx.fillStyle = g;
    U.roundRect(ctx, -w * 0.5, -h * 0.5, w, h, h * 0.3); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,40,0.4)'; ctx.lineWidth = 2;
    U.roundRect(ctx, -w * 0.5, -h * 0.5, w, h, h * 0.3); ctx.stroke();
    /* 柄 */
    ctx.fillStyle = '#b2854f';
    U.roundRect(ctx, w * 0.48, -h * 0.09, w * 0.20, h * 0.18, h * 0.09); ctx.fill();
    ctx.restore();
  };

  /* =========================================================
     クーリングラック
     ========================================================= */
  S.rack = function (ctx, r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.ang || 0);
    const w = r.w, h = r.h;
    ctx.fillStyle = 'rgba(90,58,28,0.20)';
    U.roundRect(ctx, -w / 2 + 5, -h / 2 + 9, w, h, h * 0.5); ctx.fill();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#dfe5ea');
    g.addColorStop(0.45, '#c3ccd4');
    g.addColorStop(1, '#95a0a9');
    ctx.fillStyle = g;
    U.roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1.5, h * 0.10);
    ctx.beginPath();
    const n = Math.max(8, Math.round(w / 30));
    for (let i = 1; i < n; i++) {
      const x = -w / 2 + (w * i) / n;
      ctx.moveTo(x, -h / 2 + h * 0.18); ctx.lineTo(x, h / 2 - h * 0.18);
    }
    ctx.stroke();
    ctx.restore();
  };

  /* =========================================================
     パン職人（大人）— 安全に作業する人。
     プレイヤーはこの人の手元を大きなジェスチャーで手伝う。
     ========================================================= */
  S.baker = function (ctx, x, y, s, time, mood) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);

    const bob = Math.sin(time * 1.6) * 3;
    ctx.translate(0, bob);

    /* 体（コックコート） */
    ctx.fillStyle = '#fbf6ee';
    U.roundRect(ctx, -46, -8, 92, 104, 26); ctx.fill();
    /* エプロン（ピンク） */
    ctx.fillStyle = '#f2889f';
    U.roundRect(ctx, -34, 16, 68, 84, 14); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.35;
    U.roundRect(ctx, -20, 34, 40, 30, 8); ctx.fill();
    ctx.globalAlpha = 1;
    /* 腕 */
    ctx.strokeStyle = '#fbf6ee';
    ctx.lineWidth = 22; ctx.lineCap = 'round';
    const sw = Math.sin(time * 2.2) * 0.16;
    ctx.beginPath();
    ctx.moveTo(-40, 14); ctx.lineTo(-64 + sw * 12, 66 + sw * 8);
    ctx.moveTo(40, 14); ctx.lineTo(64 - sw * 12, 66 - sw * 8);
    ctx.stroke();
    /* 手 */
    ctx.fillStyle = '#f7d3b4';
    ctx.beginPath(); ctx.arc(-66 + sw * 12, 70 + sw * 8, 12, 0, U.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(66 - sw * 12, 70 - sw * 8, 12, 0, U.TAU); ctx.fill();

    /* 首・顔 */
    ctx.fillStyle = '#f7d3b4';
    U.roundRect(ctx, -12, -20, 24, 20, 8); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -44, 36, 38, 0, 0, U.TAU); ctx.fill();
    /* 帽子 */
    ctx.fillStyle = '#ffffff';
    U.roundRect(ctx, -34, -74, 68, 22, 10); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-18, -86, 20, 18, 0, 0, U.TAU);
    ctx.ellipse(18, -86, 20, 18, 0, 0, U.TAU);
    ctx.ellipse(0, -94, 24, 20, 0, 0, U.TAU);
    ctx.fill();
    /* 目 */
    const blink = (Math.sin(time * 0.9) > 0.985) ? 0.12 : 1;
    ctx.fillStyle = '#4a3326';
    ctx.beginPath(); ctx.ellipse(-12, -46, 4.4, 5.4 * blink, 0, 0, U.TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, -46, 4.4, 5.4 * blink, 0, 0, U.TAU); ctx.fill();
    /* ほっぺ */
    ctx.fillStyle = 'rgba(244,140,150,0.5)';
    ctx.beginPath(); ctx.ellipse(-22, -36, 8, 5.5, 0, 0, U.TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(22, -36, 8, 5.5, 0, 0, U.TAU); ctx.fill();
    /* 口 */
    ctx.strokeStyle = '#4a3326'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    const sm = mood === 'happy' ? 8 : 5;
    ctx.arc(0, -38, 10, 0.22 * Math.PI, 0.78 * Math.PI);
    ctx.stroke();
    ctx.restore();
  };

  /* =========================================================
     lame（クープナイフ）— 刃は小さく、持ち手を大きく。
     子どもが直接刃物を扱う描写にはしない（職人の道具を借りるイメージ）
     ========================================================= */
  S.lame = function (ctx, x, y, ang, s, pressed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(s, s);
    ctx.translate(0, pressed ? 2 : 0);

    /* 影 */
    ctx.fillStyle = 'rgba(60,40,20,0.22)';
    U.roundRect(ctx, -8, -60, 22, 96, 11); ctx.fill();

    /* 持ち手（木） */
    const g = ctx.createLinearGradient(-10, 0, 12, 0);
    g.addColorStop(0, '#a8703c');
    g.addColorStop(0.45, '#d79b5e');
    g.addColorStop(1, '#8c5c2f');
    ctx.fillStyle = g;
    U.roundRect(ctx, -11, -54, 22, 92, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(80,48,20,0.5)'; ctx.lineWidth = 1.6;
    U.roundRect(ctx, -11, -54, 22, 92, 11); ctx.stroke();
    /* リボン（かわいい装飾） */
    ctx.fillStyle = '#f2889f';
    U.roundRect(ctx, -12, 8, 24, 9, 4); ctx.fill();

    /* 刃（小さく、先端だけ） */
    ctx.beginPath();
    ctx.moveTo(-6, -54);
    ctx.quadraticCurveTo(-3, -78, 1, -86);
    ctx.quadraticCurveTo(6, -78, 7, -54);
    ctx.closePath();
    const bg = ctx.createLinearGradient(-6, -80, 8, -54);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(0.5, '#d7dee6');
    bg.addColorStop(1, '#9fabb6');
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = 'rgba(90,110,130,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  };

  /* =========================================================
     焼き上がりを並べる棚
     ========================================================= */
  S.shelf = function (ctx, L, loaves, time) {
    if (!L.shelf || !loaves || !loaves.length) return;  /* まだ焼いていないうちは棚を出さない */
    const sh = L.shelf;
    ctx.save();
    /* 棚板 */
    ctx.fillStyle = 'rgba(90,58,28,0.20)';
    U.roundRect(ctx, sh.x + 4, sh.y + sh.h + 4, sh.w, sh.h * 0.22, 6); ctx.fill();
    const g = ctx.createLinearGradient(0, sh.y + sh.h, 0, sh.y + sh.h * 1.25);
    g.addColorStop(0, '#c08c55');
    g.addColorStop(1, '#96693a');
    ctx.fillStyle = g;
    U.roundRect(ctx, sh.x, sh.y + sh.h, sh.w, sh.h * 0.22, 6); ctx.fill();

    /* かご */
    const n = Math.min(loaves.length, 6);
    for (let i = 0; i < n; i++) {
      const lf = loaves[loaves.length - n + i];
      const x = sh.x + sh.w * ((i + 0.5) / Math.max(1, n));
      const y = sh.y + sh.h * 0.62;
      const s = sh.h * 0.62;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.55 + (i % 3) * 0.06);
      ctx.scale(s, s);
      lf.draw(ctx, { shadow: false, quality: 'low' });
      ctx.restore();
    }
    ctx.restore();
  };

  S.Particles = Particles;
  global.Scene = S;
})(window);
