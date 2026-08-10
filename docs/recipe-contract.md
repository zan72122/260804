# レシピ拡張 契約書 v1（全subagent必読・厳守）

3つのレシピ（dome=既存ドームケーキ / glaze=鏡のケーキ / brulee=あぶってパリン！）を
1つのゲームに載せる。タイトル画面でレシピを選び、選ばれたレシピだけが初期化される。
「もういちど」は location.reload()（dispose不要）。

## 1. ファイル所有権（絶対厳守 — 自分の所有外ファイルは編集禁止）

| ファイル | 所有者 |
|---|---|
| `main.js`（コア化）, `index.html`, `src/audio.js`, `src/recipes/dome.js`(新規) | A1 |
| `src/recipes/glaze.js`(新規, 必要なら `src/recipes/glazeObjects.js`) | A2 |
| `src/recipes/brulee.js`(新規, 必要なら `src/recipes/bruleeObjects.js`) | A3 |
| `src/cake.js`, `src/env.js`, `src/util.js`, `vendor/` | 全員 read-only |
| `test/*` | Wave2のA4（A1のみ「レシピ選択タップ追加」の最小修正可） |

`src/main.js` は Wave1 中 A1 が全面改修する。A2/A3 は main.js の現状に依存せず、
本契約の ctx API のみに依存してコードを書くこと。

## 2. レシピモジュール契約

各レシピは `src/recipes/<id>.js` で以下を export:

```js
export const meta = { id: 'glaze', title: 'かがみのケーキ', emoji: '🪞' };
export function createRecipe(ctx) {
  const state = { phase: 'MOUSSE', /* 下記§5の必須フィールド */ };
  ctx.registerState(state);
  return {
    start() {},             // レシピ選択直後に1回呼ばれる（シーン構築はここでもmodule初期化でも可）
    update(dt, hdt, t) {},  // 毎フレーム。dt=min(raw,0.05)見た目用 / hdt=min(raw,0.25)進捗・トゥイーン用 / t=経過秒
  };
}
```

three.js は `import * as THREE from '../../vendor/three.module.js'`、
共有部品は `../cake.js`（createStream, createSteam, createSparkles, createConfetti,
createDecoration, createFlame, createCakeStand等）と `../util.js`（tween, ease, clamp, lerp,
canvasTexture, glowTexture）から import してよい（read-only）。
トゥイーンは util.js の tween() を使う（コアが updateTweens を回す）。

## 3. ctx API（A1が main.js に実装。シグネチャ厳守）

```js
ctx = {
  scene, camera, renderer,                    // three実体
  camPhase(posArr, lookArr),                  // 目標カメラ設定（縦画面は自動で1.4x引き）。posArr=[x,y,z]
  isPortrait(),                               // bool
  pointer,                                    // { down:bool, x, y, ndc:Vector2 } 毎フレーム最新
  pointOnPlane(y),                            // 水平面y との交点 Vector3|null（内部でraycaster使用）
  raycastMeshes(meshArray),                   // pointer.ndc からのraycast交差配列（uv取得用）
  ui: {
    setHint(text, icon),                      // 上部ヒントバー
    setProgress(v),                           // 0..1 で表示 / null で非表示
    showBanner(text),                         // 中央に1.6秒バナー
    setFinger(mode),                          // 'circle'|'hold'|null 指ヒント
    makeTray(id, items, onPick),              // 下部トレイ生成。items:[{key, emoji, bg?}]
                                              //   → DOM: <div id="{id}" class="trayBar"><button data-key="{key}">
                                              //   戻り値 { show(), hide(), el }。onPick(key)
    makeActionButton(id, label, onClick),     // 右側の大ボタン（doneBtn風緑）→ { show(), hide() }
  },
  audio: { sfx, setPourSound, setStirSound, setTorchSound },  // §6参照
  stand,                                      // 共有ケーキスタンド { group, topY }（初期 visible=false, 位置(0,0.018,0)）
  STAND_TOP,                                  // 0.018 + stand.topY = 0.084
  env,                                        // { kitchen, sun, oven } oven.setGlow(v)
  finish(),                                   // お祝い完了時に呼ぶ → コアが「もういちど」表示
  registerState(stateObj),                    // window.__game.state として公開（テスト用）
}
```

コアのループは `activeRecipe.update(dt, hdt, t)` → updateTweens(hdt) → カメラ追従 → render。
カメラ追従・resize・orientationchange はコアが処理。

## 4. DOM/テスト契約

- レシピ選択: タイトル内 `#recipeSelect button[data-recipe="dome"|"glaze"|"brulee"]`。
  タップで audio unlock + BGM開始 + タイトルフェードアウト + レシピ start()。
- `window.__game = { select(id), state }`。state は registerState されたオブジェクト
  （dome は従来のフィールド名を維持: phase, mixReady, mixProgress, pourLevel, layerIndex,
  creamProgress, currentCream, decorations, melt）。
- **全ての長押し/なぞり工程は「画面のどこでも長押し」だけでも進む**こと（無操作アシスト:
  なぞると速い、押しっぱなしでも確実に完了する）。失敗・採点は存在しない。
- トレイのボタンはタップのみ。CSSアニメで不安定になるボタンはテストで force タップされる
  前提（強制不可の hidden にしない）。

## 5. レシピ仕様（ゲームデザイン確定版 — 変更する場合はフェーズ名とstateフィールドは維持）

### 5a. glaze「かがみのケーキ」🪞（A2）
発想元: 世界大会のアントルメ+グラサージュ・ミロワール。
見せ場: とろ〜り流れて鏡になる / 型からするり / 切ると断面から秘密のフルーツ。

