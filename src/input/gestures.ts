// src/input/gestures.ts
// 所有: A3 (input)
//
// 4歳児向けの「寛容な入力」。タップ/大きなスワイプ/太い円(crank)/太い経路なぞり(trace)/
// 寛容ドラッグ(drag, 磁石スナップ)/こすり(rub) のみ。細かい正確さは一切要求しない。
//
// 実装方針:
//  - 幾何・進捗計算はすべて gesture-logic.ts の純粋関数に委譲(node で単体テスト済み)。
//  - このファイルは DOM イベント購読・状態機械・bus/layout との橋渡しのみを担当。

import type { Hotspot, HotspotEvent } from '../core/types';
import { bus } from '../core/events';
import { layout } from '../core/layout';
import {
  angleFromCenter,
  advanceTraceProgress,
  crankDelta,
  dist,
  isSwipeMotion,
  isTapMotion,
  lerp,
  magnetPullFactor,
  nearestPointOnPath,
  pickNearest,
  rubDistanceToT,
  swipeMatchesDir,
  DRAG_SNAP_PX,
  type Vec2
} from './gesture-logic';

interface DragState {
  kind: 'drag';
  hotspot: Hotspot;
  rawX: number;
  rawY: number;
  visualX: number;
  visualY: number;
}

interface CrankState {
  kind: 'crank';
  hotspot: Hotspot;
  prevAngle: number;
  accumT: number;
}

interface TraceState {
  kind: 'trace';
  hotspot: Hotspot;
  t: number;
  done: boolean;
}

interface RubState {
  kind: 'rub';
  hotspot: Hotspot;
  cumulativeDistance: number;
  lastX: number;
  lastY: number;
  done: boolean;
}

interface TapSwipeState {
  kind: 'tapswipe';
  hotspot: Hotspot | null; // 開始点近くに候補が無ければ null (何も発火しない)
}

type Engagement = DragState | CrankState | TraceState | RubState | TapSwipeState;

interface ActiveGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  lastX: number;
  lastY: number;
  engagement: Engagement;
}

let hotspots: Hotspot[] = [];
let attachedCanvas: HTMLCanvasElement | null = null;
let active: ActiveGesture | null = null;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function emit(id: string, type: HotspotEvent['type'], x: number, y: number, extra?: { t?: number; delta?: number }): void {
  bus.emit('hotspot', { id, type, x, y, ...extra });
}

function resetActive(): void {
  active = null;
}

// --- エンゲージ選定 ---
// pointerdown 時、どのホットスポットを掴んだ扱いにするかを決める。
// 種別ごとに定められた寛容半径内にあるものだけを候補にし、種別グループごとに「一番近いもの」を選ぶ。
// より明示的な操作を要する種別(drag/crank/trace/rub)を tap/swipe より優先する。
function engage(x: number, y: number): Engagement {
  const dragC: { item: Hotspot; distance: number }[] = [];
  const crankC: { item: Hotspot; distance: number }[] = [];
  const traceC: { item: Hotspot; distance: number }[] = [];
  const rubC: { item: Hotspot; distance: number }[] = [];
  const tapSwipeC: { item: Hotspot; distance: number }[] = [];

  for (const hs of hotspots) {
    switch (hs.kind) {
      case 'drag': {
        const d = dist(x, y, hs.x, hs.y);
        if (d <= hs.r * 1.5) dragC.push({ item: hs, distance: d });
        break;
      }
      case 'crank': {
        const d = dist(x, y, hs.x, hs.y);
        if (d <= hs.r * 2) crankC.push({ item: hs, distance: d });
        break;
      }
      case 'trace': {
        const path = hs.path ?? [];
        const near = nearestPointOnPath({ x, y }, path);
        if (near.distance <= 60) traceC.push({ item: hs, distance: near.distance });
        break;
      }
      case 'rub': {
        const d = dist(x, y, hs.x, hs.y);
        if (d <= hs.r) rubC.push({ item: hs, distance: d });
        break;
      }
      case 'tap':
      case 'swipe': {
        const d = dist(x, y, hs.x, hs.y);
        if (d <= hs.r * 1.5) tapSwipeC.push({ item: hs, distance: d });
        break;
      }
    }
  }

  const drag = pickNearest(dragC);
  if (drag) return { kind: 'drag', hotspot: drag, rawX: x, rawY: y, visualX: x, visualY: y };

  const crank = pickNearest(crankC);
  if (crank) {
    return {
      kind: 'crank',
      hotspot: crank,
      prevAngle: angleFromCenter({ x: crank.x, y: crank.y }, { x, y }),
      accumT: 0
    };
  }

  const trace = pickNearest(traceC);
  if (trace) return { kind: 'trace', hotspot: trace, t: 0, done: false };

  const rub = pickNearest(rubC);
  if (rub) return { kind: 'rub', hotspot: rub, cumulativeDistance: 0, lastX: x, lastY: y, done: false };

  const tapSwipe = pickNearest(tapSwipeC);
  return { kind: 'tapswipe', hotspot: tapSwipe };
}

