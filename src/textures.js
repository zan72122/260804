// プロシージャルテクスチャ生成（外部アセットなし）
import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

// 乱数（決定的で十分）
let seed = 7;
function rnd() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

// ---- 古い壁紙（黄ばんだストライプ＋小花、染み） ----
export function oldWallpaperTexture() {
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#b9a77f';
  g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) {
    g.fillStyle = (x / 64) % 2 ? '#ad9a72' : '#b9a77f';
    g.fillRect(x, 0, 64, 512);
    g.fillStyle = 'rgba(140,120,80,0.35)';
    g.fillRect(x + 58, 0, 3, 512);
  }
  // 色あせた小花
  for (let y = 24; y < 512; y += 96) {
    for (let x = 32; x < 512; x += 64) {
      const ox = ((y / 96) % 2) * 32;
      g.save();
      g.translate(x + ox, y);
      g.fillStyle = 'rgba(146,110,90,0.5)';
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        g.beginPath();
        g.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 4.5, 3, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(120,96,60,0.6)';
      g.beginPath(); g.arc(0, 0, 3, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }
  // 経年の染み・グラデーション
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 24 + rnd() * 90;
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, 'rgba(90,70,40,0.14)');
    gr.addColorStop(1, 'rgba(90,70,40,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // 上部のヤケ
  const gr2 = g.createLinearGradient(0, 0, 0, 512);
  gr2.addColorStop(0, 'rgba(70,55,35,0.22)');
  gr2.addColorStop(0.4, 'rgba(70,55,35,0)');
  gr2.addColorStop(1, 'rgba(60,45,30,0.18)');
  g.fillStyle = gr2;
  g.fillRect(0, 0, 512, 512);
  return tex(c);
}

// ---- 壁紙の裏面（糊のついた紙） ----
export function wallpaperBackTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#cfc0a4';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(120,105,80,${0.05 + rnd() * 0.1})`;
    g.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 8, 1 + rnd() * 3);
  }
  return tex(c);
}

// ---- 素の下地（石膏プラスター） ----
export function drawPlaster(g, w, h) {
  g.fillStyle = '#c8beae';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h / 400; i++) {
    const x = rnd() * w, y = rnd() * h;
    g.fillStyle = `rgba(${100 + rnd() * 60 | 0},${90 + rnd() * 50 | 0},${70 + rnd() * 40 | 0},${0.04 + rnd() * 0.08})`;
    g.beginPath(); g.arc(x, y, 1 + rnd() * 6, 0, Math.PI * 2); g.fill();
  }
  // コテむら
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w, y = rnd() * h;
    g.strokeStyle = 'rgba(255,250,235,0.028)';
    g.lineWidth = 6 + rnd() * 14;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 40 - rnd() * 80, y + 40 - rnd() * 80, x + 80 - rnd() * 160, y + 60 - rnd() * 120);
    g.stroke();
  }
}

// ---- 床板（古い） ----
export function oldFloorTexture() {
  const [c, g] = makeCanvas(1024, 1024);
  drawPlanks(g, 1024, 1024, ['#4a3a2c', '#42332699', '#514032'], '#2d211a', 0.5);
  // 擦り傷と汚れ
  for (let i = 0; i < 160; i++) {
    g.strokeStyle = `rgba(20,14,10,${0.1 + rnd() * 0.2})`;
    g.lineWidth = 1 + rnd() * 2;
    const x = rnd() * 1024, y = rnd() * 1024;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 - rnd() * 60, y + 8 - rnd() * 16); g.stroke();
  }
  for (let i = 0; i < 22; i++) {
    const x = rnd() * 1024, y = rnd() * 1024, r = 30 + rnd() * 120;
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, 'rgba(15,10,8,0.25)');
    gr.addColorStop(1, 'rgba(15,10,8,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return tex(c, 2, 2);
}

// ---- 床板（新しい・明るいメープル） ----
export function newFloorTexture() {
  const [c, g] = makeCanvas(1024, 1024);
  drawPlanks(g, 1024, 1024, ['#d9a866', '#d3a05e', '#e0b271'], '#b98c4e', 0.22);
  return tex(c, 2, 2);
}

function drawPlanks(g, w, h, tones, gap, grainAlpha) {
  const plankH = h / 8;
  for (let row = 0; row < 8; row++) {
    const y = row * plankH;
    const offset = (row % 2) * w / 3;
    for (let seg = -1; seg < 3; seg++) {
      const x = seg * (w / 2) + offset;
      g.fillStyle = tones[(row + seg + 4) % tones.length].slice(0, 7);
      g.fillRect(x, y, w / 2 - 3, plankH - 3);
      // 木目
      for (let i = 0; i < 12; i++) {
        g.strokeStyle = `rgba(60,40,20,${grainAlpha * (0.2 + rnd() * 0.5)})`;
        g.lineWidth = 1 + rnd() * 1.6;
        const gy = y + rnd() * plankH;
        g.beginPath();
        g.moveTo(x, gy);
        g.bezierCurveTo(x + w / 8, gy + 6 - rnd() * 12, x + w / 4, gy + 6 - rnd() * 12, x + w / 2 - 3, gy + 4 - rnd() * 8);
        g.stroke();
      }
    }
    g.fillStyle = gap;
    g.fillRect(0, y + plankH - 3, w, 3);
  }
  for (let x = 0; x < w; x += w / 2) {
    g.fillStyle = gap;
    g.fillRect(x - 1, 0, 3, h);
  }
}

