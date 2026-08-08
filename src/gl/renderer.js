/* =========================================================================
   renderer.js — the frame: shadow → depth/normal → SSAO → PBR → post
   ========================================================================= */
'use strict';

const R3 = {
  gl: null, W: 0, H: 0, scale: 1,
  prog: {}, mats: {}, tex: {},
  T: {},                       // render targets
  quality: { ssao: true, bloom: true, dof: true, shadow: 2048 },
  _m: {
    view: M4.make(), proj: M4.make(), vp: M4.make(), mvp: M4.make(),
    nm: new Float32Array(9), lightView: M4.make(), lightProj: M4.make(),
    lightVP: M4.make(), tmp: M4.make(), inv: M4.make()
  },
  cam: { eye: V3.make(0, 1500, 800), at: V3.make(0, 1050, -100), fov: 0.62, near: 40, far: 9000 },
  key: { pos: V3.make(-420, 2260, 620), at: V3.make(20, 1030, -220),
         color: V3.make(1.0, 0.905, 0.775), cone: 1.02, range: 2600 },
  lamp2: { pos: V3.make(70, 1225, -30), color: V3.make(4.4, 2.55, 1.20) },
  fog: { color: V3.make(0.115, 0.100, 0.094), density: 0.000125 },
  exposure: 1.28, envIntensity: 1.0,

  init(canvas) {
    const gl = GLX.init(canvas);
    if (!gl) return false;
    this.gl = gl;
    GLX.makeQuad();

    this.prog.main = GLX.program(SH.mainVS, SH.mainFS, 'main');
    this.prog.pre = GLX.program(SH.mainVS, SH.prepassFS, 'prepass');
    this.prog.shadow = GLX.program(SH.shadowVS, SH.shadowFS, 'shadow');
    this.prog.ssao = GLX.program(SH.quadVS, SH.ssaoFS, 'ssao');
    this.prog.blur = GLX.program(SH.quadVS, SH.blurFS, 'blur');
    this.prog.down = GLX.program(SH.quadVS, SH.downFS, 'down');
    this.prog.bright = GLX.program(SH.quadVS, SH.brightFS, 'bright');
    this.prog.comp = GLX.program(SH.quadVS, SH.compositeFS, 'comp');
    this.prog.sprite = GLX.program(SH.spriteVS, SH.spriteFS, 'sprite');

    // materials
    const M = Tex.makeAll();
    for (const k in M) {
      this.mats[k] = {
        alb: GLX.texFromCanvas(M[k].albedo, { srgb: true }),
        orm: GLX.texFromCanvas(M[k].orm),
        nrm: GLX.texFromCanvas(M[k].normal)
      };
    }
    const env = Tex.environment(256, 128);
    this.tex.env = GLX.texEquirectF(env.w, env.h, env.data);

    this.T.shadow = GLX.target(this.quality.shadow, this.quality.shadow,
                               { colors: 0, depth: true, depthTex: true, compare: true });
    this.parts = new Particles3D(gl, 900);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    return true;
  },

  resize(w, h, dpr) {
    const budget = 2.2e6;
    let s = Math.min(dpr, 2);
    let W = Math.round(w * s), H = Math.round(h * s);
    if (W * H > budget) { const k = Math.sqrt(budget / (W * H)); W = Math.round(W * k); H = Math.round(H * k); }
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    const gl = this.gl;
    const kill = t => { if (!t) return; gl.deleteFramebuffer(t.fb); t.cols.forEach(c => gl.deleteTexture(c)); };
    ['nz', 'hdr', 'ao', 'aoB', 'half', 'q', 'qb', 'bloomA', 'bloomB'].forEach(k => { kill(this.T[k]); this.T[k] = null; });
    const hw = Math.max(2, W >> 1), hh = Math.max(2, H >> 1);
    const qw = Math.max(2, W >> 2), qh = Math.max(2, H >> 2);
    const ew = Math.max(2, W >> 3), eh = Math.max(2, H >> 3);
    this.T.nz = GLX.target(W, H, { fmt: 'rgba16f', depth: true });
    this.T.hdr = GLX.target(W, H, { fmt: 'rgba16f', depth: true });
    this.T.ao = GLX.target(hw, hh, { fmt: 'rgba8' });
    this.T.aoB = GLX.target(hw, hh, { fmt: 'rgba8' });
    this.T.half = GLX.target(hw, hh, { fmt: 'rgba16f' });
    this.T.q = GLX.target(qw, qh, { fmt: 'rgba16f' });
    this.T.qb = GLX.target(qw, qh, { fmt: 'rgba16f' });
    this.T.bloomA = GLX.target(ew, eh, { fmt: 'rgba16f' });
    this.T.bloomB = GLX.target(ew, eh, { fmt: 'rgba16f' });
  },

  /* ------------------------------------------------------------- helpers */
  setCam(eye, at, fov) {
    V3.copy(this.cam.eye, eye); V3.copy(this.cam.at, at);
    if (fov) this.cam.fov = fov;
  },
  buildMatrices() {
    const m = this._m, c = this.cam;
    M4.perspective(m.proj, c.fov, this.W / this.H, c.near, c.far);
    M4.lookAt(m.view, c.eye, c.at, [0, 1, 0]);
    M4.mul(m.vp, m.proj, m.view);
    M4.invert(m.inv, m.vp);
    // shadow frustum fitted to the working volume above the counter
    M4.lookAt(m.lightView, this.key.pos, this.key.at, [0, 1, 0]);
    M4.perspective(m.lightProj, 1.30, 1, 500, 4200);
    M4.mul(m.lightVP, m.lightProj, m.lightView);
  },
  /** screen pixel -> world ray */
  ray(px, py, outO, outD) {
    const m = this._m;
    const ndcx = (px / this.cssW) * 2 - 1;
    const ndcy = 1 - (py / this.cssH) * 2;
    const a = [ndcx, ndcy, -1], b = [ndcx, ndcy, 1];
    const p0 = M4.xformPoint(V3.make(), m.inv, a);
    const p1 = M4.xformPoint(V3.make(), m.inv, b);
    V3.copy(outO, p0);
    V3.norm(outD, V3.sub(V3.make(), p1, p0));
  },
  /** intersect the pointer ray with the plane z = zc (facing the camera) */
  rayPlaneZ(px, py, zc, out) {
    const o = V3.make(), d = V3.make();
    this.ray(px, py, o, d);
    if (Math.abs(d[2]) < 1e-6) return false;
    const t = (zc - o[2]) / d[2];
    out[0] = o[0] + d[0] * t; out[1] = o[1] + d[1] * t; out[2] = zc;
    return t > 0;
  },
  rayPlaneY(px, py, yc, out) {
    const o = V3.make(), d = V3.make();
    this.ray(px, py, o, d);
    if (Math.abs(d[1]) < 1e-6) return false;
    const t = (yc - o[1]) / d[1];
    out[0] = o[0] + d[0] * t; out[1] = yc; out[2] = o[2] + d[2] * t;
    return t > 0;
  },
  project(p, out) {
    const m = this._m;
    const x = p[0], y = p[1], z = p[2];
    const cx = m.vp[0] * x + m.vp[4] * y + m.vp[8] * z + m.vp[12];
    const cy = m.vp[1] * x + m.vp[5] * y + m.vp[9] * z + m.vp[13];
    const cw = m.vp[3] * x + m.vp[7] * y + m.vp[11] * z + m.vp[15];
    out[0] = (cx / cw * 0.5 + 0.5) * this.cssW;
    out[1] = (1 - (cy / cw * 0.5 + 0.5)) * this.cssH;
    out[2] = cw;
    return out;
  },

  /* -------------------------------------------------------------- passes */
  drawNodes(nodes, prog, forShadow) {
    const gl = this.gl, m = this._m;
    for (const n of nodes) {
      if (!n.visible || !n.mesh) continue;
      if (forShadow && n.noShadow) continue;
      if (!forShadow && n.material && n.material.mode === 4) continue;
      M4.mul(m.mvp, forShadow ? m.lightVP : m.vp, n.mat);
      gl.uniformMatrix4fv(prog.u.uMVP, false, m.mvp);
      if (prog.u.uModel) gl.uniformMatrix4fv(prog.u.uModel, false, n.mat);
      if (prog.u.uNM) { M4.normalMat(m.nm, n.mat); gl.uniformMatrix3fv(prog.u.uNM, false, m.nm); }
      if (!forShadow && prog === this.prog.main) this.applyMaterial(n.material);
      GLX.draw(n.mesh);
    }
  },
  applyMaterial(mt) {
    const gl = this.gl, u = this.prog.main.u;
    const set = mt || {};
    const bank = this.mats[set.tex || 'blank'];
    GLX.bind(0, bank.alb); GLX.bind(1, bank.orm); GLX.bind(2, bank.nrm);
    if (set.extra) GLX.bind(6, set.extra);
    gl.uniform3fv(u.uTint, set.tint || [1, 1, 1]);
    gl.uniform2fv(u.uUVScale, set.uvScale || [1, 1]);
    gl.uniform2fv(u.uRough, set.rough || [1, 0]);
    gl.uniform1f(u.uMetal, set.metal === undefined ? 1 : set.metal);
    gl.uniform3fv(u.uEmissive, set.emissive || [0, 0, 0]);
    gl.uniform1f(u.uNormalAmt, set.normalAmt === undefined ? 1 : set.normalAmt);
    gl.uniform1i(u.uMode, set.mode || 0);
    gl.uniform1f(u.uAlpha, set.alpha === undefined ? 1 : set.alpha);
  },

  render(scene, cssW, cssH) {
    const gl = this.gl, m = this._m;
    this.cssW = cssW; this.cssH = cssH;
    this.buildMatrices();
    const nodes = scene.nodes;

    /* --- 1. shadow map ------------------------------------------------ */
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.T.shadow.fb);
    gl.viewport(0, 0, this.T.shadow.w, this.T.shadow.h);
    gl.colorMask(false, false, false, false);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2.0, 4.0);
    gl.useProgram(this.prog.shadow.prog);
    gl.cullFace(gl.FRONT);
    this.drawNodes(nodes, this.prog.shadow, true);
    gl.cullFace(gl.BACK);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.colorMask(true, true, true, true);

    /* --- 2. depth + view normal -------------------------------------- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.T.nz.fb);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog.pre.prog);
    gl.uniformMatrix4fv(this.prog.pre.u.uView, false, m.view);
    this.drawNodes(nodes, this.prog.pre, false);

    /* --- 3. SSAO ------------------------------------------------------ */
    if (this.quality.ssao) {
      const tanY = Math.tan(this.cam.fov / 2), tanX = tanY * this.W / this.H;
      gl.disable(gl.DEPTH_TEST);
      GLX.bindTarget(this.T.ao, false);
      gl.useProgram(this.prog.ssao.prog);
      GLX.bind(0, this.T.nz.tex);
      gl.uniform1i(this.prog.ssao.u.uNZ, 0);
      gl.uniform2f(this.prog.ssao.u.uTanHalf, tanX, tanY);
      gl.uniform2f(this.prog.ssao.u.uRes, this.T.ao.w, this.T.ao.h);
      gl.uniform1f(this.prog.ssao.u.uRadius, 34);
      gl.uniform1f(this.prog.ssao.u.uStrength, 1.05);
      gl.uniform1f(this.prog.ssao.u.uBias, 1.2);
      gl.uniformMatrix4fv(this.prog.ssao.u.uProj, false, m.proj);
      GLX.drawQuad();
      this.blur(this.T.ao, this.T.aoB, this.T.ao);
      gl.enable(gl.DEPTH_TEST);
    }

    /* --- 4. main forward pass ---------------------------------------- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.T.hdr.fb);
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const P = this.prog.main;
    gl.useProgram(P.prog);
    gl.uniform1i(P.u.uAlb, 0); gl.uniform1i(P.u.uORM, 1); gl.uniform1i(P.u.uNrm, 2);
    gl.uniform1i(P.u.uEnv, 3); gl.uniform1i(P.u.uShadow, 4);
    gl.uniform1i(P.u.uAO2, 5); gl.uniform1i(P.u.uExtra, 6);
    GLX.bind(3, this.tex.env);
    GLX.bind(4, this.T.shadow.depth);
    GLX.bind(5, this.quality.ssao ? this.T.ao.tex : this.mats.blank.alb);
    gl.uniformMatrix4fv(P.u.uView, false, m.view);
    gl.uniformMatrix4fv(P.u.uLightMVP, false, m.lightVP);
    gl.uniform3fv(P.u.uCam, this.cam.eye);
    const kd = V3.norm(V3.make(), V3.sub(V3.make(), this.key.at, this.key.pos));
    gl.uniform3fv(P.u.uKeyPos, this.key.pos);
    gl.uniform3fv(P.u.uKeyDir, kd);
    gl.uniform3f(P.u.uKeyColor, this.key.color[0] * 8.5, this.key.color[1] * 8.5, this.key.color[2] * 8.5);
    gl.uniform1f(P.u.uKeyCone, this.key.cone);
    gl.uniform1f(P.u.uKeyRange, this.key.range);
    gl.uniform3fv(P.u.uLamp2Pos, this.lamp2.pos);
    gl.uniform3fv(P.u.uLamp2Color, this.lamp2.color);
    gl.uniform2f(P.u.uShadowTexel, 1 / this.T.shadow.w, 1 / this.T.shadow.h);
    gl.uniform3fv(P.u.uFogColor, this.fog.color);
    gl.uniform1f(P.u.uFogDensity, this.fog.density);
    gl.uniform1f(P.u.uEnvIntensity, this.envIntensity);
    gl.uniform2f(P.u.uScreen, this.W, this.H);
    gl.uniform1f(P.u.uSsaoOn, this.quality.ssao ? 1 : 0);
    this.drawNodes(nodes, P, false);

    /* --- 4b. steam / sparkles ---------------------------------------- */
    if (this.parts.count > 0) {
      gl.useProgram(this.prog.sprite.prog);
      gl.uniformMatrix4fv(this.prog.sprite.u.uVP, false, m.vp);
      gl.uniformMatrix4fv(this.prog.sprite.u.uView, false, m.view);
      gl.uniform2f(this.prog.sprite.u.uScreen, this.W, this.H);
      GLX.bind(0, this.T.nz.tex);
      gl.uniform1i(this.prog.sprite.u.uNZ, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      this.parts.draw(this.prog.sprite);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    /* --- 5. post ------------------------------------------------------ */
    gl.disable(gl.DEPTH_TEST);
    this.blit(this.prog.down, this.T.half, this.T.hdr.tex, p => {
      gl.uniform2f(p.u.uTexel, 1 / this.W, 1 / this.H);
    });
    this.blit(this.prog.down, this.T.q, this.T.half.tex, p => {
      gl.uniform2f(p.u.uTexel, 1 / this.T.half.w, 1 / this.T.half.h);
    });
    this.blur(this.T.q, this.T.qb, this.T.q);

    if (this.quality.bloom) {
      this.blit(this.prog.bright, this.T.bloomA, this.T.q.tex, p => {
        gl.uniform1f(p.u.uThreshold, 2.1);
      });
      this.blur(this.T.bloomA, this.T.bloomB, this.T.bloomA, 2.0);
      this.blur(this.T.bloomA, this.T.bloomB, this.T.bloomA, 3.4);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.W, this.H);
    const C = this.prog.comp;
    gl.useProgram(C.prog);
    GLX.bind(0, this.T.hdr.tex); gl.uniform1i(C.u.uHDR, 0);
    GLX.bind(1, this.T.q.tex); gl.uniform1i(C.u.uBlur, 1);
    GLX.bind(2, this.quality.bloom ? this.T.bloomA.tex : this.mats.blank.alb);
    gl.uniform1i(C.u.uBloom, 2);
    GLX.bind(3, this.T.nz.tex); gl.uniform1i(C.u.uNZ, 3);
    gl.uniform1f(C.u.uExposure, this.exposure);
    gl.uniform1f(C.u.uBloomAmt, this.quality.bloom ? 0.16 : 0);
    gl.uniform1f(C.u.uVignette, 0.62);
    gl.uniform1f(C.u.uGrain, 0.012);
    gl.uniform1f(C.u.uTime, performance.now() * 0.001);
    const focus = V3.dist(this.cam.eye, this.cam.at);
    gl.uniform2f(C.u.uFocus, focus + 260, 1 / 1500);
    GLX.drawQuad();
    gl.enable(gl.DEPTH_TEST);
  },

  blit(prog, target, srcTex, extra) {
    const gl = this.gl;
    GLX.bindTarget(target, false);
    gl.useProgram(prog.prog);
    GLX.bind(0, srcTex);
    if (prog.u.uTex) gl.uniform1i(prog.u.uTex, 0);
    if (extra) extra(prog);
    GLX.drawQuad();
  },
  blur(src, tmp, dst, mul) {
    const gl = this.gl, k = mul || 1;
    this.blit(this.prog.blur, tmp, src.tex, p => gl.uniform2f(p.u.uDir, k / src.w, 0));
    this.blit(this.prog.blur, dst, tmp.tex, p => gl.uniform2f(p.u.uDir, 0, k / src.h));
  }
};

