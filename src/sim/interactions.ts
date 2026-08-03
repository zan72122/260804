// ============================================================================
// registerAllInteractables — CONTRACTS.md記載の機械側インタラクションを登録。
// 本タスク指示の詳細仕様(11種)に加え、'ball-swipe'/'cover-close' も
// 実際にはどのモジュールにも登録されていなかった（flowはgateするのみ）ため、
// sim側のメソッド(bowl/startTestFeed)に直結するここで登録して穴を埋める。
// 'approach' は flow/index.ts が自前で登録済みなのでここでは扱わない。
// ============================================================================
import type { InputSystem } from '../core/input';
import type { Interactable, PointerInfo } from '../core/types';
import {
  DOOR_HANDLE, FLAP, LANE_VIEW, ORIENTER, PIT, RACK, SAFETY_LEVER, TABLE_LEVER, BELT_PATH,
} from '../core/geometry';
import { clamp, distanceToPath } from './pins';
import type { MachineSim } from './index';

const ROLLER_X = 860, ROLLER_Y = 975, ROLLER_R = 30;

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}

export function registerAllInteractables(sim: MachineSim, input: InputSystem): void {
  const items: Interactable[] = [
    // 上へスワイプで投球（flowがgateするが登録先が無かったためsimで担う）
    {
      id: 'ball-swipe',
      scene: 'lane',
      enabled: () => sim.state.ball.zone === 'rack',
      hit: (x, y) => dist(x, y, sim.state.ball.x, sim.state.ball.y) < 180
        || y > LANE_VIEW.nearY - 280,
      onUp: (p: PointerInfo) => {
        const dx = p.x - p.downX, dy = p.y - p.downY;
        if (dy > -20) return; // 上方向スワイプのみ受け付け
        const power = clamp(Math.hypot(dx, dy) / 420, 0.35, 1);
        const dirX = clamp(dx / 160, -1, 1);
        sim.bowl(dirX, power);
      },
    },
    // カバー/扉を戻すスワイプ → 試運転モードへ（同上の理由でsimが担う）
    {
      id: 'cover-close',
      scene: 'machine',
      enabled: () => sim.state.door > 0,
      hit: (x, y) => dist(x, y, DOOR_HANDLE.x, DOOR_HANDLE.y) < 110,
      onMove: (p: PointerInfo) => sim.coverCloseInput(p.dx),
    },
    // 安全レバーを下へドラッグ → ロック「ガコン」
    {
      id: 'safety-lever',
      scene: 'machine',
      enabled: () => true,
      hit: (x, y) => dist(x, y, SAFETY_LEVER.x, SAFETY_LEVER.y) < 90,
      onMove: (p: PointerInfo) => sim.safetyLeverInput(p.dy),
    },
    // 扉の取っ手を横へドラッグ → 「パカッ」
    {
      id: 'door-handle',
      scene: 'machine',
      enabled: () => true,
      hit: (x, y) => dist(x, y, DOOR_HANDLE.x, DOOR_HANDLE.y) < 90,
      onMove: (p: PointerInfo) => sim.doorHandleInput(p.dx),
    },
    // 詰まりピンをドラッグ → 磁石吸着で救出
    {
      id: 'stuck-pin',
      scene: 'machine',
      enabled: () => sim.state.pins.some((pp) => pp.stuck),
      hit: (x, y) => {
        const sp = sim.state.pins.find((pp) => pp.stuck);
        return !!sp && dist(x, y, sp.x, sp.y) < 100;
      },
      onMove: (p: PointerInfo) => sim.freeStuckPin(dist(p.x, p.y, p.downX, p.downY)),
    },
    // ベルト経路をなぞる → derailを減らす「パチン」
    {
      id: 'belt-trace',
      scene: 'machine',
      enabled: () => sim.state.belt.derail > 0,
      hit: (x, y) => distanceToPath(BELT_PATH, x, y) < 100,
      onMove: (p: PointerInfo) => sim.beltTraceInput(p.x, p.y, dist(p.dx, p.dy, 0, 0)),
    },
    // ローラーを円でなぞる → rollerAngle蓄積（動作確認演出）
    {
      id: 'roller-spin',
      scene: 'machine',
      enabled: () => true,
      hit: (x, y) => dist(x, y, ROLLER_X, ROLLER_Y) < ROLLER_R + 70,
      onDown: () => sim.rollerSpinBegin(),
      onMove: (p: PointerInfo) => sim.rollerSpinInput(p.x, p.y),
    },
    // 選別機のピンをスワイプ → くるん/ころん
    {
      id: 'orient-swipe',
      scene: 'machine',
      enabled: () => sim.state.orienter.busyPin !== null,
      hit: (x, y) => {
        const bp = sim.state.orienter.busyPin;
        if (bp === null) return false;
        const pin = sim.state.pins.find((pp) => pp.id === bp);
        return !!pin && dist(x, y, pin.x, pin.y) < 110;
      },
      onUp: (p: PointerInfo) => {
        const dx = p.x - p.downX, dy = p.y - p.downY;
        const speed = Math.hypot(dx, dy) / Math.max(0.05, p.heldTime);
        sim.orientSwipeInput(dx, dy, speed);
      },
    },
    // ガイドをドラッグ → guide-shift修理「パチン」
    {
      id: 'guide-fix',
      scene: 'machine',
      enabled: () => sim.state.orienter.guideOffset > 0,
      hit: (x, y) => x > ORIENTER.x - ORIENTER.w / 2 - 50 && x < ORIENTER.x + ORIENTER.w / 2 + 50
        && y > ORIENTER.y - ORIENTER.h / 2 - 70 && y < ORIENTER.y + ORIENTER.h / 2 + 30,
      onMove: (p: PointerInfo) => sim.guideFixInput(p.dx),
    },
    // ラックのゲートをタップ/上スワイプ → rack-gate修理「パチン」
    {
      id: 'rack-gate',
      scene: 'machine',
      enabled: () => sim.state.rack.stuckGate !== null,
      hit: (x, y) => {
        const s = sim.state.rack.stuckGate;
        if (s === null) return false;
        const pos = RACK.slots[s];
        return dist(x, y, pos[0], pos[1]) < 100;
      },
      onUp: () => sim.rackGateInput(),
    },
    // テーブルレバーを下へドラッグ → dropTable()
    {
      id: 'table-lever',
      scene: 'machine',
      enabled: () => true,
      hit: (x, y) => dist(x, y, TABLE_LEVER.x, TABLE_LEVER.y) < 90,
      onMove: (p: PointerInfo) => sim.tableLeverInput(p.dy),
    },
    // フラップを上スワイプ → flap-stuck修理、ボール再前進
    {
      id: 'flap',
      scene: 'machine',
      enabled: () => true,
      hit: (x, y) => dist(x, y, FLAP.x, FLAP.y) < 90,
      onMove: (p: PointerInfo) => sim.flapInput(p.dy),
    },
    // ピットをタップ → フリープレイでピン追加
    {
      id: 'free-drop',
      scene: 'machine',
      enabled: () => sim.freePlay,
      hit: (x, y) => x > PIT.x - PIT.w / 2 - 40 && x < PIT.x + PIT.w / 2 + 40
        && y > PIT.y - PIT.h / 2 - 40 && y < PIT.y + PIT.h / 2 + 40,
      onDown: () => sim.addFreeDropPin(),
    },
  ];

  for (const it of items) input.register(it);
}
