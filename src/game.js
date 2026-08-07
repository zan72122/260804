// ============================================================================
// ゲーム本体 — 工程のつながりが主役
//   ぬのを ひろげる → おる → しばる → あいがめに しずめる →
//   かぜに あてて あおくなる → (もういちど そめる) →
//   ほどく → ひらく → すすぐ → ほす
// ============================================================================

import * as THREE from '../vendor/three.module.js';
import {
  clamp, clamp01, lerp, smoothstep, easeInOut, easeOutCubic, damp, makeRng, now, TAU
} from './util.js';
import { createFold, inferFold, refineFold, CLOTH_SIZE, FOLD_LABELS } from './folds.js';
import {
  createBinding, addTie, addBoard, activeTies, activeBoards, bindingCount,
  buildFootprintMap, bakeResist, analysePattern, BOARD_SHAPE_LABEL
} from './resist.js';
import { Cloth } from './cloth.js';
import { createWorkshop, VAT, TABLE, BASIN, LINE } from './scene.js';
import { ThreadSet, BoardSet, Bubbles, Drips, Puffs } from './fx.js';
import { oxLabel } from './ui.js';

export const STAGE = {
  TITLE: 'title',
  FOLD: 'fold',
  BIND: 'bind',
  CARRY: 'carry',
  DIP: 'dip',
  OXIDIZE: 'oxidize',
  UNBIND: 'unbind',
  UNFOLD: 'unfold',
  RINSE: 'rinse',
  DRY: 'dry'
};

const STAGE_INFO = {
  fold: { step: '1', name: 'ぬのを おる' },
  bind: { step: '2', name: 'いとで しばる' },
  carry: { step: '3', name: 'あいがめへ' },
  dip: { step: '3', name: 'あいがめに しずめる' },
  oxidize: { step: '4', name: 'かぜに あてる' },
  unbind: { step: '5', name: 'いとを ほどく' },
  unfold: { step: '6', name: 'そっと ひらく' },
  rinse: { step: '7', name: 'みずで すすぐ' },
  dry: { step: '8', name: 'かぜに ほす' }
};

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------

export class Game {
  constructor(canvas, ui, sound, input) {
    this.canvas = canvas;
    this.ui = ui;
    this.sound = sound;
    this.input = input;
    this.time = 0;
    this.stage = STAGE.TITLE;
    this.stageTime = 0;
    this.tweens = [];
    this.seed = (Math.random() * 1e9) >>> 0;
    this.rng = makeRng(this.seed);

    this.isMobile = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
      (matchMedia && matchMedia('(pointer: coarse)').matches);

    this.SEG = this.isMobile ? 40 : 56;
    this.RES = this.isMobile ? 384 : 512;

    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ray = new THREE.Raycaster();
    this._v2 = new THREE.Vector2();
    this._v3 = new THREE.Vector3();
    this._v3b = new THREE.Vector3();
    this._lowPts = [];

    this.initRenderer();
    this.initScene();
    this.initState();
    this.bindInput();
  }

  // -- 初期化 ---------------------------------------------------------------

