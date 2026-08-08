/* 空港グランドハンドリング — ジオメトリ生成 */
(function (AG) {
  'use strict';
  const M = AG.M;
  const G = (AG.G = {});
  const TAU = Math.PI * 2;

  function mk() { return { p: [], n: [], u: [], i: [] }; }
  G.mk = mk;

  function vert(g, x, y, z, nx, ny, nz, u, v) {
    g.p.push(x, y, z); g.n.push(nx, ny, nz); g.u.push(u, v);
    return g.p.length / 3 - 1;
  }
  G.vert = vert;
  function tri(g, a, b, c) { g.i.push(a, b, c); }
  function quad(g, a, b, c, d) { g.i.push(a, b, c, a, c, d); }
  G.tri = tri; G.quad = quad;

  /* ---- 変換 ---- */
  G.xform = function (g, m) {
    const nm = M.normalMat(M.m3(), m);
    const p = g.p, n = g.n;
    for (let k = 0; k < p.length; k += 3) {
      const x = p[k], y = p[k + 1], z = p[k + 2];
      p[k] = m[0] * x + m[4] * y + m[8] * z + m[12];
      p[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      p[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const a = n[k], b = n[k + 1], c = n[k + 2];
      let nx = nm[0] * a + nm[3] * b + nm[6] * c;
      let ny = nm[1] * a + nm[4] * b + nm[7] * c;
      let nz = nm[2] * a + nm[5] * b + nm[8] * c;
      const l = Math.hypot(nx, ny, nz) || 1;
      n[k] = nx / l; n[k + 1] = ny / l; n[k + 2] = nz / l;
    }
    /* 鏡像変換なら巻き順を反転 */
    const det =
      m[0] * (m[5] * m[10] - m[6] * m[9]) -
      m[4] * (m[1] * m[10] - m[2] * m[9]) +
      m[8] * (m[1] * m[6] - m[2] * m[5]);
    if (det < 0) for (let k = 0; k < g.i.length; k += 3) { const t = g.i[k + 1]; g.i[k + 1] = g.i[k + 2]; g.i[k + 2] = t; }
    return g;
  };
  G.trans = function (g, x, y, z) {
    const m = M.m4(); m[12] = x; m[13] = y; m[14] = z; return G.xform(g, m);
  };
  G.rot = function (g, rx, ry, rz) {
    return G.xform(g, M.compose(M.m4(), [0, 0, 0], [rx, ry, rz], [1, 1, 1]));
  };
  G.scale = function (g, sx, sy, sz) {
    return G.xform(g, M.compose(M.m4(), [0, 0, 0], [0, 0, 0], [sx, sy, sz === undefined ? sy : sz]));
  };
  G.place = function (g, p, r, s) {
    return G.xform(g, M.compose(M.m4(), p, r || [0, 0, 0], s || [1, 1, 1]));
  };
  G.uvScale = function (g, su, sv, ou, ov) {
    for (let k = 0; k < g.u.length; k += 2) {
      g.u[k] = g.u[k] * su + (ou || 0);
      g.u[k + 1] = g.u[k + 1] * sv + (ov || 0);
    }
    return g;
  };
  G.uvSet = function (g, u, v) {
    for (let k = 0; k < g.u.length; k += 2) { g.u[k] = u; g.u[k + 1] = v; }
    return g;
  };

  G.merge = function (list) {
    const out = mk();
    for (const g of list) {
      if (!g) continue;
      const off = out.p.length / 3;
      for (let k = 0; k < g.p.length; k++) out.p.push(g.p[k]);
      for (let k = 0; k < g.n.length; k++) out.n.push(g.n[k]);
      for (let k = 0; k < g.u.length; k++) out.u.push(g.u[k]);
      for (let k = 0; k < g.i.length; k++) out.i.push(g.i[k] + off);
    }
    return out;
  };

  /* ---- 基本形状 ---- */
  G.box = function (w, h, d) {
    const g = mk(), x = w / 2, y = h / 2, z = d / 2;
    const faces = [
      [[x, -y, -z], [x, -y, z], [x, y, z], [x, y, -z], [1, 0, 0]],
      [[-x, -y, z], [-x, -y, -z], [-x, y, -z], [-x, y, z], [-1, 0, 0]],
      [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]],
      [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]],
      [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]],
      [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
    ];
    for (const f of faces) {
      const n = f[4];
      const a = vert(g, f[0][0], f[0][1], f[0][2], n[0], n[1], n[2], 0, 0);
      const b = vert(g, f[1][0], f[1][1], f[1][2], n[0], n[1], n[2], 1, 0);
      const c = vert(g, f[2][0], f[2][1], f[2][2], n[0], n[1], n[2], 1, 1);
      const dd = vert(g, f[3][0], f[3][1], f[3][2], n[0], n[1], n[2], 0, 1);
      quad(g, a, b, c, dd);
    }
    return G.fixWinding(g);
  };

  G.plane = function (w, d, sx, sz) {
    sx = sx || 1; sz = sz || 1;
    const g = mk();
    for (let j = 0; j <= sz; j++) for (let i = 0; i <= sx; i++) {
      vert(g, (i / sx - 0.5) * w, 0, (j / sz - 0.5) * d, 0, 1, 0, i / sx, j / sz);
    }
    for (let j = 0; j < sz; j++) for (let i = 0; i < sx; i++) {
      const a = j * (sx + 1) + i;
      quad(g, a, a + sx + 1, a + sx + 2, a + 1);
    }
    return G.fixWinding(g);
  };

  /* Y軸まわり円筒。中心原点、高さh */
  G.cyl = function (rt, rb, h, seg, capT, capB) {
    seg = seg || 16;
    const g = mk(), hy = h / 2;
    const slope = Math.atan2(rb - rt, h);
    const cs = Math.cos(slope), sn = Math.sin(slope);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      vert(g, ca * rt, hy, sa * rt, ca * cs, sn, sa * cs, i / seg, 1);
      vert(g, ca * rb, -hy, sa * rb, ca * cs, sn, sa * cs, i / seg, 0);
    }
    for (let i = 0; i < seg; i++) {
      const a = i * 2;
      quad(g, a + 1, a + 3, a + 2, a);
    }
    if (capT !== false && rt > 1e-6) {
      const c = vert(g, 0, hy, 0, 0, 1, 0, 0.5, 0.5);
      const s = g.p.length / 3;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * TAU;
        vert(g, Math.cos(a) * rt, hy, Math.sin(a) * rt, 0, 1, 0, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
      }
      for (let i = 0; i < seg; i++) tri(g, c, s + i + 1, s + i);
    }
    if (capB !== false && rb > 1e-6) {
      const c = vert(g, 0, -hy, 0, 0, -1, 0, 0.5, 0.5);
      const s = g.p.length / 3;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * TAU;
        vert(g, Math.cos(a) * rb, -hy, Math.sin(a) * rb, 0, -1, 0, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
      }
      for (let i = 0; i < seg; i++) tri(g, c, s + i, s + i + 1);
    }
    return G.fixWinding(g);
  };

  G.sphere = function (r, seg, rings) {
    seg = seg || 16; rings = rings || 10;
    const g = mk();
    for (let j = 0; j <= rings; j++) {
      const phi = (j / rings) * Math.PI, sp = Math.sin(phi), cp = Math.cos(phi);
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * TAU, st = Math.sin(th), ct = Math.cos(th);
        const nx = sp * ct, ny = cp, nz = sp * st;
        vert(g, nx * r, ny * r, nz * r, nx, ny, nz, i / seg, 1 - j / rings);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      quad(g, a, b, b + 1, a + 1);
    }
    return G.fixWinding(g);
  };

  /* Y軸まわりトーラス（タイヤなどに使用） */
  G.torus = function (R, r, seg, rings) {
    seg = seg || 24; rings = rings || 12;
    const g = mk();
    for (let j = 0; j <= rings; j++) {
      const v = (j / rings) * TAU, cv = Math.cos(v), sv = Math.sin(v);
      for (let i = 0; i <= seg; i++) {
        const u = (i / seg) * TAU, cu = Math.cos(u), su = Math.sin(u);
        const nx = cv * cu, ny = sv, nz = cv * su;
        vert(g, (R + r * cv) * cu, r * sv, (R + r * cv) * su, nx, ny, nz, i / seg, j / rings);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      quad(g, a, a + 1, b + 1, b);
    }
    return G.fixWinding(g);
  };

  /* Y軸回転体。profile = [[r,y], ...] 下から上へ */
  G.lathe = function (profile, seg) {
    seg = seg || 20;
    const g = mk(), n = profile.length;
    let total = 0; const arc = [0];
    for (let j = 1; j < n; j++) {
      total += Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]);
      arc.push(total);
    }
    for (let j = 0; j < n; j++) {
      const r = profile[j][0], y = profile[j][1];
      let dr, dy;
      if (j === 0) { dr = profile[1][0] - r; dy = profile[1][1] - y; }
      else if (j === n - 1) { dr = r - profile[j - 1][0]; dy = y - profile[j - 1][1]; }
      else { dr = profile[j + 1][0] - profile[j - 1][0]; dy = profile[j + 1][1] - profile[j - 1][1]; }
      const l = Math.hypot(dr, dy) || 1;
      const nr = dy / l, ny = -dr / l;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        vert(g, ca * r, y, sa * r, ca * nr, ny, sa * nr, i / seg, total ? arc[j] / total : 0);
      }
    }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      quad(g, a, a + 1, b + 1, b);
    }
    return G.fixWinding(g);
  };

  /* 断面リングを z 方向に並べる（胴体用）。sections=[{z,r,y,sy}] */
  G.hull = function (sections, seg) {
    seg = seg || 24;
    const g = mk(), n = sections.length;
    let total = 0; const arc = [0];
    for (let j = 1; j < n; j++) { total += Math.abs(sections[j].z - sections[j - 1].z); arc.push(total); }
    for (let j = 0; j < n; j++) {
      const s = sections[j];
      const sy = s.sy === undefined ? 1 : s.sy;
      const yc = s.y || 0;
      let dz, dr;
      if (j === 0) { dz = sections[1].z - s.z; dr = sections[1].r - s.r; }
      else if (j === n - 1) { dz = s.z - sections[j - 1].z; dr = s.r - sections[j - 1].r; }
      else { dz = sections[j + 1].z - sections[j - 1].z; dr = sections[j + 1].r - sections[j - 1].r; }
      const l = Math.hypot(dz, dr) || 1;
      const nz = -dr / l, nrad = dz / l;
      for (let i = 0; i <= seg; i++) {
        /* θ=0 を上（+Y）とし +X 方向へ回る */
        const a = (i / seg) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const px = sa * s.r, py = ca * s.r * sy + yc;
        let nx = sa * nrad, ny = (ca / sy) * nrad, nzz = nz;
        const ln = Math.hypot(nx, ny, nzz) || 1;
        vert(g, px, py, s.z, nx / ln, ny / ln, nzz / ln, total ? arc[j] / total : 0, i / seg);
      }
    }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      quad(g, a, b, b + 1, a + 1);
    }
    return G.fixWinding(g);
  };

  /* 対称翼型の輪郭（弦長1、原点=前縁） */
  function airfoil(t, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = 0.5 - 0.5 * Math.cos((i / n) * Math.PI);
      const y = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
      pts.push([x, y]);
    }
    for (let i = n - 1; i > 0; i--) pts.push([pts[i][0], -pts[i][1]]);
    return pts;
  }
  G.airfoil = airfoil;

  /* 翼（右舷）。span方向=+X、前縁=+Z側 */
  G.wing = function (o) {
    const span = o.span, cr = o.rootChord, ct = o.tipChord;
    const sweep = o.sweep || 0, dih = o.dihedral || 0;
    const thick = o.thick || 0.12, ribs = o.ribs || 6, nfoil = o.nfoil || 10;
    const foil = airfoil(thick, nfoil);
    const m = foil.length;
    const g = mk();
    for (let j = 0; j <= ribs; j++) {
      const f = j / ribs;
      const c = cr + (ct - cr) * f;
      const x = f * span;
      const le = -f * span * Math.tan(sweep);
      const y = f * span * Math.tan(dih) + (o.twist ? 0 : 0);
      for (let i = 0; i < m; i++) {
        const z = le + (0.5 - foil[i][0]) * c * 2 * 0.5 + c * 0.0; /* 前縁 le, 後縁 le-c */
        const zz = le - foil[i][0] * c;
        const yy = y + foil[i][1] * c;
        /* 法線は後で近似 */
        vert(g, x, yy, zz, 0, foil[i][1] >= 0 ? 1 : -1, 0, foil[i][0], f);
      }
    }
    for (let j = 0; j < ribs; j++) for (let i = 0; i < m; i++) {
      const i2 = (i + 1) % m;
      const a = j * m + i, b = j * m + i2, c = (j + 1) * m + i2, d = (j + 1) * m + i;
      quad(g, a, b, c, d);
    }
    /* 翼端キャップ */
    const base = ribs * m;
    const cIdx = vert(g, span + 0.001, ribs / ribs * span * Math.tan(dih), -span * Math.tan(sweep) - ct * 0.5, 1, 0, 0, 0.5, 1);
    for (let i = 0; i < m; i++) tri(g, cIdx, base + i, base + ((i + 1) % m));
    G.fixWinding(g);
    G.recalcNormals(g);
    return g;
  };

  /* パスに沿ったチューブ（ケーブル・ホース） */
  G.tube = function (path, r, seg, radial) {
    radial = radial || 8;
    const g = mk(), n = path.length;
    let up = [0, 1, 0];
    for (let j = 0; j < n; j++) {
      const p = path[j];
      let t;
      if (j === 0) t = [path[1][0] - p[0], path[1][1] - p[1], path[1][2] - p[2]];
      else if (j === n - 1) t = [p[0] - path[j - 1][0], p[1] - path[j - 1][1], p[2] - path[j - 1][2]];
      else t = [path[j + 1][0] - path[j - 1][0], path[j + 1][1] - path[j - 1][1], path[j + 1][2] - path[j - 1][2]];
      M.vnorm(t, t);
      let nx = M.vcross([0, 0, 0], up, t);
      if (M.vlen(nx) < 1e-4) { up = [1, 0, 0]; M.vcross(nx, up, t); }
      M.vnorm(nx, nx);
      const by = M.vnorm([0, 0, 0], M.vcross([0, 0, 0], t, nx));
      const rr = typeof r === 'function' ? r(j / (n - 1)) : r;
      for (let i = 0; i <= radial; i++) {
        const a = (i / radial) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const dx = nx[0] * ca + by[0] * sa, dy = nx[1] * ca + by[1] * sa, dz = nx[2] * ca + by[2] * sa;
        vert(g, p[0] + dx * rr, p[1] + dy * rr, p[2] + dz * rr, dx, dy, dz, j / (n - 1), i / radial);
      }
    }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < radial; i++) {
      const a = j * (radial + 1) + i, b = a + radial + 1;
      quad(g, a, b, b + 1, a + 1);
    }
    return G.fixWinding(g);
  };

  /* 円弧状の帯（フェンダー等）。XY平面で角度 a0..a1、Z方向に width */
  G.arcBand = function (R, thick, width, a0, a1, seg) {
    seg = seg || 10;
    const g = mk(), ro = R + thick / 2, ri = R - thick / 2, hw = width / 2;
    const idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (a1 - a0) * (i / seg), ca = Math.cos(a), sa = Math.sin(a);
      const t = i / seg;
      idx.push([
        vert(g, ca * ro, sa * ro, -hw, ca, sa, 0, t, 0),
        vert(g, ca * ro, sa * ro, hw, ca, sa, 0, t, 1),
        vert(g, ca * ri, sa * ri, -hw, -ca, -sa, 0, t, 0),
        vert(g, ca * ri, sa * ri, hw, -ca, -sa, 0, t, 1),
        vert(g, ca * ro, sa * ro, -hw, 0, 0, -1, t, 0),
        vert(g, ca * ri, sa * ri, -hw, 0, 0, -1, t, 1),
        vert(g, ca * ro, sa * ro, hw, 0, 0, 1, t, 0),
        vert(g, ca * ri, sa * ri, hw, 0, 0, 1, t, 1),
      ]);
    }
    for (let i = 0; i < seg; i++) {
      const A = idx[i], B = idx[i + 1];
      quad(g, A[0], A[1], B[1], B[0]);   /* 外面 */
      quad(g, A[2], A[3], B[3], B[2]);   /* 内面 */
      quad(g, A[4], A[5], B[5], B[4]);   /* 側面 */
      quad(g, A[6], A[7], B[7], B[6]);   /* 側面 */
    }
    /* 端面 */
    const F = idx[0], L = idx[seg];
    quad(g, F[0], F[2], F[3], F[1]);
    quad(g, L[0], L[2], L[3], L[1]);
    return G.fixWinding(g);
  };

  /* 面の巻き順を頂点法線に合わせて正す（表裏の取り違えを防ぐ） */
  G.fixWinding = function (g) {
    const p = g.p, n = g.n, idx = g.i;
    for (let k = 0; k < idx.length; k += 3) {
      const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      const nx = n[a] + n[b] + n[c], ny = n[a + 1] + n[b + 1] + n[c + 1], nz = n[a + 2] + n[b + 2] + n[c + 2];
      if (gx * nx + gy * ny + gz * nz < 0) {
        const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t;
      }
    }
    return g;
  };

  G.recalcNormals = function (g) {
    const n = g.p.length / 3;
    const acc = new Float32Array(n * 3);
    for (let k = 0; k < g.i.length; k += 3) {
      const a = g.i[k] * 3, b = g.i[k + 1] * 3, c = g.i[k + 2] * 3;
      const ux = g.p[b] - g.p[a], uy = g.p[b + 1] - g.p[a + 1], uz = g.p[b + 2] - g.p[a + 2];
      const vx = g.p[c] - g.p[a], vy = g.p[c + 1] - g.p[a + 1], vz = g.p[c + 2] - g.p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      acc[a] += nx; acc[a + 1] += ny; acc[a + 2] += nz;
      acc[b] += nx; acc[b + 1] += ny; acc[b + 2] += nz;
      acc[c] += nx; acc[c + 1] += ny; acc[c + 2] += nz;
    }
    for (let k = 0; k < n; k++) {
      const l = Math.hypot(acc[k * 3], acc[k * 3 + 1], acc[k * 3 + 2]) || 1;
      g.n[k * 3] = acc[k * 3] / l; g.n[k * 3 + 1] = acc[k * 3 + 1] / l; g.n[k * 3 + 2] = acc[k * 3 + 2] / l;
    }
    return g;
  };

  /* 角を落とした箱（車体などの質感用・簡易ベベル） */
  G.chamferBox = function (w, h, d, c) {
    const g = G.box(w - c * 2, h, d - c * 2);
    const parts = [g,
      G.trans(G.box(c * 2, h - c * 2, d - c * 2), 0, 0, 0),
      G.trans(G.box(w - c * 2, h - c * 2, c * 2), 0, 0, 0)];
    return G.merge(parts);
  };

  /* 円弧状に押し出した板（誘導路の曲線など） */
  G.ribbon = function (pts, width, y) {
    const g = mk(), n = pts.length;
    for (let j = 0; j < n; j++) {
      const p = pts[j];
      let t;
      if (j === 0) t = [pts[1][0] - p[0], pts[1][1] - p[1]];
      else if (j === n - 1) t = [p[0] - pts[j - 1][0], p[1] - pts[j - 1][1]];
      else t = [pts[j + 1][0] - pts[j - 1][0], pts[j + 1][1] - pts[j - 1][1]];
      const l = Math.hypot(t[0], t[1]) || 1;
      const nx = -t[1] / l * width / 2, nz = t[0] / l * width / 2;
      vert(g, p[0] - nx, y, p[1] - nz, 0, 1, 0, 0, j / (n - 1));
      vert(g, p[0] + nx, y, p[1] + nz, 0, 1, 0, 1, j / (n - 1));
    }
    for (let j = 0; j < n - 1; j++) {
      const a = j * 2;
      quad(g, a, a + 2, a + 3, a + 1);
    }
    return G.fixWinding(g);
  };
})(window.AG);
