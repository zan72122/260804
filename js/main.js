/* ============================================================
   ぬいぬい！ フェルトタウン — main.js
   シーン管理・入力・町・制作フロー・演出
   ============================================================ */
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, MIN = 0;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  MIN = Math.min(W, H);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const FONT = "'Hiragino Maru Gothic ProN','BIZ UDGothic','M PLUS Rounded 1c',sans-serif";

// ---------------- ゲーム状態 ----------------
const SPOTS = [
  { id: 'house',  icon: 'house'  },
  { id: 'garden', icon: 'flower' },
  { id: 'shop',   icon: 'bow'    },
  { id: 'bridge', icon: 'bridge' }
];

const G = {
  scene: 'title',
  time: 0,
  items: {},            // spotId -> 完成品
  buildCount: 0,
  residents: [],
  particles: [],
  craft: null,
  parade: null,
  sceneT: 0,
  muted: false
};

// ---------------- 保存 / 読み込み ----------------
const SAVE_KEY = 'feltTown.v1';
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ items: G.items, buildCount: G.buildCount }));
  } catch (e) { /* プライベートブラウズ等では保存しない */ }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d && d.items) { G.items = d.items; G.buildCount = d.buildCount || 0; }
  } catch (e) { }
}
load();

// ---------------- 住民 ----------------
function initResidents() {
  if (G.residents.length) return;
  for (let i = 0; i < 3; i++) {
    const r = new Resident(CHAR_DEFS[i], W * (0.3 + i * 0.2), H * 0.85, 100 + i * 37);
    r.hiddenT = 0;
    r.visitQueue = [];
    G.residents.push(r);
  }
}

// ---------------- 町のレイアウト ----------------
function townLayout() {
  const portrait = H > W;
  const pos = portrait
    ? [[0.26, 0.52], [0.74, 0.48], [0.26, 0.74], [0.72, 0.82]]
    : [[0.15, 0.60], [0.40, 0.54], [0.63, 0.62], [0.86, 0.72]];
  const s = (portrait ? MIN * 0.46 : MIN * 0.52) / BOARD;
  return SPOTS.map((sp, i) => ({
    id: sp.id, icon: sp.icon,
    x: pos[i][0] * W, y: pos[i][1] * H, s
  }));
}

// スポット内の訪問先（住民のおでかけ用）
function visitPoints(L) {
  const pts = [];
  if (L.id === 'bridge') {
    pts.push({ x: L.x - BOARD * 0.36 * L.s, y: L.y });
    pts.push({ x: L.x + BOARD * 0.36 * L.s, y: L.y });
  } else {
    pts.push({ x: L.x + (Math.random() - 0.5) * 40, y: L.y + 14 });
  }
  return pts;
}

// ---------------- パーティクル ----------------
function spawnParticle(kind, x, y, color) {
  G.particles.push({
    kind, x, y, color,
    vx: (Math.random() - 0.5) * 60,
    vy: kind === 'petal' ? 30 + Math.random() * 40 : -90 - Math.random() * 80,
    rot: Math.random() * U.TAU, vr: (Math.random() - 0.5) * 4,
    age: 0, life: kind === 'petal' ? 5 : 1.4,
    size: 8 + Math.random() * 8
  });
}
function updateParticles(dt) {
  for (const p of G.particles) {
    p.age += dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if (p.kind === 'petal') { p.vy += 10 * dt; p.vx += Math.sin(G.time * 2 + p.rot) * 30 * dt; }
    else p.vy += 160 * dt;
  }
  G.particles = G.particles.filter(p => p.age < p.life && p.y < H + 40);
}
function drawParticles() {
  for (const p of G.particles) {
    const a = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 2);
    if (p.kind === 'heart') Felt.heart(ctx, p.x, p.y, p.size, p.color, 1);
    else if (p.kind === 'star') Felt.star(ctx, p.x, p.y, p.size, p.color, 1, p.rot);
    else {
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.8, p.size * 0.45, 0, 0, U.TAU);
      ctx.fillStyle = p.color; ctx.fill();
    }
    ctx.restore();
  }
}
const PARTY_COLORS = ['#ff9ec6', '#ffd3e4', '#b9a2ea', '#ffe27a', '#8fe3c0', '#a8dcf0'];

// ---------------- 共通UI部品 ----------------
// 丸いフェルトボタン。戻り値: ヒット判定用 {x,y,r}
function feltRoundButton(x, y, r, color, iconFn, pulse) {
  const p = pulse ? 1 + Math.sin(G.time * 3.2) * 0.05 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p, p);
  ctx.beginPath(); ctx.arc(0, 5, r, 0, U.TAU);
  ctx.fillStyle = 'rgba(120,70,110,0.25)'; ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r * 1.1);
  g.addColorStop(0, U.shade(color, 0.35));
  g.addColorStop(1, color);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, U.TAU);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
  if (iconFn) iconFn(r);
  ctx.restore();
  return { x, y, r: r * 1.25 };
}

