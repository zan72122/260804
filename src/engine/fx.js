// Particle and flourish effects. Everything lives in world space so it
// occludes, parallaxes and shrinks with distance like the rest of the scene.

import * as THREE from 'three';
import * as G from './geo.js';
import * as TEX from './textures.js';
import { easeOutCubic, makeRng } from './util.js';

const rng = makeRng(9001);

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'fx';
    scene.add(this.root);
    this.live = [];

    this.dustMat = new THREE.SpriteMaterial({
      map: TEX.sprite('soft'), color: 0xd8c8a8, transparent: true,
      opacity: 0.5, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.glowMat = new THREE.SpriteMaterial({
      map: TEX.sprite('glow'), color: 0xffd9a0, transparent: true,
      opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.sparkGeo = new THREE.OctahedronGeometry(0.006, 0);
    this.coinGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.0025, 14);
  }

  _track(obj, life, update, onDone) {
    this.root.add(obj);
    this.live.push({ obj, t: 0, life, update, onDone });
    return obj;
  }

  /** Warm flash at a merge — the light that says "that worked". */
  flash(pos, color = 0xffd9a0, scale = 0.16) {
    const s = new THREE.Sprite(this.glowMat.clone());
    s.material.color = new THREE.Color(color);
    s.position.copy(pos);
    s.scale.setScalar(scale * 0.4);
    this._track(s, 0.42, (e, t) => {
      const k = t / e.life;
      s.scale.setScalar(scale * (0.4 + easeOutCubic(k) * 1.5));
      s.material.opacity = 1 - k * k;
    });
  }

  /** Sparks flung outward with gravity — real little solids, not billboards. */
  sparks(pos, color = 0xffc46a, count = 14, power = 0.55) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.sparkGeo, mat);
      m.position.copy(pos);
      const a = rng.range(0, Math.PI * 2), up = rng.range(0.5, 1.4);
      const v = new THREE.Vector3(Math.cos(a) * rng.range(0.3, 1), up, Math.sin(a) * rng.range(0.3, 1))
        .multiplyScalar(power * rng.range(0.6, 1.3));
      const spin = new THREE.Vector3(rng.range(-8, 8), rng.range(-8, 8), rng.range(-8, 8));
      m.scale.setScalar(rng.range(0.6, 1.5));
      this._track(m, rng.range(0.45, 0.8), (e, t) => {
        v.y -= 3.4 * e.dt;
        m.position.addScaledVector(v, e.dt);
        m.rotation.x += spin.x * e.dt; m.rotation.y += spin.y * e.dt; m.rotation.z += spin.z * e.dt;
        const k = t / e.life;
        m.scale.setScalar((1 - k) * rng.range(0.9, 1.1) * 1.2);
      });
    }
  }

  /** Dust puff kicked up when something heavy lands on the counter. */
  dust(pos, amount = 6, spread = 0.05) {
    for (let i = 0; i < amount; i++) {
      const s = new THREE.Sprite(this.dustMat.clone());
      s.position.copy(pos);
      const a = rng.range(0, Math.PI * 2);
      const dir = new THREE.Vector3(Math.cos(a), rng.range(0.2, 0.5), Math.sin(a)).multiplyScalar(spread * rng.range(0.6, 1.4));
      const start = rng.range(0.012, 0.03);
      s.scale.setScalar(start);
      s.material.opacity = rng.range(0.18, 0.4);
      const op = s.material.opacity;
      this._track(s, rng.range(0.5, 0.9), (e, t) => {
        const k = t / e.life;
        s.position.addScaledVector(dir, e.dt);
        dir.multiplyScalar(1 - 1.8 * e.dt);
        s.scale.setScalar(start * (1 + k * 2.4));
        s.material.opacity = op * (1 - k);
      });
    }
  }

  /** Expanding ground ring — spawns, level-ups, deliveries. */
  ring(pos, color = 0xffd9a0, maxR = 0.14, life = 0.5) {
    const geo = new THREE.RingGeometry(0.02, 0.026, 28);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(1.6), transparent: true,
      opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos).add(new THREE.Vector3(0, 0.002, 0));
    m.rotation.x = -Math.PI / 2;
    this._track(m, life, (e, t) => {
      const k = easeOutCubic(t / e.life);
      m.scale.setScalar(1 + k * (maxR / 0.023));
      mat.opacity = 0.9 * (1 - k);
    }, () => geo.dispose());
  }

  /** Coins arcing from a delivery into the money bowl. */
  coins(from, to, count = 6, mat) {
    const material = mat || new THREE.MeshStandardMaterial({ color: 0xd6a840, metalness: 1, roughness: 0.35 });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.coinGeo, material);
      m.position.copy(from);
      m.rotation.set(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3));
      const delay = i * 0.045;
      const arc = rng.range(0.14, 0.24);
      const jitter = new THREE.Vector3(rng.range(-0.02, 0.02), 0, rng.range(-0.02, 0.02));
      this._track(m, 0.62 + delay, (e, t) => {
        const k = Math.max(0, Math.min(1, (t - delay) / 0.6));
        m.position.lerpVectors(from, to, k).add(jitter.clone().multiplyScalar(1 - k));
        m.position.y += Math.sin(k * Math.PI) * arc;
        m.rotation.y += 14 * e.dt;
        m.rotation.x += 9 * e.dt;
        m.scale.setScalar(k > 0.85 ? (1 - k) / 0.15 : 1);
      });
    }
  }

  /** Steam / aroma curling off a finished dish. */
  steam(pos, color = 0xffffff) {
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(this.dustMat.clone());
      s.material.color = new THREE.Color(color);
      s.material.opacity = 0.0;
      s.position.copy(pos);
      const sway = rng.range(-0.02, 0.02);
      const delay = i * 0.25;
      this._track(s, 1.6 + delay, (e, t) => {
        const k = Math.max(0, (t - delay) / 1.5);
        s.position.y = pos.y + k * 0.13;
        s.position.x = pos.x + Math.sin(k * 4 + i) * 0.012 + sway * k;
        s.scale.setScalar(0.02 + k * 0.07);
        s.material.opacity = Math.sin(Math.min(k, 1) * Math.PI) * 0.3;
      });
    }
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const e = this.live[i];
      e.t += dt;
      e.dt = dt;
      e.update(e, e.t);
      if (e.t >= e.life) {
        this.root.remove(e.obj);
        e.obj.material?.dispose?.();
        e.onDone?.();
        this.live.splice(i, 1);
      }
    }
  }
}
