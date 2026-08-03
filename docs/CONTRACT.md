# パカッ！ぐるん！エスカレーターひみつ整備室 — 設計契約書 (CONTRACT)

全サブエージェント必読。**ここに定義された型・ファイル所有権・イベント名は変更禁止。**
変更が必要だと思ったら、変更せずに最終レポートで提案すること。

## プロダクト概要
iPhone/iPad の モバイルSafari で遊ぶ、4歳女児向けエスカレーター整備ゲーム。
床板を「パカッ」と開けると、ステップ・チェーン・ローラー・歯車・手すりベルトが
巨大な輪になって循環する秘密の内部世界が現れるのが最大の魅力。
文字説明なしで遊べること。制限時間・ゲームオーバーなし。誤操作で行き詰まらない。

擬音5大看板動作（すべて気持ちよく）:
- ピタッ: 停止スイッチ+安全ロック
- パカッ: 床板を開ける
- スポン: ステップ1段を引き抜く
- ぐるん: 手回しホイールで内部循環
- スーッ: 修理後の滑らか試運転

作業者は親しみやすい整備ロボット（子どもは機械に入らない）。

## 技術スタック
- Vite + TypeScript (strict)、フレームワークなし、ESM
- 描画: Canvas 2D 単一キャンバス（`#game`）、DPR対応
- HUD: DOM オーバーレイ `#hud`（アイコンボタンのみ、テキストなし）
- 音: WebAudio 全合成（音声ファイル不使用）。初回タッチで unlock
- 外部アセット・外部ネットワーク一切なし。静的デプロイ可能 (`base: './'`)

