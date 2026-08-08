import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointLight,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { fireGlowTexture } from './environment';
import { mergeAll, tubeThrough, roundedBox } from './geom';
import { PAL } from '../core/palette';
import { clamp01, damp, makeRng, randRange, TAU } from '../core/util';

const SPARKS = 120;

/**
 * The kagaribi — an iron basket of burning pine slung on a pole off the bow.
 * It is the light source, the clock, and the reason the river is visible at
 * all, so it gets real cage geometry, three nested flame shells, rising
 * sparks, and a light that flickers the whole scene.
 */
export class Fire {
  readonly group = new Group();
  readonly light: PointLight;
  /** Local position of the burning heart of the basket. */
  readonly heart = new Vector3();

  /** 0 = a few embers, 1 = full blaze. */
  strength = 0.07;
  private target = 0.07;
  private puff = 0;
  private shells: Mesh[] = [];
  private shellMats: ShaderMaterial[] = [];
  private glow: Sprite;
  private innerGlow: Sprite;
  private sparks: Points;
  private sparkMat: ShaderMaterial;
  private sparkPos: Float32Array;
  private sparkVel: Float32Array;
  private sparkAge: Float32Array;
  private sparkLife: Float32Array;
  private sparkSeed: Float32Array;
  private logs: Mesh[] = [];
  private emberMat: MeshStandardMaterial;
  private rng = makeRng(9091);
  private spawnAcc = 0;

  constructor(foot: Vector3) {
    const iron = new MeshStandardMaterial({ color: PAL.iron, roughness: 0.46, metalness: 0.8 });
    const wood = new MeshStandardMaterial({ color: 0x5a4026, roughness: 0.78 });

    // ---- kagaribo: the pole reaching out over the water -------------------
    const poleTop = new Vector3(0, 2.15, -1.55);
    const pole = new Mesh(
      tubeThrough(
        [
          new Vector3(0, -0.1, 0.35),
          new Vector3(0, 0.7, -0.15),
          new Vector3(0, 1.55, -0.78),
          poleTop.clone(),
        ],
        0.062,
        7,
      ),
      wood,
    );
    pole.castShadow = true;
    this.group.add(pole);

    // Lashing where the pole is stepped into the bow.
    const lashMat = new MeshStandardMaterial({ color: PAL.rope, roughness: 0.95 });
    const lashes: Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const lash = new Mesh(new TorusGeometry(0.08, 0.016, 5, 14), lashMat);
      lash.position.set(0, 0.16 + i * 0.13, 0.24 - i * 0.09);
      lash.rotation.x = 0.62;
      lashes.push(lash);
    }
    this.group.add(mergeAll(lashes, lashMat));

    // ---- the iron basket --------------------------------------------------
    const basket = new Group();
    const cage: Mesh[] = [];
    const R = 0.42;
    const H = 0.44;
    // Bail chain from the pole tip.
    const bail = new Mesh(
      tubeThrough(
        [new Vector3(0, 0.52, 0), new Vector3(-R * 0.7, 0.28, 0), new Vector3(-R * 0.86, H, 0)],
        0.014,
        5,
      ),
      iron,
    );
    cage.push(bail);
    const bail2 = bail.clone();
    bail2.scale.x = -1;
    cage.push(bail2);

