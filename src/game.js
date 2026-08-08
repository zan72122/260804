/* =========================================================
   game.js — 工程の進行・カメラ・入力（3D）
   入力はすべてレイキャストで実際の3D面に当てる。
   クープは「バゲット表面の展開座標」で保持するので、
   カメラが動いても画面が回っても失われない。
   ========================================================= */
import * as THREE from 'three';
import { Stage } from './stage.js';
import { Loaf3D, LOAF_TYPES } from './loaf3d.js';
import {
  WORLD, buildRoom, buildBench, buildCouche, buildOven, buildShelves,
  buildRack, buildLame, buildScraper, buildDredger, buildTowel, buildBasket, buildPeel,
} from './bakery.js';
import { Particles3D } from './particles.js';
import { HUD } from './hud.js';
import { Sfx } from './audio.js';

const STAGES = ['place', 'press', 'roll', 'stretch', 'couche', 'proof',
  'score', 'load', 'steam', 'bake', 'out', 'tap'];
const BAKE_SECONDS = 12.0;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const smoother = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
const rr = (a, b) => a + Math.random() * (b - a);
const approach = (c, t, rate, dt) => c + (t - c) * (1 - Math.exp(-rate * dt));

/* 作業位置（すべてワールド座標・メートル） */
const P = {
  bench: new THREE.Vector3(0, WORLD.benchTop, 0.14),
  couche: new THREE.Vector3(0, WORLD.benchTop + 0.004, -0.17),
  couchePitch: 0.118,
  oven: new THREE.Vector3(0, WORLD.deckY, WORLD.ovenFront - 0.60),
  rack: new THREE.Vector3(0, WORLD.benchTop + 0.026, 0.10),
  peelWait: new THREE.Vector3(0, WORLD.benchTop + 0.02, 0.30),
};

/* カメラ：注視点まわりの方位角・仰角・距離で持つ */
function cam(az, el, dist, tx, ty, tz, fov) {
  return { az: az * Math.PI / 180, el: el * Math.PI / 180, dist, target: new THREE.Vector3(tx, ty, tz), fov };
}

/* オーブン内の注視点（実寸から導く） */
const OZ = WORLD.ovenFront - 0.60;

/* 横画面：バゲットを横一文字に大きく。奥にオーブンと部屋 */
const CAM_L = {
  menu: cam(27, 27, 3.30, 0.0, 1.06, -1.45, 44),
  place: cam(6, 36, 0.90, 0, 0.955, 0.13, 40),
  press: cam(6, 36, 0.86, 0, 0.955, 0.13, 40),
  roll: cam(4, 34, 0.95, 0, 0.950, 0.13, 40),
  stretch: cam(3, 33, 1.10, 0, 0.945, 0.10, 40),
  couche: cam(7, 32, 1.16, 0, 0.950, -0.14, 40),
  proof: cam(9, 30, 1.02, 0, 0.952, -0.16, 38),
  score: cam(10, 37, 0.80, 0, 0.958, -0.17, 36),
  load: cam(5, 20, 1.95, 0, 1.020, -1.05, 46),
  steam: cam(16, 34, 0.84, 0, 1.008, OZ + 0.05, 44),
  bake: cam(19, 37, 0.70, 0, 1.010, OZ + 0.02, 42),
  out: cam(7, 22, 1.85, 0, 1.010, -1.30, 44),
  tap: cam(9, 33, 0.92, 0, 0.975, 0.10, 38),
  done: cam(16, 29, 1.24, 0, 0.985, 0.04, 42),
};
/* 縦画面：軸を奥へ振って、細長い画面に斜めに収める */
const CAM_P = {
  menu: cam(22, 29, 2.95, 0.0, 1.10, -1.35, 56),
  place: cam(40, 40, 0.72, 0, 0.955, 0.13, 52),
  press: cam(40, 40, 0.70, 0, 0.955, 0.13, 52),
  roll: cam(42, 38, 0.76, 0, 0.950, 0.13, 52),
  stretch: cam(46, 36, 0.90, 0, 0.945, 0.10, 52),
  couche: cam(50, 34, 0.98, 0, 0.950, -0.14, 52),
  proof: cam(50, 33, 0.90, 0, 0.952, -0.16, 50),
  score: cam(53, 39, 0.74, 0, 0.958, -0.17, 48),
  load: cam(34, 24, 1.60, 0, 1.020, -1.05, 56),
  steam: cam(42, 35, 0.76, 0, 1.008, OZ + 0.05, 56),
  bake: cam(46, 38, 0.66, 0, 1.010, OZ + 0.02, 54),
  out: cam(38, 25, 1.55, 0, 1.010, -1.25, 54),
  tap: cam(46, 35, 0.82, 0, 0.975, 0.10, 50),
  done: cam(46, 31, 1.08, 0, 0.985, 0.04, 52),
};

export class Game {
  constructor(canvas, hudCanvas) {
    this.stage3 = new Stage(canvas);
    this.hudCanvas = hudCanvas;
    this.hctx = hudCanvas.getContext('2d');
    this.scene = this.stage3.scene;
    this.camera = this.stage3.camera;

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.time = 0; this.stageT = 0; this.idleT = 0;
    this.stage = 'menu';
    this.history = [];
    this.typeKey = 'normal';
    this.freeMode = false;
    this.soundOn = true;
    this.loaves = [];
    this.buttons = {};
    this.trail = [];
    this.parallax = new THREE.Vector2();

    this._buildWorld();
    this._resetCounters();
    this.camCur = { az: 0, el: 0, dist: 2, target: new THREE.Vector3(), fov: 40 };
    this._applyCamTarget(true);
    this._bindInput(canvas.parentElement || document.body);
  }

