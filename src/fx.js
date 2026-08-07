// ============================================================================
// 道具と粒子 — 糸・板・泡・しずく・風・藍のにごり
// ============================================================================

import * as THREE from '../vendor/three.module.js';
import { clamp01, lerp, makeRng, TAU } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const ZAX = new THREE.Vector3(0, 0, 1);

// ---------------------------------------------------------------------------
// 糸（縛り）
// ---------------------------------------------------------------------------

export class ThreadSet {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xe9e0c8, roughness: 0.92, metalness: 0.0
    });
    this.matDyed = new THREE.MeshStandardMaterial({
      color: 0x39527d, roughness: 0.9, metalness: 0.0
    });
    this.geoCache = new THREE.TorusGeometry(1, 0.010, 6, 40);
    this.items = [];
  }

  sync(ties, fold) {
    // 足りない分をつくる
    while (this.items.length < ties.length) {
      const g = new THREE.Group();
      this.group.add(g);
      this.items.push({ group: g, rings: [] });
    }
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const t = ties[i];
      if (!t || t.removed) { it.group.visible = false; continue; }
      it.group.visible = true;
      const ring = fold.ringAt(t.a);
      const wraps = t.wraps;
      while (it.rings.length < wraps) {
        const m = new THREE.Mesh(this.geoCache, this.mat);
        m.castShadow = true;
        it.group.add(m);
        it.rings.push(m);
      }
      for (let k = 0; k < it.rings.length; k++) {
        const m = it.rings[k];
        m.visible = k < wraps;
        if (!m.visible) continue;
        const spread = (k - (wraps - 1) * 0.5) * 0.0085;
        const ax = new THREE.Vector3(ring.axis.x, ring.axis.y, ring.axis.z).normalize();
        m.position.set(
          ring.cx + ax.x * spread,
          ring.cy + ax.y * spread,
          ring.cz + ax.z * spread
        );
        m.quaternion.setFromUnitVectors(ZAX, ax);
        const tight = lerp(1.14, 0.97, t.tighten);
        m.scale.set(ring.rx * tight, ring.ry * tight, 1);
        m.material = t.dyed ? this.matDyed : this.mat;
      }
    }
    for (let i = ties.length; i < this.items.length; i++) this.items[i].group.visible = false;
  }

  setDyed(v) {
    for (const it of this.items) {
      for (const m of it.rings) m.material = v ? this.matDyed : this.mat;
    }
  }

  clear() {
    for (const it of this.items) this.group.remove(it.group);
    this.items.length = 0;
  }
}

// ---------------------------------------------------------------------------
// 板締めの板
// ---------------------------------------------------------------------------

