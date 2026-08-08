// Render graph: shadow depth pass -> HDR forward pass -> bloom -> tonemapped composite.

import { mat4, vec3 } from './math.js';
import * as GL from './gl.js';
import * as S from './shaders.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = GL.createContext(canvas);
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;

    this.progSurface = GL.createProgram(gl, S.VS_SURFACE, S.FS_SURFACE, 'surface');
    this.progLeaf = GL.createProgram(gl, S.VS_LEAF, S.FS_LEAF, 'leaf');
    this.progDepth = GL.createProgram(gl, S.VS_DEPTH, S.FS_DEPTH, 'depth');
    this.progBright = GL.createProgram(gl, S.VS_QUAD, S.FS_BRIGHT, 'bright');
    this.progBlur = GL.createProgram(gl, S.VS_QUAD, S.FS_BLUR, 'blur');
    this.progComposite = GL.createProgram(gl, S.VS_QUAD, S.FS_COMPOSITE, 'composite');
    this.progMote = GL.createProgram(gl, S.VS_MOTE, S.FS_MOTE, 'mote');

    this.shadow = GL.createShadowTarget(gl, 1024);
    this.lightVP = mat4.create();
    this.width = 1; this.height = 1;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.exposure = 1.0;
    this.flash = 0;
    this.bloomAmount = 0.75;

    this._tmpMat = mat4.create();
    this._normalMat = mat4.create();
    this.resize();
  }

  resize() {
    const gl = this.gl;
    const dpr = this.pixelRatio;
    const w = Math.max(2, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(2, Math.round(this.canvas.clientHeight * dpr));
    if (w === this.width && h === this.height) return;
    this.width = w; this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.hdr) {
      gl.deleteFramebuffer(this.hdr.fbo);
      gl.deleteTexture(this.hdr.color);
      gl.deleteRenderbuffer(this.hdr.depthBuf);
      for (const t of this.bloomTargets) {
        gl.deleteFramebuffer(t.fbo);
        gl.deleteTexture(t.color);
      }
    }
    this.hdr = GL.createRenderTarget(gl, w, h, { float: true, depth: true });
    const bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
    this.bloomTargets = [
      GL.createRenderTarget(gl, bw, bh, { float: true }),
      GL.createRenderTarget(gl, bw, bh, { float: true }),
    ];
  }

  updateLight(scene) {
    const gl = this.gl;
    const l = scene.light;
    const center = l.target;
    const dist = 2.2;
    const eye = vec3.create(
      center[0] + l.dir[0] * dist,
      center[1] + l.dir[1] * dist,
      center[2] + l.dir[2] * dist);
    const view = mat4.lookAt(mat4.create(), eye, center, [0, 1, 0]);
    const r = l.radius || 0.85;
    const proj = mat4.ortho(mat4.create(), -r, r, -r, r, 0.05, dist * 2.4);
    mat4.multiply(this.lightVP, proj, view);
  }

  renderShadow(scene) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadow.fbo);
    gl.viewport(0, 0, this.shadow.size, this.shadow.size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    GL.useProgram(gl, this.progDepth);
    GL.setUniforms(gl, this.progDepth, { uLightVP: this.lightVP });
    for (const n of scene.nodes) {
      if (n.visible === false || n.castShadow === false) continue;
      GL.setUniforms(gl, this.progDepth, { uModel: n.model });
      GL.drawMesh(gl, n.mesh);
    }
    gl.cullFace(gl.BACK);
    gl.disable(gl.CULL_FACE);
    for (const t of scene.transparent) {
      if (t.visible === false || t.castShadow === false) continue;
      GL.setUniforms(gl, this.progDepth, { uModel: t.model });
      GL.drawMesh(gl, t.mesh);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  render(scene, camera) {
    const gl = this.gl;
    this.resize();
    this.updateLight(scene);
    this.renderShadow(scene);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdr.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(scene.clearColor[0], scene.clearColor[1], scene.clearColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    const common = {
      uProj: camera.proj,
      uView: camera.view,
      uCameraPos: camera.position,
      uLightDir: scene.light.dir,
      uLightColor: scene.light.color,
      uLightVP: this.lightVP,
      uShadowMap: this.shadow.tex,
      uShadowTexel: [1 / this.shadow.size, 1 / this.shadow.size],
      uFogDensity: scene.fog.density,
      uFogColor: scene.fog.color,
      uTime: scene.time,
    };

    GL.useProgram(gl, this.progSurface);
    GL.setUniforms(gl, this.progSurface, common);
    for (const n of scene.nodes) {
      if (n.visible === false) continue;
      const m = n.mat;
      if (m.doubleSided) gl.disable(gl.CULL_FACE);
      mat4.normalMatrix(this._normalMat, n.model);
      GL.setUniforms(gl, this.progSurface, {
        uModel: n.model,
        uNormalMat: this._normalMat,
        uBaseColor: m.baseColor,
        uRoughness: m.roughness ?? 0.6,
        uMetalness: m.metalness ?? 0,
        uMatType: m.matType ?? 0,
        uWear: m.wear ?? 0.3,
        uEmissive: m.emissive ?? 0,
        uTranslucency: m.translucency ?? 0,
        uUnderGlow: m.underGlow ?? 0,
        uUnderRadius: m.underRadius ?? 0,
        uAlpha: 1,
      });
      GL.drawMesh(gl, n.mesh);
      if (m.doubleSided) gl.enable(gl.CULL_FACE);
    }

    // Airborne particulate before the leaf so the leaf can occlude it properly.
    if (scene.motes && scene.motes.intensity > 0.001) {
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      GL.useProgram(gl, this.progMote);
      GL.setUniforms(gl, this.progMote, {
        uProj: camera.proj,
        uView: camera.view,
        uTime: scene.time,
        uPointScale: 26 * this.pixelRatio * (this.height / 900),
        uColor: scene.motes.color,
        uIntensity: scene.motes.intensity,
        uAnimate: 1,
      });
      gl.bindVertexArray(scene.motes.vao);
      gl.drawArrays(gl.POINTS, 0, scene.motes.count);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }

    // Gold offcuts, drawn brighter and larger than room dust.
    if (scene.flakes && scene.flakes.intensity > 0.001) {
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      GL.useProgram(gl, this.progMote);
      GL.setUniforms(gl, this.progMote, {
        uProj: camera.proj,
        uView: camera.view,
        uTime: 0,
        uPointScale: 46 * this.pixelRatio * (this.height / 900),
        uColor: scene.flakes.color,
        uIntensity: Math.min(scene.flakes.intensity, 1.4),
        uAnimate: 0,
      });
      gl.bindVertexArray(scene.flakes.vao);
      gl.drawArrays(gl.POINTS, 0, scene.flakes.count);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }

    // The leaf: double sided, blended, drawn last among world geometry.
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    GL.useProgram(gl, this.progLeaf);
    GL.setUniforms(gl, this.progLeaf, common);
    for (const t of scene.transparent) {
      if (t.visible === false) continue;
      mat4.normalMatrix(this._normalMat, t.model);
      GL.setUniforms(gl, this.progLeaf, {
        uModel: t.model,
        uNormalMat: this._normalMat,
        ...t.uniforms,
      });
      GL.drawMesh(gl, t.mesh);
    }
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);

    // ---- post ----
    gl.disable(gl.DEPTH_TEST);
    const [b0, b1] = this.bloomTargets;
    gl.bindFramebuffer(gl.FRAMEBUFFER, b0.fbo);
    gl.viewport(0, 0, b0.width, b0.height);
    GL.useProgram(gl, this.progBright);
    GL.setUniforms(gl, this.progBright, { uTex: this.hdr.color, uThreshold: 0.85 });
    GL.drawFullscreenQuad(gl);

    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, b1.fbo);
      GL.useProgram(gl, this.progBlur);
      GL.setUniforms(gl, this.progBlur, { uTex: b0.color, uDir: [1 / b0.width, 0] });
      GL.drawFullscreenQuad(gl);
      gl.bindFramebuffer(gl.FRAMEBUFFER, b0.fbo);
      GL.setUniforms(gl, this.progBlur, { uTex: b1.color, uDir: [0, 1 / b0.height] });
      GL.drawFullscreenQuad(gl);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    GL.useProgram(gl, this.progComposite);
    GL.setUniforms(gl, this.progComposite, {
      uScene: this.hdr.color,
      uBloom: b0.color,
      uBloomAmount: this.bloomAmount,
      uExposure: this.exposure,
      uTime: scene.time,
      uFlash: this.flash,
      uResolution: [this.width, this.height],
    });
    GL.drawFullscreenQuad(gl);
    gl.enable(gl.DEPTH_TEST);
  }
}

