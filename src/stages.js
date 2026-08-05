// 舞台3種類。書き割り（板の切り抜き）をゴロゴロ送り出し、吊り物を下ろす。
import * as THREE from '../vendor/three.module.min.js';
import { clamp, lerp, damp, rand, hash1, easeOutCubic, easeOutBack, Spring } from './util.js';
import { backdropTexture, glowSprite, sparkleSprite } from './textures.js';

export const THEMES = [
  {
    id: 'forest',
    sky: ['#8fdcb4', '#4bbd94', '#186a5e', '#0b3236'],
    accent: 0x9df0b8,
    fog: 0x08201f,
    ambient: 0x2a5a52,
    fly: 'moon',
    uiA: '#7fe0b0', uiB: '#1d6b5a',
    musicScale: 0,
  },
  {
    id: 'sea',
    sky: ['#a6ddf7', '#57b4e8', '#155f9c', '#062244'],
    accent: 0x8fd8ff,
    fog: 0x05182f,
    ambient: 0x27506e,
    fly: 'cloud',
    uiA: '#9fe0ff', uiB: '#1a6fb0',
    musicScale: 1,
  },
  {
    id: 'night',
    sky: ['#c9b2f2', '#7e63ca', '#3f2378', '#12092c'],
    accent: 0xc6a0ff,
    fog: 0x0d0724,
    ambient: 0x3a2a68,
    fly: 'star',
    uiA: '#d0b6ff', uiB: '#4a2a8a',
    musicScale: 2,
  },
];

/* ---------- かたちの部品 ---------- */
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function blobShape(r, lobes = 7, wobble = 0.22, seed = 1) {
  const s = new THREE.Shape();
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = r * (1 + Math.sin(a * lobes + seed) * wobble + Math.sin(a * (lobes * 2) + seed * 2) * wobble * 0.35);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}

function waveShape(w, h, bumps = 5, phase = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h);
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = -w / 2 + w * t;
    const y = Math.sin(t * Math.PI * bumps + phase) * h * 0.22 + h * 0.2;
    if (i === 0) s.lineTo(x, y); else s.lineTo(x, y);
  }
  s.lineTo(w / 2, -h);
  s.closePath();
  return s;
}

function starShape(r, points = 5, inner = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * inner;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function cutout(shape, color, { depth = 0.11, emissive = 0x000000, emissiveIntensity = 0, rough = 0.82 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 2, curveSegments: 14,
  });
  g.translate(0, 0, -depth / 2);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: 0.02,
    emissive, emissiveIntensity,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ---------- 台車つきの書き割り ---------- */
class Flat {
  constructor(builder, { homeX, homeZ, fromX, scale = 1 }) {
    this.group = new THREE.Group();
    this.art = new THREE.Group();
    this.art.scale.setScalar(scale);
    builder(this.art);
    this.group.add(this.art);

    // 裏側の木の枠（袖から見えるのが、この遊びのいいところ）
    const braceMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 });
    const brace = new THREE.Group();
    const bb = new THREE.Box3().setFromObject(this.art);
    const w = Math.min(bb.max.x - bb.min.x, 7.5), h = bb.max.y - bb.min.y;
    const cx = (bb.max.x + bb.min.x) / 2;
    for (const [x, y, ww, hh, rot] of [
      [cx, bb.min.y + 0.30, w * 0.86, 0.15, 0],
      [cx, bb.min.y + h * 0.24, w * 0.80, 0.13, 0],
      [cx - w * 0.26, bb.min.y + h * 0.14, 0.13, h * 0.26, 0],
      [cx + w * 0.26, bb.min.y + h * 0.14, 0.13, h * 0.26, 0],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, 0.09), braceMat);
      m.position.set(x, y, -0.11);
      m.rotation.z = rot;
      m.castShadow = true;
      brace.add(m);
    }
    // つっかえ棒
    const stay = new THREE.Mesh(new THREE.BoxGeometry(0.1, h * 0.5, 0.1), braceMat);
    stay.position.set(cx + w * 0.18, bb.min.y + h * 0.23, -0.42);
    stay.rotation.x = -0.42;
    brace.add(stay);
    this.brace = brace;
    this.group.add(brace);

    // キャスター
    this.wheels = [];
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1b1b20, roughness: 0.55, metalness: 0.3 });
    for (const wx of [cx - w * 0.34, cx + w * 0.34]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 14), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, bb.min.y + 0.15, -0.1);
      wheel.castShadow = true;
      this.group.add(wheel);
      this.wheels.push(wheel);
    }

    this.homeX = homeX;
    this.homeZ = homeZ;
    this.fromX = fromX;
    this.group.position.set(fromX, 0, homeZ);
    this.state = 'wing';       // wing → rolling → home
    this.t = 0;
    this.wobble = new Spring(0, { stiffness: 34, damping: 3.4 });
  }

  rollIn() {
    if (this.state !== 'wing') return false;
    this.state = 'rolling';
    this.t = 0;
    return true;
  }

  update(dt) {
    if (this.state === 'rolling') {
      this.t = Math.min(1, this.t + dt / 1.6);
      const k = easeOutCubic(this.t);
      const px = this.group.position.x;
      this.group.position.x = lerp(this.fromX, this.homeX, k);
      const moved = this.group.position.x - px;
      for (const w of this.wheels) w.rotation.x -= moved / 0.15;
      if (this.t >= 1) {
        this.state = 'home';
        this.wobble.kick(1.6 * Math.sign(this.homeX - this.fromX));
      }
    }
    this.wobble.step(dt);
    this.art.rotation.z = this.wobble.value * 0.012;
    this.art.rotation.y = this.wobble.value * 0.02;
  }
}

