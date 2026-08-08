// ゲーム進行。固有動作鎖：穴をあける → 刃で囲む → 一本ずつ差し込む →
// 地下を透かす → 根鉢ごとスポンと抜く → 運ぶ → 穴へスポッ → 刃を抜く → 水。
import * as THREE from '../vendor/three.module.js';
import * as A from './audio.js';
import { World, DIM, SOIL_TYPES, setCutaway, disposeTree } from './world.js';
import { Tree, SPECIES } from './tree.js';
import { Plug } from './rootball.js';
import { TreeSpade, CONE, LIFT_MAX, makeWorker } from './spade.js';
import { Particles } from './particles.js';
import { CameraDirector, SHOTS } from './camera.js';
import { buildProps } from './props.js';
import {
  clamp, clamp01, lerp, smoothstep, easeOutCubic, easeInOutCubic, easeOutQuint,
  easeInQuad, easeOutQuad, easeOutBack, Tweener, makeRng, rr,
} from './util.js';

export const DESTINATIONS = {
  park: { key: 'park', label: 'こうえん', grass: [96, 132, 62], soil: 'kuroboku', sky: [126, 178, 232] },
  field: { key: 'field', label: 'ひろば', grass: [122, 146, 66], soil: 'akatsuchi', sky: [138, 186, 236] },
  school: { key: 'school', label: 'がっこう', grass: [100, 128, 58], soil: 'sandy', sky: [150, 190, 226] },
};

const SITE_TREE = new THREE.Vector3(0, 0, 0);
const SITE_HOLE = new THREE.Vector3(15, 0, 0);
const DUMP_X = SITE_HOLE.x + 4.6;
const UP = new THREE.Vector3(0, 1, 0);

const P = {
  IDLE: 'idle',
  HOLE_BLADES: 'holeBlades', HOLE_LIFT: 'holeLift', HOLE_DUMP: 'holeDump',
  DRIVE: 'drive', APPROACH: 'approach',
  BLADES_IN: 'bladesIn', LIFT: 'lift', ADMIRE: 'admire',
  HAUL: 'haul', ALIGN: 'align', LOWER: 'lower',
  BLADES_OUT: 'bladesOut', BACKOFF: 'backoff', WATER: 'water', FINISH: 'finish',
  AUTO: 'auto',
};

const STEP_OF = {
  [P.HOLE_BLADES]: 0, [P.HOLE_LIFT]: 1, [P.HOLE_DUMP]: 1,
  [P.DRIVE]: 2, [P.APPROACH]: 2,
  [P.BLADES_IN]: 3, [P.LIFT]: 4, [P.ADMIRE]: 4,
  [P.HAUL]: 5, [P.ALIGN]: 5, [P.LOWER]: 6,
  [P.BLADES_OUT]: 7, [P.BACKOFF]: 7, [P.WATER]: 7, [P.FINISH]: 7,
};
const STEP_COUNT = 8;

export class Game {
  constructor(renderer, ui) {
    this.renderer = renderer;
    this.ui = ui;
    this.world = new World(renderer);
    this.dir = new CameraDirector();
    this.tw = new Tweener();
    this.particles = new Particles(this.world.scene, 1);
    this.clock = 0;
    this.phase = P.IDLE;
    this.mode = 'story';
    this.rng = makeRng(20260808);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this.dragBlade = null;
    this.digActivity = 0;
    this.digDepth = 0;
    this.machineX = SITE_HOLE.x;
    this.prevMachineX = SITE_HOLE.x;
    this.liftY = 0;
    this.carried = false;
    this.waterAmt = 0;
    this.puddle = 0;
    this.wetTarget = 0;
    this.bladesOrder = [];
    this.levers = [];
    this.cutAmt = 0;
    this.cutTarget = 0;
    this.cutSite = SITE_TREE.clone();
    this.birdTimer = 8;
    this._bindCanvas();
  }