// --- pointer イベントハンドラ ---

function onPointerDown(ev: PointerEvent): void {
  ev.preventDefault();
  if (active !== null) return; // マルチタッチは最初の1本のみ追う(2本目以降は無視)
  if (!attachedCanvas) return;

  const world = toWorld(ev);
  active = {
    pointerId: ev.pointerId,
    startX: world.x,
    startY: world.y,
    startTime: now(),
    lastX: world.x,
    lastY: world.y,
    engagement: engage(world.x, world.y)
  };
}

function onPointerMove(ev: PointerEvent): void {
  if (!active || ev.pointerId !== active.pointerId) return;
  ev.preventDefault();
  const world = toWorld(ev);
  active.lastX = world.x;
  active.lastY = world.y;

  const eg = active.engagement;
  switch (eg.kind) {
    case 'drag': {
      eg.rawX = world.x;
      eg.rawY = world.y;
      break; // dragMove の発火自体は update(dt) で毎フレーム行う
    }
    case 'crank': {
      const cur = angleFromCenter({ x: eg.hotspot.x, y: eg.hotspot.y }, world);
      const delta = crankDelta(eg.prevAngle, cur);
      eg.prevAngle = cur;
      eg.accumT += delta / (Math.PI * 2);
      emit(eg.hotspot.id, 'progress', world.x, world.y, { delta, t: eg.accumT });
      break;
    }
    case 'trace': {
      if (eg.done) break;
      const path = eg.hotspot.path ?? [];
      const near = nearestPointOnPath(world, path);
      const nextT = advanceTraceProgress(eg.t, near);
      if (nextT !== eg.t) {
        eg.t = nextT;
        emit(eg.hotspot.id, 'progress', world.x, world.y, { t: eg.t });
      }
      if (eg.t >= 1 && !eg.done) {
        eg.done = true;
        emit(eg.hotspot.id, 'activated', world.x, world.y, { t: 1 });
      }
      break;
    }
    case 'rub': {
      if (eg.done) break;
      const d = dist(world.x, world.y, eg.lastX, eg.lastY);
      eg.cumulativeDistance += d;
      eg.lastX = world.x;
      eg.lastY = world.y;
      const t = rubDistanceToT(eg.cumulativeDistance);
      emit(eg.hotspot.id, 'progress', world.x, world.y, { t });
      if (t >= 1 && !eg.done) {
        eg.done = true;
        emit(eg.hotspot.id, 'activated', world.x, world.y, { t: 1 });
      }
      break;
    }
    case 'tapswipe':
      // 確定判定は pointerup 時にまとめて行う(スワイプの向きは終了時の総移動量で見る)
      break;
  }
}

