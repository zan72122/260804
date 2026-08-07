import * as THREE from 'three';
import { makeRandom } from './util.js';

// ---------------------------------------------------------------------------
// すべての質感は手続き的に描く。外部画像を持たないので、どこでもそのまま動く。
// 木目、けば、漆喰、石、青銅。摩耗と汚れは最後に重ねる。
// ---------------------------------------------------------------------------

const cache = new Map();

function canvas(size, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  return c;
}

function finish(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = aniso;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function memo(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

/** 摩耗・汚れ・煤を上から重ねる共通処理 */
function grime(ctx, w, h, rnd, amount = 0.5) {
  ctx.save();
  for (let i = 0; i < 220 * amount; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 2 + rnd() * rnd() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.72;
    g.addColorStop(0, dark ? `rgba(30,20,10,${0.05 + rnd() * 0.11})` : `rgba(255,240,210,${0.03 + rnd() * 0.06})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // こまかい粒子
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 26 * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.restore();
}

function woodGrain(ctx, w, h, rnd, base, dark, vertical, knots = 2) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const lines = 190;
  ctx.lineWidth = 1;
  for (let i = 0; i < lines; i++) {
    const t = i / lines;
    const a = 0.035 + rnd() * 0.14;
    ctx.strokeStyle = `rgba(${dark},${a})`;
    ctx.beginPath();
    const wobble = 5 + rnd() * 16;
    const freq = 0.6 + rnd() * 2.4;
    const phase = rnd() * 100;
    const steps = 26;
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const off = Math.sin(u * freq * Math.PI * 2 + phase) * wobble + Math.sin(u * 13.7 + phase) * 2.4;
      const p = t * (vertical ? w : h) + off;
      if (vertical) {
        const x = p;
        const y = u * h;
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      } else {
        const x = u * w;
        const y = p;
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  // 節
  for (let i = 0; i < knots; i++) {
    const kx = rnd() * w;
    const ky = rnd() * h;
    for (let r = 26; r > 0; r -= 2.4) {
      ctx.strokeStyle = `rgba(${dark},${0.05 + (1 - r / 26) * 0.4})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(kx, ky, r * (vertical ? 0.45 : 1), r * (vertical ? 1 : 0.45), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** 床板。板の継ぎ目、節、踏まれてすり減った中央、こぼれた油。 */
export function plankFloor() {
  return memo('plankFloor', () => {
    const S = 1024;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rnd = makeRandom(7);
    ctx.fillStyle = '#4a3623';
    ctx.fillRect(0, 0, S, S);
    const boards = 5;
    const bh = S / boards;
    for (let b = 0; b < boards; b++) {
      const tint = 0.82 + rnd() * 0.36;
      const r = Math.round(96 * tint);
      const g = Math.round(70 * tint);
      const bl = Math.round(45 * tint);
      const sub = canvas(S, Math.round(bh));
      const sctx = sub.getContext('2d');
      woodGrain(sctx, S, bh, rnd, `rgb(${r},${g},${bl})`, '52,34,18', false, 1);
      ctx.drawImage(sub, 0, b * bh);
      // 継ぎ目。板と板のあいだの隙間と、そこへ落ちる影。
      ctx.fillStyle = 'rgba(8,5,2,0.92)';
      ctx.fillRect(0, b * bh, S, 3);
      const gg = ctx.createLinearGradient(0, b * bh + 3, 0, b * bh + 16);
      gg.addColorStop(0, 'rgba(12,7,3,0.62)');
      gg.addColorStop(1, 'rgba(12,7,3,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(0, b * bh + 3, S, 13);
      const hl = ctx.createLinearGradient(0, b * bh - 9, 0, b * bh);
      hl.addColorStop(0, 'rgba(228,198,152,0)');
      hl.addColorStop(1, 'rgba(228,198,152,0.28)');
      ctx.fillStyle = hl;
      ctx.fillRect(0, b * bh - 9, S, 9);
      // 板の端の割れ
      ctx.strokeStyle = 'rgba(20,12,5,0.5)';
      ctx.lineWidth = 2;
      const x0 = rnd() * S;
      ctx.beginPath();
      ctx.moveTo(x0, b * bh + 4);
      ctx.lineTo(x0 + (rnd() - 0.5) * 90, b * bh + bh - 4);
      ctx.stroke();
    }
    // 歩き道。中央がすり減って明るい
    const wear = ctx.createLinearGradient(0, S * 0.28, 0, S * 0.72);
    wear.addColorStop(0, 'rgba(216,186,140,0)');
    wear.addColorStop(0.5, 'rgba(216,186,140,0.22)');
    wear.addColorStop(1, 'rgba(216,186,140,0)');
    ctx.fillStyle = wear;
    ctx.fillRect(0, 0, S, S);
    grime(ctx, S, S, rnd, 0.85);
    return finish(c, { repeat: [1, 1] });
  });
}

export function woodPost(seed = 3) {
  return memo('woodPost' + seed, () => {
    const S = 512;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rnd = makeRandom(seed);
    woodGrain(ctx, S, S, rnd, '#7a5a37', '58,38,20', true, 3);
    // 手が触れる高さの艶と汚れ
    const g = ctx.createLinearGradient(0, S * 0.45, 0, S);
    g.addColorStop(0, 'rgba(40,26,12,0)');
    g.addColorStop(1, 'rgba(40,26,12,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    grime(ctx, S, S, rnd, 0.7);
    return finish(c, { repeat: [1, 1] });
  });
}

export function beamWood() {
  return memo('beam', () => {
    const S = 512;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rnd = makeRandom(21);
    woodGrain(ctx, S, S, rnd, '#6b4e2f', '44,28,14', false, 2);
    // 煤けた上面
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, 'rgba(20,14,8,0.55)');
    g.addColorStop(0.6, 'rgba(20,14,8,0.05)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    grime(ctx, S, S, rnd, 0.9);
    return finish(c);
  });
}

/** 磨り減って手脂の乗った木。トップと道具用。 */
export function polishedWood() {
  return memo('polished', () => {
    const S = 512;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rnd = makeRandom(55);
    woodGrain(ctx, S, S, rnd, '#a3763f', '76,48,22', false, 1);
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, 'rgba(255,226,178,0.20)');
    g.addColorStop(0.5, 'rgba(120,80,36,0.10)');
    g.addColorStop(1, 'rgba(255,226,178,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    grime(ctx, S, S, rnd, 0.35);
    return finish(c);
  });
}

/** 生の麻。撚る前の毛羽だった繊維束。 */
export function hemp(light = 1) {
  return memo('hemp' + light, () => {
    const S = 512;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rnd = makeRandom(101 + light);
    ctx.fillStyle = light > 0.9 ? '#c8a566' : '#a8853f';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 1400; i++) {
      const y = rnd() * S;
      const x = rnd() * S;
      const len = 20 + rnd() * 150;
      const bright = rnd();
      ctx.strokeStyle =
        bright > 0.55
          ? `rgba(238,214,164,${0.12 + rnd() * 0.4})`
          : `rgba(96,68,30,${0.1 + rnd() * 0.34})`;
      ctx.lineWidth = 0.7 + rnd() * 1.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + len * 0.4, y + (rnd() - 0.5) * 8, x + len * 0.7, y + (rnd() - 0.5) * 10, x + len, y + (rnd() - 0.5) * 6);
      ctx.stroke();
    }
    grime(ctx, S, S, rnd, 0.4);
    return finish(c, { repeat: [1, 1] });
  });
}

/** 漆喰の腰壁。雨だれ、剥がれ、下地の土。 */
export function plaster() {
  return memo('plaster', () => {
    const S = 512;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rnd = makeRandom(9);
    ctx.fillStyle = '#c9c0a8';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      const x = rnd() * S;
      const w = 3 + rnd() * 20;
      ctx.fillStyle = `rgba(120,104,78,${0.05 + rnd() * 0.14})`;
      ctx.fillRect(x, rnd() * S * 0.5, w, S);
    }
    // 剥がれて土壁が出ている所。目立ちすぎない程度に。
    for (let i = 0; i < 9; i++) {
      const x = rnd() * S;
      const y = S * 0.55 + rnd() * S * 0.45;
      const rx = 5 + rnd() * 16;
      const ry = 4 + rnd() * 12;
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      g2.addColorStop(0, `rgba(132,102,70,${0.18 + rnd() * 0.2})`);
      g2.addColorStop(1, 'rgba(132,102,70,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // 雨だれの縦すじ
    for (let i = 0; i < 22; i++) {
      const x = rnd() * S;
      const g3 = ctx.createLinearGradient(x, 0, x, S);
      g3.addColorStop(0, 'rgba(96,84,64,0.16)');
      g3.addColorStop(1, 'rgba(96,84,64,0)');
      ctx.fillStyle = g3;
      ctx.fillRect(x, 0, 1 + rnd() * 3, S);
    }
    grime(ctx, S, S, rnd, 1.0);
    return finish(c);
  });
}

/** 屋外の地面。踏み固めた土と、まばらな草。 */
export function ground() {
  return memo('ground', () => {
    const S = 512;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rnd = makeRandom(63);
    ctx.fillStyle = '#bcae86';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 8 + rnd() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const green = rnd() > 0.42;
      g.addColorStop(0, green ? `rgba(122,140,84,${0.1 + rnd() * 0.34})` : `rgba(148,126,88,${0.1 + rnd() * 0.3})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 草の筆致
    for (let i = 0; i < 1800; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      ctx.strokeStyle = `rgba(${100 + rnd() * 60 | 0},${120 + rnd() * 60 | 0},${60 + rnd() * 40 | 0},${0.1 + rnd() * 0.35})`;
      ctx.lineWidth = 0.8 + rnd() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 8, y - 4 - rnd() * 10);
      ctx.stroke();
    }
    grime(ctx, S, S, rnd, 0.4);
    return finish(c);
  });
}

export function stone() {
  return memo('stone', () => {
    const S = 512;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rnd = makeRandom(31);
    ctx.fillStyle = '#8d8a80';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 1 + rnd() * 9;
      ctx.fillStyle = rnd() > 0.5 ? `rgba(180,178,166,${rnd() * 0.4})` : `rgba(70,68,62,${rnd() * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 苔
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(96,110,62,${0.06 + rnd() * 0.2})`;
      ctx.beginPath();
      ctx.arc(rnd() * S, rnd() * S, 6 + rnd() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    grime(ctx, S, S, rnd, 0.7);
    return finish(c);
  });
}

/** 青銅の梵鐘。緑青と、撞かれる所の磨り出し。 */
export function bronze() {
  return memo('bronze', () => {
    const S = 512;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const rnd = makeRandom(77);
    ctx.fillStyle = '#7e8d6c';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 500; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      const r = 4 + rnd() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const teal = rnd() > 0.45;
      g.addColorStop(0, teal ? `rgba(150,188,160,${rnd() * 0.55})` : `rgba(104,86,54,${rnd() * 0.45})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 縦の鋳型の筋
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgba(48,56,42,0.2)';
      ctx.fillRect((i / 5) * S, 0, 3, S);
    }
    grime(ctx, S, S, rnd, 0.5);
    return finish(c);
  });
}

/** 単純なノイズ（法線ゆらぎ・埃粒などに使う、リニア値） */
export function noiseTex(size = 256, seed = 5) {
  return memo('noise' + size + seed, () => {
    const c = canvas(size);
    const ctx = c.getContext('2d');
    const rnd = makeRandom(seed);
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rnd() * 255;
      img.data[i] = v;
      img.data[i + 1] = rnd() * 255;
      img.data[i + 2] = rnd() * 255;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return finish(c, { srgb: false });
  });
}

/** ふわっとした丸。埃・花びらの粒子用。 */
export function softDisc(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return memo('disc' + inner + outer, () => {
    const S = 128;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.42, inner.replace(/[\d.]+\)$/, '0.5)'));
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** 花びら（持ち上げ成功のごほうび） */
export function petalTex() {
  return memo('petal', () => {
    const S = 128;
    const c = canvas(S);
    const ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2);
    const g = ctx.createRadialGradient(0, -10, 2, 0, 0, 58);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,206,222,1)');
    g.addColorStop(1, 'rgba(247,158,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -54);
    ctx.bezierCurveTo(44, -34, 40, 30, 0, 54);
    ctx.bezierCurveTo(-40, 30, -44, -34, 0, -54);
    ctx.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** 空のグラデーション（天球用） */
export function skyTex(topHex, horizonHex, groundHex) {
  return memo('sky' + topHex + horizonHex + groundHex, () => {
    const c = canvas(8, 256);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    const hx = (h) => '#' + h.toString(16).padStart(6, '0');
    g.addColorStop(0.0, hx(topHex));
    g.addColorStop(0.42, hx(horizonHex));
    g.addColorStop(0.53, hx(horizonHex));
    g.addColorStop(1.0, hx(groundHex));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}
