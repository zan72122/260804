import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { skyColors, type WeatherPreset } from '../core/palette'

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
`

const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;

uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSunDir;
uniform float uStars;
uniform float uTime;
uniform float uHaze;
uniform vec3 uFogTint;
uniform vec3 uBeamColor;
uniform float uBeamAmount;

// --- ハッシュ関数（星と雲用） ---
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);

  // 天頂〜水平の段階的なグラデーション
  float up = pow(clamp(d.y, 0.0, 1.0), 0.55);
  vec3 col = mix(uHorizon, uZenith, up);

  // 太陽まわりの残照
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float glow = pow(sd, 5.0) * 0.85 + pow(sd, 42.0) * 1.3;
  float horizonBand = exp(-abs(d.y) * 7.0);
  col += uGlow * (glow + horizonBand * 0.5);

  // 帯状の雲（夕焼けを受けて下面がほんのり染まる）
  vec2 cp = d.xz / max(0.08, d.y + 0.22);
  float cloud = fbm(cp * 0.85 + vec2(uTime * 0.006, uTime * 0.0035));
  cloud = smoothstep(0.48, 0.86, cloud) * smoothstep(0.0, 0.28, d.y);
  vec3 cloudCol = mix(uFogTint * 0.9, uGlow * 1.15 + uHorizon * 0.5, pow(sd, 1.4) * 0.8 + 0.18);
  col = mix(col, cloudCol, cloud * (0.42 + uHaze * 0.25));

  // 星（夜になるほど出てくる。まばたきはゆっくり）
  if (uStars > 0.001 && d.y > -0.02) {
    vec2 sp = d.xz / (abs(d.y) + 0.35) * 26.0;
    vec2 cell = floor(sp);
    float r = hash21(cell);
    if (r > 0.955) {
      vec2 off = vec2(hash21(cell + 3.7), hash21(cell + 9.1));
      float dist = length(fract(sp) - off);
      float star = smoothstep(0.11, 0.0, dist);
      float tw = 0.62 + 0.38 * sin(uTime * (0.7 + r * 2.4) + r * 30.0);
      // ほんのり色づいた星（ピンク〜水色）
      vec3 tint = mix(vec3(1.0, 0.86, 0.93), vec3(0.85, 0.94, 1.0), hash21(cell + 17.3));
      col += tint * star * tw * uStars * smoothstep(-0.02, 0.3, d.y) * 1.25;
    }
  }

  // 灯台の光が空／霧をうっすら舐める
  col += uBeamColor * uBeamAmount * exp(-abs(d.y - 0.06) * 5.0) * 0.35;

  // 空気遠近：水平線ぎわを霧の色へ寄せる
  col = mix(col, uFogTint * mix(0.35, 0.85, 1.0 - uStars), horizonBand * uHaze * 0.85);

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`

export class Sky {
  readonly mesh: Mesh
  readonly mat: ShaderMaterial
  readonly sunDir = new Vector3(-0.92, 0.16, 0.42).normalize()
  readonly horizonColor = new Color()
  readonly fogColor = new Color()

  constructor() {
    this.mat = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new Color(0x4f6bb5) },
        uHorizon: { value: new Color(0xffb27a) },
        uGlow: { value: new Color(0xff9d5c) },
        uSunDir: { value: this.sunDir },
        uStars: { value: 0 },
        uTime: { value: 0 },
        uHaze: { value: 0.3 },
        uFogTint: { value: new Color(0.44, 0.35, 0.5) },
        uBeamColor: { value: new Color(0xffe2a0) },
        uBeamAmount: { value: 0 },
      },
    })
    this.mesh = new Mesh(new SphereGeometry(900, 40, 24), this.mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1000
    this.mesh.name = 'sky'
  }

  update(t: number, weather: WeatherPreset, time: number, beamAmount: number, beamColor: Color) {
    const c = skyColors(t, weather)
    const u = this.mat.uniforms
    ;(u.uZenith.value as Color).copy(c.zenith)
    ;(u.uHorizon.value as Color).copy(c.horizon)
    ;(u.uGlow.value as Color).copy(c.glow)
    u.uStars.value = c.starAmount
    u.uTime.value = time
    u.uHaze.value = weather.haze
    ;(u.uFogTint.value as Color).setRGB(weather.fogTint[0], weather.fogTint[1], weather.fogTint[2])
    u.uBeamAmount.value = beamAmount
    ;(u.uBeamColor.value as Color).copy(beamColor)

    // 太陽は塔の左手前。塔が横から当たって立体に見え、夕焼けも画面に入る。
    this.sunDir.set(-0.92, c.sunHeight, 0.42).normalize()
    this.horizonColor.copy(c.horizon)
    // シーン全体の霧色：水平線の色と天気の霧色をまぜる
    this.fogColor
      .setRGB(weather.fogTint[0], weather.fogTint[1], weather.fogTint[2])
      .multiplyScalar(0.55 + 0.45 * (1 - t))
      .lerp(c.horizon, 0.42)
  }
}
