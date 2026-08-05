/**
 * 岩・水草・小石といった飾り。
 * 遊びの邪魔にならないよう、掃除に使う中央の空間は空けて配置する。
 */
import * as THREE from 'three';
import { TANK } from './config.js';
import { applyCaustics, applySway } from './shaders.js';
import { makeRandom, randRange, TAU } from '../core/util.js';

const ROCK_COLORS = [0x4a5a55, 0x3d4f52, 0x56635a, 0x33454a];
const WEED_COLORS = [0x2f7f4a, 0x39975a, 0x1f6b52, 0x4aa86a, 0x2a8f7a];
const CORAL_COLORS = [0xef8a6a, 0xf2b45c, 0xd96a8a, 0x7fd6c2];

export class Decor {
  constructor(scene, shared) {
    this.scene = scene;
    this.shared = shared;
    this.group = new THREE.Group();
    scene.add(this.group);
    const rng = makeRandom(1234);
    this._buildRocks(rng);
    this._buildWeeds(rng);
    this._buildCorals(rng);
    this._buildPebbles(rng);
  }

  _rockGeometry(rng, radius) {
    const geo = new THREE.IcosahedronGeometry(radius, 2);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    const s1 = rng() * 10, s2 = rng() * 10;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n =
        Math.sin(v.x * 2.1 + s1) * 0.12 +
        Math.cos(v.y * 1.7 + s2) * 0.10 +
        Math.sin(v.z * 2.6 + s1 * 0.5) * 0.09;
      v.multiplyScalar(1 + n);
      v.y *= 0.78;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  _buildRocks(rng) {
    const spots = [
      [-4.3, 0.0, -1.9, 1.35], [-3.2, 0.0, -2.7, 0.85], [4.4, 0.0, -2.1, 1.5],
      [3.3, 0.0, -2.9, 0.9], [-5.0, 0.0, 0.9, 0.95], [5.0, 0.0, 0.6, 1.05],
      [0.4, 0.0, -3.0, 0.8], [-1.9, 0.0, -3.05, 0.62], [2.1, 0.0, -3.1, 0.7],
    ];
    for (const [x, , z, r] of spots) {
      const geo = this._rockGeometry(rng, r);
      const mat = new THREE.MeshStandardMaterial({
        color: ROCK_COLORS[Math.floor(rng() * ROCK_COLORS.length)],
        roughness: 0.92,
        metalness: 0.04,
      });
      applyCaustics(mat, this.shared, { scale: 0.7, strength: 0.85 });
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set(x, TANK.floorY + r * 0.36, z);
      rock.rotation.set(rng() * 0.4, rng() * TAU, rng() * 0.4);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
    }
  }

  /** 一枚の海藻。根元から先端に向かって細く、明るくなる。 */
  _weedBlade(rng, height, width, color) {
    const seg = 14;
    const geo = new THREE.PlaneGeometry(width, height, 1, seg);
    geo.translate(0, height / 2, 0);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(color);
    const tip = base.clone().lerp(new THREE.Color(0xd8ffb0), 0.45);
    const curve = randRange(rng, -0.5, 0.5);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = y / height;
      pos.setX(i, pos.getX(i) * (1 - t * 0.72));
      pos.setZ(i, pos.getZ(i) + curve * t * t * height * 0.28);
      const c = base.clone().lerp(tip, t);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }

  _buildWeeds(rng) {
    const clusters = [
      [-4.6, -1.4], [-3.6, -2.4], [4.7, -1.2], [3.6, -2.5], [-5.2, 1.6],
      [5.2, 1.3], [-2.4, -3.0], [2.6, -3.0], [0.0, -3.15], [-5.3, -2.6], [5.3, -2.7],
    ];
    for (const [cx, cz] of clusters) {
      const n = 4 + Math.floor(rng() * 4);
      const color = WEED_COLORS[Math.floor(rng() * WEED_COLORS.length)];
      for (let i = 0; i < n; i++) {
        const h = randRange(rng, 1.4, 3.1);
        const w = randRange(rng, 0.18, 0.42);
        const geo = this._weedBlade(rng, h, w, color);
        const mat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.72,
          metalness: 0.0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.96,
        });
        applySway(mat, this.shared, {
          amount: randRange(rng, 0.14, 0.3),
          speed: randRange(rng, 0.6, 1.15),
          phase: rng() * TAU,
        });
        const blade = new THREE.Mesh(geo, mat);
        blade.position.set(cx + randRange(rng, -0.6, 0.6), TANK.floorY - 0.05, cz + randRange(rng, -0.45, 0.45));
        blade.rotation.y = rng() * TAU;
        blade.castShadow = true;
        this.group.add(blade);
      }
    }
  }

  /** まるい枝サンゴ。子どもが見て「かわいい」と思える色に。 */
  _buildCorals(rng) {
    const spots = [[-3.9, -2.9], [3.9, -2.85], [-5.35, 0.0], [5.35, -0.4]];
    for (const [x, z] of spots) {
      const coral = new THREE.Group();
      const color = CORAL_COLORS[Math.floor(rng() * CORAL_COLORS.length)];
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.0,
        emissive: new THREE.Color(color).multiplyScalar(0.16),
      });
      applyCaustics(mat, this.shared, { scale: 0.8, strength: 0.6 });
      const armCount = 5 + Math.floor(rng() * 3);
      for (let i = 0; i < armCount; i++) {
        const len = randRange(rng, 0.5, 1.15);
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(randRange(rng, 0.09, 0.16), len, 4, 8), mat);
        const a = (i / armCount) * TAU + rng() * 0.5;
        arm.position.set(Math.cos(a) * 0.22, len / 2 + 0.1, Math.sin(a) * 0.22);
        arm.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
        arm.castShadow = true;
        coral.add(arm);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(randRange(rng, 0.12, 0.2), 10, 8), mat);
        tip.position.set(
          arm.position.x - Math.cos(a) * 0.06 + Math.sin(-Math.cos(a) * 0.45) * 0,
          arm.position.y + len / 2,
          arm.position.z
        );
        coral.add(tip);
      }
      coral.position.set(x, TANK.floorY, z);
      coral.scale.setScalar(randRange(rng, 0.8, 1.15));
      this.group.add(coral);
    }
  }

  _buildPebbles(rng) {
    const count = 46;
    const geo = new THREE.DodecahedronGeometry(0.12, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb9ac8f, roughness: 0.95 });
    applyCaustics(mat, this.shared, { scale: 0.9, strength: 0.9 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      p.set(randRange(rng, -TANK.halfW + 0.4, TANK.halfW - 0.4), TANK.floorY + 0.05, randRange(rng, -TANK.halfD + 0.4, TANK.halfD - 0.5));
      e.set(rng() * TAU, rng() * TAU, rng() * TAU);
      q.setFromEuler(e);
      const sc = randRange(rng, 0.5, 1.3);
      s.set(sc, sc * 0.6, sc);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }
}
