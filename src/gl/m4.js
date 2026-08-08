/* =========================================================================
   m4.js — minimal column-major mat4 / vec3 maths for the renderer
   Scene units are millimetres; matrices are plain Float32Array(16).
   ========================================================================= */
'use strict';

const V3 = {
  make: (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]),
  set(o, x, y, z) { o[0] = x; o[1] = y; o[2] = z; return o; },
  copy(o, a) { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; },
  add(o, a, b) { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; },
  sub(o, a, b) { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; },
  scale(o, a, s) { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; },
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: a => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm(o, a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
  },
  cross(o, a, b) {
    const x = a[1] * b[2] - a[2] * b[1];
    const y = a[2] * b[0] - a[0] * b[2];
    const z = a[0] * b[1] - a[1] * b[0];
    o[0] = x; o[1] = y; o[2] = z; return o;
  },
  lerp(o, a, b, t) {
    o[0] = a[0] + (b[0] - a[0]) * t;
    o[1] = a[1] + (b[1] - a[1]) * t;
    o[2] = a[2] + (b[2] - a[2]) * t; return o;
  }
};

const M4 = {
  make: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  ident(o) {
    o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  },
  copy(o, a) { o.set(a); return o; },

  mul(o, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },

  translate(o, x, y, z) {
    this.ident(o); o[12] = x; o[13] = y; o[14] = z; return o;
  },
  scaling(o, x, y, z) {
    this.ident(o); o[0] = x; o[5] = y; o[10] = z; return o;
  },
  rotX(o, r) {
    const c = Math.cos(r), s = Math.sin(r);
    this.ident(o); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o;
  },
  rotY(o, r) {
    const c = Math.cos(r), s = Math.sin(r);
    this.ident(o); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o;
  },
  rotZ(o, r) {
    const c = Math.cos(r), s = Math.sin(r);
    this.ident(o); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o;
  },
  /** axis must be normalised */
  rotAxis(o, ax, ay, az, r) {
    const c = Math.cos(r), s = Math.sin(r), t = 1 - c;
    this.ident(o);
    o[0] = t * ax * ax + c;      o[1] = t * ax * ay + s * az; o[2] = t * ax * az - s * ay;
    o[4] = t * ax * ay - s * az; o[5] = t * ay * ay + c;      o[6] = t * ay * az + s * ax;
    o[8] = t * ax * az + s * ay; o[9] = t * ay * az - s * ax; o[10] = t * az * az + c;
    return o;
  },

  perspective(o, fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf;
    o[11] = -1; o[14] = 2 * far * near * nf;
    return o;
  },
  ortho(o, l, r, b, t, n, f) {
    o.fill(0);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b);
    o[14] = -(f + n) / (f - n); o[15] = 1;
    return o;
  },
  lookAt(o, eye, at, up) {
    let zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    o[15] = 1;
    return o;
  },

  invert(o, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return this.ident(o);
    det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
  transpose(o, m) {
    const t = m === o ? m.slice() : m;
    o[0] = t[0]; o[1] = t[4]; o[2] = t[8]; o[3] = t[12];
    o[4] = t[1]; o[5] = t[5]; o[6] = t[9]; o[7] = t[13];
    o[8] = t[2]; o[9] = t[6]; o[10] = t[10]; o[11] = t[14];
    o[12] = t[3]; o[13] = t[7]; o[14] = t[11]; o[15] = t[15];
    return o;
  },
  /** upper-left 3x3, inverse-transposed, packed as mat3 (9 floats) */
  normalMat(o9, m) {
    const t = M4.invert(M4.make(), m);
    o9[0] = t[0]; o9[1] = t[4]; o9[2] = t[8];
    o9[3] = t[1]; o9[4] = t[5]; o9[5] = t[9];
    o9[6] = t[2]; o9[7] = t[6]; o9[8] = t[10];
    return o9;
  },
  xformPoint(o, m, p) {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return o;
  },
  xformDir(o, m, p) {
    const x = p[0], y = p[1], z = p[2];
    o[0] = m[0] * x + m[4] * y + m[8] * z;
    o[1] = m[1] * x + m[5] * y + m[9] * z;
    o[2] = m[2] * x + m[6] * y + m[10] * z;
    return o;
  },
  /** compose translate * rotZ * rotY * rotX * scale */
  compose(o, tx, ty, tz, rx, ry, rz, kx, ky, kz) {
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);
    // R = Rz * Ry * Rx, stored column-major
    const m00 = cz * cy,               m01 = sz * cy,               m02 = -sy;
    const m10 = cz * sy * sx - sz * cx, m11 = sz * sy * sx + cz * cx, m12 = cy * sx;
    const m20 = cz * sy * cx + sz * sx, m21 = sz * sy * cx - cz * sx, m22 = cy * cx;
    o[0] = m00 * kx; o[1] = m01 * kx; o[2] = m02 * kx; o[3] = 0;
    o[4] = m10 * ky; o[5] = m11 * ky; o[6] = m12 * ky; o[7] = 0;
    o[8] = m20 * kz; o[9] = m21 * kz; o[10] = m22 * kz; o[11] = 0;
    o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
    return o;
  }
};
