// Sparkles, snipped fabric, confetti, the falling offcut, and the three
// things that get drawn onto the moving cloth: the guide dots, the chalk
// line and the row of stitches.

import * as THREE from 'three';
import { makeStarSprite, makeSoftSprite } from './world.js';
import { Cloth } from './cloth.js';
import { clamp } from './geom2d.js';

const SPARK_VS = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColour;
uniform float uPR;
varying float vAlpha;
varying vec3 vColour;
void main() {
  vAlpha = aAlpha;
  vColour = aColour;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (260.0 / max(0.001, -mv.z)) * uPR;
  gl_Position = projectionMatrix * mv;
}`;

const SPARK_FS = `
uniform sampler2D uMap;
varying float vAlpha;
varying vec3 vColour;
void main() {
  vec4 t = texture2D(uMap, gl_PointCoord);
  if (t.a < 0.01) discard;
  gl_FragColor = vec4(vColour, 1.0) * t * vAlpha;
}`;

/** A recycled pool of twinkles. */
export class Sparkles {
  constructor(scene, count, pixelRatio, star = true) {
    this.n = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.max = new Float32Array(count);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.colour = new Float32Array(count * 3);
    this.grav = new Float32Array(count);
    this.head = 0;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aColour', new THREE.BufferAttribute(this.colour, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 30);

    this.mat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VS,
      fragmentShader: SPARK_FS,
      uniforms: {
        uMap: { value: star ? makeStarSprite() : makeSoftSprite('#ffffff') },
        uPR: { value: pixelRatio },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  burst(centre, count, opts = {}) {
    const spread = opts.spread ?? 0.28;
    const speed = opts.speed ?? 0.9;
    const life = opts.life ?? 0.85;
    const size = opts.size ?? 0.12;
    const grav = opts.gravity ?? -0.8;
    const colour = opts.colour ?? '#fff3d0';
    this._c.set(colour);
    for (let k = 0; k < count; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.n;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * spread;
      this.pos[i * 3] = centre.x + Math.sin(b) * Math.cos(a) * r;
      this.pos[i * 3 + 1] = centre.y + Math.cos(b) * r * 0.6 + 0.02;
      this.pos[i * 3 + 2] = centre.z + Math.sin(b) * Math.sin(a) * r;
      const sp = speed * (0.35 + Math.random() * 0.9);
      this.vel[i * 3] = Math.sin(b) * Math.cos(a) * sp;
      this.vel[i * 3 + 1] = Math.abs(Math.cos(b)) * sp * 0.9 + 0.25;
      this.vel[i * 3 + 2] = Math.sin(b) * Math.sin(a) * sp;
      this.max[i] = life * (0.6 + Math.random() * 0.8);
      this.life[i] = this.max[i];
      this.size[i] = size * (0.55 + Math.random() * 0.9);
      this.grav[i] = grav;
      this.colour[i * 3] = this._c.r;
      this.colour[i * 3 + 1] = this._c.g;
      this.colour[i * 3 + 2] = this._c.b;
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      any = true;
      this.life[i] -= dt;
      const t = clamp(this.life[i] / this.max[i], 0, 1);
      this.alpha[i] = t * t * (3 - 2 * t);
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      this.vel[i * 3] *= 0.985;
      this.vel[i * 3 + 2] *= 0.985;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aColour.needsUpdate = true;
    return any;
  }
}

/** Tumbling flakes: snipped fabric during cutting, confetti at the end. */
export class Flakes {
  constructor(scene, count, unlit = false) {
    this.n = count;
    const geo = new THREE.PlaneGeometry(0.11, 0.13);
    // confetti is unlit so every scrap stays bright whichever way it tumbles
    const matl = unlit
      ? new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true })
      : new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85, transparent: true });
    this.mesh = new THREE.InstancedMesh(geo, matl, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.count = count;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    scene.add(this.mesh);

    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    this.r = new Float32Array(count * 3);
    this.rv = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.scale = new Float32Array(count).fill(1);
    this.head = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._c = new THREE.Color();
    this.hide();
  }

  hide() {
    for (let i = 0; i < this.n; i++) {
      this.life[i] = 0;
      this._m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  spawn(centre, count, opts = {}) {
    const speed = opts.speed ?? 1.1;
    const life = opts.life ?? 1.6;
    const up = opts.up ?? 1.0;
    const spread = opts.spread ?? 0.1;
    const scale = opts.scale ?? 1;
    const colours = opts.colours || null;
    for (let k = 0; k < count; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.n;
      const a = Math.random() * Math.PI * 2;
      this.p[i * 3] = centre.x + (Math.random() - 0.5) * spread;
      this.p[i * 3 + 1] = centre.y + Math.random() * spread * 0.4;
      this.p[i * 3 + 2] = centre.z + (Math.random() - 0.5) * spread;
      const sp = speed * (0.4 + Math.random());
      this.v[i * 3] = Math.cos(a) * sp;
      this.v[i * 3 + 1] = up * (0.6 + Math.random() * 0.9);
      this.v[i * 3 + 2] = Math.sin(a) * sp;
      this.r[i * 3] = Math.random() * 6;
      this.r[i * 3 + 1] = Math.random() * 6;
      this.r[i * 3 + 2] = Math.random() * 6;
      this.rv[i * 3] = (Math.random() - 0.5) * 9;
      this.rv[i * 3 + 1] = (Math.random() - 0.5) * 9;
      this.rv[i * 3 + 2] = (Math.random() - 0.5) * 9;
      this.maxLife[i] = life * (0.7 + Math.random() * 0.6);
      this.life[i] = this.maxLife[i];
      this.scale[i] = scale * (0.7 + Math.random() * 0.7);
      if (colours) {
        this._c.set(colours[(Math.random() * colours.length) | 0]);
        this.mesh.instanceColor.setXYZ(i, this._c.r, this._c.g, this._c.b);
      }
    }
    if (colours) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt, floorY = 0.03) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.v[i * 3 + 1] -= 2.6 * dt;
      this.v[i * 3] *= 0.985;
      this.v[i * 3 + 2] *= 0.985;
      // flutter
      this.v[i * 3] += Math.sin(this.r[i * 3 + 1] * 2.0) * 0.6 * dt;
      this.v[i * 3 + 2] += Math.cos(this.r[i * 3] * 2.0) * 0.6 * dt;
      for (let a = 0; a < 3; a++) {
        this.p[i * 3 + a] += this.v[i * 3 + a] * dt;
        this.r[i * 3 + a] += this.rv[i * 3 + a] * dt;
      }
      if (this.p[i * 3 + 1] < floorY) {
        this.p[i * 3 + 1] = floorY;
        this.v[i * 3 + 1] = 0;
        this.v[i * 3] *= 0.86;
        this.v[i * 3 + 2] *= 0.86;
        this.rv[i * 3] *= 0.8; this.rv[i * 3 + 1] *= 0.8; this.rv[i * 3 + 2] *= 0.8;
      }
      const fade = clamp(this.life[i] / this.maxLife[i], 0, 1);
      const s = this.scale[i] * (0.35 + 0.65 * Math.min(1, fade * 2.4));
      this._t.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
      this._e.set(this.r[i * 3], this.r[i * 3 + 1], this.r[i * 3 + 2]);
      this._q.setFromEuler(this._e);
      this._s.set(s, s, s);
      this._m.compose(this._t, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      if (this.life[i] <= 0) {
        this._m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this._m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    return any;
  }
}

/** The cut-away fabric, peeling off the table and dissolving. */
export class Offcut {
  constructor(scene, geometry, material, origin) {
    this.mesh = new THREE.Mesh(geometry, material.clone());
    this.mesh.material.transparent = true;
    this.mesh.material.opacity = 1;
    this.mesh.material.side = THREE.DoubleSide;
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.scene = scene;

    const pos = geometry.attributes.position;
    this.base = pos.array.slice();
    this.delay = new Float32Array(pos.count);
    let maxD = 0.001;
    for (let i = 0; i < pos.count; i++) {
      const dx = this.base[i * 3] - origin.x, dz = this.base[i * 3 + 2] - origin.z;
      const d = Math.hypot(dx, dz);
      this.delay[i] = d;
      if (d > maxD) maxD = d;
    }
    for (let i = 0; i < pos.count; i++) this.delay[i] = (this.delay[i] / maxD) * 0.45;
    this.t = 0;
    this.done = false;
  }

  update(dt) {
    if (this.done) return false;
    this.t += dt;
    const pos = this.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, this.t - this.delay[i]);
      const drop = 2.7 * t * t;
      const wob = Math.sin(t * 7 + this.base[i * 3] * 3.2) * 0.05 * Math.min(1, t * 2);
      pos.array[i * 3] = this.base[i * 3] + wob * 0.6;
      pos.array[i * 3 + 1] = this.base[i * 3 + 1] - drop;
      pos.array[i * 3 + 2] = this.base[i * 3 + 2] + wob;
    }
    pos.needsUpdate = true;
    this.mesh.material.opacity = clamp(1.5 - this.t * 0.95, 0, 1);
    if (this.t > 1.7) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.done = true;
    }
    return !this.done;
  }
}

/**
 * The glowing dots that show where to go next. They are re-projected onto the
 * cloth every frame so they ride the fabric as it moves.
 */
export class GuideDots {
  constructor(scene, count) {
    const geo = new THREE.SphereGeometry(0.042, 10, 8);
    const matl = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.98, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, matl, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
    this.mesh.visible = false;
    scene.add(this.mesh);

    // a soft dark rim under each bead, so the trail reads on any fabric,
    // however pale the colourway happens to be
    this.rim = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.062, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x8a6a58, transparent: true, opacity: 0.3, depthWrite: false }),
      count
    );
    this.rim.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rim.frustumCulled = false;
    this.rim.renderOrder = 6;
    this.rim.visible = false;
    scene.add(this.rim);

    this.n = count;
    this.mesh.count = 0;
    this.rim.count = 0;
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._c = new THREE.Color();
    this._sample = Cloth.makeSample();
    this.doneColour = new THREE.Color('#ff9ec2');
    this.aheadColour = new THREE.Color('#fffdf2');
  }

  /** `pts` are pattern-space points; `s` values say where each one sits. */
  setPath(pts) {
    this.pts = pts;
    this.mesh.count = Math.min(this.n, pts.length);
    this.rim.count = this.mesh.count;
    this.mesh.visible = true;
    this.rim.visible = true;
  }

  hide() {
    this.mesh.visible = false;
    this.rim.visible = false;
    this.mesh.count = 0;
    this.rim.count = 0;
  }

  update(cloth, progress, time) {
    if (!this.mesh.visible || !this.pts) return;
    const n = this.mesh.count;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      const p = this.pts[i];
      cloth.sampleSurface(p.x, p.y, this._sample);
      this._p.copy(this._sample.pos).addScaledVector(this._sample.nrm, this._sample.puff + 0.012);
      const ahead = s - progress;
      let scale, alpha;
      if (ahead < -0.004) {
        scale = 0.5;
        this._c.copy(this.doneColour);
      } else {
        const near = Math.exp(-Math.max(0, ahead) * 14);
        const pulse = 0.85 + 0.35 * Math.sin(time * 6.5 - i * 0.55);
        scale = (0.7 + near * 0.8) * pulse;
        this._c.copy(this.aheadColour).lerp(this.doneColour, 1 - near);
      }
      this._s.setScalar(scale);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, this._c);
      this._s.setScalar(scale * 0.92);
      this._m.compose(this._p, this._q, this._s);
      this.rim.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.rim.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** The chalk line: a soft ribbon laid along the traced part of the outline. */
export class ChalkLine {
  constructor(scene, count) {
    this.n = count;
    const g = new THREE.BufferGeometry();
    this.arr = new Float32Array(count * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.arr, 3));
    const idx = [];
    for (let i = 0; i < count - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: 0xfffdf4, transparent: true, opacity: 0.94, side: THREE.DoubleSide,
      depthWrite: false,
    }));
    this.mesh.renderOrder = 5;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this._sample = Cloth.makeSample();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this.start = 0;
    this.count = 0;
  }

  setPath(pts) {
    this.pts = pts.slice(0, this.n);
    this.mesh.visible = true;
    this.start = 0;
    this.count = 0;
  }

  hide() { this.mesh.visible = false; }

  /** `from`..`to` in 0..1 select the visible stretch. */
  setRange(from, to) {
    const n = this.pts ? this.pts.length : 0;
    const a = Math.floor(clamp(from, 0, 1) * (n - 1));
    const b = Math.ceil(clamp(to, 0, 1) * (n - 1));
    this.start = a;
    this.count = Math.max(0, b - a);
    this.geo.setDrawRange(a * 6, Math.max(0, this.count * 6));
  }

  update(cloth, width = 0.028) {
    if (!this.mesh.visible || !this.pts || this.count === 0) return;
    const n = this.pts.length;
    if (!this._mid || this._mid.length !== n * 6) this._mid = new Float32Array(n * 6);
    const mid = this._mid;

    // one surface lookup per point, then tangents from the neighbours
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      cloth.sampleSurface(p.x, p.y, this._sample);
      const s = this._sample;
      mid[i * 6] = s.pos.x + s.nrm.x * (s.puff + 0.006);
      mid[i * 6 + 1] = s.pos.y + s.nrm.y * (s.puff + 0.006);
      mid[i * 6 + 2] = s.pos.z + s.nrm.z * (s.puff + 0.006);
      mid[i * 6 + 3] = s.nrm.x;
      mid[i * 6 + 4] = s.nrm.y;
      mid[i * 6 + 5] = s.nrm.z;
    }

    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1) * 6, b = Math.min(n - 1, i + 1) * 6;
      this._t.set(mid[b] - mid[a], mid[b + 1] - mid[a + 1], mid[b + 2] - mid[a + 2]);
      if (this._t.lengthSq() < 1e-9) this._t.set(1, 0, 0);
      this._b.set(mid[i * 6 + 3], mid[i * 6 + 4], mid[i * 6 + 5]);
      this._t.cross(this._b).normalize().multiplyScalar(width);
      this.arr[i * 6] = mid[i * 6] + this._t.x;
      this.arr[i * 6 + 1] = mid[i * 6 + 1] + this._t.y;
      this.arr[i * 6 + 2] = mid[i * 6 + 2] + this._t.z;
      this.arr[i * 6 + 3] = mid[i * 6] - this._t.x;
      this.arr[i * 6 + 4] = mid[i * 6 + 1] - this._t.y;
      this.arr[i * 6 + 5] = mid[i * 6 + 2] - this._t.z;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

/** The row of stitches the sewing machine leaves behind. */
export class Stitches {
  constructor(scene, count, colour) {
    const geo = new THREE.CapsuleGeometry(0.014, 0.05, 4, 8);
    geo.rotateZ(Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0.02 }),
      count
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.n = count;
    this.scene = scene;
    this._sample = Cloth.makeSample();
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);
    this._t = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._bt = new THREE.Vector3();
    this._basis = new THREE.Matrix4();
    this.grow = new Float32Array(count);
  }

  setPath(pts) {
    this.pts = pts.slice(0, this.n);
    this.shown = 0;
    this.mesh.count = 0;
    this.grow.fill(0);
  }

  setColour(c) { this.mesh.material.color.set(c); }

  /** Reveal stitches up to normalised progress. */
  setProgress(p) {
    if (!this.pts) return;
    const want = Math.round(clamp(p, 0, 1) * this.pts.length);
    if (want > this.shown) {
      this.shown = want;
      this.mesh.count = want;
    }
  }

  update(cloth, dt) {
    if (!this.pts || this.mesh.count === 0) return;
    const n = this.mesh.count;
    if (!this._mid || this._mid.length !== this.pts.length * 3) {
      this._mid = new Float32Array(this.pts.length * 3);
    }
    if (!this._nrm || this._nrm.length !== this.pts.length * 3) {
      this._nrm = new Float32Array(this.pts.length * 3);
    }
    const mid = this._mid, nrm = this._nrm;
    const last = Math.min(this.pts.length - 1, n);   // one extra point, for the tangent

    // one surface lookup per stitch, reused for both position and direction
    for (let i = 0; i <= last; i++) {
      const p = this.pts[i];
      cloth.sampleSurface(p.x, p.y, this._sample);
      const s = this._sample;
      mid[i * 3] = s.pos.x + s.nrm.x * (s.puff + 0.008);
      mid[i * 3 + 1] = s.pos.y + s.nrm.y * (s.puff + 0.008);
      mid[i * 3 + 2] = s.pos.z + s.nrm.z * (s.puff + 0.008);
      nrm[i * 3] = s.nrm.x; nrm[i * 3 + 1] = s.nrm.y; nrm[i * 3 + 2] = s.nrm.z;
    }

    for (let i = 0; i < n; i++) {
      this.grow[i] = Math.min(1, this.grow[i] + dt * 6);
      this._p.set(mid[i * 3], mid[i * 3 + 1], mid[i * 3 + 2]);
      this._n.set(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
      const j = Math.min(last, i + 1) * 3;
      this._t.set(mid[j] - this._p.x, mid[j + 1] - this._p.y, mid[j + 2] - this._p.z);
      if (this._t.lengthSq() < 1e-10) this._t.set(1, 0, 0);
      this._t.projectOnPlane(this._n).normalize();
      // (t, n, bt) must be right-handed or setFromRotationMatrix mangles it
      this._bt.crossVectors(this._t, this._n).normalize();
      this._basis.makeBasis(this._t, this._n, this._bt);
      this._q.setFromRotationMatrix(this._basis);
      const g = this.grow[i];
      this._s.set(g, g, g);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() { this.mesh.count = 0; this.shown = 0; this.pts = null; }
}
