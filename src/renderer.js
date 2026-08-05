// ---------------------------------------------------------------------------
// レンダラ: 透過光マップ -> シーン -> ブルーム -> 合成
// ---------------------------------------------------------------------------
'use strict';

const LM_SIZE = 512;
const DIRT_SIZE = 256;

class Renderer {
  constructor(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;
    this.prog = {
      std: new Program(gl, GLSL.stdVS, GLSL.stdFS, 'std'),
      glass: new Program(gl, GLSL.stdVS, GLSL.glassFS, 'glass'),
      clear: new Program(gl, GLSL.stdVS, GLSL.clearGlassFS, 'clear'),
      lm: new Program(gl, GLSL.stdVS, GLSL.lightmapFS, 'lm'),
      sky: new Program(gl, GLSL.skyVS, GLSL.skyFS, 'sky'),
      shaft: new Program(gl, GLSL.stdVS, GLSL.shaftFS, 'shaft'),
      dust: new Program(gl, GLSL.dustVS, GLSL.dustFS, 'dust'),
      flat: new Program(gl, GLSL.stdVS, GLSL.flatFS, 'flat'),
      sprite: new Program(gl, GLSL.spriteVS, GLSL.flatFS, 'sprite'),
      shadow: new Program(gl, GLSL.stdVS, GLSL.shadowFS, 'shadow'),
      bright: new Program(gl, GLSL.postVS, GLSL.brightFS, 'bright'),
      blur: new Program(gl, GLSL.postVS, GLSL.blurFS, 'blur'),
      comp: new Program(gl, GLSL.postVS, GLSL.compFS, 'comp'),
      brush: new Program(gl, GLSL.brushVS, GLSL.brushFS, 'brush'),
    };
    this.quad = makeQuad(gl);
    this.lm = new FBO(gl, LM_SIZE, LM_SIZE, { depth: true });
    this.dirt = new FBO(gl, DIRT_SIZE, DIRT_SIZE, { depth: false });
    this.scene = new FBO(gl, 64, 64, { depth: true });
    this.bloomA = new FBO(gl, 32, 32, { depth: false });
    this.bloomB = new FBO(gl, 32, 32, { depth: false });
    this.view = M4.c(); this.proj = M4.c(); this.viewProj = M4.c();
    this.invViewProj = M4.c();
    this.lightView = M4.c(); this.lightProj = M4.c(); this.lightVP = M4.c();
    this.tmp = M4.c();
    this.w = 64; this.h = 64;
    this.clearDirt(1);
  }

  setSize(w, h) {
    w = Math.max(16, Math.floor(w)); h = Math.max(16, Math.floor(h));
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.scene.resize(w, h);
    this.bloomA.resize(Math.max(8, w >> 2), Math.max(8, h >> 2));
    this.bloomB.resize(Math.max(8, w >> 2), Math.max(8, h >> 2));
  }

