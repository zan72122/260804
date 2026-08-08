/**
 * materials.js
 * ヒーローマテリアル（溶銑・耐火物・閉塞材・機械金属）を
 * 外部アセットなしで手続き的に生成する。
 * 目的は「本物の再現」ではなく「見た瞬間に材質差が分かること」。
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* noise                                                               */
/* ------------------------------------------------------------------ */
function prng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function valueNoise(seed, g = 64) {
  const rnd = prng(seed);
  const grid = new Float32Array(g * g);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const at = (x, y) => grid[(((y % g) + g) % g) * g + (((x % g) + g) % g)];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = sm(x - xi), v = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
}
function fbm(seed, oct = 4) {
  const n = valueNoise(seed);
  return (x, y) => {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); f *= 2; a *= 0.5; }
    return s;
  };
}

/* ------------------------------------------------------------------ */
/* texture bakery                                                      */
/* ------------------------------------------------------------------ */
function finish(tex, srgb, repeat) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.needsUpdate = true;
  return tex;
}

/** shade(u,v) -> [r,g,b,height(0..1),rough(0..1)] */
function bake(size, shade) {
  const col = new Uint8Array(size * size * 4);
  const rgh = new Uint8Array(size * size * 4);
  const hgt = new Float32Array(size * size);
  const o = [0, 0, 0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      shade(x / size, y / size, o);
      col[i * 4] = o[0] * 255; col[i * 4 + 1] = o[1] * 255; col[i * 4 + 2] = o[2] * 255; col[i * 4 + 3] = 255;
      hgt[i] = o[3];
      const r = o[4] * 255;
      rgh[i * 4] = r; rgh[i * 4 + 1] = r; rgh[i * 4 + 2] = r; rgh[i * 4 + 3] = 255;
    }
  }
  return {
    map: finish(new THREE.DataTexture(col, size, size, THREE.RGBAFormat), true),
    roughnessMap: finish(new THREE.DataTexture(rgh, size, size, THREE.RGBAFormat), false),
    height: hgt, size,
  };
}

function normalMapFrom(height, size, strength) {
  const d = new Uint8Array(size * size * 4);
  const H = (x, y) => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const i = (y * size + x) * 4;
      d[i] = (nx * .5 + .5) * 255; d[i + 1] = (ny * .5 + .5) * 255; d[i + 2] = (nz * .5 + .5) * 255; d[i + 3] = 255;
    }
  }
  return finish(new THREE.DataTexture(d, size, size, THREE.RGBAFormat), false);
}

/* ------------------------------------------------------------------ */
/* 1. 耐火物（黒〜褐色・ざらつき・熱と重さのある壁）                    */
/* ------------------------------------------------------------------ */
function refractoryTextures(size = 256) {
  const n = fbm(1337, 4), grit = fbm(99, 3), soot = fbm(4242, 3);
  const COLS = 7, ROWS = 12;
  const b = bake(size, (u, v, o) => {
    const row = Math.floor(v * ROWS);
    const offset = (row % 2) * 0.5;
    const bx = (u * COLS + offset) % 1;
    const by = (v * ROWS) % 1;
    const m = 0.055;                                    // 目地
    const inBrick = bx > m && bx < 1 - m && by > m * 1.9 && by < 1 - m * 1.9;
    const brickId = (Math.floor(u * COLS + offset) * 31 + row * 17) % 13 / 13;
    const g = grit(u * 42, v * 42);
    const s = n(u * 9, v * 9);
    // 焼けた耐火煉瓦：暗褐色〜黒、上に行くほど煤けている
    let base = 0.115 + brickId * 0.075 + s * 0.09;
    let r = base * 1.00, gg = base * 0.72, bb = base * 0.55;
    const sk = soot(u * 5, v * 5);
    const sootAmt = THREE.MathUtils.clamp(sk * 1.15 - 0.28 + (1 - v) * 0.22, 0, 1);
    r = THREE.MathUtils.lerp(r, 0.055, sootAmt * .72);
    gg = THREE.MathUtils.lerp(gg, 0.048, sootAmt * .72);
    bb = THREE.MathUtils.lerp(bb, 0.046, sootAmt * .72);
    let h = inBrick ? 0.62 + g * 0.30 + s * 0.08 : 0.10 + g * 0.12;
    if (!inBrick) { r *= .48; gg *= .48; bb *= .5; }
    // ざらついた粒子の白っぽいきらめきをほんの少し
    const sp = g > 0.86 ? (g - 0.86) * 2.2 : 0;
    r += sp * .28; gg += sp * .24; bb += sp * .2;
    o[0] = r; o[1] = gg; o[2] = bb; o[3] = h;
    o[4] = 0.80 + g * 0.20 - sp * 0.25;                  // 全体にザラザラ
  });
  return { map: b.map, roughnessMap: b.roughnessMap, normalMap: normalMapFrom(b.height, b.size, 2.6) };
}

