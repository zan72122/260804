'use strict';
/* ============================================================
   すけすけ！じどうはんばいき
   4歳児向け・透明化する自動販売機ゲーム
   単一SVGシーン + 簡易物理 + WebAudio生成音
   ============================================================ */

// ---------------------------------------------------------------
// 基本ユーティリティ
// ---------------------------------------------------------------
const SVGNS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('stage');
const camG = document.getElementById('cam');
const worldG = document.getElementById('world');
const fxG = document.getElementById('fx');
const openSceneG = document.getElementById('openScene');
const hintGlow = document.getElementById('hintGlow');
const defs = document.getElementById('defs');

function el(name, attrs, parent) {
  const n = document.createElementNS(SVGNS, name);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function grp(parent, attrs) { return el('g', attrs || {}, parent); }
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
const rnd = (a, b) => a + Math.random() * (b - a);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeInQuad = t => t * t;

// 簡易トゥイーン
const tweens = [];
function tween(dur, fn, done, ease) {
  tweens.push({ t0: performance.now(), dur, fn, done, ease: ease || easeOutCubic });
}
function stepTweens(now) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    let k = clamp((now - tw.t0) / tw.dur, 0, 1);
    tw.fn(tw.ease(k), k);
    if (k >= 1) { tweens.splice(i, 1); if (tw.done) tw.done(); }
  }
}
const timers = [];
function after(ms, fn) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { while (timers.length) clearTimeout(timers.pop()); }

// ---------------------------------------------------------------
// ジオメトリ定義（viewBox 420x840）
// ---------------------------------------------------------------
const COLS = [110, 210, 310];
const SHELF_Y = [196, 328];         // 棚の床（商品の底）
const SLOT = { x: 327, y: 532 };    // 硬貨投入口
const TRAY = { x: 210, y: 796 };    // 硬貨の待機トレー
const COIN_R = 34;
const RAIL_A = { x1: 78, y1: 368, x2: 334, y2: 398 };            // 上段固定レール（右下がり）
const RAIL_B = { cx: 210, cy: 468, half: 124, base: -7, min: -16, max: 16 }; // 遊べるレール
const FUN_L = { x1: 66, y1: 538, x2: 188, y2: 566, m1: 26, m2: 0 };  // 漏斗レール左
const FUN_R = { x1: 232, y1: 566, x2: 354, y2: 538, m1: 0, m2: 26 }; // 漏斗レール右
const WALL_L = 86, WALL_R = 334;    // 弾道時の内壁（商品半幅ぶん内側）
const BIN_Y = 654;                  // 取り出し口の床
const PORT_C = { x: 210, y: 688 };  // 取り出し口内の商品静止位置
const GRAV = 560;
const PROD_R = 26;                  // 転がり半径（回転計算用）

// 商品定義
const PRODUCTS = [
  { id: 'ichigo', type: 'can', c1: '#ff8fb5', c2: '#e0447c', lid: '#e8ecf2', fruit: 'berry' },
  { id: 'orange', type: 'can', c1: '#ffb44d', c2: '#ef7d16', lid: '#e8ecf2', fruit: 'orange' },
  { id: 'mizu',   type: 'pet', c1: '#cfeefe', c2: '#8fd2f4', lid: '#7fc7ee', fruit: 'none' },
  { id: 'budou',  type: 'pet', c1: '#b48ae8', c2: '#7a44c0', lid: '#5f2fa0', fruit: 'grape' },
  { id: 'miruku', type: 'pet', c1: '#fffdf6', c2: '#efe8d8', lid: '#7fa8e0', fruit: 'milk' },
  { id: 'lemon',  type: 'can', c1: '#ffe066', c2: '#f2b41c', lid: '#e8ecf2', fruit: 'lemon' },
];
const BTN_Y = [390, 390, 390, 458, 458, 458];
const BTN_X = [110, 210, 310, 110, 210, 310];

// ---------------------------------------------------------------
// グラデーション等の defs
// ---------------------------------------------------------------
function linGrad(id, stops, x1, y1, x2, y2) {
  const g = el('linearGradient', { id, x1, y1, x2, y2 }, defs);
  stops.forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] == null ? 1 : s[2] }, g));
}
function radGrad(id, stops) {
  const g = el('radialGradient', { id }, defs);
  stops.forEach(s => el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] == null ? 1 : s[2] }, g));
}
linGrad('gradBody', [[0, '#ff7a6e'], [0.5, '#ee5347'], [1, '#c93a30']], 0, 0, 0, 1);
linGrad('gradBodySide', [[0, '#00000000', 0.35], [0.5, '#000000', 0], [1, '#000000', 0.35]], 0, 0, 1, 0);
linGrad('gradPanel', [[0, '#fff6e8'], [1, '#f0e0c8']], 0, 0, 0, 1);
linGrad('gradGlass', [[0, '#2c3d55'], [0.5, '#3c5273'], [1, '#28374d']], 0, 0, 0, 1);
linGrad('gradInterior', [[0, '#37303c'], [1, '#191419']], 0, 0, 0, 1);
linGrad('gradRail', [[0, '#e6ebf2'], [0.45, '#9aa5b5'], [1, '#5d6675']], 0, 0, 0, 1);
linGrad('gradFlap', [[0, '#4c4650'], [0.15, '#38333c'], [1, '#232028']], 0, 0, 0, 1);
linGrad('gradBezel', [[0, '#e8dcc8'], [1, '#b8a888']], 0, 0, 0, 1);
linGrad('gradSlotPlate', [[0, '#dfe5ee'], [1, '#aab3c2']], 0, 0, 0, 1);
radGrad('gradPortDark', [[0, '#241f27'], [1, '#0d0b10']]);
radGrad('gradHint', [[0, '#fff8c8', 0.95], [0.55, '#ffe98a', 0.5], [1, '#ffe98a', 0]]);
radGrad('gradCoin', [[0, '#f4f6f9'], [0.62, '#d9dde4'], [0.88, '#b8bec9'], [1, '#979eab']]);
radGrad('gradLampOn', [[0, '#c8ffc0'], [0.5, '#5ee85a'], [1, '#1da344']]);
radGrad('gradGlow', [[0, '#ffffff', 0.9], [1, '#ffffff', 0]]);
radGrad('gradPortLamp', [[0, '#ffe9b0', 0.85], [1, '#ffe9b0', 0]]);
radGrad('gradWarmGlow', [[0, '#ffeaa8', 0.68], [0.55, '#ffdf8a', 0.28], [1, '#ffdf8a', 0]]);
linGrad('gradShine', [[0, '#ffffff', 0], [0.5, '#ffffff', 0.55], [1, '#ffffff', 0]], 0, 0, 1, 0);
linGrad('gradLid', [[0, '#f4f7fa'], [0.55, '#d4dae2'], [1, '#b0b8c4']], 0, 0, 0, 1);
linGrad('gradTab', [[0, '#e6ebf1'], [1, '#a4adba']], 0, 0, 0, 1);
linGrad('gradFloor', [[0, '#332c39'], [1, '#1b1720']], 0, 0, 0, 1);
PRODUCTS.forEach(p => {
  linGrad('gp_' + p.id, [[0, p.c1], [0.42, p.c1], [1, p.c2]], 0, 0, 1, 0);
});

// ---------------------------------------------------------------
// 商品グラフィック（原点 = 中心, 高さ約76）
// ---------------------------------------------------------------
function buildFruit(g, fruit, y) {
  if (fruit === 'berry') {
    el('circle', { cx: 0, cy: y, r: 10, fill: '#e8355f' }, g);
    el('path', { d: `M-6 ${y - 8} L0 ${y - 14} L6 ${y - 8} Z`, fill: '#3aa653' }, g);
    for (const [sx, sy] of [[-4, -2], [3, 1], [-1, 4]]) el('circle', { cx: sx, cy: y + sy, r: 1.1, fill: '#ffe9a0' }, g);
  } else if (fruit === 'orange') {
    el('circle', { cx: 0, cy: y, r: 10, fill: '#ff9022' }, g);
    el('circle', { cx: 0, cy: y, r: 6.5, fill: 'none', stroke: '#ffd9a8', 'stroke-width': 1.6 }, g);
    el('path', { d: `M0 ${y - 6.5} V${y + 6.5} M-6.5 ${y} H6.5`, stroke: '#ffd9a8', 'stroke-width': 1.6 }, g);
  } else if (fruit === 'grape') {
    for (const [sx, sy] of [[-5, -3], [5, -3], [0, 3], [-5, 6] ,[5, 6], [0, 10]]) el('circle', { cx: sx, cy: y + sy - 3, r: 4.4, fill: '#5c2f96' }, g);
    el('path', { d: `M0 ${y - 8} Q3 ${y - 13} 7 ${y - 12}`, stroke: '#3aa653', 'stroke-width': 2.4, fill: 'none' }, g);
  } else if (fruit === 'lemon') {
    el('ellipse', { cx: 0, cy: y, rx: 11, ry: 8, fill: '#ffd23e' }, g);
    el('circle', { cx: 0, cy: y, r: 5.5, fill: 'none', stroke: '#fff3b8', 'stroke-width': 1.5 }, g);
  } else if (fruit === 'milk') {
    el('path', { d: `M0 ${y - 9} C5 ${y - 2} 7 ${y + 1} 7 ${y + 4} A7 7 0 1 1 -7 ${y + 4} C-7 ${y + 1} -5 ${y - 2} 0 ${y - 9} Z`, fill: '#fff', stroke: '#bcd4ee', 'stroke-width': 1.5 }, g);
  }
}

// 結露：少数の固定水滴＋一筋の垂れ跡（パーティクル不使用の低コスト表現）
const DEW_SPOTS = [[-0.72, 0.18, 1.6], [-0.35, 0.55, 1.1], [-0.52, 0.82, 2.0], [0.18, 0.32, 1.3], [0.55, 0.62, 1.8], [0.76, 0.22, 1.1], [0.3, 0.86, 1.5], [-0.08, 0.68, 1.0]];
function addDew(g, hw, y0, y1, op) {
  const dg = grp(g, { opacity: op == null ? 0.55 : op, 'pointer-events': 'none' });
  for (const [fx, fy, r] of DEW_SPOTS) {
    el('circle', { cx: fx * hw, cy: y0 + (y1 - y0) * fy, r, fill: '#f2faff' }, dg);
  }
  el('line', { x1: hw * 0.55, y1: y0 + (y1 - y0) * 0.62 - 13, x2: hw * 0.55, y2: y0 + (y1 - y0) * 0.62, stroke: '#f2faff', 'stroke-width': 1, opacity: 0.6 }, dg);
}

