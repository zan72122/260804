# アーキテクチャ契約書（全サブエージェント必読）

「ガコン！くるん！レーンのうらがわ工場」— 4歳児向け・ピンセッター整備ゲーム。
Vite + TypeScript + **Canvas 2D 単一キャンバス**。外部ランタイム依存なし（音はWebAudio合成、絵は全てベクター描画）。

## 絶対ルール

1. **自分の所有ファイル以外を編集しない**（読むのは自由）。
2. `src/core/types.ts` / `src/core/events.ts` / `src/core/geometry.ts` は**編集禁止**。不足があれば最終レポートに「契約逸脱要望」として書く。
3. npm パッケージを追加しない。DOM要素を追加しない（描画は全てcanvas）。
4. 絵文字を絵の代用にしない。仮素材を残さない。TypeScript strict でエラーなし（自分のファイル分）。
5. git commit しない（オーケストレーターが行う）。
6. 他モジュールがまだ存在しなくてもよい。**下記の契約シグネチャを信じて import して書く**。全体の typecheck は統合ウェーブで通す。

## セクション所有権

| モジュール | 所有パス | 担当 |
|---|---|---|
| core     | `src/core/loop.ts, layout.ts, camera.ts, input.ts, save.ts` | ループ/レイアウト/カメラ/入力/保存 |
| sim      | `src/sim/**` | 機械シミュレーション・故障・機械側インタラクション |
| render-machine | `src/render/machine/**` | 機械カットモデル描画 |
| render-lane    | `src/render/sprites.ts, src/render/lane/**` | スプライト(ピン/ボール/ロボ)・レーン正面シーン・パーティクル |
| flow     | `src/flow/**, src/main.ts` | 進行ステートマシン・演出指揮・配線 |
| audio    | `src/audio/**` | WebAudio効果音合成・音声 |
| ui       | `src/ui/**` | 画面座標系オーバーレイUI |

## データフロー（フック機構）

- **単一の真実**: `MachineState`（types.ts）。**simだけが書く**。rendererは読むだけ。
- **イベント**: `bus`（events.ts）。sim→`sfx`/`rack:slot`等を発火、audio/flowが購読。flowは`flow`イベントで遷移を通知。
- **演出ヒント**: `RenderHints`（types.ts）。flowが書き、rendererが読む。
- **入力**: core の InputSystem に各所有者が `Interactable` を登録。**flowが `setAllowed(ids)` でステップごとに有効化**。

## 各モジュールの公開API（この通りに export すること）

### core
```ts
// src/core/loop.ts
export function startLoop(update: (dt: number) => void, render: (time: number) => void): void;
// dtは秒、0.05でクランプ。document hidden時は停止し復帰後に巨大dtを出さない。

// src/core/layout.ts
export class LayoutManager {
  constructor(canvas: HTMLCanvasElement);
  readonly layout: Layout;                  // 常に最新
  onChange(fn: (l: Layout) => void): void;  // 回転/リサイズ時
}
// safe area は env(safe-area-inset-*) をプローブ要素で読む。dprに応じcanvasバッファサイズ設定。

// src/core/camera.ts
export class CameraController {
  camera: Camera;                     // {x,y,zoom} ワールド座標中心とズーム
  focus(x: number, y: number, zoom: number, lerp?: number): void; // lerp省略=0.08追従
  snap(x: number, y: number, zoom: number): void;
  update(dt: number): void;           // 追従・シェイク減衰。bus 'camera:focus'/'camera:shake' を購読
  applyTransform(ctx: CanvasRenderingContext2D, layout: Layout): void;
  screenToWorld(sx: number, sy: number, layout: Layout): { x: number; y: number };
  /** ワールド矩形が収まるようfocusを計算するヘルパ */
  fitRect(x: number, y: number, w: number, h: number, layout: Layout, margin?: number): { x: number; y: number; zoom: number };
}

// src/core/input.ts
export class InputSystem {
  constructor(canvas: HTMLCanvasElement, cam: CameraController, lm: LayoutManager, getScene: () => SceneId);
  register(i: Interactable): () => void;
  setAllowed(ids: string[] | 'all'): void;  // enabled()に加えてこのゲートも通す
}
// 単一ポインタ。pointerdown/move/up。'ui'シーンのInteractableは画面座標で最優先判定。
// ヒットしなくても最も近い有効Interactableが半径90ワールド単位以内なら許容（幼児向け寛容判定）。

// src/core/save.ts
export function loadProgress(): Progress;
export function saveProgress(p: Progress): void;  // localStorage 'pin-factory-v1'
```

### sim
```ts
// src/sim/index.ts
export class MachineSim {
  constructor();
  readonly state: MachineState;
  update(dt: number): void;                    // simSpeed適用済み
  reset(): void;                               // レーンに10本直立、ボールはrack
  bowl(dirX: number, power: number): void;     // レーンシーンの投球（補助込み、初回はほぼ全倒）
  startBreakdown(faults: FaultId[]): void;     // 倒れたピンをピットへ送り、途中で故障停止
  setPower(on: boolean): void;
  setLocked(v: boolean): void;
  startTestFeed(): void;                       // 試運転: ピットのピンを1本ずつ流す
  dropTable(): void;                           // table-drop シーケンス開始
  startFullRun(): void;                        // 完全試運転（ストライク→全機構連続動作）
  setFreePlay(v: boolean): void;
  registerInteractables(input: InputSystem): void;  // 下記ID一覧を全て登録
}
```
発火するイベント: `sfx`, `fault:fixed`, `pin:freed`, `pin:oriented`, `rack:slot`, `rack:full`,
`table:placed`, `ball:returned`, `pins:down`, `strike`, `camera:shake`。

