// src/core/events.ts (A1 scaffold — 凍結)
import type { GamePhase, HotspotEvent, SfxName, LoopName } from './types';

export interface EventMap {
  phase: { from: GamePhase; to: GamePhase };
  hotspot: HotspotEvent;                    // A3が発火、A5が消費
  sfx: { name: SfxName; pan?: number };     // 誰でも発火、A4が消費
  loopStart: { name: LoopName; pan?: number; intensity?: number };
  loopStop: { name: LoopName };
  crank: { delta: number };                 // A5→A2 model.crank用(直接呼びも可)
  hint: { x: number; y: number };           // A5発火→A6(指差し/視線/光)+A4(音方向)
  celebrate: Record<string, never>;
  settingsChanged: Record<string, never>;
}

type Listener<K extends keyof EventMap> = (e: EventMap[K]) => void;

function createEventBus() {
  const listeners = new Map<keyof EventMap, Set<Listener<keyof EventMap>>>();

  return {
    on<K extends keyof EventMap>(k: K, fn: Listener<K>): () => void {
      let set = listeners.get(k);
      if (!set) {
        set = new Set();
        listeners.set(k, set);
      }
      set.add(fn as Listener<keyof EventMap>);
      return () => {
        set!.delete(fn as Listener<keyof EventMap>);
      };
    },
    emit<K extends keyof EventMap>(k: K, e: EventMap[K]): void {
      const set = listeners.get(k);
      if (!set) return;
      // イテレーション中の登録解除に耐えるようコピーして回す
      for (const fn of Array.from(set)) {
        (fn as Listener<K>)(e);
      }
    }
  };
}

export const bus: {
  on<K extends keyof EventMap>(k: K, fn: (e: EventMap[K]) => void): () => void;
  emit<K extends keyof EventMap>(k: K, e: EventMap[K]): void;
} = createEventBus();
