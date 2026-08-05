// 汎用ユーティリティ: イージング・トゥイーン・プロシージャルテクスチャ
import * as THREE from '../vendor/three.module.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export const ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c = 1.70158; const c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: t => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// シンプルなトゥイーン管理
const tweens = [];
export function tween({ from = 0, to = 1, duration = 1, delay = 0, easing = ease.inOutCubic, onUpdate, onComplete }) {
  const tw = { t: -delay, from, to, duration, easing, onUpdate, onComplete, done: false };
  tweens.push(tw);
  return tw;
}
export function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.done) { tweens.splice(i, 1); continue; }
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = clamp(tw.t / tw.duration, 0, 1);
    const v = lerp(tw.from, tw.to, tw.easing(k));
    tw.onUpdate && tw.onUpdate(v, k);
    if (k >= 1) {
      tw.done = true;
      tweens.splice(i, 1);
      tw.onComplete && tw.onComplete();
    }
  }
}
export function killTween(tw) { if (tw) tw.done = true; }

// キャンバスで生成するテクスチャ
export function canvasTexture(size, draw, { srgb = true, repeat = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

// 木目テクスチャ（作業台: 使い込まれた質感 + 中央の摩耗）
export function woodTexture(base = '#b98a5a', dark = '#8a5f38', worn = true) {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * s;
      g.strokeStyle = `rgba(${Math.random() > 0.5 ? '138,95,56' : '107,72,40'},${0.05 + Math.random() * 0.12})`;
      g.lineWidth = 0.5 + Math.random() * 2.2;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 + Math.random() * 1.5);
      g.stroke();
    }
    // 板の継ぎ目
    for (let i = 1; i < 5; i++) {
      g.strokeStyle = 'rgba(80,52,28,0.5)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, (i * s) / 5); g.lineTo(s, (i * s) / 5); g.stroke();
    }
    if (worn) {
      // 中央の使用摩耗（明るくすり減った跡）と点シミ
      const rg = g.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.55);
      rg.addColorStop(0, 'rgba(255,240,215,0.20)');
      rg.addColorStop(1, 'rgba(255,240,215,0)');
      g.fillStyle = rg; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(70,45,25,${0.04 + Math.random() * 0.08})`;
        g.beginPath();
        g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 4, 0, 7);
        g.fill();
      }
    }
  });
}

// スポンジの気泡テクスチャ
export function spongeTexture(hex) {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = hex; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const r = 0.6 + Math.random() * 2.4;
      g.fillStyle = `rgba(120,70,30,${0.05 + Math.random() * 0.1})`;
      g.beginPath(); g.arc(Math.random() * s, Math.random() * s, r, 0, 7); g.fill();
    }
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(255,255,240,${0.06 + Math.random() * 0.1})`;
      g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 0.5 + Math.random() * 1.5, 0, 7); g.fill();
    }
  }, { repeat: 3 });
}

// タイル壁テクスチャ
export function tileTexture() {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#f6e7d7'; g.fillRect(0, 0, s, s);
    const n = 6, w = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const off = (y % 2) * w * 0.5;
      g.fillStyle = `hsl(${28 + Math.random() * 8},${46 + Math.random() * 10}%,${88 + Math.random() * 5}%)`;
      g.fillRect(x * w + off - w * 0.5 + 2, y * w + 2, w - 4, w - 4);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x * w + off - w * 0.5 + 2, y * w + 2, w - 4, 5);
    }
  }, { repeat: 3 });
}

// 柔らかい放射グラデーション（パーティクル用）
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTexture(128, (g, s) => {
    const rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rg.addColorStop(0, inner);
    rg.addColorStop(1, outer);
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
  });
}
