/**
 * A single tissue section: the object the player carries from the ribbon, onto
 * the water, onto the slide, through the baths and under the cover glass.
 *
 * The フワッ moment is a vertex-shader morph — `morph` 0 = shrunken and
 * wrinkled, 1 = perfectly flat and slightly larger. Nothing simulated.
 */
import * as THREE from 'three';
import { LIGHT_GLSL, registerLit } from './materials';

export class Section {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  /** 0 = curled and creased, 1 = relaxed flat */
  morph = 0;

  constructor(tissue: THREE.Texture, size: number, seed: number, quality: 'low' | 'high') {
    const n = quality === 'high' ? 30 : 18;
    const geo = new THREE.PlaneGeometry(size, size, n, n);
    this.mat = registerLit(new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uLight: { value: 1 },
        uTime: { value: 0 },
        uMorph: { value: 0 },
        uSeed: { value: seed % 100 },
        uTissue: { value: tissue },
        uWax: { value: new THREE.Color(0xf6e9ee) },
        uTissueCol: { value: new THREE.Color(0xd98fae) },
        uParaffin: { value: 1 },   // 1 = still waxy, 0 = de-waxed
        uStain: { value: new THREE.Vector3(0, 0, 0) },
        uWet: { value: 0 },
        uOpacity: { value: 1 },
        uRelief: { value: 1 },     // how far it may lift off its plane
      },
      vertexShader: /* glsl */ `
        uniform float uMorph, uSeed, uTime, uRelief;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vCrease;
        void main() {
          vUv = uv;
          vec2 q = uv * 2.0 - 1.0;
          float m = uMorph;
          float r = length(q);

          float wob = sin(q.x * 6.4 + uSeed) * cos(q.y * 5.7 + uSeed * 1.7) * 0.55
                    + sin((q.x + q.y) * 10.3 + uSeed * 0.4) * 0.3
                    + sin(q.x * 15.1 - q.y * 12.0) * 0.16;
          float curl = pow(clamp(r, 0.0, 1.4), 2.4);

          vec3 pos = position;
          // shrivelled -> full size. The area change is most of what makes the
          // relaxation reads from directly above.
          pos.xy *= mix(0.66, 1.0, m);
          // and the rim draws itself inwards, so the silhouette crumples too
          vec2 dir = r > 0.001 ? q / r : vec2(0.0);
          pos.xy -= dir * (curl * 0.16 + wob * 0.05) * (1.0 - m) * 0.5;
          float lift = (curl * 0.55 + wob * 0.26) * (1.0 - m);
          // a last shiver as it settles
          lift += sin(q.x * 8.0 - uTime * 3.0 + uSeed) * 0.03 * (1.0 - m) * m * 4.0;
          pos.z += lift * uRelief;
          vCrease = clamp(abs(wob) * (1.0 - m), 0.0, 1.0);

          // cheap analytic normal from the same field
          float e = 0.06;
          float wx = sin((q.x + e) * 6.4 + uSeed) * cos(q.y * 5.7 + uSeed * 1.7) * 0.55;
          float wy = sin(q.x * 6.4 + uSeed) * cos((q.y + e) * 5.7 + uSeed * 1.7) * 0.55;
          vec3 nn = normalize(vec3(-(wx - wob) * (1.0 - m) * 2.2, -(wy - wob) * (1.0 - m) * 2.2, 1.0));
          vN = normalize(normalMatrix * nn);
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        ${LIGHT_GLSL}
        uniform float uLight, uTime, uMorph, uParaffin, uWet, uOpacity;
        uniform sampler2D uTissue; uniform vec3 uWax, uTissueCol, uStain;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vCrease;
        void main() {
          vec3 N = normalize(vN); vec3 V = normalize(vV);
          float ndv = abs(dot(N, V));
          float fres = pow(1.0 - ndv, 2.0);
          vec4 tis = texture2D(uTissue, vUv);

          vec2 d = min(vUv, 1.0 - vUv);
          float edge = 1.0 - smoothstep(0.0, 0.05, min(d.x, d.y));

          float film = fres * 2.4 + tis.a * 0.35;
          vec3 iri = 0.5 + 0.5 * cos(6.28318 * (film + vec3(0.0, 0.33, 0.67)));

          vec3 base = mix(uWax, uTissueCol, tis.a * 0.92);
          // paraffin haze: milky, and it flattens the tissue contrast
          base = mix(base, vec3(0.97, 0.95, 0.90), uParaffin * 0.45);
          // stain binds only where there is tissue, and stays deliberately subtle
          base += uStain * tis.a * 0.55;

          float key = abs(dot(N, KEY_DIR));
          vec3 H = normalize(KEY_DIR + V);
          float spec = pow(max(dot(N, H), 0.0), mix(30.0, 90.0, uWet));

          // Same reasoning as the ribbon: a few microns of tissue is lit almost
          // to white and hides almost nothing behind it.
          vec3 col = base * (AMB_COL * 2.2 + KEY_COL * key * 0.85 + FILL_COL * 0.3);
          col += iri * (0.16 + fres * 0.34);

          float a = 0.10 + fres * 0.24 + edge * 0.18 + tis.a * 0.26
                  + uParaffin * 0.10 + length(uStain) * 0.18;
          a = clamp(a, 0.0, 0.80) * uOpacity;

          vec3 glow = KEY_COL * spec * (0.22 + uWet * 0.55)
                    + vec3(1.0, 0.97, 0.93) * edge * 0.14
                    + vec3(0.85, 0.9, 1.0) * vCrease * 0.09;

          gl_FragColor = vec4((col * a * 1.1 + glow * 0.62) * uLight * uOpacity, a);
        }`,
    }));
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.renderOrder = 8;
  }

  setMorph(v: number) { this.morph = v; this.mat.uniforms.uMorph.value = v; }
  set paraffin(v: number) { this.mat.uniforms.uParaffin.value = v; }
  set wet(v: number) { this.mat.uniforms.uWet.value = v; }
  set opacity(v: number) { this.mat.uniforms.uOpacity.value = v; }
  set relief(v: number) { this.mat.uniforms.uRelief.value = v; }
  setStain(r: number, g: number, b: number) { this.mat.uniforms.uStain.value.set(r, g, b); }
  tick(t: number) { this.mat.uniforms.uTime.value = t; }

  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}
