// Procedural textures and materials.  Nothing is loaded from disk, so the
// game boots instantly and works offline.

import * as THREE from '../core/three.js';
import { clamp01, lerp, hash2, makeRng } from '../core/util.js';

/* ------------------------------------------------------------------ *
 *  value noise on a canvas                                            *
 * ------------------------------------------------------------------ */

function fbmField(size, octaves, seed) {
  const out = new Float32Array(size * size);
  let amp = 1, freq = 2, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const g = freq | 0, grid = new Float32Array((g + 1) * (g + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = hash2(i % (g + 1) + seed * 13, ((i / (g + 1)) | 0) + o * 31 + seed * 7);
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * g, y0 = Math.floor(fy), ty = fy - y0;
      const y0w = y0 % g, y1w = (y0 + 1) % g;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * g, x0 = Math.floor(fx), tx = fx - x0;
        const x0w = x0 % g, x1w = (x0 + 1) % g;
        const sx = tx * tx * (3 - 2 * tx);
        const a = grid[y0w * (g + 1) + x0w], b = grid[y0w * (g + 1) + x1w];
        const c = grid[y1w * (g + 1) + x0w], d = grid[y1w * (g + 1) + x1w];
        out[y * size + x] += amp * lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
      }
    }
    norm += amp; amp *= 0.52; freq *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/**
 * Build a tiling texture. `paint(n, x, y, rng)` returns [r,g,b] in 0..255.
 */
export function makeTexture(size, octaves, seed, paint, { repeat = 1, srgb = true } = {}) {
  const f = fbmField(size, octaves, seed);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rng = makeRng(seed * 9781 + 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const c = paint(f[i], x / size, y / size, rng, f);
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1];
      img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = c.length > 3 ? c[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ *
 *  shared texture library (built once)                                *
 * ------------------------------------------------------------------ */
export const TEX = {};

export function buildTextures() {
  if (TEX.built) return TEX;

  // Colour lives in the maps, not in material.color -- multiplying two dark
  // values together is what makes procedural scenes look like mud.  Every
  // mapped material below therefore uses a near-white base colour.

  // grey-green core clay
  TEX.clayCore = makeTexture(256, 5, 3, (n, x, y, rng) => {
    const g = 0.74 + n * 0.42 + (rng() - 0.5) * 0.07;
    return [163 * g, 154 * g, 138 * g];
  }, { repeat: 5 });

  // red-brown false-bell clay
  TEX.clayFalse = makeTexture(256, 5, 11, (n, x, y, rng) => {
    const g = 0.72 + n * 0.46 + (rng() - 0.5) * 0.06;
    return [201 * g, 126 * g, 93 * g];
  }, { repeat: 5 });

  // coarse mould earth with straw
  TEX.moldEarth = makeTexture(256, 5, 23, (n, x, y, rng) => {
    let g = 0.70 + n * 0.48;
    if (rng() > 0.985) return [214, 196, 148];        // a strand of straw
    g += (rng() - 0.5) * 0.10;
    return [156 * g, 134 * g, 110 * g];
  }, { repeat: 3.2 });

  // speckle used as the alpha-cutout threshold for daubed mud
  TEX.speck = makeTexture(128, 4, 41, (n) => {
    const v = clamp01(n * 1.25 - 0.1) * 255;
    return [v, v, v];
  }, { repeat: 1, srgb: false });

  // roughness / wear map for cast bronze
  TEX.bronzeRough = makeTexture(256, 5, 57, (n, x, y, rng) => {
    const v = clamp01(0.24 + n * 0.5 + (rng() - 0.5) * 0.08) * 255;
    return [v, v, v];
  }, { repeat: 2, srgb: false });

  // patina / soot blotches on the bronze
  TEX.bronzeStain = makeTexture(256, 4, 71, (n) => {
    const v = clamp01(0.82 + n * 0.30) * 255;
    return [v, v * 0.985, v * 0.955];
  }, { repeat: 2 });

  // foundry floor: sand, ash, scattered grit
  TEX.floor = makeTexture(256, 5, 91, (n, x, y, rng) => {
    let g = 0.62 + n * 0.44;
    if (rng() > 0.992) g *= 0.55;
    g += (rng() - 0.5) * 0.09;
    return [152 * g, 136 * g, 118 * g];
  }, { repeat: 11 });

  // sooty brick for the furnace and the back wall
  TEX.brick = makeTexture(256, 4, 113, (n, x, y, rng) => {
    const row = Math.floor(y * 12);
    const off = (row % 2) * 0.5;
    const bx = (x * 6 + off) % 1, by = (y * 12) % 1;
    const mortar = (bx < 0.045 || bx > 0.955 || by < 0.09 || by > 0.91) ? 1 : 0;
    let g = 0.72 + n * 0.4;
    if (mortar) return [128 * g, 120 * g, 111 * g];
    g *= 0.86 + hash2(Math.floor(x * 6 + off), row) * 0.34;
    return [158 * g, 101 * g, 78 * g];
  }, { repeat: 3 });

  TEX.built = true;
  return TEX;
}

/* ------------------------------------------------------------------ *
 *  environment map                                                    *
 * ------------------------------------------------------------------ */

/**
 * A hand-painted equirectangular sky for reflections: dark rafters overhead,
 * cool daylight from the tall windows, a hot orange bloom at the furnace, and
 * a dusty floor bounce.  The bell's surface has to *read* as metal, and metal
 * reads through what it reflects.
 */
export function buildEnvMap(renderer) {
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.00, '#0a0806');
  grad.addColorStop(0.34, '#241a14');
  grad.addColorStop(0.50, '#4a382a');
  grad.addColorStop(0.62, '#3a2c21');
  grad.addColorStop(1.00, '#120c09');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  const blob = (x, y, rx, ry, col, a) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(1, ry / Math.max(rx, ry));
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2); g.fill(); g.restore();
  };

  // tall cool windows along the back wall
  for (let i = 0; i < 4; i++) {
    const x = 40 + i * 118;
    blob(x, 96, 34, 66, 'rgba(196,222,255,0.95)', 0.85);
    g.globalAlpha = 0.5; g.fillStyle = '#cfe2ff';
    g.fillRect(x - 13, 58, 26, 78); g.globalAlpha = 1;
  }
  // furnace mouth -- the dominant warm source
  blob(300, 150, 72, 52, 'rgba(255,150,60,1)', 1.0);
  blob(300, 150, 30, 26, 'rgba(255,232,190,1)', 1.0);
  // dusty floor bounce
  blob(256, 236, 260, 40, 'rgba(150,110,74,0.9)', 0.6);

  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose(); pmrem.dispose();
  return rt.texture;
}

