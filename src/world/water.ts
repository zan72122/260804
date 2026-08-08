import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import { PAL } from '../core/palette';
import { clamp01 } from '../core/util';

const MAX_RIPPLES = 14;

/**
 * The wave spectrum, generated rather than hand-typed.
 *
 * Directions step by the golden angle so no two components line up: hand-picked
 * axis-aligned waves cross into a plaid, and a plaid in a specular highlight
 * looks like venetian blinds rather than like a river. Speeds follow deep-water
 * dispersion (omega ~ sqrt(k)), so short waves scud and long swell rolls.
 *
 * The last few octaves are faded out with distance, which keeps the near water
 * crisp without boiling the far water into aliasing.
 */
interface Wave {
  kx: number;
  kz: number;
  speed: number;
  phase: number;
  amp: number;
}

const WAVES: Wave[] = Array.from({ length: 17 }, (_, k) => {
  const ang = k * 2.39996323 + 0.62;
  const freq = 0.3 * Math.pow(1.47, k);
  // 1/f spectrum: every octave contributes the same *slope*, which is what a
  // specular highlight actually samples. Equal-amplitude octaves would leave
  // the near water one smooth mirror with all the detail invisible.
  return {
    kx: Math.cos(ang) * freq,
    kz: Math.sin(ang) * freq,
    speed: Math.sqrt(freq) * 1.42,
    phase: k * 1.73,
    amp: 0.0205 / freq,
  };
});

const WAVE_GLSL = WAVES.map((w, k) => {
  // Each finer band survives a shorter distance from the eye, so water a metre
  // away has centimetre ripples and water fifty metres away does not dissolve
  // into noise.
  const gate = k < 8 ? '' : k < 11 ? ' * dA' : k < 14 ? ' * dB' : ' * dC';
  return (
    `          addWave(p, vec2(${w.kx.toFixed(4)}, ${w.kz.toFixed(4)}), ` +
    `${w.speed.toFixed(3)}, ${w.phase.toFixed(3)}, ${w.amp.toFixed(7)}${gate}, h, g);`
  );
}).join('\n');

interface Ripple {
  slot: number;
  age: number;
  life: number;
  strength: number;
}

/**
 * The river. Everything that makes the night read as *water* lives here:
 * long swell, wind chop, expanding ripple rings from every dive and every
 * returning bird, and — the whole point of the picture — the ember-orange
 * reflection column that only exists once the kagaribi is burning.
 *
 * The surface is translucent so a submerged cormorant reads as a soft dark
 * shape under the skin of the river rather than simply disappearing.
 */
export class Water {
  readonly mesh: Mesh;
  readonly mat: ShaderMaterial;
  private ripples: Ripple[] = [];
  private free: number[] = [];
  private data: Vector4[] = [];
  private time = 0;

  constructor() {
    for (let i = 0; i < MAX_RIPPLES; i++) {
      this.data.push(new Vector4(0, 0, 0, 0));
      this.free.push(i);
    }

    const geo = new PlaneGeometry(220, 240, 150, 150);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -42);