function buildProduct(p, parent) {
  const g = grp(parent);
  if (p.type === 'can') {
    el('ellipse', { cx: 0, cy: 32, rx: 24, ry: 7, fill: '#00000044' }, g);
    el('path', { d: 'M-24 -30 L-24 30 A24 7 0 0 0 24 30 L24 -30 Z', fill: `url(#gp_${p.id})` }, g);
    // ラベル帯
    el('path', { d: 'M-24 -6 L-24 18 L24 18 L24 -6 Z', fill: '#ffffff', opacity: 0.88 }, g);
    buildFruit(g, p.fruit, 6);
    // 曲面の巻き込み陰影（ラベルごと巻く）＋右エッジの拾い光
    el('rect', { x: -24, y: -30, width: 3.5, height: 60, fill: '#000000', opacity: 0.18 }, g);
    el('rect', { x: 20.5, y: -30, width: 3.5, height: 60, fill: '#000000', opacity: 0.16 }, g);
    el('rect', { x: 22, y: -28, width: 1.2, height: 56, fill: '#ffffff', opacity: 0.14 }, g);
    // 鋭いスペキュラ＋広いシーン（曲面に沿った二段ハイライト）
    el('rect', { x: -16, y: -28, width: 3.5, height: 58, rx: 1.75, fill: '#ffffff', opacity: 0.6 }, g);
    el('rect', { x: -11, y: -27, width: 9, height: 56, rx: 4, fill: '#ffffff', opacity: 0.13 }, g);
    // 首の絞り影・底の巻き込み
    el('rect', { x: -24, y: -30, width: 48, height: 5, fill: '#000000', opacity: 0.1 }, g);
    el('path', { d: 'M-23 27 A23 8 0 0 0 23 27', fill: 'none', stroke: '#000000', opacity: 0.22, 'stroke-width': 2.4 }, g);
    addDew(g, 22, -4, 28);
    // 蓋（縁の厚み＋巻き締めの段差）
    el('ellipse', { cx: 0, cy: -29.2, rx: 24, ry: 7, fill: '#87909d' }, g);
    el('ellipse', { cx: 0, cy: -30.6, rx: 24, ry: 7, fill: 'url(#gradLid)' }, g);
    el('ellipse', { cx: 0, cy: -30.4, rx: 20.5, ry: 5.6, fill: 'none', stroke: '#a6aeba', 'stroke-width': 1.2 }, g);
    el('ellipse', { cx: 0, cy: -30.2, rx: 14, ry: 3.8, fill: '#ccd3db' }, g);
    el('ellipse', { cx: 0, cy: -29.8, rx: 6, ry: 2.2, fill: '#a8b0bc' }, g); // プルタブの示唆
  } else {
    // PET / ボトル
    const clear = p.id === 'mizu' || p.id === 'budou';
    el('ellipse', { cx: 0, cy: 34, rx: 20, ry: 6, fill: '#00000044' }, g);
    el('path', {
      d: 'M-20 34 L-20 -10 C-20 -20 -10 -24 -10 -30 L-10 -33 L10 -33 L10 -30 C10 -24 20 -20 20 -10 L20 34 Z',
      fill: `url(#gp_${p.id})`, opacity: clear ? 0.82 : 1
    }, g);
    if (clear) {
      // 液体：壁際の厚み・屈折の明るい芯・メニスカス
      el('path', { d: 'M-17 -4 L-17 30 A17 5 0 0 0 17 30 L17 -4 Z', fill: p.c2, opacity: 0.55 }, g);
      el('rect', { x: -17, y: -2, width: 3, height: 30, fill: p.c2, opacity: 0.5 }, g);
      el('rect', { x: 14, y: -2, width: 3, height: 30, fill: p.c2, opacity: 0.38 }, g);
      el('rect', { x: -4, y: 0, width: 8, height: 28, rx: 4, fill: '#ffffff', opacity: 0.18 }, g);
      el('ellipse', { cx: 0, cy: -4, rx: 17, ry: 4, fill: '#ffffff', opacity: 0.5 }, g);
      el('ellipse', { cx: 0, cy: -3, rx: 16.5, ry: 3.8, fill: 'none', stroke: p.c2, opacity: 0.45, 'stroke-width': 1 }, g);
    }
    if (p.fruit === 'none') {
      // 水：小さな半透明ラベルと波模様（液体を隠さない）
      el('path', { d: 'M-14 7 L-14 20 L14 20 L14 7 Z', fill: '#ffffff', opacity: 0.6 }, g);
      el('path', { d: 'M-10 13.5 Q-5 9.5 0 13.5 T10 13.5', fill: 'none', stroke: '#4fb0e4', 'stroke-width': 2.2, opacity: 0.95 }, g);
    } else {
      el('path', { d: 'M-14 2 L-14 24 L14 24 L14 2 Z', fill: '#ffffff', opacity: p.id === 'miruku' ? 0.0 : 0.9 }, g);
      buildFruit(g, p.fruit, 13);
    }
    // ボトル壁のエッジ（透明体の輪郭反射）
    el('line', { x1: -18.3, y1: -6, x2: -18.3, y2: 32, stroke: '#ffffff', opacity: 0.5, 'stroke-width': 1.2 }, g);
    el('line', { x1: 18.3, y1: -6, x2: 18.3, y2: 32, stroke: '#ffffff', opacity: 0.22, 'stroke-width': 1.2 }, g);
    // スペキュラ二段＋肩のハイライト
    el('rect', { x: -13, y: -24, width: 3, height: 54, rx: 1.5, fill: '#ffffff', opacity: 0.6 }, g);
    el('rect', { x: -8, y: -20, width: 7, height: 50, rx: 3.5, fill: '#ffffff', opacity: 0.12 }, g);
    el('path', { d: 'M-10 -26 Q-16 -20 -18 -11', fill: 'none', stroke: '#ffffff', opacity: 0.45, 'stroke-width': 1.8 }, g);
    // 底の座
    el('path', { d: 'M-16 31 A16 4 0 0 0 16 31', fill: 'none', stroke: '#000000', opacity: 0.18, 'stroke-width': 2 }, g);
    addDew(g, 18, -2, 30, p.id === 'miruku' ? 0.45 : 0.55);
    // キャップ（ローレット・天面の光・セーフティリング）
    el('rect', { x: -11, y: -43, width: 22, height: 11, rx: 3, fill: p.lid }, g);
    for (const kx of [-7, -3.5, 0, 3.5, 7]) el('line', { x1: kx, y1: -42.2, x2: kx, y2: -33.4, stroke: '#000000', opacity: 0.22, 'stroke-width': 1 }, g);
    el('rect', { x: -9.5, y: -43.4, width: 19, height: 2.2, rx: 1.1, fill: '#ffffff', opacity: 0.4 }, g);
    el('line', { x1: -10, y1: -32.6, x2: 10, y2: -32.6, stroke: '#000000', opacity: 0.3, 'stroke-width': 1.2 }, g);
  }
  return g;
}

// ---------------------------------------------------------------
// シーン構築
// ---------------------------------------------------------------
// 地面の影
el('ellipse', { cx: 210, cy: 768, rx: 175, ry: 20, fill: '#22304a', opacity: 0.2 }, worldG);

const machineG = grp(worldG, { id: 'machine' });

// --- 外装 ---
el('rect', { x: 30, y: 20, width: 360, height: 740, rx: 18, fill: 'url(#gradBody)' }, machineG);
el('rect', { x: 30, y: 20, width: 360, height: 740, rx: 18, fill: 'url(#gradBodySide)' }, machineG);
el('rect', { x: 38, y: 26, width: 344, height: 10, rx: 5, fill: '#ffffff', opacity: 0.25 }, machineG);

// --- 内部（透過時に見える） ---
const interiorG = grp(machineG, { id: 'interior', class: 'fadeable', opacity: 0 });
el('rect', { x: 44, y: 72, width: 332, height: 650, rx: 8, fill: 'url(#gradInterior)' }, interiorG);
// 奥の在庫シルエット（雰囲気用・静的）
for (let i = 0; i < 6; i++) {
  el('rect', { x: 70 + i * 47, y: 96, width: 30, height: 52, rx: 8, fill: '#4a4050', opacity: 0.32 }, interiorG);
  el('rect', { x: 82 + i * 45, y: 214, width: 30, height: 52, rx: 8, fill: '#443a4a', opacity: 0.26 }, interiorG);
}
// 内壁
el('rect', { x: 56, y: 356, width: 10, height: 226, rx: 3, fill: '#4a515e', stroke: '#242830', 'stroke-width': 1.5 }, interiorG);
el('rect', { x: 354, y: 356, width: 10, height: 226, rx: 3, fill: '#4a515e', stroke: '#242830', 'stroke-width': 1.5 }, interiorG);
// モーターユニット
const motorG = grp(interiorG);
el('rect', { x: 312, y: 596, width: 58, height: 66, rx: 8, fill: '#3a3542', stroke: '#57505f', 'stroke-width': 2 }, motorG);
const fanG = grp(motorG, { id: 'fan' });
el('circle', { cx: 341, cy: 629, r: 17, fill: '#2a2530', stroke: '#6a6275', 'stroke-width': 2 }, fanG);
for (let i = 0; i < 3; i++) el('rect', { x: 339, y: 613, width: 4, height: 15, rx: 2, fill: '#8a8195', transform: `rotate(${i * 120} 341 629)` }, fanG);
// レールA（固定）
function drawRail(parent, x1, y1, x2, y2) {
  el('line', { x1, y1: y1 + 3.5, x2, y2: y2 + 3.5, stroke: '#0d0c11', 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0.6 }, parent);
  el('line', { x1, y1, x2, y2, stroke: '#6b7484', 'stroke-width': 7, 'stroke-linecap': 'round' }, parent);
  // 圧延鋼の段差＋パンチ穴（軽量な質感表現）
  el('line', { x1, y1: y1 + 1.7, x2, y2: y2 + 1.7, stroke: '#4e5563', 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0.85 }, parent);
  el('line', { x1: x1 + 8, y1: y1 + 0.2, x2: x2 - 8, y2: y2 + 0.2, stroke: '#39404c', 'stroke-width': 1.8, 'stroke-dasharray': '2.4 9', opacity: 0.9 }, parent);
  // ハイライト線を返す（商品が乗っている間だけ明るく点灯させる）
  return el('line', { x1, y1: y1 - 2.2, x2, y2: y2 - 2.2, stroke: '#cfd8e4', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.95 }, parent);
}
// レールの取り付け金具
function bracket(x, y) {
  el('path', { d: `M${x - 5} ${y + 2} L${x + 5} ${y + 2} L${x + 3.5} ${y + 13} L${x - 3.5} ${y + 13} Z`, fill: '#454b57', stroke: '#242830', 'stroke-width': 1 }, interiorG);
}
const railHi = {};
bracket(RAIL_A.x1, RAIL_A.y1); bracket(RAIL_A.x2, RAIL_A.y2);
bracket(FUN_L.x1, FUN_L.y1); bracket(FUN_R.x2, FUN_R.y2);
railHi.A = drawRail(interiorG, RAIL_A.x1, RAIL_A.y1, RAIL_A.x2, RAIL_A.y2);
// レールB（プレイヤーが傾けられる）
const railBG = grp(interiorG, { id: 'railB' });
railHi.B = drawRail(railBG, -RAIL_B.half, 0, RAIL_B.half, 0);
el('circle', { cx: 0, cy: 0, r: 6, fill: '#d8dee8', stroke: '#7a8494', 'stroke-width': 2 }, railBG); // 中心ピボット
const railHandleG = grp(railBG, { id: 'railHandle' });
for (const hx of [-30, 0, 30]) el('circle', { cx: hx, cy: 9, r: 5, fill: '#ffd23e', stroke: '#b8871a', 'stroke-width': 1.6 }, railHandleG);
const railGlowRect = el('rect', { x: -46, y: 2, width: 92, height: 15, rx: 7.5, fill: '#ffd23e', opacity: 0.18 }, railHandleG);
// 漏斗レール
railHi.FL = drawRail(interiorG, FUN_L.x1, FUN_L.y1, FUN_L.x2, FUN_L.y2);
railHi.FR = drawRail(interiorG, FUN_R.x1, FUN_R.y1, FUN_R.x2, FUN_R.y2);
function setRailLit(name) {
  for (const k in railHi) {
    const on = k === name;
    railHi[k].setAttribute('stroke', on ? '#ffffff' : '#cfd8e4');
    railHi[k].setAttribute('stroke-width', on ? 3.2 : 2);
    railHi[k].setAttribute('opacity', on ? 1 : 0.95);
  }
}
// 転がる商品のレイヤー
const rollLayer = grp(interiorG, { id: 'rollLayer' });

