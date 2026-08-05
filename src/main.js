// ぱてぃしえ だいすき！ — 4歳向けパティシエ3Dゲーム
// フェーズ: TITLE → MIX → POUR → BAKE → LAYER → DECORATE → DOME → REVEAL → DONE
import * as THREE from '../vendor/three.module.js';
import { buildKitchen } from './env.js';
import {
  createBowl, createSpoon, createStream, createPan, createCakeStand,
  createSponge, createCreamSwirl, createPipingBag, createDecoration,
  createChocoDome, createDrips, createMeltPool, createPitcher, createDripCrown,
  createConfetti, createSparkles, createSteam, createIngredient,
} from './cake.js';
import { tween, updateTweens, ease, clamp, lerp } from './util.js';
import { unlock, startBGM, sfx, setPourSound, setStirSound } from './audio.js';

// -------------------------------------------------------------------------
// レンダラー・シーン
// -------------------------------------------------------------------------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 20);

const env = buildKitchen(scene);

// -------------------------------------------------------------------------
// ゲームオブジェクト
// -------------------------------------------------------------------------
const bowl = createBowl();
bowl.group.position.set(0, 0.018, 0.02);
scene.add(bowl.group);

const spoon = createSpoon();
spoon.group.visible = false;
scene.add(spoon.group);

const batterStream = createStream(0xffd2da, { radius: 0.012 });
scene.add(batterStream.mesh);

const pan = createPan();
pan.group.position.set(0, 0.018, 0);
pan.group.visible = false;
scene.add(pan.group);

const stand = createCakeStand();
stand.group.position.set(0, 0.018, 0);
stand.group.visible = false;
scene.add(stand.group);
const STAND_TOP = 0.018 + stand.topY;

const cakeGroup = new THREE.Group(); // スポンジ・クリーム・飾りをまとめる
cakeGroup.position.set(0, STAND_TOP, 0);
scene.add(cakeGroup);

const pipingBag = createPipingBag();
pipingBag.group.visible = false;
scene.add(pipingBag.group);

const dome = createChocoDome();
dome.mesh.position.set(0, STAND_TOP, 0);
dome.mesh.visible = false;
scene.add(dome.mesh);

const drips = createDrips();
scene.add(drips.group);

const meltPool = createMeltPool();
meltPool.mesh.position.set(0, STAND_TOP + 0.0015, 0);
scene.add(meltPool.mesh);

const pitcher = createPitcher();
pitcher.group.visible = false;
scene.add(pitcher.group);

const sauceStream = createStream(0xffa63e, { emissive: 0.7, radius: 0.007 });
scene.add(sauceStream.mesh);

const dripCrown = createDripCrown();
scene.add(dripCrown.group);

const confetti = createConfetti();
scene.add(confetti.points);

const sparkles = createSparkles();
sparkles.points.visible = false;
sparkles.points.position.set(0, STAND_TOP, 0);
scene.add(sparkles.points);

const steam = createSteam();
steam.group.visible = false;
scene.add(steam.group);

const candleLight = new THREE.PointLight(0xffb050, 0, 0.8, 2);
scene.add(candleLight);

// -------------------------------------------------------------------------
// UI要素
// -------------------------------------------------------------------------
const ui = {
  title: document.getElementById('title'),
  startBtn: document.getElementById('startBtn'),
  hint: document.getElementById('hint'),
  hintIcon: document.getElementById('hintIcon'),
  progress: document.getElementById('progress'),
  progressFill: document.getElementById('progressFill'),
  palette: document.getElementById('palette'),
  tray: document.getElementById('tray'),
  doneBtn: document.getElementById('doneBtn'),
  replayBtn: document.getElementById('replayBtn'),
  banner: document.getElementById('banner'),
  finger: document.getElementById('finger'),
};

