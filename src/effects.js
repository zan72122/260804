// 舞台効果3種類：花びら・しゃぼん玉・きらきら
import * as THREE from '../vendor/three.module.min.js';
import { rand, clamp, lerp, smoothstep } from './util.js';
import { petalSprite, bubbleSprite, sparkleSprite } from './textures.js';

export const EFFECT_IDS = ['petal', 'bubble', 'sparkle'];

const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

class Petals {
  constructor(max = 160) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(0.26, 0.34);
    const mat = new THREE.MeshStandardMaterial({
      map: petalSprite(), transparent: true, side: THREE.DoubleSide,
      roughness: 0.62, metalness: 0, depthWrite: false,
      emissive: 0xff9ec4, emissiveIntensity: 0.18,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.count = max;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.items = [];
    for (let i = 0; i < max; i++) this.items.push({ alive: false });
    this._hideAll();
  }
  _hideAll() {
    _dummy.position.set(0, -999, 0);
    _dummy.scale.setScalar(0.0001);
    _dummy.updateMatrix();
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, _dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  burst(n = 46, opts = {}) {
    const tints = [0xffffff, 0xffd9e8, 0xffe9f2, 0xffc0d8, 0xfff0c0];
    let spawned = 0;
    for (let idx = 0; idx < this.max; idx++) {
      const it = this.items[idx];
      if (spawned >= n) break;
      if (it.alive) continue;
      it.alive = true;
      it.life = 0;
      it.max = rand(4.5, 8.0);
      it.pos = new THREE.Vector3(
        opts.x !== undefined ? opts.x + rand(-1.2, 1.2) : rand(-6.2, 6.2),
        opts.y !== undefined ? opts.y : rand(8.0, 11.0),
        opts.z !== undefined ? opts.z + rand(-1.2, 1.2) : rand(-8.0, -0.6)
      );
      it.vel = new THREE.Vector3(rand(-0.25, 0.25), rand(-0.75, -0.35), rand(-0.12, 0.12));
      it.rot = new THREE.Vector3(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));
      it.spin = new THREE.Vector3(rand(-2.4, 2.4), rand(-2.2, 2.2), rand(-1.6, 1.6));
      it.phase = rand(0, 6.3);
      it.freq = rand(1.0, 2.2);
      it.size = rand(0.75, 1.5);
      _col.setHex(tints[(Math.random() * tints.length) | 0]);
      this.mesh.setColorAt(idx, _col);
      spawned++;
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const it = this.items[i];
      if (!it.alive) continue;
      any = true;
      it.life += dt;
      // ひらひら
      const flutter = Math.sin(it.life * it.freq * 3.0 + it.phase);
      it.vel.x += flutter * 0.55 * dt;
      it.vel.z += Math.cos(it.life * it.freq * 2.2 + it.phase) * 0.35 * dt;
      it.vel.y += (-0.5 - it.vel.y) * 0.8 * dt;
      it.pos.addScaledVector(it.vel, dt);
      it.rot.x += it.spin.x * dt;
      it.rot.y += it.spin.y * dt + flutter * dt * 2.0;
      it.rot.z += it.spin.z * dt;
      const fade = smoothstep(0, 0.35, it.life) * (1 - smoothstep(it.max - 1.2, it.max, it.life));
      if (it.life > it.max || it.pos.y < -0.4) { it.alive = false; }
      _dummy.position.copy(it.pos);
      _dummy.rotation.set(it.rot.x, it.rot.y, it.rot.z);
      _dummy.scale.setScalar(it.alive ? it.size * fade : 0.0001);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

class PointCloud {
  constructor(max, map, { additive = true, size = 1, gravity = 0 } = {}) {
    this.max = max;
    this.gravity = gravity;
    const pos = new Float32Array(max * 3);
    const aSize = new Float32Array(max);
    const aAlpha = new Float32Array(max);
    const aTint = new Float32Array(max * 3);
    for (let i = 0; i < max; i++) pos[i * 3 + 1] = -999;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1));
    g.setAttribute('aTint', new THREE.BufferAttribute(aTint, 3));
    this.geom = g;
    this.attrs = { pos, aSize, aAlpha, aTint };
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uScale: { value: size * 320 } },
      vertexShader: /* glsl */`
        attribute float aSize; attribute float aAlpha; attribute vec3 aTint;
        uniform float uScale;
        varying float vAlpha; varying vec3 vTint;
        void main(){
          vAlpha = aAlpha; vTint = aTint;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uScale * aSize / max(0.5, -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap;
        varying float vAlpha; varying vec3 vTint;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          if (t.a * vAlpha < 0.004) discard;
          gl_FragColor = vec4(t.rgb * vTint, t.a * vAlpha);
        }
      `,
      transparent: true, depthWrite: false, toneMapped: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.items = [];
    for (let i = 0; i < max; i++) this.items.push({ alive: false });
  }
  _spawn(i, o) {
    const it = this.items[i];
    it.alive = true;
    it.life = 0;
    Object.assign(it, o);
    const a = this.attrs;
    a.aTint[i * 3] = o.tint[0]; a.aTint[i * 3 + 1] = o.tint[1]; a.aTint[i * 3 + 2] = o.tint[2];
  }
  update(dt) {
    const a = this.attrs;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const it = this.items[i];
      if (!it.alive) { a.aAlpha[i] = 0; continue; }
      any = true;
      it.life += dt;
      it.vel.y += this.gravity * dt;
      if (it.wobble) {
        it.vel.x += Math.sin(it.life * it.freq * 2.4 + it.phase) * it.wobble * dt;
        it.vel.z += Math.cos(it.life * it.freq * 1.8 + it.phase) * it.wobble * dt;
      }
      if (it.drag) it.vel.multiplyScalar(1 - it.drag * dt);
      it.pos.addScaledVector(it.vel, dt);
      const k = it.life / it.max;
      if (k >= 1 || it.pos.y < -0.5) { it.alive = false; a.aAlpha[i] = 0; if (it.onEnd) it.onEnd(it); continue; }
      const fade = smoothstep(0, 0.12, k) * (1 - smoothstep(0.7, 1, k));
      a.pos[i * 3] = it.pos.x; a.pos[i * 3 + 1] = it.pos.y; a.pos[i * 3 + 2] = it.pos.z;
      a.aSize[i] = it.size * (it.grow ? lerp(0.6, 1.25, k) : 1);
      a.aAlpha[i] = fade * (it.twinkle ? (0.55 + 0.45 * Math.sin(it.life * 14 + it.phase)) : 1);
    }
    if (any || this._dirty) {
      this.geom.attributes.position.needsUpdate = true;
      this.geom.attributes.aSize.needsUpdate = true;
      this.geom.attributes.aAlpha.needsUpdate = true;
      this.geom.attributes.aTint.needsUpdate = true;
    }
    this._dirty = any;
  }
  freeIndex() {
    for (let i = 0; i < this.max; i++) if (!this.items[i].alive) return i;
    return -1;
  }
}