/* ---------- 吊り物（月・雲・おほしさま） ---------- */
class FlyPiece {
  constructor(kind, theme) {
    this.group = new THREE.Group();
    this.kind = kind;
    const art = new THREE.Group();
    this.art = art;
    this.glow = null;

    if (kind === 'moon') {
      const g = new THREE.SphereGeometry(1.15, 40, 28);
      const m = new THREE.MeshStandardMaterial({
        color: 0xfff3cf, roughness: 0.72, emissive: 0xffe9a8, emissiveIntensity: 0.22,
      });
      const moon = new THREE.Mesh(g, m);
      art.add(moon);
      // クレーター
      const cm = new THREE.MeshStandardMaterial({ color: 0xf0e0b4, roughness: 0.9 });
      for (let i = 0; i < 7; i++) {
        const r = rand(0.10, 0.24);
        const c = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), cm);
        const a = rand(0, Math.PI * 2), b = rand(-0.7, 0.7);
        c.position.set(Math.cos(a) * Math.cos(b) * 1.1, Math.sin(b) * 1.1, Math.sin(a) * Math.cos(b) * 1.1);
        c.scale.z = 0.4;
        c.lookAt(0, 0, 0);
        art.add(c);
      }
      this.glowColor = 0xffe9a8;
      this.light = new THREE.PointLight(0xffe0a0, 12, 16, 2);
    } else if (kind === 'cloud') {
      const m = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.95, emissive: 0xbfe6ff, emissiveIntensity: 0.22,
      });
      const blobs = [[0, 0, 0, 1.0], [0.95, 0.12, 0.1, 0.76], [-0.95, 0.05, -0.08, 0.7],
      [0.42, 0.5, 0.06, 0.62], [-0.45, 0.44, -0.05, 0.56], [1.6, -0.12, 0, 0.5], [-1.6, -0.14, 0, 0.46]];
      for (const [x, y, z, s] of blobs) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(s, 22, 16), m);
        b.position.set(x, y, z);
        b.castShadow = true;
        art.add(b);
      }
      this.glowColor = 0xcfe9ff;
      this.light = new THREE.PointLight(0xbfe0ff, 8, 14, 2);
    } else {
      const mesh = cutout(starShape(1.25, 5, 0.46), 0xffe9a0, {
        depth: 0.3, emissive: 0xffd76a, emissiveIntensity: 0.45, rough: 0.5,
      });
      art.add(mesh);
      this.glowColor = 0xffe6a8;
      this.light = new THREE.PointLight(0xffdc90, 14, 16, 2);
    }

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite(), color: this.glowColor, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, toneMapped: false, opacity: 0.34,
    }));
    halo.scale.setScalar(6.4);
    art.add(halo);
    this.halo = halo;

    art.add(this.light);
    this.group.add(art);

    // 吊りロープ
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x3a3128, roughness: 1 });
    this.ropes = [];
    for (const x of [-0.85, 0.85]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 5), ropeMat);
      r.position.x = x;
      this.ropes.push(r);
      this.group.add(r);
    }

    this.topY = 13.4;
    this.homeY = 6.1;
    this.value = 0;         // 0=上 1=下ろした
    this.group.position.set(0, this.topY, -7.7);
    this.sway = new Spring(0, { stiffness: 9, damping: 1.7 });
    this.t = 0;
    this.state = 'up';
  }

  lower() {
    if (this.state !== 'up') return false;
    this.state = 'lowering';
    return true;
  }

  update(dt, battenY = 13.9) {
    this.t += dt;
    if (this.state === 'lowering') {
      const before = this.value;
      this.value = damp(this.value, 1, 1.5, dt);
      this.sway.kick((this.value - before) * 2.2);
      if (this.value > 0.995) { this.state = 'down'; this.value = 1; }
    }
    this.sway.step(dt);
    const y = lerp(this.topY, this.homeY, easeOutCubic(this.value));
    this.group.position.y = y;
    this.art.rotation.z = this.sway.value * 0.05 + Math.sin(this.t * 0.7) * 0.012 * this.value;
    this.art.position.x = this.sway.value * 0.22 + Math.sin(this.t * 0.5) * 0.05 * this.value;
    this.art.position.y = Math.sin(this.t * 0.9) * 0.05 * this.value;
    const ropeLen = Math.max(0.05, battenY - y + 1.0);
    for (const r of this.ropes) {
      r.scale.y = ropeLen;
      r.position.y = ropeLen / 2 + 0.4;
    }
    this.halo.material.opacity = 0.14 + 0.24 * this.value;
  }
}

