// ============================================================================
// 型付きイベントバス — モジュール間のフック機構。 ⚠️ オーケストレーター所有・編集禁止。
// ============================================================================
import type { FaultId, FlowStep, SfxId, VoiceId } from './types';

export interface EventMap {
  /** 効果音再生要求（audioが購読） */
  'sfx': { id: SfxId; vol?: number; pitch?: number };
  'sfx:stop': { id: SfxId };
  'voice': { id: VoiceId };

  /** フロー遷移通知（flowが発火、全員が購読可） */
  'flow': { step: FlowStep };

  /** sim → flow/audio/ui へのゲームプレイフック */
  'fault:found': { id: FaultId };
  'fault:fixed': { id: FaultId };
  'pin:freed': { pin: number };
  'pin:oriented': { pin: number; style: 'kurun' | 'koron' | 'through' };
  'rack:slot': { slot: number; count: number };
  'rack:full': Record<string, never>;
  'table:placed': Record<string, never>;
  'ball:returned': Record<string, never>;
  'pins:down': { count: number };
  'strike': Record<string, never>;

  /** カメラ制御要求（coreが購読）。ワールド座標 */
  'camera:focus': { x: number; y: number; zoom?: number; lerp?: number };
  'camera:shake': { power: number };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private map = new Map<string, Set<Handler<unknown>>>();

  on<K extends keyof EventMap>(ev: K, fn: Handler<EventMap[K]>): () => void {
    let set = this.map.get(ev as string);
    if (!set) { set = new Set(); this.map.set(ev as string, set); }
    set.add(fn as Handler<unknown>);
    return () => set!.delete(fn as Handler<unknown>);
  }

  emit<K extends keyof EventMap>(ev: K, payload: EventMap[K]): void {
    const set = this.map.get(ev as string);
    if (set) for (const fn of [...set]) fn(payload);
  }
}

/** アプリ全体で共有する単一バス */
export const bus = new EventBus();