function finishTapOrSwipe(eg: TapSwipeState, startX: number, startY: number, startTime: number, x: number, y: number): void {
  if (!eg.hotspot) return;
  const dx = x - startX;
  const dy = y - startY;
  const elapsedMs = now() - startTime;

  if (isTapMotion(dx, dy, elapsedMs)) {
    if (eg.hotspot.kind === 'tap') {
      emit(eg.hotspot.id, 'activated', x, y);
    }
    return;
  }

  if (isSwipeMotion(dx, dy)) {
    if (eg.hotspot.kind === 'swipe' && swipeMatchesDir(dx, dy, eg.hotspot.dir)) {
      emit(eg.hotspot.id, 'activated', x, y);
    }
  }
  // 20px〜60px の中途半端な移動、または向き不一致は何も発火しない(誤操作にならない)
}

function finishDrag(eg: DragState, x: number, y: number): void {
  const hs = eg.hotspot;
  if (hs.dropX !== undefined && hs.dropY !== undefined) {
    const d = dist(x, y, hs.dropX, hs.dropY);
    if (d <= DRAG_SNAP_PX) {
      bus.emit('sfx', { name: 'magnet' });
      emit(hs.id, 'activated', hs.dropX, hs.dropY);
      return;
    }
  }
  emit(hs.id, 'released', x, y);
}

function onPointerUp(ev: PointerEvent): void {
  if (!active || ev.pointerId !== active.pointerId) return;
  ev.preventDefault();
  const world = toWorld(ev);
  const eg = active.engagement;

  if (eg.kind === 'tapswipe') {
    finishTapOrSwipe(eg, active.startX, active.startY, active.startTime, world.x, world.y);
  } else if (eg.kind === 'drag') {
    finishDrag(eg, world.x, world.y);
  }
  // crank / trace / rub: up 時に追加のイベントは不要 (progress/activated は移動中に発火済み)

  resetActive();
}

function onPointerCancel(ev: PointerEvent): void {
  if (!active || ev.pointerId !== active.pointerId) return;
  ev.preventDefault();
  const eg = active.engagement;
  if (eg.kind === 'drag') {
    emit(eg.hotspot.id, 'released', eg.rawX, eg.rawY);
  }
  resetActive();
}

function toWorld(ev: PointerEvent): Vec2 {
  const canvas = attachedCanvas!;
  const rect = canvas.getBoundingClientRect();
  const sx = ev.clientX - rect.left;
  const sy = ev.clientY - rect.top;
  return layout.screenToWorld(sx, sy);
}

export const input: {
  attach(canvas: HTMLCanvasElement): void;
  setHotspots(h: Hotspot[]): void;
  update(dt: number): void;
  dragVisual(): { id: string; x: number; y: number } | null;
} = {
  attach(canvas: HTMLCanvasElement) {
    attachedCanvas = canvas;
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp, { passive: false });
    canvas.addEventListener('pointercancel', onPointerCancel, { passive: false });
  },

  setHotspots(h: Hotspot[]) {
    hotspots = h;
    // 破棄時に進行中ジェスチャーをリセット (新しいフェーズのホットスポットに古い状態を引き継がない)
    resetActive();
  },

  update(_dt: number) {
    if (!active) return;
    const eg = active.engagement;
    if (eg.kind !== 'drag') return;

    const hs = eg.hotspot;
    let targetX = eg.rawX;
    let targetY = eg.rawY;
    if (hs.dropX !== undefined && hs.dropY !== undefined) {
      const d = dist(eg.rawX, eg.rawY, hs.dropX, hs.dropY);
      const pull = magnetPullFactor(d);
      if (pull > 0) {
        targetX = lerp(eg.rawX, hs.dropX, pull);
        targetY = lerp(eg.rawY, hs.dropY, pull);
      }
    }
    eg.visualX = targetX;
    eg.visualY = targetY;
    emit(hs.id, 'dragMove', eg.visualX, eg.visualY);
  },

  dragVisual() {
    if (!active) return null;
    const eg = active.engagement;
    if (eg.kind !== 'drag') return null;
    return { id: eg.hotspot.id, x: eg.visualX, y: eg.visualY };
  }
};
