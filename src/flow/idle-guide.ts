// ============================================================================
// flow/idle-guide.ts — 無操作タイマー。robot視線→spotlight→gesture の3段階誘導。
// 「操作開始」は監視対象の数値(watch)の変化で代理検知する
// (InputSystemは生ポインタをflowへ渡さないため、MachineStateの値変化で推定)。
// ============================================================================

export type HintStage = 'none' | 'look' | 'spotlight' | 'gesture';

export interface IdleThresholds { look: number; spotlight: number; gesture: number }

// 4歳児向けに短縮: 通常ステップは2.5s/4s/5.5s、故障発見は少し長めに4s/7s/10s
// (見つける遊びの間は待つが、迷子にならない程度で自然に誘導する)。
export const DEFAULT_THRESHOLDS: IdleThresholds = { look: 2.5, spotlight: 4, gesture: 5.5 };
export const FIND_FAULT_THRESHOLDS: IdleThresholds = { look: 4, spotlight: 7, gesture: 10 };

export class IdleGuide {
  private t = 0;
  private lastWatch = NaN;
  thresholds: IdleThresholds;

  constructor(thresholds: IdleThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  reset(): void {
    this.t = 0;
  }

  setThresholds(th: IdleThresholds): void {
    this.thresholds = th;
  }

  /** 監視対象の数値が変化したら無操作タイマーをリセット（操作開始の代理検知） */
  watch(value: number): void {
    if (Number.isFinite(this.lastWatch) && Math.abs(value - this.lastWatch) > 1e-3) {
      this.reset();
    }
    this.lastWatch = value;
  }

  /** watchの基準値だけ更新してリセットは行わない（ステップ開始時の初期化用） */
  prime(value: number): void {
    this.lastWatch = value;
  }

  update(dt: number): void {
    this.t += dt;
  }

  get stage(): HintStage {
    const th = this.thresholds;
    if (this.t >= th.gesture) return 'gesture';
    if (this.t >= th.spotlight) return 'spotlight';
    if (this.t >= th.look) return 'look';
    return 'none';
  }

  get seconds(): number {
    return this.t;
  }
}
