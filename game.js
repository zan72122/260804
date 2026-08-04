// すいどうやさん — 4歳児向け 水道修理ゲーム
// 文字なし・失敗なし・採点なし・一指操作
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---- 仮想座標系 (1000x1000 の正方形シーンを常に内接表示) ----
const VW = 1000, VH = 1000;
let scale = 1, offX = 0, offY = 0, dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  scale = Math.min(w / VW, h / VH);
  offX = (w - VW * scale) / 2;
  offY = (h - VH * scale) / 2;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

function toGame(cx, cy) {
  return { x: (cx - offX) / scale, y: (cy - offY) / scale };
}

// ---- ユーティリティ ----
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
function rnd(a, b) { return a + Math.random() * (b - a); }

// ---- サウンド (WebAudio 合成・素材不要) ----
const AudioSys = {
  ctx: null, master: null, waterNode: null, waterGain: null, dripTimer: 0,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  drip() { this.tone(900, 0.18, 'sine', 0.25, 300); },
  pop() { this.tone(400, 0.12, 'square', 0.12, 800); },
  snap() { this.tone(600, 0.1, 'triangle', 0.3, 900); this.tone(1200, 0.15, 'sine', 0.15); },
  click() { this.tone(1500, 0.04, 'square', 0.12, 900); },
  whoosh() { this.tone(300, 0.4, 'sine', 0.2, 1000); },
  slideDown() { this.tone(1000, 0.45, 'sine', 0.2, 250); },
  chime() {
    if (!this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.5, 'sine', 0.22), i * 110);
    });
  },
  bigChime() {
    if (!this.ctx) return;
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.7, 'sine', 0.2), i * 90);
    });
  },
  waterOn() {
    if (!this.ctx || this.waterNode) return;
    const bufSize = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 900; filt.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.14, this.ctx.currentTime + 1.2);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start();
    this.waterNode = src; this.waterGain = g;
  },
  waterOff() {
    if (!this.ctx || !this.waterNode) return;
    const g = this.waterGain, s = this.waterNode;
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
    setTimeout(() => { try { s.stop(); } catch (e) {} }, 500);
    this.waterNode = null; this.waterGain = null;
  }
};

// ---- パーティクル ----
const particles = [];
function spawnSparkle(x, y, n, color) {
  for (let i = 0; i < (n || 8); i++) {
    const a = rnd(0, Math.PI * 2), sp = rnd(60, 260);
    particles.push({
      type: 'star', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
      life: rnd(0.5, 1), age: 0, size: rnd(8, 20),
      color: color || ['#ffd93d', '#ff9de2', '#7ce7ff', '#b0ff8a'][i % 4],
      rot: rnd(0, Math.PI * 2), vr: rnd(-5, 5)
    });
  }
}
function spawnDroplet(x, y, vx, vy) {
  particles.push({ type: 'drop', x, y, vx: vx || rnd(-60, 60), vy: vy || rnd(-160, -40), life: 0.8, age: 0, size: rnd(4, 9), color: '#6fc8f7' });
}
function spawnHeart(x, y) {
  particles.push({ type: 'heart', x, y, vx: rnd(-30, 30), vy: rnd(-130, -70), life: 1.4, age: 0, size: rnd(14, 26), color: '#ff8fb2', rot: rnd(-0.4, 0.4), vr: 0 });
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.type !== 'heart') p.vy += 500 * dt; else p.vy += 30 * dt;
    if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
  }
}
function drawStar(c, x, y, r, rot) {
  c.save(); c.translate(x, y); c.rotate(rot || 0);
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    c[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath(); c.fill(); c.restore();
}
function drawHeartShape(c, x, y, s, rot) {
  c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s / 24, s / 24);
  c.beginPath();
  c.moveTo(0, 6);
  c.bezierCurveTo(-14, -6, -6, -16, 0, -8);
  c.bezierCurveTo(6, -16, 14, -6, 0, 6);
  c.closePath(); c.fill(); c.restore();
}
function drawParticles(c) {
  for (const p of particles) {
    const a = 1 - p.age / p.life;
    c.globalAlpha = a;
    c.fillStyle = p.color;
    if (p.type === 'star') drawStar(c, p.x, p.y, p.size * (0.5 + a * 0.5), p.rot);
    else if (p.type === 'heart') drawHeartShape(c, p.x, p.y, p.size, p.rot);
    else { c.beginPath(); c.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); c.fill(); }
  }
  c.globalAlpha = 1;
}

// ---- 入力 (一指のみ・全面ヒット) ----
const input = {
  down: false, x: 0, y: 0, px: 0, py: 0,
  tapped: false, moved: 0, idle: 0
};
function onDown(cx, cy) {
  AudioSys.init(); AudioSys.resume();
  const p = toGame(cx, cy);
  input.down = true; input.x = p.x; input.y = p.y;
  input.px = p.x; input.py = p.y; input.moved = 0; input.idle = 0;
  Game.onPointerDown(p.x, p.y);
}
function onMove(cx, cy) {
  if (!input.down) return;
  const p = toGame(cx, cy);
  const dx = p.x - input.x, dy = p.y - input.y;
  input.moved += Math.hypot(dx, dy);
  input.px = input.x; input.py = input.y;
  input.x = p.x; input.y = p.y; input.idle = 0;
  Game.onPointerMove(p.x, p.y, dx, dy);
}
function onUp() {
  if (!input.down) return;
  input.down = false; input.idle = 0;
  Game.onPointerUp(input.x, input.y, input.moved < 24);
}
canvas.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; onDown(t.clientX, t.clientY); }, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); const t = e.changedTouches[0]; onMove(t.clientX, t.clientY); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); onUp(); }, { passive: false });
canvas.addEventListener('touchcancel', e => { e.preventDefault(); onUp(); }, { passive: false });
canvas.addEventListener('mousedown', e => onDown(e.clientX, e.clientY));
window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
window.addEventListener('mouseup', () => onUp());