function shapeFor(name, r) {
  const s = new THREE.Shape();
  const poly = (n, rot = 0, inner = null) => {
    for (let i = 0; i <= n * (inner ? 2 : 1); i++) {
      const a = rot + (i / (n * (inner ? 2 : 1))) * TAU;
      const rr = inner ? (i % 2 === 0 ? r : r * inner) : r;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    s.closePath();
  };
  switch (name) {
    case 'square': s.moveTo(-r, -r); s.lineTo(r, -r); s.lineTo(r, r); s.lineTo(-r, r); s.closePath(); break;
    case 'diamond': poly(4, Math.PI / 4); break;
    case 'triangle': poly(3, Math.PI / 2); break;
    case 'hexagon': poly(6, 0); break;
    case 'star': poly(5, Math.PI / 2, 0.46); break;
    case 'circle':
    default: s.absarc(0, 0, r, 0, TAU, false); break;
  }
  return s;
}

export class BoardSet {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.items = [];
    this.matWood = new THREE.MeshStandardMaterial({ color: 0x8a6238, roughness: 0.72, metalness: 0.02 });
    this.matBand = new THREE.MeshStandardMaterial({ color: 0xb8544f, roughness: 0.55, metalness: 0.0 });
  }

  add(board, worldPos, sizeMetres, bundleH) {
    const shape = shapeFor(board.shape, sizeMetres);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 18 });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    const g = new THREE.Group();
    const top = new THREE.Mesh(geo, this.matWood);
    const bot = new THREE.Mesh(geo, this.matWood);
    top.castShadow = bot.castShadow = true;
    top.receiveShadow = bot.receiveShadow = true;
    g.add(top); g.add(bot);

    const bands = [];
    for (let k = 0; k < 2; k++) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(sizeMetres * 0.95, 0.0055, 5, 28), this.matBand);
      b.rotation.y = Math.PI / 2;
      b.rotation.x = 0;
      b.position.x = (k - 0.5) * sizeMetres * 0.9;
      bands.push(b);
      g.add(b);
    }
    g.position.copy(worldPos);
    g.rotation.y = board.rot;
    this.group.add(g);
    this.items.push({ board, group: g, top, bot, bands, h: bundleH, size: sizeMetres });
  }

  update() {
    for (const it of this.items) {
      const c = it.board.clamp;
      const gap = lerp(0.16, 0.006, c);
      const h = it.h * 0.5;
      it.top.position.y = h + gap;
      it.bot.position.y = -h - gap - 0.016;
      const open = lerp(0, 1, it.board.open || 0);
      it.top.position.y += open * 0.30;
      it.bot.position.y -= open * 0.10;
      it.group.visible = !it.board.gone;
      for (const b of it.bands) {
        b.visible = c > 0.4 && !(it.board.open > 0.05);
        b.scale.y = (h * 2 + gap * 2 + 0.032) / (it.size * 0.95 * 2);
      }
    }
  }

  clear() {
    for (const it of this.items) {
      this.group.remove(it.group);
      it.top.geometry.dispose();
    }
    this.items.length = 0;
  }
}

// ---------------------------------------------------------------------------
// 泡（藍甕のなか）
// ---------------------------------------------------------------------------

