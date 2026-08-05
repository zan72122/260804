/**
 * つぶつぶ の えんしゅつ：とんだ つち・ほこり・キラキラ・かみふぶき
 */
import * as THREE from 'three';
import { clamp, lerp, roundedBox, matteMaterial } from './util.js';

function softCircleTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------------- とんだ つち ---------------- */

export class SoilParticles {
  constructor(scene, terrain, count = 220) {
    this.terrain = terrain;
    this.count = count;
    const geo = new THREE.IcosahedronGeometry(0.085, 0);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.95, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.count = count;
    scene.add(this.mesh);

    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.scale = new Float32Array(count);
    this.spin = new Float32Array(count * 3);
    this.rot = new Float32Array(count * 3);
    this.next = 0;

    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._pos = new THREE.Vector3();
    this._scl = new THREE.Vector3();
    this._col = new THREE.Color();
    for (let i = 0; i < count; i++) this.life[i] = 0;
    this._hideAll();
  }

  _hideAll() {
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.count; i++) this.mesh.setMatrixAt(i, m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn(x, y, z, vx, vy, vz, opts = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.count;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = opts.life ?? (0.9 + Math.random() * 0.7);
    this.scale[i] = opts.scale ?? (0.6 + Math.random() * 0.9);
    for (let k = 0; k < 3; k++) {
      this.spin[i * 3 + k] = (Math.random() - 0.5) * 12;
      this.rot[i * 3 + k] = Math.random() * 6.28;
    }
    const c = opts.color || '#7a5334';
    this._col.set(c).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
    this.mesh.setColorAt(i, this._col);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  burst(pos, n, opts = {}) {
    const spread = opts.spread ?? 1.6;
    const up = opts.up ?? 2.2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      this.spawn(
        pos.x + (Math.random() - 0.5) * 0.3,
        pos.y + Math.random() * 0.2,
        pos.z + (Math.random() - 0.5) * 0.3,
        Math.cos(a) * r + (opts.vx || 0),
        up * (0.4 + Math.random()) + (opts.vy || 0),
        Math.sin(a) * r + (opts.vz || 0),
        opts
      );
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const i3 = i * 3;
      this.v[i3 + 1] -= 13.5 * dt;
      this.p[i3] += this.v[i3] * dt;
      this.p[i3 + 1] += this.v[i3 + 1] * dt;
      this.p[i3 + 2] += this.v[i3 + 2] * dt;
      for (let k = 0; k < 3; k++) this.rot[i3 + k] += this.spin[i3 + k] * dt;

      const gh = this.terrain ? this.terrain.heightAt(this.p[i3], this.p[i3 + 2]) : 0;
      if (this.p[i3 + 1] < gh + 0.04) {
        this.p[i3 + 1] = gh + 0.04;
        this.v[i3] *= 0.4; this.v[i3 + 2] *= 0.4;
        this.v[i3 + 1] *= -0.22;
        if (Math.abs(this.v[i3 + 1]) < 0.4) { this.v[i3 + 1] = 0; this.life[i] = Math.min(this.life[i], 0.35); }
      }
      const fade = clamp(this.life[i] * 2.2, 0, 1);
      this._pos.set(this.p[i3], this.p[i3 + 1], this.p[i3 + 2]);
      this._e.set(this.rot[i3], this.rot[i3 + 1], this.rot[i3 + 2]);
      this._q.setFromEuler(this._e);
      this._scl.setScalar(this.scale[i] * fade);
      this._m.compose(this._pos, this._q, this._scl);
      this.mesh.setMatrixAt(i, this._m);
      if (this.life[i] <= 0) {
        this._m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._m);
      }
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.count; i++) this.life[i] = 0;
    this._hideAll();
  }
}

/* ---------------- ほこり（ふわっ） ---------------- */

