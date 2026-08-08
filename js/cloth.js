// Verlet cloth. The kain is a real simulated sheet: it sags on the frame,
// gains weight where it soaks up dye, drags in the bath, and its free edges
// lag behind the corners when it is shaken out.

import { V3, clamp, lerp } from './math.js';

const GRAVITY = -7.0;

export class Cloth {
  constructor(nx = 40, ny = 40, size = 1.5) {
    this.nx = nx; this.ny = ny;
    this.size = size;
    const n = nx * ny;
    this.count = n;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.rest = new Float32Array(n * 3);     // flat reference shape
    this.target = new Float32Array(n * 3);   // where pinned particles want to be
    this.pin = new Float32Array(n);          // 0 free .. 1 fully constrained
    this.normal = new Float32Array(n * 3);
    this.uv = new Float32Array(n * 2);
    this.wet = new Float32Array(n);          // extra mass from absorbed dye

    this.origin = V3.create(0, 0, 0);
    this.constraints = [];
    this.liquidY = -999;
    this.liquidDrag = 0;
    this.windPhase = 0;
    this.shakeImpulse = 0;
    // When set, the sheet is kept inside a cylindrical vessel so it piles up
    // in the dye tub instead of passing through its wall.
    this.vessel = null;

    this.buildGrid();
    this.buildConstraints();
  }

  idx(i, j) { return j * this.nx + i; }