  initRenderer() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isMobile,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      failIfMajorPerformanceCaveat: false
    });
    this.noAdapt = /[?&]hq\b/.test(location.search);
    this.dprCap = 2;
    this.dprSteps = [2, 1.6, 1.25, 1.0];
    this.dprIndex = 0;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprCap));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 40);
    this.camera.position.set(0, 1.2, 2.0);
    this.camTarget = new THREE.Vector3(0, 0.4, 0.3);
    this.camDesired = new THREE.Vector3(0, 1.2, 2.0);
    this.camDesiredTarget = new THREE.Vector3(0, 0.4, 0.3);
  }

  initScene() {
    this.world = createWorkshop(this.renderer);
    this.scene = this.world.scene;

    this.cloth = new Cloth(this.SEG);
    this.scene.add(this.cloth.group);

    this.threads = new ThreadSet(this.cloth.group);
    this.boards = new BoardSet(this.cloth.group);

    this.bubbles = new Bubbles(this.scene, this.isMobile ? 40 : 60);
    this.drips = new Drips(this.scene, this.isMobile ? 34 : 48);
    this.wind = new Puffs(this.scene, this.isMobile ? 60 : 90, 0xffffff, THREE.NormalBlending);
    this.clouds = new Puffs(this.scene, this.isMobile ? 50 : 80, 0x4b7fc0, THREE.NormalBlending);
    this.sparkle = new Puffs(this.scene, 44, 0xfff0c0, THREE.AdditiveBlending);
    this.wind.points.material.uniforms.uScale.value = 900;
    this.clouds.points.material.uniforms.uScale.value = 700;
    this.sparkle.points.material.uniforms.uScale.value = 420;

    // 縛る位置を指すガイドリング
    const gg = new THREE.TorusGeometry(1, 0.006, 5, 32);
    this.guideRing = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({
      color: 0xffd479, transparent: true, opacity: 0.0, depthTest: false
    }));
    this.guideRing.renderOrder = 8;
    this.guideRing.visible = false;
    this.cloth.group.add(this.guideRing);

    // 布を吊るす竿（甕へ運ぶ・沈める・あおぐ あいだ出る）
    this.pole = new THREE.Group();
    const rodGeo = new THREE.CylinderGeometry(0.017, 0.016, 1.55, 10);
    rodGeo.rotateZ(Math.PI / 2);
    const bambooMat = new THREE.MeshStandardMaterial({ color: 0xa8a05e, roughness: 0.62 });
    const rod = new THREE.Mesh(rodGeo, bambooMat);
    rod.castShadow = true;
    this.pole.add(rod);
    for (let k = 0; k < 4; k++) {
      const nodeRing = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.004, 5, 14), bambooMat);
      nodeRing.rotation.y = Math.PI / 2;
      nodeRing.position.x = -0.6 + k * 0.4;
      this.pole.add(nodeRing);
    }
    this.cords = [];
    const cordMat = new THREE.MeshStandardMaterial({ color: 0xe0d6bd, roughness: 0.9 });
    for (let k = 0; k < 2; k++) {
      const cg = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6);
      cg.translate(0, -0.5, 0);
      const c = new THREE.Mesh(cg, cordMat);
      c.castShadow = true;
      this.pole.add(c);
      this.cords.push(c);
    }
    this.pole.visible = false;
    this.scene.add(this.pole);

    // 液の下にある布のシルエット（不透明な藍液ごしでも「そこにある」と分かるように）
    this.ghost = new THREE.Mesh(this.cloth.geometry, new THREE.ShaderMaterial({
      uniforms: {
        uVat: { value: new THREE.Vector3(VAT.x, 0, VAT.z) },
        uR: { value: VAT.innerR * 0.96 },
        uLiquidY: { value: VAT.liquidY },
        uOpacity: { value: 0.0 }
      },
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vW;
        void main(){ vW = (modelMatrix*vec4(position,1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `precision mediump float;
        uniform vec3 uVat; uniform float uR, uLiquidY, uOpacity;
        varying vec3 vW;
        void main(){
          if(uOpacity <= 0.001) discard;
          if(distance(vW.xz, uVat.xz) > uR) discard;
          if(vW.y > uLiquidY) discard;
          float d = clamp((uLiquidY - vW.y) * 5.0, 0.0, 1.0);
          vec3 c = mix(vec3(0.16,0.30,0.40), vec3(0.02,0.05,0.10), d);
          gl_FragColor = vec4(c, uOpacity * (1.0 - d*0.75));
        }`
    }));
    this.ghost.frustumCulled = false;
    this.ghost.renderOrder = 5;
    this.ghost.visible = false;
    this.cloth.group.add(this.ghost);

    // 防染テクスチャ
    const data = new Uint8Array(this.RES * this.RES * 4);
    data.fill(0);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    this.resistData = data;
    this.resistTex = new THREE.DataTexture(data, this.RES, this.RES, THREE.RGBAFormat);
    this.resistTex.minFilter = THREE.LinearMipmapLinearFilter;
    this.resistTex.magFilter = THREE.LinearFilter;
    this.resistTex.generateMipmaps = true;
    this.resistTex.anisotropy = 4;
    this.resistTex.needsUpdate = true;
    this.cloth.material.userData.uniforms.uResist.value = this.resistTex;
    this.cloth.material.map = this.resistTex;
    this.cloth.material.needsUpdate = true;
  }

  initState() {
    this.foldSpec = { family: 'none', seed: this.seed };
    this.fold = createFold(this.foldSpec);
    this.cloth.setFold(this.fold);
    this.cloth.foldT = 0;
    this.foldTarget = 0;
    this.foldApplied = false;
    this.foldGestures = 0;

    this.binding = createBinding();
    this.cloth.setBinding(this.binding.ties, this.binding.boards);
    this.bindMode = 'thread';
    this.boardShape = 'circle';

    this.dye = 0;
    this.ox = 0;
    this.dips = 0;
    this.wet = 0;
    this.rinse = 0;
    this.inVat = 0;
    this.submerged = false;
    this.handY = TABLE.y + 0.02;
    this.agitate = 0;
    this.dripTimer = 0;
    this.unfoldProgress = 0;
    this.revealed = false;
    this.fmap = null;
    this.patternInfo = null;
    this.dryTimer = 0;
    this.stageLocked = false;
    this.resultShown = false;
    this.tweens.length = 0;

    this.cloth.wetness = 0;
    this.cloth.sway = 0;
    this.cloth.wrinkleAmp = 0.0155;
    this.cloth.buildWrinkleField((this.seed % 9973) + 1);
    this.cloth.stopPhysics();
    this.cloth.group.position.set(TABLE.x, TABLE.y + 0.006, TABLE.z);
    this.cloth.group.rotation.set(0, 0, 0);
    this.cloth.group.scale.setScalar(1);

    this.threads.clear();
    this.boards.clear();
    this.bubbles.reset();
    this.drips.reset();
    this.wind.reset();
    this.clouds.reset();
    this.sparkle.reset();

    this.resistData.fill(0);
    for (let i = 3; i < this.resistData.length; i += 4) this.resistData[i] = 255;
    this.resistTex.needsUpdate = true;

    this.applyUniforms();
  }

  applyUniforms() {
    const u = this.cloth.material.userData.uniforms;
    u.uDye.value = this.dye;
    u.uOx.value = this.ox;
    u.uDips.value = this.dips;
    u.uWet.value = this.wet;
    u.uRinse.value = this.rinse;
    u.uInVat.value = this.inVat;
    this.cloth.wetness = this.wet;
    u.uLiquidY.value = VAT.liquidY;
    u.uTime.value = this.time;
  }

  // -- 画面サイズ -----------------------------------------------------------

  // 端末が重そうなら解像度を静かに下げる（モバイル Safari の保険）
  adaptQuality(dt) {
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.noAdapt || this.fpsAccum < 2.0) return;
    const fps = this.fpsFrames / this.fpsAccum;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    if (fps < 34 && this.dprIndex < this.dprSteps.length - 1) {
      this.dprIndex++;
      this.dprCap = this.dprSteps[this.dprIndex];
      this.resize();
    }
  }

  resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprCap));
    this.renderer.setSize(w, h, false);
    this.portrait = h >= w;
    this.camera.aspect = w / h;
    this.camera.fov = this.portrait ? 56 : 42;
    this.camera.updateProjectionMatrix();
    this.updateCameraRig(true);
  }

  // -- カメラ ---------------------------------------------------------------

  // たて画面: 甕と布の「上下」が画面の縦に乗るよう、低い視点で寄る。
  // よこ画面: 布を大きく広げ、模様の全体像が見えるよう、上から広く。
  rigFor(stage) {
    const p = this.portrait;
    const openness = 1 - this.cloth.foldT;
    const HOLD = VAT.rimY + 0.45;
    switch (stage) {
      case STAGE.TITLE:
        return { c: [0, 0.75, -0.15], r: p ? 1.05 : 1.25, el: p ? 12 : 16, az: 18 };
      case STAGE.FOLD:
      case STAGE.BIND:
        return {
          c: [TABLE.x, TABLE.y + (p ? 0.14 : 0.08), TABLE.z - (p ? 0.06 : 0.02)],
          r: p ? 0.56 : 0.56,
          el: p ? 40 : 44, az: p ? 5 : 11
        };
      case STAGE.CARRY:
      case STAGE.DIP:
        return {
          c: [VAT.x, p ? VAT.rimY + 0.22 : VAT.rimY + 0.16, VAT.z + 0.06],
          r: p ? 0.64 : 0.66,
          el: p ? 9 : 17, az: p ? 5 : 13
        };
      case STAGE.OXIDIZE:
        return {
          c: [VAT.x + 0.02, HOLD - 0.06, VAT.z + 0.16],
          r: p ? 0.56 : 0.54, el: p ? 7 : 13, az: 9
        };
      case STAGE.UNBIND:
        return {
          c: [TABLE.x, TABLE.y + 0.10, TABLE.z - 0.02],
          r: p ? 0.40 : 0.38, el: p ? 42 : 46, az: 9
        };
      case STAGE.UNFOLD:
        return {
          c: [TABLE.x, TABLE.y + 0.05, TABLE.z - 0.02],
          r: lerp(p ? 0.34 : 0.32, p ? 0.56 : 0.60, openness),
          el: lerp(p ? 44 : 48, p ? 60 : 66, openness),
          az: lerp(11, 2, openness)
        };
      case STAGE.RINSE:
        return { c: [BASIN.x + 0.04, BASIN.y + 0.04, BASIN.z], r: p ? 0.46 : 0.48, el: p ? 30 : 36, az: 22 };
      case STAGE.DRY: {
        // できあがりカードが出たら、布がカードに隠れない位置へ寄せる
        const shift = this.resultShown ? (p ? 0 : 0.34) : 0;
        const rise = this.resultShown && p ? 0.16 : 0;
        return {
          c: [shift, LINE.y - 0.46 + rise, LINE.z + 0.20],
          r: p ? 0.60 : 0.66, el: p ? 5 : 8, az: 3
        };
      }
      default:
        return { c: [0, 0.7, 0], r: 1.2, el: 20, az: 0 };
    }
  }

  updateCameraRig(instant) {
    const rig = this.rigFor(this.stage);
    const vFov = this.camera.fov * DEG;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const f = Math.min(vFov, hFov);
    let dist = rig.r / Math.tan(f / 2) * 1.10;
    dist = clamp(dist, 0.55, 7.0);
    const el = rig.el * DEG, az = rig.az * DEG;
    const cx = rig.c[0], cy = rig.c[1], cz = rig.c[2];
    this.camDesiredTarget.set(cx, cy, cz);
    this.camDesired.set(
      cx + dist * Math.sin(az) * Math.cos(el),
      cy + dist * Math.sin(el),
      cz + dist * Math.cos(az) * Math.cos(el)
    );
    if (instant) {
      this.camera.position.copy(this.camDesired);
      this.camTarget.copy(this.camDesiredTarget);
      this.camera.lookAt(this.camTarget);
    }
  }

  updateCamera(dt) {
    this.updateCameraRig(false);
    const k = this.stageTime < 0.05 ? 1 : 3.0;
    this.camera.position.x = damp(this.camera.position.x, this.camDesired.x, k, dt);
    this.camera.position.y = damp(this.camera.position.y, this.camDesired.y, k, dt);
    this.camera.position.z = damp(this.camera.position.z, this.camDesired.z, k, dt);
    this.camTarget.x = damp(this.camTarget.x, this.camDesiredTarget.x, k, dt);
    this.camTarget.y = damp(this.camTarget.y, this.camDesiredTarget.y, k, dt);
    this.camTarget.z = damp(this.camTarget.z, this.camDesiredTarget.z, k, dt);
    this.camera.lookAt(this.camTarget);
  }

  // -- 便利: 画面 → 作業台の平面 -------------------------------------------

  screenToPlane(x, y, planeY, out) {
    const r = this.canvas.getBoundingClientRect();
    this._v2.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1);
    this._ray.setFromCamera(this._v2, this.camera);
    this._plane.constant = -planeY;
    const hit = this._ray.ray.intersectPlane(this._plane, out || this._v3);
    return hit;
  }

  screenToCloth(x, y) {
    const g = this.cloth.group;
    const p = this.screenToPlane(x, y, g.position.y, this._v3);
    if (!p) return null;
    return { x: p.x - g.position.x, z: p.z - g.position.z, world: p };
  }

  worldToScreen(v3) {
    const p = this._v3b.copy(v3).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: (p.x * 0.5 + 0.5) * r.width, y: (-p.y * 0.5 + 0.5) * r.height };
  }

  // -- ステージ管理 ---------------------------------------------------------

  setStage(s) {
    this.stage = s;
    this.stageTime = 0;
    this.stageLocked = false;
    const info = STAGE_INFO[s];
    if (info) this.ui.setStage(info.step, info.name);
    this.ui.showColorbar(false);
    this.ui.showNext(null);
    this.ui.setTools(null);
    this.input.circleCenter = null;
    this.guideRing.visible = false;

    switch (s) {
      case STAGE.FOLD: this.enterFold(); break;
      case STAGE.BIND: this.enterBind(); break;
      case STAGE.CARRY: this.enterCarry(); break;
      case STAGE.DIP: this.enterDip(); break;
      case STAGE.OXIDIZE: this.enterOxidize(); break;
      case STAGE.UNBIND: this.enterUnbind(); break;
      case STAGE.UNFOLD: this.enterUnfold(); break;
      case STAGE.RINSE: this.enterRinse(); break;
      case STAGE.DRY: this.enterDry(); break;
    }
    this.updateCameraRig(false);
  }

  tween(o) {
    o.t = 0;
    o.dur = o.dur || 1;
    this.tweens.push(o);
    return o;
  }

  updateTweens(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const w = this.tweens[i];
      // ステージが変わったら、その工程だけのアニメは黙って捨てる
      // （4 歳は演出の途中でも どんどん つぎへ を押す）
      if (w.guard && this.stage !== w.guard) { this.tweens.splice(i, 1); continue; }
      w.t += dt;
      const k = clamp01(w.t / w.dur);
      const e = (w.ease || easeInOut)(k);
      if (w.step) w.step(e, k);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        if (w.done) w.done();
      }
    }
  }

  // ===== 1. おる ==========================================================

  enterFold() {
    this.cloth.group.position.set(TABLE.x, TABLE.y + 0.006, TABLE.z);
    this.cloth.group.rotation.set(0, 0, 0);
    this.cloth.sway = 0;
    this.ui.setHint('👆', 'ぬのを ゆびで なぞって、おってみよう');
    this.refreshFoldTools();
  }

  refreshFoldTools() {
    const list = [
      { id: 'accordion', glyph: '〰️', label: 'じゃばら' },
      { id: 'triangle', glyph: '🔺', label: 'さんかく' },
      { id: 'pinch', glyph: '🌀', label: 'つまみ' },
      { id: 'roll', glyph: '🌯', label: 'まきあげ' }
    ];
    if (this.foldApplied) list.push({ id: 'reset', glyph: '↩️', label: 'やりなおす' });
    this.ui.setTools(list, (id) => this.pickFoldTool(id));
    this.ui.updateToolStates(this.foldApplied ? this.foldSpec.family : null);
    if (this.foldApplied) this.ui.showNext('しばる →');
  }

  pickFoldTool(id) {
    if (this.stage !== STAGE.FOLD) return;
    this.sound.ensure();
    if (id === 'reset') {
      this.foldSpec = { family: 'none', seed: this.seed };
      this.fold = createFold(this.foldSpec);
      this.cloth.setFold(this.fold);
      this.cloth.foldT = 0;
      this.foldApplied = false;
      this.foldGestures = 0;
      this.ui.showNext(null);
      this.refreshFoldTools();
      return;
    }
    const seed = (Math.random() * 1e9) >>> 0;
    const rng = makeRng(seed);
    let spec;
    if (id === 'accordion') spec = { family: 'accordion', angle: rng.pick([0, Math.PI / 2]), panels: rng.int(4, 7), seed };
    else if (id === 'triangle') spec = { family: 'triangle', rot: rng.pick([0, Math.PI / 4]), extra: rng.chance(0.5), seed };
    else if (id === 'pinch') spec = { family: 'pinch', pleats: rng.int(5, 9), rot: rng.range(0, TAU), seed };
    else spec = { family: 'roll', angle: rng.pick([0, Math.PI / 6, Math.PI / 3, Math.PI / 2, Math.PI * 5 / 6]), seed };
    this.applyFold(spec);
  }

  applyFold(spec) {
    this.foldSpec = spec;
    this.fold = createFold(spec);
    this.cloth.setFold(this.fold);
    this.foldApplied = spec.family !== 'none';
    this.foldGestures++;
    this.cloth.foldT = 0;
    const dur = Math.max(0.45, this.fold.steps * 0.22);
    const cl = this.cloth;
    this.tween({
      dur,
      guard: STAGE.FOLD,
      ease: (t) => t,
      step: (e) => { cl.foldT = e; },
      done: () => {
        cl.foldT = 1;
        this.ui.showNext('しばる →');
        this.refreshFoldTools();
        this.ui.toast(FOLD_LABELS[spec.family], 1100);
      }
    });
    this.sound.fold();
    this.ui.setHint('👆', 'いいね！ もういちど なぞると もっと おれるよ');
  }

  handleFoldGesture(info) {
    const a = this.screenToCloth(info.startX, info.startY);
    const b = this.screenToCloth(info.x, info.y);
    if (!a || !b) return;
    const su = clamp01(a.x / CLOTH_SIZE + 0.5), sv = clamp01(a.z / CLOTH_SIZE + 0.5);
    const eu = clamp01(b.x / CLOTH_SIZE + 0.5), ev = clamp01(b.z / CLOTH_SIZE + 0.5);
    const seed = (Math.random() * 1e9) >>> 0;
    let spec;
    if (this.foldApplied) {
      spec = refineFold(this.foldSpec, su, sv, eu, ev, seed);
    } else {
      spec = inferFold(su, sv, eu, ev, seed);
      if (!spec) return;
    }
    this.applyFold(spec);
  }

  // ===== 2. しばる ========================================================

  enterBind() {
    this.cloth.foldT = 1;
    this.cloth.group.position.set(TABLE.x, TABLE.y + 0.006, TABLE.z);
    this.ui.setHint('🌀', 'ゆびで ぐるぐる まわして、いとを まこう');
    this.refreshBindTools();
    this.ui.showNext('あいがめへ →');
    this.updateCircleCenter();
  }

  updateCircleCenter() {
    const p = this._v3.set(0, this.fold.bundleHeight * 0.5, 0);
    this.cloth.group.localToWorld(p);
    const s = this.worldToScreen(p);
    this.input.circleCenter = s;
  }

  refreshBindTools() {
    const list = [
      { id: 'thread', glyph: '🧵', label: 'いと' },
      { id: 'circle', glyph: '⚪️', label: 'まる' },
      { id: 'square', glyph: '⬜️', label: 'しかく' },
      { id: 'triangle', glyph: '🔺', label: 'さんかく' },
      { id: 'star', glyph: '⭐️', label: 'ほし' },
      { id: 'hexagon', glyph: '⬢', label: 'ろっかく' }
    ];
    this.ui.setTools(list, (id) => {
      this.sound.ensure();
      if (id === 'thread') {
        this.bindMode = 'thread';
        this.ui.setHint('🌀', 'ゆびで ぐるぐる まわして、いとを まこう');
      } else {
        this.bindMode = 'board';
        this.boardShape = id;
        this.ui.setHint('👆', 'いたを おきたい ところを タップ');
      }
      this.ui.updateToolStates(id);
    });
    this.ui.updateToolStates(this.bindMode === 'thread' ? 'thread' : this.boardShape);
  }

  tryWrap(px, py) {
    const c = this.screenToCloth(px, py);
    if (!c) return;
    const a = this.fold.pointToA(c.x, c.z);
    const t = addTie(this.binding, a);
    this.cloth.setBinding(this.binding.ties, this.binding.boards);
    this.tween({
      dur: 0.28, ease: easeOutCubic,
      step: (e) => { t.tighten = Math.max(t.tighten, e); },
      done: () => { t.tighten = 1; }
    });
    this.sound.wrap();
    this.ui.showNext('あいがめへ →');
  }

  placeBoard(px, py) {
    const c = this.screenToCloth(px, py);
    if (!c) return;
    if (activeBoards(this.binding).length >= 3) return;
    const a = this.fold.pointToA(c.x, c.z);
    const b = this.fold.pointToB(c.x, c.z);
    const size = 0.14 + this.rng() * 0.10;
    const bd = addBoard(this.binding, a, b, this.boardShape, size, this.rng() * TAU);
    this.cloth.setBinding(this.binding.ties, this.binding.boards);
    // 板は必ず束の上に置く（束からはみ出さないよう内側へ寄せる）
    const bs = this.fold.bundleSize || { w: 0.3, d: 0.3 };
    const metres = clamp(Math.min(bs.w, bs.d) * 0.46, 0.045, 0.15);
    const lx = clamp(bs.w * 0.5 - metres, 0, 10);
    const lz = clamp(bs.d * 0.5 - metres, 0, 10);
    const world = new THREE.Vector3(
      clamp(c.x, -lx, lx),
      Math.min(this.fold.bundleHeight * 0.5, 0.08),
      clamp(c.z, -lz, lz)
    );
    const boardH = this.fold.family === 'pinch' ? 0.05 : Math.min(this.fold.bundleHeight, 0.16);
    this.boards.add(bd, world, metres, boardH);
    this.tween({
      dur: 0.45, ease: easeOutCubic,
      step: (e) => { bd.clamp = e; },
      done: () => { bd.clamp = 1; this.sound.clampBoard(); }
    });
    this.ui.showNext('あいがめへ →');
  }

  // ===== 3. はこぶ・しずめる ==============================================

  enterCarry() {
    // 締めきる途中で「つぎへ」を押されても、縛りは完成した状態にしてから焼く
    for (const t of this.binding.ties) if (!t.removed) t.tighten = 1;
    for (const b of this.binding.boards) if (!b.removed) b.clamp = 1;
    this.cloth.foldT = 1;
    // 防染マップをここで一度だけ焼く（このあと染めるまで見えない）
    this.fmap = buildFootprintMap(this.fold, this.RES);
    bakeResist(this.fold, this.binding, this.fmap, this.resistData);
    this.resistTex.needsUpdate = true;

    this.ui.setHint('⬇️', 'あいがめの うえまで はこぶよ…');
    const g = this.cloth.group;
    const from = { x: g.position.x, y: g.position.y, z: g.position.z };
    const toY = VAT.rimY + 0.45 - this.fold.bundleHeight;
    this.tween({
      dur: 1.15,
      guard: STAGE.CARRY,
      step: (e) => {
        g.position.x = lerp(from.x, VAT.x, e);
        g.position.z = lerp(from.z, VAT.z, e);
        g.position.y = lerp(from.y, toY, Math.sin(e * Math.PI * 0.5)) + Math.sin(e * Math.PI) * 0.12;
        g.rotation.z = Math.sin(e * Math.PI) * 0.10;
        g.rotation.y = this.fold.displayYaw * e;
        g.rotation.x = this.fold.displayTilt * 0.35 * e;
      },
      done: () => {
        g.rotation.z = 0;
        g.rotation.y = this.fold.displayYaw;
        g.rotation.x = this.fold.displayTilt * 0.35;
        this.handY = VAT.rimY + 0.45;
        this.setStage(STAGE.DIP);
      }
    });
  }

  enterDip() {
    this.handY = VAT.rimY + 0.45;
    this.handYTarget = this.handY;
    this.cloth.sway = 0.25;
    this.ui.setHint('👇', 'ゆびで ながおし！ ぬのが あいの なかへ しずむよ');
    this.ui.showDips(this.dips);
  }

  get submergeY() { return VAT.liquidY - 0.03; }

  updateDip(dt) {
    const holding = this.input.active;
    const topY = VAT.rimY + 0.45;
    const botY = this.submergeY - this.fold.bundleHeight * 0.35;
    this.handYTarget = holding ? botY : topY;
    const speed = holding ? 2.4 : 3.0;
    this.handY = damp(this.handY, this.handYTarget, speed, dt);

    const g = this.cloth.group;
    g.position.set(VAT.x, this.handY - this.fold.bundleHeight, VAT.z);

    // 液中でやさしく動かす
    const move = holding ? Math.min(1, Math.abs(this.input.vx) * 0.09) : 0;
    this.agitate = damp(this.agitate, move, 6, dt);
    g.position.x += Math.sin(this.time * 2.2) * this.agitate * 0.05;
    g.rotation.z = Math.sin(this.time * 1.8) * this.agitate * 0.16;
    this.cloth.sway = 0.25 + this.agitate * 1.6;
    this.cloth.swayPhase = this.time * 2;

    // 束の一番うえまで液に入ったら「沈んだ」
    const under = this.handY < VAT.liquidY - 0.012;
    this.inVat = damp(this.inVat, under ? 1 : 0, 8, dt);

    this.world.liquid.uniforms.uAgitate.value =
      damp(this.world.liquid.uniforms.uAgitate.value, under ? (0.35 + this.agitate * 0.7) : 0, 4, dt);
    this.world.liquid.uniforms.uFoam.value =
      damp(this.world.liquid.uniforms.uFoam.value, under ? 0.12 : 0.6, 1.4, dt);

    if (under) {
      if (!this.submerged) {
        this.submerged = true;
        this.world.addRipple(0, 0, 1.0);
        this.sound.plop();
        this.ox = 0;
        this.threads.setDyed(true);
        for (const t of this.binding.ties) t.dyed = true;
      }
      // 染まっていく
      const rate = 0.42 + this.agitate * 0.55;
      this.dye = Math.min(1, this.dye + rate * dt);
      this.wet = Math.min(1, this.wet + dt * 1.6);
      // 泡
      if (Math.random() < dt * (14 + this.agitate * 26)) {
        this.bubbles.spawn(VAT.x + (Math.random() - 0.5) * 0.3, VAT.liquidY - 0.16,
          VAT.z + (Math.random() - 0.5) * 0.3, 0.22, 0.011);
      }
      if (this.agitate > 0.25 && Math.random() < dt * 4) {
        this.world.addRipple((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.55);
        this.sound.slosh(this.agitate);
      }
      this.ui.setHint('👋', 'そのまま ゆびを よこに うごかすと、よく そまるよ');
    } else if (this.submerged) {
      // 引きあげた
      this.submerged = false;
      this.dips++;
      this.ui.showDips(this.dips);
      this.world.addRipple(0, 0, 1.2);
      this.sound.splash();
      this.dripTimer = 2.6;
      this.setStage(STAGE.OXIDIZE);
      return;
    }

    // 沈められないまま時間がたったら、ヒントを強める（4 歳の指のために）
    if (!under && !holding && this.stageTime > 5 && this.dye < 0.05) {
      this.ui.setHint('👇', 'がめんを おしたまま はなさないでね。ぬのが しずむよ');
    }
    // 一度でも染めていれば、いつでも次へ進める逃げ道を出す
    if (!under && this.dips >= 1 && this.stageTime > 2.5 && !this.stageLocked) {
      this.stageLocked = true;
      this.ui.showNext('かぜに あてる →');
    }

    // しずく
    if (this.dye > 0.02 && !under) {
      this.dripTimer = Math.max(this.dripTimer, 0.4);
    }
    this.spawnDrips(dt);
  }

  spawnDrips(dt) {
    if (this.dripTimer <= 0 || this.wet < 0.05) return;
    this.dripTimer -= dt;
    if (Math.random() < dt * (6 + this.wet * 10)) {
      this.cloth.lowestPoints(4, this._lowPts);
      if (this._lowPts.length) {
        const p = this._lowPts[Math.floor(Math.random() * this._lowPts.length)];
        this.drips.spawn(p.x, p.y - 0.01, p.z, 0.008);
        this.sound.drip();
      }
    }
  }

  // ===== 4. かぜに あてる（酸化） =========================================

  enterOxidize() {
    this.ui.setHint('👋', 'ゆびで さっと はらって、かぜを おくろう！');
    this.ui.showColorbar(true);
    this.ui.setColorbar(this.ox);
    this.cloth.sway = 0.5;
    this.oxSwipeBoost = 0;
    this.cloth.group.rotation.y = this.fold.displayYaw;
    this.handY = VAT.rimY + 0.45;
    this.inVat = 0;
    this.world.liquid.uniforms.uAgitate.value = 0;
  }

  updateOxidize(dt) {
    const g = this.cloth.group;
    const ty = VAT.rimY + 0.45 - this.fold.bundleHeight;
    g.position.x = damp(g.position.x, VAT.x + 0.02, 3, dt);
    g.position.y = damp(g.position.y, ty, 3, dt);
    g.position.z = damp(g.position.z, VAT.z + 0.16, 3, dt);
    const swing = Math.sin(this.time * 1.9) * 0.06 + this.oxSwipeBoost * Math.sin(this.time * 7) * 0.14;
    g.rotation.z = swing;
    // 平らな面をこちらに向けて掲げる（色の変化がいちばんよく見える角度）
    g.rotation.x = damp(g.rotation.x, this.fold.displayTilt + Math.sin(this.time * 1.4) * 0.05, 3, dt);
    g.rotation.y = this.fold.displayYaw;
    this.cloth.sway = 0.5 + this.oxSwipeBoost * 2.2;
    this.cloth.swayPhase = this.time * 3;

    // ゆっくり自然に酸化。あおいでいるあいだは ずっと はやい。
    const base = 0.055;
    const boost = this.oxSwipeBoost * 0.55;
    this.ox = Math.min(1, this.ox + (base + boost) * dt);
    this.oxSwipeBoost = damp(this.oxSwipeBoost, 0, 2.2, dt);
    this.wet = Math.max(0.35, this.wet - dt * 0.06);
    this.inVat = damp(this.inVat, 0, 6, dt);
    this.spawnDrips(dt);
    this.ui.setColorbar(this.ox);

    if (this.ox >= 0.999 && !this.stageLocked) {
      this.stageLocked = true;
      this.sound.chime();
      this.ui.toast('あおく なった！', 1400);
      this.ui.setHint('✨', 'ふかい あいいろに なったよ。もういちど そめる？ ひらく？');
      this.ui.showNext('ほどく →');
      this.ui.setTools([{ id: 'again', glyph: '🫙', label: 'もういちど そめる' }], (id) => {
        if (id === 'again' && this.stage === STAGE.OXIDIZE) {
          this.ui.setTools(null);
          this.stageLocked = false;
          this.setStage(STAGE.DIP);
        }
      });
    }
  }

  fanAir(strength) {
    this.oxSwipeBoost = Math.min(2.2, this.oxSwipeBoost + strength);
    this.sound.wind();
    const g = this.cloth.group;
    for (let i = 0; i < 8; i++) {
      this.wind.spawn(
        g.position.x + (Math.random() - 0.5) * 0.7,
        g.position.y + Math.random() * 0.55,
        g.position.z + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.3) * 0.9, 0.10 + Math.random() * 0.2, (Math.random() - 0.5) * 0.5,
        0.10 + Math.random() * 0.08, 0.8 + Math.random() * 0.5, 0.06
      );
    }
  }

  // ===== 5. ほどく ========================================================

  enterUnbind() {
    const g = this.cloth.group;
    const from = { x: g.position.x, y: g.position.y, z: g.position.z };
    this.cloth.sway = 0.12;
    this.ui.setHint('👉', 'いとを さっと はらって、はずそう');
    this.tween({
      dur: 0.95,
      guard: STAGE.UNBIND,
      step: (e) => {
        g.position.x = lerp(from.x, TABLE.x, e);
        g.position.y = lerp(from.y, TABLE.y + 0.006, e) + Math.sin(e * Math.PI) * 0.10;
        g.position.z = lerp(from.z, TABLE.z, e);
        g.rotation.z *= (1 - e);
        g.rotation.x *= (1 - e);
        g.rotation.y *= (1 - e);
      }
    });
    this.checkUnbindDone();
  }

  removeNearestBinding(px, py) {
    const ties = activeTies(this.binding);
    const boards = activeBoards(this.binding);
    let best = null, bestD = Infinity;
    for (const t of ties) {
      const ring = this.fold.ringAt(t.a);
      const p = this._v3.set(ring.cx, ring.cy, ring.cz);
      this.cloth.group.localToWorld(p);
      const s = this.worldToScreen(p);
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < bestD) { bestD = d; best = { type: 'tie', obj: t }; }
    }
    for (const it of this.boards.items) {
      if (it.board.removed) continue;
      const p = this._v3.copy(it.group.position);
      this.cloth.group.localToWorld(p);
      const s = this.worldToScreen(p);
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < bestD) { bestD = d; best = { type: 'board', obj: it.board, item: it }; }
    }
    if (!best) return false;

    if (best.type === 'tie') {
      const t = best.obj;
      this.sound.snap();
      this.tween({
        dur: 0.3, ease: easeOutCubic,
        step: (e) => { t.tighten = 1 - e; },
        done: () => { t.removed = true; t.tighten = 0; this.checkUnbindDone(); }
      });
      this.ui.toast('ぱちん！', 700);
    } else {
      const bd = best.obj;
      bd.open = 0;
      this.sound.snap();
      this.tween({
        dur: 0.45, ease: easeOutCubic,
        step: (e) => { bd.open = e; bd.clamp = 1 - e * 0.9; },
        done: () => { bd.removed = true; bd.gone = true; this.checkUnbindDone(); }
      });
      this.ui.toast('いたが とれた！', 800);
    }
    return true;
  }

  checkUnbindDone() {
    if (this.stage !== STAGE.UNBIND) return;
    const left = bindingCount(this.binding);
    if (left <= 0) {
      this.ui.setHint('🖐️', 'ぜんぶ とれた！ つぎは そっと ひらこう');
      this.ui.showNext('ひらく →');
    } else {
      this.ui.setHint('👉', `のこり ${left}こ。 いとや いたを さっと はらってね`);
      this.ui.showNext(null);
    }
  }

  // ===== 6. ひらく ========================================================

  enterUnfold() {
    this.pole.visible = false;
    this.unfoldProgress = 0;
    this.revealed = false;
    this.cloth.sway = 0.06;
    this.ui.setHint('🖐️', 'ゆびで ゆっくり ひろげてみて…');
    this.cloth.group.position.set(TABLE.x, TABLE.y + 0.006, TABLE.z);
    this.cloth.group.rotation.set(0, 0, 0);
  }

  updateUnfold(dt) {
    // 指を動かすと ひらく。動かさなくても ほんの少しずつ ひらく。
    if (this.input.active && this.input.moved) {
      const d = Math.hypot(this.input.dx, this.input.dy);
      this.unfoldProgress += d * 0.00095;
      if (Math.random() < dt * 8) this.sound.rustle(0.5);
    } else if (this.unfoldProgress > 0.02) {
      this.unfoldProgress += dt * 0.018;
    }
    this.unfoldProgress = clamp01(this.unfoldProgress);
    this.cloth.foldT = damp(this.cloth.foldT, 1 - this.unfoldProgress, 7, dt);
    this.wet = Math.max(0.3, this.wet - dt * 0.03);

    if (this.unfoldProgress > 0.55 && this.unfoldProgress < 0.995) {
      this.ui.setHint('🖐️', 'もう すこし…！ しろい もようが みえてきた');
    }

    if (this.unfoldProgress >= 0.999 && !this.revealed) {
      this.revealed = true;
      this.cloth.foldT = 0;
      this.patternInfo = analysePattern(this.fold, this.binding);
      this.sound.reveal();
      this.ui.toast('わあ！ ' + this.patternInfo.name + '！', 2200);
      this.ui.setHint('✨', 'じぶんが かくした ところだけ、しろく のこったよ');
      this.ui.showNext('すすぐ →');
      for (let i = 0; i < 26; i++) {
        this.sparkle.spawn(
          TABLE.x + (Math.random() - 0.5) * 0.9,
          TABLE.y + 0.1 + Math.random() * 0.35,
          TABLE.z + (Math.random() - 0.5) * 0.9,
          (Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3,
          0.05 + Math.random() * 0.05, 1.4 + Math.random(), -0.01
        );
      }
    }
  }

  // ===== 7. すすぐ ========================================================

  enterRinse() {
    const g = this.cloth.group;
    const from = { x: g.position.x, y: g.position.y, z: g.position.z };
    this.cloth.foldT = 0;
    this.cloth.sway = 0.5;
    this.rinseShake = 0;
    this.ui.setHint('👋', 'みずの なかで ゆびを よこに うごかして、すすごう');
    this.tween({
      dur: 1.0,
      guard: STAGE.RINSE,
      step: (e) => {
        g.position.x = lerp(from.x, BASIN.x, e);
        g.position.z = lerp(from.z, BASIN.z, e);
        g.position.y = lerp(from.y, BASIN.y - 0.075, e) + Math.sin(e * Math.PI) * 0.16;
        g.scale.setScalar(lerp(1, 0.82, e));
      },
      done: () => { this.sound.splash(); }
    });
  }

  updateRinse(dt) {
    const g = this.cloth.group;
    const move = this.input.active ? Math.min(1, Math.abs(this.input.vx) * 0.10) : 0;
    this.rinseShake = damp(this.rinseShake, move, 6, dt);
    g.position.x = BASIN.x + Math.sin(this.time * 5) * this.rinseShake * 0.045;
    g.rotation.y = Math.sin(this.time * 3.6) * this.rinseShake * 0.18;
    this.cloth.sway = 0.5 + this.rinseShake * 2.0;
    this.cloth.swayPhase = this.time * 4;

    if (this.rinseShake > 0.1) {
      this.rinse = Math.min(1, this.rinse + dt * this.rinseShake * 0.75);
      if (Math.random() < dt * 22 * this.rinseShake) {
        this.clouds.spawn(
          BASIN.x + (Math.random() - 0.5) * 0.5,
          BASIN.y - 0.08 + Math.random() * 0.03,
          BASIN.z + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.14, 0.005, (Math.random() - 0.5) * 0.14,
          0.09, 1.6 + Math.random(), 0.12
        );
      }
      if (Math.random() < dt * 3) this.sound.slosh(this.rinseShake);
    }
    this.wet = Math.min(1, this.wet + dt * 0.4);

    if (this.rinse > 0.75 && !this.stageLocked) {
      this.stageLocked = true;
      this.ui.setHint('🌬️', 'きれいに なった！ かぜに ほそう');
      this.ui.showNext('ほす →');
      this.sound.chime();
    }
  }

  // ===== 8. ほす ==========================================================

  enterDry() {
    const g = this.cloth.group;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(1);
    this.cloth.startPhysics(LINE.y - 0.05, LINE.z, 5);
    this.cloth.physics.wind = 0.55;
    this.dryTimer = 0;
    this.rinse = 1;
    this.ui.setHint('🌬️', 'ゆびで さっと はらうと、かぜが ふくよ');
    this.sound.wind();
    // 洗濯ばさみ
    if (!this.clips) {
      this.clips = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: 0xe4a0b4, roughness: 0.5 });
      for (let k = 0; k < 5; k++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.055, 0.03), m);
        this.clips.add(c);
      }
      this.scene.add(this.clips);
    }
    this.clips.visible = true;
    for (let k = 0; k < 5; k++) {
      const p = this.cloth.clipPositions[k];
      this.clips.children[k].position.set(p[0], p[1] + 0.012, p[2]);
    }
  }

  updateDry(dt) {
    const ph = this.cloth.physics;
    if (!ph) return;
    ph.wind = damp(ph.wind, 0.40 + Math.sin(this.time * 0.7) * 0.20, 1.2, dt);
    this.wet = Math.max(0, this.wet - dt * 0.16);
    this.dryTimer += dt;
    if (Math.random() < dt * 3) {
      this.wind.spawn(
        (Math.random() - 0.5) * 1.6, LINE.y - Math.random() * 1.0, LINE.z - 0.5,
        (Math.random() - 0.5) * 0.3, 0.05, 0.35 + Math.random() * 0.3,
        0.10, 2.0, 0.05
      );
    }
    if (this.dryTimer > 3.4 && !this.stageLocked) {
      this.stageLocked = true;
      this.showResult();
    }
  }

  showResult() {
    this.resultShown = true;
    if (!this.patternInfo) this.patternInfo = analysePattern(this.fold, this.binding);
    const ties = activeTies(this.binding).length + this.binding.ties.length - activeTies(this.binding).length;
    const nTies = this.binding.ties.length;
    const nBoards = this.binding.boards.length;
    const recipe = [
      `おりかた: ${FOLD_LABELS[this.fold.family] || 'ひろげたまま'}`,
      nTies ? `いと: ${nTies}かしょ` : null,
      nBoards ? `いた: ${nBoards}まい（${BOARD_SHAPE_LABEL[this.binding.boards[0].shape]}）` : null,
      `そめた かず: ${this.dips}かい`
    ].filter(Boolean).join('　／　');
    this.sound.reveal();
    this.ui.showReveal({
      name: this.patternInfo.name,
      note: this.patternInfo.note,
      recipe
    });
    for (let i = 0; i < 30; i++) {
      this.sparkle.spawn(
        (Math.random() - 0.5) * 1.4, LINE.y - Math.random() * 1.0, LINE.z + 0.1,
        (Math.random() - 0.5) * 0.4, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3,
        0.05, 2.0, -0.008
      );
    }
  }

  // ===== 入力 =============================================================

  bindInput() {
    this.input.on('down', (p) => {
      this.sound.ensure();
      if (this.stage === STAGE.BIND) this.updateCircleCenter();
    });

    this.input.on('move', (p) => {
      if (this.stage === STAGE.BIND) {
        if (this.bindMode === 'thread') {
          const n = this.input.takeWraps(Math.PI);
          for (let i = 0; i < n; i++) this.tryWrap(p.x, p.y);
          this.showGuideRing(p.x, p.y);
        }
      }
    });

    this.input.on('up', (info) => this.onRelease(info));
    this.input.on('cancel', (info) => this.onRelease(info));
  }

  onRelease(info) {
    switch (this.stage) {
      case STAGE.FOLD:
        if (!info.cancelled && info.travel > 26) this.handleFoldGesture(info);
        break;
      case STAGE.BIND:
        this.guideRing.visible = false;
        if (!info.cancelled && info.isTap && this.bindMode === 'board') {
          this.placeBoard(info.x, info.y);
        } else if (!info.cancelled && this.bindMode === 'thread' &&
          this.input.circleTotal < 0.8 && info.travel > 20) {
          // ぐるぐるが足りなくても、なぞった位置に 1 巻きだけつける
          this.tryWrap(info.x, info.y);
        }
        break;
      case STAGE.OXIDIZE:
        if (!info.cancelled && info.distance > 30) {
          this.fanAir(clamp(info.distance / 220, 0.25, 1.6));
        }
        break;
      case STAGE.UNBIND:
        if (!info.cancelled && (info.isSwipe || info.isTap || info.travel > 30)) {
          this.removeNearestBinding(info.x, info.y);
        }
        break;
      case STAGE.DRY:
        if (!info.cancelled && info.distance > 30 && this.cloth.physics) {
          this.cloth.physics.wind = Math.min(1.5, this.cloth.physics.wind + 0.7);
          this.sound.wind();
          for (let i = 0; i < 10; i++) {
            this.wind.spawn(
              (Math.random() - 0.5) * 1.6, LINE.y - Math.random() * 1.1, LINE.z - 0.6,
              (Math.random() - 0.5) * 0.4, 0.1, 0.7 + Math.random() * 0.5,
              0.11, 1.5, 0.06
            );
          }
        }
        break;
    }
  }

  showGuideRing(px, py) {
    const c = this.screenToCloth(px, py);
    if (!c) { this.guideRing.visible = false; return; }
    const a = this.fold.pointToA(c.x, c.z);
    const ring = this.fold.ringAt(a);
    this.guideRing.visible = true;
    this.guideRing.material.opacity = 0.75;
    this.guideRing.position.set(ring.cx, ring.cy, ring.cz);
    const ax = new THREE.Vector3(ring.axis.x, ring.axis.y, ring.axis.z).normalize();
    this.guideRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ax);
    this.guideRing.scale.set(ring.rx * 1.3, ring.ry * 1.3, 1);
  }

  onNext() {
    this.sound.ensure();
    switch (this.stage) {
      case STAGE.FOLD: this.setStage(STAGE.BIND); break;
      case STAGE.BIND: this.setStage(STAGE.CARRY); break;
      case STAGE.DIP: if (this.dips >= 1) this.setStage(STAGE.OXIDIZE); break;
      case STAGE.OXIDIZE: this.setStage(STAGE.UNBIND); break;
      case STAGE.UNBIND: this.setStage(STAGE.UNFOLD); break;
      case STAGE.UNFOLD: this.setStage(STAGE.RINSE); break;
      case STAGE.RINSE: this.setStage(STAGE.DRY); break;
      default: break;
    }
  }

  // ===== ループ ===========================================================

  update(dt) {
    this.time += dt;
    this.stageTime += dt;
    this.adaptQuality(dt);
    this.input.tick(dt);
    this.updateTweens(dt);

    switch (this.stage) {
      case STAGE.DIP: this.updateDip(dt); break;
      case STAGE.OXIDIZE: this.updateOxidize(dt); break;
      case STAGE.UNFOLD: this.updateUnfold(dt); break;
      case STAGE.RINSE: this.updateRinse(dt); break;
      case STAGE.DRY: this.updateDry(dt); break;
      case STAGE.UNBIND:
        this.wet = Math.max(0.3, this.wet - dt * 0.03);
        this.spawnDrips(dt);
        break;
      case STAGE.TITLE:
        this.cloth.group.rotation.y = Math.sin(this.time * 0.25) * 0.10;
        break;
    }

    if (this.stage === STAGE.BIND) this.updateCircleCenter();

    this.updateHolder();
    this.threads.sync(this.binding.ties, this.fold);
    this.boards.update();
    this.cloth.update(dt);

    this.bubbles.update(dt, VAT.liquidY + 0.004, (x, z, r) => {
      this.world.addRipple(x - VAT.x, z - VAT.z, 0.35 + r * 8);
      if (Math.random() < 0.25) this.sound.pop();
    });
    const killY = this.stage === STAGE.RINSE ? BASIN.y - 0.09 : 0.0;
    this.drips.update(dt, this.stage === STAGE.DIP || this.stage === STAGE.OXIDIZE ? VAT.liquidY : killY,
      (x, z) => {
        if (this.stage === STAGE.DIP || this.stage === STAGE.OXIDIZE) {
          this.world.addRipple(x - VAT.x, z - VAT.z, 0.5);
        }
      });
    this.wind.update(dt, 0.94);
    this.clouds.update(dt, 0.90);
    this.sparkle.update(dt, 0.96);

    this.world.update(dt, this.time);
    this.applyUniforms();
    this.updateCamera(dt);
  }

  // 竿・吊り紐・液中シルエット
  updateHolder() {
    const st = this.stage;
    const holding = st === STAGE.CARRY || st === STAGE.DIP || st === STAGE.OXIDIZE;
    this.pole.visible = holding;
    const inLiquid = st === STAGE.DIP && this.inVat > 0.02;
    this.ghost.visible = inLiquid;
    this.ghost.material.uniforms.uOpacity.value = inLiquid ? this.inVat * 0.8 : 0;
    if (!holding) return;
    const g = this.cloth.group;
    const handY = g.position.y + this.fold.bundleHeight;
    const drop = 0.21;
    this.pole.position.set(g.position.x, handY + drop, g.position.z);
    this.pole.rotation.z = g.rotation.z * 0.35;
    const bs = this.fold.bundleSize || { w: 0.3, d: 0.3 };
    const off = clamp(bs.w * 0.34, 0.06, 0.26);
    for (let k = 0; k < 2; k++) {
      const c = this.cords[k];
      c.position.set((k ? off : -off), 0, 0);
      c.scale.y = drop + 0.03;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // ===== 開始・やりなおし =================================================

  startPlay() {
    this.seed = (Math.random() * 1e9) >>> 0;
    this.rng = makeRng(this.seed);
    this.initState();
    this.setStage(STAGE.FOLD);
    this.updateCameraRig(false);
  }

  showTitleScene() {
    this.stage = STAGE.TITLE;
    this.initState();
    this.cloth.foldT = 0;
    this.updateCameraRig(true);
  }

  dispose() {
    this.renderer.dispose();
  }
}
