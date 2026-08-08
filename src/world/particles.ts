/**
 * One pooled Points system for bubbles, droplets, foam rings and drifting
 * leaves. A single draw call, a fixed allocation, and no garbage — the pool
 * simply refuses to spawn once it is full, which is the correct behaviour on
 * a phone (the twentieth simultaneous droplet adds nothing).
 */

import * as THREE from 'three';

export const enum PKind {
  Bubble = 0,
  Droplet = 1,
  Foam = 2,
  Leaf = 3,
  Spark = 4,
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aLife;      // 0..1 remaining
  attribute vec3  aColor;
  attribute float aKind;
  varying float vLife;
  varying vec3 vColor;
  varying float vKind;
  uniform float uPixelScale;
  void main() {
    vLife = aLife;
    vColor = aColor;
    vKind = aKind;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // foam rings spread as they fade
    float grow = aKind > 1.5 && aKind < 2.5 ? (1.0 + (1.0 - aLife) * 2.2) : 1.0;
    // aSize is a world-space diameter; uPixelScale converts it to pixels at
    // one unit of depth. Capped so nothing can ever flood the screen.
    gl_PointSize = clamp(aSize * grow * uPixelScale / max(-mv.z, 0.25), 1.0, 110.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying float vLife;
  varying vec3 vColor;
  varying float vKind;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float alpha;
    vec3 col = vColor;
    if (vKind > 1.5 && vKind < 2.5) {
      // foam ring
      float ring = smoothstep(0.5, 0.34, d) * smoothstep(0.16, 0.32, d);
      alpha = ring * vLife * 0.8;
    } else if (vKind < 0.5) {
      // bubble: bright rim, hollow middle
      float rim = smoothstep(0.5, 0.36, d);
      float core = smoothstep(0.30, 0.44, d);
      alpha = rim * (0.34 + core * 0.66) * vLife;
      col += vec3(0.22) * core;
    } else {
      alpha = smoothstep(0.5, 0.1, d) * vLife;
    }
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Particles {
  readonly points: THREE.Points;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.ShaderMaterial;

  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly size: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly color: Float32Array;
  private readonly kind: Float32Array;
  private alive = 0;
  private readonly free: number[] = [];
  private readonly index: Int32Array;

  constructor(capacity: number) {
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.color = new Float32Array(capacity * 3);
    this.kind = new Float32Array(capacity);
    this.index = new Int32Array(capacity);
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(capacity), 1));
    this.geo.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(capacity), 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
    this.geo.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(capacity), 1));
    this.geo.setDrawRange(0, 0);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);

    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPixelScale: { value: 420 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    this.points.name = 'particles';
  }

  /** Recompute the world-units-to-pixels factor from the live projection. */
  setProjection(heightPx: number, fovDeg: number): void {
    const f = (heightPx * 0.5) / Math.tan((fovDeg * Math.PI) / 360);
    this.mat.uniforms.uPixelScale.value = f;
  }

  spawn(
    kind: PKind,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    life: number,
    color: THREE.Color,
  ): void {
    const i = this.free.pop();
    if (i === undefined) return;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.color[i * 3] = color.r;
    this.color[i * 3 + 1] = color.g;
    this.color[i * 3 + 2] = color.b;
    this.kind[i] = kind;
    this.index[this.alive++] = i;
  }

  get used(): number {
    return this.alive;
  }

  update(dt: number, waterLevel: number): void {
    const posAttr = this.geo.attributes.position as THREE.BufferAttribute;
    const sizeAttr = this.geo.attributes.aSize as THREE.BufferAttribute;
    const lifeAttr = this.geo.attributes.aLife as THREE.BufferAttribute;
    const colAttr = this.geo.attributes.aColor as THREE.BufferAttribute;
    const kindAttr = this.geo.attributes.aKind as THREE.BufferAttribute;
    const pa = posAttr.array as Float32Array;
    const sa = sizeAttr.array as Float32Array;
    const la = lifeAttr.array as Float32Array;
    const ca = colAttr.array as Float32Array;
    const ka = kindAttr.array as Float32Array;

    let w = 0;
    for (let n = 0; n < this.alive; n++) {
      const i = this.index[n];
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.free.push(i);
        continue;
      }
      const k = this.kind[i];
      const i3 = i * 3;
      if (k === PKind.Bubble) {
        this.vel[i3 + 1] += 1.6 * dt;
        this.vel[i3] += Math.sin(this.life[i] * 9 + i) * 0.3 * dt;
        // a bubble dies the moment it reaches air
        if (this.pos[i3 + 1] > waterLevel) this.life[i] = Math.min(this.life[i], 0.06);
      } else if (k === PKind.Droplet) {
        this.vel[i3 + 1] -= 9.4 * dt;
        if (this.pos[i3 + 1] < waterLevel) this.life[i] = Math.min(this.life[i], 0.05);
      } else if (k === PKind.Foam) {
        this.vel[i3] *= 1 - 1.6 * dt;
        this.vel[i3 + 2] *= 1 - 1.6 * dt;
        this.pos[i3 + 1] = waterLevel + 0.02;
      } else if (k === PKind.Leaf) {
        this.vel[i3 + 1] -= 1.1 * dt;
        this.pos[i3 + 1] = Math.max(this.pos[i3 + 1], waterLevel + 0.03);
        this.vel[i3] *= 1 - 0.8 * dt;
        this.vel[i3 + 2] *= 1 - 0.8 * dt;
      } else {
        this.vel[i3 + 1] -= 2.4 * dt;
      }
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;

      pa[w * 3] = this.pos[i3];
      pa[w * 3 + 1] = this.pos[i3 + 1];
      pa[w * 3 + 2] = this.pos[i3 + 2];
      sa[w] = this.size[i];
      la[w] = Math.min(1, this.life[i] / this.maxLife[i]);
      ca[w * 3] = this.color[i3];
      ca[w * 3 + 1] = this.color[i3 + 1];
      ca[w * 3 + 2] = this.color[i3 + 2];
      ka[w] = k;
      this.index[w] = i;
      w++;
    }
    this.alive = w;
    this.geo.setDrawRange(0, w);
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    lifeAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    kindAttr.needsUpdate = true;
  }

  clear(): void {
    for (let n = 0; n < this.alive; n++) this.free.push(this.index[n]);
    this.alive = 0;
    this.geo.setDrawRange(0, 0);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
