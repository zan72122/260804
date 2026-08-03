// src/sim/faults.ts
// 所有: A5 (flow)。これは A1 が用意した最小スタブ実装。

import type { EscalatorModel, FaultInstance, FaultKind, GameState, Hotspot, HotspotEvent, LoopName } from '../core/types';

export const FAULT_KINDS: FaultKind[] = ['roller', 'chainGuide', 'handrail', 'sensor'];

const ANOMALY_LOOP: Record<FaultKind, LoopName> = {
  roller: 'kotokoto',
  chainGuide: 'kachikachi',
  handrail: 'zuruzuru',
  sensor: 'jiji'
};

class FaultInstanceImpl implements FaultInstance {
  kind: FaultKind;
  anomalyLoop: LoopName;
  anchorT: number;
  fixed = false;
  progress = 0;

  constructor(kind: FaultKind) {
    this.kind = kind;
    this.anomalyLoop = ANOMALY_LOOP[kind];
    this.anchorT = 0.5;
  }

  hotspots(_state: GameState): Hotspot[] {
    // TODO(A5): 故障種別ごとの実際のホットスポット定義。
    return [];
  }

  onHotspot(_ev: HotspotEvent, _state: GameState): void {
    // TODO(A5): 修理ジェスチャーの進行処理。
  }

  render(_ctx: CanvasRenderingContext2D, _state: GameState): void {
    // TODO(A5): 壊れ部品の描画。
  }

  modelEffect(model: EscalatorModel): void {
    model.wobbleAmp = this.fixed ? 0 : Math.max(model.wobbleAmp, 0);
  }
}

export function createFault(kind: FaultKind, _model: EscalatorModel): FaultInstance {
  return new FaultInstanceImpl(kind);
}
