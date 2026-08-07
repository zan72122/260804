// One pooled particle system, used for clay shavings, sparks, steam, smoke,
// rubble and the dust that hangs in the light shafts.

import * as THREE from '../core/three.js';
import { makeDotTexture } from './materials.js';

const VERT = `
attribute float aSize;
attribute vec4 aColor;
varying vec4 vColor;
void main(){
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * ( 300.0 / max( 0.001, -mv.z ) );
}`;

const FRAG = `
uniform sampler2D uMap;
varying vec4 vColor;
void main(){
  vec4 t = texture2D( uMap, gl_PointCoord );
  if ( t.a < 0.02 ) discard;
  gl_FragColor = vec4( vColor.rgb, vColor.a * t.a );
  #include <colorspace_fragment>
}`;

export class ParticlePool {
  constructor(scene, { max = 420, additive = false, soft = 0.45, renderOrder = 0 } = {}) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.siz = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4);
    this.c1 = new Float32Array(max * 4);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.siz, 1));
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 40);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: makeDotTexture(soft) } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
    scene.add(this.points);
    this.geo = geo;
  }

  /**
   * @param {object} o
   * @param {THREE.Vector3|{x,y,z}} o.p position
   * @param {{x,y,z}} o.v velocity
   * @param {number} o.life seconds
   * @param {number[]} o.color0 rgba 0..1
   * @param {number[]} o.color1 rgba 0..1 (end)
   * @param {number} o.size0 / o.size1
   * @param {number} o.gravity m/s^2 (positive = falls)
   * @param {number} o.drag per-second velocity damping
   */
  spawn(o) {
    let i;
    if (this.n < this.max) i = this.n++;
    else {
      // recycle the oldest-looking slot
      i = (this._rr = ((this._rr | 0) + 1) % this.max);
    }
    const p = o.p, v = o.v || { x: 0, y: 0, z: 0 };
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.life[i] = 0;
    this.maxLife[i] = o.life ?? 1;
    this.grav[i] = o.gravity ?? 0;
    this.drag[i] = o.drag ?? 0.6;
    this.s0[i] = o.size0 ?? 0.1;
    this.s1[i] = o.size1 ?? this.s0[i];
    const c0 = o.color0 || [1, 1, 1, 1], c1 = o.color1 || [c0[0], c0[1], c0[2], 0];
    for (let k = 0; k < 4; k++) { this.c0[i * 4 + k] = c0[k]; this.c1[i * 4 + k] = c1[k]; }
    this.spin[i] = o.turbulence ?? 0;
    return i;
  }

  update(dt) {
    const n = this.n;
    if (!n) return;
    for (let i = 0; i < n; i++) {
      if (this.maxLife[i] <= 0) continue;
      this.life[i] += dt;
      const u = this.life[i] / this.maxLife[i];
      if (u >= 1) {
        this.maxLife[i] = 0;
        this.col[i * 4 + 3] = 0; this.siz[i] = 0;
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      let vx = this.vel[i * 3] * d;
      let vy = (this.vel[i * 3 + 1] - this.grav[i] * dt) * d;
      let vz = this.vel[i * 3 + 2] * d;
      if (this.spin[i]) {
        const t = this.life[i] * 2.2 + i;
        vx += Math.sin(t) * this.spin[i] * dt * 6;
        vz += Math.cos(t * 1.3) * this.spin[i] * dt * 6;
        vy += Math.sin(t * 0.7) * this.spin[i] * dt * 3;
      }
      this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
      this.pos[i * 3] += vx * dt; this.pos[i * 3 + 1] += vy * dt; this.pos[i * 3 + 2] += vz * dt;
      this.siz[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * u;
      for (let k = 0; k < 4; k++) {
        this.col[i * 4 + k] = this.c0[i * 4 + k] + (this.c1[i * 4 + k] - this.c0[i * 4 + k]) * u;
      }
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.n; i++) { this.maxLife[i] = 0; this.col[i * 4 + 3] = 0; this.siz[i] = 0; }
    this.n = 0;
    this.geo.setDrawRange(0, 0);
  }
}

/** convenience presets ------------------------------------------------ */

export const FX = {
  claySpeck: (p, v) => ({
    p, v, life: 0.7 + Math.random() * 0.5, gravity: 5.5, drag: 0.9,
    size0: 0.035 + Math.random() * 0.03, size1: 0.02,
    color0: [0.55, 0.5, 0.44, 0.95], color1: [0.4, 0.36, 0.32, 0],
  }),
  redSpeck: (p, v) => ({
    p, v, life: 0.7 + Math.random() * 0.5, gravity: 5.5, drag: 0.9,
    size0: 0.035 + Math.random() * 0.03, size1: 0.02,
    color0: [0.72, 0.42, 0.28, 0.95], color1: [0.5, 0.3, 0.2, 0],
  }),
  mudSpeck: (p, v) => ({
    p, v, life: 0.6 + Math.random() * 0.4, gravity: 6.5, drag: 1.0,
    size0: 0.03 + Math.random() * 0.03, size1: 0.015,
    color0: [0.42, 0.36, 0.29, 0.9], color1: [0.34, 0.29, 0.24, 0],
  }),
  spark: (p, v) => ({
    p, v, life: 0.5 + Math.random() * 0.9, gravity: 4.0, drag: 0.5,
    size0: 0.028 + Math.random() * 0.03, size1: 0.004,
    color0: [1.0, 0.92, 0.6, 1], color1: [1.0, 0.35, 0.06, 0],
  }),
  emberFloat: (p, v) => ({
    p, v, life: 1.6 + Math.random() * 1.6, gravity: -0.5, drag: 0.35,
    size0: 0.02 + Math.random() * 0.02, size1: 0.005,
    color0: [1.0, 0.6, 0.22, 0.9], color1: [0.8, 0.2, 0.05, 0],
    turbulence: 0.35,
  }),
  smoke: (p, v) => ({
    p, v, life: 2.4 + Math.random() * 2.2, gravity: -0.55, drag: 0.5,
    size0: 0.16 + Math.random() * 0.14, size1: 0.9 + Math.random() * 0.6,
    color0: [0.42, 0.38, 0.35, 0.34], color1: [0.3, 0.28, 0.27, 0],
    turbulence: 0.22,
  }),
  steam: (p, v) => ({
    p, v, life: 1.6 + Math.random() * 1.4, gravity: -0.9, drag: 0.6,
    size0: 0.12, size1: 0.6 + Math.random() * 0.4,
    color0: [0.85, 0.83, 0.8, 0.28], color1: [0.8, 0.8, 0.8, 0],
    turbulence: 0.2,
  }),
  dustCloud: (p, v) => ({
    p, v, life: 2.0 + Math.random() * 2.4, gravity: -0.1, drag: 0.9,
    size0: 0.22 + Math.random() * 0.3, size1: 1.5 + Math.random() * 1.2,
    color0: [0.66, 0.58, 0.48, 0.5], color1: [0.6, 0.55, 0.48, 0],
    turbulence: 0.3,
  }),
  mote: (p, v) => ({
    p, v, life: 5 + Math.random() * 6, gravity: 0.02, drag: 0.15,
    size0: 0.012 + Math.random() * 0.014, size1: 0.012,
    color0: [1.0, 0.9, 0.75, 0.0], color1: [1.0, 0.9, 0.75, 0.0],
    turbulence: 0.09,
  }),
};
