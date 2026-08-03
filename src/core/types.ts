// src/core/types.ts (A1 scaffold — 凍結。CONTRACT.md の型定義と完全一致させること)

export type GamePhase =
  | 'title'        // タイトル/アトラクト
  | 'notice'       // 異常音に気付く
  | 'safety'       // 柵設置→停止スイッチ→ロック
  | 'openPlate'    // 床板を開ける
  | 'removeStep'   // ハンドル装着→ステップ引き抜き
  | 'inspect'      // 内部断面で故障探し
  | 'repair'       // 一指修理
  | 'crankCheck'   // 手回しで確認
  | 'restoreStep'  // ステップ戻し
  | 'closePlate'   // 床板復旧(+柵撤去)
  | 'testRun'      // 低速→通常試運転
  | 'celebrate'    // お祝い
  | 'select';      // 次を選ぶ

export type GameMode = 'play' | 'freeObserve' | 'stepPlay';
// freeObserve: 内部自由観察（クランク回し放題・透視）
// stepPlay: ステップ着脱遊び（抜いて戻すだけを繰り返す）

export type ViewMode = 'exterior' | 'cutaway' | 'inside';
// exterior: 外観。cutaway: 側面断面(輪全体)。inside: 内部ズーム

export type FaultKind = 'roller' | 'chainGuide' | 'handrail' | 'sensor';

export type SfxName =
  | 'pita' | 'paka' | 'spon' | 'gurun' | 'suu'
  | 'kachi' | 'snap' | 'click' | 'pop' | 'wipe'
  | 'sparkle' | 'fanfare' | 'tada' | 'uiTap' | 'magnet';

export type LoopName =
  | 'kotokoto'   // ローラー不良: コトコト
  | 'kachikachi' // チェーンガイドずれ: カチカチ
  | 'zuruzuru'   // 手すりベルト外れ: ズルズル/キュルキュル
  | 'jiji'       // センサー汚れ: ジジ...(+ピーピー警告)
  | 'runNormal'  // 正常運転音（滑らか）
  | 'runSlow'    // 低速試運転音
  | 'runBroken'; // 故障中の総合ガタガタ音

export interface PathPoint {
  x: number; y: number;        // エスカレーターローカル座標(px相当)
  angle: number;               // 進行方向角(rad)
  segment: 'incline' | 'topTurn' | 'return' | 'bottomTurn';
}

export interface EscalatorModel {
  loopT: number;               // 0..1 チェーン位相
  speed: number;               // loopT/sec。正=上り
  targetSpeed: number;
  stepCount: number;           // 輪上のステップ数 (例: 14)
  removedStep: number | null;  // 抜かれたステップ index
  wobbleAmp: number;           // 故障による振動振幅 0..1
  pathPoint(t: number): PathPoint;    // t: 0..1 閉ループ。0=下端乗り口
  stepT(i: number): number;           // ステップiの現在位相
  handrailPoint(t: number): PathPoint;// 手すりベルト経路
  update(dt: number): void;
  crank(delta: number): void;  // ユーザー手回し(rad)。loopTを進める
}

export interface Hotspot {
  id: string;
  kind: 'tap' | 'swipe' | 'drag' | 'crank' | 'trace' | 'rub';
  x: number; y: number; r: number;     // ワールド座標。rは寛容半径(大きく)
  dir?: 'up' | 'down' | 'left' | 'right'; // swipe用
  dropX?: number; dropY?: number; dropR?: number; // drag: 磁石吸着先
  path?: { x: number; y: number }[];   // trace: 太い経路
  sticky?: boolean;                    // drag中オブジェクト追従
}

export interface HotspotEvent {
  id: string;
  type: 'activated' | 'progress' | 'dragMove' | 'released';
  t?: number;                  // progress 0..1 (trace/rub/crank蓄積)
  x: number; y: number;        // ワールド座標
  delta?: number;              // crank: 今回の回転量(rad, 正=時計回り)
}

export interface FaultInstance {
  kind: FaultKind;
  anomalyLoop: LoopName;
  anchorT: number;             // ループ上の故障位置 0..1
  fixed: boolean;
  progress: number;            // 0..1
  hotspots(state: GameState): Hotspot[];
  onHotspot(ev: HotspotEvent, state: GameState): void;
  render(ctx: CanvasRenderingContext2D, state: GameState): void; // 壊れ部品の描画(inside/cutaway時)
  modelEffect(model: EscalatorModel): void; // wobbleAmp等を毎フレーム適用
}

export interface Settings {
  volume: number;              // 0..1
  reducedMotion: boolean;
}

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  view: ViewMode;
  location: 0 | 1 | 2;         // 0:モール 1:駅 2:水族館
  escalator: EscalatorModel;
  fault: FaultInstance | null;
  settings: Settings;
  // 進行フラグ（画面回転しても保持される。layoutはここに書かない）
  fencePlaced: boolean;
  stopped: boolean;
  locked: boolean;
  plateOpen: number;           // 0..1
  handleAttached: boolean;
  stepRemoved: number;         // 0..1 引き抜きアニメ進度
  crankTotal: number;          // crankCheckで回した累計rad
  testRunStage: 0 | 1 | 2;     // 0:未 1:低速 2:通常
  idleSeconds: number;         // 現フェーズで無操作の秒数（ヒント用）
  time: number;                // 起動からの秒
}
