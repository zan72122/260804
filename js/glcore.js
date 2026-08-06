/* =========================================================
   glcore.js — 生WebGLの小さなヘルパ（依存なし）
   ========================================================= */
(function (global) {
  'use strict';

  var G = {};

  G.create = function (canvas) {
    var opts = {
      alpha: false, antialias: true, depth: true, stencil: false,
      premultipliedAlpha: true, preserveDrawingBuffer: false,
      powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false
    };
    var gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    return gl;
  };

  function shader(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('shader error:', gl.getShaderInfoLog(s), '\n', src);
      return null;
    }
    return s;
  }

  /* プログラム生成 + uniform/attrib の自動収集 */
  G.program = function (gl, vsSrc, fsSrc) {
    var vs = shader(gl, gl.VERTEX_SHADER, vsSrc);
    var fs = shader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('link error:', gl.getProgramInfoLog(p));
      return null;
    }
    var obj = { p: p, u: {}, a: {} };
    var nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < nu; i++) {
      var ui = gl.getActiveUniform(p, i);
      var nm = ui.name.replace(/\[0\]$/, '');
      obj.u[nm] = gl.getUniformLocation(p, ui.name);
    }
    var na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (var j = 0; j < na; j++) {
      var ai = gl.getActiveAttrib(p, j);
      obj.a[ai.name] = gl.getAttribLocation(p, ai.name);
    }
    return obj;
  };

  G.buffer = function (gl, data, type, usage) {
    var b = gl.createBuffer();
    var t = type || gl.ARRAY_BUFFER;
    gl.bindBuffer(t, b);
    gl.bufferData(t, data, usage || gl.STATIC_DRAW);
    return b;
  };

  G.attrib = function (gl, prog, name, buf, size, stride, offset) {
    var loc = prog.a[name];
    if (loc === undefined || loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, (stride || 0) * 4, (offset || 0) * 4);
  };

  G.disableAll = function (gl, prog) {
    for (var k in prog.a) {
      if (prog.a[k] >= 0) gl.disableVertexAttribArray(prog.a[k]);
    }
  };

  /* ---------- ジオメトリ ---------- */

  /* 球（inward=true で内側から見る用に法線・面を反転） */
  G.sphere = function (radius, segs, rings, polarMaxDeg, inward) {
    var pos = [], nrm = [], uv = [], idx = [];
    var pmax = (polarMaxDeg || 180) * Math.PI / 180;
    for (var r = 0; r <= rings; r++) {
      var v = r / rings;
      var phi = v * pmax;
      var sp = Math.sin(phi), cp = Math.cos(phi);
      for (var s = 0; s <= segs; s++) {
        var u = s / segs;
        var th = u * Math.PI * 2;
        var x = sp * Math.cos(th), y = cp, z = sp * Math.sin(th);
        pos.push(x * radius, y * radius, z * radius);
        var n = inward ? -1 : 1;
        nrm.push(x * n, y * n, z * n);
        uv.push(u, v);
      }
    }
    for (var rr = 0; rr < rings; rr++) {
      for (var ss = 0; ss < segs; ss++) {
        var a = rr * (segs + 1) + ss;
        var b = a + segs + 1;
        if (inward) idx.push(a, a + 1, b, b, a + 1, b + 1);
        else idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return {
      pos: new Float32Array(pos), nrm: new Float32Array(nrm),
      uv: new Float32Array(uv), idx: new Uint16Array(idx), count: idx.length
    };
  };

  /* 箱 */
  G.box = function (w, h, d) {
    var x = w / 2, y = h / 2, z = d / 2;
    var P = [
      [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
      [-x, -y, -z], [-x, y, -z], [x, y, -z], [x, -y, -z]
    ];
    var faces = [
      [0, 1, 2, 3, 0, 0, 1], [7, 4, 5, 6, 0, 0, -1],
      [1, 7, 6, 2, 1, 0, 0], [4, 0, 3, 5, -1, 0, 0],
      [3, 2, 6, 5, 0, 1, 0], [4, 7, 1, 0, 0, -1, 0]
    ];
    var pos = [], nrm = [], uv = [], idx = [], k = 0;
    faces.forEach(function (f) {
      for (var i = 0; i < 4; i++) {
        pos.push(P[f[i]][0], P[f[i]][1], P[f[i]][2]);
        nrm.push(f[4], f[5], f[6]);
      }
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
      k += 4;
    });
    return {
      pos: new Float32Array(pos), nrm: new Float32Array(nrm),
      uv: new Float32Array(uv), idx: new Uint16Array(idx), count: idx.length
    };
  };

  /* 円盤（床） */
  G.disk = function (radius, segs) {
    var pos = [0, 0, 0], nrm = [0, 1, 0], uv = [0.5, 0.5], idx = [];
    for (var i = 0; i <= segs; i++) {
      var a = i / segs * Math.PI * 2;
      pos.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      nrm.push(0, 1, 0);
      uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
      if (i > 0) idx.push(0, i, i + 1);
    }
    return {
      pos: new Float32Array(pos), nrm: new Float32Array(nrm),
      uv: new Float32Array(uv), idx: new Uint16Array(idx), count: idx.length
    };
  };

  /* ---------- 回転体（すべての 丸いものの 土台） ----------
     profile = [[半径, 高さ], ...] を 下から 上へ ならべる。
     法線は となりの 断面から 出すので、テーパでも 正しく 光る。
     capBottom / capTop で フタを つける（既定は つける）。 */
  G.lathe = function (profile, segs, capBottom, capTop) {
    segs = segs || 20;
    if (capBottom === undefined) capBottom = true;
    if (capTop === undefined) capTop = true;
    var pos = [], nrm = [], uv = [], idx = [], vo = 0;
    var n = profile.length;

    /* 区間ごとの 法線（半径方向, 高さ方向）。
       同じ点を 2回 ならべると そこが 稜線（ハードエッジ）に なる。 */
    var segN = [];
    for (var i = 0; i < n - 1; i++) {
      var dr = profile[i + 1][0] - profile[i][0];
      var dh = profile[i + 1][1] - profile[i][1];
      var sl = Math.hypot(dr, dh);
      segN.push(sl < 1e-6 ? null : [dh / sl, -dr / sl]);
    }
    var VN = [];
    for (var j = 0; j < n; j++) {
      var pa = (j > 0) ? segN[j - 1] : null;
      var pb = (j < n - 1) ? segN[j] : null;
      var nv = (pa && pb) ? [pa[0] + pb[0], pa[1] + pb[1]] : (pa || pb || [1, 0]);
      var nl = Math.hypot(nv[0], nv[1]) || 1;
      VN.push([nv[0] / nl, nv[1] / nl]);
    }

    /* --- 側面 --- */
    for (var r = 0; r < n; r++) {
      for (var s = 0; s <= segs; s++) {
        var th = s / segs * Math.PI * 2;
        var c = Math.cos(th), si = Math.sin(th);
        pos.push(c * profile[r][0], profile[r][1], si * profile[r][0]);
        nrm.push(c * VN[r][0], VN[r][1], si * VN[r][0]);
        uv.push(s / segs, r / Math.max(1, n - 1));
      }
    }
    for (var rr = 0; rr < n - 1; rr++) {
      for (var ss = 0; ss < segs; ss++) {
        var A = rr * (segs + 1) + ss, B = A + segs + 1;
        idx.push(A, B, A + 1, A + 1, B, B + 1);
      }
    }
    vo = n * (segs + 1);

    /* --- フタ --- */
    function cap(rad, y, dir) {
      if (rad <= 1e-5) return;
      var base = vo;
      pos.push(0, y, 0); nrm.push(0, dir, 0); uv.push(0.5, 0.5); vo++;
      for (var s2 = 0; s2 <= segs; s2++) {
        var t2 = s2 / segs * Math.PI * 2;
        pos.push(Math.cos(t2) * rad, y, Math.sin(t2) * rad);
        nrm.push(0, dir, 0);
        uv.push(0.5 + Math.cos(t2) * 0.5, 0.5 + Math.sin(t2) * 0.5);
        vo++;
        if (s2 > 0) {
          if (dir > 0) idx.push(base, base + s2, base + s2 + 1);
          else idx.push(base, base + s2 + 1, base + s2);
        }
      }
    }
    if (capBottom) cap(profile[0][0], profile[0][1], -1);
    if (capTop) cap(profile[n - 1][0], profile[n - 1][1], 1);

    return {
      pos: new Float32Array(pos), nrm: new Float32Array(nrm),
      uv: new Float32Array(uv), idx: new Uint16Array(idx), count: idx.length
    };
  };

  /* 円柱・円錐（中心が 原点、フタつき） */
  G.cylinder = function (r0, r1, h, segs, open) {
    return G.lathe([[r0, -h / 2], [r1, h / 2]], segs || 16, !open, !open);
  };

  /* 厚みのある 円盤（上面・下面・外周・中心穴つき）。軸は Y。 */
  G.disc = function (rOut, rIn, thick, segs) {
    segs = segs || 28;
    var pos = [], nrm = [], uv = [], idx = [], vo = 0;
    var hy = thick / 2;
    function ring(rad, y, nx, nyv) {
      var base = vo;
      for (var s = 0; s <= segs; s++) {
        var th = s / segs * Math.PI * 2;
        var c = Math.cos(th), si = Math.sin(th);
        pos.push(c * rad, y, si * rad);
        nrm.push(c * nx, nyv, si * nx);
        uv.push(s / segs, rad);
        vo++;
      }
      return base;
    }
    function bridge(a, b, flip) {
      for (var s = 0; s < segs; s++) {
        if (flip) idx.push(a + s, b + s, a + s + 1, a + s + 1, b + s, b + s + 1);
        else idx.push(a + s, a + s + 1, b + s, a + s + 1, b + s + 1, b + s);
      }
    }
    var hasHole = rIn > 1e-4;
    /* 上面 */
    var tOut = ring(rOut, hy, 0, 1);
    var tIn = ring(Math.max(rIn, 0.0001), hy, 0, 1);
    bridge(tIn, tOut, false);
    /* 下面 */
    var bOut = ring(rOut, -hy, 0, -1);
    var bIn = ring(Math.max(rIn, 0.0001), -hy, 0, -1);
    bridge(bOut, bIn, false);
    /* 外周 */
    var eT = ring(rOut, hy, 1, 0), eB = ring(rOut, -hy, 1, 0);
    bridge(eB, eT, false);
    /* 内周 */
    if (hasHole) {
      var iT = ring(rIn, hy, -1, 0), iB = ring(rIn, -hy, -1, 0);
      bridge(iT, iB, false);
    }
    return {
      pos: new Float32Array(pos), nrm: new Float32Array(nrm),
      uv: new Float32Array(uv), idx: new Uint16Array(idx), count: idx.length
    };
  };

  /* ドーナツ（真鍮リング・ハンドル）。軸は Y。 */
  G.torus = function (R, r, segs, rings) {
    segs = segs || 20; rings = rings || 10;
    var pos = [], nrm = [], uv = [], idx = [];
    for (var i = 0; i <= segs; i++) {
      var u = i / segs * Math.PI * 2;
      var cu = Math.cos(u), su = Math.sin(u);
      for (var j = 0; j <= rings; j++) {
        var v = j / rings * Math.PI * 2;
        var cv = Math.cos(v), sv = Math.sin(v);
        pos.push(cu * (R + r * cv), r * sv, su * (R + r * cv));
        nrm.push(cu * cv, sv, su * cv);
        uv.push(i / segs, j / rings);
      }
    }
    for (var a = 0; a < segs; a++) {
      for (var b = 0; b < rings; b++) {
        var p0 = a * (rings + 1) + b, p1 = p0 + rings + 1;
        idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1);
      }
    }
    return {
      pos: new Float32Array(pos), nrm: new Float32Array(nrm),
      uv: new Float32Array(uv), idx: new Uint16Array(idx), count: idx.length
    };
  };

  /* ---------- メッシュ組み立て ----------
     push() で ジオメトリを 行列ごと 焼きこみ、
     返ってくる {first,count} で あとから 部分描画できる。 */
  function Builder() {
    this.P = []; this.N = []; this.C = []; this.R = []; this.I = [];
    this.vo = 0;
  }
  Builder.prototype.push = function (geo, m, col, emis, kind, mat) {
    var first = this.I.length;
    var n = geo.pos.length / 3;
    m = m || G.IDENT;
    for (var i = 0; i < n; i++) {
      var x = geo.pos[i * 3], y = geo.pos[i * 3 + 1], z = geo.pos[i * 3 + 2];
      this.P.push(m[0] * x + m[4] * y + m[8] * z + m[12],
                  m[1] * x + m[5] * y + m[9] * z + m[13],
                  m[2] * x + m[6] * y + m[10] * z + m[14]);
      var nx = geo.nrm[i * 3], ny = geo.nrm[i * 3 + 1], nz = geo.nrm[i * 3 + 2];
      var ox = m[0] * nx + m[4] * ny + m[8] * nz;
      var oy = m[1] * nx + m[5] * ny + m[9] * nz;
      var oz = m[2] * nx + m[6] * ny + m[10] * nz;
      var l = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
      this.N.push(ox / l, oy / l, oz / l);
      this.C.push(col[0], col[1], col[2]);
      this.R.push(emis || 0, kind || 0, mat || 0);
    }
    for (var j = 0; j < geo.idx.length; j++) this.I.push(geo.idx[j] + this.vo);
    this.vo += n;
    return { first: first, count: geo.idx.length };
  };
  Builder.prototype.upload = function (gl) {
    var big = this.vo > 65000;
    var type = gl.UNSIGNED_SHORT, arr;
    if (big && gl.getExtension('OES_element_index_uint')) {
      arr = new Uint32Array(this.I); type = gl.UNSIGNED_INT;
    } else {
      arr = new Uint16Array(this.I);
    }
    return {
      pos: G.buffer(gl, new Float32Array(this.P)),
      nrm: G.buffer(gl, new Float32Array(this.N)),
      col: G.buffer(gl, new Float32Array(this.C)),
      par: G.buffer(gl, new Float32Array(this.R)),
      idx: G.buffer(gl, arr, gl.ELEMENT_ARRAY_BUFFER),
      type: type, count: this.I.length, verts: this.vo
    };
  };
  G.Builder = Builder;
  G.IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  /* 角の丸い箱（クッションや つくえの天板に） */
  G.roundBox = function (w, h, d, r, seg) {
    seg = seg || 3;
    var pos = [], nrm = [], uv = [], idx = [];
    var rings = seg * 2 + 1, segs = seg * 4;
    for (var i = 0; i < rings; i++) {
      var v = i / (rings - 1);
      var phi = v * Math.PI;
      var sp = Math.sin(phi), cp = Math.cos(phi);
      for (var j = 0; j <= segs; j++) {
        var u = j / segs, th = u * Math.PI * 2;
        var nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
        /* 球を 立方体側へ 押し出して 角丸の箱にする */
        var px = Math.sign(nx) * Math.min(Math.abs(nx) / 0.577, 1) * (w / 2 - r) + nx * r;
        var py = Math.sign(ny) * Math.min(Math.abs(ny) / 0.577, 1) * (h / 2 - r) + ny * r;
        var pz = Math.sign(nz) * Math.min(Math.abs(nz) / 0.577, 1) * (d / 2 - r) + nz * r;
        pos.push(px, py, pz);
        nrm.push(nx, ny, nz);
        uv.push(u, v);
      }
    }
    for (var a = 0; a < rings - 1; a++) {
      for (var b = 0; b < segs; b++) {
        var i0 = a * (segs + 1) + b, i1 = i0 + segs + 1;
        idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
      }
    }
    return {
      pos: new Float32Array(pos), nrm: new Float32Array(nrm),
      uv: new Float32Array(uv), idx: new Uint16Array(idx), count: idx.length
    };
  };

  /* 複数ジオメトリを行列で焼きこんで結合 */
  G.merge = function (parts) {
    var np = 0, ni = 0;
    parts.forEach(function (p) { np += p.geo.pos.length / 3; ni += p.geo.idx.length; });
    var pos = new Float32Array(np * 3), nrm = new Float32Array(np * 3);
    var uv = new Float32Array(np * 2), ext = new Float32Array(np * 3);
    var idx = (np > 65000) ? new Uint32Array(ni) : new Uint16Array(ni);
    var vo = 0, io = 0;
    parts.forEach(function (p) {
      var m = p.m, g = p.geo, n = g.pos.length / 3;
      var e = p.extra || [0, 0, 0];
      for (var i = 0; i < n; i++) {
        var x = g.pos[i * 3], y = g.pos[i * 3 + 1], z = g.pos[i * 3 + 2];
        pos[(vo + i) * 3]     = m[0] * x + m[4] * y + m[8] * z + m[12];
        pos[(vo + i) * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        pos[(vo + i) * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        var nx = g.nrm[i * 3], ny = g.nrm[i * 3 + 1], nz = g.nrm[i * 3 + 2];
        var ox = m[0] * nx + m[4] * ny + m[8] * nz;
        var oy = m[1] * nx + m[5] * ny + m[9] * nz;
        var oz = m[2] * nx + m[6] * ny + m[10] * nz;
        var l = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
        nrm[(vo + i) * 3] = ox / l; nrm[(vo + i) * 3 + 1] = oy / l; nrm[(vo + i) * 3 + 2] = oz / l;
        uv[(vo + i) * 2] = g.uv[i * 2]; uv[(vo + i) * 2 + 1] = g.uv[i * 2 + 1];
        ext[(vo + i) * 3] = e[0]; ext[(vo + i) * 3 + 1] = e[1]; ext[(vo + i) * 3 + 2] = e[2];
      }
      for (var j = 0; j < g.idx.length; j++) idx[io + j] = g.idx[j] + vo;
      vo += n; io += g.idx.length;
    });
    return { pos: pos, nrm: nrm, uv: uv, ext: ext, idx: idx, count: idx.length, big: np > 65000 };
  };

  global.GLC = G;
})(window);
