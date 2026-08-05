/**
 * 標準マテリアルに後付けする共有シェーダ断片。
 * コースティクス（水面が作る光の網）と、海藻のゆらぎをここで注入する。
 */
import * as THREE from 'three';

export const CAUSTIC_GLSL = /* glsl */ `
  // ゼロ除算を避ける（0 に張り付くと Inf → NaN になり、画面が真っ黒になる）
  float safeDiv(float v) {
    float s = v < 0.0 ? -1.0 : 1.0;
    return s * max(abs(v), 0.02);
  }

  float ccaustic(vec2 p, float t) {
    vec2 i = p;
    float c = 1.0;
    const float inten = 0.0048;
    for (int n = 0; n < 3; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      vec2 q = vec2(p.x * inten / safeDiv(sin(i.x + tt)),
                    p.y * inten / safeDiv(cos(i.y + tt)));
      c += 1.0 / max(length(q), 1e-3);
    }
    c = clamp(c / 3.0, 0.0, 2.0);
    c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 7.0), 0.0, 1.5);
  }
`;

/**
 * MeshStandardMaterial にコースティクスを乗せる。
 * uniforms は共有オブジェクトを渡すこと（毎フレームまとめて更新するため）。
 */
export function applyCaustics(material, shared, opts = {}) {
  const scale = opts.scale ?? 0.62;
  const strength = opts.strength ?? 1.0;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.time;
    shader.uniforms.uCaustic = shared.caustic;
    shader.uniforms.uCausticScale = { value: scale };
    shader.uniforms.uCausticGain = { value: strength };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCausticWorld;')
      .replace(
        '#include <project_vertex>',
        'vCausticWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>'
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vCausticWorld;
         uniform float uTime;
         uniform float uCaustic;
         uniform float uCausticScale;
         uniform float uCausticGain;
         ${CAUSTIC_GLSL}`
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
         {
           vec3 wN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
           float up = smoothstep(-0.15, 0.75, wN.y);
           // 横向きの面は xy 平面で網目を取り、上向きの面は xz 平面で取る。
           vec2 pTop = vCausticWorld.xz * uCausticScale;
           vec2 pSide = vec2(vCausticWorld.x, vCausticWorld.y * 0.7) * uCausticScale;
           float cTop = ccaustic(pTop, uTime * 0.55);
           float cSide = ccaustic(pSide, uTime * 0.45);
           float c = mix(cSide * 0.55, cTop, up);
           float depthFade = smoothstep(-1.0, 5.5, vCausticWorld.y);
           gl_FragColor.rgb += vec3(0.42, 0.86, 1.0) * c * uCaustic * uCausticGain * (0.35 + depthFade * 0.9);
         }`
      );
    material.userData.shader = shader;
  };
  // 生成されるソースは全マテリアル共通（scale などは uniform）。
  // キーを固定して 1 本のプログラムを共有し、コンパイル回数を抑える。
  material.customProgramCacheKey = () => 'ccr-caustic';
  return material;
}

/** 海藻・水草をゆらす頂点シェーダ。根元は動かさず、先ほどよく揺れる。 */
export function applySway(material, shared, opts = {}) {
  const amount = opts.amount ?? 0.22;
  const speed = opts.speed ?? 1.0;
  const phase = opts.phase ?? 0;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.time;
    shader.uniforms.uFlow = shared.flow;
    shader.uniforms.uSwayAmount = { value: amount };
    shader.uniforms.uSwaySpeed = { value: speed };
    shader.uniforms.uSwayPhase = { value: phase };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uFlow;
         uniform float uSwayAmount;
         uniform float uSwaySpeed;
         uniform float uSwayPhase;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           float h = clamp(transformed.y / 2.6, 0.0, 1.0);
           float w = pow(h, 1.7);
           float t = uTime * uSwaySpeed + uSwayPhase;
           transformed.x += (sin(t) * 0.7 + sin(t * 1.9 + 1.3) * 0.3) * uSwayAmount * w * (1.0 + uFlow);
           transformed.z += cos(t * 0.8 + 0.7) * uSwayAmount * 0.5 * w * (1.0 + uFlow);
         }`
      );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'ccr-sway';
  return material;
}

/** 魚の体をくねらせる頂点シェーダ。頭は動かさない。 */
export function applyFishWave(material, shared, opts = {}) {
  const amp = opts.amp ?? 0.16;
  const freq = opts.freq ?? 4.2;
  const speed = opts.speed ?? 6.0;
  const phase = opts.phase ?? 0;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shared.time;
    shader.uniforms.uWaveAmp = { value: amp };
    shader.uniforms.uWaveFreq = { value: freq };
    shader.uniforms.uWaveSpeed = { value: speed };
    shader.uniforms.uWavePhase = { value: phase };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform float uWaveAmp;
         uniform float uWaveFreq;
         uniform float uWaveSpeed;
         uniform float uWavePhase;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         {
           float tailMask = 1.0 - smoothstep(-0.75, 0.25, transformed.x);
           transformed.z += sin(transformed.x * uWaveFreq - uTime * uWaveSpeed + uWavePhase) * uWaveAmp * tailMask;
         }`
      );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'ccr-fishwave';
  return material;
}

/** 共有 uniform。毎フレーム main から更新する。 */
export function createSharedUniforms() {
  return {
    time: { value: 0 },
    caustic: { value: 0.5 },
    flow: { value: 0 },
    clarity: { value: 0 },
    waterColor: { value: new THREE.Color(0x2f4a33) },
  };
}
