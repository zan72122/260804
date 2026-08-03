// src/game/flow.ts
// 所有: A5 (flow) — ゲーム進行の脳。
//
// GamePhase の11段階(+タイトル)を管理し、各フェーズで
//   input.setHotspots(...) / layout.setCameraTarget(...) /
//   bus.emit('sfx' | 'loopStart' | 'loopStop' | 'hint' | 'celebrate') / effects.burst
// を統括する。詳細仕様は docs/CONTRACT.md の「ゲームフロー詳細」章。
//
// 設計方針:
// - カメラは「現在の state から純粋に導出する」関数 computeCameraTarget() に一本化。
//   毎フレーム再計算して layout.setCameraTarget() に渡すので、
//   layoutChanged()(画面回転)は同じ関数を呼ぶだけで進行状態を一切失わない。
// - ホットスポットも「現在の state から純粋に導出する」関数 computeHotspots() に一本化。
//   フェーズ遷移時、および 'activated'/'released' イベント後に input.setHotspots() へ反映する
//   (連続的な 'progress'/'dragMove' の最中には差し替えない = ドラッグ中の入力を壊さない)。
// - フェーズそのものの遷移は setPhase(state, next) で行い、bus 'phase' を購読して
//   enterPhase() が毎回のフェーズ入場時セットアップ(view/loop音/初期hotspot)を行う。

import type { FaultKind, GamePhase, GameState, Hotspot, HotspotEvent } from '../core/types';
import { setPhase } from '../core/state';
import { bus } from '../core/events';
import { layout } from '../core/layout';
import { input } from '../input/gestures';
import { effects } from '../render/effects';
import { createFault, FAULT_KINDS } from '../sim/faults';
import { COORDS, stepGapT, stepParkedFor } from './coords';
import { WORLD } from '../render/scene';

// ---------------------------------------------------------------------------
// モジュール内トランジェント状態(GameState には持たない演出専用の一時変数。
// ページのリロードなしでは失われないため、画面回転をまたいでも問題ない)
// ---------------------------------------------------------------------------
let plateAnim: 'opening' | 'closing' | null = null;
let stepAnim: 'removing' | 'restoring' | null = null;
let nextHintAt = COORDS.hintFirstDelay;
let celebrateEnterTime = 0;
let gurunAccum = 0;
let lastFaultKind: FaultKind | null = null;
let started = false;

// ---------------------------------------------------------------------------
// 小さな幾何/カメラユーティリティ
// ---------------------------------------------------------------------------
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

interface Cam { cx: number; cy: number; scale: number; }

function framePoints(pts: { x: number; y: number }[], padX: number, padY: number): Cam {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) {
    minX = maxX = 0;
    minY = maxY = 0;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const bw = Math.max(maxX - minX, 10) + padX * 2;
  const bh = Math.max(maxY - minY, 10) + padY * 2;
  const w = layout.w || 1;
  const h = layout.h || 1;
  let scale = Math.min(w / bw, h / bh);
  if (!isFinite(scale) || scale <= 0) scale = 1;
  scale = Math.max(COORDS.cameraScaleMin, Math.min(scale, COORDS.cameraScaleMax));
  return { cx, cy, scale };
}

function lerpCam(a: Cam, b: Cam, t: number): Cam {
  const k = Math.max(0, Math.min(1, t));
  return {
    cx: a.cx + (b.cx - a.cx) * k,
    cy: a.cy + (b.cy - a.cy) * k,
    scale: a.scale + (b.scale - a.scale) * k
  };
}

function loopSamplePoints(state: GameState): { x: number; y: number }[] {
  const model = state.escalator;
  const pts: { x: number; y: number }[] = [];
  const N = 16;
  for (let i = 0; i < N; i++) pts.push(model.pathPoint(i / N));
  return pts;
}