// 縫い目つきタイトル文字
function stitchText(text, x, y, px, color) {
  ctx.save();
  ctx.font = `900 ${px}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#fffdf5'; ctx.lineWidth = px * 0.28;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = px * 0.045;
  ctx.setLineDash([px * 0.12, px * 0.1]);
  ctx.strokeText(text, x, y);
  ctx.setLineDash([]);
  ctx.restore();
}

// スポットの種類アイコン
function drawSpotIcon(kind, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 40, s / 40);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (kind === 'house') {
    ctx.beginPath();
    ctx.moveTo(-24, 2); ctx.lineTo(0, -24); ctx.lineTo(24, 2); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = '#fffdf5';
    ctx.fillRect(-17, 2, 34, 24);
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.strokeRect(-17, 2, 34, 24);
    ctx.fillStyle = color;
    ctx.fillRect(-5, 12, 10, 14);
  } else if (kind === 'flower') {
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * U.TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 13, Math.sin(a) * 13, 10, 7, a, 0, U.TAU);
      ctx.fillStyle = color; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, U.TAU);
    ctx.fillStyle = '#ffe27a'; ctx.fill();
  } else if (kind === 'bow') {
    Felt.bow(ctx, 0, 0, 52, color, 1);
  } else { // bridge
    ctx.strokeStyle = color; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, 16, 24, Math.PI, 0); ctx.stroke();
    ctx.lineWidth = 4;
    for (const dx of [-24, 0, 24]) {
      ctx.beginPath(); ctx.moveTo(dx, dx === 0 ? -8 : 16); ctx.lineTo(dx, 22); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------- 背景（町・タイトル共通の空と丘）※静的部分はキャッシュ ----------------
let bgCache = null;
function renderBgCache() {
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const c = cv.getContext('2d');
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  // 空
  const sky = c.createLinearGradient(0, 0, 0, H * 0.5);
  sky.addColorStop(0, '#cfeafd');
  sky.addColorStop(1, '#f6e6f4');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H * 0.5);
  // 丘（うしろ）
  c.beginPath();
  c.moveTo(0, H * 0.5);
  for (let x = 0; x <= W; x += 20) {
    c.lineTo(x, H * 0.42 + Math.sin(x * 0.004 + 1) * H * 0.05);
  }
  c.lineTo(W, H * 0.5);
  c.closePath();
  c.fillStyle = '#cdeab4'; c.fill();
  // 地面（フェルトの草原）
  const pat = c.createPattern(Felt.fiberTex('#b8e29c'), 'repeat');
  c.fillStyle = pat;
  c.fillRect(0, H * 0.44, W, H * 0.56);
  // 丘の縁のステッチ
  const hillPts = [];
  for (let x = 0; x <= W; x += 24) hillPts.push({ x, y: H * 0.445 + Math.sin(x * 0.006) * 4 });
  Felt.stitchLine(c, hillPts, 'rgba(255,255,255,0.55)', 3, 1, [10, 9]);
  // 小花のちらし
  const rnd = U.mulberry32(9);
  for (let i = 0; i < 14; i++) {
    const fx = rnd() * W, fy = H * (0.5 + rnd() * 0.45);
    c.save(); c.globalAlpha = 0.8;
    for (let p = 0; p < 5; p++) {
      const a = p / 5 * U.TAU;
      c.beginPath();
      c.arc(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5, 3.4, 0, U.TAU);
      c.fillStyle = ['#fff', '#ffd3e4', '#ffe9a8'][i % 3]; c.fill();
    }
    c.beginPath(); c.arc(fx, fy, 2.6, 0, U.TAU);
    c.fillStyle = '#ffb85c'; c.fill();
    c.restore();
  }
  bgCache = { cv, w: W, h: H };
}

function drawWorldBg() {
  if (!bgCache || bgCache.w !== W || bgCache.h !== H) renderBgCache();
  ctx.drawImage(bgCache.cv, 0, 0, W, H);
  // フェルトのおひさま（回る光は動的に）
  const sx = W * 0.13, sy = H * 0.09, sr = MIN * 0.07;
  ctx.save();
  ctx.globalAlpha = 0.95;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * U.TAU + G.time * 0.1;
    ctx.beginPath();
    ctx.ellipse(sx + Math.cos(a) * sr * 1.5, sy + Math.sin(a) * sr * 1.5, sr * 0.35, sr * 0.18, a, 0, U.TAU);
    ctx.fillStyle = '#ffe9a8'; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, U.TAU);
  ctx.fillStyle = '#ffdf86'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
  ctx.setLineDash([9, 7]); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  // 綿の雲
  for (let i = 0; i < 3; i++) {
    const cx2 = ((G.time * 8 + i * W * 0.4) % (W + 300)) - 150;
    Felt.cotton(ctx, cx2, H * (0.08 + i * 0.06), MIN * 0.05, 1, 40 + i);
  }
}

/* ============================================================
   タイトル画面
   ============================================================ */
let titleBtn = null;
function drawTitle(dt) {
  drawWorldBg();
  // ふわふわ飾り
  const rnd = U.mulberry32(3);
  for (let i = 0; i < 10; i++) {
    const bx = rnd() * W, spd = 12 + rnd() * 18, ph = rnd() * 100;
    const by = H + 40 - ((G.time * spd + ph * 60) % (H + 140));
    const kind = i % 3;
    ctx.save(); ctx.globalAlpha = 0.55;
    if (kind === 0) Felt.heart(ctx, bx, by, 12 + rnd() * 8, '#ff9ec6', 1);
    else if (kind === 1) Felt.star(ctx, bx, by, 11 + rnd() * 7, '#ffe27a', 1, G.time * 0.6 + i);
    else Felt.button(ctx, bx, by, 10 + rnd() * 6, '#b9a2ea', 1);
    ctx.restore();
  }
  // タイトルパネル
  const pw = Math.min(W * 0.88, 620), ph2 = MIN * 0.34;
  const px0 = W / 2 - pw / 2, py0 = H * 0.30 - ph2 / 2 + Math.sin(G.time * 1.4) * 6;
  Felt.piece(ctx, Felt.rrect(px0, py0, pw, ph2, 40), '#fff2f8',
    { stitchColor: 'rgba(255,158,198,0.9)' });
  const fs = Math.min(pw * 0.148, ph2 * 0.30);
  stitchText('ぬいぬい！', W / 2, py0 + ph2 * 0.32, fs, '#f06ba8');
  stitchText('フェルトタウン', W / 2, py0 + ph2 * 0.68, fs * 0.92, '#9b7fd4');
  // パネル角のボタン飾り
  Felt.button(ctx, px0 + 34, py0 + 32, 13, '#ffe27a', 1);
  Felt.button(ctx, px0 + pw - 34, py0 + 32, 13, '#8fe3c0', 1);
  // 住民たち
  initResidents();
  G.residents.forEach((r, i) => {
    r.x = W / 2 + (i - 1) * MIN * 0.18;
    r.y = H * 0.72;
    r.state = 'cheer'; r.stateT = 9;
    r.update(dt);
    r.draw(ctx, MIN * 0.16);
  });
  // はじめるボタン
  titleBtn = feltRoundButton(W / 2, H * 0.87, MIN * 0.085, '#ff8fbe', (r) => {
    ctx.beginPath();
    ctx.moveTo(-r * 0.28, -r * 0.42);
    ctx.lineTo(r * 0.5, 0);
    ctx.lineTo(-r * 0.28, r * 0.42);
    ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill();
  }, true);
}

/* ============================================================
   町の画面
   ============================================================ */
function paradeActive() { return G.parade && G.parade.t < G.parade.dur; }

function updateTown(dt) {
  initResidents();
  const Ls = townLayout();

  // パレード（ごほうびイベント）
  if (G.parade) {
    G.parade.t += dt;
    if (G.parade.t < G.parade.dur) {
      G.residents.forEach((r, i) => {
        const t = (G.parade.t / G.parade.dur);
        r.x = -80 + (W + 160) * ((t + i * 0.12) % 1);
        r.y = H * 0.86 + Math.sin(G.time * 3 + i) * 6;
        r.flip = 1;
        r.phase += dt;
        r.state = 'cheer'; r.stateT = 9;
      });
      if (Math.random() < dt * 14) {
        spawnParticle('petal', Math.random() * W, -20,
          PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)]);
      }
    } else if (G.parade.t - dt < G.parade.dur) {
      G.residents.forEach(r => { r.state = 'idle'; r.waitT = 1; });
    }
  }

  // 住民の自由行動
  if (!paradeActive()) {
    for (const r of G.residents) {
      if (r.hiddenT > 0) { r.hiddenT -= dt; continue; }
      r.update(dt);
      if (r.state === 'idle' && r.waitT <= 0) {
        if (r.visitQueue.length) {
          const p = r.visitQueue.shift();
          r.goto(p.x, p.y);
        } else {
          // 完成したスポットに遊びに行く or ぶらぶら
          const built = Ls.filter(L => G.items[L.id]);
          if (built.length && Math.random() < 0.6) {
            const L = built[Math.floor(Math.random() * built.length)];
            const vp = visitPoints(L);
            r.goto(vp[0].x, vp[0].y);
            r.visitQueue = vp.slice(1);
            r.visitTarget = L.id;
          } else {
            r.goto(W * (0.1 + Math.random() * 0.8), H * (0.55 + Math.random() * 0.38));
            r.visitTarget = null;
          }
        }
      }
      // 到着時のリアクション
      if (r.state === 'idle' && r.visitTarget && !r.visitQueue.length) {
        if (r.visitTarget === 'house' && Math.random() < 0.5) {
          r.hiddenT = 2.2; // おうちに入る
        } else {
          r.cheerNow(1.6);
          for (let i = 0; i < 3; i++) spawnParticle('heart', r.x, r.y - 60, '#ff9ec6');
        }
        r.visitTarget = null;
      }
    }
  }
}

function drawTown(dt) {
  updateTown(dt);
  drawWorldBg();
  const Ls = townLayout();

  // スポットを結ぶ ぬい目のこみち
  const path = Ls.map(L => ({ x: L.x, y: L.y + 10 }));
  path.sort((a, b) => a.x - b.x);
  Felt.stitchLine(ctx, U.smooth(path, 3), 'rgba(255,253,245,0.8)', 5, 1, [16, 13]);

  // 奥のスポットから描く（完成品はキャッシュ描画。1フレームに1枚だけ再レンダリング）
  const order = Ls.slice().sort((a, b) => a.y - b.y);
  let refreshed = false;
  for (const L of order) {
    const item = G.items[L.id];
    if (item) {
      const cache = getItemCache(L.id, item);
      if (!refreshed && G.time - cache.at > 0.12) {
        renderItemCache(cache, item);
        refreshed = true;
      }
      const pad = CACHE_PAD;
      ctx.drawImage(cache.cv,
        L.x - (BOARD / 2 + pad) * L.s,
        L.y - (GROUND + pad) * L.s,
        (BOARD + pad * 2) * L.s,
        (BOARD + pad * 2) * L.s);
    } else {
      drawEmptySpot(L);
    }
  }

  // 住民
  for (const r of G.residents) {
    if (r.hiddenT > 0) continue;
    r.draw(ctx, MIN * 0.13);
  }

  drawParticles();
  drawMuteButton();
}

// ---------------- 完成品のオフスクリーンキャッシュ ----------------
const CACHE_PAD = 120;                 // ボード外にはみ出す影・けむり用の余白
const CACHE_RES = 640;                 // キャッシュ解像度
const itemCaches = new Map();          // spotId -> {cv, at, sig}
function getItemCache(spotId, item) {
  const sig = item.seed + ':' + item.colorIdx;
  let c = itemCaches.get(spotId);
  if (!c || c.sig !== sig) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = CACHE_RES;
    c = { cv, at: -1, sig };
    itemCaches.set(spotId, c);
    renderItemCache(c, item);
  }
  return c;
}
function renderItemCache(cache, item) {
  const q = CACHE_RES / (BOARD + CACHE_PAD * 2);
  const c = cache.cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, CACHE_RES, CACHE_RES);
  c.setTransform(q, 0, 0, q, CACHE_PAD * q, CACHE_PAD * q);
  Build.draw(c, item, 1, G.time);
  cache.at = G.time;
}

// まだ作っていない場所：やわらかく光る台座 + おねがいバブル
const emptyHits = [];
function drawEmptySpot(L) {
  const pulse = 0.75 + Math.sin(G.time * 2.6) * 0.25;
  const rw = MIN * 0.17, rh = rw * 0.42;
  ctx.save();
  // 光る台座
  const g = ctx.createRadialGradient(L.x, L.y, rw * 0.1, L.x, L.y, rw * 1.25);
  g.addColorStop(0, `rgba(255,255,255,${0.75 * pulse})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.ellipse(L.x, L.y, rw * 1.25, rh * 1.4, 0, 0, U.TAU);
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.ellipse(L.x, L.y, rw, rh, 0, 0, U.TAU);
  ctx.fillStyle = 'rgba(255,253,245,0.75)'; ctx.fill();
  ctx.strokeStyle = 'rgba(240,107,168,0.9)';
  ctx.lineWidth = 4; ctx.setLineDash([12, 9]);
  ctx.lineDashOffset = -G.time * 26;
  ctx.stroke(); ctx.setLineDash([]);
  // ぴょこぴょこ跳ねるアイコン
  const hop = Math.abs(Math.sin(G.time * 2.8)) * rh * 0.5;
  drawSpotIcon(L.icon, L.x, L.y - rh - MIN * 0.035 - hop, MIN * 0.05, '#f06ba8');
  // おねがいバブル（！）
  const bx = L.x + rw * 0.85, by = L.y - rh * 2.4 - hop * 0.4;
  ctx.beginPath(); ctx.arc(bx, by, MIN * 0.028, 0, U.TAU);
  ctx.fillStyle = '#fffdf5'; ctx.fill();
  ctx.strokeStyle = '#f06ba8'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#f06ba8';
  ctx.font = `900 ${MIN * 0.037}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('！', bx, by + 1);
  ctx.restore();
}

// ---------------- ミュートボタン ----------------
let muteBtn = null;
function drawMuteButton() {
  const r = Math.max(MIN * 0.038, 22);
  muteBtn = feltRoundButton(W - r - 16, r + 16, r, G.muted ? '#c9bfd4' : '#b9a2ea', (rr) => {
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${rr * 1.0}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(G.muted ? '×' : '♪', 0, 2);
  });
}

/* ============================================================
   制作画面（クラフト）
   ============================================================ */
function startCraft(spotId) {
  G.craft = {
    spotId,
    phase: 'color',        // color → draw → dot → magic → done
    colorIdx: -1,
    stroke: [],
    drawing: false,
    dot: null,
    item: null,
    t: 0,
    lastTickLen: 0,
    hintT: 0,
    resident: null,
    okBtn: null,
    colorBtns: [],
    seed: Math.floor(Math.random() * 1e9)
  };
  G.scene = 'craft';
  G.sceneT = 0;
}

// ボード（1000x1000）の画面上の位置
function boardRect() {
  const size = Math.min(W * 0.94, H * 0.66);
  const bx = W / 2 - size / 2;
  const by = Math.min(H * 0.16, H - size - MIN * 0.2);
  return { x: bx, y: Math.max(by, MIN * 0.02), s: size / BOARD, size };
}
function toBoard(px, py) {
  const B = boardRect();
  return { x: (px - B.x) / B.s, y: (py - B.y) / B.s };
}

// お手本ライン（スポットごとの「こう描いてみて」）
function hintStroke(spotId) {
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    if (spotId === 'house') {
      pts.push({ x: U.lerp(230, 770, t), y: 400 - Math.sin(t * Math.PI) * 210 });
    } else if (spotId === 'garden') {
      pts.push({ x: 500 + Math.sin(t * 5) * 90, y: U.lerp(760, 260, t) });
    } else if (spotId === 'shop') {
      pts.push({ x: U.lerp(220, 780, t), y: 330 + Math.sin(t * Math.PI * 3) * 55 });
    } else {
      pts.push({ x: U.lerp(160, 840, t), y: 700 - Math.sin(t * Math.PI) * 260 });
    }
  }
  return pts;
}

function drawCraft(dt) {
  const C = G.craft;
  const B = boardRect();
  C.hintT += dt;

  // 背景（やわらかな工房のグラデーション + ふわふわ飾り）
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#e8d5f2');
  bg.addColorStop(0.5, '#f6dcEC');
  bg.addColorStop(1, '#d9c2ea');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const rnd = U.mulberry32(21);
  for (let i = 0; i < 8; i++) {
    const fx = rnd() * W, spd = 8 + rnd() * 12;
    const fy = H + 30 - ((G.time * spd + rnd() * 900) % (H + 100));
    ctx.save(); ctx.globalAlpha = 0.28;
    if (i % 2) Felt.heart(ctx, fx, fy, 10 + rnd() * 8, '#ff9ec6', 1);
    else Felt.star(ctx, fx, fy, 9 + rnd() * 7, '#ffe27a', 1, G.time * 0.5 + i);
    ctx.restore();
  }

  // 制作ボード（手芸マット）
  Felt.piece(ctx, Felt.rrect(B.x - 14, B.y - 14, B.size + 28, B.size + 28, 36), '#fff6ea',
    { stitchColor: 'rgba(240,107,168,0.65)' });
  // 角のボタン
  Felt.button(ctx, B.x + 8, B.y + 8, 11, '#ffb7d2', 1);
  Felt.button(ctx, B.x + B.size - 8, B.y + 8, 11, '#8fe3c0', 1);
  Felt.button(ctx, B.x + 8, B.y + B.size - 8, 11, '#ffe27a', 1);
  Felt.button(ctx, B.x + B.size - 8, B.y + B.size - 8, 11, '#b9a2ea', 1);

  ctx.save();
  ctx.beginPath();
  ctx.rect(B.x - 6, B.y - 6, B.size + 12, B.size + 12);
  ctx.clip();
  ctx.translate(B.x, B.y);
  ctx.scale(B.s, B.s);

  // ボード内：地面のけはい
  ctx.fillStyle = 'rgba(184,226,156,0.55)';
  ctx.fillRect(-20, GROUND + 10, BOARD + 40, BOARD - GROUND);
  Felt.stitchLine(ctx, [{ x: 20, y: GROUND + 12 }, { x: 980, y: GROUND + 12 }],
    'rgba(120,160,90,0.6)', 4, 1, [14, 11]);
  ctx.save();
  ctx.globalAlpha = 0.4;
  drawSpotIcon(SPOTS.find(s => s.id === C.spotId).icon, 90, 90, 52, '#f06ba8');
  ctx.restore();

  if (C.phase === 'magic' || C.phase === 'done') {
    // 仕立てアニメーション
    Build.draw(ctx, C.item, C.t, G.time);
  } else {
    // お手本（描き始める前だけ、糸がすーっと走るデモ）
    if (C.phase === 'draw' && !C.drawing && C.stroke.length === 0) {
      const hp = hintStroke(C.spotId);
      const prog = (C.hintT * 0.45) % 1.3;
      ctx.save();
      ctx.globalAlpha = 0.4;
      Felt.stitchLine(ctx, hp, '#f06ba8', 5, Math.min(prog, 1), [14, 12]);
      const tip = U.pointAt(hp, Math.min(prog, 1));
      Felt.sparkle(ctx, tip.x, tip.y, 26, (C.hintT * 2) % 1);
      ctx.restore();
      drawHintHand(tip.x, tip.y, 1);
    }
    // 子どもの線（描画中もぬい上がりと同じ毛糸表現＝気持ちよさ最優先）
    if (C.stroke.length > 1) {
      const col = C.colorIdx >= 0 ? PALETTES[C.colorIdx].dark : '#f06ba8';
      Felt.yarn(ctx, C.stroke, col, 20);
      if (C.drawing) {
        const tip = C.stroke[C.stroke.length - 1];
        Felt.sparkle(ctx, tip.x, tip.y, 30, (G.time * 2.2) % 1);
      }
    }
    // 点フェーズ：ぽんっと置く場所のヒント
    if (C.phase === 'dot') {
      const pulse = 0.7 + Math.sin(G.time * 4) * 0.3;
      const hx = 500, hy = 560;
      ctx.save();
      ctx.globalAlpha = 0.5 * pulse;
      ctx.beginPath(); ctx.arc(hx, hy, 70 * pulse + 20, 0, U.TAU);
      ctx.strokeStyle = '#f06ba8'; ctx.lineWidth = 8;
      ctx.setLineDash([16, 13]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      Felt.button(ctx, hx, hy, 42, PALETTES[Math.max(C.colorIdx, 0)].accent, 0.5 + pulse * 0.15);
      drawHintHand(hx, hy, Math.abs(Math.sin(G.time * 3)));
    }
  }

  // 完成お祝いの住民（ボード内にぴょこんと）
  if (C.phase === 'done' && C.resident) {
    C.resident.update(dt);
    C.resident.draw(ctx, 200);
    if (Math.random() < dt * 3) {
      const sp = boardToScreen(C.resident.x, C.resident.y - 140);
      spawnParticle('heart', sp.x, sp.y, PARTY_COLORS[Math.floor(Math.random() * 3)]);
    }
  }
  ctx.restore();

  // ---- ボード外のUI ----
  drawCraftUI(dt, B);
  drawParticles();
  drawMuteButton();
  drawBackButton();

  // ---- 仕立てアニメの進行 ----
  if (C.phase === 'magic') {
    const prev = C.t;
    C.t = Math.min(1, C.t + dt / 4.6);
    magicSfx(prev, C.t);
    if (C.t >= 1 && prev < 1) beginDonePhase();
  }
}

function boardToScreen(bx, by) {
  const B = boardRect();
  return { x: B.x + bx * B.s, y: B.y + by * B.s };
}

// 指さしヒント（読字に頼らない誘導）
function drawHintHand(bx, by, press) {
  ctx.save();
  ctx.translate(bx + 60, by + 90 - press * 26);
  ctx.rotate(-0.5);
  ctx.scale(1.7, 1.7);
  ctx.beginPath();
  ctx.ellipse(0, 26, 16, 20, 0, 0, U.TAU);       // こぶし
  ctx.moveTo(6, -14);
  ctx.ellipse(0, 2, 7, 22, 0, 0, U.TAU);          // ひとさし指
  ctx.fillStyle = '#ffdfc4';
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,120,90,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawCraftUI(dt, B) {
  const C = G.craft;
  const uiY = Math.min(B.y + B.size + (H - B.y - B.size) * 0.52, H - MIN * 0.09);
  C.colorBtns = [];
  C.okBtn = null;

  if (C.phase === 'color') {
    // 「どの いろに する？」— 毛糸玉の3ボタン
    const r = Math.min(MIN * 0.085, (H - B.y - B.size) * 0.3);
    const gap = r * 2.8;
    PALETTES.forEach((P, i) => {
      const x = W / 2 + (i - 1) * gap;
      const hit = feltRoundButton(x, uiY, r, P.main, (rr) => {
        // 毛糸玉の巻き模様
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = rr * 0.13; ctx.lineCap = 'round';
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.arc(0, rr * k * 0.55, rr * 0.72, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        }
      }, true);
      C.colorBtns.push({ ...hit, idx: i });
    });
    // 上でハサミ屋さん（案内役）がぴょこぴょこ
    bubbleAbove(B, '🧵 いろを えらんでね');
  } else if (C.phase === 'draw') {
    bubbleAbove(B, '～～ せんを 1ぽん かいてね');
  } else if (C.phase === 'dot') {
    bubbleAbove(B, '● さいごに 1こ ぽんっ！');
  } else if (C.phase === 'done') {
    // まる（完成）ボタン
    const r = Math.min(MIN * 0.09, (H - B.y - B.size) * 0.33);
    C.okBtn = feltRoundButton(W / 2, uiY, r, '#8fd694', (rr) => {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = rr * 0.22; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-rr * 0.4, 0); ctx.lineTo(-rr * 0.08, rr * 0.34); ctx.lineTo(rr * 0.45, -rr * 0.3);
      ctx.stroke();
    }, true);
  }
}

// ボード上部のふきだし（短いよみがな付きガイド。読めなくてもアイコンで伝わる）
function bubbleAbove(B, text) {
  const bw = Math.min(W * 0.76, 460), bh = Math.max(MIN * 0.07, 44);
  const bx = W / 2, by = Math.max(B.y - bh * 0.55, bh * 0.72 + MIN * 0.06);
  ctx.save();
  Felt.piece(ctx, Felt.rrect(bx - bw / 2, by - bh / 2, bw, bh, bh / 2), '#fffdf5',
    { stitchColor: 'rgba(240,107,168,0.7)', shadowY: 3 });
  ctx.fillStyle = '#c2508c';
  ctx.font = `800 ${bh * 0.46}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, bx, by + 1);
  ctx.restore();
}