function setHint(text, icon = '') {
  ui.hint.textContent = text;
  ui.hintIcon.textContent = icon;
  ui.hint.parentElement.classList.toggle('show', !!text);
}
function setProgress(v) {
  ui.progress.classList.toggle('show', v !== null);
  if (v !== null) ui.progressFill.style.width = `${clamp(v, 0, 1) * 100}%`;
}
function showBanner(text) {
  ui.banner.textContent = text;
  ui.banner.classList.add('show');
  setTimeout(() => ui.banner.classList.remove('show'), 1600);
}
function setFinger(mode) { // 'circle' | 'hold' | null
  ui.finger.className = mode ? `show ${mode}` : '';
}

// -------------------------------------------------------------------------
// カメラ制御
// -------------------------------------------------------------------------
const camState = {
  pos: new THREE.Vector3(0.9, 0.75, 1.5),
  look: new THREE.Vector3(0, 0.1, -0.2),
  targetPos: new THREE.Vector3(0.9, 0.75, 1.5),
  targetLook: new THREE.Vector3(0, 0.1, -0.2),
};
function isPortrait() { return window.innerHeight > window.innerWidth; }
function setCam(pos, look) {
  camState.targetPos.set(...pos);
  camState.targetLook.set(...look);
  if (isPortrait()) {
    // 縦画面では少し引いて全体が収まるように
    const dir = camState.targetPos.clone().sub(camState.targetLook);
    dir.multiplyScalar(1.4);
    camState.targetPos.copy(camState.targetLook).add(dir);
    camState.targetPos.y += 0.06;
  }
}
let camPhaseArgs = null;
function applyCamPhase() { if (camPhaseArgs) setCam(...camPhaseArgs); }
function camPhase(pos, look) { camPhaseArgs = [pos, look]; applyCamPhase(); }

// -------------------------------------------------------------------------
// 入力
// -------------------------------------------------------------------------
const pointer = { down: false, x: 0, y: 0, ndc: new THREE.Vector2() };
const raycaster = new THREE.Raycaster();
let audioReady = false;

function onPointerDown(e) {
  pointer.down = true;
  updatePointer(e);
  if (!audioReady) { unlock(); startBGM(); audioReady = true; }
  if (state.phase === 'BAKE' && !state.bakeStarted) startBaking();
}
function onPointerMove(e) { updatePointer(e); }
function onPointerUp() { pointer.down = false; }
function updatePointer(e) {
  const x = e.touches ? e.touches[0]?.clientX : e.clientX;
  const y = e.touches ? e.touches[0]?.clientY : e.clientY;
  if (x === undefined) return;
  pointer.x = x; pointer.y = y;
  pointer.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
}
canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// 水平面との交点を求める
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();
function pointOnPlane(y) {
  _plane.constant = -y;
  raycaster.setFromCamera(pointer.ndc, camera);
  return raycaster.ray.intersectPlane(_plane, _hit) ? _hit : null;
}

// -------------------------------------------------------------------------
// ゲーム状態
// -------------------------------------------------------------------------
const CREAM_COLORS = { pink: 0xff9db8, mint: 0x9fe6c8, sky: 0x9fc8f0, lemon: 0xffe08a };
const state = {
  phase: 'TITLE',
  mixProgress: 0,
  stirEnergy: 0,
  lastStirAngle: null,
  pourLevel: 0,
  bowlTilt: 0,
  bakeStarted: false,
  layerSteps: ['sponge', 'cream', 'sponge', 'cream', 'sponge', 'cream'],
  layerIndex: 0,
  layerBusy: false,
  cakeTop: 0, // cakeGroupローカルでの現在の積み上げ高さ
  currentCream: null,
  creamProgress: 0,
  creamColor: null,
  decorations: [],
  decoSlots: [],
  melt: 0,
  pitcherTilt: 0,
  doneTime: 0,
  sponges: [],
};