// ---- 天井 ----
export function ceilingTexture(old) {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = old ? '#8e8578' : '#f4efe6';
  g.fillRect(0, 0, 256, 256);
  if (old) {
    for (let i = 0; i < 14; i++) {
      const x = rnd() * 256, y = rnd() * 256, r = 20 + rnd() * 70;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      gr.addColorStop(0, 'rgba(70,60,40,0.25)');
      gr.addColorStop(1, 'rgba(70,60,40,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }
  return tex(c, 2, 2);
}

// ---- 養生シート（布） ----
export function sheetTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#eef0f2';
  g.fillRect(0, 0, 256, 256);
  // 織り目
  for (let y = 0; y < 256; y += 4) {
    g.fillStyle = y % 8 ? 'rgba(180,190,200,0.15)' : 'rgba(255,255,255,0.2)';
    g.fillRect(0, y, 256, 2);
  }
  for (let x = 0; x < 256; x += 4) {
    g.fillStyle = x % 8 ? 'rgba(180,190,200,0.1)' : 'rgba(255,255,255,0.12)';
    g.fillRect(x, 0, 2, 256);
  }
  // 折りジワ
  for (let i = 0; i < 10; i++) {
    g.strokeStyle = 'rgba(150,160,175,0.25)';
    g.lineWidth = 2;
    const x = rnd() * 256, y = rnd() * 256;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 100 - rnd() * 200, y + 100 - rnd() * 200); g.stroke();
  }
  return tex(c, 3, 3);
}

// ---- ソファ生地 ----
export function sofaTexture(old) {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = old ? '#6e5b49' : '#e8798a';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 3) {
    g.fillStyle = old ? 'rgba(40,32,24,0.2)' : 'rgba(255,255,255,0.08)';
    g.fillRect(0, y, 256, 1);
  }
  if (old) {
    for (let i = 0; i < 14; i++) {
      const x = rnd() * 256, y = rnd() * 256, r = 14 + rnd() * 46;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      gr.addColorStop(0, 'rgba(30,22,14,0.3)');
      gr.addColorStop(1, 'rgba(30,22,14,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // ほつれ
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = 'rgba(220,200,170,0.35)';
      g.beginPath();
      const x = rnd() * 256, y = rnd() * 256;
      g.moveTo(x, y); g.lineTo(x + 8 - rnd() * 16, y + 8 - rnd() * 16);
      g.stroke();
    }
  } else {
    // 新品はやわらかいドット
    for (let y = 16; y < 256; y += 48) {
      for (let x = 16; x < 256; x += 48) {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath(); g.arc(x + ((y / 48) % 2) * 24, y, 5, 0, Math.PI * 2); g.fill();
      }
    }
  }
  return tex(c, 2, 2);
}

// ---- 木部（テーブル・棚） ----
export function woodTexture(old) {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = old ? '#4c3826' : '#c98f52';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = old ? `rgba(20,12,6,${0.15 + rnd() * 0.3})` : `rgba(120,70,30,${0.12 + rnd() * 0.2})`;
    g.lineWidth = 1 + rnd() * 3;
    const y = rnd() * 256;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(64, y + 10 - rnd() * 20, 192, y + 10 - rnd() * 20, 256, y + 6 - rnd() * 12);
    g.stroke();
  }
  if (old) {
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = 'rgba(230,220,200,0.25)';
      g.lineWidth = 1;
      const x = rnd() * 256, y = rnd() * 256;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 - rnd() * 40, y + 6 - rnd() * 12); g.stroke();
    }
  }
  return tex(c);
}