/* ------------------------------------------------------- billboard system */
class Particles3D {
  constructor(gl, max) {
    this.gl = gl; this.max = max; this.count = 0;
    this.p = [];
    this.data = new Float32Array(max * 4 * 9);   // pos3 + (size,alpha,seed) + uv2 + ao1
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const st = 9 * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, st, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, st, 32);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) {
      idx[i * 6] = i * 4; idx[i * 6 + 1] = i * 4 + 1; idx[i * 6 + 2] = i * 4 + 2;
      idx[i * 6 + 3] = i * 4; idx[i * 6 + 4] = i * 4 + 2; idx[i * 6 + 5] = i * 4 + 3;
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.vao = vao;
    this.color = [1, 1, 1];
  }
  add(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(Object.assign({
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 1,
      size: 20, size1: 40, life: 1, age: 0, a0: 0.5, seed: Math.random()
    }, o));
  }
  clear() { this.p.length = 0; this.count = 0; }
  update(dt) {
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i];
      q.age += dt;
      if (q.age >= q.life) { this.p.splice(i, 1); continue; }
      q.vy += q.g * dt;
      if (q.drag !== 1) { const d = Math.pow(q.drag, dt * 60); q.vx *= d; q.vy *= d; q.vz *= d; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    }
  }
  build() {
    const d = this.data;
    let n = 0;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const q of this.p) {
      if (n >= this.max) break;
      const t = q.age / q.life;
      const a = q.a0 * Math.sin(Math.min(1, t) * Math.PI) ;
      const s = q.size + (q.size1 - q.size) * t;
      for (let c = 0; c < 4; c++) {
        const o = (n * 4 + c) * 9;
        d[o] = q.x; d[o + 1] = q.y; d[o + 2] = q.z;
        d[o + 3] = s; d[o + 4] = a; d[o + 5] = q.seed;
        d[o + 6] = corners[c][0]; d[o + 7] = corners[c][1];
        d[o + 8] = 1;
      }
      n++;
    }
    this.count = n;
  }
  draw(prog) {
    this.build();
    if (!this.count) return;
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * 4 * 9);
    gl.uniform3fv(prog.u.uColor, this.color);
    gl.drawElements(gl.TRIANGLES, this.count * 6, gl.UNSIGNED_INT, 0);
  }
}
