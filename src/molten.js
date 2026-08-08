/**
 * molten.js — 溶銑（ヒーローマテリアル #1）と、それに付随する軽量エフェクト。
 * 流体シミュレーションは一切しない。UVスクロール＋発光＋粒子の“偽装”で
 * 「熱い・流れている・まぶしい」を作る。
 */
import * as THREE from 'three';
import { makeMoltenMaterial } from './materials.js';
import { taperedTube, sweepStrip } from './geom.js';
import { TAPHOLE } from './world.js';

/* ------------------------------------------------------------------ */
/* 粒子（火花・湯玉・湯気）                                              */
/* ------------------------------------------------------------------ */
class Particles {
  constructor(scene, tex, max, { blending = THREE.AdditiveBlending, gravity = -9.0 } = {}) {
    this.max = max; this.gravity = gravity;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setDrawRange(0, max);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 3), 40);

    const m = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex }, uPR: { value: 1 } },
      vertexShader: /* glsl */`
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        uniform float uPR;
        varying float vA; varying vec3 vC;
        void main(){
          vA = aAlpha; vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uPR * 260.0 / max(0.4, -mv.z), 1.0, 90.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        precision mediump float;
        uniform sampler2D uMap; varying float vA; varying vec3 vC;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          if (t.a * vA < 0.01) discard;
          gl_FragColor = vec4(vC * t.rgb, t.a * vA);
        }`,
      transparent: true, depthWrite: false, blending, toneMapped: false,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
    this.geo = g; this.mat = m;
  }
  spawn(p, v, { size = 0.1, life = 0.9, color = [1, 0.7, 0.25], drag = 0.6 } = {}) {
    const i = this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = color[0]; this.col[i * 3 + 1] = color[1]; this.col[i * 3 + 2] = color[2];
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.drag[i] = drag;
    this.alpha[i] = 1;
  }
  update(dt) {
    const { pos, vel, life, maxLife, alpha, drag } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { if (alpha[i] !== 0) alpha[i] = 0; continue; }
      life[i] -= dt;
      const k = Math.max(0, life[i] / maxLife[i]);
      alpha[i] = k * k * (3 - 2 * k);
      const d = Math.exp(-drag[i] * dt);
      vel[i * 3] *= d; vel[i * 3 + 2] *= d;
      vel[i * 3 + 1] = vel[i * 3 + 1] * d + this.gravity * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.28; life[i] -= dt * 3; }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
