// すべての絵は canvas で手描き生成する（外部画像ファイルなし）
import * as THREE from '../vendor/three.module.min.js';
import { rand, hash1, clamp, lerp } from './util.js';

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(canvas, { srgb = true, repeat = null, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

/* ---------- 光の粒（スポットの床・グロー） ---------- */
export function glowSprite(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') {
  return cached('glow' + inner + mid, () => {
    const s = 256, c = makeCanvas(s, s), g = c.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, inner);
    grd.addColorStop(0.28, mid);
    grd.addColorStop(0.62, 'rgba(255,255,255,0.06)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    return tex(c, { srgb: false });
  });
}

/* ---------- きらきら（四方に伸びる星の光） ---------- */
export function sparkleSprite() {
  return cached('sparkle', () => {
    const s = 256, c = makeCanvas(s, s), g = c.getContext('2d');
    g.translate(s / 2, s / 2);
    const core = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.18);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.5, 'rgba(255,246,220,0.5)');
    core.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = core;
    g.beginPath(); g.arc(0, 0, s * 0.18, 0, Math.PI * 2); g.fill();
    // 光条
    for (let k = 0; k < 4; k++) {
      g.save();
      g.rotate((Math.PI / 4) * k);
      const len = k % 2 === 0 ? s * 0.48 : s * 0.26;
      const grd = g.createLinearGradient(0, 0, len, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0.85)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      for (const sgn of [1, -1]) {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(len * sgn, -s * 0.018);
        g.lineTo(len * sgn, s * 0.018);
        g.closePath(); g.fill();
      }
      g.restore();
    }
    return tex(c, { srgb: false });
  });
}

/* ---------- 花びら ---------- */
export function petalSprite() {
  return cached('petal', () => {
    const s = 128, c = makeCanvas(s, s), g = c.getContext('2d');
    g.translate(s / 2, s / 2);
    const grd = g.createLinearGradient(0, -s * 0.45, 0, s * 0.45);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,214,231,1)');
    grd.addColorStop(1, 'rgba(255,160,196,1)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, -s * 0.44);
    g.bezierCurveTo(s * 0.36, -s * 0.28, s * 0.30, s * 0.30, 0, s * 0.44);
    g.bezierCurveTo(-s * 0.30, s * 0.30, -s * 0.36, -s * 0.28, 0, -s * 0.44);
    g.fill();
    // 中央の筋
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(0, -s * 0.3); g.lineTo(0, s * 0.34); g.stroke();
    return tex(c);
  });
}

/* ---------- しゃぼん玉 ---------- */
export function bubbleSprite() {
  return cached('bubble', () => {
    const s = 256, c = makeCanvas(s, s), g = c.getContext('2d');
    const r = s * 0.46;
    g.translate(s / 2, s / 2);
    // 縁のにじみ（虹色）
    const rim = g.createRadialGradient(0, 0, r * 0.62, 0, 0, r);
    rim.addColorStop(0, 'rgba(180,230,255,0.02)');
    rim.addColorStop(0.72, 'rgba(190,240,255,0.30)');
    rim.addColorStop(0.86, 'rgba(255,205,245,0.55)');
    rim.addColorStop(0.94, 'rgba(210,255,225,0.42)');
    rim.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rim;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    // ハイライト
    const hl = g.createRadialGradient(-r * 0.32, -r * 0.36, 0, -r * 0.32, -r * 0.36, r * 0.32);
    hl.addColorStop(0, 'rgba(255,255,255,0.95)');
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl;
    g.beginPath(); g.arc(-r * 0.32, -r * 0.36, r * 0.32, 0, Math.PI * 2); g.fill();
    const hl2 = g.createRadialGradient(r * 0.28, r * 0.34, 0, r * 0.28, r * 0.34, r * 0.18);
    hl2.addColorStop(0, 'rgba(255,255,255,0.45)');
    hl2.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl2;
    g.beginPath(); g.arc(r * 0.28, r * 0.34, r * 0.18, 0, Math.PI * 2); g.fill();
    return tex(c, { srgb: false });
  });
}

