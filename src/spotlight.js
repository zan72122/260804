// スポットライト。光の円錐・床の光だまり・影・反射が、指にずっと付いてくる。
import * as THREE from '../vendor/three.module.min.js';
import { clamp, lerp, damp, smoothstep, rand } from './util.js';
import { glowSprite } from './textures.js';

export const LIGHT_COLORS = [
  { id: 'white', light: 0xfff4e2, glow: 0xfff6e8, ui: '#fff3dd' },
  { id: 'pink', light: 0xff8fc0, glow: 0xffb6d8, ui: '#ff8fc0' },
  { id: 'gold', light: 0xffd27a, glow: 0xffe4a8, ui: '#ffd27a' },
  { id: 'aqua', light: 0x83d8ff, glow: 0xb2ecff, ui: '#83d8ff' },
  { id: 'mint', light: 0x9df0b8, glow: 0xc6ffd8, ui: '#9df0b8' },
  { id: 'violet', light: 0xc6a0ff, glow: 0xdcc4ff, ui: '#c6a0ff' },
];

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

export class SpotRig {
  constructor(scene, {
    origin = new THREE.Vector3(0, 8.6, 2.2),
    angle = 0.20,
    intensity = 160,
    colorIndex = 0,
  } = {}) {
    this.scene = scene;
    this.origin = origin.clone();
    this.angle = angle;
    this.baseIntensity = intensity;
    this.colorIndex = colorIndex;
    this.enabled = true;
    this.attractors = [];
    this.snapStrength = 0.72;
    this.time = 0;

    this.group = new THREE.Group();
    scene.add(this.group);

    this.target = new THREE.Object3D();
    this.target.position.set(0, 0, -3.2);
    scene.add(this.target);
    this.aim = this.target.position.clone();
    this.desired = this.aim.clone();

    const col = LIGHT_COLORS[colorIndex];

    this.light = new THREE.SpotLight(col.light, intensity, 42, angle, 0.55, 1.7);
    this.light.position.copy(this.origin);
    this.light.target = this.target;
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.camera.near = 1.5;
    this.light.shadow.camera.far = 34;
    this.light.shadow.bias = -0.0016;
    this.light.shadow.normalBias = 0.035;
    this.light.shadow.radius = 3;
    scene.add(this.light);

    this._buildHousing();
    this._buildCone();
    this._buildPool();
    this._buildDust();
    this.setColor(colorIndex);
  }