// ---- パイプ経路 (修理シーン共通) ----
// 上の排水口 → 縦パイプ → Uトラップ → 横パイプ → 壁
function buildPipePath() {
  const pts = [];
  // 縦: (430,120) -> (430,470)
  for (let y = 120; y <= 470; y += 10) pts.push({ x: 430, y });
  // U字: 中心(510,470) 半径80 左(180°)から右(0°)へ下回り
  const cx = 510, cy = 470, r = 80;
  for (let a = Math.PI; a >= 0; a -= 0.08) {
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  // 横: (590,470) -> (870,470)
  for (let x = 590; x <= 870; x += 10) pts.push({ x, y: 470 });
  // 累積距離
  let total = 0;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    total += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    cum.push(total);
  }
  return { pts, cum, total };
}
const PIPE = buildPipePath();
function pipePointAt(t) {
  const target = clamp(t, 0, 1) * PIPE.total;
  let i = 1;
  while (i < PIPE.cum.length - 1 && PIPE.cum[i] < target) i++;
  const seg = PIPE.cum[i] - PIPE.cum[i - 1] || 1;
  const f = (target - PIPE.cum[i - 1]) / seg;
  const a = PIPE.pts[i - 1], b = PIPE.pts[i];
  return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), ang: Math.atan2(b.y - a.y, b.x - a.x) };
}

