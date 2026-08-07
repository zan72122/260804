import * as THREE from 'three';
import { makeRng } from '../core/util';

/**
 * Calm deep-sea company. Nothing here has teeth, nothing lunges at the camera:
 * jellyfish drift, a small school wanders past, a ray glides through once in a
 * while. Movement is slow and predictable on purpose.
 */

export class SeaLife {
  group = new THREE.Group();
  private jellies: {
    obj: THREE.Group;
    bell: THREE.Mesh;
    seed: number;
    baseY: number;
    mat: THREE.MeshStandardMaterial;
    tentMat: THREE.MeshStandardMaterial;
  }[] = [];
  private school!: THREE.InstancedMesh;
  private schoolSeeds: Float32Array;
  private ray: THREE.Group;
  private rayWings: THREE.Mesh[] = [];
  private count: number;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v3 = new THREE.Vector3();
  private s3 = new THREE.Vector3(1, 1, 1);
  private e = new THREE.Euler();

  constructor(seabedY: (x: number, z: number) => number, x0: number, x1: number, glow: number) {
    const rng = makeRng(451);

    // ---- jellyfish --------------------------------------------------------
    const bellPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      bellPts.push(new THREE.Vector2(Math.sin(t * Math.PI * 0.52) * 0.62, Math.cos(t * Math.PI * 0.52) * 0.72));
    }
    const bellGeo = new THREE.LatheGeometry(bellPts, 18);
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xbfe4f2,
        transparent: true,
        opacity: 0.4,
        roughness: 0.25,
        metalness: 0,
        emissive: new THREE.Color(glow).multiplyScalar(0.22),
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const bell = new THREE.Mesh(bellGeo, mat);
      g.add(bell);
      const tentMat = new THREE.MeshStandardMaterial({
        color: 0xcfe8f2,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        roughness: 0.4,
      });
      const tentGeo = new THREE.CylinderGeometry(0.012, 0.028, 1.5, 4);
      tentGeo.translate(0, -0.75, 0);
      for (let t = 0; t < 6; t++) {
        const a = (t / 6) * Math.PI * 2;
        const m = new THREE.Mesh(tentGeo, tentMat);
        m.position.set(Math.cos(a) * 0.4, -0.12, Math.sin(a) * 0.4);
        m.rotation.z = Math.cos(a) * 0.14;
        m.rotation.x = -Math.sin(a) * 0.14;
        g.add(m);
      }
      // Kept well off the cable corridor and high in the water column. These
      // are depth-write-free transparents: one drifting into the working shot
      // paints a huge pale smear over the whole scene.
      const x = x0 + rng() * (x1 - x0);
      const z = (rng() > 0.5 ? 1 : -1) * (16 + rng() * 30);
      const baseY = seabedY(x, z) + 12 + rng() * 20;
      g.position.set(x, baseY, z);
      const s = 0.7 + rng() * 1.5;
      g.scale.setScalar(s);
      g.renderOrder = 4;
      this.group.add(g);
      this.jellies.push({ obj: g, bell, seed: rng() * 100, baseY, mat, tentMat });
    }

    // ---- small school -----------------------------------------------------
    this.count = 70;
    const fishGeo = (() => {
      const body = new THREE.ConeGeometry(0.11, 0.5, 6);
      body.rotateX(-Math.PI / 2);
      const tail = new THREE.ConeGeometry(0.1, 0.2, 4);
      tail.rotateX(Math.PI / 2);
      tail.translate(0, 0, 0.3);
      const merged = new THREE.BufferGeometry();
      const posA = body.attributes.position.array as Float32Array;
      const posB = tail.attributes.position.array as Float32Array;
      const pos = new Float32Array(posA.length + posB.length);
      pos.set(posA, 0);
      pos.set(posB, posA.length);
      merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const idxA = Array.from(body.index!.array);
      const idxB = Array.from(tail.index!.array).map((v) => v + posA.length / 3);
      merged.setIndex([...idxA, ...idxB]);
      merged.computeVertexNormals();
      body.dispose();
      tail.dispose();
      return merged;
    })();
    const fishMat = new THREE.MeshStandardMaterial({ color: 0xa9c6cf, roughness: 0.4, metalness: 0.3, emissive: 0x0b1a1f });
    this.school = new THREE.InstancedMesh(fishGeo, fishMat, this.count);
    this.school.frustumCulled = false;
    this.schoolSeeds = new Float32Array(this.count * 4);
    const cx = (x0 + x1) * 0.5;
    for (let i = 0; i < this.count; i++) {
      this.schoolSeeds[i * 4] = rng() * 6.28;
      this.schoolSeeds[i * 4 + 1] = 3 + rng() * 6;
      this.schoolSeeds[i * 4 + 2] = rng() * 6.28;
      this.schoolSeeds[i * 4 + 3] = 0.6 + rng() * 0.5;
    }
    this.school.userData.centre = new THREE.Vector3(cx, seabedY(cx, 0) + 9, -18);
    this.group.add(this.school);

    // ---- ray --------------------------------------------------------------
    this.ray = new THREE.Group();
    {
      const mat = new THREE.MeshStandardMaterial({ color: 0x4a5a63, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), mat);
      body.scale.set(1, 0.3, 1.5);
      this.ray.add(body);
      for (const s of [-1, 1]) {
        const shape = new THREE.Shape();
        shape.moveTo(0, -1.1);
        shape.quadraticCurveTo(2.6, -0.9, 3.4, 0.5);
        shape.quadraticCurveTo(1.6, 0.4, 0, 1.3);
        shape.closePath();
        const g = new THREE.ShapeGeometry(shape, 12);
        g.rotateX(-Math.PI / 2);
        const wing = new THREE.Mesh(g, mat);
        wing.scale.x = s;
        this.ray.add(wing);
        this.rayWings.push(wing);
      }
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.01, 2.6, 6), mat);
      tail.rotation.x = Math.PI / 2;
      tail.position.z = 2.0;
      this.ray.add(tail);
      this.ray.position.set(x0 + (x1 - x0) * 0.3, seabedY(x0, 0) + 16, 40);
      this.ray.scale.setScalar(1.5);
    }
    this.group.add(this.ray);
    this.group.visible = false;
  }

  setVisible(v: boolean) {
    this.group.visible = v;
  }

  update(time: number, focus: THREE.Vector3) {
    if (!this.group.visible) return;
    for (const j of this.jellies) {
      const pulse = Math.sin(time * 0.9 + j.seed) * 0.5 + 0.5;
      j.bell.scale.set(1 + pulse * 0.14, 1 - pulse * 0.2, 1 + pulse * 0.14);
      j.obj.position.y = j.baseY + Math.sin(time * 0.42 + j.seed) * 1.6 + pulse * 0.4;
      j.obj.rotation.y = time * 0.06 + j.seed;
      // dissolve rather than swallow the frame if one ends up near the lens
      const d = j.obj.position.distanceTo(focus);
      const near = Math.min(1, Math.max(0, (d - 3) / 7));
      j.mat.opacity = 0.4 * near;
      j.tentMat.opacity = 0.22 * near;
      j.obj.visible = near > 0.02;
    }

    const c = this.school.userData.centre as THREE.Vector3;
    c.x = focus.x + Math.sin(time * 0.11) * 26;
    c.z = focus.z + Math.cos(time * 0.09) * 22 - 6;
    for (let i = 0; i < this.count; i++) {
      const a = this.schoolSeeds[i * 4] + time * this.schoolSeeds[i * 4 + 3] * 0.34;
      const r = this.schoolSeeds[i * 4 + 1];
      const b = this.schoolSeeds[i * 4 + 2] + time * 0.22;
      this.v3.set(c.x + Math.cos(a) * r, c.y + Math.sin(b) * 1.6 + Math.sin(a * 2) * 0.7, c.z + Math.sin(a) * r * 1.4);
      this.e.set(0, -a + Math.PI / 2, Math.sin(time * 4 + i) * 0.12);
      this.q.setFromEuler(this.e);
      this.m4.compose(this.v3, this.q, this.s3);
      this.school.setMatrixAt(i, this.m4);
    }
    this.school.instanceMatrix.needsUpdate = true;

    const flap = Math.sin(time * 0.85);
    for (let i = 0; i < this.rayWings.length; i++) {
      this.rayWings[i].rotation.z = flap * 0.42 * (i === 0 ? -1 : 1);
    }
    this.ray.position.z = 40 - ((time * 2.4) % 120);
    this.ray.position.x = focus.x - 14 + Math.sin(time * 0.2) * 8;
    this.ray.position.y = focus.y + 12 + Math.sin(time * 0.31) * 2.4;
    this.ray.rotation.y = Math.PI + Math.sin(time * 0.2) * 0.2;
  }
}