## ファイル所有権（自分の担当以外は import のみ可、編集禁止）
| パス | 所有 |
|---|---|
| index.html, vite.config.ts, tsconfig.json, package.json, src/main.ts, src/core/* | A1 scaffold（凍結。A7統合のみ修正可） |
| src/sim/escalator.ts, src/render/scene.ts | A2 sim/render |
| src/input/* | A3 input |
| src/audio/* | A4 audio |
| src/game/*, src/sim/faults.ts | A5 flow |
| src/render/mechanic.ts, src/render/effects.ts, src/ui/* | A6 character/ui |

## コア型 (src/core/types.ts — A1が実装、全員これに従う)

```ts
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
```

## イベントバス (src/core/events.ts — A1実装)

```ts
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
export const bus: {
  on<K extends keyof EventMap>(k: K, fn: (e: EventMap[K]) => void): () => void;
  emit<K extends keyof EventMap>(k: K, e: EventMap[K]): void;
};
```

## カメラ/レイアウト (src/core/layout.ts — A1実装)

```ts
export interface Camera { cx: number; cy: number; scale: number; } // ワールド中心+倍率
export const layout: {
  w: number; h: number; dpr: number;          // CSSピクセル
  portrait: boolean;
  camera: Camera;                              // A5が目標を設定、A1がスムーズ追従
  setCameraTarget(cx: number, cy: number, scale: number): void;
  snapCamera(): void;                          // 即時反映(回転時)
  worldToScreen(x: number, y: number): { x: number; y: number };
  screenToWorld(x: number, y: number): { x: number; y: number };
};
```

- 縦画面: 対象1つを大きく表示（カメラズーム強め）。片手・下半分操作優先
- 横画面: 側面断面全体（輪の全景）が入る倍率
- 回転時: state はそのまま、カメラだけ組み直す（A5の `layoutChanged()` が再設定）

## ワールド座標系
- エスカレーターローカル座標: 下端乗り口の床レベル原点 (0,0)、x+ が上りの水平方向、y- が上
- 傾斜 30°、水平投影長 520、階高 300、ステップ奥行 40
- `pathPoint(t)`: t=0 下端で上面に出る点 → incline を上る → topTurn → return(裏側、逆さま) → bottomTurn → t=1=0
- scene はワールド座標で全て描画し、layout.camera 変換は scene.render 冒頭で ctx に適用する
- HUD(A6) はスクリーン座標の DOM。ゲーム内ホットスポットはワールド座標

## メインループ (src/main.ts — A1実装)
```
update順: input.update(dt) → flow.update(dt, state) → state.escalator.update(dt)
          → fault.modelEffect(model) → effects.update(dt) → audio.update(dt, state)
render順: scene.render(ctx, state)   // 背景+機械+fault.render+mechanic+effects を内部で呼ぶ
          hud は DOM なので renderループ外, hud.sync(state) を毎フレーム呼ぶ
```

## 各モジュール公開API

```ts
// src/input/gestures.ts (A3)
export const input: {
  attach(canvas: HTMLCanvasElement): void;
  setHotspots(h: Hotspot[]): void;   // フェーズ毎にA5が差し替え
  update(dt: number): void;          // idleSeconds加算などはA5側でもよい
  dragVisual(): { id: string; x: number; y: number } | null; // drag中の追従表示用
};
// 寛容性: タップ半径はr、swipeは方向±60°、traceは経路から60px許容、
// dragはdropR内でなくても最近接dropへ磁石吸着(150px以内)。crankは円中心ズレ大目に見る

// src/audio/engine.ts (A4)
export const audio: {
  init(): void;                       // 初回ユーザー操作で呼ぶ
  update(dt: number, state: GameState): void;
  setVolume(v: number): void;
};

// src/sim/escalator.ts (A2)
export function createEscalator(): EscalatorModel;

// src/render/scene.ts (A2)
export const scene: {
  render(ctx: CanvasRenderingContext2D, state: GameState): void;
};

// src/game/flow.ts (A5)
export const flow: {
  start(state: GameState): void;
  update(dt: number, state: GameState): void;
  layoutChanged(state: GameState): void;   // 回転時にカメラ再設定
};

// src/sim/faults.ts (A5)
export function createFault(kind: FaultKind, model: EscalatorModel): FaultInstance;
export const FAULT_KINDS: FaultKind[];

// src/render/mechanic.ts (A6)
export const mechanic: {
  update(dt: number, state: GameState): void;
  render(ctx: CanvasRenderingContext2D, state: GameState): void;
  pointAt(x: number, y: number): void;  // hint時: 視線+指差し
};

// src/render/effects.ts (A6)
export const effects: {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, state: GameState): void;
  burst(x: number, y: number, kind: 'spark' | 'star' | 'confetti' | 'dust' | 'shine'): void;
  glowAt(x: number, y: number): void;      // hint点滅光
  clearGlow(): void;
};

// src/ui/hud.ts (A6)
export const hud: {
  init(state: GameState): void;
  sync(state: GameState): void;
};
```

## ゲームフロー詳細（A5が実装、他は参照）
1. **notice**: 異常loop音+外観で微振動。ビックリマーク💥タップ → ロボ登場
2. **safety**: 柵をドラッグ(磁石)→ 大きな赤スイッチをタップ「ピタッ」停止 → 鍵アイコンをタップ「カチッ」ロック
3. **openPlate**: 取っ手を上スワイプ →「パカッ」内部から光が漏れ、view=cutawayへズーム
4. **removeStep**: ハンドルをタップ装着 → 上スワイプで「スポン」ステップが抜けオーバーシュート
5. **inspect**: view=inside。故障箇所は微振動+うっすら発光+音のパン。タップで特定
6. **repair**: 故障別ジェスチャー
   - roller: 古ローラーをドラッグで外す(pop)→新ローラーを工具箱からドラッグ(磁石+snap)
   - chainGuide: ずれたガイドを正位置へドラッグ(snap+kachi)
   - handrail: 太い経路をなぞってベルトをローラーに掛ける(trace)
   - sensor: rub(こすり)でほこり除去→ライト点灯(sparkle)
7. **crankCheck**: 大きな手回しホイールに円ジェスチャー(crank)→輪全体が「ぐるん」連動。累計2π以上+異音消滅で次へ
8. **restoreStep**: ステップを隙間へドラッグ(磁石)「カチッ」
9. **closePlate**: 下スワイプ「パタン」。柵は自動でロボが回収(工具も)
10. **testRun**: 🐢タップ→低速「スーッ」→🐇タップ→通常運転。修理前後の音の差を明確に
11. **celebrate**: 紙吹雪+ファンファーレ → **select**: ３つの大アイコン(もう一回/別のエスカレーター/自由観察)

- 数秒(4s)迷ったら: bus.emit('hint',{x,y}) → ロボの視線・指差し+点検灯グロー+音パン。文字は出さない
- freeObserve: 停止済み内部でクランク回し放題+透視(ステップ半透明)。戻るボタンでselectへ
- stepPlay: openPlate済み状態でステップを抜く/戻すを繰り返すだけの遊び

## ビジュアル指針（A2/A6）
- 上質な玩具+科学館の断面模型。金属/ゴム/樹脂の質感（グラデ+ハイライト）。角丸多用
- 機械はメタル系の色を維持。ピンク/虹/星/花は 工具箱・ロボのつなぎ・手すり・柵・点検灯 に使う
- ロケーション: 0=モール(ピーチ/クリーム) 1=駅(ブルー/グレー) 2=水族館(アクア/深青+魚影)
- 表と裏のステップが1本の輪であることを断面で常時見せる。returnセグメントのステップは逆さま描画
- reducedMotion時: 振動・紙吹雪・カメラ揺れを大幅減

## 品質基準
- 60fps目標(iPhone)。ctx.save/restore節約、offscreen事前描画可
- `npm run build` (tsc && vite build) が常に通ること
- タッチターゲット最小 72px 相当。同時に主対象は1つ
- どのフェーズでも無操作+誤タップで進行不能にならない
