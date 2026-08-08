/**
 * The serial-section ribbon — the single most important object in the game.
 *
 * Built as a spline-driven ribbon mesh: a heading function integrates into a
 * drape curve, a travelling wave shakes it laterally, and a twist about the
 * tangent rotates the strip so it catches the light and momentarily thins to
 * nothing. That twist is what stops it reading as paper tape.
 *
 * Cost: ~250 vertices rewritten per frame. Nothing else.
 */
import * as THREE from 'three';
import { LIGHT_GLSL, registerLit } from './materials';
import { clamp, noise1, smoothstep } from '../core/util';

export interface RibbonShape {
  /** initial heading at the knife edge, radians in the XY plane */
  theta0: number;
  /** constant curvature (rad per section) */
  curve: number;
  /** curvature growth (rad per section^2) — makes the far end drape over */
  curve2: number;
  /** world length of one section */
  sectionLen: number;
  /** world width of the ribbon */
  width: number;
}

/** Portrait: the ribbon climbs, so the finger on the wheel stays clear of it. */
export const PORTRAIT_SHAPE: RibbonShape = {
  theta0: 1.60, curve: 0.050, curve2: 0.0160, sectionLen: 0.18, width: 0.19,
};
/** Landscape: the same drape, leaned over so it reads across a wide screen. */
export const LANDSCAPE_SHAPE: RibbonShape = {
  theta0: 1.85, curve: 0.115, curve2: 0.0100, sectionLen: 0.19, width: 0.19,
};

const SEGS_PER_SECTION = 9;

export class Ribbon {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  shape: RibbonShape = { ...PORTRAIT_SHAPE };
  /** length in sections (fractional while a cut is in progress) */
  length = 0;
  /** d(length)/dt, smoothed — drives wave energy and the スルスル sound */
  speed = 0;
  /** extra flutter injected by events (a cut completing, a tap) */
  private impulse = 0;
  private prevLen = 0;
  private maxSections: number;
  private pos: Float32Array;
  private nor: Float32Array;
  private aU: Float32Array;
  private geo: THREE.BufferGeometry;
  private t = 0;
  private seed: number;
  /** cached world-space samples of the ribbon centre line, for hit testing */
  readonly samples: THREE.Vector3[] = [];