export class Effects {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.petals = new Petals(160);
    this.group.add(this.petals.mesh);

    this.bubbles = new PointCloud(140, bubbleSprite(), { additive: false, size: 1.5, gravity: 0.0 });
    this.group.add(this.bubbles.points);

    this.sparkles = new PointCloud(240, sparkleSprite(), { additive: true, size: 1.0, gravity: -0.35 });
    this.group.add(this.sparkles.points);

    this.onBubblePop = null;
  }

  petalBurst(opts) { this.petals.burst(opts && opts.n || 44, opts || {}); }

  bubbleBurst({ n = 26, x = null, z = null } = {}) {
    for (let i = 0; i < n; i++) {
      const idx = this.bubbles.freeIndex();
      if (idx < 0) break;
      const px = x === null ? rand(-6, 6) : x + rand(-1.6, 1.6);
      const pz = z === null ? rand(-7.5, -0.5) : z + rand(-1.2, 1.2);
      this.bubbles._spawn(idx, {
        pos: new THREE.Vector3(px, rand(0.1, 0.6), pz),
        vel: new THREE.Vector3(rand(-0.15, 0.15), rand(0.55, 1.25), rand(-0.1, 0.1)),
        size: rand(0.30, 0.85), max: rand(4.5, 8.5), phase: rand(0, 6.3), freq: rand(0.6, 1.6),
        wobble: 0.55, drag: 0.18, grow: true,
        tint: [1, 1, 1],
      });
    }
  }

  sparkleBurst({ n = 40, x = 0, y = 1.4, z = -3, spread = 1.2, up = 2.6, tint = [1, 0.95, 0.8] } = {}) {
    for (let i = 0; i < n; i++) {
      const idx = this.sparkles.freeIndex();
      if (idx < 0) break;
      const a = rand(0, Math.PI * 2), r = rand(0, spread);
      this.sparkles._spawn(idx, {
        pos: new THREE.Vector3(x + Math.cos(a) * r, y + rand(-0.4, 0.8), z + Math.sin(a) * r * 0.7),
        vel: new THREE.Vector3(Math.cos(a) * rand(0.3, 1.5), rand(0.6, 1) * up, Math.sin(a) * rand(0.3, 1.2)),
        size: rand(0.25, 0.8), max: rand(1.1, 2.4), phase: rand(0, 6.3),
        drag: 0.9, twinkle: true, tint,
      });
    }
  }

  // 拍手のときの、盛大なやつ
  celebrate(theme) {
    this.petalBurst({ n: 90 });
    this.bubbleBurst({ n: 34 });
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.sparkleBurst({
        n: 34, x: rand(-5, 5), y: rand(2, 6), z: rand(-6, -1), spread: 1.6, up: 1.4,
      }), i * 260);
    }
  }

  update(dt) {
    this.petals.update(dt);
    this.bubbles.update(dt);
    this.sparkles.update(dt);
  }
}