// --- 透明化時に現れる「ガラス板」層（前面が消えたのではなく透けたと分かる） ---
const paneG = grp(machineG, { id: 'pane', class: 'fadeable', opacity: 0, 'pointer-events': 'none' });
el('rect', { x: 50, y: 74, width: 320, height: 496, rx: 10, fill: '#cfe2ff', opacity: 0.05 }, paneG);
el('rect', { x: 50, y: 74, width: 320, height: 496, rx: 10, fill: 'none', stroke: '#dcecff', opacity: 0.22, 'stroke-width': 2 }, paneG);
el('polygon', { points: '96,570 252,74 298,74 142,570', fill: '#ffffff', opacity: 0.055 }, paneG);
el('line', { x1: 330, y1: 74, x2: 262, y2: 570, stroke: '#ffffff', opacity: 0.07, 'stroke-width': 7 }, paneG);

// --- 前面ガラス＋見本 ---
const frontGlassG = grp(machineG, { id: 'frontGlass', class: 'fadeable' });
el('rect', { x: 55, y: 78, width: 310, height: 266, rx: 12, fill: '#8c2a24' }, frontGlassG);
el('rect', { x: 63, y: 86, width: 294, height: 250, rx: 8, fill: 'url(#gradGlass)' }, frontGlassG);
el('rect', { x: 66, y: 192, width: 288, height: 8, rx: 3, fill: 'url(#gradRail)' }, frontGlassG);
el('rect', { x: 66, y: 324, width: 288, height: 8, rx: 3, fill: 'url(#gradRail)' }, frontGlassG);
const samplesG = grp(frontGlassG, { id: 'samples' });
const sampleEls = PRODUCTS.map((p, i) => {
  const col = COLS[i % 3], shelf = SHELF_Y[i < 3 ? 0 : 1];
  const holder = grp(samplesG, { transform: `translate(${col} ${shelf - 38})` });
  buildProduct(p, holder);
  return holder;
});
// ガラス反射
el('path', { d: 'M85 336 L200 86 L248 86 L133 336 Z', fill: '#ffffff', opacity: 0.09, 'pointer-events': 'none' }, frontGlassG);
el('path', { d: 'M255 336 L340 152 L340 210 L282 336 Z', fill: '#ffffff', opacity: 0.06, 'pointer-events': 'none' }, frontGlassG);

// --- 前面パネル（ボタン・投入口） ---
const frontPanelG = grp(machineG, { id: 'frontPanel', class: 'fadeable' });
el('rect', { x: 44, y: 352, width: 332, height: 216, rx: 10, fill: 'url(#gradPanel)' }, frontPanelG);
// 商品ボタン
const buttonEls = PRODUCTS.map((p, i) => {
  const bx = BTN_X[i], by = BTN_Y[i];
  const bg = grp(frontPanelG, { transform: `translate(${bx} ${by})` });
  el('rect', { x: -46, y: -24, width: 92, height: 52, rx: 12, fill: '#00000022' }, bg); // 台座影
  const press = grp(bg);
  el('rect', { x: -46, y: -27, width: 92, height: 52, rx: 12, fill: '#ffffff', stroke: '#c9b998', 'stroke-width': 2 }, press);
  el('rect', { x: -40, y: -21, width: 80, height: 40, rx: 9, fill: p.c1, opacity: 0.92 }, press);
  // 内部照明（点灯可能な樹脂の中身）
  const innerLight = el('ellipse', { cx: 0, cy: 1, rx: 36, ry: 17, fill: 'url(#gradWarmGlow)', opacity: 0 }, press);
  // 樹脂の厚み：下端の暗部・左右のベベル
  el('rect', { x: -40, y: 13, width: 80, height: 6, rx: 3, fill: '#000000', opacity: 0.16 }, press);
  el('rect', { x: -40, y: -21, width: 2.5, height: 40, rx: 1.2, fill: '#ffffff', opacity: 0.4 }, press);
  el('rect', { x: 37.5, y: -21, width: 2.5, height: 40, rx: 1.2, fill: '#000000', opacity: 0.14 }, press);
  // 前面ガラスの湾曲反射
  el('rect', { x: -40, y: -21, width: 80, height: 16, rx: 8, fill: '#ffffff', opacity: 0.45 }, press);
  el('rect', { x: -34, y: 8, width: 68, height: 3, rx: 1.5, fill: '#ffffff', opacity: 0.18 }, press);
  const mini = grp(press, { transform: 'translate(-20 -1) scale(0.42)' });
  buildProduct(p, mini);
  const lamp = el('circle', { cx: 26, cy: -1, r: 7, fill: '#e8e2d2', stroke: '#b8a988', 'stroke-width': 1.5 }, press);
  return { g: bg, press, lamp, innerLight, x: bx, y: by };
});
// 料金表示
el('rect', { x: 62, y: 502, width: 110, height: 58, rx: 10, fill: '#3a3234', stroke: '#241f21', 'stroke-width': 2 }, frontPanelG);
el('circle', { cx: 88, cy: 531, r: 13, fill: 'url(#gradCoin)', stroke: '#8a90a0', 'stroke-width': 1.5 }, frontPanelG);
el('text', { x: 128, y: 540, 'font-size': 24, 'font-weight': 700, fill: '#ffd76e', 'text-anchor': 'middle', 'font-family': 'system-ui, sans-serif' }, frontPanelG).textContent = '100';
const creditLamp = el('circle', { cx: 160, cy: 512, r: 6, fill: '#5a5250' }, frontPanelG);
// 投入口
const slotGlow = el('circle', { cx: SLOT.x, cy: SLOT.y, r: 46, fill: 'url(#gradHint)', opacity: 0, 'pointer-events': 'none' }, frontPanelG);
el('rect', { x: 296, y: 502, width: 62, height: 60, rx: 9, fill: 'url(#gradSlotPlate)', stroke: '#828a99', 'stroke-width': 2 }, frontPanelG);
el('rect', { x: SLOT.x - 5, y: 511, width: 10, height: 42, rx: 4, fill: '#14161c' }, frontPanelG);
el('rect', { x: SLOT.x - 2.5, y: 514, width: 5, height: 36, rx: 2, fill: '#000000' }, frontPanelG);

// --- 取り出し口（常に不透明） ---
const portG = grp(machineG, { id: 'port' });
el('rect', { x: 92, y: 576, width: 236, height: 140, rx: 14, fill: 'url(#gradBezel)', stroke: '#8a7a5c', 'stroke-width': 2 }, portG);
// 取り出し口内部：奥へすぼまる箱（天井・側壁・床・奥壁で奥行きを作る）
el('rect', { x: 108, y: 590, width: 204, height: 114, rx: 10, fill: '#0d0b10' }, portG);
el('polygon', { points: '108,590 312,590 280,602 140,602', fill: '#0a080d' }, portG);           // 天井
el('polygon', { points: '108,590 140,602 140,676 108,704', fill: '#1c1822' }, portG);           // 左壁
el('polygon', { points: '312,590 280,602 280,676 312,704', fill: '#221d27' }, portG);           // 右壁
el('rect', { x: 140, y: 602, width: 140, height: 74, fill: '#151119' }, portG);                 // 奥壁
el('polygon', { points: '108,704 140,676 280,676 312,704', fill: 'url(#gradFloor)' }, portG);   // 床（商品が着地する面）
el('line', { x1: 140, y1: 676, x2: 280, y2: 676, stroke: '#000000', opacity: 0.5, 'stroke-width': 1.5 }, portG); // 床と奥壁の境目
el('line', { x1: 110, y1: 703, x2: 310, y2: 703, stroke: '#55505e', opacity: 0.8, 'stroke-width': 1.5 }, portG); // 手前の縁の拾い光
const portLamp = el('rect', { x: 108, y: 590, width: 204, height: 114, rx: 10, fill: 'url(#gradPortLamp)', opacity: 0 }, portG);
const portProdLayer = grp(portG, { id: 'portProd' });
const flapG = grp(portG, { id: 'flapG' });
el('rect', { x: 112, y: 592, width: 196, height: 108, rx: 9, fill: 'url(#gradFlap)' }, flapG);
// ゴムフラップの厚み：上端の光る縁・下端の厚み・左右の丸み陰影
el('line', { x1: 118, y1: 594.5, x2: 302, y2: 594.5, stroke: '#6f6878', opacity: 0.8, 'stroke-width': 1.8 }, flapG);
el('rect', { x: 112, y: 696, width: 196, height: 4, rx: 2, fill: '#0f0d12' }, flapG);
el('rect', { x: 112, y: 592, width: 6, height: 108, rx: 3, fill: '#000000', opacity: 0.3 }, flapG);
el('rect', { x: 302, y: 592, width: 6, height: 108, rx: 3, fill: '#000000', opacity: 0.3 }, flapG);
for (let i = 1; i <= 3; i++) el('rect', { x: 124, y: 592 + i * 26, width: 172, height: 3.5, rx: 1.75, fill: '#000000', opacity: 0.35 }, flapG);
el('path', { d: 'M178 700 A32 20 0 0 1 242 700 Z', fill: '#141218', transform: 'rotate(180 210 700)' }, flapG);
el('rect', { x: 168, y: 676, width: 84, height: 12, rx: 6, fill: '#5c5664' }, flapG); // 取っ手

// --- キックプレート・看板 ---
el('rect', { x: 44, y: 722, width: 332, height: 26, rx: 6, fill: '#872520' }, machineG);
const signG = grp(machineG);
el('rect', { x: 46, y: 32, width: 328, height: 36, rx: 12, fill: 'url(#gradPanel)' }, signG);
[['#ff8fb5', 110], ['#8fd2f4', 175], ['#ffe066', 240], ['#b48ae8', 305]].forEach(([c, x]) => {
  el('circle', { cx: x, cy: 50, r: 9, fill: c }, signG);
});
el('path', { d: 'M74 44 L78 52 L70 52 Z M70 56 L74 48 L78 56 Z', fill: '#ffb44d' }, signG);

