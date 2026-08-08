// Procedural geometry builders. Every builder emits { positions, normals, uvs, ao, indices }
// in real-world meters, then `pack()` interleaves for the GPU.

import { mat4, vec3 } from './math.js';

export function emptyGeo() {
  return { positions: [], normals: [], uvs: [], ao: [], indices: [] };
}

export function pack(geo) {
  const n = geo.positions.length / 3;
  const data = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    data[i * 9 + 0] = geo.positions[i * 3];
    data[i * 9 + 1] = geo.positions[i * 3 + 1];
    data[i * 9 + 2] = geo.positions[i * 3 + 2];
    data[i * 9 + 3] = geo.normals[i * 3];
    data[i * 9 + 4] = geo.normals[i * 3 + 1];
    data[i * 9 + 5] = geo.normals[i * 3 + 2];
    data[i * 9 + 6] = geo.uvs[i * 2];
    data[i * 9 + 7] = geo.uvs[i * 2 + 1];
    data[i * 9 + 8] = geo.ao.length ? geo.ao[i] : 1;
  }
  return { data, indices: new Uint32Array(geo.indices) };
}

export function merge(...geos) {
  const out = emptyGeo();
  for (const g of geos) {
    const base = out.positions.length / 3;
    out.positions.push(...g.positions);
    out.normals.push(...g.normals);
    out.uvs.push(...g.uvs);
    if (g.ao.length) out.ao.push(...g.ao);
    else for (let i = 0; i < g.positions.length / 3; i++) out.ao.push(1);
    for (const idx of g.indices) out.indices.push(idx + base);
  }
  return out;
}

export function transform(geo, m) {
  const nm = mat4.normalMatrix(mat4.create(), m);
  const p = vec3.create(), o = vec3.create();
  for (let i = 0; i < geo.positions.length; i += 3) {
    vec3.set(p, geo.positions[i], geo.positions[i + 1], geo.positions[i + 2]);
    mat4.transformPoint(o, m, p);
    geo.positions[i] = o[0]; geo.positions[i + 1] = o[1]; geo.positions[i + 2] = o[2];
    vec3.set(p, geo.normals[i], geo.normals[i + 1], geo.normals[i + 2]);
    mat4.transformDir(o, nm, p);
    vec3.normalize(o, o);
    geo.normals[i] = o[0]; geo.normals[i + 1] = o[1]; geo.normals[i + 2] = o[2];
  }
  return geo;
}

export function translated(geo, x, y, z) {
  return transform(geo, mat4.fromTRS(mat4.create(), [x, y, z], [0, 0, 0], [1, 1, 1]));
}

export function placed(geo, t, r = [0, 0, 0], s = [1, 1, 1]) {
  return transform(geo, mat4.fromTRS(mat4.create(), t, r, s));
}

export function setAO(geo, fn) {
  const n = geo.positions.length / 3;
  geo.ao.length = 0;
  for (let i = 0; i < n; i++) {
    geo.ao.push(fn(geo.positions[i * 3], geo.positions[i * 3 + 1], geo.positions[i * 3 + 2],
      geo.normals[i * 3], geo.normals[i * 3 + 1], geo.normals[i * 3 + 2]));
  }
  return geo;
}

