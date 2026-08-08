// A deformable surface of revolution.
//
// Every clay body in the workshop is one of these: a (rows x cols) grid whose
// radius is recomputed from a callback.  Because the callback receives the
// column index, each angular slice can be at a different stage of being
// smoothed -- which is exactly what makes the sweep board feel causal: the
// clay turns into a bell only where the board has actually passed.

import * as THREE from '../core/three.js';
import { TAU } from '../core/util.js';

export class LatheGrid {
  /**
   * @param {object} o
   * @param {number} o.rows vertical segments
   * @param {number} o.cols angular segments
   * @param {number} o.y0   bottom height
   * @param {number} o.y1   top height
   * @param {boolean} o.capBottom
   * @param {boolean} o.capTop
   */
  constructor({ rows = 48, cols = 64, y0 = 0, y1 = 2, capBottom = true, capTop = true, aspect = 1 }) {
    this.rows = rows; this.cols = cols;
    this.y0 = y0; this.y1 = y1;
    this.capBottom = capBottom; this.capTop = capTop;

    const nr = rows + 1, nc = cols + 1;
    this.sideCount = nr * nc;

    // cap rings are duplicated so their normals can point along the axis
    this.botStart = this.sideCount;
    this.botCount = capBottom ? nc + 1 : 0;
    this.topStart = this.botStart + this.botCount;
    this.topCount = capTop ? nc + 1 : 0;
    const total = this.topStart + this.topCount;

    this.position = new Float32Array(total * 3);
    this.normal = new Float32Array(total * 3);
    this.uv = new Float32Array(total * 2);
    this.aCover = new Float32Array(total);
    this.radius = new Float32Array(nr * nc);   // cached radii, for picking

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.normal, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    geo.setAttribute('aCover', new THREE.BufferAttribute(this.aCover, 1));
    this.geometry = geo;
    this.aCover.fill(1);

    // ---- indices ----
    const idx = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * nc + c, b = a + 1, d = a + nc, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
    if (capBottom) {
      const ctr = this.botStart + nc;
      for (let c = 0; c < cols; c++) idx.push(ctr, this.botStart + c + 1, this.botStart + c);
    }
    if (capTop) {
      const ctr = this.topStart + nc;
      for (let c = 0; c < cols; c++) idx.push(ctr, this.topStart + c, this.topStart + c + 1);
    }
    geo.setIndex(idx);

    // ---- static uv + cached trig ----
    this.cos = new Float32Array(nc);
    this.sin = new Float32Array(nc);
    for (let c = 0; c < nc; c++) {
      const th = (c / cols) * TAU;
      this.cos[c] = Math.cos(th); this.sin[c] = Math.sin(th);
    }
    // UVs must be area-correct or every texture on the body is stretched.  A
    // bell is roughly twice as far around as it is tall, so mapping 0..1 both
    // ways smeared the grain into vertical streaks that read as cloth folds
    // rather than as clay.
    this.aspect = aspect;
    for (let r = 0; r < nr; r++) {
      for (let c = 0; c < nc; c++) {
        const i = (r * nc + c) * 2;
        this.uv[i] = (c / cols) * aspect; this.uv[i + 1] = r / rows;
      }
    }
    for (let c = 0; c < nc; c++) {
      if (capBottom) { const i = (this.botStart + c) * 2; this.uv[i] = (c / cols) * aspect; this.uv[i + 1] = 0; }
      if (capTop) { const i = (this.topStart + c) * 2; this.uv[i] = (c / cols) * aspect; this.uv[i + 1] = 1; }
    }
    if (capBottom) { const i = (this.botStart + nc) * 2; this.uv[i] = 0.5; this.uv[i + 1] = 0; }
    if (capTop) { const i = (this.topStart + nc) * 2; this.uv[i] = 0.5; this.uv[i + 1] = 1; }

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
    this._tmpC = new THREE.Vector3();
  }

  theta(c) { return (c / this.cols) * TAU; }
  tAt(r) { return r / this.rows; }
  yAt(r) { return this.y0 + (this.y1 - this.y0) * (r / this.rows); }