/* ------------------------------------------------------------------ */
/* 2. tap-hole clay（閉塞材：土・粘土・重い）                           */
/* ------------------------------------------------------------------ */
function clayTextures(size = 128) {
  const lump = fbm(777, 4), fine = fbm(21, 3);
  const b = bake(size, (u, v, o) => {
    const L = lump(u * 6, v * 6);
    const F = fine(u * 30, v * 30);
    const h = L * 0.75 + F * 0.25;
    // しっとりした土／耐火粘土：黄土〜赤褐
    const t = h;
    o[0] = 0.30 + t * 0.30;
    o[1] = 0.185 + t * 0.20;
    o[2] = 0.095 + t * 0.10;
    // 小石のような濃い点
    if (F > 0.80) { o[0] *= .68; o[1] *= .66; o[2] *= .70; }
    o[3] = h;
    o[4] = 0.93 + (1 - F) * 0.06;                        // ほぼ完全につや消し＝溶銑の真逆
  });
  return { map: b.map, roughnessMap: b.roughnessMap, normalMap: normalMapFrom(b.height, b.size, 3.4) };
}

/* ------------------------------------------------------------------ */
/* 3. 機械（重量感のある塗装鋼＋油汚れ）                                */
/* ------------------------------------------------------------------ */
function machineTextures(size = 128) {
  const grime = fbm(5150, 4), scratch = fbm(6161, 3);
  const b = bake(size, (u, v, o) => {
    const g = grime(u * 7, v * 7);
    const s = scratch(u * 40, v * 3);
    const dirt = THREE.MathUtils.clamp(g * 1.25 - 0.60, 0, 1);
    o[0] = 1 - dirt * 0.30; o[1] = 1 - dirt * 0.32; o[2] = 1 - dirt * 0.35;  // map は塗装色に乗算される汚れ
    o[3] = 0.5 + s * 0.5;
    o[4] = 0.26 + dirt * 0.42 + s * 0.08;                // 汚れたところだけ荒れる
  });
  return { map: b.map, roughnessMap: b.roughnessMap, normalMap: normalMapFrom(b.height, b.size, 0.9) };
}

/* ------------------------------------------------------------------ */
/* 4. 鋳床の床                                                          */
/* ------------------------------------------------------------------ */
function floorTextures(size = 256) {
  const sand = fbm(303, 4), patch = fbm(88, 3);
  const b = bake(size, (u, v, o) => {
    const s = sand(u * 26, v * 26);
    const p = patch(u * 4, v * 4);
    let base = 0.16 + s * 0.13 + p * 0.06;
    o[0] = base * 1.02; o[1] = base * 0.93; o[2] = base * 0.84;
    if (p > 0.66) { o[0] *= .62; o[1] *= .60; o[2] *= .60; }   // 焼けた跡
    o[3] = s;
    o[4] = 0.88 + s * 0.12;
  });
  return { map: b.map, roughnessMap: b.roughnessMap, normalMap: normalMapFrom(b.height, b.size, 1.5) };
}

