'use strict';
/* ============================================================
 * sweets.js — お菓子の土台(プロシージャル)と店ごとの設定。
 * 土台は制作画面に最初から置いてある部分。
 * サイズはすべて s(基準寸法)に対する相対値。
 * ============================================================ */

/* やわらかい楕円影 */
function softShadow(ctx, x, y, rx, ry, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(150,95,110,${alpha})`);
  g.addColorStop(1, 'rgba(150,95,110,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, U.TAU);
  ctx.fill();
  ctx.restore();
}

/* 白い皿(金縁) */
function drawPlate(ctx, cx, cy, r) {
  softShadow(ctx, cx, cy + r * 0.16, r * 1.18, r * 0.34, 0.30);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.12, r * 0.1, cx, cy, r * 1.05);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.75, '#FBF3F5');
  g.addColorStop(1, '#EBDCE2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.30, 0, 0, U.TAU);
  ctx.fill();
  ctx.strokeStyle = '#E9C46A';
  ctx.lineWidth = Math.max(1.5, r * 0.02);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.97, r * 0.285, 0, 0, U.TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(210,170,185,0.5)';
  ctx.lineWidth = Math.max(1, r * 0.012);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.72, r * 0.20, 0, 0, U.TAU);
  ctx.stroke();
}

/* スポンジの側面テクスチャ(気泡の点々) */
function spongeSpeckles(ctx, x, y, w, h, seed, alpha) {
  const rng = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < (w * h) / 260; i++) {
    const xx = x + rng() * w, yy = y + rng() * h;
    ctx.fillStyle = rng() < 0.6 ? `rgba(196,146,84,${alpha})` : `rgba(255,244,214,${alpha * 0.9})`;
    ctx.beginPath();
    ctx.arc(xx, yy, 0.8 + rng() * 1.6, 0, U.TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ============ A. いちごショートケーキの土台 ============ */
function drawShortcakeBase(ctx, cx, cy, s) {
  const R = s * 0.40;         // ケーキ半径
  const H = s * 0.30;         // 高さ
  const EY = 0.34;            // 楕円率
  const topY = cy - H * 0.35;
  const botY = topY + H;

  drawPlate(ctx, cx, botY + s * 0.015, R * 1.42);

  // ---- 側面 ----
  const side = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  side.addColorStop(0, '#E8BE7E');
  side.addColorStop(0.28, '#F9E3B4');
  side.addColorStop(0.62, '#F3D79F');
  side.addColorStop(1, '#D9A75F');
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(cx - R, topY);
  ctx.ellipse(cx, botY, R, R * EY, 0, Math.PI, 0, true);
  ctx.lineTo(cx + R, topY);
  ctx.closePath();
  ctx.fill();

  // スポンジ2段の間の生クリーム層
  const midY = topY + H * 0.47;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - R, topY);
  ctx.ellipse(cx, botY, R, R * EY, 0, Math.PI, 0, true);
  ctx.lineTo(cx + R, topY);
  ctx.closePath();
  ctx.clip();
  // クリーム帯(下端をぷにぷにの波に)
  ctx.fillStyle = '#FFF8EC';
  ctx.beginPath();
  ctx.moveTo(cx - R, midY - H * 0.05);
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = cx - R + t * R * 2;
    const y = midY + H * 0.065 + Math.sin(t * Math.PI * 8) * H * 0.028 + Math.sin(t * Math.PI * 2) * H * 0.012;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(cx + R, midY - H * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(214,180,140,0.35)';
  ctx.beginPath();
  ctx.moveTo(cx - R, midY - H * 0.05);
  ctx.lineTo(cx + R, midY - H * 0.05);
  ctx.lineTo(cx + R, midY - H * 0.028);
  ctx.lineTo(cx - R, midY - H * 0.028);
  ctx.closePath();
  ctx.fill();
  // 挟んだイチゴのちら見え
  const rng = mulberry32(21);
  for (let i = 0; i < 5; i++) {
    const x = cx - R * 0.8 + i * R * 0.4 + (rng() - 0.5) * R * 0.08;
    ctx.fillStyle = '#E64C64';
    ctx.beginPath();
    ctx.ellipse(x, midY + H * 0.008, R * 0.055, H * 0.045, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(x - R * 0.014, midY + H * 0.012, R * 0.016, H * 0.014, 0, 0, Math.PI);
    ctx.fill();
  }
  // 側面の気泡
  spongeSpeckles(ctx, cx - R, topY, R * 2, H * 0.44, 5, 0.28);
  spongeSpeckles(ctx, cx - R, midY + H * 0.06, R * 2, H * 0.5, 9, 0.28);
  // 側面の丸み(左明・右暗)
  const rim = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  rim.addColorStop(0, 'rgba(255,250,235,0.5)');
  rim.addColorStop(0.15, 'rgba(255,250,235,0)');
  rim.addColorStop(0.8, 'rgba(150,100,50,0)');
  rim.addColorStop(1, 'rgba(150,100,50,0.30)');
  ctx.fillStyle = rim;
  ctx.fillRect(cx - R, topY - R * EY, R * 2, H + R);
  ctx.restore();

  // ---- 上面(描くところ) ----
  const topG = ctx.createRadialGradient(cx - R * 0.3, topY - R * EY * 0.4, R * 0.1, cx, topY, R * 1.05);
  topG.addColorStop(0, '#FDF2D9');
  topG.addColorStop(0.7, '#F8E6BD');
  topG.addColorStop(1, '#EFD3A0');
  ctx.fillStyle = topG;
  ctx.beginPath();
  ctx.ellipse(cx, topY, R, R * EY, 0, 0, U.TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, topY, R, R * EY, 0, 0, U.TAU);
  ctx.clip();
  spongeSpeckles(ctx, cx - R, topY - R * EY, R * 2, R * EY * 2, 13, 0.20);
  ctx.restore();
  // 上面のふち
  ctx.strokeStyle = 'rgba(190,140,80,0.45)';
  ctx.lineWidth = Math.max(1.5, s * 0.006);
  ctx.beginPath();
  ctx.ellipse(cx, topY, R, R * EY, 0, 0, U.TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,252,240,0.8)';
  ctx.lineWidth = Math.max(1.2, s * 0.005);
  ctx.beginPath();
  ctx.ellipse(cx, topY - s * 0.004, R * 0.985, R * EY * 0.96, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

/* ============ B. カップケーキの土台 ============ */
function drawCupcakeBase(ctx, cx, cy, s) {
  const W = s * 0.42;    // カップ上端の半幅
  const wBot = W * 0.68; // 底の半幅
  const capTop = cy + s * 0.02;
  const capBot = capTop + s * 0.30;

  softShadow(ctx, cx, capBot + s * 0.02, W * 1.5, W * 0.42, 0.30);

  // ---- ドーム(スポンジ) ----
  const domeY = capTop + s * 0.015;
  const dg = ctx.createRadialGradient(cx - W * 0.35, domeY - s * 0.16, s * 0.03, cx, domeY - s * 0.05, W * 1.25);
  dg.addColorStop(0, '#F7D9A0');
  dg.addColorStop(0.55, '#E9B36A');
  dg.addColorStop(1, '#C9884188');
  ctx.fillStyle = '#E9B36A';
  ctx.beginPath();
  ctx.ellipse(cx, domeY, W * 1.02, s * 0.155, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.ellipse(cx, domeY, W * 1.02, s * 0.155, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, domeY, W * 1.02, s * 0.155, 0, Math.PI, 0);
  ctx.clip();
  spongeSpeckles(ctx, cx - W, domeY - s * 0.16, W * 2, s * 0.17, 31, 0.30);
  ctx.restore();
  // 焼き色のつや
  ctx.strokeStyle = 'rgba(255,240,200,0.65)';
  ctx.lineWidth = Math.max(1.5, s * 0.008);
  ctx.beginPath();
  ctx.ellipse(cx, domeY - s * 0.005, W * 0.9, s * 0.13, 0, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();

  // ---- プリーツカップ ----
  const pleats = 9;
  for (let i = 0; i < pleats; i++) {
    const t0 = i / pleats, t1 = (i + 1) / pleats;
    const xt0 = cx - W + t0 * W * 2, xt1 = cx - W + t1 * W * 2;
    const xb0 = cx - wBot + t0 * wBot * 2, xb1 = cx - wBot + t1 * wBot * 2;
    const even = i % 2 === 0;
    const g = ctx.createLinearGradient(xt0, capTop, xb0, capBot);
    if (even) { g.addColorStop(0, '#F79BC0'); g.addColorStop(1, '#E4699B'); }
    else { g.addColorStop(0, '#FFC2DA'); g.addColorStop(1, '#F58AB4'); }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(xt0, capTop + Math.sin(t0 * Math.PI) * -s * 0.008);
    ctx.lineTo(xt1, capTop + Math.sin(t1 * Math.PI) * -s * 0.008);
    ctx.lineTo(xb1, capBot - (xb1 - cx) * (xb1 - cx) / (wBot * wBot) * s * 0.03);
    ctx.lineTo(xb0, capBot - (xb0 - cx) * (xb0 - cx) / (wBot * wBot) * s * 0.03);
    ctx.closePath();
    ctx.fill();
  }
  // カップの丸み陰影
  const cupShade = ctx.createLinearGradient(cx - W, 0, cx + W, 0);
  cupShade.addColorStop(0, 'rgba(140,40,80,0.28)');
  cupShade.addColorStop(0.22, 'rgba(255,255,255,0.10)');
  cupShade.addColorStop(0.5, 'rgba(255,255,255,0.16)');
  cupShade.addColorStop(0.85, 'rgba(140,40,80,0.10)');
  cupShade.addColorStop(1, 'rgba(140,40,80,0.34)');
  ctx.fillStyle = cupShade;
  ctx.beginPath();
  ctx.moveTo(cx - W, capTop);
  ctx.lineTo(cx + W, capTop);
  ctx.lineTo(cx + wBot, capBot);
  ctx.lineTo(cx - wBot, capBot);
  ctx.closePath();
  ctx.fill();
  // 上端のスカラップ
  ctx.fillStyle = '#FFD3E4';
  for (let i = 0; i < pleats; i++) {
    const t = (i + 0.5) / pleats;
    const x = cx - W + t * W * 2;
    ctx.beginPath();
    ctx.ellipse(x, capTop, (W * 2) / pleats * 0.52, s * 0.014, 0, 0, U.TAU);
    ctx.fill();
  }
  // 底の丸ライン
  ctx.strokeStyle = 'rgba(160,50,95,0.5)';
  ctx.lineWidth = Math.max(1.5, s * 0.007);
  ctx.beginPath();
  ctx.ellipse(cx, capBot - s * 0.006, wBot, s * 0.028, 0, 0, Math.PI);
  ctx.stroke();
}

/* ============ C. ドーナツの土台 ============ */
function drawDonutBase(ctx, cx, cy, s) {
  const R = s * 0.40;
  const EY = 0.86;      // 少しだけ上から見た潰れ
  const hole = R * 0.34;
  const rng = mulberry32(77);

  softShadow(ctx, cx, cy + R * EY * 0.9, R * 1.35, R * 0.42, 0.32);

  // 本体シルエット(輪郭にゆらぎ)
  const N = 48;
  const outer = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * U.TAU;
    const wob = 1 + Math.sin(a * 5 + 1.3) * 0.018 + Math.sin(a * 9 + 4.1) * 0.010;
    outer.push({ x: cx + Math.cos(a) * R * wob, y: cy + Math.sin(a) * R * EY * wob });
  }
  ctx.beginPath();
  outer.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  const bg = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.4, R * 0.1, cx, cy, R * 1.12);
  bg.addColorStop(0, '#F8CE8F');
  bg.addColorStop(0.55, '#EDA95A');
  bg.addColorStop(0.85, '#D4823B');
  bg.addColorStop(1, '#BC6C2E');
  ctx.fillStyle = bg;
  ctx.fill();

  // トーラスの盛り上がり(内周へ向かう明るいリング)
  ctx.save();
  ctx.beginPath();
  outer.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
  const ring = ctx.createRadialGradient(cx, cy, hole * 0.9, cx, cy, R * 0.98);
  ring.addColorStop(0, 'rgba(255,228,170,0.0)');
  ring.addColorStop(0.28, 'rgba(255,232,178,0.55)');
  ring.addColorStop(0.62, 'rgba(255,220,160,0.10)');
  ring.addColorStop(1, 'rgba(120,70,25,0.22)');
  ctx.fillStyle = ring;
  ctx.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
  // 白いプルーフライン(揚げ色の淡い帯)
  ctx.strokeStyle = 'rgba(255,238,196,0.5)';
  ctx.lineWidth = R * 0.10;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 0.90, R * 0.90 * EY, 0, Math.PI * 1.02, Math.PI * 1.55);
  ctx.stroke();
  // 揚げ物の微細なざらつき
  for (let i = 0; i < 60; i++) {
    const a = rng() * U.TAU, rr_ = hole + (R - hole) * (0.2 + rng() * 0.75);
    ctx.fillStyle = rng() < 0.5 ? 'rgba(150,90,35,0.16)' : 'rgba(255,235,190,0.18)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rr_, cy + Math.sin(a) * rr_ * EY, 0.8 + rng() * 1.6, 0, U.TAU);
    ctx.fill();
  }
  ctx.restore();

  // 穴
  ctx.beginPath();
  ctx.ellipse(cx, cy, hole, hole * EY, 0, 0, U.TAU);
  const hg = ctx.createRadialGradient(cx, cy + hole * 0.2, hole * 0.1, cx, cy, hole * 1.05);
  hg.addColorStop(0, '#8A5426');
  hg.addColorStop(0.7, '#A96A31');
  hg.addColorStop(1, '#C98B44');
  ctx.fillStyle = hg;
  ctx.fill();
  // 穴の内側の底影と上のリム
  ctx.strokeStyle = 'rgba(90,50,18,0.45)';
  ctx.lineWidth = Math.max(1.5, R * 0.03);
  ctx.beginPath();
  ctx.ellipse(cx, cy + hole * 0.06, hole * 0.9, hole * 0.9 * EY, 0, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,170,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - hole * 0.04, hole * 0.94, hole * 0.94 * EY, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
}

/* ============ ちいさなお菓子アイコン(吹き出し・看板用) ============ */
function drawMiniSweet(ctx, type, s) {
  // (0,0)中心、s = 全体サイズ
  ctx.save();
  if (type === 'cake') {
    ctx.fillStyle = '#F8E3B4';
    rr(ctx, -s * 0.42, -s * 0.12, s * 0.84, s * 0.42, s * 0.08);
    ctx.fill();
    ctx.fillStyle = '#FFF8EC';
    rr(ctx, -s * 0.42, -s * 0.02, s * 0.84, s * 0.10, s * 0.05);
    ctx.fill();
    ctx.fillStyle = '#FFF8EC';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(i * s * 0.24, -s * 0.14, s * 0.11, 0, U.TAU);
      ctx.fill();
    }
    drawStrawberry(ctx, 0, -s * 0.30, s * 0.30, 3);
  } else if (type === 'cupcake') {
    ctx.fillStyle = '#F58AB4';
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, -s * 0.02);
    ctx.lineTo(s * 0.34, -s * 0.02);
    ctx.lineTo(s * 0.24, s * 0.36);
    ctx.lineTo(-s * 0.24, s * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = s * 0.04;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.15, 0);
      ctx.lineTo(i * s * 0.11, s * 0.34);
      ctx.stroke();
    }
    ctx.fillStyle = '#FFF8EC';
    ctx.beginPath();
    ctx.arc(-s * 0.16, -s * 0.08, s * 0.14, 0, U.TAU);
    ctx.arc(s * 0.16, -s * 0.08, s * 0.14, 0, U.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -s * 0.20, s * 0.16, 0, U.TAU);
    ctx.fill();
    drawCherry(ctx, 0, -s * 0.34, s * 0.22);
  } else if (type === 'donut') {
    ctx.fillStyle = '#EDA95A';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.05, s * 0.42, s * 0.36, 0, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#F794B4';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.0, s * 0.42, s * 0.33, 0, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#EDA95A';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.04, s * 0.15, s * 0.12, 0, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#8A5426';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.05, s * 0.13, s * 0.10, 0, 0, U.TAU);
    ctx.fill();
    const rng = mulberry32(5);
    for (let i = 0; i < 6; i++) {
      const a = rng() * U.TAU, rr_ = s * (0.20 + rng() * 0.14);
      drawSprinkle(ctx, Math.cos(a) * rr_, -s * 0.04 + Math.sin(a) * rr_ * 0.6, rng() * Math.PI, s * 0.10, s * 0.035, SPRINKLE_COLORS[i % SPRINKLE_COLORS.length]);
    }
  }
  ctx.restore();
}

/* ============ 店ごとの設定 ============ */
const SHOPS = [
  {
    id: 'cake',
    hue: '#F9C6D8', roof: '#E86F9A', awn1: '#FBDFE9', awn2: '#F291B4',
    tools: [
      { col: CREAM_COLORS.white, style: 'cream' },
      { col: CREAM_COLORS.pink, style: 'cream' },
      { col: CREAM_COLORS.choco, style: 'cream' },
    ],
    topping: 'strawberry',
    W: 0.115,           // クリーム幅(基準寸法比)
    drawBase: drawShortcakeBase,
  },
  {
    id: 'cupcake',
    hue: '#E4D5F5', roof: '#9C7BD4', awn1: '#EFE3FB', awn2: '#B899E4',
    tools: [
      { col: CREAM_COLORS.white, style: 'cream', top: 'cherry' },
      { col: CREAM_COLORS.pink, style: 'cream', top: 'heart' },
      { col: CREAM_COLORS.choco, style: 'cream', top: 'star' },
    ],
    topping: 'byTool',
    W: 0.125,
    drawBase: drawCupcakeBase,
  },
  {
    id: 'donut',
    hue: '#C8E8E4', roof: '#54B3A6', awn1: '#DFF3F0', awn2: '#7CC9BD',
    tools: [
      { col: CREAM_COLORS.icingPink, style: 'sauce' },
      { col: CREAM_COLORS.icingChoco, style: 'sauce' },
      { col: CREAM_COLORS.icingSky, style: 'glaze' },
    ],
    topping: 'sprinkles',
    W: 0.095,
    drawBase: drawDonutBase,
  },
];

function shopById(id) { return SHOPS.find(s => s.id === id); }
