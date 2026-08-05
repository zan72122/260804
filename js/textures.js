// 手続きテクスチャ生成 — 木目・布・壁・カードなど、使用感（汚れ・摩耗）込みで描く
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 乱数（決定的でなくて良い）
const R = Math.random;

function grain(ctx, w, h, n, alpha, dark = true) {
  for (let i = 0; i < n; i++) {
    const g = dark ? 0 : 255;
    ctx.fillStyle = `rgba(${g},${g},${g},${R() * alpha})`;
    ctx.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2);
  }
}

// ---- 床板（幅広の年季が入った板） ----
export function floorWood() {
  const [c, x] = canvas(1024, 1024);
  x.fillStyle = '#6b4a2e'; x.fillRect(0, 0, 1024, 1024);
  const planks = 8;
  for (let p = 0; p < planks; p++) {
    const y0 = p * 128;
    const base = 88 + R() * 26;
    x.fillStyle = `rgb(${base + 20},${base * 0.72 | 0},${base * 0.45 | 0})`;
    x.fillRect(0, y0, 1024, 126);
    // 木目
    for (let i = 0; i < 26; i++) {
      x.strokeStyle = `rgba(40,22,10,${0.05 + R() * 0.1})`;
      x.lineWidth = 1 + R() * 2;
      x.beginPath();
      const yy = y0 + R() * 126;
      x.moveTo(0, yy);
      for (let xx = 0; xx <= 1024; xx += 64) x.lineTo(xx, yy + Math.sin(xx * 0.01 + p) * 6 * R());
      x.stroke();
    }
    // 節
    for (let k = 0; k < 2; k++) {
      const kx = R() * 1024, ky = y0 + 20 + R() * 86;
      const g = x.createRadialGradient(kx, ky, 1, kx, ky, 9);
      g.addColorStop(0, 'rgba(35,18,8,0.85)'); g.addColorStop(1, 'rgba(35,18,8,0)');
      x.fillStyle = g; x.beginPath(); x.arc(kx, ky, 9, 0, 7); x.fill();
    }
    // 板の継ぎ目
    x.fillStyle = 'rgba(20,10,4,0.75)'; x.fillRect(0, y0 + 125, 1024, 3);
    const seam = R() * 1024;
    x.fillRect(seam, y0, 2, 126);
  }
  // すり傷・汚れ
  for (let i = 0; i < 40; i++) {
    x.strokeStyle = `rgba(230,210,180,${0.03 + R() * 0.05})`;
    x.lineWidth = 1;
    x.beginPath();
    const sx = R() * 1024, sy = R() * 1024;
    x.moveTo(sx, sy); x.lineTo(sx + (R() - 0.5) * 120, sy + (R() - 0.5) * 20);
    x.stroke();
  }
  grain(x, 1024, 1024, 5000, 0.06);
  return tex(c, 3, 3);
}

// ---- 作業机の天板（絵の具汚れ・カッター傷） ----
export function tableWood() {
  const [c, x] = canvas(1024, 512);
  x.fillStyle = '#a97c4f'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 60; i++) {
    x.strokeStyle = `rgba(70,40,16,${0.06 + R() * 0.1})`;
    x.lineWidth = 1 + R() * 1.5;
    x.beginPath();
    const yy = R() * 512;
    x.moveTo(0, yy);
    for (let xx = 0; xx <= 1024; xx += 32) x.lineTo(xx, yy + Math.sin(xx * 0.008 + i) * 5);
    x.stroke();
  }
  // 絵の具のしみ（工作机らしさ）
  const paints = ['rgba(210,60,80,', 'rgba(60,120,200,', 'rgba(230,190,40,', 'rgba(80,160,80,'];
  for (let i = 0; i < 14; i++) {
    const p = paints[i % paints.length];
    const px = R() * 1024, py = R() * 512, pr = 4 + R() * 14;
    const g = x.createRadialGradient(px, py, 1, px, py, pr);
    g.addColorStop(0, p + '0.30)'); g.addColorStop(1, p + '0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, pr, 0, 7); x.fill();
  }
  // カッター傷
  for (let i = 0; i < 26; i++) {
    x.strokeStyle = `rgba(50,28,10,${0.15 + R() * 0.2})`;
    x.lineWidth = 1;
    x.beginPath();
    const sx = R() * 1024, sy = R() * 512, a = R() * Math.PI;
    x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * (30 + R() * 90), sy + Math.sin(a) * (30 + R() * 90) * 0.2);
    x.stroke();
  }
  // 縁の摩耗（明るく）
  x.strokeStyle = 'rgba(240,220,190,0.25)'; x.lineWidth = 10;
  x.strokeRect(4, 4, 1016, 504);
  grain(x, 1024, 512, 3000, 0.05);
  return tex(c);
}

