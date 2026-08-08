// 金箔 — the gold leaf.
//
// Real 縁付金箔 is beaten down to roughly one ten-thousandth of a millimetre
// (~0.1 micron). At that thickness the sheet has effectively no stiffness and
// almost no mass: it answers to breath, it lifts at the corners on its own, it
// transmits green light, and a crease permanently changes how it catches a
// reflection. So it is modelled as a真 zero-thickness membrane: a 45x45 grid
// solved with a damped wave equation, plus a persistent crease field that the
// brush slowly irons out.

import { mat4, vec3, clamp, lerp, damp, fbm2, valueNoise2 } from '../core/math.js';
import * as GL from '../core/gl.js';
import { baseHeight, BASE_RADIUS, LEAF_SIZE } from './props.js';

const N = 44;                 // quads per side -> 45x45 vertices
const HALF = LEAF_SIZE / 2;

export class GoldLeaf {
  constructor(gl) {
    this.gl = gl;
    this.n = N;
    this.dim = N + 1;
    const count = this.dim * this.dim;
    this.count = count;

    this.h = new Float32Array(count);       // displacement along the surface normal
    this.vel = new Float32Array(count);
    this.crease = new Float32Array(count);  // permanent wrinkle field, 0..1
    this.slack = new Float32Array(count);
    this.px = new Float32Array(count);      // local target surface
    this.py = new Float32Array(count);
    this.pz = new Float32Array(count);
    this.wx = new Float32Array(count);      // final local positions
    this.wy = new Float32Array(count);
    this.wz = new Float32Array(count);

    this.data = new Float32Array(count * 9);
    const idx = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * this.dim + i, b = a + this.dim;
        idx.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
    this.mesh = GL.createMesh(gl, this.data, new Uint32Array(idx), true);

    this.model = mat4.create();
    this.pos = vec3.create(0, 0, 0);
    this.posTarget = vec3.create(0, 0, 0);
    this.rot = vec3.create(0, 0, 0);
    this.rotTarget = vec3.create(0, 0, 0);
    this.velWorld = vec3.create(0, 0, 0);
    this._inv = mat4.create();
    this._lp = vec3.create();
    this._ld = vec3.create();
    this._node = {
      mesh: this.mesh, model: this.model, visible: false, castShadow: true,
      uniforms: { uWrinkle: 0.5, uAdhesion: 0, uSparkle: 0, uSweep: 0, uOpacity: 1 },
    };

    this.mode = 'hidden';       // hidden | flat | free | landing | onBase
    this.conform = 0;           // 0 flat, 1 wrapped onto the base
    this.adhesion = 0;          // 0 loose, 1 burnished down
    this.opacity = 1;
    this.sparkle = 0;
    this.sweep = 0;
    this.baseKind = 0;
    this.liftAmp = 1;
    this.visible = false;

    this.reset();
  }

