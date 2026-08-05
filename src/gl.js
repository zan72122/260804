// ---------------------------------------------------------------------------
// WebGL 薄いラッパ: シェーダ / メッシュ / フレームバッファ
// GLSL ES 1.00 で記述するため WebGL1 / WebGL2 の両方で動く
// ---------------------------------------------------------------------------
'use strict';

const ATTR = { aPos: 0, aNormal: 1, aUV: 2 };

function createGL(canvas) {
  const opts = {
    alpha: false,
    antialias: false,           // 自前のスケーリング + ブルームで済ませる (モバイル負荷対策)
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: false,
  };
  const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts)
    || canvas.getContext('experimental-webgl', opts);
  if (!gl) return null;
  gl.getExtension('OES_element_index_uint');
  return gl;
}

class Program {
  constructor(gl, vsSrc, fsSrc, name) {
    this.gl = gl;
    this.name = name || 'program';
    const vs = this._compile(gl.VERTEX_SHADER, vsSrc);
    const fs = this._compile(gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    for (const k in ATTR) gl.bindAttribLocation(p, ATTR[k], k);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('[' + this.name + '] link error: ' + gl.getProgramInfoLog(p));
    }
    gl.deleteShader(vs); gl.deleteShader(fs);
    this.prog = p;
    this.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const base = info.name.replace(/\[0\]$/, '');
      this.u[base] = gl.getUniformLocation(p, info.name);
    }
  }
  _compile(type, src) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      throw new Error('[' + this.name + '] compile error: ' + log + '\n' + lines);
    }
    return s;
  }
  use() { this.gl.useProgram(this.prog); return this; }
  m4(n, v) { const l = this.u[n]; if (l) this.gl.uniformMatrix4fv(l, false, v); return this; }
  m3(n, v) { const l = this.u[n]; if (l) this.gl.uniformMatrix3fv(l, false, v); return this; }
  v3(n, v) { const l = this.u[n]; if (l) this.gl.uniform3f(l, v[0], v[1], v[2]); return this; }
  v2(n, x, y) { const l = this.u[n]; if (l) this.gl.uniform2f(l, x, y); return this; }
  f(n, v) { const l = this.u[n]; if (l) this.gl.uniform1f(l, v); return this; }
  i(n, v) { const l = this.u[n]; if (l) this.gl.uniform1i(l, v); return this; }
  tex(n, unit, texture) {
    const l = this.u[n];
    if (l) {
      this.gl.activeTexture(this.gl.TEXTURE0 + unit);
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.uniform1i(l, unit);
    }
    return this;
  }
}

// data: { pos: [], nrm: [], uv: [], idx: [] }
class Mesh {
  constructor(gl, data, mode) {
    this.gl = gl;
    this.mode = mode === undefined ? gl.TRIANGLES : mode;
    const n = data.pos.length / 3;
    this.vertexCount = n;
    this.buf = gl.createBuffer();
    // インターリーブ: pos(3) nrm(3) uv(2) = 8 float
    const inter = new Float32Array(n * 8);
    const nrm = data.nrm, uv = data.uv;
    for (let i = 0; i < n; i++) {
      inter[i * 8] = data.pos[i * 3];
      inter[i * 8 + 1] = data.pos[i * 3 + 1];
      inter[i * 8 + 2] = data.pos[i * 3 + 2];
      inter[i * 8 + 3] = nrm ? nrm[i * 3] : 0;
      inter[i * 8 + 4] = nrm ? nrm[i * 3 + 1] : 1;
      inter[i * 8 + 5] = nrm ? nrm[i * 3 + 2] : 0;
      inter[i * 8 + 6] = uv ? uv[i * 2] : 0;
      inter[i * 8 + 7] = uv ? uv[i * 2 + 1] : 0;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
    if (data.idx && data.idx.length) {
      this.ibuf = gl.createBuffer();
      const big = n > 65535;
      this.idxType = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      const arr = big ? new Uint32Array(data.idx) : new Uint16Array(data.idx);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      this.indexCount = data.idx.length;
    } else {
      this.ibuf = null;
      this.indexCount = 0;
    }
  }
  bind() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(ATTR.aPos);
    gl.vertexAttribPointer(ATTR.aPos, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(ATTR.aNormal);
    gl.vertexAttribPointer(ATTR.aNormal, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(ATTR.aUV);
    gl.vertexAttribPointer(ATTR.aUV, 2, gl.FLOAT, false, 32, 24);
    if (this.ibuf) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf);
  }
  // ratio: 0..1 で先頭からの部分描画 (継ぎ目の成長表現に使う)
  draw(ratio) {
    const gl = this.gl;
    this.bind();
    if (this.ibuf) {
      let c = this.indexCount;
      if (ratio !== undefined && ratio < 1) c = Math.max(0, Math.floor(this.indexCount * ratio / 3) * 3);
      if (c > 0) gl.drawElements(this.mode, c, this.idxType, 0);
    } else {
      let c = this.vertexCount;
      if (ratio !== undefined && ratio < 1) c = Math.max(0, Math.floor(this.vertexCount * ratio));
      if (c > 0) gl.drawArrays(this.mode, 0, c);
    }
  }
  dispose() {
    this.gl.deleteBuffer(this.buf);
    if (this.ibuf) this.gl.deleteBuffer(this.ibuf);
  }
}

// 点群 (ほこり) 用: 位置 + ランダム属性のみ
class PointCloud {
  constructor(gl, positions, extras) {
    this.gl = gl;
    this.count = positions.length / 3;
    const inter = new Float32Array(this.count * 8);
    for (let i = 0; i < this.count; i++) {
      inter[i * 8] = positions[i * 3];
      inter[i * 8 + 1] = positions[i * 3 + 1];
      inter[i * 8 + 2] = positions[i * 3 + 2];
      inter[i * 8 + 3] = extras[i * 3];
      inter[i * 8 + 4] = extras[i * 3 + 1];
      inter[i * 8 + 5] = extras[i * 3 + 2];
      inter[i * 8 + 6] = 0; inter[i * 8 + 7] = 0;
    }
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
  }
  draw() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(ATTR.aPos);
    gl.vertexAttribPointer(ATTR.aPos, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(ATTR.aNormal);
    gl.vertexAttribPointer(ATTR.aNormal, 3, gl.FLOAT, false, 32, 12);
    gl.disableVertexAttribArray(ATTR.aUV);
    gl.vertexAttrib2f(ATTR.aUV, 0, 0);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.enableVertexAttribArray(ATTR.aUV);
  }
  dispose() { this.gl.deleteBuffer(this.buf); }
}

class FBO {
  constructor(gl, w, h, opt) {
    opt = opt || {};
    this.gl = gl; this.w = w; this.h = h;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    if (opt.depth) {
      this.depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  resize(w, h) {
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.w = w; this.h = h;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    if (this.depth) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    }
  }
  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, this.w, this.h);
  }
}

function makeQuad(gl) {
  return new Mesh(gl, {
    pos: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
    nrm: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv: [0, 0, 1, 0, 1, 1, 0, 1],
    idx: [0, 1, 2, 0, 2, 3],
  });
}
