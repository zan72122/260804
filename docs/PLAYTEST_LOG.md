# PLAYTEST_LOG — 実際に操作した記録

## 2026-08-03/04 主任エージェントによる実ブラウザ試遊(Chromium / Playwright)

### セッション1 — 844×390 (iPhone横) 手動スクリプト試遊

- 経路: title → play → arrive → scan → prep(2ユニットドラッグ) → lever → grind(スワイプ3回)
- 結果: grind まで到達、火花62粒、console error 1件(favicon 404)
- 発見: favicon 404 → index.html に data URI favicon を追加して解消
- 証拠: artifacts/playtest/dev/01〜06

### セッション2 — 390×844 (iPhone縦) 手動スクリプト試遊

- 発見(P0): 縦画面のカメラが車体内部にあり、車体が全画面を覆いレーザーも
  レール前方も見えない。ユニットのドッキングも成立しない。
- 修正: 透視カメラを後方14mへ、カメラ高5m(屋根越しに前方を見る構図)、
  カメラ背後の車体は非描画、ソケットを左右レールへ分離、スキャン中の縦カメラは
  車に留めてレーザーが奥へ遠ざかる構図に変更。描画順を奥→手前に修正。
- 再試遊: grind まで到達、火花48、console error 0。
- 証拠: artifacts/playtest/dev/p01〜p06

### セッション3 — E2E一式(4寸法)

- 発見(P0): 入場時のガタガタ揺れが常に0 — wheelNoise が初回基準位置を
  保存せず、ティックが一度も発火しないバグ。修正+回帰ユニットテスト追加。
- 発見(P1): テストヘルパ playTo が通過済み phase を待ってデッドロック。修正。
- 修正後: E2E 11/11 通過(フルループ×4寸法、回転×2、乱打系×4、設定×1)。
- 証拠: artifacts/playtest/{iphone-portrait,iphone-landscape,ipad-portrait,ipad-landscape,rotation-*,safety,settings}/

### セッション4 — スクリーンショットレビュー

- 発見(P1): 未削正区間の波形が |h| 基準の色分けでゼロ交差点がシアンに
  なり「直っていないのに直って見える」→ 局所包絡線基準の色分けへ修正。
- 発見(P2): 火花が小さい → 火花ストロークを2.6倍幅・伸長し視認性向上。
- 修正後 iphone-portrait フルループ再実行: 通過。

## 2026-08-04 独立 game-feel-verifier(新規コンテキスト, Fable)

- 結果は下記「独立検証」節へ追記する。
- 証拠: artifacts/playtest/verifier/
