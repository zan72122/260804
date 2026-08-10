// かがみのケーキ（ミラーグレーズ）レシピ
// フェーズ: MOUSSE → INSERT → FREEZE → UNMOLD → GLAZE → DECO → CUT → DONE
import * as THREE from '../../vendor/three.module.js';
import { createStream, createPitcher, createDecoration, createConfetti, createSparkles, createDrips } from '../cake.js';
import { tween, ease, clamp, lerp } from '../util.js';
import {
  MOLD_R, MOLD_H, MOUSSE_R, LAYER_H, GLAZE_R, RIGHT_THETA, LEFT_THETA,
  createMold, createMousseLayer, createPourSurface, createCapPlane,
  createGlazeSide, createGlazeTop, createKnife, createFrostParticles,
  createGoldBit, createFlowerDeco, paintCapCanvas,
} from './glazeObjects.js';

export const meta = { id: 'glaze', title: 'かがみのケーキ', emoji: '🪞' };

const MOUSSE_COLORS = { pink: 0xffb3c6, mint: 0xa8e6c9, lemon: 0xfff2a8 };
const GLAZE_COLORS = {
  pink: { a: 0xffd0e0, b: 0xe85f8f },
  choco: { a: 0xcf9a5c, b: 0x5a3417 },
  rainbow: { a: 0xffffff, b: 0xffffff },
};
// 天面かざりの置き場所（半分ごとの左右振り分けに x の符号を使う）
const DECO_SLOTS = [[0.02, 0], [-0.02, 0], [0.03, 0.03], [-0.03, 0.03], [0.02, -0.035], [-0.02, -0.035]];