  /* =========================================================
     世界の組み立て
     ========================================================= */
  _buildWorld() {
    const sc = this.scene;
    sc.add(buildRoom());
    sc.add(buildBench());
    const oven = buildOven();
    sc.add(oven.group);
    this.ovenDoor = oven.doorPivot;
    sc.add(buildShelves());

    /* クーシュ（作業台の上の発酵布） */
    this.couche = buildCouche(1.42, 0.66, 3, P.couchePitch);
    this.couche.position.copy(P.couche);
    this.couche.position.y = WORLD.benchTop + 0.001;
    sc.add(this.couche);

    /* 近景の道具 */
    this.lame = buildLame();
    this.lame.position.set(0.58, WORLD.benchTop + 0.010, 0.30);
    this.lame.rotation.set(Math.PI / 2, 0, -0.5);
    sc.add(this.lame);

    const scraper = buildScraper();
    scraper.position.set(-0.68, WORLD.benchTop + 0.001, 0.30);
    scraper.rotation.y = 0.35;
    sc.add(scraper);

    this.dredger = buildDredger();
    this.dredger.position.set(-0.90, WORLD.benchTop, 0.12);
    sc.add(this.dredger);

    const towel = buildTowel(0.36, 0.34);
    towel.position.set(0.92, WORLD.benchTop - 0.10, 0.40);
    towel.rotation.set(0.12, -0.25, 0.05);
    sc.add(towel);

    /* ピール */
    this.peel = buildPeel();
    this.peel.position.copy(P.peelWait);
    this.peel.visible = false;
    sc.add(this.peel);

    /* 冷却ラック */
    this.rack = buildRack();
    this.rack.position.set(P.rack.x, WORLD.benchTop + 0.001, P.rack.z);
    this.rack.visible = false;
    sc.add(this.rack);

    /* 焼き上がったバゲットを風景として置く（遠景の棚と、近景の籠） */
    const deco = new THREE.Group();
    const decoLoaf = (type, seed, opts) => {
      const l = new Loaf3D(type, seed, opts);
      l.press = 1; l.roll = 1; l.stretch = 1; l.proof = 1;
      const hl = l.dims().hl;
      const n = type === 'normal' ? 4 : 3;
      for (let c = 0; c < n; c++) {
        const t = (-0.62 + (1.24 * c) / (n - 1)) * hl;
        l.addScore(t - 0.055, -0.008, t + 0.055, 0.008, 0.3, false);
        l.scores[c].settle = 1;
      }
      l.bake = 0.86 + Math.random() * 0.12;
      l.cool = 1;
      l.rebuild();
      l.mesh.castShadow = true; l.mesh.receiveShadow = true;
      return l.mesh;
    };

    /* 遠景：奥の壁の棚に並ぶ */
    for (let s2 = 0; s2 < 3; s2++) {
      const y = 1.20 + s2 * 0.56;
      for (let i = 0; i < 3; i++) {
        const m = decoLoaf(i % 3 === 2 ? 'batard' : 'normal', 5000 + s2 * 41 + i, { nu: 44, nv: 20 });
        m.position.set(1.05 + i * 0.60 + (s2 % 2) * 0.12, y + 0.055, -6.00 + ((i + s2) % 3) * 0.045);
        m.rotation.set(0.02, 0.06 + i * 0.09, 0.05);
        deco.add(m);
      }
    }

    /* 中景：作業台の端の籠に立てかけた焼き上がり */
    const basket = buildBasket(0.16, 0.13);
    basket.position.set(0.86, WORLD.benchTop, -0.34);
    basket.rotation.y = 0.3;
    deco.add(basket);
    for (let i = 0; i < 3; i++) {
      const m = decoLoaf('normal', 9100 + i, { nu: 72, nv: 30 });
      m.position.set(0.86 + (i - 1) * 0.035, WORLD.benchTop + 0.05 + i * 0.03, -0.34 + (i - 1) * 0.03);
      m.rotation.set(0.0, 0.28 + i * 0.06, 0.30 + i * 0.05);
      deco.add(m);
    }

    /* 遠景の壁に吊るした籠 */
    for (let i = 0; i < 3; i++) {
      const b2 = buildBasket(0.13, 0.10);
      b2.position.set(-2.3 + i * 0.55, 1.62, -6.05);
      b2.rotation.x = -0.35;
      deco.add(b2);
    }
    sc.add(deco);

    /* --- プレイヤーのバゲット --- */
    this.loafGroup = new THREE.Group();
    sc.add(this.loafGroup);
    this.loaf = null;
    this.sibs = [];

    this.parts = new Particles3D(sc);

    /* 生地のガス（気泡） */
    this.bubbleGroup = new THREE.Group();
    this.loafGroup.add(this.bubbleGroup);

    /* 入力用の水平面 */
    this._plane = new THREE.Plane();
    this._hit = new THREE.Vector3();
  }

  _resetCounters() {
    this.rollAcc = 0; this.stretchAcc = 0; this.pressCount = 0;
    this.bakeT = 0; this.slideK = 0; this.steamK = 0; this.knock = 0;
    this.heat = 0; this.doorK = 0; this.crackleT = 0; this.celebrateT = 0;
    this.dropK = 0; this.bubbles = [];
  }

  /* =========================================================
     バゲットの生成と配置
     ========================================================= */
  newLoaf(key) {
    this.typeKey = key === 'free' ? 'free' : key;
    this.freeMode = key === 'free';
    if (this.loaf) { this.loafGroup.remove(this.loaf.mesh); this.loaf.dispose(); }
    for (const s of this.sibs) { this.scene.remove(s.mesh); s.dispose(); }
    this.sibs = [];
    this.loaf = new Loaf3D(this.typeKey);
    this.loafGroup.add(this.loaf.mesh);
    this._resetCounters();
    this.setStage('place');
  }

  _makeSiblings() {
    for (const s of this.sibs) { this.scene.remove(s.mesh); s.dispose(); }
    this.sibs = [];
    for (let i = 0; i < 2; i++) {
      const l = new Loaf3D(this.typeKey, undefined, { nu: 120, nv: 44 });
      l.press = 1; l.roll = 1; l.stretch = 1;
      l.proof = this.loaf.proof;
      l.rebuild();
      l.mesh.castShadow = true;
      l.side = i === 0 ? -1 : 1;
      this.scene.add(l.mesh);
      this.sibs.push(l);
    }
  }

