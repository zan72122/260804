# ちょきちょき きくのねりきり — 開発契約書 (CONTRACT)

対象: 4歳女児向け・iPhone/iPad ブラウザゲーム。丸い練り切りにチョキチョキ切り込みを入れると「はさみ菊」が咲く。

この文書は **全モジュールの唯一の契約**。ここに書かれた API・データ形状・イベント名を変更してはならない。
追加のプライベート関数・内部状態は自由。他人のファイルを編集してはならない。

## ファイル所有権（絶対厳守）

| ファイル | 所有者 | 内容 |
|---|---|---|
| `index.html` `js/config.js` `js/bus.js` `js/main.js` `CONTRACT.md` | ディレクター | 骨格・契約・起動ループ（変更禁止） |
| `js/core.js` | Agent-CORE | ゲーム状態機械・切断ロジック・回転・進行 |
| `js/render.js` | Agent-RENDER | Canvas2D 描画・カメラ・座標変換 |
| `js/input.js` | Agent-INPUT | 一指タッチ入力 → core 呼び出し |
| `js/fx.js` | Agent-FX | パーティクル演出 + WebAudio 効果音 |
| `js/ui.js` `css/style.css` | Agent-UI | DOM オーバーレイ UI（色選択・もういっかい） |

スクリプトは `<script>`（非 module）。各ファイルは `window.Nerikiri〇〇` にオブジェクトを1つ公開する。
外部ライブラリ・外部フォント・外部画像は禁止（全て手続き描画 / WebAudio 合成）。ES2019 相当まで。

## 読み込み順（index.html 固定）

`config.js → bus.js → core.js → render.js → fx.js → input.js → ui.js → main.js`

## 共有定数 — `window.NCFG`（config.js / ディレクター所有）

`NCFG.THEMES[]`, `NCFG.RINGS[]`, `NCFG.CENTER_TAPS`, `NCFG.TIMING`, `NCFG.ANCHOR_ANGLE` など。
数値・色は必ず NCFG から読むこと（ハードコード禁止）。中身は config.js を参照。

## イベントバス — `window.NBus`（bus.js / ディレクター所有）

```js
NBus.on(name, fn); NBus.off(name, fn); NBus.emit(name, payload);
```

### イベント一覧（emit 元 → 主な購読者）

| イベント | payload | emit 元 | 購読 |
|---|---|---|---|
| `cut:done` | `{ringIndex, slot, angle, radius}`(mochiローカル角) | core | fx, render(任意) |
| `cut:miss` | `{x, y}`(スクリーンpx) | core経由input | fx |
| `ring:complete` | `{ringIndex}` | core | fx |
| `center:press` | `{count, need}` | core | fx |
| `flower:complete` | `{}` | core | fx, ui |
| `phase:change` | `{phase}` | core | ui, fx |
| `replay` | `{themeIndex}` | ui | (coreはuiから直接reset呼び出し) |
| `audio:unlock` | `{}` | input(初回タッチ) | fx |

## 座標系（v2: 疑似3D 斜め3/4視点）

- **mochiローカル座標**: 練り切り中心が原点、練り切り基本半径 = 1.0 world unit。皿半径 ≈ 1.75。
- 角度はラジアン。ローカル極座標 (θ, r) はドーム面上の位置を表す論理座標であり、**core/input/ui はこの論理座標だけを扱う**。
- v2 から render は内部でドームをチルト角（約30〜40°）で投影する: リングは楕円に見え、奥(θ≈-π/2側)の花びらは小さく上方に、手前(θ≈+π/2側)は大きく下方に描かれる。投影の実装詳細は render 内部の自由だが、**`screenToLocal`/`localToScreen` は必ず互いの逆写像**であること（誤差 世界単位0.02以下）。
- `state.rotation` は投影前の θ に加算する（ドームが皿の上で回る）。皿と背景は回さない。
- 画面手前（下）方向 = `+π/2`。`NCFG.ANCHOR_ANGLE = Math.PI/2`（次に切るスロットが手前に来る）。

## クラスター彫り込み（v2）

- core のリング構成（外周10スロット・中段7スロット・中心3タップ）は**論理構造として不変**。
- render はスロット1つを「扇形クラスター」として描く: 外周スロット = 36°扇形に小花びら約8枚（3列段違い・鱗状スタッガ配置）、中段スロット = 約51°扇形に約5枚。中心タップは最内周の小花びら環の締まり→黄しべ+金箔粒。完成時の総花びら数 ≈ 115枚。
- `lift[slot]` はクラスター全体の進行度。render がクラスター内の各小花びらに 20〜40ms 相当の位相遅延を付け、シャシャッと連鎖して立ち上がる見せ方にする。

