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
  outerR, innerR, coreR, blobR, falseBlobR, moldR, moldInnerR,
  moldHeight, SPRUE_R,
} from './profiles.js';
import {
  clayCoreMaterial, clayFalseMaterial, moldMaterial, bronzeMaterial, METALS, TEX,
} from './materials.js';
import { makeDecorMesh, orientDecor, decorTone } from './decorations.js';
import { clamp01, lerp, smoothstep, TAU, angNoise } from '../core/util.js';

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
      const grain = 0.020 * angNoise(theta * 4 + t * 7, seed + 2, 2) * (1 - k) * (1 - k);
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
      map: TEX.clayFalse, color: 0xfff0e4, roughness: 0.78, metalness: 0,
    });
    this.refreshFalse();
  }

  refreshFalse() {
    const S = this.shape, seed = this.falseSeed, prog = this.falseProgress;
    this.falseGrid.update((t, c, theta) => {
      const k = prog[c];
      const raw = falseBlobR(S, t, theta, seed);
      const target = outerR(S, t);
      const grain = 0.016 * angNoise(theta * 5 - t * 6, seed + 4, 2) * (1 - k) * (1 - k);
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
    const mesh = makeDecorMesh(key, this.decorMat);
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
    });
    this.moldCover = new Float32Array((MOLD_ROWS + 1) * MOLD_COLS).fill(0);
    this.moldMat = moldMaterial();
    this.moldMesh = new THREE.Mesh(this.moldGrid.geometry, this.moldMat);
    this.moldMesh.castShadow = true; this.moldMesh.receiveShadow = true;
    this.group.add(this.moldMesh);
    this.refreshMold();

    // an invisible proxy at the finished mould surface, for painting raycasts
    const proxyGrid = new LatheGrid({ rows: 28, cols: 40, y0: 0, y1: H, capBottom: false, capTop: false });
    proxyGrid.update((t) => moldR(S, t) + 0.02);
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
      this.group.add(hoop);
      this.hoops.push(hoop);
    }
  }

  /** mould radius grows outward from the false bell as mud is laid on */
  refreshMold() {
    const S = this.shape, H = moldHeight(S), cover = this.moldCover;
    const cols = MOLD_COLS;
    this.moldGrid.update((u, c) => {
      const k = cover[Math.round(u * MOLD_ROWS) * cols + c];
      const inner = moldInnerR(S, u) + 0.012;
      const outerFull = moldR(S, u);
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
        const w = (1 - d / radius) ** 1.5 * amount;
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
  buildChunks(rowsN = 5, colsN = 12) {
    const S = this.shape, H = moldHeight(S);
    this.moldMesh.visible = false;
    this.paintProxy.visible = false;
    this.chunks = [];
    const grp = new THREE.Group();
    this.group.add(grp);
    this.chunkGroup = grp;
    const mat = new THREE.MeshStandardMaterial({
      map: TEX.moldEarth, color: 0xffffff, roughness: 0.97, metalness: 0, side: THREE.DoubleSide,
    });
    this.chunkMat = mat;

    for (let r = 0; r < rowsN; r++) {
      const u0 = r / rowsN, u1 = (r + 1) / rowsN;
      for (let c = 0; c < colsN; c++) {
        const t0 = (c / colsN) * TAU, t1 = ((c + 1) / colsN) * TAU;
        const { geo, center } = buildChunkGeo(S, H, u0, u1, t0, t1);
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true; m.receiveShadow = true;
        m.position.copy(center);
        grp.add(m);
        this.chunks.push({
          mesh: m, u: (u0 + u1) / 2, theta: (t0 + t1) / 2,
          home: center.clone(), state: 0,
          vel: new THREE.Vector3(), spin: new THREE.Vector3(),
        });
      }
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
    const g = new LatheGrid({ rows, cols, y0: 0, y1: S.height, capBottom: false, capTop: false });
    g.update((t) => outerR(S, t));
    const body = new THREE.Mesh(g.geometry, mat);
    body.castShadow = true; body.receiveShadow = true;
    grp.add(body);
    this.bellBody = body;
    this.bellGrid = g;

    // inner wall, so looking up into the mouth reads as a hollow casting
    const gi = new LatheGrid({ rows, cols, y0: 0, y1: S.height, capBottom: false, capTop: true });
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
      const m = makeDecorMesh(d.key, mat);
      orientDecor(m, d.theta, d.t * S.height, outerR(S, d.t), this.slopeAt(d.t), d.size);
      this.bellDecorGroup.add(m);
    }

    // it comes out of the ground filthy and dulled; the light polishes it later
    this.setBellClean(0);
    return grp;
  }

  /** 0 = filthy from the mould, 1 = wiped clean and reflective */
  setBellClean(k) {
    const M = METALS[this.metal];
    const dirty = 1 - clamp01(k);
    if (this.bellMat) {
      this.bellMat.roughness = lerp(M.rough, 0.92, dirty);
      this.bellMat.envMapIntensity = lerp(1.35, 0.15, dirty);
      this.bellMat.color.setHex(M.color).lerp(new THREE.Color(0x6d6053), dirty * 0.85);
      this.bellMat.needsUpdate = false;
    }
    if (this.bellInnerMat) {
      this.bellInnerMat.roughness = lerp(M.rough + 0.22, 0.95, dirty);
      this.bellInnerMat.envMapIntensity = lerp(0.9, 0.1, dirty);
      this.bellInnerMat.color.copy(this.bellMat.color);
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
 *  one broken piece of the outer mould                                *
 * ------------------------------------------------------------------ */
function buildChunkGeo(S, H, u0, u1, th0, th1, nu = 4, nth = 4) {
  const pos = [], nor = [], uv = [], idx = [];
  const ring = (u, th, outer) => {
    const r = outer ? moldR(S, u) : moldInnerR(S, u) + 0.012;
    return [Math.cos(th) * r, u * H, Math.sin(th) * r];
  };
  const pushGrid = (outer, flip) => {
    const base = pos.length / 3;
    for (let i = 0; i <= nu; i++) {
      const u = lerp(u0, u1, i / nu);
      for (let j = 0; j <= nth; j++) {
        const th = lerp(th0, th1, j / nth);
        const p = ring(u, th, outer);
        pos.push(p[0], p[1], p[2]);
        nor.push(0, 0, 0);
        uv.push(th / TAU * 3, u * 2.4);
      }
    }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nth; j++) {
        const a = base + i * (nth + 1) + j, b = a + 1, c = a + nth + 1, d = c + 1;
        if (flip) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    }
  };
  pushGrid(true, false);
  pushGrid(false, true);

  // torn side faces, so the broken pieces have real thickness
  const sideQuad = (uA, thA, uB, thB) => {
    const base = pos.length / 3;
    const pts = [ring(uA, thA, true), ring(uA, thA, false), ring(uB, thB, true), ring(uB, thB, false)];
    for (const p of pts) { pos.push(p[0], p[1], p[2]); nor.push(0, 0, 0); uv.push(0, 0); }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  };
  for (let i = 0; i < nu; i++) {
    const a = lerp(u0, u1, i / nu), b = lerp(u0, u1, (i + 1) / nu);
    sideQuad(a, th0, b, th0); sideQuad(b, th1, a, th1);
  }
  for (let j = 0; j < nth; j++) {
    const a = lerp(th0, th1, j / nth), b = lerp(th0, th1, (j + 1) / nth);
    sideQuad(u0, b, u0, a); sideQuad(u1, a, u1, b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // recentre so the piece can tumble about itself
  geo.computeBoundingBox();
  const center = new THREE.Vector3();
  geo.boundingBox.getCenter(center);
  geo.translate(-center.x, -center.y, -center.z);
  geo.computeBoundingSphere();
  return { geo, center };
}