export class DustPuffs {
  constructor(scene, count = 130) {
    this.count = count;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.col = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { map: { value: softCircleTexture() }, uHeight: { value: 800 } },
      vertexShader: /* glsl */`
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying float vA; varying vec3 vC;
        uniform float uHeight;
        void main() {
          vA = aAlpha; vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // がめんの たかさ と しゃえいぎょうれつ から じっさいの おおきさ を だす
          gl_PointSize = aSize * uHeight * projectionMatrix[1][1] * 0.5 / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D map;
        varying float vA; varying vec3 vC;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          if (vA <= 0.001) discard;
          gl_FragColor = vec4(vC, t.a * vA);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);

    this.v = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.baseSize = new Float32Array(count);
    this.next = 0;
    this.geo = geo;
  }

  spawn(x, y, z, opts = {}) {
    const i = this.next;
    this.next = (this.next + 1) % this.count;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    const sp = opts.spread ?? 0.5;
    this.v[i * 3] = (Math.random() - 0.5) * sp + (opts.vx || 0);
    this.v[i * 3 + 1] = (opts.vy ?? 0.5) + Math.random() * 0.4;
    this.v[i * 3 + 2] = (Math.random() - 0.5) * sp + (opts.vz || 0);
    this.maxLife[i] = this.life[i] = opts.life ?? (0.8 + Math.random() * 0.6);
    this.baseSize[i] = opts.size ?? (0.5 + Math.random() * 0.5);
    const c = new THREE.Color(opts.color || '#e6d5bd');
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
  }

  puff(pos, n = 4, opts = {}) {
    for (let i = 0; i < n; i++) {
      this.spawn(pos.x + (Math.random() - 0.5) * (opts.r ?? 0.5),
                 pos.y + Math.random() * 0.2,
                 pos.z + (Math.random() - 0.5) * (opts.r ?? 0.5), opts);
    }
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - clamp(this.life[i] / this.maxLife[i], 0, 1);
      this.pos[i * 3] += this.v[i * 3] * dt;
      this.pos[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.v[i * 3] *= 1 - dt * 1.1;
      this.v[i * 3 + 2] *= 1 - dt * 1.1;
      this.v[i * 3 + 1] = this.v[i * 3 + 1] * (1 - dt * 0.9) + dt * 0.25;
      this.size[i] = this.baseSize[i] * (0.5 + t * 1.5);
      this.alpha[i] = Math.sin(clamp(t, 0, 1) * Math.PI) * 0.55;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }

  clear() { for (let i = 0; i < this.count; i++) { this.life[i] = 0; this.alpha[i] = 0; } }
}

/* ---------------- かみふぶき ---------------- */

export class Confetti {
  constructor(scene, count = 160) {
    this.count = count;
    const geo = roundedBox(0.16, 0.02, 0.11, 0.01, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    this.rot = new Float32Array(count * 3);
    this.spin = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.active = false;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this.hide();
  }

  hide() {
    const m = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.count; i++) this.mesh.setMatrixAt(i, m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.active = false;
  }

  fire(center) {
    const colors = ['#ff6f91', '#ffd166', '#7ad4ff', '#9be36b', '#c39bff', '#fff1c1'];
    const c = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 7;
      this.p[i * 3] = center.x + Math.cos(a) * r;
      this.p[i * 3 + 1] = center.y + 5 + Math.random() * 5;
      this.p[i * 3 + 2] = center.z + Math.sin(a) * r * 0.6;
      this.v[i * 3] = (Math.random() - 0.5) * 1.4;
      this.v[i * 3 + 1] = -0.6 - Math.random() * 1.2;
      this.v[i * 3 + 2] = (Math.random() - 0.5) * 1.0;
      for (let k = 0; k < 3; k++) {
        this.rot[i * 3 + k] = Math.random() * 6.28;
        this.spin[i * 3 + k] = (Math.random() - 0.5) * 7;
      }
      this.life[i] = 4.5 + Math.random() * 3;
      c.set(colors[i % colors.length]);
      this.mesh.setColorAt(i, c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    let alive = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) { continue; }
      this.life[i] -= dt;
      alive++;
      const i3 = i * 3;
      this.v[i3 + 1] -= 1.1 * dt;
      this.v[i3 + 1] = Math.max(this.v[i3 + 1], -2.2);
      this.p[i3] += (this.v[i3] + Math.sin(this.rot[i3 + 1]) * 0.6) * dt;
      this.p[i3 + 1] += this.v[i3 + 1] * dt;
      this.p[i3 + 2] += this.v[i3 + 2] * dt;
      for (let k = 0; k < 3; k++) this.rot[i3 + k] += this.spin[i3 + k] * dt;
      if (this.p[i3 + 1] < 0.03) { this.life[i] = 0; }
      this._v.set(this.p[i3], this.p[i3 + 1], this.p[i3 + 2]);
      this._e.set(this.rot[i3], this.rot[i3 + 1], this.rot[i3 + 2]);
      this._q.setFromEuler(this._e);
      this._m.compose(this._v, this._q, this.life[i] > 0 ? this._s : new THREE.Vector3(0, 0, 0));
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (alive === 0) this.active = false;
  }
}
