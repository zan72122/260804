'use strict';
/* ============================================================
 * materials.js — Hero Materials
 * 子どもの線(buildPathの結果)を中心線として、
 * ホイップ/ソース/グレーズを多層レンダリングで立体化する。
 * 形(曲がり・長さ・位置)は一切作り替えない。
 * ============================================================ */

const LIGHT = { x: -0.42, y: -0.91 }; // 画面左上からの光

/* ---------- 色セット ---------- */
const CREAM_COLORS = {
  white: {
    base: '#FFF8EC', shade: '#EFD9BD', light: '#FFFEFA', hi: '#FFFFFF',
    groove: 'rgba(176,140,104,1)', edge: 'rgba(150,110,80,1)', name: 'white',
  },
  pink: {
    base: '#FBD9E4', shade: '#EFA9C2', light: '#FFF1F6', hi: '#FFFFFF',
    groove: 'rgba(206,110,150,1)', edge: 'rgba(180,90,130,1)', name: 'pink',
  },
  choco: {
    base: '#A9744C', shade: '#7C4E2C', light: '#CD9C6F', hi: '#F3D9B8',
    groove: 'rgba(92,55,28,1)', edge: 'rgba(70,42,22,1)', name: 'choco',
  },
  // ドーナツ用アイシング
  icingPink: {
    base: '#F794B4', shade: '#E06090', light: '#FFB9CF', hi: '#FFFFFF',
    groove: 'rgba(200,70,120,1)', edge: 'rgba(178,56,104,1)', name: 'icingPink',
  },
  icingChoco: {
    base: '#6F4126', shade: '#4E2A15', light: '#96603B', hi: '#E8C9A0',
    groove: 'rgba(58,32,16,1)', edge: 'rgba(44,24,12,1)', name: 'icingChoco',
  },
  icingSky: {
    base: '#A8DDE8', shade: '#6FB9CE', light: '#D2F1F7', hi: '#FFFFFF',
    groove: 'rgba(90,160,185,1)', edge: 'rgba(70,140,165,1)', name: 'icingSky',
  },
};

function hexToRgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgba(h, a) {
  const [r, g, b] = hexToRgb(h);
  return `rgba(${r},${g},${b},${a})`;
}
function rgbaS(s, a) { // 'rgba(r,g,b,1)' → alpha差し替え
  return s.replace(/,[^,]*\)$/, `,${a})`);
}
function shadeHex(h, amt) { // amt<0で暗く、>0で明るく
  const [r, g, b] = hexToRgb(h);
  const f = v => U.clamp(Math.round(v + amt), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/* ---------- パス補助 ---------- */

/** 可変幅ボディの輪郭パスを作る(両端は丸キャップ) */
function traceBody(ctx, path, wArr, dx, dy) {
  const { pts, nx, ny } = path;
  const n = pts.length;
  dx = dx || 0; dy = dy || 0;
  ctx.beginPath();
  // 左エッジ
  for (let i = 0; i < n; i++) {
    const x = pts[i].x + nx[i] * wArr[i] + dx;
    const y = pts[i].y + ny[i] * wArr[i] + dy;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  // 終端キャップ
  {
    const i = n - 1;
    const A = Math.atan2(ny[i], nx[i]);
    ctx.arc(pts[i].x + dx, pts[i].y + dy, Math.max(wArr[i], 0.1), A, A - Math.PI, true);
  }
  // 右エッジ(逆順)
  for (let i = n - 2; i >= 0; i--) {
    ctx.lineTo(pts[i].x - nx[i] * wArr[i] + dx, pts[i].y - ny[i] * wArr[i] + dy);
  }
  // 始端キャップ
  {
    const A0 = Math.atan2(ny[0], nx[0]);
    ctx.arc(pts[0].x + dx, pts[0].y + dy, Math.max(wArr[0], 0.1), A0 - Math.PI, A0 - Math.PI * 2, true);
  }
  ctx.closePath();
}

/** 法線方向にオフセットしたポリラインを描く(絞り模様用) */
function traceOffsetLine(ctx, path, frac, wArr) {
  const { pts, nx, ny } = path;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i].x + nx[i] * wArr[i] * frac;
    const y = pts[i].y + ny[i] * wArr[i] * frac;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}

/** 中心線そのもの */
function traceCenter(ctx, path, dx, dy) {
  const { pts } = path;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i].x + (dx || 0), pts[i].y + (dy || 0));
    else ctx.lineTo(pts[i].x + (dx || 0), pts[i].y + (dy || 0));
  }
}

