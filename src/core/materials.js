// 手続き的に作るテクスチャ群（外部画像を使わない）と、
// 「塗る / 磨く」状態を持つ木材用マテリアル。
import * as THREE from 'three';
import { mulberry32, clamp } from './util.js';

function cv(size = 512, h = size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h;
  return c;
}

/** 木目テクスチャ。年輪 + 節 + 繊維の細い線。 */
export function makeWoodTexture(def, seed = 7) {
  const S = 512;
  const c = cv(S, S);
  const g = c.getContext('2d');
  const rnd = mulberry32(seed + def.seed);
  const base = def.base, dark = def.grain;

  g.fillStyle = base;
  g.fillRect(0, 0, S, S);

  // 年輪：横方向に流れる帯
  const bands = 26 + Math.floor(rnd() * 10);
  for (let i = 0; i < bands; i++) {
    const y = (i / bands) * S + (rnd() - 0.5) * 10;
    const th = 1.5 + rnd() * 6 * def.grainWeight;
    const a = 0.10 + rnd() * 0.30 * def.grainWeight;
    g.strokeStyle = dark;
    g.globalAlpha = a;
    g.lineWidth = th;
    g.beginPath();
    const amp = 5 + rnd() * 16;
    const ph = rnd() * Math.PI * 2;
    for (let x = 0; x <= S; x += 8) {
      const yy = y + Math.sin((x / S) * Math.PI * (1 + rnd() * 0.02) * 2 + ph) * amp
        + Math.sin(x * 0.05 + ph * 2) * 2.2;
      x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
  // 細い繊維
  g.globalAlpha = 0.09;
  g.strokeStyle = dark;
  g.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const y = rnd() * S;
    const x0 = rnd() * S;
    const len = 30 + rnd() * 180;
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x0 + len, y + (rnd() - 0.5) * 4);
    g.stroke();
  }
  // 節
  const knots = def.knots ?? 2;
  for (let k = 0; k < knots; k++) {
    const kx = 60 + rnd() * (S - 120), ky = 60 + rnd() * (S - 120);
    const r = 10 + rnd() * 18;
    for (let i = 8; i >= 1; i--) {
      g.globalAlpha = 0.07 + (8 - i) * 0.03;
      g.strokeStyle = dark;
      g.lineWidth = 1.4;
      g.beginPath();
      g.ellipse(kx, ky, r * i * 0.34, r * i * 0.2, 0.4, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 0.5;
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(kx, ky, r * 0.3, r * 0.18, 0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 木材の凹凸（ラフネス）用。木目に沿った微細なムラ。 */
export function makeWoodRoughTexture(seed = 3) {
  const S = 256;
  const c = cv(S, S);
  const g = c.getContext('2d');
  const rnd = mulberry32(seed);
  g.fillStyle = '#b6b6b6';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const y = rnd() * S, x = rnd() * S;
    g.globalAlpha = 0.06 + rnd() * 0.1;
    g.fillStyle = rnd() > 0.5 ? '#ffffff' : '#8a8a8a';
    g.fillRect(x, y, 6 + rnd() * 60, 1 + rnd() * 2);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 巻き尺の目盛りテクスチャ（1マス = 10cm 相当のブロック） */
export function makeTapeTexture() {
  const W = 256, H = 64;
  const c = cv(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#ffe27a';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffd24a';
  g.fillRect(0, 0, W, 6);
  g.fillRect(0, H - 6, W, 6);
  // 目盛り
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * W;
    const big = i % 5 === 0;
    g.strokeStyle = big ? '#4a3520' : '#7a5a34';
    g.lineWidth = big ? 4 : 2;
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x, H - (big ? 30 : 16));
    g.stroke();
  }
  // 数字（読めなくても模様として楽しい）
  g.fillStyle = '#4a3520';
  g.font = 'bold 26px sans-serif';
  g.textAlign = 'center';
  g.fillText('1', W * 0.5, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 鉛筆の線（手描き風のかすれ） */
export function makePencilTexture() {
  const W = 64, H = 256;
  const c = cv(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const rnd = mulberry32(11);
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = `rgba(60,44,34,${0.5 - i * 0.07})`;
    g.lineWidth = 7 - i;
    g.beginPath();
    for (let y = 0; y <= H; y += 6) {
      const x = W / 2 + Math.sin(y * 0.08 + i) * 1.6 + (rnd() - 0.5) * 2.2;
      y === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 太い点線ガイド */
export function makeDashTexture(color = '#ffffff') {
  // 縦（V 方向）に伸びる太い点線
  const W = 32, H = 128;
  const c = cv(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = color;
  const r = W * 0.42;
  for (let i = 0; i < 2; i++) {
    const y = 32 + i * 64;
    g.beginPath();
    g.roundRect(W / 2 - r, y - 22, r * 2, 44, r);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** ざらざらした切断面（紙やすりで消していく層） */
export function makeRoughFaceTexture() {
  const S = 256;
  const c = cv(S, S);
  const g = c.getContext('2d');
  const rnd = mulberry32(23);
  g.fillStyle = '#c9a878';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * S, y = rnd() * S;
    g.fillStyle = rnd() > 0.5 ? 'rgba(120,86,52,0.5)' : 'rgba(238,214,180,0.5)';
    g.fillRect(x, y, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  // ささくれ
  g.strokeStyle = 'rgba(110,78,46,0.55)';
  for (let i = 0; i < 120; i++) {
    g.lineWidth = 0.6 + rnd() * 1.6;
    const x = rnd() * S, y = rnd() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 12);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 柔らかい丸（粒子・接地影・光のにじみ） */
export function makeSoftCircleTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 128;
  const c = cv(S, S);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.45, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 接地影用のぼけた楕円 */
export function makeShadowTexture() {
  return makeSoftCircleTexture('rgba(40,26,14,0.55)', 'rgba(40,26,14,0)');
}

/** 星・花・ハートなどの飾り（シールとエプロン柄に使う） */
export function makeDecalTexture(kind, color = '#ff8ec6') {
  const S = 128;
  const c = cv(S, S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  g.fillStyle = color;
  const star = (spikes, rO, rI) => {
    g.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? rO : rI;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath(); g.fill();
  };
  if (kind === 'star') {
    star(5, 54, 24);
  } else if (kind === 'flower') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.ellipse(Math.cos(a) * 26, Math.sin(a) * 26, 22, 15, a, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#fff3a8';
    g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill();
  } else if (kind === 'heart') {
    g.beginPath();
    g.moveTo(0, 40);
    g.bezierCurveTo(-62, -6, -28, -52, 0, -20);
    g.bezierCurveTo(28, -52, 62, -6, 0, 40);
    g.fill();
  } else if (kind === 'rainbow') {
    const cols = ['#ff7b7b', '#ffb457', '#ffe66d', '#7bd88f', '#6fc7ff', '#b58cff'];
    cols.forEach((col, i) => {
      g.strokeStyle = col; g.lineWidth = 9;
      g.beginPath();
      g.arc(0, 28, 54 - i * 9, Math.PI, 0);
      g.stroke();
    });
  } else if (kind === 'dot') {
    g.beginPath(); g.arc(0, 0, 44, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** エプロン / 道具箱の柄 */
export function makePatternTexture(kind, bg, fg) {
  const S = 256;
  const c = cv(S, S);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  const drawAt = (x, y, s, fn) => { g.save(); g.translate(x, y); g.scale(s, s); fn(); g.restore(); };
  const star = () => {
    g.fillStyle = fg; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 22 : 9;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath(); g.fill();
  };
  const flower = () => {
    g.fillStyle = fg;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath(); g.ellipse(Math.cos(a) * 11, Math.sin(a) * 11, 9, 6, a, 0, Math.PI * 2); g.fill();
    }
  };
  const stripe = () => { g.fillStyle = fg; g.fillRect(-30, -6, 60, 12); };
  const fn = kind === 'flower' ? flower : kind === 'stripe' ? stripe : star;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      drawAt(32 + x * 64 + (y % 2) * 16, 32 + y * 64, 1, fn);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ *
 * 塗装システム
 *  刷毛の軌跡をひとつのマスク画像へ描き、
 *  それをワールド座標から投影して全部品へ同時に適用する。
 *  （どの面をなぞっても塗料が回り込むので、4歳児でも塗り残しに悩まない）
 * ------------------------------------------------------------------ */
export class PaintSystem {
  constructor() {
    this.size = 256;
    this.canvas = cv(this.size, this.size);
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.matrix = new THREE.Matrix4();
    this.color = new THREE.Color('#ffb3d1');
    this.color2 = new THREE.Color('#ffb3d1');
    this.gloss = 0.0;
    this.fill = 0.0;       // 仕上げの自動塗り足し
    this.enabled = 0.0;
    this.rainbow = 0.0;
    this.clear();
  }
  clear() {
    this.g.clearRect(0, 0, this.size, this.size);
    this.g.fillStyle = '#000';
    this.g.fillRect(0, 0, this.size, this.size);
    this.texture.needsUpdate = true;
    this._painted = 0;
    this.fill = 0;
  }
  /** 対象を包む直方体からワールド→マスクUVの投影行列を作る */
  setProjection(camera, center, radius) {
    const cam = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 0.01, 100);
    cam.position.copy(camera.position).sub(center).setLength(radius * 3).add(center);
    cam.up.set(0, 1, 0);
    cam.lookAt(center);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    this.matrix.copy(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    this._cam = cam;
  }
  /** ワールド座標を塗る */
  paintAt(world, radius = 0.09) {
    if (!this._cam) return;
    const p = world.clone().project(this._cam);
    const x = (p.x * 0.5 + 0.5) * this.size;
    const y = (1 - (p.y * 0.5 + 0.5)) * this.size;
    const r = (radius / (this._cam.right)) * this.size * 0.5;
    const g = this.g;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    this.texture.needsUpdate = true;
    this._painted++;
  }
  /** 対象の外接箱がマスク上で占める範囲（px） */
  rectFor(box3) {
    if (!this._cam) return null;
    const c = this._cam;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? box3.max.x : box3.min.x, i & 2 ? box3.max.y : box3.min.y, i & 4 ? box3.max.z : box3.min.z);
      p.project(c);
      const x = (p.x * 0.5 + 0.5) * this.size;
      const y = (1 - (p.y * 0.5 + 0.5)) * this.size;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const cl = (v) => Math.max(0, Math.min(this.size, Math.round(v)));
    return { x: cl(x0), y: cl(y0), w: Math.max(2, cl(x1) - cl(x0)), h: Math.max(2, cl(y1) - cl(y0)) };
  }
  /** 大まかな塗り面積（0..1）。範囲を渡すとその中だけを測る。 */
  coverage(rect) {
    const r = rect || { x: 0, y: 0, w: this.size, h: this.size };
    const d = this.g.getImageData(r.x, r.y, r.w, r.h).data;
    let n = 0, tot = 0;
    for (let i = 0; i < d.length; i += 4 * 5) { // 間引いて計測
      tot++;
      if (d[i] > 110) n++;
    }
    return tot ? n / tot : 0;
  }
}

export const paintSystem = new PaintSystem();

const _registered = new Set();

/**
 * 木材用マテリアル。標準マテリアルへ「塗装マスク」と「磨き」を注入する。
 */
export function createWoodMaterial(wood) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: wood.map,
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.0,
    clearcoat: 0.0,
    envMapIntensity: 0.62,
  });
  mat.userData.isWood = true;
  patchPaint(mat, { triplanar: true, grainScale: wood.grainScale ?? 3.2 });
  return mat;
}

export function patchPaint(mat, { triplanar = false, grainScale = 3.0 } = {}) {
  if (mat.userData.painted) return mat;
  mat.userData.painted = true;
  mat.userData.triplanar = triplanar;
  mat.userData.uniforms = {
    uGrainScale: { value: grainScale },
    uPaintMask: { value: paintSystem.texture },
    uPaintMatrix: { value: paintSystem.matrix },
    uPaintColor: { value: paintSystem.color },
    uPaintColor2: { value: paintSystem.color2 },
    uPaintOn: { value: 0 },
    uPaintFill: { value: 0 },
    uPaintGloss: { value: 0 },
    uRainbow: { value: 0 },
    uSand: { value: 0 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vObjPos;\nvarying vec3 vObjNrm;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\nvObjPos = position;\nvObjNrm = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vObjPos;
        varying vec3 vObjNrm;
        uniform float uGrainScale;
        uniform sampler2D uPaintMask;
        uniform mat4 uPaintMatrix;
        uniform vec3 uPaintColor;
        uniform vec3 uPaintColor2;
        uniform float uPaintOn;
        uniform float uPaintFill;
        uniform float uPaintGloss;
        uniform float uRainbow;
        uniform float uSand;
        float paintAmount(){
          if(uPaintOn < 0.5) return 0.0;
          vec4 pc = uPaintMatrix * vec4(vWPos, 1.0);
          vec2 uv = pc.xy / max(0.0001, pc.w) * 0.5 + 0.5;
          float m = 0.0;
          if(uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0){
            m = texture2D(uPaintMask, uv).r;
          }
          m = smoothstep(0.16, 0.62, m);
          return clamp(max(m, uPaintFill), 0.0, 1.0);
        }
        vec3 rainbowCol(vec3 p){
          float t = clamp(p.y * 1.6 + p.x * 0.5 + 0.35, 0.0, 1.0);
          vec3 a = vec3(1.0,0.48,0.52), b = vec3(1.0,0.83,0.42), c = vec3(0.55,0.86,0.62), d = vec3(0.45,0.76,1.0), e=vec3(0.76,0.6,1.0);
          vec3 col = mix(a,b,smoothstep(0.0,0.25,t));
          col = mix(col,c,smoothstep(0.25,0.5,t));
          col = mix(col,d,smoothstep(0.5,0.75,t));
          col = mix(col,e,smoothstep(0.75,1.0,t));
          return col;
        }`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n float _paint = paintAmount();');
    if (triplanar) {
      // 部品の大きさが違っても木目の密度が揃うよう、オブジェクト座標で三面投影する
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        {
          vec3 n = abs(normalize(vObjNrm));
          vec3 w = pow(n, vec3(6.0));
          w /= max(0.0001, (w.x + w.y + w.z));
          vec3 p = vObjPos * uGrainScale;
          vec4 cx = texture2D(map, vec2(p.z, p.y));
          vec4 cy = texture2D(map, vec2(p.x, p.z));
          vec4 cz = texture2D(map, vec2(p.x, p.y));
          vec4 sampledDiffuseColor = cx * w.x + cy * w.y + cz * w.z;
          diffuseColor *= sampledDiffuseColor;
        }`);
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 pcol = mix(uPaintColor, rainbowCol(vWPos), uRainbow);
          // ニスは木目を透かす（uPaintGloss が高く彩度が低い場合）
          vec3 painted = mix(pcol, diffuseColor.rgb * pcol * 1.35, uPaintGloss * 0.55);
          diffuseColor.rgb = mix(diffuseColor.rgb, painted, _paint);
          diffuseColor.rgb *= mix(1.0, 1.06, uSand);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, mix(0.42, 0.12, uPaintGloss), _paint);
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.55, uSand);`);
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => (triplanar ? 'woodpaint-tp' : 'woodpaint');
  _registered.add(mat);
  return mat;
}

/** 全マテリアルの塗装ユニフォームを同期 */
export function syncPaintUniforms() {
  for (const m of _registered) {
    const u = m.userData.uniforms;
    if (!u) continue;
    u.uPaintMask.value = paintSystem.texture;
    u.uPaintMatrix.value = paintSystem.matrix;
    u.uPaintColor.value = paintSystem.color;
    u.uPaintColor2.value = paintSystem.color2;
    u.uPaintOn.value = paintSystem.enabled;
    u.uPaintFill.value = paintSystem.fill;
    u.uPaintGloss.value = paintSystem.gloss;
    u.uRainbow.value = paintSystem.rainbow;
  }
}

export function setMaterialSand(mat, v) {
  if (mat.userData.uniforms) mat.userData.uniforms.uSand.value = clamp(v, 0, 1);
}