  // --- 汚れマスク (磨き) ---------------------------------------------------
  clearDirt(v) {
    const gl = this.gl;
    this.dirt.bind();
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(v, v, v, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // uv: 0..1 パネル座標, r: 0..1 半径
  paintDirt(u, v, r, strength) {
    const gl = this.gl;
    this.dirt.bind();
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const p = this.prog.brush.use();
    p.v2('uCenter', u, v);
    p.f('uRadius', r);
    p.f('uStrength', strength);
    this.quad.draw();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // --- 光源行列 ------------------------------------------------------------
  updateLightMatrix(sunDir) {
    const c = WIN.center;
    const eye = [c[0] - sunDir[0] * 8, c[1] - sunDir[1] * 8, c[2] - sunDir[2] * 8];
    const up = Math.abs(sunDir[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0];
    M4.lookAt(this.lightView, eye, c, up);
    // 窓の外形 + 雨戸の可動範囲を包む範囲を光源空間で求める
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    const p = V3.c();
    for (let i = 0; i < 8; i++) {
      const x = (i & 1) ? 0.80 : -0.80;
      const y = (i & 2) ? WIN.top + 0.10 : WIN.y0 - 0.10;
      const z = (i & 4) ? ROOM.wallOut - 0.10 : ROOM.wallZ + 0.05;
      M4.transformPoint(p, this.lightView, [x, y, z]);
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    const m = 0.06;
    M4.ortho(this.lightProj, minX - m, maxX + m, minY - m, maxY + m, 0.5, 14.0);
    M4.mul(this.lightVP, this.lightProj, this.lightView);
  }

  renderLightMap(g) {
    const gl = this.gl;
    this.lm.bind();
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    const p = this.prog.lm.use();
    p.m4('uViewProj', this.lightVP);
    p.tex('uDirt', 1, this.dirt.tex);

    // RGB: 窓を透過する光の色
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.colorMask(true, true, true, false);
    for (const o of g.world.objects) {
      if (o.lm !== 'clear' || !o.visible) continue;
      p.m4('uModel', o.model).v3('uColor', [0.50, 0.57, 0.70]).f('uIsGlass', 0).f('uDirtAmt', 0);
      o.mesh.draw();
    }
    if (g.panelInstalled && g.panelCells) {
      p.f('uIsGlass', 1).f('uDirtAmt', g.dirtAmt);
      for (const c of g.panelCells) {
        const col = c.color || [0.8, 0.82, 0.85];
        p.m4('uModel', c.model).v3('uColor', [col[0] * 1.45, col[1] * 1.45, col[2] * 1.45]);
        c.glassMesh.draw();
      }
      // ケイムは光を通さない
      p.f('uIsGlass', 0).v3('uColor', [0, 0, 0]);
      for (const c of g.panelCells) {
        p.m4('uModel', c.model);
        c.cameMesh.draw(c.join);
      }
    }

    // A: 不透明遮蔽物の深度
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.colorMask(false, false, false, true);
    p.f('uIsGlass', 0).v3('uColor', [0, 0, 0]);
    for (const o of g.world.objects) {
      if (o.lm !== 'blocker' || !o.visible) continue;
      p.m4('uModel', o.model);
      o.mesh.draw();
    }
    gl.colorMask(true, true, true, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  clearLightMap() {
    const gl = this.gl;
    this.lm.bind();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  setCommon(p, g) {
    const e = g.env;
    p.m4('uViewProj', this.viewProj)
      .v3('uCam', g.cam.pos)
      .v3('uSunDir', e.sunDir)
      .v3('uSunCol', e.sunCol)
      .m4('uLightVP', this.lightVP)
      .f('uLightTexel', 1.0 / LM_SIZE)
      .v3('uAmbTop', e.ambTop)
      .v3('uAmbBot', e.ambBot)
      .v3('uLampPos', e.lampPos)
      .v3('uLampCol', e.lampCol)
      .f('uLampRange', e.lampRange)
      .v3('uFogCol', e.fogCol)
      .f('uFogDensity', e.fogDensity)
      .f('uBloomThresh', e.bloomThresh)
      .v3('uBounce', e.bounce)
      .f('uTime', g.time);
    p.tex('uLightMap', 0, this.lm.tex);
    return p;
  }

  drawStd(p, o) {
    const m = o.mat;
    p.m4('uModel', o.model).m3('uNrm', o.nrm)
      .v3('uAlbedo', m.albedo).f('uRough', m.rough).f('uMetal', m.metal)
      .f('uMat', m.type).f('uWear', m.wear).v3('uEmissive', m.emissive)
      .f('uAO', m.ao).f('uFogAmount', m.fog).f('uSunMode', m.sunMode);
    o.mesh.draw();
  }

  render(g) {
    const gl = this.gl;
    const e = g.env;
    const aspect = this.w / this.h;
    // 行列はゲーム側で計算済み (レイキャストと共用)
    M4.copy(this.view, g.view);
    M4.copy(this.viewProj, g.viewProj);
    M4.copy(this.invViewProj, g.invViewProj);
    this.updateLightMatrix(e.sunDir);

    if (e.sunAmount > 0.0015) this.renderLightMap(g);
    else this.clearLightMap();

    // --- シーン ------------------------------------------------------------
    this.scene.bind();
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // 空 (窓から見える部分だけ残る)
    {
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      const p = this.prog.sky.use();
      p.m4('uInvViewProj', this.invViewProj).v3('uCam', g.cam.pos)
        .v3('uSunDir', e.sunDir).v3('uSunCol', e.sunCol)
        .v3('uSkyTop', e.skyTop).v3('uSkyHorizon', e.skyHorizon)
        .f('uStars', e.stars).f('uBloomThresh', e.bloomThresh);
      this.quad.draw();
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
    }

    // 不透明
    {
      const p = this.setCommon(this.prog.std.use(), g);
      for (const o of g.world.objects) {
        if (!o.visible || o.pass !== 'opaque') continue;
        this.drawStd(p, o);
      }
      // ケイム (継ぎ目の金属)
      if (g.panelCells) {
        for (const c of g.panelCells) {
          if (c.join <= 0.001) continue;
          p.m4('uModel', c.model).m3('uNrm', c.nrm)
            .v3('uAlbedo', CAME_ALBEDO).f('uRough', 0.42).f('uMetal', 0.85)
            .f('uMat', 3).f('uWear', 0.9).v3('uEmissive', [0, 0, 0])
            .f('uAO', 1).f('uFogAmount', 0.04).f('uSunMode', 0);
          c.cameMesh.draw(c.join);
        }
      }
      // モチーフ選択カードの台紙
      for (const card of g.cards) {
        if (card.alpha <= 0.01) continue;
        this.drawStd(p, card.plate);
      }
    }

    // ステンドグラス (不透明扱い。アルファはブルーム重み)
    {
      const p = this.prog.glass.use();
      p.v3('uCam', g.cam.pos).v3('uSunDir', e.sunDir).v3('uSunCol', e.sunCol)
        .v3('uAmbTop', e.ambTop).v3('uAmbBot', e.ambBot)
        .v3('uLampPos', e.lampPos).v3('uLampCol', e.lampCol)
        .f('uBloomThresh', e.bloomThresh).f('uTime', g.time)
        .m4('uViewProj', this.viewProj)
        .f('uDirtAmt', g.dirtAmt);
      p.tex('uDirt', 1, this.dirt.tex);
      for (const c of (g.panelCells || [])) {
        p.m4('uModel', c.model).m3('uNrm', c.nrm)
          .v3('uBase', c.color || [0.78, 0.82, 0.84])
          .f('uFill', c.fill).f('uBacklight', c.backlight || 0)
          .f('uHighlight', c.highlight || 0).f('uSeed', c.seed);
        c.glassMesh.draw();
      }
      // 選択カードのモチーフ片
      for (const card of g.cards) {
        if (card.alpha <= 0.01) continue;
        for (const part of card.parts) {
          p.m4('uModel', part.model).m3('uNrm', part.nrm)
            .v3('uBase', part.color).f('uFill', 1).f('uBacklight', card.glow)
            .f('uHighlight', card.highlight).f('uSeed', part.seed);
          part.mesh.draw();
        }
      }
    }

    // 接地影 (乗算)
    {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.DST_COLOR, gl.ZERO);
      gl.depthMask(false);
      const p = this.prog.shadow.use();
      p.m4('uViewProj', this.viewProj);
      for (const o of g.world.objects) {
        if (!o.visible || o.pass !== 'shadow') continue;
        p.m4('uModel', o.model).f('uStrength', o.strength * (1 - g.env.sunAmount * 0.35));
        o.mesh.draw();
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // 透明ガラス (遠景が透ける)
    {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      const p = this.prog.clear.use();
      p.m4('uViewProj', this.viewProj).v3('uCam', g.cam.pos)
        .v3('uSunCol', e.sunCol).v3('uSunDir', e.sunDir).f('uOpacity', 0.16);
      for (const o of g.world.objects) {
        if (!o.visible || o.pass !== 'clear') continue;
        p.m4('uModel', o.model).m3('uNrm', o.nrm);
        o.mesh.draw();
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // 加算パス: 光の柱 / ほこり / けがき線 / ヒント
    {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);

      if (g.shaftMesh && g.shaftStrength > 0.002) {
        const p = this.prog.shaft.use();
        p.m4('uViewProj', this.viewProj).m4('uModel', IDENT).m3('uNrm', IDENT3)
          .v3('uCam', g.cam.pos).m4('uLightVP', this.lightVP)
          .v3('uSunCol', e.sunCol).v3('uOrigin', WIN.center)
          .f('uStrength', g.shaftStrength).f('uTime', g.time);
        p.tex('uLightMap', 0, this.lm.tex);
        g.shaftMesh.draw();
      }

      if (g.dust && g.shaftStrength > 0.002) {
        const p = this.prog.dust.use();
        p.m4('uViewProj', this.viewProj).v3('uCam', g.cam.pos)
          .f('uTime', g.time).f('uPix', this.h * 0.010)
          .m4('uLightVP', this.lightVP).v3('uSunCol', e.sunCol)
          .f('uStrength', g.shaftStrength * 0.10);
        p.tex('uLightMap', 0, this.lm.tex);
        g.dust.draw();
      }

      // けがき線 (きる工程)
      if (g.panelCells && g.scoreAlpha > 0.01) {
        const p = this.prog.flat.use();
        p.m4('uViewProj', this.viewProj).f('uRing', 0).f('uTime', g.time);
        for (const c of g.panelCells) {
          p.m4('uModel', c.model).m3('uNrm', c.nrm);
          p.v3('uColor', [0.42, 0.56, 0.66]).f('uAlpha', 0.45 * g.scoreAlpha);
          c.scoreMesh.draw();
          if (c.cut > 0.001) {
            p.v3('uColor', [1.0, 0.98, 0.90]).f('uAlpha', 1.0 * g.scoreAlpha);
            c.scoreMesh.draw(c.cut);
          }
        }
      }

      // スプライト (ヒント・きらめき)
      if (g.sprites.length) {
        const p = this.prog.sprite.use();
        p.m4('uViewProj', this.viewProj).f('uTime', g.time);
        const right = [this.view[0], this.view[4], this.view[8]];
        const up = [this.view[1], this.view[5], this.view[9]];
        p.v3('uRight', right).v3('uUp', up);
        for (const s of g.sprites) {
          p.v3('uCenter', s.pos).f('uSize', s.size).v3('uColor', s.color)
            .f('uAlpha', s.alpha).f('uRing', s.ring ? 1 : 0);
          this.quad.draw();
        }
      }

      gl.enable(gl.CULL_FACE);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // --- ブルーム ----------------------------------------------------------
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    this.bloomA.bind();
    this.prog.bright.use().tex('uTex', 0, this.scene.tex);
    this.quad.draw();
    const bw = this.bloomA.w, bh = this.bloomA.h;
    this.bloomB.bind();
    this.prog.blur.use().tex('uTex', 0, this.bloomA.tex).v2('uDir', 1 / bw, 0);
    this.quad.draw();
    this.bloomA.bind();
    this.prog.blur.use().tex('uTex', 0, this.bloomB.tex).v2('uDir', 0, 1 / bh);
    this.quad.draw();

    // --- 合成 --------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    const p = this.prog.comp.use();
    p.tex('uScene', 0, this.scene.tex).tex('uBloom', 1, this.bloomA.tex)
      .f('uBloomAmt', e.bloom).f('uVignette', e.vignette)
      .f('uTime', g.time).f('uFade', g.fade)
      .v2('uAspect', aspect > 1 ? 1 : aspect, aspect > 1 ? 1 / aspect : 1);
    this.quad.draw();
  }
}

const IDENT = M4.c();
const IDENT3 = M3.c();
const CAME_ALBEDO = MathX.toLinear(MathX.hexToRgb('#4b5157'));