  _copyScoresToSiblings() {
    for (const sb of this.sibs) {
      sb.scores.length = 0;
      sb.lean = this.loaf.lean;
      for (const s of this.loaf.scores) {
        const c = Object.assign({}, s);
        c.t = clamp(s.t + rr(-0.03, 0.03), 0.10, 0.90);
        c.off = s.off * 0.6 + rr(-0.003, 0.003);
        c.angle = s.angle + rr(-0.05, 0.05);
        c.len = clamp(s.len + rr(-0.10, 0.10), 0, 1);
        c.depth = clamp(s.depth + rr(-0.08, 0.08), 0.6, 1.35);
        c.seed = (Math.random() * 1e6) | 0;
        c.settle = 1; c.popped = false;
        c.raw = { t: c.t, off: c.off, angle: c.angle, half: 0.05 };
        sb.scores.push(c);
      }
      sb.rebuild();
    }
  }

  _syncSiblings() {
    for (const s of this.sibs) {
      s.proof = this.loaf.proof; s.bake = this.loaf.bake; s.cool = this.loaf.cool;
    }
  }

  /* バゲットの置き場所を工程から決める */
  _placeLoaf(dt) {
    if (!this.loaf) return;
    const d = this.loaf.dims();
    const st = this.stage;
    const g = this.loafGroup;
    let pos = new THREE.Vector3(), yaw = 0, roll = 0;

    if (st === 'menu') {
      pos.set(0, WORLD.benchTop + d.R, P.couche.z);
    } else if (st === 'place' || st === 'press' || st === 'roll' || st === 'stretch') {
      pos.copy(P.bench);
      pos.y += d.R * (1 - 0.10 * this.loaf.press);
      if (st === 'place') pos.y += (1 - smoother(clamp(this.dropK / 0.62, 0, 1))) * 0.42;
    } else if (st === 'couche' || st === 'proof' || st === 'score') {
      pos.copy(this.dragPos || P.couche);
      pos.y = WORLD.benchTop + 0.006 + d.R * 0.88;
    } else if (st === 'load') {
      const k = smoother(this.slideK);
      const a = new THREE.Vector3(P.couche.x, WORLD.benchTop + 0.028 + d.R * 0.9, P.peelWait.z - 0.10);
      const b = new THREE.Vector3(P.oven.x, WORLD.deckY + d.R * 0.92, P.oven.z);
      pos.lerpVectors(a, b, k);
      pos.y += Math.sin(k * Math.PI) * 0.05;
    } else if (st === 'steam' || st === 'bake') {
      pos.set(P.oven.x, WORLD.deckY + d.R * 0.92, P.oven.z);
    } else if (st === 'out') {
      const k = smoother(this.slideK);
      const a = new THREE.Vector3(P.oven.x, WORLD.deckY + d.R * 0.92, P.oven.z);
      const b = new THREE.Vector3(P.rack.x, WORLD.benchTop + 0.030 + d.R * 0.92, P.rack.z);
      pos.lerpVectors(a, b, k);
      pos.y += Math.sin(k * Math.PI) * 0.10;
    } else {
      pos.set(P.rack.x, WORLD.benchTop + 0.030 + d.R * 0.92, P.rack.z);
    }

    g.position.copy(pos);
    g.rotation.set(roll, yaw, 0);

    /* 兄弟のバゲット（隣の襞） */
    for (const s of this.sibs) {
      const sd = s.dims();
      s.mesh.position.set(pos.x, pos.y + (sd.R - d.R), pos.z + s.side * P.couchePitch);
      s.mesh.rotation.copy(g.rotation);
      s.mesh.visible = ['couche', 'proof', 'score', 'load', 'steam', 'bake', 'out', 'tap', 'done'].includes(st);
    }
  }

