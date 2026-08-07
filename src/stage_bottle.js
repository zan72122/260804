/* =========================================================================
   stage_bottle.js — ⑤蜂蜜を瓶へ
   蛇口をタップすると，黄金の蜂蜜が トローーーッ と落ちて瓶を満たす。
   ガラスと蜜は，背景を実際にサンプリングして曲げる屈折シェーダで描いている。
   ========================================================================= */
(function (global) {
  'use strict';

  var S = {
    jar: null, jarHoney: null, jarSurf: null, lid: null,
    stream: null, coil: null, drips: null,
    gate: null, lever: null, open: 0, openGoal: 0,
    fill: 0, filled: 0, jarsThisRound: 0,
    phase: 'idle',        // idle → pour → cap → stow → done
    bgRT: null, glassMat: null, honeyGlassMat: null,
    spout: new THREE.Vector3(), shelf: null, shelfJars: [],
    t: 0, ripple: 0, tmp: new THREE.Vector3(), pourSound: 0
  };

  var J = null;
  var JARS_PER_ROUND = 2;
  var FILL_RATE = 0.30;          // 1秒あたりの充填割合

  global.Stages = global.Stages || {};

  /* ---------- 流れ落ちる蜜の柱 ---------- */
  function streamMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 }, uFlow: { value: 1 },
          uSunDir: { value: World.sunDir.clone() },
          uLen: { value: 0.2 }
        }
      ]),
      vertexShader: [
        'uniform float uTime; uniform float uFlow; uniform float uLen;',
        'varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vY;',
        '#include <fog_pars_vertex>',
        'void main(){',
        '  vUv = uv; vY = position.y + 0.5;',
        '  vec3 p = position;',
        // 落ちるほど細くなり，ゆらゆら揺れる（とろみ）
        '  float t = 1.0 - vY;',
        '  float taper = mix(1.0, 0.62, t*t);',
        '  float wob = sin(vY*26.0 - uTime*5.0)*0.10 + sin(vY*41.0 - uTime*7.3)*0.06;',
        '  p.xz *= taper * (1.0 + wob*0.35);',
        '  p.x += sin(vY*7.0 - uTime*2.2)*0.0022;',
        '  p.z += cos(vY*6.0 - uTime*1.9)*0.0022;',
        '  vN = normalize(normalMatrix * normal);',
        '  vec4 mvPosition = modelViewMatrix * vec4(p,1.0);',
        '  vView = -mvPosition.xyz;',
        '  #include <fog_vertex>',
        '  gl_Position = projectionMatrix * mvPosition;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime; uniform vec3 uSunDir;',
        'varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vY;',
        '#include <fog_pars_fragment>',
        'void main(){',
        '  vec3 n = normalize(vN); vec3 V = normalize(vView);',
        '  vec3 L = normalize(uSunDir); vec3 H = normalize(L+V);',
        '  float fres = pow(1.0-max(dot(n,V),0.0), 2.2);',
        '  vec3 base = mix(vec3(0.52,0.24,0.015), vec3(0.90,0.55,0.10), fres);',
        // 流れているすじ
        '  float streak = 0.5+0.5*sin(vUv.x*24.0 + vY*40.0 - uTime*9.0);',
        '  base *= 0.86 + streak*0.22;',
        '  float spec = pow(max(dot(n,H),0.0), 60.0);',
        '  vec3 col = base + vec3(1.0,0.97,0.86)*spec*0.85 + vec3(1.0,0.86,0.5)*fres*0.22;',
        '  gl_FragColor = vec4(col, 0.94);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '  #include <fog_fragment>',
        '}'
      ].join('\n'),
      transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: true
    });
  }

  /* ================================================================== */
  Stages.bottle = {
    id: 'bottle',

    build: function (G) {
      J = P.JAR;
      var L = LAYOUT;
      var ex = Stages.extract.object();
      S.gate = Stages.extract.gate();
      S.lever = S.gate.userData.lever;
      S.spout.copy(Stages.extract.gateWorld());

      // 瓶を置く木のブロック
      var block = P.plinth(0.26, 0.115, 0.24, 231);
      block.position.set(S.spout.x, 0, S.spout.z);
      block.rotation.y = 0.18;
      G.scene.add(block);
      S.blockTop = 0.115;
      var bsb = P.shadowBlob(0.20, 0.19, 0.45);
      bsb.position.set(S.spout.x, 0.006, S.spout.z);
      G.scene.add(bsb);

      // --- 背景をとらえる描画先（屈折用）---
      S.bgRT = new THREE.WebGLRenderTarget(2, 2, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false
      });

      S.glassMat = MAT.glassMaterial(null, {
        tint: 0xeaf6f8, strength: 0.055, opacity: 1.0, fres: 1.0, side: THREE.FrontSide
      });

      var jar = P.jar(S.glassMat);
      jar.position.set(S.spout.x, S.blockTop, S.spout.z);
      jar.visible = false;
      G.scene.add(jar);
      S.jar = jar;

      // 瓶の中の蜜
      var hm = MAT.honeyMat({ color: 0xb0680a, opacity: 1.0, transparent: false, rough: 0.20 });
      hm.envMapIntensity = 0.45;
      var honey = new THREE.Mesh(
        new THREE.CylinderGeometry(J.R - 0.0045, J.R - 0.0045, 1, 36, 1, false), hm);
      honey.position.set(S.spout.x, S.blockTop, S.spout.z);
      honey.scale.y = 0.0001;
      honey.visible = false;
      G.scene.add(honey);
      S.jarHoney = honey;

      // 液面（少し盛り上がったメニスカス）
      var surf = new THREE.Mesh(
        new THREE.SphereGeometry(J.R - 0.0045, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.30),
        MAT.honeyMat({ color: 0xc07a0e, opacity: 1.0, transparent: false, rough: 0.10 }));
      surf.scale.y = 0.20;
      surf.visible = false;
      G.scene.add(surf);
      S.jarSurf = surf;

      // 蜜の柱
      var stream = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0092, 0.0092, 1, 16, 26, true), streamMaterial());
      stream.visible = false;
      stream.renderOrder = 13;
      G.scene.add(stream);
      S.stream = stream;

      // 落ちたところで巻きあがる渦
      var coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.014, 0.0055, 8, 24),
        MAT.honeyMat({ opacity: 0.96, rough: 0.06 }));
      coil.rotation.x = Math.PI / 2;
      coil.visible = false;
      coil.renderOrder = 13;
      G.scene.add(coil);
      S.coil = coil;

      S.drips = new FX.Quads(70, TEX.blob(), { color: MAT.C(0xffffff), emissive: 0.2, renderOrder: 13 });
      G.scene.add(S.drips.mesh);

      // できあがった瓶をならべる棚
      var shelf = P.crate(0.72, 0.34, 0.30, 241);
      shelf.position.copy(L.shelf);
      shelf.rotation.y = -0.22;
      G.scene.add(shelf);
      S.shelf = shelf;
      S.shelfY = 0.34;
      var sb = P.shadowBlob(0.40, 0.24, 0.42);
      sb.position.set(L.shelf.x, 0.006, L.shelf.z);
      G.scene.add(sb);

      S.lidProto = P.jarLid();
      S.lidProto.visible = false;
      G.scene.add(S.lidProto);

      G.resize();
    },

    resize: function (G) {
      if (!S.bgRT) return;
      var sz = new THREE.Vector2();
      G.renderer.getDrawingBufferSize(sz);
      S.bgRT.setSize(Math.max(2, Math.floor(sz.x * 0.6)), Math.max(2, Math.floor(sz.y * 0.6)));
    },

    enter: function (G) {
      S.jarsThisRound = 0;
      startJar(G, true);
      // 背景が草地になる角度から見おろす（ガラスの屈折がいちばん映える）
      var c = new THREE.Vector3(S.spout.x + 0.005, 0.285, S.spout.z + 0.03);
      G.setCam(c, new THREE.Vector3(0.26, 0.36, 0.90).normalize(), 0.215,
        { speed: 1.8, minW: 0.145, biasY: -0.14 });
      World.setShadowFocus(c);
    },

    exit: function () {
      SFX.pourLoop(0);
      S.stream.visible = false;
      S.coil.visible = false;
      // 屈折用の背景描画が働くのはこのステージだけなので，瓶は隠しておく
      S.jar.visible = false;
      S.jarHoney.visible = false;
      S.jarSurf.visible = false;
      S.lidProto.visible = false;
    },

    update: function (G, dt) {
      var p = G.ptr;
      S.t += dt;

      /* --- 蛇口の開け閉め（画面のどこをタップしてもよい） --- */
      if (S.phase === 'idle' || S.phase === 'pour') {
        if (p.justUp && p.tapped) {
          S.openGoal = S.openGoal > 0.5 ? 0 : 1;
          SFX.clink(1.9);
          if (S.openGoal > 0.5) { S.phase = 'pour'; Hint.clear(); }
        }
      }
      S.open = U.damp(S.open, S.openGoal, 9, dt);
      S.lever.rotation.z = -S.open * 1.15;

      /* --- 注ぐ --- */
      var pouring = S.open > 0.35 && S.fill < 1 && S.phase === 'pour';
      var flow = pouring ? U.smooth(0.35, 0.8, S.open) : 0;
      if (pouring) {
        S.fill = Math.min(1, S.fill + FILL_RATE * dt * flow);
        Stages.extract.takeHoney(dt * FILL_RATE * flow / JARS_PER_ROUND);
      }
      SFX.pourLoop(flow * (S.fill < 1 ? 1 : 0));

      updateJarVisual(G, dt, flow);

      /* --- 満タン --- */
      if (S.fill >= 1 && S.phase === 'pour') {
        if (S.openGoal > 0.5) {
          // 「しめてね」の合図
          Hint.set({ type: 'tap', at: leverWorld(), delay: 0.9 });
          if (!S.fullChime) { S.fullChime = 1; SFX.chime(12, 0.9); }
        } else {
          S.fullChime = 0;
          beginCap(G);
        }
      }

      if (S.phase === 'cap') updateCap(G, dt);
      else if (S.phase === 'stow') updateStow(G, dt);
      else if (S.phase === 'done') updateDone(G, dt);

      S.drips.update(dt, G.time);
    },

    /* --- 屈折のための2パス描画 --- */
    render: function (G) {
      var r = G.renderer;
      var showJar = S.jar.visible;
      if (showJar) {
        S.jar.visible = false;
        r.setRenderTarget(S.bgRT);
        r.render(G.scene, G.camera);
        r.setRenderTarget(null);
        S.jar.visible = true;
        S.glassMat.uniforms.uBg.value = S.bgRT.texture;
      }
      r.render(G.scene, G.camera);
    }
  };

  function leverWorld() {
    return S.lever.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.05, 0));
  }

  /* ---------- 新しい空き瓶 ---------- */
  function startJar(G, first) {
    S.fill = 0; S.open = 0; S.openGoal = 0; S.fullChime = 0;
    S.phase = 'idle';
    S.jar.visible = true;
    S.jar.position.set(S.spout.x, S.blockTop, S.spout.z);
    S.jar.rotation.set(0, 0, 0);
    S.jarHoney.visible = false;
    S.jarSurf.visible = false;
    S.lidProto.visible = false;
    Hint.set({ type: 'tap', at: leverWorld(), delay: first ? 1.4 : 1.0 });
  }

  /* ---------- 瓶と柱の見た目 ---------- */
  function updateJarVisual(G, dt, flow) {
    var inner = J.H * 0.80;
    var hH = S.fill * inner;
    var topY = S.jar.position.y + 0.004 + hH;

    S.jarHoney.visible = S.fill > 0.004;
    S.jarHoney.position.set(S.jar.position.x, S.jar.position.y + 0.004 + hH / 2, S.jar.position.z);
    S.jarHoney.scale.set(1, Math.max(0.0001, hH), 1);
    S.jarHoney.rotation.copy(S.jar.rotation);

    S.jarSurf.visible = S.jarHoney.visible;
    S.jarSurf.position.set(S.jar.position.x, topY, S.jar.position.z);
    // 落ちた蜜で波打つ
    var w = flow > 0 ? 1 : Math.max(0, 1 - S.t * 0);
    S.jarSurf.scale.y = 0.20 + Math.sin(G.time * 9) * 0.05 * flow;

    // 柱
    if (flow > 0.02 && S.fill < 1) {
      S.stream.visible = true;
      var top = S.spout.y - 0.006;
      var len = Math.max(0.01, top - topY);
      S.stream.position.set(S.spout.x, topY + len / 2, S.spout.z);
      S.stream.scale.set(1, len, 1);
      S.stream.material.uniforms.uTime.value = G.time;
      S.stream.material.uniforms.uLen.value = len;

      S.coil.visible = true;
      S.coil.position.set(S.spout.x, topY + 0.004, S.spout.z);
      S.coil.rotation.z = G.time * 3.4;
      S.coil.scale.setScalar(0.7 + Math.sin(G.time * 7) * 0.12);

      // ときどきしずくが跳ねる
      if (Math.random() < dt * 9) {
        S.drips.spawn({
          x: S.spout.x + U.rand(-.012, .012), y: topY + 0.006, z: S.spout.z + U.rand(-.012, .012),
          vx: U.rand(-.10, .10), vy: U.rand(0.05, 0.16), vz: U.rand(-.10, .10),
          life: 0.55, s0: U.rand(0.004, 0.008), s1: 0.002, alpha: 0.9, grav: -1.4, drag: 0.4
        });
      }
    } else {
      S.stream.visible = false;
      S.coil.visible = false;
      // 閉じたあとの名残のしずく
      if (S.open > 0.05 && Math.random() < dt * 3) {
        S.drips.spawn({
          x: S.spout.x, y: S.spout.y - 0.01, z: S.spout.z,
          vx: 0, vy: -0.02, vz: 0, life: 0.9,
          s0: 0.008, s1: 0.005, alpha: 0.95, grav: -1.8, drag: 0.05
        });
      }
    }
  }

  /* ---------- ふたをする ---------- */
  function beginCap(G) {
    S.phase = 'cap';
    S.capT = 0;
    Hint.clear();
    S.lidProto.visible = true;
    SFX.chime(16, 0.8);
  }

  function updateCap(G, dt) {
    S.capT += dt;
    var t = U.sat(S.capT / 0.9);
    var e = U.easeOut(t);
    var y = U.lerp(S.jar.position.y + J.H + 0.09, S.jar.position.y + J.H - 0.004, e);
    S.lidProto.position.set(S.jar.position.x, y, S.jar.position.z);
    S.lidProto.rotation.y = (1 - e) * 7.0;
    if (t >= 1) {
      SFX.clink(0.9);
      G.sparkle.burst(new THREE.Vector3(S.jar.position.x, S.jar.position.y + J.H * 0.5, S.jar.position.z), 26, 0.6, 0.035);
      beginStow(G);
    }
  }

  /* ---------- 棚にならべる ---------- */
  function beginStow(G) {
    S.phase = 'stow';
    S.stowT = 0;
    var n = S.shelfJars.length;
    var col = n % 4, row = Math.floor(n / 4) % 3;
    var lx = -0.24 + col * 0.16, lz = -0.08 + (row % 2) * 0.11;
    var a = S.shelf.rotation.y;
    S.stowTo = new THREE.Vector3(
      LAYOUT.shelf.x + Math.cos(a) * lx + Math.sin(a) * lz,
      S.shelfY,
      LAYOUT.shelf.z - Math.sin(a) * lx + Math.cos(a) * lz
    );
    S.stowFrom = S.jar.position.clone();
  }

  function updateStow(G, dt) {
    S.stowT += dt;
    var t = U.sat(S.stowT / 1.0);
    var e = U.easeInOut(t);
    var p = new THREE.Vector3().lerpVectors(S.stowFrom, S.stowTo, e);
    p.y += Math.sin(t * Math.PI) * 0.16;
    S.jar.position.copy(p);
    S.jarHoney.position.set(p.x, p.y + 0.004 + (S.fill * J.H * 0.80) / 2, p.z);
    S.jarSurf.position.set(p.x, p.y + 0.004 + S.fill * J.H * 0.80, p.z);
    S.lidProto.position.set(p.x, p.y + J.H - 0.004, p.z);
    S.jar.rotation.y = e * 0.6;

    if (t >= 1) {
      // 棚に置いた瓶は固定の複製にする
      var g = new THREE.Group();
      var jar2 = P.jar(new THREE.MeshPhysicalMaterial({
        color: MAT.C(0xe8f4f6), roughness: .05, metalness: 0, transparent: true, opacity: .34,
        side: THREE.DoubleSide, envMap: MAT.env, envMapIntensity: 1.5, depthWrite: false
      }));
      var h2 = new THREE.Mesh(
        new THREE.CylinderGeometry(J.R - 0.005, J.R - 0.005, S.fill * J.H * 0.80, 28),
        MAT.honeyMat({ color: 0xb0680a, opacity: 1, transparent: false, rough: 0.2 }));
      h2.position.y = 0.004 + S.fill * J.H * 0.80 / 2;
      var l2 = P.jarLid();
      l2.position.y = J.H - 0.004;
      g.add(jar2, h2, l2);
      g.position.copy(S.stowTo);
      g.rotation.y = U.rand(-0.5, 0.5);
      G.scene.add(g);
      S.shelfJars.push(g);
      // 棚がいっぱいになったら古いものから片づける
      while (S.shelfJars.length > 12) {
        var old = S.shelfJars.shift();
        G.scene.remove(old);
        old.traverse(function (o) { if (o.isMesh) o.geometry.dispose(); });
      }

      SFX.clink(0.8);
      G.state.jars++;
      G.updateJars();

      S.jarsThisRound++;
      if (S.jarsThisRound < JARS_PER_ROUND && Stages.extract.honeyAmount() > 0.05) {
        startJar(G, false);
        SFX.chime(7, 0.7);
      } else {
        S.phase = 'done';
        S.doneT = 0;
        S.jar.visible = false;
        S.jarHoney.visible = false;
        S.jarSurf.visible = false;
        S.lidProto.visible = false;
        SFX.fanfare();
        // ごほうび：棚を見せる
        G.setCam(new THREE.Vector3(LAYOUT.shelf.x, 0.42, LAYOUT.shelf.z),
          new THREE.Vector3(0.05, 0.30, 1.0).normalize(), 0.24, { speed: 1.6, minW: 0.24 });
        World.setShadowFocus(new THREE.Vector3(LAYOUT.shelf.x, 0.4, LAYOUT.shelf.z));
      }
    }
  }

  function updateDone(G, dt) {
    S.doneT += dt;
    if (S.doneT > 0.9) {
      Hint.set({ type: 'tap', at: new THREE.Vector3(LAYOUT.shelf.x, 0.46, LAYOUT.shelf.z), delay: 0.6 });
    }
    if (S.doneT > 2.6 || (S.doneT > 1.0 && G.ptr.justUp && G.ptr.tapped)) {
      G.state.loop++;
      Hint.clear();
      G.go(0);
    }
  }
})(window);