// ---- カーテン ----
export function curtainTexture(old) {
  const [c, g] = makeCanvas(256, 256);
  if (old) {
    g.fillStyle = '#6b6a5e';
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 20) {
      g.fillStyle = 'rgba(30,30,24,0.25)';
      g.fillRect(x, 0, 8, 256);
    }
    for (let i = 0; i < 12; i++) {
      const x = rnd() * 256, y = rnd() * 256, r = 16 + rnd() * 50;
      const gr = g.createRadialGradient(x, y, 2, x, y, r);
      gr.addColorStop(0, 'rgba(20,18,10,0.3)');
      gr.addColorStop(1, 'rgba(20,18,10,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  } else {
    g.fillStyle = '#fff6f0';
    g.fillRect(0, 0, 256, 256);
    for (let y = 20; y < 256; y += 56) {
      for (let x = 20; x < 256; x += 56) {
        g.fillStyle = '#f5aebc';
        g.beginPath(); g.arc(x + ((y / 56) % 2) * 28, y, 9, 0, Math.PI * 2); g.fill();
      }
    }
  }
  return tex(c, 2, 1);
}

// ---- 窓の外：空・丘・木（空気遠近の層） ----
export function skyTexture() {
  const [c, g] = makeCanvas(256, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#7ec3ef');
  gr.addColorStop(0.65, '#c8e6f7');
  gr.addColorStop(1, '#eef6f2');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  // 雲
  for (let i = 0; i < 7; i++) {
    const x = rnd() * 256, y = 20 + rnd() * 120, r = 14 + rnd() * 26;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let j = 0; j < 4; j++) {
      g.beginPath();
      g.arc(x + j * r * 0.7, y + (j % 2) * 5, r * (0.7 + rnd() * 0.4), 0, Math.PI * 2);
      g.fill();
    }
  }
  return tex(c);
}

export function hillsTexture() {
  const [c, g] = makeCanvas(512, 256);
  g.clearRect(0, 0, 512, 256);
  // 遠い丘（霞んで淡い）
  g.fillStyle = '#a9c6b8';
  g.beginPath();
  g.moveTo(0, 256);
  for (let x = 0; x <= 512; x += 16) {
    g.lineTo(x, 150 + Math.sin(x * 0.02) * 26 + Math.sin(x * 0.05) * 12);
  }
  g.lineTo(512, 256);
  g.fill();
  // 手前の丘（少し濃い）
  g.fillStyle = '#84b491';
  g.beginPath();
  g.moveTo(0, 256);
  for (let x = 0; x <= 512; x += 16) {
    g.lineTo(x, 200 + Math.sin(x * 0.03 + 2) * 20);
  }
  g.lineTo(512, 256);
  g.fill();
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function treeTexture() {
  const [c, g] = makeCanvas(256, 512);
  g.clearRect(0, 0, 256, 512);
  g.fillStyle = '#6d4a30';
  g.fillRect(116, 260, 26, 252);
  const leaves = ['#4e8a4e', '#5f9c58', '#437a45'];
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * 95;
    g.fillStyle = leaves[i % 3];
    g.beginPath();
    g.arc(128 + Math.cos(a) * d, 170 + Math.sin(a) * d * 0.8, 26 + rnd() * 24, 0, Math.PI * 2);
    g.fill();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---- 穴（壁の傷） ----
export function holeTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  // 欠けた縁
  g.fillStyle = '#9a8f7d';
  g.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 14) {
    const r = 46 + rnd() * 14;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.fill();
  // 暗い空洞
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 42);
  gr.addColorStop(0, '#171008');
  gr.addColorStop(0.75, '#2c2013');
  gr.addColorStop(1, '#57452f');
  g.fillStyle = gr;
  g.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 12) {
    const r = 34 + rnd() * 9;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.fill();
  // ひび
  g.strokeStyle = 'rgba(40,30,18,0.8)';
  g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    g.beginPath();
    g.moveTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40);
    g.lineTo(64 + Math.cos(a + 0.3) * (56 + rnd() * 8), 64 + Math.sin(a + 0.3) * (56 + rnd() * 8));
    g.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---- パテパッチ（丸い塗り跡） ----
export function patchTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 58);
  gr.addColorStop(0, '#e7e0d2');
  gr.addColorStop(0.8, '#ddd4c2');
  gr.addColorStop(1, 'rgba(221,212,194,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  // コテ跡
  g.strokeStyle = 'rgba(190,180,160,0.5)';
  g.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(64, 64, 16 + i * 10, rnd() * 2, rnd() * 2 + 2.5);
    g.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---- 誘導の手（文字なしガイド） ----
export function handTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.font = '96px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.4)';
  g.shadowBlur = 8;
  g.fillText('👆', 64, 70);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function ringTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#ffe38a';
  g.lineWidth = 8;
  g.shadowColor = '#ffd75e';
  g.shadowBlur = 12;
  g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function sparkleTexture() {
  const [c, g] = makeCanvas(64, 64);
  g.clearRect(0, 0, 64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,244,200,0.9)');
  gr.addColorStop(1, 'rgba(255,244,200,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.fillRect(30, 6, 4, 52);
  g.fillRect(6, 30, 52, 4);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function replayTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#e8798a';
  g.lineWidth = 11;
  g.lineCap = 'round';
  g.beginPath(); g.arc(64, 64, 32, -0.5, Math.PI * 1.35); g.stroke();
  g.fillStyle = '#e8798a';
  g.save();
  g.translate(64 + Math.cos(-0.5) * 32, 64 + Math.sin(-0.5) * 32);
  g.rotate(-0.5 + Math.PI / 2);
  g.beginPath(); g.moveTo(0, -16); g.lineTo(13, 8); g.lineTo(-13, 8); g.closePath(); g.fill();
  g.restore();
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
