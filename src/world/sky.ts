import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import { PAL } from '../core/palette';
import { clamp01, makeRng, randRange } from '../core/util';

/**
 * Sky dome that travels from a warm dusk (when the boat sets out) to a deep
 * indigo night (when the fire is the only thing lighting the river).
 */
export class Sky {
  readonly dome: Mesh;
  readonly stars: Points;
  readonly moon: Sprite;
  private mat: ShaderMaterial;
  private starMat: ShaderMaterial;

  constructor() {
    const geo = new SphereGeometry(180, 40, 24);
    this.mat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uNight: { value: 0 },
        uTopDusk: { value: new Color(PAL.duskSkyTop) },
        uLowDusk: { value: new Color(PAL.duskSkyLow) },
        uGlowDusk: { value: new Color(PAL.duskSkyGlow) },
        uTopNight: { value: new Color(PAL.nightSkyTop) },
        uLowNight: { value: new Color(PAL.nightSkyLow) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform float uNight;
        uniform vec3 uTopDusk, uLowDusk, uGlowDusk, uTopNight, uLowNight;
        void main() {
          float y = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          float band = pow(1.0 - abs(vDir.y), 3.0);

          vec3 dusk = mix(uLowDusk, uTopDusk, smoothstep(0.5, 0.8, y));
          // Sunset burning out low behind the far ridge, downstream-ish.
          float sun = pow(max(dot(normalize(vDir * vec3(1.0, 0.35, 1.0)),
                                  normalize(vec3(-0.35, 0.06, -0.94))), 0.0), 5.0);
          dusk += uGlowDusk * sun * band * 1.25;

          // Long flat cloud bars, the kind that stripe a river valley at dusk.
          float a = atan(vDir.z, vDir.x);
          float cl = sin(vDir.y * 26.0 + sin(a * 2.1) * 1.6) * 0.5 + 0.5;
          cl *= sin(vDir.y * 11.0 + sin(a * 1.3 + 2.0) * 2.2) * 0.5 + 0.5;
          cl *= smoothstep(0.5, 0.6, y) * smoothstep(0.99, 0.74, y);
          dusk = mix(dusk, dusk * vec3(0.48, 0.42, 0.55) + uGlowDusk * 0.10, cl * 0.9);

          vec3 night = mix(uLowNight, uTopNight, smoothstep(0.44, 0.95, y));
          night += vec3(0.02, 0.03, 0.062) * band * 0.5;
          // The valley keeps a thread of warmth on the horizon all evening.
          night += vec3(0.030, 0.017, 0.010) * pow(band, 1.6);
          night = mix(night, night * vec3(0.78, 0.8, 0.92), cl * 0.35 * smoothstep(0.5, 0.8, y));

          vec3 col = mix(dusk, night, uNight);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    });
    this.dome = new Mesh(geo, this.mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -100;

    // --- stars -------------------------------------------------------------
    const rng = makeRng(20240804);
    const N = 340;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const tint = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // Only the upper hemisphere; keep them off the water line.
      const u = randRange(rng, 0, Math.PI * 2);
      const v = randRange(rng, 0.16, 0.98);
      const r = 160;
      const y = v;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      pos[i * 3] = Math.cos(u) * rad * r;
      pos[i * 3 + 1] = y * r;
      pos[i * 3 + 2] = Math.sin(u) * rad * r;
      size[i] = randRange(rng, 0.55, 2.3);
      tint[i] = rng();
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new BufferAttribute(pos, 3));
    sg.setAttribute('aSize', new BufferAttribute(size, 1));
    sg.setAttribute('aTint', new BufferAttribute(tint, 1));
    this.starMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: AdditiveBlending,
      uniforms: { uNight: { value: 0 }, uTime: { value: 0 }, uScale: { value: 500 } },
      vertexShader: `
        attribute float aSize; attribute float aTint;
        varying float vT; varying float vTint;
        uniform float uTime; uniform float uScale;
        void main() {
          vTint = aTint;
          vT = 0.65 + 0.35 * sin(uTime * (0.6 + aTint) + aTint * 31.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(-mv.z, 1.0);
        }
      `,
      fragmentShader: `
        varying float vT; varying float vTint; uniform float uNight;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.02, length(d));
          vec3 c = mix(vec3(0.78, 0.86, 1.0), vec3(1.0, 0.93, 0.82), vTint);
          gl_FragColor = vec4(c, a * a * vT * uNight);
        }
      `,
    });
    this.stars = new Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -99;

    // --- moon --------------------------------------------------------------
    this.moon = new Sprite(
      new SpriteMaterial({
        map: moonTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0,
        fog: false,
      }),
    );
    this.moon.scale.setScalar(13);
    this.moon.position.set(-96, 58, -128);
    this.moon.renderOrder = -98;
  }

  setNight(n: number): void {
    const v = clamp01(n);
    this.mat.uniforms.uNight.value = v;
    this.starMat.uniforms.uNight.value = v;
    (this.moon.material as SpriteMaterial).opacity = v * 0.5;
  }

  update(t: number, dprScale: number): void {
    this.starMat.uniforms.uTime.value = t;
    this.starMat.uniforms.uScale.value = 460 * dprScale;
  }
}

function moonTexture(): CanvasTexture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  // Halo
  const halo = g.createRadialGradient(s / 2, s / 2, s * 0.12, s / 2, s / 2, s * 0.5);
  halo.addColorStop(0, 'rgba(196,214,255,0.55)');
  halo.addColorStop(0.35, 'rgba(150,175,230,0.16)');
  halo.addColorStop(1, 'rgba(120,150,210,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, s, s);
  // Disc
  const disc = g.createRadialGradient(s * 0.44, s * 0.42, 2, s / 2, s / 2, s * 0.19);
  disc.addColorStop(0, 'rgba(255,255,252,1)');
  disc.addColorStop(0.72, 'rgba(226,236,255,0.98)');
  disc.addColorStop(1, 'rgba(196,214,250,0.0)');
  g.fillStyle = disc;
  g.beginPath();
  g.arc(s / 2, s / 2, s * 0.19, 0, Math.PI * 2);
  g.fill();
  // A couple of soft maria so it isn't a flat dot.
  g.globalAlpha = 0.1;
  g.fillStyle = '#8ea4cc';
  g.beginPath();
  g.arc(s * 0.46, s * 0.46, s * 0.05, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(s * 0.56, s * 0.55, s * 0.035, 0, Math.PI * 2);
  g.fill();
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
