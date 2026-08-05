/**
 * きらめきの粒。掃除できた瞬間の「できた！」を目で伝える役。
 */
import * as THREE from 'three';
import { makeSparkleTexture } from '../core/util.js';

export class Sparkles {
  constructor(scene, capacity = 260) {
    this.capacity = capacity;
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.tint = new Float32Array(capacity * 3);
    for (let i = 0; i < capacity; i++) this.positions[i * 3 + 1] = -999;

    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(this.tint, 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: makeSparkleTexture(128) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute float aSize;
        attribute vec3 aTint;
        uniform float uPixelRatio;
        varying float vLife;
        varying vec3 vTint;
        void main() {
          vLife = aLife;
          vTint = aTint;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float grow = sin(clamp(aLife, 0.0, 1.0) * 3.14159);
          gl_PointSize = aSize * uPixelRatio * grow * (330.0 / max(-mv.z, 0.001));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vLife;
        varying vec3 vTint;
        void main() {
          if (vLife <= 0.0) discard;
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vTint, t.a * clamp(vLife, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 14;
    scene.add(this.points);
    this._cursor = 0;
  }

  spawn(x, y, z, opts = {}) {
    const i = this._cursor;
    this._cursor = (this._cursor + 1) % this.capacity;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    const spread = opts.spread ?? 0.5;
    this.vel[i * 3] = (Math.random() - 0.5) * spread;
    this.vel[i * 3 + 1] = (Math.random() - 0.2) * spread;
    this.vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
    this.maxLife[i] = opts.life ?? 0.9 + Math.random() * 0.6;
    this.life[i] = this.maxLife[i];
    this.size[i] = opts.size ?? 0.12 + Math.random() * 0.16;
    const c = opts.color ?? [1, 1, 1];
    this.tint[i * 3] = c[0]; this.tint[i * 3 + 1] = c[1]; this.tint[i * 3 + 2] = c[2];
  }

  burst(x, y, z, n = 8, opts = {}) {
    for (let i = 0; i < n; i++) this.spawn(x, y, z, opts);
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += (this.vel[i * 3 + 1] + 0.25) * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.life[i] <= 0) this.positions[i * 3 + 1] = -999;
    }
    // 生きている粒がある間だけ転送する
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.aLife.needsUpdate = true;
    this.points.geometry.attributes.aSize.needsUpdate = any;
    this.points.geometry.attributes.aTint.needsUpdate = any;
  }
}