/* ---------- 舞台の床（木の板） ---------- */
export function stageFloorTexture() {
  return cached('floor', () => {
    const w = 1024, h = 1024, c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#3a2a22'; g.fillRect(0, 0, w, h);
    const planks = 12, ph = h / planks;
    for (let i = 0; i < planks; i++) {
      const y = i * ph;
      const tone = 0.82 + hash1(i * 3.7) * 0.28;
      const r = Math.floor(62 * tone), gg = Math.floor(44 * tone), b = Math.floor(34 * tone);
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(0, y + 1, w, ph - 2);
      // 木目
      for (let k = 0; k < 26; k++) {
        const yy = y + 3 + hash1(i * 13.1 + k * 2.3) * (ph - 6);
        g.strokeStyle = `rgba(20,12,8,${0.05 + hash1(k + i) * 0.09})`;
        g.lineWidth = 0.6 + hash1(k * 5.5) * 1.6;
        g.beginPath();
        g.moveTo(0, yy);
        for (let x = 0; x <= w; x += 64) {
          g.lineTo(x, yy + Math.sin((x / w) * 9 + i * 2 + k) * 2.4);
        }
        g.stroke();
      }
      // 板の継ぎ目
      g.fillStyle = 'rgba(10,6,4,0.75)';
      g.fillRect(0, y, w, 2);
    }
    return tex(c, { repeat: [4, 4], aniso: 8 });
  });
}