/** Axis-aligned box centered on origin (unless `min`/`max` given). uvScale in meters/uv-unit. */
export function box(w, h, d, { uvScale = 1, center = [0, 0, 0] } = {}) {
  const geo = emptyGeo();
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const faces = [
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], e: [hx, hy, hz] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], e: [hx, hy, hz] },
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], e: [hx, hy, hz] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], e: [hx, hy, hz] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], e: [hx, hy, hz] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], e: [hx, hy, hz] },
  ];
  for (const f of faces) {
    const base = geo.positions.length / 3;
    const cx = f.n[0] * hx, cy = f.n[1] * hy, cz = f.n[2] * hz;
    const su = Math.abs(f.u[0]) * hx + Math.abs(f.u[1]) * hy + Math.abs(f.u[2]) * hz;
    const sv = Math.abs(f.v[0]) * hx + Math.abs(f.v[1]) * hy + Math.abs(f.v[2]) * hz;
    for (let j = 0; j < 4; j++) {
      const uu = j === 0 || j === 3 ? -1 : 1;
      const vv = j < 2 ? -1 : 1;
      geo.positions.push(
        center[0] + cx + f.u[0] * su * uu + f.v[0] * sv * vv,
        center[1] + cy + f.u[1] * su * uu + f.v[1] * sv * vv,
        center[2] + cz + f.u[2] * su * uu + f.v[2] * sv * vv);
      geo.normals.push(f.n[0], f.n[1], f.n[2]);
      geo.uvs.push((uu * su) / uvScale, (vv * sv) / uvScale);
      geo.ao.push(1);
    }
    geo.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return geo;
}

/** Cylinder / cone along +Y, base at y=0. */
export function cylinder(r0, r1, h, seg = 24, { caps = true, uvScale = 1 } = {}) {
  const geo = emptyGeo();
  const slope = (r0 - r1) / h;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const ny = slope / Math.hypot(1, slope);
    const nr = 1 / Math.hypot(1, slope);
    for (let j = 0; j <= 1; j++) {
      const r = j ? r1 : r0;
      geo.positions.push(ca * r, j * h, sa * r);
      geo.normals.push(ca * nr, ny, sa * nr);
      geo.uvs.push((a * (r0 + r1) * 0.5) / uvScale, (j * h) / uvScale);
      geo.ao.push(j ? 1 : 0.75);
    }
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 2;
    geo.indices.push(a, b, b + 1, a, b + 1, a + 1);
  }
  if (caps) {
    for (const [y, r, sign] of [[0, r0, -1], [h, r1, 1]]) {
      if (r <= 0) continue;
      const base = geo.positions.length / 3;
      geo.positions.push(0, y, 0);
      geo.normals.push(0, sign, 0);
      geo.uvs.push(0, 0);
      geo.ao.push(sign < 0 ? 0.6 : 1);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        geo.positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
        geo.normals.push(0, sign, 0);
        geo.uvs.push((Math.cos(a) * r) / uvScale, (Math.sin(a) * r) / uvScale);
        geo.ao.push(sign < 0 ? 0.6 : 1);
      }
      for (let i = 0; i < seg; i++) {
        if (sign > 0) geo.indices.push(base, base + 1 + i, base + 2 + i);
        else geo.indices.push(base, base + 2 + i, base + 1 + i);
      }
    }
  }
  return geo;
}

/** Revolve a profile of [radius, y] pairs around +Y. Profile order = bottom to top. */
export function lathe(profile, seg = 48, { uvScale = 1, flipNormals = false } = {}) {
  const geo = emptyGeo();
  const rows = profile.length;
  // profile tangents -> normals
  const norms = [];
  for (let i = 0; i < rows; i++) {
    const a = profile[Math.max(0, i - 1)];
    const b = profile[Math.min(rows - 1, i + 1)];
    let dr = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dr, dy) || 1;
    dr /= l; dy /= l;
    let nr = dy, ny = -dr;
    if (flipNormals) { nr = -nr; ny = -ny; }
    norms.push([nr, ny]);
  }
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j < rows; j++) {
      const [r, y] = profile[j];
      let [nr, ny] = norms[j];
      // On the axis every segment collapses to one point; a radial normal there
      // fans the shading out like a paper parasol, so pin it to the axis.
      if (r < 1e-5) { nr = 0; ny = ny >= 0 ? 1 : -1; }
      geo.positions.push(ca * r, y, sa * r);
      geo.normals.push(ca * nr, ny, sa * nr);
      geo.uvs.push((a * 0.06) / uvScale, y / uvScale);
      geo.ao.push(0.55 + 0.45 * Math.min(1, j / Math.max(1, rows - 1) + 0.25));
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j, b = (i + 1) * rows + j;
      if (flipNormals) geo.indices.push(a, a + 1, b + 1, a, b + 1, b);
      else geo.indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  return geo;
}

