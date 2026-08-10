// Procedural plush toys.
//
// Every prize is built from a shared kit of soft ellipsoids, cone ears, thread
// tori (seams / embroidery) and small "product" props (hangtag, ribbon, bell)
// so they read as manufactured toys rather than creatures.
//
// Secondary motion: every dangly part (ears, arms, legs, tail, head) hangs off a
// pivot driven by a damped spring. Feed the body's acceleration in and the limbs
// lag behind it; that lag is what sells "this thing is soft and heavy".

import * as THREE from '../vendor/three/three.module.min.js';
import { plushMaterial, fuzzMaterial, threadMaterial, eyeMaterial } from './materials.js';
import { tagTexture } from './textures.js';
import { Spring, clamp, makeRng } from './util.js';

/* ------------------------------------------------------------------ */
/* shared geometry                                                     */
/* ------------------------------------------------------------------ */

// Shared, deliberately low-poly primitives. A prize is ~40 parts and six of
// them sit in the case at once, so the segment counts here are the difference
// between a smooth phone frame rate and a slideshow. Small trim uses the S
// variants — nobody can see the facets on a 4 mm eye highlight.
const G = {};
const geoSphere = (q = 1) => (G['s' + q] ||= new THREE.SphereGeometry(1, q > 0.6 ? 18 : 12, q > 0.6 ? 12 : 8));
const geoSphereS = () => (G.sS ||= new THREE.SphereGeometry(1, 10, 7));
const geoCone = () => (G.cone ||= new THREE.ConeGeometry(1, 1, 12, 1));
const geoCyl = () => (G.cyl ||= new THREE.CylinderGeometry(1, 1, 1, 8, 1));
const geoTorus = () => (G.torus ||= new THREE.TorusGeometry(1, 0.08, 6, 20));
const geoTorusS = () => (G.torusS ||= new THREE.TorusGeometry(1, 0.08, 4, 12));
const geoTorusHalf = () => (G.torusH ||= new THREE.TorusGeometry(1, 0.1, 5, 10, Math.PI));
// partial ring used for the crown seam: sweeps from the nape over the top and
// stops before it would cross the face
const geoSeamArc = () => (G.seamArc ||= new THREE.TorusGeometry(1, 0.05, 5, 14, 1.7));
const geoPlane = () => (G.plane ||= new THREE.PlaneGeometry(1, 1));

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------------ */
/* species definitions                                                 */
/* ------------------------------------------------------------------ */

export const SPECIES = ['rabbit', 'bear', 'cat', 'dog', 'chick', 'unicorn'];

export const SPECIES_INFO = {
  rabbit:  { name: 'うさぎ',    size: 0.300 },
  bear:    { name: 'くま',      size: 0.320 },
  cat:     { name: 'ねこ',      size: 0.285 },
  dog:     { name: 'いぬ',      size: 0.300 },
  chick:   { name: 'ひよこ',    size: 0.255 },
  unicorn: { name: 'ユニコーン', size: 0.305 },
};

// Toy-shop colours: pastel but properly saturated, so six prizes on one shelf
// never read as "six white blobs".
const PALETTES = {
  rabbit: [
    { fur: 0xfbe8ee, inner: 0xffb3cd, acc: 0xff6fa5, thread: 0x6b4a58 },
    { fur: 0xcdb6ef, inner: 0xf0e2ff, acc: 0x8b6fd6, thread: 0x4a3d6b },
    { fur: 0xffce9e, inner: 0xffeddb, acc: 0xff8f47, thread: 0x7a4f2e },
  ],
  bear: [
    { fur: 0xc8853f, inner: 0xf2d5a8, acc: 0xe04a34, thread: 0x4a3020 },
    { fur: 0x835434, inner: 0xd0a97c, acc: 0x4fa6d6, thread: 0x33210f },
    { fur: 0xf0cfa4, inner: 0xfff0dc, acc: 0xff6f9e, thread: 0x6e5232 },
  ],
  cat: [
    { fur: 0xfff0dc, inner: 0xffa8a8, acc: 0xffb62d, thread: 0x6b5140 },
    { fur: 0x7f8ea0, inner: 0xffbcc6, acc: 0xff6f9e, thread: 0x333d49 },
    { fur: 0xf59a3c, inner: 0xffd49a, acc: 0x3ec0ad, thread: 0x6b3f14 },
  ],
  dog: [
    { fur: 0xecd3a0, inner: 0xffbfa4, acc: 0xff6f38, thread: 0x5f4526 },
    { fur: 0xd2cabd, inner: 0xffc4c4, acc: 0x5b98e0, thread: 0x45403a },
    { fur: 0x8f5c36, inner: 0xe3b58a, acc: 0xffc22d, thread: 0x33200f },
  ],
  chick: [
    { fur: 0xffd42d, inner: 0xff9d1c, acc: 0xff6f9e, thread: 0x6b4a00 },
    { fur: 0xffe98a, inner: 0xffb52d, acc: 0x5bc4ff, thread: 0x6b5200 },
    { fur: 0xffb347, inner: 0xff8c1a, acc: 0x7ed957, thread: 0x6b3d00 },
  ],
  unicorn: [
    { fur: 0xefe0ff, inner: 0xffbfe6, acc: 0x9776ff, thread: 0x50396e, mane: [0xff8fbe, 0x86c9ff, 0xffe97a] },
    { fur: 0xcfe9ff, inner: 0xb8d4ff, acc: 0x54aef5, thread: 0x2f4a66, mane: [0xa78fff, 0xff9ecb, 0x7fe8c8] },
    { fur: 0xffd9e6, inner: 0xffc0d2, acc: 0xff6f9e, thread: 0x6e3a50, mane: [0xffe97a, 0x9fdcff, 0xff9ecb] },
  ],
};