// --- 硬貨トレー＋硬貨 ---
el('ellipse', { cx: TRAY.x, cy: TRAY.y + 14, rx: 82, ry: 24, fill: '#5c6c85' }, worldG);
el('ellipse', { cx: TRAY.x, cy: TRAY.y + 10, rx: 74, ry: 19, fill: '#3c4a60' }, worldG);
const coinG = grp(worldG, { id: 'coin' });
const coinShadow = el('circle', { cx: 3, cy: 9, r: 33, fill: '#000000', opacity: 0.22 }, coinG);
const coinInner = grp(coinG);
// 縁の厚み（下へ2.6pxの円柱側面）とギザ（reeded edge）
el('circle', { cx: 0, cy: 2.6, r: COIN_R, fill: '#767c88' }, coinInner);
el('circle', { cx: 0, cy: 2.6, r: COIN_R - 0.6, fill: 'none', stroke: '#565b66', 'stroke-width': 1.4, 'stroke-dasharray': '1.8 2.4' }, coinInner);
// 上面
el('circle', { cx: 0, cy: 0, r: COIN_R, fill: 'url(#gradCoin)', stroke: '#9aa0ac', 'stroke-width': 1.5 }, coinInner);
// ヘアライン（異方性の弧状シーン）
el('path', { d: 'M-25 -17 A31 31 0 0 1 16 -26', fill: 'none', stroke: '#ffffff', opacity: 0.5, 'stroke-width': 3 }, coinInner);
el('path', { d: 'M23 15 A31 31 0 0 1 -13 27', fill: 'none', stroke: '#6f7580', opacity: 0.4, 'stroke-width': 2.5 }, coinInner);
// 内周の段差（ベベルの明暗ペア）
el('circle', { cx: 0, cy: 0, r: COIN_R - 8, fill: 'none', stroke: '#9aa0ac', 'stroke-width': 1.6 }, coinInner);
el('circle', { cx: 0, cy: 0.9, r: COIN_R - 8, fill: 'none', stroke: '#ffffff', opacity: 0.45, 'stroke-width': 0.9 }, coinInner);
// 「100」の刻印（下側の光で彫りを表現）
el('text', { x: 0, y: 8.9, 'font-size': 22, 'font-weight': 800, fill: '#fbfcfe', 'text-anchor': 'middle', 'font-family': 'system-ui, sans-serif' }, coinInner).textContent = '100';
el('text', { x: 0, y: 8, 'font-size': 22, 'font-weight': 800, fill: '#757b87', 'text-anchor': 'middle', 'font-family': 'system-ui, sans-serif' }, coinInner).textContent = '100';
el('rect', { x: -6, y: -COIN_R, width: 12, height: COIN_R * 2, fill: 'url(#gradShine)', class: 'glint', transform: 'rotate(24)' }, coinInner);
// ワールド座標パーティクル層（カメラと一緒に動く）
const worldFxG = grp(worldG, { id: 'worldFx' });

// ---------------------------------------------------------------
// 音（WebAudio・全部生成音）
// ---------------------------------------------------------------
let AC = null, masterGain = null, motorNodes = null, rollNodes = null, fizzNodes = null;
function ensureAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = AC.createGain(); masterGain.gain.value = 0.85; masterGain.connect(AC.destination);
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}
function env(node, t0, a, peak, d) {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.linearRampToValueAtTime(peak, t0 + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function tone(freq, dur, type, vol, delay, glideTo) {
  if (!AC) return;
  const t0 = AC.currentTime + (delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  env(g, t0, 0.004, vol, dur);
  o.connect(g); g.connect(masterGain);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
let noiseBuf = null;
function getNoise() {
  if (!noiseBuf && AC) {
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 1.2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function noise(dur, vol, freq, type, delay) {
  if (!AC) return;
  const t0 = AC.currentTime + (delay || 0);
  const s = AC.createBufferSource(); s.buffer = getNoise(); s.loop = true;
  const f = AC.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
  const g = AC.createGain(); env(g, t0, 0.004, vol, dur);
  s.connect(f); f.connect(g); g.connect(masterGain);
  s.start(t0); s.stop(t0 + dur + 0.05);
}
const SFX = {
  tick() { tone(1500, 0.04, 'square', 0.07); },
  charin() {
    tone(4200, 0.18, 'triangle', 0.22); tone(5400, 0.22, 'triangle', 0.15, 0.055);
    tone(6800, 0.12, 'sine', 0.1, 0.06); noise(0.05, 0.1, 6000, 'highpass');
  },
  click() { tone(220, 0.05, 'square', 0.22); noise(0.03, 0.16, 3200, 'highpass'); },
  credit() { tone(880, 0.1, 'sine', 0.16); tone(1318, 0.14, 'sine', 0.16, 0.1); },
  koto(v) { const k = clamp(v, 0.1, 1); tone(200, 0.1, 'sine', 0.3 * k, 0, 85); noise(0.04, 0.14 * k, 700); },
  tin() { tone(940, 0.06, 'triangle', 0.12); },
  gatan() {
    tone(140, 0.16, 'sine', 0.5, 0, 55); noise(0.1, 0.32, 500);
    tone(110, 0.14, 'sine', 0.35, 0.07, 48); noise(0.07, 0.2, 400, 'lowpass', 0.07);
  },
  flapThud() { tone(170, 0.08, 'sine', 0.2, 0, 90); },
  gakon() { tone(150, 0.12, 'sine', 0.36, 0, 65); noise(0.06, 0.2, 900); tone(320, 0.05, 'square', 0.1, 0.02); },
  pshh() { noise(0.45, 0.34, 1900, 'highpass'); noise(0.9, 0.1, 3800, 'highpass', 0.12); },
  pon() { tone(420, 0.09, 'sine', 0.32, 0, 940); noise(0.03, 0.12, 2400, 'highpass'); },
  kotori() { tone(300, 0.06, 'sine', 0.14, 0, 180); },
  hop() { tone(250, 0.12, 'triangle', 0.22, 0, 560); },
  turn() { tone(700, 0.04, 'triangle', 0.11); noise(0.02, 0.05, 2600, 'highpass'); },
  jingle() {
    [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.34]].forEach(([f, d]) => tone(f, 0.16, 'triangle', 0.18, d));
    tone(2093, 0.3, 'sine', 0.08, 0.45);
  },
  sparkle() { tone(rnd(1800, 2600), 0.07, 'triangle', 0.07); },
  back() { tone(320, 0.08, 'sine', 0.1, 0, 200); },
};
function motorStart() {
  if (!AC || motorNodes) return;
  const g = AC.createGain(); g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.06, AC.currentTime + 0.15);
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
  const o1 = AC.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 84;
  const o2 = AC.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 111;
  const lfo = AC.createOscillator(); lfo.frequency.value = 19;
  const lg = AC.createGain(); lg.gain.value = 0.02;
  lfo.connect(lg); lg.connect(g.gain);
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(masterGain);
  o1.start(); o2.start(); lfo.start();
  motorNodes = { g, stopAll() { o1.stop(AC.currentTime + 0.3); o2.stop(AC.currentTime + 0.3); lfo.stop(AC.currentTime + 0.3); } };
}
function motorStop() {
  if (!motorNodes) return;
  motorNodes.g.gain.linearRampToValueAtTime(0, AC.currentTime + 0.25);
  motorNodes.stopAll(); motorNodes = null;
}
function rollStart() {
  if (!AC || rollNodes) return;
  const s = AC.createBufferSource(); s.buffer = getNoise(); s.loop = true;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.8;
  const g = AC.createGain(); g.gain.value = 0;
  s.connect(f); f.connect(g); g.connect(masterGain); s.start();
  rollNodes = { s, g, f };
}
function rollSet(v, freq) {
  if (!rollNodes) return;
  rollNodes.g.gain.value = clamp(v, 0, 0.16);
  if (freq) rollNodes.f.frequency.value = clamp(freq, 200, 1400);
}
function rollStop() { if (rollNodes) { rollNodes.s.stop(); rollNodes = null; } }
function fizzStart() {
  if (!AC || fizzNodes) return;
  const s = AC.createBufferSource(); s.buffer = getNoise(); s.loop = true;
  const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4500;
  const g = AC.createGain(); g.gain.value = 0.045;
  s.connect(f); f.connect(g); g.connect(masterGain); s.start();
  fizzNodes = { s, g };
  after(2400, fizzStop);
}
function fizzStop() { if (fizzNodes) { fizzNodes.g.gain.linearRampToValueAtTime(0, AC.currentTime + 0.4); const n = fizzNodes; after(500, () => n.s.stop()); fizzNodes = null; } }

// ---------------------------------------------------------------
// パーティクル
// ---------------------------------------------------------------
const particles = [];
function spawnP(x, y, opt, parent) {
  const o = Object.assign({ vx: 0, vy: 0, g: 0, life: 0.7, r: 3, fill: '#fff', fade: true, shrink: false }, opt);
  const c = el('circle', { cx: x, cy: y, r: o.r, fill: o.fill, 'pointer-events': 'none' }, parent || fxG);
  particles.push({ x, y, el: c, t: 0, ...o });
}
function stepParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    if (p.t >= p.life) { p.el.remove(); particles.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const k = 1 - p.t / p.life;
    p.el.setAttribute('cx', p.x); p.el.setAttribute('cy', p.y);
    if (p.fade) p.el.setAttribute('opacity', k);
    if (p.shrink) p.el.setAttribute('r', p.r * k);
  }
}
function burstStars(x, y, n, spread) {
  const colors = ['#fff3b0', '#ffd23e', '#ffffff', '#ffb0d0', '#b0e8ff'];
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), sp = rnd(40, spread || 200);
    spawnP(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 260, life: rnd(0.5, 1.0), r: rnd(2.5, 5), fill: colors[i % colors.length], shrink: true });
  }
}

// ---------------------------------------------------------------
// カメラ
// ---------------------------------------------------------------
const cam = { x: 210, y: 420, s: 1, tx: 210, ty: 420, ts: 1 };
function camTo(x, y, s) { cam.tx = x; cam.ty = y; cam.ts = s; }
function stepCam(dt) {
  const k = 1 - Math.pow(0.0028, dt); // 約 0.095/フレーム @60fps
  cam.x = lerp(cam.x, cam.tx, k); cam.y = lerp(cam.y, cam.ty, k); cam.s = lerp(cam.s, cam.ts, k);
  camG.setAttribute('transform', `translate(${210 - cam.s * cam.x} ${420 - cam.s * cam.y}) scale(${cam.s})`);
}
function worldToView(x, y) { return { x: 210 + cam.s * (x - cam.x), y: 420 + cam.s * (y - cam.y) }; }

// ---------------------------------------------------------------
// 状態
// ---------------------------------------------------------------
let S = 'READY';
function setState(s) { S = s; lastInteract = performance.now(); }
let lastInteract = performance.now();
let forceHintUntil = 0;
let selected = -1;
let coinPos = { x: TRAY.x, y: TRAY.y };
let coinVisible = true;
let coinHeld = false, coinScale = 1, coinVisOffY = 0, coinGen = 0;
let itemHeld = false;
let railTheta = RAIL_B.base;   // 度
let railTargetBase = RAIL_B.base;
let railHeld = false;
let railTouchedThisRound = false;
let railYOff = 0;              // レールの上下オフセット（px）
let railOmega = 0, railVy = 0; // 角速度（度/s）・上下速度（px/s）
let railPrevTheta = RAIL_B.base, railPrevYOff = 0;
let railGrabY = 0, railGrabYOff = 0;
let hopCd = 0;                 // ポンッのクールダウン
let flapK = 1;                  // 1=閉 0.1=開
let flapJit = 0;                // 商品接近時の微振動
let flapLatched = false;
let itemPos = { x: PORT_C.x, y: PORT_C.y };
let variation = {};

