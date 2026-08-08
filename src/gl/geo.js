/* =========================================================================
   geo.js — procedural geometry, in millimetres.
   Everything returns { pos, nrm, uv, ao, idx } and can be transformed and
   merged, so a whole prop collapses into one draw call.
   ========================================================================= */
'use strict';

const Geo = {
  /* -------------------------------------------------------------- helpers */
  empty() {
    return { pos: [], nrm: [], uv: [], ao: [], idx: [] };
  },
  finish(m) {
    return {
      pos: new Float32Array(m.pos), nrm: new Float32Array(m.nrm),
      uv: new Float32Array(m.uv), ao: new Float32Array(m.ao),
      idx: new Uint32Array(m.idx)
    };
  },
  /** append b into a, optionally transformed by mat4 */
  add(a, b, mat) {
    const base = a.pos.length / 3;
    const n = b.pos.length / 3;
    if (mat) {
      const nm = M4.normalMat(new Float32Array(9), mat);
      for (let i = 0; i < n; i++) {
        const x = b.pos[i * 3], y = b.pos[i * 3 + 1], z = b.pos[i * 3 + 2];
        a.pos.push(mat[0] * x + mat[4] * y + mat[8] * z + mat[12],
                   mat[1] * x + mat[5] * y + mat[9] * z + mat[13],
                   mat[2] * x + mat[6] * y + mat[10] * z + mat[14]);
        const nx = b.nrm[i * 3], ny = b.nrm[i * 3 + 1], nz = b.nrm[i * 3 + 2];
        let ox = nm[0] * nx + nm[3] * ny + nm[6] * nz;
        let oy = nm[1] * nx + nm[4] * ny + nm[7] * nz;
        let oz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
        const l = Math.hypot(ox, oy, oz) || 1;
        a.nrm.push(ox / l, oy / l, oz / l);
      }
    } else {
      for (let i = 0; i < n * 3; i++) { a.pos.push(b.pos[i]); a.nrm.push(b.nrm[i]); }
    }
    for (let i = 0; i < n * 2; i++) a.uv.push(b.uv[i]);
    for (let i = 0; i < n; i++) a.ao.push(b.ao ? b.ao[i] : 1);
    for (let i = 0; i < b.idx.length; i++) a.idx.push(b.idx[i] + base);
    return a;
  },
  /** multiply every vertex's baked ambient-occlusion term */
  shade(m, f) {
    for (let i = 0; i < m.ao.length; i++) m.ao[i] *= f;
    return m;
  },
  /** darken vertices near a horizontal plane — cheap, reliable contact grounding */
  groundAO(m, planeY, reach, strength) {
    for (let i = 0; i < m.ao.length; i++) {
      const y = m.pos[i * 3 + 1];
      const d = Math.abs(y - planeY);
      const k = 1 - Math.min(1, d / reach);
      m.ao[i] *= 1 - k * k * strength;
    }
    return m;
  },

  T: M4.make(),
  mat(tx, ty, tz, rx, ry, rz, s) {
    return M4.compose(M4.make(), tx, ty, tz, rx || 0, ry || 0, rz || 0,
                      s === undefined ? 1 : s, s === undefined ? 1 : s, s === undefined ? 1 : s);
  },

  /* ------------------------------------------------------------ primitives */

  /**
   * Rounded box built by projecting a subdivided cube onto the rounded-box
   * surface, so fillets are exact and normals are clean.  Real objects have
   * no infinitely sharp edges; this is what makes them catch light.
   */
  roundBox(w, h, d, r, seg) {
    seg = seg || 10;
    const ex = w / 2, ey = h / 2, ez = d / 2;
    r = Math.min(r, ex * 0.99, ey * 0.99, ez * 0.99);
    const ix = ex - r, iy = ey - r, iz = ez - r;
    const m = this.empty();
    const faces = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]],   // +x
      [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], // -x
      [[0, 1, 0], [0, 0, 1], [1, 0, 0]],   // +y
      [[0, -1, 0], [0, 0, -1], [1, 0, 0]], // -y
      [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],  // +z
      [[0, 0, -1], [0, 1, 0], [1, 0, 0]]   // -z
    ];
    for (const f of faces) {
      const [n, u, v] = f;
      const base = m.pos.length / 3;
      for (let j = 0; j <= seg; j++) {
        for (let i = 0; i <= seg; i++) {
          // biased sampling so more vertices land near the fillets
          const su = this.edgeBias(i / seg), sv = this.edgeBias(j / seg);
          const a = (su * 2 - 1), b = (sv * 2 - 1);
          const px = n[0] * ex + u[0] * a * (u[0] ? ex : u[1] ? ey : ez) + v[0] * b * (v[0] ? ex : v[1] ? ey : ez);
          const py = n[1] * ey + u[1] * a * (u[0] ? ex : u[1] ? ey : ez) + v[1] * b * (v[0] ? ex : v[1] ? ey : ez);
          const pz = n[2] * ez + u[2] * a * (u[0] ? ex : u[1] ? ey : ez) + v[2] * b * (v[0] ? ex : v[1] ? ey : ez);
          // project onto the rounded surface
          const cx = Math.max(-ix, Math.min(ix, px));
          const cy = Math.max(-iy, Math.min(iy, py));
          const cz = Math.max(-iz, Math.min(iz, pz));
          let dx = px - cx, dy = py - cy, dz = pz - cz;
          const l = Math.hypot(dx, dy, dz) || 1;
          dx /= l; dy /= l; dz /= l;
          m.pos.push(cx + dx * r, cy + dy * r, cz + dz * r);
          m.nrm.push(dx, dy, dz);
          m.uv.push(su, sv);
          m.ao.push(1);
        }
      }
      for (let j = 0; j < seg; j++) {
        for (let i = 0; i < seg; i++) {
          const a = base + j * (seg + 1) + i, b2 = a + 1;
          const c = a + seg + 1, d2 = c + 1;
          m.idx.push(a, b2, c, b2, d2, c);
        }
      }
    }
    return m;
  },
  /** push samples toward the ends of 0..1 so fillets get more vertices */
  edgeBias(t) {
    const s = t * 2 - 1;
    return (Math.sign(s) * Math.pow(Math.abs(s), 0.72) + 1) / 2;
  },

  /**
   * Lathe a profile around +Y.
   * profile: [ [r, y, sharp?], ... ] bottom to top. `sharp` duplicates the
   * ring so the edge stays crisp (a machined chamfer, not a soft blob).
   */
  lathe(profile, seg, capBottom, capTop, uScale) {
    seg = seg || 48;
    const m = this.empty();
    const P = profile;
    const rings = [];
    for (let i = 0; i < P.length; i++) {
      const cur = P[i];
      const prev = P[i - 1], next = P[i + 1];
      // tangent from neighbours; a sharp point gets one normal per side
      const mk = (a, b) => {
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const l = Math.hypot(tx, ty) || 1;
        return [ty / l, -tx / l];              // outward normal
      };
      if (cur[2] && prev && next) {
        rings.push({ r: cur[0], y: cur[1], n: mk(prev, cur), v: i / (P.length - 1) });
        rings.push({ r: cur[0], y: cur[1], n: mk(cur, next), v: i / (P.length - 1) });
      } else {
        let n;
        if (!prev) n = mk(cur, next);
        else if (!next) n = mk(prev, cur);
        else {
          const a = mk(prev, cur), b = mk(cur, next);
          const nx = a[0] + b[0], ny = a[1] + b[1];
          const l = Math.hypot(nx, ny) || 1;
          n = [nx / l, ny / l];
        }
        rings.push({ r: cur[0], y: cur[1], n, v: i / (P.length - 1) });
      }
    }
    const us = uScale || 1;
    for (const ring of rings) {
      for (let s = 0; s <= seg; s++) {
        const a = s / seg * TAU;
        const ca = Math.cos(a), sa = Math.sin(a);
        m.pos.push(ring.r * ca, ring.y, ring.r * sa);
        m.nrm.push(ring.n[0] * ca, ring.n[1], ring.n[0] * sa);
        m.uv.push(s / seg * us, ring.v);
        m.ao.push(1);
      }
    }
    for (let i = 0; i < rings.length - 1; i++) {
      if (rings[i].y === rings[i + 1].y && rings[i].r === rings[i + 1].r) continue; // sharp seam
      for (let s = 0; s < seg; s++) {
        const a = i * (seg + 1) + s, b = a + 1;
        const c = a + seg + 1, d = c + 1;
        m.idx.push(a, c, b, b, c, d);
      }
    }
    if (capBottom) this.add(m, this.disc(P[0][0], seg, -1), this.mat(0, P[0][1], 0));
    if (capTop) this.add(m, this.disc(P[P.length - 1][0], seg, 1), this.mat(0, P[P.length - 1][1], 0));
    return m;
  },

  disc(r, seg, dir) {
    seg = seg || 48; dir = dir || 1;
    const m = this.empty();
    m.pos.push(0, 0, 0); m.nrm.push(0, dir, 0); m.uv.push(0.5, 0.5); m.ao.push(1);
    for (let s = 0; s <= seg; s++) {
      const a = s / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
      m.pos.push(r * ca, 0, r * sa);
      m.nrm.push(0, dir, 0);
      m.uv.push(0.5 + ca * 0.5, 0.5 + sa * 0.5);
      m.ao.push(1);
    }
    for (let s = 0; s < seg; s++) {
      if (dir > 0) m.idx.push(0, s + 2, s + 1);
      else m.idx.push(0, s + 1, s + 2);
    }
    return m;
  },

  /** annulus in the XZ plane (gasket faces, saucer rings) */
  ring(r0, r1, seg, dir) {
    seg = seg || 48; dir = dir || 1;
    const m = this.empty();
    for (let s = 0; s <= seg; s++) {
      const a = s / seg * TAU, ca = Math.cos(a), sa = Math.sin(a);
      m.pos.push(r0 * ca, 0, r0 * sa); m.nrm.push(0, dir, 0); m.uv.push(s / seg, 0); m.ao.push(1);
      m.pos.push(r1 * ca, 0, r1 * sa); m.nrm.push(0, dir, 0); m.uv.push(s / seg, 1); m.ao.push(1);
    }
    for (let s = 0; s < seg; s++) {
      const a = s * 2, b = a + 1, c = a + 2, d = a + 3;
      if (dir > 0) m.idx.push(a, c, b, b, c, d);
      else m.idx.push(a, b, c, b, d, c);
    }
    return m;
  },

  cyl(r0, r1, h, seg, caps) {
    const p = [[r0, 0], [r1, h]];
    const m = this.lathe(p, seg || 32, false, false);
    if (caps) {
      this.add(m, this.disc(r0, seg || 32, -1), this.mat(0, 0, 0));
      this.add(m, this.disc(r1, seg || 32, 1), this.mat(0, h, 0));
    }
    return m;
  },

  torus(R, r, segU, segV, arc) {
    segU = segU || 48; segV = segV || 16; arc = arc === undefined ? TAU : arc;
    const m = this.empty();
    for (let i = 0; i <= segU; i++) {
      const u = i / segU * arc, cu = Math.cos(u), su = Math.sin(u);
      for (let j = 0; j <= segV; j++) {
        const v = j / segV * TAU, cv = Math.cos(v), sv = Math.sin(v);
        m.pos.push((R + r * cv) * cu, r * sv, (R + r * cv) * su);
        m.nrm.push(cv * cu, sv, cv * su);
        m.uv.push(i / segU, j / segV);
        m.ao.push(1);
      }
    }
    for (let i = 0; i < segU; i++) {
      for (let j = 0; j < segV; j++) {
        const a = i * (segV + 1) + j, b = a + 1, c = a + segV + 1, d = c + 1;
        m.idx.push(a, b, c, b, d, c);
      }
    }
    return m;
  },

  sphere(r, segU, segV) {
    segU = segU || 32; segV = segV || 20;
    const m = this.empty();
    for (let j = 0; j <= segV; j++) {
      const p = j / segV * Math.PI, sp = Math.sin(p), cp = Math.cos(p);
      for (let i = 0; i <= segU; i++) {
        const t = i / segU * TAU, st = Math.sin(t), ct = Math.cos(t);
        const x = sp * ct, y = cp, z = sp * st;
        m.pos.push(x * r, y * r, z * r);
        m.nrm.push(x, y, z);
        m.uv.push(i / segU, j / segV);
        m.ao.push(1);
      }
    }
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
        m.idx.push(a, b, c, b, d, c);
      }
    }
    return m;
  },

  /**
   * Sweep a circular (or rounded-rect) section along a polyline using
   * parallel-transport frames — used for the steam wand, cup handles, tubing.
   */
  tube(pts, radius, seg, sect) {
    seg = seg || 16;
    const m = this.empty();
    const n = pts.length;
    // frames
    let up = [0, 1, 0];
    const frames = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
      // side = up x t
      let sx = up[1] * tz - up[2] * ty, sy = up[2] * tx - up[0] * tz, sz = up[0] * ty - up[1] * tx;
      let sl = Math.hypot(sx, sy, sz);
      if (sl < 1e-4) { up = [1, 0, 0]; sx = up[1] * tz - up[2] * ty; sy = up[2] * tx - up[0] * tz; sz = up[0] * ty - up[1] * tx; sl = Math.hypot(sx, sy, sz) || 1; }
      sx /= sl; sy /= sl; sz /= sl;
      const ux = ty * sz - tz * sy, uy = tz * sx - tx * sz, uz = tx * sy - ty * sx;
      up = [ux, uy, uz];
      frames.push({ t: [tx, ty, tz], s: [sx, sy, sz], u: [ux, uy, uz] });
    }
    for (let i = 0; i < n; i++) {
      const f = frames[i];
      const r = typeof radius === 'function' ? radius(i / (n - 1)) : radius;
      for (let j = 0; j <= seg; j++) {
        const a = j / seg * TAU;
        let ca = Math.cos(a), sa = Math.sin(a);
        let rx = r, ry = r;
        if (sect) { rx = sect[0]; ry = sect[1]; ca = Math.sign(ca) * Math.pow(Math.abs(ca), 0.6); sa = Math.sign(sa) * Math.pow(Math.abs(sa), 0.6); }
        const nx = f.s[0] * ca + f.u[0] * sa;
        const ny = f.s[1] * ca + f.u[1] * sa;
        const nz = f.s[2] * ca + f.u[2] * sa;
        m.pos.push(pts[i][0] + nx * rx, pts[i][1] + ny * ry, pts[i][2] + nz * rx);
        m.nrm.push(nx, ny, nz);
        m.uv.push(j / seg, i / (n - 1));
        m.ao.push(1);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
        m.idx.push(a, b, c, b, d, c);
      }
    }
    return m;
  },

  /** sample a cubic bezier into a polyline for tube() */
  bezier(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
      out.push([p0[0] * a + p1[0] * b + p2[0] * c + p3[0] * d,
                p0[1] * a + p1[1] * b + p2[1] * c + p3[1] * d,
                p0[2] * a + p1[2] * b + p2[2] * c + p3[2] * d]);
    }
    return out;
  },

  /** flat quad in XZ, subdivided (floors, counters, walls after rotation) */
  plane(w, d, sx, sz, uvScale) {
    sx = sx || 1; sz = sz || 1;
    const us = uvScale || 1;
    const m = this.empty();
    for (let j = 0; j <= sz; j++) {
      for (let i = 0; i <= sx; i++) {
        const u = i / sx, v = j / sz;
        m.pos.push((u - 0.5) * w, 0, (v - 0.5) * d);
        m.nrm.push(0, 1, 0);
        m.uv.push(u * w / us, v * d / us);
        m.ao.push(1);
      }
    }
    for (let j = 0; j < sz; j++) {
      for (let i = 0; i < sx; i++) {
        const a = j * (sx + 1) + i, b = a + 1, c = a + sx + 1, d2 = c + 1;
        m.idx.push(a, c, b, b, c, d2);
      }
    }
    return m;
  },

  /** the profile of a cup/pitcher wall with real thickness: outside, rim, inside */
  vesselProfile(pts, thickness, innerFloor) {
    // pts: outer wall [r,y] bottom→top. Returns a closed lathe profile that
    // goes up the outside, over the rim and back down the inside.
    const out = pts.map(p => [p[0], p[1]]);
    const top = pts[pts.length - 1];
    out.push([top[0], top[1], 1]);
    const inner = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const r = Math.max(0.5, pts[i][0] - thickness);
      inner.push([r, Math.max(innerFloor, pts[i][1] - (i === 0 ? 0 : 0))]);
    }
    inner[0][2] = 1;
    for (const p of inner) out.push(p);
    out.push([0, innerFloor]);
    return out;
  }
};