export class Bubbles {
  constructor(parent, count = 54) {
    const geo = new THREE.SphereGeometry(1, 8, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x93b6cf, roughness: 0.12, metalness: 0.0,
      transparent: true, opacity: 0.55, envMapIntensity: 1.6
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = count;
    parent.add(this.mesh);
    this.count = count;
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    this.r = new Float32Array(count);
    this.life = new Float32Array(count);
    this.rng = makeRng(4242);
    this.dummy = new THREE.Object3D();
    this.next = 0;
    for (let i = 0; i < count; i++) this.life[i] = 0;
  }

  spawn(x, y, z, spread, size) {
    const i = this.next % this.count;
    this.next++;
    const rng = this.rng;
    this.p[i * 3] = x + (rng() - 0.5) * spread;
    this.p[i * 3 + 1] = y + (rng() - 0.5) * 0.05;
    this.p[i * 3 + 2] = z + (rng() - 0.5) * spread;
    this.v[i * 3] = (rng() - 0.5) * 0.06;
    this.v[i * 3 + 1] = 0.10 + rng() * 0.18;
    this.v[i * 3 + 2] = (rng() - 0.5) * 0.06;
    this.r[i] = (size || 0.010) * (0.5 + rng());
    this.life[i] = 1;
    return i;
  }

  update(dt, surfaceY, onPop) {
    const d = this.dummy;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { d.position.set(0, -99, 0); d.scale.setScalar(0.0001); }
      else {
        this.p[i * 3] += this.v[i * 3] * dt;
        this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
        this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
        this.v[i * 3 + 1] += 0.10 * dt;
        this.life[i] -= dt * 0.32;
        if (this.p[i * 3 + 1] > surfaceY) {
          this.life[i] = 0;
          if (onPop) onPop(this.p[i * 3], this.p[i * 3 + 2], this.r[i]);
        }
        d.position.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
        d.scale.setScalar(this.r[i] * clamp01(this.life[i] * 2));
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset() { for (let i = 0; i < this.count; i++) this.life[i] = 0; }
}

// ---------------------------------------------------------------------------
// しずく
// ---------------------------------------------------------------------------

export class Drips {
  constructor(parent, count = 46) {
    const geo = new THREE.SphereGeometry(1, 7, 5);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2c4a74, roughness: 0.08, metalness: 0.0,
      transparent: true, opacity: 0.92, envMapIntensity: 2.0
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this.count = count;
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.r = new Float32Array(count);
    this.dummy = new THREE.Object3D();
    this.next = 0;
    this.rng = makeRng(777);
  }

  spawn(x, y, z, size) {
    const i = this.next % this.count;
    this.next++;
    const rng = this.rng;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = (rng() - 0.5) * 0.05;
    this.v[i * 3 + 1] = -0.02;
    this.v[i * 3 + 2] = (rng() - 0.5) * 0.05;
    this.r[i] = (size || 0.008) * (0.7 + rng() * 0.7);
    this.life[i] = 1;
  }

  update(dt, killY, onSplash) {
    const d = this.dummy;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { d.position.set(0, -99, 0); d.scale.setScalar(0.0001); }
      else {
        this.v[i * 3 + 1] -= 6.4 * dt;
        this.p[i * 3] += this.v[i * 3] * dt;
        this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
        this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
        if (this.p[i * 3 + 1] < killY) {
          this.life[i] = 0;
          if (onSplash) onSplash(this.p[i * 3], this.p[i * 3 + 2]);
        }
        const stretch = clamp01(-this.v[i * 3 + 1] * 0.55) + 1;
        d.position.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
        d.scale.set(this.r[i], this.r[i] * stretch, this.r[i]);
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset() { for (let i = 0; i < this.count; i++) this.life[i] = 0; }
}

// ---------------------------------------------------------------------------
// ふわっとした粒（風・藍のにごり・キラキラ）
// ---------------------------------------------------------------------------

function softSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class Puffs {
  constructor(parent, count = 90, color = 0xffffff, blending = THREE.NormalBlending) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const alpha = new Float32Array(count);
    const size = new Float32Array(count);
    const tint = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { pos[i * 3 + 1] = -99; alpha[i] = 0; size[i] = 1; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: softSprite() },
        uColor: { value: new THREE.Color(color) },
        uScale: { value: 700 }
      },
      transparent: true,
      depthWrite: false,
      blending,
      vertexShader: `
        attribute float aAlpha; attribute float aSize; attribute vec3 aTint;
        varying float vA; varying vec3 vT;
        uniform float uScale;
        void main(){
          vA = aAlpha; vT = aTint;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * uScale / max(0.001, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTex; uniform vec3 uColor;
        varying float vA; varying vec3 vT;
        void main(){
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(uColor * (0.6 + vT), t.a * vA);
          if(gl_FragColor.a < 0.004) discard;
        }
      `
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    parent.add(this.points);
    this.geo = geo;
    this.count = count;
    this.pos = pos; this.alpha = alpha; this.size = size; this.tint = tint;
    this.v = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.decay = new Float32Array(count);
    this.grow = new Float32Array(count);
    this.next = 0;
    this.rng = makeRng(31337);
  }

  spawn(x, y, z, vx, vy, vz, size, life, grow) {
    const i = this.next % this.count;
    this.next++;
    const rng = this.rng;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.size[i] = size;
    this.life[i] = 1;
    this.decay[i] = 1 / Math.max(0.15, life || 1);
    this.grow[i] = grow || 0;
    this.tint[i * 3] = rng() * 0.4;
    this.tint[i * 3 + 1] = rng() * 0.4;
    this.tint[i * 3 + 2] = rng() * 0.4;
    this.alpha[i] = 0;
  }

  update(dt, drag = 1.0) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt * this.decay[i];
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.pos[i * 3 + 1] = -99; continue; }
      this.pos[i * 3] += this.v[i * 3] * dt;
      this.pos[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const k = Math.pow(drag, dt * 60);
      this.v[i * 3] *= k; this.v[i * 3 + 1] *= k; this.v[i * 3 + 2] *= k;
      this.size[i] += this.grow[i] * dt;
      const l = this.life[i];
      this.alpha[i] = Math.sin(Math.min(1, l) * Math.PI) * 0.9;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aTint.needsUpdate = true;
  }

  reset() {
    for (let i = 0; i < this.count; i++) { this.life[i] = 0; this.alpha[i] = 0; this.pos[i * 3 + 1] = -99; }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}
