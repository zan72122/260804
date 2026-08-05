/**
 * 水槽そのものと、水・光・空間の演出。
 * 砂地／背景岩／水面／光のカーテン／浮遊物／ガラス／外枠 をまとめて作る。
 */
import * as THREE from 'three';
import { TANK, WATER } from './config.js';
import { applyCaustics } from './shaders.js';
import { makeGlowTexture, makeSandTexture, makeRandom, lerp, clamp, TAU } from '../core/util.js';

const WATER_SURFACE_VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying vec2 vSurf;

  float ripple(vec2 p, float t) {
    return sin(p.x * 1.15 + t * 1.05) * 0.085
         + sin(p.y * 1.55 - t * 0.85) * 0.075
         + sin((p.x + p.y) * 2.35 + t * 1.65) * 0.035
         + sin((p.x - p.y) * 3.7 - t * 2.2) * 0.018;
  }

  void main() {
    vec3 pos = position;
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vSurf = wp.xz;
    wp.y += ripple(wp.xz, uTime);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WATER_SURFACE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uClarity;
  uniform vec3 uWaterColor;
  uniform vec3 uSunDir;
  varying vec3 vWorld;
  varying vec2 vSurf;

  float ripple(vec2 p, float t) {
    return sin(p.x * 1.15 + t * 1.05) * 0.085
         + sin(p.y * 1.55 - t * 0.85) * 0.075
         + sin((p.x + p.y) * 2.35 + t * 1.65) * 0.035
         + sin((p.x - p.y) * 3.7 - t * 2.2) * 0.018;
  }

  vec3 rippleNormal(vec2 p, float t) {
    float e = 0.06;
    float h = ripple(p, t);
    float hx = ripple(p + vec2(e, 0.0), t);
    float hz = ripple(p + vec2(0.0, e), t);
    return normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
  }

  void main() {
    vec3 n = rippleNormal(vSurf, uTime);
    vec3 V = normalize(cameraPosition - vWorld);
    float ndv = abs(dot(n, V));
    float fres = pow(1.0 - ndv, 2.4);

    vec3 sky = mix(vec3(0.16, 0.30, 0.34), vec3(0.34, 0.56, 0.66), uClarity);
    vec3 deep = uWaterColor * 0.55;
    vec3 col = mix(deep, sky, clamp(fres * 0.75 + 0.16, 0.0, 1.0));

    // 水面をすべる細い光の筋
    float bands = pow(max(sin(vSurf.x * 2.6 + vSurf.y * 1.4 + uTime * 1.1), 0.0), 9.0)
                + pow(max(sin(vSurf.x * 1.3 - vSurf.y * 2.2 - uTime * 0.8), 0.0), 11.0);
    col += vec3(0.42, 0.74, 0.88) * bands * (0.12 + 0.22 * uClarity);

    // 太陽のきらめき
    vec3 R = reflect(-V, n);
    float spec = pow(max(dot(R, normalize(uSunDir)), 0.0), 150.0);
    col += vec3(1.0, 0.96, 0.86) * spec * 2.2;

    gl_FragColor = vec4(col, 0.92);
  }
`;

const GLASS_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uClarity;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;

  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - abs(dot(normalize(vNormalW), V)), 3.0);

    // 天井の照明が斜めに映り込んだ帯
    float d = vUv.x * 1.25 - vUv.y * 0.75;
    float streak = pow(max(1.0 - abs(fract(d * 1.35 + 0.24) - 0.5) * 3.6, 0.0), 3.0) * 0.5
                 + pow(max(1.0 - abs(fract(d * 1.35 + 0.62) - 0.5) * 8.0, 0.0), 3.0) * 0.25;

    // ふちに向かうほど強い反射
    float edge = pow(max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0, 3.0);

    float a = fres * 0.20 + streak * 0.14 + edge * 0.08;
    vec3 tint = mix(vec3(0.50, 0.74, 0.82), vec3(0.70, 0.90, 1.02), uClarity);
    gl_FragColor = vec4(tint * a, 1.0);
  }
`;

const GLASS_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GODRAY_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSeed;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float sides = smoothstep(0.0, 0.42, vUv.x) * (1.0 - smoothstep(0.58, 1.0, vUv.x));
    float top = smoothstep(0.0, 0.30, vUv.y);
    float bottom = 1.0 - smoothstep(0.18, 1.0, vUv.y);
    float flicker = 0.62 + 0.38 * sin(uTime * 0.75 + uSeed * 7.3);
    float band = 0.72 + 0.28 * sin(vUv.x * 19.0 + uTime * 0.55 + uSeed * 11.0);
    float a = sides * top * bottom * flicker * band * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const GODRAY_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export class Environment {
  constructor(scene, shared) {
    this.scene = scene;
    this.shared = shared;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.clarity = 0;
    this.sunDir = new THREE.Vector3(-0.35, 1, 0.45).normalize();

    scene.fog = new THREE.FogExp2(WATER.murkyFog, WATER.murkyDensity);
    scene.background = new THREE.Color(0x030a10);

    this._buildLights();
    this._buildBackdrop();
    this._buildFloor();
    this._buildWalls();
    this._buildSurface();
    this._buildGodRays();
    this._buildDust();
    this._buildGlass();
    this._buildFrame();
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xbdf0ff, 0x0b232b, 0.55);
    this.scene.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(0xd8f6ff, 2.3);
    sun.position.set(-6, 16, 8);
    sun.target.position.set(0, 1.5, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 4;
    sun.shadow.camera.far = 34;
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    // 奥から差す冷たいリム。輪郭が水中らしく浮き上がる。
    const rim = new THREE.PointLight(0x35c8ff, 22, 26, 2);
    rim.position.set(4.5, 5.4, -3.0);
    this.scene.add(rim);
    this.rim = rim;

    const fill = new THREE.PointLight(0x8ff0d8, 9, 20, 2);
    fill.position.set(-5.6, 1.4, -1.2);
    this.scene.add(fill);
    this.fill = fill;
  }

  /**
   * 水槽の外側＝暗い展示室。
   * 縦持ちだと水槽の上下に余白が出るので、そこを「天井の照明」と「水槽台」で埋める。
   * 何もない黒ではなく、ちゃんと部屋に見えるようにするのが狙い。
   */
  _buildBackdrop() {
    const g = new THREE.PlaneGeometry(90, 70);
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: this.shared.time, uClarity: this.shared.clarity },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uClarity;
        void main(){
          // 水槽の裏から漏れる光。上ほど明るく、まわりは静かに沈む。
          float r = length((vUv - vec2(0.5, 0.60)) * vec2(1.35, 1.0));
          vec3 near = mix(vec3(0.045,0.115,0.150), vec3(0.055,0.155,0.205), uClarity);
          vec3 far  = vec3(0.004,0.014,0.024);
          vec3 col = mix(near, far, smoothstep(0.06, 0.62, r));
          // 天井側にほのかな暖色。冷たい水色とのコントラストで奥行きが出る。
          col += vec3(0.055, 0.038, 0.020) * pow(max(vUv.y - 0.62, 0.0) * 2.6, 2.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthWrite: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(0, 6, -18);
    mesh.renderOrder = -10;
    this.scene.add(mesh);

    const caseMat = new THREE.MeshStandardMaterial({
      color: 0x1c414f, roughness: 0.45, metalness: 0.3, emissive: 0x081c26,
    });
    caseMat.fog = false;

    // 水槽が置かれた台
    const stand = new THREE.Mesh(
      new THREE.BoxGeometry(TANK.halfW * 2 + 1.6, 4.6, TANK.halfD * 2 + 1.3),
      caseMat
    );
    stand.position.set(0, -2.75, -0.1);
    this.scene.add(stand);

    const standTop = new THREE.Mesh(
      new THREE.BoxGeometry(TANK.halfW * 2 + 2.2, 0.42, TANK.halfD * 2 + 1.8),
      new THREE.MeshStandardMaterial({
        color: 0x2b5c6b, roughness: 0.3, metalness: 0.55, emissive: 0x0a2028,
      })
    );
    standTop.material.fog = false;
    standTop.position.set(0, -0.68, -0.1);
    this.scene.add(standTop);

    // 台の下ぶちの間接照明。水槽の下が真っ暗にならず、家具らしく見える。
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x6fd8f0, transparent: true, opacity: 0.55 });
    stripMat.fog = false;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(TANK.halfW * 2 + 1.9, 0.10, 0.10), stripMat
    );
    strip.position.set(0, -0.95, TANK.halfD + 0.75);
    this.scene.add(strip);

    const underLight = new THREE.PointLight(0x9fe4f5, 7, 12, 2);
    underLight.position.set(0, -1.2, TANK.halfD + 2.2);
    this.scene.add(underLight);
    this.underLight = underLight;

    // 天井のフード。中の照明が水面をきらきらさせている、という設定。
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(TANK.halfW * 2 + 1.6, 1.15, TANK.halfD * 2 + 1.3),
      caseMat
    );
    hood.position.set(0, TANK.waterY + 1.35, -0.1);
    this.scene.add(hood);

    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff0cf, transparent: true, opacity: 0.85 });
    lampMat.fog = false;
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(TANK.halfW * 2 + 0.4, 0.1, TANK.halfD * 1.4),
      lampMat
    );
    lamp.position.set(0, TANK.waterY + 0.76, -0.1);
    this.scene.add(lamp);
    this.hoodLampMat = lampMat;

    const hoodLight = new THREE.PointLight(0xffe6b8, 6, 9, 2);
    hoodLight.position.set(0, TANK.waterY + 0.6, 0.4);
    this.scene.add(hoodLight);
    this.hoodLight = hoodLight;

    // 展示室の床。水槽の光がぼんやり映り込む。
    const floorMat = new THREE.ShaderMaterial({
      uniforms: { uClarity: this.shared.clarity },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uClarity;
        void main(){
          float glow = pow(max(1.0 - abs(vUv.x - 0.5) * 2.6, 0.0), 2.2)
                     * pow(max(1.0 - abs(vUv.y - 0.42) * 2.0, 0.0), 2.6);
          vec3 col = vec3(0.008, 0.020, 0.030)
                   + mix(vec3(0.05, 0.13, 0.15), vec3(0.06, 0.19, 0.24), uClarity) * glow;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      fog: false,
    });
    const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), floorMat);
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(0, -5.05, 2);
    roomFloor.renderOrder = -9;
    this.scene.add(roomFloor);
  }

  _buildFloor() {
    const w = TANK.halfW * 2 + 0.4;
    const d = TANK.halfD * 2 + 0.4;
    const geo = new THREE.PlaneGeometry(w, d, 72, 48);
    geo.rotateX(-Math.PI / 2);

    // ゆるやかな砂丘。中央は掃除しやすいよう平らめに。
    const pos = geo.attributes.position;
    const rng = makeRandom(21);
    const seedA = rng() * 10, seedB = rng() * 10;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const flat = 1 - Math.exp(-((x * x) / 26 + (z * z) / 14));
      const h =
        Math.sin(x * 0.42 + seedA) * 0.18 +
        Math.cos(z * 0.62 + seedB) * 0.14 +
        Math.sin(x * 1.15 + z * 0.9) * 0.06;
      pos.setY(i, h * (0.35 + flat * 0.9));
    }
    geo.computeVertexNormals();

    const sandTex = makeSandTexture(512);
    sandTex.repeat.set(6, 4);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xbca87f,
      roughness: 0.96,
      metalness: 0.0,
      bumpMap: sandTex,
      bumpScale: 0.35,
      roughnessMap: sandTex,
    });
    applyCaustics(mat, this.shared, { scale: 0.62, strength: 1.15 });

    const floor = new THREE.Mesh(geo, mat);
    floor.position.y = TANK.floorY;
    floor.receiveShadow = true;
    this.group.add(floor);
    this.floor = floor;
    this.floorMaterial = mat;
  }

  _buildWalls() {
    const backGeo = new THREE.PlaneGeometry(TANK.halfW * 2 + 0.4, TANK.waterY + 1.5, 1, 1);
    const backMat = new THREE.MeshStandardMaterial({
      color: 0x1b3b3f,
      roughness: 0.9,
      metalness: 0.05,
    });
    applyCaustics(backMat, this.shared, { scale: 0.5, strength: 0.75 });
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.set(0, (TANK.waterY + 1.5) / 2 - 0.6, TANK.backZ - 0.05);
    back.receiveShadow = true;
    this.group.add(back);

    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x123037,
      roughness: 0.75,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const sideGeo = new THREE.PlaneGeometry(TANK.halfD * 2 + 0.4, TANK.waterY + 1.5);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(sideGeo, sideMat);
      side.rotation.y = (Math.PI / 2) * s;
      side.position.set(s * (TANK.halfW + 0.1), (TANK.waterY + 1.5) / 2 - 0.6, 0);
      this.group.add(side);
    }
  }

  _buildSurface() {
    const geo = new THREE.PlaneGeometry(TANK.halfW * 2 + 0.3, TANK.halfD * 2 + 0.3, 48, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.shared.time,
        uClarity: this.shared.clarity,
        uWaterColor: this.shared.waterColor,
        uSunDir: { value: this.sunDir },
      },
      vertexShader: WATER_SURFACE_VERT,
      fragmentShader: WATER_SURFACE_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const surface = new THREE.Mesh(geo, mat);
    surface.position.y = TANK.waterY;
    surface.renderOrder = 4;
    this.group.add(surface);
    this.surface = surface;
  }

  _buildGodRays() {
    const rng = makeRandom(5);
    this.godRays = new THREE.Group();
    this.godRayMats = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
      const w = 0.55 + rng() * 1.05;
      const h = TANK.waterY + 1.2;
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.shared.time,
          uIntensity: { value: 0.16 },
          uSeed: { value: rng() },
          uColor: { value: new THREE.Color(0.55, 0.92, 1.05) },
        },
        vertexShader: GODRAY_VERT,
        fragmentShader: GODRAY_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (i / (count - 1) - 0.5) * (TANK.halfW * 2.1) + (rng() - 0.5) * 0.8,
        TANK.waterY - h / 2 + 0.3,
        -2.4 + rng() * 4.6
      );
      mesh.rotation.z = (rng() - 0.5) * 0.30;
      mesh.rotation.y = (rng() - 0.5) * 0.35;
      mesh.renderOrder = 5;
      this.godRays.add(mesh);
      this.godRayMats.push(mat);
    }
    this.group.add(this.godRays);
  }

  /** 浮遊物。にごっているうちは緑がかった塵、澄むと小さなきらめきに変わる。 */
  _buildDust() {
    const count = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    const rng = makeRandom(99);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * (TANK.halfW * 2.1);
      pos[i * 3 + 1] = rng() * TANK.waterY;
      pos[i * 3 + 2] = (rng() - 0.5) * (TANK.halfD * 2.0);
      seed[i] = rng() * TAU;
      size[i] = 0.03 + rng() * 0.075;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.shared.time,
        uClarity: this.shared.clarity,
        uMap: { value: makeGlowTexture(64) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uClarity;
        uniform float uPixelRatio;
        varying float vFade;
        varying float vSeed;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.22 + aSeed) * 0.35;
          p.y += sin(uTime * 0.16 + aSeed * 1.7) * 0.28 + mod(uTime * 0.05 + aSeed, 1.0) * 0.2;
          p.z += cos(uTime * 0.19 + aSeed * 2.3) * 0.30;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // にごりの塵は消え、澄んだ水では小さなきらめきが少しだけ残る
          vFade = mix(1.0, 0.30, uClarity);
          vSeed = aSeed;
          gl_PointSize = aSize * uPixelRatio * (330.0 / max(-mv.z, 0.001)) * mix(1.0, 0.55, uClarity);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uClarity;
        uniform float uTime;
        varying float vFade;
        varying float vSeed;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          vec3 murk = vec3(0.52, 0.60, 0.36);
          vec3 clean = vec3(0.72, 0.95, 1.05);
          vec3 col = mix(murk, clean, uClarity);
          float twinkle = mix(1.0, 0.45 + 0.55 * sin(uTime * 2.4 + vSeed * 8.0), uClarity);
          gl_FragColor = vec4(col, t.a * 0.42 * vFade * twinkle);
          if (gl_FragColor.a < 0.004) discard;
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 3;
    this.group.add(points);
    this.dust = points;
  }

  _buildGlass() {
    const geo = new THREE.PlaneGeometry(TANK.halfW * 2, TANK.waterY + 0.6);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.shared.time,
        uClarity: this.shared.clarity,
      },
      vertexShader: GLASS_VERT,
      fragmentShader: GLASS_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    const glass = new THREE.Mesh(geo, mat);
    glass.position.set(0, (TANK.waterY + 0.6) / 2 - 0.3, TANK.glassZ + 0.12);
    glass.renderOrder = 20;
    this.scene.add(glass);
    this.glass = glass;
  }

  _buildFrame() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0d2028,
      roughness: 0.4,
      metalness: 0.65,
    });
    mat.fog = false;
    const t = 0.34;
    const w = TANK.halfW * 2 + t * 2;
    const h = TANK.waterY + 0.9;
    const d = TANK.halfD * 2 + t * 2;
    const frame = new THREE.Group();

    const bar = (sx, sy, sz, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      m.position.set(x, y, z);
      frame.add(m);
      return m;
    };
    // 手前と奥の枠
    for (const z of [TANK.glassZ + t / 2, TANK.backZ - t / 2]) {
      bar(w, t, t, 0, h - 0.5, z);
      bar(w, t, t, 0, -0.4, z);
      bar(t, h + 0.2, t, -(TANK.halfW + t / 2), (h - 0.9) / 2, z);
      bar(t, h + 0.2, t, TANK.halfW + t / 2, (h - 0.9) / 2, z);
    }
    // 側面をつなぐ横木
    for (const x of [-(TANK.halfW + t / 2), TANK.halfW + t / 2]) {
      bar(t, t, d, x, h - 0.5, 0);
      bar(t, t, d, x, -0.4, 0);
    }
    // 底ぶち。砂の手前の切れ目を隠し、本物の水槽らしい台座に見せる。
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(TANK.halfW * 2 + 0.1, 0.70, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x0b1d25, roughness: 0.55, metalness: 0.3 })
    );
    trim.material.fog = false;
    trim.position.set(0, 0.05, TANK.glassZ + 0.02);
    frame.add(trim);

    frame.traverse((o) => { o.castShadow = false; o.receiveShadow = true; });
    this.scene.add(frame);
    this.frame = frame;
  }

  /** clarity 0→1 で、霧・光・浮遊物・水面の色をまとめて動かす。 */
  setClarity(c) {
    this.clarity = clamp(c, 0, 1);
    const k = this.clarity;
    const fogColor = new THREE.Color(WATER.murkyFog).lerp(new THREE.Color(WATER.clearFog), k);
    this.scene.fog.color.copy(fogColor);
    this.scene.fog.density = lerp(WATER.murkyDensity, WATER.clearDensity, Math.pow(k, 0.85));
    this.shared.clarity.value = k;
    this.shared.waterColor.value.copy(fogColor);
    this.shared.caustic.value = lerp(0.10, 0.46, Math.pow(k, 1.15));

    this.hemi.intensity = lerp(0.30, 0.58, k);
    this.sun.intensity = lerp(0.95, 1.75, k);
    this.rim.intensity = lerp(5, 13, k);
    this.fill.intensity = lerp(2.4, 5.5, k);

    const rayI = lerp(0.030, 0.135, Math.pow(k, 1.4));
    for (const m of this.godRayMats) m.uniforms.uIntensity.value = rayI;
  }

  update(dt, t) {
    // 光のカーテンがゆっくり左右に泳ぐ
    this.godRays.position.x = Math.sin(t * 0.11) * 0.5;
    this.godRays.rotation.y = Math.sin(t * 0.07) * 0.05;
  }
}