// 転がる商品（物理）
// phase: none | tip | ballistic | rail | chutefall | done
const prod = { phase: 'none', seg: null, s: 0, v: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, squash: 0, el: null, timeOnB: 0, rollT: 0 };

function segFor(name) {
  if (name === 'A') return { x1: RAIL_A.x1, y1: RAIL_A.y1, x2: RAIL_A.x2, y2: RAIL_A.y2, m1: 0, m2: 0, name };
  if (name === 'B') {
    const th = railTheta * Math.PI / 180;
    const cy = RAIL_B.cy + railYOff;
    return {
      x1: RAIL_B.cx - RAIL_B.half * Math.cos(th), y1: cy - RAIL_B.half * Math.sin(th),
      x2: RAIL_B.cx + RAIL_B.half * Math.cos(th), y2: cy + RAIL_B.half * Math.sin(th),
      m1: 26, m2: 26, name
    };
  }
  if (name === 'FL') return { ...FUN_L, name };
  if (name === 'FR') return { ...FUN_R, name };
}
const SEG_NAMES = ['A', 'B', 'FL', 'FR'];
function segGeom(seg) {
  const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
  const len = Math.hypot(dx, dy);
  return { len, cos: dx / len, sin: dy / len };
}

// ---------------------------------------------------------------
// 座標変換（入力）
// ---------------------------------------------------------------
const _pt = svg.createSVGPoint();
function toWorld(e) {
  _pt.x = e.clientX; _pt.y = e.clientY;
  return _pt.matrixTransform(camG.getScreenCTM().inverse());
}
function toView(e) {
  _pt.x = e.clientX; _pt.y = e.clientY;
  return _pt.matrixTransform(svg.getScreenCTM().inverse());
}

// ---------------------------------------------------------------
// カットアウェイ（透明化）
// ---------------------------------------------------------------
function cutaway(on) {
  interiorG.style.opacity = on ? 1 : 0;
  paneG.style.opacity = on ? 1 : 0;
  // 前面は「色つきガラス」程度まで薄く（内部が白っぽく濁らないように）
  frontGlassG.style.opacity = on ? 0.1 : 1;
  frontPanelG.style.opacity = on ? 0.15 : 1;
  if (on) { fanG.classList.add('spin'); lightSweep(); }
  else fanG.classList.remove('spin');
}
// 透明化の瞬間に走る光のスイープ（「透けた！」の合図）
function lightSweep() {
  const g = el('rect', { x: 0, y: 20, width: 70, height: 740, fill: 'url(#gradShine)', opacity: 0.75, 'pointer-events': 'none' }, machineG);
  tween(420, k => g.setAttribute('transform', `translate(${-90 + k * 460} 0) skewX(-12)`), () => g.remove());
}

// ---------------------------------------------------------------
// 硬貨
// ---------------------------------------------------------------
function renderCoin() {
  coinG.setAttribute('transform', `translate(${coinPos.x} ${coinPos.y + coinVisOffY}) scale(${coinScale})`);
  coinG.style.display = coinVisible ? '' : 'none';
}
function insertCoin() {
  setState('COIN_INSERTING');
  coinGen++;
  SFX.tick();
  slotGlow.setAttribute('opacity', 0);
  const from = { ...coinPos };
  // 投入口の上へ滑り、縦になって吸い込まれる（ワープさせない・短く）
  tween(150, k => {
    coinPos.x = lerp(from.x, SLOT.x, k);
    coinPos.y = lerp(from.y, SLOT.y - 26, k);
    renderCoin();
  }, () => {
    tween(210, k => {
      coinInner.setAttribute('transform', `scale(${lerp(1, 0.1, k)} 1)`);
      coinPos.y = lerp(SLOT.y - 26, SLOT.y + 8, easeInQuad(k));
      renderCoin();
    }, () => {
      coinVisible = false; renderCoin();
      coinInner.setAttribute('transform', '');
      SFX.charin();
      after(110, () => {
        SFX.credit();
        creditLamp.setAttribute('fill', 'url(#gradLampOn)');
        buttonEls.forEach(b => { b.lamp.classList.add('lampArmed'); b.innerLight.classList.add('btnArmed'); });
        setState('CREDIT_READY');
      });
    }, easeInQuad);
  });
}
function coinSpringBack() {
  const from = { ...coinPos };
  coinGen++;
  const gen = coinGen;
  SFX.back();
  tween(380, k => {
    if (gen !== coinGen) return; // つかみ直されたら中断
    coinPos.x = lerp(from.x, TRAY.x, k);
    coinPos.y = lerp(from.y, TRAY.y, k);
    renderCoin();
  }, null, easeOutBack);
}
function coinRespawn() {
  // 論理位置は即トレーへ（すぐつかみ直せる）。見た目だけ上から落ちて弾む
  coinGen++;
  const gen = coinGen;
  coinPos = { x: TRAY.x, y: TRAY.y };
  coinVisOffY = -64;
  coinVisible = true; renderCoin();
  tween(340, k => {
    if (gen !== coinGen) return;
    coinVisOffY = -64 * (1 - k);
    renderCoin();
  }, () => {
    if (gen !== coinGen) return;
    coinVisOffY = 0;
    SFX.tick(); burstStars(TRAY.x, TRAY.y - 20, 5, 90);
  }, easeOutBack);
}

// ---------------------------------------------------------------
// 購入シーケンス
// ---------------------------------------------------------------
function pressButton(i) {
  if (S !== 'CREDIT_READY') return;
  selected = i;
  const b = buttonEls[i];
  // 同フレームで：沈む・光る・鳴る・モーター始動・透明化・商品が動き出す
  b.press.setAttribute('transform', 'translate(0 4)');
  b.lamp.setAttribute('fill', 'url(#gradLampOn)');
  SFX.click();
  after(200, () => tween(140, k => b.press.setAttribute('transform', `translate(0 ${4 * (1 - k)})`)));
  buttonEls.forEach(bb => { bb.lamp.classList.remove('lampArmed'); bb.innerLight.classList.remove('btnArmed'); bb.innerLight.setAttribute('opacity', 0); });
  b.innerLight.setAttribute('opacity', 0.95);
  creditLamp.setAttribute('fill', '#5a5250');
  motorStart();
  rollStart();
  cutaway(true);
  // 選ばれた見本そのものが動き出す
  const col = COLS[i % 3], shelf = SHELF_Y[i < 3 ? 0 : 1];
  sampleEls[i].style.opacity = 0;
  rollLayer.innerHTML = '';
  // 商品に追従する暖色スポットライト
  prod.glowEl = el('circle', { r: 58, fill: 'url(#gradWarmGlow)', opacity: 0, 'pointer-events': 'none' }, rollLayer);
  // 傾いて商品を送り出す棚板
  prod.platG = grp(rollLayer);
  el('rect', { x: col - 40, y: shelf - 2, width: 80, height: 5, rx: 2.5, fill: '#7e8798', stroke: '#3a3f4a', 'stroke-width': 1 }, prod.platG);
  el('circle', { cx: col - 32, cy: shelf, r: 3.5, fill: '#c8d0dc', stroke: '#5a616e', 'stroke-width': 1 }, prod.platG);
  // 接地影（レールとの接触位置を示す）
  prod.shadowEl = el('ellipse', { rx: 21, ry: 4.2, fill: '#000000', opacity: 0, 'pointer-events': 'none' }, rollLayer);
  prod.el = grp(rollLayer);
  buildProduct(PRODUCTS[i], prod.el);
  prod.x = col; prod.y = shelf; prod.vx = 0; prod.vy = 0; prod.rot = 0; prod.wob = 0; prod.squash = 0;
  prod.phase = 'tip'; prod.tipT = 0; prod.rollT = 0; prod.timeOnB = 0; prod.pauseT = 0;
  prod.col = col; prod.shelfY = shelf; prod.glowO = 0; prod.shadowO = 0; prod.trailT = 0;
  prod.autoT = 0; prod.vSign = 0; prod.spinBoost = 0; prod.wasHop = false; hopCd = 0;
  railYOff = 0; railPrevYOff = 0; railPrevTheta = RAIL_B.base;
  // 「これが動くよ」の商品色リング
  const ring = el('circle', { cx: col, cy: shelf - 38, r: 24, fill: 'none', stroke: PRODUCTS[i].c1, 'stroke-width': 4, opacity: 0.9, 'pointer-events': 'none' }, rollLayer);
  tween(420, k => { ring.setAttribute('r', 24 + 46 * k); ring.setAttribute('opacity', 0.9 * (1 - k)); }, () => ring.remove());
  railTouchedThisRound = false;
  railTheta = RAIL_B.base; railTargetBase = RAIL_B.base;
  // 今回のマイクロバリエーション
  variation = {
    damp: rnd(0.25, 0.5),          // 転がり抵抗
    wallRest: rnd(0.45, 0.62),     // 壁の反発
    pauseOnA: Math.random() < 0.16, // まれに一瞬止まる（ぐらつき付き）
    sparkleRoll: Math.random() < 0.14,
  };
  renderProd();
  setState('ROLLING');
}

function renderProd() {
  if (!prod.el) return;
  const sq = 1 - prod.squash * 0.22;
  prod.el.setAttribute('transform',
    `translate(${prod.x} ${prod.y - PROD_R}) rotate(${prod.rot + (prod.wob || 0)}) scale(${1 + prod.squash * 0.12} ${sq})`);
  if (prod.glowEl) {
    prod.glowEl.setAttribute('cx', prod.x); prod.glowEl.setAttribute('cy', prod.y - PROD_R);
    prod.glowEl.setAttribute('opacity', prod.glowO || 0);
  }
  if (prod.shadowEl) {
    prod.shadowEl.setAttribute('cx', prod.x); prod.shadowEl.setAttribute('cy', prod.y + 2);
    prod.shadowEl.setAttribute('opacity', prod.shadowO || 0);
  }
}

function landOn(seg, vAlong, impact) {
  const g = segGeom(seg);
  prod.phase = 'rail'; prod.seg = seg.name;
  // s を現在位置から求める
  const t = ((prod.x - seg.x1) * (seg.x2 - seg.x1) + (prod.y - seg.y1) * (seg.y2 - seg.y1)) / (g.len * g.len);
  prod.s = clamp(t, 0, 1) * g.len;
  prod.v = vAlong;
  prod.squash = clamp(impact / 400, 0.15, 0.8);
  SFX.koto(impact / 320);
  setRailLit(seg.name);
  // ポンッからの着地はごほうびのきらめき
  if (prod.wasHop) {
    prod.wasHop = false; prod.spinBoost = 0;
    SFX.sparkle();
    for (let i = 0; i < 5; i++) {
      spawnPWorld(prod.x + rnd(-14, 14), prod.y - rnd(0, 30), { vx: rnd(-40, 40), vy: rnd(-90, -30), g: 220, life: rnd(0.35, 0.6), r: rnd(2, 3.6), fill: i % 2 ? '#fff3b0' : '#ffd23e', shrink: true });
    }
  }
  if (seg.name === 'B') prod.timeOnB = 0;
  if (seg.name === 'A') {
    prod.v += 55; // 着地の勢いで転がり出す（間延び防止）
    if (variation.pauseOnA) { prod.v = 0; prod.pauseT = 0.38; SFX.kotori(); }
  }
}

