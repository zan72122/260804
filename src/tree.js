// 樹木の生成。3 樹種（丸い樹冠 / 縦長 / 花の木）。樹冠は遅れて揺れる。
import * as THREE from '../vendor/three.module.js';
import * as TEX from './textures.js';
import { makeRng, rr, lerp, clamp01, makeNoise2D, fbm } from './util.js';
import { mergeGeoms } from './world.js';

export const SPECIES = {
  oak: {
    key: 'oak', label: 'まるい き', bark: 'oak',
    trunkH: 5.6, trunkR: 0.54, crownR: 4.0, crownH: 5.4, crownShape: 'round',
    leafKind: 'broad', leafColor: [74, 126, 50], blobColor: 0x3f6b2c,
    branches: 5, leafCards: 420, sway: 1.0, icon: '#5f9c3a',
  },
  poplar: {
    key: 'poplar', label: 'ほそながい き', bark: 'pine',
    trunkH: 3.8, trunkR: 0.46, crownR: 2.05, crownH: 9.4, crownShape: 'tall',
    leafKind: 'needle', leafColor: [64, 104, 72], blobColor: 0x2f5a3c,
    branches: 7, leafCards: 380, sway: 1.35, icon: '#3f7a52',
  },
  cherry: {
    key: 'cherry', label: 'はなの き', bark: 'cherry',
    trunkH: 4.4, trunkR: 0.52, crownR: 4.2, crownH: 4.1, crownShape: 'wide',
    leafKind: 'blossom', leafColor: [238, 178, 198], blobColor: 0xd98fae,
    branches: 6, leafCards: 440, sway: 0.85, icon: '#e79ab6',
  },
};

/* ---------- テーパー付きチューブ ---------- */
export function tubeGeometry(curve, radiusFn, radial = 8, tubular = 20, vScale = 1, jitter = 0, seed = 1) {
  const rng = makeRng(seed);
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos = [], nor = [], uv = [], idx = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(Math.min(t, 1), P);
    const N = frames.normals[Math.min(i, tubular - 1)];
    const B = frames.binormals[Math.min(i, tubular - 1)];
    const r = radiusFn(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const jr = jitter ? 1 + (rng() - 0.5) * jitter : 1;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(P.x + nx * r * jr, P.y + ny * r * jr, P.z + nz * r * jr);
      nor.push(nx, ny, nz);
      uv.push(j / radial * 1.6, t * vScale);
    }
  }
  for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/* ---------- 揺れシェーダ ---------- */
function makeSwayUniforms() {
  return {
    uTime: { value: 0 },
    uSway: { value: new THREE.Vector3() },
    uWind: { value: 0.035 },
    uBaseY: { value: 0 },
    uHeight: { value: 8 },
  };
}
function applySway(material, u) {
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>',
        `#include <common>
        uniform float uTime; uniform vec3 uSway; uniform float uWind;
        uniform float uBaseY; uniform float uHeight;`)
      .replace('#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        {
          float hh = clamp((mvPosition.y - uBaseY) / uHeight, 0.0, 1.0);
          float k = hh * hh;
          float ph = mvPosition.x * 0.42 + mvPosition.z * 0.31;
          vec3 w = vec3(
            sin(uTime * 1.25 + ph),
            sin(uTime * 0.82 + ph * 1.9) * 0.30,
            cos(uTime * 1.05 + ph * 0.7)
          ) * uWind;
          mvPosition.xyz += uSway * k + w * (0.25 + k);
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  material.userData.swayU = u;
  material.customProgramCacheKey = () => 'sway';
}

