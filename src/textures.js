// Canvas で手続き的に生成するテクスチャ群（ネットワーク不要・軽量）
import * as THREE from '../vendor/three.module.js';
import { makeNoise2D, fbm, makeRng, clamp01, lerp, smoothstep } from './util.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function finish(canvas, { repeat = 1, srgb = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  // 手続き生成のノイズはタイル継ぎ目が出るため、鏡像ラップで目立たなくする
  t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
const hex = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

const cache = new Map();
function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/* ---------------- 土 ---------------- */
// 湿った土（Hero Material 1）。base=[r,g,b]
export function soilTexture(seed = 3, base = [86, 62, 42], wet = 0) {
  return memo(`soil${seed}_${base.join()}_${wet}`, () => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
    const n = makeNoise2D(seed), n2 = makeNoise2D(seed + 51);
    const img = g.createImageData(S, S);
    const d = img.data;
    const dark = wet * 0.42;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S * 6, v = y / S * 6;
        let f = fbm(n, u, v, 5);
        const grain = n2(x * 0.9, y * 0.9);
        const clod = smoothstep(0.62, 0.86, fbm(n2, u * 1.7 + 11, v * 1.7, 3));
        let k = 0.55 + (f - 0.5) * 0.95 + (grain - 0.5) * 0.30 + clod * 0.18;
        k = clamp01(k) * (1 - dark);
        const i = (y * S + x) * 4;
        d[i] = base[0] * (0.55 + k * 0.85);
        d[i + 1] = base[1] * (0.55 + k * 0.88);
        d[i + 2] = base[2] * (0.58 + k * 0.90);
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // 小石
    const rng = makeRng(seed * 7 + 3);
    for (let i = 0; i < 260; i++) {
      const x = rng() * S, y = rng() * S, r = 1 + rng() * 3.4;
      const l = 120 + rng() * 90;
      g.fillStyle = `rgba(${l | 0},${(l * 0.94) | 0},${(l * 0.86) | 0},${0.30 + rng() * 0.4})`;
      g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rng() * 0.6), rng() * 3, 0, 7); g.fill();
    }
    return finish(c, { repeat: 1, srgb: true });
  });
}

export function soilBumpTexture(seed = 3) {
  return memo(`soilB${seed}`, () => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
    const n = makeNoise2D(seed + 900), n2 = makeNoise2D(seed + 12);
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S * 6, v = y / S * 6;
      let k = fbm(n, u, v, 5) * 0.7 + n2(x * 1.1, y * 1.1) * 0.3;
      const i = (y * S + x) * 4;
      const b = clamp01(k) * 255;
      d[i] = d[i + 1] = d[i + 2] = b; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return finish(c);
  });
}

// 地層（断面に見える横縞）
export function strataTexture(seed = 3, base = [84, 64, 47]) {
  return memo(`strata${seed}_${base.join()}`, () => {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    const n = makeNoise2D(seed + 401), n2 = makeNoise2D(seed + 77);
    const layers = [
      [0.00, 0.20, 0.62], [0.20, 0.34, 0.80], [0.34, 0.58, 1.05],
      [0.58, 0.78, 0.86], [0.78, 1.00, 1.22],
    ];
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = 1 - y / S;                       // v=0 が下（深い）
      const wob = (fbm(n2, x / S * 3, 0, 3) - 0.5) * 0.06;
      let mul = 1;
      for (const [a, b, m] of layers) {
        if (v + wob >= a && v + wob < b) { mul = m; break; }
      }
      const k = 0.72 + (fbm(n, x / S * 7, y / S * 7, 4) - 0.5) * 0.6;
      const i = (y * S + x) * 4;
      d[i] = clamp01(base[0] * mul * k / 255) * 255;
      d[i + 1] = clamp01(base[1] * mul * k / 255) * 255;
      d[i + 2] = clamp01(base[2] * mul * k / 255) * 255;
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // 小石の層
    const rng = makeRng(seed + 19);
    for (let i = 0; i < 150; i++) {
      const x = rng() * S, y = S * (0.18 + rng() * 0.30);
      const r = 1 + rng() * 3;
      const l = 130 + rng() * 90;
      g.fillStyle = `rgba(${l | 0},${(l * 0.93) | 0},${(l * 0.84) | 0},0.55)`;
      g.beginPath(); g.ellipse(x, y, r, r * 0.7, rng() * 3, 0, 7); g.fill();
    }
    return finish(c, { srgb: true });
  });
}

