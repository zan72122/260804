// ============================================================================
// 共有型定義 — 全モジュールの契約。 ⚠️ このファイルはオーケストレーターが所有。
// サブエージェントは編集禁止（不足があればレポートに書くこと。統合ウェーブで対応）。
// ============================================================================

// ── レイアウト / カメラ ──────────────────────────────────────────────
export type Orientation = 'portrait' | 'landscape';

export interface SafeArea { top: number; right: number; bottom: number; left: number }

export interface Layout {
  /** CSSピクセルでの画面サイズ */
  w: number; h: number;
  dpr: number;
  orientation: Orientation;
  safe: SafeArea;
}

/** ワールド(machine-space)→画面の変換。zoom=画面px/ワールド単位 */
export interface Camera { x: number; y: number; zoom: number }

// ── シーン ──────────────────────────────────────────────────────────
/** lane = ボウリング場正面（投球/試運転観覧）, machine = レーン奥のカットモデル */
export type SceneId = 'lane' | 'machine';

// ── ピン / ボール ────────────────────────────────────────────────────
export type PinZone =
  | 'lane'      // レーン上（直立 or 倒れ）
  | 'pit'       // ピット内（落下後）
  | 'belt'      // 回収ベルト上 (t: 0=ピット側 → 1=エレベーター取込口)
  | 'elevator'  // エレベーターホイール (t: 0=下 → 1=上)
  | 'top'       // 上部搬送路 (t: 0=エレベーター上 → 1=ラック投入口手前)
  | 'orienter'  // 選別機内（向き変え中）
  | 'rack'      // ラック格納済み (slot 0..9)
  | 'table'     // ピンテーブル保持中
  | 'placed'    // レーンへ再配置済み（直立）
  | 'gone';     // 非表示（プール）

export type PinPose = 'upright' | 'lying' | 'inverted';

export interface Pin {
  id: number;
  zone: PinZone;
  /** 現ゾーンのパス上の進行度 0..1 */
  t: number;
  /** machine-space 座標（simが毎フレーム計算、rendererは読むだけ） */
  x: number; y: number; rot: number;
  pose: PinPose;
  stuck: boolean;
  /** rack/table/placed のときのスロット番号 0..9、それ以外 -1 */
  slot: number;
  /** 装飾リング色（省略可） */
  ring?: string;
  /** 自由落下用速度（pit内など） */
  vx: number; vy: number;
}

export type BallZone = 'rack' | 'lane' | 'pit' | 'return' | 'returned' | 'hidden';

export interface Ball {
  zone: BallZone;
  t: number;                     // return パス上の進行度
  x: number; y: number; rot: number;
  color: string;
}

// ── 故障 ────────────────────────────────────────────────────────────
export type FaultId =
  | 'pin-jam'      // 1. 横向きピンがベルト曲がり角で詰まる
  | 'belt-derail'  // 2. 回収ベルトがローラーから外れる
  | 'guide-shift'  // 3. 選別ガイドがずれる
  | 'rack-gate'    // 4. ラックの1か所が閉じたまま
  | 'flap-stuck';  // 5. ボールリターンのフラップが閉じたまま

export interface FaultInstance {
  id: FaultId;
  fixed: boolean;
  /** 修理の進行度 0..1（なぞり系で使用） */
  progress: number;
  /** 故障ごとの付加情報（rack-gate のスロット番号など） */
  meta: Record<string, number>;
}

// ── 機械の状態（単一の真実。simのみが書き、rendererは読む） ─────────────
export interface MachineState {
  powerOn: boolean;
  locked: boolean;          // 安全ロック済み
  door: number;             // 奥カバー開き 0..1
  xray: boolean;            // 透明カットモデル表示
  simSpeed: number;         // 0.5 / 1 / 1.5
  testMode: boolean;        // 試運転モード（ピンを1本ずつ流す）

  safetyLever: number;      // 0=上(解除) .. 1=下(ロック)
  tableLever: number;       // 0..1

  belt: {
    run: boolean;
    /** ベルト表面の流れオフセット（描画用、単調増加） */
    offset: number;
    /** ローラー外れ度 0=正常 .. 1=完全に外れ */
    derail: number;
    /** 詰まり時の振動強度 0..1（描画ヒント） */
    vibrate: number;
    /** 修理確認用に指で回すローラーの回転角 */
    rollerAngle: number;
  };

  elevator: { run: boolean; angle: number };

  orienter: {
    /** ガイドずれ 0=正常 .. 1=最大ずれ (fault: guide-shift) */
    guideOffset: number;
    /** 選別機内で待機中のピンid（null=なし） */
    busyPin: number | null;
  };

  rack: {
    /** slots[i] = 格納ピンid or null */
    slots: (number | null)[];
    /** 閉じたままのスロット (fault: rack-gate)。null=正常 */
    stuckGate: number | null;
    /** 各ゲートの開き 0..1（描画用） */
    gateOpen: number[];
  };

  table: {
    /** 0=上(待機) .. 1=レーン面 */
    y: number;
    phase: 'up' | 'descending' | 'placing' | 'rising';
    holding: number[];      // 保持中ピンid
  };

  ballReturn: {
    flap: number;           // 0=閉 .. 1=開
    flapStuck: boolean;
  };

