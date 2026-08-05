// 『はかって！トントン！ちいさな大工さん』
// 4 さいの子が、一本の指だけで木を測って・線を引いて・切って・組んで・打って・塗る。
import * as THREE from 'three';
import { Stage } from './core/stage.js';
import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { DustField, ChipField, Rings, Sparkles, GuideArrows } from './core/fx.js';
import { paintSystem, syncPaintUniforms } from './core/materials.js';
import { updateTweens, clamp, wait } from './core/util.js';
import { Workshop } from './world/workshop.js';
import { Robot } from './world/robot.js';
import {
  makeTapeMeasure, makePencil, makeClamp, makeSaw, makeSander, makeHammer, makeBrush, makePaintCan,
} from './world/tools.js';
import { makePartMesh } from './world/workpiece.js';
import { resetWoodSand } from './world/workpiece.js';
import { Hud } from './ui/hud.js';
import { PROJECTS, WOODS, FINISHES, APRONS, getWood } from './game/blueprints.js';
import { runProject } from './game/flow.js';
import { FreePlayStep } from './game/freeplay.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('c');
    this.stage = new Stage(this.canvas);
    this.world = this.stage.scene;
    // 遊びの中で作られるものは全部ここに入れて、作り直しのときにまとめて消す
    this.scene = new THREE.Group();
    this.world.add(this.scene);

    this.audio = audio;
    this.input = new Input(this.stage, this.canvas);
    this.hud = new Hud(this);

    this.apron = APRONS[0];
    this.workshop = new Workshop(this.world, this.apron);
    this.robot = new Robot(this.world, this.apron);
    this.robot.setPosition(0.0, -0.15, -0.74);

    this.dust = new DustField(this.world, 320);
    this.chips = new ChipField(this.world, 90);
    this.rings = new Rings(this.world, 12);
    this.sparkles = new Sparkles(this.world, 120);
    this.guides = new GuideArrows(this.world, 8);

    this.tools = {
      tape: makeTapeMeasure(),
      pencil: makePencil(),
      clamp: makeClamp(),
      clamp2: makeClamp(),
      saw: makeSaw(),
      sander: makeSander(),
      hammer: makeHammer(),
      brush: makeBrush(),
      can: makePaintCan('#ff9ec4'),
    };
    for (const k of Object.keys(this.tools)) {
      const t = this.tools[k];
      t.group.visible = false;
      t.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    }

    this.wood = getWood('pine');
    this.finish = FINISHES[1];
    this.activeStep = null;
    this.aborted = false;
    this._lastHint = 0;
    this._clock = new THREE.Clock();
    this._t = 0;

    window.addEventListener('resize', () => this.stage.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.stage.resize(), 220));
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.stage.resize());

    // 最初のタップで音を鳴らせるようにする（iOS の作法）
    const unlock = () => {
      this.audio.init();
      this.audio.resume();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  /* ---------------- 立ち上げ ---------------- */
  async boot() {
    this.hud.showLoading(true);
    await wait(0.1);
    this.thumbs = {};
    for (const p of PROJECTS) {
      const showcase = buildShowcase(p, getWood(p.wood));
      this.thumbs[p.id] = this.stage.renderThumbnail(showcase, 320, { yaw: 0.8, pitch: 0.34 });
      disposeGroup(showcase);
      await wait(0.02);
    }
    this.hud.buildTitle(this.thumbs, (p, wood) => this.onPick(p, wood));
    this.hud.showLoading(false);
    this.goHome();
  }

  /* ---------------- 画面遷移 ---------------- */
  goHome() {
    this.aborted = true;
    if (this.activeStep) this.activeStep.finish();
    wait(0.05).then(() => {
      this.resetPlay();
      this.aborted = false;
      this.hud.showTitle(true);
      this.hud.setGoalImage(null);
      this.stage.focus(new THREE.Vector3(0, 0.05, 0), 0.72, { yaw: -0.24, pitch: 0.42 });
      this.robot.lookAt(new THREE.Vector3(0, 0.2, 0.7));
      this.say('');
    });
  }

  resetPlay() {
    // 遊びの途中のものを全部片づける
    for (let i = this.scene.children.length - 1; i >= 0; i--) {
      this.scene.remove(this.scene.children[i]);
    }
    for (const k of Object.keys(this.tools)) {
      const t = this.tools[k];
      if (t.group.parent) t.group.parent.remove(t.group);
      t.group.visible = false;
      t.group.scale.setScalar(1);
    }
    this.assembly = null;
    this.chips.clear();
    paintSystem.enabled = 0;
    paintSystem.fill = 0;
    paintSystem.clear();
    resetWoodSand();
    this.robot.releaseHands();
    this.robot.setGoggles(false);
    this.hud.showPalette(false);
    this.hud.showStickers(false);
    this.hud.showFreeBar(false);
    this.hud.hideEndChoices();
  }

  onPick(project, wood) {
    this.audio.init();
    this.audio.resume();
    this.hud.showTitle(false);
    if (project === 'free') {
      this.wood = wood || WOODS[0];
      this.startFree();
    } else {
      this.wood = wood || getWood(project.wood);
      this.startProject(project);
    }
  }

  async startProject(project) {
    this.resetPlay();
    this.aborted = false;
    this.currentProject = project;
    const choice = await runProject(this, project);
    if (this.aborted || !choice) return;
    if (choice === 'again') {
      this.resetPlay();
      await wait(0.2);
      this.startProject(project);
    } else if (choice === 'free') {
      this.resetPlay();
      await wait(0.2);
      this.startFree();
    } else {
      this.goHome();
    }
  }

  async startFree() {
    this.resetPlay();
    this.aborted = false;
    this.currentProject = null;
    const step = new FreePlayStep(this, {});
    await step.run();
  }

  /* ---------------- 共通のはたらき ---------------- */
  setActiveStep(step) {
    this.activeStep = step;
    if (step) {
      this.input.setHandlers({
        down: (e) => { this._lastHint = this._t; this.guides.hide(); step.down(e); },
        move: (e) => step.move(e),
        up: (e) => step.up(e),
      });
      this.input.poke();
      this._lastHint = this._t;
    } else {
      this.input.clearHandlers();
    }
  }

  focusOn(center, radius, opts = {}) {
    this.stage.focus(center, radius, opts);
  }

  worldToScreen(v) {
    const p = v.clone().project(this.stage.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: (p.x * 0.5 + 0.5) * r.width, y: (-p.y * 0.5 + 0.5) * r.height };
  }

  say(text) {
    this.hud.say(text);
    if (text) this.audio.say(text);
  }

  setApron(a) {
    this.apron = a;
    this.robot.setApron(a);
    this.workshop.setApron(a);
  }

  /* ---------------- 毎フレーム ---------------- */
  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this._clock.getDelta());
    this._t += dt;

    updateTweens(dt);
    if (this.activeStep && !this.activeStep.done) this.activeStep.update(dt);

    // 数秒迷ったら、そっと次の操作を知らせる
    if (this.activeStep && !this.activeStep.done && !this.input.down) {
      const idle = this.input.idleSeconds();
      if (idle > (this.activeStep.hintDelay || 4) && this._t - this._lastHint > 5.2) {
        this._lastHint = this._t;
        try { this.activeStep.hint(); } catch (e) { /* noop */ }
      }
    }

    this.robot.update(dt, this._t);
    this.workshop.update(dt, this._t);
    this.dust.update(dt);
    this.chips.update(dt);
    this.rings.update(dt);
    this.sparkles.update(dt);
    this.guides.update(dt);
    this.stage.update(dt);
    syncPaintUniforms();
    this.stage.render();
  }
}

/** 完成見本の 3D モデル（サムネイルと見本カードに使う） */
function buildShowcase(project, wood) {
  const g = new THREE.Group();
  project.parts.forEach((part) => {
    const m = makePartMesh(part.size, wood, part.hole || null);
    m.position.fromArray(part.pos);
    m.rotation.fromArray(part.rot);
    g.add(m);
  });
  return g;
}

function disposeGroup(g) {
  g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
}

const game = new Game();
window.__game = game;
game.boot();