フェーズ順と state 必須フィールド（state.phase は以下の大文字名）:
1. `MOUSSE` — 透明リング型（transmission素材, r≈0.085, h≈0.09, スタンド上）に3層のムースを注ぐ。
   トレイ `#trayMousse` (key: pink|mint|lemon) で色を選ぶ→長押しで注ぐ（createStream+液面上昇。
   透明型越しに色層が積もって見える）。state.mousseLayer(0..3), state.pourProgress(0..1)。
2. `INSERT` — トレイ `#trayFruit` (key: strawberry|blueberry|orange) タップでフルーツが
   ぽちゃんと落ちてムースに沈む（最後は見えなくなる=ひみつ）。2個置いたら
   アクションボタン `#glazeNext`「できた！」表示。state.insertCount。
3. `FREEZE` — 冷凍庫（レシピ内で自作の小さな冷凍庫メッシュ or 青い冷気演出のみで簡略可）。
   画面タップ→霜のパーティクル+青い光+「カチコチ！」約3秒。state.freezeStarted。
4. `UNMOLD` — 長押しで型がするりと上へ抜け、真っ白なつやつや冷凍ムースが現れる。
   state.unmoldProgress(0..1)。
5. `GLAZE` — トレイ `#trayGlaze` (key: rainbow|pink|choco) で色を選択→長押しでピッチャーから
   グレーズが流れ落ち、上面→側面へとろりと覆い、鏡面(高envMap反射・低roughness)になる。
   垂れは createDripCrown 方式（角度ノイズのアルファカット）を発展させ、下の受け皿に滴る。
   rainbow はグレーズに虹の縞。state.glazeProgress(0..1)。
6. `DECO` — トレイ `#trayGdeco` (key: gold|flower|heart) タップで上面に小さな飾り(金の粒・花・
   ハート)がぽんと乗る。1個以上で `#glazeCut`「きってみる！」表示。state.decoCount。
7. `CUT` — 長押しでナイフが降り、ケーキが2つに割れて左右に開く。**断面キャップに色層の縞と
   沈めたフルーツの断面**が現れる（作り方指定: ムースは最初から左右半円柱×2で構築し、断面
   キャップ面は CUT まで非表示。グレーズ殻も半割で作る）。紙吹雪+ファンファーレ+キラキラ
   → ctx.finish()。state.cutProgress(0..1)。
8. `DONE` — ゆっくりオービット。

### 5b. brulee「あぶってパリン！」🔥（A3）
発想元: クレームブリュレのキャラメリゼ+ベイクドアラスカ。
見せ場: 炎でなぞると白→琥珀に変わる / 飴ガラスがパリンと割れて中から冷たいアイス。

フェーズ順と state 必須フィールド:
1. `CUSTARD` — 大きな耐熱皿（r≈0.11, スタンド上）へ長押しでカスタードを注ぐ
   （createStream+液面上昇+ゆらぎ）。state.custardLevel(0..1)。
2. `SCOOP` — トレイ `#trayFlavor` (key: vanilla|berry|melon) タップでアイスのまるい
   スクープがぽとんと落ちて皿に乗る（3個で自動進行 or `#bruleeNext`）。state.scoopCount。
3. `MERINGUE` — 長押しでメレンゲがもこもこ絞り出されアイスをすっぽり山型に覆い隠す
   （ひみつ化。createCreamSwirl流のdrawRange or 盛り上がるブロブ群）。state.meringueProgress。
4. `SUGAR` — タップ連打/長押しで砂糖がパラパラ降りキラキラ積もる（パーティクル）。
   state.sugarProgress(0..1)。
5. `TORCH` — バーナー登場。**指でなぞる（or 長押しで自動）と炎が走り、触れた場所の
   メレンゲが白→こんがり琥珀に変わる**。作り方指定: メレンゲ表面のmapを動的CanvasTexture
   (512px)にし、raycastMeshes()のuvへ焼き色スタンプを描き込む。焼けた所は艶のある飴の
   カラメル層が出現（別メッシュのfade-in）。湯気+ジュワァ音(setTorchSound)。
   state.torchProgress(0..1 焼き被覆率)。
6. `CRACK` — 「タップして わってみよう！」タップ1回目: ヒビ（放射クラック線）+パキッ。
   2回目: ヒビ拡大。3回目: **飴ガラスの破片が割れて飛び散り**、中から冷たいアイス+白い
   冷気ミスト+カスタード。てっぺんに花火(スパークラー)が立って点火、紙吹雪+ファンファーレ
   → ctx.finish()。state.crackStage(0..3)。
7. `DONE` — オービット。

## 6. audio.js 追加API（A1が実装、A2/A3は呼ぶだけ）

- `setTorchSound(v)` — 0..1 バーナーのゴォー（ローパスノイズループ）
- `sfx.crack(stage)` — stage 1..3 ガラスの割れ（高→派手に）
- `sfx.knifeCut()` — シャッという切り音
- `sfx.freeze()` — キラキラ下降アルペジオ（冷気）
- `sfx.unmold()` — するり+ポン
- `sfx.scoop()` — ぽとん（既存plop流用でも可）
既存: sfx.tap/pop/plop/puff/ding/chime/sparkle/whoosh/meltRumble/fanfare,
setPourSound(v), setStirSound(v)。

## 7. 品質バー（全員）

- 実寸感のある寸法・材質（PBR/クリアコート/透過）・影・接地。近中遠の奥行き維持。
- カメラは各フェーズで ctx.camPhase を設定（主役が画面中央、縦横両対応はコアが処理）。
- 幼児向け: 大きな操作対象、即時フィードバック（音+視覚）、ひらがなヒント、失敗なし。
- console error ゼロ。`node --check` 通過。dispose不要（reload方式）。
- コメントは日本語で要点のみ。既存コードのスタイルに合わせる。