  /**
   * Recompute the whole surface.
   * @param {(t:number, col:number, theta:number, row:number) => number} fn
   */
  update(fn) {
    const { rows, cols } = this, nc = cols + 1, pos = this.position;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows, y = this.yAt(r);
      for (let c = 0; c <= cols; c++) {
        // the seam column must match column 0 exactly or a crack appears
        const cc = c === cols ? 0 : c;
        const rad = fn(t, cc, this.theta(cc), r);
        this.radius[r * nc + c] = rad;
        const i = (r * nc + c) * 3;
        pos[i] = this.cos[c] * rad;
        pos[i + 1] = y;
        pos[i + 2] = this.sin[c] * rad;
      }
    }
    this._caps();
    this._normals();
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  _caps() {
    const { rows, cols } = this, nc = cols + 1, pos = this.position, nor = this.normal;
    if (this.capBottom) {
      for (let c = 0; c <= cols; c++) {
        const s = (0 * nc + c) * 3, d = (this.botStart + c) * 3;
        pos[d] = pos[s]; pos[d + 1] = pos[s + 1]; pos[d + 2] = pos[s + 2];
        nor[d] = 0; nor[d + 1] = -1; nor[d + 2] = 0;
      }
      const ctr = (this.botStart + nc) * 3;
      pos[ctr] = 0; pos[ctr + 1] = this.yAt(0); pos[ctr + 2] = 0;
      nor[ctr] = 0; nor[ctr + 1] = -1; nor[ctr + 2] = 0;
    }
    if (this.capTop) {
      for (let c = 0; c <= cols; c++) {
        const s = (rows * nc + c) * 3, d = (this.topStart + c) * 3;
        pos[d] = pos[s]; pos[d + 1] = pos[s + 1]; pos[d + 2] = pos[s + 2];
        nor[d] = 0; nor[d + 1] = 1; nor[d + 2] = 0;
      }
      const ctr = (this.topStart + nc) * 3;
      pos[ctr] = 0; pos[ctr + 1] = this.yAt(rows); pos[ctr + 2] = 0;
      nor[ctr] = 0; nor[ctr + 1] = 1; nor[ctr + 2] = 0;
    }
  }

  /** finite-difference normals over the grid (handles lumps, not just profiles) */
  _normals() {
    const { rows, cols } = this, nc = cols + 1;
    const pos = this.position, nor = this.normal;
    const a = this._tmpA, b = this._tmpB, n = this._tmpC;
    for (let r = 0; r <= rows; r++) {
      const rUp = Math.min(rows, r + 1), rDn = Math.max(0, r - 1);
      for (let c = 0; c <= cols; c++) {
        const cR = c === cols ? 1 : c + 1;
        const cL = c === 0 ? cols - 1 : c - 1;
        const iU = (rUp * nc + c) * 3, iD = (rDn * nc + c) * 3;
        const iR = (r * nc + cR) * 3, iL = (r * nc + cL) * 3;
        a.set(pos[iU] - pos[iD], pos[iU + 1] - pos[iD + 1], pos[iU + 2] - pos[iD + 2]);
        b.set(pos[iR] - pos[iL], pos[iR + 1] - pos[iL + 1], pos[iR + 2] - pos[iL + 2]);
        n.crossVectors(b, a);
        const len = n.length();
        const i = (r * nc + c) * 3;
        if (len < 1e-8) {
          // degenerate at a closed pole -- fall back to the axis direction
          nor[i] = pos[i]; nor[i + 1] = 0; nor[i + 2] = pos[i + 2];
          const l2 = Math.hypot(nor[i], nor[i + 2]) || 1;
          nor[i] /= l2; nor[i + 2] /= l2;
        } else {
          nor[i] = n.x / len; nor[i + 1] = n.y / len; nor[i + 2] = n.z / len;
        }
      }
    }
  }

  setCover(fn) {
    const { rows, cols } = this, nc = cols + 1;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const cc = c === cols ? 0 : c;
        this.aCover[r * nc + c] = fn(r / rows, cc, r);
      }
    }
    // caps take the value of their ring
    if (this.capBottom) for (let c = 0; c <= cols; c++) this.aCover[this.botStart + c] = this.aCover[c];
    if (this.capBottom) this.aCover[this.botStart + nc] = this.aCover[0];
    if (this.capTop) for (let c = 0; c <= cols; c++) this.aCover[this.topStart + c] = this.aCover[rows * nc + c];
    if (this.capTop) this.aCover[this.topStart + nc] = this.aCover[rows * nc];
    this.geometry.attributes.aCover.needsUpdate = true;
  }

  dispose() { this.geometry.dispose(); }
}
