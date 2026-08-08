// Thin WebGL2 helpers: program compilation, meshes (VAO), framebuffers.

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    depth: true,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;
  gl.floatColor = gl.getExtension('EXT_color_buffer_float');
  gl.floatLinear = gl.getExtension('OES_texture_float_linear');
  gl.anisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
  return gl;
}

function compile(gl, type, src, label) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    console.error(`[${label}] shader error:\n${log}`);
    const lines = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    console.error(lines);
    throw new Error(`${label}: ${log}`);
  }
  return sh;
}

export function createProgram(gl, vsSrc, fsSrc, label = 'program') {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc, label + '.vs');
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, label + '.fs');
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`${label} link: ${gl.getProgramInfoLog(p)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const uniforms = new Map();
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms.set(name, gl.getUniformLocation(p, name));
  }
  return { program: p, uniforms, label };
}

export function useProgram(gl, prog) {
  gl.useProgram(prog.program);
}

// Loose uniform setter — picks the call by value shape.
export function setUniforms(gl, prog, values) {
  let unit = 0;
  for (const key in values) {
    const loc = prog.uniforms.get(key);
    if (loc === undefined || loc === null) continue;
    const v = values[key];
    if (v == null) continue;
    if (typeof v === 'number') {
      gl.uniform1f(loc, v);
    } else if (typeof v === 'boolean') {
      gl.uniform1i(loc, v ? 1 : 0);
    } else if (v instanceof WebGLTexture) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(v.__target || gl.TEXTURE_2D, v);
      gl.uniform1i(loc, unit);
      unit++;
    } else if (v.length === 16) {
      gl.uniformMatrix4fv(loc, false, v);
    } else if (v.length === 9) {
      gl.uniformMatrix3fv(loc, false, v);
    } else if (v.length === 4) {
      gl.uniform4fv(loc, v);
    } else if (v.length === 3) {
      gl.uniform3fv(loc, v);
    } else if (v.length === 2) {
      gl.uniform2fv(loc, v);
    } else if (v.length === 1) {
      gl.uniform1fv(loc, v);
    }
  }
}

/**
 * Mesh with interleaved [pos(3) normal(3) uv(2) ao(1)] = 9 floats/vertex.
 */
export const STRIDE = 9;

export function createMesh(gl, data, indices, dynamic = false) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  const bytes = STRIDE * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, bytes, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, bytes, 12);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, bytes, 24);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, bytes, 32);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  const idx = indices instanceof Uint32Array ? indices : new Uint32Array(indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, vbo, ibo, count: idx.length, data };
}

export function updateMesh(gl, mesh, data) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
}

export function drawMesh(gl, mesh) {
  gl.bindVertexArray(mesh.vao);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
}

export function createTexture(gl, opts) {
  const {
    width, height, internalFormat, format, type,
    filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE, data = null,
  } = opts;
  const tex = gl.createTexture();
  tex.__target = gl.TEXTURE_2D;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return tex;
}

export function createRenderTarget(gl, width, height, { float = true, depth = false } = {}) {
  const useFloat = float && !!gl.floatColor;
  const color = createTexture(gl, {
    width, height,
    internalFormat: useFloat ? gl.RGBA16F : gl.RGBA8,
    format: gl.RGBA,
    type: useFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
    filter: gl.LINEAR,
  });
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  let depthBuf = null;
  if (depth) {
    depthBuf = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuf);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuf);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, color, depthBuf, width, height };
}

export function createShadowTarget(gl, size) {
  const tex = gl.createTexture();
  tex.__target = gl.TEXTURE_2D;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0,
    gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, size };
}

let quadMesh = null;
export function drawFullscreenQuad(gl) {
  if (!quadMesh) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    quadMesh = { vao };
  }
  gl.bindVertexArray(quadMesh.vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
