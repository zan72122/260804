import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 麻の質感。標準の物理マテリアルに、繊維のすじ・けば・撚りの角度を差し込む。
// uv.x = 断面まわり(0..1)、uv.y = 長さ方向(メートル)。
// 撚りが進むと繊維のらせん角が立ち、すじが斜めに寝ていく。
// ---------------------------------------------------------------------------

const COMMON = /* glsl */ `
uniform float uTurns;     // 1メートルあたりの繊維の巻き数
uniform float uBump;      // すじの深さ(メートル)
uniform float uDirt;      // 汚れの強さ
uniform vec3  uDark;
uniform vec3  uLight;
varying float vLaid;
varying float vTone;

float hash11(float p){
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// q: 繊維座標(1周で1.0)  v: 長さ(m)  nf: 本数(整数で継ぎ目なし)
float fiberLayer(float q, float v, float nf, float seed, out float tone){
  float x = q * nf + seed;
  float i = floor(x);
  float f = x - i;
  float ii = mod(i, nf);
  float r  = hash11(ii + seed * 13.0);
  float c  = 0.5 + (hash11(ii + 3.7) - 0.5) * 0.55;
  float w  = 0.32 + r * 0.42;
  float d  = (f - c) / w;
  float ridge = exp(-d * d * 2.7);
  float lv = sin(v * (7.0 + r * 26.0) + r * 47.0) * 0.5 + 0.5;
  ridge *= 0.45 + 0.55 * lv;
  tone = r;
  return ridge;
}

float fiberHeight(vec2 uv, float laid, out float tone){
  float turns = uTurns * (1.0 + 0.25 * laid);
  float q = uv.x - turns * uv.y;
  float t1, t2;
  float h1 = fiberLayer(q, uv.y, 21.0, 0.0, t1);
  float h2 = fiberLayer(q, uv.y * 1.17 + 0.31, 7.0, 5.0, t2);
  tone = t1 * 0.7 + t2 * 0.3;
  return h1 * 0.64 + h2 * 0.36;
}
`;

export function fiberMaterial(opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
    ...opts.base,
  });

  mat.userData.uniforms = {
    uTurns: { value: 1.2 },
    uBump: { value: 0.0016 },
    uDirt: { value: 0.35 },
    uDark: { value: new THREE.Color(0x4a3417) },
    uLight: { value: new THREE.Color(0xe4c691) },
  };

  mat.defines = { ...(mat.defines || {}), USE_UV: '' };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aLaid;
         attribute float aTone;
         varying float vLaid;
         varying float vTone;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vLaid = aLaid;
         vTone = aTone;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float gTone;
         float gH = fiberHeight(vUv, vLaid, gTone);
         vec3 gCol = mix(uDark, uLight, pow(clamp(gH, 0.0, 1.0), 0.68));
         gCol *= 0.80 + 0.40 * vTone;
         gCol *= 0.86 + 0.28 * gTone;
         float gDirt = 0.5 + 0.5 * sin(vUv.y * 1.6 + vTone * 9.0) * sin(vUv.y * 0.41 + 2.0);
         gCol *= mix(1.0, 0.72, gDirt * uDirt);
         diffuseColor.rgb *= gCol;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp(0.99 - gH * 0.34 - vLaid * 0.06, 0.34, 1.0);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         {
           float Hs = gH * uBump;
           vec3 sx = dFdx(-vViewPosition);
           vec3 sy = dFdy(-vViewPosition);
           vec3 R1 = cross(sy, normal);
           vec3 R2 = cross(normal, sx);
           float det = dot(sx, R1);
           vec3 grad = sign(det) * (dFdx(Hs) * R1 + dFdy(Hs) * R2);
           normal = normalize(abs(det) * normal - grad);
         }`
      );
  };

  // onBeforeCompile を変えたら再コンパイルさせるための鍵
  mat.customProgramCacheKey = () => 'fiber-v1';
  return mat;
}
