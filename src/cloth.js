// The cloth: one continuous particle sheet that lives through the whole
// round. It starts folded, unfurls, gets chalked, is cut down to the pattern
// silhouette, sewn, turned right side out (which inflates it into a real
// volume) and finally hangs and sways on a hanger.
//
// The same particles are used at every step — that continuity is the point of
// the game: a flat piece of cloth *becoming* a piece of clothing.

import * as THREE from 'three';
import { pointInPolygon, closestOnPolygon, distanceToBoundary, clamp, smoothstep } from './geom2d.js';

const TABLE_Y = 0.02;
const MIN_SEP = 0.007;          // cloth thickness, keeps the two layers apart

export class Cloth {
  constructor(tier) {
    this.W = 3.0;
    this.D = 3.4;
    this.NX = tier.clothNX;
    this.NZ = tier.clothNZ;
    this.P = this.NX * this.NZ;

    const P = this.P;
    this.pos = new Float32Array(P * 3);
    this.prev = new Float32Array(P * 3);
    this.nrm = new Float32Array(P * 3);
    this.restFlat = new Float32Array(P * 3);
    this.restFold = new Float32Array(P * 3);
    this.restPat = new Float32Array(P * 2);
    this.oldFlat = new Float32Array(P * 3);
    this.puff = new Float32Array(P);
    this.active = new Uint8Array(P);
    this.pinned = new Uint8Array(P);
    this.pinPos = new Float32Array(P * 3);

    this.cellX = this.W / (this.NX - 1);
    this.cellZ = this.D / (this.NZ - 1);

    this._buildConstraintTemplate();
    this._buildGeometry();

    this.mode = 'fold';
    this.puffScale = 0;
    this.snapT = 1;              // 0..1 blend from oldFlat to restFlat after cutting
    this.time = 0;
    this.unfurl = 0;
    this.turn = 0;
    this.turnPivot = new THREE.Vector3();
    this.turnLift = new THREE.Vector3();
    this.windPhase = Math.random() * 10;
    this.isCut = false;
    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
  }

  idx(i, j) { return j * this.NX + i; }

  // ---------------------------------------------------------------- setup

