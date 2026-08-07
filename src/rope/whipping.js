import * as THREE from 'three';
import { hemp } from '../core/textures.js';
import { clamp01 } from '../core/util.js';

// ---------------------------------------------------------------------------
// 端の処理。細い麻紐をロープの端にきつく巻いて、ほどけないように留める。
// 巻きは実際のらせんで、ロープの太さに沿って進む。
// ---------------------------------------------------------------------------

const TURNS = 17;
const PITCH = 0.0088;
const TWINE = 0.0037;
const RADIAL = 6;
const RING = RADIAL + 1;
const STATIONS = 240;

export class Whipping {
  constructor(rope, sStart, dir = 1) {
    this.rope = rope;
    this.sStart = sStart;
    this.dir = dir;
    this.amount = 0;
    this.length = TURNS * PITCH;

    const total = STATIONS * RING;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(total * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(total * 2), 2));
    const idx = [];
    for (let j = 0; j < STATIONS - 1; j++) {
      for (let k = 0; k < RADIAL; k++) {
        const a = j * RING + k;
        const b = a + RING;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 60);
    const map = hemp(1);
    map.repeat.set(1, 40);
    this.mesh = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ map, color: 0xd8bf8e, roughness: 0.9 })
    );
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.geo = g;

    // 巻き終わりの留め結び
    this.knot = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 10, 8),
      new THREE.MeshStandardMaterial({ map: hemp(1), color: 0xd8bf8e, roughness: 0.9 })
    );
    this.knot.visible = false;

    this.group = new THREE.Group();
    this.group.add(this.mesh, this.knot);

    this._frame = {};
    this._cos = new Float32Array(RING);
    this._sin = new Float32Array(RING);
    for (let k = 0; k < RING; k++) {
      const a = (k / RADIAL) * Math.PI * 2;
      this._cos[k] = Math.cos(a);
      this._sin[k] = Math.sin(a);
    }
    this._p = new THREE.Vector3();
    this._prev = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  setAmount(a) {
    this.amount = clamp01(a);
    this.mesh.visible = this.amount > 0.004;
    this.knot.visible = this.amount > 0.985;
  }

  /** ロープの現在の形に合わせて巻きを作りなおす */
  rebuild() {
    if (!this.mesh.visible) return;
    const g = this.geo;
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal.array;
    const uv = g.attributes.uv.array;
    const f = this._frame;
    const used = this.length * this.amount;

    // まず、らせんの中心線を出す
    const center = this._centers || (this._centers = new Float32Array(STATIONS * 3));
    for (let j = 0; j < STATIONS; j++) {
      const u = j / (STATIONS - 1);
      const s = this.sStart + this.dir * u * used;
      this.rope.sampleFrame(s, f);
      const psi = u * used * ((Math.PI * 2) / PITCH) + f.theta * 0.15;
      const r = this.rope.ropeRadiusAt(s) + TWINE * 0.85;
      center[j * 3] = f.p.x + r * (Math.cos(psi) * f.n.x + Math.sin(psi) * f.b.x);
      center[j * 3 + 1] = f.p.y + r * (Math.cos(psi) * f.n.y + Math.sin(psi) * f.b.y);
      center[j * 3 + 2] = f.p.z + r * (Math.cos(psi) * f.n.z + Math.sin(psi) * f.b.z);
    }

    // 中心線に沿って細い管を張る
    let px = 0, py = 1, pz = 0;
    for (let j = 0; j < STATIONS; j++) {
      const j0 = Math.max(0, j - 1) * 3;
      const j1 = Math.min(STATIONS - 1, j + 1) * 3;
      let tx = center[j1] - center[j0];
      let ty = center[j1 + 1] - center[j0 + 1];
      let tz = center[j1 + 2] - center[j0 + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      const dp = px * tx + py * ty + pz * tz;
      let nx = px - tx * dp, ny = py - ty * dp, nz = pz - tz * dp;
      let nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-4) { nx = 0; ny = 0; nz = 1; nl = 1; }
      nx /= nl; ny /= nl; nz /= nl;
      px = nx; py = ny; pz = nz;
      const bx = ty * nz - tz * ny;
      const by = tz * nx - tx * nz;
      const bz = tx * ny - ty * nx;
      for (let k = 0; k < RING; k++) {
        const ca = this._cos[k], sa = this._sin[k];
        const dx = ca * nx + sa * bx;
        const dy = ca * ny + sa * by;
        const dz = ca * nz + sa * bz;
        const v = (j * RING + k) * 3;
        pos[v] = center[j * 3] + TWINE * dx;
        pos[v + 1] = center[j * 3 + 1] + TWINE * dy;
        pos[v + 2] = center[j * 3 + 2] + TWINE * dz;
        nor[v] = dx; nor[v + 1] = dy; nor[v + 2] = dz;
        const vi = (j * RING + k) * 2;
        uv[vi] = k / RADIAL;
        uv[vi + 1] = j / 6;
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;

    const last = (STATIONS - 1) * 3;
    this.knot.position.set(center[last], center[last + 1], center[last + 2]);
  }
}
