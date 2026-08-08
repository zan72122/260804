/**
 * Hero materials.
 *
 * The lab furniture uses ordinary lit MeshStandardMaterials. The five hero
 * surfaces (paraffin, ribbon, water, glass, fluorescence) are custom shaders
 * with a hard-coded key/fill direction — that costs nothing, keeps the look
 * exactly art-directed, and lets one global uniform dim every one of them when
 * the lab lights go out for the dark-room scene.
 */
import * as THREE from 'three';

/**
 * A small studio environment. Without one, every metalness>0 surface renders
 * black — which is exactly what a stainless microtome must not do.
 */
export function buildEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 16, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP;
      void main() {
        vec3 d = normalize(vP);
        // cool sky, warm key panel up-front-left, dark floor
        vec3 c = mix(vec3(0.06, 0.09, 0.13), vec3(0.42, 0.55, 0.70), smoothstep(-0.5, 0.9, d.y));
        float key = pow(max(dot(d, normalize(vec3(-0.45, 0.72, 0.52))), 0.0), 6.0);
        c += vec3(1.6, 1.5, 1.35) * key;
        float panel = pow(max(dot(d, normalize(vec3(0.1, 0.25, -1.0))), 0.0), 3.0);
        c += vec3(0.55, 0.72, 0.9) * panel * 0.8;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.04);
  pmrem.dispose();
  geo.dispose();
  mat.dispose();
  return rt.texture;
}

/** Global lighting level, 1 = bright lab, ~0.1 = dark room. */
export const lightState = { level: 1, warm: 1 };
const lit: THREE.ShaderMaterial[] = [];

export function registerLit(m: THREE.ShaderMaterial) {
  if (!m.uniforms.uLight) m.uniforms.uLight = { value: 1 };
  lit.push(m);
  return m;
}

export function setLightLevel(v: number) {
  lightState.level = v;
  for (const m of lit) m.uniforms.uLight.value = v;
}

export function tickMaterials(t: number) {
  for (const m of lit) if (m.uniforms.uTime) m.uniforms.uTime.value = t;
}

/** Shared GLSL: key light from upper-front-left, cool fill from behind. */
export const LIGHT_GLSL = /* glsl */ `
  const vec3 KEY_DIR = normalize(vec3(-0.45, 0.82, 0.55));
  const vec3 KEY_COL = vec3(1.0, 0.965, 0.90);
  const vec3 FILL_DIR = normalize(vec3(0.6, 0.25, -0.7));
  const vec3 FILL_COL = vec3(0.42, 0.56, 0.72);
  const vec3 AMB_COL = vec3(0.20, 0.245, 0.31);
`;

// ---------------------------------------------------------------------------
// Paraffin — milky, waxy, with the tissue faintly readable inside.
// ---------------------------------------------------------------------------
export function makeParaffinMaterial(): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: THREE.FrontSide,
    uniforms: {
      uLight: { value: 1 },
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(0xf6efe2) },
      uOpacity: { value: 0.9 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vLocal;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        vLocal = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      uniform float uLight; uniform float uOpacity; uniform vec3 uTint;
      varying vec3 vN; varying vec3 vV; varying vec3 vLocal;
      void main() {
        vec3 N = normalize(vN);
        float key = max(dot(N, KEY_DIR), 0.0);
        // wrapped diffuse fakes the soft internal scatter of wax: even the
        // faces turned away from the key light stay milky and bright
        float wrap = max((dot(N, KEY_DIR) + 0.85) / 1.85, 0.0);
        float fill = max(dot(N, FILL_DIR), 0.0);
        float fres = pow(1.0 - max(dot(N, normalize(vV)), 0.0), 2.2);
        vec3 col = uTint * (AMB_COL * 2.1 + KEY_COL * (key * 0.30 + wrap * 0.95)
                            + FILL_COL * fill * 0.35);
        // waxy sheen, blunt and low-frequency
        vec3 H = normalize(KEY_DIR + normalize(vV));
        float spec = pow(max(dot(N, H), 0.0), 26.0) * 0.45;
        col += KEY_COL * spec;
        col += vec3(0.72, 0.78, 0.86) * fres * 0.42;
        // a hint of internal cloudiness
        col *= 0.95 + 0.05 * sin(vLocal.y * 60.0 + vLocal.x * 31.0);
        gl_FragColor = vec4(col * uLight, uOpacity * (0.72 + fres * 0.24));
      }`,
  });
  return registerLit(m);
}

// ---------------------------------------------------------------------------
// Glass — slides and cover glass. No refraction: edge highlights instead, so
// the child never loses track of where the glass is.
// ---------------------------------------------------------------------------
export function makeGlassMaterial(opts: { tint?: number; edge?: number; opacity?: number } = {}) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uLight: { value: 1 },
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(opts.tint ?? 0xdff2ff) },
      uEdge: { value: opts.edge ?? 1 },
      uOpacity: { value: opts.opacity ?? 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      uniform float uLight; uniform vec3 uTint; uniform float uEdge; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        vec3 N = normalize(vN);
        float fres = pow(1.0 - abs(dot(N, normalize(vV))), 2.6);
        vec3 H = normalize(KEY_DIR + normalize(vV));
        float spec = pow(max(dot(N, H), 0.0), 90.0);
        // bright border so the pane is always locatable
        vec2 d = min(vUv, 1.0 - vUv);
        float border = 1.0 - smoothstep(0.0, 0.045, min(d.x, d.y));
        float a = 0.06 + fres * 0.30 + spec * 0.9 + border * 0.42 * uEdge;
        vec3 col = uTint * (0.55 + fres * 0.5) + vec3(1.0) * spec * 0.9;
        col += uTint * border * 0.7 * uEdge;
        gl_FragColor = vec4(col * uLight, clamp(a, 0.0, 1.0) * uOpacity);
      }`,
  });
  return registerLit(m);
}

// ---------------------------------------------------------------------------
// Simple lit surfaces for the lab set.
// ---------------------------------------------------------------------------
export const metal = (color: number, rough = 0.35, metalness = 0.9) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness });

export const plastic = (color: number, rough = 0.6) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });

/** Emissive ring sprite used for hints and snap targets. */
export function makeRingMaterial(color: THREE.ColorRepresentation) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uPulse: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime; uniform float uPulse;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float w = 0.13 + 0.05 * sin(uTime * 3.2);
        float ring = smoothstep(1.0, 1.0 - w, r) * smoothstep(0.52 - w, 0.62, r);
        float halo = smoothstep(1.0, 0.15, r) * 0.09;
        float a = (ring * 0.42 + halo) * uPulse;
        // dashed spokes read as "turn me"
        float ang = atan(p.y, p.x);
        a *= 0.75 + 0.25 * smoothstep(0.2, 0.8, abs(sin(ang * 6.0 - uTime * 2.0)));
        gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
      }`,
  });
}
