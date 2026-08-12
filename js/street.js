'use strict';
/* ============================================================
 * street.js — おかし通り。
 * メニューではなく「作った分だけ賑やかになる」小さな世界。
 * ============================================================ */

/* 保存した作品を1枚のキャンバスに描く(ショーケース・手渡し用) */
function renderWorkCanvas(work, px) {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.ceil(px * dpr); c.height = Math.ceil(px * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const shop = shopById(work.shop);
  const s = px * 0.9;
  const cx = px / 2, cy = px / 2;
  shop.drawBase(ctx, cx, cy, s);
  if (work.pts && work.pts.length) {
    const raw = work.pts.map(p => ({ x: cx + p.x * s, y: cy + p.y * s }));
    const path = raw.length > 2 ? buildPath(raw, Math.max(2, s * 0.012)) : null;
    if (path && path.pts.length > 2) {
      const tool = shop.tools[work.tool] || shop.tools[0];
      drawPiped(ctx, path, {
        W: s * shop.W, style: tool.style, col: tool.col,
        grow: 1, seed: work.seed, drips: work.shop === 'donut',
      });
    }
  }
  if (work.top) drawWorkTopping(ctx, work, cx, cy, s, 1);
  return c;
}

function drawWorkTopping(ctx, work, cx, cy, s, pop) {
  const shop = shopById(work.shop);
  const x = cx + work.top.x * s, y = cy + work.top.y * s;
  const kind = work.top.kind;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  ctx.translate(-x, -y);
  if (kind === 'strawberry') drawStrawberry(ctx, x, y, s * 0.20, work.seed);
  else if (kind === 'cherry') drawCherry(ctx, x, y, s * 0.17);
  else if (kind === 'heart') drawSugarHeart(ctx, x, y, s * 0.15, -0.15);
  else if (kind === 'star') drawSugarStar(ctx, x, y, s * 0.16, 0.12);
  else if (kind === 'sprinkles') {
    const list = sprinkleLayout(x, y, s * 0.17, work.seed, s);
    for (const sp of list) drawSprinkle(ctx, sp.x, sp.y, sp.a, sp.len, sp.w, sp.color);
  }
  ctx.restore();
}

/* タップ点から少しだけ広がるスプリンクル配置(決定的) */
function sprinkleLayout(cx, cy, R, seed, s) {
  const rng = mulberry32(seed || 1);
  const out = [];
  const n = 9 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const a = rng() * U.TAU;
    const r = R * (0.15 + Math.pow(rng(), 0.7) * 1.0);
    out.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r * 0.8,
      a: rng() * Math.PI,
      len: s * (0.030 + rng() * 0.016),
      w: s * 0.013,
      color: SPRINKLE_COLORS[Math.floor(rng() * SPRINKLE_COLORS.length)],
    });
  }
  return out;
}