/* ------------------------------------------------------------------ */
/* build helpers                                                       */
/* ------------------------------------------------------------------ */

function mesh(parent, geo, mat, p, s, r, shadow = false) {
  const m = new THREE.Mesh(geo, mat);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (s) m.scale.set(s[0], s[1], s[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  m.castShadow = shadow;
  m.matrixAutoUpdate = true;
  parent.add(m);
  return m;
}

function pivot(parent, p) {
  const o = new THREE.Object3D();
  o.position.set(p[0], p[1], p[2]);
  parent.add(o);
  return o;
}

/** Thin stitched seam ring. Pass a null parent to skip it at low detail. */
function seam(parent, radius, p, r, mat, tube = 0.055) {
  if (parent === null) return null;
  const m = mesh(parent, geoTorus(), mat, p, [radius, radius, radius], r);
  // flatten the tube against the surface
  m.scale.set(radius, radius, radius * (tube / 0.08));
  return m;
}

/* ------------------------------------------------------------------ */
/* Plush                                                               */
/* ------------------------------------------------------------------ */

export class Plush {
  /**
   * @param {string} species
   * @param {number} variant
   * @param {{quality?:number, fuzz?:boolean, seed?:number, detail?:'hero'|'game'}} [opt]
   */
  constructor(species, variant = 0, opt = {}) {
    const q = opt.quality ?? 1;
    const rng = makeRng((opt.seed ?? 1) * 7919 + variant * 131 + species.length * 17);
    this.species = species;
    this.variant = variant % PALETTES[species].length;
    this.pal = PALETTES[species][this.variant];
    this.info = SPECIES_INFO[species];
    this.size = this.info.size;

    this.root = new THREE.Group();
    this.body = new THREE.Group();           // squash / stretch lives here
    this.root.add(this.body);
    this.body.scale.setScalar(this.size);

    /** @type {{pivot:THREE.Object3D, rest:THREE.Euler, sx:Spring, sz:Spring, gain:number, droop:number}[]} */
    this.springs = [];

    this.materials = [];
    this.fuzzMeshes = [];

    const fur = plushMaterial(this.pal.fur, { fuzz: 0.11, scatter: 0.03 });
    const inner = plushMaterial(this.pal.inner, { fuzz: 0.13, scatter: 0.04, repeat: 9 });
    const thread = threadMaterial(this.pal.thread);
    const accent = threadMaterial(this.pal.acc, { roughness: 0.28 });
    const eyeM = eyeMaterial(0x241d24);
    const gloss = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, clearcoat: 1, metalness: 0 });
    const seamMat = threadMaterial(new THREE.Color(this.pal.fur).multiplyScalar(0.86).getHex(), { roughness: 0.62 });
    this.materials.push(fur, inner, thread, accent, eyeM, gloss, seamMat);
    this.mats = { fur, inner, thread, accent, eyeM, gloss, seam: seamMat };

    // 'hero' = the reveal and the collection room, where the toy fills the
    // screen. 'game' = in the case, where trim smaller than a stitch is wasted.
    this.detail = opt.detail || 'hero';
    this.hero = this.detail === 'hero';
    this.useFuzz = opt.fuzz !== false && q > 0.55;
    this._build(species, rng, q);

    // squash state
    this.squashY = new Spring(190, 13, 1);
    this.squashTarget = 1;
    this.tiltX = new Spring(60, 9, 0);
    this.tiltZ = new Spring(60, 9, 0);

    this._prevVel = V(0, 0, 0);
    this._accel = V(0, 0, 0);
    this._tmp = V(0, 0, 0);
    this._q = new THREE.Quaternion();
    this.lifted = 0;
    this.time = rng() * 10;
  }

  /* ---------------- construction ---------------- */

  _fuzz(sourceMesh, color, offset = 0.05, key = false) {
    if (!this.useFuzz) return null;
    if (!this.hero && !key) return null;
    const m = new THREE.Mesh(sourceMesh.geometry, fuzzMaterial(color, { offset, strength: 0.62, power: 4.2 }));
    m.position.copy(sourceMesh.position);
    m.scale.copy(sourceMesh.scale);
    m.rotation.copy(sourceMesh.rotation);
    m.renderOrder = 4;
    sourceMesh.parent.add(m);
    this.fuzzMeshes.push(m);
    this.materials.push(m.material);
    return m;
  }

  _limb(parent, p, scale, mat, { gain = 0.55, droop = 0.6, rest = [0, 0, 0], shadow = false, geo = null } = {}) {
    shadow = false;   // only the two big masses cast: shadow-pass draws are costly
    const pv = pivot(parent, p);
    pv.rotation.set(rest[0], rest[1], rest[2]);
    const m = mesh(pv, geo || geoSphere(), mat, [0, -scale[1] * 0.82, 0], scale, null, shadow);
    this.springs.push({
      pivot: pv,
      rest: new THREE.Euler(rest[0], rest[1], rest[2]),
      sx: new Spring(150, 11, 0),
      sz: new Spring(150, 11, 0),
      gain, droop,
    });
    return { pivot: pv, mesh: m };
  }

  /**
   * Place a part on an ellipsoid surface (the head, or a muzzle) with its local
   * +Z along the outward normal. Flat embroidery only lies flush if it follows
   * the real curvature, so the ellipsoid radii are passed in explicitly.
   */
  _attach(parent, geo, mat, p, n, scale, { spin = 0, order = 1 } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(p);
    m.quaternion.setFromUnitVectors(_AXIS_Z, n);
    if (spin) m.rotateZ(spin);
    m.scale.set(scale[0], scale[1], scale[2]);
    m.renderOrder = order;
    parent.add(m);
    return m;
  }

  /** Point + normal on the head ellipsoid for a direction (head-local units). */
  _onHead(dir, k = 0.95, out = {}) {
    const R = this._headR;
    const d = _n1.copy(dir).normalize();
    out.p = new THREE.Vector3(d.x * R[0] * k, d.y * R[1] * k, d.z * R[2] * k);
    out.n = new THREE.Vector3(d.x / R[0], d.y / R[1], d.z / R[2]).normalize();
    return out;
  }

  _face(head, o) {
    const { inner, thread, eyeM, gloss } = this.mats;
    const {
      eyeY = 0.06, eyeX = 0.30, eyeZ = 0.80, eyeR = 0.10,
      muzzle = null, noseY = -0.16, noseR = 0.075, noseColor = null,
      mouth = true, blush = false,
    } = o;

    if (muzzle) {
      const mz = mesh(head, geoSphere(), inner, [0, muzzle.y, muzzle.z], muzzle.s, null, false);
      mz.renderOrder = 1;
    }

    // nose and mouth ride on the muzzle when there is one, otherwise on the head
    const onFace = (x, y, z, k = 0.99) => {
      if (!muzzle) return this._onHead(_n2.set(x, y, z), k);
      const d = _n2.set(x, y, z).normalize();
      return {
        p: new THREE.Vector3(d.x * muzzle.s[0] * k, muzzle.y + d.y * muzzle.s[1] * k, muzzle.z + d.z * muzzle.s[2] * k),
        n: new THREE.Vector3(d.x / muzzle.s[0], d.y / muzzle.s[1], d.z / muzzle.s[2]).normalize(),
      };
    };

    // ---- eyes: a glossy bead sunk into the pile, ringed with thread ----
    // built inside an unscaled socket so the catchlight stays a round dot
    for (const sx of [-1, 1]) {
      const s = this._onHead(_n2.set(sx * eyeX, eyeY, eyeZ), 0.955);
      const socket = new THREE.Object3D();
      socket.position.copy(s.p);
      socket.quaternion.setFromUnitVectors(_AXIS_Z, s.n);
      head.add(socket);

      const eye = new THREE.Mesh(geoSphereS(), eyeM);
      eye.scale.set(eyeR, eyeR * 1.1, eyeR * 0.6);
      eye.renderOrder = 2;
      socket.add(eye);

      if (this.hero) {
      const ring = new THREE.Mesh(geoTorusS(), thread);
      ring.scale.set(eyeR * 1.14, eyeR * 1.24, eyeR * 0.16);
      ring.position.z = -eyeR * 0.14;
      ring.renderOrder = 1;
      socket.add(ring);
      }

      const hl = new THREE.Mesh(geoSphereS(), gloss);
      hl.position.set(-sx * eyeR * 0.3, eyeR * 0.42, eyeR * 0.36);
      hl.scale.setScalar(eyeR * 0.25);
      hl.renderOrder = 3;
      socket.add(hl);
    }

    // ---- nose ----
    const nmat = noseColor ? threadMaterial(noseColor, { roughness: 0.22 }) : thread;
    if (noseColor) this.materials.push(nmat);
    const nose = muzzle ? onFace(0, 0.34, 0.94, 1.0) : this._onHead(_n2.set(0, noseY, 0.95), 0.99);
    this._attach(head, geoSphereS(), nmat, nose.p, nose.n,
      [noseR * 1.3, noseR * 1.0, noseR * 0.8], { order: 2 });

    if (mouth) {
      // two little arcs -> the classic stitched "w" smile
      for (const sx of [-1, 1]) {
        const m = muzzle
          ? onFace(sx * 0.42, -0.34, 0.86, 1.0)
          : this._onHead(_n2.set(sx * noseR * 1.4, noseY - noseR * 1.8, 0.95), 0.99);
        this._attach(head, geoTorusHalf(), thread, m.p, m.n,
          [noseR * 0.9, noseR * 0.9, noseR * 0.2], { spin: Math.PI, order: 2 });
      }
      // philtrum stitch
      if (this.hero) {
      const st = muzzle
        ? onFace(0, -0.06, 0.95, 1.0)
        : this._onHead(_n2.set(0, noseY - noseR * 1.0, 0.95), 0.99);
      this._attach(head, geoCyl(), thread, st.p, st.n,
        [noseR * 0.12, noseR * 0.85, noseR * 0.12], { order: 2 });
      }
    }

    if (blush && this.hero) {
      const bm = threadMaterial(0xff9bb8, { roughness: 0.9 });
      bm.transparent = true; bm.opacity = 0.5;
      this.materials.push(bm);
      for (const sx of [-1, 1]) {
        const b = this._onHead(_n2.set(sx * 0.8, -0.18, 0.6), 0.975);
        this._attach(head, geoSphereS(), bm, b.p, b.n, [0.15, 0.1, 0.025], { order: 1 });
      }
    }
  }

  /** Small woven hangtag at a side seam — the "this is a product" detail. */
  _tag(parent, p, kind, r = 0) {
    if (!this.hero) return null;
    const tex = tagTexture(kind, '#fffdf7', kind === 'heart' ? '#ff7aa8' : '#ffb43d');
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
    this.materials.push(m);
    const t = mesh(parent, geoPlane(), m, p, [0.17, 0.13, 1], [0, r, 0.18]);
    return t;
  }

  _build(species, rng, q) {
    const B = this.body;
    const { fur, inner, thread, accent, seam: seamMat } = this.mats;
    const pal = this.pal;

    // ---- torso (shared, reshaped per species) ----
    const shape = {
      rabbit:  { s: [0.72, 0.80, 0.66], y: -0.24 },
      bear:    { s: [0.84, 0.74, 0.74], y: -0.28 },
      cat:     { s: [0.66, 0.72, 0.62], y: -0.28 },
      dog:     { s: [0.74, 0.70, 0.68], y: -0.30 },
      chick:   { s: [0.80, 0.76, 0.74], y: -0.14 },
      unicorn: { s: [0.72, 0.72, 0.70], y: -0.28 },
    }[species];

    const torso = mesh(B, geoSphere(q), fur, [0, shape.y, 0], shape.s, null, true);
    torso.receiveShadow = true;
    this._fuzz(torso, pal.fur, 0.055, true);

    // belly panel: a lighter shade of the same fabric, sewn on the front
    if (species !== 'unicorn') {
      const bellyMat = plushMaterial(new THREE.Color(pal.fur).lerp(new THREE.Color(pal.inner), 0.5).getHex(),
        { fuzz: 0.13, repeat: 9 });
      this.materials.push(bellyMat);
      const belly = mesh(B, geoSphere(), bellyMat,
        [0, shape.y - 0.08, shape.s[2] * 0.42],
        [shape.s[0] * 0.52, shape.s[1] * 0.5, shape.s[2] * 0.58]);
      belly.renderOrder = 1;
    }

    // ---- head ----
    const headCfg = {
      rabbit:  { r: 0.62, y: 0.52 },
      bear:    { r: 0.60, y: 0.52 },
      cat:     { r: 0.60, y: 0.52 },
      dog:     { r: 0.62, y: 0.50 },
      chick:   { r: 0.56, y: 0.62 },
      unicorn: { r: 0.58, y: 0.54 },
    }[species];

    const neck = pivot(B, [0, shape.y + shape.s[1] * 0.45, 0]);
    this.headPivot = neck;
    this.springs.push({
      pivot: neck, rest: new THREE.Euler(0, 0, 0),
      sx: new Spring(210, 14, 0), sz: new Spring(210, 14, 0), gain: 0.22, droop: 0.1,
    });
    const head = new THREE.Group();
    head.position.y = headCfg.y - (shape.y + shape.s[1] * 0.45);
    neck.add(head);
    this.head = head;
    const headMesh = mesh(head, geoSphere(q), fur, [0, 0, 0],
      [headCfg.r, headCfg.r * (species === 'chick' ? 0.95 : 0.92), headCfg.r * 0.94], null, true);
    this._fuzz(headMesh, pal.fur, 0.055, true);
    // head is built in a unit sphere space then scaled: work in local head units
    head.scale.setScalar(1);
    const HR = headCfg.r;
    this._headR = [HR, HR * (species === 'chick' ? 0.95 : 0.92), HR * 0.94];

    // crown seam — the give-away of a sewn toy, kept off the face
    if (this.hero) {
      const hs = mesh(head, geoSeamArc(), seamMat, [0, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0]);
      hs.scale.set(HR * 0.995, HR * 0.925, HR * 0.42);
    }

    // ---- species specific ----
    const faceOpt = { eyeR: 0.115 * HR / 0.6 };

    if (species === 'rabbit') {
      for (const sx of [-1, 1]) {
        const base = pivot(head, [sx * HR * 0.34, HR * 0.72, -HR * 0.05]);
        base.rotation.z = sx * 0.16;
        base.rotation.x = -0.12;
        const seg1 = mesh(base, geoSphere(), fur, [0, 0.32, 0], [0.135, 0.38, 0.085], null, true);
        this._fuzz(seg1, pal.fur, 0.045, true);
        mesh(base, geoSphereS(), inner, [0, 0.30, 0.045], [0.068, 0.26, 0.05]);
        const tipPv = pivot(base, [0, 0.64, 0]);
        const seg2 = mesh(tipPv, geoSphere(), fur, [0, 0.28, 0], [0.115, 0.34, 0.075], null, false);
        this._fuzz(seg2, pal.fur, 0.04, true);
        mesh(tipPv, geoSphereS(), inner, [0, 0.26, 0.04], [0.058, 0.22, 0.045]);
        this.springs.push({ pivot: base, rest: new THREE.Euler(-0.12, 0, sx * 0.16), sx: new Spring(120, 8.5, 0), sz: new Spring(120, 8.5, 0), gain: 1.15, droop: 0.9 });
        this.springs.push({ pivot: tipPv, rest: new THREE.Euler(0, 0, 0), sx: new Spring(78, 6.4, 0), sz: new Spring(78, 6.4, 0), gain: 1.5, droop: 1.25 });
        seam(this.hero ? head : null, HR * 0.16, [sx * HR * 0.34, HR * 0.70, 0], [Math.PI / 2, 0, 0], seamMat);
      }
      this._face(head, { ...faceOpt, eyeX: 0.34, eyeY: 0.10, eyeZ: 0.78, noseY: -0.16, noseR: 0.075, noseColor: pal.acc, blush: true });
      // fluffy tail
      const tail = this._limb(B, [0, shape.y + 0.28, -shape.s[2] * 0.92], [0.19, 0.19, 0.17], inner, { gain: 0.3, droop: 0.2, rest: [2.0, 0, 0] });
      this._fuzz(tail.mesh, pal.inner, 0.05);
      // neck ribbon + bow
      this._ribbon(B, shape.y + shape.s[1] * 0.62, this._girth(shape, shape.y + shape.s[1] * 0.62), accent);
      // arms / legs
      this._arms(B, shape, [0.17, 0.32, 0.17], fur, 0.5);
      this._legs(B, shape, [0.21, 0.21, 0.27], fur, 0.6);
    }

    else if (species === 'bear') {
      for (const sx of [-1, 1]) {
        const ear = mesh(head, geoSphere(), fur, [sx * HR * 0.62, HR * 0.66, -HR * 0.02], [0.19, 0.19, 0.12], null, true);
        this._fuzz(ear, pal.fur, 0.04);
        mesh(head, geoSphereS(), inner, [sx * HR * 0.62, HR * 0.66, 0.06], [0.115, 0.115, 0.08]);
        seam(this.hero ? head : null, 0.19, [sx * HR * 0.62, HR * 0.66, 0], [0, 0, 0], seamMat, 0.045);
      }
      this._face(head, {
        ...faceOpt, eyeX: 0.30, eyeY: 0.12, eyeZ: 0.80,
        muzzle: { y: -0.16, z: HR * 0.78, s: [0.30, 0.235, 0.20] },
        noseR: 0.10, noseColor: 0x3a2b26, blush: true,
      });
      this._arms(B, shape, [0.20, 0.32, 0.20], fur, 0.42);
      this._legs(B, shape, [0.245, 0.225, 0.29], fur, 0.55);
      // paw pads
      this._scarf(B, shape, accent);
      this._tag(B, [shape.s[0] * 0.86, shape.y - 0.16, 0.06], 'heart', Math.PI / 2);
    }

    else if (species === 'cat') {
      for (const sx of [-1, 1]) {
        const e = mesh(head, geoCone(), fur, [sx * HR * 0.56, HR * 0.80, 0], [0.185, 0.30, 0.115], [0, 0, sx * 0.22], true);
        this._fuzz(e, pal.fur, 0.035);
        mesh(head, geoCone(), inner, [sx * HR * 0.56, HR * 0.78, 0.045], [0.11, 0.21, 0.07], [0, 0, sx * 0.22]);
      }
      this._face(head, {
        ...faceOpt, eyeX: 0.31, eyeY: 0.08, eyeZ: 0.80,
        muzzle: { y: -0.20, z: HR * 0.80, s: [0.26, 0.18, 0.15] },
        noseR: 0.075, noseColor: pal.inner,
      });
      // whiskers
      if (this.hero) for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
        const w = mesh(head, geoCyl(), thread, [sx * 0.30, -0.18 + i * 0.055, 0.62], [0.006, 0.20, 0.006], [0, 0, sx * (Math.PI / 2 - 0.25 + i * 0.22)]);
        w.position.x = sx * 0.34;
      }
      // long curled tail: 3 spring segments
      const py = shape.y + 0.02, pz = -shape.s[2] * 0.9;
      const segs = [[0.075, 0.20, 0.075], [0.065, 0.18, 0.065], [0.058, 0.16, 0.058]];
      let pv = pivot(B, [0, py, pz]);
      pv.rotation.x = 2.5;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const m = mesh(pv, geoSphere(), i === 2 ? inner : fur, [0, s[1] * 0.85, 0], s, null, false);
        this._fuzz(m, i === 2 ? pal.inner : pal.fur, 0.035);
        this.springs.push({ pivot: pv, rest: new THREE.Euler(pv.rotation.x, 0, 0), sx: new Spring(105 - i * 22, 8 - i, 0), sz: new Spring(105 - i * 22, 8 - i, 0), gain: 0.9 + i * 0.45, droop: 0.55 + i * 0.3 });
        const next = pivot(pv, [0, s[1] * 1.7, 0]);
        next.rotation.x = -0.45;
        pv = next;
      }
      this._collar(B, shape, accent, true);
      this._arms(B, shape, [0.16, 0.30, 0.16], fur, 0.5);
      this._legs(B, shape, [0.195, 0.195, 0.25], fur, 0.6);
      // stripes
      for (let i = 0; i < 3; i++) {
        const st = mesh(B, geoSphereS(), threadMaterial(new THREE.Color(pal.fur).multiplyScalar(0.82).getHex(), { roughness: 0.85 }),
          [0, shape.y + 0.16 - i * 0.16, -shape.s[2] * 0.62], [0.075, 0.03, 0.16]);
        st.renderOrder = 1;
        this.materials.push(st.material);
      }
    }

    else if (species === 'dog') {
      for (const sx of [-1, 1]) {
        const anchor = this._onHead(_n2.set(sx * 1.0, 0.34, -0.06), 0.94);
        const base = pivot(head, [anchor.p.x, anchor.p.y, anchor.p.z]);
        base.rotation.z = sx * 0.42;
        const s1 = mesh(base, geoSphere(), inner, [0, -0.24, 0], [0.145, 0.28, 0.07], null, true);
        this._fuzz(s1, pal.inner, 0.04, true);
        const tip = pivot(base, [0, -0.48, 0]);
        const s2 = mesh(tip, geoSphere(), inner, [0, -0.20, 0], [0.125, 0.24, 0.062]);
        this._fuzz(s2, pal.inner, 0.035, true);
        this.springs.push({ pivot: base, rest: new THREE.Euler(0, 0, sx * 0.42), sx: new Spring(96, 7.5, 0), sz: new Spring(96, 7.5, 0), gain: 1.25, droop: 1.0 });
        this.springs.push({ pivot: tip, rest: new THREE.Euler(0, 0, 0), sx: new Spring(66, 6, 0), sz: new Spring(66, 6, 0), gain: 1.6, droop: 1.3 });
      }
      this._face(head, {
        ...faceOpt, eyeX: 0.29, eyeY: 0.12, eyeZ: 0.80,
        muzzle: { y: -0.18, z: HR * 0.80, s: [0.28, 0.21, 0.20] },
        noseR: 0.105, noseColor: 0x2f2530,
      });
      // eye patch, sewn flat over the left eye
      const patchMat = plushMaterial(new THREE.Color(pal.fur).multiplyScalar(0.62).getHex(), { repeat: 10 });
      this.materials.push(patchMat);
      const pp = this._onHead(_n2.set(-0.52, 0.16, 0.84), 0.95);
      this._attach(head, geoSphere(), patchMat, pp.p, pp.n, [0.19, 0.17, 0.05], { order: 1 });
      this._collar(B, shape, accent, false, true);
      this._arms(B, shape, [0.175, 0.30, 0.175], fur, 0.48);
      this._legs(B, shape, [0.22, 0.21, 0.28], fur, 0.6);
      // upright wagging tail
      const t = this._limb(B, [0, shape.y + 0.20, -shape.s[2] * 0.90], [0.075, 0.22, 0.075], fur, { gain: 1.1, droop: 0.35, rest: [2.5, 0, 0] });
      this._fuzz(t.mesh, pal.fur, 0.04);
      this._tag(B, [shape.s[0] * 0.84, shape.y - 0.18, 0.05], 'star', Math.PI / 2);
    }

    else if (species === 'chick') {
      // tuft
      for (let i = -1; i <= 1; i++) {
        const tf = mesh(head, geoSphereS(), fur, [i * 0.11, HR * 0.86 + (i === 0 ? 0.05 : 0), 0], [0.062, 0.115, 0.062], [0, 0, i * 0.35], false);
        this._fuzz(tf, pal.fur, 0.035);
      }
      this._face(head, { ...faceOpt, eyeX: 0.27, eyeY: 0.06, eyeZ: 0.82, eyeR: 0.105, noseY: -0.14, noseR: 0.10, noseColor: pal.inner, mouth: false, blush: true });
      // beak (bigger cone, replaces the nose look)
      const beak = mesh(head, geoCone(), threadMaterial(pal.inner, { roughness: 0.3 }),
        [0, -0.14, HR * 0.92], [0.115, 0.16, 0.10], [Math.PI / 2, 0, 0]);
      beak.rotation.set(Math.PI / 2, 0, 0);
      this.materials.push(beak.material);
      // stubby wings
      for (const sx of [-1, 1]) {
        const w = this._limb(B, [sx * shape.s[0] * 0.86, shape.y + 0.08, 0], [0.085, 0.20, 0.13], fur,
          { gain: 0.85, droop: 0.4, rest: [0, 0, sx * 1.05], shadow: true });
        this._fuzz(w.mesh, pal.fur, 0.04);
        seam(this.hero ? B : null, 0.11, [sx * shape.s[0] * 0.80, shape.y + 0.10, 0], [0, 0, Math.PI / 2], seamMat, 0.04);
      }
      // little feet
      for (const sx of [-1, 1]) {
        mesh(B, geoSphereS(), threadMaterial(pal.inner, { roughness: 0.4 }),
          [sx * 0.20, shape.y - shape.s[1] * 0.86, 0.16], [0.13, 0.055, 0.17]);
      }
      this._tag(B, [shape.s[0] * 0.88, shape.y - 0.10, 0.05], 'star', Math.PI / 2);
    }

    else if (species === 'unicorn') {
      // horn: stacked tori give the twist without a custom mesh
      const gold = new THREE.MeshStandardMaterial({ color: 0xffd98a, metalness: 0.9, roughness: 0.25, envMapIntensity: 1.3 });
      this.materials.push(gold);
      const hornPv = pivot(head, [0, HR * 0.92, 0.10]);
      hornPv.rotation.x = -0.22;
      mesh(hornPv, geoCone(), gold, [0, 0.18, 0], [0.085, 0.38, 0.085]);
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        const r = 0.082 * (1 - t * 0.82);
        const ring = mesh(hornPv, geoTorus(), gold, [0, 0.02 + t * 0.32, 0], [r, r, 0.42], [Math.PI / 2, 0, 0]);
        ring.rotation.set(Math.PI / 2 + 0.28, 0, 0);
        ring.scale.set(r, r, 0.36);
      }
      // ears
      for (const sx of [-1, 1]) {
        mesh(head, geoCone(), fur, [sx * HR * 0.55, HR * 0.68, -0.02], [0.115, 0.20, 0.075], [0, 0, sx * 0.30], false);
      }
      // mane: a row of pastel puffs down the back of the head/neck
      const maneCols = pal.mane || [0xffb3d1, 0xbfe4ff, 0xfff0a8];
      const maneMats = maneCols.map((c) => plushMaterial(c, { fuzz: 0.22, repeat: 10 }));
      this.materials.push(...maneMats);
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const m = mesh(head, geoSphereS(), maneMats[i % maneMats.length],
          [0, HR * 0.72 - t * 0.62, -HR * (0.55 + t * 0.42)], [0.17 - t * 0.03, 0.15, 0.14]);
        this._fuzz(m, maneCols[i % maneCols.length], 0.045);
      }
      this._face(head, { ...faceOpt, eyeX: 0.30, eyeY: 0.06, eyeZ: 0.80, noseY: -0.20, noseR: 0.07, noseColor: pal.inner, blush: true });
      this._arms(B, shape, [0.16, 0.32, 0.16], fur, 0.5);
      this._legs(B, shape, [0.185, 0.26, 0.22], fur, 0.62);
      // mane tail
      const tailPv = pivot(B, [0, shape.y + 0.10, -shape.s[2] * 0.92]);
      tailPv.rotation.x = 2.2;
      for (let i = 0; i < 3; i++) {
        const m = mesh(tailPv, geoSphereS(), maneMats[i % maneMats.length], [0, 0.10 + i * 0.16, 0.02 * i], [0.115, 0.14, 0.10]);
        this._fuzz(m, maneCols[i % maneCols.length], 0.04);
      }
      this.springs.push({ pivot: tailPv, rest: new THREE.Euler(2.2, 0, 0), sx: new Spring(95, 7.5, 0), sz: new Spring(95, 7.5, 0), gain: 1.1, droop: 0.8 });
      // star patch
      const star = mesh(B, geoSphereS(), threadMaterial(0xffe07a, { roughness: 0.3 }),
        [shape.s[0] * 0.66, shape.y - 0.02, shape.s[2] * 0.52], [0.10, 0.10, 0.06]);
      star.renderOrder = 1;
      this.materials.push(star.material);
    }

    // side seam around the widest part of the body
    const bs = mesh(B, geoTorus(), seamMat, [0, shape.y, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    bs.scale.set(shape.s[0] * 0.985, shape.s[2] * 0.985, 0.09);

    // gentle random personality: slight head tilt
    neck.rotation.z += (rng() - 0.5) * 0.12;
    this.springs[this.springs.findIndex((s) => s.pivot === neck)].rest.z = neck.rotation.z;
  }

  _arms(B, shape, s, mat, spread = 0.5) {
    for (const sx of [-1, 1]) {
      const a = this._limb(B, [sx * shape.s[0] * 0.86, shape.y + shape.s[1] * 0.34, 0.03], s, mat, {
        gain: 0.85, droop: 0.75, rest: [-0.22, 0, sx * (spread + 0.38)], shadow: true,
      });
      this._fuzz(a.mesh, this.pal.fur, 0.042);
      seam(this.hero ? B : null, s[0] * 0.72, [sx * shape.s[0] * 0.78, shape.y + shape.s[1] * 0.30, 0.02], [0, 0, Math.PI / 2], this.mats.seam, 0.04);
    }
  }

  _legs(B, shape, s, mat, spread = 0.6) {
    for (const sx of [-1, 1]) {
      const l = this._limb(B, [sx * shape.s[0] * 0.48, shape.y - shape.s[1] * 0.58, 0.10], s, mat, {
        gain: 0.6, droop: 0.55, rest: [-0.95, 0, sx * spread * 0.5], shadow: true,
      });
      this._fuzz(l.mesh, this.pal.fur, 0.042);
      // paw pad
      mesh(l.pivot, geoSphereS(), this.mats.inner, [0, -s[1] * 1.42, s[2] * 0.30], [s[0] * 0.62, s[1] * 0.38, s[2] * 0.5]);
      seam(this.hero ? B : null, s[0] * 0.7, [sx * shape.s[0] * 0.46, shape.y - shape.s[1] * 0.62, 0.06], [0, 0, 0], this.mats.seam, 0.04);
    }
  }

  /** Horizontal radius of the torso ellipsoid at height y. */
  _girth(shape, y, pad = 0.99) {
    const t = clamp((y - shape.y) / shape.s[1], -0.97, 0.97);
    return shape.s[0] * Math.sqrt(1 - t * t) * pad;
  }

  _ribbon(B, y, r, mat) {
    const ring = mesh(B, geoTorus(), mat, [0, y, 0], [r, r, 0.55], [Math.PI / 2, 0, 0]);
    ring.scale.set(r, r, 0.5);
    for (const sx of [-1, 1]) {
      mesh(B, geoSphereS(), mat, [sx * 0.20, y + 0.05, r * 0.72], [0.14, 0.11, 0.06], [0, 0, sx * 0.5]);
    }
    mesh(B, geoSphereS(), mat, [0, y + 0.04, r * 0.78], [0.055, 0.055, 0.055]);
  }

  _scarf(B, shape, mat) {
    const y = shape.y + shape.s[1] * 0.62;
    const r = this._girth(shape, y);
    const ring = mesh(B, geoTorus(), mat, [0, y, 0], [r, r, 0.45], [Math.PI / 2, 0, 0]);
    ring.scale.set(r, r, 0.45);
    this._limb(B, [r * 0.5, y - 0.02, r * 0.72], [0.075, 0.20, 0.035], mat, { gain: 1.3, droop: 1.1 });
  }

  _collar(B, shape, mat, bell = false, tag = false) {
    const y = shape.y + shape.s[1] * 0.62;
    const r = this._girth(shape, y);
    const ring = mesh(B, geoTorus(), mat, [0, y, 0], [r, r, 0.4], [Math.PI / 2, 0, 0]);
    ring.scale.set(r, r, 0.4);
    if (bell) {
      const gold = new THREE.MeshStandardMaterial({ color: 0xffcf5c, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.4 });
      this.materials.push(gold);
      mesh(B, geoSphereS(), gold, [0, y - 0.075, r * 0.92], [0.075, 0.075, 0.075]);
    }
    if (tag) {
      const gold = new THREE.MeshStandardMaterial({ color: 0xffd98a, metalness: 0.9, roughness: 0.25, envMapIntensity: 1.3 });
      this.materials.push(gold);
      mesh(B, geoCyl(), gold, [0, y - 0.09, r * 0.9], [0.062, 0.012, 0.062], [Math.PI / 2, 0, 0]);
    }
  }

  /* ---------------- runtime ---------------- */

  /** Compress the body (0 = none, 1 = fully squashed) — used when the claw closes. */
  setSquash(amount) { this.squashTarget = 1 - clamp(amount, 0, 0.55); }

  /** Kick the squash spring, e.g. on landing. */
  impact(strength = 1) {
    this.squashY.vel -= strength * 6.5;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} velocity world velocity of the body
   * @param {number} lifted 0..1 how much the toy is hanging in the air
   */
  update(dt, velocity, lifted = 0) {
    this.time += dt;
    this.lifted = lifted;

    // acceleration -> the driver of all secondary motion
    if (dt > 0) {
      this._accel.copy(velocity).sub(this._prevVel).divideScalar(Math.max(dt, 1 / 120));
      this._prevVel.copy(velocity);
    }
    // low-pass so single-frame spikes do not snap the limbs
    const a = this._tmp.copy(this._accel).clampLength(0, 45);

    // express acceleration in body space
    this._q.copy(this.root.quaternion).invert();
    a.applyQuaternion(this._q);

    // world "down" in body space -> how much limbs should straighten out
    const down = _v1.set(0, -1, 0).applyQuaternion(this._q);

    const k = 0.016;
    for (const s of this.springs) {
      const droopW = s.droop * (0.22 + 0.78 * lifted);
      const tX = clamp(a.z * k * s.gain + Math.asin(clamp(down.z, -1, 1)) * droopW, -0.85, 0.85);
      const tZ = clamp(-a.x * k * s.gain - Math.asin(clamp(down.x, -1, 1)) * droopW, -0.85, 0.85);
      s.pivot.rotation.x = s.rest.x + s.sx.update(dt, tX);
      s.pivot.rotation.z = s.rest.z + s.sz.update(dt, tZ);
    }

    // volume-preserving squash
    const sy = this.squashY.update(dt, this.squashTarget);
    const sxz = 1 / Math.sqrt(Math.max(0.35, sy));
    this.body.scale.set(this.size * sxz, this.size * sy, this.size * sxz);
  }

  /** A short, readable reaction used in the collection room. */
  playReaction(kind) {
    this.reaction = { kind, t: 0 };
  }

  updateReaction(dt) {
    if (!this.reaction) return false;
    const r = this.reaction;
    r.t += dt;
    const t = r.t;
    const dur = 1.1;
    const p = clamp(t / dur, 0, 1);
    const root = this.root;
    switch (r.kind) {
      case 'hop': {
        const h = Math.sin(p * Math.PI * 2) * (1 - p) * 0.22;
        root.position.y = this.baseY + Math.max(0, h);
        if (t < 0.1) this.impact(0.5);
        break;
      }
      case 'wave': {
        const s = this.springs.find((x) => x.gain >= 0.8) || this.springs[0];
        if (s) s.sz.vel = Math.sin(p * Math.PI * 6) * 14 * (1 - p);
        root.rotation.z = this.baseRotZ + Math.sin(p * Math.PI * 3) * 0.06 * (1 - p);
        break;
      }
      case 'tilt': {
        root.rotation.z = this.baseRotZ + Math.sin(p * Math.PI) * 0.42;
        break;
      }
      case 'spin': {
        root.rotation.y = this.baseRotY + p * Math.PI * 2;
        root.position.y = this.baseY + Math.sin(p * Math.PI) * 0.06;
        break;
      }
    }
    if (p >= 1) {
      root.position.y = this.baseY;
      root.rotation.z = this.baseRotZ;
      root.rotation.y = this.baseRotY;
      this.reaction = null;
      return false;
    }
    return true;
  }

  rememberPose() {
    this.baseY = this.root.position.y;
    this.baseRotY = this.root.rotation.y;
    this.baseRotZ = this.root.rotation.z;
  }

  setFuzzVisible(v) {
    for (const m of this.fuzzMeshes) m.visible = v;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh && o.geometry && !Object.values(G).includes(o.geometry)) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose?.();
  }
}

const _v1 = new THREE.Vector3();
const _n1 = new THREE.Vector3();
const _n2 = new THREE.Vector3();
const _n3 = new THREE.Vector3();
const _AXIS_Y = new THREE.Vector3(0, 1, 0);
const _AXIS_Z = new THREE.Vector3(0, 0, 1);

/** Convenience: build a plush from a saved record. */
export function makePlush(record, opt) {
  return new Plush(record.species, record.variant, opt);
}
