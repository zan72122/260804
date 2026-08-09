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
  playOverview: { pos: V(0.0, 0.90, 1.02), target: V(0, 0.230, 0.03), speed: 2.6 },
  playAim: { pos: V(0.0, 1.26, 0.62), target: V(0, 0.240, 0.02), speed: 2.4 },
};

// 接触は低い斜め側面から。押される向きの正面側に回り込む。
export function contactShot(prizePos, dir) {
  const side = dir >= 0 ? -1 : 1;
  return {
    pos: V(side * 0.92, 0.58, 0.94),
    target: V(prizePos.x * 0.5, prizePos.y - 0.03, prizePos.z * 0.7),
    speed: 2.2,
  };
}

// 落ちるときだけ少し引く
export function fallShot(prizePos, dir) {
  const s = contactShot(prizePos, dir);
  s.pos.multiplyScalar(1.18);
  s.pos.y = 0.72;
  s.target.set(prizePos.x * 0.4, 0.14, prizePos.z * 0.6);
  s.speed = 1.5;
  return s;
}