// ---- 描画ヘルパー ----
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// 透明パイプを経路に沿って描く (fillLevel: 0..1 水の到達割合)
function drawGlassPipe(c, width, fillLevel, time) {
  const w = width;
  // 外側ガラス
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = 'rgba(190,225,245,0.55)';
  c.lineWidth = w;
  strokePipePath(c, 1);
  // 水
  if (fillLevel > 0) {
    c.save();
    c.strokeStyle = '#4db8f0';
    c.globalAlpha = 0.85;
    c.lineWidth = w - 14;
    strokePipePath(c, fillLevel);
    // 流れの縞
    c.globalAlpha = 0.5;
    c.strokeStyle = '#a8e4ff';
    c.lineWidth = w - 30;
    c.setLineDash([40, 55]);
    c.lineDashOffset = -time * 260;
    strokePipePath(c, fillLevel);
    c.setLineDash([]);
    c.restore();
  }
  // ガラスのふち
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = 4;
  outlinePipePath(c, w / 2);
  // ハイライト
  c.strokeStyle = 'rgba(255,255,255,0.5)';
  c.lineWidth = 8;
  strokePipePathOffset(c, -w * 0.28);
}
function strokePipePath(c, upTo) {
  const n = Math.max(2, Math.floor(PIPE.pts.length * clamp(upTo, 0, 1)));
  c.beginPath();
  c.moveTo(PIPE.pts[0].x, PIPE.pts[0].y);
  for (let i = 1; i < n; i++) c.lineTo(PIPE.pts[i].x, PIPE.pts[i].y);
  c.stroke();
}
function strokePipePathOffset(c, off) {
  c.beginPath();
  let started = false;
  for (let i = 0; i < PIPE.pts.length - 1; i++) {
    const a = PIPE.pts[i], b = PIPE.pts[i + 1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    const x = a.x + Math.cos(ang) * off, y = a.y + Math.sin(ang) * off;
    if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
  }
  c.stroke();
}
function outlinePipePath(c, half) {
  strokePipePathOffset(c, -half);
  strokePipePathOffset(c, half);
}

// ---- 配管工キャラ ----
// pose: 'stand' | 'lie'  express: 'smile' | 'happy' | 'effort'
function drawPlumber(c, x, y, s, pose, express, time) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (pose === 'lie') c.rotate(-Math.PI / 2);
  const bob = Math.sin(time * 2.2) * 2;
  c.translate(0, bob);
  // 体 (オーバーオール)
  c.fillStyle = '#3d7dd8';
  rr(c, -34, -10, 68, 78, 22); c.fill();
  // 腕
  c.strokeStyle = '#ffb27a'; c.lineCap = 'round'; c.lineWidth = 16;
  const wave = express === 'happy' ? Math.sin(time * 8) * 0.5 : 0;
  c.beginPath(); c.moveTo(-30, 8); c.lineTo(-52, 34); c.stroke();
  c.save();
  c.translate(30, 8); c.rotate(express === 'happy' ? -1.8 + wave * 0.3 : 0.6);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 30); c.stroke();
  if (express === 'happy') { // サムズアップ
    c.fillStyle = '#ffb27a';
    c.beginPath(); c.arc(0, 34, 11, 0, Math.PI * 2); c.fill();
    rr(c, -5, 22, 10, 14, 5); c.fill();
  }
  c.restore();
  // 胸当て
  c.fillStyle = '#5a94e8';
  rr(c, -20, -8, 40, 30, 8); c.fill();
  // 足
  c.strokeStyle = '#2d5aa8'; c.lineWidth = 18;
  c.beginPath(); c.moveTo(-16, 62); c.lineTo(-16, 84); c.stroke();
  c.beginPath(); c.moveTo(16, 62); c.lineTo(16, 84); c.stroke();
  c.fillStyle = '#8a5a3a';
  rr(c, -28, 80, 24, 14, 6); c.fill();
  rr(c, 4, 80, 24, 14, 6); c.fill();
  // 頭
  c.fillStyle = '#ffcf9e';
  c.beginPath(); c.arc(0, -44, 34, 0, Math.PI * 2); c.fill();
  // ほっぺ
  c.fillStyle = 'rgba(255,140,140,0.5)';
  c.beginPath(); c.arc(-18, -36, 7, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(18, -36, 7, 0, Math.PI * 2); c.fill();
  // 目 (まばたき)
  const blink = (Math.sin(time * 0.9) > 0.97) ? 0.15 : 1;
  c.fillStyle = '#333';
  if (express === 'happy') {
    c.strokeStyle = '#333'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.arc(-12, -46, 7, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.beginPath(); c.arc(12, -46, 7, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
  } else {
    c.save(); c.translate(-12, -46); c.scale(1, blink);
    c.beginPath(); c.arc(0, 0, 5.5, 0, Math.PI * 2); c.fill(); c.restore();
    c.save(); c.translate(12, -46); c.scale(1, blink);
    c.beginPath(); c.arc(0, 0, 5.5, 0, Math.PI * 2); c.fill(); c.restore();
  }
  // 口
  c.strokeStyle = '#c96'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath();
  if (express === 'happy') c.arc(0, -32, 10, 0.15 * Math.PI, 0.85 * Math.PI);
  else c.arc(0, -34, 7, 0.2 * Math.PI, 0.8 * Math.PI);
  c.stroke();
  // 帽子
  c.fillStyle = '#e8543f';
  c.beginPath(); c.arc(0, -58, 30, Math.PI, 0); c.fill();
  rr(c, -34, -62, 68, 10, 5); c.fill();
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(0, -70, 9, 0, Math.PI * 2); c.fill();
  c.restore();
}

// ---- キッチンシーン (導入) ----
function drawKitchen(c, time, g) {
  // 壁と床
  const wallGrad = c.createLinearGradient(0, 0, 0, 700);
  wallGrad.addColorStop(0, '#fdf3dc');
  wallGrad.addColorStop(1, '#f7e6c4');
  c.fillStyle = wallGrad;
  c.fillRect(-200, -200, VW + 400, 1020);
  c.fillStyle = '#d9a05f';
  c.fillRect(-200, 820, VW + 400, 400);
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 5;
  for (let x = -100; x < 1100; x += 160) {
    c.beginPath(); c.moveTo(x, 820); c.lineTo(x - 40, 1220); c.stroke();
  }
  // 窓
  rr(c, 660, 120, 260, 220, 20);
  c.fillStyle = '#aee3ff'; c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 14; c.stroke();
  c.beginPath(); c.moveTo(790, 130); c.lineTo(790, 330); c.stroke();
  // 太陽
  c.fillStyle = '#ffd93d';
  c.beginPath(); c.arc(720, 190, 34, 0, Math.PI * 2); c.fill();
  // 雲
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(850, 250, 22, 0, Math.PI * 2);
  c.arc(880, 245, 26, 0, Math.PI * 2); c.arc(830, 260, 18, 0, Math.PI * 2); c.fill();
  // カウンター
  c.fillStyle = '#8fce6e';
  rr(c, 60, 380, 560, 46, 14); c.fill();
  // シンク
  c.fillStyle = '#cfd8e0';
  rr(c, 150, 384, 330, 38, 10); c.fill();
  c.fillStyle = '#aeb9c4';
  rr(c, 175, 392, 280, 24, 8); c.fill();
  // 蛇口
  c.strokeStyle = '#9aa7b5'; c.lineWidth = 22; c.lineCap = 'round';
  c.beginPath(); c.moveTo(315, 384); c.lineTo(315, 300); c.arc(345, 300, 30, Math.PI, 0);
  c.lineTo(375, 330); c.stroke();
  c.fillStyle = '#e8543f';
  c.beginPath(); c.arc(315, 288, 16, 0, Math.PI * 2); c.fill();
  // キャビネット (扉オープン)
  c.fillStyle = '#c98a4b';
  rr(c, 80, 426, 520, 394, 12); c.fill();
  c.fillStyle = '#3a2a20';
  rr(c, 130, 450, 420, 350, 10); c.fill();
  // 開いた扉
  c.fillStyle = '#b87a3e';
  rr(c, 40, 440, 80, 370, 10); c.fill();
  rr(c, 560, 440, 80, 370, 10); c.fill();
  c.fillStyle = '#ffd93d';
  c.beginPath(); c.arc(105, 620, 9, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(575, 620, 9, 0, Math.PI * 2); c.fill();
  // キャビネット内のパイプ (ミニチュア)
  c.strokeStyle = 'rgba(200,230,248,0.8)'; c.lineWidth = 30; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(310, 452); c.lineTo(310, 610);
  c.arc(345, 610, 35, Math.PI, 0, true);
  c.lineTo(380, 590); c.lineTo(380, 560); c.lineTo(520, 560);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(297, 452); c.lineTo(297, 608); c.stroke();
  c.beginPath(); c.moveTo(323, 452); c.lineTo(323, 600); c.stroke();
  // 漏れタライ + 水たまり
  c.fillStyle = 'rgba(110,190,240,0.7)';
  c.beginPath(); c.ellipse(345, 780, 90, 20, 0, 0, Math.PI * 2); c.fill();
  // しずく (ポタポタ)
  for (const d of g.drops) {
    c.fillStyle = '#6fc8f7';
    c.beginPath();
    c.moveTo(d.x, d.y - 14);
    c.quadraticCurveTo(d.x + 9, d.y, d.x, d.y + 9);
    c.quadraticCurveTo(d.x - 9, d.y, d.x, d.y - 14);
    c.fill();
  }
}

// ---- ゲーム本体 ----
const Game = {
  state: 'intro',      // intro -> dive -> wire -> packing -> hose -> wrench -> flow
  time: 0,
  stateTime: 0,
  hintTimer: 0,
  // 導入
  plumberX: 810, plumberY: 730,
  diveT: 0,
  drops: [],
  dripClock: 0,
  // ワイヤー
  wireT: 0, gunkGone: false, gunkScale: 1,
  // パッキン
  packing: { x: 820, y: 750, held: false, snapped: false, popT: 0 },
  oldGasketT: 0,
  // ホース
  hose: { x: 250, y: 260, held: false, snapped: false },
  hoseAnchor: { x: 130, y: 150 },
  hoseTarget: { x: 430, y: 90 },
  // レンチ
  wrenchAngle: 0, wrenchTurns: 0, wrenchDone: false, lastClickAt: 0,
  // 報酬
  flowT: 0, celebrated: false, replayPulse: 0,
  bubbles: [],
  transition: 0, transitioning: false,

  jointPos() { return { x: 590, y: 470 }; },

  setState(s) {
    this.state = s;
    this.stateTime = 0;
    this.hintTimer = 0;
  },

  reset() {
    AudioSys.waterOff();
    this.setState('intro');
    this.plumberX = 810; this.diveT = 0;
    this.drops = []; this.dripClock = 0;
    this.wireT = 0; this.gunkGone = false; this.gunkScale = 1;
    this.packing = { x: 170, y: 800, held: false, snapped: false, popT: 0 };
    this.oldGasketT = 0;
    this.hose = { x: 250, y: 260, held: false, snapped: false };
    this.wrenchAngle = 0; this.wrenchTurns = 0; this.wrenchDone = false;
    this.flowT = 0; this.celebrated = false; this.bubbles = [];
    particles.length = 0;
  },

  // --- 入力 ---
  onPointerDown(x, y) {
    this.hintTimer = 0;
    if (this.state === 'intro') {
      // どこを押しても配管工が潜る (強い入力補助)
      this.setState('dive');
      AudioSys.slideDown();
      return;
    }
    if (this.state === 'packing' && !this.packing.snapped) {
      // 大きな掴み判定 + どこを触ってもパッキンが指へ吸い付く
      this.packing.held = true;
      AudioSys.pop();
      spawnSparkle(this.packing.x, this.packing.y, 4, '#ffb84d');
    }
    if (this.state === 'hose' && !this.hose.snapped) {
      this.hose.held = true;
      AudioSys.pop();
    }
    if (this.state === 'flow' && this.flowT > 2.5) {
      // もう一回ボタン (大きい円 / 画面下中央)
      if (dist(x, y, 500, 880) < 110) {
        AudioSys.chime();
        this.reset();
      } else {
        // 水中タッチ → 泡としぶきのごほうび
        spawnSparkle(x, y, 6, '#7ce7ff');
        spawnHeart(x, y);
        AudioSys.pop();
      }
    }
  },

  onPointerMove(x, y, dx, dy) {
    const mag = Math.hypot(dx, dy);
    if (this.state === 'wire') {
      // どの方向へ動かしてもワイヤーが進む (スルスル)
      this.wireT = clamp(this.wireT + mag / PIPE.total * 1.6, 0, 1);
      if (Math.random() < 0.12) AudioSys.click();
      if (this.wireT >= 1) this.finishWire();
    } else if (this.state === 'packing' && this.packing.held) {
      // 指へ吸い付き (少し遅れてついてくる)
      this.packing.x = lerp(this.packing.x, x, 0.5);
      this.packing.y = lerp(this.packing.y, y, 0.5);
      const j = this.jointPos();
      if (dist(this.packing.x, this.packing.y, j.x, j.y) < 130) this.snapPacking();
    } else if (this.state === 'hose' && this.hose.held) {
      this.hose.x = lerp(this.hose.x, x, 0.5);
      this.hose.y = lerp(this.hose.y, y, 0.5);
      const t = this.hoseTarget;
      if (dist(this.hose.x, this.hose.y, t.x, t.y) < 130) this.snapHose();
    } else if (this.state === 'wrench' && !this.wrenchDone) {
      // どんな動きでもグイッと回る (強い補助)
      const turn = mag * 0.012;
      this.wrenchAngle += turn;
      this.wrenchTurns += turn;
      if (this.wrenchTurns - this.lastClickAt > Math.PI / 3) {
        this.lastClickAt = this.wrenchTurns;
        AudioSys.click();
        const j = this.jointPos();
        spawnSparkle(j.x + rnd(-40, 40), j.y + rnd(-40, 40), 2, '#ffd93d');
      }
      if (this.wrenchTurns >= Math.PI * 4.5) this.finishWrench();
    }
  },

  onPointerUp(x, y, wasTap) {
    if (this.state === 'packing' && this.packing.held && !this.packing.snapped) {
      this.packing.held = false;
      const j = this.jointPos();
      if (dist(this.packing.x, this.packing.y, j.x, j.y) < 200) this.snapPacking();
    }
    if (this.state === 'hose' && this.hose.held && !this.hose.snapped) {
      this.hose.held = false;
      const t = this.hoseTarget;
      if (dist(this.hose.x, this.hose.y, t.x, t.y) < 200) this.snapHose();
    }
  },

  // --- 各ステップ完了 ---
  finishWire() {
    if (this.gunkGone) return;
    this.gunkGone = true;
    AudioSys.chime();
    const p = pipePointAt(1);
    spawnSparkle(p.x, p.y, 14);
    setTimeout(() => { this.setState('packing'); AudioSys.pop(); }, 900);
  },
  snapPacking() {
    if (this.packing.snapped) return;
    this.packing.snapped = true; this.packing.held = false;
    const j = this.jointPos();
    this.packing.x = j.x; this.packing.y = j.y;
    AudioSys.snap();
    spawnSparkle(j.x, j.y, 12);
    setTimeout(() => this.setState('hose'), 800);
  },
  snapHose() {
    if (this.hose.snapped) return;
    this.hose.snapped = true; this.hose.held = false;
    this.hose.x = this.hoseTarget.x; this.hose.y = this.hoseTarget.y;
    AudioSys.snap();
    spawnSparkle(this.hose.x, this.hose.y, 12);
    setTimeout(() => this.setState('wrench'), 800);
  },
  finishWrench() {
    if (this.wrenchDone) return;
    this.wrenchDone = true;
    AudioSys.snap();
    const j = this.jointPos();
    spawnSparkle(j.x, j.y, 18);
    // ポタポタ → ピタッ
    setTimeout(() => {
      AudioSys.bigChime();
      this.setState('flow');
      AudioSys.waterOn();
    }, 1100);
  },

  // --- 更新 ---
  update(dt) {
    this.time += dt;
    this.stateTime += dt;
    this.hintTimer += dt;
    updateParticles(dt);

    // 漏れのしずく (修理完了まで)
    const leaking = this.state !== 'flow' &&
      !(this.state === 'wrench' && this.wrenchDone);
    if (leaking) {
      // レンチが進むほどゆっくりに
      let interval = 0.75;
      if (this.state === 'wrench') {
        interval = 0.75 + (this.wrenchTurns / (Math.PI * 4.5)) * 2.2;
      }
      this.dripClock += dt;
      if (this.dripClock > interval) {
        this.dripClock = 0;
        const src = this.state === 'intro' || this.state === 'dive'
          ? { x: 380, y: 600 } : { x: 590, y: 500 };
        this.drops.push({ x: src.x, y: src.y, vy: 0 });
        AudioSys.drip();
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.vy += 900 * dt; d.y += d.vy * dt;
      const floorY = this.state === 'intro' || this.state === 'dive' ? 770 : 860;
      if (d.y > floorY) {
        this.drops.splice(i, 1);
        for (let k = 0; k < 3; k++) spawnDroplet(d.x + rnd(-10, 10), floorY, rnd(-50, 50), rnd(-120, -30));
      }
    }

    if (this.state === 'dive') {
      this.diveT = Math.min(1, this.diveT + dt / 1.6);
      if (this.diveT >= 1) {
        this.setState('wire');
        AudioSys.whoosh();
      }
    }
    if (this.state === 'packing' && this.packing.popT < 1) {
      this.packing.popT = Math.min(1, this.packing.popT + dt / 0.5);
    }
    if (this.state === 'flow') {
      this.flowT += dt;
      // 泡 (透明な管の中を流れる)
      if (Math.random() < 0.3) {
        this.bubbles.push({ t: 0, off: rnd(-14, 14), r: rnd(4, 10), sp: rnd(0.18, 0.3) });
      }
      for (let i = this.bubbles.length - 1; i >= 0; i--) {
        const b = this.bubbles[i];
        b.t += b.sp * dt;
        if (b.t >= 1) this.bubbles.splice(i, 1);
      }
      if (!this.celebrated && this.flowT > 0.6) {
        this.celebrated = true;
        for (let k = 0; k < 3; k++) {
          setTimeout(() => {
            spawnSparkle(rnd(200, 800), rnd(200, 600), 10);
            spawnHeart(rnd(300, 700), rnd(300, 600));
          }, k * 350);
        }
      }
      if (Math.random() < dt * 1.2) spawnHeart(rnd(250, 750), rnd(500, 700));
    }
  }
};

// ---- 修理シーン描画 ----
function drawRepairScene(c, g) {
  const t = g.time;
  // キャビネットの中 (暗めの木目 + 明るいスポット)
  const bg = c.createRadialGradient(500, 450, 100, 500, 500, 750);
  bg.addColorStop(0, '#6b5140');
  bg.addColorStop(1, '#3a2a20');
  c.fillStyle = bg;
  c.fillRect(-200, -200, VW + 400, VH + 400);
  // 木目ライン
  c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 6;
  for (let y = 40; y < 1000; y += 90) {
    c.beginPath(); c.moveTo(-100, y); c.quadraticCurveTo(500, y + 25, 1100, y); c.stroke();
  }
  // 床板
  c.fillStyle = '#8a6a4a';
  rr(c, -100, 870, 1200, 250, 0); c.fill();

  // 壁の接続口 (右) と 給水バルブ (ホースの繋ぎ先は排水口の横)
  c.fillStyle = '#5a4433';
  rr(c, 870, 420, 130, 100, 16); c.fill();
  c.fillStyle = '#7a5f47';
  c.beginPath(); c.ellipse(880, 470, 20, 46, 0, 0, Math.PI * 2); c.fill();

  // 上のシンク底 + 排水口
  c.fillStyle = '#aeb9c4';
  rr(c, 120, -40, 760, 110, 24); c.fill();
  c.fillStyle = '#8a97a5';
  c.beginPath(); c.ellipse(430, 72, 58, 22, 0, 0, Math.PI * 2); c.fill();

  const flowLevel = g.state === 'flow' ? clamp(g.flowT / 2.2, 0, 1) : 0;

  // 透明パイプ
  drawGlassPipe(c, 64, flowLevel, t);

  // 継ぎ目ナット (漏れポイント)
  const j = g.jointPos();
  drawNut(c, j.x, j.y, g);

  // つまり (汚れ玉)
  if (!g.gunkGone) {
    const gp = pipePointAt(clamp(0.45 + g.wireT * 0.5, 0, 0.93));
    const squish = 1 + Math.sin(t * 6) * 0.06;
    c.fillStyle = '#8fbf5a';
    c.beginPath(); c.ellipse(gp.x, gp.y, 24 * squish, 20 / squish, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#6f9f42';
    c.beginPath(); c.arc(gp.x - 7, gp.y - 5, 6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(gp.x + 8, gp.y + 4, 4, 0, Math.PI * 2); c.fill();
    // 困り目
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(gp.x - 6, gp.y - 2, 5, 0, Math.PI * 2);
    c.arc(gp.x + 6, gp.y - 2, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#333';
    c.beginPath(); c.arc(gp.x - 6, gp.y - 1, 2.4, 0, Math.PI * 2);
    c.arc(gp.x + 6, gp.y - 1, 2.4, 0, Math.PI * 2); c.fill();
  }

  // ワイヤー (ステップ1)
  if (g.state === 'wire' || (g.state === 'packing' && g.stateTime < 0.5)) {
    drawWire(c, g);
  }

  // ホース (銀色フレキ管): 壁左上のバルブ → 排水口横
  drawHose(c, g);

  // パッキン (ステップ2以降)
  if (g.state === 'packing' || (!g.packing.snapped && (g.state === 'hose' || g.state === 'wrench'))) {
    if (!g.packing.snapped) drawPacking(c, g.packing.x, g.packing.y, 1 + Math.sin(t * 4) * 0.06);
  }

  // レンチ (ステップ4) — ナットを掴んで見えるよう、上からナットを描き直す
  if (g.state === 'wrench') {
    drawWrench(c, j.x, j.y, g.wrenchAngle, g.wrenchDone);
    drawNut(c, j.x, j.y, g);
  }

  // しずく
  for (const d of g.drops) {
    c.fillStyle = '#6fc8f7';
    c.beginPath();
    c.moveTo(d.x, d.y - 12);
    c.quadraticCurveTo(d.x + 8, d.y, d.x, d.y + 8);
    c.quadraticCurveTo(d.x - 8, d.y, d.x, d.y - 12);
    c.fill();
  }

  // 泡 (ごほうびの流れ)
  if (g.state === 'flow') {
    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (const b of g.bubbles) {
      if (b.t > flowLevel) continue;
      const p = pipePointAt(b.t);
      const nx = Math.cos(p.ang + Math.PI / 2), ny = Math.sin(p.ang + Math.PI / 2);
      c.beginPath();
      c.arc(p.x + nx * b.off, p.y + ny * b.off, b.r, 0, Math.PI * 2);
      c.fill();
    }
    // 壁の出口へジャバー
    if (flowLevel >= 1) {
      const e = pipePointAt(1);
      for (let k = 0; k < 2; k++) {
        if (Math.random() < 0.5) spawnDroplet(e.x + 20, e.y + rnd(-16, 16), rnd(60, 160), rnd(-60, 20));
      }
    }
  }

  // 寝転ぶ配管工
  const express = g.state === 'flow' ? 'happy' : 'smile';
  drawPlumber(c, 210, 900, 1.15, 'lie', express, t);

  // もう一回ボタン (ごほうび後)
  if (g.state === 'flow' && g.flowT > 2.5) {
    const pulse = 1 + Math.sin(t * 3) * 0.06;
    c.save();
    c.translate(500, 880);
    c.scale(pulse, pulse);
    c.fillStyle = '#ffd93d';
    c.beginPath(); c.arc(0, 0, 78, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 8; c.stroke();
    // ↻ 矢印
    c.strokeStyle = '#e8543f'; c.lineWidth = 14; c.lineCap = 'round';
    c.beginPath(); c.arc(0, 0, 36, -0.4, Math.PI * 1.45); c.stroke();
    const aa = -0.4;
    const ax = Math.cos(aa) * 36, ay = Math.sin(aa) * 36;
    c.fillStyle = '#e8543f';
    c.save(); c.translate(ax, ay); c.rotate(aa + Math.PI / 2);
    c.beginPath(); c.moveTo(0, -20); c.lineTo(14, 8); c.lineTo(-14, 8); c.closePath(); c.fill();
    c.restore();
    c.restore();
  }
}

function drawNut(c, x, y, g) {
  const done = g.wrenchDone || g.state === 'flow';
  c.save();
  c.translate(x, y);
  c.fillStyle = done ? '#ffb84d' : '#c9a227';
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + (g.wrenchAngle || 0) * 0.5;
    const px = Math.cos(a) * 46, py = Math.sin(a) * 46;
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 4; c.stroke();
  c.fillStyle = 'rgba(0,0,0,0.15)';
  c.beginPath(); c.arc(0, 0, 24, 0, Math.PI * 2); c.fill();
  // 装着済みパッキンリング
  if (g.packing.snapped) {
    c.strokeStyle = '#ff8c42'; c.lineWidth = 10;
    c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.stroke();
  }
  if (done) {
    const tw = 0.5 + Math.sin(g.time * 5) * 0.5;
    c.globalAlpha = tw;
    c.fillStyle = '#fff';
    drawStar(c, 30, -30, 12, g.time);
    c.globalAlpha = 1;
  }
  c.restore();
}

function drawWire(c, g) {
  // コイル (入口の上)
  c.strokeStyle = '#e86a6a'; c.lineWidth = 10; c.lineCap = 'round';
  const coilX = 300, coilY = 40;
  c.beginPath();
  for (let a = 0; a < Math.PI * 5; a += 0.15) {
    const r = 34 - a * 1.4;
    if (r < 6) break;
    const px = coilX + Math.cos(a) * r, py = coilY + Math.sin(a) * r * 0.7;
    a === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.stroke();
  // パイプ内のワイヤー本体
  const n = Math.max(2, Math.floor(PIPE.pts.length * g.wireT));
  c.strokeStyle = '#ff8c8c'; c.lineWidth = 12;
  c.beginPath();
  c.moveTo(coilX + 30, coilY);
  c.quadraticCurveTo(400, 60, PIPE.pts[0].x, PIPE.pts[0].y);
  for (let i = 1; i < n; i++) c.lineTo(PIPE.pts[i].x, PIPE.pts[i].y);
  c.stroke();
  // 先端 (ブラシヘッド)
  const tip = pipePointAt(g.wireT);
  const wig = Math.sin(g.time * 10) * 0.2;
  c.save();
  c.translate(tip.x, tip.y); c.rotate(tip.ang + wig);
  c.fillStyle = '#ffd93d';
  c.beginPath(); c.arc(0, 0, 15, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#e8a03f'; c.lineWidth = 5; c.lineCap = 'round';
  for (let k = -2; k <= 2; k++) {
    c.beginPath(); c.moveTo(4, 0); c.lineTo(20, k * 8); c.stroke();
  }
  c.restore();
}

function drawPacking(c, x, y, s) {
  c.save();
  c.translate(x, y); c.scale(s, s);
  c.strokeStyle = '#ff8c42'; c.lineWidth = 16;
  c.beginPath(); c.arc(0, 0, 40, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 5;
  c.beginPath(); c.arc(0, 0, 46, 0, Math.PI * 2); c.stroke();
  c.restore();
}

function drawHose(c, g) {
  const a = g.hoseAnchor;
  const end = g.hose.snapped ? { x: g.hoseTarget.x - 60, y: g.hoseTarget.y + 10 } : g.hose;
  // 壁バルブ
  c.fillStyle = '#7a8a99';
  rr(c, a.x - 34, a.y - 34, 68, 68, 14); c.fill();
  c.fillStyle = '#4db8f0';
  c.beginPath(); c.arc(a.x, a.y, 18, 0, Math.PI * 2); c.fill();
  // フレキホース (ジャバラ)
  const midX = (a.x + end.x) / 2, midY = Math.max(a.y, end.y) + (g.hose.snapped ? 40 : 130);
  const N = 26;
  c.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const p0 = qBez(a, { x: midX, y: midY }, end, t0);
    const p1 = qBez(a, { x: midX, y: midY }, end, t1);
    c.strokeStyle = i % 2 === 0 ? '#c4ced8' : '#9fadbb';
    c.lineWidth = 26;
    c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
  }
  // 先端の金具
  c.fillStyle = g.hose.snapped ? '#ffb84d' : '#c9a227';
  c.save();
  c.translate(end.x, end.y);
  rr(c, -20, -20, 40, 40, 8); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3; c.stroke();
  c.restore();
  // 繋ぎ先ソケット (排水口の左横) — 未接続なら光る
  if (!g.hose.snapped && (g.state === 'hose')) {
    const tw = 0.5 + Math.sin(g.time * 4) * 0.4;
    c.globalAlpha = tw;
    c.strokeStyle = '#7ce7ff'; c.lineWidth = 6;
    c.beginPath(); c.arc(g.hoseTarget.x - 60, g.hoseTarget.y + 10, 36, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
  }
}
function qBez(p0, p1, p2, t) {
  const a = 1 - t;
  return {
    x: a * a * p0.x + 2 * a * t * p1.x + t * t * p2.x,
    y: a * a * p0.y + 2 * a * t * p1.y + t * t * p2.y
  };
}

function drawWrench(c, x, y, angle, done) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  // 柄 (赤いグリップ)
  c.fillStyle = '#e8543f';
  rr(c, -20, 70, 40, 150, 20); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.3)';
  rr(c, -10, 82, 12, 126, 6); c.fill();
  // 首 (銀)
  c.fillStyle = '#b8c4d0';
  rr(c, -15, 40, 30, 46, 8); c.fill();
  // 頭: ナットをくわえる開口リング
  c.strokeStyle = '#b8c4d0';
  c.lineWidth = 26;
  c.beginPath();
  c.arc(0, 0, 58, Math.PI * 0.32, Math.PI * 2 - Math.PI * 0.32 + Math.PI / 2);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.45)';
  c.lineWidth = 8;
  c.beginPath();
  c.arc(0, 0, 64, Math.PI * 0.5, Math.PI * 1.6);
  c.stroke();
  c.restore();
}

// ---- ヒント (指マーク・文字なし) ----
function drawHint(c, g) {
  if (g.hintTimer < 3 || input.down) return;
  const t = g.time;
  const ph = (t % 1.6) / 1.6;
  let hx, hy, mode = 'tap';
  if (g.state === 'intro') { hx = 810; hy = 640; mode = 'tap'; }
  else if (g.state === 'wire') {
    const p = pipePointAt(0.15 + ph * 0.5);
    hx = p.x + 130; hy = p.y; mode = 'follow';
  } else if (g.state === 'packing' && !g.packing.snapped) {
    const j = g.jointPos();
    hx = lerp(g.packing.held ? input.x : g.packing.x, j.x, ease(ph));
    hy = lerp(g.packing.held ? input.y : g.packing.y, j.y, ease(ph));
    mode = 'drag';
  } else if (g.state === 'hose' && !g.hose.snapped) {
    hx = lerp(g.hose.x, g.hoseTarget.x - 60, ease(ph));
    hy = lerp(g.hose.y, g.hoseTarget.y + 10, ease(ph));
    mode = 'drag';
  } else if (g.state === 'wrench' && !g.wrenchDone) {
    const j = g.jointPos();
    const a = ph * Math.PI * 2;
    hx = j.x + Math.cos(a) * 150;
    hy = j.y + Math.sin(a) * 150;
    mode = 'drag';
  } else if (g.state === 'flow' && g.flowT > 6) { hx = 500; hy = 880; mode = 'tap'; }
  else return;

  c.save();
  c.globalAlpha = 0.9;
  // タップ波紋
  if (mode === 'tap') {
    const rp = ph;
    c.strokeStyle = '#fff'; c.lineWidth = 5;
    c.globalAlpha = (1 - rp) * 0.8;
    c.beginPath(); c.arc(hx, hy - 10, 20 + rp * 50, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 0.9;
  }
  // 手 (ゆび)
  c.translate(hx, hy);
  if (mode === 'tap') c.translate(0, Math.sin(ph * Math.PI * 2) * 8);
  c.fillStyle = '#fff';
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3;
  c.beginPath();
  c.arc(0, -14, 13, Math.PI, 0);
  c.lineTo(13, 26); c.arc(0, 26, 13, 0, Math.PI);
  c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.arc(16, 22, 11, 0, Math.PI * 2); c.fill();
  c.restore();
}

// ---- 描画ディスパッチ ----
function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#7a5f47';
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);
  const g = Game;

  if (g.state === 'intro' || g.state === 'dive') {
    drawKitchen(ctx, g.time, g);
    // 配管工: dive で左へスライドしてキャビネットへスルッ
    if (g.state === 'intro') {
      drawPlumber(ctx, g.plumberX, g.plumberY, 1.3, 'stand', 'smile', g.time);
    } else {
      const dt2 = ease(g.diveT);
      const px = lerp(810, 345, clamp(dt2 * 1.6, 0, 1));
      const py = lerp(730, 700, clamp((dt2 - 0.5) * 2, 0, 1));
      const s = lerp(1.3, 0.7, clamp((dt2 - 0.55) * 2.4, 0, 1));
      const pose = dt2 > 0.55 ? 'lie' : 'stand';
      drawPlumber(ctx, px, py, s, pose, 'smile', g.time);
      // ズームインのフェード
      if (g.diveT > 0.72) {
        ctx.fillStyle = `rgba(58,42,32,${(g.diveT - 0.72) / 0.28})`;
        ctx.fillRect(-200, -200, VW + 400, VH + 400);
      }
    }
  } else {
    drawRepairScene(ctx, g);
    // 修理シーンへのフェードイン
    if ((g.state === 'wire') && g.stateTime < 0.5) {
      ctx.fillStyle = `rgba(58,42,32,${1 - g.stateTime / 0.5})`;
      ctx.fillRect(-200, -200, VW + 400, VH + 400);
    }
  }
  drawParticles(ctx);
  drawHint(ctx, g);
}

// ---- メインループ ----
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  Game.update(dt);
  render();
  requestAnimationFrame(loop);
}
Game.drops = [];
requestAnimationFrame(loop);
