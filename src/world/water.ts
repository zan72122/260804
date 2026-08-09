/**
 * The flood surface.
 *
 * One plane, one shader. The surface height is a handful of low-frequency
 * sines plus up to four *local* disturbers (reel wake, finger, hose nozzle,
 * boom). No screen-space refraction, no simulation grid — the plane is
 * cheap enough to keep at 60fps while still carrying the two things the
 * child must read: the water level rising, and the reel churning it.
 *
 * The flooding front is free: the same bog-floor function is evaluated per
 * fragment, and anything above the current level is discarded. Water
 * therefore *finds the low ground* instead of a plane sliding upward.
 */

import * as THREE from 'three';
import { WATER_DRY, WATER_FULL, type FieldVariant } from './layout';
import { clamp, damp, smoothstep } from '../core/math';

const MAX_DISTURB = 4;

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uAmp;
  uniform float uFreq;
  uniform vec4  uDisturb[${MAX_DISTURB}];   // xz = centre, z = strength, w = radius
  uniform float uDetail;

  varying vec3 vWorld;
  varying vec3 vNormal2;
  varying float vRipple;
  varying float vDepthV;

  float waveAt(vec2 p) {
    float h =
        sin(p.x * uFreq + uTime * 0.85) * 0.50
      + sin(p.y * uFreq * 1.27 - uTime * 0.63) * 0.34
      + sin((p.x + p.y) * uFreq * 0.71 + uTime * 1.21) * 0.26
      + sin((p.x - p.y * 0.6) * uFreq * 2.3 + uTime * 1.9) * 0.12 * uDetail;
    return h * uAmp;
  }

  // A wake rings *outward* from whatever is stirring the water. The
  // smoothstep is what makes the centre calm: without it every disturber is
  // a piston under its own source, and the reel, the nozzle and the boom
  // buoys all buzz vertically on their own ripples.
  float rippleAt(vec2 p) {
    float r = 0.0;
    for (int i = 0; i < ${MAX_DISTURB}; i++) {
      vec4 d = uDisturb[i];
      if (d.z <= 0.001) continue;
      float dist = distance(p, d.xy);
      float fall = exp(-(dist * dist) / max(d.w * d.w, 0.0001));
      float birth = smoothstep(0.0, max(d.w * 0.32, 0.35), dist);
      r += d.z * fall * birth * sin(dist * 5.2 - uTime * 8.5);
    }
    return r;
  }

  void main() {
    vec3 p = position;
    vec2 xz = vec2(p.x, -p.y);           // plane is rotated onto XZ below
    float rip = rippleAt(xz);
    float h = waveAt(xz) + rip;
    vRipple = abs(rip);

    // normal from the same field, so lighting and shape never disagree
    float e = 0.45;
    float hx = waveAt(xz + vec2(e, 0.0)) + rippleAt(xz + vec2(e, 0.0));
    float hz = waveAt(xz + vec2(0.0, e)) + rippleAt(xz + vec2(0.0, e));
    vec3 n = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
    vNormal2 = n;

    p.z += h;                             // local z becomes world y after rotation
    vec4 world = modelMatrix * vec4(p, 1.0);
    world.y = uLevel + h;
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vDepthV = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uLevel;
  uniform vec3  uTint;
  uniform vec3  uDeep;
  uniform vec3  uShallow;
  uniform vec3  uSky;
  uniform vec3  uSunDir;
  uniform vec3  uSunColor;
  uniform vec2  uHalf;
  uniform float uCorner;
  uniform float uOpacity;
  uniform sampler2D uRaft;
  uniform float uRaftAmount;
  uniform vec3  uFogColor;
  uniform vec2  uFogRange;

  varying vec3 vWorld;
  varying vec3 vNormal2;
  varying float vRipple;
  varying float vDepthV;

  // must mirror floorHeight() in layout.ts
  float floorHeight(vec2 p) {
    float nx = p.x / uHalf.x;
    float nz = p.y / uHalf.y;
    return -0.06 + 0.19 * (nx * 0.45 + nz * 0.55) + 0.05 * sin(nx * 4.1) * cos(nz * 3.3);
  }

  // must mirror bogInset() in layout.ts
  float bogInset(vec2 p) {
    vec2 a = abs(p) - (uHalf - uCorner);
    vec2 q = max(a, 0.0);
    float outside = length(q) - uCorner;
    float inside = min(max(a.x, a.y), 0.0) - uCorner;
    return -(outside + inside);
  }

  // Cheap cell pattern: the surface of a packed raft is a field of little
  // domes, not a flat red sheet. Two hashes give per-cell size and shade.
  vec2 hash2(vec2 c) {
    float n = sin(dot(c, vec2(41.3, 289.1))) * 43758.5453;
    return fract(vec2(n, n * 1.371));
  }

  float raftBumps(vec2 p, out float shade) {
    vec2 g = p / 0.34;
    vec2 gi = floor(g);
    vec2 gf = fract(g);
    float best = 1e9;
    shade = 0.0;
    for (int oy = -1; oy <= 1; oy++) {
      for (int ox = -1; ox <= 1; ox++) {
        vec2 o = vec2(float(ox), float(oy));
        vec2 h = hash2(gi + o);
        float d = length(gf - (o + h));
        if (d < best) {
          best = d;
          shade = h.y;
        }
      }
    }
    return best;
  }

  void main() {
    vec2 p = vWorld.xz;
    float inset = bogInset(p);
    if (inset < 0.0) discard;

    float depth = uLevel - floorHeight(p);
    if (depth <= 0.004) discard;

    vec3 view = normalize(cameraPosition - vWorld);
    vec3 n = normalize(vNormal2);
    float fres = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 3.0);

    // shallow water shows the peat + vines beneath; deep water goes teal
    float dTerm = clamp(depth / 0.55, 0.0, 1.0);
    // shallow water over peat is brown-green; deeper goes to the tint
    vec3 base = mix(uShallow, uTint, dTerm);
    vec3 col = mix(base, uSky, fres * 0.16);

    // sun glint
    vec3 h = normalize(uSunDir + view);
    float spec = pow(max(dot(n, h), 0.0), 200.0);
    col += uSunColor * spec * 0.35;

    // churn foam where something is stirring the water
    float foam = smoothstep(0.06, 0.2, vRipple);
    col = mix(col, vec3(0.86, 0.9, 0.88), foam * 0.42);

    // shoreline lace
    float shore = 1.0 - smoothstep(0.0, 0.55, depth);
    col = mix(col, vec3(0.72, 0.72, 0.62), shore * 0.3);
    float edge = smoothstep(0.0, 1.5, inset);

    float alpha = uOpacity * mix(0.34, 0.72, dTerm);
    alpha = mix(alpha, min(1.0, alpha + 0.25), foam);
    alpha *= edge;
    alpha = clamp(alpha + fres * 0.1, 0.0, 1.0);

    // ---- the floating raft, painted straight into the surface ----
    if (uRaftAmount > 0.001) {
      vec2 ruv = (p + uHalf + vec2(2.0)) / ((uHalf + vec2(2.0)) * 2.0);
      float dens = texture2D(uRaft, ruv).r * uRaftAmount;
      if (dens > 0.4) {
        float shade;
        float cellD = raftBumps(p, shade);
        // domes: bright toward the cell centre, dark in the crevices
        float dome = smoothstep(0.42, 0.03, cellD);
        vec3 skin = mix(vec3(0.30, 0.017, 0.045), vec3(0.62, 0.05, 0.075), shade);
        skin *= 0.55 + dome * 0.85;
        // a wet highlight riding the top of each dome
        // the wet highlight belongs to a *packed* raft; fading it with cover
        // stops the outer fringe reading as a pink glow on open water
        skin += vec3(1.0, 0.85, 0.8) * pow(dome, 6.0) * 0.28 * smoothstep(0.55, 1.0, dens);
        // Only fill in where the fruit is genuinely crowded. A linear ramp
        // put a red halo around every isolated berry, which read as a glow
        // rather than as neighbours packed too close to see between.
        float cover = smoothstep(0.52, 1.0, dens);
        // crevices between fruit still show a little dark water
        cover *= 0.35 + 0.65 * smoothstep(0.5, 0.12, cellD);
        col = mix(col, skin, cover);
        alpha = max(alpha, cover);
      }
    }

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    // matched by hand to the scene fog: three's fog chunks assume the
    // standard varying set, which this shader does not have
    float fogF = smoothstep(uFogRange.x, uFogRange.y, vDepthV);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, fogF);
  }