  _buildConstraintTemplate() {
    const { NX, NZ } = this;
    const a = [], b = [], k = [];
    const push = (p, q, stiff) => { a.push(p); b.push(q); k.push(stiff); };
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const p = this.idx(i, j);
        if (i + 1 < NX) push(p, this.idx(i + 1, j), 1.0);
        if (j + 1 < NZ) push(p, this.idx(i, j + 1), 1.0);
        if (i + 1 < NX && j + 1 < NZ) {
          push(p, this.idx(i + 1, j + 1), 0.5);
          push(this.idx(i + 1, j), this.idx(i, j + 1), 0.5);
        }
        if (i + 2 < NX) push(p, this.idx(i + 2, j), 0.22);
        if (j + 2 < NZ) push(p, this.idx(i, j + 2), 0.22);
      }
    }
    this.cA = new Int32Array(a);
    this.cB = new Int32Array(b);
    this.cK = new Float32Array(k);
    this.cRest = new Float32Array(a.length);
    this.cOn = new Uint8Array(a.length).fill(1);
  }

  _buildGeometry() {
    const P = this.P;
    this.geo = new THREE.BufferGeometry();
    this.vpos = new Float32Array(P * 2 * 3);
    this.vnrm = new Float32Array(P * 2 * 3);
    this.vuv = new Float32Array(P * 2 * 2);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.vpos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.vnrm, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(this.vuv, 2));
    // one index buffer, sized for every quad, reused for the whole game
    this.vidx = new Uint32Array((this.NX - 1) * (this.NZ - 1) * 12);
    this.geo.setIndex(new THREE.BufferAttribute(this.vidx, 1));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 8);
  }

  /** Rewrites indices from the current `quadOn` mask (or all quads). */
  _rebuildIndex(quadOn) {
    const { NX, NZ, P, vidx } = this;
    let n = 0;
    for (let j = 0; j < NZ - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        if (quadOn && !quadOn[j * (NX - 1) + i]) continue;
        const a = this.idx(i, j), b = this.idx(i + 1, j);
        const c = this.idx(i + 1, j + 1), d = this.idx(i, j + 1);
        // front layer (+normal)
        vidx[n++] = a; vidx[n++] = c; vidx[n++] = b;
        vidx[n++] = a; vidx[n++] = d; vidx[n++] = c;
        // back layer (-normal)
        vidx[n++] = P + a; vidx[n++] = P + b; vidx[n++] = P + c;
        vidx[n++] = P + a; vidx[n++] = P + c; vidx[n++] = P + d;
      }
    }
    this.geo.index.needsUpdate = true;
    this.geo.setDrawRange(0, n);
  }

  _writeUVs() {
    const { P, W, D, S } = this;
    for (let p = 0; p < P; p++) {
      const px = this.restPat[p * 2], py = this.restPat[p * 2 + 1];
      const u = (px * S + W * 0.5) / W;
      const v = (-py * S + D * 0.5) / D;
      this.vuv[p * 2] = u;
      this.vuv[p * 2 + 1] = v;
      this.vuv[(P + p) * 2] = u;
      this.vuv[(P + p) * 2 + 1] = v;
    }
    this.geo.attributes.uv.needsUpdate = true;
  }

  /** Starts a fresh round with a new pattern. */
  reset(pattern) {
    const { NX, NZ, W, D } = this;
    this.pattern = pattern;
    const b = pattern.bounds;
    const hx = Math.max(Math.abs(b.minX), Math.abs(b.maxX));
    const hy = Math.max(Math.abs(b.minY), Math.abs(b.maxY));
    this.S = Math.min((W * 0.5) / hx, (D * 0.5) / hy) * 0.84;
    this.puffMax = pattern.puff * this.S;
    this.dRef = 0.30 * this.S;

    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const p = this.idx(i, j);
        const u = i / (NX - 1), v = j / (NZ - 1);
        const x = (u - 0.5) * W, z = (v - 0.5) * D;
        this.restFlat[p * 3] = x;
        this.restFlat[p * 3 + 1] = TABLE_Y;
        this.restFlat[p * 3 + 2] = z;
        this.restPat[p * 2] = x / this.S;
        this.restPat[p * 2 + 1] = -z / this.S;

        // neatly double-folded bundle to start from
        const fu = u < 0.5 ? u * 2 : (1 - u) * 2;
        const fv = v < 0.5 ? v * 2 : (1 - v) * 2;
        const layer = (u < 0.5 ? 0 : 1) + (v < 0.5 ? 0 : 2);
        this.restFold[p * 3] = (fu - 0.5) * W * 0.46;
        this.restFold[p * 3 + 1] = TABLE_Y + layer * 0.016 + 0.004;
        this.restFold[p * 3 + 2] = (fv - 0.5) * D * 0.46;

        this.active[p] = 1;
        this.pinned[p] = 0;
        this.puff[p] = 0;
      }
    }
    this.pos.set(this.restFold);
    this.prev.set(this.restFold);
    this.oldFlat.set(this.restFlat);

    for (let c = 0; c < this.cA.length; c++) {
      this.cOn[c] = 1;
      this.cRest[c] = this._restDist(this.cA[c], this.cB[c]);
    }
    this._rebuildIndex(null);
    this._writeUVs();

    this.mode = 'fold';
    this.puffScale = 0;
    this.snapT = 1;
    this.unfurl = 0;
    this.turn = 0;
    this.isCut = false;
    this.updateRender();
  }

  _restDist(p, q) {
    const dx = this.restFlat[p * 3] - this.restFlat[q * 3];
    const dy = this.restFlat[p * 3 + 1] - this.restFlat[q * 3 + 1];
    const dz = this.restFlat[p * 3 + 2] - this.restFlat[q * 3 + 2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // ---------------------------------------------------------------- cutting

  /**
   * Drops every quad outside the pattern, snaps the surviving rim exactly
   * onto the outline and works out how much each point should puff up once
   * the garment is turned. Returns a snapshot mesh of the offcut.
   */
  cut() {
    const { NX, NZ, P, S } = this;
    const outline = this.pattern.outline;
    const quadOn = new Uint8Array((NX - 1) * (NZ - 1));
    const probe = { x: 0, y: 0 };

    for (let j = 0; j < NZ - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        const a = this.idx(i, j), b = this.idx(i + 1, j);
        const c = this.idx(i + 1, j + 1), d = this.idx(i, j + 1);
        probe.x = (this.restPat[a * 2] + this.restPat[b * 2] + this.restPat[c * 2] + this.restPat[d * 2]) * 0.25;
        probe.y = (this.restPat[a * 2 + 1] + this.restPat[b * 2 + 1] + this.restPat[c * 2 + 1] + this.restPat[d * 2 + 1]) * 0.25;
        quadOn[j * (NX - 1) + i] = pointInPolygon(probe, outline) ? 1 : 0;
      }
    }

    const offcut = this._snapshotOffcut(quadOn);

    // which points survive?
    this.active.fill(0);
    for (let j = 0; j < NZ - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        if (!quadOn[j * (NX - 1) + i]) continue;
        this.active[this.idx(i, j)] = 1;
        this.active[this.idx(i + 1, j)] = 1;
        this.active[this.idx(i + 1, j + 1)] = 1;
        this.active[this.idx(i, j + 1)] = 1;
      }
    }

    this.oldFlat.set(this.restFlat);

    // rim points snap onto the true silhouette so the edge is crisp
    const onQuad = (i, j) => (i >= 0 && j >= 0 && i < NX - 1 && j < NZ - 1) ? quadOn[j * (NX - 1) + i] : 0;
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const p = this.idx(i, j);
        if (!this.active[p]) continue;
        const q = onQuad(i - 1, j - 1) + onQuad(i, j - 1) + onQuad(i - 1, j) + onQuad(i, j);
        if (q < 4) {
          probe.x = this.restPat[p * 2];
          probe.y = this.restPat[p * 2 + 1];
          const near = closestOnPolygon(probe, outline);
          this.restPat[p * 2] = near.x;
          this.restPat[p * 2 + 1] = near.y;
        }
      }
    }

    // new flat rest pose + the pillow profile that makes the garment 3-D
    for (let p = 0; p < P; p++) {
      if (!this.active[p]) { this.puff[p] = 0; continue; }
      const px = this.restPat[p * 2], py = this.restPat[p * 2 + 1];
      this.restFlat[p * 3] = px * S;
      this.restFlat[p * 3 + 1] = TABLE_Y;
      this.restFlat[p * 3 + 2] = -py * S;
      probe.x = px; probe.y = py;
      const d = distanceToBoundary(probe, outline) * S;
      this.puff[p] = this.puffMax * Math.pow(clamp(d / this.dRef, 0, 1), 0.55);
    }

    for (let c = 0; c < this.cA.length; c++) {
      const on = this.active[this.cA[c]] && this.active[this.cB[c]];
      this.cOn[c] = on ? 1 : 0;
      if (on) this.cRest[c] = this._restDist(this.cA[c], this.cB[c]);
    }

    this._rebuildIndex(quadOn);
    this._writeUVs();
    this.snapT = 0;
    this.isCut = true;
    return offcut;
  }

  /** Builds a throwaway mesh holding exactly the fabric that was cut away. */
  _snapshotOffcut(quadOn) {
    const { NX, NZ } = this;
    const pos = [], uv = [], idxArr = [], map = new Map();
    const vertFor = (p) => {
      let v = map.get(p);
      if (v === undefined) {
        v = pos.length / 3;
        map.set(p, v);
        pos.push(this.pos[p * 3], this.pos[p * 3 + 1], this.pos[p * 3 + 2]);
        uv.push(this.vuv[p * 2], this.vuv[p * 2 + 1]);
      }
      return v;
    };
    for (let j = 0; j < NZ - 1; j++) {
      for (let i = 0; i < NX - 1; i++) {
        if (quadOn[j * (NX - 1) + i]) continue;
        const a = vertFor(this.idx(i, j)), b = vertFor(this.idx(i + 1, j));
        const c = vertFor(this.idx(i + 1, j + 1)), d = vertFor(this.idx(i, j + 1));
        idxArr.push(a, c, b, a, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idxArr);
    g.computeVertexNormals();
    return g;
  }

  // ---------------------------------------------------------------- pinning

  /** Pins the topmost band of the garment, i.e. where a hanger would hold it. */
  pinTop() {
    const { P } = this;
    let maxY = -Infinity;
    for (let p = 0; p < P; p++) if (this.active[p]) maxY = Math.max(maxY, this.restPat[p * 2 + 1]);
    const band = 0.11;
    this.pinned.fill(0);
    for (let p = 0; p < P; p++) {
      if (!this.active[p]) continue;
      if (this.restPat[p * 2 + 1] > maxY - band) {
        this.pinned[p] = 1;
        this.pinPos[p * 3] = this.pos[p * 3];
        this.pinPos[p * 3 + 1] = this.pos[p * 3 + 1];
        this.pinPos[p * 3 + 2] = this.pos[p * 3 + 2];
      }
    }
    // remember the shape it landed in, so hanging sways instead of collapsing
    if (!this.restHang) this.restHang = new Float32Array(this.P * 3);
    this.restHang.set(this.pos);
  }

  /** Centre of the pinned band — where the hanger goes. */
  pinCentre(out = new THREE.Vector3()) {
    let n = 0;
    out.set(0, 0, 0);
    for (let p = 0; p < this.P; p++) {
      if (!this.pinned[p]) continue;
      out.x += this.pinPos[p * 3];
      out.y += this.pinPos[p * 3 + 1];
      out.z += this.pinPos[p * 3 + 2];
      n++;
    }
    if (n) out.multiplyScalar(1 / n);
    return out;
  }

  // ---------------------------------------------------------------- stepping

  step(dt) {
    this.time += dt;
    dt = Math.min(dt, 1 / 45);
    switch (this.mode) {
      case 'fold': this._stepFold(dt); break;
      case 'unfurl': this._stepUnfurl(dt); break;
      case 'flat': this._stepFlat(dt); break;
      case 'turn': this._stepTurn(dt); break;
      case 'hang': this._stepHang(dt); break;
    }
    if (this.snapT < 1) this.snapT = Math.min(1, this.snapT + dt * 2.6);
    this.updateRender();
  }

  _stepFold(dt) {
    const k = 1 - Math.exp(-9 * dt);
    const t = this.time;
    for (let p = 0; p < this.P; p++) {
      const breath = Math.sin(t * 1.5 + p * 0.013) * 0.004;
      for (let a = 0; a < 3; a++) {
        const target = this.restFold[p * 3 + a] + (a === 1 ? breath : 0);
        this.pos[p * 3 + a] += (target - this.pos[p * 3 + a]) * k;
        this.prev[p * 3 + a] = this.pos[p * 3 + a];
      }
    }
  }

  /**
   * The unfurl: cloth blooms out of its folds, billows through the air and
   * settles flat. Driven by `unfurl` (0..1) which the phase advances from the
   * child's drag, with verlet on top so the folds ripple like real cloth.
   */
  _stepUnfurl(dt) {
    const { P, NX, NZ } = this;
    const p01 = clamp(this.unfurl, 0, 1);
    // the folds come apart well before the cloth lands, so the child sees a
    // whole open sheet floating down rather than a bundle unrolling on wood
    const shape = smoothstep(0, 0.62, p01);
    const lift = Math.sin(Math.PI * clamp(p01 * 1.03, 0, 1)) * 1.0;
    const t = this.time;
    const spring = 16;

    for (let p = 0; p < P; p++) {
      const i = p % NX, j = (p / NX) | 0;
      const u = i / (NX - 1), v = j / (NZ - 1);
      const bell = Math.cos((u - 0.5) * Math.PI) * Math.cos((v - 0.5) * Math.PI);
      const wave = Math.sin(u * 5.5 + t * 4.6) * Math.sin(v * 4.2 - t * 3.1);

      const tx = this.restFold[p * 3] + (this.restFlat[p * 3] - this.restFold[p * 3]) * shape;
      const tz = this.restFold[p * 3 + 2] + (this.restFlat[p * 3 + 2] - this.restFold[p * 3 + 2]) * shape;
      const ty = this.restFold[p * 3 + 1] + (this.restFlat[p * 3 + 1] - this.restFold[p * 3 + 1]) * shape
        + lift * (0.34 + 0.66 * bell)      // the middle billows highest
        + lift * (0.5 - v) * 0.55          // and the far edge leads the throw
        + wave * 0.13 * lift;

      // verlet integrate
      for (let a = 0; a < 3; a++) {
        const cur = this.pos[p * 3 + a];
        const vel = (cur - this.prev[p * 3 + a]) * 0.94;
        this.prev[p * 3 + a] = cur;
        this.pos[p * 3 + a] = cur + vel;
      }
      const kk = Math.min(1, spring * dt);
      this.pos[p * 3] += (tx - this.pos[p * 3]) * kk;
      this.pos[p * 3 + 1] += (ty - this.pos[p * 3 + 1]) * kk;
      this.pos[p * 3 + 2] += (tz - this.pos[p * 3 + 2]) * kk;
    }
    // ease the constraints off while the folds are still doubled over, so the
    // sheet opens instead of fighting itself into wrinkles
    this._solve(2, 0.45 + 0.55 * shape);
    this._floor();
  }

  _stepFlat(dt) {
    const k = 1 - Math.exp(-11 * dt);
    const t = this.time;
    const blend = this.snapT;
    for (let p = 0; p < this.P; p++) {
      if (!this.active[p]) continue;
      const rx = this.oldFlat[p * 3] + (this.restFlat[p * 3] - this.oldFlat[p * 3]) * blend;
      const ry = this.oldFlat[p * 3 + 1] + (this.restFlat[p * 3 + 1] - this.oldFlat[p * 3 + 1]) * blend;
      const rz = this.oldFlat[p * 3 + 2] + (this.restFlat[p * 3 + 2] - this.oldFlat[p * 3 + 2]) * blend;
      const wobble = Math.sin(t * 1.15 + rx * 2.3) * Math.sin(t * 0.83 + rz * 1.9) * 0.011;
      this.pos[p * 3] += (rx - this.pos[p * 3]) * k;
      this.pos[p * 3 + 1] += (ry + wobble - this.pos[p * 3 + 1]) * k;
      this.pos[p * 3 + 2] += (rz - this.pos[p * 3 + 2]) * k;
      this.prev[p * 3] = this.pos[p * 3];
      this.prev[p * 3 + 1] = this.pos[p * 3 + 1];
      this.prev[p * 3 + 2] = this.pos[p * 3 + 2];
    }
  }

  /**
   * くるん — the flat, sewn shape swings up off the table, spins once and
   * inflates into a garment with real volume.
   */
  _stepTurn() {
    const t = clamp(this.turn, 0, 1);
    const swing = smoothstep(0, 1, clamp(t * 1.25, 0, 1));
    const spin = smoothstep(0, 1, clamp((t - 0.06) / 0.82, 0, 1));
    const theta = (Math.PI / 2) * swing;
    const phi = Math.PI * 2 * spin;
    const cs = Math.cos(theta), sn = Math.sin(theta);
    const cp = Math.cos(phi), sp = Math.sin(phi);

    const pv = this.turnPivot, lf = this.turnLift;
    const ox = pv.x + (lf.x - pv.x) * swing;
    const oy = pv.y + (lf.y - pv.y) * swing;
    const oz = pv.z + (lf.z - pv.z) * swing;

    for (let p = 0; p < this.P; p++) {
      if (!this.active[p]) continue;
      const dx = this.restFlat[p * 3] - pv.x;
      const dy = this.restFlat[p * 3 + 1] - pv.y;
      const dz = this.restFlat[p * 3 + 2] - pv.z;
      // rotate up around X, then twirl around Y
      const y1 = dy * cs - dz * sn;
      const z1 = dy * sn + dz * cs;
      const x2 = dx * cp + z1 * sp;
      const z2 = -dx * sp + z1 * cp;
      this.pos[p * 3] = ox + x2;
      this.pos[p * 3 + 1] = oy + y1;
      this.pos[p * 3 + 2] = oz + z2;
      this.prev[p * 3] = this.pos[p * 3];
      this.prev[p * 3 + 1] = this.pos[p * 3 + 1];
      this.prev[p * 3 + 2] = this.pos[p * 3 + 2];
    }
    this.puffScale = smoothstep(0.18, 0.95, t);
  }

  _stepHang(dt) {
    const { P, restHang } = this;
    const t = this.time;
    const g = -1.5 * dt * dt;
    const bx = (Math.sin(t * 0.63 + this.windPhase) * 0.5 + Math.sin(t * 1.31) * 0.25) * 0.9 * dt * dt;
    const bz = (Math.cos(t * 0.47 + this.windPhase) * 0.5 + Math.sin(t * 0.91) * 0.3) * 0.7 * dt * dt;
    // a soft memory of the shape it was turned into: enough to keep the
    // silhouette open, loose enough to still breathe in the draught
    const mem = Math.min(0.4, dt * 3.4);

    for (let p = 0; p < P; p++) {
      if (!this.active[p]) continue;
      if (this.pinned[p]) {
        this.pos[p * 3] = this.pinPos[p * 3];
        this.pos[p * 3 + 1] = this.pinPos[p * 3 + 1];
        this.pos[p * 3 + 2] = this.pinPos[p * 3 + 2];
        this.prev[p * 3] = this.pos[p * 3];
        this.prev[p * 3 + 1] = this.pos[p * 3 + 1];
        this.prev[p * 3 + 2] = this.pos[p * 3 + 2];
        continue;
      }
      const sway = Math.sin(t * 1.7 + this.restPat[p * 2 + 1] * 3.1) * 0.16;
      for (let a = 0; a < 3; a++) {
        const cur = this.pos[p * 3 + a];
        const vel = (cur - this.prev[p * 3 + a]) * 0.972;
        this.prev[p * 3 + a] = cur;
        let next = cur + vel
          + (a === 1 ? g : 0)
          + (a === 0 ? bx * (1 + sway) : 0)
          + (a === 2 ? bz : 0);
        if (restHang) next += (restHang[p * 3 + a] - next) * mem;
        this.pos[p * 3 + a] = next;
      }
    }
    this._solve(3, 1);
  }

  /** Gauss-Seidel distance constraints. */
  _solve(iterations, stiffness) {
    const { cA, cB, cK, cRest, cOn, pos, pinned } = this;
    const n = cA.length;
    for (let it = 0; it < iterations; it++) {
      for (let c = 0; c < n; c++) {
        if (!cOn[c]) continue;
        const p = cA[c], q = cB[c];
        const pa = p * 3, qa = q * 3;
        const dx = pos[qa] - pos[pa];
        const dy = pos[qa + 1] - pos[pa + 1];
        const dz = pos[qa + 2] - pos[pa + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-7) continue;
        const diff = ((len - cRest[c]) / len) * cK[c] * stiffness;
        const pf = pinned[p] ? 0 : (pinned[q] ? 1 : 0.5);
        const qf = pinned[q] ? 0 : (pinned[p] ? 1 : 0.5);
        pos[pa] += dx * diff * pf;
        pos[pa + 1] += dy * diff * pf;
        pos[pa + 2] += dz * diff * pf;
        pos[qa] -= dx * diff * qf;
        pos[qa + 1] -= dy * diff * qf;
        pos[qa + 2] -= dz * diff * qf;
      }
    }
  }

  _floor() {
    const min = TABLE_Y + 0.003;
    for (let p = 0; p < this.P; p++) {
      if (this.pos[p * 3 + 1] < min) this.pos[p * 3 + 1] = min;
    }
  }

  // ---------------------------------------------------------------- render

  /** Rebuilds the two rendered layers and their normals from the particles. */
  updateRender() {
    const { NX, NZ, P, pos, nrm, vpos, vnrm, puff, puffScale } = this;

    // mid-surface normals from grid neighbours
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const p = this.idx(i, j);
        const il = i > 0 ? i - 1 : i, ir = i < NX - 1 ? i + 1 : i;
        const jl = j > 0 ? j - 1 : j, jr = j < NZ - 1 ? j + 1 : j;
        const a = this.idx(ir, j) * 3, b = this.idx(il, j) * 3;
        const c = this.idx(i, jr) * 3, d = this.idx(i, jl) * 3;
        const ax = pos[a] - pos[b], ay = pos[a + 1] - pos[b + 1], az = pos[a + 2] - pos[b + 2];
        const bx = pos[c] - pos[d], by = pos[c + 1] - pos[d + 1], bz = pos[c + 2] - pos[d + 2];
        let nx = by * az - bz * ay;
        let ny = bz * ax - bx * az;
        let nz = bx * ay - by * ax;
        const L = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nrm[p * 3] = nx / L; nrm[p * 3 + 1] = ny / L; nrm[p * 3 + 2] = nz / L;
      }
    }

    for (let p = 0; p < P; p++) {
      const off = MIN_SEP + puff[p] * puffScale;
      const x = pos[p * 3], y = pos[p * 3 + 1], z = pos[p * 3 + 2];
      const nx = nrm[p * 3], ny = nrm[p * 3 + 1], nz = nrm[p * 3 + 2];
      vpos[p * 3] = x + nx * off;
      vpos[p * 3 + 1] = y + ny * off;
      vpos[p * 3 + 2] = z + nz * off;
      const q = P + p;
      vpos[q * 3] = x - nx * off;
      vpos[q * 3 + 1] = y - ny * off;
      vpos[q * 3 + 2] = z - nz * off;
    }

    // true normals of each inflated layer, so the pillow rim catches light
    for (let layer = 0; layer < 2; layer++) {
      const base = layer * P;
      const sgn = layer === 0 ? 1 : -1;
      for (let j = 0; j < NZ; j++) {
        for (let i = 0; i < NX; i++) {
          const p = base + this.idx(i, j);
          const il = i > 0 ? i - 1 : i, ir = i < NX - 1 ? i + 1 : i;
          const jl = j > 0 ? j - 1 : j, jr = j < NZ - 1 ? j + 1 : j;
          const a = (base + this.idx(ir, j)) * 3, b = (base + this.idx(il, j)) * 3;
          const c = (base + this.idx(i, jr)) * 3, d = (base + this.idx(i, jl)) * 3;
          const ax = vpos[a] - vpos[b], ay = vpos[a + 1] - vpos[b + 1], az = vpos[a + 2] - vpos[b + 2];
          const bx = vpos[c] - vpos[d], by = vpos[c + 1] - vpos[d + 1], bz = vpos[c + 2] - vpos[d + 2];
          let nx = (by * az - bz * ay) * sgn;
          let ny = (bz * ax - bx * az) * sgn;
          let nz = (bx * ay - by * ax) * sgn;
          const L = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          vnrm[p * 3] = nx / L; vnrm[p * 3 + 1] = ny / L; vnrm[p * 3 + 2] = nz / L;
        }
      }
    }

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }

  // ---------------------------------------------------------------- sampling

  /**
   * Where does pattern point (px, py) sit in the world right now?
   * Used to glue chalk marks, stitches and decorations onto the moving cloth.
   */
  sampleSurface(px, py, out) {
    const { NX, NZ, W, D, S } = this;
    const fi = clamp(((px * S) / W + 0.5) * (NX - 1), 0, NX - 1.001);
    const fj = clamp(((-py * S) / D + 0.5) * (NZ - 1), 0, NZ - 1.001);
    const i0 = Math.floor(fi), j0 = Math.floor(fj);
    const tx = fi - i0, tz = fj - j0;
    const w = [(1 - tx) * (1 - tz), tx * (1 - tz), tx * tz, (1 - tx) * tz];
    const ids = [this.idx(i0, j0), this.idx(i0 + 1, j0), this.idx(i0 + 1, j0 + 1), this.idx(i0, j0 + 1)];

    let px3 = 0, py3 = 0, pz3 = 0, nx = 0, ny = 0, nz = 0, pf = 0, wt = 0;
    for (let k = 0; k < 4; k++) {
      const p = ids[k];
      if (this.isCut && !this.active[p]) continue;
      const ww = w[k];
      px3 += this.pos[p * 3] * ww; py3 += this.pos[p * 3 + 1] * ww; pz3 += this.pos[p * 3 + 2] * ww;
      nx += this.nrm[p * 3] * ww; ny += this.nrm[p * 3 + 1] * ww; nz += this.nrm[p * 3 + 2] * ww;
      pf += this.puff[p] * ww;
      wt += ww;
    }
    if (wt < 1e-4) {          // fall back to the nearest surviving point
      const p = ids[0];
      px3 = this.pos[p * 3]; py3 = this.pos[p * 3 + 1]; pz3 = this.pos[p * 3 + 2];
      nx = this.nrm[p * 3]; ny = this.nrm[p * 3 + 1]; nz = this.nrm[p * 3 + 2];
      pf = this.puff[p]; wt = 1;
    }
    const inv = 1 / wt;
    out.pos.set(px3 * inv, py3 * inv, pz3 * inv);
    out.nrm.set(nx * inv, ny * inv, nz * inv).normalize();
    out.puff = pf * inv * this.puffScale + MIN_SEP;
    return out;
  }

  static makeSample() {
    return { pos: new THREE.Vector3(), nrm: new THREE.Vector3(), puff: 0 };
  }

  /** Ray-hit against the current garment surface (used when decorating). */
  raycast(raycaster, mesh) {
    return raycaster.intersectObject(mesh, false);
  }
}

export { TABLE_Y, MIN_SEP };