/* ---------- 枝の骨格 ---------- */
function buildSkeleton(sp, rng) {
  const segs = [];   // 幹＋枝のカーブ
  const tips = [];   // 樹冠を置く点
  const H = sp.trunkH;
  // 幹（わずかに曲がる）
  const lean = new THREE.Vector3(rr(rng, -0.16, 0.16), 0, rr(rng, -0.16, 0.16));
  const trunkPts = [];
  const trunkTop = sp.crownShape === 'tall' ? H + sp.crownH * 0.86 : H;
  const N = 6;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    trunkPts.push(new THREE.Vector3(
      lean.x * t * t * trunkTop * 0.30 + Math.sin(t * 2.4) * 0.06,
      t * trunkTop,
      lean.z * t * t * trunkTop * 0.30 + Math.cos(t * 1.9) * 0.05,
    ));
  }
  const trunkCurve = new THREE.CatmullRomCurve3(trunkPts);
  segs.push({
    curve: trunkCurve, r0: sp.trunkR * 1.42, r1: sp.trunkR * (sp.crownShape === 'tall' ? 0.10 : 0.42),
    radial: 12, tubular: 16, vScale: trunkTop * 0.55, level: 0,
  });

  const branchCount = sp.branches;
  for (let b = 0; b < branchCount; b++) {
    const t0 = sp.crownShape === 'tall'
      ? rr(rng, 0.22, 0.92)
      : rr(rng, 0.62, 0.99);
    const base = trunkCurve.getPointAt(t0);
    const a = (b / branchCount) * Math.PI * 2 + rr(rng, -0.4, 0.4);
    let up, out, len;
    if (sp.crownShape === 'tall') {
      up = rr(rng, 0.55, 0.95); out = rr(rng, 0.55, 1.0); len = rr(rng, 1.1, 2.1);
    } else if (sp.crownShape === 'wide') {
      up = rr(rng, 0.32, 0.72); out = rr(rng, 1.1, 1.65); len = rr(rng, 2.3, 3.4);
    } else {
      up = rr(rng, 0.55, 1.05); out = rr(rng, 0.85, 1.35); len = rr(rng, 2.0, 3.1);
    }
    const dir = new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out).normalize();
    const mid = base.clone().addScaledVector(dir, len * 0.55).add(new THREE.Vector3(0, len * 0.12, 0));
    const end = base.clone().addScaledVector(dir, len).add(new THREE.Vector3(0, len * 0.26, 0));
    const c = new THREE.CatmullRomCurve3([base, mid, end]);
    const r0 = sp.trunkR * lerp(0.62, 0.30, t0);
    segs.push({ curve: c, r0, r1: r0 * 0.22, radial: 7, tubular: 8, vScale: len * 0.8, level: 1 });
    tips.push({ p: end, r: len * 0.55, level: 1 });
    // 小枝
    const sub = 2;
    for (let s = 0; s < sub; s++) {
      const st = rr(rng, 0.45, 0.85);
      const sbase = c.getPointAt(st);
      const sa = a + rr(rng, -1.3, 1.3);
      const sd = new THREE.Vector3(Math.cos(sa) * 0.9, rr(rng, 0.5, 1.1), Math.sin(sa) * 0.9).normalize();
      const slen = len * rr(rng, 0.35, 0.55);
      const send = sbase.clone().addScaledVector(sd, slen);
      const sc = new THREE.CatmullRomCurve3([sbase, sbase.clone().addScaledVector(sd, slen * 0.5).add(new THREE.Vector3(0, slen * 0.10, 0)), send]);
      segs.push({ curve: sc, r0: r0 * 0.42, r1: r0 * 0.12, radial: 5, tubular: 5, vScale: slen, level: 2 });
      tips.push({ p: send, r: slen * 0.72, level: 2 });
    }
  }
  return { segs, tips, trunkCurve, trunkTop };
}

/* ---------- 樹冠のかたまり ---------- */
function buildCrownBlobs(sp, tips, rng, trunkTop) {
  const geos = [];
  const noise = makeNoise2D(sp.key.length * 17 + 3);
  const centers = [];
  if (sp.crownShape === 'tall') {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      centers.push({
        p: new THREE.Vector3(rr(rng, -0.35, 0.35), sp.trunkH + 0.5 + t * sp.crownH * 0.92, rr(rng, -0.35, 0.35)),
        r: sp.crownR * (0.55 + Math.sin(t * Math.PI) * 0.72) * rr(rng, 0.85, 1.1),
      });
    }
  } else if (sp.crownShape === 'wide') {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rr(rng, -0.3, 0.3);
      const rad = sp.crownR * rr(rng, 0.36, 0.72);
      centers.push({
        p: new THREE.Vector3(Math.cos(a) * rad, sp.trunkH + rr(rng, 0.5, 1.5) + sp.crownH * 0.35, Math.sin(a) * rad),
        r: sp.crownR * rr(rng, 0.44, 0.62),
      });
    }
    centers.push({ p: new THREE.Vector3(0, sp.trunkH + sp.crownH * 0.55, 0), r: sp.crownR * 0.6 });
  } else {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rr(rng, -0.35, 0.35);
      const rad = sp.crownR * rr(rng, 0.30, 0.58);
      const hy = sp.trunkH + sp.crownH * rr(rng, 0.24, 0.68);
      centers.push({ p: new THREE.Vector3(Math.cos(a) * rad, hy, Math.sin(a) * rad), r: sp.crownR * rr(rng, 0.46, 0.66) });
    }
    centers.push({ p: new THREE.Vector3(0, sp.trunkH + sp.crownH * 0.80, 0), r: sp.crownR * 0.58 });
  }

  const surface = [];
  for (const c of centers) {
    const g = new THREE.IcosahedronGeometry(c.r, 2);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const base = new THREE.Color(sp.blobColor);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const l = Math.hypot(x, y, z) || 1;
      const nz = fbm(noise, (x + c.p.x) * 0.55 + 10, (z + c.p.z) * 0.55 + (y + c.p.y) * 0.4, 3);
      const d = 1 + (nz - 0.5) * 0.46;
      const px = x * d + c.p.x, py = y * d + c.p.y, pz = z * d + c.p.z;
      p.setXYZ(i, px, py, pz);
      // 下と内側を暗く
      const shade = clamp01(0.52 + (y / l) * 0.36 + nz * 0.30);
      col[i * 3] = base.r * shade; col[i * 3 + 1] = base.g * shade; col[i * 3 + 2] = base.b * shade;
      if (nz > 0.30) surface.push(new THREE.Vector3(px, py, pz));
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    if (!g.attributes.uv) {
      const uv = new Float32Array(p.count * 2);
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    geos.push(g);
  }
  return { geo: mergeGeoms(geos), surface, centers };
}