let backBtn = null;
function drawBackButton() {
  const r = Math.max(MIN * 0.038, 22);
  backBtn = feltRoundButton(r + 16, r + 16, r, '#f5a8c8', (rr) => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = rr * 0.2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rr * 0.25, -rr * 0.38); ctx.lineTo(-rr * 0.3, 0); ctx.lineTo(rr * 0.25, rr * 0.38);
    ctx.stroke();
  });
}

// 仕立てアニメ中の効果音（段階演出に同期）
function magicSfx(prev, t) {
  const C = G.craft;
  // ちくちく縫い（序盤）
  if (t < 0.3) {
    C._st = (C._st || 0) + (t - prev);
    if (C._st > 0.028) { C._st = 0; Snd.stitch(); }
  }
  const cross = (a) => prev < a && t >= a;
  if (cross(0.3)) Snd.puff();
  if (cross(0.5)) Snd.puff();
  if (cross(0.62)) Snd.stitch();
  if (cross(0.78)) Snd.pon();
  if (cross(0.95)) Snd.fanfare();
}

function beginDonePhase() {
  const C = G.craft;
  C.phase = 'done';
  Snd.cheer();
  // 住民がボードに駆けつける
  const r = new Resident(CHAR_DEFS[Math.floor(Math.random() * 3)], -80, GROUND + 6, C.seed % 1000);
  r.goto(320, GROUND + 6);
  r.speed = 260;
  C.resident = r;
  setTimeout(() => { if (G.craft === C) r.cheerNow(60); }, 900);
  // 画面いっぱいのきらきら
  for (let i = 0; i < 16; i++) {
    spawnParticle(i % 2 ? 'star' : 'heart',
      W * (0.2 + Math.random() * 0.6), H * (0.2 + Math.random() * 0.5),
      PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)]);
  }
}

