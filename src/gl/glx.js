/* =========================================================================
   glx.js — thin WebGL2 wrapper: programs, meshes, textures, render targets
   ========================================================================= */
'use strict';

const GLX = {
  gl: null,
  ext: {},
  caps: { float: false, aniso: 0 },

  init(canvas) {
    const opts = {
      alpha: false, depth: true, stencil: false, antialias: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
      powerPreference: 'high-performance', desynchronized: true
    };
    const gl = canvas.getContext('webgl2', opts);
    if (!gl) return null;
    this.gl = gl;
    this.ext.cbf = gl.getExtension('EXT_color_buffer_float')
                || gl.getExtension('EXT_color_buffer_half_float');
    this.ext.lin = gl.getExtension('OES_texture_float_linear');
    this.ext.hlin = gl.getExtension('OES_texture_half_float_linear');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) {
      this.ext.aniso = aniso;
      this.caps.aniso = Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
    }
    this.caps.float = !!this.ext.cbf;
    gl.getExtension('EXT_float_blend');
    return gl;
  },

  /* ------------------------------------------------------------ programs */
  compile(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const numbered = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      throw new Error('shader compile failed:\n' + log + '\n' + numbered);
    }
    return s;
  },
  program(vsSrc, fsSrc, name) {
    const gl = this.gl;
    const p = gl.createProgram();
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('link failed (' + (name || '?') + '): ' + gl.getProgramInfoLog(p));
    }
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const nm = info.name.replace(/\[0\]$/, '');
      u[nm] = gl.getUniformLocation(p, nm);
    }
    return { prog: p, u, name: name || '' };
  },

  /* -------------------------------------------------------------- meshes */
  /**
   * data: { pos:Float32Array, nrm:Float32Array, uv:Float32Array,
   *         ao:Float32Array (optional), idx:Uint32Array }
   */
  mesh(data) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = (arr, loc, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    };
    buf(data.pos, 0, 3);
    buf(data.nrm, 1, 3);
    buf(data.uv, 2, 2);
    buf(data.ao || new Float32Array(data.pos.length / 3).fill(1), 3, 1);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: data.idx.length, type: gl.UNSIGNED_INT };
  },
  draw(m) {
    const gl = this.gl;
    gl.bindVertexArray(m.vao);
    gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
  },

  /* ------------------------------------------------------------ textures */
  texFromCanvas(cv, opts) {
    opts = opts || {};
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opts.flipY !== false);
    gl.texImage2D(gl.TEXTURE_2D, 0, opts.srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8,
                  gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT);
    if (this.ext.aniso && this.caps.aniso > 1) {
      gl.texParameterf(gl.TEXTURE_2D, this.ext.aniso.TEXTURE_MAX_ANISOTROPY_EXT, this.caps.aniso);
    }
    return t;
  },
  /** RGBA16F equirect environment with a manual mip chain for roughness LODs */
  texEquirectF(w, h, data) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT,
                  this.toHalf(data));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  },
  toHalf(f32) {
    const out = new Uint16Array(f32.length);
    const buf = new ArrayBuffer(4), fv = new Float32Array(buf), iv = new Int32Array(buf);
    for (let i = 0; i < f32.length; i++) {
      fv[0] = f32[i];
      const x = iv[0];
      let bits = (x >> 16) & 0x8000;
      let m = (x >> 12) & 0x07ff;
      const e = (x >> 23) & 0xff;
      if (e < 103) { out[i] = bits; continue; }
      if (e > 142) { out[i] = bits | 0x7c00; continue; }
      if (e < 113) {
        m |= 0x0800;
        out[i] = bits | (m >> (114 - e));
        continue;
      }
      bits |= ((e - 112) << 10) | (m >> 1);
      bits += m & 1;
      out[i] = bits;
    }
    return out;
  },
  /** a texture backed by a 2D canvas that changes every frame (latte art).
      sRGB storage: the canvas holds display-referred bytes, so decoding them
      is what keeps the crema a caramel brown instead of near-black. */
  texDynamic(w, h) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  },
  updateDynamic(t, cv) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  },
  bind(unit, tex) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  },

  /* ------------------------------------------------------- render targets */
  /** fmt: 'rgba16f' | 'rgba8' | 'r8'; attachments = number of colour targets */
  target(w, h, o) {
    o = o || {};
    const gl = this.gl;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const cols = [];
    const n = o.colors === undefined ? 1 : o.colors;
    const bufs = [];
    for (let i = 0; i < n; i++) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      const f = (o.fmts && o.fmts[i]) || o.fmt || 'rgba16f';
      if (f === 'rgba16f') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else if (f === 'r8') gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
      cols.push(t); bufs.push(gl.COLOR_ATTACHMENT0 + i);
    }
    if (n > 1) gl.drawBuffers(bufs);
    let depth = null;
    if (o.depth) {
      if (o.depthTex) {
        depth = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, depth);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0,
                      gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (o.compare) {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        }
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
      } else {
        depth = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      }
    }
    if (n === 0) gl.drawBuffers([gl.NONE]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, cols, tex: cols[0], depth, w, h };
  },
  bindTarget(t, clear) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    if (t) gl.viewport(0, 0, t.w, t.h);
    if (clear) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  },

  /* ---------------------------------------------------------- fullscreen */
  quad: null,
  makeQuad() {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.quad = vao;
  },
  drawQuad() {
    const gl = this.gl;
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
};