/* ---------------- 草地 ---------------- */
export function grassTexture(seed = 11, tone = [96, 132, 62]) {
  return memo(`grass${seed}_${tone.join()}`, () => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
    const n = makeNoise2D(seed), n2 = makeNoise2D(seed + 33);
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S * 8, v = y / S * 8;
      const patch = fbm(n, u * 0.5, v * 0.5, 4);
      const fine = fbm(n2, u * 5, v * 5, 3);
      const k = 0.62 + (patch - 0.5) * 0.7 + (fine - 0.5) * 0.45;
      const dry = smoothstep(0.62, 0.9, patch);
      const i = (y * S + x) * 4;
      d[i] = tone[0] * k * (1 + dry * 0.55);
      d[i + 1] = tone[1] * k * (1 + dry * 0.22);
      d[i + 2] = tone[2] * k * (1 - dry * 0.18);
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // 草の筋
    const rng = makeRng(seed + 5);
    for (let i = 0; i < 2600; i++) {
      const x = rng() * S, y = rng() * S, len = 3 + rng() * 8, a = rng() * Math.PI;
      const l = 0.65 + rng() * 0.7;
      g.strokeStyle = `rgba(${(tone[0] * l) | 0},${(tone[1] * l) | 0},${(tone[2] * l) | 0},0.55)`;
      g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    return finish(c, { repeat: 1, srgb: true });
  });
}

// 草の房（アルファ）— 数本の細い葉
export function grassBladeTexture() {
  return memo('grassBlade', () => {
    const S = 128, c = makeCanvas(S, S), g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    const rng = makeRng(303);
    for (let i = 0; i < 12; i++) {
      const x0 = 20 + rng() * (S - 40);
      const h = 44 + rng() * 68;
      const bend = (rng() - 0.5) * 44;
      const w = 3.2 + rng() * 3.2;
      const l = 0.62 + rng() * 0.55;
      g.fillStyle = `rgb(${(120 * l) | 0},${(178 * l) | 0},${(88 * l) | 0})`;
      g.beginPath();
      g.moveTo(x0 - w / 2, S);
      g.quadraticCurveTo(x0 - w / 2 + bend * 0.4, S - h * 0.55, x0 + bend, S - h);
      g.quadraticCurveTo(x0 + w / 2 + bend * 0.4, S - h * 0.55, x0 + w / 2, S);
      g.closePath(); g.fill();
    }
    const t = finish(c, { srgb: true, aniso: 2 });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/* ---------------- 樹皮（Hero Material 2） ---------------- */
export function barkTexture(kind = 'oak') {
  return memo(`bark${kind}`, () => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
    const cfg = {
      oak: { base: [132, 108, 84], dark: [62, 48, 37], ridge: 9, vert: 6.5, rough: 1.0 },
      pine: { base: [156, 108, 76], dark: [80, 50, 36], ridge: 5, vert: 3.2, rough: 1.25 },
      cherry: { base: [150, 120, 114], dark: [76, 56, 56], ridge: 16, vert: 1.2, rough: 0.55 },
    }[kind] || { base: [132, 108, 84], dark: [62, 48, 37], ridge: 9, vert: 6, rough: 1 };
    const n = makeNoise2D(kind.length * 13 + 5), n2 = makeNoise2D(77);
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      // 縦方向に伸びたノイズ = 樹皮の裂け目
      const warp = fbm(n2, u * 3, v * 1.2, 3) * 0.20;
      let ridges = Math.abs(Math.sin((u * cfg.ridge + warp) * Math.PI * 2 + fbm(n, u * 2, v * cfg.vert, 4) * 3.2));
      ridges = Math.pow(ridges, 0.55);
      const fine = fbm(n, u * 22, v * 46, 3);
      let k = ridges * 0.72 + fine * 0.28 * cfg.rough;
      // 桜は横縞（皮目）
      if (kind === 'cherry') {
        const lent = smoothstep(0.86, 0.98, Math.abs(Math.sin(v * Math.PI * 34 + fbm(n, u * 4, 0, 2) * 2)));
        k = k * (1 - lent) + lent * 0.15;
      }
      const i = (y * S + x) * 4;
      d[i] = lerp(cfg.dark[0], cfg.base[0], k);
      d[i + 1] = lerp(cfg.dark[1], cfg.base[1], k);
      d[i + 2] = lerp(cfg.dark[2], cfg.base[2], k);
      d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return finish(c, { srgb: true });
  });
}
export function barkBumpTexture(kind = 'oak') {
  return memo(`barkB${kind}`, () => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
    const src = barkTexture(kind).image;
    g.drawImage(src, 0, 0, S, S);
    const img = g.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] * 0.4 + d[i + 1] * 0.45 + d[i + 2] * 0.15);
      d[i] = d[i + 1] = d[i + 2] = l * 1.35;
    }
    g.putImageData(img, 0, 0);
    return finish(c);
  });
}