  /* =========================================================
     カメラ
     ========================================================= */
  _camTarget() {
    const table = this.portrait ? CAM_P : CAM_L;
    const st = this.stage;
    /* 出し入れの最中はパンが動くので、カメラも一緒に移す。
       固定の画角にするとパンが画面の外へ出てしまう。 */
    if (st === 'load' || st === 'out') {
      const k = smoother(clamp(this.slideK, 0, 1));
      const a = st === 'load' ? table.score : table.bake;
      const b = st === 'load' ? table.bake : table.tap;
      if (!this._blend) this._blend = { az: 0, el: 0, dist: 1, target: new THREE.Vector3(), fov: 40 };
      const o = this._blend;
      o.az = lerp(a.az, b.az, k);
      o.el = lerp(a.el, b.el, k);
      o.dist = lerp(a.dist, b.dist, k);
      o.fov = lerp(a.fov, b.fov, k);
      o.target.lerpVectors(a.target, b.target, k);
      return o;
    }
    return table[st] || table.score;
  }
  _applyCamTarget(snap) {
    const t = this._camTarget();
    const c = this.camCur;
    if (snap) {
      c.az = t.az; c.el = t.el; c.dist = t.dist; c.target.copy(t.target); c.fov = t.fov;
    }
  }
  _updateCamera(dt) {
    const t = this._camTarget();
    const c = this.camCur;
    const rate = 3.2;
    c.az = approach(c.az, t.az, rate, dt);
    c.el = approach(c.el, t.el, rate, dt);
    c.dist = approach(c.dist, t.dist, rate, dt);
    c.target.lerp(t.target, 1 - Math.exp(-rate * dt));
    c.fov = approach(c.fov, t.fov, rate, dt);

    /* 視差：指の位置でわずかに視点が動く */
    const az = c.az + this.parallax.x * 0.055;
    const el = clamp(c.el + this.parallax.y * 0.035, 0.06, 1.35);
    const cx = c.target.x + Math.sin(az) * Math.cos(el) * c.dist;
    const cy = c.target.y + Math.sin(el) * c.dist;
    const cz = c.target.z + Math.cos(az) * Math.cos(el) * c.dist;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(c.target);
    if (Math.abs(this.camera.fov - c.fov) > 0.01) {
      this.camera.fov = c.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /* =========================================================
     入力
     ========================================================= */
  _bindInput(el) {
    const c = this.hudCanvas;
    this.ptr = { down: false, id: null, x: 0, y: 0, px: 0, py: 0, sx: 0, sy: 0, st: 0, moved: 0, consumed: false };
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      if (this.ptr.down) return;
      const p = pos(e);
      Object.assign(this.ptr, { down: true, id: e.pointerId, x: p.x, y: p.y, px: p.x, py: p.y, sx: p.x, sy: p.y, st: this.time, moved: 0 });
      this.idleT = 0;
      Sfx.unlock();
      this._onDown(p.x, p.y);
    }, { passive: false });
    c.addEventListener('pointermove', (e) => {
      e.preventDefault();
      const p = pos(e);
      this.parallax.set(
        clamp((p.x / this.W - 0.5) * 2, -1, 1),
        clamp((0.5 - p.y / this.H) * 2, -1, 1)
      );
      if (!this.ptr.down || e.pointerId !== this.ptr.id) return;
      this.ptr.px = this.ptr.x; this.ptr.py = this.ptr.y;
      this.ptr.x = p.x; this.ptr.y = p.y;
      this.ptr.moved += Math.hypot(p.x - this.ptr.px, p.y - this.ptr.py);
      this.idleT = 0;
      this._onMove(p.x, p.y);
    }, { passive: false });
    const up = (e) => {
      e.preventDefault();
      if (!this.ptr.down) return;
      this.ptr.down = false; this.ptr.id = null;
      Sfx.frictionStop();
      this._onUp(this.ptr.x, this.ptr.y);
    };
    c.addEventListener('pointerup', up, { passive: false });
    c.addEventListener('pointercancel', () => { this.ptr.down = false; Sfx.frictionStop(); });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _ray(x, y) {
    this.ndc.set((x / this.W) * 2 - 1, -(y / this.H) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster;
  }
  /* 水平面 y=h との交点 */
  _hitPlane(x, y, h) {
    this._plane.set(new THREE.Vector3(0, 1, 0), -h);
    const r = this._ray(x, y);
    const p = r.ray.intersectPlane(this._plane, this._hit);
    return p ? p.clone() : null;
  }
  /* バゲット表面の展開座標（軸方向[m], 弧長[m]）へ */
  _hitLoafSurface(x, y) {
    if (!this.loaf) return null;
    const d = this.loaf.dims();
    const top = this.loafGroup.position.y + d.R * 0.72;
    const w = this._hitPlane(x, y, top);
    if (!w) return null;
    const lx = w.x - this.loafGroup.position.x;
    const lz = w.z - this.loafGroup.position.z;
    if (Math.abs(lx) > d.hl * 1.5 + 0.06) return null;
    if (Math.abs(lz) > d.R + P.couchePitch * 0.72) return null;
    /* 弧長。上面付近なので z ≒ 弧長 */
    return { sx: lx, sy: clamp(lz, -d.R * 0.85, d.R * 0.85), world: w };
  }

  _onDown(x, y) {
    if (this._hudDown(x, y)) { this.ptr.consumed = true; return; }
    this.ptr.consumed = false;
    const st = this.stage;
    if (st === 'place') {
      if (this.dropK <= 0) this.dropK = 0.0001;
    } else if (st === 'press') {
      this._doPress(x, y);
    } else if (st === 'roll' || st === 'stretch') {
      Sfx.frictionStart();
    } else if (st === 'score') {
      const s = this._hitLoafSurface(x, y);
      this.cutting = !!s;
      if (s) { this.cutStart = s; this.trail = [{ x, y }]; }
    } else if (st === 'couche') {
      const w = this._hitPlane(x, y, this.loafGroup.position.y);
      if (w) this.dragOffset = new THREE.Vector3().subVectors(this.loafGroup.position, w);
    } else if (st === 'tap') {
      this._doKnock(x, y);
    }
  }

  _onMove(x, y) {
    if (this.ptr.consumed) return;
    const st = this.stage;
    const dx = x - this.ptr.px, dy = y - this.ptr.py;
    if (st === 'roll' || st === 'stretch') {
      const h = this.loafGroup.position.y;
      const a = this._hitPlane(this.ptr.px, this.ptr.py, h);
      const b = this._hitPlane(x, y, h);
      if (a && b) {
        const dz = Math.abs(b.z - a.z), dxw = Math.abs(b.x - a.x);
        const speed = clamp(Math.hypot(dx, dy) / 22, 0, 1);
        Sfx.frictionLevel(speed);
        if (st === 'roll') {
          this.rollAcc += dz;
          this.loaf.roll = clamp(this.rollAcc / 0.46, 0, 1);
          if (Math.random() < 0.25) this.parts.flour(b.x, h + 0.03, b.z, 1, 0.8);
          if (this.loaf.roll >= 1) this._finish('roll');
        } else {
          this.stretchAcc += dxw;
          this.loaf.stretch = clamp(this.stretchAcc / 1.35, 0, 1);
          if (Math.random() < 0.3) this.parts.flour(b.x, h + 0.02, b.z, 1, 0.8);
          if (this.loaf.stretch >= 1) this._finish('stretch');
        }
        this.loaf.rebuild();
      }
    } else if (st === 'couche') {
      const w = this._hitPlane(x, y, this.loafGroup.position.y);
      if (w && this.dragOffset) {
        const p = w.clone().add(this.dragOffset);
        this.dragPos = new THREE.Vector3(clamp(p.x, -0.35, 0.35), 0, clamp(p.z, -0.45, 0.45));
      }
    } else if (st === 'score' && this.cutting) {
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(last.x - x, last.y - y) > 4) this.trail.push({ x, y });
      if (this.trail.length > 90) this.trail.shift();
    } else if (st === 'load' && this.slideK <= 0 && this.ptr.moved > this.mn * 0.09) {
      this._startLoad();
    } else if (st === 'out' && this.slideK <= 0 && this.ptr.moved > this.mn * 0.08) {
      this._startOut();
    }
  }

  _onUp(x, y) {
    if (this.ptr.consumed) { this._hudUp(x, y); return; }
    const st = this.stage;
    if (st === 'score' && this.cutting) { this._finishCut(x, y); this.cutting = false; }
    else if (st === 'couche') this._snapCouche();
    else if (st === 'load' && this.slideK <= 0) this._startLoad();
    else if (st === 'out' && this.slideK <= 0) this._startOut();
    else if (st === 'proof' && this.loaf.proof > 0.9) this._advance();
    else if (st === 'roll' && this.ptr.moved < 6) {
      this.rollAcc += 0.14; this.loaf.roll = clamp(this.rollAcc / 0.46, 0, 1);
      this.loaf.rebuild(); Sfx.press(1.1);
      if (this.loaf.roll >= 1) this._finish('roll');
    } else if (st === 'stretch' && this.ptr.moved < 6) {
      this.stretchAcc += 0.34; this.loaf.stretch = clamp(this.stretchAcc / 1.35, 0, 1);
      this.loaf.rebuild(); Sfx.press(0.9);
      if (this.loaf.stretch >= 1) this._finish('stretch');
    }
  }

  /* =========================================================
     各工程
     ========================================================= */
  _doPress(x, y) {
    const s = this._hitLoafSurface(x, y);
    if (!s) return;
    let best = -1, bd = 1e9;
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      if (b.pop > 0) continue;
      const dd = Math.hypot(b.sx - s.sx, b.sy - s.sy);
      if (dd < bd) { bd = dd; best = i; }
    }
    if (best >= 0) this.bubbles[best].pop = 0.0001;
    this.pressCount++;
    this.loaf.press = clamp(this.pressCount / 4, 0, 1);
    this.loaf.rebuild();
    Sfx.press(0.9 + this.pressCount * 0.09);
    this.parts.flour(s.world.x, s.world.y + 0.01, s.world.z, 8, 1.0);
    if (this.pressCount >= 4) {
      Sfx.chime();
      setTimeout(() => { if (this.stage === 'press') this._advance(); }, 420);
    }
  }

