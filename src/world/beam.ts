import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three'
import { TOWER } from './lighthouse'

const LENGTH = 520
const H_HALF = 0.10 // ラジアン
const V_HALF = 0.055

const vert = /* glsl */ `
precision highp float;
attribute float aT;
attribute float aR;
varying float vT;
varying float vR;
varying vec3 vWorld;
void main() {
  vT = aT;
  vR = aR;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const frag = /* glsl */ `
precision highp float;
varying float vT;
varying float vR;
varying vec3 vWorld;

uniform vec3 uColor;
uniform float uStrength;
uniform float uDensity;
uniform float uTime;
uniform vec3 uCam;
uniform float uRainbow;
uniform float uSwirl;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

vec3 rainbowAt(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t));
}

void main() {
  // 内側の筒ほど明るい（3枚が重なって芯ができる）
  float edge = 1.0 - clamp(vR, 0.0, 1.0);
  float radial = 0.30 + edge * 0.85;

  // 距離による減衰（遠くまで届くが薄くなる）
  float lenFade = (1.0 - smoothstep(0.55, 1.0, vT)) * (0.35 + 0.65 / (1.0 + vT * vT * 5.0));
  // 根元は光源に隠れるのでほんの少し絞る
  lenFade *= smoothstep(0.0, 0.035, vT);

  // 霧のむら（立体感）
  float n = noise(vec3(vWorld.xz * 0.045, uTime * 0.22 + vWorld.y * 0.05));
  float n2 = noise(vec3(vWorld.xz * 0.14, uTime * 0.5));
  float mottle = mix(1.0, 0.55 + n * 0.75 + n2 * 0.28, uDensity * 0.85);

  // 磨き方のクセで筋の模様がすこし変わる
  float ripple = 1.0 + uSwirl * 0.35 * sin(vR * 18.0 + vT * 26.0 - uTime * 2.0);

  float a = radial * lenFade * mottle * ripple * uStrength * (0.105 + uDensity * 0.17);

  // 見る角度：横から見るほど筋がはっきりする
  vec3 vd = normalize(vWorld - uCam);
  a *= 0.55 + 0.45 * (1.0 - abs(vd.y));

  vec3 c = uColor;
  if (uRainbow > 0.5) c = mix(uColor, rainbowAt(vT * 1.6 + uTime * 0.06), 0.6);

  gl_FragColor = vec4(c * (0.75 + radial * 0.5), clamp(a, 0.0, 0.7));
  #include <colorspace_fragment>
}
`

function buildWedge(segments: number) {
  const pos: number[] = []
  const aT: number[] = []
  const aR: number[] = []
  const idx: number[] = []

  // 内部にフィンを張ると加算合成が何枚も重なって白飛びするので、
  // 太さのちがう筒を3枚だけ入れ子にして、やわらかい芯を作る。
  const SHELLS = [1.0, 0.62, 0.3]
  const CS = 8

  for (const shell of SHELLS) {
    const base = pos.length / 3
    for (let i = 0; i <= segments; i++) {
      const t = Math.pow(i / segments, 1.25)
      const d = t * LENGTH
      const hw = (Math.tan(H_HALF) * d + 0.5) * shell
      const hh = (Math.tan(V_HALF) * d + 0.62) * shell
      const droop = -t * t * 6.0
      for (let k = 0; k < CS; k++) {
        const a = (k / CS) * Math.PI * 2
        pos.push(d, Math.sin(a) * hh + droop, Math.cos(a) * hw)
        aT.push(t)
        aR.push(shell)
      }
    }
    for (let i = 0; i < segments; i++) {
      const r0 = base + i * CS
      const r1 = base + (i + 1) * CS
      for (let k = 0; k < CS; k++) {
        const k2 = (k + 1) % CS
        idx.push(r0 + k, r1 + k, r1 + k2, r0 + k, r1 + k2, r0 + k2)
      }
    }
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('aT', new BufferAttribute(new Float32Array(aT), 1))
  g.setAttribute('aR', new BufferAttribute(new Float32Array(aR), 1))
  g.setIndex(idx)
  g.computeBoundingSphere()
  if (g.boundingSphere) g.boundingSphere.radius = LENGTH * 1.2
  return g
}

/** 回転する光の筋（2枚） */
export class Beam {
  readonly group = new Group()
  readonly mat: ShaderMaterial
  private beams: Mesh[] = []

  constructor(quality: number) {
    this.group.position.set(0, TOWER.lensY, 0)
    this.mat = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uColor: { value: new Color(0xffe2a0) },
        uStrength: { value: 0 },
        uDensity: { value: 0.55 },
        uTime: { value: 0 },
        uCam: { value: new Vector3() },
        uRainbow: { value: 0 },
        uSwirl: { value: 0 },
      },
    })
    const geo = buildWedge(quality > 0.6 ? 26 : 16)
    for (let i = 0; i < 2; i++) {
      const m = new Mesh(geo, this.mat)
      m.rotation.y = -i * Math.PI
      m.renderOrder = 20
      m.frustumCulled = false
      this.beams.push(m)
      this.group.add(m)
    }
    this.group.visible = false
  }

  set strength(v: number) {
    this.mat.uniforms.uStrength.value = v
    this.group.visible = v > 0.001
  }
  get strength() { return this.mat.uniforms.uStrength.value as number }

  setAngle(a: number) {
    // Three の Y 回転は右手系。海面シェーダの atan2(z,x) と揃える。
    this.group.rotation.y = -a
  }

  update(time: number, cam: Vector3, color: Color, density: number, rainbow: boolean, swirl: number) {
    const u = this.mat.uniforms
    u.uTime.value = time
    ;(u.uCam.value as Vector3).copy(cam)
    ;(u.uColor.value as Color).copy(color)
    u.uDensity.value = density
    u.uRainbow.value = rainbow ? 1 : 0
    u.uSwirl.value = swirl
  }
}