    this.mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uRipples: { value: this.data },
        uFirePos: { value: new Vector3(0, 1.6, -2.4) },
        uFire: { value: 0 },
        uFireCol: { value: new Color(PAL.fireMid) },
        uNight: { value: 0 },
        uDeep: { value: new Color(PAL.waterDeep) },
        uShallow: { value: new Color(PAL.waterShallow) },
        uRim: { value: new Color(PAL.waterRim) },
        uMoonCol: { value: new Color(PAL.moon) },
        uMoonDir: { value: new Vector3(-0.42, 0.5, -0.76).normalize() },
        uFogCol: { value: new Color(0x070d1d) },
        uFogDen: { value: 0.034 },
        uCam: { value: new Vector3() },
        uFlow: { value: 0 },
        uBoat: { value: new Vector2(0, 0) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld;

        uniform float uTime;
        uniform vec4  uRipples[${MAX_RIPPLES}];
        uniform vec3  uFirePos;
        uniform float uFire;
        uniform vec3  uFireCol;
        uniform float uNight;
        uniform vec3  uDeep;
        uniform vec3  uShallow;
        uniform vec3  uRim;
        uniform vec3  uMoonCol;
        uniform vec3  uMoonDir;
        uniform vec3  uFogCol;
        uniform float uFogDen;
        uniform vec3  uCam;
        uniform float uFlow;
        uniform vec2  uBoat;

        float clamp01(float x) { return clamp(x, 0.0, 1.0); }

        // Analytic wave: height plus exact gradient, so normals cost one pass.
        void addWave(vec2 p, vec2 k, float w, float ph, float amp,
                     inout float h, inout vec2 g) {
          float s = dot(k, p) + ph + uTime * w;
          h += amp * sin(s);
          g += amp * cos(s) * k;
        }

        void surface(vec2 p, float dEye, out float h, out vec2 g) {
          h = 0.0; g = vec2(0.0);
          float dA = 1.0 / (1.0 + dEye * 0.05);
          float dB = 1.0 / (1.0 + dEye * 0.17);
          float dC = 1.0 / (1.0 + dEye * 0.55);
${WAVE_GLSL}

          // Ripple rings: dives, surfacing birds, dipped ropes, boat wake.
          for (int i = 0; i < ${MAX_RIPPLES}; i++) {
            vec4 r = uRipples[i];
            if (r.w <= 0.0001) continue;
            vec2 d = p - r.xy;
            float dist = max(length(d), 0.0007);
            float age = r.z;
            float rad = age * 2.35;
            float band = dist - rad;
            float env = exp(-abs(band) * 0.95) * exp(-age * 0.62) * r.w;
            env *= smoothstep(0.0, 0.22, age);
            env /= (1.0 + dist * 0.55);
            float ph = dist * 7.4 - age * 8.6;
            h += sin(ph) * env * 0.05;
            // d(h)/d(dist), chain-ruled back out to the plane.
            float dA = -0.95 * sign(band) * env;
            float dh = (dA * sin(ph) + env * 7.4 * cos(ph)) * 0.05;
            g += dh * (d / dist);
          }
        }

        void main() {
          vec2 p = vWorld.xz + vec2(0.0, uFlow);
          float dNear = length(uCam - vec3(vWorld.x, 0.0, vWorld.z));
          float h; vec2 g;
          surface(p, dNear, h, g);

          vec3 P = vec3(vWorld.x, h, vWorld.z);
          vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 V = normalize(uCam - P);
          float ndv = clamp(dot(N, V), 0.0, 1.0);
          // Schlick. Water looking straight down is nearly black; water at a
          // grazing angle is a mirror. Without this the whole near field turns
          // into one milky sheet of reflected fire.
          float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
          float fres = pow(1.0 - ndv, 4.0);

          // ---- base body of water -------------------------------------
          // Almost black. Every bright thing on this river is *borrowed* light.
          float dCam = dNear;
          vec3 col = mix(uDeep, uShallow, clamp(fres * 1.2, 0.0, 1.0));
          col = mix(col, uRim * 0.5, clamp01(fres * fres) * 0.35);
          col *= mix(1.9, 1.0, uNight);

          // ---- kagaribi: the light on the river ------------------------
          vec3 toFire = uFirePos - P;
          float fd = length(toFire);
          vec3 L = toFire / fd;
          float att = 1.0 / (1.0 + fd * fd * 0.22);

          // A pool of orange that falls away fast, so the far river stays night.
          col += uFireCol * att * uFire * 0.15 * (0.35 + 0.65 * max(dot(N, L), 0.0));

          // The reflection column. Three lobes: a soft smear, glinting flakes,
          // and hard sparks where a wave face happens to aim at the flame.
          vec3 H = normalize(L + V);
          float ndh = max(dot(N, H), 0.0);
          float colAtt = 1.0 / (1.0 + fd * 0.42);
          float broad = pow(ndh, 34.0);
          float mid   = pow(ndh, 160.0);
          float sharp = pow(ndh, 800.0);
          col += uFireCol * uFire * colAtt * F * (broad * 3.4 + mid * 14.0);
          col += vec3(1.0, 0.82, 0.52) * uFire * colAtt * F * sharp * 30.0;

          // ---- moonlight ----------------------------------------------
          vec3 Hm = normalize(uMoonDir + V);
          float mspec = pow(max(dot(N, Hm), 0.0), 520.0);
          col += uMoonCol * mspec * F * 1.1 * (0.2 + 0.8 * uNight);

          // ---- the boat sits in its own dark ---------------------------
          float bd = length((vWorld.xz - uBoat) / vec2(1.6, 3.6));
          col *= mix(0.28, 1.0, smoothstep(0.5, 1.55, bd));

          // ---- distance -------------------------------------------------
          float fog = 1.0 - exp(-uFogDen * uFogDen * dCam * dCam);
          col = mix(col, uFogCol, clamp01(fog));

          // Lit water lets you see the birds beneath it.
          float clarity = clamp01(att * uFire * 4.0);
          float alpha = mix(0.97, 0.74, clarity) * (1.0 - 0.5 * clamp01(fog));
          alpha = max(alpha, 0.45);
          gl_FragColor = vec4(col, alpha);
          #include <colorspace_fragment>
        }
      `,
    });

    this.mesh = new Mesh(geo, this.mat);
    this.mesh.renderOrder = 6;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'river';

  }

  /** Spawn an expanding ring. `strength` ~0.3 for a rope dipping, ~1.3 for a dive. */
  ripple(x: number, z: number, strength = 1, life = 4.4): void {
    let slot = this.free.pop();
    if (slot === undefined) {
      // Recycle the oldest one rather than dropping the feedback.
      let oldest = 0;
      for (let i = 1; i < this.ripples.length; i++) {
        if (this.ripples[i].age > this.ripples[oldest].age) oldest = i;
      }
      const r = this.ripples.splice(oldest, 1)[0];
      slot = r.slot;
    }
    this.ripples.push({ slot, age: 0, life, strength });
    this.data[slot].set(x, z, 0, strength);
  }

  setFire(strength: number, pos: Vector3): void {
    this.mat.uniforms.uFire.value = strength;
    this.mat.uniforms.uFirePos.value.copy(pos);
  }

  setNight(n: number): void {
    this.mat.uniforms.uNight.value = clamp01(n);
  }

  setBoat(x: number, z: number): void {
    this.mat.uniforms.uBoat.value.set(x, z);
  }

  update(dt: number, camPos: Vector3, flow: number): void {
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
    this.mat.uniforms.uCam.value.copy(camPos);
    this.mat.uniforms.uFlow.value = flow;

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += dt;
      const d = this.data[r.slot];
      d.z = r.age;
      d.w = r.strength * (1 - clamp01(r.age / r.life));
      if (r.age >= r.life) {
        d.set(0, 0, 0, 0);
        this.free.push(r.slot);
        this.ripples.splice(i, 1);
      }
    }
  }

  /**
   * Surface height for anything that floats. Uses the same wave table as the
   * shader (the long components only — the fine chop is below the scale of a
   * boat), so the hull rides exactly the swell you can see.
   */
  heightAt(x: number, z: number, flow: number): number {
    const t = this.time;
    const pz = z + flow;
    let h = 0;
    for (let i = 0; i < 5; i++) {
      const w = WAVES[i];
      h += w.amp * Math.sin(w.kx * x + w.kz * pz + w.phase + t * w.speed);
    }
    return h;
  }
}

/** Small helper geometry: a soft radial disc used for blob contact shadows. */
export function softDisc(radius: number, segments = 40): BufferGeometry {
  const g = new BufferGeometry();
  const pos: number[] = [0, 0, 0];
  const alpha: number[] = [1];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pos.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    alpha.push(0);
  }
  const idx: number[] = [];
  for (let i = 1; i <= segments; i++) idx.push(0, i, i + 1);
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aAlpha', new BufferAttribute(new Float32Array(alpha), 1));
  g.setIndex(idx);
  return g;
}

export function shadowMaterial(color = 0x02040a, strength = 0.55): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCol: { value: new Color(color) },
      uStrength: { value: strength },
    },
    vertexShader: `
      attribute float aAlpha;
      varying float vA;
      void main() {
        vA = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uCol; uniform float uStrength; varying float vA;
      void main() { gl_FragColor = vec4(uCol, pow(clamp(vA, 0.0, 1.0), 1.7) * uStrength); }
    `,
  });
}
