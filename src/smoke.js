// Height-stratified smoke.
//
// This is the heart of the game. Hot smoke banks against the ceiling and leaves
// a breathable, *seeable* layer near the floor, so density is modelled as an
// exponential that grows towards the ceiling:
//
//     d(y) = floor + A * exp( (y - top) / H )
//
// Because that is analytically integrable along a straight ray, every surface
// shader can solve the exact optical depth between the camera and the fragment
// in a couple of instructions. The pay-off: when the player drops to the floor
// the camera leaves the dense layer and the integral collapses, so the room
// *opens up* in a single continuous motion rather than by toggling a fog value.

import * as THREE from '../vendor/three.module.js';

export const smokeUniforms = {
  uSmokeTop: { value: 2.45 },     // ceiling height, the density reference plane
  uSmokeH: { value: 0.36 },       // scale height of the layer (metres)
  uSmokeA: { value: 6.00 },       // density at the reference plane (1/m)
  uSmokeFloor: { value: 0.022 },  // haze that fills even the clear layer
  uSmokeColor: { value: new THREE.Color(0x4b4034).convertSRGBToLinear() },
  uSmokeLit: { value: new THREE.Color(0x9d8b74).convertSRGBToLinear() },
  uSmokeMul: { value: 1.0 },      // global dial: 0 = clear air (used on rescue)
  uSmokeTime: { value: 0 },
  uBeamOrigin: { value: new THREE.Vector3() },
  uBeamDir: { value: new THREE.Vector3(0, 0, -1) },
  uBeamStrength: { value: 0.0 },
  uBeamCos: { value: Math.cos(0.38) },
};

const COMMON = /* glsl */`
varying vec3 vSmokeWorld;
uniform float uSmokeTop, uSmokeH, uSmokeA, uSmokeFloor, uSmokeMul, uSmokeTime;
uniform vec3 uSmokeColor, uSmokeLit;
uniform vec3 uBeamOrigin, uBeamDir;
uniform float uBeamStrength, uBeamCos;

float smk_hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float smk_noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(smk_hash(i + vec3(0,0,0)), smk_hash(i + vec3(1,0,0)), f.x),
                 mix(smk_hash(i + vec3(0,1,0)), smk_hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(smk_hash(i + vec3(0,0,1)), smk_hash(i + vec3(1,0,1)), f.x),
                 mix(smk_hash(i + vec3(0,1,1)), smk_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

// Optical depth of the stratified layer between two world points.
float smk_depth(vec3 a, vec3 b) {
  vec3 d = b - a;
  float L = length(d);
  if (L < 1e-4) return 0.0;
  float dy = d.y;
  float e0 = exp((a.y - uSmokeTop) / uSmokeH);
  float e1 = exp((b.y - uSmokeTop) / uSmokeH);
  float integ;
  if (abs(dy) > 1e-3) integ = uSmokeA * L * uSmokeH / dy * (e1 - e0);
  else integ = uSmokeA * L * e0;
  integ += uSmokeFloor * L;
  // Slow rolling turbulence so the layer breathes instead of sitting still.
  vec3 mid = (a + b) * 0.5;
  float n = smk_noise(mid * 0.52 + vec3(uSmokeTime * 0.05, uSmokeTime * 0.022, uSmokeTime * 0.04));
  integ *= 0.74 + 0.52 * n;
  return max(integ, 0.0) * uSmokeMul;
}

// Torch light scattering back off the particles between eye and surface.
float smk_inscatter(vec3 eye, vec3 frag) {
  if (uBeamStrength <= 0.001) return 0.0;
  vec3 v = frag - eye;
  float L = min(length(v), 7.0);
  if (L < 1e-3) return 0.0;
  vec3 dir = v / L;
  float acc = 0.0;
  for (int i = 0; i < 3; i++) {
    float t = (float(i) + 0.5) / 3.0;
    vec3 p = eye + dir * (L * t);
    vec3 toP = p - uBeamOrigin;
    float dist = length(toP);
    float c = dot(toP / max(dist, 1e-3), uBeamDir);
    float cone = smoothstep(uBeamCos, uBeamCos * 0.55 + 0.45, c);
    float atten = 1.0 / (1.0 + dist * dist * 0.32);
    // Only the particles that actually exist scatter light.
    float dens = uSmokeFloor + uSmokeA * exp((p.y - uSmokeTop) / uSmokeH);
    acc += cone * atten * min(dens, 2.2);
  }
  return acc / 3.0 * L * uBeamStrength * uSmokeMul;
}
`;

const VERT_HOOK = /* glsl */`
#include <worldpos_vertex>
vSmokeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

const FRAG_HOOK = /* glsl */`
{
  float od = smk_depth(cameraPosition, vSmokeWorld);
  float T = exp(-od);
  float dist = length(vSmokeWorld - cameraPosition);
  vec3 smokeCol = mix(uSmokeColor, uSmokeLit, exp(-dist * 0.22));
  float scat = smk_inscatter(cameraPosition, vSmokeWorld);
  smokeCol += uSmokeLit * scat * 1.9;
  gl_FragColor.rgb = mix(smokeCol, gl_FragColor.rgb, T);
}
#include <tonemapping_fragment>
`;

const patched = new WeakSet();

/** Injects the smoke integral into any standard/physical/lambert material. */
export function applySmoke(material) {
  if (!material || patched.has(material)) return material;
  patched.add(material);
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    Object.assign(shader.uniforms, smokeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSmokeWorld;')
      .replace('#include <worldpos_vertex>', VERT_HOOK);
    // Some materials omit worldpos_vertex; make sure the varying is still written.
    if (shader.vertexShader.indexOf('vSmokeWorld =') === -1) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        'vSmokeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>'
      );
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON)
      .replace('#include <tonemapping_fragment>', FRAG_HOOK);
  };
  material.customProgramCacheKey = () => 'smoke1';
  material.needsUpdate = true;
  return material;
}

/** Density at a height, in world units — used by gameplay code and the HUD. */
export function densityAt(y) {
  const u = smokeUniforms;
  return (u.uSmokeFloor.value + u.uSmokeA.value * Math.exp((y - u.uSmokeTop.value) / u.uSmokeH.value)) * u.uSmokeMul.value;
}

/** How far the player can see from a given eye height (metres, horizontal ray). */
export function visibilityAt(y) {
  const d = densityAt(y);
  return d < 1e-4 ? 999 : Math.min(999, 2.2 / d);
}
