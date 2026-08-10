// Hero materials.
//
// Budget priority (highest first):
//   1. plush short-pile fabric   2. cold silver claw metal
//   3. acrylic panes             4. embroidery thread / tags
//
// The plush shader is a MeshStandardMaterial patched with two cheap tricks:
//   * a wrap/scatter term so light bleeds around the terminator (soft, not plastic)
//   * a fresnel "fuzz" term that lightens the silhouette like backlit pile
// A separate expanded shell mesh adds the actual fuzzy outline (see fuzzShell).

import * as THREE from '../vendor/three/three.module.min.js';
import { fabricNormalMap, fabricRoughnessMap, metalNormalMap, smudgeMap } from './textures.js';

const PLUSH_PATCH = {
  pars: /* glsl */`
    uniform vec3 uFuzzColor;
    uniform float uFuzzStrength;
    uniform float uFuzzPower;
    uniform float uScatter;
  `,
  end: /* glsl */`
    {
      vec3 V = normalize( vViewPosition );
      float fres = pow( clamp( 1.0 - abs( dot( normal, V ) ), 0.0, 1.0 ), uFuzzPower );
      // pile catches light at grazing angles
      reflectedLight.indirectDiffuse += fres * uFuzzColor * uFuzzStrength;
      // cheap scatter: soften the shadow terminator so the surface feels thick & soft
      reflectedLight.indirectDiffuse += uScatter * diffuseColor.rgb * ( 0.35 + 0.65 * clamp( normal.y * 0.5 + 0.5, 0.0, 1.0 ) );
    }
  `,
};

/**
 * @param {number|THREE.Color} color
 * @param {{fuzz?:number,fuzzTint?:number,scatter?:number,repeat?:number,roughness?:number}} [opt]
 */
export function plushMaterial(color, opt = {}) {
  const {
    fuzz = 0.10,
    fuzzTint = 0.45,   // how much the fuzz colour is pulled towards white
    scatter = 0.03,
    repeat = 9,
    roughness = 0.94,
  } = opt;

  const base = new THREE.Color(color);
  const fuzzColor = base.clone().lerp(new THREE.Color(0xffffff), fuzzTint);

  const nrm = fabricNormalMap().clone();
  nrm.needsUpdate = true;
  nrm.repeat.set(repeat, repeat);
  const rgh = fabricRoughnessMap().clone();
  rgh.needsUpdate = true;
  rgh.repeat.set(repeat * 0.6, repeat * 0.6);

  const mat = new THREE.MeshStandardMaterial({
    color: base,
    roughness,
    metalness: 0.0,
    normalMap: nrm,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: rgh,
    envMapIntensity: 0.32,
    dithering: true,
  });

  mat.userData.uniforms = {
    uFuzzColor: { value: fuzzColor },
    uFuzzStrength: { value: fuzz },
    uFuzzPower: { value: 2.4 },
    uScatter: { value: scatter },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PLUSH_PATCH.pars)
      .replace(
        '#include <lights_fragment_end>',
        '#include <lights_fragment_end>\n' + PLUSH_PATCH.end
      );
  };
  mat.customProgramCacheKey = () => 'plush';
  return mat;
}

const FUZZ_VERT = /* glsl */`
  uniform float uOffset;
  varying vec3 vN;
  varying vec3 vV;
  varying float vJit;
  void main() {
    vec3 n = normalize( normalMatrix * normal );
    // pseudo-random per-vertex jitter so the halo is uneven, like real pile
    float j = fract( sin( dot( position.xyz, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 );
    vJit = j;
    vec3 p = position + normal * uOffset * ( 0.55 + 0.75 * j );
    vec4 mv = modelViewMatrix * vec4( p, 1.0 );
    vN = n;
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const FUZZ_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uPower;
  varying vec3 vN;
  varying vec3 vV;
  varying float vJit;
  void main() {
    vec3 N = normalize( vN );
    vec3 V = normalize( vV );
    float fres = pow( clamp( 1.0 - abs( dot( N, V ) ), 0.0, 1.0 ), uPower );
    float a = fres * uStrength * ( 0.55 + 0.9 * vJit );
    if ( a < 0.004 ) discard;
    float lit = 0.72 + 0.38 * clamp( N.y * 0.5 + 0.5, 0.0, 1.0 );
    gl_FragColor = vec4( uColor * lit, a );
    #include <colorspace_fragment>
  }
`;

/**
 * Silhouette fuzz. Rendered as an expanded copy of a body part; alpha only
 * survives at grazing angles so it reads as loose fibres on the outline.
 */
export function fuzzMaterial(color, { offset = 0.016, strength = 0.5, power = 3.0 } = {}) {
  const c = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.22);
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: c },
      uStrength: { value: strength },
      uPower: { value: power },
      uOffset: { value: offset },
    },
    vertexShader: FUZZ_VERT,
    fragmentShader: FUZZ_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

let metalCache = null;
/** Cold silver claw metal: reflective, brushed, slightly warm in the highlights. */
export function clawMetalMaterial() {
  if (metalCache) return metalCache;
  const n = metalNormalMap().clone();
  n.needsUpdate = true;
  n.repeat.set(3, 3);
  metalCache = new THREE.MeshStandardMaterial({
    color: 0xcfd6de,
    metalness: 1.0,
    roughness: 0.22,
    normalMap: n,
    normalScale: new THREE.Vector2(0.35, 0.35),
    envMapIntensity: 1.5,
  });
  return metalCache;
}

let darkMetalCache = null;
export function darkMetalMaterial() {
  if (darkMetalCache) return darkMetalCache;
  darkMetalCache = new THREE.MeshStandardMaterial({
    color: 0x5b626c,
    metalness: 0.95,
    roughness: 0.42,
    envMapIntensity: 1.0,
  });
  return darkMetalCache;
}

/** Thin acrylic pane: reflections + edge light, no expensive refraction. */
export function acrylicMaterial() {
  const smudge = smudgeMap().clone();
  smudge.needsUpdate = true;
  smudge.repeat.set(1.4, 1.4);
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xdff0ff,
    metalness: 0.0,
    roughness: 0.045,
    transparent: true,
    opacity: 0.14,
    envMapIntensity: 2.0,
    depthWrite: false,
    side: THREE.FrontSide,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });
  m.map = smudge;
  m.emissive = new THREE.Color(0x0a1620);
  m.emissiveIntensity = 0.4;
  return m;
}

export function plasticMaterial(color, { roughness = 0.35, metalness = 0.05, clearcoat = 0.6 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.75,
  });
}

/** Satin embroidery thread — eyes, mouths, seams, ribbons. */
export function threadMaterial(color, { roughness = 0.34, sheen = 0.9 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0.0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.9,
  });
  m.sheen = sheen;
  m.sheenColor = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.6);
  m.sheenRoughness = 0.5;
  return m;
}

/** Glossy embroidered/plastic eye. */
export function eyeMaterial(color = 0x201a22) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.09,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.6,
  });
}

export function emissiveMaterial(color, intensity = 1.6) {
  return new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.5,
    metalness: 0,
  });
}