  sweep: { pos: number; phase: 'idle' | 'sweeping' | 'returning' };

  pins: Pin[];
  ball: Ball;
  faults: FaultInstance[];
}

// ── ゲーム進行 ──────────────────────────────────────────────────────
export type FlowStep =
  | 'title'
  | 'bowl'          // 1. ボールを転がす
  | 'breakdown'     // 異常音、機械停止
  | 'approach'      // 2. 奥へ近づく
  | 'power-off'     // 3a. 整備士が主電源停止
  | 'safety-lock'   // 3b. 安全レバーを下へ
  | 'open-door'     // 4. 扉をパカッ
  | 'find-fault'    // 5. 故障発見
  | 'fix'           // 6/7. 修理（アクティブな故障を全て）
  | 'close-cover'   // 8a. カバーを閉め試運転モード
  | 'orient-pins'   // 8b. くるん
  | 'rack-fill'     // 9. 10本ラック
  | 'table-drop'    // 10. ストン
  | 'ball-return'   // 11. ボールリターン
  | 'unlock'        // 12a. ロック解除・全部閉じる
  | 'full-run'      // 12b. 完全試運転（ストライク）
  | 'celebrate'
  | 'replay-menu'   // 13. 再プレイ選択
  | 'free-play';

export interface Progress {
  clearedOnce: boolean;
  playCount: number;
  freePlayUnlocked: boolean;
  decoration: 'classic' | 'pink' | 'rainbow' | 'flower';
  muted: boolean;
}

// ── 音 ──────────────────────────────────────────────────────────────
export type SfxId =
  | 'roll'          // ボールのゴロゴロ（レーン）
  | 'pins-crash'    // ピンが倒れる乾いた音
  | 'garagara'      // ピンがピット/ベルトへ落ちるガラガラ
  | 'belt-hum'      // ベルト駆動低音（loop）
  | 'koto'          // ピン同士がコトコト
  | 'kurun'         // ピンがくるんと起きる
  | 'koron'         // ころん（横→縦の途中音）
  | 'kachi'         // ラックに1本入るカチッ
  | 'gakon'         // 安全ロックのガコン
  | 'paka'          // 扉が開くパカッ
  | 'pachin'        // ベルトが溝に入るパチン
  | 'table-down'    // ピンテーブル降下の機械音
  | 'ston'          // ピンを置くストン
  | 'roll-under'    // 地下のゴロゴロ（こもった音）
  | 'pon'           // ボール返却のポン
  | 'whirr'         // 機械のウィーン
  | 'sputter'       // プスン（故障音）
  | 'gata'          // ガタッ（異常音）
  | 'chime'         // 成功のやわらかいチャイム
  | 'stars'         // ストライク時の星
  | 'tap';          // UIタップ

export type VoiceId =
  | 'look-back'     // 「おくを、みてみよう」
  | 'lock-ok'       // 「ロック、よし！」
  | 'stuck'         // 「つまっているね」
  | 'kurun'         // 「くるん！」
  | 'ten-ready'     // 「10ほん、そろった！」
  | 'ston'          // 「ストン！」
  | 'ball-back';    // 「ボールが、もどってきた！」

// ── 入力 ────────────────────────────────────────────────────────────
export interface PointerInfo {
  /** ワールド(machine-space)座標 */
  x: number; y: number;
  /** 画面CSSピクセル座標 */
  sx: number; sy: number;
  /** 前フレームからの移動量（ワールド） */
  dx: number; dy: number;
  /** down時のワールド座標 */
  downX: number; downY: number;
  /** down からの経過秒 */
  heldTime: number;
}

// ── 演出ヒント（flowが書き、rendererが読む共有オブジェクト） ────────────
export interface RenderHints {
  /** 誘導スポットライト（故障発見の自然な誘導）。null=なし */
  spotlight: { x: number; y: number; r: number; strength: number } | null;
  /** 整備ロボットの位置と仕草（ワールド座標） */
  robot: { x: number; y: number; pose: 'idle' | 'point' | 'work' | 'happy'; lookX: number; lookY: number; visible: boolean };
  /** 控えめな誘導矢印/ジェスチャーガイド。dir=ラジアン */
  gesture: { x: number; y: number; dir: number; kind: 'swipe' | 'drag' | 'circle' | 'tap' } | null;
  /** お祝い演出の強さ 0..1 */
  celebrate: number;
}

export function createDefaultHints(): RenderHints {
  return {
    spotlight: null,
    robot: { x: 0, y: 0, pose: 'idle', lookX: 0, lookY: 0, visible: false },
    gesture: null,
    celebrate: 0,
  };
}

export interface Interactable {
  id: string;
  /** どのシーンで有効か。'ui' は画面座標系で最優先処理 */
  scene: SceneId | 'ui';
  /** falseなら無視される */
  enabled: () => boolean;
  /** 当たり判定。scene==='ui' のときは画面座標、それ以外はワールド座標で呼ばれる。
      4歳児向けに実体より大きめ(半径60ワールド単位/画面44px以上)にすること */
  hit: (x: number, y: number) => boolean;
  onDown?: (p: PointerInfo) => void;
  onMove?: (p: PointerInfo) => void;
  onUp?: (p: PointerInfo) => void;
  /** 大きいほど優先。既定0 */
  priority?: number;
}
