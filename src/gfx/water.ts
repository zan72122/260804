/**
 * The warm water bath surface.
 *
 * No fluid simulation: a couple of crossing sine fields for the resting
 * surface, plus a small ring buffer of analytic circular ripples. Each ripple
 * contributes both its height and its gradient in one evaluation, so the
 * normal is exact and costs one pass.
 */
import * as THREE from 'three';
import { registerLit } from './materials';

const MAX_RIPPLES_HIGH = 8;
const MAX_RIPPLES_LOW = 4;

export class Water {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  private ripples: THREE.Vector4[] = [];
  private next = 0;
  private max: number;
  private t = 0;

  /** @param size world size of the (square) bath surface */
  constructor(size: number, quality: 'low' | 'high') {
    this.max = quality === 'high' ? MAX_RIPPLES_HIGH : MAX_RIPPLES_LOW;
    for (let i = 0; i < this.max; i++) this.ripples.push(new THREE.Vector4(0, 0, -99, 0));

    const geo = new THREE.PlaneGeometry(size, size, 1, 1);
    geo.rotateX(-Math.PI / 2);

    this.mat = registerLit(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uLight: { value: 1 },
        uTime: { value: 0 },
        uRipples: { value: this.ripples },
        uWarm: { value: 1 },      // gentle convection shimmer of a heated bath
        uOpacity: { value: 1 },
      },
      defines: { N_RIPPLES: this.max },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vV;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uLight, uTime, uWarm, uOpacity;
        uniform vec4 uRipples[N_RIPPLES];
        varying vec2 vUv; varying vec3 vV;

        void field(vec2 p, out float h, out vec2 g) {
          h = 0.0; g = vec2(0.0);
          // resting surface: two slow crossing swells
          float a1 = dot(p, vec2(0.92, 0.39)) * 11.0 + uTime * 0.9;
          float a2 = dot(p, vec2(-0.31, 0.95)) * 15.0 - uTime * 0.65;
          h += sin(a1) * 0.16 + sin(a2) * 0.11;
          g += vec2(0.92, 0.39) * 11.0 * cos(a1) * 0.16;
          g += vec2(-0.31, 0.95) * 15.0 * cos(a2) * 0.11;
          // convection wobble from the heater
          float a3 = (p.x * 7.0 + sin(p.y * 5.0 + uTime * 0.5) * 2.0) + uTime * 0.4;
          h += sin(a3) * 0.05 * uWarm;
          g += vec2(7.0, 0.0) * cos(a3) * 0.05 * uWarm;

          for (int i = 0; i < N_RIPPLES; i++) {
            vec4 r = uRipples[i];
            float age = uTime - r.z;
            if (age < 0.0 || age > 3.2 || r.w <= 0.0) continue;
            vec2 dv = p - r.xy;
            float d = length(dv) + 1e-4;
            float front = d - age * 0.55;
            float env = exp(-front * front * 260.0) * exp(-age * 1.35) * r.w;
            float k = 78.0;
            h += sin(front * k) * env;
            float dh = k * cos(front * k) * env + sin(front * k) * env * (-520.0 * front);
            g += (dv / d) * dh;
          }
        }

        void main() {
          vec2 p = vUv - 0.5;
          float h; vec2 g;
          field(p, h, g);
          vec3 N = normalize(vec3(-g.x * 0.012, 1.0, -g.y * 0.012));

          vec3 V = normalize(vV);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

          // fake sky reflection: warm above, cool at the horizon
          vec3 refl = reflect(-V, N);
          vec3 sky = mix(vec3(0.34, 0.48, 0.60), vec3(0.86, 0.95, 1.0), smoothstep(-0.1, 0.8, refl.y));

          // fake refraction of the pale bath floor, with caustic banding
          vec2 ruv = vUv + g * 0.0022;
          float floorTone = 0.86 + 0.16 * sin(ruv.x * 28.0) * sin(ruv.y * 26.0);
          float caustic = pow(max(0.0, 1.0 - length(g) * 0.006), 6.0);
          vec3 body = vec3(0.62, 0.84, 0.86) * floorTone + vec3(0.9, 1.0, 1.0) * caustic * 0.18;

          vec3 L = normalize(vec3(-0.45, 0.82, 0.55));
          vec3 H = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), 220.0);
          float sparkle = pow(max(dot(N, H), 0.0), 900.0);

          vec3 col = mix(body, sky, 0.18 + fres * 0.62);
          col += vec3(1.0, 0.98, 0.94) * spec * 1.1;
          col += vec3(1.0) * sparkle * 1.6;

          // soft inner edge so the bath does not end on a hard line
          vec2 d = min(vUv, 1.0 - vUv);
          float rim = smoothstep(0.0, 0.05, min(d.x, d.y));
          col = mix(col * 0.72, col, rim);

          // Looking straight down the surface is half see-through, so the slide
          // sliding underneath stays visible; at a grazing angle it turns into a
          // mirror, exactly as real water does.
          gl_FragColor = vec4(col * uLight, (0.46 + fres * 0.50) * uOpacity);
        }`,
    }));
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 2;
  }

  /** @param x,z local plane coords in -0.5..0.5 */
  ripple(x: number, z: number, strength = 1) {
    const r = this.ripples[this.next % this.max];
    this.next++;
    r.set(x, z, this.t, strength);
  }

  /** Convert a world position into local ripple coordinates. */
  rippleAtWorld(world: THREE.Vector3, size: number, strength = 1) {
    const local = this.mesh.worldToLocal(world.clone());
    this.ripple(local.x / size, local.z / size, strength);
  }

  tick(dt: number) {
    this.t += dt;
    this.mat.uniforms.uTime.value = this.t;
  }

  get time() { return this.t; }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}
