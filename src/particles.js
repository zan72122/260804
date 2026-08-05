// パーティクル：きらきら・ほこり・紙ふぶき
import * as THREE from 'three';
import { sparkleTexture } from './textures.js';

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.pools = [];
    this.sparkleTex = sparkleTexture();
  }

  burst(pos, { count = 14, color = 0xffe38a, size = 0.09, speed = 1.0, gravity = -1.2, life = 0.9, spread = 1 } = {}) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.25;
      velocities.push(new THREE.Vector3(
        Math.cos(a) * speed * spread * (0.3 + Math.random() * 0.7),
        up * speed * 1.3,
        Math.sin(a) * speed * spread * (0.3 + Math.random() * 0.7) + 0.3
      ));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: this.sparkleTex, color, size, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.pools.push({ points, velocities, life, age: 0, gravity, geo, mat });
  }

  dust(pos, count = 8) {
    this.burst(pos, { count, color: 0xb0a48e, size: 0.06, speed: 0.5, gravity: -0.5, life: 0.7, spread: 1.2 });
  }

  confettiShower(center, count = 60) {
    // ひらひら落ちる紙片（InstancedMesh）
    const geo = new THREE.PlaneGeometry(0.05, 0.08);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
    const cols = [0xef6f81, 0xffc94d, 0x59b0e0, 0x8fc978, 0xc9a7eb, 0xffffff];
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const items = [];
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const p = new THREE.Vector3(
        center.x + (Math.random() - 0.5) * 4.2,
        center.y + 1.2 + Math.random() * 1.6,
        center.z + (Math.random() - 0.5) * 3.2
      );
      items.push({
        p,
        v: new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.55 - Math.random() * 0.5, (Math.random() - 0.5) * 0.4),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        rv: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6),
        phase: Math.random() * Math.PI * 2,
      });
      mesh.setColorAt(i, color.setHex(cols[i % cols.length]));
      dummy.position.copy(p);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this.confetti = { mesh, items, dummy, age: 0, life: 7 };
  }

  update(dt) {
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.age += dt;
      const posAttr = p.geo.attributes.position;
      for (let j = 0; j < p.velocities.length; j++) {
        const v = p.velocities[j];
        v.y += p.gravity * dt;
        posAttr.array[j * 3] += v.x * dt;
        posAttr.array[j * 3 + 1] += v.y * dt;
        posAttr.array[j * 3 + 2] += v.z * dt;
      }
      posAttr.needsUpdate = true;
      p.mat.opacity = Math.max(0, 1 - p.age / p.life);
      if (p.age >= p.life) {
        this.scene.remove(p.points);
        p.geo.dispose(); p.mat.dispose();
        this.pools.splice(i, 1);
      }
    }
    if (this.confetti) {
      const c = this.confetti;
      c.age += dt;
      for (let i = 0; i < c.items.length; i++) {
        const it = c.items[i];
        // ひらひら（左右に揺れる落下）
        it.p.x += (it.v.x + Math.sin(c.age * 3 + it.phase) * 0.35) * dt;
        it.p.y += it.v.y * dt;
        it.p.z += it.v.z * dt;
        if (it.p.y < 0.03) { it.p.y = 0.03; it.v.set(0, 0, 0); it.rv.multiplyScalar(0.9); }
        it.rot.x += it.rv.x * dt;
        it.rot.y += it.rv.y * dt;
        it.rot.z += it.rv.z * dt;
        c.dummy.position.copy(it.p);
        c.dummy.rotation.copy(it.rot);
        c.dummy.updateMatrix();
        c.mesh.setMatrixAt(i, c.dummy.matrix);
      }
      c.mesh.instanceMatrix.needsUpdate = true;
      if (c.age > c.life) {
        this.scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        this.confetti = null;
      }
    }
  }
}