  /* ================= レベル構築 ================= */
  build({ treeKey = 'oak', destKey = 'park', mode = 'story' } = {}) {
    this.dispose();
    this.mode = mode;
    this.treeKey = treeKey;
    this.destKey = destKey;
    const dest = DESTINATIONS[destKey];
    const soil = SOIL_TYPES[dest.soil];
    this.dest = dest;
    this.soil = soil;
    const scene = this.world.scene;

    this.world.buildGround([SITE_TREE, SITE_HOLE], dest.grass, soil);
    this.treeSite = this.world.addSite(SITE_TREE, soil);
    this.holeSite = this.world.addSite(SITE_HOLE, soil);

    // 木 → 根鉢（切れた根の位置を根鉢に渡す）
    const seed = (Date.now() % 99991) | 0;
    this.tree = new Tree(treeKey, seed, { topR: DIM.BALL_TOP_R, botR: DIM.BALL_BOT_R, depth: DIM.BALL_DEPTH });
    this.treePlug = new Plug(soil, { grassTone: dest.grass, withCutRoots: this.tree.cutRoots, seed: 1 + (seed % 37) });
    this.treePlug.group.add(this.tree.group);
    this.treePlug.group.position.copy(SITE_TREE);
    scene.add(this.treePlug.group);

    this.holePlug = new Plug(soil, { grassTone: dest.grass, seed: 40 + (seed % 29) });
    this.holePlug.group.position.copy(SITE_HOLE);
    scene.add(this.holePlug.group);

    this.machine = new TreeSpade();
    scene.add(this.machine.group);

    this.props = buildProps(destKey, dest.grass);
    scene.add(this.props);

    // 掘り出した土の山（最初は隠す）
    const moundGeo = new THREE.SphereGeometry(2.05, 22, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    moundGeo.scale(1, 0.24, 1);
    const mp = moundGeo.attributes.position;
    for (let i = 0; i < mp.count; i++) {
      const n = (this.rng() - 0.5) * 0.16;
      mp.setXYZ(i, mp.getX(i) * (1 + n), mp.getY(i) * (1 + n * 2), mp.getZ(i) * (1 + n));
    }
    moundGeo.computeVertexNormals();
    this.mound = new THREE.Mesh(moundGeo, this.holePlug.sideMat);
    this.mound.position.set(DUMP_X, 0.01, 0);
    this.mound.visible = false;
    this.mound.castShadow = true;
    this.mound.receiveShadow = true;
    scene.add(this.mound);

    // 水やりの作業員 + ホース
    const wk = makeWorker(this.machine.M, false);
    this.waterWorker = wk;
    this.waterWorker.group.visible = false;
    scene.add(this.waterWorker.group);
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.035, 0.42, 8), this.machine.M.chrome);
    nozzle.rotation.z = Math.PI / 2.6;
    nozzle.position.set(0.30, 1.05, 0.10);
    this.waterWorker.group.add(nozzle);
    this.nozzle = nozzle;
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.22, 1.0, 0.1), new THREE.Vector3(-0.5, 0.5, 0.5),
      new THREE.Vector3(-2.0, 0.08, 1.2), new THREE.Vector3(-4.5, 0.06, 1.6),
    ]);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 20, 0.055, 6, false), this.machine.M.hose);
    this.waterWorker.group.add(hose);

    // 穴の位置を示す目印リング
    const markMat = new THREE.MeshBasicMaterial({
      color: 0xffe066, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    this.markMat = markMat;
    this.mark = new THREE.Mesh(new THREE.RingGeometry(DIM.HOLE_R + 0.30, DIM.HOLE_R + 0.72, 40), markMat);
    this.mark.rotation.x = -Math.PI / 2;
    this.mark.position.set(SITE_HOLE.x, 0.05, SITE_HOLE.z);
    this.mark.renderOrder = 6;
    scene.add(this.mark);

    this.particles.setSoilColor(soil.color);
    this.setMachineX(SITE_HOLE.x);
    this.machine.setLift(0);
    this.machine.setGate(0);
    for (let i = 0; i < 4; i++) this.machine.setBlade(i, 0);
    this.liftY = 0;
    this.carried = false;
    this.waterAmt = 0; this.puddle = 0; this.wetTarget = 0;
    this.cutAmt = 0; this.cutTarget = 0;
    setCutaway(SITE_TREE, 0, 5.4);
    this.treeSite.closeHole();
    this.holeSite.closeHole();
    this.built = true;
  }

  dispose() {
    if (!this.built) return;
    const scene = this.world.scene;
    const kill = (obj) => { if (!obj) return; scene.remove(obj); disposeTree(obj); };
    if (this.treePlug) kill(this.treePlug.group);
    if (this.holePlug) kill(this.holePlug.group);
    if (this.machine) kill(this.machine.group);
    kill(this.props); kill(this.mound); kill(this.mark);
    if (this.waterWorker) kill(this.waterWorker.group);
    this.world.clearSites();
    this.particles.clear();
    this.tw.clear();
    A.stopAll();
    this.built = false;
  }

  setMachineX(x) {
    this.machineX = x;
    this.machine.group.position.x = x;
    if (this.carried) this.treePlug.group.position.x = x;
  }

  get treeH() { return this.tree ? this.tree.height : 9; }

  /* ================= フェーズ ================= */
  start(mode) {
    this.mode = mode;
    A.engine.start();
    A.startAmbient();
    this.ui.show(true);
    if (mode === 'free') {
      // 自由モード：機械はすでに木を囲んだ状態
      this.setMachineX(SITE_TREE.x);
      this.machine.setGate(0);
      this.holeSite.closeHole();
      this.dir.cut(SHOTS.threeQuarter(), SITE_TREE);
      this.enter(P.BLADES_IN);
    } else {
      this.setMachineX(SITE_HOLE.x);
      this.dir.cut(SHOTS.wide(this.treeH), SITE_HOLE);
      this.dir.move(SHOTS.threeQuarter(), 2.0);
      this.enter(P.HOLE_BLADES);
    }
  }

  enter(p) {
    this.phase = p;
    this.ui.clearDock();
    this.levers = [];
    this.ui.hideHint();
    if (STEP_OF[p] !== undefined) this.ui.setSteps(STEP_COUNT, STEP_OF[p]);
    const f = this['_enter_' + p];
    if (f) f.call(this);
  }

  /* ---------- 1. 移植先に穴をあける（刃） ---------- */
  _enter_HOLE() { }
  _enter_holeBlades() {
    this.focusSite = SITE_HOLE;
    this.world.focusShadow(SITE_HOLE);
    this.dir.setFocus(SITE_HOLE);
    this.mark.visible = false;
    this.bladeLevers('down');
    this.ui.showHint('ゆびで したへ', 'down');
    this.hintShown = false;
  }

  /* ---------- 2. 土のかたまりを抜く ---------- */
  _enter_holeLift() {
    this.dir.move(SHOTS.liftLow(), 1.4);
    this.liftLever(0.62, 2.95, true);
    this.ui.showHint('ぐいっと うえへ', 'up');
  }

  /* ---------- 3. 土を捨てて木のところへ ---------- */
  _enter_drive() {
    this.dir.move(SHOTS.haul(this.treeH, -7.5), 1.6);
    this.mark.visible = false;
    const startX = this.machineX;
    A.engine.rev(0.6);
    // 幹が通れるようゲート側の刃をひらく
    this.tw.add(1.0, (k) => this.machine.setGate(k), () => A.clank(0.7), easeInOutCubic, 0.2);
    this.ui.addSlider({
      dir: 'left',
      onChange: (v) => {
        this.setMachineX(lerp(startX, SITE_TREE.x, v));
        if (v > 0.995 && this.phase === P.DRIVE) this.enter(P.APPROACH);
      },
      onRelease: (v) => { if (v > 0.93 && this.phase === P.DRIVE) this.enter(P.APPROACH); },
    });
    this.ui.showHint('ひだりへ うごかそう', 'left');
  }

  /* ---------- 4. 木を囲む（自動） ---------- */
  _enter_approach() {
    this.ui.hideHint();
    this.autoLock = true;
    const startX = this.machineX;
    this.dir.move(SHOTS.threeQuarter(), 1.8);
    this.dir.setFocus(SITE_TREE);
    this.focusSite = SITE_TREE;
    this.world.focusShadow(SITE_TREE);
    this.tw.add(1.0, (k) => this.setMachineX(lerp(startX, SITE_TREE.x, k)), null, easeOutCubic);
    this.tw.add(0.9, (k) => this.machine.setGate(1 - k), () => {
      A.clank(0.9);
      this.dir.addShake(0.045);
      this.tw.wait(0.35, () => { this.autoLock = false; this.enter(P.BLADES_IN); });
    }, easeInOutCubic, 0.85);
  }

  /* ---------- 5. 刃を一本ずつ地中へ ---------- */
  _enter_bladesIn() {
    this.focusSite = SITE_TREE;
    this.dir.setFocus(SITE_TREE);
    this.world.focusShadow(SITE_TREE);
    this.cutSite.copy(SITE_TREE);
    this.cutawayShown = false;
    this.bladeLevers('down');
    this.ui.showHint('ゆびで したへ', 'down');
    if (this.dir.tt >= 1) this.dir.move(SHOTS.threeQuarter(), 1.2);
  }

  /* ---------- 6. 木を根鉢ごと抜く（クライマックス） ---------- */
  _enter_lift() {
    this.cutTarget = 0;
    this.dir.move(SHOTS.liftLow(), 1.7);
    this.liftLever(0.55, LIFT_MAX, false);
    this.ui.showHint('ぐいっと うえへ', 'up');
    this.ui.toast('さいごは ちからいっぱい', 1400);
  }

  /* ---------- 7. ながめる ---------- */
  _enter_admire() {
    this.ui.hideHint();
    this.tw.wait(2.6, () => {
      if (this.phase !== P.ADMIRE) return;
      if (this.mode === 'free') {
        this.ui.addButton({
          label: 'もういちど', cls: '',
          icon: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>',
          onTap: () => this.freeReset(),
        });
        this.ui.showHint('もういちど あそぶ', 'tap');
      } else {
        this.ui.addButton({
          label: 'はこぶ',
          icon: '<svg viewBox="0 0 24 24"><path d="M2 16V7h11v9M13 10h4l4 4v2h-2M4 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM15 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/></svg>',
          onTap: () => this.enter(P.HAUL),
        });
        this.ui.showHint('つぎは はこぶよ', 'tap');
      }
    });
  }

  /* ---------- 8. 運ぶ ---------- */
  _enter_haul() {
    this.dir.move(SHOTS.haul(this.treeH, 6.5), 1.8);
    this.mark.visible = true;
    this.markMat.opacity = 0.0;
    this.markPulse = 0;
    A.engine.rev(0.85);
    const maxX = SITE_HOLE.x + 2.2;
    this.ui.addSlider({
      dir: 'right',
      onChange: (v) => this.setMachineX(lerp(SITE_TREE.x, maxX, v)),
      onRelease: () => {
        if (Math.abs(this.machineX - SITE_HOLE.x) < 2.6) this.enter(P.ALIGN);
      },
    });
    this.ui.showHint('みぎへ うごかそう', 'right');
  }

  /* ---------- 9. 位置合わせ（スナップ） ---------- */
  _enter_align() {
    this.ui.hideHint();
    this.autoLock = true;
    A.engine.rev(0.3);
    const from = this.machineX;
    this.tw.add(0.7, (k) => this.setMachineX(lerp(from, SITE_HOLE.x, k)), () => {
      A.click(880, 0.14);
      this.ui.toast('ぴったり！', 1000);
      this.autoLock = false;
      this.enter(P.LOWER);
    }, easeOutBack);
    this.focusSite = SITE_HOLE;
    this.world.focusShadow(SITE_HOLE);
    this.dir.setFocus(SITE_HOLE);
    this.dir.move(SHOTS.holeAbove(), 1.5);
  }

  /* ---------- 10. 穴へおろす ---------- */
  _enter_lower() {
    this.dir.move(SHOTS.lowering(), 1.6);
    this.markMat.opacity = 0.30;
    const startY = this.liftY;
    this.lowerState = { released: false };
    const lv = this.ui.addLever({
      dir: 'down', big: true, label: '',
      onGrab: () => { A.strainLoop.start(); },
      onChange: (v) => {
        if (this.lowerState.released) return;
        const p = Math.min(v, 0.86) / 0.86;
        this.setLift(lerp(startY, 0.42, p));
        A.strainLoop.set(0.25 + v * 0.3);
        if (v >= 0.86) this.doDrop();
      },
      onRelease: () => { if (!this.lowerState.released) A.strainLoop.stop(); },
    });
    this.levers = [lv];
    this.ui.showHint('そうっと したへ', 'down');
  }

  /* ---------- 11. 刃を一本ずつ抜く ---------- */
  _enter_bladesOut() {
    this.dir.move(SHOTS.threeQuarter(), 1.5);
    this.bladeLevers('up');
    this.ui.showHint('こんどは うえへ', 'up');
  }

  /* ---------- 12. 機械が離れる ---------- */
  _enter_backoff() {
    this.ui.hideHint();
    this.autoLock = true;
    A.engine.rev(0.55);
    const from = this.machineX;
    this.markMat.opacity = 0;
    this.tw.add(0.8, (k) => this.machine.setGate(k), null, easeInOutCubic);
    this.tw.add(2.2, (k) => this.setMachineX(from + k * 7.5), () => {
      A.engine.rev(0.1);
      this.autoLock = false;
      this.enter(P.WATER);
    }, easeInOutCubic, 0.5);
    this.dir.move(SHOTS.water(), 2.4);
  }

  /* ---------- 13. 水をやる ---------- */
  _enter_water() {
    const w = this.waterWorker.group;
    w.visible = true;
    w.position.set(SITE_HOLE.x - 2.7, 0, 2.5);
    w.rotation.y = -Math.PI * 0.72;
    this.waterWorker.armL.rotation.x = -0.95;
    this.waterWorker.armR.rotation.x = -0.85;
    this.watering = false;
    this.ui.addButton({
      mode: 'hold', cls: 'water', label: 'みず',
      icon: '<svg viewBox="0 0 24 24"><path d="M12 3s6 6.6 6 10.6A6 6 0 0 1 6 13.6C6 9.6 12 3 12 3z"/></svg>',
      onHoldStart: () => { this.watering = true; A.waterLoop.start(); A.splash(); },
      onHoldEnd: () => { this.watering = false; A.waterLoop.stop(); },
    });
    this.ui.showHint('ながく おしてね', 'tap');
  }

  /* ---------- 14. 完成 ---------- */
  _enter_finish() {
    this.ui.hideHint();
    this.ui.setSteps(STEP_COUNT, STEP_COUNT);
    this.dir.move(SHOTS.finish(this.treeH), 2.6);
    A.chime(523.25);
    for (let i = 0; i < 3; i++) setTimeout(() => A.bird(), 900 + i * 700);
    this.tw.wait(3.2, () => { if (this.onFinish) this.onFinish(); });
  }

  /* ================= 部品：レバー生成 ================= */
  bladeLevers(dir) {
    const inserting = dir === 'down';
    this.levers = [];
    for (let i = 0; i < 4; i++) {
      const lv = this.ui.addLever({
        dir, label: String(i + 1),
        value: inserting ? this.machine.getBlade(i) : 1 - this.machine.getBlade(i),
        onGrab: () => this.onBladeGrab(i),
        onChange: (v, dragging) => this.onBladeChange(i, inserting ? v : 1 - v, dragging),
        onRelease: () => this.onBladeRelease(i),
      });
      this.levers.push(lv);
    }
  }

  liftLever(threshold, maxY, isHole) {
    this.liftState = { released: false, threshold, maxY, isHole, tension: 0 };
    const lv = this.ui.addLever({
      dir: 'up', big: true, label: '',
      onGrab: () => { A.strainLoop.start(); },
      onChange: (v) => this.onLiftChange(v),
      onRelease: () => { if (!this.liftState.released) { A.strainLoop.stop(); } },
    });
    this.levers = [lv];
  }

  /* ================= 刃の操作 ================= */
  onBladeGrab(i) {
    this.lastInteract = this.clock;
    this.ui.hideHint();
    const az = this.machine.blades[i].az;
    if (this.phase === P.BLADES_IN && !this.cutawayActive) {
      this.dir.move(SHOTS.bladeClose(az), 1.15);
    } else if (this.phase === P.HOLE_BLADES && i === 0 && !this.hintShown) {
      this.hintShown = true;
      this.dir.move(SHOTS.bladeClose(az), 1.15);
    }
  }

  onBladeChange(i, target, dragging) {
    this.lastInteract = this.clock;
    const cur = this.machine.getBlade(i);
    const d = target - cur;
    if (Math.abs(d) < 1e-5) return;
    this.machine.setBlade(i, target);
    this.digActivity = Math.min(1, this.digActivity + Math.abs(d) * 9);
    this.digDepth = target;

    const site = this.phase === P.HOLE_BLADES ? this.holeSite : this.treeSite;
    const tip = this.machine.bladeTipWorld(i, this._tmp);
    if (tip.y < 0.35 && Math.abs(d) > 0.004) {
      const az = this.machine.bladeAzimuthWorld(i);
      const dirv = this._tmp2.set(Math.cos(az), 0, Math.sin(az));
      const bias = [1.25, 0.8, 1.05, 0.9][i];
      const n = (d > 0 ? Math.abs(d) * 26 * this.soil.crumb : Math.abs(d) * 12) * bias;
      this.particles.digSpray(
        new THREE.Vector3(tip.x, 0.02, tip.z), dirv, Math.min(2.2, n), 0);
      site.disturbGrass(az, Math.min(0.9, Math.abs(d) * 22 + 0.25));
    }
    // 木がすこし揺れる
    if (this.tree && this.phase !== P.HOLE_BLADES) {
      const az = this.machine.blades[i].az;
      this.tree.addImpulse(new THREE.Vector3(Math.cos(az), 0, Math.sin(az)).multiplyScalar(d * 0.22));
    }
    // 地下カットアウェイの発動
    if (this.phase === P.BLADES_IN && !this.cutawayShown) {
      const total = this.machine.blades.reduce((s, b) => s + b.t, 0);
      if (total > 1.35) this.startCutaway();
    }
    // 到達判定は指を離す前でも行う（タップ補助でも必ず完了できるように）
    const inserting = this.phase === P.HOLE_BLADES || this.phase === P.BLADES_IN;
    if (inserting) {
      if (target > 0.995) this.bladeSeated(i);
      else if (target < 0.94) this.machine.blades[i].seated = false;
    } else if (this.phase === P.BLADES_OUT) {
      if (target < 0.005) this.bladeWithdrawn(i);
      else if (target > 0.06) this.machine.blades[i].out = false;
    }
  }

  onBladeRelease(i) {
    const inserting = this.phase === P.HOLE_BLADES || this.phase === P.BLADES_IN;
    const v = this.machine.getBlade(i);
    if (inserting && v > 0.995) this.bladeSeated(i);
    if (!inserting && v < 0.005) this.bladeWithdrawn(i);
  }

  bladeSeated(i) {
    if (this.machine.blades[i].seated) return;
    this.machine.blades[i].seated = true;
    A.hydraulicStop();
    A.thud(0.55);
    this.dir.addShake(0.05);
    const tip = this.machine.bladeTipWorld(i, this._tmp);
    this.particles.burst(new THREE.Vector3(tip.x, 0.05, tip.z), 8, 1.1, 0);
    const done = this.machine.blades.filter((b) => b.t > 0.995).length;
    if (this.phase === P.BLADES_IN) {
      if (done < 4) this.ui.toast(['ズズズッ', 'ズズズズッ', 'あと ひとつ'][Math.min(2, done - 1)] || 'ズズズッ', 900);
    }
    if (done === 4) this.allBladesIn();
  }

  bladeWithdrawn(i) {
    if (this.machine.blades[i].out) return;
    this.machine.blades[i].out = true;
    A.hydraulicStop();
    A.crumble(0.7);
    const tip = this.machine.bladeTipWorld(i, this._tmp);
    this.particles.burst(new THREE.Vector3(tip.x, 0.05, tip.z), 10, 0.8, 0);
    const site = this.phase === P.HOLE_BLADES ? this.holeSite : this.holeSite;
    const done = this.machine.blades.filter((b) => b.t < 0.005).length;
    // 土が戻り、根鉢と地面がなじむ
    site.rim.scale.setScalar(1 - done * 0.06);
    if (done === 4) {
      site.closeHole();
      this.ui.toast('なじんだ', 900);
      this.tw.wait(0.7, () => this.enter(P.BACKOFF));
    }
  }

  allBladesIn() {
    for (const b of this.machine.blades) b.seated = true;
    if (this.phase === P.HOLE_BLADES) {
      this.ui.toast('ぜんぶ はいった！', 1200);
      this.tw.wait(0.8, () => this.enter(P.HOLE_LIFT));
    } else if (this.phase === P.BLADES_IN) {
      this.ui.toast('つちの したで とじた！', 1400);
      this.endCutaway();
      this.tw.wait(1.6, () => this.enter(P.LIFT));
    }
  }

  /* ================= カットアウェイ ================= */
  startCutaway() {
    this.cutawayShown = true;
    this.cutawayActive = true;
    this.cutTarget = 1;
    this.dir.move(SHOTS.cutaway(), 1.9);
    this.ui.toast('つちの なか が みえた', 1600);
    A.click(420, 0.10);
  }
  endCutaway() {
    this.cutawayActive = false;
    this.cutTarget = 0;
  }

  /* ================= リフト（クライマックス） ================= */
  onLiftChange(v) {
    const st = this.liftState;
    if (!st || st.released) return;
    const th = st.threshold;
    if (v < th) {
      // 張力を高めるだけ。木はまだ上がらない。
      const k = v / th;
      st.tension = k;
      A.strainLoop.set(k);
      this.setLift(k * 0.075);
      // 車体が沈み込む＝力がかかっている
      this.machine.setChassisRecoil(k * 0.9);
      const site = st.isHole ? this.holeSite : this.treeSite;
      site.setCrack(smoothstep(0.30, 0.95, k));
      this.dir.addShake(0.006 + k * 0.024);
      if (this.tree && !st.isHole) {
        // 幹がきしんで、樹冠が遅れて揺れる
        this.tree.addImpulse(new THREE.Vector3(
          Math.sin(this.clock * 9) * 0.025 * k, -0.03 * k, Math.cos(this.clock * 7.3) * 0.025 * k));
      }
      if (Math.random() < k * 0.30) {
        const plug = st.isHole ? this.holePlug : this.treePlug;
        this.particles.crumbleFrom((r) => new THREE.Vector3(
          Math.cos(r() * 6.28) * DIM.HOLE_R * 1.02, -0.05, Math.sin(r() * 6.28) * DIM.HOLE_R * 1.02),
          1, plug.group.matrixWorld, 0, 0.25);
      }
    } else {
      this.doPop();
    }
  }

  /** 「スポン！」— 時間差でつくる解放感 */
  doPop() {
    const st = this.liftState;
    if (st.released) return;
    st.released = true;
    const isHole = st.isHole;
    const site = isHole ? this.holeSite : this.treeSite;
    const plug = isHole ? this.holePlug : this.treePlug;
    const maxY = st.maxY;
    if (this.levers[0]) { this.levers[0].lock(true); this.levers[0].nudgeTarget = 1; }
    this.ui.hideHint();

    // 0) 抜ける直前から、カメラはもう静かに後退をはじめる
    if (!isHole) this.dir.move(SHOTS.dollyOut(this.treeH), 3.0, easeInOutCubic);

    // 1) さいごの抵抗（機械も木もわずかに沈む）
    A.strainLoop.set(1);
    A.crumble(0.5);
    this.tw.add(0.26, (k) => {
      const dip = Math.sin(k * Math.PI);
      this.setLift(0.075 - dip * 0.06);
      this.machine.setChassisRecoil(0.9 + dip * 0.7);
      this.dir.addShake(0.03 + k * 0.035);
      if (this.tree && !isHole) this.tree.addImpulse(new THREE.Vector3(0, -0.05 * dip, 0));
    }, () => {
      // 2) 解放：スポン！
      A.strainLoop.stop();
      A.pop(isHole ? 0.86 : 1.0);
      A.crumble(1.2);
      this.dir.addShake(isHole ? 0.14 : 0.30);
      site.setCrack(1);
      site.openHole();
      plug.setDangling(true);
      this.carried = !isHole;
      if (isHole) this.carriedHolePlug = true;
      const rim = new THREE.Vector3(site.pos.x, 0.05, site.pos.z);
      this.particles.burst(rim, isHole ? 22 : 40, isHole ? 2.1 : 3.0, 0);
      // 樹冠は幹に遅れてついてくる（下へ取り残されてから跳ね上がる）
      if (this.tree && !isHole) this.tree.addImpulse(new THREE.Vector3(0.09, -0.42, 0.05));
      this.ui.toast(isHole ? 'スポン！' : 'スポン！！', 1500);

      if (isHole) this.tw.wait(0.10, () => this.dir.move(SHOTS.wide(this.treeH), 1.8, easeOutCubic));

      // 3) 一気に上がる → 機械が少し跳ね返る → ゆっくり上げきる
      const fast = isHole ? 0.46 : 0.68;
      this.tw.add(0.19, (k) => {
        this.setLift(lerp(0.015, fast, k));
        this.machine.setChassisRecoil(1.6 * (1 - k) - 0.5 * k);
      }, () => {
        A.clank(0.55);
        // 跳ね返り：機械が少しだけ上へ戻ってから落ち着く
        this.tw.add(0.55, (k) => {
          const bounce = Math.sin(k * Math.PI) * (isHole ? 0.07 : 0.15) * (1 - k * 0.4);
          this.setLift(fast + bounce);
          this.machine.setChassisRecoil(-0.5 * Math.cos(k * Math.PI * 2) * (1 - k));
        }, () => {
          this.machine.setChassisRecoil(0);
          const dur = isHole ? 1.1 : 1.9;
          const from = this.liftY;
          this.tw.add(dur, (k) => {
            this.setLift(lerp(from, maxY, k));
            if (Math.random() < 0.5) {
              this.particles.crumbleFrom((r) => plug.randomSurfacePoint(r), 1,
                plug.group.matrixWorld, 0, 0.35);
            }
          }, () => {
            if (isHole) {
              this.tw.wait(0.6, () => this.enter(P.HOLE_DUMP));
            } else {
              this.enter(P.ADMIRE);
            }
          }, easeOutCubic);
        });
      }, easeOutQuint);
      // 土がパラパラ落ちる
      for (let i = 0; i < 6; i++) {
        this.tw.wait(0.15 + i * 0.22, () => {
          A.crumble(0.5);
          this.particles.crumbleFrom((r) => plug.randomSurfacePoint(r), 3,
            plug.group.matrixWorld, 0, 0.4);
        });
      }
    }, easeInOutCubic);
  }

  /** 「スポッ」— 穴へ収まる */
  doDrop() {
    if (this.lowerState.released) return;
    this.lowerState.released = true;
    A.strainLoop.stop();
    if (this.levers[0]) { this.levers[0].lock(true); this.levers[0].nudgeTarget = 1; }
    this.ui.hideHint();
    const from = this.liftY;
    this.tw.add(0.34, (k) => this.setLift(lerp(from, 0, k)), () => {
      A.thud(1.0);
      A.crumble(1.0);
      this.dir.addShake(0.13);
      this.ui.toast('スポッ！', 1400);
      const p = new THREE.Vector3(SITE_HOLE.x, 0.05, SITE_HOLE.z);
      this.particles.burst(p, 24, 1.4, 0);
      this.treePlug.setDangling(false);
      this.carried = false;
      this.holeSite.setCrack(0.55);
      if (this.tree) this.tree.addImpulse(new THREE.Vector3(0, 0, 0).setY(0));
      // 小さく沈み込んで落ち着く
      this.tw.add(0.5, (k) => this.setLift(-0.05 * Math.sin(k * Math.PI)), () => {
        this.tw.wait(0.8, () => this.enter(P.BLADES_OUT));
      });
    }, easeInQuad);
  }

  /* ---------- 土を捨てる ---------- */
  _enter_holeDump() {
    this.ui.hideHint();
    this.autoLock = true;
    this.dir.move(SHOTS.wide(this.treeH), 1.6);
    A.engine.rev(0.5);
    const from = this.machineX;
    this.tw.add(1.3, (k) => this.setMachineX(lerp(from, DUMP_X, k)), () => {
      // 刃をひらく → 土がドサッと落ちる
      this.tw.add(0.85, (k) => {
        for (let i = 0; i < 4; i++) this.machine.setBlade(i, 1 - k);
        this.holePlug.group.position.set(DUMP_X, lerp(this.liftY, 0.1, Math.pow(k, 2.4)), 0);
      }, () => {
        A.thud(0.8); A.crumble(1.4);
        this.dir.addShake(0.09);
        this.holePlug.group.visible = false;
        this.mound.visible = true;
        this.mound.scale.set(0.2, 0.2, 0.2);
        this.tw.add(0.5, (k) => this.mound.scale.setScalar(lerp(0.2, 1, k)), null, easeOutBack);
        this.particles.burst(new THREE.Vector3(DUMP_X, 0.4, 0), 34, 2.2, 0);
        this.setLift(0);
        for (const b of this.machine.blades) { b.seated = false; b.out = false; }
        this.tw.wait(0.9, () => {
          this.autoLock = false;
          this.holeSite.setCrack(0);
          this.enter(P.DRIVE);
        });
      }, easeInOutCubic);
    }, easeInOutCubic);
  }

  setLift(y) {
    this.liftY = y;
    this.machine.setLift(y);
    if (this.carried) {
      this.treePlug.group.position.set(this.machineX, y, 0);
    } else if (this.carriedHolePlug) {
      this.holePlug.group.position.set(this.machineX, y, 0);
    } else if (this.phase === P.LOWER || this.lowerState) {
      this.treePlug.group.position.set(SITE_HOLE.x, Math.max(0, y), SITE_HOLE.z);
    }
  }

  /* ================= 自由モードのリセット ================= */
  freeReset() {
    this.ui.clearDock();
    this.ui.hideHint();
    this.autoLock = true;
    const from = this.liftY;
    this.dir.move(SHOTS.threeQuarter(), 1.6);
    this.tw.add(1.1, (k) => this.setLift(lerp(from, 0, k)), () => {
      A.thud(0.9); this.dir.addShake(0.10);
      this.carried = false;
      this.treePlug.group.position.set(SITE_TREE.x, 0, SITE_TREE.z);
      this.treePlug.setDangling(false);
      this.treeSite.closeHole();
      this.treeSite.setCrack(0);
      this.tw.add(0.9, (k) => {
        for (let i = 0; i < 4; i++) this.machine.setBlade(i, 1 - k);
      }, () => {
        for (const b of this.machine.blades) { b.seated = false; b.out = false; }
        this.autoLock = false;
        this.enter(P.BLADES_IN);
      }, easeInOutCubic, 0.25);
    }, easeInOutCubic);
  }

  /* ================= 3D 直接ドラッグ ================= */
  _bindCanvas() {
    const cv = this.renderer.domElement;
    let pid = null, startY = 0, startV = 0;
    // 正確に刃を触れなくても、意図が明らかなら一番近い刃へ吸着させる
    const pick = (e) => {
      if (!this.machine || this.autoLock) return null;
      const r = cv.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.dir.camera);
      const hits = this.raycaster.intersectObjects(this.machine.pickMeshes(), false);
      if (hits.length) {
        const o = hits[0].object;
        const i = this.machine.blades.findIndex((b) => b.pick === o);
        if (i >= 0) return i;
      }
      // 画面上でいちばん近い「まだ終わっていない刃」を探す
      const inserting = this.phase !== P.BLADES_OUT;
      const snapR = Math.min(r.width, r.height) * 0.30;
      let best = -1, bestD = Infinity;
      for (let i = 0; i < 4; i++) {
        const t = this.machine.getBlade(i);
        if (inserting ? t > 0.995 : t < 0.005) continue;
        const p = this.machine.bladeMidWorld(i, this._tmp).clone().project(this.dir.camera);
        if (p.z > 1) continue;
        const sx = r.left + (p.x * 0.5 + 0.5) * r.width;
        const sy = r.top + (-p.y * 0.5 + 0.5) * r.height;
        const d = Math.hypot(e.clientX - sx, e.clientY - sy);
        if (d < bestD) { bestD = d; best = i; }
      }
      return bestD < snapR ? best : null;
    };
    cv.addEventListener('pointerdown', (e) => {
      if (this.phase !== P.BLADES_IN && this.phase !== P.HOLE_BLADES && this.phase !== P.BLADES_OUT) return;
      const i = pick(e);
      if (i === null || i < 0) return;
      pid = e.pointerId; this.dragBlade = i;
      startY = e.clientY; startV = this.machine.getBlade(i);
      cv.setPointerCapture(pid);
      this.onBladeGrab(i);
      this.machine.highlight(i, 1);
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.dragBlade === null || e.pointerId !== pid) return;
      const inserting = this.phase !== P.BLADES_OUT;
      const range = Math.max(140, cv.getBoundingClientRect().height * 0.42);
      const v = clamp01(startV + (e.clientY - startY) / range);
      const i = this.dragBlade;
      this.onBladeChange(i, v, true);
      const lv = this.levers[i];
      if (lv) lv.setValue(inserting ? v : 1 - v, true);
    });
    const end = () => {
      if (this.dragBlade === null) return;
      const i = this.dragBlade;
      this.machine.highlight(i, 0);
      this.dragBlade = null;
      const v = this.machine.getBlade(i);
      const lv = this.levers[i];
      const inserting = this.phase !== P.BLADES_OUT;
      if (lv) {
        if (inserting && v > 0.70) lv.nudgeTarget = 1;
        else if (!inserting && v < 0.30) lv.nudgeTarget = 1;
      }
      this.onBladeRelease(i);
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }

  // タイトル画面用：ゆっくり回る全景
  idleShowcase() {
    this.phase = P.IDLE;
    this.focusSite = SITE_TREE;
    this.world.focusShadow(SITE_TREE);
    this.dir.cut(SHOTS.title(this.treeH), SITE_TREE);
    this.machine.setGate(0);
    this.ui.show(false);
  }

  /* ================= 毎フレーム ================= */
  update(dt) {
    this.clock += dt;
    this.tw.update(dt);
    this.ui.update(dt);
    if (!this.built) { this.dir.update(dt); return; }

    // 掘削音
    this.digActivity *= Math.exp(-dt * 6.5);
    if (this.digActivity > 0.03) {
      A.digLoop.start();
      A.digLoop.set(this.digActivity, this.digDepth);
    } else {
      A.digLoop.stop();
    }

    // カットアウェイの補間
    const cs = this.cutTarget > this.cutAmt ? 2.2 : 2.6;
    this.cutAmt += (this.cutTarget - this.cutAmt) * Math.min(1, dt * cs);
    setCutaway(this.cutSite, this.cutAmt, 5.4, this.dir.camera.position);
    this.world.setCutLight(this.cutSite, this.cutAmt);
    // 地中はどうしても暗いので、カットアウェイ中は自己発光を足して読みやすくする
    if (this.treePlug) {
      const e = this.cutAmt;
      this.treePlug.sideMat.emissive.setRGB(e * 0.16, e * 0.13, e * 0.10);
      this.holePlug.sideMat.emissive.setRGB(e * 0.16, e * 0.13, e * 0.10);
      if (this.tree) this.tree.rootMat.emissive.setRGB(e * 0.55, e * 0.47, e * 0.36);
      this.machine.M.steel.emissive.setScalar(e * 0.13);
    }

    // 走行にともなう慣性・音
    const vx = (this.machineX - this.prevMachineX) / Math.max(dt, 1e-4);
    this.prevMachineX = this.machineX;
    const speed = Math.abs(vx);
    this.machine.update(dt, vx);
    // 根鉢が宙にあるときは作業灯で照らして、土の塊がはっきり見えるようにする
    const wl = this.carried ? 46 : (this.phase === P.BLADES_IN || this.phase === P.LIFT ? 16 : 5);
    this.machine.setWorkLight(lerp(this.machine.workLight.intensity, wl, Math.min(1, dt * 3)));
    if (this.tree) {
      if (this.carried && speed > 0.02) {
        this.tree.addImpulse(new THREE.Vector3(-vx * 0.02, 0, 0));
        if (Math.random() < Math.min(0.7, speed * 0.10)) {
          this.particles.crumbleFrom((r) => this.treePlug.randomSurfacePoint(r), 1,
            this.treePlug.group.matrixWorld, 0, 0.25);
        }
      }
      this.tree.update(dt, this.clock);
      this.tree.setWind(0.030 + (this.carried ? 0.012 : 0));
    }
    if (speed > 0.05) A.engine.rev(clamp01(speed / 5));

    // しばらく触らないと、次に動かす刃がゆっくり光る
    const bladePhase = this.phase === P.HOLE_BLADES || this.phase === P.BLADES_IN || this.phase === P.BLADES_OUT;
    if (bladePhase) {
      const inserting = this.phase !== P.BLADES_OUT;
      let target = -1;
      for (let i = 0; i < 4; i++) {
        const t = this.machine.getBlade(i);
        if (inserting ? t < 0.995 : t > 0.005) { target = i; break; }
      }
      const idleFor = this.clock - (this.lastInteract || 0);
      for (let i = 0; i < 4; i++) {
        const on = (i === target && idleFor > 2.2 && this.dragBlade === null) ? 1 : 0;
        const pulse = on * (0.55 + 0.45 * Math.sin(this.clock * 3.4));
        this.machine.highlight(i, this.dragBlade === i ? 1 : pulse);
        const lv = this.levers[i];
        if (lv && lv.root) lv.root.classList.toggle('hintpulse', on > 0);
      }
    }

    // 草がもどる
    this.treeSite.settleGrass(dt);
    this.holeSite.settleGrass(dt);

    // 目印リング
    if (this.mark.visible) {
      const near = 1 - clamp01(Math.abs(this.machineX - SITE_HOLE.x) / 6);
      this.markPulse = (this.markPulse || 0) + dt * 3;
      this.markMat.opacity = (0.10 + near * 0.5) * (0.75 + Math.sin(this.markPulse) * 0.25);
      this.mark.scale.setScalar(1 + near * 0.05 * Math.sin(this.markPulse * 1.4));
    }

    // 水やり
    if (this.phase === P.WATER) this.updateWater(dt);

    // 小鳥
    this.birdTimer -= dt;
    if (this.birdTimer < 0) {
      this.birdTimer = rr(this.rng, 7, 16);
      if (this.phase === P.FINISH || this.phase === P.IDLE) A.bird();
    }

    // タイトル中はショットの方向をゆっくり回す
    if (this.phase === P.IDLE && this.dir.shot && this.dir.shot.dir) {
      this.dir.shot.dir.applyAxisAngle(UP, dt * 0.045);
    }

    // カメラ
    const f = this.focusSite || SITE_TREE;
    if (this.phase === P.HAUL || this.phase === P.DRIVE || this.phase === P.HOLE_DUMP) {
      this.dir.setFocus(this._tmp.set(this.machineX, 0, 0));
    } else if (this.phase === P.LIFT || this.phase === P.ADMIRE) {
      this.dir.setFocus(this._tmp.set(SITE_TREE.x, Math.max(0, this.liftY * 0.34), SITE_TREE.z));
    } else {
      this.dir.setFocus(f);
    }
    this.dir.update(dt);
    this.particles.update(dt);
  }

  updateWater(dt) {
    const site = this.holeSite;
    if (this.watering) {
      this.waterAmt = Math.min(1, this.waterAmt + dt * 0.28);
      this.puddle = Math.min(1, this.puddle + dt * 0.55);
      const from = this._tmp.set(SITE_HOLE.x - 2.4, 1.10, 2.35);
      const to = this._tmp2.set(SITE_HOLE.x - 0.35, 0.05, 0.45);
      this.particles.waterJet(from, to.clone().sub(from).multiplyScalar(1.05).add(from), 3);
      if (Math.random() < 0.06) A.splash();
    } else {
      this.puddle = Math.max(0, this.puddle - dt * 0.16);
    }
    site.setWet(smoothstep(0, 0.55, this.waterAmt));
    site.setPuddle(this.puddle * 0.9, 0.55 + this.puddle * 0.95);
    this.treePlug.setWetness(this.waterAmt);
    if (this.waterAmt >= 1 && !this.waterDone) {
      this.waterDone = true;
      this.watering = false;
      A.waterLoop.stop();
      this.ui.clearDock();
      this.ui.hideHint();
      this.ui.toast('しみこんだ', 1400);
      this.tw.wait(2.6, () => {
        this.waterWorker.group.visible = false;
        this.enter(P.FINISH);
      });
    }
  }

  onResize(w, h) {
    this.dir.setAspect(w / h);
  }
}

export { P };