// 完成 → 町へ
function commitCraft() {
  const C = G.craft;
  G.items[C.spotId] = C.item;
  G.buildCount++;
  save();
  G.craft = null;
  G.scene = 'town';
  G.sceneT = 0;
  // ごほうびパレード（2個ごと）
  if (G.buildCount >= 2 && G.buildCount % 2 === 0) {
    G.parade = { t: 0, dur: 7 };
    Snd.fanfare();
  } else {
    // 新しい作品へ住民が見に行く
    const Ls = townLayout();
    const L = Ls.find(l => G.items[l.id] && l.id === C.spotId);
    if (L) {
      G.residents.forEach((r, i) => {
        const vp = visitPoints(L);
        r.visitQueue = vp;
        r.visitTarget = L.id;
        r.waitT = 0.3 + i * 0.6;
        r.state = 'idle';
      });
    }
  }
}

/* ============================================================
   入力
   ============================================================ */
function hitCircle(hit, x, y) {
  return hit && U.dist(hit.x, hit.y, x, y) <= hit.r;
}

function onDown(x, y) {
  Snd.init();
  Snd.startBgm();

  if (hitCircle(muteBtn, x, y)) {
    G.muted = !G.muted;
    Snd.setMuted(G.muted);
    return;
  }

  if (G.scene === 'title') {
    Snd.tap();
    G.scene = 'town';
    G.sceneT = 0;
    G.residents.forEach((r, i) => {
      r.state = 'idle'; r.waitT = 0.5 + i;
      r.x = W * (0.3 + i * 0.2); r.y = H * 0.85;
      r.tx = r.x; r.ty = r.y;
    });
    return;
  }

  if (G.scene === 'town') {
    if (paradeActive()) return;
    const Ls = townLayout();
    let best = null, bd = 1e9;
    for (const L of Ls) {
      const d = U.dist(L.x, L.y - MIN * 0.06, x, y);
      if (d < bd) { bd = d; best = L; }
    }
    if (best && bd < MIN * 0.2) {
      Snd.tap();
      startCraft(best.id);
    }
    return;
  }

  if (G.scene === 'craft') {
    const C = G.craft;
    if (hitCircle(backBtn, x, y)) {
      Snd.tap();
      G.craft = null; G.scene = 'town'; G.sceneT = 0;
      return;
    }
    if (C.phase === 'color') {
      for (const b of C.colorBtns) {
        if (hitCircle(b, x, y)) {
          C.colorIdx = b.idx;
          Snd.pick(b.idx);
          C.phase = 'draw';
          C.hintT = 0;
          return;
        }
      }
      return;
    }
    if (C.phase === 'draw') {
      const p = toBoard(x, y);
      if (p.x > -30 && p.x < BOARD + 30 && p.y > -30 && p.y < BOARD + 30) {
        C.drawing = true;
        C.stroke = [{ x: U.clamp(p.x, 15, 985), y: U.clamp(p.y, 15, 985) }];
        C.lastTickLen = 0;
      }
      return;
    }
    if (C.phase === 'dot') {
      const p = toBoard(x, y);
      if (p.x > -30 && p.x < BOARD + 30 && p.y > -30 && p.y < BOARD + 30) {
        C.dot = { x: U.clamp(p.x, 30, 970), y: U.clamp(p.y, 30, 970) };
        Snd.pon();
        const sp = boardToScreen(C.dot.x, C.dot.y);
        for (let i = 0; i < 5; i++) spawnParticle('star', sp.x, sp.y, '#ffe27a');
        C.item = Build.make(C.spotId, C.stroke, C.dot, C.colorIdx, C.seed);
        C.phase = 'magic';
        C.t = 0;
      }
      return;
    }
    if (C.phase === 'magic') {
      // せっかちタップで少し早送り（じれったさ防止）
      C.t = Math.min(1, C.t + 0.08);
      return;
    }
    if (C.phase === 'done') {
      if (hitCircle(C.okBtn, x, y)) {
        Snd.tap();
        commitCraft();
      }
      return;
    }
  }
}