  _finish(what) {
    if (this.stage !== what) return;
    if (what === 'roll') this.loaf.roll = 1; else this.loaf.stretch = 1;
    this.loaf.rebuild();
    Sfx.chime(); Sfx.frictionStop();
    setTimeout(() => { if (this.stage === what) this._advance(); }, 400);
  }

  _snapCouche() {
    this.dragPos = null;
    Sfx.cloth();
    this.parts.flour(P.couche.x, WORLD.benchTop + 0.05, P.couche.z, 14, 1.1);
    setTimeout(() => { if (this.stage === 'couche') { Sfx.chime(); this._advance(); } }, 460);
  }

  _finishCut(x, y) {
    if (this.trail.length < 2) { this.trail = []; return; }
    const a = this.trail[0], b = this.trail[this.trail.length - 1];
    const px = Math.hypot(b.x - a.x, b.y - a.y);
    if (px < this.mn * 0.035) { this.trail = []; return; }
    const s0 = this.cutStart, s1 = this._hitLoafSurface(x, y);
    this.trail = [];
    if (!s0 || !s1) return;
    const dur = this.time - this.ptr.st;
    const sc = this.loaf.addScore(s0.sx, s0.sy, s1.sx, s1.sy, dur, this.freeMode);
    if (!sc) return;
    this.loaf.rebuild();
    Sfx.slash(clamp(px / (this.mn * 0.35), 0.35, 1.3));
    /* 切れ目に沿って粉が舞う */
    const d = this.loaf.dims();
    const half = lerp(0.14, 0.30, sc.len) * d.hl;
    for (let i = 0; i <= 6; i++) {
      const k = -1 + (2 * i) / 6;
      const lx = (sc.t * 2 - 1) * d.hl + Math.cos(sc.angle) * half * k;
      const lz = sc.off + Math.sin(sc.angle) * half * k;
      this.parts.flour(
        this.loafGroup.position.x + lx,
        this.loafGroup.position.y + d.R * 0.9,
        this.loafGroup.position.z + lz, 2, 0.55
      );
    }
    const max = this.freeMode ? 8 : 5;
    if (this.loaf.scores.length >= max) {
      setTimeout(() => { if (this.stage === 'score') this._advance(); }, 900);
    }
  }