/* ------------------------------------------------------------------ *
 *  materials                                                          *
 * ------------------------------------------------------------------ */

export function clayCoreMaterial() {
  return new THREE.MeshStandardMaterial({
    map: TEX.clayCore, color: 0xffffff, roughness: 0.94, metalness: 0.0,
  });
}

export function clayFalseMaterial() {
  return new THREE.MeshStandardMaterial({
    map: TEX.clayFalse, color: 0xffffff, roughness: 0.82, metalness: 0.0,
  });
}

/**
 * Outer mould.  `aCover` (0..1) is compared against a speckle field and
 * discarded below it, so the mud appears as growing daubs rather than a
 * ghostly fading shell -- and it needs no alpha sorting.
 */
export function moldMaterial() {
  const m = new THREE.MeshStandardMaterial({
    map: TEX.moldEarth, color: 0xffffff, roughness: 0.97, metalness: 0.0,
    side: THREE.DoubleSide, alphaTest: 0.001,
  });
  m.userData.uniforms = {
    uSpeck: { value: TEX.speck }, uWet: { value: 1.0 },
    uFill: { value: -1.0 },        // height of the bronze inside, in metres
    uGlow: { value: 0.0 },         // how fiercely it shines through the earth
    uHotCol: { value: new THREE.Color(0xff8830) },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCover;\nvarying float vCover;\nvarying float vLocalY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCover = aCover;\nvLocalY = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uSpeck; uniform float uWet;
        uniform float uFill; uniform float uGlow; uniform vec3 uHotCol;
        varying float vCover; varying float vLocalY;`)
      .replace('#include <map_fragment>', `
        float spk = texture2D( uSpeck, vMapUv * 3.0 ).r;
        if ( vCover < spk * 0.72 + 0.04 ) discard;
        #include <map_fragment>
        // freshly laid mud is dark and wet; it dries lighter as it sets
        float fresh = 1.0 - smoothstep( 0.25, 0.95, vCover );
        diffuseColor.rgb *= mix( 1.0, 0.55, fresh * uWet );
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor *= mix( 1.0, 0.62, (1.0 - smoothstep(0.25,0.95,vCover)) * uWet );
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        // Bronze standing inside the flask heats the earth from within: the
        // shell lights up from the bottom as the level climbs, which is the
        // only way to see the pour actually working.
        float below = 1.0 - smoothstep( uFill - 0.10, uFill + 0.12, vLocalY );
        float seep  = pow( texture2D( uSpeck, vMapUv * 5.0 ).r, 1.4 );
        float band  = exp( -abs( vLocalY - uFill ) * 5.0 );
        totalEmissiveRadiance += uHotCol * uGlow * ( below * (0.22 + 0.8 * seep) + band * 0.9 );
      `);
  };
  m.customProgramCacheKey = () => 'moldMat';
  return m;
}

export const METALS = {
  gold:   { key: 'gold',   name: 0xffca7a, color: 0xd9a04c, molten: 0xffd08a, bright: 0.62, rough: 0.30 },
  red:    { key: 'red',    name: 0xff9a6a, color: 0xb05f34, molten: 0xff9048, bright: 0.36, rough: 0.38 },
  silver: { key: 'silver', name: 0xdfe6ec, color: 0xb9c2c6, molten: 0xffe9d2, bright: 0.86, rough: 0.24 },
};
export const METAL_KEYS = ['gold', 'red', 'silver'];

export function bronzeMaterial(metalKey) {
  const M = METALS[metalKey] || METALS.gold;
  const m = new THREE.MeshStandardMaterial({
    color: M.color,
    map: TEX.bronzeStain,
    roughnessMap: TEX.bronzeRough,
    roughness: M.rough,
    metalness: 1.0,
    envMapIntensity: 1.25,
  });
  m.userData.metal = M;
  return m;
}

/**
 * Molten bronze: emissive, with heat scrolling through it.  `uHeat` drives the
 * whole cooling stage -- 1 is white-hot liquid, 0 is dead cold metal.
 */
export function moltenMaterial(metalKey, { flow = 1 } = {}) {
  const M = METALS[metalKey] || METALS.gold;
  const m = new THREE.MeshStandardMaterial({
    color: 0x120a06, roughness: 0.34, metalness: 0.85,
    emissive: new THREE.Color(M.molten), emissiveIntensity: 2.4,
  });
  const u = {
    uTime: { value: 0 }, uHeat: { value: 1 }, uFlow: { value: flow },
    uHot: { value: new THREE.Color(M.molten) },
    uCold: { value: new THREE.Color(M.color) },
  };
  m.userData.uniforms = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uHeat; uniform float uFlow;
        uniform vec3 uHot; uniform vec3 uCold;
        varying vec3 vLocal;
        float h31(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453); }
        float vnoise(vec3 p){
          vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          float n000=h31(i), n100=h31(i+vec3(1,0,0)), n010=h31(i+vec3(0,1,0)), n110=h31(i+vec3(1,1,0));
          float n001=h31(i+vec3(0,0,1)), n101=h31(i+vec3(1,0,1)), n011=h31(i+vec3(0,1,1)), n111=h31(i+vec3(1,1,1));
          return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
                     mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);
        }`)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        vec3 q = vLocal * 3.4;
        q.y -= uTime * 1.6 * uFlow;
        float n = vnoise(q) * 0.6 + vnoise(q * 2.7 + 11.0) * 0.4;
        // hotter in the middle of the stream, skinning over at the edges
        float local = uHeat * mix(0.55, 1.25, n);
        vec3 hot = mix(uHot, vec3(1.0, 0.96, 0.86), smoothstep(0.72, 1.15, local));
        totalEmissiveRadiance = hot * pow(clamp(local,0.0,1.4), 2.0) * 2.6;
        diffuseColor.rgb = mix(uCold * 0.35, uHot * 0.5, clamp(local,0.0,1.0));
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = mix(0.55, 0.22, clamp(uHeat,0.0,1.0));
      `);
  };
  m.customProgramCacheKey = () => 'moltenMat';
  return m;
}

/** unlit additive sprite material for glow / dust / sparks */
export function spriteMaterial(tex, { color = 0xffffff, opacity = 1, additive = true, depthWrite = false } = {}) {
  return new THREE.PointsMaterial({
    map: tex, color, transparent: true, opacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite, sizeAttenuation: true,
  });
}

/** soft round dot used by every particle system */
export function makeDotTexture(soft = 0.5, size = 64) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(soft, 'rgba(255,255,255,0.55)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
