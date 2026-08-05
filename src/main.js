// 「ひらいて！てらして！ステージのうらがわ」
// 遊ぶひとは俳優ではなく、舞台のうらがわではたらくスタッフ。
import * as THREE from '../vendor/three.module.min.js';
import { clamp, lerp, damp, rand, smoothstep, easeOutCubic } from './util.js';
import { Theatre, STAGE } from './theatre.js';
import { StageSet, THEMES } from './stages.js';
import { Curtain, CURTAIN_TYPES } from './curtain.js';
import { SpotRig, LIGHT_COLORS } from './spotlight.js';
import { Effects } from './effects.js';
import { Troupe } from './performers.js';
import { PostFX } from './postfx.js';
import { TouchInput } from './input.js';
import { UI } from './ui.js';
import { AudioKit } from './audio.js';

const PREP_STEPS = 5;   // セット・吊り物・スポット・色・幕

class Game {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: false, powerPreference: 'high-performance',
      alpha: false, stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x05050a, 1);

    this.theatre = new Theatre(this.renderer);
    this.scene = this.theatre.scene;
    this.camera = this.theatre.camera;
    this.post = new PostFX(this.renderer);

    this.spot = new SpotRig(this.scene, { origin: new THREE.Vector3(0, 8.9, 2.4), angle: 0.185 });
    this.spot.setVisible(false);
    this.effects = new Effects(this.scene);
    this.audio = new AudioKit();
    this.ui = new UI(document.getElementById('hud'));
    this.ui.onAnyPress = () => this.audio.unlock();
    this.input = new TouchInput(this.canvas);

    this.stageSet = null;
    this.curtain = null;
    this.troupe = null;

    this.state = 'boot';
    this.stateT = 0;
    this.prepDone = 0;
    this.colorIndex = 0;
    this.usedEffects = new Set();
    this.spotlitTime = 0;
    this.dragTotal = 0;
    this.quality = { fps: 60, acc: 0, frames: 0, tier: 2 };
    this.lockQuality = /[?&]hq/.test(location.search);
    this.flash = 0;
    this.applauseLevel = 0;

    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);
    this._ray = new THREE.Raycaster();
    this._hit = new THREE.Vector3();

    this._bindInput();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._resize(), 250));

    this.clock = new THREE.Clock();
    this.toTitle();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  /* ============ 画面サイズ ============ */
  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const maxPixels = this.quality.tier >= 2 ? 2.3e6 : 1.4e6;
    let dpr = Math.min(window.devicePixelRatio || 1, this.quality.tier >= 2 ? 2 : 1.5);
    if (w * h * dpr * dpr > maxPixels) dpr = Math.sqrt(maxPixels / (w * h));
    dpr = clamp(dpr, 0.7, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const pw = Math.floor(w * dpr), ph = Math.floor(h * dpr);
    this.post.setSize(pw, ph);
    this.theatre.setSize(pw, ph);
    this.aspect = w / h;
  }

  /* ============ 入力 ============ */
  _bindInput() {
    const inp = this.input;
    inp.on('down', (p) => {
      this.audio.unlock();
      if (['spotStep', 'colorHold', 'colorStep', 'pickCurtain', 'show', 'free'].includes(this.state)) {
        this._aimFrom(p);
      }
      if (this.state === 'curtainStep') {
        this.curtainDragFrom = p.x;
        this.curtainDragBase = this.curtain ? this.curtain.open : 0;
      }
    });
    inp.on('move', (p) => {
      if (['spotStep', 'colorHold', 'colorStep', 'pickCurtain', 'show', 'free'].includes(this.state)) {
        this._aimFrom(p);
        this.dragTotal += Math.hypot(p.dx, p.dy);
      }
      if (this.state === 'curtainStep' && this.curtain) {
        const ref = Math.min(p.w, p.h);
        const add = this.curtain.dragToOpen(p.x - this.curtainDragFrom, ref);
        this.curtain.autoGlide = false;
        this.curtain.setOpen(this.curtainDragBase + add);
      }
    });
    inp.on('up', () => {
      if (this.state === 'curtainStep' && this.curtain) {
        // 少しでも動かしたら、そのまま気持ちよく開ききる
        if (this.curtain.open > 0.06) {
          this.curtain.glideOpen();
          this.audio.whoosh({ dur: 1.7, gain: 0.16 });
        }
      }
    });
    inp.on('tap', (p) => {
      if (this.state === 'setStep') this._rollFlat();
      else if (this.state === 'liftStep') this._lowerFly();
      else if (this.state === 'curtainStep' && this.curtain) {
        this.curtain.autoGlide = false;
        this.curtain.nudge(0.34);
        this.audio.whoosh({ dur: 0.8, gain: 0.1 });
        if (this.curtain.open > 0.5) this.curtain.glideOpen();
      } else if (this.state === 'show' || this.state === 'free') {
        this._aimFrom(p);
        this.effects.sparkleBurst({
          n: 16, x: this.spot.aim.x, y: 0.5, z: this.spot.aim.z, spread: 0.9, up: 1.6,
          tint: this._tintOf(this.colorIndex),
        });
        this.audio.chime(2 + ((Math.random() * 5) | 0), { gain: 0.07 });
      }
    });
    inp.on('swipe', (s) => {
      if (this.state === 'setStep') this._rollFlat();
      else if (this.state === 'liftStep') this._lowerFly();
    });
  }

  _aimFrom(p) {
    this._ray.setFromCamera({ x: p.nx, y: p.ny }, this.camera);
    if (this._ray.ray.intersectPlane(this._plane, this._hit)) {
      this._hit.x = clamp(this._hit.x, -6.4, 6.4);
      this._hit.z = clamp(this._hit.z, -9.2, 1.6);
      this._hit.y = 0;
      this.spot.aimAt(this._hit);
    }
  }

  _tintOf(i) {
    const c = new THREE.Color(LIGHT_COLORS[i].glow);
    return [c.r, c.g, c.b];
  }

  /* ============ 進行 ============ */
  setState(s) { this.state = s; this.stateT = 0; }

  toTitle() {
    this.ui.clearAll();
    this.theatre.setView('title', 0);
    this.theatre.setMood(0);
    this.setState('title');
    this.ui.showCenter([{
      icon: 'play', color: '#ffd98a',
      onTap: () => {
        this.audio.unlock();
        this.audio.arpeggio(5, { gain: 0.13 });
        this.ui.hideCenter();
        this.pickStage();
      },
    }]);
  }

  pickStage() {
    this.setState('pickStage');
    this.theatre.setView('prep', 2.0);
    this.ui.showChoice(
      THEMES.map((t) => ({ icon: t.id, colorA: t.uiA, colorB: t.uiB })),
      (i, it) => this.beginPrep(i)
    );
  }

  beginPrep(themeIndex) {
    this.theme = THEMES[themeIndex];
    this.stageSet = new StageSet(this.theme);
    this.scene.add(this.stageSet.group);
    this.stageSet.setLit(0);
    this.audio.startMusic(this.theme.musicScale);
    this.audio.setMusicLevel(0.22);
    this.audio.chime(4, { gain: 0.16 });
    this.post.tint.setHex(this.theme.fog);

    this.prepDone = 0;
    this.ui.setProgress(0, PREP_STEPS);
    this._toSetStep();
  }

  /* ---- 1. 背景セットをゴロゴロ送り出す ---- */
  _toSetStep() {
    this.setState('setStep');
    this.theatre.setView('prep', 2.0);
    this.ui.setDock([{
      icon: 'roll', color: this.theme.uiA, id: 'roll', big: true,
      onTap: () => this._rollFlat(),
    }]);
    this.ui.setHint('swipeRight', 16, 62, this.theme.uiA);
  }

  _rollFlat() {
    if (this.state !== 'setStep' || !this.stageSet) return;
    const f = this.stageSet.rollNextFlat();
    if (!f) return;
    this.audio.rumbleStart();
    this.audio.chime(3 + this.stageSet.flats.indexOf(f), { gain: 0.1 });
    clearTimeout(this._rumbleT);
    this._rumbleT = setTimeout(() => this.audio.rumbleStop(), 1450);
    this.ui.pulseDock('roll');
    if (!this.stageSet.remainingFlats.length) {
      this._stepDone();
      setTimeout(() => this._toLiftStep(), 1500);
    }
  }

  /* ---- 2. 昇降装置で月・雲・おほしさまを下ろす ---- */
  _toLiftStep() {
    this.setState('liftStep');
    this.theatre.setView('lift', 1.8);
    this.ui.setDock([{
      icon: 'lift', color: '#ffe9a8', id: 'lift', big: true,
      onTap: () => this._lowerFly(),
    }]);
    this.ui.setHint('swipeDown', 50, 34, '#ffe9a8');
  }

  _lowerFly() {
    if (this.state !== 'liftStep' || !this.stageSet) return;
    if (!this.stageSet.fly.lower()) return;
    this.audio.winch();
    this.audio.chime(6, { gain: 0.14 });
    this.ui.pulseDock('lift');
    this._stepDone();
    setTimeout(() => this._toSpotStep(), 2600);
  }

  /* ---- 3. スポットライトを指で動かす ---- */
  _toSpotStep() {
    this.setState('spotStep');
    this.theatre.setView('spot', 2.0);
    this.spot.setVisible(true);
    this.spot.setIntensity(0);
    this.spot.aimAt(new THREE.Vector3(0, 0, -4.2));
    this.spot.setAttractors(this.stageSet.attractorPoints());
    this.audio.whoosh({ dur: 1.2, gain: 0.09, up: true });
    this.ui.setDock(null);
    this.ui.setHint('swipeWide', 50, 64, '#fff3d0');
    this.dragTotal = 0;
  }

  /* ---- 4. 照明の色をえらぶ ---- */
  _toColorStep() {
    this.setState('colorStep');
    this.ui.setHint('tap', 88, 50, '#ffc0e0');
    this.ui.setPalette(LIGHT_COLORS.slice(1), (i, c) => {
      this.colorIndex = i + 1;
      this.spot.setColor(this.colorIndex);
      this.audio.sparkle();
      this.effects.sparkleBurst({
        n: 20, x: this.spot.aim.x, y: 0.4, z: this.spot.aim.z,
        spread: 1.1, up: 1.4, tint: this._tintOf(this.colorIndex),
      });
      if (this.state === 'colorStep') {
        this._stepDone();
        this.ui.hideHint();
        setTimeout(() => this._toCurtainPick(), 1400);
      }
    }, -1);
  }

  /* ---- 5. 幕をえらんで、指で開ける ---- */
  _toCurtainPick() {
    this.setState('pickCurtain');
    this.ui.setHint(null);
    this.theatre.setView('curtain', 2.4);
    this.ui.showChoice([
      { icon: 'velvet', colorA: '#e0708c', colorB: '#6a0a1c' },
      { icon: 'austrian', colorA: '#e7b0ec', colorB: '#6a2f80' },
      { icon: 'starlight', colorA: '#a8dcff', colorB: '#1d4a8a' },
    ], (i) => this._toCurtainStep(CURTAIN_TYPES[i]));
  }

  _toCurtainStep(type) {
    this.curtain = new Curtain(type, {
      halfWidth: STAGE.halfWidth + 1.5, top: STAGE.prosceniumH - 0.42, height: 7.46, z: -0.55,
    });
    this.scene.add(this.curtain.object3d);
    this.curtain.onOpened = () => this._reveal();
    this.setState('curtainStep');
    this.theatre.setView('curtain', 1.6);
    this.audio.chime(5, { gain: 0.14 });
    this.ui.setHint('swipeWide', 50, 58, '#ffd0a8');
    this.ui.setDock(null);
  }

  _stepDone() {
    this.prepDone = Math.min(PREP_STEPS, this.prepDone + 1);
    this.ui.setProgress(this.prepDone, PREP_STEPS);
    this.audio.chime(this.prepDone + 4, { gain: 0.13 });
  }

  /* ---- 幕があいた瞬間。ここがいちばんのごほうび ---- */
  _reveal() {
    if (this.state === 'reveal' || this.state === 'show') return;
    this._stepDone();
    this.setState('reveal');
    this.ui.hideHint();
    this.ui.setDock(null);
    this.ui.setPalette(null);
    this.flash = 1.0;
    this.ui.tintFlash('#fff4dc', 1100);
    this.audio.fanfare();
    this.audio.setMusicLevel(0.42);

    this.troupe = new Troupe(this.theme);
    this.scene.add(this.troupe.group);

    this.theatre.setView('reveal', 2.4);
    setTimeout(() => this.theatre.setView('house', 3.4), 2300);
    setTimeout(() => {
      this.troupe.enter();
      this.audio.arpeggio(6, { gain: 0.1, spread: 0.1 });
    }, 2600);
    setTimeout(() => {
      this.troupe.dance();
      this._toShow();
    }, 5200);
  }

  /* ---- 公演中 ---- */
  _toShow() {
    this.setState('show');
    this.showT = 0;
    this.usedEffects.clear();
    this.spot.setAttractors(this.troupe.attractorPoints());
    this.spot.snapStrength = 0.85;
    this.ui.setProgress(0, 0);
    this._showControls();
    this.ui.setHint('swipeWide', 50, 62, '#fff3d0');
    setTimeout(() => this.ui.hideHint(), 6000);
  }

  _showControls(extra = []) {
    this.ui.setDock([
      { icon: 'petal', color: '#ff9ec4', id: 'petal', onTap: () => this._effect('petal') },
      { icon: 'bubble', color: '#9fe6ff', id: 'bubble', onTap: () => this._effect('bubble') },
      { icon: 'sparkle', color: '#fff3b0', id: 'sparkle', onTap: () => this._effect('sparkle') },
      ...extra,
    ]);
    this.ui.setPalette(LIGHT_COLORS.slice(1), (i) => {
      this.colorIndex = i + 1;
      this.spot.setColor(this.colorIndex);
      this.audio.sparkle();
    }, this.colorIndex - 1);
  }

  _effect(kind) {
    this.usedEffects.add(kind);
    const aim = this.spot.aim;
    if (kind === 'petal') {
      this.effects.petalBurst({ n: 52 });
      this.audio.whoosh({ dur: 1.4, gain: 0.09, up: false });
      this.audio.arpeggio(4, { gain: 0.08, spread: 0.09 });
    } else if (kind === 'bubble') {
      this.effects.bubbleBurst({ n: 30 });
      for (let i = 0; i < 8; i++) setTimeout(() => this.audio.pop(), i * 130 + rand(0, 90));
    } else {
      this.effects.sparkleBurst({
        n: 46, x: aim.x, y: 1.6, z: aim.z, spread: 2.0, up: 2.4,
        tint: this._tintOf(this.colorIndex),
      });
      this.effects.sparkleBurst({ n: 30, x: 0, y: 4.4, z: -4.5, spread: 4.5, up: 1.0 });
      this.audio.sparkle();
    }
  }

  /* ---- 拍手 ---- */
  _toApplause() {
    this.setState('applause');
    this.ui.hideHint();
    this.audio.applause(7.5, 0.55);
    this.audio.setMusicLevel(0.16);
    this.troupe.bow();
    this.effects.celebrate(this.theme);
    this.theatre.setView('show', 2.6);
    setTimeout(() => {
      if (this.curtain) this.curtain.close();
      this.audio.whoosh({ dur: 2.0, gain: 0.14, up: false });
    }, 4200);
    setTimeout(() => this._toEnd(), 7200);
  }

  _toEnd() {
    this.setState('end');
    this.ui.setDock(null);
    this.ui.setPalette(null);
    this.ui.showCenter([
      { icon: 'replay', color: '#ffd98a', onTap: () => this._restart() },
      { icon: 'freeplay', color: '#ff9ed8', onTap: () => this._toFree() },
    ]);
  }

  /* ---- じゆうに照明であそぶ ---- */
  _toFree() {
    this.ui.hideCenter();
    this.setState('free');
    this.theatre.setView('free', 2.4);
    this.audio.setMusicLevel(0.34);
    if (this.curtain) this.curtain.glideOpen();
    this.spot.setAttractors([
      ...(this.troupe ? this.troupe.attractorPoints() : []),
      ...(this.stageSet ? this.stageSet.attractorPoints() : []),
    ]);
    this._showControls([{
      icon: 'replay', color: '#ffd98a', id: 'replay', onTap: () => this._restart(),
    }]);
    this.ui.setHint('swipeWide', 50, 66, '#fff3d0');
    setTimeout(() => this.ui.hideHint(), 5000);
  }

  _restart() {
    this.ui.clearAll();
    if (this.stageSet) { this.scene.remove(this.stageSet.group); this.stageSet.dispose(); this.stageSet = null; }
    if (this.curtain) { this.scene.remove(this.curtain.object3d); this.curtain.dispose(); this.curtain = null; }
    if (this.troupe) { this.scene.remove(this.troupe.group); this.troupe = null; }
    this.spot.setVisible(false);
    this.spot.setColor(0);
    this.spot.setIntensity(0);
    this.colorIndex = 0;
    this.usedEffects.clear();
    this.spotlitTime = 0;
    this.dragTotal = 0;
    this.applauseLevel = 0;
    this.flash = 0;
    this.theatre.setMood(0);
    this.audio.setMusicLevel(0.2);
    this.audio.stopMusic();
    this.toTitle();
  }

  /* ============ 毎フレーム ============ */
  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.stateT += dt;
    const st = this.state;

    // 品質のようす見（重かったら、そっと軽くする）
    this._adaptQuality(dt);

    // 明るさの気分
    let moodTarget = 0;
    if (st === 'reveal' || st === 'show' || st === 'applause' || st === 'end' || st === 'free') moodTarget = 1;
    else if (st === 'curtainStep') moodTarget = 0.10 + 0.62 * (this.curtain ? this.curtain.openNow : 0);
    else if (st !== 'title' && st !== 'boot') moodTarget = 0.05;
    this.theatre.setMood(damp(this.theatre.moodShow, moodTarget, st === 'reveal' ? 2.2 : 1.2, dt));
    // 幕をえらんで開けるあいだだけ、幕のうらを照らす
    const co = this.curtain ? this.curtain.openNow : 0;
    this.theatre.curtainBackLevel =
      st === 'pickCurtain' ? 1 : st === 'curtainStep' ? (1 - 0.75 * co) : 0;
    if (this.stageSet) this.stageSet.setLit(this.theatre.moodShow);

    // スポットの明るさ
    if (this.spot.enabled) {
      const want = ['spotStep', 'colorHold', 'colorStep', 'pickCurtain', 'curtainStep',
        'reveal', 'show', 'applause', 'end', 'free'].includes(st) ? 1 : 0;
      this.spot.setIntensity(damp(this.spot.intensityScale || 0, want, 2.0, dt));
    }

    // 各ステップの、そっと次へ進む条件
    if (st === 'spotStep') {
      if (this.dragTotal > 420 || this.stateT > 16) {
        this._stepDone();
        this.ui.hideHint();
        this.setState('colorHold');
        setTimeout(() => this._toColorStep(), 800);
      }
    }

    if (st === 'show') {
      this.showT += dt;
      if (this.troupe) {
        const near = this.troupe.members.some(
          (m) => Math.hypot(m.group.position.x - this.spot.aim.x, m.group.position.z - this.spot.aim.z) < 2.0
        );
        if (near) this.spotlitTime += dt;
      }
      const enough = this.usedEffects.size >= 3 && this.spotlitTime > 3 && this.showT > 18;
      if (enough || this.showT > 44) this._toApplause();
    }

    if (st === 'applause') {
      this.applauseLevel = damp(this.applauseLevel, this.stateT < 5.5 ? 1 : 0, 1.6, dt);
    } else {
      this.applauseLevel = damp(this.applauseLevel, 0, 2, dt);
    }
    this.theatre.applaudAudience(this.applauseLevel);

    // 更新
    this.theatre.update(dt, this.aspect);
    if (this.stageSet) this.stageSet.update(dt);
    if (this.curtain) this.curtain.update(dt);
    if (this.troupe) {
      this.troupe.update(dt);
      this.troupe.updateSpot(this.spot.aim);
    }
    this.spot.update(dt);
    this.effects.update(dt);

    // 幕開けの閃光
    this.flash = damp(this.flash, 0, 1.6, dt);
    this.post.flash = this.flash * 0.38;
    this.post.exposure = lerp(1.02, 0.82, this.theatre.moodShow);
    this.post.threshold = lerp(0.95, 1.28, this.theatre.moodShow);
    this.post.bloomStrength = lerp(0.60, 0.74, this.theatre.moodShow) + this.flash * 0.45;
    this.post.vignette = lerp(0.62, 0.42, this.theatre.moodShow);
    this.post.tintAmount = lerp(0.16, 0.07, this.theatre.moodShow);

    this.theatre.renderReflection();
    this.post.render(this.scene, this.camera, dt);
  }

  _adaptQuality(dt) {
    if (this.lockQuality) return;
    const q = this.quality;
    q.acc += dt; q.frames++;
    if (q.acc >= 1.5) {
      q.fps = q.frames / q.acc;
      q.acc = 0; q.frames = 0;
      if (q.fps < 40 && q.tier > 1) {
        q.tier = 1;
        this.theatre.reflector.enabled = false;
        this._resize();
      } else if (q.fps < 30 && q.tier > 0) {
        q.tier = 0;
        this.post.enabled = false;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.spot.light.castShadow = false;
        this._resize();
      }
    }
  }
}

window.addEventListener('load', () => {
  try {
    window.__game = new Game();
  } catch (e) {
    console.error(e);
    document.getElementById('fallback').style.display = 'grid';
  }
});
