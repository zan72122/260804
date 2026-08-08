// 少数インスタンスのパーティクル（土粒・水滴）。JS 側で簡易物理。
import * as THREE from '../vendor/three.module.js';
import { makeRng, rr, clamp01 } from './util.js';

const HIDDEN = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001).setPosition(0, -9999, 0);

class Pool {
  constructor(scene, geo, mat, max) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);
    this.items = [];
    for (let i = 0; i < max; i++) {
      this.items.push({
        alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(),
        rot: new THREE.Euler(), rv: new THREE.Vector3(), life: 0, maxLife: 1, s: 1, ground: 0,
      });
      this.mesh.setMatrixAt(i, HIDDEN);
    }
    this.cursor = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._sv = new THREE.Vector3();
  }
  spawn(p, v, s, life, groundY = 0) {
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    it.alive = true;
    it.p.copy(p); it.v.copy(v);
    it.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    it.rv.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
    it.s = s; it.life = 0; it.maxLife = life; it.ground = groundY;
    return it;
  }
  update(dt, gravity, drag, bounce) {
    const m = this._m, q = this._q, sv = this._sv;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const it = this.items[i];
      if (!it.alive) continue;
      any = true;
      it.life += dt;
      if (it.life >= it.maxLife) {
        it.alive = false;
        this.mesh.setMatrixAt(i, HIDDEN);
        continue;
      }
      it.v.y += gravity * dt;
      it.v.multiplyScalar(Math.exp(-drag * dt));
      it.p.addScaledVector(it.v, dt);
      it.rot.x += it.rv.x * dt; it.rot.y += it.rv.y * dt; it.rot.z += it.rv.z * dt;
      if (it.p.y < it.ground) {
        it.p.y = it.ground;
        it.v.y *= -bounce;
        it.v.x *= 0.55; it.v.z *= 0.55;
        it.rv.multiplyScalar(0.5);
        if (Math.abs(it.v.y) < 0.25) it.v.y = 0;
      }
      const fade = 1 - Math.pow(clamp01(it.life / it.maxLife), 3);
      q.setFromEuler(it.rot);
      sv.setScalar(it.s * (0.35 + fade * 0.65));
      m.compose(it.p, q, sv);
      this.mesh.setMatrixAt(i, m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() {
    for (let i = 0; i < this.max; i++) { this.items[i].alive = false; this.mesh.setMatrixAt(i, HIDDEN); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene, quality = 1) {
    this.rng = makeRng(4242);
    const nSoil = Math.round(230 * quality);
    const nWater = Math.round(150 * quality);

    const soilGeo = new THREE.IcosahedronGeometry(0.065, 0);
    this.soilMat = new THREE.MeshStandardMaterial({ color: 0x6b5138, roughness: 1.0, metalness: 0 });
    this.soil = new Pool(scene, soilGeo, this.soilMat, nSoil);

    const waterGeo = new THREE.SphereGeometry(0.085, 6, 4);
    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x9fd4e8, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.82,
    });
    this.water = new Pool(scene, waterGeo, this.waterMat, nWater);
  }

  setSoilColor(rgb) {
    this.soilMat.color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  }

  // 刃が土に入るときの土粒
  digSpray(pos, dir, amount = 1, groundY = 0) {
    const n = Math.max(1, Math.round(3 * amount));
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(
        dir.x * rr(this.rng, 0.3, 1.5) + rr(this.rng, -0.9, 0.9),
        rr(this.rng, 0.9, 2.6),
        dir.z * rr(this.rng, 0.3, 1.5) + rr(this.rng, -0.9, 0.9),
      );
      const p = pos.clone().add(new THREE.Vector3(rr(this.rng, -0.18, 0.18), 0.02, rr(this.rng, -0.18, 0.18)));
      this.soil.spawn(p, v, rr(this.rng, 0.55, 1.5), rr(this.rng, 0.9, 1.8), groundY);
    }
  }

  // 根鉢からパラパラ落ちる
  crumbleFrom(getPoint, count, worldMatrix, groundY = 0, spread = 0.5) {
    for (let i = 0; i < count; i++) {
      const local = getPoint(this.rng);
      const p = local.applyMatrix4(worldMatrix);
      const v = new THREE.Vector3(rr(this.rng, -spread, spread), rr(this.rng, -0.4, 0.3), rr(this.rng, -spread, spread));
      this.soil.spawn(p, v, rr(this.rng, 0.5, 1.4), rr(this.rng, 1.2, 2.4), groundY);
    }
  }

  burst(pos, count, power = 3, groundY = 0) {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2;
      const up = rr(this.rng, 0.4, 1.6);
      const rad = rr(this.rng, 0.4, 1.3) * power;
      const v = new THREE.Vector3(Math.cos(a) * rad, up * power * 0.65, Math.sin(a) * rad);
      const p = pos.clone().add(new THREE.Vector3(rr(this.rng, -0.5, 0.5), rr(this.rng, 0, 0.3), rr(this.rng, -0.5, 0.5)));
      this.soil.spawn(p, v, rr(this.rng, 0.6, 1.7), rr(this.rng, 1.0, 2.2), groundY);
    }
  }

  // 放物線でノズルから根元へ届く水
  waterJet(from, to, count = 2) {
    const d = to.clone().sub(from);
    const dist = Math.max(0.5, d.length());
    const dirn = d.clone().normalize();
    const speed = dist * 2.6;
    for (let i = 0; i < count; i++) {
      const p = from.clone().addScaledVector(dirn, rr(this.rng, 0, 0.25)).add(new THREE.Vector3(
        rr(this.rng, -0.05, 0.05), rr(this.rng, -0.04, 0.04), rr(this.rng, -0.05, 0.05)));
      const v = dirn.clone().multiplyScalar(speed * rr(this.rng, 0.92, 1.08))
        .add(new THREE.Vector3(rr(this.rng, -0.4, 0.4), dist * 0.85, rr(this.rng, -0.4, 0.4)));
      this.water.spawn(p, v, rr(this.rng, 0.7, 1.5), rr(this.rng, 0.7, 1.1), to.y);
    }
  }

  update(dt) {
    this.soil.update(dt, -13.5, 0.55, 0.22);
    this.water.update(dt, -15.0, 0.18, 0.06);
  }
  clear() { this.soil.clear(); this.water.clear(); }
}
