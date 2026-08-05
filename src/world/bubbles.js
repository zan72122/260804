/**
 * 泡。ゲーム中いちばん目に入る要素なので、丁寧に作る。
 * フレネルで縁が光り、上がるほど揺れて、水面で消える。
 */
import * as THREE from 'three';
import { TANK } from './config.js';
import { makeRandom, randRange, TAU } from '../core/util.js';

const BUBBLE_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying float vSeed;
  attribute float aSeed;
  void main() {
    vSeed = aSeed;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const BUBBLE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uWaterColor;
  varying vec3 vNormalW;
  varying vec3 vWorld;
  varying float vSeed;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorld);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.6);

    // 薄膜干渉のような、ほんのりした虹色
    float irid = sin(fres * 12.0 + vSeed * 6.0 + uTime * 0.7);
    vec3 rainbow = vec3(0.55 + 0.45 * sin(irid + 0.0),
                        0.55 + 0.45 * sin(irid + 2.1),
                        0.55 + 0.45 * sin(irid + 4.2));

    vec3 col = mix(uWaterColor * 1.15, vec3(1.0), fres);
    col = mix(col, rainbow, 0.22 * fres);

    // 上からの光を受けたハイライト
    vec3 L = normalize(vec3(-0.3, 1.0, 0.5));
    float spec = pow(max(dot(reflect(-V, N), L), 0.0), 42.0);
    col += vec3(1.0) * spec * 1.6;

    float a = 0.10 + fres * 0.80 + spec * 0.6;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`;

export class Bubbles {
  constructor(scene, shared, capacity = 320) {
    this.capacity = capacity;
    this.shared = shared;
    this.rng = makeRandom(4242);

    const geo = new THREE.IcosahedronGeometry(1, 1);
    const seeds = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) seeds[i] = this.rng();
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: shared.time,
        uWaterColor: shared.waterColor,
      },
      vertexShader: BUBBLE_VERT,
      fragmentShader: BUBBLE_FRAG,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = capacity;
    this.mesh.renderOrder = 8;
    scene.add(this.mesh);

    this.pool = [];
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        r: 0.05,
        phase: this.rng() * TAU,
        wobble: 0.4,
        life: 0,
      });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._hidden = new THREE.Vector3(0, -999, 0);
    this._cursor = 0;
    this.activeCount = 0;
  }

  spawn(x, y, z, opts = {}) {
    // 使い回し。空きが無ければいちばん古いものを奪う。
    let b = null;
    for (let i = 0; i < this.capacity; i++) {
      const idx = (this._cursor + i) % this.capacity;
      if (!this.pool[idx].alive) { b = this.pool[idx]; this._cursor = (idx + 1) % this.capacity; break; }
    }
    if (!b) { b = this.pool[this._cursor]; this._cursor = (this._cursor + 1) % this.capacity; }

    const rng = this.rng;
    b.alive = true;
    b.pos.set(x, y, z);
    b.r = opts.r ?? randRange(rng, 0.045, 0.14);
    b.vel.set(randRange(rng, -0.2, 0.2), (opts.speed ?? randRange(rng, 0.7, 1.5)), randRange(rng, -0.15, 0.15));
    b.phase = rng() * TAU;
    b.wobble = randRange(rng, 0.25, 0.75);
    b.life = 0;
    return b;
  }

  /** 一点からまとまって湧く（作業のごほうび演出用）。 */
  burst(x, y, z, n = 10, spread = 0.25) {
    for (let i = 0; i < n; i++) {
      const rng = this.rng;
      this.spawn(
        x + randRange(rng, -spread, spread),
        y + randRange(rng, -spread, spread),
        z + randRange(rng, -spread, spread),
        { r: randRange(rng, 0.04, 0.13) }
      );
    }
  }

  update(dt, t) {
    let count = 0;
    for (let i = 0; i < this.capacity; i++) {
      const b = this.pool[i];
      if (b.alive) {
        b.life += dt;
        // 大きい泡ほど速く上がる（実際の浮力に近い感じ）
        b.vel.y += (b.r * 3.4 + 0.35) * dt;
        b.vel.y = Math.min(b.vel.y, 2.6);
        b.pos.y += b.vel.y * dt;
        b.pos.x += (b.vel.x + Math.sin(t * 3.1 + b.phase) * b.wobble) * dt;
        b.pos.z += (b.vel.z + Math.cos(t * 2.7 + b.phase * 1.4) * b.wobble * 0.6) * dt;
        if (b.pos.y > TANK.waterY - 0.06) b.alive = false;
        if (b.life > 14) b.alive = false;
        const wob = 1 + Math.sin(t * 7 + b.phase) * 0.09;
        this._s.set(b.r * wob, b.r / wob, b.r * wob);
        this._m.compose(b.pos, this._q, this._s);
        count++;
      } else {
        this._s.set(0.0001, 0.0001, 0.0001);
        this._m.compose(this._hidden, this._q, this._s);
      }
      this.mesh.setMatrixAt(i, this._m);
    }
    this.activeCount = count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
