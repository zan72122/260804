/* =========================================================================
   stage_extract.js — ④遠心採蜜（看板操作）
   ハンドルを指でぐるぐる回すと，中の巣枠が回る。
   蜜は 巣房 → 空中 → 内壁 → 流れ落ちる → 底にたまる，と連続してつながる。
   内壁の蜜は GPU 上の流体シミュレーション（移流テクスチャ）で表現している。
   ========================================================================= */
(function (global) {
  'use strict';

  var E = null;   // P.EXTRACTOR
  var S = {
    ex: null, rotor: null, crank: null, pockets: [],
    frames: [], inserted: 0,
    phase: 'insert',            // insert → spin → done
    omega: 0, crankAng: 0, rotorAng: 0, gear: 3.2,
    fingerW: 0, circle: null, wasDown: false, accum: 0,
    honey: 0, drops: null, sim: null, film: null,
    pool: null, poolTop: null, blur: null,
    anim: null, centerScreen: { x: 0, y: 0 },
    tmp: new THREE.Vector3(), doneT: 0, spinTime: 0
  };

  var MAXW = 12.0;         // クランクの最大角速度(rad/s)
  var FILL_TIME = 11.0;    // 全速で回し続けたときに満タンになる秒数

  global.Stages = global.Stages || {};

  /* =======================================================================
     内壁の蜜：GPU 移流シミュレーション
     R チャンネルに蜜の厚みを持ち，毎フレーム下へ流し，飛沫を加算する。
     ======================================================================= */
  function WallSim(renderer, size) {
    this.size = size;
    this.renderer = renderer;
    var opt = {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      depthBuffer: false, stencilBuffer: false
    };
    this.a = new THREE.WebGLRenderTarget(size, size, opt);
    this.b = new THREE.WebGLRenderTarget(size, size, opt);
    [this.a, this.b].forEach(function (rt) {
      rt.texture.wrapS = THREE.RepeatWrapping;
      rt.texture.wrapT = THREE.ClampToEdgeWrapping;
    });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // --- 移流パス ---
    this.advMat = new THREE.ShaderMaterial({
      uniforms: {
        uPrev: { value: null }, uFlow: { value: 0.0 },
        uPx: { value: 1 / size }, uDecay: { value: 1.0 }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: [
        'uniform sampler2D uPrev; uniform float uFlow; uniform float uPx; uniform float uDecay;',
        'varying vec2 vUv;',
        'void main(){',
        '  float here  = texture2D(uPrev, vUv).r;',
        '  float above = texture2D(uPrev, vUv + vec2(0.0, uPx)).r;',
        '  float ab2   = texture2D(uPrev, vUv + vec2(0.0, uPx*2.0)).r;',
        // 蜜は厚いほど速く流れる（自重）
        '  float k = clamp(uFlow * (0.35 + here*1.5), 0.0, 0.92);',
        '  float v = mix(here, mix(above, ab2, 0.35), k);',
        // 横へのにじみ（すじが太くなる）
        '  float l = texture2D(uPrev, vUv + vec2(uPx,0.0)).r;',
        '  float r = texture2D(uPrev, vUv - vec2(uPx,0.0)).r;',
        '  v += (l + r - 2.0*here) * 0.10;',
        '  v *= uDecay;',
        // 底に着いたらタンクへ落ちる
        '  v *= smoothstep(0.0, 0.055, vUv.y);',
        '  gl_FragColor = vec4(clamp(v,0.0,1.0), 0.0, 0.0, 1.0);',
        '}'
      ].join('\n')
    });
    this.advScene = new THREE.Scene();
    var advQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.advMat);
    advQuad.frustumCulled = false;
    this.advScene.add(advQuad);

    // --- 飛沫の加算パス ---
    var MAXS = 96;
    var base = new THREE.PlaneGeometry(1, 1);
    var g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    g.attributes.uv = base.attributes.uv;
    this.sPos = new THREE.InstancedBufferAttribute(new Float32Array(MAXS * 2), 2);
    this.sAmt = new THREE.InstancedBufferAttribute(new Float32Array(MAXS * 2), 2);
    this.sPos.setUsage(THREE.DynamicDrawUsage);
    this.sAmt.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iUv', this.sPos);
    g.setAttribute('iAmt', this.sAmt);
    g.instanceCount = 0;
    this.splatGeo = g;
    this.splatMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: [
        'attribute vec2 iUv; attribute vec2 iAmt;',
        'varying vec2 vP; varying float vA;',
        'void main(){',
        '  vP = position.xy * 2.0; vA = iAmt.x;',
        '  vec2 c = iUv*2.0-1.0;',
        '  gl_Position = vec4(c + position.xy*iAmt.y*2.0, 0.0, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec2 vP; varying float vA;',
        'void main(){',
        '  float d = 1.0 - clamp(length(vP), 0.0, 1.0);',
        '  gl_FragColor = vec4(vA * d * d, 0.0, 0.0, 1.0);',
        '}'
      ].join('\n'),
      blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false
    });
    this.splatMesh = new THREE.Mesh(g, this.splatMat);
    this.splatMesh.frustumCulled = false;
    this.splatScene = new THREE.Scene();
    this.splatScene.add(this.splatMesh);
    this.queue = [];
    this.MAXS = MAXS;
    this.clear();
  }

  WallSim.prototype.clear = function () {
    var r = this.renderer, old = r.getRenderTarget();
    var c = r.getClearColor(new THREE.Color()).clone(), ca = r.getClearAlpha();
    r.setClearColor(0x000000, 1);
    r.setRenderTarget(this.a); r.clear(true, false, false);
    r.setRenderTarget(this.b); r.clear(true, false, false);
    r.setRenderTarget(old);
    r.setClearColor(c, ca);
    this.queue.length = 0;
  };

  WallSim.prototype.splat = function (u, v, amount, size) {
    if (this.queue.length >= this.MAXS) return;
    this.queue.push(u, v, amount, size);
  };

  WallSim.prototype.step = function (dt) {
    var r = this.renderer;
    var old = r.getRenderTarget();
    var oldAuto = r.autoClear;

    this.advMat.uniforms.uPrev.value = this.a.texture;
    this.advMat.uniforms.uFlow.value = U.clamp(dt * 34.0, 0, 0.95);
    this.advMat.uniforms.uDecay.value = Math.exp(-0.018 * dt);
    r.autoClear = true;
    r.setRenderTarget(this.b);
    r.render(this.advScene, this.cam);

    var n = this.queue.length / 4;
    if (n > 0) {
      var pa = this.sPos.array, aa = this.sAmt.array;
      for (var i = 0; i < n; i++) {
        pa[i * 2] = this.queue[i * 4];
        pa[i * 2 + 1] = this.queue[i * 4 + 1];
        aa[i * 2] = this.queue[i * 4 + 2];
        aa[i * 2 + 1] = this.queue[i * 4 + 3];
      }
      this.sPos.needsUpdate = true; this.sAmt.needsUpdate = true;
      this.splatGeo.instanceCount = n;
      r.autoClear = false;
      r.render(this.splatScene, this.cam);
      this.queue.length = 0;
    }

    r.autoClear = oldAuto;
    r.setRenderTarget(old);
    var t = this.a; this.a = this.b; this.b = t;
    return this.a.texture;
  };

  /* ---------- 内壁に貼る蜜の膜 ---------- */
  function filmMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uSim: { value: null }, uPx: { value: 1 / 256 },
          uSunDir: { value: World.sunDir.clone() },
          uTime: { value: 0 }
        }
      ]),
      vertexShader: [
        'varying vec2 vUv; varying vec3 vN; varying vec3 vView;',
        '#include <fog_pars_vertex>',
        'void main(){',
        '  vUv = uv;',
        '  vN = normalize(normalMatrix * normal);',
        '  vec4 mvPosition = modelViewMatrix * vec4(position,1.0);',
        '  vView = -mvPosition.xyz;',
        '  #include <fog_vertex>',
        '  gl_Position = projectionMatrix * mvPosition;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uSim; uniform float uPx; uniform vec3 uSunDir; uniform float uTime;',
        'varying vec2 vUv; varying vec3 vN; varying vec3 vView;',
        '#include <fog_pars_fragment>',
        'void main(){',
        '  float a = texture2D(uSim, vUv).r;',
        '  if (a < 0.010) discard;',
        '  float gx = texture2D(uSim, vUv+vec2(uPx,0.0)).r - texture2D(uSim, vUv-vec2(uPx,0.0)).r;',
        '  float gy = texture2D(uSim, vUv+vec2(0.0,uPx)).r - texture2D(uSim, vUv-vec2(0.0,uPx)).r;',
        '  vec3 n = normalize(vN);',
        '  vec3 T = normalize(cross(vec3(0.0,1.0,0.0), n));',
        '  vec3 B = cross(n, T);',
        '  n = normalize(n - T*gx*7.0 - B*gy*7.0);',
        '  vec3 V = normalize(vView);',
        '  vec3 L = normalize(uSunDir);',
        '  vec3 H = normalize(L+V);',
        '  float thick = clamp(a*1.7, 0.0, 1.0);',
        '  vec3 base = mix(vec3(0.98,0.72,0.22), vec3(0.62,0.30,0.03), thick);',
        '  float ndl = max(dot(n,L),0.0)*0.42 + 0.42;',
        '  float spec = pow(max(dot(n,H),0.0), 78.0);',
        '  float fres = pow(1.0-max(dot(n,V),0.0), 3.0);',
        '  vec3 col = base*ndl + vec3(1.0,0.96,0.86)*spec*0.75 + vec3(1.0,0.85,0.5)*fres*0.20;',
        '  float alpha = smoothstep(0.006, 0.085, a);',
        '  gl_FragColor = vec4(col, alpha);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '  #include <fog_fragment>',
        '}'
      ].join('\n'),
      transparent: true, side: THREE.BackSide, depthWrite: false, fog: true
    });
  }

  /* ---------- 回転ブレのすじ ---------- */
  function blurTex() {
    var c = document.createElement('canvas'); c.width = 256; c.height = 64;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 256, 64);
    var rnd = U.mulberry(19);
    for (var i = 0; i < 60; i++) {
      var y = rnd() * 64, h = 1 + rnd() * 5;
      var grd = g.createLinearGradient(0, 0, 256, 0);
      grd.addColorStop(0, 'rgba(190,140,60,0)');
      grd.addColorStop(0.5, 'rgba(210,160,70,' + (0.10 + rnd() * 0.30) + ')');
      grd.addColorStop(1, 'rgba(190,140,60,0)');
      g.fillStyle = grd;
      g.fillRect(0, y, 256, h);
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* ================================================================== */
  Stages.extract = {
    id: 'extract',

    build: function (G) {
      E = P.EXTRACTOR;
      var L = LAYOUT;

      S.sim = new WallSim(G.renderer, 256);

      var glass = new THREE.MeshPhysicalMaterial({
        color: MAT.C(0xdfeef4), roughness: 0.04, metalness: 0.0,
        transparent: true, opacity: 0.34, side: THREE.DoubleSide,
        envMap: MAT.env, envMapIntensity: 2.4, depthWrite: false,
        clearcoat: 1.0, clearcoatRoughness: 0.03, reflectivity: 0.9
      });
      var ex = P.extractor(glass);
      ex.position.copy(L.extractor);
      G.scene.add(ex);
      S.ex = ex;
      S.rotor = ex.userData.rotor;
      S.crank = ex.userData.crank;
      S.pockets = ex.userData.pockets;

      var sb = P.shadowBlob(0.32, 0.32, 0.5);
      sb.position.set(L.extractor.x, 0.006, L.extractor.z);
      G.scene.add(sb);

      // 内壁の蜜の膜
      var film = new THREE.Mesh(
        new THREE.CylinderGeometry(E.R - 0.006, E.R - 0.006, E.H, 64, 1, true),
        filmMaterial()
      );
      film.position.y = ex.userData.wallY0 + E.H / 2;
      film.renderOrder = 11;
      ex.add(film);
      S.film = film;

      // 底にたまる蜜
      var honeyMat = MAT.honeyMat({ color: 0xb06c06, opacity: 0.97, rough: 0.24 });
      honeyMat.envMapIntensity = 0.45;
      var pool = new THREE.Mesh(new THREE.CylinderGeometry(E.R - 0.008, E.R - 0.008, 1, 48, 1, false), honeyMat);
      pool.position.y = ex.userData.wallY0;
      pool.scale.y = 0.0001;
      pool.renderOrder = 10;
      ex.add(pool);
      S.pool = pool;
      // 円錐部にたまる分
      var coneFill = new THREE.Mesh(
        new THREE.CylinderGeometry(E.R - 0.010, E.R * 0.30, 0.10, 40, 1, false), honeyMat);
      coneFill.position.y = ex.userData.wallY0 - 0.05;
      coneFill.scale.setScalar(0.0001);
      coneFill.renderOrder = 10;
      ex.add(coneFill);
      S.coneFill = coneFill;

      // 回転ブレ
      var blur = new THREE.Mesh(
        new THREE.CylinderGeometry(E.R * 0.74, E.R * 0.74, E.H * 0.66, 40, 1, true),
        new THREE.MeshBasicMaterial({
          map: blurTex(), transparent: true, opacity: 0, side: THREE.DoubleSide,
          depthWrite: false, blending: THREE.NormalBlending
        })
      );
      blur.material.map.repeat.set(3, 1);
      blur.position.y = ex.userData.wallY0 + E.H * 0.5;
      blur.renderOrder = 10;
      ex.add(blur);
      S.blur = blur;

      // 飛び散る蜜（分離機のローカル座標で動かす）
      S.drops = new FX.Quads(420, TEX.blob(), {
        color: MAT.C(0xffffff), emissive: 0.25, stretch: true, renderOrder: 12, fog: false
      });
      ex.add(S.drops.mesh);

      S.circle = new U.CircleTracker();
      // 指の動きはフレームではなくポインタイベントごとに拾う。
      // こうすると，速く回しても・端末が重くても角度を取りこぼさない。
      G.ptr.on('down', function (p) {
        if (G.stage === 3 && S.phase === 'spin') { S.circle.begin(p.x, p.y); S.accum = 0; }
      });
      G.ptr.on('move', function (p) {
        if (G.stage === 3 && S.phase === 'spin') S.accum += Math.abs(S.circle.update(p.x, p.y));
      });
      G.ptr.on('up', function () { S.circle.end(); });

      // まわりの小物
      var bucket = P.cyl(0.11, 0.095, 0.24, 24,
        MAT.metal({ base: '#d6dadd', grime: .7, dents: 8, seed: 211, rough: .4, metal: .5 }));
      bucket.position.set(L.extractor.x - 0.52, 0.12, L.extractor.z + 0.30);
      G.scene.add(bucket);
    },

    enter: function (G) {
      S.frames = Stages.frames.pulled();
      S.inserted = 0;
      S.phase = 'insert';
      S.omega = 0; S.honey = 0; S.doneT = 0; S.spinTime = 0;
      S.rotorAng = 0; S.crankAng = 0;
      S.sim.clear();
      S.drops.clear();
      S.pool.scale.y = 0.0001;
      S.coneFill.scale.setScalar(0.0001);
      S.frames.forEach(function (f) { f.userData.comb.uniforms.uDrain.value = 0; });

      var c = LAYOUT.extractor;
      G.setCam(new THREE.Vector3(c.x, S.ex.userData.crankY, c.z),
        new THREE.Vector3(0.22, 0.34, 1.0).normalize(), 0.56,
        { speed: 1.7, minW: 0.40, biasY: -0.36 });
      World.setShadowFocus(new THREE.Vector3(c.x, 0.7, c.z));
      nextInsert(G);
    },

    exit: function () {
      SFX.spinLoop(0);
    },

    update: function (G, dt) {
      if (S.phase === 'insert') updateInsert(G, dt);
      else if (S.phase === 'spin') updateSpin(G, dt);
      else if (S.phase === 'done') updateDone(G, dt);

      // 回転
      S.crankAng += S.omega * dt;
      S.rotorAng += S.omega * S.gear * dt;
      S.crank.rotation.y = S.crankAng;
      S.rotor.rotation.y = S.rotorAng;

      var sp = U.sat(S.omega / MAXW);
      S.blur.material.opacity = Math.pow(sp, 1.6) * 0.55;
      S.blur.rotation.y = S.rotorAng * 0.85;

      // 流体シミュレーション
      S.film.material.uniforms.uSim.value = S.sim.step(dt);
      S.film.material.uniforms.uTime.value = G.time;

      // たまった蜜
      var poolH = S.honey * 0.085;
      S.pool.scale.y = Math.max(0.0001, poolH);
      S.pool.position.y = S.ex.userData.wallY0 + poolH / 2
        + Math.sin(G.time * 3.1) * poolH * 0.02 * sp;
      var cf = U.sat(S.honey * 3.0);
      S.coneFill.scale.set(1, Math.max(0.0001, cf), 1);
      S.coneFill.position.y = S.ex.userData.wallY0 - 0.10 + cf * 0.05;
      S.coneFill.visible = cf > 0.02;

      S.drops.update(dt, G.time);
    }
  };

  /* ---------- 巣枠を差しこむ ---------- */
  function nextInsert(G) {
    if (S.inserted >= S.frames.length) {
      beginSpin(G);
      return;
    }
    var f = S.frames[S.inserted];
    var pk = S.pockets[S.inserted % S.pockets.length];
    pk.updateWorldMatrix(true, false);
    var target = new THREE.Vector3(0, 0, 0.004).applyMatrix4(pk.matrixWorld);
    var q = new THREE.Quaternion();
    pk.getWorldQuaternion(q);
    S.anim = {
      t: 0, dur: 0.85, f: f, pk: pk,
      from: f.position.clone(), to: target,
      fromQ: f.quaternion.clone(), toQ: q,
      up: new THREE.Vector3(target.x, S.ex.position.y + S.ex.userData.topY + 0.16, target.z)
    };
  }

  function updateInsert(G, dt) {
    var a = S.anim;
    if (!a) return;
    a.t += dt;
    var t = U.sat(a.t / a.dur);
    var f = a.f;
    // 上まで持ち上げてから，まっすぐ落としこむ（実際の入れ方）
    if (t < 0.55) {
      var e = U.easeInOut(t / 0.55);
      f.position.lerpVectors(a.from, a.up, e);
      f.quaternion.slerpQuaternions(a.fromQ, a.toQ, e);
    } else {
      var e2 = U.easeIn((t - 0.55) / 0.45);
      f.position.lerpVectors(a.up, a.to, e2);
      f.quaternion.copy(a.toQ);
    }
    if (t >= 1) {
      a.pk.attach(f);
      f.position.set(0, 0, 0.004);
      f.rotation.set(0, 0, 0);
      SFX.woodThunk(0.55);
      SFX.clink(1.4);
      S.inserted++;
      S.anim = null;
      nextInsert(G);
    }
  }

  /* ---------- 回す ---------- */
  function beginSpin(G) {
    S.phase = 'spin';
    var c = LAYOUT.extractor;
    G.setCam(new THREE.Vector3(c.x, S.ex.userData.crankY, c.z),
      new THREE.Vector3(0.20, 0.32, 1.0).normalize(), 0.54,
      { speed: 2.0, minW: 0.40, biasY: -0.36 });
    setCircleHint(G);
  }

  function crankScreen(G) {
    S.tmp.set(0, S.ex.userData.crankY + 0.05, 0).applyMatrix4(S.ex.matrixWorld);
    return U.toScreen(S.tmp, G.camera, G.w, G.h, S.centerScreen);
  }

  function setCircleHint(G) {
    Hint.set({
      type: 'circle',
      at: function () { return crankScreen(G); },
      radius: 78, delay: 1.6
    });
  }

  function updateSpin(G, dt) {
    var p = G.ptr;
    var cs = crankScreen(G);
    S.circle.setCenter(cs.x, cs.y);

    if (p.down) {
      var w = S.accum / Math.max(dt, 1e-3);
      S.accum = 0;
      S.fingerW = U.damp(S.fingerW, Math.min(w, 20), 10, dt);
      // 指の速さへ寄せる（重いローターなので追いつくのに少し時間がかかる）
      S.omega = U.damp(S.omega, Math.min(S.fingerW, MAXW), 3.4, dt);
      if (S.omega > 0.6) Hint.clear();
    } else {
      S.accum = 0;
      S.fingerW = U.damp(S.fingerW, 0, 6, dt);
      S.omega *= Math.exp(-0.62 * dt);       // 惰性で回りつづける
      if (S.omega < 0.05) S.omega = 0;
      if (S.omega < 0.5 && S.honey < 0.98) setCircleHint(G);
    }

    var sp = U.sat(S.omega / MAXW);
    SFX.spinLoop(sp);
    if (sp > 0.55) G.camShake(0.0016 * sp);

    /* --- 蜜が飛ぶ --- */
    if (sp > 0.10 && S.honey < 1) {
      var rate = Math.pow(sp, 1.4) * 210 * (1 - S.honey * 0.45);
      S.spinTime += rate * dt;
      while (S.spinTime > 1) {
        S.spinTime -= 1;
        spawnDrop(G, sp);
      }
      var gain = Math.pow(sp, 1.4) * dt / FILL_TIME;
      S.honey = Math.min(1, S.honey + gain);
      // 巣房から蜜が抜けていく
      var dr = S.honey;
      for (var i = 0; i < S.frames.length; i++) {
        S.frames[i].userData.comb.uniforms.uDrain.value = dr;
      }
    }

    if (S.honey >= 0.999) {
      S.phase = 'done';
      S.doneT = 0;
      Hint.clear();
      SFX.fanfare();
    }
  }

  function spawnDrop(G, sp) {
    var pk = S.pockets[U.randInt(0, S.pockets.length - 1)];
    var pa = pk.userData.baseAngle;
    if (pa == null) {
      pa = Math.atan2(pk.position.z, pk.position.x);
      pk.userData.baseAngle = pa;
    }
    var ang = pa + S.rotorAng;
    var rp = E.R * 0.50;
    var cs = Math.cos(ang), sn = Math.sin(ang);
    var dx = U.rand(-0.20, 0.20);           // 巣脾の幅方向
    var dy = U.rand(-0.09, 0.09);           // 高さ方向
    var out = 0.012;
    var px = cs * (rp + out) - sn * dx;
    var pz = sn * (rp + out) + cs * dx;
    var py = S.ex.userData.wallY0 + E.H * 0.5 + dy;

    var w = S.omega * S.gear;
    // v = ω × r （接線方向）＋ わずかに外向き。
    // 実速度のままだと 1 フレームで壁に着いてしまうので，見える速さに落とす。
    var vScale = 0.26;
    var vx = (-w * pz + cs * w * 0.05) * vScale;
    var vz = (w * px + sn * w * 0.05) * vScale;
    var sp2 = Math.hypot(vx, vz);
    var cap = U.clamp(sp2, 0.65, 2.9);
    if (sp2 > 1e-5) { vx *= cap / sp2; vz *= cap / sp2; }

    S.drops.spawn({
      x: px, y: py, z: pz,
      vx: vx, vy: U.rand(-0.10, 0.10), vz: vz,
      life: 1.4,
      s0: U.rand(0.010, 0.022), s1: U.rand(0.006, 0.014),
      alpha: 0.95, drag: 0.10, grav: -0.5, stretch: 0.55,
      onHit: hitWall
    });
  }

  function hitWall(p) {
    var rr = Math.sqrt(p.x * p.x + p.z * p.z);
    if (rr < E.R - 0.010) return false;
    var u = Math.atan2(p.x, p.z) / (Math.PI * 2);
    u = u - Math.floor(u);
    var v = U.clamp((p.y - S.ex.userData.wallY0) / E.H, 0.02, 0.98);
    // 当たった点と，そのすぐ下に垂れた分
    S.sim.splat(u, v, U.rand(0.75, 1.0), U.rand(0.045, 0.085));
    S.sim.splat(u + U.rand(-0.01, 0.01), Math.max(0.03, v - 0.035), U.rand(0.3, 0.6), U.rand(0.03, 0.055));
    return true;
  }

  /* ---------- 終わり ---------- */
  function updateDone(G, dt) {
    S.doneT += dt;
    S.omega *= Math.exp(-1.5 * dt);
    SFX.spinLoop(U.sat(S.omega / MAXW));
    if (S.doneT > 2.2 && G.stage === 3) {
      G.next();
    }
  }

  // 瓶詰めステージから使う
  Stages.extract.honeyAmount = function () { return S.honey; };
  Stages.extract.takeHoney = function (v) { S.honey = Math.max(0, S.honey - v); };
  Stages.extract.gateWorld = function () {
    S.ex.updateMatrixWorld(true);
    return S.ex.localToWorld(S.ex.userData.spoutWorld.clone());
  };
  Stages.extract.gate = function () { return S.ex.userData.gate; };
  Stages.extract.object = function () { return S.ex; };
  Stages.extract._S = S;
  Stages.extract._peek = function (G) {
    var buf = new Uint8Array(4 * 64 * 64);
    G.renderer.readRenderTargetPixels(S.sim.a, 96, 40, 64, 64, buf);
    var mx = 0, sum = 0;
    for (var i = 0; i < buf.length; i += 4) { mx = Math.max(mx, buf[i]); sum += buf[i]; }
    return { max: mx, avg: (sum / (buf.length / 4)).toFixed(2) };
  };
})(window);
