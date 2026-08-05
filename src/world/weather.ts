import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { WeatherPreset } from '../core/palette'
import { TOWER } from './lighthouse'

const vert = /* glsl */ `
precision highp float;
attribute vec3 aSeed;
attribute float aSize;
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uBox;
uniform float uFall;
uniform float uDrift;
uniform float uPix;
varying vec3 vWorld;
varying float vSeed;

void main() {
  vec3 p = position;
  // カメラのまわりの箱の中で無限にループさせる
  p.y -= uTime * uFall * (0.5 + aSeed.y);
  p.x += sin(uTime * (0.2 + aSeed.x * 0.5) + aSeed.z * 6.28) * uDrift;
  p.z += cos(uTime * (0.17 + aSeed.z * 0.4) + aSeed.x * 6.28) * uDrift;
  vec3 rel = p - uCam;
  rel = mod(rel + uBox * 0.5, uBox) - uBox * 0.5;
  vec3 w = uCam + rel;
  vWorld = w;
  vSeed = aSeed.x;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPix * (60.0 / max(1.0, -mv.z));
}
`

const frag = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying float vSeed;
uniform vec3 uColor;
uniform float uOpacity;
uniform vec3 uBeamOrigin;
uniform float uBeamAngle;
uniform float uBeamStrength;
uniform vec3 uBeamColor;
uniform float uSoft;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  float a = smoothstep(1.0, uSoft, r);
  if (a <= 0.002) discard;

  vec3 c = uColor;
  // ビームの中の粒はきらりと光る（霧の中に立体的な筋が出る）
  if (uBeamStrength > 0.001) {
    vec2 rel = vWorld.xz - uBeamOrigin.xz;
    float rd = length(rel);
    float ang = atan(rel.y, rel.x);
    float best = 0.0;
    for (int i = 0; i < 2; i++) {
      float diff = ang - (uBeamAngle + float(i) * 3.14159265);
      diff = atan(sin(diff), cos(diff));
      best = max(best, smoothstep(0.20, 0.03, abs(diff)));
    }
    float dy = abs(vWorld.y - uBeamOrigin.y) - rd * 0.13;
    float vert = exp(-max(0.0, abs(dy)) * 0.16);
    float att = 1.0 / (1.0 + rd * rd * 0.0009);
    c += uBeamColor * best * vert * att * uBeamStrength * (2.4 + vSeed * 2.2);
    a *= 1.0 + best * vert * att * uBeamStrength * 1.6;
  }
  gl_FragColor = vec4(c, a * uOpacity);
  #include <colorspace_fragment>
}
`

export class Weather {
  readonly motes: Points
  readonly precip: Points
  private moteMat: ShaderMaterial
  private precipMat: ShaderMaterial

  constructor(quality: number) {
    const moteCount = quality > 0.6 ? 1400 : 700
    const precipCount = quality > 0.6 ? 1800 : 900
    this.moteMat = makeMat(0xdfe6f2, 0.34, 0.25)
    this.precipMat = makeMat(0xffffff, 0.75, 0.55)
    this.motes = new Points(makeCloud(moteCount, 150, 90, 1.4, 5.0), this.moteMat)
    this.precip = new Points(makeCloud(precipCount, 90, 60, 0.8, 2.4), this.precipMat)
    this.motes.frustumCulled = false
    this.precip.frustumCulled = false
    this.motes.renderOrder = 18
    this.precip.renderOrder = 19
    this.moteMat.uniforms.uBox.value = new Vector3(150, 90, 150)
    this.precipMat.uniforms.uBox.value = new Vector3(90, 60, 90)
    this.moteMat.uniforms.uFall.value = 0.25
    this.moteMat.uniforms.uDrift.value = 3.5
  }

  apply(w: WeatherPreset) {
    this.moteMat.uniforms.uOpacity.value = 0.02 + w.motes * 0.44
    this.motes.visible = w.motes > 0.02

    if (w.precip === 'snow') {
      this.precip.visible = true
      this.precipMat.uniforms.uFall.value = 2.6
      this.precipMat.uniforms.uDrift.value = 2.4
      this.precipMat.uniforms.uOpacity.value = 0.72
      this.precipMat.uniforms.uSoft.value = 0.55
      ;(this.precipMat.uniforms.uColor.value as Color).setHex(0xffffff)
    } else if (w.precip === 'rain') {
      this.precip.visible = true
      this.precipMat.uniforms.uFall.value = 14
      this.precipMat.uniforms.uDrift.value = 0.6
      this.precipMat.uniforms.uOpacity.value = 0.4
      this.precipMat.uniforms.uSoft.value = 0.9
      ;(this.precipMat.uniforms.uColor.value as Color).setHex(0xc9dcf0)
    } else {
      this.precip.visible = false
    }
  }

  update(time: number, cam: Vector3, pix: number, beamAngle: number, beamStrength: number, beamColor: Color, tint: Color) {
    for (const m of [this.moteMat, this.precipMat]) {
      m.uniforms.uTime.value = time
      ;(m.uniforms.uCam.value as Vector3).copy(cam)
      m.uniforms.uPix.value = pix
      m.uniforms.uBeamAngle.value = beamAngle
      m.uniforms.uBeamStrength.value = beamStrength
      ;(m.uniforms.uBeamColor.value as Color).copy(beamColor)
      ;(m.uniforms.uBeamOrigin.value as Vector3).set(0, TOWER.lensY, 0)
    }
    ;(this.moteMat.uniforms.uColor.value as Color).copy(tint).lerp(new Color(0xffffff), 0.35)
  }
}

function makeMat(color: number, opacity: number, soft: number) {
  return new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new Vector3() },
      uBox: { value: new Vector3(100, 60, 100) },
      uFall: { value: 1 },
      uDrift: { value: 1 },
      uPix: { value: 1 },
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
      uSoft: { value: soft },
      uBeamOrigin: { value: new Vector3(0, TOWER.lensY, 0) },
      uBeamAngle: { value: 0 },
      uBeamStrength: { value: 0 },
      uBeamColor: { value: new Color(0xffe2a0) },
    },
  })
}

function makeCloud(n: number, spread: number, height: number, sizeMin: number, sizeMax: number) {
  const pos = new Float32Array(n * 3)
  const seed = new Float32Array(n * 3)
  const size = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread
    pos[i * 3 + 1] = (Math.random() - 0.5) * height + TOWER.lensY * 0.5
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread
    seed[i * 3] = Math.random()
    seed[i * 3 + 1] = Math.random()
    seed[i * 3 + 2] = Math.random()
    size[i] = sizeMin + Math.random() * (sizeMax - sizeMin)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('aSeed', new BufferAttribute(seed, 3))
  g.setAttribute('aSize', new BufferAttribute(size, 1))
  return g
}