/* ---------- 裏方の壁（コンクリ＋汚れ） ---------- */
export function backWallTexture() {
  return cached('backwall', () => {
    const w = 512, h = 512, c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#1b1c22'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = rand(0, w), y = rand(0, h), r = rand(0.5, 3.2);
      g.fillStyle = `rgba(255,255,255,${rand(0.005, 0.035)})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = `rgba(0,0,0,${rand(0.05, 0.2)})`;
      g.lineWidth = rand(1, 6);
      g.beginPath();
      g.moveTo(rand(0, w), rand(0, h));
      g.lineTo(rand(0, w), rand(0, h));
      g.stroke();
    }
    return tex(c, { repeat: [3, 2] });
  });
}

/* ---------- 幕の生地（ベルベットの毛並み） ---------- */
export function velvetTexture(base = '#7e1225') {
  return cached('velvet' + base, () => {
    const w = 512, h = 512, c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) {
      const x = rand(0, w), y = rand(0, h);
      const a = rand(0.02, 0.10);
      g.fillStyle = hash1(i) > 0.5 ? `rgba(255,235,225,${a})` : `rgba(0,0,0,${a})`;
      g.fillRect(x, y, 1.6, rand(1.5, 5));
    }
    // 縦のうねり
    for (let i = 0; i < 90; i++) {
      const x = rand(0, w);
      g.fillStyle = `rgba(0,0,0,${rand(0.02, 0.07)})`;
      g.fillRect(x, 0, rand(2, 9), h);
    }
    return tex(c, { repeat: [3, 2] });
  });
}

/* ---------- お顔 ---------- */
export function faceTexture(kind = 0) {
  return cached('face' + kind, () => {
    const s = 512, c = makeCanvas(s, s), g = c.getContext('2d');
    g.clearRect(0, 0, s, s);
    const cx = s * 0.5, cy = s * 0.52;
    // ほっぺ
    g.fillStyle = 'rgba(255,150,170,0.55)';
    for (const sgn of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + sgn * s * 0.19, cy + s * 0.07, s * 0.075, s * 0.05, 0, 0, Math.PI * 2);
      g.fill();
    }
    // お目め
    g.fillStyle = '#2a1c2e';
    for (const sgn of [-1, 1]) {
      g.beginPath();
      if (kind === 1) {
        // にっこり閉じ目
        g.lineWidth = s * 0.028; g.strokeStyle = '#2a1c2e';
        g.arc(cx + sgn * s * 0.115, cy + s * 0.01, s * 0.055, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
      } else {
        g.ellipse(cx + sgn * s * 0.115, cy - s * 0.005, s * 0.036, s * 0.05, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (kind !== 1) {
      g.fillStyle = 'rgba(255,255,255,0.95)';
      for (const sgn of [-1, 1]) {
        g.beginPath();
        g.ellipse(cx + sgn * s * 0.115 - s * 0.012, cy - s * 0.022, s * 0.013, s * 0.016, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // お口
    g.strokeStyle = '#8c3a52'; g.lineWidth = s * 0.022; g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy + s * 0.06, s * 0.045, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
    return tex(c);
  });
}

/* ---------- 背景の書き割り（ホリゾント） ---------- */
export function backdropTexture(theme) {
  return cached('backdrop' + theme.id, () => {
    const w = 1024, h = 512, c = makeCanvas(w, h), g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, h);
    theme.sky.forEach((col, i) => sky.addColorStop(i / (theme.sky.length - 1), col));
    g.fillStyle = sky; g.fillRect(0, 0, w, h);

    if (theme.id === 'night') {
      for (let i = 0; i < 420; i++) {
        const x = rand(0, w), y = rand(0, h * 0.86);
        const r = rand(0.6, 2.6) * (1 - y / h * 0.4);
        g.fillStyle = `rgba(255,255,240,${rand(0.25, 0.95)})`;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      // 天の川
      g.globalAlpha = 0.25;
      const mw = g.createLinearGradient(0, h * 0.15, w, h * 0.5);
      mw.addColorStop(0, 'rgba(190,170,255,0)');
      mw.addColorStop(0.5, 'rgba(220,205,255,0.75)');
      mw.addColorStop(1, 'rgba(190,170,255,0)');
      g.fillStyle = mw;
      g.beginPath();
      g.moveTo(0, h * 0.2);
      g.quadraticCurveTo(w * 0.5, h * 0.05, w, h * 0.42);
      g.lineTo(w, h * 0.56);
      g.quadraticCurveTo(w * 0.5, h * 0.2, 0, h * 0.36);
      g.closePath(); g.fill();
      g.globalAlpha = 1;
    }
    if (theme.id === 'forest') {
      // 遠くの山と霧
      for (let layer = 0; layer < 3; layer++) {
        const yBase = h * (0.52 + layer * 0.1);
        g.fillStyle = ['rgba(30,84,80,0.55)', 'rgba(22,66,64,0.7)', 'rgba(14,48,48,0.85)'][layer];
        g.beginPath();
        g.moveTo(0, h);
        g.lineTo(0, yBase);
        for (let x = 0; x <= w; x += 16) {
          const y = yBase - Math.abs(Math.sin(x * 0.004 + layer * 2.1)) * (48 + layer * 26)
            - Math.sin(x * 0.017 + layer) * 12;
          g.lineTo(x, y);
        }
        g.lineTo(w, h); g.closePath(); g.fill();
      }
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,250,190,${rand(0.15, 0.6)})`;
        const x = rand(0, w), y = rand(h * 0.4, h * 0.95);
        g.beginPath(); g.arc(x, y, rand(1, 3), 0, Math.PI * 2); g.fill();
      }
    }
    if (theme.id === 'sea') {
      // 水平線と波のきらめき
      const hy = h * 0.52;
      g.fillStyle = 'rgba(6,50,104,0.5)';
      g.fillRect(0, hy, w, h - hy);
      for (let i = 0; i < 260; i++) {
        const y = rand(hy, h);
        const t = (y - hy) / (h - hy);
        g.fillStyle = `rgba(190,240,255,${rand(0.08, 0.5) * (0.3 + t)})`;
        const len = rand(10, 70) * (0.4 + t);
        g.fillRect(rand(0, w), y, len, rand(1, 2.6));
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(255,255,255,${rand(0.05, 0.16)})`;
        const x = rand(0, w), y = rand(h * 0.06, h * 0.4), r = rand(20, 70);
        g.beginPath(); g.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2); g.fill();
      }
    }
    return tex(c);
  });
}

/* ---------- 客席の暗がり用 ---------- */
export function noiseTexture() {
  return cached('noise', () => {
    const s = 256, c = makeCanvas(s, s), g = c.getContext('2d');
    const img = g.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const v = Math.floor(rand(0, 255));
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return tex(c, { srgb: false, repeat: [1, 1] });
  });
}

/* ---------- 幕の金の房飾り用の縦グラデ ---------- */
export function goldTexture() {
  return cached('gold', () => {
    const w = 64, h = 256, c = makeCanvas(w, h), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#ffe9a8');
    grd.addColorStop(0.35, '#e0aa48');
    grd.addColorStop(0.6, '#fff3c8');
    grd.addColorStop(1, '#b8842e');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    return tex(c);
  });
}