function stepProd(dt) {
  if (prod.phase === 'none' || prod.phase === 'done') return;
  prod.rollT += dt;
  prod.squash = Math.max(0, prod.squash - dt * 4);

  // スポットライトのフェードインと接地影（接触＝濃い／空中＝薄い）
  prod.glowO = Math.min(0.55, (prod.glowO || 0) + dt * 2.5);
  const shTarget = (prod.phase === 'rail' || prod.phase === 'tip') ? 0.32 : 0.07;
  prod.shadowO = (prod.shadowO || 0) + (shTarget - (prod.shadowO || 0)) * Math.min(1, 12 * dt);

  // 速いときだけ残像トレイル（運動の連続性）
  const spd = prod.phase === 'rail' ? Math.abs(prod.v) : Math.hypot(prod.vx || 0, prod.vy || 0);
  prod.trailT = (prod.trailT || 0) + dt;
  if (spd > 130 && prod.trailT > 0.055) {
    prod.trailT = 0;
    spawnPWorld(prod.x, prod.y - PROD_R, { life: 0.28, r: 5, fill: PRODUCTS[selected].c1, shrink: true });
  }

  // 保険：放置が長引いたら確実に届ける（遊んでいる最中は奪わない）
  prod.autoT = (prod.autoT || 0) + (railHeld ? 0 : dt);
  hopCd = Math.max(0, hopCd - dt);
  if ((prod.autoT > 11 || prod.rollT > 25) && prod.phase !== 'chutefall' && prod.phase !== 'done') {
    prod.phase = 'chutefall'; prod.x = 210; prod.y = 575; prod.vx = 0; prod.vy = 60;
    setRailLit(null);
  }

  if (prod.phase === 'tip') {
    // 棚板が傾き、商品がその上を滑って離脱する（連続した一つの運動）
    prod.tipT += dt;
    const k = clamp(prod.tipT / 0.36, 0, 1);
    const ang = 20 * easeInQuad(k);
    const rad = ang * Math.PI / 180;
    const px = prod.col - 32, py = prod.shelfY;
    const d = 32 + 26 * k * k;
    prod.x = px + Math.cos(rad) * d;
    prod.y = py + Math.sin(rad) * d;
    prod.rot = ang * 0.9;
    prod.wob = Math.sin(prod.tipT * 46) * 2.2 * (1 - k);
    if (prod.platG) prod.platG.setAttribute('transform', `rotate(${ang} ${px} ${py})`);
    if (k >= 1) {
      prod.phase = 'ballistic'; prod.wob = 0;
      prod.vx = Math.cos(rad) * 165; prod.vy = Math.sin(rad) * 165;
      SFX.kotori();
      const plat = prod.platG;
      if (plat) tween(360, kk => plat.setAttribute('transform', `rotate(${20 * (1 - kk)} ${px} ${py})`), null, easeOutBack);
    }
  } else if (prod.phase === 'ballistic' || prod.phase === 'chutefall') {
    prod.wob = (prod.wob || 0) * Math.max(0, 1 - 10 * dt);
    prod.skipT = Math.max(0, (prod.skipT || 0) - dt);
    const prevY = prod.y;
    prod.vy = Math.min(prod.vy + GRAV * dt, 620);
    prod.vx = clamp(prod.vx, -330, 330);
    prod.x += prod.vx * dt; prod.y += prod.vy * dt;
    prod.rot += prod.vx * dt * 1.4;
    // ポンッの後の「くるっ」
    if (prod.spinBoost) {
      prod.rot += prod.spinBoost * dt;
      prod.spinBoost *= Math.max(0, 1 - 2.2 * dt);
      if (Math.abs(prod.spinBoost) < 30) prod.spinBoost = 0;
    }
    // 内壁
    if (prod.y > 350 && prod.y < 600) {
      if (prod.x < WALL_L) { prod.x = WALL_L; prod.vx = Math.abs(prod.vx) * variation.wallRest; SFX.tin(); }
      if (prod.x > WALL_R) { prod.x = WALL_R; prod.vx = -Math.abs(prod.vx) * variation.wallRest; SFX.tin(); }
    }
    if (prod.phase === 'chutefall') {
      // 取り出し口へ吸い込まれる補正
      prod.vx *= Math.max(0, 1 - 3 * dt);
      prod.x += (210 - prod.x) * 2.6 * dt;
      // 期待の高まり：取り出し口が温かく灯り、フラップがかすかに震える
      portLamp.setAttribute('opacity', Math.min(0.4, (+portLamp.getAttribute('opacity') || 0) + dt * 1.4));
      flapJit = Math.sin(prod.rollT * 46) * 1.5;
      renderFlap();
      if (prod.y >= BIN_Y) arrive();
      renderProd();
      return;
    }
    // レールへの着地判定
    if (prod.vy > 0) {
      for (const name of SEG_NAMES) {
        if (prod.skipT > 0 && name === prod.skipSeg) continue; // 離脱直後のレールへ再着地しない
        const seg = segFor(name);
        // m1/m2 は端ごとの許容はみ出し幅（壁側のみ広め）
        let lo, hi;
        if (seg.x1 <= seg.x2) { lo = seg.x1 - seg.m1; hi = seg.x2 + seg.m2; }
        else { lo = seg.x2 - seg.m2; hi = seg.x1 + seg.m1; }
        if (prod.x < lo || prod.x > hi) continue;
        const t = clamp((prod.x - seg.x1) / ((seg.x2 - seg.x1) || 1e-6), 0, 1);
        const ly = seg.y1 + (seg.y2 - seg.y1) * t;
        if (prevY <= ly + 3 && prod.y >= ly) {
          const g = segGeom(seg);
          prod.x = seg.x1 + (seg.x2 - seg.x1) * t;
          prod.y = ly;
          landOn(seg, prod.vx * g.cos + prod.vy * g.sin, prod.vy);
          renderProd();
          return;
        }
      }
    }
    // 漏斗のすき間より下 → シュート落下
    if (prod.y > 570) { prod.phase = 'chutefall'; }
  } else if (prod.phase === 'rail') {
    const seg = segFor(prod.seg);
    const g = segGeom(seg);
    // 上への素早いフリックで缶が「ポンッ」と跳ねる
    if (prod.seg === 'B' && railHeld && railVy < -150 && hopCd <= 0) {
      prod.phase = 'ballistic';
      prod.vx = clamp(prod.v * g.cos + railOmega * 0.2, -300, 300);
      prod.vy = clamp(-150 + railVy * 0.3, -240, -110);
      prod.skipSeg = 'B'; prod.skipT = 0.14;
      prod.spinBoost = (prod.v >= 0 ? 1 : -1) * rnd(400, 560);
      prod.wasHop = true; hopCd = 0.55;
      SFX.hop();
      setRailLit(null);
      renderProd();
      return;
    }
    if (prod.pauseT > 0) {
      prod.pauseT -= dt;
      // 引っかかって「ぐらぐら」している（意味のある静止として見せる）
      prod.wob = Math.sin(prod.rollT * 32) * 3.5;
      if (prod.pauseT <= 0) { prod.wob = 0; SFX.kotori(); }
    } else {
      prod.wob = (prod.wob || 0) * Math.max(0, 1 - 10 * dt);
      let a = GRAV * g.sin;
      if (prod.seg === 'B') {
        // 傾ける動作そのものが缶を押す（指の動きが即、缶に伝わる）
        prod.v += railOmega * 4.5 * dt;
        // 方向転換の「クッ」という合図
        const sgn = prod.v > 25 ? 1 : (prod.v < -25 ? -1 : 0);
        if (sgn && prod.vSign && sgn !== prod.vSign) {
          SFX.turn();
          prod.squash = Math.max(prod.squash, 0.2);
          spawnPWorld(prod.x, prod.y, { vy: -45, life: 0.3, r: 2.6, fill: '#cfd8e4', shrink: true });
        }
        if (sgn) prod.vSign = sgn;
        // 「届けたい」補正（触っていない時だけ強く働く）
        prod.timeOnB += dt;
        if (prod.timeOnB > 4 && !railHeld) a += (prod.s > g.len / 2 ? 70 : -70);
        if (prod.timeOnB > 7 && !railHeld) a += (prod.s > g.len / 2 ? 190 : -190);
        if (prod.timeOnB > 10 && railHeld) a += (prod.s > g.len / 2 ? 120 : -120);
      }
      prod.v += a * dt;
      prod.v *= Math.max(0, 1 - variation.damp * dt);
      prod.v = clamp(prod.v, -270, 270);
    }
    prod.s += prod.v * dt;
    prod.rot += (prod.v / PROD_R) * dt * 57.3;
    if (prod.s < 0 || prod.s > g.len) {
      // 端から落ちる
      const end = prod.s < 0 ? { x: seg.x1, y: seg.y1 } : { x: seg.x2, y: seg.y2 };
      prod.x = end.x; prod.y = end.y;
      prod.vx = prod.v * g.cos; prod.vy = Math.max(prod.v * g.sin, 20);
      prod.phase = 'ballistic';
      prod.skipSeg = prod.seg; prod.skipT = 0.3;
      setRailLit(null);
      // 漏斗のすき間へ落ちた場合
      if ((prod.seg === 'FL' && prod.s > g.len) || (prod.seg === 'FR' && prod.s < 0)) {
        prod.phase = 'chutefall';
      }
    } else {
      const t = prod.s / g.len;
      prod.x = seg.x1 + (seg.x2 - seg.x1) * t;
      prod.y = seg.y1 + (seg.y2 - seg.y1) * t;
      if (variation.sparkleRoll && Math.random() < dt * 1.2) {
        spawnPWorld(prod.x + rnd(-10, 10), prod.y - 40, { vy: -30, life: 0.4, r: 2.5, fill: '#ffffff', shrink: true });
        SFX.sparkle();
      }
    }
    // 転がり音：速度とレール角度で音程・音量が変わる
    rollSet(Math.abs(prod.v) / 1400, 300 + Math.abs(prod.v) * 0.9 + Math.abs(railTheta) * 8);
    renderProd();
    return;
  }
  rollSet(0);
  renderProd();
}

function spawnPWorld(wx, wy, opt) {
  // ワールド座標のまま生成（カメラが動いても位置がずれない）
  spawnP(wx, wy, opt, worldFxG);
}

