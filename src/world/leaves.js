/**
 * 底に積もった落ち葉。
 * ノズルを近づけるとふわっと吸い寄せられ、透明ホースの中を通って
 * フィルターまで運ばれていくのが見える。
 */
import * as THREE from 'three';
import { TANK } from './config.js';
import { makeLeafTexture, makeRandom, randRange, clamp, TAU } from '../core/util.js';

const LEAF_COLORS = [0xc9622f, 0xd98b34, 0xb8452e, 0xa8873a, 0x8f5a2b, 0xd6a94a, 0x7d6b33];

export class Leaves {
  constructor(scene, shared, equipment, bubbles, sparkles) {
    this.scene = scene;
    this.equipment = equipment;
    this.bubbles = bubbles;
    this.sparkles = sparkles;

    this.texture = makeLeafTexture(160);
    this.group = new THREE.Group();
    scene.add(this.group);

    const rng = makeRandom(31337);
    this.items = [];
    const count = 24;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: LEAF_COLORS[Math.floor(rng() * LEAF_COLORS.length)],
        map: this.texture,
        alphaMap: this.texture,
        transparent: true,
        alphaTest: 0.35,
        roughness: 0.78,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });
      // 水の色に沈まないよう、自分の色をすこし発光させて拾いやすくする
      mat.emissive = new THREE.Color(mat.color.getHex()).multiplyScalar(0.30);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.10), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = false;

      // 中央の平らな砂地にばらまく（縦持ちでも全部に手が届く範囲）
      const a = rng() * TAU;
      const rad = Math.sqrt(rng()) * 2.35;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad * 0.85 + 0.1;
      mesh.position.set(x, TANK.floorY + 0.07 + rng() * 0.03, z);
      mesh.rotation.set(-Math.PI / 2 + randRange(rng, -0.22, 0.22), rng() * TAU, randRange(rng, -0.3, 0.3));
      this.group.add(mesh);

      this.items.push({
        mesh,
        state: 'rest',
        home: mesh.position.clone(),
        phase: rng() * TAU,
        spin: randRange(rng, -3, 3),
        hoseT: 1,
        speed: randRange(rng, 0.55, 0.8),
      });
    }
    this.total = this.items.length;
    this.collected = 0;
    this._tmp = new THREE.Vector3();
  }

  get progress() {
    return clamp(this.collected / this.total, 0, 1);
  }

  /** まだ残っている葉のうち、指定点にいちばん近いもの。 */
  nearest(point) {
    let best = null, bestD = Infinity;
    for (const it of this.items) {
      if (it.state !== 'rest') continue;
      const d = it.mesh.position.distanceTo(point);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  /**
   * ノズルの吸い込み。
   * @param nozzlePos 吸い込み口のワールド座標
   * @param active 吸っているかどうか
   * @param radius 吸い込む半径（大きめ＝やさしい）
   */
  suck(nozzlePos, active, radius, dt) {
    let pulled = 0;
    for (const it of this.items) {
      if (it.state === 'rest') {
        const d = it.mesh.position.distanceTo(nozzlePos);
        if (active && d < radius) {
          it.state = 'pull';
          pulled++;
        } else if (active && d < radius * 2.1) {
          // 近づいただけでも、ふわっと持ち上がって寄ってくる
          this._tmp.copy(nozzlePos).sub(it.mesh.position).normalize();
          it.mesh.position.addScaledVector(this._tmp, dt * 0.55);
          it.mesh.position.y = Math.min(it.mesh.position.y + dt * 0.18, TANK.floorY + 0.35);
          it.mesh.rotation.z += dt * 1.2;
        }
      }
    }
    return pulled;
  }

  update(dt, t, nozzlePos) {
    for (const it of this.items) {
      const m = it.mesh;
      if (it.state === 'rest') {
        // 水流でひらひら揺れる
        m.rotation.z = Math.sin(t * 0.9 + it.phase) * 0.16;
        m.position.y = it.home.y + Math.sin(t * 1.1 + it.phase) * 0.015;
      } else if (it.state === 'pull') {
        this._tmp.copy(nozzlePos).sub(m.position);
        const d = this._tmp.length();
        this._tmp.normalize();
        // 近いほど速く吸い込まれる。遠くても必ず前へ進むこと（後退させない）。
        const speed = 2.6 + Math.max(0, 1 - d) * 2.4;
        m.position.addScaledVector(this._tmp, Math.min(d, speed * dt * 1.6));
        m.rotation.x += dt * it.spin * 1.6;
        m.rotation.y += dt * it.spin;
        m.scale.setScalar(clamp(0.35 + d * 0.5, 0.35, 1));
        if (d < 0.22) {
          it.state = 'inhose';
          it.hoseT = 1;
          m.scale.setScalar(0.42);
        }
      } else if (it.state === 'inhose') {
        it.hoseT -= dt * it.speed;
        if (it.hoseT <= 0) {
          it.state = 'gone';
          m.visible = false;
          this.collected++;
          const p = this.equipment.pointAlong(0, this._tmp);
          this.bubbles.burst(p.x, p.y + 0.1, p.z, 5, 0.14);
          this.sparkles.burst(p.x, p.y + 0.15, p.z, 6, { color: [0.65, 1.0, 0.85], size: 0.14 });
        } else {
          this.equipment.pointAlong(it.hoseT, m.position);
          m.rotation.x += dt * 4.5;
          m.rotation.z += dt * 3.0;
        }
      }
    }
  }

  reset() {
    for (const it of this.items) {
      it.state = 'rest';
      it.hoseT = 1;
      it.mesh.visible = true;
      it.mesh.scale.setScalar(1);
      it.mesh.position.copy(it.home);
    }
    this.collected = 0;
  }

  /** 仕上げの自動回収。取り残しでつまずかせない。 */
  autoCollect() {
    for (const it of this.items) {
      if (it.state === 'rest') { it.state = 'pull'; return true; }
    }
    return false;
  }
}
