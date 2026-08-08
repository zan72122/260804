// Procedural textures and materials.  Nothing is loaded from disk, so the
// game boots instantly and works offline.

import * as THREE from '../core/three.js';
import { clamp01, lerp, smoothstep, hash2, makeRng } from '../core/util.js';

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

/**
 * Build a normal map from a procedural height field.
 *
 * Nothing in this shop had one, which is why every surface read as "a colour"
 * rather than as a material: with a perfectly flat normal, baked earth, sand,
 * brick and clay all respond to a moving light in exactly the same way, and
 * the eye reads the whole room as painted card.  Micro-relief is what makes a
 * surface argue with the light.
 */
export function makeNormalTexture(size, octaves, seed, heightFn, { strength = 1, repeat = 1 } = {}) {
  const f = fbmField(size, octaves, seed);
  const rng = makeRng(seed * 331 + 7);
  const hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      hgt[i] = heightFn(f[i], x / size, y / size, rng);
    }
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const at = (x, y) => hgt[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength * size * 0.02;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength * size * 0.02;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
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
    const g = 0.60 + n * 0.52 + (rng() - 0.5) * 0.12;
    return [122 * g, 113 * g, 99 * g];
  }, { repeat: 9 });

  // red-brown false-bell clay
  TEX.clayFalse = makeTexture(256, 5, 11, (n, x, y, rng) => {
    const g = 0.66 + n * 0.60 + (rng() - 0.5) * 0.09;
    return [201 * g, 126 * g, 93 * g];
  }, { repeat: 9 });

  // coarse mould earth with straw
  TEX.moldEarth = makeTexture(256, 7, 23, (n, x, y, rng) => {
    // high octave count and heavy grain: a low-frequency blob would tile
    // visibly across a two-metre flask and read as wallpaper
    let g = 0.80 + n * 0.34;
    if (rng() > 0.982) return [212, 194, 148];        // a strand of straw
    g += (rng() - 0.5) * 0.17;
    return [156 * g, 134 * g, 110 * g];
  }, { repeat: 3.5 });

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
    let g = 0.58 + n * 0.44;
    if (rng() > 0.992) g *= 0.55;
    g += (rng() - 0.5) * 0.09;
    return [126 * g, 111 * g, 95 * g];
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

  /* ---- micro-relief.  Same seeds as the colour maps above, so the bumps
     line up with the grain instead of fighting it. ---- */
  TEX.clayCoreN = makeNormalTexture(256, 5, 3, (n, x, y, rng) => n + (rng() - 0.5) * 0.10,
    { strength: 0.9, repeat: 9 });
  TEX.clayFalseN = makeNormalTexture(256, 5, 11, (n, x, y, rng) => n + (rng() - 0.5) * 0.09,
    { strength: 0.8, repeat: 9 });
  // earth gets coarse lumps plus the odd protruding grain
  TEX.moldEarthN = makeNormalTexture(256, 7, 23, (n, x, y, rng) => {
    let h = n;
    if (rng() > 0.975) h += 0.30;
    return h + (rng() - 0.5) * 0.22;
  }, { strength: 1.5, repeat: 3.5 });
  TEX.floorN = makeNormalTexture(256, 5, 91, (n, x, y, rng) => n * 0.7 + (rng() - 0.5) * 0.30,
    { strength: 0.8, repeat: 11 });
  // brick: the mortar courses are the relief that matters
  TEX.brickN = makeNormalTexture(256, 4, 113, (n, x, y) => {
    const row = Math.floor(y * 12);
    const off = (row % 2) * 0.5;
    const bx = (x * 6 + off) % 1, by = (y * 12) % 1;
    const inset = Math.min(
      smoothstep(0, 0.055, bx), smoothstep(0, 0.055, 1 - bx),
      smoothstep(0, 0.11, by), smoothstep(0, 0.11, 1 - by)
    );
    return inset * 0.75 + n * 0.25;
  }, { strength: 2.2, repeat: 3 });

  TEX.built = true;
  return TEX;
}

/* ------------------------------------------------------------------ *
 *  environment map                                                    *
 * ------------------------------------------------------------------ */

/**
 * Shared environment maps.  `room` lights the shop; `metal` is the one the
 * bronze reflects and is deliberately far brighter.
 */
export const ENV = { room: null, metal: null };

/**
 * Paint the shop's radiance as a floating-point equirectangular map.
 *
 * This has to be HDR, not a canvas.  A canvas clamps at 1.0, and a metal
 * surface is *nothing but* its reflection -- so with an LDR environment the
 * brightest thing a polished bell can ever be is roughly the brightness of a
 * wall, which is exactly why it was reading as painted cardboard.  Real
 * windows are tens of times brighter than the brick beside them; give the map
 * that range and the bell grows a proper travelling highlight instead.
 */
