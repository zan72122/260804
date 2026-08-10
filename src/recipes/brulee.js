// レシピ「あぶってパリン！」(クレームブリュレ + ベイクドアラスカ)
// フェーズ: CUSTARD → SCOOP → MERINGUE → SUGAR → TORCH → CRACK → DONE
import * as THREE from '../../vendor/three.module.js';
import { createStream, createSteam, createConfetti, createPitcher } from '../cake.js';
import { tween, ease, clamp, lerp } from '../util.js';
import {
  createDish, createCustardPool, createIceScoop, createMeringueDome, createMeringueWedges,
  createSugarGlints, createSugarFall, createTorchTool, createGlassShell,
  createCrackOverlay, createShards, createSparkler, createColdMist,
} from './bruleeObjects.js';

export const meta = { id: 'brulee', title: 'あぶってパリン！', emoji: '🔥' };

export function createRecipe(ctx) {
  const { scene, ui, audio, STAND_TOP } = ctx;

  const state = {
    phase: 'CUSTARD',
    custardLevel: 0,
    scoopCount: 0,
    meringueProgress: 0,
    sugarProgress: 0,
    torchProgress: 0,
    crackStage: 0,
  };
  ctx.registerState(state);

  // -----------------------------------------------------------------------
  // シーン構築
  // -----------------------------------------------------------------------
  const dish = createDish();
  dish.group.position.set(0, STAND_TOP, 0);
  scene.add(dish.group);

  const custard = createCustardPool(dish.wellRadius, 0.022);
  custard.group.position.set(0, STAND_TOP + dish.wellFloorY, 0);
  scene.add(custard.group);

  const custardStream = createStream(0xffe3a3, { radius: 0.012 });
  scene.add(custardStream.mesh);

  const pitcher = createPitcher();
  pitcher.group.visible = false;
  scene.add(pitcher.group);

  const custardTopY = STAND_TOP + dish.wellFloorY + custard.maxHeight;

  const scoops = []; // {group, radius}

  const DOME_R = 0.09, DOME_ELONGATE = 1.55;
  const meringue = createMeringueDome(DOME_R, DOME_ELONGATE);
  meringue.group.position.set(0, custardTopY, 0);
  scene.add(meringue.group);

  const sugarGlints = createSugarGlints(DOME_R, DOME_ELONGATE);
  meringue.group.add(sugarGlints.points);

  const sugarFall = createSugarFall(DOME_R, DOME_ELONGATE);
  sugarFall.points.position.set(0, custardTopY, 0);
  scene.add(sugarFall.points);

  const glassShell = createGlassShell(meringue.geometry, meringue.coverageTexture, DOME_R, DOME_ELONGATE);
  glassShell.group.position.set(0, custardTopY, 0);
  scene.add(glassShell.group);

  // パリン割れ後にメレンゲが「割れ開く」ためのくさび片（外側へ倒れて器の縁に残る）
  const meringueWedges = createMeringueWedges(meringue, 5);
  meringueWedges.group.position.set(0, custardTopY, 0);
  scene.add(meringueWedges.group);

  const crackOverlay = createCrackOverlay(meringue.geometry, DOME_R, DOME_ELONGATE);
  crackOverlay.mesh.position.set(0, custardTopY, 0);
  scene.add(crackOverlay.mesh);

  const shards = createShards(13);
  scene.add(shards.group);

  const torchTool = createTorchTool();
  torchTool.group.visible = false;
  scene.add(torchTool.group);

  const torchSteam = createSteam(5);
  torchSteam.group.visible = false;
  scene.add(torchSteam.group);

  const coldMist = createColdMist(6);
  coldMist.group.position.set(0, custardTopY, 0);
  scene.add(coldMist.group);

  const sparkler = createSparkler(60);
  scene.add(sparkler.group);

  const confetti = createConfetti();
  scene.add(confetti.points);

  const apexY = custardTopY + meringue.totalHeight;

  // -----------------------------------------------------------------------
  // フェーズ遷移
  // -----------------------------------------------------------------------
  let torchRoamT = Math.random() * 10;
  let ambientRoamT = Math.random() * 10;
  let lastPX = null, lastPY = null;
  let crackHoldTimer = 0;
  let crackArmed = false; // TORCHからの押しっぱなしを引き継いで誤爆しないためのガード
  let confettiShowerId = null;

  // CRACK中は実イベントで即応（低fps環境ではフレームごとのpointer.downサンプリングだと
  // すばやいタップのdown/upが1フレームの間に完結して検知漏れすることがあるため）
  ctx.renderer.domElement.addEventListener('pointerdown', () => {
    if (state.phase === 'CRACK') { handleCrackTap(); crackHoldTimer = 0; }
  });

  function enterPhase(p) {
    state.phase = p;
    ui.setFinger(null);
    ui.setProgress(null);
    if (p === 'CUSTARD') {
      ctx.camPhase([0.26, STAND_TOP + 0.30, 0.42], [0, STAND_TOP + 0.05, 0]);
      pitcher.group.visible = true;
      pitcher.group.position.set(0.22, STAND_TOP + 0.34, 0.06);
      pitcher.group.rotation.z = 0;
      ui.setHint('ながく おして カスタードを そそごう', '🥛');
      ui.setFinger('hold');
      ui.setProgress(0);
    } else if (p === 'SCOOP') {
      pitcher.group.visible = false;
      custardStream.setFlow(0);
      ctx.camPhase([0.10, STAND_TOP + 0.24, 0.36], [0, STAND_TOP + 0.06, 0]);
      ui.setHint('あじを えらんでね', '🍨');
      trayFlavor.show();
    } else if (p === 'MERINGUE') {
      trayFlavor.hide();
      ctx.camPhase([0.14, custardTopY + 0.18, 0.36], [0, custardTopY + 0.03, 0]);
      ui.setHint('ながく おして もこもこ かぶせよう', '☁️');
      ui.setFinger('hold');
      ui.setProgress(0);
    } else if (p === 'SUGAR') {
      ctx.camPhase([0.12, custardTopY + 0.24, 0.34], [0, custardTopY + 0.14, 0]);
      ui.setHint('ながく おして さとうを かけよう', '✨');
      ui.setFinger('hold');
      ui.setProgress(0);
    } else if (p === 'TORCH') {
      torchTool.group.visible = true;
      torchTool.group.rotation.set(0.10, 0.5, -0.55);
      torchTool.group.position.set(0.15, custardTopY + 0.25, 0.15);
      torchSteam.group.visible = true;
      ctx.camPhase([0.20, custardTopY + 0.22, 0.30], [0, custardTopY + 0.16, 0]);
      ui.setHint('ゆびで なぞって あぶろう！', '🔥');
      ui.setFinger('circle');
      ui.setProgress(0);
    } else if (p === 'CRACK') {
      torchTool.group.visible = false;
      torchSteam.setStrength(0);
      torchSteam.group.visible = false;
      audio.setTorchSound?.(0);
      ctx.camPhase([0.14, custardTopY + 0.24, 0.30], [0, custardTopY + 0.14, 0]);
      ui.setHint('たっぷして わってみよう！', '👆');
      ui.setProgress(0);
      // TORCHでなぞっていた指がそのまま押しっぱなしで入ってくることがあるため、
      // 一度指が離れるまでは長押しアシストを起動しない（誤って一気に割れるのを防ぐ）
      crackArmed = !ctx.pointer.down;
      crackHoldTimer = 0;
    } else if (p === 'DONE') {
      ui.setHint('わあ！ できあがり！', '🎉');
      ui.setProgress(null);
      // 紙吹雪は落下が速いので一度きりだと撮影/観賞タイミングによっては
      // もう落ちきっている。DONE中はずっと軽く降らせ続けて見栄えを保つ
      if (!confettiShowerId) {
        confettiShowerId = setInterval(() => {
          const ox = (Math.random() - 0.5) * 0.08, oz = (Math.random() - 0.5) * 0.08;
          confetti.burst(new THREE.Vector3(ox, custardTopY + 0.12, oz), clockT);
        }, 550);
      }
    }
  }

  // -----------------------------------------------------------------------
  // トレイ: アイスの味
  // -----------------------------------------------------------------------
  const SCOOP_OFFSETS = [[-0.028, 0.010], [0.028, 0.010], [0.0, -0.010]];
  const SCOOP_LIFT = [0, 0, 0.016]; // 3個目は少し高く盛って前の2個の間から覗かせる
  function spawnScoop(flavor) {
    const scoop = createIceScoop(flavor);
    const idx = state.scoopCount;
    const off = SCOOP_OFFSETS[idx % SCOOP_OFFSETS.length];
    const landY = custardTopY + scoop.radius * 0.85 + SCOOP_LIFT[idx % SCOOP_LIFT.length];
    scoop.group.position.set(off[0], landY + 0.32, off[1]);
    scene.add(scoop.group);
    scoops.push(scoop);
    (audio.sfx.scoop ?? audio.sfx.plop)();
    tween({
      from: scoop.group.position.y, to: landY, duration: 0.55, easing: ease.outBounce,
      onUpdate: v => { scoop.group.position.y = v; },
      onComplete: () => {
        tween({
          from: 0, to: 1, duration: 0.4, easing: ease.outElastic,
          onUpdate: v => { scoop.group.scale.set(1 + (1 - v) * 0.22, 1 - (1 - v) * 0.3, 1 + (1 - v) * 0.22); },
        });
        audio.sfx.pop(0.9 + idx * 0.1);
        state.scoopCount++;
        ui.setProgress(state.scoopCount / 3);
        if (state.scoopCount >= 3) {
          setTimeout(() => enterPhase('MERINGUE'), 700);
        }
      },
    });
  }
  const trayFlavor = ui.makeTray('trayFlavor', [
    { key: 'vanilla', emoji: '🍦' },
    { key: 'berry', emoji: '🍓' },
    { key: 'melon', emoji: '🍈' },
  ], (key) => {
    if (state.phase !== 'SCOOP' || state.scoopCount >= 3) return;
    audio.sfx.tap();
    spawnScoop(key);
  });
  trayFlavor.hide();

  // -----------------------------------------------------------------------
  // 各フェーズの更新
  // -----------------------------------------------------------------------
  const _tmp = new THREE.Vector3();

  function updateCustard(dt, hdt) {
    if (state.custardLevel >= 1) return;
    const pouring = ctx.pointer.down;
    state.custardTilt = lerp(state.custardTilt || 0, pouring ? 1 : 0, 1 - Math.pow(0.002, hdt));
    const tilt = state.custardTilt;
    pitcher.group.rotation.z = -tilt * 1.15;
    pitcher.group.position.x = lerp(0.22, -0.06, tilt);
    pitcher.group.position.y = lerp(STAND_TOP + 0.34, STAND_TOP + 0.145, tilt);
    pitcher.group.position.z = lerp(0.06, 0.01, tilt);
    const flow = clamp((tilt - 0.5) / 0.35, 0, 1);
    if (flow > 0.02) {
      pitcher.group.updateMatrixWorld(true);
      const spout = _tmp.copy(pitcher.spoutLocal).applyMatrix4(pitcher.group.matrixWorld);
      const level = STAND_TOP + dish.wellFloorY + custard.getLevel() * custard.maxHeight;
      custardStream.set(spout, Math.max(level, STAND_TOP + dish.wellFloorY + 0.002));
      custardStream.setFlow(flow);
      state.custardLevel = clamp(state.custardLevel + hdt * flow / 3.0, 0, 1);
      custard.setLevel(state.custardLevel);
      custard.setPouring(true);
    } else {
      custardStream.setFlow(0);
      custard.setPouring(false);
    }
    audio.setPourSound(flow);
    ui.setProgress(state.custardLevel);
    if (state.custardLevel >= 1) {
      custardStream.setFlow(0);
      audio.setPourSound(0);
      ui.setFinger(null);
      audio.sfx.chime(0);
      ui.showBanner('とろ〜り はいったよ！');
      tween({
        from: 1, to: 0, duration: 0.8, easing: ease.inOutCubic,
        onUpdate: v => {
          pitcher.group.position.set(lerp(-0.06, 0.5, 1 - v), lerp(STAND_TOP + 0.145, STAND_TOP + 0.5, 1 - v), lerp(0.01, 0.2, 1 - v));
          pitcher.group.rotation.z = -1.15 * v;
        },
        onComplete: () => { setTimeout(() => enterPhase('SCOOP'), 250); },
      });
    }
  }

  function updateMeringue(dt, hdt) {
    if (state.meringueProgress >= 1) return;
    if (ctx.pointer.down) {
      state.meringueProgress = clamp(state.meringueProgress + hdt / 3.2, 0, 1);
      meringue.setGrowth(ease.outBack(state.meringueProgress));
      if (Math.random() < dt * 10) audio.sfx.pop(0.6 + Math.random() * 0.3);
    }
    ui.setProgress(state.meringueProgress);
    if (state.meringueProgress >= 1) {
      meringue.setGrowth(1);
      ui.setFinger(null);
      audio.sfx.sparkle();
      ui.showBanner('もこもこ かぶさったよ！');
      setTimeout(() => enterPhase('SUGAR'), 900);
    }
  }

  function updateSugar(dt, hdt) {
    if (state.sugarProgress >= 1) return;
    const active = ctx.pointer.down;
    sugarFall.setActive(active);
    if (active) {
      state.sugarProgress = clamp(state.sugarProgress + hdt / 3.0, 0, 1);
      sugarGlints.setCoverage(state.sugarProgress);
    }
    ui.setProgress(state.sugarProgress);
    if (state.sugarProgress >= 1) {
      sugarFall.setActive(false);
      ui.setFinger(null);
      audio.sfx.sparkle();
      ui.showBanner('キラキラ つもったね！');
      setTimeout(() => enterPhase('TORCH'), 900);
    }
  }

  const _normal = new THREE.Vector3();
  const _tipOffset = new THREE.Vector3();
  const _targetPos = new THREE.Vector3();
  function updateTorch(dt, hdt, t) {
    if (state.torchProgress >= 1) return;
    const down = ctx.pointer.down;
    const dragSpeed = (down && lastPX !== null) ? Math.hypot(ctx.pointer.x - lastPX, ctx.pointer.y - lastPY) / Math.max(dt, 1 / 240) : 0;
    lastPX = ctx.pointer.x; lastPY = ctx.pointer.y;

    if (down) {
      // ねらった場所（レイキャスト）が当たればそこ、外れたら自動でゆっくり移動する場所を焼く
      // ※ロームの速さはhdt基準（進捗と同じ時間軸）にし、低fps環境でも
      //   torchProgressが先に満タンになって塗り残しが出ないようにする
      let u, v, point;
      const hits = ctx.raycastMeshes([meringue.mesh]);
      if (hits.length > 0 && hits[0].uv) {
        u = hits[0].uv.x; v = hits[0].uv.y; point = hits[0].point;
      } else {
        torchRoamT += hdt * 0.6;
        u = (Math.sin(torchRoamT * 0.9) * 0.5 + 0.5 + 0.13) % 1;
        v = 0.18 + (Math.sin(torchRoamT * 0.53 + 1.7) * 0.5 + 0.5) * 0.72;
        point = meringue.worldPointAt(u, v);
      }
      meringue.paintScorch(u, v, clamp(hdt * 9, 0, 1), true);

      // 狙い所とは別に、ドーム全体をゆっくり巡回して余熱でうっすら焼く
      // （指を動かさず長押しだけでも最終的に全体がこんがりするように）
      ambientRoamT += hdt * 0.55;
      const au = (Math.sin(ambientRoamT * 0.71) * 0.5 + 0.5 + 0.37) % 1;
      const av = 0.10 + (Math.sin(ambientRoamT * 0.41 + 2.3) * 0.5 + 0.5) * 0.86;
      meringue.paintScorch(au, av, clamp(hdt * 3.4, 0, 1), true);

      // ドーム全体にじんわり余熱を回す（谷はクリーム色止まり・峰は濃い琥珀+焦げに）。
      // これがないと指でなぞった筋だけが焼けて「白地に筋」のままになってしまう
      meringue.soakHeat(hdt, true);
      meringue.requestRedraw();

      state.torchProgress = clamp(state.torchProgress + hdt / 6.5, 0, 1);

      _normal.copy(meringue.normalAt(u, v)).transformDirection(meringue.mesh.matrixWorld);
      _tipOffset.copy(torchTool.tipLocalOffset).applyEuler(torchTool.group.rotation);
      _targetPos.copy(point).addScaledVector(_normal, 0.03).sub(_tipOffset);
      torchTool.group.position.lerp(_targetPos, 1 - Math.pow(0.0015, dt));

      torchSteam.group.position.copy(point);
      torchSteam.setStrength(0.6);

      const intensity = clamp(0.4 + dragSpeed / 1200, 0, 1);
      audio.setTorchSound?.(intensity);
      if (Math.random() < dt * 6) audio.sfx.puff?.();
    } else {
      torchSteam.setStrength(0);
      audio.setTorchSound?.(0);
    }

    glassShell.setCoverage(state.torchProgress);
    ui.setProgress(state.torchProgress);
    if (state.torchProgress >= 1) {
      ui.setFinger(null);
      torchTool.group.visible = false;
      torchSteam.setStrength(0);
      audio.setTorchSound?.(0);
      audio.sfx.ding?.();
      ui.showBanner('こんがり やけたね！');
      setTimeout(() => enterPhase('CRACK'), 900);
    }
  }

  function handleCrackTap() {
    state.crackStage = clamp(state.crackStage + 1, 0, 3);
    crackOverlay.setStage(state.crackStage);
    audio.sfx.crack?.(state.crackStage);
    ui.setProgress(state.crackStage / 3);
    if (state.crackStage < 3) {
      ui.showBanner(state.crackStage === 1 ? 'ピキッ！' : 'ピシピシッ！');
    } else {
      shatterAndReveal();
    }
  }

  function shatterAndReveal() {
    ui.setHint('', '');
    const apex = new THREE.Vector3(0, apexY, 0);
    // 破片は器のすぐ外〜皿の上に、実時間だけを基準に確実に着地するアニメーション
    shards.burst(apex, STAND_TOP + 0.001, clockT);
    glassShell.group.visible = false;
    crackOverlay.mesh.visible = false;
    // メレンゲドームはくさび状に割れて外側へ倒れ開く（丸ごと消えない。
    // 下側は器の縁に残ったまま上だけ開く見た目になる）
    meringue.group.visible = false;
    meringueWedges.open(clockT);
    // 冷気ミストは強く立ち上らせた後、DONE中もずっと軽く漂わせ続ける
    coldMist.setStrength(1);
    setTimeout(() => coldMist.setStrength(0.4), 2400);
    const sparkY = custardTopY + 0.10;
    sparkler.group.position.set(0, sparkY, 0);
    sparkler.ignite(clockT);
    audio.sfx.whoosh();
    confetti.burst(new THREE.Vector3(0, custardTopY + 0.14, 0), clockT);
    setTimeout(() => {
      confetti.burst(new THREE.Vector3(0.03, custardTopY + 0.12, -0.02), clockT);
      audio.sfx.fanfare();
      ui.showBanner('パリン！ できあがり！');
      setTimeout(() => {
        enterPhase('DONE');
        ctx.finish();
      }, 900);
    }, 300);
  }

  // -----------------------------------------------------------------------
  // ライフサイクル
  // -----------------------------------------------------------------------
  let clockT = 0;
  let doneTime = 0;

  return {
    start() {
      ctx.stand.group.visible = true;
      enterPhase('CUSTARD');
    },
    update(dt, hdt, t) {
      clockT = t;

      switch (state.phase) {
        case 'CUSTARD': updateCustard(dt, hdt); break;
        case 'MERINGUE': updateMeringue(dt, hdt); break;
        case 'SUGAR': updateSugar(dt, hdt); break;
        case 'TORCH': updateTorch(dt, hdt, t); break;
        case 'CRACK':
          // タップ自体は上のpointerdownリスナーで即応済み。ここは長押しでも確実に
          // 進める無操作アシストのみ担当（フレームサンプリングでの検知漏れを避ける）。
          // ただしTORCHでなぞっていた指がそのまま押しっぱなしで来た場合は、一度
          // 離れるまでアシストを起動しない（でないと一瞬で3段階割れてしまう）。
          if (!crackArmed) {
            if (!ctx.pointer.down) crackArmed = true;
          } else if (ctx.pointer.down && state.crackStage < 3) {
            crackHoldTimer += hdt;
            if (crackHoldTimer > 0.65) { handleCrackTap(); crackHoldTimer = 0; }
          } else if (!ctx.pointer.down) {
            crackHoldTimer = 0;
          }
          break;
        case 'DONE':
          doneTime += dt;
          {
            const a = doneTime * 0.3;
            const r = 0.46, cy = custardTopY * 0.5 + STAND_TOP * 0.5;
            ctx.camPhase([Math.sin(a) * r, cy + 0.30, Math.cos(a) * r], [0, cy, 0]);
          }
          break;
      }

      // 各オブジェクトの時間更新
      custard.update(dt, t);
      custardStream.update(dt, t);
      sugarGlints.update(dt, t);
      sugarFall.update(dt, t);
      if (torchTool.group.visible) torchTool.flame.update(dt, t);
      torchSteam.update(dt, t);
      coldMist.update(dt, t);
      shards.update(t);
      meringueWedges.update(t);
      sparkler.update(dt, t);
      confetti.update(dt, t);
    },
  };
}
