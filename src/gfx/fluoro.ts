/**
 * The fluorescence field — the final payoff.
 *
 * A camera-attached quad that covers the viewport. The optical transition
 * fades it in over the darkened lab; the focus knob drives `focus`, which
 * controls both a mip-LOD and a spiral tap radius (with a per-channel offset,
 * so defocus goes slightly chromatic exactly like a real objective does).
 *
 * WebGL2 / GLSL ES 3.00 is used here purely for `textureLod` — that is what
 * makes an out-of-focus field smooth instead of a ring of ghosts.
 */
import * as THREE from 'three';

export class FluoroField {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;

  constructor(far: THREE.Texture, near: THREE.Texture, quality: 'low' | 'high') {
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      glslVersion: THREE.GLSL3,
      uniforms: {
        uFar: { value: far },
        uNear: { value: near },
        uFocus: { value: 0 },      // 0 = hopeless blur, 1 = razor sharp
        uZoom: { value: 1 },
        uNearMix: { value: 0 },
        uReveal: { value: 0 },     // overall opacity over the lab
        uMaskR: { value: 0.1 },    // radius of the circular field, in aspect units
        uCenter: { value: new THREE.Vector2(0, 0) }, // where that circle sits on screen
        uCover: { value: 0 },      // 0 = lab visible around the circle, 1 = full immersion
        uAspect: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uFlash: { value: 0 },      // brief bloom bump on the パッ
        uPan: { value: new THREE.Vector2(0, 0) },
      },
      defines: { TAPS: quality === 'high' ? 6 : 4 },
      vertexShader: /* glsl */ `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uFar, uNear;
        uniform float uFocus, uZoom, uNearMix, uReveal, uMaskR, uTime, uFlash, uCover;
        uniform vec2 uAspect, uPan, uCenter;
        in vec2 vUv;
        out vec4 outColor;

        vec3 sampleField(vec2 uv, float lod) {
          vec3 a = textureLod(uFar, uv, lod).rgb;
          if (uNearMix <= 0.001) return a;
          vec3 b = textureLod(uNear, uv, lod).rgb;
          return mix(a, b, uNearMix);
        }

        void main() {
          vec2 c = (vUv - 0.5) * uAspect - uCenter;
          float rr = length(c);

          float f0 = smoothstep(0.0, 1.0, uFocus);
          float defoc = clamp(1.0 - uFocus, 0.0, 1.0);
          float lod = defoc * 5.2;
          float rad = defoc * 0.055 + 0.0015;

          // field curvature: the very edge of a real field never quite focuses
          float edgeDefoc = smoothstep(uMaskR * 0.55, uMaskR, rr) * 0.22;
          lod += edgeDefoc * 3.0;

          vec2 base = (vUv - 0.5) / uZoom + 0.5 + uPan;
          // mild pincushion so the field feels like it is behind glass
          base += c * rr * rr * 0.018 / uZoom;

          vec3 col;
          if (defoc < 0.03) {
            // In focus — and that is where the game spends its longest, most
            // static minute. One tap instead of 3*TAPS.
            col = sampleField(base, 0.0);
          } else {
            vec3 sum = vec3(0.0);
            const float GA = 2.39996323;
            for (int i = 0; i < TAPS; i++) {
              float fi = float(i);
              float a = fi * GA;
              float rq = sqrt((fi + 0.5) / float(TAPS));
              vec2 dir = vec2(cos(a), sin(a)) * rq * rad;
              // chromatic defocus: R spreads more than B
              sum.r += sampleField(base + dir * 1.14 / uAspect, lod).r;
              sum.g += sampleField(base + dir * 1.00 / uAspect, lod).g;
              sum.b += sampleField(base + dir * 0.88 / uAspect, lod).b;
            }
            col = sum / float(TAPS);
          }

          // restrained bloom — one very blurry tap, never a screen-wide wash
          vec3 halo = sampleField(base, 7.0);
          // out of focus, most of what you see IS the halo — that is the point
          col += halo * (0.34 + (1.0 - f0) * 0.55 + uFlash * 0.7);

          // out of focus light is grey and formless; in focus it is saturated
          float f = f0;
          col *= mix(0.88, 1.34, f);
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(lum), col, mix(0.55, 1.18, f));
          col = mix(col, col * col * 1.35, f * 0.42);          // contrast bloom-in
          col *= 1.0 + uFlash * 0.55;

          // circular field of view with a whisper of a diaphragm edge
          float inside = 1.0 - smoothstep(uMaskR * 0.965, uMaskR, rr);
          float edgeGlow = smoothstep(uMaskR * 0.9, uMaskR * 0.985, rr)
                         * (1.0 - smoothstep(uMaskR * 0.985, uMaskR * 1.02, rr));
          col *= inside;
          col += vec3(0.10, 0.16, 0.22) * edgeGlow * 0.8;
          col += vec3(0.012, 0.018, 0.03) * inside;            // faint background glow

          // sensor grain, only where there is signal
          float g = fract(sin(dot(vUv * 733.0 + uTime * 0.6, vec2(12.9898, 78.233))) * 43758.5453);
          col += (g - 0.5) * 0.016 * inside;

          // Outside the circle: while the player still needs to see the focus
          // knob, only darken the lab a little; once the reveal lands, close
          // the whole screen down to the eyepiece.
          float shroud = smoothstep(uMaskR * 2.6, uMaskR * 1.0, rr) * 0.82;
          float a = uReveal * clamp(max(inside, max(shroud * (1.0 - uCover), uCover)), 0.0, 1.0);
          outColor = vec4(max(col, 0.0), a);
        }`,
    });
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 999;
    this.mesh.visible = false;
  }

  /** Attach to the camera and size the quad so it exactly covers the viewport. */
  fit(camera: THREE.PerspectiveCamera, dist = 0.6) {
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
    const w = h * camera.aspect;
    this.mesh.scale.set(w * 1.02, h * 1.02, 1);
    this.mesh.position.set(0, 0, -dist);
    const a = camera.aspect;
    // keep the circle round whichever way the device is held
    this.mat.uniforms.uAspect.value.set(a >= 1 ? a : 1, a >= 1 ? 1 : 1 / a);
  }

  set reveal(v: number) {
    this.mat.uniforms.uReveal.value = v;
    this.mesh.visible = v > 0.001;
  }
  set focus(v: number) { this.mat.uniforms.uFocus.value = v; }
  set zoom(v: number) { this.mat.uniforms.uZoom.value = v; }
  set nearMix(v: number) { this.mat.uniforms.uNearMix.value = v; }
  set maskR(v: number) { this.mat.uniforms.uMaskR.value = v; }
  set cover(v: number) { this.mat.uniforms.uCover.value = v; }
  center(x: number, y: number) { this.mat.uniforms.uCenter.value.set(x, y); }
  set flash(v: number) { this.mat.uniforms.uFlash.value = v; }
  pan(x: number, y: number) { this.mat.uniforms.uPan.value.set(x, y); }
  tick(t: number) { this.mat.uniforms.uTime.value = t; }

  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); }
}
