/* ============================================================
 *  game.js — 進行・カメラ・演出
 *
 *  掘進フェーズ … 地下断面（カットモデル）を外から見る
 *  組立フェーズ … トンネル内部からリングを正面に見る
 *  この視点切替が「TBM である」ことを一目で伝える鍵。
 * ============================================================ */
import * as THREE from 'three';
import * as C from './config.js';
import { buildMaterials, buildTBM } from './tbm.js';
import { Geology, Rings, Muck, Particles, makeParticleTextures } from './world.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapDeg = (d) => ((d + 180) % 360 + 360) % 360 - 180;

/* カメラの構図 */
const FRAMES = {
  // 断面：機械ぜんたい＋前方の切羽＋後方のリングが一度に見える引き
  sec_land: { p: [-25.0, 7.5, -1.5], t: [0.0, -0.4, 4.5], fov: 46 },
  sec_port: { p: [-17.0, 9.0, -16.0], t: [0.0, -0.9, 5.0], fov: 58 },
  // 掘進 前半：カッターヘッドを斜め前から見て「岩を食べる」ところを見せる
  drillA_land: { p: [-8.0, 3.4, 2.6], t: [0.1, 0.2, 11.3], fov: 44 },
  drillA_port: { p: [-7.0, 4.4, -0.6], t: [0.0, 0.1, 11.3], fov: 56 },
  // 掘進 後半：横へ回り込み、土砂がコンベアで後方へ流れるのを見せる
  drillB_land: { p: [-17.5, 3.2, 2.0], t: [0.0, -1.2, 6.4], fov: 48 },
  drillB_port: { p: [-13.0, 4.6, -3.0], t: [0.0, -1.0, 6.4], fov: 60 },
  // 坑内：組立中のリングを正面に据える
  tun_land: { p: [-1.55, 1.35, -12.9], t: [0.0, 0.15, -0.75], fov: 42 },
  tun_port: { p: [-1.20, 1.15, -11.4], t: [0.0, 0.15, -0.75], fov: 56 },
};

