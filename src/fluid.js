/* =========================================================================
   fluid.js — the milk-on-crema surface
   A small Stam-style incompressible solver (advect / project) drives a milk
   density field.  Pouring injects milk + momentum, the finishing stroke
   blends the field toward a pretty template so a 4-year-old's scribble
   always resolves into a heart / leaf / tulip they can recognise as theirs.
   ========================================================================= */
'use strict';

const Fluid = {
  N: 90,
  u: null, v: null, u0: null, v0: null,
  m: null, m0: null, p: null, div: null,
  mask: null,                       // circular cup mask (1 inside)
  canvas: null, ctx: null, img: null,
  dirty: true,
  finishT: 0, finishTarget: null, finishing: false,
  poured: 0,                        // total milk injected (0..~1)
  seed: 0,

  init() {
    const N = this.N, S = N * N;
    this.u = new Float32Array(S); this.v = new Float32Array(S);
    this.u0 = new Float32Array(S); this.v0 = new Float32Array(S);
    this.m = new Float32Array(S); this.m0 = new Float32Array(S);
    this.p = new Float32Array(S); this.div = new Float32Array(S);
    this.mask = new Float32Array(S);
    this.tmp = new Float32Array(S);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N - 0.5, y = (j + 0.5) / N - 0.5;
      const r = Math.hypot(x, y);
      this.mask[i + j * N] = 1 - smoothstep(0.455, 0.5, r);
    }
    this.canvas = document.createElement('canvas');
    this.canvas.width = N; this.canvas.height = N;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(N, N);
    this.reset();
  },

  reset() {
    this.u.fill(0); this.v.fill(0); this.m.fill(0);
    this.finishT = 0; this.finishing = false; this.finishTarget = null;
    this.poured = 0; this.dirty = true;
    this.seed = Math.random() * 1000;
  },

  IX(i, j) { return i + j * this.N; },

  /* --------------------------------------------------------------- input */
  /**
   * Pour milk at normalised (x,y) in 0..1 cup space.
   * flow  : 0..1 how open the pitcher is
   * vx,vy : stream direction / wrist motion in cup-space units per second
   */
  pour(x, y, flow, vx, vy, dt) {
    if (this.finishing) return;
    const N = this.N;
    const gx = x * N, gy = y * N;
    const rad = 3.0 + flow * 2.2;
    const i0 = Math.max(1, Math.floor(gx - rad * 2)), i1 = Math.min(N - 2, Math.ceil(gx + rad * 2));
    const j0 = Math.max(1, Math.floor(gy - rad * 2)), j1 = Math.min(N - 2, Math.ceil(gy + rad * 2));
    const add = flow * dt * 12;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i + 0.5 - gx, dy = j + 0.5 - gy;
        const d2 = dx * dx + dy * dy;
        const g = Math.exp(-d2 / (rad * rad));
        if (g < 0.004) continue;
        const k = this.IX(i, j);
        // milk lands and spreads
        this.m[k] = Math.min(1.35, this.m[k] + add * g * 2.4);
        // the falling stream pushes the crema outward -> the white disc grows
        const dd = Math.sqrt(d2) + 0.001;
        const push = flow * g * 9 * dt * 60;
        this.u[k] += (dx / dd) * push * 0.010;
        this.v[k] += (dy / dd) * push * 0.010;
        // and carries the wrist motion with it
        this.u[k] += vx * g * dt * 3.2;
        this.v[k] += vy * g * dt * 3.2;
      }
    }
    this.poured = Math.min(1.6, this.poured + add * 0.5);
    this.dirty = true;
  },

  /** the finishing pull-through: a thin fast line that cuts the pattern */
  strokeThrough(x0, y0, x1, y1, strength) {
    const N = this.N;
    const steps = 26;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const gx = lerp(x0, x1, t) * N, gy = lerp(y0, y1, t) * N;
      const dx = (x1 - x0), dy = (y1 - y0);
      const len = Math.hypot(dx, dy) + 1e-5;
      const rad = 2.4;
      const i0 = Math.max(1, Math.floor(gx - rad * 2)), i1 = Math.min(N - 2, Math.ceil(gx + rad * 2));
      const j0 = Math.max(1, Math.floor(gy - rad * 2)), j1 = Math.min(N - 2, Math.ceil(gy + rad * 2));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const ddx = i + 0.5 - gx, ddy = j + 0.5 - gy;
        const g = Math.exp(-(ddx * ddx + ddy * ddy) / (rad * rad));
        if (g < 0.01) continue;
        const k = this.IX(i, j);
        this.m[k] = Math.min(1.3, this.m[k] + g * 0.10 * strength);
        this.u[k] += (dx / len) * g * 0.9 * strength;
        this.v[k] += (dy / len) * g * 0.9 * strength;
      }
    }
    this.dirty = true;
  },

  /** kick off the "and now it becomes a heart" convergence */
  finish(pattern, angle) {
    if (this.finishing) return;
    this.finishing = true;
    this.finishT = 0;
    this.finishTarget = this.buildMask(pattern, angle || 0);
  },

  /* -------------------------------------------------------------- solver */
  step(dt) {
    dt = Math.min(dt, 1 / 45);
    const N = this.N, S = N * N;

    // containment: keep the fluid inside the visible disc
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = this.IX(i, j);
      const x = (i + 0.5) / N - 0.5, y = (j + 0.5) / N - 0.5;
      const r = Math.hypot(x, y);
      if (r > 0.40) {
        const f = smoothstep(0.40, 0.49, r);
        const nx = x / (r + 1e-5), ny = y / (r + 1e-5);
        const vn = this.u[k] * nx + this.v[k] * ny;
        if (vn > 0) { this.u[k] -= nx * vn * f; this.v[k] -= ny * vn * f; }
        this.u[k] *= 1 - f * 0.5; this.v[k] *= 1 - f * 0.5;
      }
    }

    this.vorticity(dt);

    // velocity: advect then project
    this.u0.set(this.u); this.v0.set(this.v);
    this.advect(1, this.u, this.u0, this.u0, this.v0, dt);
    this.advect(2, this.v, this.v0, this.u0, this.v0, dt);
    this.project();

    // milk
    this.m0.set(this.m);
    this.advect(0, this.m, this.m0, this.u, this.v, dt);

    // damping — the surface settles, which is what real milk does
    const damp = Math.pow(0.30, dt);
    for (let k = 0; k < S; k++) {
      this.u[k] *= damp; this.v[k] *= damp;
      this.m[k] *= this.mask[k] > 0 ? 1 : 0.85;
    }

    // Convergence toward the pretty template.  The milk is pulled *both* ways:
    // up to full white inside the shape and down to a faint mottling outside,
    // so the picture resolves instead of staying a blob — but a little of the
    // player's own field survives as texture, which is what makes it theirs.
    if (this.finishing && this.finishTarget) {
      this.finishT = Math.min(1, this.finishT + dt / 0.72);
      const e = easeOutCubic(this.finishT);
      const tg = this.finishTarget;
      for (let k = 0; k < S; k++) {
        const personal = Math.min(0.22, this.m[k] * 0.16);
        const target = Math.min(1.2, tg[k] * 1.06 + personal * (1 - tg[k]));
        this.m[k] = lerp(this.m[k], target, e * 0.22);
        this.u[k] *= 1 - e * 0.10; this.v[k] *= 1 - e * 0.10;
      }
    }
    this.dirty = true;
  },

  vorticity(dt) {
    const N = this.N, eps = 0.22;
    const curl = this.tmp;
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      curl[this.IX(i, j)] =
        (this.v[this.IX(i + 1, j)] - this.v[this.IX(i - 1, j)]) * 0.5 -
        (this.u[this.IX(i, j + 1)] - this.u[this.IX(i, j - 1)]) * 0.5;
    }
    for (let j = 2; j < N - 2; j++) for (let i = 2; i < N - 2; i++) {
      const k = this.IX(i, j);
      const dx = (Math.abs(curl[this.IX(i + 1, j)]) - Math.abs(curl[this.IX(i - 1, j)])) * 0.5;
      const dy = (Math.abs(curl[this.IX(i, j + 1)]) - Math.abs(curl[this.IX(i, j - 1)])) * 0.5;
      const len = Math.hypot(dx, dy) + 1e-6;
      const f = eps * dt * 60 * 0.02;
      this.u[k] += (dy / len) * curl[k] * f;
      this.v[k] += -(dx / len) * curl[k] * f;
    }
  },

  advect(b, d, d0, u, v, dt) {
    const N = this.N, dt0 = dt * N;
    for (let j = 1; j < N - 1; j++) {
      for (let i = 1; i < N - 1; i++) {
        const k = i + j * N;
        let x = i - dt0 * u[k], y = j - dt0 * v[k];
        if (x < 0.5) x = 0.5; if (x > N - 1.5) x = N - 1.5;
        if (y < 0.5) y = 0.5; if (y > N - 1.5) y = N - 1.5;
        const i0 = x | 0, i1 = i0 + 1, j0 = y | 0, j1 = j0 + 1;
        const s1 = x - i0, s0 = 1 - s1, t1 = y - j0, t0 = 1 - t1;
        d[k] = s0 * (t0 * d0[i0 + j0 * N] + t1 * d0[i0 + j1 * N]) +
               s1 * (t0 * d0[i1 + j0 * N] + t1 * d0[i1 + j1 * N]);
      }
    }
    this.bnd(b, d);
  },

  project() {
    const N = this.N;
    const h = 1 / N;
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = i + j * N;
      this.div[k] = -0.5 * h * (this.u[k + 1] - this.u[k - 1] + this.v[k + N] - this.v[k - N]);
      this.p[k] = 0;
    }
    this.bnd(0, this.div); this.bnd(0, this.p);
    for (let it = 0; it < 12; it++) {
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        const k = i + j * N;
        this.p[k] = (this.div[k] + this.p[k - 1] + this.p[k + 1] + this.p[k - N] + this.p[k + N]) * 0.25;
      }
      this.bnd(0, this.p);
    }
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = i + j * N;
      this.u[k] -= 0.5 * (this.p[k + 1] - this.p[k - 1]) / h;
      this.v[k] -= 0.5 * (this.p[k + N] - this.p[k - N]) / h;
    }
    this.bnd(1, this.u); this.bnd(2, this.v);
  },

  bnd(b, x) {
    const N = this.N;
    for (let i = 1; i < N - 1; i++) {
      x[i] = b === 2 ? -x[i + N] : x[i + N];
      x[i + (N - 1) * N] = b === 2 ? -x[i + (N - 2) * N] : x[i + (N - 2) * N];
      x[i * N] = b === 1 ? -x[1 + i * N] : x[1 + i * N];
      x[N - 1 + i * N] = b === 1 ? -x[N - 2 + i * N] : x[N - 2 + i * N];
    }
    x[0] = 0.5 * (x[1] + x[N]);
    x[N - 1] = 0.5 * (x[N - 2] + x[N - 1 + N]);
    x[(N - 1) * N] = 0.5 * (x[1 + (N - 1) * N] + x[(N - 2) * N]);
    x[N - 1 + (N - 1) * N] = 0.5 * (x[N - 2 + (N - 1) * N] + x[N - 1 + (N - 2) * N]);
  },

  /* -------------------------------------------------------- art templates */
  /** normalised coords: (0,0) centre, y+ toward the near side of the cup */
  buildMask(pattern, rot) {
    const N = this.N, out = new Float32Array(N * N);
    const cr = Math.cos(-rot), sr = Math.sin(-rot);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let x = ((i + 0.5) / N - 0.5) * 2.2;     // -1.1 .. 1.1
        let y = ((j + 0.5) / N - 0.5) * 2.2;
        const rx = x * cr - y * sr, ry = x * sr + y * cr;
        let val = 0;
        if (pattern === 'heart') val = this.mHeart(rx, ry);
        else if (pattern === 'leaf') val = this.mLeaf(rx, ry);
        else val = this.mTulip(rx, ry);
        out[i + j * N] = sat(val) * this.mask[i + j * N];
      }
    }
    return out;
  },

  /** a fat, friendly heart: round lobes at the far side, tip toward the drinker */
  mHeart(x, y) {
    const s = 1.5;
    const X = x * s, Y = -y * s;          // grid y grows toward the drinker
    const a = X * X + Y * Y - 1;
    const f = a * a * a - X * X * Y * Y * Y;
    return smoothstep(0.05, -0.12, f);    // f < 0 is inside the curve
  },

  /** rosetta: a column of leaves with a stem pulled through the middle */
  mLeaf(x, y) {
    let val = 0;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const cy = lerp(-0.62, 0.60, t);
      const w = lerp(0.13, 0.52, Math.pow(t, 0.85));   // leaves widen toward the drinker
      const hgt = lerp(0.10, 0.185, t);
      // each leaf is a shallow crescent
      const bend = 0.30 * (1 - t);
      const yy = y - cy + Math.pow(x / (w + 1e-3), 2) * bend * 0.5;
      const d = (x * x) / (w * w) + (yy * yy) / (hgt * hgt);
      val = Math.max(val, smoothstep(1.15, 0.72, d));
    }
    // the pull-through stem
    const stem = smoothstep(0.075, 0.028, Math.abs(x)) * smoothstep(0.86, 0.72, Math.abs(y));
    val = Math.max(val, stem * 0.95);
    // little round head at the far end
    val = Math.max(val, smoothstep(0.15, 0.09, Math.hypot(x, y + 0.72)) * 0.95);
    return val;
  },

  /** tulip: three stacked blobs + stem */
  mTulip(x, y) {
    let val = 0;
    const blobs = [[0, 0.42, 0.36], [0, 0.02, 0.28], [0, -0.34, 0.20]];
    for (const b of blobs) {
      const dx = (x - b[0]) / b[2], dy = (y - b[1]) / (b[2] * 0.82);
      val = Math.max(val, smoothstep(1.2, 0.72, dx * dx + dy * dy));
    }
    const stem = smoothstep(0.07, 0.03, Math.abs(x)) * smoothstep(0.80, 0.60, Math.abs(y - 0.05));
    return Math.max(val, stem * 0.9);
  },

  /* ------------------------------------------------------------- rendering */
  /** returns the offscreen canvas holding the current surface */
  render(baseKind) {
    if (!this.dirty) return this.canvas;
    this.dirty = false;
    const N = this.N, d = this.img.data;
    // crema palette (or cocoa)
    let cr0, cg0, cb0, cr1, cg1, cb1;
    if (baseKind === 'cocoa') { cr0 = 132; cg0 = 84; cb0 = 62; cr1 = 168; cg1 = 116; cb1 = 88; }
    else if (baseKind === 'honey') { cr0 = 190; cg0 = 148; cb0 = 100; cr1 = 219; cg1 = 182; cb1 = 133; }
    else { cr0 = 148; cg0 = 96; cb0 = 50; cr1 = 205; cg1 = 152; cb1 = 92; }

    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = i + j * N;
        const mk = this.mask[k];
        const o = k * 4;
        const x = (i + 0.5) / N - 0.5, y = (j + 0.5) / N - 0.5;
        const r = Math.hypot(x, y) * 2;
        // crema base: brighter in the middle, darker toward the wall
        const shade = 1 - r * 0.42;
        let R = lerp(cr0, cr1, shade), G = lerp(cg0, cg1, shade), B = lerp(cb0, cb1, shade);
        // mottled crema grain
        const grain = Math.sin(i * 1.7 + this.seed) * Math.sin(j * 1.3 - this.seed * 0.7);
        R += grain * 8; G += grain * 6; B += grain * 4;

        const mv = this.m[k];
        // crisp milk edge with a soft outer halo — that's what latte art looks like
        const core = smoothstep(0.30, 0.46, mv);
        const halo = smoothstep(0.13, 0.32, mv) * 0.42;
        const a = sat(core + halo * (1 - core));
        if (a > 0.002) {
          // milk is warm white; the thinnest films read as caramel
          const wr = lerp(238, 255, core), wg = lerp(226, 250, core), wb = lerp(200, 240, core);
          R = lerp(R, wr, a); G = lerp(G, wg, a); B = lerp(B, wb, a);
        }
        d[o] = R < 0 ? 0 : R > 255 ? 255 : R;
        d[o + 1] = G < 0 ? 0 : G > 255 ? 255 : G;
        d[o + 2] = B < 0 ? 0 : B > 255 ? 255 : B;
        // Keep the canvas fully opaque: a 2D canvas stores premultiplied alpha,
        // so anything written to the alpha channel would destroy the crema
        // colour on readback.  The shader recovers milk coverage from the
        // blue/red ratio instead — milk is neutral, crema and cocoa are orange.
        d[o + 3] = 255;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas;
  },

  /** snapshot for the finished-drinks tray */
  snapshot(baseKind) {
    this.dirty = true;
    const src = this.render(baseKind);
    const c = document.createElement('canvas');
    c.width = this.N; c.height = this.N;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }
};