`;

export class Water {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly disturb = new Array<THREE.Vector4>(MAX_DISTURB);

  /** Current surface height (world y). */
  level = WATER_DRY;
  /** Where the level is heading; the gate drives this. */
  targetLevel = WATER_DRY;

  private time = 0;
  private readonly amp: number;
  private readonly freq: number;

  constructor(private readonly v: FieldVariant, segments: number, detail: number) {
    this.amp = v.waveAmp;
    this.freq = v.waveFreq;
    for (let i = 0; i < MAX_DISTURB; i++) this.disturb[i] = new THREE.Vector4(0, 0, 0, 1);

    const geo = new THREE.PlaneGeometry(
      v.halfX * 2 + 2,
      v.halfZ * 2 + 2,
      segments,
      Math.round(segments * (v.halfZ / v.halfX)),
    );
    geo.rotateX(-Math.PI / 2);

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLevel: { value: this.level },
        uAmp: { value: this.amp },
        uFreq: { value: this.freq },
        uDetail: { value: detail },
        uDisturb: { value: this.disturb },
        uTint: { value: v.waterTint.clone() },
        uDeep: { value: v.waterTint.clone().multiplyScalar(0.55) },
        uShallow: { value: new THREE.Color('#4a3d1e').lerp(v.waterTint, 0.45) },
        uSky: { value: v.skyBottom.clone() },
        uSunDir: { value: new THREE.Vector3(0.42, 0.7, 0.58).normalize() },
        uSunColor: { value: v.sunColor.clone() },
        uHalf: { value: new THREE.Vector2(v.halfX, v.halfZ) },
        uCorner: { value: v.corner },
        uOpacity: { value: 0.9 },
        uRaft: { value: null as THREE.Texture | null },
        uRaftAmount: { value: 0 },
        uFogColor: { value: new THREE.Color('#ffffff') },
        uFogRange: { value: new THREE.Vector2(1e6, 2e6) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.name = 'water';
  }

  /** Match the scene fog, so the far end of the water recedes with the land. */
  setFog(color: THREE.Color, near: number, far: number): void {
    (this.mat.uniforms.uFogColor.value as THREE.Color).copy(color);
    (this.mat.uniforms.uFogRange.value as THREE.Vector2).set(near, far);
  }

  /**
   * Hand the water the raft density map. `amount` fades the whole effect in
   * so the bog does not turn red before any fruit has actually surfaced.
   */
  setRaft(tex: THREE.Texture | null, amount: number): void {
    this.mat.uniforms.uRaft.value = tex;
    this.mat.uniforms.uRaftAmount.value = amount;
  }

  /** CPU mirror of the vertex wave, for berries / boom / hose bobbing. */
  heightAt(x: number, z: number): number {
    const t = this.time;
    const f = this.freq;
    const h =
      Math.sin(x * f + t * 0.85) * 0.5 +
      Math.sin(z * f * 1.27 - t * 0.63) * 0.34 +
      Math.sin((x + z) * f * 0.71 + t * 1.21) * 0.26;
    let rip = 0;
    for (let i = 0; i < MAX_DISTURB; i++) {
      const d = this.disturb[i];
      if (d.z <= 0.001) continue;
      const dist = Math.hypot(x - d.x, z - d.y);
      const fall = Math.exp(-(dist * dist) / Math.max(d.w * d.w, 1e-4));
      // must mirror rippleAt() in the shader, including the calm centre
      const birth = smoothstep(dist / Math.max(d.w * 0.32, 0.35));
      rip += d.z * fall * birth * Math.sin(dist * 5.2 - t * 8.5);
    }
    return this.level + h * this.amp + rip;
  }

  /**
   * Register a local disturbance.
   * slot 0 = reel, 1 = finger, 2 = nozzle, 3 = boom.
   */
  setDisturb(slot: number, x: number, z: number, strength: number, radius: number): void {
    if (slot < 0 || slot >= MAX_DISTURB) return;
    this.disturb[slot].set(x, z, strength, radius);
  }

  fadeDisturb(slot: number, dt: number, rate = 3): void {
    const d = this.disturb[slot];
    d.z = damp(d.z, 0, rate, dt);
  }

  /** 0..1 flood progress, what every other system reads. */
  get flood(): number {
    return clamp((this.level - WATER_DRY) / (WATER_FULL - WATER_DRY), 0, 1);
  }

  update(dt: number): void {
    this.time += dt;
    // Rising water is slow and heavy; falling (gate closed) barely moves.
    const rate = this.targetLevel > this.level ? 0.55 : 0.18;
    this.level = damp(this.level, this.targetLevel, rate, dt);
    this.mat.uniforms.uTime.value = this.time;
    this.mat.uniforms.uLevel.value = this.level;
    this.mesh.position.y = 0;
  }

  setQuality(detail: number, opacity: number): void {
    this.mat.uniforms.uDetail.value = detail;
    this.mat.uniforms.uOpacity.value = opacity;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }

  get variant(): FieldVariant {
    return this.v;
  }
}