### render-machine
```ts
// src/render/machine/index.ts
export function drawMachineScene(
  ctx: CanvasRenderingContext2D, cam: CameraController, state: MachineState,
  layout: Layout, hints: RenderHints, time: number,
): void;
```
背景→ハウジング→機構（geometry.ts の座標に厳密整合）→ピン(sprites.drawPin)→ボール→扉/カバー→ロボット(sprites.drawRobot)→スポットライト/ジェスチャーガイド。

### render-lane
```ts
// src/render/sprites.ts
export function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number,
  rot: number, scale: number, opts?: { ring?: string; shadow?: boolean; glow?: number }): void;
export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number,
  r: number, rot: number, color: string): void;
export function drawRobot(ctx: CanvasRenderingContext2D, x: number, y: number,
  scale: number, pose: 'idle' | 'point' | 'work' | 'happy', time: number,
  lookX?: number, lookY?: number): void;
export function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number,
  power: number, time: number): void;

// src/render/lane/index.ts
export function drawLaneScene(
  ctx: CanvasRenderingContext2D, cam: CameraController, state: MachineState,
  layout: Layout, hints: RenderHints, time: number,
): void;
```
レーンシーンのワールドは `LANE_VIEW`（1000x1600, 縦長, 疑似奥行き正面ビュー）。
ピンのlaneシーン内の見た目座標は `state.pins`（zone 'lane'/'placed'）から`LANE_VIEW`規約で算出
（sim は lane 系ピンの x,y を LANE_VIEW 座標で保持する。machine系ゾーンは machine-space）。

### flow
```ts
// src/flow/index.ts
export class GameFlow {
  constructor(deps: {
    sim: MachineSim; cam: CameraController; input: InputSystem;
    ui: UIOverlay; lm: LayoutManager;
  });
  readonly step: FlowStep;
  readonly scene: SceneId;
  readonly hints: RenderHints;
  update(dt: number, time: number): void;
}
// src/main.ts が全モジュールを生成・配線し startLoop する。
```
flowの責務: ステップ遷移、`input.setAllowed`、カメラ演出（縦横で構図を変える。
portrait=注目機構1〜2個へズーム+上下追従 / landscape=fitRectで全体俯瞰）、
ヒントタイマー（3〜5秒で spotlight/gesture）、初回=固定故障 `['pin-jam','belt-derail']`
+ 11番でflap-stuck、2周目以降=5種からランダム1つ、進行保存。

### audio
```ts
// src/audio/index.ts
export function initAudio(): void;  // busを購読。初回gestureでAudioContext resume
export function setMuted(v: boolean): void;
export function isMuted(): boolean;
```
全SfxIdをWebAudioで合成（オシレーター+ノイズ+フィルタ）。`belt-hum`/`roll`はループで`sfx:stop`対応。
VoiceIdは短い2音チャイム+構造だけ用意（後から音声ファイル差替え可能なマップ）。

### ui
```ts
// src/ui/index.ts
export type UIAction =
  | 'start' | 'replay-same' | 'replay-new' | 'free-play' | 'go-bowling'
  | 'toggle-xray' | 'cycle-speed' | 'toggle-mute' | 'cycle-decor' | 'exit-free';
export class UIOverlay {
  constructor(lm: LayoutManager);
  mode: 'none' | 'title' | 'replay' | 'freeplay' | 'hud';
  show(mode: UIOverlay['mode']): void;
  onAction: (a: UIAction) => void;   // flowが代入
  register(input: InputSystem): void; // scene:'ui' で登録
  draw(ctx: CanvasRenderingContext2D, layout: Layout, time: number): void; // 画面座標系（ctx変換なし）
}
```
文字最小限・大きな絵ボタン（canvasで工具/ピン/ボール等を描く。絵文字禁止）。
replayメニューは「同じ詰まりをもう一度」を最大・最上位置に。safe area尊重。

## Interactable ID 正準リスト（sim/ui/flowで一致させること）

| id | scene | 操作 | 効果 |
|---|---|---|---|
| `ball-swipe` | lane | 上へスワイプ | 投球 |
| `approach` | lane | 奥へスワイプ or 奥をタップ | 機械シーンへ |
| `safety-lever` | machine | レバーを下へドラッグ | ロック「ガコン」 |
| `door-handle` | machine | 取っ手を横へドラッグ | 扉「パカッ」 |
| `stuck-pin` | machine | 詰まりピンをドラッグ | 救出（磁石吸着） |
| `belt-trace` | machine | ベルトをなぞる | ベルト復帰「パチン」 |
| `roller-spin` | machine | ローラーを円でなぞる | 動作確認 |
| `orient-swipe` | machine | 選別機のピンをスワイプ | くるん |
| `guide-fix` | machine | ガイドをドラッグ | guide-shift修理 |
| `rack-gate` | machine | ゲートをタップ/上スワイプ | rack-gate修理 |
| `table-lever` | machine | レバーを下へドラッグ | テーブル降下 |
| `flap` | machine | フラップを上へスワイプ | flap-stuck修理・ボール通過 |
| `cover-close` | machine | カバー/扉を戻すスワイプ | 試運転モードへ |
| `free-drop` | machine | ピットをタップ | (自由遊び)ピン追加 |

## 品質基準（全員）

- 対象4歳: 判定は寛容、失敗なし、誤操作で壊れない、文字に頼らない。
- 見た目: 上質な機械玩具/ドールハウス。白いピンが暗めの機械内でよく見える。木目レーン・金属・ゴムベルト質感。装飾はピンク/虹/花を**差し色**で。
- 60fps目標: 毎フレームのオブジェクト生成を抑える。グラデーションはキャッシュ可。
- 縦横両対応: layout.orientation で構図を変える（拡大縮小だけにしない）。