export function createMolten(scene, M, world, quality) {
  const LOW = quality === 'low';
  const grp = new THREE.Group();
  scene.add(grp);

  /* --- 1. 出銑口から噴き出す流れ（テーパー管） --- */
  const jetCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.20, 1.14),
    new THREE.Vector3(0, 2.10, 1.44),
    new THREE.Vector3(0, 1.78, 1.68),
    new THREE.Vector3(0, 1.36, 1.82),
    new THREE.Vector3(0, 1.04, 1.88),
  ]);
  const jetGeo = taperedTube(jetCurve, LOW ? 14 : 24, LOW ? 7 : 10,
    (t) => 0.205 * (1 - t * 0.16) * (1 + Math.sin(t * 7) * 0.05));
  const jetMat = makeMoltenMaterial({ speed: 3.4, scaleV: 3.6, scaleU: 2.0, skin: 0.26, glow: 1.05,
    hot: 0xffdb86, hotMul: 2.05, mid: 0xff6d0c, midMul: 1.75, cool: 0xcf3d05, lateral: 0, side: THREE.FrontSide });
  const jet = new THREE.Mesh(jetGeo, jetMat);
  jet.renderOrder = 4;
  grp.add(jet);

  /* --- 2. 樋を流れる帯 --- */
  const ribbonProfile = [
    { x: -0.305, y: -0.062 }, { x: -0.20, y: -0.012 }, { x: -0.07, y: 0.012 },
    { x: 0.07, y: 0.012 }, { x: 0.20, y: -0.012 }, { x: 0.305, y: -0.062 },
  ];
  const ribbonGeo = sweepStrip(world.curve, ribbonProfile, LOW ? 34 : 64, { uvRepeatV: 1 });
  const ribbonMat = makeMoltenMaterial({ speed: 0.85, scaleV: 11.0, scaleU: 2.6, skin: 0.80, glow: 0.8,
    hot: 0xffd782, hotMul: 2.2, mid: 0xff6a10, midMul: 1.8, cool: 0x7a3312, lateral: 1, side: THREE.DoubleSide });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.renderOrder = 3;
  grp.add(ribbon);

  /* --- 3. 擬似ブルーム（加算スプライト） --- */
  const glowMat = () => new THREE.SpriteMaterial({
    map: M.glowTex, blending: THREE.AdditiveBlending, depthWrite: false,
    transparent: true, toneMapped: false, color: 0xffffff, opacity: 0,
  });
  const glows = [];
  const addGlow = (x, y, z, s) => {
    const sp = new THREE.Sprite(glowMat());
    sp.position.set(x, y, z); sp.scale.setScalar(s); sp.renderOrder = 8;
    grp.add(sp); glows.push(sp); return sp;
  };
  const gTap = addGlow(TAPHOLE.x, TAPHOLE.y, TAPHOLE.z + 0.14, 1.7);
  const gImpact = addGlow(0, 1.12, 1.88, 1.9);
  const runnerGlows = [];
  for (let i = 0.12; i <= 1.0001; i += 0.16) {
    const p = world.curve.getPointAt(Math.min(i, 1));
    const sp = addGlow(p.x, p.y + 0.06, p.z, 1.25);
    sp.userData.t = i;
    runnerGlows.push(sp);
  }
  const pLadle = world.curve.getPointAt(1);
  const gLadle = addGlow(pLadle.x + 0.35, 1.0, pLadle.z + 1.55, 2.2);

  /* --- 4. 光源（溶銑が周囲を照らす） --- */
  const lightTap = new THREE.PointLight(0xff6a12, 0, 16, 2);
  lightTap.position.set(TAPHOLE.x, TAPHOLE.y, TAPHOLE.z + 0.4);
  scene.add(lightTap);
  const lightRun = new THREE.PointLight(0xff7a1a, 0, 20, 2);
  lightRun.position.set(0.5, 1.5, 4.0);
  scene.add(lightRun);

  /* --- 5. 粒子 --- */
  const sparks = new Particles(scene, M.sparkTex, LOW ? 160 : 320, { gravity: -9.5 });
  const steam = new Particles(scene, M.puffTex, LOW ? 70 : 140, { gravity: 1.3, blending: THREE.NormalBlending });

  /* --- 状態 --- */
  const S = {
    open: 0,        // 出銑口の開き（0..1）→ 噴流の太さ
    fill: 0,        // 樋のどこまで届いているか
    tail: 0,        // 後ろから引いていく
    heat: 0,        // 発光の総量
    flowT: 0,
    dust: 0,        // 開孔中の削り粉
    dustPos: new THREE.Vector3(),
    impact: 0,
    pre: 0,          // 貫通前のじわじわ赤くなる熱
    time: 0,
  };

  const tmp = new THREE.Vector3();
  const api = {
    group: grp, sparks, steam, jetCurve,
    state: S,
    setOpen(v) { S.open = THREE.MathUtils.clamp(v, 0, 1); },
    setFill(v) { S.fill = THREE.MathUtils.clamp(v, 0, 1); },
    setTail(v) { S.tail = THREE.MathUtils.clamp(v, 0, 1); },
    setPreheat(v) { S.pre = THREE.MathUtils.clamp(v, 0, 1); },
    reset() { S.open = 0; S.fill = 0; S.tail = 0; S.heat = 0; S.impact = 0; S.pre = 0; },

    /** 開孔中の削り粉＋火花 */
    drillDust(pos, power) { S.dust = power; S.dustPos.copy(pos); },

    /** 貫通の瞬間の大爆発的な噴出 */
    burst(strength = 1) {
      const p = new THREE.Vector3(TAPHOLE.x, TAPHOLE.y, TAPHOLE.z + 0.1);
      const n = LOW ? 60 : 130;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.9;
        const v = new THREE.Vector3(
          Math.cos(a) * r * 3.4,
          Math.sin(a) * r * 3.4 + 2.6 + Math.random() * 3.4,
          3.2 + Math.random() * 7.0
        ).multiplyScalar(strength);
        sparks.spawn(p, v, {
          size: 0.05 + Math.random() * 0.16,
          life: 0.6 + Math.random() * 1.1,
          color: Math.random() < 0.35 ? [1, 1, 0.85] : [1, 0.55 + Math.random() * 0.3, 0.12],
          drag: 0.5 + Math.random() * 0.5,
        });
      }
      S.impact = 1.6;
    },
    splash(pos, n = 18, up = 4) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        sparks.spawn(pos, new THREE.Vector3(Math.cos(a) * 1.6 * Math.random(), up * (0.4 + Math.random()), Math.sin(a) * 1.6 * Math.random() + 0.8), {
          size: 0.05 + Math.random() * 0.13, life: 0.5 + Math.random() * 0.7,
          color: [1, 0.65 + Math.random() * 0.3, 0.15], drag: 0.7,
        });
      }
    },
    puffSteam(pos, n = 14) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        steam.spawn(pos, new THREE.Vector3(Math.cos(a) * 0.9, 1.0 + Math.random() * 1.5, Math.sin(a) * 0.9 + 0.4), {
          size: 0.5 + Math.random() * 0.55, life: 1.5 + Math.random() * 1.2,
          color: [0.94, 0.92, 0.90], drag: 1.2,
        });
      }
    },

    update(dt, camera, pixelRatio) {
      S.time += dt;
      const t = S.time;
      sparks.mat.uniforms.uPR.value = pixelRatio;
      steam.mat.uniforms.uPR.value = pixelRatio;

      // --- 噴流 ---
      const open = S.open;
      jet.visible = open > 0.02;
      if (jet.visible) {
        const wob = 1 + Math.sin(t * 22) * 0.03 + Math.sin(t * 9.3) * 0.02;
        jet.scale.set(open * wob, open * wob, 1);
        // 噴き出しの向きが太さで少し変わる（勢い）
        jetMat.uniforms.uTime.value = t;
        jetMat.uniforms.uAlpha.value = Math.min(1, open * 1.6);
      }

      // --- 樋の帯 ---
      ribbon.visible = S.fill > 0.005 && S.fill > S.tail;
      ribbonMat.uniforms.uTime.value = t;
      ribbonMat.uniforms.uFill.value = S.fill;
      ribbonMat.uniforms.uTail.value = S.tail;
      ribbonMat.uniforms.uSpeed.value = 0.5 + open * 0.75;

      // --- 熱量 ---
      const target = Math.max(open, (S.fill - S.tail) * 0.85);
      S.heat += (target - S.heat) * Math.min(1, dt * 6);
      const flick = 0.86 + Math.sin(t * 13.7) * 0.07 + Math.sin(t * 31.1) * 0.05 + Math.random() * 0.04;
      S.impact = Math.max(0, S.impact - dt * 2.2);

      const H = S.heat * flick;
      gTap.material.opacity = Math.min(1.3, (open * 1.15 + S.impact * 0.9 + S.pre * 0.85)) * flick;
      gTap.scale.setScalar(0.7 + open * 1.5 + S.impact * 2.2 + S.pre * 0.9);
      gImpact.material.opacity = open > 0.05 ? Math.min(1, open * 0.95) * flick : 0;
      gImpact.scale.setScalar(1.1 + open * 1.5);
      for (const sp of runnerGlows) {
        const on = S.fill > sp.userData.t && S.tail < sp.userData.t;
        sp.material.opacity = on ? 0.5 * H : 0;
        sp.scale.setScalar(1.0 + 0.5 * H);
      }
      gLadle.material.opacity = (S.fill > 0.98 && S.tail < 0.98) ? 0.6 * H : gLadle.material.opacity * (1 - dt * 2);
      gLadle.scale.setScalar(1.6 + 0.8 * H);

      lightTap.intensity = (open * 26 + S.impact * 30 + S.pre * 14) * flick;
      lightTap.color.setHSL(0.055 + open * 0.01, 1, 0.5);
      lightRun.intensity = (S.fill - S.tail > 0.2 ? 16 * H : 0);
      if (S.fill > 0.02) {
        const p = world.curve.getPointAt(THREE.MathUtils.clamp((S.fill + S.tail) / 2, 0.02, 0.98));
        lightRun.position.set(p.x, p.y + 0.9, p.z);
      }

      // --- 火花：着湯点 ---
      if (open > 0.08) {
        const n = Math.round((LOW ? 1 : 2) + open * (LOW ? 2 : 4));
        const p = new THREE.Vector3(0, 1.06, 1.88);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          sparks.spawn(p, new THREE.Vector3(Math.cos(a) * 1.5, 1.6 + Math.random() * 2.6, Math.sin(a) * 1.0 + 1.2), {
            size: 0.035 + Math.random() * 0.09, life: 0.35 + Math.random() * 0.6,
            color: [1, 0.7 + Math.random() * 0.25, 0.2], drag: 0.9,
          });
        }
      }
      // --- 火花：取鍋への落とし込み ---
      if (S.fill > 0.985 && S.tail < 0.9 && Math.random() < 0.5) {
        const p = new THREE.Vector3(pLadle.x + 0.2, pLadle.y - 0.1, pLadle.z + 0.9);
        const a = Math.random() * Math.PI * 2;
        sparks.spawn(p, new THREE.Vector3(Math.cos(a) * 1.2, 1.2 + Math.random() * 2.0, Math.sin(a) * 1.2), {
          size: 0.04 + Math.random() * 0.09, life: 0.4 + Math.random() * 0.5, color: [1, 0.72, 0.2], drag: 0.9,
        });
      }
      // --- 削り粉（開孔中） ---
      if (S.dust > 0.02) {
        const n = LOW ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const spd = 1.2 + Math.random() * 2.2 * S.dust;
          sparks.spawn(S.dustPos, new THREE.Vector3(Math.cos(a) * spd, Math.sin(a) * spd + 0.6, 1.0 + Math.random() * 1.4), {
            size: 0.03 + Math.random() * 0.07, life: 0.3 + Math.random() * 0.4,
            color: Math.random() < 0.5 ? [1, 0.93, 0.7] : [0.75, 0.55, 0.36], drag: 1.6,
          });
        }
        S.dust *= Math.exp(-dt * 2.2);
      }

      sparks.update(dt);
      steam.update(dt);
    },
  };
  return api;
}