/* ---------- 舞台まるごと ---------- */
export class StageSet {
  constructor(theme) {
    this.theme = theme;
    this.group = new THREE.Group();
    this.flats = [];
    this.time = 0;
    this.lit = 0;

    this._buildBackdrop();
    this._buildFlats();
    this.fly = new FlyPiece(theme.fly, theme);
    this.group.add(this.fly.group);
    this._buildAmbientLife();
  }

  _buildBackdrop() {
    const tex = backdropTexture(this.theme);
    const geo = new THREE.CylinderGeometry(19, 19, 17, 64, 1, true, Math.PI * 0.54, Math.PI * 0.92);
    this.backdropMat = new THREE.MeshStandardMaterial({
      map: tex, side: THREE.BackSide, roughness: 1, metalness: 0, color: 0x6a7590,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12,
    });
    const cyc = new THREE.Mesh(geo, this.backdropMat);
    cyc.position.set(0, 7.0, 5.0);
    cyc.receiveShadow = false;
    this.group.add(cyc);
    this.cyc = cyc;
  }

  _buildFlats() {
    const id = this.theme.id;
    const defs = [];

    if (id === 'forest') {
      defs.push({
        homeX: -4.0, homeZ: -6.6, fromX: -13.5, scale: 0.74,
        build: (g) => {
          const trunk = cutout(roundedRect(0.7, 3.4, 0.3), 0x6b4a30);
          trunk.position.set(0, 1.7, 0);
          g.add(trunk);
          const greens = [0x2f7a52, 0x3f9a63, 0x59b877];
          [[0, 4.3, 1.75, 0], [-1.35, 3.6, 1.2, 1], [1.35, 3.7, 1.25, 2], [0.1, 5.4, 1.15, 3]]
            .forEach(([x, y, r, s], i) => {
              const c = cutout(blobShape(r, 8, 0.14, s), greens[i % 3], { depth: 0.13 });
              c.position.set(x, y, -0.04 * i);
              g.add(c);
            });
          for (let i = 0; i < 5; i++) {
            const f = cutout(blobShape(0.13, 6, 0.2, i), 0xfff0a0, { emissive: 0xffe870, emissiveIntensity: 0.5, depth: 0.07 });
            f.position.set(rand(-1.8, 1.8), rand(2.6, 5.4), 0.16);
            g.add(f);
          }
        },
      });
      defs.push({
        homeX: 4.2, homeZ: -6.9, fromX: 13.5, scale: 0.70,
        build: (g) => {
          const trunk = cutout(roundedRect(0.55, 2.6, 0.25), 0x7a563a);
          trunk.position.set(0, 1.3, 0);
          g.add(trunk);
          [[0, 3.4, 1.5, 4], [-1.05, 2.9, 1.0, 5], [1.1, 2.95, 1.05, 6]].forEach(([x, y, r, s], i) => {
            const c = cutout(blobShape(r, 9, 0.16, s), [0x357f57, 0x47a468, 0x63c283][i], { depth: 0.13 });
            c.position.set(x, y, -0.04 * i);
            g.add(c);
          });
        },
      });
      defs.push({
        homeX: -0.2, homeZ: -8.4, fromX: -14, scale: 0.80,
        build: (g) => {
          for (let i = 0; i < 6; i++) {
            const r = rand(0.55, 1.05);
            const c = cutout(blobShape(r, 8, 0.2, i * 2.1), [0x1f5f45, 0x2a7050][i % 2], { depth: 0.12 });
            c.position.set(-3.2 + i * 1.3, r * 0.62, -0.03 * i);
            g.add(c);
          }
        },
      });
    }

    if (id === 'sea') {
      defs.push({
        homeX: -4.0, homeZ: -6.6, fromX: -13.5, scale: 0.74,
        build: (g) => {
          [[0x2f8fd0, 2.6, 0], [0x53b4e8, 2.0, 1.1], [0x8fdcff, 1.5, 2.2]].forEach(([col, h, ph], i) => {
            const w = cutout(waveShape(7.5, h, 4, ph), col, { depth: 0.12 });
            w.position.set(0, h * 0.9, -0.05 * i);
            g.add(w);
          });
          const coral = cutout(blobShape(0.9, 11, 0.4, 3), 0xff9ec0, { depth: 0.14 });
          coral.position.set(-2.1, 1.5, 0.12);
          g.add(coral);
        },
      });
      defs.push({
        homeX: 4.2, homeZ: -6.9, fromX: 13.5, scale: 0.72,
        build: (g) => {
          [[0x2a83c4, 2.3, 0.7], [0x4fb0e4, 1.7, 1.9]].forEach(([col, h, ph], i) => {
            const w = cutout(waveShape(6.6, h, 3, ph), col, { depth: 0.12 });
            w.position.set(0, h * 0.9, -0.05 * i);
            g.add(w);
          });
          const shell = cutout(blobShape(1.0, 5, 0.24, 1), 0xffd9e8, { depth: 0.16 });
          shell.position.set(1.6, 1.9, 0.12);
          g.add(shell);
          const star = cutout(starShape(0.55, 5, 0.5), 0xffbf6a, { depth: 0.12 });
          star.position.set(-1.7, 1.2, 0.14);
          star.rotation.z = 0.4;
          g.add(star);
        },
      });
      defs.push({
        homeX: 0.1, homeZ: -8.4, fromX: -14, scale: 0.80,
        build: (g) => {
          for (let i = 0; i < 5; i++) {
            const h = rand(1.4, 2.6);
            const c = cutout(roundedRect(0.5, h, 0.24), [0x1f6f9c, 0x2b86b8][i % 2], { depth: 0.11 });
            c.position.set(-3.4 + i * 1.7, h / 2, -0.03 * i);
            c.rotation.z = rand(-0.14, 0.14);
            g.add(c);
          }
        },
      });
    }

    if (id === 'night') {
      defs.push({
        homeX: -4.0, homeZ: -6.6, fromX: -13.5, scale: 0.74,
        build: (g) => {
          [[0x3a2570, 3.0, 0.2], [0x513390, 2.2, 1.4]].forEach(([col, h, ph], i) => {
            const w = cutout(waveShape(7.6, h, 2, ph), col, { depth: 0.12 });
            w.position.set(0, h * 0.9, -0.05 * i);
            g.add(w);
          });
          for (let i = 0; i < 6; i++) {
            const s = cutout(starShape(rand(0.16, 0.3), 4, 0.34), 0xfff2b8,
              { depth: 0.08, emissive: 0xffe58a, emissiveIntensity: 0.6 });
            s.position.set(rand(-3, 3), rand(2.4, 4.6), 0.16);
            s.rotation.z = rand(0, 1);
            g.add(s);
          }
        },
      });
      defs.push({
        homeX: 4.2, homeZ: -6.9, fromX: 13.5, scale: 0.72,
        build: (g) => {
          const m = new THREE.MeshStandardMaterial({ color: 0xe8dcff, roughness: 0.95, emissive: 0x6a52a8, emissiveIntensity: 0.3 });
          [[0, 2.6, 0, 1.1], [1.0, 2.8, 0.05, 0.85], [-1.0, 2.75, -0.05, 0.8], [0.5, 3.4, 0, 0.66]]
            .forEach(([x, y, z, s]) => {
              const b = new THREE.Mesh(new THREE.SphereGeometry(s, 20, 14), m);
              b.position.set(x, y, z);
              b.castShadow = true;
              g.add(b);
            });
          const tower = cutout(roundedRect(0.6, 2.4, 0.28), 0x2e1e5c);
          tower.position.set(0, 1.2, -0.1);
          g.add(tower);
        },
      });
      defs.push({
        homeX: -0.2, homeZ: -8.4, fromX: -14, scale: 0.80,
        build: (g) => {
          for (let i = 0; i < 4; i++) {
            const r = rand(1.1, 1.9);
            const c = cutout(blobShape(r, 6, 0.16, i * 3.3), [0x241a52, 0x2f2168][i % 2], { depth: 0.12 });
            c.position.set(-3.6 + i * 2.4, r * 0.45, -0.03 * i);
            g.add(c);
          }
        },
      });
    }

    for (const d of defs) {
      const f = new Flat(d.build, d);
      this.flats.push(f);
      this.group.add(f.group);
    }
  }