  reset() {
    this.h.fill(0);
    this.vel.fill(0);
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * this.dim + i;
        // Freshly separated leaf carries the memory of the beating papers:
        // a fine, slightly directional crumple.
        const c = fbm2(i * 0.16, j * 0.14, 4) * 0.75 + valueNoise2(i * 0.42, j * 0.05) * 0.25;
        this.crease[k] = clamp((c - 0.28) * 1.5, 0, 1);
      }
    }
    this.conform = 0;
    this.adhesion = 0;
    this.opacity = 1;
    this.sparkle = 0;
    this.sweep = 0;
    this.liftAmp = 1;
    vec3.set(this.velWorld, 0, 0, 0);
  }

  get wrinkleAmount() {
    let s = 0;
    for (let k = 0; k < this.count; k++) s += this.crease[k];
    return s / this.count;
  }

  place(x, y, z, rx = 0, ry = 0, rz = 0) {
    vec3.set(this.pos, x, y, z);
    vec3.set(this.posTarget, x, y, z);
    vec3.set(this.rot, rx, ry, rz);
    vec3.set(this.rotTarget, rx, ry, rz);
  }

  /**
   * A puff of air. `worldPoint` is where the moving finger/breath is, `dir` the
   * direction it travels. Strength is in metres/second of induced vertical motion.
   */
  gust(worldPoint, dir, strength, radius = 0.05) {
    if (!this.visible) return;
    const inv = mat4.invert(this._inv, this.model);
    const lp = mat4.transformPoint(this._lp, inv, worldPoint);
    const ld = mat4.transformDir(this._ld, inv, dir);
    const r2 = radius * radius;
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * this.dim + i;
        const x = (i / N - 0.5) * LEAF_SIZE;
        const z = (j / N - 0.5) * LEAF_SIZE;
        const dx = x - lp[0], dz = z - lp[2];
        const d2 = dx * dx + dz * dz;
        const f = Math.exp(-d2 / r2);
        // lift in front of the stroke, suck down behind it
        const along = (dx * ld[0] + dz * ld[2]) / (Math.sqrt(d2) + 1e-4);
        this.vel[k] += strength * f * (0.65 + 0.55 * along) * (1 - this.adhesion * 0.9);
      }
    }
    // the whole sheet is light enough to be pushed bodily
    const push = strength * 0.0016 * (1 - this.adhesion);
    if (this.mode === 'free') {
      this.velWorld[0] += ld[0] * push * 8;
      this.velWorld[2] += ld[2] * push * 8;
      this.rotTarget[2] = clamp(this.rotTarget[2] - ld[0] * push * 12, -0.5, 0.5);
      this.rotTarget[0] = clamp(this.rotTarget[0] + ld[2] * push * 12, -0.5, 0.5);
    }
  }

  /** Brush stroke: presses the leaf down and irons creases out along the path. */
  burnish(worldPoint, amount = 1, radius = 0.030) {
    const inv = mat4.invert(this._inv, this.model);
    const lp = mat4.transformPoint(this._lp, inv, worldPoint);
    const r2 = radius * radius;
    let removed = 0;
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * this.dim + i;
        const x = (i / N - 0.5) * LEAF_SIZE;
        const z = (j / N - 0.5) * LEAF_SIZE;
        const d2 = (x - lp[0]) * (x - lp[0]) + (z - lp[2]) * (z - lp[2]);
        const f = Math.exp(-d2 / r2);
        if (f < 0.01) continue;
        const before = this.crease[k];
        this.crease[k] = Math.max(0, before - f * amount * 0.55);
        removed += before - this.crease[k];
        this.h[k] *= 1 - f * 0.6;
        this.vel[k] *= 1 - f * 0.7;
      }
    }
    return removed / this.count;
  }

  /** Local target surface: flat sheet blended toward the base object's skin. */
  _buildTarget() {
    const kind = this.baseKind;
    const R = BASE_RADIUS[kind];
    const c = this.conform;
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * this.dim + i;
        const x = (i / N - 0.5) * LEAF_SIZE;
        const z = (j / N - 0.5) * LEAF_SIZE;
        let y = 0;
        if (c > 0.001) {
          const r = Math.hypot(x, z);
          if (r <= R) {
            y = baseHeight(kind, r);
          } else {
            // beyond the rim the leaf hangs, then settles onto the bench
            const over = r - R;
            const edge = baseHeight(kind, R);
            const slopeK = kind === 2 ? 26 : 9;
            y = Math.max(0.0004, edge - over * slopeK * (0.35 + 0.65 * Math.min(over / 0.02, 1)));
          }
          y *= c;
        }
        this.px[k] = x;
        this.py[k] = y;
        this.pz[k] = z;
      }
    }
  }

  update(dt, time) {
    if (!this.visible) return;
    const frame = Math.min(dt, 1 / 30);
    this._buildTarget();

    // --- damped wave equation over the membrane -------------------------
    // A ripple has to cross 109 mm of leaf in about a third of a second, which
    // needs a wave speed far above what a single frame step stays stable at —
    // hence fixed 1/240 s substeps.
    const SUB = 1 / 240;
    const steps = Math.max(1, Math.min(Math.ceil(frame / SUB), 8));
    const step = frame / steps;
    const c2 = 4000.0;                                    // in grid-cell units
    const damping = this.adhesion > 0.5 ? 16.0 : 4.5;
    const stiff = 34.0;
    const dim = this.dim;
    const h = this.h, vel = this.vel;

    // Resting shape: the corners and edges of a free leaf lift on their own.
    const lift = this.liftAmp * (1 - this.adhesion);
    const rest = this.rest || (this.rest = new Float32Array(this.count));
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const u = i / N - 0.5, v = j / N - 0.5;
        const rr = Math.max(Math.abs(u), Math.abs(v)) * 2;
        rest[j * dim + i] = lift *
          (Math.pow(rr, 6) * 0.0060 + Math.pow(Math.hypot(u, v) * 2, 8) * 0.0038);
      }
    }

    for (let s = 0; s < steps; s++) {
      for (let j = 0; j <= N; j++) {
        for (let i = 0; i <= N; i++) {
          const k = j * dim + i;
          const hl = i > 0 ? h[k - 1] : h[k];
          const hr = i < N ? h[k + 1] : h[k];
          const hd = j > 0 ? h[k - dim] : h[k];
          const hu = j < N ? h[k + dim] : h[k];
          const lap = hl + hr + hd + hu - 4 * h[k];
          vel[k] += (lap * c2 - (h[k] - rest[k]) * stiff - vel[k] * damping) * step;
        }
      }
      for (let k = 0; k < this.count; k++) {
        h[k] += vel[k] * step;
        // A sheet this thin still cannot billow like cloth: 16 mm of relief on
        // a 109 mm leaf is already a dramatic wave.
        if (h[k] > 0.016) { h[k] = 0.016; vel[k] *= 0.1; }
        if (h[k] < -0.010) { h[k] = -0.010; vel[k] *= 0.1; }
        if (this.adhesion > 0.6 && h[k] < 0) h[k] *= 0.3; // pressed onto the base
      }
    }

    // --- ambient air: the room is never perfectly still -------------------
    if (this.adhesion < 0.9) {
      const amp = 0.75 * (1 - this.adhesion) * frame;
      for (let j = 0; j <= N; j += 2) {
        for (let i = 0; i <= N; i += 2) {
          const k = j * dim + i;
          vel[k] += Math.sin(time * 1.7 + i * 0.22 + j * 0.17) * amp
            + Math.sin(time * 0.9 - i * 0.11 + j * 0.31) * amp * 0.7;
        }
      }
    }

    // --- rigid-body drift of an almost weightless sheet -------------------
    if (this.mode === 'free' || this.mode === 'landing') {
      this.pos[0] += this.velWorld[0] * step;
      this.pos[1] += this.velWorld[1] * step;
      this.pos[2] += this.velWorld[2] * step;
      // huge drag, tiny gravity: it sinks like a feather
      const drag = Math.exp(-3.2 * step);
      this.velWorld[0] *= drag;
      this.velWorld[2] *= drag;
      this.velWorld[1] = this.velWorld[1] * drag - 0.045 * step;
      this.pos[0] = damp(this.pos[0], this.posTarget[0], 4.5, step);
      this.pos[1] = damp(this.pos[1], this.posTarget[1], 3.2, step);
      this.pos[2] = damp(this.pos[2], this.posTarget[2], 4.5, step);
      // it never travels flat — always canted, always wobbling
      this.rotTarget[0] = Math.sin(time * 0.9) * 0.07 + this.rotTarget[0] * 0.92;
      this.rotTarget[2] = Math.cos(time * 1.15) * 0.06 + this.rotTarget[2] * 0.92;
    } else {
      this.pos[0] = damp(this.pos[0], this.posTarget[0], 8, step);
      this.pos[1] = damp(this.pos[1], this.posTarget[1], 8, step);
      this.pos[2] = damp(this.pos[2], this.posTarget[2], 8, step);
    }
    for (let i = 0; i < 3; i++) this.rot[i] = damp(this.rot[i], this.rotTarget[i], 5, step);
    mat4.fromTRS(this.model, this.pos, this.rot, [1, 1, 1]);

    this._writeVertices(time);
  }

  _writeVertices(time) {
    const dim = this.dim, data = this.data;
    const wx = this.wx, wy = this.wy, wz = this.wz;
    // crease displacement is sub-millimetre: enough to bend a reflection, not
    // enough to look like crumpled foil
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * dim + i;
        const cr = this.crease[k];
        const wob = cr * 0.0013 * (1 - this.adhesion * 0.55);
        wx[k] = this.px[k];
        wy[k] = this.py[k] + this.h[k] + wob;
        wz[k] = this.pz[k];
        this.slack[k] = clamp(cr * 0.8 + Math.abs(this.h[k]) * 40, 0, 1.6);
      }
    }
    let creaseSum = 0;
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * dim + i;
        creaseSum += this.crease[k];
        const kl = i > 0 ? k - 1 : k, kr = i < N ? k + 1 : k;
        const kd = j > 0 ? k - dim : k, ku = j < N ? k + dim : k;
        const ax = wx[kr] - wx[kl], ay = wy[kr] - wy[kl], az = wz[kr] - wz[kl];
        const bx = wx[ku] - wx[kd], by = wy[ku] - wy[kd], bz = wz[ku] - wz[kd];
        let nx = ay * bz - az * by;
        let ny = az * bx - ax * bz;
        let nz = ax * by - ay * bx;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l; ny /= l; nz /= l;
        // grid winding gives -Y; flip so the front face points up
        const o = k * 9;
        data[o] = wx[k]; data[o + 1] = wy[k]; data[o + 2] = wz[k];
        data[o + 3] = -nx; data[o + 4] = -ny; data[o + 5] = -nz;
        data[o + 6] = i / N; data[o + 7] = j / N;
        data[o + 8] = this.slack[k];
      }
    }
    this.wrinkleAmountCached = creaseSum / this.count;
    GL.updateMesh(this.gl, this.mesh, data);
  }

  get renderNode() {
    const n = this._node;
    n.visible = this.visible;
    const u = n.uniforms;
    u.uWrinkle = clamp((this.wrinkleAmountCached ?? 0.35) * 2.2, 0, 1);
    u.uAdhesion = this.adhesion;
    u.uSparkle = this.sparkle;
    u.uSweep = this.sweep;
    u.uOpacity = this.opacity;
    return n;
  }
}