export class Camera {
  constructor() {
    this.position = vec3.create(0, 0.42, 0.52);
    this.target = vec3.create(0, 0.02, 0);
    this.up = vec3.create(0, 1, 0);
    this.fov = 40 * Math.PI / 180;
    this.near = 0.02;
    this.far = 14;
    this.view = mat4.create();
    this.proj = mat4.create();
    this.viewProj = mat4.create();
    this.invViewProj = mat4.create();
  }
  update(aspect) {
    mat4.perspective(this.proj, this.fov, aspect, this.near, this.far);
    mat4.lookAt(this.view, this.position, this.target, this.up);
    mat4.multiply(this.viewProj, this.proj, this.view);
    mat4.invert(this.invViewProj, this.viewProj);
  }
  /** Screen NDC (-1..1) -> world ray. */
  ray(ndcX, ndcY) {
    const near = mat4.transformPoint(vec3.create(), this.invViewProj, [ndcX, ndcY, -1]);
    const far = mat4.transformPoint(vec3.create(), this.invViewProj, [ndcX, ndcY, 1]);
    const dir = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), far, near));
    return { origin: near, dir };
  }
  /** World point -> normalised device coords (-1..1). z > 1 means behind. */
  project(p) {
    const v = mat4.transformPoint(vec3.create(), this.viewProj, p);
    return v;
  }

  /** Intersect a ray with the horizontal plane y = planeY. */
  rayPlane(ndcX, ndcY, planeY) {
    const r = this.ray(ndcX, ndcY);
    const t = (planeY - r.origin[1]) / (r.dir[1] || 1e-6);
    if (t < 0) return null;
    return vec3.create(
      r.origin[0] + r.dir[0] * t,
      planeY,
      r.origin[2] + r.dir[2] * t);
  }
}
