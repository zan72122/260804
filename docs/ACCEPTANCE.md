# ACCEPTANCE — 機械的に確認できる完成条件

各条件の検証方法と最新結果は docs/EVIDENCE_LEDGER.md を参照。

| ID | 条件 | 機械的確認方法 |
|----|------|----------------|
| A1 | タイトル→(入場→前スキャン→ユニット準備→ガコン→シャーッ→後スキャン→試験走行)→再プレイ選択→再開 まで一周できる | E2E full-loop: 実ポインタ操作で全遷移を辿り `__railGameTest.getState()` を検証 |
| A2 | 390×844 / 844×390 / 820×1180 / 1180×820 の4寸法で一周できる | E2E full-loop を4 viewportプロジェクトで実行 |
| A3 | 画面回転後も作業状態(state・レール高さ場・車位置)が保持される | E2E rotation: grind途中でviewport縦↔横、状態とrail RMSが不変か検証 |
| A4 | console error / 未処理例外 / unhandledrejection がゼロ | 全E2Eで console+pageerror を収集し assert 0件 |
| A5 | スキャン前後でレール形状可視化が明瞭に異なる | E2E: scanAfter時に前後RMS比を検証(≥60%減) + screenshot |
| A6 | 削正ユニット接触前は火花が出ない | E2E: lower完了前に `getSparkCount()===0`、grind中>0 |
| A7 | 車両位置とレール変形位置が同期 | unit test: grindAt が研削位置近傍のみ変形。E2E: 車前方の未通過域RMSが不変 |
| A8 | 作業前後の走行音と揺れが明瞭に異なる | unit: 粗さ→shake/音強度の写像が単調。E2E: testRun時 roughness < 閾値でquietモード出力を検証 |
| A9 | 多少ずれた一指入力でも進行できる | E2E: レバー中心から±40px ずれたスワイプ、斜めスワイプで成立 |
| A10 | 連打・逆方向スワイプ・途中離脱で状態機械が壊れない | E2E safety: 乱打後も getState() が正規状態、console error 0 |
| A11 | 主要タッチ対象 ≥64 CSS px(主要操作は72px以上目標) | E2E: `getHotspots()` の全対象 width/height を assert |
| A12 | 高速な全画面点滅がない | 実装制約(火花は後方限定領域・輝度上限)+ verifier目視。フレーム全体輝度の急変をE2Eでサンプル検証 |
| A13 | 光・動き・音を弱める設定が動作し永続化される | E2E: トグル→リロード→localStorage反映と挙動フラグを検証 |
| A14 | 完了後2タップ以内で看板体験(スキャン)に戻れる | E2E: replay→(1タップ)→arrive短縮→scanBefore が2タップ以内 |
| A15 | MVP外機能(追加ステージ・経営・通貨・アンロック等)が存在しない | コードレビュー + grep(不存在確認) |
| A16 | スクリーンショット・テスト結果・実操作記録が artifacts/playtest/ と docs に存在 | ファイル存在確認 |
| A17 | テストの削除・skip・弱体化で通していない | git履歴 + テストファイルに skip/only が無いこと |