/* ------------------------------------------------------------------ */
/* 環境マップ（金属の映り込み用。下から溶銑の熱、上から工場の冷たい光） */
/* ------------------------------------------------------------------ */
export function buildEnvironment(renderer) {
  const W = 64, H = 32;
  const data = new Float32Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);                      // 0=上, 1=下
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      let r, g, b;
      if (v < 0.5) {                            // 天井側：冷たい鉄骨と天窓
        const t = v / 0.5;
        r = THREE.MathUtils.lerp(0.10, 0.24, t);
        g = THREE.MathUtils.lerp(0.13, 0.25, t);
        b = THREE.MathUtils.lerp(0.20, 0.29, t);
        const sky = Math.max(0, 1 - Math.abs(v - 0.10) * 9) * Math.max(0, 1 - Math.abs(((u + .5) % 1) - .5) * 3);
        r += sky * 1.5; g += sky * 1.7; b += sky * 2.0;
      } else {                                  // 床側：溶銑の照り返し
        const t = (v - 0.5) / 0.5;
        r = THREE.MathUtils.lerp(0.26, 0.85, t);
        g = THREE.MathUtils.lerp(0.19, 0.30, t);
        b = THREE.MathUtils.lerp(0.14, 0.10, t);
      }
      // 出銑口方向の強い熱源
      const hot = Math.max(0, 1 - Math.hypot((u - 0.5) * 2.4, (v - 0.62) * 3.6)) ** 2;
      r += hot * 3.2; g += hot * 1.15; b += hot * 0.25;
      const i = (y * W + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 1;
    }
  }
  const eq = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  eq.mapping = THREE.EquirectangularReflectionMapping;
  eq.magFilter = THREE.LinearFilter; eq.minFilter = THREE.LinearFilter;
  eq.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(eq).texture;
  pmrem.dispose(); eq.dispose();
  return env;
}