function paintRadiance(punch, winR = 0.030) {
  const W = 256, H = 128;
  const data = new Float32Array(W * H * 4);
  const gauss = (d, r) => Math.exp(-(d * d) / (2 * r * r));

  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;                       // 0 = straight up
    // roof timbers overhead, warm wall, then the dusty floor bounce
    let r, g, b;
    if (v < 0.30) { const k = v / 0.30; r = lerp(0.015, 0.09, k); g = lerp(0.012, 0.075, k); b = lerp(0.010, 0.060, k); }
    else if (v < 0.62) { const k = (v - 0.30) / 0.32; r = lerp(0.09, 0.34, k); g = lerp(0.075, 0.27, k); b = lerp(0.060, 0.21, k); }
    else { const k = (v - 0.62) / 0.38; r = lerp(0.34, 0.16, k); g = lerp(0.27, 0.125, k); b = lerp(0.21, 0.095, k); }

    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      let rr = r, gg = g, bb = b;

      // four tall windows down the back wall
      for (let i = 0; i < 4; i++) {
        const cu = 0.085 + i * 0.25;
        let du = u - cu; if (du > 0.5) du -= 1; if (du < -0.5) du += 1;
        const w = gauss(du, winR) * gauss(v - 0.33, 0.105) * 20 * punch;
        rr += w * 0.80; gg += w * 0.88; bb += w * 1.00;
      }
      // the furnace mouth: the one warm source, and much smaller than it feels
      {
        let du = u - 0.60; if (du > 0.5) du -= 1; if (du < -0.5) du += 1;
        const w = gauss(du, 0.055) * gauss(v - 0.56, 0.075) * 7.5 * punch;
        rr += w * 1.00; gg += w * 0.50; bb += w * 0.18;
      }
      const i4 = (y * W + x) * 4;
      data[i4] = rr; data[i4 + 1] = gg; data[i4 + 2] = bb; data[i4 + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function buildEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // The room's ambient bounce and the mirror image the bronze sees are two
  // different jobs.  Letting the windows drive the ambient washes every
  // surface flat; the directional key already represents that daylight.
  const soft = paintRadiance(0.05, 0.075);   // ambient bounce only
  const hot = paintRadiance(1.0, 0.020);     // sharp bands for the bell to catch
  const rtRoom = pmrem.fromEquirectangular(soft);
  const rtMetal = pmrem.fromEquirectangular(hot);
  soft.dispose(); hot.dispose(); pmrem.dispose();

  ENV.room = rtRoom.texture;
  ENV.metal = rtMetal.texture;
  return ENV.room;
}

/* ------------------------------------------------------------------ *
 *  materials                                                          *
 * ------------------------------------------------------------------ */

export function clayCoreMaterial() {
  return new THREE.MeshStandardMaterial({
    map: TEX.clayCore, normalMap: TEX.clayCoreN, normalScale: new THREE.Vector2(0.75, 0.75),
    color: 0xffffff, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.14,
  });
}

export function clayFalseMaterial() {
  return new THREE.MeshStandardMaterial({
    map: TEX.clayFalse, normalMap: TEX.clayFalseN, normalScale: new THREE.Vector2(0.65, 0.65),
    color: 0xffffff, roughness: 0.97, metalness: 0.0, envMapIntensity: 0.16,
  });
}

/**
 * Outer mould.  `aCover` (0..1) is compared against a speckle field and
 * discarded below it, so the mud appears as growing daubs rather than a
 * ghostly fading shell -- and it needs no alpha sorting.
 */
export function moldMaterial() {
  const m = new THREE.MeshStandardMaterial({
    map: TEX.moldEarth, normalMap: TEX.moldEarthN, normalScale: new THREE.Vector2(1.15, 1.15),
    color: 0xc2a98c, roughness: 1.0, metalness: 0.0,
    envMapIntensity: 0.30, side: THREE.DoubleSide, alphaTest: 0.001,
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
        totalEmissiveRadiance += uHotCol * uGlow * ( below * (0.05 + 0.34 * seep) + band * 1.30 );
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
    // Metal is pure reflection, so it must see the bright map, not the tame
    // one used to light the room.  Without this the bell can never be lighter
    // than the wall behind it.
    envMap: ENV.metal,
    envMapIntensity: 1.0,
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
        vec3 hot = mix(uHot, vec3(1.0, 0.94, 0.80), smoothstep(0.98, 1.42, local));
        totalEmissiveRadiance = hot * pow(clamp(local,0.0,1.4), 1.7) * 2.1;
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
