/* =========================================================
   loaf3d.js — バゲットの実ジオメトリ
   ------------------------------------------------------
   クープは「絵」ではなく、頂点の変位そのもの。
   ・生地表面を (軸方向 x[m], 表面の周方向 arc[m]) に展開して切れ目を持つ
   ・焼成が進むと、切れ目の縁が実際に回転して持ち上がる（＝耳）
     → 自己遮蔽し、影を落とし、視差で動く
   ・谷底は内側なのでクラム（中身）のマテリアルに切り替わる
   単位はすべてメートル。バゲット全長0.60m、直径0.06m。
   ========================================================= */
import * as THREE from 'three';
import { crustMaps } from './textures.js';

export const LOAF_TYPES = {
  /* len = 全長[m], rad = 焼く前の半径[m] */
  normal: { len: 0.60, rad: 0.0295, cuts: 4 },
  petite: { len: 0.40, rad: 0.0215, cuts: 3 },
  batard: { len: 0.33, rad: 0.0450, cuts: 3 },
  free: { len: 0.60, rad: 0.0310, cuts: 5 },
};

const IDEAL_ANGLE = 0.36;
const CORRECT_ANGLE = 0.78;
const CORRECT_ANGLE_FREE = 0.20;
const MIN_ANGLE = 0.27;
const MAX_ANGLE = 0.82;
const MAX_PHI = 1.00;          /* 耳が起き上がる最大角（約57度） */

const NU = 208;                /* 軸方向の分割 */
const NV = 144;                /* 周方向の分割（耳の稜線を解像するのに要る） */

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* 焼き色（実際のバゲットの色を追った ramp） */
const CRUST_RAMP = [
  [0.00, 0xEDE2CB], [0.16, 0xEADCBC], [0.32, 0xE6D2A4],
  [0.48, 0xDCBB7C], [0.63, 0xCE9F55], [0.79, 0xB9813C], [1.00, 0x9E6529],
];
const CRUMB_RAMP = [
  [0.00, 0xF4ECDB], [0.35, 0xF2E7CD], [0.62, 0xEEDDB4],
  [0.85, 0xE8D0A0], [1.00, 0xE2C48E],
];
function sampleRamp(ramp, t) {
  t = clamp(t, 0, 1);
  for (let i = 0; i < ramp.length - 1; i++) {
    const [p0, c0] = ramp[i], [p1, c1] = ramp[i + 1];
    if (t >= p0 && t <= p1) {
      const k = (t - p0) / (p1 - p0);
      const r = lerp((c0 >> 16) & 255, (c1 >> 16) & 255, k);
      const g = lerp((c0 >> 8) & 255, (c1 >> 8) & 255, k);
      const b = lerp(c0 & 255, c1 & 255, k);
      return [r / 255, g / 255, b / 255];
    }
  }
  const c = ramp[ramp.length - 1][1];
  return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
}

function springCurve(b) {
  return smooth(range(b, 0.04, 0.52)) * 0.78 + range(b, 0.45, 1.0) * 0.22;
}

/* =========================================================
   マテリアル：MeshStandard を拡張し、クラム／打ち粉／焼き色を
   頂点属性とユニフォームで混ぜる
   ========================================================= */