  // ふわふわ漂う小さな光（ほたる・あぶく・こなゆき）
  _buildAmbientLife() {
    const N = 70;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rand(-7, 7);
      pos[i * 3 + 1] = rand(0.3, 7.5);
      pos[i * 3 + 2] = rand(-8.5, -1.5);
      seed[i] = rand(0, 100);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.lifeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(this.theme.accent) },
        uOpacity: { value: 0.0 },
        uSize: { value: 90 },
      },
      vertexShader: /* glsl */`
        attribute float aSeed;
        uniform float uTime, uSize;
        varying float vT;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.35 + aSeed) * 0.9;
          p.y += sin(uTime * 0.5 + aSeed * 2.1) * 0.55;
          p.z += cos(uTime * 0.3 + aSeed * 1.3) * 0.7;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vT = 0.45 + 0.55 * sin(uTime * 1.6 + aSeed * 5.0);
          gl_PointSize = uSize / max(1.0, -mv.z) * (0.55 + fract(aSeed) * 0.8);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uOpacity;
        varying float vT;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor, a * a * vT * uOpacity);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.life = new THREE.Points(g, this.lifeMat);
    this.life.frustumCulled = false;
    this.group.add(this.life);
  }

  get remainingFlats() { return this.flats.filter((f) => f.state === 'wing'); }
  rollNextFlat() {
    const f = this.remainingFlats[0];
    return f ? (f.rollIn() ? f : null) : null;
  }
  get allFlatsIn() { return this.flats.every((f) => f.state === 'home'); }

  // スポットが吸いつく先
  attractorPoints() {
    const pts = [];
    for (const f of this.flats) {
      if (f.state !== 'wing') pts.push(new THREE.Vector3(f.group.position.x, 0, f.homeZ + 1.4));
    }
    return pts;
  }

  setLit(v) {
    this.lit = v;
    // 木枠は舞台裏から見るとかわいいが、客席からは見せない
    for (const f of this.flats) f.brace.visible = v < 0.55;
    this.backdropMat.emissiveIntensity = lerp(0.12, 0.26, v);
    this.backdropMat.color.setRGB(lerp(0.42, 1, v), lerp(0.46, 1, v), lerp(0.56, 1, v));
    this.lifeMat.uniforms.uOpacity.value = lerp(0.25, 0.95, v);
    if (this.fly.light) this.fly.light.intensity = lerp(3, this.fly.kind === 'star' ? 16 : 12, v);
  }

  update(dt) {
    this.time += dt;
    for (const f of this.flats) f.update(dt);
    this.fly.update(dt);
    this.lifeMat.uniforms.uTime.value = this.time;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => m.dispose());
      }
    });
  }
}
