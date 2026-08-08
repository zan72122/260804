/* ------------------------------------------------------------------
   art.js — 手続き的な描画パーツ（石窯・炎・ピール・職人・粒子・ガイド）
   画像素材は一切使わず、すべて Canvas 2D で描く。
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const TAU = U.TAU;
  const A = (PZ.art = {});

  /* ================================================================
     色パレット
  ================================================================ */
  const C = (A.colors = {
    doughPale: [244, 226, 190],
    doughMid: [232, 205, 158],
    doughDeep: [214, 178, 122],
    bakedLight: [226, 182, 118],
    bakedMid: [196, 136, 66],
    bakedDeep: [150, 88, 36],
    char: [64, 38, 22],
    sauce: [193, 48, 33],
    sauceDeep: [148, 30, 22],
    cheese: [255, 250, 234],
    cheeseMelt: [252, 232, 168],
    cheeseGold: [232, 190, 104],
    basil: [72, 142, 62],
    corn: [252, 206, 60],
    tomato: [214, 62, 46],
    pepperR: [226, 74, 60],
    pepperY: [248, 196, 58],
    pepperG: [96, 176, 92],
    olive: [64, 62, 50],
    broccoli: [86, 152, 78],
    wood: [186, 138, 84],
    peel: [222, 194, 150],
    peelLight: [242, 222, 190],
    peelDark: [186, 152, 104],
    woodDark: [140, 96, 52],
    woodLight: [214, 172, 118],
    stone: [186, 168, 148],
    stoneDark: [92, 78, 68],
    pink: [244, 138, 176],
    pinkDeep: [214, 92, 140],
    mint: [126, 214, 198],
    cream: [252, 240, 220],
    skin: [246, 214, 186],
    skinShade: [222, 182, 150]
  });

  A.rainbow = ['#f47ba7', '#f9a03f', '#f7d154', '#7ac96a', '#63b7e8', '#a98bd8'];

  /* ================================================================
     テクスチャ用の静的乱数（毎フレーム同じ模様になるように事前生成）
  ================================================================ */
  function makeSpecks(n, seed) {
    const r = U.mulberry32(seed);
    const a = [];
    for (let i = 0; i < n; i++) a.push([r(), r(), r(), r()]);
    return a;
  }
  const domeSpecks = makeSpecks(260, 7);
  const floorSpecks = makeSpecks(160, 21);
  const woodGrain = makeSpecks(60, 33);

  /* ================================================================
     汎用プリミティブ
  ================================================================ */
  A.softBlob = function (ctx, x, y, r, col, alpha) {
    if (r <= 0.2) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.css(col, alpha));
    g.addColorStop(0.55, U.css(col, alpha * 0.55));
    g.addColorStop(1, U.css(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };

  A.glow = function (ctx, x, y, r, css0, css1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    g.addColorStop(0, css0);
    g.addColorStop(1, css1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r), 0, TAU);
    ctx.fill();
  };

  /* ================================================================
     粒子システム（ワールド座標）
  ================================================================ */
  function Particles() { this.list = []; }
  A.Particles = Particles;

  Particles.prototype.add = function (p) {
    if (this.list.length > 420) this.list.shift();
    p.life = p.life || 1;
    p.age = 0;
    this.list.push(p);
    return p;
  };

  Particles.prototype.flour = function (x, y, n, spread, up) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, TAU);
      const s = U.rand(0.2, 1) * (spread || 40);
      this.add({
        kind: 'flour', x: x + Math.cos(a) * s * 0.4, y: y + Math.sin(a) * s * 0.2,
        vx: Math.cos(a) * s * 0.9, vy: Math.sin(a) * s * 0.4 - (up === undefined ? 26 : up),
        r: U.rand(6, 20), life: U.rand(0.7, 1.5), rot: 0
      });
    }
  };

  Particles.prototype.spark = function (x, y, n, spread, up) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const s = U.rand(20, 90);
      this.add({
        kind: 'spark', x: x + U.rand(-spread, spread), y: y + U.rand(-spread * 0.3, spread * 0.3),
        vx: Math.cos(a) * s * 0.5, vy: Math.sin(a) * s - (up || 40),
        r: U.rand(1.4, 3.6), life: U.rand(0.6, 1.6), hue: U.rand(18, 46)
      });
    }
  };

  Particles.prototype.smoke = function (x, y, n, spread) {
    for (let i = 0; i < n; i++) {
      this.add({
        kind: 'smoke', x: x + U.rand(-spread, spread), y: y + U.rand(-spread * 0.4, spread * 0.4),
        vx: U.rand(-12, 12), vy: U.rand(-46, -22),
        r: U.rand(14, 34), life: U.rand(1.2, 2.4)
      });
    }
  };

  Particles.prototype.star = function (x, y, n, spread, col) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, TAU), s = U.rand(30, 150);
      this.add({
        kind: 'star', x: x + U.rand(-spread, spread), y: y + U.rand(-spread, spread),
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        r: U.rand(5, 13), life: U.rand(0.6, 1.3), col: col || '#fff3b0', rot: U.rand(0, TAU)
      });
    }
  };

  Particles.prototype.crumb = function (x, y, n, col) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, TAU), s = U.rand(30, 110);
      this.add({
        kind: 'crumb', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 60,
        r: U.rand(2, 5), life: U.rand(0.5, 1.0), col: col || '#e8cd9e'
      });
    }
  };

  Particles.prototype.update = function (dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) { L.splice(i, 1); continue; }
      const k = p.age / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'flour') { p.vx *= Math.exp(-2.4 * dt); p.vy = p.vy * Math.exp(-2.0 * dt) - 8 * dt; p.r += 14 * dt; }
      else if (p.kind === 'spark') { p.vy -= 30 * dt; p.vx += Math.sin(p.age * 9 + p.r) * 26 * dt; }
      else if (p.kind === 'smoke') { p.vy *= Math.exp(-0.5 * dt); p.r += 20 * dt; }
      else if (p.kind === 'star') { p.vy += 120 * dt; p.vx *= Math.exp(-1.5 * dt); p.rot += dt * 3; }
      else if (p.kind === 'crumb') { p.vy += 420 * dt; }
      p.k = k;
    }
  };

  Particles.prototype.draw = function (ctx) {
    const L = this.list;
    // 加算合成のものを後で
    ctx.save();
    for (let i = 0; i < L.length; i++) {
      const p = L[i], k = p.k || 0;
      if (p.kind === 'flour') {
        const a = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.5;
        A.softBlob(ctx, p.x, p.y, p.r, [255, 255, 255], a * 0.8);
      } else if (p.kind === 'smoke') {
        const a = Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.22;
        A.softBlob(ctx, p.x, p.y, p.r, [180, 170, 165], a);
      } else if (p.kind === 'crumb') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < L.length; i++) {
      const p = L[i], k = p.k || 0;
      if (p.kind === 'spark') {
        const a = (1 - k) * 0.95;
        ctx.fillStyle = 'hsla(' + p.hue + ',100%,' + (60 + 25 * (1 - k)) + '%,' + a + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, TAU); ctx.fill();
      } else if (p.kind === 'star') {
        const a = Math.sin(Math.min(1, k * 1.2) * Math.PI);
        A.drawStar(ctx, p.x, p.y, p.r * (0.6 + a * 0.8), p.rot, p.col, a * 0.95);
      }
    }
    ctx.restore();
  };

  A.drawStar = function (ctx, x, y, r, rot, col, alpha) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = col || '#fff';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const rr = i % 2 === 0 ? r : r * 0.34;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  /* ================================================================
     背景（画面座標） — 店内のあたたかい空気
  ================================================================ */
  A.drawBackdrop = function (ctx, sw, sh, warm) {
    const g = ctx.createLinearGradient(0, 0, 0, sh);
    g.addColorStop(0, '#3b1f1a');
    g.addColorStop(0.45, '#542c22');
    g.addColorStop(1, '#2a1512');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, sw, sh);
    // 窯からのあたたかい光
    if (warm > 0.001) {
      const rg = ctx.createRadialGradient(warm.x, warm.y, 0, warm.x, warm.y, warm.r);
      rg.addColorStop(0, 'rgba(255,150,60,' + 0.17 * warm.i + ')');
      rg.addColorStop(0.5, 'rgba(255,110,40,' + 0.07 * warm.i + ')');
      rg.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, sw, sh);
    }
  };

  /* 壁のタイルとガーランド（ワールド座標） */
  A.drawWall = function (ctx, w, wallTop, wallBottom, t) {
    const g = ctx.createLinearGradient(0, wallTop, 0, wallBottom);
    g.addColorStop(0, '#6d3b2c');
    g.addColorStop(1, '#8a5138');
    ctx.fillStyle = g;
    ctx.fillRect(-400, wallTop, w + 800, wallBottom - wallTop);

    // タイル模様
    ctx.save();
    ctx.globalAlpha = 0.16;
    const th = 86, tw = 118;
    for (let y = wallTop; y < wallBottom; y += th) {
      const off = ((y / th) | 0) % 2 ? tw / 2 : 0;
      for (let x = -400 + off; x < w + 400; x += tw) {
        ctx.fillStyle = ((x / tw) | 0) % 3 === 0 ? '#f8d8c4' : '#c98f6d';
        U.roundRect(ctx, x + 4, y + 4, tw - 8, th - 8, 10);
        ctx.fill();
      }
    }
    ctx.restore();

    // ガーランド（ピンク・虹色の飾り）
    const y0 = wallTop + 54;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,235,225,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = -380; x <= w + 380; x += 20) {
      const yy = y0 + Math.sin(x * 0.012) * 24 + Math.sin(x * 0.004 + t * 0.6) * 6;
      if (x === -380) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    let idx = 0;
    for (let x = -360; x <= w + 360; x += 96) {
      const yy = y0 + Math.sin(x * 0.012) * 24 + Math.sin(x * 0.004 + t * 0.6) * 6;
      const sway = Math.sin(t * 1.4 + idx) * 0.12;
      ctx.save();
      ctx.translate(x, yy);
      ctx.rotate(sway);
      ctx.fillStyle = A.rainbow[idx % A.rainbow.length];
      ctx.beginPath();
      ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(0, 60);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      idx++;
    }
    ctx.restore();
  };

  /* 作業台（ワールド座標） */
  A.drawCounter = function (ctx, cx, topY, halfW, depth) {
    const x0 = cx - halfW, w = halfW * 2;

    // 前板（木のパネル）
    const pg = ctx.createLinearGradient(0, topY + 30, 0, topY + depth);
    pg.addColorStop(0, '#a06a45');
    pg.addColorStop(0.35, '#8c5738');
    pg.addColorStop(1, '#5f3826');
    ctx.fillStyle = pg;
    ctx.fillRect(x0 + 8, topY + 20, w - 16, depth);

    // 板の継ぎ目
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = '#42230f';
    ctx.lineWidth = 5;
    const planks = 9;
    for (let i = 1; i < planks; i++) {
      const px = x0 + 8 + (w - 16) * (i / planks);
      ctx.beginPath(); ctx.moveTo(px, topY + 30); ctx.lineTo(px, topY + depth); ctx.stroke();
    }
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#f5d9b8';
    ctx.lineWidth = 3;
    for (let i = 1; i < planks; i++) {
      const px = x0 + 12 + (w - 16) * (i / planks);
      ctx.beginPath(); ctx.moveTo(px, topY + 30); ctx.lineTo(px, topY + depth); ctx.stroke();
    }
    ctx.restore();

    // 戸棚（扉とオープン棚）
    const doorTop = topY + 126, doorH = Math.max(120, Math.min(300, depth - 170));
    const unit = 330;
    const n0 = Math.floor((x0 + 20 - cx) / unit) - 1, n1 = Math.ceil((x0 + w - 20 - cx) / unit) + 1;
    for (let k = n0; k <= n1; k++) {
      const dx = cx + k * unit;
      if (dx - unit * 0.42 < x0 + 14 || dx + unit * 0.42 > x0 + w - 14) continue;
      const dw = unit * 0.84;
      if (((k % 3) + 3) % 3 === 1) {
        // オープン棚（お皿を積んである）
        ctx.fillStyle = 'rgba(28,14,8,0.72)';
        U.roundRect(ctx, dx - dw / 2, doorTop, dw, doorH, 14);
        ctx.fill();
        ctx.save();
        U.roundRect(ctx, dx - dw / 2, doorTop, dw, doorH, 14);
        ctx.clip();
        for (let i = 0; i < 5; i++) {
          const py = doorTop + doorH - 26 - i * 17;
          ctx.fillStyle = i % 2 ? '#fdeef4' : '#f6dbe7';
          U.ellipse(ctx, dx - dw * 0.2, py, dw * 0.27, 9); ctx.fill();
        }
        for (let i = 0; i < 3; i++) {
          const py = doorTop + doorH - 26 - i * 19;
          ctx.fillStyle = i % 2 ? '#f3e6cf' : '#e7d5b6';
          U.ellipse(ctx, dx + dw * 0.24, py, dw * 0.22, 10); ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,235,210,0.22)';
        ctx.lineWidth = 5;
        U.roundRect(ctx, dx - dw / 2, doorTop, dw, doorH, 14);
        ctx.stroke();
      } else {
        // 扉
        ctx.fillStyle = 'rgba(255,232,206,0.10)';
        U.roundRect(ctx, dx - dw / 2, doorTop, dw, doorH, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(60,30,14,0.42)';
        ctx.lineWidth = 6;
        U.roundRect(ctx, dx - dw / 2, doorTop, dw, doorH, 14);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,226,196,0.20)';
        ctx.lineWidth = 4;
        U.roundRect(ctx, dx - dw / 2 + 16, doorTop + 16, dw - 32, doorH - 32, 10);
        ctx.stroke();
        ctx.fillStyle = U.css(C.pink);
        ctx.beginPath(); ctx.arc(dx, doorTop + 30, 13, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(dx - 4, doorTop + 26, 5, 0, TAU); ctx.fill();
      }
    }

    // 前板の虹タイル帯
    const ty = topY + 84;
    for (let i = 0; i * 96 < w - 40; i++) {
      ctx.fillStyle = A.rainbow[i % A.rainbow.length];
      U.roundRect(ctx, x0 + 26 + i * 96, ty, 74, 30, 9);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      U.roundRect(ctx, x0 + 26 + i * 96, ty, 74, 11, 6);
      ctx.fill();
    }

    // 天板（大理石ふう）
    const g = ctx.createLinearGradient(0, topY - 30, 0, topY + 34);
    g.addColorStop(0, '#f6e9d6');
    g.addColorStop(0.42, '#e2d0b6');
    g.addColorStop(0.62, '#cdb694');
    g.addColorStop(1, '#a98a6b');
    ctx.fillStyle = g;
    U.roundRect(ctx, x0, topY - 30, w, 64, 18);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    U.roundRect(ctx, x0 + 6, topY - 28, w - 12, 11, 8);
    ctx.fill();
  };

  /* 小道具：粉袋・トマトのかご（作業台の飾り） */
  A.drawProps = function (ctx, list) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].kind === 'sack') A.drawSack(ctx, list[i].x, list[i].y, list[i].s || 1);
      else A.drawBasket(ctx, list[i].x, list[i].y, list[i].s || 1);
    }
  };

  A.drawSack = function (ctx, sx, sy, sc) {
    ctx.save();
    ctx.translate(sx, sy); ctx.scale(sc, sc); ctx.translate(-sx, -sy);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    U.ellipse(ctx, sx, sy + 6, 62, 16); ctx.fill();
    ctx.fillStyle = '#f2e6d2';
    ctx.beginPath();
    ctx.moveTo(sx - 52, sy);
    ctx.lineTo(sx - 40, sy - 128);
    ctx.quadraticCurveTo(sx, sy - 152, sx + 40, sy - 128);
    ctx.lineTo(sx + 52, sy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#dfcdb0';
    ctx.beginPath();
    ctx.moveTo(sx + 16, sy - 138); ctx.lineTo(sx + 40, sy - 128);
    ctx.lineTo(sx + 52, sy); ctx.lineTo(sx + 24, sy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = U.css(C.pink);
    U.roundRect(ctx, sx - 44, sy - 84, 88, 30, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(sx - 22 + i * 22, sy - 69, 7, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.restore();
  };

  A.drawBasket = function (ctx, bx, by, sc) {
    ctx.save();
    ctx.translate(bx, by); ctx.scale(sc, sc); ctx.translate(-bx, -by);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    U.ellipse(ctx, bx, by + 6, 68, 17); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      ctx.fillStyle = i % 2 ? '#d8402f' : '#e35442';
      ctx.beginPath();
      ctx.arc(bx + Math.cos(a) * 30, by - 34 + Math.sin(a) * 12, 20, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5da24e';
      ctx.beginPath();
      ctx.arc(bx + Math.cos(a) * 30, by - 50 + Math.sin(a) * 12, 6, 0, TAU);
      ctx.fill();
    }
    const bg = ctx.createLinearGradient(0, by - 40, 0, by);
    bg.addColorStop(0, '#cf9c62'); bg.addColorStop(1, '#9c6c3c');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(bx - 62, by - 34);
    ctx.lineTo(bx + 62, by - 34);
    ctx.lineTo(bx + 48, by + 6);
    ctx.lineTo(bx - 48, by + 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,58,26,0.45)'; ctx.lineWidth = 4;
    for (let i = 1; i < 5; i++) {
      const u = i / 5;
      ctx.beginPath();
      ctx.moveTo(U.lerp(bx - 62, bx - 48, u) + u * 0, by - 34 + u * 40);
      ctx.lineTo(U.lerp(bx + 62, bx + 48, u), by - 34 + u * 40);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  };

  /* 打ち粉のふりかかった木の板 */
  A.drawBoard = function (ctx, cx, cy, rx, ry, flourAmt) {
    ctx.save();
    A.softBlob(ctx, cx, cy + ry * 0.30, rx * 1.12, [24, 10, 4], 0.34);
    const g = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
    g.addColorStop(0, '#c69457');
    g.addColorStop(0.55, '#ac7a3d');
    g.addColorStop(1, '#8c6030');
    ctx.fillStyle = g;
    U.ellipse(ctx, cx, cy, rx, ry); ctx.fill();
    // 木目
    ctx.save();
    U.ellipse(ctx, cx, cy, rx, ry); ctx.clip();
    ctx.globalAlpha = 0.09;
    ctx.strokeStyle = '#7d5628';
    ctx.lineWidth = 3;
    for (let i = 0; i < woodGrain.length; i += 2) {
      const s = woodGrain[i];
      ctx.beginPath();
      const yy = cy - ry + s[0] * ry * 2;
      ctx.moveTo(cx - rx, yy);
      ctx.bezierCurveTo(cx - rx * 0.3, yy + (s[1] - 0.5) * 16, cx + rx * 0.3, yy + (s[2] - 0.5) * 16, cx + rx, yy);
      ctx.stroke();
    }
    ctx.restore();
    // 打ち粉
    if (flourAmt > 0) {
      ctx.save();
      U.ellipse(ctx, cx, cy, rx, ry); ctx.clip();
      ctx.globalAlpha = 0.34 * flourAmt;
      for (let i = 0; i < 38; i++) {
        const s = floorSpecks[i % floorSpecks.length];
        A.softBlob(ctx, cx + (s[0] - 0.5) * rx * 2, cy + (s[1] - 0.5) * ry * 2, 8 + s[2] * 26, [255, 255, 255], 0.5);
      }
      ctx.restore();
    }
    ctx.restore();
  };

  /* ================================================================
     炎
  ================================================================ */
  A.drawFlames = function (ctx, x, y, w, h, t, intensity) {
    const I = U.clamp(intensity, 0, 1.4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 下地のあたたかい光
    A.glow(ctx, x, y - h * 0.2, w * 1.25, 'rgba(255,148,40,' + 0.26 * I + ')', 'rgba(255,80,20,0)');

    const tongues = 7;
    for (let i = 0; i < tongues; i++) {
      const ph = i * 1.7;
      const sway = Math.sin(t * 2.6 + ph) * w * 0.11 + Math.sin(t * 5.7 + ph * 2.1) * w * 0.05;
      const hh = h * (0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3.4 + ph * 1.3))) * I;
      const bx = x + (i / (tongues - 1) - 0.5) * w * 0.82;
      const bw = w * (0.14 + 0.06 * U.noise1(t * 2 + i * 3));
      const g = ctx.createLinearGradient(0, y, 0, y - hh);
      g.addColorStop(0, 'rgba(255,66,8,' + 0.34 * I + ')');
      g.addColorStop(0.35, 'rgba(255,144,22,' + 0.32 * I + ')');
      g.addColorStop(0.72, 'rgba(255,206,70,' + 0.24 * I + ')');
      g.addColorStop(1, 'rgba(255,246,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx - bw, y + 4);
      ctx.bezierCurveTo(bx - bw * 1.1, y - hh * 0.45, bx + sway - bw * 0.6, y - hh * 0.7, bx + sway, y - hh);
      ctx.bezierCurveTo(bx + sway + bw * 0.6, y - hh * 0.7, bx + bw * 1.1, y - hh * 0.45, bx + bw, y + 4);
      ctx.closePath();
      ctx.fill();
    }
    // 芯の白熱
    const coreH = h * 0.3 * I * (0.8 + 0.2 * Math.sin(t * 7));
    const cg = ctx.createLinearGradient(0, y + 6, 0, y - coreH);
    cg.addColorStop(0, 'rgba(255,238,186,' + 0.30 * I + ')');
    cg.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = cg;
    U.ellipse(ctx, x, y, w * 0.42, coreH * 0.9);
    ctx.fill();
    ctx.restore();
  };

  /* ================================================================
     石窯
     geo: {cx, baseY, domeHalfW, domeH, mHalfW, mFrontY, mTopY,
           backHalfW, backY, flameX, flameY}
  ================================================================ */

  /* 窯口の輪郭（サブパス版：beginPath しない） */
  A.ovenMouthSub = function (ctx, o) {
    const top = o.mTopY, front = o.mFrontY, hw = o.mHalfW;
    ctx.moveTo(o.cx - hw, front);
    ctx.lineTo(o.cx - hw, top + hw * 0.5);
    ctx.bezierCurveTo(o.cx - hw, top - hw * 0.28, o.cx + hw, top - hw * 0.28, o.cx + hw, top + hw * 0.5);
    ctx.lineTo(o.cx + hw, front);
    ctx.closePath();
  };

  A.ovenMouthPath = function (ctx, o) {
    ctx.beginPath();
    A.ovenMouthSub(ctx, o);
  };

  A.drawOvenInterior = function (ctx, o, t, fire) {
    ctx.save();
    // ゆらぎでずらしても隙間が出ないよう、窯口より少し外まで描く
    A.ovenMouthPath(ctx, {
      cx: o.cx, mHalfW: o.mHalfW + 40, mTopY: o.mTopY - 34, mFrontY: o.mFrontY + 34
    });
    ctx.clip();

    // 奥の闇
    const bg = ctx.createLinearGradient(0, o.mTopY, 0, o.mFrontY);
    bg.addColorStop(0, '#0d0403');
    bg.addColorStop(0.5, '#1b0705');
    bg.addColorStop(1, '#2a0d07');
    ctx.fillStyle = bg;
    ctx.fillRect(o.cx - o.mHalfW - 4, o.mTopY - 60, o.mHalfW * 2 + 8, o.mFrontY - o.mTopY + 80);

    // 奥の壁（ドームの内側）— 奥行きを感じさせる暗いアーチ
    const bw0 = o.backHalfW * 1.55;
    const wallTop = o.backY - o.mHalfW * 0.72;
    ctx.beginPath();
    ctx.moveTo(o.cx - bw0, o.backY + 6);
    ctx.bezierCurveTo(o.cx - bw0, wallTop, o.cx + bw0, wallTop, o.cx + bw0, o.backY + 6);
    ctx.closePath();
    const wg = ctx.createLinearGradient(0, wallTop, 0, o.backY + 6);
    wg.addColorStop(0, '#2b1109');
    wg.addColorStop(1, '#4a1c0c');
    ctx.fillStyle = wg;
    ctx.fill();

    // 天井のかすかな照り
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    A.glow(ctx, o.flameX, o.backY - o.mHalfW * 0.16, o.mHalfW * 1.05,
      'rgba(255,104,30,' + (0.20 * fire) + ')', 'rgba(255,80,20,0)');
    ctx.restore();

    // 左右の内壁（奥へすぼまる）
    const sw0 = o.mHalfW + 40, sw1 = o.backHalfW * 1.4;
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(o.cx + s * sw0, o.mFrontY + 40);
      ctx.lineTo(o.cx + s * sw0, o.mTopY - 40);
      ctx.lineTo(o.cx + s * sw1, o.backY - o.mHalfW * 0.6);
      ctx.lineTo(o.cx + s * sw1, o.backY + 8);
      ctx.closePath();
      const swg = ctx.createLinearGradient(o.cx + s * sw1, 0, o.cx + s * sw0, 0);
      swg.addColorStop(0, '#3d1a0e');
      swg.addColorStop(1, '#160805');
      ctx.fillStyle = swg;
      ctx.fill();
    }

    // 石床（奥行きのある台形）
    const fw = o.mHalfW * 1.26, bw = o.backHalfW;
    ctx.beginPath();
    ctx.moveTo(o.cx - fw, o.mFrontY + 6);
    ctx.lineTo(o.cx + fw, o.mFrontY + 6);
    ctx.lineTo(o.cx + bw, o.backY);
    ctx.lineTo(o.cx - bw, o.backY);
    ctx.closePath();
    const fg = ctx.createLinearGradient(0, o.backY, 0, o.mFrontY);
    fg.addColorStop(0, '#5c3e2c');
    fg.addColorStop(0.4, '#402a1d');
    fg.addColorStop(1, '#1f100a');
    ctx.fillStyle = fg;
    ctx.fill();

    // 床の石目
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 5; i++) {
      const v = i / 5;
      const yy = U.lerp(o.backY, o.mFrontY + 6, v * v * 0.9 + v * 0.1);
      ctx.strokeStyle = '#2a1710';
      ctx.lineWidth = 2 + v * 2;
      ctx.beginPath(); ctx.moveTo(o.cx - fw, yy); ctx.lineTo(o.cx + fw, yy); ctx.stroke();
    }
    for (let i = -3; i <= 3; i++) {
      ctx.strokeStyle = '#2a1710';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(o.cx + (i / 3) * bw, o.backY);
      ctx.lineTo(o.cx + (i / 3) * fw, o.mFrontY + 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 60; i++) {
      const s = floorSpecks[i];
      const v = s[1];
      const yy = U.lerp(o.backY, o.mFrontY, v);
      const hw2 = U.lerp(bw, fw, v);
      ctx.fillStyle = s[2] > 0.5 ? 'rgba(255,220,180,0.35)' : 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(o.cx + (s[0] - 0.5) * hw2 * 2, yy, 1.5 + s[3] * 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // 炎（奥）
    A.drawFlames(ctx, o.flameX, o.backY + 10, o.mHalfW * 0.62, o.mHalfW * 0.52, t, fire);

    // 薪（炎の手前に少しだけ見える）
    ctx.save();
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(o.flameX + (i - 1) * o.mHalfW * 0.14, o.backY + 16 + i * 4);
      ctx.rotate((i - 1) * 0.3);
      ctx.fillStyle = i === 1 ? '#1e0f08' : '#2c1710';
      U.roundRect(ctx, -o.mHalfW * 0.15, -4, o.mHalfW * 0.30, 8, 4);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 床に落ちる炎の照り返し
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createLinearGradient(0, o.backY, 0, o.mFrontY);
    rg.addColorStop(0, 'rgba(255,128,40,' + 0.13 * fire + ')');
    rg.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(o.cx - fw, o.mFrontY + 6);
    ctx.lineTo(o.cx + fw, o.mFrontY + 6);
    ctx.lineTo(o.cx + bw, o.backY);
    ctx.lineTo(o.cx - bw, o.backY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  /* 窯の外観（ドーム・アーチ・飾りタイル） */
  A.drawOvenFacade = function (ctx, o, t, fire) {
    ctx.save();

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    U.ellipse(ctx, o.cx, o.baseY + 16, o.domeHalfW * 1.05, 34);
    ctx.fill();

    // 台座（下は薪置き場）
    const pedH = o.pedestalH || 0;
    if (pedH > 0) {
      const px0 = o.cx - o.domeHalfW * 0.88, pw = o.domeHalfW * 1.76;
      const pg = ctx.createLinearGradient(0, o.baseY - 6, 0, o.baseY + pedH);
      pg.addColorStop(0, '#9a5f42');
      pg.addColorStop(1, '#6a3c29');
      ctx.fillStyle = pg;
      U.roundRect(ctx, px0, o.baseY - 6, pw, pedH + 40, 20);
      ctx.fill();

      // 薪置きのアーチ
      const nw = pw * 0.34, ny = o.baseY + pedH * 0.94, nh = pedH * 0.66;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(o.cx - nw, ny);
      ctx.lineTo(o.cx - nw, ny - nh + nw * 0.7);
      ctx.bezierCurveTo(o.cx - nw, ny - nh - nw * 0.35, o.cx + nw, ny - nh - nw * 0.35, o.cx + nw, ny - nh + nw * 0.7);
      ctx.lineTo(o.cx + nw, ny);
      ctx.closePath();
      ctx.fillStyle = '#2b160e';
      ctx.fill();
      ctx.clip();
      // 積んだ薪（木口）
      const rr = U.mulberry32(9);
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 7; i++) {
          const lx = o.cx - nw + 22 + i * (nw * 2 - 40) / 6 + (row % 2) * 12;
          const ly = ny - 26 - row * 42;
          const r0 = 19 + rr() * 6;
          ctx.fillStyle = row % 2 ? '#8a5c3a' : '#7a4f31';
          ctx.beginPath(); ctx.arc(lx, ly, r0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(240,214,180,0.55)';
          ctx.beginPath(); ctx.arc(lx, ly, r0 * 0.62, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(110,70,40,0.6)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(lx, ly, r0 * 0.34, 0, TAU); ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(o.cx - nw, ny - nh - 40, nw * 2, nh + 40);
      ctx.restore();
    }

    // ドーム本体
    ctx.beginPath();
    ctx.moveTo(o.cx - o.domeHalfW, o.baseY);
    ctx.lineTo(o.cx - o.domeHalfW, o.baseY - o.domeH * 0.34);
    ctx.bezierCurveTo(
      o.cx - o.domeHalfW, o.baseY - o.domeH * 1.06,
      o.cx + o.domeHalfW, o.baseY - o.domeH * 1.06,
      o.cx + o.domeHalfW, o.baseY - o.domeH * 0.34);
    ctx.lineTo(o.cx + o.domeHalfW, o.baseY);
    ctx.closePath();
    const dg = ctx.createLinearGradient(o.cx - o.domeHalfW, o.baseY - o.domeH, o.cx + o.domeHalfW, o.baseY);
    dg.addColorStop(0, '#f2ddc4');
    dg.addColorStop(0.4, '#e0c3a2');
    dg.addColorStop(0.75, '#c7a184');
    dg.addColorStop(1, '#a97f63');
    ctx.fillStyle = dg;
    ctx.fill();

    // 漆喰のざらつき
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.10;
    for (let i = 0; i < domeSpecks.length; i++) {
      const s = domeSpecks[i];
      ctx.fillStyle = s[3] > 0.5 ? '#fff' : '#6b4a35';
      ctx.beginPath();
      ctx.arc(o.cx + (s[0] - 0.5) * o.domeHalfW * 2, o.baseY - s[1] * o.domeH, 2 + s[2] * 7, 0, TAU);
      ctx.fill();
    }
    // 窯口まわりの熱による焦げ
    ctx.globalAlpha = 0.5;
    const sg = ctx.createRadialGradient(o.cx, o.mFrontY, o.mHalfW * 0.6, o.cx, o.mFrontY, o.mHalfW * 2.6);
    sg.addColorStop(0, 'rgba(60,34,22,0.5)');
    sg.addColorStop(1, 'rgba(60,34,22,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(o.cx - o.domeHalfW, o.baseY - o.domeH * 1.1, o.domeHalfW * 2, o.domeH * 1.2);
    ctx.restore();

    // 煙突
    const chx = o.cx + o.domeHalfW * 0.42, chy = o.baseY - o.domeH * 0.96;
    ctx.fillStyle = '#b98d6e';
    U.roundRect(ctx, chx - 26, chy - 84, 52, 100, 10);
    ctx.fill();
    ctx.fillStyle = '#8c6349';
    U.roundRect(ctx, chx - 34, chy - 96, 68, 22, 8);
    ctx.fill();

    // 窯口のレンガアーチ（窯口を evenodd でくりぬいたリング）
    ctx.save();
    const arcW = o.mHalfW * 1.30, arcTop = o.mTopY - o.mHalfW * 0.32;
    function archOuter() {
      ctx.moveTo(o.cx - arcW, o.mFrontY + 12);
      ctx.lineTo(o.cx - arcW, arcTop + arcW * 0.5);
      ctx.bezierCurveTo(o.cx - arcW, arcTop - arcW * 0.3, o.cx + arcW, arcTop - arcW * 0.3, o.cx + arcW, arcTop + arcW * 0.5);
      ctx.lineTo(o.cx + arcW, o.mFrontY + 12);
      ctx.closePath();
    }
    ctx.beginPath();
    archOuter();
    A.ovenMouthSub(ctx, o);
    const ag = ctx.createLinearGradient(o.cx - arcW, 0, o.cx + arcW, 0);
    ag.addColorStop(0, '#9c4e36');
    ag.addColorStop(0.45, '#c86f49');
    ag.addColorStop(1, '#87422d');
    ctx.fillStyle = ag;
    ctx.fill('evenodd');

    // レンガの目地
    ctx.save();
    ctx.beginPath();
    archOuter();
    A.ovenMouthSub(ctx, o);
    ctx.clip('evenodd');
    ctx.strokeStyle = 'rgba(255,232,214,0.30)';
    ctx.lineWidth = 4;
    const acy = arcTop + arcW * 0.16;
    for (let i = 0; i <= 13; i++) {
      const a = Math.PI + (i / 13) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(o.cx + Math.cos(a) * o.mHalfW * 0.9, acy + Math.sin(a) * o.mHalfW * 0.9);
      ctx.lineTo(o.cx + Math.cos(a) * arcW * 1.15, acy + Math.sin(a) * arcW * 1.15);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // 飾りタイル（ピンク・虹）
    const ty = o.baseY - 6;
    for (let i = -5; i <= 5; i++) {
      const x = o.cx + i * (o.domeHalfW * 0.17);
      ctx.fillStyle = A.rainbow[(i + 5) % A.rainbow.length];
      U.roundRect(ctx, x - o.domeHalfW * 0.072, ty - 26, o.domeHalfW * 0.144, 26, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      U.roundRect(ctx, x - o.domeHalfW * 0.072, ty - 26, o.domeHalfW * 0.144, 9, 6);
      ctx.fill();
    }
    ctx.restore();
  };

  /* 窯口の内ぶち（中身を描いたあとに重ねる影） */
  A.drawOvenMouthEdge = function (ctx, o) {
    ctx.save();
    A.ovenMouthPath(ctx, o);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 22;
    A.ovenMouthPath(ctx, o);
    ctx.stroke();
    ctx.restore();
  };

  /* 窯口からもれ出る光（外観とは別に毎フレーム描く） */
  A.drawOvenGlow = function (ctx, o, fire) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    A.glow(ctx, o.cx, o.mFrontY - o.mHalfW * 0.3, o.mHalfW * 2.2,
      'rgba(255,138,48,' + 0.17 * fire + ')', 'rgba(255,90,30,0)');
    ctx.restore();
  };

  /* ================================================================
     ピザピール（長い柄の道具）
     ブレード位置 (bx,by)、手前方向 (dx,dy) 単位ベクトル
  ================================================================ */
  A.drawPeel = function (ctx, bx, by, dx, dy, scale, squash, opt) {
    opt = opt || {};
    const part = opt.part || 'all';
    const bladeR = 152 * scale;
    const handleLen = Math.max(320, opt.handleLen || 620);
    const hx = bx + dx * handleLen, hy = by + dy * handleLen;
    const ang = Math.atan2(dy, dx);
    const shade = opt.shade === undefined ? 1 : opt.shade;

    ctx.save();
    if (part === 'blade') { A.peelBlade(ctx, bx, by, ang, bladeR, scale, squash, shade, opt); ctx.restore(); return; }
    // 影
    if (opt.shadow) {
      A.softBlob(ctx, bx, by + bladeR * squash * 0.55, bladeR * 1.15, [22, 9, 4], 0.30);
    }

    // 柄
    const w0 = 21 * scale, w1 = 20;
    const nx = -dy, ny = dx;
    ctx.beginPath();
    ctx.moveTo(bx + nx * w0, by + ny * w0);
    ctx.lineTo(hx + nx * w1, hy + ny * w1);
    ctx.lineTo(hx - nx * w1, hy - ny * w1);
    ctx.lineTo(bx - nx * w0, by - ny * w0);
    ctx.closePath();
    const hg = ctx.createLinearGradient(bx + nx * w0, by + ny * w0, bx - nx * w0, by - ny * w0);
    hg.addColorStop(0, shadeCss(C.peelLight, shade));
    hg.addColorStop(0.5, shadeCss(C.peel, shade));
    hg.addColorStop(1, shadeCss(C.peelDark, shade));
    ctx.fillStyle = hg;
    ctx.fill();

    // グリップ（ピンク）— 職人の手の位置に合わせる
    const gc = opt.gripCenter ? U.clamp(opt.gripCenter / handleLen, 0.30, 0.86) : 0.74;
    const gh = 0.16;
    const gs = gc - gh, ge = Math.min(0.98, gc + gh);
    ctx.beginPath();
    ctx.moveTo(bx + dx * handleLen * gs + nx * w1 * 1.25, by + dy * handleLen * gs + ny * w1 * 1.25);
    ctx.lineTo(bx + dx * handleLen * ge + nx * w1 * 1.25, by + dy * handleLen * ge + ny * w1 * 1.25);
    ctx.lineTo(bx + dx * handleLen * ge - nx * w1 * 1.25, by + dy * handleLen * ge - ny * w1 * 1.25);
    ctx.lineTo(bx + dx * handleLen * gs - nx * w1 * 1.25, by + dy * handleLen * gs - ny * w1 * 1.25);
    ctx.closePath();
    ctx.fillStyle = shadeCss(C.pink, shade);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,' + 0.3 * shade + ')';
    ctx.beginPath();
    ctx.moveTo(bx + dx * handleLen * gs + nx * w1 * 1.25, by + dy * handleLen * gs + ny * w1 * 1.25);
    ctx.lineTo(bx + dx * handleLen * ge + nx * w1 * 1.25, by + dy * handleLen * ge + ny * w1 * 1.25);
    ctx.lineTo(bx + dx * handleLen * ge + nx * w1 * 0.3, by + dy * handleLen * ge + ny * w1 * 0.3);
    ctx.lineTo(bx + dx * handleLen * gs + nx * w1 * 0.3, by + dy * handleLen * gs + ny * w1 * 0.3);
    ctx.closePath();
    ctx.fill();

    if (part !== 'handle') A.peelBlade(ctx, bx, by, ang, bladeR, scale, squash, shade, opt);
    ctx.restore();
  };

  /* ブレードだけ（ピザの下に敷くとき用） */
  A.peelBlade = function (ctx, bx, by, ang, bladeR, scale, squash, shade, opt) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(1, squash);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(-bladeR * 1.02, 0);
    ctx.bezierCurveTo(-bladeR * 0.95, -bladeR * 0.98, bladeR * 0.72, -bladeR * 0.86, bladeR * 1.04, -bladeR * 0.24);
    ctx.lineTo(bladeR * 1.06, bladeR * 0.24);
    ctx.bezierCurveTo(bladeR * 0.72, bladeR * 0.86, -bladeR * 0.95, bladeR * 0.98, -bladeR * 1.02, 0);
    ctx.closePath();
    const bgd = ctx.createLinearGradient(-bladeR, -bladeR, bladeR, bladeR);
    bgd.addColorStop(0, shadeCss(C.peelLight, shade));
    bgd.addColorStop(0.55, shadeCss(C.peel, shade));
    bgd.addColorStop(1, shadeCss(C.peelDark, shade));
    ctx.fillStyle = bgd;
    ctx.fill();
    // 木目
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.16 * shade;
    ctx.strokeStyle = '#a67c42';
    ctx.lineWidth = 3.5 * scale;
    for (let i = 0; i < 9; i++) {
      const yy = -bladeR + (i / 8) * bladeR * 2;
      ctx.beginPath(); ctx.moveTo(-bladeR, yy); ctx.lineTo(bladeR, yy + (i % 2 ? 5 : -5)); ctx.stroke();
    }
    ctx.restore();
    // ふち
    ctx.strokeStyle = 'rgba(126,90,48,' + 0.55 * shade + ')';
    ctx.lineWidth = 4 * scale;
    ctx.stroke();
    ctx.restore();
  };

  function shadeCss(col, s) {
    return 'rgb(' + (col[0] * s | 0) + ',' + (col[1] * s | 0) + ',' + (col[2] * s | 0) + ')';
  }
  A.shadeCss = shadeCss;

  /* ================================================================
     職人（大人）— 2 関節 IK の腕でピールの柄を握る
  ================================================================ */
  function limb(ctx, sx, sy, tx, ty, l1, l2, flip, w, col, colEnd) {
    let dx = tx - sx, dy = ty - sy;
    let d = Math.hypot(dx, dy);
    const maxd = (l1 + l2) * 0.999;
    if (d > maxd) { const k = maxd / d; dx *= k; dy *= k; d = maxd; tx = sx + dx; ty = sy + dy; }
    if (d < 1) d = 1;
    const a = Math.atan2(dy, dx);
    const cosA = U.clamp((d * d + l1 * l1 - l2 * l2) / (2 * d * l1), -1, 1);
    const ang = a + flip * Math.acos(cosA);
    const ex = sx + Math.cos(ang) * l1, ey = sy + Math.sin(ang) * l1;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = colEnd || col;
    ctx.lineWidth = w * 0.86;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
    return { ex: ex, ey: ey, hx: tx, hy: ty };
  }
  A.limb = limb;

  /* opts: {scale, faceDir(1=右向き), handL:{x,y}, handR:{x,y}, t, mood} */
  A.drawChef = function (ctx, x, y, scale, opts) {
    opts = opts || {};
    const s = scale;
    const dir = opts.faceDir === undefined ? 1 : opts.faceDir;
    const t = opts.t || 0;
    const breathe = Math.sin(t * 1.6) * 2 * s;

    ctx.save();
    ctx.translate(x, y + breathe);

    const shoulderY = -150 * s;
    const shL = { x: -46 * s * dir, y: shoulderY + 6 * s };
    const shR = { x: 46 * s * dir, y: shoulderY };

    // 後ろの腕
    if (opts.handL) {
      limb(ctx, shL.x, shL.y, opts.handL.x - x, opts.handL.y - y - breathe, 92 * s, 96 * s, -dir, 25 * s, '#e3ddd0', '#e3ddd0');
    }

    // 胴（コックコート）
    ctx.fillStyle = '#f6f1e6';
    ctx.beginPath();
    ctx.moveTo(-62 * s, -6 * s);
    ctx.bezierCurveTo(-72 * s, -110 * s, -58 * s, -168 * s, 0, -172 * s);
    ctx.bezierCurveTo(58 * s, -168 * s, 72 * s, -110 * s, 62 * s, -6 * s);
    ctx.closePath();
    ctx.fill();
    // エプロン（ピンク）
    ctx.fillStyle = U.css(C.pink);
    ctx.beginPath();
    ctx.moveTo(-46 * s, -6 * s);
    ctx.lineTo(-40 * s, -118 * s);
    ctx.lineTo(40 * s, -118 * s);
    ctx.lineTo(46 * s, -6 * s);
    ctx.closePath();
    ctx.fill();
    // エプロンの虹ライン
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = A.rainbow[i * 2 % A.rainbow.length];
      ctx.fillRect(-44 * s, (-40 - i * 16) * s, 88 * s, 7 * s);
    }
    // 首もと
    ctx.fillStyle = '#efe7d8';
    U.roundRect(ctx, -26 * s, -186 * s, 52 * s, 26 * s, 10 * s);
    ctx.fill();

    // 頭
    ctx.fillStyle = U.css(C.skin);
    ctx.beginPath();
    ctx.arc(0, -226 * s, 46 * s, 0, TAU);
    ctx.fill();
    // 髪
    ctx.fillStyle = '#4a2f22';
    ctx.beginPath();
    ctx.arc(0, -232 * s, 47 * s, Math.PI * 0.98, TAU * 0.02);
    ctx.fill();
    // コック帽
    ctx.fillStyle = '#fbf7ef';
    U.roundRect(ctx, -40 * s, -292 * s, 80 * s, 34 * s, 12 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-24 * s, -300 * s, 24 * s, 0, TAU);
    ctx.arc(2 * s, -312 * s, 28 * s, 0, TAU);
    ctx.arc(28 * s, -300 * s, 23 * s, 0, TAU);
    ctx.fill();
    // 帽子のピンクリボン
    ctx.fillStyle = U.css(C.pinkDeep);
    U.roundRect(ctx, -41 * s, -268 * s, 82 * s, 12 * s, 5 * s);
    ctx.fill();

    // 顔
    const ex = 15 * s * dir;
    ctx.fillStyle = '#3b2418';
    ctx.beginPath(); ctx.arc(-ex * 0.45 + ex * 0.6, -232 * s, 4.6 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ex * 1.05, -232 * s, 4.6 * s, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3b2418';
    ctx.lineWidth = 3.4 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ex * 0.55, -216 * s, 12 * s, 0.22 * Math.PI, 0.78 * Math.PI);
    ctx.stroke();
    // ほっぺ
    ctx.fillStyle = 'rgba(240,150,150,0.5)';
    ctx.beginPath(); ctx.arc(ex * 0.55 - 22 * s, -222 * s, 9 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(ex * 0.55 + 22 * s, -222 * s, 9 * s, 0, TAU); ctx.fill();

    // 前の腕
    if (opts.handR) {
      const r = limb(ctx, shR.x, shR.y, opts.handR.x - x, opts.handR.y - y - breathe, 96 * s, 100 * s, dir, 27 * s, '#fbf7ef', '#fbf7ef');
      // 手
      ctx.fillStyle = U.css(C.skin);
      ctx.beginPath(); ctx.arc(r.hx, r.hy, 18 * s, 0, TAU); ctx.fill();
    }
    if (opts.handL) {
      ctx.fillStyle = U.css(C.skinShade);
      ctx.beginPath(); ctx.arc(opts.handL.x - x, opts.handL.y - y - breathe, 16 * s, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* 子どもの手（生地をさわる手） — やわらかいミトン型 */
  A.drawKidHand = function (ctx, x, y, ang, scale, alpha, floury) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    U.ellipse(ctx, 4, 10, 46, 34); ctx.fill();
    // 手のひら
    const g = ctx.createLinearGradient(0, -40, 0, 40);
    g.addColorStop(0, U.css(C.skin));
    g.addColorStop(1, U.css(C.skinShade));
    ctx.fillStyle = g;
    U.roundRect(ctx, -42, -34, 84, 66, 30);
    ctx.fill();
    // 指
    for (let i = 0; i < 4; i++) {
      const fx = -30 + i * 20;
      ctx.fillStyle = i % 2 ? U.css(C.skin) : U.css(C.skinShade, 0.95);
      U.roundRect(ctx, fx - 9, -54, 18, 30, 9);
      ctx.fill();
    }
    // 親指
    ctx.fillStyle = U.css(C.skin);
    U.roundRect(ctx, 30, -18, 26, 18, 9);
    ctx.fill();
    if (floury) {
      ctx.globalAlpha = 0.5 * (alpha === undefined ? 1 : alpha);
      for (let i = 0; i < 8; i++) {
        const s = domeSpecks[i];
        A.softBlob(ctx, -34 + s[0] * 68, -30 + s[1] * 56, 6 + s[2] * 8, [255, 255, 255], 0.6);
      }
    }
    ctx.restore();
  };

  /* ================================================================
     ガイド表現（文字なし）
  ================================================================ */
  A.drawGhostHand = function (ctx, x, y, ang, scale, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    ctx.scale(scale || 1, scale || 1);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.bezierCurveTo(9, -46, 12, -38, 12, -28);
    ctx.lineTo(12, -6);
    ctx.bezierCurveTo(22, -10, 32, -6, 32, 6);
    ctx.bezierCurveTo(32, 30, 24, 50, 6, 54);
    ctx.bezierCurveTo(-14, 58, -26, 44, -28, 22);
    ctx.bezierCurveTo(-30, 6, -22, 0, -12, 2);
    ctx.lineTo(-12, -28);
    ctx.bezierCurveTo(-12, -38, -9, -46, 0, -46);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(250,190,205,0.65)';
    ctx.beginPath(); ctx.arc(0, -38, 8, 0, TAU); ctx.fill();
    ctx.restore();
  };

  A.drawTapRing = function (ctx, x, y, t, alpha, size) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 2; i++) {
      const k = (t + i * 0.5) % 1;
      ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) * 0.8 + ')';
      ctx.lineWidth = 6 * (1 - k * 0.5);
      ctx.beginPath();
      ctx.arc(x, y, (size || 40) * (0.4 + k * 1.1), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  };

  A.drawArrow = function (ctx, x1, y1, x2, y2, alpha, width, col) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col || 'rgba(255,255,255,0.9)';
    ctx.lineWidth = width || 12;
    ctx.lineCap = 'round';
    ctx.setLineDash([width * 1.6 || 20, width * 1.3 || 16]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - ux * (width || 12) * 1.6, y2 - uy * (width || 12) * 1.6);
    ctx.stroke();
    ctx.setLineDash([]);
    const hw = (width || 12) * 1.9;
    ctx.fillStyle = col || 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * hw * 1.5 - uy * hw, y2 - uy * hw * 1.5 + ux * hw);
    ctx.lineTo(x2 - ux * hw * 1.5 + uy * hw, y2 - uy * hw * 1.5 - ux * hw);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  /* 円を描くジェスチャの提示 */
  A.drawCircleHint = function (ctx, cx, cy, r, squash, t, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 9;
    ctx.setLineDash([26, 22]);
    ctx.lineDashOffset = -t * 90;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * squash, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    const a = t * 2.2;
    const hx = cx + Math.cos(a) * r, hy = cy + Math.sin(a) * r * squash;
    A.drawGhostHand(ctx, hx, hy, Math.sin(a) * 0.3, 1, alpha);
    ctx.restore();
  };

  /* うずまきジェスチャ */
  A.drawSpiralHint = function (ctx, cx, cy, r, squash, t, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const turns = 2.6;
    const prog = (t % 1);
    for (let i = 0; i <= 90; i++) {
      const u = (i / 90) * prog;
      const a = u * turns * TAU;
      const rr = u * r;
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * squash;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    const a2 = prog * turns * TAU, rr2 = prog * r;
    A.drawGhostHand(ctx, cx + Math.cos(a2) * rr2, cy + Math.sin(a2) * rr2 * squash, 0, 1, alpha);
    ctx.restore();
  };

  /* 目標サイズを示す光る輪 */
  A.drawTargetRing = function (ctx, cx, cy, r, squash, t, alpha, hit) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const pulse = 1 + Math.sin(t * 3) * 0.02;
    ctx.strokeStyle = hit ? 'rgba(255,236,150,0.95)' : 'rgba(255,255,255,0.62)';
    ctx.lineWidth = hit ? 10 : 7;
    ctx.setLineDash([22, 20]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * pulse, r * squash * pulse, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  };

  /* 光るハイライト枠（対象を示す） */
  A.drawHalo = function (ctx, x, y, r, t, alpha, col) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const p = 0.6 + 0.4 * Math.sin(t * 3.4);
    A.glow(ctx, x, y, r * (1 + p * 0.15), (col || 'rgba(255,230,160,') + (0.34 * alpha * p) + ')', (col || 'rgba(255,230,160,') + '0)');
    ctx.restore();
  };

  /* ================================================================
     皿・カッター
  ================================================================ */
  A.drawPlate = function (ctx, cx, cy, rx, squash) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    U.ellipse(ctx, cx, cy + rx * squash * 0.1, rx * 1.03, rx * squash * 1.02); ctx.fill();
    const g = ctx.createLinearGradient(0, cy - rx * squash, 0, cy + rx * squash);
    g.addColorStop(0, '#fffaf6');
    g.addColorStop(1, '#f7dfe9');
    ctx.fillStyle = g;
    U.ellipse(ctx, cx, cy, rx, rx * squash); ctx.fill();
    ctx.strokeStyle = 'rgba(244,138,176,0.85)';
    ctx.lineWidth = rx * 0.05;
    U.ellipse(ctx, cx, cy, rx * 0.92, rx * squash * 0.92); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    U.ellipse(ctx, cx - rx * 0.35, cy - rx * squash * 0.4, rx * 0.28, rx * squash * 0.22); ctx.fill();
    ctx.restore();
  };

  A.drawCutter = function (ctx, x, y, ang, scale, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    // 刃
    const g = ctx.createLinearGradient(0, -38, 0, 38);
    g.addColorStop(0, '#f4f7fa');
    g.addColorStop(0.5, '#c9d4de');
    g.addColorStop(1, '#93a2b0');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7d8b98'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 38, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#aab7c3';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    // フォーク金具
    ctx.strokeStyle = '#b9c5d0'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -54); ctx.stroke();
    // 柄（ピンク）
    ctx.fillStyle = U.css(C.pinkDeep);
    U.roundRect(ctx, -15, -122, 30, 74, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    U.roundRect(ctx, -12, -118, 11, 62, 6); ctx.fill();
    ctx.restore();
  };

  /* ================================================================
     具材アイコン（トレイ用・小さいピザ用と共用）
  ================================================================ */
  A.drawTopping = function (ctx, type, x, y, r, rot, melt, bake) {
    melt = melt || 0; bake = bake || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    switch (type) {
      case 'cheese': {
        const sp = 1 + melt * 0.85;
        const col = U.mixColor(C.cheese, C.cheeseMelt, melt);
        const col2 = U.mixColor(col, C.cheeseGold, U.sat(bake * 1.1) * melt);
        ctx.globalAlpha = 0.92;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * sp);
        g.addColorStop(0, U.css(col2, 0.98));
        g.addColorStop(0.62, U.css(col2, 0.9));
        g.addColorStop(1, U.css(col2, melt > 0.2 ? 0.0 : 0.55));
        ctx.fillStyle = g;
        if (melt < 0.25) {
          U.roundRect(ctx, -r * 1.15, -r * 0.42, r * 2.3, r * 0.84, r * 0.4);
          ctx.fill();
        } else {
          ctx.beginPath();
          const n = 9;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            const rr = r * sp * (0.82 + 0.26 * U.noise1(i * 3.1 + x * 0.05));
            const px = Math.cos(a) * rr * 1.1, py = Math.sin(a) * rr * 0.9;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        }
        // 溶けたときのつや
        if (melt > 0.3) {
          ctx.globalAlpha = 0.35 * melt;
          ctx.fillStyle = '#fffdf2';
          U.ellipse(ctx, -r * 0.25, -r * 0.3, r * 0.4, r * 0.25); ctx.fill();
        }
        break;
      }
      case 'basil': {
        ctx.fillStyle = U.css(U.mixColor(C.basil, [56, 92, 44], bake * 0.7));
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.bezierCurveTo(r * 0.9, -r * 0.55, r * 0.85, r * 0.6, 0, r);
        ctx.bezierCurveTo(-r * 0.85, r * 0.6, -r * 0.9, -r * 0.55, 0, -r);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(230,255,220,0.55)'; ctx.lineWidth = r * 0.1;
        ctx.beginPath(); ctx.moveTo(0, -r * 0.85); ctx.lineTo(0, r * 0.85); ctx.stroke();
        break;
      }
      case 'corn': {
        const col = U.mixColor(C.corn, [206, 150, 40], bake * 0.6);
        ctx.fillStyle = U.css(col);
        U.roundRect(ctx, -r * 0.62, -r * 0.5, r * 1.24, r, r * 0.48);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        U.ellipse(ctx, -r * 0.15, -r * 0.16, r * 0.28, r * 0.2); ctx.fill();
        break;
      }
      case 'tomato': {
        const col = U.mixColor(C.tomato, [162, 44, 32], bake * 0.6);
        ctx.fillStyle = U.css(col);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,190,175,0.75)';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.fill();
        ctx.fillStyle = U.css(col, 0.85);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + 0.3;
          U.ellipse(ctx, Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34, r * 0.17, r * 0.26, a);
          ctx.fill();
        }
        break;
      }
      case 'pepperR': case 'pepperY': case 'pepperG': {
        const base = type === 'pepperR' ? C.pepperR : type === 'pepperY' ? C.pepperY : C.pepperG;
        const col = U.mixColor(base, [120, 70, 40], bake * 0.45);
        ctx.fillStyle = U.css(col);
        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI * 0.15, Math.PI * 1.85);
        ctx.arc(0, 0, r * 0.56, Math.PI * 1.85, Math.PI * 0.15, true);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.9, Math.PI * 1.15, Math.PI * 1.5);
        ctx.arc(0, 0, r * 0.66, Math.PI * 1.5, Math.PI * 1.15, true);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'olive': {
        ctx.fillStyle = U.css(C.olive);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(190,180,150,0.9)';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.22, 0, TAU); ctx.fill();
        break;
      }
      case 'broccoli': {
        const col = U.mixColor(C.broccoli, [70, 110, 60], bake * 0.5);
        ctx.fillStyle = '#8bbf7a';
        U.roundRect(ctx, -r * 0.2, -r * 0.1, r * 0.4, r * 0.95, r * 0.18); ctx.fill();
        ctx.fillStyle = U.css(col);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.34 - r * 0.2, r * 0.44, 0, TAU);
          ctx.fill();
        }
        ctx.beginPath(); ctx.arc(0, -r * 0.28, r * 0.5, 0, TAU); ctx.fill();
        break;
      }
      case 'mushroom': {
        ctx.fillStyle = '#efe0c8';
        U.roundRect(ctx, -r * 0.22, -r * 0.05, r * 0.44, r * 0.85, r * 0.16); ctx.fill();
        ctx.fillStyle = U.css(U.mixColor([214, 176, 130], [150, 108, 66], bake * 0.6));
        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI, TAU);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'sauce': {
        ctx.fillStyle = U.css(C.sauce);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
        break;
      }
    }
    ctx.restore();
  };

  A.toppingRadius = {
    cheese: 20, basil: 26, corn: 13, tomato: 26, pepperR: 24, pepperY: 24,
    pepperG: 24, olive: 15, broccoli: 26, mushroom: 24
  };

  /* トレイの受け皿 */
  A.drawBowl = function (ctx, x, y, r, col, glow, t) {
    ctx.save();
    if (glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      A.glow(ctx, x, y, r * 1.9, 'rgba(255,240,180,' + 0.4 * glow * (0.6 + 0.4 * Math.sin(t * 4)) + ')', 'rgba(255,240,180,0)');
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    U.ellipse(ctx, x, y + r * 0.34, r * 1.02, r * 0.42); ctx.fill();
    const g = ctx.createLinearGradient(0, y - r, 0, y + r * 0.5);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    U.ellipse(ctx, x, y, r, r * 0.62); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    U.ellipse(ctx, x, y + r * 0.03, r * 0.86, r * 0.5); ctx.fill();
    ctx.restore();
  };

})();