// view==='exterior' の間、scene.ts が実際に描くのは輪全体ではなく
// 「乗り口(A0)〜降り口(A1)+点検床板」の帯だけ(裏側のreturn/turnaroundは見えない)。
// カメラ枠をループ全体(loopSamplePoints)で組むと、外観では絶対に映らない
// 裏側の分まで余白として抱えてしまい、縦画面で対象がひどく小さくなる
// (統括レビュー: 「縦画面exteriorのカメラが引きすぎ」)。ここでは外観で実際に
// 見える範囲だけを額装する専用の点集合を使う。
function exteriorFramePoints(state: GameState): { x: number; y: number }[] {
  const plateRight = { x: WORLD.plateCenter.x + WORLD.plateSize.w / 2 + 12, y: WORLD.plateCenter.y };
  const pts = [WORLD.bottomBoard, WORLD.topBoard, plateRight];
  if (state.phase === 'notice') pts.push(COORDS.noticeAlert);
  return pts;
}

function wideExterior(state: GameState): Cam {
  const portrait = layout.portrait;
  const pad = portrait ? COORDS.cameraPad.exteriorPortrait : COORDS.cameraPad.exteriorLandscape;
  return framePoints(exteriorFramePoints(state), pad.x, pad.y);
}

function nextSafetyTarget(state: GameState): { x: number; y: number } {
  if (!state.fencePlaced) return COORDS.fenceDrop;
  if (!state.stopped) return COORDS.stopSwitch;
  return COORDS.lockIcon;
}

// 「今、ステップの隙間があるワールド座標」(dropR固定・中心はcoords.stepGapTで追跡)。
// crankCheckで回した後もズレないよう、restoreStep関連のホットスポット/カメラ/
// 持ち手ステップの表示すべてがこれを参照する(A7統合修正)。
function stepGapSpot(state: GameState): { x: number; y: number; r: number } {
  const p = state.escalator.pathPoint(stepGapT(state.escalator));
  return { x: p.x, y: p.y, r: COORDS.stepGapDrop.r };
}

