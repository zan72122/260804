# あめのいと (Spun Sugar)

小さな子ども（4歳ごろ）向けの、指1本で遊べるモバイルWebトイです。テキストや文章による説明は不要で、遊びながら直感的に理解できるように作られています。

**遊び方**：温かいキャラメルの入った鍋に道具（ディッパー）をひたし、画面上部の2本の柱のあいだを左右にスワイプすると、極細の透き通った飴色の糖の糸が宙に張られていきます。スワイプを繰り返すごとに糸が増え、キラキラ光る「巣」のように積み重なっていきます。巣が完成すると光の輪が現れ、指でつまんでデザートの上にそっと乗せると、光の粒がきらめく演出とともにお祝いが起こり、しばらくすると自動的に最初の状態に戻ります。スコアや失敗はなく、何度でも遊べます。

## 実行方法

ビルド不要・外部依存なしの素の ES モジュールで作られています。プロジェクトのルートで簡易HTTPサーバーを立てて開くだけです。

```
python3 -m http.server
```

ブラウザ（またはiPhone/iPadのSafari）で `http://localhost:8000`（または表示されたポート番号）を開いてください。縦向き（ポートレート）・横向き（ランドスケープ）の両方に対応しています。

## アーキテクチャ

- ビルドステップなし・外部ライブラリなしの素のES モジュール群（`js/*.js`）と、単一の `<canvas>` によるCanvas 2D描画のみで構成されています。
- モジュール構成は `CONTRACT.md` のモジュールマップに準拠しています（`main.js` がブート/メインループ、`input.js` がポインタ入力、`scene.js` が背景・鍋・アンカー・デザート・カメラ、`tool.js` が道具とキャラメル、`threads.js` が糸システムの中核、`finish.js`/`audio.js` が仕上げ演出とサウンド）。
- 性能を保つため、糸の描画はバッチ処理されたCanvasストロークと、オフスクリーンに焼き込んだ（bake）レイヤーの合成で行われ、モバイルでも滑らかな60fps前後を維持します。

## Credits

Built by a multi-agent Claude Code workflow.

---

# あめのいと (Spun Sugar)

A one-finger mobile web toy for young children (around age 4). It needs no text or instructions — the play itself is the interface.

**How to play**: dip the tool into the pot of warm caramel, then swipe left and right in the airspace between the two anchor posts near the top of the screen. Fine, translucent amber sugar threads span the gap and accumulate with each pass into a glowing nest. Once the nest is full, a soft halo appears — pick it up with a finger and glide it onto the dessert. A burst of sparkles and a gentle camera zoom celebrate the moment, then the scene resets automatically for another round. There's no score and no way to fail.

## How to run

Vanilla ES modules, no build step, no dependencies. From the project root, serve it with a simple HTTP server:

```
python3 -m http.server
```

Then open the shown address (e.g. `http://localhost:8000`) on an iPhone/iPad or any browser. Works in both portrait and landscape orientation.

## Architecture notes

- Plain ES modules (`js/*.js`) with no build step and no external libraries, rendering to a single `<canvas>` via Canvas 2D — nothing else.
- The module layout follows the map in `CONTRACT.md` (`main.js` boots and runs the main loop; `input.js` handles pointer/swipe input; `scene.js` draws the background, pot, anchors, dessert and camera; `tool.js` drives the dipper tool and caramel load; `threads.js` is the core sugar-thread system; `finish.js`/`audio.js` handle the nest-lift finale, celebration and procedural sound).
- To keep performance smooth, thread rendering is batched into grouped canvas strokes with older strands baked into offscreen cached layers and composited each frame — this keeps the game near 60fps on mobile even with a dense nest.

## Credits

Built by a multi-agent Claude Code workflow.