  constructor(tissue: THREE.Texture, maxSections: number, seed: number, quality: 'low' | 'high') {
    this.maxSections = maxSections;
    this.seed = seed;
    const segs = maxSections * (quality === 'high' ? SEGS_PER_SECTION : 6);
    const verts = (segs + 1) * 2;
    this.pos = new Float32Array(verts * 3);
    this.nor = new Float32Array(verts * 3);
    this.aU = new Float32Array(verts);
    const side = new Float32Array(verts);
    for (let i = 0; i <= segs; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; }

    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aU', new THREE.BufferAttribute(this.aU, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    this.geo.setIndex(idx);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 20);

    this.mat = registerLit(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      // premultiplied alpha: lets the rim and the specular flash add light
      // without the body of the film darkening what is behind it
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uLight: { value: 1 },
        uTime: { value: 0 },
        uLen: { value: 0 },
        uTissue: { value: tissue },
        uWax: { value: new THREE.Color(0xf2ecdf) },
        uTissueCol: { value: new THREE.Color(0xe6a8bd) },
        uOpacity: { value: 1 },
        uHighlight: { value: -1 },   // section index to spotlight, -1 = none
      },
      vertexShader: /* glsl */ `
        attribute float aU; attribute float aSide;
        varying vec3 vN; varying vec3 vV; varying float vU; varying float vSide;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          vU = aU; vSide = aSide;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        ${LIGHT_GLSL}
        uniform float uLight, uTime, uLen, uOpacity, uHighlight;
        uniform sampler2D uTissue; uniform vec3 uWax, uTissueCol;
        varying vec3 vN; varying vec3 vV; varying float vU; varying float vSide;

        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(vV);
          float ndv = abs(dot(N, V));
          float fres = pow(1.0 - ndv, 2.0);

          // ---- per-section tissue -------------------------------------------
          float su = vU - uLen;                 // 0 at every section boundary
          float sec = floor(su);
          // the tissue island sits inside a margin of clear wax, as it does on
          // a real section — that margin is most of why this reads as a section
          vec2 tuv = (vec2(fract(su), vSide * 0.5 + 0.5) - 0.5) / 0.66 + 0.5;
          tuv += vec2(sin(sec * 2.3) * 0.018, cos(sec * 1.7) * 0.018);
          vec4 tis = (tuv.x < 0.0 || tuv.x > 1.0 || tuv.y < 0.0 || tuv.y > 1.0)
            ? vec4(0.0) : texture2D(uTissue, tuv);

          // ---- edges and joins ----------------------------------------------
          float acrossEdge = smoothstep(0.80, 1.0, abs(vSide));
          float jd = min(fract(su), 1.0 - fract(su));
          float joint = smoothstep(0.030, 0.0, jd);

          // ---- thin-film shimmer: sells "microns thick" ----------------------
          float film = fres * 2.6 + tis.a * 0.4 + sin(vU * 1.7 + uTime * 0.5) * 0.3;
          vec3 iri = 0.5 + 0.5 * cos(6.28318 * (film + vec3(0.0, 0.33, 0.67)));

          // ---- lighting ------------------------------------------------------
          float key = abs(dot(N, KEY_DIR));
          float fillL = abs(dot(N, FILL_DIR));
          vec3 H = normalize(KEY_DIR + V);
          float spec = pow(max(dot(N, H), 0.0), 42.0);
          float sheen = smoothstep(0.45, 1.0, sin(vU * 2.2 - uTime * 1.1) * 0.5 + 0.5);

          // A few microns of tissue transmits nearly all the light that hits it.
          // So the film is lit almost to white, and it OCCLUDES almost nothing.
          vec3 base = mix(uWax, uTissueCol, tis.a * 0.8);
          vec3 col = base * (AMB_COL * 3.0 + KEY_COL * key * 1.15 + FILL_COL * fillL * 0.5);
          col += iri * (0.22 + fres * 0.45);

          float hl = uHighlight < -0.5 ? 0.0 :
            (1.0 - smoothstep(0.0, 0.85, abs(su - uHighlight - 0.5)));

          // opacity stays tiny: this is a film, not a sheet of paper
          float a = 0.038
                  + fres * 0.14
                  + acrossEdge * 0.09
                  + tis.a * 0.13
                  + joint * 0.035
                  + hl * 0.09;
          a = clamp(a, 0.0, 0.42) * uOpacity;

          // Light the film adds without hiding anything behind it: the rim
          // catching the key light, the specular flash as it twists, the
          // brighter line where two sections join.
          vec3 glow = vec3(1.0, 0.975, 0.94) * acrossEdge * (0.10 + 0.16 * sheen)
                    + KEY_COL * spec * 0.34
                    + vec3(0.86, 0.93, 1.0) * joint * 0.07
                    + vec3(0.40, 1.0, 0.85) * hl * 0.26;

          // scattered light is boosted well past a plain alpha blend: a
          // backlit film glows, it does not merely tint
          gl_FragColor = vec4((col * a * 1.55 + glow * 0.85) * uLight * uOpacity, a);
        }`,
    }));

    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.group.add(this.mesh);
    this.setLength(0);
  }

  setShape(s: RibbonShape) { this.shape = { ...s }; }

  setLength(l: number) {
    this.length = clamp(l, 0, this.maxSections);
    this.prevLen = this.length;
  }

  /** A section just finished — give the ribbon a visible kick. */
  kick(strength = 1) { this.impulse = Math.min(1.6, this.impulse + strength); }

  /** Centre-line position (local space) at distance `u` sections from the knife. */
  private centre(u: number, out: THREE.Vector3, tan?: THREE.Vector3) {
    const s = this.shape;
    // integrate heading; closed form for theta0 + c1*u + c2*u^2
    const steps = Math.max(2, Math.ceil(u * 6));
    let x = 0, y = 0, z = 0;
    const h = u / steps;
    for (let i = 0; i < steps; i++) {
      const uu = (i + 0.5) * h;
      const th = s.theta0 + s.curve * uu + s.curve2 * uu * uu;
      x += Math.cos(th) * h;
      y += Math.sin(th) * h;
      z += Math.sin(uu * 0.9 + this.seed) * 0.02 * h;
    }
    out.set(x * s.sectionLen, y * s.sectionLen, z * s.sectionLen);
    if (tan) {
      const th = s.theta0 + s.curve * u + s.curve2 * u * u;
      tan.set(Math.cos(th), Math.sin(th), 0).normalize();
    }
  }

  update(dt: number, targetLen: number) {
    this.t += dt;
    this.length = clamp(targetLen, 0, this.maxSections);
    const raw = (this.length - this.prevLen) / Math.max(1e-4, dt);
    this.prevLen = this.length;
    this.speed += (raw - this.speed) * Math.min(1, dt * 12);
    this.impulse = Math.max(0, this.impulse - dt * 1.6);

    const L = this.length;
    const segsTotal = (this.aU.length / 2) - 1;
    const active = Math.max(1, Math.min(segsTotal, Math.ceil(L * SEGS_PER_SECTION) + 1));
    const s = this.shape;
    const halfW = s.width * 0.5;

    const p = _p, tan = _t, bi = _b, nrm = _n, tmp = _m;
    this.samples.length = 0;

    // wave energy: cranking hard makes it ripple, then it calms down
    const energy = clamp(Math.abs(this.speed) * 0.55 + this.impulse * 0.55, 0, 1.4);
    const waveSpeed = 1.1 + Math.abs(this.speed) * 1.4;

    for (let i = 0; i <= active; i++) {
      const f = active > 0 ? i / active : 0;
      const u = f * L;
      this.centre(u, p, tan);

      // lateral travelling wave, stronger toward the free tip
      const tipW = smoothstep(0.15, 1.0, f);
      const amp = s.sectionLen * (0.055 + 0.16 * energy) * tipW;
      const w =
        Math.sin(u * 2.4 - this.t * waveSpeed + this.seed) * 0.7 +
        Math.sin(u * 4.7 + this.t * waveSpeed * 0.63) * 0.3 +
        noise1(u * 1.6 + this.t * 0.35, this.seed | 0) * 0.5;

      // in-plane perpendicular
      bi.set(tan.y, -tan.x, 0).normalize();
      // twist about the tangent: the strip turns edge-on and flashes
      const twist =
        (0.34 + 0.5 * energy) * Math.sin(u * 1.35 - this.t * 0.9 + this.seed * 0.7) * tipW +
        0.12 * Math.sin(u * 3.1 + this.t * 1.7);
      tmp.copy(tan).cross(bi);                        // ~ +/-Z
      bi.multiplyScalar(Math.cos(twist)).addScaledVector(tmp, Math.sin(twist)).normalize();

      // apply the wave along the (untwisted) in-plane normal so it reads on screen
      p.x += tan.y * w * amp * 0.0;                   // keep centre line stable in X
      p.y += w * amp * 0.55;
      p.z += w * amp * 1.15;

      nrm.copy(tan).cross(bi).normalize();

      const o = i * 6, on = i * 6;
      this.pos[o + 0] = p.x - bi.x * halfW;
      this.pos[o + 1] = p.y - bi.y * halfW;
      this.pos[o + 2] = p.z - bi.z * halfW;
      this.pos[o + 3] = p.x + bi.x * halfW;
      this.pos[o + 4] = p.y + bi.y * halfW;
      this.pos[o + 5] = p.z + bi.z * halfW;
      this.nor[on + 0] = this.nor[on + 3] = nrm.x;
      this.nor[on + 1] = this.nor[on + 4] = nrm.y;
      this.nor[on + 2] = this.nor[on + 5] = nrm.z;
      this.aU[i * 2] = this.aU[i * 2 + 1] = u;

      this.samples.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    // collapse the unused tail onto the tip so no stray triangles appear
    for (let i = active + 1; i <= segsTotal; i++) {
      const src = active * 6;
      const o = i * 6;
      for (let k = 0; k < 6; k++) this.pos[o + k] = this.pos[src + k];
      this.aU[i * 2] = this.aU[i * 2 + 1] = L;
    }

    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aU as THREE.BufferAttribute).needsUpdate = true;
    this.mat.uniforms.uLen.value = L;
    this.mat.uniforms.uTime.value = this.t;
    this.mesh.visible = L > 0.001;
  }

  /** World position of the centre line at `u` sections from the knife. */
  worldAt(u: number, out: THREE.Vector3) {
    this.centre(clamp(u, 0, this.length), out);
    this.group.localToWorld(out);
    return out;
  }

  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _b = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Vector3();