  _buildHousing() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x24262e, roughness: 0.48, metalness: 0.85 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.36, 0.92, 20, 1, true), bodyMat);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.30, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
    back.rotation.x = -Math.PI / 2;
    back.position.z = -0.46;
    g.add(back);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 26), bodyMat);
    ring.position.z = 0.46;
    g.add(ring);
    // レンズ
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.33, 24), this.lensMat);
    lens.position.z = 0.47;
    g.add(lens);
    // まぶしい玉
    this.lensGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowSprite(), color: 0xffffff, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, toneMapped: false, opacity: 0.9,
    }));
    this.lensGlow.scale.setScalar(2.4);
    this.lensGlow.position.z = 0.5;
    g.add(this.lensGlow);
    // 吊り金具
    const yokeMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.6, metalness: 0.7 });
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 6, 20, Math.PI), yokeMat);
    yoke.rotation.y = Math.PI / 2;
    g.add(yoke);
    this.housing = g;
    this.housing.position.copy(this.origin);
    this.group.add(g);

    // 吊りバーへのぶらさがり
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), yokeMat);
    hang.position.set(this.origin.x, this.origin.y + 0.42, this.origin.z);
    this.group.add(hang);
    this.hang = hang;
  }

  _buildCone() {
    const geo = new THREE.CylinderGeometry(0.10, 1.0, 1, 40, 12, true);
    geo.translate(0, -0.5, 0);   // 上端が原点
    this.coneMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xffffff) },
        uIntensity: { value: 1.0 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */`
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        varying vec2 vUvC;
        void main(){
          vUvC = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormalV = normalize(normalMatrix * normal);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uIntensity; uniform float uTime;
        varying vec3 vNormalV; varying vec3 vViewDir; varying vec2 vUvC;
        void main(){
          // 輪郭ほど明るく＝空気に散った光に見える
          float fres = 1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir)));
          fres = pow(clamp(fres, 0.0, 1.0), 3.1);
          float top = smoothstep(0.0, 0.22, vUvC.y);        // 灯体のすぐ下はしぼる
          float bottom = smoothstep(0.0, 0.34, 1.0 - vUvC.y); // 床の手前でやわらかく消す
          float haze = 0.82 + 0.18 * sin(vUvC.x * 26.0 + uTime * 0.7)
                              * sin(vUvC.y * 9.0 - uTime * 0.45);
          float a = fres * mix(0.25, 1.0, top) * mix(0.15, 1.0, bottom) * haze;
          a *= uIntensity;
          gl_FragColor = vec4(uColor * (0.42 + fres * 0.9), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.cone = new THREE.Mesh(geo, this.coneMat);
    this.cone.frustumCulled = false;
    this.cone.renderOrder = 6;
    this.group.add(this.cone);
  }

  _buildPool() {
    const mat = new THREE.MeshBasicMaterial({
      map: glowSprite(), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, opacity: 0.85,
    });
    this.poolMat = mat;
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = 0.015;
    this.pool.renderOrder = 5;
    this.group.add(this.pool);

    // にじんだ大きな暈
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: glowSprite('rgba(255,255,255,0.5)', 'rgba(255,255,255,0.16)'),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      toneMapped: false, opacity: 0.4,
    }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.01;
    halo.renderOrder = 4;
    this.halo = halo;
    this.group.add(halo);
  }

  _buildDust() {
    const N = 90;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = rand(-1, 1);
      pos[i * 3 + 1] = rand(0, 1);
      pos[i * 3 + 2] = rand(-1, 1);
      seed[i] = rand(0, 100);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xffffff) },
        uTime: { value: 0 },
        uLen: { value: 8 },
        uRad: { value: 2 },
        uSize: { value: 34 },
        uOpacity: { value: 0.5 },
      },
      vertexShader: /* glsl */`
        attribute float aSeed;
        uniform float uTime, uLen, uRad, uSize;
        varying float vA;
        void main(){
          float t = fract(position.y + uTime * 0.035 + aSeed * 0.01);
          float r = uRad * mix(0.12, 1.0, t) * 0.85;
          float ang = aSeed * 6.2831 + uTime * 0.12;
          vec3 p = vec3(cos(ang) * r * position.x, -t * uLen, sin(ang) * r * position.z);
          p.x += sin(uTime * 0.5 + aSeed) * 0.08;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (1.0 - t) * smoothstep(0.0, 0.18, t);
          gl_PointSize = uSize / max(1.0, -mv.z) * (0.5 + fract(aSeed) * 0.9);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uOpacity;
        varying float vA;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(d));
          gl_FragColor = vec4(uColor, a * a * vA * uOpacity);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.dust = new THREE.Points(g, this.dustMat);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 7;
    this.group.add(this.dust);
  }

  setColor(i) {
    this.colorIndex = ((i % LIGHT_COLORS.length) + LIGHT_COLORS.length) % LIGHT_COLORS.length;
    const c = LIGHT_COLORS[this.colorIndex];
    this.light.color.setHex(c.light);
    this.coneMat.uniforms.uColor.value.setHex(c.glow);
    this.dustMat.uniforms.uColor.value.setHex(c.glow);
    this.poolMat.color.setHex(c.glow);
    this.halo.material.color.setHex(c.glow);
    this.lensMat.color.setHex(c.glow);
    this.lensGlow.material.color.setHex(c.glow);
    return c;
  }
  nextColor() { return this.setColor(this.colorIndex + 1); }

  setIntensity(v) { this.intensityScale = v; }

  setVisible(v) {
    this.enabled = v;
    this.group.visible = v;
    this.light.visible = v;
  }

  // 少しくらいずれても、いちばん近い出演者やセットへ自然に吸いつく
  setAttractors(list) { this.attractors = list; }

  aimAt(point) { this.desired.copy(point); }

  _snap(p) {
    if (!this.attractors.length) return p;
    let best = null, bestD = Infinity;
    for (const a of this.attractors) {
      const pos = a.position ? a.position : a;
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (d < bestD) { bestD = d; best = pos; }
    }
    if (!best) return p;
    const R = 3.0;
    const k = (1 - smoothstep(0.35, R, bestD)) * this.snapStrength;
    p.x = lerp(p.x, best.x, k);
    p.z = lerp(p.z, best.z, k);
    return p;
  }

  update(dt) {
    this.time += dt;
    if (!this.enabled) return;

    _v.copy(this.desired);
    this._snap(_v);
    this.aim.x = damp(this.aim.x, _v.x, 9, dt);
    this.aim.y = damp(this.aim.y, _v.y, 9, dt);
    this.aim.z = damp(this.aim.z, _v.z, 9, dt);
    this.target.position.copy(this.aim);
    this.target.updateMatrixWorld();

    // 灯体を的へ向ける
    this.housing.lookAt(this.aim);

    const dir = _v.copy(this.aim).sub(this.origin);
    const len = dir.length();
    dir.normalize();
    _q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    this.cone.quaternion.copy(_q);
    this.cone.position.copy(this.origin);
    const R = Math.tan(this.angle) * len;
    this.cone.scale.set(R * 1.06, len * 1.09, R * 1.06);

    const s = this.intensityScale === undefined ? 1 : this.intensityScale;
    this.light.intensity = this.baseIntensity * s;
    this.coneMat.uniforms.uTime.value = this.time;
    this.coneMat.uniforms.uIntensity.value = 0.30 * s;
    this.lensGlow.material.opacity = 0.9 * s;

    // 床の光だまり（少し楕円につぶす＝斜めから当たっている感じ）
    const poolR = R * 2.35;
    this.pool.position.set(this.aim.x, 0.015, this.aim.z);
    this.pool.scale.set(poolR, poolR * 1.18, 1);
    this.poolMat.opacity = 0.85 * s;
    this.halo.position.set(this.aim.x, 0.008, this.aim.z);
    this.halo.scale.set(poolR * 2.3, poolR * 2.5, 1);
    this.halo.material.opacity = 0.30 * s;

    this.dust.position.copy(this.origin);
    this.dust.quaternion.copy(_q);
    this.dustMat.uniforms.uTime.value = this.time;
    this.dustMat.uniforms.uLen.value = len;
    this.dustMat.uniforms.uRad.value = R;
    this.dustMat.uniforms.uOpacity.value = 0.5 * s;
  }
}
