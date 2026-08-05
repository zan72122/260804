// ---------------------------------------------------------------------------
// ジオメトリ生成。すべて実寸 (メートル) で作る。
// ---------------------------------------------------------------------------
'use strict';

const Geom = {
  empty() { return { pos: [], nrm: [], uv: [], idx: [] }; },

  push(d, x, y, z, nx, ny, nz, u, v) {
    d.pos.push(x, y, z); d.nrm.push(nx, ny, nz); d.uv.push(u, v);
    return d.pos.length / 3 - 1;
  },

  // 直方体。中心原点。uvScale: 1m あたりの UV 繰り返し数
  box(w, h, dp, uvScale) {
    const s = uvScale === undefined ? 1 : uvScale;
    const d = Geom.empty();
    const x = w / 2, y = h / 2, z = dp / 2;
    const faces = [
      // [法線, 原点, uAxis, vAxis, uLen, vLen]
      [[0, 0, 1], [-x, -y, z], [1, 0, 0], [0, 1, 0], w, h],
      [[0, 0, -1], [x, -y, -z], [-1, 0, 0], [0, 1, 0], w, h],
      [[1, 0, 0], [x, -y, z], [0, 0, -1], [0, 1, 0], dp, h],
      [[-1, 0, 0], [-x, -y, -z], [0, 0, 1], [0, 1, 0], dp, h],
      [[0, 1, 0], [-x, y, z], [1, 0, 0], [0, 0, -1], w, dp],
      [[0, -1, 0], [-x, -y, -z], [1, 0, 0], [0, 0, 1], w, dp],
    ];
    for (const f of faces) {
      const [n, o, ua, va, ul, vl] = f;
      const base = d.pos.length / 3;
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          Geom.push(d,
            o[0] + ua[0] * ul * i + va[0] * vl * j,
            o[1] + ua[1] * ul * i + va[1] * vl * j,
            o[2] + ua[2] * ul * i + va[2] * vl * j,
            n[0], n[1], n[2], i * ul * s, j * vl * s);
        }
      }
      d.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
    return d;
  },

  // XZ 平面 (法線 +Y)。segs で分割し、頂点で照明の変化を拾えるようにする
  planeXZ(w, dp, segs, uvScale) {
    const s = uvScale === undefined ? 1 : uvScale;
    const d = Geom.empty();
    for (let j = 0; j <= segs; j++) {
      for (let i = 0; i <= segs; i++) {
        const u = i / segs, v = j / segs;
        Geom.push(d, (u - 0.5) * w, 0, (v - 0.5) * dp, 0, 1, 0, u * w * s, v * dp * s);
      }
    }
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * (segs + 1) + i;
        d.idx.push(a, a + segs + 1, a + 1, a + 1, a + segs + 1, a + segs + 2);
      }
    }
    return d;
  },

  // XY 平面 (法線 +Z)
  planeXY(w, h, segs, uvScale) {
    const s = uvScale === undefined ? 1 : uvScale;
    const d = Geom.empty();
    for (let j = 0; j <= segs; j++) {
      for (let i = 0; i <= segs; i++) {
        const u = i / segs, v = j / segs;
        Geom.push(d, (u - 0.5) * w, (v - 0.5) * h, 0, 0, 0, 1, u * w * s, v * h * s);
      }
    }
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * (segs + 1) + i;
        d.idx.push(a, a + 1, a + segs + 1, a + 1, a + segs + 2, a + segs + 1);
      }
    }
    return d;
  },

  // UV が 0..1 に正規化された XZ 平面 (接地影などに使う)
  quadXZ(w, dp) {
    const d = Geom.empty();
    Geom.push(d, -w / 2, 0, -dp / 2, 0, 1, 0, 0, 0);
    Geom.push(d, w / 2, 0, -dp / 2, 0, 1, 0, 1, 0);
    Geom.push(d, w / 2, 0, dp / 2, 0, 1, 0, 1, 1);
    Geom.push(d, -w / 2, 0, dp / 2, 0, 1, 0, 0, 1);
    d.idx.push(0, 2, 1, 0, 3, 2);
    return d;
  },

  cylinder(r0, r1, h, segs, capped) {
    const d = Geom.empty();
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const slope = (r0 - r1) / h;
      const nl = Math.hypot(1, slope);
      Geom.push(d, ca * r0, -h / 2, sa * r0, ca / nl, slope / nl, sa / nl, i / segs, 0);
      Geom.push(d, ca * r1, h / 2, sa * r1, ca / nl, slope / nl, sa / nl, i / segs, 1);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      d.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    if (capped) {
      for (const [y, r, ny] of [[h / 2, r1, 1], [-h / 2, r0, -1]]) {
        const c = Geom.push(d, 0, y, 0, 0, ny, 0, 0.5, 0.5);
        for (let i = 0; i <= segs; i++) {
          const a = i / segs * Math.PI * 2;
          Geom.push(d, Math.cos(a) * r, y, Math.sin(a) * r, 0, ny, 0, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
        }
        for (let i = 0; i < segs; i++) {
          if (ny > 0) d.idx.push(c, c + 1 + i, c + 2 + i);
          else d.idx.push(c, c + 2 + i, c + 1 + i);
        }
      }
    }
    return d;
  },

  sphere(r, segs, rings) {
    const d = Geom.empty();
    for (let j = 0; j <= rings; j++) {
      const v = j / rings, phi = v * Math.PI;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs, th = u * Math.PI * 2;
        const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        Geom.push(d, nx * r, ny * r, nz * r, nx, ny, nz, u, v);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segs; i++) {
        const a = j * (segs + 1) + i;
        d.idx.push(a, a + 1, a + segs + 1, a + 1, a + segs + 2, a + segs + 1);
      }
    }
    return d;
  },

  // 2D ポリゴンを Z 方向に押し出す。ガラス片・板ガラス用。
  // pts: [[x,y], ...] 反時計回り。uvRect: [minx, miny, w, h] で UV を正規化。
  extrude(pts, thickness, uvRect) {
    const d = Geom.empty();
    const t = thickness / 2;
    const n = pts.length;
    const R = uvRect || [-0.5, -0.5, 1, 1];
    const uvOf = (p) => [(p[0] - R[0]) / R[2], (p[1] - R[1]) / R[3]];
    // 重心 (扇状三角形分割の中心)
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p[0]; cy += p[1]; }
    cx /= n; cy /= n;
    for (const [z, nz] of [[t, 1], [-t, -1]]) {
      const cuv = uvOf([cx, cy]);
      const c = Geom.push(d, cx, cy, z, 0, 0, nz, cuv[0], cuv[1]);
      for (let i = 0; i < n; i++) {
        const uv = uvOf(pts[i]);
        Geom.push(d, pts[i][0], pts[i][1], z, 0, 0, nz, uv[0], uv[1]);
      }
      for (let i = 0; i < n; i++) {
        const a = c + 1 + i, b = c + 1 + (i + 1) % n;
        if (nz > 0) d.idx.push(c, a, b); else d.idx.push(c, b, a);
      }
    }
    // 側面 (ガラスの小口。厚みが読めるので重要)
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      let ex = q[0] - p[0], ey = q[1] - p[1];
      const el = Math.hypot(ex, ey) || 1;
      const nx = ey / el, ny = -ex / el;
      const base = d.pos.length / 3;
      const uvp = uvOf(p), uvq = uvOf(q);
      Geom.push(d, p[0], p[1], t, nx, ny, 0, uvp[0], uvp[1]);
      Geom.push(d, q[0], q[1], t, nx, ny, 0, uvq[0], uvq[1]);
      Geom.push(d, q[0], q[1], -t, nx, ny, 0, uvq[0], uvq[1]);
      Geom.push(d, p[0], p[1], -t, nx, ny, 0, uvp[0], uvp[1]);
      d.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return d;
  },

  // ポリライン (閉じたパス) に沿って断面を掃引する = ケイム (鉛線) 用のチューブ
  // profile: [[lateral, z], ...] 閉じた断面。パスの進行順に索引が並ぶので
  // Mesh.draw(ratio) による「継ぎ目が伸びていく」表現に使える。
  // inset: パスを内側へずらす量。隣のセルのケイムと面が重なって
  // Z ファイティングを起こさないよう、各セルの内側に収める。
  ribbon(pts, halfWidth, halfHeight, inset) {
    const profile = [
      [-halfWidth, 0],
      [-halfWidth * 0.72, halfHeight * 0.85],
      [0, halfHeight],
      [halfWidth * 0.72, halfHeight * 0.85],
      [halfWidth, 0],
      [halfWidth * 0.72, -halfHeight * 0.85],
      [0, -halfHeight],
      [-halfWidth * 0.72, -halfHeight * 0.85],
    ];
    const P = profile.length;
    const d = Geom.empty();
    const n = pts.length;
    // 各頂点の 2D 法線 (マイター)
    const norms = [];
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
      const e0 = [cur[0] - prev[0], cur[1] - prev[1]];
      const e1 = [next[0] - cur[0], next[1] - cur[1]];
      const l0 = Math.hypot(e0[0], e0[1]) || 1, l1 = Math.hypot(e1[0], e1[1]) || 1;
      const n0 = [e0[1] / l0, -e0[0] / l0], n1 = [e1[1] / l1, -e1[0] / l1];
      let mx = n0[0] + n1[0], my = n0[1] + n1[1];
      const ml = Math.hypot(mx, my) || 1;
      mx /= ml; my /= ml;
      const cosHalf = Math.max(0.35, mx * n1[0] + my * n1[1]);
      norms.push([mx / cosHalf, my / cosHalf, mx, my]);
    }
    const ins = inset || 0;
    const path = pts.map((p, i) => [p[0] - norms[i][0] * ins, p[1] - norms[i][1] * ins]);
    let acc = 0;
    for (let i = 0; i <= n; i++) {
      const k = i % n;
      const p = path[k], nr = norms[k];
      if (i > 0) {
        const pp = path[(k - 1 + n) % n];
        acc += Math.hypot(p[0] - pp[0], p[1] - pp[1]);
      }
      for (let j = 0; j < P; j++) {
        const pf = profile[j];
        const x = p[0] + nr[0] * pf[0];
        const y = p[1] + nr[1] * pf[0];
        const z = pf[1];
        // 断面の法線 (断面ポリゴンの外向き法線を横方向/Z 方向に写す)
        const pn = profile[(j + 1) % P], pb = profile[(j - 1 + P) % P];
        let tx = pn[0] - pb[0], tz = pn[1] - pb[1];
        const tl = Math.hypot(tx, tz) || 1;
        tx /= tl; tz /= tl;
        const lx = nr[2] * tz, ly = nr[3] * tz, lz = -tx;
        const ll = Math.hypot(lx, ly, lz) || 1;
        Geom.push(d, x, y, z, lx / ll, ly / ll, lz / ll, acc * 2.0, j / P);
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < P; j++) {
        const a = i * P + j, b = i * P + (j + 1) % P;
        const c = (i + 1) * P + j, e = (i + 1) * P + (j + 1) % P;
        d.idx.push(a, c, b, b, c, e);
      }
    }
    return d;
  },

  // 遠景の稜線。profileFn(t) -> 高さ
  ridge(width, depth, height, segs, profileFn) {
    const d = Geom.empty();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = (t - 0.5) * width;
      const h = profileFn(t) * height;
      Geom.push(d, x, h, 0, 0, 0.72, 0.7, t * 6, 1);
      Geom.push(d, x, -depth, 0, 0, 0.72, 0.7, t * 6, 0);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      d.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    return d;
  },

  transform(d, fn) {
    for (let i = 0; i < d.pos.length; i += 3) {
      const p = fn([d.pos[i], d.pos[i + 1], d.pos[i + 2]]);
      d.pos[i] = p[0]; d.pos[i + 1] = p[1]; d.pos[i + 2] = p[2];
    }
    return d;
  },

  translate(d, x, y, z) {
    for (let i = 0; i < d.pos.length; i += 3) {
      d.pos[i] += x; d.pos[i + 1] += y; d.pos[i + 2] += z;
    }
    return d;
  },

  rotateY(d, a) {
    const c = Math.cos(a), s = Math.sin(a);
    for (const arr of [d.pos, d.nrm]) {
      for (let i = 0; i < arr.length; i += 3) {
        const x = arr[i], z = arr[i + 2];
        arr[i] = x * c + z * s;
        arr[i + 2] = -x * s + z * c;
      }
    }
    return d;
  },

  merge(target, src) {
    const off = target.pos.length / 3;
    for (let i = 0; i < src.pos.length; i++) target.pos.push(src.pos[i]);
    for (let i = 0; i < src.nrm.length; i++) target.nrm.push(src.nrm[i]);
    for (let i = 0; i < src.uv.length; i++) target.uv.push(src.uv[i]);
    for (let i = 0; i < src.idx.length; i++) target.idx.push(src.idx[i] + off);
    return target;
  },
};
