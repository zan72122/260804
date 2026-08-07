/* 最小限の行列・ベクトル演算（列優先、gl-matrix互換のレイアウト） */
(function (root) {
  'use strict';
  var DD = (root.DD = root.DD || {});

  var m4 = {};

  m4.create = function () {
    var o = new Float32Array(16);
    o[0] = o[5] = o[10] = o[15] = 1;
    return o;
  };

  m4.identity = function (o) {
    o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
    o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
    return o;
  };

  m4.copy = function (o, a) { o.set(a); return o; };

  m4.mul = function (o, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
      a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
      a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b0, b1, b2, b3;
    for (var i = 0; i < 4; i++) {
      b0 = b[i * 4]; b1 = b[i * 4 + 1]; b2 = b[i * 4 + 2]; b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  };

  m4.perspective = function (o, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
    o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
    return o;
  };

  m4.ortho = function (o, l, r, b, t, n, f) {
    var lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    o[0] = -2 * lr; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = -2 * bt; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = 2 * nf; o[11] = 0;
    o[12] = (l + r) * lr; o[13] = (t + b) * bt; o[14] = (f + n) * nf; o[15] = 1;
    return o;
  };

  m4.lookAt = function (o, eye, center, up) {
    var z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
    var len = Math.hypot(z0, z1, z2);
    if (len < 1e-6) { z0 = 0; z1 = 0; z2 = 1; len = 1; }
    len = 1 / len; z0 *= len; z1 *= len; z2 *= len;
    var x0 = up[1] * z2 - up[2] * z1,
      x1 = up[2] * z0 - up[0] * z2,
      x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2);
    if (len < 1e-6) { x0 = 1; x1 = 0; x2 = 0; len = 1; }
    len = 1 / len; x0 *= len; x1 *= len; x2 *= len;
    var y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    o[0] = x0; o[1] = y0; o[2] = z0; o[3] = 0;
    o[4] = x1; o[5] = y1; o[6] = z1; o[7] = 0;
    o[8] = x2; o[9] = y2; o[10] = z2; o[11] = 0;
    o[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    o[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    o[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    o[15] = 1;
    return o;
  };

  m4.invert = function (o, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
      a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
      a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10,
      b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31,
      b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1.0 / det;
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
  };

  /* 平行移動 → Y回転 → X回転 → Z回転 → スケール（TRS） */
  m4.trs = function (o, tx, ty, tz, rx, ry, rz, s) {
    s = (s === undefined) ? 1 : s;
    var cx = Math.cos(rx), sx = Math.sin(rx);
    var cy = Math.cos(ry), sy = Math.sin(ry);
    var cz = Math.cos(rz), sz = Math.sin(rz);
    // R = Ry * Rx * Rz
    var m00 = cy * cz + sy * sx * sz;
    var m01 = cx * sz;
    var m02 = -sy * cz + cy * sx * sz;
    var m10 = -cy * sz + sy * sx * cz;
    var m11 = cx * cz;
    var m12 = sy * sz + cy * sx * cz;
    var m20 = sy * cx;
    var m21 = -sx;
    var m22 = cy * cx;
    o[0] = m00 * s; o[1] = m01 * s; o[2] = m02 * s; o[3] = 0;
    o[4] = m10 * s; o[5] = m11 * s; o[6] = m12 * s; o[7] = 0;
    o[8] = m20 * s; o[9] = m21 * s; o[10] = m22 * s; o[11] = 0;
    o[12] = tx; o[13] = ty; o[14] = tz; o[15] = 1;
    return o;
  };

  m4.transformPoint = function (out, m, p) {
    var x = p[0], y = p[1], z = p[2];
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    w = w || 1;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
  };

  m4.transformDir = function (out, m, p) {
    var x = p[0], y = p[1], z = p[2];
    out[0] = m[0] * x + m[4] * y + m[8] * z;
    out[1] = m[1] * x + m[5] * y + m[9] * z;
    out[2] = m[2] * x + m[6] * y + m[10] * z;
    return out;
  };

  /* mat4 の左上3x3の逆転置（法線行列）を mat3(=Float32Array(9)) に */
  m4.normalMatrix = function (out, m) {
    var a00 = m[0], a01 = m[1], a02 = m[2],
      a10 = m[4], a11 = m[5], a12 = m[6],
      a20 = m[8], a21 = m[9], a22 = m[10];
    var b01 = a22 * a11 - a12 * a21;
    var b11 = -a22 * a10 + a12 * a20;
    var b21 = a21 * a10 - a11 * a20;
    var det = a00 * b01 + a01 * b11 + a02 * b21;
    if (!det) { out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 1; out[5] = 0; out[6] = 0; out[7] = 0; out[8] = 1; return out; }
    det = 1.0 / det;
    out[0] = b01 * det;
    out[1] = (-a22 * a01 + a02 * a21) * det;
    out[2] = (a12 * a01 - a02 * a11) * det;
    out[3] = b11 * det;
    out[4] = (a22 * a00 - a02 * a20) * det;
    out[5] = (-a12 * a00 + a02 * a10) * det;
    out[6] = b21 * det;
    out[7] = (-a21 * a00 + a01 * a20) * det;
    out[8] = (a11 * a00 - a01 * a10) * det;
    return out;
  };

  /* Y=level 平面に関する鏡像行列 */
  m4.mirrorY = function (o, level) {
    m4.identity(o);
    o[5] = -1;
    o[13] = 2 * level;
    return o;
  };

  var v3 = {};
  v3.create = function (x, y, z) { return new Float32Array([x || 0, y || 0, z || 0]); };
  v3.set = function (o, x, y, z) { o[0] = x; o[1] = y; o[2] = z; return o; };
  v3.sub = function (o, a, b) { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; };
  v3.add = function (o, a, b) { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; };
  v3.scale = function (o, a, s) { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; };
  v3.dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  v3.cross = function (o, a, b) {
    var x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
    o[0] = x; o[1] = y; o[2] = z; return o;
  };
  v3.len = function (a) { return Math.hypot(a[0], a[1], a[2]); };
  v3.norm = function (o, a) {
    var l = Math.hypot(a[0], a[1], a[2]);
    if (l < 1e-9) { o[0] = 0; o[1] = 0; o[2] = 0; return o; }
    l = 1 / l; o[0] = a[0] * l; o[1] = a[1] * l; o[2] = a[2] * l; return o;
  };
  v3.lerp = function (o, a, b, t) {
    o[0] = a[0] + (b[0] - a[0]) * t;
    o[1] = a[1] + (b[1] - a[1]) * t;
    o[2] = a[2] + (b[2] - a[2]) * t;
    return o;
  };

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  /* フレームレート非依存の指数追従 */
  function approach(cur, target, rate, dt) {
    return target + (cur - target) * Math.exp(-rate * dt);
  }

  DD.m4 = m4;
  DD.v3 = v3;
  DD.util = {
    clamp: clamp, lerp: lerp, smoothstep: smoothstep, approach: approach,
    TAU: Math.PI * 2, DEG: Math.PI / 180
  };
})(typeof window !== 'undefined' ? window : this);