function onMove(x, y) {
  const C = G.craft;
  if (!C || C.phase !== 'draw' || !C.drawing) return;
  const p = toBoard(x, y);
  const q = { x: U.clamp(p.x, 15, 985), y: U.clamp(p.y, 15, 985) };
  const last = C.stroke[C.stroke.length - 1];
  const d = U.dist(last.x, last.y, q.x, q.y);
  if (d > 7) {
    C.stroke.push(q);
    C.lastTickLen += d;
    if (C.lastTickLen > 55) {
      C.lastTickLen = 0;
      Snd.drawTick(C.stroke.length);
    }
  }
}

function onUp() {
  const C = G.craft;
  if (!C || C.phase !== 'draw' || !C.drawing) return;
  C.drawing = false;
  // どんな入力でも成立させる：短すぎる線はやさしいアーチに育てる
  if (U.polyLength(C.stroke) < 70) {
    const c = C.stroke[0];
    const cx = U.clamp(c.x, 260, 740), cy = U.clamp(c.y, 300, 700);
    C.stroke = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      C.stroke.push({ x: cx - 220 + 440 * t, y: cy + 60 - Math.sin(t * Math.PI) * 140 });
    }
  }
  Snd.tap();
  C.phase = 'dot';
}

// ポインタイベント（タッチ・マウス統合）
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (e.isPrimary) onDown(e.clientX, e.clientY);
}, { passive: false });
canvas.addEventListener('pointermove', e => {
  e.preventDefault();
  if (e.isPrimary) onMove(e.clientX, e.clientY);
}, { passive: false });
window.addEventListener('pointerup', e => { if (e.isPrimary) onUp(); });
window.addEventListener('pointercancel', () => onUp());

/* ============================================================
   メインループ
   ============================================================ */
let lastT = performance.now();
function frame(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  G.time += dt;
  G.sceneT += dt;

  ctx.clearRect(0, 0, W, H);
  updateParticles(dt);

  if (G.scene === 'title') drawTitle(dt);
  else if (G.scene === 'town') drawTown(dt);
  else if (G.scene === 'craft') drawCraft(dt);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