/* ============================================================
 * drawPiped — メイン。
 * opt: {
 *   W: 完成時の全幅, style: 'cream'|'sauce'|'glaze',
 *   col: CREAM_COLORSのひとつ, grow: 0..1, seed: int,
 *   scallop: うねり量(省略可), shadowOn: 台の上の落ち影,
 * }
 * ============================================================ */
function drawPiped(ctx, path, opt) {
  const n = path.pts.length;
  if (n < 2) return;
  const col = opt.col;
  const style = opt.style || 'cream';
  const grow = opt.grow === undefined ? 1 : U.clamp(opt.grow, 0, 1);
  const rng = mulberry32(opt.seed || 7);

  // ---- 成長フェーズ ----
  const wf = 0.16 + 0.84 * Ease.outBack(U.clamp(grow / 0.45, 0, 1)); // 太さ
  const shadeA = U.smoothstep(0.30, 0.68, grow);   // 陰影と溝
  const sparkA = U.smoothstep(0.72, 1.0, grow);    // 砂糖粒・グリント
  const tipA = U.smoothstep(0.86, 1.0, grow);      // 絞りの先端

  // ---- 幅プロファイル ----
  const Wfull = opt.W;
  const halfW = Wfull * 0.5 * Math.max(wf, 0.02);
  const total = path.total;
  const taperLen = Math.min(total * 0.28, Wfull * 1.15);
  const scallop = (opt.scallop !== undefined ? opt.scallop :
    (style === 'cream' ? 0.11 : style === 'sauce' ? 0.045 : 0.06));
  const period = Wfull * (style === 'cream' ? 1.15 : 2.1);
  const phase = rng() * U.TAU;
  const wArr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = path.len[i];
    let t = U.smoothstep(0, taperLen, s) * U.smoothstep(total, total - taperLen, s);
    t = 0.30 + 0.70 * t;
    const sc = 1 + scallop * Math.sin((s / period) * U.TAU + phase) * shadeAOr(shadeA, style);
    wArr[i] = Math.max(0.6, halfW * t * sc);
  }
  function shadeAOr(a, st) { return st === 'cream' ? (0.35 + 0.65 * a) : 1; }

  const maxW = halfW;
  const lx = LIGHT.x, ly = LIGHT.y;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ---- 0. 落ち影(台の上) ----
  if (opt.shadowOn !== false) {
    ctx.save();
    ctx.shadowColor = 'rgba(120,70,80,0.30)';
    ctx.shadowBlur = maxW * 0.8;
    ctx.shadowOffsetY = maxW * 0.30;
    traceBody(ctx, path, wArr, maxW * 0.10, maxW * 0.34);
    ctx.fillStyle = 'rgba(150,90,100,0.14)';
    ctx.fill();
    ctx.restore();
  }

  // ---- 1. ボディ ----
  traceBody(ctx, path, wArr, 0, 0);
  if (style === 'glaze') ctx.globalAlpha = 0.90;
  ctx.fillStyle = col.base;
  ctx.fill();
  ctx.globalAlpha = 1;

  // ---- 2. ボディ内部の陰影(クリップして平行移動コピーを重ねる) ----
  ctx.save();
  traceBody(ctx, path, wArr, 0, 0);
  ctx.clip();

  const off = maxW * 0.45;
  // 影側(右下)
  ctx.globalAlpha = 0.62 * shadeA + 0.10;
  ctx.strokeStyle = col.shade;
  ctx.lineWidth = maxW * 2.05;
  traceCenter(ctx, path, -lx * off * 1.15, -ly * off * 1.15);
  ctx.stroke();
  // 基本色に戻す中間層
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col.base;
  ctx.lineWidth = maxW * 1.55;
  traceCenter(ctx, path, lx * off * 0.22, ly * off * 0.22);
  ctx.stroke();
  // 明るい側(左上)
  ctx.globalAlpha = 0.55 * shadeA + 0.10;
  ctx.strokeStyle = col.light;
  ctx.lineWidth = maxW * 0.92;
  traceCenter(ctx, path, lx * off * 0.62, ly * off * 0.62);
  ctx.stroke();
  // しっとりハイライト
  ctx.globalAlpha = (style === 'cream' ? 0.34 : 0.5) * shadeA;
  ctx.strokeStyle = col.hi;
  ctx.lineWidth = Math.max(1.2, maxW * (style === 'cream' ? 0.34 : 0.42));
  traceCenter(ctx, path, lx * off * 0.95, ly * off * 0.95);
  ctx.stroke();

  // ---- 3. 絞りの溝(クリームのみ縦溝) ----
  if (style === 'cream' && shadeA > 0.02) {
    ctx.globalAlpha = 0.09 * shadeA;
    ctx.strokeStyle = col.groove;
    ctx.lineWidth = Math.max(1, maxW * 0.09);
    for (const f of [-0.58, -0.20, 0.22, 0.58]) {
      traceOffsetLine(ctx, path, f, wArr);
      ctx.stroke();
    }
    // 横方向のリング(絞り袋のむにゅっとした節)
    ctx.globalAlpha = 0.055 * shadeA;
    ctx.lineWidth = Math.max(1, maxW * 0.08);
    const step = Wfull * 0.95;
    let next = step * (0.5 + rng() * 0.4);
    for (let i = 1; i < n - 1; i++) {
      if (path.len[i] >= next) {
        next += step * (0.85 + rng() * 0.3);
        const p = path.pts[i], nxx = path.nx[i], nyy = path.ny[i];
        const tx = nyy, ty = -nxx; // 進行方向
        const w = wArr[i] * 0.86;
        ctx.beginPath();
        ctx.moveTo(p.x + nxx * w, p.y + nyy * w);
        ctx.quadraticCurveTo(p.x + tx * w * 0.5, p.y + ty * w * 0.5, p.x - nxx * w, p.y - nyy * w);
        ctx.stroke();
      }
    }
  }

  // ---- 4. ソース/グレーズの強い光沢帯 ----
  if (style !== 'cream' && shadeA > 0.02) {
    ctx.globalAlpha = 0.55 * shadeA;
    ctx.strokeStyle = col.hi;
    ctx.lineWidth = Math.max(1.4, maxW * 0.30);
    traceCenter(ctx, path, lx * off * 1.0, ly * off * 1.0 - maxW * 0.08);
    ctx.stroke();
    // 短くて強いグリント
    ctx.globalAlpha = 0.85 * sparkA;
    ctx.lineWidth = Math.max(1.2, maxW * 0.16);
    const gl = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < gl; k++) {
      const i0 = 2 + Math.floor(rng() * Math.max(1, n - 10));
      const i1 = Math.min(n - 1, i0 + 3 + Math.floor(rng() * 4));
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) {
        const x = path.pts[i].x + lx * off, y = path.pts[i].y + ly * off - maxW * 0.08;
        if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // ---- 5. 砂糖の微結晶 ----
  if (sparkA > 0.02) {
    const cnt = Math.min(26, Math.floor(total / (Wfull * 0.7)) + 6);
    for (let k = 0; k < cnt; k++) {
      const i = 1 + Math.floor(rng() * (n - 2));
      const o = (rng() * 2 - 1) * 0.62;
      const x = path.pts[i].x + path.nx[i] * wArr[i] * o;
      const y = path.pts[i].y + path.ny[i] * wArr[i] * o;
      const r = 0.5 + rng() * 0.9;
      ctx.globalAlpha = (0.25 + rng() * 0.4) * sparkA;
      ctx.fillStyle = rng() < 0.82 ? '#FFFFFF' : '#FFE9A8';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, U.TAU);
      ctx.fill();
    }
  }
  ctx.restore(); // クリップ解除

  // ---- 6. 輪郭のごく薄い締め ----
  ctx.globalAlpha = (style === 'cream' ? 0.11 : 0.15) * (0.3 + 0.7 * shadeA);
  ctx.strokeStyle = col.edge;
  ctx.lineWidth = style === 'cream' ? 1.4 : 2.0;
  traceBody(ctx, path, wArr, 0, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ---- 7. 絞り終わりのちょこんとした先端(クリームのみ) ----
  if (style === 'cream' && tipA > 0.02 && total > Wfull * 1.2) {
    const i = n - 1;
    const p = path.pts[i];
    const tx = path.ny[i], ty = -path.nx[i];
    const w = Math.max(2, wArr[Math.max(0, n - 3)] * 0.9) * tipA;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(ty, tx));
    ctx.fillStyle = col.base;
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, -w * 0.78);
    ctx.quadraticCurveTo(w * 0.9, -w * 0.55, w * 1.45, w * 0.05);
    ctx.quadraticCurveTo(w * 0.9, w * 0.6, -w * 0.1, w * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.5 * tipA;
    ctx.strokeStyle = col.light;
    ctx.lineWidth = Math.max(1, w * 0.22);
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.4);
    ctx.quadraticCurveTo(w * 0.75, -w * 0.34, w * 1.15, 0);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---- 8. ソースの雫(ドーナツ用・下方向へ少しだけ) ----
  if ((style === 'sauce' || style === 'glaze') && opt.drips && grow > 0.9) {
    let made = 0;
    for (let i = 4; i < n - 4 && made < 2; i += 2) {
      const y = path.pts[i].y;
      if (y > path.pts[i - 3].y && y > path.pts[i + 3].y && rng() < 0.5) {
        const p = path.pts[i];
        const L = maxW * (1.1 + rng() * 1.1);
        const w = maxW * 0.5;
        ctx.fillStyle = col.base;
        if (style === 'glaze') ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(p.x - w, p.y);
        ctx.quadraticCurveTo(p.x - w * 0.9, p.y + L * 0.75, p.x, p.y + L);
        ctx.quadraticCurveTo(p.x + w * 0.9, p.y + L * 0.75, p.x + w, p.y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = col.hi;
        ctx.beginPath();
        ctx.ellipse(p.x - w * 0.28, p.y + L * 0.55, w * 0.16, L * 0.2, 0.2, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        made++;
        i += 8;
      }
    }
  }

  ctx.restore();
}

/* ============================================================
 * 描いている最中の線(これ自体をごちそうに見せる)
 * ============================================================ */
function drawLiveSegment(ctx, ax, ay, bx, by, w, col) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 下の影
  ctx.strokeStyle = rgbaS(col.groove, 0.35);
  ctx.lineWidth = w + 3;
  ctx.beginPath(); ctx.moveTo(ax, ay + 1.4); ctx.lineTo(bx, by + 1.4); ctx.stroke();
  // 本体
  ctx.strokeStyle = col.base;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  // つや
  ctx.strokeStyle = rgba(col.light, 0.85);
  ctx.lineWidth = Math.max(2, w * 0.42);
  ctx.beginPath();
  ctx.moveTo(ax + LIGHT.x * w * 0.2, ay + LIGHT.y * w * 0.2);
  ctx.lineTo(bx + LIGHT.x * w * 0.2, by + LIGHT.y * w * 0.2);
  ctx.stroke();
  // クレヨンの粒子
  if (Math.random() < 0.5) {
    ctx.fillStyle = rgba(col.hi, 0.5);
    const t = Math.random();
    ctx.beginPath();
    ctx.arc(ax + (bx - ax) * t + U.rand(-w * 0.3, w * 0.3), ay + (by - ay) * t + U.rand(-w * 0.3, w * 0.3), U.rand(0.5, 1.2), 0, U.TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ============================================================
 * トッピング
 * ============================================================ */

/** 大きなイチゴ。s=高さ */
function drawStrawberry(ctx, x, y, s, seed) {
  const rng = mulberry32(seed || 3);
  ctx.save();
  ctx.translate(x, y);
  const w = s * 0.88;
  // 落ち影
  ctx.fillStyle = 'rgba(120,50,60,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.48, w * 0.42, s * 0.09, 0, 0, U.TAU);
  ctx.fill();
  // 本体(下すぼまりのぷっくり形)
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.52);
    ctx.bezierCurveTo(-w * 0.62, s * 0.28, -w * 0.60, -s * 0.30, -w * 0.30, -s * 0.40);
    ctx.bezierCurveTo(-w * 0.12, -s * 0.47, w * 0.12, -s * 0.47, w * 0.30, -s * 0.40);
    ctx.bezierCurveTo(w * 0.60, -s * 0.30, w * 0.62, s * 0.28, 0, s * 0.52);
    ctx.closePath();
  };
  const g = ctx.createRadialGradient(-w * 0.2, -s * 0.28, s * 0.05, 0, 0, s * 0.75);
  g.addColorStop(0, '#FF8B99');
  g.addColorStop(0.45, '#F44E63');
  g.addColorStop(1, '#D01F3C');
  body();
  ctx.fillStyle = g;
  ctx.fill();
  // 種
  ctx.save();
  body(); ctx.clip();
  for (let r = 0; r < 4; r++) {
    const yy = -s * 0.26 + r * s * 0.20;
    const cols = 3 + (r % 2);
    for (let c = 0; c < cols; c++) {
      const xx = (c - (cols - 1) / 2) * w * 0.24 + (r % 2 ? w * 0.05 : -w * 0.03);
      const jx = (rng() - 0.5) * s * 0.03, jy = (rng() - 0.5) * s * 0.03;
      ctx.fillStyle = 'rgba(120,30,45,0.55)';
      ctx.beginPath();
      ctx.ellipse(xx + jx, yy + jy + s * 0.012, s * 0.030, s * 0.045, xx * 0.002, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#FFE9A8';
      ctx.beginPath();
      ctx.ellipse(xx + jx, yy + jy, s * 0.026, s * 0.042, xx * 0.002, 0, U.TAU);
      ctx.fill();
    }
  }
  // やわらかい照り
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(-w * 0.22, -s * 0.22, w * 0.20, s * 0.16, -0.5, 0, U.TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
  // 強いグリント
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.16, -s * 0.30, s * 0.045, s * 0.028, -0.6, 0, U.TAU);
  ctx.fill();
  // ヘタ
  ctx.fillStyle = '#4C9E4C';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.5;
    ctx.save();
    ctx.translate(Math.cos(a) * s * 0.10, -s * 0.42 + Math.sin(a) * s * 0.03);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.05, s * 0.045, s * 0.10, 0, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#67B767';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.44, s * 0.055, s * 0.04, 0, 0, U.TAU);
  ctx.fill();
  ctx.restore();
}

/** さくらんぼ */
function drawCherry(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(120,50,60,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.42, s * 0.34, s * 0.09, 0, 0, U.TAU);
  ctx.fill();
  // 軸
  ctx.strokeStyle = '#7A5230';
  ctx.lineWidth = s * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.05);
  ctx.quadraticCurveTo(s * 0.16, -s * 0.5, s * 0.05, -s * 0.72);
  ctx.stroke();
  // 実
  const g = ctx.createRadialGradient(-s * 0.14, -s * 0.1, s * 0.04, 0, s * 0.05, s * 0.5);
  g.addColorStop(0, '#FF7B8E');
  g.addColorStop(0.5, '#E7314E');
  g.addColorStop(1, '#B01230');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, s * 0.05, s * 0.38, 0, U.TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.13, -s * 0.08, s * 0.09, s * 0.055, -0.6, 0, U.TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(s * 0.1, s * 0.2, s * 0.07, s * 0.04, 0.5, 0, U.TAU);
  ctx.fill();
  // 葉
  ctx.fillStyle = '#5CAB5C';
  ctx.save();
  ctx.translate(s * 0.05, -s * 0.7);
  ctx.rotate(0.5);
  ctx.beginPath();
  ctx.ellipse(s * 0.1, 0, s * 0.16, s * 0.075, 0, 0, U.TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.36);
  ctx.bezierCurveTo(-s * 0.62, -s * 0.05, -s * 0.40, -s * 0.48, 0, -s * 0.20);
  ctx.bezierCurveTo(s * 0.40, -s * 0.48, s * 0.62, -s * 0.05, 0, s * 0.36);
  ctx.closePath();
}

/** ハート型シュガー */
function drawSugarHeart(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || -0.12);
  ctx.fillStyle = 'rgba(150,70,90,0.14)';
  ctx.save(); ctx.translate(s * 0.05, s * 0.1); heartPath(ctx, s); ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(-s * 0.4, -s * 0.4, s * 0.4, s * 0.45);
  g.addColorStop(0, '#FF9FBB');
  g.addColorStop(1, '#EF5E8C');
  heartPath(ctx, s);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = s * 0.06;
  ctx.save(); ctx.scale(0.78, 0.78); heartPath(ctx, s); ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.16, -s * 0.16, s * 0.10, s * 0.06, -0.6, 0, U.TAU);
  ctx.fill();
  // 砂糖の粒
  const rng = mulberry32(11);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc((rng() - 0.5) * s * 0.7, (rng() - 0.55) * s * 0.6, s * 0.022 + rng() * s * 0.012, 0, U.TAU);
    ctx.fill();
  }
  ctx.restore();
}