export function sphere(r, seg = 24, rings = 16) {
  const geo = emptyGeo();
  for (let j = 0; j <= rings; j++) {
    const phi = (j / rings) * Math.PI;
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const x = sp * Math.cos(th), y = cp, z = sp * Math.sin(th);
      geo.positions.push(x * r, y * r, z * r);
      geo.normals.push(x, y, z);
      geo.uvs.push(i / seg, j / rings);
      geo.ao.push(0.6 + 0.4 * (1 - j / rings));
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * (seg + 1) + i, b = a + seg + 1;
      geo.indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  return geo;
}

/** XZ plane grid facing +Y, centered, optional height function h(x,z). */
export function planeGrid(w, d, nx, nz, { uvScale = 1, height = null } = {}) {
  const geo = emptyGeo();
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = (i / nx - 0.5) * w;
      const z = (j / nz - 0.5) * d;
      const y = height ? height(x, z) : 0;
      geo.positions.push(x, y, z);
      geo.normals.push(0, 1, 0);
      geo.uvs.push(x / uvScale, z / uvScale);
      geo.ao.push(1);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + nx + 1;
      geo.indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  if (height) recomputeNormals(geo);
  return geo;
}

/** Vertical quad facing +Z, centered on origin. */
export function quadXY(w, h, { uvScale = 1 } = {}) {
  const geo = emptyGeo();
  const hx = w / 2, hy = h / 2;
  geo.positions.push(-hx, -hy, 0, hx, -hy, 0, hx, hy, 0, -hx, hy, 0);
  for (let i = 0; i < 4; i++) { geo.normals.push(0, 0, 1); geo.ao.push(1); }
  geo.uvs.push(-hx / uvScale, -hy / uvScale, hx / uvScale, -hy / uvScale,
    hx / uvScale, hy / uvScale, -hx / uvScale, hy / uvScale);
  geo.indices.push(0, 1, 2, 0, 2, 3);
  return geo;
}

export function recomputeNormals(geo) {
  const n = geo.positions.length / 3;
  const acc = new Float32Array(n * 3);
  for (let t = 0; t < geo.indices.length; t += 3) {
    const i0 = geo.indices[t], i1 = geo.indices[t + 1], i2 = geo.indices[t + 2];
    const ax = geo.positions[i1 * 3] - geo.positions[i0 * 3];
    const ay = geo.positions[i1 * 3 + 1] - geo.positions[i0 * 3 + 1];
    const az = geo.positions[i1 * 3 + 2] - geo.positions[i0 * 3 + 2];
    const bx = geo.positions[i2 * 3] - geo.positions[i0 * 3];
    const by = geo.positions[i2 * 3 + 1] - geo.positions[i0 * 3 + 1];
    const bz = geo.positions[i2 * 3 + 2] - geo.positions[i0 * 3 + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    for (const i of [i0, i1, i2]) {
      acc[i * 3] += cx; acc[i * 3 + 1] += cy; acc[i * 3 + 2] += cz;
    }
  }
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]) || 1;
    geo.normals[i * 3] = acc[i * 3] / l;
    geo.normals[i * 3 + 1] = acc[i * 3 + 1] / l;
    geo.normals[i * 3 + 2] = acc[i * 3 + 2] / l;
  }
  return geo;
}

/** Chamfered slab — reads as a real machined/planed object at close range. */
export function chamferBox(w, h, d, bevel = 0.004) {
  const b = Math.min(bevel, Math.min(w, h, d) / 3);
  const geo = merge(
    box(w - 2 * b, h, d - 2 * b),
    box(w, h - 2 * b, d - 2 * b),
    box(w - 2 * b, h - 2 * b, d),
  );
  return geo;
}
