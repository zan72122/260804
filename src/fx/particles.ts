import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { makeRng, randRange, TAU } from '../core/util';

interface PoolOpts {
  count: number;
  gravity: number;
  drag: number;
  additive: boolean;
  colorA: [number, number, number];
  colorB: [number, number, number];
  /** Kill particles once they cross y = 0 going the wrong way. */
  killBelowSurface?: boolean;
  killAboveSurface?: boolean;
  sizeScale: number;
}

/** One GPU-friendly particle pool; the whole game uses three of them. */
export class ParticlePool {
  readonly points: Points;
  private mat: ShaderMaterial;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private seed: Float32Array;
  private alphaAttr: BufferAttribute;
  private sizeAttr: BufferAttribute;
  private cursor = 0;
  private o: PoolOpts;
  private rng = makeRng(31337);

  constructor(o: PoolOpts) {
    this.o = o;
    const n = o.count;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(1);
    this.life = new Float32Array(n);
    this.seed = new Float32Array(n);
    const sizes = new Float32Array(n);
    const alphas = new Float32Array(n);
    for (let i = 0; i < n; i++) this.seed[i] = randRange(this.rng, 0, TAU);

    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.sizeAttr = new BufferAttribute(sizes, 1);
    this.alphaAttr = new BufferAttribute(alphas, 1);
    g.setAttribute('aSize', this.sizeAttr);
    g.setAttribute('aAlpha', this.alphaAttr);
    g.boundingSphere = null;

    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: o.additive ? AdditiveBlending : NormalBlending,
      uniforms: {
        uScale: { value: 300 },
        uA: { value: o.colorA },
        uB: { value: o.colorB },
      },
      vertexShader: `
        attribute float aSize; attribute float aAlpha;
        varying float vA; uniform float uScale;
        void main() {
          vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(-mv.z, 0.5);
        }
      `,
      fragmentShader: `
        varying float vA; uniform vec3 uA; uniform vec3 uB;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.12, r);
          vec3 c = mix(uB, uA, smoothstep(0.42, 0.0, r));
          gl_FragColor = vec4(c, a * vA);
        }
      `,
    });
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 24;
  }

  emit(
    origin: Vector3,
    count: number,
    speed: number,
    spread: number,
    up: number,
    size: number,
    life: number,
    scatter = 0.06,
  ): void {
    const n = this.o.count;
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % n;
      const a = randRange(this.rng, 0, TAU);
      const r = randRange(this.rng, 0, 1);
      const j = i * 3;
      this.pos[j] = origin.x + Math.cos(a) * r * scatter;
      this.pos[j + 1] = origin.y + randRange(this.rng, -scatter, scatter);
      this.pos[j + 2] = origin.z + Math.sin(a) * r * scatter;
      const sp = speed * randRange(this.rng, 0.45, 1.25);
      this.vel[j] = Math.cos(a) * sp * spread;
      this.vel[j + 1] = up * randRange(this.rng, 0.5, 1.35);
      this.vel[j + 2] = Math.sin(a) * sp * spread;
      this.age[i] = 0;
      this.life[i] = life * randRange(this.rng, 0.6, 1.3);
      (this.sizeAttr.array as Float32Array)[i] = size * randRange(this.rng, 0.6, 1.5);
    }
    this.sizeAttr.needsUpdate = true;
  }

  update(dt: number, dprScale: number): void {
    const n = this.o.count;
    const al = this.alphaAttr.array as Float32Array;
    for (let i = 0; i < n; i++) {
      if (this.age[i] >= this.life[i]) {
        al[i] = 0;
        continue;
      }
      this.age[i] += dt;
      const j = i * 3;
      this.vel[j + 1] += this.o.gravity * dt;
      const d = Math.pow(this.o.drag, dt * 60);
      this.vel[j] *= d;
      this.vel[j + 1] *= d;
      this.vel[j + 2] *= d;
      // Bubbles wobble as they rise; droplets don't.
      if (this.o.killAboveSurface) {
        this.vel[j] += Math.sin(this.age[i] * 6 + this.seed[i]) * dt * 0.25;
        this.vel[j + 2] += Math.cos(this.age[i] * 5 + this.seed[i]) * dt * 0.22;
      }
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;

      const y = this.pos[j + 1];
      if (this.o.killBelowSurface && y < 0) this.age[i] = this.life[i];
      if (this.o.killAboveSurface && y > 0) this.age[i] = this.life[i];

      const t = this.age[i] / this.life[i];
      al[i] = Math.max(0, 1 - t * t);
    }
    this.alphaAttr.needsUpdate = true;
    (this.points.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    this.mat.uniforms.uScale.value = 300 * dprScale;
  }
}

/** White water thrown up when something breaks the surface. */
export function makeSplash(): ParticlePool {
  return new ParticlePool({
    count: 260,
    gravity: -7.5,
    drag: 0.985,
    additive: false,
    colorA: [1.0, 0.96, 0.9],
    colorB: [0.62, 0.76, 0.95],
    killBelowSurface: true,
    sizeScale: 1,
  });
}

/** Air escaping a diving bird's plumage. */
export function makeBubbles(): ParticlePool {
  return new ParticlePool({
    count: 240,
    gravity: 1.35,
    drag: 0.99,
    additive: true,
    colorA: [0.85, 0.93, 1.0],
    colorB: [0.3, 0.52, 0.78],
    killAboveSurface: true,
    sizeScale: 1,
  });
}

/** Fine spray lit orange by the kagaribi. */
export function makeSpray(): ParticlePool {
  return new ParticlePool({
    count: 220,
    gravity: -6.2,
    drag: 0.975,
    additive: true,
    colorA: [1.0, 0.86, 0.62],
    colorB: [0.8, 0.5, 0.24],
    killBelowSurface: true,
    sizeScale: 1,
  });
}