    // Vertical bars flaring outward — the classic kagari cage.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const bar = new Mesh(
        tubeThrough(
          [
            new Vector3(Math.cos(a) * R * 0.24, -0.02, Math.sin(a) * R * 0.24),
            new Vector3(Math.cos(a) * R * 0.72, H * 0.42, Math.sin(a) * R * 0.72),
            new Vector3(Math.cos(a) * R * 1.02, H, Math.sin(a) * R * 1.02),
          ],
          0.017,
          4,
        ),
        iron,
      );
      cage.push(bar);
    }
    // Hoops.
    for (const [y, r] of [
      [0.0, R * 0.3],
      [H * 0.45, R * 0.75],
      [H, R * 1.03],
    ] as [number, number][]) {
      const hoop = new Mesh(new TorusGeometry(r, 0.019, 6, 22), iron);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = y;
      cage.push(hoop);
    }
    // Cross bars in the floor of the basket so logs have somewhere to sit.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      const bar = new Mesh(new CylinderGeometry(0.014, 0.014, R * 0.62, 5), iron);
      bar.rotation.set(Math.PI / 2, 0, a);
      bar.position.y = -0.005;
      cage.push(bar);
    }
    const cageMesh = mergeAll(cage, iron);
    cageMesh.castShadow = true;
    basket.add(cageMesh);

    // ---- charred pine logs ------------------------------------------------
    this.emberMat = new MeshStandardMaterial({
      color: 0x2a1a12,
      emissive: new Color(0xff5a12),
      emissiveIntensity: 0.5,
      roughness: 0.95,
    });
    for (let i = 0; i < 5; i++) {
      const a = randRange(this.rng, 0, TAU);
      const log = new Mesh(
        roundedBox(randRange(this.rng, 0.34, 0.5), 0.085, 0.085, 0.038),
        this.emberMat,
      );
      log.position.set(
        Math.cos(a) * randRange(this.rng, 0, 0.13),
        0.05 + i * 0.045,
        Math.sin(a) * randRange(this.rng, 0, 0.13),
      );
      log.rotation.set(randRange(this.rng, -0.3, 0.3), a, randRange(this.rng, -0.22, 0.22));
      this.logs.push(log);
      basket.add(log);
    }

    basket.position.copy(poleTop).add(new Vector3(0, -0.56, 0));
    this.group.add(basket);
    this.heart.copy(basket.position).add(new Vector3(0, 0.28, 0));

    // ---- flame shells -----------------------------------------------------
    const shellSpec: [number, number, string, string, number][] = [
      [0.34, 1.75, '#ff8c28', '#b8330a', 0.5],
      [0.24, 1.25, '#ffbe58', '#f4601a', 0.85],
      [0.15, 0.78, '#fffbe8', '#ffce78', 1.15],
    ];
    for (let i = 0; i < shellSpec.length; i++) {
      const [r, h, hot, cool, dens] = shellSpec[i];
      const geo = new CylinderGeometry(0.02, r, h, 16, 10, true);
      geo.translate(0, h / 2, 0);
      const mat = new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uHot: { value: new Color(hot) },
          uCool: { value: new Color(cool) },
          uStrength: { value: 0 },
          uSeed: { value: i * 13.7 },
          uDensity: { value: dens },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uTime;
          uniform float uSeed;
          uniform float uStrength;
          float n1(float x) {
            return sin(x) * 0.5 + sin(x * 2.13 + 1.7) * 0.28 + sin(x * 4.7 + 0.4) * 0.14;
          }
          void main() {
            vUv = uv;
            vec3 p = position;
            float up = clamp(uv.y, 0.0, 1.0);
            float t = uTime * (2.1 + uSeed * 0.04);
            // Flames lick: lateral wander that grows with height.
            float wob = n1(up * 5.2 + t + uSeed) * 0.14 * up * up;
            float wob2 = n1(up * 4.1 - t * 0.8 + uSeed * 2.0) * 0.12 * up * up;
            p.x += wob;
            p.z += wob2;
            // Necking: the flame pinches and swells as it burns.
            float pinch = 1.0 + n1(up * 7.0 - t * 1.6 + uSeed) * 0.24 * (1.0 - up * 0.5);
            p.x *= pinch;
            p.z *= pinch;
            // Height scales hard with how well the fire has been fanned.
            float s = 0.32 + uStrength * 0.68;
            p.y *= s * (0.9 + n1(t * 1.7 + uSeed) * 0.12);
            p.x *= 0.55 + s * 0.45;
            p.z *= 0.55 + s * 0.45;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform vec3 uHot; uniform vec3 uCool;
          uniform float uStrength; uniform float uTime; uniform float uSeed;
          uniform float uDensity;
          void main() {
            float up = clamp(vUv.y, 0.0, 1.0);
            // Fade out at the tip and thin at the very base.
            float a = (1.0 - up) * smoothstep(0.0, 0.13, up);
            a *= 0.55 + 0.45 * sin(vUv.x * 12.566 + uTime * 3.1 + uSeed);
            a = max(a, 0.0);
            float flick = 0.78 + 0.22 * sin(uTime * (9.0 + uSeed) + up * 6.0);
            vec3 col = mix(uHot, uCool, pow(up, 0.7));
            float amt = a * uDensity * flick * (0.16 + uStrength * 0.95);
            gl_FragColor = vec4(col * (1.05 + uStrength * 0.85), amt);
          }
        `,
      });
      const m = new Mesh(geo, mat);
      m.position.copy(basket.position).add(new Vector3(0, 0.12, 0));
      m.renderOrder = 20 + i;
      m.frustumCulled = false;
      this.shells.push(m);
      this.shellMats.push(mat);
      this.group.add(m);
    }

    // ---- glow + light -----------------------------------------------------
    const glowTex = fireGlowTexture();
    this.glow = new Sprite(
      new SpriteMaterial({
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        color: new Color(0xff8a30),
        opacity: 0.2,
        fog: false,
      }),
    );
    this.glow.scale.setScalar(2.4);
    this.glow.position.copy(this.heart);
    this.glow.renderOrder = 19;
    this.group.add(this.glow);

    this.innerGlow = new Sprite(
      new SpriteMaterial({
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        color: new Color(0xffd79a),
        opacity: 0.3,
        fog: false,
      }),
    );
    this.innerGlow.scale.setScalar(0.9);
    this.innerGlow.position.copy(this.heart);
    this.innerGlow.renderOrder = 22;
    this.group.add(this.innerGlow);

    this.light = new PointLight(0xff8a2e, 3, 34, 2.0);
    this.light.position.copy(this.heart);
    this.group.add(this.light);

    // ---- sparks -----------------------------------------------------------
    this.sparkPos = new Float32Array(SPARKS * 3);
    this.sparkVel = new Float32Array(SPARKS * 3);
    this.sparkAge = new Float32Array(SPARKS);
    this.sparkLife = new Float32Array(SPARKS);
    this.sparkSeed = new Float32Array(SPARKS);
    const sizes = new Float32Array(SPARKS);
    const alphas = new Float32Array(SPARKS);
    for (let i = 0; i < SPARKS; i++) {
      this.sparkLife[i] = 0;
      this.sparkAge[i] = 1;
      sizes[i] = randRange(this.rng, 0.09, 0.34);
      this.sparkSeed[i] = randRange(this.rng, 0, TAU);
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new BufferAttribute(this.sparkPos, 3));
    sg.setAttribute('aSize', new BufferAttribute(sizes, 1));
    sg.setAttribute('aAlpha', new BufferAttribute(alphas, 1));
    this.sparkMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uScale: { value: 340 } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha;
        varying float vA;
        uniform float uScale;
        void main() {
          vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(-mv.z, 0.6);
        }
      `,
      fragmentShader: `
        varying float vA;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          float a = smoothstep(0.5, 0.05, r);
          vec3 c = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.88, 0.58), smoothstep(0.3, 0.0, r));
          gl_FragColor = vec4(c, a * vA);
        }
      `,
    });
    this.sparks = new Points(sg, this.sparkMat);
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 25;
    this.group.add(this.sparks);

    this.group.position.copy(foot);
  }

  /** One fan of the fire: an immediate visible whump plus a lasting rise. */
  fan(amount = 0.26): void {
    this.target = clamp01(this.target + amount);
    this.puff = Math.min(1.6, this.puff + 0.85);
    const heart = this.heart;
    for (let i = 0; i < 26; i++) this.spawnSpark(heart, 1.9);
  }

  /** A visual flare with no gameplay effect — used to catch a wandering eye. */
  flare(): void {
    this.puff = Math.min(1.2, this.puff + 0.35);
    for (let i = 0; i < 10; i++) this.spawnSpark(this.heart, 1.3);
  }

  setStrength(v: number): void {
    this.target = clamp01(v);
  }

  get lit(): boolean {
    return this.strength > 0.85;
  }

  private spawnSpark(origin: Vector3, boost = 1): void {
    for (let i = 0; i < SPARKS; i++) {
      if (this.sparkAge[i] < this.sparkLife[i]) continue;
      const a = randRange(this.rng, 0, TAU);
      const r = randRange(this.rng, 0, 0.24);
      this.sparkPos[i * 3] = origin.x + Math.cos(a) * r;
      this.sparkPos[i * 3 + 1] = origin.y + randRange(this.rng, -0.1, 0.16);
      this.sparkPos[i * 3 + 2] = origin.z + Math.sin(a) * r;
      this.sparkVel[i * 3] = randRange(this.rng, -0.24, 0.24) * boost;
      this.sparkVel[i * 3 + 1] = randRange(this.rng, 0.9, 2.3) * boost;
      this.sparkVel[i * 3 + 2] = randRange(this.rng, -0.24, 0.24) * boost;
      this.sparkAge[i] = 0;
      this.sparkLife[i] = randRange(this.rng, 0.7, 1.9);
      return;
    }
  }

  update(dt: number, t: number, dprScale: number): void {
    this.strength = damp(this.strength, this.target, 2.6, dt);
    this.puff = damp(this.puff, 0, 2.4, dt);
    const s = clamp01(this.strength + this.puff * 0.4);

    // Two-rate flicker: a slow breath under a fast crackle.
    const flick =
      0.82 + 0.12 * Math.sin(t * 8.7) * Math.sin(t * 3.1 + 0.7) + 0.09 * Math.sin(t * 21.3 + 2.0);

    for (const m of this.shellMats) {
      m.uniforms.uTime.value = t;
      m.uniforms.uStrength.value = s;
    }
    this.light.intensity = (0.25 + s * s * 11) * flick;
    this.light.distance = 20 + s * 22;

    this.glow.material.opacity = (0.06 + s * 0.42) * flick;
    this.glow.scale.setScalar(0.95 + s * 1.55 + this.puff * 0.35);
    this.innerGlow.material.opacity = (0.1 + s * 0.5) * flick;
    this.innerGlow.scale.setScalar(0.34 + s * 0.62);

    this.emberMat.emissiveIntensity = (0.3 + s * 1.9) * flick;

    // Logs settle very slightly as they burn — tiny, but it keeps the fire alive.
    for (let i = 0; i < this.logs.length; i++) {
      const l = this.logs[i];
      l.rotation.z += Math.sin(t * 0.7 + i) * 0.0006;
    }

    // Sparks.
    this.spawnAcc += dt * (4 + s * s * 90);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      this.spawnSpark(this.heart, 0.6 + s * 0.8);
    }
    const alphas = this.sparks.geometry.getAttribute('aAlpha') as BufferAttribute;
    for (let i = 0; i < SPARKS; i++) {
      if (this.sparkAge[i] >= this.sparkLife[i]) {
        alphas.array[i] = 0;
        continue;
      }
      this.sparkAge[i] += dt;
      const k = i * 3;
      // Buoyant rise that decays, plus a wandering thermal.
      this.sparkVel[k + 1] += (1.0 - this.sparkVel[k + 1] * 0.55) * dt * 1.4;
      this.sparkVel[k] += Math.sin(t * 2.3 + this.sparkSeed[i]) * dt * 0.5;
      this.sparkVel[k + 2] += Math.cos(t * 1.9 + this.sparkSeed[i] * 1.3) * dt * 0.42;
      this.sparkPos[k] += this.sparkVel[k] * dt;
      this.sparkPos[k + 1] += this.sparkVel[k + 1] * dt;
      this.sparkPos[k + 2] += this.sparkVel[k + 2] * dt;
      const lt = this.sparkAge[i] / this.sparkLife[i];
      alphas.array[i] =
        (1 - lt) * (1 - lt) * (0.5 + 0.5 * Math.sin(t * 18 + this.sparkSeed[i] * 9));
    }
    alphas.needsUpdate = true;
    (this.sparks.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    this.sparkMat.uniforms.uScale.value = 320 * dprScale;
  }
}
