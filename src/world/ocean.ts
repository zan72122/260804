import {
  Color,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'

/**
 * 海面。頂点でゲルストナー波を合成し、法線は解析的に求める。
 * 灯台のビームは「原点まわりの角度くさび」として海面に落とし、
 * 光の帯・きらめき・霧への抜けを一枚のシェーダで表現する。
 */

const vert = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uSwell;

varying vec3 vWorld;
varying vec3 vNormal;
varying float vFoam;

// dir, steepness, wavelength, speed
const int NW = 4;

vec3 gerstner(vec2 dir, float steep, float len, float speed, vec3 p, inout vec3 t, inout vec3 b) {
  float k = 6.28318 / len;
  float c = sqrt(9.8 / k);
  vec2 d = normalize(dir);
  float f = k * (dot(d, p.xz) - c * speed * uTime);
  float a = steep / k;
  float cf = cos(f), sf = sin(f);
  t += vec3(-d.x * d.x * steep * sf, d.x * steep * cf, -d.x * d.y * steep * sf);
  b += vec3(-d.x * d.y * steep * sf, d.y * steep * cf, -d.y * d.y * steep * sf);
  return vec3(d.x * a * cf, a * sf, d.y * a * cf);
}

void main() {
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 base = p;

  // 遠くほど波を平らにして、モアレと処理負荷を抑える
  float dist = length(base.xz);
  float atten = 1.0 / (1.0 + dist * 0.012);

  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binorm = vec3(0.0, 0.0, 1.0);
  vec3 disp = vec3(0.0);
  disp += gerstner(vec2( 1.0,  0.15), 0.34 * uSwell, 26.0, 1.0, base, tangent, binorm);
  disp += gerstner(vec2( 0.6, -0.8 ), 0.24 * uSwell, 14.0, 1.2, base, tangent, binorm);
  disp += gerstner(vec2(-0.4,  0.9 ), 0.16 * uSwell,  7.5, 1.5, base, tangent, binorm);
  disp += gerstner(vec2( 0.9, -0.35), 0.10 * uSwell,  3.4, 1.9, base, tangent, binorm);

  p += disp * atten;

  vec3 n = normalize(cross(binorm, tangent));
  vNormal = normalize(mix(vec3(0.0, 1.0, 0.0), n, atten));
  vWorld = p;
  vFoam = clamp(disp.y * 0.9 * atten, 0.0, 1.0);

  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

const frag = /* glsl */ `
precision highp float;

varying vec3 vWorld;
varying vec3 vNormal;
varying float vFoam;

uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uGlow;
uniform vec3 uSunDir;
uniform vec3 uCam;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uTime;
uniform float uNight;

uniform vec3 uBeamOrigin;
uniform float uBeamAngle;
uniform float uBeamHalf;
uniform float uBeamStrength;
uniform vec3 uBeamColor;
uniform float uRainbow;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 rainbowAt(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uCam - vWorld);
  float dist = length(uCam - vWorld);

  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);
  fres = mix(0.03, 1.0, fres);

  // 海の色（深さは視線角で近似）
  vec3 water = mix(uDeep, uShallow, clamp(dot(n, v) * 0.7, 0.0, 1.0));
  // 空の映り込み
  vec3 refl = mix(uSkyHorizon, uSkyZenith, clamp(reflect(-v, n).y * 1.6, 0.0, 1.0));
  vec3 col = mix(water, refl, fres * 0.7);

  // 夕日の道（水平線から手前へのびる光の路）
  vec3 sd = normalize(uSunDir);
  float sunSpec = pow(max(dot(reflect(-v, n), sd), 0.0), 90.0);
  float sunPath = pow(max(dot(reflect(-v, n), sd), 0.0), 6.0);
  float sunUp = smoothstep(-0.12, 0.06, sd.y);
  col += uGlow * (sunSpec * 2.4 + sunPath * 0.5) * sunUp;

  // --- 灯台のひかり ---
  vec2 rel = vWorld.xz - uBeamOrigin.xz;
  float rd = length(rel);
  float a = atan(rel.y, rel.x);
  float beam = 0.0;
  float lobe = 0.0;
  for (int i = 0; i < 2; i++) {
    float target = uBeamAngle + float(i) * 3.14159265;
    float diff = a - target;
    diff = atan(sin(diff), cos(diff));
    float w = smoothstep(uBeamHalf, uBeamHalf * 0.18, abs(diff));
    lobe = max(lobe, w);
    beam = max(beam, w);
  }
  // 灯台の足元は明るく、遠ざかるほど減衰。ただし遠くまで届く。
  float falloff = 1.0 / (1.0 + rd * rd * 0.00042);
  float nearMask = smoothstep(4.0, 22.0, rd);
  float lit = beam * falloff * nearMask * uBeamStrength;

  // 光の帯の中だけ波頭がきらめく
  vec3 toLamp = normalize(uBeamOrigin - vWorld);
  float glint = pow(max(dot(reflect(-v, n), toLamp), 0.0), 48.0);
  float speck = hash21(floor(vWorld.xz * 3.0) + floor(uTime * 3.0));
  vec3 bc = uBeamColor;
  if (uRainbow > 0.5) bc = mix(uBeamColor, rainbowAt(rd * 0.006 + uTime * 0.05), 0.75);

  col += bc * lit * 1.7;
  col += bc * lit * glint * 7.0;
  col += bc * lit * step(0.86, speck) * 0.55;

  // 波頭の白
  float foam = smoothstep(0.42, 0.95, vFoam) * (0.35 + 0.65 * (1.0 - uNight));
  vec3 foamCol = mix(vec3(0.86, 0.88, 0.95), uGlow + vec3(0.4), 0.35);
  col = mix(col, foamCol, foam * 0.5);

  // 空気遠近
  float fogAmt = 1.0 - exp(-dist * uFogDensity);
  col = mix(col, uFogColor, clamp(fogAmt, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

export class Ocean {
  readonly mesh: Mesh
  readonly mat: ShaderMaterial

  constructor(quality: number) {
    const seg = quality > 0.75 ? 200 : quality > 0.45 ? 140 : 96
    const geo = new PlaneGeometry(1800, 1800, seg, seg)
    geo.rotateX(-Math.PI / 2)
    this.mat = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uSwell: { value: 1 },
        uDeep: { value: new Color(0x0b1836) },
        uShallow: { value: new Color(0x22406b) },
        uSkyZenith: { value: new Color(0x4f6bb5) },
        uSkyHorizon: { value: new Color(0xffb27a) },
        uGlow: { value: new Color(0xff9d5c) },
        uSunDir: { value: new Vector3(-0.92, 0.1, 0.42).normalize() },
        uCam: { value: new Vector3() },
        uFogColor: { value: new Color(0x6a5a70) },
        uFogDensity: { value: 0.004 },
        uNight: { value: 0 },
        uBeamOrigin: { value: new Vector3(0, 34, 0) },
        uBeamAngle: { value: 0 },
        uBeamHalf: { value: 0.13 },
        uBeamStrength: { value: 0 },
        uBeamColor: { value: new Color(0xffe2a0) },
        uRainbow: { value: 0 },
      },
    })
    this.mesh = new Mesh(geo, this.mat)
    this.mesh.name = 'ocean'
    this.mesh.position.y = 0
    this.mesh.renderOrder = -10
    this.mesh.frustumCulled = false
  }

  /** 海面のだいたいの高さ（船を浮かせるのに使う。頂点シェーダの主要2波と合わせる） */
  static heightAt(x: number, z: number, time: number, swell: number) {
    let y = 0
    const waves: [number, number, number, number, number][] = [
      [1.0, 0.15, 0.34, 26.0, 1.0],
      [0.6, -0.8, 0.24, 14.0, 1.2],
    ]
    for (const [dx, dz, steep, len, speed] of waves) {
      const l = Math.hypot(dx, dz)
      const nx = dx / l
      const nz = dz / l
      const k = (Math.PI * 2) / len
      const c = Math.sqrt(9.8 / k)
      const f = k * (nx * x + nz * z - c * speed * time)
      y += (steep * swell / k) * Math.sin(f)
    }
    const atten = 1 / (1 + Math.hypot(x, z) * 0.012)
    return y * atten
  }
}