function chosenStepIndex(state: GameState): number {
  const model = state.escalator;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < model.stepCount; i++) {
    const t = model.stepT(i);
    let d = Math.abs(t - COORDS.stepPullT);
    d = Math.min(d, 1 - d);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function pickAnchorT(): number {
  const useReturn = Math.random() < 0.5;
  const range = useReturn ? COORDS.faultAnchorRanges.return : COORDS.faultAnchorRanges.incline;
  return range.lo + Math.random() * (range.hi - range.lo);
}

function panFor(worldX: number): number {
  // ワールドx(だいたい 0..600)を -1..1 のステレオpanに雑にマップ
  const p = (worldX - 260) / 300;
  return Math.max(-1, Math.min(1, p));
}

// ---------------------------------------------------------------------------
// カメラ: 現在の state から純粋に導出する(縦=対象に寄る、横=断面全景)
// ---------------------------------------------------------------------------
function computeCameraTarget(state: GameState): Cam {
  const portrait = layout.portrait;
  const tightPad = portrait ? COORDS.cameraPad.tightPortrait : COORDS.cameraPad.tightLandscape;
  const widePad = portrait ? COORDS.cameraPad.widePortrait : COORDS.cameraPad.wideLandscape;

  const tight = (pts: { x: number; y: number }[]) => framePoints(pts, tightPad.x, tightPad.y);
  const wideLoop = () => framePoints(loopSamplePoints(state), widePad.x, widePad.y);

  const model = state.escalator;

  switch (state.phase) {
    case 'title':
    case 'notice':
      return wideExterior(state);

    case 'safety':
      return portrait
        ? tight([nextSafetyTarget(state)])
        : tight([COORDS.fenceParked, COORDS.fenceDrop, COORDS.stopSwitch, COORDS.lockIcon]);

    case 'openPlate': {
      const closed = tight([COORDS.plateHandle]);
      const open = wideLoop();
      return lerpCam(closed, open, state.plateOpen);
    }

    case 'removeStep': {
      const stepPos = model.pathPoint(stepGapT(model));
      if (state.stepRemoved >= 1 && state.mode === 'stepPlay') {
        // stepPlay: 抜いたステップを隙間へドラッグで戻す瞬間は、置き場と隙間の両方が
        // 画面に入っていないと縦画面で「どこに戻せばいいか」見えなくなる。
        return tight([stepParkedFor(model), stepPos]);
      }
      const target = state.handleAttached ? stepPos : COORDS.stepHandleSpot;
      return tight(portrait ? [target] : [COORDS.stepHandleSpot, stepPos]);
    }

    case 'inspect': {
      const p = state.fault ? model.pathPoint(state.fault.anchorT) : model.pathPoint(0.5);
      return portrait ? tight([p]) : framePoints([...loopSamplePoints(state), p], widePad.x, widePad.y);
    }

    case 'repair': {
      // ドラッグ系(roller/chainGuide)は掴む場所とドロップ先の両方を画面に入れる
      // (縦画面で片方しか見えないと「どこへ持っていけばいいか」誤操作になる)。
      const hs: { x: number; y: number }[] = [];
      if (state.fault) {
        for (const h of state.fault.hotspots(state)) {
          hs.push({ x: h.x, y: h.y });
          if (h.dropX !== undefined && h.dropY !== undefined) hs.push({ x: h.dropX, y: h.dropY });
        }
      } else {
        hs.push(model.pathPoint(0.5));
      }
      if (state.fault && state.fault.kind === 'roller' && !portrait) hs.push(COORDS.toolbox);
      if (hs.length === 0) hs.push(model.pathPoint(state.fault ? state.fault.anchorT : 0.5));
      return tight(hs);
    }

    case 'crankCheck':
      return tight([COORDS.crankWheel]);

    case 'restoreStep': {
      // ドラッグの持ち手(置き場)とドロップ先(隙間)の両方を常に画面に入れる
      // (縦画面でも一方だけズームすると、置き場が見えず「戻せない」誤操作になる)。
      const stepPos = model.pathPoint(stepGapT(model));
      return tight([stepParkedFor(model), stepPos]);
    }

    case 'closePlate': {
      const open = wideLoop();
      const closed = tight([COORDS.plateHandle]);
      return lerpCam(open, closed, 1 - state.plateOpen);
    }

    case 'testRun':
    case 'celebrate':
    case 'select':
      return wideExterior(state);

    default:
      return wideLoop();
  }
}

// ---------------------------------------------------------------------------
// ホットスポット: 現在の state から純粋に導出する
// ---------------------------------------------------------------------------
function computeHotspots(state: GameState): Hotspot[] {
  switch (state.phase) {
    case 'title':
      return [];

    case 'notice':
      return [
        { id: 'notice:alert', kind: 'tap', x: COORDS.noticeAlert.x, y: COORDS.noticeAlert.y, r: COORDS.noticeAlert.r }
      ];

    case 'safety': {
      if (!state.fencePlaced) {
        return [
          {
            id: 'fence',
            kind: 'drag',
            x: COORDS.fenceParked.x,
            y: COORDS.fenceParked.y,
            r: 90,
            dropX: COORDS.fenceDrop.x,
            dropY: COORDS.fenceDrop.y,
            dropR: COORDS.fenceDrop.r,
            sticky: true
          }
        ];
      }
      if (!state.stopped) {
        return [{ id: 'stopSwitch', kind: 'tap', x: COORDS.stopSwitch.x, y: COORDS.stopSwitch.y, r: COORDS.stopSwitch.r }];
      }
      if (!state.locked) {
        return [{ id: 'lock', kind: 'tap', x: COORDS.lockIcon.x, y: COORDS.lockIcon.y, r: COORDS.lockIcon.r }];
      }
      return [];
    }

    case 'openPlate':
      return [
        {
          id: 'plateHandleOpen',
          kind: 'swipe',
          dir: 'up',
          x: COORDS.plateHandle.x,
          y: COORDS.plateHandle.y,
          r: COORDS.plateHandle.r
        }
      ];

    case 'removeStep': {
      if (!state.handleAttached) {
        return [
          { id: 'stepHandle', kind: 'tap', x: COORDS.stepHandleSpot.x, y: COORDS.stepHandleSpot.y, r: COORDS.stepHandleSpot.r }
        ];
      }
      if (state.stepRemoved < 1 && stepAnim !== 'removing') {
        const p = state.escalator.pathPoint(stepGapT(state.escalator));
        return [{ id: 'stepPull', kind: 'swipe', dir: 'up', x: p.x, y: p.y, r: 90 }];
      }
      if (state.stepRemoved >= 1 && state.mode === 'stepPlay') {
        const gap = stepGapSpot(state);
        const parked = stepParkedFor(state.escalator);
        return [
          {
            id: 'stepReturn',
            kind: 'drag',
            x: parked.x,
            y: parked.y,
            r: 90,
            dropX: gap.x,
            dropY: gap.y,
            dropR: gap.r,
            sticky: true
          }
        ];
      }
      return [];
    }

    case 'inspect': {
      if (!state.fault) return [];
      const p = state.escalator.pathPoint(state.fault.anchorT);
      return [{ id: 'fault:found', kind: 'tap', x: p.x, y: p.y, r: 100 }];
    }

    case 'repair':
      return state.fault ? state.fault.hotspots(state) : [];

    case 'crankCheck':
      return [{ id: 'crank', kind: 'crank', x: COORDS.crankWheel.x, y: COORDS.crankWheel.y, r: COORDS.crankWheel.r }];

    case 'restoreStep': {
      const gap = stepGapSpot(state);
      const parked = stepParkedFor(state.escalator);
      return [
        {
          id: 'stepReturn',
          kind: 'drag',
          x: parked.x,
          y: parked.y,
          r: 90,
          dropX: gap.x,
          dropY: gap.y,
          dropR: gap.r,
          sticky: true
        }
      ];
    }

    case 'closePlate':
      return [
        {
          id: 'plateHandleClose',
          kind: 'swipe',
          dir: 'down',
          x: COORDS.plateHandle.x,
          y: COORDS.plateHandle.y,
          r: COORDS.plateHandle.r
        }
      ];

    case 'testRun':
    case 'celebrate':
    case 'select':
    default:
      return [];
  }
}

function syncHotspots(state: GameState): void {
  input.setHotspots(computeHotspots(state));
}

// ---------------------------------------------------------------------------
// ヒント: 4秒で初回、以後8秒毎。文字は絶対に出さない(x,yのみ)。
// ---------------------------------------------------------------------------
function primaryHintTarget(state: GameState): { x: number; y: number } | null {
  const model = state.escalator;
  switch (state.phase) {
    case 'notice':
      return COORDS.noticeAlert;
    case 'safety':
      return nextSafetyTarget(state);
    case 'openPlate':
      return COORDS.plateHandle;
    case 'removeStep':
      return state.handleAttached ? model.pathPoint(stepGapT(model)) : COORDS.stepHandleSpot;
    case 'inspect':
      return state.fault ? model.pathPoint(state.fault.anchorT) : null;
    case 'repair': {
      const hs = state.fault ? state.fault.hotspots(state) : [];
      return hs.length > 0 ? { x: hs[0].x, y: hs[0].y } : null;
    }
    case 'crankCheck':
      return state.mode === 'play' ? COORDS.crankWheel : null;
    case 'restoreStep':
      return stepGapSpot(state);
    case 'closePlate':
      return COORDS.plateHandle;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 新しい故障で1周開始(replay/next/初回)
// ---------------------------------------------------------------------------
function startNewFault(state: GameState, location: 0 | 1 | 2): void {
  // 前回のループ音を確実に止める
  if (state.fault) bus.emit('loopStop', { name: state.fault.anomalyLoop });
  bus.emit('loopStop', { name: 'runBroken' });
  bus.emit('loopStop', { name: 'runSlow' });
  bus.emit('loopStop', { name: 'runNormal' });

  state.location = location;
  state.mode = 'play';
  state.view = 'exterior';
  state.fencePlaced = false;
  state.stopped = false;
  state.locked = false;
  state.plateOpen = 0;
  state.handleAttached = false;
  state.stepRemoved = 0;
  state.crankTotal = 0;
  state.testRunStage = 0;
  state.escalator.removedStep = null;
  plateAnim = null;
  stepAnim = null;

  let kind = FAULT_KINDS[Math.floor(Math.random() * FAULT_KINDS.length)];
  if (FAULT_KINDS.length > 1) {
    let guard = 0;
    while (kind === lastFaultKind && guard < 6) {
      kind = FAULT_KINDS[Math.floor(Math.random() * FAULT_KINDS.length)];
      guard++;
    }
  }
  lastFaultKind = kind;

  const fault = createFault(kind, state.escalator);
  fault.anchorT = pickAnchorT();
  state.fault = fault;

  state.escalator.speed = COORDS.noticeSpeed;
  state.escalator.targetSpeed = COORDS.noticeSpeed;

  setPhase(state, 'notice');
}

function enterFreeObserve(state: GameState): void {
  state.mode = 'freeObserve';
  state.view = 'inside';
  state.escalator.targetSpeed = 0;
  setPhase(state, 'crankCheck');
}

function enterStepPlay(state: GameState): void {
  state.mode = 'stepPlay';
  state.view = 'cutaway';
  state.plateOpen = 1;
  state.handleAttached = true;
  state.stepRemoved = 0;
  state.escalator.removedStep = null;
  state.escalator.targetSpeed = 0;
  plateAnim = null;
  stepAnim = null;
  setPhase(state, 'removeStep');
}

function backToSelect(state: GameState): void {
  state.mode = 'play';
  state.view = 'exterior';
  state.escalator.targetSpeed = 0;
  setPhase(state, 'select');
}

// ---------------------------------------------------------------------------
// フェーズ入場処理(bus 'phase' 購読)
// ---------------------------------------------------------------------------
function enterPhase(state: GameState, phase: GamePhase): void {
  switch (phase) {
    case 'title':
      state.view = 'exterior';
      state.mode = 'play';
      break;

    case 'notice': {
      state.view = 'exterior';
      if (state.fault) {
        const p = state.escalator.pathPoint(state.fault.anchorT);
        bus.emit('loopStart', { name: state.fault.anomalyLoop, pan: panFor(p.x) });
      }
      bus.emit('loopStart', { name: 'runBroken', intensity: 0.5 });
      break;
    }

    case 'safety':
      break;

    case 'openPlate':
      state.view = 'exterior';
      break;

    case 'removeStep':
      break;

    case 'inspect':
      state.view = 'inside';
      break;

    case 'repair':
      break;

    case 'crankCheck':
      break;

    case 'restoreStep':
      state.view = 'cutaway';
      break;

    case 'closePlate':
      break;

    case 'testRun':
      state.view = 'exterior';
      state.testRunStage = 0;
      state.escalator.targetSpeed = 0;
      bus.emit('loopStop', { name: 'runSlow' });
      bus.emit('loopStop', { name: 'runNormal' });
      break;

    case 'celebrate':
      // 紙吹雪は effects.ts が bus 'celebrate' を自己購読して発火する(A6所有)。
      // ここで直接 effects.burst() を呼ぶと二重発火するので emit のみ行う。
      celebrateEnterTime = state.time;
      bus.emit('sfx', { name: 'tada' });
      bus.emit('sfx', { name: 'fanfare' });
      bus.emit('celebrate', {});
      break;

    case 'select':
      bus.emit('loopStop', { name: 'runNormal' });
      break;
  }

  syncHotspots(state);
}

// ---------------------------------------------------------------------------
// HUDボタン(ui:*)
// ---------------------------------------------------------------------------
function handleUi(ev: HotspotEvent, state: GameState): void {
  switch (ev.id) {
    case 'ui:start':
      if (state.phase === 'title') startNewFault(state, state.location);
      break;

    case 'ui:replay':
      if (state.phase === 'select') startNewFault(state, state.location);
      break;

    case 'ui:next':
      if (state.phase === 'select') startNewFault(state, ((state.location + 1) % 3) as 0 | 1 | 2);
      break;

    case 'ui:observe':
      if (state.phase === 'select') enterFreeObserve(state);
      break;

    case 'ui:stepPlay':
      if (state.phase === 'select') enterStepPlay(state);
      break;

    case 'ui:back':
      if (state.mode !== 'play') backToSelect(state);
      break;

    case 'ui:slow':
      if (state.phase === 'testRun' && state.testRunStage === 0) {
        state.testRunStage = 1;
        state.escalator.targetSpeed = COORDS.slowSpeed;
        bus.emit('loopStart', { name: 'runSlow' });
        bus.emit('sfx', { name: 'suu' });
      }
      break;

    case 'ui:fast':
      if (state.phase === 'testRun') {
        if (state.testRunStage === 1) {
          state.testRunStage = 2;
          state.escalator.targetSpeed = COORDS.normalSpeed;
          bus.emit('loopStop', { name: 'runSlow' });
          bus.emit('loopStart', { name: 'runNormal' });
          setPhase(state, 'celebrate');
        } else if (state.testRunStage === 0) {
          // 先に🐇を押した場合も動かして見せるが、お祝いへは🐢を経てから
          state.escalator.targetSpeed = COORDS.normalSpeed;
          bus.emit('sfx', { name: 'suu' });
        }
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// 各フェーズのホットスポットハンドラ
// ---------------------------------------------------------------------------
function handleNotice(ev: HotspotEvent, state: GameState): void {
  if (ev.id === 'notice:alert' && ev.type === 'activated') {
    bus.emit('sfx', { name: 'click' });
    setPhase(state, 'safety');
  }
}

function handleSafety(ev: HotspotEvent, state: GameState): void {
  // drag成功: input(A3)はdropから150px以内で 'activated' をdrop座標にスナップして発火する
  // (magnet sfxもA3側で発火済みなのでここでは重複させない)。'released' は失敗(磁石範囲外)なので無視。
  if (ev.id === 'fence' && ev.type === 'activated') {
    state.fencePlaced = true;
    return;
  }
  if (ev.id === 'stopSwitch' && ev.type === 'activated') {
    state.stopped = true;
    state.escalator.targetSpeed = 0;
    bus.emit('sfx', { name: 'pita' });
    if (state.fault) bus.emit('loopStop', { name: state.fault.anomalyLoop });
    bus.emit('loopStop', { name: 'runBroken' });
    return;
  }
  if (ev.id === 'lock' && ev.type === 'activated') {
    state.locked = true;
    bus.emit('sfx', { name: 'click' });
    setPhase(state, 'openPlate');
  }
}

function handleOpenPlate(ev: HotspotEvent, state: GameState): void {
  if (ev.id === 'plateHandleOpen' && ev.type === 'activated' && plateAnim === null) {
    plateAnim = 'opening';
    // view はまだ 'exterior' のまま(=drawInspectionPlateの暖色グロー演出込みで蓋が開く
    // 「パカッ」の瞬間を見せる)。輪全体を見せる cutaway への切り替えは
    // updatePlateAnim が plateOpen の進行に応じて行う(A7統合修正)。
    bus.emit('sfx', { name: 'paka' });
    effects.burst(COORDS.plateHandle.x, COORDS.plateHandle.y, 'shine');
    input.setHotspots([]);
  }
}

function handleRemoveStep(ev: HotspotEvent, state: GameState): void {
  if (ev.id === 'stepHandle' && ev.type === 'activated') {
    state.handleAttached = true;
    bus.emit('sfx', { name: 'click' });
    return;
  }
  if (ev.id === 'stepPull' && ev.type === 'activated' && state.handleAttached && state.stepRemoved < 1 && stepAnim === null) {
    stepAnim = 'removing';
    bus.emit('sfx', { name: 'spon' });
    const p = state.escalator.pathPoint(COORDS.stepPullT);
    effects.burst(p.x, p.y, 'dust');
    input.setHotspots([]);
    return;
  }
  if (ev.id === 'stepReturn' && ev.type === 'activated' && stepAnim === null) {
    stepAnim = 'restoring';
    bus.emit('sfx', { name: 'kachi' });
    input.setHotspots([]);
  }
}

function handleInspect(ev: HotspotEvent, state: GameState): void {
  if (ev.id === 'fault:found' && ev.type === 'activated') {
    bus.emit('sfx', { name: 'click' });
    setPhase(state, 'repair');
  }
}

function handleRepair(ev: HotspotEvent, state: GameState): void {
  if (!state.fault) return;
  state.fault.onHotspot(ev, state);
  if (state.fault.fixed) {
    bus.emit('sfx', { name: 'sparkle' });
    bus.emit('sfx', { name: 'tada' });
    setPhase(state, 'crankCheck');
  }
}

function handleCrankCheck(ev: HotspotEvent, state: GameState): void {
  if (ev.id !== 'crank') return;
  const delta = ev.delta ?? 0;
  state.escalator.crank(delta);
  if (state.mode === 'play') {
    state.crankTotal += Math.abs(delta);
  }
  gurunAccum += Math.abs(delta);
  if (gurunAccum > 0.45) {
    gurunAccum = 0;
    bus.emit('sfx', { name: 'gurun' });
  }
  if (state.mode === 'play' && state.crankTotal >= Math.PI * 2) {
    bus.emit('sfx', { name: 'sparkle' });
    bus.emit('sfx', { name: 'tada' });
    // 手を離した後もクランクの慣性(crankSpeed)がloopTを回し続けるため、そのまま
    // restoreStepへ進むと「隙間の位置」が抜けた瞬間のホットスポット計算値から
    // ズレ続けてしまう(A7統合修正)。crank(0)で慣性を明示的に0にし、隙間の
    // 位置を今この瞬間で確定させる。EscalatorModel には他に慣性を止める公開APIが
    // 無いため、delta=0 の crank() 呼び出し(dLoopT=0 → crankSpeed=0)を流用する。
    state.escalator.crank(0);
    setPhase(state, 'restoreStep');
  }
}

function handleRestoreStep(ev: HotspotEvent, state: GameState): void {
  if (ev.id === 'stepReturn' && ev.type === 'activated' && stepAnim === null) {
    stepAnim = 'restoring';
    bus.emit('sfx', { name: 'kachi' });
    input.setHotspots([]);
  }
}

function handleClosePlate(ev: HotspotEvent, state: GameState): void {
  if (ev.id === 'plateHandleClose' && ev.type === 'activated' && plateAnim === null) {
    plateAnim = 'closing';
    bus.emit('sfx', { name: 'paka' });
    input.setHotspots([]);
  }
}

// ---------------------------------------------------------------------------
// ホットスポットイベントの中央ディスパッチ
// ---------------------------------------------------------------------------
function onHotspotEvent(ev: HotspotEvent, state: GameState): void {
  state.idleSeconds = 0;
  nextHintAt = COORDS.hintFirstDelay;
  effects.clearGlow();

  if (ev.id.startsWith('ui:')) {
    handleUi(ev, state);
    if (ev.type === 'activated') syncHotspots(state);
    return;
  }

  switch (state.phase) {
    case 'notice':
      handleNotice(ev, state);
      break;
    case 'safety':
      handleSafety(ev, state);
      break;
    case 'openPlate':
      handleOpenPlate(ev, state);
      break;
    case 'removeStep':
      handleRemoveStep(ev, state);
      break;
    case 'inspect':
      handleInspect(ev, state);
      break;
    case 'repair':
      handleRepair(ev, state);
      break;
    case 'crankCheck':
      handleCrankCheck(ev, state);
      break;
    case 'restoreStep':
      handleRestoreStep(ev, state);
      break;
    case 'closePlate':
      handleClosePlate(ev, state);
      break;
    default:
      break;
  }

  if (ev.type === 'activated' || ev.type === 'released') {
    syncHotspots(state);
  }
}

// ---------------------------------------------------------------------------
// 毎フレーム update: アニメーションタイマー、idle/ヒント、カメラ再計算
// ---------------------------------------------------------------------------
// 蓋が開き切る前(暖色グローが見えている exterior 表示)から、輪全体が見える
// cutaway 表示へ切り替えるしきい値。「パカッ→中から光+輪」の順で見せるための
// ビート分割(A7統合修正、品質基準: 開けた瞬間に秘密の場所が見えること)。
const PLATE_VIEW_SWITCH_T = 0.4;

function updatePlateAnim(dt: number, state: GameState): void {
  if (plateAnim === 'opening') {
    state.plateOpen = Math.min(1, state.plateOpen + dt * COORDS.plateAnimSpeed);
    if (state.view === 'exterior' && state.plateOpen >= PLATE_VIEW_SWITCH_T) {
      state.view = 'cutaway';
    }
    if (state.plateOpen >= 1) {
      plateAnim = null;
      setPhase(state, 'removeStep');
    }
  } else if (plateAnim === 'closing') {
    state.plateOpen = Math.max(0, state.plateOpen - dt * COORDS.plateAnimSpeed);
    if (state.view === 'cutaway' && state.plateOpen <= PLATE_VIEW_SWITCH_T) {
      state.view = 'exterior';
    }
    if (state.plateOpen <= 0) {
      plateAnim = null;
      state.view = 'exterior';
      setPhase(state, 'testRun');
    }
  }
}

function updateStepAnim(dt: number, state: GameState): void {
  if (stepAnim === 'removing') {
    state.stepRemoved = Math.min(1, state.stepRemoved + dt * COORDS.stepAnimSpeed);
    if (state.stepRemoved >= 1) {
      stepAnim = null;
      state.escalator.removedStep = chosenStepIndex(state);
      if (state.phase === 'removeStep' && state.mode === 'play') {
        setPhase(state, 'inspect');
      } else {
        syncHotspots(state);
      }
    }
  } else if (stepAnim === 'restoring') {
    state.stepRemoved = Math.max(0, state.stepRemoved - dt * COORDS.stepAnimSpeed);
    if (state.stepRemoved <= 0) {
      stepAnim = null;
      state.escalator.removedStep = null;
      if (state.phase === 'restoreStep') {
        setPhase(state, 'closePlate');
      } else {
        syncHotspots(state);
      }
    }
  }
}

function updateHint(dt: number, state: GameState): void {
  state.idleSeconds += dt;
  const target = primaryHintTarget(state);
  if (!target) return;
  if (state.idleSeconds >= nextHintAt) {
    bus.emit('hint', target);
    effects.glowAt(target.x, target.y);
    nextHintAt += COORDS.hintRepeatInterval;
  }
}

function updateCelebrate(state: GameState): void {
  if (state.phase === 'celebrate' && state.time - celebrateEnterTime >= COORDS.celebrateDuration) {
    setPhase(state, 'select');
  }
}

export const flow: {
  start(state: GameState): void;
  update(dt: number, state: GameState): void;
  layoutChanged(state: GameState): void;
} = {
  start(state: GameState) {
    if (!started) {
      started = true;
      bus.on('phase', ({ to }) => enterPhase(state, to));
      bus.on('hotspot', (ev) => onHotspotEvent(ev, state));
    }

    state.phase = 'title';
    state.mode = 'play';
    state.view = 'exterior';
    state.fault = null;
    nextHintAt = COORDS.hintFirstDelay;
    plateAnim = null;
    stepAnim = null;

    syncHotspots(state);
    const cam = computeCameraTarget(state);
    layout.setCameraTarget(cam.cx, cam.cy, cam.scale);
    layout.snapCamera();

    // 開発/検証用デバッグフック(本番挙動には影響しない)
    (window as unknown as { __flowDebug?: unknown }).__flowDebug = {
      state,
      forcePhase: (p: GamePhase) => setPhase(state, p),
      forceFault: (k: FaultKind) => {
        startNewFault(state, state.location);
        if (state.fault) {
          const forced = createFault(k, state.escalator);
          forced.anchorT = state.fault.anchorT;
          state.fault = forced;
          lastFaultKind = k;
        }
      },
      ui: (id: string) => bus.emit('hotspot', { id: `ui:${id}`, type: 'activated', x: 0, y: 0 }),
      hotspot: (
        id: string,
        type: 'activated' | 'progress' | 'dragMove' | 'released',
        x = 0,
        y = 0,
        extra?: { t?: number; delta?: number }
      ) => bus.emit('hotspot', { id, type, x, y, ...extra })
    };
  },

  update(dt: number, state: GameState) {
    updatePlateAnim(dt, state);
    updateStepAnim(dt, state);
    updateCelebrate(state);
    updateHint(dt, state);

    const cam = computeCameraTarget(state);
    layout.setCameraTarget(cam.cx, cam.cy, cam.scale);
  },

  layoutChanged(state: GameState) {
    const cam = computeCameraTarget(state);
    layout.setCameraTarget(cam.cx, cam.cy, cam.scale);
  }
};