/* ---------------- 葉クラスタ（アルファ） ---------------- */
export function leafCardTexture(kind = 'broad', color = [78, 132, 54]) {
  return memo(`leaf${kind}_${color.join()}`, () => {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    const rng = makeRng(kind.length * 91 + color[0]);
    const drawLeaf = (x, y, len, wid, ang, shade) => {
      g.save(); g.translate(x, y); g.rotate(ang);
      const r = color[0] * shade, gg = color[1] * shade, b = color[2] * shade;
      const grd = g.createLinearGradient(0, -len * 0.5, 0, len * 0.5);
      grd.addColorStop(0, hex(r * 1.12, gg * 1.12, b * 1.05));
      grd.addColorStop(1, hex(r * 0.72, gg * 0.78, b * 0.7));
      g.fillStyle = grd;
      g.beginPath();
      if (kind === 'needle') {
        g.moveTo(0, -len * 0.5);
        g.lineTo(wid * 0.5, len * 0.5);
        g.lineTo(-wid * 0.5, len * 0.5);
      } else if (kind === 'blossom') {
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          g.ellipse(Math.cos(a) * wid * 0.34, Math.sin(a) * wid * 0.34, wid * 0.34, wid * 0.30, a, 0, 7);
        }
      } else {
        g.moveTo(0, -len * 0.5);
        g.bezierCurveTo(wid * 0.62, -len * 0.18, wid * 0.52, len * 0.30, 0, len * 0.5);
        g.bezierCurveTo(-wid * 0.52, len * 0.30, -wid * 0.62, -len * 0.18, 0, -len * 0.5);
      }
      g.closePath(); g.fill();
      if (kind === 'broad') {
        g.strokeStyle = `rgba(${(r * 0.6) | 0},${(gg * 0.66) | 0},${(b * 0.5) | 0},0.6)`;
        g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(0, -len * 0.45); g.lineTo(0, len * 0.45); g.stroke();
      }
      g.restore();
    };
    const count = kind === 'needle' ? 90 : kind === 'blossom' ? 58 : 46;
    for (let i = 0; i < count; i++) {
      const x = 32 + rng() * (S - 64), y = 32 + rng() * (S - 64);
      const dist = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      if (dist > 1.02) continue;
      const sc = kind === 'needle' ? 1 : 1.25;
      const len = (kind === 'needle' ? 52 : 62) * sc * (0.55 + rng() * 0.7);
      const wid = (kind === 'needle' ? 9 : 40) * sc * (0.6 + rng() * 0.6);
      const shade = 0.72 + rng() * 0.5 - dist * 0.12;
      drawLeaf(x, y, len, wid, rng() * Math.PI * 2, shade);
    }
    // ふちを少しフェード（カード境界を目立たせない）
    const fade = g.getImageData(0, 0, S, S), fd = fade.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const dd = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      fd[i + 3] *= 1 - smoothstep(0.80, 1.0, dd);
    }
    g.putImageData(fade, 0, 0);
    return finish(c, { srgb: true, aniso: 2 });
  });
}

