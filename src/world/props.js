// Tools and one-off props: the strickle board, the brush, the ingots, the
// molten stream, the clapper and the bell's headstock.

import * as THREE from '../core/three.js';
import { METALS } from './materials.js';
import { TAU, lerp, clamp01 } from '../core/util.js';

/**
 * The strickle (sweep) board.  Its inner edge IS the bell profile, so when it
 * turns around the axis the clay cannot end up any shape but a bell -- the
 * child does not have to be accurate, the tool is.
 */
export function makeSweepBoard(profileFn, height, { color = 0x6b4a30, samples = 40 } = {}) {
  let rMax = 0;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, r = profileFn(t);
    rMax = Math.max(rMax, r);
    pts.push([r, t * height]);
  }
  const outer = rMax + 0.30;
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], -0.10);
  for (const [r, y] of pts) s.lineTo(r, y);
  s.lineTo(pts[pts.length - 1][0], height + 0.12);
  s.lineTo(outer, height + 0.12);
  s.lineTo(outer, -0.10);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, curveSegments: 2 });
  geo.translate(0, 0, -0.025);
  const board = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color, roughness: 0.85, metalness: 0.04,
  }));
  board.castShadow = true;

  const grp = new THREE.Group();
  grp.add(board);

  // the steel edge that actually does the cutting
  const edgePts = [];
  for (const [r, y] of pts) edgePts.push(new THREE.Vector3(r, y, 0));
  const edgeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePts), samples, 0.018, 5, false);
  grp.add(new THREE.Mesh(edgeGeo, new THREE.MeshStandardMaterial({
    color: 0x8d9096, roughness: 0.35, metalness: 0.95,
  })));

  // a handle so it reads as a tool a person holds
  const hMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.9 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 10), hMat);
  grip.position.set(outer - 0.13, height * 0.62, 0.1);
  grip.rotation.z = Math.PI / 2;
  grp.add(grip);

  grp.userData.rMax = outer;
  return grp;
}

/** wide daubing brush for the outer mould */
export function makeBrush() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6d4a2c, roughness: 0.88 });
  const bristle = new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 1.0 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.62, 10), wood);
  handle.position.y = 0.42; g.add(handle);
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.1, 10),
    new THREE.MeshStandardMaterial({ color: 0x7a7d82, roughness: 0.4, metalness: 0.9 }));
  ferrule.position.y = 0.1; g.add(ferrule);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.08), bristle);
  head.position.y = -0.02; g.add(head);
  g.castShadow = true;
  return g;
}

/** a bronze ingot the founder can feed to the furnace */
export function makeIngot(metalKey) {
  const M = METALS[metalKey];
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: M.color, roughness: M.rough + 0.28, metalness: 1.0, envMapIntensity: 1.0,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.16, 4), mat);
  body.rotation.y = Math.PI / 4;
  body.scale.set(1.85, 1, 1);
  body.castShadow = true;
  g.add(body);
  g.userData.mat = mat;
  g.userData.metal = metalKey;
  return g;
}

/**
 * The molten stream.  Fixed topology, positions rewritten every frame, so the
 * pour can thicken, thin and break without allocating anything.
 */