/* ------------------------------------------------------------------ */
/* 溶銑シェーダ（帯／管の両方で使う）                                    */
/* ------------------------------------------------------------------ */
const MOLTEN_VERT = /* glsl */`
  varying vec2 vUv;
  varying float vFres;
  void main(){
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position,1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFres = pow(1.0 - abs(dot(n, normalize(-mv.xyz))), 2.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const MOLTEN_FRAG = /* glsl */`
  precision mediump float;
  uniform float uTime, uSpeed, uScaleU, uScaleV, uSkin, uGlow;
  uniform float uFill, uTail, uAlpha, uLateral;
  uniform vec3  uHot, uMid, uCool;
  varying vec2 vUv;
  varying float vFres;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
  float vnoise(vec2 p){
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm3(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5;} return s; }

  void main(){
    float flow = vUv.y * uScaleV - uTime * uSpeed;
    vec2 q = vec2(vUv.x * uScaleU, flow);
    float n  = fbm3(q);
    float n2 = fbm3(q * 2.7 + vec2(3.1, -uTime * uSpeed * 0.55));

    // 帯（樋）は中央ほど熱く、管（噴流）は正面ほど熱い
    float lat = clamp(1.0 - abs(vUv.x - 0.5) * 2.0, 0.0, 1.0);
    float centre = mix(1.0 - vFres, lat, uLateral);
    centre = clamp(centre, 0.0, 1.0);

    float heat = pow(centre, 0.8) * (0.70 + n * 0.60);
    vec3 col = mix(uMid, uHot, clamp(heat, 0.0, 1.0));

    // 表面に張る“皮”（冷えた酸化膜）— 溶銑らしさの要
    float skin = smoothstep(0.50, 0.88, n2 * 0.72 + (1.0 - centre) * 0.62) * uSkin;
    col = mix(col, uCool, skin);
    col += uHot * pow(centre, 6.0) * 0.85 * uGlow;         // 白熱コア
    col *= (0.86 + n * 0.46);

    // 流れの先頭／末尾（樋を進む・引いていく）
    float a = uAlpha;
    a *= smoothstep(uFill, uFill - 0.055, vUv.y);
    a *= smoothstep(uTail, uTail + 0.055, vUv.y);
    a *= mix(1.0, smoothstep(0.0, 0.13, lat), uLateral);   // 帯の横端をなじませる
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }
`;

export function makeMoltenMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: opts.speed ?? 1.4 },
      uScaleU: { value: opts.scaleU ?? 3.0 },
      uScaleV: { value: opts.scaleV ?? 7.0 },
      uSkin: { value: opts.skin ?? 0.55 },
      uGlow: { value: opts.glow ?? 1.0 },
      uFill: { value: 1 },
      uTail: { value: 0 },
      uAlpha: { value: 1 },
      uLateral: { value: opts.lateral ?? 1 },
      uHot: { value: new THREE.Color(opts.hot ?? 0xfff0b0).multiplyScalar(opts.hotMul ?? 2.6) },
      uMid: { value: new THREE.Color(opts.mid ?? 0xff7a12).multiplyScalar(opts.midMul ?? 1.9) },
      uCool: { value: new THREE.Color(opts.cool ?? 0x8e2606).multiplyScalar(1.0) },
    },
    vertexShader: MOLTEN_VERT,
    fragmentShader: MOLTEN_FRAG,
    transparent: true,
    depthWrite: opts.depthWrite ?? true,
    toneMapped: false,                 // 白飛びさせて「熱い」を作る
    side: opts.side ?? THREE.DoubleSide,
  });
}

/* ------------------------------------------------------------------ */
/* 発光スプライト（安価な擬似ブルーム）                                  */
/* ------------------------------------------------------------------ */
export function glowTexture(size = 128, power = 2.2) {
  const d = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - c, y - c) / c;
    const a = Math.pow(Math.max(0, 1 - r), power);
    const i = (y * size + x) * 4;
    d[i] = 255; d[i + 1] = 205 * a + 60; d[i + 2] = 120 * a * a;
    d[i + 3] = a * 255;
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
export function puffTexture(size = 64) {
  const d = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - c, y - c) / c;
    const a = Math.pow(Math.max(0, 1 - r), 2.4);
    const i = (y * size + x) * 4;
    d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
    d[i + 3] = a * 210;
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
export function sparkTexture(size = 64) {
  const d = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x - c, y - c) / c;
    const a = Math.pow(Math.max(0, 1 - r), 1.6);
    const i = (y * size + x) * 4;
    d[i] = 255; d[i + 1] = 255 * (0.55 + 0.45 * a); d[i + 2] = 255 * a * a;
    d[i + 3] = a * 255;
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/* ------------------------------------------------------------------ */
/* まとめて生成                                                         */
/* ------------------------------------------------------------------ */
export function buildMaterials(quality = 'high') {
  const S = quality === 'low' ? 0.5 : 1;
  const refr = refractoryTextures(Math.round(256 * S));
  const clay = clayTextures(Math.round(128 * S));
  const mech = machineTextures(Math.round(128 * S));
  const flr = floorTextures(Math.round(256 * S));

  const refractory = (repeat = [1, 1], tint = 0xffffff) => {
    const m = new THREE.MeshStandardMaterial({
      color: tint, map: refr.map.clone(), normalMap: refr.normalMap.clone(),
      roughnessMap: refr.roughnessMap.clone(), roughness: 1.0, metalness: 0.05,
      normalScale: new THREE.Vector2(1.1, 1.1),
    });
    m.map.repeat.set(repeat[0], repeat[1]); m.map.needsUpdate = true;
    m.normalMap.repeat.set(repeat[0], repeat[1]); m.normalMap.needsUpdate = true;
    m.roughnessMap.repeat.set(repeat[0], repeat[1]); m.roughnessMap.needsUpdate = true;
    return m;
  };

  const clayMat = (repeat = [1, 1]) => {
    const m = new THREE.MeshStandardMaterial({
      color: 0xffcf9e, map: clay.map.clone(), normalMap: clay.normalMap.clone(),
      roughnessMap: clay.roughnessMap.clone(), roughness: 1.0, metalness: 0.0,
      normalScale: new THREE.Vector2(1.5, 1.5),
    });
    for (const k of ['map', 'normalMap', 'roughnessMap']) { m[k].repeat.set(repeat[0], repeat[1]); m[k].needsUpdate = true; }
    return m;
  };

  const metal = (color, { metalness = 0.9, roughness = 0.34, repeat = [2, 2] } = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color, map: mech.map.clone(), roughnessMap: mech.roughnessMap.clone(),
      normalMap: mech.normalMap.clone(), metalness, roughness,
      normalScale: new THREE.Vector2(0.28, 0.28),
    });
    for (const k of ['map', 'normalMap', 'roughnessMap']) { m[k].repeat.set(repeat[0], repeat[1]); m[k].needsUpdate = true; }
    return m;
  };

  const floor = (repeat = [14, 14]) => {
    const m = new THREE.MeshStandardMaterial({
      map: flr.map.clone(), normalMap: flr.normalMap.clone(), roughnessMap: flr.roughnessMap.clone(),
      roughness: 1, metalness: 0.02, normalScale: new THREE.Vector2(0.8, 0.8),
    });
    for (const k of ['map', 'normalMap', 'roughnessMap']) { m[k].repeat.set(repeat[0], repeat[1]); m[k].needsUpdate = true; }
    return m;
  };

  return { refractory, clay: clayMat, metal, floor, glowTex: glowTexture(), sparkTex: sparkTexture(), puffTex: puffTexture() };
}
