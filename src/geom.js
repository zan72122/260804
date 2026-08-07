/* 手続き的ジオメトリ生成。単位はメートル。
   頂点レイアウト: pos(3) nrm(3) uv(2) col(3)
   座標系: X = ドック長手（船首が +X）, Y = 上, Z = 左右 */
(function (root) {
  'use strict';
  var DD = (root.DD = root.DD || {});
  var m4 = DD.m4, U = DD.util;

  /* ---------------- 世界の寸法 ---------------- */
  var W = {
    FLOOR_Y: 0,          // ドック底
    COPING_Y: 16.0,      // ドック天端（ヤード面）
    SEA_Y: 13.4,         // 外海の水面（陸は 2.6m の余裕を持つ）
    DOCK_X0: -116,       // ドック内法（ゲート側）
    DOCK_X1: 116,        // ドック内法（奥）
    DOCK_HW: 20.0,       // ドック内法 半幅
    GATE_X: -116,        // ゲート中心の X
    GATE_THICK: 7.0,
    BLOCK_TOP: 2.6,      // 盤木の天端
    SHIP_LEN: 182,
    SHIP_BEAM: 28,
    SHIP_DEPTH: 15,
    SHIP_DRAFT: 6.8,
    PROP_X: -86.8,       // 船体ローカル
    PROP_Y: 3.4,
    PROP_R: 3.10,
    RUDDER_X: -90.8,
    RUDDER_Y: 0.9,
    SHORE_X: -300,       // 陸の海側の縁（岸壁前面）
    CH_HW: 24.0,         // 入口水路の半幅
    SILL_Y: 2.6,         // 入口の敷居
    LAND_X1: 360,        // 陸の奥行き（+X）
    LAND_Z: 1250,        // 陸の広がり（±Z）
    TOP_HW: 23.2         // ドック壁天端の外縁
  };
  W.ALTARS = [
    { y0: 0.0, y1: 5.2, hw: 20.0 },
    { y0: 5.2, y1: 10.4, hw: 21.6 },
    { y0: 10.4, y1: 16.0, hw: 23.2 }
  ];
  W.SHIP_FLOAT_Y = W.SEA_Y - W.SHIP_DRAFT;  // 浮上時のキール高さ = 6.5
  W.SHIP_LAND_Y = W.BLOCK_TOP;              // 着底時のキール高さ = 2.6
  W.LAND_LEVEL = W.SHIP_LAND_Y + W.SHIP_DRAFT; // 着底が起きる水位 = 9.1

  /* ---------------- 乱数（決定的） ---------------- */
  var _seed = 1;
  function srand(s) { _seed = s | 0 || 1; }
  function rnd() {
    _seed ^= _seed << 13; _seed |= 0;
    _seed ^= _seed >>> 17;
    _seed ^= _seed << 5; _seed |= 0;
    return ((_seed >>> 0) % 100000) / 100000;
  }
  function rr(a, b) { return a + (b - a) * rnd(); }

  /* ---------------- MeshBuilder ---------------- */
  function MB() {
    this.v = [];        // float 列
    this.i = [];
    this.stack = [];
    this.m = m4.create();
    this.nm = new Float32Array(9);
    this.col = [0.5, 0.5, 0.5];
    this._tmp = new Float32Array(3);
    this._dirty = true;
  }
  MB.prototype.push = function () { this.stack.push(new Float32Array(this.m)); return this; };
  MB.prototype.pop = function () { this.m = this.stack.pop(); this._dirty = true; return this; };
  MB.prototype.ident = function () { m4.identity(this.m); this._dirty = true; return this; };
  MB.prototype.mul = function (t) { m4.mul(this.m, this.m, t); this._dirty = true; return this; };
  var _t = m4.create();
  MB.prototype.translate = function (x, y, z) { m4.trs(_t, x, y, z, 0, 0, 0, 1); return this.mul(_t); };
  MB.prototype.rotY = function (a) { m4.trs(_t, 0, 0, 0, 0, a, 0, 1); return this.mul(_t); };
  MB.prototype.rotX = function (a) { m4.trs(_t, 0, 0, 0, a, 0, 0, 1); return this.mul(_t); };
  MB.prototype.rotZ = function (a) { m4.trs(_t, 0, 0, 0, 0, 0, a, 1); return this.mul(_t); };
  MB.prototype.scale = function (x, y, z) {
    m4.identity(_t); _t[0] = x; _t[5] = y; _t[10] = z; return this.mul(_t);
  };
  /* sRGB → リニア */
  function s2l(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  MB.prototype.color = function (r, g, b) {
    if (typeof r === 'string') {
      var h = parseInt(r.slice(1), 16);
      b = (h & 255) / 255; g = ((h >> 8) & 255) / 255; r = ((h >> 16) & 255) / 255;
    }
    this.col[0] = s2l(r); this.col[1] = s2l(g); this.col[2] = s2l(b);
    return this;
  };
  MB.prototype.colorJit = function (r, g, b, amt) {
    var k = 1 + rr(-amt, amt);
    if (typeof r === 'string') { this.color(r); this.col[0] *= k; this.col[1] *= k; this.col[2] *= k; return this; }
    return this.color(r * k, g * k, b * k);
  };
  MB.prototype.vcount = function () { return this.v.length / 11; };
  MB.prototype.vert = function (x, y, z, nx, ny, nz, u, vv) {
    var m = this.m;
    if (this._dirty) { m4.normalMatrix(this.nm, m); this._dirty = false; }
    var w = m[3] * x + m[7] * y + m[11] * z + m[15]; if (!w) w = 1;
    var px = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    var py = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    var pz = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    var n = this.nm;
    var ax = n[0] * nx + n[3] * ny + n[6] * nz;
    var ay = n[1] * nx + n[4] * ny + n[7] * nz;
    var az = n[2] * nx + n[5] * ny + n[8] * nz;
    var l = Math.hypot(ax, ay, az) || 1;
    this.v.push(px, py, pz, ax / l, ay / l, az / l, u || 0, vv || 0, this.col[0], this.col[1], this.col[2]);
    return this;
  };
  MB.prototype.tri = function (a, b, c) { this.i.push(a, b, c); return this; };
  MB.prototype.quad = function (a, b, c, d) { this.i.push(a, b, c, a, c, d); return this; };

  /* 4点から面を張る（法線は自動） */
  MB.prototype.face = function (p0, p1, p2, p3, uvScale) {
    var ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    var vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    var s = uvScale || 1;
    var lu = Math.hypot(ux, uy, uz) * s, lv = Math.hypot(vx, vy, vz) * s;
    var b = this.vcount();
    this.vert(p0[0], p0[1], p0[2], nx, ny, nz, 0, 0);
    this.vert(p1[0], p1[1], p1[2], nx, ny, nz, lu, 0);
    this.vert(p2[0], p2[1], p2[2], nx, ny, nz, lu, lv);
    this.vert(p3[0], p3[1], p3[2], nx, ny, nz, 0, lv);
    this.quad(b, b + 1, b + 2, b + 3);
    return this;
  };

  /* 中心原点の直方体 */
  MB.prototype.box = function (w, h, d, uvScale) {
    var x = w / 2, y = h / 2, z = d / 2;
    this.face([-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], uvScale);      // +Z
    this.face([x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], uvScale);  // -Z
    this.face([x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], uvScale);      // +X
    this.face([-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], uvScale);  // -X
    this.face([-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], uvScale);      // +Y
    this.face([-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], uvScale);  // -Y
    return this;
  };
  /* min/max で指定する直方体 */
  MB.prototype.boxMM = function (x0, y0, z0, x1, y1, z1, uvScale) {
    this.push();
    this.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.box(x1 - x0, y1 - y0, z1 - z0, uvScale);
    this.pop();
    return this;
  };
  /* Y軸に沿った円柱・円錐台 */
  MB.prototype.cyl = function (r0, r1, h, seg, caps) {
    seg = seg || 12;
    var b = this.vcount(), i;
    var slope = (r0 - r1) / h;
    for (i = 0; i <= seg; i++) {
      var a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      var ny = slope / Math.hypot(1, slope), k = 1 / Math.hypot(1, slope);
      this.vert(ca * r0, 0, sa * r0, ca * k, ny, sa * k, i / seg, 0);
      this.vert(ca * r1, h, sa * r1, ca * k, ny, sa * k, i / seg, 1);
    }
    for (i = 0; i < seg; i++) {
      this.quad(b + i * 2, b + i * 2 + 1, b + i * 2 + 3, b + i * 2 + 2);
    }
    if (caps !== false) {
      if (r1 > 1e-4) {
        var c1 = this.vcount(); this.vert(0, h, 0, 0, 1, 0, .5, .5);
        for (i = 0; i <= seg; i++) { var a1 = i / seg * Math.PI * 2; this.vert(Math.cos(a1) * r1, h, Math.sin(a1) * r1, 0, 1, 0, 0, 0); }
        for (i = 0; i < seg; i++) this.tri(c1, c1 + 2 + i, c1 + 1 + i);
      }
      if (r0 > 1e-4) {
        var c0 = this.vcount(); this.vert(0, 0, 0, 0, -1, 0, .5, .5);
        for (i = 0; i <= seg; i++) { var a0 = i / seg * Math.PI * 2; this.vert(Math.cos(a0) * r0, 0, Math.sin(a0) * r0, 0, -1, 0, 0, 0); }
        for (i = 0; i < seg; i++) this.tri(c0, c0 + 1 + i, c0 + 2 + i);
      }
    }
    return this;
  };
  /* 2点間をつなぐ棒（斜材用） */
  MB.prototype.strut = function (x0, y0, z0, x1, y1, z1, r, seg) {
    var dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    var len = Math.hypot(dx, dy, dz);
    var yaw = Math.atan2(dx, dz);
    var pitch = Math.acos(U.clamp(dy / (len || 1), -1, 1));
    this.push();
    this.translate(x0, y0, z0);
    this.rotY(yaw);
    this.rotX(pitch);
    this.cyl(r, r, len, seg || 6);
    this.pop();
    return this;
  };
  /* 球（低ポリ） */
  MB.prototype.sphere = function (r, seg, ring, sy) {
    seg = seg || 12; ring = ring || 8; sy = sy === undefined ? 1 : sy;
    var b = this.vcount(), i, j;
    for (j = 0; j <= ring; j++) {
      var phi = j / ring * Math.PI;
      for (i = 0; i <= seg; i++) {
        var th = i / seg * Math.PI * 2;
        var nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        this.vert(nx * r, ny * r * sy, nz * r, nx, ny / (sy || 1), nz, i / seg, j / ring);
      }
    }
    for (j = 0; j < ring; j++) for (i = 0; i < seg; i++) {
      var a = b + j * (seg + 1) + i;
      this.quad(a, a + 1, a + seg + 2, a + seg + 1);
    }
    return this;
  };
  /* パラメトリック曲面 fn(u,v,out) */
  MB.prototype.surface = function (nu, nv, fn, flip) {
    var b = this.vcount(), i, j;
    var P = [], out = [0, 0, 0];
    for (j = 0; j <= nv; j++) {
      for (i = 0; i <= nu; i++) {
        fn(i / nu, j / nv, out);
        P.push(out[0], out[1], out[2]);
      }
    }
    var stride = nu + 1;
    // 退化した極で使う重心
    var cx = 0, cy = 0, cz = 0, np = P.length / 3;
    for (var q = 0; q < np; q++) { cx += P[q * 3]; cy += P[q * 3 + 1]; cz += P[q * 3 + 2]; }
    cx /= np; cy /= np; cz /= np;
    for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) {
      var k = (j * stride + i) * 3;
      var ip = ((i < nu ? i + 1 : i) + j * stride) * 3;
      var im = ((i > 0 ? i - 1 : i) + j * stride) * 3;
      var jp = (i + (j < nv ? j + 1 : j) * stride) * 3;
      var jm = (i + (j > 0 ? j - 1 : j) * stride) * 3;
      var ax = P[ip] - P[im], ay = P[ip + 1] - P[im + 1], az = P[ip + 2] - P[im + 2];
      var bx = P[jp] - P[jm], by = P[jp + 1] - P[jm + 1], bz = P[jp + 2] - P[jm + 2];
      var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      var l = Math.hypot(nx, ny, nz);
      if (l < 1e-7) {
        // 極など、差分が消える点は重心からの方向で代用する
        nx = P[k] - cx; ny = P[k + 1] - cy; nz = P[k + 2] - cz;
        if (flip) { nx = -nx; ny = -ny; nz = -nz; }
        l = Math.hypot(nx, ny, nz) || 1;
      } else if (flip) { nx = -nx; ny = -ny; nz = -nz; }
      this.vert(P[k], P[k + 1], P[k + 2], nx / l, ny / l, nz / l, i / nu, j / nv);
    }
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a = b + j * stride + i;
      if (flip) this.quad(a, a + stride, a + stride + 1, a + 1);
      else this.quad(a, a + 1, a + stride + 1, a + stride);
    }
    return this;
  };
  MB.prototype.data = function () { return new Float32Array(this.v); };
  MB.prototype.mesh = function (gl, mode) { return new DD.gl.Mesh(gl, new Float32Array(this.v), this.i, mode); };
  MB.prototype.isEmpty = function () { return this.i.length === 0; };

  /* ================= 船体 ================= */
  var SHIP = {
    LEN: W.SHIP_LEN, BEAM: W.SHIP_BEAM, DEPTH: W.SHIP_DEPTH,
    X0: -W.SHIP_LEN * 0.5, // 船尾
  };
  function shipX(t) { return SHIP.X0 + t * SHIP.LEN; }

  function halfBeamAt(t) {
    // 浮動小数の誤差で pow() の底が負にならないよう必ず 0 で下限を切る
    var b, s;
    if (t > 0.70) { s = U.clamp((t - 0.70) / 0.30, 0, 1); b = Math.pow(1 - s, 0.52); }
    else if (t < 0.15) { s = U.clamp(t / 0.15, 0, 1); b = 0.74 + 0.26 * Math.pow(s, 0.6); }
    else b = 1;
    return SHIP.BEAM * 0.5 * b;
  }
  function keelYAt(t) {
    if (t > 0.945) { var s = (t - 0.945) / 0.055; return 6.2 * s * s; }
    if (t < 0.135) { var s2 = 1 - t / 0.135; return 9.6 * s2 * s2; }
    return 0;
  }
  function deckYAt(t) {
    // 船首側にわずかなシア
    var f = Math.max(0, (t - 0.55) / 0.45);
    var r = Math.max(0, (0.22 - t) / 0.22);
    return SHIP.DEPTH + 1.7 * f * f + 0.5 * r * r;
  }
  /* 断面: t=長手位置, vn=キールからデッキまでの正規化高さ → {y,z} */
  function hullSection(t, vn, out) {
    if (!(t >= 0)) t = 0; else if (t > 1) t = 1;
    var a = halfBeamAt(t);
    var y0 = keelYAt(t), y1 = deckYAt(t);
    var y = y0 + (y1 - y0) * vn;
    var yLocal = y - y0;                       // キールからの高さ
    var endness = Math.max(U.smoothstep(0.32, 0.02, t), U.smoothstep(0.60, 0.96, t));
    // ビルジ半径は半幅を超えない（超えると断面の z が負になる）
    var R = Math.min(a, Math.max(0, U.lerp(2.9, a, endness * endness)));
    var z;
    if (R > 1e-5 && yLocal < R) {
      var k = (R - yLocal) / R;
      z = a - R + R * Math.sqrt(Math.max(0, 1 - k * k));
    } else z = a;
    // 船尾の絞り（プロペラ周りのラン）
    var sternRun = U.smoothstep(0.27, 0.015, t);
    var low = U.smoothstep(0.46, 0.0, yLocal / Math.max(1, (y1 - y0)));
    z *= 1 - 0.70 * sternRun * low;
    // 船首の入り角
    var bowEnt = U.smoothstep(0.60, 0.97, t);
    z *= 1 - 0.45 * bowEnt * U.smoothstep(0.62, 0.0, yLocal / Math.max(1, (y1 - y0)));
    out[0] = shipX(t); out[1] = y; out[2] = z;
    return out;
  }

  /* 船体外板。washマスク用の UV も持つ。 */
  function buildHull(mb, NU, NV) {
    NU = NU || 96; NV = NV || 26;
    var sec = [0, 0, 0];
    // 舷側（左右）
    for (var side = 0; side < 2; side++) {
      var sgn = side === 0 ? 1 : -1;
      var base = mb.vcount();
      var P = [];
      for (var j = 0; j <= NV; j++) {
        for (var i = 0; i <= NU; i++) {
          hullSection(i / NU, j / NV, sec);
          P.push(sec[0], sec[1], sec[2] * sgn);
        }
      }
      var stride = NU + 1;
      for (var j2 = 0; j2 <= NV; j2++) for (var i2 = 0; i2 <= NU; i2++) {
        var k = (j2 * stride + i2) * 3;
        var ip = (Math.min(NU, i2 + 1) + j2 * stride) * 3;
        var im = (Math.max(0, i2 - 1) + j2 * stride) * 3;
        var jp = (i2 + Math.min(NV, j2 + 1) * stride) * 3;
        var jm = (i2 + Math.max(0, j2 - 1) * stride) * 3;
        var ax = P[ip] - P[im], ay = P[ip + 1] - P[im + 1], az = P[ip + 2] - P[im + 2];
        var bx = P[jp] - P[jm], by = P[jp + 1] - P[jm + 1], bz = P[jp + 2] - P[jm + 2];
        var nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        nx *= sgn; ny *= sgn; nz *= sgn;
        var l = Math.hypot(nx, ny, nz);
        if (l < 1e-7) {
          // 船首尾の先端など差分が消える点は、断面の外向き方向で代用する
          nx = (i2 > NU / 2) ? 1 : -1;
          ny = 0.15;
          nz = sgn * 0.6;
          l = Math.hypot(nx, ny, nz);
        }
        mb.vert(P[k], P[k + 1], P[k + 2], nx / l, ny / l, nz / l,
          i2 / NU, 0.5 + sgn * 0.5 * (j2 / NV));
      }
      for (var j3 = 0; j3 < NV; j3++) for (var i3 = 0; i3 < NU; i3++) {
        var a = base + j3 * stride + i3;
        if (sgn > 0) mb.quad(a, a + 1, a + stride + 1, a + stride);
        else mb.quad(a, a + stride, a + stride + 1, a + 1);
      }
    }
    // トランサム（t=0 の開口を塞ぐ）
    var tc = mb.vcount();
    for (var jt = 0; jt <= NV; jt++) {
      hullSection(0, jt / NV, sec);
      mb.vert(sec[0], sec[1], sec[2], -1, 0, 0, 0.0, 0.5 + 0.5 * (jt / NV));
      mb.vert(sec[0], sec[1], -sec[2], -1, 0, 0, 0.0, 0.5 - 0.5 * (jt / NV));
    }
    for (var jt2 = 0; jt2 < NV; jt2++) {
      mb.quad(tc + jt2 * 2, tc + jt2 * 2 + 2, tc + jt2 * 2 + 3, tc + jt2 * 2 + 1);
    }
    // 船底の中心線を塞ぐ（vn=0 の左右をつなぐ帯）
    var bb = mb.vcount();
    for (var i4 = 0; i4 <= NU; i4++) {
      hullSection(i4 / NU, 0, sec);
      mb.vert(sec[0], sec[1], sec[2], 0, -1, 0, i4 / NU, 0.5 + 0.5 * 0.02);
      mb.vert(sec[0], sec[1], -sec[2], 0, -1, 0, i4 / NU, 0.5 - 0.5 * 0.02);
    }
    for (var i5 = 0; i5 < NU; i5++) {
      mb.quad(bb + i5 * 2, bb + i5 * 2 + 1, bb + i5 * 2 + 3, bb + i5 * 2 + 2);
    }
    return mb;
  }

  /* レイキャスト用の粗い船体（船体ローカル座標の三角形リスト） */
  function buildHullCollider() {
    var NU = 40, NV = 12, sec = [0, 0, 0];
    var tris = [];
    for (var side = 0; side < 2; side++) {
      var sgn = side === 0 ? 1 : -1;
      var grid = [];
      for (var j = 0; j <= NV; j++) {
        var row = [];
        for (var i = 0; i <= NU; i++) {
          hullSection(i / NU, j / NV, sec);
          row.push([sec[0], sec[1], sec[2] * sgn, i / NU, 0.5 + sgn * 0.5 * (j / NV)]);
        }
        grid.push(row);
      }
      for (var j2 = 0; j2 < NV; j2++) for (var i2 = 0; i2 < NU; i2++) {
        var a = grid[j2][i2], b = grid[j2 + 1][i2], c = grid[j2 + 1][i2 + 1], d = grid[j2][i2 + 1];
        tris.push([a, b, c], [a, c, d]);
      }
    }
    return tris;
  }

  /* 船底の付加物：スケグ、シャフト、ボス、バルバスバウ、ビルジキール */
  function buildHullExtras(mb) {
    // バルバスバウ
    mb.push();
    mb.translate(SHIP.X0 + SHIP.LEN * 0.985, 3.4, 0);
    mb.rotZ(Math.PI / 2);
    mb.scale(1, 1, 1);
    mb.push(); mb.scale(1, 1, 1);
    // 前方に伸びる回転体
    mb.surface(16, 14, function (u, v, o) {
      var th = u * Math.PI * 2;
      var s = v;                       // 0=後端 1=先端
      var r = 3.0 * Math.sin(Math.PI * Math.pow(s, 0.75)) * (1 - 0.25 * s);
      o[0] = Math.cos(th) * r;
      o[1] = -(s * 12.5 - 4.0);
      o[2] = Math.sin(th) * r * 0.85;
    });
    mb.pop();
    mb.pop();
    // デッドウッド（船尾の中心線フィン：船体底からプロペラ軸へ降ろす）
    function dwTop(t) { return keelYAt(t); }
    function dwBot(t) {
      var top = keelYAt(t);
      var h = 6.4 * U.smoothstep(0.0, 0.024, t) * (1 - U.smoothstep(0.055, 0.150, t));
      return Math.min(top, Math.max(top - h, W.PROP_Y - 1.05));
    }
    for (var sd = -1; sd <= 1; sd += 2) {
      mb.surface(20, 5, function (u, v, o) {
        var t = 0.002 + u * 0.155;
        var top = dwTop(t), bot = dwBot(t);
        var th = 1.15 * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.25)));
        o[0] = shipX(t);
        o[1] = U.lerp(bot, top, v);
        o[2] = sd * th * (0.55 + 0.45 * v);
      }, sd < 0);
      // フィン下端の丸み
      mb.surface(20, 1, function (u, v, o) {
        var t = 0.002 + u * 0.155;
        var th = 1.15 * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.25))) * 0.55;
        o[0] = shipX(t);
        o[1] = dwBot(t);
        o[2] = (v * 2 - 1) * th;
      }, sd < 0);
    }
    // シャフトボス
    mb.push();
    mb.translate(W.PROP_X - 0.6, W.PROP_Y, 0);
    mb.rotZ(-Math.PI / 2);
    mb.cyl(1.05, 1.9, 9.5, 14);
    mb.pop();
    // ビルジキール（左右）
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      mb.surface(20, 1, function (u, v, o) {
        var t = 0.28 + u * 0.42;
        var a = halfBeamAt(t);
        var yl = 2.4;
        var w = 0.75 * Math.sin(Math.PI * u);
        o[0] = shipX(t);
        o[1] = yl - v * w * 0.35;
        o[2] = s2 * (a - 0.45 + v * w);
      }, s2 < 0);
    }
    return mb;
  }

  /* 舵（翼型） */
  function buildRudder(mb) {
    var CH = 4.9, H = 7.8;
    mb.surface(18, 8, function (u, v, o) {
      var th = u * Math.PI * 2;
      var c = Math.cos(th), s = Math.sin(th);
      var xc = -c * 0.5 + 0.5;           // 0..1 コード方向
      var thick = 0.16 * CH * Math.sin(Math.PI * Math.pow(xc, 0.72)) * Math.sign(s || 1) * Math.abs(s > 0 ? 1 : 1);
      var taper = 1 - 0.20 * v;
      o[0] = (xc - 0.32) * CH * taper;
      o[1] = v * H;
      o[2] = (s >= 0 ? 1 : -1) * 0.17 * CH * Math.sin(Math.PI * Math.pow(xc, 0.7)) * taper;
    });
    return mb;
  }

  /* プロペラ（ハブ + 5枚翼）。原点はハブ中心、軸は X */
  function buildPropeller(mb) {
    var R = W.PROP_R;
    mb.push();
    mb.rotZ(-Math.PI / 2);
    mb.cyl(1.05, 0.78, 2.3, 16);
    mb.pop();
    mb.push(); mb.translate(-2.35, 0, 0); mb.rotZ(-Math.PI / 2); mb.cyl(0.78, 0.15, 0.9, 16); mb.pop();
    for (var b = 0; b < 5; b++) {
      var ang = b / 5 * Math.PI * 2;
      mb.push();
      mb.rotX(ang);
      mb.surface(12, 10, function (u, v, o) {
        var r = 0.95 + v * (R - 0.95);
        var rn = v;
        var chord = 2.6 * (0.55 + 0.75 * Math.sin(Math.PI * Math.pow(rn, 0.55)) - 0.3 * rn * rn);
        var pitch = 0.72 - 0.36 * rn;          // ピッチ角
        var s = (u < 0.5) ? (u * 2) : (2 - u * 2);
        var sideSign = u < 0.5 ? 1 : -1;
        var cpos = (s - 0.42) * chord;
        var camber = 0.14 * chord * Math.sin(Math.PI * s) * 0.9;
        var thick = 0.10 * chord * Math.sin(Math.PI * Math.pow(s, 0.7)) * (1 - 0.55 * rn);
        var xl = cpos * Math.cos(pitch) + (camber + sideSign * thick) * Math.sin(pitch);
        var yl = cpos * Math.sin(pitch) - (camber + sideSign * thick) * Math.cos(pitch);
        // スキュー（後退）
        var skew = 0.55 * rn * rn;
        o[0] = xl;
        o[1] = Math.cos(skew) * r - 0;
        o[2] = yl + Math.sin(skew) * r * 0.0;
        // r 方向へ配置（Y が半径方向）
        var yy = r + 0;
        o[1] = yy;
        var rot = skew;
        var ry = o[1] * Math.cos(rot) - o[2] * Math.sin(rot);
        var rz = o[1] * Math.sin(rot) + o[2] * Math.cos(rot);
        o[1] = ry; o[2] = rz;
      });
      mb.pop();
    }
    return mb;
  }

  /* 上部構造・甲板まわり */
  function buildShipTop(mbPaint, mbMetal) {
    var mb = mbPaint;
    var sec = [0, 0, 0];
    // 甲板
    mb.color('#5c5f63');
    var NU = 60;
    var b = mb.vcount();
    for (var i = 0; i <= NU; i++) {
      var t = i / NU;
      hullSection(t, 1, sec);
      mb.vert(sec[0], sec[1] - 0.05, sec[2], 0, 1, 0, t * 12, 1);
      mb.vert(sec[0], sec[1] - 0.05, -sec[2], 0, 1, 0, t * 12, 0);
    }
    for (var i2 = 0; i2 < NU; i2++) mb.quad(b + i2 * 2, b + i2 * 2 + 2, b + i2 * 2 + 3, b + i2 * 2 + 1);
    // ブルワーク
    mb.color('#2b3550');
    for (var s = -1; s <= 1; s += 2) {
      mb.surface(50, 1, function (u, v, o) {
        var t = 0.02 + u * 0.96;
        hullSection(t, 1, sec);
        o[0] = sec[0]; o[1] = sec[1] - 0.1 + v * 1.35; o[2] = s * (sec[2] - 0.12 * v);
      }, s < 0);
    }
    // ハッチカバー（7 個）
    mb.color('#7c8087');
    for (var h = 0; h < 7; h++) {
      var t0 = 0.185 + h * 0.098;
      var cx = shipX(t0);
      var hw = halfBeamAt(t0) * 0.62;
      var dy = deckYAt(t0);
      mb.push();
      mb.translate(cx, dy + 0.85, 0);
      mb.box(14.5, 1.7, hw * 2, 0.25);
      mb.pop();
      // コーミング
      mb.color('#4c5054');
      mb.push(); mb.translate(cx, dy + 0.35, 0); mb.box(15.4, 0.9, hw * 2 + 0.9, 0.25); mb.pop();
      mb.color('#7c8087');
    }
    // 船首楼（船体の曲線に沿わせる）
    var FC0 = 0.845, FC1 = 0.995, FCH = 2.7;
    function fcT(u) { return FC0 + u * (FC1 - FC0); }
    function fcHW(u) { var sc = [0, 0, 0]; hullSection(fcT(u), 1, sc); return sc[2] - 0.14; }
    mb.color('#4f545a');
    mb.surface(16, 1, function (u, v, o) {      // 上面
      var sc = [0, 0, 0]; hullSection(fcT(u), 1, sc);
      o[0] = sc[0]; o[1] = sc[1] + FCH; o[2] = (v * 2 - 1) * fcHW(u);
    });
    mb.color('#2b3550');
    for (var fs = -1; fs <= 1; fs += 2) {       // 側面
      mb.surface(16, 1, function (u, v, o) {
        var sc = [0, 0, 0]; hullSection(fcT(u), 1, sc);
        o[0] = sc[0]; o[1] = sc[1] - 0.1 + v * (FCH + 0.1); o[2] = fs * (fcHW(u) + 0.14 * (1 - v * 0.3));
      }, fs < 0);
    }
    mb.surface(1, 1, function (u, v, o) {       // 後端
      var sc = [0, 0, 0]; hullSection(FC0, 1, sc);
      o[0] = sc[0]; o[1] = sc[1] + v * FCH; o[2] = (u * 2 - 1) * fcHW(0);
    }, true);
    // 船首楼の手すり
    mb.color('#8c9298');
    var fcx0 = shipX(FC0), fcx1 = shipX(0.985);
    for (var fr = -1; fr <= 1; fr += 2) {
      var scA = [0, 0, 0], scB = [0, 0, 0];
      hullSection(FC0, 1, scA); hullSection(0.985, 1, scB);
      railingLine(mb, scA[0], fr * (scA[2] - 0.3), scB[0], fr * (scB[2] - 0.3), scA[1] + FCH, 1.0, 0.07, 3.0);
    }
    mb.color('#2b3550');

    // 船尾の上部構造（5層 + ブリッジ）
    var tb = 0.115, bx = shipX(tb);
    var bw = halfBeamAt(tb) * 1.72;
    var bdy = deckYAt(tb);
    for (var d = 0; d < 5; d++) {
      var dw = 20 - d * 0.6, dd = bw - d * 0.7;
      mb.color('#d2cfc6');
      mb.push();
      mb.translate(bx, bdy + 1.9 + d * 3.1, 0);
      mb.box(dw, 3.1, dd, 0.3);
      mb.pop();
      // 窓帯
      mb.color('#20303c');
      mb.push();
      mb.translate(bx, bdy + 1.9 + d * 3.1 + 0.55, 0);
      mb.box(dw + 0.10, 1.05, dd + 0.10, 0.3);
      mb.pop();
      // 窓の桟
      mb.color('#c4c0b6');
      for (var wq = 0; wq < 7; wq++) {
        mb.push();
        mb.translate(bx - dw / 2 + (wq + 0.5) * dw / 7, bdy + 1.9 + d * 3.1 + 0.55, 0);
        mb.box(0.34, 1.1, dd + 0.16, 0.5);
        mb.pop();
      }
      // 甲板の縁
      mb.color('#b6b2a8');
      mb.push();
      mb.translate(bx, bdy + 1.9 + d * 3.1 + 1.55, 0);
      mb.box(dw + 0.9, 0.22, dd + 0.9, 0.4);
      mb.pop();
    }
    // ブリッジ（ウイング付き）
    mb.push(); mb.translate(bx - 1.0, bdy + 1.9 + 5 * 3.1 + 1.75, 0); mb.box(15, 3.5, bw + 9.0, 0.3); mb.pop();
    mb.color('#1d2733');
    mb.push(); mb.translate(bx - 6.2, bdy + 1.9 + 5 * 3.1 + 2.1, 0); mb.box(2.4, 2.0, bw + 8.0, 0.3); mb.pop();
    // 煙突
    mb.color('#22303f');
    mb.push();
    mb.translate(bx + 1.5, bdy + 1.9 + 6 * 3.1 + 1.0, 0);
    mb.box(7.5, 9.0, 8.5, 0.3);
    mb.pop();
    mb.color('#c8452f');
    mb.push(); mb.translate(bx + 1.5, bdy + 1.9 + 6 * 3.1 + 6.2, 0); mb.box(7.7, 2.4, 8.7, 0.3); mb.pop();
    mb.color('#1a1e22');
    mb.push(); mb.translate(bx + 1.5, bdy + 1.9 + 6 * 3.1 + 5.9, 0); mb.box(7.9, 0.7, 8.9, 0.3); mb.pop();

    /* --- 金属パーツ --- */
    var mm = mbMetal;
    mm.color('#9aa0a6');
    // デッキクレーン 3 基
    for (var c = 0; c < 3; c++) {
      var tc = 0.30 + c * 0.195;
      var cx2 = shipX(tc), cy2 = deckYAt(tc);
      mm.push();
      mm.translate(cx2, cy2 + 0.4, 0);
      mm.cyl(2.3, 1.9, 5.2, 12);
      mm.push();
      mm.translate(0, 5.2, 0);
      mm.rotY(0.6 + c * 0.5);
      mm.cyl(1.7, 1.5, 3.0, 10);
      mm.push();
      mm.translate(0, 2.4, 0);
      mm.rotZ(-0.85);
      mm.cyl(0.75, 0.42, 20.0, 8);
      mm.pop();
      mm.pop();
      mm.pop();
    }
    // マスト
    mm.push(); mm.translate(bx - 1.0, bdy + 1.9 + 5 * 3.1 + 3.5, 0); mm.cyl(0.35, 0.18, 9.0, 8); mm.pop();
    mm.push(); mm.translate(shipX(0.965), deckYAt(0.965) + 2.6, 0); mm.cyl(0.3, 0.16, 7.0, 8); mm.pop();
    // 手すり（船尾楼の周り）
    railingRect(mm, bx, bdy + 1.9 + 5 * 3.1 + 3.5, 0, 15, bw + 9.0, 1.1, 0.07);
    // 錨鎖・ホーサーリールの雰囲気
    mm.color('#6d7378');
    mm.push(); mm.translate(shipX(0.935), deckYAt(0.935) + 3.1, 0); mm.rotZ(Math.PI / 2); mm.cyl(1.3, 1.3, 4.4, 10); mm.pop();
    mm.color('#5b6166');
    mm.push(); mm.translate(shipX(0.10), deckYAt(0.10) + 1.5, 0); mm.rotZ(Math.PI / 2); mm.cyl(1.2, 1.2, 3.6, 10); mm.pop();
    return mb;
  }

  /* 矩形の手すり */
  function railingRect(mb, cx, cy, cz, lx, lz, h, r) {
    var pts = [];
    var nx = Math.max(2, Math.round(lx / 2.2)), nz = Math.max(2, Math.round(lz / 2.2));
    for (var i = 0; i <= nx; i++) { pts.push([cx - lx / 2 + lx * i / nx, cz - lz / 2]); pts.push([cx - lx / 2 + lx * i / nx, cz + lz / 2]); }
    for (var j = 1; j < nz; j++) { pts.push([cx - lx / 2, cz - lz / 2 + lz * j / nz]); pts.push([cx + lx / 2, cz - lz / 2 + lz * j / nz]); }
    for (var k = 0; k < pts.length; k++) {
      mb.push(); mb.translate(pts[k][0], cy, pts[k][1]); mb.cyl(r, r, h, 5); mb.pop();
    }
    // 横棒
    for (var lvl = 1; lvl <= 2; lvl++) {
      var yy = cy + h * lvl / 2;
      mb.strut(cx - lx / 2, yy, cz - lz / 2, cx + lx / 2, yy, cz - lz / 2, r * 0.8, 4);
      mb.strut(cx - lx / 2, yy, cz + lz / 2, cx + lx / 2, yy, cz + lz / 2, r * 0.8, 4);
      mb.strut(cx - lx / 2, yy, cz - lz / 2, cx - lx / 2, yy, cz + lz / 2, r * 0.8, 4);
      mb.strut(cx + lx / 2, yy, cz - lz / 2, cx + lx / 2, yy, cz + lz / 2, r * 0.8, 4);
    }
  }
  /* 直線の手すり */
  function railingLine(mb, x0, z0, x1, z1, y, h, r, step) {
    var dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    var n = Math.max(1, Math.round(L / (step || 2.4)));
    for (var i = 0; i <= n; i++) {
      mb.push(); mb.translate(x0 + dx * i / n, y, z0 + dz * i / n); mb.cyl(r, r, h, 5); mb.pop();
    }
    for (var lvl = 1; lvl <= 2; lvl++) {
      var yy = y + h * lvl / 2;
      mb.strut(x0, yy, z0, x1, yy, z1, r * 0.8, 4);
    }
  }

  /* ドックの側壁 z 位置（高さ y における内法） */
  function altarHW(y) {
    var A = W.ALTARS;
    for (var i = 0; i < A.length; i++) if (y < A[i].y1) return A[i].hw;
    return A[A.length - 1].hw;
  }

  /* ================= ドック本体・陸地（コンクリート） ================= */
  function buildDockConcrete(mb) {
    var HW = W.DOCK_HW, X0 = W.DOCK_X0, X1 = W.DOCK_X1, TOP = W.COPING_Y;
    var SH = W.SHORE_X, CH = W.CH_HW, LZ = W.LAND_Z, LX = W.LAND_X1, THW = W.TOP_HW;
    srand(7);

    // --- 陸（ヤード）: 立体で構成し、法線とカリングを確実にする ---
    var GND = -12;
    mb.color('#8b8579');
    mb.boxMM(SH, GND, THW, LX, TOP, LZ, 0.04);          // 手前の陸
    mb.boxMM(SH, GND, -LZ, LX, TOP, -THW, 0.04);        // 奥の陸
    mb.boxMM(X1, GND, -THW, LX, TOP, THW, 0.04);        // ドック奥の陸
    mb.color('#8f897d');
    mb.boxMM(SH, GND, CH, X0, TOP, THW, 0.06);          // 入口水路の手前脇
    mb.boxMM(SH, GND, -THW, X0, TOP, -CH, 0.06);        // 入口水路の奥脇
    // 敷居（シル）
    mb.color('#7d786d');
    mb.boxMM(SH, GND, -CH, X0, W.SILL_Y, CH, 0.1);
    // --- ドック底 ---
    mb.color('#8e8a80');
    mb.boxMM(X0 - 3, GND, -THW, X1, 0, THW, 0.12);

    // --- アルター（階段状の側壁）---
    var steps = W.ALTARS;
    mb.color('#a09a8e');
    for (var s = 0; s < steps.length; s++) {
      var st = steps[s];
      mb.boxMM(X0, st.y0, st.hw, X1, st.y1, THW + 0.01, 0.1);
      mb.boxMM(X0, st.y0, -THW - 0.01, X1, st.y1, -st.hw, 0.1);
    }
    // --- ドック奥（+X）の階段状の妻壁 ---
    for (var s2 = 0; s2 < steps.length; s2++) {
      var t2 = steps[s2];
      var xw = X1 - (steps.length - 1 - s2) * 1.7;
      mb.boxMM(xw, t2.y0, -t2.hw, X1 + 0.01, t2.y1, t2.hw, 0.1);
    }

    // --- 天端の縁石 ---
    mb.color('#b9b2a4');
    mb.boxMM(X0 - 1.0, TOP, THW, X1 + 1.0, TOP + 0.42, THW + 1.3, 0.2);
    mb.boxMM(X0 - 1.0, TOP, -THW - 1.3, X1 + 1.0, TOP + 0.42, -THW, 0.2);
    mb.boxMM(X1 + 1.0, TOP, -THW - 1.3, X1 + 2.3, TOP + 0.42, THW + 1.3, 0.2);
    // 入口水路の縁石
    mb.boxMM(SH, TOP, CH, X0, TOP + 0.42, CH + 1.3, 0.2);
    mb.boxMM(SH, TOP, -CH - 1.3, X0, TOP + 0.42, -CH, 0.2);
    mb.boxMM(SH, TOP, -LZ * 0.35, SH + 1.3, TOP + 0.42, -CH, 0.2);
    mb.boxMM(SH, TOP, CH, SH + 1.3, TOP + 0.42, LZ * 0.35, 0.2);

    // --- 側壁に切り込まれた階段 ---
    mb.color('#918b7f');
    for (var q = 0; q < 4; q++) {
      var sx = X0 + 30 + q * 54;
      var sd = (q % 2 === 0) ? 1 : -1;
      for (var stp = 0; stp < 48; stp++) {
        var yy = 0.34 + stp * 0.34;
        if (yy > TOP - 0.1) break;
        var hw = altarHW(yy - 0.2);
        mb.boxMM(sx - 1.7 + stp * 0.085, yy - 0.34, sd * hw - sd * 0.06,
          sx + 1.7 - stp * 0.085, yy, sd * (hw + 1.25), 0.35);
      }
    }
    // --- 底のサンプ（ポンプ吸込みピット）---
    for (var p = 0; p < 2; p++) {
      var px = (p === 0) ? W.DOCK_X0 + 20 : W.DOCK_X1 - 20;
      mb.color('#4c4941');
      mb.boxMM(px - 5.0, 0.01, HW - 6.2, px + 5.0, 0.06, HW - 0.6, 0.4);   // 暗いピット面
      mb.color('#7e796f');
      mb.boxMM(px - 5.7, 0.0, HW - 6.9, px + 5.7, 0.42, HW - 6.2, 0.5);    // 縁の立ち上がり
      mb.boxMM(px - 5.7, 0.0, HW - 0.6, px + 5.7, 0.42, HW, 0.5);
      mb.boxMM(px - 5.7, 0.0, HW - 6.9, px - 5.0, 0.42, HW, 0.5);
      mb.boxMM(px + 5.0, 0.0, HW - 6.9, px + 5.7, 0.42, HW, 0.5);
    }
    // --- 海底（岸壁前面の浅場）---
    mb.color('#6a6459');
    mb.boxMM(-2600, -14, -2600, SH, 0.4, 2600, 0.008);
    return mb;
  }

  /* ドック底の排水溝（両舷のサイドガター） */
  function buildDockDrains(mb) {
    var HW = W.DOCK_HW, X0 = W.DOCK_X0, X1 = W.DOCK_X1;
    for (var s = -1; s <= 1; s += 2) {
      var z0 = s > 0 ? HW - 3.4 : -HW + 2.0;
      var z1 = s > 0 ? HW - 2.0 : -HW + 3.4;
      mb.color('#4f4c45');
      mb.boxMM(X0 + 3, 0.01, z0, X1 - 3, 0.05, z1, 0.5);          // 溝の底
      mb.color('#8b867c');
      mb.boxMM(X0 + 3, 0.0, z0 - 0.45, X1 - 3, 0.30, z0, 0.5);    // 縁
      mb.boxMM(X0 + 3, 0.0, z1, X1 - 3, 0.30, z1 + 0.45, 0.5);
    }
    return mb;
  }

  /* ================= 盤木・サイドショア ================= */
  function buildBlocks(mbWood, mbSteel) {
    srand(31);
    var n = 32;
    for (var i = 0; i < n; i++) {
      var t = 0.055 + i / (n - 1) * 0.885;
      var x = shipX(t);
      if (x < W.DOCK_X0 + 8 || x > W.DOCK_X1 - 8) continue;
      // キールブロック（鋼台 + 木材）
      mbSteel.color('#5a5f63');
      mbSteel.push(); mbSteel.translate(x, 0.55, 0); mbSteel.box(2.4, 1.1, 3.2, 0.5); mbSteel.pop();
      mbSteel.push(); mbSteel.translate(x, 1.25, 0); mbSteel.box(2.7, 0.35, 3.5, 0.5); mbSteel.pop();
      for (var k = 0; k < 3; k++) {
        mbWood.colorJit('#8a6a43', 0, 0, 0.14);
        mbWood.push();
        mbWood.translate(x, 1.62 + k * 0.34, 0);
        mbWood.rotY(k % 2 ? Math.PI / 2 : 0);
        mbWood.box(2.6, 0.34, 3.3, 0.7);
        mbWood.pop();
      }
      // 天端の当て木
      mbWood.colorJit('#6f5335', 0, 0, 0.1);
      mbWood.push(); mbWood.translate(x, 2.47, 0); mbWood.box(2.7, 0.26, 3.4, 0.7); mbWood.pop();
    }
    // ビルジブロック（左右）
    var nb = 12;
    for (var j = 0; j < nb; j++) {
      var t2 = 0.24 + j / (nb - 1) * 0.50;
      var x2 = shipX(t2);
      var a = halfBeamAt(t2);
      for (var s = -1; s <= 1; s += 2) {
        var zz = s * (a - 3.4);
        mbSteel.color('#565b60');
        mbSteel.push(); mbSteel.translate(x2, 0.5, zz); mbSteel.box(2.0, 1.0, 2.6, 0.5); mbSteel.pop();
        for (var k2 = 0; k2 < 2; k2++) {
          mbWood.colorJit('#856541', 0, 0, 0.12);
          mbWood.push(); mbWood.translate(x2, 1.16 + k2 * 0.32, zz); mbWood.box(2.1, 0.32, 2.7, 0.7); mbWood.pop();
        }
      }
    }
    // サイドショア（側壁から船体への支柱）
    mbSteel.color('#7c6a4e');
    for (var q = 0; q < 10; q++) {
      var t3 = 0.15 + q / 9 * 0.70;
      var x3 = shipX(t3);
      var a3 = halfBeamAt(t3);
      for (var s3 = -1; s3 <= 1; s3 += 2) {
        mbSteel.strut(x3, 10.3, s3 * 21.5, x3, 8.4, s3 * (a3 + 0.2), 0.32, 6);
        mbSteel.strut(x3, 5.1, s3 * 19.9, x3, 3.9, s3 * (a3 - 0.6), 0.27, 6);
      }
    }
    return mbWood;
  }

  /* ================= ゲート（フラップ式：底部ヒンジで起き上がる） =================
     ローカル原点 = ヒンジ。本体は +X 方向へ伸びる。
     角度 π = 倒伏（水路に寝ている）, π/2 = 起立（閉鎖）。 */
  function buildGate(mb) {
    var L = 48, TH = 2.6, H = 14.8;
    mb.color('#39434b');
    mb.boxMM(0, -TH, -L / 2, H, 0, L / 2, 0.2);
    // 補強リブ（縦通）
    mb.color('#2b333a');
    for (var i = 0; i < 11; i++) {
      var z = -L / 2 + 2.2 + i * (L - 4.4) / 10;
      mb.boxMM(0.4, -TH - 0.55, z - 0.3, H - 0.5, -TH, z + 0.3, 0.4);
    }
    // 横桁
    for (var j = 0; j < 4; j++) {
      var xx = 2.2 + j * 3.4;
      mb.boxMM(xx - 0.32, -TH - 0.5, -L / 2 + 0.3, xx + 0.32, -TH, L / 2 - 0.3, 0.4);
    }
    // 天端の歩廊
    mb.color('#4d565d');
    mb.boxMM(H, -1.6, -L / 2, H + 0.55, 0.6, L / 2, 0.4);
    // 黄と黒の警戒帯
    mb.color('#d8a726');
    mb.boxMM(H - 1.5, 0.001, -L / 2, H - 0.4, 0.09, L / 2, 0.4);
    mb.color('#20262b');
    for (var k = 0; k < 16; k++) {
      var z2 = -L / 2 + k * (L / 16);
      mb.boxMM(H - 1.5, 0.002, z2, H - 0.4, 0.10, z2 + L / 32, 0.4);
    }
    // 手すり（天端）
    mb.color('#8c9298');
    mb.push();
    mb.translate(H + 0.3, 0.6, 0);
    mb.rotZ(-Math.PI / 2);   // ローカル +X を上向きに
    railingLine(mb, 0, -L / 2 + 1, 0, L / 2 - 1, 0, 1.1, 0.085, 3.0);
    mb.pop();
    // ヒンジ
    mb.color('#5a6268');
    for (var h = 0; h < 5; h++) {
      var hz = -L / 2 + 4 + h * (L - 8) / 4;
      mb.push(); mb.translate(0, -TH / 2, hz); mb.rotX(Math.PI / 2); mb.cyl(1.5, 1.5, 2.2, 12); mb.pop();
    }
    return mb;
  }

  /* ================= ポンプ設備・レバー ================= */
  function buildPumpHouse(mb) {
    var HW = W.DOCK_HW, TOP = W.COPING_Y, THW = W.TOP_HW;
    var PZ = -THW - 30;                  // ポンプ室の Z
    var PX = W.DOCK_X0 + 34;
    // 建屋
    mb.color('#b6ada0');
    mb.push(); mb.translate(PX, TOP + 6.0, PZ); mb.box(34, 12, 22, 0.12); mb.pop();
    mb.color('#7d5b3f');
    mb.push(); mb.translate(PX, TOP + 12.5, PZ); mb.box(36, 1.0, 24, 0.3); mb.pop();
    mb.color('#5d6a72');
    for (var v = 0; v < 3; v++) {
      mb.push(); mb.translate(PX - 12 + v * 12, TOP + 13.6, PZ - 5); mb.cyl(1.5, 1.5, 2.4, 12); mb.pop();
    }
    // 吸込み管（ドック底のサンプから壁を貫通して立ち上がる）
    mb.color('#4f5a60');
    for (var p = 0; p < 2; p++) {
      var px = (p === 0) ? W.DOCK_X0 + 20 : W.DOCK_X1 - 20;
      mb.push(); mb.translate(px, 0.9, HW - 3.4); mb.rotZ(Math.PI / 2); mb.cyl(1.7, 1.7, 3.4, 14); mb.pop();
      mb.push(); mb.translate(px, -0.1, HW - 3.4); mb.cyl(2.1, 1.9, 1.1, 14); mb.pop();
    }
    // 巨大な吐出管（ヤードを横断して岸壁へ）
    var pipeZ = [-THW - 9, -THW - 13.2];
    for (var i = 0; i < 2; i++) {
      var zz = pipeZ[i];
      mb.color('#5c666c');
      mb.push();
      mb.translate(W.SHORE_X + 3, TOP + 2.0, zz);
      mb.rotZ(Math.PI / 2); mb.rotX(-Math.PI / 2);
      mb.cyl(1.6, 1.6, 175, 16);
      mb.pop();
      mb.color('#454e53');
      for (var k = 0; k < 12; k++) {
        mb.push(); mb.translate(W.SHORE_X + 12 + k * 14, TOP + 0.9, zz); mb.box(1.2, 2.2, 4.2, 0.4); mb.pop();
      }
      // フランジ
      mb.color('#6b757b');
      for (var f = 0; f < 6; f++) {
        mb.push(); mb.translate(W.SHORE_X + 20 + f * 28, TOP + 2.0, zz); mb.rotZ(Math.PI / 2); mb.cyl(2.0, 2.0, 0.5, 16); mb.pop();
      }
    }
    // 吐出口（海へ張り出す）
    mb.color('#4f5a60');
    for (var o = 0; o < 2; o++) {
      mb.push();
      mb.translate(W.SHORE_X - 7, W.SEA_Y + 2.6, pipeZ[o]);
      mb.rotZ(Math.PI / 2);
      mb.cyl(1.85, 1.85, 12, 16);
      mb.pop();
      mb.push();
      mb.translate(W.SHORE_X + 5, TOP + 2.0, pipeZ[o]);
      mb.rotZ(Math.PI / 2); mb.rotX(0);
      mb.cyl(1.7, 1.7, 5.0, 14);
      mb.pop();
    }
    return mb;
  }

  /* 操作レバー（手前の柵の上） */
  function buildLeverBase(mb) {
    mb.color('#c8b23a');
    mb.push(); mb.translate(0, 0.55, 0); mb.box(2.6, 1.1, 1.8, 0.5); mb.pop();
    mb.color('#3c4247');
    mb.push(); mb.translate(0, 1.15, 0); mb.box(2.9, 0.2, 2.1, 0.5); mb.pop();
    // ガイドスロット
    mb.color('#22262a');
    mb.push(); mb.translate(0, 1.9, 0); mb.box(0.5, 1.7, 0.35, 0.5); mb.pop();
    return mb;
  }
  function buildLeverArm(mb) {
    mb.color('#4a5157');
    mb.cyl(0.16, 0.13, 2.1, 10);
    mb.color('#cf3b2c');
    mb.push(); mb.translate(0, 2.1, 0); mb.sphere(0.42, 14, 10); mb.pop();
    return mb;
  }

  /* ================= 門型クレーン（ドックをまたぐ） ================= */
  function buildGantry(mb) {
    var HW = W.DOCK_HW, TOP = W.COPING_Y;
    var span = (HW + 8) * 2, H = 34;
    mb.color('#c2622a');
    for (var s = -1; s <= 1; s += 2) {
      var z = s * (HW + 8);
      // 脚（トラス）
      mb.push(); mb.translate(0, TOP, z); mb.pop();
      mb.strut(-3.0, TOP, z - 1.6, -1.2, TOP + H, z - 1.0, 0.55, 6);
      mb.strut(3.0, TOP, z - 1.6, 1.2, TOP + H, z - 1.0, 0.55, 6);
      mb.strut(-3.0, TOP, z + 1.6, -1.2, TOP + H, z + 1.0, 0.55, 6);
      mb.strut(3.0, TOP, z + 1.6, 1.2, TOP + H, z + 1.0, 0.55, 6);
      for (var k = 0; k < 6; k++) {
        var y0 = TOP + k * H / 6, y1 = TOP + (k + 1) * H / 6;
        var f0 = k / 6, f1 = (k + 1) / 6;
        var xa0 = -3.0 + 1.8 * f0, xb0 = 3.0 - 1.8 * f0;
        var xa1 = -3.0 + 1.8 * f1, xb1 = 3.0 - 1.8 * f1;
        mb.strut(xa0, y0, z - 1.6, xb1, y1, z + 1.6, 0.22, 4);
        mb.strut(xb0, y0, z + 1.6, xa1, y1, z - 1.6, 0.22, 4);
        mb.strut(xa1, y1, z - 1.6, xb1, y1, z + 1.6, 0.2, 4);
      }
      // 台車
      mb.color('#3c4247');
      mb.push(); mb.translate(0, TOP - 0.6, z); mb.box(9.0, 1.4, 4.2, 0.4); mb.pop();
      mb.color('#c2622a');
    }
    // 桁
    mb.push(); mb.translate(0, TOP + H + 1.6, 0); mb.box(4.6, 3.2, span + 4, 0.3); mb.pop();
    mb.color('#a8531f');
    mb.push(); mb.translate(0, TOP + H + 3.6, 0); mb.box(3.0, 1.0, span + 4, 0.3); mb.pop();
    // トロリーとフック
    mb.color('#e0e2e4');
    mb.push(); mb.translate(0, TOP + H - 0.6, 12); mb.box(5.0, 2.6, 6.0, 0.4); mb.pop();
    mb.color('#6a7076');
    mb.strut(0, TOP + H - 1.9, 12, 0, TOP + H - 8.5, 12, 0.09, 5);
    mb.color('#b0562a');
    mb.push(); mb.translate(0, TOP + H - 9.6, 12); mb.box(1.5, 2.2, 1.2, 0.6); mb.pop();
    return mb;
  }

  /* ================= 岸壁の小物 ================= */
  function buildQuayProps(mbMetal, mbMisc) {
    srand(101);
    var HW = W.DOCK_HW, TOP = W.COPING_Y, topHW = W.TOP_HW;
    // ボラード
    mbMetal.color('#3f464b');
    for (var i = 0; i < 16; i++) {
      var x = W.DOCK_X0 - 20 + i * 16;
      for (var s = -1; s <= 1; s += 2) {
        mbMetal.push();
        mbMetal.translate(x, TOP + 0.45, s * (topHW + 3.4));
        mbMetal.cyl(0.62, 0.5, 1.15, 10);
        mbMetal.push(); mbMetal.translate(0, 1.15, 0); mbMetal.cyl(0.76, 0.6, 0.35, 10); mbMetal.pop();
        mbMetal.pop();
      }
    }
    // 手すり（ドック縁）
    mbMetal.color('#b8bcbf');
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      railingLine(mbMetal, W.DOCK_X0 - 30, s2 * (topHW + 1.2), W.DOCK_X1 + 10, s2 * (topHW + 1.2), TOP + 0.45, 1.15, 0.075, 3.0);
    }
    // 投光器の柱（ドック縁から十分離す）
    for (var j = 0; j < 4; j++) {
      var x2 = W.DOCK_X0 + 16 + j * 72;
      for (var s3 = -1; s3 <= 1; s3 += 2) {
        mbMetal.color('#8d9296');
        mbMetal.push();
        mbMetal.translate(x2, TOP, s3 * (topHW + 26.0));
        mbMetal.cyl(0.55, 0.34, 22, 8);
        mbMetal.color('#c9c5b8');
        for (var lp = 0; lp < 3; lp++) {
          mbMetal.push();
          mbMetal.translate(-2.0 + lp * 2.0, 22.3, 0);
          mbMetal.rotX(-s3 * 0.5);
          mbMetal.box(1.7, 0.55, 1.0, 0.6);
          mbMetal.pop();
        }
        mbMetal.color('#7d8286');
        mbMetal.push(); mbMetal.translate(0, 22.0, 0); mbMetal.box(6.6, 0.35, 0.5, 0.6); mbMetal.pop();
        mbMetal.pop();
      }
    }
    // ヤードの資材（近景・中景の層をつくる）
    for (var y1 = 0; y1 < 46; y1++) {
      var yx = W.DOCK_X0 - 60 + rr(0, 380);
      var yz = (rnd() > 0.40 ? 1 : -1) * (topHW + 9 + rr(0, 170));
      var kind = rnd();
      if (kind < 0.42) {                       // コンテナ・資材箱
        var stack = 1 + ((rnd() * 2.4) | 0);
        for (var st2 = 0; st2 < stack; st2++) {
          mbMisc.colorJit(st2 % 2 ? '#3f6f78' : '#a2552f', 0, 0, 0.16);
          mbMisc.push();
          mbMisc.translate(yx, TOP + 1.3 + st2 * 2.6, yz);
          mbMisc.rotY(rr(-0.25, 0.25));
          mbMisc.box(12.2, 2.6, 2.44, 0.35);
          mbMisc.pop();
        }
      } else if (kind < 0.68) {                // 鋼板の山
        mbMisc.colorJit('#6b6f74', 0, 0, 0.12);
        for (var pl = 0; pl < 5; pl++) {
          mbMisc.push();
          mbMisc.translate(yx, TOP + 0.16 + pl * 0.3, yz);
          mbMisc.rotY(rr(-0.1, 0.1));
          mbMisc.box(rr(7, 13), 0.3, rr(2.4, 3.6), 0.4);
          mbMisc.pop();
        }
      } else if (kind < 0.86) {                // ケーブルドラム
        mbMetal.colorJit('#7a5a35', 0, 0, 0.14);
        mbMetal.push();
        mbMetal.translate(yx, TOP + 1.6, yz);
        mbMetal.rotZ(Math.PI / 2);
        mbMetal.cyl(1.6, 1.6, 1.5, 14);
        mbMetal.pop();
      } else {                                  // ドラム缶の集まり
        for (var dr = 0; dr < 6; dr++) {
          mbMisc.colorJit(dr % 2 ? '#3c6a48' : '#9b4530', 0, 0, 0.18);
          mbMisc.push();
          mbMisc.translate(yx + rr(-2.4, 2.4), TOP, yz + rr(-2.4, 2.4));
          mbMisc.cyl(0.32, 0.32, 0.9, 10);
          mbMisc.pop();
        }
      }
    }
    // ホース・ケーブル（ドック底）
    mbMisc.color('#2c3236');
    for (var h = 0; h < 7; h++) {
      var hx = W.DOCK_X0 + 20 + rr(0, 190);
      var hz = (rnd() > 0.5 ? 1 : -1) * rr(15, 19.2);
      var seg = 7, px = hx, pz = hz, py = 0.16;
      for (var k = 0; k < seg; k++) {
        var nx2 = px + rr(-6, 6), nz2 = pz + rr(-3, 3);
        mbMisc.strut(px, py, pz, nx2, py, nz2, 0.16, 5);
        px = nx2; pz = nz2;
      }
    }
    // ドック底のコンテナ・資材
    for (var c = 0; c < 9; c++) {
      var cx = W.DOCK_X0 + 16 + rr(0, 200);
      var cz = (rnd() > 0.5 ? 1 : -1) * rr(15.5, 19);
      mbMisc.colorJit('#48606a', 0, 0, 0.22);
      mbMisc.push();
      mbMisc.translate(cx, 1.0, cz);
      mbMisc.rotY(rr(-0.4, 0.4));
      mbMisc.box(rr(2.5, 6.0), 2.0, rr(2.0, 2.6), 0.5);
      mbMisc.pop();
    }
    // 移動足場（ローリングタワー）
    for (var t2 = 0; t2 < 4; t2++) {
      var tx = W.DOCK_X0 + 40 + t2 * 46;
      var tz = (t2 % 2 ? 1 : -1) * 17.5;
      mbMetal.color('#c9a227');
      for (var lvl = 0; lvl < 4; lvl++) {
        var yy = lvl * 2.2;
        mbMetal.strut(tx - 1.2, yy, tz - 1.2, tx - 1.2, yy + 2.2, tz - 1.2, 0.09, 4);
        mbMetal.strut(tx + 1.2, yy, tz - 1.2, tx + 1.2, yy + 2.2, tz - 1.2, 0.09, 4);
        mbMetal.strut(tx - 1.2, yy, tz + 1.2, tx - 1.2, yy + 2.2, tz + 1.2, 0.09, 4);
        mbMetal.strut(tx + 1.2, yy, tz + 1.2, tx + 1.2, yy + 2.2, tz + 1.2, 0.09, 4);
        mbMetal.strut(tx - 1.2, yy + 2.2, tz - 1.2, tx + 1.2, yy + 2.2, tz + 1.2, 0.07, 4);
        mbMisc.color('#9a7b4f');
        mbMisc.push(); mbMisc.translate(tx, yy + 2.25, tz); mbMisc.box(2.6, 0.12, 2.6, 0.6); mbMisc.pop();
        mbMetal.color('#c9a227');
      }
    }
    return mbMetal;
  }

  /* 作業員（スケール感の要） */
  function buildWorkers(mb, positions) {
    for (var i = 0; i < positions.length; i++) {
      var p = positions[i];
      mb.push();
      mb.translate(p[0], p[1], p[2]);
      mb.rotY(p[3] || 0);
      mb.color('#e8802a');           // 作業服
      mb.push(); mb.translate(0, 0.95, 0); mb.box(0.46, 0.72, 0.28, 1); mb.pop();
      mb.color('#2f3f6b');           // ズボン
      mb.push(); mb.translate(-0.10, 0.30, 0); mb.box(0.16, 0.62, 0.22, 1); mb.pop();
      mb.push(); mb.translate(0.10, 0.30, 0); mb.box(0.16, 0.62, 0.22, 1); mb.pop();
      mb.color('#e8802a');           // 腕
      mb.push(); mb.translate(-0.30, 0.98, 0); mb.box(0.14, 0.62, 0.16, 1); mb.pop();
      mb.push(); mb.translate(0.30, 0.98, 0); mb.box(0.14, 0.62, 0.16, 1); mb.pop();
      mb.color('#c69b76');           // 首・顔
      mb.push(); mb.translate(0, 1.44, 0); mb.box(0.20, 0.22, 0.20, 1); mb.pop();
      mb.color('#f2d23c');           // ヘルメット
      mb.push(); mb.translate(0, 1.60, 0); mb.sphere(0.15, 10, 6, 0.85); mb.pop();
      mb.push(); mb.translate(0, 1.53, 0.02); mb.box(0.34, 0.04, 0.36, 1); mb.pop();
      mb.pop();
    }
    return mb;
  }

  /* ================= 遠景（中景・遠景の層をつくる） ================= */
  function buildFarScenery(mb) {
    srand(555);
    var TOP = W.COPING_Y;

    // --- 中景: ヤードの建屋（奥側 -Z）---
    for (var s = 0; s < 14; s++) {
      var sx = -420 + rr(0, 900);
      var sz = -110 - rr(0, 210);
      var sw = rr(40, 110), sh = rr(12, 26), sd = rr(30, 70);
      mb.colorJit('#a8a396', 0, 0, 0.14);
      mb.push(); mb.translate(sx, TOP + sh / 2, sz); mb.box(sw, sh, sd, 0.03); mb.pop();
      mb.colorJit('#6d7a80', 0, 0, 0.14);
      mb.push(); mb.translate(sx, TOP + sh + 0.6, sz); mb.box(sw + 2, 1.2, sd + 2, 0.06); mb.pop();
    }
    // --- 中景: 隣の岸壁のクレーン ---
    for (var c = 0; c < 6; c++) {
      var cx = -360 + c * 150 + rr(-25, 25);
      var cz = -300 - rr(0, 60);
      mb.colorJit('#9fb0bb', 0, 0, 0.1);
      mb.push();
      mb.translate(cx, TOP, cz);
      mb.strut(-15, 0, -13, -15, 54, -13, 1.7, 5);
      mb.strut(15, 0, -13, 15, 54, -13, 1.7, 5);
      mb.strut(-15, 0, 13, -15, 54, 13, 1.7, 5);
      mb.strut(15, 0, 13, 15, 54, 13, 1.7, 5);
      mb.push(); mb.translate(0, 56, 0); mb.box(32, 4, 28, 0.06); mb.pop();
      mb.push(); mb.translate(-26, 52, 0); mb.rotZ(0.14); mb.box(50, 3.4, 5.2, 0.06); mb.pop();
      mb.push(); mb.translate(33, 58, 0); mb.rotZ(-0.72); mb.box(36, 3.2, 4.8, 0.06); mb.pop();
      mb.pop();
    }
    // --- 遠景: 街並み ---
    for (var b = 0; b < 62; b++) {
      var bx = -1200 + rr(0, 2400);
      var bz = -520 - rr(0, 520);
      var bw = rr(22, 60), bh = rr(18, 92), bd = rr(22, 55);
      mb.colorJit('#7e858d', 0, 0, 0.16);
      mb.push(); mb.translate(bx, TOP + bh / 2, bz); mb.box(bw, bh, bd, 0.02); mb.pop();
    }
    // --- 遠景: 丘 ---
    for (var h = 0; h < 11; h++) {
      var hx = -1500 + h * 320 + rr(-90, 90);
      var hz = -1500 - rr(0, 700);
      var hr = rr(230, 430);
      mb.push();
      mb.translate(hx, -40, hz);
      mb.colorJit('#5d7066', 0, 0, 0.10);
      mb.sphere(hr, 14, 8, rr(0.22, 0.40));
      mb.pop();
    }
    // --- 海側（-X）の防波堤と灯標 ---
    mb.color('#8b8578');
    mb.push(); mb.translate(-620, W.SEA_Y - 0.6, -260); mb.rotY(0.22); mb.box(24, 6.0, 620, 0.03); mb.pop();
    mb.push(); mb.translate(-560, W.SEA_Y - 0.6, 330); mb.rotY(-0.16); mb.box(24, 6.0, 380, 0.03); mb.pop();
    mb.color('#c04434');
    mb.push(); mb.translate(-560, W.SEA_Y + 5.0, 140); mb.cyl(3.0, 2.4, 9.0, 12); mb.pop();
    // --- 対岸（-X の遠く）---
    mb.colorJit('#68787a', 0, 0, 0.08);
    mb.push(); mb.translate(-1900, TOP - 6, -200); mb.box(60, 26, 1800, 0.01); mb.pop();
    return mb;
  }

  /* 小型タグボート */
  function buildTug(mb) {
    var L = 22, HB = 4.0, D = 4.6;
    function halfB(t) {
      if (t > 0.78) return HB * Math.pow(1 - (t - 0.78) / 0.22, 0.55);
      if (t < 0.10) return HB * (0.78 + 0.22 * (t / 0.10));
      return HB;
    }
    mb.color('#1e2b36');
    for (var sg = -1; sg <= 1; sg += 2) {
      mb.surface(20, 8, function (u, v, o) {
        var t = u;
        var hb = halfB(t);
        var y0 = (t > 0.86 ? (t - 0.86) / 0.14 * 1.6 : 0);
        var y = y0 + v * (D - y0);
        var r = Math.min(1, (y - y0) / 2.0);
        o[0] = (t - 0.5) * L;
        o[1] = y;
        o[2] = sg * hb * Math.sqrt(Math.max(0, 1 - (1 - r) * (1 - r)));
      }, sg < 0);
    }
    // 船底
    mb.surface(20, 1, function (u, v, o) {
      var t = u;
      var y0 = (t > 0.86 ? (t - 0.86) / 0.14 * 1.6 : 0);
      o[0] = (t - 0.5) * L;
      o[1] = y0;
      o[2] = (v * 2 - 1) * 0.35 * halfB(t);
    });
    // 甲板
    mb.color('#8d5a30');
    mb.surface(20, 1, function (u, v, o) {
      o[0] = (u - 0.5) * L;
      o[1] = D - 0.06;
      o[2] = (v * 2 - 1) * halfB(u) * 0.98;
    });
    // 舷側の赤帯
    mb.color('#b8453a');
    for (var sg2 = -1; sg2 <= 1; sg2 += 2) {
      mb.surface(20, 1, function (u, v, o) {
        o[0] = (u - 0.5) * L;
        o[1] = D - 1.1 + v * 1.05;
        o[2] = sg2 * (halfB(u) + 0.06);
      }, sg2 < 0);
    }
    // 上部構造
    mb.color('#e2ded4');
    mb.push(); mb.translate(-1.4, D + 1.5, 0); mb.box(8.0, 3.0, 6.0, 0.35); mb.pop();
    mb.color('#1d2a33');
    mb.push(); mb.translate(-1.4, D + 2.3, 0); mb.box(8.15, 1.1, 6.15, 0.35); mb.pop();
    mb.color('#e2ded4');
    mb.push(); mb.translate(-1.0, D + 4.2, 0); mb.box(4.8, 2.4, 4.4, 0.35); mb.pop();
    mb.color('#1d2a33');
    mb.push(); mb.translate(-1.0, D + 4.5, 0); mb.box(4.95, 1.0, 4.55, 0.35); mb.pop();
    // 煙突とマスト
    mb.color('#2a3238');
    mb.push(); mb.translate(-3.6, D + 5.6, 0); mb.cyl(0.75, 0.68, 2.4, 10); mb.pop();
    mb.color('#b8453a');
    mb.push(); mb.translate(-3.6, D + 7.4, 0); mb.cyl(0.78, 0.72, 0.6, 10); mb.pop();
    mb.color('#9aa0a6');
    mb.push(); mb.translate(-1.0, D + 5.4, 0); mb.cyl(0.14, 0.10, 3.4, 6); mb.pop();
    // 防舷材（タイヤ）
    mb.color('#15191d');
    for (var f = 0; f < 9; f++) {
      var tf = 0.06 + f * 0.105;
      for (var sf = -1; sf <= 1; sf += 2) {
        mb.push();
        mb.translate((tf - 0.5) * L, D - 0.5, sf * (halfB(tf) + 0.22));
        mb.rotX(Math.PI / 2);
        mb.cyl(0.5, 0.5, 0.34, 8);
        mb.pop();
      }
    }
    // 船首の当て
    mb.push(); mb.translate(L * 0.5 - 0.2, D - 0.7, 0); mb.rotZ(Math.PI / 2); mb.cyl(0.85, 0.85, 0.5, 10); mb.pop();
    return mb;
  }

  DD.W = W;
  DD.MB = MB;
  DD.geom = {
    buildHull: buildHull,
    buildHullCollider: buildHullCollider,
    buildHullExtras: buildHullExtras,
    buildRudder: buildRudder,
    buildPropeller: buildPropeller,
    buildShipTop: buildShipTop,
    buildDockConcrete: buildDockConcrete,
    buildDockDrains: buildDockDrains,
    buildBlocks: buildBlocks,
    buildGate: buildGate,
    buildPumpHouse: buildPumpHouse,
    buildLeverBase: buildLeverBase,
    buildLeverArm: buildLeverArm,
    buildGantry: buildGantry,
    buildQuayProps: buildQuayProps,
    buildWorkers: buildWorkers,
    buildFarScenery: buildFarScenery,
    buildTug: buildTug,
    hullSection: hullSection,
    halfBeamAt: halfBeamAt,
    keelYAt: keelYAt,
    deckYAt: deckYAt,
    shipX: shipX,
    railingLine: railingLine
  };
})(typeof window !== 'undefined' ? window : this);