  buildGrid() {
    const { nx, ny, size } = this;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = this.idx(i, j);
        const u = i / (nx - 1), v = j / (ny - 1);
        const x = (u - 0.5) * size;
        const y = (v - 0.5) * size;
        this.rest[k * 3] = x; this.rest[k * 3 + 1] = y; this.rest[k * 3 + 2] = 0;
        this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = 0;
        this.prev[k * 3] = x; this.prev[k * 3 + 1] = y; this.prev[k * 3 + 2] = 0;
        this.uv[k * 2] = u; this.uv[k * 2 + 1] = v;
      }
    }
  }

  buildConstraints() {
    const { nx, ny } = this;
    const push = (a, b, stiff) => {
      const d = Math.hypot(
        this.rest[a * 3] - this.rest[b * 3],
        this.rest[a * 3 + 1] - this.rest[b * 3 + 1],
        this.rest[a * 3 + 2] - this.rest[b * 3 + 2],
      );
      this.constraints.push(a, b, d, stiff);
    };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = this.idx(i, j);
        if (i + 1 < nx) push(k, this.idx(i + 1, j), 1.0);
        if (j + 1 < ny) push(k, this.idx(i, j + 1), 1.0);
        if (i + 1 < nx && j + 1 < ny) push(k, this.idx(i + 1, j + 1), 0.55);
        if (i > 0 && j + 1 < ny) push(k, this.idx(i - 1, j + 1), 0.55);
        if (i + 2 < nx) push(k, this.idx(i + 2, j), 0.22);   // bend
        if (j + 2 < ny) push(k, this.idx(i, j + 2), 0.22);
      }
    }
    this.constraints = new Float32Array(this.constraints);
  }

  // ---- pinning modes -------------------------------------------------------

  // Snap the sheet onto its current targets and kill any motion. Used when the
  // cloth is (re)hung on the frame: without it the solver starts from whatever
  // crumpled pose it was in and can settle into a permanent buckle.
  resetPose() {
    for (let k = 0; k < this.count; k++) {
      const o = k * 3;
      for (let c = 0; c < 3; c++) {
        this.pos[o + c] = this.target[o + c];
        this.prev[o + c] = this.target[o + c];
      }
    }
    this.computeNormals();
  }

  // Stretched over the gawangan bar, ready to be drawn on.
  setFrameMode(centre, tilt = 0, snap = true) {
    const { nx, ny, size } = this;
    this.pin.fill(0);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = this.idx(i, j);
        const x = this.rest[k * 3], y = this.rest[k * 3 + 1];
        // Slightly slack vertically so the sheet keeps soft folds, and tilted
        // back at the top so the light rakes across the surface.
        const ty = y * ct * 0.975;
        const tz = -y * st;
        this.target[k * 3] = centre[0] + x;
        this.target[k * 3 + 1] = centre[1] + ty;
        this.target[k * 3 + 2] = centre[2] + tz;
        if (j === ny - 1) this.pin[k] = 1;                        // over the bar
        else if (j === 0) this.pin[k] = (i === 0 || i === nx - 1) ? 0.85 : 0.30;
        else if (i === 0 || i === nx - 1) this.pin[k] = 0.16;      // side pegs
      }
    }
    this.frameCentre = V3.copy(V3.create(), centre);
    this.size3 = size;
    if (snap) this.resetPose();
  }

  // Gripped at the two top corners by the artisan's handles.
  setGripMode(leftPos, rightPos) {
    const { nx, ny } = this;
    this.pin.fill(0);
    const kL = this.idx(0, ny - 1), kR = this.idx(nx - 1, ny - 1);
    this.pin[kL] = 1; this.pin[kR] = 1;
    for (let c = 0; c < 3; c++) {
      this.target[kL * 3 + c] = leftPos[c];
      this.target[kR * 3 + c] = rightPos[c];
    }
    // A couple of neighbours are held softly so the top edge does not pinch.
    for (const [i, w] of [[1, 0.5], [2, 0.22]]) {
      const a = this.idx(i, ny - 1), b = this.idx(nx - 1 - i, ny - 1);
      this.pin[a] = w; this.pin[b] = w;
      for (let c = 0; c < 3; c++) {
        this.target[a * 3 + c] = lerp(leftPos[c], rightPos[c], i / (nx - 1));
        this.target[b * 3 + c] = lerp(leftPos[c], rightPos[c], (nx - 1 - i) / (nx - 1));
      }
    }
  }

  // Accordion-folded, waiting to be shaken open.
  setFoldTargets(centre, fold) {
    const { nx, ny, size } = this;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = this.idx(i, j);
        const u = i / (nx - 1);
        const x = (u - 0.5) * size;
        const y = this.rest[k * 3 + 1];
        // Concertina: horizontal span collapses, pleats push out in Z.
        const pleats = 5.0;
        const phase = u * Math.PI * 2 * pleats;
        const squeezed = x * (1 - fold * 0.86);
        const z = Math.sin(phase) * 0.075 * fold;
        this.target[k * 3] = centre[0] + squeezed;
        this.target[k * 3 + 1] = centre[1] + y - fold * 0.05;
        this.target[k * 3 + 2] = centre[2] + z;
      }
    }
  }

  setPinRow(rowFromTop, weight) {
    const j = this.ny - 1 - rowFromTop;
    for (let i = 0; i < this.nx; i++) this.pin[this.idx(i, j)] = weight;
  }

  // ---- simulation ----------------------------------------------------------

  step(dt, opts = {}) {
    dt = Math.min(dt, 1 / 45);
    const n = this.count;
    const pos = this.pos, prev = this.prev;
    const wind = opts.wind === undefined ? 0.06 : opts.wind;
    this.windPhase += dt * 1.7;
    const liquidY = this.liquidY;
    const damp = opts.damp === undefined ? 0.018 : opts.damp;

    for (let k = 0; k < n; k++) {
      const o = k * 3;
      const wet = this.wet[k];
      const mass = 1 + wet * 1.5;          // soaked cloth is heavier
      let ax = 0, ay = GRAVITY, az = 0;

      // Gentle air movement so the sheet is never dead still.
      const px = pos[o], py = pos[o + 1];
      const w = Math.sin(this.windPhase + px * 3.1 + py * 2.2) * 0.5 + 0.5;
      az += wind * 6.0 * w;
      ax += wind * 1.5 * Math.sin(this.windPhase * 0.7 + py * 4.0);

      let dragK = damp + wet * 0.02;
      if (py < liquidY) {
        const depth = liquidY - py;
        ay += 5.6 * clamp(depth * 3.0, 0, 1);      // buoyancy
        dragK = 0.30;                              // liquid is thick
        az *= 0.2;
      }

      const vx = (pos[o] - prev[o]) * (1 - dragK);
      const vy = (pos[o + 1] - prev[o + 1]) * (1 - dragK);
      const vz = (pos[o + 2] - prev[o + 2]) * (1 - dragK);
      prev[o] = pos[o]; prev[o + 1] = pos[o + 1]; prev[o + 2] = pos[o + 2];
      pos[o] += vx + (ax / mass) * dt * dt;
      pos[o + 1] += vy + (ay / mass) * dt * dt;
      pos[o + 2] += vz + (az / mass) * dt * dt;
    }

    const iters = opts.iterations || 5;
    const C = this.constraints;
    for (let it = 0; it < iters; it++) {
      for (let c = 0; c < C.length; c += 4) {
        const a = C[c] * 3, b = C[c + 1] * 3, rest = C[c + 2], stiff = C[c + 3];
        const dx = pos[b] - pos[a];
        const dy = pos[b + 1] - pos[a + 1];
        const dz = pos[b + 2] - pos[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = ((d - rest) / d) * 0.5 * stiff;
        const ox = dx * diff, oy = dy * diff, oz = dz * diff;
        const wa = 1 - this.pin[C[c]], wb = 1 - this.pin[C[c + 1]];
        const tot = wa + wb || 1;
        const fa = (wa / tot) * 2, fb = (wb / tot) * 2;
        pos[a] += ox * fa; pos[a + 1] += oy * fa; pos[a + 2] += oz * fa;
        pos[b] -= ox * fb; pos[b + 1] -= oy * fb; pos[b + 2] -= oz * fb;
      }
      // Keep the sheet inside the tub it is being dipped into.
      if (this.vessel) {
        const ves = this.vessel;
        for (let k = 0; k < n; k++) {
          const o = k * 3;
          if (pos[o + 1] > ves.topY) continue;
          if (pos[o + 1] < ves.floorY) pos[o + 1] = ves.floorY;
          const dx = pos[o] - ves.x, dz = pos[o + 2] - ves.z;
          const d = Math.hypot(dx, dz);
          if (d > ves.r) {
            const f = ves.r / d;
            pos[o] = ves.x + dx * f;
            pos[o + 2] = ves.z + dz * f;
          }
        }
      }
      // Snap pinned particles back onto their targets.
      for (let k = 0; k < n; k++) {
        const p = this.pin[k];
        if (p <= 0) continue;
        const o = k * 3;
        pos[o] = lerp(pos[o], this.target[o], p);
        pos[o + 1] = lerp(pos[o + 1], this.target[o + 1], p);
        pos[o + 2] = lerp(pos[o + 2], this.target[o + 2], p);
      }
    }
    this.computeNormals();
  }

  // Blend the whole sheet toward its targets — used while folding/unfolding
  // so the shape is authored but the motion still comes from the sim.
  pullToTargets(amount) {
    const n = this.count;
    for (let k = 0; k < n; k++) {
      const o = k * 3;
      this.pos[o] = lerp(this.pos[o], this.target[o], amount);
      this.pos[o + 1] = lerp(this.pos[o + 1], this.target[o + 1], amount);
      this.pos[o + 2] = lerp(this.pos[o + 2], this.target[o + 2], amount);
    }
  }

  addImpulse(fn) {
    const n = this.count;
    for (let k = 0; k < n; k++) {
      const o = k * 3;
      const i = k % this.nx, j = (k / this.nx) | 0;
      const f = fn(i / (this.nx - 1), j / (this.ny - 1));
      if (!f) continue;
      this.prev[o] -= f[0];
      this.prev[o + 1] -= f[1];
      this.prev[o + 2] -= f[2];
    }
  }

  computeNormals() {
    const { nx, ny, pos, normal } = this;
    normal.fill(0);
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = this.idx(i, j) * 3;
        const b = this.idx(i + 1, j) * 3;
        const c = this.idx(i, j + 1) * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        const nxv = uy * vz - uz * vy;
        const nyv = uz * vx - ux * vz;
        const nzv = ux * vy - uy * vx;
        for (const k of [a, b, c, this.idx(i + 1, j + 1) * 3]) {
          normal[k] += nxv; normal[k + 1] += nyv; normal[k + 2] += nzv;
        }
      }
    }
    for (let k = 0; k < this.count; k++) {
      const o = k * 3;
      const l = Math.hypot(normal[o], normal[o + 1], normal[o + 2]) || 1;
      normal[o] /= l; normal[o + 1] /= l; normal[o + 2] /= l;
    }
  }

  // Mark how much dye each vertex has taken on (drives weight and sheen).
  soak(frontV, amount) {
    for (let j = 0; j < this.ny; j++) {
      const v = j / (this.ny - 1);
      if (v > frontV) continue;
      for (let i = 0; i < this.nx; i++) {
        const k = this.idx(i, j);
        this.wet[k] = Math.min(1, this.wet[k] + amount);
      }
    }
  }

  dryOff(dt) {
    for (let k = 0; k < this.count; k++) {
      this.wet[k] = Math.max(0, this.wet[k] - dt * 0.25);
    }
  }

  // ---- picking -------------------------------------------------------------

  // Ray/cloth intersection. Returns {u,v,point} of the closest hit or null.
  raycast(ro, rd) {
    const { nx, ny, pos } = this;
    let best = Infinity, bu = 0, bv = 0;
    const hit = V3.create();
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const i00 = this.idx(i, j) * 3;
        const i10 = this.idx(i + 1, j) * 3;
        const i01 = this.idx(i, j + 1) * 3;
        const i11 = this.idx(i + 1, j + 1) * 3;
        for (const tri of [[i00, i10, i11], [i00, i11, i01]]) {
          const t = rayTri(ro, rd, pos, tri[0], tri[1], tri[2]);
          if (t && t.t < best && t.t > 0.001) {
            best = t.t;
            // Barycentric weights back to grid uv.
            const uvs = tri.map((o) => {
              const k = o / 3;
              return [(k % nx) / (nx - 1), ((k / nx) | 0) / (ny - 1)];
            });
            bu = uvs[0][0] * (1 - t.u - t.v) + uvs[1][0] * t.u + uvs[2][0] * t.v;
            bv = uvs[0][1] * (1 - t.u - t.v) + uvs[1][1] * t.u + uvs[2][1] * t.v;
            V3.set(hit, ro[0] + rd[0] * t.t, ro[1] + rd[1] * t.t, ro[2] + rd[2] * t.t);
          }
        }
      }
    }
    if (best === Infinity) return null;
    return { u: clamp(bu, 0, 1), v: clamp(bv, 0, 1), point: hit, t: best };
  }

  // World position for a uv on the current (deformed) sheet.
  pointAt(u, v, out = V3.create()) {
    const fi = clamp(u, 0, 1) * (this.nx - 1);
    const fj = clamp(v, 0, 1) * (this.ny - 1);
    const i = Math.min(this.nx - 2, Math.floor(fi));
    const j = Math.min(this.ny - 2, Math.floor(fj));
    const tu = fi - i, tv = fj - j;
    const p = this.pos;
    const a = this.idx(i, j) * 3, b = this.idx(i + 1, j) * 3;
    const c = this.idx(i, j + 1) * 3, d = this.idx(i + 1, j + 1) * 3;
    for (let k = 0; k < 3; k++) {
      const top = lerp(p[a + k], p[b + k], tu);
      const bot = lerp(p[c + k], p[d + k], tu);
      out[k] = lerp(top, bot, tv);
    }
    return out;
  }

  normalAt(u, v, out = V3.create()) {
    const i = Math.round(clamp(u, 0, 1) * (this.nx - 1));
    const j = Math.round(clamp(v, 0, 1) * (this.ny - 1));
    const o = this.idx(i, j) * 3;
    return V3.set(out, this.normal[o], this.normal[o + 1], this.normal[o + 2]);
  }

  bounds() {
    let minY = Infinity, maxY = -Infinity;
    for (let k = 0; k < this.count; k++) {
      const y = this.pos[k * 3 + 1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { minY, maxY };
  }

  buildMeshData() {
    const { nx, ny } = this;
    const index = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = this.idx(i, j), b = this.idx(i + 1, j);
        const c = this.idx(i, j + 1), d = this.idx(i + 1, j + 1);
        index.push(a, b, d, a, d, c);
      }
    }
    return {
      position: { data: this.pos, size: 3, dynamic: true },
      normal: { data: this.normal, size: 3, dynamic: true },
      uv: { data: this.uv, size: 2 },
      index: nx * ny > 65535 ? new Uint32Array(index) : new Uint16Array(index),
    };
  }
}

function rayTri(ro, rd, P, a, b, c) {
  const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
  const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
  const px = rd[1] * e2z - rd[2] * e2y;
  const py = rd[2] * e2x - rd[0] * e2z;
  const pz = rd[0] * e2y - rd[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-9) return null;
  const inv = 1 / det;
  const tx = ro[0] - P[a], ty = ro[1] - P[a + 1], tz = ro[2] - P[a + 2];
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < -0.0001 || u > 1.0001) return null;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (rd[0] * qx + rd[1] * qy + rd[2] * qz) * inv;
  if (v < -0.0001 || u + v > 1.0001) return null;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return { t, u, v };
}