// 飾りの置き場所（上面のリング + 中央）
(function initSlots() {
  state.decoSlots.push(new THREE.Vector3(0, 0, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    state.decoSlots.push(new THREE.Vector3(Math.cos(a) * 0.054, 0, Math.sin(a) * 0.054));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 1.1;
    state.decoSlots.push(new THREE.Vector3(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03));
  }
})();

// -------------------------------------------------------------------------
// フェーズ遷移
// -------------------------------------------------------------------------
function enterPhase(p) {
  state.phase = p;
  setFinger(null);
  setProgress(null);
  if (p === 'MIX') {
    camPhase([0, 0.4, 0.5], [0, 0.1, 0.01]);
    spoon.group.visible = true;
    spoon.group.position.set(0.05, 0.16, 0.06);
    runIngredientIntro();
  } else if (p === 'POUR') {
    camPhase([0.3, 0.34, 0.5], [0, 0.16, 0]);
    pan.group.visible = true;
    pan.group.position.set(0, 0.018, 0);
    spoon.group.visible = false;
    // ボウルを持ち上げる
    tween({
      from: 0, to: 1, duration: 1.2, easing: ease.inOutCubic,
      onUpdate: v => {
        bowl.group.position.set(lerp(0, -0.06, v), lerp(0.018, 0.33, v), lerp(0.02, 0, v));
      },
      onComplete: () => {
        setHint('ゆびで ながく おしてね', '🫗');
        setFinger('hold');
        setProgress(0);
      },
    });
    setHint('ボウルを もちあげるよ…', '💪');
  } else if (p === 'BAKE') {
    camPhase([-0.22, 0.38, 0.42], [-0.62, 0.22, -0.5]);
    setHint('オーブンに いれよう！ タップ！', '🔥');
    setFinger('hold');
  } else if (p === 'LAYER') {
    stand.group.visible = true;
    stand.group.position.y = -0.2;
    tween({
      from: -0.2, to: 0.018, duration: 0.9, easing: ease.outBack,
      onUpdate: v => { stand.group.position.y = v; },
      onComplete: () => nextLayerStep(),
    });
    sfx.whoosh();
    setHint('ケーキを つみあげよう！', '🍰');
  } else if (p === 'DECORATE') {
    const top = STAND_TOP + state.cakeTop;
    camPhase([0.05, top + 0.22, 0.4], [0, top - 0.04, 0]);
    setHint('すきな かざりを えらんでね', '🍓');
    ui.tray.classList.add('show');
  } else if (p === 'DOME') {
    ui.tray.classList.remove('show');
    ui.doneBtn.classList.remove('show');
    camPhase([0.32, 0.38, 0.58], [0, 0.2, 0]);
    setHint('チョコレートで ないしょに しちゃおう…', '🤫');
    runDomeDescend();
  } else if (p === 'REVEAL') {
    camPhase([0.3, 0.46, 0.55], [0, 0.24, 0]);
    setHint('あたたかい ソースを かけてね！', '🫖');
    setFinger('hold');
    setProgress(0);
    pitcher.group.visible = true;
    pitcher.group.position.set(0.24, 0.62, 0.05);
    pitcher.group.rotation.z = 0;
    tween({
      from: 0.62, to: 0.46, duration: 0.8, easing: ease.outCubic,
      onUpdate: v => { pitcher.group.position.y = v; },
    });
    steam.group.visible = true;
    steam.group.position.set(0.24, 0.54, 0.05);
    steam.setStrength(0.4);
  } else if (p === 'DONE') {
    setHint('わあ！ できあがり！', '🎂');
    ui.replayBtn.classList.add('show');
  }
}

// --- 材料投入の演出 → まぜまぜ開始 ---
function runIngredientIntro() {
  setHint('ざいりょうを いれるよ！', '🥣');
  const kinds = ['egg', 'flour', 'milk', 'berry'];
  kinds.forEach((k, i) => {
    const item = createIngredient(k);
    item.position.set(-0.25 + i * 0.16, 0.5, 0.12);
    item.visible = false;
    scene.add(item);
    tween({
      delay: 0.35 + i * 0.55, from: 0, to: 1, duration: 0.55, easing: ease.inOutCubic,
      onUpdate: (v, k2) => {
        item.visible = true;
        const sx = -0.25 + i * 0.16;
        item.position.set(lerp(sx, 0, v), 0.5 - 2.2 * v * v * 0.16, lerp(0.12, 0.02, v));
        item.rotation.z = v * 2.5;
      },
      onComplete: () => {
        scene.remove(item);
        sfx.plop();
        bowl.batter.uniforms.uStir.value = 0.8;
        setTimeout(() => { if (state.phase === 'MIX') bowl.batter.uniforms.uStir.value = 0; }, 250);
      },
    });
  });
  setTimeout(() => {
    if (state.phase !== 'MIX') return;
    setHint('ぐるぐる まぜてね！', '🌀');
    setFinger('circle');
    setProgress(0);
    state.mixReady = true;
  }, 3000);
}

// --- 焼き上げ演出 ---
function startBaking() {
  state.bakeStarted = true;
  setFinger(null);
  sfx.tap();
  setHint('やけるまで まっててね…', '⏰');
  const ovenPos = new THREE.Vector3(-0.66, 0.16, -0.44);
  const p0 = pan.group.position.clone();
  tween({
    from: 0, to: 1, duration: 1.3, easing: ease.inOutCubic,
    onUpdate: v => {
      pan.group.position.lerpVectors(p0, ovenPos, v);
      pan.group.position.y = p0.y + Math.sin(v * Math.PI) * 0.22 + (ovenPos.y - p0.y) * v;
      pan.group.scale.setScalar(1 - v * 0.35);
    },
    onComplete: () => {
      pan.group.visible = false;
      sfx.whoosh();
      steam.group.visible = true;
      steam.group.position.set(-0.62, 0.45, -0.5);
      steam.setStrength(0.8);
      tween({ from: 0, to: 1, duration: 0.8, onUpdate: v => env.oven.setGlow(v) });
      // じっくり焼ける（光がゆれる）
      tween({
        from: 0, to: 1, duration: 3.0,
        onUpdate: (v, k) => env.oven.setGlow(0.85 + Math.sin(k * 20) * 0.15),
        onComplete: () => {
          sfx.ding();
          showBanner('チン！ やけたよ！');
          env.oven.setGlow(0);
          steam.setStrength(0);
          setTimeout(() => enterPhase('LAYER'), 900);
        },
      });
    },
  });
}

// --- 積み上げステップ ---
function nextLayerStep() {
  if (state.layerIndex >= state.layerSteps.length) {
    setTimeout(() => enterPhase('DECORATE'), 700);
    return;
  }
  const step = state.layerSteps[state.layerIndex];
  state.layerBusy = false;
  if (step === 'sponge') {
    state.layerBusy = true;
    const sp = createSponge(state.sponges.length);
    const targetY = state.cakeTop + sp.height / 2;
    sp.mesh.position.set(0, targetY + 0.45, 0);
    cakeGroup.add(sp.mesh);
    state.sponges.push(sp);
    sfx.whoosh();
    setHint('スポンジが とんでくるよ！', '🍞');
    tween({
      from: sp.mesh.position.y, to: targetY, duration: 0.85, easing: ease.outBounce,
      onUpdate: v => { sp.mesh.position.y = v; },
      onComplete: () => {
        sfx.pop(0.8);
        squash(sp.mesh);
        state.cakeTop += sp.height;
        state.layerIndex++;
        focusCakeTop();
        setTimeout(nextLayerStep, 500);
      },
    });
  } else {
    // クリーム: 色を選んでもらう
    setHint('クリームの いろを えらんでね', '🎨');
    ui.palette.classList.add('show');
  }
}

function focusCakeTop() {
  const top = STAND_TOP + state.cakeTop;
  camPhase([0.06, top + 0.17, 0.34], [0, top + 0.01, 0]);
}

function squash(mesh) {
  tween({
    from: 0, to: 1, duration: 0.45, easing: ease.outElastic,
    onUpdate: v => {
      mesh.scale.set(1 + (1 - v) * 0.18, 1 - (1 - v) * 0.25, 1 + (1 - v) * 0.18);
    },
  });
}

// クリーム色選択
for (const btn of document.querySelectorAll('#palette button')) {
  btn.addEventListener('click', () => {
    if (state.phase !== 'LAYER' || state.currentCream) return;
    sfx.tap();
    ui.palette.classList.remove('show');
    state.creamColor = CREAM_COLORS[btn.dataset.color];
    const cream = createCreamSwirl(state.creamColor);
    cream.mesh.position.y = state.cakeTop;
    cakeGroup.add(cream.mesh);
    state.currentCream = cream;
    state.creamProgress = 0;
    pipingBag.group.visible = true;
    setHint('ながおしで クリームを しぼろう！', '🍦');
    setFinger('hold');
    setProgress(0);
  });
}

function finishCream() {
  const cream = state.currentCream;
  state.currentCream = null;
  pipingBag.group.visible = false;
  setFinger(null);
  setProgress(null);
  sfx.sparkle();
  state.cakeTop += cream.height;
  state.layerIndex++;
  focusCakeTop();
  setTimeout(nextLayerStep, 550);
}

// --- 飾りタップ ---
for (const btn of document.querySelectorAll('#tray button[data-deco]')) {
  btn.addEventListener('click', () => {
    if (state.phase !== 'DECORATE') return;
    if (state.decorations.length >= state.decoSlots.length) return;
    sfx.tap();
    placeDecoration(btn.dataset.deco);
    if (state.decorations.length >= 3) ui.doneBtn.classList.add('show');
  });
}

function placeDecoration(kind) {
  const deco = createDecoration(kind);
  const slot = state.decoSlots[state.decorations.length % state.decoSlots.length];
  // ろうそくは中央寄りに
  const pos = slot.clone();
  deco.position.set(pos.x, state.cakeTop + 0.35, pos.z);
  cakeGroup.add(deco);
  state.decorations.push(deco);
  tween({
    from: deco.position.y, to: state.cakeTop - 0.004, duration: 0.7, easing: ease.outBounce,
    onUpdate: v => { deco.position.y = v; },
    onComplete: () => { sfx.pop(1.2); },
  });
}

ui.doneBtn.addEventListener('click', () => {
  if (state.phase !== 'DECORATE') return;
  sfx.tap();
  // ろうそくが無ければ こっそり1本プレゼント
  if (!state.decorations.some(d => d.userData.kind === 'candle')) {
    placeDecoration('candle');
    showBanner('ろうそくも つけようね！');
    setTimeout(() => enterPhase('DOME'), 1100);
  } else {
    enterPhase('DOME');
  }
});

// --- ドーム降下 ---
function runDomeDescend() {
  dome.mesh.visible = true;
  dome.mesh.position.y = STAND_TOP + 0.55;
  sfx.whoosh();
  tween({
    from: STAND_TOP + 0.55, to: STAND_TOP, duration: 2.4, easing: ease.inOutCubic,
    onUpdate: v => { dome.mesh.position.y = v; },
    onComplete: () => {
      sfx.pop(0.6);
      sparkles.points.visible = true;
      showBanner('なにが できたか ひみつだよ…');
      setTimeout(() => enterPhase('REVEAL'), 1500);
    },
  });
}

// --- 完成のお祝い ---
function celebrate() {
  state.phase = 'DONE';
  setFinger(null);
  setProgress(null);
  setPourSound(0);
  sauceStream.setFlow(0);
  sparkles.points.visible = true;
  dome.mesh.visible = false;
  steam.setStrength(0);
  pitcher.group.visible = false;
  sfx.fanfare();
  showBanner('じゃじゃーん！！');
  // 飾りが ぴょこんと立ち上がる
  state.decorations.forEach((d, i) => {
    d.scale.setScalar(0.01);
    tween({
      delay: 0.15 + i * 0.12, from: 0.01, to: 1, duration: 0.8, easing: ease.outElastic,
      onUpdate: v => d.scale.setScalar(v),
      onComplete: () => sfx.pop(1 + i * 0.1),
    });
  });
  // ろうそく点火
  const candles = state.decorations.filter(d => d.userData.kind === 'candle');
  candles.forEach((c, i) => {
    setTimeout(() => {
      c.userData.flame.group.visible = true;
      sfx.chime(i);
    }, 900 + i * 250);
  });
  tween({
    delay: 0.9, from: 0, to: 1.1, duration: 1.2,
    onUpdate: v => { candleLight.intensity = v; },
  });
  candleLight.position.set(0, STAND_TOP + state.cakeTop + 0.09, 0);
  // キャラメルソースが流れ落ちる
  dripCrown.group.position.set(0, STAND_TOP + state.cakeTop + 0.002, 0);
  tween({
    delay: 0.4, from: 0, to: 1, duration: 2.0, easing: ease.outCubic,
    onUpdate: v => dripCrown.setFlow(v),
  });
  // 紙吹雪
  confetti.burst(new THREE.Vector3(0, STAND_TOP + state.cakeTop + 0.15, 0), timeNow);
  setTimeout(() => confetti.burst(new THREE.Vector3(0.1, STAND_TOP + 0.3, 0.05), timeNow), 1200);
  setTimeout(() => enterPhase('DONE'), 500);
}

// -------------------------------------------------------------------------
// タイトル・リプレイ
// -------------------------------------------------------------------------
ui.startBtn.addEventListener('click', () => {
  if (!audioReady) { unlock(); startBGM(); audioReady = true; }
  sfx.sparkle();
  ui.title.classList.add('hide');
  setTimeout(() => { ui.title.style.display = 'none'; }, 700);
  enterPhase('MIX');
});
ui.replayBtn.addEventListener('click', () => location.reload());

// -------------------------------------------------------------------------
// 毎フレーム更新
// -------------------------------------------------------------------------
const _bowlCenter = new THREE.Vector3();
const _tmp = new THREE.Vector3();
let timeNow = 0;

function updateMix(dt) {
  if (!state.mixReady || state.mixProgress >= 1) return;
  const batterY = bowl.group.position.y + 0.062;
  let stirSpeed = 0;
  if (pointer.down) {
    const hit = pointOnPlane(batterY);
    if (hit) {
      _bowlCenter.set(bowl.group.position.x, batterY, bowl.group.position.z);
      _tmp.copy(hit).sub(_bowlCenter);
      const r = Math.hypot(_tmp.x, _tmp.z);
      if (r < 0.3) {
        const ang = Math.atan2(_tmp.z, _tmp.x);
        if (state.lastStirAngle !== null) {
          let d = ang - state.lastStirAngle;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          const spd = Math.abs(d) / Math.max(dt, 1 / 240);
          stirSpeed = clamp(spd / 7, 0, 1);
          state.mixProgress = clamp(state.mixProgress + Math.abs(d) / (Math.PI * 2 * 4.5), 0, 1);
          bowl.batter.uniforms.uPhase.value += d;
        }
        state.lastStirAngle = ang;
        // スプーンがついてくる
        const rr = Math.min(r, 0.062);
        spoon.group.position.set(
          _bowlCenter.x + Math.cos(Math.atan2(_tmp.z, _tmp.x)) * rr,
          batterY + 0.006,
          _bowlCenter.z + Math.sin(Math.atan2(_tmp.z, _tmp.x)) * rr
        );
        spoon.group.rotation.y = -Math.atan2(_tmp.z, _tmp.x);
      }
    }
  } else {
    state.lastStirAngle = null;
  }
  state.stirEnergy = lerp(state.stirEnergy, stirSpeed, 1 - Math.pow(0.001, dt));
  bowl.batter.uniforms.uStir.value = Math.max(bowl.batter.uniforms.uStir.value * 0.9, state.stirEnergy);
  bowl.batter.uniforms.uMix.value = state.mixProgress;
  setStirSound(state.stirEnergy);
  setProgress(state.mixProgress);
  if (state.mixProgress >= 1) {
    setStirSound(0);
    sfx.sparkle();
    showBanner('まざったね！ すごい！');
    setFinger(null);
    setTimeout(() => enterPhase('POUR'), 1200);
  }
}

function updatePour(dt, hdt) {
  if (state.pourLevel >= 1) return;
  const pouring = pointer.down && bowl.group.position.y > 0.3;
  state.bowlTilt = lerp(state.bowlTilt, pouring ? 1 : 0, 1 - Math.pow(0.002, hdt));
  const tilt = state.bowlTilt;
  bowl.group.rotation.z = tilt * 2.05;
  bowl.group.position.x = lerp(-0.06, 0.152, tilt); // 注ぎ口が型の中心に来る位置へ
  const flow = clamp((tilt - 0.55) / 0.3, 0, 1);
  if (flow > 0.02) {
    // ボウルの縁（注ぎ口）の実位置から型へ
    const th = bowl.group.rotation.z;
    const rim = _tmp.set(
      bowl.group.position.x + 0.112 * Math.cos(th) - 0.104 * Math.sin(th),
      bowl.group.position.y + 0.112 * Math.sin(th) + 0.104 * Math.cos(th),
      bowl.group.position.z);
    const level = 0.024 + state.pourLevel * 0.062;
    batterStream.set(rim, level);
    batterStream.setFlow(flow);
    state.pourLevel = clamp(state.pourLevel + hdt * flow / 3.6, 0, 1);
    pan.setLevel(state.pourLevel);
    pan.surface.uniforms.uStir.value = flow * 0.7;
  } else {
    batterStream.setFlow(0);
    pan.surface.uniforms.uStir.value *= 0.95;
  }
  setPourSound(flow);
  setProgress(state.pourLevel);
  if (state.pourLevel >= 1) {
    batterStream.setFlow(0);
    setPourSound(0);
    setFinger(null);
    sfx.chime(0); sfx.chime(2);
    showBanner('いっぱいに なったよ！');
    // ボウルを戻して片付ける
    tween({
      from: 0, to: 1, duration: 0.9, easing: ease.inOutCubic,
      onUpdate: v => {
        bowl.group.rotation.z = (1 - v) * 2.05;
        bowl.group.position.set(lerp(-0.02, -0.5, v), lerp(0.33, 0.02, v), lerp(0, 0.25, v));
      },
      onComplete: () => { bowl.group.visible = false; setTimeout(() => enterPhase('BAKE'), 300); },
    });
  }
}

function updateCream(dt, hdt) {
  if (!state.currentCream) return;
  if (pointer.down && state.creamProgress < 1) {
    state.creamProgress = clamp(state.creamProgress + hdt / 2.4, 0, 1);
    state.currentCream.setProgress(state.creamProgress);
    setPourSound(0.35);
    // 絞り袋が渦巻きの先端についていく
    const tip = state.currentCream.tipAt(state.creamProgress);
    pipingBag.group.position.set(tip.x, STAND_TOP + state.cakeTop + tip.y + 0.035, tip.z);
    pipingBag.group.rotation.z = Math.sin(timeNow * 8) * 0.06;
    setProgress(state.creamProgress);
    if (state.creamProgress >= 1) {
      setPourSound(0);
      finishCream();
    }
  } else {
    setPourSound(0);
    if (!pointer.down && state.creamProgress > 0 && state.creamProgress < 1) {
      // 途中で離しても大丈夫（失敗なし）
      const tip = state.currentCream.tipAt(state.creamProgress);
      pipingBag.group.position.set(tip.x, STAND_TOP + state.cakeTop + tip.y + 0.045, tip.z);
    } else if (state.creamProgress === 0) {
      pipingBag.group.position.set(0.078, STAND_TOP + state.cakeTop + 0.06, 0);
    }
  }
}

function updateReveal(dt, hdt) {
  if (state.melt >= 1) return;
  const pouring = pointer.down;
  state.pitcherTilt = lerp(state.pitcherTilt, pouring ? 1 : 0, 1 - Math.pow(0.002, hdt));
  const pt = state.pitcherTilt;
  pitcher.group.rotation.z = -pt * 1.15;
  // 傾くほど注ぎ口がドーム頂点の真上に来るように移動
  pitcher.group.position.x = lerp(0.24, -0.128, pt);
  pitcher.group.position.y = lerp(0.46, 0.505, pt);
  pitcher.group.position.z = lerp(0.05, 0.015, pt);
  const flow = clamp((pt - 0.5) / 0.35, 0, 1);
  if (flow > 0.02) {
    pitcher.group.updateMatrixWorld(true);
    const spout = _tmp.copy(pitcher.spoutLocal).applyMatrix4(pitcher.group.matrixWorld);
    // ドームが溶けて開いたら、露出したケーキの上面でソースが止まる
    const domeTopY = STAND_TOP + 0.263 - state.melt * 0.263;
    const hitY = Math.max(domeTopY, STAND_TOP + state.cakeTop - 0.005);
    sauceStream.set(spout, Math.max(hitY, STAND_TOP + 0.01));
    sauceStream.setFlow(flow);
    state.melt = clamp(state.melt + hdt * flow / 4.5, 0, 1);
    dome.setMelt(state.melt);
    steam.group.position.set(0, domeTopY + 0.02, 0);
    steam.setStrength(flow);
    // 溶け際からチョコが垂れる
    if (Math.random() < dt * 14) {
      const cutY = 0.263 * (1 - state.melt * 1.1);
      const rr = 0.142 * Math.sqrt(Math.max(0.05, 1 - Math.pow(clamp(cutY / 0.263, 0, 1), 2)));
      const a = Math.random() * Math.PI * 2;
      drips.spawn(new THREE.Vector3(Math.cos(a) * rr, STAND_TOP + Math.max(cutY, 0.01), Math.sin(a) * rr));
    }
    meltPool.setSize(state.melt * 0.132);
    if (Math.random() < dt * 2) sfx.pop(0.5 + Math.random() * 0.3);
  } else {
    sauceStream.setFlow(0);
    steam.setStrength(state.pitcherTilt * 0.3);
  }
  setPourSound(flow * 0.8);
  setProgress(state.melt);
  if (state.melt >= 0.32 && !state.meltRumbled) { state.meltRumbled = true; sfx.meltRumble(); }
  if (state.melt >= 1) celebrate();
}

// -------------------------------------------------------------------------
// メインループ
// -------------------------------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);        // 連続的な見た目の更新用
  const hdt = Math.min(rawDt, 0.25);       // 進捗・トゥイーン用（低fpsでも実時間で進む）
  timeNow = clock.elapsedTime;
  updateTweens(hdt);

  switch (state.phase) {
    case 'MIX': updateMix(dt); break;
    case 'POUR': updatePour(dt, hdt); break;
    case 'LAYER': updateCream(dt, hdt); break;
    case 'REVEAL': updateReveal(dt, hdt); break;
    case 'DONE':
      state.doneTime += dt;
      {
        const a = state.doneTime * 0.35;
        const r = 0.58, top = STAND_TOP + state.cakeTop * 0.6;
        setCam([Math.sin(a) * r, top + 0.22, Math.cos(a) * r], [0, top, 0]);
      }
      break;
  }

  // 各オブジェクトの時間更新
  bowl.batter.update(dt, timeNow);
  pan.surface.update(dt, timeNow);
  batterStream.update(dt, timeNow);
  sauceStream.update(dt, timeNow);
  dome.update(dt, timeNow);
  drips.update(dt, STAND_TOP);
  dripCrown.update(dt, timeNow);
  confetti.update(dt, timeNow);
  sparkles.update(dt, timeNow);
  steam.update(dt, timeNow);
  for (const d of state.decorations) {
    if (d.userData.flame && d.userData.flame.group.visible) d.userData.flame.update(dt, timeNow);
  }
  if (candleLight.intensity > 0) {
    candleLight.intensity = 1.0 + Math.sin(timeNow * 11) * 0.15 + Math.sin(timeNow * 23) * 0.08;
  }

  // カメラのなめらかな追従
  const k = 1 - Math.pow(0.005, dt);
  camState.pos.lerp(camState.targetPos, k);
  camState.look.lerp(camState.targetLook, k);
  camera.position.copy(camState.pos);
  camera.lookAt(camState.look);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// -------------------------------------------------------------------------
// リサイズ
// -------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = isPortrait() ? 44 : 38;
  camera.updateProjectionMatrix();
  applyCamPhase();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

// タイトルのカメラ
setCam([0.3, 0.3, 0.58], [-0.02, 0.09, 0]);
animate();

// デバッグ・自動テスト用フック
window.__game = { state, enterPhase, celebrate, startBaking, placeDecoration };
