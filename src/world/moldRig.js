// The stack of skins on the casting axis, and the bell that finally comes out
// of it.
//
//   core (芯型)        -- the bell's inside, swept smooth by the strickle board
//   false bell (仮鐘)  -- the bell's own volume, in clay, carrying the relief
//   outer mould (外型) -- daubed over the false bell, then baked and broken
//   bell               -- bronze, occupying exactly where the false bell was
//
// Keeping all four as offsets of one silhouette is what lets a child see that
// the lump they smoothed and the bell that appears are the same object.

import * as THREE from '../core/three.js';
import { LatheGrid } from './latheGrid.js';
import {
  outerR, innerR, coreR, blobR, falseBlobR, moldR, moldInnerR, moldSurfaceR,
  moldHeight, SPRUE_R,
} from './profiles.js';
import {
  clayCoreMaterial, clayFalseMaterial, moldMaterial, bronzeMaterial, METALS, TEX, ENV,
} from './materials.js';
import { makeDecorMesh, orientDecor, decorTone } from './decorations.js';
import { clamp01, lerp, smoothstep, TAU, angNoise, hash2, makeRng } from '../core/util.js';

const CORE_ROWS = 46, CORE_COLS = 60;
const FALSE_ROWS = 50, FALSE_COLS = 68;
const MOLD_ROWS = 40, MOLD_COLS = 56;

export class MoldRig {
  constructor(scene, shapeKey, shapes) {
    this.scene = scene;
    this.shape = shapes[shapeKey];
    this.group = new THREE.Group();
    this.group.position.y = 0.22;         // stand on the plinth
    scene.add(this.group);

    this.decorations = [];                 // {key, theta, t, size, spin}
    this.metal = 'gold';

    this._buildSpindle();
    this._buildCore();
    this._buildFalse();
  }

  /* ---------------- stage 1a: the core ---------------- */