// ---- 白い幕の布（織り目＋しわ＋縁の縫い） ----
export function clothScreen() {
  const [c, x] = canvas(1024, 768);
  x.fillStyle = '#f7f1e4'; x.fillRect(0, 0, 1024, 768);
  // 織り目
  for (let yy = 0; yy < 768; yy += 3) {
    x.fillStyle = `rgba(180,170,150,${0.05 + (yy % 6 === 0 ? 0.04 : 0)})`;
    x.fillRect(0, yy, 1024, 1);
  }
  for (let xx = 0; xx < 1024; xx += 3) {
    x.fillStyle = 'rgba(180,170,150,0.05)';
    x.fillRect(xx, 0, 1, 768);
  }
  // 大きなしわ（張った布のゆるみ）
  for (let i = 0; i < 7; i++) {
    const wx = 80 + R() * 860;
    const g = x.createLinearGradient(wx - 40, 0, wx + 40, 0);
    g.addColorStop(0, 'rgba(120,110,95,0)');
    g.addColorStop(0.5, `rgba(120,110,95,${0.05 + R() * 0.05})`);
    g.addColorStop(1, 'rgba(255,255,250,0.05)');
    x.fillStyle = g; x.fillRect(wx - 40, 0, 80, 768);
  }
  // 縁の縫い目
  x.strokeStyle = 'rgba(140,125,105,0.5)'; x.lineWidth = 3; x.setLineDash([8, 6]);
  x.strokeRect(10, 10, 1004, 748);
  x.setLineDash([]);
  grain(x, 1024, 768, 2500, 0.04);
  return tex(c);
}

// ---- 幕にかける「織り目＋周辺減光」乗算オーバーレイ（投影の質感） ----
export function clothOverlay() {
  const [c, x] = canvas(512, 384);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 384);
  for (let yy = 0; yy < 384; yy += 2) { x.fillStyle = 'rgba(210,200,185,0.16)'; x.fillRect(0, yy, 512, 1); }
  for (let xx = 0; xx < 512; xx += 2) { x.fillStyle = 'rgba(210,200,185,0.10)'; x.fillRect(xx, 0, 1, 384); }
  const g = x.createRadialGradient(256, 192, 120, 256, 192, 330);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(120,100,80,0.55)');
  x.fillStyle = g; x.fillRect(0, 0, 512, 384);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---- 暗い壁（漆喰＋汚れ） ----
export function wallPlaster() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#4d4038'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(${20 + R() * 40},${16 + R() * 30},${12 + R() * 24},${0.1 + R() * 0.15})`;
    x.beginPath(); x.arc(R() * 512, R() * 512, 1 + R() * 3, 0, 7); x.fill();
  }
  // 上からの染み
  for (let i = 0; i < 5; i++) {
    const sx = R() * 512;
    const g = x.createLinearGradient(sx, 0, sx, 200 + R() * 200);
    g.addColorStop(0, 'rgba(25,18,12,0.28)'); g.addColorStop(1, 'rgba(25,18,12,0)');
    x.fillStyle = g; x.fillRect(sx - 14, 0, 28, 400);
  }
  grain(x, 512, 512, 2200, 0.08);
  return tex(c, 4, 2);
}

// ---- 暗色カード紙（人形・背景の材質） ----
export function cardboard() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#241f1b'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    x.fillStyle = `rgba(${40 + R() * 30},${34 + R() * 26},${28 + R() * 22},${R() * 0.35})`;
    x.fillRect(R() * 256, R() * 256, 1 + R() * 2, 1);
  }
  // 繊維
  for (let i = 0; i < 60; i++) {
    x.strokeStyle = `rgba(70,60,50,${R() * 0.25})`;
    x.lineWidth = 0.7;
    const sx = R() * 256, sy = R() * 256, a = R() * Math.PI;
    x.beginPath(); x.moveTo(sx, sy);
    x.lineTo(sx + Math.cos(a) * 20, sy + Math.sin(a) * 20); x.stroke();
  }
  return tex(c, 2, 2);
}

// ---- 幕の下スカート・脇マスク用の暗幕布 ----
export function darkDrape() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#3a1b20'; x.fillRect(0, 0, 512, 512);
  // 縦のドレープひだ
  for (let i = 0; i < 14; i++) {
    const fx = i * 38 + R() * 10;
    const g = x.createLinearGradient(fx, 0, fx + 38, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.4)');
    g.addColorStop(0.45, 'rgba(120,60,66,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    x.fillStyle = g; x.fillRect(fx, 0, 40, 512);
  }
  grain(x, 512, 512, 1800, 0.1);
  return tex(c, 2, 1);
}

// ---- 円形ラグ（客席側） ----
export function rugTex() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, 512, 512);
  const cols = ['#8e4a52', '#c78b4e', '#7a6a9e', '#5e8a6a', '#c78b4e', '#8e4a52'];
  for (let i = 0; i < cols.length; i++) {
    x.fillStyle = cols[i];
    x.beginPath(); x.arc(256, 256, 250 - i * 40, 0, 7); x.fill();
  }
  grain(x, 512, 512, 2600, 0.12);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---- スプライト: パルスリング（タップ誘導） ----
export function ringSprite() {
  const [c, x] = canvas(128, 128);
  x.strokeStyle = 'rgba(255,220,120,1)'; x.lineWidth = 8;
  x.shadowColor = 'rgba(255,200,80,0.9)'; x.shadowBlur = 12;
  x.beginPath(); x.arc(64, 64, 46, 0, 7); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- スプライト: きらきら星 ----
export function starSprite() {
  const [c, x] = canvas(64, 64);
  x.translate(32, 32);
  x.fillStyle = '#fff2c0';
  x.shadowColor = '#ffd76a'; x.shadowBlur = 10;
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 26 : 10;
    const a = i * Math.PI / 5 - Math.PI / 2;
    x[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