function makeCrustMaterial() {
  const maps = crustMaps();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0.0,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.72, 0.72),
  });
  mat.userData.uniforms = {
    uCrust: { value: new THREE.Color(0.93, 0.89, 0.80) },
    uCrumb: { value: new THREE.Color(0.95, 0.91, 0.84) },
    uBake: { value: 0 },
    uFlour: { value: 1.0 },
    uDetail: { value: maps.detail },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aCrumb;
        attribute float aAO;
        varying float vCrumb;
        varying float vAO;
        varying vec2 vDetailUv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vCrumb = aCrumb;
        vAO = aAO;
        vDetailUv = uv;`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uCrust;
        uniform vec3 uCrumb;
        uniform float uBake;
        uniform float uFlour;
        uniform sampler2D uDetail;
        varying float vCrumb;
        varying float vAO;
        varying vec2 vDetailUv;`)
      .replace('#include <map_fragment>', `
        vec4 det = texture2D(uDetail, vDetailUv * vec2(4.2, 1.5));
        float shade = det.r;              // 焼きムラ
        float flourMask = det.g;          // 打ち粉
        float pore = det.b;               // 気孔
        vec3 crust = uCrust;
        // 焼きムラ：焼けるほど濃淡が出る
        crust *= mix(1.0, 0.70 + shade * 0.62, 0.25 + 0.75 * uBake);
        // 気孔の影
        crust *= 1.0 - pore * 0.20 * (0.3 + 0.7 * uBake);
        // クラム（切れ目の内側）
        vec3 base = mix(crust, uCrumb, vCrumb);
        // 打ち粉は皮の上にだけ残る（クラムには乗らない）
        float fl = flourMask * uFlour * (1.0 - vCrumb) * 0.55;
        base = mix(base, vec3(0.96, 0.945, 0.90), fl);
        // 割れ目の中の遮蔽
        base *= vAO;
        diffuseColor.rgb *= base;
      `)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        roughnessFactor = mix(roughnessFactor - 0.22 * uBake, 0.94, vCrumb);
        roughnessFactor += pore * 0.10;
        roughnessFactor = clamp(roughnessFactor, 0.16, 1.0);
      `);
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => 'crust-v1';
  return mat;
}

/* =========================================================
   Loaf3D
   ========================================================= */
export class Loaf3D {
  constructor(typeKey = 'normal', seed, opts = {}) {
    this.opts = opts;
    this.typeKey = LOAF_TYPES[typeKey] ? typeKey : 'normal';
    this.spec = LOAF_TYPES[this.typeKey];
    this.seed = seed === undefined ? (Math.random() * 1e9) | 0 : seed;
    const rnd = mulberry(this.seed);
    this.rnd = rnd;

    this.press = 0; this.roll = 0; this.stretch = 0;
    this.proof = 0; this.bake = 0; this.cool = 0;
    this.scores = [];
    this.lean = -1;

    /* 個体差（手で作ったものは左右対称でない） */
    this.wob = [];
    for (let i = 0; i < 10; i++) this.wob.push(rnd() * 2 - 1);

    this._buildGeometry();
    this.material = makeCrustMaterial();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.userData.loaf = this;

    this._tmpPos = new Float32Array(this.vertCount * 3);
    this.rebuild();
  }

  _buildGeometry() {
    const nu = this.opts.nu || NU, nv = this.opts.nv || NV;
    const cols = nv + 1;               /* 継ぎ目を複製してUVを連続に */
    const verts = (nu + 1) * cols;
    this.vertCount = verts;
    this.nu = nu; this.nv = nv; this.cols = cols;

    const pos = new Float32Array(verts * 3);
    const nor = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const crumb = new Float32Array(verts);
    const ao = new Float32Array(verts);
    ao.fill(1);

    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j < cols; j++) {
        const k = i * cols + j;
        uv[k * 2] = i / nu;
        uv[k * 2 + 1] = j / nv;
      }
    }

    const idx = [];
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = i * cols + j;
        const b = a + cols;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aCrumb', new THREE.BufferAttribute(crumb, 1));
    g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.5);
    this.geometry = g;
  }

  /* ---- 現在の寸法（メートル） ---- */
  dims() {
    const sp = this.spec;
    /* 生地玉 → つぶす → 巻く → 伸ばす */
    let hl = lerp(0.050, 0.072, this.press);
    let R = lerp(0.050, 0.038, this.press);
    hl = lerp(hl, 0.100, this.roll);
    R = lerp(R, 0.0335, this.roll);
    hl = lerp(hl, sp.len * 0.5, this.stretch);
    R = lerp(R, sp.rad, this.stretch);

    R *= 1 + 0.13 * this.proof;
    hl *= 1 + 0.02 * this.proof;

    const s = springCurve(this.bake);
    R *= 1 + 0.22 * s;
    hl *= 1 + 0.045 * s;
    R *= 1 - 0.02 * this.cool;

    const logness = smooth(Math.max(this.roll, this.stretch));
    return { hl, R, logness };
  }

  /* 軸方向の太さプロファイル t∈[-1,1] */
  _prof(t, logness) {
    const at = Math.min(1, Math.abs(t));
    const circle = Math.sqrt(Math.max(0, 1 - at * at));
    const bag = Math.pow(Math.max(0, 1 - Math.pow(at, 5.0)), 0.28);
    return lerp(circle, bag, logness);
  }

  /* 断面の半径倍率（下がわずかに平ら＝台や布に接している） */
  _sect(theta) {
    const c = Math.cos(theta);
    const flat = Math.max(0, -c);
    return (1 + 0.035 * Math.cos(2 * theta)) * (1 - 0.085 * flat * flat);
  }

  /* =========================================================
     クープの追加
     入力は「表面の展開座標」: sx = 軸方向[m], sy = 頂点からの弧長[m]
     ========================================================= */
  addScore(sx0, sy0, sx1, sy1, durSec, freeMode) {
    const d = this.dims();
    const max = freeMode ? 8 : 5;
    if (this.scores.length >= max) return null;

    let dx = sx1 - sx0, dy = sy1 - sy0;
    let rawLen = Math.hypot(dx, dy);
    if (rawLen < 1e-5) { dx = 1; dy = 0; rawLen = 1e-5; }

    let a = Math.atan2(dy, dx);
    if (a > Math.PI / 2) a -= Math.PI;
    if (a < -Math.PI / 2) a += Math.PI;

    if (this.scores.length === 0) this.lean = a > 0.06 ? 1 : -1;
    const target = this.lean * IDEAL_ANGLE;

    let ang;
    if (freeMode) {
      ang = lerp(a, target, CORRECT_ANGLE_FREE);
      const sg = Math.sign(ang) || 1;
      ang = sg * clamp(Math.abs(ang), 0.12, 1.30);
    } else {
      let aFold = a;
      if (Math.abs(a) > 0.05 && Math.sign(a) !== this.lean) aFold = -a;
      ang = lerp(aFold, target, CORRECT_ANGLE);
      ang = this.lean * clamp(Math.abs(ang), MIN_ANGLE, MAX_ANGLE);
    }

    const mx = (sx0 + sx1) * 0.5, my = (sy0 + sy1) * 0.5;
    let t = clamp((mx / d.hl + 1) * 0.5, 0.11, 0.89);
    /* 横のずれは頂点へ強く吸着（弧長で ±0.35R まで） */
    let off = clamp(my * (freeMode ? 0.55 : 0.28), -d.R * 0.5, d.R * 0.5);

    for (let i = 0; i < this.scores.length; i++) {
      const dt = t - this.scores[i].t;
      if (Math.abs(dt) < 0.075) {
        t = clamp(this.scores[i].t + (dt >= 0 ? 0.075 : -0.075), 0.11, 0.89);
      }
    }

    const lr = rawLen / Math.max(1e-4, d.hl);
    let len = clamp((lr - 0.12) / (0.60 - 0.12), 0, 1);

    const pace = (durSec || 0.3) / Math.max(0.06, lr);
    const depth = clamp(0.66 + 0.30 * pace, 0.62, 1.32);

    /* 生地からはみ出すときは角度でなく長さを詰める */
    const maxPerp = d.R * 0.78;
    const maxHalf = maxPerp / Math.max(0.18, Math.abs(Math.sin(ang)));
    const wantHalf = lerp(0.14, 0.30, len) * d.hl;
    if (wantHalf > maxHalf) len = clamp((maxHalf / d.hl - 0.14) / 0.16, 0, 1);

    const sc = {
      t, off, angle: ang, len, depth,
      openStart: 0.13 + this.scores.length * 0.052,
      seed: (this.rnd() * 1e6) | 0,
      popped: false,
      settle: 0,
      raw: { t: clamp((mx / d.hl + 1) * 0.5, 0.02, 0.98), off: clamp(my, -d.R, d.R), angle: a, half: rawLen * 0.5 },
    };
    this.scores.push(sc);
    return sc;
  }

  scoreOpen(s) {
    const b = this.bake;
    if (b <= 0.001) return 0;
    let op = easeOut(range(b, s.openStart, s.openStart + 0.40));
    op = op * 0.82 + smooth(range(b, 0.46, 1.0)) * 0.18;
    return clamp(op, 0, 1);
  }

  consumePops() {
    const out = [];
    for (const s of this.scores) {
      if (!s.popped && this.scoreOpen(s) > 0.16) { s.popped = true; out.push(s); }
    }
    return out;
  }

  update(dt) {
    let moving = false;
    for (const s of this.scores) {
      if (s.settle < 1) { s.settle = Math.min(1, s.settle + dt * 5); moving = true; }
    }
    return moving;
  }

  /* クープ1本の現在の幾何（settle 補間つき） */
  _geomOf(s, d) {
    const st = smooth(s.settle);
    const t = lerp(s.raw.t, s.t, st);
    const off = lerp(s.raw.off, s.off, st);
    const ang = lerp(s.raw.angle, s.angle, st);
    const half = lerp(Math.max(0.008, s.raw.half), lerp(0.14, 0.30, s.len) * d.hl, st);
    return { cx: (t * 2 - 1) * d.hl, cy: off, ang, half };
  }

  /* 表面座標（弧長）→ ワールド前の局所座標。レイキャスト結果から使う */
  surfaceFromLocal(p) {
    const d = this.dims();
    const theta = Math.atan2(p.z, p.y);
    return { sx: p.x, sy: theta * d.R };
  }

  /* =========================================================
     頂点の再計算（ここが本体）
     ========================================================= */
  rebuild() {
    const d = this.dims();
    const nu = this.nu, nv = this.nv, cols = this.cols;
    const pos = this.geometry.attributes.position.array;
    const nor = this.geometry.attributes.normal.array;
    const crumbA = this.geometry.attributes.aCrumb.array;
    const aoA = this.geometry.attributes.aAO.array;

    /* クープごとの前計算 */
    const cs = [];
    for (const s of this.scores) {
      const g = this._geomOf(s, d);
      const op = this.scoreOpen(s);
      const dep = s.depth;
      /* 実際のバゲットの寸法感：直径6cmに対して
         開いた切れ目の幅 15〜18mm、深さ 12〜15mm、耳の張り出し 8〜11mm。
         ここを大きくしすぎると「うねり」に見えて切れ目に見えなくなる。 */
      const gh = d.R * (0.058 + 0.205 * op * dep);         /* 谷の半幅 */
      const cut = d.R * (0.150 + 0.310 * op) * dep;        /* 谷の深さ */
      const earW = d.R * (0.150 + 0.195 * op) * dep;       /* 耳の帯幅 */
      const lipW = d.R * (0.100 + 0.080 * op) * dep;
      const phi = MAX_PHI * op * dep;
      const lift = earW * Math.sin(phi) * 0.92;
      const rnd = mulberry(s.seed);
      const jag = [];
      for (let i = 0; i < 9; i++) jag.push(rnd() * 2 - 1);

      /* 断面の制御点 (弧長方向の位置, 半径方向の変位)。
         耳が起き上がり、先が谷の上にわずかにかぶさる形を、
         「面の折り返し」として素直に表す。段差を作らないので
         メッシュにギザギザが出ない。 */
      /* 断面の制御点（弧長方向の位置, 半径方向の変位）。
         急な壁を作るとメッシュが荒れるので、耳の稜線から谷底まで
         じゅうぶんな幅をとって 落とように配る。 */
      const prof2 = [
        [-(gh + earW), 0],
        [-(gh + earW * 0.80), lift * 0.16],
        [-(gh + earW * 0.58), lift * 0.42],
        [-(gh + earW * 0.36), lift * 0.70],
        [-(gh + earW * 0.16), lift * 0.90],
        [-(gh + earW * 0.02), lift * 0.98],
        [-gh * 0.86, lift * 0.72],
        [-gh * 0.64, lift * 0.28],
        [-gh * 0.44, -cut * 0.24],
        [-gh * 0.20, -cut * 0.68],
        [gh * 0.12, -cut * 0.96],
        [gh * 0.56, -cut * 0.70],
        [gh * 0.90, -cut * 0.20],
        [gh + lipW * 0.45, lift * 0.16 + d.R * 0.010],
        [gh + lipW, 0],
      ];
      cs.push({
        cx: g.cx, cy: g.cy, half: g.half,
        ca: Math.cos(g.ang), sa: Math.sin(g.ang),
        gh, cut, earW, lipW, phi, op, prof: prof2,
        b0: prof2[0][0], b1: prof2[prof2.length - 1][0], nseg: prof2.length - 1,
        outer: gh + earW + 0.004,
        jag,
      });
    }

    const logness = d.logness;
    const invR = 1 / Math.max(1e-4, d.R);

    for (let i = 0; i <= nu; i++) {
      const t = -1 + (2 * i) / nu;
      const tt = Math.sign(t) * Math.pow(Math.abs(t), 0.86);   /* 端を密に */
      const x0 = tt * d.hl;
      const prof = this._prof(tt, logness);
      /* 手作りらしい太さのゆらぎ */
      const wi = (tt + 1) * 4;
      const w0 = this.wob[Math.floor(wi) % 10], w1 = this.wob[(Math.floor(wi) + 1) % 10];
      const wob = 1 + lerp(w0, w1, smooth(wi - Math.floor(wi))) * 0.030;
      const baseR = d.R * prof * wob;

      for (let j = 0; j < cols; j++) {
        const th = ((j / nv) - 0.5) * Math.PI * 2;
        let r = baseR * this._sect(th);
        const arc = th * d.R;

        let dr = 0, darc = 0, dax = 0, crumb = 0, ao = 1;

        for (let c = 0; c < cs.length; c++) {
          const S = cs[c];
          const ex = x0 - S.cx, ey = arc - S.cy;
          /* 影響範囲の早期棄却 */
          if (Math.abs(ex) > S.half + S.outer + 0.02) continue;
          const a = ex * S.ca + ey * S.sa;
          if (Math.abs(a) > S.half) continue;
          const b = -ex * S.sa + ey * S.ca;
          if (Math.abs(b) > S.outer + S.lipW) continue;

          const an = a / S.half;
          /* 手切りらしいゆらぎ。段差にならないよう補間する */
          const jf = (an + 1) * 4;
          const ji = Math.floor(jf);
          const jt = jf - ji;
          const j0 = S.jag[((ji % 9) + 9) % 9], j1 = S.jag[(((ji + 1) % 9) + 9) % 9];
          const jn = j0 + (j1 - j0) * (jt * jt * (3 - 2 * jt));
          const f = Math.pow(Math.max(0, 1 - an * an), 0.55) * (1 + jn * 0.055);
          if (f <= 0.001) continue;

          const gh = S.gh * (1 + jn * 0.07);

          /* 断面曲線上の位置へ写す（元の b から一意に決まる） */
          const bb0 = S.b0 * (1 + jn * 0.05), bb1 = S.b1 * (1 + jn * 0.05);
          if (b < bb0 || b > bb1) continue;
          const uu = (b - bb0) / (bb1 - bb0);
          const fi = uu * S.nseg;
          let i0 = Math.floor(fi);
          if (i0 > S.nseg - 1) i0 = S.nseg - 1; if (i0 < 0) i0 = 0;
          const tt2 = fi - i0;
          const ww = tt2 * tt2 * (3 - 2 * tt2);
          const pA = S.prof[i0], pB = S.prof[i0 + 1];
          const bT = pA[0] + (pB[0] - pA[0]) * ww;
          const rT = pA[1] + (pB[1] - pA[1]) * ww;

          darc += (bT - b) * f;
          dr += rT * f;

          /* 割れ目の内側（クラム）と、そこに落ちる影 */
          const inGap = smoothstep(0.48, 0.58, uu) * (1 - smoothstep(0.80, 0.90, uu));
          const cm = f * inGap;
          if (cm > crumb) crumb = cm;
          ao = Math.min(ao, 1 - (0.52 * cm + 0.28 * f * smoothstep(0.38, 0.50, uu) * (1 - smoothstep(0.58, 0.74, uu))) * (0.35 + 0.65 * S.op));
        }

        /* 展開座標の変位を 3D へ戻す */
        const th2 = th + darc * invR;
        const rr = Math.max(0.0006, r + dr);
        const k = i * cols + j;
        pos[k * 3] = x0 + dax;
        pos[k * 3 + 1] = rr * Math.cos(th2);
        pos[k * 3 + 2] = rr * Math.sin(th2);
        crumbA[k] = crumb;
        aoA[k] = ao;
      }
    }

    /* 法線は面から積み上げて求める。
       格子の中央差分だと、切れ目の急な壁を斜めに横切るところで
       法線が振動して櫛状のノイズが出るため。 */
    this.geometry.computeVertexNormals();

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aCrumb.needsUpdate = true;
    this.geometry.attributes.aAO.needsUpdate = true;
    this.geometry.boundingSphere.radius = d.hl * 1.15 + d.R * 2;

    /* 色 */
    const u = this.material.userData.uniforms;
    const cr = sampleRamp(CRUST_RAMP, this.bake);
    const cm = sampleRamp(CRUMB_RAMP, this.bake);
    u.uCrust.value.setRGB(cr[0], cr[1], cr[2], THREE.SRGBColorSpace);
    u.uCrumb.value.setRGB(cm[0], cm[1], cm[2], THREE.SRGBColorSpace);
    u.uBake.value = this.bake;
    u.uFlour.value = lerp(1.0, 0.38, smooth(this.bake));
    this.material.roughness = lerp(0.90, 0.62, smooth(this.bake));
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