  _startLoad() {
    if (this.slideK > 0) return;
    this.slideK = 0.0001;
    this.doorK = 1;
    Sfx.door(true);
  }
  _doSteam() {
    if (this.steamK > 0) return;
    this.steamK = 0.0001;
    Sfx.steam(2.2);
    const o = P.oven;
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        for (let j = 0; j < 6; j++) {
          this.parts.steam(o.x + rr(-0.55, 0.55), WORLD.deckY + rr(0.0, 0.22), o.z + rr(-0.35, 0.35), 1, 1.15, 1.25);
        }
      }, i * 85);
    }
    setTimeout(() => { if (this.stage === 'steam') this._advance(); }, 1500);
  }
  _startOut() {
    if (this.slideK > 0) return;
    this.slideK = 0.0001;
    Sfx.door(false);
  }
  _doKnock(x, y) {
    const s = this._hitLoafSurface(x, y);
    if (!s) return;
    this.knock++;
    Sfx.knock();
    this.parts.crumb(s.world.x, s.world.y, s.world.z, 10);
    this.parts.spark(s.world.x, s.world.y + 0.01, s.world.z, 6, 1);
    for (let i = 0; i < 5; i++) setTimeout(() => Sfx.crackle(1.1), 120 + i * 90);
    if (this.knock >= 2) {
      setTimeout(() => {
        if (this.stage !== 'tap') return;
        Sfx.chime('big');
        this.setStage('done');
      }, 700);
    }
  }

  /* =========================================================
     進行
     ========================================================= */
  setStage(s) {
    this.history.push(s + '@' + this.time.toFixed(2));
    this.stage = s;
    this.stageT = 0;
    this.idleT = 0;
    this.trail = [];
    if (s === 'press') {
      this.pressCount = 0;
      this.bubbles = [];
      const d = this.loaf.dims();
      for (let i = 0; i < 4; i++) {
        this.bubbles.push({
          sx: (-0.55 + (1.1 * i) / 3) * d.hl, sy: rr(-0.4, 0.4) * d.R,
          r: rr(0.010, 0.016), pop: 0, mesh: null,
        });
      }
      this._syncBubbles();
    }
    if (s === 'couche') this._makeSiblings();
    if (s === 'load') { this.slideK = 0; this._copyScoresToSiblings(); this.peel.visible = true; }
    if (s === 'steam') this.steamK = 0;
    if (s === 'bake') { this.bakeT = 0; Sfx.ovenHum(true); Sfx.swell(4.2); }
    if (s === 'out') { this.slideK = 0; Sfx.ovenHum(false); this.rack.visible = true; }
    if (s === 'tap') this.knock = 0;
    if (s === 'done') {
      this.celebrateT = 0;
      if (this.loaf && !this.loaves.includes(this.loaf)) this.loaves.push(this.loaf);
    }
    if (s === 'menu') { Sfx.ovenHum(false); }
    this._applyCamTarget(s === 'menu');
  }
  _advance() {
    const i = STAGES.indexOf(this.stage);
    if (i >= 0 && i < STAGES.length - 1) this.setStage(STAGES[i + 1]);
    else this.setStage('done');
  }

  _syncBubbles() {
    while (this.bubbleGroup.children.length) {
      const m = this.bubbleGroup.children.pop();
      m.geometry.dispose(); m.material.dispose();
      this.bubbleGroup.remove(m);
    }
    const d = this.loaf.dims();
    for (const b of this.bubbles) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(b.r, 18, 14),
        new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.78, metalness: 0, transparent: true, opacity: 0.95 })
      );
      m.position.set(b.sx, d.R * 0.62, b.sy);
      m.scale.set(1.25, 0.55, 1.15);
      m.castShadow = false; m.receiveShadow = true;
      b.mesh = m;
      this.bubbleGroup.add(m);
    }
  }

  /* =========================================================
     更新
     ========================================================= */
  update(dt) {
    this.time += dt;
    this.stageT += dt;
    if (!this.ptr.down) this.idleT += dt;
    const st = this.stage;

    if (this.loaf && this.loaf.update(dt)) this.loaf.rebuild();
    this._syncSiblings();

    if (st === 'place' && this.dropK > 0 && this.dropK < 1) {
      const prev = this.dropK;
      this.dropK = Math.min(1, this.dropK + dt * 2.2);
      if (prev < 0.62 && this.dropK >= 0.62) {
        Sfx.pof();
        const p = this.loafGroup.position;
        this.parts.flour(p.x, p.y, p.z, 26, 1.4);
      }
      if (this.dropK >= 1) setTimeout(() => { if (this.stage === 'place') this._advance(); }, 300);
    }

    if (st === 'press') {
      const d = this.loaf.dims();
      for (const b of this.bubbles) {
        if (b.pop > 0 && b.pop < 1) b.pop = Math.min(1, b.pop + dt * 3.4);
        if (b.mesh) {
          const k = smooth(b.pop);
          b.mesh.visible = k < 1;
          b.mesh.position.set(b.sx, d.R * 0.62, b.sy);
          const s = 1 + k * 0.6;
          b.mesh.scale.set(1.25 * s, 0.55 * (1 - k), 1.15 * s);
          b.mesh.material.opacity = 0.95 * (1 - k);
        }
      }
    }

    if (st === 'proof') {
      this.loaf.proof = clamp(this.loaf.proof + dt / 3.0, 0, 1);
      this.loaf.rebuild();
      for (const s of this.sibs) { s.proof = this.loaf.proof; s.rebuild(); }
      if (this.loaf.proof >= 1 && this.stageT > 3.8) this._advance();
    }

    if (st === 'load') {
      if (this.slideK > 0 && this.slideK < 1) {
        this.slideK = Math.min(1, this.slideK + dt * 0.62);
        if (this.slideK >= 1) {
          Sfx.door(false);
          setTimeout(() => { if (this.stage === 'load') this._advance(); }, 420);
        }
      }
      this.heat = approach(this.heat, 0.55, 1.6, dt);
    }

    if (st === 'steam') {
      this.heat = approach(this.heat, 0.72, 1.4, dt);
      if (this.steamK > 0) this.steamK = Math.min(1, this.steamK + dt * 0.8);
    }

    if (st === 'bake') {
      this.bakeT += dt;
      const p = clamp(this.bakeT / BAKE_SECONDS, 0, 1);
      this.loaf.bake = 1 - Math.pow(1 - p, 1.32);
      this.loaf.rebuild();
      for (const s of this.sibs) { s.bake = this.loaf.bake; s.rebuild(); }
      this.heat = approach(this.heat, 1.0, 1.0, dt);

      const rate = lerp(26, 1.2, smooth(range(p, 0, 0.55)));
      let want = dt * rate;
      while (want > 0) {
        if (Math.random() < Math.min(1, want)) {
          const near = Math.random() < 0.55;
          const g = this.loafGroup.position;
          if (near) this.parts.steam(g.x + rr(-0.30, 0.30), g.y + rr(0.0, 0.05), g.z + rr(-0.12, 0.12), 1, 0.75, 0.8);
          else this.parts.steam(P.oven.x + rr(-0.55, 0.55), WORLD.deckY + rr(0, 0.2), P.oven.z + rr(-0.4, 0.4), 1, 1.1, 0.9);
        }
        want -= 1;
      }

      for (const s of this.loaf.consumePops()) {
        Sfx.pop(0.85 + Math.random() * 0.2);
        const d = this.loaf.dims();
        const g = this.loafGroup.position;
        const lx = (s.t * 2 - 1) * d.hl;
        this.parts.steam(g.x + lx, g.y + d.R, g.z + s.off, 3, 0.5, 0.7);
        this.parts.spark(g.x + lx, g.y + d.R, g.z + s.off, 4, 1);
      }
      if (p > 0.72) {
        this.crackleT -= dt;
        if (this.crackleT <= 0) { Sfx.crackle(0.7); this.crackleT = rr(0.10, 0.4); }
      }
      if (p >= 1) {
        Sfx.chime('big'); Sfx.ovenHum(false);
        setTimeout(() => { if (this.stage === 'bake') this._advance(); }, 900);
      }
    }

    if (st === 'out') {
      this.heat = approach(this.heat, 0.30, 0.9, dt);
      if (this.slideK > 0 && this.slideK < 1) {
        this.slideK = Math.min(1, this.slideK + dt * 0.60);
        if (this.slideK >= 1) setTimeout(() => { if (this.stage === 'out') this._advance(); }, 500);
      }
      if (this.slideK > 0.2) {
        const g = this.loafGroup.position;
        if (Math.random() < dt * 9) this.parts.steam(g.x + rr(-0.28, 0.28), g.y + 0.03, g.z, 1, 0.4, 0.5);
        this.crackleT -= dt;
        if (this.crackleT <= 0) { Sfx.crackle(0.85); this.crackleT = rr(0.08, 0.32); }
      }
    }

    if (st === 'tap' || st === 'done') {
      this.heat = approach(this.heat, 0.16, 0.6, dt);
      this.loaf.cool = clamp(this.loaf.cool + dt / 7, 0, 1);
      if (st === 'tap') {
        this.crackleT -= dt;
        if (this.crackleT <= 0) { Sfx.crackle(0.4); this.crackleT = rr(0.5, 1.6); }
        const g = this.loafGroup.position;
        if (Math.random() < dt * 2.4) this.parts.steam(g.x + rr(-0.28, 0.28), g.y + 0.02, g.z, 1, 0.3, 0.4);
      } else this.celebrateT += dt;
    }

    if (st === 'menu' || st === 'place' || st === 'press' || st === 'roll' || st === 'stretch') {
      this.heat = approach(this.heat, 0.20, 0.5, dt);
    }

    /* 扉 */
    const doorOpen = ['load', 'steam', 'bake', 'out'].includes(st)
      ? (st === 'load' ? clamp(this.slideK * 4, 0, 1) : (st === 'out' ? 1 - smoother(clamp(this.slideK * 1.4 - 0.4, 0, 1)) * 0 + 1 : 1))
      : 0;
    this.doorK = approach(this.doorK, doorOpen, 4.0, dt);
    this.ovenDoor.rotation.x = -this.doorK * 1.62;

    this.peel.visible = st === 'load' && this.slideK < 0.98;
    if (this.peel.visible) {
      const k = smoother(this.slideK);
      this.peel.position.set(
        lerp(P.couche.x, P.oven.x, k),
        lerp(WORLD.benchTop + 0.02, WORLD.deckY + 0.004, k),
        lerp(P.peelWait.z + 0.1, P.oven.z + 0.30, k)
      );
      this.peel.rotation.set(0, 0, 0);
    }
    this.rack.visible = ['out', 'tap', 'done'].includes(st);

    this.bubbleGroup.visible = (st === 'press');
    this.stage3.setOvenHeat(this.heat);
    const inside = ['load', 'steam', 'bake', 'out'].includes(st) ? clamp(this.heat * 1.25, 0, 1) : 0;
    this.interior = approach(this.interior || 0, inside, 2.2, dt);
    this.stage3.setInterior(this.interior);
    this.parts.update(dt);
    this._placeLoaf(dt);
    this._updateCamera(dt);
  }

  /* =========================================================
     HUD
     ========================================================= */
  _layoutHud() {
    const W = this.W, H = this.H, mn = this.mn;
    const portrait = this.portrait;
    const br = clamp(mn * 0.055, 22, 46);
    const bigR = clamp(mn * 0.095, 40, 92);
    const B = this.buttons;
    B.sound = { x: W - br * 1.5, y: br * 1.5, r: br, icon: this.soundOn ? 'sound' : 'mute' };
    B.home = { x: W - br * 1.5, y: br * 4.0, r: br, icon: 'home' };
    B.go = {
      x: W - bigR * 1.3, y: H - bigR * 1.5, r: bigR, icon: 'arrowR', pulse: true,
      color: ['#fff0d8', '#ffd9a5'], ring: 'rgba(214,112,50,0.92)',
    };
    B.steam = {
      x: W * 0.5, y: portrait ? H * 0.88 : H * 0.86, r: bigR * 1.1, icon: 'steam', pulse: true,
      color: ['#eefaff', '#c8e8f8'], ring: 'rgba(90,160,205,0.92)',
    };
    const keys = ['normal', 'petite', 'batard', 'free'];
    const icons = { normal: 'baguette', petite: 'petite', batard: 'batard', free: 'sparkleLame' };
    const mr = clamp(mn * (portrait ? 0.15 : 0.125), 44, 128);
    B.menu = keys.map((k, i) => ({
      x: portrait ? W * (i % 2 === 0 ? 0.29 : 0.71) : W * (0.155 + 0.23 * i),
      y: portrait ? H * (i < 2 ? 0.58 : 0.80) : H * 0.78,
      r: mr, icon: icons[k], key: k, pulse: true,
      color: k === 'free' ? ['#fff2fb', '#ffd9ee'] : ['#fdf3e2', '#efd9b8'],
      ring: k === 'free' ? 'rgba(214,110,170,0.92)' : 'rgba(198,120,70,0.9)',
    }));
    const dr = clamp(mn * (portrait ? 0.13 : 0.11), 40, 106);
    B.done = [
      { key: 'same', icon: icons[this.typeKey] || 'baguette' },
      { key: 'other', icon: 'three' },
      { key: 'free', icon: 'sparkleLame', color: ['#fff2fb', '#ffd9ee'], ring: 'rgba(214,110,170,0.92)' },
    ].map((b, i) => Object.assign({
      x: portrait ? W * (0.20 + 0.30 * i) : W * (0.31 + 0.19 * i),
      y: portrait ? H * 0.86 : H * 0.84, r: dr, pulse: true,
    }, b));
  }

  _activeButtons() {
    const out = [this.buttons.sound];
    const st = this.stage;
    if (st !== 'menu') out.push(this.buttons.home);
    if (st === 'menu') out.push(...this.buttons.menu);
    if (st === 'done') out.push(...this.buttons.done);
    if (st === 'score' && this.loaf && this.loaf.scores.length >= (this.freeMode ? 2 : 3)) {
      this.buttons.go.icon = 'oven'; this.buttons.go.badge = this.loaf.scores.length;
      out.push(this.buttons.go);
    }
    if (st === 'proof' && this.loaf && this.loaf.proof > 0.9) {
      this.buttons.go.icon = 'lame'; this.buttons.go.badge = 0;
      out.push(this.buttons.go);
    }
    if ((st === 'load' || st === 'out') && this.slideK <= 0) {
      this.buttons.go.icon = 'arrowR'; this.buttons.go.badge = 0;
      out.push(this.buttons.go);
    }
    if (st === 'steam' && this.steamK <= 0) out.push(this.buttons.steam);
    return out;
  }

  _hudDown(x, y) {
    for (const b of this._activeButtons()) {
      if (HUD.hit(b, x, y)) { b.press = true; this.pressed = b; return true; }
    }
    return false;
  }
  _hudUp(x, y) {
    const b = this.pressed; this.pressed = null;
    if (!b) return;
    b.press = false;
    if (!HUD.hit(b, x, y, 12)) return;
    Sfx.tapUI();
    if (b === this.buttons.sound) {
      this.soundOn = !this.soundOn; Sfx.setEnabled(this.soundOn);
      b.icon = this.soundOn ? 'sound' : 'mute'; return;
    }
    if (b === this.buttons.home) { this.setStage('menu'); return; }
    if (this.stage === 'menu' && b.key) { this.newLoaf(b.key); return; }
    if (this.stage === 'done') {
      if (b.key === 'same') this.newLoaf(this.typeKey);
      else if (b.key === 'free') this.newLoaf('free');
      else this.setStage('menu');
      return;
    }
    if (b === this.buttons.go) {
      if (this.stage === 'score' || this.stage === 'proof') this._advance();
      else if (this.stage === 'load') this._startLoad();
      else if (this.stage === 'out') this._startOut();
      return;
    }
    if (b === this.buttons.steam) this._doSteam();
  }

  /* 3D座標 → 画面座標 */
  _project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.W, y: (-p.y * 0.5 + 0.5) * this.H, z: p.z };
  }

  drawHud() {
    const ctx = this.hctx, W = this.W, H = this.H, t = this.time;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    HUD.trail(ctx, this.trail, this.mn);
    this._drawHints(ctx);
    for (const b of this._activeButtons()) HUD.button(ctx, b, t);
    const si = STAGES.indexOf(this.stage);
    if (si >= 0) HUD.steps(ctx, W, H, si, STAGES.length);
    if (this.stage === 'done') {
      HUD.steps(ctx, W, H, STAGES.length - 1, STAGES.length);
      if (this.celebrateT < 3.2) {
        ctx.save();
        ctx.globalAlpha = clamp(1 - (this.celebrateT - 2.2) / 1.0, 0, 1);
        HUD.celebrate(ctx, W, H, this.celebrateT);
        ctx.restore();
      }
    }
  }

  _drawHints(ctx) {
    if (this.idleT < 0.8 || this.stage === 'menu' || this.stage === 'done') return;
    const a = clamp((this.idleT - 0.8) / 0.6, 0, 1);
    const st = this.stage, t = this.time;
    const hs = this.mn / 420;
    const L = this.loaf;
    if (!L) return;
    const d = L.dims();
    const g = this.loafGroup.position;
    const sp = (x, y, z) => this._project(new THREE.Vector3(x, y, z));

    ctx.save();
    ctx.globalAlpha = a;
    if (st === 'place' && this.dropK <= 0) {
      const p = sp(P.bench.x, WORLD.benchTop, P.bench.z);
      HUD.hintTap(ctx, p.x, p.y, t, hs);
    } else if (st === 'press') {
      const b = this.bubbles.find((x) => x.pop <= 0);
      if (b) { const p = sp(g.x + b.sx, g.y + d.R, g.z + b.sy); HUD.hintTap(ctx, p.x, p.y, t, hs); }
    } else if (st === 'roll') {
      const p0 = sp(g.x, g.y + d.R, g.z + d.R * 2.6);
      const p1 = sp(g.x, g.y + d.R, g.z - d.R * 2.6);
      HUD.hintSwipe(ctx, p0.x, p0.y, p1.x, p1.y, t, hs);
    } else if (st === 'stretch') {
      const p0 = sp(g.x - d.hl * 1.15, g.y + d.R, g.z);
      const p1 = sp(g.x + d.hl * 1.15, g.y + d.R, g.z);
      if (Math.floor(t * 0.62) % 2) HUD.hintSwipe(ctx, p0.x, p0.y, p1.x, p1.y, t, hs);
      else HUD.hintSwipe(ctx, p1.x, p1.y, p0.x, p0.y, t, hs);
    } else if (st === 'couche') {
      const p0 = sp(g.x, g.y + d.R, g.z);
      const p1 = sp(P.couche.x, WORLD.benchTop + 0.05, P.couche.z);
      HUD.hintSwipe(ctx, p0.x, p0.y, p1.x, p1.y, t, hs);
    } else if (st === 'score') {
      const n = L.scores.length;
      if (n < 5) {
        const tt = 0.22 + n * 0.18;
        const cx = (tt * 2 - 1) * d.hl;
        const ang = (n ? L.lean : -1) * 0.36;
        const half = 0.22 * d.hl;
        const p0 = sp(g.x + cx - Math.cos(ang) * half, g.y + d.R * 0.9, g.z - Math.sin(ang) * half);
        const p1 = sp(g.x + cx + Math.cos(ang) * half, g.y + d.R * 0.9, g.z + Math.sin(ang) * half);
        HUD.hintSwipe(ctx, p0.x, p0.y, p1.x, p1.y, t, hs);
      }
    } else if (st === 'load' && this.slideK <= 0) {
      const p0 = sp(g.x, g.y + d.R, g.z);
      const p1 = sp(P.oven.x, WORLD.mouthY, WORLD.ovenFront + 0.05);
      HUD.hintSwipe(ctx, p0.x, p0.y, p1.x, p1.y, t, hs);
    } else if (st === 'out' && this.slideK <= 0) {
      /* 冷ますラックはカメラの後ろにあることがあるので、
         画面上で「手前へ引き出す」動きとして見せる */
      const p0 = sp(g.x, g.y + d.R, g.z);
      HUD.hintSwipe(ctx, p0.x, p0.y - this.H * 0.02, p0.x, p0.y + this.H * 0.30, t, hs);
    } else if (st === 'tap') {
      const p = sp(g.x, g.y + d.R, g.z);
      HUD.hintTap(ctx, p.x, p.y, t, hs * 1.2);
    }
    ctx.restore();
  }

  /* =========================================================
     画面サイズ
     ========================================================= */
  resize(w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr;
    this.mn = Math.min(w, h);
    this.portrait = h >= w * 1.02;
    this.hudCanvas.width = Math.round(w * dpr);
    this.hudCanvas.height = Math.round(h * dpr);
    this.stage3.resize(w, h, dpr);
    this._layoutHud();
    this._applyCamTarget(true);
    this._updateCamera(1);
  }

  render() { this.stage3.render(); this.drawHud(); }
}

export { STAGES };