export function createRecipe(ctx) {
  const { scene } = ctx;
  const sfx = ctx.audio.sfx;

  const state = {
    phase: 'MOUSSE',
    mousseLayer: 0,
    pourProgress: 0,
    insertCount: 0,
    freezeStarted: false,
    unmoldProgress: 0,
    glazeProgress: 0,
    decoCount: 0,
    cutProgress: 0,
  };
  ctx.registerState(state);

  // --- 内部だけで使う補助データ ---
  const mousseColorKeys = [null, null, null];
  const mousseColorHex = ['#ffe8ee', '#ffe8ee', '#ffe8ee'];
  const insertedFruits = []; // { kind, u, v }
  let glazeColorKey = null;
  let cutTriggered = false;
  let unmoldSfxPlayed = false;
  let prevDown = false;
  let timeNow = 0;
  let doneTime = 0;

  // -----------------------------------------------------------------------
  // シーン構築
  // -----------------------------------------------------------------------
  const cakeRoot = new THREE.Group();
  cakeRoot.position.set(0, ctx.STAND_TOP, 0);
  scene.add(cakeRoot);

  const mold = createMold();
  cakeRoot.add(mold.group);

  function buildHalf(thetaStart) {
    const group = new THREE.Group();
    const layers = [0, 1, 2].map(i => createMousseLayer(thetaStart, i));
    layers.forEach(l => group.add(l.mesh));
    const surface = createPourSurface(thetaStart);
    group.add(surface.mesh);
    const glazeSide = createGlazeSide(thetaStart);
    group.add(glazeSide.mesh);
    const glazeTop = createGlazeTop(thetaStart);
    group.add(glazeTop.mesh);
    const cap = createCapPlane();
    group.add(cap.mesh);
    cakeRoot.add(group);
    return { group, layers, surface, glazeSide, glazeTop, cap, decos: [] };
  }
  const rightHalf = buildHalf(RIGHT_THETA);
  const leftHalf = buildHalf(LEFT_THETA);
  const halves = [rightHalf, leftHalf];

  // ムースを注ぐストリーム + 注ぎ口（cake.js のピッチャーを再利用）
  const mousseStream = createStream(0xffb3c6, { radius: 0.009 });
  scene.add(mousseStream.mesh);
  const pourCup = createPitcher();
  scene.add(pourCup.group);
  pourCup.group.visible = false;

  // グレーズを注ぐストリーム + ピッチャー
  const glazeStream = createStream(0xffffff, { radius: 0.01, emissive: 0.1 });
  scene.add(glazeStream.mesh);
  const glazePitcher = createPitcher();
  scene.add(glazePitcher.group);
  glazePitcher.group.visible = false;

  // ナイフ
  const knife = createKnife();
  scene.add(knife.group);
  knife.group.visible = false;

  // 冷気パーティクル + 冷たい光
  const frost = createFrostParticles();
  frost.group.position.copy(cakeRoot.position);
  scene.add(frost.group);
  const coldLight = new THREE.PointLight(0x8fd8ff, 0, 0.6, 2);
  coldLight.position.set(0, ctx.STAND_TOP + MOLD_H * 0.6, 0);
  scene.add(coldLight);

  // 完成演出まわり
  const confetti = createConfetti();
  scene.add(confetti.points);
  const sparkles = createSparkles();
  sparkles.points.visible = false;
  sparkles.points.position.copy(cakeRoot.position);
  scene.add(sparkles.points);
  const drips = createDrips();
  scene.add(drips.group);

  // -----------------------------------------------------------------------
  // UI（トレイ・ボタン）
  // -----------------------------------------------------------------------
  const trayMousse = ctx.ui.makeTray('trayMousse', [
    { key: 'pink', emoji: '🍓', bg: '#ffd7e2' },
    { key: 'mint', emoji: '🍀', bg: '#cdf5e0' },
    { key: 'lemon', emoji: '🍋', bg: '#fff6c9' },
  ], onPickMousseColor);
  const trayFruit = ctx.ui.makeTray('trayFruit', [
    { key: 'strawberry', emoji: '🍓' },
    { key: 'blueberry', emoji: '🫐' },
    { key: 'orange', emoji: '🍊' },
  ], onPickFruit);
  const trayGlaze = ctx.ui.makeTray('trayGlaze', [
    { key: 'rainbow', emoji: '🌈' },
    { key: 'pink', emoji: '💗' },
    { key: 'choco', emoji: '🍫' },
  ], onPickGlaze);
  const trayGdeco = ctx.ui.makeTray('trayGdeco', [
    { key: 'gold', emoji: '✨' },
    { key: 'flower', emoji: '🌸' },
    { key: 'heart', emoji: '💖' },
  ], onPickDeco);
  const btnNext = ctx.ui.makeActionButton('glazeNext', 'できた！', () => {
    if (state.phase !== 'INSERT') return;
    sfx.tap();
    btnNext.hide();
    enterPhase('FREEZE');
  });
  const btnCut = ctx.ui.makeActionButton('glazeCut', 'きってみる！', () => {
    if (state.phase !== 'DECO') return;
    sfx.tap();
    btnCut.hide();
    enterPhase('CUT');
  });
  [trayMousse, trayFruit, trayGlaze, trayGdeco].forEach(t => t.hide());
  btnNext.hide();
  btnCut.hide();

  function tintPitcherContents(p, hex) {
    p.group.traverse(o => {
      if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.material.color.set(hex);
      if (o.isPointLight) o.color.set(hex);
    });
  }

  // -----------------------------------------------------------------------
  // トレイのコールバック
  // -----------------------------------------------------------------------
  function onPickMousseColor(key) {
    if (state.phase !== 'MOUSSE' || mousseColorKeys[state.mousseLayer]) return;
    sfx.tap();
    const hex = MOUSSE_COLORS[key];
    mousseColorKeys[state.mousseLayer] = key;
    mousseColorHex[state.mousseLayer] = '#' + hex.toString(16).padStart(6, '0');
    for (const h of halves) {
      h.layers[state.mousseLayer].mat.color.set(hex);
      h.surface.mat.color.set(hex);
    }
    tintPitcherContents(pourCup, hex);
    trayMousse.hide();
    ctx.ui.setHint('ながおしで そそいでね', '🫗');
    ctx.ui.setFinger('hold');
    ctx.ui.setProgress(0);
  }

  function onPickFruit(key) {
    if (state.phase !== 'INSERT') return;
    sfx.tap();
    spawnFruit(key);
  }

  function spawnFruit(kind) {
    const deco = createDecoration(kind);
    deco.scale.setScalar(0.8);
    const ox = (Math.random() - 0.5) * MOUSSE_R * 0.85;
    const oz = (Math.random() - 0.5) * MOUSSE_R * 0.85;
    const startY = ctx.STAND_TOP + MOLD_H + 0.14;
    const surfaceY = ctx.STAND_TOP + MOLD_H;
    deco.position.set(ox, startY, oz);
    scene.add(deco);
    const sinkRatio = 0.22 + Math.random() * 0.5;
    const endY = ctx.STAND_TOP + MOLD_H * sinkRatio;
    tween({
      from: startY, to: surfaceY, duration: 0.32, easing: t => t * t,
      onUpdate: v => { deco.position.y = v; },
      onComplete: () => {
        sfx.plop();
        tween({
          from: surfaceY, to: endY, duration: 0.5, easing: ease.inOutCubic,
          onUpdate: v => { deco.position.y = v; deco.scale.setScalar(lerp(0.8, 0.55, (surfaceY - v) / (surfaceY - endY || 1))); },
          onComplete: () => {
            scene.remove(deco);
            const u = clamp(0.5 + oz / (MOUSSE_R * 2), 0.1, 0.9);
            const v = clamp((endY - ctx.STAND_TOP) / MOLD_H, 0.08, 0.9);
            insertedFruits.push({ kind, u, v });
            state.insertCount++;
            if (state.insertCount >= 2) btnNext.show();
          },
        });
      },
    });
  }

  function onPickGlaze(key) {
    if (state.phase !== 'GLAZE' || glazeColorKey) return;
    sfx.tap();
    glazeColorKey = key;
    const colors = GLAZE_COLORS[key];
    for (const h of halves) {
      h.glazeSide.setColors(colors.a, colors.b);
      h.glazeSide.setRainbow(key === 'rainbow');
      h.glazeTop.setColor(key === 'rainbow' ? 0xfafcff : colors.a);
    }
    tintPitcherContents(glazePitcher, key === 'rainbow' ? 0xffffff : colors.a);
    trayGlaze.hide();
    ctx.ui.setHint('ながおしで とろ〜り かけよう', '🫗');
    ctx.ui.setFinger('hold');
    ctx.ui.setProgress(0);
    glazePitcher.group.visible = true;
  }

  function onPickDeco(key) {
    if (state.phase !== 'DECO') return;
    sfx.tap();
    placeTopDeco(key);
  }

  function placeTopDeco(kind) {
    let deco;
    if (kind === 'gold') deco = createGoldBit();
    else if (kind === 'flower') deco = createFlowerDeco();
    else { deco = createDecoration('candy'); deco.scale.setScalar(0.5); }
    const [sx, sz] = DECO_SLOTS[state.decoCount % DECO_SLOTS.length];
    const half = sx >= 0 ? rightHalf : leftHalf;
    const topY = MOLD_H + 0.006;
    deco.position.set(sx, topY + 0.05, sz);
    half.group.add(deco);
    half.decos.push(deco);
    tween({
      from: deco.position.y, to: topY, duration: 0.5, easing: ease.outBounce,
      onUpdate: v => { deco.position.y = v; },
      onComplete: () => sfx.pop(1.1),
    });
    state.decoCount++;
    if (state.decoCount === 1) btnCut.show();
  }

  // -----------------------------------------------------------------------
  // フェーズ遷移
  // -----------------------------------------------------------------------
  function enterPhase(next) {
    state.phase = next;
    ctx.ui.setFinger(null);
    ctx.ui.setProgress(null);
    if (next === 'MOUSSE') {
      ctx.camPhase([0.22, ctx.STAND_TOP + 0.15, 0.3], [0, ctx.STAND_TOP + 0.045, 0]);
      ctx.ui.setHint('いろを えらんでね', '🎨');
      trayMousse.show();
    } else if (next === 'INSERT') {
      trayMousse.hide();
      ctx.camPhase([0.16, ctx.STAND_TOP + MOLD_H + 0.11, 0.24], [0, ctx.STAND_TOP + MOLD_H * 0.65, 0]);
      ctx.ui.setHint('フルーツを ぽちゃんと いれてね', '🍓');
      trayFruit.show();
    } else if (next === 'FREEZE') {
      trayFruit.hide();
      ctx.camPhase([0.15, ctx.STAND_TOP + MOLD_H + 0.1, 0.24], [0, ctx.STAND_TOP + MOLD_H * 0.55, 0]);
      ctx.ui.setHint('がめんを タップして こおらせよう', '❄️');
      state.freezeStarted = false;
      setTimeout(() => { if (state.phase === 'FREEZE' && !state.freezeStarted) startFreeze(); }, 3400);
    } else if (next === 'UNMOLD') {
      ctx.camPhase([0.18, ctx.STAND_TOP + MOLD_H + 0.13, 0.27], [0, ctx.STAND_TOP + MOLD_H * 0.5, 0]);
      ctx.ui.setHint('ながおしで がたを はずそう', '✨');
      ctx.ui.setFinger('hold');
      ctx.ui.setProgress(0);
      unmoldSfxPlayed = false;
    } else if (next === 'GLAZE') {
      ctx.camPhase([0.2, ctx.STAND_TOP + MOLD_H + 0.15, 0.28], [0, ctx.STAND_TOP + MOLD_H * 0.55, 0]);
      ctx.ui.setHint('グレーズの いろを えらんでね', '🎨');
      trayGlaze.show();
    } else if (next === 'DECO') {
      trayGlaze.hide();
      glazePitcher.group.visible = false;
      glazeStream.setFlow(0);
      ctx.camPhase([0.15, ctx.STAND_TOP + MOLD_H + 0.12, 0.24], [0, ctx.STAND_TOP + MOLD_H * 0.65, 0]);
      ctx.ui.setHint('すきな かざりを のせてね', '✨');
      trayGdeco.show();
    } else if (next === 'CUT') {
      trayGdeco.hide();
      ctx.camPhase([0.03, ctx.STAND_TOP + MOLD_H * 0.75, 0.3], [0, ctx.STAND_TOP + MOLD_H * 0.5, 0]);
      ctx.ui.setHint('ながおしで きってみよう', '🔪');
      ctx.ui.setFinger('hold');
      ctx.ui.setProgress(0);
      cutTriggered = false;
      knife.group.visible = true;
      knife.group.position.set(0, ctx.STAND_TOP + MOLD_H + 0.32, 0);
    } else if (next === 'DONE') {
      ctx.ui.setHint('わあ！ かがみみたいだね', '🪞');
    }
  }

  // -----------------------------------------------------------------------
  // フェーズごとの毎フレーム処理
  // -----------------------------------------------------------------------
  function updateMousse(dt, hdt) {
    if (mousseColorKeys[state.mousseLayer] == null) return;
    const pouring = ctx.pointer.down;
    const fillBase = state.mousseLayer * LAYER_H;
    const curY = ctx.STAND_TOP + fillBase + state.pourProgress * LAYER_H;

    pourCup.group.visible = true;
    const targetTilt = pouring ? -1.05 : -0.15;
    pourCup.group.rotation.z = lerp(pourCup.group.rotation.z, targetTilt, 1 - Math.pow(0.001, hdt));
    pourCup.group.position.set(0.1, ctx.STAND_TOP + MOLD_H + 0.15, 0.02);
    pourCup.group.updateMatrixWorld(true);
    const spout = pourCup.spoutLocal.clone().applyMatrix4(pourCup.group.matrixWorld);
    mousseStream.set(spout, curY);

    if (pouring) {
      mousseStream.setFlow(1);
      state.pourProgress = clamp(state.pourProgress + hdt / 1.8, 0, 1);
      for (const h of halves) {
        h.layers[state.mousseLayer].setFill(state.pourProgress);
        h.surface.mesh.visible = true;
        h.surface.mesh.position.y = fillBase + state.pourProgress * LAYER_H + 0.0006;
      }
      ctx.audio.setPourSound(0.6);
    } else {
      mousseStream.setFlow(0);
      ctx.audio.setPourSound(0);
    }
    ctx.ui.setProgress(state.pourProgress);

    if (state.pourProgress >= 1) {
      mousseStream.setFlow(0);
      ctx.audio.setPourSound(0);
      sfx.chime(state.mousseLayer);
      state.mousseLayer++;
      state.pourProgress = 0;
      if (state.mousseLayer >= 3) {
        pourCup.group.visible = false;
        ctx.ui.setFinger(null);
        ctx.ui.setProgress(null);
        ctx.ui.showBanner('3だん できたよ！');
        setTimeout(() => enterPhase('INSERT'), 900);
      } else {
        ctx.ui.setFinger(null);
        ctx.ui.setProgress(null);
        ctx.ui.setHint('つぎの いろを えらんでね', '🎨');
        trayMousse.show();
      }
    }
  }

  function startFreeze() {
    state.freezeStarted = true;
    ctx.ui.setHint('カチコチ こおったよ！', '❄️');
    sfx.freeze();
    frost.setStrength(1);
    tween({ from: 0, to: 1.5, duration: 0.5, easing: ease.outCubic, onUpdate: v => { coldLight.intensity = v; } });
    const origColors = halves.map(h => h.layers.map(l => l.mat.color.clone()));
    tween({
      from: 0, to: 1, duration: 1.6, easing: ease.outCubic,
      onUpdate: v => {
        halves.forEach((h, hi) => h.layers.forEach((l, li) => {
          l.mat.color.copy(origColors[hi][li]).lerp(new THREE.Color(0xf5faff), v * 0.82);
          l.mat.roughness = lerp(0.45, 0.14, v);
          l.mat.clearcoat = lerp(0.4, 0.9, v);
        }));
      },
    });
    setTimeout(() => {
      frost.setStrength(0);
      tween({ from: coldLight.intensity, to: 0.3, duration: 0.6, onUpdate: v => { coldLight.intensity = v; } });
      if (state.phase === 'FREEZE') enterPhase('UNMOLD');
    }, 3000);
  }

  function updateFreeze() {
    if (!state.freezeStarted && ctx.pointer.down && !prevDown) startFreeze();
  }

  function updateUnmold(dt, hdt) {
    if (state.unmoldProgress >= 1) return;
    if (ctx.pointer.down) {
      state.unmoldProgress = clamp(state.unmoldProgress + hdt / 1.1, 0, 1);
      mold.group.position.y = state.unmoldProgress * 0.4;
      mold.mat.opacity = 1 - state.unmoldProgress * 0.95;
      if (state.unmoldProgress > 0.04 && !unmoldSfxPlayed) { unmoldSfxPlayed = true; sfx.unmold(); }
      ctx.ui.setProgress(state.unmoldProgress);
    }
    if (state.unmoldProgress >= 1) {
      mold.group.visible = false;
      ctx.ui.setFinger(null);
      ctx.ui.setProgress(null);
      ctx.ui.showBanner('つるん！ しろくて つやつや！');
      setTimeout(() => enterPhase('GLAZE'), 1000);
    }
  }

  function updateGlaze(dt, hdt) {
    if (!glazeColorKey || state.glazeProgress >= 1) return;
    const pouring = ctx.pointer.down;
    const targetTilt = pouring ? -1.05 : -0.15;
    glazePitcher.group.rotation.z = lerp(glazePitcher.group.rotation.z, targetTilt, 1 - Math.pow(0.001, hdt));
    glazePitcher.group.position.set(0.12, ctx.STAND_TOP + MOLD_H + 0.18, 0.02);
    glazePitcher.group.updateMatrixWorld(true);
    const spout = glazePitcher.spoutLocal.clone().applyMatrix4(glazePitcher.group.matrixWorld);

    if (pouring) {
      state.glazeProgress = clamp(state.glazeProgress + hdt / 4.2, 0, 1);
      const topCoverage = clamp(state.glazeProgress / 0.3, 0, 1);
      const sideCoverage = clamp((state.glazeProgress - 0.25) / 0.75, 0, 1);
      for (const h of halves) { h.glazeTop.setCoverage(topCoverage); h.glazeSide.setFlow(sideCoverage); }
      glazeStream.set(spout, ctx.STAND_TOP + MOLD_H + (1 - topCoverage) * 0.02);
      glazeStream.setFlow(1);
      ctx.audio.setPourSound(0.6);
      if (sideCoverage > 0.05 && Math.random() < dt * 6) {
        const a = Math.random() * Math.PI * 2;
        drips.spawn(new THREE.Vector3(Math.cos(a) * GLAZE_R, ctx.STAND_TOP + 0.012, Math.sin(a) * GLAZE_R));
      }
    } else {
      glazeStream.setFlow(0);
      ctx.audio.setPourSound(0);
    }
    ctx.ui.setProgress(state.glazeProgress);

    if (state.glazeProgress >= 1) {
      glazeStream.setFlow(0);
      ctx.audio.setPourSound(0);
      ctx.ui.setFinger(null);
      ctx.ui.setProgress(null);
      sfx.chime(3);
      ctx.ui.showBanner('かがみみたいに ぴかぴか！');
      tween({
        from: 0, to: 1, duration: 1.0,
        onUpdate: v => { for (const h of halves) { h.glazeSide.setMirror(v); h.glazeTop.setMirror(v); } },
      });
      setTimeout(() => enterPhase('DECO'), 1300);
    }
  }

  function updateCut(dt, hdt) {
    if (state.cutProgress >= 1) return;
    if (ctx.pointer.down) {
      state.cutProgress = clamp(state.cutProgress + hdt / 1.5, 0, 1);
      const y0 = ctx.STAND_TOP + MOLD_H + 0.32, y1 = ctx.STAND_TOP - 0.06;
      knife.group.position.y = lerp(y0, y1, state.cutProgress);
      ctx.ui.setProgress(state.cutProgress);
      if (state.cutProgress > 0.42 && !cutTriggered) {
        cutTriggered = true;
        sfx.knifeCut();
        openHalves();
      }
    }
    if (state.cutProgress >= 1) finishCut();
  }

  function openHalves() {
    const capTex = paintCapCanvas(mousseColorHex, insertedFruits);
    rightHalf.cap.mat.map = capTex;
    rightHalf.cap.mat.needsUpdate = true;
    rightHalf.cap.mesh.visible = true;
    leftHalf.cap.mat.map = capTex;
    leftHalf.cap.mat.needsUpdate = true;
    leftHalf.cap.mesh.visible = true;
    tween({
      from: 0, to: 1, duration: 1.0, easing: ease.outCubic,
      onUpdate: v => {
        rightHalf.group.position.x = v * 0.05;
        rightHalf.group.rotation.y = -v * 0.38;
        leftHalf.group.position.x = -v * 0.05;
        leftHalf.group.rotation.y = v * 0.38;
      },
    });
  }

  function finishCut() {
    ctx.ui.setFinger(null);
    ctx.ui.setProgress(null);
    knife.group.visible = false;
    sparkles.points.visible = true;
    confetti.burst(new THREE.Vector3(0, ctx.STAND_TOP + MOLD_H * 0.7, 0), timeNow);
    sfx.fanfare();
    ctx.ui.showBanner('できあがり！ ひみつが みえたよ！');
    setTimeout(() => {
      enterPhase('DONE');
      ctx.finish();
    }, 1200);
  }

  // -----------------------------------------------------------------------
  // 公開API
  // -----------------------------------------------------------------------
  function start() {
    ctx.stand.group.visible = true;
    enterPhase('MOUSSE');
  }

  function update(dt, hdt, t) {
    timeNow = t;
    switch (state.phase) {
      case 'MOUSSE': updateMousse(dt, hdt); break;
      case 'FREEZE': updateFreeze(); break;
      case 'UNMOLD': updateUnmold(dt, hdt); break;
      case 'GLAZE': updateGlaze(dt, hdt); break;
      case 'CUT': updateCut(dt, hdt); break;
      case 'DONE': {
        doneTime += dt;
        const a = doneTime * 0.3;
        const r = 0.32, top = ctx.STAND_TOP + MOLD_H * 0.55;
        ctx.camPhase([Math.sin(a) * r, top + 0.17, Math.cos(a) * r], [0, top, 0]);
        break;
      }
      default: break; // INSERT / DECO はトレイのタップだけで進む
    }
    mousseStream.update(dt, t);
    glazeStream.update(dt, t);
    for (const h of halves) h.glazeSide.update(dt, t);
    frost.update(dt, t);
    confetti.update(dt, t);
    sparkles.update(dt, t);
    drips.update(dt, ctx.STAND_TOP);
    prevDown = ctx.pointer.down;
  }

  return { start, update };
}
