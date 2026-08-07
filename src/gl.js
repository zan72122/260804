/* WebGL2 の薄いラッパ：シェーダ、メッシュ、FBO、テクスチャ */
(function (root) {
  'use strict';
  var DD = (root.DD = root.DD || {});

  function compile(gl, type, src, label) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh);
      var lines = src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n');
      console.error('shader compile failed [' + label + ']\n' + log + '\n' + lines);
      throw new Error('shader ' + label + ': ' + log);
    }
    return sh;
  }

  function Program(gl, vsSrc, fsSrc, label) {
    this.gl = gl;
    this.label = label || 'prog';
    var vs = compile(gl, gl.VERTEX_SHADER, vsSrc, this.label + '.vs');
    var fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, this.label + '.fs');
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    // 全プログラムで属性位置を固定する
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.bindAttribLocation(p, 1, 'aNrm');
    gl.bindAttribLocation(p, 2, 'aUV');
    gl.bindAttribLocation(p, 3, 'aCol');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('link ' + this.label + ': ' + gl.getProgramInfoLog(p));
    }
    gl.deleteShader(vs); gl.deleteShader(fs);
    this.id = p;
    this.loc = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i);
      var name = info.name.replace(/\[0\]$/, '');
      this.loc[name] = gl.getUniformLocation(p, name);
    }
  }
  Program.prototype.use = function () { this.gl.useProgram(this.id); return this; };
  Program.prototype.u1f = function (n, v) { var l = this.loc[n]; if (l) this.gl.uniform1f(l, v); return this; };
  Program.prototype.u1i = function (n, v) { var l = this.loc[n]; if (l) this.gl.uniform1i(l, v); return this; };
  Program.prototype.u2f = function (n, a, b) { var l = this.loc[n]; if (l) this.gl.uniform2f(l, a, b); return this; };
  Program.prototype.u3f = function (n, a, b, c) { var l = this.loc[n]; if (l) this.gl.uniform3f(l, a, b, c); return this; };
  Program.prototype.u4f = function (n, a, b, c, d) { var l = this.loc[n]; if (l) this.gl.uniform4f(l, a, b, c, d); return this; };
  Program.prototype.u3fv = function (n, v) { var l = this.loc[n]; if (l) this.gl.uniform3fv(l, v); return this; };
  Program.prototype.umat4 = function (n, v) { var l = this.loc[n]; if (l) this.gl.uniformMatrix4fv(l, false, v); return this; };
  Program.prototype.umat3 = function (n, v) { var l = this.loc[n]; if (l) this.gl.uniformMatrix3fv(l, false, v); return this; };
  Program.prototype.tex = function (n, unit, texture, target) {
    var gl = this.gl, l = this.loc[n];
    if (!l) return this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target || gl.TEXTURE_2D, texture);
    gl.uniform1i(l, unit);
    return this;
  };

  /* 頂点レイアウト: pos(3) nrm(3) uv(2) col(3) = 11 float */
  var STRIDE = 11;

  function Mesh(gl, data, indices, mode) {
    this.gl = gl;
    this.mode = mode === undefined ? gl.TRIANGLES : mode;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data instanceof Float32Array ? data : new Float32Array(data), gl.STATIC_DRAW);
    var s = STRIDE * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, s, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, s, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, s, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, s, 32);
    if (indices && indices.length) {
      this.ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      var maxIdx = 0;
      for (var k = 0; k < indices.length; k++) if (indices[k] > maxIdx) maxIdx = indices[k];
      var big = maxIdx > 65535;
      var arr = big ? new Uint32Array(indices) : new Uint16Array(indices);
      this.itype = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      this.count = indices.length;
      this.indexed = true;
    } else {
      this.count = (data.length / STRIDE) | 0;
      this.indexed = false;
    }
    gl.bindVertexArray(null);
  }
  Mesh.prototype.draw = function () {
    var gl = this.gl;
    gl.bindVertexArray(this.vao);
    if (this.indexed) gl.drawElements(this.mode, this.count, this.itype, 0);
    else gl.drawArrays(this.mode, 0, this.count);
  };

  /* カラー + デプス を持つ FBO */
  function Framebuffer(gl, w, h, opt) {
    opt = opt || {};
    this.gl = gl;
    this.w = w; this.h = h;
    this.float = !!opt.float;
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    this.color = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.color);
    var ifmt = this.float ? gl.RGBA16F : gl.RGBA8;
    var type = this.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.color, 0);
    if (opt.depthTexture) {
      this.depth = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.depth);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depth, 0);
    } else if (opt.depth !== false) {
      this.rbo = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.rbo);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.rbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  Framebuffer.prototype.bind = function () {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
  };
  Framebuffer.prototype.dispose = function () {
    var gl = this.gl;
    gl.deleteFramebuffer(this.fbo);
    if (this.color) gl.deleteTexture(this.color);
    if (this.depth) gl.deleteTexture(this.depth);
    if (this.rbo) gl.deleteRenderbuffer(this.rbo);
  };

  /* 深度専用（シャドウマップ） */
  function ShadowMap(gl, size) {
    this.gl = gl; this.size = size;
    this.fbo = gl.createFramebuffer();
    this.depth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.depth);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depth, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  ShadowMap.prototype.bind = function () {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.size, this.size);
  };

  /* CPU 生成テクスチャ（RGBA8） */
  function makeTexture(gl, w, h, pixels, opt) {
    opt = opt || {};
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    var wrap = opt.wrap || gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (opt.mipmap !== false) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    return t;
  }

  DD.gl = {
    Program: Program,
    Mesh: Mesh,
    Framebuffer: Framebuffer,
    ShadowMap: ShadowMap,
    makeTexture: makeTexture,
    STRIDE: STRIDE
  };
})(typeof window !== 'undefined' ? window : this);
