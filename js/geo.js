// Procedural geometry builders. Everything the workshop is made of — the
// artisan, the canting, the dye vats, the wooden frame — is generated here as
// real triangle geometry so the scene has genuine perspective, occlusion and
// parallax rather than layered 2D.

import { M4, V3 } from './math.js';

export class GeoBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.ext = [];   // rgb tint + material id
    this.idx = [];
  }

  // geo: {position:[], normal:[], uv:[], index:[]}
  add(geo, opts = {}) {
    const m = opts.matrix || M4.identity(M4.create());
    const nm = new Float32Array(9);
    M4.normalFromMat4(nm, m);
    const color = opts.color || [1, 1, 1];
    const mat = opts.mat === undefined ? 0 : opts.mat;
    const base = this.pos.length / 3;
    const p = V3.create();
    for (let i = 0; i < geo.position.length; i += 3) {
      p[0] = geo.position[i]; p[1] = geo.position[i + 1]; p[2] = geo.position[i + 2];
      const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
      const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
      const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
      this.pos.push(x, y, z);
      const nx = geo.normal[i], ny = geo.normal[i + 1], nz = geo.normal[i + 2];
      let tx = nm[0] * nx + nm[3] * ny + nm[6] * nz;
      let ty = nm[1] * nx + nm[4] * ny + nm[7] * nz;
      let tz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
      const l = Math.hypot(tx, ty, tz) || 1;
      this.nrm.push(tx / l, ty / l, tz / l);
      this.ext.push(color[0], color[1], color[2], mat);
    }
    for (let i = 0; i < geo.uv.length; i++) this.uv.push(geo.uv[i]);
    for (let i = 0; i < geo.index.length; i++) this.idx.push(geo.index[i] + base);
    return this;
  }

  build() {
    return {
      position: { data: new Float32Array(this.pos), size: 3 },
      normal: { data: new Float32Array(this.nrm), size: 3 },
      uv: { data: new Float32Array(this.uv), size: 2 },
      extra: { data: new Float32Array(this.ext), size: 4 },
      index: this.pos.length / 3 > 65535
        ? new Uint32Array(this.idx)
        : new Uint16Array(this.idx),
    };
  }
}

// Raw builder output -> the attribute layout Renderer.mesh expects.
export function toMeshData(geo) {
  const n = geo.position.length / 3;
  return {
    position: { data: new Float32Array(geo.position), size: 3 },
    normal: { data: new Float32Array(geo.normal), size: 3 },
    uv: { data: new Float32Array(geo.uv), size: 2 },
    index: n > 65535 ? new Uint32Array(geo.index) : new Uint16Array(geo.index),
  };
}

export function xform(t = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  return M4.fromTRS(M4.create(), t, r, typeof s === 'number' ? [s, s, s] : s);
}

export function box(w = 1, h = 1, d = 1) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const position = [], normal = [], uv = [], index = [];
  const faces = [
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], o: [0, 0, hz] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], o: [0, 0, -hz] },
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], o: [hx, 0, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], o: [-hx, 0, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], o: [0, hy, 0] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], o: [0, -hy, 0] },
  ];
  const ext = [hx, hy, hz];
  for (const f of faces) {
    const su = Math.abs(f.u[0]) * ext[0] + Math.abs(f.u[1]) * ext[1] + Math.abs(f.u[2]) * ext[2];
    const sv = Math.abs(f.v[0]) * ext[0] + Math.abs(f.v[1]) * ext[1] + Math.abs(f.v[2]) * ext[2];
    const b = position.length / 3;
    for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      position.push(
        f.o[0] + f.u[0] * su * a + f.v[0] * sv * c,
        f.o[1] + f.u[1] * su * a + f.v[1] * sv * c,
        f.o[2] + f.u[2] * su * a + f.v[2] * sv * c,
      );
      normal.push(f.n[0], f.n[1], f.n[2]);
      uv.push((a + 1) / 2, (c + 1) / 2);
    }
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { position, normal, uv, index };
}