## ゲーム状態 — core が所有し毎フレーム更新。**render/fx は読み取り専用**

```js
game.state = {
  phase: 'play' | 'finishing' | 'reveal',  // finishing=完成演出中(入力無視)
  themeIndex: 0,
  time: 0,                      // 経過秒
  rotation: 0,                  // 現在の回転(ラジアン, アニメ済み値)
  rotationTarget: 0,
  activeRing: 0,                // 0=外周, 1=中段, 2=中心仕上げ
  rings: [                      // NCFG.RINGSから生成。ringIndex順=外→内
    { r: 0.78, n: 10, offset: 0,   cut: [bool×n], lift: [0..1×n] },
    { r: 0.46, n: 7,  offset: 0.3, cut: [bool×n], lift: [0..1×n] },
  ],
  center: { need: 3, count: 0, squish: 0 },   // squish 0..1 (押し込みアニメ)
  nextHint: { ringIndex, slot, angle, radius } | null,  // 次に切る場所(ローカル角)。centerステージ時は {ringIndex:2, slot:0, angle:0, radius:0}
  revealT: 0,                   // reveal遷移後に0→1へ増加(カメラ引き用)
}
```

- `lift[i]`: 切られた花びらが立ち上がるアニメ進行度。core が update で 0→1 へ（`NCFG.TIMING.liftSec`）。
- `rotation` は core の update 内でイージング（ばね係数 `NCFG.TIMING.rotEase`）。
- cut 後、core は「次の未カットスロットのワールド角が `ANCHOR_ANGLE` に来る」よう rotationTarget を設定（最短回転方向）。

## Core API — `window.NerikiriCore`（core.js）

```js
NerikiriCore.create() -> game            // NCFGから初期状態構築(テーマ0)
game.state                               // 上記形状
game.update(dt)                          // dt秒。lift/rotation/squish/revealT/nextHint更新、phase遷移
game.tapAt(localAngle, localRadius, screenX, screenY) -> bool
game.reset(themeIndex)                   // 全カット状態を初期化しphase='play'、themeIndex設定
```

### tapAt の仕様（失敗なし設計・最重要）
- `phase !== 'play'` → 無視して false。
- 連続カットのクールダウン: 前回カットから `NCFG.TIMING.cutCooldown` 秒未満 → 無視 false。
- `localRadius > 1.55`（皿の外・背景）→ `cut:miss` を emit（payload にスクリーン座標）→ false。
- activeRing が 0/1: アクティブリングの**未カットスロットのうち角度が最も近いもの**へ常にスナップしてカット成立（角度差の上限なし＝どこを触っても最寄りが切れる。失敗なし）。`cut[slot]=true`、`cut:done` emit、rotationTarget 更新。リング完了時 `ring:complete` → `activeRing++`。
- activeRing が 2（中心）: `localRadius < 0.9` なら `center.count++`、`center:press` emit、squish パルス。count==need で `flower:complete` emit → phase='finishing' → `NCFG.TIMING.finishSec` 秒後に phase='reveal'（`phase:change` emit）し revealT を増加開始。
- スロットのローカル角: `slotAngle = offset + slot * 2π/n`。

## Render API — `window.NerikiriRender`（render.js）

```js
NerikiriRender.init(canvas)              // 2d context取得。resizeはmainが呼ぶ
NerikiriRender.resize(wCss, hCss, dpr)   // canvas実解像度/変換を設定
NerikiriRender.render(state, dt)         // 背景〜練り切り〜ガイドまで全描画(1フレーム毎回全描き)
NerikiriRender.screenToLocal(px, py) -> {angle, radius}   // CSSピクセル→mochiローカル(rotation差引済み)
NerikiriRender.localToScreen(angle, radius) -> {x, y}     // ローカル→CSSピクセル
NerikiriRender.getView() -> {cx, cy, scale, rotation}     // 現在のビュー(CSSピクセル)
```

- カメラは render 内部所有。`state.activeRing`/`phase`/`revealT` からズーム目標を導出しイージング:
  外周 1.0 / 中段 1.12 / 中心 1.24 / reveal 0.82（`NCFG.CAMERA` 参照）。中心位置は画面中央よりやや上（下部は手元スペース）。