function arrive() {
  prod.phase = 'done';
  rollStop(); motorStop();
  SFX.gatan();
  machineG.classList.remove('shake'); void machineG.getBoundingClientRect(); machineG.classList.add('shake');
  after(320, () => machineG.classList.remove('shake'));
  // 内部演出をすべて片付け、運動をガタンに収束させる
  rollLayer.innerHTML = '';
  prod.el = null; prod.glowEl = null; prod.shadowEl = null; prod.platG = null;
  setRailLit(null);
  flapJit = 0;
  portLamp.setAttribute('opacity', 0.18);
  itemPos = { x: PORT_C.x, y: PORT_C.y };
  portItemEl = grp(portProdLayer);
  buildProduct(PRODUCTS[selected], portItemEl);
  renderPortItem(0.55); // 暗がりの中
  // フラップがコツンと揺れ、取り出し口自体も一瞬沈む
  tween(200, k => { flapK = 1 - Math.sin(k * Math.PI) * 0.07; renderFlap(); });
  tween(170, k => { portG.setAttribute('transform', `translate(0 ${3.5 * Math.sin(k * Math.PI)})`); },
    () => portG.setAttribute('transform', ''));
  // 衝撃の小さなほこり
  for (let i = 0; i < 6; i++) {
    spawnPWorld(PORT_C.x + rnd(-60, 60), 702, { vx: rnd(-30, 30), vy: rnd(-70, -30), g: 200, life: rnd(0.3, 0.55), r: rnd(2, 3.5), fill: '#cfc8ba', shrink: true });
  }
  cutaway(false);
  setState('ARRIVED');
}

let portItemEl = null;
function renderPortItem(bright) {
  if (!portItemEl) return;
  portItemEl.setAttribute('transform', `translate(${itemPos.x} ${itemPos.y - 34}) scale(${itemHeld ? 1.04 : 0.95})`);
  portItemEl.setAttribute('opacity', bright == null ? 1 : bright);
}
function renderFlap() {
  flapG.setAttribute('transform', `translate(0 ${592 * (1 - flapK) + flapJit}) scale(1 ${flapK})`);
}
function latchFlap() {
  if (flapLatched) return;
  flapLatched = true;
  SFX.gakon();
  tween(180, k => { flapK = lerp(flapK, 0.1, k); renderFlap(); });
  portLamp.setAttribute('opacity', 0.75);
  if (portItemEl) renderPortItem(1);
  setState('FLAP_OPEN');
}

// ---------------------------------------------------------------
// 取り出し → 開封シーン
// ---------------------------------------------------------------
let openItemG = null, openParts = null, tabHintPos = { x: 210, y: 300 };
function startTakeout() {
  setState('ITEM_OUT');
  itemHeld = false;
  const from = { ...itemPos };
  const fromV = worldToView(from.x, from.y - 34);
  if (portItemEl) { portItemEl.remove(); portItemEl = null; }
  portLamp.setAttribute('opacity', 0);
  camTo(210, 420, 1);
  // 開封シーン構築
  openSceneG.innerHTML = '';
  openSceneG.style.display = '';
  const dim = el('rect', { x: 0, y: 0, width: 420, height: 840, fill: '#1a2233', opacity: 0 }, openSceneG);
  el('circle', { cx: 210, cy: 400, r: 165, fill: 'url(#gradGlow)', opacity: 0.35 }, openSceneG);
  openItemG = grp(openSceneG);
  const p = PRODUCTS[selected];
  const inner = grp(openItemG);
  buildProduct(p, inner);
  openParts = buildOpenables(p, inner);
  const target = { x: 210, y: 415, s: 3.1 };
  tween(420, k => {
    dim.setAttribute('opacity', k * 0.5);
    const x = lerp(fromV.x, target.x, k), y = lerp(fromV.y, target.y, k), s = lerp(1, target.s, k);
    openItemG.setAttribute('transform', `translate(${x} ${y}) scale(${s})`);
  }, () => {
    tabHintPos = p.type === 'can' ? { x: 210, y: 415 - 30 * 3.1 } : { x: 210, y: 415 - 38 * 3.1 };
    setState('OPENING');
  });
  SFX.tick();
  burstStars(fromV.x, fromV.y, 6, 120);
}

// 缶のプルタブ / ボトルのキャップ（開封シーン用の上書きパーツ）
function buildOpenables(p, inner) {
  if (p.type === 'can') {
    const tg = grp(inner, { transform: 'translate(0 -30)' });
    // スコアライン（開く部分の刻印）
    el('ellipse', { cx: 0, cy: -3.4, rx: 5.2, ry: 2.5, fill: 'none', stroke: '#8a92a0', 'stroke-width': 0.8, opacity: 0.8 }, tg);
    const rot = grp(tg);
    // タブ本体プレート＋厚みのあるリング＋リベット
    el('rect', { x: -3.6, y: -4.8, width: 7.2, height: 7, rx: 2.2, fill: 'url(#gradTab)', stroke: '#7b8290', 'stroke-width': 0.9 }, rot);
    el('ellipse', { cx: 0, cy: 2.2, rx: 7, ry: 3.6, fill: 'none', stroke: '#7b8290', 'stroke-width': 2.6 }, rot);
    el('ellipse', { cx: 0, cy: 1.9, rx: 7, ry: 3.6, fill: 'none', stroke: '#e8edf3', 'stroke-width': 1 }, rot);
    el('circle', { cx: 0, cy: -2.6, r: 1.7, fill: '#b8c0cc', stroke: '#7b8290', 'stroke-width': 0.7 }, rot);
    el('circle', { cx: -0.5, cy: -3.1, r: 0.5, fill: '#ffffff', opacity: 0.8 }, rot);
    const hole = el('ellipse', { cx: 0, cy: -3.4, rx: 5, ry: 2.4, fill: '#14161c', opacity: 0 }, tg);
    return { kind: 'can', rot, hole, tg };
  } else {
    const capG = grp(inner);
    el('rect', { x: -11, y: -43, width: 22, height: 11, rx: 3, fill: p.lid }, capG);
    for (const kx of [-7, -3.5, 0, 3.5, 7]) el('line', { x1: kx, y1: -42.2, x2: kx, y2: -33.4, stroke: '#000000', opacity: 0.22, 'stroke-width': 1 }, capG);
    el('rect', { x: -9.5, y: -43.4, width: 19, height: 2.2, rx: 1.1, fill: '#ffffff', opacity: 0.4 }, capG);
    // ねじ山付きの口（キャップが飛んだ後に見える）
    const neck = grp(capG, { opacity: 0 });
    el('rect', { x: -7, y: -37, width: 14, height: 6, rx: 2, fill: '#e8e2d0' }, neck);
    el('path', { d: 'M-6.5 -35.6 H6.5 M-6.5 -33.6 H6.5', stroke: '#b8ac8e', 'stroke-width': 1 }, neck);
    return { kind: 'cap', capG, neck };
  }
}

let tabPull = 0, opened = false;
function doOpen() {
  if (opened) return;
  opened = true;
  setState('OPEN_ANIM');
  const v = tabHintPos;
  if (openParts.kind === 'can') {
    SFX.pshh(); fizzStart();
    tween(220, k => {
      openParts.rot.setAttribute('transform', `rotate(${-70 * k} 0 3)`);
      openParts.hole.setAttribute('opacity', k);
    });
    // 泡としぶき
    for (let i = 0; i < 16; i++) {
      after(i * 90, () => spawnP(v.x + rnd(-16, 16), v.y, { vx: rnd(-25, 25), vy: rnd(-130, -60), g: 90, life: rnd(0.5, 1.0), r: rnd(1.8, 4), fill: '#eafaff', shrink: true }));
    }
    for (let i = 0; i < 8; i++) spawnP(v.x, v.y, { vx: rnd(-90, 90), vy: rnd(-190, -90), g: 480, life: 0.7, r: rnd(2, 3.5), fill: '#cdeefd' });
  } else {
    SFX.pon();
    // キャップが飛ぶ
    const cap = openParts.capG;
    let t = 0, cx = 0, cy = 0, cvx = rnd(30, 55), cvy = -260, crot = 0;
    openParts.neck.setAttribute('opacity', 1);
    const fly = setInterval(() => {
      t += 1 / 60; cvy += 600 / 60; cx += cvx / 60; cy += cvy / 60; crot += 9;
      cap.setAttribute('transform', `translate(${cx} ${cy}) rotate(${crot} 0 -38)`);
      if (t > 0.9) { clearInterval(fly); cap.setAttribute('opacity', 0); }
    }, 1000 / 60);
    timers.push(fly);
    for (let i = 0; i < 10; i++) spawnP(v.x, v.y, { vx: rnd(-70, 70), vy: rnd(-170, -70), g: 420, life: 0.7, r: rnd(2, 4), fill: '#dff2ff' });
  }
  after(520, () => {
    setState('COMPLETE');
    SFX.jingle();
    burstStars(210, 380, 18, 240);
    // うれしい弾み
    tween(600, k => {
      const b = Math.sin(k * Math.PI * 2) * (1 - k) * 0.08;
      openItemG.setAttribute('transform', `translate(210 ${415 - Math.sin(k * Math.PI * 2) * (1 - k) * 26}) scale(${3.1 * (1 + b)} ${3.1 * (1 - b)})`);
    });
    after(1050, startReset); // タップで即スキップも可能
  });
}

function startReset() {
  if (S !== 'COMPLETE') return;
  setState('RESETTING');
  fizzStop();
  tween(280, k => {
    openSceneG.setAttribute('opacity', 1 - k);
    if (openItemG) openItemG.setAttribute('transform', `translate(210 ${415 - k * 130}) scale(${3.1 * (1 - k * 0.5)})`);
  }, () => {
    openSceneG.style.display = 'none';
    openSceneG.setAttribute('opacity', 1);
    openSceneG.innerHTML = '';
    openItemG = null; openParts = null; opened = false; tabPull = 0;
    // 機械を元に戻す
    if (selected >= 0) sampleEls[selected].style.opacity = 1;
    buttonEls.forEach(b => { b.press.setAttribute('transform', ''); b.lamp.setAttribute('fill', '#e8e2d2'); b.innerLight.setAttribute('opacity', 0); });
    flapK = 1; flapLatched = false; flapJit = 0; renderFlap();
    portLamp.setAttribute('opacity', 0);
    rollLayer.innerHTML = '';
    setRailLit(null);
    railTheta = RAIL_B.base;
    selected = -1;
    coinRespawn();
    camTo(210, 420, 1);
    setState('READY');
  });
}

// ---------------------------------------------------------------
// 入力
// ---------------------------------------------------------------
let activePointer = null, dragging = null;
let grabOff = { x: 0, y: 0 }, railGrabX = 0, railGrabTheta = 0, flapStartY = 0, flapStartK = 1, tabStartY = 0, itemGrabOff = { x: 0, y: 0 };

// どこに触れても波紋が出る（「無反応」を作らない）
function ripple(vx, vy) {
  const c = el('circle', { cx: vx, cy: vy, r: 10, fill: 'none', stroke: '#ffffff', 'stroke-width': 3, opacity: 0.5, 'pointer-events': 'none' }, fxG);
  tween(340, k => { c.setAttribute('r', 10 + 38 * k); c.setAttribute('opacity', 0.5 * (1 - k)); }, () => c.remove());
}

function grab(e, kind) {
  activePointer = e.pointerId; dragging = kind;
  SFX.tick();
  try { svg.setPointerCapture(e.pointerId); } catch (err) {}
}