export function sphere(r = 1, seg = 18, rings = 12) {
  const position = [], normal = [], uv = [], index = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings, theta = v * Math.PI;
    for (let x = 0; x <= seg; x++) {
      const u = x / seg, phi = u * Math.PI * 2;
      const nx = Math.sin(theta) * Math.cos(phi);
      const ny = Math.cos(theta);
      const nz = Math.sin(theta) * Math.sin(phi);
      position.push(nx * r, ny * r, nz * r);
      normal.push(nx, ny, nz);
      uv.push(u, 1 - v);
    }
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < seg; x++) {
      const a = y * (seg + 1) + x, b = a + seg + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { position, normal, uv, index };
}

export function cylinder(r0 = 1, r1 = 1, h = 1, seg = 20, caps = true) {
  const position = [], normal = [], uv = [], index = [];
  const slope = (r0 - r1) / h;
  for (let y = 0; y <= 1; y++) {
    const r = y === 0 ? r0 : r1;
    for (let x = 0; x <= seg; x++) {
      const u = x / seg, phi = u * Math.PI * 2;
      const cx = Math.cos(phi), cz = Math.sin(phi);
      position.push(cx * r, (y - 0.5) * h, cz * r);
      const n = [cx, slope, cz];
      const l = Math.hypot(n[0], n[1], n[2]);
      normal.push(n[0] / l, n[1] / l, n[2] / l);
      uv.push(u, y);
    }
  }
  for (let x = 0; x < seg; x++) {
    const a = x, b = x + seg + 1;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  if (caps) {
    for (const [y, r, ny] of [[-0.5, r0, -1], [0.5, r1, 1]]) {
      if (r <= 0) continue;
      const c = position.length / 3;
      position.push(0, y * h, 0); normal.push(0, ny, 0); uv.push(0.5, 0.5);
      for (let x = 0; x <= seg; x++) {
        const phi = (x / seg) * Math.PI * 2;
        position.push(Math.cos(phi) * r, y * h, Math.sin(phi) * r);
        normal.push(0, ny, 0);
        uv.push(Math.cos(phi) * 0.5 + 0.5, Math.sin(phi) * 0.5 + 0.5);
      }
      for (let x = 0; x < seg; x++) {
        if (ny > 0) index.push(c, c + 1 + x, c + 2 + x);
        else index.push(c, c + 2 + x, c + 1 + x);
      }
    }
  }
  return { position, normal, uv, index };
}

export function torus(R = 1, r = 0.3, seg = 24, rseg = 12) {
  const position = [], normal = [], uv = [], index = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, phi = u * Math.PI * 2;
    const cx = Math.cos(phi), cz = Math.sin(phi);
    for (let j = 0; j <= rseg; j++) {
      const v = j / rseg, th = v * Math.PI * 2;
      const ct = Math.cos(th), st = Math.sin(th);
      const nx = cx * ct, ny = st, nz = cz * ct;
      position.push(cx * R + nx * r, ny * r, cz * R + nz * r);
      normal.push(nx, ny, nz);
      uv.push(u, v);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rseg; j++) {
      const a = i * (rseg + 1) + j, b = a + rseg + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { position, normal, uv, index };
}

// Rotate a 2D profile ([[r,y],...]) around the Y axis.
export function lathe(profile, seg = 24) {
  const position = [], normal = [], uv = [], index = [];
  const n = profile.length;
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, phi = u * Math.PI * 2;
    const cx = Math.cos(phi), cz = Math.sin(phi);
    for (let j = 0; j < n; j++) {
      const [r, y] = profile[j];
      position.push(cx * r, y, cz * r);
      const jp = profile[Math.min(j + 1, n - 1)];
      const jm = profile[Math.max(j - 1, 0)];
      const dr = jp[0] - jm[0], dy = jp[1] - jm[1];
      let nr = dy, ny = -dr;
      const l = Math.hypot(nr, ny) || 1;
      nr /= l; ny /= l;
      normal.push(cx * nr, ny, cz * nr);
      uv.push(u, j / (n - 1));
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j, b = a + n;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { position, normal, uv, index };
}

// Sweep a circle along a polyline. radius may be a number or f(t).
export function tube(path, radius, seg = 10) {
  const position = [], normal = [], uv = [], index = [];
  const n = path.length;
  const up = V3.create(0, 1, 0);
  const alt = V3.create(1, 0, 0);
  const tan = V3.create(), nrm = V3.create(), bin = V3.create(), tmp = V3.create();
  for (let i = 0; i < n; i++) {
    const p = path[i];
    const a = path[Math.max(i - 1, 0)], b = path[Math.min(i + 1, n - 1)];
    V3.norm(tan, V3.sub(tmp, b, a));
    const ref = Math.abs(V3.dot(tan, up)) > 0.9 ? alt : up;
    V3.norm(bin, V3.cross(V3.create(), tan, ref));
    V3.norm(nrm, V3.cross(V3.create(), bin, tan));
    const t = i / (n - 1);
    const r = typeof radius === 'function' ? radius(t) : radius;
    for (let j = 0; j <= seg; j++) {
      const phi = (j / seg) * Math.PI * 2;
      const c = Math.cos(phi), s = Math.sin(phi);
      const nx = nrm[0] * c + bin[0] * s;
      const ny = nrm[1] * c + bin[1] * s;
      const nz = nrm[2] * c + bin[2] * s;
      position.push(p[0] + nx * r, p[1] + ny * r, p[2] + nz * r);
      normal.push(nx, ny, nz);
      uv.push(j / seg, t);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + seg + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { position, normal, uv, index };
}

export function plane(w = 1, d = 1, nx = 1, nz = 1, axis = 'xz') {
  const position = [], normal = [], uv = [], index = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / nz;
      const a = (u - 0.5) * w, b = (v - 0.5) * d;
      if (axis === 'xz') { position.push(a, 0, b); normal.push(0, 1, 0); }
      else { position.push(a, b, 0); normal.push(0, 0, 1); }
      uv.push(u, v);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + nx + 1;
      if (axis === 'xz') index.push(a, b, a + 1, a + 1, b, b + 1);
      else index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return { position, normal, uv, index };
}

// Flat disc in the XZ plane, subdivided so a surface shader can ripple it.
export function disc(r = 1, seg = 40, rings = 10) {
  const position = [], normal = [], uv = [], index = [];
  position.push(0, 0, 0); normal.push(0, 1, 0); uv.push(0.5, 0.5);
  for (let j = 1; j <= rings; j++) {
    const rr = (j / rings) * r;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      position.push(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      normal.push(0, 1, 0);
      uv.push(Math.cos(a) * (j / rings) * 0.5 + 0.5, Math.sin(a) * (j / rings) * 0.5 + 0.5);
    }
  }
  for (let i = 0; i < seg; i++) index.push(0, 1 + i, 1 + ((i + 1) % seg));
  for (let j = 1; j < rings; j++) {
    const b0 = 1 + (j - 1) * seg, b1 = 1 + j * seg;
    for (let i = 0; i < seg; i++) {
      const i2 = (i + 1) % seg;
      index.push(b0 + i, b1 + i, b0 + i2, b0 + i2, b1 + i, b1 + i2);
    }
  }
  return { position, normal, uv, index };
}

// A capsule, used for limbs and the artisan's body.
export function capsule(r = 0.2, h = 0.6, seg = 14, rings = 6) {
  const profile = [];
  for (let i = 0; i <= rings; i++) {
    const t = (i / rings) * Math.PI / 2;
    profile.push([Math.sin(t) * r, -h / 2 - Math.cos(t) * r]);
  }
  for (let i = 0; i <= rings; i++) {
    const t = (i / rings) * Math.PI / 2;
    profile.push([Math.cos(t) * r, h / 2 + Math.sin(t) * r]);
  }
  return lathe(profile, seg);
}