- 描画内容(v2): 和紙風背景(温かい照明感+ビネット) → 黒い漆皿(艶・花の映り込み風グロー・接地影) → 練り切りドーム(未カット部は白〜クリーム地のやわらかマット面) → **彫り込み小花びら**(クラスター単位で立ち上がる。1枚ごとに彫りのV字陰影=受光面/影面+根元の落ち影。地色は白〜クリーム、先端にテーマ色の「ぼかし」グラデ。サイズ/角度に手作業風の微ジッタ。奥→手前ソートで層の重なり表現。スプライト事前描画で60fps維持) → 中心(しべ: squish で締まり、完成で黄しべ+金箔風の粒) → `state.nextHint` があれば**次に切る位置ガイド**(パルスする✂マーク+きらめき。文字禁止)。
- reveal 時: 花全体が映える引き画・花びら層が判るよう僅かな呼吸アニメ。
- 目標: 60fps(最低40)。iPhone想定でグラデ/シャドウの多用は控えオフスクリーンキャッシュ可。

## Input — `window.NerikiriInput`（input.js）

```js
NerikiriInput.init(canvas, game)
```

- Pointer Events で一指のみ（2本目は無視）。`touch-action:none` 前提。スクロール/ダブルタップズーム抑止。
- 初回 pointerdown で `NBus.emit('audio:unlock')`（一度だけ）。
- tap: pointerdown 時に `NerikiriRender.screenToLocal` で変換し `game.tapAt(angle, radius, x, y)`。
- drag: pointermove 中、前回カット地点から **28px(CSS)** 以上動くたびに再度 tapAt（連続チョキ）。クールダウンは core 側が握るので input は距離間引きのみ。
- クリック(マウス)でも同様に動くこと（PC デバッグ用）。

## FX — `window.NerikiriFX`（fx.js）

```js
NerikiriFX.init()          // NBus購読を張る
NerikiriFX.update(dt)
NerikiriFX.render(ctx, view)   // renderの後、同一canvasへ上描き。view=NerikiriRender.getView()
```

- パーティクル: `cut:done`→切り位置(`NerikiriRender.localToScreen`で算出)に紙吹雪風の小片+きらめき数個 / `ring:complete`→リング一周のきらめき / `center:press`→ぽふっ / `flower:complete`→大きな祝福(花びら紙吹雪+星, 2秒) / `cut:miss`→触った場所に小さな「ぽわ」(ネガティブ表現禁止)。
- WebAudio(合成のみ): `audio:unlock` で AudioContext 生成/resume。音: チョキ(短いシャキッ2連クリック+ノイズ) / miss(やわらかいぽよん) / ring:complete(明るい3音アルペジオ) / center:press(ぽん) / flower:complete(キラキラ和風ペンタトニック上昇+チャイム)。音量控えめ(master gain 0.35)。AudioContext未解放でも例外を出さないこと。

## UI — `window.NerikiriUI`（ui.js + css/style.css）

```js
NerikiriUI.init(game)
```

- `#ui-root` 配下に DOM 構築。**文字は最小**（ボタンは絵文字/図形。「もういっかい」は ↻ アイコン円ボタン）。
- play 中: UI なし（画面はゲームのみ）。
- `phase:change {phase:'reveal'}` 受信後 約1.2秒してから下部に登場: **色ちがいボタン**（NCFG.THEMES の丸いキャンディ型スウォッチ、現テーマに印）+ **↻ボタン**。タップで `game.reset(選択themeIndex)` を直接呼び、`NBus.emit('replay',{themeIndex})`、UI を隠す。
- 縦横両対応: safe-area-inset 考慮 (`env(safe-area-inset-*)`)、`orientation` どちらでもボタンが押しやすい配置(最小44px)。ボタンはふんわり pop-in アニメ。
- css/style.css には UI 分のみ書く（body/canvas の基本スタイルは index.html にインライン済み。上書き禁止）。

## メインループ（main.js / ディレクター所有・参考）

```js
game.update(dt);
NerikiriRender.render(game.state, dt);
NerikiriFX.update(dt);
NerikiriFX.render(ctx, NerikiriRender.getView());
```

resize は main が監視し `NerikiriRender.resize` を呼ぶ。dpr は min(devicePixelRatio, 2)。

## 品質基準（全員）

- 4歳児が文字なしで理解できる。失敗・ゲームオーバー・時間制限なし。
- 切った瞬間 100ms 以内に視覚+音の応答。
- 例外を投げてループを止めない（防御的に）。`console.error` は可。
- 依存: 他モジュールは上記公開 API のみ。読み込み時点で他モジュール未初期化でも壊れないよう、参照は関数実行時に行う。