svg.addEventListener('pointerdown', e => {
  ensureAudio();
  lastInteract = performance.now();
  if (activePointer !== null) return;
  e.preventDefault();
  const w = toWorld(e);
  const v = toView(e);
  ripple(v.x, v.y);
  let handled = false;
  if (S === 'READY') {
    if (coinVisible && dist(w.x, w.y, coinPos.x, coinPos.y) < 62) {
      grab(e, 'coin');
      grabOff = { x: coinPos.x - w.x, y: coinPos.y - w.y };
      coinHeld = true; coinGen++; coinVisOffY = 0;
      handled = true;
    }
  } else if (S === 'CREDIT_READY') {
    for (let i = 0; i < buttonEls.length; i++) {
      const b = buttonEls[i];
      if (Math.abs(w.x - b.x) < 50 && Math.abs(w.y - b.y) < 32) { pressButton(i); handled = true; break; }
    }
  } else if (S === 'ROLLING') {
    if (w.x > 56 && w.x < 364 && w.y > 405 && w.y < 545) {
      grab(e, 'rail');
      railGrabX = w.x; railGrabTheta = railTheta;
      railGrabY = w.y; railGrabYOff = railYOff;
      railHeld = true; railTouchedThisRound = true;
      railGlowRect.setAttribute('opacity', 0.5);
      handled = true;
    }
  } else if (S === 'ARRIVED') {
    if (w.x > 100 && w.x < 320 && w.y > 575 && w.y < 720) {
      grab(e, 'flap');
      flapStartY = w.y; flapStartK = flapK;
      handled = true;
    }
  } else if (S === 'FLAP_OPEN') {
    if (dist(w.x, w.y, itemPos.x, itemPos.y - 20) < 80) {
      grab(e, 'item');
      itemGrabOff = { x: itemPos.x - w.x, y: itemPos.y - w.y };
      itemHeld = true; renderPortItem(1);
      handled = true;
    }
  } else if (S === 'OPENING') {
    if (dist(v.x, v.y, tabHintPos.x, tabHintPos.y) < 95) {
      grab(e, 'tab');
      tabStartY = v.y;
      handled = true;
    }
  } else if (S === 'COMPLETE') {
    startReset();
    handled = true;
  }
  if (!handled) {
    // 対象外の場所：やわらかい音＋次に触る場所を即座に光らせる
    tone(620, 0.05, 'sine', 0.05);
    forceHintUntil = performance.now() + 1300;
  }
}, { passive: false });

svg.addEventListener('pointermove', e => {
  if (e.pointerId !== activePointer || !dragging) return;
  e.preventDefault();
  lastInteract = performance.now();
  const w = toWorld(e);
  if (dragging === 'coin') {
    coinPos.x = clamp(w.x + grabOff.x, 30, 400);
    coinPos.y = clamp(w.y + grabOff.y, 60, 830);
    renderCoin();
    const near = dist(coinPos.x, coinPos.y, SLOT.x, SLOT.y) < 100;
    slotGlow.setAttribute('opacity', near ? 0.9 : 0.45);
  } else if (dragging === 'rail') {
    railTheta = clamp(railGrabTheta + (w.x - railGrabX) * 0.2, RAIL_B.min, RAIL_B.max);
    railYOff = clamp(railGrabYOff + (w.y - railGrabY) * 0.45, -13, 10);
  } else if (dragging === 'flap') {
    flapK = clamp(flapStartK - (flapStartY - w.y) / 105, 0.1, 1);
    renderFlap();
    if (flapK < 0.42) latchFlap();
  } else if (dragging === 'item') {
    itemPos.x = clamp(w.x + itemGrabOff.x, 80, 340);
    itemPos.y = clamp(w.y + itemGrabOff.y, 300, 700);
    renderPortItem(1);
    if (PORT_C.y - itemPos.y > 65 || Math.abs(itemPos.x - PORT_C.x) > 105) {
      dragging = null; activePointer = null;
      startTakeout();
    }
  } else if (dragging === 'tab') {
    const v = toView(e);
    tabPull = clamp((tabStartY - v.y) / 46, 0, 1);
    if (openParts) {
      if (openParts.kind === 'can') openParts.rot.setAttribute('transform', `rotate(${-45 * tabPull} 0 3)`);
      else openParts.capG.setAttribute('transform', `translate(0 ${-6 * tabPull}) rotate(${-8 * tabPull} 0 -38)`);
    }
    if (tabPull >= 1) { dragging = null; activePointer = null; doOpen(); }
  }
}, { passive: false });

function endPointer(e) {
  if (e.pointerId !== activePointer) return;
  const d = dragging;
  dragging = null; activePointer = null;
  if (d === 'coin') {
    coinHeld = false;
    slotGlow.setAttribute('opacity', 0);
    if (dist(coinPos.x, coinPos.y, SLOT.x, SLOT.y) < 100) insertCoin();
    else coinSpringBack();
  } else if (d === 'rail') {
    railHeld = false;
    railGlowRect.setAttribute('opacity', 0.18);
  } else if (d === 'flap') {
    if (!flapLatched) {
      SFX.flapThud();
      tween(220, k => { flapK = lerp(flapK, 1, k); renderFlap(); });
    }
  } else if (d === 'item') {
    itemHeld = false;
    if (S === 'FLAP_OPEN') {
      tween(260, k => {
        itemPos.x = lerp(itemPos.x, PORT_C.x, k);
        itemPos.y = lerp(itemPos.y, PORT_C.y, k);
        renderPortItem(1);
      });
    }
  } else if (d === 'tab') {
    if (!opened && openParts) {
      tween(180, k => {
        const p = tabPull * (1 - k);
        if (openParts.kind === 'can') openParts.rot.setAttribute('transform', `rotate(${-45 * p} 0 3)`);
        else openParts.capG.setAttribute('transform', `translate(0 ${-6 * p}) rotate(${-8 * p} 0 -38)`);
      });
    }
  }
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// ---------------------------------------------------------------
// ヒント（2秒操作がなければ次の操作対象が呼吸する）
// ---------------------------------------------------------------
function hintTarget() {
  switch (S) {
    case 'READY': return { x: coinPos.x, y: coinPos.y, r: 52 };
    case 'CREDIT_READY': return { x: BTN_X[1], y: BTN_Y[1], r: 62 };
    case 'ROLLING': return railTouchedThisRound ? null : { x: RAIL_B.cx, y: RAIL_B.cy + 8, r: 56, delay: 2600 };
    case 'ARRIVED': return { x: 210, y: 648, r: 66 };
    case 'FLAP_OPEN': return { x: itemPos.x, y: itemPos.y - 20, r: 56 };
    case 'OPENING': return { x: tabHintPos.x, y: tabHintPos.y, r: 60, view: true };
    default: return null;
  }
}
function stepHint(now) {
  const t = hintTarget();
  const wait = (t && t.delay) || 2000;
  const forced = now < forceHintUntil;
  if (!t || dragging || (!forced && now - lastInteract < wait)) {
    hintGlow.style.display = 'none';
    return;
  }
  const p = t.view ? { x: t.x, y: t.y } : worldToView(t.x, t.y);
  hintGlow.style.display = '';
  hintGlow.setAttribute('cx', p.x);
  hintGlow.setAttribute('cy', p.y);
  hintGlow.setAttribute('r', t.r * (t.view ? 1 : cam.s));
}

// ---------------------------------------------------------------
// メインループ
// ---------------------------------------------------------------
let lastT = performance.now();
function frame(now) {
  let dt = Math.min((now - lastT) / 1000, 0.045);
  lastT = now;
  stepTweens(now);

  // レールBの姿勢（離すとバネで戻る）
  if (!railHeld) {
    railTheta = lerp(railTheta, railTargetBase, 1 - Math.pow(0.02, dt));
    railYOff = lerp(railYOff, 0, 1 - Math.pow(0.002, dt));
  }
  railOmega = (railTheta - railPrevTheta) / Math.max(dt, 1e-4);
  railPrevTheta = railTheta;
  railVy = (railYOff - railPrevYOff) / Math.max(dt, 1e-4);
  railPrevYOff = railYOff;
  railBG.setAttribute('transform', `translate(${RAIL_B.cx} ${RAIL_B.cy + railYOff}) rotate(${railTheta})`);

  // 硬貨：持ち上がり（スケール＋影）と投入口への磁力
  {
    const target = coinHeld ? 1.1 : 1;
    if (Math.abs(coinScale - target) > 0.001 || coinHeld) {
      coinScale = lerp(coinScale, target, 1 - Math.pow(0.0005, dt));
      const hk = clamp((coinScale - 1) / 0.1, 0, 1);
      coinShadow.setAttribute('cx', 3 + hk * 5);
      coinShadow.setAttribute('cy', 9 + hk * 9);
      coinShadow.setAttribute('opacity', 0.22 - hk * 0.09);
      renderCoin();
    }
    if (dragging === 'coin') {
      const d = dist(coinPos.x, coinPos.y, SLOT.x, SLOT.y);
      if (d < 95 && d > 2) {
        const pull = (1 - d / 95) * 5.5 * dt;
        coinPos.x += (SLOT.x - coinPos.x) * pull;
        coinPos.y += (SLOT.y - coinPos.y) * pull;
        renderCoin();
      }
    }
  }

  // 物理（2サブステップ）
  if (S === 'ROLLING') {
    stepProd(dt / 2); stepProd(dt / 2);
  }

  // カメラ目標：商品を追い、取り出し口へ近づくほど寄る（急がない）
  if (S === 'ROLLING') {
    const deep = clamp((prod.y - 430) / 150, 0, 1);
    camTo(clamp(prod.x, 150, 270), clamp(prod.y + 10, 330, 572), 1.32 + 0.2 * deep);
  } else if (S === 'ARRIVED' || S === 'FLAP_OPEN') {
    camTo(210, 555, 1.38);
  } else if (S === 'READY' || S === 'CREDIT_READY' || S === 'COIN_INSERTING') {
    camTo(210, 420, 1);
  }
  stepCam(dt);
  stepParticles(dt);
  stepHint(now);
  requestAnimationFrame(frame);
}
renderCoin();
renderFlap();
requestAnimationFrame(frame);

// ---------------------------------------------------------------
// タブ復帰などの安全策
// ---------------------------------------------------------------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { motorStop(); rollStop(); }
  else if (S === 'ROLLING') { motorStart(); rollStart(); }
});

// ---------------------------------------------------------------
// テストフック（自動テスト用）
// ---------------------------------------------------------------
window.__T = {
  get state() { return S; },
  get prod() { return { phase: prod.phase, x: prod.x, y: prod.y, v: prod.v, vy: prod.vy, seg: prod.seg, spinBoost: prod.spinBoost || 0 }; },
  get railTheta() { return railTheta; },
  get coinPos() { return { ...coinPos }; },
  get flapK() { return flapK; },
  get tabHintPos() { return { ...tabHintPos }; },
  get selected() { return selected; },
  worldToClient(x, y) {
    const p = svg.createSVGPoint(); p.x = x; p.y = y;
    const m = camG.getScreenCTM();
    const q = p.matrixTransform(m);
    return { x: q.x, y: q.y };
  },
  viewToClient(x, y) {
    const p = svg.createSVGPoint(); p.x = x; p.y = y;
    const q = p.matrixTransform(svg.getScreenCTM());
    return { x: q.x, y: q.y };
  },
  GEO: { SLOT, TRAY, BTN_X, BTN_Y, PORT_C, RAIL_B },
};
