/* =========================================================================
   game.js — 全体の進行・カメラ・入力・描画ループ
   ========================================================================= */
(function (global) {
  'use strict';

  var G = {
    renderer: null, scene: null, camera: null,
    w: 1, h: 1, dpr: 1, aspect: 1,
    time: 0, dt: 0, running: false,
    ptr: null, ray: new THREE.Raycaster(),
    stage: -1, stages: [], stageObj: null,
    camArrived: 0,
    state: { jars: 0, loop: 0, frames: [] }
  };

  /* ---------- カメラリグ ---------- */
  var cam = {
    target: new THREE.Vector3(0, 0.6, 0),
    dir: new THREE.Vector3(0.3, 0.5, 1).normalize(),
    radius: 0.6,
    minW: 0.3,
    biasY: 0, curBias: 0,
    curT: new THREE.Vector3(0, 0.6, 0),
    curD: new THREE.Vector3(0.3, 0.5, 1).normalize(),
    curR: 0.6,
    curMinW: 0.3,
    speed: 2.4,
    shake: 0, shakeT: 0
  };

  G.setCam = function (target, dir, radius, opt) {
    opt = opt || {};
    cam.target.copy(target);
    cam.dir.copy(dir).normalize();
    cam.radius = radius;
    // 縦持ちでも必ず見えていてほしい半幅（道具の実寸に合わせる）
    cam.minW = opt.minW != null ? opt.minW : radius * 0.62;
    // 画面内での上下の寄せ（見える高さに対する割合）
    cam.biasY = opt.biasY || 0;
    cam.speed = opt.speed || 2.4;
    if (opt.snap) {
      cam.curT.copy(target); cam.curD.copy(cam.dir);
      cam.curR = radius; cam.curMinW = cam.minW; cam.curBias = cam.biasY;
    }
    G.camArrived = opt.snap ? 1 : 0;
  };
  G.camShake = function (v) { cam.shake = Math.max(cam.shake, v); };

  function updateCamera(dt) {
    U.dampV(cam.curT, cam.target, cam.speed, dt);
    cam.curD.x = U.damp(cam.curD.x, cam.dir.x, cam.speed, dt);
    cam.curD.y = U.damp(cam.curD.y, cam.dir.y, cam.speed, dt);
    cam.curD.z = U.damp(cam.curD.z, cam.dir.z, cam.speed, dt);
    cam.curD.normalize();
    cam.curR = U.damp(cam.curR, cam.radius, cam.speed, dt);
    cam.curMinW = U.damp(cam.curMinW, cam.minW, cam.speed, dt);
    cam.curBias = U.damp(cam.curBias, cam.biasY, cam.speed, dt);

    var c = G.camera;
    var vFov = THREE.MathUtils.degToRad(c.fov);
    var hFov = 2 * Math.atan(Math.tan(vFov / 2) * c.aspect);
    // 縦持ちでは横をいくらか切り，被写体を大きく見せる
    var halfH = cam.curR;
    var halfW = Math.max(cam.curR * (c.aspect < 1 ? 0.55 : 1.0), cam.curMinW);
    var d = Math.max(halfH / Math.tan(vFov / 2), halfW / Math.tan(hFov / 2));
    var look = _look.copy(cam.curT);
    look.y += cam.curBias * d * Math.tan(vFov / 2);
    c.position.copy(look).addScaledVector(cam.curD, d);
    // 作業場所を移るあいだはカメラを持ち上げ，机や巣箱を突きぬけないようにする
    var travel = cam.curT.distanceTo(cam.target);
    if (travel > 0.02) c.position.y += Math.min(0.55, travel * 0.62);

    if (cam.shake > 0.0005) {
      cam.shakeT += dt;
      var s = cam.shake;
      c.position.x += Math.sin(cam.shakeT * 61) * s;
      c.position.y += Math.sin(cam.shakeT * 47 + 1.3) * s;
      cam.shake *= Math.exp(-6 * dt);
    }
    c.lookAt(look);
    c.updateMatrixWorld();

    var dist = cam.curT.distanceTo(cam.target) + Math.abs(cam.curR - cam.radius) + cam.curD.distanceTo(cam.dir);
    G.camArrived = U.sat(1 - dist / 0.35);
  }

  var _look = new THREE.Vector3();

  /* ---------- 入力ヘルパ ---------- */
  var _ndc = new THREE.Vector2();
  function setRay() {
    _ndc.x = (G.ptr.x / G.w) * 2 - 1;
    _ndc.y = -(G.ptr.y / G.h) * 2 + 1;
    G.ray.setFromCamera(_ndc, G.camera);
  }
  G.pick = function (objs, recursive) {
    setRay();
    var hits = G.ray.intersectObjects(Array.isArray(objs) ? objs : [objs], recursive !== false);
    return hits.length ? hits[0] : null;
  };
  var _plane = new THREE.Plane(), _hit = new THREE.Vector3();
  // 平面と交わる世界座標（normal, point）
  G.rayPlane = function (normal, point, out) {
    setRay();
    _plane.setFromNormalAndCoplanarPoint(normal, point);
    var r = G.ray.ray.intersectPlane(_plane, out || _hit);
    return r;
  };
  G.rayAt = function () { setRay(); return G.ray.ray; };

  /* ---------- HUD ---------- */
  var pips = [];
  function buildHud() {
    var el = document.getElementById('steps');
    for (var i = 0; i < 5; i++) {
      var d = document.createElement('div');
      d.className = 'pip';
      el.appendChild(d);
      pips.push(d);
    }
  }
  G.setPip = function (i) {
    for (var k = 0; k < pips.length; k++) {
      pips[k].className = 'pip' + (k < i ? ' done' : (k === i ? ' now' : ''));
    }
  };
  G.updateJars = function () {
    var n = G.state.jars;
    document.getElementById('jarIcon').style.display = n > 0 ? 'block' : 'none';
    document.getElementById('jarPips').textContent = n > 0 ? '× ' + n : '';
  };

  /* ---------- ステージ管理 ---------- */
  G.go = function (i) {
    if (G.stageObj && G.stageObj.exit) G.stageObj.exit(G);
    G.stage = i;
    G.stageObj = G.stages[i];
    G.setPip(i);
    Hint.clear();
    if (G.stageObj && G.stageObj.enter) G.stageObj.enter(G);
  };
  G.next = function () {
    var i = G.stage + 1;
    if (i >= G.stages.length) i = 0;
    G.go(i);
  };

  /* ---------- 起動 ---------- */
  function boot() {
    var canvas = document.getElementById('gl');
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: false,
        powerPreference: 'high-performance', stencil: false
      });
    } catch (e) {
      document.getElementById('loading').innerHTML =
        '<div style="color:#fff;padding:24px;text-align:center;font-size:16px">' +
        'WebGL をつかえませんでした</div>';
      return;
    }
    renderer.setClearColor(new THREE.Color(0xc3ddea).convertSRGBToLinear(), 1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = false;
    G.renderer = renderer;

    var scene = new THREE.Scene();
    G.scene = scene;
    var camera = new THREE.PerspectiveCamera(46, 1, 0.02, 900);
    G.camera = camera;

    MAT.buildEnv(renderer);

    var lowEnd = (window.devicePixelRatio || 1) < 2 || /iPhone (5|6|7|8)/.test(navigator.userAgent);
    World.build(scene, renderer, lowEnd ? 'low' : 'high');
    World.placeActiveHive(scene);

    // 共有エフェクト
    G.smoke = new FX.Smoke();
    scene.add(G.smoke.mesh);
    G.sparkle = new FX.Sparkle();
    scene.add(G.sparkle.mesh);

    G.ptr = new U.Pointer(canvas);
    G.ptr.on('down', function () { Hint.poke(); SFX.init(); });
    G.ptr.on('move', function () { Hint.poke(); });

    Hint.init(document.getElementById('hint'));
    buildHud();
    G.updateJars();

    // ステージを組み立てる
    G.stages = [
      Stages.smoker, Stages.frames, Stages.uncap, Stages.extract, Stages.bottle
    ];
    G.stages.forEach(function (s) { if (s.build) s.build(G); });

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 260); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

    document.getElementById('loading').classList.add('gone');

    document.getElementById('startBtn').addEventListener('click', function () {
      SFX.init();
      SFX.windLoop(0.5);
      document.getElementById('title').classList.add('gone');
      G.running = true;
      G.go(0);
    });

    // 初期プレビュー（タイトル画面の裏でもゆっくり見えている）
    G.setCam(new THREE.Vector3(0.1, 0.55, 0.2), new THREE.Vector3(0.35, 0.42, 1).normalize(), 0.95, { snap: true });
    G.setPip(0);
    requestAnimationFrame(loop);
  }

  /* ---------- リサイズ（縦横どちらでも） ---------- */
  var perf = { acc: 0, n: 0, scale: 1 };
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    if (window.visualViewport) {
      w = Math.round(window.visualViewport.width);
      h = Math.round(window.visualViewport.height);
    }
    G.w = w; G.h = h;
    G.aspect = w / h;
    var dpr = Math.min(window.devicePixelRatio || 1, 2) * perf.scale;
    G.dpr = dpr;
    G.renderer.setPixelRatio(dpr);
    G.renderer.setSize(w, h, false);
    G.camera.aspect = G.aspect;
    // 縦持ちでは画角を少し広げて，被写体を大きく見せる
    G.camera.fov = G.aspect < 1 ? 52 : 46;
    G.camera.updateProjectionMatrix();
    Hint.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
    if (G.stageObj && G.stageObj.resize) G.stageObj.resize(G);
  }
  G.resize = resize;

  /* ---------- メインループ ---------- */
  var last = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    var now = t * 0.001;
    var dt = last ? Math.min(now - last, 0.05) : 0.016;
    last = now;
    G.dt = dt; G.time += dt;

    G.ptr.tick(dt);

    if (G.stageObj && G.running) G.stageObj.update(G, dt);

    updateCamera(dt);
    World.update(dt, G.time, G.camera);
    G.smoke.update(dt, G.time);
    G.sparkle.update(dt, G.time);

    Hint.update(dt, G.camera, G.running && G.camArrived > 0.55);

    if (G.stageObj && G.stageObj.render) G.stageObj.render(G);
    else G.renderer.render(G.scene, G.camera);
    G.ptr.endFrame();

    // 描画が重いときは解像度を落とす（iPhone 対策）
    perf.acc += dt; perf.n++;
    if (perf.acc > 2.0) {
      var fps = perf.n / perf.acc;
      if (fps < 40 && perf.scale > 0.62) { perf.scale -= 0.12; resize(); }
      else if (fps > 57 && perf.scale < 1) { perf.scale = Math.min(1, perf.scale + 0.06); resize(); }
      perf.acc = 0; perf.n = 0;
    }
  }

  global.G = G;
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 0);
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})(window);
