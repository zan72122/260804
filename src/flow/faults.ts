// ============================================================================
// flow/faults.ts — 故障の選出・注目座標・修理Interactableの対応表。
// ============================================================================
import type { FaultId, MachineState } from '../core/types';
import {
  BELT_PATH, BELT_CORNER_T, ROLLER, ORIENTER, RACK, FLAP, pointOnPath,
} from '../core/geometry';

export const ALL_FAULTS: FaultId[] = ['pin-jam', 'belt-derail', 'guide-shift', 'rack-gate', 'flap-stuck'];

/** 故障ごとの修理Interactable ID（順序は参考。実際の内部シーケンスはsimが管理） */
export const FAULT_REPAIR_IDS: Record<FaultId, string[]> = {
  'pin-jam': ['stuck-pin'],
  'belt-derail': ['belt-trace', 'roller-spin'],
  'guide-shift': ['guide-fix'],
  'rack-gate': ['rack-gate'],
  // flap-stuck はここでは扱わない。ball-return ステップで flap 操作と同時に自然解消する。
  'flap-stuck': ['flap'],
};

export type GestureKind = 'swipe' | 'drag' | 'circle' | 'tap';

export const FAULT_GESTURE: Record<FaultId, { kind: GestureKind; dir: number }> = {
  'pin-jam': { kind: 'drag', dir: -Math.PI / 2 },
  'belt-derail': { kind: 'swipe', dir: 0 },
  'guide-shift': { kind: 'drag', dir: Math.PI / 2 },
  'rack-gate': { kind: 'tap', dir: 0 },
  'flap-stuck': { kind: 'swipe', dir: -Math.PI / 2 },
};

/** 初回=固定2故障、2周目以降=5種から1つランダム */
export function pickFaults(firstTime: boolean): FaultId[] {
  if (firstTime) return ['pin-jam', 'belt-derail'];
  const idx = Math.floor(Math.random() * ALL_FAULTS.length);
  return [ALL_FAULTS[idx]];
}

/** 故障箇所の machine-space 注目座標 */
export function faultFocus(state: MachineState, id: FaultId): { x: number; y: number } {
  switch (id) {
    case 'pin-jam': {
      const p = pointOnPath(BELT_PATH, BELT_CORNER_T);
      return { x: p.x, y: p.y };
    }
    case 'belt-derail':
      return { x: ROLLER.x, y: ROLLER.y };
    case 'guide-shift':
      return { x: ORIENTER.x, y: ORIENTER.y };
    case 'rack-gate': {
      const slot = state.rack.stuckGate;
      const pos = slot !== null && RACK.slots[slot] ? RACK.slots[slot] : RACK.slots[0];
      return { x: pos[0], y: pos[1] };
    }
    case 'flap-stuck':
      return { x: FLAP.x, y: FLAP.y };
  }
}

/** find-fault/fix で許可すべきInteractable ID群（flap-stuckは除く＝ball-returnで自然解消） */
export function repairGateIds(state: MachineState): string[] {
  const ids = new Set<string>();
  for (const f of state.faults) {
    if (f.fixed) continue;
    if (f.id === 'flap-stuck') continue;
    for (const rid of FAULT_REPAIR_IDS[f.id]) ids.add(rid);
  }
  return [...ids];
}

/** 現在フォーカスすべき（未修理・flap-stuck以外の）最初の故障 */
export function firstUnfixedNonFlap(state: MachineState): FaultId | null {
  for (const f of state.faults) {
    if (!f.fixed && f.id !== 'flap-stuck') return f.id;
  }
  return null;
}

/** flap-stuck以外の故障が全て直っているか */
export function allNonFlapFixed(state: MachineState): boolean {
  return state.faults.every((f) => f.fixed || f.id === 'flap-stuck');
}
