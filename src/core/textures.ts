import * as THREE from 'three';
import { clamp01, fbm, makeNoise2D, makeRng } from './util';

type Ctx = CanvasRenderingContext2D;

function makeCanvas(size: number): { c: HTMLCanvasElement; x: Ctx } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const x = c.getContext('2d')!;
  return { c, x };
}

function finish(c: HTMLCanvasElement, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Build a normal map from a height callback via central differences. */
function normalFromHeight(size: number, height: (x: number, y: number) => number, strength = 2.2) {
  const { c, x: ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const e = 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = height((x - e + size) % size, y);
      const hR = height((x + e) % size, y);
      const hD = height(x, (y - e + size) % size);
      const hU = height(x, (y + e) % size);
      let nx = (hL - hR) * strength;
      let ny = (hD - hU) * strength;
      const nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      const i = (y * size + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * inv * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export interface TexturePack {
  hullPaint: THREE.Texture;
  hullNormal: THREE.Texture;
  hullRough: THREE.Texture;
  deck: THREE.Texture;
  deckNormal: THREE.Texture;
  steel: THREE.Texture;
  steelNormal: THREE.Texture;
  sand: THREE.Texture;
  sandNormal: THREE.Texture;
  rock: THREE.Texture;
  cableJacket: THREE.Texture;
  cableNormal: THREE.Texture;
  cableRough: THREE.Texture;
  soft: THREE.Texture;
  ring: THREE.Texture;
  caustics: THREE.Texture;
  waterNormal: THREE.Texture;
  islandGround: THREE.Texture;
}

/** Speckled grime + streaks overlay used on painted metal. */
function grime(ctx: Ctx, size: number, seed: number, amount = 1) {
  const rng = makeRng(seed);
  ctx.save();
  // vertical rust streaks
  for (let i = 0; i < 60 * amount; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const h = 12 + rng() * size * 0.4;
    const w = 1 + rng() * 3;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    const a = 0.05 + rng() * 0.12;
    g.addColorStop(0, `rgba(70,44,26,${a})`);
    g.addColorStop(1, 'rgba(70,44,26,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  // scuffs
  for (let i = 0; i < 130 * amount; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.globalAlpha = 0.04 + rng() * 0.1;
    ctx.fillStyle = rng() > 0.5 ? '#0d1418' : '#d9d2c4';
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + rng() * 7, 1 + rng() * 2.4, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function buildTextures(): TexturePack {
  const S = 256;
  const n = makeNoise2D(1337);

  // ---- hull paint (worn marine orange-red boot topping over grey) -----------
  const hull = makeCanvas(S);
  hull.x.fillStyle = '#c9cfd2';
  hull.x.fillRect(0, 0, S, S);
  {
    const img = hull.x.getImageData(0, 0, S, S);
    const d = img.data;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const v = fbm(n, x / 46, y / 46, 4) * 0.5 + 0.5;
        const i = (y * S + x) * 4;
        const k = 0.82 + v * 0.3;
        d[i] *= k;
        d[i + 1] *= k;
        d[i + 2] *= k;
      }
    hull.x.putImageData(img, 0, 0);
  }
  // plate seams
  hull.x.strokeStyle = 'rgba(40,50,56,0.35)';
  hull.x.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    hull.x.beginPath();
    hull.x.moveTo(0, (i * S) / 4);
    hull.x.lineTo(S, (i * S) / 4);
    hull.x.stroke();
  }
  grime(hull.x, S, 7, 1);
  const hullPaint = finish(hull.c, 1);

  const hullNormal = normalFromHeight(
    128,
    (x, y) => fbm(n, x / 12, y / 12, 3) * 0.35 + (Math.abs(((y / 32) % 1) - 0.5) < 0.06 ? -0.5 : 0),
    1.6,
  );
  const hullRough = (() => {
    const { c, x } = makeCanvas(128);
    const img = x.createImageData(128, 128);
    for (let y = 0; y < 128; y++)
      for (let xx = 0; xx < 128; xx++) {
        const v = clamp01(0.55 + fbm(n, xx / 18, y / 18, 3) * 0.4);
        const i = (y * 128 + xx) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
        img.data[i + 3] = 255;
      }
    x.putImageData(img, 0, 0);
    return finish(c, 1, false);
  })();

  // ---- deck: non-slip green/grey with yellow walkway wear ------------------
  const deck = makeCanvas(S);
  deck.x.fillStyle = '#5c6a63';
  deck.x.fillRect(0, 0, S, S);
  {
    const rng = makeRng(4);
    for (let i = 0; i < 5200; i++) {
      const x = rng() * S;
      const y = rng() * S;
      deck.x.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)';
      deck.x.fillRect(x, y, 2, 2);
    }
  }
  deck.x.strokeStyle = 'rgba(20,26,24,0.45)';
  deck.x.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    deck.x.beginPath();
    deck.x.moveTo(0, (i * S) / 4);
    deck.x.lineTo(S, (i * S) / 4);
    deck.x.stroke();
  }
  grime(deck.x, S, 21, 0.8);
  const deckTex = finish(deck.c, 4);
  const deckNormal = normalFromHeight(128, (x, y) => fbm(n, x / 5, y / 5, 2) * 0.3, 1.1);

  // ---- bare/galvanised steel for machinery --------------------------------
  const steel = makeCanvas(S);
  steel.x.fillStyle = '#8d949a';
  steel.x.fillRect(0, 0, S, S);
  {
    const img = steel.x.getImageData(0, 0, S, S);
    const d = img.data;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const v = fbm(n, x / 8, y / 60, 4) * 0.5 + 0.5;
        const i = (y * S + x) * 4;
        const k = 0.78 + v * 0.42;
        d[i] *= k;
        d[i + 1] *= k;
        d[i + 2] *= k;
      }
    steel.x.putImageData(img, 0, 0);
  }
  grime(steel.x, S, 99, 1.2);
  const steelTex = finish(steel.c, 1);
  const steelNormal = normalFromHeight(128, (x, y) => fbm(n, x / 9, y / 40, 3) * 0.4, 1.5);

  // ---- seabed sand: rippled, with shell fragments --------------------------
  const sand = makeCanvas(S);
  {
    const img = sand.x.createImageData(S, S);
    const d = img.data;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const ripple = Math.sin((x / S) * Math.PI * 2 * 9 + fbm(n, x / 40, y / 40, 3) * 4) * 0.5 + 0.5;
        const grain = fbm(n, x / 3.5, y / 3.5, 2) * 0.5 + 0.5;
        const v = 0.62 + ripple * 0.2 + grain * 0.18;
        const i = (y * S + x) * 4;
        d[i] = clamp01(v * 0.99) * 214;
        d[i + 1] = clamp01(v * 0.95) * 200;
        d[i + 2] = clamp01(v * 0.86) * 176;
        d[i + 3] = 255;
      }
    sand.x.putImageData(img, 0, 0);
    const rng = makeRng(55);
    for (let i = 0; i < 380; i++) {
      sand.x.globalAlpha = 0.1 + rng() * 0.35;
      sand.x.fillStyle = rng() > 0.65 ? '#f2ece0' : '#7d7160';
      sand.x.beginPath();
      sand.x.ellipse(rng() * S, rng() * S, 0.7 + rng() * 2.4, 0.6 + rng() * 1.6, rng() * 3.14, 0, 6.3);
      sand.x.fill();
    }
    sand.x.globalAlpha = 1;
  }
  const sandTex = finish(sand.c, 1);
  const sandNormal = normalFromHeight(
    192,
    (x, y) => Math.sin((x / 192) * Math.PI * 2 * 9 + fbm(n, x / 30, y / 30, 3) * 4) * 0.5 + fbm(n, x / 4, y / 4, 2) * 0.25,
    2.4,
  );

  // ---- rock --------------------------------------------------------------
  const rock = makeCanvas(S);
  {
    const img = rock.x.createImageData(S, S);
    const d = img.data;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const v = fbm(n, x / 26, y / 26, 5) * 0.5 + 0.5;
        const c2 = fbm(n, x / 6 + 30, y / 6, 3) * 0.5 + 0.5;
        const i = (y * S + x) * 4;
        const g = 0.36 + v * 0.42 + c2 * 0.14;
        d[i] = g * 150;
        d[i + 1] = g * 152;
        d[i + 2] = g * 148;
        d[i + 3] = 255;
      }
    rock.x.putImageData(img, 0, 0);
  }
  const rockTex = finish(rock.c, 1);

  // ---- cable jacket: black polyethylene over helical armour wires ---------
  const cab = makeCanvas(S);
  {
    cab.x.fillStyle = '#1c1f22';
    cab.x.fillRect(0, 0, S, S);
    // helical armour wires run diagonally around the circumference (U = around)
    const wires = 26;
    for (let i = 0; i < wires; i++) {
      const t = i / wires;
      const g = cab.x.createLinearGradient(t * S, 0, t * S + S / wires, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.02)');
      g.addColorStop(0.42, 'rgba(255,255,255,0.16)');
      g.addColorStop(0.62, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0.30)');
      cab.x.save();
      cab.x.translate(t * S, 0);
      cab.x.transform(1, 0, 0.14, 1, 0, 0);
      cab.x.fillStyle = g;
      cab.x.fillRect(0, -S, S / wires, S * 3);
      cab.x.restore();
    }
    grime(cab.x, S, 303, 0.55);
  }
  const cableJacket = finish(cab.c, 1);
  const cableNormal = normalFromHeight(
    192,
    (x, y) => {
      const u = (x / 192) * 26 + (y / 192) * 3.6;
      return Math.sin(u * Math.PI * 2) * 0.5;
    },
    2.0,
  );
  const cableRough = (() => {
    const { c, x } = makeCanvas(64);
    const img = x.createImageData(64, 64);
    for (let y = 0; y < 64; y++)
      for (let xx = 0; xx < 64; xx++) {
        const v = clamp01(0.34 + fbm(n, xx / 9, y / 9, 3) * 0.4);
        const i = (y * 64 + xx) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
        img.data[i + 3] = 255;
      }
    x.putImageData(img, 0, 0);
    return finish(c, 1, false);
  })();

  // ---- soft round sprite (particles, bubbles, glows) -----------------------
  const soft = (() => {
    const { c, x } = makeCanvas(64);
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // ---- bubble ring sprite --------------------------------------------------
  const ring = (() => {
    const { c, x } = makeCanvas(64);
    x.clearRect(0, 0, 64, 64);
    const g = x.createRadialGradient(32, 32, 12, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.03)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.94, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(32, 32, 31, 0, 6.3);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.beginPath();
    x.ellipse(24, 22, 5.5, 3.6, -0.6, 0, 6.3);
    x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // ---- caustics (tiling) ---------------------------------------------------
  const caustics = (() => {
    const size = 256;
    const { c, x } = makeCanvas(size);
    const img = x.createImageData(size, size);
    const d = img.data;
    const nn = makeNoise2D(909);
    for (let y = 0; y < size; y++)
      for (let xx = 0; xx < size; xx++) {
        const a = fbm(nn, xx / 26, y / 26, 3);
        const b = fbm(nn, xx / 26 + 5.3, y / 26 + 2.1, 3);
        let v = 1 - Math.min(1, Math.hypot(a, b) * 2.4);
        v = Math.pow(clamp01(v), 3.2);
        const i = (y * size + xx) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = v * 255;
      }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // ---- water normal map ----------------------------------------------------
  const waterNormal = normalFromHeight(
    256,
    (x, y) => {
      const nn = fbm(n, x / 34, y / 22, 4);
      return nn * 0.6 + Math.sin(x / 9 + nn * 2) * 0.15;
    },
    1.5,
  );
  waterNormal.repeat.set(1, 1);

  // ---- island ground -------------------------------------------------------
  const islandGround = (() => {
    const { c, x } = makeCanvas(S);
    const img = x.createImageData(S, S);
    const d = img.data;
    for (let y = 0; y < S; y++)
      for (let xx = 0; xx < S; xx++) {
        const v = fbm(n, xx / 20, y / 20, 4) * 0.5 + 0.5;
        const patch = fbm(n, xx / 55 + 12, y / 55, 2) * 0.5 + 0.5;
        const i = (y * S + xx) * 4;
        const green = patch > 0.46;
        d[i] = (green ? 88 : 196) * (0.7 + v * 0.55);
        d[i + 1] = (green ? 132 : 182) * (0.7 + v * 0.55);
        d[i + 2] = (green ? 74 : 146) * (0.7 + v * 0.55);
        d[i + 3] = 255;
      }
    x.putImageData(img, 0, 0);
    return finish(c, 1);
  })();

  return {
    hullPaint,
    hullNormal,
    hullRough,
    deck: deckTex,
    deckNormal,
    steel: steelTex,
    steelNormal,
    sand: sandTex,
    sandNormal,
    rock: rockTex,
    cableJacket,
    cableNormal,
    cableRough,
    soft,
    ring,
    caustics,
    waterNormal,
    islandGround,
  };
}

let cached: TexturePack | null = null;
export function textures(): TexturePack {
  if (!cached) cached = buildTextures();
  return cached;
}