/* ---------- 根 ---------- */
function buildRoots(sp, rng, ballTopR, ballBotR, ballDepth) {
  const geos = [];
  const cut = [];   // 根鉢表面で切られた根の位置
  const thick = 6;
  for (let i = 0; i < thick; i++) {
    const a = (i / thick) * Math.PI * 2 + rr(rng, -0.3, 0.3);
    const depth = rr(rng, 0.55, 0.92) * ballDepth;
    // 根鉢の内側におさまる終点
    const tr = lerp(ballTopR, ballBotR, depth / ballDepth) * rr(rng, 0.80, 0.97);
    const p0 = new THREE.Vector3(Math.cos(a) * sp.trunkR * 0.45, -0.06, Math.sin(a) * sp.trunkR * 0.45);
    const p1 = new THREE.Vector3(Math.cos(a) * tr * 0.45, -depth * 0.22, Math.sin(a) * tr * 0.45);
    const p2 = new THREE.Vector3(Math.cos(a) * tr * 0.85, -depth * 0.62, Math.sin(a) * tr * 0.85);
    const p3 = new THREE.Vector3(Math.cos(a) * tr, -depth, Math.sin(a) * tr);
    const c = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
    const r0 = sp.trunkR * rr(rng, 0.44, 0.66);
    geos.push(tubeGeometry(c, (t) => lerp(r0, r0 * 0.16, Math.pow(t, 0.75)), 7, 12, 2.2, 0.10, i + 4));
    cut.push({ p: p3, r: r0 * 0.2 });
    // 側根
    for (let s = 0; s < 3; s++) {
      const st = rr(rng, 0.25, 0.75);
      const sb = c.getPointAt(st);
      const sa = a + rr(rng, -1.2, 1.2);
      const dep = rr(rng, 0.15, 0.5) * ballDepth;
      const rlim = lerp(ballTopR, ballBotR, clamp01((-sb.y + dep) / ballDepth)) * 0.92;
      const se = new THREE.Vector3(Math.cos(sa) * rlim, sb.y - dep, Math.sin(sa) * rlim);
      const sc = new THREE.CatmullRomCurve3([sb, sb.clone().lerp(se, 0.5).add(new THREE.Vector3(0, 0.12, 0)), se]);
      const sr = r0 * rr(rng, 0.22, 0.38);
      geos.push(tubeGeometry(sc, (t) => lerp(sr, sr * 0.14, t), 5, 7, 1.6, 0.12, i * 7 + s));
      cut.push({ p: se, r: sr * 0.18 });
    }
  }
  return { geo: mergeGeoms(geos), cut };
}

