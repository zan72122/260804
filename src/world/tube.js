/**
 * 毎フレーム形を変えられるチューブ。
 * TubeGeometry を作り直すとゴミが出るので、頂点を直接書き換える方式にした。
 * 法線は平行移動フレーム（parallel transport）で作るので、ねじれが出ない。
 */
import * as THREE from 'three';

export class Tube {
  constructor(segments = 48, radialSegments = 10, radius = 0.11) {
    this.segments = segments;
    this.radialSegments = radialSegments;
    this.radius = radius;

    const vertCount = (segments + 1) * (radialSegments + 1);
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(vertCount * 3);
    this.normals = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= radialSegments; j++) {
        const k = i * (radialSegments + 1) + j;
        uvs[k * 2] = i / segments;
        uvs[k * 2 + 1] = j / radialSegments;
      }
    }
    const indices = [];
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geometry.setIndex(indices);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);

    // 作業用（毎フレームの確保を避ける）
    this._pts = Array.from({ length: segments + 1 }, () => new THREE.Vector3());
    this._tan = new THREE.Vector3();
    this._nrm = new THREE.Vector3(0, 1, 0);
    this._bin = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._prevTan = new THREE.Vector3(0, 0, 1);
  }

  /** curve から点を取り直してチューブを張り直す。 */
  update(curve, radiusScale = 1) {
    const { segments, radialSegments } = this;
    for (let i = 0; i <= segments; i++) curve.getPoint(i / segments, this._pts[i]);

    this._nrm.set(0, 1, 0);
    for (let i = 0; i <= segments; i++) {
      const p = this._pts[i];
      const a = this._pts[Math.max(i - 1, 0)];
      const b = this._pts[Math.min(i + 1, segments)];
      this._tan.subVectors(b, a);
      if (this._tan.lengthSq() < 1e-10) this._tan.copy(this._prevTan);
      this._tan.normalize();
      this._prevTan.copy(this._tan);

      // 前の法線を接線に直交化して持ち回る＝ねじれない
      this._tmp.copy(this._tan).multiplyScalar(this._nrm.dot(this._tan));
      this._nrm.sub(this._tmp);
      if (this._nrm.lengthSq() < 1e-8) {
        this._nrm.set(0, 1, 0).cross(this._tan);
        if (this._nrm.lengthSq() < 1e-8) this._nrm.set(1, 0, 0).cross(this._tan);
      }
      this._nrm.normalize();
      this._bin.crossVectors(this._tan, this._nrm).normalize();

      // 端だけ少し細めて、口金に自然に吸い込ませる
      const t = i / segments;
      const taper = 0.80 + 0.20 * Math.sqrt(Math.sin(Math.PI * t));
      const r = this.radius * radiusScale * taper;

      for (let j = 0; j <= radialSegments; j++) {
        const v = (j / radialSegments) * Math.PI * 2;
        const cx = Math.cos(v), sy = Math.sin(v);
        const nx = cx * this._nrm.x + sy * this._bin.x;
        const ny = cx * this._nrm.y + sy * this._bin.y;
        const nz = cx * this._nrm.z + sy * this._bin.z;
        const k = (i * (radialSegments + 1) + j) * 3;
        this.normals[k] = nx; this.normals[k + 1] = ny; this.normals[k + 2] = nz;
        this.positions[k] = p.x + nx * r;
        this.positions[k + 1] = p.y + ny * r;
        this.positions[k + 2] = p.z + nz * r;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
  }
}
