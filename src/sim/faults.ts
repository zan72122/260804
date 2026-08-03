// ============================================================================
// 故障データ定義（データ駆動）。5種。追加しやすいようレジストリ形式にする。
// 実際の毎フレーム挙動（詰まり/渋滞/ガイド待ち等）は index.ts の update() が
// state.faults の有無を見て処理する。ここでは「注入時」「修理完了時」の
// 状態変更のみを宣言的に持つ。
// ============================================================================
import type { FaultId, FaultInstance, MachineState } from '../core/types';

export interface FaultDef {
  id: FaultId;
  /** 故障注入時に呼ばれる。state を直接書き換えてよい（呼び出し元はsimのみ） */
  inject: (state: MachineState, meta: Record<string, number>) => void;
  /** 修理完了時の後片付け */
  onFixed: (state: MachineState) => void;
}

export const ALL_FAULT_IDS: FaultId[] = [
  'pin-jam', 'belt-derail', 'guide-shift', 'rack-gate', 'flap-stuck',
];

export const FAULT_DEFS: Record<FaultId, FaultDef> = {
  'pin-jam': {
    id: 'pin-jam',
    inject: (state) => {
      // 実際にどのピンが詰まるかはベルト移動ロジック側（index.ts）が
      // BELT_CORNER_T 到達時に決める。ここではベルトを動かし始めるだけ。
      state.belt.run = true;
    },
    onFixed: (state) => {
      state.belt.vibrate = 0;
    },
  },
  'belt-derail': {
    id: 'belt-derail',
    inject: (state) => {
      state.belt.derail = 1;
      state.belt.run = true; // モーターは回るがベルトが空転
    },
    onFixed: (state) => {
      state.belt.derail = 0;
    },
  },
  'guide-shift': {
    id: 'guide-shift',
    inject: (state) => {
      state.orienter.guideOffset = 1;
    },
    onFixed: (state) => {
      state.orienter.guideOffset = 0;
    },
  },
  'rack-gate': {
    id: 'rack-gate',
    inject: (state, meta) => {
      // 0..8 のどこか（最後の1枠だと10本揃わなくなるため避ける）
      const slot = Math.floor(Math.random() * 9);
      state.rack.stuckGate = slot;
      state.rack.gateOpen[slot] = 0;
      meta.slot = slot;
    },
    onFixed: (state) => {
      state.rack.stuckGate = null;
    },
  },
  'flap-stuck': {
    id: 'flap-stuck',
    inject: (state) => {
      state.ballReturn.flapStuck = true;
      state.ballReturn.flap = 0;
    },
    onFixed: (state) => {
      state.ballReturn.flapStuck = false;
    },
  },
};

export function makeFaultInstance(id: FaultId): FaultInstance {
  return { id, fixed: false, progress: 0, meta: {} };
}
