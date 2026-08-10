// Procedural canvas textures. Everything is generated at runtime so the game
// ships without any binary assets and still gets real surface detail:
// short-pile fabric grain, thread, acrylic smudges, and an environment for
// the metal claw to reflect.

import * as THREE from '../vendor/three/three.module.min.js';

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** value noise -> height field, tileable */
function noiseField(size, freq, octaves = 3, seed = 1) {
  const rand = (x, y) => {
    let n = x * 374761393 + y * 668265263 + seed * 144665;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  };
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const f = freq * Math.pow(2, o);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * f, fy = (y / size) * f;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const m = (a, b) => a + (b - a) * sx;
        const v00 = rand(x0 % f, y0 % f), v10 = rand((x0 + 1) % f, y0 % f);
        const v01 = rand(x0 % f, (y0 + 1) % f), v11 = rand((x0 + 1) % f, (y0 + 1) % f);
        const v = m(v00, v10) + (m(v01, v11) - m(v00, v10)) * sy;
        out[y * size + x] += v * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/**
 * Short-pile plush: a very fine speckle with a faint directional grain.
 * Used as a normal map at high repeat -> light scatters unevenly like velour.
 */
export function fabricNormalMap() {
  return cached('fabricNormal', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const fine = noiseField(S, 96, 2, 7);
    const grain = noiseField(S, 24, 2, 19);
    const h = new Float32Array(S * S);
    for (let i = 0; i < h.length; i++) h[i] = fine[i] * 0.75 + grain[i] * 0.25;
    const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
    const strength = 2.6;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
        const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
        let nx = -dx, ny = -dy, nz = 1;
        const l = Math.hypot(nx, ny, nz);
        nx /= l; ny /= l; nz /= l;
        const i = (y * S + x) * 4;
        img.data[i] = (nx * 0.5 + 0.5) * 255;
        img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
        img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  });
}

/** Subtle roughness break-up so the plush never reads as a uniform plastic ball. */
export function fabricRoughnessMap() {
  return cached('fabricRough', () => {
    const S = 128;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const n = noiseField(S, 20, 3, 33);
    for (let i = 0; i < S * S; i++) {
      const v = 200 + n[i] * 55;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Brushed micro-scratches for the claw metal. */
export function metalNormalMap() {
  return cached('metalNormal', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const y = Math.random() * S;
      const x = Math.random() * S;
      const len = 4 + Math.random() * 40;
      const bright = Math.random() < 0.5;
      ctx.strokeStyle = bright ? 'rgba(150,128,255,0.35)' : 'rgba(110,128,255,0.35)';
      ctx.lineWidth = Math.random() < 0.8 ? 1 : 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y + (Math.random() - 0.5) * 2);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Fingerprints / dust on the acrylic panes. */
export function smudgeMap() {
  return cached('smudge', () => {
    const S = 512;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const r = 18 + Math.random() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.03 + Math.random() * 0.07;
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.6, `rgba(255,255,255,${a * 0.4})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // a couple of streaks, like a wiped cloth
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.translate(Math.random() * S, Math.random() * S);
      ctx.rotate(Math.random() * Math.PI);
      const g = ctx.createLinearGradient(-120, 0, 120, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-120, -7, 240, 14);
      ctx.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Soft round shadow used for the aim target and cheap contact shadows. */
export function softBlob(color = '0,0,0', power = 1.0) {
  return cached('blob' + color + power, () => {
    const S = 128;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, `rgba(${color},${0.85 * power})`);
    g.addColorStop(0.45, `rgba(${color},${0.45 * power})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    return t;
  });
}

/** Pastel mat with a dotted pattern for the prize floor. */
export function matTexture() {
  return cached('mat', () => {
    const S = 512;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#cfd3ee');
    g.addColorStop(1, '#b6bce0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const ox = (y % 2) * 32;
        ctx.beginPath();
        ctx.arc(x * 64 + 32 + ox, y * 64 + 32, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Marquee artwork for the top of the cabinet (no readable text needed). */
export function marqueeTexture() {
  return cached('marquee', () => {
    const W = 512, H = 160;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ff9ec4');
    g.addColorStop(0.5, '#ffd1e4');
    g.addColorStop(1, '#ff86b6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // stripes
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#fff';
    for (let i = -H; i < W; i += 44) {
      ctx.beginPath();
      ctx.moveTo(i, H); ctx.lineTo(i + 22, H); ctx.lineTo(i + 22 + H, 0); ctx.lineTo(i + H, 0);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // a paw + star motif so it reads as a toy machine, not a text banner
    const star = (x, y, r, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
    };
    const paw = (x, y, s, col) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(x, y + s * 0.25, s * 0.8, s * 0.65, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI * 0.85 + i * Math.PI * 0.23;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * s * 0.85, y + Math.sin(a) * s * 0.85, s * 0.26, s * 0.34, a + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    star(70, 80, 34, '#fff6b0');
    star(442, 80, 34, '#fff6b0');
    paw(190, 82, 40, '#ffffff');
    paw(322, 82, 40, '#ffffff');
    star(256, 74, 46, '#ffffff');
    star(256, 74, 26, '#ffd166');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Equirectangular studio-ish environment: warm top light + two LED strips. */
export function environmentEquirect() {
  return cached('env', () => {
    const W = 512, H = 256;
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#fff4e2');
    g.addColorStop(0.35, '#e6ecf5');
    g.addColorStop(0.62, '#b9c2d0');
    g.addColorStop(1, '#4a4f59');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // ceiling light bar
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(0, 10, W, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, 34, W, 16);
    // coloured arcade glow (gives the chrome its pink/blue kisses)
    const blob = (x, y, r, col) => {
      const gg = ctx.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, col);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    blob(110, 96, 90, 'rgba(255,150,200,0.85)');
    blob(390, 104, 90, 'rgba(150,205,255,0.85)');
    blob(256, 60, 70, 'rgba(255,240,200,0.9)');
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Vertical gradient used as the scene backdrop. */
export function backdropTexture(top = '#3a3050', bottom = '#7a6b8f') {
  return cached('backdrop' + top + bottom, () => {
    const c = canvas(4, 256);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(0.55, bottom);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Little printed hangtag artwork (heart / star). */
export function tagTexture(kind = 'heart', bg = '#ffffff', ink = '#ff7aa8') {
  return cached('tag' + kind + bg + ink, () => {
    const S = 64;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = ink;
    ctx.save();
    ctx.translate(S / 2, S / 2 + 4);
    if (kind === 'heart') {
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.bezierCurveTo(-20, -4, -12, -22, 0, -10);
      ctx.bezierCurveTo(12, -22, 20, -4, 0, 12);
      ctx.fill();
    } else {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? 7 : 16;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr - 2);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Wallpaper for the collection room. */
export function wallpaperTexture() {
  return cached('wallpaper', () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fdf3e6';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,190,200,0.55)';
    ctx.lineWidth = 6;
    for (let i = -S; i < S * 2; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,214,160,0.7)';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      ctx.beginPath();
      ctx.arc(x * 64 + 32 + (y % 2) * 32, y * 64 + 32, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

export function disposeTextureCache() {
  for (const t of cache.values()) if (t.dispose) t.dispose();
  cache.clear();
}