  _buildSpindle() {
    const S = this.shape;
    const m = new THREE.MeshStandardMaterial({ color: 0x2e2823, roughness: 0.7, metalness: 0.6 });
    const spin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, S.height + 0.7, 12), m);
    spin.position.y = (S.height + 0.7) / 2 - 0.1;
    spin.castShadow = true;
    this.group.add(spin);
    this.spindle = spin;

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.12, 0.12, 32),
      new THREE.MeshStandardMaterial({ color: 0x3a3229, roughness: 0.85, metalness: 0.3 }));
    plate.position.y = -0.06;
    plate.receiveShadow = true;
    this.group.add(plate);
    this.basePlate = plate;
  }

  _buildCore() {
    const S = this.shape;
    this.coreGrid = new LatheGrid({
      rows: CORE_ROWS, cols: CORE_COLS, y0: 0, y1: S.height, capBottom: true, capTop: true,
      aspect: (TAU * S.rim * 0.62) / S.height,
    });
    this.coreProgress = new Float32Array(CORE_COLS).fill(0);
    this.coreSeed = Math.random() * 10;
    this.coreMesh = new THREE.Mesh(this.coreGrid.geometry, clayCoreMaterial());
    this.coreMesh.castShadow = true; this.coreMesh.receiveShadow = true;
    this.group.add(this.coreMesh);
    this.refreshCore();
  }

  refreshCore() {
    const S = this.shape, seed = this.coreSeed, prog = this.coreProgress;
    this.coreGrid.update((t, c, theta) => {
      const k = prog[c];
      const raw = blobR(S, t, theta, seed);
      const target = coreR(S, t);
      // the last of the roughness only leaves at the very end of a pass
      const grain = 0.016 * angNoise(theta * 3 + t * 4, seed + 2, 1) * (1 - k) * (1 - k);
      return lerp(raw, target, smoothstep(0, 1, k)) + grain;
    });
  }

  get coreDone() {
    let s = 0; for (let i = 0; i < this.coreProgress.length; i++) s += this.coreProgress[i];
    return s / this.coreProgress.length;
  }

  /* ---------------- stage 1b: the false bell ---------------- */

  _buildFalse() {
    const S = this.shape;
    this.falseGrid = new LatheGrid({
      rows: FALSE_ROWS, cols: FALSE_COLS, y0: 0, y1: S.height, capBottom: false, capTop: true,
      aspect: (TAU * S.rim * 0.72) / S.height,
    });
    this.falseProgress = new Float32Array(FALSE_COLS).fill(0);
    this.falseSeed = Math.random() * 10 + 5;
    this.falseMesh = new THREE.Mesh(this.falseGrid.geometry, clayFalseMaterial());
    this.falseMesh.castShadow = true; this.falseMesh.receiveShadow = true;
    this.falseMesh.visible = false;
    this.group.add(this.falseMesh);

    this.decorGroup = new THREE.Group();
    this.decorGroup.visible = false;
    this.group.add(this.decorGroup);
    this.decorMat = new THREE.MeshStandardMaterial({
      map: TEX.clayFalse, normalMap: TEX.clayFalseN,
      normalScale: new THREE.Vector2(0.5, 0.5),
      color: 0xf2ded2, roughness: 0.93, metalness: 0, envMapIntensity: 0.3,
    });
    this.refreshFalse();
  }

  refreshFalse() {
    const S = this.shape, seed = this.falseSeed, prog = this.falseProgress;
    this.falseGrid.update((t, c, theta) => {
      const k = prog[c];
      const raw = falseBlobR(S, t, theta, seed);
      const target = outerR(S, t);
      const grain = 0.013 * angNoise(theta * 3.4 - t * 3.6, seed + 4, 1) * (1 - k) * (1 - k);
      return Math.max(coreR(S, t) + 0.012, lerp(raw, target, smoothstep(0, 1, k)) + grain);
    });
  }

  get falseDone() {
    let s = 0; for (let i = 0; i < this.falseProgress.length; i++) s += this.falseProgress[i];
    return s / this.falseProgress.length;
  }

  showFalse() { this.falseMesh.visible = true; }

  /* ---------------- stage 2: decoration ---------------- */

  /** surface slope dr/dy of the bell at normalised height t */
  slopeAt(t) {
    const S = this.shape, e = 0.01;
    const t0 = Math.max(0, t - e), t1 = Math.min(1, t + e);
    return (outerR(S, t1) - outerR(S, t0)) / ((t1 - t0) * S.height);
  }

  addDecoration(key, theta, t, size = 0.20) {
    const S = this.shape;
    // radius of the surface, expressed in the ornament's own local units
    const mesh = makeDecorMesh(key, this.decorMat, outerR(S, t) / size);
    orientDecor(mesh, theta, t * S.height, outerR(S, t), this.slopeAt(t), size);
    this.decorGroup.add(mesh);
    const rec = { key, theta, t, size, mesh };
    this.decorations.push(rec);
    return rec;
  }

  /** aggregate 0..1 -- how heavily decorated, used to colour the bell's voice */
  get decorLoad() {
    if (!this.decorations.length) return 0;
    let tone = 0;
    for (const d of this.decorations) tone += decorTone(d.key);
    return clamp01((this.decorations.length / 7) * 0.6 + (tone / this.decorations.length) * 0.4);
  }

  /* ---------------- stage 3: the outer mould ---------------- */

  buildMold() {
    const S = this.shape;
    const H = moldHeight(S);
    this.moldGrid = new LatheGrid({
      rows: MOLD_ROWS, cols: MOLD_COLS, y0: 0, y1: H, capBottom: false, capTop: false,
      aspect: (TAU * S.rim * 0.85) / H,
    });
    this.moldCover = new Float32Array((MOLD_ROWS + 1) * MOLD_COLS).fill(0);
    this.moldMat = moldMaterial();
    this.moldMesh = new THREE.Mesh(this.moldGrid.geometry, this.moldMat);
    this.moldMesh.castShadow = true; this.moldMesh.receiveShadow = true;
    this.group.add(this.moldMesh);
    this.refreshMold();

    // an invisible proxy at the finished mould surface, for painting raycasts
    const proxyGrid = new LatheGrid({ rows: 28, cols: 40, y0: 0, y1: H, capBottom: false, capTop: false });
    proxyGrid.update((t, c, theta) => moldSurfaceR(S, t, theta) + 0.02);
    this.paintProxy = new THREE.Mesh(proxyGrid.geometry,
      new THREE.MeshBasicMaterial({ visible: false }));
    this.group.add(this.paintProxy);
    this.paintProxyGrid = proxyGrid;

    // the pouring cup on top
    const cupMat = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.95 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(SPRUE_R * 1.85, SPRUE_R * 1.02, 0.34, 20, 1, true), cupMat);
    cup.position.y = H + 0.14;
    cup.material.side = THREE.DoubleSide;
    cup.visible = false;
    this.group.add(cup);
    this.sprueCup = cup;

    // the metal that visibly stands in the cup once the mould is full
    this.sprueMeltMat = new THREE.MeshBasicMaterial({ color: 0xffa54a, fog: false });
    const sm = new THREE.Mesh(new THREE.CircleGeometry(SPRUE_R * 1.5, 20), this.sprueMeltMat);
    sm.rotation.x = -Math.PI / 2;
    sm.position.y = H + 0.02;
    sm.visible = false;
    this.group.add(sm);
    this.sprueMelt = sm;

    // banding hoops that hold the flask together
    this.hoops = [];
    for (const u of [0.16, 0.44, 0.72]) {
      const r = moldR(S, u) + 0.03;
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 34),
        new THREE.MeshStandardMaterial({ color: 0x35302a, roughness: 0.6, metalness: 0.8 }));
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = u * H;
      hoop.visible = false;
      hoop.userData.landed = false;
      this.group.add(hoop);
      this.hoops.push(hoop);
    }
  }

  /** mould radius grows outward from the false bell as mud is laid on */
  refreshMold() {
    const S = this.shape, H = moldHeight(S), cover = this.moldCover;
    const cols = MOLD_COLS;
    this.moldGrid.update((u, c, theta) => {
      const k = cover[Math.round(u * MOLD_ROWS) * cols + c];
      const inner = moldInnerR(S, u) + 0.012;
      const outerFull = moldSurfaceR(S, u, theta);
      return lerp(inner, outerFull, smoothstep(0, 1, k));
    });
    this.moldGrid.setCover((u, c) => cover[Math.round(u * MOLD_ROWS) * cols + c]);
  }

  /**
   * Daub mud along the segment between two surface points, so a fast swipe
   * lays a continuous band instead of dotted stamps.
   */
  paintMoldPath(fromTheta, fromU, toTheta, toU, radius, amount) {
    const dth = Math.abs(((toTheta - fromTheta + Math.PI * 3) % TAU) - Math.PI);
    const H = moldHeight(this.shape);
    const dist = Math.hypot(dth * Math.max(0.3, moldR(this.shape, toU)), (toU - fromU) * H);
    const steps = Math.min(8, Math.max(1, Math.ceil(dist / (radius * 0.55))));
    let added = 0;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      // interpolate the angle the short way round
      let d = toTheta - fromTheta;
      if (d > Math.PI) d -= TAU;
      if (d < -Math.PI) d += TAU;
      added += this.paintMold(fromTheta + d * k, lerp(fromU, toU, k), radius, amount / steps);
    }
    return added;
  }

  /** paint mud around a point on the mould, returns how much was actually added */
  paintMold(theta, u, radius = 0.28, amount = 1) {
    const rows = MOLD_ROWS, cols = MOLD_COLS, cover = this.moldCover;
    const H = moldHeight(this.shape);
    const rowR = Math.ceil((radius / H) * rows) + 1;
    const r0 = Math.round(u * rows);
    let added = 0;
    for (let dr = -rowR; dr <= rowR; dr++) {
      const r = r0 + dr;
      if (r < 0 || r > rows) continue;
      const y = (r / rows) * H;
      const dy = y - u * H;
      const ringR = Math.max(0.12, moldR(this.shape, r / rows));
      const colR = Math.ceil((radius / ringR) * (cols / TAU)) + 1;
      const c0 = Math.round((theta / TAU) * cols);
      for (let dc = -colR; dc <= colR; dc++) {
        const c = ((c0 + dc) % cols + cols) % cols;
        const dth = (dc / cols) * TAU;
        const arc = dth * ringR;
        const d = Math.hypot(dy, arc);
        if (d > radius) continue;
        const w = (1 - d / radius) * amount;
        const i = r * cols + c;
        const before = cover[i];
        cover[i] = clamp01(before + w);
        added += cover[i] - before;
      }
    }
    return added;
  }

  get moldDone() {
    const cover = this.moldCover;
    let s = 0;
    for (let i = 0; i < cover.length; i++) s += cover[i];
    return s / cover.length;
  }

  /** finish the shell instantly (used when the player has covered nearly all of it) */
  fillMold(rate = 1) {
    const cover = this.moldCover;
    let changed = false;
    for (let i = 0; i < cover.length; i++) {
      if (cover[i] < 1) { cover[i] = clamp01(cover[i] + rate); changed = true; }
    }
    return changed;
  }

  hideInnards() {
    this.coreMesh.visible = false;
    this.falseMesh.visible = false;
    this.decorGroup.visible = false;
    this.spindle.visible = false;
  }

  /** the mould dries: mud lightens, hoops and cup go on */
  setMoldDry(k) {
    if (this.moldMat?.userData.uniforms) this.moldMat.userData.uniforms.uWet.value = 1 - clamp01(k);
  }

  setMoldFill(fill, glow) {
    const u = this.moldMat?.userData.uniforms;
    if (!u) return;
    u.uFill.value = fill;
    u.uGlow.value = glow;
  }

  /* ---------------- stage 7: breaking the mould ---------------- */

  /**
   * Swap the single mould shell for a wall of independent chunks so the shell
   * can come apart in the player's hands.
   */
  buildChunks(pieces = 26) {
    const S = this.shape, H = moldHeight(S);
    this.moldMesh.visible = false;
    this.paintProxy.visible = false;
    this.chunks = [];
    const grp = new THREE.Group();
    this.group.add(grp);
    this.chunkGroup = grp;
    // Broken earth, not eggshell: knock the value down and keep it warm, so
    // the pale bronze underneath is what the eye goes to.
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.moldEarth, normalMap: TEX.moldEarthN,
      normalScale: new THREE.Vector2(1.2, 1.2),
      color: 0xa08a70, roughness: 1.0, metalness: 0,
      envMapIntensity: 0.3, side: THREE.DoubleSide,
    });
    // A fresh fracture face is paler, drier and coarser than the smoked
    // outside of a flask that has just been through a bake.
    const inner = mat.clone();
    inner.color = new THREE.Color(0xd8c6a8);
    inner.envMapIntensity = 0.12;
    this.chunkMat = mat;
    this.chunkInnerMat = inner;

    const shards = buildShards(S, H, pieces);
    for (const sh of shards) {
      const m = new THREE.Mesh(sh.geo, [mat, inner]);
      m.castShadow = true; m.receiveShadow = true;
      m.position.copy(sh.center);
      grp.add(m);
      this.chunks.push({
        mesh: m, u: sh.u, theta: sh.theta,
        home: sh.center.clone(), state: 0,
        // half-height of the piece: what it has to rest ON, not float above
        half: sh.half, radius: sh.radius, thick: sh.thick,
        vel: new THREE.Vector3(), spin: new THREE.Vector3(),
      });
    }
    return this.chunks;
  }

  /* ---------------- the bell ---------------- */

  buildBell(metalKey) {
    const S = this.shape;
    this.metal = metalKey;
    const grp = new THREE.Group();
    this.bellGroup = grp;
    this.group.add(grp);

    const mat = bronzeMaterial(metalKey);
    this.bellMat = mat;

    // body
    const rows = 64, cols = 72;
    const aspect = (TAU * S.rim * 0.72) / S.height;
    const g = new LatheGrid({ rows, cols, y0: 0, y1: S.height, capBottom: false, capTop: false, aspect });
    g.update((t) => outerR(S, t));
    const body = new THREE.Mesh(g.geometry, mat);
    body.castShadow = true; body.receiveShadow = true;
    grp.add(body);
    this.bellBody = body;
    this.bellGrid = g;

    // inner wall, so looking up into the mouth reads as a hollow casting
    const gi = new LatheGrid({ rows, cols, y0: 0, y1: S.height, capBottom: false, capTop: true, aspect });
    gi.update((t) => innerR(S, t));
    const innerMat = mat.clone();
    innerMat.side = THREE.BackSide;
    innerMat.roughness = Math.min(1, mat.roughness + 0.22);
    const inner = new THREE.Mesh(gi.geometry, innerMat);
    grp.add(inner);
    this.bellInner = inner;
    this.bellInnerMat = innerMat;

    // rim ring closes the wall thickness at the mouth
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(innerR(S, 0), outerR(S, 0), 72), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.001;
    grp.add(rim);

    // crown / canons so it can be hung
    const crown = new THREE.Group();
    crown.position.y = S.height;
    grp.add(crown);
    this.bellCrown = crown;
    if (S.crown === 'dragon') {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.075, 10, 22), mat);
      loop.position.y = 0.17; loop.rotation.y = Math.PI / 2;
      crown.add(loop);
      for (const s of [-1, 1]) {
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat);
        head.position.set(0, 0.06, s * 0.19); head.scale.set(1.5, 0.9, 1);
        crown.add(head);
      }
    } else if (S.crown === 'ring') {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.055, 10, 22), mat);
      loop.position.y = 0.16; crown.add(loop);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4;
        const c = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.042, 8, 18, Math.PI), mat);
        c.position.set(Math.cos(a) * 0.16, 0.06, Math.sin(a) * 0.16);
        c.rotation.set(0, -a, 0);
        crown.add(c);
      }
    } else {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 10, 22), mat);
      loop.position.y = 0.16; crown.add(loop);
    }

    // the relief, in metal now, exactly where the child put it in clay
    this.bellDecorGroup = new THREE.Group();
    grp.add(this.bellDecorGroup);
    for (const d of this.decorations) {
      const m = makeDecorMesh(d.key, mat, outerR(S, d.t) / d.size);
      orientDecor(m, d.theta, d.t * S.height, outerR(S, d.t), this.slopeAt(d.t), d.size);
      this.bellDecorGroup.add(m);
    }

    // it comes out of the ground filthy and dulled; the light polishes it later
    this.setBellClean(0);
    return grp;
  }

  /** 0 = filthy from the mould, 1 = wiped clean and reflective */
  /**
   * 0 = straight out of the ground, 1 = wiped clean and reflective.
   *
   * The dirty state cannot just be dark metal.  A metal has no diffuse
   * response at all, so turning the reflection down to hide the shine makes
   * the casting render as a black hole -- which is exactly what the player saw
   * through the first gap in the mould.  A bell caked in dry mould dust is
   * optically not metal but dust: a dielectric with a pale albedo.  So the
   * clean-up drives METALNESS as well, and the bell literally becomes metal as
   * the earth comes off it.
   */
  setBellClean(k) {
    const M = METALS[this.metal];
    const dirty = 1 - clamp01(k);
    const dust = new THREE.Color(0x9a8a72);
    if (this.bellMat) {
      this.bellMat.metalness = lerp(1.0, 0.12, dirty);
      this.bellMat.roughness = lerp(M.rough, 0.95, dirty);
      this.bellMat.envMapIntensity = lerp(0.42, 0.10, dirty);
      this.bellMat.color.setHex(M.color).lerp(dust, dirty * 0.92);
    }
    if (this.bellInnerMat) {
      this.bellInnerMat.metalness = lerp(1.0, 0.12, dirty);
      this.bellInnerMat.roughness = lerp(M.rough + 0.22, 0.97, dirty);
      this.bellInnerMat.envMapIntensity = lerp(0.22, 0.06, dirty);
      this.bellInnerMat.color.copy(this.bellMat.color).multiplyScalar(0.8);
    }
  }

  /** while the casting is still hot the bronze glows from within */
  setBellHeat(h) {
    if (!this.bellMat) return;
    const M = METALS[this.metal];
    const c = new THREE.Color(M.molten).multiplyScalar(clamp01(h) ** 1.6);
    this.bellMat.emissive.copy(c);
    this.bellMat.emissiveIntensity = 1.6;
    if (this.bellInnerMat) {
      this.bellInnerMat.emissive.copy(c).multiplyScalar(0.7);
      this.bellInnerMat.emissiveIntensity = 1.6;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) m.dispose();
      }
    });
  }
}