export class Stream {
  constructor(material, { sections = 24, radial = 8 } = {}) {
    this.sections = sections; this.radial = radial;
    const n = (sections + 1) * (radial + 1);
    this.pos = new Float32Array(n * 3);
    this.nor = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const idx = [];
    for (let i = 0; i <= sections; i++) {
      for (let j = 0; j <= radial; j++) {
        const k = (i * (radial + 1) + j) * 2;
        uv[k] = j / radial; uv[k + 1] = i / sections;
      }
    }
    for (let i = 0; i < sections; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + 1, c = a + radial + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 8);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3();
    this._t = new THREE.Vector3(); this._u = new THREE.Vector3(); this._v = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  /**
   * @param {THREE.Vector3} from lip of the ladle
   * @param {THREE.Vector3} to   mouth of the sprue
   * @param {number} r0 radius at the lip
   * @param {number} r1 radius at the sprue
   * @param {number} wobble surface unsteadiness
   * @param {number} time
   */
  update(from, to, r0, r1, wobble, time) {
    const { sections, radial, pos, nor } = this;
    // metal leaves the lip sideways and then falls -- a real ballistic arc
    const mid = this._a.copy(from).lerp(to, 0.5);
    mid.y = from.y - (from.y - to.y) * 0.18;
    for (let i = 0; i <= sections; i++) {
      const s = i / sections;
      // quadratic bezier
      const iv = 1 - s;
      this._p.set(
        iv * iv * from.x + 2 * iv * s * mid.x + s * s * to.x,
        iv * iv * from.y + 2 * iv * s * mid.y + s * s * to.y,
        iv * iv * from.z + 2 * iv * s * mid.z + s * s * to.z
      );
      // tangent
      this._t.set(
        2 * (iv * (mid.x - from.x) + s * (to.x - mid.x)),
        2 * (iv * (mid.y - from.y) + s * (to.y - mid.y)),
        2 * (iv * (mid.z - from.z) + s * (to.z - mid.z))
      ).normalize();
      this._u.set(0, 1, 0);
      if (Math.abs(this._t.y) > 0.96) this._u.set(1, 0, 0);
      this._v.crossVectors(this._t, this._u).normalize();
      this._u.crossVectors(this._v, this._t).normalize();

      const wob = 1 + Math.sin(time * 9 + s * 11) * wobble * 0.16 + Math.sin(time * 15 - s * 7) * wobble * 0.09;
      const r = lerp(r0, r1, s * s) * wob;
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU;
        const cx = Math.cos(a), cy = Math.sin(a);
        const nx = this._u.x * cx + this._v.x * cy;
        const ny = this._u.y * cx + this._v.y * cy;
        const nz = this._u.z * cx + this._v.z * cy;
        const k = (i * (radial + 1) + j) * 3;
        pos[k] = this._p.x + nx * r; pos[k + 1] = this._p.y + ny * r; pos[k + 2] = this._p.z + nz * r;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }
}

/**
 * The clapper (舌).  Its origin is the eye it hangs by; `arm` is the distance
 * down to the centre of the ball.  That distance is not decoration -- it is
 * what decides whether the ball can actually reach the sound bow when the bell
 * swings, so the ring stage computes it from the bell it belongs to.
 */
export function makeClapper(metalKey, { arm = 1.3, ball = 0.16 } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a463f, roughness: 0.42, metalness: 0.95, envMapIntensity: 1.4,
  });
  const b = new THREE.Mesh(new THREE.SphereGeometry(ball, 18, 14), mat);
  b.position.y = -arm; b.castShadow = true; g.add(b);
  const flight = new THREE.Mesh(new THREE.CylinderGeometry(ball * 0.22, ball * 0.38, ball * 2.1, 10), mat);
  flight.position.y = -arm - ball * 1.5; g.add(flight);
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(ball * 0.22, ball * 0.28, arm, 10), mat);
  shank.position.y = -arm * 0.5; shank.castShadow = true; g.add(shank);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(ball * 0.48, ball * 0.16, 8, 16), mat);
  eye.position.y = ball * 0.2; g.add(eye);
  g.userData.mat = mat;
  g.userData.arm = arm;
  g.userData.ball = ball;
  return g;
}

/** yoke, wheel and rope: how a bell is actually made to swing */
export function makeHeadstock(bellTopY, radius) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x53381f, roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.55, metalness: 0.85 });

  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.26, 0.34), wood);
  beam.position.y = bellTopY + 0.34; beam.castShadow = true; g.add(beam);
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.4), iron);
    strap.position.set(s * 0.34, bellTopY + 0.2, 0); g.add(strap);
    const gudgeon = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10), iron);
    gudgeon.position.set(s * 0.86, bellTopY + 0.34, 0);
    gudgeon.rotation.z = Math.PI / 2; g.add(gudgeon);
  }
  const R = Math.max(0.42, radius * 0.52);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(R, 0.042, 8, 28), wood);
  wheel.position.set(0.0, bellTopY + 0.34, 0.42);
  g.add(wheel);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, R * 2, 6), wood);
    spoke.position.set(0, bellTopY + 0.34, 0.42);
    spoke.rotation.z = a;
    g.add(spoke);
  }
  g.userData.wheelR = R;
  g.userData.wheelY = bellTopY + 0.34;
  return g;
}

/** a straight rope drawn between two points, rebuilt by moving one mesh */
export class Rope {
  constructor(parent, radius = 0.028, color = 0xb0925f) {
    const geo = new THREE.CylinderGeometry(radius, radius, 1, 7, 1, true);
    geo.translate(0, 0.5, 0);          // origin at the top end
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color, roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
    }));
    parent.add(this.mesh);
    this._d = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
  }
  set(from, to) {
    this._d.subVectors(to, from);
    const len = this._d.length() || 0.001;
    this.mesh.position.copy(from);
    this._q.setFromUnitVectors(this._up, this._d.divideScalar(len));
    this.mesh.quaternion.copy(this._q);
    this.mesh.scale.set(1, len, 1);
  }
}
