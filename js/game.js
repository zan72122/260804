/* ------------------------------------------------------------------
   game.js — 3D エンジン（描画・照明・カメラ・入力・案内表示）
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const T = PZ.tex;
  const G = PZ.geo;
  const S = PZ.snd;
  const F = PZ.fx;
  const TAU = U.TAU;

  const AUTO_HELP = 15;
  const GUIDE_DELAY = 1.1;
  const FOV = 38;

  /* カメラの構え：見る点・画面に収める幅(m)・振り角・伏せ角。
     t は縦横共通。tL があれば横画面ではそちらを使う
     （横は「職人 → ピール → 石窯」をひと続きに収めたいので見る点がずれる）。*/
  const CAMS = {
    choose: { t: [-0.34, 0.99, -0.30], frame: [0.80, 1.22], yaw: [5, -8], pitch: [46, 32] },
    bench: { t: [-0.62, 0.965, -0.34], frame: [0.62, 0.70], yaw: [4, -10], pitch: [44, 40] },
    toss: { t: [-0.62, 1.22, -0.34], frame: [1.18, 1.25], yaw: [4, -10], pitch: [28, 26] },
    topping: { t: [-0.62, 0.98, -0.22], frame: [0.86, 1.00], yaw: [4, -10], pitch: [42, 38] },
    oven: {
      t: [0.55, 1.13, -1.15], tL: [0.18, 1.15, -1.24],
      frame: [0.98, 1.74], yaw: [3, -11], pitch: [25, 19]
    },
    bake: { t: [0.55, 1.14, -1.62], frame: [1.02, 1.34], yaw: [2, -6], pitch: [21, 17] },
    serve: { t: [-0.30, 0.98, -0.18], frame: [0.86, 1.02], yaw: [6, -12], pitch: [42, 34] }
  };

  function Game(canvas) {
    this.canvas = canvas;
    this.t = 0;
    this.dpr = 1;
    this.W = 1; this.H = 1;
    this.stage = null; this.stageName = '';
    this.idle = 0; this.autoT = AUTO_HELP; this.guideAlpha = 0;
    this.recipe = PZ.RECIPES[0];
    this.fireLevel = 1;
    this.vBake = 0.42;
    this.shakeAmt = 0;
    this.camPush = 0;
    this.input = { down: false, sx: 0, sy: 0, x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0, dt: 1 / 60, hist: [], moved: false, vsx: 0, vsy: 0 };
    this.queue = [];
    this.pz = { pos: new THREE.Vector3(), scale: 1, flip: 0, v: -1, inOven: false, visible: true };
    this.peel = { visible: false, held: false, v: -1, pos: new THREE.Vector3(), yaw: 0 };
  }
  PZ.Game = Game;

  /* ================================================================
     初期化
  ================================================================ */
  Game.prototype.init = function () {
    const L = PZ.LAY;
    const renderer = this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x0e0805, 1);
    renderer.localClippingEnabled = true;

    const scene = this.scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1c110d, 3.0, 11);

    const camera = this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 40);
    scene.add(camera);

    /* --- 照明 --- */
    const hemi = new THREE.HemisphereLight(0xa89e8e, 0x2a1a10, 0.20);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffeed2, 0.72);
    key.position.set(-2.6, 4.2, 2.6);
    key.target.position.set(-0.1, 0.9, -1.1);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.left = -3.6; key.shadow.camera.right = 3.6;
    key.shadow.camera.top = 3.2; key.shadow.camera.bottom = -3.0;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 15;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.02;
    scene.add(key); scene.add(key.target);
    this.key = key;

    const lamp = new THREE.PointLight(0xffd49a, 1.35, 7.0, 2);
    lamp.position.set(-0.7, 2.5, 0.3);
    scene.add(lamp);
    // 吊り下げランプの実体（コードと笠）
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.20, 0.17, 26, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xe6ddcc, side: THREE.DoubleSide, roughness: 0.55,
        emissive: 0xffd9a0, emissiveIntensity: 0.55
      })
    );
    shade.position.copy(lamp.position).add(new THREE.Vector3(0, 0.10, 0));
    scene.add(shade);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 1.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.9 })
    );
    cord.position.copy(lamp.position).add(new THREE.Vector3(0, 0.68, 0));
    scene.add(cord);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff0c8 })
    );
    bulb.position.copy(lamp.position);
    scene.add(bulb);
    this.lamp = lamp;

    /* --- 空間 --- */
    PZ.scene3.build(scene, renderer);

    /* --- ピザ --- */
    this.pizza = new PZ.Pizza();
    scene.add(this.pizza.group);

    /* --- 炎 --- */
    this.fire = new F.Fire(scene, new THREE.Vector3(L.ovenX + 0.19, L.hearthY + 0.075, L.ovenZ - 0.50));
    // 薪
    const M = PZ.scene3.mats;
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0x140d0a, roughness: 0.95,
      emissive: 0xff4a08, emissiveIntensity: 0.55
    });
    for (let i = 0; i < 4; i++) {
      const lg = new THREE.Mesh(G.log(0.032, 0.30, 40 + i), i === 1 ? emberMat : M.charcoal);
      lg.position.set(L.ovenX + 0.19 + (i - 1.5) * 0.055, L.hearthY + 0.032 + (i % 2) * 0.026, L.ovenZ - 0.50 + (i - 1.5) * 0.05);
      lg.rotation.y = 0.3 + i * 0.6;
      lg.rotation.z = (i % 2 ? 0.08 : -0.06);
      lg.castShadow = true;
      scene.add(lg);
    }

    /* --- 粒子 --- */
    this.pFlour = new F.Particles(scene, { max: 260, rgb: '255,255,255', color: 0xfff6ec, drag: 2.6, gravity: -0.25, grow: 2.2, alpha: 0.55 });
    this.pSmoke = new F.Particles(scene, { max: 120, rgb: '200,190,180', color: 0x8a7c70, drag: 0.6, gravity: 0.32, grow: 3.0, alpha: 0.30, swirl: 0.25 });
    this.pEmber = new F.Particles(scene, { max: 200, rgb: '255,190,90', color: 0xffae4a, drag: 0.9, gravity: 0.55, grow: -0.4, alpha: 1, additive: true, swirl: 0.6 });
    this.pSpark = new F.Particles(scene, { max: 160, rgb: '255,240,180', color: 0xfff0b4, drag: 1.6, gravity: -0.9, grow: -0.3, alpha: 1, additive: true });

    /* --- 案内表示 --- */
    this.buildGuide();

    /* --- 後処理 --- */
    this.post = F.makePost(renderer, 2, 2);
    this.heat = new THREE.Vector4(0.5, 0.5, 0.25, 0);

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.resize();
  };

  /* ================================================================
     案内（3D の輪・矢羽根・手）
  ================================================================ */
  Game.prototype.buildGuide = function () {
    const g = new THREE.Group();
    this.scene.add(g);
    this.guide = g;

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0, depthWrite: false });
    this.gRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.008, 8, 96), ringMat);
    this.gRing.rotation.x = -Math.PI / 2;
    this.gRing.visible = false;
    g.add(this.gRing);

    const dashMat = new THREE.MeshBasicMaterial({
      color: 0xffb45a, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    this.gChevrons = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(G.chevron(0.115, 0.085, 0.030), dashMat.clone());
      m.visible = false;
      m.renderOrder = 5;
      g.add(m);
      this.gChevrons.push(m);
    }

    const handTex = new THREE.CanvasTexture(T.handSprite());
    handTex.encoding = THREE.sRGBEncoding;
    this.gHand = new THREE.Sprite(new THREE.SpriteMaterial({
      map: handTex, transparent: true, opacity: 0, depthWrite: false, depthTest: false
    }));
    this.gHand.scale.set(0.11, 0.11, 1);
    this.gHand.visible = false;
    this.gHand.renderOrder = 900;
    g.add(this.gHand);

    this.gPulse = new THREE.Mesh(new THREE.TorusGeometry(1, 0.01, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    this.gPulse.rotation.x = -Math.PI / 2;
    this.gPulse.visible = false;
    g.add(this.gPulse);
  };

  Game.prototype.hideGuide = function () {
    this.gRing.visible = false;
    this.gHand.visible = false;
    this.gPulse.visible = false;
    for (let i = 0; i < this.gChevrons.length; i++) this.gChevrons[i].visible = false;
  };

  /* 目標の輪（板の上に置く） */
  Game.prototype.showRing = function (x, y, z, r, alpha, hit) {
    const m = this.gRing;
    m.visible = true;
    m.position.set(x, y, z);
    m.scale.set(r, r, 1);
    m.material.opacity = alpha * (hit ? 0.95 : 0.6);
    m.material.color.setHex(hit ? 0xfff0b0 : 0xffffff);
    const p = 1 + Math.sin(this.t * 3.4) * 0.012;
    m.scale.multiplyScalar(p);
  };

  /* 経路に沿った矢羽根 */
  Game.prototype.showChevrons = function (fn, n, alpha, yaw) {
    const list = this.gChevrons;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (i >= n) { m.visible = false; continue; }
      const u = i / Math.max(1, n - 1);
      const p = fn(u);
      m.visible = true;
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = (p.yaw !== undefined ? p.yaw : (yaw || 0));
      const wave = 0.5 + 0.5 * Math.sin(this.t * 3.4 - u * 4.2);
      m.material.opacity = alpha * (0.10 + wave * 0.38);
      const s = p.s || 1;
      m.scale.set(s, s, s);
    }
  };

  Game.prototype.showHand = function (x, y, z, alpha, scale) {
    const h = this.gHand;
    h.visible = true;
    h.position.set(x, y, z);
    h.material.opacity = alpha * 0.85;
    const s = (scale || 1) * 0.10;
    h.scale.set(s, s, 1);
  };

  Game.prototype.showPulse = function (x, y, z, r, alpha) {
    const m = this.gPulse;
    m.visible = true;
    const k = (this.t % 1);
    m.position.set(x, y, z);
    const rr = r * (0.4 + k * 1.1);
    m.scale.set(rr, rr, 1);
    m.material.opacity = alpha * (1 - k) * 0.8;
  };

  /* ================================================================
     画面サイズ
  ================================================================ */
  Game.prototype.resize = function () {
    const w = Math.max(1, Math.round(window.innerWidth));
    const h = Math.max(1, Math.round(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = w; this.H = h; this.dpr = dpr;
    this.land = w >= h;
    this.aspect = w / h;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.post.setSize(Math.round(w * dpr), Math.round(h * dpr));
  };

  /* ================================================================
     カメラ
  ================================================================ */
  Game.prototype.camPreset = function (name) {
    const c = CAMS[name] || CAMS.bench;
    const i = this.land ? 1 : 0;
    const t = (this.land && c.tL) ? c.tL : c.t;
    return {
      tx: t[0], ty: t[1], tz: t[2],
      frame: c.frame[i], yaw: c.yaw[i] * Math.PI / 180, pitch: c.pitch[i] * Math.PI / 180
    };
  };

  Game.prototype.setCam = function (name, instant) {
    this.camTarget = this.camPreset(name);
    if (instant || !this.cam) this.cam = Object.assign({}, this.camTarget);
  };

  Game.prototype.updateCam = function (dt) {
    if (!this.cam) this.setCam('bench', true);
    const c = this.cam, t = this.camTarget;
    const r = 3.0;
    for (const k in t) c[k] = U.approach(c[k], t[k], r, dt);
    const vFov = FOV * Math.PI / 180;
    const fit = Math.min(1, this.aspect);
    const d = (c.frame * (1 - this.camPush * 0.06)) / (2 * Math.tan(vFov / 2) * fit);
    const cy = Math.cos(c.pitch), sy = Math.sin(c.pitch);
    const px = c.tx + Math.sin(c.yaw) * cy * d;
    const py = c.ty + sy * d;
    const pz = c.tz + Math.cos(c.yaw) * cy * d;
    const sh = this.shakeAmt;
    this.camera.position.set(
      px + (sh ? Math.sin(this.t * 47) * sh : 0),
      py + (sh ? Math.cos(this.t * 39) * sh : 0),
      pz);
    this.camera.lookAt(c.tx, c.ty, c.tz);
    this.camera.updateMatrixWorld(true);
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();
  };

  /* ================================================================
     入力（時刻つき点列 → 3D レイ）
  ================================================================ */
  Game.prototype.bindInput = function () {
    const self = this, c = this.canvas, q = this.queue;
    let pid = null;
    function pos(e) {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function push(k, e) {
      const p = pos(e);
      if (q.length > 120) q.shift();
      q.push({ k: k, x: p.x, y: p.y, t: U.now() / 1000 });
    }
    function down(e) {
      if (pid !== null) return;
      pid = e.pointerId === undefined ? 1 : e.pointerId;
      push('d', e); S.unlock();
      if (e.preventDefault) e.preventDefault();
    }
    function move(e) {
      if (pid === null) return;
      if (e.pointerId !== undefined && e.pointerId !== pid) return;
      if (e.getCoalescedEvents) {
        const l = e.getCoalescedEvents();
        if (l && l.length > 1) { for (let i = 0; i < l.length; i++) push('m', l[i]); if (e.preventDefault) e.preventDefault(); return; }
      }
      push('m', e);
      if (e.preventDefault) e.preventDefault();
    }
    function up(e) {
      if (pid === null) return;
      if (e.pointerId !== undefined && e.pointerId !== pid) return;
      push('u', e); pid = null;
      if (e.preventDefault) e.preventDefault();
    }
    if (window.PointerEvent) {
      c.addEventListener('pointerdown', down, { passive: false });
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up, { passive: false });
      window.addEventListener('pointercancel', up, { passive: false });
    } else {
      c.addEventListener('touchstart', function (e) { down(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
      window.addEventListener('touchmove', function (e) { move(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
      window.addEventListener('touchend', function (e) { up(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
      c.addEventListener('mousedown', down);
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  /* 画面座標 → 平面 y=h 上のワールド点 */
  const _plane = new THREE.Plane();
  const _hit = new THREE.Vector3();
  Game.prototype.rayToPlane = function (sx, sy, h) {
    this.ndc.set((sx / this.W) * 2 - 1, -(sy / this.H) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    _plane.set(new THREE.Vector3(0, 1, 0), -h);
    const r = this.raycaster.ray.intersectPlane(_plane, _hit);
    return r ? _hit.clone() : new THREE.Vector3(0, h, 0);
  };

  Game.prototype.rayAt = function (sx, sy) {
    this.ndc.set((sx / this.W) * 2 - 1, -(sy / this.H) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster;
  };

  /* ワールド点 → 画面座標 */
  const _p3 = new THREE.Vector3();
  Game.prototype.toScreen = function (v) {
    _p3.copy(v).project(this.camera);
    return { x: (_p3.x * 0.5 + 0.5) * this.W, y: (-_p3.y * 0.5 + 0.5) * this.H };
  };

  /* ピール経路上で、指にいちばん近い v を返す（画面上での距離で判定） */
  Game.prototype.projectV = function (sx, sy) {
    let best = -1, bd = Infinity;
    for (let i = 0; i <= 64; i++) {
      const v = -1.2 + (i / 64) * 2.2;
      const p = PZ.pathAt(v);
      _p3.set(p.x, p.y, p.z).project(this.camera);
      const px = (_p3.x * 0.5 + 0.5) * this.W, py = (-_p3.y * 0.5 + 0.5) * this.H;
      const d = (px - sx) * (px - sx) + (py - sy) * (py - sy);
      if (d < bd) { bd = d; best = v; }
    }
    for (let i = -6; i <= 6; i++) {
      const v = best + i * 0.006;
      const p = PZ.pathAt(v);
      _p3.set(p.x, p.y, p.z).project(this.camera);
      const px = (_p3.x * 0.5 + 0.5) * this.W, py = (-_p3.y * 0.5 + 0.5) * this.H;
      const d = (px - sx) * (px - sx) + (py - sy) * (py - sy);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  };

  Game.prototype.processInput = function (dt) {
    const i = this.input, st = this.stage, q = this.queue;
    i.dt = dt;
    if (q.length > 24) {
      const keep = [], step = q.length / 20;
      for (let k = 0; k < q.length; k++) {
        if (q[k].k !== 'm' || k === q.length - 1 || Math.floor(k / step) !== Math.floor((k - 1) / step)) keep.push(q[k]);
      }
      q.length = 0; for (let k = 0; k < keep.length; k++) q.push(keep[k]);
    }
    const n = q.length;
    for (let k = 0; k < n; k++) {
      const e = q[k];
      if (e.k === 'd') {
        i.down = true; i.sx = e.x; i.sy = e.y; i.dsx = e.x; i.dsy = e.y;
        i.lastT = e.t; i.moved = false;
        i.hist.length = 0; i.hist.push({ t: e.t, x: e.x, y: e.y });
        i.vsx = i.vsy = 0;
        this.wake();
        if (st && st.down) st.down(this);
      } else if (e.k === 'm') {
        if (!i.down) continue;
        const sdt = U.clamp(e.t - (i.lastT || e.t), 0.001, 0.1);
        i.lastT = e.t; i.dt = sdt;
        i.psx = i.sx; i.psy = i.sy;
        i.sx = e.x; i.sy = e.y;
        i.vsx = (i.sx - i.psx) / sdt; i.vsy = (i.sy - i.psy) / sdt;
        i.hist.push({ t: e.t, x: e.x, y: e.y });
        while (i.hist.length > 24) i.hist.shift();
        if (Math.abs(i.sx - i.psx) > 0.3 || Math.abs(i.sy - i.psy) > 0.3) i.moved = true;
        if (st && st.move) st.move(this);
      } else {
        if (!i.down) continue;
        i.sx = e.x; i.sy = e.y;
        let ref = i.hist[0];
        for (let m = i.hist.length - 1; m >= 0; m--) {
          if (e.t - i.hist[m].t >= 0.13) { ref = i.hist[m]; break; }
          ref = i.hist[m];
        }
        const el = Math.max(0.016, e.t - ref.t);
        i.vsx = (i.sx - ref.x) / el; i.vsy = (i.sy - ref.y) / el;
        i.dt = dt;
        if (st && st.up) st.up(this);
        i.down = false; i.vsx = i.vsy = 0;
      }
    }
    q.length = 0;
    i.dt = dt;
  };

  /* ================================================================
     ステージ
  ================================================================ */
  Game.prototype.setStage = function (name) {
    if (this.stage && this.stage.exit) this.stage.exit(this);
    this.stage = PZ.stages[name];
    this.stageName = name;
    this.pz.flip = 0;
    this.pz.scale = 1;
    this.hideGuide();
    this.wake();
    if (this.stage.enter) this.stage.enter(this);
    this.setCam(this.stage.cam || 'bench', false);
  };
  Game.prototype.wake = function () { this.idle = 0; this.autoT = AUTO_HELP; };
  Game.prototype.shake = function (a) { this.shakeAmt = Math.max(this.shakeAmt, a); };

  /* ================================================================
     毎フレーム
  ================================================================ */
  Game.prototype.update = function (dt) {
    this.t += dt;
    this.fireLevel = 1;
    this.pz.visible = true;
    this.pz.inOven = false;
    this.peel.visible = false;
    this.peel.held = false;
    this.hideGuide();

    this.updateCam(dt);
    this.scene.updateMatrixWorld();   // 入力の当たり判定を今の姿勢で行う
    this.processInput(dt);
    if (this.stage && this.stage.update) this.stage.update(this, dt);

    // ピザの姿勢
    const p = this.pizza;
    p.group.visible = this.pz.visible;
    p.group.position.copy(this.pz.pos);
    p.group.scale.setScalar(this.pz.scale);
    p.group.rotation.set(this.pz.flip * TAU, -p.rot, 0);
    p.updateToppings(dt);
    p.sync();

    // ピール
    const peel = PZ.scene3.peel;
    peel.visible = this.peel.visible;
    if (this.peel.visible) {
      peel.position.copy(this.peel.pos);
      peel.rotation.set(this.peel.pitch || 0, this.peel.yaw || 0, 0);
    }

    // 職人
    this.updateChef(dt);

    // 炎
    this.fire.update(dt, this.fireLevel);

    // 粒子
    this.pFlour.update(dt); this.pSmoke.update(dt);
    this.pEmber.update(dt); this.pSpark.update(dt);
    if (U.chance(dt * 26 * this.fireLevel)) {
      const f = this.fire.group.position;
      this.pEmber.spawn(
        f.x + U.rand(-0.12, 0.12), f.y + 0.06, f.z + U.rand(-0.08, 0.08),
        U.rand(-0.10, 0.10), U.rand(0.30, 0.72), U.rand(-0.08, 0.08),
        U.rand(0.5, 1.1), U.rand(0.005, 0.012));
    }

    // 案内の濃さ
    this.idle += dt;
    this.guideAlpha = U.approach(this.guideAlpha, this.idle > GUIDE_DELAY ? 1 : 0,
      this.idle > GUIDE_DELAY ? 2.2 : 9, dt);
    if (this.input.down) this.guideAlpha = U.approach(this.guideAlpha, 0.2, 8, dt);
    if (this.guideAlpha > 0.02 && this.stage && this.stage.guide) this.stage.guide(this, this.guideAlpha);
    else this.hideGuide();

    this.autoT -= dt;
    if (this.autoT <= 0 && this.stage && this.stage.auto) {
      this.stage.auto(this);
      if (this.autoT <= 0) this.autoT = AUTO_HELP;
    }

    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 0.09);
    this.camPush = Math.max(0, this.camPush - dt * 1.4);

    // 熱のゆらぎの範囲（窯口を画面へ投影）
    const L = PZ.LAY;
    const mouth = this.toScreen(new THREE.Vector3(L.ovenX, L.hearthY + L.mouthH * 0.5, L.faceZ - 0.05));
    const edge = this.toScreen(new THREE.Vector3(L.ovenX + L.mouthW * 0.75, L.hearthY + L.mouthH * 0.5, L.faceZ - 0.05));
    const rad = Math.abs(edge.x - mouth.x) / this.W;
    this.heat.set(mouth.x / this.W, 1 - mouth.y / this.H, Math.max(0.05, rad * 1.5), 0.85 * this.fireLevel);

    S.fireLevel(this.fireLevel * 0.9);
    S.updateMusic(dt);
  };

  /* 職人：ピールを操るのはプレイヤー自身なので、職人はそれを握らない。
     ふだんは作業台の向こう側に立って手を台に置き、窯を使うあいだは
     そちらへ体を向けて見守る。カット（chefHand）のときだけ手を出す。   */
  const _hp = new THREE.Vector3(), _hq = new THREE.Vector3();
  Game.prototype.updateChef = function (dt) {
    const ch = PZ.scene3.chef;
    const L = PZ.LAY;
    let targetX = L.chefX, targetZ = L.chefZ, rotY = 0.28;
    let hR = null, hL = null;

    if (this.chefHand) {
      // 手が届く位置まで寄る（腕が伸びきらないように）
      targetX = U.clamp(this.chefHand.x - 0.30, L.chefX - 0.15, L.chefX + 0.80);
      targetZ = U.clamp(this.chefHand.z + 0.42, L.chefZ - 0.20, L.chefZ + 0.34);
      rotY = 0.20;
    } else if (this.peel.visible) {
      // 窯を使っているあいだは、少し窯側へ寄って体をひねる
      targetX = L.chefX + 0.16;
      targetZ = L.chefZ - 0.06;
      rotY = -0.30;
    }
    ch.group.position.x = U.approach(ch.group.position.x, targetX, 3.0, dt);
    ch.group.position.z = U.approach(ch.group.position.z, targetZ, 3.0, dt);
    ch.group.rotation.y = U.approach(ch.group.rotation.y, rotY, 3.0, dt);
    ch.group.updateMatrixWorld(true);

    const br = Math.sin(this.t * 1.3) * 0.014;         // 呼吸
    if (this.chefHand) {
      hR = this.chefHand;
      hL = _hq.copy(ch.group.position).add(new THREE.Vector3(-0.27, 0.95 + br, 0.30)).clone();
    } else {
      // 台の縁に手を置いて待つ
      const y = L.counterY + 0.03;
      hR = _hp.copy(ch.group.position).add(new THREE.Vector3(0.235, 0, 0.34)).setY(y + br).clone();
      hL = _hq.copy(ch.group.position).add(new THREE.Vector3(-0.235, 0, 0.34)).setY(y - br).clone();
    }
    PZ.scene3.solveArm(ch, ch.armR, ch.shoulderR, hR, 1);
    PZ.scene3.solveArm(ch, ch.armL, ch.shoulderL, hL, -1);
  };

  /* ================================================================
     描画
  ================================================================ */
  Game.prototype.render = function (dt) {
    this.post.render(this.renderer, this.scene, this.camera, dt, this.heat, this.aspect);
  };

  /* ================================================================
     起動
  ================================================================ */
  Game.prototype.start = function () {
    const self = this;
    this.init();
    this.bindInput();
    this.setStage('CHOOSE');
    this.setCam('choose', true);
    let last = U.now();
    function loop(now) {
      const t = now === undefined ? U.now() : now;
      let dt = (t - last) / 1000; last = t;
      if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
      if (!self.paused) { self.update(dt); }
      self.render(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    window.addEventListener('resize', function () { self.resize(); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { self.resize(); }, 150); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () { self.resize(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) last = U.now(); });
  };

  function boot() {
    const g = new Game(document.getElementById('game'));
    window.PZ.game = g;
    g.start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