/* ============================================================ */
const StreetScene = {
  t: 0,
  bg: null, bgKey: '',
  lay: null,
  walkers: [],
  kids: [],
  sitters: [],
  partyKids: [],
  requester: null,
  request: null,          // { shopId }
  celebration: 0,         // 完成直後のお祝いタイマー
  celebShop: null,
  thumbCache: new Map(),
  sparkles: [],
  ripple: null,
  lastShopId: null,

  layout(w, h) {
    const portrait = h > w * 1.05;
    const lay = { portrait, w, h, shops: [] };
    if (!portrait) {
      const sw = Math.min(w * 0.25, h * 0.46);
      const gy = h * 0.68;
      lay.horizon = h * 0.44;
      lay.shops = [
        { id: 'cake', x: w * 0.185, y: gy, w: sw },
        { id: 'cupcake', x: w * 0.5, y: gy, w: sw },
        { id: 'donut', x: w * 0.815, y: gy, w: sw },
      ];
      lay.walkBand = [gy + h * 0.04, h * 0.94];
      lay.bench = { x: w * 0.92, y: gy + h * 0.10, s: sw * 0.5 };
      lay.lamps = [{ x: w * 0.345, y: gy, s: sw * 0.62 }, { x: w * 0.655, y: gy, s: sw * 0.62 }];
      lay.party = { x: w * 0.085, y: gy + h * 0.16, s: sw * 0.55 };
    } else {
      const sw = Math.min(w * 0.46, h * 0.235);
      lay.horizon = h * 0.15;
      lay.shops = [
        { id: 'cake', x: w * 0.285, y: h * 0.335, w: sw },
        { id: 'cupcake', x: w * 0.72, y: h * 0.545, w: sw },
        { id: 'donut', x: w * 0.285, y: h * 0.755, w: sw },
      ];
      lay.walkBand = [h * 0.82, h * 0.955];
      lay.bench = { x: w * 0.15, y: h * 0.885, s: sw * 0.5 };
      lay.lamps = [{ x: w * 0.885, y: h * 0.73, s: sw * 0.45 }];
      lay.party = { x: w * 0.76, y: h * 0.795, s: sw * 0.55 };
    }
    return lay;
  },

  enter(opts) {
    this.t = 0;
    this.bgKey = '';
    const n = Game.count();
    // 住民をそろえる
    this.buildPopulation(n);
    if (opts && opts.celebrate) {
      this.celebration = 2.6;
      this.celebShop = opts.celebrate;
      SFX.cheer();
      this.request = null;
      this.requester = null;
      this.newRequestDelay = 2.2;
    } else if (!this.request) {
      this.newRequestDelay = 0.6;
    }
  },

  buildPopulation(n) {
    const c = 2 + Math.min(3, n);
    if (this.walkers.length !== c) {
      this.walkers = [];
      for (let i = 0; i < c; i++) {
        this.walkers.push({
          res: makeResident(i), x: Math.random(), dir: Math.random() < 0.5 ? 1 : -1,
          speed: U.rand(0.015, 0.035), pause: U.rand(0, 2), band: Math.random(),
        });
      }
    }
  },

  /* ---------- 背景プリレンダ ---------- */
  ensureBg(w, h) {
    const n = Game.count();
    const key = `${w}x${h}|${Game.works.length}|${n}`;
    if (this.bgKey === key && this.bg) return;
    this.bgKey = key;
    this.lay = this.layout(w, h);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    this.paintBg(ctx, w, h, this.lay, n);
    this.bg = c;
  },

  paintBg(ctx, w, h, lay, n) {
    const evening = n >= 8;
    // ---- 空 ----
    const sky = ctx.createLinearGradient(0, 0, 0, lay.horizon * 1.4);
    if (evening) {
      sky.addColorStop(0, '#8E7CC3');
      sky.addColorStop(0.5, '#C98BB9');
      sky.addColorStop(1, '#F7B98B');
    } else {
      sky.addColorStop(0, '#AEDCF5');
      sky.addColorStop(0.65, '#D7EDF8');
      sky.addColorStop(1, '#FDEFF3');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, Math.max(lay.horizon * 1.4, h * 0.3));

    // 太陽 or 月
    ctx.save();
    if (evening) {
      ctx.fillStyle = '#FFF3D0';
      ctx.beginPath();
      ctx.arc(w * 0.85, lay.horizon * 0.35, Math.min(w, h) * 0.035, 0, U.TAU);
      ctx.fill();
      // 星
      const rng = mulberry32(9);
      for (let i = 0; i < 14; i++) {
        drawSparkle(ctx, rng() * w, rng() * lay.horizon * 0.8, 2.5 + rng() * 2.5, rng() * 3, 0.5 + rng() * 0.4, '#FFF7D6');
      }
    } else {
      const sg = ctx.createRadialGradient(w * 0.86, lay.horizon * 0.3, 2, w * 0.86, lay.horizon * 0.3, Math.min(w, h) * 0.09);
      sg.addColorStop(0, 'rgba(255,246,214,0.95)');
      sg.addColorStop(1, 'rgba(255,246,214,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(w * 0.86, lay.horizon * 0.3, Math.min(w, h) * 0.09, 0, U.TAU);
      ctx.fill();
    }
    // 雲(わたあめ)
    const rng2 = mulberry32(4);
    ctx.fillStyle = evening ? 'rgba(255,225,235,0.55)' : 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) {
      const cx = (0.1 + i * 0.26 + rng2() * 0.08) * w;
      const cy = lay.horizon * (0.2 + rng2() * 0.45);
      const s = Math.min(w, h) * (0.035 + rng2() * 0.02);
      ctx.beginPath();
      ctx.arc(cx, cy, s, 0, U.TAU);
      ctx.arc(cx + s * 1.1, cy + s * 0.25, s * 0.8, 0, U.TAU);
      ctx.arc(cx - s * 1.1, cy + s * 0.3, s * 0.75, 0, U.TAU);
      ctx.arc(cx + s * 0.3, cy - s * 0.4, s * 0.7, 0, U.TAU);
      ctx.fill();
    }

    // ---- 遠くのお菓子の丘 ----
    const hillY = lay.horizon;
    const hills = [
      { c: evening ? '#B48CC9' : '#E8D7F2', r: 0.5, x: 0.15 },
      { c: evening ? '#D19AB6' : '#F6DCE8', r: 0.62, x: 0.55 },
      { c: evening ? '#C5A3D9' : '#DCE9F7', r: 0.45, x: 0.9 },
    ];
    for (const hh of hills) {
      ctx.fillStyle = hh.c;
      ctx.beginPath();
      ctx.ellipse(hh.x * w, hillY * 1.06, w * hh.r * 0.4, lay.horizon * 0.4, 0, Math.PI, 0);
      ctx.fill();
    }

    // ---- 地面 ----
    const gnd = ctx.createLinearGradient(0, lay.horizon * 0.9, 0, h);
    if (evening) {
      gnd.addColorStop(0, '#E8C39A');
      gnd.addColorStop(1, '#D9A87E');
    } else {
      gnd.addColorStop(0, '#FBEFDC');
      gnd.addColorStop(1, '#F3DFC2');
    }
    ctx.fillStyle = gnd;
    ctx.fillRect(0, lay.horizon * 0.96, w, h - lay.horizon * 0.96);

    // 石畳(ビスケット畳)
    const rng3 = mulberry32(8);
    const pebbleColors = evening
      ? ['rgba(200,150,110,0.5)', 'rgba(220,170,130,0.5)', 'rgba(190,140,120,0.4)']
      : ['rgba(240,200,160,0.55)', 'rgba(250,220,180,0.6)', 'rgba(235,190,175,0.45)'];
    const py0 = lay.portrait ? lay.horizon * 1.1 : lay.horizon * 1.35;
    for (let i = 0; i < 90; i++) {
      const yy = py0 + Math.pow(rng3(), 0.8) * (h - py0);
      const depth = (yy - py0) / (h - py0);
      const xx = rng3() * w;
      const s = (4 + depth * 9) * (0.8 + rng3() * 0.5) * (Math.min(w, h) / 500);
      ctx.fillStyle = pebbleColors[Math.floor(rng3() * 3)];
      ctx.beginPath();
      ctx.ellipse(xx, yy, s * 1.35, s * 0.8, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(xx - s * 0.3, yy - s * 0.25, s * 0.45, s * 0.22, 0, 0, U.TAU);
      ctx.fill();
    }

    // ---- ガーランド(5個以上) ----
    if (n >= 5 && lay.shops.length >= 2) {
      const a = lay.shops[0], b = lay.shops[lay.portrait ? 1 : 2];
      const x0 = a.x, y0 = a.y - a.w * 0.95, x1 = b.x, y1 = b.y - b.w * 0.95;
      ctx.strokeStyle = 'rgba(180,140,160,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 40, x1, y1);
      ctx.stroke();
      const cols = ['#F48FB1', '#FFD166', '#7FD8BE', '#9AB7FF', '#F7A8FF'];
      for (let i = 0; i <= 10; i++) {
        const tt = i / 10;
        const fx = U.lerp(x0, x1, tt);
        const fy = U.lerp(y0, y1, tt) + Math.sin(Math.PI * tt) * 40 * (lay.portrait ? 0.5 : 1);
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath();
        ctx.moveTo(fx - 7, fy);
        ctx.lineTo(fx + 7, fy);
        ctx.lineTo(fx, fy + 13);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ---- 店 ----
    for (const sh of lay.shops) {
      this.paintShop(ctx, sh, evening);
    }

    // ---- ベンチ(3個以上) ----
    if (n >= 3) this.paintBench(ctx, lay.bench, evening);

    // ---- 街灯 ----
    for (const lp of lay.lamps) this.paintLamp(ctx, lp, evening);

    // ---- パーティーテーブル(5個以上) ----
    if (n >= 5) this.paintParty(ctx, lay.party, evening);

    // 夕方の全体トーン
    if (evening) {
      ctx.fillStyle = 'rgba(120,70,140,0.10)';
      ctx.fillRect(0, 0, w, h);
    }
  },

  paintShop(ctx, sh, evening) {
    const shop = shopById(sh.id);
    const w = sh.w, x = sh.x, y = sh.y;
    const bodyH = w * 0.72, bodyW = w;
    const bx = x - bodyW / 2, by = y - bodyH;

    // 落ち影
    softShadow(ctx, x, y + w * 0.015, w * 0.72, w * 0.16, 0.25);

    // 本体
    const bodyG = ctx.createLinearGradient(0, by, 0, y);
    bodyG.addColorStop(0, shadeHex(shop.hue, 14));
    bodyG.addColorStop(1, shadeHex(shop.hue, -22));
    ctx.fillStyle = bodyG;
    rr(ctx, bx, by, bodyW, bodyH, w * 0.05);
    ctx.fill();
    // 側面の丸み
    const sideG = ctx.createLinearGradient(bx, 0, bx + bodyW, 0);
    sideG.addColorStop(0, 'rgba(255,255,255,0.35)');
    sideG.addColorStop(0.12, 'rgba(255,255,255,0)');
    sideG.addColorStop(0.85, 'rgba(120,60,90,0)');
    sideG.addColorStop(1, 'rgba(120,60,90,0.18)');
    ctx.fillStyle = sideG;
    rr(ctx, bx, by, bodyW, bodyH, w * 0.05);
    ctx.fill();

    // 屋根
    ctx.fillStyle = shop.roof;
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.05, by + w * 0.01);
    ctx.quadraticCurveTo(x, by - w * 0.30, bx + bodyW + w * 0.05, by + w * 0.01);
    ctx.lineTo(bx + bodyW + w * 0.05, by + w * 0.075);
    ctx.lineTo(bx - w * 0.05, by + w * 0.075);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.02, by);
    ctx.quadraticCurveTo(x, by - w * 0.27, bx + bodyW + w * 0.02, by);
    ctx.quadraticCurveTo(x, by - w * 0.18, bx - w * 0.02, by);
    ctx.closePath();
    ctx.fill();

    // 看板(丸にお菓子)
    const signY = by - w * 0.30;
    ctx.fillStyle = '#FFFDF6';
    ctx.strokeStyle = shop.roof;
    ctx.lineWidth = w * 0.022;
    ctx.beginPath();
    ctx.arc(x, signY, w * 0.15, 0, U.TAU);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(x, signY + w * 0.01);
    drawMiniSweet(ctx, sh.id, w * 0.20);
    ctx.restore();

    // オーニング(ひさし)
    const awnY = by + w * 0.10, awnH = w * 0.14;
    const scal = 6;
    for (let i = 0; i < scal; i++) {
      ctx.fillStyle = i % 2 === 0 ? shop.awn2 : shop.awn1;
      const x0 = bx + (bodyW / scal) * i;
      const x1 = bx + (bodyW / scal) * (i + 1);
      ctx.beginPath();
      ctx.moveTo(x0, awnY);
      ctx.lineTo(x1, awnY);
      ctx.lineTo(x1, awnY + awnH * 0.72);
      ctx.arc((x0 + x1) / 2, awnY + awnH * 0.72, (x1 - x0) / 2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(120,60,90,0.12)';
    ctx.fillRect(bx, awnY + awnH * 0.7, bodyW, awnH * 0.1);

    // ショーケース窓
    const winW = bodyW * 0.62, winH = bodyH * 0.46;
    const wx = bx + bodyW * 0.07, wy = awnY + awnH + bodyH * 0.05;
    ctx.fillStyle = '#FFFDF6';
    rr(ctx, wx - w * 0.02, wy - w * 0.02, winW + w * 0.04, winH + w * 0.04, w * 0.035);
    ctx.fill();
    const glass = ctx.createLinearGradient(wx, wy, wx, wy + winH);
    if (evening) { glass.addColorStop(0, '#FFE9BC'); glass.addColorStop(1, '#F7CE8F'); }
    else { glass.addColorStop(0, '#F3FAFF'); glass.addColorStop(1, '#DCEBF5'); }
    ctx.fillStyle = glass;
    rr(ctx, wx, wy, winW, winH, w * 0.025);
    ctx.fill();

    // 棚板と作品
    const works = Game.works.filter(k => k.shop === sh.id).slice(-3);
    const shelfY = wy + winH * 0.78;
    ctx.fillStyle = 'rgba(200,160,130,0.6)';
    rr(ctx, wx + winW * 0.04, shelfY, winW * 0.92, winH * 0.06, winH * 0.03);
    ctx.fill();
    const thumbS = Math.min(winW / 3.2, winH * 0.72);
    works.forEach((wk, i) => {
      const tc = this.thumb(wk, Math.ceil(thumbS));
      const tx = wx + winW * (0.18 + i * 0.32) - thumbS / 2;
      ctx.drawImage(tc, tx, shelfY - thumbS * 0.96, thumbS, thumbS);
    });
    // ガラスの斜め光
    ctx.save();
    rr(ctx, wx, wy, winW, winH, w * 0.025);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.beginPath();
    ctx.moveTo(wx + winW * 0.1, wy);
    ctx.lineTo(wx + winW * 0.34, wy);
    ctx.lineTo(wx + winW * 0.06, wy + winH);
    ctx.lineTo(wx - winW * 0.14, wy + winH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ドア
    const dw = bodyW * 0.20, dh = bodyH * 0.42;
    const dx = bx + bodyW * 0.75, dy = y - dh;
    ctx.fillStyle = shop.roof;
    ctx.beginPath();
    ctx.moveTo(dx, y);
    ctx.lineTo(dx, dy + dw * 0.5);
    ctx.arc(dx + dw / 2, dy + dw * 0.5, dw / 2, Math.PI, 0);
    ctx.lineTo(dx + dw, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(dx + dw * 0.12, y);
    ctx.lineTo(dx + dw * 0.12, dy + dw * 0.55);
    ctx.arc(dx + dw / 2, dy + dw * 0.55, dw * 0.38, Math.PI, 0);
    ctx.lineTo(dx + dw * 0.88, y);
    ctx.lineTo(dx + dw * 0.76, y);
    ctx.arc(dx + dw / 2, dy + dw * 0.55, dw * 0.26, 0, Math.PI, true);
    ctx.lineTo(dx + dw * 0.24, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFE9A8';
    ctx.beginPath();
    ctx.arc(dx + dw * 0.8, dy + dh * 0.55, w * 0.016, 0, U.TAU);
    ctx.fill();

    // 植木鉢
    const px_ = bx - w * 0.075, py_ = y;
    ctx.fillStyle = '#D98E5F';
    ctx.beginPath();
    ctx.moveTo(px_ - w * 0.045, py_ - w * 0.075);
    ctx.lineTo(px_ + w * 0.045, py_ - w * 0.075);
    ctx.lineTo(px_ + w * 0.032, py_);
    ctx.lineTo(px_ - w * 0.032, py_);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6FBF73';
    ctx.beginPath();
    ctx.arc(px_, py_ - w * 0.10, w * 0.035, 0, U.TAU);
    ctx.arc(px_ - w * 0.03, py_ - w * 0.085, w * 0.028, 0, U.TAU);
    ctx.arc(px_ + w * 0.03, py_ - w * 0.085, w * 0.028, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = shop.awn2;
    for (const [ox, oy] of [[-0.02, -0.105], [0.02, -0.095], [0, -0.075]]) {
      ctx.beginPath();
      ctx.arc(px_ + ox * w, py_ + oy * w, w * 0.011, 0, U.TAU);
      ctx.fill();
    }
  },

  paintBench(ctx, b, evening) {
    const s = b.s;
    ctx.save();
    ctx.translate(b.x, b.y);
    softShadow(ctx, 0, s * 0.32, s * 0.75, s * 0.18, 0.22);
    ctx.fillStyle = '#C98B5F';
    rr(ctx, -s * 0.6, 0, s * 1.2, s * 0.09, s * 0.04);
    ctx.fill();
    rr(ctx, -s * 0.6, -s * 0.3, s * 1.2, s * 0.08, s * 0.04);
    ctx.fill();
    ctx.fillStyle = '#B0744A';
    rr(ctx, -s * 0.52, 0.02 * s, s * 0.08, s * 0.30, s * 0.03);
    ctx.fill();
    rr(ctx, s * 0.44, 0.02 * s, s * 0.08, s * 0.30, s * 0.03);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    rr(ctx, -s * 0.6, 0, s * 1.2, s * 0.03, s * 0.015);
    ctx.fill();
    ctx.restore();
  },

  paintLamp(ctx, lp, on) {
    const s = lp.s;
    ctx.save();
    ctx.translate(lp.x, lp.y);
    ctx.strokeStyle = '#8E6E9E';
    ctx.lineWidth = s * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -s * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -s * 0.02, s * 0.10, 0, Math.PI, true);
    ctx.fillStyle = '#8E6E9E';
    ctx.fill();
    if (on) {
      const g = ctx.createRadialGradient(0, -s * 1.02, s * 0.02, 0, -s * 1.02, s * 0.5);
      g.addColorStop(0, 'rgba(255,235,170,0.9)');
      g.addColorStop(1, 'rgba(255,235,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -s * 1.02, s * 0.5, 0, U.TAU);
      ctx.fill();
    }
    ctx.fillStyle = on ? '#FFE9A8' : '#F5EFE5';
    ctx.strokeStyle = '#8E6E9E';
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.arc(0, -s * 1.02, s * 0.13, 0, U.TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 1.13);
    ctx.lineTo(s * 0.1, -s * 1.13);
    ctx.lineTo(0, -s * 1.24);
    ctx.closePath();
    ctx.fillStyle = '#8E6E9E';
    ctx.fill();
    ctx.restore();
  },

  paintParty(ctx, p, evening) {
    const s = p.s;
    ctx.save();
    ctx.translate(p.x, p.y);
    softShadow(ctx, 0, s * 0.22, s * 0.7, s * 0.2, 0.22);
    // テーブル
    ctx.fillStyle = '#F6E7F0';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.17, 0, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#E3C9DB';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.02, s * 0.55, s * 0.17, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#D9B8CE';
    rr(ctx, -s * 0.06, s * 0.1, s * 0.12, s * 0.26, s * 0.03);
    ctx.fill();
    // ミニケーキ
    ctx.translate(0, -s * 0.12);
    drawMiniSweet(ctx, 'cake', s * 0.42);
    ctx.restore();
  },

  thumb(work, px) {
    const key = `${work.id}|${px}`;
    if (!this.thumbCache.has(key)) {
      this.thumbCache.set(key, renderWorkCanvas(work, px));
      if (this.thumbCache.size > 60) {
        const k0 = this.thumbCache.keys().next().value;
        this.thumbCache.delete(k0);
      }
    }
    return this.thumbCache.get(key);
  },

  /* ---------- 更新 ---------- */
  update(dt, w, h) {
    this.t += dt;
    this.ensureBg(w, h);
    const lay = this.lay;

    // 歩く住民
    for (const wk of this.walkers) {
      if (wk.pause > 0) { wk.pause -= dt; continue; }
      wk.x += wk.dir * wk.speed * dt;
      if (wk.x > 1.03) { wk.dir = -1; wk.x = 1.03; }
      if (wk.x < -0.03) { wk.dir = 1; wk.x = -0.03; }
      if (Math.random() < dt * 0.08) wk.pause = U.rand(0.8, 2.2);
    }

    // お祝い
    if (this.celebration > 0) {
      this.celebration -= dt;
      if (Math.random() < dt * 6) {
        const sh = lay.shops.find(s => s.id === this.celebShop) || lay.shops[0];
        this.sparkles.push({
          x: sh.x + U.rand(-sh.w * 0.5, sh.w * 0.5),
          y: sh.y - U.rand(0, sh.w * 0.9),
          r: U.rand(4, 9), life: 0.9, t: 0, rot: U.rand(0, 3),
          col: U.pick(['#FFE9A8', '#FFD1E0', '#D6F0FF']),
        });
      }
    }

    // 新しいおねがい
    if (!this.request && this.celebration <= 0) {
      this.newRequestDelay -= dt;
      if (this.newRequestDelay <= 0) {
        const ids = SHOPS.map(s => s.id).filter(id => id !== this.lastShopId);
        const id = U.pick(ids);
        this.request = { shopId: id };
        this.requester = {
          res: makeResident((Game.works.length * 2 + 3) % 6),
          appear: 0,
        };
        SFX.bell();
      }
    }
    if (this.requester) this.requester.appear = Math.min(1, this.requester.appear + dt * 2);

    // スパークル
    for (const sp of this.sparkles) sp.t += dt;
    this.sparkles = this.sparkles.filter(sp => sp.t < sp.life);
    if (this.ripple) {
      this.ripple.t += dt;
      if (this.ripple.t > 0.5) this.ripple = null;
    }
  },

  /* ---------- 描画 ---------- */
  draw(ctx, w, h) {
    this.ensureBg(w, h);
    const lay = this.lay;
    const n = Game.count();
    ctx.drawImage(this.bg, 0, 0, w, h);
    const chSize = Math.min(w, h);

    // ---- 動く住民たち ----
    const rH = chSize * (lay.portrait ? 0.085 : 0.11);
    for (const wk of this.walkers) {
      const y = U.lerp(lay.walkBand[0], lay.walkBand[1], wk.band);
      drawResident(ctx, wk.res, wk.x * w, y, rH * (0.85 + wk.band * 0.3), {
        t: this.t, mood: wk.pause > 0 ? 'idle' : 'walk', flip: wk.dir < 0,
      });
    }

    // 子どもたち(2個以上・ドーナツ屋の前)
    if (n >= 2) {
      const sh = lay.shops.find(s => s.id === 'donut');
      for (let i = 0; i < 2; i++) {
        drawResident(ctx, makeResident(4 + i), sh.x + (i - 0.5) * sh.w * 0.55, sh.y + sh.w * 0.14, rH * 0.7, {
          t: this.t + i, mood: 'excite',
        });
      }
    }

    // ベンチの住民(3個以上)
    if (n >= 3) {
      const b = lay.bench;
      for (let i = 0; i < 2; i++) {
        drawResident(ctx, makeResident(1 + i * 2), b.x + (i - 0.5) * b.s * 0.6, b.y + b.s * 0.06, rH * 0.8, {
          t: this.t + i * 2, mood: 'eat',
          sweet: i === 0 ? 'cupcake' : 'donut',
        });
      }
    }

    // パーティー(5個以上)
    if (n >= 5) {
      const p = lay.party;
      for (let i = 0; i < 2; i++) {
        drawResident(ctx, makeResident(2 + i * 3), p.x + (i - 0.5) * p.s * 1.5, p.y + p.s * 0.22, rH * 0.72, {
          t: this.t + i * 1.3, mood: 'cheer',
        });
      }
    }

    // ---- おねがい住民 ----
    if (this.request && this.requester) {
      const sh = lay.shops.find(s => s.id === this.request.shopId);
      const ap = Ease.outBack(this.requester.appear);
      // 画面の中央側に立つ(見切れ防止)
      const side = sh.x <= w * 0.5 ? 1 : -1;
      const rx = sh.x + side * sh.w * 0.66;
      const ry = sh.y + sh.w * 0.16;
      // 目印のやわらかい光
      const glow = 0.5 + Math.sin(this.t * 2.6) * 0.22;
      const gg = ctx.createRadialGradient(sh.x, sh.y - sh.w * 0.36, sh.w * 0.1, sh.x, sh.y - sh.w * 0.36, sh.w * 0.85);
      gg.addColorStop(0, `rgba(255,240,190,${0.20 * glow})`);
      gg.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(sh.x, sh.y - sh.w * 0.36, sh.w * 0.85, 0, U.TAU);
      ctx.fill();

      ctx.save();
      ctx.translate(rx, ry);
      ctx.scale(ap, ap);
      ctx.translate(-rx, -ry);
      drawResident(ctx, this.requester.res, rx, ry, rH * 1.02, { t: this.t, mood: 'excite' });
      drawBubble(ctx, rx + rH * 0.3, ry - rH * 1.28, rH * 0.62, this.request.shopId, this.t);
      ctx.restore();
    }

    // お祝いのお客
    if (this.celebration > 0 && this.celebShop) {
      const sh = lay.shops.find(s => s.id === this.celebShop);
      drawResident(ctx, makeResident((Game.works.length * 2 + 1) % 6), sh.x - sh.w * 0.55, sh.y + sh.w * 0.16, rH, {
        t: this.t, mood: 'cheer',
      });
      if (Math.sin(this.t * 4) > 0.4) {
        drawFloatHeart(ctx, sh.x - sh.w * 0.55 + Math.sin(this.t * 2) * 10, sh.y - sh.w * 0.9 - (this.t % 1) * 30, rH * 0.2, 0.9 - (this.t % 1) * 0.5);
      }
    }

    // スパークル
    for (const sp of this.sparkles) {
      drawSparkle(ctx, sp.x, sp.y - sp.t * 30, sp.r * (1 - sp.t / sp.life * 0.5), sp.rot + sp.t * 2, 1 - sp.t / sp.life, sp.col);
    }

    // タップの波紋
    if (this.ripple) {
      const rp = this.ripple, tt = rp.t / 0.5;
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - tt)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 10 + tt * 46, 0, U.TAU);
      ctx.stroke();
    }
  },

  /* ---------- 入力 ---------- */
  pointerDown(x, y, w, h) {
    this.ensureBg(w, h);
    this.ripple = { x, y, t: 0 };
    for (const sh of this.lay.shops) {
      if (x > sh.x - sh.w * 0.62 && x < sh.x + sh.w * 0.62 &&
        y > sh.y - sh.w * 1.12 && y < sh.y + sh.w * 0.2) {
        SFX.tap();
        const isRequested = this.request && this.request.shopId === sh.id;
        const res = isRequested && this.requester ? this.requester.res : makeResident((Math.random() * 6) | 0);
        if (isRequested) { this.request = null; this.requester = null; }
        this.lastShopId = sh.id;
        Main.gotoMaking(sh.id, res, { x: sh.x, y: sh.y - sh.w * 0.4 });
        return;
      }
    }
  },
};