/* ---------- 木本体 ---------- */
export class Tree {
  constructor(speciesKey, seed = 1, ball = { topR: 1.9, botR: 0.55, depth: 2.55 }) {
    const sp = SPECIES[speciesKey] || SPECIES.oak;
    this.sp = sp;
    const rng = makeRng(seed * 977 + sp.key.length * 31);
    this.group = new THREE.Group();
    this.swayU = makeSwayUniforms();
    this.swayVel = new THREE.Vector3();
    this.swayPos = new THREE.Vector3();
    this.impulse = new THREE.Vector3();

    const sk = buildSkeleton(sp, rng);
    this.trunkTop = sk.trunkTop;
    this.height = sp.crownShape === 'tall' ? sp.trunkH + sp.crownH : sp.trunkH + sp.crownH * 1.05;
    this.swayU.uHeight.value = this.height;

    // 幹 + 枝
    const woodGeos = sk.segs.map((s) =>
      tubeGeometry(s.curve, (t) => lerp(s.r0, s.r1, Math.pow(t, 0.72)), s.radial, s.tubular, s.vScale, s.level ? 0.10 : 0.055, s.r0 * 1000 | 0));
    const barkMat = new THREE.MeshStandardMaterial({
      map: TEX.barkTexture(sp.bark), bumpMap: TEX.barkBumpTexture(sp.bark), bumpScale: 0.9,
      roughness: 0.96, metalness: 0.0,
    });
    barkMat.map.repeat.set(1.4, 1);
    applySway(barkMat, this.swayU);
    this.barkMat = barkMat;
    this.trunk = new THREE.Mesh(mergeGeoms(woodGeos), barkMat);
    this.trunk.castShadow = true;
    this.trunk.receiveShadow = true;
    this.group.add(this.trunk);

    // 根張り（地際のふくらみ）
    const flare = new THREE.Mesh(
      new THREE.CylinderGeometry(sp.trunkR * 1.22, sp.trunkR * 2.25, 0.72, 16, 1, true), barkMat);
    flare.position.y = 0.30;
    flare.castShadow = true;
    this.group.add(flare);

    // 樹冠
    const crown = buildCrownBlobs(sp, sk.tips, rng, sk.trunkTop);
    const blobMat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.88, metalness: 0.0, flatShading: false,
    });
    applySway(blobMat, this.swayU);
    this.crownMesh = new THREE.Mesh(crown.geo, blobMat);
    this.crownMesh.castShadow = true;
    this.group.add(this.crownMesh);

    // 葉カード（インスタンス）
    const cardGeo = new THREE.PlaneGeometry(1, 1);
    const leafMat = new THREE.MeshStandardMaterial({
      map: TEX.leafCardTexture(sp.leafKind, sp.leafColor),
      transparent: false, alphaTest: 0.42, side: THREE.DoubleSide,
      roughness: 0.85, metalness: 0.0,
    });
    applySway(leafMat, this.swayU);
    const count = Math.min(sp.leafCards, crown.surface.length);
    const inst = new THREE.InstancedMesh(cardGeo, leafMat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const shuffled = crown.surface.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
    }
    const cardSize = sp.crownShape === 'tall' ? 1.05 : 1.55;
    for (let i = 0; i < count; i++) {
      const p = shuffled[i];
      // 最寄りの中心から外向き法線
      let best = crown.centers[0], bd = Infinity;
      for (const c of crown.centers) {
        const d = p.distanceToSquared(c.p);
        if (d < bd) { bd = d; best = c; }
      }
      const n = p.clone().sub(best.p).normalize();
      const pos = p.clone().addScaledVector(n, 0.10);
      q.setFromUnitVectors(up, n);
      const roll = new THREE.Quaternion().setFromAxisAngle(n, rng() * Math.PI * 2);
      q.premultiply(roll);
      const s = cardSize * rr(rng, 0.72, 1.28);
      sv.set(s, s, s);
      m.compose(pos, q, sv);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = false;
    this.leafMesh = inst;
    this.group.add(inst);

    // 根
    const roots = buildRoots(sp, rng, ball.topR, ball.botR, ball.depth);
    const rootMap = TEX.barkTexture(sp.bark);
    const rootMat = new THREE.MeshStandardMaterial({
      map: rootMap, bumpMap: TEX.barkBumpTexture(sp.bark), bumpScale: 0.5,
      emissiveMap: rootMap, emissive: 0x000000,
      roughness: 1.0, metalness: 0, color: new THREE.Color(1.25, 1.12, 0.94),
    });
    this.rootMat = rootMat;
    this.roots = new THREE.Mesh(roots.geo, rootMat);
    this.roots.castShadow = false;
    this.group.add(this.roots);
    this.cutRoots = roots.cut;

    this.leafColor = sp.leafColor;
  }

  // 機械の動きに応じた「遅れて揺れる」
  addImpulse(v) { this.impulse.add(v); }

  update(dt, t) {
    this.swayU.uTime.value = t;
    // バネで追従（遅れ）
    const k = 26, c = 6.2;
    const a = this.impulse.clone().multiplyScalar(k)
      .sub(this.swayPos.clone().multiplyScalar(k))
      .sub(this.swayVel.clone().multiplyScalar(c));
    this.swayVel.addScaledVector(a, dt);
    this.swayPos.addScaledVector(this.swayVel, dt);
    this.impulse.multiplyScalar(Math.exp(-dt * 4.5));
    this.swayU.uSway.value.copy(this.swayPos).multiplyScalar(this.sp.sway);
  }

  setWind(v) { this.swayU.uWind.value = v; }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
