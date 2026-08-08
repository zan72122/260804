// Thin WebGL2 wrapper: program compilation with uniform caching, meshes,
// render targets and a fullscreen-quad helper.

export class Renderer {
  constructor(canvas) {
    const opts = {
      alpha: false,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    };
    const gl = canvas.getContext('webgl2', opts);
    if (!gl) throw new Error('WebGL2 not available');
    this.gl = gl;
    this.canvas = canvas;
    this.programs = new Map();
    this.floatLinear = !!gl.getExtension('OES_texture_float_linear');
    this.colorBufferFloat = !!gl.getExtension('EXT_color_buffer_float');
    this._quad = null;
    this.pixelRatio = 1;
    this.width = 1;
    this.height = 1;
  }

  resize(cssW, cssH, ratio) {
    const w = Math.max(1, Math.round(cssW * ratio));
    const h = Math.max(1, Math.round(cssH * ratio));
    if (w === this.width && h === this.height) return false;
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;
    this.pixelRatio = ratio;
    return true;
  }

  program(name, vsSrc, fsSrc) {
    if (this.programs.has(name)) return this.programs.get(name);
    const gl = this.gl;
    const vs = this._shader(gl.VERTEX_SHADER, vsSrc, name + ':vs');
    const fs = this._shader(gl.FRAGMENT_SHADER, fsSrc, name + ':fs');
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`link ${name}: ${gl.getProgramInfoLog(p)}`);
    }
    gl.deleteShader(vs); gl.deleteShader(fs);
    const wrapper = new Program(gl, p, name);
    this.programs.set(name, wrapper);
    return wrapper;
  }

  _shader(type, src, label) {
    const gl = this.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const numbered = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
      throw new Error(`compile ${label}: ${log}\n${numbered}`);
    }
    return s;
  }

  // ---- geometry -----------------------------------------------------------

  mesh(data) {
    return new Mesh(this.gl, data);
  }

  quad() {
    if (!this._quad) {
      this._quad = this.mesh({
        position: { data: new Float32Array([-1, -1, 3, -1, -1, 3]), size: 2 },
        count: 3,
      });
    }
    return this._quad;
  }

  drawQuad() {
    this.quad().draw();
  }

  // ---- render targets -----------------------------------------------------

  target(w, h, opts = {}) {
    return new RenderTarget(this.gl, w, h, opts);
  }

  bindDefault() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
  }
}

export class Program {
  constructor(gl, prog, name) {
    this.gl = gl;
    this.prog = prog;
    this.name = name;
    this.uniforms = new Map();
    this._unit = 0;
    const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog, i);
      const base = info.name.replace(/\[0\]$/, '');
      this.uniforms.set(base, gl.getUniformLocation(prog, info.name));
    }
  }

  use() {
    this.gl.useProgram(this.prog);
    this._unit = 0;
    return this;
  }

  loc(name) {
    return this.uniforms.has(name) ? this.uniforms.get(name) : null;
  }

  f(name, v) { const l = this.loc(name); if (l) this.gl.uniform1f(l, v); return this; }
  i(name, v) { const l = this.loc(name); if (l) this.gl.uniform1i(l, v); return this; }
  v2(name, x, y) { const l = this.loc(name); if (l) this.gl.uniform2f(l, x, y); return this; }
  v3(name, x, y, z) {
    const l = this.loc(name); if (!l) return this;
    if (x.length !== undefined) this.gl.uniform3f(l, x[0], x[1], x[2]);
    else this.gl.uniform3f(l, x, y, z);
    return this;
  }
  v4(name, x, y, z, w) { const l = this.loc(name); if (l) this.gl.uniform4f(l, x, y, z, w); return this; }
  m4(name, m) { const l = this.loc(name); if (l) this.gl.uniformMatrix4fv(l, false, m); return this; }
  m3(name, m) { const l = this.loc(name); if (l) this.gl.uniformMatrix3fv(l, false, m); return this; }
  v3a(name, arr) { const l = this.loc(name); if (l) this.gl.uniform3fv(l, arr); return this; }
  fa(name, arr) { const l = this.loc(name); if (l) this.gl.uniform1fv(l, arr); return this; }

  tex(name, texture) {
    const l = this.loc(name);
    if (!l) return this;
    const gl = this.gl;
    const unit = this._unit++;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(l, unit);
    return this;
  }
}

export class Mesh {
  // data: { position:{data,size}, normal:{...}, uv:{...}, index?:Uint16Array|Uint32Array, count? }
  constructor(gl, data) {
    this.gl = gl;
    this.vao = gl.createVertexArray();
    this.buffers = {};
    this.indexed = false;
    this.count = 0;
    this.mode = data.mode !== undefined ? data.mode : gl.TRIANGLES;
    gl.bindVertexArray(this.vao);

    const attribIndex = { position: 0, normal: 1, uv: 2, extra: 3 };
    for (const key of Object.keys(attribIndex)) {
      const a = data[key];
      if (!a) continue;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, a.data, a.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      gl.enableVertexAttribArray(attribIndex[key]);
      gl.vertexAttribPointer(attribIndex[key], a.size, gl.FLOAT, false, 0, 0);
      this.buffers[key] = buf;
      if (key === 'position' && data.count === undefined) {
        this.count = a.data.length / a.size;
      }
    }
    if (data.count !== undefined) this.count = data.count;

    if (data.index) {
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.index, gl.STATIC_DRAW);
      this.buffers.index = ib;
      this.indexed = true;
      this.count = data.index.length;
      this.indexType = data.index instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    }
    gl.bindVertexArray(null);
  }

  update(key, array, count) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[key]);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, array, 0, count === undefined ? undefined : count);
  }

  draw() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    if (this.indexed) gl.drawElements(this.mode, this.count, this.indexType, 0);
    else gl.drawArrays(this.mode, 0, this.count);
    gl.bindVertexArray(null);
  }

  drawRange(count) {
    const gl = this.gl;
    if (count <= 0) return;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(this.mode, 0, count);
    gl.bindVertexArray(null);
  }
}

export class RenderTarget {
  constructor(gl, w, h, opts = {}) {
    this.gl = gl;
    this.width = w;
    this.height = h;
    this.tex = gl.createTexture();
    const internal = opts.float ? gl.RGBA16F : gl.RGBA8;
    const type = opts.float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    const filter = opts.nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    if (opts.depth) {
      this.depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
  }

  clear(r = 0, g = 0, b = 0, a = 0) {
    const gl = this.gl;
    this.bind();
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT | (this.depth ? gl.DEPTH_BUFFER_BIT : 0));
  }
}

// Depth-only target used for the sun shadow map.
export class DepthTarget {
  constructor(gl, size) {
    this.gl = gl;
    this.width = this.height = size;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0,
      gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.tex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.DEPTH_BUFFER_BIT);
  }
}

// A pair of targets for iterative simulation passes.
export class PingPong {
  constructor(gl, w, h, opts) {
    this.a = new RenderTarget(gl, w, h, opts);
    this.b = new RenderTarget(gl, w, h, opts);
  }
  get read() { return this.a; }
  get write() { return this.b; }
  swap() { const t = this.a; this.a = this.b; this.b = t; }
  clear(r, g, b, a) { this.a.clear(r, g, b, a); this.b.clear(r, g, b, a); }
}