export class Game {
  constructor(canvasEl) {
    this.canvasEl = canvasEl;
    this.audio = new Audio();

    /* ---------- レンダラ ---------- */
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasEl, antialias: true, powerPreference: 'high-performance',
      alpha: false, stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    /* ---------- シーン ---------- */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07080a);
    this.fog = new THREE.FogExp2(0x0a0a0c, 0.0215);
    scene.fog = this.fog;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.25, 900);
    scene.add(this.camera);

    /* ---------- 光 ----------
       坑内は本来まっくら。作業灯だけが頼り、という照明設計にする。 */
    this.hemi = new THREE.HemisphereLight(0x46566a, 0x171009, 0.5);
    scene.add(this.hemi);

    // 断面から差し込む「見せるための」補助光（手前＝カメラ側から）
    const key = new THREE.DirectionalLight(0xc4d6ea, 0.9);
    key.position.set(-30, 18, -8);
    scene.add(key, key.target);
    this.keyLight = key;
    const rim = new THREE.DirectionalLight(0x8fb2d8, 0.55);
    rim.position.set(16, -10, -14);
    scene.add(rim, rim.target);
    this.rimLight = rim;

    // 切羽を照らす作業灯（影あり）
    this.workSpot = new THREE.SpotLight(0xffe0b0, 70, 46, 0.85, 0.5, 1.7);
    this.workSpot.castShadow = true;
    this.workSpot.shadow.mapSize.set(1024, 1024);
    this.workSpot.shadow.camera.near = 1;
    this.workSpot.shadow.camera.far = 46;
    this.workSpot.shadow.bias = -0.0022;
    scene.add(this.workSpot, this.workSpot.target);

    this.headLight = new THREE.PointLight(0xffcf94, 30, 30, 1.8);
    scene.add(this.headLight);
    this.midLight = new THREE.PointLight(0xffe3bc, 26, 26, 1.8);
    scene.add(this.midLight);
    this.ringLight = new THREE.PointLight(0xfff0d2, 24, 24, 1.8);
    scene.add(this.ringLight);
    this.tailLight = new THREE.PointLight(0xffd9a8, 24, 34, 1.8);
    scene.add(this.tailLight);
    this.celebrate = new THREE.PointLight(0xfff2ff, 0, 46, 1.6);
    scene.add(this.celebrate);

    // 切羽とカッターヘッドを手前側から照らす（断面ならではの「見せ光」）
    this.faceLight = new THREE.PointLight(0xffdcaa, 26, 26, 1.7);
    scene.add(this.faceLight);
    // 掘削チャンバの中。カッターヘッドの開口ごしに切羽を見せるための灯り。
    this.chamberLight = new THREE.PointLight(0xffd0a0, 30, 20, 1.7);
    scene.add(this.chamberLight);

    // 組立中リングを主役にするスポット（カメラ側から当てる）
    this.ringSpot = new THREE.SpotLight(0xfff4e0, 0, 30, 0.46, 0.6, 1.5);
    scene.add(this.ringSpot, this.ringSpot.target);

    // トンネル内の照明（引きの演出で灯を並べる）
    this.tunnelLights = [];
    for (let i = 0; i < 5; i++) {
      const l = new THREE.PointLight(0xffca80, 0, 30, 1.8);
      scene.add(l); this.tunnelLights.push(l);
    }

    /* ---------- 世界 ---------- */
    this.M = buildMaterials();
    this.geo = new Geology(scene);
    this.rings = new Rings(scene);
    // 断面表示のときは覆工リングも手前を切り欠き、坑内を見通せるようにする
    for (const m of [this.rings.concrete, this.rings.markMat,
      this.rings.groutMesh.material, this.rings.lampMesh.material]) {
      m.clippingPlanes = [this.geo.clip];
      m.clipShadows = true;
    }

    this.tbm = buildTBM(this.M);
    scene.add(this.tbm.root);
    this.tbm.root.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    const pt = makeParticleTextures();
    this.muck = new Muck(this.tbm.root, 130);
    this.dust = new Particles(this.tbm.root, { count: 240, size: 0.85, tex: pt.dust, color: 0xd6c3a4, opacity: 0.45 });
    this.spark = new Particles(this.tbm.root, { count: 140, size: 0.42, tex: pt.glow, color: 0xbfe9ff, opacity: 0.9 });

    /* 組立中リングのグループ（機械には従属しない：地山に固定） */
    this.ringGroup = new THREE.Group();
    scene.add(this.ringGroup);

    // 「ここに組む」を示す光の輪
    this.buildGuide = new THREE.Mesh(
      new THREE.TorusGeometry(C.SEG_RI - 0.05, 0.045, 8, 96),
      new THREE.MeshBasicMaterial({
        color: 0x8fe8ff, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    this.buildGuide.visible = false;
    this.ringGroup.add(this.buildGuide);

    // リング完成の瞬間に円全体を光らせる輪
    this.doneRing = new THREE.Mesh(
      new THREE.TorusGeometry((C.SEG_RI + C.SEG_RO) / 2, 0.30, 10, 96),
      new THREE.MeshBasicMaterial({
        color: 0xfff0c0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
    this.doneRing.visible = false;
    this.ringGroup.add(this.doneRing);

    /* ---------- 状態 ---------- */
    this.machineZ = 0;
    this.spin = 0;              // カッターヘッド回転量 0..1
    this.spinAngle = 0;
    this.cutterPhase = 0;
    this.digging = false;
    this.jackExt = 0;           // ジャッキ伸び 0..RING_W
    this.strokeZ0 = 0;
    this.ringsBuilt = 0;
    this.ringIndex = 0;
    this.state = 'title';
    this.timer = 0;
    this.idle = 0;
    this.muckAcc = 0;
    this.erectorAngle = 270 * D2R;
    this.erectorR = C.SEG_RI + C.ERECTOR_HOLD_DR - 0.14;
    this.pieces = [];
    this.pieceIdx = 0;
    this.placed = [];
    this.held = null;
    this.ghost = null;
    this.wipe = 0;
    this.camMode = 'sec';
    this.pendingMode = 'sec';
    this.revealT = 0;
    this.pointerAngle = null;
    this.dragging = false;
    this.stratum = C.STRATA[2];

    this.camPos = new THREE.Vector3();
    this.camTgt = new THREE.Vector3();
    this.camFov = 45;

    this.ui = new UI(this);
    this._initPresetRings();
    this._bindPointer();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));

    this._applyFrame(true);
    this.ui.setRings(0, C.RINGS_PER_REVEAL);
    this.ui.setDepth(0);
  }

  /* ---------------- 初期リング ---------------- */
  _makePieceMesh(spec, markIdx, material) {
    const geo = spec.key ? this.rings.geoKey : this.rings.geoStd;
    const mesh = new THREE.Mesh(geo, material);
    const mark = this.rings.makeMark(markIdx);
    mesh.add(mark);
    return { mesh, mark };
  }

  _initPresetRings() {
    for (let i = 0; i < C.PRESET_RINGS; i++) {
      const zc = -C.RING_W / 2 - i * C.RING_W;
      const idx = -1 - i;
      const pieces = C.ringAngles(idx).map((s, k) => {
        const p = this._makePieceMesh(s, (k + i) % 4, this.rings.concrete);
        p.mesh.rotation.z = s.angle * D2R;
        return p;
      });
      this.rings.addCompleted(idx, zc, pieces);
    }
    this.geo.tunnelStart = -C.PRESET_RINGS * C.RING_W - 34;
  }

  /* ---------------- 入力 ---------------- */
  _bindPointer() {
    const el = this.canvasEl;
    const ndc = new THREE.Vector2();
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane();
    const hit = new THREE.Vector3();

    const toAngle = (e) => {
      const r = el.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, this.camera);
      const zc = this.machineZ + C.RING_ZC;
      plane.set(new THREE.Vector3(0, 0, 1), -zc);
      const d = ray.ray.direction.z;
      if (Math.abs(d) < 0.15) return null;
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      const rr = Math.hypot(hit.x, hit.y);
      if (rr < 0.35) return null;
      return Math.atan2(hit.y, hit.x);
    };

    const down = (e) => {
      e.preventDefault();
      this.idle = 0;
      this.audio.resume();
      this.dragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.dragMoved = 0;
      if (this.state === 'drill') this.setDigging(true);
      if (this.state === 'erectMove') {
        const a = toAngle(e);
        if (a !== null) this.pointerAngle = a;
      }
    };
    const move = (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      this.idle = 0;
      this.dragMoved += Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y);
      if (this.state === 'erectMove') {
        const a = toAngle(e);
        if (a !== null) this.pointerAngle = a;
      }
      if (this.state === 'keyPush') {
        const dy = this.dragStart.y - e.clientY;
        const dist = Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y);
        if (dy > 34 || dist > 74) this.pushKey();
      }
    };
    const up = (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      this.dragging = false;
      this.pointerAngle = null;
      if (this.state === 'drill') this.setDigging(false);
      if (this.state === 'keyPush' && this.dragMoved > 26) this.pushKey();
    };

    el.addEventListener('pointerdown', down, { passive: false });
    el.addEventListener('pointermove', move, { passive: false });
    el.addEventListener('pointerup', up, { passive: false });
    el.addEventListener('pointercancel', up, { passive: false });
    el.addEventListener('pointerleave', up, { passive: false });
  }

  /* ---------------- UI コールバック ---------------- */
  start() {
    this.audio.resume();
    this.setState('idle');
  }
  onLever(v) {
    this.audio.resume();
    if (this.state === 'idle') this.spin = Math.max(this.spin, v * 0.55);
  }
  onLeverDone() {
    if (this.state !== 'idle') return;
    this.audio.spinUp();
    this.audio.horn();
    this.setState('spinup');
  }
  onJack(v) {
    if (this.state !== 'retract') return;
    this.jackExt = C.RING_W * (1 - v);
    if (v > 0.02 && !this._hissed) { this._hissed = true; this.audio.hiss(1.0, 0.16); }
  }
  onJackDone() {
    if (this.state !== 'retract') return;
    this.jackExt = 0;
    this.audio.hiss(0.5, 0.12);
    this.setState('erectPick');
  }
  setDigging(on) {
    if (this.state !== 'drill') { this.digging = false; return; }
    this.digging = on;
    if (on) this.idle = 0;
  }
  pushKey() {
    if (this.state !== 'keyPush') return;
    this.setState('keySeat');
  }
  continueAfterReveal() {
    this.setState('drill');
  }

  /* ---------------- 状態遷移 ---------------- */
  setState(s) {
    this.state = s;
    this.timer = 0;
    this.idle = 0;
    const ui = this.ui;

    switch (s) {
      case 'idle':
        ui.resetLever();
        ui.setControls({ lever: true });
        ui.setCoach('レバーを うえに ひっぱって、カッターヘッドを まわそう！', 'up');
        this.pendingMode = 'sec';
        break;
      case 'spinup':
        ui.setControls({});
        ui.setCoach('ゴゴゴゴ……　おおきな カッターヘッドが まわりだした！', 'none');
        this.pendingMode = 'sec';
        break;
      case 'drill':
        this.strokeZ0 = this.machineZ;
        this.jackExt = 0;
        this.stratum = C.STRATA[(this.ringIndex + 2) % C.STRATA.length];
        this.geo.setStratum(this.stratum);
        ui.setControls({ pedal: true });
        ui.setCoach('ボタンを ながおしして、いわを ほりすすもう！', 'hold');
        this.pendingMode = 'drill';
        break;
      case 'strokeEnd':
        this.digging = false;
        ui.setControls({});
        ui.setCoach('１リングぶん ほれた！　ジャッキを もどそう', 'none');
        this.pendingMode = 'sec';
        this._hissed = false;
        break;
      case 'retract':
        ui.resetJack();
        ui.setControls({ jack: true });
        ui.setCoach('ハンドルを したに さげて、ジャッキを ひっこめて！', 'down');
        this.pendingMode = 'sec';
        break;
      case 'erectPick': {
        ui.setControls({});
        this.pendingMode = 'tun';
        const spec = this._startPiece();
        if (spec.key) { this.setState('keyPrep'); return; }
        ui.setCoach('エレクターが おおきな セグメントを もちあげるよ', 'none');
        break;
      }
      case 'erectMove':
        ui.setControls({});
        ui.setCoach('ゆびで ぐるっと まわして、ひかる ばしょへ！', 'circle');
        this.pendingMode = 'tun';
        break;
      case 'erectSeat':
        ui.setControls({});
        this.pendingMode = 'tun';
        break;
      case 'keyPrep':
        ui.setControls({});
        ui.setCoach('さいごの キーセグメント！', 'none');
        this.pendingMode = 'tun';
        break;
      case 'keyPush':
        ui.setControls({ push: true });
        ui.setCoach('ぐいっと おしこんで！', 'push');
        this.pendingMode = 'tun';
        break;
      case 'keySeat':
        ui.setControls({});
        this.pendingMode = 'tun';
        break;
      case 'ringDone':
        ui.setControls({});
        ui.setCoach('カコン！　リングが かんせい！', 'none');
        this.pendingMode = 'tun';
        break;
      case 'reveal':
        ui.setControls({});
        ui.setCoach('', 'none');
        this.pendingMode = 'tun';
        this.revealT = 0;
        break;
    }
  }

  /* ---------------- セグメント生成 ---------------- */
  _startPiece() {
    if (this.pieceIdx === 0) this.pieces = C.buildOrder(this.ringIndex);
    const spec = this.pieces[this.pieceIdx];
    const { mesh, mark } = this._makePieceMesh(
      spec, (this.pieceIdx + this.ringIndex) % 4, this.rings.heldMat);
    this.ringGroup.add(mesh);
    this.held = {
      spec, mesh, mark,
      angle: spec.key ? spec.angle * D2R : 270 * D2R,
      dr: spec.key ? 0 : C.ERECTOR_HOLD_DR,
      zOff: spec.key ? -1.85 : 0,
      lift: spec.key ? 1 : 0,
    };

    // ゴースト（目標位置を光らせる）
    if (this.ghost) this.ringGroup.remove(this.ghost);
    const g = new THREE.Mesh(spec.key ? this.rings.geoKey : this.rings.geoStd,
      this.rings.ghostMat);
    g.rotation.z = spec.angle * D2R;
    this.ringGroup.add(g);
    this.ghost = g;

    this.pickT = spec.key ? 1 : 0;
    this.audio.hiss(0.6, 0.10);
    return spec;
  }

  _placePiece() {
    const h = this.held;
    h.mesh.material = this.rings.freshMat;
    h.mesh.position.set(0, 0, 0);
    h.mesh.rotation.z = h.spec.angle * D2R;
    this.placed.push({ mesh: h.mesh, mark: h.mark });
    this.held = null;
    this.pieceIdx++;
    if (this.ghost) { this.ringGroup.remove(this.ghost); this.ghost = null; }
  }

  _completeRing() {
    const zc = this.machineZ + C.RING_ZC;
    this.rings.addCompleted(this.ringIndex, zc, this.placed);
    for (const p of this.placed) this.ringGroup.remove(p.mesh);
    this.placed = [];
    this.pieceIdx = 0;
    this.ringIndex++;
    this.ringsBuilt++;
    this.ui.setRings(this.ringsBuilt, C.RINGS_PER_REVEAL);
  }

  /* ---------------- 画面サイズ ---------------- */
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.camera.aspect = w / h;
    this.portrait = h > w;
    this.ui.setOrientation(this.portrait);
    this._applyFrame(true);
    this.camera.updateProjectionMatrix();
  }

  _frameFor(mode) {
    const p = this.portrait;
    if (mode === 'tun') return p ? FRAMES.tun_port : FRAMES.tun_land;
    if (mode === 'drill') {
      const A = p ? FRAMES.drillA_port : FRAMES.drillA_land;
      const B = p ? FRAMES.drillB_port : FRAMES.drillB_land;
      // ストロークの進み具合で前寄り→横寄りへゆっくり回り込む
      const u = clamp(this.jackExt / C.RING_W, 0, 1);
      const e = u * u * (3 - 2 * u);
      const mix = (a, b) => a.map((v, i) => v + (b[i] - v) * e);
      return { p: mix(A.p, B.p), t: mix(A.t, B.t), fov: A.fov + (B.fov - A.fov) * e };
    }
    return p ? FRAMES.sec_port : FRAMES.sec_land;
  }

  _applyFrame(snap = false) {
    const f = this._frameFor(this.camMode);
    const mz = this.machineZ;
    const p = new THREE.Vector3(f.p[0], f.p[1], f.p[2] + mz);
    const t = new THREE.Vector3(f.t[0], f.t[1], f.t[2] + mz);
    if (snap) {
      this.camPos.copy(p); this.camTgt.copy(t); this.camFov = f.fov;
      this.camera.position.copy(p);
      this.camera.lookAt(t);
      this.camera.fov = f.fov;
      this.camera.updateProjectionMatrix();
    }
    return { p, t, fov: f.fov };
  }

  /* ---------------- ループ ---------------- */
  update(dt) {
    dt = Math.min(dt, 0.05);
    this.timer += dt;
    this.idle += dt;
    const st = this.state;

    /* ---- カッターヘッド回転 ---- */
    let targetSpin = 0;
    if (st === 'title' || st === 'idle') targetSpin = this.spin;
    else if (st === 'drill') targetSpin = this.digging ? 1.0 : 0.72;
    else if (st === 'spinup') targetSpin = 1.0;
    else targetSpin = 0.55;
    this.spin += (targetSpin - this.spin) * (1 - Math.exp(-dt / 0.85));
    const rate = 0.62 * this.spin;
    this.spinAngle += rate * dt;
    this.cutterPhase += rate * dt * 3.4;
    this.tbm.head.group.rotation.z = this.spinAngle;
    if (this.spin > 0.02) this.tbm.head.writeCutters(this.cutterPhase);
    this.audio.setCutter(this.spin, this.digging && st === 'drill');

    /* ---- 状態ごとの処理 ---- */
    if (st === 'spinup' && this.timer > 2.4) this.setState('drill');

    if (st === 'drill') {
      if (this.digging) {
        const rateM = 0.30 * (1.32 - 0.42 * this.stratum.hard);
        const d = rateM * dt;
        this.machineZ += d;
        this.jackExt = clamp(this.machineZ - this.strokeZ0, 0, C.RING_W);
        this.ui.setDepth(this.machineZ);
        // 土砂の発生
        this.muckAcc += d * 46;
        while (this.muckAcc >= 1) {
          this.muckAcc -= 1;
          this.muck.spawn(C.HEAD_Z, this.stratum.muck, this.stratum.hard);
        }
        // 粉じん・破片
        if (Math.random() < dt * 34) {
          const a = Math.random() * 6.28, r = 0.8 + Math.random() * 3.2;
          this.dust.emit(Math.cos(a) * r, Math.sin(a) * r, C.HEAD_Z - 0.4, 0.7,
            new THREE.Vector3(-Math.cos(a) * 0.5, -Math.sin(a) * 0.5 - 0.5, -1.4), 1.5);
        }
        if (this.stratum.sparkle > 0 && Math.random() < dt * 30 * this.stratum.sparkle) {
          const a = Math.random() * 6.28, r = 0.8 + Math.random() * 3.2;
          this.spark.emit(Math.cos(a) * r, Math.sin(a) * r, C.HEAD_Z - 0.2, 0.5,
            new THREE.Vector3(0, -0.4, -0.9), 1.1);
        }
        if (Math.random() < dt * 5) this.audio.rockDrop();
        if (this.jackExt >= C.RING_W - 1e-4) {
          this.machineZ = this.strokeZ0 + C.RING_W;
          this.jackExt = C.RING_W;
          this.setState('strokeEnd');
        }
      }
      if (this.idle > 9) this.ui.setCoach('ボタンを ながおし！　どんどん ほれるよ', 'hold');
    }

    if (st === 'strokeEnd' && this.timer > 1.5) this.setState('retract');

    /* ---- エレクターとセグメント ---- */
    if (st === 'erectPick') {
      this.pickT = Math.min(1, this.pickT + dt / 1.5);
      const h = this.held;
      if (h) {
        const e = this.pickT * this.pickT * (3 - 2 * this.pickT);
        // 供給台（下部）から把持位置へ持ち上がる
        const a0 = 270 * D2R;
        this.erectorAngle = a0;
        h.angle = a0;
        h.lift = e;
      }
      if (this.pickT >= 1) {
        this.audio.clunk(1.5);
        this.setState('erectMove');
      }
    }

    if (st === 'erectMove') {
      const h = this.held;
      const target = h.spec.angle * D2R;
      if (this.pointerAngle !== null) {
        let d = wrapDeg((this.pointerAngle - h.angle) * R2D) * D2R;
        h.angle += d * (1 - Math.exp(-dt / 0.09));
      } else if (this.idle > 14) {
        // 迷ったら自動で寄せる（4 歳児が詰まらないように）
        let d = wrapDeg((target - h.angle) * R2D) * D2R;
        h.angle += d * (1 - Math.exp(-dt / 0.6));
        this.ui.setCoach('ここだよ！　ひかる ばしょへ', 'circle');
      }
      this.erectorAngle = h.angle;
      const diff = Math.abs(wrapDeg((target - h.angle) * R2D));
      if (this.ghost) {
        const near = diff < 24;
        const pulse = 0.22 + 0.16 * Math.sin(this.timer * 6);
        this.rings.ghostMat.opacity = near ? 0.55 + 0.2 * Math.sin(this.timer * 14) : pulse;
        this.rings.ghostMat.emissiveIntensity = near ? 2.0 : 0.9;
      }
      if (diff < 24) {
        this.audio.snap();
        this.seatFrom = h.angle;
        this.setState('erectSeat');
      }
    }

    if (st === 'erectSeat') {
      const h = this.held;
      const k = Math.min(1, this.timer / 0.5);
      const e = 1 - Math.pow(1 - k, 3);
      const target = h.spec.angle * D2R;
      let d = wrapDeg((target - this.seatFrom) * R2D) * D2R;
      h.angle = this.seatFrom + d * e;
      h.dr = C.ERECTOR_HOLD_DR * (1 - e);
      this.erectorAngle = h.angle;
      if (k >= 1) {
        this.audio.clunk(0.85 + Math.random() * 0.2);
        this.ui.doFlash(240);
        const a = target;
        for (let i = 0; i < 8; i++) {
          this.dust.emit(Math.cos(a) * C.SEG_RI, Math.sin(a) * C.SEG_RI, C.RING_ZC,
            0.9, new THREE.Vector3(-Math.cos(a) * 0.4, -Math.sin(a) * 0.4 - 0.2, 0), 1.1);
        }
        this._placePiece();
        this.setState('erectPick');
      }
    }

    if (st === 'keyPrep' && this.timer > 1.1) this.setState('keyPush');

    if (st === 'keyPush') {
      const h = this.held;
      h.zOff = -1.85 + Math.sin(this.timer * 3) * 0.06;
      this.erectorAngle = h.angle;
      if (this.idle > 16) { this.pushKey(); }
    }

    if (st === 'keySeat') {
      const h = this.held;
      const k = Math.min(1, this.timer / 0.55);
      const e = 1 - Math.pow(1 - k, 4);
      h.zOff = -1.85 * (1 - e);
      this.erectorAngle = h.angle;
      if (k >= 1) {
        this.audio.clunk(0.62);
        this._placePiece();
        this._completeRing();
        this.audio.fanfare();
        this.ui.doFlash(1000);
        this.celebrate.position.set(0, 0, this.machineZ + C.RING_ZC);
        this.celebrate.intensity = 55;
        this.doneRing.visible = true;
        this.doneRing.material.opacity = 0.95;
        this.doneRing.scale.set(1, 1, 1);
        this.setState('ringDone');
      }
    }

    if (st === 'ringDone') {
      this.celebrate.intensity = Math.max(0, 55 * (1 - this.timer / 1.5));
      if (this.timer > 1.9) {
        if (this.ringsBuilt % C.RINGS_PER_REVEAL === 0) this.setState('reveal');
        else this.setState('drill');
      }
    }

    if (st === 'reveal') {
      this.revealT += dt;
      if (this.revealT > 3.2 && !this.bannerShown) {
        this.bannerShown = true;
        this.ui.showBanner(
          `${this.ringsBuilt} リング かんせい！<br><b>${(this.machineZ).toFixed(1)} メートル</b> ほれたよ`);
      }
    } else {
      this.bannerShown = false;
    }

    /* ---- 組立ガイド／完成の輪 ---- */
    const building = ['erectPick', 'erectMove', 'erectSeat', 'keyPrep', 'keyPush', 'keySeat']
      .includes(st);
    this.buildGuide.visible = building;
    if (building) {
      this.buildGuide.material.opacity = 0.36 + 0.22 * Math.sin(this.timer * 4.5);
    }
    if (this.doneRing.visible) {
      const k = this.timer / 1.5;
      this.doneRing.material.opacity = Math.max(0, 0.95 * (1 - k) ** 1.4);
      const sc = 1 + 0.16 * (1 - (1 - Math.min(1, k * 1.6)) ** 2);
      this.doneRing.scale.set(sc, sc, 1 + 5 * Math.min(1, k));
      if (k >= 1) this.doneRing.visible = false;
    }

    /* ---- 機械の姿勢を反映 ---- */
    this._updateMachine(dt);

    /* ---- 粒子 ---- */
    this.muck.update(dt, this.spin > 0.2);
    this.dust.update(dt);
    this.spark.update(dt);

    /* ---- 世界 ---- */
    const faceZ = this.machineZ + C.HEAD_Z + 0.34;
    this.geo.update(faceZ, this.camera.position.z);

    /* ---- カメラ ---- */
    this._updateCamera(dt);

    /* ---- 光の追従 ---- */
    const mz = this.machineZ;
    const inTunnel = this.camMode === 'tun';
    const reveal = this.state === 'reveal';
    this.headLight.position.set(0, 0.4, mz + C.HEAD_Z - 1.9);
    this.headLight.intensity = (inTunnel ? 4 : 34)
      + (this.digging ? 14 : 0) + Math.sin(this.timer * 9) * 1.5;
    this.midLight.position.set(0, 0.2, mz + 5.0);
    this.ringLight.position.set(0, 0.6, mz + C.RING_ZC + 0.9);
    this.ringLight.intensity = inTunnel ? (reveal ? 26 : 14) : 22;
    // 組立中のリングだけを強く照らす
    this.ringSpot.position.set(-1.3, 1.4, mz + C.RING_ZC - 9.5);
    this.ringSpot.target.position.set(0, 0, mz + C.RING_ZC);
    this.ringSpot.target.updateMatrixWorld();
    this.ringSpot.intensity = (inTunnel && !reveal) ? 210 : 0;
    // 切羽を手前側から
    this.faceLight.position.set(-2.8, 1.1, mz + C.HEAD_Z + 0.45);
    this.faceLight.intensity = inTunnel ? 0 : (this.digging ? 34 : 24);
    this.chamberLight.position.set(-1.2, 0.6, mz + C.HEAD_Z - 0.75);
    this.chamberLight.intensity = inTunnel ? 0 : (this.digging ? 40 : 26);
    this.tailLight.position.set(0, 0.4, mz - 5.5);
    this.tailLight.intensity = inTunnel ? 0 : 26;
    this.midLight.intensity = inTunnel ? 4 : 28;
    this.hemi.intensity = inTunnel ? 0.045 : 0.46;
    this.workSpot.position.set(-2.4, 3.3, mz + 3.4);
    this.workSpot.target.position.set(0.4, -0.6, mz + 10.4);
    this.workSpot.target.updateMatrixWorld();
    this.keyLight.position.set(-30, 18, mz - 8);
    this.keyLight.target.position.set(0, 0, mz + 4);
    this.keyLight.target.updateMatrixWorld();
    this.keyLight.intensity = inTunnel ? 0.05 : 0.9;
    this.rimLight.position.set(18, -8, mz - 16);
    this.rimLight.target.position.set(0, 0, mz + 4);
    this.rimLight.target.updateMatrixWorld();
    this.rimLight.intensity = inTunnel ? 0.03 : 0.55;

    // トンネル内の灯（後方へ等間隔に並べる）
    const linedStart = -C.PRESET_RINGS * C.RING_W;
    for (let i = 0; i < this.tunnelLights.length; i++) {
      const z = mz - 7 - i * 6.5;
      const l = this.tunnelLights[i];
      l.position.set(0, 2.4, z);
      l.intensity = (reveal && z > linedStart - 2) ? 22 : 0;
    }

    this.tbm.root.position.z = this.machineZ;
    this.ringGroup.position.z = this.machineZ + C.RING_ZC;
  }

  _updateMachine(dt) {
    const T = this.tbm;
    // 推進ジャッキ（伸びるほどシューが後方のリング前面に残る）
    {
      const ext = this.jackExt;
      const back = -ext + 0.02;
      const L = 2.35 - back;
      for (const j of T.jacks.jacks) {
        j.rod.scale.z = L;
        j.rod.position.z = (2.35 + back) / 2;
        j.shoe.position.z = back + 0.11;
      }
    }
    // ベルト
    const beltSpeed = (this.spin > 0.2 ? 1 : 0) * (this.digging ? 1.5 : 0.8);
    for (const m of T.belt.maps) m.offset.y -= beltSpeed * dt * 0.9;
    // スクリュー
    T.screw.spinner.rotation.z += (this.digging ? 4.2 : this.spin * 1.1) * dt;
    // 回転灯
    T.beaconSpin.rotation.z += 2.6 * dt;
    // 作業灯の微かな揺らぎ
    const fl = 0.9 + Math.sin(this.timer * 17) * 0.05 + Math.sin(this.timer * 5.3) * 0.05;
    for (const l of T.lamps) l.sprite.material.opacity = 0.6 * fl;

    // エレクター
    const E = T.erector;
    const holdR = C.SEG_RI + (this.held ? this.held.dr : C.ERECTOR_HOLD_DR) - 0.16;
    const armR = clamp(holdR, 2.2, 4.1);
    E.rotor.rotation.z = this.erectorAngle - Math.PI / 2;
    E.head.position.set(0, armR, C.RING_ZC - C.ERECTOR_Z);
    const inner = E.armInner;
    inner.position.y = (1.95 + armR) / 2;
    inner.scale.y = Math.max(0.2, (armR - 1.95) / 1.5);
    E.rodA.position.set(0.42, (2.0 + armR) / 2, 0);
    E.rodA.scale.z = Math.max(0.2, (armR - 1.6));

    // 把持中のセグメント
    if (this.held) {
      const h = this.held;
      const a = h.angle;
      const liftY = (1 - (h.lift ?? 1)) * -3.2;
      h.mesh.rotation.z = a;
      h.mesh.position.set(
        Math.cos(a) * h.dr,
        Math.sin(a) * h.dr + liftY,
        h.zOff);
      h.mesh.visible = true;
    }
    if (this.ghost) {
      const s = 1;
      this.ghost.scale.set(s, s, s);
    }
  }

  _updateCamera(dt) {
    // 断面 ⇄ 内部 の切替は暗転で繋ぐ
    if (this.pendingMode !== this.camMode && this.wipe <= 0) {
      const fam = (m) => (m === 'tun' ? 'tun' : 'sec');
      if (fam(this.pendingMode) !== fam(this.camMode)) {
        this.wipe = 0.5;
        this._wipeSwapped = false;
      } else {
        this.camMode = this.pendingMode;
      }
    }
    if (this.wipe > 0) {
      this.wipe -= dt;
      const k = clamp(1 - Math.abs(this.wipe - 0.25) / 0.25, 0, 1);
      document.getElementById('wipe').style.opacity = k.toFixed(3);
      if (this.wipe <= 0.25 && !this._wipeSwapped) {
        this._wipeSwapped = true;
        this.camMode = this.pendingMode;
        this._applyFrame(true);
      }
      if (this.wipe <= 0) document.getElementById('wipe').style.opacity = '0';
    }

    const f = this._frameFor(this.camMode);
    const mz = this.machineZ;
    let px = f.p[0], py = f.p[1], pz = f.p[2] + mz;
    let tx = f.t[0], ty = f.t[1], tz = f.t[2] + mz;
    let fov = f.fov;

    if (this.state === 'reveal') {
      const k = clamp(this.revealT / 6.0, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      const linedStart = -C.PRESET_RINGS * C.RING_W;
      const back = clamp((mz - 8.2) - (linedStart + 4.0), 6, 34);
      px = -1.25 + 1.05 * e;
      py = 1.15 - 0.55 * e;
      pz = mz - 8.2 - back * e;
      tx = 0; ty = 0.1; tz = mz - 1.0 + 3 * e;
      fov = f.fov + 14 * e;
      this.fog.density = 0.0215 - 0.0135 * e;
    } else {
      const want = this.camMode === 'tun' ? 0.042 : 0.0205;
      this.fog.density += (want - this.fog.density) * (1 - Math.exp(-dt / 0.8));
    }

    const tau = this.wipe > 0 ? 0.01 : 0.42;
    const k = 1 - Math.exp(-dt / tau);
    this.camPos.lerp(new THREE.Vector3(px, py, pz), k);
    this.camTgt.lerp(new THREE.Vector3(tx, ty, tz), k);
    this.camFov += (fov - this.camFov) * k;

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTgt);
    if (Math.abs(this.camera.fov - this.camFov) > 0.01) {
      this.camera.fov = this.camFov;
      this.camera.updateProjectionMatrix();
    }

    // カメラが坑内に入ったら地山を閉じる
    const rr = Math.hypot(this.camera.position.x, this.camera.position.y);
    this.geo.setSectionMode(rr > C.BORE_R - 0.35);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