/* ------------------------------------------------------------------ *
 *  fracture                                                           *
 * ------------------------------------------------------------------ */

/**
 * Break the flask into irregular shards.
 *
 * A grid of rectangles is the single loudest "this is a mesh" signal a
 * shattering object can give, because fired earth never cracks on a lattice.
 * So the shell is diced into a fine grid of cells, each cell is assigned to
 * the nearest of N weighted seeds, and one shard is welded from each region.
 * Shared grid nodes are displaced by a hash of their index, so neighbouring
 * shards jitter by exactly the same amount and still interlock along a ragged
 * seam.  Seeds are biased low, because the wall is thickest at the base and
 * real flasks come off in bigger slabs down there.
 */
function buildShards(S, H, pieces) {
  const GT = 60, GU = 26;                      // dicing grid: theta x height
  const jit = (i, j) => {
    const a = hash2(i * 1.7 + 3.1, j * 2.3 + 7.9);
    const b = hash2(i * 5.3 + 11.7, j * 0.9 + 2.1);
    return [(a - 0.5) * 0.85, (b - 0.5) * 0.85];   // in cell fractions
  };
  // node position in (theta, u), with wrap-safe jitter
  const nodeT = (i, j) => {
    const ii = ((i % GT) + GT) % GT;
    const [dt] = jit(ii, j);
    return ((i + dt) / GT) * TAU;
  };
  const nodeU = (i, j) => {
    const ii = ((i % GT) + GT) % GT;
    const [, du] = jit(ii, j);
    if (j === 0) return 0;
    if (j === GU) return 1;
    return clamp01((j + du) / GU);
  };

  // ---- seeds ----
  const rng = makeRng(1337);
  const seeds = [];
  for (let k = 0; k < pieces; k++) {
    // stratified so no part of the shell is left as one huge slab
    const u = clamp01(Math.pow((k + rng()) / pieces, 0.78));
    seeds.push({
      th: rng() * TAU,
      u,
      // bigger pieces low down, where the mould is thickest
      w: lerp(1.45, 0.75, u) * (0.8 + rng() * 0.45),
    });
  }

  // ---- assign every cell to a seed ----
  const owner = new Int16Array(GT * GU);
  for (let j = 0; j < GU; j++) {
    const uc = (j + 0.5) / GU;
    const ring = Math.max(0.25, moldR(S, uc));
    for (let i = 0; i < GT; i++) {
      const tc = ((i + 0.5) / GT) * TAU;
      let best = 0, bestD = Infinity;
      for (let k = 0; k < seeds.length; k++) {
        const sd = seeds[k];
        let dth = tc - sd.th;
        dth = Math.atan2(Math.sin(dth), Math.cos(dth));
        // measure in metres so shards are isotropic on the real surface
        const d = Math.hypot(dth * ring, (uc - sd.u) * H) / sd.w;
        if (d < bestD) { bestD = d; best = k; }
      }
      owner[j * GT + i] = best;
    }
  }

  // ---- weld one mesh per region ----
  const out = [];
  const outerAt = (th, u, v) => {
    const r = moldSurfaceR(S, clamp01(u), th);
    v.set(Math.cos(th) * r, clamp01(u) * H, Math.sin(th) * r);
    return v;
  };
  const innerAt = (th, u, v) => {
    const r = moldInnerR(S, clamp01(u)) + 0.012;
    v.set(Math.cos(th) * r, clamp01(u) * H, Math.sin(th) * r);
    return v;
  };
  const tmp = new THREE.Vector3();

  for (let k = 0; k < seeds.length; k++) {
    const pos = [], uv = [], idxOuter = [], idxInner = [];
    const push = (th, u, outer) => {
      const p = outer ? outerAt(th, u, tmp) : innerAt(th, u, tmp);
      pos.push(p.x, p.y, p.z);
      uv.push((th / TAU) * 3, u * 2.6);
      return pos.length / 3 - 1;
    };
    let cells = 0;
    let sumT = 0, sumTs = 0, sumTc = 0, sumU = 0;

    for (let j = 0; j < GU; j++) {
      for (let i = 0; i < GT; i++) {
        if (owner[j * GT + i] !== k) continue;
        cells++;
        const tc = ((i + 0.5) / GT) * TAU, uc = (j + 0.5) / GU;
        sumTs += Math.sin(tc); sumTc += Math.cos(tc); sumU += uc; sumT++;

        const t00 = nodeT(i, j), u00 = nodeU(i, j);
        const t10 = nodeT(i + 1, j), u10 = nodeU(i + 1, j);
        const t01 = nodeT(i, j + 1), u01 = nodeU(i, j + 1);
        const t11 = nodeT(i + 1, j + 1), u11 = nodeU(i + 1, j + 1);
        // keep the seam continuous when a cell straddles theta = 0
        const un = (a, b) => (b - a > Math.PI ? b - TAU : b - a < -Math.PI ? b + TAU : b);
        const T10 = un(t00, t10), T01 = un(t00, t01), T11 = un(t00, t11);

        // outer face
        const a = push(t00, u00, true), b = push(T10, u10, true);
        const c = push(T01, u01, true), d = push(T11, u11, true);
        idxOuter.push(a, c, b, b, c, d);
        // inner face (wound the other way)
        const e = push(t00, u00, false), f = push(T10, u10, false);
        const g = push(T01, u01, false), h = push(T11, u11, false);
        idxInner.push(e, f, g, f, h, g);

        // torn side walls, only where this shard actually ends
        const wall = (tA, uA, tB, uB) => {
          const o1 = push(tA, uA, true), i1 = push(tA, uA, false);
          const o2 = push(tB, uB, true), i2 = push(tB, uB, false);
          idxInner.push(o1, i1, o2, i1, i2, o2);
        };
        const nb = (di, dj) => {
          const jj = j + dj;
          if (jj < 0 || jj >= GU) return -1;
          const ii = ((i + di) % GT + GT) % GT;
          return owner[jj * GT + ii];
        };
        if (nb(0, -1) !== k) wall(t00, u00, T10, u10);   // bottom
        if (nb(0, 1) !== k) wall(T11, u11, T01, u01);    // top
        if (nb(-1, 0) !== k) wall(T01, u01, t00, u00);   // left
        if (nb(1, 0) !== k) wall(T10, u10, T11, u11);    // right
      }
    }
    if (!cells) continue;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex([...idxOuter, ...idxInner]);
    // group 0 = weathered outside, group 1 = fresh fracture + cavity face
    geo.addGroup(0, idxOuter.length, 0);
    geo.addGroup(idxOuter.length, idxInner.length, 1);
    geo.computeVertexNormals();

    geo.computeBoundingBox();
    const center = new THREE.Vector3();
    geo.boundingBox.getCenter(center);
    const size = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    geo.translate(-center.x, -center.y, -center.z);
    geo.computeBoundingSphere();

    const uc = sumU / sumT;
    out.push({
      geo, center,
      theta: Math.atan2(sumTs / sumT, sumTc / sumT),
      u: uc,
      half: size.y * 0.5,
      // the wall it was cut from: what it rests on once it has toppled flat
      thick: Math.max(0.08, moldR(S, uc) - moldInnerR(S, uc)),
      radius: geo.boundingSphere.radius,
    });
  }
  return out;
}
