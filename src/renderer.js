/* 描画パイプライン
   1. シャドウマップ
   2. 平面反射（1/2 解像度、外海用とドック用）
   3. 不透明シーン → fboScene（カラー + デプステクスチャ）
   4. fboScene を fboMain へ blit → 水面を描画（屈折/吸光/反射）
   5. パーティクル
   6. ブルーム + トーンマップ → 画面
*/
(function (root) {
  'use strict';
  var DD = (root.DD = root.DD || {});
  var m4 = DD.m4, U = DD.util, W = DD.W, G = DD.geom, SH = DD.SH;

  var MAT = {
    CONCRETE: 0, GENERIC: 1, HULL: 2
  };

  function Renderer(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;
    this.quality = 1.0;
    this.reflEnabled = true;
    this.dualRefl = true;
    this._frameTimes = [];
    this.init();
  }

  Renderer.prototype.init = function () {
    var gl = this.gl;
    var P = DD.gl.Program;

    this.progConcrete = new P(gl, SH.OBJ_VS, SH.objFS('#define MAT_CONCRETE\n'), 'concrete');
    this.progGen = new P(gl, SH.OBJ_VS, SH.objFS(''), 'generic');
    this.progHull = new P(gl, SH.OBJ_VS, SH.objFS('#define MAT_HULL\n'), 'hull');
    this.progShadow = new P(gl, SH.SHADOW_VS, SH.SHADOW_FS, 'shadow');
    this.progSky = new P(gl, SH.SKY_VS, SH.SKY_FS, 'sky');
    this.progReflSky = new P(gl, SH.SKY_VS, SH.REFLSKY_FS, 'reflsky');
    this.progWater = new P(gl, SH.WATER_VS, SH.WATER_FS, 'water');
    this.progPart = new P(gl, SH.PART_VS, SH.PART_FS, 'part');
    this.progHint = new P(gl, SH.HINT_VS, SH.HINT_FS, 'hint');
    this.progPaint = new P(gl, SH.PAINT_VS, SH.PAINT_FS, 'paint');
    this.progBright = new P(gl, SH.FS_VS, SH.BRIGHT_FS, 'bright');
    this.progBlur = new P(gl, SH.FS_VS, SH.BLUR_FS, 'blur');
    this.progPost = new P(gl, SH.FS_VS, SH.POST_FS, 'post');

    this.shadow = new DD.gl.ShadowMap(gl, 2048);

    // フルスクリーン三角形
    this.fsTri = makeSimple(gl, [-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    this.quad = makeSimple(gl, [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]);

    this.lightVP = m4.create();
    this.proj = m4.create();
    this.view = m4.create();
    this.viewProj = m4.create();
    this.invViewProj = m4.create();
    this.tmpM = m4.create();
    this.tmpN = new Float32Array(9);
    this.mirror = m4.create();

    this.sun = { dir: new Float32Array([-0.42, 0.600, 0.680]), color: [2.70, 2.48, 2.12] };
    var l = Math.hypot(this.sun.dir[0], this.sun.dir[1], this.sun.dir[2]);
    this.sun.dir[0] /= l; this.sun.dir[1] /= l; this.sun.dir[2] /= l;
    this.skyTop = [0.055, 0.155, 0.44];
    this.skyHorizon = [0.46, 0.60, 0.755];
    this.haze = [0.60, 0.685, 0.755];
    this.fogDensity = 0.00052;
    this.ambTop = [0.34, 0.435, 0.605];
    this.ambBottom = [0.275, 0.258, 0.222];
    this.exposure = 0.96;

    this.buildScene();
    this.buildWater();
    this.buildParticles();
    this.buildWashTarget();
  };

  function makeSimple(gl, pos) {
    var d = [];
    for (var i = 0; i < pos.length; i += 3) {
      d.push(pos[i], pos[i + 1], pos[i + 2], 0, 1, 0, 0, 0, 1, 1, 1);
    }
    return new DD.gl.Mesh(gl, new Float32Array(d), null);
  }

  /* ---------------- シーン構築 ---------------- */
  Renderer.prototype.buildScene = function () {
    var gl = this.gl;
    var MBc = DD.MB;

    function mk() { return new MBc(); }

    // 静的：コンクリート
    var mbC = mk();
    G.buildDockConcrete(mbC);
    G.buildDockDrains(mbC);
    this.mConcrete = mbC.mesh(gl);

    // 静的：金属
    var mbM = mk(), mbW = mk(), mbX = mk();
    G.buildBlocks(mbW, mbM);
    G.buildPumpHouse(mbM);
    G.buildQuayProps(mbM, mbX);
    this.mWood = mbW.mesh(gl);

    var mbG = mk();
    G.buildGantry(mbG);
    this.mGantry = mbG.mesh(gl);

    this.mMetal = mbM.mesh(gl);
    this.mMisc = mbX.mesh(gl);

    // 作業員（ドック底 + 岸壁）
    var wp = [];
    var seed = 3;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (var i = 0; i < 14; i++) {
      var side = rnd() > 0.5 ? 1 : -1;
      wp.push([-90 + rnd() * 190, 0, side * (16.0 + rnd() * 3.2), rnd() * 6.28]);
    }
    for (var j = 0; j < 8; j++) {
      wp.push([-100 + rnd() * 220, W.COPING_Y + 0.45, (rnd() > 0.5 ? 1 : -1) * (24 + rnd() * 8), rnd() * 6.28]);
    }
    var mbP = mk();
    G.buildWorkers(mbP, wp);
    this.mWorkers = mbP.mesh(gl);

    // 遠景
    var mbF = mk();
    G.buildFarScenery(mbF);
    this.mFar = mbF.mesh(gl);

    // 船
    var mbH = mk();
    mbH.color(1, 1, 1);
    G.buildHull(mbH, 104, 28);
    G.buildHullExtras(mbH);
    this.mHull = mbH.mesh(gl);
    this.hullTris = G.buildHullCollider();

    var mbSP = mk(), mbSM = mk();
    G.buildShipTop(mbSP, mbSM);
    this.mShipPaint = mbSP.mesh(gl);
    this.mShipMetal = mbSM.mesh(gl);

    var mbPr = mk();
    mbPr.color('#8a6b3c');
    G.buildPropeller(mbPr);
    this.mProp = mbPr.mesh(gl);

    var mbRd = mk();
    mbRd.color('#4a2a22');
    G.buildRudder(mbRd);
    this.mRudder = mbRd.mesh(gl);

    // ゲート
    var mbGt = mk();
    G.buildGate(mbGt);
    this.mGate = mbGt.mesh(gl);

    // レバー
    var mbLb = mk(); G.buildLeverBase(mbLb); this.mLeverBase = mbLb.mesh(gl);
    var mbLa = mk(); G.buildLeverArm(mbLa); this.mLeverArm = mbLa.mesh(gl);

    // タグボート
    var mbT = mk(); G.buildTug(mbT); this.mTug = mbT.mesh(gl);

    // 行列
    this.mdlIdent = m4.create();
    this.mdlShip = m4.create();
    this.mdlProp = m4.create();
    this.mdlRudder = m4.create();
    this.mdlGate = m4.create();
    this.mdlLeverBase = m4.create();
    this.mdlLeverArm = m4.create();
    this.mdlTug = m4.create();
  };

  Renderer.prototype.buildWater = function () {
    var gl = this.gl;
    // ドック内の水面
    this.mDockWater = gridMesh(gl, W.DOCK_X0, W.DOCK_X1, -W.DOCK_HW, W.DOCK_HW, 100, 26);
    // 外海：陸（X > SHORE_X）を避け、入口水路だけ内側へ食い込ませる
    var far = 2300;
    var d = [], idx = [];
    addGrid(d, idx, -far, W.SHORE_X, -far, far, 46, 60);
    addGrid(d, idx, W.SHORE_X, W.DOCK_X0, -W.CH_HW, W.CH_HW, 12, 10);
    this.mSea = new DD.gl.Mesh(gl, new Float32Array(d), idx);
  };

  function addGrid(d, idx, x0, x1, z0, z1, nx, nz) {
    var base = d.length / 11;
    for (var j = 0; j <= nz; j++) {
      for (var i = 0; i <= nx; i++) {
        var fx = i / nx, fz = j / nz;
        // 端に向かって粗く（中心付近を密に）
        var x = x0 + (x1 - x0) * fx;
        var z = z0 + (z1 - z0) * fz;
        d.push(x, 0, z, 0, 1, 0, fx, fz, 1, 1, 1);
      }
    }
    for (var j2 = 0; j2 < nz; j2++) for (var i2 = 0; i2 < nx; i2++) {
      var a = base + j2 * (nx + 1) + i2;
      idx.push(a, a + nx + 1, a + nx + 2, a, a + nx + 2, a + 1);
    }
  }
  function gridMesh(gl, x0, x1, z0, z1, nx, nz) {
    var d = [], idx = [];
    addGrid(d, idx, x0, x1, z0, z1, nx, nz);
    return new DD.gl.Mesh(gl, new Float32Array(d), idx);
  }

  Renderer.prototype.buildParticles = function () {
    var gl = this.gl;
    this.maxParticles = 1400;
    this.partData = new Float32Array(this.maxParticles * 11);
    this.partVAO = gl.createVertexArray();
    gl.bindVertexArray(this.partVAO);
    this.partVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partVBO);
    gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW);
    var s = 11 * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, s, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, s, 12);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, s, 32);
    gl.bindVertexArray(null);
  };

  Renderer.prototype.buildWashTarget = function () {
    var gl = this.gl;
    this.washFB = new DD.gl.Framebuffer(gl, 640, 256, { depth: false });
    this.clearWash();
  };
  Renderer.prototype.clearWash = function () {
    var gl = this.gl;
    this.washFB.bind();
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  /* 船体 UV 上に洗浄の跡を描き込む */
  Renderer.prototype.paintWash = function (u, v, radiusU, radiusV, strength) {
    var gl = this.gl;
    this.washFB.bind();
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.progPaint.use();
    this.progPaint.u2f('uCenter', u, v);
    this.progPaint.u1f('uRadius', radiusU * 2);
    this.progPaint.u1f('uAspect', radiusV / Math.max(radiusU, 1e-5));
    this.progPaint.u1f('uStrength', strength);
    this.quad.draw();
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  /* ---------------- リサイズ ---------------- */
  Renderer.prototype.resize = function (w, h, dpr) {
    var gl = this.gl;
    var maxPix = 2300000;
    var scale = dpr * this.quality;
    var pw = Math.round(w * scale), ph = Math.round(h * scale);
    if (pw * ph > maxPix) {
      var k = Math.sqrt(maxPix / (pw * ph));
      pw = Math.round(pw * k); ph = Math.round(ph * k);
    }
    pw = Math.max(64, pw); ph = Math.max(64, ph);
    if (this.rw === pw && this.rh === ph) return;
    this.rw = pw; this.rh = ph;
    this.canvas.width = pw; this.canvas.height = ph;
    if (this.fboScene) { this.fboScene.dispose(); this.fboMain.dispose(); this.fboRefl.dispose(); this.fboRefl2.dispose(); this.fboB1.dispose(); this.fboB2.dispose(); }
    this.fboScene = new DD.gl.Framebuffer(gl, pw, ph, { depthTexture: true, float: true });
    this.fboMain = new DD.gl.Framebuffer(gl, pw, ph, { float: true });
    var rw = Math.max(32, Math.round(pw * 0.5)), rh = Math.max(32, Math.round(ph * 0.5));
    this.fboRefl = new DD.gl.Framebuffer(gl, rw, rh, { float: true });
    this.fboRefl2 = new DD.gl.Framebuffer(gl, rw, rh, { float: true });
    var bw = Math.max(16, Math.round(pw * 0.25)), bh = Math.max(16, Math.round(ph * 0.25));
    this.fboB1 = new DD.gl.Framebuffer(gl, bw, bh, { depth: false, float: true });
    this.fboB2 = new DD.gl.Framebuffer(gl, bw, bh, { depth: false, float: true });
  };

  /* ---------------- 共通ユニフォーム ---------------- */
  Renderer.prototype.setGlobals = function (p, st) {
    p.umat4('uProj', this.proj);
    p.umat4('uView', this.view);
    p.umat4('uLightVP', this.lightVP);
    p.u3f('uCamPos', this.camPos[0], this.camPos[1], this.camPos[2]);
    p.u3fv('uSunDir', this.sun.dir);
    p.u3f('uSunColor', this.sun.color[0], this.sun.color[1], this.sun.color[2]);
    p.u3f('uSkyTop', this.skyTop[0], this.skyTop[1], this.skyTop[2]);
    p.u3f('uSkyHorizon', this.skyHorizon[0], this.skyHorizon[1], this.skyHorizon[2]);
    p.u3f('uHaze', this.haze[0], this.haze[1], this.haze[2]);
    p.u1f('uFogDensity', this.fogDensity);
    p.u3f('uAmbTop', this.ambTop[0], this.ambTop[1], this.ambTop[2]);
    p.u3f('uAmbBottom', this.ambBottom[0], this.ambBottom[1], this.ambBottom[2]);
    p.u1f('uTime', st.time);
    p.u1f('uWaterY', st.waterLevel);
    p.u1f('uWetY', st.wetLevel);
    p.u1f('uWetAmt', st.wetAmount);
    p.u1f('uWetLen', st.wetLen);
    p.u3f('uRegion', W.GATE_X, W.DOCK_HW, W.SEA_Y);
    p.u1f('uShadowStrength', this.shadowStrength);
    p.u2f('uShadowTexel', 1 / this.shadow.size, 1 / this.shadow.size);
    p.tex('uShadowMap', 5, this.shadow.depth);
  };

  Renderer.prototype.drawObj = function (p, mesh, model, opt) {
    var gl = this.gl;
    p.umat4('uModel', model);
    m4.normalMatrix(this.tmpN, model);
    p.umat3('uNrmMat', this.tmpN);
    p.u1f('uRough', opt.rough === undefined ? 0.7 : opt.rough);
    p.u1f('uMetal', opt.metal === undefined ? 0.0 : opt.metal);
    p.u1f('uAO', opt.ao === undefined ? 1.0 : opt.ao);
    p.u1f('uDetail', opt.detail === undefined ? 1.0 : opt.detail);
    var t = opt.tint || [1, 1, 1];
    p.u3f('uTint', t[0], t[1], t[2]);
    mesh.draw();
  };

  /* 各パスで描く物体のリスト */
  Renderer.prototype.forEachObject = function (st, cb) {
    // cb(prog, mesh, model, opts)
    cb('gen', this.mFar, this.mdlIdent, { rough: 0.92, metal: 0.0, ao: 1.0, detail: 0.0 });
    cb('concrete', this.mConcrete, this.mdlIdent, { rough: 0.85, metal: 0.0, ao: 0.92 });
    cb('gen', this.mMetal, this.mdlIdent, { rough: 0.48, metal: 0.72, ao: 0.85 });
    cb('gen', this.mWood, this.mdlIdent, { rough: 0.88, metal: 0.0, ao: 0.75, noRefl: true });
    cb('gen', this.mMisc, this.mdlIdent, { rough: 0.78, metal: 0.15, ao: 0.8, noRefl: true });
    cb('gen', this.mGantry, this.mdlIdent, { rough: 0.55, metal: 0.6, ao: 0.9 });
    cb('gen', this.mWorkers, this.mdlIdent, { rough: 0.85, metal: 0.0, ao: 0.85, noRefl: true });
    cb('gen', this.mGate, this.mdlGate, { rough: 0.5, metal: 0.7, ao: 0.85 });
    cb('hull', this.mHull, this.mdlShip, { rough: 0.55, metal: 0.15, ao: 0.95 });
    cb('gen', this.mShipPaint, this.mdlShip, { rough: 0.52, metal: 0.12, ao: 0.9 });
    cb('gen', this.mShipMetal, this.mdlShip, { rough: 0.45, metal: 0.75, ao: 0.85 });
    cb('gen', this.mProp, this.mdlProp, { rough: 0.32, metal: 0.9, ao: 0.9, tint: st.propTint || [1, 1, 1] });
    cb('gen', this.mRudder, this.mdlRudder, { rough: 0.6, metal: 0.25, ao: 0.9 });
    cb('gen', this.mLeverBase, this.mdlLeverBase, { rough: 0.55, metal: 0.4, ao: 0.9, noRefl: true });
    cb('gen', this.mLeverArm, this.mdlLeverArm, { rough: 0.4, metal: 0.5, ao: 0.9, noRefl: true });
    if (st.tugVisible) cb('gen', this.mTug, this.mdlTug, { rough: 0.55, metal: 0.25, ao: 0.9 });
  };

  /* ---------------- シャドウ ---------------- */
  Renderer.prototype.renderShadow = function (st) {
    var gl = this.gl;
    // ライト空間の直交投影をドック全体に合わせる
    var cx = 0, cy = 8, cz = 0, R = 190;
    var d = this.sun.dir;
    var eye = [cx + d[0] * 320, cy + d[1] * 320, cz + d[2] * 320];
    var v = m4.create();
    m4.lookAt(v, eye, [cx, cy, cz], [0, 1, 0]);
    var p = m4.create();
    m4.ortho(p, -R, R, -R * 0.75, R * 0.75, 10, 660);
    m4.mul(this.lightVP, p, v);

    this.shadow.bind();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    var pr = this.progShadow.use();
    pr.umat4('uLightVP', this.lightVP);
    var self = this;
    this.forEachObject(st, function (kind, mesh, model, opt) {
      if (mesh === self.mFar) return;
      pr.umat4('uModel', model);
      mesh.draw();
    });
    gl.cullFace(gl.BACK);
  };

  /* ---------------- 不透明シーン ---------------- */
  Renderer.prototype.renderOpaque = function (st, clipY, clipSign, drawSky, reflSky) {
    var skipSmall = !!reflSky;
    var gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);

    var self = this;
    var progs = { concrete: this.progConcrete, gen: this.progGen, hull: this.progHull };
    var cur = null;
    var order = ['concrete', 'gen', 'hull'];
    for (var oi = 0; oi < order.length; oi++) {
      var kind = order[oi];
      var p = progs[kind];
      var used = false;
      this.forEachObject(st, function (k, mesh, model, opt) {
        if (k !== kind) return;
        if (skipSmall && opt.noRefl) return;
        if (!used) {
          p.use();
          self.setGlobals(p, st);
          p.u1f('uClipY', clipY);
          p.u1f('uClipSign', clipSign);
          if (kind === 'hull') {
            p.tex('uWashTex', 6, self.washFB.color);
            p.u1f('uDraft', W.SHIP_DRAFT);
          }
          used = true;
        }
        self.drawObj(p, mesh, model, opt);
      });
    }
    if (drawSky) {
      gl.depthFunc(gl.LEQUAL);
      var sp = (reflSky ? this.progReflSky : this.progSky).use();
      if (!reflSky) {
        sp.umat4('uInvViewProj', this.invViewProj);
        sp.u3fv('uSunDir', this.sun.dir);
        sp.u3f('uSunColor', this.sun.color[0], this.sun.color[1], this.sun.color[2]);
        sp.u3f('uSkyTop', this.skyTop[0], this.skyTop[1], this.skyTop[2]);
        sp.u3f('uSkyHorizon', this.skyHorizon[0], this.skyHorizon[1], this.skyHorizon[2]);
        sp.u3f('uHaze', this.haze[0], this.haze[1], this.haze[2]);
        sp.u1f('uFogDensity', this.fogDensity);
        sp.u1f('uTime', st.time);
        sp.u3f('uCamPos', this.camPos[0], this.camPos[1], this.camPos[2]);
      }
      gl.disable(gl.CULL_FACE);
      this.fsTri.draw();
      gl.enable(gl.CULL_FACE);
    }
  };

  /* ---------------- 反射パス ---------------- */
  Renderer.prototype.renderReflection = function (st, level, fbo) {
    var gl = this.gl;
    var savedView = new Float32Array(this.view);
    var savedIVP = new Float32Array(this.invViewProj);
    var savedCam = this.camPos.slice ? this.camPos.slice() : [this.camPos[0], this.camPos[1], this.camPos[2]];
    m4.mirrorY(this.mirror, level);
    m4.mul(this.view, savedView, this.mirror);
    m4.mul(this.viewProj, this.proj, this.view);
    m4.invert(this.invViewProj, this.viewProj);

    fbo.bind();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.cullFace(gl.FRONT);
    this.renderOpaque(st, level, 1.0, true, true);
    gl.cullFace(gl.BACK);

    this.view.set(savedView);
    this.invViewProj.set(savedIVP);
    m4.mul(this.viewProj, this.proj, this.view);
  };

  /* ---------------- 水面 ---------------- */
  Renderer.prototype.renderWater = function (st) {
    var gl = this.gl;
    var p = this.progWater.use();
    this.setGlobals(p, st);
    p.umat4('uInvViewProj', this.invViewProj);
    p.u2f('uResolution', this.rw, this.rh);
    p.u1f('uNear', this.near);
    p.u1f('uFar', this.far);
    p.tex('uSceneColor', 0, this.fboScene.color);
    p.tex('uSceneDepth', 1, this.fboScene.depth);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.CULL_FACE);

    var vx = new Float32Array(16);
    for (var i = 0; i < 4; i++) {
      var v = st.vortices[i];
      if (v) { vx[i * 4] = v.x; vx[i * 4 + 1] = v.z; vx[i * 4 + 2] = 0; vx[i * 4 + 3] = v.w; }
    }

    // --- 外海 ---
    if (this.camPos[1] > W.SEA_Y - 0.2) {
      p.u1f('uLevel', W.SEA_Y);
      p.u1f('uAmp', 1.0);
      p.u1f('uPuddle', 0.0);
      p.u1f('uFoamBoost', 0.0);
      p.u3f('uAbsorb', 0.115, 0.048, 0.036);
      p.u3f('uScatter', 0.055, 0.135, 0.145);
      var zero = new Float32Array(16);
      gl.uniform4fv(p.loc['uVortex'], zero);
      if (this.reflEnabled) {
        p.tex('uReflTex', 2, (this.seaReflFbo || this.fboRefl).color);
        p.u1f('uHasRefl', 1.0);
      } else p.u1f('uHasRefl', 0.0);
      this.mSea.draw();
    }

    // --- ドック内 ---
    if (st.waterLevel > 0.02) {
      p.u1f('uLevel', st.waterLevel);
      p.u1f('uAmp', st.dockChop);
      p.u1f('uPuddle', st.puddle);
      p.u1f('uFoamBoost', st.foamBoost);
      p.u3f('uAbsorb', 0.175, 0.098, 0.088);
      p.u3f('uScatter', 0.075, 0.115, 0.098);
      gl.uniform4fv(p.loc['uVortex'], vx);
      if (this.reflEnabled) {
        p.tex('uReflTex', 2, (this.dockReflFbo || this.fboRefl).color);
        p.u1f('uHasRefl', 1.0);
      } else p.u1f('uHasRefl', 0.0);
      this.mDockWater.draw();
    }
    gl.enable(gl.CULL_FACE);
  };

  /* ---------------- パーティクル ---------------- */
  Renderer.prototype.renderParticles = function (st, sys) {
    if (!sys || sys.count === 0) return;
    var gl = this.gl;
    gl.bindVertexArray(this.partVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sys.data, 0, sys.count * 11);
    var p = this.progPart.use();
    p.umat4('uProj', this.proj);
    p.umat4('uView', this.view);
    p.u1f('uPixScale', this.rh * 0.9);
    p.u3f('uCamPos', this.camPos[0], this.camPos[1], this.camPos[2]);
    p.u3fv('uSunDir', this.sun.dir);
    p.u3f('uSunColor', this.sun.color[0], this.sun.color[1], this.sun.color[2]);
    p.u3f('uSkyTop', this.skyTop[0], this.skyTop[1], this.skyTop[2]);
    p.u3f('uSkyHorizon', this.skyHorizon[0], this.skyHorizon[1], this.skyHorizon[2]);
    p.u3f('uHaze', this.haze[0], this.haze[1], this.haze[2]);
    p.u1f('uFogDensity', this.fogDensity);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.drawArrays(gl.POINTS, 0, sys.count);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  };

  /* ---------------- ヒント ---------------- */
  Renderer.prototype.renderHint = function (st) {
    var h = st.hint;
    if (!h || h.opacity <= 0.01) return;
    var gl = this.gl;
    var p = this.progHint.use();
    p.umat4('uProj', this.proj);
    p.umat4('uView', this.view);
    p.u3f('uCenter', h.x, h.y, h.z);
    p.u1f('uSize', h.size);
    p.u1f('uTime', st.time);
    p.u1f('uKind', h.kind);
    p.u1f('uOpacity', h.opacity);
    p.u3f('uColor', 1.6, 1.5, 0.7);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    this.quad.draw();
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  };

  /* ---------------- メイン ---------------- */
  Renderer.prototype.render = function (st, cam, particles) {
    var gl = this.gl;
    this.camPos = cam.eye;
    this.near = 1.2; this.far = 3200;
    m4.perspective(this.proj, cam.fov, this.rw / this.rh, this.near, this.far);
    m4.lookAt(this.view, cam.eye, cam.target, [0, 1, 0]);
    m4.mul(this.viewProj, this.proj, this.view);
    m4.invert(this.invViewProj, this.viewProj);
    this.shadowStrength = 0.86;

    // 動的オブジェクトの行列
    m4.trs(this.mdlShip, st.shipX, st.shipY, 0, st.shipPitch || 0, 0, st.shipRoll || 0, 1);
    var pm = m4.create();
    m4.trs(pm, W.PROP_X, W.PROP_Y, 0, st.propAngle, 0, 0, 1);
    m4.mul(this.mdlProp, this.mdlShip, pm);
    var rm = m4.create();
    m4.trs(rm, W.RUDDER_X, W.RUDDER_Y, 0, 0, st.rudderAngle, 0, 1);
    m4.mul(this.mdlRudder, this.mdlShip, rm);
    m4.trs(this.mdlGate, W.GATE_X, W.SILL_Y + 0.05, 0, 0, 0, st.gateAngle, 1);
    m4.trs(this.mdlLeverBase, st.lever.x, st.lever.y, st.lever.z, 0, st.lever.yaw, 0, 1);
    m4.trs(this.mdlLeverArm, st.lever.x, st.lever.y + 1.15, st.lever.z, st.leverTilt, st.lever.yaw, 0, 1);
    m4.trs(this.mdlTug, st.tugX, W.SEA_Y - 2.6, st.tugZ, 0, st.tugYaw || 0, 0, 1);

    // 1. シャドウ
    this.renderShadow(st);

    // 2. 反射
    this.seaReflFbo = null; this.dockReflFbo = null;
    if (this.reflEnabled) {
      var sameLevel = Math.abs(st.waterLevel - W.SEA_Y) < 0.3 || st.waterLevel < 0.05;
      this.renderReflection(st, W.SEA_Y, this.fboRefl);
      this.seaReflFbo = this.fboRefl;
      if (sameLevel || !this.dualRefl) {
        this.dockReflFbo = this.fboRefl;
      } else {
        this.renderReflection(st, st.waterLevel, this.fboRefl2);
        this.dockReflFbo = this.fboRefl2;
      }
    }

    // 3. 不透明シーン
    this.fboScene.bind();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.renderOpaque(st, 0, 0, true, false);

    // 4. blit → 水面
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fboScene.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fboMain.fbo);
    gl.blitFramebuffer(0, 0, this.rw, this.rh, 0, 0, this.rw, this.rh,
      gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    this.fboMain.bind();
    this.renderWater(st);

    // 5. パーティクルとヒント
    this.renderParticles(st, particles);
    this.renderHint(st);

    // 6. ブルーム
    gl.disable(gl.DEPTH_TEST);
    this.fboB1.bind();
    var b = this.progBright.use();
    b.tex('uTex', 0, this.fboMain.color);
    b.u1f('uThreshold', 1.05);
    this.fsTri.draw();
    var bl = this.progBlur.use();
    this.fboB2.bind();
    bl.tex('uTex', 0, this.fboB1.color);
    bl.u2f('uDir', 1.0 / this.fboB1.w, 0);
    this.fsTri.draw();
    this.fboB1.bind();
    bl.tex('uTex', 0, this.fboB2.color);
    bl.u2f('uDir', 0, 1.0 / this.fboB1.h);
    this.fsTri.draw();

    // 7. ポスト
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.rw, this.rh);
    var po = this.progPost.use();
    po.tex('uTex', 0, this.fboMain.color);
    po.tex('uBloom', 1, this.fboB1.color);
    po.u1f('uBloomAmt', 0.55);
    po.u1f('uExposure', this.exposure);
    po.u1f('uVignette', 0.38);
    po.u1f('uFade', st.fade === undefined ? 1 : st.fade);
    this.fsTri.draw();
    gl.enable(gl.DEPTH_TEST);
  };

  /* 性能に応じた品質調整 */
  Renderer.prototype.adapt = function (dt) {
    this._frameTimes.push(dt);
    if (this._frameTimes.length < 60) return false;
    var sum = 0;
    for (var i = 0; i < this._frameTimes.length; i++) sum += this._frameTimes[i];
    var avg = sum / this._frameTimes.length;
    this._frameTimes.length = 0;
    var changed = false;
    if (avg > 0.030) {
      if (this.dualRefl) { this.dualRefl = false; changed = true; }
      else if (this.quality > 0.62) { this.quality = Math.max(0.62, this.quality - 0.15); changed = true; }
      else if (this.reflEnabled) { this.reflEnabled = false; changed = true; }
    } else if (avg < 0.0165) {
      if (!this.reflEnabled) { this.reflEnabled = true; changed = true; }
      else if (this.quality < 1.0) { this.quality = Math.min(1.0, this.quality + 0.1); changed = true; }
      else if (!this.dualRefl) { this.dualRefl = true; changed = true; }
    }
    return changed;
  };

  DD.Renderer = Renderer;
  DD.MATKIND = MAT;
})(typeof window !== 'undefined' ? window : this);