function starPath(ctx, s, points) {
  const p = points || 5;
  ctx.beginPath();
  for (let i = 0; i < p * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / p;
    const r = i % 2 === 0 ? s : s * 0.46;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 星型シュガー */
function drawSugarStar(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || 0.1);
  ctx.fillStyle = 'rgba(160,110,40,0.14)';
  ctx.save(); ctx.translate(s * 0.06, s * 0.12); starPath(ctx, s * 0.5); ctx.fill(); ctx.restore();
  const g = ctx.createLinearGradient(-s * 0.4, -s * 0.4, s * 0.35, s * 0.45);
  g.addColorStop(0, '#FFE07A');
  g.addColorStop(1, '#F5B33B');
  starPath(ctx, s * 0.5);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = s * 0.05;
  ctx.save(); ctx.scale(0.72, 0.72); starPath(ctx, s * 0.5); ctx.stroke(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.10, -s * 0.14, s * 0.08, s * 0.05, -0.5, 0, U.TAU);
  ctx.fill();
  ctx.restore();
}

const SPRINKLE_COLORS = ['#FF8FB0', '#FFD166', '#7FD8BE', '#9AB7FF', '#F7A8FF', '#FFF3B0'];

/** スプリンクル1粒(カプセル型) */
function drawSprinkle(ctx, x, y, ang, len, w, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(90,50,60,0.28)';
  ctx.lineWidth = w + 1.2;
  ctx.beginPath(); ctx.moveTo(-len / 2, 0.8); ctx.lineTo(len / 2, 0.8); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = w * 0.34;
  ctx.beginPath(); ctx.moveTo(-len / 2 + w * 0.3, -w * 0.18); ctx.lineTo(len / 2 - w * 0.3, -w * 0.18); ctx.stroke();
  ctx.restore();
}

/** きらきら十字スパーク */
function drawSparkle(ctx, x, y, r, rot, alpha, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color || '#FFF7D6';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * r * 0.28, Math.sin(a + Math.PI / 4) * r * 0.28);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** ぷかぷかハート */
function drawFloatHeart(ctx, x, y, s, alpha, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
  g.addColorStop(0, color || '#FF97B5');
  g.addColorStop(1, '#F2557F');
  heartPath(ctx, s);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.16, -s * 0.14, s * 0.09, s * 0.055, -0.6, 0, U.TAU);
  ctx.fill();
  ctx.restore();
}