/* ---------------- 地割れ（アルファ） ---------------- */
export function crackTexture(seed = 21) {
  return memo(`crack${seed}`, () => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    const rng = makeRng(seed);
    const cx = S / 2, cy = S / 2;
    const drawBranch = (x, y, a, len, w, depth) => {
      let px = x, py = y;
      const steps = 9;
      g.lineCap = 'round';
      for (let i = 0; i < steps; i++) {
        a += (rng() - 0.5) * 0.55;
        const nx = px + Math.cos(a) * (len / steps), ny = py + Math.sin(a) * (len / steps);
        const t = i / steps;
        g.strokeStyle = `rgba(0,0,0,${(1 - t) * 0.95})`;
        g.lineWidth = w * (1 - t * 0.75);
        g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
        px = nx; py = ny;
        if (depth > 0 && rng() < 0.22) drawBranch(px, py, a + (rng() - 0.5) * 1.6, len * 0.42, w * 0.55, depth - 1);
      }
    };
    const rings = 16;
    for (let i = 0; i < rings; i++) {
      const a = (i / rings) * Math.PI * 2 + rng() * 0.3;
      const r0 = S * 0.19;
      drawBranch(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, a, S * 0.20 * (0.6 + rng() * 0.9), 6.5, 2);
    }
    // 中央の円環クラック
    g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = 5;
    g.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const r = S * 0.20 * (1 + (rng() - 0.5) * 0.10);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    // 外周フェード
    const img = g.getImageData(0, 0, S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const dd = Math.hypot(x - cx, y - cy) / (S / 2);
      d[i + 3] *= 1 - smoothstep(0.55, 0.98, dd);
    }
    g.putImageData(img, 0, 0);
    const t = finish(c, { srgb: true });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/* ---------------- 濡れマスク（放射状ソフト円） ---------------- */
export function radialTexture(soft = 0.55, seed = 5) {
  return memo(`radial${soft}_${seed}`, () => {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    const n = makeNoise2D(seed);
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x / S - 0.5) * 2, dy = (y / S - 0.5) * 2;
      let r = Math.hypot(dx, dy);
      r *= 0.86 + fbm(n, x / S * 5, y / S * 5, 3) * 0.30;
      const a = 1 - smoothstep(soft, 1.0, r);
      const i = (y * S + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
    const t = finish(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/* ---------------- 空 ---------------- */
export function skyTexture(top = [126, 178, 232], bot = [222, 236, 244]) {
  return memo(`sky${top.join()}${bot.join()}`, () => {
    const c = makeCanvas(8, 256), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0.0, hex(top[0] * 0.86, top[1] * 0.9, top[2]));
    grd.addColorStop(0.55, hex(top[0], top[1], top[2]));
    grd.addColorStop(1.0, hex(bot[0], bot[1], bot[2]));
    g.fillStyle = grd; g.fillRect(0, 0, 8, 256);
    const t = finish(c, { srgb: true });
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/* ---------------- 汎用ノイズ（金属の汚れなど） ---------------- */
export function grimeTexture(seed = 41) {
  return memo(`grime${seed}`, () => {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    const n = makeNoise2D(seed);
    const img = g.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const k = fbm(n, x / S * 5, y / S * 5, 4);
      const i = (y * S + x) * 4;
      const v = 196 + k * 59;
      d[i] = v; d[i + 1] = v * 0.98; d[i + 2] = v * 0.95; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return finish(c, { srgb: true });
  });
}
