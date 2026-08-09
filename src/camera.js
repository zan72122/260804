// カメラ連鎖。組立と試遊で同じ筐体・同じ座標系を見せる。
// カットは「位置と注視点」を滑らかに追うだけで、別世界へ飛ばない。

import * as THREE from '../vendor/three.module.js';

export class Director {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 0.78, 1.02);
    this.target = new THREE.Vector3(0, 0.20, -0.03);
    this.wantPos = this.pos.clone();
    this.wantTarget = this.target.clone();
    this.speed = 2.6;
    this.hold = 0;
    this.portrait = false;
    this.zoom = 1;
  }

  set(pos, target, opts = {}) {
    this.wantPos.copy(pos);
    this.wantTarget.copy(target);
    this.speed = opts.speed ?? 2.6;
    if (opts.hold) this.hold = opts.hold;
    if (opts.snap) {
      this.pos.copy(pos);
      this.target.copy(target);
    }
  }

  freeze(t) { this.hold = t; }

  update(dt) {
    if (this.hold > 0) {
      this.hold -= dt;
    } else {
      const k = 1 - Math.exp(-this.speed * dt);
      this.pos.lerp(this.wantPos, k);
      this.target.lerp(this.wantTarget, k);
    }
    // 縦画面では引いて、筐体全体が入るようにする
    const off = this._off.subVectors(this.pos, this.target).multiplyScalar(this.zoom);
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
  }

  _off = new THREE.Vector3();
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const SHOTS = {
  // 筐体内部全体が見える斜め上
  buildOverview: { pos: V(0.03, 0.92, 1.02), target: V(0, 0.185, 0.075), speed: 2.4 },
  // バーを持つと、ソケットが見える角度へ軽く寄る
  buildCarry: { pos: V(0.04, 0.80, 0.90), target: V(0, 0.225, 0.075), speed: 3.0 },
  playOverview: { pos: V(0.0, 0.86, 0.98), target: V(0, 0.235, 0.03), speed: 2.6 },
  playAim: { pos: V(0.0, 1.00, 0.46), target: V(0, 0.255, 0.0), speed: 2.4 },
};

export function contactShot(prizePos, dir) {
  const side = dir >= 0 ? -1 : 1;
  return {
    pos: V(side * 0.54, 0.40, 0.50),
    target: V(prizePos.x * 0.6, prizePos.y - 0.01, prizePos.z * 0.8),
    speed: 2.2,
  };
}

export function fallShot(prizePos, dir) {
  const s = contactShot(prizePos, dir);
  s.pos.multiplyScalar(1.22);
  s.pos.y = 0.52;
  s.speed = 1.6;
  return s;
}
